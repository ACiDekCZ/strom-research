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
import { autoTidy, tidyAskAgain, tidyAsked, tidyOn, tidyPlan } from "../../src/core/tidy.ts";
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
  // photos and PDF pages converted for reading: one not used for 40 days goes (its folder whole), one used stays
  put(s("converted", "0123456789abcdef", "1.jpg"), 3000, 40);
  put(s("converted", "0123456789abcdef", "info.json"), '{"pages":1,"how":"sips"}', 40);
  const old = new Date(Date.now() - 40 * DAY);
  fs.utimesSync(s("converted", "0123456789abcdef"), old, old);
  put(s("converted", "fedcba9876543210", "1.jpg"), 3000, 1);
  // the app's previews of the material: one not asked for 70 days goes, one asked stays
  put(s("thumbs", `${"a".repeat(64)}-256.jpg`), 2000, 70);
  put(s("thumbs", `${"b".repeat(64)}-256.jpg`), 2000, 1);
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
  assert.match(shown.out, /Fotky a strany PDF převedené pro čtení .*: počet 1,/, shown.out);
  assert.match(shown.out, /Malé náhledy materiálů pro aplikaci Strom .*: počet 1,/, shown.out);
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
  for (const gone of [["runs", "N0001.log"], ["briefs", "N0001.md"], ["views", "B0001-1-aaaaaaaaaa.jpg"], ["fetch", "demo-1700000000000"], ["converted", "0123456789abcdef"], ["sync", "kept", "strom-app-2026-10-05.ged"], ["sync", "kept", "strom-app-2026-10-06.ged"], ["session-w-gone.json"], ["runs", "N0002.log"], ["thumbs", `${"a".repeat(64)}-256.jpg`]])
    assert.ok(!has(...gone), gone.join("/"));
  // the log kept smaller, its words kept, its images left out
  const log = (await import("node:zlib")).gunzipSync(fs.readFileSync(path.join(w.cwd, ".strom", "runs", "N0002.log.gz"))).toString("utf8");
  assert.match(log, /Hledám křest/);
  assert.match(log, /\[image \d+ kB left out\]/);
  for (const kept of [["views", "B0001-2-bbbbbbbbbb.jpg"], ["converted", "fedcba9876543210", "1.jpg"], ["thumbs", `${"b".repeat(64)}-256.jpg`], ["excerpts", "S0001-x.jpg"], ["sync", "kept", "strom-app-undone.ged"], ["sync", "kept", "strom-app-2026-10-00.ged"], ["sync", "kept", "strom-app-2026-10-04.ged"]])
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
  const has = (...p: string[]) => fs.existsSync(path.join(w.cwd, ".strom", ...p));
  // nothing gathered: in order from now on
  autoTidy(tree());
  assert.ok(tidyOn(w.cwd));
  fs.rmSync(path.join(w.cwd, ".strom", "tidy.json"));
  // what an older strom left, the person never asked (or said no): only what strom makes again goes by itself, and
  // the logs are made smaller — never one removed (found 2026-10-27: 8 GB of views after a no)
  gathered(w.cwd);
  fs.writeFileSync(path.join(w.cwd, ".strom", "tidy.json"), JSON.stringify({ auto: false, asked: "2026-10-22T10:00:00.000Z" }) + "\n");
  // a log of 25 MB with one image of 24 MB in it (the old tidy's regular expression: "Maximum call stack size exceeded")
  put(path.join(w.cwd, ".strom", "runs", "N0004.log"), `{"type":"text","text":"Lhoták z Lhoty"}\n{"data":"${"QUJD".repeat(6_000_000)}"}\n{"type":"text","text":"konec"}\n`, 3);
  const before = tidyPlan(tree()).items.length;
  assert.ok(before > 5, String(before));
  autoTidy(tree());
  for (const gone of [["views", "B0001-1-aaaaaaaaaa.jpg"], ["fetch", "demo-1700000000000"], ["converted", "0123456789abcdef"], ["thumbs", `${"a".repeat(64)}-256.jpg`], ["briefs", "N0001.md"], ["runs", "N0001.log"], ["runs", "N0002.log"], ["runs", "N0004.log"]])
    assert.ok(!has(...gone), `went by itself: ${gone.join("/")}`);
  // the logs only made smaller, their text whole — the old one too, which only the person's yes removes
  const zlib = await import("node:zlib");
  for (const n of ["N0001", "N0002", "N0004"]) assert.ok(has("runs", `${n}.log.gz`), n);
  const big = zlib.gunzipSync(fs.readFileSync(path.join(w.cwd, ".strom", "runs", "N0004.log.gz"))).toString("utf8");
  assert.equal(big, '{"type":"text","text":"Lhoták z Lhoty"}\n{"data":"[image 17578 kB left out]"}\n{"type":"text","text":"konec"}\n');
  // the rest waits for the person
  for (const kept of [["sync", "kept", "strom-app-2026-10-05.ged"], ["sync", "kept", "strom-app-2026-10-06.ged"], ["session-w-gone.json"], ["views", "B0001-2-bbbbbbbbbb.jpg"], ["excerpts", "S0001-x.jpg"]])
    assert.ok(has(...kept), `waits for the person: ${kept.join("/")}`);
  assert.ok(tidyPlan(tree()).items.some((i) => i.kind === "kept"));
  assert.match(fs.readFileSync(path.join(w.cwd, ".strom", "tidy.log"), "utf8"), /kept in order: \d+ removed, 3 shrunk/);
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

