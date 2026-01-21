import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDeposit } from '@/contexts/DepositContext';
import { ArrowLeft, Check } from 'lucide-react';
import SDKContainer from '@/components/deposit/SDKContainer';
import SwipeUpToConfirm from '@/components/deposit/SwipeUpToConfirm';
import ConfettiEffect from '@/components/deposit/ConfettiEffect';

const FiatPayment: React.FC = () => {
  const navigate = useNavigate();
  const { amount, setAmount, selectedPaymentMethod, setTransactionStatus, setTransactionHash } = useDeposit();
  
  const [isEditing, setIsEditing] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const amountInputRef = useRef<HTMLInputElement>(null);

  const parsedAmount = parseFloat(amount);
  const numericAmount = Number.isFinite(parsedAmount) ? parsedAmount : 0;

  const handleConfirm = () => {
    setShowConfetti(true);
    setIsConfirmed(true);
    setTransactionStatus('success');
    setTransactionHash('0x' + Math.random().toString(16).slice(2, 66));
    
    if (navigator.vibrate) {
      navigator.vibrate([50, 50, 100]);
    }
  };

  if (isConfirmed) {
    return (
      <SDKContainer>
        <ConfettiEffect isActive={showConfetti} />
        <div className="flex flex-col min-h-[600px]">
          {/* Header */}
          <div className="flex items-center justify-center px-4 py-4 border-b border-border">
            <h1 className="text-lg font-semibold text-foreground">Complete</h1>
          </div>

          {/* Content */}
          <div className="flex-1 px-6 overflow-y-auto scrollbar-none flex flex-col items-center justify-center">
            <div className="flex-1 flex flex-col items-center justify-center py-8 animate-fade-in">
              {/* Success Icon */}
              <div className="w-32 h-32 rounded-full bg-green-500 flex items-center justify-center animate-scale-in mb-8">
                <Check className="w-16 h-16 text-white" strokeWidth={3} />
              </div>

              {/* Success Message */}
              <div className="text-center space-y-2 mb-6">
                <p className="text-2xl font-bold text-foreground">Payment Complete!</p>
                <p className="text-lg text-muted-foreground">
                  ${numericAmount.toFixed(2)} via {selectedPaymentMethod?.name || 'Fiat'}
                </p>
              </div>

              {/* Done Button */}
              <button
                onClick={() => {
                  setIsConfirmed(false);
                  setShowConfetti(false);
                  navigate('/home');
                }}
                className="w-full h-14 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </SDKContainer>
    );
  }

  return (
    <SDKContainer>
      <div className="flex flex-col min-h-[600px]">
        {/* White content area with rounded bottom corners - overlaps swipe slightly */}
        <div className="flex-1 bg-background rounded-b-[24px] relative z-10 flex flex-col -mb-6">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-border">
            <button
              onClick={() => navigate('/home')}
              className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <h1 className="text-lg font-semibold text-foreground">Fiat Payment</h1>
            <div className="w-10" />
          </div>

          {/* Content */}
          <div className="flex-1 px-6 overflow-y-auto scrollbar-none flex flex-col items-center justify-center pb-8">
            {/* Enter Amount Label */}
            <p className="text-base text-muted-foreground mb-4">Enter an amount</p>
            
            {/* Large Amount Display */}
            <div className="text-center relative mb-6">
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
                    }}
                    onBlur={() => setIsEditing(false)}
                    className="absolute inset-0 w-full bg-transparent border-none outline-none p-0 m-0 text-center text-transparent caret-muted-foreground text-6xl font-bold tracking-tight"
                    style={{ caretColor: 'hsl(var(--muted-foreground) / 0.5)' }}
                  />
                </span>
              </span>
            </div>

            {/* Selected Payment Method Pill */}
            {selectedPaymentMethod && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50">
                <img 
                  src={selectedPaymentMethod.icon} 
                  alt={selectedPaymentMethod.name} 
                  className="w-6 h-4 object-contain"
                />
                <span className="text-sm font-medium text-foreground">{selectedPaymentMethod.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Swipe component - visible at bottom with slight overlap from white area */}
        <SwipeUpToConfirm
          amount={numericAmount}
          tokenSymbol="USDC"
          onComplete={handleConfirm}
          disabled={numericAmount <= 0}
          className="pt-8"
        />
      </div>
    </SDKContainer>
  );
};

export default FiatPayment;
