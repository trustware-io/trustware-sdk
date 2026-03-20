import { isAddress as isEvmAddress } from "viem";
import { isAddress as isSolanaAddress } from "@solana/addresses";

import type { ChainDef, ChainType } from "../types";
import { normalizeChainType } from "../utils/chains";

type AddressValidationResult = { isValid: boolean; error?: string };

const BECH32_CHARSET = /^[023456789acdefghjklmnpqrstuvwxyz]+$/i;

function hasMixedCase(value: string) {
  return value !== value.toLowerCase() && value !== value.toUpperCase();
}

function validateBech32LikeAddress(
  address: string,
  prefix: string
): AddressValidationResult {
  const trimmed = address.trim();
  if (!trimmed) {
    return { isValid: false, error: "Address is required." };
  }
  if (hasMixedCase(trimmed)) {
    return { isValid: false, error: "Bech32 addresses cannot mix case." };
  }

  const lower = trimmed.toLowerCase();
  const expectedPrefix = `${prefix.toLowerCase()}1`;
  if (!lower.startsWith(expectedPrefix)) {
    return {
      isValid: false,
      error: `Address must start with ${expectedPrefix}.`,
    };
  }

  const dataPart = lower.slice(expectedPrefix.length);
  if (dataPart.length < 6 || !BECH32_CHARSET.test(dataPart)) {
    return {
      isValid: false,
      error: "Bech32 address format is invalid.",
    };
  }

  return { isValid: true };
}

export function validateEvmAddress(address: string): AddressValidationResult {
  if (!isEvmAddress(address.trim())) {
    return {
      isValid: false,
      error: "EVM addresses must be 0x-prefixed 20-byte hex strings.",
    };
  }
  return { isValid: true };
}

export function validateSeiAddress(address: string): AddressValidationResult {
  const trimmed = address.trim();
  if (isEvmAddress(trimmed)) {
    return { isValid: true };
  }
  const result = validateBech32LikeAddress(trimmed, "sei");
  if (result.isValid) return result;
  return {
    isValid: false,
    error: "SEI addresses must be 0x-prefixed EVM or sei1 bech32 strings.",
  };
}

export function validateSolanaAddress(
  address: string
): AddressValidationResult {
  const trimmed = address.trim();
  if (trimmed.startsWith("0x") || isEvmAddress(trimmed)) {
    return {
      isValid: false,
      error: "Solana addresses must be base58-encoded strings.",
    };
  }
  if (
    trimmed.toLowerCase().startsWith("bc1") ||
    trimmed.toLowerCase().startsWith("sei1")
  ) {
    return {
      isValid: false,
      error: "Solana addresses cannot be bech32 strings.",
    };
  }
  if (!isSolanaAddress(trimmed)) {
    return {
      isValid: false,
      error: "Solana addresses must be base58-encoded strings.",
    };
  }
  return { isValid: true };
}

export function validateBtcAddress(address: string): AddressValidationResult {
  const trimmed = address.trim();
  if (hasMixedCase(trimmed)) {
    return { isValid: false, error: "Bitcoin addresses cannot mix case." };
  }
  const result = validateBech32LikeAddress(trimmed, "bc");
  if (result.isValid) return result;
  return {
    isValid: false,
    error: "Bitcoin addresses must use native SegWit (bc1...) format.",
  };
}

export function validateAddressForChain(
  address: string,
  chain?: ChainDef | ChainType | string | null
): AddressValidationResult {
  const trimmed = address.trim();
  if (!trimmed) return { isValid: true };
  const chainType = normalizeChainType(chain);
  const chainDef = typeof chain === "object" && chain ? chain : undefined;

  switch (chainType) {
    case "evm":
      return validateEvmAddress(trimmed);
    case "solana":
      return validateSolanaAddress(trimmed);
    case "bitcoin":
      return validateBtcAddress(trimmed);
    case "cosmos":
      if (chainDef?.networkIdentifier?.toLowerCase() === "sei") {
        return validateSeiAddress(trimmed);
      }
      return validateBech32LikeAddress(trimmed, "sei");
    default:
      return { isValid: false, error: "Unsupported or unknown chain type." };
  }
}

function validateAddressForRouteChain(address: string, chainType: ChainType) {
  switch (normalizeChainType(chainType)) {
    case "evm":
      return validateEvmAddress(address);
    case "solana":
      return validateSolanaAddress(address);
    case "bitcoin":
      return validateBtcAddress(address);
    case "cosmos":
      return validateSeiAddress(address);
    default:
      return { isValid: false, error: "Unsupported chain type." };
  }
}

export function validateRouteAddresses(params: {
  fromChain?: ChainDef | ChainType | string | null;
  toChain?: ChainDef | ChainType | string | null;
  fromAddress: string;
  toAddress: string;
  refundAddress?: string;
  direction?: string;
}): AddressValidationResult {
  const fromType = normalizeChainType(params.fromChain);
  const toType = normalizeChainType(params.toChain);

  if (!fromType || !toType) {
    return {
      isValid: false,
      error: "Missing chain types for route validation.",
    };
  }

  const fromAddress = params.fromAddress.trim();
  const toAddress = params.toAddress.trim();
  if (!fromAddress || !toAddress) {
    return { isValid: false, error: "Route addresses are required." };
  }

  const normalizedDirection = params.direction?.trim().toLowerCase();
  const isDepositFlow =
    normalizedDirection === "deposit" ||
    ((toType === "evm" || toType === "cosmos") &&
      (fromType === "bitcoin" || fromType === "solana"));

  if (isDepositFlow) {
    const fromResult = validateAddressForRouteChain(fromAddress, fromType);
    if (!fromResult.isValid) {
      return {
        isValid: false,
        error: `From address: ${fromResult.error ?? "Invalid address."}`,
      };
    }
    const toResult =
      toType === "cosmos"
        ? validateSeiAddress(toAddress)
        : validateEvmAddress(toAddress);
    if (!toResult.isValid) {
      return {
        isValid: false,
        error: `To address: ${toResult.error ?? "Invalid address."}`,
      };
    }
    if (fromType === "bitcoin") {
      const refundAddress = params.refundAddress?.trim();
      if (!refundAddress) {
        return {
          isValid: false,
          error: "Refund address is required for BTC deposit routes.",
        };
      }
      const refundResult = validateBtcAddress(refundAddress);
      if (!refundResult.isValid) {
        return {
          isValid: false,
          error: `Refund address: ${refundResult.error ?? "Invalid address."}`,
        };
      }
    }
    return { isValid: true };
  }

  const fromResult = validateAddressForRouteChain(fromAddress, fromType);
  if (!fromResult.isValid) {
    return {
      isValid: false,
      error: `From address: ${fromResult.error ?? "Invalid address."}`,
    };
  }

  const toResult = validateAddressForRouteChain(toAddress, toType);
  if (!toResult.isValid) {
    return {
      isValid: false,
      error: `To address: ${toResult.error ?? "Invalid address."}`,
    };
  }

  return { isValid: true };
}
