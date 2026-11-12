import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // Skills de terceiros (Taste, Impeccable etc.) trazem scripts próprios, minificados ou não; não são código do app.
  globalIgnores([".next/**", ".desktop-web/**", "release/**", "out/**", "build/**", "coverage/**", "next-env.d.ts", ".claude/skills/**", ".agents/skills/**"]),
]);
