// strom fixes new-model: another agent or model reads now than the one that read earlier — the earlier readings where
// something stayed open (places not read, blind readers who differed, an open conflict, a document never confirmed at
// the source) are offered to be read again with it, found free from the research's own data, the model of each from
// its report's head, else this computer's records of its readers, else unknown (then only with places not read).
// Asked once for each agent and model; read again beside the earlier one, a difference a task; nothing overwritten.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { encodeImage } from "../../src/image/index.ts";
import { halves, jpegWithOrientation } from "../image-samples.ts";
import { byReading, headKey, readingStage, stagesOf, useStage, type FixItem } from "../../src/commands/fixchecks.ts";
import { sameLineNewer } from "../../src/agents/models.ts";

const opts = { skip: !hasGit };

/** Images 1–3 of B0001 (M0001–M0003), the script agent reading. */
async function world(): Promise<World> {
  const w = new World();
  await w.withTree();
  w.env.STROM_AGENT = "script";
  await w.ok(["recordset", "add", "Kniha křtů 1840–1860", "--kinds", "baptism"]);
  const dir = path.join(w.dir, "skeny");
  fs.mkdirSync(dir);
  for (const [i, grey] of [[1, 200], [2, 180], [3, 160]] as const)
    fs.writeFileSync(path.join(dir, `s000${i}.jpg`), encodeImage({ width: 400, height: 300, channels: 3, data: new Uint8Array(400 * 300 * 3).fill(grey) }, "jpeg"));
  await w.ok(["media", "add", dir, "--recordset", "B1"]);
  return w;
}

const append = (file: string, rec: object) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(rec) + "\n");
};

/**
 * A reading of one image as strom keeps it: its report (with the head strom writes since 1.19.0 when `head` names a
 * model, else none) and, when `model` is given, its reader in this computer's records — `ago` minutes back.
 */
function reading(w: World, o: { k: number; media: string; text: string; ago: number; model?: string; head?: string; blind?: boolean }): string {
  const at = new Date(Date.now() - o.ago * 60_000).toISOString();
  const stem = `${at.slice(0, 10)}-${o.media}-${o.k}`;
  const dir = path.join(w.cwd, "notes", "readings");
  fs.mkdirSync(dir, { recursive: true });
  const head = o.head ? `Strom: 1.19.0\nAgent: script\nModel: ${o.head}\nImages: ${o.media}\n` : "";
  fs.writeFileSync(
    path.join(dir, `${stem}-1.md`),
    `# Reading ${o.media} · batch 1 of 1\n${head}Question: Přepsat zápis celý; nejisté označit [?]\n${o.blind ? "Blind: yes\n" : ""}\n## Image 1 · ${o.media}\nresult: found\nentries:\n- ${o.text}\n`,
  );
  if (o.model) append(path.join(w.cwd, ".strom", "metrics", "readers.jsonl"), { reader: `read-${stem}-1`, kind: "read", agent: "script", model: o.model, outcome: "ok", images: 1, wallMs: 30_000, ms: 30_000, at });
  return stem;
}

const READER = 'const p = process.env.STROM_PROMPT ?? "";\nfor (const m of p.matchAll(/^- (M\\d{4}) · image (\\d+)/gm)) console.log("## Image " + m[2] + " · " + m[1] + "\\nresult: found\\nentries:\\n- Jan Novák, Marie Dvořáková, Ялта, 1846\\n");\n';

