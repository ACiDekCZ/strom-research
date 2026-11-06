// Who reads a document and a source read again from its original (spec 059 K2.1, K2.2, K3.1, K3.2): each reader with
// its own agent, model and effort (--model, --effort, --blind-…), said in the result (readers.who) and kept on the
// reading; strom document read --source S… reads the record of a source again from its original here — never from its
// transcript — keeps the new reading beside the source and holds it against the transcript: alike, or a task where they
// differ; nothing of the source changes (its transcript, who read it, the user's confirmation of spec 022).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World } from "../helpers.ts";
import { opts, world } from "./excerpts.helpers.ts";
import { now, Tree } from "../../src/core/tree.ts";
import { readersOf } from "../../src/core/review.ts";
import { confirmedOn, transcriptMark } from "../../src/core/readers.ts";
import { clipMark } from "../../src/core/excerpt.ts";
import { compareWithSource, joinedClips } from "../../src/core/sourceread.ts";
import { parseDocReport } from "../../src/core/document.ts";
import type { Source, Task } from "../../src/core/model.ts";

// a reader that says who it read as, and writes the report it is given
const READER = `import fs from "node:fs";
const p = process.env.STROM_PROMPT ?? "";
const report = /Write your report to (.+) AS YOU GO/.exec(p)[1];
const blind = p.includes("This is a BLIND reading");
const body = fs.readFileSync(blind ? process.env.DOC_BLIND : process.env.DOC_FIRST, "utf8");
const was = fs.readFileSync(report, "utf8");
fs.writeFileSync(report, was.replace("<!-- next block -->", body.trim() + "\\n<!-- next block -->"));
fs.appendFileSync(process.env.DOC_WHO, [blind ? "blind" : "first", process.env.STROM_RUNNER_MODEL ?? "-", process.env.STROM_RUNNER_EFFORT ?? "-", p.includes(process.env.DOC_SECRET ?? "\\u0000") ? "saw-transcript" : "no-transcript"].join(" ") + "\\n");
console.log("cost: 0.10");
`;

const entry = (transcript: string) => `## Document
kind: register.baptism
language: cs
legible: yes

## Entry e1 · page 1
transcript: ${transcript}
person: p1 | child | dítě | written=Vojtěch | given=Vojtěch | sex=M
event: BAPM | date=1850 | place=Lhota | persons=p1:principal

done: 1 entries`;

const TEXT = "Křest Vojtěcha Lhotáka, syn Jiřího a Ludmily".normalize("NFD");

async function setUp(): Promise<{ w: World; dir: string; who: () => string[] }> {
  const w = await world();
  await w.ok(["person", "add", "Vojtěch /Lhoták/", "--sex", "M"]);
  const dir = path.join(w.dir, "čtenáři ř");
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, "reader.mjs"), READER);
  fs.writeFileSync(path.join(dir, "first.md"), entry(TEXT.normalize("NFC")));
  fs.writeFileSync(path.join(dir, "blind.md"), entry(TEXT.normalize("NFC")));
  const log = path.join(dir, "who.log");
  Object.assign(w.env, { STROM_RUNNER_SCRIPT: path.join(dir, "reader.mjs"), DOC_FIRST: path.join(dir, "first.md"), DOC_BLIND: path.join(dir, "blind.md"), DOC_WHO: log, STROM_NO_CONVERT: "1" });
  return { w, dir, who: () => (fs.existsSync(log) ? fs.readFileSync(log, "utf8").trim().split("\n").sort() : []) };
}

/** The transcript of a source as the research read it (a session's edit: a reader of a model nobody recorded). */
function readByResearch(w: World, id: string, transcript: string): void {
  const tree = Tree.open(w.cwd, w.env);
  tree.actor = "N0001";
  tree.withTreeLock(() => {
    tree.put({ ...tree.get<Source>(id)!, transcript: transcript.normalize("NFC"), updated: now() }, { op: "source.edit", targets: [id], summary: `${id} read by the research` });
    tree.commit(`${id} read by the research`);
  });
}

const src = (w: World, id: string) => Tree.open(w.cwd, w.env).get<Source>(id)!;

