// The global-`fetch` implementation of the HttpClient port.
//
// It fetches, follows redirects, applies the timeout with `AbortSignal.timeout`
// and hands back the bytes unread — nothing here decides what a status or a
// content type means. A network error (offline, DNS, timeout) rejects, which the
// caller turns into the message that names the URL.
//
// A size cap is checked twice: a declared `content-length` is refused before
// the body is read, and a body without one is stopped as soon as it passes the
// limit. Either way the connection is cancelled rather than drained.

import type { HttpClient, HttpGetOptions, HttpResponse } from "../../application/ports/http-client.js";

export class NodeHttpClient implements HttpClient {
  async get(url: string, options: HttpGetOptions): Promise<HttpResponse> {
    const response = await fetch(url, {
      redirect: "follow",
      headers: { "user-agent": "geek-book" },
      signal: AbortSignal.timeout(options.timeoutMs),
    });
    const body = await readBody(response, options.maxBytes);
    return {
      ok: response.ok,
      status: response.status,
      contentType: response.headers.get("content-type") ?? "",
      body,
    };
  }
}

/** The response's bytes, refusing to buffer more than `maxBytes`. */
async function readBody(response: Response, maxBytes: number | undefined): Promise<Uint8Array> {
  if (maxBytes === undefined) {
    return new Uint8Array(await response.arrayBuffer());
  }

  const length = response.headers.get("content-length");
  const declared = length === null ? Number.NaN : Number(length);
  if (Number.isFinite(declared) && declared > maxBytes) {
    if (response.body !== null) await response.body.cancel().catch(() => {});
    throw new Error(`response is ${declared} bytes; the limit is ${maxBytes}`);
  }

  if (response.body === null) {
    return new Uint8Array();
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new Error(`response is larger than ${maxBytes} bytes`);
    }
    chunks.push(value);
  }

  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}
