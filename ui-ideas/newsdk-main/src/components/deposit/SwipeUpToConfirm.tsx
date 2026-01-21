import React, { useState, useRef, useEffect } from 'react';
import { ChevronUp, Check, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import trustwareLogo from '@/assets/trustware-logo.png';

interface SwipeUpToConfirmProps {
  amount: number;
  tokenSymbol: string;
  onComplete: () => void;
  disabled?: boolean;
  className?: string;
}

const SwipeUpToConfirm: React.FC<SwipeUpToConfirmProps> = ({
  amount,
  tokenSymbol,
  onComplete,
  disabled = false,
  className,
}) => {
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  
  const swipeThreshold = 100;
  const maxDrag = 120;
  
  const progress = Math.min(Math.abs(dragY) / swipeThreshold, 1);
  
  // Interpolate color from red to green based on progress
  const getBackgroundColor = () => {
    if (isComplete) return 'rgb(34, 197, 94)'; // green-500
    if (disabled) return 'rgb(156, 163, 175)'; // gray-400
    
    // Red: rgb(239, 68, 68) -> Green: rgb(34, 197, 94)
    const r = Math.round(239 - (239 - 34) * progress);
    const g = Math.round(68 + (197 - 68) * progress);
    const b = Math.round(68 + (94 - 68) * progress);
    
    return `rgb(${r}, ${g}, ${b})`;
  };

  const handleDragStart = (clientY: number) => {
    if (disabled || isComplete) return;
    setIsDragging(true);
    startY.current = clientY;
  };

  const handleDragMove = (clientY: number) => {
    if (!isDragging || disabled || isComplete) return;
    
    const delta = startY.current - clientY;
    const clampedDelta = Math.max(0, Math.min(delta, maxDrag));
    setDragY(clampedDelta);
  };

  const handleDragEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    
    if (Math.abs(dragY) >= swipeThreshold && !disabled) {
      setIsComplete(true);
      if (navigator.vibrate) {
        navigator.vibrate([50, 30, 50]);
      }
      setTimeout(() => {
        onComplete();
      }, 300);
    } else {
      setDragY(0);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleDragStart(e.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    handleDragStart(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    handleDragMove(e.touches[0].clientY);
  };

  const handleTouchEnd = () => {
    handleDragEnd();
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      handleDragMove(e.clientY);
    };

    const handleMouseUp = () => {
      handleDragEnd();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragY]);

  useEffect(() => {
    setIsComplete(false);
    setDragY(0);
  }, [amount, tokenSymbol]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative cursor-grab active:cursor-grabbing select-none transition-colors duration-200 safe-area-bottom",
        className
      )}
      style={{ 
        backgroundColor: getBackgroundColor(),
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Inner content that moves during drag */}
      <div 
        className="px-6 py-6 pb-10"
        style={{
          transform: `translateY(-${dragY * 0.3}px)`,
        }}
      >
        {/* Compact content */}
        <div className="flex flex-col items-center gap-2">
          {/* Chevron or Check icon */}
          <div 
            className={cn(
              "transition-transform duration-200",
              isDragging && "scale-110"
            )}
            style={{
              transform: `translateY(-${dragY * 0.5}px)`,
            }}
          >
            {isComplete ? (
              <Check className="w-6 h-6 text-white" strokeWidth={3} />
            ) : (
              <ChevronUp className="w-6 h-6 text-white/80" />
            )}
          </div>
          
          {/* Main Text */}
          <p className="text-white font-medium text-sm text-center">
            {isComplete 
              ? "Confirmed!" 
              : disabled 
                ? "Enter an amount to deposit"
                : `Swipe to deposit $${amount.toFixed(2)}`
            }
          </p>
        </div>
        
        {/* Footer - Secured by Trustware */}
        <div className="flex items-center justify-center gap-1.5 mt-3">
          <Lock className="w-3 h-3 text-white/60" />
          <span className="text-xs text-white/60">
            Secured by{' '}
            <span className="font-semibold text-white inline-flex items-center gap-1">
              Trustware
              <img src={trustwareLogo} alt="Trustware" className="w-3 h-3 invert brightness-0 invert" />
            </span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default SwipeUpToConfirm;
