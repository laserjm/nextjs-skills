// Architecture + naming rules from docs/conventions/*.md, as lint errors.
// A rule nobody checks is a suggestion: every rule here mirrors a sentence in the docs.
// Requires: eslint-plugin-boundaries@7, eslint-plugin-check-file@3,
//           typescript-eslint@8, eslint-import-resolver-typescript.
import boundaries from "eslint-plugin-boundaries";
import checkFile from "eslint-plugin-check-file";
import tseslint from "typescript-eslint";

// ─── Layers (docs/conventions/architecture.md#layer-rules) ──────────────────

const mod = (type, folder) => ({
  type,
  pattern: `src/modules/*${folder ? `/${folder}` : ""}`,
  partialMatch: false,
  capture: ["module"],
});

// Elements are folders; the first matching descriptor wins, so specific ones go first.
const elements = [
  mod("domain", "domain"),
  mod("application", "application"),
  mod("infra", "infra"),
  mod("components", "components"),
  mod("module-root"), // actions.ts, queries.ts, contracts.ts, index.ts (see files below)
  { type: "app", pattern: "src/app", partialMatch: false },
  { type: "lib", pattern: "src/lib", partialMatch: false },
  { type: "ui-kit", pattern: "src/components/ui", partialMatch: false },
  { type: "test-support", pattern: "test", partialMatch: false },
];

// Single files are classified as file categories, not elements.
const files = [
  { category: "test", pattern: "**/*.test.{ts,tsx}" },
  { category: "actions", pattern: "src/modules/*/actions.ts" },
  { category: "queries", pattern: "src/modules/*/queries.ts" },
  { category: "contracts", pattern: "src/modules/*/contracts.ts" },
  { category: "index", pattern: "src/modules/*/index.ts" },
  { category: "result", pattern: "src/lib/result.ts" },
];

const sameModule = { captured: { module: "{{ from.element.captured.module }}" } };
const otherModule = { captured: { module: "!{{ from.element.captured.module }}" } };

const el = (type, extra = {}) => ({ element: { type, ...extra } });
const rootFile = (category, extra = {}) => ({ element: { type: "module-root", ...extra }, file: { categories: category } });

const domain = (x) => el("domain", x);
const application = (x) => el("application", x);
const infra = (x) => el("infra", x);
const contracts = (x) => rootFile("contracts", x);
const moduleApi = (x) => rootFile("index", x);
const result = { file: { categories: "result" } };
const lib = el("lib");
const uiKit = el("ui-kit");
// The ui layer: actions.ts, queries.ts, components/ (the "controller" in DDD terms).
const uiLayer = (x) => [el("components", x), rootFile(["actions", "queries"], x)];

const policies = [
  {
    // domain: pure TS. Nothing outside its own domain/ except Result.
    from: domain(),
    allow: { to: [domain(sameModule), result] },
  },
  {
    // application: use cases + ports. No I/O.
    from: application(),
    allow: { to: [domain(sameModule), application(sameModule), result, moduleApi(otherModule)] },
  },
  {
    // ...input types come from contracts.ts, type-only.
    from: application(),
    allow: { to: contracts(sameModule), dependency: { kind: "type" } },
  },
  {
    // infra: implements ports, the only layer that talks to the db.
    from: infra(),
    allow: { to: [domain(sameModule), application(sameModule), infra(sameModule), contracts(sameModule), lib] },
  },
  {
    // ui layer may skip application/ and call infra/ directly when there is no use case.
    from: uiLayer(),
    allow: {
      to: [
        ...uiLayer(sameModule),
        application(sameModule),
        domain(sameModule),
        infra(sameModule),
        contracts(sameModule),
        moduleApi(otherModule),
        lib,
        uiKit,
      ],
    },
  },
  {
    from: contracts(),
    allow: { to: [domain(sameModule), lib] },
  },
  {
    // index.ts is the public API: re-exports anything in its module except infra/.
    from: moduleApi(),
    allow: { to: [domain(sameModule), application(sameModule), contracts(sameModule), ...uiLayer(sameModule)] },
  },
  {
    // Routes compose module exports. No deep imports into modules.
    from: el("app"),
    allow: { to: [el("app"), moduleApi(), uiKit, lib] },
  },
  { from: lib, allow: { to: lib } },
  { from: uiKit, allow: { to: [uiKit, lib] } },
  {
    // Tests may reach anywhere inside their own module (fakes, infra for integration tests).
    from: { file: { categories: "test" } },
    allow: { to: [{ element: sameModule }, el("test-support"), lib, moduleApi()] },
  },
  { from: el("test-support"), allow: { to: [moduleApi(), lib] } },
];

// ─── External packages per layer ────────────────────────────────────────────

const restrict = (patterns) => [
  "error",
  { patterns: patterns.map(([group, message]) => ({ group, message, allowTypeImports: true })) },
];

const NO_IO = [
  [["drizzle-orm", "drizzle-orm/*", "@/lib/db", "@/lib/db/*", "postgres", "pg"], "No database access here. Go through a port; infra/ implements it."],
  [["next", "next/*"], "No Next.js APIs (cookies, headers, revalidate*) here. That belongs to the ui layer."],
  [["react", "react-dom"], "No React here."],
];

