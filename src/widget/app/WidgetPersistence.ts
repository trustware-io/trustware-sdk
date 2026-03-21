import type {
  NavigationStep,
  TransactionStatus,
} from "../context/DepositContext";

const STORAGE_KEY = "trustware-widget-state";

export interface PersistedState {
  currentStep: NavigationStep;
  amount: string;
  selectedChainId?: number;
  selectedTokenAddress?: string;
  transactionHash?: string;
  transactionStatus?: TransactionStatus;
}

export function savePersistedState(state: PersistedState): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors.
  }
}

export function clearPersistedState(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors.
  }
}
