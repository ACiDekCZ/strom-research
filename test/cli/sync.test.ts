// strom sync: a family tree coming back from the Strom app (or another
// program), compared with what the research gave it — the user's edits taken
// in without losing what the research rests on; a wrong file refused; a sync
// undone.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import type { Family, Person } from "../../src/core/model.ts";

const opts = { skip: !hasGit };

async function world(): Promise<{ w: World; ged: string }> {
  const w = new World();
  await w.withTree();
  await w.ok(["lang", "cs"]);
  await w.ok(["source", "add", "Křest Josefa Nováka 1885", "--kind", "baptism", "--transcript", "Josef, syn Jana Nováka."]); // S1
  await w.ok(["person", "add", "Josef /Novák/", "--sex", "M"]); // P1
  await w.ok(["event", "add", "P1", "CHR", "--date", "3 MAR 1885", "--place", "Kamenice", "--cite", "S1"]); // E1, probable
  await w.ok(["person", "add", "Anna /Dvořáková/", "--sex", "F", "--born", "1888"]); // P2, a lead
  await w.ok(["person", "add", "Karel /Novák/", "--sex", "M"]); // P3
  await w.ok(["family", "add", "--partner", "P1", "--partner", "P2"]); // F1
  const ged = path.join(w.dir, "strom.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", ged]);
  return { w, ged };
}

/** What the user does in the app: the file as the app gives it back. */
function edited(ged: string, out: string): string {
  let t = fs.readFileSync(ged, "utf8");
  t = t.replace("2 DATE 3 MAR 1885", "2 DATE 4 MAR 1885"); // a baptism a record proves
  t = t.replace(/(1 REFN P0002\r?\n2 TYPE strom-research\r?\n1 BIRT\r?\n2 DATE )1888/, "$11889"); // a lead
  t = t.replace(/(1 REFN P0002\r?\n2 TYPE strom-research\r?\n)/, "$11 DEAT\n2 DATE 1960\n2 PLAC Týnec\n1 NOTE Babička pekla buchty.\n");
  t = t.replace(/0 @[^@]+@ INDI\r?\n1 NAME Karel \/Novák\/\r?\n(?:[1-9].*\r?\n)*/, ""); // removed
  t = t.replace(/(0 @([^@]+)@ FAM\r?\n)/, "0 @X1@ INDI\n1 NAME Marie /Nováková/\n1 SEX F\n1 BIRT\n2 DATE 1910\n2 PLAC Týnec\n$1");
  t = t.replace(/(0 @[^@]+@ FAM\r?\n(?:[1-9].*\r?\n)*)/, "$11 CHIL @X1@\n");
  fs.writeFileSync(out, t);
  return out;
}

test("the export for the Strom app names the research and its state; persons carry whose IDs they are", opts, async () => {
  const { w, ged } = await world();
  const t = fs.readFileSync(ged, "utf8");
  const head = (await w.ok(["history", "--json"])).json;
  assert.match(t, /^1 _STROM_TREE [0-9a-f-]{36}$/m);
  assert.match(t, /^1 _STROM_HEAD [0-9a-f]{40}$/m);
  assert.match(t, /^1 REFN P0001\r?\n2 TYPE strom-research$/m);
  assert.ok(head);
  w.cleanup();
});

