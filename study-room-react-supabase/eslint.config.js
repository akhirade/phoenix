import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    rules: {
      // This repo intentionally exports hooks alongside Providers (useAuth/useData/etc.).
      "react-refresh/only-export-components": [
        "error",
        {
          allowConstantExport: true,
          allowExportNames: [
            "useAuth",
            "useData",
            "useToast",
            "useTheme",
            "useI18n",
          ],
        },
      ],

      // Useful rule, but too strict as an error for common patterns in this app.
      "react-hooks/set-state-in-effect": "warn",

      // React Compiler linting can be noisy with manual memoization; keep signal as warnings.
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/purity": "warn",

      // Prefer fixing gradually; keep as warnings so CI/dev isn't blocked.
      "@typescript-eslint/no-explicit-any": "warn",
    },
    languageOptions: {
      globals: globals.browser,
    },
  },
]);
