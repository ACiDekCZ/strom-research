// What the person sees of an archive's terms (core/archiveasks.ts, cli/menu-archives.ts): the question about an
// archive's images in the menu's What waits — right after the app's sends, counted in the main menu, one line above it
// and in the orientation until it is answered — the choice made there (0 changes nothing; the tasks that waited for
// the images back in the queue unless the images are in their folder already), the connectors taken over confirmed
// once, a milder reading kept; the settings' line of each downloader and its permission looked at again; the Strom
// app's bridge (waiting kind permission, feature archive.permission) and its link archive&host=, which only opens the
// question. Nothing of it in an archive. A person's answer is simulated only in each test's own settings (R8).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit, fakeConnector, pluginDir, readJsonFile } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";

const opts = { skip: !hasGit };

const store = (w: World) => readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "archives.json"));
const task = async (w: World, id: string) => (await w.ok(["task", "show", id, "--json"])).json.task as { state: string };
const menu = (w: World, answers: string[]) => w.run([], { tty: true, answers });

/**
 * A research with a downloader of an archive whose terms restrict automation (no network: the archive is never
 * reached), two books on its site and a task waiting for the images of each — the second one's saved by hand already —
 * and the question about the archive's images asked by a fetch nobody could answer.
 */
async function asked(): Promise<World> {
  const w = new World();
  await w.withTree();
  await fakeConnector(w, "zkusebni", "", { automation: "restricted", terms: "https://archive.example.org/terms", termsSummary: "Snímky jen jednotlivě, standardními prostředky prohlížeče." });
  await w.ok(["recordset", "add", "Týnec N 1784–1820", "--url", "https://archive.example.org/book/5359"]); // B0001
  await w.ok(["recordset", "add", "Týnec O 1784–1820", "--url", "https://archive.example.org/book/5360"]); // B0002
  for (const n of ["1", "2"]) await w.ok(["task", "add", `Křest ${n}`, "--level", "locate", "--where", "Týnec", "--why", "a", "--done-when", "b"]);
  await w.ok(["task", "wait", "T0001", "--images", "B0001:1-2", "--on", "snímky 1–2 knihy narozených"]);
  await w.ok(["task", "wait", "T0002", "--images", "B0002:3", "--on", "snímek 3 knihy oddaných"]);
  // the person saved T0002's image by hand meanwhile
  const shared = path.join(w.home, "shared");
  const folder = fs.readdirSync(path.join(shared, "inbox")).find((f) => f.startsWith("B0002"))!;
  fs.writeFileSync(path.join(shared, "inbox", folder, "3.jpg"), "a scan");
  const r = await w.run(["fetch", "zkusebni", "5359", "--images", "1-2", "--recordset", "B1", "--json"]);
  assert.equal(r.code, 4, r.out + r.err);
  assert.equal(r.json.needs, "permission");
  return w;
}

