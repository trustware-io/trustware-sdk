/* core/http.ts */
import { SDK_NAME, SDK_VERSION, API_ROOT, API_PREFIX } from "../constants";
import { TrustwareConfigStore } from "../config/";

export function apiBase() {
  return `${API_ROOT}${API_PREFIX}`;
}

export function jsonHeaders(extra?: Record<string, string>): HeadersInit {
  const cfg = TrustwareConfigStore.get();
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    "X-API-Key": cfg.apiKey,
    "X-SDK-Name": SDK_NAME,
    "X-SDK-Version": SDK_VERSION,
    "X-API-Version": "2025-10-01",
  };
  return { ...h, ...(extra || {}) };
}

export async function assertOK(r: Response) {
  if (r.ok) return;
  let msg = r.statusText;
  try {
    const j = await r.json();
    if (j?.error) msg = j.error;
  } catch {}
  throw new Error(`HTTP ${r.status}: ${msg}`);
}

///sdk/validate
export async function validateSdkAccess() {
  const r = await fetch(`${apiBase()}/sdk/validate`, {
    method: "GET",
    headers: jsonHeaders()
  });
  await assertOK(r);
  const j = await r.json();
  return j.data;
};
