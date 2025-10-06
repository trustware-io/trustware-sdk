import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Trustware } from "./core";
import {
  TrustwareConfig,
  WalletInterFaceAPI,
  InternalUIConfig,
  DefaultMessages,
} from "./types";

export type Status = "idle" | "initializing" | "ready" | "error";
export type Ctx = { status: Status; errors?: string; core: typeof Trustware };

export const Ctx = createContext<Ctx>({ status: "idle", core: Trustware });

export function TrustwareProvider({
  config,
  wallet,
  autoDetect = true,
  children,
}: {
  config: TrustwareConfig;
  wallet?: WalletInterFaceAPI;
  autoDetect?: boolean;
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<string>();

  const merged = useMemo(() => {
    const messages = (config.ui?.messages ?? undefined) as
      | Partial<DefaultMessages>
      | undefined;
    return { ...config, messages };
  }, [config]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setStatus("initializing");
        setErrors(undefined);

        Trustware.init(merged as any);

        if (wallet) {
          Trustware.useWallet(wallet);
        } else if (autoDetect && typeof window !== "undefined") {
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
    return () => {
      cancelled = true;
    };
  }, [merged, wallet, autoDetect]);

  const value = useMemo<Ctx>(
    () => ({ status, errors, core: Trustware }),
    [status, errors],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTrustware() {
  const ctx = useContext(Ctx);
  if (!ctx)
    throw new Error(
      "useTrustware must be used inside <TrustwareProvider config={...}>",
    );
  return ctx;
}
