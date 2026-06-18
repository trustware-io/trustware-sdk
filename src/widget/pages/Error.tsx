import React, { useMemo } from "react";
import {
  useDepositForm,
  useDepositNavigation,
  useDepositTransaction,
} from "../context/DepositContext";
import { ErrorPage } from "../components";
import { mapError } from "../lib/mapError";

export interface ErrorProps {
  style?: React.CSSProperties;
}

export function Error({ style: _style }: ErrorProps): React.ReactElement {
  const { selectedChain } = useDepositForm();
  const { setCurrentStep, resetState } = useDepositNavigation();
  const {
    errorMessage,
    setTransactionStatus,
    setErrorMessage,
    transactionHash,
  } = useDepositTransaction();

  const mapped = useMemo(() => mapError(errorMessage), [errorMessage]);

  const explorerUrl = useMemo(() => {
    if (transactionHash && selectedChain?.blockExplorerUrls?.length) {
      return `${selectedChain.blockExplorerUrls[0].replace(/\/+$/, "")}/tx/${transactionHash}`;
    }
    return null;
  }, [transactionHash, selectedChain]);

  const handleTryAgain = () => {
    setErrorMessage(null);
    setTransactionStatus("idle");
    const step =
      mapped.category === "wallet_rejected" ||
      mapped.category === "network_error"
        ? "crypto-pay"
        : mapped.category === "no_route" || mapped.category === "route_error"
          ? "select-token"
          : "home";
    setCurrentStep(step);
  };

  return (
    <ErrorPage
      error={mapped}
      onTryAgain={handleTryAgain}
      onStartOver={resetState}
      txHash={transactionHash}
      explorerUrl={explorerUrl}
    />
  );
}

export default Error;
