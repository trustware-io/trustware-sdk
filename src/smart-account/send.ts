import type { Chain } from "viem"
import { submitReceipt } from "../core/routes"
import type { BuildRouteResult } from "../types"
import { createTrustwareSmartAccountClient } from "./client"
import {
  PERMIT2,
  randomPermit2Nonce,
  signPermit2,
  encodePermitTransferFrom,
  encodeErc20Approve,
  encodeErc20Allowance,
  encodeErc20BalanceOf,
  encodeWethWithdraw,
} from "./permit2"

const NATIVE_ADDRS = new Set([
  "0x0000000000000000000000000000000000000000",
  "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
])

// Canonical WETH9 address per chain. OP Stack chains share the same address.
const WETH_BY_CHAIN: Record<number, `0x${string}`> = {
  1:     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // Ethereum
  8453:  "0x4200000000000000000000000000000000000006", // Base
  10:    "0x4200000000000000000000000000000000000006", // Optimism
  42161: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", // Arbitrum One
  137:   "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", // Polygon (WETH)
  43114: "0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB", // Avalanche (WETH.e)
}

function isNativeToken(addr: string): boolean {
  return NATIVE_ADDRS.has(addr.toLowerCase())
}

type Eip1193Request = (args: { method: string; params?: object | unknown[] }) => Promise<unknown>

// Permits Permit2 to pull `token` from `owner` up to max uint256 if the current
// allowance is below `requiredAmount`. Sends a regular EOA transaction (not a
// UserOp — the SA cannot sign on behalf of the EOA) and waits for confirmation.
async function ensurePermit2Allowance(
  eip1193Request: Eip1193Request,
  owner: `0x${string}`,
  token: `0x${string}`,
  requiredAmount: bigint | string
): Promise<void> {
  const required = BigInt(requiredAmount as string | bigint)

  const allowanceCalldata = encodeErc20Allowance(owner, PERMIT2)
  const raw = await eip1193Request({
    method: "eth_call",
    params: [{ to: token, data: allowanceCalldata }, "latest"],
  }) as string

  const currentAllowance = raw && raw !== "0x" ? BigInt(raw) : 0n
  console.debug("[send] PERMIT2 allowance", { token, currentAllowance: currentAllowance.toString(), required: required.toString() })
  if (currentAllowance >= required) return

  console.debug("[send] requesting PERMIT2 max approval from EOA", { owner, token })
  const approveCalldata = encodeErc20Approve(
    PERMIT2,
    BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")
  )
  const txHash = await eip1193Request({
    method: "eth_sendTransaction",
    params: [{ from: owner, to: token, data: approveCalldata }],
  }) as string

  console.debug("[send] waiting for PERMIT2 approval tx", { txHash })
  await waitForTransaction(eip1193Request, txHash)
  console.debug("[send] PERMIT2 approval confirmed", { txHash })
}

// Ensures the SA has at least `requiredWei` of native ETH. If not, sends the
// deficit from `owner` (EOA) to `saAddress` as a regular transaction and waits
// for confirmation. Used as a fallback when the EOA has no WETH to pull via
// Permit2 but does have native ETH.
async function ensureSaEthBalance(
  eip1193Request: Eip1193Request,
  saAddress: `0x${string}`,
  owner: `0x${string}`,
  requiredWei: bigint
): Promise<void> {
  const balHex = await eip1193Request({
    method: "eth_getBalance",
    params: [saAddress, "latest"],
  }) as string
  const currentBal = BigInt(balHex)
  console.debug("[send] SA ETH balance", { saAddress, currentBal: currentBal.toString(), required: requiredWei.toString() })
  if (currentBal >= requiredWei) return

  const needed = requiredWei - currentBal
  console.debug("[send] funding SA with ETH for bridge relay fee", { saAddress, needed: "0x" + needed.toString(16) })
  const txHash = await eip1193Request({
    method: "eth_sendTransaction",
    params: [{ from: owner, to: saAddress, value: "0x" + needed.toString(16) }],
  }) as string
  console.debug("[send] waiting for SA ETH funding tx", { txHash })
  await waitForTransaction(eip1193Request, txHash)
  console.debug("[send] SA ETH funding confirmed", { txHash })
}

async function waitForTransaction(
  eip1193Request: Eip1193Request,
  txHash: string,
  timeoutMs = 120_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const receipt = await eip1193Request({
      method: "eth_getTransactionReceipt",
      params: [txHash],
    }) as { status?: string } | null
    if (receipt !== null) {
      if (receipt.status === "0x0") throw new Error(`Approval transaction reverted: ${txHash}`)
      return
    }
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
  throw new Error(`Approval transaction confirmation timeout: ${txHash}`)
}

export type SendRouteAsUserOperationParams = {
  route: BuildRouteResult
  fromToken: string
  fromAmountWei: bigint
  eoaAddress: `0x${string}`
  chainId: number
  viemChain: Chain
  eip1193Request: Eip1193Request
}

export type SendRouteAsUserOperationResult = {
  userOpHash: string
  intentId: string
}

