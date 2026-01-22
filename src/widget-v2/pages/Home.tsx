import React, { useState, useRef, useEffect } from "react";
import { cn } from "../lib/utils";
import { useDeposit } from "../context/DepositContext";
import { useWalletDetection } from "../../wallets/detect";

/**
 * Fiat payment option definition
 */
interface FiatOption {
  id: string;
  name: string;
  icon: React.ReactNode;
}

/**
 * Available fiat payment options (all coming soon)
 */
const fiatOptions: FiatOption[] = [
  {
    id: "applepay",
    name: "Apple Pay",
    icon: (
      <svg className="tw-w-8 tw-h-5" viewBox="0 0 50 20" fill="currentColor">
        <path d="M9.6 4.8c-.6.7-1.5 1.3-2.4 1.2-.1-.9.3-1.9.9-2.5.6-.7 1.6-1.2 2.4-1.2.1 1-.3 1.9-.9 2.5zm.9 1.3c-1.3-.1-2.5.8-3.1.8-.6 0-1.6-.7-2.7-.7-1.4 0-2.6.8-3.4 2-.7 1.2-.5 3.5.6 5.5.5.9 1.2 1.9 2.1 1.9.8 0 1.2-.5 2.3-.5s1.4.5 2.4.5c.9 0 1.5-.9 2-1.8.4-.6.5-1.2.7-1.8-1.6-.6-2-2.6-1.4-4-.4-.5-1-1.3-1.5-1.9z"/>
        <path d="M18.4 2.1c2.3 0 4 1.6 4 3.9s-1.7 3.9-4.1 3.9h-2.6v4h-1.8V2.1h4.5zm-2.7 6.2h2.2c1.6 0 2.5-.9 2.5-2.4s-.9-2.4-2.5-2.4h-2.2v4.8zm6.4 3.2c0-1.5 1.2-2.5 3.3-2.6l2.4-.1v-.7c0-1-.7-1.6-1.8-1.6-1 0-1.7.5-1.8 1.3h-1.6c.1-1.5 1.4-2.7 3.5-2.7 2.1 0 3.4 1.1 3.4 2.9v6h-1.6v-1.4c-.5 1-1.5 1.6-2.7 1.6-1.7 0-2.9-1-2.9-2.7h-.2zm5.7-.8v-.7l-2.2.1c-1.1.1-1.8.6-1.8 1.4 0 .8.6 1.3 1.6 1.3 1.3 0 2.4-.9 2.4-2.1zm3.2 5.8v-1.4c.1 0 .5.1.7.1 1 0 1.5-.4 1.8-1.5l.2-.6-3.1-8.6h1.9l2.2 6.9 2.2-6.9h1.8l-3.2 9c-.7 2-1.5 2.7-3.3 2.7-.2 0-.6 0-.8-.1l-.4.4z"/>
      </svg>
    ),
  },
  {
    id: "mpesa",
    name: "M-Pesa",
    icon: (
      <svg className="tw-w-8 tw-h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
      </svg>
    ),
  },
  {
    id: "venmo",
    name: "Venmo",
    icon: (
      <svg className="tw-w-8 tw-h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.5 3h-15C3.12 3 2 4.12 2 5.5v13C2 19.88 3.12 21 4.5 21h15c1.38 0 2.5-1.12 2.5-2.5v-13C22 4.12 20.88 3 19.5 3zm-4.77 11.58c-.64 1.56-2.13 3.42-3.86 3.42H8.69l-.61-3.55 1.13-.21.28 1.64c.25.14.52.22.79.22.68 0 1.31-.48 1.74-1.34.33-.67.44-1.34.44-1.92 0-.45-.11-.82-.38-1.06-.24-.22-.58-.33-.98-.33-.64 0-1.29.28-1.86.61l-.05-.02.61-4.04h4.13l-.16 1.11H11l-.21 1.4c.41-.13.85-.19 1.28-.19.71 0 1.31.2 1.73.61.46.44.67 1.08.67 1.88 0 .68-.15 1.35-.48 2.01z" />
      </svg>
    ),
  },
  {
    id: "zelle",
    name: "Zelle",
    icon: (
      <svg className="tw-w-8 tw-h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M13.25 4H5.5C4.67 4 4 4.67 4 5.5v13c0 .83.67 1.5 1.5 1.5h13c.83 0 1.5-.67 1.5-1.5v-7.75h-2v6.25H6V7h7.25V4zm3.91 2.83L9.83 14.17l-1.42-1.41 7.33-7.34L13.83 3.5h6.67v6.67l-1.92-1.92-1.42-1.42z" />
      </svg>
    ),
  },
];

