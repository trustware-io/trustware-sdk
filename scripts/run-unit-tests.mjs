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
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

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
const tmpDir = mkdtempSync(join(tmpdir(), "tw-unit-tests-"));

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
