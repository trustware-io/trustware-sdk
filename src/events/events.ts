import { TrustwareError } from "../errors/TrustwareError";
import type { Transaction } from "../types/routes";

export type TrustwareEvent =
  | { type: "error"; error: TrustwareError }
  | { type: "transaction_started" }
  | { type: "transaction_success"; txHash: string; transaction?: Transaction }
  | { type: "wallet_connected"; address: string }
  | {
      type: "token_page_loaded";
      chainRef: string;
      query?: string;
      count: number;
      hasNextPage: boolean;
      cursor?: string;
    }
  | {
      type: "token_page_error";
      chainRef: string;
      query?: string;
      cursor?: string;
      message: string;
    }
  | {
      type: "balance_stream_chunk";
      address: string;
      chunkSize: number;
    }
  | {
      type: "balance_stream_fallback";
      address: string;
      message: string;
    };