test("strom fixes new-model: the earlier readings left open by another model, said with both models; once for each model", opts, async () => {
  const w = await world();
  try {
    // by m-old: one with places not read (NFD), one read whole; by a model nobody recorded: one with a place not read,
    // one read whole (never offered: nothing says its model differs)
    const open = reading(w, { k: 1, media: "M0001", text: "Jan Novák [?], Ялта [?]", ago: 60, model: "m-old" });
    reading(w, { k: 2, media: "M0002", text: "Josef Dvořák, 1846", ago: 50, model: "m-old" });
    const unknown = reading(w, { k: 3, media: "M0003", text: "Marie [?]", ago: 40 });
    reading(w, { k: 4, media: "M0003", text: "Marie Horáková", ago: 30 });

    // the model now is the one that read: nothing to offer
    w.env.STROM_MODEL_VISION = "m-old";
    let c = (await w.ok(["fixes", "--json"])).json.checks.find((x: { id: string }) => x.id === "new-model");
    assert.equal(c.state, "nothing");
    assert.equal(c.models, undefined);

    // another model: the readings left open, the one of an unknown model only for its place not read
    w.env.STROM_MODEL_VISION = "m-new";
    c = (await w.ok(["fixes", "--json"])).json.checks.find((x: { id: string }) => x.id === "new-model");
    assert.equal(c.state, "pending");
    assert.equal(c.key, "new-model:script m-new");
    assert.equal(c.found.count, 2);
    assert.deepEqual(c.models, { now: "script m-new", before: [{ key: "script m-old", readings: 1 }, { key: "unknown", readings: 1 }], newer: false });
    assert.deepEqual(
      c.items.map((i: { reading: string; before: string; unclear: number }) => [i.reading, i.before, i.unclear]),
      [
        [open, "script m-old", 2],
        [unknown, "unknown", 1],
      ],
    );
    assert.equal(c.estimate.calls, 2);

    // what it is in the research language: both models, never which reads better
    const show = await w.ok(["fixes", "show", "new-model", "--lang", "cs"]);
    assert.match(show.out, /Dřívější čtení jiným modelem — 2 čtení čekají na rozhodnutí/);
    assert.match(show.out, /Dřívější čtení jsou z modelu .*m-old \(1 čtení\), model neznámý \(1 čtení\); teď se čte modelem .*m-new\. /);
    assert.match(show.out, /Nalezeno: 2 čtení \(2 místa\) — 2 s nepřečtenými místy/);
    assert.match(show.out, new RegExp(`${open} · M0001 \\(B0001:1\\) · .*m-old · dříve 2 nejistá místa`));
    assert.match(show.out, new RegExp(`${unknown} · M0003 \\(B0001:3\\) · model neznámý · dříve 1 nejisté místo`));
    assert.match(show.out, /Nic se nepřepíše ani nesmaže/);
    assert.match(show.out, /Náročnost: levné · 2 volání čtenáře/);
    assert.doesNotMatch(show.out, /\b(vy|váš|vaše|ty)\b/iu);
    // the doctor and the menu say it in readings
    const doctor = (await w.run(["doctor", "--json", "--lang", "en"])).json.checks.find((x: { name: string }) => x.name === "fixes");
    assert.equal(doctor.status, "warn");
    assert.match(doctor.detail, /Earlier readings by another model: 2 readings wait/);
    assert.equal(doctor.fix, "strom fixes show new-model");

    // left as it is for m-new: kept under the pair, another model later asked again
    await w.ok(["fixes", "decline", "new-model"], { tty: true });
    const kept = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).fixes;
    assert.equal(kept["new-model:script m-new"].decision, "declined");
    assert.equal(kept["new-model"], undefined);
    assert.equal((await w.ok(["fixes", "--json"])).json.checks.find((x: { id: string }) => x.id === "new-model").state, "declined");
    w.env.STROM_MODEL_VISION = "m-next";
    assert.equal((await w.ok(["fixes", "--json"])).json.checks.find((x: { id: string }) => x.id === "new-model").state, "pending");

    // read again with the model now since (its head says so): set right already, not offered
    reading(w, { k: 5, media: "M0001", text: "Jan Novák, Ялта", ago: 10, head: "m-next" });
    c = (await w.ok(["fixes", "--json"])).json.checks.find((x: { id: string }) => x.id === "new-model");
    assert.deepEqual(c.items.map((i: { reading: string }) => i.reading), [unknown]);
  } finally {
    w.cleanup();
  }
});

