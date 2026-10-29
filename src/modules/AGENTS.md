# src/modules: one folder per bounded context

Full rules: `docs/conventions/architecture.md`. Per-layer rules: `.claude/rules/*.md` (see the table in the root `AGENTS.md`).

## Module shapes

**Anemic (CRUD) module, the default:**

```
modules/settings/
  contracts.ts   queries.ts   actions.ts   index.ts
  infra/settings.repository.ts   # optional thin repo; inline Drizzle in queries/actions is fine
```

**Rich module**, only once it has invariants:

```
modules/orders/
  domain/        order.ts  money.ts  order-id.ts  errors.ts  events.ts
  application/   pay-order.ts  list-open-orders.ts  ports.ts  __fakes__/
  infra/         order.repository.ts  order.mapper.ts  stripe.payment-gateway.ts
  components/    order-card.tsx  order-form.tsx  use-order-form.ts
  actions.ts  queries.ts  contracts.ts  index.ts
```

Go rich when you see any of these:

- state transitions with rules (draft → paid → shipped)
- calculations that must agree everywhere (totals, tax, quotas)
- two or more use cases touching the same entity
- logic that currently lives in a Postgres function or trigger

**Promotion rule:** as soon as an action contains an `if` about business state, or a second action needs the same calculation, extract a use case into `application/` and the rule into `domain/`. Don't build the layers ahead of time. Don't resist them once the signal appears.

## index.ts is the public API

- Other modules and `app/` import only `@/modules/<name>`. Never a deep path.
- It exports actions, queries, contracts (schemas and inferred types), domain types, and components other code may use.
- It never re-exports `infra/`.
- Two modules importing each other is a boundary mistake. Merge them or extract a third module.
- A half-migrated module has a `MIGRATING.md` listing what still bypasses it.

## Naming

- Folder: plural business noun, `kebab-case`: `orders`, `price-lists`, `billing`. Never `utils`, `common`, `shared`, `api`.
- Layer folders and root files have fixed names: `domain/`, `application/`, `infra/`, `components/`, `actions.ts`, `queries.ts`, `contracts.ts`, `index.ts`.
- One primary export per file, matching the file name: `create-order.ts` → `createOrder`.