test("an old tree's first tidy is offered once in the menu: shown, asked (Enter says no), never again unasked", opts, async () => {
  const w = new World();
  await w.withTree("Novákovi");
  gathered(w.cwd);
  // much gathered by an older strom: a log of a session long ago (sparse: big, nothing written)
  const big = path.join(w.cwd, ".strom", "runs", "N0003.log");
  put(big, "x", 40);
  fs.truncateSync(big, 150 * 1024 * 1024);
  const at = new Date(Date.now() - 40 * DAY);
  fs.utimesSync(big, at, at);
  const tree = () => Tree.open(w.cwd, { ...process.env, ...w.env });
  const before = tidyPlan(tree()).items.length;
  // asked once: what goes shown, Enter says no — nothing goes, nor by itself after
  const first = await w.run([], { tty: true, answers: ["", "0"] });
  assert.match(first.out, /Vedle výzkumu se nastřádalo, co jde uvolnit/);
  assert.match(first.out, /Uvolnit/);
  assert.ok(fs.existsSync(big));
  assert.equal(tidyOn(w.cwd), false);
  assert.equal(tidyPlan(tree()).items.length, before);
  // never asked again: only said
  const again = await w.run([], { tty: true, answers: ["0"] });
  assert.doesNotMatch(again.out, /se nastřádalo/);
  assert.match(again.out, /z toho jde uvolnit/);
  assert.ok(fs.existsSync(big));
  // an agent's strom never asks
  fs.rmSync(path.join(w.cwd, ".strom", "tidy.json"));
  const agent = await w.run([], { tty: true, answers: ["0"], env: { CLAUDECODE: "1" } });
  assert.doesNotMatch(agent.out, /se nastřádalo/);
  // nobody to ask (no terminal, STROM_NONINTERACTIVE): not offered, nor remembered as asked
  const unattended = await w.run(["menu"], { answers: ["0"], env: { STROM_NONINTERACTIVE: "1" } });
  assert.doesNotMatch(unattended.out, /se nastřádalo/);
  assert.equal(tidyAsked(w.cwd), false);
  // the person's yes: freed, kept in order by itself from then on
  fs.rmSync(path.join(w.cwd, ".strom", "tidy.json"), { force: true });
  await w.run([], { tty: true, answers: ["a", "0"] });
  assert.ok(!fs.existsSync(big));
  assert.ok(tidyOn(w.cwd));
  w.cleanup();
});

