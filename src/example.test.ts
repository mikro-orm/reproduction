import { defineEntity, MikroORM, p } from '@mikro-orm/postgresql';
import 'reflect-metadata';

export const ItemSchema = defineEntity({
  name: 'Item',
  indexes: [
    {
      name: 'item_deleted_at_idx',
      expression: (columns, table) =>
        `CREATE INDEX item_deleted_at_idx ON ${table.qualifiedName} (${columns.code}) WHERE ${columns.deletedAt} IS NULL`,
    },
  ],
  properties: {
    id: p.integer().primary(),
    code: p.text(),
    deletedAt: p.datetime().nullable()
  }
})
export class Item extends ItemSchema.class {}
ItemSchema.setClass(Item);

export const UserSchema = defineEntity({
  name: 'User',
  schema: 'auth',
  indexes: [
    {
      name: 'user_deleted_at_idx',
      expression: (columns, table) =>
        `CREATE INDEX user_deleted_at_idx ON ${table.qualifiedName} (${columns.code}) WHERE ${columns.deletedAt} IS NULL`,
    },
  ],
  properties: {
    id: p.integer().primary(),
    code: p.text(),
    deletedAt: p.datetime().nullable()
  }
})
export class User extends UserSchema.class {}
UserSchema.setClass(User);

let orm: MikroORM;

beforeAll(async () => {
  orm = await MikroORM.init({
    clientUrl: 'postgresql://neondb_owner:npg_TsDK7vCqH1ib@ep-odd-firefly-a1rh5omt-pooler.ap-southeast-1.aws.neon.tech/mikro-orm-reproduction?sslmode=require&channel_binding=require',
    entities: [Item, User],
    debug: ['query', 'query-params'],
    allowGlobalContext: true, // only for testing
    driverOptions: {
      ssl: { rejectUnauthorized: false },
    },
  });
  await orm.schema.refresh();
});

afterAll(async () => {
  await orm.close(true);
});

test('item - custom index changes on public schema', async () => {
  const meta = orm.getMetadata().get(Item);
  meta.indexes = []

  const updateSchema = await orm.schema.getUpdateSchemaSQL();
  console.log(updateSchema, 'Update schema for Item');
  await orm.schema.update()
});


test('user - custom index changes on non-public schema', async () => {
  const meta = orm.getMetadata().get(User);
  meta.indexes = []

  const updateSchema = await orm.schema.getUpdateSchemaSQL();
  console.log(updateSchema, 'Update schema for User');
  await orm.schema.update()
});
