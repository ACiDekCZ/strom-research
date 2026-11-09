// What a waiting task waits for, said by the agent (strom task wait --kind/--to/--request/--url, strom task edit for an
// older one), that its request went out (strom task sent, --undo), and what task show and task list say of it — the
// kind, the place where it is dealt with, the phase. What the person reads (--on, --to) never addresses them.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { history } from "../../src/core/live.ts";
import { requestPath } from "../../src/core/waiting.ts";
import { UsageError } from "../../src/core/errors.ts";

const opts = { skip: !hasGit };

async function tree(): Promise<World> {
  const w = new World();
  await w.withTree("Dvořákovi");
  await w.ok(["research", "new", "Předci Kryštofa", "--new-person", "Kryštof /Žďárský/", "--sex", "M", "--born", "1902"]);
  await w.ok(["repo", "add", "Zkušební archiv", "--url", "https://www.archiv.example.org/"]); // R0001
  await w.ok(["recordset", "add", "Lhota 1", "--repo", "R0001"]); // B0001
  for (const what of ["Opis křtu Kryštofa", "Vzpomínky na Kryštofa", "Snímky křtů"])
    await w.ok(["task", "add", what, "--level", "request", "--where", "matrika Lhota", "--why", "rodiče", "--done-when", "odpověď", "--about", "P1", "--anyway"]);
  fs.mkdirSync(path.join(w.cwd, "notes"), { recursive: true });
  fs.writeFileSync(path.join(w.cwd, "notes", "žádost-lhota.md"), "Žádost o opis křestního zápisu.\n");
  return w;
}

/** The ID of the task added with this what. */
async function idOf(w: World, what: string): Promise<string> {
  const all = (await w.ok(["task", "list", "--state", "all", "--json"])).json.tasks as { id: string; what: string }[];
  return all.find((t) => t.what === what)!.id;
}

