import { encodeFunctionData } from "viem"
import { apiBase, jsonHeaders } from "../core/http"

// Canonical WETH9 address per chain. OP Stack chains share the same address.
export const WETH_BY_CHAIN: Record<number, `0x${string}`> = {
  1:     "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // Ethereum
  8453:  "0x4200000000000000000000000000000000000006", // Base
  10:    "0x4200000000000000000000000000000000000006", // Optimism
  42161: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", // Arbitrum One
  137:   "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", // Polygon (WETH)
  43114: "0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB", // Avalanche (WETH.e)
}

// Uniswap V3 SwapRouter02 addresses. Base has a distinct address from the other chains.
export const UNISWAP_V3_ROUTER: Record<number, `0x${string}`> = {
  1:     "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45", // Ethereum
  8453:  "0x2626664c2603336E57B271c5C0b26F421741e481", // Base
  10:    "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45", // Optimism
  42161: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45", // Arbitrum One
  137:   "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45", // Polygon
  43114: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45", // Avalanche
}

// Default pool fee tier (0.3%). Use 500 (0.05%) for stable/ETH pairs if known
// to have deeper liquidity, but 3000 is the safest cross-chain default.
export const DEFAULT_POOL_FEE = 3000 as const

const SWAP_ROUTER_ABI = [
  {
    name: "exactOutputSingle",
    type: "function",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn",          type: "address" },
          { name: "tokenOut",         type: "address" },
          { name: "fee",              type: "uint24"  },
          { name: "recipient",        type: "address" },
          { name: "amountOut",        type: "uint256" },
          { name: "amountInMaximum",  type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [{ name: "amountIn", type: "uint256" }],
    stateMutability: "payable",
  },
] as const

// Encodes a Uniswap V3 SwapRouter02 exactOutputSingle call.
// The router pulls at most amountInMaximum of tokenIn from the caller and
// delivers exactly amountOut of tokenOut to recipient. Unused allowance is
// not consumed — no sweepToken needed for ERC-20 inputs.
export function encodeUniswapExactOutputSingle(
  tokenIn:         `0x${string}`,
  tokenOut:        `0x${string}`,
  fee:             number,
  recipient:       `0x${string}`,
  amountOut:       bigint,
  amountInMaximum: bigint
): `0x${string}` {
  return encodeFunctionData({
    abi: SWAP_ROUTER_ABI,
    functionName: "exactOutputSingle",
    args: [{
      tokenIn,
      tokenOut,
      fee,
      recipient,
      amountOut,
      amountInMaximum,
      sqrtPriceLimitX96: 0n,
    }],
  })
}

// Fetches the current native token (ETH) price from the Trustware backend and returns
// the maximum from-token amount needed to cover valueWei of relay fee (25% buffer).
//
// Primary path:   uses fromAmountUSD from the route estimate (no extra request needed).
// Fallback path:  when fromAmountUSD is absent, fetches the from-token price from
//                 the backend using the token contract address and decimals.
//
// Formula: amountInMaximum = (valueWei / 1e18 * ethPriceUSD) * (tokenUnitsPerDollar) * 1.25
//
// Returns 0n if price data is unavailable, which the caller should treat as an error.
export async function estimateRelayFeeInToken(
  valueWei:      bigint,
  fromAmountWei: bigint,
  fromAmountUSD: string | undefined,
  chainId?:      number,
  fromToken?:    string,
  fromDecimals?: number,
): Promise<bigint> {
  if (fromAmountWei === 0n || valueWei === 0n) return 0n

  const cid = chainId ?? 8453

  // Determine token units per dollar — either from the route estimate or by
  // fetching the token price directly from the backend.
  let tokenUnitsPerDollar: number

  const fromUSD = parseFloat(fromAmountUSD ?? "")
  if (isFinite(fromUSD) && fromUSD > 0) {
    tokenUnitsPerDollar = Number(fromAmountWei) / fromUSD
  } else if (fromToken && fromDecimals !== undefined) {
    try {
      const resp = await fetch(
        `${apiBase()}/v1/price/token?chainId=${cid}&address=${fromToken}`,
        { headers: jsonHeaders() }
      )
      if (!resp.ok) throw new Error(`token price HTTP ${resp.status}`)
      const json = (await resp.json()) as { data?: { priceUSD?: string } }
      const tokenPriceUSD = parseFloat(json.data?.priceUSD ?? "0")
      if (tokenPriceUSD <= 0) throw new Error("zero token price")
      // CoinGecko returns price per full token, so scale by decimals.
      tokenUnitsPerDollar = Math.pow(10, fromDecimals) / tokenPriceUSD
    } catch {
      return 0n
    }
  } else {
    return 0n
  }

  try {
    const resp = await fetch(
      `${apiBase()}/v1/price/native?chainId=${cid}`,
      { headers: jsonHeaders() }
    )
    if (!resp.ok) throw new Error(`native price HTTP ${resp.status}`)
    const json = (await resp.json()) as { data?: { priceUSD?: string } }
    const ethPriceUSD = parseFloat(json.data?.priceUSD ?? "0")
    if (ethPriceUSD <= 0) throw new Error("zero ETH price")

    const relayFeeUSD = (Number(valueWei) / 1e18) * ethPriceUSD
    const amountIn = Math.ceil(relayFeeUSD * tokenUnitsPerDollar * 1.25)

    return BigInt(amountIn)
  } catch {
    return 0n
  }
}
