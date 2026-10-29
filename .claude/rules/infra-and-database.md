---
paths:
  - "src/modules/*/infra/**"
  - "src/lib/db/**"
  - "drizzle/**"
---

# Infra layer and database

Infra names carry the technology; the port they implement carries the business name.
Source: `docs/conventions/architecture.md#database--postgres-rpc-rule` · `docs/conventions/naming.md#infra-layer-infra-and-database`

## Rules

- `infra/` is the only layer that imports the db client. It implements the ports in `application/ports.ts`.
- No business rules and no user-input validation in infra. Its job is persistence and mapping.
- No permission checks in repositories. Scope queries by `tenantId` (RLS is the safety net); the use case decides who may do what.
- A repository **writes** only its own module's tables. It may **read** other modules' tables (joins for read models), since the schema is shared in `lib/db/`. Writes to another module's data go through that module's `index.ts`.
- Mappers (`toDomain(row)`, `toRow(entity)`) are the only code that knows both `OrderRow` and `Order`. Don't `as`-cast a row into a domain type.
- One Drizzle schema in `lib/db/schema.ts` (or `lib/db/schema/<group>.ts`). A module that owns its tables outright may keep `infra/schema.ts` and re-export it from `lib/db/schema.ts`.

## Postgres RPC: default NO

Prefer a Drizzle query, a join or a CTE. RPC (`rpc()`, `SELECT fn()`) is allowed only if **all four** hold:

1. Multiple statements in one transaction, where app↔DB round-trips would break the latency budget or create a race (inventory reservation under contention, counters, queue claim-and-lock).
2. No business rules: no pricing, no status decisions, no notifications. Only the atomic write on already-validated input.
3. Wrapped by exactly one repository method here, with a zod schema for its result.
4. Has a migration file in the repo and an integration test against a real database.

"Easier in SQL", "Supabase makes it convenient", "avoid N+1" and "enforce permissions" are **not** valid reasons. If you think an RPC is justified, stop and ask.

Other database rules:
- Triggers only maintain `updated_at` and audit columns.
- Views are fine for read models; type them with `pgView`.
- RLS enforces tenant isolation, never business rules.

## Naming

| Kind | File | Identifier |
| --- | --- | --- |
| Repository | `<aggregate>.repository.ts` (named after the aggregate, not the table) | `DrizzleOrderRepository` or `makeOrderRepository(db)` |
| External adapter | `<system>.<capability>.ts` | `stripe.payment-gateway.ts` → `StripePaymentGateway` |
| Mapper | `<noun>.mapper.ts` | `toDomain`, `toRow` |
| Table | `lib/db/schema.ts` | `export const ordersTable = pgTable("orders", …)` |
| Enum | same file | `orderStatusEnum = pgEnum("order_status", […])` |
| Row types | next to the table | `OrderRow`, `NewOrderRow` (`InferSelectModel` / `InferInsertModel`) |
| Migration | `drizzle/<n>_<verb>-<what>.sql` | `pnpm db:generate --name add-orders-shipped-at` |
| RPC (exception) | migration | `reserve_inventory_atomic` |

**Postgres:**
- Tables are plural `snake_case` (`order_line_items`). Join tables use both nouns in alphabetical order (`products_tags`).
- Columns are singular `snake_case`. PK `id`, FK `<singular_table>_id`.
- Timestamps: `created_at`, `updated_at`, `deleted_at`. Events are `<verb>ed_at` (`paid_at`).
- Booleans: `is_<adjective>` or `has_<noun>`.
- Money is `<thing>_cents bigint` or `<thing>_amount numeric(12,2)`. Never a bare `float price`.
- Indexes and constraints use the Postgres defaults: `<table>_<cols>_idx`, `_key`, `_fkey`.
- Enum values are lowercase `snake_case`, identical to the TS union strings.
