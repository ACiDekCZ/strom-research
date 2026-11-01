// The research back in time for the Strom app (spec 032): the link strom-research://back (a change by its hash only, or
// the earlier changes to pick from) — the preview and the person's yes in the terminal; the bridge's /log says a return
// apart (kind "return", the change it went back to) and never names a source the return took out; /status says
// history.back. And strom's fixes for the app's map (spec 031): street-places names the municipalities whose bare
// numbers wait for the person's answer, never one answered.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { LinkError, LINK_ACTIONS, linkText, parseLink } from "../../src/core/links.ts";
import { BRIDGE_FEATURES, history } from "../../src/core/live.ts";
import { SYNC_INBOX } from "../../src/core/sync.ts";
import { fixesForApp } from "../../src/commands/fixchecks.ts";
import { Settings } from "../../src/core/config.ts";
import type { Person, Source } from "../../src/core/model.ts";

const opts = { skip: !hasGit, timeout: 180_000 };
const ID = "0f8c2d4e-1b2a-4c3d-9e8f-7a6b5c4d3e2f";

const head = (w: World) => execFileSync("git", ["-C", w.cwd, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();

test("the link back: the research, a change by its hash only — never a day, a text or anything else", () => {
  assert.ok((LINK_ACTIONS as readonly string[]).includes("back"), "said in /status links and _STROM_LINKS");
  assert.ok((BRIDGE_FEATURES as readonly string[]).includes("history.back"));
  assert.deepEqual(parseLink(`strom-research://back?tree=${ID}`), { action: "back", tree: ID });
  assert.deepEqual(parseLink(`strom-research://back?tree=${ID}&change=1a2b3c4d`), { action: "back", tree: ID, change: "1a2b3c4d" });
  const full = "0123456789abcdef0123456789ABCDEF01234567";
  assert.deepEqual(parseLink(`strom-research://back?tree=${ID}&change=${full}`), { action: "back", tree: ID, change: full.toLowerCase() });
  // a day or a text the link brings is never taken
  const taken = parseLink(`strom-research://back?tree=${ID}&change=1a2b3c4d&day=2026-01-15&say=${encodeURIComponent("Návrat — Lhota")}`);
  assert.deepEqual(taken, { action: "back", tree: ID, change: "1a2b3c4d" });
  assert.equal(linkText(taken as Exclude<typeof taken, { action: "menu" }>), `strom-research://back?tree=${ID}&change=1a2b3c4d`);
  for (const bad of ["2026-01-15", "1a2b3c", "HEAD", "HEAD~1", "1a2b3c4d;rm", "1a2b 3c4d", "ž1a2b3c4d", "1a2b3c4d".repeat(6), "", "--yes"])
    assert.throws(() => parseLink(`strom-research://back?tree=${ID}&change=${encodeURIComponent(bad)}`), LinkError, bad);
  assert.throws(() => parseLink(`strom-research://back?tree=not-a-tree&change=1a2b3c4d`), LinkError);
});

test("the link back in the research's terminal: the change named — the preview, the person's yes; none named — the changes to pick from; another research's change only said", { ...opts, skip: !hasGit || process.platform === "win32" }, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    const id = readJsonFile(path.join(w.cwd, "strom.json")).id as string;
    const open = (query = "", answers: string[] = []) => w.run(["link", "open", `strom-research://back?tree=${id}${query}`], { tty: true, answers });
    const jan = (await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M", "--json"])).json.person.id as string;
    const then = head(w);
    const marie = (await w.ok(["person", "add", "Marie /Lhotáková/", "--sex", "F", "--json"])).json.person.id as string;
    const later = head(w);
    const person = (pid: string) => Tree.open(w.cwd, w.env).get<Person>(pid)!;

    // the change named by the app (its whole hash, as /log head gives it): what returns, then a no — nothing written
    const no = await open(`&change=${then}`, ["n", ""]);
    assert.match(no.out, /Návrat ke stavu po změně z .+ \([0-9a-f]{8}\):/u);
    assert.match(no.out, /Vrátit výzkum do tohoto stavu\?/u);
    assert.equal(head(w), later, "a no returns nothing");
    // a yes: returned
    const yes = await open(`&change=${then.slice(0, 8)}`, ["y", ""]);
    assert.match(yes.out, /Výzkum je znovu ve stavu z /u);
    assert.ok(person(marie).retracted);
    assert.equal(person(jan).retracted, undefined);
    // none named: the earlier changes offered, the one before the return picked (the state after Marie), a yes
    const picked = await open("", ["1", "y", ""]);
    assert.match(picked.out, /Ke stavu po které změně\?/u);
    assert.match(picked.out, /Výzkum je znovu ve stavu z /u);
    assert.equal(person(marie).retracted, undefined, "back after the return");
    // 0 at the pick: nothing
    const before = head(w);
    await open("", ["0", ""]);
    assert.equal(head(w), before);
    // a change this research does not have, the state now: only said
    const unknown = await open("&change=deadbeef", [""]);
    assert.match(unknown.out + unknown.err, /změna deadbeef v historii tohoto výzkumu není/u);
    assert.match((await open(`&change=${head(w)}`, [""])).out, /je dnešní stav: není co vracet/u);
    assert.equal(head(w), before);
    await w.ok(["verify"]);
  } finally {
    w.cleanup();
  }
});

test("/log: a return said apart (kind return, the change it went back to, when) — its line names no source it took out", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    const jan = (await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M", "--json"])).json.person.id as string;
    const kept = (await w.ok(["source", "add", "Křest Jana", "--kind", "baptism", "--json"])).json.source.id as string;
    const then = head(w);
    // later: the source kept changed, another added
    await w.ok(["source", "edit", kept, "--title", "Křest Jana Lhotáka"]);
    const added = (await w.ok(["source", "add", "Sňatek Jana", "--kind", "marriage", "--json"])).json.source.id as string;
    await w.ok(["history", "back", then.slice(0, 8)], { tty: true, answers: ["y"] });
    const tree = Tree.open(w.cwd, w.env);
    assert.ok(tree.get<Source>(added)!.retracted, "taken out");
    assert.equal(tree.get<Source>(kept)!.retracted, undefined);
    const [entry, ...older] = history(w.cwd, tree);
    assert.equal(entry!.kind, "return");
    assert.equal(entry!.to, then.slice(0, 8));
    assert.equal(Date.parse(entry!.toAt!), Date.parse(execFileSync("git", ["-C", w.cwd, "show", "-s", "--format=%cI", then], { encoding: "utf8" }).trim()));
    assert.match(entry!.text[0]!, /^Návrat ke stavu z /u);
    // the source brought back as it was: named; the one taken out: never (the app would open a retracted record)
    const named = (entry!.sources ?? []).flat();
    assert.ok(!named.includes(added), JSON.stringify(entry!.sources));
    assert.ok(named.includes(kept), JSON.stringify(entry!.sources));
    for (const e of older) assert.equal(e.kind, undefined, e.text.join(" | "));
    // the change /log names is the one the link and strom history back take
    assert.equal(entry!.head, head(w));
    assert.ok(person(tree, jan));
  } finally {
    w.cleanup();
  }
});

