import React from 'react';
import { cn } from '@/lib/utils';

interface QuickAmountButtonsProps {
  maxAmount: number;
  onSelect: (amount: number) => void;
  selectedPercentage?: number;
  className?: string;
}

const percentages = [
  { label: '25%', value: 0.25 },
  { label: '50%', value: 0.50 },
  { label: '75%', value: 0.75 },
  { label: 'MAX', value: 1 },
];

const QuickAmountButtons: React.FC<QuickAmountButtonsProps> = ({
  maxAmount,
  onSelect,
  selectedPercentage,
  className,
}) => {
  return (
    <div className={cn('flex gap-2', className)}>
      {percentages.map(({ label, value }) => {
        const isSelected = selectedPercentage === value;
        return (
          <button
            key={label}
            onClick={() => onSelect(maxAmount * value)}
            className={cn(
              'flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all duration-200 active:scale-95',
              isSelected
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
};

export default QuickAmountButtons;
