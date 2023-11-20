import { MikroORM, ReflectMetadataProvider, wrap } from '@mikro-orm/mongodb';
import { User } from './user.entity';
import { StripeSubscription } from './stripe-subscription.entity';
import { StripeSubscription2 } from './stripe-subscription-2.entity';

let orm: MikroORM;

beforeAll(async () => {
  orm = await MikroORM.init({
    clientUrl: process.env.MONGO_URI,
    dbName: 'somedb',
    entities: [User, StripeSubscription, StripeSubscription2],
    debug: ['query', 'query-params'],
    allowGlobalContext: true, // only for testing
    implicitTransactions: false,
    strict: true,
    populateAfterFlush: true,
    metadataProvider: ReflectMetadataProvider,
  });
  await orm.schema.refreshDatabase();
});

afterAll(async () => {
  await orm.close(true);
});

test('basic CRUD example', async () => {
  orm.em.create(User, { name: 'Foo', email: 'foo' });
  await orm.em.flush();
  orm.em.clear();

  const user = await orm.em.findOneOrFail(User, { email: 'foo' });
  expect(user.name).toBe('Foo');
  user.name = 'Bar';
  orm.em.remove(user);
  await orm.em.flush();

  const count = await orm.em.count(User, { email: 'foo' });
  expect(count).toBe(0);
});

test('Test Embeddabled', async () => {
  const user = orm.em.create(User, { name: 'Foo', email: 'foo' });
  await orm.em.flush();
 
  const sub1 = new StripeSubscription()
  wrap(sub1).assign({id: 'aaa', start: new Date(), end: new Date() ,status: 'ok'});
  user.stripeSubscriptions = [...user.stripeSubscriptions,sub1]

  const sub2 = new StripeSubscription2()
  wrap(sub2).assign({stripeId: 'aaa', start: new Date(), end: new Date() ,status: 'ok'});
  user.stripeSubscriptions2 = [...user.stripeSubscriptions2,sub2]

  await orm.em.flush();

  expect(user.stripeSubscriptions[0].id).toBe('aaa');
  expect(user.stripeSubscriptions2[0].stripeId).toBe('aaa');

  console.log(user)

  const userw = await orm.em.findOneOrFail(User, { email: 'foo' });
  console.log(userw)

  expect(userw.stripeSubscriptions[0].id).toBe('aaa');
  expect(userw.stripeSubscriptions2[0].stripeId).toBe('aaa');


});
