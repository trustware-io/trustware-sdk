import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Wallet } from '@/contexts/DepositContext';
import { Loader2, Check, ChevronRight } from 'lucide-react';
import metamaskLogo from '@/assets/metamask-logo.png';
import rainbowLogo from '@/assets/rainbow-wallet-logo.png';

interface WalletConnectButtonProps {
  selectedWallet: Wallet | null;
  onConnect: (wallet: Wallet) => void;
  className?: string;
}

// Mock wallet detection
const detectWallets = (): Wallet[] => {
  const wallets: Wallet[] = [];
  
  if (typeof window !== 'undefined' && (window as any).ethereum?.isMetaMask) {
    wallets.push({
      id: 'metamask',
      name: 'MetaMask',
      icon: metamaskLogo,
      status: 'ready',
    });
  }
  
  if (typeof window !== 'undefined' && (window as any).ethereum?.isRainbow) {
    wallets.push({
      id: 'rainbow',
      name: 'Rainbow',
      icon: rainbowLogo,
      status: 'ready',
    });
  }
  
  // Default to MetaMask for demo
  if (wallets.length === 0) {
    wallets.push({
      id: 'metamask',
      name: 'MetaMask',
      icon: metamaskLogo,
      status: 'ready',
    });
  }
  
  return wallets;
};

const WalletConnectButton: React.FC<WalletConnectButtonProps> = ({
  selectedWallet,
  onConnect,
  className,
}) => {
  const [detectedWallet, setDetectedWallet] = useState<Wallet | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    const wallets = detectWallets();
    if (wallets.length > 0) {
      setDetectedWallet(wallets[0]);
    }
  }, []);

  const handleClick = async () => {
    if (selectedWallet) return; // Already connected
    if (!detectedWallet) return;
    
    setIsConnecting(true);
    
    // Simulate connection
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const connectedWallet: Wallet = {
      ...detectedWallet,
      status: 'connected',
      address: '0x1234...5678',
    };
    
    onConnect(connectedWallet);
    setIsConnecting(false);
  };

  const isConnected = selectedWallet?.status === 'connected';
  const displayWallet = selectedWallet || detectedWallet;

  return (
    <button
      onClick={handleClick}
      disabled={isConnecting || isConnected}
      className={cn(
        "inline-flex items-center gap-3 px-5 py-3 rounded-full transition-all border",
        isConnected 
          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600"
          : "bg-muted/40 border-border/50 hover:bg-muted hover:border-border",
        isConnecting && "opacity-70",
        className
      )}
    >
      {displayWallet && (
        <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-white">
          <img 
            src={displayWallet.icon} 
            alt={displayWallet.name} 
            className="w-6 h-6 object-contain" 
          />
        </div>
      )}
      
      <div className="text-left">
        {isConnecting ? (
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="font-medium text-sm">Connecting...</span>
          </div>
        ) : isConnected ? (
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span className="font-medium text-sm">{selectedWallet?.address}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">Connect {displayWallet?.name || 'Wallet'}</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        )}
      </div>
    </button>
  );
};

export default WalletConnectButton;
