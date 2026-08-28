import { useEffect, useCallback } from "react";
import { Trustware } from "../core";

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

type GtagCommand = "event" | "config" | "set" | "js";

type DataLayerObject = Record<string, unknown>;

/** Params passed alongside a custom event. Generic <key, value> */
type EventParams = Record<string, unknown>;

export interface UseGTMTrackerReturn {
  /** Push a custom event to the GTM dataLayer */
  trackEvent: (eventName: string, eventParams?: EventParams) => void;
  /** Push a page_view event to the GTM dataLayer */
  trackPageView: (pagePath: string, pageTitle?: string) => void;
  /** Push a user_property event to the GTM dataLayer */
  setUserProperty: (propertyName: string, value: unknown) => void;
  /** Call gtag() directly, bypassing GTM (use sparingly) */
  directGtag: (command: GtagCommand, ...args: unknown[]) => void;
}

export interface UseGTMReturn extends UseGTMTrackerReturn {
  /** Manually inject the GTM noscript <iframe> into <body> */
  addNoscriptIframe: () => void;
}

function isGA4Allowed(): boolean {
  try {
    return Trustware.getConfig().features.shouldAllowGA4;
  } catch {
    return false;
  }
}

/**
 * GTM is a page-level singleton, so initialization state belongs to the page
 * rather than to any one hook instance. `useGTM` owns this flag; `useGTMTracker`
 * only reads it, which lets consumers push events without each of them
 * re-running (and appearing to own) initialization.
 */
let isContainerInitialized = false;

/**
 * How many mounted `useGTM` callers currently want the container.
 *
 * The container loads when this goes 0 → 1 and unloads when it goes 1 → 0, so
 * two widgets on one page share one script and the first to unmount does not
 * take it away from the second. Before this was counted, the second caller hit
 * the `isContainerInitialized` early return and so registered no cleanup at
 * all: when the first unmounted, its cleanup pulled the script and cleared the
 * flag, and the survivor was left permanently silent because its effect deps
 * never change and it therefore never re-ran.
 */
let containerRefCount = 0;

/**
 * The script this module injected, or null when the page already had one.
 *
 * Module-level rather than a per-hook ref because the last caller to unmount
 * is not necessarily the one that injected it. Staying null for a
 * host-provided script keeps teardown from removing something we do not own.
 */
let injectedScript: HTMLScriptElement | null = null;

/**
 * useGTMTracker — push events to an already-initialized GTM container.
 *
 * Use this anywhere you only need to record events. Something higher in the
 * tree must call {@link useGTM} to load the container; in this SDK that is the
 * widget root.
 *
 * @example
 * const { trackEvent } = useGTMTracker();
 * trackEvent('payment_initiated', { from_chain: 'arbitrum' });
 */
export function useGTMTracker(): UseGTMTrackerReturn {
  /**
   * Push a custom event to the GTM dataLayer.
   * GTM will pick this up and fire any matching tags (e.g. GA4 event tags).
   */
  const trackEvent = useCallback(
    (eventName: string, eventParams: EventParams = {}): void => {
      if (!isContainerInitialized) {
        console.warn(
          "useGTM: Not initialized. Ensure a valid GTM Container ID was provided."
        );
        return;
      }
      if (!eventName || typeof eventName !== "string") {
        console.error("useGTM: A valid event name is required.");
        return;
      }

      const payload: DataLayerObject = { event: eventName, ...eventParams };
      window.dataLayer.push(payload);
    },
    []
  );

  /**
   * Push a page_view event to the GTM dataLayer.
   * @param pagePath  - e.g. '/home'
   * @param pageTitle - defaults to document.title
   */
  const trackPageView = useCallback(
    (pagePath: string, pageTitle: string = document.title): void => {
      trackEvent("page_view", {
        page_path: pagePath,
        page_title: pageTitle,
        page_location: window.location.href,
      });
    },
    [trackEvent]
  );

  /**
   * Push a user_property event to the GTM dataLayer.
   * Wire up a GTM tag to forward these to GA4 user properties.
   */
  const setUserProperty = useCallback(
    (propertyName: string, value: unknown): void => {
      if (!isContainerInitialized) {
        console.warn(
          "useGTM: Not initialized. Ensure a valid GTM Container ID was provided."
        );
        return;
      }

      const payload: DataLayerObject = {
        event: "user_property",
        user_property_name: propertyName,
        user_property_value: value,
      };
      window.dataLayer.push(payload);
    },
    []
  );

  /**
   * Call window.gtag() directly, bypassing GTM.
   * Only available if a gtag.js script is also loaded separately.
   */
  const directGtag = useCallback(
    (command: GtagCommand, ...args: unknown[]): void => {
      if (!isGA4Allowed()) return;
      if (!window.gtag) {
        console.warn(
          "useGTM: window.gtag is not available. Load gtag.js separately to use this method."
        );
        return;
      }
      window.gtag(command, ...args);
    },
    []
  );

  return { trackEvent, trackPageView, setUserProperty, directGtag };
}

