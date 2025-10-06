// tsup.config.ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/core.ts",
    "src/wallet.ts",
    "src/widget.tsx",
    "src/constants.ts",
  ],
  format: ["esm", "cjs"],
  dts: {
    // Make the DTS builder use your tsconfig (picks up jsx + allowSyntheticDefaultImports)
    tsconfig: "./tsconfig.json",
  },
  target: "es2020",
  sourcemap: true,
  clean: true,
  splitting: false,

  // Don’t bundle peer libs:
  external: ["react", "react-dom", "wagmi", "@rainbow-me/rainbowkit"],

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
});
