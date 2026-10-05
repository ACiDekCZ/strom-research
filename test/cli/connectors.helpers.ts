// What the tests of connectors share: they are split over files (connectors*.test.ts) that run side by side.

import { readEntry, readZip, unzipTo, ZipWriter } from "../../src/core/zip.ts";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { spawnSync } from "node:child_process";
import type { AddressInfo } from "node:net";
import { World, hasGit, fakeConnector, pluginDir, readJsonFile } from "../helpers.ts";
import { testHooks, DEFAULT_PACE } from "../../src/core/net.ts";
import { encodeJpeg } from "../../src/image/jpeg-encode.ts";
import { decodeJpeg } from "../../src/image/jpeg-decode.ts";
import { blank } from "../../src/image/image.ts";

export const opts = { skip: !hasGit };
export const scans = path.join(import.meta.dirname, "..", "fixtures", "images");

export const pauses: number[] = [];
testHooks.sleep = async (ms) => void pauses.push(ms);
after(() => (testHooks.sleep = undefined));

export interface Archive {
  base: string;
  hits: string[];
  /** The forms members signed in with. */
  signins: Record<string, string>[];
  close: () => Promise<void>;
}

/**
 * A small archive portal: a catalogue, a book, its images. Book "zakazana"
 * answers 403, "chyba" an error page in place of an image, "useknuta" images
 * cut short. The search form wants a session (a cookie from /login) and the
 * portal's own header, as real portals do.
 */
/** Which fixture each tile of image 1 is: column-row (of image 2, the next one). */
export const TILE: Record<string, number> = { "0-0": 1, "1-0": 2, "0-1": 3, "1-1": 1 };

export async function archive(): Promise<Archive> {
  const hits: string[] = [];
  const signins: Record<string, string>[] = [];
  const catalog = (place: string) => JSON.stringify([{ id: "5359", title: `${place} N 1784–1820`, callNumber: "17", years: "1784-1820", kinds: ["baptism"], places: [place], url: "https://archive.example.org/5359", images: 3 }]);
  const s = http.createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://x");
    hits.push(u.pathname);
    if (u.pathname === "/catalog" && u.searchParams.get("place") === "Velké Město")
      return res.end(JSON.stringify(Array.from({ length: 40 }, (_, i) => ({ id: `k${i + 1}`, title: `Velké Město N ${1700 + i}`, places: ["Velké Město", "Dolní Lhota", "Čížkov"], images: 200 }))));
    if (u.pathname === "/catalog") return res.end(catalog(u.searchParams.get("place") ?? ""));
    if (u.pathname === "/login") return res.writeHead(302, { location: "/search-page", "set-cookie": "SESSION=s1; Path=/; HttpOnly" }).end();
    if (u.pathname === "/search-page") return res.end("<form>");
    if (u.pathname === "/search") {
      let body = "";
      req.on("data", (d) => (body += d));
      return req.on("end", () => {
        const ok = req.method === "POST" && req.headers.cookie === "SESSION=s1" && req.headers["x-requested-with"] === "XMLHttpRequest" && /form-urlencoded/.test(String(req.headers["content-type"]));
        if (!ok) return res.writeHead(400).end(`no session: ${req.method} ${req.headers.cookie}`);
        return res.end(catalog(new URLSearchParams(body).get("place") ?? ""));
      });
    }
    if (u.pathname === "/book/5359") return res.end(JSON.stringify({ id: "5359", title: "Týnec N 1784–1820", images: 3 }));
    // a part of an image, drawn from the original: as big as the whole image, so twice the detail of a quarter
    if (/^\/part\/5359\/\d+\.jpg$/.test(u.pathname)) {
      hits[hits.length - 1] += u.search;
      return res.writeHead(200, { "content-type": "image/jpeg" }).end(fs.readFileSync(path.join(scans, "s0003.jpg")));
    }
    // members sign in with a form, and the pages they see repeat what they typed (as some portals do)
    if (u.pathname === "/signin") {
      let body = "";
      req.on("data", (d) => (body += d));
      return req.on("end", () => {
        const f = Object.fromEntries(new URLSearchParams(body));
        signins.push(f);
        const html = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        res.writeHead(200, { "set-cookie": "MEMBER=1; Path=/" }).end(`Vítejte ${f.name}, heslo: ${html(f.pass ?? "")}`);
      });
    }
    if (u.pathname === "/whoami") return res.end(`member ${req.headers.cookie ?? "none"} · ${encodeURIComponent(signins.at(-1)?.pass ?? "")}`);
    if (u.pathname === "/echo") return res.end(`key ${req.headers["x-api-key"] ?? "none"}`);
    if (u.pathname === "/hop") return res.writeHead(302, { location: `http://127.0.0.1:${u.searchParams.get("port")}/echo` }).end();
    // behind a bot check: a browser that passed it (its cookie) gets the portal, anything else the check
    if (u.pathname.startsWith("/g/")) {
      if (!/(^|; )passed=1/.test(String(req.headers.cookie ?? "")))
        return res.writeHead(200, { "content-type": "text/html" }).end(`<html><head><META NAME="robots" CONTENT="noindex,nofollow"><script src="/_Incapsula_Resource?SWJIYLWA=5074a744e2e3d891"></script></head><body></body></html>`);
      if (u.pathname === "/g/catalog") {
        const page = Number(u.searchParams.get("page") ?? 1);
        return res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ books: [{ id: String(5358 + page), title: `${u.searchParams.get("place")} ${page === 1 ? "N" : "Z"} 1784–1820`, images: 3 }], next: page < 2 }));
      }
      if (u.pathname === "/g/book/zakazana") return res.writeHead(403).end("no");
      if (u.pathname === "/g/book/5359") return res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ id: "5359", title: "Týnec N 1784–1820", images: 3 }));
      const gi = /^\/g\/img\/5359\/([1-3])\.jpg$/.exec(u.pathname);
      if (gi) return res.writeHead(200, { "content-type": "image/jpeg" }).end(fs.readFileSync(path.join(scans, `s000${gi[1]}.jpg`)));
      return res.writeHead(404).end();
    }
    // a portal that shows its images in tiles only: 2 × 2 of 400 × 300 px
    const tile = /^\/tile\/5359\/(\d+)\/(\d)-(\d)\.jpg$/.exec(u.pathname);
    if (tile) return res.writeHead(200, { "content-type": "image/jpeg" }).end(fs.readFileSync(path.join(scans, `s000${((TILE[`${tile[2]}-${tile[3]}`]! + Number(tile[1]) - 2) % 3) + 1}.jpg`)));
    // a stand-in: a tiny picture in place of an image the portal will not give
    if (/^\/thumb\/\d+\.jpg$/.test(u.pathname)) return res.writeHead(200, { "content-type": "image/jpeg" }).end(encodeJpeg(blank(120, 97, 3, 200)));
    if (/^\/same\/\d+\.jpg$/.test(u.pathname)) return res.writeHead(200, { "content-type": "image/jpeg" }).end(fs.readFileSync(path.join(scans, "s0001.jpg")));
    const img = /^\/img\/([^/]+)\/(\d+)\.jpg$/.exec(u.pathname);
    if (img && img[1] === "zakazana") return res.writeHead(403).end();
    if (img && img[1] === "chyba") return res.writeHead(200, { "content-type": "image/jpeg" }).end(`<!DOCTYPE html><html><body>Too many requests — try again later.</body></html>`);
    const scan = img && Number(img[2]) >= 1 && Number(img[2]) <= 3 ? fs.readFileSync(path.join(scans, `s000${img[2]}.jpg`)) : undefined;
    if (scan && img![1] === "useknuta") return res.writeHead(200, { "content-type": "image/jpeg" }).end(scan.subarray(0, Math.floor(scan.length * 0.6)));
    if (scan) return res.writeHead(200, { "content-type": "image/jpeg" }).end(scan);
    return res.writeHead(404).end();
  });
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
  s.unref(); // a failed test does not keep the run waiting
  return { base: `http://127.0.0.1:${(s.address() as AddressInfo).port}`, hits, signins, close: () => new Promise<void>((r) => s.close(() => r())) };
}

