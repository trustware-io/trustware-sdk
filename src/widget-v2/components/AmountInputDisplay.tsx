import React, { useRef, useState } from "react";
import { colors, fontSize, fontWeight } from "../styles";

export interface AmountInputDisplayProps {
  amount: string;
  parsedAmount: number;
  isFixedAmount?: boolean;
  onAmountChange: (raw: string) => void;
  prefix?: string;
  suffix?: string;
  style?: React.CSSProperties;
  inputAriaLabel?: string;
}

export function AmountInputDisplay({
  amount,
  parsedAmount,
  isFixedAmount = false,
  onAmountChange,
  prefix = "",
  suffix,
  style,
  inputAriaLabel = "Deposit amount",
}: AmountInputDisplayProps): React.ReactElement {
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAmountClick = () => {
    if (isFixedAmount) return;
    const isZeroish = !amount || parseFloat(amount) === 0;
    setIsEditing(true);
    if (isZeroish) onAmountChange("");

    setTimeout(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      input.setSelectionRange(0, 0);
    }, 0);
  };

  const displayValue = isEditing
    ? amount || "0"
    : parsedAmount > 0
      ? parsedAmount.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : "0";

  return (
    <div
      style={{
        textAlign: "center",
        position: "relative",
        ...style,
      }}
    >
      <span
        style={{
          fontSize: "3.75rem",
          fontWeight: fontWeight.bold,
          letterSpacing: "-0.025em",
          cursor: isFixedAmount ? "default" : "pointer",
        }}
        onClick={handleAmountClick}
      >
        <span
          style={{
            color: colors.foreground,
          }}
        >
          {prefix}
        </span>
        <span
          style={{
            position: "relative",
            display: "inline-block",
            minWidth: "1ch",
          }}
        >
          <span
            style={{
              color:
                isEditing || parsedAmount > 0
                  ? colors.foreground
                  : "rgba(161, 161, 170, 0.4)",
            }}
          >
            {displayValue}
          </span>
          {!isEditing && parsedAmount === 0 && (
            <span style={{ color: "rgba(161, 161, 170, 0.4)" }}>.00</span>
          )}
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            onBlur={() => setIsEditing(false)}
            readOnly={isFixedAmount}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              backgroundColor: "transparent",
              border: "none",
              outline: "none",
              padding: 0,
              margin: 0,
              textAlign: "center",
              color: "transparent",
              fontSize: "3.75rem",
              fontWeight: fontWeight.bold,
              letterSpacing: "-0.025em",
              caretColor: "hsl(var(--tw-muted-foreground) / 0.5)",
            }}
            aria-label={inputAriaLabel}
          />
        </span>
        {suffix ? (
          <span
            style={{
              marginLeft: "0.5rem",
              fontSize: fontSize.lg,
              fontWeight: fontWeight.semibold,
              color: colors.mutedForeground,
            }}
          >
            {suffix}
          </span>
        ) : null}
      </span>
    </div>
  );
}

export default AmountInputDisplay;