/**
 * useGTM — React hook for Google Tag Manager (GA4 via GTM)
 *
 * Loads the GTM container once per page and exposes methods for pushing events
 * to the dataLayer. All methods are stable references (safe in dependency arrays).
 *
 * Call this at exactly one place in the tree — the first caller injects the
 * script and owns its cleanup. Everywhere else, use {@link useGTMTracker}.
 *
 * @param gtmId - GTM Container ID (format: GTM-XXXXX)
 *
 * @example
 * const { trackEvent, trackPageView } = useGTM('GTM-XXXXX');
 *
 * trackPageView('/home');
 * trackEvent('purchase', { value: 29.99, currency: 'USD' });
 */
export function useGTM(gtmId: string): UseGTMReturn {
  const tracker = useGTMTracker();

  // ── Initialization ─────────────

  useEffect(() => {
    // Kill-switch: skip initialization entirely when GA4 is not allowed
    if (!isGA4Allowed()) {
      console.warn(
        "useGTM: GA4 tracking is disabled or Trustware config not initialized."
      );
      return;
    }

    if (!gtmId || typeof gtmId !== "string") {
      console.error(
        "useGTM: A valid GTM Container ID is required (format: GTM-XXXXX)."
      );
      return;
    }

    // Count this caller before the initialization check, so every mounted
    // caller is balanced by a cleanup — including the ones that find the
    // container already up and do no work here.
    containerRefCount += 1;

    const release = () => {
      containerRefCount -= 1;
      // Someone else still needs the container. Leave it alone.
      if (containerRefCount > 0) return;

      if (injectedScript) {
        injectedScript.parentNode?.removeChild(injectedScript);
        injectedScript = null;
      }
      isContainerInitialized = false;
    };

    if (isContainerInitialized) return release;

    // Bail out if the GTM script is already on the page (e.g. server-side injection)
    const alreadyLoaded = document.querySelector(
      `script[src*="googletagmanager.com/gtm.js?id=${gtmId}"]`
    );
    if (alreadyLoaded) {
      window.dataLayer = window.dataLayer || [];
      isContainerInitialized = true;
      return release;
    }

    // Initialize dataLayer before the script loads so early pushes are queued
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      "gtm.start": new Date().getTime(),
      event: "gtm.js",
    });

    // Inject the GTM loader script (standard GTM snippet — Method 1)
    const firstScript = document.getElementsByTagName("script")[0];
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtm.js?id=${gtmId}`;
    firstScript.parentNode?.insertBefore(script, firstScript);
    injectedScript = script;

    isContainerInitialized = true;

    return release;
  }, [gtmId]);

  // ── Methods ────────────

  /**
   * Inject the GTM noscript <iframe> at the top of <body>.
   * Call this once in your app root for users with JS disabled.
   */
  const addNoscriptIframe = useCallback((): void => {
    if (!isGA4Allowed()) return;
    if (document.querySelector('iframe[src*="googletagmanager.com/ns.html"]'))
      return;

    const noscript = document.createElement("noscript");
    const iframe = document.createElement("iframe");
    iframe.src = `https://www.googletagmanager.com/ns.html?id=${gtmId}`;
    iframe.height = "0";
    iframe.width = "0";
    iframe.style.display = "none";
    iframe.style.visibility = "hidden";
    noscript.appendChild(iframe);
    document.body.insertBefore(noscript, document.body.firstChild);
  }, [gtmId]);

  return { ...tracker, addNoscriptIframe };
}
