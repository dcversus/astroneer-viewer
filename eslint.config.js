import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

const noComments = {
  rules: {
    "no-comments": {
      meta: { type: "problem", messages: { found: "Comments are not allowed; make the code say it." } },
      create(context) {
        return {
          Program() {
            for (const c of context.sourceCode.getAllComments()) {
              if (c.type === "Shebang") continue;
              context.report({ loc: c.loc, messageId: "found" });
            }
          },
        };
      },
    },
  },
};

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", ".playwright-mcp/**"] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { local: noComments },
    rules: {
      "local/no-comments": "error",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true, allowBoolean: true }],
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/no-confusing-void-expression": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["eslint.config.js"],
    ...tseslint.configs.disableTypeChecked,
  },
);
