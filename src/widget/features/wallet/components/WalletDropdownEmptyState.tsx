import type React from "react";

import { colors, fontSize, spacing } from "../../../styles";

export function WalletDropdownEmptyState(): React.ReactElement {
  return (
    <p
      style={{
        fontSize: fontSize.xs,
        color: colors.mutedForeground,
        textAlign: "center",
        padding: `${spacing[2]} 0`,
      }}
    >
      Install a wallet extension like MetaMask to continue
    </p>
  );
}
