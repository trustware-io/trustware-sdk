// tsup.config.ts
import { defineConfig, type Options } from "tsup";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import { readFile, writeFile, mkdir } from "fs/promises";
import { dirname, join } from "path";
import pkg from "./package.json";

// Custom plugin to process CSS with PostCSS/Tailwind
const processCss = async () => {
  const cssPath = "src/widget-v2/styles.css";
  const outPath = "dist/widget-v2.css";

  try {
    const css = await readFile(cssPath, "utf8");
    const result = await postcss([tailwindcss, autoprefixer]).process(css, {
      from: cssPath,
      to: outPath,
    });

    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, result.css);
    if (result.map) {
      await writeFile(`${outPath}.map`, result.map.toString());
    }
    console.log("✓ CSS processed successfully");
  } catch (error) {
    console.error("CSS processing error:", error);
  }
};

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

  // Don't bundle peer libs:
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

  // Inject package.json version at build time
  define: {
    __SDK_VERSION__: JSON.stringify(pkg.version),
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
    onSuccess: async () => {
      await processCss();
    },
  },
]);