test("sync: shown first; the user's edits against what the research gave — a conflict for a record's fact, a lead corrected, additions as leads, a removal only said", opts, async () => {
  const { w, ged } = await world();
  // the research goes on after the export: a fact the app never saw is not the user removing it
  await w.ok(["event", "add", "P1", "OCCU", "--value", "mlynář"]);
  const file = edited(ged, path.join(w.dir, "z-aplikace.ged"));
  const r = await w.ok(["sync", file]);
  assert.match(r.out, /^z-aplikace\.ged: změn proti výzkumu: 8\nPorovnáno s tím, co výzkum dal aplikaci Strom/);
  assert.match(r.out, /Josef Novák \[P0001\]: křest změněno — 3\. 3\. 1885, Kamenice → 4\. 3\. 1885, Kamenice → rozpor k rozhodnutí/);
  assert.match(r.out, /Anna Dvořáková \[P0002\]: narození změněno — 1888 → 1889 → opraví vodítko výzkumu/);
  assert.match(r.out, /Anna Dvořáková \[P0002\]: nové — úmrtí 1960, Týnec → přidá se jako vodítko/);
  assert.match(r.out, /Anna Dvořáková \[P0002\]: poznámka — „Babička pekla buchty\.“/);
  assert.match(r.out, /nová osoba: Marie \/Nováková\/|nová osoba: Marie Nováková/);
  assert.match(r.out, /Josef Novák \[P0001\] & Anna Dvořáková \[P0002\]: dítě — Marie Nováková/);
  assert.match(r.out, /už v něm není: Karel \/Novák\/ → nic se nemění|už v něm není: Karel Novák/);
  assert.doesNotMatch(r.out, /mlynář/, "what the research added since is not taken for a removal");
  assert.equal((await w.ok(["person", "list", "--json"])).json.total, 3, "only shown");

  const done = await w.ok(["sync", file, "--apply"]);
  assert.match(done.out, /Zapsáno změn z z-aplikace\.ged: 7 \(I0001\) — vrátit: strom sync undo I0001/);
  const p1 = (await w.ok(["person", "show", "P1"])).out;
  assert.match(p1, /CHR\s+3 MAR 1885\s+Kamenice\s+\[probable\]/, "the record's fact stays");
  assert.match((await w.ok(["conflict", "list"])).out, /X0001\s+open\s+Josef Novák: CHR — 3 MAR 1885, Kamenice × 4 MAR 1885, Kamen/);
  const p2 = (await w.ok(["person", "show", "P2"])).out;
  assert.match(p2, /BIRT\s+1889\s+\[lead\]/);
  assert.match(p2, /DEAT\s+1960\s+Týnec\s+\[lead\]/);
  assert.match(p2, /Babička pekla buchty\./);
  assert.match((await w.ok(["family", "show", "F1"])).out, /P0004 Marie Nováková/);
  assert.equal((await w.ok(["person", "list", "--json"])).json.total, 4, "Karel is not deleted");
  assert.match((await w.ok(["check"])).out, /^ok/);

  // the same file again: said, nothing twice even with --again
  assert.match((await w.ok(["sync", file])).out, /Tento soubor výzkum už načetl \(I0001\)/);
  const again = await w.ok(["sync", file, "--again"]);
  assert.doesNotMatch(again.out, /\d\. .*(nová osoba|→ rozpor k rozhodnutí|nové —|poznámka)/);

  // undone: as before, each step with its reason
  const undo = await w.ok(["sync", "undo", "I1"]);
  assert.match(undo.out, /Synchronizace I0001 vrácena/);
  assert.match((await w.ok(["person", "show", "P2"])).out, /BIRT\s+1888\s+\[lead\]/);
  assert.match((await w.ok(["person", "show", "P2"])).out, /DEAT\s+1960\s+Týnec\s+\[retracted\]/);
  assert.equal((await w.ok(["person", "list", "--json"])).json.total, 3, "the new person withdrawn");
  assert.match((await w.ok(["conflict", "list", "--all", "--json"])).out, /"resolved"/);
  assert.match((await w.ok(["check"])).out, /^ok/);
  assert.match((await w.ok(["sync", "undo", "I1"])).out, /už vrácená/);
  w.cleanup();
});

