// What the user sent or brought stays the user's: an agent never takes a sync back (it would close the conflicts of
// the user's edits it raised, decided by nobody) nor throws away a tree the app sent; and a file brought in never
// carries a decision in — a story marked done in it is no story approved, no conflict of the research decided by it.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit };
const agent = { env: { AI_AGENT: "1" } };

const ged = (lines: string[]) => [...lines, "0 TRLR", ""].join("\n");
const head0 = ["0 HEAD", "1 SOUR STROM", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8"];
const people = (vaclav: string, story: string[] = []) => [
  "0 @I1@ INDI", `1 NAME ${vaclav}`, "1 SEX M", "1 BIRT", "2 DATE 1871", "2 PLAC Lhota", "1 FAMS @F1@", ...story,
  "0 @I2@ INDI", "1 NAME Ludmila /Lhotáková/", "1 SEX F", "1 FAMS @F1@",
  "0 @I3@ INDI", "1 NAME Ondřej /Lhoták/", "1 SEX M", "1 BIRT", "2 DATE 1902", "1 FAMC @F1@",
  "0 @F1@ FAM", "1 HUSB @I1@", "1 WIFE @I2@", "1 CHIL @I3@",
];
const refn = (lines: string[]) => lines.flatMap((l) => {
  const m = /^0 @I(\d+)@ INDI$/.exec(l);
  return m ? [l, `1 REFN P000${m[1]}`, "2 TYPE strom-research"] : [l];
});
const done = ["1 _STORY", "2 TYPE vypraveni", "2 TITL Mlynář z Lhoty", "2 STAT hotovo", "2 TEXT Václav Lhoták převzal mlýn po otci."];

async function adopted(): Promise<{ w: World; send: (vaclav: string, story?: string[]) => string }> {
  const w = new World();
  await w.withTree("Lhotákovi");
  const file = path.join(w.dir, "adopt.ged");
  fs.writeFileSync(file, ged([...head0, ...people("Václav /Lhoták/")]));
  await w.ok(["sync", file, "--apply", "--force"]);
  const tree = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
  let n = 0;
  const send = (vaclav: string, story: string[] = []) => {
    const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
    const out = path.join(w.dir, `send-${++n}.ged`);
    fs.writeFileSync(out, ged([...head0, `1 _STROM_TREE ${tree}`, `1 _STROM_HEAD ${head}`, ...refn(people(vaclav, story))]));
    return out;
  };
  return { w, send };
}

test("an agent never takes a sync back: the conflict of the user's edit stays open; the user takes it back", opts, async () => {
  const { w, send } = await adopted();
  const s = (await w.ok(["source", "add", "Křest Václava Lhotáka 1871", "--kind", "baptism", "--locator", "fol. 7", "--json"])).json;
  await w.ok(["name", "add", "P0001", "Václav /Lhoták/", "--cite", (s.id ?? s.source?.id) as string]);
  const r = (await w.ok(["sync", send("Vácslav /Lhotak/"), "--apply", "--json"])).json;
  assert.equal(r.conflicts.length, 1, JSON.stringify(r.conflicts));
  const input = r.input as string;

  const refused = await w.run(["sync", "undo", input], agent);
  assert.notEqual(refused.code, 0, refused.out + refused.err);
  assert.match(refused.err + refused.out, /the user's own/);
  const open = (await w.ok(["conflict", "list", "--json"])).json.conflicts as { state?: string }[];
  assert.equal(open.length, 1, "still open for the user");
  assert.equal((await w.ok(["input", "show", input, "--json"])).json.input?.sync?.undone, undefined, "not taken back");

  await w.ok(["sync", "undo", input]);
  assert.equal((await w.ok(["conflict", "list", "--json"])).json.conflicts.length, 0, "the user took it back");
  w.cleanup();
});

test("an agent never throws away a tree the app sent", opts, async () => {
  const { w } = await adopted();
  const refused = await w.run(["sync", "discard"], agent);
  assert.notEqual(refused.code, 0, refused.out + refused.err);
  assert.match(refused.err + refused.out, /the user's own/);
  w.cleanup();
});

test("a story marked done in a file brought in approves nothing: no story is written from it", opts, async () => {
  const { w, send } = await adopted();
  // the app's tree sent with a story marked done, synced by an agent
  await w.ok(["sync", send("Václav /Lhoták/", done), "--apply"], agent);
  // and a foreign family tree with one, taken in
  const foreign = path.join(w.dir, "cizi.ged");
  fs.writeFileSync(foreign, ged([...head0, "0 @I9@ INDI", "1 NAME Václav /Lhoták/", "1 SEX M", ...done]));
  await w.run(["intake", foreign], agent);
  const p = (await w.ok(["person", "show", "P0001", "--json"])).json.person as { story?: { status?: string } };
  assert.notEqual(p.story?.status, "final", JSON.stringify(p.story));
  const shown = (await w.ok(["story", "list", "--json"])).json;
  assert.ok(!JSON.stringify(shown).includes("\"final\""), JSON.stringify(shown));
  w.cleanup();
});
