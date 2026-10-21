// The global-`fetch` client, driven against a local HTTP server: the status and
// content type it hands back, and the two ways a byte limit stops a body — a
// declared `content-length` before reading, and a stream that grows past it.

import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NodeHttpClient } from "../../../src/adapters/http/node-http-client.js";

let server: http.Server;
let base: string;
const client = new NodeHttpClient();

beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (req.url === "/image") {
      res.writeHead(200, { "content-type": "image/png" }).end("PNG");
    } else if (req.url === "/declared") {
      res
        .writeHead(200, { "content-type": "text/plain", "content-length": "20" })
        .end("x".repeat(20));
    } else if (req.url === "/chunked") {
      res.writeHead(200, { "content-type": "text/plain" });
      res.write("x".repeat(6));
      setTimeout(() => res.end("x".repeat(6)), 10);
    } else if (req.url === "/slow") {
      setTimeout(() => res.writeHead(200).end("late"), 200);
    } else {
      res.writeHead(404).end();
    }
  });
  base = await new Promise<string>((resolve) => {
    server.listen(0, "localhost", () => {
      const address = server.address() as AddressInfo;
      resolve(`http://localhost:${address.port}`);
    });
  });
});

afterAll(() => {
  server.closeAllConnections();
  server.close();
});

describe("NodeHttpClient", () => {
  it("returns the status, content type and bytes of a response", async () => {
    const response = await client.get(`${base}/image`, { timeoutMs: 2000 });

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
    expect(response.contentType).toBe("image/png");
    expect(new TextDecoder().decode(response.body)).toBe("PNG");
  });

  it("answers a non-2xx response rather than throwing", async () => {
    const response = await client.get(`${base}/missing`, { timeoutMs: 2000 });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(404);
  });

  it("refuses a declared content-length over the limit", async () => {
    await expect(client.get(`${base}/declared`, { timeoutMs: 2000, maxBytes: 10 })).rejects.toThrow(
      "response is 20 bytes; the limit is 10",
    );
  });

  it("stops a stream without a content-length when it passes the limit", async () => {
    await expect(client.get(`${base}/chunked`, { timeoutMs: 2000, maxBytes: 10 })).rejects.toThrow(
      "response is larger than 10 bytes",
    );
  });

  it("applies no limit when maxBytes is absent", async () => {
    const response = await client.get(`${base}/declared`, { timeoutMs: 2000 });

    expect(response.body.byteLength).toBe(20);
  });

  it("rejects when the timeout passes", async () => {
    await expect(client.get(`${base}/slow`, { timeoutMs: 20 })).rejects.toThrow();
  });
});