test("sync.edits user: the user's edit wins — the record's fact withdrawn with the reason, the edit a possible fact; undone back", opts, async () => {
  const { w, ged } = await world();
  const file = edited(ged, path.join(w.dir, "z-aplikace.ged"));
  await w.ok(["config", "set", "sync.edits", "user"]);
  const r = await w.ok(["sync", file]);
  assert.match(r.out, /křest změněno — .* → platí vaše úprava/);
  await w.ok(["sync", file, "--apply", "--only", "1"]);
  const p1 = (await w.ok(["person", "show", "P1"])).out;
  assert.match(p1, /CHR\s+3 MAR 1885\s+Kamenice\s+\[retracted\].*the user's edit wins/);
  assert.match(p1, /(CHR|BAPM)\s+4 MAR 1885\s+Kamenice\s+\[possible\]/);
  assert.equal((await w.ok(["person", "list", "--json"])).json.total, 3, "--only 1: nothing else");
  await w.ok(["sync", "undo", "I1"]);
  assert.match((await w.ok(["person", "show", "P1"])).out, /CHR\s+3 MAR 1885\s+Kamenice\s+\[probable\]/);
  assert.match((await w.ok(["check"])).out, /^ok/);
  w.cleanup();
});

test("a wrong file is refused before anything: empty, unreadable, another research, a tree of few of our people; without the state only additions", opts, async () => {
  const { w, ged } = await world();
  const f = (name: string, text: string) => {
    const p = path.join(w.dir, name);
    fs.writeFileSync(p, text);
    return p;
  };
  const t = fs.readFileSync(edited(ged, path.join(w.dir, "e.ged")), "utf8");
  const refused = async (file: string, why: RegExp) => {
    const r = await w.run(["sync", file]);
    assert.equal(r.code, 2, file);
    assert.match(r.err, why);
  };
  await refused(f("empty.ged", ""), /empty\.ged is empty/);
  await refused(f("broken.json", '{"persons": '), /not readable JSON/);
  await refused(f("nic.json", '{"persons": {}, "partnerships": {}}'), /has no people in it/);
  await refused(f("text.txt", "hello"), /neither a GEDCOM file nor a family tree/);
  await refused(f("other.ged", t.replace(/^1 _STROM_TREE .*$/m, "1 _STROM_TREE 11111111-2222-3333-4444-555555555555")), /of another research/);
  await refused(f("cizi.ged", t.replace(/^1 _STROM_(TREE|HEAD) .*\r?\n/gm, "").replace(/1 REFN P0/g, "1 REFN X0")), /does not look like the family tree of/);
  assert.equal((await w.ok(["input", "list", "--json"])).json.total ?? 0, 0, "nothing registered");
  // without the state it came from: additions taken, differences only shown
  const bare = await w.ok(["sync", f("bez.ged", t.replace(/^1 _STROM_HEAD .*\r?\n/m, ""))]);
  assert.match(bare.out, /Soubor neříká, ze které verze výzkumu je/);
  assert.match(bare.out, /křest se liší — výzkum 3\. 3\. 1885, Kamenice, soubor 4\. 3\. 1885, Kamenice → jen když ho vyberete \(--only\)/);
  assert.doesNotMatch(bare.out, /už v něm není/, "no removal without the state it was given");
  await w.ok(["sync", path.join(w.dir, "bez.ged"), "--apply"]);
  assert.match((await w.ok(["person", "show", "P1"])).out, /CHR\s+3 MAR 1885/);
  assert.equal((await w.ok(["conflict", "list", "--json"])).json.total ?? 0, 0);
  w.cleanup();
});

test("the Strom app's JSON: its people by their REFN, its placeholders nobody, occupations from the note", opts, async () => {
  const { w } = await world();
  const tree = (await w.ok(["status", "--json"])).json;
  const id = tree.tree?.id ?? JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id;
  const app = {
    version: 7,
    research: { id },
    persons: {
      a: { id: "a", firstName: "Josef", lastName: "Novák", gender: "male", refn: "P0001", refnType: "strom-research", events: [{ type: "baptism", date: "1885-03-03", place: "Kamenice" }, { type: "occupation", note: "mlynář\nvíc o tom" }] },
      b: { id: "b", firstName: "Anna", lastName: "Dvořáková", gender: "female", refn: "P0002", birthDate: "1888" },
      c: { id: "c", firstName: "Karel", lastName: "Novák", gender: "male", refn: "P0003" },
      d: { id: "d", firstName: "", lastName: "", gender: "male", isPlaceholder: true },
    },
    partnerships: { u: { person1Id: "a", person2Id: "b", childIds: [], status: "married" }, v: { person1Id: "d", person2Id: "b", childIds: ["c"], status: "married" } },
  };
  const file = path.join(w.dir, "strom.json");
  fs.writeFileSync(file, JSON.stringify(app));
  const r = await w.ok(["sync", file]);
  assert.match(r.out, /Josef Novák \[P0001\]: nové — povolání mlynář → přidá se jako vodítko/);
  assert.doesNotMatch(r.out, /nová osoba|křest/, "the placeholder is nobody; the baptism is known");
  w.cleanup();
});

test("the menu: take in the edits from a file — shown, then written on the person's word", { skip: !hasGit || process.platform === "win32" }, async () => {
  const { w, ged } = await world();
  const file = edited(ged, path.join(w.dir, "z-aplikace.ged"));
  // 4 add to the research · 4 edits from the Strom app · 2 from a file · the file · 1 all · Enter · 0 · 0
  const menu = await w.run(["menu"], { tty: true, answers: ["4", "4", "2", file, "1", "", "0", "0"] });
  assert.match(menu.out, /Odkud\?\n   1  Přímo z aplikace Strom \(pošle strom sama\)\n   2  Ze souboru \(\.ged, \.json\)/);
  assert.match(menu.out, /Načíst úpravy z aplikace Strom nebo z jiného rodokmenu \(\.ged, \.json\)/);
  assert.match(menu.out, /z-aplikace\.ged: změn proti výzkumu: 8/);
  assert.match(menu.out, /Zapsáno změn z z-aplikace\.ged: 7/);
  assert.match(menu.out, /Otevřete výzkum znovu v aplikaci Strom/);
  assert.equal((await w.ok(["person", "list", "--json"])).json.total, 4);
  w.cleanup();
});

function post(url: string, body: string, headers: Record<string, string> = {}): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: "POST", headers: { "Content-Type": "text/plain; charset=utf-8", ...headers } }, (res) => {
      let b = "";
      res.on("data", (d) => (b += d));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: b }));
    });
    req.on("error", reject);
    req.end(body);
  });
}

