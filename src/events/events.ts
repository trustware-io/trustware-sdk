import { TrustwareError } from "../errors/TrustwareError";
import type { Transaction } from "../types/routes";

export type TrustwareEvent =
  | { type: "error"; error: TrustwareError }
  | { type: "transaction_started" }
  | { type: "transaction_success"; txHash: string; transaction?: Transaction }
  | { type: "wallet_connected"; address: string };
