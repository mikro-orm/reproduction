# Bug Report: findOne returns null when populating non-eager relation with global filter

## Summary

`findOne()` incorrectly returns `null` when:
1. An entity has a non-eager `@ManyToOne` relation to another entity
2. The related entity has a global filter (e.g., soft delete)
3. The relation is populated explicitly via `populate` option
4. The related entity instance is filtered out by the global filter

**Expected**: The parent entity should be returned with the relation filtered out
**Actual**: `findOne()` returns `null` as if the parent entity doesn't exist

## Environment

- **MikroORM version**: 6.5.0+ (bug introduced in v6.5.0)
- **Driver**: All drivers (SQLite, PostgreSQL, MySQL)
- **Introduced by**: Commit `2d1b889` - "refactor handling of filters on relations"

## Reproduction

See `src/bug.test.ts` for a minimal reproduction with SQLite in-memory database.

### Setup

```typescript
// Entity with global filter (soft delete)
@Entity()
@Filter({ name: 'notDeleted', cond: { deleted: false }, default: true })
class Document {
  @Property({ default: false })
  deleted: boolean = false;
}

// Parent entity with eager and non-eager relations
@Entity()
class User {
  @ManyToOne(() => Document, { nullable: true })  // Not eager
  lastDocument?: Ref<Document>;
}
```

### Steps

1. Create a User with a Document
2. Soft-delete the Document
3. Query the User with explicit populate:
   ```typescript
   await orm.em.findOne(User, { id }, { populate: ['lastDocument'] })
   ```

### Result

The query adds an incorrect branching condition:
```sql
SELECT u0.*, a1.*, d2.*
FROM user AS u0
INNER JOIN account AS a1 ON u0.account_id = a1.id
LEFT JOIN document AS d2 ON u0.last_document_id = d2.id AND d2.deleted = false
WHERE u0.id = 1
  AND (u0.last_document_id IS NULL OR d2.id IS NOT NULL)  -- INCORRECT
LIMIT 1
```

Since the document is soft-deleted:
- The LEFT JOIN condition `d2.deleted = false` doesn't match
- Therefore `d2.id` is NULL
- The condition evaluates to: `(FALSE OR FALSE)` = `FALSE`
- The entire row is filtered out, returning `null`

## Root Cause

The bug was introduced in v6.5.0 by commit `2d1b889`:
> sql: refactor handling of filters on relations (#6760, #6784)

This refactoring incorrectly adds a branching condition when:
- A relation has a global filter
- The relation is not eager but is populated explicitly
- Another relation on the same entity is eager

The branching condition `(foreign_key IS NULL OR related_id IS NOT NULL)` is meant to optimize JOINs but doesn't account for filtered relations where the JOIN may not match due to the filter, not due to the absence of the related entity.

## Impact

This bug affects production applications where:
- Entities have soft-delete or other global filters
- Relations are populated on demand rather than eagerly loaded
- Users receive "not found" errors for entities that exist in the database

In our case, this prevented users from authenticating because their profile lookup failed.

## Workarounds

### 1. Remove populate hint (if not needed)
```typescript
// Instead of
await findOne(id, { populate: ['lastDocument'] })

// Use
await findOne(id)
```

### 2. Disable the global filter for the query
```typescript
await findOne(id, {
  populate: ['lastDocument'],
  filters: { notDeleted: false }
})
```

### 3. Downgrade to v6.4.16
The last working version before the bug was introduced.

## Expected Fix

The branching condition should either:
1. Not be added when a relation has a global filter, OR
2. Be adjusted to account for filtered relations:
   ```sql
   -- Current (wrong)
   WHERE entity.id = X AND (entity.relation_id IS NULL OR related.id IS NOT NULL)

   -- Should be
   WHERE entity.id = X
   -- No branching condition, or different logic for filtered relations
   ```

## References

- Introduced: https://github.com/mikro-orm/mikro-orm/commit/2d1b889
- Related: #6760, #6784 (issues this commit was supposed to fix)
- Similar: #6826, #6824 (partial fixes for branching conditions in v6.5.3)
