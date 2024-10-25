import {
  Collection,
  DecimalType,
  defineConfig,
  Embeddable,
  Embedded,
  Entity,
  ManyToOne,
  MikroORM,
  OneToMany,
  PrimaryKey,
  Property,
} from "@mikro-orm/postgresql";

export class CustomDecimalType extends DecimalType {
  compareValues(a: string, b: string): boolean {
    return (
      parseFloat(String(a)).toFixed(this.prop?.scale ?? 2) ===
      parseFloat(String(b)).toFixed(this.prop?.scale ?? 2)
    );
  }
}

@Embeddable()
export class Money {
  @Property({
    type: new CustomDecimalType("number"),
    scale: 2,
  })
  amount: number;

  @Property({ length: 3 })
  currencyCode: string;

  constructor(amount: number, currencyCode: string) {
    this.amount = amount;
    this.currencyCode = currencyCode;
  }
}

@Entity({ tableName: "test_user" })
class User {
  @PrimaryKey()
  id!: number;

  @Property()
  name: string;

  @Property()
  email: string;

  @Property({ type: "decimal", scale: 2 })
  decimal: number | null = null;

  @OneToMany<Book, User>({
    entity: () => Book,
    mappedBy: (book) => book.user,
    orderBy: {
      id: "ASC",
    },
  })
  books = new Collection<Book, this>(this);

  constructor(
    id: number,
    name: string,
    email: string,
    decimal: number | null = null
  ) {
    this.id = id;
    this.name = name;
    this.email = email;
    this.decimal = decimal;
  }
}

@Entity({ tableName: "test_books" })
class Book {
  @PrimaryKey()
  id!: number;

  @Property()
  name: string;

  @Property({
    type: new CustomDecimalType("number"),
    runtimeType: "number",
    scale: 2,
  })
  decimalAmount: number;

  @Embedded(() => Money)
  price: Money;

  @ManyToOne<Book, User>({
    entity: () => User,
    inversedBy: (user) => user.books,
  })
  user: User;

  constructor(
    id: number,
    name: string,
    decimalAmount: number,
    price: Money,
    user: User
  ) {
    this.id = id;
    this.name = name;
    this.decimalAmount = decimalAmount;
    this.price = price;
    this.user = user;
  }
}

