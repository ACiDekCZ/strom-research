// Two browsers on one archive (spec 017 S9): a person removed from one and still in the other's older copy is never
// written again as a new person — the copy that did not touch them says so, the copy that edited them asks whether
// they come back (a conflict, decided by the person); a removal taken back (strom sync undo) and sent again is written
// again, a later send of the same window says it was taken back — never "the window never had them" (found on Mac:
// P0005 beside the removed P0004, "applied 0" after send again).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { post } from "./sync.helpers.ts";

const opts = { skip: !hasGit || process.platform === "win32" };
const app = { Origin: "https://beta.stromapp.info" };

/** No agent on this computer: the research waits for it and mirrors what the app sends (an archive's ways). */
function noAgent(w: World): void {
  w.env.PATH = [path.dirname(process.execPath), "/usr/bin", "/bin"].join(path.delimiter);
}

/** Jan and Marie with their daughter Dana (P3); the tree as both browsers were given it. */
async function world(): Promise<{ w: World; given: string }> {
  const w = new World();
  await w.withTree();
  await w.ok(["lang", "cs"]);
  await w.ok(["person", "add", "Jan /Testovský/", "--sex", "M", "--born", "1950"]); // P1
  await w.ok(["person", "add", "Marie /Testovská/", "--sex", "F"]); // P2
  await w.ok(["person", "add", "Dana /Testovská/", "--sex", "F"]); // P3
  await w.ok(["event", "add", "P3", "BIRT", "--date", "1980", "--place", "Horní Ves"]);
  await w.ok(["family", "add", "--partner", "P1", "--partner", "P2", "--child", "P3"]); // F1
  noAgent(w);
  const file = path.join(w.dir, "given.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", file]);
  return { w, given: fs.readFileSync(file, "utf8") };
}

/** A window's copy as it sends it: its own tree of the app, its mark of the state. */
const window = (text: string, tree: string, sent: string) => text.replace(/^(1 _STROM_HEAD .*\r?\n)/m, `$11 _STROM_APP_TREE ${tree}\n1 _STROM_SENT ${sent}\n`);

/** The copy without Dana (removed in the app). */
function withoutDana(t: string): string {
  const xref = /0 @([^@]+)@ INDI\r?\n1 NAME Dana \/Testovská\/\r?\n/.exec(t)![1]!;
  return t.replace(/0 @[^@]+@ INDI\r?\n1 NAME Dana \/Testovská\/\r?\n(?:[1-9].*\r?\n)*/, "").replace(new RegExp(`1 CHIL @${xref}@\\r?\\n`), "");
}

const people = async (w: World) => ((await w.ok(["person", "list", "--json"])).json.persons as { id: string; name: string }[]).map((p) => p.id).sort();

for (const same of [false, true]) {
  const which = same ? "the same tree of the app in both" : "each its own tree of the app";
  test(`two browsers (${which}): Dana removed in A, B's older copy edits her — no new person; a conflict whether she comes back, decided by the person`, opts, async () => {
    const { w, given } = await world();
    const info = (await w.ok(["live", "start", "--json"])).json;
    try {
      const a = await post(`${info.url}/sync`, window(withoutDana(given), "treeA", "a1"), app);
      assert.equal(a.status, 200, a.body);
      assert.deepEqual(await people(w), ["P0001", "P0002"], "Dana removed by A");
      const removedBy = JSON.parse(a.body).input as string;
      // B never loaded the research since: its copy still has Dana, born now in Dolní Ves
      const b = await post(`${info.url}/sync`, window(given.replace("2 PLAC Horní Ves", "2 PLAC Dolní Ves"), same ? "treeA" : "treeB", "b1"), app);
      assert.equal(b.status, 200, b.body);
      const answer = JSON.parse(b.body);
      assert.deepEqual(await people(w), ["P0001", "P0002"], "no new Dana beside the removed one");
      const all = (await w.ok(["person", "list", "--all", "--json"]).catch(() => undefined))?.json?.persons as { id: string }[] | undefined;
      if (all) assert.ok(!all.some((p) => p.id === "P0004"), JSON.stringify(all));
      assert.equal(answer.conflicts.length, 1, b.body);
      const x = answer.conflicts[0];
      assert.equal(x.person, "P0003", b.body);
      const shown = (await w.ok(["conflict", "show", x.id, "--json"])).json;
      assert.match(JSON.stringify(shown), new RegExp(removedBy), "the conflict names the send that removed her");
      // the edit is kept with her (nothing lost): taken by the person, she is back as B has her
      await w.ok(["conflict", "resolve", x.id, "--take", "user", "--reasoning", "Dana patří do stromu"]);
      assert.deepEqual(await people(w), ["P0001", "P0002", "P0003"]);
      const dana = (await w.ok(["person", "show", "P3", "--json"])).json.person;
      const births = (dana.events as { kind: string; place?: string; retracted?: unknown }[]).filter((e) => e.kind === "BIRT" && !e.retracted);
      assert.deepEqual(births.map((e) => e.place), ["Dolní Ves"], JSON.stringify(dana.events));
      const fam = (await w.ok(["family", "show", "F1", "--json"])).json;
      assert.match(JSON.stringify(fam), /P0003/, "still the family's child");
    } finally {
      await w.ok(["live", "stop"]);
      w.cleanup();
    }
  });
}

