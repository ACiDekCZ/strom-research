// A level strom keeps of an archive stricter than strom's own list of its terms (core/floor.ts): a downloader or a
// research's record of the archive read the terms so once, and strom keeps the strictest level it saw (its floor) —
// only the person makes it milder. Said by strom doctor, strom run and strom allow archive (since when, why, what the
// list says, who decides); asked once in What waits and in the Strom app where nothing else holds it, answered by the
// person alone — kept, or as the archive's terms say, never milder than them; after a milder level only the tasks it
// really opens come back. Nothing new is written: an older strom reads the settings as before. The answers of a person
// are simulated only in each test's own settings; no request leaves this computer.

import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, fakeConnector, hasGit, pluginDir, readJsonFile } from "../helpers.ts";
import { humanClock } from "../../src/cli/human.ts";
import { testHooks } from "../../src/core/net.ts";
import { archivesFile, grantWay } from "../../src/core/terms.ts";
import { Tree } from "../../src/core/tree.ts";
import { waitingFor } from "../../src/core/waiting.ts";

const opts = { skip: !hasGit };
let ahead = 0;
testHooks.now = () => Date.now() + ahead;
testHooks.sleep = async (ms) => {
  ahead += ms;
};
// The days said ("od 13. 11.", "ověřeno 14. 11.") on a fixed day of the same year, whatever year the test runs in.
humanClock.now = () => Date.UTC(2026, 10, 20, 10, 0);
after(() => {
  testHooks.sleep = undefined;
  testHooks.now = undefined;
  humanClock.now = undefined;
});

const BOOK = "https://www.mza.cz/actapublica/matrika/detail/1";
const AGENT = { CLAUDECODE: "1" };
type Rec = { floor?: string; floorBy?: string; floorAt?: string; floorConnector?: string; way?: string };
const store = (w: World) => readJsonFile(archivesFile(w.env)) as { archives: Record<string, Rec>; pending: unknown[] };
const rec = (w: World, host = "www.mza.cz") => store(w).archives[host] ?? {};
const shared = (w: World) => path.join(w.home, "shared");
const agentScript = path.join(import.meta.dirname, "..", "fixtures", "agent.ts");
/** What waits in the research as the Strom app and the menu get it: the archives' items. */
const items = (w: World) => waitingFor(Tree.open(w.cwd, w.env), { shared: shared(w), stories: false }).filter((x) => x.item.kind === "permission").map((x) => ({ id: x.item.id, host: x.item.host, question: !!x.question, tasks: x.item.tasks }));
type Check = { allow: boolean; route?: string; level?: string; reason: string };
const check = async (w: World, url: string) => JSON.parse((await w.run(["net", "web", "--check", url, "--browser", "--json"], { env: { STROM_TEST_HUMAN_PACE_MS: "1000" } })).out) as Check;
/** Claude in Chrome's navigate as the hook gets it before the tool runs. */
async function navigate(w: World, url: string, use: string) {
  const stdin = JSON.stringify({ session_id: "agent-1", cwd: w.cwd, hook_event_name: "PreToolUse", tool_name: "mcp__claude-in-chrome__navigate", tool_input: { url, tabId: 7 }, tool_use_id: use });
  const r = await w.run(["net", "web", "--hook"], { stdin, env: { ...AGENT, STROM_TEST_HUMAN_PACE_MS: "1000" } });
  assert.equal(r.code, 0, r.err);
  const out = r.out.trim();
  return out ? ((JSON.parse(out) as { hookSpecificOutput: { permissionDecision?: string } }).hookSpecificOutput.permissionDecision ?? "allow") : "allow";
}

/** The agent's browser strom keeps: the Claude in Chrome extension in a profile of this computer's Chrome. */
function extension(w: World): void {
  const home = w.env.HOME!;
  const dir =
    process.platform === "darwin"
      ? path.join(home, "Library", "Application Support", "Google", "Chrome")
      : process.platform === "win32"
        ? path.join(w.env.LOCALAPPDATA ?? path.join(home, "AppData", "Local"), "Google", "Chrome", "User Data")
        : path.join(home, ".config", "google-chrome");
  fs.mkdirSync(path.join(dir, "Default", "Extensions", "fcoeoabgfenejglbffodgkkbkcdhcgfn"), { recursive: true });
}

