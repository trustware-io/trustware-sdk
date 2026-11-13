import { apiBase, assertOK, jsonHeaders, rateLimitedFetch } from "./http";
import { readObject, requireString } from "./wire";

/**
 * USD prices from `GET /price/native` and `GET /price/token`. The body is
 * `{ data: { priceUsd, chainId, ... } }` with `priceUsd` a decimal string.
 * A body without it throws `ResponseShapeError`; a price that is not a
 * positive number throws a plain Error, because that is the backend saying it
 * has no price, which callers may degrade on.
 *
 * Rate limited per API key like the rest of the SDK surface, so a 429 is
 * retried by `rateLimitedFetch`.
 */
async function fetchPriceUsd(path: string, source: string): Promise<number> {
  const response = await rateLimitedFetch(`${apiBase()}${path}`, {
    headers: jsonHeaders(),
  });
  await assertOK(response);
  const body = readObject(await response.json(), source, "body");
  const data = readObject(body.data, source, "data");
  const text = requireString(data, "priceUsd", source, "data.priceUsd");
  const price = parseFloat(text);
  if (!(price > 0)) {
    throw new Error(`${source}: priceUsd is not a positive price: "${text}"`);
  }
  return price;
}

/** The chain's native asset, in USD. */
export function fetchNativePriceUsd(chainId: number | string): Promise<number> {
  return fetchPriceUsd(`/price/native?chainId=${chainId}`, "GET /price/native");
}

/** One token on a chain, in USD per full token. */
export function fetchTokenPriceUsd(
  chainId: number | string,
  address: string
): Promise<number> {
  return fetchPriceUsd(
    `/price/token?chainId=${chainId}&address=${address}`,
    "GET /price/token"
  );
}
