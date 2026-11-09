// strom error (spec 070): one ZIP file of what strom can say of a problem — nothing of the family tree's people
// (K1.3), into the downloads folder (K1.1), asked first only of a person at a terminal (K1.4), nothing sent, within
// its size (K1.6).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { PLANTED, nowhere, plantedWorld, zipTexts } from "./error.helpers.ts";
import { reportDir, REPORT_MAX_BYTES } from "../../src/commands/error.ts";

const opts = { skip: !hasGit };

test("the report holds nothing of the research's people: names, places, notes, paths with the user's name, tokens, logins, e-mails (K1.3)", opts, async () => {
  const { w } = await plantedWorld();
  const r = await w.ok(["error", "--yes", "--json", "--about", "fetch", "--about", "sync", "--note", "Vojtěch Lhoták z Lhoty se nestáhl, viz /Users/vlhotak/Desktop a lhotak@example.org"]);
  const file = r.json.file as string;
  assert.equal(path.dirname(file), path.join(w.env.HOME!, "Downloads"));
  const texts = zipTexts(file);
  assert.deepEqual(Object.keys(texts).sort(), ["README.txt", "report.json"]);
  assert.deepEqual(nowhere(texts, PLANTED), []);
  // the IDs stay (what a command was about), the user's own words stay readable
  const json = texts["report.json"]!;
  assert.ok(json.includes("P9999"), "an ID stays");
  assert.ok(json.includes("B0001"), "a book's ID stays");
  assert.match(texts["README.txt"]!, /se nestáhl, viz \/Users\/‹[0-9a-f]{5}›\/Desktop a ‹e›/);
  const report = JSON.parse(json);
  assert.equal(report.where, "unknown");
  assert.ok(report.areas.logs["live.log"].length >= 3);
  assert.equal(report.areas.research.fingerprint.counts.person, 3);
  w.cleanup();
});

test("the report goes to the downloads folder of each system, else the current folder, never into a research (K1.1)", () => {
  const has = (dirs: string[]) => (d: string) => dirs.includes(d);
  const home = path.join("/", "Users", "x");
  assert.equal(reportDir({ HOME: home }, "/tmp", "darwin", has([path.join(home, "Downloads")])), path.join(home, "Downloads"));
  const profile = path.join("C:", "Users", "x");
  assert.equal(reportDir({ HOME: profile, USERPROFILE: profile }, "/tmp", "win32", has([path.join(profile, "Downloads")])), path.join(profile, "Downloads"));
  const onedrive = path.join(profile, "OneDrive");
  assert.equal(reportDir({ HOME: profile, USERPROFILE: profile, OneDrive: onedrive }, "/tmp", "win32", has([path.join(onedrive, "Downloads")])), path.join(onedrive, "Downloads"));
  assert.equal(reportDir({ HOME: home }, "/tmp", "linux", has([path.join(home, "Downloads")])), path.join(home, "Downloads"));
  assert.equal(reportDir({ HOME: home }, process.cwd(), "linux", has([])), process.cwd(), "no downloads folder, outside a research: the current folder");
});

test("no downloads folder inside a research: the home folder, not the research", opts, async () => {
  const w = new World();
  const root = await w.withTree("Lhotákovi");
  const r = await w.ok(["error", "--yes", "--json"]);
  assert.equal(path.dirname(r.json.file), w.env.HOME);
  assert.ok(!fs.readdirSync(root).some((f) => f.startsWith("strom-error-")));
  // a second one the same minute: a name of its own
  const again = await w.ok(["error", "--yes", "--json"]);
  assert.notEqual(again.json.file, r.json.file);
  w.cleanup();
});