/** A floor written as an older strom wrote it (a research's record of the archive read "by hand" once). */
function floor(w: World, host: string, r: Rec): void {
  const s = fs.existsSync(archivesFile(w.env)) ? store(w) : { archives: {}, pending: [] };
  s.archives[host] = { ...(s.archives[host] ?? {}), ...r };
  fs.mkdirSync(path.dirname(archivesFile(w.env)), { recursive: true });
  fs.writeFileSync(archivesFile(w.env), JSON.stringify(s, null, 2) + "\n");
}

/**
 * The reporter's state (K045): a research with a book of the Moravian Land Archives (strom's list: restricted, only
 * through a person's browser), the person's permission "through the browser", and a floor "by hand" strom kept of
 * www.mza.cz since 13 November with no downloader named — a task waiting for two images of the book.
 */
async function reporter(): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["research", "new", "X", "--new-person", "Jan /Lhoták/"]);
  await w.ok(["recordset", "add", "Lhota N 1784–1820", "--kinds", "baptism", "--places", "Lhota", "--years", "1784-1820", "--access", "online-free", "--url", BOOK]); // B1
  await w.ok(["task", "add", "Křest Jan", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]); // T1
  await w.ok(["task", "wait", "T1", "--images", "B1:1-2", "--on", "snímky 1–2 knihy narozených"]);
  assert.ok(grantWay(w.env, ["www.mza.cz"], "browser", { by: "terminal" }));
  floor(w, "www.mza.cz", { floor: "manual", floorBy: "strom", floorAt: "2026-11-13T20:47:14.000Z" });
  return w;
}

