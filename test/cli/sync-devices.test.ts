// Sends of two devices of the Strom app on one research (spec 094 U3): an undo of a send takes back only the parts of a
// fact that send changed — a later change of another device (or of the research) stays, said; an undo of a send nothing
// changed since works as before.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { post } from "./sync.helpers.ts";

const opts = { skip: !hasGit };

/** Jan Lhoták born about 1905 in Lhota: the research as it is first given. */
async function world(): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M"]); // P1
  await w.ok(["event", "add", "P1", "BIRT", "--date", "ABT 1905", "--place", "Lhota"]);
  return w;
}

/** The research as the Strom app is given it now. */
async function given(w: World, name: string): Promise<string> {
  const file = path.join(w.dir, `${name}.ged`);
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", file]);
  return fs.readFileSync(file, "utf8");
}

/** A device's copy as it sends it: its own tree of the app, its mark of the send, and the device when it names itself. */
const device = (text: string, tree: string, sent: string, client?: { id: string; name?: string }) =>
  text.replace(/^(1 _STROM_HEAD .*\r?\n)/m, `$11 _STROM_APP_TREE ${tree}\n1 _STROM_SENT ${sent}\n${client ? `1 _STROM_CLIENT ${client.id}\n${client.name ? `2 NAME ${client.name}\n` : ""}` : ""}`);

/** The operations of the research as written, all of them. */
function ops(w: World): Record<string, unknown>[] {
  const root = w.treeDir("Lhotákovi");
  const out: Record<string, unknown>[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f);
      else if (e.name.endsWith(".jsonl")) out.push(...fs.readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Record<string, unknown>));
    }
  };
  walk(path.join(root, "data", "ops"));
  return out;
}

/** Sent and written (as the bridge writes it): the input. */
async function send(w: World, text: string, name: string): Promise<string> {
  const file = path.join(w.dir, `${name}.ged`);
  fs.writeFileSync(file, text);
  const r = await w.ok(["sync", file, "--apply", "--json"]);
  assert.ok(r.json.input, r.out);
  return r.json.input as string;
}

async function birth(w: World): Promise<{ date?: string; place?: string }> {
  const p = (await w.ok(["person", "show", "P1", "--json"])).json.person;
  const e = (p.events as { kind: string; date?: string; place?: string; retracted?: unknown }[]).find((x) => x.kind === "BIRT" && !x.retracted)!;
  return { date: e.date, place: e.place };
}

const birthDate = (t: string, from: string, to: string) => t.replace(new RegExp(`(1 BIRT\\r?\\n(?:[2-9].*\\r?\\n)*?2 DATE )${from}`), `$1${to}`);
const birthPlace = (t: string, from: string, to: string) => t.replace(new RegExp(`(1 BIRT\\r?\\n(?:[2-9].*\\r?\\n)*?2 PLAC )${from}(\\r?\\n)`), `$1${to}$2`);

test("an undo of B's send takes back B's place only: A's later date stays", opts, async () => {
  const w = await world();
  try {
    const b = await send(w, device(birthPlace(await given(w, "b0"), "Lhota", "Horní Lhota"), "treeB", "b1"), "b1");
    assert.deepEqual(await birth(w), { date: "ABT 1905", place: "Horní Lhota" });
    // A loads the research since (B's place in it) and changes the date
    const a = await send(w, device(birthDate(await given(w, "a0"), "ABT 1905", "1906"), "treeA", "a1"), "a1");
    assert.notEqual(a, b);
    assert.deepEqual(await birth(w), { date: "1906", place: "Horní Lhota" });
    await w.ok(["sync", "undo", b]);
    assert.deepEqual(await birth(w), { date: "1906", place: "Lhota" }, "A's date kept, B's place taken back");
  } finally {
    w.cleanup();
  }
});

