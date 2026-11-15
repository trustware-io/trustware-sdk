// The README's "API version and field names" table, typechecked against the
// built dist by `npm run check:host-types` (run `npm run build` first). The
// lines marked as expected errors are snake_case names the types must keep
// refusing.
import {
  Trustware,
  type BalanceRow,
  type Transaction,
  type WalletAddressBalanceWrapper,
} from "@trustware/sdk";

declare const tx: Transaction;
declare const wrapper: WalletAddressBalanceWrapper;
declare const row: BalanceRow;

export async function readRenamedFields(intentId: string): Promise<void> {
  const owner: string | undefined = tx.originEoa;
  const verified: boolean | undefined = tx.landedAmountVerified;
  const chainId: string = wrapper.chainId;
  const chainKey: string = row.chainKey;
  void owner;
  void verified;
  void chainId;
  void chainKey;

  // @ts-expect-error renamed to originEoa
  void tx.origin_eoa;
  // @ts-expect-error renamed to landedAmountVerified
  void tx.landed_amount_verified;
  // @ts-expect-error renamed to chainId
  void wrapper.chain_id;
  // @ts-expect-error renamed to chainKey
  void row.chain_key;

  const committed = await Trustware.submitReceipt(intentId, "0xhash");
  const transactionId: string = committed.transactionId;
  const sourceTxHash: string = committed.sourceTxHash;
  void transactionId;
  void sourceTxHash;

  const stepResult = await Trustware.submitStepReceipt(intentId, 0, "0xhash");
  const stepKind: "approve" | "main" = stepResult.step.stepKind;
  void stepKind;
}
