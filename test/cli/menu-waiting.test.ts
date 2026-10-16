// The menu's What waits with dozens of things (src/cli/menu-waiting.ts): the places of what is to do, a page of 15 at a
// time, a range, all, a section's filter, what waits for a reply apart; a place's things and what is done for all of
// them at once (the request texts joined, sent, a conversation); a thing's own actions by its kind — the answer kept
// with the task, a file, sent and back. The counts are the Strom app's (core/waiting.ts, /status waiting).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { update } from "../../src/core/records.ts";
import { Settings } from "../../src/core/config.ts";
import { waitingFor } from "../../src/core/waiting.ts";
import { waitKeys } from "../../src/cli/menu-waiting.ts";
import type { Task } from "../../src/core/model.ts";

const unix = { skip: !hasGit || process.platform === "win32" };
const PERMISSION_HOST = "digi.example.net";

/** Days ago, as an ISO time. */
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

/**
 * A research where 52 things wait: images of two archives, a search on one archive's site, letters to two offices (two
 * of them with one request text), the family, two sites, other; letters and the family sent (one 40 days ago); an
 * archive's question with the task that waits for it (never listed twice) and one waiting for its images by hand.
 */
async function world(): Promise<{ w: World; shared: string }> {
  const w = new World();
  const bin = path.join(w.dir, "bin");
  fs.mkdirSync(bin);
  const git = spawnSync("which", ["git"], { encoding: "utf8" }).stdout.trim();
  if (git) fs.symlinkSync(git, path.join(bin, "git"));
  fs.writeFileSync(path.join(bin, "claude"), `#!/bin/sh\necho "$@" >> "${path.join(w.dir, "claude.calls")}"\nexit 0\n`, { mode: 0o755 });
  w.env.PATH = bin;
  await w.withTree("Dvořákovi");
  await w.ok(["research", "new", "Předci Kryštofa", "--new-person", "Kryštof /Žďárský/", "--sex", "M", "--born", "1902"]);
  await w.ok(["repo", "add", "DigiArchiv Třeboň", "--url", "https://digi.example.cz/"]); // R0001
  await w.ok(["repo", "add", "Archiv Jih", "--url", "https://jih.example.org/"]); // R0002
  await w.ok(["recordset", "add", "Lhota N 1890–1910", "--repo", "R0001", "--url", "https://digi.example.cz/book/1"]); // B0001
  await w.ok(["recordset", "add", "Lhota O 1890–1910", "--repo", "R0001", "--url", "https://digi.example.cz/book/2"]); // B0002
  await w.ok(["recordset", "add", "Dolní Ves N 1850–1870", "--repo", "R0002", "--url", "https://jih.example.org/book/3"]); // B0003
  await w.ok(["recordset", "add", "Horní Ves Z 1860–1880", "--url", `https://${PERMISSION_HOST}/book/4`]); // B0004
  fs.mkdirSync(path.join(w.cwd, "notes"), { recursive: true });
  fs.writeFileSync(path.join(w.cwd, "notes", "dotaz-brod.md"), "Žádost o opis křestních zápisů rodiny Žďárských.\n");
  fs.writeFileSync(path.join(w.cwd, "notes", "dotaz-brod-2.md"), "Žádost o opis oddacího zápisu.\n");
  let n = 0;
  const add = async (what: string, where = "matrika Lhota", priority = "3") => {
    await w.ok(["task", "add", what, "--level", "request", "--where", where, "--why", "rodiče", "--done-when", "odpověď", "--about", "P1", "--priority", priority, "--anyway"]);
    return `T${++n}`;
  };
  const wait = (id: string, ...args: string[]) => w.ok(["task", "wait", id, ...args]);
  // images of DigiArchiv Třeboň (7) and its site searched (2); images of Archiv Jih (3)
  for (let i = 1; i <= 7; i++) await wait(await add(`Snímky Lhota ${i}`, i <= 4 ? "B0001" : "B0002"), "--images", `${i <= 4 ? "B0001" : "B0002"}:${i * 10}-${i * 10 + 1}`, "--on", `Snímky ${i * 10}–${i * 10 + 1} k uložení ručně.`);
  for (let i = 1; i <= 2; i++) await wait(await add(`Hledání v rejstříku ${i}`), "--kind", "web", "--url", `https://digi.example.cz/search?q=${i}`, "--on", "Rejstřík na webu archivu.");
  for (let i = 1; i <= 3; i++) await wait(await add(`Snímky Dolní Ves ${i}`, "B0003"), "--images", `B0003:${i}`, "--on", `Snímek ${i} k uložení ručně.`);
  // letters to MěÚ Havlíčkův Brod (4: two with one request text, one with another, one without) and to an office in
  // decomposed form (3)
  const brod = [] as string[];
  for (let i = 1; i <= 4; i++) {
    const id = await add(`Opis zápisu Brod ${i}`);
    brod.push(id);
    await wait(id, "--kind", "letter", "--to", "MěÚ Havlíčkův Brod", "--on", "Odpověď matriky na žádost.", ...(i <= 2 ? ["--request", "notes/dotaz-brod.md"] : i === 3 ? ["--request", "notes/dotaz-brod-2.md"] : []));
  }
  for (let i = 1; i <= 3; i++) await wait(await add(`Opis zápisu Žďár ${i}`), "--kind", "letter", "--to", "Matriční úřad Žďár".normalize("NFD"), "--on", "Odpověď matričního úřadu.");
  // the family (8), two sites (4 + 2), other (2)
  for (let i = 1; i <= 8; i++) await wait(await add(`Vzpomínky ${i}`), "--kind", "family", "--on", "Vzpomínky rodiny.");
  for (let i = 1; i <= 4; i++) await wait(await add(`Pozemková kniha ${i}`), "--kind", "web", "--url", `https://www.familysearch.org/search/catalog/${i}`, "--on", "Katalog na webu.");
  for (let i = 1; i <= 2; i++) await wait(await add(`Katastr ${i}`), "--kind", "web", "--url", `https://katastr.example.com/${i}`, "--on", "Mapa na webu.");
  for (let i = 1; i <= 2; i++) await wait(await add(`Ostatní ${i}`), "--kind", "other", "--on", "Něco dalšího.");
  // eight more sites, a place each: more places than a page
  for (let i = 1; i <= 8; i++) await wait(await add(`Hřbitov ${i}`), "--kind", "web", "--url", `https://hrbitov${i}.example.com/`, "--on", "Hrob na webu.");
  // sent: letters to SOA Praha (5, one 40 days ago), the family's other question (2)
  const sent: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const id = await add(`Opis SOA ${i}`);
    await wait(id, "--kind", "letter", "--to", "SOA Praha", "--on", "Odpověď archivu.");
    sent.push(id);
  }
  for (let i = 1; i <= 2; i++) {
    const id = await add(`Fotky ${i}`);
    await wait(id, "--kind", "family", "--on", "Fotky od rodiny.");
    sent.push(id);
  }
  await w.ok(["task", "sent", ...sent]);
  // an archive's question, the task that waits for it, and one for its images by hand
  const asked = await add("Oddavky Horní Ves", "B0004");
  await wait(asked, "--on", "Rozhodnutí o snímcích archivu.");
  const byHand = await add("Snímky Horní Ves", "B0004");
  await wait(byHand, "--images", "B0004:3-4", "--on", "Snímky 3–4 k uložení ručně.");
  const at = daysAgo(1);
  fs.writeFileSync(
    path.join(w.env.STROM_CONFIG_DIR!, "archives.json"),
    JSON.stringify({ archives: {}, pending: [{ kind: "permission", key: `permission:${PERMISSION_HOST}`, at, host: PERMISSION_HOST, title: "Digitální archiv Horní Ves" }] }),
  );
  const tree = Tree.open(w.cwd, w.env);
  const askedId = `T${asked.slice(1).padStart(4, "0")}`;
  const oldId = `T${sent[0]!.slice(1).padStart(4, "0")}`;
  tree.withTreeLock(() => {
    update<Task>(tree, askedId, "task", (t) => ({ ...t, awaitsPermission: { hosts: [PERMISSION_HOST], since: at, title: "Digitální archiv Horní Ves" } }), { op: "task.edit", summary: `${askedId} waits for the archive's decision` });
    update<Task>(tree, oldId, "task", (t) => ({ ...t, sent: { ...t.sent!, at: daysAgo(40) } }), { op: "task.edit", summary: `${oldId} sent long ago` });
    tree.commit("the archive's question; a letter sent long ago");
  });
  const shared = new Settings(w.env, {}).shared()!.value;
  return { w, shared };
}


