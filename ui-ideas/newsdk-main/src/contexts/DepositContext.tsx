import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface Wallet {
  id: string;
  name: string;
  icon: string;
  status: 'ready' | 'connecting' | 'connected' | 'not-detected';
  address?: string;
}

export interface Token {
  id: string;
  symbol: string;
  name: string;
  chain: string;
  chainIcon: string;
  icon: string;
  balance: number;
  usdValue: number;
  decimals: number;
}

export interface NetworkFees {
  networkFee: number;
  bridgeFee?: number;
  totalFee: number;
  estimatedReceive: number;
}

export interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
}

export type TransactionStatus = 'idle' | 'confirming' | 'processing' | 'bridging' | 'success' | 'error';

interface DepositContextType {
  selectedWallet: Wallet | null;
  setSelectedWallet: (wallet: Wallet | null) => void;
  selectedToken: Token | null;
  setSelectedToken: (token: Token | null) => void;
  selectedPaymentMethod: PaymentMethod | null;
  setSelectedPaymentMethod: (method: PaymentMethod | null) => void;
  amount: string;
  setAmount: (amount: string) => void;
  networkFees: NetworkFees | null;
  setNetworkFees: (fees: NetworkFees | null) => void;
  transactionStatus: TransactionStatus;
  setTransactionStatus: (status: TransactionStatus) => void;
  transactionHash: string | null;
  setTransactionHash: (hash: string | null) => void;
  resetState: () => void;
}

const DepositContext = createContext<DepositContextType | undefined>(undefined);

export const DepositProvider = ({ children }: { children: ReactNode }) => {
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [networkFees, setNetworkFees] = useState<NetworkFees | null>(null);
  const [transactionStatus, setTransactionStatus] = useState<TransactionStatus>('idle');
  const [transactionHash, setTransactionHash] = useState<string | null>(null);

  const resetState = () => {
    setSelectedWallet(null);
    setSelectedToken(null);
    setSelectedPaymentMethod(null);
    setAmount('');
    setNetworkFees(null);
    setTransactionStatus('idle');
    setTransactionHash(null);
  };

  return (
    <DepositContext.Provider
      value={{
        selectedWallet,
        setSelectedWallet,
        selectedToken,
        setSelectedToken,
        selectedPaymentMethod,
        setSelectedPaymentMethod,
        amount,
        setAmount,
        networkFees,
        setNetworkFees,
        transactionStatus,
        setTransactionStatus,
        transactionHash,
        setTransactionHash,
        resetState,
      }}
    >
      {children}
    </DepositContext.Provider>
  );
};

export const useDeposit = () => {
  const context = useContext(DepositContext);
  if (context === undefined) {
    throw new Error('useDeposit must be used within a DepositProvider');
  }
  return context;
};
