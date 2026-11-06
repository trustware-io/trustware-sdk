import { strict as assert } from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";
import { HttpError } from "src/core/http";
import { ReceiptCommitError, submitReceipt } from "src/core/receipt";
import { Trustware } from "src/core";
import { TrustwareConfigStore } from "src/config/store";

const INTENT = "b412c1c0-73a7-4186-9d06-0bb222043cb2";
const TX_HASH =
  "0x07d5000000000000000000000000000000000000000000000000000000004bb0";

const realFetch = globalThis.fetch;

function answer(status: number, body: string) {
  const requests: { url: string; init: RequestInit }[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    requests.push({ url, init });
    return new Response(body, { status });
  }) as unknown as typeof fetch;
  return requests;
}

describe("submitReceipt", () => {
  beforeEach(() => {
    TrustwareConfigStore.init({
      apiKey: "test-key",
      routes: { toChain: "8453", toToken: "USDC" },
    });
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("is the facade's submitReceipt", () => {
    assert.equal(Trustware.submitReceipt, submitReceipt);
  });

  it("commits the tx hash, keyed by it, and returns the data", async () => {
    const requests = answer(
      200,
      JSON.stringify({ data: { ok: true, transaction_id: "tx-1" } })
    );
    const data = await submitReceipt(INTENT, TX_HASH);
    assert.deepEqual(data, { ok: true, transaction_id: "tx-1" });
    assert.equal(requests.length, 1);
    assert.equal(
      requests[0].url,
      `https://api.trustware.io/api/v1/route-intent/${INTENT}/receipt`
    );
    assert.equal(requests[0].init.method, "POST");
    assert.equal(
      (requests[0].init.headers as Record<string, string>)["Idempotency-Key"],
      TX_HASH
    );
    assert.deepEqual(JSON.parse(String(requests[0].init.body)), {
      txHash: TX_HASH,
    });
  });

  it("throws a ReceiptCommitError carrying the code, retryable for a retryable code", async () => {
    answer(
      409,
      JSON.stringify({
        error: "transaction not visible yet",
        code: "tx_not_visible",
      })
    );
    await assert.rejects(submitReceipt(INTENT, TX_HASH), (error: unknown) => {
      assert.ok(error instanceof ReceiptCommitError);
      assert.ok(
        error instanceof HttpError,
        "still an HttpError for old callers"
      );
      assert.equal(error.name, "ReceiptCommitError");
      assert.equal(error.status, 409);
      assert.equal(error.code, "tx_not_visible");
      assert.equal(error.retryable, true);
      assert.equal(error.serverMessage, "transaction not visible yet");
      assert.equal(
        error.message,
        "HTTP 409 (tx_not_visible): transaction not visible yet"
      );
      return true;
    });
  });

  it("marks a final code as not retryable", async () => {
    answer(
      409,
      JSON.stringify({
        error: "transaction hash already used",
        code: "tx_hash_committed_elsewhere",
      })
    );
    await assert.rejects(submitReceipt(INTENT, TX_HASH), (error: unknown) => {
      assert.ok(error instanceof ReceiptCommitError);
      assert.equal(error.code, "tx_hash_committed_elsewhere");
      assert.equal(error.retryable, false);
      return true;
    });
  });

  it("throws a plain HttpError for a refusal without a code", async () => {
    answer(401, JSON.stringify({ error: "invalid API key" }));
    await assert.rejects(submitReceipt(INTENT, TX_HASH), (error: unknown) => {
      assert.ok(error instanceof HttpError);
      assert.ok(!(error instanceof ReceiptCommitError));
      assert.equal(error.message, "HTTP 401: invalid API key");
      return true;
    });
  });

  it("falls back to the status line for a body that isn't JSON", async () => {
    globalThis.fetch = (async () =>
      new Response("<html>bad gateway</html>", {
        status: 503,
        statusText: "Service Unavailable",
      })) as unknown as typeof fetch;
    await assert.rejects(submitReceipt(INTENT, TX_HASH), {
      name: "HttpError",
      message: "HTTP 503: Service Unavailable",
    });
  });
});