test("task wait says the kind, whom, the request's text and the site; task sent marks it sent and --undo takes it back; waiting again or woken, both go", opts, async () => {
  const w = await tree();
  const letter = await idOf(w, "Opis křtu Kryštofa");
  const r = await w.ok(["task", "wait", letter, "--on", "Odpověď matriky Lhota na žádost z 21. 9.", "--kind", "letter", "--to", "Matrika Lhota", "--request", "notes/žádost-lhota.md".normalize("NFD"), "--json"]);
  assert.equal(r.json.waitKind, "letter");
  assert.deepEqual(r.json.group, { key: "to:matrika lhota", name: "Matrika Lhota", kind: "office" });
  assert.equal(r.json.phase, "todo");
  // the path as given where the disk has it so (APFS: both forms one name), else as the disk has it (NTFS, ext4)
  const given = "notes/žádost-lhota.md".normalize("NFD");
  const onDisk = fs.existsSync(path.join(w.cwd, given)) ? given : "notes/žádost-lhota.md".normalize("NFC");
  assert.deepEqual(r.json.task.wait, { kind: "letter", to: "Matrika Lhota", note: onDisk });
  const said = await w.ok(["task", "wait", letter, "--on", "Odpověď matriky Lhota na žádost z 21. 9.", "--kind", "letter", "--to", "Matrika Lhota"]);
  assert.match(said.out, /waits {2}letter · Matrika Lhota \(to:matrika lhota\) · not sent yet/);
  assert.match(said.out, new RegExp(`once the user says the request went out: strom task sent ${letter}`));

  // sent: the task still waits, its words unchanged
  const sent = await w.ok(["task", "sent", letter, "--json"]);
  assert.equal(sent.json.task.state, "waiting");
  assert.equal(sent.json.task.waitingOn, "Odpověď matriky Lhota na žádost z 21. 9.");
  assert.equal(sent.json.phase, "sent");
  assert.equal(sent.json.task.sent.by, "user");
  assert.match(sent.json.sentAt, /^\d{4}-\d\d-\d\dT/);
  const shown = await w.ok(["task", "show", letter]);
  assert.match(shown.out, /waits {2}letter · Matrika Lhota \(to:matrika lhota\) · sent \d{4}-\d\d-\d\d/);
  assert.match(shown.out, /to {5}Matrika Lhota/);
  const showJson = (await w.ok(["task", "show", letter, "--json"])).json;
  assert.equal(showJson.phase, "sent");
  assert.equal(showJson.waitKind, "letter");
  assert.equal(showJson.group.kind, "office");
  assert.deepEqual(showJson.wait, { kind: "letter", to: "Matrika Lhota" });
  // the list: the kind and the phase in its row, the same fields in --json
  assert.match((await w.ok(["task", "list", "--state", "waiting"])).out, new RegExp(`${letter} +p3 +request +\\[waiting letter sent\\] +Opis křtu Kryštofa`));
  const row = ((await w.ok(["task", "list", "--state", "waiting", "--json"])).json.tasks as { id: string; waitKind: string; phase: string; group: { key: string }; sentAt?: string; wait?: unknown }[]).find((t) => t.id === letter)!;
  assert.equal(row.waitKind, "letter");
  assert.equal(row.phase, "sent");
  assert.equal(row.group.key, "to:matrika lhota");
  assert.ok(row.sentAt);
  assert.deepEqual(row.wait, { kind: "letter", to: "Matrika Lhota" });
  // the history, in the research language
  assert.equal(history(w.cwd, Tree.open(w.cwd, w.env))[0]!.text.join("\n"), "Žádost odeslána: Opis křtu Kryštofa");
  // sent twice: said, nothing written; taken back; taken back twice: said
  const twice = await w.ok(["task", "sent", letter]);
  assert.match(twice.out, /was marked sent on \d{4}-\d\d-\d\d already — nothing changed/);
  assert.equal(history(w.cwd, Tree.open(w.cwd, w.env))[0]!.text.join("\n"), "Žádost odeslána: Opis křtu Kryštofa");
  assert.equal((await w.ok(["task", "sent", letter, "--undo", "--json"])).json.phase, "todo");
  assert.equal(history(w.cwd, Tree.open(w.cwd, w.env))[0]!.text.join("\n"), "Žádost přece neodeslána: Opis křtu Kryštofa");
  assert.match((await w.ok(["task", "sent", letter, "--undo"])).out, /was not marked sent — nothing changed/);

  // waiting again: what it waits for now alone — nothing of the earlier kind, whom, or sent
  await w.ok(["task", "sent", letter]);
  const again = (await w.ok(["task", "wait", letter, "--on", "Odpověď na upřesněnou žádost", "--json"])).json;
  assert.equal(again.task.sent, undefined);
  assert.equal(again.task.wait, undefined);
  assert.equal(again.phase, "todo");
  // woken: gone with the wait
  await w.ok(["task", "edit", letter, "--kind", "letter", "--to", "Matrika Lhota"]);
  await w.ok(["task", "sent", letter]);
  const woken = (await w.ok(["task", "wake", letter, "--json"])).json.task;
  assert.equal(woken.state, "open");
  assert.equal(woken.wait, undefined);
  assert.equal(woken.sent, undefined);
  assert.equal((await w.ok(["task", "show", letter, "--json"])).json.phase, undefined, "no wait, no phase");
  // not waiting: nothing to send
  const open = await w.run(["task", "sent", letter]);
  assert.equal(open.code, 2);
  assert.match(open.err, /does not wait \(it is open\)/);
  w.cleanup();
});

test("task sent only where something is sent: images saved by hand, a site, refused with the kind", opts, async () => {
  const w = await tree();
  const images = await idOf(w, "Snímky křtů");
  await w.ok(["task", "wait", images, "--images", "B0001:40-45", "--on", "Snímky 40–45 křtů uložit z https://www.archiv.example.org/b/1"]);
  const no = await w.run(["task", "sent", images]);
  assert.equal(no.code, 2);
  assert.match(no.err, /waits for images the user saves by hand \(kind images\) — nothing is sent there/);
  // its place: the archive of its book
  const shown = (await w.ok(["task", "show", images, "--json"])).json;
  assert.equal(shown.waitKind, "images");
  assert.deepEqual(shown.group, { key: "repo:R0001", name: "Zkušební archiv", kind: "archive", url: "https://www.archiv.example.org/" });
  // --kind with --images: the images say it
  assert.match((await w.run(["task", "wait", images, "--images", "B0001:40", "--kind", "letter", "--on", "Snímek 40"])).err, /--kind: --images says the kind itself/);
  // a site: its archive by the address (www. aside)
  const family = await idOf(w, "Vzpomínky na Kryštofa");
  const web = (await w.ok(["task", "wait", family, "--on", "Zda je kniha vidět na webu archivu", "--kind", "web", "--url", "https://archiv.example.org/kniha/7", "--json"])).json;
  assert.deepEqual(web.group, { key: "repo:R0001", name: "Zkušební archiv", kind: "archive", url: "https://www.archiv.example.org/" });
  assert.match((await w.run(["task", "sent", family])).err, /\(kind web\)/);
  // the family: no --kind needed, its words say it; sent
  const fam = (await w.ok(["task", "wait", family, "--on", "Vzpomínky rodiny na Kryštofa", "--json"])).json;
  assert.equal(fam.waitKind, "family");
  assert.deepEqual(fam.group, { key: "family", name: "Rodina", kind: "family" });
  assert.equal((await w.ok(["task", "sent", family, "--json"])).json.phase, "sent");
  w.cleanup();
});

