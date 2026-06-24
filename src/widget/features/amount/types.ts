export type AmountInputMode = "usd" | "token";

export type AmountComputationLike = {
  tokenAmount?: number | string | null;
  usdAmount?: number | string | null;
};