test("straight from the Strom app: it sends the tree to the bridge — only its pages, only a tree of this research, kept to be shown; strom sync --app waits for it", { skip: !hasGit || process.platform === "win32" }, async () => {
  const { w, ged } = await world();
  const file = edited(ged, path.join(w.dir, "z-aplikace.ged"));
  const text = fs.readFileSync(file, "utf8");
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const app = { Origin: "https://beta.stromapp.info" };
    assert.equal((await post(`${info.url}/sync`, text)).status, 403, "not from the app's pages");
    assert.equal((await post(`http://127.0.0.1:${info.port}/${"0".repeat(32)}/sync`, text, app)).status, 404, "without the secret");
    const other = await post(`${info.url}/sync`, text.replace(/^1 _STROM_TREE .*$/m, "1 _STROM_TREE 11111111-2222-3333-4444-555555555555"), app);
    assert.equal(other.status, 400);
    assert.match(JSON.parse(other.body).error, /tento strom patří jinému výzkumu/, "said in the research's language");
    assert.equal(JSON.parse((await post(`${info.url}/sync`, "hello", app)).body).error, "strom přišel prázdný nebo nečitelný");
    const pre = await new Promise<http.IncomingHttpHeaders>((resolve, reject) => {
      const req = http.request(`${info.url}/sync`, { method: "OPTIONS", headers: { ...app, "Access-Control-Request-Method": "POST", "Access-Control-Request-Private-Network": "true" } }, (res) => resolve(res.headers));
      req.on("error", reject);
      req.end();
    });
    assert.match(String(pre["access-control-allow-methods"]), /POST/);
    assert.equal(pre["access-control-allow-private-network"], "true");
    const ok = await post(`${info.url}/sync`, text, app);
    assert.equal(ok.status, 200);
    assert.deepEqual({ ...JSON.parse(ok.body), file: undefined }, { ok: true, changes: 8, file: undefined });
    assert.equal((await w.ok(["person", "list", "--json"])).json.total, 3, "nothing written by sending");
    assert.match((await w.ok(["check"])).out, /^ok/);

    // strom sync --app: the app opened with ?send= (a copy of it that can: its beta, its development), the tree waited for
    await w.ok(["config", "set", "strom.app.url", "https://beta.stromapp.info/run/"]);
    w.env.STROM_SYNC_WAIT_MS = "20000";
    const waiting = w.run(["sync", "--app"]);
    await new Promise((r) => setTimeout(r, 700));
    await post(`${info.url}/sync`, text, app);
    const r = await waiting;
    assert.equal(r.code, 0, r.err);
    assert.match(r.err, /https:\/\/beta\.stromapp\.info\/run\/\?send=http%3A%2F%2F127\.0\.0\.1/, "no browser here: the address to open");
    assert.match(r.out, /^Aplikace Strom strom poslala\.\nstrom-app-.*\.ged: změn proti výzkumu: 8/);
    const got = r.out.match(/strom sync "?([^"\n]*strom-app-[^"\n]*\.ged)"? --apply/)?.[1];
    assert.ok(got, r.out);
    await w.ok(["sync", got!, "--apply"]);
    assert.equal((await w.ok(["person", "list", "--json"])).json.total, 4);
    // the app sends nothing (unchanged, cancelled): said at once, not after the whole wait
    w.env.STROM_SYNC_WAIT_MS = "20000";
    const said = w.run(["sync", "--app"]);
    await new Promise((r) => setTimeout(r, 700));
    assert.equal((await post(`${info.url}/cancel`, JSON.stringify({ reason: "unchanged" }))).status, 403, "only the app's pages");
    assert.equal((await post(`${info.url}/cancel`, JSON.stringify({ reason: "unchanged" }), app)).status, 200);
    const started = Date.now();
    const unchanged = await said;
    assert.ok(Date.now() - started < 5000, "not the whole wait");
    assert.equal(unchanged.code, 0);
    assert.match(unchanged.out, /Aplikace Strom nic neposlala: strom se od posledního načtení z výzkumu nezměnil\./);
    // nobody sends: said what to do instead; the production app cannot send yet
    w.env.STROM_SYNC_WAIT_MS = "600";
    const none = await w.run(["sync", "--app"]);
    assert.equal(none.code, 3);
    assert.match(none.out, /Aplikace Strom strom do 1 min neposlala/);
    // stromapp.info sends since its 3.3.0 (APP_SENDS_CHANGES): the app opened there
    await w.ok(["config", "unset", "strom.app.url"]);
    assert.match((await w.run(["sync", "--app"])).err, /https:\/\/stromapp\.info\/run\/\?send=/);
  } finally {
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});

