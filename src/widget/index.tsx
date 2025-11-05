import { useState, useEffect } from 'react';
import type { ChainDef, TokenDef, TrustwareWidgetMessages, TrustwareWidgetTheme } from 'src/types/';
import { useTrustware } from 'src/provider';
import { TrustwareConfig } from 'src/config';
import { WalletSelection } from './walletSelection';
import { TokenChainSelection } from './tokenChainSelection';

enum WidgetState {
  WalletSelection,
  TokenChainSelection,
  AmountInput,
  ConfirmPayment,
  PaymentProcessing,
  PaymentSuccess,
  PaymentFailure
}

export function TrustwareWidget() {
  const { status, errors } = useTrustware();
  const [theme, setTheme] = useState<TrustwareWidgetTheme | null>(null);
  const [messages, setMessages] = useState<TrustwareWidgetMessages | null>(null);
  console.log("Status:", status, "Errors:", errors);
  const [widgetState, setWidgetState] = useState<WidgetState>(WidgetState.WalletSelection);
  const [selectedChain, setSelectedChain] = useState<ChainDef | null>(null);
  const [selectedToken, setSelectedToken] = useState<TokenDef | null>(null);
  const [amount, setAmount] = useState<number | null>(null);

  useEffect(() => {
    const unsubscribe = TrustwareConfig.subscribe((cfg) => {
      setTheme(cfg.theme);
      setMessages(cfg.messages);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleBack = () => {
    // Logic to handle back navigation based on current widget state
    // switch
  };

  const handleNext = () => {
    // Logic to handle next navigation based on current widget state
    // switch
  };

  const renderStatus = () => {
    if (status === 'error') {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            textAlign: 'center',
            color: '#d32f2f',
          }}
        >
          <div style={{ fontWeight: 600 }}>We hit a snag.</div>
          <div style={{ fontSize: '0.9rem' }}>{errors ?? 'Please try again later.'}</div>
        </div>
      );
    }

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          textAlign: 'center',
          color: '#666',
        }}
      >
        <div style={{ fontSize: '1.2rem' }}>⏳</div>
        <div style={{ fontSize: '0.9rem' }}>
          {status === 'idle' && 'Setting things up…'}
          {status === 'initializing' && 'Connecting to your wallet…'}
        </div>
      </div>
    );
  };


  if (!theme || !messages) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          textAlign: 'center',
          color: '#666',
        }}
      >
        <div style={{ fontSize: '1.2rem' }}>⏳</div>
        <div style={{ fontSize: '0.9rem' }}>
          Loading Trustware configuration…
        </div>
      </div>
    );
  }

  if (status === 'error' || !theme || !messages || status === 'idle' || status === 'initializing') {
    return <>{renderStatus()}</>;
  }

  return (
    <div
      style={{
        backgroundColor: theme?.backgroundColor,
        border: `1px solid ${theme?.borderColor}`,
        borderRadius: `${theme?.radius}px`,
        padding: '16px',
        width: '100%',
        fontFamily: 'Arial, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '16px',
      }}
    >
      <div
        style={{
          borderBottom: `1px solid ${theme?.borderColor}`,
          paddingBottom: '8px',
          width: '100%',
          textAlign: 'center',
          color: theme?.textColor,
        }}
      >
        <h2 style={{ fontSize: '1.5rem', margin: 0 }}>
          {messages?.title || 'Trustware Payment Widget'}
        </h2>
      </div>
      {widgetState === WidgetState.WalletSelection && (
        <WalletSelection onBack={handleBack} onNext={handleNext} />
      )}
      
      {widgetState === WidgetState.TokenChainSelection && (
        <TokenChainSelection
          onBack={handleBack}
          onNext={handleNext}
          onChainSelected={(chain) => setSelectedChain(chain)}
          onTokenSelected={(token) => setSelectedToken(token)}
        />
      )}

      <div>
        powered by Trustware
      </div>
    </div>
  )
}
