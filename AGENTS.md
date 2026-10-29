# AGENTS.md

Next.js (App Router) · TypeScript · Drizzle + Postgres · zod · next-safe-action · shadcn/ui.

This file is the always-loaded summary. The full rules, with rationale, live in:

- `docs/conventions/architecture.md`: layers, dependency direction, type safety, DB/RPC policy, refactoring playbook
- `docs/conventions/naming.md`: naming per layer, quick reference following one `Order` through every layer

If this file and those docs disagree, the docs win. Fix this file in the same PR.

## Priorities

When two rules conflict, the earlier one wins.

1. Business logic lives in TypeScript: not in Postgres RPC or triggers, not in React components.
2. One source of truth per shape (Drizzle for rows, zod for DTOs); everything else is inferred.
3. A feature's code sits together in `src/modules/<name>/`.
4. Just enough layering: no `domain/` without invariants, no `application/` without orchestration.

## Map

```
src/
  app/                 routes only: compose module exports, no logic          → src/app/AGENTS.md
  modules/<name>/      one per bounded context, plural business noun          → src/modules/AGENTS.md
    domain/            pure TS: types, invariants, tagged errors (rich modules only)
    application/       use cases + ports.ts (only once there is orchestration)
    infra/             Drizzle repositories, external adapters, mappers
    actions.ts         server actions      ┐
    queries.ts         cached RSC reads    ├ ui layer
    components/        feature UI          ┘
    contracts.ts       zod schemas + inferred Input/Dto types
    index.ts           the module's ONLY public API
  lib/                 db, result, safe-action, env. Never imports modules     → src/lib/AGENTS.md
  components/ui/       shadcn primitives, never feature-aware
```

## Hard rules

- Imports point down: `app → module index → ui layer → application → domain`; `infra` implements `application` ports. Other modules are imported only via `@/modules/<name>`. ESLint enforces this. Fix the import, never disable the rule.
- Use cases return `Result<T, E>` from `@/lib/result` and never throw. Throwing is for bugs.
- Validate once at the edge (action input, webhook payload, env) with the module's zod schema. Inside the module, trust the types.
- Server actions go through `@/lib/safe-action` and `switch` exhaustively on `error._tag`.
- No `as` casts across layers. If types don't line up, write a mapper in `infra/`.
- No new Postgres RPC, trigger logic or SQL functions. The narrow exception (all 4 criteria) is in `docs/conventions/architecture.md#database--postgres-rpc-rule`. Ask before adding one.
- New modules start flat (`contracts.ts`, `queries.ts`, `actions.ts`, `index.ts`). Extract `application/` + `domain/` the moment an action contains an `if` about business state or two actions share a calculation. Use the `new-module` skill.

## Naming essentials

- Files and folders `kebab-case` · types and components `PascalCase` · functions, variables, hooks `camelCase` · constants `SCREAMING_SNAKE_CASE` · DB `snake_case`.
- Use the business' words: `Invoice`, not `Bill`. Modules are business nouns (`billing`), never `utils`/`common`/`api`. No abbreviations beyond `id`, `url`, `db`, `dto`, `ui`.
- No `I` prefix. No `Impl`, `Model`, `Entity`, `Component`, `View` suffixes. Adapters carry the technology: `DrizzleOrderRepository implements OrderRepository`.
- Booleans: `isPaid`, `hasItems`, `canShip`. Boolean *props* drop the prefix: `disabled`, `open`.
- One use case, one name, through every layer: `pay-order.ts` → `payOrder(input, deps)`, `PayOrderInput`, `PayOrderDeps`, `payOrderInputSchema`, `payOrderAction`.
- Query verbs: `get` (one, `NotFound` if missing), `find` (one or null), `list`, `search`, `count`, `exists`. Repositories persist with `save`.
- Shapes that cross the wire end in `Dto`. Never `Payload`, `Request`, `Response`, `Data`, `Info`.
- Tagged unions use `_tag`, and its value equals the type name.

## Read before editing

Claude Code loads these automatically by path. Other agents: open the matching file before you edit.

| When you touch | Read |
| --- | --- |
| `src/modules/*/domain/**` | `.claude/rules/domain.md` |
| `src/modules/*/application/**` | `.claude/rules/application.md` |
| `src/modules/*/infra/**`, `src/lib/db/**`, `drizzle/**` | `.claude/rules/infra-and-database.md` |
| `src/modules/*/{actions,queries}.ts`, `components/**`, `_components/**` | `.claude/rules/ui-layer.md` |
| `src/modules/*/contracts.ts` | `.claude/rules/contracts.md` |
| `**/*.test.ts`, `e2e/**`, `test/**`, `**/__fakes__/**` | `.claude/rules/tests.md` |

## Commands

```bash
pnpm lint            # includes architecture boundaries + naming (eslint/architecture.mjs)
pnpm typecheck
pnpm test            # unit tests, no DB
pnpm test:integration
pnpm db:generate --name <verb>-<what>   # e.g. add-orders-shipped-at
```

## Definition of done

- `pnpm lint && pnpm typecheck && pnpm test` pass.
- New use cases and domain functions have unit tests that use fakes, not a database.
- The checklist in `.github/pull_request_template.md` holds.
- If a convention didn't fit the task, say so in your summary or the PR. Don't invent a new pattern.
