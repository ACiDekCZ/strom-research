// The person's "not an error" (strom quality …, core/quality.ts), the research's verdicts of possible duplicates (strom
// person compare, core/duplicates.ts: every one of the fourteen rules) and a person named alive after their death
// (strom check after-death, core/afterdeath.ts: the warning, the task of the plan, what the person marked) — and the
// bridge's POST /duplicates, POST /quality/dismiss and GET /quality.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { likelyDuplicates } from "../../src/core/people.ts";
import { sameFamily } from "../../src/core/surnames.ts";
import { judgePairs } from "../../src/core/duplicates.ts";
import { twoPeople, dismissalKey } from "../../src/core/quality.ts";
import { researchProposals } from "../../src/commands/session.ts";
import type { Research, Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit };
const bridged = { skip: !hasGit || process.platform === "win32", timeout: 180_000 };
const APP = "https://beta.stromapp.info";
const file = (w: World) => path.join(w.cwd, "quality", "dismissed.json");

async function person(w: World, name: string, sex: string, more: string[] = []): Promise<string> {
  return (await w.ok(["person", "add", name, "--sex", sex, ...more, "--json"])).json.person.id;
}

async function family(w: World, partners: string[], children: string[] = []): Promise<string> {
  return (await w.ok(["family", "add", ...partners.flatMap((p) => ["--partner", p]), ...children.flatMap((c) => ["--child", c]), "--json"])).json.family.id;
}

test("quality: a mark is the person's — the same mark twice changes nothing, its key sorts the people and folds the subject; an unknown kind kept; logged and committed; an agent refused", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  const a = await person(w, "Jan /Lhoták/", "M");
  const b = await person(w, "Petr /Lhoták/", "M");
  const rev0 = (await w.ok(["quality", "list", "--json"])).json.rev;
  assert.match(rev0, /^[0-9a-f]{7}-[0-9a-f]{4}$/);
  const r = await w.ok(["quality", "dismiss", "possibleDuplicate", b, "P1", "--json"]);
  assert.equal(r.json.changed, true);
  assert.deepEqual(r.json.entry.persons, [a, b], "padded, sorted");
  assert.equal(r.json.entry.by, "research");
  const again = await w.ok(["quality", "dismiss", "possibleDuplicate", a, b, "--json"]);
  assert.equal(again.json.changed, false);
  // a subject decomposed and with other spaces: the same mark
  await w.ok(["quality", "dismiss", "recurringGodparent", a, b, "--subject", "  Václav Lhoták  "]);
  assert.equal((await w.ok(["quality", "dismiss", "recurringGodparent", b, a, "--subject", "Václav Lhoták".normalize("NFD"), "--json"])).json.changed, false);
  // a kind the research does not know: kept as it came; a subject in another script, cut at 200 whole characters
  const long = `Иван Лготак 👨‍👩‍👧 ${"é".repeat(250)}`;
  const kept = await w.ok(["quality", "dismiss", "someFutureKind", a, "--subject", long, "--json"]);
  assert.equal(kept.json.entry.kind, "someFutureKind");
  assert.ok(Array.from(kept.json.entry.subject).length <= 200);
  assert.ok(kept.json.entry.subject.startsWith("Иван Лготак 👨‍👩‍👧"));
  const list = await w.ok(["quality", "list", "--json"]);
  assert.equal(list.json.dismissed.length, 3);
  assert.notEqual(list.json.rev, rev0);
  const saved = readJsonFile(file(w));
  assert.deepEqual(saved.dismissed.map((d: any) => d.kind).sort(), ["possibleDuplicate", "recurringGodparent", "someFutureKind"]);
  for (const d of saved.dismissed) assert.equal(d.subject === undefined || d.subject === d.subject.normalize("NFC"), true);
  // committed, each a logged operation
  const subjects = execFileSync("git", ["log", "--format=%s%n%b"], { cwd: w.cwd, encoding: "utf8" });
  assert.match(subjects, /not an error: possibleDuplicate P0001 P0002/);
  assert.match(subjects, /not an error: someFutureKind P0001 \(Иван Лготак/);
  assert.equal((await w.ok(["check", "--json"])).json.ok, true);
  // undo: once, then nothing
  const undo = await w.ok(["quality", "undo", "possibleDuplicate", a, b, "--json"]);
  assert.deepEqual([undo.json.changed, undo.json.dismissed.length], [true, 2]);
  assert.equal((await w.ok(["quality", "undo", "possibleDuplicate", a, b, "--json"])).json.changed, false);
  // refusals: no such person, a wrong shape
  const none = await w.run(["quality", "dismiss", "possibleDuplicate", a, "P0099", "--json"]);
  assert.notEqual(none.code, 0);
  assert.equal(none.json.code, "person.no-match");
  assert.equal(none.json.params.person, "P0099");
  assert.equal((await w.run(["quality", "dismiss", "possibleDuplicate", "Jan", "--json"])).json.code, "quality.body");
  // an agent never marks
  const agent = { env: { CLAUDECODE: "1" } };
  for (const args of [["quality", "dismiss", "possibleDuplicate", a, b], ["quality", "undo", "recurringGodparent", a, b, "--subject", "Václav Lhoták"]]) assert.equal((await w.run(args, agent)).code, 4, args.join(" "));
  assert.equal((await w.run(["quality", "list"], agent)).code, 0);
  assert.equal((await w.run(["person", "compare", a, b], agent)).code, 0, "comparing is no decision");
  assert.match((await w.ok(["guide"])).out, /strom quality dismiss/);
  assert.equal(dismissalKey("k", ["P2", "P1"], "Lhoták"), dismissalKey("k", ["P1", "P2"], "LHOTAK"));
  w.cleanup();
});

