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
