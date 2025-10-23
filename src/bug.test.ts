import {
  Entity,
  MikroORM,
  PrimaryKey,
  Property,
  ManyToOne,
  Filter,
  Ref,
  ref,
  LoadStrategy,
} from "@mikro-orm/sqlite";

/**
 * Document entity with soft delete filter
 */
@Entity()
@Filter({ name: "notDeleted", cond: { deleted: false }, default: true })
class Document {
  @PrimaryKey()
  id!: number;

  @Property()
  title: string;

  @Property({ default: false })
  deleted: boolean = false;

  constructor(title: string) {
    this.title = title;
  }
}

/**
 * User entity with a non-eager relation to Document
 */
@Entity()
class User {
  @PrimaryKey()
  id!: number;

  @Property()
  email: string;

  @ManyToOne(() => Document, { nullable: true })
  lastDocument?: Ref<Document>;

  constructor(email: string) {
    this.email = email;
  }
}

let orm: MikroORM;

beforeAll(async () => {
  orm = await MikroORM.init({
    dbName: ":memory:",
    entities: [User, Document],
    debug: ["query", "query-params"],
    allowGlobalContext: true,
    loadStrategy: LoadStrategy.SELECT_IN,
    forceUndefined: true,
  });
  await orm.schema.refreshDatabase();
});

afterAll(async () => {
  await orm.close(true);
});

test("findOne returns null when populating non-eager relation with soft-deleted entity", async () => {
  // Setup
  const document = orm.em.create(Document, { title: "Document 1" });
  await orm.em.flush();

  const user = orm.em.create(User, { email: "user@example.com" });
  user.lastDocument = ref(document);
  await orm.em.flush();

  const userId = user.id;
  orm.em.clear();

  // Verify user exists before soft delete
  const userBefore = await orm.em.findOne(User, { id: userId });
  expect(userBefore).not.toBeNull();

  // Soft delete the document
  const docToDelete = await orm.em.findOneOrFail(
    Document,
    { id: document.id },
    {
      filters: { notDeleted: false },
    },
  );
  docToDelete.deleted = true;
  await orm.em.flush();
  orm.em.clear();

  // BUG: Populating a non-eager relation that has a global filter causes findOne to return null
  const userAfter = await orm.em.findOne(
    User,
    { id: userId },
    {
      populate: ["lastDocument"],
    },
  );

  // Expected: User entity is returned (it exists in the database)
  // Actual in v6.5.0+: Returns null
  //
  // The generated SQL incorrectly includes a branching condition:
  //   AND (last_document_id IS NULL OR document.id IS NOT NULL)
  //
  // Since the document is soft-deleted, the LEFT JOIN with the filter doesn't match,
  // resulting in document.id being NULL. The branching condition evaluates to FALSE,
  // incorrectly filtering out the entire user row.
  expect(userAfter).not.toBeNull();
  expect(userAfter?.email).toBe("user@example.com");
});

test("findOne works when relation is not populated", async () => {
  // Setup
  const document2 = orm.em.create(Document, {
    title: "Document 2",
    deleted: true,
  });
  const user2 = orm.em.create(User, { email: "user2@example.com" });
  user2.lastDocument = ref(document2);
  await orm.em.flush();

  const userId2 = user2.id;
  orm.em.clear();

  // Without populate, the query works correctly
  const result = await orm.em.findOne(User, { id: userId2 });

  expect(result).not.toBeNull();
  expect(result?.email).toBe("user2@example.com");
});
