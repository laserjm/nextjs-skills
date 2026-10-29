# Naming Conventions per Layer

Oct 29, 2026 · @Michael

Companion to *Next.js Architecture Rules*. One name pattern per kind of thing, so a file name tells you its layer and its role before you open it.

## General rules

These apply everywhere; the layer sections only add suffixes and verbs on top.

| What | Convention | Example |
| --- | --- | --- |
| Files and folders | `kebab-case` | `create-order.ts`, `order-line-item.tsx` |
| Types, interfaces, classes, React components | `PascalCase` | `Order`, `OrderRepository`, `OrderCard` |
| Functions, variables, hooks | `camelCase` | `applyPayment`, `useOrderForm` |
| Constants (true constants, module-level) | `SCREAMING_SNAKE_CASE` | `MAX_LINE_ITEMS` |
| Enum-like unions | `PascalCase` type, lowercase string values | `type OrderStatus = 'draft' \| 'paid' \| 'shipped'` |
| DB tables and columns | `snake_case` | `order_line_items`, `created_at` |
| Env vars | `SCREAMING_SNAKE_CASE`, public ones prefixed `NEXT_PUBLIC_` | `DATABASE_URL`, `NEXT_PUBLIC_APP_URL` |

**Rules:**

- One exported thing per file where the file name matches it: `create-order.ts` exports `createOrder`. Barrel files (`index.ts`) are the exception.
- Singular for a thing, plural for a collection: `order.ts` holds `Order`; `orders` table; `OrderRepository` (singular, it is one repository).
- No `I` prefix on interfaces, no `Impl` suffix on implementations. The infra adapter carries the technology: `DrizzleOrderRepository implements OrderRepository`.
- No abbreviations except universal ones (`id`, `url`, `db`, `dto`, `ui`). `usr`, `ord`, `cfg` are not names.
- Booleans read as predicates: `isPaid`, `hasItems`, `canShip`. Never `paid` for a boolean.
- Names say what, not how. `findByCustomer` not `selectOrdersWhereCustomerIdEquals`.
- Prefer the ubiquitous language of the business over technical synonyms: if the business says *invoice*, the code says `Invoice`, not `Bill`.

## Folders & modules

| Thing | Convention | Example |
| --- | --- | --- |
| Module folder | plural noun of the aggregate, `kebab-case` | `modules/orders/`, `modules/price-lists/` |
| Layer folders | fixed names, never renamed per project | `domain/`, `application/`, `infra/` |
| ui-layer files at module root | fixed names | `actions.ts`, `queries.ts`, `components/`, `contracts.ts`, `index.ts` |
| Route segment folders | `kebab-case`, plural for collections, `[param]` for dynamic | `app/orders/`, `app/orders/[orderId]/` |
| Route groups | `(kebab-case)` describing the layout or audience | `(app)/`, `(marketing)/`, `(auth)/` |
| Private route folders | `_kebab-case` | `_components/`, `_lib/` |
| Cross-cutting | `lib/<concern>/` | `lib/db/`, `lib/auth/` |
| Design-system primitives | `components/ui/` (shadcn default) | `components/ui/button.tsx` |

**Rules:**

- A module name is a business noun, never a technical one: `orders`, `billing`, `catalog` — not `api`, `utils`, `common`.
- Dynamic route params are `camelCase` and end in `Id` when they are ids: `[orderId]`, not `[id]` or `[order_id]`. The param name becomes the prop name, so it has to be a valid identifier.
- A module's public API is only `index.ts`. It exports use cases (as functions), the zod schemas, the domain types, and the components other modules may use. It never re-exports `infra/`.

## Domain layer (`domain/`)

Names here are the ubiquitous language. No technical suffixes except for errors and events.

| Kind | File | Identifier | Example |
| --- | --- | --- | --- |
| Entity / aggregate root | `<noun>.ts` | `PascalCase` type, no suffix | `order.ts` → `type Order` |
| Value object | `<noun>.ts` | `PascalCase` type + branded primitive or small object | `money.ts` → `type Money`, `order-id.ts` → `type OrderId` |
| Invariant / behaviour | in the entity's file | `camelCase` verb phrase, takes the entity first, returns `Result` | `applyPayment(order, payment)`, `canShip(order)` |
| Factory | in the entity's file | `create<Noun>` or `<noun>From<Source>` | `createOrder(input)`, `orderFromDraft(draft)` |
| Domain error | `errors.ts` | tagged union, `PascalCase` past-tense fact or state | `OrderAlreadyPaid`, `InsufficientStock` |
| Domain event | `events.ts` | `PascalCase` noun + past-tense verb | `OrderPaid`, `OrderShipped` |
| Status / state union | in the entity's file | `<Noun>Status`, lowercase string values | `type OrderStatus = 'draft' \| 'paid'` |
| Policy / specification | `<noun>-policy.ts` | `<Noun>Policy`, predicate functions | `discount-policy.ts` → `qualifiesForDiscount(order)` |