test("K2.1, K2.2: each reader reads with its own model and effort, the result and the reading say who read; a reader not offered is refused before anything", opts, async () => {
  const { w, who } = await setUp();
  try {
    const page = path.join(w.dir, "kniha", "s0001.jpg");
    const d = (await w.ok(["document", "read", "M0001", "--readers", "2", "--agent", "script", "--model", "model-á", "--effort", "high", "--blind-model", "model-б", "--blind-effort", "low", "--region", "0.1,0.1,0.8,0.5", "--json"])).json;
    assert.equal(d.state, "done", JSON.stringify(d.checks));
    assert.deepEqual(who(), ["blind model-б low no-transcript", "first model-á high no-transcript"], "each reader started as asked");
    assert.deepEqual(d.readers.who, [
      { agent: "script", model: "model-á", effort: "high" },
      { agent: "script", model: "model-б", effort: "low" },
    ]);
    // kept on the reading: shown again from its state, and in its result file
    assert.deepEqual((await w.ok(["document", "show", d.id, "--json"])).json.readers.who, d.readers.who);
    // the text says it too: each reader's agent · model · effort, the blind one so said
    const shown = (await w.ok(["document", "show", d.id])).out;
    assert.match(shown, /^who: script · model-á · high \/ script · model-б · low \(blind\)$/mu, shown);
    assert.doesNotMatch(shown, /^source:/mu, "no source read again");
    const kept = JSON.parse(fs.readFileSync(path.join(w.cwd, "notes", "readings", `${d.id}.json`), "utf8"));
    assert.deepEqual(kept.readers.who, d.readers.who);
    // none chosen: as the research's settings say (the agent's own model and effort here)
    const plain = (await w.ok(["document", "read", page, "--region", "0.1,0.1,0.8,0.5", "--agent", "script", "--json"])).json;
    assert.deepEqual(plain.readers.who, [{ agent: "script" }]);
    assert.match((await w.ok(["document", "show", plain.id])).out, /^who: script$/mu);
    // a reader of no agent strom has: refused, nothing read
    const before = fs.readdirSync(path.join(w.cwd, ".strom", "reads")).length;
    const bad = await w.run(["document", "read", "M0001", "--readers", "2", "--agent", "script", "--blind-agent", "nikdo-ž", "--json"]);
    assert.equal(bad.code, 2);
    assert.deepEqual([bad.json.code, bad.json.params], ["read.with", { at: "1", field: "agent" }]);
    assert.equal(fs.readdirSync(path.join(w.cwd, ".strom", "reads")).length, before);
    // again with another blind reader: the first as it read, the blind one as asked now
    const again = (await w.ok(["document", "again", plain.id, "--readers", "2", "--agent", "script", "--blind-model", "model-c", "--json"])).json;
    assert.deepEqual(again.readers.who, [{ agent: "script" }, { agent: "script", model: "model-c" }]);
  } finally {
    w.cleanup();
  }
});

