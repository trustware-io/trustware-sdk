import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import prettierConfig from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "ui-ideas/**",
      ".venv/**",
      "scripts/**",
      "*.cjs",
      "*.mjs",
      "*.config.ts",
      "*.config.js",
    ],
  },

  js.configs.recommended,

  ...tseslint.configs.recommended,

  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },

  {
    files: ["**/*.tsx", "**/*.jsx"],
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs["jsx-runtime"].rules,
      ...reactHooksPlugin.configs.recommended.rules,
    },
  },

  // Widget flows build routes with buildRouteForReview, clear them for
  // signing with routeForSigning, and send them with sendSignableRoute
  // (src/core/signTimeRoute.ts). That path rebuilds a
  // Solana route right before signing, since the reviewed transaction's
  // blockhash may have expired. Calling the raw functions skips it.
  {
    files: ["src/widget/**/*.{ts,tsx}", "src/modes/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-properties": [
        "error",
        {
          object: "Trustware",
          property: "sendRouteTransaction",
          message:
            "Clear a confirmed route with routeForSigning, then send it with sendSignableRoute.",
        },
        {
          object: "Trustware",
          property: "buildRoute",
          message: "Build a route for review with buildRouteForReview.",
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/core/tx", "src/core/tx"],
              importNames: ["sendRouteTransaction"],
              message:
                "Clear a confirmed route with routeForSigning, then send it with sendSignableRoute.",
            },
            {
              group: ["**/core/routes", "src/core/routes"],
              importNames: ["buildRoute"],
              message: "Build a route for review with buildRouteForReview.",
            },
          ],
        },
      ],
    },
  },

  // BVT-477: the SDK loads no Google Tag Manager container and reports
  // nothing to Google Analytics. See "No Google Analytics" in CLAUDE.md.
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "Literal[value=/googletagmanager|google-analytics/i], TemplateElement[value.raw=/googletagmanager|google-analytics/i]",
          message:
            "The SDK does not load or call Google Analytics or Tag Manager (BVT-477).",
        },
        {
          selector: "MemberExpression[property.name=/^(dataLayer|gtag)$/]",
          message:
            "The SDK does not push to a GTM dataLayer or call gtag (BVT-477).",
        },
      ],
    },
  },

  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    ...tseslint.configs.disableTypeChecked,
  },

  prettierConfig
);
