// strom-research:// links from the Strom app: each part checked, an excerpt opened in full by its mark
// (_STROM_CLIP), the tree sent back through a terminal — and the scheme registered for this user alone.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { decodeImage, encodeImage, imageSize } from "../../src/image/index.ts";
import { resize } from "../../src/image/image.ts";
import { validateGedcom } from "../../src/gedcom/validate.ts";
import { LinkError, linkActions, linkHandlerState, linkText, LINUX_ENTRY, linuxDesktopEntry, macScript, parseLink, registerLinks, unregisterLinks, windowsCommand } from "../../src/core/links.ts";
import { clipMark } from "../../src/core/excerpt.ts";
import { Tree } from "../../src/core/tree.ts";
import type { Media } from "../../src/core/model.ts";
import { opts, fixtures, ID, world } from "./links.helpers.ts";

test("the bridge says which links work here (none unless registered) and serves each excerpt's mark to an app that reads it", { skip: !hasGit || process.platform === "win32" }, async () => {
  const { w, mark } = await world();
  await w.ok(["config", "set", "strom.app.url", "https://beta.stromapp.info/run/"]);
  await w.ok(["task", "add", "Křest Marie", "--level", "locate", "--where", "matriky farnosti", "--why", "rodiče", "--done-when", "zápis", "--about", "P0001"]);
  await w.ok(["task", "wait", "T0001", "--on", "Poslat odkaz na knihu."]);
  await w.ok(["person", "add", "Marie /Nováková/", "--sex", "F"]);
  await w.ok(["task", "add", "Sňatek", "--level", "locate", "--where", "matriky farnosti", "--why", "rodina", "--done-when", "zápis", "--about", "P0001", "--about", "P0002"]);
  // a new version of a couple's approved story waits too, as the menu counts it
  await w.ok(["family", "add", "--partner", "P0001", "--partner", "P0002"]);
  await w.ok(["story", "set", "F0001", "--text", "Jan a Marie se vzali.", "--fact", "E0001", "--final"]);
  await w.ok(["story", "set", "F0001", "--text", "Jan a Marie se vzali v Týnci.", "--fact", "E0001"]);
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const status = (await (await fetch(`${info.url}/status`)).json()) as { links: string[]; waiting: { id: string; at: string; person?: string }[]; queue: { id: string; person?: string }[] };
    assert.deepEqual(status.links, []);
    // since when a task waits: the app shows it
    assert.equal(status.waiting[0]?.id, "T0001");
    assert.ok(Date.now() - Date.parse(status.waiting[0]!.at) < 60_000, status.waiting[0]?.at);
    // the one person a task is about, for the app's badge on them; about two: none
    assert.equal(status.waiting[0]?.person, "P0001");
    const story = status.waiting.find((x) => (x as { kind?: string }).kind === "story") as Record<string, string> | undefined;
    assert.deepEqual(story && { id: story.id, person: story.person, partner: story.partner }, { id: "F0001", person: "P0001", partner: "P0002" }, JSON.stringify(status.waiting));
    assert.match(story!.what ?? "", /Nová verze vyprávění o Jan Novák & Marie Nováková/);
    const both = status.queue.find((q) => q.id === "T0002");
    assert.ok(both && !("person" in both), JSON.stringify(status.queue));
    // when the research last changed: the time of its last commit
    const git = (...args: string[]) => spawnSync("git", args, { cwd: w.cwd, encoding: "utf8" }).stdout.trim();
    assert.equal((status as { headAt?: string }).headAt, git("log", "-1", "--format=%cI"));
    // what the research saved, newest first, each commit with the task it was saved for
    await w.ok(["session", "start", "T0002"]);
    await w.ok(["person", "add", "Karel /Novák/", "--sex", "M"]);
    await w.ok(["session", "close", "--summary", "Karel zapsán.", "--continue", "--next", "Sňatek dál."]);
    const { entries } = (await (await fetch(`${info.url}/log`)).json()) as { entries: { head: string; at: string; what: string[]; text: string[]; kinds: string[]; task?: string }[] };
    assert.equal(entries.length, Number(git("rev-list", "--count", "HEAD")));
    assert.equal(entries[0]!.head, git("rev-parse", "HEAD"));
    assert.equal(entries[0]!.at, git("log", "-1", "--format=%cI"));
    const karel = entries.find((e) => e.what.some((l) => l.startsWith("+P0003")));
    assert.ok(karel, JSON.stringify(entries.slice(0, 3)));
    assert.match(karel.task ?? "", /^T0002 Sňatek/);
    assert.equal(entries.at(-1)!.task, undefined, "saved in no session: no task");
    // what each saved, as the user reads it: the research language, records by their names
    const text = entries.flatMap((e) => e.text);
    assert.ok(karel.text.includes("Nová osoba: Karel Novák [P0003]"), JSON.stringify(karel));
    assert.ok(text.includes("Nový snímek: Kniha N 1850-1870 (obr. 1)"), JSON.stringify(text));
    assert.ok(text.some((l) => /^Jan Novák \(\*1865\) \[P0001\] – křest: 12\. 3\. 1865$/.test(l)), JSON.stringify(text));
    assert.ok(text.some((l) => /^Agent začal: Sňatek$/.test(l)) && text.some((l) => /^Čeká na odpověď: Křest Marie$/.test(l)), JSON.stringify(text));
    // each line with what it is about, for the app's filters
    assert.ok(entries.every((e) => e.kinds.length === e.text.length));
    const kindOf = (line: string) => entries.flatMap((e) => e.text.map((l, i) => [l, e.kinds[i]])).find(([l]) => l === line)?.[1];
    assert.equal(kindOf("Nová osoba: Karel Novák [P0003]"), "person");
    assert.equal(kindOf("Nový snímek: Kniha N 1850-1870 (obr. 1)"), "source");
    assert.equal(kindOf("Agent začal: Sňatek"), "other");
    // the person an agent works on, for the app to follow it in the tree: the first its task is about (a marriage:
    // both named, the one asked about first) …
    const { enterWorker } = await import("../../src/core/workers.ts");
    const leave = enterWorker(w.cwd, "run-t", "Claude Code on its own");
    w.env.STROM_WORKER = "run-t";
    const at = async () => ((await (await fetch(`${info.url}/status`)).json()) as { working: { task?: string; person?: string }[] }).working;
    try {
      await w.ok(["session", "start", "T0002"]);
      assert.deepEqual((await at()).map((x) => [x.task?.slice(0, 5), x.person]), [["T0002", "P0001"]]);
      await w.ok(["session", "close", "--summary", "nic", "--next", "dál", "--continue"]);
      // … a task about nobody: the one its session last wrote about
      await w.ok(["task", "add", "Katalog farnosti", "--level", "locate", "--where", "katalog", "--why", "přehled", "--done-when", "seznam"]);
      await w.ok(["session", "start", "T0003"]);
      assert.equal((await at())[0]!.person, undefined, "nobody yet");
      await w.ok(["event", "add", "P0003", "BIRT", "--date", "1870"]);
      assert.equal((await at())[0]!.person, "P0003");
      await w.ok(["session", "close", "--summary", "nic", "--next", "dál", "--continue"]);
    } finally {
      delete w.env.STROM_WORKER;
      leave();
    }
    const ged = await (await fetch(`${info.url}/tree.ged`)).text();
    assert.match(ged, new RegExp(`2 _STROM_CLIP ${mark}`));
    assert.doesNotMatch(ged, /_STROM_LINKS/, "not registered here: not offered");
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});

