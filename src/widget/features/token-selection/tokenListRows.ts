/** Rows a token list shows before its "Show all" button is pressed. */
export const INITIAL_TOKEN_LIMIT = 50;

/**
 * The rows a picker list renders and how many it holds back behind its
 * "Show all" button. A large wallet lists hundreds of supported tokens on one
 * chain, and the catalog thousands.
 */
export function visibleTokenRows<Row>(
  rows: readonly Row[],
  showAll: boolean
): { visible: readonly Row[]; hidden: number } {
  if (showAll || rows.length <= INITIAL_TOKEN_LIMIT) {
    return { visible: rows, hidden: 0 };
  }
  return {
    visible: rows.slice(0, INITIAL_TOKEN_LIMIT),
    hidden: rows.length - INITIAL_TOKEN_LIMIT,
  };
}
