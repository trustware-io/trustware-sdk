import { strict as assert } from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";
import bs58 from "bs58";
import {
  Keypair,
  SystemProgram,
  Transaction,
  type VersionedTransaction,
} from "@solana/web3.js";
import { buildRoute } from "src/core/routes";
import { sendRouteTransaction } from "src/core/tx";
import { TrustwareConfigStore } from "src/config/store";
import { walletManager } from "src/wallets/";
import { toSolanaWalletInterface } from "src/wallets/solana";
import { SOLANA_MAINNET_CHAIN_KEY } from "src/utils/chains";
import type {
  BuildRouteResult,
  SolanaProviderLike,
  WalletInterFaceAPI,
} from "src/types";

// The staging failure of 2026-11-11: LiFi won SOL -> USDC (Base), its Solana
// transaction carried no chainId, the swap hook's fallback was undefined
// (Number("solana-mainnet-beta") is NaN), and the wallet filled in
// "solana-mainnet", a key the backend does not know. The blockhash check
// failed CHAIN_NOT_FOUND and nothing was sent.

const SOLANA_SENDER = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";
const EVM_RECIPIENT = "0x1111111111111111111111111111111111111111";
const realFetch = globalThis.fetch;

function json(payload: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function initConfig() {
  TrustwareConfigStore.init({
    apiKey: "test-key",
    routes: { toChain: 8453, toToken: "USDC" },
  });
}

describe("buildRoute gives a route's transaction its source chain", () => {
  const solanaToBase = {
    fromChain: SOLANA_MAINNET_CHAIN_KEY,
    toChain: "8453",
    fromToken: "11111111111111111111111111111111",
    toToken: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    fromAmount: "1199328",
    fromAddress: SOLANA_SENDER,
    toAddress: EVM_RECIPIENT,
  };

  function serve(transaction: Record<string, unknown>) {
    globalThis.fetch = (async () =>
      json(
        {
          data: {
            intentId: "intent-1",
            expiresAt: "2099-01-01T00:00:00Z",
            route: { provider: "lifi", execution: { transaction } },
          },
        },
        { Date: new Date().toUTCString() }
      )) as typeof fetch;
  }

  beforeEach(initConfig);
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  for (const [label, chainId] of [
    ["absent", undefined],
    ["empty", ""],
    ["blank", "   "],
    ["null", null],
  ] as const) {
    it(`fills a chainId that is ${label} with the request's fromChain`, async () => {
      serve(
        chainId === undefined ? { data: "AQID" } : { data: "AQID", chainId }
      );
      const built = await buildRoute(solanaToBase);
      assert.equal(built.txReq.chainId, SOLANA_MAINNET_CHAIN_KEY);
      assert.equal(
        built.route?.execution?.transaction?.chainId,
        SOLANA_MAINNET_CHAIN_KEY
      );
    });
  }

  it("keeps the chainId the route gave, number or string", async () => {
    for (const given of [SOLANA_MAINNET_CHAIN_KEY, 8453, "8453"]) {
      serve({ data: "AQID", chainId: given });
      const built = await buildRoute(solanaToBase);
      assert.equal(built.txReq.chainId, given);
    }
  });
});

describe("sendRouteTransaction sends a Solana route on the route's own chain", () => {
  let sentOn: Array<string | undefined>;

  function solanaWallet(): WalletInterFaceAPI {
    return {
      ecosystem: "solana",
      type: "solana",
      getAddress: async () => SOLANA_SENDER,
      sendSerializedTransaction: async (
        _data: string,
        chainId?: string,
        options?: { onAccepted?: (signature: string) => void }
      ) => {
        sentOn.push(chainId);
        options?.onAccepted?.("sig-1");
        return "sig-1";
      },
    } as unknown as WalletInterFaceAPI;
  }

  function build(txChainId: string | undefined): BuildRouteResult {
    return {
      intentId: "intent-1",
      txReq: {
        data: "AQID",
        ...(txChainId === undefined ? {} : { chainId: txChainId }),
      },
      actions: [],
      finalExchangeRate: {},
      expiresAt: new Date("2099-01-01T00:00:00Z"),
      serverClockOffsetMs: 0,
      route: { estimate: { fromAmount: "1199328", toAmount: "95250" } },
    } as BuildRouteResult;
  }

  beforeEach(() => {
    initConfig();
    sentOn = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/v1/routes/chains")) {
        return json({
          data: [
            {
              chainId: SOLANA_MAINNET_CHAIN_KEY,
              networkIdentifier: SOLANA_MAINNET_CHAIN_KEY,
              type: "solana",
              chainName: "Solana",
            },
            { chainId: "8453", type: "evm", chainName: "Base" },
          ],
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;
    walletManager.attachWallet(solanaWallet());
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  // Every fallback a caller has been seen to pass: none (the swap hook's
  // numericChainId for Solana), NaN (the deposit hook's Number(chainId)),
  // and the catalog's own key.
  for (const [label, fallback] of [
    ["no fallback", undefined],
    ["a NaN fallback", Number.NaN],
    ["the catalog key", SOLANA_MAINNET_CHAIN_KEY],
  ] as const) {
    it(`uses the transaction's chainId over ${label}`, async () => {
      await sendRouteTransaction(build(SOLANA_MAINNET_CHAIN_KEY), fallback);
      assert.deepEqual(sentOn, [SOLANA_MAINNET_CHAIN_KEY]);
    });
  }

  it("uses the caller's fallback when the transaction names no chain", async () => {
    await sendRouteTransaction(build(undefined), SOLANA_MAINNET_CHAIN_KEY);
    assert.deepEqual(sentOn, [SOLANA_MAINNET_CHAIN_KEY]);
  });
});

describe("a Solana wallet send with no chain id goes to the wallet's own chain", () => {
  beforeEach(initConfig);
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  for (const [label, chainId] of [
    ["left out", undefined],
    ["empty", ""],
    ["blank", "  "],
  ] as const) {
    it(`asks the proxy about ${SOLANA_MAINNET_CHAIN_KEY} when it is ${label}`, async () => {
      const payer = Keypair.generate();
      const blockhash = "GHtXQBsoZHVnNFa9YevAzFr17DJjgHXk3ycTKD5xD3Zi";
      const unsigned = new Transaction({
        feePayer: payer.publicKey,
        recentBlockhash: blockhash,
      })
        .add(
          SystemProgram.transfer({
            fromPubkey: payer.publicKey,
            toPubkey: payer.publicKey,
            lamports: 1,
          })
        )
        .serialize({ requireAllSignatures: false, verifySignatures: false });

      let signature = "";
      const provider: SolanaProviderLike = {
        publicKey: { toString: () => payer.publicKey.toBase58() },
        signTransaction: async (transaction) => {
          const tx = transaction as VersionedTransaction;
          tx.sign([payer]);
          signature = bs58.encode(tx.signatures[0]);
          const bytes = tx.serialize();
          return { serialize: () => bytes };
        },
      };

      const chainIdsAsked: string[] = [];
      globalThis.fetch = (async (
        input: RequestInfo | URL,
        init?: RequestInit
      ) => {
        const url = String(input);
        const reply = (data: unknown) => json({ success: true, data });
        if (url.endsWith("/v1/sdk/rpc/solana/send-serialized")) {
          chainIdsAsked.push(JSON.parse(String(init?.body)).chainId);
          return reply({ chainId: SOLANA_MAINNET_CHAIN_KEY, signature });
        }
        const query = new URL(url).searchParams;
        chainIdsAsked.push(String(query.get("chainId")));
        if (url.includes("/v1/sdk/rpc/solana/blockhash-valid?")) {
          return reply({
            chainId: SOLANA_MAINNET_CHAIN_KEY,
            blockhash,
            valid: true,
          });
        }
        if (url.includes("/v1/sdk/rpc/solana/tx-status?")) {
          return reply({
            chainId: SOLANA_MAINNET_CHAIN_KEY,
            signature,
            found: true,
            confirmed: true,
            status: "success",
          });
        }
        throw new Error(`Unexpected request: ${url}`);
      }) as typeof fetch;

      const wallet = toSolanaWalletInterface(provider);
      const sent = await wallet.sendSerializedTransaction(
        Buffer.from(unsigned).toString("base64"),
        chainId
      );

      assert.equal(sent, signature);
      assert.deepEqual(chainIdsAsked, [
        SOLANA_MAINNET_CHAIN_KEY,
        SOLANA_MAINNET_CHAIN_KEY,
        SOLANA_MAINNET_CHAIN_KEY,
      ]);
      assert.equal(await wallet.getChainKey(), SOLANA_MAINNET_CHAIN_KEY);
    });
  }
});
