// The verification of facts against their originals with the Strom app (spec 065; the app's
// ZADANI_VYZKUM_spolehlivost.md, "Odpověď výzkumu" and "Odpověď výzkumu na Dotazy"): the Strom file's marks under each
// fact (2 _STROM_EID, _STROM_CONFIRMED, _STROM_VERIFY with 3 _POS, _STROM_CHECKED with DATE, _WHY, _READERS) behind
// the gate APP_SHOWS_VERIFY, read by the app's own parser and passed by strom sync.
// Made-up people (Lhoták, Lhota), diacritics in NFD as typed on a Mac, a place in Cyrillic.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { now, Tree } from "../../src/core/tree.ts";
import { exportGedcom } from "../../src/gedcom/export.ts";
import { validateGedcom } from "../../src/gedcom/validate.ts";
import { GedWriter } from "../../src/gedcom/lines.ts";
import { parseGedcomText } from "../../src/gedcom/parse.ts";
import { Settings } from "../../src/core/config.ts";
import { APP_SHOWS_VERIFY, APP_SHOWS_VERIFY_BETA, appShowsVerify } from "../../src/core/stromapp.ts";
import { verifyMarks } from "../../src/core/verify.ts";
import { encodeImage } from "../../src/image/index.ts";
import type { Event, Family, Person, Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit };
const APP = { STROM_FOR_APP: "1" };
const BETA_APP = { STROM_APP_URL: "https://beta.stromapp.info/run/", STROM_APP_VERSION: "3.26.0-beta.2" };

const open = (w: World) => Tree.open(w.cwd, w.env);
const fact = (w: World, id: string): Event => {
  const tree = open(w);
  for (const o of [...tree.list<Person>("person"), ...tree.list<Family>("family")]) {
    const e = o.events.find((x) => x.id === id);
    if (e) return e;
  }
  throw new Error(`no fact ${id}`);
};

/** A fact added; its ID. */
async function add(w: World, owner: string, kind: string, ...more: string[]): Promise<string> {
  return (await w.ok(["event", "add", owner, kind, ...more, "--json"])).json.event.id as string;
}

/** A folder of grey scans (s0001.jpg …). */
function scans(w: World, n: number): string {
  const dir = fs.mkdtempSync(path.join(w.dir, "skeny-"));
  for (let i = 0; i < n; i++) fs.writeFileSync(path.join(dir, `s${String(i + 1).padStart(4, "0")}.jpg`), encodeImage({ width: 300, height: 400, channels: 1, data: new Uint8Array(300 * 400).fill(180) }, "jpeg"));
  return dir;
}

/** An agent's verification of a fact written as strom writes it (strom verify done): the export test needs only its shape. */
function verified(w: World, id: string, v: Event["verified"], status?: Event["status"]): void {
  const tree = open(w);
  tree.withTreeLock(() => {
    for (const o of [...tree.list<Person>("person"), ...tree.list<Family>("family")]) {
      if (!o.events.some((e) => e.id === id)) continue;
      tree.put({ ...o, events: o.events.map((e) => (e.id === id ? { ...e, verified: v, ...(status ? { status } : {}) } : e)), updated: now() } as Person | Family, { op: "verify.done", targets: [o.id, id], summary: `${id} verified` });
    }
    tree.commit("Verified");
  });
}

/**
 * Jan Lhoták (P1) and his parents Josef (P2) and Marie (P3), family F1; the registers of Lhota (B0001) with scans here;
 * Josef's baptism, death and the marriage cite their originals (S1–S3), Jan's birth only an index (S4).
 */
