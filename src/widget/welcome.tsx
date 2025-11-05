import { useMemo, useState } from "react";
import { useTrustwareConfig } from "src/hooks/useTrustwareConfig";

function hexToRgba(hex: string, alpha = 1) {
  if (!hex) return `rgba(0,0,0,${alpha})`;
  const h = hex.replace("#", "");
  const isShort = h.length === 3;
  const r = parseInt(isShort ? h[0] + h[0] : h.slice(0, 2), 16);
  const g = parseInt(isShort ? h[1] + h[1] : h.slice(2, 4), 16);
  const b = parseInt(isShort ? h[2] + h[2] : h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function Welcome({ onNext }: { onNext: () => void }) {
  const { theme, messages } = useTrustwareConfig();
  const [hover, setHover] = useState(false);

  const c = useMemo(() => {
    const primary = theme?.primaryColor ?? "#3b82f6";
    const secondary = theme?.secondaryColor ?? "#6366F1";
    const text = theme?.textColor ?? "#f9fafb";
    const border = theme?.borderColor ?? "#374151";
    const bg = theme?.backgroundColor ?? "#0b1020";
    const gradient = `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`;
    return {
      primary,
      secondary,
      text,
      textMuted: hexToRgba(text, 0.75),
      border,
      bg,
      chipBg: (a = 0.35) => hexToRgba(border, a),
      glass: (a = 0.08) => hexToRgba("#ffffff", a),
      gradient,
    };
  }, [theme]);

  const radius = theme?.radius ?? 16;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        color: c.text,
        borderRadius: radius,
        background: `radial-gradient(1200px 500px at 0% -20%, ${hexToRgba(
          c.primary,
          0.22
        )} 0%, transparent 55%), radial-gradient(900px 400px at 100% 0%, ${hexToRgba(
          c.secondary,
          0.15
        )} 0%, transparent 50%), ${c.bg}`,
        boxShadow: `inset 0 1px 0 ${hexToRgba("#fff", 0.04)}, 0 8px 26px ${hexToRgba(
          "#000",
          0.35
        )}`,
        overflowX: "hidden",
      }}
    >
      {/* local motion styles (reduced-motion safe) */}
      <style>
        {`
          @keyframes subtleFloat { 0%{transform:translateY(0)} 50%{transform:translateY(-4px)} 100%{transform:translateY(0)} }
          @media (prefers-reduced-motion: reduce) {
            * { animation: none !important; transition: none !important; }
          }
        `}
      </style>

      {/* Top section */}
      <div style={{ padding: "22px 18px 6px" }}>
        <h2
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: 0.2,
            backgroundImage: c.gradient,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          {messages?.welcomeTitle || "Welcome"}
        </h2>

        <p
          style={{
            margin: "8px 0 0 0",
            fontSize: 14.5,
            lineHeight: 1.55,
            color: c.textMuted,
            maxWidth: 820,
          }}
        >
          {messages?.welcomeSubtitle ||
            "You can send, receive, and route assets safely. Follow the steps below to get started."}
        </p>

        {/* trust row */}
        <div
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            alignItems: "center",
            marginTop: 10,
          }}
        >
          <span
            style={{
              fontSize: 13,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              color: hover ? c.text : c.textMuted,
              transition: "color 250ms",
              cursor: "default",
            }}
          >
            <span style={{ position: "relative", fontWeight: 600 }}>
              {messages?.welcomeSecuredByLabel || "Secured by"}
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  left: 0,
                  bottom: -2,
                  height: 2,
                  width: hover ? "100%" : 0,
                  transition: "width 250ms",
                  background: c.gradient,
                  borderRadius: 2,
                }}
              />
            </span>
            <span
              style={{
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "5px 9px",
                borderRadius: 999,
                color: c.text,
                backgroundColor: hover ? c.chipBg(0.5) : c.chipBg(0.35),
                border: `1px solid ${c.glass(0.2)}`,
                backdropFilter: "blur(2px)",
                transform: hover ? "translateY(-1px)" : "translateY(0)",
                transition: "transform 200ms, background-color 200ms",
              }}
              title="Trustware"
            >
              <img
                src="https://bv.trustware.io/assets/trustware-logo.png"
                alt=""
                style={{ width: 16, height: 16, borderRadius: 4 }}
              />
              Trustware
            </span>
          </span>

          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "5px 8px",
              borderRadius: 10,
              background: c.glass(0.10),
              border: `1px solid ${c.glass(0.18)}`,
              opacity: hover ? 1 : 0.9,
              transition: "opacity 200ms",
              fontSize: 13,
            }}
            title="Powered by Squid"
          >
            <span
              style={{
                background: "#ffffffa0",
                padding: "2px 5px",
                borderRadius: 8,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <img
                src="https://bv.trustware.io/assets/squid_logo_black.svg"
                alt="Squid"
                style={{ width: 90, height: "auto", display: "block" }}
              />
            </span>
          </span>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "8px 18px 16px" }}>
        {/* how it works */}
        <div
          style={{
            borderRadius: radius,
            border: `1px solid ${c.glass(0.18)}`,
            background: `linear-gradient(180deg, ${c.glass(0.14)}, ${c.glass(0.06)})`,
            boxShadow: `0 10px 26px ${hexToRgba("#000", 0.22)}`,
            overflow: "hidden",
          }}
        >
          <div
            aria-hidden
            style={{ height: 3, width: "100%", background: c.gradient }}
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: 10,
              padding: 14,
            }}
          >
            <Step
              index={1}
              title={messages?.welcomeStep1Title || "Connect a wallet"}
              copy={
                messages?.welcomeStep1Copy ||
                "Use the button in the next step to connect or choose a saved account."
              }
              c={c}
            />
            <Step
              index={2}
              title={messages?.welcomeStep2Title || "Enter amount & options"}
              copy={
                messages?.welcomeStep2Copy ||
                "Pick the token and amount. We’ll route across chains if needed."
              }
              c={c}
            />
            <Step
              index={3}
              title={messages?.welcomeStep3Title || "Review & confirm"}
              copy={
                messages?.welcomeStep3Copy ||
                "Check the details, then approve the transaction in your wallet."
              }
              c={c}
            />
          </div>
        </div>

        {/* foot notes */}
        {/*
        <div
          style={{
            marginTop: 10,
            display: "grid",
            gap: 6,
            fontSize: 12.5,
            color: c.textMuted,
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Badge c={c}>🛡️</Badge>
            <span>
              {messages?.welcomePrivacy ||
                "Your keys stay in your wallet. We never see your private keys."}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Badge c={c}>⛽</Badge>
            <span>
              {messages?.welcomeFees ||
                "Network fees and small routing fees may apply and are shown before you confirm."}
            </span>
          </div>
        </div>
        */}

        {/* CTA */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
          <button
            onClick={onNext}
            aria-label={messages?.welcomeCta || "Continue"}
            style={{
              position: "relative",
              padding: "10px 16px",
              background: c.gradient,
              color: c.text,
              border: "none",
              borderRadius: 10,
              cursor: "pointer",
              fontWeight: 700,
              letterSpacing: 0.2,
              boxShadow: `0 8px 20px ${hexToRgba(c.primary, 0.35)}`,
              transition: "transform 160ms, box-shadow 160ms",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.transform = "translateY(-1px)";
              el.style.boxShadow = `0 12px 26px ${hexToRgba(c.secondary, 0.38)}`;
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.transform = "translateY(0)";
              el.style.boxShadow = `0 8px 20px ${hexToRgba(c.primary, 0.35)}`;
            }}
          >
            {messages?.welcomeCta || "Continue"}
          </button>
        </div>
      </div>

      {/* decorative blob */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          right: -40,
          bottom: -40,
          width: 140,
          height: 140,
          borderRadius: 24,
          background: c.gradient,
          filter: "blur(28px)",
          opacity: 0.18,
          animation: "subtleFloat 8s ease-in-out infinite",
        }}
      />
    </div>
  );
}

function Step({
  index,
  title,
  copy,
  c,
}: {
  index: number;
  title: string;
  copy: string;
  c: {
    text: string;
    textMuted: string;
    gradient: string;
    glass: (a?: number) => string;
  };
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "32px 1fr",
        gap: 10,
        alignItems: "start",
      }}
    >
      <div
        aria-hidden
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          background: c.glass(0.14),
          border: `1px solid ${c.glass(0.22)}`,
          display: "grid",
          placeItems: "center",
          fontWeight: 800,
          backgroundImage: c.gradient,
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          userSelect: "none",
        }}
      >
        {index}
      </div>
      <div>
        <div style={{ fontWeight: 700, lineHeight: 1.25, marginBottom: 2 }}>{title}</div>
        <div style={{ color: c.textMuted, fontSize: 13.5, lineHeight: 1.45 }}>{copy}</div>
      </div>
    </div>
  );
}

function Badge({ children, c }: { children: any; c: any }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 22,
        height: 22,
        borderRadius: 8,
        background: c.glass(0.14),
        border: `1px solid ${c.glass(0.2)}`,
        fontSize: 13,
      }}
    >
      {children}
    </span>
  );
}