test("a couple's second marriage the app folds into the first is not the user's edit; both taken away is said", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["lang", "cs"]);
  await w.ok(["person", "add", "Antonín /Dvořák/", "--sex", "M"]);
  await w.ok(["person", "add", "Božena /Nová/", "--sex", "F"]);
  await w.ok(["family", "add", "--partner", "P1", "--partner", "P2"]);
  await w.ok(["event", "add", "F1", "MARR", "--date", "9 MAY 1885"]);
  await w.ok(["event", "add", "F1", "MARR", "--date", "19 MAY 1885", "--place", "Kněževes"]);
  // another couple, its marriage kept by the user
  await w.ok(["person", "add", "Jan /Dvořák/", "--sex", "M"]);
  await w.ok(["person", "add", "Marie /Malá/", "--sex", "F"]);
  await w.ok(["family", "add", "--partner", "P3", "--partner", "P4"]);
  await w.ok(["event", "add", "F2", "MARR", "--date", "1910"]);
  const ged = path.join(w.dir, "strom.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", ged]);
  const t = fs.readFileSync(ged, "utf8");
  assert.equal((t.match(/^1 MARR$/gm) ?? []).length, 3);
  // the app keeps the first marriage of the union only
  const first = t.replace(/(1 MARR\r?\n(?:[2-9].*\r?\n)*)1 MARR\r?\n(?:[2-9].*\r?\n)*/, "$1");
  assert.equal((first.match(/^1 MARR$/gm) ?? []).length, 2);
  fs.writeFileSync(path.join(w.dir, "z-aplikace.ged"), first);
  const r = await w.ok(["sync", path.join(w.dir, "z-aplikace.ged"), "--json"]);
  assert.deepEqual(r.json.changes, [], JSON.stringify(r.json.changes));
  // the user took the first couple's marriage away (the app has none of it): said
  const none = t.replace(/1 MARR\r?\n(?:[2-9].*\r?\n)*1 MARR\r?\n(?:[2-9].*\r?\n)*/, "");
  assert.equal((none.match(/^1 MARR$/gm) ?? []).length, 1);
  fs.writeFileSync(path.join(w.dir, "bez-snatku.ged"), none);
  const gone = await w.ok(["sync", path.join(w.dir, "bez-snatku.ged"), "--json"]);
  assert.deepEqual(gone.json.changes.map((c: { kind: string }) => c.kind), ["fact.gone", "fact.gone"]);
  w.cleanup();
});

