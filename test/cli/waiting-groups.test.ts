// What waits for the person, in one ordered list (core/waiting.ts) — the bridge's /status `waiting` (feature
// waiting.groups) and the menu read the same: each item's kind, section, place (group), phase, order and what a link
// may do with it; a task waiting for an archive's permission only in its question's tasks (one waiting for that
// archive's images saved by hand an item of its own too); a conversation about a task
// that waits (strom chat --task) and the links task&do=chat|note|folder|sent.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { update } from "../../src/core/records.ts";
import { Settings } from "../../src/core/config.ts";
import { requestTexts, waitingFor } from "../../src/core/waiting.ts";
import type { Task } from "../../src/core/model.ts";
import { ui } from "../../src/cli/ui.ts";

const opts = { skip: !hasGit };
const PERMISSION_HOST = "digi.example.net";

/**
 * A research with one task of each kind waiting: images of the research's archive (T1), a letter to that archive (T2),
 * a letter sent to an office (T3), the family (T4), a site (T5), a check of a site (T6), and one that waits for an
 * archive's permission whose question waits (T7), and one that waits for images of that archive saved by hand (T8).
 */
async function world(): Promise<{ w: World; id: string; shared: string }> {
  const w = new World();
  await w.withTree("Dvořákovi");
  await w.ok(["research", "new", "Předci Kryštofa", "--new-person", "Kryštof /Žďárský/", "--sex", "M", "--born", "1902"]);
  await w.ok(["repo", "add", "Zkušební archiv", "--url", "https://www.archiv.example.org/"]); // R0001
  await w.ok(["recordset", "add", "Lhota N 1890–1910", "--repo", "R0001", "--url", "https://www.archiv.example.org/book/17"]); // B0001
  await w.ok(["recordset", "add", "Lhota O 1890–1910", "--url", `https://${PERMISSION_HOST}/book/4`]); // B0002
  const add = (what: string, priority: string, where = "matrika Lhota") => w.ok(["task", "add", what, "--level", "request", "--where", where, "--why", "rodiče", "--done-when", "odpověď", "--about", "P1", "--priority", priority, "--anyway"]);
  await add("Snímky křtů Lhota", "3", "B0001"); // T1
  await add("Opis křtu z archivu", "3"); // T2
  await add("Opis oddacího zápisu", "3"); // T3
  await add("Vzpomínky na Kryštofa", "4"); // T4
  await add("Pozemková kniha", "5"); // T5
  await add("Ověřit knihu oddaných", "3"); // T6
  await add("Oddavky Lhota", "3", "B0002"); // T7
  await add("Snímky oddavek Lhota", "2", "B0002"); // T8
  fs.mkdirSync(path.join(w.cwd, "notes"), { recursive: true });
  fs.writeFileSync(path.join(w.cwd, "notes", "žádost-lhota.md"), "Žádost o opis křestního zápisu.\n");
  await w.ok(["task", "wait", "T1", "--images", "B0001:9-12", "--on", "Snímky 9–12 knihy Lhota N k uložení ručně."]);
  await w.ok(["task", "wait", "T2", "--on", "Odpověď archivu na žádost o opis.", "--kind", "letter", "--to", "Zkušební archiv", "--request", "notes/žádost-lhota.md"]);
  // an office named in decomposed form (a macOS shell): the same place
  await w.ok(["task", "wait", "T3", "--on", "Odpověď matričního úřadu Lhota.", "--kind", "letter", "--to", "Matriční úřad Lhota".normalize("NFD")]);
  await w.ok(["task", "sent", "T3"]);
  await w.ok(["task", "wait", "T4", "--on", "Vzpomínky rodiny na Kryštofa.", "--kind", "family"]);
  await w.ok(["task", "wait", "T5", "--on", "Pozemková kniha na webu.", "--kind", "web", "--url", "https://www.familysearch.org/search/catalog/1"]);
  await w.ok(["search", "add", "Kniha oddaných", "--method", "web", "--result", "inconclusive", "--task", "T6", "--note", "closed.example.com refused automated access"]);
  await w.ok(["task", "wait", "T6", "--check", "https://closed.example.com/book/1", "--on", "Je kniha oddaných vidět i se snímky?"]);
  await w.ok(["task", "wait", "T7", "--on", "Rozhodnutí o snímcích archivu."]);
  await w.ok(["task", "wait", "T8", "--images", "B0002:3-4", "--on", "Snímky 3–4 knihy Lhota O k uložení ručně."]);
  // the archive's question waits for the person; T7 waits for it
  const at = new Date(Date.now() - 3_600_000).toISOString();
  fs.writeFileSync(
    path.join(w.env.STROM_CONFIG_DIR!, "archives.json"),
    JSON.stringify({ archives: {}, pending: [{ kind: "permission", key: `permission:${PERMISSION_HOST}`, at, host: PERMISSION_HOST, title: "Digitální archiv Lhota" }] }),
  );
  const tree = Tree.open(w.cwd, w.env);
  tree.withTreeLock(() => {
    update<Task>(tree, "T0007", "task", (t) => ({ ...t, awaitsPermission: { hosts: [PERMISSION_HOST], since: at, title: "Digitální archiv Lhota" } }), { op: "task.edit", summary: "T0007 waits for the archive's decision" });
    tree.commit("T0007 waits for the archive's decision");
  });
  const shared = new Settings(w.env, {}).shared()!.value;
  // two images saved by hand already (and a note beside them, no image)
  const inbox = path.join(shared, "inbox", (await w.ok(["task", "show", "T1", "--json"])).json.task.awaits.folder);
  fs.mkdirSync(inbox, { recursive: true });
  for (const f of ["9.jpg", "10.JPG", "poznámka.txt"]) fs.writeFileSync(path.join(inbox, f), "x");
  return { w, id: tree.config.id, shared };
}

