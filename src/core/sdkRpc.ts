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

export async function sendSolanaSerialized(body: {
  chainId: string;
  serializedTransaction: string;
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