const id = (n: number) => `T${String(n).padStart(4, "0")}`;
/** The tasks of the world, by what they are (the order they were added in). */
const T = {
  digi: [1, 2, 3, 4, 5, 6, 7].map(id),
  search: [8, 9].map(id),
  jih: [10, 11, 12].map(id),
  brod: [13, 14, 15, 16].map(id),
  zdar: [17, 18, 19].map(id),
  family: [20, 21, 22, 23, 24, 25, 26, 27].map(id),
  familysearch: [28, 29, 30, 31].map(id),
  soa: [44, 45, 46, 47, 48].map(id),
  photos: [49, 50].map(id),
  asked: id(51),
  byHand: id(52),
};

/** Each screen of What waits as printed, from its heading to the question after it. */
function screens(out: string, heading = /^(?:Co čeká|Čeká na odpověď|What waits|Waiting for a reply) · /mu): string[] {
  return out
    .split(/\n(?:Vybrat|Choose)[^\n]*\n/u)
    .map((chunk) => {
      const at = chunk.search(heading);
      return at < 0 ? "" : chunk.slice(at);
    })
    .filter(Boolean);
}

/** A place's line: its number, its name and count, what is there. */
const placeLine = (n: number, name: string, count: number, detail: string) => new RegExp(`^${String(n).padStart(2)} {2}${name} · ${count} +${detail}$`, "mu");

