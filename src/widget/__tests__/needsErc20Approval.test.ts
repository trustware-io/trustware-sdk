import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  isEvmAddress,
  NATIVE_EVM,
  NATIVE_SOLANA,
  needsErc20Approval,
} from "src/widget/helpers/chainHelpers";

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
// SPL mint — base58, not an EVM address. Reading an ERC20 allowance against
// it is meaningless: SPL transfers are authorized by the signed instruction,
// there is no approve() step.
const USDC_SOLANA = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

describe("needsErc20Approval", () => {
  it("requires approval for an EVM ERC20", () => {
    assert.equal(needsErc20Approval(USDC_BASE, "evm"), true);
    assert.equal(needsErc20Approval(USDC_BASE, "8453"), true);
  });

  it("never requires approval for an SPL token", () => {
    assert.equal(needsErc20Approval(USDC_SOLANA, "solana"), false);
    // Chain type missing from the def — the mint's own shape still rules it out.
    assert.equal(needsErc20Approval(USDC_SOLANA, undefined), false);
  });

  it("never requires approval for native assets", () => {
    assert.equal(needsErc20Approval(NATIVE_EVM, "evm"), false);
    assert.equal(needsErc20Approval(NATIVE_SOLANA, "solana"), false);
    assert.equal(
      needsErc20Approval("0x0000000000000000000000000000000000000000", "evm"),
      false
    );
    // Solana registries alias native SOL to the EVM native sentinel.
    assert.equal(needsErc20Approval(NATIVE_EVM, "solana"), false);
  });

  it("never requires approval on a non-EVM chain", () => {
    assert.equal(needsErc20Approval(USDC_BASE, "bitcoin"), false);
    assert.equal(needsErc20Approval("usei", "cosmos"), false);
    assert.equal(needsErc20Approval("ibc/ABC123", "cosmos"), false);
  });

  it("returns false for a missing or malformed token address", () => {
    assert.equal(needsErc20Approval(undefined, "evm"), false);
    assert.equal(needsErc20Approval("", "evm"), false);
    assert.equal(needsErc20Approval("0xdeadbeef", "evm"), false);
  });
});

describe("isEvmAddress", () => {
  it("accepts a 20-byte hex address", () => {
    assert.equal(isEvmAddress(USDC_BASE), true);
    assert.equal(isEvmAddress(USDC_BASE.toLowerCase()), true);
  });

  // Route plans for Solana name SPL mints and program ids here; treating one
  // as an ERC20 is what produced "Approve <TOKEN>" on a Solana swap and threw
  // on execute.
  it("rejects anything that isn't one", () => {
    assert.equal(isEvmAddress(USDC_SOLANA), false);
    assert.equal(isEvmAddress("usei"), false);
    assert.equal(isEvmAddress(undefined), false);
    assert.equal(isEvmAddress(null), false);
    assert.equal(isEvmAddress(""), false);
    assert.equal(isEvmAddress("0x123"), false);
    assert.equal(isEvmAddress(USDC_BASE + "00"), false);
  });
});