test("asked once, the first time a person opens the research in an app that opens links — the answer kept; an older stromapp.info: not asked", { skip: !hasGit || process.platform === "win32" }, async () => {
  const { w } = await world();
  // a Chromium browser here (the research opens in it through the bridge)
  const apps = path.join(w.dir, "apps");
  fs.mkdirSync(path.join(apps, process.platform === "darwin" ? "Google Chrome.app" : ""), { recursive: true });
  if (process.platform !== "darwin") fs.writeFileSync(path.join(apps, "google-chrome"), "", { mode: 0o755 });
  w.env.STROM_APP_DIRS = apps;
  const question = /Dovolit aplikaci Strom spouštět výzkum na tomto počítači\?/;
  const config = () => readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json"));
  try {
    w.env.STROM_APP_VERSION = "3.3.0";
    assert.doesNotMatch((await w.ok(["app"], { tty: true, answers: [] })).out, question, "stromapp.info before 3.4.0 does not open links");
    delete w.env.STROM_APP_VERSION;
    const first = await w.ok(["app"], { tty: true, answers: ["n"] });
    assert.match(first.out, question);
    assert.equal(config().links, "no");
    assert.doesNotMatch((await w.ok(["app"], { tty: true, answers: [] })).out, question, "a no is kept");
    // not asked yet, and an agent opens the app: never asked
    const cfg = config();
    delete cfg.links;
    fs.writeFileSync(path.join(w.env.STROM_CONFIG_DIR!, "config.json"), JSON.stringify(cfg));
    const byAgent = await w.run(["app"], { tty: false });
    assert.doesNotMatch(byAgent.out, question);
    assert.equal(config().links, undefined);
    // a yes: set up (here a test never touches the system — said so), kept
    const yes = await w.ok(["app"], { tty: true, answers: ["a"] });
    assert.match(yes.out, question);
    assert.match(yes.out, /Odkazy z aplikace Strom se na tomto počítači nepodařilo nastavit/);
    assert.equal(config().links, "yes");
  } finally {
    await w.run(["live", "stop"]);
  }
  w.cleanup();
});

