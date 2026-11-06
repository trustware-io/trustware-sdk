import { strict as assert } from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";
import { pollStatus } from "src/core/routes";
import { TrustwareConfigStore } from "src/config/store";

const INTENT = "intent-poll";
const realFetch = globalThis.fetch;

const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function initConfig() {
  TrustwareConfigStore.init({
    apiKey: "test-key",
    routes: { toChain: "8453", toToken: "USDC" },
  });
}

describe("pollStatus", () => {
  beforeEach(initConfig);
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  function serveStatuses(statuses: string[]) {
    const reads: string[] = [];
    globalThis.fetch = (async () => {
      const status = statuses.length > 1 ? statuses.shift()! : statuses[0];
      reads.push(status);
      return json(200, { data: { intent_id: INTENT, status } });
    }) as unknown as typeof fetch;
    return reads;
  }

  it("stops on expired: it is terminal", async () => {
    const reads = serveStatuses(["pending", "pending", "expired", "pending"]);
    const tx = await pollStatus(INTENT, { intervalMs: 1, timeoutMs: 10_000 });
    assert.equal(tx.status, "expired");
    assert.deepEqual(reads, ["pending", "pending", "expired"]);
  });

  it("keeps polling a status newer than this SDK until the timeout", async () => {
    const reads = serveStatuses(["refunding"]);
    const started = Date.now();
    const tx = await pollStatus(INTENT, { intervalMs: 5, timeoutMs: 60 });
    assert.equal(tx.status, "refunding");
    assert.ok(Date.now() - started >= 60, "returned before the timeout");
    assert.ok(reads.length > 3, `only ${reads.length} reads`);
  });
});
