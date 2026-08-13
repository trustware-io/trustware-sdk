// tsup.config.ts
import { defineConfig, type Options } from "tsup";
import pkg from "./package.json";

const baseConfig: Options = {
  format: ["esm", "cjs"],
  dts: {
    // Make the DTS builder use your tsconfig (picks up jsx + allowSyntheticDefaultImports)
    tsconfig: "./tsconfig.json",
  },
  target: "es2020",
  sourcemap: true,
  clean: true,
  splitting: false,

  // Don't bundle peer libs or optional heavy deps (WalletConnect lazy-loaded).
  //
  // viem is a required, non-optional peer dependency, so every consumer already
  // has it. Bundling it shipped a second copy — ~383 KB, 15% of the entry — and
  // put a second viem instance in the app, which is its own class of bug for
  // anything holding chain/client state. The smart-account entry already
  // externalised it; the rest of the build now agrees.
  external: [
    "react",
    "react-dom",
    "viem",
    "wagmi",
    "@rainbow-me/rainbowkit",
    "@walletconnect/ethereum-provider",
    "qrcode",
    "radix-ui",
  ],

  // Ensure ESM files end with .mjs to match your package.json "module"/exports
  outExtension({ format }) {
    return {
      js: format === "esm" ? ".mjs" : ".cjs",
    };
  },

  // Make esbuild use the automatic React runtime too (mirrors tsconfig "react-jsx")
  esbuildOptions(options) {
    options.jsx = "automatic";
  },

  // Inject package.json version and API root at build time
  define: {
    __SDK_VERSION__: JSON.stringify(pkg.version),
    __API_ROOT__: JSON.stringify(
      process.env.TRUSTWARE_API_ROOT || "https://api.trustware.io"
    ),
    __GTM_ID__: JSON.stringify(process.env.TRUSTWARE_GTM_ID || ""),
    __WALLETCONNECT_PROJECT_ID__: JSON.stringify(
      process.env.TRUSTWARE_WALLETCONNECT_PROJECT_ID ||
        "896c4c8fa652baf14b9614e4026aff6a"
    ),
  },
};

export default defineConfig([
  {
    ...baseConfig,
    entry: [
      "src/index.ts",
      "src/core.ts",
      "src/wallet.ts",
      "src/widget.tsx",
      "src/constants.ts",
    ],
  },
  {
    ...baseConfig,
    // Account Kit is bundled in (devDep, not installed by consumers) so the bundle
    // is self-contained and Next.js never traces into the SDK's node_modules for it.
    // viem is external via baseConfig, as everywhere else.
    entry: ["src/smart-account.ts"],
  },
]);