test("strom fixes new-model: an alias nobody saw run here is not another model; a newer version of a line is said so", opts, async () => {
  const w = await world();
  try {
    reading(w, { k: 1, media: "M0001", text: "Jan [?]", ago: 60, head: "claude-opus-4-7" });
    // the agent's alias, never seen run here: a reading by a model of it may be the model now
    w.env.STROM_MODEL_VISION = "opus";
    assert.equal((await w.ok(["fixes", "--json"])).json.checks.find((x: { id: string }) => x.id === "new-model").state, "nothing");
    // a newer version of the same line: offered, and said so; another line: offered, never called newer
    w.env.STROM_MODEL_VISION = "claude-opus-5-5";
    let c = (await w.ok(["fixes", "--json"])).json.checks.find((x: { id: string }) => x.id === "new-model");
    assert.equal(c.models.newer, true);
    assert.match((await w.ok(["fixes", "show", "new-model", "--lang", "en"])).out, /now .*claude-opus-5-5 reads — a newer version of the same line\./);
    w.env.STROM_MODEL_VISION = "sonnet-x";
    c = (await w.ok(["fixes", "--json"])).json.checks.find((x: { id: string }) => x.id === "new-model");
    assert.equal(c.state, "pending");
    assert.equal(c.models.newer, false);
  } finally {
    w.cleanup();
  }
});

test("strom fixes new-model: readings of no recorded model alone are never said to be of an older model", opts, async () => {
  const w = await world();
  try {
    reading(w, { k: 1, media: "M0001", text: "Jan [?]", ago: 60 });
    // a model it read with is known here (another reading), so the one now is not the first
    reading(w, { k: 2, media: "M0002", text: "Josef Dvořák", ago: 50, model: "m-old" });
    w.env.STROM_MODEL_VISION = "m-old-2";
    const c = (await w.ok(["fixes", "--json"])).json.checks.find((x: { id: string }) => x.id === "new-model");
    assert.equal(c.state, "pending");
    assert.deepEqual(c.models.before, [{ key: "unknown", readings: 1 }]);
    assert.equal(c.models.newer, false);
  } finally {
    w.cleanup();
  }
});

test("strom fixes run new-model: a reading read again with the model now beside the earlier one, a task where it reads more", opts, async () => {
  const w = await world();
  try {
    const old = reading(w, { k: 1, media: "M0001", text: "Jan Novák [?], Ялта [?]", ago: 60, model: "m-old" });
    const before = fs.readFileSync(path.join(w.cwd, "notes", "readings", `${old}-1.md`), "utf8");
    w.env.STROM_RUNNER_SCRIPT = path.join(w.dir, "reader.mjs");
    fs.writeFileSync(w.env.STROM_RUNNER_SCRIPT, READER);
    w.env.STROM_MODEL_VISION = "m-new";
    // an agent never starts it
    assert.equal((await w.run(["fixes", "run", "new-model"], { env: { CLAUDECODE: "1" }, tty: true, answers: ["1"] })).code, 4);
    // a person: all of it (one)
    // who reads: the one now first, said to have read them before; another agent here recommended
    const r = await w.ok(["fixes", "run", "new-model", "--lang", "en"], { tty: true, answers: ["1", "1"] });
    assert.match(r.out, /^Read with\?\n {3}1 {2}script · m-new — cheap, about 1 min · read these before\n {3}2 {2}Claude Code · [^\n]* · recommended: another than read before\n/m);
    assert.match(r.out, /^Choose \[2\]/m);
    assert.match(r.out, /^Earlier readings were made by .*m-old \(1 reading\); now .*m-new reads\. /m);
    assert.match(r.out, /^Read again: 1 reading \(1 place\) — places the same 0, refined 1, different 0 · \d+ min/m);
    assert.match(r.out, /Set right: nothing of it waits\./);
    const tasks = (await w.ok(["task", "list", "--json"])).json.tasks.filter((t: { what: string }) => /by another model$/.test(t.what));
    assert.equal(tasks.length, 1);
    // the earlier reading as it was, the new one beside it with its head
    assert.equal(fs.readFileSync(path.join(w.cwd, "notes", "readings", `${old}-1.md`), "utf8"), before);
    const now = fs.readdirSync(path.join(w.cwd, "notes", "readings")).filter((f) => f.endsWith(".md") && f !== `${old}-1.md`);
    assert.equal(now.length, 1);
    assert.match(fs.readFileSync(path.join(w.cwd, "notes", "readings", now[0]!), "utf8"), /^Model: m-new$/m);
    const task = (await w.ok(["task", "show", tasks[0].id, "--json"])).json.task;
    assert.match(task.what, new RegExp(`${old} and the new .* by another model`));
    assert.match(task.why, /Read again by .*m-new \(earlier: .*m-old\) where something stayed open, and the new reading reads more or is surer\./);
    // set right for m-new: kept under the pair, nothing waits
    assert.equal(JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).fixes["new-model:script m-new"].decision, "fixed");
    assert.equal((await w.ok(["fixes", "--json"])).json.checks.find((x: { id: string }) => x.id === "new-model").state, "fixed");
  } finally {
    w.cleanup();
  }
});