test("K3.1, K3.2: a source read again from its original — never from its transcript; alike, or a task where they differ; the source, its readers and the user's confirmation stay", opts, async () => {
  const { w, dir, who } = await setUp();
  try {
    await w.ok(["source", "add", "Křest Vojtěcha Lhotáka 1850", "--kind", "baptism", "--recordset", "B1", "--clip", "B1:2@0.1,0.2,0.5,0.1"]); // S0001
    readByResearch(w, "S0001", TEXT);
    const cyr = "Войтех Лхотак, сын Иржи";
    await w.ok(["source", "add", "Křest Jiřího Lhotáka 1822", "--kind", "baptism", "--recordset", "B1", "--clip", "B1:3@0.1,0.3,0.6,0.1", "--clip", "B1:1@0.1,0.1,0.5,0.2", "--transcript", cyr]); // S0002
    await w.ok(["source", "add", "Oddací kniha Lhota", "--kind", "marriage", "--recordset", "B1", "--clip", "B1:1@0.1,0.1,0.5,0.2"]); // S0003: no transcript
    await w.ok(["source", "add", "Vzpomínka tety Lhotákové", "--kind", "baptism", "--transcript", "Vojtěch se narodil v Lhotě."]); // S0004: no image
    // the user confirmed the transcript of S0001 in the Strom app (spec 022)
    await w.ok(["source", "confirm", "S0001", "--txt", transcriptMark(TEXT.normalize("NFC"))], { env: { STROM_FOR_APP: "1" } });
    const readBefore = readersOf(Tree.open(w.cwd, w.env));
    const s1 = src(w, "S0001");
    assert.ok(confirmedOn(s1));
    w.env.DOC_SECRET = "Ludmily";

    // alike: kept beside the source, nothing else of it changed, no task
    const same = (await w.ok(["document", "read", "--source", "S0001", "--readers", "2", "--agent", "script", "--json"])).json;
    assert.equal(same.state, "done", JSON.stringify(same.checks));
    assert.deepEqual(same.source, { id: "S0001", agree: "same", variants: [] });
    const sameText = (await w.ok(["document", "show", same.id])).out;
    assert.match(sameText, /^source: S0001 read again from its original — alike its transcript$/mu, sameText);
    assert.match(sameText, /^next: .*alike its transcript — nothing to record, no new source of it$/mu);
    assert.doesNotMatch(sameText, /record a source as usual/u);
    assert.equal(same.pages.length, 1);
    assert.equal(same.pages[0].file, "M0002", "the clip's image");
    assert.ok(same.pages[0].region, "only the clip read, with its margin");
    assert.deepEqual(who().map((l) => l.split(" ").at(-1)), ["no-transcript", "no-transcript"], "the readers never shown the transcript");
    const s1After = src(w, "S0001");
    assert.deepEqual(s1After.readings, [same.id]);
    assert.equal(s1After.transcript, s1.transcript);
    assert.deepEqual(s1After.read, s1.read, "the user's confirmation stays");
    assert.ok(confirmedOn(s1After));

    // differs: a task holds the two against each other, the transcript stays as it was
    fs.writeFileSync(path.join(dir, "first.md"), entry("Войтех Лготак, сын Иржи"));
    fs.writeFileSync(path.join(dir, "blind.md"), entry("Войтех Лготак, сын Иржи"));
    const clip = clipMark(src(w, "S0002").clips![0]!);
    const differRun = await w.ok(["document", "read", "--source", "S0002", "--clip", clip, "--agent", "script", "--model", "model-c", "--effort", "medium"]);
    const differ = (await w.ok(["document", "show", /^(D\S+) ·/mu.exec(differRun.out)![1]!, "--json"])).json;
    // the text of the reading itself: who read, the source, what differs and its task; next: the task, never a new source
    const text = differRun.out;
    assert.match(text, /^who: script · model-c · medium$/mu, text);
    assert.ok(text.includes(`source: S0002 (excerpt ${clip}) read again from its original — differs from its transcript (transcript / reading: "Лхотак," / "Лготак,") → task ${differ.source.task}`), text);
    assert.match(text, new RegExp(`^next: strom task show ${differ.source.task} — .*no new source of it$`, "mu"));
    assert.doesNotMatch(text, /record a source as usual/u);
    assert.equal(differ.source.agree, "differ");
    assert.deepEqual(differ.source.variants, [{ at: "Лхотак,", other: "Лготак," }]);
    assert.equal(differ.pages.length, 1, "one excerpt alone");
    const task = Tree.open(w.cwd, w.env).get<Task>(differ.source.task)!;
    assert.equal(task.level, "verify");
    assert.deepEqual(task.subject, ["S0002"]);
    assert.match(task.what, new RegExp(differ.id, "u"));
    assert.match(task.why, /Лхотак/u);
    assert.equal(src(w, "S0002").transcript, cyr);
    // who read the sources: as before (a reading again is no edit of a source)
    const readAfter = readersOf(Tree.open(w.cwd, w.env));
    for (const id of ["S0001", "S0002"]) assert.deepEqual(readAfter.get(id), readBefore.get(id), id);
    assert.equal((await w.run(["check"])).code, 0);

    // refusals, nothing read
    const no = async (args: string[], code: string) => {
      const r = await w.run(["document", "read", ...args, "--agent", "script", "--json"]);
      assert.notEqual(r.code, 0, args.join(" "));
      assert.equal(r.json.code, code, args.join(" "));
    };
    await no(["--source", "S0099"], "read.source.none");
    await no(["--source", "P0001"], "read.source.none");
    await no(["--source", "S0003"], "read.source.notext");
    await no(["--source", "S0004"], "read.source.noscan");
    await no(["--source", "S0001", "--clip", "c0000000000"], "read.source.noscan");
    const queued = (await w.ok(["document", "read", "--source", "S0001", "--agent", "script", "--queue", "--json"])).json;
    const busy = await w.run(["document", "read", "--source", "S0001", "--agent", "script", "--json"]);
    assert.deepEqual([busy.json.code, busy.json.params.read], ["read.source.running", queued.id]);
    assert.notEqual((await w.run(["document", "read", path.join(w.dir, "kniha", "s0001.jpg"), "--source", "S0001", "--json"])).code, 0);
  } finally {
    w.cleanup();
  }
});

