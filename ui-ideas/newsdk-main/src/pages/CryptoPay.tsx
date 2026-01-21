import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDeposit, Token } from '@/contexts/DepositContext';
import { ArrowUpDown, Lock, Check, X } from 'lucide-react';
import CircularProgress from '@/components/deposit/CircularProgress';
import { Button } from '@/components/ui/button';
import SwipeToConfirmTokens from '@/components/deposit/SwipeToConfirmTokens';
import SDKContainer from '@/components/deposit/SDKContainer';
import AmountSlider from '@/components/deposit/AmountSlider';
import TokenSwipePill from '@/components/deposit/TokenSwipePill';
import ConfettiEffect from '@/components/deposit/ConfettiEffect';
import trustwareLogo from '@/assets/trustware-logo.png';
import ethereumIcon from '@/assets/ethereum-icon.svg';
import tetherIcon from '@/assets/tether-icon.svg';
import usdcIcon from '@/assets/usdc-logo.webp';
import polygonIcon from '@/assets/polygon-logo.png';
import avaxIcon from '@/assets/avax-logo.png';
import polymarketIcon from '@/assets/polymarket-logo.png';

// Mock tokens for swipe selection
const availableTokens: Token[] = [
  { id: 'usdc-eth', symbol: 'USDC', name: 'USD Coin', chain: 'Ethereum', chainIcon: ethereumIcon, icon: usdcIcon, balance: 150, usdValue: 150, decimals: 6 },
  { id: 'usdt-eth', symbol: 'USDT', name: 'Tether', chain: 'Ethereum', chainIcon: ethereumIcon, icon: tetherIcon, balance: 200, usdValue: 200, decimals: 6 },
  { id: 'eth', symbol: 'ETH', name: 'Ethereum', chain: 'Ethereum', chainIcon: ethereumIcon, icon: ethereumIcon, balance: 0.5, usdValue: 1750, decimals: 18 },
  { id: 'usdc-polygon', symbol: 'USDC', name: 'USD Coin', chain: 'Polygon', chainIcon: polygonIcon, icon: usdcIcon, balance: 75, usdValue: 75, decimals: 6 },
  { id: 'avax', symbol: 'AVAX', name: 'Avalanche', chain: 'Avalanche', chainIcon: avaxIcon, icon: avaxIcon, balance: 10, usdValue: 350, decimals: 18 },
];

