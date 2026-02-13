import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import { walletManager } from "../../wallets/manager";
import { useWalletDetection } from "../../wallets/detect";
import type { ChainDef, DetectedWallet, WalletInterFaceAPI } from "../../types";
import { useChains, useTokens } from "../hooks";
import { DEFAULT_CHAINS } from "../pages/CryptoPay";
import { getBalances } from "src/core/balances";
import { resolveChainLabel } from "src/utils";

/**
 * localStorage key for persisting theme preference
 */
const THEME_STORAGE_KEY = "trustware-widget-theme";

/**
 * Resolved theme type (light or dark, not system)
 */
export type ResolvedTheme = "light" | "dark";

export interface YourTokenData {
  chainIconURI: string;
  chainData: ChainDef | undefined;
  symbol: string | undefined;
  decimals: number;
  name: string | undefined;
  iconUrl: string | undefined;
  chainId: number;
  usdPrice: number | undefined;
  address: string | undefined;
  chain_key: string;
  category: "native" | "erc20" | "spl" | "btc";
  contract?: `0x${string}`;
  balance: string;
}

/**
 * Navigation states for the deposit widget flow
 */
export type NavigationStep =
  | "home"
  | "select-token"
  | "crypto-pay"
  | "processing"
  | "success"
  | "error";

/**
 * Wallet connection status
 */
export type WalletStatus =
  | "idle"
  | "detecting"
  | "connecting"
  | "connected"
  | "error";

/**
 * Transaction lifecycle status for deposit flow
 */
export type TransactionStatus =
  | "idle"
  | "confirming"
  | "processing"
  | "bridging"
  | "success"
  | "error";

/**
 * Payment method type for deposit selection
 */
export type PaymentMethodType = "crypto" | "fiat";

/**
 * Token information for deposit selection
 */
export interface Token {
  /** Token contract address (or 'native' for native tokens) */
  address: string;
  /** Token symbol (e.g., 'USDC', 'ETH') */
  symbol: string;
  /** Token display name (e.g., 'USD Coin', 'Ethereum') */
  name: string;
  /** Number of decimals for the token */
  decimals: number;
  /** URL to token icon/logo */
  iconUrl?: string;
  /** Token balance if wallet connected (as string to preserve precision) */
  balance?: string;

  chainId: string | number;

  usdPrice: number | undefined;
}

/**
 * Blockchain network information for deposit selection
 */
export interface Chain {
  /** Chain ID (e.g., 1 for Ethereum mainnet) */
  chainId: number;
  /** Chain display name (e.g., 'Ethereum', 'Polygon') */
  name: string;
  /** Short name or symbol (e.g., 'ETH', 'MATIC') */
  shortName: string;
  /** URL to chain icon/logo */
  iconUrl?: string;
  /** Whether this is a popular/featured chain */
  isPopular?: boolean;
  /** Native token symbol */
  nativeToken: string;
  /** Block explorer URL */
  explorerUrl?: string;
}

export interface DepositContextValue {
  /** Current navigation step */
  currentStep: NavigationStep;
  /** Set the current navigation step */
  setCurrentStep: (step: NavigationStep) => void;
  /** Navigate to the previous step */
  goBack: () => void;
  /** Reset state and return to home */
  resetState: () => void;
  /** History of visited steps for back navigation */
  stepHistory: NavigationStep[];

  // Wallet state
  /** Currently connected wallet interface */
  selectedWallet: WalletInterFaceAPI | null;
  /** Current wallet address (null if not connected) */
  walletAddress: string | null;
  /** Current wallet connection status */
  walletStatus: WalletStatus;
  /** Connect to a detected wallet */
  connectWallet: (wallet: DetectedWallet) => Promise<void>;
  /** Disconnect the current wallet */
  disconnectWallet: () => Promise<void>;

