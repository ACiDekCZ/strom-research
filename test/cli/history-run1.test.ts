// What the ancestors lived through, on what a real session of an agent wrote (test/fixtures/history/cz-bohemia-run1.json:
// the catalog of one region built by a paid run, public history only, the tree's IDs made neutral): the app's answer of
// it, the shape of every event, the same event refused; and what that run showed — a period on two quotes of one page,
// the page read through strom itself (strom history page) once for the words and the check, no task and no connector in
// a session of history. A local server plays the pages; the pauses are recorded, not slept.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { testHooks } from "../../src/core/net.ts";
import { checkKind, checkTexts, checkYears, EVENT_KINDS, REGION_LANGS, type Catalog } from "../../src/core/pastevents.ts";
import { hasYear, QUOTE_MAX } from "../../src/core/pagecheck.ts";
import { wayText } from "../../src/core/web.ts";

const opts = { skip: !hasGit, timeout: 180_000 };
const AGENT = { CLAUDECODE: "1" };
const FIXTURE = path.join(import.meta.dirname, "..", "fixtures", "history", "cz-bohemia-run1.json");
const TEXTS = (cs: string, en: string, de: string) => ["--text-cs", cs, "--text-en", en, "--text-de", de];
const NAMES = ["--name-cs", "Lhotsko", "--name-en", "Lhota Land", "--name-de", "Lhotaland"];

testHooks.sleep = async () => {};
after(() => {
  delete testHooks.sleep;
});

const fixture = (): Catalog => readJsonFile(FIXTURE) as Catalog;

const LONG = Array.from({ length: 900 }, (_, i) => `Věta číslo ${i} nepraví nic.`).join(" ");
const PROTECTORATE = `<!doctype html><html lang="cs"><head><meta charset="utf-8"><title>Protektorát</title></head><body>
<p>Roku 1939 vznikl Protektorát Čechy a Morava.</p><p>Okupace trvala šest let.</p><p>Protektorát zanikl v květnu 1945.</p>
<p>${LONG}</p></body></html>`;

async function pages(): Promise<{ base: string; hits: Record<string, number>; close: () => void }> {
  const hits: Record<string, number> = {};
  const s = http.createServer((req, res) => {
    const p = req.url ?? "/";
    hits[p] = (hits[p] ?? 0) + 1;
    if (p === "/robots.txt") return res.writeHead(200, { "content-type": "text/plain" }).end("User-agent: *\nDisallow: /private\n");
    if (p === "/protektorat") return res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(PROTECTORATE);
    if (p === "/pdf") return res.writeHead(200, { "content-type": "application/pdf" }).end("%PDF-1.4 1939");
    if (p === "/away") return res.writeHead(302, { location: `http://localhost:${(s.address() as AddressInfo).port}/consent` }).end();
    return res.writeHead(404).end();
  });
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
  s.unref();
  return { base: `http://127.0.0.1:${(s.address() as AddressInfo).port}`, hits, close: () => s.close() };
}

function regionFile(w: World, id: string): string {
  return path.join(w.home, "shared", "history", "regions", `${id}.json`);
}

/** A tree of Lhota whose facts span the region's years, the experiment on, the run's catalog in its shared folder. */
async function world(): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M"]); // P0001
  await w.ok(["event", "add", "P0001", "BIRT", "--date", "1840", "--place", "Lhota"]);
  await w.ok(["person", "add", "Marie /Lhotáková/", "--sex", "F"]); // P0002
  await w.ok(["event", "add", "P0002", "BIRT", "--date", "1905", "--place", "Lhota u Brna"]);
  await w.ok(["event", "add", "P0002", "DEAT", "--date", "2021", "--place", "Lhota"]);
  await w.ok(["config", "set", "experiments.history", "on"], { tty: true, answers: ["a"] });
  fs.mkdirSync(path.dirname(regionFile(w, "cz-bohemia")), { recursive: true });
  fs.copyFileSync(FIXTURE, regionFile(w, "cz-bohemia"));
  return w;
}

