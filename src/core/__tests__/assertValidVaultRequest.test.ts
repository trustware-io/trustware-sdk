import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertValidVaultRequest } from "../routes";

describe("assertValidVaultRequest", () => {
  it("is a no-op when vault is undefined", () => {
    assert.doesNotThrow(() => assertValidVaultRequest({}));
  });

  it("throws when vaultId is missing", () => {
    assert.throws(
      () =>
        assertValidVaultRequest({
          vault: { vaultId: "", network: "base" },
        }),
      /vaultId is required/
    );
  });

  it("throws when network is missing", () => {
    assert.throws(
      () =>
        assertValidVaultRequest({
          vault: { vaultId: "0xVault", network: "" },
        }),
      /network is required/
    );
  });

  it("throws when both vault and hooks.postHook are set", () => {
    assert.throws(
      () =>
        assertValidVaultRequest({
          vault: { vaultId: "0xVault", network: "base" },
          hooks: {
            postHook: { target: "0xabc", callData: "0x01", fundAmount: "1" },
          },
        }),
      /mutually exclusive/
    );
  });

  it("passes with a valid vault and no hooks", () => {
    assert.doesNotThrow(() =>
      assertValidVaultRequest({
        vault: { vaultId: "0xVault", network: "base" },
      })
    );
  });

  it("passes with a valid vault and hooks present but no postHook", () => {
    assert.doesNotThrow(() =>
      assertValidVaultRequest({
        vault: { vaultId: "0xVault", network: "base" },
        hooks: {},
      })
    );
  });
});
