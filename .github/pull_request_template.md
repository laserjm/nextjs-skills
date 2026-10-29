## What & why

<!-- One paragraph. Link the issue. -->

## Architecture checklist

<!-- Source: docs/conventions/architecture.md#checklist. Lint covers the items marked (lint). -->

- [ ] Business logic is in TypeScript, not in Postgres RPC or triggers
- [ ] Any RPC passes all four exception criteria and is wrapped by one repository method
- [ ] Each feature lives in `modules/<x>/` with a public `index.ts`; routes import only from it (lint)
- [ ] `domain/` exists only where invariants exist; CRUD modules stay flat
- [ ] `domain/` imports nothing outside the module; `application/` imports no I/O (lint)
- [ ] Use cases return `Result`, never throw; actions return expected errors as values; the client maps `_tag` exhaustively
- [ ] One source of truth per shape: Drizzle for rows, zod for DTOs, inferred everywhere else
- [ ] Server actions go through `next-safe-action` with the module's zod schema
- [ ] No `as` casts across layer boundaries
- [ ] Route-only UI in `_components/`; shared feature UI in `modules/<x>/components/`; primitives in `components/ui/`
- [ ] Drizzle schema centralized in `lib/db/` unless a module owns its tables outright
- [ ] Transactions opened in the use case via a port, implemented in `infra/`
- [ ] Authorization decided in the use case (or the anemic action) via `Requester`; RLS only isolates tenants
- [ ] Cache APIs only in `queries.ts`, revalidation only in actions, always through the tag constants (lint)
- [ ] Cross-module calls and writes only via `index.ts` or domain events; cross-module table reads only for read models (lint covers imports)
- [ ] Names follow docs/conventions/naming.md (lint covers casing, file names, banned suffixes)
