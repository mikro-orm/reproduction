import { Entity, EntityRepositoryType, Property } from "@mikro-orm/core";
import { AbstractEntity } from "./abstract.entity";
import { UserRepository } from "./user.repository";

@Entity()
export class User extends AbstractEntity<User> {
  public [EntityRepositoryType]?: UserRepository;

  @Property()
  name!: string;

  @Property({ unique: true })
  email!: string;
}