test("what the user added to a fact in the app — its cause, age, house — is taken: added to the research's fact, a lead corrected, a record's word a conflict; undone back", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["lang", "cs"]);
  await w.ok(["source", "add", "Úmrtí v Týnci", "--kind", "death"]);
  await w.ok(["person", "add", "Antonín /Dvořák/", "--sex", "M"]);
  await w.ok(["event", "add", "P1", "DEAT", "--date", "1901", "--place", "Týnec", "--cite", "S1"]);
  await w.ok(["person", "add", "Božena /Nová/", "--sex", "F"]);
  await w.ok(["event", "add", "P2", "DEAT", "--date", "1903", "--place", "Týnec", "--age", "54"]);
  await w.ok(["person", "add", "Karel /Malý/", "--sex", "M"]);
  await w.ok(["event", "add", "P3", "DEAT", "--date", "1905", "--place", "Týnec", "--cause", "tuberkulóza", "--cite", "S1"]);
  const ged = path.join(w.dir, "strom.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", ged]);
  const t = fs.readFileSync(ged, "utf8");
  // in the app: a cause where the research has none, another age, another cause than the record's — and the same house again
  const edited = t
    .replace(/(2 DATE 1901\n2 PLAC Týnec\n)/, "$12 CAUS souchotiny\n")
    .replace("2 AGE 54y", "2 AGE 60y")
    .replace("2 CAUS tuberkulóza", "2 CAUS zápal plic");
  assert.equal((edited.match(/souchotiny|60y|zápal plic/g) ?? []).length, 3);
  const file = path.join(w.dir, "z-aplikace.ged");
  fs.writeFileSync(file, edited);
  const r = await w.ok(["sync", file]);
  assert.match(r.out, /Antonín Dvořák \[P0001\]: úmrtí 1901, Týnec — — → příčina souchotiny → doplní se k údaji s odkazem na váš strom/);
  assert.match(r.out, /Božena Nová \[P0002\]: úmrtí 1903, Týnec — 54 let → 60 let → opraví vodítko výzkumu/);
  assert.match(r.out, /Karel Malý \[P0003\]: úmrtí 1905, Týnec — příčina tuberkulóza → příčina zápal plic → rozpor k rozhodnutí/);
  await w.ok(["sync", file, "--apply"]);
  const death = (p: string) => (Tree.open(w.cwd, w.env).get<Person>(p)!.events.find((e) => e.kind === "DEAT"))!;
  assert.equal(death("P0001").cause, "souchotiny");
  assert.equal(death("P0001").status, "probable", "the record's fact stays as it was");
  assert.ok(death("P0001").citations.some((c) => c.source === "S0002"), "the cause cites the user's tree");
  assert.equal(death("P0002").age, "60y");
  assert.equal(death("P0003").cause, "tuberkulóza", "a record's word is not overwritten");
  assert.equal((await w.ok(["conflict", "list", "--json"])).json.conflicts.length, 1);
  // taken in already: nothing new
  assert.match((await w.ok(["sync", file, "--again"])).out, /nic nového/);
  await w.ok(["sync", "undo", "I1"]);
  assert.equal(death("P0001").cause, undefined);
  assert.equal(death("P0002").age, "54y");
  // the app's JSON says the same of a death
  const id = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id;
  const app = {
    version: 9,
    research: { id },
    persons: { a: { id: "a", firstName: "Antonín", lastName: "Dvořák", gender: "male", refn: "P0001", deathDate: "1901", deathPlace: "Týnec", deathCause: "souchotiny", deathAge: "61 let", deathAddress: "čp. 7" } },
    partnerships: {},
  };
  const json = path.join(w.dir, "strom.json");
  fs.writeFileSync(json, JSON.stringify(app));
  assert.match((await w.ok(["sync", json])).out, /Antonín Dvořák \[P0001\]: úmrtí 1901, Týnec — — → čp\. 7, 61 let, příčina souchotiny → doplní se k údaji s odkazem na váš strom/, "an addition: taken also without the state");
  w.cleanup();
});