**Rules:**

- No `Model`, `Entity`, `Domain` or `VO` suffix. `Order` is enough; the folder says it is domain.
- Behaviour functions are verbs in the business' words: `applyPayment`, `cancel`, `addLine`. Not `updateStatus`, not `setPaid`.
- Errors are named for the fact that blocks the action (`OrderAlreadyPaid`), not for the attempt (`PayOrderFailed`). The `_tag` string equals the type name.
- Events are always past tense; commands are never defined in `domain/`.
- A value object's file name is its noun: `money.ts`, `email-address.ts`. No `value-objects/` subfolder until a module has more than five.

## Application layer (`application/`)

One use case per file, named as the command or query it performs.

| Kind | File | Identifier | Example |
| --- | --- | --- | --- |
| Use case (command) | `<verb>-<noun>.ts` | `camelCase` verb + noun, returns `Promise<Result<…>>` | `create-order.ts` → `createOrder(input, deps)` |
| Use case (query) | `get-<noun>.ts` / `list-<nouns>.ts` / `find-<noun>-by-<x>.ts` | same | `list-open-orders.ts` → `listOpenOrders(filter, deps)` |
| Input type | in the use case file | `<UseCase>Input` | `type CreateOrderInput` |
| Output type | in the use case file | `<UseCase>Output` (omit when it returns a domain type) | `type ListOpenOrdersOutput` |
| Dependencies type | in the use case file | `<UseCase>Deps` | `type CreateOrderDeps = { orders: OrderRepository; clock: Clock }` |
| Port (repository) | `ports.ts` | `<Noun>Repository`, methods as verbs | `OrderRepository.findById`, `.save`, `.nextId` |
| Port (other I/O) | `ports.ts` | `<Capability>` noun or `<Noun>Gateway` for external systems | `Clock`, `IdGenerator`, `PaymentGateway`, `Mailer` |
| Unit of work | `ports.ts` | `UnitOfWork` with `run(fn)` | `uow.run(async tx => …)` |
| Application error | `errors.ts` (optional) | tagged union, `PascalCase` | `NotFound`, `Forbidden` |

**Rules:**

- Verb vocabulary for commands: `create`, `update`, `delete`, `cancel`, `approve`, `submit`, `assign`, `archive`. Use the business verb if there is one (`shipOrder`, not `updateOrderStatusToShipped`).
- Verb vocabulary for queries: `get` (one, by id, errors when missing), `find` (one, may be null), `list` (many), `search` (many, free text), `count`, `exists`.
- Repository methods use the same vocabulary: `findById`, `findByCustomer`, `listByStatus`, `save` (insert or update), `delete`. No `create`/`update` split on repositories; the use case decides, `save` persists.
- Dependencies are passed as one object typed `<UseCase>Deps`, never as positional arguments. A test then reads `createOrder(input, { orders: fakeOrders, clock: fixedClock })`.
- `NotFound` and `Forbidden` are application errors, not domain errors: the domain does not know about requesters or lookups.

## Infra layer (`infra/`) and database

Infra names carry the technology; the port they implement carries the business name.

| Kind | File | Identifier | Example |
| --- | --- | --- | --- |
| Repository implementation | `<noun>.repository.ts` | `<Tech><Noun>Repository` or factory `make<Noun>Repository(db)` | `DrizzleOrderRepository`, `makeOrderRepository(db)` |
| External system adapter | `<system>.<capability>.ts` | `<System><Capability>` | `stripe.payment-gateway.ts` → `StripePaymentGateway` |
| Mapper | `<noun>.mapper.ts` | `toDomain(row)`, `toRow(entity)` | `order.mapper.ts` |
| Drizzle table | `lib/db/schema.ts` (or `schema/<group>.ts`) | `camelCase` plural + Table const, `snake_case` plural SQL name | `export const ordersTable = pgTable('orders', …)` |
| Drizzle enum | same file | `<noun>StatusEnum` const, `<noun>_status` SQL name | `orderStatusEnum = pgEnum('order_status', [...])` |
| Row types | next to the table | `<Noun>Row`, `New<Noun>Row` | `type OrderRow = InferSelectModel<typeof ordersTable>` |
| Migration | `drizzle/<timestamp>_<verb>-<what>.sql` (generated) | — | `0007_add-orders-shipped-at.sql` |
| RPC function (exception only) | `drizzle/` migration | `<verb>_<noun>_<qualifier>` | `reserve_inventory_atomic` |

**Database naming (Postgres):**