  // Token and chain state
  /** Currently selected token for deposit */
  selectedToken: Token | null | YourTokenData;
  /** Set the selected token */
  setSelectedToken: (token: Token | null | YourTokenData) => void;
  /** Currently selected blockchain network */
  selectedChain: Chain | null;
  /** Set the selected chain */
  setSelectedChain: (chain: Chain | null) => void;
  /** Deposit amount as string (to preserve decimal precision) */
  amount: string;
  /** Set the deposit amount */
  setAmount: (amount: string) => void;

  // Transaction lifecycle state
  /** Current transaction status */
  transactionStatus: TransactionStatus;
  /** Set the transaction status */
  setTransactionStatus: (status: TransactionStatus) => void;
  /** Transaction hash after submission (null if not yet submitted) */
  transactionHash: string | null;
  /** Set the transaction hash */
  setTransactionHash: (hash: string | null) => void;
  /** Error message for failed transactions */
  errorMessage: string | null;
  /** Set the error message */
  setErrorMessage: (message: string | null) => void;
  /** Route intent ID for transaction tracking */
  intentId: string | null;
  /** Set the intent ID */
  setIntentId: (id: string | null) => void;

  // Payment method state
  /** Selected payment method type */
  paymentMethod: PaymentMethodType;
  /** Set the payment method type */
  setPaymentMethod: (method: PaymentMethodType) => void;

  // Theme state
  /** Current resolved theme (light or dark) */
  resolvedTheme: ResolvedTheme;
  /** Toggle between light and dark themes */
  toggleTheme: () => void;

  setYourWalletTokens: React.Dispatch<React.SetStateAction<YourTokenData[]>>;

  yourWalletTokens: YourTokenData[];
}

const DepositContext = createContext<DepositContextValue | undefined>(
  undefined
);

export interface DepositProviderProps {
  children: React.ReactNode;
  /** Initial step to start the widget at */
  initialStep?: NavigationStep;
}

/**
 * Provider for deposit widget context including navigation state.
 */
