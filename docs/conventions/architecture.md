# Next.js Architecture Rules

Oct 29, 2026 · @Michael

## Purpose & principles

These rules apply to new Next.js projects and to refactoring existing ones. They optimize for four things, in this order:

1. **Business logic lives in TypeScript**, not in Postgres RPC, not in React components.
2. **End-to-end type safety**: one source of truth for each shape, inferred everywhere else.
3. **Developer experience**: a feature's code sits together; you can find it in one folder.
4. **Just enough layering**: layers exist to control dependency direction and make logic testable, not to satisfy a pattern. Where there are no rules, there is no domain layer.

When two rules conflict, the earlier one wins.

## Folder structure

Vertical modules (one per bounded context) with a light layering inside each. Routes stay thin. `lib/` holds cross-cutting code.

```
src/
  app/                          # routes only — composition, no business logic
    (app)/orders/
      page.tsx
      _components/              # route-local UI (option A, see below)
    api/                        # webhooks and route handlers only
  modules/
    orders/
      domain/                   # pure TS: types, invariants, domain errors
        order.ts
        money.ts
        errors.ts
      application/              # use cases + ports (optional, see Layer rules)
        create-order.ts
        ports.ts
      infra/                    # Drizzle repositories, external APIs
        order.repository.ts
      actions.ts                # server actions ("use server")  ─┐
      queries.ts                # cached reads for RSC            ├ ui layer
      components/               # feature UI (option B, see below) ─┘
      subscribers.ts            # domain events this module handles, wired with deps
      contracts.ts              # zod input/output contracts + DTO types
      index.ts                  # the module's public API
    billing/
    users/
  lib/
    db/                         # drizzle client + schema (see Schema placement)
    result.ts                   # Result<T, E>
    safe-action.ts              # next-safe-action client with auth middleware
    env.ts                      # validated env
    events.ts                   # createEventBus, EventCollector (generic, no module imports)
  server/
    event-subscriptions.ts      # composition root: merges every module's subscribers
  components/ui/                # shadcn/ui primitives
```

**Component placement (flexible, pick per case):**

- **Option A — `app/.../_components/`**: UI used by exactly one route. Page-specific layouts, wrappers, one-off forms.
- **Option B — `modules/<x>/components/`**: UI that belongs to the feature and is reused across routes, or needs the module's types and actions.
- **`components/ui/`**: shadcn/ui primitives and design-system atoms. Never feature-aware.

Rule of thumb: start in `_components/`; move to the module when a second route needs it.

**Schema placement (default centralized, not pinned):**

- Default: one Drizzle schema in `lib/db/schema.ts` (or `lib/db/schema/*.ts` split by table group). Relations across modules are easier to see in one place.
- Allowed: a module that owns tables nobody else touches may keep `modules/<x>/infra/schema.ts` and re-export it into `lib/db/schema.ts`. Drizzle still sees one schema; you just moved the file.
- Zod schemas (`contracts.ts`) always live in the module. They describe the module's API contracts, not tables, which is why the file is not called schema.

## Layer rules

Each layer may import only from the layers below it; the ui layer may skip application/ and call a repository directly when there is no logic to orchestrate (dashed arrow). Modules talk to each other only through `index.ts`.

```mermaid
flowchart TD
  app["app/ (routes)"] --> index["modules/x/index.ts"]
  index --> ui["ui layer: actions.ts · queries.ts · components/"]
  ui --> application["application/ (use cases, ports.ts)"]
  ui -. "no use case to go through" .-> infra
  application --> domain["domain/ (pure TS)"]
  infra["infra/ (Drizzle repos, adapters)"] -- implements --> application
  infra --> domain
  infra --> lib["lib/db"]
```

Arrows show allowed imports. `infra/` is the only layer that imports a database client; it is reached through the port interface, never directly from a use case.

| Layer | Contains | May import | Never contains |
| --- | --- | --- | --- |
| `domain/` | types, branded value objects, invariant functions, tagged errors | nothing outside the module's `domain/` | I/O, Next, React, Drizzle, zod runtime calls |
| `application/` (optional) | use cases, `ports.ts` interfaces | `domain/`, `lib/result` | DB client, `fetch`, `cookies()`, `revalidate*` |
| `infra/` | repository implementations, API clients, mappers | `application/ports`, `domain/`, `lib/db` | business rules, validation of user input |
| ui layer: `actions.ts`, `queries.ts`, `subscribers.ts`, `components/` ¹ | server actions, cached queries, event subscribers, feature components | `application/`, `contracts.ts`, `lib/safe-action`; `infra/` repos directly only when there is no use case to go through | business rules beyond calling a use case or a repo |
| `app/` | pages, layouts, route handlers | `modules/*/index`, `components/ui` | direct DB calls, zod parsing, business rules |
| `lib/` | cross-cutting: db client, Result, env, safe-action, event bus | nothing from `modules/` | anything feature-specific |
| `server/` | composition root (event subscriptions) | `modules/*/index`, `lib/` | logic of its own |