export async function world(): Promise<{ w: World; a: Archive; dir: string }> {
  const w = new World();
  await w.withTree();
  const a = await archive();
  const dir = await fakeConnector(w, "zkusebni", a.base);
  return { w, a, dir };
}

/** Replace the program of a connector (the SDK and the manifest stay). */
export function program(dir: string, code: string): void {
  fs.writeFileSync(path.join(dir, "connector.ts"), code);
}

/**
 * The script strom gives the agent, run as a browser tab would run it: on the page's site, fetching from the
 * archive, each image "downloaded" into the folder under its name — except those Chrome blocks (a site's
 * second download, until the user allows it). The pauses it waits are recorded, not slept.
 */
export async function runInTab(script: string, origin: string, downloads: string, opts: { blocked?: number[]; twice?: number[]; cookie?: string } = {}): Promise<{ line: string; waits: number[] }> {
  const waits: number[] = [];
  const saves: Promise<void>[] = [];
  const blobs = new Map<string, Blob>();
  let clicks = 0;
  const document = {
    body: { appendChild: () => undefined },
    createElement: () => {
      const a = {
        href: "",
        download: "",
        remove: () => undefined,
        click: () => {
          clicks++;
          const n = Number(/-(\d{4})(?:-part)?\./.exec(a.download)?.[1]);
          if (opts.blocked?.includes(n)) return;
          const blob = blobs.get(a.href)!;
          const write = async (name: string) => fs.writeFileSync(path.join(downloads, name), Buffer.from(await blob.arrayBuffer()));
          saves.push(write(a.download));
          if (opts.twice?.includes(n)) saves.push(write(a.download.replace(/(\.\w+)$/, " (1)$1")));
        },
      };
      return a;
    },
  };
  const URLs = { createObjectURL: (b: Blob) => (blobs.set(`blob:${blobs.size}`, b), `blob:${blobs.size - 1}`), revokeObjectURL: () => undefined };
  const later = (f: () => void, ms: number) => (waits.push(ms), ms >= 60000 ? undefined : f());
  const AsyncFunction = Object.getPrototypeOf(async () => undefined).constructor;
  const tab = new AsyncFunction("location", "fetch", "document", "URL", "setTimeout", `return ${script}`);
  // the browser sends its cookies (the check the user passed) with the tab's requests
  const browserFetch = (u: string, init: RequestInit = {}) => fetch(u, { ...init, headers: { ...(init.headers as Record<string, string>), ...(opts.cookie ? { cookie: opts.cookie } : {}) } });
  const line = await tab({ origin }, browserFetch, document, URLs, later);
  await Promise.all(saves);
  assert.ok(clicks > 0 || /^strom:/.test(line), line);
  return { line, waits: waits.filter((w) => w < 60000) };
}
