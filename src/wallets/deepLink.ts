// Very lightweight deep link helper. Extend as needed per wallet.
export function formatDeepLink(
  id: string,
  currentUrl: string
): string | undefined {
  const enc = encodeURIComponent(currentUrl);

  switch (id) {
    case "metamask":
      // app schema works on iOS + Android; fallback to site detection
      return `metamask://dapp/${currentUrl}`;
    case "coinbase":
      // opens Coinbase Wallet and loads the dapp
      return `coinbase://wallet/dapp?url=${enc}`;
    case "rainbow":
      return `rainbow://connect?uri=${enc}`;
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
