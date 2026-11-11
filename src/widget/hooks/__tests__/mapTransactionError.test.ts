import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { mapTransactionError } from "../useTransactionSubmit";
import {
  EVM_WALLET_REQUIRED,
  INVALID_ROUTE_TRANSACTION,
  SOLANA_WALLET_REQUIRED,
} from "../../../core/tx";
import { mapError } from "../../lib/mapError";

describe("mapTransactionError and the send path's own refusals", () => {
  const invalidPayload = `${INVALID_ROUTE_TRANSACTION}: no EVM or Solana transaction to send on chain bitcoin (intent intent-1).`;

  it("passes each refusal through unchanged", () => {
    for (const msg of [
      EVM_WALLET_REQUIRED,
      SOLANA_WALLET_REQUIRED,
      invalidPayload,
    ]) {
      assert.equal(mapTransactionError(new Error(msg)), msg);
    }
  });

  it("lets the error page name an unsendable route, not a network switch", () => {
    // The widget stores mapTransactionError's text; the error page maps it again.
    assert.deepEqual(mapError(mapTransactionError(new Error(invalidPayload))), {
      category: "transaction_failed",
      title: "Route Not Supported",
      message:
        "This route's transaction can't be sent from here. Nothing was sent. Try a different token or chain.",
    });
  });

  it("still maps other chain errors to switch-network advice", () => {
    assert.equal(
      mapTransactionError(new Error("Chain mismatch: wallet is on 1")),
      "Please switch to the correct network in your wallet."
    );
  });
});
