#!/usr/bin/env node
/* global console, process */
/**
 * Compile *.test.ts source files with esbuild (bundling local imports, leaving node_modules
 * external) then run them with the built-in Node.js test runner.
 *
 * Usage: node scripts/run-unit-tests.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pkg from "../package.json" with { type: "json" };

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// Mirror tsup.config.ts's `define` block so modules referencing these build-time
// globals (e.g. src/constants.ts) don't blow up when pulled in transitively by a
// test (test files never reference these directly, but imports from the package's
// own barrel do).
const defines = {
  __SDK_VERSION__: JSON.stringify(pkg.version),
  __API_ROOT__: JSON.stringify(
    process.env.TRUSTWARE_API_ROOT || "https://api.trustware.io"
  ),
  __GTM_ID__: JSON.stringify(process.env.TRUSTWARE_GTM_ID || ""),
  __WALLETCONNECT_PROJECT_ID__: JSON.stringify(
    process.env.TRUSTWARE_WALLETCONNECT_PROJECT_ID ||
      "896c4c8fa652baf14b9614e4026aff6a"
  ),
};

function findTestFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) results.push(...findTestFiles(full));
    else if (entry.isFile() && entry.name.endsWith(".test.ts")) results.push(full);
  }
  return results;
}

const testFiles = findTestFiles(join(root, "src"));
if (testFiles.length === 0) {
  console.log("No .test.ts files found under src/.");
  process.exit(0);
}

console.log(`Found ${testFiles.length} test file(s):\n${testFiles.map((f) => `  ${f.replace(root + "/", "")}`).join("\n")}\n`);

const esbuild = join(root, "node_modules/.bin/esbuild");
// Compile into a tmp dir *inside* the project (not the OS tmpdir) so Node's ESM
// resolver can walk up to `<root>/node_modules` for real runtime deps (e.g. viem)
// pulled in transitively by modules that import from the package's own barrel.
const tmpDir = mkdtempSync(join(root, ".tw-unit-tests-"));

try {
  const compiled = [];
  for (const src of testFiles) {
    const relative = src.replace(root + "/", "").replaceAll("/", "__");
    const outFile = join(tmpDir, relative.replace(".test.ts", ".test.mjs"));
    execFileSync(
      esbuild,
      [
        src,
        "--bundle",
        "--format=esm",
        "--platform=node",
        "--packages=external",
        ...Object.entries(defines).map(([k, v]) => `--define:${k}=${v}`),
        `--outfile=${outFile}`,
      ],
      { stdio: "inherit", cwd: root }
    );
    compiled.push(outFile);
  }

  execFileSync("node", ["--test", ...compiled], { stdio: "inherit", cwd: root });
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}
