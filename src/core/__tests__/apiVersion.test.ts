import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  API_PREFIX,
  API_ROOT,
  API_VERSION,
  SDK_NAME,
  SDK_VERSION,
} from "../../constants";
import { apiBase, jsonHeaders, validateSdkAccess } from "../http";
import { fetchForexRates } from "../forex";
import { getEVMAllowance } from "../sdkRpc";
import { TrustwareConfigStore } from "../../config/store";

const realFetch = globalThis.fetch;

function serve(body: unknown) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    calls.push({
      url: String(url),
      headers: (init?.headers ?? {}) as Record<string, string>,
    });
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return calls;
}

describe("the API version", () => {
  beforeEach(() => {
    TrustwareConfigStore.init({
      apiKey: "test-key",
      routes: { toChain: "8453", toToken: "USDC" },
    });
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("is v2, and apiBase is the root, the prefix and the version", () => {
    assert.equal(API_VERSION, "v2");
    assert.equal(apiBase(), `${API_ROOT}${API_PREFIX}/${API_VERSION}`);
    assert.equal(apiBase(), "https://api.trustware.io/api/v2");
  });

  it("is the version GET /sdk/validate asks for, with the SDK key", async () => {
    // The v2 body carries camelCase key metadata at the top level (spec
    // section 3). The SDK reads none of it: a 200 is the validation.
    const calls = serve({
      valid: true,
      keyId: "key-1",
      projectId: "project-1",
      createdAt: "2026-11-01T00:00:00Z",
      lastUsedAt: "2026-11-12T00:00:00Z",
    });

    await validateSdkAccess();

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://api.trustware.io/api/v2/sdk/validate");
    assert.equal(calls[0].headers["X-API-Key"], "test-key");
  });

  it("is the version GET /forex asks for", async () => {
    const calls = serve({ data: { rates: { EUR: 0.92 } } });

    const rates = await fetchForexRates("USD");

    assert.deepEqual(rates, { USD: 1, EUR: 0.92 });
    assert.deepEqual(
      calls.map((call) => call.url),
      ["https://api.trustware.io/api/v2/forex?base=USD"]
    );
  });

  it("is the version the SDK RPC proxy is asked for", async () => {
    const calls = serve({
      success: true,
      data: {
        chainId: "8453",
        tokenAddress: "0xtoken",
        ownerAddress: "0xowner",
        spenderAddress: "0xspender",
        allowance: "5",
      },
    });

    await getEVMAllowance({
      chainId: "8453",
      tokenAddress: "0xtoken",
      ownerAddress: "0xowner",
      spenderAddress: "0xspender",
    });

    assert.equal(calls.length, 1);
    assert.ok(
      calls[0].url.startsWith("https://api.trustware.io/api/v2/sdk/rpc/"),
      calls[0].url
    );
  });

  // Chokepoint: every request URL is built from `apiBase()`, so no source file
  // appends a version of its own to it. Third-party URLs are not built from it.
  it("is spelled in no source file's request path", () => {
    const root = join(process.cwd(), "src");
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== "__tests__") walk(path);
        } else if (/\.(ts|tsx)$/.test(entry.name)) {
          const source = readFileSync(path, "utf8");
          if (/\$\{(?:apiBase\(\)|this\.baseURL)\}\/v\d+\//.test(source)) {
            offenders.push(path);
          }
        }
      }
    };
    walk(root);
    assert.deepEqual(offenders, []);
  });

  it("travels in the path only: requests carry no X-API-Version header", () => {
    // The SDK used to send "X-API-Version: 2025-10-01", which the backend
    // never read and which shares its name with the response header that
    // says "v2". The key and the SDK's own name and release still go out.
    assert.deepEqual(jsonHeaders(), {
      "Content-Type": "application/json",
      "X-API-Key": "test-key",
      "X-SDK-Name": SDK_NAME,
      "X-SDK-Version": SDK_VERSION,
    });
  });
});
