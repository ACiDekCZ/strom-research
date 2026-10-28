// What the ancestors lived through (experiments.history): regions and their catalogs shared by the trees, the places
// of the facts mapped by years, events written only from a page strom read itself, the same event never twice, what
// the person hid kept through a replacement, the files sealed, packed with the research. A local server plays the
// pages; the pauses are recorded, not slept.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { spawn } from "node:child_process";
import type { AddressInfo } from "node:net";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { testHooks } from "../../src/core/net.ts";
import { encodeJpeg } from "../../src/image/jpeg-encode.ts";
import { blank } from "../../src/image/image.ts";

const opts = { skip: !hasGit, timeout: 180_000 };
const AGENT = { CLAUDECODE: "1" };
const CLI = path.join(import.meta.dirname, "..", "..", "src", "cli.ts");

testHooks.sleep = async () => {};
after(() => {
  delete testHooks.sleep;
});

const PAGE = `<!doctype html><html lang="cs"><head><meta charset="utf-8"><title>Dějiny Lhoty</title>
<script>var x = "V roce 1777 nic";</script></head><body>
<p>V roce 1866 zasáhla Lhotu epidemie cholery&nbsp;– zemřelo 42 obyvatel.</p>
<p>Sčítání lidu roku 1921 zapsalo ve Lhotě 312 obyvatel.</p>
<p>Roku 1950 byla ve Lhotě založena družstva.</p>
<p>V letech 1914–1918 odešlo z Lhoty na frontu 30 mužů.</p>
<p>Roku 1867 se cholera vrátila.</p>
<p>Povodeň roku 1866 vzala mlýn.</p>
</body></html>`;

async function pages(): Promise<{ base: string; hits: Record<string, number>; close: () => void }> {
  const hits: Record<string, number> = {};
  const s = http.createServer((req, res) => {
    const p = req.url ?? "/";
    hits[p] = (hits[p] ?? 0) + 1;
    if (p === "/robots.txt") return res.writeHead(200, { "content-type": "text/plain" }).end("User-agent: *\nDisallow: /private\n");
    if (p === "/lhota" || p === "/lhota-jinde") return res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(PAGE);
    if (p === "/pdf") return res.writeHead(200, { "content-type": "application/pdf" }).end("%PDF-1.4 1866");
    return res.writeHead(404).end();
  });
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
  s.unref();
  return { base: `http://127.0.0.1:${(s.address() as AddressInfo).port}`, hits, close: () => s.close() };
}

const NAMES = (cs: string, en: string, de: string) => ["--name-cs", cs, "--name-en", en, "--name-de", de];
const TEXTS = (cs: string, en: string, de: string) => ["--text-cs", cs, "--text-en", en, "--text-de", de];

async function world(name = "Lhotákovi"): Promise<World> {
  const w = new World();
  await w.withTree(name);
  await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M"]); // P0001
  await w.ok(["event", "add", "P0001", "BIRT", "--date", "1850", "--place", "Lhota"]);
  await w.ok(["event", "add", "P0001", "DEAT", "--date", "1925", "--place", "Lhota u Brna"]);
  await w.ok(["config", "set", "experiments.history", "on"], { tty: true, answers: ["a"] });
  return w;
}

function shared(w: World): string {
  return path.join(w.home, "shared");
}

function catalog(w: World, id: string): any {
  return readJsonFile(path.join(shared(w), "history", "regions", `${id}.json`));
}

async function answer(w: World, cwd?: string): Promise<any> {
  return (await w.ok(["history", "status", "--app", "--json"], cwd ? { cwd } : {})).json;
}

async function regions(w: World): Promise<void> {
  await w.ok(["history", "region", "cz-bohemia", ...NAMES("Čechy", "Bohemia", "Böhmen")]);
  await w.ok(["history", "map", "Lhota", "--region", "cz-bohemia:1800-1918", "--region", "cz-czsk:1918-", ...NAMES("Československo", "Czechoslovakia", "Tschechoslowakei")]);
}

