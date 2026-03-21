import type React from "react";

import { colors } from "../../../styles";

export function CryptoPaymentIcon(): React.ReactElement {
  return (
    <svg
      style={{
        width: "1.25rem",
        height: "1.25rem",
        color: colors.mutedForeground,
      }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
      />
    </svg>
  );
}

export function FiatPaymentIcon(): React.ReactElement {
  return (
    <svg
      style={{
        width: "1.25rem",
        height: "1.25rem",
        color: colors.mutedForeground,
      }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}

export function ApplePayIcon(): React.ReactElement {
  return (
    <svg
      style={{ width: "2rem", height: "1.25rem" }}
      viewBox="0 0 50 20"
      fill="currentColor"
    >
      <path d="M9.6 4.8c-.6.7-1.5 1.3-2.4 1.2-.1-.9.3-1.9.9-2.5.6-.7 1.6-1.2 2.4-1.2.1 1-.3 1.9-.9 2.5zm.9 1.3c-1.3-.1-2.5.8-3.1.8-.6 0-1.6-.7-2.7-.7-1.4 0-2.6.8-3.4 2-.7 1.2-.5 3.5.6 5.5.5.9 1.2 1.9 2.1 1.9.8 0 1.2-.5 2.3-.5s1.4.5 2.4.5c.9 0 1.5-.9 2-1.8.4-.6.5-1.2.7-1.8-1.6-.6-2-2.6-1.4-4-.4-.5-1-1.3-1.5-1.9z" />
      <path d="M18.4 2.1c2.3 0 4 1.6 4 3.9s-1.7 3.9-4.1 3.9h-2.6v4h-1.8V2.1h4.5zm-2.7 6.2h2.2c1.6 0 2.5-.9 2.5-2.4s-.9-2.4-2.5-2.4h-2.2v4.8zm6.4 3.2c0-1.5 1.2-2.5 3.3-2.6l2.4-.1v-.7c0-1-.7-1.6-1.8-1.6-1 0-1.7.5-1.8 1.3h-1.6c.1-1.5 1.4-2.7 3.5-2.7 2.1 0 3.4 1.1 3.4 2.9v6h-1.6v-1.4c-.5 1-1.5 1.6-2.7 1.6-1.7 0-2.9-1-2.9-2.7h-.2zm5.7-.8v-.7l-2.2.1c-1.1.1-1.8.6-1.8 1.4 0 .8.6 1.3 1.6 1.3 1.3 0 2.4-.9 2.4-2.1zm3.2 5.8v-1.4c.1 0 .5.1.7.1 1 0 1.5-.4 1.8-1.5l.2-.6-3.1-8.6h1.9l2.2 6.9 2.2-6.9h1.8l-3.2 9c-.7 2-1.5 2.7-3.3 2.7-.2 0-.6 0-.8-.1l-.4.4z" />
    </svg>
  );
}

export function MPesaIcon(): React.ReactElement {
  return (
    <svg
      style={{ width: "2rem", height: "1.25rem" }}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
    </svg>
  );
}

export function VenmoIcon(): React.ReactElement {
  return (
    <svg
      style={{ width: "2rem", height: "1.25rem" }}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M19.5 3h-15C3.12 3 2 4.12 2 5.5v13C2 19.88 3.12 21 4.5 21h15c1.38 0 2.5-1.12 2.5-2.5v-13C22 4.12 20.88 3 19.5 3zm-4.77 11.58c-.64 1.56-2.13 3.42-3.86 3.42H8.69l-.61-3.55 1.13-.21.28 1.64c.25.14.52.22.79.22.68 0 1.31-.48 1.74-1.34.33-.67.44-1.34.44-1.92 0-.45-.11-.82-.38-1.06-.24-.22-.58-.33-.98-.33-.64 0-1.29.28-1.86.61l-.05-.02.61-4.04h4.13l-.16 1.11H11l-.21 1.4c.41-.13.85-.19 1.28-.19.71 0 1.31.2 1.73.61.46.44.67 1.08.67 1.88 0 .68-.15 1.35-.48 2.01z" />
    </svg>
  );
}

export function ZelleIcon(): React.ReactElement {
  return (
    <svg
      style={{ width: "2rem", height: "1.25rem" }}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M13.25 4H5.5C4.67 4 4 4.67 4 5.5v13c0 .83.67 1.5 1.5 1.5h13c.83 0 1.5-.67 1.5-1.5v-7.75h-2v6.25H6V7h7.25V4zm3.91 2.83L9.83 14.17l-1.42-1.41 7.33-7.34L13.83 3.5h6.67v6.67l-1.92-1.92-1.42-1.42z" />
    </svg>
  );
}