async function lhotaci() {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  await w.ok(["research", "new", "Předci Jana", "--new-person", "Jan /Lhoták/", "--sex", "M"]); // P1
  await w.ok(["person", "add", "Josef /Lhoták/".normalize("NFD"), "--sex", "M"]); // P2
  await w.ok(["person", "add", "Marie /Lhotová/", "--sex", "F"]); // P3
  await w.ok(["family", "add", "--partner", "P2", "--partner", "P3", "--child", "P1"]); // F1
  await w.ok(["repo", "add", "Archiv Lhota", "--automation", "manual"]);
  await w.ok(["recordset", "add", "Lhota 1, N O Z 1840-1910", "--repo", "R1", "--kinds", "baptism,marriage,death", "--places", "Lhota", "--years", "1840-1910", "--access", "online-free"]); // B1
  const original = (title: string, kind: string) => ["source", "add", title, "--kind", kind, "--recordset", "B0001", "--locator", "fol. 1", "--information", "primary"];
  await w.ok(original("Křest Josefa Lhotáka 1850", "baptism")); // S1
  await w.ok(original("Úmrtí Josefa Lhotáka 1910", "death")); // S2
  await w.ok(original("Oddavky Josefa a Marie 1875", "marriage")); // S3
  await w.ok(["source", "add", "Index křtů Lhota", "--kind", "index", "--information", "primary"]); // S4, no original
  const cite = (s: string) => ["--cite", s, "--locator", "fol. 1"];
  const f = {
    josefBirth: await add(w, "P2", "BIRT", "--date", "1850", "--place", "Lhota", ...cite("S0001")),
    josefDeath: await add(w, "P2", "DEAT", "--date", "1910", "--place", "Лхота", ...cite("S0002")),
    marriage: await add(w, "F1", "MARR", "--date", "1875", "--place", "Lhota", ...cite("S0003")),
    janBirth: await add(w, "P1", "BIRT", "--date", "1880", "--place", "Lhota", "--cite", "S0004"),
  };
  await w.ok(["media", "add", scans(w, 3), "--recordset", "B0001"]);
  return { w, f };
}

/** The lines of a fact in a GEDCOM: from its line to the next line of level 1 or 0. */
function block(text: string, id: string): string[] {
  const lines = text.split("\n");
  const at = lines.indexOf(`2 _STROM_EID ${id}`);
  assert.ok(at > 0, `no _STROM_EID ${id}`);
  let end = at;
  while (end + 1 < lines.length && !/^[01] /.test(lines[end + 1]!)) end++;
  return lines.slice(at - 1, end + 1);
}

test("the gate: the verification's marks only for an app that shows them — from the app's 3.26.0, an unknown version never; its beta from its own gate", () => {
  const prod = new Settings({ STROM_APP_URL: "https://stromapp.info/run/" }, {});
  const beta = new Settings({ STROM_APP_URL: "https://beta.stromapp.info/run/" }, {});
  assert.equal(APP_SHOWS_VERIFY, "3.26.0", "the app's 3.26.0 shows them (out 2026-11-09)");
  assert.equal(APP_SHOWS_VERIFY_BETA, "3.26.0-beta.2");
  for (const v of [undefined, "3.25.0", "3.26.0-beta.2", "3.26.0-beta.9"]) assert.equal(appShowsVerify(prod, v), false, String(v));
  for (const v of ["3.26.0", "3.26.1", "9.0.0"]) assert.equal(appShowsVerify(prod, v), true, String(v));
  assert.equal(appShowsVerify(beta, undefined), false, "an unknown version stays off");
  assert.equal(appShowsVerify(beta, "3.26.0-beta.1"), false);
  for (const v of ["3.26.0-beta.2", "3.26.0", "9.0.0"]) assert.equal(appShowsVerify(beta, v), true, `beta ${v}`);
  assert.equal(appShowsVerify(prod, "3.27.0", "3.27.0"), true);
  assert.equal(appShowsVerify(prod, "3.26.9", "3.27.0"), false);
  assert.equal(appShowsVerify(prod, undefined, "3.27.0"), false, "an unknown version stays off");
});