test("history: the experiment is the person's alone; a tree may only turn it off; off, nothing is written", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  try {
    const agent = await w.run(["config", "set", "experiments.history", "on"], { env: AGENT });
    assert.equal(agent.code, 4, agent.err);
    const tree = await w.run(["config", "set", "experiments.history", "on", "--for-tree"], { tty: true, answers: ["a"] });
    assert.notEqual(tree.code, 0);
    assert.match(tree.err, /a tree may only turn it off/);
    assert.equal((await answer(w)).state.on, false);
    const off = await w.run(["history", "add", "--region", "cz-bohemia", "--from", "1866", "--kind", "epidemic", ...TEXTS("a", "b", "c"), "--url", "https://example.org/", "--quote", "1866"], { env: AGENT });
    assert.notEqual(off.code, 0);
    assert.match(off.err, /history of the places is off/);
    await w.ok(["config", "set", "experiments.history", "on"], { tty: true, answers: ["a"] });
    assert.equal((await answer(w)).state.on, true);
    await w.ok(["config", "set", "experiments.history", "off", "--for-tree"]);
    assert.equal((await answer(w)).state.on, false, "the tree's own off");
    // hidden: run when named, shown nowhere
    assert.doesNotMatch((await w.ok(["commands", "--json"])).out, /history status|history add/);
    assert.doesNotMatch((await w.ok(["help"])).out, /history map/);
  } finally {
    w.cleanup();
  }
});

