import type { BuildRouteResult, RouteSponsorship } from "../types";
import type { ChainDef } from "../types";
import { walletManager } from "../wallets/";
import {
  buildRoute,
  submitReceipt,
  pollStatus,
  isEvmTxRequest,
  isSerializedSolanaTxRequest,
  type TxRequest,
} from "./routes";
import { apiBase, jsonHeaders } from "./http";
import {
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
  encodeFunctionData,
  toHex,
} from "viem";

function backendChainId(chain?: ChainDef, fallback?: number | string): string {
  const preferred = chain?.networkIdentifier ?? chain?.chainId ?? chain?.id;
  return String(preferred ?? fallback ?? "");
}

function isUserRejected(e: unknown): boolean {
  const code =
    (e as Record<string, unknown>)?.code ??
    ((e as Record<string, Record<string, unknown>>)?.data?.code as number);
  if (code === 4001) return true;
  const msg = String((e as Error)?.message || e)?.toLowerCase?.() || "";
  return msg.includes("user rejected") || msg.includes("user denied");
}

// Packs two uint128 values into a bytes32 (big-endian, hi in upper 16 bytes).
function packUint128Pair(hi: bigint, lo: bigint): `0x${string}` {
  return `0x${hi.toString(16).padStart(32, "0")}${lo.toString(16).padStart(32, "0")}` as `0x${string}`;
}

