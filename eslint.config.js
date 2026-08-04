import eslint from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  globalIgnores(["dist/", "src/physics/wasm/generated/", "vendor/"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/no-confusing-void-expression": "off",
    },
  },
  {
    files: ["**/*.{js,mjs}"],
    extends: [eslint.configs.recommended, tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: {
        console: "readonly",
        fetch: "readonly",
      },
    },
  },
);
