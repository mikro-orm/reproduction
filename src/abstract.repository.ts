import { EntityRepository, FilterQuery } from "@mikro-orm/core";
import type { AbstractEntity } from "./abstract.entity";
import { Status } from "./status.enum";

export abstract class AbstractRepository<
  Entity extends AbstractEntity<Entity>
> extends EntityRepository<Entity> {
  public async countWaiting() {
    return this.count({
      status: Status.WAITING,
    } as FilterQuery<Entity>);
  }

  public async countWaiting2() {
    return this.count({
      status: Status.WAITING,
    });
  }

  public async countWaiting3() {
    return this.count({
      status: Status.WAITING,
    } as FilterQuery<AbstractEntity<Entity>>);
  }
}
