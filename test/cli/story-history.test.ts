// The history of the places in the stories (stories.history, K6): with the history on, the brief of a story lists the
// events of the years its people lived at the places of their facts — a region's and the local ones, each with its
// source — never what the person hid or deleted, nor of other years; strom story set cites them (--history), only
// those. The setting turns it off (default on while the history is on); an approved story is never rewritten for it.
// The bridge says it (/status.stories) and turns it both ways (POST /stories), never the history itself on.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { storyHistory } from "../../src/core/pastevents.ts";
import { storyProposals } from "../../src/core/stories.ts";
import { encodeJpeg } from "../../src/image/jpeg-encode.ts";
import { blank } from "../../src/image/image.ts";
import type { Research } from "../../src/core/model.ts";

const opts = { skip: !hasGit, timeout: 180_000 };
const AGENT = { CLAUDECODE: "1" };
const NAMES = ["--name-cs", "Lhotsko", "--name-en", "Lhota Land", "--name-de", "Lhotaland"];
const PLACE = "Lhotečka";

function catalogFile(w: World): string {
  return path.join(w.home, "shared", "history", "regions", "cz-lhota.json");
}

/** Events written into the shared catalog as a session of history would have. */
function writeEvents(w: World, events: [n: number, year: number, kind: string, text: string][]): void {
  const c = readJsonFile(catalogFile(w));
  const source = { title: "Dějiny Lhotska", url: "https://example.org/lhotsko", checked: "2026-10-01", quote: "1866", sha: "0".repeat(64) };
  c.events = events.map(([n, from, kind, text]) => ({ id: `cz-lhota-${String(n).padStart(4, "0")}`, from, to: from, kind, text: { cs: text, en: `${text} (en)`, de: text }, source, by: "x", at: "2026-10-01T00:00:00Z" }));
  c.next = events.length + 1;
  fs.writeFileSync(catalogFile(w), JSON.stringify(c));
}

/** Jan Lhoták, born 1850 at Lhotečka, died 1925 there; the place in cz-lhota from 1800; a narrate task of him. */
async function world(): Promise<{ w: World; task: string }> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["research", "new", "Předci Jana Lhotáka", "--new-person", "Jan /Lhoták/", "--sex", "M", "--born", "1850", "--born-place", PLACE]);
  await w.ok(["event", "add", "P0001", "DEAT", "--date", "1925", "--place", PLACE]);
  await w.ok(["config", "set", "experiments.history", "on"], { tty: true, answers: ["a"] });
  await w.ok(["history", "region", "cz-lhota", ...NAMES]);
  await w.ok(["history", "map", PLACE, "--region", "cz-lhota:1800-"]);
  writeEvents(w, [
    [1, 1866, "epidemic", "Cholera v kraji"],
    [2, 1700, "war", "Válka dávno před ním"],
    [3, 1950, "economy", "Nové cesty po jeho smrti"],
    [4, 1921, "census", "Sčítání lidu"],
    [5, 1880, "economy", "Zlá krize"],
    [6, 1900, "other", "Nová silnice"],
  ]);
  // a local event read in the tree's own record of the place
  await w.ok(["recordset", "add", "Matrika Lhotečka Z 1840–1870", "--kinds", "burial", "--places", PLACE, "--years", "1840-1870", "--images", "1"]); // B0001
  const dir = fs.mkdtempSync(path.join(w.dir, "snímky-"));
  fs.writeFileSync(path.join(dir, "obr-001.jpg"), encodeJpeg(blank(60, 40, 1, 120), 85));
  await w.ok(["media", "add", dir, "--recordset", "B1"]);
  await w.ok(["source", "add", "Pohřby Lhotečka 1855", "--kind", "burial", "--recordset", "B1", "--locator", "fol. 1", "--media", "B1:1", "--transcript", "Anno 1855 ignis …"]); // S0001
  await w.ok(["history", "local", "--source", "S0001", "--from", "1855", "--kind", "disaster", "--text", "Požár vsi"], { env: AGENT }); // L0001
  const task = (await w.ok(["task", "add", "Vyprávění o Janu Lhotákovi", "--level", "narrate", "--where", "P1", "--why", "a", "--done-when", "b", "--about", "P1", "--priority", "1", "--json"])).json.task.id;
  return { w, task };
}

