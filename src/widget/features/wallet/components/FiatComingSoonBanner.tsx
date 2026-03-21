import type React from "react";

import { colors, fontSize, fontWeight, spacing } from "../../../styles";

export function FiatComingSoonBanner(): React.ReactElement {
  return (
    <div
      style={{
        padding: `${spacing[2]} ${spacing[3]}`,
        backgroundColor: "rgba(245, 158, 11, 0.1)",
        borderBottom: "1px solid rgba(245, 158, 11, 0.2)",
      }}
    >
      <p
        style={{
          fontSize: fontSize.xs,
          fontWeight: fontWeight.medium,
          color: colors.amber[600],
          textAlign: "center",
        }}
      >
        Coming Soon
      </p>
    </div>
  );
}
