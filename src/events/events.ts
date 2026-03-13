import { TrustwareError } from "../errors/TrustwareError";

export type TrustwareEvent =
  | { type: "error"; error: TrustwareError }
  | { type: "transaction_started" }
  | { type: "transaction_success"; txHash: string }
  | { type: "wallet_connected"; address: string };
