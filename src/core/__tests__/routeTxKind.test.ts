import { strict as assert } from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { routeTxKind, type TxRequest } from "src/core/routes";
import { buildRouteForReview, sendReviewedRoute } from "src/core/signTimeRoute";
import { EVM_WALLET_REQUIRED, SOLANA_WALLET_REQUIRED } from "src/core/tx";
import { TrustwareConfigStore } from "src/config/store";
import { walletManager } from "src/wallets/";
import { mapError } from "src/widget/lib/mapError";
import { SOLANA_CHAIN_ID } from "src/utils/chains";
import {
  SOLANA,
  SOL_OWNER,
  EVM_OWNER,
  ROUTER,
  SOLANA_REQUEST,
  REVIEWED_ESTIMATE,
  ROUTE_EXPIRES_AT,
  json,
  solanaWallet,
  evmWallet,
  type Event,
} from "./routeBackendStub";

// Scenario 1 of the 2026-11-10 local run: USDC (Solana) -> USDC (Base), Squid
// won with a Squid Intents order. Its transaction names the deposit address in
// `to`, so the SDK read it as EVM and refused it with a Solana wallet
// connected ("An EVM wallet is required for this route"), before Phantom was
// asked. Intent 0514fb5b-0165-4e77-9860-0ad905418d67 in the tw-solfix stack.

/** Squid's deposit address from that route. */
const SQUID_DEPOSIT_ADDRESS = "2WGtetjxKrsif4cjnGv2CxtctEDzsVTeH9uF5Tibf3UW";

/**
 * A serialized Solana transaction with one empty signature slot, as Squid
 * sends it: the sender pays, and it moves funds to the deposit address.
 * Built here rather than copied so the fixture carries no real wallet.
 */
function unsignedSolanaTx(lamports: number): string {
  const payer = new PublicKey(SOL_OWNER);
  const tx = new Transaction({
    feePayer: payer,
    recentBlockhash: "GHtXQBsoZHVnNFa9YevAzFr17DJjgHXk3ycTKD5xD3Zi",
  }).add(
    SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: new PublicKey(SQUID_DEPOSIT_ADDRESS),
      lamports,
    })
  );
  return tx
    .serialize({ requireAllSignatures: false, verifySignatures: false })
    .toString("base64");
}

const SQUID_REVIEWED_DATA = unsignedSolanaTx(100_000);
const SQUID_REBUILT_DATA = unsignedSolanaTx(100_001);

/** Squid's DEPOSIT_ADDRESS_CALLDATA transaction, field for field. */
function squidDepositAddressTx(data: string): TxRequest & { type: string } {
  return {
    to: SQUID_DEPOSIT_ADDRESS,
    data,
    type: "DEPOSIT_ADDRESS_CALLDATA",
    value: "0",
    chainId: SOLANA,
    gasLimit: "0",
    gasPrice: "0",
  };
}

describe("the Squid fixture is the payload seen live", () => {
  it("is one empty signature slot followed by the message", () => {
    // The live payload began "AQAAAAAA…": a count of 1, then 64 zero bytes.
    const bytes = Buffer.from(SQUID_REVIEWED_DATA, "base64");
    assert.equal(bytes[0], 1);
    assert.deepEqual(bytes.subarray(1, 65), Buffer.alloc(64));
    assert.ok(SQUID_REVIEWED_DATA.startsWith("AQAAAAAA"));
  });
});