const BATCH_READER = `import fs from "node:fs";
const p = process.env.STROM_PROMPT ?? "";
const report = /Write your report to (.+) AS YOU GO/.exec(p)[1];
for (const m of p.matchAll(/^- (M\\d{4}) · image (\\d+)/gm)) fs.appendFileSync(report, "\\n## Image " + m[2] + " · " + m[1] + "\\nresult: found\\nentries:\\n- Jan Novák, 1846\\n");
`;

test("strom fixes run new-model: the images of one earlier reading read again together, as one reading, its estimate one reader", opts, async () => {
  const w = await world();
  try {
    // one reading of three images by m-old, each with a place not read (one in NFD)
    const at = new Date(Date.now() - 60 * 60_000).toISOString();
    const stem = `${at.slice(0, 10)}-B0001-1-3`;
    const dir = path.join(w.cwd, "notes", "readings");
    fs.mkdirSync(dir, { recursive: true });
    const blocks = [1, 2, 3].map((k) => `## Image ${k} · M000${k}\nresult: found\nentries:\n- ${k === 2 ? "Jose\u0301f".normalize("NFD") : "Jan"} [?], 184${k}\n`).join("\n");
    fs.writeFileSync(path.join(dir, `${stem}-1.md`), `# Reading B0001 · batch 1 of 1\nQuestion: Přepsat zápis celý; nejisté označit [?]\n\n${blocks}`);
    append(path.join(w.cwd, ".strom", "metrics", "readers.jsonl"), { reader: `read-${stem}-1`, kind: "read", agent: "script", model: "m-old", outcome: "ok", images: 3, wallMs: 30_000, ms: 30_000, at });
    w.env.STROM_MODEL_VISION = "m-new";
    const c = (await w.ok(["fixes", "--json"])).json.checks.find((x: { id: string }) => x.id === "new-model");
    assert.equal(c.found.count, 3);
    assert.equal(c.found.readings, 1);
    assert.equal(c.estimate.calls, 1);
    // a reader of the batch: each of its images into its report, as it goes
    w.env.STROM_RUNNER_SCRIPT = path.join(w.dir, "reader.mjs");
    fs.writeFileSync(w.env.STROM_RUNNER_SCRIPT, BATCH_READER);
    const r = await w.ok(["fixes", "run", "new-model", "--agent", "script", "--lang", "en"], { tty: true, answers: ["1"] });
    assert.match(r.out, /^Reading again 1\/1: M0001 \(B0001:1\), M0002 \(B0001:2\) … \(3\)/m);
    assert.match(r.out, /^Found: 1 reading \(3 places\) — 1 with places not read$/m);
    assert.match(r.out, /^Earlier readings were made by script · m-old \(1 reading\)/m);
    assert.match(r.out, /^Read again: 1 reading \(3 places\) — places the same 0, refined 0, different 3 · /m);
    const now = fs.readdirSync(dir).filter((f) => f.endsWith(".md") && f !== `${stem}-1.md`);
    assert.equal(now.length, 1, now.join(", "));
    assert.equal(fs.readFileSync(path.join(dir, now[0]!), "utf8").match(/^## Image /gm)?.length, 3);
  } finally {
    w.cleanup();
  }
});

const DOC_READER = `import fs from "node:fs";
const p = process.env.STROM_PROMPT ?? "";
const report = /Write your report to (.+) AS YOU GO/.exec(p)[1];
const was = fs.readFileSync(report, "utf8");
fs.writeFileSync(report, was.replace("<!-- next block -->", fs.readFileSync(process.env.DOC_FIRST, "utf8").trim() + "\\n<!-- next block -->"));
console.log("cost: 0.25");
`;

const docReport = (surname: string) => `## Document
kind: register.baptism
language: la
script: kurrent
date: 1846
legible: yes

## Entry e1 · page 1
region: 0.05,0.30,0.90,0.20
transcript: 3. Aprilis 1846 | Joannes filius | Josephi ${surname} agricolae | in Ялта
person: p1 | child | dítě | written=Joannes | given=Jan | sex=M
person: p2 | father | otec | written=Josephi ${surname} | given=Josef | surname=Novák | sex=M
event: BAPM | date=3.4.1846 | place=Ялта | persons=p1:principal,p2:father
relation: parent p2 p1

## Context
context: Zápis křtu.

done: 1 entries`;

test("strom fixes new-model: a document read by another model with a place not read, read again as a new reading beside it", opts, async () => {
  const w = new World();
  await w.withTree();
  try {
    const dir = path.join(w.dir, "doklady ř");
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, "reader.mjs"), DOC_READER);
    fs.writeFileSync(path.join(dir, "first.md"), docReport("Nova\u0301k[?]"));
    const photo = path.join(dir, "křest.jpg");
    fs.writeFileSync(photo, jpegWithOrientation(halves(1600, 1200), 1));
    Object.assign(w.env, { STROM_AGENT: "script", STROM_RUNNER_SCRIPT: path.join(dir, "reader.mjs"), DOC_FIRST: path.join(dir, "first.md"), STROM_NO_CONVERT: "1", STROM_MODEL_VISION: "m-old" });
    const old = (await w.ok(["document", "read", photo, "--note", "list z matriky", "--json"])).json;
    assert.equal(old.state, "done");
    const kept = fs.readFileSync(path.join(w.cwd, "notes", "readings", `${old.id}.json`), "utf8");

    w.env.STROM_MODEL_VISION = "m-new";
    const c = (await w.ok(["fixes", "--json"])).json.checks.find((x: { id: string }) => x.id === "new-model");
    assert.equal(c.state, "pending");
    assert.equal(c.items.length, 1);
    assert.equal(c.items[0].reading, old.id);
    assert.equal(c.items[0].before, "script m-old");
    assert.deepEqual(c.items[0].reasons, ["unclear", "unconfirmed"]);
    assert.equal(c.items[0].document.note, "list z matriky");
    assert.match((await w.ok(["fixes", "show", "new-model", "--lang", "cs"])).out, /Nalezeno: 1 čtení \(1 místo\), z toho 1 dokument — 1 s nepřečtenými místy, 1 nepotvrzených u pramene/);

    // read again: a new reading of its own (never strom document again), the earlier one as it was
    fs.writeFileSync(path.join(dir, "first.md"), docReport("Novák"));
    const r = await w.ok(["fixes", "run", "new-model", "--lang", "en"], { tty: true, answers: ["1", "1"] });
    assert.match(r.out, /^Read again: 1 reading \(1 place\) — places the same 0, refined 1, different 0/m);
    assert.equal(fs.readFileSync(path.join(w.cwd, "notes", "readings", `${old.id}.json`), "utf8"), kept);
    const docs = (await w.ok(["document", "list", "--json"])).json;
    const all = (docs.readings ?? docs) as { id: string }[];
    assert.equal(all.length, 2);
    const task = (await w.ok(["task", "list", "--json"])).json.tasks.find((t: { what: string }) => t.what.includes(old.id));
    assert.ok(task, "a task to hold the two readings against each other");
    assert.equal((await w.ok(["fixes", "--json"])).json.checks.find((x: { id: string }) => x.id === "new-model").state, "fixed");
  } finally {
    w.cleanup();
  }
});

