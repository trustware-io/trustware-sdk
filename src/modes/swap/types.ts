export type SwapStage =
  | "home"
  | "select-from"
  | "select-to"
  | "connect-wallet"
  | "review"
  | "processing"
  | "success"
  | "error";

export type SwapTxStatus =
  | "idle"
  | "approving"
  | "confirming"
  | "processing"
  | "bridging"
  | "success"
  | "error";
