// The review-then-send types live on @trustware/sdk/core only.
// @ts-expect-error not re-exported from the package root
import type { SigningRetry } from "@trustware/sdk";
// @ts-expect-error not re-exported from the package root
import type { BuiltRoute } from "@trustware/sdk";
export type RootTypes = [SigningRetry, BuiltRoute];
