import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseStepReceiptResult, parseTransactionStatus } from "../statusWire";
import { ResponseShapeError } from "../wire";

// Every key a committed transaction in the v2 status body can carry (BVT-450
// spec section 3), with the values the backend's integration test reads back.
const committedBody = {
  id: "tx-1",
  intentId: "intent-1",
  projectId: "project-1",
  sdkApiKeyId: "key-1",
  sponsorshipRequestId: "sponsorship-1",
  sdkRequest: true,
  fromAddress: "0xsender",
  toAddress: "0xrecipient",
  originEoa: "0xowner",
  senderVerification: "verified",
  senderVerificationDetail: "erc7710 delegation redemption",
  fromChainId: "1",
  toChainId: "8453",
  sourceTxHash: "0xabc",
  destTxHash: "0xdef",
  requestId: "req-1",
  providerRequestId: "provider-req-1",
  providerQuoteId: "quote-1",
  transactionRequest: { to: "0xrouter", data: "0x846a1bc6", value: "0" },
  status: "success",
  statusRaw: { providerStatus: "success" },
  routePath: [{ leg: 1 }],
  routeStatus: [{ status: "success" }],
  quoteToAmountUsd: "24.97000000",
  toAmountWei: "24970000",
  timeSpentMs: 84000,
  fromChainBlock: 100,
  toChainBlock: 200,
  fromChainTxUrl: "https://etherscan.io/tx/0xabc",
  toChainTxUrl: "https://basescan.org/tx/0xdef",
  gasStatus: "needs_gas",
  isGmpTransaction: true,
  axelarTransactionUrl: "https://axelarscan.io/gmp/1",
  landedAmountVerified: true,
  refunded: false,
  routingProvider: "squid",
  pollAttempt: 3,
  nextPollAt: "2026-11-09T12:00:05Z",
  createDate: "2026-11-09T11:58:00Z",
  updateDate: "2026-11-09T12:00:00Z",
  gasSponsored: true,
  sponsorshipStatus: "settled",
  paymasterRuleId: "rule-1",
  paymasterAddress: "0xpaymaster",
  approvedSponsoredGasUsd: "0.42000000",
  actualSponsoredGasUsd: "0.31000000",
  approvedSponsoredGasWei: "420000000000000",
  actualSponsoredGasWei: "310000000000000",
  sponsorshipUserOperationHash: "0xuserop",
  gasSponsoredUsd: "0.42000000",
  steps: [
    {
      stepIndex: 0,
      stepKind: "approve",
      chainId: "1",
      txHash: "0xapprove",
      status: "confirmed",
      detail: { token: "0xtoken", spender: "0xspender", amount: "25000000" },
      createDate: "2026-11-09T11:58:00Z",
      updateDate: "2026-11-09T11:59:30Z",
    },
    {
      stepIndex: 1,
      stepKind: "main",
      chainId: "1",
      status: "planned",
      createDate: "2026-11-09T11:58:00Z",
      updateDate: "2026-11-09T11:58:00Z",
    },
  ],
};

