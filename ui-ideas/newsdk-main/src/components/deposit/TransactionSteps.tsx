import React from 'react';
import { cn } from '@/lib/utils';
import { Check, Loader2 } from 'lucide-react';

interface Step {
  label: string;
  icon?: string;
  status: 'pending' | 'active' | 'complete';
}

interface TransactionStepsProps {
  steps: Step[];
  className?: string;
}

const TransactionSteps: React.FC<TransactionStepsProps> = ({ steps, className }) => {
  return (
    <div className={cn('space-y-3', className)}>
      {steps.map((step, index) => (
        <div key={index} className="flex items-center gap-3">
          {/* Step indicator */}
          <div className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center transition-all',
            step.status === 'complete' && 'bg-green-500 text-white',
            step.status === 'active' && 'bg-primary text-primary-foreground',
            step.status === 'pending' && 'bg-muted text-muted-foreground'
          )}>
            {step.status === 'complete' ? (
              <Check className="w-4 h-4" />
            ) : step.status === 'active' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <span className="text-xs font-medium">{index + 1}</span>
            )}
          </div>

          {/* Step icon */}
          {step.icon && (
            <div className="w-6 h-6 rounded-full overflow-hidden">
              <img src={step.icon} alt="" className="w-full h-full object-contain" />
            </div>
          )}

          {/* Step label */}
          <span className={cn(
            'text-sm font-medium',
            step.status === 'pending' ? 'text-muted-foreground' : 'text-foreground'
          )}>
            {step.label}
          </span>
        </div>
      ))}
    </div>
  );
};

export default TransactionSteps;