test("said no, then grown far beyond the research: asked once more in the menu, never a third time", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  const file = path.join(w.cwd, ".strom", "tidy.json");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ auto: false, asked: "2026-10-22T10:00:00.000Z" }) + "\n");
  const tree = () => Tree.open(w.cwd, { ...process.env, ...w.env });
  // a log of a session long ago, only the person's yes removes it (sparse: big, nothing written)
  const big = path.join(w.cwd, ".strom", "runs", "N0003.log");
  put(big, "x", 40);
  fs.truncateSync(big, 600 * 1024 * 1024);
  const at = new Date(Date.now() - 40 * DAY);
  fs.utimesSync(big, at, at);
  // grown, but not past its mark (at least 1 GB): only said
  assert.equal(tidyAskAgain(w.cwd, tidyPlan(tree())), false);
  const quiet = await w.run([], { tty: true, answers: ["0"] });
  assert.doesNotMatch(quiet.out, /narostlo na/, quiet.out);
  assert.match(quiet.out, /z toho jde uvolnit/);
  // past it: asked once more (Enter says no), what goes shown
  fs.truncateSync(big, 1200 * 1024 * 1024);
  fs.utimesSync(big, at, at);
  assert.equal(tidyAskAgain(w.cwd, tidyPlan(tree())), true);
  const again = await w.run([], { tty: true, answers: ["", "0"] });
  assert.match(again.out, /Co si strom drží vedle výzkumu, narostlo na 1,2 GB/, again.out);
  assert.match(again.out, /Uvolnit\?/);
  assert.ok(fs.existsSync(big));
  const j = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(j.asked, "2026-10-22T10:00:00.000Z", "the first question's day kept");
  assert.equal(typeof j.askedAgain, "string");
  assert.equal(tidyAskAgain(w.cwd, tidyPlan(tree())), false);
  // never a third time: only said
  const third = await w.run([], { tty: true, answers: ["0"] });
  assert.doesNotMatch(third.out, /narostlo na|Uvolnit\?/);
  assert.match(third.out, /z toho jde uvolnit/);
  // the mark: 20 times the research, at least 1 GB, at most 5 GB
  const GB = 1024 ** 3;
  const plan = (strom: number, research: number) => ({ size: { strom, research } });
  fs.writeFileSync(file, JSON.stringify({ auto: false, asked: "2026-10-22T10:00:00.000Z" }) + "\n");
  assert.equal(tidyAskAgain(w.cwd, plan(0.9 * GB, 10 * 1024 ** 2)), false);
  assert.equal(tidyAskAgain(w.cwd, plan(1.1 * GB, 10 * 1024 ** 2)), true);
  assert.equal(tidyAskAgain(w.cwd, plan(1.9 * GB, 100 * 1024 ** 2)), false);
  assert.equal(tidyAskAgain(w.cwd, plan(2.1 * GB, 100 * 1024 ** 2)), true);
  assert.equal(tidyAskAgain(w.cwd, plan(5.1 * GB, GB)), true);
  // never asked, or kept in order: nothing to ask again
  fs.rmSync(file);
  assert.equal(tidyAskAgain(w.cwd, plan(9 * GB, 0)), false);
  w.cleanup();
});

test("by itself, the logs are made smaller within a budget, the newest first, the rest the next time; the person's strom tidy all at once", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  const tree = () => Tree.open(w.cwd, { ...process.env, ...w.env });
  const runs = path.join(w.cwd, ".strom", "runs");
  const image = `{"data":"${"QUJD".repeat(50_000)}"}\n`;
  // five closed logs of 600 kB, N0001 the oldest
  for (let i = 1; i <= 5; i++) put(path.join(runs, `N000${i}.log`), `{"type":"text","text":"Lhoták ${i}"}\n${image.repeat(3)}`, 10 - i);
  const gz = () => fs.readdirSync(runs).filter((f) => f.endsWith(".log.gz")).sort();
  // a budget of two logs: the two newest
  autoTidy(tree(), { bytes: 1_000_000, ms: 60_000 });
  assert.deepEqual(gz(), ["N0004.log.gz", "N0005.log.gz"]);
  assert.match(fs.readFileSync(path.join(w.cwd, ".strom", "tidy.log"), "utf8"), /kept in order: 0 removed, 2 shrunk, .* 3 logs left for next time/);
  // the next time goes on
  autoTidy(tree(), { bytes: 1_000_000, ms: 60_000 });
  assert.deepEqual(gz(), ["N0002.log.gz", "N0003.log.gz", "N0004.log.gz", "N0005.log.gz"]);
  // out of time: nothing begun
  autoTidy(tree(), { bytes: 1_000_000, ms: 0 });
  assert.ok(fs.existsSync(path.join(runs, "N0001.log")));
  autoTidy(tree(), { bytes: 1_000_000, ms: 60_000 });
  assert.equal(gz().length, 5);
  for (let i = 1; i <= 5; i++) assert.ok(!fs.existsSync(path.join(runs, `N000${i}.log`)));
  // the person's strom tidy: no budget
  for (let i = 6; i <= 9; i++) put(path.join(runs, `N000${i}.log`), `{"type":"text","text":"Lhoták ${i}"}\n${image.repeat(3)}`, 1);
  const done = await w.run(["tidy"], { tty: true, answers: ["a"] });
  assert.equal(done.code, 0, done.out + done.err);
  assert.equal(gz().length, 9);
  w.cleanup();
});
