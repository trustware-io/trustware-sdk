import React, { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface AmountInputProps {
  value: string;
  onChange: (value: string) => void;
  tokenSymbol?: string;
  tokenAmount?: number;
  className?: string;
}

const AmountInput: React.FC<AmountInputProps> = ({
  value,
  onChange,
  tokenSymbol = 'USD',
  tokenAmount,
  className,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/[^0-9.]/g, '');
    // Only allow one decimal point
    const parts = rawValue.split('.');
    const sanitized = parts.length > 2 
      ? parts[0] + '.' + parts.slice(1).join('')
      : rawValue;
    onChange(sanitized);
  };

  const displayValue = value || '0';

  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      <div className="flex items-baseline gap-1">
        <span className="text-4xl font-bold text-muted-foreground">$</span>
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={handleChange}
          className="text-5xl font-bold text-center bg-transparent border-none outline-none w-40 text-foreground"
          placeholder="0"
        />
      </div>
      {tokenAmount !== undefined && tokenSymbol && (
        <p className="text-sm text-muted-foreground">
          ≈ {tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 8 })} {tokenSymbol}
        </p>
      )}
    </div>
  );
};

export default AmountInput;
