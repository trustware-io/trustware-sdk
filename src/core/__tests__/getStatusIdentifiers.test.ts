import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { getStatus } from "../routes";
import { TrustwareConfigStore } from "../../config/store";

const realFetch = globalThis.fetch;

/** Serves one raw payload, exactly as the backend would put it on the wire. */
function serve(payload: unknown) {
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(JSON.stringify({ data: payload }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    )) as typeof globalThis.fetch;
}

describe("getStatus identifier mapping", () => {
  beforeEach(() => {
    TrustwareConfigStore.init({
      apiKey: "test-key",
      routes: { toChain: "8453", toToken: "0xtoken" },
    });
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  // The payload is snake_case; the type is camelCase. Without the mapping both
  // IDs read undefined, which is the whole point of carrying them.
  it("maps request_id and provider_request_id from the wire", async () => {
    serve({
      id: "tx-1",
      intent_id: "intent-1",
      status: "success",
      request_id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
      provider_request_id: "0xsquidrequestid",
      source_tx_hash: "0xhash",
    });

    const tx = await getStatus("intent-1");

    assert.equal(tx.requestId, "3f2504e0-4f89-41d3-9a0c-0305e82c3301");
    assert.equal(tx.providerRequestId, "0xsquidrequestid");
  });

  // Consumers that already read the raw keys must keep working.
  it("keeps the raw wire keys alongside the mapped ones", async () => {
    serve({
      status: "success",
      request_id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
      provider_request_id: "0xsquidrequestid",
    });

    const raw = (await getStatus("intent-1")) as unknown as Record<
      string,
      unknown
    >;

    assert.equal(raw.request_id, "3f2504e0-4f89-41d3-9a0c-0305e82c3301");
    assert.equal(raw.provider_request_id, "0xsquidrequestid");
  });

  // A provider that issued no ID of its own, or a row predating the split,
  // leaves the field off entirely — it should not become defined-but-undefined.
  it("leaves an absent identifier absent", async () => {
    serve({
      id: "tx-1",
      status: "success",
      request_id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    });

    const tx = await getStatus("intent-1");

    assert.equal(tx.requestId, "3f2504e0-4f89-41d3-9a0c-0305e82c3301");
    assert.ok(
      !("providerRequestId" in tx),
      "absent provider ID should stay absent"
    );
  });

  // The pre-receipt stub carries neither ID, and must survive the mapping.
  it("passes a pending stub through untouched", async () => {
    serve({
      intent_id: "intent-1",
      status: "pending",
      intent_status: "created",
      create_date: "2026-08-13T00:00:00Z",
    });

    const tx = await getStatus("intent-1");

    assert.equal(tx.status, "pending");
    assert.ok(!("requestId" in tx));
    assert.ok(!("providerRequestId" in tx));
  });

  // Already-camelCase input (a future backend, or a proxy that maps for us)
  // must not be clobbered by the snake_case fallback.
  it("prefers an already-camelCase identifier", async () => {
    serve({
      status: "success",
      requestId: "camel-wins",
      request_id: "snake-loses",
    });

    const tx = await getStatus("intent-1");

    assert.equal(tx.requestId, "camel-wins");
  });
});