const task = async (w: World, t: string) => (await w.ok(["task", "show", t, "--json"])).json as { task: Task & { answers?: { answer: string; by: string }[] }; phase?: string };

test("What waits with dozens of things: the places of what is to do, counted as the app counts, a page at a time, a range, all, a section's filter, what waits for a reply apart", unix, async () => {
  const { w, shared } = await world();
  const items = waitingFor(Tree.open(w.cwd, w.env), { shared }).map((x) => x.item);
  const todo = items.filter((i) => i.phase === "todo");
  const sent = items.filter((i) => i.phase === "sent");
  assert.deepEqual([todo.length, sent.length], [45, 7]);
  // the task that waits for the archive's question is one of its tasks, never a thing of its own
  assert.ok(!items.some((i) => i.id === T.asked));
  assert.ok((items.find((i) => i.kind === "permission")!.tasks as string[]).includes(T.asked));
  // the bridge says the same numbers
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const status = (await fetch(`${info.url}/status`, { headers: { Origin: "https://beta.stromapp.info" } }).then((r) => r.json())) as { waiting: { id: string; phase: string }[] };
    assert.deepEqual(status.waiting.map((i) => i.id), items.map((i) => i.id));
    assert.deepEqual([status.waiting.filter((i) => i.phase === "todo").length, status.waiting.filter((i) => i.phase === "sent").length], [45, 7]);
  } finally {
    await w.ok(["live", "stop"]);
  }
  // 3 what waits · next page · previous · all · a range · the images · again (off) · the family · 0 (off) · something
  // unknown · ? what waits for a reply · Enter (back to what is to do) · Enter (back to the menu) · 0 quit
  const r = await w.ok([], { tty: true, answers: ["3", "d", "p", "v", "10-12", "s", "s", "o", "0", "x", "?", "", "", "0"] });
  assert.match(r.out, /^ {3}3 {2}Co čeká \(52\)$/mu, "the menu counts what the overview shows");
  const s = screens(r.out);
  // the first page: 15 places of what is to do, in the order of What waits; the sections with their letters
  const first = s[0]!;
  assert.match(first, /^Co čeká · k vyřízení 45 · čeká na odpověď 7\n {2}r rozhodnutí 1 · s snímky 11 · a archivy a úřady 7 · o rodina 8 · w web 16 · j jiné 2\n/u);
  assert.match(first, placeLine(1, "Digitální archiv Horní Ves", 2, "svolení archivu 1 · snímky 1"));
  assert.match(first, placeLine(2, "DigiArchiv Třeboň", 9, "snímky 7 · web 2"));
  assert.match(first, placeLine(3, "Archiv Jih", 3, "snímky 3"));
  assert.match(first, placeLine(6, "hrbitov1\\.example\\.com", 1, "Hřbitov 1"), "a place of one: the thing itself");
  assert.match(first, placeLine(14, "MěÚ Havlíčkův Brod", 4, "dopis k odeslání"));
  assert.match(first, placeLine(15, "Matriční úřad Žďár", 3, "dopis k odeslání"), "an office named in NFD: one place, in NFC");
  assert.doesNotMatch(first, /^16 /mu);
  assert.match(first, /^ Stránka 1\/2 · číslo = skupina · d další · p předchozí · 10-20 · v vše · r\/s\/a\/o\/w\/j filtr · \? čeká na odpověď · 0 zpět$/mu);
  // the next page, the previous, all, a range
  assert.match(s[1]!, placeLine(16, "Rodina", 8, "dotaz k odeslání"));
  assert.match(s[1]!, placeLine(17, "Ostatní", 2, "jiné 2"));
  assert.match(s[1]!, /^ Stránka 2\/2 · /mu);
  assert.doesNotMatch(s[1]!, /^ 1 {2}/mu);
  assert.match(s[2]!, /^ Stránka 1\/2 · /mu);
  assert.match(s[3]!, /^ 1 {2}Digitální archiv/mu);
  assert.match(s[3]!, /^17 {2}Ostatní/mu);
  assert.match(s[3]!, /^ 1–17 z 17 · /mu);
  assert.deepEqual([...s[4]!.matchAll(/^(\d\d) {2}/gmu)].map((m) => m[1]), ["10", "11", "12"]);
  assert.match(s[4]!, /^ 10–12 z 17 · /mu);
  // a section: its places with only its things, said in the heading; the same letter again clears it
  assert.match(s[5]!, /^Co čeká · k vyřízení 45 · čeká na odpověď 7 · filtr: snímky\n/u);
  assert.deepEqual([...s[5]!.matchAll(/^ ?\d+ {2}(.+?) · (\d+) /gmu)].map((m) => `${m[1]} ${m[2]}`), ["Digitální archiv Horní Ves 1", "DigiArchiv Třeboň 7", "Archiv Jih 3"]);
  assert.match(s[5]!, /· 0 zrušit filtr$/mu);
  assert.doesNotMatch(s[6]!, /filtr: /u);
  assert.match(s[7]!, /filtr: rodina/u);
  // 0 clears the filter (the overview stays); something unknown: the control line again, nothing else
  assert.doesNotMatch(s[8]!, /filtr: /u);
  assert.match(r.out, /\nVybrat \n Stránka 1\/2 · číslo = skupina[^\n]*\nVybrat \n/u);
  // what waits for a reply: its places, when sent, how long ago — a request with no reply for over 30 days marked
  const replies = s.find((x) => x.startsWith("Čeká na odpověď"))!;
  assert.match(replies, /^Čeká na odpověď · 7 · k vyřízení 45\n {2}a archivy a úřady 5 · o rodina 2\n/u);
  assert.match(replies, placeLine(1, "SOA Praha", 5, "odesláno \\d+\\. \\d+\\.(?: \\d{4})? · před 40 dny · bez odpovědi přes 30 dní"));
  assert.match(replies, placeLine(2, "Rodina", 2, "odesláno \\d+\\. \\d+\\.(?: \\d{4})? · dnes"));
  assert.match(replies, /^ číslo = skupina · a\/o filtr · \? k vyřízení · 0 zpět$/mu);
  // Enter there: back to what is to do; Enter again: the menu
  const after = r.out.slice(r.out.indexOf(replies));
  assert.match(after, /\nVybrat \n\nCo čeká · k vyřízení 45[^]*?\nVybrat \n\nStrom/u);
  w.cleanup();
});