test("what the person reads never addresses them nor speaks as the agent: --on and --to refused with how to write it; the options checked", opts, async () => {
  const w = await tree();
  const t = await idOf(w, "Opis křtu Kryštofa");
  for (const [flag, text, word] of [
    ["--on", "Prosím o zaslání opisu", "Prosím"],
    ["--on", "Stačí mi poslat odkaz, snímky pak určím", "mi"],
    ["--on", "Přihlaste se na portál".normalize("NFD"), "Přihlaste"],
    ["--on", "Odpověď čeká na vás", "vás"],
    ["--to", "Váš kontakt na matriku", "Váš"],
  ] as const) {
    const args = flag === "--on" ? ["--on", text] : ["--on", "Odpověď matriky", "--to", text];
    const r = await w.run(["task", "wait", t, ...args]);
    assert.equal(r.code, 2, text);
    assert.equal(r.err.normalize("NFC").includes(`${flag} speaks to the user ("${word}")`), true, r.err);
    assert.match(r.err, /reply of the registry office of <place> to the request of <date>/);
  }
  assert.equal((await w.ok(["task", "show", t, "--json"])).json.task.state, "open", "nothing written");
  // a name or a record's word is no address
  await w.ok(["task", "wait", t, "--on", "Odpověď SOA na dotaz o křest dítěte Grete Žďárské"]);
  // the options: the kind, the request's file of notes/ (there, inside notes/), the address
  assert.match((await w.run(["task", "wait", t, "--on", "Odpověď", "--kind", "dopis"])).err, /--kind is one of letter, family, web, other — not "dopis"/);
  for (const bad of ["../žádost.md", "notes/../strom.json", "/tmp/x.md", "data/x.md", "notes"])
    assert.match((await w.run(["task", "wait", t, "--on", "Odpověď", "--request", bad])).err, /--request takes a file of the tree's notes\//, bad);
  assert.match((await w.run(["task", "wait", t, "--on", "Odpověď", "--request", "notes/není.md"])).err, /--request: no file notes\/není\.md in this tree/);
  assert.match((await w.run(["task", "wait", t, "--on", "Odpověď", "--url", "ftp://x.example.org/"])).err, /--url takes an http\(s\) address/);
  w.cleanup();
});

test("task edit gives a waiting task its kind, whom, text and site — an older one too; refused for a task that does not wait", opts, async () => {
  const w = await tree();
  const t = await idOf(w, "Opis křtu Kryštofa");
  const open = await w.run(["task", "edit", t, "--kind", "letter"]);
  assert.equal(open.code, 2);
  assert.match(open.err, /does not wait \(it is open\) — --kind say what a waiting task waits for/);
  assert.match(open.err, new RegExp(`strom task wait ${t} --on`));
  // an older wait: its words say an office, no kind
  await w.ok(["task", "wait", t, "--on", "Odpověď MěÚ Lhota na dotaz"]);
  assert.deepEqual((await w.ok(["task", "show", t, "--json"])).json.group, { key: "to:meu lhota", name: "MěÚ Lhota", kind: "office" });
  const edited = (await w.ok(["task", "edit", t, "--kind", "letter", "--to", "Matrika Lhota", "--request", "notes/žádost-lhota.md", "--json"])).json.task;
  assert.deepEqual(edited.wait, { kind: "letter", to: "Matrika Lhota", note: "notes/žádost-lhota.md" });
  assert.equal(edited.waitingOn, "Odpověď MěÚ Lhota na dotaz");
  // a later edit adds to what was said
  const more = (await w.ok(["task", "edit", t, "--url", "https://archiv.example.org/zadost", "--on", "Odpověď matriky Lhota na žádost z 21. 9.", "--json"])).json.task;
  assert.deepEqual(more.wait, { kind: "letter", to: "Matrika Lhota", note: "notes/žádost-lhota.md", url: "https://archiv.example.org/zadost" });
  assert.equal(more.waitingOn, "Odpověď matriky Lhota na žádost z 21. 9.");
  assert.match((await w.run(["task", "edit", t, "--on", "Pošlete prosím odkaz"])).err, /--on speaks to the user/);
  w.cleanup();
});

// --images and --check say the kind themselves: a --kind repeating it is taken as said, a contrary one refused
test("task wait: --kind repeating what --images or --check says is taken; a contrary --kind is refused", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    await w.ok(["research", "new", "Předci Jana Lhotáka", "--new-person", "Jan /Lhoták/", "--sex", "M", "--born", "ABT 1905", "--born-place", "Lhota"]);
    await w.ok(["recordset", "add", "Lhota N 1903–1920", "--kinds", "baptism", "--places", "Lhota", "--years", "1903-1920", "--url", "https://archive.example.org/book/5359"]); // B1
    for (const what of ["Křest Jana", "Křest Anny", "Křest Petra"])
      await w.ok(["task", "add", what, "--level", "link", "--where", "B1", "--why", "rodiče", "--done-when", "zápis", "--about", "P1"]);

    // --kind images with --images: as if left out (also in another case)
    await w.ok(["task", "wait", "T1", "--images", "B1:1-2", "--on", "snímky 1–2 knihy narozených", "--kind", "Images"]);
    const t1 = (await w.ok(["task", "show", "T1", "--json"])).json.task;
    assert.equal(t1.state, "waiting");
    assert.equal(t1.wait?.kind, undefined, "nothing of --kind stored: --images says it");
    // --kind web with --images: the images are saved from a site — taken as said too, the kind still images
    await w.ok(["task", "wait", "T1", "--kind", "web", "--images", "B1:3", "--on", "snímek 3 knihy narozených"]);
    const web = (await w.ok(["task", "show", "T1", "--json"])).json.task;
    assert.deepEqual([web.state, web.awaits?.images, web.wait?.kind], ["waiting", "3", undefined]);
    // the help says it: --kind is for a wait of neither
    const kind = (await w.ok(["commands", "--json"])).json.commands.find((c: { command: string }) => c.command === "task wait").options.find((o: { name: string }) => o.name === "--kind");
    assert.match(kind.description, /not with --images or --check: they say the kind themselves/);

    // --kind check with --check: as if left out (after another way, as --check asks)
    await w.ok(["search", "add", "kniha narozených Lhota", "--method", "web", "--result", "inconclusive", "--task", "T2", "--note", "archive.example.org refused automated access; tried instead: the parish's index"]);
    await w.ok(["task", "wait", "T2", "--check", "https://archive.example.org/book/5359", "--on", "zda je kniha vidět i se snímky", "--kind", "check"]);
    assert.equal((await w.ok(["task", "show", "T2", "--json"])).json.task.state, "waiting");

    // a contrary --kind is refused, nothing changes
    const bad = await w.run(["task", "wait", "T3", "--images", "B1:3", "--on", "snímek 3 knihy narozených", "--kind", "letter"]);
    assert.equal(bad.code, 2, bad.out + bad.err);
    assert.match(bad.err, /--images says the kind itself/);
    assert.match(bad.err, /leave out --kind/);
    const bad2 = await w.run(["task", "wait", "T3", "--check", "https://archive.example.org/book/5359", "--on", "zda je kniha vidět", "--kind", "images"]);
    assert.equal(bad2.code, 2, bad2.out + bad2.err);
    assert.match(bad2.err, /--check says the kind itself/);
    assert.equal((await w.ok(["task", "show", "T3", "--json"])).json.task.state, "open");
  } finally {
    w.cleanup();
  }
});

