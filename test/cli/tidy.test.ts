// Order in .strom (Milan, 2026-10-04: "je potřeba udržovat pořádek a neztratit ale ostrá data"): old logs, views of
// scans, work folders of downloads cut short and sends of the app written long ago go — shown first, on the person's
// yes; never the research, the shared images, what anybody made, a send taken back that may be sent again, a link out
// of the tree. An old tree is kept in order by itself only after its first strom tidy.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { autoTidy, tidyOn, tidyPlan } from "../../src/core/tidy.ts";
import { enterWorker } from "../../src/core/workers.ts";
import { noteLive } from "../../src/core/live.ts";

const opts = { skip: !hasGit };
const DAY = 24 * 3600_000;

/** A file of the given size and age. */
function put(file: string, bytes: number | string, daysAgo = 0): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof bytes === "string" ? bytes : Buffer.alloc(bytes, 7));
  const at = new Date(Date.now() - daysAgo * DAY - 3600_000);
  fs.utimesSync(file, at, at);
}

/** What an older strom left in .strom: logs, views, a download cut short, sends kept, a pointer of an agent gone. */
function gathered(root: string): { outside: string } {
  const s = (...p: string[]) => path.join(root, ".strom", ...p);
  const image = `{"type":"image","source":{"type":"base64","media_type":"image/jpeg","data":"${"QUJD".repeat(50_000)}"}}\n`;
  put(s("runs", "N0001.log"), image.repeat(3), 40); // old: goes
  put(s("runs", "N0002.log"), `{"type":"text","text":"Hledám křest"}\n${image.repeat(3)}`, 2); // kept, made smaller
  put(s("briefs", "N0001.md"), "brief", 40);
  put(s("views", "B0001-1-aaaaaaaaaa.jpg"), 1000, 20); // not looked at for 20 days: goes
  put(s("views", "B0001-2-bbbbbbbbbb.jpg"), 1000, 1); // stays
  put(s("excerpts", "S0001-x.jpg"), 1000, 1); // within the limit: stays
  fs.mkdirSync(s("fetch", "demo-1700000000000"), { recursive: true });
  put(s("fetch", "demo-1700000000000", "7.jpg"), 5000, 3); // a download cut short: goes
  const cut = new Date(Date.now() - 3 * DAY);
  fs.utimesSync(s("fetch", "demo-1700000000000"), cut, cut);
  for (let i = 0; i < 7; i++) put(s("sync", "kept", `strom-app-2026-10-0${i}.ged`), 2000, 1 + i / 10); // 5 newest stay
  // a send taken back: kept while the app may send it again
  put(s("sync", "kept", "strom-app-undone.ged"), 2000, 2);
  put(s("sync", "received-R20261004000000000-ab12.json"), JSON.stringify({ intake: "R20261004000000000-ab12", at: new Date(Date.now() - 2 * DAY).toISOString(), file: "x.ged", keptAs: "kept/strom-app-undone.ged", transcripts: "lead", changes: 1, counted: "", state: "undone", decided: new Date(Date.now() - DAY).toISOString(), input: "I0009" }));
  put(s("session-w-gone.json"), JSON.stringify({ id: "N0003" }), 1); // an agent gone, its session not open
  // a link out of the tree, among the views: never followed, never removed
  const outside = path.join(path.dirname(root), "outside-keep.jpg");
  put(outside, 1000, 30);
  fs.symlinkSync(outside, s("views", "link-out.jpg"));
  const at = new Date(Date.now() - 30 * DAY);
  fs.lutimesSync(s("views", "link-out.jpg"), at, at);
  // what a person made: never touched
  put(path.join(root, "notes", "moje.txt"), "Babička říkala…", 400);
  put(path.join(root, "inputs", "I0001-dopis.txt"), "dopis", 400);
  return { outside };
}

