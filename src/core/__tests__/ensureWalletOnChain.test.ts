import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { ensureWalletOnChain } from "src/core/tx";

const PLUME = 98866;
const BASE = 8453;

/** Minimal wallet double. `switchTo` is what the adapter would actually land
 *  on — null models a switch that resolves without changing anything, which is
 *  what the real adapters do when they swallow a 4001 or hit their in-flight
 *  re-entrancy guard. */
function makeWallet(opts: {
  chainId: number;
  switchTo?: number | null;
  throwOnSwitch?: unknown;
}) {
  let current = opts.chainId;
  const calls = { switchChain: 0 };
  return {
    calls,
    getChainId: async () => current,
    switchChain: async (target: number) => {
      calls.switchChain += 1;
      if (opts.throwOnSwitch) throw opts.throwOnSwitch;
      if (opts.switchTo === null) return; // resolved, changed nothing
      current = opts.switchTo ?? target;
    },
  };
}

describe("ensureWalletOnChain", () => {
  it("is a no-op when the wallet is already on the target chain", async () => {
    const wallet = makeWallet({ chainId: PLUME });
    await ensureWalletOnChain(wallet, PLUME);
    assert.equal(wallet.calls.switchChain, 0);
  });

  it("switches when the wallet is on a different chain", async () => {
    const wallet = makeWallet({ chainId: BASE });
    await ensureWalletOnChain(wallet, PLUME);
    assert.equal(wallet.calls.switchChain, 1);
    assert.equal(await wallet.getChainId(), PLUME);
  });

  // The regression this guard exists for: the wallet stayed on Base, the
  // caller sent the Plume approve anyway, and it executed against a codeless
  // address on Base — reporting success while approving nothing.
  it("throws when switchChain resolves but the chain did not change", async () => {
    const wallet = makeWallet({ chainId: BASE, switchTo: null });
    await assert.rejects(
      () => ensureWalletOnChain(wallet, PLUME),
      /wrong network.*98866/i
    );
  });

  it("throws when switchChain rejects and the chain did not change", async () => {
    const wallet = makeWallet({
      chainId: BASE,
      throwOnSwitch: new Error("Unknown chain 98866 (no params to add)"),
    });
    await assert.rejects(
      () => ensureWalletOnChain(wallet, PLUME),
      /wrong network.*98866/i
    );
  });

  // A user declining the prompt should surface as a rejection, not as a
  // generic wrong-network error, so the UI can render "you cancelled".
  it("propagates a user rejection verbatim", async () => {
    const rejection = Object.assign(new Error("User rejected the request"), {
      code: 4001,
    });
    const wallet = makeWallet({ chainId: BASE, throwOnSwitch: rejection });
    await assert.rejects(
      () => ensureWalletOnChain(wallet, PLUME),
      (e: unknown) => e === rejection
    );
  });

  // A switch that throws but still lands is fine — some wallets reject the
  // request and change chain anyway. The post-check is what decides.
  it("succeeds when switchChain throws but the chain did change", async () => {
    let current = BASE;
    const wallet = {
      getChainId: async () => current,
      switchChain: async () => {
        current = PLUME;
        throw new Error("wallet reported an error but switched anyway");
      },
    };
    await ensureWalletOnChain(wallet, PLUME);
    assert.equal(await wallet.getChainId(), PLUME);
  });

  it("rejects a non-numeric or non-positive chain id", async () => {
    const wallet = makeWallet({ chainId: BASE });
    await assert.rejects(
      () => ensureWalletOnChain(wallet, Number.NaN),
      /Invalid chain id/
    );
    await assert.rejects(
      () => ensureWalletOnChain(wallet, 0),
      /Invalid chain id/
    );
    assert.equal(wallet.calls.switchChain, 0);
  });
});
