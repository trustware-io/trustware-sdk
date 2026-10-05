import React from "react";
import { colors, spacing, borderRadius } from "../../styles/tokens";

export interface LoadingSkeletonProps {
  style?: React.CSSProperties;
}

const containerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: spacing[4],
  padding: `${spacing[6]} ${spacing[6]}`,
  width: "100%",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: spacing[3],
};

const circleStyle: React.CSSProperties = {
  width: "2.25rem",
  height: "2.25rem",
  borderRadius: "9999px",
  backgroundColor: colors.muted,
  flexShrink: 0,
};

const lineBaseStyle: React.CSSProperties = {
  height: "0.75rem",
  backgroundColor: colors.muted,
  borderRadius: borderRadius.md,
};

const lineLgStyle: React.CSSProperties = {
  ...lineBaseStyle,
  width: "70%",
};

const lineSmStyle: React.CSSProperties = {
  ...lineBaseStyle,
  width: "45%",
};

export function LoadingSkeleton({
  style,
}: LoadingSkeletonProps): React.ReactElement {
  return (
    <div style={{ ...containerStyle, ...style }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={rowStyle}>
          <div style={circleStyle} className="tw-animate-pulse" />
          <div style={{ flex: 1 }}>
            <div style={lineLgStyle} className="tw-animate-pulse" />
            <div
              style={{ ...lineSmStyle, marginTop: spacing[2] }}
              className="tw-animate-pulse"
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default LoadingSkeleton;
