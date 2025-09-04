import { FlatCompat } from "@eslint/eslintrc";
import prettierPlugin from "eslint-plugin-prettier";
import { defineConfig } from "eslint/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default defineConfig([
  {
    plugins: {
      prettier: prettierPlugin,
    },
    extends: compat.extends("next/core-web-vitals", "next/typescript", "prettier"),

    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/ban-ts-comment": "off",

      // Strict maintainability thresholds
      // Reason: Keep files small and cognitive load manageable for contributors and reviewers
      "max-lines": [
        "error",
        { max: 500, skipBlankLines: true, skipComments: true }
      ],
      "complexity": ["error", { max: 15 }],

      // Managed by formatter script; disable to avoid plugin issues in ESLint 9 flat config
      "prettier/prettier": "off",
    },
  },
]);
