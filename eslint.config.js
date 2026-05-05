import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import globals from "globals";

/** @type {import("eslint").Linter.FlatConfig[]} */
export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.replit-artifact/**",
      "**/generated/**",
      "pnpm-lock.yaml",
    ],
  },

  // Base JS rules
  js.configs.recommended,

  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
  },

  // TypeScript files
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,

      "no-undef": "off",

      // No console.log in server code
      "no-console": ["warn", { allow: ["warn", "error"] }],

      // Disallow common hardcoded secret patterns
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/sk-[a-zA-Z0-9]{20,}/]",
          message: "Hardcoded API key detected. Use environment variables instead.",
        },
        {
          selector: "Literal[value=/pk_(live|test)_[a-zA-Z0-9]{20,}/]",
          message: "Hardcoded Stripe key detected. Use environment variables instead.",
        },
        {
          selector: "Literal[value=/whsec_[a-zA-Z0-9]{20,}/]",
          message: "Hardcoded Stripe webhook secret detected. Use environment variables instead.",
        },
        {
          selector: "Literal[value=/-----BEGIN (RSA |EC )?PRIVATE KEY-----/]",
          message: "Hardcoded private key detected. Use environment variables instead.",
        },
      ],

      // TypeScript-specific relaxations for Phase 0
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/explicit-module-boundary-types": "off",
    },
  },

  // Frontend React files — allow JSX globals, relax node-specific rules
  {
    files: ["artifacts/rankmap/src/**/*.tsx", "artifacts/rankmap/src/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      // Console allowed in frontend (browser context)
      "no-console": "off",
    },
  },

  // Config / script files — allow console
  {
    files: ["*.config.ts", "*.config.js", "*.config.mjs", "scripts/**/*.ts", "vite.config.ts"],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];
