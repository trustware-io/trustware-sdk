/**
 * TrustwareWidget - Drop-in deposit widget for web3 applications
 *
 * This module re-exports the v2 widget components as the default widget implementation.
 *
 * @example
 * ```tsx
 * import { TrustwareWidget } from '@trustware/sdk';
 *
 * function App() {
 *   return <TrustwareWidget theme="dark" />;
 * }
 * ```
 *
 * @example With programmatic control
 * ```tsx
 * import { TrustwareWidget, TrustwareWidgetRef } from '@trustware/sdk';
 * import { useRef } from 'react';
 *
 * function App() {
 *   const widgetRef = useRef<TrustwareWidgetRef>(null);
 *
 *   return (
 *     <>
 *       <button onClick={() => widgetRef.current?.open()}>Open Widget</button>
 *       <TrustwareWidget
 *         ref={widgetRef}
 *         defaultOpen={false}
 *         onClose={() => console.log('closed')}
 *       />
 *     </>
 *   );
 * }
 * ```
 */

// Re-export the v2 widget as the default TrustwareWidget
export {
  TrustwareWidgetV2 as TrustwareWidget,
  TrustwareWidgetV2 as default,
  type TrustwareWidgetV2Props as TrustwareWidgetProps,
  type TrustwareWidgetV2Ref as TrustwareWidgetRef,
} from "../widget-v2/TrustwareWidgetV2";

// Also export the v2 widget under its original name for explicit usage
export {
  TrustwareWidgetV2,
  type TrustwareWidgetV2Props,
  type TrustwareWidgetV2Ref,
} from "../widget-v2/TrustwareWidgetV2";