test("a place of What waits: its things, the request texts of them all for one e-mail (as the bridge gives them), sent for all of them (Enter: no), a conversation about them", unix, async () => {
  const { w } = await world();
  // 3 · 14 MěÚ Havlíčkův Brod · 5 the texts · Enter · 6 sent for all · Enter (no) · 6 again · a · 0 · 0
  const r = await w.ok([], { tty: true, answers: ["3", "14", "5", "", "6", "", "6", "a", "0", "0"] });
  assert.match(
    r.out,
    /\nMěÚ Havlíčkův Brod · k vyřízení 4\n {3}1 {2}Opis zápisu Brod 1 · dopis · priorita 3\n {3}2 {2}Opis zápisu Brod 2 · dopis · priorita 3\n {3}3 {2}Opis zápisu Brod 3 · dopis · priorita 3\n {3}4 {2}Opis zápisu Brod 4 · dopis · priorita 3\n {3}5 {2}Text všech dotazů najednou\n {3}6 {2}Odesláno za celou skupinu\n {3}7 {2}Rozhovor s agentem k celé skupině\n {3}0 {2}Zpět\nVybrat \[0\]/u,
  );
  // the texts: each file once, as GET /group/<key>/note gives them
  assert.match(r.out, /Text dotazu ke zkopírování \(notes\/dotaz-brod\.md, notes\/dotaz-brod-2\.md\):\n\nŽádost o opis křestních zápisů rodiny Žďárských\.\n\n-----\n\nŽádost o opis oddacího zápisu\.\n\n/u);
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const note = (await fetch(`${info.url}/group/${encodeURIComponent("to:meu havlickuv brod")}/note`, { headers: { Origin: "https://beta.stromapp.info" } }).then((x) => x.json())) as { text: string };
    assert.equal(note.text, "Žádost o opis křestních zápisů rodiny Žďárských.\n\n-----\n\nŽádost o opis oddacího zápisu.");
  } finally {
    await w.ok(["live", "stop"]);
  }
  // sent for all: which, asked (Enter: no — nothing written), then marked; the place has nothing to do any more
  assert.match(r.out, /Dotazy k zapsání jako odeslané \(MěÚ Havlíčkův Brod\):\n {2}• T0013 Opis zápisu Brod 1\n {2}• T0014 Opis zápisu Brod 2\n {2}• T0015 Opis zápisu Brod 3\n {2}• T0016 Opis zápisu Brod 4\nZapsat je jako odeslané\? Dál budou čekat na odpověď\. \(a\/n\) \[n\]/u);
  assert.match(r.out, /✓ Zapsáno jako odeslané: T0013, T0014, T0015, T0016 – dál čekají na odpověď\./u);
  for (const t of T.brod) {
    const x = await task(w, t);
    assert.deepEqual([x.task.state, x.phase], ["waiting", "sent"], t);
  }
  assert.equal(r.out.match(/✓ Zapsáno jako odeslané/gu)?.length, 1, "Enter wrote nothing");
  assert.match(screens(r.out).at(-1)!, /^Co čeká · k vyřízení 41 · čeká na odpověď 11\n/u, "back to the overview: the place has nothing to do");
  // a conversation about the place: its first task, the others with it (the fake agent says what it was given)
  // (the office of Brod has nothing to do now: Žďár is the 14th place) 3 · 14 · 5 the conversation · 0 · 0
  await w.ok([], { tty: true, answers: ["3", "14", "5", "0", "0"] });
  const calls = fs.readFileSync(path.join(w.dir, "claude.calls"), "utf8");
  assert.match(calls, /Pojďme na úkol T0017: Opis zápisu Žďár 1\./u);
  assert.match(calls, /K tomu ještě další úkoly, které čekají na stejném místě: T0018 \(Opis zápisu Žďár 2\), T0019 \(Opis zápisu Žďár 3\)/u);
  w.cleanup();
});

