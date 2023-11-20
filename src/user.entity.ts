import { Entity, PrimaryKey, Property,Embedded,Opt, SerializedPrimaryKey } from '@mikro-orm/core';
import { ObjectId } from '@mikro-orm/mongodb';
import { StripeSubscription } from './stripe-subscription.entity';
import { StripeSubscription2 } from './stripe-subscription-2.entity';

@Entity()
export class User {

  @PrimaryKey()
  _id!: ObjectId;

  @SerializedPrimaryKey()
  id!: string;

  @Property()
  name: string;

  @Property({ unique: true })
  email: string;

  @Embedded(() => StripeSubscription, { array: true })
  public stripeSubscriptions: StripeSubscription[] & Opt = [];

  @Embedded(() => StripeSubscription2, { array: true })
  public stripeSubscriptions2: StripeSubscription2[] & Opt = [];

  constructor(name: string, email: string) {
    this.name = name;
    this.email = email;
  }

}
