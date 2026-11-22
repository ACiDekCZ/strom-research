// A reading service as a reader (spec 125 K1.1–K1.3): the contract of a provider of reading (core/readprovider.ts),
// the fake service of the tests (STROM_READ_FAKE) — the blind second reader of a document, a source read again by it
// alone — what it read written as a reader's report of today's form, its lines beside it, compared with the first
// reader on the transcript alone, held against the source's transcript, its credits said; never the first reader of
// a document, never offered to the Strom app; a reading without a service has none of the new fields.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World } from "../helpers.ts";
import { opts, world } from "./excerpts.helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { Settings } from "../../src/core/config.ts";
import { readChoices } from "../../src/core/readchoice.ts";
import { parseDocReport } from "../../src/core/document.ts";
import { parseReply, readProvider, readProviders, requestLine } from "../../src/core/readprovider.ts";
import type { Source } from "../../src/core/model.ts";

// the agent reader of the tests: writes the report it is given (as test/cli/document-who.test.ts)
const READER = `import fs from "node:fs";
const p = process.env.STROM_PROMPT ?? "";
const report = /Write your report to (.+) AS YOU GO/.exec(p)[1];
const was = fs.readFileSync(report, "utf8");
fs.writeFileSync(report, was.replace("<!-- next block -->", fs.readFileSync(process.env.DOC_FIRST, "utf8").trim() + "\\n<!-- next block -->"));
console.log("cost: 0.10");
`;

const entry = (transcript: string) => `## Document
kind: register.baptism
language: cs
legible: yes

## Entry e1 · page 1
transcript: ${transcript}
person: p1 | child | dítě | written=Vojtěcha | given=Vojtěch | sex=M
event: BAPM | date=1850 | place=Lhota | persons=p1:principal

done: 1 entries`;

const TEXT = "Křest Vojtěcha Lhotáka, syn Jiřího a Ludmily";

/** A service's reply (JSON lines): the lines given NFD, as a service may send them; then its end. */
const reply = (lines: { text: string; box?: number[]; confidence?: number; block?: number }[], done: Record<string, unknown> = {}) =>
  [...lines.map((l) => JSON.stringify({ line: { ...l, text: l.text.normalize("NFD") } })), JSON.stringify({ done })].join("\n") + "\n";

async function setUp(): Promise<{ w: World; dir: string; asked: () => Record<string, any>[] }> {
  const w = await world();
  await w.ok(["person", "add", "Vojtěch /Lhoták/", "--sex", "M"]);
  const dir = path.join(w.dir, "služba ж");
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, "reader.mjs"), READER);
  fs.writeFileSync(path.join(dir, "first.md"), entry(TEXT));
  fs.writeFileSync(path.join(dir, "reply.jsonl"), reply([
    { text: "Křest Vojtěcha Lhotáka,", box: [0.1, 0.2, 0.8, 0.1], confidence: 0.97 },
    { text: "syn Jiřího a Ludmily", box: [0.1, 0.3, 0.6, 0.1], confidence: 0.91 },
  ], { model: "model-ř", cost: { amount: 2, unit: "credits" } }));
  const log = path.join(dir, "asked.jsonl");
  Object.assign(w.env, { STROM_RUNNER_SCRIPT: path.join(dir, "reader.mjs"), DOC_FIRST: path.join(dir, "first.md"), STROM_READ_FAKE: path.join(dir, "reply.jsonl"), STROM_READ_FAKE_LOG: log, STROM_NO_CONVERT: "1" });
  return { w, dir, asked: () => (fs.existsSync(log) ? fs.readFileSync(log, "utf8").trim().split("\n").map((l) => JSON.parse(l)) : []) };
}

const src = (w: World, id: string) => Tree.open(w.cwd, w.env).get<Source>(id)!;
const strip = (who: { state?: string; secs?: number }[]) => who.map(({ state: _s, secs: _t, ...r }) => r);