export async function sendRouteAsUserOperation(
  params: SendRouteAsUserOperationParams
): Promise<SendRouteAsUserOperationResult> {
  const { route, fromToken, fromAmountWei, chainId, viemChain, eip1193Request } = params
  const { txReq, intentId } = route

  const target = ((txReq.to ?? txReq.target) as `0x${string}` | undefined)
  if (!txReq?.data || !target) {
    throw new Error("Route is missing transaction data or target address")
  }

  const callData = txReq.data as `0x${string}`
  const value = txReq.value ? BigInt(txReq.value) : 0n

  const paymasterAddress = (route.sponsorship?.paymaster ?? "") as `0x${string}`
  if (!paymasterAddress) throw new Error("Route sponsorship is missing paymaster address")

  // Derive the EOA from the wallet provider rather than trusting the caller's
  // walletAddress — it may be stale if the user switched accounts after connect.
  // All signing, SA derivation, and Permit2 owner must use the same key.
  const walletAccounts = await eip1193Request({ method: "eth_accounts" }) as string[]
  if (!walletAccounts?.[0]) throw new Error("No connected wallet account available")
  const eoaAddress = walletAccounts[0].toLowerCase() as `0x${string}`

  const walletChainHex = await eip1193Request({ method: "eth_chainId" }) as string
  const walletChainId = parseInt(walletChainHex, 16)
  if (walletChainId !== chainId) {
    throw Object.assign(
      new Error(`Wrong network: wallet is on chain ${walletChainId}, route requires chain ${chainId}. Switch your wallet to the correct network and try again.`),
      { code: "WRONG_CHAIN", walletChainId, requiredChainId: chainId }
    )
  }

  const client = await createTrustwareSmartAccountClient(eoaAddress, chainId, viemChain, eip1193Request, paymasterAddress)
  const saAddress = client.account.address
  console.debug("[send] saAddress:", saAddress, "eoaAddress:", eoaAddress)

  type BatchCall = { target: `0x${string}`; data: `0x${string}`; value?: bigint }
  let batch: BatchCall[]

  if (isNativeToken(fromToken)) {
    // Native token route: no Permit2 needed. Pass value directly.
    batch = [{ target, data: callData, value }]
  } else {
    // ERC-20 route: pull tokens from EOA via Permit2 SignatureTransfer, then execute.
    const token = fromToken as `0x${string}`

    // Ensure EOA has approved Permit2 to pull the fromToken. One-time regular
    // EOA transaction — the SA cannot approve on the EOA's behalf.
    await ensurePermit2Allowance(eip1193Request, eoaAddress, token, fromAmountWei)

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800) // 30-minute window

    const nonce = randomPermit2Nonce()
    console.debug("[send] permit2 params", {
      token,
      amount: "0x" + BigInt(fromAmountWei as string | bigint).toString(16),
      nonce: "0x" + nonce.toString(16),
      deadline: "0x" + deadline.toString(16),
      spender: saAddress,
      owner: eoaAddress,
    })

    const sig = await signPermit2(eip1193Request, {
      chainId,
      token,
      amount: fromAmountWei,
      spender: saAddress,
      nonce,
      deadline,
      owner: eoaAddress,
    })

    const permitCalldata = encodePermitTransferFrom(
      token,
      fromAmountWei,
      nonce,
      deadline,
      saAddress,
      eoaAddress,
      sig
    )
    const approveCalldata = encodeErc20Approve(target, fromAmountWei)

    batch = [
      { target: PERMIT2, data: permitCalldata }, // pull fromToken: EOA → SA
      { target: token, data: approveCalldata },   // SA approves bridge router to spend
    ]

    if (value > 0n) {
      // Route requires native ETH forwarded as msg.value (e.g. Axelar bridge relay fee).
      // Prefer pulling WETH from the EOA via Permit2 + withdraw atomically in the UserOp
      // (no extra EOA transaction). Fall back to a plain ETH send from EOA to SA when the
      // EOA holds native ETH but no WETH.
      const weth = WETH_BY_CHAIN[chainId]
      const wethBalance = weth ? await (async () => {
        const raw = await eip1193Request({
          method: "eth_call",
          params: [{ to: weth, data: encodeErc20BalanceOf(eoaAddress) }, "latest"],
        }) as string
        return raw && raw !== "0x" ? BigInt(raw) : 0n
      })() : 0n

      console.debug("[send] relay fee strategy", {
        value: value.toString(),
        weth,
        wethBalance: wethBalance.toString(),
        useWethPull: wethBalance >= value,
      })

      if (weth && wethBalance >= value) {
        // EOA has WETH: pull it via Permit2 and unwrap inside the UserOp.
        await ensurePermit2Allowance(eip1193Request, eoaAddress, weth, value)

        const wethNonce = randomPermit2Nonce()
        console.debug("[send] weth permit2 params (relay fee)", {
          token: weth,
          amount: "0x" + value.toString(16),
          nonce: "0x" + wethNonce.toString(16),
          deadline: "0x" + deadline.toString(16),
          spender: saAddress,
          owner: eoaAddress,
        })

        const wethSig = await signPermit2(eip1193Request, {
          chainId,
          token: weth,
          amount: value,
          spender: saAddress,
          nonce: wethNonce,
          deadline,
          owner: eoaAddress,
        })

        batch.push(
          { target: PERMIT2, data: encodePermitTransferFrom(weth, value, wethNonce, deadline, saAddress, eoaAddress, wethSig) }, // pull WETH: EOA → SA
          { target: weth, data: encodeWethWithdraw(value) },  // WETH.withdraw: WETH → ETH
        )
      } else {
        // EOA has no WETH (or unknown chain): send native ETH from EOA to SA before
        // the UserOp so the SA can forward it as msg.value to the bridge.
        await ensureSaEthBalance(eip1193Request, saAddress, eoaAddress, value)
      }
    }

    batch.push({ target, data: callData, value }) // bridge execution
  }

  const result = await client.sendUserOperation({ uo: batch })

  // Record the txHash with the backend so status polling starts immediately.
  await submitReceipt(intentId, result.hash)

  return { userOpHash: result.hash, intentId }
}
