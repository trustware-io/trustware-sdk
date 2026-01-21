import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDeposit, Wallet } from '@/contexts/DepositContext';
import { Lock, Wallet as WalletIcon, CreditCard, ChevronDown, ChevronUp } from 'lucide-react';
import SDKContainer from '@/components/deposit/SDKContainer';
import trustwareLogo from '@/assets/trustware-logo.png';
import metamaskLogo from '@/assets/metamask-logo.png';
import rainbowWalletIcon from '@/assets/rainbow-wallet-icon.png';
import applePayIcon from '@/assets/apple-pay-icon.svg';
import mpesaIcon from '@/assets/mpesa-icon.png';
import alipayIcon from '@/assets/alipay-icon.png';
import zelleIcon from '@/assets/zelle-icon.svg';
import mercadopagoIcon from '@/assets/mercadopago-icon.png';
import venmoIcon from '@/assets/venmo-icon.svg';

const detectedWallets = [
  { id: 'metamask', name: 'MetaMask', icon: metamaskLogo },
  { id: 'rainbow', name: 'Rainbow Wallet', icon: rainbowWalletIcon },
];

const paymentMethods = [
  { id: 'applepay', name: 'Apple Pay', icon: applePayIcon },
  { id: 'mpesa', name: 'M-Pesa', icon: mpesaIcon },
  { id: 'alipay', name: 'Alipay', icon: alipayIcon },
  { id: 'zelle', name: 'Zelle', icon: zelleIcon },
  { id: 'mercadopago', name: 'Mercado Pago', icon: mercadopagoIcon },
  { id: 'venmo', name: 'Venmo', icon: venmoIcon },
];

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { selectedWallet, setSelectedWallet, setSelectedPaymentMethod, amount, setAmount, setNetworkFees } = useDeposit();
  
  const [sliderValue, setSliderValue] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [isCryptoDropdownOpen, setIsCryptoDropdownOpen] = useState(false);
  const [isCardDropdownOpen, setIsCardDropdownOpen] = useState(false);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [isPopularWalletsOpen, setIsPopularWalletsOpen] = useState(false);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const cryptoDropdownRef = useRef<HTMLDivElement>(null);
  const cardDropdownRef = useRef<HTMLDivElement>(null);

  // Sync slider with amount
  useEffect(() => {
    const numAmount = parseFloat(amount) || 0;
    setSliderValue(numAmount);
  }, [amount]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (cryptoDropdownRef.current && !cryptoDropdownRef.current.contains(event.target as Node)) {
        setIsCryptoDropdownOpen(false);
      }
      if (cardDropdownRef.current && !cardDropdownRef.current.contains(event.target as Node)) {
        setIsCardDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSliderChange = (value: number) => {
    setSliderValue(value);
    setAmount(value.toString());
    setNetworkFees({
      networkFee: value * 0.01,
      totalFee: value * 0.01,
      estimatedReceive: value * 0.99,
    });
  };

  const handleWalletSelect = (walletId: string) => {
    setSelectedWalletId(walletId);
    const wallet = detectedWallets.find(w => w.id === walletId);
    if (wallet) {
      const mockWallet: Wallet = {
        id: wallet.id,
        name: wallet.name,
        icon: wallet.icon,
        status: 'connected',
        address: '0x1234...5678'
      };
      setSelectedWallet(mockWallet);
      setIsCryptoDropdownOpen(false);
      navigate('/cryptopay');
    }
  };

  const handlePaymentSelect = (paymentId: string) => {
    setSelectedPaymentId(paymentId);
    const method = paymentMethods.find(m => m.id === paymentId);
    if (method) {
      setSelectedPaymentMethod({ id: method.id, name: method.name, icon: method.icon });
    }
    setIsCardDropdownOpen(false);
    navigate('/fiatpayment');
  };

  // If wallet is already connected, redirect to cryptopay
  useEffect(() => {
    if (selectedWallet?.status === 'connected') {
      navigate('/cryptopay');
    }
  }, [selectedWallet, navigate]);

  const parsedAmount = parseFloat(amount);
  const numericAmount = Number.isFinite(parsedAmount) ? parsedAmount : sliderValue;

  return (
    <SDKContainer>
      <div className="flex flex-col min-h-[600px]">
        {/* Header */}
        <div className="flex items-center justify-center px-4 py-4 border-b border-border">
          <h1 className="text-lg font-semibold text-foreground">Deposit</h1>
        </div>

        {/* Content */}
        <div className="flex-1 px-6 overflow-y-auto scrollbar-none flex flex-col items-center justify-center">
          {/* Enter Amount Label */}
          <p className="text-base text-muted-foreground mb-4">Enter an amount</p>
          
          {/* Large Amount Display */}
          <div className="text-center relative mb-8">
            <span 
              className="text-6xl font-bold tracking-tight cursor-pointer"
              onClick={() => {
                const isZeroish = !amount || parseFloat(amount) === 0;
                setIsEditing(true);
                if (isZeroish) setAmount('');

                setTimeout(() => {
                  const input = amountInputRef.current;
                  if (!input) return;
                  input.focus();
                  input.setSelectionRange(0, 0);
                }, 0);
              }}
            >
              <span className="text-foreground">$</span>
              <span className="relative inline-block min-w-[1ch]">
                <span className={numericAmount > 0 ? "text-foreground" : "text-muted-foreground/40"}>
                  {isEditing
                    ? (amount || '0')
                    : numericAmount > 0 
                      ? numericAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) 
                      : '0'}
                </span>
                {!isEditing && numericAmount === 0 && (
                  <span className="text-muted-foreground/40">.00</span>
                )}
                <input
                  ref={amountInputRef}
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9.]/g, '');
                    const parts = raw.split('.');
                    const sanitized = parts.length > 2 
                      ? parts[0] + '.' + parts.slice(1).join('')
                      : raw;
                    
                    setAmount(sanitized);
                    handleSliderChange(parseFloat(sanitized) || 0);
                    
                    if (sanitized === '') {
                      setTimeout(() => {
                        const input = amountInputRef.current;
                        if (input) input.setSelectionRange(0, 0);
                      }, 0);
                    }
                  }}
                  onBlur={() => setIsEditing(false)}
                  className="absolute inset-0 w-full bg-transparent border-none outline-none p-0 m-0 text-center text-transparent caret-muted-foreground text-6xl font-bold tracking-tight"
                  style={{ caretColor: 'hsl(var(--muted-foreground) / 0.5)' }}
                />
              </span>
            </span>
          </div>
          
          {/* Payment Options - Centered Pills */}
          <div className="flex flex-col gap-4 items-center">
            {/* Pay with Crypto Dropdown */}
            <div className="relative" ref={cryptoDropdownRef}>
              <button
                onClick={() => {
                  setIsCryptoDropdownOpen(!isCryptoDropdownOpen);
                  setIsCardDropdownOpen(false);
                }}
                className="inline-flex items-center gap-3 px-6 py-3 rounded-full transition-all bg-muted/50 hover:bg-muted w-56"
              >
                <WalletIcon className="w-5 h-5 text-muted-foreground" />
                <span className="font-medium text-sm text-foreground flex-1 text-left">Pay with crypto</span>
                {isCryptoDropdownOpen ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
              
              {/* Crypto Dropdown Menu */}
              {isCryptoDropdownOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 bg-card rounded-xl shadow-lg border border-border/50 z-50 overflow-hidden">
                  {/* Detected Wallets Section */}
                  <div className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      <span className="text-xs font-medium text-primary">Detected Wallets</span>
                    </div>
                    
                    <div className="space-y-1">
                      {detectedWallets.map((wallet) => (
                        <button
                          key={wallet.id}
                          onClick={() => handleWalletSelect(wallet.id)}
                          className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <img 
                              src={wallet.icon} 
                              alt={wallet.name} 
                              className="w-8 h-8 rounded-lg object-cover"
                            />
                            <span className="font-medium text-sm text-foreground">{wallet.name}</span>
                          </div>
                          <div className={`w-4 h-4 rounded-full border-2 ${selectedWalletId === wallet.id ? 'border-primary bg-primary' : 'border-muted-foreground/30'}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Divider */}
                  <div className="border-t border-border/50" />
                  
                  {/* Popular Wallets Section */}
                  <button
                    onClick={() => setIsPopularWalletsOpen(!isPopularWalletsOpen)}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/30 transition-colors"
                  >
                    <span className="text-xs font-medium text-muted-foreground">Popular Wallets</span>
                    <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${isPopularWalletsOpen ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              )}
            </div>
            
            {/* Pay with Fiat Dropdown */}
            <div className="relative" ref={cardDropdownRef}>
              <button
                onClick={() => {
                  setIsCardDropdownOpen(!isCardDropdownOpen);
                  setIsCryptoDropdownOpen(false);
                }}
                className="inline-flex items-center gap-3 px-6 py-3 rounded-full transition-all bg-muted/50 hover:bg-muted w-56"
              >
                <CreditCard className="w-5 h-5 text-muted-foreground" />
                <span className="font-medium text-sm text-foreground flex-1 text-left">Pay with fiat</span>
                {isCardDropdownOpen ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
              
              {/* Card Dropdown Menu */}
              {isCardDropdownOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 bg-card rounded-xl shadow-lg border border-border/50 z-50 overflow-hidden">
                  {/* Payment Methods Section */}
                  <div className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <span className="text-xs font-medium text-primary">Payment Methods</span>
                    </div>
                    
                    <div className="space-y-1">
                      {paymentMethods.map((method) => (
                        <button
                          key={method.id}
                          onClick={() => handlePaymentSelect(method.id)}
                          className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <img 
                              src={method.icon} 
                              alt={method.name} 
                              className="w-8 h-5 object-contain"
                            />
                            <span className="font-medium text-sm text-foreground">{method.name}</span>
                          </div>
                          <div className={`w-4 h-4 rounded-full border-2 ${selectedPaymentId === method.id ? 'border-primary bg-primary' : 'border-muted-foreground/30'}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/30 flex items-center justify-center gap-2">
          <Lock className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Secured by{' '}
            <span className="font-semibold text-foreground inline-flex items-center gap-1">
              Trustware
              <img src={trustwareLogo} alt="Trustware" className="w-3.5 h-3.5 dark:invert" />
            </span>
          </span>
        </div>
      </div>
    </SDKContainer>
  );
};

export default Home;