// A file system that keeps names as given (NTFS, ext4): an "ž" of a path typed on a Mac (NFD) is another name than the
// file's (NFC) — the file is found by its other form and named as it is on the disk; the path itself never normalized.
test("--request on a disk that keeps names as given: the file found by the other form of its letters, named as on the disk; one not there refused", () => {
  const root = path.join(path.sep, "research");
  const disk = (...names: string[]) => (file: string) => names.some((n) => file === path.join(root, ...n.split("/")));
  const nfc = "notes/žádost-lhota.md".normalize("NFC");
  const nfd = nfc.normalize("NFD");
  assert.equal(requestPath(root, nfd, "T0001", disk(nfc)), nfc, "typed on a Mac, written in NFC");
  assert.equal(requestPath(root, nfc, "T0001", disk(nfd)), nfd, "typed in NFC, kept by the Mac's copy in NFD");
  assert.equal(requestPath(root, nfd, "T0001", disk(nfd)), nfd, "as given where it is so");
  assert.equal(requestPath(root, "notes\\Лхота.md", "T0001", disk("notes/Лхота.md")), "notes/Лхота.md");
  assert.throws(() => requestPath(root, nfd, "T0001", disk("notes/jiná.md")), (e: unknown) => e instanceof UsageError && e.code === "task.request-missing");
  assert.throws(() => requestPath(root, "notes/../data/x.md", "T0001", disk("data/x.md")), /--request takes a file of the tree's notes\//u);
});
