---
paths:
  - "src/modules/*/domain/**"
---

# Domain layer (`domain/`)

Pure TypeScript in the business' own language. It exists only in modules with invariants.
Source: `docs/conventions/architecture.md` · `docs/conventions/naming.md#domain-layer-domain`

## Imports

- Allowed: the same module's `domain/`, and `@/lib/result`.
- Forbidden: React, `next/*`, Drizzle, zod, `fetch`, other modules, `application/`, `infra/`, `contracts.ts`. ESLint enforces this.

## Shape

- Plain types and pure functions, no classes. Domain values are serializable and cross the server/client boundary unchanged.
- Behaviour takes the entity first. It returns `Result` when it can fail, and `boolean` when it is a predicate.
- Errors are values: a tagged union in `errors.ts`, with `_tag` equal to the type name. Never `throw`.
- No commands, and no `NotFound`/`Forbidden` (those are application errors; the domain doesn't know about lookups or requesters).

```ts
// ✅ domain/order.ts
export type OrderStatus = "draft" | "paid" | "shipped";
export type Order = { id: OrderId; status: OrderStatus; total: Money };

export function applyPayment(order: Order, payment: Payment): Result<Order, OrderAlreadyPaid | AmountMismatch> {
  if (order.status !== "draft") return err({ _tag: "OrderAlreadyPaid" });
  if (!equals(payment.amount, order.total)) return err({ _tag: "AmountMismatch" });
  return ok({ ...order, status: "paid" });
}

export const canShip = (order: Order): boolean => order.status === "paid";
```

```ts
// ❌
class OrderEntity { setPaid() { if (this.paid) throw new Error("already paid"); } }
export function updateStatus(order: Order, status: OrderStatus) { … }
```

## Naming

| Kind | File | Identifier |
| --- | --- | --- |
| Entity / aggregate | `order.ts` | `Order`. No `Model`/`Entity`/`Domain` suffix |
| Value object | `money.ts`, `order-id.ts` | `Money`; branded `type OrderId = string & { __brand: "OrderId" }` + `OrderId(value)` |
| Status union | entity file | `OrderStatus`, lowercase string values |
| Behaviour | entity file | business verb: `applyPayment`, `cancel`, `addLine`. Never `updateStatus`/`setPaid` |
| Factory | entity file | `createOrder(input)`, `orderFromDraft(draft)` |
| Error | `errors.ts` | the fact that blocks the action: `OrderAlreadyPaid`, not `PayOrderFailed`; union `OrderError` |
| Event | `events.ts` | past tense: `OrderPaid`, `OrderShipped` |
| Policy | `<noun>-policy.ts` | predicates: `qualifiesForDiscount(order)` |

Don't create a `value-objects/` subfolder until the module has more than five value objects.