for (const json of [true, false]) {
  test(`an undo of B's send keeps a part changed since by A, and says so (${json ? "--json" : "in words"})`, opts, async () => {
    const w = await world();
    try {
      const b = await send(w, device(birthPlace(await given(w, "b0"), "Lhota", "Horní Lhota"), "treeB", "b1"), "b1");
      await send(w, device(birthPlace(await given(w, "a0"), "Horní Lhota", "Dolní Lhota"), "treeA", "a1"), "a1");
      const r = await w.ok(["sync", "undo", b, ...(json ? ["--json"] : [])]);
      assert.deepEqual(await birth(w), { date: "ABT 1905", place: "Dolní Lhota" }, "A's place stays");
      // whose the part left is: A's send (no device named)
      if (json) assert.deepEqual(r.json.kept, [{ event: "E0001", fields: ["place"], what: "Narození – Jan Lhoták (E0001)", by: "send" }], r.out);
      else assert.match(r.out, /Narození – Jan Lhoták \(E0001\): místo – ponecháno, od poslání se změnilo \(Dolní Lhota\)/, r.out);
    } finally {
      w.cleanup();
    }
  });
}

test("the preview of an undo (--dry-run --json): each part from what it is to what it goes back to, the part left and whose — nothing written", opts, async () => {
  const w = await world();
  try {
    const b = await send(w, device(birthDate(birthPlace(await given(w, "b0"), "Lhota", "Horní Lhota"), "ABT 1905", "1904"), "treeB", "b1", { id: "dev-B", name: "Telefon Lhotáků" }), "b1");
    await send(w, device(birthPlace(await given(w, "a0"), "Horní Lhota", "Dolní Lhota"), "treeA", "a1", { id: "dev-A", name: "Notebook" }), "a1");
    const head = () => spawnSync("git", ["rev-parse", "HEAD"], { cwd: w.treeDir("Lhotákovi"), encoding: "utf8" }).stdout.trim();
    const was = head();
    const r = await w.ok(["sync", "undo", b, "--dry-run", "--json"]);
    assert.equal(r.json.undone > 0, true, r.out);
    assert.deepEqual(
      r.json.fields.map((f: { what: string; field: string; from: string; to: string; event?: string }) => [f.what, f.field, f.from, f.to, f.event]),
      [["Narození – Jan Lhoták (E0001)", "date", "1904", "asi 1905", "E0001"]],
      r.out,
    );
    assert.deepEqual(r.json.kept, [{ event: "E0001", fields: ["place"], what: "Narození – Jan Lhoták (E0001)", by: "send", client: { id: "dev-A", name: "Notebook" } }], r.out);
    // nothing written: the head, the fact, the send not taken back
    assert.equal(head(), was);
    assert.deepEqual(await birth(w), { date: "1904", place: "Dolní Lhota" });
    const done = await w.ok(["sync", "undo", b, "--json"]);
    assert.deepEqual(done.json.fields, r.json.fields);
    const again = await w.ok(["sync", "undo", b, "--json"]);
    assert.deepEqual([again.json.undone, typeof again.json.undoneAt], [0, "string"]);
  } finally {
    w.cleanup();
  }
});

test("an undo of a send nothing changed since: the whole fact as it was, as before", opts, async () => {
  const w = await world();
  try {
    const b = await send(w, device(birthDate(birthPlace(await given(w, "b0"), "Lhota", "Horní Lhota"), "ABT 1905", "1904"), "treeB", "b1"), "b1");
    assert.deepEqual(await birth(w), { date: "1904", place: "Horní Lhota" });
    const r = await w.ok(["sync", "undo", b, "--json"]);
    assert.deepEqual(await birth(w), { date: "ABT 1905", place: "Lhota" });
    assert.equal(r.json.kept, undefined, r.out);
  } finally {
    w.cleanup();
  }
});