test("the Strom file: each fact's ID right after its line, the person's confirmation, how it waits with its place in the queue, the last verification — for the app of the gate alone; never in the standard file; valid", opts, async () => {
  const { w, f } = await lhotaci();
  try {
    await w.ok(["frontier", "--research", "G0001", "--apply"]); // the sweep: Josef's facts, the marriage
    await w.ok(["verify", "facts", "P0001"]); // the person's: Jan's birth looked for (an index alone)
    await w.ok(["verify", "confirm", f.marriage], { env: APP });
    const reason = "Zápis je poškozený, datum nečitelné".normalize("NFD");
    verified(w, f.josefDeath, { at: "2026-11-08T10:00:00.000Z", by: "N0001", model: "claude-opus-x", result: "kept", reason, cites: ["S0002"] });
    verified(w, f.josefBirth, { at: "2026-11-07T23:59:00.000Z", by: "N0001", model: "claude-opus-x", result: "proven", cites: ["S0001"], readers: 2 }, "proven");
    const marks = verifyMarks(open(w));
    assert.deepEqual([...marks.keys()].sort(), [f.josefBirth, f.josefDeath, f.janBirth].sort(), "the confirmed marriage left its task");
    assert.equal(marks.get(f.janBirth)?.state, "asked");
    assert.equal(marks.get(f.janBirth)?.pos, 1, "asked by the person: first in the queue");
    assert.equal(marks.get(f.josefBirth)?.state, "wait");
    assert.equal(marks.get(f.josefBirth)?.pos, marks.get(f.josefDeath)?.pos, "every fact of a task the same place");
    assert.ok(marks.get(f.josefBirth)!.pos! > 1);

    const file = path.join(w.cwd, "output", "tree-strom.ged");
    await w.ok(["export", "gedcom", "--for", "strom"], { env: BETA_APP });
    const text = fs.readFileSync(file, "utf8");
    // the ID right after the fact's line, before its date; every fact of a person and of a family; none under NAME
    // with the mark of what it says under it (POST /facts/confirm gives it back)
    assert.match(text, new RegExp(`\\n1 BIRT\\n2 _STROM_EID ${f.josefBirth}\\n3 _TXT [0-9a-f]{16}\\n2 DATE 1850\\n`, "u"));
    assert.match(text, new RegExp(`\\n1 MARR\\n2 _STROM_EID ${f.marriage}\\n3 _TXT [0-9a-f]{16}\\n2 DATE 1875\\n`, "u"));
    assert.doesNotMatch(text, /\n1 NAME [^\n]*\n(?:2 [^\n]*\n)*?2 _STROM_EID/u);
    assert.deepEqual(block(text, f.marriage).filter((l) => /_STROM_(CONFIRMED|VERIFY|CHECKED)/u.test(l)), [`2 _STROM_CONFIRMED ${new Date().toISOString().slice(0, 10)}`]);
    const pos = marks.get(f.josefBirth)!.pos!;
    assert.deepEqual(block(text, f.josefBirth).filter((l) => /_STROM_(CONFIRMED|VERIFY|CHECKED)|^3 (_POS|DATE|_WHY|_READERS)/u.test(l)), ["2 _STROM_VERIFY wait", `3 _POS ${pos}`, "2 _STROM_CHECKED proven", "3 DATE 7 NOV 2026", "3 _READERS 2"]);
    assert.deepEqual(block(text, f.josefDeath).filter((l) => /_STROM_(CONFIRMED|VERIFY|CHECKED)|^3 (_POS|DATE|_WHY|_READERS)/u.test(l)), ["2 _STROM_VERIFY wait", `3 _POS ${pos}`, "2 _STROM_CHECKED kept", "3 DATE 8 NOV 2026", `3 _WHY ${reason.normalize("NFC")}`]);
    assert.deepEqual(block(text, f.janBirth).filter((l) => /_STROM_VERIFY|_POS/u.test(l)), ["2 _STROM_VERIFY asked", "3 _POS 1"]);
    // the marks after the status: _STROM_STATUS first
    const death = block(text, f.josefDeath);
    assert.ok(death.findIndex((l) => l.startsWith("2 _STROM_STATUS")) < death.indexOf("2 _STROM_VERIFY wait"));
    const findings = validateGedcom(text);
    assert.deepEqual(findings.filter((x) => x.level === "error"), []);
    assert.deepEqual(findings.filter((x) => /_STROM_EID|_STROM_CONFIRMED|_STROM_VERIFY|_STROM_CHECKED|_POS|_WHY|_READERS/u.test(x.message)), []);

    // an app before the gate, the production app before 3.26.0 (its beta versions too), an unknown version: none of it
    const before: Record<string, string>[] = [{ STROM_APP_URL: BETA_APP.STROM_APP_URL, STROM_APP_VERSION: "3.26.0-beta.1" }, { STROM_APP_VERSION: "3.25.0" }, { STROM_APP_VERSION: "3.26.0-beta.2" }, {}, { STROM_APP_URL: BETA_APP.STROM_APP_URL }];
    for (const env of before) {
      fs.rmSync(file, { force: true });
      await w.ok(["export", "gedcom", "--for", "strom"], { env });
      assert.doesNotMatch(fs.readFileSync(file, "utf8"), /_STROM_EID|_STROM_CONFIRMED|_STROM_VERIFY|_STROM_CHECKED/u, JSON.stringify(env));
    }
    // the production app of the release (3.26.0): the marks
    fs.rmSync(file, { force: true });
    await w.ok(["export", "gedcom", "--for", "strom"], { env: { STROM_APP_VERSION: "3.26.0" } });
    assert.match(fs.readFileSync(file, "utf8"), new RegExp(`\\n2 _STROM_EID ${f.marriage}\\n`, "u"));
    // the standard file: never, whatever is asked
    const standard = exportGedcom(open(w), { for: "standard", verify: marks }).text;
    assert.doesNotMatch(standard, /_STROM_EID|_STROM_CONFIRMED|_STROM_VERIFY|_STROM_CHECKED|_WHY/u);

    // in an archive: nothing waits (its tasks are put aside), the person's confirmation and the results stay
    await w.ok(["mode", "archive"], { tty: true });
    assert.equal(verifyMarks(open(w)).size, 0);
    fs.rmSync(file, { force: true });
    await w.ok(["export", "gedcom", "--for", "strom"], { env: BETA_APP });
    const archived = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(archived, /_STROM_VERIFY|_POS/u);
    assert.match(archived, /\n2 _STROM_CONFIRMED /u);
    assert.match(archived, new RegExp(`\\n2 _STROM_EID ${f.marriage}\\n`, "u"));
  } finally {
    w.cleanup();
  }
});

