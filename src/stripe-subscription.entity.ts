import { Embeddable, Property } from '@mikro-orm/core';

@Embeddable()
export class StripeSubscription {
  @Property()
  public id!: string;

  @Property()
  public start!: Date;

  @Property()
  public end!: Date;

  @Property({ type: 'string' })
  public status!: string;
}
