import React from 'react';
import { cn } from '@/lib/utils';
import type { NetworkFees } from '@/contexts/DepositContext';

interface FeeBreakdownProps {
  fees: NetworkFees;
  className?: string;
}

const FeeBreakdown: React.FC<FeeBreakdownProps> = ({ fees, className }) => {
  return (
    <div className={cn('space-y-2 p-4 rounded-xl bg-muted/50', className)}>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Network fee</span>
        <span className="font-medium text-foreground">
          ${fees.networkFee.toFixed(2)}
        </span>
      </div>
      
      {fees.bridgeFee !== undefined && fees.bridgeFee > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Bridge fee</span>
          <span className="font-medium text-foreground">
            ${fees.bridgeFee.toFixed(2)}
          </span>
        </div>
      )}
      
      <div className="h-px bg-border my-2" />
      
      <div className="flex justify-between">
        <span className="text-muted-foreground text-sm">You'll receive</span>
        <span className="font-semibold text-foreground">
          ~${fees.estimatedReceive.toFixed(2)}
        </span>
      </div>
    </div>
  );
};

export default FeeBreakdown;