const CryptoPay: React.FC = () => {
  const navigate = useNavigate();
  const { 
    selectedWallet, 
    selectedToken, 
    setSelectedToken, 
    amount, 
    setAmount,
    setNetworkFees,
    setTransactionStatus, 
    setTransactionHash 
  } = useDeposit();
  
  const [showConfetti, setShowConfetti] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [sliderValue, setSliderValue] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const amountInputRef = useRef<HTMLInputElement>(null);

  // Redirect to home if wallet not connected
  useEffect(() => {
    if (!selectedWallet || selectedWallet.status !== 'connected') {
      navigate('/home');
    }
  }, [selectedWallet, navigate]);

  // Initialize with default token if none selected
  useEffect(() => {
    if (!selectedToken) {
      setSelectedToken(availableTokens[0]);
    }
  }, [selectedToken, setSelectedToken]);

  // Sync slider with amount
  useEffect(() => {
    const numAmount = parseFloat(amount) || 0;
    setSliderValue(numAmount);
  }, [amount]);

  const currentToken = selectedToken || availableTokens[0];
  const maxAmount = currentToken.usdValue;
  const parsedAmount = parseFloat(amount);
  const numericAmount = Number.isFinite(parsedAmount) ? parsedAmount : sliderValue;
  const tokenPrice = currentToken.usdValue / currentToken.balance;
  const tokenAmount = tokenPrice > 0 ? numericAmount / tokenPrice : 0;

  const handleSliderChange = (value: number) => {
    setSliderValue(value);
    setAmount(value.toString());
    // Update network fees
    setNetworkFees({
      networkFee: value * 0.01,
      totalFee: value * 0.01,
      estimatedReceive: value * 0.99,
    });
  };

  const handleTokenChange = (token: Token) => {
    setSelectedToken(token);
    // Reset amount to 0 when switching tokens
    setSliderValue(0);
    setAmount('0');
  };

  const handleConfirm = useCallback(() => {
    setIsProcessing(true);
    setProcessingProgress(0);
  }, []);

  // Handle processing progress
  useEffect(() => {
    if (!isProcessing) return;
    
    const interval = setInterval(() => {
      setProcessingProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          // Show success
          setShowConfetti(true);
          setIsConfirmed(true);
          setTransactionStatus('success');
          setTransactionHash('0x' + Math.random().toString(16).slice(2, 66));
          setIsProcessing(false);
          
          // Haptic feedback
          if (navigator.vibrate) {
            navigator.vibrate([50, 50, 100]);
          }
          return 100;
        }
        return prev + 2;
      });
    }, 50);
    
    return () => clearInterval(interval);
  }, [isProcessing, setTransactionStatus, setTransactionHash]);

  const handleExpandTokens = () => {
    navigate('/select-token');
  };

  const isWalletConnected = selectedWallet?.status === 'connected';

  if (!isWalletConnected) {
    return null; // Will redirect via useEffect
  }

  return (
    <SDKContainer showDarkModeToggle={false}>
      <ConfettiEffect isActive={showConfetti} />
      
      <div className="flex flex-col min-h-[600px]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-border">
          <div className="w-10" />
          <h1 className="text-lg font-semibold text-foreground">
            {isConfirmed ? 'Complete' : 'Deposit'}
          </h1>
          {isConfirmed ? (
            <button
              onClick={() => {
                setIsConfirmed(false);
                setShowConfetti(false);
              }}
              className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
            >
              <X className="w-5 h-5 text-foreground" />
            </button>
          ) : (
            <div className="w-10" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 px-6 overflow-y-auto scrollbar-none flex flex-col items-center">
          {/* Confirmed State */}
          {isConfirmed ? (
            <div className="flex-1 flex flex-col items-center justify-center py-8 animate-fade-in">
              {/* Success Icon */}
              <div className="w-32 h-32 rounded-full bg-green-500 flex items-center justify-center animate-scale-in mb-8">
                <Check className="w-16 h-16 text-white" strokeWidth={3} />
              </div>

              {/* Success Message */}
              <div className="text-center space-y-2 mb-6">
                <p className="text-2xl font-bold text-foreground">Deposit Complete!</p>
                <p className="text-lg text-muted-foreground">
                  ${numericAmount.toFixed(2)} {currentToken.symbol}
                </p>
              </div>

              {/* Done Button */}
              <Button
                onClick={() => {
                  setIsConfirmed(false);
                  setShowConfetti(false);
                }}
                className="w-full h-14 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
              >
                Done
              </Button>
            </div>
          ) : (
            <>
              {/* Enter Amount Label */}
              <p className="text-base text-muted-foreground mb-4 mt-4">Enter an amount</p>
              
              {/* Large Amount Display - Always Centered */}
              <div className="text-center relative">
                {/* Visible display - ALWAYS the same structure, always centered */}
                <span 
                  className="text-6xl font-bold tracking-tight cursor-pointer"
                  onClick={() => {
                    const isZeroish = !amount || parseFloat(amount) === 0;
                    setIsEditing(true);
                    if (isZeroish) setAmount('');

                    setTimeout(() => {
                      const input = amountInputRef.current;
                      if (!input) return;
                      input.focus();
                      input.setSelectionRange(0, 0);
                    }, 0);
                  }}
                >
                  <span className="text-foreground">$</span>
                  <span className="relative inline-block min-w-[1ch]">
                  <span className={numericAmount > 0 ? "text-foreground" : "text-muted-foreground/40"}>
                      {isEditing
                        ? (amount || '0')
                        : numericAmount > 0 
                          ? numericAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) 
                          : '0'}
                    </span>
                    {!isEditing && numericAmount === 0 && (
                      <span className="text-muted-foreground/40">.00</span>
                    )}
                    {/* Input overlays the amount text - shows real caret */}
                    <input
                      ref={amountInputRef}
                      type="text"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9.]/g, '');
                        const parts = raw.split('.');
                        const sanitized = parts.length > 2 
                          ? parts[0] + '.' + parts.slice(1).join('')
                          : raw;
                        
                        setAmount(sanitized);
                        handleSliderChange(parseFloat(sanitized) || 0);
                        
                        // If empty after deletion, move cursor to start
                        if (sanitized === '') {
                          setTimeout(() => {
                            const input = amountInputRef.current;
                            if (input) input.setSelectionRange(0, 0);
                          }, 0);
                        }
                      }}
                      onBlur={() => setIsEditing(false)}
                      className="absolute inset-0 w-full bg-transparent border-none outline-none p-0 m-0 text-center text-transparent caret-muted-foreground text-6xl font-bold tracking-tight"
                      style={{ caretColor: 'hsl(var(--muted-foreground) / 0.5)' }}
                    />
                  </span>
                </span>
              </div>
              
              {/* Token Amount */}
              <div className="flex items-center gap-2 mt-4">
                <span className="text-lg text-muted-foreground">
                  {tokenAmount > 0 ? tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 5 }) : '0'} {currentToken.symbol}
                </span>
                <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
              </div>

              {/* Balance + Max Button */}
              <div className="flex items-center gap-3 mt-2">
                <span className="text-sm font-semibold text-blue-500">
                  Balance {currentToken.balance.toLocaleString(undefined, { maximumFractionDigits: 8 })}
                </span>
                <button 
                  onClick={() => handleSliderChange(maxAmount)}
                  className="px-3 py-1 text-xs font-medium text-muted-foreground bg-muted rounded-full hover:bg-muted/80 transition-colors"
                >
                  Max
                </button>
              </div>

              {/* Processing State - replaces token pill, slider, and swipe bar */}
              {isProcessing ? (
                <div className="flex flex-col items-center justify-center py-8 mt-4">
                  <CircularProgress 
                    progress={processingProgress} 
                    size={120} 
                    strokeWidth={8}
                    showPercentage={true}
                  />
                  <p className="mt-4 text-sm text-muted-foreground">Processing transaction...</p>
                </div>
              ) : (
                <>
                  {/* Token Swipe Pill */}
                  <div className="mt-6 flex flex-col gap-3">
                    <TokenSwipePill
                      tokens={availableTokens}
                      selectedToken={currentToken}
                      onTokenChange={handleTokenChange}
                      onExpandClick={handleExpandTokens}
                      walletAddress={selectedWallet?.address}
                    />
                  </div>

                  {/* Amount Slider */}
                  <div className="w-full mt-8 px-2">
                    <AmountSlider
                      value={sliderValue}
                      onChange={handleSliderChange}
                      max={maxAmount}
                    />
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Bottom Action */}
        {!isProcessing && !isConfirmed && (
          <div className="px-6 py-4">
            <SwipeToConfirmTokens
              fromToken={currentToken}
              toTokenIcon={polymarketIcon}
              toTokenSymbol="Polymarket"
              toChainName="Polymarket"
              amount={numericAmount}
              onComplete={handleConfirm}
              disabled={numericAmount <= 0}
              isWalletConnected={true}
            />
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/30 flex items-center justify-center gap-2">
          <Lock className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Secured by{' '}
            <span className="font-semibold text-black inline-flex items-center gap-1">
              Trustware
              <img src={trustwareLogo} alt="Trustware" className="w-3.5 h-3.5" />
            </span>
          </span>
        </div>
      </div>
    </SDKContainer>
  );
};

export default CryptoPay;
