import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { getStatus, submitStepReceipt } from "../routes";
import { ResponseShapeError } from "../wire";
import { TrustwareConfigStore } from "../../config/store";

const realFetch = globalThis.fetch;

/** Serves one raw payload, exactly as the v2 API would put it on the wire,
 *  and records the URL it was asked for. */
function serve(payload: unknown) {
  const urls: string[] = [];
  globalThis.fetch = ((url: string) => {
    urls.push(url);
    return Promise.resolve(
      new Response(JSON.stringify({ data: payload }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
  }) as typeof globalThis.fetch;
  return urls;
}

describe("getStatus", () => {
  beforeEach(() => {
    TrustwareConfigStore.init({
      apiKey: "test-key",
      routes: { toChain: "8453", toToken: "0xtoken" },
    });
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("asks /api/v2 for the intent's status", async () => {
    const urls = serve({
      intentId: "intent-1",
      status: "success",
      createDate: "2026-11-09T11:58:00Z",
    });

    await getStatus("intent-1");

    assert.deepEqual(urls, [
      "https://api.trustware.io/api/v2/route-intent/intent-1/status",
    ]);
  });

  // The two IDs are why a caller reads the status at all: Trustware's own
  // request ID for support, the provider's for its status API.
  it("reads requestId and providerRequestId from the v2 body", async () => {
    serve({
      id: "tx-1",
      intentId: "intent-1",
      status: "success",
      createDate: "2026-11-09T11:58:00Z",
      requestId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
      providerRequestId: "0xsquidrequestid",
      sourceTxHash: "0xhash",
    });

    const tx = await getStatus("intent-1");

    assert.equal(tx.requestId, "3f2504e0-4f89-41d3-9a0c-0305e82c3301");
    assert.equal(tx.providerRequestId, "0xsquidrequestid");
    assert.equal(tx.sourceTxHash, "0xhash");
  });

  // A provider that issued no ID of its own, or a row predating the split,
  // leaves the field off entirely.
  it("leaves an absent identifier absent", async () => {
    serve({
      id: "tx-1",
      intentId: "intent-1",
      status: "success",
      createDate: "2026-11-09T11:58:00Z",
      requestId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    });

    const tx = await getStatus("intent-1");

    assert.equal(tx.requestId, "3f2504e0-4f89-41d3-9a0c-0305e82c3301");
    assert.ok(
      !("providerRequestId" in tx),
      "absent provider ID should stay absent"
    );
  });

  // The pre-receipt stub carries neither ID.
  it("parses a pending stub", async () => {
    serve({
      intentId: "intent-1",
      status: "pending",
      intentStatus: "created",
      createDate: "2026-08-13T00:00:00Z",
    });

    const tx = await getStatus("intent-1");

    assert.equal(tx.status, "pending");
    assert.equal(tx.intentStatus, "created");
    assert.ok(!("requestId" in tx));
    assert.ok(!("providerRequestId" in tx));
  });

  it("throws, naming the field, on a v1 body from a backend without v2", async () => {
    serve({
      intent_id: "intent-1",
      status: "success",
      create_date: "2026-11-09T11:58:00Z",
      request_id: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    });

    await assert.rejects(
      () => getStatus("intent-1"),
      (error: unknown) =>
        error instanceof ResponseShapeError && error.field === "intentId"
    );
  });
});

describe("submitStepReceipt", () => {
  beforeEach(() => {
    TrustwareConfigStore.init({
      apiKey: "test-key",
      routes: { toChain: "8453", toToken: "0xtoken" },
    });
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("posts to /api/v2 and parses the v2 step it answers with", async () => {
    const urls = serve({
      ok: true,
      step: {
        stepIndex: 0,
        stepKind: "approve",
        chainId: "8453",
        txHash: "0xapprove",
        status: "submitted",
        createDate: "2026-11-09T11:58:00Z",
        updateDate: "2026-11-09T11:59:00Z",
      },
    });

    const result = await submitStepReceipt("intent-1", 0, "0xapprove");

    assert.deepEqual(urls, [
      "https://api.trustware.io/api/v2/route-intent/intent-1/steps/0/receipt",
    ]);
    assert.deepEqual(result, {
      ok: true,
      step: {
        stepIndex: 0,
        stepKind: "approve",
        chainId: "8453",
        txHash: "0xapprove",
        status: "submitted",
        createdDate: "2026-11-09T11:58:00Z",
        updatedDate: "2026-11-09T11:59:00Z",
      },
    });
  });
});