const person = (tree: Tree, id: string) => tree.get<Person>(id);

test("the preview of a return says the trees the app sent that wait in the inbox (the return leaves them)", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M"]);
    const then = head(w).slice(0, 8);
    await w.ok(["person", "add", "Marie /Lhotáková/", "--sex", "F"]);
    const before = await w.ok(["history", "back", then, "--preview", "--json"]);
    assert.equal(before.json.inbox, undefined);
    assert.doesNotMatch((await w.ok(["history", "back", then, "--preview"])).out, /čekají na rozhodnutí/u);
    // a send of the app waiting (sync.review on): as the bridge keeps it
    const dir = path.join(w.cwd, SYNC_INBOX);
    fs.mkdirSync(dir, { recursive: true });
    const intake = "R20261101120000000-ab12";
    fs.writeFileSync(path.join(dir, `${intake}.ged`), "0 HEAD\n0 TRLR\n");
    fs.writeFileSync(path.join(dir, `received-${intake}.json`), JSON.stringify({ intake, at: new Date().toISOString(), file: `${intake}.ged`, state: "pending", transcripts: "lead", changes: 2 }));
    const p = await w.ok(["history", "back", then, "--preview", "--json"]);
    assert.equal(p.json.inbox, 1);
    assert.match((await w.ok(["history", "back", then, "--preview"])).out, /Stromy poslané z aplikace Strom čekají na rozhodnutí \(1\): návrat je nechá čekat/u);
    assert.match((await w.ok(["history", "back", then, "--preview", "--lang", "en"])).out, /Trees the Strom app sent wait for a decision \(1\)/u);
  } finally {
    w.cleanup();
  }
});

test("GET /fixes street-places: the municipalities whose bare numbers wait for the person's answer — never one answered, never a part of a municipality", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    await w.ok(["place", "add", "Lhota", "--kind", "village"]);
    const jan = (await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M", "--json"])).json.person.id as string;
    let year = 1850;
    for (const place of ["Lhota", "Lhota 16", "Lhota 3a".normalize("NFD"), "Lhota 16", "Лхота", "Лхота 5", "Praha", "Praha 5"])
      await w.ok(["event", "add", jan, "RESI", "--date", String(year++), "--place", place]);
    const towns = () => {
      const tree = Tree.open(w.cwd, w.env);
      return fixesForApp(tree, new Settings(w.env, {}), w.env, { archive: false }).fixes.find((f) => f.id === "street-places")!.towns;
    };
    assert.deepEqual(towns(), [
      { town: "Lhota", key: "lhota", count: 3, places: ["Lhota 16", "Lhota 3a"] },
      { town: "Лхота", key: "лхота", count: 1, places: ["Лхота 5"] },
    ]);
    // answered for Lhota (houses) and Лхота (not houses): neither named any more
    await w.ok(["fixes", "run", "street-places"], { tty: true, answers: ["1", "2"] });
    assert.equal(towns(), undefined);
  } finally {
    w.cleanup();
  }
});