test("strom tidy: what goes is shown, the person's yes takes it; the research, links out, sends taken back and what is new stay", opts, async () => {
  const w = new World();
  await w.withTree("Novákovi");
  const { outside } = gathered(w.cwd);
  const has = (...p: string[]) => fs.existsSync(path.join(w.cwd, ".strom", ...p));
  // an agent cannot: nothing goes
  const agent = await w.run(["tidy"]);
  assert.equal(agent.code, 4, agent.out + agent.err);
  // a person without a terminal reads why in their language (found on Mac: in English)
  assert.match(agent.err, /^chyba: tady je potřeba souhlas – Uvolnit asi .* vedle výzkumu Novákovi/m, agent.err);
  assert.match(agent.err, /^→ spustit ve vlastním terminálu: strom tidy$/m, agent.err);
  const byAgent = await w.run(["tidy"], { env: { CLAUDECODE: "1" } });
  assert.match(byAgent.err, /an agent cannot answer this/, "an agent: the English it goes by");
  assert.ok(has("runs", "N0001.log"));
  // shown: what, how much, why
  const shown = await w.ok(["tidy", "--dry-run"]);
  assert.match(shown.out, /Záznamy pracovních sezení: počet 1, celkem .* → smaže se/, shown.out);
  assert.match(shown.out, /Záznamy pracovních sezení: počet 1, celkem .* → zmenší se/, shown.out);
  assert.match(shown.out, /Pracovní složky přerušených stahování: počet 1,/, shown.out);
  assert.match(shown.out, /Starší poslání z aplikace Strom, už zapsaná .*: počet 2,/, shown.out);
  assert.match(shown.out, /Uvolní se asi/, shown.out);
  assert.ok(has("runs", "N0001.log"), "a dry run removes nothing");
  // Enter says no
  await w.run(["tidy"], { tty: true, answers: [""] });
  assert.ok(has("runs", "N0001.log"));
  assert.equal(tidyOn(w.cwd), false);
  // yes
  const done = await w.run(["tidy"], { tty: true, answers: ["a"] });
  assert.equal(done.code, 0, done.out + done.err);
  assert.match(done.out, /✓ Uvolněno/, done.out);
  for (const gone of [["runs", "N0001.log"], ["briefs", "N0001.md"], ["views", "B0001-1-aaaaaaaaaa.jpg"], ["fetch", "demo-1700000000000"], ["sync", "kept", "strom-app-2026-10-05.ged"], ["sync", "kept", "strom-app-2026-10-06.ged"], ["session-w-gone.json"], ["runs", "N0002.log"]])
    assert.ok(!has(...gone), gone.join("/"));
  // the log kept smaller, its words kept, its images left out
  const log = (await import("node:zlib")).gunzipSync(fs.readFileSync(path.join(w.cwd, ".strom", "runs", "N0002.log.gz"))).toString("utf8");
  assert.match(log, /Hledám křest/);
  assert.match(log, /\[image \d+ kB left out\]/);
  for (const kept of [["views", "B0001-2-bbbbbbbbbb.jpg"], ["excerpts", "S0001-x.jpg"], ["sync", "kept", "strom-app-undone.ged"], ["sync", "kept", "strom-app-2026-10-00.ged"], ["sync", "kept", "strom-app-2026-10-04.ged"]])
    assert.ok(has(...kept), kept.join("/"));
  assert.ok(fs.lstatSync(path.join(w.cwd, ".strom", "views", "link-out.jpg")).isSymbolicLink(), "a link stays");
  assert.ok(fs.existsSync(outside), "what it leads to stays");
  for (const f of ["notes/moje.txt", "inputs/I0001-dopis.txt", "strom.json"]) assert.ok(fs.existsSync(path.join(w.cwd, f)), f);
  assert.equal((await w.ok(["check"])).code, 0);
  assert.ok(tidyOn(w.cwd), "kept in order from now on");
  assert.match(fs.readFileSync(path.join(w.cwd, ".strom", "tidy.log"), "utf8"), /strom tidy: \d+ removed, 1 shrunk/);
  // nothing more
  assert.match((await w.ok(["tidy"], { tty: true })).out, /Není co uklízet/);
  w.cleanup();
});

test("an old tree is kept in order by itself only after its first strom tidy; one with nothing gathered from the first look", opts, async () => {
  const w = new World();
  await w.withTree("Novákovi");
  const tree = () => Tree.open(w.cwd, { ...process.env, ...w.env });
  // nothing gathered: in order from now on
  autoTidy(tree());
  assert.ok(tidyOn(w.cwd));
  fs.rmSync(path.join(w.cwd, ".strom", "tidy.json"));
  // what an older strom left: nothing goes unasked
  gathered(w.cwd);
  const before = tidyPlan(tree()).items.length;
  assert.ok(before > 5, String(before));
  autoTidy(tree());
  assert.equal(tidyPlan(tree()).items.length, before, "nothing went by itself");
  assert.equal(tidyOn(w.cwd), false);
  // the status says it, and what it frees
  assert.match((await w.ok(["status"])).out, /^Na disku: výzkum .* · vedle něj si strom drží .*$/m);
  // tidied once: then by itself
  await w.run(["tidy"], { tty: true, answers: ["a"] });
  fs.mkdirSync(path.join(w.cwd, ".strom", "fetch", "demo-1600000000000"), { recursive: true });
  const at = new Date(Date.now() - 3 * DAY);
  fs.utimesSync(path.join(w.cwd, ".strom", "fetch", "demo-1600000000000"), at, at);
  autoTidy(tree());
  assert.ok(!fs.existsSync(path.join(w.cwd, ".strom", "fetch", "demo-1600000000000")));
  // never while somebody is at work: an agent may have a view open
  const view = path.join(w.cwd, ".strom", "views", "B0002-1-cccccccccc.jpg");
  put(view, 1000, 30);
  const leave = enterWorker(w.cwd, "w-test", "a test");
  try {
    assert.ok(!tidyPlan(tree()).items.some((i) => i.kind === "views"));
    autoTidy(tree());
    assert.ok(fs.existsSync(view));
  } finally {
    leave();
  }
  autoTidy(tree());
  assert.ok(!fs.existsSync(view));
  w.cleanup();
});

test("a bridge's last word never makes again the folder of a research moved away", () => {
  const dir = fs.mkdtempSync(path.join((process.env.TMPDIR ?? "/tmp"), "strom-moved-"));
  const gone = path.join(dir, "Novákovi");
  noteLive(gone, "ended: the research is no longer there");
  assert.ok(!fs.existsSync(gone));
  fs.rmSync(dir, { recursive: true, force: true });
});
