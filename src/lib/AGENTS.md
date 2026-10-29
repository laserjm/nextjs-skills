# src/lib: cross-cutting code

`lib/` never imports from `modules/` and holds nothing feature-specific. ESLint enforces this.

| File | Purpose |
| --- | --- |
| `db/` | Drizzle client and schema (`schema.ts` or `schema/<group>.ts`) |
| `result.ts` | `Result<T, E>`, `ok(value)`, `err(error)` |
| `safe-action.ts` | next-safe-action client with auth middleware |
| `env.ts` | validated env (t3-env/zod), exported as `env` |
| `flags.ts` | feature flags, `flags.newCheckout` |
| `types.ts` | type-only helpers: `Prettify<T>`, `Nullable<T>` |

Before you add a file here, check that it is cross-cutting. If only one module uses it, it belongs in that module.

Schema and database naming: `.claude/rules/infra-and-database.md`.