test("person compare: each of the fourteen rules, the first that holds; pairs kept as asked, in order; years where both are known; the groups of forms count", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["source", "add", "Matrika Lhota", "--kind", "baptism"]); // S1
  // a family: two sons of one name, a year apart (one recorded twice)
  const father = await person(w, "Josef /Lhoták/", "M");
  const mother = await person(w, "Anna /Lhotáková/", "F");
  const jan1 = await person(w, "Jan /Lhoták/", "M", ["--born", "1850"]);
  const jan2 = await person(w, "Jan /Lhoták/", "M", ["--born", "1851"]);
  await family(w, [father, mother], [jan1, jan2]);
  // merged
  const m1 = await person(w, "Jan /Lhoták/", "M", ["--born", "1850"]);
  const m2 = await person(w, "Jan /Lhoták/", "M", ["--born", "1850"]);
  await w.ok(["person", "merge", m1, m2, "--reason", "one man"]);
  // decided by the person
  const d1 = await person(w, "Petr /Lhoták/", "M", ["--born", "1860"]);
  const d2 = await person(w, "Petr /Lhoták/", "M", ["--born", "1861"]);
  await w.ok(["quality", "dismiss", "possibleDuplicate", d1, d2]);
  // different sex; years apart
  const woman = await person(w, "Jan /Lhoták/", "F", ["--born", "1850"]);
  const later = await person(w, "Jan /Lhoták/", "M", ["--born", "1870"]);
  // a life that ended before the other's began
  const dead = await person(w, "Karel /Lhoták/", "M", ["--died", "1840"]);
  const born = await person(w, "Karel /Lhoták/", "M", ["--born", "1845"]);
  // siblings: the first died (about) the year before the second was born
  const sf = await person(w, "Pavel /Lhoták/", "M");
  const v1 = await person(w, "Václav /Lhoták/", "M", ["--born", "1880", "--died", "ABT 1881"]);
  const v2 = await person(w, "Václav /Lhoták/", "M", ["--born", "1882"]);
  await family(w, [sf], [v1, v2]);
  // different parents (both known, nothing alike) — and alike once Lhoták and Lhotinka are one family's
  const t1 = await person(w, "Tomáš /Lhoták/", "M", ["--born", "1890"]);
  const t2 = await person(w, "Tomáš /Lhoták/", "M", ["--born", "1891"]);
  await family(w, [await person(w, "Ondřej /Lhoták/", "M"), await person(w, "Eva /Lhotáková/", "F")], [t1]);
  await family(w, [await person(w, "Ondřej /Lhotinka/", "M"), await person(w, "Eva /Lhotinková/", "F")], [t2]);
  // one entry cited by a fact of each
  const e1 = await person(w, "Matěj /Lhoták/", "M");
  const e2 = await person(w, "Matěj /Lhoták/", "M");
  for (const p of [e1, e2]) await w.ok(["event", "add", p, "RESI", "--place", "Lhota", "--cite", "S1", "--locator", "fol. 3"]);
  // close years; no date; names that do not fit (until one group)
  const c1 = await person(w, "Lukáš /Lhoták/", "M", ["--born", "1920"]);
  const c2 = await person(w, "Lukáš /Lhoták/", "M", ["--born", "ABT 1922"]);
  const nd = await person(w, "Lukáš /Lhoták/", "M");
  const n1 = await person(w, "Jakub /Lhoták/", "M", ["--born", "1910"]);
  const n2 = await person(w, "Jakub /Lhotinka/", "M", ["--born", "1911"]);

  const ask = [
    [jan1, "P9999"],
    [m2, m1],
    [d2, d1],
    [jan1, woman],
    [father, jan1],
    [jan1, later],
    [born, dead],
    [v1, v2],
    [t1, t2],
    [jan1, jan2],
    [e1, e2],
    [c1, c2],
    [c1, nd],
    [n1, n2],
    ["P" + Number(jan1.slice(1)), jan2],
  ];
  const r = await w.ok(["person", "compare", "--pairs-from", "-", "--json"], { stdin: JSON.stringify({ pairs: ask }) });
  const v = r.json.verdicts;
  assert.deepEqual(
    v.map((x: any) => [x.verdict ?? null, x.reason]),
    [
      [null, "unknown-person"],
      ["same", "merged"],
      ["different", "decided"],
      ["different", "different-sex"],
      ["different", "parent-child"],
      ["different", "years-apart"],
      ["different", "life-no-overlap"],
      ["different", "siblings"],
      ["different", "different-parents"],
      ["same", "same-parents"],
      ["same", "same-events"],
      ["unsure", "close-years"],
      ["unsure", "no-date"],
      ["unsure", "names-differ"],
      ["same", "same-parents"],
    ],
  );
  assert.deepEqual(v.map((x: any) => x.pair), ask, "each pair as it was asked");
  assert.equal(v[0].years, undefined);
  assert.equal(v[1].into, m1);
  assert.deepEqual([v[2].by, typeof v[2].at], ["research", "string"]);
  assert.deepEqual(v[5].years, [1850, 1870]);
  assert.deepEqual(v[11].years, [1920, 1922]);
  assert.equal(v[12].years, undefined, "one year only");
  assert.match(r.json.rev, /^[0-9a-f]{7}-[0-9a-f]{4}$/);
  // one pair, in words
  assert.match((await w.ok(["person", "compare", jan1, jan2])).out, /same · same-parents \(1850, 1851\)/);
  // the groups of forms: the parents alike, the names fit
  await w.ok(["surname", "group", "Lhoták", "Lhotinka"]);
  const g = (await w.ok(["person", "compare", "--pairs-from", "-", "--json"], { stdin: `${t1} ${t2}\n${n1} ${n2}\n` })).json.verdicts;
  assert.deepEqual(g.map((x: any) => x.reason), ["same-parents", "close-years"]);
  // refusals: a wrong shape, more than 1000 pairs
  assert.equal((await w.run(["person", "compare", "--pairs-from", "-", "--json"], { stdin: '{"pairs": [["P1"]]}' })).json.code, "duplicates.body");
  const many = JSON.stringify({ pairs: Array.from({ length: 1001 }, () => [jan1, jan2]) });
  assert.equal((await w.run(["person", "compare", "--pairs-from", "-", "--json"], { stdin: many })).json.code, "duplicates.body");
  w.cleanup();
});