describe("routeTxKind", () => {
  // Every transaction shape the tw-solfix database held on 2026-11-10, by
  // provider, plus the EVM shapes the send path has always taken.
  const cases: Array<
    [
      label: string,
      txReq: TxRequest,
      fallback: string | number | undefined,
      expected: "evm" | "solana" | undefined,
    ]
  > = [
    [
      "Squid deposit-address order from Solana (to = deposit address)",
      squidDepositAddressTx(SQUID_REVIEWED_DATA),
      undefined,
      "solana",
    ],
    [
      "Squid same-chain swap on Solana (no to)",
      { data: SQUID_REVIEWED_DATA, chainId: SOLANA },
      undefined,
      "solana",
    ],
    [
      "LiFi from Solana",
      { data: SQUID_REVIEWED_DATA, chainId: SOLANA },
      undefined,
      "solana",
    ],
    [
      "Relay from Solana, which names the sender",
      {
        data: SQUID_REVIEWED_DATA,
        chainId: SOLANA,
        from: SOL_OWNER,
      } as TxRequest,
      undefined,
      "solana",
    ],
    [
      "a Solana route with no chainId, from the caller's fallback",
      { data: SQUID_REVIEWED_DATA },
      SOLANA,
      "solana",
    ],
    [
      "Solana under its numeric routing id",
      { data: SQUID_REVIEWED_DATA, chainId: SOLANA_CHAIN_ID },
      undefined,
      "solana",
    ],
    [
      "the route's chain over a contradicting fallback",
      squidDepositAddressTx(SQUID_REVIEWED_DATA),
      "8453",
      "solana",
    ],
    [
      "Khalani on Base (string chainId)",
      {
        to: ROUTER,
        data: "0xaaaa",
        chainId: "8453",
        from: EVM_OWNER,
      } as TxRequest,
      undefined,
      "evm",
    ],
    [
      "an EVM route with a numeric chainId",
      { to: ROUTER, data: "0xaaaa", value: "0", chainId: 42161 },
      undefined,
      "evm",
    ],
    [
      "an EVM route naming `target` instead of `to`",
      { target: ROUTER, data: "0xaaaa", chainId: "8453" },
      undefined,
      "evm",
    ],
    [
      "an EVM route with no chainId, from the caller's fallback",
      { to: ROUTER, data: "0xaaaa" },
      8453,
      "evm",
    ],
    [
      "EVM calldata with no target",
      { data: "0xaaaa", chainId: "8453" },
      undefined,
      undefined,
    ],
    [
      "no data",
      { data: "", to: ROUTER, chainId: "8453" },
      undefined,
      undefined,
    ],
    [
      "no chain at all",
      { data: SQUID_REVIEWED_DATA, to: SQUID_DEPOSIT_ADDRESS },
      undefined,
      undefined,
    ],
    [
      "a blank chainId and no fallback",
      { data: SQUID_REVIEWED_DATA, chainId: "  " },
      undefined,
      undefined,
    ],
    ["a NaN fallback", { data: SQUID_REVIEWED_DATA }, Number.NaN, undefined],
    [
      "a Cosmos chain",
      { data: "AQID", to: "osmo1xyz", chainId: "cosmos:osmosis-1" },
      undefined,
      undefined,
    ],
    [
      "a Bitcoin chain",
      { data: "AQID", chainId: "bitcoin" },
      undefined,
      undefined,
    ],
  ];

  for (const [label, txReq, fallback, expected] of cases) {
    it(`${label}: ${String(expected)}`, () => {
      assert.equal(routeTxKind(txReq, fallback), expected);
    });
  }

  it("is undefined for a missing transaction", () => {
    assert.equal(routeTxKind(undefined), undefined);
    assert.equal(routeTxKind(null, SOLANA), undefined);
  });
});