test("the reporter's state said: strom doctor warns, strom run says it once, strom allow archive shows since when, why, what strom's list says and who decides", opts, async () => {
  const w = await reporter();
  try {
    const doc = await w.run(["doctor"]);
    assert.match(doc.out, /! +archivy držené přísněji než jejich podmínky +Moravský zemský archiv \(Acta Publica\) \(www\.mza\.cz\): strom drží „snímky jen ručně“ od 13\. 11\. – tak to tehdy uvedl záznam archivu ve výzkumu nebo stahovač\. Podmínky archivu podle seznamu stromu \(ověřeno 14\. 11\.\): archiv pouští automatické nástroje jen přes prohlížeč člověka/);
    assert.match(doc.out, /→ Rozhoduje jen člověk: Co čeká, nebo strom allow archive www\.mza\.cz --level restricted \(podle podmínek\) · --keep/);
    const json = (await w.run(["doctor", "--json"])).json.checks.find((c: { name: string }) => c.name === "floor");
    assert.equal(json.status, "warn");
    // the agent's listing: the floor, its source, the list, the command
    const list = await w.ok(["allow", "archive"]);
    assert.match(list.out, /www\.mza\.cz +images through the browser on this computer +level ≥ manual \(strom 2026-11-13\)/);
    assert.match(list.out, /www\.mza\.cz: strom keeps manual since 2026-11-13 \(a research's record of the archive \(strom repo\) or the terms then\) — strom's list of its terms \(checked 2026-11-14\): restricted, only through a person's browser; the person decides \(What waits\): strom allow archive www\.mza\.cz --level restricted \(as its terms\) or --keep/);
    const floors = (await w.ok(["allow", "archive", "--json"])).json.floors;
    assert.deepEqual(floors.map((f: Record<string, unknown>) => [f.host, f.floor, f.by, f.list, f.browserOnly, f.ask]), [["www.mza.cz", "manual", "strom", "restricted", true, true]]);
    // strom run: one line before the agent starts, nothing changed
    await w.ok(["task", "add", "Úmrtí Jana", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]); // T2: work for the run
    const run = await w.run(["run", "--agent", "script"], { env: { STROM_RUNNER_SCRIPT: agentScript, AGENT_MODE: "nothing" } });
    const lines = run.out.split("\n").filter((l) => l.includes("www.mza.cz") && l.includes("13. 11."));
    assert.equal(lines.length, 1, run.out + run.err);
    assert.match(lines[0]!, /^· Moravský zemský archiv \(Acta Publica\) \(www\.mza\.cz\): strom drží „snímky jen ručně“ od 13\. 11\..*Rozhoduje jen člověk/);
    assert.equal(rec(w).floor, "manual", "said only");
    assert.equal(rec(w).floorBy, "strom");
  } finally {
    w.cleanup();
  }
});

test("What waits and the Strom app ask once; an agent cannot answer (exit 4, nothing written); \"as its terms\" in the menu: restricted, the person's — strom run's level and the Chrome hook agree, nothing asked again", opts, async () => {
  const w = await reporter();
  try {
    // the item the app shows: an archive's, its host, no question kept (computed), the tasks on it
    assert.deepEqual(items(w), [{ id: "floor:www.mza.cz", host: "www.mza.cz", question: false, tasks: ["T0001"] }]);
    const status = (await w.ok(["status", "--json"])).json.archiveQuestions;
    assert.deepEqual(status.map((q: Record<string, unknown>) => [q.kind, q.id, q.host]), [["permission", "floor:www.mza.cz", "www.mza.cz"]]);
    // before: by hand — the agent's browser kept off, as strom run keeps it
    assert.equal((await check(w, BOOK)).allow, false);
    assert.equal(await navigate(w, BOOK, "n1"), "deny");
    // an agent never answers it
    const before = fs.readFileSync(archivesFile(w.env), "utf8");
    for (const args of [["allow", "archive", "www.mza.cz", "--level", "restricted"], ["allow", "archive", "www.mza.cz", "--keep"]]) {
      const r = await w.run(args, { env: AGENT });
      assert.equal(r.code, 4, `${args.join(" ")}: ${r.out}${r.err}`);
    }
    assert.equal(fs.readFileSync(archivesFile(w.env), "utf8"), before, "nothing written");
    // the app's "Answer": its link opens the question in the person's terminal; 0 changes nothing
    const id = Tree.open(w.cwd, w.env).config.id;
    const link = await w.run(["link", "open", `strom-research://archive?tree=${id}&host=www.mza.cz`], { tty: true, answers: ["0", ""] });
    assert.match(link.out, /Moravský zemský archiv \(Acta Publica\) – co platí\?\n {3}1 {2}Ponechat „snímky jen ručně“ – už se neptat\n {3}2 {2}Podle podmínek archivu: archiv pouští automatické nástroje jen přes prohlížeč člověka[^\n]*\n {3}0 {2}Zpět – nic se nemění/);
    assert.equal(fs.readFileSync(archivesFile(w.env), "utf8"), before, "0: nothing changed");
    // the person in What waits: 3 · 1 the archive · 1 the question · 2 as its terms
    const menu = await w.run([], { tty: true, answers: ["3", "1", "1", "2", "0", "0", "0", "0"] });
    assert.match(menu.out, /✓ Moravský zemský archiv \(Acta Publica\): podle podmínek archivu – archiv pouští automatické nástroje jen přes prohlížeč člověka/);
    assert.deepEqual([rec(w).floor, rec(w).floorBy, rec(w).way], ["restricted", "person", "browser"]);
    // strom run's level (no downloader) and the Chrome hook agree now: through the person's browser
    const now = await check(w, BOOK);
    assert.deepEqual([now.allow, now.route], [true, "browser"]);
    assert.equal(await navigate(w, BOOK, "n2"), "allow");
    // never milder than the terms: its census records stay by its help only
    assert.equal((await check(w, "https://www.mza.cz/scitacioperaty/digisada/detail/1")).allow, false);
    // asked no more, said no more
    assert.deepEqual(items(w), []);
    assert.doesNotMatch((await w.run(["doctor"])).out, /archivy držené přísněji/);
    assert.equal((await w.ok(["allow", "archive", "--json"])).json.floors, undefined);
  } finally {
    w.cleanup();
  }
});

test("\"keep\": the person's level then — not asked again, still by hand; said in the listing as the person's", opts, async () => {
  const w = await reporter();
  try {
    const r = await w.run(["allow", "archive", "www.mza.cz", "--keep"], { tty: true });
    assert.equal(r.code, 0, r.out + r.err);
    assert.deepEqual([rec(w).floor, rec(w).floorBy], ["manual", "person"]);
    assert.deepEqual(items(w), [], "not asked again");
    assert.doesNotMatch((await w.run(["doctor"])).out, /archivy držené přísněji/);
    assert.equal((await check(w, BOOK)).allow, false, "still by hand");
    const floors = (await w.ok(["allow", "archive", "--json"])).json.floors;
    assert.deepEqual(floors.map((f: Record<string, unknown>) => [f.host, f.by, f.ask]), [["www.mza.cz", "person", false]]);
    assert.match((await w.ok(["allow", "archive"])).out, /www\.mza\.cz: strom keeps manual since \d{4}-\d\d-\d\d \(the person\)[^\n]*milder only by the person: strom allow archive www\.mza\.cz --level restricted/);
    // the menu's answer the same way: nothing waits
    const menu = await w.run([], { tty: true, answers: ["0"] });
    assert.doesNotMatch(menu.out, /Co čeká \(2\)/);
  } finally {
    w.cleanup();
  }
});

test("no question: a host strom's list does not know, a floor of the person's or an agent's, a list that says unknown, a host only a test's extra list knows", opts, async () => {
  const w = await reporter();
  try {
    const extra = path.join(w.dir, "archives-extra.json");
    fs.writeFileSync(extra, JSON.stringify({ archives: [{ host: "extra.example.org", name: "Extra", level: "restricted" }] }));
    w.env.STROM_ARCHIVES_FILE = extra;
    floor(w, "www.mza.cz", { floor: "manual", floorBy: "person" });
    floor(w, "portal.nacr.cz", { floor: "manual", floorBy: "agent", floorAt: "2026-11-01T10:00:00.000Z" });
    floor(w, "archive.example.org", { floor: "forbidden", floorBy: "strom", floorAt: "2026-11-01T10:00:00.000Z" });
    floor(w, "anno.onb.ac.at", { floor: "manual", floorBy: "strom", floorAt: "2026-11-01T10:00:00.000Z" });
    floor(w, "extra.example.org", { floor: "manual", floorBy: "strom", floorAt: "2026-11-01T10:00:00.000Z" });
    assert.deepEqual(items(w), []);
    assert.doesNotMatch((await w.run(["doctor"])).out, /archivy držené přísněji/);
    // the listing says the person's and the agent's floors of listed archives as they are
    const floors = (await w.ok(["allow", "archive", "--json"])).json.floors as { host: string; by: string; ask: boolean }[];
    assert.deepEqual(floors.map((f) => [f.host, f.by, f.ask]), [["portal.nacr.cz", "agent", false], ["www.mza.cz", "person", false]]);
  } finally {
    w.cleanup();
  }
});

test("held by a downloader or by the research's record of the archive: no question (lowering the floor would change nothing) — said what holds it; strom allow archive --level names the real source", opts, async () => {
  const w = await reporter();
  try {
    // the research's record of the archive, written "by hand" by an agent
    await w.ok(["repo", "add", "Moravský zemský archiv", "--country", "CZ", "--url", "https://www.mza.cz/actapublica", "--automation", "manual"]); // R0001
    assert.deepEqual(items(w), []);
    const doc = (await w.run(["doctor"])).out;
    assert.match(doc, /archivy držené přísněji[^\n]*www\.mza\.cz[^\n]*→ Drží to ještě: záznam archivu ve výzkumu R0001/);
    assert.match((await w.ok(["allow", "archive"])).out, /www\.mza\.cz: strom keeps manual since 2026-11-13 [^\n]*still held by the research's archive R0001 \(strom repo show R0001\)/);
    // the person makes it milder: what still holds it, named — and what strom run takes
    const r = await w.run(["allow", "archive", "www.mza.cz", "--level", "restricted"], { tty: true });
    assert.equal(r.code, 0, r.out + r.err);
    assert.match(r.out, /it stays manual: [^\n]*R0001/);
    assert.doesNotMatch(r.out, /strom's known terms of the archive/);
    // a downloader on the host that reads it by hand: named by its name
    await w.ok(["repo", "edit", "R0001", "--automation", "unknown"], { tty: true });
    await fakeConnector(w, "mzaruc", "", { automation: "manual" });
    const file = path.join(pluginDir(w, "mzaruc"), "connector.json");
    fs.writeFileSync(file, JSON.stringify({ ...readJsonFile(file), hosts: ["www.mza.cz"] }));
    floor(w, "www.mza.cz", { floor: "manual", floorBy: "strom", floorAt: "2026-11-13T20:47:14.000Z", floorConnector: "mzaruc" });
    assert.deepEqual(items(w), []);
    assert.match((await w.ok(["allow", "archive"])).out, /www\.mza\.cz: strom keeps manual since 2026-11-13 \(connector mzaruc's reading\)[^\n]*still held by connector mzaruc/);
    const again = await w.run(["allow", "archive", "www.mza.cz", "--level", "restricted"], { tty: true });
    assert.match(again.out, /it stays manual: mzaruc/);
    assert.match(again.out, /strom connector show mzaruc/);
  } finally {
    w.cleanup();
  }
});

test("only what the milder level opens comes back: without the agent's browser the images by hand keep waiting; with it the task goes back to the queue — a check of a site never", opts, async () => {
  for (const ready of [false, true]) {
    const w = await reporter();
    try {
      if (ready) extension(w);
      await w.ok(["task", "add", "Ověřit stránku", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]); // T2
      await w.ok(["search", "add", "Kniha zemřelých", "--method", "web", "--result", "inconclusive", "--task", "T2", "--note", "www.mza.cz: the page did not show the book"]);
      await w.ok(["task", "wait", "T2", "--check", "https://www.mza.cz/actapublica/matrika/detail/2", "--on", "ověřit stránku"]);
      const r = await w.run(["allow", "archive", "www.mza.cz", "--level", "restricted"], { tty: true });
      assert.equal(r.code, 0, r.out + r.err);
      const state = async (id: string) => (await w.ok(["task", "show", id, "--json"])).json.task.state as string;
      assert.equal(await state("T1"), ready ? "open" : "waiting", `browser ready ${ready}: ${r.out}`);
      assert.equal(await state("T2"), "waiting", "a check waits for the person's own answer");
      if (ready) assert.match(r.out, /T0001/);
      else assert.doesNotMatch(r.out, /T0001/);
    } finally {
      w.cleanup();
    }
  }
});

test("settings of archives that cannot be read: no question, neither --level nor --keep writes a byte, and strom doctor they point to names the file", opts, async () => {
  const w = await reporter();
  try {
    const file = archivesFile(w.env);
    const broken = fs.readFileSync(file, "utf8").slice(0, -20);
    fs.writeFileSync(file, broken);
    assert.deepEqual(items(w), []);
    for (const args of [["allow", "archive", "www.mza.cz", "--level", "restricted"], ["allow", "archive", "www.mza.cz", "--keep"]]) {
      const r = await w.run(args, { tty: true });
      assert.notEqual(r.code, 0, `${args.join(" ")}: ${r.out}${r.err}`);
      assert.equal(fs.readFileSync(file, "utf8"), broken, args.join(" "));
      assert.match(r.err + r.out, /strom doctor/);
    }
    // where the refusal points: strom doctor names the file that cannot be read, and changes nothing
    const doc = await w.run(["doctor"]);
    assert.match(doc.out, /! +nastavení archivů +.*archives\.json nelze přečíst – dokud se neopraví/u, doc.out);
    const check = (await w.run(["doctor", "--json"])).json.checks.find((c: { name: string }) => c.name === "archives");
    assert.deepEqual([check.status, check.code], ["warn", "archives.unreadable"]);
    assert.ok(check.detail.includes(path.basename(file)));
    assert.equal(fs.readFileSync(file, "utf8"), broken);
  } finally {
    w.cleanup();
  }
});

test("nothing new is written: after either answer the record has only what an older strom reads (a floor of the person's), no question kept for it", opts, async () => {
  for (const args of [["--keep"], ["--level", "restricted"]]) {
    const w = await reporter();
    try {
      const before = store(w);
      await w.ok(["allow", "archive", "www.mza.cz", ...args], { tty: true });
      const after = store(w);
      assert.deepEqual(Object.keys(after).sort(), Object.keys(before).sort());
      assert.deepEqual(after.pending, before.pending, "no question kept: it is computed");
      const known = new Set(["at", "by", "prior", "way", "floor", "floorBy", "floorAt"]);
      assert.deepEqual(Object.keys(rec(w)).filter((k) => !known.has(k)), [], args.join(" "));
      assert.equal(rec(w).floorBy, "person");
    } finally {
      w.cleanup();
    }
  }
});

test("an archive of strom's list kept by hand stays so: a new downloader that says allowed gets nothing, discarded or not — the person decides", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  try {
    const fetch = async (name: string) => (await w.run(["fetch", name, "5359", "--images", "1", "--recordset", "B1"])).code;
    const onMza = async (name: string, automation: string) => {
      await fakeConnector(w, name, "", { automation }, { confirm: false });
      const file = path.join(pluginDir(w, name), "connector.json");
      fs.writeFileSync(file, JSON.stringify({ ...readJsonFile(file), hosts: ["www.mza.cz"] }));
    };
    await w.ok(["research", "new", "X", "--new-person", "Jan /Lhoták/"]);
    await w.ok(["recordset", "add", "Lhota N 1784–1820", "--url", BOOK]); // B1
    await w.ok(["task", "add", "Křest Jan", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]);
    await w.ok(["session", "start", "T1"]);
    await onMza("mzaruc", "manual");
    assert.notEqual(await fetch("mzaruc"), 0);
    assert.deepEqual([rec(w).floor, rec(w).floorConnector], ["manual", "mzaruc"]);
    fs.rmSync(pluginDir(w, "mzaruc"), { recursive: true, force: true });
    // the agent makes one of its own for the host: the level holds, and holds after it is discarded
    await onMza("agentb", "allowed");
    assert.notEqual(await fetch("agentb"), 0);
    assert.equal(rec(w).floor, "manual");
    await w.ok(["connector", "discard", "agentb"]);
    assert.equal(rec(w).floor, "manual", "the level strom saw before it stays");
    assert.equal((await check(w, BOOK)).allow, false, "the agent's browser kept off");
    // the floor alone holds it now: a question for the person — never the agent's
    assert.deepEqual(items(w).map((i) => i.id), ["floor:www.mza.cz"]);
    assert.equal((await w.run(["allow", "archive", "www.mza.cz", "--level", "restricted"], { env: AGENT })).code, 4);
    assert.equal(rec(w).floor, "manual");
  } finally {
    w.cleanup();
  }
});

test("prevention: a downloader or a research's record of an archive of strom's list stricter than the list is warned of — at connector new, connector test, repo add and repo edit; never for a host the list does not know", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  try {
    const made = await w.ok(["connector", "new", "mza-novy", "--url", "https://www.mza.cz/actapublica"]);
    assert.match(made.out, /strom knows the terms of Moravský zemský archiv \(Acta Publica\): restricted/);
    assert.match(made.out, /policy\.automation no stricter than that without a quote from the archive's terms/);
    assert.match(fs.readFileSync(path.join(pluginDir(w, "mza-novy"), "DISCOVERY.md"), "utf8"), /never write a level stricter\s+than the list's without a quote from the archive's terms/);
    await fakeConnector(w, "mzaruc", "", { automation: "manual" });
    const file = path.join(pluginDir(w, "mzaruc"), "connector.json");
    fs.writeFileSync(file, JSON.stringify({ ...readJsonFile(file), hosts: ["www.mza.cz"] }));
    const tested = await w.run(["connector", "test", "mzaruc", "--find", "Lhota"]);
    assert.match(tested.out + tested.err, /⚠ policy\.automation "manual" is stricter than strom's list of the archive's terms: Moravský zemský archiv \(Acta Publica\) restricted, only through a person's browser \(checked 2026-11-14/);
    assert.match(tested.out + tested.err, /by hand only: no agent's browser there[^\n]*else "automation": "restricted"/);
    const added = await w.ok(["repo", "add", "MZA", "--url", "https://www.mza.cz/actapublica", "--automation", "manual"]);
    assert.match(added.out, /⚠ automation "manual" is stricter than strom's list/);
    const edited = await w.ok(["repo", "edit", "R0001", "--automation", "forbidden"]);
    assert.match(edited.out, /⚠ automation "forbidden" is stricter than strom's list/);
    assert.doesNotMatch((await w.ok(["repo", "edit", "R0001", "--name", "Moravský zemský archiv"])).out, /stricter than strom's list/, "only where the level or the address is written");
    assert.doesNotMatch((await w.ok(["repo", "add", "Jiný", "--url", "https://archive.example.org", "--automation", "manual"])).out, /stricter than strom's list/);
  } finally {
    w.cleanup();
  }
});

test("net web --check without --browser where the person allowed it \"through the browser\" (and kept it restricted): the way through the agent's browser as it is here, never the permission that already stands; without it the permission, as before", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["research", "new", "X", "--new-person", "Jan /Lhoták/"]);
  await w.ok(["recordset", "add", "Lhota N 1784–1820", "--kinds", "baptism", "--places", "Lhota", "--years", "1784-1820", "--access", "online-free", "--url", BOOK]); // B1
  const SITE = "https://www.mza.cz/actapublica/";
  const web = async (env: Record<string, string>) => JSON.parse((await w.run(["net", "web", "--check", SITE, "--json"], { env })).out) as Check & { why?: string };
  try {
    // no permission yet: the person's permission is the way, as before
    const none = await web(AGENT);
    assert.equal(none.allow, false);
    assert.match(none.reason, /strom allow archive www\.mza\.cz --way browser — the person's, never yours/);

    // the person allowed it "through the browser" and kept it restricted (K045's floor by the person)
    assert.ok(grantWay(w.env, ["www.mza.cz"], "browser", { by: "terminal" }));
    floor(w, "www.mza.cz", { floor: "restricted", floorBy: "person", floorAt: "2026-11-20T22:47:05.573Z" });
    // Claude Code without the extension here: the truth — by hand, and once the word of the extension
    const noext = await web(AGENT);
    assert.deepEqual([noext.allow, noext.why, noext.level], [false, "browser", "restricted"]);
    assert.doesNotMatch(noext.reason, /--way browser/);
    assert.match(noext.reason, /The person allowed it "through the browser", but the Claude in Chrome extension is in no browser here — the person saves the images by hand/);
    // the permission already stands: only the extension is named, never the permission again
    assert.match(noext.reason, /Tell the user once: with the extension \([^)]*\) the agent would save them itself\./);
    assert.doesNotMatch(noext.reason, /and the permission "through the browser" the agent would save them itself/);
    // with the extension: not the web fetch, its browser — at a person's pace, and the check with --browser
    extension(w);
    const ready = await web(AGENT);
    assert.equal(ready.allow, false, "the web fetch stays refused");
    assert.doesNotMatch(ready.reason, /--way browser/);
    assert.match(ready.reason, /The person allowed it "through the browser": not your web fetch, but your browser — its pages one at a time at a person's pace \(strom net web --check https:\/\/www\.mza\.cz\/actapublica\/ --browser says what opens\)/);
    assert.match(ready.reason, /its images through your browser \(Claude in Chrome\), one image at a time at a person's pace: strom media save T… --image <n>/);
    // ...which says so
    assert.equal((await check(w, SITE)).allow, true);
    // the web fetch hook of Claude Code: the same way on
    const stdin = JSON.stringify({ session_id: "agent-1", cwd: w.cwd, hook_event_name: "PreToolUse", tool_name: "WebFetch", tool_input: { url: SITE, prompt: "x" }, tool_use_id: "u1" });
    const hook = await w.run(["net", "web", "--hook"], { stdin, env: AGENT });
    assert.match(hook.out, /not your web fetch, but your browser/);
    assert.doesNotMatch(hook.out, /--way browser/);
    // a person (no agent): the browser of an agent strom keeps
    assert.match((await web({})).reason, /The person allowed it "through the browser": through the browser of an agent strom keeps \(Claude Code with Claude in Chrome\)/);
    // an agent whose browser strom does not keep: the person's hand, as before
    const grok = await web({ GROK_AGENT: "1" });
    assert.match(grok.reason, /strom does not keep your browser or computer use/);
    assert.doesNotMatch(grok.reason, /--way browser/);
  } finally {
    w.cleanup();
  }
});
