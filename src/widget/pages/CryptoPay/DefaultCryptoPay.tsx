import { colors } from "src/widget/styles";

const IconWallet = ({ style }: { style?: React.CSSProperties }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={style}
  >
    <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
    <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
  </svg>
);

const IconSparkles = ({ style }: { style?: React.CSSProperties }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={style}
  >
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    <path d="M5 3v4" />
    <path d="M19 17v4" />
    <path d="M3 5h4" />
    <path d="M17 19h4" />
  </svg>
);

function DefaultCryptoPay() {
  return (
    <div
      style={{
        width: "100%",
        minHeight: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
      }}
    >
      {/* Empty-state hero */}
      <div
        style={{
          textAlign: "center",
          flexDirection: "column",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
        }}
      >
        <div
          style={{
            position: "relative",
            marginBottom: "1.25rem",
            display: "inline-block",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "9999px",
              background: `linear-gradient(135deg, ${colors.green[500]} 0%, ${colors.green[300]} 100%)`,
              opacity: 0.2,
              filter: "blur(1rem)",
            }}
          />
          <div
            style={{
              position: "relative",
              height: "5rem",
              width: "5rem",
              borderRadius: "9999px",

              backgroundColor: colors.card,
              border: `1px solid ${colors.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <IconWallet
              style={{
                color: colors.green[300],
              }}
            />
          </div>
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            fontSize: "0.75rem",
            fontWeight: 500,
            color: "hsl(158, 84%, 52%)",
            backgroundColor: "hsla(158, 84%, 52%, 0.1)",
            border: `1px solid hsla(158, 84%, 52%, 0.2)`,
            borderRadius: "9999px",
            padding: "0.25rem 0.75rem",
            marginBottom: "0.75rem",
          }}
        >
          <IconSparkles />
          Wallet is empty
        </div>

        <h2
          style={{
            fontSize: "1.5rem",
            fontWeight: 600,
            letterSpacing: "-0.025em",
            marginBottom: "0.375rem",
            color: colors.foreground,
          }}
        >
          {/* Add funds to get started */}
          Deposit assets to swap or bridge.
        </h2>
        <p
          style={{
            fontSize: "0.875rem",
            color: colors.mutedForeground,
            maxWidth: "24rem",
            margin: "0 auto",
            lineHeight: 1.625,
          }}
        >
          You&apos;ll need tokens before you can swap or bridge.
        </p>
      </div>
    </div>
  );
}

export default DefaultCryptoPay;