test("a pair marked two people: no likely duplicate (the brief's Probably already in the tree), a merged person's mark read as the one merged into", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  const a = await person(w, "Petr /Lhoták/", "M", ["--born", "1860"]);
  const b = await person(w, "Petr /Lhoták/", "M", ["--born", "1861"]);
  const c = await person(w, "Petr /Lhoták/", "M", ["--born", "1861"]);
  const found = (t: Tree) => likelyDuplicates(t, [a], sameFamily(t), twoPeople(t)).map((d) => d.same.id).sort();
  assert.deepEqual(found(Tree.open(w.cwd, w.env)), [b, c]);
  await w.ok(["quality", "dismiss", "possibleDuplicate", a, b]);
  assert.deepEqual(found(Tree.open(w.cwd, w.env)), [c]);
  // b and c one man: the mark of a and b is a mark of a and c now
  await w.ok(["person", "merge", c, b, "--reason", "one man"]);
  const t = Tree.open(w.cwd, w.env);
  assert.deepEqual(found(t), []);
  assert.deepEqual(judgePairs(t, [[a, c]]).map((v) => v.reason), ["decided"]);
  assert.deepEqual(judgePairs(t, [[b, c]]).map((v) => [v.reason, v.into]), [["merged", c]]);
  w.cleanup();
});