describe("parseTransactionStatus", () => {
  it("parses a committed v2 body into exactly the Transaction it describes", () => {
    assert.deepEqual(parseTransactionStatus(committedBody), {
      id: "tx-1",
      intentId: "intent-1",
      projectId: "project-1",
      sdkApiKeyId: "key-1",
      sponsorshipRequestId: "sponsorship-1",
      sdkRequest: true,
      fromAddress: "0xsender",
      toAddress: "0xrecipient",
      originEoa: "0xowner",
      senderVerification: "verified",
      senderVerificationDetail: "erc7710 delegation redemption",
      fromChainId: "1",
      toChainId: "8453",
      sourceTxHash: "0xabc",
      destTxHash: "0xdef",
      requestId: "req-1",
      providerRequestId: "provider-req-1",
      providerQuoteId: "quote-1",
      transactionRequest: { to: "0xrouter", data: "0x846a1bc6", value: "0" },
      status: "success",
      statusRaw: { providerStatus: "success" },
      routePath: [{ leg: 1 }],
      routeStatus: [{ status: "success" }],
      quoteToAmountUSD: "24.97000000",
      toAmountWei: "24970000",
      timeSpentMs: 84000,
      fromChainBlock: 100,
      toChainBlock: 200,
      fromChainTxUrl: "https://etherscan.io/tx/0xabc",
      toChainTxUrl: "https://basescan.org/tx/0xdef",
      gasStatus: "needs_gas",
      isGMPTransaction: true,
      axelarTransactionUrl: "https://axelarscan.io/gmp/1",
      landedAmountVerified: true,
      refunded: false,
      routingProvider: "squid",
      pollAttempt: 3,
      nextPollAt: "2026-11-09T12:00:05Z",
      createdDate: "2026-11-09T11:58:00Z",
      updatedDate: "2026-11-09T12:00:00Z",
      gasSponsored: true,
      sponsorshipStatus: "settled",
      paymasterRuleId: "rule-1",
      paymasterAddress: "0xpaymaster",
      approvedSponsoredGasUSD: "0.42000000",
      actualSponsoredGasUSD: "0.31000000",
      approvedSponsoredGasWei: "420000000000000",
      actualSponsoredGasWei: "310000000000000",
      sponsorshipUserOperationHash: "0xuserop",
      gasSponsoredUSD: "0.42000000",
      steps: [
        {
          stepIndex: 0,
          stepKind: "approve",
          chainId: "1",
          txHash: "0xapprove",
          status: "confirmed",
          detail: {
            token: "0xtoken",
            spender: "0xspender",
            amount: "25000000",
          },
          createdDate: "2026-11-09T11:58:00Z",
          updatedDate: "2026-11-09T11:59:30Z",
        },
        {
          stepIndex: 1,
          stepKind: "main",
          chainId: "1",
          status: "planned",
          createdDate: "2026-11-09T11:58:00Z",
          updatedDate: "2026-11-09T11:58:00Z",
        },
      ],
    });
  });

  it("parses an uncommitted v2 body, which has no update date", () => {
    const tx = parseTransactionStatus({
      intentId: "intent-1",
      status: "pending",
      intentStatus: "created",
      createDate: "2026-11-09T11:58:00Z",
      expiresAt: "2026-11-09T12:28:00Z",
    });

    assert.deepEqual(tx, {
      intentId: "intent-1",
      status: "pending",
      intentStatus: "created",
      createdDate: "2026-11-09T11:58:00Z",
      expiresAt: "2026-11-09T12:28:00Z",
    });
    assert.equal("updatedDate" in tx, false);
  });

  it("leaves an absent field absent, not defined-but-undefined", () => {
    const tx = parseTransactionStatus({
      intentId: "intent-1",
      status: "submitted",
      createDate: "2026-11-09T12:00:00Z",
    });

    for (const key of [
      "requestId",
      "sourceTxHash",
      "fromChainBlock",
      "toChainBlock",
      "refunded",
      "steps",
    ]) {
      assert.equal(key in tx, false, key);
    }
  });

  it("carries a status newer than this SDK through untouched", () => {
    const tx = parseTransactionStatus({
      intentId: "intent-1",
      status: "refunding",
      createDate: "2026-11-09T12:00:00Z",
    });
    assert.equal(tx.status, "refunding");
  });

  it("does not carry over a key it does not name, the API's old snake_case ones included", () => {
    const tx = parseTransactionStatus({
      intentId: "intent-1",
      status: "success",
      createDate: "2026-11-09T12:00:00Z",
      source_tx_hash: "0xold",
      somethingNew: 1,
    }) as Record<string, unknown>;

    assert.equal("source_tx_hash" in tx, false);
    assert.equal("somethingNew" in tx, false);
    assert.equal("sourceTxHash" in tx, false);
  });

  it("does not read v1 spellings: a v1 body fails on the first required field it lacks", () => {
    assert.throws(
      () =>
        parseTransactionStatus({
          intent_id: "intent-1",
          status: "success",
          create_date: "2026-11-09T12:00:00Z",
        }),
      (error: unknown) =>
        error instanceof ResponseShapeError &&
        error.field === "intentId" &&
        error.message ===
          'GET /route-intent/{id}/status: field "intentId" must be a non-empty string, received nothing (missing)'
    );
  });

  const base = {
    intentId: "intent-1",
    status: "success",
    createDate: "2026-11-09T12:00:00Z",
  };

  for (const [name, body, field, message] of [
    [
      "a missing status",
      { intentId: "i", createDate: "d" },
      "status",
      'GET /route-intent/{id}/status: field "status" must be a non-empty string, received nothing (missing)',
    ],
    [
      "a missing createDate",
      { intentId: "i", status: "success" },
      "createDate",
      'GET /route-intent/{id}/status: field "createDate" must be a non-empty string, received nothing (missing)',
    ],
    [
      "a string where a number belongs",
      { ...base, fromChainBlock: "100" },
      "fromChainBlock",
      'GET /route-intent/{id}/status: field "fromChainBlock" must be a finite number, received "100"',
    ],
    [
      "a string where a boolean belongs",
      { ...base, refunded: "false" },
      "refunded",
      'GET /route-intent/{id}/status: field "refunded" must be a boolean, received "false"',
    ],
    [
      "a null where a string belongs",
      { ...base, destTxHash: null },
      "destTxHash",
      'GET /route-intent/{id}/status: field "destTxHash" must be a non-empty string, received null',
    ],
    [
      "steps that are not an array",
      { ...base, steps: {} },
      "steps",
      'GET /route-intent/{id}/status: field "steps" must be an array, received {}',
    ],
    [
      "a step with an unknown kind",
      {
        ...base,
        steps: [
          {
            stepIndex: 0,
            stepKind: "swap",
            chainId: "1",
            status: "planned",
            createDate: "d",
            updateDate: "d",
          },
        ],
      },
      "steps[0].stepKind",
      'GET /route-intent/{id}/status: field "steps[0].stepKind" must be one of approve, main, received "swap"',
    ],
    [
      "a step still spelled the v1 way",
      {
        ...base,
        steps: [
          {
            step_index: 0,
            step_kind: "approve",
            chain_id: "1",
            status: "planned",
            create_date: "d",
            update_date: "d",
          },
        ],
      },
      "steps[0].stepIndex",
      'GET /route-intent/{id}/status: field "steps[0].stepIndex" must be a finite number, received nothing (missing)',
    ],
  ] as const) {
    it(`rejects ${name}, naming "${field}"`, () => {
      assert.throws(
        () => parseTransactionStatus(body),
        (error: unknown) =>
          error instanceof ResponseShapeError &&
          error.field === field &&
          error.message === message
      );
    });
  }

  it("rejects a body that is not an object", () => {
    for (const body of [null, undefined, "success", [], 7]) {
      assert.throws(
        () => parseTransactionStatus(body),
        (error: unknown) =>
          error instanceof ResponseShapeError && error.field === "data"
      );
    }
  });
});