test("K1.3: the blind second reader a reading service — its report of today's form, its lines beside it, compared on the transcript alone, its credits said and measured", opts, async () => {
  const { w, asked } = await setUp();
  try {
    const d = (await w.ok(["document", "read", "M0001", "--readers", "2", "--agent", "script", "--blind-agent", "fake", "--region", "0.1,0.1,0.8,0.5", "--json"])).json;
    assert.equal(d.state, "done", JSON.stringify(d));
    assert.deepEqual(strip(d.readers.who), [{ agent: "script" }, { agent: "fake", kind: "service", credits: 2 }]);
    // alike on the transcript (NFD from the service kept NFC), no person or event of the service held against the first reader's
    assert.equal(d.readers.agree, "same", JSON.stringify(d.entries[0].variants));
    assert.equal(d.blind.entries[0].transcript, "Křest Vojtěcha Lhotáka, | syn Jiřího a Ludmily", "where its lines end");
    assert.equal(d.entries[0].persons.length, 1, "the people are the first reader's");
    assert.deepEqual(d.cost, { amount: 0.1, currency: "USD", credits: 2 }, "the dollars of the agent, the credits of the service — not 'at least'");
    // its report: today's form, the transcript alone, parsed as any reader's
    const report = path.join(w.cwd, "notes", "readings", `${d.id}-2.md`);
    const rep = parseDocReport(fs.readFileSync(report, "utf8"));
    assert.equal(rep.done, true);
    assert.deepEqual([rep.doc.legible, rep.entries.length, rep.entries[0]!.transcript, rep.entries[0]!.persons.length], ["yes", 1, `Křest Vojtěcha Lhotáka, | syn Jiřího a Ludmily`, 0]);
    // its lines beside it: of the whole page (the region read 0.1,0.1,0.8,0.5), committed with the reading
    const lines = JSON.parse(fs.readFileSync(path.join(w.cwd, "notes", "readings", `${d.id}-2.lines.json`), "utf8"));
    assert.deepEqual(lines.pages, [{ page: 1, lines: [{ text: "Křest Vojtěcha Lhotáka,", box: [0.18, 0.2, 0.64, 0.05], confidence: 0.97 }, { text: "syn Jiřího a Ludmily", box: [0.18, 0.25, 0.48, 0.05], confidence: 0.91 }] }]);
    assert.deepEqual([lines.provider, lines.kind, lines.model], ["fake", "service", "model-ř"]);
    const tracked = execFileSync("git", ["ls-files", "notes/readings"], { cwd: w.cwd, encoding: "utf8" });
    assert.match(tracked, new RegExp(`${d.id}-2\\.lines\\.json`, "u"));
    assert.doesNotMatch(tracked, new RegExp(`${d.id}-1\\.lines\\.json`, "u"), "no lines of the agent reader");
    // what it was given: one image in its own work folder, protocol 1, nothing of a source (none read again)
    const a = asked();
    assert.equal(a.length, 1);
    assert.deepEqual([a[0]!.read.protocol, a[0]!.read.page, a[0]!.read.context, a[0]!.inWork, a[0]!.bytes > 0], [1, 1, {}, true, true]);
    assert.ok(!path.isAbsolute(a[0]!.read.image), "the image by its name in the work folder");
    // measured as a reader, of the service
    const recs = fs.readFileSync(path.join(w.cwd, ".strom", "metrics", "readers.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l)).filter((r) => String(r.reader).startsWith(`document-${d.id}-`));
    const svc = recs.find((r) => r.agent === "fake");
    assert.deepEqual([svc.provider, svc.credits, svc.outcome, svc.reported], ["service", 2, "ok", "model-ř"]);
    // the text says who read
    const shown = (await w.ok(["document", "show", d.id])).out;
    assert.match(shown, /^who: script \/ fake \(a reading service: the transcript alone, 2 credits\) \(blind\)$/mu, shown);
    assert.equal((await w.run(["check"])).code, 0);

    // it differs: a word of the transcript, said as a variant
    fs.writeFileSync(w.env.STROM_READ_FAKE!, reply([{ text: "Křest Vojtěcha Lhotky, syn Jiřího a Ludmily" }]));
    const differ = (await w.ok(["document", "again", d.id, "--readers", "2", "--agent", "script", "--blind-agent", "fake", "--json"])).json;
    assert.equal(differ.readers.agree, "differ");
    assert.deepEqual(differ.entries[0].variants, [{ field: "transcript", at: "Lhotáka,", other: "Lhotky," }]);
  } finally {
    w.cleanup();
  }
});

test("K1.3: a source read again by a service alone — what the research knows of it told, never its transcript; held against the transcript: alike, or a matter of fact for the person", opts, async () => {
  const { w, dir, asked } = await setUp();
  try {
    await w.ok(["source", "add", "Křest Vojtěcha Lhotáka 1850", "--kind", "baptism", "--recordset", "B1", "--clip", "B1:2@0.1,0.2,0.5,0.1", "--transcript", TEXT]); // S0001
    const before = src(w, "S0001");
    const same = (await w.ok(["document", "read", "--source", "S0001", "--agent", "fake", "--json"])).json;
    assert.equal(same.state, "done", JSON.stringify(same));
    assert.deepEqual(same.source, { id: "S0001", entries: ["e1"], agree: "same", variants: [] });
    assert.deepEqual(strip(same.readers.who), [{ agent: "fake", kind: "service", credits: 2 }]);
    const a = asked().at(-1)!;
    assert.equal(a.read.context.kind, "baptism");
    assert.ok(a.read.region, "the excerpt's place on its page");
    assert.doesNotMatch(JSON.stringify(a), /Ludmil|Vojt/u, "never the transcript, never a name");
    const after = src(w, "S0001");
    assert.deepEqual(after.readings, [same.id]);
    assert.equal(after.transcript, before.transcript);

    // a matter of fact differs (a name): kept beside the source for the person to decide, the transcript as it was
    fs.writeFileSync(path.join(dir, "reply.jsonl"), reply([{ text: "Křest Vojtěcha Lhotáka, syn Jiřího a Marie" }], { cost: { amount: 1, unit: "credits" } }));
    const differ = (await w.ok(["document", "read", "--source", "S0001", "--agent", "fake", "--json"])).json;
    assert.equal(differ.source.agree, "differ");
    assert.deepEqual(differ.source.variants.map((v: { at: string; other: string }) => [v.at, v.other]), [["Ludmily", "Marie"]]);
    assert.equal(differ.source.offer, 1);
    assert.equal(src(w, "S0001").transcript, before.transcript);
    assert.deepEqual(src(w, "S0001").readings, [same.id, differ.id]);
    assert.equal((await w.run(["check"])).code, 0);

    // the service says it cannot read the image: no reading of the source, said why
    fs.writeFileSync(path.join(dir, "reply.jsonl"), JSON.stringify({ done: { unreadable: "blur" } }) + "\n");
    const blur = (await w.run(["document", "read", "--source", "S0001", "--agent", "fake", "--json"])).json;
    assert.deepEqual([blur.state, blur.doc.legible, blur.doc.why], ["unreadable", "no", "blur"]);
    // the account refused (a wrong key): the reading failed, said so — nothing kept of it beside the source
    fs.writeFileSync(path.join(dir, "reply.jsonl"), JSON.stringify({ error: { outcome: "auth", why: "the key is wrong" } }) + "\n");
    const auth = await w.run(["document", "read", "--source", "S0001", "--agent", "fake", "--json"]);
    assert.deepEqual([auth.code, auth.json.state, auth.json.error], [1, "failed", "the reader ended: auth"]);
    assert.deepEqual(src(w, "S0001").readings, [same.id, differ.id]);
  } finally {
    w.cleanup();
  }
});

test("K1.3: a service is never the first reader of a document, never offered to the Strom app, there only while a test sets it", opts, async () => {
  const { w } = await setUp();
  try {
    const reads = () => (fs.existsSync(path.join(w.cwd, ".strom", "reads")) ? fs.readdirSync(path.join(w.cwd, ".strom", "reads")).length : 0);
    const before = reads();
    const first = await w.run(["document", "read", "M0001", "--agent", "fake", "--json"]);
    assert.equal(first.code, 2);
    assert.deepEqual([first.json.code, first.json.params], ["read.with", { at: "0", field: "agent" }]);
    const effort = await w.run(["document", "read", "M0001", "--readers", "2", "--agent", "script", "--blind-agent", "fake", "--blind-effort", "high", "--json"]);
    assert.deepEqual([effort.json.code, effort.json.params], ["read.with", { at: "1", field: "effort" }]);
    // without STROM_READ_FAKE there is no such reader
    const gone = await w.run(["document", "read", "M0001", "--readers", "2", "--agent", "script", "--blind-agent", "fake", "--json"], { env: { STROM_READ_FAKE: "" } });
    assert.deepEqual([gone.json.code, gone.json.params], ["read.with", { at: "1", field: "agent" }]);
    assert.equal(reads(), before, "nothing read");
    // the Strom app's choices: the agents installed here alone
    const tree = Tree.open(w.cwd, w.env);
    const choices = readChoices(tree, new Settings(w.env, {}), w.env, "claude");
    assert.ok(!choices.agents.some((x) => x.id === "fake"), JSON.stringify(choices.agents.map((x) => x.id)));
    // the registry: every agent of a runner a provider of kind agent (all a document says), the fake one a service
    const all = readProviders(w.env);
    assert.deepEqual(all.filter((p) => p.kind === "service").map((p) => p.id), ["fake"]);
    assert.ok(all.filter((p) => p.kind === "agent").every((p) => p.can.includes("persons") && !p.read));
    assert.equal(readProvider("fake", { ...w.env, STROM_READ_FAKE: undefined }), undefined);
  } finally {
    w.cleanup();
  }
});

test("K1.1: a reading of agents alone has none of the new fields — its result, its readers, its cost as before; an old reading's state read as it was", opts, async () => {
  const { w } = await setUp();
  try {
    const d = (await w.ok(["document", "read", "M0001", "--readers", "2", "--agent", "script", "--region", "0.1,0.1,0.8,0.5", "--json"])).json;
    assert.equal(d.state, "done");
    const text = JSON.stringify(d);
    assert.doesNotMatch(text, /"kind":"service"|"credits"/u);
    assert.deepEqual(d.cost, { amount: 0.2, currency: "USD" });
    assert.deepEqual(fs.readdirSync(path.join(w.cwd, "notes", "readings")).filter((f) => f.endsWith(".lines.json")), []);
    // a state of a strom before (no kind, no credits on its reports): shown as it was
    const statePath = path.join(w.cwd, ".strom", "reads", `${d.id}.json`);
    const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
    for (const r of state.reports) {
      delete r.kind;
      delete r.credits;
    }
    fs.writeFileSync(statePath, JSON.stringify(state));
    const shown = (await w.ok(["document", "show", d.id, "--json"])).json;
    assert.deepEqual([shown.readers.agree, shown.cost, strip(shown.readers.who)], ["same", { amount: 0.2, currency: "USD" }, [{ agent: "script" }, { agent: "script" }]]);
  } finally {
    w.cleanup();
  }
});

test("K1.2: the protocol of a service (a plugin later): its request one JSON line, its image by name in its work folder; its reply read line by line, NFC, whatever is not of it left out", () => {
  const work = path.join("/tmp", "práce");
  const line = JSON.parse(requestLine({ image: path.join(work, "page-1.jpg"), page: 1, region: [0.1, 0.2, 0.3, 0.4], context: { kind: "baptism", language: "la" } }, work));
  assert.deepEqual(line, { read: { protocol: 1, image: "page-1.jpg", page: 1, region: [0.1, 0.2, 0.3, 0.4], context: { kind: "baptism", language: "la" } } });
  const ok = parseReply(
    [
      "not json",
      JSON.stringify({ line: { text: "Иван\tПетров".normalize("NFD"), box: [0.1, 0.1, 0.5, 0.1], confidence: 0.8, block: 0 } }),
      JSON.stringify({ line: { text: "  " } }),
      JSON.stringify({ line: { text: "Jiří", box: [0.1, 2, 0.5, 0.1], confidence: 7, block: 1 } }),
      JSON.stringify({ other: 1 }),
      JSON.stringify({ done: { model: "m", cost: { amount: 3, unit: "credits", partial: true } } }),
    ].join("\n"),
  );
  assert.deepEqual(ok, { outcome: "ok", transcript: "Иван Петров | Jiří", lines: [{ text: "Иван Петров", box: [0.1, 0.1, 0.5, 0.1], confidence: 0.8, block: 0 }, { text: "Jiří", block: 1 }], model: "m", cost: { amount: 3, unit: "credits", partial: true } });
  assert.deepEqual(parseReply(JSON.stringify({ line: { text: "a" } })), { outcome: "error", transcript: "", lines: [], why: "the service said nothing of an end" });
  assert.deepEqual(parseReply(JSON.stringify({ error: { outcome: "limit", why: "no credits left", resets: "2026-12-01" } })), { outcome: "limit", transcript: "", lines: [], why: "no credits left", resets: "2026-12-01" });
  assert.deepEqual(parseReply(JSON.stringify({ error: { outcome: "ok" } })).outcome, "error", "an error is never ok");
  assert.deepEqual(parseReply(JSON.stringify({ done: { unreadable: "dark" } })), { outcome: "unreadable", transcript: "", lines: [], why: "dark" });
});

test("K1.3: a service's text regions are the entries of its reading — a page of a register, entry by entry", opts, async () => {
  const { w, dir } = await setUp();
  try {
    fs.writeFileSync(path.join(dir, "reply.jsonl"), reply([
      { text: "Křest Vojtěcha Lhotáka,", box: [0.1, 0.1, 0.8, 0.1], block: 0 },
      { text: "syn Jiřího a Ludmily", box: [0.1, 0.2, 0.8, 0.1], block: 0 },
      { text: "Křest Anny Lhotákové", box: [0.1, 0.5, 0.8, 0.1], block: 1 },
    ]));
    // the big scan (3200×2400): the service given it whole at its own size, never shrunk to an agent's view nor halved
    const d = (await w.ok(["document", "read", "M0004", "--readers", "2", "--agent", "script", "--blind-agent", "fake", "--json"])).json;
    assert.ok(d.blind, JSON.stringify(d));
    const views = fs.readFileSync(path.join(w.cwd, ".strom", "views", "views.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    const recs = fs.readFileSync(path.join(w.cwd, ".strom", "metrics", "readers.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    const given = recs.find((r) => r.agent === "fake").viewFiles;
    assert.equal(given.length, 1, "one view, no halves");
    const view = views.find((v) => v.view === given[0]);
    assert.deepEqual([view?.w, view?.h, view?.scale], [3200, 2400, 1], JSON.stringify(view));
    assert.deepEqual(d.blind.entries.map((e: { transcript: string; region: number[] }) => [e.transcript, e.region]), [
      ["Křest Vojtěcha Lhotáka, | syn Jiřího a Ludmily", [0.1, 0.1, 0.8, 0.2]],
      ["Křest Anny Lhotákové", [0.1, 0.5, 0.8, 0.1]],
    ]);
  } finally {
    w.cleanup();
  }
});

