import { BaseEntity, Entity, Enum, Opt, PrimaryKey } from "@mikro-orm/core";
import { Status } from "./status.enum";

@Entity()
export abstract class AbstractEntity<
  Entity extends AbstractEntity<Entity>
> extends BaseEntity {
  @PrimaryKey()
  id!: number;

  @Enum({ type: "Status", items: () => Status })
  public status: Opt<Status> = Status.WAITING;
}