test("the Strom file with every switch of the profile at once, the verification's marks too: nothing the exporter writes is unknown to the validator", opts, async () => {
  const { w, f } = await lhotaci();
  try {
    await w.ok(["frontier", "--research", "G0001", "--apply"]);
    verified(w, f.josefDeath, { at: "2026-11-08T10:00:00.000Z", by: "N0001", result: "kept", reason: "nečitelné\ndruhý řádek", cites: ["S0002"] });
    await w.ok(["verify", "confirm", f.marriage], { env: APP });
    const t = open(w);
    const all = exportGedcom(t, {
      for: "strom", ids: true, clips: true, research: true, edges: true, storyDrafts: true, titles: true, coupleResi: true, sourceReads: true,
      confirms: true, noCouple: true, factStatus: true, archive: true, turnsExcerpts: true, hypothesisLinks: true, hypothesisDecider: true,
      conflictSides: true, readings: true, placeRecords: true, origins: true, original: () => true, links: ["person"], verify: verifyMarks(t),
    });
    assert.match(all.text, /\n2 _STROM_VERIFY wait\n3 _POS \d+\n/u);
    assert.match(all.text, /\n3 _WHY nečitelné\n4 CONT druhý řádek\n/u);
    assert.deepEqual(validateGedcom(all.text).filter((x) => x.level === "error"), []);
    assert.deepEqual(validateGedcom(all.text).filter((x) => /_STROM_EID|_STROM_CONFIRMED|_STROM_VERIFY|_STROM_CHECKED|_POS|_WHY|_READERS|CONT|CONC/u.test(x.message)), []);
  } finally {
    w.cleanup();
  }
});

// The reason of a fact kept is the research's text of any script: cut into CONC lines anywhere, joined it is the same.
test("_WHY: a reason of any length and script, cut into lines and joined again, is the same text — never half a character at a cut", () => {
  const pieces = ["Zápis", " ", "poškozený", "é", "č", "č", "👨‍👩‍👧‍👦", "🇨🇿", "👍🏽", "❤️", "漢字", "記録", "が", "ありません", "Лхота", "ש", "@", "@@", ",", ".", "–", "x", " ", "  "];
  let seed = 0x5eed;
  const rnd = (n: number) => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed % n;
  };
  for (let round = 0; round < 400; round++) {
    // a run of letters first so the cut falls anywhere among the pieces after it
    let text = "a".repeat(rnd(260));
    const paragraphs = 1 + rnd(3);
    for (let p = 0; p < paragraphs; p++) {
      if (p) text += "\n";
      const n = 1 + rnd(120);
      for (let i = 0; i < n; i++) text += pieces[rnd(pieces.length)];
    }
    // as the writer keeps it: composed, each line without the spaces round it
    const expected = text
      .normalize("NFC")
      .split("\n")
      .map((l) => l.trim())
      .join("\n");
    const w = new GedWriter();
    w.line(0, "HEAD");
    w.line(1, "BIRT");
    w.line(2, "_STROM_CHECKED", "kept");
    w.text(3, "_WHY", text);
    const out = w.toString();
    for (const l of out.split("\n")) {
      assert.ok(Buffer.byteLength(l) <= 255, `round ${round}: a line of ${Buffer.byteLength(l)} bytes`);
      assert.doesNotMatch(l, /�/u);
      // no line begins with a lone combining mark, a skin tone, a joiner or a variation selector
      const v = /^\d+ (?:CONC|CONT) (.*)$/u.exec(l)?.[1];
      if (v) assert.doesNotMatch(v, /^[\p{M}‍️\u{1F3FB}-\u{1F3FF}]/u, `round ${round}: ${JSON.stringify(v.slice(0, 8))}`);
    }
    const why = parseGedcomText(out).records[0]!.children[0]!.children[0]!.children[0]!;
    assert.equal(why.tag, "_WHY");
    assert.equal(why.value, expected, `round ${round}`);
  }
});

