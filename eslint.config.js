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
  // signing with prepareConfirmedSend (routeForSigning), and send them with
  // sendSignableRoute (src/core/signTimeRoute.ts). That path rebuilds a
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
            "Clear a confirmed route with prepareConfirmedSend, then send it with sendSignableRoute.",
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
                "Clear a confirmed route with prepareConfirmedSend, then send it with sendSignableRoute.",
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

  // payment_initiated is reported only by prepareConfirmedSend
  // (src/widget/lib/confirmedSend.ts), once something is about to be sent.
  // Reporting it at confirm counted a confirm that went back to review.
  {
    files: ["src/widget/**/*.{ts,tsx}", "src/modes/**/*.{ts,tsx}"],
    ignores: ["src/widget/lib/confirmedSend.ts", "**/__tests__/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value='payment_initiated']",
          message:
            "Report payment_initiated through prepareConfirmedSend's onSendStarting.",
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