test("history: places by the years they belonged to a region; events from a page strom read; a place done with nothing left out", opts, async () => {
  const srv = await pages();
  const w = await world();
  try {
    const before = await answer(w);
    assert.equal(before.state.search, "none");
    assert.deepEqual(Object.keys(before.places).sort(), ["Lhota", "Lhota u Brna"]);
    assert.ok(Object.values(before.places).every((p: any) => p.state === "pending"));
    await regions(w);
    // a place as typed differently (decomposed, other case) is the place of the facts
    await w.ok(["history", "map", "lhota u brna".normalize("NFD"), "--unlocated", "--why", "dvě vsi toho jména"]);
    assert.notEqual((await w.run(["history", "map", "Nikde", "--region", "cz-bohemia"])).code, 0, "no place of the facts");
    const add = (region: string, from: string, kind: string, quote: string, more: string[] = []) =>
      w.run(["history", "add", "--region", region, "--from", from, "--kind", kind, ...TEXTS("Událost", "An event", "Ein Ereignis"), "--url", `${srv.base}/lhota`, "--quote", quote, ...more], { env: AGENT });
    const a = await add("cz-bohemia", "1866", "epidemic", "V roce 1866 zasáhla Lhotu epidemie cholery – zemřelo 42 obyvatel.");
    assert.equal(a.code, 0, a.err);
    assert.match(a.out, /cz-bohemia-0001/);
    assert.equal((await add("cz-czsk", "1921", "census", "Sčítání lidu roku 1921 zapsalo ve Lhotě 312 obyvatel.")).code, 0);
    assert.equal((await add("cz-bohemia", "1950", "economy", "Roku 1950 byla ve Lhotě založena družstva.")).code, 0, "an event of the region, after the place left it");
    // the words not on the page, the year not in the quote, a script's words: refused, nothing kept as tried
    assert.match((await add("cz-bohemia", "1866", "disaster", "V roce 1866 přišel mor")).err, /not on the page/);
    assert.match((await add("cz-bohemia", "1866", "disaster", "Povodeň vzala mlýn")).err, /does not say the year 1866/);
    assert.match((await add("cz-bohemia", "1777", "other", "V roce 1777 nic")).err, /not on the page/);
    assert.deepEqual(catalog(w, "cz-bohemia").tried, []);
    // a page strom cannot read: kept as tried, the agent told another source or none
    const pdf = await w.run(["history", "add", "--region", "cz-bohemia", "--from", "1866", "--kind", "disaster", ...TEXTS("a", "b", "c"), "--url", `${srv.base}/pdf`, "--quote", "1866"], { env: AGENT });
    assert.notEqual(pdf.code, 0);
    assert.match(pdf.err, /not a page of text/);
    assert.match(pdf.err, /another source/);
    assert.equal(catalog(w, "cz-bohemia").tried[0].url, `${srv.base}/pdf`);
    const robots = await w.run(["history", "add", "--region", "cz-bohemia", "--from", "1866", "--kind", "disaster", ...TEXTS("a", "b", "c"), "--url", `${srv.base}/private`, "--quote", "1866"], { env: AGENT });
    assert.match(robots.err, /robots\.txt/);
    assert.equal(srv.hits["/private"], undefined, "robots.txt kept it off: never asked");
    assert.equal(srv.hits["/lhota"], 1, "the page read once, the rest from its copy");
    // texts a person reads: never addressing them
    assert.match((await w.run(["history", "add", "--region", "cz-bohemia", "--from", "1867", "--kind", "epidemic", ...TEXTS("Hledejte v matrice", "Look in the register", "Suchen Sie"), "--url", `${srv.base}/lhota`, "--quote", "Roku 1867 se cholera vrátila."], { env: AGENT })).err, /addresses the person/);

    const r = await answer(w);
    assert.deepEqual(r.places.Lhota.events.sort(), ["cz-bohemia-0001", "cz-czsk-0001"], "1950 is after Lhota left the region");
    assert.equal(r.places.Lhota.state, "pending", "its regions not done yet");
    assert.equal(r.places["Lhota u Brna"].state, "unlocated");
    const ev = r.events.find((e: any) => e.id === "cz-bohemia-0001");
    assert.equal(ev.region.name.cs, "Čechy");
    assert.equal(ev.source.title, "Dějiny Lhoty");
    assert.equal(ev.source.lang, "cs");
    assert.match(ev.source.checked, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(ev.sha, undefined);
    assert.equal(ev.source.sha, undefined, "the page's hash is the research's own");
    assert.equal(r.state.search, "done");
    assert.equal(r.lang, "cs");
    await w.ok(["history", "done", "cz-bohemia"], { env: AGENT });
    await w.ok(["history", "done", "cz-czsk"], { env: AGENT });
    const done = await answer(w);
    assert.equal(done.places.Lhota.state, undefined);
    assert.equal(done.state.pending, 0);
    // a place mapped only to a region with nothing in its years, done: no event, its regions and people still there (R1)
    await w.ok(["event", "add", "P0001", "RESI", "--date", "1990", "--place", "Nová Lhota"]);
    await w.ok(["history", "map", "Nová Lhota", "--region", "cz-czsk:1918-1992"]);
    assert.ok((await answer(w)).places["Nová Lhota"].events.includes("cz-czsk-0001"));
    await w.ok(["history", "map", "Nová Lhota", "--region", "cz-bohemia:1990-"]);
    assert.deepEqual((await answer(w)).places["Nová Lhota"], { events: [], regions: [{ id: "cz-bohemia", from: 1990 }], persons: 1 }, "done, nothing in its years");
    assert.equal((await w.run(["check"])).code, 0);
  } finally {
    srv.close();
    w.cleanup();
  }
});

test("history: the same event never twice; --same-as, --distinct, --replaces; what the person hid holds on what replaced it", opts, async () => {
  const srv = await pages();
  const w = await world();
  try {
    await regions(w);
    const add = (from: string, kind: string, quote: string, more: string[] = []) =>
      w.run(["history", "add", "--region", "cz-bohemia", "--from", from, "--kind", kind, ...TEXTS("Cholera", "Cholera", "Cholera"), "--url", `${srv.base}/lhota`, "--quote", quote, ...more], { env: AGENT });
    assert.equal((await add("1866", "epidemic", "V roce 1866 zasáhla Lhotu epidemie cholery")).code, 0);
    // (another event said, so the page is read: the same kind and years alone is refused before any request)
    const again = await add("1866", "epidemic", "zemřelo 42 obyvatel … V roce 1866 zasáhla", ["--distinct", "jiná vlna"]);
    assert.notEqual(again.code, 0);
    // a quote's parts must come in order
    assert.match(again.err, /not on the page/);
    const twice = await add("1866", "epidemic", "1866 zasáhla Lhotu … zemřelo 42");
    assert.match(twice.err, /same kind and years is there already: cz-bohemia-0001/);
    assert.match(twice.err, /--same-as cz-bohemia-0001/);
    assert.equal((await add("1866", "epidemic", "1866 zasáhla Lhotu … zemřelo 42", ["--same-as", "cz-bohemia-0001"])).code, 0);
    assert.equal(catalog(w, "cz-bohemia").events.length, 1);
    assert.equal(catalog(w, "cz-bohemia").events[0].sources.length, 1, "one more source of it");
    assert.equal((await add("1866", "epidemic", "Povodeň roku 1866 vzala mlýn.", ["--distinct", "a flood, not the cholera"])).code, 0);
    assert.equal(catalog(w, "cz-bohemia").events[1].distinct, "a flood, not the cholera");
    // the person hides it at the place and at a person; an agent may not
    assert.equal((await w.run(["history", "hide", "cz-bohemia-0001", "--place", "Lhota"], { env: AGENT })).code, 4);
    assert.equal((await w.run(["history", "redo", "cz-bohemia"], { env: AGENT })).code, 4);
    assert.match((await w.ok(["history", "hide", "cz-bohemia-0001", "--place", "Lhota"])).out, /Skryto: cz-bohemia-0001 – Lhota/);
    await w.ok(["history", "hide", "cz-bohemia-0001", "--person", "P0001"]);
    assert.match((await w.ok(["history", "hide", "cz-bohemia-0001", "--person", "P0001"])).out, /Beze změny/);
    assert.notEqual((await w.run(["history", "hide", "cz-bohemia-0099", "--place", "Lhota"])).code, 0, "no such event");
    assert.notEqual((await w.run(["history", "hide", "cz-bohemia-0001", "--person", "P0099"])).code, 0, "no such person");
    await w.ok(["history", "hide", "cz-bohemia-0002", "--place", "Lhota z aplikace"]);
    await w.ok(["history", "show", "cz-bohemia-0002", "--place", "Lhota z aplikace"]);
    // replaced by a better one: the old taken back, the hides on it hold on the new
    const rep = await add("1866", "epidemic", "V roce 1866 zasáhla Lhotu epidemie cholery – zemřelo 42 obyvatel.", ["--replaces", "cz-bohemia-0001", "--distinct", "the cholera, not the flood"]);
    assert.equal(rep.code, 0, rep.err);
    assert.match(rep.out, /cz-bohemia-0001 taken back: cz-bohemia-0003/);
    const r = await answer(w);
    assert.ok(!r.events.some((e: any) => e.id === "cz-bohemia-0001"), "taken back: never sent");
    assert.deepEqual(r.hidden.map((h: any) => [h.event, h.place ?? h.person]).sort(), [["cz-bohemia-0003", "Lhota"], ["cz-bohemia-0003", "P0001"]]);
    // shown again by the new ID or the old, hidden by either never twice; answered with the new ID as the app reads it
    const pairs = (hidden: any[]) => hidden.map((h: any) => [h.event, h.place ?? h.person]).sort();
    const shownNew = (await w.ok(["history", "show", "cz-bohemia-0003", "--place", "Lhota", "--json"])).json;
    assert.deepEqual(pairs(shownNew.hidden), [["cz-bohemia-0003", "P0001"]]);
    assert.deepEqual(pairs((await answer(w)).hidden), [["cz-bohemia-0003", "P0001"]], "shown again: out of the answer");
    await w.ok(["history", "hide", "cz-bohemia-0003", "--place", "Lhota"]);
    assert.match((await w.ok(["history", "hide", "cz-bohemia-0001", "--place", "Lhota"])).out, /Beze změny/, "the old ID: hidden already on the new");
    assert.match((await w.ok(["history", "hide", "cz-bohemia-0003", "--person", "P0001"])).out, /Beze změny/, "the new ID: hidden already on the old");
    const shownOld = (await w.ok(["history", "show", "cz-bohemia-0001", "--person", "P0001", "--json"])).json;
    assert.deepEqual(pairs(shownOld.hidden), [["cz-bohemia-0003", "Lhota"]]);
    await w.ok(["history", "hide", "cz-bohemia-0003", "--person", "P0001"]);
    assert.equal(readJsonFile(path.join(w.cwd, "history", "hidden.json")).hidden.length, 2, "no hide twice");
    if (process.platform !== "win32") {
      // the bridge: shown again by the ID GET /history gives, answered with the same IDs as GET /history
      const info = (await w.ok(["live", "start", "--json"])).json as { url: string };
      try {
        const call = async (method: string, url: string, body?: unknown) => {
          const res = await fetch(url, { method, headers: { Origin: "https://beta.stromapp.info", ...(body ? { "Content-Type": "text/plain; charset=utf-8" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
          return { status: res.status, body: (await res.json()) as any };
        };
        const before = await call("GET", `${info.url}/history`);
        assert.deepEqual(pairs(before.body.hidden), [["cz-bohemia-0003", "Lhota"], ["cz-bohemia-0003", "P0001"]]);
        const shown = await call("POST", `${info.url}/history/hide`, { event: "cz-bohemia-0003", place: "Lhota", do: "show" });
        assert.equal(shown.status, 200);
        assert.deepEqual(pairs(shown.body.hidden), [["cz-bohemia-0003", "P0001"]]);
        assert.deepEqual(pairs((await call("GET", `${info.url}/history`)).body.hidden), pairs(shown.body.hidden), "the answer as GET /history");
        const hid = await call("POST", `${info.url}/history/hide`, { event: "cz-bohemia-0003", place: "Lhota" });
        assert.deepEqual(pairs(hid.body.hidden), [["cz-bohemia-0003", "Lhota"], ["cz-bohemia-0003", "P0001"]]);
      } finally {
        await w.run(["live", "stop"]);
      }
      assert.equal(readJsonFile(path.join(w.cwd, "history", "hidden.json")).hidden.length, 2);
    }
    // looked for again on the person's word: what was found stays, the hides too
    await w.ok(["history", "done", "cz-bohemia"], { env: AGENT });
    await w.ok(["history", "redo", "cz-bohemia"]);
    assert.equal(catalog(w, "cz-bohemia").done, undefined);
    assert.equal((await answer(w)).hidden.length, 2);
    // taken back for good: out of the answer, the hide kept in the tree
    await w.ok(["history", "retract", "cz-bohemia-0003", "--why", "the page says otherwise"], { env: AGENT });
    const gone = await answer(w);
    assert.ok(!gone.events.some((e: any) => e.id === "cz-bohemia-0003"));
    assert.equal(gone.hidden.length, 0);
    assert.equal(readJsonFile(path.join(w.cwd, "history", "hidden.json")).hidden.length, 2);
    // the hides by the bridge's rev: it moves with what the app reads
    const rev = gone.state.rev;
    await w.ok(["history", "hide", "cz-bohemia-0002", "--place", "Lhota"]);
    assert.notEqual((await answer(w)).state.rev, rev);
    assert.equal((await w.run(["check"])).code, 0);
    assert.equal((await w.run(["verify"])).code, 0);
  } finally {
    srv.close();
    w.cleanup();
  }
});

test("history: an event the person deleted is never written again by the research — not the same, not --same-as or --replaces it; --distinct only from another address", opts, async () => {
  const srv = await pages();
  const w = await world();
  try {
    await regions(w);
    const add = (from: string, kind: string, quote: string, more: string[] = [], page = "lhota") =>
      w.run(["history", "add", "--region", "cz-bohemia", "--from", from, "--kind", kind, ...TEXTS("Cholera", "Cholera", "Cholera"), "--url", `${srv.base}/${page}`, "--quote", quote, "--json", ...more], { env: AGENT });
    assert.equal((await add("1866", "epidemic", "V roce 1866 zasáhla Lhotu epidemie cholery")).code, 0);
    assert.equal((await add("1921", "census", "Sčítání lidu roku 1921")).code, 0);
    await w.ok(["history", "delete", "cz-bohemia-0001"]);
    const hits = srv.hits["/lhota"];
    let r = await add("1866", "epidemic", "V roce 1866 zasáhla Lhotu epidemie cholery");
    assert.notEqual(r.code, 0);
    assert.equal(r.json.code, "history.deleted");
    assert.match(r.json.message, /deleted by the person: cz-bohemia-0001/);
    assert.equal(srv.hits["/lhota"], hits, "refused before any request");
    r = await add("1866", "epidemic", "Povodeň roku 1866 vzala mlýn.", ["--distinct", "a flood"]);
    assert.equal(r.json.code, "history.deleted", "--distinct from the same address: no");
    for (const more of [["--same-as", "cz-bohemia-0001"], ["--replaces", "cz-bohemia-0001", "--distinct", "better"]]) {
      r = await add("1866", "epidemic", "V roce 1866 zasáhla Lhotu epidemie cholery", more);
      assert.equal(r.json.code, "history.deleted", more.join(" "));
    }
    assert.equal(catalog(w, "cz-bohemia").events.length, 2, "nothing written");
    // another event of the same kind and years from another address: written
    r = await add("1866", "epidemic", "Povodeň roku 1866 vzala mlýn.", ["--distinct", "a flood, not the cholera"], "lhota-jinde");
    assert.equal(r.code, 0, r.err);
    // restored: the same is the same again (history.same), as before
    await w.ok(["history", "restore", "cz-bohemia-0001"]);
    r = await add("1866", "epidemic", "V roce 1866 zasáhla Lhotu epidemie cholery");
    assert.equal(r.json.code, "history.same");
    assert.equal((await w.run(["check"])).code, 0);
  } finally {
    srv.close();
    w.cleanup();
  }
});

test("history: a local event read in the tree's own record — its image, its transcript, its years", opts, async () => {
  const w = await world();
  try {
    await w.ok(["recordset", "add", "Matrika Lhota Z 1840–1870", "--kinds", "burial", "--places", "Lhota", "--years", "1840-1870", "--images", "4"]); // B0001
    const dir = fs.mkdtempSync(path.join(w.dir, "snímky-"));
    fs.writeFileSync(path.join(dir, "obr-001.jpg"), encodeJpeg(blank(60, 40, 1, 120), 85));
    await w.ok(["media", "add", dir, "--recordset", "B1"]);
    await w.ok(["source", "add", "Poznámka faráře 1842", "--kind", "burial", "--recordset", "B1", "--locator", "fol. 1"]); // S0001
    await w.ok(["source", "add", "Pohřby Lhota 1842", "--kind", "burial", "--recordset", "B1", "--locator", "fol. 1", "--media", "B1:1", "--transcript", "Anno 1842 ignis …"]); // S0002
    const local = (src: string, from: string, more: string[] = []) => w.run(["history", "local", "--source", src, "--from", from, "--kind", "disaster", "--text", "Požár vsi", ...more], { env: AGENT });
    assert.match((await local("S0001", "1842")).err, /no image/);
    assert.match((await local("S0002", "1880")).err, /not within the years/);
    const ok = await local("S0002", "1842");
    assert.equal(ok.code, 0, ok.err);
    assert.match((await local("S0002", "1842")).err, /same kind and years is there already: L0001/);
    const r = await answer(w);
    const ev = r.events.find((e: any) => e.id === "L0001");
    assert.equal(ev.scope, "local");
    assert.deepEqual(ev.local, { source: "S0002", cite: "Pohřby Lhota 1842" });
    assert.equal(ev.text.cs, "Požár vsi");
    assert.ok(r.places.Lhota.events.includes("L0001"));
    // deleted by the person: in this tree only, said with its place; never again, not even --distinct
    const del = (await w.ok(["history", "delete", "L0001", "--json"])).json;
    assert.equal(del.scope, "local");
    assert.match((await w.ok(["history", "restore", "L0001"])).out, /Obnoveno: L0001/);
    assert.match((await w.ok(["history", "delete", "L0001"])).out, /Smazáno: L0001 – jen v tomto stromu/);
    const after = await answer(w);
    assert.ok(!after.events.some((e: any) => e.id === "L0001"));
    assert.deepEqual(after.deleted.map((d: any) => [d.event, d.scope, d.local.source]), [["L0001", "local", "S0002"]]);
    const again = (await local("S0002", "1842", ["--distinct", "jiný požár", "--json"])).json;
    assert.match(again.code, /^history\.deleted$/);
    // its source is the record itself: no other address to try — the hint never sends the agent to --distinct
    assert.doesNotMatch(again.hint, /--distinct|another address/);
    assert.match(again.hint, /leave it out/);
    assert.equal((await w.run(["check"])).code, 0);
  } finally {
    w.cleanup();
  }
});

test("history: the tree's files are sealed — a hand edit is an error of check; tidy leaves them alone", opts, async () => {
  const w = await world();
  try {
    await regions(w);
    const file = path.join(w.cwd, "history", "places.json");
    const cat = path.join(shared(w), "history", "regions", "cz-bohemia.json");
    const keep = fs.readFileSync(cat, "utf8");
    await w.run(["tidy"], { tty: true, answers: ["a"] });
    assert.ok(fs.existsSync(file));
    assert.equal(fs.readFileSync(cat, "utf8"), keep, "the shared catalog untouched");
    const v = await w.run(["verify", "--json"]);
    assert.equal(v.code, 0, v.out);
    fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("cz-bohemia", "cz-moravia"));
    const bad = await w.run(["check"]);
    assert.notEqual(bad.code, 0);
    assert.match(bad.out + bad.err, /history\/places\.json/);
    const full = await w.run(["verify"]);
    assert.notEqual(full.code, 0);
    assert.match(full.out + full.err, /history\/places\.json/);
  } finally {
    w.cleanup();
  }
});

test("history: archive — the agent's work refused, the search waits and says why in the research language; another tree holding the region", opts, async () => {
  const w = await world();
  try {
    await w.ok(["history", "region", "cz-bohemia", ...NAMES("Čechy", "Bohemia", "Böhmen")]);
    const cat = path.join(shared(w), "history", "regions", "cz-bohemia.json");
    const c = JSON.parse(fs.readFileSync(cat, "utf8"));
    c.holder = { tree: "another-tree", since: new Date().toISOString() };
    fs.writeFileSync(cat, JSON.stringify(c));
    await w.ok(["history", "map", "Lhota", "--region", "cz-bohemia"]);
    const held = await answer(w);
    assert.equal(held.state.search, "waiting");
    assert.equal(held.state.why, "Události regionu Čechy hledá jiný výzkum na tomto počítači.");
    await w.ok(["mode", "archive"], { tty: true, answers: ["a"] });
    const arch = await answer(w);
    assert.equal(arch.state.search, "waiting");
    assert.equal(arch.state.why, "Dokud je výzkum vedený jako archiv, nic se nehledá.");
    assert.notEqual((await w.run(["history", "map", "Lhota u Brna", "--unlocated"], { env: AGENT })).code, 0);
  } finally {
    w.cleanup();
  }
});

test("history: packed with the research — the catalogs of its regions merged where they are unpacked, nothing written over", opts, async () => {
  const srv = await pages();
  const w = await world();
  try {
    await regions(w);
    await w.ok(["history", "add", "--region", "cz-bohemia", "--from", "1866", "--kind", "epidemic", ...TEXTS("Cholera", "Cholera", "Cholera"), "--url", `${srv.base}/lhota`, "--quote", "V roce 1866 zasáhla Lhotu epidemie cholery"], { env: AGENT });
    await w.ok(["history", "hide", "cz-bohemia-0001", "--person", "P0001"]);
    const zip = path.join(w.dir, "balík.zip");
    await w.ok(["pack", "--out", zip]);
    const b = new World();
    await b.ok(["setup", "--yes"]);
    // b has a catalog of the region of its own already: an event of its own stays, the package's is added
    const own = { region: { id: "cz-bohemia", name: { cs: "Čechy", en: "Bohemia", de: "Böhmen" } }, next: 3, events: [{ id: "cz-bohemia-0002", from: 1900, to: 1900, kind: "other", text: { cs: "Jiné", en: "Other", de: "Andere" }, source: { title: "t", url: "https://example.org/", checked: "2026-10-01", quote: "1900", sha: "x" }, by: "b", at: "2026-10-01T00:00:00Z" }], tried: [] };
    const bc = path.join(shared(b), "history", "regions", "cz-bohemia.json");
    fs.mkdirSync(path.dirname(bc), { recursive: true });
    fs.writeFileSync(bc, JSON.stringify(own));
    await b.ok(["unpack", zip], { answers: ["a"] });
    const root = b.treeDir("Lhotákovi");
    assert.match((await b.ok(["check"], { cwd: root })).out, /^ok/);
    const merged = catalog(b, "cz-bohemia");
    assert.deepEqual(merged.events.map((e: any) => e.id), ["cz-bohemia-0001", "cz-bohemia-0002"]);
    assert.equal(merged.next, 3);
    assert.ok(fs.existsSync(path.join(shared(b), "history", "regions", "cz-czsk.json")), "a region b had not: taken");
    await b.ok(["config", "set", "experiments.history", "on"], { tty: true, answers: ["a"] });
    const r = await answer(b, root);
    assert.ok(r.places.Lhota.events.includes("cz-bohemia-0001"));
    assert.equal(r.hidden[0].person, "P0001");
    b.cleanup();
  } finally {
    srv.close();
    w.cleanup();
  }
});

function strom(w: World, cwd: string, args: string[]): Promise<{ code: number; out: string; err: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args], { cwd, env: { ...w.env, ...AGENT }, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (code) => resolve({ code: code ?? 1, out, err }));
  });
}

test("history: two trees write into one region's catalog at once — every event kept, the IDs unique", { ...opts, timeout: 240_000 }, async () => {
  const srv = await pages();
  const w = await world();
  try {
    const a = w.cwd;
    await w.ok(["init", "Lhotští"]);
    const b = w.treeDir("Lhotští");
    await w.ok(["person", "add", "Anna /Lhotská/", "--sex", "F"], { cwd: b });
    await w.ok(["event", "add", "P0001", "BIRT", "--date", "1860", "--place", "Lhota"], { cwd: b });
    // both trees make the same new region and map their places to it at once
    const maps = await Promise.all([a, b].map((cwd) => strom(w, cwd, ["history", "map", "Lhota", "--region", "cz-bohemia", ...NAMES("Čechy", "Bohemia", "Böhmen")])));
    for (const m of maps) assert.ok(m.code === 0 || /every region given is there/.test(m.err), m.err);
    for (const [cwd, m] of [[a, maps[0]!], [b, maps[1]!]] as const) if (m.code !== 0) await w.ok(["history", "map", "Lhota", "--region", "cz-bohemia"], { cwd });
    const q = ["V roce 1866 zasáhla Lhotu epidemie cholery", "Sčítání lidu roku 1921 zapsalo ve Lhotě 312 obyvatel.", "Roku 1950 byla ve Lhotě založena družstva.", "V letech 1914–1918 odešlo z Lhoty na frontu 30 mužů.", "Roku 1867 se cholera vrátila.", "Povodeň roku 1866 vzala mlýn."];
    const y = [["1866", "epidemic"], ["1921", "census"], ["1950", "economy"], ["1914", "war", "1918"], ["1867", "other"], ["1866", "disaster"]];
    const runs = await Promise.all(
      q.map((quote, i) => {
        const [from, kind, to] = y[i]!;
        return strom(w, i % 2 ? b : a, ["history", "add", "--region", "cz-bohemia", "--from", from!, ...(to ? ["--to", to] : []), "--kind", kind!, ...TEXTS("Událost", "An event", "Ein Ereignis"), "--url", `${srv.base}/lhota`, "--quote", quote]);
      }),
    );
    for (const r of runs) assert.equal(r.code, 0, r.err);
    const c = catalog(w, "cz-bohemia");
    assert.equal(c.events.length, 6);
    assert.equal(new Set(c.events.map((e: any) => e.id)).size, 6);
    assert.equal(c.next, 7);
    assert.deepEqual(new Set(c.events.map((e: any) => e.by)).size, 2, "both trees wrote");
    for (const cwd of [a, b]) {
      assert.equal((await answer(w, cwd)).events.length, 6);
      assert.equal((await w.run(["check"], { cwd })).code, 0);
    }
  } finally {
    srv.close();
    w.cleanup();
  }
});
