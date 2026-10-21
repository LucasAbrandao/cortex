import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "**/.git/**",
      "**/.next/**",
      "**/.venv/**",
      "**/.pytest_cache/**",
      "**/node_modules/**",
      "**/generated/**",
      "playwright-report/**",
      "test-results/**"
    ]
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }]
    }
  }
];
