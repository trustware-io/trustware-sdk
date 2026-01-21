import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDeposit, Token } from '@/contexts/DepositContext';
import { ChevronLeft, Search, Sparkles, Link2, Coins } from 'lucide-react';
import SDKContainer from '@/components/deposit/SDKContainer';
import { cn } from '@/lib/utils';
import ethereumIcon from '@/assets/ethereum-icon.svg';
import tetherIcon from '@/assets/tether-icon.svg';
import usdcIcon from '@/assets/usdc-logo.webp';
import polygonIcon from '@/assets/polygon-logo.png';
import bnbIcon from '@/assets/bnb-logo.png';
import solanaIcon from '@/assets/solana-logo.png';
import avaxIcon from '@/assets/avax-logo.png';
import baseIcon from '@/assets/base-logo.png';
import bitcoinIcon from '@/assets/bitcoin-logo.webp';

// Chain data
interface Chain {
  id: string;
  name: string;
  icon: string;
}

const popularChains: Chain[] = [
  { id: 'ethereum', name: 'Ethereum', icon: ethereumIcon },
  { id: 'bitcoin', name: 'Bitcoin', icon: bitcoinIcon },
  { id: 'solana', name: 'Solana', icon: solanaIcon },
  { id: 'polygon', name: 'Polygon', icon: polygonIcon },
  { id: 'base', name: 'Base', icon: baseIcon },
  { id: 'bnb', name: 'BNB Chain', icon: bnbIcon },
];

const allChains: Chain[] = [
  ...popularChains,
  { id: 'avalanche', name: 'Avalanche', icon: avaxIcon },
];

// Mock token data - in production would come from wallet
const mockTokens: Token[] = [
  { id: 'usdc-eth', symbol: 'USDC', name: 'USD Coin', chain: 'Ethereum', chainIcon: ethereumIcon, icon: usdcIcon, balance: 4.639, usdValue: 4.64, decimals: 6 },
  { id: 'usdt-eth', symbol: 'USDT', name: 'Tether', chain: 'Ethereum', chainIcon: ethereumIcon, icon: tetherIcon, balance: 4.422, usdValue: 4.42, decimals: 6 },
  { id: 'avax', symbol: 'AVAX', name: 'Avalanche', chain: 'Avalanche', chainIcon: avaxIcon, icon: avaxIcon, balance: 0.2837, usdValue: 12.50, decimals: 18 },
  { id: 'usdc-polygon', symbol: 'USDC', name: 'USD Coin', chain: 'Polygon', chainIcon: polygonIcon, icon: usdcIcon, balance: 0.9954, usdValue: 0.99, decimals: 6 },
  { id: 'usdt-polygon', symbol: 'USDT', name: 'Tether', chain: 'Polygon', chainIcon: polygonIcon, icon: tetherIcon, balance: 0.6427, usdValue: 0.64, decimals: 6 },
];

const popularTokens: Token[] = [
  { id: 'eth', symbol: 'ETH', name: 'Ethereum', chain: 'Ethereum', chainIcon: ethereumIcon, icon: ethereumIcon, balance: 0, usdValue: 0, decimals: 18 },
  { id: 'usdt', symbol: 'USDT', name: 'Tether', chain: 'Ethereum', chainIcon: ethereumIcon, icon: tetherIcon, balance: 0, usdValue: 0, decimals: 6 },
  { id: 'usdc', symbol: 'USDC', name: 'USD Coin', chain: 'Ethereum', chainIcon: ethereumIcon, icon: usdcIcon, balance: 0, usdValue: 0, decimals: 6 },
];

