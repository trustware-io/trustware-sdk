import { strict as assert } from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";
import { sendVaultRedeemTx } from "src/core/tx";
import { walletManager } from "src/wallets/";
import type { WalletInterFaceAPI } from "src/types";
import type { VaultRedeemAction } from "src/core/vaults";

const OWNER = "0x1111111111111111111111111111111111111111";
const VAULT = "0x7BfA7C4f149E7415b73bdeDfe609237e29CBF34A";
const REDEEM_DATA =
  "0xba08765200000000000000000000000000000000000000000000000000084110fdaeb72100000000000000000000000040695edf6e3c6be65122162b7d7b7f6c5418037b00000000000000000000000040695edf6e3c6be65122162b7d7b7f6c5418037b049659f72ad291ee75407eee84b77100535a2a0fffc69deb";

type SentTx = { to: string; data: string; chainId?: string };

function makeFakeWallet(
  sent: SentTx[],
  overrides: Partial<WalletInterFaceAPI> = {}
): WalletInterFaceAPI {
  return {
    ecosystem: "evm",
    type: "eip1193",
    getAddress: async () => OWNER,
    getChainId: async () => 8453,
    switchChain: async () => {},
    request: async (args: { method: string; params?: unknown[] }) => {
      if (args.method === "eth_sendTransaction") {
        const tx = (args.params as Record<string, string>[])[0];
        sent.push({ to: tx.to, data: tx.data, chainId: tx.chainId });
        return `0x${String(sent.length).padStart(64, "0")}`;
      }
      throw new Error(`Unexpected wallet request: ${args.method}`);
    },
    ...overrides,
  } as unknown as WalletInterFaceAPI;
}

function redeemAction(overrides: Partial<VaultRedeemAction["tx"]> = {}) {
  return {
    name: "Redeem all USDC from Spark USDC Vault vault",
    tx: {
      to: VAULT,
      chainId: 8453,
      data: REDEEM_DATA,
      value: "",
      ...overrides,
    },
  } as VaultRedeemAction;
}

describe("sendVaultRedeemTx (BVT-398 withdrawal)", () => {
  let sent: SentTx[];

  beforeEach(() => {
    sent = [];
  });

  afterEach(async () => {
    await walletManager.disconnect();
  });

  it("signs and submits the redeem action's tx as-is, no approval pass", async () => {
    walletManager.attachWallet(makeFakeWallet(sent));

    const hash = await sendVaultRedeemTx(redeemAction());

    assert.equal(hash.length, 66);
    assert.equal(
      sent.length,
      1,
      "no separate approve — redeem spends shares directly"
    );
    assert.equal(sent[0].to, VAULT);
    assert.equal(sent[0].data, REDEEM_DATA);
    assert.equal(sent[0].chainId, `0x${(8453).toString(16)}`);
  });

  it("switches chain first when the wallet is on a different one", async () => {
    const switched: number[] = [];
    let currentChain = 1;
    walletManager.attachWallet(
      makeFakeWallet(sent, {
        getChainId: async () => currentChain,
        switchChain: async (id: number) => {
          switched.push(id);
          currentChain = id;
        },
      })
    );

    await sendVaultRedeemTx(redeemAction());

    assert.deepEqual(switched, [8453]);
  });

  it("throws with no wallet configured", async () => {
    await assert.rejects(
      () => sendVaultRedeemTx(redeemAction()),
      /Trustware\.wallet not configured/
    );
  });

  it("throws for a non-EVM wallet", async () => {
    walletManager.attachWallet({
      ecosystem: "solana",
      type: "wallet-standard",
    } as unknown as WalletInterFaceAPI);

    await assert.rejects(
      () => sendVaultRedeemTx(redeemAction()),
      /EVM wallet is required/
    );
  });

  it("throws naming the action when the chain id is invalid", async () => {
    walletManager.attachWallet(makeFakeWallet(sent));

    await assert.rejects(
      () => sendVaultRedeemTx(redeemAction({ chainId: 0 })),
      /invalid chain id/
    );
  });
});
