// A research whose agent is not on this computer waits for it and acts as an archive meanwhile (Milan's decision,
// 2026-10-15): what the app sends is mirrored, no task is made, the bridge, the orientation and the plan say nothing of
// an agent, a queue or a cost — and nothing is stored for it: the agent installed, it is research again with its tasks.
// An archive is the person's choice alone, with an agent here too (the setup, the settings), and stays one.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { enterWorker } from "../../src/core/workers.ts";
import type { Person, Task } from "../../src/core/model.ts";
import { edited, get } from "./sync.helpers.ts";

const opts = { skip: !hasGit || process.platform === "win32" };

/** No agent on this computer: only Node, git and the system's own programs. */
function noAgent(w: World): void {
  w.env.PATH = [path.dirname(process.execPath), "/usr/bin", "/bin"].join(path.delimiter);
}

/** An agent installed: a fake Claude Code (or another) first on PATH. */
function installAgent(w: World, command = "claude"): void {
  const bin = path.join(w.dir, "bin");
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(path.join(bin, command), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  if (!w.env.PATH!.split(path.delimiter).includes(bin)) w.env.PATH = [bin, w.env.PATH].join(path.delimiter);
}

function uninstallAgent(w: World, command = "claude"): void {
  fs.rmSync(path.join(w.dir, "bin", command), { force: true });
}

const userConfig = (w: World) => readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json")) as Record<string, unknown>;
const stored = (root: string) => (readJsonFile(path.join(root, "strom.json")) as { mode?: string }).mode;
const commits = (w: World) => Number(execFileSync("git", ["rev-list", "--count", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim());

/** The data the app's sync tests use, then the file as the app gives it back (Karel taken out, Marie added, dates changed). */
async function people(w: World): Promise<string> {
  await w.ok(["source", "add", "Křest Josefa Nováka 1885", "--kind", "baptism", "--transcript", "Josef, syn Jana Nováka."]);
  await w.ok(["person", "add", "Josef /Novák/", "--sex", "M"]);
  await w.ok(["event", "add", "P1", "CHR", "--date", "3 MAR 1885", "--place", "Kamenice", "--cite", "S1"]);
  await w.ok(["person", "add", "Anna /Dvořáková/", "--sex", "F", "--born", "1888"]);
  await w.ok(["person", "add", "Karel /Novák/", "--sex", "M"]);
  await w.ok(["family", "add", "--partner", "P1", "--partner", "P2"]);
  const ged = path.join(w.dir, "strom.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", ged]);
  return edited(ged, path.join(w.dir, "z-aplikace.ged"));
}

/** K1.1 + K1.2: mirrored, nothing made for an agent; the bridge, the orientation and the plan as an archive's. */
async function actsAsArchive(w: World, label: string): Promise<void> {
  const file = await people(w);
  const tasksBefore = Tree.open(w.cwd, w.env).list<Task>("task").length;
  const plan = await w.ok(["sync", file]);
  assert.match(plan.out, /^Archiv Stromu: úpravy z aplikace platí, co v aplikaci už není, se odvolá s důvodem$/m, `${label}: mirrored\n${plan.out}`);
  await w.ok(["sync", file, "--apply"]);
  const tree = Tree.open(w.cwd, w.env);
  const karel = tree.list<Person>("person").find((p) => p.names[0]?.given === "Karel")!;
  assert.match(karel.retracted?.reason ?? "", /odebráno v aplikaci Strom/, `${label}: what the app no longer has withdrawn`);
  assert.equal(tree.list<Task>("task").length, tasksBefore, `${label}: no task made (verify or other)`);
  assert.equal((await w.ok(["conflict", "list", "--json"])).json.length ?? 0, 0, `${label}: the user's word wins`);
  // the orientation and the plan: nothing of a session or a queue
  const orientation = await w.ok([]);
  assert.match(orientation.out, /čeká na svého AI agenta|agent výzkumu na tomto počítači není/u, `${label}\n${orientation.out}`);
  assert.doesNotMatch(orientation.out, /session start|strom run|ve frontě|queue/i, `${label}\n${orientation.out}`);
  const plan2 = await w.ok(["plan"]);
  assert.match(plan2.out, /čeká na AI agenta na tomto počítači: dokud tu žádný není, nic se neplánuje/u, `${label}\n${plan2.out}`);
  // the bridge: no agent, queue, spend or estimate; said that the agent is missing; written as the user's word
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const st = JSON.parse((await get(`${info.url}/status?poll=1`)).body);
    assert.equal(st.agent, undefined, label);
    assert.equal(st.spend, undefined, label);
    assert.deepEqual([st.queue ?? [], st.queueMore ?? 0, st.researches ?? [], st.working ?? [], st.waiting ?? []], [[], 0, [], [], []], label);
    assert.deepEqual({ mode: st.accepts.mode, agentHere: st.accepts.agentHere, auto: st.accepts.sync.auto }, { mode: "research", agentHere: false, auto: "mirror" }, label);
    assert.equal(st.accepts.media?.estimate ?? null, null, label);
  } finally {
    await w.ok(["live", "stop"]);
  }
}

test("K1.4 setup --yes + init with no agent: nothing stored, the research waits for its agent and acts as an archive (K1.1, K1.2, K2.4)", opts, async () => {
  const w = new World();
  noAgent(w);
  await w.ok(["setup", "--yes"]);
  assert.equal(userConfig(w).mode, undefined, "the setup with no agent sets no archive for new researches (K2.4)");
  await w.ok(["init", "Novákovi"]);
  w.cwd = w.treeDir("Novákovi");
  assert.equal(stored(w.cwd), undefined);
  assert.deepEqual((await w.ok(["mode", "--json"])).json, { mode: "research", state: "waiting" });
  assert.match((await w.ok(["mode"])).out, /Tento výzkum čeká na AI agenta na tomto počítači/);
  await actsAsArchive(w, "setup + init");
  w.cleanup();
});

test("K1.3 the agent installed: research again by itself — the tasks it had in place, none put aside, the stored mode never changed", opts, async () => {
  const w = new World();
  noAgent(w);
  await w.withTree();
  // material from the family while it waits: its task waits for the agent (not put aside)
  await w.ok(["intake", "--text", "Děda Josef byl mlynář"]);
  const open = () => Tree.open(w.cwd, w.env).list<Task>("task");
  assert.ok(open().some((t) => t.state === "open" && !t.heldBy));
  const before = commits(w);
  installAgent(w);
  assert.deepEqual((await w.ok(["mode", "--json"])).json, { mode: "research", state: "research" });
  assert.equal(stored(w.cwd), undefined, "nothing written for the agent");
  assert.equal(commits(w), before, "nothing committed for the agent");
  assert.ok(open().some((t) => t.state === "open" && !t.heldBy), "the tasks in place");
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const st = JSON.parse((await get(`${info.url}/status?poll=1`)).body);
    assert.equal(st.accepts.agentHere, undefined, "the agent here: nothing said");
    assert.equal(st.accepts.sync.auto, "write");
    assert.equal(st.agent?.id, "claude");
    assert.ok((st.queue ?? []).length > 0, "the queue again");
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});

test("K1.4 the agent uninstalled: the research waits for it and acts as an archive", opts, async () => {
  const w = new World();
  noAgent(w);
  installAgent(w);
  await w.withTree();
  assert.deepEqual((await w.ok(["mode", "--json"])).json, { mode: "research", state: "research" });
  uninstallAgent(w);
  await actsAsArchive(w, "uninstalled");
  assert.equal(stored(w.cwd), undefined);
  w.cleanup();
});

test("K1.4 the menu's new family tree with no agent: the research waits for its agent", opts, async () => {
  const w = new World();
  noAgent(w);
  await w.ok(["setup", "--yes"]);
  const r = await w.ok([], { tty: true, answers: ["Svobodovi", "0"] });
  assert.match(r.out, /Výzkum čeká na AI agenta: dokud na počítači žádný není, data z aplikace Strom se ukládají jako v Archivu Stromu\./, r.out);
  w.cwd = w.treeDir("Svobodovi");
  assert.equal(stored(w.cwd), undefined);
  await actsAsArchive(w, "menu");
  w.cleanup();
});

test("K1.4 a research unpacked on a computer with no agent: it waits for its agent", opts, async () => {
  const a = new World();
  noAgent(a);
  installAgent(a);
  await a.withTree("Dvořákovi");
  await a.ok(["person", "add", "Jan /Dvořák/", "--sex", "M"]);
  const zip = path.join(a.dir, "Dvořákovi.zip");
  await a.ok(["pack", "--out", zip]);
  const b = new World();
  noAgent(b);
  await b.ok(["setup", "--yes"]);
  await b.ok(["unpack", zip], { answers: ["a"] });
  b.cwd = b.treeDir("Dvořákovi");
  assert.equal(stored(b.cwd), undefined);
  assert.deepEqual((await b.ok(["mode", "--json"])).json, { mode: "research", state: "waiting" });
  await actsAsArchive(b, "unpack");
  a.cleanup();
  b.cleanup();
});

test("K1.5 + K3.2 the menu waiting for an agent: an archive's — get the agent, or keep it only as an archive (stored on a yes); nothing of the agent's own work", opts, async () => {
  const w = new World();
  noAgent(w);
  await w.withTree();
  const r = await w.ok([], { tty: true, answers: ["0"] });
  assert.match(r.out, /Výzkum čeká na AI agenta/);
  assert.match(r.out, / 1 {2}Nainstalovat nebo vybrat AI agenta\n {3}2 {2}Nechat jen jako Archiv Stromu: ukládat data z aplikace Strom\n {3}3 {2}Co čeká/, r.out);
  assert.match(r.out, /Přidat do Archivu Stromu/);
  assert.doesNotMatch(r.out, /pracovat samotného|Tento výzkum pracuje s agentem|Tentokrát mluvit s jiným agentem/, r.out);
  // the settings say what it is (never "works with an agent")
  const s = await w.ok([], { tty: true, answers: ["8", "5", "0", "0", "0"] });
  assert.match(s.out, /Tento výzkum čeká na AI agenta/);
  assert.doesNotMatch(s.out, /Tento výzkum pracuje s agentem|Nechat agenta pracovat samotného/);
  // keep it as an archive: said no — nothing changes; a yes — stored
  await w.ok([], { tty: true, answers: ["2", "n", "0"] });
  assert.equal(stored(w.cwd), undefined);
  const k = await w.ok([], { tty: true, answers: ["2", "a", "", "0"] });
  assert.match(k.out, /Výzkum je teď Archiv Stromu/);
  assert.equal(stored(w.cwd), "archive");
  w.cleanup();
});

test("K3.1 switch research on in an archive with no agent: the agent offered first; later — the archive as it was, nothing written or committed, a sentence says why", opts, async () => {
  const w = new World();
  noAgent(w);
  await w.ok(["setup", "--yes"]);
  await w.ok(["init", "Archiv", "--mode", "archive"]);
  w.cwd = w.treeDir("Archiv");
  const before = commits(w);
  // 1 switch research on · 3 later · Enter · 0
  const r = await w.ok([], { tty: true, answers: ["1", "3", "", "0"] });
  assert.match(r.out, /Na tomto počítači zatím není agent, se kterým pracovat/);
  assert.match(r.out, /Archiv Stromu zůstává beze změny: výzkum jde zapnout, až bude na počítači AI agent\./);
  assert.equal(stored(w.cwd), "archive");
  assert.equal(commits(w), before);
  w.cleanup();
});

test("K3.3 research switched on where the setup never asked the agent's steps: offered then", opts, async () => {
  const w = new World();
  noAgent(w);
  await w.ok(["setup", "--yes"]);
  await w.ok(["init", "Archiv", "--mode", "archive"]);
  w.cwd = w.treeDir("Archiv");
  installAgent(w);
  // 1 switch research on · a yes · the setup's steps: no · Enter · 0
  const r = await w.ok([], { tty: true, answers: ["1", "a", "n", "", "0"] });
  assert.match(r.out, /Práce s agentem je zapnutá/);
  assert.match(r.out, /Nastavit teď agenta \(model, kde mluvit, co smí sám\)\?/);
  assert.equal(stored(w.cwd), undefined);
  w.cleanup();
});

test("K2.1 an archive with an agent here stays one: started again, strom updated, another agent installed", opts, async () => {
  const w = new World();
  noAgent(w);
  installAgent(w);
  await w.ok(["setup", "--yes"]);
  await w.ok(["init", "Archiv", "--mode", "archive"]);
  w.cwd = w.treeDir("Archiv");
  const check = async (label: string) => {
    assert.deepEqual((await w.ok(["mode", "--json"])).json, { mode: "archive", state: "archive" }, label);
    const menu = await w.ok([], { tty: true, answers: ["0"] });
    assert.match(menu.out, /Archiv Stromu: data přicházejí z aplikace Strom\./, label);
    assert.equal(stored(w.cwd), "archive", label);
  };
  await check("started again");
  // the first run of another strom (an update): what strom put outside the trees refreshed, the archive kept
  const cfg = userConfig(w);
  fs.writeFileSync(path.join(w.env.STROM_CONFIG_DIR!, "config.json"), JSON.stringify({ ...cfg, lastVersion: "1.0.0" }));
  await check("updated");
  installAgent(w, "codex");
  await check("another agent");
  w.cleanup();
});

test("K2.2 + K2.4 the setup with an agent here asks research or only an archive; with none it asks nothing and sets nothing", opts, async () => {
  const w = new World();
  noAgent(w);
  const question = /Čím má být nový výzkum na tomto počítači\?\n\s+1\s+Výzkum s agentem Claude Code: hledá předky v matrikách a archivech \(doporučeno\)\n\s+2\s+Jen Archiv Stromu – ukládat data z aplikace Strom\n(?:\s+0\s+Nechat, jak je\n)?Vybrat \[(\d)\]/u;
  // no agent here: nothing asked, nothing set (the research waits for its agent)
  const none = await w.ok(["setup"], { tty: true, answers: Array(20).fill("") });
  assert.doesNotMatch(none.out, /Čím má být nový výzkum/);
  assert.match(none.out, /Bez AI agenta na počítači drží výzkum data z aplikace Strom jako Archiv Stromu/);
  assert.equal(userConfig(w).mode, undefined);
  installAgent(w);
  // run again with an agent here: research suggested, kept on Enter
  const research = await w.ok(["setup"], { tty: true, answers: Array(30).fill("") });
  assert.equal(research.out.match(question)?.[1], "1", research.out);
  assert.equal(userConfig(w).mode, undefined);
  // the language, the folder · 2 only an archive — new researches are archives, the agent's steps not asked
  const archive = await w.ok(["setup"], { tty: true, answers: ["", "", "2", ...Array(20).fill("")] });
  assert.equal(archive.out.match(question)?.[1], "1", archive.out);
  assert.equal(userConfig(w).mode, "archive");
  assert.doesNotMatch(archive.out, /Který model má výzkum dělat\?/);
  await w.ok(["init", "Archiv"]);
  assert.equal(stored(w.treeDir("Archiv")), "archive");
  // run again from an archive: nothing of an agent asked, the archive kept (research: the menu, or the settings)
  const again = await w.ok(["setup"], { tty: true, answers: Array(20).fill("") });
  assert.doesNotMatch(again.out, /Čím má být nový výzkum|agent/i, again.out);
  assert.equal(userConfig(w).mode, "archive");
  w.cleanup();
});

test("K2.3 the settings: what new researches are — research or only an archive; a new tree is made so", opts, async () => {
  const w = new World();
  noAgent(w);
  installAgent(w);
  await w.withTree();
  // 8 settings · 5 research or archive · 4 new researches: only an archive · Enter · 0 · 0
  const r = await w.ok([], { tty: true, answers: ["8", "5", "4", "", "0", "0"] });
  assert.match(r.out, /Nové výzkumy na tomto počítači: výzkum: hledání v matrikách a archivech\./);
  assert.match(r.out, / 3 {2}Nové výzkumy: výzkum – hledání v matrikách a archivech\n {3}4 {2}Nové výzkumy: jen Archiv Stromu s daty z aplikace Strom/);
  assert.equal(userConfig(w).mode, "archive");
  assert.equal(stored(w.cwd), undefined, "this research as it was");
  await w.ok(["init", "Druhý"]);
  assert.equal(stored(w.treeDir("Druhý")), "archive");
  // back: research for new ones
  await w.ok([], { tty: true, answers: ["8", "5", "3", "", "0", "0"] });
  assert.equal(userConfig(w).mode, undefined);
  w.cleanup();
});

test("K4.6 an archive's bridge: no directions, nobody at work, nothing waiting for the person", opts, async () => {
  const w = new World();
  noAgent(w);
  installAgent(w);
  await w.withTree();
  await w.ok(["person", "add", "Jan /Novák/", "--sex", "M", "--born", "1900"]);
  await w.ok(["research", "new", "Předci Jana", "--person", "P1"]);
  await w.ok(["task", "add", "Křest Jana Nováka (~1900)", "--level", "locate", "--where", "farnost Sloup", "--why", "zkouška", "--done-when", "hotovo", "--about", "P1"]);
  const id = Tree.open(w.cwd, w.env).list<Task>("task").at(-1)!.id;
  await w.ok(["task", "wait", id, "--on", "Uložit snímky knihy ručně"]);
  await w.ok(["mode", "archive"], { tty: true });
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const st = JSON.parse((await get(`${info.url}/status?poll=1`)).body);
    assert.deepEqual([st.researches ?? [], st.working ?? [], st.waiting ?? [], st.queue ?? []], [[], [], [], []]);
    assert.equal(st.agent, undefined);
    assert.equal(st.accepts.mode, "archive");
    assert.equal(st.accepts.agentHere, undefined, "an archive with its agent here: nothing missing");
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});

test("an agent at work in a research whose own agent is not here (strom run --agent …): research while it works, waiting again after", opts, async () => {
  const w = new World();
  await w.withTree("Dvořákovi");
  noAgent(w);
  assert.deepEqual((await w.ok(["mode", "--json"])).json, { mode: "research", state: "waiting" });
  const leave = enterWorker(w.cwd, "run-1", "Script on its own");
  try {
    assert.deepEqual((await w.ok(["mode", "--json"])).json, { mode: "research", state: "research" });
  } finally {
    leave();
  }
  assert.deepEqual((await w.ok(["mode", "--json"])).json, { mode: "research", state: "waiting" });
  assert.equal(stored(w.cwd), undefined, "nothing stored either way");
  w.cleanup();
});
