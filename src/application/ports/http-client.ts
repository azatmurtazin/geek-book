// The HttpClient port: the one way the engine reaches the network.
//
// A response carries its status, its content type and its bytes; deciding what
// a 404 means, and which content types are pictures, is the caller's business
// (see `adapters/http/remote-images.ts`). The adapter
// (`adapters/http/node-http-client.ts`) wraps the global `fetch`; a test hands
// in a canned response.

/** What a caller asks of one request: a time budget and an optional size cap. */
export interface HttpGetOptions {
  /** Give up after this many milliseconds. */
  readonly timeoutMs: number;
  /** Refuse a body larger than this many bytes; no limit when absent. */
  readonly maxBytes?: number;
}

export interface HttpClient {
  /**
   * GET `url`, giving up after `options.timeoutMs` and refusing a body larger
   * than `options.maxBytes`. Rejects on a network error or a limit.
   */
  get(url: string, options: HttpGetOptions): Promise<HttpResponse>;
}

export interface HttpResponse {
  /** True for a 2xx status. */
  readonly ok: boolean;
  readonly status: number;
  /** The response's content type, without parameters, e.g. `image/png`; "" when absent. */
  readonly contentType: string;
  readonly body: Uint8Array;
}
