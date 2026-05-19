import type React from "react";

import { colors } from "../../../styles";
import { PaymentOptionRow } from "./PaymentOptionRow";
import { walletActionIconBoxStyle } from "./paymentOptionStyles";
import { useDepositWallet } from "src/widget/context/DepositContext";
import { useWalletInfo } from "src/wallets";

export interface WalletConnectRowProps {
  onClick: () => Promise<void>;
}

export function WalletConnectRow({
  onClick,
}: WalletConnectRowProps): React.ReactElement {
  const { selectedNamespace } = useDepositWallet();
  const label =
    selectedNamespace.toUpperCase() === "EVM"
      ? "WalletConnect (EVM)"
      : "WalletConnect (Solana)";

  const { isConnected, connectedVia } = useWalletInfo();

  const isSelected = isConnected && connectedVia === "walletconnect";
  return (
    <PaymentOptionRow
      onClick={() => void onClick()}
      label={label}
      icon={
        <div style={walletActionIconBoxStyle}>
          <svg
            style={{
              width: "1.25rem",
              height: "1.25rem",
              color: colors.blue[500],
            }}
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M6.09 10.56c3.26-3.2 8.56-3.2 11.82 0l.39.39a.4.4 0 010 .58l-1.34 1.31a.21.21 0 01-.3 0l-.54-.53c-2.28-2.23-5.97-2.23-8.24 0l-.58.56a.21.21 0 01-.3 0L5.66 11.6a.4.4 0 010-.58l.43-.46zm14.6 2.72l1.2 1.17a.4.4 0 010 .58l-5.38 5.27a.43.43 0 01-.6 0l-3.82-3.74a.11.11 0 00-.15 0l-3.82 3.74a.43.43 0 01-.6 0L2.15 15.03a.4.4 0 010-.58l1.2-1.17a.43.43 0 01.6 0l3.82 3.74c.04.04.1.04.15 0l3.82-3.74a.43.43 0 01.6 0l3.82 3.74c.04.04.1.04.15 0l3.82-3.74a.43.43 0 01.6 0z" />
          </svg>
        </div>
      }
      isSelected={isSelected}
      // trailing={
      //   <svg
      //     style={{
      //       width: "1rem",
      //       height: "1rem",
      //       color: colors.mutedForeground,
      //     }}
      //     viewBox="0 0 24 24"
      //     fill="none"
      //     stroke="currentColor"
      //     strokeWidth={2}
      //   >
      //     <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      //   </svg>
      // }
    />
  );
}
