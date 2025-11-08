import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ChainDef, TokenDef, TokenWithBalance } from "src/types/";
import { useTrustwareConfig } from "src/hooks/useTrustwareConfig";
import { Registry, NATIVE } from "src/registry";
import { apiBase } from "src/core/http";
import { getBalances, type BalanceRow } from "src/core/balances";
import { walletManager } from "src/wallets";
import { hexToRgba, formatTokenBalance, formatUsd, resolveChainLabel } from "src/utils";

type TokenChainSelectionProps = {
  onBack: () => void;
  onNext: () => void;
  onChainSelected: (chain: ChainDef) => void;
  onTokenSelected: (token: TokenDef) => void;
};

const NATIVE_ADDRESS = NATIVE.toLowerCase();

function mergeTokensWithBalances(
  chain: ChainDef,
  registryTokens: TokenDef[],
  balances: BalanceRow[],
): TokenWithBalance[] {
  const canonicalChainId = chain.chainId ?? chain.id;
  const tokens: TokenWithBalance[] = registryTokens
    .filter((token) => token.visible !== false)
    .map((token) => ({ ...token }));

  const byAddress = new Map<string, BalanceRow>();
  let nativeRow: BalanceRow | undefined;

  for (const row of balances) {
    if (row.category === "erc20" && row.contract) {
      byAddress.set(row.contract.toLowerCase(), row);
    } else if (row.category === "native") {
      nativeRow = row;
    }
  }

  if (nativeRow && canonicalChainId != null) {
    const nativeSymbol = nativeRow.symbol?.toUpperCase?.();
    const chainType = (chain.type ?? chain.chainType ?? "evm") as TokenDef["type"];
    const hasNativeToken = tokens.some((token) => {
      const tokenAddr = token.address?.toLowerCase?.();
      const tokenSymbol = token.symbol?.toUpperCase?.();
      return (
        tokenAddr === NATIVE_ADDRESS ||
        (nativeSymbol && tokenSymbol === nativeSymbol)
      );
    });
    if (!hasNativeToken) {
      const decimals =
        chain.nativeCurrency?.decimals ?? nativeRow.decimals ?? 18;
      const nativeToken: TokenWithBalance = {
        address: NATIVE,
        chainId: canonicalChainId,
        name:
          chain.nativeCurrency?.name ??
          nativeRow.name ??
          nativeRow.symbol ??
          "Native Token",
        symbol:
          chain.nativeCurrency?.symbol ??
          nativeRow.symbol ??
          "NATIVE",
        decimals,
        type: chainType,
        visible: true,
        logoURI: chain.nativeCurrency?.icon,
      };
      tokens.unshift(nativeToken);
    }
  }

  // --- replace the old `return tokens.map(...)` with everything below ---

  // 1) Dedupe registry tokens by (chainId,addressLower)
  const seen = new Set<string>();
  const base = tokens.filter((t) => {
    const cid = (t.chainId ?? canonicalChainId) as number | string | undefined;
    const key = `${cid ?? ""}:${(t.address || "").toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // 2) Merge balances onto the deduped list
  const merged = base.map((t) => {
    const token = { ...t, chainId: t.chainId ?? canonicalChainId }; // ensure chainId present
    const tokenAddress = token.address?.toLowerCase?.();
    let row = tokenAddress ? byAddress.get(tokenAddress) : undefined;

    // map native row to the injected native token (or any registry native marker)
    if (!row && nativeRow) {
      const nativeSymbol = nativeRow.symbol?.toUpperCase?.();
      const tokenSymbol = token.symbol?.toUpperCase?.();
      if (
        tokenAddress === NATIVE_ADDRESS ||
        (nativeSymbol && tokenSymbol === nativeSymbol)
      ) {
        row = nativeRow;
      }
    }

    if (!row?.balance) return token;
    try {
      const balance = BigInt(row.balance);
      return { ...token, balance };
    } catch {
      return token;
    }
  });

  // 3) Final safety: dedupe again, prefer the entry with a non-zero balance
  const pick = new Map<string, TokenWithBalance>();
  for (const t of merged) {
    const cid = (t.chainId ?? canonicalChainId) as number | string | undefined;
    const key = `${cid ?? ""}:${(t.address || "").toLowerCase()}`;
    const cur = pick.get(key);
    if (!cur) {
      pick.set(key, t);
      continue;
    }
    const curHas = cur.balance != null && cur.balance > 0n;
    const tHas = t.balance != null && t.balance > 0n;
    pick.set(key, tHas && !curHas ? t : cur);
  }

  return Array.from(pick.values());
};

export function TokenChainSelection({
  onBack,
  onNext,
  onChainSelected,
  onTokenSelected,
}: TokenChainSelectionProps) {
  const config = useTrustwareConfig();
  const { theme, apiKey } = config;
  const radius = theme.radius ?? 16;
  const [activeTab, setActiveTab] = useState<"chains" | "tokens">("chains");
  const [supportedChains, setSupportedChains] = useState<ChainDef[]>([]);
  const [supportedTokens, setSupportedTokens] = useState<TokenWithBalance[]>([]);
  const [selectedChain, setSelectedChain] = useState<ChainDef | null>(null);
  const [selectedToken, setSelectedToken] = useState<TokenWithBalance | null>(
    null,
  );
  const [loadingChains, setLoadingChains] = useState(true);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const requestRef = useRef(0);
  const [search, setSearch] = useState("");

  const registry = useMemo(() => new Registry(apiBase()), [apiKey]);

  useEffect(() => {
    let cancelled = false;
    setLoadingChains(true);
    const load = async () => {
      try {
        await registry.ensureLoaded();
        if (cancelled) return;
        const chains = registry
          .chains()
          .filter((chain) => chain.visible !== false)
          .filter((chain) => {
            const type =
              (chain.type ?? chain.chainType)?.toString().toLowerCase();
            return !type || type === "evm";
          })
          .sort((a, b) => resolveChainLabel(a).localeCompare(resolveChainLabel(b)));
        setSupportedChains(chains);
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load supported chains", error);
          setSupportedChains([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingChains(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [registry]);

  const handleChainSelected = useCallback(
    async (chain: ChainDef) => {
      const requestId = ++requestRef.current;
      setActiveTab("tokens");
      setSelectedChain(chain);
      setSelectedToken(null);
      setSupportedTokens([]);
      setLoadingTokens(true);
      onChainSelected(chain);
      setSearch("");

      try {
        await registry.ensureLoaded();
        const canonical = chain.chainId ?? chain.id;
        let balances: BalanceRow[] = [];

        const wallet = walletManager.simple;
        if (wallet && canonical != null) {
          const targetId = Number(canonical);
          if (Number.isFinite(targetId)) {
            try {
              await wallet.switchChain(targetId);
            } catch (err) {
              console.warn("Failed to switch wallet chain", err);
            }
          }
          try {
            const address = await wallet.getAddress();
            if (address) {
              balances = await getBalances(canonical, address);
            }
          } catch (err) {
            console.warn("Failed to load balances", err);
          }
        }

        const rawTokens = canonical != null ? registry.tokens(canonical) : [];
        const merged = mergeTokensWithBalances(chain, rawTokens, balances);

        if (requestRef.current === requestId) {
          setSupportedTokens(merged);
        }
      } catch (error) {
        if (requestRef.current === requestId) {
          console.error("Failed to load tokens for chain", error);
          setSupportedTokens([]);
        }
      } finally {
        if (requestRef.current === requestId) {
          setLoadingTokens(false);
        }
      }
    },
    [registry, onChainSelected],
  );

  const handleTokenSelected = useCallback(
    (token: TokenWithBalance) => {
      setSelectedToken(token);
      onTokenSelected(token);
    },
    [onTokenSelected],
  );

  const totalCrossChainBalance = useMemo(() => {
    return supportedTokens.reduce((acc, token) => {
      if (token.balance === undefined) return acc;
      if (token.usdPrice == null || !Number.isFinite(token.usdPrice)) return acc;
      try {
        const amount = Number(token.balance) / Math.pow(10, token.decimals ?? 18);
        if (!Number.isFinite(amount)) return acc;
        return acc + amount * token.usdPrice;
      } catch {
        return acc;
      }
    }, 0);
  }, [supportedTokens]);

  const formattedTotal = useMemo(
    () => formatUsd(totalCrossChainBalance || 0),
    [totalCrossChainBalance],
  );

  const visibleTokens = useMemo(() => {
    if (!selectedChain) return [];

    const q = search.trim().toLowerCase();
    const hasQuery = q.length > 0;

    const hasNonZero = (t: TokenWithBalance) =>
      t.balance != null && t.balance > 0n;

    const matches = (t: TokenWithBalance) => {
      const sym = t.symbol?.toLowerCase?.() ?? "";
      const name = t.name?.toLowerCase?.() ?? "";
      const addr = t.address?.toLowerCase?.() ?? "";
      return (
        sym.includes(q) ||
        name.includes(q) ||
        addr.includes(q)
      );
    };

    // Default = only tokens with balances
    let list = supportedTokens.filter((t) => hasNonZero(t));

    // If searching, show matches regardless of balance
    if (hasQuery) {
      list = supportedTokens.filter(matches);
    }

    // Sort: tokens with balance first, then by symbol
    return list.sort((a, b) => {
      const aHas = hasNonZero(a) ? 1 : 0;
      const bHas = hasNonZero(b) ? 1 : 0;
      if (aHas !== bHas) return bHas - aHas;

      // Optional: sort by (estimated) USD value when both non-zero
      if (a.balance && b.balance && a.usdPrice != null && b.usdPrice != null) {
        const aVal = Number(a.balance) / Math.pow(10, a.decimals ?? 18) * a.usdPrice;
        const bVal = Number(b.balance) / Math.pow(10, b.decimals ?? 18) * b.usdPrice;
        if (Number.isFinite(aVal) && Number.isFinite(bVal) && aVal !== bVal) {
          return bVal - aVal;
        }
      }

      return (a.symbol || "").localeCompare(b.symbol || "");
    });
  }, [supportedTokens, selectedChain, search]);

  const canContinue = selectedChain && selectedToken;
  const continueLabel = canContinue
    ? "Continue"
    : `Continue (${!selectedToken ? "Select token" : "Select chain"})`;

  const headerShadow = hexToRgba(theme.textColor, 0.08);
  const mutedText = hexToRgba(theme.textColor, 0.6);

  const selectedChainKey = selectedChain
    ? String(selectedChain.id ?? selectedChain.chainId ?? "")
    : null;

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        background: theme.backgroundColor,
        color: theme.textColor,
      }}
    >
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          padding: 12,
        }}
      >
        <header
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
          }}
        >
          <button
            type="button"
            onClick={onBack}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              background: "none",
              border: "none",
              color: theme.textColor,
              fontSize: 24,
              cursor: "pointer",
              padding: 4,
            }}
            aria-label="Go back"
          >
            ←
          </button>
          <h2
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              textAlign: "center",
            }}
          >
            Select Chain & Token
          </h2>
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: "-0.02em",
            }}
          >
            {formattedTotal}
          </div>
        </header>

        <div
          style={{
            display: "flex",
            borderBottom: `1px solid ${theme.borderColor}`,
            gap: 12,
            paddingBottom: 8,
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("chains")}
            style={{
              border: "none",
              background: "none",
              padding: 0,
              fontWeight: activeTab === "chains" ? 600 : 500,
              color: activeTab === "chains" ? theme.textColor : mutedText,
              borderBottom:
                activeTab === "chains"
                  ? `2px solid ${theme.primaryColor}`
                  : "2px solid transparent",
              cursor: "pointer",
              paddingBottom: 8,
            }}
          >
            Chains
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("tokens")}
            style={{
              border: "none",
              background: "none",
              padding: 0,
              fontWeight: activeTab === "tokens" ? 600 : 500,
              color: activeTab === "tokens" ? theme.textColor : mutedText,
              borderBottom:
                activeTab === "tokens"
                  ? `2px solid ${theme.primaryColor}`
                  : "2px solid transparent",
              cursor: "pointer",
              paddingBottom: 8,
            }}
          >
            Tokens
          </button>
        </div>

        {activeTab === "chains" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {loadingChains ? (
              <div style={{ color: mutedText }}>Loading chains…</div>
            ) : supportedChains.length === 0 ? (
              <div style={{ color: mutedText }}>No chains available.</div>
            ) : (
              supportedChains.map((chain, idx) => {
                const key =
                  chain.id != null
                    ? String(chain.id)
                    : chain.chainId != null
                      ? String(chain.chainId)
                      : chain.networkIdentifier ?? `chain-${idx}`;
                const isSelected =
                  selectedChainKey !== null &&
                  selectedChainKey === String(key);
                const nativeToken =
                  isSelected
                    ? supportedTokens.find((token) => {
                      if (String(token.chainId ?? "") !== String(key)) {
                        return false;
                      }
                      const tokenAddr = token.address?.toLowerCase?.();
                      const chainSymbol =
                        chain.nativeCurrency?.symbol?.toUpperCase?.();
                      return (
                        tokenAddr === NATIVE_ADDRESS ||
                        (chainSymbol &&
                          token.symbol?.toUpperCase?.() === chainSymbol)
                      );
                    })
                    : undefined;
                const priceLabel = nativeToken?.usdPrice;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      void handleChainSelected(chain);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 16,
                      width: "100%",
                      padding: "12px 16px",
                      borderRadius: radius,
                      border: `1px solid ${isSelected ? theme.primaryColor : theme.borderColor
                        }`,
                      backgroundColor: isSelected
                        ? hexToRgba(theme.primaryColor, 0.12)
                        : hexToRgba(theme.borderColor, 0.08),
                      color: theme.textColor,
                      cursor: "pointer",
                      transition: "border-color 0.2s ease, background-color 0.2s ease",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      {chain.chainIconURI ? (
                        <img
                          src={chain.chainIconURI}
                          alt={resolveChainLabel(chain)}
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            background: hexToRgba(theme.borderColor, 0.5),
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 600,
                          }}
                        >
                          {resolveChainLabel(chain).slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>
                          {resolveChainLabel(chain)}
                        </span>
                        <span style={{ color: mutedText, fontSize: 12 }}>
                          Chain ID: {" "}
                          {chain.id ?? chain.chainId ?? chain.networkIdentifier}
                        </span>
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-end",
                        gap: 4,
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>
                        {(chain.type ?? chain.chainType ?? "")
                          .toString()
                          .toUpperCase()}
                      </span>
                      <span style={{ color: mutedText, fontSize: 12 }}>
                        {priceLabel != null ? formatUsd(priceLabel) : "N/A"}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}

        {activeTab === "tokens" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {!selectedChain ? (
              <div style={{ color: mutedText }}>Select a chain to view available tokens.</div>
            ) : loadingTokens ? (
              <div style={{ color: mutedText }}>Loading tokens…</div>
            ) : (
              <>
                {/* NEW: Search input */}
                <div style={{ position: "sticky", top: 0, background: theme.backgroundColor, paddingBottom: 8 }}>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search token by symbol, name, or address"
                    style={{
                      width: "100%",
                      height: 40,
                      borderRadius: radius,
                      border: `1px solid ${theme.borderColor}`,
                      background: hexToRgba(theme.borderColor, 0.08),
                      color: theme.textColor,
                      padding: "0 12px",
                      outline: "none",
                    }}
                    aria-label="Search tokens"
                  />
                  <div style={{ marginTop: 8, fontSize: 12, color: mutedText }}>
                    {search
                      ? `Showing ${visibleTokens.length} result${visibleTokens.length === 1 ? "" : "s"} for “${search}”`
                      : `Showing ${visibleTokens.length} token${visibleTokens.length === 1 ? "" : "s"} with balance`}
                  </div>
                </div>

                {/* List */}
                {visibleTokens.length === 0 ? (
                  <div style={{ color: mutedText }}>
                    {search
                      ? "No tokens match your search."
                      : "You have no token balances on this chain."}
                  </div>
                ) : (
                  visibleTokens.map((token) => {
                    const tokenKey = `${token.chainId}-${token.address}`;
                    const isSelected =
                      selectedToken?.address === token.address &&
                      String(selectedToken.chainId ?? "") === String(token.chainId ?? "");

                    return (
                      <button
                        key={tokenKey}
                        type="button"
                        onClick={() => handleTokenSelected(token)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 16,
                          width: "100%",
                          padding: "12px 16px",
                          borderRadius: radius,
                          border: `1px solid ${isSelected ? theme.primaryColor : theme.borderColor}`,
                          backgroundColor: isSelected
                            ? hexToRgba(theme.primaryColor, 0.12)
                            : hexToRgba(theme.borderColor, 0.08),
                          color: theme.textColor,
                          cursor: "pointer",
                          transition: "border-color 0.2s ease, background-color 0.2s ease",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          {token.logoURI ? (
                            <img
                              src={token.logoURI}
                              alt={token.symbol}
                              style={{ width: 40, height: 40, borderRadius: 20, objectFit: "cover" }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                background: hexToRgba(theme.borderColor, 0.5),
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 600,
                              }}
                            >
                              {(token.symbol || "?").slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div style={{ display: "flex", flexDirection: "column", gap: 4, textAlign: "left" }}>
                            <span style={{ fontWeight: 600 }}>{token.symbol}</span>
                            <span style={{ color: mutedText, fontSize: 12 }}>
                              {(token.name || "Unknown token")} · Chain ID: {token.chainId}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                          <span style={{ fontWeight: 600 }}>
                            {token.usdPrice != null ? formatUsd(token.usdPrice) : "No price"}
                          </span>
                          <span style={{ color: mutedText, fontSize: 12 }}>
                            Balance: {formatTokenBalance(token)}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div
        style={{
          padding: "16px 24px",
          borderTop: `1px solid ${theme.borderColor}`,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <button
          type="button"
          onClick={() => {
            if (canContinue) onNext();
          }}
          disabled={!canContinue}
          style={{
            width: "100%",
            height: 48,
            borderRadius: radius,
            border: "none",
            backgroundColor: canContinue
              ? theme.primaryColor
              : hexToRgba(theme.borderColor, 0.6),
            color: theme.backgroundColor,
            fontWeight: 600,
            cursor: canContinue ? "pointer" : "not-allowed",
            opacity: canContinue ? 1 : 0.7,
            transition: "background-color 0.2s ease, opacity 0.2s ease",
          }}
        >
          {continueLabel}
        </button>
      </div>
    </div>
  );
}
