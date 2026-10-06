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

test("the second wave in the research's terminal: a task put aside, given up and back; a conflict decided; a story approved; sessions; a sending that is none", opts, async () => {
  const { w, id } = await world();
  const open = (action: string, query = "", answers: string[] = []) => w.run(["link", "open", `strom-research://${action}?tree=${id}${query}`], { tty: true, answers });
  await w.ok(["task", "add", "Křest Marie v Týnci", "--level", "locate", "--where", "matriky farnosti", "--why", "rodiče", "--done-when", "zápis"]);
  const parked = await open("task", "&task=T0001&do=park", ["a", "Archiv je zavřený", ""]);
  assert.match(parked.out, /Aplikace Strom žádá: odložit úkol: Křest Marie v Týnci/);
  assert.match(parked.out, /✓ Úkol je odložený\./);
  let t = (await w.ok(["task", "show", "T0001", "--json"])).json.task;
  assert.equal(t.state, "parked");
  assert.equal(t.parkedReason, "Archiv je zavřený");
  assert.match((await open("task", "&task=T0001&do=park", [""])).out, /Tento úkol teď takhle změnit nejde/);
  await open("task", "&task=T0001&do=wake", ["a", ""]);
  assert.equal((await w.ok(["task", "show", "T0001", "--json"])).json.task.state, "open");
  // a reason not typed: the app's words
  await open("task", "&task=T0001&do=drop", ["a", "", ""]);
  t = (await w.ok(["task", "show", "T0001", "--json"])).json.task;
  assert.equal(t.state, "dropped");
  assert.match((await open("task", "&task=T0099&do=drop", [""])).out, /Úkol T0099 v tomto výzkumu není/);

  // a conflict: which claim holds, and why — the user's decision
  await w.ok(["source", "add", "Úmrtí Jana", "--kind", "death"]);
  await w.ok(["conflict", "add", "Rok narození Jana", "--about", "P0001", "--fact", "BIRT", "--claim", "S0001: 1865", "--claim", "S0002: 70 let při úmrtí 1937"]);
  const decided = await open("conflict", "&id=X0001", ["a", "1", "Křest je zapsán hned po narození", ""]);
  assert.match(decided.out, /1 {2}1865 — Křest Jana/);
  const x = (await w.ok(["conflict", "show", "X0001", "--json"])).json.conflict;
  assert.equal(x.state, "resolved");
  assert.equal(x.resolution, "1865 (S0001)");
  assert.equal(x.reasoning, "Křest je zapsán hned po narození (rozhodnutí uživatele)");
  assert.match((await open("conflict", "&id=X0001", [""])).out, /Tento rozpor už je rozhodnutý: 1865 \(S0001\)/);
  // left to the agent: the cost said, a no starts nothing
  await w.ok(["conflict", "add", "Jméno matky", "--about", "P0001", "--claim", "S0001: Anna", "--claim", "S0002: Marie"]);
  assert.match((await open("conflict", "&id=X0002&do=agent", ["n"])).out, /nechat rozpor na agentovi \(Claude Code\): Jméno matky\nVýzkum: Novákovi\nAgent pracuje na předplatné/);

  // a story: read, approved
  await w.ok(["story", "set", "P0001", "--text", "Jan se narodil v Týnci.", "--fact", "E0001"]);
  const story = await open("story", "&person=P0001&do=final", ["a", ""]);
  assert.match(story.out, /Jan se narodil v Týnci\.\n\nAplikace Strom žádá: schválit vyprávění osoby Jan Novák \(\*1865\) \[P0001\], jak je/);
  assert.equal((await w.ok(["story", "show", "P0001", "--json"])).json.story.status, "final");
  assert.match((await open("story", "&person=P0001&do=final", [""])).out, /už je schválené/);
  // locked: written again, the new version waits — the app asks to keep the old one, or to take the new one
  await w.ok(["story", "set", "P0001", "--text", "Jan se narodil v Týnci nad Labem.", "--fact", "E0001"]);
  const keep = await open("story", "&person=P0001&do=keep", [""]);
  assert.match(keep.out, /Nová verze vyprávění o Jan Novák \(\*1865\) \[P0001\] \(\d{4}-\d{2}-\d{2}\) – schválené zůstává až do rozhodnutí:\n\nJan se narodil v Týnci nad Labem\./);
  assert.match(keep.out, /✓ Schválené vyprávění zůstává/);
  assert.equal((await w.ok(["story", "show", "P0001", "--json"])).json.story.text, "Jan se narodil v Týnci.");
  await w.ok(["story", "set", "P0001", "--text", "Jan se narodil v Týnci nad Labem.", "--fact", "E0001"]);
  assert.match((await open("story", "&person=P0001&do=final", [""])).out, /✓ Vyprávěním je teď nová verze, schválená/);
  assert.equal((await w.ok(["story", "show", "P0001", "--json"])).json.story.text, "Jan se narodil v Týnci nad Labem.");
  assert.match((await open("story", "&person=P0001&do=keep", [""])).out, /Žádná nová verze vyprávění o Jan Novák \(\*1865\) \[P0001\] nečeká/);
  // a couple's story: the app names the two partners (it knows no family IDs)
  const anna = (await w.ok(["person", "add", "Anna /Svobodová/", "--sex", "F", "--json"])).json.person.id;
  const fam = (await w.ok(["family", "add", "--partner", "P0001", "--partner", anna, "--json"])).json.family.id;
  await w.ok(["story", "set", fam, "--text", "Jan a Anna se vzali.", "--fact", "E0001", "--final"]);
  await w.ok(["story", "set", fam, "--text", "Jan a Anna se vzali v Týnci.", "--fact", "E0001"]);
  const couple = await open("story", `&person=${anna}&partner=P0001&do=final`, [""]);
  assert.match(couple.out, /Nová verze vyprávění o Anna Svobodová[^\n]* & Jan Novák[\s\S]*Jan a Anna se vzali v Týnci\.[\s\S]*✓ Vyprávěním je teď nová verze, schválená/);
  assert.equal((await w.ok(["story", "show", fam, "--json"])).json.story.text, "Jan a Anna se vzali v Týnci.");
  assert.match((await open("story", `&person=${anna}&partner=P0001&do=keep`, [""])).out, /Žádná nová verze vyprávění o Anna Svobodová[^\n]* & Jan Novák[^\n]* nečeká/);
  assert.match((await open("story", "&person=P0001&partner=P0001&do=final", [""])).out, /nejsou ve výzkumu pár/);

  assert.match((await open("sessions", "", [""])).out, /Sezení agenta – Novákovi\n {2}Agent na tomto výzkumu zatím nepracoval\./);
  assert.match((await open("sync-undo", "&intake=I0042", [""])).out, /I0042 není v tomto výzkumu poslání z aplikace Strom/);
  // a send taken back: what goes back said line by line, when it came to the minute — and Enter is no (found on Windows)
  const file = path.join(w.dir, "send.ged");
  fs.writeFileSync(file, ["0 HEAD", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8", "0 @I1@ INDI", "1 NAME Bohumil /Dvořák/", "1 SEX M", "0 TRLR", ""].join("\n"));
  const sent = (await w.ok(["sync", file, "--apply", "--force", "--json"])).json.input as string;
  const asked = await open("sync-undo", `&intake=${sent}`, [""]);
  assert.match(asked.out, /vrátit, co výzkum převzal z aplikace Strom \d+\. \d+\. \d{2}:\d{2}:\nVýzkum: Novákovi\n {2}.*Bohumil Dvořák/, asked.out);
  assert.match(asked.out, /Pokračovat\? \(a\/n\) \[n\]/, asked.out);
  assert.ok((await w.ok(["person", "list", "--json"])).json.persons.some((p: { name: string }) => /Bohumil/.test(p.name)), "Enter takes nothing back");
  await open("sync-undo", `&intake=${sent}`, ["a", ""]);
  assert.ok(!(await w.ok(["person", "list", "--json"])).json.persons.some((p: { name: string }) => /Bohumil/.test(p.name)));
  w.cleanup();
});

test("what the research knows of a person, for an app that shows it: its conflicts, open hypotheses, what was searched for them — in the Strom file only", opts, async () => {
  const { w } = await world();
  await w.ok(["source", "add", "Úmrtí Jana", "--kind", "death"]);
  await w.ok(["conflict", "add", "Rok narození Jana", "--about", "P0001", "--fact", "BIRT", "--claim", "S0001: 12 MAR 1865", "--claim", "S0002: 1866"]);
  await w.ok(["hypothesis", "add", "Otec: Václav, nebo Josef?", "--about", "P0001", "--variant", "A: Václav Novák, mlynář", "--variant", "B: Josef Novák, sedlák"]);
  await w.ok(["task", "add", "Oddací matrika Týnec", "--level", "locate", "--where", "B0001", "--why", "sňatek", "--done-when", "zápis", "--about", "P0001"]);
  await w.ok(["search", "add", "Sňatek Jana", "--recordset", "B0001", "--years", "1885-1895", "--method", "page-by-page", "--result", "negative", "--task", "T0001"]);
  const file = path.join(w.cwd, "output", "tree-strom.ged");
  await w.ok(["config", "set", "strom.version", "3.3.0"]);
  await w.ok(["export", "gedcom"]);
  assert.doesNotMatch(fs.readFileSync(file, "utf8"), /_STROM_CONFLICT|_STROM_ASOF/, "an older app: not before it reads them");
  await w.ok(["config", "unset", "strom.version"]);
  await w.ok(["export", "gedcom"]);
  const ged = fs.readFileSync(file, "utf8");
  assert.match(ged, /^1 _STROM_ASOF \d{4}-\d{2}-\d{2}$/m);
  assert.match(ged, /1 _STROM_CONFLICT X0001\n2 TYPE BIRT\n2 TITL Rok narození Jana\n2 STAT open\n2 VAL 12 MAR 1865\n3 SOUR @S0001@\n2 VAL 1866\n3 SOUR @S0002@\n/);
  // the hypothesis by its ID, which an app that shows where the tree ends names it by (_STROM_EDGE)
  assert.match(ged, /1 _STROM_HYPO H0001\n2 TITL Otec: Václav, nebo Josef\?\n2 NOTE A: Václav Novák, mlynář\n3 CONT B: Josef Novák, sedlák\n/);
  assert.match(ged, /1 _STROM_SEARCHED\n2 TITL Sňatek Jana\n2 DATE FROM 1885 TO 1895\n2 RESN none\n2 _AT \d{4}-\d{2}-\d{2}\n/);
  assert.deepEqual(validateGedcom(ged).filter((f) => f.level === "error"), []);
  // decided: which, and a conflict of no known fact named by its title
  await w.ok(["conflict", "resolve", "X0001", "--resolution", "12 MAR 1865 (S0001)", "--reasoning", "křest"]);
  await w.ok(["conflict", "add", "Stav Jana", "--about", "P0001", "--claim", "S0001: svobodný", "--claim", "S0002: vdovec"]);
  await w.ok(["export", "gedcom"]);
  const again = fs.readFileSync(file, "utf8");
  assert.match(again, /2 STAT decided\n(?:2 VAL .*\n3 SOUR .*\n)+2 DECI 12 MAR 1865 \(S0001\)\n/);
  assert.match(again, /1 _STROM_CONFLICT X0002\n2 TYPE EVEN\n2 TITL Stav Jana\n/);
  // a standard GEDCOM for another program: none of it
  await w.ok(["export", "gedcom", "--for", "standard"]);
  assert.doesNotMatch(fs.readFileSync(path.join(w.cwd, "output", "tree.ged"), "utf8"), /_STROM_/);
  w.cleanup();
});

test("a tree of the app becomes a new research: named, the app hands it to the bridge (GET/POST /adopt), taken in as leads; the status tells the queue and the month's spend", { skip: !hasGit || process.platform === "win32" }, async () => {
  const w = new World();
  // an agent here (a research, not an archive — none: N9), one that never starts: no conversation is wanted
  const bin = path.join(w.dir, "bin");
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(path.join(bin, "codex"), "#!/bin/sh\necho codex-cli 0.155.0\n", { mode: 0o755 });
  w.env.PATH = [bin, path.dirname(process.execPath), "/usr/bin", "/bin"].join(path.delimiter);
  w.env.STROM_ADOPT_WAIT_MS = "60000";
  await w.ok(["setup", "--yes"]);
  await w.ok(["config", "set", "strom.app.url", "https://beta.stromapp.info/run/"]);
  const token = "Qm9sZC1kZW1vLXRva2VuLWZvci1zdHJvbS1hcHAtMDEy".slice(0, 43);
  const origin = { Origin: "https://beta.stromapp.info" };
  const root = w.treeDir("Dvořákovi");
  const flow = w.run(["link", "open", `strom-research://new?app=${token}`], { tty: true, answers: ["Dvořákovi", "", "", "n", ""] });
  // the app: the bridge of the new research, which tree it waits for, the tree handed over
  let url = "";
  for (let i = 0; i < 100 && !url; i++) {
    await new Promise((r) => setTimeout(r, 100));
    try {
      url = JSON.parse(fs.readFileSync(path.join(root, ".strom", "live.json"), "utf8")).url;
    } catch {
      // not yet
    }
  }
  try {
    assert.ok(url, "the bridge of the new research");
    const asked = (await (await fetch(`${url}/adopt`)).json()) as { token: string; name: string; tree: string };
    assert.equal(asked.token, token);
    assert.equal(asked.name, "Dvořákovi");
    const ged = ["0 HEAD", "1 SOUR STROM", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8", "0 @I1@ INDI", "1 NAME Karel /Dvořák/", "1 SEX M", "1 BIRT", "2 DATE 1901", "0 @I2@ INDI", "1 NAME Marie /Dvořáková/", "1 SEX F", "0 @F1@ FAM", "1 HUSB @I1@", "1 WIFE @I2@", "0 TRLR", ""].join("\n");
    // another copy of the app opened the link first (stromapp.info; the tree is in the beta): it knows no such tree —
    // the research goes on waiting for the right one (found on Windows: it stopped, nobody took the tree in)
    assert.equal((await fetch(`${url}/cancel`, { method: "POST", body: JSON.stringify({ reason: "no-tree" }), headers: { Origin: "https://stromapp.info", "Content-Type": "text/plain" } })).status, 200);
    await new Promise((r) => setTimeout(r, 700));
    assert.equal((await fetch(`${url}/adopt`, { method: "POST", body: ged })).status, 403, "only the app's pages");
    // the app 3.9.1 hands it over (it loads the research's version itself after: nothing opened a second time, N12)
    const handed = await fetch(`${url}/adopt`, { method: "POST", body: ged, headers: { ...origin, "Content-Type": "text/plain; charset=utf-8", "X-Strom-App-Version": "3.9.1" } });
    const got = (await handed.json()) as { tree: string; head: string };
    assert.equal(handed.status, 200);
    assert.equal(got.tree, asked.tree);
    assert.match(got.head, /^[0-9a-f]{40}$/);
    // taken once
    assert.equal((await fetch(`${url}/adopt`, { method: "POST", body: ged, headers: origin })).status, 400);
    // its link opened again: handed over already (not a tree the research never waited for)
    const again = await fetch(`${url}/adopt`);
    assert.equal(again.status, 410);
    assert.equal(((await again.json()) as { adopted?: boolean }).adopted, true);
    const r = await flow;
    assert.match(r.out, /Aplikace Strom chce začít výzkum s jedním svým rodokmenem\./);
    assert.match(r.out, /Tahle kopie aplikace Strom ten strom nezná/);
    assert.match(r.out, /✓ Rodokmen je ve výzkumu „Dvořákovi“: osob 2, rodin 1, pramenů 0 – jako vodítka; co doloží záznamy, najde agent\.\nAplikace Strom teď strom ukazuje jako strom výzkumu\.\n/);
    assert.doesNotMatch(r.out, /import-url|tree-strom\.ged/, "the app is not opened a second time");
    const people = (await w.ok(["person", "list", "--json"], { cwd: root })).json;
    assert.equal(JSON.stringify(people).includes("Dvořák"), true);
    // the status: the queue, the month's spend (no sessions yet), no sending of the app yet
    const status = (await (await fetch(`${url}/status`)).json()) as Record<string, any>;
    assert.ok(Array.isArray(status.queue));
    assert.equal(typeof status.queueMore, "number");
    assert.deepEqual(status.spend, { month: new Date().toISOString().slice(0, 7), sessions: 0, amount: 0, currency: "USD" });
    assert.equal(status.lastIntake, undefined);
    assert.equal(status.update, undefined);
  } finally {
    await w.run(["live", "stop"], { cwd: root });
  }
  w.cleanup();
});

test("installed from the Strom app (the line it shows carries its tree's mark): the setup keeps it as an archive, then that tree becomes the research", { skip: !hasGit || process.platform === "win32" }, async () => {
  const w = new World();
  // no agent on this computer, nothing set up yet; the installer started strom with the app's mark
  w.env.PATH = [path.dirname(process.execPath), "/usr/bin", "/bin"].join(path.delimiter);
  w.env.STROM_ADOPT_WAIT_MS = "60000";
  w.env.STROM_APP_URL = "https://beta.stromapp.info/run/";
  const token = "SW5zdGFsbGVkLWZyb20tdGhlLWFwcC1tYXJrLTAwMDE".slice(0, 43);
  w.env.STROM_FROM_APP = token;
  const root = w.treeDir("Dvořákovi");
  const flow = w.run([], { tty: true, answers: ["", "", "n", "n", "Dvořákovi", ""] });
  let url = "";
  for (let i = 0; i < 200 && !url; i++) {
    await new Promise((r) => setTimeout(r, 100));
    try {
      url = JSON.parse(fs.readFileSync(path.join(root, ".strom", "live.json"), "utf8")).url;
    } catch {
      // not yet
    }
  }
  try {
    assert.ok(url, "the bridge of the new research waits for the app's tree");
    assert.equal(((await (await fetch(`${url}/adopt`)).json()) as { token: string }).token, token);
    // the app's tree with its own source (a register's entry, its transcript) the facts cite
    const ged = [
      "0 HEAD", "1 SOUR STROM", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8",
      "0 @I1@ INDI", "1 NAME Karel /Dvořák/", "1 SEX M", "1 BIRT", "2 DATE 12 MAR 1901", "2 PLAC Týnec", "2 SOUR @S1@", "3 PAGE fol. 12", "3 QUAY 3",
      "0 @I2@ INDI", "1 NAME Marie /Dvořáková/", "1 SEX F",
      "0 @F1@ FAM", "1 HUSB @I1@", "1 WIFE @I2@",
      "0 @S1@ SOUR", "1 TITL Křest – Karel Dvořák", "1 PAGE fol. 12", "1 TEXT Carolus, filius legitimus …",
      "0 TRLR", "",
    ].join("\n");
    const handed = await fetch(`${url}/adopt`, { method: "POST", body: ged, headers: { Origin: "https://beta.stromapp.info", "Content-Type": "text/plain; charset=utf-8" } });
    assert.equal(handed.status, 200);
    // what each of the app's people and sources is now: the app keeps them as their REFN (its next send: ours by ID)
    const ids = ((await handed.json()) as { ids: { persons: Record<string, string>; sources: Record<string, string> } }).ids;
    assert.deepEqual(Object.keys(ids.persons).sort(), ["@I1@", "@I2@"]);
    assert.match(ids.persons["@I1@"]!, /^P\d{4}$/);
    assert.deepEqual(Object.keys(ids.sources), ["@S1@"]);
    const r = await flow;
    assert.match(r.out, /Bez agenta je nový výzkum archiv|Without an agent, a new research is an archive/);
    assert.match(r.out, /osob 2, rodin 1, pramenů 1 – jako vodítka; co doloží záznamy, najde agent, až bude zapnutý\./);
    // not opened here (the tests open nothing, no browser): how it gets back into the app said
    assert.match(r.out, /pramenů 1 – jako vodítka; co doloží záznamy, najde agent, až bude zapnutý\.\n.*Dvořákovi\/output\/tree-strom\.ged/);
    const sources = (await w.ok(["source", "list", "--json"], { cwd: root })).json.sources as { title: string; transcript?: string }[];
    assert.ok(sources.some((s) => s.title === "Křest – Karel Dvořák"), JSON.stringify(sources));
    const karel = (await w.ok(["person", "list", "--json"], { cwd: root })).json.persons.find((p: { name: string }) => /Karel/.test(p.name));
    const birth = (await w.ok(["person", "show", karel.id, "--json"], { cwd: root })).json.person.events.find((e: { kind: string }) => e.kind === "BIRT");
    assert.equal(birth.place, "Týnec");
    assert.match(r.out, /Je to archiv: co se zadá v aplikaci Strom|It is an archive: what is entered in the Strom app/);
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, "strom.json"), "utf8")).mode, "archive");
    assert.equal((await w.ok(["person", "list", "--json"], { cwd: root })).json.total, 2);
    assert.equal(readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json")).stromApp, "yes", "who came from the app wants it");
    // …from its beta (the line carried its address): that copy is the one strom opens from now on
    assert.equal(readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json")).stromAppUrl, "https://beta.stromapp.info/run/");
  } finally {
    await w.run(["live", "stop"], { cwd: root });
  }
  w.cleanup();
});

test("installed from the Strom app where strom was set up long ago (its settings kept): the app's copy kept, the links and the shortcut offered as they are here, the research named as the app's tree", { skip: !hasGit || process.platform === "win32" }, async () => {
  const w = new World();
  w.env.PATH = [path.dirname(process.execPath), "/usr/bin", "/bin"].join(path.delimiter);
  // set up long ago: a home, the production app, no links asked, no shortcut
  await w.ok(["setup", "--yes"]);
  for (const f of fs.existsSync(path.join(w.env.HOME!, "Desktop")) ? fs.readdirSync(path.join(w.env.HOME!, "Desktop")) : []) fs.rmSync(path.join(w.env.HOME!, "Desktop", f), { recursive: true, force: true });
  // now the beta's line: its mark, its address, its tree's name
  w.env.STROM_ADOPT_WAIT_MS = "60000";
  w.env.STROM_APP_URL = "https://beta.stromapp.info/run/";
  w.env.STROM_FROM_APP = "SW5zdGFsbGVkLWZyb20tdGhlLWFwcC1tYXJrLTAwMDI";
  w.env.STROM_FROM_APP_NAME = "Test\u0007 Win  ";
  const root = w.treeDir("Test Win");
  // the shortcut: no; the links: no; the name: Enter (the app's tree's); the language: Enter
  const flow = w.run([], { tty: true, answers: ["n", "n", "", ""] });
  let url = "";
  for (let i = 0; i < 600 && !url; i++) {
    await new Promise((r) => setTimeout(r, 100));
    try {
      url = JSON.parse(fs.readFileSync(path.join(root, ".strom", "live.json"), "utf8")).url;
    } catch {
      // not yet
    }
  }
  try {
    if (!url) assert.fail(`the research named as the app's tree waits for it:\n${(await flow).out}`);
    const ged = ["0 HEAD", "1 SOUR STROM", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8", "0 @I1@ INDI", "1 NAME Karel /Dvořák/", "1 SEX M", "0 TRLR", ""].join("\n");
    assert.equal((await fetch(`${url}/adopt`, { method: "POST", body: ged, headers: { Origin: "https://beta.stromapp.info", "Content-Type": "text/plain; charset=utf-8" } })).status, 200);
    const r = await flow;
    assert.match(r.out, /zástupce|shortcut/i, "the shortcut offered");
    assert.match(r.out, /Dovolit aplikaci Strom spouštět výzkum na tomto počítači\?/, "the links offered: none lead here");
    assert.match(r.out, /Název výzkumu \(rodina, např\. Novákovi\) \[Test Win\]/);
    const config = readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json"));
    assert.equal(config.stromAppUrl, "https://beta.stromapp.info/run/", "the beta: the copy strom opens from now on");
    assert.equal(config.stromApp, "yes");
    assert.equal(config.links, "no");
  } finally {
    await w.run(["live", "stop"], { cwd: root });
  }
  // installed again from stromapp.info itself (its line carries no address): stromapp.info again
  const { appCopyOfInstall } = await import("../../src/core/stromapp.ts");
  assert.equal(appCopyOfInstall({ STROM_FROM_APP: "x" }), null);
  assert.equal(appCopyOfInstall({ STROM_FROM_APP: "x", STROM_APP_URL: "https://stromapp.info/run/" }), null);
  assert.equal(appCopyOfInstall({ STROM_FROM_APP: "x", STROM_APP_URL: "https://beta.stromapp.info/run/" }), "https://beta.stromapp.info/run/");
  assert.equal(appCopyOfInstall({ STROM_FROM_APP: "x", STROM_APP_URL: "https://evil.example/" }), undefined, "no copy of the app: the setting stays");
  assert.equal(appCopyOfInstall({ STROM_APP_URL: "https://beta.stromapp.info/run/" }), undefined, "not installed from the app");
  w.cleanup();
});

test("a tree of the app with no people in it yet is handed over all the same (C1): the research linked, nothing failed", { skip: !hasGit || process.platform === "win32" }, async () => {
  const { w } = await world();
  const { adoptFailedSince, adoptedAt, awaitAdoption } = await import("../../src/core/sync.ts");
  const since = Date.now();
  awaitAdoption(w.cwd, "B".repeat(43));
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const empty = ["0 HEAD", "1 GEDC", "2 VERS 5.5.1", "0 TRLR", ""].join("\n");
    const r = await fetch(`${info.url}/adopt`, { method: "POST", body: empty, headers: { Origin: "https://stromapp.info" } });
    assert.equal(r.status, 200);
    assert.equal(((await r.json()) as { empty?: boolean }).empty, true);
    assert.equal(adoptFailedSince(w.cwd, since), undefined);
    assert.ok(adoptedAt(w.cwd, since), "adopted: the link opened again gets 410");
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});

test("the bridge takes the app's tree in itself — with no terminal waiting for it; adopted only once it is in, else the app hears why (and may hand it over again) and the terminal is told", { skip: !hasGit || process.platform === "win32" || process.getuid?.() === 0 }, async () => {
  const w = new World();
  await w.ok(["setup", "--yes"]);
  await w.ok(["init", "Bergové", "--mode", "archive"]);
  w.cwd = w.treeDir("Bergové");
  const { adoptFailedSince, adoptedAt, awaitAdoption, pendingAdoption } = await import("../../src/core/sync.ts");
  const ged = [
    "0 HEAD", "1 SOUR STROM", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8",
    "0 @I1@ INDI", "1 NAME Johan /Berg/", "1 SEX M", "1 BIRT", "2 DATE 14 MAR 1825", "2 PLAC Voss", "2 SOUR @S1@", "3 QUAY 3",
    "0 @S1@ SOUR", "1 TITL Křest – Johan Berg", "1 TEXT Johannes. Forældre: Peder Bergh …",
    "0 TRLR", "",
  ].join("\n");
  const since = Date.now();
  awaitAdoption(w.cwd, "C".repeat(43));
  const info = (await w.ok(["live", "start", "--json"])).json;
  const objects = path.join(w.cwd, ".git", "objects");
  try {
    // nothing can be saved: not taken in — the app hears a sentence, the research still waits for the tree
    fs.chmodSync(objects, 0o555);
    const bad = await fetch(`${info.url}/adopt`, { method: "POST", body: ged, headers: { Origin: "https://beta.stromapp.info" } });
    assert.equal(bad.status, 500);
    assert.match(((await bad.json()) as { error: string }).error, /^výzkum strom nepřevzal — předat ho znovu/);
    assert.equal(adoptedAt(w.cwd, since), undefined);
    assert.ok(pendingAdoption(w.cwd), "handed over again, it is taken");
    assert.ok(adoptFailedSince(w.cwd, since)?.reason, "the terminal is told what went wrong");
    assert.match(fs.readFileSync(path.join(w.cwd, ".strom", "live.log"), "utf8"), /the app's tree was not taken in/);
    fs.chmodSync(objects, 0o755);
    // handed over again: in, with its source — nobody in a terminal
    const ok = await fetch(`${info.url}/adopt`, { method: "POST", body: ged, headers: { Origin: "https://beta.stromapp.info" } });
    assert.equal(ok.status, 200);
    const got = (await ok.json()) as { tree: string; head: string; input?: string };
    assert.match(got.input ?? "", /^I\d{4}$/);
    assert.equal(got.head, (await w.ok(["status", "--json"])).json.head ?? got.head);
    assert.deepEqual(adoptedAt(w.cwd, since), { input: got.input });
    assert.equal(JSON.parse(fs.readFileSync(path.join(w.cwd, ".strom", "adopt.json"), "utf8")).from, "https://beta.stromapp.info", "which copy of the app handed it over");
    assert.equal((await w.ok(["person", "list", "--json"])).json.total, 1);
    assert.ok((await w.ok(["source", "list", "--json"])).json.sources.some((x: { title: string }) => x.title === "Křest – Johan Berg"));
  } finally {
    fs.chmodSync(objects, 0o755);
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});

test("the copy of the app strom was installed from: only the app's own pages, never stromapp.info itself (the default), only with the app's mark", async () => {
  const { appUrlFromInstall } = await import("../../src/core/stromapp.ts");
  const mark = "SW5zdGFsbGVkLWZyb20tdGhlLWFwcC1tYXJrLTAwMDE";
  const from = (url: string | undefined, m: string | undefined = mark) => appUrlFromInstall({ STROM_FROM_APP: m, STROM_APP_URL: url });
  assert.equal(from("https://beta.stromapp.info/run/"), "https://beta.stromapp.info/run/");
  assert.equal(from("http://127.0.0.1:8080/"), "http://127.0.0.1:8080/");
  assert.equal(from("https://stromapp.info/run/"), undefined, "the default: nothing to keep");
  assert.equal(from("https://evil.example/run/"), undefined);
  assert.equal(from("https://beta.stromapp.info.evil.example/"), undefined);
  assert.equal(from("javascript:alert(1)"), undefined);
  assert.equal(from("not a url"), undefined);
  assert.equal(from(undefined), undefined);
  assert.equal(from("https://beta.stromapp.info/run/", ""), undefined, "not installed from the app: the setting is the person's");
});
