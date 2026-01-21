import React, { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Token } from '@/contexts/DepositContext';
import { ChevronLeft, ChevronRight, ChevronDown, Wallet } from 'lucide-react';

interface TokenSwipePillProps {
  tokens: Token[];
  selectedToken: Token;
  onTokenChange: (token: Token) => void;
  onExpandClick: () => void;
  walletAddress?: string;
  className?: string;
}

const TokenSwipePill: React.FC<TokenSwipePillProps> = ({
  tokens,
  selectedToken,
  onTokenChange,
  onExpandClick,
  walletAddress,
  className,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const startXRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const currentIndex = tokens.findIndex(t => t.id === selectedToken.id);
  const swipeThreshold = 30;

  // Calculate position for continuous carousel
  const getPosition = (index: number) => {
    const offset = index - currentIndex;
    const total = tokens.length;
    let pos = ((offset % total) + total) % total;
    if (pos > Math.floor(total / 2)) {
      pos = pos - total;
    }
    return pos;
  };

  const handleDragStart = useCallback((clientX: number) => {
    setIsDragging(true);
    startXRef.current = clientX;
  }, []);

  const handleDragMove = useCallback((clientX: number) => {
    if (!isDragging) return;
    const delta = startXRef.current - clientX;
    setDragOffset(delta);
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    
    if (Math.abs(dragOffset) > swipeThreshold) {
      // Swipe left (positive delta) = next token, swipe right (negative delta) = prev token
      const direction = dragOffset > 0 ? 1 : -1;
      const newIndex = (currentIndex + direction + tokens.length) % tokens.length;
      
      onTokenChange(tokens[newIndex]);
      if (navigator.vibrate) {
        navigator.vibrate(10);
      }
    }
    
    setDragOffset(0);
  }, [isDragging, dragOffset, currentIndex, tokens, onTokenChange]);

  // Mouse events
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

  // Touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    handleDragStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    handleDragMove(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    handleDragEnd();
  };

  // Add/remove global mouse listeners
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

  // Clamp drag offset for visual effect
  const visualOffset = Math.max(-40, Math.min(40, dragOffset * 0.5));

  const hasMultipleTokens = tokens.length > 1;

  return (
    <div 
      ref={containerRef}
      className={cn(
        "relative inline-flex items-start gap-2 px-4 py-1.5 bg-muted/40 rounded-full border border-border/50 select-none touch-none",
        hasMultipleTokens && "cursor-grab active:cursor-grabbing",
        isDragging && "bg-muted/60",
        className
      )}
      onMouseDown={hasMultipleTokens ? handleMouseDown : undefined}
      onTouchStart={hasMultipleTokens ? handleTouchStart : undefined}
      onTouchMove={hasMultipleTokens ? handleTouchMove : undefined}
      onTouchEnd={hasMultipleTokens ? handleTouchEnd : undefined}
    >
      {/* Left Section: Carousel + Dots + Wallet Indicator */}
      <div className="flex flex-col items-center">
        <div className="flex items-center h-12">
          {/* Left Chevron Arrow */}
          {hasMultipleTokens && (
            <ChevronLeft 
              className="w-4 h-4 text-muted-foreground/60 transition-all duration-200"
            />
          )}

          {/* Carousel Container */}
          <div className="relative flex items-center justify-center h-12 w-20 overflow-hidden">
            {/* Tokens in carousel */}
            {tokens.map((token, index) => {
              const pos = getPosition(index);
              const isCenter = pos === 0;
              const isVisible = Math.abs(pos) <= 1;

              if (!isVisible) return null;

              // Calculate transform based on position + drag offset
              const baseOffset = pos * 32;
              const currentOffset = baseOffset - visualOffset;
              const scale = isCenter ? 1 : 0.6;
              const opacity = isCenter ? 1 : 0.5;
              const blur = isCenter ? 0 : 1;
              const zIndex = isCenter ? 10 : 5;

              return (
                <div
                  key={token.id}
                  className={cn(
                    "absolute transition-all",
                    isDragging ? "duration-75" : "duration-200 ease-out"
                  )}
                  style={{
                    transform: `translateX(${currentOffset}px) scale(${scale})`,
                    opacity,
                    filter: `blur(${blur}px)`,
                    zIndex,
                  }}
                >
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center bg-white shadow-sm">
                      <img 
                        src={token.icon} 
                        alt={token.symbol} 
                        className="w-8 h-8 object-contain" 
                      />
                    </div>
                    {/* Chain Icon - only on center token */}
                    {isCenter && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-background border-2 border-background flex items-center justify-center overflow-hidden">
                        <img 
                          src={token.chainIcon} 
                          alt={token.chain} 
                          className="w-3 h-3 rounded-full object-cover" 
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Chevron Arrow */}
          {hasMultipleTokens && (
            <ChevronRight 
              className="w-4 h-4 text-muted-foreground/60 transition-all duration-200"
            />
          )}
        </div>

        {/* Pagination Dots - directly under carousel */}
        {hasMultipleTokens && (
          <div className="flex items-center gap-1.5 mt-1">
            {tokens.map((token, index) => (
              <button
                key={token.id}
                onClick={() => onTokenChange(token)}
                className={cn(
                  "w-1.5 h-1.5 rounded-full transition-all duration-200",
                  index === currentIndex 
                    ? "bg-foreground w-3" 
                    : "bg-muted-foreground/40 hover:bg-muted-foreground/60"
                )}
                aria-label={`Select ${token.symbol}`}
              />
            ))}
          </div>
        )}

        {/* Wallet indicator - minimal */}
        {hasMultipleTokens && (
          <div className="flex items-center gap-1 mt-1">
            <Wallet className="w-3 h-3 text-muted-foreground/50" />
            <span className="text-[10px] text-muted-foreground/50">
              {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'In wallet'}
            </span>
          </div>
        )}
      </div>
      
      {/* Divider */}
      <div className="w-px h-8 bg-border/50 self-center" />

      {/* Token Info with Expand Button */}
      <button 
        className="self-center text-left flex items-center gap-2 hover:bg-muted/40 rounded-lg px-2 py-1 -mx-1 transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          onExpandClick();
        }}
      >
        <div>
          <p className="font-semibold text-foreground text-sm leading-tight">{selectedToken.symbol}</p>
          <p className="text-xs text-muted-foreground leading-tight">{selectedToken.chain}</p>
        </div>
        <ChevronDown className="w-4 h-4 text-muted-foreground" />
      </button>
    </div>
  );
};

export default TokenSwipePill;