test("two browsers: B's older copy that did not touch Dana (another edit) — Dana stays removed, said why (removed, by which sync), the edit written", opts, async () => {
  const { w, given } = await world();
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const a = await post(`${info.url}/sync`, window(withoutDana(given), "treeA", "a1"), app);
    const removedBy = JSON.parse(a.body).input as string;
    const b = await post(`${info.url}/sync`, window(given.replace(/(1 NAME Jan \/Testovský\/\r?\n(?:[1-9].*\r?\n)*?1 BIRT\r?\n2 DATE )1950/, "$11951"), "treeB", "b1"), app);
    assert.equal(b.status, 200, b.body);
    const answer = JSON.parse(b.body);
    assert.deepEqual(await people(w), ["P0001", "P0002"]);
    assert.deepEqual(answer.conflicts, []);
    const said = (answer.notWritten ?? []).find((n: { person?: string }) => n.person === "P0003");
    assert.ok(said, b.body);
    assert.equal(said.why, "removed");
    assert.equal(said.removedBy, removedBy);
    const jan = (await w.ok(["person", "show", "P1", "--json"])).json.person;
    assert.ok((jan.events as { kind: string; date?: string; retracted?: unknown }[]).some((e) => e.kind === "BIRT" && e.date === "1951" && !e.retracted), "B's own edit written");
    // A loads nothing new: no person to come
    assert.equal((await w.ok(["conflict", "list", "--json"])).json.conflicts?.filter((c: { state: string }) => c.state === "open").length ?? 0, 0);
  } finally {
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});

test("a removal taken back (strom sync undo) and sent again from the app: written again; a later send of that window says it was taken back, never kept as never had", opts, async () => {
  const { w, given } = await world();
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const a = await post(`${info.url}/sync`, window(withoutDana(given), "treeA", "a1"), app);
    const first = JSON.parse(a.body);
    assert.deepEqual(await people(w), ["P0001", "P0002"]);
    await new Promise((r) => setTimeout(r, 1100));
    await w.ok(["sync", "undo", first.input]);
    assert.deepEqual(await people(w), ["P0001", "P0002", "P0003"], "the undo puts Dana back");
    // the window's next edit (its copy still without Dana): the undo stands, said as taken back
    const head = /"head":"([0-9a-f]+)"/.exec(a.body)?.[1] ?? first.head;
    const later = withoutDana(given).replace(/^1 _STROM_HEAD .*$/m, `1 _STROM_HEAD ${head}`).replace(/(1 NAME Jan \/Testovský\/\r?\n(?:[1-9].*\r?\n)*?1 BIRT\r?\n2 DATE )1950/, "$11952");
    const next = await post(`${info.url}/sync`, window(later, "treeA", "a2"), app);
    assert.equal(next.status, 200, next.body);
    assert.deepEqual(await people(w), ["P0001", "P0002", "P0003"], "the undo stands");
    // nothing of Dana kept as never had: the window is told its send was taken back since
    for (const n of JSON.parse(next.body).notWritten ?? []) if (n.person === "P0003") assert.equal(n.why, "takenBack", next.body);
    assert.deepEqual(JSON.parse(next.body).undoneSince, [first.intake], next.body);
    // the first send, sent again by the person: the removal written again
    const again = await post(`${info.url}/sync/${first.intake}/again`, "", app);
    assert.equal(again.status, 200, again.body);
    const j = JSON.parse(again.body);
    assert.ok(j.applied >= 1, again.body);
    assert.ok(!(j.notWritten ?? []).some((n: { person?: string; why: string }) => n.person === "P0003"), again.body);
    assert.deepEqual(await people(w), ["P0001", "P0002"], "removed again");
  } finally {
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});