describe("a Squid deposit-address route from Solana", () => {
  const realFetch = globalThis.fetch;
  let events: Event[];
  let replies: string[];

  beforeEach(() => {
    TrustwareConfigStore.init({
      apiKey: "test-key",
      routes: { toChain: 8453, toToken: "USDC" },
    });
    events = [];
    replies = [SQUID_REVIEWED_DATA, SQUID_REBUILT_DATA];
    globalThis.fetch = (async (
      input: RequestInfo | URL,
      init?: RequestInit
    ) => {
      const url = String(input);
      if (url.endsWith("/v1/routes/route")) {
        events.push({
          kind: "build",
          body: JSON.parse(String(init?.body)) as Record<string, unknown>,
        });
        const data = replies.shift();
        if (!data) throw new Error(`Unexpected extra route build: ${url}`);
        return json(200, {
          data: {
            intentId: "intent-squid",
            expiresAt: ROUTE_EXPIRES_AT,
            route: {
              provider: "squid",
              estimate: REVIEWED_ESTIMATE,
              execution: { transaction: squidDepositAddressTx(data) },
            },
          },
        });
      }
      if (url.endsWith("/v1/routes/chains")) {
        return json(200, {
          data: [
            {
              chainId: SOLANA,
              networkIdentifier: SOLANA,
              type: "solana",
              networkName: "Solana",
            },
          ],
        });
      }
      const receipt = url.match(/\/v1\/route-intent\/([^/]+)\/receipt$/);
      if (receipt) {
        const { txHash } = JSON.parse(String(init?.body)) as { txHash: string };
        events.push({ kind: "receipt", intentId: receipt[1], txHash });
        return json(200, { data: { ok: true } });
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("is rebuilt before signing and sent to the Solana wallet", async () => {
    walletManager.attachWallet(solanaWallet(events));
    const reviewed = await buildRouteForReview(SOLANA_REQUEST);
    assert.equal(reviewed.result.txReq.to, SQUID_DEPOSIT_ADDRESS);

    const outcome = await sendReviewedRoute(reviewed, SOLANA);

    // Two builds: a Solana route is rebuilt for a fresh blockhash, which the
    // EVM path would have skipped.
    assert.deepEqual(
      events.map((e) => e.kind),
      ["build", "build", "sign", "receipt"]
    );
    assert.deepEqual(events[2], { kind: "sign", data: SQUID_REBUILT_DATA });
    assert.deepEqual(events[3], {
      kind: "receipt",
      intentId: "intent-squid",
      txHash: "solana-signature-1",
    });
    assert.equal(outcome.kind, "sent");
    if (outcome.kind !== "sent") return;
    assert.equal(outcome.hash, "solana-signature-1");
  });

  it("is rebuilt by the request's chain when the route names none", async () => {
    walletManager.attachWallet(solanaWallet(events));
    const reviewed = await buildRouteForReview(SOLANA_REQUEST);
    delete reviewed.result.txReq.chainId;

    await sendReviewedRoute(reviewed, SOLANA);

    assert.deepEqual(
      events.map((e) => e.kind),
      ["build", "build", "sign", "receipt"]
    );
    assert.deepEqual(events[2], { kind: "sign", data: SQUID_REBUILT_DATA });
  });

  it("with an EVM wallet connected, is refused before the wallet is asked", async () => {
    walletManager.attachWallet(evmWallet(events));
    const reviewed = await buildRouteForReview(SOLANA_REQUEST);

    await assert.rejects(
      sendReviewedRoute(reviewed, SOLANA),
      (error: Error) => {
        assert.equal(error.message, SOLANA_WALLET_REQUIRED);
        return true;
      }
    );
    assert.deepEqual(
      events.map((e) => e.kind),
      ["build", "build"],
      "nothing was signed or reported"
    );
  });
});

describe("mapError for a wallet that can't sign the route", () => {
  it("names the Solana wallet a Solana route needs", () => {
    assert.deepEqual(mapError(new Error(SOLANA_WALLET_REQUIRED)), {
      category: "transaction_failed",
      title: "Wrong Wallet",
      message:
        "This route is sent from Solana, so it needs a Solana wallet. Connect one and try again. Nothing was sent.",
    });
  });

  it("names the EVM wallet an EVM route needs", () => {
    assert.deepEqual(mapError(new Error(EVM_WALLET_REQUIRED)), {
      category: "transaction_failed",
      title: "Wrong Wallet",
      message:
        "This route is sent from an EVM chain, so it needs an EVM wallet. Connect one and try again. Nothing was sent.",
    });
  });

  it("pins the messages sendRouteTransaction throws", () => {
    assert.equal(
      EVM_WALLET_REQUIRED,
      "An EVM wallet is required for this route"
    );
    assert.equal(
      SOLANA_WALLET_REQUIRED,
      "A Solana wallet is required for this route"
    );
  });
});
