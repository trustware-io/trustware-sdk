import { createLightAccountClient } from "@account-kit/smart-contracts"
import {
  WalletClientSigner,
  deepHexlify,
  resolveProperties,
  type ClientMiddlewareFn,
} from "@aa-sdk/core"
import { createWalletClient, custom, type Chain } from "viem"
import { apiBase, jsonHeaders } from "../core/http"

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

      const resp = await fetch(`${apiBase()}/v1/bundler/send-user-operation`, {
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
      const j = (await resp.json()) as { result?: unknown; error?: { message?: string } }
      if (j.error) throw new Error(j.error.message ?? String(j.error))
      return j.result
    },
  })

  // EP v0.7 dummy paymaster: uses the real paymaster address so the bundler
  // can verify it is deployed. The all-zero paymasterData is safe because the
  // state override above makes validatePaymasterUserOp always succeed during
  // gas estimation. The real signature is fetched by paymasterAndData below.
  const dummyPaymasterAndData: ClientMiddlewareFn = async (struct) => {
    return {
      ...struct,
      paymaster: paymasterAddress,
      paymasterVerificationGasLimit: "0x186a0",
      paymasterPostOpGasLimit: "0x186a0",
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

    // 1.3x buffer to accommodate maxFeePerGas variance between estimation and submission
    const maxCostWei = (totalGas * BigInt(uo.maxFeePerGas ?? "0x0") * 13n) / 10n

    const resp = await fetch(`${apiBase()}/v1/paymaster/sponsor-calldata`, {
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
      throw Object.assign(
        new Error(j?.error ?? `paymaster sponsor-calldata HTTP ${resp.status}`),
        { code: "NO_PAYMASTER" }
      )
    }

    const j = (await resp.json()) as { data: { paymasterAndData: string } }
    const blob = (j.data.paymasterAndData ?? "").replace(/^0x/, "")

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
    console.debug(
      "[TW] paymasterAndData split",
      `blob=${blob.length}hex=${blob.length/2}bytes`,
      `paymaster=${splitFields.paymaster}`,
      `verifGasLimit=${splitFields.paymasterVerificationGasLimit}`,
      `postOpGasLimit=${splitFields.paymasterPostOpGasLimit}`,
      `paymasterData=${blob.length > 104 ? (blob.length - 104) / 2 : 0}bytes`,
    )
    return {
      ...struct,
      ...splitFields,
    } as typeof struct
  }

  return createLightAccountClient({
    transport: bundlerTransport,
    chain: viemChain,
    signer,
    dummyPaymasterAndData,
    paymasterAndData,
  })
}
