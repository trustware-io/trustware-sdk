import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  EVM_ZERO_ADDRESS,
  getNativeTokenAddress,
  isNativeTokenAddress,
  NATIVE_EVM,
  NATIVE_SOLANA,
  normalizeAddress,
  tokenIdentityKey,
} from "src/utils/chains";
import { mulberry32 } from "src/__tests__/seededRandom";

const USDC_SOLANA = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const WSOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

/** Every way a caller names the Solana chain: type, catalog id, numeric id. */
const SOLANA_CHAIN_REFS = ["solana", "solana-mainnet-beta", "1151111081099710"];
const EVM_CHAIN_REFS = ["evm", "8453"];
const UNTYPED_CHAIN_REFS = [undefined, null, ""];

describe("native asset addresses", () => {
  it("are the System Program id for SOL and the sentinel for EVM", () => {
    assert.equal(NATIVE_SOLANA, "11111111111111111111111111111111");
    assert.equal(NATIVE_EVM, "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee");
    assert.equal(
      EVM_ZERO_ADDRESS,
      "0x0000000000000000000000000000000000000000"
    );
  });

  it("no longer read the retired So1111…111 placeholder as native SOL", () => {
    const placeholder = "So11111111111111111111111111111111111111111";
    for (const chain of SOLANA_CHAIN_REFS) {
      assert.equal(isNativeTokenAddress(placeholder, chain), false);
      assert.equal(normalizeAddress(placeholder, chain), placeholder);
    }
  });
});

describe("normalizeAddress", () => {
  it("folds every native spelling on a Solana chain onto NATIVE_SOLANA", () => {
    for (const chain of SOLANA_CHAIN_REFS) {
      for (const spelling of [
        NATIVE_SOLANA,
        NATIVE_EVM,
        NATIVE_EVM.toUpperCase(),
        ` ${NATIVE_EVM} `,
        ` ${NATIVE_SOLANA}\n`,
      ]) {
        assert.equal(
          normalizeAddress(spelling, chain),
          NATIVE_SOLANA,
          `${JSON.stringify(spelling)} on ${chain}`
        );
      }
    }
  });

  it("keeps an SPL mint byte-exact on a Solana chain", () => {
    for (const chain of SOLANA_CHAIN_REFS) {
      assert.equal(normalizeAddress(USDC_SOLANA, chain), USDC_SOLANA);
      assert.equal(
        normalizeAddress(USDC_SOLANA.toLowerCase(), chain),
        USDC_SOLANA.toLowerCase()
      );
      assert.equal(normalizeAddress(` ${USDC_SOLANA} `, chain), USDC_SOLANA);
      // Wrapped SOL is its own SPL token, never an alias of native SOL.
      assert.equal(normalizeAddress(WSOL_MINT, chain), WSOL_MINT);
    }
  });

  it("folds case on every chain type that isn't Solana", () => {
    for (const chain of EVM_CHAIN_REFS) {
      assert.equal(normalizeAddress(USDC_BASE, chain), USDC_BASE.toLowerCase());
      assert.equal(
        normalizeAddress(` ${USDC_BASE} `, chain),
        USDC_BASE.toLowerCase()
      );
    }
    assert.equal(normalizeAddress("IBC/ABC123", "cosmos"), "ibc/abc123");
  });

  it("decides by the address's own shape when the chain type is unknown", () => {
    for (const chain of UNTYPED_CHAIN_REFS) {
      assert.equal(normalizeAddress(USDC_BASE, chain), USDC_BASE.toLowerCase());
      assert.equal(
        normalizeAddress(NATIVE_EVM.toUpperCase(), chain),
        NATIVE_EVM
      );
      assert.equal(normalizeAddress(USDC_SOLANA, chain), USDC_SOLANA);
      assert.equal(normalizeAddress(` ${USDC_SOLANA} `, chain), USDC_SOLANA);
    }
  });
});

