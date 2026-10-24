import type { BuildRouteBody } from "src/core/routes";
import type { RouteEstimate, WalletInterFaceAPI } from "src/types";

// A stub routing backend and fake wallets that log builds and signs in one
// list, so a test can assert the order they happened in.

export const SOLANA = "solana-mainnet-beta";
export const SOL_OWNER = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";
export const EVM_OWNER = "0x1111111111111111111111111111111111111111";
export const BASE_RECIPIENT = "0x2222222222222222222222222222222222222222";
export const ROUTER = "0x3333333333333333333333333333333333333333";
export const USDC_SOLANA = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const USDC_BASE = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";

/** Distinct payloads, so a test can tell which transaction the wallet got. */
export const REVIEWED_SOLANA_TX = "UkVWSUVXRUQtdHg=";
export const REBUILT_SOLANA_TX = "UkVCVUlMVC10eA==";
export const REVIEWED_EVM_DATA = "0xaaaa";
export const REBUILT_EVM_DATA = "0xbbbb";

export const SOLANA_REQUEST: BuildRouteBody = {
  fromChain: SOLANA,
  toChain: "8453",
  fromToken: USDC_SOLANA,
  toToken: USDC_BASE,
  fromAmount: "1000000",
  fromAddress: SOL_OWNER,
  toAddress: BASE_RECIPIENT,
  slippage: 0.5,
};

export const EVM_REQUEST: BuildRouteBody = {
  fromChain: "8453",
  toChain: "42161",
  fromToken: USDC_BASE,
  toToken: USDC_BASE,
  fromAmount: "1000000",
  fromAddress: EVM_OWNER,
  toAddress: EVM_OWNER,
  slippage: 0.5,
};

/** 0.5% of 990000, rounded up, is the lowest toAmount the review allows. */
export const REVIEWED_ESTIMATE: RouteEstimate = {
  fromAmount: "1000000",
  toAmount: "990000",
  toAmountUsd: "0.99",
  totalFeesUsd: "0.01",
};
export const FLOOR_TO_AMOUNT = "985050";

export type Event =
  | { kind: "build"; body: Record<string, unknown> }
  | { kind: "sign"; data: string }
  | { kind: "receipt"; intentId: string; txHash: string };

export type RouteReply =
  | { status: 200; intentId: string; estimate: RouteEstimate; tx: TxShape }
  | { status: number; body: unknown };

export type TxShape = { solana: string } | { evm: string };

export function routeJson(
  intentId: string,
  estimate: RouteEstimate,
  tx: TxShape
) {
  const transaction =
    "solana" in tx
      ? { data: tx.solana, chainId: SOLANA }
      : { to: ROUTER, data: tx.evm, value: "0", chainId: "8453" };
  return {
    data: {
      intentId,
      route: { provider: "mayan", estimate, execution: { transaction } },
    },
  };
}

export function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Serves /v1/routes/route from a queue (one reply per build, in order) and
 * the chain list sendRouteTransaction resolves a Solana chain id from.
 * Every build lands in `events` beside the wallet's signs, so a test can
 * read the order they happened in.
 */
export function stubBackend(events: Event[], replies: RouteReply[]) {
  return async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const url = String(input);
    if (url.endsWith("/v1/routes/route")) {
      events.push({
        kind: "build",
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      });
      const reply = replies.shift();
      if (!reply) throw new Error(`Unexpected extra route build: ${url}`);
      if ("body" in reply) return json(reply.status, reply.body);
      return json(200, routeJson(reply.intentId, reply.estimate, reply.tx));
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
  };
}

export function solanaWallet(events: Event[]): WalletInterFaceAPI {
  return {
    ecosystem: "solana",
    type: "solana",
    getAddress: async () => SOL_OWNER,
    getChainKey: async () => SOLANA,
    sendSerializedTransaction: async (data: string) => {
      events.push({ kind: "sign", data });
      return "solana-signature-1";
    },
  } as unknown as WalletInterFaceAPI;
}

export function evmWallet(events: Event[]): WalletInterFaceAPI {
  return {
    ecosystem: "evm",
    type: "eip1193",
    getAddress: async () => EVM_OWNER,
    getChainId: async () => 8453,
    switchChain: async () => {},
    request: async (args: { method: string; params?: unknown[] }) => {
      if (args.method !== "eth_sendTransaction") {
        throw new Error(`Unexpected wallet request: ${args.method}`);
      }
      const tx = (args.params as Record<string, string>[])[0];
      events.push({ kind: "sign", data: tx.data });
      return `0x${"e".repeat(64)}`;
    },
  } as unknown as WalletInterFaceAPI;
}

export const reviewedSolanaReply: RouteReply = {
  status: 200,
  intentId: "intent-reviewed",
  estimate: REVIEWED_ESTIMATE,
  tx: { solana: REVIEWED_SOLANA_TX },
};

export function rebuiltSolanaReply(estimate: RouteEstimate): RouteReply {
  return {
    status: 200,
    intentId: "intent-rebuilt",
    estimate,
    tx: { solana: REBUILT_SOLANA_TX },
  };
}
