// constants.ts
export const SDK_NAME = "@trustware/sdk";
export const SDK_VERSION = "1.0.4";
//export const API_ROOT = "http://localhost:8000"; // local dev
export const API_ROOT = "https://api.trustware.io";
// Your Go server mounts at /api (no /v1 in routes), so the SDK pins the *host*
// and sends version telemetry via headers:
export const API_PREFIX = "/api";