/** One earlier reading of three images (M0001–M0003) by m-old, each with `open` places not read (one in NFD). */
function batchReading(w: World, open: number, ago: number): string {
  const at = new Date(Date.now() - ago * 60_000).toISOString();
  const stem = `${at.slice(0, 10)}-B0001-1-3`;
  const dir = path.join(w.cwd, "notes", "readings");
  fs.mkdirSync(dir, { recursive: true });
  const blocks = [1, 2, 3].map((k) => `## Image ${k} · M000${k}\nresult: found\nentries:\n- ${k === 2 ? "Joséf".normalize("NFD") : "Jan"} ${"[?] ".repeat(open)}184${k}\n`).join("\n");
  fs.writeFileSync(path.join(dir, `${stem}-1.md`), `# Reading B0001 · batch 1 of 1\nQuestion: Přepsat zápis celý; nejisté označit [?]\n\n${blocks}`);
  append(path.join(w.cwd, ".strom", "metrics", "readers.jsonl"), { reader: `read-${stem}-1`, kind: "read", agent: "script", model: "m-old", outcome: "ok", images: 3, wallMs: 30_000, ms: 30_000, at });
  return stem;
}

test("strom fixes run: an agent that cannot read here is refused at once, with those that can, before anything is offered", opts, async () => {
  const w = await world();
  try {
    batchReading(w, 1, 60);
    w.env.STROM_MODEL_VISION = "m-new";
    w.env.STROM_RUNNER_SCRIPT = path.join(w.dir, "reader.mjs");
    fs.writeFileSync(w.env.STROM_RUNNER_SCRIPT, BATCH_READER);
    const dir = path.join(w.cwd, "notes", "readings");
    const before = fs.readdirSync(dir).length;
    // an agent strom does not know, and one whose CLI is not here (codex off the PATH)
    const cases: [string[], Record<string, string>, RegExp][] = [
      [["--agent", "nonexistent"], {}, /nonexistent cannot read here: strom reads with no agent "nonexistent"/],
      [["--agent", "codex"], { PATH: [path.dirname(process.execPath), "/usr/bin", "/bin"].join(path.delimiter) }, /codex cannot read here: codex is not installed here/],
      [["--agent", "codex", "--model", "gpt-9"], { PATH: [path.dirname(process.execPath), "/usr/bin", "/bin"].join(path.delimiter) }, /codex cannot read here/],
    ];
    for (const [flags, env, why] of cases) {
      const r = await w.run(["fixes", "run", "new-model", ...flags, "--lang", "en"], { env, tty: true, answers: ["1", "1", "1"] });
      assert.equal(r.code, 2, flags.join(" ") + "\n" + r.out + r.err);
      assert.match(r.err, why);
      assert.match(r.err, /ready to read here: [^\n]*script/);
      assert.doesNotMatch(r.out, /Try it|All:|Read again|Reading again/);
    }
    assert.equal(fs.readdirSync(dir).length, before, "nothing read");
    // what it would take, of an agent that cannot read: said at once too
    const show = await w.run(["fixes", "show", "new-model", "--agent", "nonexistent"]);
    assert.equal(show.code, 2);
    assert.match(show.err, /nonexistent cannot read here/);
    // a model named empty: a usage error
    assert.equal((await w.run(["fixes", "run", "new-model", "--model", " "], { tty: true })).code, 2);
  } finally {
    w.cleanup();
  }
});