test("two browsers change the same fact: the second is a conflict the person decides without an agent (c-D2)", opts, async () => {
  const { w, given } = await world();
  const info = (await w.ok(["live", "start", "--json"])).json;
  const janBorn = (t: string, year: string) => t.replace(/(1 NAME Jan \/Testovský\/\r?\n(?:[1-9].*\r?\n)*?1 BIRT\r?\n2 DATE )1950/, `$1${year}`);
  try {
    const a = await post(`${info.url}/sync`, window(janBorn(given, "1951"), "treeA", "a1"), app);
    assert.equal(a.status, 200, a.body);
    const b = await post(`${info.url}/sync`, window(janBorn(given, "1955"), "treeB", "b1"), app);
    assert.equal(b.status, 200, b.body);
    const births = async () => ((await w.ok(["person", "show", "P1", "--json"])).json.person.events as { kind: string; date?: string; retracted?: unknown }[]).filter((e) => e.kind === "BIRT" && !e.retracted).map((e) => e.date);
    // B's copy was given 1950, A wrote 1951 since: whose word it is the person decides — in the app (take, both sides) or here
    const x = JSON.parse(b.body).conflicts;
    assert.equal(x.length, 1, b.body);
    assert.deepEqual([x[0].person, x[0].fact, x[0].take, x[0].sides], ["P0001", "BIRT", true, { user: "1955", research: "1951" }], b.body);
    assert.deepEqual(await births(), ["1951"], "A's word stands until decided");
    await w.ok(["conflict", "resolve", x[0].id, "--take", "user", "--reasoning", "druhý prohlížeč má pravdu"]);
    assert.deepEqual(await births(), ["1955"]);
  } finally {
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});

const danaBorn = (t: string, place: string) => t.replace("2 PLAC Horní Ves", `2 PLAC ${place}`);
const openConflicts = async (w: World) => ((await w.ok(["conflict", "list", "--json"])).json.conflicts as { id: string; state: string }[]).filter((c) => c.state === "open");
const danaBirths = async (w: World) => ((await w.ok(["person", "show", "P3", "--json"])).json.person.events as { kind: string; place?: string; retracted?: unknown }[]).filter((e) => e.kind === "BIRT" && !e.retracted).map((e) => e.place);

test("a second edited copy of a removed person: a conflict with the first copy's edit (never written over it), the window told she is removed and asked about (U7 finding 1)", opts, async () => {
  const { w, given } = await world();
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    await post(`${info.url}/sync`, window(withoutDana(given), "treeA", "a1"), app);
    const c = JSON.parse((await post(`${info.url}/sync`, window(danaBorn(given, "Dolní Ves"), "treeC", "c1"), app)).body);
    assert.equal(c.conflicts.length, 1, JSON.stringify(c));
    const person = c.conflicts[0];
    assert.equal(person.fact, "PERSON");
    const d = JSON.parse((await post(`${info.url}/sync`, window(danaBorn(given, "Testovská Lhota"), "treeD", "d1"), app)).body);
    // D learns she is removed (the open question whether she comes back) and that C's place stands against its own
    const birth = d.conflicts.find((x: { fact?: string }) => x.fact === "BIRT");
    assert.ok(birth, JSON.stringify(d));
    assert.equal(birth.person, "P0003", JSON.stringify(d));
    assert.match(birth.sides.user, /Testovská Lhota/, JSON.stringify(d));
    assert.match(birth.sides.research, /Dolní Ves/, JSON.stringify(d));
    assert.ok(d.conflicts.some((x: { id: string }) => x.id === person.id), JSON.stringify(d));
    assert.deepEqual(await people(w), ["P0001", "P0002"], "still removed");
    assert.deepEqual(await danaBirths(w), ["Dolní Ves"], "C's edit not written over");
    // back in the tree as C had her; D's place the person's to decide
    await w.ok(["conflict", "resolve", person.id, "--take", "user", "--reasoning", "Dana patří do stromu"]);
    assert.deepEqual(await people(w), ["P0001", "P0002", "P0003"]);
    assert.deepEqual(await danaBirths(w), ["Dolní Ves"]);
    await w.ok(["conflict", "resolve", birth.id, "--take", "user", "--reasoning", "Testovská Lhota podle D"]);
    assert.deepEqual(await danaBirths(w), ["Testovská Lhota"]);
    assert.equal((await openConflicts(w)).length, 0);
    assert.equal((await w.run(["check"])).code, 0);
  } finally {
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});

test("decided to keep her removed: the same old copy sent again asks nothing new and writes nothing again — said removed (U7 finding 2)", opts, async () => {
  const { w, given } = await world();
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const a = JSON.parse((await post(`${info.url}/sync`, window(withoutDana(given), "treeA", "a1"), app)).body);
    const b = JSON.parse((await post(`${info.url}/sync`, window(danaBorn(given, "Dolní Ves"), "treeB", "b1"), app)).body);
    await w.ok(["conflict", "resolve", b.conflicts[0].id, "--take", "research", "--reasoning", "Dana do stromu nepatří"]);
    const again = await post(`${info.url}/sync`, window(danaBorn(given, "Dolní Ves"), "treeB", "b2"), app);
    assert.equal(again.status, 200, again.body);
    const j = JSON.parse(again.body);
    assert.deepEqual(j.conflicts, [], again.body);
    assert.equal(j.applied, 0, again.body);
    const said = (j.notWritten ?? []).find((n: { person?: string }) => n.person === "P0003");
    assert.ok(said, again.body);
    assert.equal(said.why, "removed");
    assert.equal(said.removedBy, a.input);
    assert.equal((await openConflicts(w)).length, 0);
    assert.deepEqual(await people(w), ["P0001", "P0002"]);
    // another edit of the window elsewhere is written, Dana still said
    const more = JSON.parse((await post(`${info.url}/sync`, window(danaBorn(given, "Dolní Ves").replace(/(1 NAME Jan \/Testovský\/\r?\n(?:[1-9].*\r?\n)*?1 BIRT\r?\n2 DATE )1950/, "$11951"), "treeB", "b3"), app)).body);
    assert.deepEqual(more.conflicts, [], JSON.stringify(more));
    assert.ok((more.notWritten ?? []).some((n: { person?: string; why: string }) => n.person === "P0003" && n.why === "removed"), JSON.stringify(more));
    assert.equal((await openConflicts(w)).length, 0);
  } finally {
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});

for (const take of ["user", "research"] as const) {
  test(`reversed: an older copy removes a person another window edited since — a conflict, never removed in silence; --take ${take} (U7 finding 3)`, opts, async () => {
    const { w, given } = await world();
    const info = (await w.ok(["live", "start", "--json"])).json;
    try {
      await post(`${info.url}/sync`, window(danaBorn(given, "Dolní Ves"), "treeB", "b1"), app);
      const a = JSON.parse((await post(`${info.url}/sync`, window(withoutDana(given), "treeA", "a1"), app)).body);
      assert.deepEqual(await people(w), ["P0001", "P0002", "P0003"], "not removed in silence");
      assert.equal(a.conflicts.length, 1, JSON.stringify(a));
      const x = a.conflicts[0];
      assert.deepEqual([x.person, x.fact, x.take], ["P0003", "PERSON", true], JSON.stringify(a));
      assert.match(x.sides.user, /odebrání/, JSON.stringify(a));
      assert.match(x.sides.research, /úprav/, JSON.stringify(a));
      await w.ok(["conflict", "resolve", x.id, "--take", take, "--reasoning", take === "user" ? "Dana nepatří" : "Dana zůstane"]);
      if (take === "user") {
        assert.deepEqual(await people(w), ["P0001", "P0002"], "removed on the person's word");
        // B's copy again (it still has her): no new Dana, said removed
        const b2 = JSON.parse((await post(`${info.url}/sync`, window(danaBorn(given, "Dolní Ves"), "treeB", "b2"), app)).body);
        assert.deepEqual(await people(w), ["P0001", "P0002"], JSON.stringify(b2));
        assert.ok((b2.notWritten ?? []).some((n: { person?: string; why: string; removedBy?: string }) => n.person === "P0003" && n.why === "removed" && n.removedBy === a.input), JSON.stringify(b2));
      } else {
        assert.deepEqual(await people(w), ["P0001", "P0002", "P0003"]);
        assert.deepEqual(await danaBirths(w), ["Dolní Ves"]);
        // the older copy sent again: decided already, nothing asked again, she stays
        const a2 = JSON.parse((await post(`${info.url}/sync`, window(withoutDana(given), "treeA", "a2"), app)).body);
        assert.deepEqual(a2.conflicts ?? [], [], JSON.stringify(a2));
        assert.deepEqual(await people(w), ["P0001", "P0002", "P0003"], JSON.stringify(a2));
        // only said — never "kept" (the window never had her): it removed her itself (U7 B2, the app's contract 1c)
        assert.ok((a2.notWritten ?? []).some((n: { person?: string; kind: string; why: string }) => n.person === "P0003" && n.kind === "person.gone" && n.why === "report"), JSON.stringify(a2));
      }
      assert.equal((await openConflicts(w)).length, 0);
      assert.equal((await w.run(["check"])).code, 0);
    } finally {
      await w.ok(["live", "stop"]);
      w.cleanup();
    }
  });
}

test("reversed, taken back: strom sync undo of the older copy's send closes its question, nothing removed", opts, async () => {
  const { w, given } = await world();
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    await post(`${info.url}/sync`, window(danaBorn(given, "Dolní Ves"), "treeB", "b1"), app);
    const a = JSON.parse((await post(`${info.url}/sync`, window(withoutDana(given), "treeA", "a1"), app)).body);
    assert.equal(a.conflicts.length, 1, JSON.stringify(a));
    await new Promise((r) => setTimeout(r, 1100));
    await w.ok(["sync", "undo", a.input]);
    assert.equal((await openConflicts(w)).length, 0);
    assert.deepEqual(await people(w), ["P0001", "P0002", "P0003"]);
    assert.deepEqual(await danaBirths(w), ["Dolní Ves"]);
  } finally {
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});

// every order of three copies (A removes Dana, C and D each give her another birthplace): no edit lost without a
// conflict, no removal lost in silence, never a second Dana
const orders = [["A", "C", "D"], ["A", "D", "C"], ["C", "A", "D"], ["C", "D", "A"], ["D", "A", "C"], ["D", "C", "A"]];
for (const order of orders) {
  test(`three copies sent in the order ${order.join(", ")}: nothing lost without a conflict`, opts, async () => {
    const { w, given } = await world();
    const info = (await w.ok(["live", "start", "--json"])).json;
    const copies: Record<string, string> = { A: withoutDana(given), C: danaBorn(given, "Dolní Ves"), D: danaBorn(given, "Testovská Lhota") };
    try {
      for (const k of order) {
        const r = await post(`${info.url}/sync`, window(copies[k]!, `tree${k}`, `${k.toLowerCase()}1`), app);
        assert.equal(r.status, 200, r.body);
      }
      const ids = await people(w);
      assert.ok(!ids.some((id) => id > "P0003"), `no second Dana: ${ids.join(",")}`);
      const open = await openConflicts(w);
      const asked = JSON.stringify((await Promise.all(open.map(async (c) => (await w.ok(["conflict", "show", c.id, "--json"])).json))));
      const kept = await danaBirths(w);
      for (const place of ["Dolní Ves", "Testovská Lhota"]) assert.ok(kept.includes(place) || asked.includes(place), `${place} kept or asked: ${JSON.stringify(kept)} ${asked}`);
      // the removal: written, or asked about
      assert.ok(!ids.includes("P0003") || open.some((c) => /PERSON/.test(JSON.stringify(c)) || asked.includes('"PERSON"')), `removal written or asked: ${asked}`);
      assert.equal((await w.run(["check"])).code, 0);
    } finally {
      await w.ok(["live", "stop"]);
      w.cleanup();
    }
  });
}

// who edited the person since the older copy's state: said as it was — another copy of the app, the research, both
for (const by of ["research", "both"] as const) {
  test(`reversed, edited ${by === "research" ? "in the research" : "in another copy and in the research"}: the conflict says who edited her (U7 A)`, opts, async () => {
    const { w, given } = await world();
    const info = (await w.ok(["live", "start", "--json"])).json;
    try {
      if (by === "both") await post(`${info.url}/sync`, window(danaBorn(given, "Dolní Ves"), "treeB", "b1"), app);
      await w.ok(["event", "add", "P3", "DEAT", "--date", "2040"]);
      const a = JSON.parse((await post(`${info.url}/sync`, window(withoutDana(given), "treeA", "a1"), app)).body);
      assert.deepEqual(await people(w), ["P0001", "P0002", "P0003"], "not removed in silence");
      assert.equal(a.conflicts.length, 1, JSON.stringify(a));
      const x = a.conflicts[0];
      assert.deepEqual([x.person, x.fact], ["P0003", "PERSON"], JSON.stringify(a));
      assert.equal(x.sides.research, by === "research" ? "pozdější úpravy ve výzkumu" : "pozdější úpravy v jiné kopii aplikace i ve výzkumu", JSON.stringify(a));
      assert.match((await w.ok(["conflict", "show", x.id])).out, by === "research" ? /pozdější úpravy ve výzkumu/ : /v jiné kopii aplikace i ve výzkumu/);
    } finally {
      await w.ok(["live", "stop"]);
      w.cleanup();
    }
  });
}

test("an edit of another window taken back (strom sync undo), then an older copy without her: removed, no conflict (U7 B1)", opts, async () => {
  const { w, given } = await world();
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const b = JSON.parse((await post(`${info.url}/sync`, window(danaBorn(given, "Dolní Ves"), "treeB", "b1"), app)).body);
    await new Promise((r) => setTimeout(r, 1100));
    await w.ok(["sync", "undo", b.input]);
    assert.deepEqual(await danaBirths(w), ["Horní Ves"]);
    const a = JSON.parse((await post(`${info.url}/sync`, window(withoutDana(given), "treeA", "a1"), app)).body);
    assert.deepEqual(a.conflicts ?? [], [], JSON.stringify(a));
    assert.deepEqual(await people(w), ["P0001", "P0002"], JSON.stringify(a));
    assert.equal((await openConflicts(w)).length, 0);
    assert.equal((await w.run(["check"])).code, 0);
  } finally {
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});

test("reversed, decided to remove her, then the older copy's send taken back: said she stays removed and how she comes back (U7 C)", opts, async () => {
  const { w, given } = await world();
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    await post(`${info.url}/sync`, window(danaBorn(given, "Dolní Ves"), "treeB", "b1"), app);
    const a = JSON.parse((await post(`${info.url}/sync`, window(withoutDana(given), "treeA", "a1"), app)).body);
    const x = a.conflicts[0].id as string;
    await w.ok(["conflict", "resolve", x, "--take", "user", "--reasoning", "Dana nepatří"]);
    assert.deepEqual(await people(w), ["P0001", "P0002"]);
    await new Promise((r) => setTimeout(r, 1100));
    const undo = await w.ok(["sync", "undo", a.input]);
    assert.match(undo.out, new RegExp(`Dana Testovská \\(P0003\\) zůstává mimo strom: tak rozhodl rozpor ${x}; zpět do stromu: strom conflict resolve ${x} --take research`), undo.out);
    assert.deepEqual(await people(w), ["P0001", "P0002"], "the decision stands");
    // the way back it names works
    await w.ok(["conflict", "resolve", x, "--take", "research", "--reasoning", "Dana patří do rodiny", "--reason", "vráceno omylem"]);
    assert.deepEqual(await people(w), ["P0001", "P0002", "P0003"]);
    assert.deepEqual(await danaBirths(w), ["Dolní Ves"]);
    assert.equal((await openConflicts(w)).length, 0);
    assert.equal((await w.run(["check"])).code, 0);
  } finally {
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});

test("sync undo --json of a send whose removal the person decided: the people still removed, with the way back", opts, async () => {
  const { w, given } = await world();
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    await post(`${info.url}/sync`, window(danaBorn(given, "Dolní Ves"), "treeB", "b1"), app);
    const a = JSON.parse((await post(`${info.url}/sync`, window(withoutDana(given), "treeA", "a1"), app)).body);
    const x = a.conflicts[0].id as string;
    await w.ok(["conflict", "resolve", x, "--take", "user", "--reasoning", "Dana nepatří"]);
    await new Promise((r) => setTimeout(r, 1100));
    const j = (await w.ok(["sync", "undo", a.input, "--json"])).json;
    assert.deepEqual(j.stillRemoved?.map((r: { person: string; conflict: string }) => [r.person, r.conflict]), [["P0003", x]], JSON.stringify(j));
  } finally {
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});

test("a person's place in the tree decided four times: the history says each decision with its own reasoning and what it did; the earlier decisions read in the research's language (U7 finding)", opts, async () => {
  const { w, given } = await world();
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    await post(`${info.url}/sync`, window(danaBorn(given, "Dolní Ves"), "treeB", "b1"), app);
    const a = JSON.parse((await post(`${info.url}/sync`, window(withoutDana(given), "treeA", "a1"), app)).body);
    const x = a.conflicts[0].id as string;
    await w.ok(["conflict", "resolve", x, "--take", "user", "--reasoning", "Dana nepatří"]);
    await w.ok(["conflict", "resolve", x, "--take", "research", "--reasoning", "Dana patří", "--reason", "omyl"]);
    await w.ok(["conflict", "resolve", x, "--take", "user", "--reasoning", "přece ne", "--reason", "druhý omyl"]);
    await w.ok(["conflict", "resolve", x, "--take", "research", "--reasoning", "definitivně patří", "--reason", "třetí"]);
    assert.deepEqual(await people(w), ["P0001", "P0002", "P0003"]);
    assert.deepEqual(await danaBirths(w), ["Dolní Ves"], "nothing lost");
    const decided = (out: string, word: RegExp) => out.split("\n").filter((l) => word.test(l));
    // newest first, each its own reasoning and what it did — never hidden in "and 1 more change"
    const cs = decided((await w.ok(["history"])).out, /Rozpor rozhodnut/u);
    assert.equal(cs.length, 4, cs.join("\n"));
    const said: [string, string][] = [["definitivně patří", "návrat do stromu"], ["přece ne", "odebrání ze stromu"], ["Dana patří", "návrat do stromu"], ["Dana nepatří", "odebrání ze stromu"]];
    said.forEach(([why, did], i) => assert.match(cs[i]!, new RegExp(` – ${why} → ${did}$`, "u"), cs.join("\n")));
    assert.ok(!cs.some((l) => /další změny/u.test(l)), cs.join("\n"));
    for (const [lang, word, did] of [["en", /Disagreement decided/, "removed from the tree"], ["de", /Widerspruch entschieden/, "aus dem Stammbaum entfernt"]] as const) {
      const other = decided((await w.ok(["history", "--lang", lang])).out, word);
      assert.equal(other.length, 4, other.join("\n"));
      assert.match(other[1]!, new RegExp(` – přece ne → ${did}$`, "u"), other.join("\n"));
    }
    // the earlier decisions kept in notes, read in the research's language
    const show = (await w.ok(["conflict", "show", x])).out;
    assert.match(show, /dříve rozhodl uživatel \(hodnota uživatele\): .* — Dana nepatří/u, show);
    assert.match(show, /dříve rozhodl uživatel \(hodnota výzkumu\): .* — Dana patří/u, show);
    assert.ok(!/earlier decided/.test(show), show);
    assert.match((await w.ok(["conflict", "show", x, "--lang", "de"])).out, /früher vom Benutzer entschieden \(Wert des Benutzers\): .* — Dana nepatří/u);
    // the record keeps its notes as strom wrote them
    assert.match(JSON.stringify((await w.ok(["conflict", "show", x, "--json"])).json), /earlier decided by the user \(the user's value\)/);
  } finally {
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});
