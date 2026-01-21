import React, { useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { ChevronRight, Check } from 'lucide-react';

interface SwipeToConfirmProps {
  label: string;
  onComplete: () => void;
  variant?: 'default' | 'primary';
  disabled?: boolean;
  className?: string;
}

const SwipeToConfirm: React.FC<SwipeToConfirmProps> = ({
  label,
  onComplete,
  variant = 'default',
  disabled = false,
  className,
}) => {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbWidth = 56;
  const threshold = 0.8;

  const getMaxDrag = useCallback(() => {
    if (!trackRef.current) return 0;
    return trackRef.current.offsetWidth - thumbWidth - 8;
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
    const newX = clientX - rect.left - thumbWidth / 2 - 4;
    const maxDrag = getMaxDrag();
    const clampedX = Math.max(0, Math.min(newX, maxDrag));
    
    setDragX(clampedX);
  }, [isDragging, isComplete, getMaxDrag]);

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    const progress = getProgress();
    
    if (progress >= threshold) {
      setIsComplete(true);
      setDragX(getMaxDrag());
      
      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      
      setTimeout(() => {
        onComplete();
      }, 300);
    } else {
      // Spring back
      setDragX(0);
    }
  }, [isDragging, getProgress, getMaxDrag, onComplete]);

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
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
  React.useEffect(() => {
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
  const trackBgColor = isComplete 
    ? 'bg-green-500' 
    : progress > 0.5 
      ? 'bg-green-400/30' 
      : variant === 'primary' 
        ? 'bg-primary/10' 
        : 'bg-muted';

  return (
    <div
      ref={trackRef}
      className={cn(
        'relative h-14 rounded-full overflow-hidden transition-colors duration-300 select-none',
        trackBgColor,
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {/* Progress fill */}
      <div
        className={cn(
          'absolute inset-y-0 left-0 transition-all duration-75',
          isComplete ? 'bg-green-500' : 'bg-green-400/20'
        )}
        style={{ width: `${(dragX + thumbWidth + 8)}px` }}
      />

      {/* Label */}
      <div className={cn(
        'absolute inset-0 flex items-center justify-center transition-opacity duration-200',
        (progress > 0.3 || isComplete) && 'opacity-0'
      )}>
        <span className="text-sm font-medium text-muted-foreground">
          {label}
        </span>
      </div>

      {/* Thumb */}
      <div
        className={cn(
          'absolute top-1 bottom-1 w-12 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing transition-all',
          isComplete 
            ? 'bg-green-500 text-white' 
            : variant === 'primary'
              ? 'bg-primary text-primary-foreground'
              : 'bg-card text-foreground shadow-md',
          isDragging && 'scale-105'
        )}
        style={{ 
          left: `${dragX + 4}px`,
          transition: isDragging ? 'none' : 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.15s'
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {isComplete ? (
          <Check className="w-5 h-5" />
        ) : (
          <ChevronRight className="w-5 h-5" />
        )}
      </div>
    </div>
  );
};

export default SwipeToConfirm;
