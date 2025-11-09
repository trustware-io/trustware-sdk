"use client";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import { Trustware } from "./core"; // <-- the facade above
import type { TrustwareConfigOptions } from "./types";
import type { WalletInterFaceAPI } from "./types";
import { walletManager } from "./wallets/manager";
import { useWireDetectionIntoManager } from "./wallets/manager";

export type Status = "idle" | "initializing" | "ready" | "error";

export type Ctx = {
  status: Status;
  errors?: string;
  core: typeof Trustware;
};

export const Ctx = createContext<Ctx>({ status: "idle", core: Trustware });

export function TrustwareProvider({
  config,
  wallet,
  autoDetect = true,
  children,
}: {
  config: TrustwareConfigOptions;          // <-- updated type
  wallet?: WalletInterFaceAPI;
  autoDetect?: boolean;
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<string>();

  // Push detection results → manager (no UI, runs behind the scenes)
  useWireDetectionIntoManager();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setStatus("initializing");
        setErrors(undefined);

        // Initialize config once
        Trustware.init(config);

        if (wallet) {
          // If caller gives us a wallet, attach it directly
          Trustware.useWallet(wallet);
          if (!cancelled) setStatus("ready");
          return;
        }

        if (autoDetect) {
          await Trustware.autoDetect(400);
        }

        if (!cancelled) setStatus("ready");
      } catch (e: any) {
        if (!cancelled) {
          setStatus("error");
          setErrors(e?.message || String(e));
        }
      }
    })();

    return () => { cancelled = true; };
  }, [config, wallet, autoDetect]);

  const value = useMemo<Ctx>(() => ({ status, errors, core: Trustware }), [status, errors]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTrustware() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTrustware must be used inside <TrustwareProvider config={...}>");
  return ctx;
}

