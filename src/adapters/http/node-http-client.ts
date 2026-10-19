// The global-`fetch` implementation of the HttpClient port.
//
// It fetches, follows redirects, applies the timeout with `AbortSignal.timeout`
// and hands back the bytes unread — nothing here decides what a status or a
// content type means. A network error (offline, DNS, timeout) rejects, which the
// caller turns into the message that names the URL.

import type { HttpClient, HttpResponse } from "../../application/ports/http-client.js";

export class NodeHttpClient implements HttpClient {
  async get(url: string, options: { timeoutMs: number }): Promise<HttpResponse> {
    const response = await fetch(url, {
      redirect: "follow",
      headers: { "user-agent": "geek-book" },
      signal: AbortSignal.timeout(options.timeoutMs),
    });
    const body = new Uint8Array(await response.arrayBuffer());
    return {
      ok: response.ok,
      status: response.status,
      contentType: response.headers.get("content-type") ?? "",
      body,
    };
  }
}