describe("isNativeTokenAddress", () => {
  it("recognizes the EVM native spellings on an EVM chain", () => {
    for (const chain of EVM_CHAIN_REFS) {
      assert.equal(isNativeTokenAddress(NATIVE_EVM, chain), true);
      assert.equal(isNativeTokenAddress(NATIVE_EVM.toUpperCase(), chain), true);
      assert.equal(isNativeTokenAddress(EVM_ZERO_ADDRESS, chain), true);
    }
  });

  it("recognizes every native-SOL spelling on a Solana chain", () => {
    for (const chain of SOLANA_CHAIN_REFS) {
      assert.equal(isNativeTokenAddress(NATIVE_SOLANA, chain), true);
      assert.equal(isNativeTokenAddress(NATIVE_EVM, chain), true);
      assert.equal(isNativeTokenAddress(EVM_ZERO_ADDRESS, chain), true);
    }
  });

  it("rejects token contracts and mints", () => {
    for (const chain of SOLANA_CHAIN_REFS) {
      assert.equal(isNativeTokenAddress(USDC_SOLANA, chain), false);
      assert.equal(isNativeTokenAddress(WSOL_MINT, chain), false);
    }
    for (const chain of EVM_CHAIN_REFS) {
      assert.equal(isNativeTokenAddress(USDC_BASE, chain), false);
      // Native SOL's address names nothing on an EVM chain.
      assert.equal(isNativeTokenAddress(NATIVE_SOLANA, chain), false);
    }
  });

  it("reads the EVM spellings as native when the chain type is unknown", () => {
    for (const chain of UNTYPED_CHAIN_REFS) {
      assert.equal(isNativeTokenAddress(NATIVE_EVM, chain), true);
      assert.equal(isNativeTokenAddress(EVM_ZERO_ADDRESS, chain), true);
      assert.equal(isNativeTokenAddress(USDC_BASE, chain), false);
      assert.equal(isNativeTokenAddress(NATIVE_SOLANA, chain), false);
    }
  });

  it("is false for a missing address", () => {
    for (const address of [undefined, null, ""]) {
      assert.equal(isNativeTokenAddress(address, "evm"), false);
      assert.equal(isNativeTokenAddress(address, "solana"), false);
      assert.equal(isNativeTokenAddress(address, undefined), false);
    }
  });
});

describe("tokenIdentityKey", () => {
  it("joins the normalized chain id and the normalized address", () => {
    assert.equal(
      tokenIdentityKey(" Solana-Mainnet-Beta ", NATIVE_EVM, "solana"),
      `solana-mainnet-beta:${NATIVE_SOLANA}`
    );
    assert.equal(
      tokenIdentityKey(8453, USDC_BASE, "evm"),
      `8453:${USDC_BASE.toLowerCase()}`
    );
  });

  it("gives every native-SOL spelling one key, and mints their own", () => {
    const native = tokenIdentityKey("solana", NATIVE_SOLANA, "solana");
    assert.equal(tokenIdentityKey("solana", NATIVE_EVM, "solana"), native);
    assert.notEqual(tokenIdentityKey("solana", WSOL_MINT, "solana"), native);
    assert.notEqual(
      tokenIdentityKey("solana", USDC_SOLANA, "solana"),
      tokenIdentityKey("solana", USDC_SOLANA.toLowerCase(), "solana")
    );
  });

  // Eclipse's chain id is all digits, which on its own reads as EVM. Its
  // ChainDef says Solana, and that is the type that must reach the key.
  it("folds case only when the given chain type allows it", () => {
    assert.notEqual(
      tokenIdentityKey("9286185", USDC_SOLANA, "solana"),
      tokenIdentityKey("9286185", USDC_SOLANA.toLowerCase(), "solana")
    );
  });

  it("never matches the same address on two chains", () => {
    assert.notEqual(
      tokenIdentityKey("1", USDC_BASE, "evm"),
      tokenIdentityKey("8453", USDC_BASE, "evm")
    );
  });
});

describe("getNativeTokenAddress", () => {
  it("names native SOL on every Solana chain reference", () => {
    for (const chain of SOLANA_CHAIN_REFS) {
      assert.equal(getNativeTokenAddress(chain), NATIVE_SOLANA);
    }
  });

  it("names the EVM sentinel everywhere else", () => {
    for (const chain of [...EVM_CHAIN_REFS, ...UNTYPED_CHAIN_REFS, "cosmos"]) {
      assert.equal(getNativeTokenAddress(chain), NATIVE_EVM);
    }
  });
});