test("check after-death: an event certainly after the death warns (never about one, never a burial or a will), a marriage after a partner's death; what the person marked is not said; a task of the plan once, done when marked; none in an archive", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["source", "add", "Matrika Lhota", "--kind", "burial"]); // S1
  const jan = await person(w, "Jan /Lhoták/", "M", ["--born", "1800", "--died", "1850"]);
  await w.ok(["event", "add", jan, "RESI", "--date", "1852", "--place", "Lhota", "--cite", "S1", "--locator", "fol. 7"]); // certainly after
  await w.ok(["event", "add", jan, "OCCU", "--date", "ABT 1851", "--value", "sedlák"]); // maybe not
  await w.ok(["event", "add", jan, "RESI", "--date", "BET 1849 AND 1853", "--place", "Lhota"]); // maybe not
  for (const kind of ["BURI", "PROB", "WILL", "CREM"]) await w.ok(["event", "add", jan, kind, "--date", "1852"]);
  const anna = await person(w, "Anna /Lhotáková/", "F", ["--born", "1820", "--died", "MAR 1860"]);
  const petr = await person(w, "Petr /Lhoták/", "M", ["--born", "1818"]);
  const f = await family(w, [petr, anna]);
  await w.ok(["event", "add", f, "MARR", "--date", "BET 1862 AND 1863", "--place", "Lhota"]);
  const after = async () => (await w.run(["check", "--json"])).json.findings.filter((x: any) => x.code === "after-death");
  let found = await after();
  assert.equal(found.length, 2, JSON.stringify(found));
  assert.ok(found.every((x: any) => x.level === "warn"));
  assert.ok(found[0].message.includes(`strom quality dismiss eventAfterDeath ${jan} --subject 1852`), found[0].message);
  assert.ok(found[1].message.includes(`weddingAfterDeath ${anna} --subject 1862`), found[1].message);
  assert.equal((await w.run(["check"])).code, 0, "a warning never blocks");

  // the plan: one task each, with both facts and their citations, in the research's language
  await w.ok(["lang", "cs"]);
  // a person reads it in the research's language, the way in their terminal included
  const said = (await w.run(["check"], { tty: true })).out;
  assert.match(said, /datováno po smrti \(1850\)/u);
  assert.match(said, new RegExp(`není chyba → strom quality dismiss eventAfterDeath ${jan} --subject 1852`, "u"));
  await w.ok(["research", "new", "Předci Jana", "--person", jan]);
  await w.ok(["frontier", "--apply"]);
  const tasks = () => Tree.open(w.cwd, w.env).list<Task>("task").filter((t) => t.origin === "after-death");
  assert.equal(tasks().length, 1, "Anna is no person of this research");
  const t = tasks()[0]!;
  assert.equal(t.level, "verify");
  assert.ok(t.what.includes(jan) && t.why.includes("S0001 (fol. 7)") && t.why.includes("1850"), JSON.stringify(t));
  assert.ok(!/\b(vy|váš|ty)\b/iu.test(`${t.what} ${t.why} ${t.doneWhen}`));
  await w.ok(["frontier", "--apply"]);
  assert.equal(tasks().length, 1, "never twice");

  // marked no error: not said, its task done with why
  await w.ok(["quality", "dismiss", "eventAfterDeath", jan, "--subject", "1852"]);
  found = await after();
  assert.deepEqual(found.map((x: any) => x.message.includes(anna)), [true]);
  assert.equal(tasks()[0]!.state, "done");
  assert.ok(tasks()[0]!.result);
  await w.ok(["frontier", "--apply"]);
  assert.equal(tasks().length, 1, "not raised again once marked");
  // another year of the same person is another finding
  await w.ok(["quality", "dismiss", "eventAfterDeath", jan, "--subject", "1853"]);
  assert.equal((await after()).length, 1);

  // an archive: the warning, no task
  await w.ok(["mode", "archive"], { tty: true });
  const tree = Tree.open(w.cwd, w.env);
  const research = tree.list<Research>("research")[0]!;
  await w.ok(["research", "new", "Předci Anny", "--person", anna]).catch(() => undefined);
  assert.ok(!researchProposals(tree, { ...research, focus: anna }).some((p) => p.proposal.origin === "after-death"));
  assert.equal((await after()).length, 1);
  w.cleanup();
});

