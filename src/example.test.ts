import { defineEntity, MikroORM, p } from '@mikro-orm/postgresql';
import 'reflect-metadata';

export const OrderSchema = defineEntity({
  name: 'Order',
  properties: {
    id: p.integer().primary(),
    name: p.text(),
    item: () => p.oneToOne(OrderItem),
    note: () => p.oneToOne(OrderNote),
  }
})
export class Order extends OrderSchema.class {}
OrderSchema.setClass(Order);

export const OrderItemSchema = defineEntity({
  name: 'OrderItem',
  schema: 'inventory',
  properties: {
    id: p.integer().primary(),
    name: p.text(),
  }
})
export class OrderItem extends OrderItemSchema.class {}
OrderItemSchema.setClass(OrderItem);

export const OrderNoteSchema = defineEntity({
  name: 'OrderNote',
  schema: 'notes',
  properties: {
    id: p.integer().primary(),
    name: p.text(),
  }
})
export class OrderNote extends OrderNoteSchema.class {}
OrderNoteSchema.setClass(OrderNote);

let orm: MikroORM;

beforeAll(async () => {
  orm = await MikroORM.init({
    clientUrl: 'postgresql://neondb_owner:npg_TsDK7vCqH1ib@ep-odd-firefly-a1rh5omt-pooler.ap-southeast-1.aws.neon.tech/mikro-orm-reproduction?sslmode=require&channel_binding=require',
    entities: [Order, OrderItem, OrderNote],
    debug: ['query', 'query-params'],
    allowGlobalContext: true,
    driverOptions: {
      ssl: { rejectUnauthorized: false },
    },
  });
  await orm.schema.refresh();

  orm.em.create(Order, { id: 1, name: 'Order #1', item: {
    id: 1, name: 'Item #1'
  }, note: {
    id: 1, name: 'Note #1'
  } });
  await orm.em.flush();
  orm.em.clear();
});

afterAll(async () => {
  await orm.close(true);
});

test('find order with fields returns order and item data correctly', async () => {
  const order = await orm.em.findOneOrFail(Order, { id: 1 }, {
    fields: ['id', 'name', 'item.id', 'item.name'],
  }) as Order;

  expect(order.id).toBe(1);
  expect(order.name).toBe('Order #1');
  expect(order.item.id).toBe(1);
  expect(order.item.name).toBe('Item #1');
});

test('find order with fields and populate note fails to return item data', async () => {
  orm.em.clear()
  const order = await orm.em.findOneOrFail(Order, { id: 1 }, {
    fields: ['id', 'name', 'item.id', 'item.name'],
    populate: ['note'],
  }) as Order;

  expect(order.id).toBe(1);
  expect(order.name).toBe('Order #1');
  expect(order.item.id).toBe(1);
  expect(order.item.name).toBe('Item #1');
});
