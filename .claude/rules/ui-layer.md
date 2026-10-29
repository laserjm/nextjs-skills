---
paths:
  - "src/modules/*/actions.ts"
  - "src/modules/*/queries.ts"
  - "src/modules/*/subscribers.ts"
  - "src/modules/*/components/**"
  - "src/app/**/_components/**"
---

# UI layer (`actions.ts`, `queries.ts`, `subscribers.ts`, `components/`)

These play the *controller* role: they translate HTTP/React into use-case calls and back. They hold no business rules beyond calling a use case or a repository.
Source: `docs/conventions/architecture.md` (Layer rules, Authorization, Caching & revalidation, Error → HTTP/UI mapping) · `docs/conventions/naming.md#ui-layer-actionsts-queriests-components-app`

## Actions

- Every server action goes through `@/lib/safe-action`. Its middleware authenticates and puts the `Requester` on `ctx`. The action passes it into the use case's `Deps`.
- Call a use case. Call a repository directly only for a plain read or a single validated write with no business decision. Once you need a transaction, a domain function, a second repository or an `if` about business state, extract a use case.
- In an anemic module (no use case), the action checks `requester` itself. That is the only business `if` allowed in an action.
- After the use case returns `ok`: dispatch the collected domain events with `dispatchEvents` from `@/server/event-subscriptions`, then `updateTag` the affected tags. If the write changes another module's reads, call that module's `revalidate<Noun>(id)` from its `index.ts`, never its tag strings.
- Return the use case's `Result` as is. Expected errors (`NotFound`, `Forbidden`, domain errors) are values, not exceptions: don't throw them and don't turn them into copy here. Anything thrown is unexpected; `handleServerError` in `lib/safe-action` logs it with a trace id and returns a generic `serverError`.

```ts
// actions.ts
"use server";
export const payOrderAction = authActionClient
  .inputSchema(payOrderInputSchema)
  .action(async ({ parsedInput, ctx: { requester } }) => {
    const events = createEventCollector();
    const result = await payOrder(parsedInput, makePayOrderDeps(requester, events));
    if (result.ok) {
      await dispatchEvents(events.drain()); // after commit: uow.run has returned
      updateTag(ORDER_TAGS.one(parsedInput.orderId));
      updateTag(ORDER_TAGS.all);
      revalidateInvoices(); // from "@/modules/billing"
    }
    return result; // expected errors travel as data: { ok: false, error: { _tag } }
  });
```

## Subscribers

`subscribers.ts` wires the events this module handles to its `on-<event>` use cases with real deps. `index.ts` exports it, and `src/server/event-subscriptions.ts` registers it.

```ts
// modules/billing/subscribers.ts — never "use server": exports of a "use server" file become public endpoints
import "server-only";
export const billingSubscribers = {
  OrderPaid: (event: OrderPaid) => onOrderPaid(event, makeOnOrderPaidDeps()),
} satisfies Subscribers;
```

## Queries and caching

- `queries.ts` is the **only** file where `"use cache"`, `cacheTag`, `cacheLife` or `unstable_cache` appear (ESLint enforces this). Tags are constants in the same file: one `all` tag per aggregate for lists and one `one(id)` tag per detail view. Don't add finer tags without a measured need.
- **Never read the request inside a cached function.** The exported query authenticates first (`getRequester()`), then calls a private cached function. Pass everything that varies the result as arguments, `tenantId` included: those arguments are the cache key. Anything read inside the cached scope would be shared across users and tenants.
- Permission flags for the UI are computed here, with the same policy function the use case uses, and returned as `can.<verb><Noun>` booleans.
- `revalidate<Noun>(id)` lives here and is exported via `index.ts`. Use `updateTag` (works only in server actions); route handlers and webhooks use `revalidateTag(tag, "max")`. Single-argument `revalidateTag(tag)` is deprecated in Next 16.
- `revalidatePath` is only for routes without a natural aggregate (marketing pages).

```ts
// queries.ts
import "server-only";

export const ORDER_TAGS = { all: "orders", one: (id: OrderId) => `order:${id}` } as const;

async function findOrderCached(tenantId: TenantId, id: OrderId) {
  "use cache";
  cacheTag(ORDER_TAGS.one(id));
  return makeOrderRepository().findById(tenantId, id);
}

export async function getOrder(id: OrderId) {
  const requester = await getRequester(); // outside the cache
  const order = await findOrderCached(requester.tenantId, id);
  if (!order) notFound();
  return { order, can: { editOrder: canEditOrder(requester, order) } };
}

export function revalidateOrder(id: OrderId) {
  updateTag(ORDER_TAGS.one(id));
  updateTag(ORDER_TAGS.all);
}
```

## Components

- Components never decide permissions. They receive `can.editOrder`-style booleans from the server.
- Each action's expected errors are shown through one exhaustive `_tag` → copy map, kept with the component that shows them. The raw tag never appears in the UI. `serverError` always means "unexpected" and gets generic copy.

```tsx
const PAY_ORDER_ERROR_COPY = {
  NotFound: "This order no longer exists.",
  Forbidden: "You don't have access to this order.",
  OrderAlreadyPaid: "This order has already been paid.",
  AmountMismatch: "The amount doesn't match the order total.",
} satisfies Record<PayOrderError["_tag"], string>;

const { execute, result } = useAction(payOrderAction);
const errorMessage =
  result.data && !result.data.ok ? PAY_ORDER_ERROR_COPY[result.data.error._tag]
  : result.serverError ? "Something went wrong. Please try again."
  : null;
```

Validation errors (`validationErrors`) are field-level and go to the form fields, not into this map.

## Naming

| Kind | Identifier | Example |
| --- | --- | --- |
| Server action | `<useCase>Action`, the only `Action` suffix in the codebase | `payOrderAction` |
| Cached query | same name as the use case, no suffix | `getOrder(id)`, `listOpenOrders()` |
| Cache tag | `<noun>` or `<noun>:<id>` | `"orders"`, `` `order:${id}` `` |
| Component | `<noun>-<role>.tsx` → `<Noun><Role>` | `order-card.tsx` → `OrderCard` |
| Client component | same, file starts with `"use client"`, **no** `Client` suffix | `OrderForm` |
| Props | `<Component>Props` | `OrderFormProps` |
| Hook | `use-<thing>.ts` in `components/` (move to `hooks/` once there are more than 3) | `useOrderForm` |
| Form schema | reuse the use case input schema; `<noun>FormSchema` only if the form differs | `payOrderInputSchema` |

- Role vocabulary (pick from this list before you invent one): `List`, `Table`, `Card`, `Row`, `Form`, `Dialog`, `Sheet`, `Panel`, `Badge`, `Summary`, `Picker`, `Select`, `Filters`, `Toolbar`, `Empty`.
- No `Component`/`View`/`Widget` suffix and no `Container`/`Presenter` split; the server/client split replaces them.
- Event props are `on<Event>`; handlers inside a component are `handle<Event>`.
- Boolean props are adjectives (`disabled`, `open`, `loading`); state keeps `is` (`const [isOpen, setIsOpen]`).
- Forms use `react-hook-form` + `zodResolver` with the same schema as the action.
