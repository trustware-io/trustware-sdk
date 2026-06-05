import { createLightAccountClient } from "@account-kit/smart-contracts"
import {
  WalletClientSigner,
  deepHexlify,
  resolveProperties,
  type ClientMiddlewareFn,
} from "@aa-sdk/core"
import { createWalletClient, custom, keccak256, stringToHex, type Chain } from "viem"
import { apiBase, jsonHeaders } from "../core/http"

const FETCH_TIMEOUT_MS = 30_000

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw Object.assign(new Error(`Request timed out after ${FETCH_TIMEOUT_MS / 1000}s: ${url}`), {
        code: "FETCH_TIMEOUT",
      })
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

// Map 4-byte selector → human-readable name for ClientPaymasterUpgradeable custom errors.
// These are thrown inside FailedOpWithRevert.inner which Account Kit cannot decode on its own.
const _sel = (sig: string) => keccak256(stringToHex(sig)).slice(0, 10).toLowerCase()
const PAYMASTER_ERROR_SELECTORS: Record<string, string> = {
  [_sel("InvalidCallDataHash()")]: "InvalidCallDataHash()",
  [_sel("NonceAlreadyUsed()")]:    "NonceAlreadyUsed()",
  [_sel("InvalidSigner()")]:       "InvalidSigner()",
  [_sel("MaxCostExceeded()")]:     "MaxCostExceeded()",
  [_sel("InvalidPaymasterData()")]: "InvalidPaymasterData()",
  [_sel("InvalidSender()")]:       "InvalidSender()",
  [_sel("InvalidChain()")]:        "InvalidChain()",
  [_sel("InvalidEntryPoint()")]:   "InvalidEntryPoint()",
  [_sel("InvalidPaymaster()")]:    "InvalidPaymaster()",
  [_sel("PaymasterPaused()")]:     "PaymasterPaused()",
  [_sel("NotEntryPoint()")]:       "NotEntryPoint()",
}

// Walks common locations Alchemy/bundlers put revert data and returns the first hex string found.
function extractRevertHex(err: { code?: number; message?: string; data?: unknown }): string | undefined {
  // Direct data field (string)
  if (typeof err.data === "string" && err.data.startsWith("0x")) return err.data
  // Nested data.revert (some Alchemy bundler versions)
  if (err.data && typeof err.data === "object") {
    const d = err.data as Record<string, unknown>
    if (typeof d.revert === "string" && d.revert.startsWith("0x")) return d.revert
    if (typeof d.data === "string" && d.data.startsWith("0x")) return d.data
  }
  // Hex embedded in message: "AA33 reverted: 0x..."
  if (typeof err.message === "string") {
    const m = err.message.match(/0x[0-9a-fA-F]+/)
    if (m) return m[0]
  }
  return undefined
}

function decodePaymasterRevert(revertHex: string): string | undefined {
  // 4-byte selector starts at index 2 (after "0x")
  if (revertHex.length < 10) return undefined
  const selector = revertHex.slice(0, 10).toLowerCase()
  return PAYMASTER_ERROR_SELECTORS[selector]
}

type Eip1193Request = (args: { method: string; params?: object | unknown[] }) => Promise<unknown>

// Minimal EVM bytecode: ignores calldata, returns ABI-encoded (bytes(""), uint256(0)).
// Used as a state override on the real paymaster address during eth_estimateUserOperationGas
// so the bundler can simulate without needing a real EIP-712 signature at estimation time.
// Opcodes: MSTORE(0,0x40) MSTORE(0x20,0) MSTORE(0x40,0) RETURN(0,0x60)
const ESTIMATION_OVERRIDE_BYTECODE =
  "0x60406000526000602052600060405260606000f3" as const

