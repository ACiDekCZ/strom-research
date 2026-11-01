// strom history back: the research returned to its state after an earlier change — a preview anyone may ask for (read
// only), the return itself only on a person's yes at their terminal, written as one new change (records added since
// retracted, never deleted), taken back the same way; the history says it in the research's language.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import type { Person } from "../../src/core/model.ts";

const opts = { skip: !hasGit, timeout: 180_000 };

const head = (w: World) => execFileSync("git", ["-C", w.cwd, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const dirty = (w: World) => execFileSync("git", ["-C", w.cwd, "status", "--porcelain"], { encoding: "utf8" });
const person = (w: World, id: string) => Tree.open(w.cwd, w.env).get<Person>(id)!;
const birth = (w: World, id: string) => person(w, id).events.find((e) => e.kind === "BIRT")?.date;

test("history back: preview for anyone, the return only on the person's yes, nothing deleted, taken back the same way", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    // a name typed decomposed (NFD): stored and returned whole
    const jan = (await w.ok(["person", "add", "Jan /Lhoták/".normalize("NFD"), "--sex", "M", "--json"])).json.person.id as string;
    const born = (await w.ok(["event", "add", jan, "BIRT", "--date", "1850", "--place", "Lhota", "--json"])).json.event.id as string;
    const then = head(w);

    // later: one more person, a fact changed
    const marie = (await w.ok(["person", "add", "Marie /Lhotáková/", "--sex", "F", "--json"])).json.person.id as string;
    await w.ok(["event", "edit", born, "--date", "1851", "--reason", "the record says 1851"]);
    const later = head(w);
    assert.equal(birth(w, jan), "1851");

    // the preview: read only, an agent may ask for it — what would come back, the command for the person
    const p = await w.ok(["history", "back", then.slice(0, 8), "--preview", "--json"]);
    assert.equal(p.json.returned, false);
    assert.deepEqual(p.json.counts.person, { back: 1, out: 1 });
    assert.equal(p.json.facts, 1);
    assert.equal(p.json.run, `strom history back ${then.slice(0, 8)}`);
    const shown = await w.ok(["history", "back", then.slice(0, 8), "--preview"]);
    assert.match(shown.out, /Návrat ke stavu po změně z .+ \([0-9a-f]{8}\):/u);
    assert.match(shown.out, /Osoby: 1 jako tehdy, 1 vyřazeno \(přidáno později\)/u);
    assert.match(shown.out, /Údaje, které se liší: 1/u);
    assert.match(shown.out, /Nic se nemaže/u);
    assert.match(shown.out, /O návratu v čase rozhoduje jen člověk/u);
    assert.doesNotMatch(shown.out, /(?<![\p{L}\p{M}\p{N}])(vy|váš|vaše|ty|tvůj)(?![\p{L}\p{M}\p{N}])/iu, "impersonal");
    assert.equal(head(w), later, "the preview writes nothing");
    assert.equal(dirty(w), "");

    // never without a person at the terminal: an agent, a script, --yes, a no
    assert.equal((await w.run(["history", "back", then.slice(0, 8)])).code, 4, "nobody at a terminal: needs a person");
    assert.equal((await w.run(["history", "back", then.slice(0, 8)], { tty: true, answers: ["y"], env: { CLAUDECODE: "1" } })).code, 4, "an agent never");
    assert.notEqual((await w.run(["history", "back", then.slice(0, 8), "--yes"], { tty: true, answers: ["y"] })).code, 0, "--yes never");
    const no = await w.ok(["history", "back", then.slice(0, 8)], { tty: true, answers: ["n"] });
    assert.match(no.out, /Vrátit výzkum do tohoto stavu\?/u);
    assert.equal(head(w), later, "a no returns nothing");

    // the return: one new change, the fact as then, the person added later retracted (still there)
    const yes = await w.ok(["history", "back", then.slice(0, 8)], { tty: true, answers: ["y"] });
    assert.match(yes.out, /Výzkum je znovu ve stavu z .+\. Vrácení tohoto návratu: strom history back [0-9a-f]{8}/u);
    assert.equal(execFileSync("git", ["-C", w.cwd, "rev-list", "--count", `${later}..HEAD`], { encoding: "utf8" }).trim(), "1", "one change");
    assert.equal(birth(w, jan), "1850");
    assert.ok(person(w, marie).retracted, "retracted, not deleted");
    assert.equal(person(w, jan).names[0]!.surname, "Lhoták", "whole, in NFC");
    await w.ok(["verify"]);
    assert.equal(dirty(w), "");
    // the history says it in the research's language, the way back on its last line
    const hist = await w.ok(["history"]);
    assert.match(hist.out, /Návrat ke stavu z /u);
    assert.match(hist.out, /strom history back <změna>/u);
    // the same state again: nothing to return
    assert.match((await w.ok(["history", "back", then.slice(0, 8), "--preview"])).out, /není co vracet/u);

    // the return taken back: the state after the later change again, Marie no longer retracted
    const undo = /strom history back ([0-9a-f]{8})/u.exec(yes.out)![1]!;
    assert.equal(undo, later.slice(0, 8));
    await w.ok(["history", "back", undo], { tty: true, answers: ["y"] });
    assert.equal(birth(w, jan), "1851");
    assert.equal(person(w, marie).retracted, undefined);
    await w.ok(["verify"]);

    // the state now is nothing to return to; a day before the research, a change it does not know: said what to do
    assert.match((await w.ok(["history", "back", head(w).slice(0, 8)])).out, /je dnešní stav: není co vracet/u);
    const noday = await w.run(["history", "back", "1999-01-01"]);
    assert.notEqual(noday.code, 0);
    assert.match(noday.err + noday.out, /do 1999-01-01 včetně není žádná změna/u);
    const unknown = await w.run(["history", "back", "deadbeef"]);
    assert.notEqual(unknown.code, 0);
    assert.match(unknown.err + unknown.out, /změna deadbeef v historii tohoto výzkumu není/u);
  } finally {
    w.cleanup();
  }
});

