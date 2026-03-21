import type React from "react";

import { colors } from "../../../styles";
import type { FiatOption } from "./fiatOptions";
import { PaymentOptionRow } from "./PaymentOptionRow";

export interface FiatMethodRowProps {
  method: FiatOption;
  onSelect: () => void;
}

export function FiatMethodRow({
  method,
  onSelect,
}: FiatMethodRowProps): React.ReactElement {
  return (
    <PaymentOptionRow
      onClick={onSelect}
      disabled
      label={method.name}
      icon={
        <span style={{ color: colors.mutedForeground }}>{method.icon}</span>
      }
    />
  );
}
