import {
  useDepositWallet,
  WalletNamespace,
} from "src/widget/context/DepositContext";
import { colors } from "src/widget/styles";

type Props = {
  selected?: WalletNamespace;
  onChange?: (ns: WalletNamespace) => void;
  // Bitcoin tab hidden until you're ready to enable it
  showBitcoin?: boolean;
};

export function WalletNamespaceTabs({ showBitcoin = false }: Props) {
  const { selectedNamespace, setSelectedNamespace } = useDepositWallet();
  const tabs: { id: WalletNamespace; label: string }[] = [
    { id: "evm", label: "EVM" },
    { id: "solana", label: "Solana" },
    ...(showBitcoin
      ? [{ id: "bitcoin" as WalletNamespace, label: "Bitcoin" }]
      : []),
  ];
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        borderRadius: "9999px",
        background: `${colors.background}`,
        border: `1px solid ${colors.mutedForeground}`,
        padding: "3px",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 3,
          bottom: 3,
          width: "calc(50% - 3px)",
          borderRadius: "9999px",
          background: `linear-gradient(to bottom, ${colors.zinc[100]}, ${colors.zinc[200]})`,
          border: `1px solid ${colors.mutedForeground}`,
          transition: "transform 300ms ease-out",
          transform:
            selectedNamespace === "evm" ? "translateX(0)" : "translateX(100%)",
        }}
      />
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => setSelectedNamespace(t.id)}
          style={{
            position: "relative",
            zIndex: 10,
            padding: "4px 11px",
            fontSize: "10px",
            outline: "none",
            fontWeight: 600,
            borderRadius: "9999px",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            transition: "color 200ms",
            color:
              selectedNamespace === t.id
                ? `${colors.black}`
                : `${colors.mutedForeground}`,
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
