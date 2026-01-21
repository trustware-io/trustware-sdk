import React from 'react';
import { cn } from '@/lib/utils';

interface CircularProgressProps {
  progress?: number; // 0-100
  size?: number;
  strokeWidth?: number;
  className?: string;
  showPercentage?: boolean;
  isIndeterminate?: boolean;
}

const CircularProgress: React.FC<CircularProgressProps> = ({
  progress = 0,
  size = 120,
  strokeWidth = 8,
  className,
  showPercentage = false,
  isIndeterminate = false,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg
        width={size}
        height={size}
        className={cn(isIndeterminate && 'animate-spin')}
        style={{ animationDuration: '2s' }}
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
        />
        
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={isIndeterminate ? circumference * 0.75 : offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="transition-all duration-500 ease-out"
        />
      </svg>
      
      {showPercentage && !isIndeterminate && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold text-foreground">
            {Math.round(progress)}%
          </span>
        </div>
      )}
    </div>
  );
};

export default CircularProgress;
