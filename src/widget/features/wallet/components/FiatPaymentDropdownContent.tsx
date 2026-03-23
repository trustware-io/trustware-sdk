import React from "react";

import {
  borderRadius,
  colors,
  fontSize,
  fontWeight,
  shadows,
  spacing,
} from "../../../styles";
import { FiatComingSoonBanner } from "./FiatComingSoonBanner";
import { FiatMethodRow } from "./FiatMethodRow";
import type { FiatOption } from "./fiatOptions";
import {
  dropdownSectionHeadingStyle,
  dropdownStatusDotStyle,
  dropdownSurfaceStyle,
} from "./paymentOptionStyles";

export interface FiatPaymentDropdownContentProps {
  fiatOptions: FiatOption[];
  handleFiatSelect: () => void;
}

export function FiatPaymentDropdownContent({
  fiatOptions,
  handleFiatSelect,
}: FiatPaymentDropdownContentProps): React.ReactElement {
  return (
    <div
      style={{
        ...dropdownSurfaceStyle,
        backgroundColor: colors.card,
        borderRadius: borderRadius.xl,
        boxShadow: shadows.large,
        border: `1px solid rgba(63, 63, 70, 0.5)`,
        zIndex: 100,
        overflow: "hidden",
        animation: "tw-fade-in 0.2s ease-out",
      }}
    >
      <FiatComingSoonBanner />

      <div style={{ padding: spacing[3] }}>
        <div style={dropdownSectionHeadingStyle}>
          <div style={dropdownStatusDotStyle(colors.primary)} />
          <span
            style={{
              fontSize: fontSize.xs,
              fontWeight: fontWeight.medium,
              color: colors.primary,
            }}
          >
            Payment Methods
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: spacing[1],
          }}
        >
          {fiatOptions.map((method) => (
            <FiatMethodRow
              key={method.id}
              method={method}
              onSelect={handleFiatSelect}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