describe("parseStepReceiptResult", () => {
  it("parses the v2 answer of the step-receipt endpoint", () => {
    assert.deepEqual(
      parseStepReceiptResult({
        ok: true,
        step: {
          stepIndex: 0,
          stepKind: "approve",
          chainId: "8453",
          txHash: "0xapprove",
          status: "submitted",
          detail: { token: "0xtoken", spender: "0xspender", amount: "1" },
          createDate: "2026-11-09T11:58:00Z",
          updateDate: "2026-11-09T11:59:00Z",
        },
      }),
      {
        ok: true,
        step: {
          stepIndex: 0,
          stepKind: "approve",
          chainId: "8453",
          txHash: "0xapprove",
          status: "submitted",
          detail: { token: "0xtoken", spender: "0xspender", amount: "1" },
          createdDate: "2026-11-09T11:58:00Z",
          updatedDate: "2026-11-09T11:59:00Z",
        },
      }
    );
  });

  it("rejects an answer without its step, naming it", () => {
    assert.throws(
      () => parseStepReceiptResult({ ok: true }),
      (error: unknown) =>
        error instanceof ResponseShapeError &&
        error.message ===
          'POST /route-intent/{id}/steps/{index}/receipt: field "step" must be an object, received nothing (missing)'
    );
  });
});