describe("should not update entities just for find them inside a transaction", () => {
  let orm: MikroORM;
  let loggerMessages: string[] = [];

  beforeAll(async () => {
    orm = await MikroORM.init(
      defineConfig({
        clientUrl: "postgresql://admin:admin@localhost:5432/admin_api",
        entities: [User, Book],
        debug: ["query", "query-params"],
        allowGlobalContext: true, // only for testing
        forceEntityConstructor: true,
        logger: (message: string) => {
          loggerMessages.push(message);
        },
      })
    );
    await orm.schema.refreshDatabase();
  });

  beforeEach(() => {
    loggerMessages = [];
  });

  afterAll(async () => {
    await orm.close(true);
  });

  test("should not update book entity when findOne a user WITHOUT books", async () => {
    await orm.em.transactional(async () => {
      const user = orm.em.create(User, {
        id: 1,
        name: "Foo",
        email: "foo",
        decimal: 2.22,
      });
      user.books.add(
        new Book(1, "book-1", 11.45, new Money(10.54, "USD"), user)
      );
    });

    orm.em.clear();

    await orm.em.transactional(async () => {
      await orm.em.findOne(User, {
        id: 1,
      });
    });

    const unwantedUpdate = loggerMessages.find((message: string) => {
      return /(update|(update \"test_books\" set \"decimal_amount\" = 11.45, \"price_amount\" = 10.54 where \"id\" = 1))/gi.test(
        message
      );
    });

    expect(unwantedUpdate).toBeFalsy();
  });

  test("should not update book entity when findOne Book when decimals are zeros", async () => {
    await orm.em.transactional(async () => {
      const user = orm.em.create(User, {
        id: 5,
        name: "Foo",
        email: "foo",
        decimal: 2,
      });
      user.books.add(new Book(5, "book-1", 11.0, new Money(10.0, "USD"), user));
    });

    orm.em.clear();

    await orm.em.transactional(async () => {
      await orm.em.findOne(Book, {
        id: 5,
      });
    });

    const unwantedUpdate = loggerMessages.find((message: string) => {
      return /(update)/gi.test(message);
    });

    expect(unwantedUpdate).toBeFalsy();
  });

  test("should not update book entity when findOne Book when decimals are missing", async () => {
    await orm.em.transactional(async () => {
      const user = orm.em.create(User, {
        id: 6,
        name: "Foo",
        email: "foo",
        decimal: 2,
      });
      user.books.add(new Book(6, "book-1", 11, new Money(10, "USD"), user));
    });

    orm.em.clear();

    await orm.em.transactional(async () => {
      await orm.em.findOne(Book, {
        id: 6,
      });
    });

    const unwantedUpdate = loggerMessages.find((message: string) => {
      return /(update|(update \"test_books\" set \"decimal_amount\" = 11, \"price_amount\" = 10 where \"id\" = 1))/gi.test(
        message
      );
    });

    expect(unwantedUpdate).toBeFalsy();
  });

  test("should not update book entity when findOne Book when decimals have specific decimals making JS round badly", async () => {
    await orm.em.transactional(async () => {
      const user = orm.em.create(User, {
        id: 6,
        name: "Foo",
        email: "foo",
        decimal: 2,
      });
      user.books.add(
        new Book(6, "book-1", 185.385, new Money(185.385, "USD"), user)
      );
    });

    orm.em.clear();

    const bookResult = await orm.em.transactional(async () => {
      return await orm.em.findOneOrFail(Book, {
        id: 6,
      });
    });

    const unwantedUpdate = loggerMessages.find((message: string) => {
      return /(update)/gi.test(message);
    });

    expect(unwantedUpdate).toBeFalsy();

    orm.em.clear();

    await orm.em.transactional(async (em) => {
      em.merge(bookResult);
      expect(bookResult.price.amount).toBe(185.39); // Database rounds "185.385" to "185.39"
      bookResult.price = new Money(185.385, "USD"); // I store again the initial price value "185.385"
    });

    const anotherUnwantedUpdate = loggerMessages.find((message: string) => {
      return /(update \"test_books\" set \"price_amount\" = 185.385 where \"id\" = 6)/gi.test(
        message
      );
    });

    expect(anotherUnwantedUpdate).toBeFalsy();
  });

  test("should not update book entity when findOne a user WITH books", async () => {
    await orm.em.transactional(async () => {
      const user = orm.em.create(User, {
        id: 2,
        name: "Foo",
        email: "foo",
        decimal: 2.22,
      });
      user.books.add(
        new Book(2, "book-2", 11.45, new Money(10.54, "USD"), user)
      );
    });

    orm.em.clear();

    await orm.em.transactional(async () => {
      await orm.em.findOne(
        User,
        {
          id: 2,
        },
        {
          populate: ["books"],
        }
      );
    });

    const unwantedUpdate = loggerMessages.find((message: string) => {
      return /(update|(update \"test_books\" set \"decimal_amount\" = 11.45, \"price_amount\" = 10.54 where \"id\" = 1))/gi.test(
        message
      );
    });

    expect(unwantedUpdate).toBeFalsy();
  });

  test("should not update book entities when find them after creating using constructors", async () => {
    await orm.em.transactional(async (em) => {
      const user = new User(3, "Foo", "foo", 2.22);
      const book = new Book(3, "book-3", 11.45, new Money(10.54, "USD"), user);

      user.books.add(book);

      em.persist(user);
      em.persist(book);
    });

    orm.em.clear();

    await orm.em.transactional(async () => {
      await orm.em.findOne(
        User,
        {
          id: 3,
        },
        {
          populate: ["books"],
        }
      );
    });

    const unwantedUpdate = loggerMessages.find((message: string) => {
      return /(update|(update \"test_books\" set \"decimal_amount\" = 11.45, \"price_amount\" = 10.54 where \"id\" = 1))/gi.test(
        message
      );
    });

    expect(unwantedUpdate).toBeFalsy();
  });
});