export async function createTrustwareSmartAccountClient(
  eoaAddress: `0x${string}`,
  chainId: number,
  viemChain: Chain,
  eip1193Request: Eip1193Request,
  paymasterAddress: `0x${string}`
) {
  let lastSponsorshipRequestId: string | undefined

  const walletClient = createWalletClient({
    account: eoaAddress,
    transport: custom({ request: eip1193Request }),
    chain: viemChain,
  })

  const signer = new WalletClientSigner(walletClient, "trustware-eip1193")

  // Proxies all Account Kit JSON-RPC methods through the Trustware backend.
  // The Alchemy API key never leaves the server.
  // For eth_estimateUserOperationGas, injects a state override that makes the
  // real paymaster always validate — the dummy paymasterData (all zeros) would
  // otherwise fail ECDSA verification and cause AA30/AA34 from the bundler.
  const bundlerTransport = custom({
    async request({
      method,
      params,
    }: {
      method: string
      params?: unknown
    }) {
      let forwardParams = params

      if (method === "eth_estimateUserOperationGas" && Array.isArray(params)) {
        const userOp = params[0] as Record<string, unknown> | undefined
        const paymasterInOp = (userOp?.paymaster as string | undefined)?.toLowerCase()
        if (
          paymasterInOp &&
          paymasterInOp !== "0x0000000000000000000000000000000000000000"
        ) {
          forwardParams = [
            params[0],
            params[1],
            { [paymasterAddress]: { code: ESTIMATION_OVERRIDE_BYTECODE } },
          ] as unknown as typeof params
        }
      }

      const resp = await fetchWithTimeout(`${apiBase()}/v1/bundler/send-user-operation`, {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({
          jsonrpc: "2.0",
          method,
          params: forwardParams,
          id: 1,
          chainId: String(chainId),
        }),
      })
      const j = (await resp.json()) as { result?: unknown; error?: { code?: number; message?: string; data?: unknown } }
      if (j.error) {
        const rawErr = j.error as { code?: number; message?: string; data?: unknown }
        const revertHex = extractRevertHex(rawErr)
        const decoded = revertHex ? decodePaymasterRevert(revertHex) : undefined

        const msg = decoded
          ? `Paymaster validation failed: ${decoded}`
          : rawErr.code === -32602
            ? `UserOp rejected: ${rawErr.message ?? "replacement underpriced"}`
            : (rawErr.message ?? String(j.error))

        throw Object.assign(new Error(msg), {
          code: rawErr.code,
          data: rawErr.data,
        })
      }
      return j.result
    },
  })

  // EP v0.7 dummy paymaster: uses the real paymaster address so the bundler
  // can verify it is deployed. The all-zero paymasterData is safe because the
  // state override above makes validatePaymasterUserOp always succeed during
  // gas estimation. The real signature is fetched by paymasterAndData below.
  //
  // paymasterPostOpGasLimit must match elros's defaultPostOpGasLimit (50,000 = 0xc350)
  // so that the gas limits in the submitted UserOp match what was estimated. If the
  // dummy and real values differ, some bundlers flag the change as a precheck failure.
  const dummyPaymasterAndData: ClientMiddlewareFn = async (struct) => {
    return {
      ...struct,
      paymaster: paymasterAddress,
      paymasterVerificationGasLimit: "0x186a0",
      paymasterPostOpGasLimit: "0xc350",
      paymasterData: `0x${"00".repeat(544)}`,
    } as typeof struct
  }

  const paymasterAndData: ClientMiddlewareFn = async (struct) => {
    type ResolvedUO = {
      sender?: string
      callData?: string
      callGasLimit?: string
      verificationGasLimit?: string
      preVerificationGas?: string
      paymasterVerificationGasLimit?: string
      paymasterPostOpGasLimit?: string
      maxFeePerGas?: string
    }
    const uo = deepHexlify(await resolveProperties(struct)) as ResolvedUO

    const totalGas =
      BigInt(uo.callGasLimit ?? "0x0") +
      BigInt(uo.verificationGasLimit ?? "0x0") +
      BigInt(uo.preVerificationGas ?? "0x0") +
      BigInt(uo.paymasterVerificationGasLimit ?? "0x0") +
      BigInt(uo.paymasterPostOpGasLimit ?? "0x0")

    // 2x buffer to accommodate maxFeePerGas variance between estimation and submission.
    // 1.3x proved too thin — a >30% gas spike between estimation and inclusion causes the
    // paymaster contract to revert with MaxCostExceeded, which bypasses the fee retry loop.
    const maxCostWei = totalGas * BigInt(uo.maxFeePerGas ?? "0x0") * 2n

    const resp = await fetchWithTimeout(`${apiBase()}/v1/paymaster/sponsor-calldata`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        chainId: String(chainId),
        sender: uo.sender ?? "",
        userOpCallData: uo.callData ?? "0x",
        maxCostWei: maxCostWei.toString(),
      }),
    })

    if (!resp.ok) {
      const j = await resp.json().catch(() => ({})) as { error?: string }
      // 404 = no deployment or rule for this chain/sender — non-retryable, SDK falls back to EOA.
      // 5xx = sign pipeline timeout or transient backend error — retryable by the send loop.
      const code = resp.status === 404 ? "NO_PAYMASTER" : "PAYMASTER_UNAVAILABLE"
      throw Object.assign(
        new Error(j?.error ?? `paymaster sponsor-calldata HTTP ${resp.status}`),
        { code }
      )
    }

    const j = (await resp.json()) as { data: { paymasterAndData: string; requestId?: string } }
    if (j.data.requestId) lastSponsorshipRequestId = j.data.requestId
    const blob = (j.data.paymasterAndData ?? "").replace(/^0x/, "")

    // 596 bytes minimum: 20 (paymaster) + 16 (verifGasLimit) + 16 (postOpGasLimit) + 544 (paymasterData)
    if (blob.length < 1192 || !/^[0-9a-fA-F]+$/.test(blob)) {
      throw Object.assign(
        new Error(
          `Invalid paymasterAndData from backend: expected ≥ 1192 hex chars, got ${blob.length}`
        ),
        { code: "PAYMASTER_RESPONSE_INVALID" }
      )
    }

    // Split the 596-byte backend blob into EP v0.7 separate paymaster fields:
    //   [0:40]   paymaster address (20 bytes)
    //   [40:72]  paymasterVerificationGasLimit (16 bytes)
    //   [72:104] paymasterPostOpGasLimit (16 bytes)
    //   [104:]   paymasterData (544 bytes — ECDSA sig + validity window)
    const splitFields = {
      paymaster: `0x${blob.slice(0, 40)}`,
      paymasterVerificationGasLimit: `0x${blob.slice(40, 72)}`,
      paymasterPostOpGasLimit: `0x${blob.slice(72, 104)}`,
      paymasterData: `0x${blob.slice(104)}`,
    }
    return {
      ...struct,
      ...splitFields,
    } as typeof struct
  }

  const client = await createLightAccountClient({
    transport: bundlerTransport,
    chain: viemChain,
    signer,
    dummyPaymasterAndData,
    paymasterAndData,
  })

  return {
    client,
    getSponsorshipRequestId: () => lastSponsorshipRequestId,
  }
}