const SelectToken: React.FC = () => {
  const navigate = useNavigate();
  const { selectedToken, setSelectedToken, setAmount, setNetworkFees } = useDeposit();
  const [chainSearch, setChainSearch] = useState('');
  const [tokenSearch, setTokenSearch] = useState('');
  const [selectedChain, setSelectedChain] = useState<string | null>(null);

  // Filter chains by search
  const filteredChains = useMemo(() => {
    if (!chainSearch) return allChains;
    const query = chainSearch.toLowerCase();
    return allChains.filter(c => c.name.toLowerCase().includes(query));
  }, [chainSearch]);

  // Filter tokens by search and chain
  const filteredUserTokens = useMemo(() => {
    let tokens = mockTokens;
    if (selectedChain) {
      tokens = tokens.filter(t => t.chain.toLowerCase().includes(selectedChain.toLowerCase()));
    }
    if (tokenSearch) {
      const query = tokenSearch.toLowerCase();
      tokens = tokens.filter(t => 
        t.symbol.toLowerCase().includes(query) || 
        t.name.toLowerCase().includes(query)
      );
    }
    return tokens;
  }, [tokenSearch, selectedChain]);

  const filteredPopularTokens = useMemo(() => {
    if (!tokenSearch) return popularTokens;
    const query = tokenSearch.toLowerCase();
    return popularTokens.filter(t => 
      t.symbol.toLowerCase().includes(query) || 
      t.name.toLowerCase().includes(query)
    );
  }, [tokenSearch]);

  const handleTokenSelect = (token: Token) => {
    setSelectedToken(token);
    setAmount('0');
    setNetworkFees({
      networkFee: 0,
      totalFee: 0,
      estimatedReceive: 0,
    });
    navigate('/cryptopay');
  };

  return (
    <SDKContainer>
      <div className="flex flex-col h-[650px]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-border/50">
          <button
            onClick={() => navigate('/')}
            className="w-10 h-10 rounded-full border border-border/50 flex items-center justify-center hover:bg-muted/50 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-lg font-semibold text-foreground">Select Token</h1>
          <div className="w-10" />
        </div>

        {/* Search Inputs */}
        <div className="flex gap-3 px-4 py-4">
          <div className="relative flex-[0.45]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Chain"
              value={chainSearch}
              onChange={(e) => setChainSearch(e.target.value)}
              className="w-full h-11 pl-10 pr-4 rounded-full bg-background border border-border/50 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 text-foreground placeholder:text-muted-foreground text-sm"
            />
          </div>
          <div className="relative flex-[0.55]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Token"
              value={tokenSearch}
              onChange={(e) => setTokenSearch(e.target.value)}
              className="w-full h-11 pl-10 pr-4 rounded-full bg-background border border-primary/40 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-foreground placeholder:text-muted-foreground text-sm"
            />
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column - Chains */}
          <div className="w-[42%] border-r border-border/30 overflow-y-auto px-3 pb-4 scrollbar-none">
            {/* All Chains Button */}
            <button
              onClick={() => setSelectedChain(null)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2.5 rounded-xl mb-3 transition-all whitespace-nowrap",
                !selectedChain 
                  ? "bg-background border border-border shadow-sm text-foreground" 
                  : "hover:bg-muted/50 text-foreground"
              )}
            >
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
                !selectedChain ? "bg-primary/10" : "bg-primary/10"
              )}>
                <Link2 className="w-4 h-4 text-primary" />
              </div>
              <span className="font-medium text-sm">All Chains</span>
            </button>

            {/* Popular Chains Section */}
            <div className="flex items-center gap-1.5 px-2 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-medium text-primary">Popular chains</span>
            </div>

            <div className="space-y-1 mb-4">
              {popularChains.filter(c => 
                !chainSearch || c.name.toLowerCase().includes(chainSearch.toLowerCase())
              ).map(chain => (
                <button
                  key={chain.id}
                  onClick={() => setSelectedChain(chain.id === selectedChain ? null : chain.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all",
                    selectedChain === chain.id 
                      ? "bg-primary/10 text-foreground" 
                      : "hover:bg-muted/50 text-foreground"
                  )}
                >
                  <img src={chain.icon} alt={chain.name} className="w-7 h-7 rounded-full" />
                  <span className="font-medium text-sm">{chain.name}</span>
                </button>
              ))}
            </div>

            {/* Chains A-Z Section */}
            <div className="flex items-center gap-1.5 px-2 mb-2">
              <Link2 className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-medium text-primary">Chains A-Z</span>
            </div>

            <div className="space-y-1">
              {filteredChains
                .filter(c => !popularChains.some(p => p.id === c.id))
                .map(chain => (
                  <button
                    key={chain.id}
                    onClick={() => setSelectedChain(chain.id === selectedChain ? null : chain.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all",
                      selectedChain === chain.id 
                        ? "bg-primary/10 text-foreground" 
                        : "hover:bg-muted/50 text-foreground"
                    )}
                  >
                    <img src={chain.icon} alt={chain.name} className="w-7 h-7 rounded-full" />
                    <span className="font-medium text-sm">{chain.name}</span>
                  </button>
                ))}
            </div>
          </div>

          {/* Right Column - Tokens */}
          <div className="flex-1 overflow-y-auto px-3 pb-4 scrollbar-none">
            {/* Your Tokens Section */}
            {filteredUserTokens.length > 0 && (
              <>
                <div className="flex items-center gap-1.5 px-2 mb-2">
                  <Coins className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-medium text-primary">Your tokens</span>
                </div>

                <div className="space-y-1 mb-4">
                  {filteredUserTokens.map(token => (
                    <button
                      key={token.id}
                      onClick={() => handleTokenSelect(token)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all",
                        selectedToken?.id === token.id 
                          ? "bg-muted/80" 
                          : "hover:bg-muted/50"
                      )}
                    >
                      {/* Token Icon with Chain Badge */}
                      <div className="relative">
                        <img src={token.icon} alt={token.symbol} className="w-9 h-9 rounded-full" />
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-background border border-background flex items-center justify-center overflow-hidden">
                          <img src={token.chainIcon} alt={token.chain} className="w-3.5 h-3.5 rounded-full" />
                        </div>
                      </div>

                      {/* Token Info */}
                      <div className="flex-1 text-left">
                        <p className="font-semibold text-foreground text-sm">{token.symbol}</p>
                        <p className="text-xs text-muted-foreground">
                          {token.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })} {token.symbol}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Popular Tokens Section */}
            <div className="flex items-center gap-1.5 px-2 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-medium text-primary">Popular tokens</span>
            </div>

            <div className="space-y-1">
              {filteredPopularTokens.map(token => (
                <button
                  key={token.id}
                  onClick={() => handleTokenSelect(token)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all",
                    selectedToken?.id === token.id 
                      ? "bg-muted/80" 
                      : "hover:bg-muted/50"
                  )}
                >
                  {/* Token Icon with Chain Badge */}
                  <div className="relative">
                    <img src={token.icon} alt={token.symbol} className="w-9 h-9 rounded-full" />
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-background border border-background flex items-center justify-center overflow-hidden">
                      <img src={token.chainIcon} alt={token.chain} className="w-3.5 h-3.5 rounded-full" />
                    </div>
                  </div>

                  {/* Token Info */}
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-foreground text-sm">{token.name}</p>
                    <p className="text-xs text-muted-foreground">{token.symbol}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SDKContainer>
  );
};

export default SelectToken;