export interface HomeProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * Home page for the deposit widget.
 * Displays a large amount input and dropdown buttons for payment method selection.
 */
export function Home({ className }: HomeProps): React.ReactElement {
  const { amount, setAmount, setCurrentStep, walletAddress, connectWallet } = useDeposit();
  const { detected: detectedWallets } = useWalletDetection();

  const [isEditing, setIsEditing] = useState(false);
  const [isCryptoDropdownOpen, setIsCryptoDropdownOpen] = useState(false);
  const [isFiatDropdownOpen, setIsFiatDropdownOpen] = useState(false);

  const amountInputRef = useRef<HTMLInputElement>(null);
  const cryptoDropdownRef = useRef<HTMLDivElement>(null);
  const fiatDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (cryptoDropdownRef.current && !cryptoDropdownRef.current.contains(event.target as Node)) {
        setIsCryptoDropdownOpen(false);
      }
      if (fiatDropdownRef.current && !fiatDropdownRef.current.contains(event.target as Node)) {
        setIsFiatDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Parse amount for display
  const parsedAmount = parseFloat(amount) || 0;

  /**
   * Handle amount input changes with decimal sanitization
   */
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.]/g, "");
    // Handle multiple decimal points - keep only the first one
    const parts = raw.split(".");
    const sanitized =
      parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : raw;
    setAmount(sanitized);
  };

  /**
   * Handle click on the amount display to start editing
   */
  const handleAmountClick = () => {
    const isZeroish = !amount || parseFloat(amount) === 0;
    setIsEditing(true);
    if (isZeroish) setAmount("");

    setTimeout(() => {
      const input = amountInputRef.current;
      if (!input) return;
      input.focus();
      input.setSelectionRange(0, 0);
    }, 0);
  };

  /**
   * Handle wallet selection from dropdown
   */
  const handleWalletSelect = async (wallet: typeof detectedWallets[0]) => {
    console.log("[TW Home] handleWalletSelect called with:", wallet.meta.id, wallet.meta.name);
    console.log("[TW Home] wallet.provider:", wallet.provider);
    setIsCryptoDropdownOpen(false);

    // If already connected, go to select token
    if (walletAddress) {
      console.log("[TW Home] Already connected, navigating to select-token");
      setCurrentStep("select-token");
      return;
    }

    // Connect to the wallet
    try {
      console.log("[TW Home] Calling connectWallet...");
      await connectWallet(wallet);
      console.log("[TW Home] connectWallet succeeded, navigating to select-token");
      setCurrentStep("select-token");
    } catch (err) {
      console.error("[TW Home] Failed to connect wallet:", err);
    }
  };

  /**
   * Handle fiat payment selection (coming soon)
   */
  const handleFiatSelect = (_method: FiatOption) => {
    // Fiat is coming soon - just close dropdown
    setIsFiatDropdownOpen(false);
  };

  // Filter out WalletConnect for the detected wallets list
  const browserWallets = detectedWallets.filter(w => w.meta.id !== 'walletconnect');

  return (
    <div className={cn("tw-flex tw-flex-col tw-min-h-[500px]", className)}>
      {/* Header */}
      <div className="tw-flex tw-items-center tw-justify-center tw-px-4 tw-py-4 tw-border-b tw-border-border">
        <h1 className="tw-text-lg tw-font-semibold tw-text-foreground">
          Deposit
        </h1>
      </div>

      {/* Content */}
      <div className="tw-flex-1 tw-px-6 tw-overflow-y-auto tw-flex tw-flex-col tw-items-center tw-justify-center">
        {/* Enter Amount Label */}
        <p className="tw-text-base tw-text-muted-foreground tw-mb-4">
          Enter an amount
        </p>

        {/* Large Amount Display */}
        <div className="tw-text-center tw-relative tw-mb-8">
          <span
            className="tw-text-6xl tw-font-bold tw-tracking-tight tw-cursor-pointer"
            onClick={handleAmountClick}
          >
            <span className="tw-text-foreground">$</span>
            <span className="tw-relative tw-inline-block tw-min-w-[1ch]">
              <span
                className={
                  isEditing || parsedAmount > 0
                    ? "tw-text-foreground"
                    : "tw-text-muted-foreground/40"
                }
              >
                {isEditing
                  ? amount || "0"
                  : parsedAmount > 0
                    ? parsedAmount.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    : "0"}
              </span>
              {!isEditing && parsedAmount === 0 && (
                <span className="tw-text-muted-foreground/40">.00</span>
              )}
              <input
                ref={amountInputRef}
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={handleAmountChange}
                onBlur={() => setIsEditing(false)}
                className="tw-absolute tw-inset-0 tw-w-full tw-bg-transparent tw-border-none tw-outline-none tw-p-0 tw-m-0 tw-text-center tw-text-transparent tw-text-6xl tw-font-bold tw-tracking-tight"
                style={{ caretColor: "hsl(var(--tw-muted-foreground) / 0.5)" }}
                aria-label="Deposit amount"
              />
            </span>
          </span>
        </div>

        {/* Payment Options - Dropdown Pills */}
        <div className="tw-flex tw-flex-col tw-gap-3 tw-items-center">
          {/* Pay with Crypto Dropdown */}
          <div className="tw-relative" ref={cryptoDropdownRef}>
            <button
              type="button"
              onClick={() => {
                setIsCryptoDropdownOpen(!isCryptoDropdownOpen);
                setIsFiatDropdownOpen(false);
              }}
              className="tw-inline-flex tw-items-center tw-gap-3 tw-px-6 tw-py-3 tw-rounded-full tw-transition-all tw-bg-muted/50 hover:tw-bg-muted tw-w-56 tw-border-0"
            >
              {/* Wallet Icon */}
              <svg
                className="tw-w-5 tw-h-5 tw-text-muted-foreground"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              <span className="tw-font-medium tw-text-sm tw-text-foreground tw-flex-1 tw-text-left">
                Pay with crypto
              </span>
              {/* Chevron */}
              <svg
                className={cn(
                  "tw-w-4 tw-h-4 tw-text-muted-foreground tw-transition-transform",
                  isCryptoDropdownOpen && "tw-rotate-180"
                )}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Crypto Dropdown Menu */}
            {isCryptoDropdownOpen && (
              <div className="tw-absolute tw-top-full tw-left-1/2 tw--translate-x-1/2 tw-mt-2 tw-w-64 tw-bg-card tw-rounded-xl tw-shadow-large tw-border tw-border-border/50 tw-z-50 tw-overflow-hidden tw-animate-fade-in">
                {/* Detected Wallets Section */}
                <div className="tw-p-3">
                  <div className="tw-flex tw-items-center tw-gap-2 tw-mb-2">
                    <div className="tw-w-1.5 tw-h-1.5 tw-rounded-full tw-bg-green-500" />
                    <span className="tw-text-xs tw-font-medium tw-text-primary">
                      {browserWallets.length > 0 ? "Detected Wallets" : "No Wallets Detected"}
                    </span>
                  </div>

                  {browserWallets.length > 0 ? (
                    <div className="tw-space-y-1">
                      {browserWallets.map((wallet) => (
                        <button
                          key={wallet.meta.id}
                          type="button"
                          onClick={() => handleWalletSelect(wallet)}
                          className="tw-w-full tw-flex tw-items-center tw-justify-between tw-p-2 tw-rounded-lg hover:tw-bg-muted/50 tw-transition-colors tw-border-0 tw-bg-transparent"
                        >
                          <div className="tw-flex tw-items-center tw-gap-2">
                            {wallet.meta.logo ? (
                              <img
                                src={wallet.meta.logo}
                                alt={wallet.meta.name}
                                className="tw-w-8 tw-h-8 tw-rounded-lg tw-object-cover"
                              />
                            ) : (
                              <div className="tw-w-8 tw-h-8 tw-rounded-lg tw-bg-muted tw-flex tw-items-center tw-justify-center">
                                <span className="tw-text-xs tw-font-bold tw-text-muted-foreground">
                                  {wallet.meta.name.slice(0, 2).toUpperCase()}
                                </span>
                              </div>
                            )}
                            <span className="tw-font-medium tw-text-sm tw-text-foreground">
                              {wallet.meta.name}
                            </span>
                          </div>
                          <div className="tw-w-4 tw-h-4 tw-rounded-full tw-border-2 tw-border-muted-foreground/30" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="tw-text-xs tw-text-muted-foreground tw-text-center tw-py-2">
                      Install a wallet extension like MetaMask to continue
                    </p>
                  )}
                </div>

                {/* Divider */}
                <div className="tw-border-t tw-border-border/50" />

                {/* WalletConnect Option */}
                <div className="tw-p-3">
                  <button
                    type="button"
                    onClick={() => {
                      const wcWallet = detectedWallets.find(w => w.meta.id === 'walletconnect');
                      if (wcWallet) handleWalletSelect(wcWallet);
                    }}
                    className="tw-w-full tw-flex tw-items-center tw-justify-between tw-p-2 tw-rounded-lg hover:tw-bg-muted/50 tw-transition-colors tw-border-0 tw-bg-transparent"
                  >
                    <div className="tw-flex tw-items-center tw-gap-2">
                      <div className="tw-w-8 tw-h-8 tw-rounded-lg tw-bg-blue-500/10 tw-flex tw-items-center tw-justify-center">
                        <svg className="tw-w-5 tw-h-5 tw-text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M6.09 10.56c3.26-3.2 8.56-3.2 11.82 0l.39.39a.4.4 0 010 .58l-1.34 1.31a.21.21 0 01-.3 0l-.54-.53c-2.28-2.23-5.97-2.23-8.24 0l-.58.56a.21.21 0 01-.3 0L5.66 11.6a.4.4 0 010-.58l.43-.46zm14.6 2.72l1.2 1.17a.4.4 0 010 .58l-5.38 5.27a.43.43 0 01-.6 0l-3.82-3.74a.11.11 0 00-.15 0l-3.82 3.74a.43.43 0 01-.6 0L2.15 15.03a.4.4 0 010-.58l1.2-1.17a.43.43 0 01.6 0l3.82 3.74c.04.04.1.04.15 0l3.82-3.74a.43.43 0 01.6 0l3.82 3.74c.04.04.1.04.15 0l3.82-3.74a.43.43 0 01.6 0z"/>
                        </svg>
                      </div>
                      <span className="tw-font-medium tw-text-sm tw-text-foreground">
                        WalletConnect
                      </span>
                    </div>
                    <svg className="tw-w-4 tw-h-4 tw-text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Pay with Fiat Dropdown */}
          <div className="tw-relative" ref={fiatDropdownRef}>
            <button
              type="button"
              onClick={() => {
                setIsFiatDropdownOpen(!isFiatDropdownOpen);
                setIsCryptoDropdownOpen(false);
              }}
              className="tw-inline-flex tw-items-center tw-gap-3 tw-px-6 tw-py-3 tw-rounded-full tw-transition-all tw-bg-muted/50 hover:tw-bg-muted tw-w-56 tw-border-0"
            >
              {/* Credit Card Icon */}
              <svg
                className="tw-w-5 tw-h-5 tw-text-muted-foreground"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
              <span className="tw-font-medium tw-text-sm tw-text-foreground tw-flex-1 tw-text-left">
                Pay with fiat
              </span>
              {/* Chevron */}
              <svg
                className={cn(
                  "tw-w-4 tw-h-4 tw-text-muted-foreground tw-transition-transform",
                  isFiatDropdownOpen && "tw-rotate-180"
                )}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Fiat Dropdown Menu */}
            {isFiatDropdownOpen && (
              <div className="tw-absolute tw-top-full tw-left-1/2 tw--translate-x-1/2 tw-mt-2 tw-w-64 tw-bg-card tw-rounded-xl tw-shadow-large tw-border tw-border-border/50 tw-z-50 tw-overflow-hidden tw-animate-fade-in">
                {/* Coming Soon Banner */}
                <div className="tw-px-3 tw-py-2 tw-bg-amber-500/10 tw-border-b tw-border-amber-500/20">
                  <p className="tw-text-xs tw-font-medium tw-text-amber-600 dark:tw-text-amber-400 tw-text-center">
                    Coming Soon
                  </p>
                </div>

                {/* Payment Methods Section */}
                <div className="tw-p-3">
                  <div className="tw-flex tw-items-center tw-gap-2 tw-mb-2">
                    <div className="tw-w-1.5 tw-h-1.5 tw-rounded-full tw-bg-primary" />
                    <span className="tw-text-xs tw-font-medium tw-text-primary">Payment Methods</span>
                  </div>

                  <div className="tw-space-y-1">
                    {fiatOptions.map((method) => (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => handleFiatSelect(method)}
                        disabled
                        className="tw-w-full tw-flex tw-items-center tw-justify-between tw-p-2 tw-rounded-lg tw-opacity-50 tw-cursor-not-allowed tw-border-0 tw-bg-transparent"
                      >
                        <div className="tw-flex tw-items-center tw-gap-2">
                          <span className="tw-text-muted-foreground">{method.icon}</span>
                          <span className="tw-font-medium tw-text-sm tw-text-foreground">
                            {method.name}
                          </span>
                        </div>
                        <div className="tw-w-4 tw-h-4 tw-rounded-full tw-border-2 tw-border-muted-foreground/30" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="tw-px-6 tw-py-4 tw-border-t tw-border-border/30">
        <div className="tw-flex tw-items-center tw-justify-center tw-gap-2">
          <svg
            className="tw-w-3.5 tw-h-3.5 tw-text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <span className="tw-text-sm tw-text-muted-foreground">
            Secured by{" "}
            <span className="tw-font-semibold tw-text-foreground">
              Trustware
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default Home;