// The Strom app's own parser (../strom: released; ../strom-beta: coming, with the verification): it reads the marks
// (the beta) or passes them by (the released app) — never fails on them.
for (const dir of ["strom", "strom-beta"]) {
  const repo = path.resolve(import.meta.dirname, "..", "..", "..", dir);
  const tsx = path.join(repo, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
  test(`the Strom app (${dir}) reads the Strom file with the verification's marks and fails on none of them`, { skip: !hasGit || !fs.existsSync(tsx) }, async () => {
    const { w, f } = await lhotaci();
    try {
      await w.ok(["frontier", "--research", "G0001", "--apply"]);
      await w.ok(["verify", "confirm", f.marriage], { env: APP });
      // a long reason: cut into CONC lines with an emoji and a letter with its accent at the cuts
      const reason = `${"Zápis poškozený ".repeat(14)}👨‍👩‍👧‍👦${"č".normalize("NFD")}漢字 Лхота`;
      verified(w, f.josefDeath, { at: "2026-11-08T10:00:00.000Z", by: "N0001", result: "kept", reason, cites: ["S0002"] });
      verified(w, f.josefBirth, { at: "2026-11-08T10:00:00.000Z", by: "N0001", result: "proven", cites: ["S0001"], readers: 2 }, "proven");
      const ged = path.join(w.dir, "verify.ged");
      await w.ok(["export", "gedcom", "--for", "strom", "--out", ged], { env: BETA_APP });
      const text = fs.readFileSync(ged, "utf8");
      assert.match(text, /\n4 CONC /u, "the reason goes on in CONC lines");
      const script = path.join(w.dir, "read.ts");
      fs.writeFileSync(
        script,
        `import fs from "node:fs";
import { parseGedcom, convertToStrom } from ${JSON.stringify(path.join(repo, "src", "ged-parser.ts"))};
const parsed = parseGedcom(fs.readFileSync(process.argv[2]!, "utf8"));
const data = convertToStrom(parsed).data as any;
const josef = (Object.values(data.persons) as any[]).find((p) => p.refn === "P0002");
console.log(JSON.stringify({ persons: Object.keys(data.persons).length, dropped: [...parsed.droppedTags.keys()], josef }));
`,
      );
      const r = spawnSync(tsx, [script, ged], { cwd: repo, encoding: "utf8" });
      assert.equal(r.status, 0, r.stderr);
      const out = JSON.parse(r.stdout.trim().split("\n").pop()!) as { persons: number; dropped: string[]; josef: unknown };
      assert.equal(out.persons, 3, "every person read");
      const seen = JSON.stringify(out.josef);
      // the app that knows the verification has the reason whole (joined from its CONC lines)
      if (fs.readFileSync(path.join(repo, "src", "ged-parser.ts"), "utf8").includes("_STROM_CHECKED")) {
        assert.match(seen, /"checked"/u, seen.slice(0, 400));
        assert.ok(seen.includes(JSON.stringify(reason.normalize("NFC")).slice(1, -1)), seen.slice(0, 600));
      }
    } finally {
      w.cleanup();
    }
  });
}

test("strom sync passes the marks: the Strom file with them sent back unedited changes nothing", opts, async () => {
  const { w, f } = await lhotaci();
  try {
    await w.ok(["frontier", "--research", "G0001", "--apply"]);
    await w.ok(["verify", "confirm", f.marriage], { env: APP });
    verified(w, f.josefDeath, { at: "2026-11-08T10:00:00.000Z", by: "N0001", result: "kept", reason: "nečitelné", cites: ["S0002"] });
    const ged = path.join(w.dir, "back.ged");
    await w.ok(["export", "gedcom", "--for", "strom", "--out", ged], { env: BETA_APP });
    assert.match(fs.readFileSync(ged, "utf8"), /_STROM_VERIFY wait\n3 _POS /u);
    const before = open(w).list<Task>("task").map((t) => `${t.id} ${t.state}`);
    const r = (await w.ok(["sync", ged, "--json"], { env: APP })).json;
    assert.deepEqual(r.changes, [], "unedited: nothing");
    assert.deepEqual(open(w).list<Task>("task").map((t) => `${t.id} ${t.state}`), before);
    assert.ok(fact(w, f.marriage).confirmed);
  } finally {
    w.cleanup();
  }
});