test("strom fixes run: a trial and --first take whole readings — all the images of one, never a part; counts in readings with their places", opts, async () => {
  const w = await world();
  try {
    // one reading of three images (two places open each), one of one image (one open)
    const three = batchReading(w, 2, 60);
    const one = reading(w, { k: 1, media: "M0001", text: "Marie [?]", ago: 50, model: "m-old" });
    w.env.STROM_MODEL_VISION = "m-new";
    const c = (await w.ok(["fixes", "show", "new-model", "--json"])).json;
    assert.deepEqual([c.found.count, c.found.readings, c.estimate.calls], [4, 2, 2]);
    // one unit in the listing: readings, their places beside them, the estimate in reader calls
    const cs = (await w.ok(["fixes", "show", "new-model", "--lang", "cs"])).out;
    assert.match(cs, /— 2 čtení čekají na rozhodnutí/);
    assert.match(cs, /^Nalezeno: 2 čtení \(4 místa\) — 2 s nepřečtenými místy$/m);
    assert.match(cs, new RegExp(`^  ${three} · M0001 \\(B0001:1\\), M0002 \\(B0001:2\\) … \\(3\\) · .*m-old · dříve 6 nejistých míst$`, "m"));
    assert.match(cs, new RegExp(`^  ${one} · M0001 \\(B0001:1\\) · `, "m"));
    assert.match(cs, /^Náročnost: levné · 2 volání čtenáře · asi 1 min/m);
    w.env.STROM_RUNNER_SCRIPT = path.join(w.dir, "reader.mjs");
    fs.writeFileSync(w.env.STROM_RUNNER_SCRIPT, BATCH_READER);
    const dir = path.join(w.cwd, "notes", "readings");
    const fresh = () => fs.readdirSync(dir).filter((f) => f.endsWith(".md") && !f.startsWith(three) && !f.startsWith(one));
    // --first 1: the most promising reading whole, nothing else offered
    const first = await w.ok(["fixes", "run", "new-model", "--agent", "script", "--first", "1", "--lang", "en"], { tty: true, answers: [""] });
    assert.match(first.out, /1\s+All: 1 reading \(3 places\) — cheap, about \d+ min\n\s+2\s+No:/);
    assert.equal(fresh().length, 0);
    // a trial of one: the reading of three images whole, as one reading again
    const r = await w.ok(["fixes", "run", "new-model", "--agent", "script", "--try", "1", "--lang", "en"], { tty: true, answers: ["1", "0"] });
    assert.match(r.out, /1\s+Try it on the most promising first: 1 reading \(3 places\) — cheap, about \d+ min\n\s+2\s+All: 2 readings \(4 places\) — cheap, about \d+ min/);
    assert.match(r.out, /^Reading again 1\/1: M0001 \(B0001:1\), M0002 \(B0001:2\) … \(3\)/m);
    assert.match(r.out, /^Read again: 1 reading \(3 places\) — places the same 0, refined \d, different \d · /m);
    assert.match(r.out, /1\s+The remaining: 1 reading \(1 place\) — cheap/);
    assert.equal(fresh().length, 1, fresh().join(", "));
    assert.equal(fs.readFileSync(path.join(dir, fresh()[0]!), "utf8").match(/^## Image /gm)?.length, 3);
    // nothing of the reading read again waits (its M0001 now read by the model now, so the other one neither)
    const left = (await w.ok(["fixes", "--json"])).json.checks.find((x: { id: string }) => x.id === "new-model");
    assert.ok((left?.items ?? []).every((i: { reading: string }) => i.reading !== three), JSON.stringify(left?.items));
  } finally {
    w.cleanup();
  }
});

test("strom fixes new-model: by stage — the disputed alone offered first, said with what they would take; then the rest", opts, async () => {
  const w = await world();
  try {
    // blind readers who differed from the researcher's reading (M0001, M0002): disputed; places left open (M0003): the rest
    reading(w, { k: 1, media: "M0001", text: "Jan Novák", ago: 100, model: "m-old" });
    const d1 = reading(w, { k: 2, media: "M0001", text: "Václav Černý", ago: 90, model: "m-old", blind: true });
    reading(w, { k: 3, media: "M0002", text: "Josef Dvořák", ago: 80, model: "m-old" });
    const d2 = reading(w, { k: 4, media: "M0002", text: "Anna Svobodová, Ялта", ago: 70, model: "m-old", blind: true });
    const o1 = reading(w, { k: 5, media: "M0003", text: "Marie [?]", ago: 60, model: "m-old" });
    const o2 = reading(w, { k: 6, media: "M0003", text: "Petr [?]", ago: 50, model: "m-old" });
    w.env.STROM_MODEL_VISION = "m-new";
    const c = (await w.ok(["fixes", "show", "new-model", "--json"])).json;
    assert.deepEqual(c.stages, { disputed: 2, direct: 2, all: 4 });
    assert.deepEqual(c.items.map((i: { reading: string }) => i.reading).slice(0, 2).sort(), [d1, d2].sort());
    const cs = (await w.ok(["fixes", "show", "new-model", "--lang", "cs"])).out;
    assert.match(cs, /^Jen sporná \(rozchod slepých čtenářů, otevřený rozpor, nepotvrzené u pramene\): 2 čtení \(2 místa\) · levné · 2 volání čtenáře · asi 1 min$/m);
    assert.doesNotMatch(cs, /Sporná a přímá linie/, "no more of the direct line than disputed");
    w.env.STROM_RUNNER_SCRIPT = path.join(w.dir, "reader.mjs");
    fs.writeFileSync(w.env.STROM_RUNNER_SCRIPT, READER);
    const r = await w.ok(["fixes", "run", "new-model", "--agent", "script", "--try", "1", "--lang", "en"], { tty: true, answers: ["2", "0"] });
    assert.match(r.out, /1\s+Try it on the most promising first: 1 reading \(1 place\)[^\n]*\n\s+2\s+The disputed alone: 2 readings \(2 places\)[^\n]*\n\s+3\s+All: 4 readings \(4 places\)[^\n]*\n\s+4\s+No:/);
    assert.match(r.out, /^Read again: 2 readings \(2 places\) — /m);
    assert.match(r.out, /1\s+More first: 1 reading \(1 place\)[^\n]*\n\s+2\s+The remaining: 2 readings \(2 places\)/);
    const left = (await w.ok(["fixes", "--json"])).json.checks.find((x: { id: string }) => x.id === "new-model");
    assert.deepEqual(left.items.map((i: { reading: string }) => i.reading).sort(), [o1, o2].sort());
  } finally {
    w.cleanup();
  }
});

test("useStage, byReading, stagesOf: disputed (differ, conflict, unconfirmed), the direct line, the rest; dates only order; a reading by its best place", () => {
  const item = (reading: string, k: number, o: Partial<FixItem> = {}): FixItem => ({ key: `${reading}|M000${k}|`, reading, media: `M000${k}`, question: "", blind: false, estimated: false, sources: [], unclear: 0, ...o });
  assert.equal(useStage(item("a", 1, { reasons: ["unconfirmed"] })), 1);
  assert.equal(useStage(item("a", 1, { reasons: ["differ"] })), 1);
  assert.equal(useStage(item("a", 1, { reasons: ["conflict"], direct: true })), 1);
  assert.equal(useStage(item("a", 1, { reasons: ["unclear"], direct: true })), 2);
  assert.equal(useStage(item("a", 1, { reasons: ["unclear"], facts: true, unclear: 3 })), 3, "dates and witnesses are no stage");
  const items = [
    item("x", 1, { reasons: ["unclear"], unclear: 1 }),
    item("y", 1, { reasons: ["unclear"], facts: true, unclear: 1 }),
    item("z", 2, { reasons: ["unclear"], direct: true, unclear: 1 }),
    item("x", 2, { reasons: ["unclear", "differ"], unclear: 1 }),
  ];
  const groups = byReading(items);
  assert.deepEqual(groups.map((g) => [g[0]!.reading, g.length]), [["x", 2], ["z", 1], ["y", 1]]);
  assert.deepEqual(groups.map(readingStage), [1, 2, 3]);
  assert.deepEqual(stagesOf(groups), { disputed: 1, direct: 2, all: 3 });
});

test("headKey: the agent and model of a report's head; default is the agent's own; none without a head", () => {
  assert.equal(headKey("Strom: 1.19.0\nAgent: claude\nModel: claude-opus-5-5[1m]\nImages: M0001\n", {}), "claude claude-opus-5-5");
  assert.equal(headKey("Strom: 1.19.0\nAgent: codex\nModel: default\n", {}), "codex");
  assert.equal(headKey("# Reading M0001\nQuestion: x\n", {}), undefined);
});

test("sameLineNewer: a newer version of the same line only, never across lines", () => {
  assert.equal(sameLineNewer("claude-opus-4-7", "claude-opus-5-5"), true);
  assert.equal(sameLineNewer("claude-opus-5-5", "claude-opus-4-7"), false);
  assert.equal(sameLineNewer("claude-sonnet-5-5", "claude-opus-5-5"), false);
  assert.equal(sameLineNewer("grok-4.6-build", "grok-4.7-build"), true);
  assert.equal(sameLineNewer("m-old", "m-new"), false);
});
