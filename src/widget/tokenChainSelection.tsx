import { useState } from 'react';
import { TokenDef, ChainDef } from 'src/types/';

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
  const [supportedChains, setSupportedChains] = useState<ChainDef[]>([]);
  const [supportedTokens, setSupportedTokens] = useState<TokenDef[]>([]);
  const [selectedChain, setSelectedChain] = useState<ChainDef | null>(null);
  const [selectedToken, setSelectedToken] = useState<TokenDef | null>(null);

  const handleChainSelected = async (chain: ChainDef) => {};

  return (
    <div>
      <h2>Select Blockchain and Token</h2>
    </div> 
  );
}
