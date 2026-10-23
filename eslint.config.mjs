import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Size limits that fail CI when a function is due for a refactor (#82).
  // They are errors, not warnings, because ESLint exits 0 on warnings alone.
  // A function that is long or branchy for a good reason gets an
  // `// eslint-disable-next-line <rule> -- <reason>` comment above it, which
  // switches the check off for that one function, like a scoped #pragma.
  {
    rules: {
      // McCabe count: each if, loop, case, catch, ?:, &&, ||, ?? and ?. adds one.
      complexity: ["error", 20],
      "max-depth": ["error", 4],
      "max-lines-per-function": ["error", { max: 150, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    // A test file's top-level describe() callback holds every test in it.
    files: ["**/*.test.ts"],
    rules: { "max-lines-per-function": "off" },
  },
  {
    // A disable comment that no longer silences anything is an error, so the
    // comment has to go when its function is refactored below the limit.
    linterOptions: { reportUnusedDisableDirectives: "error" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
