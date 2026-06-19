import { useState, useEffect } from "react";
import { colors, fontSize, fontWeight, spacing } from "src/widget/styles";
import type { YourTokenData } from "src/widget/context/DepositContext";

const QUOTE_MESSAGES = [
  "Finding your best route...",
  "Scanning liquidity pools...",
  "Calculating bridge fees...",
  "Checking exchange rates...",
  "Optimizing for lowest fees...",
  "Verifying token availability...",
  "Getting live pricing...",
  "Simulating Execution",
  "Almost ready...",
];

interface RouteQuoteLoaderProps {
  selectedToken?: YourTokenData | null;
}

export function RouteQuoteLoader({ selectedToken }: RouteQuoteLoaderProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const interval = setInterval(() => {
      setVisible(false);
      t = setTimeout(() => {
        setMessageIndex((i) => (i + 1) % QUOTE_MESSAGES.length);
        setVisible(true);
      }, 300);
    }, 2500);
    return () => {
      clearInterval(interval);
      if (t !== null) clearTimeout(t);
    };
  }, []);

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: `${spacing[10]} ${spacing[6]}`,
        gap: spacing[5],
      }}
    >
      {/* Spinner ring with token icon */}
      <div
        style={{
          position: "relative",
          width: "5.5rem",
          height: "5.5rem",
          flexShrink: 0,
        }}
      >
        {/* Background ring */}
        <svg
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
          }}
          viewBox="0 0 88 88"
        >
          <circle
            cx="44"
            cy="44"
            r="40"
            fill="none"
            stroke={colors.border}
            strokeWidth="3"
          />
        </svg>

        {/* Spinning arc */}
        <svg
          className="tw-animate-spin"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
          }}
          viewBox="0 0 88 88"
        >
          <circle
            cx="44"
            cy="44"
            r="40"
            fill="none"
            stroke={colors.primary}
            strokeWidth="3.5"
            strokeDasharray="80 172"
            strokeLinecap="round"
          />
        </svg>

        {/* Token icon / initials */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {selectedToken?.iconUrl ? (
            <img
              src={selectedToken.iconUrl}
              alt={selectedToken.symbol}
              style={{
                width: "2.75rem",
                height: "2.75rem",
                borderRadius: "9999px",
                objectFit: "cover",
              }}
            />
          ) : (
            <span
              style={{
                fontSize: fontSize.lg,
                fontWeight: fontWeight.bold,
                color: colors.primary,
              }}
            >
              {selectedToken?.symbol?.slice(0, 2).toUpperCase() ?? "??"}
            </span>
          )}
        </div>
      </div>

      {/* Title */}
      <p
        style={{
          fontSize: fontSize.base,
          fontWeight: fontWeight.semibold,
          color: colors.foreground,
          margin: 0,
          letterSpacing: "-0.01em",
        }}
      >
        Getting quote
      </p>

      {/* Rotating message */}
      <p
        style={{
          fontSize: fontSize.sm,
          color: colors.mutedForeground,
          textAlign: "center",
          margin: 0,
          minHeight: "1.25rem",
          transition: "opacity 0.25s ease",
          opacity: visible ? 1 : 0,
        }}
      >
        {QUOTE_MESSAGES[messageIndex]}
      </p>
    </div>
  );
}