test("two devices' sends told apart: the input, its listing, every operation it wrote, the commit; an older app's as before", opts, async () => {
  const w = await world();
  try {
    const chrome = { id: "dev-a1", name: "Chrome · Mac" };
    const a = await send(w, device(birthPlace(await given(w, "a0"), "Lhota", "Horní Lhota"), "treeA", "a1", chrome), "a1");
    const b = await send(w, device(birthDate(await given(w, "b0"), "ABT 1905", "1904"), "treeB", "b1", { id: "dev-b2" }), "b1");
    // an older app names no device
    const c = await send(w, device(birthDate(await given(w, "c0"), "1904", "1903"), "treeC", "c1"), "c1");
    const list = (await w.ok(["input", "list", "--json"])).json.inputs as { id: string; client?: unknown }[];
    assert.deepEqual(list.find((i) => i.id === a)!.client, chrome);
    assert.deepEqual(list.find((i) => i.id === b)!.client, { id: "dev-b2" });
    assert.equal(list.find((i) => i.id === c)!.client, undefined);
    const words = (await w.ok(["input", "list"])).out;
    assert.match(words, new RegExp(`${a}.*from Chrome · Mac`));
    assert.match(words, new RegExp(`${b}.*from dev-b2`));
    assert.doesNotMatch(words.split("\n").find((l) => l.includes(c))!, /from /);
    assert.match((await w.ok(["input", "show", a])).out, /device Chrome · Mac \(dev-a1\)/);
    // every operation a send wrote names its device beside the user; another's none
    const written = ops(w);
    const fact = written.filter((o) => o.op === "event.edit");
    assert.equal(fact.length, 3, JSON.stringify(fact));
    assert.deepEqual(fact.map((o) => o.via), [chrome, { id: "dev-b2" }, undefined]);
    assert.ok(fact.every((o) => o.by === "user"));
    // the commit: its text as it was, the device on a line of its own after it
    const log = spawnSync("git", ["log", "--format=%B%x1e"], { cwd: w.treeDir("Lhotákovi"), encoding: "utf8" }).stdout.split("\x1e").map((m) => m.trim()).filter(Boolean);
    assert.ok(log.some((m) => /\n\nVia: Chrome · Mac \(dev-a1\)\n/.test(m)), log.join("\n---\n"));
    assert.ok(log.some((m) => /\n\nVia: dev-b2 \(dev-b2\)\n/.test(m)), log.join("\n---\n"));
    assert.equal(log.filter((m) => m.includes("Via:")).length, 2);
  } finally {
    w.cleanup();
  }
});

test("P2: A sends 1906, B from an older copy sends 1904 — the conflict names both devices (terminal, the bridge's answer)", opts, async () => {
  const w = await world();
  try {
    // B took its copy first, A after; A sends first
    const old = await given(w, "b0");
    const a = await send(w, device(birthDate(await given(w, "a0"), "ABT 1905", "1906"), "treeA", "a1", { id: "dev-a1", name: "Chrome · Mac" }), "a1");
    const file = path.join(w.dir, "b1.ged");
    fs.writeFileSync(file, device(birthDate(old, "ABT 1905", "1904"), "treeB", "b1", { id: "dev-b2", name: "Edge · Windows" }));
    const r = await w.ok(["sync", file, "--apply", "--json"]);
    const conflicts = r.json.conflicts as { id: string; sides?: { user: string; research: string }; sent?: unknown }[];
    assert.equal(conflicts.length, 1, r.out);
    assert.deepEqual(conflicts[0]!.sent, { user: { client: { id: "dev-b2", name: "Edge · Windows" } }, research: { input: a, client: { id: "dev-a1", name: "Chrome · Mac" } } });
    assert.deepEqual(await birth(w), { date: "1906", place: "Lhota" }, "nothing overwritten");
    const shown = (await w.ok(["conflict", "show", conflicts[0]!.id])).out;
    assert.match(shown, /úprava z Chrome · Mac × úprava z Edge · Windows/, shown);
  } finally {
    w.cleanup();
  }
});

test("a conflict of a value the research changed since a send against a send: as before, no devices", opts, async () => {
  const w = await world();
  try {
    const old = await given(w, "b0");
    // A's send writes 1906, the research corrects it since (an agent, by a record), then B sends its own from the older copy
    await send(w, device(birthDate(await given(w, "a0"), "ABT 1905", "1906"), "treeA", "a1", { id: "dev-a1", name: "Chrome · Mac" }), "a1");
    await w.ok(["event", "edit", "E0001", "--date", "1907", "--reason", "the register says 1907"]);
    const file = path.join(w.dir, "b1.ged");
    fs.writeFileSync(file, device(birthDate(old, "ABT 1905", "1904"), "treeB", "b1", { id: "dev-b2", name: "Edge · Windows" }));
    const r = await w.ok(["sync", file, "--apply", "--json"]);
    const conflicts = r.json.conflicts as { id: string; sent?: unknown }[];
    assert.equal(conflicts.length, 1, r.out);
    assert.equal(conflicts[0]!.sent, undefined);
    assert.doesNotMatch((await w.ok(["conflict", "show", conflicts[0]!.id])).out, /úprava z/);
    // the app's link: the question as before — the app's value against the research's
    const user = await link(w, conflicts[0]!.id, "user", ["n"]);
    assert.match(user.out, /rozhodnout rozpor: .* — ponechat hodnotu z aplikace: 1904, Lhota/, user.out);
    const research = await link(w, conflicts[0]!.id, "research", ["n"]);
    assert.match(research.out, /rozhodnout rozpor: .* — převzít hodnotu výzkumu: 1907, Lhota/, research.out);
    assert.doesNotMatch(user.out + research.out, /úprav[uy] z/);
  } finally {
    w.cleanup();
  }
});

