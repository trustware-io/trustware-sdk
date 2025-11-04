// Very lightweight deep link helper. Extend as needed per wallet.
export function formatDeepLink(
  id: string,
  currentUrl: string,
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
