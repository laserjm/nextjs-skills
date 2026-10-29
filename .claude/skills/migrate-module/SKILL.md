---
name: migrate-module
description: Refactor legacy code (Postgres RPC, triggers, lib/ or services/ helpers) into a module that follows the architecture rules, strangler-style, one module per PR series. Use when moving existing features into src/modules/ or replacing an RPC with TypeScript.
---

# Migrate a module (strangler-style)

Full playbook: `docs/conventions/architecture.md#refactoring-playbook-for-existing-projects`. Never do a big-bang restructure. Old and new structure coexist until the last module moves.

## Before touching code

1. Check that the lint guardrails exist (`eslint/architecture.mjs`) and that existing violations are allowlisted, not disabled.
2. Find or update the RPC inventory (`docs/rpc-inventory.md`): every Postgres function and trigger, who calls it, what business rule it contains, and whether it meets the 4 RPC exception criteria. Most fail criterion 2.
3. Agree on the scope with the user: which module, and which RPCs/helpers move in this PR.

## Steps

1. Create `src/modules/<name>/` with just `index.ts` and `contracts.ts`. Add `MIGRATING.md` listing everything that still bypasses the module.
2. **Reads first.** Replace RPC reads with Drizzle queries in `queries.ts`. This gives you typed row shapes.
3. **One RPC write at a time.** Port the SQL function's logic to `application/<verb>-<noun>.ts`. The transactional write becomes a repository method. Keep the SQL function and run both in parallel, comparing results, until the TS version has been live for a release. Only then drop the function in a migration.
4. Rules that lived in a trigger move into `domain/`, not into the repository.
5. Rewire callers: `app/` imports only `@/modules/<name>`. Delete the old helpers this module replaced.
6. Remove the module's lint allowlist entry. Update `MIGRATING.md`, and delete it once nothing bypasses the module.

## Transition rules

- No new RPC unless it passes all four exception criteria, even in untouched modules.
- No new code imports an old helper that a module has already replaced.
- If the migration shows two modules are really one, merge them before continuing.
- Each step is one PR that can be merged on its own.
