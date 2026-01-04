import { useState, useEffect, useCallback, useRef } from "react";
import type {
  ChainDef,
  TokenDef,
  TrustwareWidgetMessages,
  TrustwareWidgetTheme,
} from "src/types/";
import { useTrustware } from "src/provider";
import { walletManager } from "src/wallets/";
import { TrustwareConfig } from "src/config";
import { WalletSelection } from "./walletSelection";
import { TokenChainSelection } from "./tokenChainSelection";
import { AmountInput } from "./amountInput";
import { ConfirmPayment } from "./confirmPayment";
import { PaymentStatus } from "./paymentStatus";
import { PaymentSuccess } from "./paymentSuccuess";
import { PaymentFailure } from "./paymentFailure";
import { useTrustwareConfig } from "src/hooks/useTrustwareConfig";
import { useTrustwareRoute } from "src/hooks";
import { SDK_VERSION } from "src/constants";
import { hexToRgba } from "src/utils/";
import { Welcome } from "./welcome";

enum WidgetState {
  Welcome,
  WalletSelection,
  TokenChainSelection,
  AmountInput,
  ConfirmPayment,
  PaymentProcessing,
  PaymentSuccess,
  PaymentFailure,
}

export function TrustwareWidget() {
  const { status, errors, core } = useTrustware();
  const config = useTrustwareConfig();
  const { theme, messages, routes } = config;
  const [widgetState, setWidgetState] = useState<WidgetState>(
    WidgetState.Welcome,
  );
  const [selectedChain, setSelectedChain] = useState<ChainDef | null>(null);
  const [selectedToken, setSelectedToken] = useState<TokenDef | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [lastError, setLastError] = useState<string | null>(null);
  const widgetStateRef = useRef(widgetState);
  const [fromAddress, setFromAddress] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = TrustwareConfig.subscribe((cfg) => {
      //setTheme(cfg.theme);
      //setMessages(cfg.messages);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    widgetStateRef.current = widgetState;
  }, [widgetState]);

  useEffect(() => {
    let active = true;

    const refreshAddress = async () => {
      try {
        const wallet = walletManager.wallet;
        if (!wallet) {
          if (active) setFromAddress(null);
          return;
        }
        const address = await wallet.getAddress();
        if (active) setFromAddress(address ?? null);
      } catch {
        if (active) setFromAddress(null);
      }
    };

    void refreshAddress();
    const unsubscribe = walletManager.onChange(() => {
      void refreshAddress();
    });

    return () => {
      active = false;
      // call and ignore any boolean the function might return
      unsubscribe();
    };
  }, []);

  const routeState = useTrustwareRoute({
    core,
    fromChainId: selectedChain?.chainId ?? selectedChain?.id ?? undefined,
    toChainId: routes?.toChain,
    fromToken: selectedToken?.address,
    toToken: routes?.toToken,
    fromAmount: amount,
    fromAddress,
    toAddress:
      routes?.toAddress ?? routes?.fromAddress ?? fromAddress ?? undefined,
    slippage: routes?.defaultSlippage,
  });

  const resetState = useCallback(() => {
    setWidgetState(WidgetState.WalletSelection);
    setSelectedChain(null);
    setSelectedToken(null);
    setAmount("");
    setLastError(null);
  }, []);

  const disconnectWallet = useCallback(() => {
    const currentStatus = walletManager.status;
    if (currentStatus === "connected" || currentStatus === "connecting") {
      void walletManager.disconnect().catch(() => undefined);
    }
  }, []);

  const handleBack = useCallback(() => {
    switch (widgetState) {
      case WidgetState.Welcome:
        // close widget or do nothing
        break;
      case WidgetState.WalletSelection:
        disconnectWallet();
        resetState();
        setWidgetState(WidgetState.Welcome);
        break;
      case WidgetState.TokenChainSelection:
        disconnectWallet();
        resetState();
        break;
      case WidgetState.AmountInput:
        setAmount("");
        setWidgetState(WidgetState.TokenChainSelection);
        break;
      case WidgetState.ConfirmPayment:
        setWidgetState(WidgetState.AmountInput);
        break;
      case WidgetState.PaymentProcessing:
        // do nothing
        break;
      case WidgetState.PaymentSuccess:
      case WidgetState.PaymentFailure:
        resetState();
        setWidgetState(WidgetState.WalletSelection);
        break;
      default:
        break;
    }
  }, [widgetState, disconnectWallet, resetState, setWidgetState, setAmount]);

  const handleNext = useCallback(() => {
    // Logic to handle next navigation based on current widget state
    // switch
    switch (widgetState) {
      case WidgetState.Welcome:
        setWidgetState(WidgetState.WalletSelection);
        break;
      case WidgetState.WalletSelection:
        setWidgetState(WidgetState.TokenChainSelection);
        break;
      case WidgetState.TokenChainSelection:
        if (selectedChain && selectedToken) {
          setWidgetState(WidgetState.AmountInput);
        }
        break;
      case WidgetState.AmountInput:
        setWidgetState(WidgetState.ConfirmPayment);
        break;
      case WidgetState.ConfirmPayment:
        if (routeState.status === "ready" && selectedChain && selectedToken) {
          setWidgetState(WidgetState.PaymentProcessing);
        }
        break;
      case WidgetState.PaymentProcessing:
        break;
      case WidgetState.PaymentSuccess:
      case WidgetState.PaymentFailure:
        resetState();
        setWidgetState(WidgetState.WalletSelection);
        break;
      default:
        break;
    }
  }, [
    widgetState,
    selectedChain,
    selectedToken,
    amount,
    routeState,
    resetState,
    setWidgetState,
  ]);

  const handlePaymentSuccess = useCallback(() => {
    setWidgetState(WidgetState.PaymentSuccess);
  }, [setWidgetState]);

  const handlePaymentFailure = useCallback(
    (error?: string) => {
      setLastError(error ?? null);
      setWidgetState(WidgetState.PaymentFailure);
    },
    [setLastError, setWidgetState],
  );

  const handleRetry = useCallback(() => {
    setLastError(null);
    setWidgetState(WidgetState.ConfirmPayment);
  }, [setLastError, setWidgetState]);

  const renderStatus = () => {
    if (status === "error") {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "8px",
            textAlign: "center",
            color: "#d32f2f",
          }}
        >
          <div style={{ fontWeight: 600 }}>We hit a snag.</div>
          <div style={{ fontSize: "0.9rem" }}>
            {errors ?? "Please try again later."}
          </div>
        </div>
      );
    }

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "8px",
          textAlign: "center",
          color: "#666",
        }}
      >
        <div style={{ fontSize: "1.2rem" }}>⏳</div>
        <div style={{ fontSize: "0.9rem" }}>
          {status === "idle" && "Setting things up…"}
          {status === "initializing" && "Connecting to your wallet…"}
        </div>
      </div>
    );
  };

  if (!theme || !messages) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "8px",
          textAlign: "center",
          color: "#666",
        }}
      >
        <div style={{ fontSize: "1.2rem" }}>⏳</div>
        <div style={{ fontSize: "0.9rem" }}>
          Loading Trustware configuration…
        </div>
      </div>
    );
  }
  if (
    status === "error" ||
    !theme ||
    !messages ||
    status === "idle" ||
    status === "initializing"
  ) {
    return <>{renderStatus()}</>;
  }

  return (
    <div
      style={{
        backgroundColor: theme?.backgroundColor,
        border: `1px solid ${theme?.borderColor}`,
        borderRadius: `${theme?.radius}px`,
        padding: widgetState === WidgetState.Welcome ? "0px" : "16px",
        width: "100%",
        fontFamily: "Arial, sans-serif",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          width: "100%",
          maxHeight: "472px",
          overflowY: "auto",
          scrollbarWidth: "thin",
          scrollbarColor: `${hexToRgba(theme?.borderColor || "#374151", 0.5)} transparent`,
          minHeight: 0,
        }}
      >
        {/*} <div
          style={{
            display: widgetState !== WidgetState.Welcome ? 'none' : 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            borderBottom: `1px solid ${theme?.borderColor}`,
            paddingBottom: '8px',
            width: '100%',
            textAlign: 'center',
            color: theme?.textColor,
          }}
        >
          <h2 style={{ fontSize: '1.5rem', margin: 0 }}>
            {messages?.title || 'Trustware Payment Widget'}
          </h2>
          <span style={{ fontSize: '0.9rem' }}>
            {messages?.description || 'Please follow the steps to complete your payment.'}
          </span>
        </div>*/}

        {widgetState === WidgetState.Welcome && <Welcome onNext={handleNext} />}

        {widgetState === WidgetState.WalletSelection && (
          <WalletSelection onBack={handleBack} onNext={handleNext} />
        )}

        {widgetState === WidgetState.TokenChainSelection && (
          <TokenChainSelection
            onBack={handleBack}
            onNext={handleNext}
            onChainSelected={(chain) => setSelectedChain(chain)}
            onTokenSelected={(token) => setSelectedToken(token)}
          />
        )}

        {widgetState === WidgetState.AmountInput &&
          selectedChain &&
          selectedToken && (
            <AmountInput
              onBack={handleBack}
              onNext={handleNext}
              selectedChain={selectedChain}
              selectedToken={selectedToken}
              amount={amount}
              onAmountChange={(value) => setAmount(value)}
            />
          )}

        {widgetState === WidgetState.ConfirmPayment &&
          selectedChain &&
          selectedToken && (
            <ConfirmPayment
              amount={amount}
              selectedChain={selectedChain}
              selectedToken={selectedToken}
              routeState={routeState}
              onBack={handleBack}
              onConfirm={handleNext}
            />
          )}

        {widgetState === WidgetState.PaymentProcessing && (
          <PaymentStatus
            amount={amount}
            selectedChain={selectedChain}
            selectedToken={selectedToken}
            routeState={routeState}
            core={core}
            onClose={handleBack}
            onSuccess={handlePaymentSuccess}
            onFailure={handlePaymentFailure}
          />
        )}

        {widgetState === WidgetState.PaymentSuccess && (
          <PaymentSuccess onClose={handleBack} />
        )}

        {widgetState === WidgetState.PaymentFailure && (
          <PaymentFailure
            onClose={handleBack}
            onRetry={handleRetry}
            error={lastError}
          />
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          display: widgetState === WidgetState.Welcome ? "none" : "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          paddingTop: 8,
          paddingBottom: 8,
          paddingLeft: 24,
          paddingRight: 24,
          borderTop: `1px solid ${hexToRgba(theme?.borderColor || "#374151", 0.5)}`,
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          background: `linear-gradient(90deg, ${theme?.backgroundColor || "#0b0b0c"} 0%, ${
            theme?.backgroundColor || "#0b0b0c"
          } 70%, ${hexToRgba(theme?.borderColor || "#374151", 0.1)} 100%)`, // bg-gradient-to-r ... to-muted/10
          zIndex: 5,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          {/* group row: text + squid logo */}
          <GroupRow theme={theme} />

          {/* version tag (hover: scale-105) */}
          <div
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform =
                "scale(1.05)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform = "none";
            }}
            style={{
              transition: "transform 300ms",
              transformOrigin: "center",
            }}
          >
            <div style={{ color: theme?.textColor || "#9ca3af", fontSize: 12 }}>
              Trustware Widget v{SDK_VERSION}
            </div>
          </div>

          {/* tiny divider bar */}
          <div
            style={{
              width: 96,
              height: 2,
              borderRadius: 9999,
              background: `linear-gradient(90deg, transparent, ${hexToRgba(
                theme?.textColor || "#9ca3af",
                0.3,
              )}, transparent)`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

// Helper subcomponent to simulate group hover interactions inline-style
function GroupRow({ theme }: { theme?: TrustwareWidgetTheme }) {
  const [hover, setHover] = useState(false);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        alignItems: "center",
        justifyContent: "center",
        // md:flex-row
      }}
    >
      {/* "Secured by" + chip */}
      <span
        style={{
          fontSize: 14, // text-sm
          display: "flex",
          alignItems: "center",
          gap: 8,
          color: hover
            ? theme?.textColor || "#f9fafb"
            : hexToRgba(theme?.textColor || "#f9fafb", 0.7), // text-muted-foreground
          transition: "color 300ms",
          cursor: "default",
        }}
      >
        {/* label with animated underline */}
        <span style={{ position: "relative" }}>
          Secured by
          <span
            style={{
              position: "absolute",
              left: 0,
              bottom: -2,
              height: 2,
              width: hover ? "100%" : 0,
              transition: "width 300ms",
              background: "linear-gradient(90deg, #3b82f6 0%, #a855f7 100%)", // from-blue-500 to-purple-500
            }}
          />
        </span>

        {/* chip */}
        <span
          style={{
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 8px",
            borderRadius: 8,
            color: theme?.textColor || "#f9fafb",
            backgroundColor: hover
              ? hexToRgba(theme?.borderColor || "#374151", 0.5) // group-hover:bg-muted/50
              : hexToRgba(theme?.borderColor || "#374151", 0.3), // bg-muted/30
            transform: hover ? "scale(1.05)" : "none", // group-hover:scale-105
            transition: "transform 300ms, background-color 300ms",
          }}
        >
          Trustware
          <span
            style={{
              width: 16,
              height: 16,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              transform: hover ? "rotate(12deg)" : "none", // group-hover:rotate-12
              transition: "transform 300ms",
            }}
          >
            <img
              src="https://app=.trustware.io/assets/trustware-logo.png"
              alt="Trustware Logo"
              style={{ width: 16, height: 16 }}
            />
          </span>
        </span>
      </span>
    </div>
  );
}