test("history run 1: every event of the real catalog has the shape strom history add gives — texts, kinds, years, the quote with its year", () => {
  const c = fixture();
  assert.equal(c.region.id, "cz-bohemia");
  assert.equal(c.events.length, 24);
  for (const e of c.events) {
    assert.match(e.id, /^cz-bohemia-\d{4}$/);
    checkKind(e.kind);
    assert.ok((EVENT_KINDS as readonly string[]).includes(e.kind), e.id);
    checkYears(e.from, e.to, e.date);
    // cs, en and de, each ≤ 300, impersonal (core/impersonal.ts) — what the person reads in the app
    checkTexts("text", e.text, REGION_LANGS);
    if (e.why) checkTexts("why", e.why, REGION_LANGS);
    if (e.tip) checkTexts("tip", e.tip.text, REGION_LANGS);
    const q = e.source.quote;
    assert.ok([...q].length <= QUOTE_MAX, e.id);
    assert.ok(hasYear(q, e.from), `${e.id}: its quote says ${e.from}`);
    assert.match(e.source.url, /^https:\/\//);
    assert.match(e.source.checked, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(e.source.sha, /^[0-9a-f]{64}$/);
  }
  const ids = c.events.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(c.next > Math.max(...ids.map((id) => Number(id.slice(-4)))));
});

test("history run 1: the app's answer of the real catalog — no sha, the event taken back gone, its replacement there, a hide moved on, membership by years", opts, async () => {
  const w = await world();
  try {
    await w.ok(["history", "map", "Lhota", "--region", "cz-bohemia"]);
    await w.ok(["history", "map", "Lhota u Brna", "--region", "cz-bohemia:1900-1938"]);
    const a = (await w.ok(["history", "status", "--app", "--json"])).json;
    const live = fixture().events.filter((e) => !e.retracted);
    assert.equal(a.events.length, live.length);
    assert.equal(a.events.length, 23);
    const ids = a.events.map((e: { id: string }) => e.id);
    assert.ok(!ids.includes("cz-bohemia-0022"), "taken back: never sent");
    assert.ok(ids.includes("cz-bohemia-0023"), "what replaced it");
    for (const e of a.events) {
      assert.equal(e.scope, "region");
      assert.deepEqual(e.region, { id: "cz-bohemia", name: { cs: "Čechy", de: "Böhmen", en: "Bohemia" } });
      assert.ok(!("sha" in e.source), `${e.id}: the page's hash is the research's only`);
      assert.ok(!("quotes" in e.source));
      assert.equal(typeof e.source.quote, "string");
      assert.ok(!("by" in e) && !("at" in e));
    }
    // sorted by years
    assert.deepEqual(a.events.map((e: { from: number }) => e.from), [...a.events.map((e: { from: number }) => e.from)].sort((x: number, y: number) => x - y));
    // a place in the region all its years: every event; one of 1900–1938: those that overlap them
    assert.equal(a.places["Lhota"].events.length, 23);
    const within = live.filter((e) => e.from <= 1938 && e.to >= 1900).map((e) => e.id).sort();
    assert.deepEqual([...a.places["Lhota u Brna"].events].sort(), within);
    assert.ok(within.includes("cz-bohemia-0013") && !within.includes("cz-bohemia-0001") && !within.includes("cz-bohemia-0006"));
    assert.equal(a.state.search, "done");
    // the person hid the event taken back (the app had it before): the hide holds on what replaced it
    await w.ok(["history", "hide", "cz-bohemia-0022", "--place", "Lhota"]);
    const b = (await w.ok(["history", "status", "--app", "--json"])).json;
    assert.deepEqual(b.hidden.map((h: { event: string; place: string }) => [h.event, h.place]), [["cz-bohemia-0023", "Lhota"]]);
    // the same kind and years as an event there: refused naming it, before any page is asked
    const same = await w.run(["history", "add", "--region", "cz-bohemia", "--from", "1848", "--kind", "law", ...TEXTS("Zákon", "A law", "Ein Gesetz"), "--url", "https://example.org/never", "--quote", "Roku 1848 …"], { env: AGENT });
    assert.notEqual(same.code, 0);
    assert.match(same.err, /same kind and years is there already: cz-bohemia-0001/);
    const overlap = await w.run(["history", "add", "--region", "cz-bohemia", "--from", "1919", "--kind", "epidemic", ...TEXTS("Chřipka", "Flu", "Grippe"), "--url", "https://example.org/never", "--quote", "1919"], { env: AGENT });
    assert.match(overlap.err, /cz-bohemia-0004/, "1918–1920 holds 1919");
    assert.equal(readJsonFile(regionFile(w, "cz-bohemia")).next, 25, "nothing written");
  } finally {
    w.cleanup();
  }
});

test("history run 1: a page through strom history page — its words found in any accent, read once for the words and the check; a period on two quotes", opts, async () => {
  const srv = await pages();
  const w = await world();
  try {
    await w.ok(["history", "map", "Lhota", "--region", "cz-bohemia"]);
    const url = `${srv.base}/protektorat`;
    // the words looked for, without accents: the page's own words printed
    const found = await w.ok(["history", "page", url, "--find", "protektorat zanikl"], { env: AGENT });
    assert.match(found.out, /Protektorát — http:\/\/127\.0\.0\.1:\d+\/protektorat \(cs, read \d{4}-\d{2}-\d{2}\)/);
    assert.match(found.out, /\[part 1\] .*Protektorát zanikl v květnu 1945\./);
    const j = (await w.ok(["history", "page", url, "--find", "ROKU 1939".normalize("NFD"), "--json"], { env: AGENT })).json;
    assert.equal(j.passages.length, 1);
    assert.match(j.passages[0].text, /^Roku 1939 vznikl Protektorát Čechy a Morava\./);
    assert.ok(j.parts > 1);
    // the whole text in parts
    const p2 = await w.ok(["history", "page", url, "--page", "2"], { env: AGENT });
    assert.match(p2.out, new RegExp(`part 2 of ${j.parts}`));
    assert.match(p2.out, /Věta číslo \d+ nepraví nic\./);
    assert.match((await w.ok(["history", "page", url, "--find", "mor roku 1680"], { env: AGENT })).out, /no passage with "mor roku 1680"/);
    // one quote of a period whose end the page says apart: refused, the way said — nothing asked of the page
    const short = ["history", "add", "--region", "cz-bohemia", "--from", "1939", "--to", "1945", "--kind", "state", "--replaces", "cz-bohemia-0006", ...TEXTS("Protektorát Čechy a Morava 1939–1945.", "The Protectorate of Bohemia and Moravia 1939–1945.", "Das Protektorat Böhmen und Mähren 1939–1945."), "--url", url];
    const one = await w.run([...short, "--quote", "Roku 1939 vznikl Protektorát Čechy a Morava."], { env: AGENT });
    assert.notEqual(one.code, 0);
    assert.match(one.err, /does not say the year 1945 — add a second --quote with the year 1945/);
    assert.match(one.err, /or give the period the page says/);
    const bad = await w.run([...short, "--quote", "Roku 1939 vznikl Protektorát", "--quote", "Protektorát zanikl v říjnu 1945"], { env: AGENT });
    assert.match(bad.err, /quote 2: these words are not on the page/);
    assert.match(bad.err, /strom history page .*--find/);
    const two = await w.run([...short, "--quote", "Protektorát zanikl v květnu 1945.", "--quote", "Roku 1939 vznikl Protektorát Čechy a Morava."], { env: AGENT });
    assert.equal(two.code, 0, two.err);
    assert.match(two.out, /cz-bohemia-0025: state 1939–1945/);
    assert.match(two.out, /cz-bohemia-0006 taken back/);
    assert.equal(srv.hits["/protektorat"], 1, "one request for the words and the checks");
    const c = readJsonFile(regionFile(w, "cz-bohemia"));
    const e = c.events.find((x: { id: string }) => x.id === "cz-bohemia-0025");
    assert.equal(e.source.quote, "Roku 1939 vznikl Protektorát Čechy a Morava.", "the app's quote: the one with the year it began");
    assert.deepEqual(e.source.quotes, ["Protektorát zanikl v květnu 1945.", "Roku 1939 vznikl Protektorát Čechy a Morava."]);
    const a = (await w.ok(["history", "status", "--app", "--json"])).json;
    const sent = a.events.find((x: { id: string }) => x.id === "cz-bohemia-0025");
    assert.deepEqual(Object.keys(sent.source).sort(), ["checked", "lang", "quote", "title", "url"]);
    assert.ok(!a.events.some((x: { id: string }) => x.id === "cz-bohemia-0006"));
    // a page strom cannot read: the same refusal as add, kept as tried of the region; one that sends to another site
    const pdf = await w.run(["history", "page", `${srv.base}/pdf`, "--region", "cz-bohemia"], { env: AGENT });
    assert.notEqual(pdf.code, 0);
    assert.match(pdf.err, /could not be read: not a page of text \(application\/pdf\)\n/);
    assert.doesNotMatch(pdf.err, /nothing written/);
    assert.match(pdf.err, /another source/);
    const away = await w.run(["history", "page", `${srv.base}/away`, "--region", "cz-bohemia"], { env: AGENT });
    assert.match(away.err, /sends to another site \(localhost: a consent or login page as a rule\)/);
    const tried = readJsonFile(regionFile(w, "cz-bohemia")).tried.map((t: { url: string }) => t.url);
    assert.ok(tried.includes(`${srv.base}/pdf`) && tried.includes(`${srv.base}/away`));
    // the experiment off: no page read for it
    await w.ok(["config", "set", "experiments.history", "off", "--for-tree"]);
    const off = await w.run(["history", "page", url], { env: AGENT });
    assert.match(off.err, /history of the regions and of the places is off/);
  } finally {
    srv.close();
    w.cleanup();
  }
});

test("history run 1: a session of history adds no task and no connector; its brief says to read pages through strom", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  try {
    await w.ok(["research", "new", "Předci Jana Lhotáka", "--new-person", "Jan /Lhoták/", "--sex", "M", "--born", "1850", "--born-place", "Lhota"]);
    await w.ok(["config", "set", "experiments.history", "on"], { tty: true, answers: ["a"] });
    await w.ok(["history", "region", "cz-lhota", ...NAMES]);
    await w.ok(["history", "map", "Lhota", "--region", "cz-lhota"]);
    await w.ok(["frontier", "--apply"]);
    const tasks = (await w.ok(["task", "list", "--state", "all", "--full", "--json", "--limit", "500"])).json.tasks as { id: string; origin: string }[];
    const region = tasks.find((t) => t.origin === "history:region:cz-lhota")!;
    const brief = (await w.ok(["brief", region.id])).out;
    assert.match(brief, /read each page through strom history page <url> \(below\), never the web fetch tool — no connector and no task in this session/);
    assert.doesNotMatch(brief, /build its connector/);
    assert.match(brief, /strom history page <url>/);
    assert.match(brief, /a second --quote with that year/);
    assert.match(brief, /strom task add is refused here/);
    await w.ok(["session", "start", region.id]);
    const add = await w.run(["task", "add", "Connector for example.org", "--level", "locate", "--where", "https://example.org/", "--why", "a", "--done-when", "b"], { env: AGENT });
    assert.notEqual(add.code, 0);
    assert.match(add.err, /strom task add: not in a session of history/);
    assert.match(add.err, /strom history page <url>/);
    const conn = await w.run(["connector", "new", "example", "--url", "https://example.org/"], { env: AGENT });
    assert.match(conn.err, /strom connector new: not in a session of history/);
    assert.ok(!fs.existsSync(path.join(w.home, "shared", "plugins", "connectors", "example")));
    await w.ok(["session", "close", "--continue", "--summary", "zkouška", "--next", "dál"]);
    // out of it, the research's tasks as ever
    await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "matriky", "--why", "rodiče", "--done-when", "zápis", "--about", "P0001"]);
  } finally {
    w.cleanup();
  }
});

test("history run 1: past the web tool's limit for a site in a session of history, the way on is strom history page — never a connector or its task", () => {
  const base = { name: "wikipedia", url: "https://cs.wikipedia.org/", later: false, task: "strom task add \"Connector for wikipedia.org\" …", of: "T0002" };
  for (const later of [false, true]) {
    const t = wayText("cs.wikipedia.org", { ...base, later, history: true });
    assert.match(t, /strom history page <its address> \(--find "<words>" for the words to quote\)/);
    assert.doesNotMatch(t, /strom connector new|strom task add|Build its connector/);
  }
  assert.match(wayText("cs.wikipedia.org", base), /Build its connector now/, "any other session as before");
});
