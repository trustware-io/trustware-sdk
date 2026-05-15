import type React from "react";

import type { DetectedWallet } from "../../../../types";
import { borderRadius, colors, fontSize, fontWeight } from "../../../styles";
import { PaymentOptionRow } from "./PaymentOptionRow";
import { useWalletInfo } from "src/wallets";

export interface DetectedWalletRowProps {
  onSelect: (wallet: DetectedWallet) => Promise<void>;
  wallet: DetectedWallet;
}

export function DetectedWalletRow({
  onSelect,
  wallet,
}: DetectedWalletRowProps): React.ReactElement {
  const { isConnected, walletMetaId } = useWalletInfo();

  const isSelected = isConnected && wallet?.meta.id === walletMetaId;
  return (
    <PaymentOptionRow
      onClick={() => void onSelect(wallet)}
      label={wallet.meta.name}
      icon={
        wallet.meta.logo ? (
          <img
            src={wallet.meta.logo}
            alt={wallet.meta.name}
            style={{
              width: "2rem",
              height: "2rem",
              borderRadius: borderRadius.lg,
              objectFit: "cover",
            }}
          />
        ) : (
          <div
            style={{
              width: "2rem",
              height: "2rem",
              borderRadius: borderRadius.lg,
              backgroundColor: colors.muted,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontSize: fontSize.xs,
                fontWeight: fontWeight.bold,
                color: colors.mutedForeground,
              }}
            >
              {wallet.meta.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )
      }
      isSelected={isSelected}
    />
  );
}
