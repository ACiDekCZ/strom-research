// One request over HTTP/2, answered as fetch() answers. Node's fetch speaks only
// HTTP/1.1, and some servers answer that with 426 (Upgrade Required): their
// image servers, for one. strom then asks them again the way a browser does,
// over HTTP/2 — with the same user agent, the same pace, the same cookies.

import http2 from "node:http2";
import zlib from "node:zlib";

export interface H2Init {
  method: string;
  headers: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}

/** Headers of a connection, not of a request: HTTP/2 has none of them. */
const CONNECTION_HEADERS = new Set(["connection", "keep-alive", "proxy-connection", "transfer-encoding", "upgrade", "host"]);

/** GET, POST or HEAD over HTTP/2 (https: by ALPN, http: by prior knowledge); redirects are not followed. */
export function fetchH2(url: string, init: H2Init): Promise<Response> {
  const u = new URL(url);
  return new Promise<Response>((resolve, reject) => {
    let settled = false;
    const session = http2.connect(u.origin);
    const done = (err: unknown, res?: Response) => {
      if (settled) return;
      settled = true;
      session.close();
      if (err) reject(err);
      else resolve(res!);
    };
    session.on("error", (e) => done(e));
    const headers: http2.OutgoingHttpHeaders = { ":method": init.method, ":path": u.pathname + u.search };
    for (const [k, v] of Object.entries(init.headers)) if (!CONNECTION_HEADERS.has(k.toLowerCase())) headers[k.toLowerCase()] = v;
    const req = session.request(headers);
    const abort = () => {
      req.close(http2.constants.NGHTTP2_CANCEL);
      done(init.signal?.reason ?? new Error("aborted"));
    };
    if (init.signal?.aborted) return abort();
    init.signal?.addEventListener("abort", abort, { once: true });
    let head: http2.IncomingHttpHeaders = {};
    const chunks: Buffer[] = [];
    req.on("response", (h) => (head = h));
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("error", (e) => done(e));
    req.on("end", () => {
      init.signal?.removeEventListener("abort", abort);
      try {
        const status = Number(head[":status"]);
        const out = new Headers();
        for (const [k, v] of Object.entries(head)) {
          if (k.startsWith(":") || v === undefined) continue;
          for (const one of Array.isArray(v) ? v : [String(v)]) out.append(k, one);
        }
        let body: Buffer | null = Buffer.concat(chunks);
        // as fetch does: a compressed answer is read uncompressed
        const enc = String(head["content-encoding"] ?? "").toLowerCase();
        if (body.length && enc === "gzip") body = zlib.gunzipSync(body);
        else if (body.length && enc === "br") body = zlib.brotliDecompressSync(body);
        else if (body.length && enc === "deflate") body = zlib.inflateSync(body);
        if (init.method === "HEAD" || status === 204 || status === 304) body = null;
        done(undefined, new Response(body, { status, headers: out }));
      } catch (e) {
        done(e);
      }
    });
    if (init.body !== undefined && init.method === "POST") req.end(init.body);
    else req.end();
  });
}
