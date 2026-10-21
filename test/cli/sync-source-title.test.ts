// A source renamed in the Strom app comes back as its new title, and where in the book a source is goes to the app on
// the source itself (1 PAGE on the SOUR record of the Strom file: the app's "reference"), cited or not.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { Tree } from "../../src/core/tree.ts";
import { exportGedcom } from "../../src/gedcom/export.ts";
import { validateGedcom } from "../../src/gedcom/validate.ts";
import type { Source } from "../../src/core/model.ts";
import { hasGit } from "../helpers.ts";
import { get, marked, opts, post, world } from "./sync.helpers.ts";

const OLD = "Křest Josefa Nováka 1885";
const NEW = "Křest Josefa Nováka, Kamenice 1885";

/** The file as the app gives it back with the source S0001 renamed (or `title` "" taken off). */
function renamed(ged: string, out: string, title = NEW, drop?: RegExp): string {
  let t = fs.readFileSync(ged, "utf8").replace(`1 TITL ${OLD}`, title ? `1 TITL ${title}` : "1 TITL");
  if (drop) t = t.replace(drop, "");
  fs.writeFileSync(out, t);
  return out;
}

const source = (w: { cwd: string; env: NodeJS.ProcessEnv }, id = "S0001") => Tree.open(w.cwd, w.env).get<Source>(id)!;

test("a source renamed in the Strom app: its title corrected in the research, said why; the round trip brings nothing; undone back", opts, async () => {
  const { w, ged } = await world();
  const file = renamed(ged, path.join(w.dir, "z-aplikace.ged"));
  const shown = (await w.ok(["sync", file])).out;
  assert.match(shown, /pramen „Křest Josefa Nováka 1885“: přejmenovaný na „Křest Josefa Nováka, Kamenice 1885“ → přejmenuje se/);
  const done = (await w.ok(["sync", file, "--apply", "--json"])).json;
  assert.equal(source(w).title, NEW);
  assert.equal(source(w).transcript, "Josef, syn Jana Nováka.", "nothing else of it changes");
  // the history says why: the edit in the app (the sync's source)
  const ops = Tree.open(w.cwd, w.env).readOps().filter((o) => o.op === "source.sync" && (o.targets ?? []).includes("S0001"));
  assert.match(ops.at(-1)!.summary, /S0001 renamed "Křest Josefa Nováka 1885" → "Křest Josefa Nováka, Kamenice 1885" \(Úpravy v aplikaci Strom/);
  assert.match((await w.ok(["check"])).out, /^ok/);
  // the research given back to the app and sent again: nothing new
  const back = path.join(w.dir, "back.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", back]);
  assert.match((await w.ok(["sync", back])).out, /nic nového/);
  // the same file again (before the app had the research back): nothing twice
  assert.doesNotMatch((await w.ok(["sync", file])).out, /přejmenovaný/);
  await w.ok(["sync", "undo", done.input]);
  assert.equal(source(w).title, OLD);
  assert.equal(source(w).transcript, "Josef, syn Jana Nováka.");
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});

test("a source's title from the app: an empty one takes nothing away, without the state it was given nothing is renamed, renamed by the research too the user's kept beside it (their word wins with sync.edits user)", opts, async () => {
  const { w, ged } = await world();
  assert.doesNotMatch((await w.ok(["sync", renamed(ged, path.join(w.dir, "empty.ged"), "")])).out, /přejmenovaný/);
  assert.doesNotMatch((await w.ok(["sync", renamed(ged, path.join(w.dir, "nobase.ged"), NEW, /^1 _STROM_HEAD .*\r?\n/m)])).out, /přejmenovaný/);
  // the research renamed it since the app was given it, and the user too
  await w.ok(["source", "edit", "S0001", "--title", "Křest Josefa Nováka (Kamenice 1885)"]);
  const file = renamed(ged, path.join(w.dir, "both.ged"));
  assert.match((await w.ok(["sync", file])).out, /přejmenovaný na „Křest Josefa Nováka, Kamenice 1885“ → výzkum ho přejmenoval také: jeho název zůstává, název z aplikace se uloží vedle do poznámky/);
  await w.ok(["sync", file, "--apply"]);
  const s = source(w);
  assert.equal(s.title, "Křest Josefa Nováka (Kamenice 1885)");
  assert.match(s.notes.at(-1)!.text, /Přejmenováno v aplikaci Strom \(S\d+\), výzkum ho mezitím přejmenoval také; platí název výzkumu – název v aplikaci: Křest Josefa Nováka, Kamenice 1885/);
  assert.doesNotMatch((await w.ok(["sync", renamed(ged, path.join(w.dir, "both-2.ged"))])).out, /přejmenovaný/, "kept beside once");
  // the user's word wins: their title
  await w.ok(["config", "set", "sync.edits", "user"], { tty: true });
  const mine = renamed(ged, path.join(w.dir, "user.ged"), "Křest Josefa Nováka – Kamenice");
  assert.match((await w.ok(["sync", mine])).out, /→ platí název z aplikace/);
  await w.ok(["sync", mine, "--apply"]);
  assert.equal(source(w).title, "Křest Josefa Nováka – Kamenice");
  w.cleanup();
});

test("a source renamed in the app and sent to the bridge: written at once", { skip: !hasGit || process.platform === "win32" }, async () => {
  const { w, ged } = await world();
  const text = fs.readFileSync(renamed(ged, path.join(w.dir, "z-aplikace.ged")), "utf8");
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const r = await post(`${info.url}/sync`, marked(text, "app-tree-a", "v2-1"), { Origin: "https://beta.stromapp.info" });
    assert.equal(r.status, 200, r.body);
    assert.equal(JSON.parse(r.body).applied, 1, r.body);
    assert.equal(source(w).title, NEW);
    assert.equal(JSON.parse((await get(`${info.url}/status?poll=1`)).body).sends[0].state, "written");
  } finally {
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});

