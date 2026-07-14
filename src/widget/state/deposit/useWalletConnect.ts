import { useCallback, useEffect, useRef, useState } from "react";
import { TrustwareConfigStore } from "src/config";
import { WalletConnectConfig } from "src/types";
import { NavigationStep, WalletConnectStatus } from "./types";
import { useWalletConnectConnect, walletManager } from "src/wallets";
import { WalletNamespace } from "src/widget/context/DepositContext";

// How long to wait for a WalletConnect session before telling the user this
// is taking longer than expected. Approving in a wallet app is a manual,
// human-paced step (switch apps, unlock, approve) so this is generous on
// purpose — it's a "something might be stuck" signal, not a hard timeout.
const WC_CONNECT_TIMEOUT_MS = 30_000;

export function useWalletConnect({
  setWalletType,
  setCurrentStep,
  selectedNamespace,
  setSelectedNamespace,
}: {
  setWalletType: React.Dispatch<
    React.SetStateAction<"walletconnect" | "other">
  >;
  setCurrentStep: (step: NavigationStep) => void;
  selectedNamespace: WalletNamespace;
  setSelectedNamespace: React.Dispatch<React.SetStateAction<WalletNamespace>>;
}) {
  const walletConnectCfg = TrustwareConfigStore.peek()?.walletConnect as
    WalletConnectConfig | undefined;

  const connectWC = useWalletConnectConnect(walletConnectCfg);

  const ecosystem: "evm" | "solana" =
    selectedNamespace.trim().toLowerCase() === "solana" ? "solana" : "evm";

  // Only ever driven by the WalletConnect-specific paths below (the manual
  // connect attempt and the mount-time session restore) — never touched by
  // injected-wallet connects, so Home's status banner is WalletConnect-only
  // by construction, not by checking `walletType`.
  const [wcStatus, setWcStatus] = useState<WalletConnectStatus>("idle");
  const [wcErrorMessage, setWcErrorMessage] = useState<string | null>(null);
  const wcTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearWcTimeout = useCallback(() => {
    if (wcTimeoutRef.current !== null) {
      clearTimeout(wcTimeoutRef.current);
      wcTimeoutRef.current = null;
    }
  }, []);

  const beginWcAttempt = useCallback(() => {
    setWcStatus("connecting");
    setWcErrorMessage(null);
    clearWcTimeout();
    wcTimeoutRef.current = setTimeout(() => {
      wcTimeoutRef.current = null;
      setWcStatus((prev) => (prev === "connecting" ? "timedOut" : prev));
    }, WC_CONNECT_TIMEOUT_MS);
  }, [clearWcTimeout]);

  // Used for both a genuine success and the silent, best-effort mount-time
  // restore check — neither should ever surface a "failed" banner for
  // something the user didn't explicitly ask for.
  const resolveWcAttempt = useCallback(() => {
    clearWcTimeout();
    setWcStatus("idle");
    setWcErrorMessage(null);
  }, [clearWcTimeout]);

  const failWcAttempt = useCallback(
    (message: string) => {
      clearWcTimeout();
      setWcStatus("failed");
      setWcErrorMessage(message);
    },
    [clearWcTimeout]
  );

  // Lets the banner be closed without retrying — e.g. the user decides to
  // connect a different wallet instead.
  const dismissWcStatus = useCallback(() => {
    clearWcTimeout();
    setWcStatus("idle");
    setWcErrorMessage(null);
  }, [clearWcTimeout]);

  useEffect(() => clearWcTimeout, [clearWcTimeout]);

  // A WalletConnect approval can complete on the wallet's side while our own
  // page has been silently reloaded by the OS during the app-switch round
  // trip (common on mobile) — the connect() call that was awaiting approval
  // never resolves in that (now-gone) JS context. WalletConnect's own
  // SignClient still restores the resulting session from storage on every
  // init, though, so check for one on mount and pick up where the reload cut
  // us off, instead of leaving the widget stuck on the home screen forever.
  useEffect(() => {
    let cancelled = false;
    beginWcAttempt();
    void (async () => {
      const restoredEcosystem =
        await walletManager.restoreWalletConnectSession(walletConnectCfg);
      if (cancelled) return;
      resolveWcAttempt();
      if (!restoredEcosystem) return;

      setWalletType("walletconnect");
      if (restoredEcosystem === "solana") {
        setSelectedNamespace("Solana");
      }

      const address = walletManager.identity?.addresses[0]?.address ?? null;
      if (address) setCurrentStep("crypto-pay");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const WalletConnect = useCallback(async () => {
    // console.log("got called");
    if (
      walletManager.status === "connected" &&
      walletManager.connectedVia === "walletconnect" &&
      walletManager.wallet?.ecosystem === ecosystem
    ) {
      // console.log("I am connedcted");
      const address = walletManager.identity?.addresses[0]?.address ?? null;
      if (address) {
        setWalletType("walletconnect");
        setCurrentStep("crypto-pay");
        return;
      }
    }

    setWalletType("walletconnect");
    beginWcAttempt();
    const { error } = await connectWC(ecosystem);

    if (!error) {
      // console.log("I didnt error");
      const address = walletManager.identity?.addresses[0]?.address ?? null;
      if (address) {
        // console.log("I have an address", address);
        resolveWcAttempt();
        setCurrentStep("crypto-pay");
      } else {
        const message = `WalletConnect session established but no address resolved for ecosystem "${ecosystem}".`;
        console.error(`[Trustware SDK] ${message}`);
        failWcAttempt(message);
      }
    } else {
      console.error("[Trustware SDK] WalletConnect connection failed:", error);
      failWcAttempt(error);
      setWalletType("other");
    }
  }, [
    beginWcAttempt,
    connectWC,
    ecosystem,
    failWcAttempt,
    resolveWcAttempt,
    setCurrentStep,
    setWalletType,
  ]);

  // Called from the status banner's "Retry" action, whether it's showing
  // because the attempt timed out or because it failed outright. A plain
  // re-call of WalletConnect() isn't enough on its own — if the original
  // attempt is still technically pending, walletManager would just be
  // starting a second connect() over the same live connector, which is
  // exactly the kind of overlap that produces orphaned pairing proposals.
  // Explicitly abandon the stuck attempt first so the retry starts clean.
  const retryWalletConnect = useCallback(() => {
    walletManager.cancelWalletConnectAttempt();
    void WalletConnect();
  }, [WalletConnect]);

  const disconnectWalletConnect = useCallback(async () => {
    // walletManager.disconnect() handles: wallet.disconnect(), provider event
    // cleanup, resetUniversalConnector(), and status → "idle" emission.
    await walletManager.disconnect();
    setWalletType("other");
    setCurrentStep("home");
  }, [setCurrentStep, setWalletType]);

  // identity snapshot has the last-synced address, for whichever ecosystem
  // (evm or solana) the WalletConnect session was established for.
  const walletConnectAddress =
    walletManager.status === "connected" &&
    walletManager.connectedVia === "walletconnect"
      ? (walletManager.identity?.addresses[0]?.address ?? null)
      : null;

  return {
    walletConnectAddress,
    WalletConnect,
    disconnectWalletConnect,
    wcStatus,
    wcErrorMessage,
    retryWalletConnect,
    dismissWcStatus,
  };
}