test("a couple's events from the Strom app 3.8: their residence as RESI for it, the partners' ages and the couple's events taken from its GEDCOM and its JSON (data version 10); undone back", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["lang", "cs"]);
  await w.ok(["source", "add", "Oddací kniha", "--kind", "marriage"]);
  await w.ok(["person", "add", "Antonín /Dvořák/", "--sex", "M"]);
  await w.ok(["person", "add", "Božena /Nová/", "--sex", "F"]);
  await w.ok(["family", "add", "--partner", "P1", "--partner", "P2"]);
  await w.ok(["event", "add", "F1", "MARR", "--date", "9 MAY 1885", "--place", "Týnec", "--cite", "S1"]);
  await w.ok(["event", "add", "F1", "RESI", "--place", "Lhota", "--house", "12"]);
  // the residence of a couple: RESI for an app that keeps a couple's events, else an event named so
  const ged = path.join(w.dir, "strom.ged");
  await w.ok(["config", "set", "strom.app.url", "https://beta.stromapp.info/run/"]);
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", ged]);
  const t = fs.readFileSync(ged, "utf8");
  assert.match(t, /0 @F0001@ FAM[\s\S]*\n1 RESI\n2 PLAC Lhota\n2 ADDR čp\. 12\n/);
  await w.ok(["config", "unset", "strom.app.url"]);
  await w.ok(["config", "set", "strom.version", "3.7.0"]);
  const older = path.join(w.dir, "older.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", older]);
  assert.match(fs.readFileSync(older, "utf8"), /\n1 EVEN\n2 TYPE Bydliště\n2 PLAC Lhota/);
  // either comes back as the same residence
  fs.writeFileSync(path.join(w.dir, "z-aplikace.ged"), t);
  assert.deepEqual((await w.ok(["sync", path.join(w.dir, "z-aplikace.ged"), "--json"])).json.changes, []);
  // in the app: the partners' ages at the wedding added (a record's fact: added to it), banns added
  const edited = t.replace(/(1 MARR\n2 DATE 9 MAY 1885\n2 PLAC Týnec\n)/, "$12 HUSB\n3 AGE 28y\n2 WIFE\n3 AGE 22y\n").replace(/(0 @F0001@ FAM\n)/, "$11 MARB\n2 DATE 19 APR 1885\n2 PLAC Týnec\n");
  const file = path.join(w.dir, "vek.ged");
  fs.writeFileSync(file, edited);
  const r = await w.ok(["sync", file]);
  assert.match(r.out, /Antonín Dvořák \[P0001\] & Božena Nová \[P0002\]: sňatek 9\. 5\. 1885, Týnec — — → Antonín 28 let, Božena 22 let → doplní se k údaji/);
  assert.match(r.out, /nové — ohlášky 19\. 4\. 1885, Týnec → přidá se jako vodítko/);
  await w.ok(["sync", file, "--apply"]);
  const marr = () => Tree.open(w.cwd, w.env).get<Family>("F0001")!.events.find((e) => e.kind === "MARR")!;
  assert.deepEqual(marr().ages, { P0001: "28y", P0002: "22y" });
  await w.ok(["sync", "undo", "I1"]);
  assert.equal(marr().ages, undefined);
  // the app's JSON of data version 10: the couple's events and the partners' ages by its own ids
  const id = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id;
  const app = {
    version: 10,
    research: { id },
    persons: {
      a: { id: "a", firstName: "Antonín", lastName: "Dvořák", gender: "male", refn: "P0001" },
      b: { id: "b", firstName: "Božena", lastName: "Nová", gender: "female", refn: "P0002" },
    },
    partnerships: {
      u: {
        person1Id: "a", person2Id: "b", childIds: [], status: "married", startDate: "1885-05-09", startPlace: "Týnec", ages: { a: "28 let" },
        events: [{ type: "residence", place: "Lhota", address: "čp. 12" }, { type: "banns", date: "1885-04-19", place: "Týnec" }, { type: "custom", customLabel: "Smlouva o výměnku", date: "1890" }],
      },
    },
  };
  const json = path.join(w.dir, "strom.json");
  fs.writeFileSync(json, JSON.stringify(app));
  const j = (await w.ok(["sync", json, "--json"])).json.changes.map((c: { kind: string; fact?: { kind: string; label?: string; ages?: Record<string, string> } }) => [c.kind, c.fact?.kind, c.fact?.label ?? c.fact?.ages?.P0001 ?? ""]);
  assert.deepEqual(j, [["fact.detail", "MARR", "28y"], ["fact.new", "MARB", ""], ["fact.new", "EVEN", "Smlouva o výměnku"]], JSON.stringify(j));
  w.cleanup();
});

test("a couple's other event the Strom app keeps in their note (its families have none) is not taken away", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["lang", "cs"]);
  await w.ok(["person", "add", "Antonín /Dvořák/", "--sex", "M"]);
  await w.ok(["person", "add", "Božena /Nová/", "--sex", "F"]);
  await w.ok(["event", "add", "P1", "EVEN", "--label", "Požár stavení", "--date", "1890"]);
  await w.ok(["family", "add", "--partner", "P1", "--partner", "P2"]);
  await w.ok(["event", "add", "F1", "MARR", "--date", "9 MAY 1885"]);
  await w.ok(["event", "add", "F1", "EVEN", "--label", "Smlouva o výměnku"]);
  const ged = path.join(w.dir, "strom.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", ged]);
  const t = fs.readFileSync(ged, "utf8");
  // the app: the couple's event a line of their note
  const app = t.replace(/1 EVEN\r?\n2 TYPE Smlouva o výměnku\r?\n(?:[2-9].*\r?\n)*/, "1 NOTE Event: Smlouva o výměnku\n");
  assert.notEqual(app, t);
  fs.writeFileSync(path.join(w.dir, "z-aplikace.ged"), app);
  const r = await w.ok(["sync", path.join(w.dir, "z-aplikace.ged"), "--json"]);
  assert.deepEqual(r.json.changes, [], JSON.stringify(r.json.changes));
  w.cleanup();
});

test("the tree kept as the sync's document leaves out the images written into it (the research's own excerpts)", async () => {
  const { withoutImages } = await import("../../src/commands/sync.ts");
  const ged = "0 @S1@ SOUR\n1 OBJE\n2 FORM jpg\n2 FILE data:image/jpeg;base64,AAAA\n3 CONC BBBB\n3 CONC CCCC\n2 _URL https://archiv.example.org/1\n1 NOTE Přepis\n2 CONC dál\n";
  assert.equal(withoutImages(ged), "0 @S1@ SOUR\n1 OBJE\n2 FORM jpg\n2 FILE [image left out, 0 kB]\n2 _URL https://archiv.example.org/1\n1 NOTE Přepis\n2 CONC dál\n");
  assert.equal(withoutImages('{"excerpts":[{"dataUrl":"data:image/png;base64,QUJD","caption":"Křest"}]}'), '{"excerpts":[{"dataUrl":"[image left out, 0 kB]","caption":"Křest"}]}');
  assert.equal(withoutImages("1 FILE https://example.org/a.jpg\n"), "1 FILE https://example.org/a.jpg\n", "a file named by address stays");
});

