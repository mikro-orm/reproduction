import { defineEntity, EventArgs, EventSubscriber, MikroORM, p, wrap } from '@mikro-orm/postgresql';

const ItemSchema = defineEntity({
  name: 'Item',
  properties: {
    id: p.integer().primary(),
    name: p.text(),
    url: p.text(),
  },
});
export class TestSubscriber implements EventSubscriber {
  async beforeUpdate(
    args: EventArgs<any>,
  ): Promise<void> {
    const loadedEntity = await args.em.findOne(args.meta.class, args.entity);
    console.log(loadedEntity)
  }
}
class Item extends ItemSchema.class {}
ItemSchema.setClass(Item);

let orm: Awaited<ReturnType<typeof MikroORM.init>>;

beforeAll(async () => {
  orm = await MikroORM.init({
    clientUrl: 'postgresql://neondb_owner:npg_iz5afD0QpULJ@ep-odd-firefly-a1rh5omt-pooler.ap-southeast-1.aws.neon.tech/cicd-demo-test?sslmode=require&channel_binding=require',
    entities: [Item],
    subscribers: [TestSubscriber],
    driverOptions: {
      ssl: true
    }
  });
  await orm.connect()
  await orm.schema.refresh()
});

afterAll(async () => {
  await orm.schema.drop();
  await orm.close(true);
});

test(`subscriber update with loaded entity`, async () => {
  const em = orm.em.fork();
  const item = em.create(Item, {name: 'Name', url: 'any'})
  await em.flush();

  wrap(item).assign({
    name: 'New name'
  })
  // before update will run and fetch a findOne
  // but the item is already loaded so the
  // findOne inside subscriber also return 'New name'
  await em.flush();

  const fetchItemAgain = await em.findOneOrFail(Item, item)
  expect(fetchItemAgain.name).toBe('New name')
})

test(`subscriber update with reference`, async () => {
  const em = orm.em.fork();
  const item = em.create(Item, {name: 'Name', url: 'any'})
  await em.flush();

  await em.clear()

  const reference = em.getReference(Item, item.id)
  wrap(reference).assign({
    name: 'New name'
  })
  // before update will run and fetch a findOne
  // but the item is never loaded so
  // findOne inside subscriber still has 'Name'
  // and now it overwrites on the reference assign
  // an update never happen
  await em.flush();

  const fetchItemAgain = await em.findOneOrFail(Item, item)
  expect(fetchItemAgain.name).toBe('New name')
})
