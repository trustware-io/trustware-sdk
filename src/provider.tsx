"use client";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { Trustware } from "./core"; // <-- the facade above
import type { TrustwareConfigOptions } from "./types";
import type { WalletInterFaceAPI } from "./types";
import { useWireDetectionIntoManager } from "./wallets/manager";
import { TrustwareError } from "./errors/TrustwareError";
import { TrustwareEvent } from "./events/events";

export type Status = "idle" | "initializing" | "ready" | "error";

export type Ctx = {
  status: Status;
  errors?: string;
  core: typeof Trustware;
  emitError?: (error: TrustwareError) => void;
  emitEvent?: (event: TrustwareEvent) => void;
};

export const Ctx = createContext<Ctx>({ status: "idle", core: Trustware });

export function TrustwareProvider({
  config,
  wallet,
  autoDetect = true,
  children,
}: {
  config: TrustwareConfigOptions; // <-- updated type
  wallet?: WalletInterFaceAPI;
  autoDetect?: boolean;
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<string>();

  const emitError = useCallback(
    (error: TrustwareError) => {
      config.onError?.(error);

      config.onEvent?.({
        type: "error",
        error,
      });

      // Error already forwarded via config.onError and config.onEvent
    },
    [config]
  );

  const emitEvent = useCallback(
    (event: TrustwareEvent) => {
      config.onEvent?.(event);
    },
    [config]
  );

  // Push detection results → manager (no UI, runs behind the scenes)
  useWireDetectionIntoManager();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setStatus("initializing");
        setErrors(undefined);

        // Initialize config once
        await Trustware.init(config);

        if (wallet) {
          // If caller gives us a wallet, attach it directly
          // eslint-disable-next-line react-hooks/rules-of-hooks -- Trustware.useWallet is not a React hook
          Trustware.useWallet(wallet);
          if (!cancelled) setStatus("ready");
          return;
        }

        if (autoDetect) {
          await Trustware.autoDetect(400);
        }

        if (!cancelled) setStatus("ready");
      } catch (e: unknown) {
        if (!cancelled) {
          setStatus("error");
          setErrors(e instanceof Error ? e.message : String(e));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [config, wallet, autoDetect]);

  const value = useMemo<Ctx>(
    () => ({ status, errors, core: Trustware, emitError, emitEvent }),
    [status, errors, emitError, emitEvent]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTrustware() {
  const ctx = useContext(Ctx);
  if (!ctx)
    throw new Error(
      "useTrustware must be used inside <TrustwareProvider config={...}>"
    );
  return ctx;
}