// ─── Naming (docs/conventions/naming.md) ────────────────────────────────────

const BANNED_TYPE_SUFFIXES =
  "(Model|Entity|Impl|VO|Component|View|Widget|Container|Presenter|Payload|Request|Response|Data|Info)$";

const naming = [
  "error",
  { selector: "default", format: ["camelCase"], leadingUnderscore: "allow" },
  { selector: "import", format: null },
  // PascalCase variables/functions: React components and branded-id constructors (OrderId('ord_1')).
  { selector: "variable", format: ["camelCase", "PascalCase", "UPPER_CASE"] },
  { selector: "function", format: ["camelCase", "PascalCase"] },
  // Booleans read as predicates. Destructured props stay adjectives: { disabled, open }.
  {
    selector: "variable",
    types: ["boolean"],
    format: ["PascalCase"],
    prefix: ["is", "has", "can", "should", "was", "did"],
  },
  { selector: "variable", modifiers: ["destructured"], format: null },
  {
    selector: "typeLike",
    format: ["PascalCase"],
    custom: { regex: BANNED_TYPE_SUFFIXES, match: false },
  },
  { selector: "interface", format: ["PascalCase"], custom: { regex: "^I[A-Z]", match: false } },
  // DB columns, HTTP headers, _tag discriminants: don't police object keys.
  { selector: ["property", "objectLiteralProperty", "objectLiteralMethod", "typeProperty"], format: null },
];

// ─── Syntax bans (flat config replaces a rule per block, so each block spreads these) ─

const NO_ENUM = { selector: "TSEnumDeclaration", message: "Use a string union: type OrderStatus = 'draft' | 'paid'." };
const NO_RPC = {
  selector: "CallExpression[callee.property.name='rpc']",
  message: "Postgres RPC only inside an infra/ repository, and only if it meets the exception criteria in docs/conventions/architecture.md.",
};
const NO_THROW = { selector: "ThrowStatement", message: "Return err({ _tag: ... }) instead of throwing. Throwing is for bugs." };

// ─── Config ─────────────────────────────────────────────────────────────────

export default [
  {
    files: ["src/**/*.{ts,tsx}", "test/**/*.ts"],
    plugins: { boundaries },
    settings: {
      "import/resolver": { typescript: { alwaysTryTypes: true } },
      "boundaries/elements": elements,
      "boundaries/files": files,
      "boundaries/legacy-templates": false,
    },
    rules: {
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          message:
            "Layer violation: {{ from.element.path }} may not import {{ dependency.source }}. See docs/conventions/architecture.md#layer-rules",
          policies,
        },
      ],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}", "test/**/*.ts"],
    languageOptions: { parser: tseslint.parser, parserOptions: { projectService: true } },
    plugins: { "@typescript-eslint": tseslint.plugin, "check-file": checkFile },
    rules: {
      "@typescript-eslint/naming-convention": naming,
      "no-restricted-syntax": ["error", NO_ENUM, NO_RPC],
      "check-file/filename-naming-convention": [
        "error",
        { "src/**/*.{ts,tsx}": "KEBAB_CASE" },
        { ignoreMiddleExtensions: true },
      ],
      "check-file/folder-naming-convention": [
        "error",
        {
          "src/app/**/": "NEXT_JS_APP_ROUTER_CASE",
          // kebab-case, plus test-double folders like __fakes__/
          "src/!(app)/**/": "@(__+([a-z])__|+([a-z0-9])*(-+([a-z0-9])))",
        },
      ],
    },
  },
  {
    files: ["src/modules/*/domain/**"],
    rules: {
      "@typescript-eslint/no-restricted-imports": restrict([
        ...NO_IO,
        [["zod"], "No zod in domain/. Schemas live in contracts.ts."],
      ]),
      "no-restricted-syntax": [
        "error",
        NO_ENUM,
        NO_RPC,
        NO_THROW,
        { selector: "ClassDeclaration", message: "Domain is plain types + pure functions, not classes." },
      ],
    },
  },
  {
    files: ["src/modules/*/application/**"],
    ignores: ["**/*.test.ts", "**/__fakes__/**"],
    rules: {
      "@typescript-eslint/no-restricted-imports": restrict([
        ...NO_IO,
        [["zod"], "Validation happens once at the edge. Import inferred types with `import type`."],
      ]),
      "no-restricted-syntax": ["error", NO_ENUM, NO_RPC, NO_THROW],
    },
  },
  {
    files: ["src/modules/*/infra/**"],
    // The one place an RPC call may live.
    rules: { "no-restricted-syntax": ["error", NO_ENUM] },
  },
  {
    files: ["src/app/**"],
    rules: {
      "@typescript-eslint/no-restricted-imports": restrict([
        [["drizzle-orm", "drizzle-orm/*", "@/lib/db", "@/lib/db/*"], "Routes never touch the db. Call the module's query or action."],
        [["zod"], "No parsing in routes. The module's action or exported function validates."],
      ]),
    },
  },
];
