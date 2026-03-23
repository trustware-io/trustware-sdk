import React from "react";

import type { DetectedWallet } from "../../../../types";
import {
  borderRadius,
  colors,
  fontSize,
  fontWeight,
  shadows,
  spacing,
} from "../../../styles";
import { DetectedWalletRow } from "./DetectedWalletRow";
import { WalletConnectRow } from "./WalletConnectRow";
import { WalletDropdownEmptyState } from "./WalletDropdownEmptyState";
import {
  dividerBorderStyle,
  dropdownSectionHeadingStyle,
  dropdownStatusDotStyle,
  dropdownSurfaceStyle,
} from "./paymentOptionStyles";

export interface CryptoWalletDropdownContentProps {
  browserWallets: DetectedWallet[];
  handleWalletConnect: () => Promise<void>;
  handleWalletSelect: (wallet: DetectedWallet) => Promise<void>;
}

export function CryptoWalletDropdownContent({
  browserWallets,
  handleWalletConnect,
  handleWalletSelect,
}: CryptoWalletDropdownContentProps): React.ReactElement {
  return (
    <div
      style={{
        ...dropdownSurfaceStyle,
        maxHeight: "16rem",
        backgroundColor: colors.card,
        borderRadius: borderRadius.xl,
        boxShadow: shadows.large,
        border: `1px solid rgba(63, 63, 70, 0.5)`,
        zIndex: 100,
        overflow: "auto",
        animation: "tw-fade-in 0.2s ease-out",
        scrollbarWidth: "thin",
        scrollbarColor: `${colors.muted} transparent`,
      }}
    >
      <div style={{ padding: spacing[3] }}>
        <div style={dropdownSectionHeadingStyle}>
          <div style={dropdownStatusDotStyle(colors.green[500])} />
          <span
            style={{
              fontSize: fontSize.xs,
              fontWeight: fontWeight.medium,
              color: colors.primary,
            }}
          >
            {browserWallets.length > 0
              ? "Detected Wallets"
              : "No Wallets Detected"}
          </span>
        </div>

        {browserWallets.length > 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: spacing[1],
            }}
          >
            {browserWallets.map((wallet) => (
              <DetectedWalletRow
                key={wallet.meta.id}
                wallet={wallet}
                onSelect={handleWalletSelect}
              />
            ))}
          </div>
        ) : (
          <WalletDropdownEmptyState />
        )}
      </div>

      <div style={dividerBorderStyle} />

      <div style={{ padding: spacing[3] }}>
        <WalletConnectRow onClick={handleWalletConnect} />
      </div>
    </div>
  );
}
