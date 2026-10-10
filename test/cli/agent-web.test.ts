// The pages and searches of an agent's own web tools (fetch.jsonl via web|search) where a person looks: strom media
// calibrate --report says them per site (text and --json), strom doctor says a site asked many pages of in one session
// lately, with the gentle way (a connector) — in the research's language; an archive says nothing of it.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { WEB_PER_HOST, WEB_SOFT } from "../../src/core/metrics.ts";

const opts = { skip: !hasGit };
const DAY = 24 * 3600_000;
const ago = (days: number, min = 0) => new Date(Date.now() - days * DAY + min * 60_000).toISOString();

function put(file: string, lines: Record<string, unknown>[]): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
}

/** Lines of fetch.jsonl as a runner writes them from its agent's stream. */
function webLines(key: string): Record<string, unknown>[] {
  const line = (session: string, day: number, i: number, host?: string) => ({ at: ago(day, i), via: host ? "web" : "search", ...(host ? { host } : {}), session, key, agent: "grok", tool: host ? "web_fetch" : "web_search", from: "stream" });
  return [
    ...Array.from({ length: WEB_PER_HOST + 2 }, (_, i) => line("N0005", 1, i, "obec.example")),
    ...Array.from({ length: 2 }, (_, i) => line("N0006", 2, i, "kronika.example:8080")),
    ...Array.from({ length: 3 }, (_, i) => line("N0005", 1, 30 + i)),
  ];
}

test("calibrate --report and doctor: an agent's own web requests per site and its searches; many pages of one site in one session — a connector is the gentle way", opts, async () => {
  const w = new World();
  await w.withTree();
  const key = (await w.ok(["media", "calibrate", "--report", "--json"])).json.key as string;
  put(path.join(w.cwd, ".strom", "metrics", "fetch.jsonl"), webLines(key));

  const text = (await w.ok(["media", "calibrate", "--report"])).out;
  assert.match(text, /^Webové nástroje agenta:$/m, text);
  assert.match(text, new RegExp(`^ {2}obec\\.example: webové požadavky ${WEB_PER_HOST + 2} · sezení 1 · nejvíc ${WEB_PER_HOST + 2} v jednom$`, "m"), text);
  assert.match(text, /^ {2}kronika\.example:8080: webové požadavky 2 · sezení 1 · nejvíc 2 v jednom$/m, text);
  assert.match(text, /^ {2}hledání na webu: 3$/m, text);
  assert.match(text, new RegExp(`^ {2}víc než ${WEB_PER_HOST} stránek jednoho webu v jednom sezení: šetrnější cestou je konektor \\(strom connector new\\)$`, "m"), text);
  // never an archive's request, never an image
  assert.doesNotMatch(text, /^Archivy:$/m, text);

  const j = (await w.ok(["media", "calibrate", "--report", "--json"])).json;
  assert.deepEqual([j.web.requests, j.web.searches], [WEB_PER_HOST + 4, 3]);
  assert.deepEqual(
    j.web.hosts.map((h: { host: string; requests: number; sessions: number; most: number }) => [h.host, h.requests, h.sessions, h.most]),
    [
      ["obec.example", WEB_PER_HOST + 2, 1, WEB_PER_HOST + 2],
      ["kronika.example:8080", 2, 1, 2],
    ],
  );
  assert.deepEqual([j.hosts, j.samples.scans], [[], 0]);

  const doc = (await w.run(["doctor", "--json"])).json.checks.find((c: { name: string }) => c.name === "web");
  assert.equal(doc?.status, "warn", JSON.stringify(doc));
  assert.equal(doc.label, "agenti na webu");
  assert.equal(doc.detail, `mnoho stránek jednoho webu v jednom sezení přes vlastní webové nástroje agenta: obec.example (${WEB_PER_HOST + 2}) — konektor je k webu šetrnější`);
  assert.equal(doc.fix, "strom connector new");
  const human = (await w.run(["doctor"])).out;
  assert.match(human, /agenti na webu +mnoho stránek jednoho webu .* → strom connector new$/m, human);

  // the same in English: the research's language
  const en = (await w.run(["doctor", "--json"], { env: { ...w.env, STROM_LANG: "en" } })).json.checks.find((c: { name: string }) => c.name === "web");
  assert.equal(en?.detail, `many pages of one site in one session through an agent's own web tools: obec.example (${WEB_PER_HOST + 2}) — a connector is gentler on the site`);
  w.cleanup();
});

test("doctor: no line for a few pages of a site, nor for many pages long ago", opts, async () => {
  const w = new World();
  await w.withTree();
  const key = (await w.ok(["media", "calibrate", "--report", "--json"])).json.key as string;
  const line = (session: string, day: number, i: number) => ({ at: ago(day, i), via: "web", host: "obec.example", session, key, agent: "opencode", tool: "webfetch", from: "stream" });
  put(path.join(w.cwd, ".strom", "metrics", "fetch.jsonl"), [
    // up to the soft threshold (where the hook advises a connector): a few
    ...Array.from({ length: WEB_SOFT }, (_, i) => line("N0003", 1, i)),
    ...Array.from({ length: WEB_PER_HOST + 5 }, (_, i) => line("N0001", 20, i)),
  ]);
  const checks = (await w.run(["doctor", "--json"])).json.checks as { name: string }[];
  assert.equal(checks.some((c) => c.name === "web"), false, JSON.stringify(checks));
  w.cleanup();
});
