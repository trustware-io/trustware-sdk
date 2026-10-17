import { apiBase, jsonHeaders, rateLimitedFetch } from "./http";

type SDKRPCErrorPayload = {
  code?: string;
  message?: string;
  context?: Record<string, unknown>;
};

type SDKRPCEnvelope<T> = {
  success?: boolean;
  data?: T;
  error?: SDKRPCErrorPayload;
};

export class SDKRPCError extends Error {
  code?: string;
  context?: Record<string, unknown>;
  status?: number;

  constructor(
    message: string,
    options?: {
      code?: string;
      context?: Record<string, unknown>;
      status?: number;
    }
  ) {
    super(message);
    this.name = "SDKRPCError";
    this.code = options?.code;
    this.context = options?.context;
    this.status = options?.status;
  }
}

async function requestSDKRPC<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await rateLimitedFetch(`${apiBase()}/v1/sdk/rpc${path}`, {
    ...init,
    headers: jsonHeaders(),
  });

  let payload: SDKRPCEnvelope<T> | null = null;
  try {
    payload = (await response.json()) as SDKRPCEnvelope<T>;
  } catch {
    payload = null;
  }

  if (response.ok && payload?.success && payload.data !== undefined) {
    return payload.data;
  }

  throw new SDKRPCError(
    payload?.error?.message ||
      `HTTP ${response.status}: ${response.statusText || "SDK RPC request failed"}`,
    {
      code: payload?.error?.code,
      context: payload?.error?.context,
      status: response.status,
    }
  );
}

export type EVMAllowanceResponse = {
  chainId: string;
  tokenAddress: string;
  ownerAddress: string;
  spenderAddress: string;
  allowance: string;
  rpcHost?: string;
};

export type EVMTxStatusResponse = {
  chainId: string;
  txHash: string;
  found: boolean;
  confirmed: boolean;
  status: "pending" | "success" | "reverted" | "not_found";
  blockNumber?: string;
  gasUsed?: string;
  effectiveGasPrice?: string;
  confirmations?: string;
  rpcHost?: string;
};

export type EVMFeeDataResponse = {
  chainId: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  supportsEip1559?: boolean;
  rpcHost?: string;
};

export type EVMEstimateGasResponse = {
  chainId: string;
  gasLimit: string;
  rpcHost?: string;
};

export type SolanaSendSerializedResponse = {
  chainId: string;
  signature: string;
  rpcHost?: string;
};

export type SolanaTxStatusResponse = {
  chainId: string;
  signature: string;
  found: boolean;
  confirmed: boolean;
  status: "pending" | "success" | "failed" | "not_found";
  slot?: number;
  err?: unknown;
  rpcHost?: string;
};

export async function getEVMAllowance(params: {
  chainId: string;
  tokenAddress: string;
  ownerAddress: string;
  spenderAddress: string;
}) {
  const search = new URLSearchParams(params);
  return requestSDKRPC<EVMAllowanceResponse>(
    `/evm/allowance?${search.toString()}`,
    { method: "GET" }
  );
}

export async function getEVMTxStatus(params: {
  chainId: string;
  txHash: string;
}) {
  const search = new URLSearchParams(params);
  return requestSDKRPC<EVMTxStatusResponse>(
    `/evm/tx-status?${search.toString()}`,
    { method: "GET" }
  );
}

export async function getEVMFeeData(params: { chainId: string }) {
  const search = new URLSearchParams(params);
  return requestSDKRPC<EVMFeeDataResponse>(
    `/evm/fee-data?${search.toString()}`,
    { method: "GET" }
  );
}

export async function estimateEVMGas(body: {
  chainId: string;
  fromAddress: string;
  to: string;
  data: string;
  value: string;
}) {
  return requestSDKRPC<EVMEstimateGasResponse>("/evm/estimate-gas", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * The `send-serialized` error code for a transaction the cluster has
 * already processed. On a rebroadcast that means an earlier send landed, so
 * it isn't a failure. Only `isSolanaAlreadyProcessed` reads it.
 */
export const SOLANA_ALREADY_PROCESSED_CODE = "ALREADY_PROCESSED";

export function isSolanaAlreadyProcessed(err: unknown): boolean {
  return (
    err instanceof SDKRPCError && err.code === SOLANA_ALREADY_PROCESSED_CODE
  );
}

/** `skipPreflight` is required so every caller chooses: the first send of a
 *  transaction preflights, its rebroadcasts don't. */
export async function sendSolanaSerialized(body: {
  chainId: string;
  serializedTransaction: string;
  skipPreflight: boolean;
}) {
  return requestSDKRPC<SolanaSendSerializedResponse>(
    "/solana/send-serialized",
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );
}

export async function getSolanaTxStatus(params: {
  chainId: string;
  signature: string;
}) {
  const search = new URLSearchParams(params);
  return requestSDKRPC<SolanaTxStatusResponse>(
    `/solana/tx-status?${search.toString()}`,
    { method: "GET" }
  );
}

/** Whether a blockhash can still be used, by `isBlockhashValid` at
 *  `processed`. */
export async function getSolanaBlockhashValid(params: {
  blockhash: string;
}): Promise<boolean> {
  const search = new URLSearchParams(params);
  const data = await requestSDKRPC<{ valid?: unknown }>(
    `/solana/blockhash-valid?${search.toString()}`,
    { method: "GET" }
  );
  if (typeof data.valid !== "boolean") {
    throw new SDKRPCError(
      `blockhash-valid answered without a boolean "valid" (got ${JSON.stringify(data)}).`
    );
  }
  return data.valid;
}
