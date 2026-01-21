import React from 'react';
import { cn } from '@/lib/utils';
import { Check, Loader2 } from 'lucide-react';
import type { Wallet } from '@/contexts/DepositContext';

interface WalletCardProps {
  wallet: Wallet;
  onClick: (wallet: Wallet) => void;
  isSelected?: boolean;
}

const WalletCard: React.FC<WalletCardProps> = ({ wallet, onClick, isSelected }) => {
  const isReady = wallet.status === 'ready' || wallet.status === 'connected';
  const isConnecting = wallet.status === 'connecting';

  return (
    <button
      onClick={() => onClick(wallet)}
      className={cn(
        'w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-200 active:scale-[0.98]',
        'bg-card hover:bg-muted/50 border border-border',
        isSelected && 'ring-2 ring-primary border-primary'
      )}
    >
      {/* Wallet Icon */}
      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center overflow-hidden">
        <img 
          src={wallet.icon} 
          alt={wallet.name}
          className="w-8 h-8 object-contain"
        />
      </div>

      {/* Wallet Info */}
      <div className="flex-1 text-left">
        <p className="font-semibold text-foreground">{wallet.name}</p>
        {wallet.address && (
          <p className="text-sm text-muted-foreground">
            {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
          </p>
        )}
      </div>

      {/* Status Badge */}
      {isConnecting ? (
        <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
      ) : isReady ? (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 text-green-600">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <span className="text-xs font-medium">Ready</span>
        </div>
      ) : isSelected ? (
        <Check className="w-5 h-5 text-primary" />
      ) : null}
    </button>
  );
};

export default WalletCard;