test("a thing of What waits: what it is and waits for, then only what makes sense for its kind — the answer kept with the task, a file for it, sent and back among what is to do", unix, async () => {
  const { w, shared } = await world();
  // images: one of two saved already
  const folder = (await task(w, T.digi[0]!)).task.awaits!.folder;
  fs.mkdirSync(path.join(shared, "inbox", folder), { recursive: true });
  fs.writeFileSync(path.join(shared, "inbox", folder, "10.jpg"), "x");
  // 3 · 2 DigiArchiv Třeboň · 1 its first · 1 the archive · 2 the folder · 3 it does not work · why · 0 · 0 · 0
  const images = await w.ok([], { tty: true, answers: ["3", "2", "1", "1", "2", "3", "Kniha se na webu nenačte.", "0", "0", "0"] });
  assert.match(images.out, /\nDigiArchiv Třeboň · k vyřízení 9\n {3}1 {2}Snímky Lhota 1 · snímky · priorita 3\n/u);
  assert.match(images.out, /\n T0001 · snímky · priorita 3\n Snímky Lhota 1\n {4}Čeká na: Snímky 10–11 k uložení ručně\.\n {4}Kde: DigiArchiv Třeboň\n {4}Čeká od [^\n]+\n {4}Uložit ručně: snímky 10–11 z Lhota N 1890–1910 · https:\/\/digi\.example\.cz\/book\/1\n {4}uložit je do [^\n]+\n/u);
  assert.match(images.out, /\n {3}1 {2}Otevřít archiv\n {3}2 {2}Otevřít složku \(uloženo 1\/2\)\n {3}3 {2}Nejde to – napsat proč\n {3}4 {2}Rozhovor s agentem\n {3}0 {2}Zpět\n/u);
  assert.match(images.out, /Odkaz: https:\/\/digi\.example\.cz\/book\/1/u);
  assert.match(images.out, /Složka: [^\n]*inbox/u);
  assert.match(images.out, /Co nejde, krátce \(Enter nebo 0 zpět\)/u);
  assert.match(images.out, /✓ Odpověď se uloží k úkolu, agent ji zpracuje při další práci\./u);
  assert.doesNotMatch(images.out, /Pokračovat s agentem hned\?/u);
  let t = await task(w, T.digi[0]!);
  assert.equal(t.task.state, "open");
  assert.equal(t.task.answers!.at(-1)!.answer, "Kniha se na webu nenačte.");
  // a letter: its request's text, sent (Enter: no, then yes), an answer in words, a file
  const letter = path.join(w.dir, "odpověď matriky.pdf");
  fs.writeFileSync(letter, "%PDF-1.4 a reply");
  // 3 · 14 · 1 · 1 the text · Enter · 2 sent · Enter (no) · 2 · a — back at the place · 1 (the next one) · 3 answer ·
  // the words · 1 · 4 a file · the file · a note · 0 · 0 · 0
  const r = await w.ok([], { tty: true, answers: ["3", "14", "1", "1", "", "2", "", "2", "a", "1", "3", "Matrika odpověděla, opis přijde poštou.", "1", "4", `"${letter}"`, "Opis od matriky", "0", "0", "0"] });
  assert.match(r.out, /\n T0013 · dopis · priorita 3\n Opis zápisu Brod 1\n {4}Čeká na: Odpověď matriky na žádost\.\n {4}Kde: MěÚ Havlíčkův Brod\n {4}Čeká od [^\n]+\n\n {3}1 {2}Text dotazu\n {3}2 {2}Odesláno\n {3}3 {2}Odpovědět textem\n {3}4 {2}Přidat soubor\n {3}5 {2}Rozhovor s agentem\n {3}0 {2}Zpět\n/u);
  assert.match(r.out, /Text dotazu ke zkopírování \(notes\/dotaz-brod\.md\):\n\nŽádost o opis křestních zápisů rodiny Žďárských\.\n/u);
  assert.match(r.out, /Zapsat dotaz jako odeslaný \(MěÚ Havlíčkův Brod\)\? Úkol dál čeká na odpověď\. \(a\/n\) \[n\]/u);
  assert.match(r.out, /✓ Zapsáno jako odeslané – úkol dál čeká na odpověď\./u);
  t = await task(w, T.brod[0]!);
  assert.deepEqual([t.task.state, t.phase], ["waiting", "sent"]);
  t = await task(w, T.brod[1]!);
  assert.equal(t.task.state, "open");
  assert.equal(t.task.answers!.at(-1)!.answer, "Matrika odpověděla, opis přijde poštou.");
  assert.match(r.out, /✓ Soubor je u úkolu/u);
  t = await task(w, T.brod[2]!);
  assert.equal(t.task.state, "open");
  assert.equal((t.task as Task & { files?: unknown[] }).files?.length, 1);
  // a site: open it, answer, a conversation — nothing else
  const web = await w.ok([], { tty: true, answers: ["3", "4", "1", "0", "0", "0", "0"] });
  assert.match(web.out, /\n T0028 · web · priorita 3\n[^]*?\n {3}1 {2}Otevřít web\n {3}2 {2}Odpovědět textem\n {3}3 {2}Rozhovor s agentem\n {3}0 {2}Zpět\n/u);
  // waiting for a reply: an answer, a file, back among what is to do, a conversation
  // ? · 1 SOA Praha · 2 its second · 3 back among what is to do · 0 · Enter · 0 · 0
  const back = await w.ok([], { tty: true, answers: ["3", "?", "1", "2", "3", "0", "", "", "0"] });
  assert.match(back.out, /\n T0045 · dopis · priorita 3\n[^]*?Čeká od [^\n]+ · odesláno [^\n]+ · dnes\n\n {3}1 {2}Odpovědět textem\n {3}2 {2}Přidat soubor\n {3}3 {2}Vrátit mezi k vyřízení\n {3}4 {2}Rozhovor s agentem\n {3}0 {2}Zpět\n/u);
  assert.match(back.out, /✓ Vráceno mezi k vyřízení\./u);
  t = await task(w, T.soa[1]!);
  assert.deepEqual([t.task.state, t.phase], ["waiting", "todo"]);
  // the archive's question at its place, beside the images of that archive; Enter goes back from anywhere
  const asked = await w.ok([], { tty: true, answers: ["3", "1", "", "", "0"] });
  assert.match(asked.out, /\nDigitální archiv Horní Ves · k vyřízení 2\n {3}1 {2}Stahování snímků z archivu Digitální archiv Horní Ves \(digi… · svolení archivu · od [^\n]+\n {3}2 {2}Snímky Horní Ves · snímky · priorita 3\n {3}3 {2}Rozhovor s agentem k celé skupině\n/u);
  assert.doesNotMatch(asked.out, /Oddavky Horní Ves/u, "the task that waits for the question is not listed");
  w.cleanup();
});

test("a place: sent for the whole group only where a request goes out (an office, the family, a letter to do) — never an archive's site of other things; the short lines as written, a person's ID after their name only bracketed", unix, async () => {
  const w = new World();
  const bin = path.join(w.dir, "bin");
  fs.mkdirSync(bin);
  const git = spawnSync("which", ["git"], { encoding: "utf8" }).stdout.trim();
  if (git) fs.symlinkSync(git, path.join(bin, "git"));
  // the research's agent here (none: the research waits for it, kept as an archive — nothing waits for the person)
  fs.writeFileSync(path.join(bin, "claude"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  w.env.PATH = bin;
  await w.withTree("Dvořákovi");
  await w.ok(["person", "add", "Václav /Schaniel/"]); // P0001
  await w.ok(["person", "add", "Dorota /Dvořáková/"]); // P0002
  await w.ok(["repo", "add", "Digitální archiv Lhota", "--url", "https://digi.example.cz/"]); // R0001
  const add = (what: string) => w.ok(["task", "add", what, "--level", "request", "--where", "matrika Lhota", "--why", "rodiče", "--done-when", "odpověď", "--about", "P1", "--anyway"]);
  // the archive's site: two other things there (T1, T2)
  for (let i = 1; i <= 2; i++) {
    await add(`Rejstřík ${i}`);
    await w.ok(["task", "wait", `T${i}`, "--kind", "other", "--url", `https://digi.example.cz/rejstrik/${i}`, "--on", "Přihlášení do badatelny archivu."]);
  }
  // an office: two letters, one naming the couple by their IDs after their names (T3, T4)
  await add("Svatba Václava Schaniela P0001 a Doroty P0002 v Lhotě");
  await add("Křest P0001");
  for (const t of ["T3", "T4"]) await w.ok(["task", "wait", t, "--kind", "letter", "--to", "MěÚ Lhota", "--on", "Odpověď matriky."]);
  // 3 · 2 the archive's site · 0 · 1 the office · 0 · 0 · 0
  const r = await w.ok([], { tty: true, answers: ["3", "2", "0", "1", "0", "0", "0"] });
  const site = r.out.slice(r.out.indexOf("\nDigitální archiv Lhota · k vyřízení 2\n"));
  assert.match(site, /^\nDigitální archiv Lhota · k vyřízení 2\n {3}1 {2}Rejstřík 1 · jiné · priorita 3\n {3}2 {2}Rejstřík 2 · jiné · priorita 3\n {3}3 {2}Rozhovor s agentem k celé skupině\n {3}0 {2}Zpět\n/u, "no sent for the whole group");
  assert.match(r.out, placeLine(1, "MěÚ Lhota", 2, "dopis k odeslání"));
  assert.match(
    r.out,
    /\nMěÚ Lhota · k vyřízení 2\n {3}1 {2}Svatba Václava Schaniela \[P0001\] a Doroty \[P0002\] v Lhotě · dopis · priorita 3\n {3}2 {2}Křest Václav Schaniel \[P0001\] · dopis · priorita 3\n {3}3 {2}Odesláno za celou skupinu\n/u,
  );
  w.cleanup();
});

test("What waits in English, and the keys of every language: none twice, none a number, 0 or ?", unix, async () => {
  for (const lang of ["cs", "de", "en"]) {
    const k = waitKeys(lang);
    const all = [k.next, k.prev, k.all, ...Object.values(k.section)];
    assert.equal(new Set(all).size, all.length, `${lang}: ${all.join(" ")}`);
    for (const key of all) assert.match(key, /^\p{L}$/u, `${lang}: ${key}`);
  }
  const { w } = await world();
  const r = await w.ok([], { tty: true, answers: ["3", "14", "", "", "0"], env: { STROM_LANG: "en" } });
  const s = screens(r.out)[0]!;
  assert.match(s, /^What waits · to do 45 · waiting for a reply 7\n {2}d decisions 1 · i images 11 · o archives and offices 7 · f family 8 · w web 16 · x other 2\n/u);
  assert.match(s, placeLine(14, "MěÚ Havlíčkův Brod", 4, "a letter to send"));
  assert.match(s, /^ Page 1\/2 · number = group · n next · p previous · 10-20 · a all · d\/i\/o\/f\/w\/x filter · \? waiting for a reply · 0 back$/mu);
  assert.match(r.out, /\nMěÚ Havlíčkův Brod · to do 4\n {3}1 {2}Opis zápisu Brod 1 · letter · priority 3\n[^]*? {3}5 {2}The text of all requests at once\n {3}6 {2}Sent for the whole group\n {3}7 {2}A conversation with the agent about the whole group\n/u);
  w.cleanup();
});

test("an archive: only what an archive has — its decisions at their place, nothing of an agent", unix, async () => {
  const w = new World();
  await w.withTree("Dvořákovi");
  for (const name of ["Jan /Novák/", "Marie /Nováková/"]) await w.ok(["person", "add", name]);
  for (const p of ["P0001", "P0002"]) {
    await w.ok(["story", "set", p, "--text", "Mlynář."]);
    await w.ok(["story", "approve", p]);
    await w.ok(["story", "set", p, "--text", "Mlynář v Týnci."]);
  }
  await w.ok(["task", "add", "Opis zápisu", "--level", "request", "--where", "matrika", "--why", "rodiče", "--done-when", "odpověď", "--anyway"]);
  await w.ok(["task", "wait", "T1", "--kind", "letter", "--to", "MěÚ Havlíčkův Brod", "--on", "Odpověď matriky."]);
  await w.ok(["mode", "archive"], { tty: true });
  // 3 · 1 the stories' place · Enter · Enter · 0
  const r = await w.ok([], { tty: true, answers: ["3", "1", "", "", "0"] });
  assert.match(r.out, /\nCo čeká · k vyřízení 2\n {2}r rozhodnutí 2\n 1 {2}Příběhy · 2 {3}vyprávění 2\n číslo = skupina · 0 zpět\n/u);
  assert.match(r.out, /\nPříběhy · k vyřízení 2\n {3}1 {2}Nová verze vyprávění o Jan Novák[^\n]* · vyprávění · od [^\n]+\n {3}2 {2}Nová verze vyprávění o Marie Nováková[^\n]* · vyprávění · od [^\n]+\n {3}0 {2}Zpět\n/u);
  assert.doesNotMatch(r.out, /agent|Rozhovor|Opis zápisu/iu);
  w.cleanup();
});
