import { TrustwareConfigStore } from "../config";
import { Registry } from "../registry";
import { apiBase } from "./http";

const registryCache = new Map<string, Registry>();

function registryCacheKey(): string {
  const base = apiBase();
  const apiKey = TrustwareConfigStore.peek()?.apiKey ?? "__uninitialized__";
  return `${base}::${apiKey}`;
}

export function getSharedRegistry(): Registry {
  const key = registryCacheKey();
  const existing = registryCache.get(key);
  if (existing) {
    return existing;
  }

  const registry = new Registry(apiBase());
  registryCache.set(key, registry);
  return registry;
}