test("what waits, in order: decisions, images and sites, letters and the family, the rest; one place together; sent last; fields and actions of each; a permission's task once", opts, async () => {
  const { w, shared } = await world();
  const items = waitingFor(Tree.open(w.cwd, w.env), { shared }).map((x) => x.item);
  // the permission's question first, the check; the site (priority 5) before the images; the letter to the same
  // archive beside its images; the family; the letter sent last
  assert.deepEqual(
    items.map((i) => i.id),
    [`permission:${PERMISSION_HOST}`, "T0008", "T0006", "T0005", "T0001", "T0002", "T0004", "T0003"],
  );
  assert.deepEqual(items.map((i) => i.order), [0, 1, 2, 3, 4, 5, 6, 7]);
  const by = (id: string) => items.find((i) => i.id === id)!;
  // the task that waits for the permission: only in its question's tasks — nothing counted twice
  assert.ok(!items.some((i) => i.id === "T0007"));
  assert.ok((by(`permission:${PERMISSION_HOST}`).tasks as string[]).includes("T0007"));
  // the one that waits for that archive's images saved by hand: an item of its own (saved by hand, a conversation about
  // it, whatever the question), at the archive's place beside its question — and still one of what the decision touches
  const byHand = by("T0008");
  assert.deepEqual([byHand.kind, byHand.group.key, byHand.actions], ["images", `host:${PERMISSION_HOST}`, ["answer", "folder", "chat"]]);
  assert.ok((by(`permission:${PERMISSION_HOST}`).tasks as string[]).includes("T0008"));
  assert.equal(items.filter((i) => i.id === "T0008").length, 1);
  assert.deepEqual(by(`permission:${PERMISSION_HOST}`).group, { key: `host:${PERMISSION_HOST}`, name: "Digitální archiv Lhota", kind: "web" });
  assert.equal(by(`permission:${PERMISSION_HOST}`).section, "decide");
  assert.deepEqual(by(`permission:${PERMISSION_HOST}`).actions, []);
  // images: the archive's place, the folder with how many images are there and how many the task wants
  const images = by("T0001");
  assert.deepEqual([images.kind, images.section, images.phase, images.priority], ["images", "images", "todo", 3]);
  assert.deepEqual(images.group, { key: "repo:R0001", name: "Zkušební archiv", kind: "archive" });
  assert.equal(images.url, "https://www.archiv.example.org/book/17");
  const inbox = images.inbox as { dir: string; have: number; want: number };
  assert.equal(path.dirname(inbox.dir), path.join(shared, "inbox"));
  assert.deepEqual([inbox.have, inbox.want], [2, 4]);
  assert.deepEqual(images.actions, ["answer", "folder", "chat"]);
  // a letter to the same archive: its place, whom, the request's text (it is there)
  const letter = by("T0002");
  assert.deepEqual([letter.kind, letter.section, letter.group.key, letter.to, letter.note], ["letter", "letter", "repo:R0001", "Zkušební archiv", "notes/žádost-lhota.md"]);
  assert.deepEqual(letter.actions, ["answer", "file", "note", "sent", "chat"]);
  // sent: at the bottom, since when, no sent action
  const sent = by("T0003");
  assert.deepEqual([sent.phase, sent.group.key, sent.group.kind], ["sent", "to:matricni urad lhota", "office"]);
  assert.match(String(sent.sentAt), /^\d{4}-\d\d-\d\dT/);
  assert.equal(sent.to, "Matriční úřad Lhota", "kept in NFC");
  assert.deepEqual(sent.actions, ["answer", "file", "chat"]);
  assert.deepEqual([by("T0004").kind, by("T0004").group.key, by("T0004").group.name], ["family", "family", "Rodina"]);
  assert.deepEqual(by("T0004").actions, ["answer", "file", "sent", "chat"]);
  assert.deepEqual([by("T0005").section, by("T0005").group.key, by("T0005").url], ["web", "host:familysearch.org", "https://www.familysearch.org/search/catalog/1"]);
  assert.deepEqual(by("T0005").actions, ["answer", "chat"]);
  // a check: a decision, its link and answers as before
  assert.deepEqual([by("T0006").kind, by("T0006").section, by("T0006").url, by("T0006").choices], ["check", "decide", "https://closed.example.com/book/1", ["works", "view", "no"]]);
  assert.deepEqual(by("T0006").actions, ["answer", "chat"]);
  // the fields the bridge sent before stay
  assert.deepEqual([letter.what, letter.on, letter.person], ["Opis křtu z archivu", "Odpověď archivu na žádost o opis.", "P0001"]);
  assert.match(String(letter.at), /^\d{4}-/);
  // a second sent letter, sent later: after the first
  await w.ok(["task", "sent", "T2"]);
  const again = waitingFor(Tree.open(w.cwd, w.env), { shared }).map((x) => x.item.id);
  assert.deepEqual(again.slice(-2), ["T0003", "T0002"]);
  w.cleanup();
});

