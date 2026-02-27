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

  // Don't bundle peer libs or optional heavy deps (WalletConnect lazy-loaded):
  external: [
    "react",
    "react-dom",
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
]);
