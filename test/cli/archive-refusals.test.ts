// robots.txt and an archive's refusals (core/net.ts, core/terms.ts): strom reads a host's robots.txt itself, at most once
// a day and only when a request goes there anyway; a path it keeps automated tools off is not asked (the person may
// allow it slowly), the whole site kept off is a site only a person's browser goes to; its Crawl-delay slows the pace.
// A refusal (403) of a run's first request is a day's pause, the same a second day (or from a host that never let strom
// in) a refusal of strom's client — left alone until the person lifts it, kept in their settings too; a 401 to a
// connector with a login is the login, never that. The agent hears what to do next, the person hears it in the
// research's history, strom status and doctor. A person's answer is simulated only in each test's own settings (R8).

import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { opts, netFile, scans } from "./connectors.helpers.ts";
import { World, fakeConnector, pluginDir, readJsonFile } from "../helpers.ts";
import { testHooks, REFUSED_FOREVER, REFUSED_MS, HUMAN_PACE } from "../../src/core/net.ts";
import { levelWords, waysOffered } from "../../src/core/archiveasks.ts";

const pauses: number[] = [];
testHooks.sleep = async (ms) => void pauses.push(ms);
after(() => (testHooks.sleep = undefined));

interface Site {
  base: string;
  hits: string[];
  /** robots.txt: its status and text (none: 404). */
  robots?: { status: number; body?: string };
  /** Answer every request but robots.txt with this status (401, 403); a set of paths: only those with 403. */
  refuse?: number | Set<string>;
  close: () => Promise<void>;
}