test("links set up by another strom (another installation, its settings without an answer): asked, never taken over quietly", { skip: !hasGit || process.platform !== "darwin" }, async () => {
  const { w } = await world();
  const apps = path.join(w.dir, "apps");
  fs.mkdirSync(path.join(apps, "Google Chrome.app"), { recursive: true });
  w.env.STROM_APP_DIRS = apps;
  // what another strom set up: the applet and its mark
  const { macApp } = await import("../../src/core/links.ts");
  const app = macApp(w.env);
  fs.mkdirSync(path.join(app, "Contents", "Resources"), { recursive: true });
  fs.writeFileSync(path.join(app, "Contents", "Resources", "strom-link.json"), JSON.stringify({ argv: ["/elsewhere/node", "/elsewhere/cli.js"] }));
  try {
    const r = await w.ok(["app"], { tty: true, answers: ["n"] });
    assert.match(r.out, /Dovolit aplikaci Strom spouštět výzkum na tomto počítači\?/);
    assert.equal(readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json")).links, "no");
  } finally {
    await w.run(["live", "stop"]);
  }
  w.cleanup();
});

test("the app's menus through links, in the research's terminal: a task answered, a person reviewed, a new direction — each said and asked first; unknown ones only said", opts, async () => {
  const { w, id } = await world();
  const open = (action: string, query = "", answers: string[] = []) => w.run(["link", "open", `strom-research://${action}?tree=${id}${query}`], { tty: true, answers });
  // a task that waits for the user: what it asks, the answer, the task back to the agent (and the time it waits since, for the app)
  await w.ok(["task", "add", "Kde jsou zapsány křty obce Týnec", "--level", "locate", "--where", "matriky farnosti", "--why", "křest Jana", "--done-when", "kniha nalezena"]);
  await w.ok(["task", "wait", "T0001", "--on", "Poslat odkaz na knihu narozených."]);
  const answered = await open("task", "&task=T0001", ["https://archive.example.org/book/77", "n", ""]);
  assert.match(answered.out, / Kde jsou zapsány křty obce Týnec\n {4}Co udělat: Poslat odkaz na knihu narozených\./);
  assert.match(answered.out, /✓ Úkol se vrátil agentovi i s odpovědí\./);
  const t1 = (await w.ok(["task", "show", "T0001", "--json"])).json.task;
  assert.equal(t1.state, "open");
  assert.match(t1.notes.at(-1).text, /https:\/\/archive\.example\.org\/book\/77$/);
  assert.match((await open("task", "&task=T0001", [""])).out, /Tento úkol už nečeká/);
  // a person reviewed: said what it does, a no writes nothing, a yes the tasks
  const no = await open("review", "&person=P0001&scope=family", ["n", ""]);
  assert.match(no.out, /Aplikace Strom žádá: prověřit znovu osobu Jan Novák .*\[P0001\] i s partnery a dětmi\.\nVýzkum: Novákovi\nVýzkum zapíše úkoly pro agenta – teď se nic nehledá a nic se neplatí\./);
  assert.equal((await w.ok(["research", "list", "--json"])).json.researches.length, 0);
  await open("review", "&person=P0001&scope=family", ["a", "n", ""]);
  const review = (await w.ok(["research", "list", "--json"])).json.researches.find((r: { direction: string }) => r.direction === "person");
  assert.equal(review?.review?.scope, "family");
  // a new direction from a person: the title suggested, made
  const made = await open("research", "&person=P0001&direction=ancestors", ["a", "", "", "n", ""]);
  assert.match(made.out, /Aplikace Strom žádá: hledat předky osoby Jan Novák/);
  assert.ok((await w.ok(["research", "list", "--json"])).json.researches.some((r: { direction: string; focus: string }) => r.direction === "ancestors" && r.focus === "P0001"));
  const again = await open("research", "&person=P0001&direction=ancestors", [""]);
  assert.match(again.out, /^Takový výzkum už je: „Předci: Jan Novák“ – agent v něm pokračuje\./, "the same direction again: only named, nothing asked");
  // …paused: taken up again, never made twice
  const ancestors = (await w.ok(["research", "list", "--json"])).json.researches.find((r: { direction: string }) => r.direction === "ancestors");
  await w.ok(["research", "pause", ancestors.id]);
  const resumed = await open("research", "&person=P0001&direction=ancestors", ["a", "a", ""]);
  assert.match(resumed.out, /Takový výzkum už je, pozastavený: „Předci: Jan Novák“\. Spustit ho znovu\?[\s\S]*▶ „Předci: Jan Novák“ zase běží/);
  const after = (await w.ok(["research", "list", "--json"])).json.researches.filter((r: { direction: string }) => r.direction === "ancestors");
  assert.deepEqual(after.map((r: { state: string }) => r.state), ["active"]);
  // a person the research does not have; the agent costs — a no starts nothing
  assert.match((await open("review", "&person=P0099", [""])).out, /Osoba P0099 v tomto výzkumu není/);
  const chat = await open("chat", "&person=P0001", ["n"]);
  assert.match(chat.out, /Aplikace Strom žádá: rozhovor s agentem \(Claude Code\) o osobě Jan Novák .*\[P0001\]\.\nVýzkum: Novákovi\nAgent pracuje na předplatné nebo kredit AI\./);
  // followed live, without a terminal: as strom app --live, nothing asked
  const live = (await w.ok(["link", "open", `strom-research://live?tree=${id}`, "--json"])).json;
  assert.equal(live.action, "live");
  assert.equal(live.tree, w.treeDir("Novákovi"));
  // with Chrome here: the bridge started, its address into the app's window
  const apps = path.join(w.dir, "Applications");
  fs.mkdirSync(path.join(apps, "Google Chrome.app"), { recursive: true });
  fs.writeFileSync(path.join(apps, "google-chrome"), "#!/bin/sh\n", { mode: 0o755 });
  w.env.STROM_APP_DIRS = apps;
  try {
    assert.equal((await w.ok(["link", "open", `strom-research://live?tree=${id}`, "--json"])).json.done, true);
    assert.equal((await w.ok(["live", "--json"], { cwd: w.treeDir("Novákovi") })).json.running, true);
  } finally {
    await w.ok(["live", "stop"], { cwd: w.treeDir("Novákovi") });
    delete w.env.STROM_APP_DIRS;
  }
  // no terminal (the system started strom): a window of its own — none from a test, said how to go on
  assert.match((await w.run(["link", "open", `strom-research://open?tree=${id}`])).out, /strom nemohl otevřít okno terminálu\. Spustit strom \(výzkum Novákovi\)/);
  w.cleanup();
});