export function DepositProvider({
  children,
  initialStep = "home",
}: DepositProviderProps): React.ReactElement {
  const [currentStep, setCurrentStepInternal] =
    useState<NavigationStep>(initialStep);
  const [stepHistory, setStepHistory] = useState<NavigationStep[]>([
    initialStep,
  ]);

  // Wallet state
  const [selectedWallet, setSelectedWallet] =
    useState<WalletInterFaceAPI | null>(walletManager.wallet);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletStatus, setWalletStatus] = useState<WalletStatus>(
    walletManager.status as WalletStatus
  );

  // Wire wallet detection into manager (detection only, no auto-connect)
  const { detected } = useWalletDetection();

  // Feed detected wallets into manager for display in UI
  useEffect(() => {
    walletManager.setDetected(detected);
  }, [detected]);

  // Token and chain state
  const [selectedToken, setSelectedToken] = useState<
    Token | null | YourTokenData
  >(null);
  const [selectedChain, setSelectedChain] = useState<Chain | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [yourWalletTokens, setYourWalletTokens] = useState<YourTokenData[]>([]);

  // Transaction lifecycle state
  const [transactionStatus, setTransactionStatus] =
    useState<TransactionStatus>("idle");
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [intentId, setIntentId] = useState<string | null>(null);

  // Payment method state (defaults to crypto)
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethodType>("crypto");

  // Theme state - load from localStorage or use system preference
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    // Try to load from localStorage
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === "light" || stored === "dark") {
        return stored;
      }
    } catch {
      // localStorage not available
    }
    // Fall back to system preference
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return "light";
  });

  /**
   * Subscribe to walletManager state changes
   */
  useEffect(() => {
    const unsubscribe = walletManager.onChange((status) => {
      setWalletStatus(status as WalletStatus);
      setSelectedWallet(walletManager.wallet);

      // Update wallet address when connected
      if (status === "connected" && walletManager.wallet) {
        walletManager.wallet
          .getAddress()
          .then((address) => {
            setWalletAddress(address);
          })
          .catch(() => {
            setWalletAddress(null);
          });
      } else if (status !== "connected") {
        setWalletAddress(null);
      }
    });

    // Initialize wallet address if already connected
    if (walletManager.status === "connected" && walletManager.wallet) {
      walletManager.wallet
        .getAddress()
        .then((address) => {
          setWalletAddress(address);
        })
        .catch(() => {
          setWalletAddress(null);
        });
    }

    return () => {
      unsubscribe();
    };
  }, []);

  const { tokens } = useTokens(null);

  const { isLoading, error, chains } = useChains();

  useEffect(() => {
    if (!walletAddress) {
      setYourWalletTokens([]);
      return;
    }

    if (selectedChain && selectedToken && yourWalletTokens.length > 0) {
      return;
    }

    let cancelled = false;

    async function loadWalletTokens() {
      try {
        const arr = await Promise.all(
          DEFAULT_CHAINS.map(async (chain) => {
            const arr = await getBalances(
              chain.chainId as string | number,
              walletAddress as string
            );
            return arr.map((b) => ({ ...b, chainId: chain.chainId }));
          })
        );

        // ...............................................................//
        const tokensWithBalance = arr
          .flat()
          .filter((b) => Number(b.balance) > 0);

        if (tokensWithBalance.length > 0 && chains.length > 0) {
          const chainInfo = chains.find(
            (c) => Number(c.chainId) === Number(tokensWithBalance[0].chainId)
          );

          //setSelectedChain
          chainInfo &&
            setSelectedChain({
              chainId: tokensWithBalance[0].chainId,
              name: resolveChainLabel(chainInfo as ChainDef),
              shortName:
                chainInfo?.nativeCurrency?.symbol ??
                resolveChainLabel(chainInfo).slice(0, 3).toUpperCase(),
              iconUrl: chainInfo.chainIconURI,
              isPopular: [1, 137, 8453].includes(Number(chainInfo.chainId)),
              nativeToken: chainInfo.nativeCurrency?.symbol ?? "ETH",
              explorerUrl: chainInfo.blockExplorerUrls?.[0],
            });

          // console.log("Balances by chain:", {
          //   arr: arr.flat(),
          //   fltArr: tokensWithBalance,
          //   tokens,
          //   chainInfo,
          //   chains,
          // });

          // ...............................................................//
        }

        const updatedArr = arr.flat().map((b) => {
          const _foundObj = tokens.find(
            (t) =>
              (t.address.toLowerCase() === b.contract?.toLowerCase() &&
                t.symbol?.toUpperCase() == b.symbol?.toUpperCase()) ||
              (t.symbol.toUpperCase() == b.symbol?.toUpperCase() &&
                t.chainId.toString() == b.chainId.toString()) ||
              (t.symbol?.toUpperCase() === b.symbol?.toUpperCase() &&
                b.category === "native")
          );
          return {
            ...b,
            symbol: b?.symbol,
            decimals: b?.decimals,
            name: _foundObj?.name,
            iconUrl: _foundObj?.iconUrl,
            chainId: b.chainId,
            usdPrice: _foundObj?.usdPrice,
            address: _foundObj?.address || b.contract,
          };
        });

        if (!cancelled) {
          const tokenWithChainUriArray = updatedArr.map((t) => {
            const chain = chains.find(
              (c) => c.chainId.toString() == t.chainId.toString()
            );
            return {
              ...t,
              chainIconURI: chain?.chainIconURI || "",
              chainData: chain,
            };
          });

          setYourWalletTokens(tokenWithChainUriArray);

          const findtokenwithBalance = tokenWithChainUriArray.find(
            (t) => Number(t.balance) > 0
          );

          setSelectedToken(
            findtokenwithBalance as Token & {
              balance: string;
              chainIconURI: string;
              chainData: ChainDef;
            }
          );
        }
      } catch (err) {
        console.error("Failed to load balances:", err);
        if (!cancelled) setYourWalletTokens([]);
      }
    }

    loadWalletTokens();

    return () => {
      cancelled = true;
    };
  }, [
    chains,
    selectedChain,
    selectedChain?.chainId,
    selectedToken,
    setSelectedChain,
    setSelectedToken,
    setYourWalletTokens,
    tokens,
    walletAddress,
    yourWalletTokens.length,
  ]);

  /**
   * Connect to a detected wallet
   */
  const connectWallet = useCallback(async (wallet: DetectedWallet) => {
    console.log("[DepositContext] connectWallet called", {
      walletId: wallet.meta.id,
      hasProvider: !!wallet.provider,
    });
    try {
      await walletManager.connectDetected(wallet);
      console.log("[DepositContext] connectWallet succeeded");
    } catch (error) {
      console.error("[DepositContext] connectWallet error:", error);
      throw error;
    }
  }, []);

  /**
   * Disconnect the current wallet
   */
  const disconnectWallet = useCallback(async () => {
    await walletManager.disconnect();
  }, []);

  /**
   * Set the current step and track history
   */
  const setCurrentStep = useCallback((step: NavigationStep) => {
    setCurrentStepInternal(step);
    setStepHistory((prev) => {
      // Don't add duplicate consecutive steps
      if (prev[prev.length - 1] === step) {
        return prev;
      }
      return [...prev, step];
    });
  }, []);

  /**
   * Navigate to the previous step based on history
   */
  const goBack = useCallback(() => {
    setStepHistory((prev) => {
      if (prev.length <= 1) {
        // Already at the beginning, stay at home
        setCurrentStepInternal("home");
        return ["home"];
      }

      // Remove current step from history
      const newHistory = prev.slice(0, -1);
      const previousStep = newHistory[newHistory.length - 1] || "home";
      setCurrentStepInternal(previousStep);
      return newHistory;
    });
  }, []);

  /**
   * Reset all state and return to home
   */
  const resetState = useCallback(() => {
    setCurrentStepInternal("home");
    setStepHistory(["home"]);
    setSelectedToken(null);
    setSelectedChain(null);
    setAmount("");
    // Reset transaction state
    setTransactionStatus("idle");
    setTransactionHash(null);
    setErrorMessage(null);
    setIntentId(null);
    // Reset payment method to crypto
    setPaymentMethod("crypto");
  }, []);

  /**
   * Toggle between light and dark themes
   */
  const toggleTheme = useCallback(() => {
    setResolvedTheme((current) => {
      const newTheme = current === "light" ? "dark" : "light";
      // Persist to localStorage
      try {
        localStorage.setItem(THEME_STORAGE_KEY, newTheme);
      } catch {
        // localStorage not available
      }
      return newTheme;
    });
  }, []);

  const value = useMemo<DepositContextValue>(
    () => ({
      currentStep,
      setCurrentStep,
      goBack,
      resetState,
      stepHistory,
      // Wallet state
      selectedWallet,
      walletAddress,
      walletStatus,
      connectWallet,
      disconnectWallet,
      // Token and chain state
      selectedToken,
      setSelectedToken,
      selectedChain,
      setSelectedChain,
      amount,
      setAmount,
      // Transaction lifecycle state
      transactionStatus,
      setTransactionStatus,
      transactionHash,
      setTransactionHash,
      errorMessage,
      setErrorMessage,
      intentId,
      setIntentId,
      // Payment method state
      paymentMethod,
      setPaymentMethod,
      // Theme state
      resolvedTheme,
      toggleTheme,

      yourWalletTokens,
      setYourWalletTokens,
    }),
    [
      currentStep,
      setCurrentStep,
      goBack,
      resetState,
      stepHistory,
      selectedWallet,
      walletAddress,
      walletStatus,
      connectWallet,
      disconnectWallet,
      selectedToken,
      selectedChain,
      amount,
      transactionStatus,
      transactionHash,
      errorMessage,
      intentId,
      paymentMethod,
      resolvedTheme,
      toggleTheme,
      yourWalletTokens,
    ]
  );

  return (
    <DepositContext.Provider value={value}>{children}</DepositContext.Provider>
  );
}

/**
 * Hook to access deposit context
 * @throws Error if used outside of DepositProvider
 */
export function useDeposit(): DepositContextValue {
  const context = useContext(DepositContext);
  if (context === undefined) {
    throw new Error("useDeposit must be used within a DepositProvider");
  }
  return context;
}

export default DepositContext;
