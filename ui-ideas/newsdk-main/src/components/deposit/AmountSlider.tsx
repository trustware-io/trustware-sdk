import React from 'react';
import { cn } from '@/lib/utils';

interface AmountSliderProps {
  value: number;
  onChange: (value: number) => void;
  max: number;
  className?: string;
}

const AmountSlider: React.FC<AmountSliderProps> = ({
  value,
  onChange,
  max,
  className,
}) => {
  // Generate smart tick marks based on max value with even spacing
  const generateTickMarks = (maxValue: number) => {
    if (maxValue <= 0) return [{ position: 100, label: '$0', value: 0 }];
    
    // Define "nice" intervals based on max value
    let interval: number;
    if (maxValue <= 20) {
      interval = 5;
    } else if (maxValue <= 50) {
      interval = 10;
    } else if (maxValue <= 100) {
      interval = 25;
    } else if (maxValue <= 250) {
      interval = 50;
    } else if (maxValue <= 500) {
      interval = 100;
    } else if (maxValue <= 1000) {
      interval = 250;
    } else {
      interval = 500;
    }
    
    // Generate tick values at each interval
    const tickValues = [];
    for (let amount = interval; amount < maxValue; amount += interval) {
      tickValues.push(amount);
    }
    
    // Calculate even spacing - divide 100% by (number of ticks + 1 for Max)
    const totalTicks = tickValues.length + 1; // +1 for Max
    const spacing = 100 / totalTicks;
    
    // Create ticks with evenly distributed positions
    const ticks = tickValues.map((amount, index) => ({
      position: spacing * (index + 1),
      label: `$${amount}`,
      value: amount,
    }));
    
    // Always add Max at the end at 100%
    ticks.push({ 
      position: 100, 
      label: `$${Math.round(maxValue)}`, 
      value: maxValue 
    });
    
    return ticks;
  };

  const tickMarks = generateTickMarks(max);

  // Snap threshold - 5% of max value for noticeable snap effect
  const snapThreshold = max * 0.05;

  // Calculate percentage - check if value matches a tick and use its position for exact alignment
  const getPercentage = () => {
    if (max <= 0) return 0;
    
    // Check if at zero
    if (value === 0) return 0;
    
    // Check if current value matches a tick mark exactly (snapped)
    for (const tick of tickMarks) {
      if (Math.abs(value - tick.value) < 0.01) {
        return tick.position;
      }
    }
    
    // Otherwise interpolate between ticks for smooth dragging
    const allPoints = [{ position: 0, value: 0 }, ...tickMarks];
    for (let i = 0; i < allPoints.length - 1; i++) {
      const lower = allPoints[i];
      const upper = allPoints[i + 1];
      if (value >= lower.value && value <= upper.value) {
        const valueRatio = (value - lower.value) / (upper.value - lower.value);
        return lower.position + valueRatio * (upper.position - lower.position);
      }
    }
    
    return Math.min((value / max) * 100, 100);
  };

  const percentage = getPercentage();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = Math.min(Math.max(Number(e.target.value), 0), max);
    
    // Check if close to any tick mark and snap to it
    for (const tick of tickMarks) {
      if (Math.abs(newValue - tick.value) <= snapThreshold) {
        newValue = tick.value;
        break;
      }
    }
    
    // Also snap to 0 if close
    if (newValue <= snapThreshold) {
      newValue = 0;
    }
    
    onChange(newValue);
  };

  return (
    <div className={cn("w-full", className)}>
      {/* Slider Track */}
      <div className="relative">
        {/* Labels */}
        <div className="flex justify-between items-center mb-2 px-1">
          <span className="text-xs text-muted-foreground font-medium">$0</span>
          <span className="text-xs text-muted-foreground font-medium">Max</span>
        </div>
        
        {/* Track Container */}
        <div className="relative h-10 flex items-center">
          {/* Background Track */}
          <div className="absolute inset-x-0 h-2 bg-muted/60 rounded-full" />
          
          {/* Active Track */}
          <div 
            className="absolute left-0 h-2 bg-emerald-500 rounded-full transition-all duration-75"
            style={{ width: `${percentage}%` }}
          />
          
          {/* Tick Marks */}
          {tickMarks.map((tick) => {
            const isActive = percentage >= tick.position;
            return (
              <div
                key={tick.position}
                className="absolute top-1/2 -translate-y-1/2"
                style={{ left: `${tick.position}%` }}
              >
                <div 
                  className={cn(
                    "w-0.5 h-2.5 rounded-full transition-colors -translate-x-1/2",
                    isActive ? "bg-emerald-500/50" : "bg-muted-foreground/20"
                  )}
                />
              </div>
            );
          })}
          
          {/* Range Input */}
          <input
            type="range"
            min={0}
            max={max}
            value={value}
            onChange={handleChange}
            className={cn(
              "absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10",
              "touch-none"
            )}
            style={{
              WebkitAppearance: 'none',
            }}
          />
          
          {/* Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full shadow-lg border-2 border-emerald-500 pointer-events-none transition-all duration-75"
            style={{ 
              left: `calc(${percentage}% - 12px)`,
            }}
          />
        </div>
        
        {/* Tick Labels */}
        <div className="relative mt-1 h-5">
          {tickMarks.map((tick) => (
            <span
              key={tick.position}
              className="absolute text-[9px] text-muted-foreground/50 font-medium -translate-x-1/2"
              style={{ left: `${tick.position}%` }}
            >
              {tick.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AmountSlider;