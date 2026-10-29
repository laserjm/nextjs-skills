---
paths:
  - "src/modules/*/actions.ts"
  - "src/modules/*/queries.ts"
  - "src/modules/*/components/**"
  - "src/app/**/_components/**"
---

# UI layer (`actions.ts`, `queries.ts`, `components/`)

These play the *controller* role: they translate HTTP/React into use-case calls and back. They hold no business rules beyond calling a use case or a repository.
Source: `docs/conventions/architecture.md#layer-rules` · `docs/conventions/naming.md#ui-layer-actionsts-queriests-components-app`

## Actions and queries

- Every server action goes through `@/lib/safe-action` with the module's zod input schema.
- Call a use case. Call a repository directly only for a plain read or a single validated write with no business decision. Once you need a transaction, a domain function, a second repository or an `if` about business state, extract a use case.
- Turn `Result` into the next-safe-action shape with an exhaustive `switch` on `error._tag`, so a missing case fails to compile.
- Queries wrap reads for RSC with caching. Define cache tags once as `ORDER_TAGS` in `queries.ts` and use the same constant to revalidate.

```ts
// actions.ts
export const payOrderAction = actionClient
  .inputSchema(payOrderInputSchema)
  .action(async ({ parsedInput }) => {
    const result = await payOrder(parsedInput, makePayOrderDeps());
    if (result.ok) { revalidateTag(ORDER_TAGS.one(parsedInput.orderId)); return result.value; }
    // ActionError → typed `serverError` on the client (handleServerError in lib/safe-action).
    switch (result.error._tag) {
      case "NotFound":         throw new ActionError("Order not found");
      case "OrderAlreadyPaid": throw new ActionError("Order is already paid");
      case "AmountMismatch":   throw new ActionError("Amount does not match");
      default: return assertNever(result.error);
    }
  });
```

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
