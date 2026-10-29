# nextjs-skills

Architecture and naming conventions for Next.js (App Router) projects, packaged so that coding agents (Claude Code, Cursor, Codex, Copilot, …) follow them.

Stack assumed: TypeScript · Drizzle + Postgres · zod · next-safe-action · shadcn/ui.

## How it works

The conventions are written once, then delivered to agents in three layers: always-on context, rules loaded by path, and lint as the enforcement.

| Layer | Files | Purpose |
| --- | --- | --- |
| Source of truth | `docs/conventions/architecture.md`, `docs/conventions/naming.md` | The full rules with rationale. Humans read these. |
| Always loaded | `AGENTS.md` (+ `CLAUDE.md` → `@AGENTS.md`) | A short summary: priorities, folder map, hard rules, naming essentials. |
| Loaded by folder | `src/{app,modules,lib,server}/AGENTS.md` | Rules for the area an agent is working in. |
| Loaded by path | `.claude/rules/*.md` | Per-layer rules with examples (domain, application, infra, ui layer, contracts, tests). |
| Procedures | `.claude/skills/{new-module,migrate-module}/` | Step-by-step guides for creating a module and migrating legacy code. |
| Enforcement | `eslint/architecture.mjs`, `.claude/hooks/lint-edited-file.sh` | Layer boundaries and naming as lint errors. The hook lints every file an agent edits and sends the errors back to it. |
| Review | `.github/pull_request_template.md` | The architecture checklist. |

## Using it in a project

1. Copy everything except `README.md` into the project root.
2. Install the lint dependencies:
   ```bash
   pnpm add -D eslint-plugin-boundaries@7 eslint-plugin-check-file@3 typescript-eslint eslint-import-resolver-typescript
   ```
3. Make sure these exist: the `@/*` → `src/*` path alias in `tsconfig.json`, `typedRoutes: true` in `next.config`, and the scripts `AGENTS.md` lists (`lint`, `typecheck`, `test`, `test:integration`, `db:generate`).
4. The hook needs `jq`. It runs `pnpm exec eslint`; change that if you use another package manager.
5. Existing project: allowlist current violations in `eslint/architecture.mjs` instead of disabling rules, then migrate module by module (`migrate-module` skill).

## Changing a convention

1. Edit `docs/conventions/*.md` first. They win over everything else.
2. In the same PR, update the files derived from them: `AGENTS.md`, the nested `AGENTS.md` files, `.claude/rules/`, the skills, the PR template, and `eslint/architecture.mjs` if the rule can be checked.
3. Run the linter against a module that breaks the new rule, and one that follows it, to check that it actually catches the violation.
