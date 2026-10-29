---
paths:
  - "src/modules/*/application/**"
---

# Application layer (`application/`)

One use case per file, named as the command or query it performs.
This layer exists only once there is orchestration: a transaction, a domain function, a second repository, or an `if` about business state. The test: if you'd want to unit-test it without Next, it's a use case.
Source: `docs/conventions/architecture.md#layer-rules` · `docs/conventions/naming.md#application-layer-application`

## Imports

- Allowed: the same module's `domain/` and `application/`, `@/lib/result`, other modules via `@/modules/<name>`, and **type-only** imports from `../contracts` and `@/lib/*` (e.g. `Requester`).
- Forbidden: DB client, Drizzle, `fetch`, `next/*` (`cookies()`, `headers()`, `revalidate*`), zod at runtime, `infra/`. ESLint enforces this.

## Shape

```ts
// application/pay-order.ts
import type { PayOrderInput } from "../contracts";

export type PayOrderDeps = { requester: Requester; orders: OrderRepository; events: EventCollector; uow: UnitOfWork };

export async function payOrder(input: PayOrderInput, deps: PayOrderDeps): Promise<Result<Order, PayOrderError>> {
  return deps.uow.run(async (tx) => {
    const order = await deps.orders.findById(input.orderId, tx);
    if (!order) return err({ _tag: "NotFound" });
    if (!canPayOrder(deps.requester, order)) return err({ _tag: "Forbidden" });
    const paid = applyPayment(order, input.payment);
    if (!paid.ok) return paid;
    await deps.orders.save(paid.value, tx);
    deps.events.add({ _tag: "OrderPaid", orderId: order.id });
    return paid;
  });
}
```

- Dependencies come in as **one** `<UseCase>Deps` object, never as positional arguments and never as module-level singletons. The factory that wires the real deps sits next to `actions.ts`.
- Return `Result`. Never `throw`, except for bugs.
- Open transactions through the `UnitOfWork` port (`uow.run(fn)`). `infra/` implements it with `db.transaction()`.
- No caching or revalidation here. `"use cache"`, `cacheTag`, `revalidate*` and `updateTag` belong to the ui layer.

## Authorization

- Authorization is a business decision and is made here. `Requester` (`{ userId, tenantId, roles }`, from `@/lib/auth/requester`) comes in `Deps`. Return `err({ _tag: "Forbidden" })` when the requester may not act.
- Put the rule in a policy function, `can<Verb><Noun>(requester, entity)` in `<noun>-permissions.ts`. `queries.ts` reuses the same function to compute the UI's `can.*` flags, so the button and the use case never disagree.
- RLS only isolates tenants. Never rely on it for a permission rule.

## Talking to other modules

- **Need an answer now** (billing asks catalog for a price): call the other module through `@/modules/<name>`. This can run inside the same transaction.
- **Only informing** (order paid → billing issues an invoice): emit a domain event through the `EventCollector` port (`deps.events.add(...)`) or return events in the `ok` payload. The action dispatches them after commit.
- The handler lives in the **receiving** module: `billing/application/on-order-paid.ts` → `onOrderPaid(event, deps)`. It is a use case like any other: `Deps`, `Result`, tests with fakes. Wiring happens in `billing/subscribers.ts` (see `ui-layer.md`).
- Start with direct calls. Switch to events when there is a second subscriber, or when the call would cross a transaction boundary.
- Writes to another module's data go through its `index.ts`. Never import another module's `domain/` or `infra/`. Never use a trigger as an event bus.

## Naming

| Kind | File | Identifier |
| --- | --- | --- |
| Command | `<verb>-<noun>.ts` | `createOrder`, `shipOrder`, `approveRefund` |
| Query | `get-<noun>.ts`, `find-<noun>-by-<x>.ts`, `list-<nouns>.ts` | `getOrder`, `findOrderByNumber`, `listOpenOrders` |
| Input | `contracts.ts` (z.infer) | `PayOrderInput` |
| Output | use case file, only when it is not a domain type | `ListOpenOrdersOutput` |
| Deps | use case file | `PayOrderDeps` |
| Repository port | `ports.ts` | `OrderRepository` with `findById`, `findByCustomer`, `listByStatus`, `save`, `delete`, `nextId` |
| Other ports | `ports.ts` | `Clock`, `IdGenerator`, `UnitOfWork`, `EventCollector`, `<Noun>Gateway` for external systems (`PaymentGateway`), `Mailer` |
| Application errors | `errors.ts` | `NotFound`, `Forbidden` |
| Permission policy | `<noun>-permissions.ts` | `canEditOrder(requester, order)` |
| Event handler | `on-<event>.ts` (receiving module) | `onOrderPaid(event, deps)` |

- Command verbs: `create`, `update`, `delete`, `cancel`, `approve`, `submit`, `assign`, `archive`. Prefer the business verb (`shipOrder`, not `updateOrderStatusToShipped`).
- Query verbs: `get` (one, `NotFound` if missing), `find` (one or null), `list` (many), `search` (free text), `count`, `exists`.
- Repositories have no `create`/`update` split. The use case decides; `save` persists.
