import type { ChainDef, ChainType } from "./blockchain";

export type WalletAddressSource = "provider" | "manual" | "imported";

export type WalletIdentityAddress = {
  address: string;
  chainType: ChainType;
  chainKey?: string;
  chainId?: string;
  providerId?: string;
  source: WalletAddressSource;
};

export type WalletIdentity = {
  addresses: WalletIdentityAddress[];
};

export type WalletAddressResolution =
  | {
      status: "resolved";
      address: string;
      source: WalletAddressSource;
      chainType: ChainType;
      chainKey?: string;
      chainId?: string;
    }
  | {
      status: "missing" | "invalid";
      reason: string;
      address?: string;
      source?: WalletAddressSource;
      chainType?: ChainType;
      chainKey?: string;
      chainId?: string;
    };

export type WalletIdentityChainLike = ChainDef | ChainType | string | null;
