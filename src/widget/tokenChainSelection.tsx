import { useState } from 'react';
import { TokenDef, ChainDef } from 'src/types/';
import { useTrustwareConfig } from 'src/hooks/useTrustwareConfig';


type TokenChainSelectionProps = {
  onBack: () => void;
  onNext: () => void;
  onChainSelected: (chain: ChainDef) => void;
  onTokenSelected: (token: TokenDef) => void;
};

export function TokenChainSelection({
  onBack,
  onNext,
  onChainSelected,
  onTokenSelected,
}: TokenChainSelectionProps) {
  const config = useTrustwareConfig();
  const { theme, messages } = config;
  const [activeTab, setActiveTab] = useState<'chains' | 'tokens'>('chains');
  const [supportedChains, setSupportedChains] = useState<ChainDef[]>([]);
  const [supportedTokens, setSupportedTokens] = useState<TokenDef[]>([]);
  const [selectedChain, setSelectedChain] = useState<ChainDef | null>(null);
  const [selectedToken, setSelectedToken] = useState<TokenDef | null>(null);

  const handleChainSelected = async (chain: ChainDef) => { };

  const handleTokenSelected = (token: TokenDef) => { };

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        color: theme.textColor,
      }}
    >
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          borderBottom: `1px solid ${theme.borderColor}`,
          paddingBottom: '8px',
        }}
      >
        <button
          onClick={onBack}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            background: 'none',
            border: 'none',
            color: theme.textColor,
            fontSize: '1.5rem',
            cursor: 'pointer',
          }}
        >
          ←
        </button>
        <h2 style={{ fontSize: '1.5rem', margin: 0, textAlign: 'center' }}>
          Select Chain & Token
        </h2>
        <div>
          {/* Display total balance here if needed */}
        </div>
      </div>

      <div style={{ overflowY: 'auto', maxHeight: '440px', paddingRight: '8px' }}>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${theme.borderColor}`, paddingBottom: '8px' }}>
          <button
            onClick={() => setActiveTab('chains')}
            style={{
              fontWeight: activeTab === 'chains' ? 'bold' : 'normal',
              marginRight: '16px',
              borderBottom: activeTab === 'chains' ? `2px solid ${theme.textColor}` : 'none',
            }}
          >
            Chains
          </button>
          <button
            onClick={() => setActiveTab('tokens')}
            style={{
              fontWeight: activeTab === 'tokens' ? 'bold' : 'normal',
              borderBottom: activeTab === 'tokens' ? `2px solid ${theme.textColor}` : 'none',
            }}
          >
            Tokens
          </button>
        </div>
        {activeTab === 'chains' && (
          <div>
            yo yo chains
          </div>
        )}

        {activeTab === 'tokens' && (
          <div>
            yo yo tokens
          </div>
        )}
      </div>
    </div>
  );
}
