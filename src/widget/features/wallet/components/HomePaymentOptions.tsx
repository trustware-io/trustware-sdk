import React from "react";

import type { DetectedWallet } from "../../../../types";
import { spacing } from "../../../styles";
import { CryptoWalletDropdownContent } from "./CryptoWalletDropdownContent";
import { PaymentDropdownButton } from "./PaymentDropdownButton";
import { CryptoPaymentIcon } from "./paymentOptionIcons";
import {
  dropdownWrapperOpenStyle,
  dropdownWrapperStyle,
} from "./paymentOptionStyles";

export interface HomePaymentOptionsProps {
  browserWallets: DetectedWallet[];
  cryptoDropdownRef: React.Ref<HTMLDivElement>;
  fiatDropdownRef: React.Ref<HTMLDivElement>;
  handleFiatSelect: () => void;
  handleWalletConnect: () => Promise<void>;
  handleWalletSelect: (wallet: DetectedWallet) => Promise<void>;
  isCryptoDropdownOpen: boolean;
  isFiatDropdownOpen: boolean;
  isDarkTheme: boolean;
  setIsCryptoDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsFiatDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export function HomePaymentOptions({
  browserWallets,
  cryptoDropdownRef,
  handleWalletConnect,
  handleWalletSelect,
  isCryptoDropdownOpen,
  setIsCryptoDropdownOpen,
  setIsFiatDropdownOpen,
}: HomePaymentOptionsProps): React.ReactElement {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: spacing[3],
        alignItems: "center",
        position: "relative",
        zIndex: 10,
        minHeight: "6rem",
      }}
    >
      <div
        style={
          isCryptoDropdownOpen ? dropdownWrapperOpenStyle : dropdownWrapperStyle
        }
        ref={cryptoDropdownRef}
      >
        <PaymentDropdownButton
          icon={<CryptoPaymentIcon />}
          isOpen={isCryptoDropdownOpen}
          label="Pay with crypto"
          onClick={() => {
            setIsCryptoDropdownOpen(!isCryptoDropdownOpen);
            setIsFiatDropdownOpen(false);
          }}
        />

        {isCryptoDropdownOpen ? (
          <CryptoWalletDropdownContent
            browserWallets={browserWallets}
            handleWalletConnect={handleWalletConnect}
            handleWalletSelect={handleWalletSelect}
          />
        ) : null}
      </div>

      {/* removed only temporary */}
      {/*
      <div style={dividerRowStyle}>
        <div style={mutedOrDividerStyle(isDarkTheme)} />
        <span
          style={{
            fontSize: fontSize.xs,
            color: colors.zinc[500],
            userSelect: "none",
          }}
        >
          Or
        </span>
        <div style={mutedOrDividerStyle(isDarkTheme)} />
      </div>

      <div
        style={
          isFiatDropdownOpen ? dropdownWrapperOpenStyle : dropdownWrapperStyle
        }
        ref={fiatDropdownRef}
      >
        <PaymentDropdownButton
          icon={<FiatPaymentIcon />}
          isOpen={isFiatDropdownOpen}
          label="Pay with fiat"
          onClick={() => {
            setIsFiatDropdownOpen(!isFiatDropdownOpen);
            setIsCryptoDropdownOpen(false);
          }}
        />

        {isFiatDropdownOpen ? (
          <FiatPaymentDropdownContent
            fiatOptions={fiatOptions}
            handleFiatSelect={handleFiatSelect}
          />
        ) : null}
      </div>
      */}
    </div>
  );
}