test("where in the book a source is goes to the Strom app on the source itself (1 PAGE), cited or not — other programs in its note; an unedited tree comes back with nothing", opts, async () => {
  const { w } = await world();
  await w.ok(["source", "add", "Oddací matrika Kamenice 1880–1890", "--kind", "marriage", "--locator", "fol. 7"]); // S2, cited by nothing
  await w.ok(["source", "edit", "S0001", "--locator", "fol. 3", "--reason", "nalezeno"]);
  const tree = Tree.open(w.cwd, w.env);
  const strom = exportGedcom(tree, { for: "strom", research: true }).text;
  const record = (text: string, id: string) => text.match(new RegExp(`^0 @${id}@ SOUR\\r?\\n(?:[1-9].*\\r?\\n)*`, "m"))![0];
  assert.match(record(strom, "S0002"), /^1 PAGE fol\. 7$/m);
  assert.match(record(strom, "S0001"), /^1 PAGE fol\. 3$/m);
  assert.doesNotMatch(record(strom, "S0002"), /NOTE fol\. 7|^2 CONT fol\. 7/m, "said once: in PAGE");
  // a citation's page is the source's: the app makes no source of its own for it
  assert.match(strom, /2 SOUR @S0001@\r?\n3 PAGE fol\. 3/);
  assert.deepEqual(validateGedcom(strom).filter((f) => f.level === "error"), []);
  // GEDCOM 5.5.1 has PAGE on a citation only: another program gets it in the note
  const standard = exportGedcom(tree, { for: "standard" }).text;
  assert.doesNotMatch(record(standard, "S0002"), /^1 PAGE/m);
  assert.match(record(standard, "S0002"), /fol\. 7/);
  assert.deepEqual(validateGedcom(standard, { strict: true }).filter((f) => f.level === "error"), []);
  // the round trip: nothing new
  const ged = path.join(w.dir, "back.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", ged]);
  assert.match(fs.readFileSync(ged, "utf8"), /0 @S0002@ SOUR[\s\S]*?1 PAGE fol\. 7/);
  assert.match((await w.ok(["sync", ged])).out, /nic nového/);
  w.cleanup();
});

const stromRepo = path.resolve(import.meta.dirname, "..", "..", "..", "strom");
const tsx = path.join(stromRepo, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");

test("through the Strom app's own parser and exporter: the source's PAGE is its reference (an uncited source too), nothing dropped, the tree comes back with nothing new — and a source renamed there comes back renamed", { skip: !hasGit || !fs.existsSync(tsx) }, async () => {
  const { w } = await world();
  await w.ok(["source", "add", "Oddací matrika Kamenice 1880–1890", "--kind", "marriage", "--locator", "fol. 7"]); // S2
  await w.ok(["source", "edit", "S0001", "--locator", "fol. 3", "--reason", "nalezeno"]);
  const ged = path.join(w.dir, "app.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", ged]);
  const head = fs.readFileSync(ged, "utf8").match(/^1 _STROM_TREE .*\r?\n1 _STROM_HEAD .*\r?\n/m)![0];
  const script = path.join(w.dir, "app.ts");
  fs.writeFileSync(
    script,
    `import fs from "node:fs";
import { parseGedcom, convertToStrom } from ${JSON.stringify(path.join(stromRepo, "src", "ged-parser.ts"))};
import { exportToGedcom } from ${JSON.stringify(path.join(stromRepo, "src", "ged-exporter.ts"))};
const [, , input, output, head, rename] = process.argv;
const parsed = parseGedcom(fs.readFileSync(input, "utf8"));
const data = convertToStrom(parsed).data as any;
const sources = Object.values(data.sources ?? {}) as any[];
console.log(JSON.stringify({ dropped: [...parsed.droppedTags.entries()], sources: sources.map((s) => ({ refn: s.refn, reference: s.reference, note: s.note })) }));
if (rename) for (const s of sources) if (s.refn === "S0001") s.title = rename;
const res = exportToGedcom(data, "test") as any;
const text: string = typeof res === "string" ? res : (res.content ?? res.text ?? res.gedcom);
fs.writeFileSync(output, text.replace(/^0 HEAD\\r?\\n/, (h: string) => h + head));
`,
  );
  const app = (out: string, rename = "") => {
    const r = spawnSync(tsx, [script, ged, out, head, rename], { cwd: stromRepo, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    return JSON.parse(r.stdout.trim().split("\n").pop()!);
  };
  const out = app(path.join(w.dir, "from-app.ged"));
  assert.deepEqual(out.dropped, []);
  const s2 = out.sources.find((s: { refn?: string }) => s.refn === "S0002");
  assert.ok(s2, JSON.stringify(out));
  assert.equal(s2.reference, "fol. 7");
  assert.doesNotMatch(s2.note ?? "", /fol\. 7/);
  assert.equal(out.sources.find((s: { refn?: string }) => s.refn === "S0001").reference, "fol. 3");
  assert.match((await w.ok(["sync", path.join(w.dir, "from-app.ged")])).out, /nic nového/);
  app(path.join(w.dir, "renamed.ged"), NEW);
  const shown = (await w.ok(["sync", path.join(w.dir, "renamed.ged")])).out;
  assert.match(shown, /pramen „Křest Josefa Nováka 1885“: přejmenovaný na „Křest Josefa Nováka, Kamenice 1885“ → přejmenuje se/);
  assert.match(shown, /^renamed\.ged: 1 změna proti výzkumu/m, "the rename alone: nothing else of the tree changed on the way");
  w.cleanup();
});
