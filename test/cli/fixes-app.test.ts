// strom's fixes for the Strom app: GET <token>/fixes in the bridge — each check's title and summary in cs/en/de, its
// state as strom names it, the count found, whether it can be put back, when decided, what it would take — free (no
// agent, no network, nothing written); in an archive only what rewrites, nothing of an agent. The link
// strom-research://fixes opens them in the terminal: only an id of strom's own taken, set right or put back only on the
// person's word there.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { owners } from "../../src/core/participants.ts";
import { LINK_FIX_IDS, LinkError, linkActions, linkText, parseLink } from "../../src/core/links.ts";
import { FIX_CHECKS } from "../../src/commands/fixchecks.ts";
import type { Event } from "../../src/core/model.ts";

const bridged = { skip: !hasGit || process.platform === "win32", timeout: 180_000 };
const opts = { skip: !hasGit, timeout: 180_000 };
const APP = "https://beta.stromapp.info";
const ID = "0f8c2d4e-1b2a-4c3d-9e8f-7a6b5c4d3e2f";
const AI = /agent|\bAI\b|umělá inteligence|Claude|Codex|OpenCode|Grok|Antigravity|\bmodel|\bKI\b|künstliche/i;

const head = (w: World) => execFileSync("git", ["-C", w.cwd, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const dirty = (w: World) => execFileSync("git", ["-C", w.cwd, "status", "--porcelain"], { encoding: "utf8" });

function get(url: string): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { agent: false, headers: { Origin: APP } }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (d) => (text += d));
      res.on("end", () => {
        let body: any = text;
        try {
          body = JSON.parse(text);
        } catch {
          // not JSON
        }
        resolve({ status: res.statusCode ?? 0, body });
      });
    });
    req.on("error", reject);
    req.end();
  });
}

