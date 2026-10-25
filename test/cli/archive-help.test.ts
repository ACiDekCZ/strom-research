// The help an archive and a research waiting for its agent give (017, audit of 2026-10-23): the phone's help there
// (c-D5), intake's without a task, its queue or task wake (N1), the live bridge in a person's language (an agent's
// --help stays English: the rule), a research waiting for its agent helped as an archive — never an agent strom runs
// in, which reads its whole catalog (N2) — and a packed archive's how-to going on in the Strom app, nothing of an agent
// (b-D2).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { readEntry, readZip } from "../../src/core/zip.ts";

const opts = { skip: !hasGit || process.platform === "win32" };

/** No agent on this computer: only Node, git and the system's own programs. */
function noAgent(w: World): void {
  w.env.PATH = [path.dirname(process.execPath), "/usr/bin", "/bin"].join(path.delimiter);
}

const NO_AI = /agent|\bAI\b|umělá inteligence|Claude|Codex|OpenCode|Grok|Antigravity|\bmodel/i;
const NO_WORK = /\btasks?\b|\bqueue\b|\bsessions?\b|task wake|úkol|fronta|frontě/i;

async function archive(): Promise<World> {
  const w = new World();
  noAgent(w);
  await w.ok(["setup", "--yes"]);
  await w.ok(["init", "Archiv", "--mode", "archive"]);
  w.cwd = w.treeDir("Archiv");
  return w;
}

test("c-D5 an archive's help of the phone: its help, in English and the person's language, promising no work", opts, async () => {
  const w = await archive();
  for (const args of [["help", "phone"], ["help", "phone", "on"], ["phone", "--help"], ["help", "phone", "qr"]]) {
    const out = (await w.ok(args)).out;
    assert.match(out, /^strom phone/m, `${args.join(" ")}\n${out}`);
    assert.doesNotMatch(out, /not in an archive|not while/, out);
    assert.doesNotMatch(out, NO_AI, out);
    assert.doesNotMatch(out, NO_WORK, out);
  }
  for (const args of [["help", "--human", "phone"], ["help", "--human", "phone", "on"], ["help", "--human", "phone", "qr"]]) {
    const out = (await w.ok(args)).out;
    assert.match(out, /Propojení s telefonem|Zapnout propojení|QR kód/, `${args.join(" ")}\n${out}`);
    assert.doesNotMatch(out, /nepoužívá/, out);
    assert.doesNotMatch(out, NO_AI, out);
    assert.doesNotMatch(out, NO_WORK, out);
  }
  w.cleanup();
});

test("N1 an archive's help of intake: no task, queue or task wake, no --answers or --research; a research's catalog keeps them", opts, async () => {
  const w = await archive();
  for (const args of [["help", "intake"], ["intake", "--help"], ["help", "--human", "intake"]]) {
    const out = (await w.ok(args)).out;
    assert.match(out, /^strom intake/m, out);
    assert.doesNotMatch(out, NO_WORK, `${args.join(" ")}\n${out}`);
    assert.doesNotMatch(out, /wake|--answers|--research|T0005|G0001/, `${args.join(" ")}\n${out}`);
    assert.doesNotMatch(out, NO_AI, out);
  }
  const english = (await w.ok(["help", "intake"])).out;
  assert.match(english, /--documents/, "what an archive uses stays");
  assert.match(english, /--person <P…> \(repeatable\) +the person it is of, as the user says \(repeatable\): kept with them/, english);
  assert.match(english, /Family trees are imported at once/, english);
  // the rest of an archive's catalog: nothing of the work either
  for (const args of [["help", "find"], ["help", "person", "list"], ["help", "live"]]) {
    const out = (await w.ok(args)).out;
    assert.doesNotMatch(out, /not in an archive/, out);
    assert.doesNotMatch(out, NO_WORK, `${args.join(" ")}\n${out}`);
    assert.doesNotMatch(out, NO_AI, `${args.join(" ")}\n${out}`);
  }
  // a person's help of a command an archive uses with no sentence of its own: never "the agent's"
  const show = (await w.ok(["help", "--human", "person", "show"])).out;
  assert.match(show, /^strom person show: nápověda je jen anglicky: strom help person show$/m, show);
  // a research: the agent's catalog as it was
  const r = new World();
  await r.withTree("Výzkum");
  const full = (await r.ok(["help", "intake"])).out;
  assert.match(full, /gets an intake task/, full);
  assert.match(full, /--answers <T…>/, full);
  assert.match(full, /--research <G…>/, full);
  w.cleanup();
  r.cleanup();
});

test("live: a person's help in the research language, an archive's too; --help stays the agent's English", opts, async () => {
  const r = new World();
  await r.withTree("Výzkum");
  const said = (await r.ok(["help", "--human", "live"])).out;
  assert.match(said, /^Zda aplikace Strom sleduje výzkum živě: most pro ni a jeho adresa$/m, said);
  assert.doesNotMatch(said, /příkaz, který používá agent/, said);
  assert.match((await r.ok(["help", "--human", "live", "start"])).out, /^Nechat aplikaci Strom sledovat výzkum živě$/m);
  assert.match((await r.ok(["help", "--human"])).out, /^ {2}strom live +Zda aplikace Strom sleduje výzkum živě/m);
  assert.match((await r.ok(["live", "--help"])).out, /^The live bridge: /m, "an agent's help is English (the rule)");
  const de = (await r.ok(["help", "--human", "live", "--lang", "de"])).out;
  assert.match(de, /Ob die Strom-App die Forschung live verfolgt/, de);
  const w = await archive();
  const a = (await w.ok(["help", "--human", "live"])).out;
  assert.match(a, /Zda aplikace Strom sleduje výzkum živě/, a);
  assert.doesNotMatch(a, NO_AI, a);
  r.cleanup();
  w.cleanup();
});

