/* global console, process */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();

function readText(path) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function expectFile(path) {
  assert(existsSync(resolve(repoRoot, path)), `Missing required file: ${path}`);
}

function expectIncludes(path, snippet) {
  const text = readText(path);
  assert(
    text.includes(snippet),
    `Expected ${path} to include: ${snippet}`
  );
}

const packageJson = JSON.parse(readText("package.json"));

const expectedSourceEntries = ["src/index.ts", "src/core.ts", "src/wallet.ts", "src/widget.tsx"];
expectedSourceEntries.forEach(expectFile);

const exportedSubpaths = Object.keys(packageJson.exports ?? {});
[".", "./core", "./wallet", "./react", "./constants", "./types"].forEach((subpath) => {
  assert(
    exportedSubpaths.includes(subpath),
    `package.json is missing expected export subpath: ${subpath}`
  );
});

expectIncludes("src/index.ts", 'export { Trustware, TrustwareCore } from "./core";');
expectIncludes("src/index.ts", 'export { TrustwareWidget } from "./widget/";');
expectIncludes("src/index.ts", 'export { TrustwareProvider, useTrustware } from "./provider";');
expectIncludes("src/index.ts", 'export { TrustwareError } from "./errors/TrustwareError";');

expectIncludes("src/widget/index.tsx", "TrustwareWidgetV2 as TrustwareWidget");
expectIncludes("src/core.ts", 'export * from "./core/index";');
expectIncludes("src/wallet.ts", 'export * from "./wallets/index";');
expectIncludes("src/widget.tsx", 'export * from "./widget/index";');

console.log("Public surface checks passed.");
