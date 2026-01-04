import { useTrustwareConfig } from "src/hooks/useTrustwareConfig";

export function PaymentFailure({
  onClose,
  onRetry,
  error,
}: {
  onClose: () => void;
  onRetry?: () => void;
  error?: string | null;
}) {
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
        <div style={{ fontSize: 36 }}>⚠️</div>
        <div style={{ fontWeight: 700 }}>Payment failed</div>
        <div style={{ fontSize: 13, opacity: 0.75 }}>
          {error ??
            "Something went wrong while processing your payment. Please try again or contact support."}
        </div>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: "12px 20px",
            borderRadius: radius,
            border: `1px solid ${theme.borderColor}`,
            background: theme.backgroundColor,
            color: theme.textColor,
            cursor: "pointer",
          }}
        >
          Close
        </button>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
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
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
