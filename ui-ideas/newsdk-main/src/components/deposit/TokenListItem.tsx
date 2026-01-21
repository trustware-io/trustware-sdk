import React from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import type { Token } from '@/contexts/DepositContext';

interface TokenListItemProps {
  token: Token;
  onClick: (token: Token) => void;
  isSelected?: boolean;
}

const TokenListItem: React.FC<TokenListItemProps> = ({ token, onClick, isSelected }) => {
  return (
    <button
      onClick={() => onClick(token)}
      className={cn(
        'w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 active:scale-[0.98]',
        'hover:bg-muted/50',
        isSelected && 'bg-primary/5 ring-1 ring-primary/20'
      )}
    >
      {/* Token Icon with Chain Badge */}
      <div className="relative">
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden">
          <img 
            src={token.icon} 
            alt={token.symbol}
            className="w-8 h-8 object-contain"
          />
        </div>
        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-card border-2 border-card flex items-center justify-center overflow-hidden">
          <img 
            src={token.chainIcon} 
            alt={token.chain}
            className="w-4 h-4 object-contain"
          />
        </div>
      </div>

      {/* Token Info */}
      <div className="flex-1 text-left">
        <p className="font-semibold text-foreground">{token.symbol}</p>
        <p className="text-sm text-muted-foreground">{token.chain}</p>
      </div>

      {/* Balance */}
      <div className="text-right">
        <p className="font-medium text-foreground">
          {token.balance.toLocaleString(undefined, { maximumFractionDigits: 6 })}
        </p>
        <p className="text-sm text-muted-foreground">
          ${token.usdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>

      {/* Selected Check */}
      {isSelected && (
        <Check className="w-5 h-5 text-primary ml-2" />
      )}
    </button>
  );
};

export default TokenListItem;
