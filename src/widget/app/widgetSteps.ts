import React from "react";

import type {
  NavigationStep,
  TransactionStatus,
} from "../context/DepositContext";
import { Home } from "../pages/Home";
import { SelectToken } from "../pages/SelectToken";
import { CryptoPay } from "../pages/CryptoPay";
import { Processing } from "../pages/Processing";
import { Success } from "../pages/Success";
import { Error } from "../pages/Error";

export const PAGE_COMPONENTS: Record<NavigationStep, React.ComponentType> = {
  home: Home,
  "select-token": SelectToken,
  "crypto-pay": CryptoPay,
  processing: Processing,
  success: Success,
  error: Error,
};

export const STEP_ORDER: NavigationStep[] = [
  "home",
  "select-token",
  "crypto-pay",
  "processing",
  "success",
  "error",
];

export const ACTIVE_TRANSACTION_STATUSES: TransactionStatus[] = [
  "confirming",
  "processing",
  "bridging",
];
