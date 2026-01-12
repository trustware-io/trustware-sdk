import type {
  ResolvedTrustwareConfig,
  TrustwareConfigOptions,
} from "../types/";
import { resolveConfig } from "./merge";

type Listener = (cfg: ResolvedTrustwareConfig) => void;

class ConfigStore {
  private _cfg: ResolvedTrustwareConfig | null = null;
  private _listeners = new Set<Listener>();

  /** Initialize or replace the config */
  init(opts: TrustwareConfigOptions) {
    this._cfg = resolveConfig(opts);
    this.emit();
  }

  /** Partially update by re-resolving from last + patch */
  update(patch: Partial<TrustwareConfigOptions>) {
    if (!this._cfg) throw new Error("TrustwareConfig: call init() first.");
    const next = resolveConfig({
      ...this._cfg,
      ...patch,
      routes: { ...this._cfg.routes, ...(patch.routes ?? {}) },
      theme: { ...this._cfg.theme, ...(patch.theme ?? {}) } as any,
      messages: { ...this._cfg.messages, ...(patch.messages ?? {}) } as any,
      rateLimit: { ...this._cfg.rateLimit, ...(patch.rateLimit ?? {}) },
    } as TrustwareConfigOptions);
    this._cfg = next;
    this.emit();
  }

  get(): ResolvedTrustwareConfig {
    if (!this._cfg) throw new Error("TrustwareConfig: not initialized.");
    return this._cfg;
  }

  getTheme() {
    return this.get().theme;
  }

  getMessages() {
    return this.get().messages;
  }

  subscribe(fn: (cfg: ResolvedTrustwareConfig) => void) {
    this._listeners.add(fn);
    if (this._cfg) fn(this._cfg);
    return () => {
      this._listeners.delete(fn);
    };
  }

  private emit() {
    if (!this._cfg) return;
    for (const fn of this._listeners) fn(this._cfg);
  }
}
export const TrustwareConfigStore = new ConfigStore();

/** Convenience for non-React environments */
export const TrustwareConfig = {
  init: (opts: TrustwareConfigOptions) => TrustwareConfigStore.init(opts),
  update: (patch: Partial<TrustwareConfigOptions>) =>
    TrustwareConfigStore.update(patch),
  get: () => TrustwareConfigStore.get(),
  getTheme: () => TrustwareConfigStore.get().theme,
  getMessages: () => TrustwareConfigStore.get().messages,
  subscribe: (fn: (cfg: ResolvedTrustwareConfig) => void) =>
    TrustwareConfigStore.subscribe(fn),
};
