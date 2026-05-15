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
import { WalletNamespaceTabs } from "./WalletNamespaceTabs";
import { useDepositWallet } from "src/widget/context/DepositContext";

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
  const { selectedNamespace } = useDepositWallet();
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
              fontWeight: fontWeight.normal,
              color: colors.primary,
            }}
          >
            {browserWallets.length > 0
              ? "Detected Wallets"
              : "No Wallets Detected"}
          </span>

          <div style={{ display: "flex", gap: spacing[2] }}>
            <WalletNamespaceTabs showBitcoin={false} />
          </div>
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
        {selectedNamespace === "evm" && (
          <WalletConnectRow onClick={handleWalletConnect} />
        )}
      </div>
    </div>
  );
}
