import {
  BuildRouteResult,
  RouteParams,
  Transaction,
  SDKConfig,
  WalletInterFaceAPI,
  InternalUIConfig,
  DefaultMessages,
} from "./types";
import { API_PREFIX, API_ROOT, SDK_NAME, SDK_VERSION } from "./constants";

const DEFAULT_MESSAGES: DefaultMessages = {
  title: "Top up",
  amountPlaceholder: "Amount (wei)",
  ctaIdle: "Swap & Bridge",
  ctaBusy: "Processing…",
  statusLabel: "Status",
  errorPrefix: "Error",
};

export class TrustwareCore {
  // readonly view of config (used by widget)
  public cfg!: SDKConfig & { ui?: InternalUIConfig };
  public messages: DefaultMessages = DEFAULT_MESSAGES;

  private wallet?: WalletInterFaceAPI;

  // ---------------- lifecycle ----------------
  init(
    cfg: SDKConfig & {
      ui?: InternalUIConfig;
      messages?: Partial<DefaultMessages>;
    },
  ) {
    if (!cfg?.apiKey) throw new Error("Trustware.init: apiKey is required");
    this.cfg = {
      defaultSlippage: 1,
      defaults: {},
      ...cfg,
      ui: cfg.ui ?? {},
    };
    if (cfg.messages) {
      this.messages = { ...DEFAULT_MESSAGES, ...cfg.messages };
    }
    return this;
  }

  useWallet(w: WalletInterFaceAPI) {
    this.wallet = w;
    return this;
  }

  /** optional: attempt auto-detection (EIP-6963 → window.ethereum) */
  async autoDetect(timeoutMs = 400): Promise<boolean> {
    if (typeof window === "undefined") return false;
    try {
      const { autoDetectWallet } = await import("./wallet");
      const found = await autoDetectWallet(timeoutMs);
      if (found?.wallet) {
        this.useWallet(found.wallet);
        return true;
      }
    } catch {}
    return false;
  }

  // ---------------- REST calls ----------------

  // @title Build Route
  // @description Builds a cross-chain or same-chain route based on the provided parameters. Returns a RouteIntent object containing details of the route.
  // @param {RouteParams} p - The parameters for building the route.
  // @param RouteParams.fromChain - The source chain identifier (e.g., "ethereum", "bsc").
  // @param RouteParams.toChain - The destination chain identifier (e.g., "polygon", "avalanche").
  // @param RouteParams.fromToken - The token address or symbol on the source chain.
  // @param RouteParams.toToken - The token address or symbol on the destination chain.
  // @param RouteParams.fromAmount - The amount of the source token to be transferred (in smallest unit, e.g., wei).
  // @param RouteParams.fromAddress - The address on the source chain from which the tokens will be sent.
  // @param RouteParams.toAddress - The address on the destination chain to which the tokens will be sent.
  // @param RouteParams.slippage - (Optional) The maximum acceptable slippage percentage for the swap (default is 0.5%).
  // @returns {Promise<RouteIntent>} - A promise that resolves to a RouteIntent object.
  // @throws {Error} - Throws an error if the API request fails or if the response is invalid.
  // @example
  // const routeParams = {
  //   fromChain: 'ethereum',
  //   toChain: 'polygon',
  //   fromToken: 'ETH',
  //   toToken: 'MATIC',
  //   fromAmount: '1000000000000000000', // 1 ETH in wei
  //   fromAddress: '0xYourSourceAddress',
  //   toAddress: '0xYourDestinationAddress',
  //   slippage: 0.5, // Optional
  //   };
  async buildRoute(p: RouteParams): Promise<BuildRouteResult> {
    const r = await fetch(`${API_ROOT}${API_PREFIX}/squid/route`, {
      method: "POST",
      headers: this.jsonHeaders(),
      body: JSON.stringify(p),
    });
    await this.assertOK(r);
    const j = await r.json();
    return j.data as BuildRouteResult;
  }

  // @title Submit Receipt
  // @description Submits the transaction hash of the source chain transaction to initiate monitoring and processing of the cross-chain transfer. Updates the status of the associated RouteIntent.
  // @param {string} intentId - The unique identifier of the RouteIntent associated with the transaction.
  // @param {string} txHash - The transaction hash of the source chain transaction.
  // @returns {Promise<void>} - A promise that resolves when the receipt is successfully submitted.
  // @throws {Error} - Throws an error if the API request fails or if the response is invalid.
  async submitReceipt(intentId: string, txHash: string) {
    const r = await fetch(
      `${API_ROOT}${API_PREFIX}/route-intent/${intentId}/receipt`,
      {
        method: "POST",
        headers: this.jsonHeaders({ "Idempotency-Key": txHash }),
        body: JSON.stringify({ txHash }),
      },
    );
    await this.assertOK(r);
    const j = await r.json();
    return j.data;
  }