// ── Properties ──────────────────────────────────────────────────────────────

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const HEX = "0123456789abcdef";
const ALL_CHAIN_REFS = [
  ...SOLANA_CHAIN_REFS,
  ...EVM_CHAIN_REFS,
  ...UNTYPED_CHAIN_REFS,
];
const SEEDS = 500;

type Random = () => number;

function pickFrom<T>(random: Random, items: readonly T[]): T {
  return items[Math.floor(random() * items.length)];
}

function randomString(random: Random, alphabet: string, length: number) {
  return Array.from({ length }, () => pickFrom(random, [...alphabet])).join("");
}

function randomCase(random: Random, value: string) {
  return [...value]
    .map((char) => (random() < 0.5 ? char.toUpperCase() : char.toLowerCase()))
    .join("");
}

function randomPadding(random: Random) {
  return pickFrom(random, ["", " ", "\t", "\n", "  "]);
}

function randomHexAddress(random: Random) {
  return `0x${randomString(random, HEX, 40)}`;
}

/** 32–44 characters, the length range of a Base58 Solana public key. */
function randomMint(random: Random) {
  return randomString(random, BASE58, 32 + Math.floor(random() * 13));
}

function randomAddress(random: Random) {
  const pad = randomPadding(random);
  return (
    pad +
    pickFrom(random, [
      () => randomCase(random, randomHexAddress(random)),
      () => randomMint(random),
      () => randomCase(random, NATIVE_EVM),
      () => NATIVE_SOLANA,
      () => EVM_ZERO_ADDRESS,
    ])() +
    pad
  );
}

describe("normalizeAddress properties", () => {
  it("is idempotent on every chain", () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const random = mulberry32(seed);
      const address = randomAddress(random);
      for (const chain of ALL_CHAIN_REFS) {
        const key = normalizeAddress(address, chain);
        assert.equal(
          normalizeAddress(key, chain),
          key,
          `seed ${seed}: ${JSON.stringify(address)} on ${chain}`
        );
      }
    }
  });

  it("ignores hex case and padding everywhere but Solana", () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const random = mulberry32(seed);
      const address = randomHexAddress(random);
      const variant =
        randomPadding(random) +
        randomCase(random, address) +
        randomPadding(random);
      for (const chain of [...EVM_CHAIN_REFS, ...UNTYPED_CHAIN_REFS]) {
        assert.equal(
          normalizeAddress(variant, chain),
          address,
          `seed ${seed}: ${JSON.stringify(variant)} on ${chain}`
        );
      }
    }
  });

  it("never merges two mints that differ only in case", () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const random = mulberry32(seed);
      const mint = randomMint(random);
      const letters = [...mint]
        .map((char, index) => ({ char, index }))
        .filter(({ char }) => char.toLowerCase() !== char.toUpperCase());
      if (letters.length === 0) continue;
      const { char, index } = pickFrom(random, letters);
      const flipped =
        char === char.toLowerCase() ? char.toUpperCase() : char.toLowerCase();
      const variant = mint.slice(0, index) + flipped + mint.slice(index + 1);
      for (const chain of [...SOLANA_CHAIN_REFS, ...UNTYPED_CHAIN_REFS]) {
        assert.notEqual(
          normalizeAddress(variant, chain),
          normalizeAddress(mint, chain),
          `seed ${seed}: ${mint} vs ${variant} on ${chain}`
        );
      }
    }
  });

  it("folds the sentinel onto NATIVE_SOLANA in any case and padding", () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const random = mulberry32(seed);
      const pad = randomPadding(random);
      const spelling = pad + randomCase(random, NATIVE_EVM) + pad;
      for (const chain of SOLANA_CHAIN_REFS) {
        assert.equal(normalizeAddress(spelling, chain), NATIVE_SOLANA);
        assert.equal(isNativeTokenAddress(spelling, chain), true);
      }
    }
  });

  it("never reads a random mint as native SOL", () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const random = mulberry32(seed);
      const mint = randomMint(random);
      if (mint === NATIVE_SOLANA) continue;
      for (const chain of SOLANA_CHAIN_REFS) {
        assert.equal(
          isNativeTokenAddress(mint, chain),
          false,
          `seed ${seed}: ${mint} on ${chain}`
        );
      }
    }
  });
});
