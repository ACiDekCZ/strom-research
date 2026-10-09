// A conflict of the user's edit in the Strom app decided from the app's link (strom-research://conflict?…&do=decide):
// the value picked in the terminal is the side taken — the user's written into the fact, the research's kept — never
// a conflict closed with nothing written (the link passed "<value> (S…)", which named neither side).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { readJsonFile } from "../helpers.ts";
import { opts, world } from "./sync.helpers.ts";

/** Josef's baptism (a record's: S1) moved a day in the app: a conflict for the user to decide (X0001). */
async function conflicted() {
  const { w, ged } = await world();
  const file = path.join(w.dir, "app.ged");
  fs.writeFileSync(file, fs.readFileSync(ged, "utf8").replace("2 DATE 3 MAR 1885", "2 DATE 4 MAR 1885"));
  const r = (await w.ok(["sync", file, "--apply", "--json"])).json;
  assert.deepEqual(r.conflicts.map((c: { id: string; fact: string }) => [c.id, c.fact]), [["X0001", "CHR"]]);
  const id = readJsonFile(path.join(w.cwd, "strom.json")).id as string;
  const open = (query: string, answers: string[]) => w.run(["link", "open", `strom-research://conflict?tree=${id}${query}`], { tty: true, answers });
  const chr = async () => ((await w.ok(["person", "show", "P0001", "--json"])).json.person.events as { id: string; kind: string; date?: string; status: string; retracted?: unknown }[]).filter((e) => e.kind === "CHR");
  return { w, open, chr };
}

test("the decide link: the user's value picked — written into the fact (the record's withdrawn), the conflict decided", opts, async () => {
  const { w, open, chr } = await conflicted();
  const x = (await w.ok(["conflict", "show", "X0001", "--json"])).json.conflict;
  const user = x.claims.findIndex((c: { note?: string }) => c.note === "the user's edit");
  assert.ok(user >= 0);
  const r = await open("&id=X0001", ["a", String(user + 1), "Vím to z rodinné bible", ""]);
  assert.equal(r.code, 0, r.err + r.out);
  const now = (await w.ok(["conflict", "show", "X0001", "--json"])).json.conflict;
  assert.equal(now.state, "resolved");
  const live = (await chr()).filter((e) => !e.retracted);
  assert.deepEqual(live.map((e) => [e.date, e.status]), [["4 MAR 1885", "possible"]], "the user's value written");
  assert.doesNotMatch(r.out, /zůstává, jak byl/, "never 'the fact stays as it was'");
  w.cleanup();
});

test("the decide link: the research's value picked — the fact kept as it is, the conflict decided", opts, async () => {
  const { w, open, chr } = await conflicted();
  const x = (await w.ok(["conflict", "show", "X0001", "--json"])).json.conflict;
  const research = x.claims.findIndex((c: { note?: string }) => c.note?.startsWith("the research"));
  const r = await open("&id=X0001", ["a", String(research + 1), "Zápis je jasný", ""]);
  assert.equal(r.code, 0, r.err + r.out);
  assert.equal((await w.ok(["conflict", "show", "X0001", "--json"])).json.conflict.state, "resolved");
  assert.deepEqual((await chr()).filter((e) => !e.retracted).map((e) => e.date), ["3 MAR 1885"]);
  w.cleanup();
});

test("conflict resolve: a conclusion naming a side's value with its source — that side taken", opts, async () => {
  const { w, chr } = await conflicted();
  const x = (await w.ok(["conflict", "show", "X0001", "--json"])).json.conflict;
  const user = x.claims.find((c: { note?: string }) => c.note === "the user's edit");
  await w.ok(["conflict", "resolve", "X0001", `--resolution=${user.text ?? user.value} (${user.source})`, "--reasoning=rodinná bible"]);
  assert.deepEqual((await chr()).filter((e) => !e.retracted).map((e) => e.date), ["4 MAR 1885"]);
  w.cleanup();
});
