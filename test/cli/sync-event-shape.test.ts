// strom sync: the same fact sent back in another shape — `1 CENS` as `1 EVEN` + `2 TYPE Census`, or the other way round
// (1114 E13). The app keeps the fact's ID (`2 _STROM_EID E…`): a fact of that ID whose shape only names the same kind is
// that fact, never a new one beside it and the old one gone; a real change of what it says is still the user's edit.
// Made-up people (Lhoták, Lhota), a place in NFD as typed on a Mac and one in Cyrillic.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit };
const BETA = "https://beta.stromapp.info/run/";
/** A write of the Strom app's through the bridge (the person's), from its beta copy. */
const APP = { STROM_FOR_APP: "1", STROM_APP_URL: BETA };
/** The export the beta of the app is given (the facts' IDs in it). */
const BETA_APP = { STROM_APP_URL: BETA, STROM_APP_VERSION: "3.26.0-beta.2" };

/** Jan Lhoták (P1) counted in a census at Lhota (NFD), a second one at Лхота with a label of the research's own (EVEN). */
async function lhotak() {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["research", "new", "Předci Jana", "--new-person", "Jan /Lhoták/", "--sex", "M"]); // P1
  const census = (await w.ok(["event", "add", "P1", "CENS", "--date", "1880", "--place", "Lhota".normalize("NFD"), "--json"])).json.event.id as string;
  const even = (await w.ok(["event", "add", "P1", "EVEN", "--label", "Census", "--date", "1890", "--place", "Лхота", "--json"])).json.event.id as string;
  return { w, census, even };
}

/** The research's Strom file as the app sends it back: its header the app's (3.26.0-beta.2). */
async function appFile(w: World): Promise<string> {
  const out = path.join(w.dir, `export-${Date.now()}.ged`);
  await w.ok(["export", "gedcom", "--for", "strom", "--out", out], { env: BETA_APP });
  const text = fs.readFileSync(out, "utf8").replace(/\r\n?/g, "\n");
  const head = /^1 SOUR STROM_RESEARCH\n2 VERS .*\n2 NAME .*\n/m;
  assert.match(text, head);
  return text.replace(head, "1 SOUR STROM\n2 VERS 3.26.0-beta.2\n2 NAME Strom\n");
}

/** The fact of this ID written in another shape: its line (and the TYPE under it) replaced, everything else kept. */
function reshaped(text: string, id: string, to: string[]): string {
  const lines = text.split("\n");
  const at = lines.indexOf(`2 _STROM_EID ${id}`);
  assert.ok(at > 0, id);
  let start = at - 1;
  while (start > 0 && !lines[start]!.startsWith("1 ")) start--;
  let end = start + 1;
  while (end < lines.length && !/^[01] /.test(lines[end]!)) end++;
  const body = lines.slice(start + 1, end).filter((l) => !l.startsWith("2 TYPE "));
  lines.splice(start, end - start, ...to, ...body);
  return lines.join("\n");
}

function write(w: World, text: string): string {
  const file = path.join(w.dir, "z-aplikace.ged");
  fs.writeFileSync(file, text);
  return file;
}

test("a fact sent back in another shape of the same kind (CENS ↔ EVEN + TYPE Census), its _STROM_EID kept: the same fact — no change, no lead", opts, async () => {
  const { w, census, even } = await lhotak();
  try {
    let text = await appFile(w);
    assert.match(text, new RegExp(`1 CENS\\n(?:2 .*\\n)*?2 _STROM_EID ${census}\\n`, "u"));
    text = reshaped(text, census, ["1 EVEN", "2 TYPE Census"]);
    text = reshaped(text, even, ["1 CENS"]);
    const file = write(w, text);
    const plan = (await w.ok(["sync", file, "--json"], { env: APP })).json;
    assert.deepEqual(plan.changes.map((c: { kind: string; action: string }) => `${c.kind} ${c.action}`), [], "nothing is an edit");
    const before = (await w.ok(["person", "show", "P1", "--json"])).json.person.events.length;
    await w.ok(["sync", file, "--apply"], { env: APP });
    assert.equal((await w.ok(["person", "show", "P1", "--json"])).json.person.events.length, before, "no fact beside it");
  } finally {
    w.cleanup();
  }
});

test("a fact sent back in another shape with what it says changed: still the user's edit of that fact, not a new one", opts, async () => {
  const { w, census } = await lhotak();
  try {
    let text = await appFile(w);
    text = reshaped(text, census, ["1 EVEN", "2 TYPE Census"]).replace(/2 DATE 1880\n/u, "2 DATE 1881\n");
    const file = write(w, text);
    const plan = (await w.ok(["sync", file, "--json"], { env: APP })).json;
    const kinds = plan.changes.map((c: { kind: string; action: string; was?: { id?: string } }) => `${c.kind} ${c.action} ${c.was?.id ?? ""}`.trim());
    assert.deepEqual(kinds, [`fact.changed correct ${census}`], "a lead corrected: that fact, no new one beside it");
    await w.ok(["sync", file, "--apply"], { env: APP });
    const events = (await w.ok(["person", "show", "P1", "--json"])).json.person.events as { id: string; kind: string; date?: string }[];
    const e = events.find((x) => x.id === census);
    assert.deepEqual([e?.kind, e?.date], ["CENS", "1881"], "its kind as the research has it, its date the user's");
    assert.equal(events.filter((x) => x.kind === "EVEN" && x.date === "1881").length, 0);
  } finally {
    w.cleanup();
  }
});

test("another kind under the same _STROM_EID (a census made a residence in the app): a real change, never taken as the same shape", opts, async () => {
  const { w, census } = await lhotak();
  try {
    let text = await appFile(w);
    text = reshaped(text, census, ["1 EVEN", "2 TYPE Residence"]);
    const plan = (await w.ok(["sync", write(w, text), "--json"], { env: APP })).json;
    assert.ok(plan.changes.length > 0, "an edit of the user's");
  } finally {
    w.cleanup();
  }
});
