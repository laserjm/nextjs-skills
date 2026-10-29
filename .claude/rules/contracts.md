---
paths:
  - "src/modules/*/contracts.ts"
  - "src/lib/result.ts"
---

# Contracts (`contracts.ts`)

zod schemas for the module's API: use case inputs and the DTOs that go back to the client. They describe the API, not tables, which is why the file isn't called `schema.ts`.
Source: `docs/conventions/naming.md#contracts--types-contractsts-lib`

A schema is named in `camelCase` with a `Schema` suffix. Its inferred type has the same name in `PascalCase`, without the suffix.

| Kind | Identifier |
| --- | --- |
| Use case input | `payOrderInputSchema` → `type PayOrderInput = z.infer<typeof payOrderInputSchema>` |
| DTO | `orderSummaryDtoSchema` → `OrderSummaryDto` |
| Use case output (when not a DTO) | `listOpenOrdersOutputSchema` |
| Shared field | `emailSchema`, `moneySchema` |
| Branded id schema | `orderIdSchema` (the `OrderId` type and constructor live in `domain/order-id.ts`) |
| Form schema | reuse the input schema; `<noun>FormSchema` only if the form genuinely differs |

- `Input` is for use case arguments, `Dto` for what goes back to the client. Domain types have no suffix. `Payload`, `Request`, `Response`, `Data` and `Info` are never used.
- Tagged unions use the discriminant `_tag`, and its value equals the type name.
- Id prefixes in values (`ord_`, `cus_`) are optional. If you use them, they are 2–4 letters, defined once next to the branded type.
- `contracts.ts` may import types from the module's `domain/`. `application/` imports from contracts only with `import type`.