**Hard rules:**

- **Skipping the application layer.** An action or query may call a repository directly when it needs no orchestration: a plain read, a single write with validation only, no business decision. The moment it needs a transaction, a domain function, a second repository or an `if` about business state, extract a use case. The test: if you'd want to unit-test it without Next, it's a use case.
- A use case receives its dependencies (repos, clock, id generator) as arguments or via a tiny factory next to `actions.ts`. No global singletons inside `application/`.
- Errors cross layer boundaries as values (`Result`), never as thrown exceptions. Throwing is reserved for bugs.
- Enforce the direction with `eslint-plugin-boundaries` (or `dependency-cruiser`) in CI from day one. A rule nobody checks is a suggestion.
- If two modules import each other, merge them or extract a third. Cyclic modules are a boundary mistake.

**Authorization.** Authentication (who is this?) happens once, in the `safe-action` middleware and in `queries.ts`, producing a `Requester` (`{ userId, tenantId, roles }`). Authorization (may they do this?) is a business decision and lives in the use case: `Requester` is passed in `Deps`, and the use case returns `err({ _tag: 'Forbidden' })`. Rules:

- RLS enforces tenant isolation only. It is a safety net, never the place a permission rule is written.
- Components never decide permissions; they receive `can.editOrder` booleans computed server-side.
- An action that skips the application layer (anemic module) checks `requester` in the action itself — the only business `if` allowed there.

¹ `actions.ts`, `queries.ts` and `components/` sit at the module root to save a folder level, but they are the **ui layer** in the layered/clean-architecture sense. In particular `page.tsx`, `actions.ts` and `queries.ts` play the role of the *controller* (or *interface adapter*) in most DDD books and docs: they translate HTTP/React into use-case calls and back. Keep that mapping in mind when reading outside material.

## Type safety chain

Every shape has exactly one source of truth; everything else is inferred. If you write the same type twice by hand, one of them is wrong already.

| Shape | Source of truth | Inferred by |
| --- | --- | --- |
| Table rows | Drizzle schema | `InferSelectModel` / `InferInsertModel` in `infra/` |
| Request/response DTOs | zod in `modules/<x>/contracts.ts` | `z.infer` in use cases, actions, forms |
| Domain types | `domain/*.ts` (plain types + branded primitives) | mappers in `infra/` convert rows to these |
| Use case outcome | `Result<T, DomainError>` from `lib/result.ts` | returned by the action as `data`; the client maps `error._tag` |
| Server action contract | `next-safe-action` wrapping the zod input | `useAction` / `useOptimisticAction` on the client |
| Env vars | `lib/env.ts` (t3-env or zod) | `env.X`, fails at build if missing |
| Routes | `typedRoutes: true` in `next.config` | `<Link href>` and `redirect()` |

**Rules:**

- Never `as` cast across a layer boundary. If the types don't line up, add a mapper in `infra/` or fix the schema.
- Use cases return `Result`, never throw. Expected errors are return values all the way to the client: the action returns the `Result` as `data`, zod failures arrive as `validationErrors`, and only unexpected throws become a generic `serverError`. This follows the Next.js guidance: model expected errors as return values, throw only for the unexpected.
- Validate at the edge once (server action input, webhook payload, env). Inside the module, trust the types.
- Domain errors are a tagged union (`{ _tag: 'OrderAlreadyPaid' }`). Each `_tag` is mapped to user-facing copy in exactly one place, the client, with a `satisfies Record<PayOrderError['_tag'], string>` map; the compiler catches a missing case. Server code switches on `_tag` only where control flow differs (a page calling `notFound()`).
- Forms use the same zod schema via `react-hook-form` + `zodResolver`. Client and server disagree on nothing.
- Branded primitives for ids and money (`type OrderId = string & { __brand: 'OrderId' }`). It costs one line and stops `userId` landing in `orderId`.

**Error → HTTP/UI mapping:**

| Error | Where it comes from | Action result | Page / RSC |
| --- | --- | --- | --- |
| zod validation | safe-action input | `validationErrors`, field-level | — |
| `NotFound` | application | `data: { ok: false, error: { _tag: 'NotFound' } }` | `notFound()` → 404 |
| `Forbidden` | application / requester check | `data: { ok: false, error: { _tag: 'Forbidden' } }` | `forbidden()` or redirect to sign-in ² |
| Domain error (tagged) | domain via `Result` | `data: { ok: false, error }`, shown as form-level message | render inline |
| Unexpected throw | anything | generic `serverError`, logged with trace id | `error.tsx` → 500 |