test("story history: the brief of a story lists the events of the years lived at the places, with their sources — none hidden, deleted or of other years; off by the setting or with the history", opts, async () => {
  const { w, task } = await world();
  try {
    // hidden at the person, deleted by the person, hidden in the whole tree
    await w.ok(["history", "hide", "cz-lhota-0004", "--person", "P0001"]);
    await w.ok(["history", "delete", "cz-lhota-0005"]);
    await w.ok(["history", "hide", "cz-lhota-0006", "--tree"]);
    const brief = (await w.ok(["brief", task])).out;
    assert.match(brief, /## The history of the places: the time they lived in \(2 events of the years at their places; the user may turn it off: stories\.history\)/);
    assert.match(brief, /never as what the person did/);
    assert.match(brief, /  L0001 1855 disaster at Lhotečka aged 5: "Požár vsi" — S0001 /u);
    assert.match(brief, /  cz-lhota-0001 1866 epidemic \(Lhotsko\) at Lhotečka aged 16: "Cholera v kraji" — Dějiny Lhotska https:\/\/example\.org\/lhotsko/u);
    for (const id of ["0002", "0003", "0004", "0005", "0006"]) assert.doesNotMatch(brief, new RegExp(`cz-lhota-${id}`), id);
    // hidden at its one place — written decomposed (NFD): gone too
    await w.ok(["history", "hide", "cz-lhota-0001", "--place", PLACE.normalize("NFD")]);
    assert.deepEqual(storyHistory(Tree.open(w.cwd, w.env), path.join(w.home, "shared"), "P0001").map((e) => e.id), ["L0001"]);
    await w.ok(["history", "show", "cz-lhota-0001", "--place", PLACE]);
    // the setting off for the tree: no history in the brief
    await w.ok(["config", "set", "stories.history", "no", "--for-tree"]);
    assert.doesNotMatch((await w.ok(["brief", task])).out, /The history of the places/);
    assert.equal((await w.ok(["config", "get", "stories.history", "--json"])).json.value, "no");
    await w.ok(["config", "unset", "stories.history", "--for-tree"]);
    assert.match((await w.ok(["brief", task])).out, /The history of the places/);
    // the history of the places off: none either
    await w.ok(["config", "set", "experiments.history", "off", "--for-tree"]);
    assert.doesNotMatch((await w.ok(["brief", task])).out, /The history of the places/);
  } finally {
    w.cleanup();
  }
});

test("story history: story set cites only the events the brief may give (--history), story show says where each is from; a couple's story has its partners' events", opts, async () => {
  const { w } = await world();
  try {
    await w.ok(["history", "hide", "cz-lhota-0004", "--person", "P0001"]);
    const text = "Jan se narodil roku 1850 ve Lhotečce.\n\nKdyž mu bylo šestnáct, přišla do kraje cholera.";
    const set = (more: string[]) => w.run(["story", "set", "P1", "--text", text, ...more, "--json"], { env: AGENT });
    for (const [id, why] of [["cz-lhota-0002", "of other years"], ["cz-lhota-0004", "hidden at the person"], ["cz-lhota-0099", "no such event"]]) {
      const r = await set(["--history", id!]);
      assert.equal(r.code, 2, why);
      assert.equal(r.json.code, "story.history", why);
    }
    const ok = await set(["--history", "cz-lhota-0001", "--history", "l0001"]);
    assert.equal(ok.code, 0, ok.err);
    assert.deepEqual(ok.json.story.history, ["cz-lhota-0001", "L0001"]);
    const show = (await w.ok(["story", "show", "P1"])).out;
    assert.match(show, /the history of the places it tells\n  cz-lhota-0001 1866 Cholera v kraji — Dějiny Lhotska https:\/\/example\.org\/lhotsko\n  L0001 1855 Požár vsi — S0001 /u);
    // the option is the brief's alone: help says nothing of it
    assert.doesNotMatch((await w.ok(["help", "story", "set"])).out, /--history/);
    // the setting off: no history cited
    await w.ok(["config", "set", "stories.history", "no", "--for-tree"]);
    const off = await set(["--history", "cz-lhota-0001"]);
    assert.equal(off.code, 2);
    assert.equal(off.json.code, "story.history.off");
    await w.ok(["config", "unset", "stories.history", "--for-tree"]);
    // a couple: the events of its partners' years, no age (whose?)
    await w.ok(["person", "add", "Marie /Lhotáková/", "--sex", "F", "--born", "1855", "--born-place", PLACE]); // P0002
    await w.ok(["family", "add", "--partner", "P1", "--partner", "P2"]); // F0001
    const couple = storyHistory(Tree.open(w.cwd, w.env), path.join(w.home, "shared"), "F0001");
    // the years of both — the census of 1921 is in Jan's alone, hidden at him; Marie's (a birth only) do not reach it
    assert.deepEqual(couple.map((e) => [e.id, e.age]), [["L0001", undefined], ["cz-lhota-0001", undefined], ["cz-lhota-0005", undefined], ["cz-lhota-0006", undefined]]);
    // only the years both lived (the common ones, not each one's): Marie dead in 1890 — the road of 1900 is Jan's alone
    await w.ok(["event", "add", "P2", "DEAT", "--date", "1890", "--place", PLACE]);
    const common = storyHistory(Tree.open(w.cwd, w.env), path.join(w.home, "shared"), "F0001");
    assert.deepEqual(common.map((e) => e.id), ["L0001", "cz-lhota-0001", "cz-lhota-0005"]);
    assert.ok(storyHistory(Tree.open(w.cwd, w.env), path.join(w.home, "shared"), "P0001").some((e) => e.id === "cz-lhota-0006"), "Jan's own story still tells it");
    assert.match((await w.ok(["check"])).out, /^ok/);
  } finally {
    w.cleanup();
  }
});

test("story history: one person's story keeps the years just before the birth (LIVED_MARGIN); a couple's only the years both lived", opts, async () => {
  const { w } = await world();
  try {
    // a war 3 years before Jan's birth (1850), an event 2 years after it — before Marie's birth (1855)
    const c = readJsonFile(catalogFile(w));
    const more = [[7, 1847, "war", "Válka před jeho narozením"], [8, 1852, "economy", "Zlý rok Lhotska"]] as const;
    c.events.push(...more.map(([n, from, kind, text]) => ({ ...c.events[0], id: `cz-lhota-${String(n).padStart(4, "0")}`, from, to: from, kind, text: { cs: text, en: text, de: text } })));
    c.next = 9;
    fs.writeFileSync(catalogFile(w), JSON.stringify(c));
    const of = (owner: string) => storyHistory(Tree.open(w.cwd, w.env), path.join(w.home, "shared"), owner).map((e) => e.id);
    // one person: as before the couple's rule — 5 years before the first fact, the birth too
    assert.ok(of("P0001").includes("cz-lhota-0007"), "Jan's story tells the war of 1847");
    assert.ok(of("P0001").includes("cz-lhota-0008"));
    await w.ok(["person", "add", "Marie /Lhotáková/", "--sex", "F", "--born", "1855", "--born-place", PLACE]); // P0002
    await w.ok(["family", "add", "--partner", "P1", "--partner", "P2"]); // F0001
    // the couple: from the later birth (Marie's 1855) — neither the war of 1847 nor the bad year of 1852
    const couple = of("F0001");
    assert.ok(!couple.includes("cz-lhota-0007") && !couple.includes("cz-lhota-0008"), couple.join(" "));
    assert.ok(couple.includes("cz-lhota-0001"));
    // Jan's own story unchanged by the marriage
    assert.ok(of("P0001").includes("cz-lhota-0007"));
  } finally {
    w.cleanup();
  }
});

test("story history: an approved story is never rewritten for it — no task proposed for the history alone; written again, the new version waits beside the approved one", opts, async () => {
  const { w, task } = await world();
  try {
    await w.ok(["source", "add", "Křest Jana 1850", "--kind", "baptism", "--information", "primary"]); // S0002
    const facts: string[] = [];
    for (const [kind, more] of [["BAPM", ["--date", "1850", "--place", PLACE]], ["OCCU", ["--value", "mlynář"]], ["RESI", ["--date", "1880", "--place", PLACE]]] as const)
      facts.push((await w.ok(["event", "add", "P1", kind, ...more, "--cite", "S0002", "--status", "proven", "--json"])).json.event.id);
    await w.ok(["story", "set", "P1", "--text", "Jan byl mlynář.", ...facts.flatMap((f) => ["--fact", f]), "--final"]);
    await w.ok(["task", "done", task, "--result", "napsáno"]);
    const tree = Tree.open(w.cwd, w.env);
    const research = tree.list<Research>("research")[0]!;
    // the events of the history are there; nothing new from records: no story proposed
    assert.ok(storyHistory(tree, path.join(w.home, "shared"), "P0001").length > 0);
    assert.deepEqual(storyProposals(tree, research).filter((p) => p.level === "narrate"), []);
    // written again with the history: it waits for the user, the approved one stays
    await w.ok(["story", "set", "P1", "--text", "Jan byl mlynář. Roku 1866 přišla do kraje cholera.", ...facts.flatMap((f) => ["--fact", f]), "--history", "cz-lhota-0001"], { env: AGENT });
    const story = (await w.ok(["story", "show", "P1", "--json"])).json.story;
    assert.equal(story.status, "final");
    assert.equal(story.text, "Jan byl mlynář.");
    assert.equal(story.history, undefined);
    assert.deepEqual(story.draft.history, ["cz-lhota-0001"]);
    // story show says the history the new version tells, under it (the approved one tells none)
    const shown = (await w.ok(["story", "show", "P1"])).out;
    assert.match(shown, /── a new version [^\n]*\n\nJan byl mlynář\. Roku 1866 přišla do kraje cholera\.\n\nthe history of the places it tells\n  cz-lhota-0001 1866 Cholera v kraji — Dějiny Lhotska/u);
    assert.equal(shown.match(/the history of the places it tells/g)?.length, 1, "the approved one tells none");
  } finally {
    w.cleanup();
  }
});

function ask(url: string, opt: { method?: string; body?: string } = {}): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = { Origin: "https://beta.stromapp.info" };
    if (opt.body !== undefined) headers["Content-Type"] = "text/plain; charset=utf-8";
    const req = http.request(url, { agent: false, method: opt.method ?? "GET", headers }, (res) => {
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
    req.end(opt.body);
  });
}
const post = (url: string, body: unknown) => ask(url, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) });

