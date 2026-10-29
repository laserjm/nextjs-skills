---
name: new-module
description: Scaffold a new feature module in src/modules/, or promote an existing CRUD module to a rich one with domain/ and application/. Use when adding a new bounded context or feature area, or when an action has started to contain business rules.
---

# New module / promote module

Rules: `docs/conventions/architecture.md#when-to-go-rich-vs-anemic`, `docs/conventions/naming.md#folders--modules`.

## 1. Name it

A plural business noun in `kebab-case`: `orders`, `price-lists`, `billing`. Never `utils`, `common`, `shared`, `api`.
Check `src/modules/` first. If an existing module covers the same entity, extend it instead.

## 2. Start flat (anemic)

Create only these four files:

```ts
// contracts.ts
import { z } from "zod";
export const createPriceListInputSchema = z.object({ name: z.string().min(1) });
export type CreatePriceListInput = z.infer<typeof createPriceListInputSchema>;
```

```ts
// queries.ts: cached reads for RSC, named like the use case they serve
export const PRICE_LIST_TAGS = { all: "price-lists", one: (id: string) => `price-list:${id}` } as const;
export async function listPriceLists() { … }
```

```ts
// actions.ts
"use server";
export const createPriceListAction = actionClient.inputSchema(createPriceListInputSchema).action(async ({ parsedInput }) => { … });
```

```ts
// index.ts: the only public API. Never re-export infra/.
export { createPriceListAction } from "./actions";
export { listPriceLists } from "./queries";
export { createPriceListInputSchema, type CreatePriceListInput } from "./contracts";
```

Add the Drizzle table to `src/lib/db/schema.ts` (`priceListsTable = pgTable("price_lists", …)`), then run `pnpm db:generate --name add-price-lists`.

## 3. Promote when the signal appears

Promote when an action contains an `if` about business state, a second action needs the same calculation, or a status transition has rules:

1. Move the rule into `domain/<entity>.ts` as a pure function that returns `Result` (see `.claude/rules/domain.md`).
2. Create `application/<verb>-<noun>.ts` with `<UseCase>Deps` and a port in `application/ports.ts` (see `.claude/rules/application.md`).
3. Move the Drizzle code into `infra/<entity>.repository.ts` implementing the port, plus a mapper if row ≠ domain type.
4. Make the action call the use case with a deps factory next to `actions.ts` and return its `Result`. Add the client's exhaustive `_tag` → copy map for the new errors.
5. Add unit tests for the domain function and the use case, using an `InMemory<Noun>Repository` in `application/__fakes__/`.

## 4. Verify

`pnpm lint && pnpm typecheck && pnpm test`. Boundary errors mean an import goes the wrong way. Fix the import; don't add an exception.