- Tables: `snake_case`, plural: `orders`, `order_line_items`. Join tables: both nouns, alphabetical: `products_tags`.
- Columns: `snake_case`, singular. Primary key `id`. Foreign keys `<singular_table>_id`: `customer_id`, `order_id`.
- Timestamps: `created_at`, `updated_at`, `deleted_at`; event timestamps as `<verb>ed_at`: `paid_at`, `shipped_at`.
- Booleans: `is_<adjective>` or `has_<noun>`: `is_active`, `has_discount`.
- Money: `<thing>_cents` as `bigint` or `numeric(12,2)` with `_amount`; never a bare `price` of type `float`.
- Indexes: `<table>_<columns>_idx`; unique: `<table>_<columns>_key`; FK constraints: `<table>_<column>_fkey` (Postgres defaults, keep them).
- Enum types: `<noun>_status`, `<noun>_kind`. Values lowercase `snake_case`, same strings as the TS union.

**Rules:**

- A repository file is named after the aggregate, not the table: `order.repository.ts` even if it touches three tables.
- Mappers are the only place that knows both `OrderRow` and `Order`. Nothing else imports both.
- An adapter's file name starts with the external system so adapters sort together: `stripe.*`, `sendgrid.*`, `s3.*`.

## UI layer (`actions.ts`, `queries.ts`, `components/`, `app/`)

Actions and queries are named like the use case they call, with a suffix that says which side of the wire they are.

