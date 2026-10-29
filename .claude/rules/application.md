---
paths:
  - "src/modules/*/application/**"
---

# Application layer (`application/`)

One use case per file, named as the command or query it performs.
This layer exists only once there is orchestration: a transaction, a domain function, a second repository, or an `if` about business state. The test: if you'd want to unit-test it without Next, it's a use case.
Source: `docs/conventions/architecture.md#layer-rules` · `docs/conventions/naming.md#application-layer-application`

## Imports

- Allowed: the same module's `domain/` and `application/`, `@/lib/result`, other modules via `@/modules/<name>`, and **type-only** imports from `../contracts`.
- Forbidden: DB client, Drizzle, `fetch`, `next/*` (`cookies()`, `headers()`, `revalidate*`), zod at runtime, `infra/`. ESLint enforces this.

## Shape

```ts
// application/pay-order.ts
import type { PayOrderInput } from "../contracts";

export type PayOrderDeps = { orders: OrderRepository; payments: PaymentGateway; uow: UnitOfWork };

export async function payOrder(input: PayOrderInput, deps: PayOrderDeps): Promise<Result<Order, PayOrderError>> {
  return deps.uow.run(async (tx) => {
    const order = await deps.orders.findById(input.orderId, tx);
    if (!order) return err({ _tag: "NotFound" });
    const paid = applyPayment(order, input.payment);
    if (!paid.ok) return paid;
    await deps.orders.save(paid.value, tx);
    return paid;
  });
}
```

- Dependencies come in as **one** `<UseCase>Deps` object, never as positional arguments and never as module-level singletons. The factory that wires the real deps sits next to `actions.ts`.
- Return `Result`. Never `throw`, except for bugs.
- Open transactions through the `UnitOfWork` port (`uow.run(fn)`). `infra/` implements it with `db.transaction()`.

## Naming

| Kind | File | Identifier |
| --- | --- | --- |
| Command | `<verb>-<noun>.ts` | `createOrder`, `shipOrder`, `approveRefund` |
| Query | `get-<noun>.ts`, `find-<noun>-by-<x>.ts`, `list-<nouns>.ts` | `getOrder`, `findOrderByNumber`, `listOpenOrders` |
| Input | `contracts.ts` (z.infer) | `PayOrderInput` |
| Output | use case file, only when it is not a domain type | `ListOpenOrdersOutput` |
| Deps | use case file | `PayOrderDeps` |
| Repository port | `ports.ts` | `OrderRepository` with `findById`, `findByCustomer`, `listByStatus`, `save`, `delete`, `nextId` |
| Other ports | `ports.ts` | `Clock`, `IdGenerator`, `UnitOfWork`, `<Noun>Gateway` for external systems (`PaymentGateway`), `Mailer` |
| Application errors | `errors.ts` | `NotFound`, `Forbidden` |

- Command verbs: `create`, `update`, `delete`, `cancel`, `approve`, `submit`, `assign`, `archive`. Prefer the business verb (`shipOrder`, not `updateOrderStatusToShipped`).
- Query verbs: `get` (one, `NotFound` if missing), `find` (one or null), `list` (many), `search` (free text), `count`, `exists`.
- Repositories have no `create`/`update` split. The use case decides; `save` persists.
