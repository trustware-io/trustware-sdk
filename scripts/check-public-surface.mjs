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

function expectExcludes(path, snippet) {
  const text = readText(path);
  assert(
    !text.includes(snippet),
    `Expected ${path} not to include: ${snippet}`
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

// Signed off 2026-10-16: the review-then-send pair hosts need for Solana
// routes. Named exports and types live on ./core only, not the root.
expectIncludes(
  "src/core/index.ts",
  'export { buildRouteForReview, sendReviewedRoute } from "./signTimeRoute";'
);
expectIncludes(
  "src/core/index.ts",
  'export type {\n  BuiltRoute,\n  ReviewedRouteSend,\n  MaterialRouteChange,\n  SendReviewedRouteOptions,\n  SigningRetry,\n} from "./signTimeRoute";'
);
expectIncludes("src/core/index.ts", "  buildRouteForReview,\n");
expectIncludes("src/core/index.ts", "  sendReviewedRoute,\n");
// Signed off 2026-10-16: the onRetry option for the Solana re-sign.
for (const name of [
  "BuiltRoute",
  "ReviewedRouteSend",
  "MaterialRouteChange",
  "SendReviewedRouteOptions",
  "SigningRetry",
]) {
  expectExcludes("src/index.ts", name);
}

// Signed off 2026-10-16: the SDK's adapters report the first accepted send.
// routeIntentId (BVT-251, the commit handshake) awaits sign-off in its PR.
expectIncludes(
  "src/types/wallets.ts",
  "    options?: {\n      onAccepted?: (signature: string) => void;\n      routeIntentId?: string;\n    }\n  ): Promise<string>;"
);

expectIncludes("src/widget/index.tsx", "TrustwareWidgetV2 as TrustwareWidget");
expectIncludes("src/core.ts", 'export * from "./core/index";');
expectIncludes("src/wallet.ts", 'export * from "./wallets/index";');
expectIncludes("src/widget.tsx", 'export * from "./widget/index";');

console.log("Public surface checks passed.");