test("K3.2: a new reading held against a transcript — any script, however composed", () => {
  const t = "Křest Vojtěcha Lhotáka".normalize("NFD");
  const r = (x: string) => ({ entries: [{ transcript: x }] }) as never;
  assert.deepEqual(compareWithSource({ transcript: t }, r("Křest Vojtěcha Lhotáka".normalize("NFC"))), { agree: "same", variants: [] });
  assert.equal(compareWithSource({ transcript: "Войтех Лхотак" }, r("Войтех Лготак")).agree, "differ");
});

test("P3: words of the transcript outside the excerpt read (a heading above it, a word in its margin) are no place that differs", () => {
  // a reader's report as it is written (a made-up entry): its excerpt begins below the page's heading
  const read = parseDocReport(fs.readFileSync(path.join(import.meta.dirname, "..", "fixtures", "readings", "document-excerpt-reader.md"), "utf8"));
  assert.equal(read.entries.length, 1);
  const report = { entries: read.entries.map((e) => ({ transcript: e.transcript })) } as never;
  const clips = [{ media: "M0001", region: { x: 0.1, y: 0.5, w: 0.4, h: 0.2 } }];
  const transcript = "Anno 1801. Mense Majo. Die 3. P. Petr Lhoták Capl. Pavel Lhoták honestus juvenis fil. def. Jan Lhoták rustici de Lhota, cum sua honesta sponsa Anna fil. Matěj Brůža villici ibidem. Testes Jan Lhota et Petr Lhota ambo de Lhota";
  assert.deepEqual(compareWithSource({ transcript, clips }, report), { agree: "differ", variants: [{ at: "Brůža", other: "Brož[?]" }] });
  // its heading alone apart: alike; the same words read from the whole image (no excerpt) still differ
  const same = transcript.replace("Brůža", "Brož");
  assert.deepEqual(compareWithSource({ transcript: same, clips }, report), { agree: "same", variants: [] });
  assert.deepEqual(compareWithSource({ transcript: same }, report).variants, [{ at: "Anno 1801. Mense Majo.", other: "" }]);
  // a word the reader has alone at the end (the next entry in the margin) is outside too; one missing inside counts
  const r = (x: string) => ({ entries: [{ transcript: x }] }) as never;
  assert.equal(compareWithSource({ transcript: "Křest Vojtěcha Lhotáka", clips }, r("Křest Vojtěcha Lhotáka Die")).agree, "same");
  assert.deepEqual(compareWithSource({ transcript: "Křest Vojtěcha Lhotáka z Lhoty", clips }, r("Křest Lhotáka z Lhoty")).variants, [{ at: "Vojtěcha", other: "" }]);
  // both sides at the edge differ: read, never outside
  assert.deepEqual(compareWithSource({ transcript: "Войтех Лхотак", clips }, r("Войтех Лготак")).variants, [{ at: "Лхотак", other: "Лготак" }]);
});

test("P3: excerpts of one image that overlap or touch are read as one view; apart, or of other images, each its own", () => {
  const two = joinedClips([
    { media: "M0007", region: { x: 0.027, y: 0.727, w: 0.445, h: 0.145 } },
    { media: "M0007", region: { x: 0.051, y: 0.771, w: 0.318, h: 0.168 } },
  ]);
  assert.equal(two.length, 1);
  const [x, y, w, h] = two[0]!.region;
  assert.ok(x <= 0.027 && y <= 0.727 && x + w >= 0.472 && y + h >= 0.939 && y + h <= 1, String(two[0]!.region));
  // apart on the page, another image, and one that joins the first two only through a third: as they fall
  const many = joinedClips([
    { media: "M0001", region: { x: 0.1, y: 0.1, w: 0.3, h: 0.1 } },
    { media: "M0001", region: { x: 0.1, y: 0.6, w: 0.3, h: 0.1 } },
    { media: "M0002", region: { x: 0.1, y: 0.1, w: 0.3, h: 0.1 } },
    { media: "M0001", region: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 } },
  ]);
  assert.deepEqual(many.map((v) => v.media), ["M0001", "M0002"]);
  assert.deepEqual(joinedClips([
    { media: "M0001", region: { x: 0.1, y: 0.1, w: 0.3, h: 0.1 } },
    { media: "M0001", region: { x: 0.1, y: 0.6, w: 0.3, h: 0.1 } },
  ]).length, 2);
});