test("the file is sealed and goes with a pack", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  const a = await person(w, "Jan /Lhoták/", "M");
  const b = await person(w, "Jan /Lhoták/", "M");
  await w.ok(["quality", "dismiss", "possibleDuplicate", a, b]);
  const zip = path.join(w.dir, "lhota.zip");
  await w.ok(["pack", "--out", zip]);
  const other = new World();
  await other.ok(["setup", "--yes"]);
  await other.ok(["unpack", zip], { answers: ["a"] });
  assert.deepEqual(readJsonFile(path.join(other.treeDir("Lhotákovi"), "quality", "dismissed.json")).dismissed.map((d: any) => d.persons), [[a, b]]);
  other.cleanup();
  fs.writeFileSync(file(w), fs.readFileSync(file(w), "utf8").replace("possibleDuplicate", "somethingElse"));
  const v = await w.run(["verify", "--json"]);
  assert.equal(v.code, 1);
  assert.ok(v.json.findings.some((x: any) => x.code === "quality-edited"), JSON.stringify(v.json.findings));
  w.cleanup();
});

function ask(url: string, opt: { method?: string; body?: string; origin?: string | null } = {}): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: any }> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {};
    if (opt.origin !== null) headers.Origin = opt.origin ?? APP;
    if (opt.body !== undefined) headers["Content-Type"] = "text/plain; charset=utf-8";
    const req = http.request(url, { agent: false, method: opt.method ?? "GET", headers }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (d) => (text += d));
      res.on("end", () => {
        let body: any = text;
        try {
          body = JSON.parse(text);
        } catch {
          // not JSON
        }
        resolve({ status: res.statusCode ?? 0, headers: res.headers, body });
      });
    });
    req.on("error", reject);
    req.end(opt.body);
  });
}

/** The first event of a kind the bridge sends (its EventSource), within a while. */
function nextEvent(url: string, kind: string, ms = 20_000): Promise<any> {
  return new Promise((resolve, reject) => {
    let text = "";
    const req = http.get(`${url}/events?app=3.17.0`, { agent: false }, (res) => {
      res.setEncoding("utf8");
      res.on("data", (d) => {
        text += d;
        const m = new RegExp(`event: ${kind}\\ndata: (.*)\\n`).exec(text);
        if (m) {
          clearTimeout(timer);
          req.destroy();
          resolve(JSON.parse(m[1]!));
        }
      });
    });
    const timer = setTimeout(() => (req.destroy(), reject(new Error(`no event ${kind}: ${text.slice(-300)}`))), ms);
    req.on("error", () => undefined);
  });
}