test("bridge: /status.stories says the history in the stories; POST /stories turns it both ways for this tree — never the history itself on (409 history.off with the link)", { ...opts, skip: opts.skip || process.platform === "win32" }, async () => {
  const { w } = await world();
  try {
    const id = readJsonFile(path.join(w.cwd, "strom.json")).id;
    const info = (await w.ok(["live", "start", "--json"])).json as { url: string };
    const status = async () => (await ask(`${info.url}/status`)).body;
    const first = await status();
    assert.ok(first.features.includes("stories.history"));
    assert.deepEqual(first.stories, { history: true });
    const url = `${info.url}/stories`;
    for (const body of ["{}", JSON.stringify({ history: "no" }), JSON.stringify({ history: false, sources: false })]) {
      const r = await post(url, body);
      assert.equal(r.status, 400, body);
      assert.equal(r.body.code, "stories.body");
    }
    const off = await post(url, { history: false });
    assert.equal(off.status, 200, JSON.stringify(off.body));
    assert.deepEqual(off.body.stories, { history: false });
    assert.notEqual(off.body.parent, off.body.head, "the tree's strom.json committed");
    assert.equal(readJsonFile(path.join(w.cwd, "strom.json"))["stories.history"], "no");
    assert.equal(readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json"))["stories.history"], undefined, "the person's own config stays");
    assert.deepEqual((await status()).stories, { history: false });
    const again = await post(url, { history: false });
    assert.equal(again.status, 200);
    assert.equal(again.body.parent, again.body.head, "off already: nothing written");
    const on = await post(url, { history: true });
    assert.equal(on.status, 200);
    assert.deepEqual(on.body.stories, { history: true });
    assert.equal(readJsonFile(path.join(w.cwd, "strom.json"))["stories.history"], "yes");
    assert.deepEqual((await status()).stories, { history: true });
    // the history of the places off for the tree: the stories have none; on is refused with the link that turns it on
    assert.equal((await post(`${info.url}/experiments`, { history: false })).status, 200);
    assert.deepEqual((await status()).stories, { history: false });
    const refused = await post(url, { history: true });
    assert.equal(refused.status, 409);
    assert.equal(refused.body.code, "history.off");
    assert.equal(refused.body.link, `strom-research://experiment?tree=${id}&name=history&do=on`);
    assert.equal(readJsonFile(path.join(w.cwd, "strom.json")).experimentsHistory, "off", "never turned on by it");
    const offAnyway = await post(url, { history: false });
    assert.equal(offAnyway.status, 200);
    assert.equal(offAnyway.body.parent, offAnyway.body.head, "none already: nothing written");
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("the setup run again asks it beside the stories (never the first one): Enter keeps what is; the tree's own value (the Strom app's) answered by the person", { ...opts, skip: opts.skip || process.platform === "win32" }, async () => {
  const w = new World();
  try {
    const bin = path.join(w.dir, "bin");
    fs.mkdirSync(bin, { recursive: true });
    fs.writeFileSync(path.join(bin, "claude"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    w.env.PATH = [bin, path.dirname(process.execPath), "/usr/bin", "/bin"].join(path.delimiter);
    const question = /Brát do vyprávění i dějiny míst – události doby v místech předků, každou s jejím zdrojem, jako pozadí života\? Schválené vyprávění zůstane, jak je; dějiny přijdou až s jeho další verzí\.\n {3}1 {2}Ano \(doporučeno\)\n {3}2 {2}Ne – vyprávění jen ze zápisů\n {3}0 {2}Nechat, jak je\nVybrat \[(\d)\]/u;
    const first = await w.ok(["setup"], { tty: true, answers: Array(40).fill("") });
    assert.doesNotMatch(first.out, /dějiny míst – události doby/u, "not in the first setup");
    const cfg = () => readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json"));
    assert.equal(cfg().experimentsHistory, "on", "the first setup suggests the history on");
    await w.withTree("Lhotákovi");
    const again = await w.ok(["setup"], { tty: true, answers: Array(40).fill("") });
    assert.equal(question.exec(again.out)?.[1], "1", again.out);
    assert.equal(cfg()["stories.history"], undefined);
    // the Strom app turned it off for this tree: the person sees it so, Enter keeps it — as theirs, the tree's own gone
    await w.ok(["config", "set", "stories.history", "no", "--for-tree"]);
    const own = await w.ok(["setup"], { tty: true, answers: Array(40).fill("") });
    assert.equal(question.exec(own.out)?.[1], "2", own.out);
    assert.equal(cfg()["stories.history"], "no");
    assert.equal(readJsonFile(path.join(w.cwd, "strom.json"))["stories.history"], undefined);
    assert.equal((await w.ok(["config", "get", "stories.history"])).out.trim(), "no");
    // the history off: not asked
    await w.ok(["config", "set", "experiments.history", "off"]);
    assert.doesNotMatch((await w.ok(["setup"], { tty: true, answers: Array(40).fill("") })).out, /dějiny míst – události doby/u);
  } finally {
    w.cleanup();
  }
});