/** The Lhotáks: Jan with two facts an older strom wrote with the street in the place (street-places finds them). */
async function lhotaci(w: World): Promise<string> {
  await w.withTree("Lhotákovi");
  const jan = (await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M", "--json"])).json.person.id;
  const a = (await w.ok(["event", "add", jan, "RESI", "--date", "1871", "--place", "Lhota", "--json"])).json.event.id as string;
  const b = (await w.ok(["event", "add", jan, "RESI", "--date", "1880", "--place", "Lhota", "--json"])).json.event.id as string;
  const tree = Tree.open(w.cwd, w.env);
  tree.withTreeLock(() => {
    for (const [id, place] of [[a, "Lhota, Dlouhá 12"], [b, "Lhota, Polní 5".normalize("NFD")]] as const) {
      const owner = structuredClone(owners(tree).find((o) => o.events.some((e) => e.id === id))!);
      (owner.events.find((x) => x.id === id) as Event).place = place;
      tree.put(owner, { op: "event.update", targets: [id], summary: `${id}: place as an older strom took it` });
    }
    tree.commit("Places as an older strom wrote them");
  });
  return Tree.open(w.cwd, w.env).config.id;
}

test("the link fixes: all, one of strom's own by its id, put back; a bad id, a do without an id or another do refused; text never taken", () => {
  assert.deepEqual([...LINK_FIX_IDS], FIX_CHECKS.map((c) => c.id), "the link's ids are the checks'");
  assert.ok(linkActions("ours").includes("fixes"));
  assert.deepEqual(parseLink(`strom-research://fixes?tree=${ID}`), { action: "fixes", tree: ID });
  assert.deepEqual(parseLink(`strom-research://fixes?tree=${ID}&id=street-places`), { action: "fixes", tree: ID, id: "street-places" });
  assert.deepEqual(parseLink(`strom-research://fixes?tree=${ID}&id=app-shapes&do=undo`), { action: "fixes", tree: ID, id: "app-shapes", do: "undo" });
  // a text the link brings is never taken (only the id and the fixed value)
  const taken = parseLink(`strom-research://fixes?tree=${ID}&id=street-places&title=${encodeURIComponent("Lhota, Dlouhá — přepsat")}&say=hello`);
  assert.deepEqual(taken, { action: "fixes", tree: ID, id: "street-places" });
  assert.equal(linkText(taken), `strom-research://fixes?tree=${ID}&id=street-places`);
  for (const bad of ["street", "Street-Places", "street-places;rm", "../street-places", "ulice-v-místech", "ŠTREET", "%D0%BB%D1%85%D0%BE%D1%82%D0%B0", ""])
    assert.throws(() => parseLink(`strom-research://fixes?tree=${ID}&id=${bad}`), LinkError, bad);
  assert.throws(() => parseLink(`strom-research://fixes?tree=${ID}&do=undo`), LinkError, "put back, but what");
  for (const what of ["run", "decline", "yes", "UNDO"]) assert.throws(() => parseLink(`strom-research://fixes?tree=${ID}&id=street-places&do=${what}`), LinkError, what);
  assert.throws(() => parseLink(`strom-research://fixes?tree=not-a-tree&id=street-places`), LinkError);
});

test("the bridge: GET /fixes — every check in cs/en/de, its state, count, undoable, when, what it would take; free, nothing written; an archive only what rewrites, nothing of an agent", bridged, async () => {
  const w = new World();
  await lhotaci(w);
  const before = { head: head(w), config: fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8"), dirty: dirty(w) };
  const cache = path.join(w.cwd, ".strom", "cache");
  const cached = () => (fs.existsSync(cache) ? fs.readdirSync(cache).sort() : []);
  const kept = cached();
  let info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const status = (await get(`${info.url}/status`)).body;
    assert.ok(status.features.includes("fixes.list"), JSON.stringify(status.features));
    const r = await get(`${info.url}/fixes`);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.match(r.body.rev, /\S/);
    assert.deepEqual(r.body.fixes.map((f: any) => f.id), FIX_CHECKS.map((c) => c.id));
    for (const f of r.body.fixes) {
      for (const field of ["title", "summary"]) {
        assert.deepEqual(Object.keys(f[field]).sort(), ["cs", "de", "en"], `${f.id} ${field}`);
        for (const lang of ["cs", "de", "en"]) assert.ok(f[field][lang].trim(), `${f.id} ${field} ${lang}`);
      }
      assert.notEqual(f.title.cs, f.title.en, `${f.id}: its own words in Czech`);
      assert.ok(["pending", "declined", "fixed", "nothing"].includes(f.state), f.state);
      assert.equal(typeof f.count, "number");
      assert.equal(typeof f.undoable, "boolean");
      assert.ok(f.cost === undefined || ["free", "cheap", "medium", "expensive"].includes(f.cost), f.cost);
    }
    const street = r.body.fixes.find((f: any) => f.id === "street-places");
    assert.deepEqual([street.state, street.count, street.undoable, street.cost, street.at], ["pending", 2, false, "free", undefined]);
    assert.equal(street.title.cs, "Ulice a čísla domů v místech údajů");
    // the records it is of, for a link from what the app shows (Jan's facts): IDs only, no undone yet
    assert.deepEqual(Object.keys(street.targets), ["persons"]);
    assert.match(street.targets.persons[0], /^P\d+$/u);
    assert.equal(street.targets.persons.length, 1);
    assert.equal(street.undone, undefined);
    // the checks that would read again: nothing to read here, nothing run, no cost said
    for (const id of ["blind-reduced", "new-model"]) {
      const f = r.body.fixes.find((x: any) => x.id === id);
      assert.deepEqual([f.state, f.count, f.undoable, f.cost], ["nothing", 0, false, undefined], id);
    }
    // asked again: the same answer; and nothing written by either
    assert.deepEqual((await get(`${info.url}/fixes`)).body, r.body);
    assert.deepEqual({ head: head(w), config: fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8"), dirty: dirty(w) }, before, "nothing written");
    assert.deepEqual(cached(), kept, "nothing kept for the research either");
    assert.equal((await get(`${info.url}/fixes/street-places`)).status, 404, "a list only");

    // set right by the person at the terminal: fixed, when, can be put back; the bridge says so at once
    await w.ok(["fixes", "run", "street-places"], { tty: true, answers: ["1"] });
    const after = (await get(`${info.url}/fixes`)).body;
    assert.notEqual(after.rev, r.body.rev);
    const done = after.fixes.find((f: any) => f.id === "street-places");
    assert.deepEqual([done.state, done.count, done.undoable], ["fixed", 0, true]);
    assert.ok(Date.now() - Date.parse(done.at) < 120_000, done.at);
    assert.equal(done.undone, undefined);
    assert.equal(done.targets, undefined, "nothing found any more");

    // put back by the person: declined, said as put back (not left as it was from the start), when
    await w.ok(["fixes", "undo", "street-places"], { tty: true, answers: ["y"] });
    const back = (await get(`${info.url}/fixes`)).body.fixes.find((f: any) => f.id === "street-places");
    assert.deepEqual([back.state, back.undone, back.undoable], ["declined", true, false]);
    assert.ok(Date.parse(back.at) >= Date.parse(done.at), back.at);

    // an archive: only what rewrites, nothing of an agent in any language
    await w.ok(["live", "stop"]);
    await w.ok(["mode", "archive"], { tty: true, answers: ["y"] });
    info = (await w.ok(["live", "start", "--json"])).json;
    const archived = (await get(`${info.url}/fixes`)).body;
    assert.deepEqual(archived.fixes.map((f: any) => f.id), ["participant-names", "app-shapes", "street-places"]);
    assert.doesNotMatch(JSON.stringify(archived), AI);
    assert.ok((await get(`${info.url}/status`)).body.features.includes("fixes.list"));
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("the link fixes in the terminal: shown, set right only on the person's word (Enter: nothing); put back asked first; a paid check refused where nobody reads", opts, async () => {
  const w = new World();
  try {
    const id = await lhotaci(w);
    const open = (query: string, answers: string[]) => w.run(["link", "open", `strom-research://fixes?tree=${id}${query}`], { tty: true, answers });
    const n = head(w);
    // Enter at the choice: later, nothing changed
    await open("&id=street-places", ["", ""]);
    assert.equal(head(w), n, "nothing set right without the person's word");
    // the person's word: set right
    const set = await open("&id=street-places", ["1", ""]);
    assert.equal(set.code, 0, set.out + set.err);
    assert.notEqual(head(w), n);
    assert.equal(Tree.open(w.cwd, w.env).config.fixes?.["street-places"]?.decision, "fixed", JSON.stringify(Tree.open(w.cwd, w.env).config.fixes));
    const fixed = head(w);
    // put back: shown, then asked; Enter says no
    const no = await open("&id=street-places&do=undo", ["", ""]);
    assert.match(no.out, /Aplikace Strom žádá: vrátit, co oprava „Ulice a čísla domů v místech údajů“ opravila/);
    assert.equal(head(w), fixed, "nothing put back on Enter");
    await open("&id=street-places&do=undo", ["a", ""]);
    assert.notEqual(head(w), fixed, "put back on the person's yes");
    // no fix named: the list
    const list = await open("", [""]);
    assert.match(list.out, /Ulice a čísla domů v místech údajů/);
    // a paid check where nobody reads: one sentence, nothing of it run
    await w.ok(["mode", "archive"], { tty: true, answers: ["y"] });
    const paid = await open("&id=new-model", [""]);
    assert.doesNotMatch(paid.out, AI);
    assert.match(paid.out, /archiv/i);
    // a bad id: only said
    const bad = await w.run(["link", "open", `strom-research://fixes?tree=${id}&id=everything`], { tty: true, answers: [""] });
    assert.doesNotMatch(bad.out + bad.err, /everything/);
  } finally {
    w.cleanup();
  }
});
