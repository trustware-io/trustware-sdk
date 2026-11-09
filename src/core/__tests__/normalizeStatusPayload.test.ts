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

  // The cast is the point of the test, not a workaround: the raw keys survive
  // at runtime for back-compat but are deliberately absent from `Transaction`,
  // so reading one is exactly what a legacy caller has to do.
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

  it("leaves the blocks out of a submitted payload, as the backend sends it", () => {
    // The backend writes from_chain_block and to_chain_block only once it
    // has confirmed the transaction, and omits NULL ones, so a submitted
    // transaction has neither.
    const tx = normalizeStatusPayload({
      id: "5aa8c0e2-7b30-4a7a-b0a8-fc7f9f62fe0e",
      intent_id: "intent-1",
      source_tx_hash: "0xabc",
      status: "submitted",
      create_date: "2026-11-09T12:00:00Z",
      update_date: "2026-11-09T12:00:00Z",
    });

    assert.equal(tx.fromChainBlock, undefined);
    assert.equal(tx.toChainBlock, undefined);
    assert.equal("fromChainBlock" in tx, false);
    assert.equal("toChainBlock" in tx, false);
    assert.equal(tx.createdDate, "2026-11-09T12:00:00Z");
    assert.equal(tx.updatedDate, "2026-11-09T12:00:00Z");
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

  // Every key a transaction payload from quicklinks_v1 can carry
  // (db/transaction_view.go after #348), with the values its integration
  // test reads back.
  const fullWirePayload = {
    id: "tx-1",
    intent_id: "intent-1",
    project_id: "project-1",
    sdk_api_key_id: "key-1",
    sdk_request: true,
    from_address: "0xsender",
    to_address: "0xrecipient",
    origin_eoa: "0xowner",
    sender_verification: "verified",
    from_chain_id: "1",
    to_chain_id: "8453",
    source_tx_hash: "0xabc",
    dest_tx_hash: "0xdef",
    request_id: "req-1",
    provider_request_id: "provider-req-1",
    provider_quote_id: "quote-1",
    transaction_request: { to: "0xrouter", data: "0x846a1bc6", value: "0" },
    status: "success",
    status_raw: { providerStatus: "success" },
    route_path: [{ leg: 1 }],
    route_status: [{ status: "success" }],
    to_amount_wei: "24970000",
    quote_to_amount_usd: "24.97000000",
    time_spent_ms: 84000,
    from_chain_block: 100,
    to_chain_block: 200,
    from_chain_tx_url: "https://etherscan.io/tx/0xabc",
    to_chain_tx_url: "https://basescan.org/tx/0xdef",
    gas_status: "needs_gas",
    is_gmp_transaction: true,
    axelar_transaction_url: "https://axelarscan.io/gmp/1",
    landed_amount_verified: true,
    routing_provider: "squid",
    poll_attempt: 3,
    next_poll_at: "2026-11-09T12:00:05Z",
    create_date: "2026-11-09T11:58:00Z",
    update_date: "2026-11-09T12:00:00Z",
    sponsorship_request_id: "sponsorship-1",
    gas_sponsored: true,
    sponsorship_status: "settled",
    paymaster_rule_id: "rule-1",
    paymaster_address: "0xpaymaster",
    approved_sponsored_gas_usd: "0.42000000",
    actual_sponsored_gas_usd: "0.31000000",
    approved_sponsored_gas_wei: "420000000000000",
    actual_sponsored_gas_wei: "310000000000000",
    sponsorship_user_operation_hash: "0xuserop",
    gas_sponsored_usd: "0.42000000",
  };

  it("names every field of a full transaction payload", () => {
    const tx = normalizeStatusPayload(fullWirePayload);

    assert.equal(tx.projectId, "project-1");
    assert.equal(tx.sdkApiKeyId, "key-1");
    assert.equal(tx.sdkRequest, true);
    assert.equal(tx.senderVerification, "verified");
    assert.equal(tx.providerQuoteId, "quote-1");
    assert.equal(tx.routingProvider, "squid");
    assert.equal(tx.quoteToAmountUSD, "24.97000000");
    assert.equal(tx.pollAttempt, 3);
    assert.equal(tx.nextPollAt, "2026-11-09T12:00:05Z");
    assert.equal(tx.gasSponsored, true);
    assert.equal(tx.sponsorshipRequestId, "sponsorship-1");
    assert.equal(tx.sponsorshipStatus, "settled");
    assert.equal(tx.paymasterRuleId, "rule-1");
    assert.equal(tx.paymasterAddress, "0xpaymaster");
    assert.equal(tx.approvedSponsoredGasUSD, "0.42000000");
    assert.equal(tx.gasSponsoredUSD, "0.42000000");
    assert.equal(tx.actualSponsoredGasUSD, "0.31000000");
    assert.equal(tx.approvedSponsoredGasWei, "420000000000000");
    assert.equal(tx.actualSponsoredGasWei, "310000000000000");
    assert.equal(tx.sponsorshipUserOperationHash, "0xuserop");
  });

  // A snake_case wire key with no camelCase name is a field Transaction
  // forgot. The two exceptions keep their wire spelling on Transaction
  // itself (see its doc comment).
  it("gives every snake_case key of a full payload a camelCase name", () => {
    const declaredAsIs = new Set(["origin_eoa", "landed_amount_verified"]);
    const tx = normalizeStatusPayload(fullWirePayload) as Record<
      string,
      unknown
    >;
    const unnamed = Object.keys(fullWirePayload).filter((key) => {
      if (!key.includes("_") || declaredAsIs.has(key)) return false;
      const camel = key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
      const named = Object.keys(tx).some(
        (k) => !k.includes("_") && k.toLowerCase() === camel.toLowerCase()
      );
      // create_date/update_date are spelled createdDate/updatedDate.
      return !named && !(key === "create_date" || key === "update_date");
    });
    assert.deepEqual(unnamed, []);
  });

  it("names a pending payload's intent status and steps", () => {
    const tx = normalizeStatusPayload({
      intent_id: "intent-1",
      status: "pending",
      intent_status: "created",
      create_date: "2026-11-09T11:58:00Z",
      expiresAt: "2026-11-09T12:28:00Z",
      steps: [
        {
          step_index: 0,
          step_kind: "approve",
          chain_id: "1",
          tx_hash: "0xapprove",
          status: "confirmed",
          detail: {
            token: "0xtoken",
            spender: "0xspender",
            amount: "25000000",
          },
          create_date: "2026-11-09T11:58:00Z",
          update_date: "2026-11-09T11:59:30Z",
        },
        {
          step_index: 1,
          step_kind: "main",
          chain_id: "1",
          status: "planned",
          create_date: "2026-11-09T11:58:00Z",
          update_date: "2026-11-09T11:58:00Z",
        },
      ],
    });

    assert.equal(tx.intentStatus, "created");
    assert.equal(tx.steps?.length, 2);
    const [approve, main] = tx.steps ?? [];
    assert.equal(approve.stepIndex, 0);
    assert.equal(approve.stepKind, "approve");
    assert.equal(approve.chainId, "1");
    assert.equal(approve.txHash, "0xapprove");
    assert.equal(approve.status, "confirmed");
    assert.deepEqual(approve.detail, {
      token: "0xtoken",
      spender: "0xspender",
      amount: "25000000",
    });
    assert.equal(approve.createdDate, "2026-11-09T11:58:00Z");
    assert.equal(approve.updatedDate, "2026-11-09T11:59:30Z");
    assert.equal(main.stepIndex, 1);
    assert.equal(main.stepKind, "main");
    assert.equal("txHash" in main, false);
    // Raw step keys survive, like the top-level ones.
    assert.equal((approve as Record<string, unknown>).tx_hash, "0xapprove");
  });

  it("passes non-object payloads straight through", () => {
    assert.equal(normalizeStatusPayload(null), null);
    assert.equal(normalizeStatusPayload(undefined), undefined);
  });
});
