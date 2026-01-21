import React, { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Token } from '@/contexts/DepositContext';

interface SwipeToConfirmTokensProps {
  fromToken: Token;
  toTokenIcon: string;
  toTokenSymbol: string;
  toChainName: string;
  amount: number;
  onComplete: () => void;
  disabled?: boolean;
  isWalletConnected?: boolean;
  className?: string;
}

const SwipeToConfirmTokens: React.FC<SwipeToConfirmTokensProps> = ({
  fromToken,
  toTokenIcon,
  toTokenSymbol,
  toChainName,
  amount,
  onComplete,
  disabled = false,
  isWalletConnected = false,
  className,
}) => {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbSize = 48;
  const padding = 4;

  const getMaxDrag = useCallback(() => {
    if (!trackRef.current) return 0;
    return trackRef.current.offsetWidth - thumbSize - padding * 2;
  }, []);

  const getProgress = useCallback(() => {
    const maxDrag = getMaxDrag();
    return maxDrag > 0 ? dragX / maxDrag : 0;
  }, [dragX, getMaxDrag]);

  const handleDragStart = useCallback((clientX: number) => {
    if (disabled || isComplete) return;
    setIsDragging(true);
  }, [disabled, isComplete]);

  const handleDragMove = useCallback((clientX: number) => {
    if (!isDragging || !trackRef.current || isComplete) return;
    
    const rect = trackRef.current.getBoundingClientRect();
    const newX = clientX - rect.left - thumbSize / 2 - padding;
    const maxDrag = getMaxDrag();
    const clampedX = Math.max(0, Math.min(newX, maxDrag));
    
    setDragX(clampedX);
  }, [isDragging, isComplete, getMaxDrag]);

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    const progress = getProgress();
    
    if (progress >= 0.9) {
      setDragX(getMaxDrag());
      setIsComplete(true);
      
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      
      // Immediately call onComplete - parent handles processing UI
      onComplete();
    } else {
      setDragX(0);
    }
  }, [isDragging, getProgress, getMaxDrag, onComplete]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleDragStart(e.clientX);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    handleDragMove(e.clientX);
  }, [handleDragMove]);

  const handleMouseUp = useCallback(() => {
    handleDragEnd();
  }, [handleDragEnd]);

  const handleTouchStart = (e: React.TouchEvent) => {
    handleDragStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    handleDragMove(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    handleDragEnd();
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const progress = getProgress();

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      {/* Swipe Track */}
      <div
        ref={trackRef}
        className={cn(
          'relative h-14 w-full rounded-full overflow-hidden select-none border border-border/50',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        style={{
          background: progress > 0 
            ? `linear-gradient(to right, hsl(142 71% 45%) ${progress * 100}%, hsl(var(--muted) / 0.4) ${progress * 100}%)`
            : 'hsl(var(--muted) / 0.4)'
        }}
      >
        {/* "Swipe to confirm" or "Connect wallet" text */}
        <div className={cn(
          'absolute inset-0 flex items-center justify-center transition-opacity duration-200',
          progress > 0.15 && 'opacity-0'
        )}>
          <span className="text-sm text-foreground font-bold">
            {isWalletConnected ? 'Swipe to confirm' : 'Connect your wallet to deposit'}
          </span>
        </div>

        {/* Draggable Thumb - Token icon without circle background */}
        <div
          className={cn(
            'absolute top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing z-10',
            isDragging && 'scale-105'
          )}
          style={{ 
            left: `${dragX + padding}px`,
            transition: isDragging ? 'transform 0.1s' : 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.15s'
          }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <img 
            src={fromToken.icon} 
            alt={fromToken.symbol} 
            className="w-10 h-10 object-contain" 
          />
        </div>

        {/* Destination Icon - Becomes more visible as you drag closer */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center transition-opacity"
          style={{ 
            right: `${padding}px`,
            opacity: 0.2 + (progress * 0.8)
          }}
        >
          <img 
            src={toTokenIcon} 
            alt={toTokenSymbol} 
            className="w-10 h-10 object-contain" 
          />
        </div>
      </div>

      {/* Token to Chain label below - only show when wallet connected */}
      {isWalletConnected && (
        <span className="text-xs text-muted-foreground">
          {fromToken.symbol} on {fromToken.chain} → {toChainName}
        </span>
      )}
    </div>
  );
};

export default SwipeToConfirmTokens;