test("the bridge: /status waiting from the same list, feature waiting.groups, every task at most once", opts, async () => {
  const { w } = await world();
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const status = (await fetch(`${info.url}/status`, { headers: { Origin: "https://beta.stromapp.info" } }).then((r) => r.json())) as { features: string[]; waiting: { id: string; kind: string; group: { key: string }; order: number; tasks?: string[] }[] };
    assert.ok(status.features.includes("waiting.groups"));
    assert.deepEqual(
      status.waiting.map((i) => i.id),
      [`permission:${PERMISSION_HOST}`, "T0008", "T0006", "T0005", "T0001", "T0002", "T0004", "T0003"],
    );
    assert.deepEqual(status.waiting.map((i) => i.order), [0, 1, 2, 3, 4, 5, 6, 7]);
    assert.ok(status.waiting[0]!.tasks!.includes("T0007"));
    const ids = status.waiting.filter((i) => /^T\d+$/.test(i.id)).map((i) => i.id);
    assert.equal(new Set(ids).size, ids.length);
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});

test("strom chat --task: the first message in the research language names the task, what it waits for, the place and the other tasks waiting there; a task that does not wait is refused", opts, async () => {
  const { w } = await world();
  const r = (await w.ok(["chat", "--task", "T1", "--where", "terminal", "--agent", "claude", "--print", "--json"])).json;
  const first = (r.args as string[]).find((a) => a.startsWith("Pojďme na úkol"))!;
  assert.match(first, /^Pojďme na úkol T0001: Snímky křtů Lhota\. Čeká na: Snímky 9–12 knihy Lhota N k uložení ručně \(Zkušební archiv\)\. Spusť `strom task show T0001` a `strom guide waiting`/u);
  assert.match(first, /K tomu ještě další úkoly, které čekají na stejném místě: T0002 \(Opis křtu z archivu\) – spusť `strom task show` i pro každý z nich\./u);
  assert.doesNotMatch(first, /T0004|T0005/);
  // alone at its place: no "k tomu ještě"
  const alone = (await w.ok(["chat", "--task", "T0004", "--where", "terminal", "--agent", "claude", "--print", "--json"])).json.args as string[];
  assert.ok(alone.some((a) => a.startsWith("Pojďme na úkol T0004") && !a.includes("K tomu ještě")));
  // the desktop app: the same first message in its link
  const apps = path.join(w.dir, "apps");
  fs.mkdirSync(path.join(apps, "Claude.app"), { recursive: true });
  w.env.STROM_APP_DIRS = apps;
  const app = (await w.ok(["chat", "--task", "T1", "--where", "app", "--agent", "claude", "--print", "--json"])).json;
  assert.match(decodeURIComponent(String(app.link)), /Pojďme na úkol T0001/);
  // a task that waits for nothing; --say and --task together
  await w.ok(["task", "add", "Křest Kryštofa", "--level", "link", "--where", "B0001", "--why", "rodiče", "--done-when", "zápis", "--about", "P1"]); // T9
  const open = await w.run(["chat", "--task", "T9", "--print"]);
  assert.notEqual(open.code, 0);
  assert.match(open.err + open.out, /T0009 does not wait for the user \(it is open\)/);
  assert.notEqual((await w.run(["chat", "--task", "T1", "--say", "Ahoj", "--print"])).code, 0);
  // a task's words that end their sentence themselves: no period after them (T0010)
  await w.ok(["task", "add", "Dům Kryštofa čp. 14, nebo 16?", "--level", "request", "--where", "matrika Lhota", "--why", "rodiče", "--done-when", "odpověď", "--about", "P1", "--anyway"]);
  await w.ok(["task", "wait", "T10", "--kind", "family", "--on", "Co ví rodina o domě?"]);
  const asked = ((await w.ok(["chat", "--task", "T10", "--where", "terminal", "--agent", "claude", "--print", "--json"])).json.args as string[]).find((a) => a.startsWith("Pojďme na úkol"))!;
  assert.match(asked, /^Pojďme na úkol T0010: Dům Kryštofa čp\. 14, nebo 16\? Čeká na: Co ví rodina o domě\? \(Rodina\)\. /u);
  for (const lang of ["cs", "de", "en"])
    for (const what of ["Je to čp. 14?", "Hotovo.", "Konec…", "Bez tečky"]) {
      const said = ui(lang, "ui.chat.task.say", { task: "T0001", what: /[.?!…]$/u.test(what) ? what : `${what}.`, on: "x", group: "y" });
      assert.doesNotMatch(said, /[.?!…]\./u, `${lang}: ${said}`);
    }
  // the method page the first message names
  assert.match((await w.ok(["guide", "waiting"])).out, /# Method: a conversation about what waits for the user/);
  assert.notEqual((await w.run(["guide", "nonsense"])).code, 0);
  w.cleanup();
});

test("links task&do=chat|note|folder|sent: a conversation said and asked first, the request's text and the folder opened (nothing written), sent on the person's yes (Enter: no); the answer no longer offers a conversation", opts, async () => {
  const { w, id } = await world();
  const open = (query: string, answers: string[] = []) => w.run(["link", "open", `strom-research://task?tree=${id}${query}`], { tty: true, answers });
  const head = () => fs.readFileSync(path.join(w.cwd, ".git", "HEAD"), "utf8") + JSON.stringify((Tree.open(w.cwd, w.env).list<Task>("task")).map((t) => [t.id, t.state, t.sent?.at]));
  const before = head();
  // the request's text and the folder: opened, said where, nothing written
  assert.match((await open("&task=T0002&do=note", [""])).out, /Text dotazu: .*žádost-lhota\.md/u);
  assert.match((await open("&task=T0004&do=note", [""])).out, /Úkol T0004 nemá uložený text dotazu\. Nic se nestalo\./);
  assert.match((await open("&task=T0001&do=folder", [""])).out, /Složka: .*inbox/u);
  assert.match((await open("&task=T0002&do=folder", [""])).out, /Úkol T0002 nečeká na ručně uložené snímky\. Nic se nestalo\./);
  // a conversation: said and asked first; a no starts nothing
  const no = await open("&task=T0001&do=chat", ["n", ""]);
  assert.match(no.out, /Aplikace Strom žádá: rozhovor s agentem \(Claude Code\) o úkolu: Snímky křtů Lhota – i s dalšími úkoly, které čekají na stejném místě \(1\)\nVýzkum: Dvořákovi/u);
  assert.equal(head(), before, "nothing written");
  // a yes: the conversation in the agent's desktop app, with the task's first message
  const apps = path.join(w.dir, "apps");
  fs.mkdirSync(path.join(apps, "Claude.app"), { recursive: true });
  w.env.STROM_APP_DIRS = apps;
  const yes = await open("&task=T0001&do=chat", [""]);
  assert.match(yes.out, /Pojďme na úkol T0001/);
  assert.equal(head(), before, "a conversation opened writes nothing");
  // sent: Enter is no; a yes marks it, the task still waits; a kind that sends nothing, one sent already: said
  const enter = await open("&task=T0004&do=sent", ["", ""]);
  assert.match(enter.out, /Aplikace Strom žádá: zapsat, že dotaz úkolu je odeslaný \(Rodina\) – úkol dál čeká na odpověď: Vzpomínky na Kryštofa/u);
  assert.equal((await w.ok(["task", "show", "T4", "--json"])).json.task.sent, undefined);
  const sent = await open("&task=T0004&do=sent", ["a", ""]);
  assert.match(sent.out, /✓ Zapsáno jako odeslané – úkol dál čeká na odpověď\./);
  const t4 = (await w.ok(["task", "show", "T4", "--json"])).json;
  assert.deepEqual([t4.task.state, t4.phase], ["waiting", "sent"]);
  assert.match((await open("&task=T0004&do=sent", [""])).out, /Úkol T0004 už je zapsaný jako odeslaný/);
  assert.match((await open("&task=T0001&do=sent", [""])).out, /Úkol T0001 nečeká na odeslání dotazu/);
  // a task that waits no more, one not in the research
  await w.ok(["task", "wake", "T5"]);
  assert.match((await open("&task=T0005&do=chat", [""])).out, /Tento úkol už nečeká/);
  assert.match((await open("&task=T0099&do=note", [""])).out, /Úkol T0099 v tomto výzkumu není/);
  w.cleanup();
});

test("a task that waited before --request: its request's text is the file of notes/ its words name — in the item, its actions, task show and the group's joined text (each file once); a file not there or outside notes/ none", opts, async () => {
  const w = new World();
  await w.withTree("Dvořákovi");
  await w.ok(["research", "new", "Předci Kryštofa", "--new-person", "Kryštof /Žďárský/", "--sex", "M", "--born", "1902"]);
  const add = (what: string) => w.ok(["task", "add", what, "--level", "request", "--where", "matrika Lhota", "--why", "rodiče", "--done-when", "odpověď", "--about", "P1", "--anyway"]);
  await add("Opis křtu z matriky"); // T1
  await add("Vzpomínky rodiny"); // T2
  await add("Dotaz rodiny (text dotazu notes/dotaz-rodina-Žďárských.md)."); // T3
  await add("Opis oddavek"); // T4
  await add("Opis úmrtí"); // T5
  const notes = path.join(w.cwd, "notes");
  fs.mkdirSync(notes, { recursive: true });
  // the file of the office's request kept in decomposed form (as a macOS shell may name it), named composed
  fs.writeFileSync(path.join(notes, "T0001-dotaz-matrika-Lhůta.md".normalize("NFD")), "Dotaz na opis křtu.\n");
  fs.writeFileSync(path.join(notes, "dotaz-rodina-Žďárských.md"), "Společný dotaz rodině.\n");
  fs.writeFileSync(path.join(w.cwd, "dotaz-mimo.md"), "Mimo notes.\n");
  await w.ok(["task", "wait", "T1", "--on", "odpověď matriky MěÚ Lhůta (…); text dotazu v notes/T0001-dotaz-matrika-Lhůta.md – posílá rodina", "--kind", "letter"]);
  await w.ok(["task", "wait", "T2", "--on", "odpověď rodiny na společný dotaz notes/dotaz-rodina-Žďárských.md, pak dál", "--kind", "family"]);
  // the same file named by another task in its what (the waitingOn names no file)
  await w.ok(["task", "wait", "T3", "--on", "odpověď rodiny", "--kind", "family"]);
  await w.ok(["task", "wait", "T4", "--on", "odpověď matriky; text v notes/chybí-dotaz.md.", "--kind", "letter"]);
  await w.ok(["task", "wait", "T5", "--on", "odpověď matriky; text v notes/../dotaz-mimo.md", "--kind", "letter"]);
  const tree = Tree.open(w.cwd, w.env);
  const items = new Map(waitingFor(tree).map((x) => [x.item.id, x.item]));
  assert.equal(String(items.get("T0001")!.note).normalize("NFC"), "notes/T0001-dotaz-matrika-Lhůta.md");
  assert.ok(items.get("T0001")!.actions.includes("note"));
  assert.equal(items.get("T0002")!.note, "notes/dotaz-rodina-Žďárských.md");
  assert.equal(items.get("T0003")!.note, "notes/dotaz-rodina-Žďárských.md", "a trailing dot and the parenthesis are no part of the path");
  for (const id of ["T0004", "T0005"]) {
    assert.equal(items.get(id)!.note, undefined, `${id}: no file there, or outside notes/`);
    assert.ok(!items.get(id)!.actions.includes("note"));
  }
  // task show says it (text and JSON)
  const shown = await w.ok(["task", "show", "T2", "--json"]);
  assert.equal(shown.json.note, "notes/dotaz-rodina-Žďárských.md");
  assert.match((await w.ok(["task", "show", "T2"])).out, /text {3}notes\/dotaz-rodina-Žďárských\.md/u);
  assert.equal((await w.ok(["task", "show", "T4", "--json"])).json.note, undefined);
  // the joined text of the place (GET /group/<key>/note, the menu's text of all requests): each file once
  const all = ["T0001", "T0002", "T0003", "T0004", "T0005"].map((id) => tree.get<Task>(id)!);
  const joined = requestTexts(tree, all);
  assert.equal(joined.notes.length, 2);
  assert.deepEqual(joined.notes.map((n) => n.normalize("NFC")), ["notes/T0001-dotaz-matrika-Lhůta.md", "notes/dotaz-rodina-Žďárských.md"]);
  assert.equal(joined.text, "Dotaz na opis křtu.\n\n-----\n\nSpolečný dotaz rodině.");
  assert.equal(requestTexts(tree, [tree.get<Task>("T0002")!, tree.get<Task>("T0003")!]).text, "Společný dotaz rodině.");
  w.cleanup();
});
