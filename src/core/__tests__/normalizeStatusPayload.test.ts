import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeStatusPayload } from "../routes";

describe("normalizeStatusPayload", () => {
  it("maps the snake_case wire payload onto Transaction's camelCase names", () => {
    const tx = normalizeStatusPayload({
      id: "5aa8c0e2-7b30-4a7a-b0a8-fc7f9f62fe0e",
      intent_id: "intent-1",
      from_address: "0xsender",
      to_address: "0xrecipient",
      from_chain_id: "1",
      to_chain_id: "8453",
      source_tx_hash: "0xabc",
      dest_tx_hash: "0xdef",
      request_id: "req-1",
      provider_request_id: "squid-1",
      status: "success",
      to_amount_wei: "1234567",
      from_chain_block: 19876543,
      to_chain_block: 1234567,
      from_chain_tx_url: "https://etherscan.io/tx/0xabc",
      to_chain_tx_url: "https://basescan.org/tx/0xdef",
      gas_status: "needs_gas",
      is_gmp_transaction: true,
      axelar_transaction_url: "https://axelarscan.io/1",
      create_date: "2026-01-01T00:00:00Z",
      update_date: "2026-01-01T00:01:00Z",
      time_spent_ms: 42000,
    });

    assert.equal(tx.intentId, "intent-1");
    assert.equal(tx.fromAddress, "0xsender");
    assert.equal(tx.toAddress, "0xrecipient");
    assert.equal(tx.fromChainId, "1");
    assert.equal(tx.toChainId, "8453");
    assert.equal(tx.sourceTxHash, "0xabc");
    assert.equal(tx.destTxHash, "0xdef");
    assert.equal(tx.requestId, "req-1");
    assert.equal(tx.providerRequestId, "squid-1");
    assert.equal(tx.toAmountWei, "1234567");
    assert.equal(tx.fromChainBlock, 19876543);
    assert.equal(tx.toChainBlock, 1234567);
    assert.equal(tx.fromChainTxUrl, "https://etherscan.io/tx/0xabc");
    assert.equal(tx.toChainTxUrl, "https://basescan.org/tx/0xdef");
    assert.equal(tx.gasStatus, "needs_gas");
    assert.equal(tx.isGMPTransaction, true);
    assert.equal(tx.axelarTransactionUrl, "https://axelarscan.io/1");
    assert.equal(tx.createdDate, "2026-01-01T00:00:00Z");
    assert.equal(tx.updatedDate, "2026-01-01T00:01:00Z");
    assert.equal(tx.timeSpentMs, 42000);
  });

  it("keeps the raw wire keys alongside the camelCase ones", () => {
    const tx = normalizeStatusPayload({
      source_tx_hash: "0xabc",
      status: "submitted",
    }) as Record<string, unknown>;

    assert.equal(tx.source_tx_hash, "0xabc");
    assert.equal(tx.sourceTxHash, "0xabc");
  });

  it("leaves a missing field missing rather than defined-but-undefined", () => {
    const tx = normalizeStatusPayload({ status: "pending" });

    assert.equal("requestId" in tx, false);
    assert.equal("sourceTxHash" in tx, false);
    assert.equal(tx.status, "pending");
  });

  it("does not clobber a camelCase key the wire already sent", () => {
    const tx = normalizeStatusPayload({
      sourceTxHash: "0xcamel",
      source_tx_hash: "0xsnake",
      status: "success",
    });

    assert.equal(tx.sourceTxHash, "0xcamel");
  });

  it("carries a null through instead of skipping the key", () => {
    const tx = normalizeStatusPayload({
      dest_tx_hash: null,
      status: "bridging",
    });

    assert.equal("destTxHash" in tx, true);
    assert.equal(tx.destTxHash, null);
  });

  it("passes non-object payloads straight through", () => {
    assert.equal(normalizeStatusPayload(null), null);
    assert.equal(normalizeStatusPayload(undefined), undefined);
  });
});