/** The Strom app's link deciding a conflict by the side picked there, opened in the terminal. */
function link(w: World, id: string, take: "user" | "research", answers: string[]) {
  const tree = (JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")) as { id: string }).id;
  return w.run(["link", "open", `strom-research://conflict?tree=${tree}&id=${id}&do=decide&take=${take}`], { tty: true, answers });
}

test("P2 by the app's link: the question names the device of the side picked — the later send's for take=user, the earlier's for take=research (cs, en)", opts, async () => {
  const w = await world();
  try {
    const old = await given(w, "b0");
    // a device's name with diacritics, sent decomposed (NFD): read as it is written, NFC
    await send(w, device(birthDate(await given(w, "a0"), "ABT 1905", "1906"), "treeA", "a1", { id: "dev-a1", name: "Šárčin tablet".normalize("NFD") }), "a1");
    const file = path.join(w.dir, "b1.ged");
    fs.writeFileSync(file, device(birthDate(old, "ABT 1905", "1904"), "treeB", "b1", { id: "dev-b2", name: "Почтовый ноутбук" }));
    const r = await w.ok(["sync", file, "--apply", "--json"]);
    const id = (r.json.conflicts as { id: string }[])[0]!.id;
    await w.ok(["lang", "en"]);
    const en = await link(w, id, "research", ["n"]);
    assert.match(en.out, /decide the conflict: .* — keep the edit from Šárčin tablet: 1906, Lhota/, en.out);
    assert.doesNotMatch(en.out, /the research's value|the value from the app/);
    await w.ok(["lang", "cs"]);
    const cs = await link(w, id, "user", ["a", "", ""]);
    assert.equal(cs.code, 0, cs.err + cs.out);
    assert.match(cs.out, /rozhodnout rozpor: .* — ponechat úpravu z Почтовый ноутбук: 1904, Lhota/, cs.out);
    assert.doesNotMatch(cs.out, /hodnotu z aplikace|hodnotu výzkumu/);
    // take=user is the later send's edit: that one written
    assert.deepEqual(await birth(w), { date: "1904", place: "Lhota" });
  } finally {
    w.cleanup();
  }
});

test("P2 in the terminal (What waits): both sides by their devices, the later one kept", { skip: !hasGit || process.platform === "win32" }, async () => {
  const w = await world();
  try {
    const old = await given(w, "b0");
    await send(w, device(birthDate(await given(w, "a0"), "ABT 1905", "1906"), "treeA", "a1", { id: "dev-a1", name: "Chrome · Mac" }), "a1");
    const file = path.join(w.dir, "b1.ged");
    fs.writeFileSync(file, device(birthDate(old, "ABT 1905", "1904"), "treeB", "b1", { id: "dev-b2", name: "Edge · Windows" }));
    await w.ok(["sync", file, "--apply"]);
    // no agent here: an archive, the person decides in What waits
    w.env.PATH = [path.dirname(process.execPath), "/usr/bin", "/bin"].join(path.delimiter);
    await w.ok(["mode", "archive"], { tty: true, answers: ["", "", ""] });
    const r = await w.ok([], { tty: true, answers: ["3", "1", "1", "1", "Edge má novější údaj", "0", "0", "0"] });
    assert.match(r.out, /^ úprava z Chrome · Mac × úprava z Edge · Windows$/m, r.out);
    assert.match(r.out, /^ {4}úprava z Edge · Windows: 1904, Lhota$/m, r.out);
    assert.match(r.out, /^ {4}úprava z Chrome · Mac: 1906, Lhota$/m, r.out);
    assert.match(r.out, /^ {3}1 {2}Ponechat úpravu z Edge · Windows$/m, r.out);
    assert.match(r.out, /^ {3}2 {2}Ponechat úpravu z Chrome · Mac$/m, r.out);
    assert.deepEqual(await birth(w), { date: "1904", place: "Lhota" });
  } finally {
    w.cleanup();
  }
});

test("over the bridge: two devices send (P1 each its own fact, P2 the same fact from an older copy) — sends, history and the conflict name them", { skip: !hasGit || process.platform === "win32" }, async () => {
  const w = await world();
  await w.ok(["person", "add", "Marie /Lhotáková/", "--sex", "F"]); // P2
  await w.ok(["event", "add", "P2", "BIRT", "--date", "1870"]);
  const info = (await w.ok(["live", "start", "--json"])).json;
  const app = { Origin: "https://beta.stromapp.info" };
  const chrome = { id: "dev-a1", name: "Chrome · Mac" };
  const edge = { id: "dev-b2", name: "Edge · Windows" };
  try {
    const both = await given(w, "both");
    // P1: A Marie's birth, B (the same copy) Jan's birthplace — both written
    const a1 = await post(`${info.url}/sync`, device(both.replace("2 DATE 1870", "2 DATE 1871"), "treeA", "a1", chrome), app);
    assert.equal(a1.status, 200, a1.body);
    const b1 = await post(`${info.url}/sync`, device(birthPlace(both, "Lhota", "Horní Lhota"), "treeB", "b1", edge), app);
    assert.equal(b1.status, 200, b1.body);
    assert.deepEqual(await birth(w), { date: "ABT 1905", place: "Horní Lhota" });
    // P2: A sends Jan born 1906; B from its older copy 1904 — a conflict naming both devices, 1906 stays
    const a2 = await post(`${info.url}/sync`, device(birthDate(await given(w, "a2"), "ABT 1905", "1906"), "treeA", "a2", chrome), app);
    assert.equal(a2.status, 200, a2.body);
    const b2 = await post(`${info.url}/sync`, device(birthDate(birthPlace(both, "Lhota", "Horní Lhota"), "ABT 1905", "1904"), "treeB", "b2", edge), app);
    assert.equal(b2.status, 200, b2.body);
    const conflicts = JSON.parse(b2.body).conflicts as { sent?: { user: { client?: unknown }; research: { input?: string; client?: unknown } } }[];
    assert.equal(conflicts.length, 1, b2.body);
    assert.deepEqual(conflicts[0]!.sent, { user: { client: edge }, research: { input: JSON.parse(a2.body).input, client: chrome } }, b2.body);
    assert.deepEqual(await birth(w), { date: "1906", place: "Horní Lhota" });
    // /status: every send with its device
    const status = (await (await fetch(`${info.url}/status`, { headers: app })).json()) as { sends: { intake: string; client?: unknown; tree?: string }[] };
    assert.deepEqual(status.sends.map((s) => [s.tree, s.client]).sort((x, y) => String(x[0]).localeCompare(String(y[0]))), [["treeA", chrome], ["treeA", chrome], ["treeB", edge], ["treeB", edge]]);
    // the inbox's record of each send names its device
    const inbox = path.join(w.treeDir("Lhotákovi"), ".strom", "sync");
    const received = fs.readdirSync(inbox).filter((f) => /^received-R.*\.json$/.test(f)).map((f) => JSON.parse(fs.readFileSync(path.join(inbox, f), "utf8")) as { tree?: string; client?: unknown });
    assert.ok(received.length >= 4 && received.every((r) => JSON.stringify(r.client) === JSON.stringify(r.tree === "treeA" ? chrome : edge)), JSON.stringify(received));
    // the history (GET /log): what each send wrote, by its device
    const { entries } = (await (await fetch(`${info.url}/log`, { headers: app })).json()) as { entries: { via?: unknown; what: string[] }[] };
    const sent = entries.filter((e) => e.via);
    assert.ok(sent.some((e) => JSON.stringify(e.via) === JSON.stringify(chrome)), JSON.stringify(entries));
    assert.ok(sent.some((e) => JSON.stringify(e.via) === JSON.stringify(edge)), JSON.stringify(entries));
  } finally {
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});
