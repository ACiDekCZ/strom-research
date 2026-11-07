// A transcript the person read or confirmed is never changed by anyone else (spec 065 K2.3): one check where every
// record is written (Tree.put, Tree.putMany) refuses another's change of it, whatever the command; an agent's new wording
// is proposed to the person instead — a note on the source and one task of theirs per source, which no queue offers, no
// agent closes or wakes, and only the person decides: at their terminal (What waits, a link of the Strom app) or in the
// Strom app through its bridge (POST <token>/sources/proposal). The person's terminal and the bridge write as theirs;
// anything else — also a strom with no terminal and no agent strom knows — is protected.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { World, hasGit } from "../helpers.ts";
import { now, Tree } from "../../src/core/tree.ts";
import { transcriptMark, userReading } from "../../src/core/readers.ts";
import { BRIDGE_FEATURES } from "../../src/core/live.ts";
import { openProposal, proposeTranscript, rejectedProposal } from "../../src/core/proposal.ts";
import { writesAsPerson } from "../../src/core/transcriptguard.ts";
import { StromError } from "../../src/core/errors.ts";
import type { Source, Task } from "../../src/core/model.ts";

const APP = "https://beta.stromapp.info";
const AGENT = { env: { CLAUDECODE: "1" } };
const bridgeOpts = { skip: !hasGit || process.platform === "win32", timeout: 240_000 };

const THEIRS = "Vojtěch, syn Jiřího Lhotáka z Lhoty č. 7.";
const sourceOf = (w: World, id: string) => Tree.open(w.cwd, w.env).get<Source>(id)!;
const proposals = (w: World) => Tree.open(w.cwd, w.env).list<Task>("task").filter((t) => t.proposal);

/** A research with S0001 typed by hand at the person's terminal (their reading), S0002 an agent's (nobody's reading). */
async function research(): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["source", "add", "Křest Vojtěcha Lhotáka 1850", "--kind", "baptism", "--transcript", THEIRS], { tty: true });
  await w.ok(["source", "add", "Křest Anny Lhotákové 1852", "--kind", "baptism", "--transcript", "Anna, dcera Jiřího."], AGENT);
  const s = sourceOf(w, "S0001");
  assert.equal(userReading(s)?.how, "hand", "typed at the person's terminal: their reading");
  assert.equal(userReading(sourceOf(w, "S0002")), undefined);
  return w;
}

type Answer = { status: number; body: any };
function request(url: string, method = "GET", body?: unknown, headers: Record<string, string> = { Origin: APP }): Promise<Answer> {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? undefined : Buffer.from(typeof body === "string" ? body : JSON.stringify(body), "utf8");
    const req = http.request(url, { agent: false, method, headers: { ...headers, ...(data ? { "Content-Type": "text/plain;charset=UTF-8", "Content-Length": String(data.length) } : {}) } }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (d) => (text += d));
      res.on("end", () => {
        let parsed: any = text;
        try {
          parsed = JSON.parse(text);
        } catch {
          // not JSON
        }
        resolve({ status: res.statusCode ?? 0, body: parsed });
      });
    });
    req.on("error", reject);
    req.end(data);
  });
}

test("who writes as the person: their own terminal or the bridge; an agent, a session, no terminal — protected", () => {
  assert.equal(writesAsPerson({}, true), true);
  assert.equal(writesAsPerson({ STROM_FOR_APP: "1", STROM_NONINTERACTIVE: "1" }, false), true);
  assert.equal(writesAsPerson({}, false), false, "no terminal, no agent strom knows: protected");
  assert.equal(writesAsPerson({ CLAUDECODE: "1" }, true), false);
  assert.equal(writesAsPerson({ CLAUDECODE: "1", STROM_FOR_APP: "1" }, false), false);
  assert.equal(writesAsPerson({ STROM_SESSION: "N0001" }, true), false);
  assert.equal(writesAsPerson({ STROM_NONINTERACTIVE: "1" }, true), false);
});