test("history back by a day, in English and German: the state at the end of that day", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    const jan = (await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M", "--json"])).json.person.id as string;
    // the day of the last change: its state is the state now
    const today = execFileSync("git", ["-C", w.cwd, "log", "-1", "--format=%cs"], { encoding: "utf8" }).trim();
    const en = await w.ok(["history", "back", today, "--preview", "--lang", "en"]);
    assert.match(en.out, /is the state now: nothing to return/u);
    const de = await w.ok(["history", "back", today, "--preview", "--lang", "de"]);
    assert.match(de.out, /ist der heutige Stand/u);
    assert.ok(person(w, jan));
  } finally {
    w.cleanup();
  }
});

test("history back: the person's decisions on quality with the state of then; never while somebody works", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    const jan = (await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M", "--json"])).json.person.id as string;
    const id = (await w.ok(["event", "add", jan, "RESI", "--date", "1871", "--place", "Lhota", "--json"])).json.event.id as string;
    // a fact an older strom wrote with the street in the place (street-places finds it)
    const tree = Tree.open(w.cwd, w.env);
    tree.withTreeLock(() => {
      const owner = structuredClone(tree.get<Person>(jan)!);
      owner.events.find((e) => e.id === id)!.place = "Lhota, Dlouhá 12";
      tree.put(owner, { op: "event.update", targets: [id], summary: `${id}: place as an older strom took it` });
      tree.commit("Places as an older strom wrote them");
    });
    const then = head(w);
    const config = () => JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")) as { fixes?: Record<string, unknown> };
    const before = config().fixes?.["street-places"];
    const quality = path.join(w.cwd, "quality", "street-places.json");
    const qualityThen = fs.existsSync(quality) ? fs.readFileSync(quality, "utf8") : undefined;

    // set right by the person: the place the municipality, the decision in strom.json
    await w.ok(["fixes", "run", "street-places"], { tty: true, answers: ["1"] });
    const place = () => person(w, jan).events.find((e) => e.id === id)!.place;
    assert.equal(place(), "Lhota");
    assert.notDeepEqual(config().fixes?.["street-places"], before);

    // somebody at work: no return (what they write would be returned over)
    const { enterWorker } = await import("../../src/core/workers.ts");
    const leave = enterWorker(w.cwd, "run", "a run");
    try {
      const busy = await w.run(["history", "back", then.slice(0, 8)], { tty: true, answers: ["y"] });
      assert.notEqual(busy.code, 0);
      assert.match(busy.err + busy.out, /na výzkumu se právě pracuje/u);
    } finally {
      leave();
    }

    // returned: the place and the decision as then
    const p = await w.ok(["history", "back", then.slice(0, 8), "--preview", "--json"]);
    assert.ok(p.json.counts.person.back >= 1);
    await w.ok(["history", "back", then.slice(0, 8)], { tty: true, answers: ["y"] });
    assert.equal(place(), "Lhota, Dlouhá 12");
    assert.deepEqual(config().fixes?.["street-places"], before);
    assert.equal(fs.existsSync(quality) ? fs.readFileSync(quality, "utf8") : undefined, qualityThen ?? (fs.existsSync(quality) ? "{}\n" : undefined));
    await w.ok(["verify"]);
    assert.equal(dirty(w), "");
  } finally {
    w.cleanup();
  }
});

test("the menu: back in time among the ways to look through the family tree — the changes offered, the preview, the person's yes", { skip: !hasGit || process.platform === "win32", timeout: 180_000 }, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    const jan = (await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M", "--json"])).json.person.id as string;
    const then = head(w);
    const marie = (await w.ok(["person", "add", "Marie /Lhotáková/", "--sex", "F", "--json"])).json.person.id as string;
    // 5 look through · 7 back in time · 1 the change before the last · y · 0 back · 0 quit
    const r = await w.run([], { tty: true, answers: ["5", "7", "1", "y", "", "0", "0"] });
    assert.match(r.out, /Návrat v čase \(stav po dřívější změně\)/u);
    assert.match(r.out, /Ke stavu po které změně\?/u);
    assert.match(r.out, /Návrat ke stavu po změně z /u);
    assert.match(r.out, /Výzkum je znovu ve stavu z /u);
    assert.ok(person(w, marie).retracted);
    assert.equal(person(w, jan).retracted, undefined);
    assert.equal(execFileSync("git", ["-C", w.cwd, "show", "-s", "--format=%P", "HEAD"], { encoding: "utf8" }).trim().length > 0, true);
    assert.notEqual(head(w), then);
  } finally {
    w.cleanup();
  }
});