Rule: expected errors are values, not exceptions. The client maps `_tag` to user-facing copy with one exhaustive map per error union; the raw tag never appears in the UI. `serverError` only ever means "unexpected".

² `forbidden()` and `unauthorized()` require `experimental.authInterrupts: true` in `next.config`. Without it, redirect to sign-in (no session) or render an inline "no access" state (signed in, not allowed).

## Caching & revalidation

- `queries.ts` is the only place `unstable_cache` / `"use cache"` / `cacheTag` appear. Tags are constants exported from that file: ``ORDER_TAGS = { all: 'orders', one: (id) => `order:${id}` }``.
- Cached functions never read the request (`cookies()`, `headers()`, the session). The exported query authenticates first, then calls a private cached function with everything that varies the result, `tenantId` included, as arguments. Those arguments are the cache key; anything read inside the cached scope would be shared across users and tenants.
- Granularity: one `all` tag per aggregate for lists, one `one(id)` tag for detail views. Nothing finer until a measured need.
- Revalidation is the action's job, after the use case returns `ok`: `updateTag(ORDER_TAGS.one(id)); updateTag(ORDER_TAGS.all)`. `updateTag` gives read-your-own-writes and works only inside server actions; route handlers (webhooks) use `revalidateTag(tag, 'max')`. Use cases and repositories never import `revalidate*` / `updateTag`.
- A cross-module write that affects another module's reads calls that module's exported `revalidate<Noun>(id)` helper from its `index.ts`, never its tag strings. The helper lives in `queries.ts` next to the tags.
- `revalidatePath` only for routes without a natural aggregate (marketing pages).

## Cross-module communication

Two allowed mechanisms, picked by coupling:

- **Direct call** through `index.ts` when module A needs B's *answer* now (billing asks catalog for a price). Synchronous, typed, inside the same transaction if needed.
- **Domain event** when A only needs to *inform* B (order paid → billing issues invoice). The use case returns events in its `ok` payload or collects them via an `EventCollector` port; the action dispatches them after commit through `dispatchEvents` from `server/event-subscriptions.ts`. Handlers live in the receiving module: the logic in `modules/billing/application/on-order-paid.ts`, wired with its deps in `modules/billing/subscribers.ts`, which `index.ts` exports.

Rules:

- **Wiring:** `server/event-subscriptions.ts` is the composition root. It merges every module's subscribers into one bus built with `createEventBus` from `lib/events.ts`; `lib/` itself never imports modules. A module that starts handling an event registers its subscribers there.
- **Delivery:** in-process, after commit. A failing handler is logged and does not roll back the emitter. If delivery must be guaranteed, introduce a transactional outbox; not before.
- **Tables:** writes always go through the owning module's `index.ts`. Reading another module's tables directly is allowed for read models (a join in `queries.ts` or a repository), because the schema is shared in `lib/db/`.
- Never: importing another module's `infra/` or `domain/` internals, or writing to its tables. Never a trigger as an event bus.
- If A and B call each other, merge or extract a third module (see the hard rules under [Layer rules](#layer-rules)).
- Start with direct calls; introduce events when a module gets its second subscriber or when the call would cross a transaction boundary.

## Database & Postgres RPC rule

**Business logic lives in TypeScript. Postgres RPC (functions called via `rpc()` or `SELECT fn()`) is allowed only for timing-critical transactions.** Everything else is a query the repository runs through Drizzle.

Why: RPC is invisible to the type system, untestable without a database, bypasses `Result` error handling, and splits one feature across two languages and two deploy pipelines. Every project we have that drifted into RPC is now hard to refactor for exactly these reasons.

**RPC is allowed when all of these hold:**

1. The operation needs multiple statements in one transaction **and** the round-trips between app and DB would make it fail its latency budget or create a race (e.g. inventory reservation under contention, counter increments, queue claim-and-lock).
2. The function contains **no business rules** beyond the atomic write: no pricing, no status decisions, no notifications. It takes already-validated inputs and performs the transactional write.
3. It is wrapped by exactly one repository method in `infra/`, with a zod schema for its result, so the rest of the code never sees the RPC.
4. It has a migration file in the repo and a test that runs it against a real database.

**Not a valid reason for RPC:** "it's easier in SQL", "Supabase makes it convenient", "to avoid the N+1" (use a join or a CTE in Drizzle), "to enforce permissions" (use RLS policies for row access; keep authorization decisions in the use case).

**Other DB rules:**

- Transactions are opened in the use case through a `UnitOfWork` port or a `withTransaction(tx => …)` helper exposed by `infra/`. Drizzle's `db.transaction()` is the implementation.
- Triggers are limited to `updated_at` and audit columns. No trigger may change another table's business data.
- Views are fine for read models; they are typed via Drizzle's `pgView`.
- RLS enforces tenant isolation, not business rules.

## When to go rich vs anemic

A module gets a `domain/` layer only when it has invariants. Otherwise it is a CRUD module and the full layering is overhead.

| Signal | Rich (full layering) | Anemic (CRUD module) |
| --- | --- | --- |
| State transitions with rules (draft → paid → shipped) | yes | — |
| Calculations that must agree everywhere (totals, tax, quotas) | yes | — |
| Two or more use cases touch the same entity | yes | — |
| Logic currently in a Postgres function or trigger | yes, move it here | — |
| Plain create/read/update/delete with validation only | — | yes |
| Settings, profiles, lookup tables | — | yes |

**Anemic module shape:** `contracts.ts` + `queries.ts` + `actions.ts` + `index.ts`. Actions and queries call Drizzle directly through a thin `infra/` repo or even inline. No `domain/`; the `application/` folder does not exist until promotion.

**Promotion rule:** the moment an action contains an `if` about business state (a `requester` permission check doesn't count, see Authorization under [Layer rules](#layer-rules)), or a second action needs the same calculation, extract a use case and a `domain/` file. Don't pre-build the layers; don't resist them either once the signal appears.

**What "rich" means here:** plain types and pure functions, not classes with methods. `applyPayment(order, payment): Result<Order, OrderError>` is a rich domain. It is serializable, testable with no setup, and works across the server/client boundary.

## Refactoring playbook for existing projects

Refactor one module at a time, strangler-style. Never a big-bang restructure; the old and new structure coexist until the last module moves.

1. **Add the guardrails first.** Install `eslint-plugin-boundaries` with the target rules but every existing violation whitelisted. New code must comply; old code shows up in the lint report. Add `lib/result.ts` and `lib/safe-action.ts`.
2. **Inventory the RPC.** List every Postgres function and trigger: name, who calls it, what business rule it contains, whether it meets the RPC exception. Put the list in a table in this doc or the repo. Most will fail criterion 2 (contains business rules).
3. **Pick the module with the most pain**, usually the one with the most RPC or the most duplicated logic. Create `modules/<x>/` with just `index.ts` and `contracts.ts`.
4. **Move reads first.** Create `queries.ts` with Drizzle queries replacing the RPC reads. Reads are safe to swap and give you typed row shapes to build on.
5. **Port one RPC write at a time into a use case.** Copy the SQL function's logic into `application/<use-case>.ts` as TypeScript; the transactional write becomes a repository method. Keep the SQL function in place and run both, comparing results, until the TS version has been live for a release. Then drop the function in a migration.
6. **Extract invariants into `domain/`** as the use cases reveal them. If a rule lived in a trigger, it moves here, not into the repository.
7. **Rewire the routes.** Pages and actions under `app/` import only from `modules/<x>/index`. Delete the old `lib/` or `services/` helpers the module replaced.
8. **Remove the whitelist entry** for that module. The lint rule now protects it.
9. **Repeat** with the next module. Each pass is one PR series, mergeable independently.

**Rules during the transition:**

- No new RPC may be added unless it passes the exception criteria, even in untouched modules.
- No new code imports from an old helper that a module already replaced.
- A module that is half-migrated is marked with a `MIGRATING.md` listing what still bypasses it, so nobody assumes it is the single source of truth yet.
- If a migration step reveals two modules were really one, merge them before continuing.

## Checklist

Copy into a PR template or `ARCHITECTURE.md`.

- [ ] Business logic is in TypeScript, not in Postgres RPC or triggers
- [ ] Any RPC passes all four exception criteria and is wrapped by one repository method
- [ ] Each feature lives in `modules/<x>/` with a public `index.ts`; routes import only from it
- [ ] `domain/` exists only where invariants exist; CRUD modules stay flat
- [ ] `domain/` imports nothing outside the module; `application/` imports no I/O
- [ ] Use cases return `Result`, never throw; actions return expected errors as values; the client maps `_tag` exhaustively
- [ ] One source of truth per shape: Drizzle for rows, zod for DTOs, inferred everywhere else
- [ ] Server actions go through `next-safe-action` with the module's zod schema
- [ ] No `as` casts across layer boundaries
- [ ] Route-only UI in `_components/`; shared feature UI in `modules/<x>/components/`; primitives in `components/ui/`
- [ ] Drizzle schema centralized in `lib/db/` unless a module owns its tables outright
- [ ] Dependency direction enforced by ESLint in CI
- [ ] Transactions opened in the use case via a port, implemented in `infra/`
- [ ] Authorization decided in the use case (or the anemic action) via `Requester`; RLS only isolates tenants
- [ ] Cache APIs only in `queries.ts`, revalidation only in actions, always through the tag constants
- [ ] Cross-module calls and writes only via `index.ts` or domain events; cross-module table reads only for read models
