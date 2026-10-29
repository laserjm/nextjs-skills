import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import architecture from "./eslint/architecture.mjs";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // Layer boundaries + naming conventions. See docs/conventions/.
  ...architecture,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "drizzle/**"]),
]);
