import { useTrustwareConfig } from "src/hooks/useTrustwareConfig";

export function PaymentSuccess({ onClose }: { onClose: () => void }) {
  const { theme } = useTrustwareConfig();
  const radius = theme.radius ?? 8;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        color: theme.textColor,
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          padding: 24,
          borderRadius: radius,
          border: `1px solid ${theme.borderColor}`,
          background: theme.backgroundColor,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          alignItems: "center",
        }}
      >
        <div style={{ fontSize: 36 }}>✅</div>
        <div style={{ fontWeight: 700 }}>Payment complete</div>
        <div style={{ fontSize: 13, opacity: 0.75 }}>
          Your assets are on the way. You can safely close this window.
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        style={{
          padding: "12px 20px",
          borderRadius: radius,
          border: "none",
          background: theme.primaryColor,
          color: theme.backgroundColor,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Close
      </button>
    </div>
  );
}