// Builds a signed ERC-4337 v0.7/v0.8 PackedUserOperation and submits it through
// the Trustware backend bundler proxy (Alchemy API key stays server-side).
async function sendAsUserOperation(
  request: (args: {
    method: string;
    params?: unknown[] | object;
  }) => Promise<unknown>,
  txReq: TxRequest,
  sponsorship: RouteSponsorship,
  from: `0x${string}`,
  chainId: number
): Promise<string> {
  const sender = sponsorship.approval.sender as `0x${string}`;
  const entryPoint = sponsorship.entryPoint as `0x${string}`;

  // Fetch nonce from EntryPoint: getNonce(address sender, uint192 key)
  const nonceCalldata = encodeFunctionData({
    abi: [
      {
        name: "getNonce",
        type: "function",
        stateMutability: "view",
        inputs: [
          { name: "sender", type: "address" },
          { name: "key", type: "uint192" },
        ],
        outputs: [{ name: "", type: "uint256" }],
      },
    ],
    functionName: "getNonce",
    args: [sender, 0n],
  });

  const nonceResult = (await request({
    method: "eth_call",
    params: [{ to: entryPoint, data: nonceCalldata }, "latest"],
  })) as `0x${string}`;
  const nonce = BigInt(nonceResult || "0x0");

  const callData = txReq.data as `0x${string}`;
  const paymasterData = sponsorship.paymasterAndData as `0x${string}`;
  const callGasLimit = txReq.gasLimit ? BigInt(txReq.gasLimit) : 0x100000n;
  const verificationGasLimit = 0x100000n;
  const preVerificationGas = 0x10000n;
  const maxFeePerGas = txReq.maxFeePerGas
    ? BigInt(txReq.maxFeePerGas)
    : txReq.gasPrice
      ? BigInt(txReq.gasPrice)
      : 0n;
  const maxPriorityFeePerGas = txReq.maxPriorityFeePerGas
    ? BigInt(txReq.maxPriorityFeePerGas)
    : 0n;

  // v0.7/v0.8 PackedUserOperation packs gas fields into bytes32 pairs.
  // accountGasLimits = verificationGasLimit (upper 128 bits) | callGasLimit (lower 128 bits)
  // gasFees          = maxPriorityFeePerGas (upper 128 bits) | maxFeePerGas  (lower 128 bits)
  const accountGasLimits = packUint128Pair(verificationGasLimit, callGasLimit);
  const gasFees = packUint128Pair(maxPriorityFeePerGas, maxFeePerGas);

  // v0.7/v0.8 UserOp hash: keccak256(abi.encode(keccak256(pack(userOp)), entryPoint, chainId))
  // pack() = abi.encode(sender, nonce, keccak256(initCode), keccak256(callData),
  //                     accountGasLimits, preVerificationGas, gasFees, keccak256(paymasterAndData))
  const packHash = keccak256(
    encodeAbiParameters(
      parseAbiParameters(
        "address, uint256, bytes32, bytes32, bytes32, uint256, bytes32, bytes32"
      ),
      [
        sender,
        nonce,
        keccak256("0x" as `0x${string}`), // initCode = 0x (account already deployed)
        keccak256(callData),
        accountGasLimits,
        preVerificationGas,
        gasFees,
        keccak256(paymasterData),
      ]
    )
  );

  const userOpHash = keccak256(
    encodeAbiParameters(parseAbiParameters("bytes32, address, uint256"), [
      packHash,
      entryPoint,
      BigInt(chainId),
    ])
  );

  const signature = (await request({
    method: "personal_sign",
    params: [userOpHash, from],
  })) as `0x${string}`;

  // Alchemy's bundler API uses the expanded (unpacked) wire format even for v0.7/v0.8.
  // Split paymasterAndData: paymaster(20b) + verifGasLimit(16b) + postOpGasLimit(16b) + data(rest)
  const pmdHex = paymasterData.slice(2);
  const paymasterAddr = `0x${pmdHex.slice(0, 40)}`;
  const paymasterVerificationGasLimit = `0x${pmdHex.slice(40, 72)}`;
  const paymasterPostOpGasLimit = `0x${pmdHex.slice(72, 104)}`;
  const paymasterInnerData = `0x${pmdHex.slice(104)}`;

  const userOp = {
    sender,
    nonce: toHex(nonce),
    callData,
    callGasLimit: toHex(callGasLimit),
    verificationGasLimit: toHex(verificationGasLimit),
    preVerificationGas: toHex(preVerificationGas),
    maxFeePerGas: toHex(maxFeePerGas),
    maxPriorityFeePerGas: toHex(maxPriorityFeePerGas),
    paymaster: paymasterAddr,
    paymasterVerificationGasLimit,
    paymasterPostOpGasLimit,
    paymasterData: paymasterInnerData,
    signature,
  };

  // Submit via the Trustware backend bundler proxy — Alchemy API key stays server-side.
  const resp = await fetch(`${apiBase()}/v1/bundler/send-user-operation`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({
      userOp,
      chainId: String(chainId),
      entryPoint,
    }),
  });
  if (!resp.ok) {
    let msg = `Bundler proxy HTTP ${resp.status}`;
    try {
      const j = await resp.json();
      if (j?.error?.message) msg = j.error.message;
      else if (j?.error) msg = String(j.error);
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  const j = await resp.json();
  const hash = j?.data?.userOpHash as string | undefined;
  if (!hash) throw new Error("Bundler proxy returned no userOpHash");
  return hash;
}

export async function sendRouteTransaction(
  b: BuildRouteResult,
  fallbackChainId?: number | string
): Promise<string> {
  const w = walletManager.wallet;
  if (!w) throw new Error("Trustware.wallet not configured");

  const txReq = b.txReq;
  if (isEvmTxRequest(txReq)) {
    if (w.ecosystem !== "evm") {
      throw new Error("An EVM wallet is required for this route");
    }

    const to = (txReq.to ?? txReq.target) as `0x${string}`;
    const data = txReq.data as `0x${string}`;
    const value = txReq.value ? BigInt(txReq.value) : 0n;
    const target = Number(txReq.chainId ?? fallbackChainId);

    // Validate sponsorship calldata hash. The backend signs
    // keccak256(route.execution.transaction.data) — if wrapping occurs the
    // paymaster contract will revert on-chain, so we never skip this check.
    let validatedSponsorship: RouteSponsorship | undefined;
    if (b.sponsorship) {
      if (keccak256(data) === b.sponsorship.callDataHash) {
        validatedSponsorship = b.sponsorship;
      } else {
        console.warn(
          "Trustware: sponsorship calldata hash mismatch — sending without paymaster"
        );
      }
    }

    if (Number.isFinite(target)) {
      const current = await w.getChainId();
      if (current !== target) {
        try {
          await w.switchChain(target);
        } catch {
          // switchChain failed/skipped — non-fatal
        }
      }
    }

    if (w.type === "eip1193") {
      const from = (await w.getAddress()) as `0x${string}`;

      // When sponsorship is valid, attempt ERC-4337 UserOp submission so the
      // paymaster can cover gas. Falls back to a plain eth_sendTransaction if
      // the wallet/bundler doesn't support eth_sendUserOperation.
      if (validatedSponsorship && Number.isFinite(target)) {
        try {
          return await sendAsUserOperation(
            (args) => w.request(args),
            txReq,
            validatedSponsorship,
            from,
            target
          );
        } catch (e) {
          if (isUserRejected(e)) throw e;
          // Bundler / method-not-found — fall through to regular tx
        }
      }

      const hexValue = value ? `0x${value.toString(16)}` : "0x0";
      const params: Record<string, unknown> = { from, to, data, value: hexValue };
      if (Number.isFinite(target)) {
        params.chainId = `0x${target.toString(16)}`;
      }
      const hash = await w.request({
        method: "eth_sendTransaction",
        params: [params],
      });
      return hash as string;
    }

    // wagmi path — Account Kit wallets pick up paymasterAndData on sendTransaction
    const response = await w.sendTransaction({
      to,
      data,
      value,
      chainId: Number.isFinite(target) ? target : undefined,
      ...(validatedSponsorship
        ? {
            paymasterAndData:
              validatedSponsorship.paymasterAndData as `0x${string}`,
          }
        : {}),
    });
    return response.hash as string;
  }

  if (isSerializedSolanaTxRequest(txReq)) {
    if (w.ecosystem !== "solana") {
      throw new Error("A Solana wallet is required for this route");
    }

    const { Registry } = await import("../registry");
    const { apiBase } = await import("./http");
    const registry = new Registry(apiBase());
    await registry.ensureLoaded();

    const chain = registry.chain(
      String(fallbackChainId ?? txReq.chainId ?? "")
    );
    return w.sendSerializedTransaction(
      txReq.data,
      backendChainId(chain, fallbackChainId ?? txReq.chainId)
    );
  }

  throw new Error("Invalid route transaction payload");
}

export async function runTopUp(params: {
  fromChain?: string;
  toChain?: string;
  fromToken?: string;
  toToken?: string;
  toAddress?: string;
  fromAmount: string | number;
}) {
  const w = walletManager.wallet;
  if (!w) throw new Error("Trustware.wallet not configured");

  const { Registry } = await import("../registry");
  const { apiBase } = await import("./http");

  const reg = new Registry(apiBase());
  await reg.ensureLoaded();

  const fromAddress = await w.getAddress();
  const currentChainRef =
    w.ecosystem === "evm"
      ? String(await w.getChainId())
      : ((await w.getChainKey?.()) ?? "solana-mainnet-beta");
  const originalChain =
    w.ecosystem === "evm" ? await w.getChainId() : undefined;

  const fromChain = params.fromChain ?? currentChainRef;

  const { TrustwareConfigStore } = await import("../config/store");
  const cfg = TrustwareConfigStore.get();
  const toChain = params.toChain ?? String(cfg.routes.toChain);

  const fromToken =
    reg.resolveToken(
      fromChain,
      params.fromToken ?? (cfg.routes.fromToken as string) ?? undefined
    ) ?? params.fromToken;
  const toToken =
    reg.resolveToken(
      toChain,
      params.toToken ?? (cfg.routes.toToken as string) ?? undefined
    ) ?? params.toToken;

  if (!fromToken || !toToken) {
    throw new Error("Unable to resolve route tokens");
  }

  try {
    const build = await buildRoute({
      fromChain,
      toChain,
      fromToken,
      toToken,
      fromAmount: String(params.fromAmount),
      fromAddress,
      toAddress:
        params.toAddress ??
        cfg.routes.toAddress ??
        (cfg.routes.fromAddress as string | undefined) ??
        fromAddress,
      slippage: cfg.routes.defaultSlippage,
    });

    const hash = await sendRouteTransaction(build, fromChain);
    await submitReceipt(build.intentId, hash);
    return await pollStatus(build.intentId);
  } catch (e: unknown) {
    if (isUserRejected(e)) throw new Error("Transaction cancelled by user");
    throw e;
  } finally {
    try {
      if (
        w.ecosystem === "evm" &&
        originalChain &&
        originalChain !== Number(fromChain)
      ) {
        await w.switchChain(originalChain);
      }
    } catch {
      // switch back skipped — non-fatal
    }
  }
}