  // @title Get Status
  // @description Retrieves the current status of a RouteIntent based on its unique identifier. Returns a Transaction object containing details of the transaction status.
  // @param {string} intentId - The unique identifier of the RouteIntent whose status is to be retrieved.
  // @returns {Promise<Transaction>} - A promise that resolves to a Transaction object containing the status and details of the transaction.
  // @throws {Error} - Throws an error if the API request fails or if the response is invalid.
  // @example
  // const intentId = 'your-route-intent-id';
  // const transactionStatus = await trustware.getStatus(intentId);
  // console.log(transactionStatus);
  async getStatus(intentId: string): Promise<Transaction> {
    const r = await fetch(
      `${API_ROOT}${API_PREFIX}/route-intent/${intentId}/status`,
      {
        headers: this.jsonHeaders(),
      },
    );
    await this.assertOK(r);
    const j = await r.json();
    return j.data as Transaction;
  }

    /// polls the status of the route intent until it reaches a terminal state (success or failed).
  // @title Poll Route Status
  // @description Polls the status of the specified RouteIntent until it reaches a terminal state (either "success" or "failed"). This function continuously checks the status at regular intervals and returns the final status once the route processing is complete.
  // @param {string} intentId - The unique identifier of the RouteIntent to be polled.
  // @returns {Promise<RouteIntent>} - A promise that resolves to the updated RouteIntent object once it reaches a terminal state.
  // @throws {Error} - Throws an error if the API request fails or if the response is invalid.
  async pollStatus(
    intentId: string,
    { intervalMs = 2000, timeoutMs = 5 * 60_000 } = {},
  ): Promise<Transaction> {
    const t0 = Date.now();
    while (true) {
      const tx = await this.getStatus(intentId);
      if (tx.status === "success" || tx.status === "failed") return tx;
      if (Date.now() - t0 > timeoutMs) return tx;
      await sleep(intervalMs);
    }
  }

  // ---------------- send with partner wallet ----------------
  async sendRouteTransaction(b: BuildRouteResult): Promise<`0x${string}`> {
    if (!this.wallet) throw new Error("Trustware.wallet not configured");
    const tr = b.route.transactionRequest;
    const to = tr.to as `0x${string}`;
    const data = tr.data as `0x${string}`;
    const value = tr.value ? BigInt(tr.value) : 0n;

    if (tr.chainId) {
      const target = Number(tr.chainId);
      const current = await this.wallet.getChainId();
      if (Number.isFinite(target) && target !== current) {
        await this.wallet.switchChain(target);
      }
    }

    if (this.wallet.type === "eip1193") {
      const from = await this.wallet.getAddress();
      const hexValue = value ? `0x${value.toString(16)}` : "0x0";
      const params: any = { from, to, data, value: hexValue };
      if (tr.chainId) params.chainId = `0x${Number(tr.chainId).toString(16)}`;
      const hash = await this.wallet.request({
        method: "eth_sendTransaction",
        params: [params],
      });
      return hash as `0x${string}`;
    } else {
      const resp = await this.wallet.sendTransaction({
        to,
        data,
        value,
        chainId: tr.chainId ? Number(tr.chainId) : undefined,
      });
      return resp.hash as `0x${string}`;
    }
  }

  // ---------------- one-shot flow ----------------
  async runTopUp(params: {
    fromChain?: string; // will fall back to wallet chain
    toChain?: string;
    fromToken?: string;
    toToken?: string;
    fromAmount: string | number;
  }) {
    if (!this.wallet) throw new Error("Trustware.wallet not configured");
    const fromAddress = await this.wallet.getAddress();
    const chainId = await this.wallet.getChainId();

    const build = await this.buildRoute({
      fromChain: params.fromChain ?? String(chainId),
      toChain: params.toChain ?? (this.cfg.defaults?.toChain as string),
      fromToken: params.fromToken ?? (this.cfg.defaults?.fromToken as string),
      toToken: params.toToken ?? (this.cfg.defaults?.toToken as string),
      fromAmount: String(params.fromAmount),
      fromAddress,
      toAddress: fromAddress,
      slippage: this.cfg.defaultSlippage ?? 1,
    });

    const hash = await this.sendRouteTransaction(build);
    await this.submitReceipt(build.intentId, hash);
    return this.pollStatus(build.intentId);
  }

  // ---------------- utils ----------------
  private jsonHeaders(extra?: Record<string, string>): HeadersInit {
    const h: Record<string, string> = {
      "Content-Type": "application/json",
      "X-API-Key": this.cfg.apiKey,
      "X-SDK-Name": SDK_NAME,
      "X-SDK-Version": SDK_VERSION,
      "X-API-Version": "2025-10-01",
    };
    return { ...h, ...(extra || {}) };
  }
  private async assertOK(r: Response) {
    if (r.ok) return;
    let msg = r.statusText;
    try {
      const j = await r.json();
      if (j?.error) msg = j.error;
    } catch {}
    throw new Error(`HTTP ${r.status}: ${msg}`);
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export const Trustware = new TrustwareCore();