test("an agent's new wording of a confirmed transcript is proposed, never written: one task of the person's, a further wording into it; a source nobody read changes", { skip: !hasGit }, async () => {
  const w = await research();
  // without a reason: refused as any change of what a record says
  const bare = await w.run(["source", "edit", "S0001", "--transcript", "Vojtěch, syn Jiřího Lhotáka z Lhoty č. 8."], AGENT);
  assert.notEqual(bare.code, 0);
  assert.match(bare.err + bare.out, /needs --reason/);

  const r = await w.run(["source", "edit", "S0001", "--transcript", "Vojtěch, syn Jiřího Lhotáka z Lhoty č. 8.", "--reason", "číslo domu podle skenu", "--json"], AGENT);
  assert.equal(r.code, 0, r.out + r.err);
  assert.equal(r.json.proposal.outcome, "proposed");
  assert.match(r.json.proposal.line, /the person's own reading .*typed by hand.* not changed; the new wording is proposed to them as T0001/);
  let s = sourceOf(w, "S0001");
  assert.equal(s.transcript, THEIRS, "the person's transcript stays");
  assert.equal(userReading(s)?.how, "hand");
  assert.equal(s.notes.length, 1);
  assert.match(s.notes[0]!.text, /Lhoty č\. 8/);
  let tasks = proposals(w);
  assert.equal(tasks.length, 1);
  const t = tasks[0]!;
  assert.deepEqual([t.id, t.state, t.wait?.kind, t.origin, t.proposal?.source, t.proposal?.why], ["T0001", "waiting", "other", "transcript:proposal", "S0001", "číslo domu podle skenu"]);

  // the text form an agent reads, and another wording (NFD, another script) into the same task
  const nfd = "Войтех, сын Йиржи — č. 9".normalize("NFD");
  const again = await w.ok(["source", "edit", "S0001", "--transcript", nfd, "--reason", "jiné čtení"], AGENT);
  assert.match(again.out, /in T0001 which waited already/);
  tasks = proposals(w);
  assert.equal(tasks.length, 1, "one task per source");
  assert.equal(tasks[0]!.proposal!.text, nfd.normalize("NFC"), "kept in NFC");
  assert.equal(tasks[0]!.notes.length, 1);
  assert.equal(sourceOf(w, "S0001").notes.length, 2);
  // the same wording once more (decomposed or not): nothing written
  const same = await w.ok(["source", "edit", "S0001", "--transcript", nfd.normalize("NFC"), "--reason", "znovu", "--json"], AGENT);
  assert.equal(same.json.proposal.outcome, "same");
  assert.equal(sourceOf(w, "S0001").notes.length, 2);
  // the transcript's own words, decomposed: nothing to propose
  const tree = Tree.open(w.cwd, w.env);
  assert.equal(proposeTranscript(tree, "S0001", THEIRS.normalize("NFD")).outcome, "unchanged");

  // other fields of the same edit are written as asked, the transcript proposed
  const both = await w.ok(["source", "edit", "S0001", "--transcript", "Vojtěch Lhoták", "--date", "2 MAR 1850", "--reason", "datum ze záznamu", "--json"], AGENT);
  s = sourceOf(w, "S0001");
  assert.deepEqual([s.transcript, s.date, both.json.proposal.outcome], [THEIRS, "2 MAR 1850", "appended"]);

  // a source nobody's reading holds: the agent changes it
  await w.ok(["source", "edit", "S0002", "--transcript", "Anna, dcera Jiřího Lhotáka.", "--reason", "celé jméno"], AGENT);
  assert.equal(sourceOf(w, "S0002").transcript, "Anna, dcera Jiřího Lhotáka.");
  assert.equal(proposals(w).length, 1);
});

test("protected wherever it is written: a batch, a direct write (a fix, an undo, a sync, an import), a strom with no terminal and no agent; the person's terminal and the bridge write", { skip: !hasGit }, async () => {
  const w = await research();
  // a batch of an agent's: proposed as the edit does
  const b = await w.ok(["batch", "--json", 'source edit S0001 --transcript "Vojtěch Lhoták, č. 8" --reason "ze skenu"'], AGENT);
  assert.equal(sourceOf(w, "S0001").transcript, THEIRS, JSON.stringify(b.json));
  assert.equal(proposals(w).length, 1);
  // no terminal, no agent strom knows: protected too (default)
  const plain = await w.ok(["source", "edit", "S0001", "--transcript", "Vojtěch Lhoták, č. 10", "--reason", "skript"]);
  assert.match(plain.out, /proposed to them/);
  assert.equal(sourceOf(w, "S0001").transcript, THEIRS);
  // a terminal with an agent's marks: protected
  await w.ok(["source", "edit", "S0001", "--transcript", "Vojtěch Lhoták, č. 11", "--reason", "agent"], { tty: true, env: { CLAUDECODE: "1" } });
  assert.equal(sourceOf(w, "S0001").transcript, THEIRS);

  // whatever writes a record (a fix, an undo, a sync, an import, a migration): refused at Tree.put and Tree.putMany
  const tree = Tree.open(w.cwd, w.env);
  const changed = { ...structuredClone(tree.get<Source>("S0001")!), transcript: "přepsáno", updated: now() };
  for (const write of [() => tree.put(changed, { op: "fixes.undo", targets: ["S0001"], summary: "x" }), () => tree.putMany([changed], [], { op: "sync", targets: ["S0001"], summary: "x" })]) {
    assert.throws(
      () => tree.withTreeLock(write),
      (e: unknown) => e instanceof StromError && e.code === "source.transcript.confirmed" && /strom source edit S0001 --transcript/.test(e.hint ?? ""),
    );
  }
  // in place, the cached record changed first: the file says what it was
  const cached = tree.get<Source>("S0001")!;
  cached.transcript = "přepsáno na místě";
  assert.throws(() => tree.withTreeLock(() => tree.put(cached, { op: "x", targets: ["S0001"], summary: "x" })), /the person's own reading/);
  // what keeps the transcript passes (a note, the date)
  const fresh = Tree.open(w.cwd, w.env);
  fresh.withTreeLock(() => fresh.put({ ...structuredClone(fresh.get<Source>("S0001")!), date: "1850", updated: now() }, { op: "source.edit", targets: ["S0001"], summary: "date" }));
  assert.equal(sourceOf(w, "S0001").transcript, THEIRS);

  // the bridge's write is the person's (STROM_FOR_APP, as forApp sets it)
  await w.ok(["source", "edit", "S0001", "--transcript", "Vojtěch Lhoták z Lhoty", "--reason", "v aplikaci"], { env: { STROM_FOR_APP: "1", STROM_NONINTERACTIVE: "1" } });
  assert.equal(sourceOf(w, "S0001").transcript, "Vojtěch Lhoták z Lhoty");
  // the person's own terminal: written, their reading of the new words
  await w.ok(["source", "edit", "S0001", "--transcript", "Vojtěch Lhoták z Lhoty č. 7", "--reason", "opraveno"], { tty: true });
  const s = sourceOf(w, "S0001");
  assert.deepEqual([s.transcript, userReading(s)?.how], ["Vojtěch Lhoták z Lhoty č. 7", "hand"]);
});

test("the person's task: in no queue, never closed, dropped or woken by an agent; a link opens it at the person's terminal, the wording taken is theirs; kept, never proposed again", { skip: !hasGit }, async () => {
  const w = await research();
  await w.ok(["task", "add", "Najít oddací záznam Lhotáků", "--level", "verify", "--where", "oddací kniha Lhota 1840–1860", "--why", "rodiče Vojtěcha", "--done-when", "záznam nalezen nebo vyloučen"], AGENT); // T0001, open
  await w.ok(["source", "edit", "S0001", "--transcript", "Vojtěch, syn Jiřího Lhotáka z Lhoty č. 8.", "--reason", "číslo domu"], AGENT); // T0002
  const id = proposals(w)[0]!.id;
  assert.equal(id, "T0002");
  const next = await w.ok(["task", "next", "--json"], AGENT);
  assert.doesNotMatch(JSON.stringify(next.json), /T0002/, "the queue never offers it");
  for (const args of [["task", "done", id, "--result", "hotovo"], ["task", "drop", id, "--reason", "zbytečné"], ["task", "wake", id, "--answer", "ano"], ["task", "start", id], ["task", "park", id, "--reason", "později"]]) {
    const r = await w.run(args, AGENT);
    assert.notEqual(r.code, 0, args.join(" "));
    assert.match(r.err + r.out, /person's decision|the person decides|not waiting|only the person/u, args.join(" "));
    assert.equal(Tree.open(w.cwd, w.env).get<Task>(id)!.state, "waiting", args.join(" "));
  }
  // nor decided by an agent
  const decide = await w.run(["source", "proposal", "S0001", "--take", "proposal"], AGENT);
  assert.notEqual(decide.code, 0);
  assert.equal(sourceOf(w, "S0001").transcript, THEIRS);

  // the link of the Strom app opens it at the person's terminal: both wordings shown, the proposed one taken
  const tid = Tree.open(w.cwd, w.env).config.id;
  const link = await w.run(["link", "open", `strom-research://task?tree=${tid}&task=${id}`], { tty: true, answers: ["1", ""] });
  assert.match(link.out, /Lhoty č\. 7/);
  assert.match(link.out, /Lhoty č\. 8/);
  let s = sourceOf(w, "S0001");
  assert.equal(s.transcript, "Vojtěch, syn Jiřího Lhotáka z Lhoty č. 8.", link.out + link.err);
  assert.deepEqual([userReading(s)?.how, userReading(s)?.txt], ["hand", transcriptMark(s.transcript!)]);
  assert.equal(Tree.open(w.cwd, w.env).get<Task>(id)!.state, "done");

  // kept: declined, never proposed again (silently, the agent told)
  await w.ok(["source", "edit", "S0001", "--transcript", "Vojtěch Lhoták z Lhoty", "--reason", "kratší"], AGENT);
  const id2 = proposals(w).find((t) => t.state === "waiting")!.id;
  await w.ok(["source", "proposal", "S0001", "--task", id2, "--take", "keep"], { tty: true });
  s = sourceOf(w, "S0001");
  assert.equal(s.transcript, "Vojtěch, syn Jiřího Lhotáka z Lhoty č. 8.");
  assert.equal(rejectedProposal(Tree.open(w.cwd, w.env), "S0001", "Vojtěch Lhoták z Lhoty".normalize("NFD")), true);
  const declined = await w.ok(["source", "edit", "S0001", "--transcript", "Vojtěch Lhoták z Lhoty", "--reason", "znovu", "--json"], AGENT);
  assert.equal(declined.json.proposal.outcome, "declined");
  assert.equal(openProposal(Tree.open(w.cwd, w.env), "S0001"), undefined, "no task again");
});

test("the person's decision undone (take undo): the transcript and their reading as before, the proposal waits again; a kept wording no longer declined; refused when nothing is to undo, changed since, or by an agent", { skip: !hasGit }, async () => {
  const w = await research();
  const before = sourceOf(w, "S0001");
  await w.ok(["source", "edit", "S0001", "--transcript", "Vojtěch, syn Jiřího Lhotáka z Lhoty č. 8.".normalize("NFD"), "--reason", "číslo domu"], AGENT);
  const id = proposals(w)[0]!.id;
  // nothing decided yet: nothing to undo
  const early = await w.run(["source", "proposal", "S0001", "--take", "undo"], { tty: true });
  assert.notEqual(early.code, 0);
  assert.match(early.out + early.err, /no decision on a proposed wording of S0001 to undo/);
  // taken, then undone: the transcript and the person's reading exactly as before, the task waits again
  await w.ok(["source", "proposal", "S0001", "--task", id, "--take", "proposal"], { tty: true });
  assert.equal(sourceOf(w, "S0001").transcript, "Vojtěch, syn Jiřího Lhotáka z Lhoty č. 8.");
  assert.ok(Tree.open(w.cwd, w.env).get<Task>(id)!.proposal!.was, "what it replaced kept");
  // an agent never undoes it
  const agent = await w.run(["source", "proposal", "S0001", "--take", "undo"], AGENT);
  assert.notEqual(agent.code, 0);
  assert.equal(sourceOf(w, "S0001").transcript, "Vojtěch, syn Jiřího Lhotáka z Lhoty č. 8.");
  await w.ok(["source", "proposal", "S0001", "--take", "undo"], { tty: true });
  let s = sourceOf(w, "S0001");
  assert.deepEqual([s.transcript, s.read?.user], [THEIRS, before.read?.user], "their reading and its confirmation as before");
  let t = Tree.open(w.cwd, w.env).get<Task>(id)!;
  assert.deepEqual([t.state, t.result, t.proposal?.was, t.wait?.kind, openProposal(Tree.open(w.cwd, w.env), "S0001")?.id], ["waiting", undefined, undefined, "other", id]);
  const ops = fs.readdirSync(path.join(w.cwd, "data", "ops"), { recursive: true }).filter((f) => String(f).endsWith(".jsonl")).map((f) => fs.readFileSync(path.join(w.cwd, "data", "ops", String(f)), "utf8")).join("");
  assert.match(ops, /"source\.proposal\.undo"/);
  assert.match(ops, /"task\.reopen"/);
  // undone already: nothing more to undo
  const again = await w.run(["source", "proposal", "S0001", "--take", "undo", "--task", id], { tty: true });
  assert.notEqual(again.code, 0);
  assert.match(again.out + again.err, /no decision on a proposed wording of S0001 to undo \(T\d+: it waits for a decision\)/);

  // kept, then undone: the wording no longer declined, the proposal waits again
  await w.ok(["source", "proposal", "S0001", "--take", "keep"], { tty: true });
  assert.equal(rejectedProposal(Tree.open(w.cwd, w.env), "S0001", "Vojtěch, syn Jiřího Lhotáka z Lhoty č. 8."), true);
  await w.ok(["source", "proposal", "S0001", "--take", "undo"], { tty: true });
  assert.equal(rejectedProposal(Tree.open(w.cwd, w.env), "S0001", "Vojtěch, syn Jiřího Lhotáka z Lhoty č. 8."), false);
  assert.equal(sourceOf(w, "S0001").transcript, THEIRS);
  assert.equal(Tree.open(w.cwd, w.env).get<Task>(id)!.state, "waiting");

  // taken, then the person changed it by hand: the undo refused, nothing touched
  await w.ok(["source", "proposal", "S0001", "--take", "proposal"], { tty: true });
  await w.ok(["source", "edit", "S0001", "--transcript", "Vojtěch Lhoták z Lhoty č. 9", "--reason", "opraveno"], { tty: true });
  const changed = await w.run(["source", "proposal", "S0001", "--take", "undo"], { tty: true });
  assert.notEqual(changed.code, 0);
  assert.match(changed.out + changed.err, /changed since T\d+ was decided — nothing undone/);
  s = sourceOf(w, "S0001");
  t = Tree.open(w.cwd, w.env).get<Task>(id)!;
  assert.deepEqual([s.transcript, t.state], ["Vojtěch Lhoták z Lhoty č. 9", "done"]);
});

test("a hand edit of data/ is reported by strom check", { skip: !hasGit }, async () => {
  const w = await research();
  const file = path.join(w.cwd, "data", "sources", "S0001.json");
  assert.ok(fs.existsSync(file), file);
  const rec = JSON.parse(fs.readFileSync(file, "utf8"));
  fs.writeFileSync(file, JSON.stringify({ ...rec, transcript: "přepsáno rukou mimo strom" }, null, 2) + "\n");
  const r = await w.run(["check", "--json"]);
  assert.notEqual(r.code, 0, r.out);
  assert.match(r.out + r.err, /S0001/);
});

test("POST /sources/proposal: the person's decision in the Strom app — taken as confirmed, kept; every refusal; the waiting item and the feature", bridgeOpts, async () => {
  const w = await research();
  Object.assign(w.env, { STROM_LOCK_WAIT_MS: "1500" });
  await w.ok(["source", "edit", "S0001", "--transcript", "Vojtěch, syn Jiřího Lhotáka z Lhoty č. 8.", "--reason", "číslo domu"], AGENT);
  const id = proposals(w)[0]!.id;
  let started = false;
  try {
    const info = (await w.ok(["live", "start", "--json"])).json as { url: string };
    started = true;
    const url = `${info.url}/sources/proposal`;
    const post = (body: unknown) => request(url, "POST", body);
    assert.ok(BRIDGE_FEATURES.includes("sources.proposal"));
    const status = (await request(`${info.url}/status`)).body;
    assert.ok(status.features.includes("sources.proposal"));
    const item = status.waiting.find((x: { id: string }) => x.id === id);
    assert.ok(item, JSON.stringify(status.waiting));
    assert.deepEqual([item.kind, item.section, item.proposal.source, item.proposal.current, item.proposal.mark], ["transcript", "decide", "S0001", THEIRS, transcriptMark("Vojtěch, syn Jiřího Lhotáka z Lhoty č. 8.")]);
    assert.deepEqual(item.choices, ["proposal", "keep"]);

    const foreign = await request(url, "POST", { source: "S0001", task: id, take: "keep" }, {});
    assert.equal(foreign.status, 403);
    for (const bad of [{}, { source: "S0001", task: id }, { source: "S0001", task: id, take: "yes" }, { source: "P0001", task: id, take: "keep" }, { source: "S0001", task: id, take: "keep", at: 1 }, "x"]) {
      const r = await post(bad);
      assert.deepEqual([r.status, r.body.code], [400, "proposal.invalid"], JSON.stringify(bad));
    }
    assert.deepEqual([(await post({ source: "S0002", task: id, take: "keep" })).body.code], ["proposal.none"]);
    const stale = await post({ source: "S0001", task: id, take: "proposal", proposed: "0000000000000000" });
    assert.deepEqual([stale.status, stale.body.code, stale.body.proposed], [409, "proposal.changed", item.proposal.mark]);
    const ok = await post({ source: "S0001", task: id, take: "proposal", proposed: item.proposal.mark });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.deepEqual([ok.body.ok, ok.body.task, ok.body.take, ok.body.txt], [true, id, "proposal", item.proposal.mark]);
    const s = sourceOf(w, "S0001");
    assert.deepEqual([s.transcript, userReading(s)?.how], ["Vojtěch, syn Jiřího Lhotáka z Lhoty č. 8.", "confirm"]);
    const twice = await post({ source: "S0001", task: id, take: "keep" });
    assert.deepEqual([twice.status, twice.body.code], [409, "proposal.decided"]);
    // "Undo" in the app: the transcript and the person's reading as before (their confirmation too), the proposal waits again
    assert.ok(status.features.includes("sources.proposal.undo"));
    const undo = await post({ source: "S0001", task: id, take: "undo" });
    assert.equal(undo.status, 200, JSON.stringify(undo.body));
    assert.deepEqual([undo.body.ok, undo.body.task, undo.body.take], [true, id, "undo"]);
    const back = sourceOf(w, "S0001");
    assert.deepEqual([back.transcript, userReading(back)?.how], [THEIRS, "hand"]);
    const waits = (await request(`${info.url}/status`)).body.waiting.find((x: { id: string }) => x.id === id);
    assert.ok(waits, "waits for a decision again");
    const undoTwice = await post({ source: "S0001", task: id, take: "undo" });
    assert.deepEqual([undoTwice.status, undoTwice.body.code], [409, "proposal.undo"]);
  } finally {
    if (started) await w.run(["live", "stop"]);
  }
});
