import React from "react";

import { useGTM } from "src/hooks";
import { GTM_ID } from "src/constants";

interface WidgetAnalyticsProps {
  children: React.ReactNode;
}

/**
 * Owns the GTM container for the widget shell.
 *
 * `useGTM` keeps its initialization flag in a module-level singleton, so
 * exactly one component may call it: the first caller injects the script and
 * its cleanup removes it again. This is that caller. Everything else — deposit
 * and swap alike — uses `useGTMTracker`, which only pushes to the dataLayer.
 *
 * It wraps the mode branch rather than living inside one of them because both
 * modes need the container. Swap mode returns before `WidgetInner` (the
 * previous owner) ever renders, so a swap-mode host loaded no container at all
 * and produced zero GA4 rows — no container load, no page_view, no payment
 * events.
 *
 * Loading it at the shell, not at the transaction hooks, is what makes
 * everything upstream of checkout — impressions, chain and token selection,
 * quoting — visible to GA4 at all; otherwise active-user and mobile-traffic
 * metrics count only the users who reached the transaction step.
 *
 * It sits *below* the `isOpen` gate on purpose. A host that renders the widget
 * closed (`defaultOpen={false}`) and opens it from a button should not report a
 * page_view for every visitor who never opened it; the container loads when the
 * widget actually renders, exactly as it did before.
 *
 * Collection stays gated on `features.shouldAllowGA4`, which `useGTM` checks
 * before it injects anything. An empty `GTM_ID` (dev builds) is handled there
 * too — it logs and returns rather than loading a bogus container.
 */
export function WidgetAnalytics({
  children,
}: WidgetAnalyticsProps): React.ReactElement {
  useGTM(GTM_ID);
  return <>{children}</>;
}
