// Very lightweight deep link helper. Extend as needed per wallet.
export function formatDeepLink(
  id: string,
  currentUrl: string
): string | undefined {
  const enc = encodeURIComponent(currentUrl);

  switch (id) {
    // EVM
    case "metamask":
      return `metamask://dapp/${currentUrl}`;
    case "coinbase":
      return `coinbase://wallet/dapp?url=${enc}`;
    case "rainbow":
      return `rainbow://connect?uri=${enc}`;
    case "trust":
      return `https://link.trustwallet.com/open_url?coin_id=60&url=${enc}`;
    case "okx":
      return `okx://wallet/dapp/url?dappUrl=${enc}`;

    // Solana
    case "phantom-solana":
      return `phantom://browse/${enc}`;
    case "solflare":
      return `solflare://ul/v1/browse/${enc}`;
    case "backpack":
      return `https://backpack.app/ul/v1/browse/${enc}?ref=${enc}`;

    // No confirmed deep link scheme
    default:
      return undefined;
  }
}

/**
 * Format a WalletConnect URI for mobile deep linking.
 * Uses the WalletConnect universal link which works across all WC-compatible wallets.
 *
 * @param wcUri - The WalletConnect URI (wc:...) from the display_uri event
 * @returns Universal link that opens wallet selector on mobile
 */
export function formatWalletConnectDeepLink(wcUri: string): string {
  // Universal link that works with any WalletConnect-compatible wallet
  return `https://walletconnect.com/wc?uri=${encodeURIComponent(wcUri)}`;
}

/**
 * Get a wallet-specific deep link for WalletConnect URI.
 * Some wallets have their own deep link schemes for WalletConnect.
 *
 * @param walletId - Wallet identifier (e.g., "metamask", "rainbow")
 * @param wcUri - The WalletConnect URI
 * @returns Wallet-specific deep link or universal link as fallback
 */
export function formatWalletConnectDeepLinkForWallet(
  walletId: string,
  wcUri: string
): string {
  const encodedUri = encodeURIComponent(wcUri);

  switch (walletId) {
    case "metamask":
      return `metamask://wc?uri=${encodedUri}`;
    case "rainbow":
      return `rainbow://wc?uri=${encodedUri}`;
    case "trust":
      return `trust://wc?uri=${encodedUri}`;
    case "coinbase":
      return `cbwallet://wc?uri=${encodedUri}`;
    default:
      // Fallback to universal link
      return formatWalletConnectDeepLink(wcUri);
  }
}
