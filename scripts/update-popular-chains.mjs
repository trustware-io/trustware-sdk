#!/usr/bin/env node
/**
 * Fetches chain TVL rankings from DeFiLlama and writes the ordered list to
 * src/core/popularChains.json. Run this manually before releases to keep the
 * popular chain list fresh:
 *
 *   node scripts/update-popular-chains.mjs
 *
 * The SDK uses the JSON at runtime to pick the top POPULAR_LIMIT chains that
 * are actually in the registry — no browser-side API calls required.
 */

import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "../src/widget/data/popularChains.json");

// How many entries to store (more than POPULAR_LIMIT so we have coverage after
// filtering to only chains the registry actually supports)
const STORE_TOP_N = 30;

async function main() {
  console.log("Fetching chain TVL data from DeFiLlama...");

  const res = await fetch("https://api.llama.fi/v2/chains");
  if (!res.ok) throw new Error(`DeFiLlama returned HTTP ${res.status}`);

  const chains = await res.json();

  // Sort descending by TVL
  chains.sort((a, b) => (b.tvl ?? 0) - (a.tvl ?? 0));

  // Keep the top N, storing chainId (EVM) or just the name (non-EVM)
  const byTvl = chains.slice(0, STORE_TOP_N).map((c) => {
    const entry = { name: c.name };
    if (typeof c.chainId === "number") entry.chainId = c.chainId;
    return entry;
  });

  const output = {
    byTvl,
    popularLimit: 8,
    updatedAt: new Date().toISOString().slice(0, 10),
    source: "https://api.llama.fi/v2/chains — sorted by TVL",
  };

  writeFileSync(OUT, JSON.stringify(output, null, 2) + "\n");

  console.log(`Wrote ${byTvl.length} chains to src/core/popularChains.json`);
  console.log("Top 10 by TVL:");
  byTvl.slice(0, 10).forEach((c, i) => {
    const id = c.chainId != null ? ` (chainId: ${c.chainId})` : "";
    console.log(`  ${i + 1}. ${c.name}${id}`);
  });
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