async function site(): Promise<Site> {
  const st = { hits: [] as string[] } as Site;
  const s = http.createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://x");
    st.hits.push(`${u.pathname}${u.search}`);
    if (u.pathname === "/robots.txt") return st.robots ? res.writeHead(st.robots.status, { "content-type": "text/plain" }).end(st.robots.body ?? "") : res.writeHead(404).end();
    if (typeof st.refuse === "number") return res.writeHead(st.refuse).end("Forbidden");
    if (st.refuse?.has(u.pathname)) return res.writeHead(403).end("Forbidden");
    if (u.pathname === "/catalog") return res.end(JSON.stringify([{ id: "5359", title: "Týnec N 1784–1820", years: "1784-1820", images: 3 }]));
    if (u.pathname === "/book/5359") return res.end(JSON.stringify({ id: "5359", title: "Týnec N 1784–1820", images: 3 }));
    const img = /^\/img\/5359\/([1-3])\.jpg$/.exec(u.pathname);
    if (img) return res.writeHead(200, { "content-type": "image/jpeg" }).end(fs.readFileSync(path.join(scans, `s000${img[1]}.jpg`)));
    return res.writeHead(404).end();
  });
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
  s.unref();
  st.base = `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
  st.close = () => new Promise<void>((r) => s.close(() => r()));
  return st;
}

async function world(policy?: Record<string, unknown>): Promise<{ w: World; s: Site }> {
  const w = new World();
  await w.withTree();
  const s = await site();
  await fakeConnector(w, "zkusebni", s.base, policy);
  return { w, s };
}

const state = (w: World) => readJsonFile(netFile(w));
const writeState = (w: World, change: (s: Record<string, any>) => void) => {
  const s = state(w);
  change(s);
  fs.writeFileSync(netFile(w), JSON.stringify(s));
};
const store = (w: World) => readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "archives.json"));
const notRobots = (hits: string[]) => hits.filter((h) => h !== "/robots.txt");
const fetchLog = (w: World) =>
  fs
    .readFileSync(path.join(w.cwd, ".strom", "metrics", "fetch.jsonl"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));

test("robots.txt: read by strom once a day before the host's first request — the second request of the day reads the copy kept; a day on, read again", opts, async () => {
  const { w, s } = await world();
  try {
    s.robots = { status: 200, body: "User-agent: *\nDisallow: /admin\n" };
    await w.ok(["fetch", "zkusebni", "--find", "Týnec"]);
    await w.ok(["fetch", "zkusebni", "--find", "Lhota"]);
    assert.deepEqual(s.hits.filter((h) => h === "/robots.txt").length, 1, "once a day");
    assert.deepEqual(state(w).robots.groups, [{ agents: ["*"], allow: [], disallow: ["/admin"] }]);
    // counted in the host's hour, and in fetch.jsonl as its own line
    assert.equal(state(w).recent.length, 3, "robots.txt and the two catalogue requests");
    assert.equal(fetchLog(w).filter((l) => l.cmd === "robots").length, 1);
    // a day on: read again before the next request
    writeState(w, (x) => (x.robots.at -= REFUSED_MS + 60_000));
    await w.ok(["fetch", "zkusebni", "--find", "Týnec"]);
    assert.equal(s.hits.filter((h) => h === "/robots.txt").length, 2);
  } finally {
    w.cleanup();
    await s.close();
  }
});

test("robots.txt keeps tools off a path: strom does not ask it — the catalogue too only with the person's permission, then at a person's pace; 404 keeps nothing off", opts, async () => {
  const { w, s } = await world();
  try {
    s.robots = { status: 200, body: "# the archive\nUser-agent: strom-research\nDisallow: /catalog\nAllow: /catalog/open\n" };
    const r = await w.run(["fetch", "zkusebni", "--find", "Týnec"]);
    assert.equal(r.code, 1, r.out + r.err);
    assert.deepEqual(s.hits, ["/robots.txt"], "nothing but robots.txt asked");
    assert.match(r.out, /robots\.txt keeps automated tools off \/catalog\?place=T%C3%BDnec \("Disallow: \/catalog"\): strom did not ask it — by hand, or the person's decision \(strom allow archive 127\.0\.0\.1 --way slow — the person's, never yours\)/);
    assert.match(r.out, /next: \(1\) another way to the same records/);
    assert.doesNotMatch(r.out, /no books found/);
    // an agent cannot give the permission (no window here: exit 4)
    assert.equal((await w.run(["allow", "archive", "127.0.0.1", "--way", "slow"], { env: { CLAUDECODE: "1" }, choice: null })).code, 4);
    // the person allows it slowly, in their own terminal (a test's own settings — R8): the catalogue goes, at a person's pace
    await w.ok(["allow", "archive", "127.0.0.1", "--way", "slow"], { tty: true });
    pauses.length = 0;
    writeState(w, (x) => (x.last = Date.now()));
    const ok = await w.ok(["fetch", "zkusebni", "--find", "Týnec"]);
    assert.match(ok.out, /Týnec N 1784–1820/);
    // a pause is the pace less the time since the request before it (real time passes, the sleep is the test's): a
    // person's 10 s, with room for a slow machine
    assert.ok(pauses.some((p) => p >= HUMAN_PACE.minIntervalMs - 3000), `a person's pace: ${pauses.join(", ")}`);
    // 404: nothing kept off
    s.robots = undefined;
    writeState(w, (x) => (x.robots.at -= REFUSED_MS + 60_000));
    await w.ok(["allow", "archive", "127.0.0.1", "--revoke"], { tty: true });
    await w.ok(["fetch", "zkusebni", "--find", "Lhota"]);
    assert.equal(state(w).robots.status, 404);
    assert.deepEqual(state(w).robots.groups, []);
  } finally {
    w.cleanup();
    await s.close();
  }
});