test("N2 a research waiting for its agent: an archive's help, said as the research's; an agent strom runs in reads the whole catalog", opts, async () => {
  const w = new World();
  noAgent(w);
  await w.withTree("Čekající");
  const overview = (await w.ok(["help"])).out;
  for (const cmd of ["chat", "run", "session", "read", "clips", "transcripts", "task", "brief"])
    assert.doesNotMatch(overview, new RegExp(`(: | · )${cmd}( |$)`, "m"), `${cmd}\n${overview}`);
  assert.match(overview, /phone/, overview);
  assert.match(overview, /intake/, overview);
  const read = (await w.ok(["help", "read"])).out;
  assert.match(read, /^strom read: not while the research waits for its agent \(the person installs or chooses it: strom setup\)$/m, read);
  assert.doesNotMatch(read, /archive/, read);
  const human = (await w.ok(["help", "--human"])).out;
  assert.doesNotMatch(human, /^ {2}strom (chat|run|task) /m, human);
  assert.doesNotMatch(human, /^ {2}strom (stats|pack|setup) .*Archiv/m, "a research waiting is no archive");
  assert.match(human, /^ {2}strom setup +Nastavení: jazyk, složky, git, agent/m, "its way to the agent: the setup");
  const chat = (await w.ok(["help", "--human", "chat"])).out;
  assert.match(chat, /^strom chat: funguje, až bude na tomto počítači AI agent \(nainstalovat nebo vybrat: menu, první položka\)$/m, chat);
  // the catalog an agent reads stays whole
  assert.ok(((await w.ok(["commands", "--json"])).json.commands as { command: string }[]).some((c) => c.command === "read"));
  // an agent strom runs in: its whole catalog
  for (const env of [{ CLAUDECODE: "1" }, { STROM_SESSION: "s0001" }] as Record<string, string>[]) {
    const full = (await w.ok(["help"], { env })).out;
    assert.match(full, /(: | · )chat( |$)/m, full);
    assert.match(full, /(: | · )read( |$)/m, full);
    assert.match((await w.ok(["help", "read"], { env })).out, /^strom read /m);
  }
  // the agent installed: research again, its help whole
  const bin = path.join(w.dir, "bin");
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(path.join(bin, "claude"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  w.env.PATH = [bin, w.env.PATH].join(path.delimiter);
  assert.match((await w.ok(["help"])).out, /(: | · )chat( |$)/m);
  w.cleanup();
});

test("b-D2 a packed archive's how-to goes on in the Strom app, nothing of an agent; a research's as it was", opts, async () => {
  const w = await archive();
  await w.ok(["person", "add", "Josef /Novák/", "--sex", "M"]);
  const zip = path.join(w.dir, "archiv.zip");
  await w.ok(["pack", "--out", zip]);
  const entries = readZip(zip);
  const howto = readEntry(zip, entries.find((e) => e.name === "JAK-NAVAZAT.txt")!).toString("utf8");
  assert.match(howto, /^Archiv Stromu „Archiv“ – jak na něj navázat/, howto);
  assert.match(howto, /strom app/, howto);
  assert.match(howto, /Aplikace Strom – rodokmen, jeho osoby a prameny/, howto);
  assert.doesNotMatch(howto, NO_AI, howto);
  assert.doesNotMatch(howto, /rozhovor|stáhne/, howto);
  // the launchers: the archive's menu (it offers the app)
  assert.match(readEntry(zip, entries.find((e) => e.name === "macOS.command")!).toString(), /"\$STROM" unpack "\$\(pwd\)"\n"\$STROM"\n/);
  // in German and English too
  for (const [lang, file, title] of [["de", "SO-GEHT-ES-WEITER.txt", /^Das Strom-Archiv „Archiv“/], ["en", "HOW-TO-CONTINUE.txt", /^The Strom archive "Archiv"/]] as const) {
    await w.ok(["lang", lang]);
    const out = path.join(w.dir, `archiv-${lang}.zip`);
    await w.ok(["pack", "--out", out]);
    const text = readEntry(out, readZip(out).find((e) => e.name === file)!).toString("utf8");
    assert.match(text, title, text);
    assert.match(text, /strom app/, text);
    assert.doesNotMatch(text, NO_AI, text);
  }
  // a research: the conversation with the agent, as it was
  const r = new World();
  await r.withTree("Výzkum");
  const rz = path.join(r.dir, "vyzkum.zip");
  await r.ok(["pack", "--out", rz]);
  const rh = readEntry(rz, readZip(rz).find((e) => e.name === "JAK-NAVAZAT.txt")!).toString("utf8");
  assert.match(rh, /^Výzkum „Výzkum“ – jak na něj navázat/, rh);
  assert.match(rh, /3\. Dál: v nabídce stromu rozhovor s agentem\./, rh);
  w.cleanup();
  r.cleanup();
});
