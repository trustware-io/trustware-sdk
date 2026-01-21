import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDeposit } from '@/contexts/DepositContext';
import { Button } from '@/components/ui/button';
import { Check, ExternalLink, X, RotateCcw } from 'lucide-react';
import CircularProgress from '@/components/deposit/CircularProgress';
import TransactionSteps from '@/components/deposit/TransactionSteps';
import SDKContainer from '@/components/deposit/SDKContainer';
import trustwareLogo from '@/assets/trustware-logo.png';

const Processing: React.FC = () => {
  const navigate = useNavigate();
  const { selectedToken, amount, transactionStatus, setTransactionStatus, transactionHash, resetState } = useDeposit();
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);

  const numericAmount = parseFloat(amount) || 0;

  // Simulate transaction processing
  useEffect(() => {
    if (transactionStatus === 'processing') {
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setTransactionStatus('success');
            return 100;
          }
          return prev + 2;
        });
      }, 100);

      // Update steps based on progress
      const stepInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 33 && currentStep === 0) setCurrentStep(1);
          if (prev >= 66 && currentStep === 1) setCurrentStep(2);
          if (prev >= 100 && currentStep === 2) setCurrentStep(3);
          return prev;
        });
      }, 100);

      return () => {
        clearInterval(interval);
        clearInterval(stepInterval);
      };
    }
  }, [transactionStatus, setTransactionStatus, currentStep]);

  const steps = [
    { label: 'Submitting transaction', status: currentStep > 0 ? 'complete' : currentStep === 0 ? 'active' : 'pending' },
    { label: 'Processing on network', status: currentStep > 1 ? 'complete' : currentStep === 1 ? 'active' : 'pending' },
    { label: 'Confirming deposit', status: currentStep > 2 ? 'complete' : currentStep === 2 ? 'active' : 'pending' },
  ] as const;

  const handleDone = () => {
    resetState();
    navigate('/');
  };

  const handleTryAgain = () => {
    setTransactionStatus('processing');
    setProgress(0);
    setCurrentStep(0);
  };

  const explorerUrl = transactionHash 
    ? `https://etherscan.io/tx/${transactionHash}`
    : '#';

  if (!selectedToken) {
    navigate('/');
    return null;
  }

  return (
    <SDKContainer>
      <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="w-10" />
        <h1 className="text-lg font-semibold text-foreground">
          {transactionStatus === 'success' ? 'Complete' : transactionStatus === 'error' ? 'Failed' : 'Processing'}
        </h1>
        <button
          onClick={handleDone}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
        >
          <X className="w-5 h-5 text-foreground" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-4">
        <div className="w-full max-w-md animate-fade-in">
          {/* Processing State */}
          {transactionStatus === 'processing' && (
            <div className="flex flex-col items-center space-y-6">
              {/* Centered Progress Circle */}
              <CircularProgress
                progress={progress}
                size={120}
                strokeWidth={8}
                showPercentage
                className="mb-2"
              />

              {/* Transaction Steps */}
              <TransactionSteps steps={steps.map(s => ({ ...s, status: s.status as 'pending' | 'active' | 'complete' }))} />

              <p className="text-sm text-muted-foreground text-center">
                Please wait while your transaction is being processed...
              </p>
            </div>
          )}

          {/* Success State */}
          {transactionStatus === 'success' && (
            <div className="flex flex-col items-center space-y-6">
              {/* Success Icon */}
              <div className="w-32 h-32 rounded-full bg-green-500 flex items-center justify-center animate-scale-in">
                <Check className="w-16 h-16 text-white" strokeWidth={3} />
              </div>

              {/* Success Message */}
              <div className="text-center space-y-2">
                <p className="text-2xl font-bold text-foreground">Deposit Complete!</p>
                <p className="text-lg text-muted-foreground">
                  ${numericAmount.toFixed(2)} {selectedToken.symbol}
                </p>
              </div>

              {/* Done Button */}
              <Button
                onClick={handleDone}
                className="w-full h-14 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium mt-4"
              >
                Done
              </Button>
            </div>
          )}

          {/* Error State */}
          {transactionStatus === 'error' && (
            <div className="flex flex-col items-center space-y-6">
              {/* Error Icon */}
              <div className="w-32 h-32 rounded-full bg-destructive flex items-center justify-center animate-scale-in">
                <X className="w-16 h-16 text-white" strokeWidth={3} />
              </div>

              {/* Error Message */}
              <div className="text-center space-y-2">
                <p className="text-2xl font-bold text-foreground">Transaction Failed</p>
                <p className="text-sm text-muted-foreground">
                  Something went wrong. Please try again.
                </p>
              </div>

              {/* Try Again Button */}
              <Button
                onClick={handleTryAgain}
                className="w-full h-14 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 flex items-center justify-center gap-2">
        <span className="text-sm text-muted-foreground">
          Secured by{' '}
          <span className="font-semibold text-black inline-flex items-center gap-1.5">
            Trustware
            <img src={trustwareLogo} alt="Trustware" className="w-3.5 h-3.5 dark:invert" />
          </span>
        </span>
      </div>
      </div>
    </SDKContainer>
  );
};

export default Processing;