test("places on the map: a position the user corrected or set in the app is taken (no record proves one), undone back; the Strom app's JSON too; without the state a difference only when picked", opts, async () => {
  const { w } = await world();
  await w.ok(["place", "add", "Kamenice", "--kind", "village", "--lat", "49.1", "--lon", "15.2"]); // L1
  await w.ok(["event", "add", "P3", "BIRT", "--date", "1890", "--place", "Týnec"]);
  const ged = path.join(w.dir, "strom.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", ged]);
  const given = fs.readFileSync(ged, "utf8");
  assert.match(given, /2 PLAC Kamenice\n3 MAP\n4 LATI N49\.1\n4 LONG E15\.2\n/);
  // in the app: Kamenice moved, Týnec found on the map (as the app writes them: six decimals)
  const moved = given.replace("4 LATI N49.1\n4 LONG E15.2", "4 LATI N49.366571\n4 LONG E15.041234").replace("2 PLAC Týnec\n", "2 PLAC Týnec\n3 MAP\n4 LATI N50.042\n4 LONG E15.358\n");
  const file = path.join(w.dir, "mapa.ged");
  fs.writeFileSync(file, moved);
  const r = await w.ok(["sync", file]);
  assert.match(r.out, /1\. Kamenice: poloha na mapě 49\.1, 15\.2 → 49\.366571, 15\.041234 → výzkum převezme vaši polohu \(žádný zápis ji nedokládá\)/);
  assert.match(r.out, /2\. Týnec: poloha na mapě 50\.042, 15\.358 → výzkum převezme vaši polohu/);
  const done = await w.ok(["sync", file, "--apply"]);
  assert.match(done.out, /Zapsáno změn z mapa\.ged: 2 \(I0001\)/);
  const places = (await w.ok(["place", "list", "--json"])).json;
  const at = (name: string) => places.places.find((p: { names: { name: string }[] }) => p.names[0]!.name === name)?.coords;
  assert.deepEqual(at("Kamenice"), { lat: 49.366571, lon: 15.041234 });
  assert.deepEqual(at("Týnec"), { lat: 50.042, lon: 15.358 });
  assert.deepEqual((await w.ok(["sync", file, "--json"])).json.changes, [], "the same file again: nothing");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", ged]);
  assert.match(fs.readFileSync(ged, "utf8"), /2 PLAC Týnec\n3 MAP\n4 LATI N50\.042\n4 LONG E15\.358\n/);
  assert.equal((await w.ok(["check"])).code, 0);
  // taken back: Kamenice where it was, Týnec withdrawn — off the map again
  await w.ok(["sync", "undo", "I1"]);
  const back = (await w.ok(["place", "list", "--json"])).json.places;
  assert.deepEqual(back.find((p: { id: string }) => p.id === "L0001").coords, { lat: 49.1, lon: 15.2 });
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", ged]);
  assert.doesNotMatch(fs.readFileSync(ged, "utf8"), /2 PLAC Týnec\n3 MAP/);
  // the Strom app's JSON: its coordinates by its own key of the place's name
  const id = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id;
  const app = {
    research: { id },
    persons: { a: { id: "a", firstName: "Josef", lastName: "Novák", gender: "male", refn: "P0001", refnType: "strom-research", events: [{ type: "baptism", date: "1885-03-03", place: "Kamenice" }] } },
    partnerships: {},
    places: { kamenice: { lat: 49.2, lon: 15.1, label: "Kamenice, okres Jihlava" } },
  };
  fs.writeFileSync(path.join(w.dir, "strom.json"), JSON.stringify(app));
  const j = (await w.ok(["sync", path.join(w.dir, "strom.json"), "--json"])).json.changes.filter((c: { kind: string }) => c.kind === "place.coords");
  assert.deepEqual(j.map((c: { action: string; place: { name: string; lat: number } }) => [c.action, c.place.name, c.place.lat]), [["pick", "Kamenice", 49.2]], "no state of the research: a difference only when picked");
  w.cleanup();
});