| Kind | File | Identifier | Example |
| --- | --- | --- | --- |
| Server action | `actions.ts` | `<useCase>Action` | `createOrderAction`, `shipOrderAction` |
| Cached query (RSC) | `queries.ts` | `<verb><Noun>` matching the use case, no suffix | `getOrder(id)`, `listOpenOrders()` |
| Cache tag | in `queries.ts` | `<noun>` or `<noun>:<id>` | `'orders'`, `` `order:${id}` `` |
| Server component | `components/<noun>-<role>.tsx` | `<Noun><Role>` | `order-table.tsx` → `OrderTable` |
| Client component | same, file starts with `'use client'` | same; no `Client` suffix | `order-form.tsx` → `OrderForm` |
| Component props | in the component file | `<Component>Props` | `type OrderFormProps` |
| Hook | `components/use-<thing>.ts` (or `hooks/` once > 3) | `use<Thing>` | `useOrderForm`, `useOrderFilters` |
| Form schema | `contracts.ts` | reuse the use case input schema; `<noun>FormSchema` only if the form differs | `createOrderInputSchema` |
| Route files | Next conventions, unchanged | — | `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `route.ts` |
| Route-local component | `app/.../_components/<noun>-<role>.tsx` | same as above | `_components/order-filters.tsx` |
| Page component | `page.tsx` | `<Noun>Page` | `export default function OrdersPage()` |

**Component role vocabulary** (the second word): `List`, `Table`, `Card`, `Row`, `Form`, `Dialog`, `Sheet`, `Panel`, `Badge`, `Summary`, `Picker`, `Select`, `Filters`, `Toolbar`, `Empty`. Pick from this list before inventing one.

**Rules:**

- `<useCase>Action` is the only `Action` suffix in the codebase. Nothing else is called an action.
- A query function in `queries.ts` has the same name as the use case it wraps; the file location tells you it is the cached, RSC-facing version.
- No `Component`, `View` or `Widget` suffix. No `Container`/`Presenter` split; server/client is the split now.
- Event handler props: `on<Event>` (`onSubmit`, `onSelect`); handlers inside a component: `handle<Event>`.
- Boolean props: adjectives without `is`: `disabled`, `open`, `loading`. State variables keep `is`: `const [isOpen, setIsOpen]`.
- Cache tags are revalidated with the same string constant used to set them. Define them once in `queries.ts` as `ORDER_TAGS`.

## Contracts & types (`contracts.ts`, `lib/`)

A zod schema is `camelCase` + `Schema`; the type inferred from it is the same name in `PascalCase` without the suffix.

| Kind | Identifier | Example |
| --- | --- | --- |
| Use case input schema | `<useCase>InputSchema` | `createOrderInputSchema` |
| Inferred input type | `<UseCase>Input` | `type CreateOrderInput = z.infer<typeof createOrderInputSchema>` |
| Output / DTO schema | `<noun>DtoSchema` or `<useCase>OutputSchema` | `orderSummaryDtoSchema` |
| Inferred DTO type | `<Noun>Dto` | `type OrderSummaryDto` |
| Shared field schema | `<field>Schema` | `emailSchema`, `moneySchema` |
| Branded id | `<Noun>Id` type, `<Noun>Id(value)` constructor, `<noun>IdSchema` | `type OrderId`, `OrderId('ord_…')`, `orderIdSchema` |
| Result | `Result<T, E>`, `ok(value)`, `err(error)` | `return err({ _tag: 'OrderAlreadyPaid' })` |
| Error union helper | `<Noun>Error` | `type OrderError = OrderAlreadyPaid \| InsufficientStock` |
| Env | `env` object from `lib/env.ts` | `env.DATABASE_URL` |

**Rules:**

- `Dto` is the only suffix for shapes that cross the wire. `Payload`, `Request`, `Response`, `Data`, `Info` are not used.
- `Input` is for use case arguments, `Dto` for what comes back to the client. Domain types have no suffix at all.
- Id prefixes in the value (`ord_`, `cus_`) are optional, but if used they are two to four letters and defined once next to the branded type.
- A tagged union's discriminant is always `_tag`, and its value equals the TypeScript type name.

## Tests & misc

| Kind | File | Identifier | Example |
| --- | --- | --- | --- |
| Unit test | next to the file, `<name>.test.ts` | `describe('<function>')`, `it('<behaviour>')` | `create-order.test.ts` |
| Integration test (real DB) | `<name>.integration.test.ts` | same | `order.repository.integration.test.ts` |
| E2E test | `e2e/<flow>.spec.ts` | `test('<user goal>')` | `e2e/checkout.spec.ts` |
| Fake port | `<noun>.fake.ts` in `application/__fakes__/` or next to the test | `Fake<Noun>Repository`, `InMemory<Noun>Repository` | `InMemoryOrderRepository` |
| Factory / builder | `test/factories/<noun>.ts` | `a<Noun>(overrides)` or `build<Noun>` | `anOrder({ status: 'paid' })` |
| Fixture data | `test/fixtures/<noun>.json` | — | `fixtures/orders.json` |
| Feature flag | `lib/flags.ts` | `camelCase`, verb-less | `flags.newCheckout` |
| Env var | `.env`, `lib/env.ts` | `SCREAMING_SNAKE_CASE` | `STRIPE_SECRET_KEY` |
| Constants | top of the file that uses them, or `<noun>.constants.ts` | `SCREAMING_SNAKE_CASE` | `MAX_LINE_ITEMS = 50` |
| Type-only helpers | `lib/types.ts` | `PascalCase`, generic names | `Prettify<T>`, `Nullable<T>` |

**Rules:**

- Test names describe behaviour, not implementation: `it('rejects payment on an already paid order')`, not `it('returns err')`.
- `Fake` for hand-written test doubles with behaviour, `Stub` for canned answers, `Mock` only when assertions are made on calls. Don't call everything a mock.
- Factory functions read like English in a test: `anOrder()`, `aPaidOrder()`, `aCustomer({ country: 'DE' })`.

## Quick reference

One line per kind, following a single `Order` through every layer.

| Layer | Kind | File | Identifier |
| --- | --- | --- | --- |
| domain | aggregate | `domain/order.ts` | `Order` |
| domain | value object | `domain/money.ts` | `Money` |
| domain | behaviour | `domain/order.ts` | `applyPayment(order, payment)` |
| domain | error | `domain/errors.ts` | `OrderAlreadyPaid` |
| domain | event | `domain/events.ts` | `OrderPaid` |
| application | use case | `application/pay-order.ts` | `payOrder(input, deps)` |
| application | input / deps | `application/pay-order.ts` | `PayOrderInput`, `PayOrderDeps` |
| application | port | `application/ports.ts` | `OrderRepository`, `PaymentGateway` |
| infra | repository | `infra/order.repository.ts` | `DrizzleOrderRepository` |
| infra | adapter | `infra/stripe.payment-gateway.ts` | `StripePaymentGateway` |
| infra | mapper | `infra/order.mapper.ts` | `toDomain`, `toRow` |
| infra | table | `lib/db/schema.ts` | `ordersTable` → `'orders'` |
| infra | row type | `lib/db/schema.ts` | `OrderRow` |
| ui | action | `actions.ts` | `payOrderAction` |
| ui | query | `queries.ts` | `getOrder(id)` |
| ui | component | `components/order-card.tsx` | `OrderCard`, `OrderCardProps` |
| ui | hook | `components/use-order-form.ts` | `useOrderForm` |
| ui | page | `app/(app)/orders/[orderId]/page.tsx` | `OrderPage` |
| contracts | input schema | `contracts.ts` | `payOrderInputSchema` |
| contracts | dto | `contracts.ts` | `orderSummaryDtoSchema` → `OrderSummaryDto` |
| contracts | branded id | `domain/order-id.ts` | `OrderId` |
| test | unit | `application/pay-order.test.ts` | `it('rejects an already paid order')` |
| test | fake | `application/__fakes__/order.repository.fake.ts` | `InMemoryOrderRepository` |
| test | factory | `test/factories/order.ts` | `anOrder()` |