test("the bridge: POST /duplicates judges, POST /quality/dismiss marks as the app's (and takes back), GET /quality and /status quality.rev, the event quality; refusals; an archive too", bridged, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  const a = await person(w, "Jan /Lhoták/", "M", ["--born", "1850"]);
  const b = await person(w, "Jan /Lhoták/", "M", ["--born", "1851"]);
  const info = (await w.ok(["live", "start", "--json"])).json;
  const lock = path.join(w.cwd, ".strom", "tree.lock");
  try {
    const status = (await ask(`${info.url}/status`)).body;
    for (const f of ["duplicates.judge", "quality.dismiss", "quality.read"]) assert.ok(status.features.includes(f), f);
    assert.match(status.quality.rev, /^[0-9a-f]{7}-[0-9a-f]{4}$/);
    // judged: a read, the app's or not
    const j = await ask(`${info.url}/duplicates`, { method: "POST", body: JSON.stringify({ pairs: [[a, b], [a, "P0999"]] }), origin: null });
    assert.equal(j.status, 200, JSON.stringify(j.body));
    assert.deepEqual(j.body.verdicts.map((x: any) => [x.verdict ?? null, x.reason]), [["unsure", "close-years"], [null, "unknown-person"]]);
    assert.equal(j.body.rev, status.quality.rev);
    for (const body of ["no json", '{"pairs": [["P1", "X2"]]}', '{"pairs": [["P1"]]}', JSON.stringify({ pairs: Array.from({ length: 1001 }, () => [a, b]) })]) {
      const r = await ask(`${info.url}/duplicates`, { method: "POST", body });
      assert.deepEqual([r.status, r.body.code], [400, "duplicates.body"], body.slice(0, 40));
    }
    fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, host: os.hostname(), at: new Date().toISOString(), owner: "a test" }));
    const busy = await ask(`${info.url}/duplicates`, { method: "POST", body: JSON.stringify({ pairs: [[a, b]] }) });
    assert.deepEqual([busy.status, busy.body.code, busy.headers["retry-after"] !== undefined], [503, "research.busy", true]);
    fs.rmSync(lock);

    // marked as the app's: the event quality while the app follows
    const event = nextEvent(info.url, "quality");
    await new Promise((r) => setTimeout(r, 1500));
    const d = await ask(`${info.url}/quality/dismiss`, { method: "POST", body: JSON.stringify({ kind: "possibleDuplicate", persons: [b, a] }) });
    assert.equal(d.status, 200, JSON.stringify(d.body));
    assert.equal(d.body.ok, true);
    const q = (await ask(`${info.url}/quality`)).body;
    assert.equal(q.rev, d.body.rev);
    assert.deepEqual(q.dismissed.map((x: any) => [x.kind, x.persons, x.by]), [["possibleDuplicate", [a, b], "app"]]);
    assert.equal((await event).rev, d.body.rev);
    assert.equal((await ask(`${info.url}/status`)).body.quality.rev, d.body.rev);
    const again = await ask(`${info.url}/duplicates`, { method: "POST", body: JSON.stringify({ pairs: [[a, b]] }) });
    assert.deepEqual([again.body.verdicts[0].reason, again.body.verdicts[0].by], ["decided", "app"]);
    // refusals
    const none = await ask(`${info.url}/quality/dismiss`, { method: "POST", body: JSON.stringify({ kind: "possibleDuplicate", persons: [a, "P0999"] }) });
    assert.deepEqual([none.status, none.body.code, none.body.params?.person], [404, "person.no-match", "P0999"]);
    for (const body of ['{"persons": ["P1"]}', '{"kind": "x", "persons": []}', '{"kind": "x", "persons": ["Jan"]}', '{"kind": "x", "persons": ["P1"], "do": "maybe"}', '{"kind": "x", "persons": ["P1"], "subject": 5}']) {
      const r = await ask(`${info.url}/quality/dismiss`, { method: "POST", body });
      assert.deepEqual([r.status, r.body.code], [400, "quality.body"], body);
    }
    assert.equal((await ask(`${info.url}/quality/dismiss`, { method: "POST", body: '{"kind": "x", "persons": ["P1"]}', origin: null })).status, 403, "only the Strom app");
    const undo = await ask(`${info.url}/quality/dismiss`, { method: "POST", body: JSON.stringify({ kind: "possibleDuplicate", persons: [a, b], do: "undo" }) });
    assert.equal(undo.status, 200);
    assert.deepEqual((await ask(`${info.url}/quality`)).body.dismissed, []);

    // an archive: read and marked as well
    await w.ok(["live", "stop"]);
    await w.ok(["mode", "archive"], { tty: true });
    const archived = (await w.ok(["live", "start", "--json"])).json;
    const m = await ask(`${archived.url}/quality/dismiss`, { method: "POST", body: JSON.stringify({ kind: "eventAfterDeath", persons: [a], subject: "1861" }) });
    assert.equal(m.status, 200, JSON.stringify(m.body));
    assert.equal((await ask(`${archived.url}/quality`)).body.dismissed[0].subject, "1861");
    assert.equal((await ask(`${archived.url}/duplicates`, { method: "POST", body: JSON.stringify({ pairs: [[a, b]] }) })).status, 200);
  } finally {
    fs.rmSync(lock, { force: true });
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});