test("What waits: the archive's question after the app's sends, counted, said above the menu and in the orientation; 0 changes nothing; slowly: the tasks back in the queue — the one whose image is in its folder stays", opts, async () => {
  const w = await asked();
  try {
    // 3 · 1 the archive's place (its question and the tasks of its images) · 1 the question · 0 · 0 · 0 · 0
    const before = await menu(w, ["3", "1", "1", "0", "0", "0", "0"]);
    assert.match(before.out, /^Čeká rozhodnutí o stahování z archivu Testovací archiv$/m, "the line above the menu");
    assert.match(before.out, /Co čeká \(3\)/, "counted with the tasks");
    assert.match(before.out, /\n 1 {2}Testovací archiv · 3 {3}svolení archivu 1 · snímky 2\n/, "the question at its archive's place");
    assert.match(before.out, /\n {3}1 {2}Stahování snímků z archivu Testovací archiv \(archive\.exampl… · svolení archivu · od [^\n]+\n {3}2 {2}Křest 1 · snímky · priorita 3\n/, "the tasks after it");
    assert.match(before.out, /\n Stahování snímků z archivu Testovací archiv \(archive\.example\.org\)\n {4}Podmínky podle stahovače: Snímky jen jednotlivě, standardními prostředky prohlížeče\. \(https:\/\/archive\.example\.org\/terms\)\n {4}Čekají na to úkoly: T0001, T0002\n {4}Čeká od [^\n]+ · pokusy o stažení: 1\n/);
    assert.match(before.out, /Tempo snímků pomalu: jeden snímek nejvýš za 10 s, nejvýš 120 požadavků za hodinu včetně katalogu – změnit jde jen příkazem: strom allow host archive\.example\.org/);
    assert.match(before.out, /Testovací archiv – jak získávat snímky\?\n {3}1 {2}Pomalu, lidským tempem[^\n]*\n {3}2 {2}Jen ručně[^\n]*\n {3}0 {2}Zpět – nic se nemění\nVybrat \[0\]/, "0 suggested, no browser for a downloader without its route");
    assert.equal(store(w).archives["archive.example.org"]?.way, undefined, "0: nothing changed");
    assert.equal(store(w).pending.filter((p: { kind: string }) => p.kind === "permission").length, 1);
    // the orientation and the status say it too, one line
    assert.match((await w.ok([])).out, /Čeká rozhodnutí o stahování z archivu Testovací archiv/);
    assert.equal((await w.ok(["--json"])).json.permissions[0].host, "archive.example.org");
    assert.match((await w.ok(["status"])).out, /Čeká rozhodnutí o stahování z archivu Testovací archiv/);
    // strom status --json carries the question too, as the bridge's /status does
    const json = (await w.ok(["status", "--json"])).json.archiveQuestions;
    assert.equal(json.length, 1);
    assert.deepEqual([json[0].kind, json[0].id, json[0].host, json[0].tasks, json[0].choices], ["permission", "permission:archive.example.org", "archive.example.org", ["T0001", "T0002"], ["slow", "manual"]]);
    // the agent's question of a permission, in words without "images" twice
    const agent = await w.run(["allow", "archive", "zkusebni", "--way", "slow"], { env: { CLAUDECODE: "1" } });
    assert.equal(agent.code, 4);
    assert.match(agent.out + agent.err, /Allow Testovací archiv \(archive\.example\.org\): images slowly, at a person's pace\?/);
    assert.doesNotMatch(agent.out + agent.err, /images of/i);

    // the person allows it slowly: 3 · 1 · 1 · 1
    const yes = await menu(w, ["3", "1", "1", "1", "0", "0", "0"]);
    assert.match(yes.out, /✓ Testovací archiv: snímky pomalu, lidským tempem\. Změnit: nastavení → Archivy\./);
    assert.match(yes.out, /T0002: ve složce už jsou snímky \(1\) – výzkum je zaeviduje a úkol se vrátí sám\./);
    assert.match(yes.out, /Úkoly T0001 se vracejí do fronty\./);
    assert.equal(store(w).archives["archive.example.org"].way, "slow");
    assert.equal(store(w).pending.length, 0, "its question gone");
    assert.equal((await task(w, "T0001")).state, "open");
    assert.equal((await task(w, "T0002")).state, "waiting", "its image is there: nothing fetched twice");
    // answered: said no more
    assert.doesNotMatch((await w.ok([])).out, /Čeká rozhodnutí o stahování/);
    assert.doesNotMatch((await menu(w, ["0"])).out, /Čeká rozhodnutí o stahování/);
  } finally {
    w.cleanup();
  }
});

test("by hand only: the tasks keep waiting; Settings → Archives: each downloader's state and pace read only, its permission with the current way suggested, forgotten", opts, async () => {
  const w = await asked();
  try {
    const manual = await menu(w, ["3", "1", "1", "2", "0", "0", "0"]);
    assert.match(manual.out, /✓ Testovací archiv: snímky jen ručně\./);
    assert.match(manual.out, /Úkoly T0001, T0002 dál čekají na snímky uložené ručně\./);
    assert.equal((await task(w, "T0001")).state, "waiting");
    // the settings: the line of the downloader, and the item of the permissions (its number as shown)
    const look = await menu(w, ["8", "4", "0", "0", "0"]);
    assert.match(look.out, /• Testovací archiv — snímky přímo, strom hlídá tempo; snímky jen ručně, rozhodnuto [^\n]+/);
    const key = /(\d) {2}Svolení ke stahování z archivů/.exec(look.out)?.[1];
    assert.ok(key, look.out);
    // the current way suggested (Enter keeps it), then slowly
    const kept = await menu(w, ["8", "4", key!, "1", "", "0", "0", "0", "0"]);
    assert.match(kept.out, /1 {2}Testovací archiv \(archive\.example\.org\) – snímky jen ručně, rozhodnuto/);
    assert.match(kept.out, /3 {2}Zapomenout rozhodnutí[^\n]*\n {3}0 {2}Zpět – nic se nemění\nVybrat \[2\]/);
    assert.equal(store(w).archives["archive.example.org"].way, "manual");
    await menu(w, ["8", "4", key!, "1", "1", "0", "0", "0", "0"]);
    assert.equal(store(w).archives["archive.example.org"].way, "slow");
    const slow = await menu(w, ["8", "4", "0", "0", "0"]);
    assert.match(slow.out, /• Testovací archiv — snímky přímo, strom hlídá tempo; snímky pomalu, lidským tempem, rozhodnuto [^;\n]+; jeden snímek nejvýš za 10 s, nejvýš 120 požadavků za hodinu včetně katalogu/);
    // forgotten: asked again at the next need
    const gone = await menu(w, ["8", "4", key!, "1", "3", "0", "0", "0", "0"]);
    assert.match(gone.out, /✓ Testovací archiv: rozhodnutí zapomenuto/);
    assert.equal(store(w).archives["archive.example.org"].way, undefined);
  } finally {
    w.cleanup();
  }
});

test("a decision forgotten brings back no old question: nothing waits above the menu until a fetch needs the archive again", opts, async () => {
  const w = await asked();
  try {
    // decided in What waits (slowly), then forgotten in Settings → Archives
    await menu(w, ["3", "1", "1", "1", "0", "0", "0"]);
    const look = await menu(w, ["8", "4", "0", "0", "0"]);
    const key = /(\d) {2}Svolení ke stahování z archivů/.exec(look.out)?.[1];
    assert.ok(key, look.out);
    const gone = await menu(w, ["8", "4", key!, "1", "3", "0", "0", "0", "0"]);
    assert.match(gone.out, /✓ Testovací archiv: rozhodnutí zapomenuto/);
    assert.deepEqual(store(w).pending.filter((p: { kind: string }) => p.kind === "permission"), [], "the question from before the decision not brought back");
    const after = await menu(w, ["0"]);
    assert.doesNotMatch(after.out, /Čeká rozhodnutí o stahování/);
    assert.doesNotMatch(after.out, /Co čeká \(2\)/, "only the task with its images in its folder waits");
    assert.doesNotMatch((await w.ok([])).out, /Čeká rozhodnutí o stahování/);
    // a question that waits (later) is dropped by forgetting too; a task that waited only for the decision comes back
    const r = await w.run(["fetch", "zkusebni", "5359", "--images", "1-2", "--recordset", "B1", "--json"]);
    assert.equal(r.code, 4, "the real need asks again");
    assert.equal(store(w).pending.filter((p: { kind: string }) => p.kind === "permission").length, 1);
    await w.ok(["allow", "archive", "archive.example.org", "--revoke"], { tty: true });
    assert.deepEqual(store(w).pending.filter((p: { kind: string }) => p.kind === "permission"), []);
    assert.doesNotMatch((await menu(w, ["0"])).out, /Čeká rozhodnutí o stahování/);
  } finally {
    w.cleanup();
  }
});

test("a downloader behind a bot check (browser.pages): the question kept and the hint offer the ways the menu and the bridge do — never slowly", opts, async () => {
  const w = new World();
  await w.withTree();
  try {
    const dir = await fakeConnector(w, "kontrola", "", { automation: "restricted", terms: "https://archive.example.org/terms" });
    const file = path.join(dir, "connector.json");
    fs.writeFileSync(file, JSON.stringify({ ...readJsonFile(file), can: ["find", "list", "locate"], routes: ["browser"], browser: { pages: true } }));
    const r = await w.run(["fetch", "kontrola", "--find", "Týnec"]);
    assert.equal(r.code, 4, r.out + r.err);
    const q = store(w).pending.find((p: { kind: string }) => p.kind === "permission");
    assert.deepEqual(q.choices, ["browser", "manual"], "never slowly: every page goes through the person's browser");
    assert.match(r.err, /strom allow archive archive\.example\.org --way (browser\|)?manual$/m);
    assert.doesNotMatch(r.err, /--way slow/);
    // the orientation's command the same
    assert.doesNotMatch((await w.ok(["--json"])).json.permissions[0].command, /slow/);
  } finally {
    w.cleanup();
  }
});

test("the Strom app: /status waiting kind permission with its terms, tasks and choices, feature archive.permission; its link only opens the question — an unknown archive only said", opts, async () => {
  const w = await asked();
  try {
    const info = (await w.ok(["live", "start", "--json"])).json;
    try {
      const status = (await fetch(`${info.url}/status`, { headers: { Origin: "https://beta.stromapp.info" } }).then((r) => r.json())) as { features: string[]; waiting: Record<string, unknown>[] };
      assert.ok(status.features.includes("archive.permission"));
      const item = status.waiting.find((x) => x.kind === "permission")!;
      assert.deepEqual(item, {
        kind: "permission",
        id: "permission:archive.example.org",
        what: "Stahování snímků z archivu Testovací archiv (archive.example.org)",
        on: "Podmínky podle stahovače: Snímky jen jednotlivě, standardními prostředky prohlížeče. (https://archive.example.org/terms)",
        at: item.at,
        since: item.at,
        tries: 1,
        host: "archive.example.org",
        title: "Testovací archiv",
        terms: "https://archive.example.org/terms",
        quote: "Snímky jen jednotlivě, standardními prostředky prohlížeče.",
        tasks: ["T0001", "T0002"],
        choices: ["slow", "manual"],
        // what waits, grouped (feature waiting.groups): the archive's place, a decision, nothing a link of a task does
        section: "decide",
        group: { key: "host:archive.example.org", name: "Testovací archiv", kind: "web" },
        phase: "todo",
        actions: [],
        order: 0,
      });
      // the tasks that wait for its images saved by hand: in its tasks, and each an item of its own once (saved by hand
      // or talked about whatever the question), at the archive's place under its name
      const byHand = status.waiting.filter((x) => x.id === "T0001" || x.id === "T0002") as unknown as { id: string; kind: string; group: { key: string; name: string } }[];
      assert.deepEqual(
        byHand.map((x) => [x.id, x.kind, x.group.key, x.group.name]),
        [
          ["T0001", "images", "host:archive.example.org", "Testovací archiv"],
          ["T0002", "images", "host:archive.example.org", "Testovací archiv"],
        ],
      );
    } finally {
      await w.ok(["live", "stop"]);
    }
    const id = Tree.open(w.cwd, w.env).config.id;
    // an archive strom knows no question or downloader of: only said, nothing asked
    const unknown = await w.run(["link", "open", `strom-research://archive?tree=${id}&host=other.example.org`], { tty: true, answers: [""] });
    assert.match(unknown.out, /O tomto archivu tu není co rozhodnout\. Nic se nestalo\./);
    assert.doesNotMatch(unknown.out, /jak získávat snímky/);
    // not a host: refused before anything
    const bad = await w.run(["link", "open", `strom-research://archive?tree=${id}&host=x%3Brm`], { tty: true, answers: [""] });
    assert.match(bad.out, /Tento odkaz z aplikace Strom nešel použít – některá jeho část chybí nebo nesedí\. Nic se nestalo\./);
    // the question as in the menu; the answer is the person's here (0: nothing changes), never the link's
    const back = await w.run(["link", "open", `strom-research://archive?tree=${id}&host=archive.example.org&way=slow`], { tty: true, answers: ["0", ""] });
    assert.match(back.out, /Testovací archiv – jak získávat snímky\?/);
    assert.equal(store(w).archives["archive.example.org"]?.way, undefined);
    await w.run(["link", "open", `strom-research://archive?tree=${id}&host=archive.example.org`], { tty: true, answers: ["1", ""] });
    assert.equal(store(w).archives["archive.example.org"].way, "slow");
    assert.equal((await task(w, "T0001")).state, "open");
  } finally {
    w.cleanup();
  }
});

test("an archive shows none of it: no item, no count, no line, nothing in /status, its link only said", opts, async () => {
  const w = await asked();
  try {
    const tree = Tree.open(w.cwd, w.env);
    tree.withTreeLock(() => {
      tree.updateConfig((c) => void (c.mode = "archive"), { op: "config.set", summary: "the research is an archive" });
      tree.commit("The research is an archive");
    });
    const m = await menu(w, ["3", "", "0"]);
    assert.doesNotMatch(m.out, /stahování|Stahování/);
    assert.match(m.out, /Nic nečeká/);
    assert.doesNotMatch((await w.ok([])).out, /stahování/);
    assert.equal((await w.ok(["--json"])).json.permissions, undefined);
    const info = (await w.ok(["live", "start", "--json"])).json;
    try {
      const status = (await fetch(`${info.url}/status`, { headers: { Origin: "https://beta.stromapp.info" } }).then((r) => r.json())) as { waiting: Record<string, unknown>[] };
      assert.deepEqual(status.waiting, []);
    } finally {
      await w.ok(["live", "stop"]);
    }
    const link = await w.run(["link", "open", `strom-research://archive?tree=${tree.config.id}&host=archive.example.org`], { tty: true, answers: [""] });
    assert.match(link.out, /O tomto archivu tu není co rozhodnout/);
  } finally {
    w.cleanup();
  }
});

test("the connectors taken over from an older strom: one item, confirmed all at once or gone through one by one (stricter kept); a milder reading later kept as it is, not asked again", opts, async () => {
  const w = new World();
  await w.withTree();
  try {
    await fakeConnector(w, "prvni", "", { automation: "allowed", terms: "https://archive.example.org/terms", termsSummary: "Downloads allowed." }, { confirm: false });
    const druhy = await fakeConnector(w, "druhy", "", { automation: "allowed" }, { confirm: false });
    const d = readJsonFile(path.join(druhy, "connector.json"));
    fs.writeFileSync(path.join(druhy, "connector.json"), JSON.stringify({ ...d, title: "Druhý archiv", hosts: ["second.example.org"] }));
    // as after an update: an older strom ran here, this one takes the connectors over as they were
    const config = path.join(w.env.STROM_CONFIG_DIR!, "config.json");
    fs.writeFileSync(config, JSON.stringify({ ...readJsonFile(config), lastVersion: "1.13.0" }));
    fs.rmSync(path.join(w.env.STROM_CONFIG_DIR!, "archives.json"), { force: true });
    await w.ok(["consents"]);
    const look = await menu(w, ["3", "1", "0", "0", "0"]);
    assert.match(look.out, /Co čeká \(1\)/);
    assert.match(look.out, /\n 1 {2}[^\n]+ · 1 {3}Potvrdit úrovně stahovačů převzatých z dřívější verze \(2\): …\n/);
    assert.match(look.out, /• Testovací archiv \(archive\.example\.org\): podle podmínek dovoleno/);
    assert.ok(store(w).pending.some((p: { kind: string }) => p.kind === "takeover"), "0: still waits");
    // the window of an agent's --accept says the levels in words, never their codes (the person says no here)
    const acc = await w.run(["allow", "archive", "--accept"], { env: { CLAUDECODE: "1" }, dialog: false });
    assert.match(acc.err, /Druhý archiv \(podle podmínek dovoleno\), Testovací archiv \(podle podmínek dovoleno\)/);
    assert.doesNotMatch(acc.err, /\(allowed\)/);
    // gone through: the first made stricter — confirmed, its level kept stricter; the other left as it is (0)
    const each = await menu(w, ["3", "1", "2", "2", "0", "0", "0"]);
    assert.match(each.out, /Druhý archiv – co platí\?/);
    assert.match(each.out, /Testovací archiv – co platí\?/);
    assert.match(each.out, /✓ Potvrzeno: Druhý archiv \(podmínky automatické stahování omezují – snímky jen se svolením\)\./);
    assert.deepEqual(store(w).pending.find((p: { kind: string }) => p.kind === "takeover").connectors, ["prvni"]);
    assert.equal(store(w).archives["second.example.org"].seen.druhy.by, "person");
    assert.equal(store(w).archives["second.example.org"].floor, "restricted");
    // the rest confirmed at once
    const all = await menu(w, ["3", "1", "1", "0", "0"]);
    assert.match(all.out, /✓ Potvrzeno: Testovací archiv\./);
    assert.equal(store(w).pending.length, 0);
    assert.equal(store(w).archives["archive.example.org"].seen.prvni.by, "person");

    // a connector read restricted and confirmed, which says now the archive allows more: kept, asked once
    const dir = pluginDir(w, "prvni");
    const m = readJsonFile(path.join(dir, "connector.json"));
    fs.writeFileSync(path.join(dir, "connector.json"), JSON.stringify({ ...m, policy: { ...m.policy, automation: "restricted" } }));
    await w.ok(["allow", "archive", "prvni", "--accept"], { tty: true });
    fs.writeFileSync(path.join(dir, "connector.json"), JSON.stringify({ ...m, policy: { ...m.policy, automation: "allowed" } }));
    await w.ok(["fetch", "prvni", "--find", "Týnec"]);
    assert.ok(store(w).pending.some((p: { kind: string }) => p.kind === "milder"));
    const keep = await menu(w, ["3", "1", "2", "0", "0"]);
    assert.match(keep.out, /Testovací archiv \(archive\.example\.org\) nově uvádí, že archiv dovoluje víc: podle podmínek dovoleno \(platí: podmínky automatické stahování omezují – snímky jen se svolením\)/);
    assert.match(keep.out, /✓ Testovací archiv: zůstává, jak bylo\./);
    assert.equal(store(w).pending.length, 0);
    await w.ok(["fetch", "prvni", "--find", "Týnec"]);
    assert.equal(store(w).pending.length, 0, "the same milder reading not asked again");
    assert.equal(store(w).archives["archive.example.org"].seen.prvni.level, "restricted");
    // an agent keeps nothing for the person
    fs.writeFileSync(path.join(dir, "connector.json"), JSON.stringify({ ...m, policy: { ...m.policy, automation: "allowed", termsSummary: "Changed." } }));
    await w.ok(["fetch", "prvni", "--find", "Týnec"]);
    assert.equal((await w.run(["allow", "archive", "prvni", "--keep"], { env: { CLAUDECODE: "1" } })).code, 4);
    assert.ok(store(w).pending.some((p: { kind: string }) => p.kind === "milder"), "a reading changed again is asked again");
    // strom consents names the milder level once, never "allows: allowed"
    const consents = (await w.ok(["consents"])).out;
    assert.match(consents, /prvni uvádí pro archive\.example\.org mírnější úroveň: dovoleno/);
    assert.doesNotMatch(consents, /dovoluje: dovoleno| {2}·/);
  } finally {
    w.cleanup();
  }
});

test("a person reads why the images wait in their language; an agent the English it goes by", opts, async () => {
  const w = await asked();
  try {
    const person = await w.run(["fetch", "zkusebni", "5359", "--images", "1-2", "--recordset", "B1"]);
    assert.equal(person.code, 4);
    assert.match(person.err, /stahování snímků z archivu Testovací archiv \(archive\.example\.org\) čeká na rozhodnutí/);
    assert.match(person.err, /rozhodnout v menu strom \(Co čeká\), nebo v terminálu: strom allow archive archive\.example\.org --way slow\|manual/);
    const agent = await w.run(["fetch", "zkusebni", "5359", "--images", "1-2", "--recordset", "B1"], { env: { CLAUDECODE: "1" }, choice: null });
    assert.match(agent.err, /needs the person's decision for archive\.example\.org[\s\S]*another source now/);
  } finally {
    w.cleanup();
  }
});

/** The number of the permissions' item in Settings → Archives, as the menu shows it. */
async function permissionsKey(w: World): Promise<string> {
  const look = await menu(w, ["8", "4", "0", "0", "0"]);
  const key = /(\w) {2}Svolení ke stahování z archivů/.exec(look.out)?.[1];
  assert.ok(key, look.out);
  return key!;
}

test("Settings → Archives switches the way: the tasks waiting for the archive come back in every research here; ask again puts the archive back as it was before the decision, its old question not brought back", opts, async () => {
  const w = await asked();
  try {
    // a second research on this computer, with a task waiting for an image of the same archive
    await w.ok(["init", "Druzí"], { cwd: w.home });
    const other = { cwd: w.treeDir("Druzí") };
    await w.ok(["recordset", "add", "Týnec Z 1784–1820", "--url", "https://archive.example.org/book/5361"], other); // B0001
    await w.ok(["task", "add", "Úmrtí", "--level", "locate", "--where", "Týnec", "--why", "a", "--done-when", "b"], other); // T0001
    await w.ok(["task", "wait", "T0001", "--images", "B0001:4", "--on", "snímek 4 knihy zemřelých"], other);
    const before = store(w);
    const key = await permissionsKey(w);
    // slowly: 1 · the tasks of both researches back in the queue (the one whose image is in its folder stays)
    const slow = await menu(w, ["8", "4", key, "1", "1", "0", "0", "0", "0"]);
    assert.match(slow.out, /✓ Testovací archiv: snímky pomalu, lidským tempem\./);
    assert.match(slow.out, /Úkoly T0001 se vracejí do fronty\./);
    assert.match(slow.out, /Druzí: Úkoly T0001 se vracejí do fronty\./);
    assert.equal((await task(w, "T0001")).state, "open");
    assert.equal((await task(w, "T0002")).state, "waiting");
    assert.equal(((await w.ok(["task", "show", "T0001", "--json"], other)).json.task as { state: string }).state, "open");
    // switched to by hand, then asked again: as before the first decision — but no old question in What waits (asked
    // again only at the next real need)
    await menu(w, ["8", "4", key, "1", "2", "0", "0", "0", "0"]);
    assert.equal(store(w).archives["archive.example.org"].way, "manual");
    const again = await menu(w, ["8", "4", key, "1", "3", "0", "0", "0", "0"]);
    assert.match(again.out, /✓ Testovací archiv: rozhodnutí zapomenuto/);
    assert.deepEqual(store(w).archives, before.archives);
    assert.deepEqual(before.pending.map((p: { key: string }) => p.key), ["permission:archive.example.org"]);
    assert.deepEqual(store(w).pending.map((p: { key: string }) => p.key), []);
    assert.equal((await w.run(["fetch", "zkusebni", "5359", "--images", "1", "--recordset", "B1"])).code, 4, "asked again at the next need");
    assert.deepEqual(store(w).pending.map((p: { key: string }) => p.key), ["permission:archive.example.org"]);
  } finally {
    w.cleanup();
  }
});

test("an archive that allows strom its images: only stricter in the settings (by hand), and ask again puts it back — a connector taken over too", opts, async () => {
  const w = new World();
  await w.withTree();
  try {
    await fakeConnector(w, "prevzaty", "", { automation: "allowed" }, { confirm: false });
    const config = path.join(w.env.STROM_CONFIG_DIR!, "config.json");
    fs.writeFileSync(config, JSON.stringify({ ...readJsonFile(config), lastVersion: "1.13.0" }));
    fs.rmSync(path.join(w.env.STROM_CONFIG_DIR!, "archives.json"), { force: true });
    await w.ok(["consents"]); // taken over as it was: it runs as before
    await w.ok(["recordset", "add", "Týnec N 1784–1820"]); // B0001
    const fetchOne = () => w.run(["fetch", "prevzaty", "5359", "--images", "1", "--recordset", "B1"]);
    assert.doesNotMatch((await fetchOne()).err, /does not allow|nepovoluje|čeká na rozhodnutí/);
    const before = store(w);
    const key = await permissionsKey(w);
    const look = await menu(w, ["8", "4", key, "1", "0", "0", "0", "0", "0"]);
    assert.match(look.out, /Platí: podle podmínek dovoleno – tady jen přísněji: snímky jen ručně\./);
    assert.match(look.out, /Tempo snímků: [^\n]+ – změnit jde jen příkazem/);
    assert.match(look.out, /jak získávat snímky\?\n {3}1 {2}Jen ručně[^\n]*\n {3}0 {2}Zpět – nic se nemění\nVybrat \[0\]/, "no slow, no browser: it needs no permission");
    // by hand: its images refused, the catalogue goes on
    await menu(w, ["8", "4", key, "1", "1", "0", "0", "0", "0"]);
    assert.equal(store(w).archives["archive.example.org"].way, "manual");
    assert.match((await fetchOne()).err, /the user chose: images by hand|ručně/);
    await w.ok(["fetch", "prevzaty", "--find", "Týnec"]);
    // ask again: as before — the takeover's question and its reading untouched
    const again = await menu(w, ["8", "4", key, "1", "2", "0", "0", "0", "0"]);
    assert.match(again.out, /rozhodnutí zapomenuto/);
    assert.deepEqual(store(w).archives, before.archives);
    assert.deepEqual(store(w).pending, before.pending);
    assert.doesNotMatch((await fetchOne()).err, /does not allow|nepovoluje|ručně/);
  } finally {
    w.cleanup();
  }
});

/** A downloader of the test archive whose connector.json is changed so (its hosts, what it can). */
async function downloader(w: World, policy: Record<string, unknown>, change: Record<string, unknown> = {}): Promise<void> {
  const dir = await fakeConnector(w, "zkusebni", "", policy, { confirm: false });
  const file = path.join(dir, "connector.json");
  fs.writeFileSync(file, JSON.stringify({ ...readJsonFile(file), ...change }, null, 2));
  await w.ok(["allow", "archive", "zkusebni", "--accept"], { tty: true });
}

/** Settings → Archives → the permissions → the first archive, then back out. */
async function firstArchive(w: World, then: string[] = ["0"]): Promise<string> {
  const look = await menu(w, ["8", "4", "0", "0", "0"]);
  const key = /(\d) {2}Svolení ke stahování z archivů/.exec(look.out)?.[1];
  assert.ok(key, look.out);
  return (await menu(w, ["8", "4", key!, "1", ...then, "0", "0", "0", "0"])).out;
}

test("Settings → Archives: raising an archive's level is said only where it would open a way — a downloader that gives no images, the images by hand into the task's folder", opts, async () => {
  const w = new World();
  await w.withTree();
  try {
    // its terms allow images by hand only and its downloader only finds and lists: the images go by hand, nothing to raise
    await downloader(w, { automation: "manual" }, { can: ["find", "list"] });
    const out = await firstArchive(w, [""]);
    assert.match(out, /Testovací archiv: snímky jen ručně \(podmínky automatické stahování nedovolují\)\. Snímky jdou jen ručně: uložit je v prohlížeči do složky úkolu ve schránce \(inbox\)\./);
    assert.doesNotMatch(out, /--level restricted/);
    // in English too
    const look = await w.run([], { tty: true, answers: ["8", "4", "0", "0", "0"], env: { STROM_LANG: "en" } });
    const key = /(\d) {2}Permissions for downloading from archives/.exec(look.out)?.[1];
    assert.ok(key, look.out);
    const en = await w.run([], { tty: true, answers: ["8", "4", key!, "1", "", "0", "0", "0", "0"], env: { STROM_LANG: "en" } });
    assert.match(en.out, /Its images go only by hand: saved in the browser into the task's folder in the inbox\./);
  } finally {
    w.cleanup();
  }
  const v = new World();
  await v.withTree();
  try {
    // a downloader that fetches images, made stricter by a command: lifting it would open a way — said how
    await downloader(v, { automation: "restricted" });
    await v.ok(["allow", "archive", "zkusebni", "--level", "manual"]);
    const out = await firstArchive(v, [""]);
    assert.match(out, /Svolení to nezmění; úroveň zvedne jen příkaz: strom allow archive archive\.example\.org --level restricted/);
    assert.doesNotMatch(out, /Snímky jdou jen ručně/);
  } finally {
    v.cleanup();
  }
});

test("Settings → Archives: an archive of several hosts on one line, its state said once where the hosts agree, decided for all of them; no hourly cap said in words, never ∞", opts, async () => {
  const w = new World();
  await w.withTree();
  try {
    await downloader(w, { automation: "restricted" }, { hosts: ["archive.example.org", "img.example.org"] });
    const look = await menu(w, ["8", "4", "0", "0", "0"]);
    assert.match(look.out, /• Testovací archiv — snímky přímo, strom hlídá tempo; podmínky automatické stahování omezují – snímky jen se svolením\n/u, "said once, no host before it");
    const key = /(\d) {2}Svolení ke stahování z archivů/.exec(look.out)?.[1];
    const one = await menu(w, ["8", "4", key!, "1", "1", "0", "0", "0", "0"]);
    assert.match(one.out, /\n {3}1 {2}Testovací archiv \(archive\.example\.org, img\.example\.org\) – podmínky automatické stahování omezují – snímky jen se svolením\n {3}0 /u, "one line for the archive");
    assert.match(one.out, /Stahování snímků z archivu Testovací archiv \(archive\.example\.org, img\.example\.org\)/u);
    const archives = store(w).archives;
    assert.deepEqual([archives["archive.example.org"]?.way, archives["img.example.org"]?.way], ["slow", "slow"], "decided for both hosts");
  } finally {
    w.cleanup();
  }
  const v = new World();
  await v.withTree();
  try {
    // allowed by its terms, the service's pace with no hourly cap
    await downloader(v, { automation: "allowed" });
    for (const [lang, words] of [["cs", "bez hodinového stropu"], ["de", "ohne Stundenobergrenze"], ["en", "no hourly cap"]]) {
      const r = await v.run([], { tty: true, answers: ["8", "4", "0", "0", "0"], env: { STROM_LANG: lang! } });
      assert.match(r.out, new RegExp(`• Testovací archiv — [^\\n]*${words}`, "u"), `${lang}: ${r.out}`);
      assert.doesNotMatch(r.out, /∞/u);
    }
  } finally {
    v.cleanup();
  }
});

test("one archive of several hosts (its album, its site, an image server) asked by one fetch: one question everywhere, said since the first time with its tasks once, and one decision for all of its hosts", opts, async () => {
  const hosts = ["obec.fotoalba.example.org", "www.fotoalba.example.org", "img42.fotoalba.example.org"];
  const world = async (): Promise<World> => {
    const w = new World();
    await w.withTree();
    await downloader(w, { automation: "restricted", terms: "https://www.fotoalba.example.org/podminky" }, { hosts });
    await w.ok(["recordset", "add", "Fotoalbum obce Vymyšlenov", "--url", "https://obec.fotoalba.example.org/album/7"]); // B0001
    await w.ok(["task", "add", "Fotografie školy", "--level", "locate", "--where", "Vymyšlenov", "--why", "a", "--done-when", "b"]);
    await w.ok(["task", "wait", "T0001", "--images", "B0001:1-2", "--on", "snímky 1–2 alba"]);
    const r = await w.run(["fetch", "zkusebni", "7", "--images", "1-2", "--recordset", "B1", "--json"]);
    assert.equal(r.code, 4, r.out + r.err);
    // each host keeps its own question in the file, as an older strom wrote and reads them
    assert.deepEqual(store(w).pending.filter((p: { kind: string }) => p.kind === "permission").map((p: { host: string }) => p.host).sort(), [...hosts].sort());
    return w;
  };
  const w = await world();
  try {
    // as an older strom left them: asked at different times, a task of another research on one of them
    const file = path.join(w.env.STROM_CONFIG_DIR!, "archives.json");
    const s = readJsonFile(file);
    const first = new Date(Date.now() - 10 * 86_400_000).toISOString();
    s.pending[1].at = first;
    const here = { tree: readJsonFile(path.join(w.cwd, "strom.json")).id, task: "T0001" };
    for (const p of s.pending) p.tasks = [here];
    s.pending[2].tasks.push({ tree: "another-research", task: "T0042" });
    fs.writeFileSync(file, JSON.stringify(s, null, 2));
    const above = (await menu(w, ["0"])).out;
    assert.equal(above.match(/čeká rozhodnutí o stahování z archivu Testovací archiv/giu)?.length, 1, above);
    assert.match(above, /Už od [^\n]+ čeká rozhodnutí o stahování z archivu Testovací archiv[^\n]*úkoly: 2/u, "since the first time, its task here once and the other research's");
    assert.equal((await w.ok(["--json"])).json.permissions.length, 1);
    const json = (await w.ok(["status", "--json"])).json.archiveQuestions;
    assert.equal(json.length, 1);
    assert.deepEqual([json[0].host, json[0].since, json[0].tasks, [...json[0].hosts].sort()], [s.pending[1].host, first, ["T0001"], [...hosts].sort()]);
    assert.equal((await w.ok(["allow", "archive", "--json"])).json.pending.length, 1);

    // decided once in What waits (slowly): every host of the archive, the task back in the queue
    const yes = await menu(w, ["3", "1", "1", "1", "0", "0", "0"]);
    assert.match(yes.out, /Stahování snímků z archivu Testovací archiv \(www\.fotoalba\.example\.org, obec\.fotoalba\.example\.org, img42\.fotoalba\.example\.org\)/u);
    assert.match(yes.out, /✓ Testovací archiv: snímky pomalu, lidským tempem\./u);
    assert.deepEqual(hosts.map((h) => store(w).archives[h]?.way), ["slow", "slow", "slow"]);
    assert.deepEqual(store(w).pending.filter((p: { kind: string }) => p.kind === "permission"), [], "every host's question gone");
    assert.equal((await task(w, "T0001")).state, "open");
    assert.doesNotMatch((await menu(w, ["0"])).out, /čeká rozhodnutí o stahování/iu);
  } finally {
    w.cleanup();
  }
  // the person decides it for one of its hosts by the command (the agent's hint names one): all of them
  const v = await world();
  try {
    await v.ok(["allow", "archive", "img42.fotoalba.example.org", "--way", "manual"], { tty: true });
    assert.deepEqual(hosts.map((h) => store(v).archives[h]?.way), ["manual", "manual", "manual"]);
    assert.deepEqual(store(v).pending.filter((p: { kind: string }) => p.kind === "permission"), []);
  } finally {
    v.cleanup();
  }
});
