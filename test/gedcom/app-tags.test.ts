// The Strom app reads AGE, CAUS and ADDR itself (STROM_READS_TAGS): the research says them once, in the tags,
// and the app's own parser shows each once — an older app gets them in the note too.

import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { exportGedcom } from "../../src/gedcom/export.ts";

const stromRepo = path.resolve(import.meta.dirname, "..", "..", "..", "strom");
const tsx = path.join(stromRepo, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");

test("the Strom app's own parser shows a death's cause, age and house once", { skip: !hasGit || !fs.existsSync(tsx) }, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci Jana", "--new-person", "Jan /Novák/", "--sex", "M"]);
  await w.ok(["event", "add", "P1", "DEAT", "--date", "12 MAR 1919", "--place", "Lhota", "--house", "13", "--cause", "souchotiny", "--age", "54"]);
  const script = path.join(w.dir, "read.ts");
  fs.writeFileSync(
    script,
    `import fs from "node:fs";
import { parseGedcom, convertToStrom } from ${JSON.stringify(path.join(stromRepo, "src", "ged-parser.ts"))};
const d = convertToStrom(parseGedcom(fs.readFileSync(process.argv[2], "utf8"))).data;
console.log(JSON.stringify((Object.values(d.persons) as any[]).find((p) => p.refn === "P0001")?.notes ?? ""));
`,
  );
  const notes = (stromVersion: string | undefined): string => {
    const ged = path.join(w.dir, `${stromVersion ?? "today"}.ged`);
    fs.writeFileSync(ged, exportGedcom(Tree.open(w.cwd, w.env), { for: "strom", stromVersion }).text);
    const r = spawnSync(tsx, [script, ged], { cwd: stromRepo, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    return JSON.parse(r.stdout.trim().split("\n").pop()!);
  };
  const once = (text: string, word: string) => text.split(word).length - 1;
  const today = notes(undefined);
  // at most once: an app that gives the cause a field of its own has it no more in the note
  assert.ok(once(today, "souchotiny") <= 1, today);
  assert.ok(once(today, "čp. 13") <= 1, today);
  const older = notes("2.9.0");
  assert.ok(once(older, "souchotiny") >= 1, "an app older than 3.0.0: in the note too");
  w.cleanup();
});

test("the Strom app's own parser reads the new version of an approved story beside it (2 _DRAFT) and drops nothing", { skip: !hasGit || !fs.existsSync(tsx) }, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci Jana", "--new-person", "Jan /Novák/", "--sex", "M"]);
  await w.ok(["event", "add", "P1", "OCCU", "--value", "mlynář"]);
  await w.ok(["story", "set", "P1", "--text", "Jan byl mlynář.", "--fact", "E0001", "--final"]);
  await w.ok(["story", "set", "P1", "--text", "Jan byl mlynář v Týnci.", "--fact", "E0001"]);
  const ged = path.join(w.dir, "draft.ged");
  fs.writeFileSync(ged, exportGedcom(Tree.open(w.cwd, w.env), { for: "strom", storyDrafts: true }).text);
  const script = path.join(w.dir, "read.ts");
  fs.writeFileSync(
    script,
    `import fs from "node:fs";
import { parseGedcom, convertToStrom } from ${JSON.stringify(path.join(stromRepo, "src", "ged-parser.ts"))};
const parsed = parseGedcom(fs.readFileSync(process.argv[2], "utf8"));
const p = (Object.values(convertToStrom(parsed).data.persons) as any[]).find((x) => x.refn === "P0001");
console.log(JSON.stringify({ dropped: [...parsed.droppedTags.entries()], story: p?.story }));
`,
  );
  const r = spawnSync(tsx, [script, ged], { cwd: stromRepo, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout.trim().split("\n").pop()!);
  assert.deepEqual(out.dropped, []);
  assert.match(JSON.stringify(out.story), /Jan byl mlynář\./);
  assert.match(JSON.stringify(out.story?.draft ?? null), /Jan byl mlynář v Týnci\./, JSON.stringify(out.story));
  w.cleanup();
});
