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
  // the path as given, never normalized
  assert.deepEqual(r.json.task.wait, { kind: "letter", to: "Matrika Lhota", note: "notes/žádost-lhota.md".normalize("NFD") });
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
  assert.deepEqual(shown.group, { key: "repo:R0001", name: "Zkušební archiv", kind: "archive" });
  // --kind with --images: the images say it
  assert.match((await w.run(["task", "wait", images, "--images", "B0001:40", "--kind", "letter", "--on", "Snímek 40"])).err, /--kind: --images says the kind itself/);
  // a site: its archive by the address (www. aside)
  const family = await idOf(w, "Vzpomínky na Kryštofa");
  const web = (await w.ok(["task", "wait", family, "--on", "Zda je kniha vidět na webu archivu", "--kind", "web", "--url", "https://archiv.example.org/kniha/7", "--json"])).json;
  assert.deepEqual(web.group, { key: "repo:R0001", name: "Zkušební archiv", kind: "archive" });
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