test("robots.txt keeps tools off the whole site: no direct request — restricted, only a person's browser, never slowly; kept in the person's settings", opts, async () => {
  const { w, s } = await world();
  try {
    s.robots = { status: 200, body: "User-agent: *\nDisallow: /\n" };
    const r = await w.run(["fetch", "zkusebni", "--find", "Týnec"]);
    assert.equal(r.code, 1, r.out + r.err);
    assert.deepEqual(s.hits, ["/robots.txt"]);
    assert.match(r.out, /robots\.txt keeps automated tools off the whole site \("Disallow: \/"\): strom sends it no direct request — only the person's own browser goes there/);
    assert.deepEqual(store(w).archives["127.0.0.1"].robots.line, "Disallow: /");
    // the next one: refused before anything goes (the copy of robots.txt is today's)
    const again = await w.run(["fetch", "zkusebni", "5359", "--list"]);
    assert.equal(again.code, 2, again.out + again.err);
    assert.match(again.err, /lets automated tools in only through a person's browser \(its robots\.txt keeps automated tools off the whole site \("Disallow: \/"\)/);
    assert.deepEqual(s.hits, ["/robots.txt"]);
    const level = (await w.ok(["allow", "archive", "--json"])).json;
    assert.equal(level.archives["127.0.0.1"].robots.line, "Disallow: /");
    // the person's permission: through the browser or by hand, never slowly
    const slow = await w.run(["allow", "archive", "127.0.0.1", "--way", "slow"], { tty: true });
    assert.equal(slow.code, 2);
    assert.match(slow.err, /only through a person's browser .* never slowly through strom/);
    // the shared folder's net/ wiped: the person's settings keep it (robots.txt read again: the one request)
    fs.rmSync(path.dirname(netFile(w)), { recursive: true, force: true });
    const wiped = await w.run(["fetch", "zkusebni", "5359", "--list"]);
    assert.notEqual(wiped.code, 0);
    assert.deepEqual(notRobots(s.hits), [], "nothing but robots.txt, ever");
    // the ways the menu and the Strom app offer: no "slowly"
    const c = { name: "zkusebni", dir: pluginDir(w, "zkusebni"), manifest: { ...readJsonFile(path.join(pluginDir(w, "zkusebni"), "connector.json")), routes: ["direct", "browser"] } };
    assert.deepEqual(waysOffered(c as never, true, "slow", true), ["browser", "manual"]);
    assert.deepEqual(waysOffered(c as never, true, "slow", false), ["slow", "browser", "manual"]);
  } finally {
    w.cleanup();
    await s.close();
  }
});

test("Crawl-delay: a floor of the host's pace — slower, never faster", opts, async () => {
  const { w, s } = await world();
  try {
    await w.ok(["recordset", "add", "Týnec N 1784–1820", "--kinds", "baptism"]); // B0001
    s.robots = { status: 200, body: "User-agent: *\nCrawl-delay: 30\n" };
    pauses.length = 0;
    await w.ok(["fetch", "zkusebni", "5359", "--images", "1-2", "--recordset", "B1"]);
    assert.equal(pauses.filter((p) => p > 29_000 && p <= 30_000).length, 2, `${pauses.join(", ")}`);
    assert.match((await w.ok(["consents"])).out, /127\.0\.0\.1 · .*at least 30 s apart/);
  } finally {
    w.cleanup();
    await s.close();
  }
});

test("a refusal of the first request: a day's pause; the same a second day — strom's client refused, left alone until the person lifts it (net/ wiped or not); the person hears it", opts, async () => {
  const { w, s } = await world();
  try {
    // the archive let strom in before
    await w.ok(["fetch", "zkusebni", "--find", "Týnec"]);
    // day 1: the first request of the run refused
    s.refuse = 403;
    s.hits.length = 0;
    const d1 = await w.run(["fetch", "zkusebni", "--find", "Týnec"]);
    assert.equal(d1.code, 1, d1.out + d1.err);
    assert.deepEqual(s.hits, ["/catalog?place=T%C3%BDnec"], "robots.txt read today already: only the request");
    assert.match(d1.out, /refused strom's first request \(HTTP 403\) — strom leaves it alone for a day; refused so again on another day, it is left alone until the person lifts it/);
    assert.match(d1.out, /→ 127\.0\.0\.1 refused strom's first request: leave it alone for a day/);
    assert.match(d1.out, /next: \(1\) another way to the same records — another archive or fonds of the jurisdiction, the parish, an index, a catalogue: strom recordset list --place Týnec · strom place show Týnec · strom repo list; record the search: strom search add "…" --result inconclusive --note "127\.0\.0\.1 refused automated access"/);
    // the --check form now that strom task wait takes it: the person's check of the site, its address as it was asked
    // (its scheme and port kept: http and a port of its own here, never https://127.0.0.1/)
    assert.ok(d1.out.includes(`: strom task wait T… --check ${s.base}/ --on "<what the person should check there`), d1.out);
    assert.doesNotMatch(d1.out, /--check https:\/\/127\.0\.0\.1\//);
    assert.doesNotMatch(d1.out, /no books found/);
    let st = state(w);
    assert.equal(st.refusedKind, "first");
    assert.ok(st.refusedFirst.at > Date.now() - 60_000);
    assert.ok(st.blockedUntil > Date.now() + REFUSED_MS - 60_000 && st.blockedUntil <= Date.now() + REFUSED_MS);
    const last = fetchLog(w).at(-1);
    assert.deepEqual([last.status, last.refused], [403, "first"]);
    // the person hears it: the history, in the research's language
    const recent = await w.ok(["recent"]);
    assert.match(recent.out, /Archivy:\n {2}Archiv 127\.0\.0\.1 odmítl požadavky \(HTTP 403\) — strom ho nechá být do (\d{4}-\d\d-\d\d )?\d\d:\d\d/);
    // day 2: the pause over, the first request refused again — the client
    writeState(w, (x) => {
      x.blockedUntil = Date.now() - 1000;
      x.refusedFirst.at -= REFUSED_MS + 3600_000;
      x.robots.at -= REFUSED_MS + 3600_000;
    });
    s.hits.length = 0;
    const d2 = await w.run(["fetch", "zkusebni", "--find", "Týnec"]);
    assert.equal(d2.code, 1, d2.out + d2.err);
    assert.match(d2.out, /refused strom's client on the first request, a second day too \(HTTP 403; no load from strom\)/);
    assert.match(d2.out, /→ 127\.0\.0\.1 does not let automated tools in: it refused strom's client on the first request, a second day too — no load from strom, not a block for too many requests\. strom leaves it alone until the person lifts it \(strom allow host 127\.0\.0\.1 --unblock — the person's\)\. Do not try it through your web tools or the browser either\./);
    st = state(w);
    assert.equal(st.refusedKind, "client");
    assert.ok(st.blockedUntil >= REFUSED_FOREVER, "never by itself — far ahead, an older strom keeps it too");
    assert.equal(store(w).archives["127.0.0.1"].refused.host, "127.0.0.1");
    assert.match(fetchLog(w).at(-1).refused, /^client$/);
    // strom status and doctor say it while it lasts
    assert.match((await w.ok(["status"])).out, /^127\.0\.0\.1 odmítl automatický přístup stromu — snímky ručně; zrušit: strom allow host 127\.0\.0\.1 --unblock$/m);
    assert.match((await w.run(["doctor"])).out, /127\.0\.0\.1: odmítl automatický přístup stromu — snímky ručně/);
    assert.match((await w.ok(["recent"])).out, /Archiv 127\.0\.0\.1 odmítl automatický přístup stromu — snímky ručně/);
    // a day on: still left alone; nothing goes, the catalogue neither
    s.hits.length = 0;
    const later = await w.run(["fetch", "zkusebni", "--find", "Týnec"]);
    assert.equal(later.code, 2);
    assert.match(later.err, /refused strom's client — left alone until the person lifts it \(strom allow host 127\.0\.0\.1 --unblock\)/);
    assert.deepEqual(s.hits, []);
    // the shared folder's net/ wiped: the person's settings keep the refusal
    fs.rmSync(path.dirname(netFile(w)), { recursive: true, force: true });
    assert.equal((await w.run(["fetch", "zkusebni", "--find", "Týnec"])).code, 2);
    assert.deepEqual(s.hits, [], "nothing asked — robots.txt neither");
    // only the person lifts it: an agent (no window here) gets exit 4
    assert.equal((await w.run(["allow", "host", "127.0.0.1", "--unblock"], { env: { CLAUDECODE: "1" }, choice: null })).code, 4);
    assert.equal(store(w).archives["127.0.0.1"].refused.host, "127.0.0.1");
    await w.ok(["allow", "host", "127.0.0.1", "--unblock"], { tty: true, answers: ["y"] });
    assert.equal(store(w).archives["127.0.0.1"].refused, undefined);
    s.refuse = undefined;
    await w.ok(["fetch", "zkusebni", "--find", "Týnec"]);
    assert.doesNotMatch((await w.ok(["status"])).out, /^127\.0\.0\.1 odmítl automatický přístup/m);
  } finally {
    w.cleanup();
    await s.close();
  }
});

test("a host that never let strom in refuses its first request: strom's client refused at once; one that refused after many answers: load — a day", opts, async () => {
  const { w, s } = await world();
  try {
    await w.ok(["recordset", "add", "Týnec N 1784–1820", "--kinds", "baptism"]); // B0001
    // after answers within the run: the third image refused — load, a day
    s.refuse = new Set(["/img/5359/3.jpg"]);
    const r = await w.run(["fetch", "zkusebni", "5359", "--images", "1-3", "--recordset", "B1"]);
    assert.equal(r.code, 0, r.out + r.err);
    assert.match(r.out, /2 image\(s\) of B0001 \(images 1–2\) fetched and registered/);
    assert.match(r.out, /127\.0\.0\.1 answered 403 — strom stops and leaves it alone for a day/);
    assert.match(r.out, /→ 127\.0\.0\.1 refused after strom's requests \(too many, or too fast for it\): leave it alone for a day — stop, never sooner\./);
    assert.match(r.out, /next: \(1\) another way/);
    assert.equal(state(w).refusedKind, "load");
    assert.ok(state(w).blockedUntil < Date.now() + REFUSED_MS + 1000);
    assert.equal(store(w).archives["127.0.0.1"].refused, undefined, "no refusal of the client kept");
  } finally {
    w.cleanup();
    await s.close();
  }
  // a host strom meets first now, refusing its first request: it never let strom in — the client
  const n = await world();
  try {
    n.s.refuse = 403;
    const r = await n.w.run(["fetch", "zkusebni", "--find", "Týnec"]);
    assert.equal(r.code, 1);
    assert.match(r.out, /refused strom's client on the first request, and never let it in before/);
    assert.equal(state(n.w).refusedKind, "client");
  } finally {
    n.w.cleanup();
    await n.s.close();
  }
});

test("a refusal of robots.txt itself (401/403) decides nothing: no refusal of strom's client, no pause — the next real request decides", opts, async () => {
  // a host strom meets first now: robots.txt refused, the site itself answers
  const { w, s } = await world();
  try {
    s.robots = { status: 403 };
    const r = await w.run(["fetch", "zkusebni", "--find", "Týnec"]);
    assert.equal(r.code, 0, r.out + r.err);
    assert.match(r.out, /5359/);
    assert.deepEqual(s.hits, ["/robots.txt", "/catalog?place=T%C3%BDnec"]);
    const st = state(w);
    assert.equal(st.refusedKind, undefined, "no refusal of the client");
    assert.equal(st.blockedUntil, undefined, "no pause");
    assert.equal(st.robots.status, 403, "robots.txt unknown: kept as read, nothing decided by it");
    assert.equal(store(w).archives["127.0.0.1"]?.refused, undefined);
    // the same day: robots.txt not asked again, the catalogue goes on
    s.hits.length = 0;
    await w.ok(["fetch", "zkusebni", "--find", "Týnec"]);
    assert.deepEqual(s.hits, ["/catalog?place=T%C3%BDnec"]);
  } finally {
    w.cleanup();
    await s.close();
  }
  // a host that refuses robots.txt and its first real request: that request decides — strom's client refused
  const n = await world();
  try {
    n.s.robots = { status: 401 };
    n.s.refuse = 403;
    const r = await n.w.run(["fetch", "zkusebni", "--find", "Týnec"]);
    assert.equal(r.code, 1, r.out + r.err);
    assert.deepEqual(n.s.hits, ["/robots.txt", "/catalog?place=T%C3%BDnec"], "the real request was asked");
    assert.match(r.out, /refused strom's client on the first request, and never let it in before \(HTTP 403/);
    assert.equal(state(n.w).refusedKind, "client");
  } finally {
    n.w.cleanup();
    await n.s.close();
  }
});

test("Settings → Archives: an archive whose server refused strom's client says so — its answer, not the archive's terms, since when — and how the person lifts it (--unblock), never a level to raise", opts, async () => {
  const { w, s } = await world();
  try {
    s.refuse = 403;
    assert.equal((await w.run(["fetch", "zkusebni", "--find", "Týnec"])).code, 1);
    assert.equal(state(w).refusedKind, "client");
    const look = await w.run([], { tty: true, answers: ["8", "4", "0", "0", "0"] });
    assert.match(look.out, /• Testovací archiv — [^\n]*server odmítl automatický přístup stromu – snímky ručně/);
    const key = /(\d) {2}Svolení ke stahování z archivů/.exec(look.out)?.[1];
    assert.ok(key, look.out);
    const one = await w.run([], { tty: true, answers: ["8", "4", key!, "1", "", "0", "0", "0", "0"] });
    assert.match(one.out, /1 {2}Testovací archiv \(127\.0\.0\.1\) – server odmítl automatický přístup stromu – snímky ručně/);
    assert.match(one.out, /Testovací archiv: server 127\.0\.0\.1 odmítl automatický přístup stromu \(od [^)]+\) – je to odpověď serveru, ne podmínky archivu\. Snímky ručně; odmítnutí zruší jen člověk: strom allow host 127\.0\.0\.1 --unblock/);
    assert.doesNotMatch(one.out, /\(podmínky\)|--level restricted/);
    // strom consents says it too: the server's answer, how it is lifted
    assert.match((await w.ok(["consents"])).out, /127\.0\.0\.1 {2}zkusebni {2}forbidden {2}· its server refused strom's client \(the server's answer, not the archive's terms\) — only the person lifts it: strom allow host 127\.0\.0\.1 --unblock/);
  } finally {
    w.cleanup();
    await s.close();
  }
});

test("strom doctor: several archives that refused strom said in the plural; by hand or none at all that no terms gave: without \"(terms)\"", opts, async () => {
  const { w, s } = await world();
  try {
    const at = new Date().toISOString();
    fs.writeFileSync(path.join(w.env.STROM_CONFIG_DIR!, "archives.json"), JSON.stringify({ archives: { "a.example.org": { refused: { host: "a.example.org", at } }, "b.example.org": { refused: { host: "b.example.org", at } } }, pending: [] }));
    assert.match((await w.run(["doctor"])).out, /a\.example\.org, b\.example\.org: odmítly automatický přístup stromu — snímky ručně/);
  } finally {
    w.cleanup();
    await s.close();
  }
  assert.equal(levelWords("cs", "manual", false, ["floor"]), "snímky jen ručně");
  assert.equal(levelWords("cs", "manual", false, ["terms"]), "snímky jen ručně (podmínky automatické stahování nedovolují)");
  assert.equal(levelWords("cs", "forbidden", false, ["tree"]), "žádný automatický přístup");
  assert.equal(levelWords("cs", "forbidden", false, ["refused"]), "server odmítl automatický přístup stromu – snímky ručně");
});

test("401 to a connector with a login: the login ran out — said so, never a refusal of strom's client", opts, async () => {
  const { w, s } = await world();
  try {
    const file = path.join(pluginDir(w, "zkusebni"), "connector.json");
    fs.writeFileSync(file, JSON.stringify({ ...readJsonFile(file), login: { about: "a member's account", fields: { user: "User name", password: "Password" }, required: false } }));
    s.refuse = 401;
    const r = await w.run(["fetch", "zkusebni", "--find", "Týnec"]);
    assert.equal(r.code, 1, r.out + r.err);
    assert.match(r.out, /→ 127\.0\.0\.1 answered 401: the login of zkusebni has most likely run out — the person saves it again in their own terminal \(strom login zkusebni\) and lifts the pause \(strom allow host 127\.0\.0\.1 --unblock\)/);
    assert.doesNotMatch(r.out, /refused strom's client|next: \(1\)/);
    assert.equal(state(w).refusedKind, "login");
    assert.ok(state(w).blockedUntil < REFUSED_FOREVER);
    assert.match((await w.ok(["recent"])).out, /Archiv 127\.0\.0\.1 odmítl přihlášení stahovače zkusebni — přihlášení uložit znovu: strom login zkusebni/);
  } finally {
    w.cleanup();
    await s.close();
  }
});

test("connector probe and test refused: the same advice; the probe of /robots.txt itself is the one read", opts, async () => {
  const { w, s } = await world();
  try {
    s.robots = { status: 200, body: "User-agent: *\nDisallow: /book\n" };
    const p = await w.run(["connector", "probe", "zkusebni", `${s.base}/book/5359`]);
    assert.equal(p.code, 1, p.out + p.err);
    assert.match(p.out, /robots\.txt keeps automated tools off \/book\/5359 \("Disallow: \/book"\)/);
    assert.deepEqual(s.hits, ["/robots.txt"]);
    await w.ok(["connector", "probe", "zkusebni", `${s.base}/robots.txt`]);
    assert.deepEqual(s.hits, ["/robots.txt", "/robots.txt"], "a probe of robots.txt: no second read before it");
    const t = await w.run(["connector", "test", "zkusebni", "--list", "5359"]);
    assert.equal(t.code, 1);
    assert.match(t.out, /→ 127\.0\.0\.1's robots\.txt keeps automated tools off \/book\/5359/);
  } finally {
    w.cleanup();
    await s.close();
  }
});