test("a person at a terminal sees what goes in and is asked; no answer yes, nothing made; without a terminal nothing is asked (K1.4)", opts, async () => {
  const w = new World();
  fs.mkdirSync(path.join(w.env.HOME!, "Downloads"));
  await w.withTree("Lhotákovi");
  const downloads = path.join(w.env.HOME!, "Downloads");
  // where: the terminal (2), create: no
  const no = await w.run(["error"], { tty: true, answers: ["2", "ne"] });
  assert.equal(no.code, 0, no.err);
  assert.match(no.out, /Kde se problém stal\?/);
  assert.match(no.out, /Zpráva o problému bude obsahovat/);
  assert.match(no.out, /výzkum v číslech/);
  assert.match(no.out, /Vytvořit zprávu\?/);
  assert.match(no.out, /Nic nevzniklo\./);
  assert.deepEqual(fs.readdirSync(downloads), []);
  // yes: made, where it happened as said
  const yes = await w.run(["error"], { tty: true, answers: ["2", "ano"] });
  assert.equal(yes.code, 0, yes.err);
  assert.match(yes.out, /Zpráva o problému vytvořena: .*strom-error-.*\.zip \(\d+ kB\)/);
  assert.match(yes.out, /milan@stromapp\.info/);
  const [file] = fs.readdirSync(downloads);
  assert.equal(JSON.parse(zipTexts(path.join(downloads, file!))["report.json"]!).where, "terminal");
  assert.match(zipTexts(path.join(downloads, file!))["README.txt"]!, /Kde se problém stal: v terminálu, strom bez agenta/);
  // no terminal: nothing asked, made at once
  const script = await w.run(["error"]);
  assert.equal(script.code, 0, script.err);
  assert.doesNotMatch(script.out, /Vytvořit zprávu\?|Kde se problém stal\?/);
  assert.equal(fs.readdirSync(downloads).length, 2);
  w.cleanup();
});

test("nothing goes over the network: no connection opened while the report is made", opts, async () => {
  const { w } = await plantedWorld();
  const tried: string[] = [];
  const connect = net.Socket.prototype.connect;
  const fetchBefore = globalThis.fetch;
  net.Socket.prototype.connect = function (this: net.Socket, ...args: unknown[]) {
    tried.push(JSON.stringify(args[0]));
    return connect.apply(this, args as Parameters<typeof connect>);
  } as typeof connect;
  globalThis.fetch = (async (u: unknown) => {
    tried.push(String(u));
    throw new Error("no network in this test");
  }) as typeof fetch;
  try {
    await w.ok(["error", "--yes", "--about", "fetch", "--about", "install"]);
  } finally {
    net.Socket.prototype.connect = connect;
    globalThis.fetch = fetchBefore;
  }
  assert.deepEqual(tried, []);
  w.cleanup();
});

test("a report within its size: logs trimmed to the newest, said in the README (K1.6)", opts, async () => {
  const w = new World();
  fs.mkdirSync(path.join(w.env.HOME!, "Downloads"));
  const root = await w.withTree("Lhotákovi");
  const now = Date.now();
  const lines: string[] = [];
  for (let i = 0; i < 60000; i++) lines.push(`${new Date(now - (60000 - i) * 1000).toISOString()} [42] request ${i} for B0001 ended with status 503 after ${i % 97} ms, retry later`);
  fs.writeFileSync(path.join(root, ".strom", "live.log"), lines.join("\n") + "\n");
  const r = await w.ok(["error", "--yes", "--json"]);
  assert.ok(r.json.bytes <= REPORT_MAX_BYTES, `${r.json.bytes}`);
  assert.ok(fs.statSync(r.json.file).size <= REPORT_MAX_BYTES);
  assert.ok(r.json.trimmed["live.log"] > 0);
  const texts = zipTexts(r.json.file);
  assert.match(texts["README.txt"]!, /Zkráceno, aby se vešlo, nejnovější zůstává: live\.log \(\d+\)/);
  const live = JSON.parse(texts["report.json"]!).areas.logs["live.log"] as string[];
  assert.match(live.at(-1)!, /request 59999 /, "the newest kept");
  w.cleanup();
});
