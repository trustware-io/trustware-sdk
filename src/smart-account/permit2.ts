import {
  encodeFunctionData,
  keccak256,
  encodeAbiParameters,
  concat,
  recoverAddress,
  stringToHex,
} from "viem"

export const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as const

const PERMIT2_ABI = [
  {
    name: "permitTransferFrom",
    type: "function",
    inputs: [
      {
        name: "permit",
        type: "tuple",
        components: [
          {
            name: "permitted",
            type: "tuple",
            components: [
              { name: "token", type: "address" },
              { name: "amount", type: "uint256" },
            ],
          },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      {
        name: "transferDetails",
        type: "tuple",
        components: [
          { name: "to", type: "address" },
          { name: "requestedAmount", type: "uint256" },
        ],
      },
      { name: "owner", type: "address" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const

const ERC20_APPROVE_ABI = [
  {
    name: "approve",
    type: "function",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const

// 128-bit random nonce — collision-free for SignatureTransfer (bitmap tracks used nonces).
// Do NOT use permit2.allowance() nonce here — that is for AllowanceTransfer, not SignatureTransfer.
export function randomPermit2Nonce(): bigint {
  const buf = new Uint8Array(16)
  crypto.getRandomValues(buf)
  const hex = Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
  return BigInt("0x" + hex)
}

type Eip1193Request = (args: { method: string; params?: object | unknown[] }) => Promise<unknown>

export async function signPermit2(
  eip1193Request: Eip1193Request,
  params: {
    chainId: number
    token: `0x${string}`
    amount: bigint
    spender: `0x${string}`
    nonce: bigint
    deadline: bigint
    owner: `0x${string}`
  }
): Promise<`0x${string}`> {
  // Permit2 domain has no "version" field — the contract is not ERC-712-versioned.
  // Use decimal strings for all uint256 fields. Wallets using @metamask/eth-sig-util
  // v4 pass values through new BN(value, 10), and hex strings fed to bn.js with explicit
  // base-10 produce wrong results (the 'x' prefix character is parsed as digit 33, etc.).
  // Decimal strings work correctly with both old (bn.js) and new (BigInt) wallet stacks.
  //
  // IMPORTANT: Callers may pass amount/nonce/deadline as hex strings (e.g. "0x2713") even
  // though the TypeScript type says bigint — JSON doesn't support BigInt so values coming
  // from API responses arrive as strings. Wrapping in BigInt() normalises any hex string,
  // decimal string, number, or bigint to a proper decimal representation before signing.
  const amountBig   = BigInt(params.amount)
  const nonceBig    = BigInt(params.nonce)
  const deadlineBig = BigInt(params.deadline)

  const typedData = {
    domain: {
      name: "Permit2",
      chainId: params.chainId,
      verifyingContract: PERMIT2,
    },
    types: {
      // Explicit EIP712Domain forces wallets to use this exact field order
      // (name, chainId, verifyingContract) — matching Permit2's on-chain
      // DOMAIN_SEPARATOR. Without it, some wallets (e.g. eth-sig-util v5+)
      // sort fields alphabetically (chainId, name, verifyingContract),
      // producing a different domain hash and an InvalidSigner revert.
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ],
      PermitTransferFrom: [
        { name: "permitted", type: "TokenPermissions" },
        { name: "spender", type: "address" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
      TokenPermissions: [
        { name: "token", type: "address" },
        { name: "amount", type: "uint256" },
      ],
    },
    primaryType: "PermitTransferFrom",
    message: {
      permitted: {
        token: params.token,
        amount: amountBig.toString(),
      },
      spender: params.spender,
      nonce: nonceBig.toString(),
      deadline: deadlineBig.toString(),
    },
  }

  console.debug("[permit2] signing", {
    owner: params.owner,
    spender: params.spender,
    token: params.token,
    amount: amountBig.toString(),
    nonce: nonceBig.toString(),
    deadline: deadlineBig.toString(),
    chainId: params.chainId,
  })

  const sig = await eip1193Request({
    method: "eth_signTypedData_v4",
    params: [params.owner, JSON.stringify(typedData)],
  })
  console.debug("[permit2] sig", sig)

  // Sanity-check: manually compute the EIP-712 digest that Permit2 uses on-chain.
  // This is non-fatal — if recovery mismatches, we log all intermediates for debugging
  // and still proceed to the bundler so we can see if Permit2 accepts the sig on-chain.
  try {
    const TOKEN_PERMISSIONS_TYPEHASH = keccak256(
      stringToHex("TokenPermissions(address token,uint256 amount)")
    )
    const PERMIT_TYPEHASH = keccak256(
      stringToHex("PermitTransferFrom(TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline)TokenPermissions(address token,uint256 amount)")
    )
    const DOMAIN_TYPEHASH = keccak256(
      stringToHex("EIP712Domain(string name,uint256 chainId,address verifyingContract)")
    )
    const nameHash = keccak256(stringToHex("Permit2"))

    const domainSeparator = keccak256(encodeAbiParameters(
      [{ type: "bytes32" }, { type: "bytes32" }, { type: "uint256" }, { type: "address" }],
      [DOMAIN_TYPEHASH, nameHash, BigInt(params.chainId), PERMIT2]
    ))

    const tokenHash = keccak256(encodeAbiParameters(
      [{ type: "bytes32" }, { type: "address" }, { type: "uint256" }],
      [TOKEN_PERMISSIONS_TYPEHASH, params.token, amountBig]
    ))

    const structHash = keccak256(encodeAbiParameters(
      [{ type: "bytes32" }, { type: "bytes32" }, { type: "address" }, { type: "uint256" }, { type: "uint256" }],
      [PERMIT_TYPEHASH, tokenHash, params.spender, nonceBig, deadlineBig]
    ))

    const digest = keccak256(concat(["0x1901", domainSeparator, structHash]))

    const recovered = await recoverAddress({ hash: digest, signature: sig as `0x${string}` })
    const valid = recovered.toLowerCase() === params.owner.toLowerCase()

    console.debug("[permit2] recovery intermediates", {
      TOKEN_PERMISSIONS_TYPEHASH,
      PERMIT_TYPEHASH,
      DOMAIN_TYPEHASH,
      nameHash,
      domainSeparator,
      tokenHash,
      structHash,
      digest,
      recovered,
      owner: params.owner,
      valid,
      // normalised inputs used for signing:
      amount: amountBig.toString(),
      nonce: nonceBig.toString(),
      deadline: deadlineBig.toString(),
    })

    if (!valid) {
      throw Object.assign(
        new Error(
          `Permit2: wallet signed with wrong account. ` +
          `Expected ${params.owner} but ${recovered} signed. ` +
          `Switch your wallet to account ${params.owner} and try again.`
        ),
        { code: "PERMIT2_WRONG_SIGNER", recovered, expected: params.owner }
      )
    }
  } catch (e) {
    if ((e as { code?: string }).code === "PERMIT2_WRONG_SIGNER") throw e
    console.warn("[permit2] recovery check failed (non-fatal):", e)
  }

  return sig as `0x${string}`
}

export function encodePermitTransferFrom(
  token: `0x${string}`,
  amount: bigint,
  nonce: bigint,
  deadline: bigint,
  saAddress: `0x${string}`,
  eoaAddress: `0x${string}`,
  sig: `0x${string}`
): `0x${string}` {
  return encodeFunctionData({
    abi: PERMIT2_ABI,
    functionName: "permitTransferFrom",
    args: [
      { permitted: { token, amount }, nonce, deadline },
      { to: saAddress, requestedAmount: amount },
      eoaAddress,
      sig,
    ],
  })
}

export function encodeErc20Approve(
  spender: `0x${string}`,
  amount: bigint
): `0x${string}` {
  return encodeFunctionData({
    abi: ERC20_APPROVE_ABI,
    functionName: "approve",
    args: [spender, amount],
  })
}

const ERC20_ALLOWANCE_ABI = [
  {
    name: "allowance",
    type: "function",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const

export function encodeErc20Allowance(
  owner: `0x${string}`,
  spender: `0x${string}`
): `0x${string}` {
  return encodeFunctionData({
    abi: ERC20_ALLOWANCE_ABI,
    functionName: "allowance",
    args: [owner, spender],
  })
}

const ERC20_BALANCE_OF_ABI = [
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const

export function encodeErc20BalanceOf(owner: `0x${string}`): `0x${string}` {
  return encodeFunctionData({
    abi: ERC20_BALANCE_OF_ABI,
    functionName: "balanceOf",
    args: [owner],
  })
}

// WETH9 deposit/withdraw — same ABI on every EVM chain.
const WETH_ABI = [
  {
    name: "withdraw",
    type: "function",
    inputs: [{ name: "wad", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const

export function encodeWethWithdraw(amount: bigint): `0x${string}` {
  return encodeFunctionData({ abi: WETH_ABI, functionName: "withdraw", args: [amount] })
}
