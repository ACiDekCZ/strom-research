// A hypothesis decided by a pick in the Strom app (spec 074): the app opens a link with the variant picked (none holds,
// left open, the decision taken back), the research's terminal says what it would write and asks once — Enter is yes —
// then why (Enter: the app's words), and writes it as the person's decision in the app (decidedIn "app", the decision
// before kept as previous). Only a pick among closed choices (whose child, which couple): the rest is refused to its
// whole screen. Taken back only while the tree records nothing of it. Several of the agent's proposals taken at once
// (hypotheses&do=accept). For an app that decides them (APP_DECIDES_HYPOTHESES) the Strom file says who decided where,
// the decision before, the proposal, what speaks against a variant, and /status waiting has the hypotheses.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { LinkError, parseLink } from "../../src/core/links.ts";
import { exportGedcom } from "../../src/gedcom/export.ts";
import { hasGedErrors, validateGedcom } from "../../src/gedcom/validate.ts";
import { changeLines } from "../../src/core/changelog.ts";
import { waitingFor } from "../../src/core/waiting.ts";
import { BRIDGE_FEATURES } from "../../src/core/live.ts";
import { buildGed } from "../../src/core/liveged.ts";
import { head as headOf } from "../../src/core/git.ts";
import { Settings } from "../../src/core/config.ts";
import { APP_DECIDES_HYPOTHESES, APP_DECIDES_HYPOTHESES_BETA, appDecidesHypotheses } from "../../src/core/stromapp.ts";
import { pickableInApp } from "../../src/core/hypolinks.ts";
import type { Family, Hypothesis } from "../../src/core/model.ts";

const opts = { skip: !hasGit };
const AGENT = { env: { AI_AGENT: "1" } };
const ID = "0f8c2d4e-1b2a-4c3d-9e8f-7a6b5c4d3e2f";

/**
 * Josef Lhoták (P1, the research's) whose parents are unknown; a couple Václav Lhoták + Marie Lhotová (P2, P3, F1), a
 * couple Jakub Lhoták + Anna Lhotová (P4, P5, F2). H1: whose son Josef is — A of F1, B of F2 (both linked: a pick).
 * H2: where he was born — no links (a pick too, K1.6: only the decision written). S1 a baptism, S2 a census.
 */
async function world(): Promise<World> {
  const w = new World();
  await w.withTree();
  await w.ok(["lang", "cs"]);
  await w.ok(["config", "set", "hypotheses.decide", "person"]);
  await w.ok(["research", "new", "Předci Josefa", "--new-person", "Josef /Lhoták/", "--sex", "M"]); // P1
  await w.ok(["person", "add", "Václav /Lhoták/", "--sex", "M"]); // P2
  await w.ok(["person", "add", "Marie /Lhotová/", "--sex", "F"]); // P3
  await w.ok(["family", "add", "--partner", "P2", "--partner", "P3"]); // F1
  await w.ok(["person", "add", "Jakub /Lhoták/", "--sex", "M"]); // P4
  await w.ok(["person", "add", "Anna /Lhotová/", "--sex", "F"]); // P5
  await w.ok(["family", "add", "--partner", "P4", "--partner", "P5"]); // F2
  await w.ok(["source", "add", "Křest Josefa 1850 v Lhotě", "--kind", "baptism"]); // S1
  await w.ok(["source", "add", "Sčítání lidu 1857, Lhota č. 3", "--kind", "census"]); // S2
  await w.ok(["hypothesis", "add", "Čí syn je Josef?", "--about", "P1", "--variant", "A: syn Václava a Marie", "--variant", "B: syn Jakuba a Anny"]); // H1
  await w.ok(["hypothesis", "link", "H1", "A", "--child", "P1", "--of", "F1"]);
  await w.ok(["hypothesis", "link", "H1", "B", "--child", "P1", "--of", "F2"]);
  await w.ok(["hypothesis", "argue", "H1", "B", "--against", "sčítání S0002 uvádí Josefa u Václava"]);
  await w.ok(["hypothesis", "add", "Kde se Josef narodil?", "--about", "P1", "--variant", "A: v Lhotě", "--variant", "B: jinde"]); // H2
  return w;
}

const hyp = (w: World, id: string) => Tree.open(w.cwd, w.env).get<Hypothesis>(id)!;
const treeId = (w: World) => readJsonFile(path.join(w.cwd, "strom.json")).id as string;
const link = (w: World, query: string, answers: string[], tty = true) => w.run(["link", "open", `strom-research://${query.replace("<id>", treeId(w))}`], { tty, answers });
const opCount = (w: World) => Tree.open(w.cwd, w.env).readOps().length;
/** Who decides the hypotheses, as the person left it (the agent: where nothing is set). */
const decides = (w: World, who: "agent" | "person") => {
  const file = path.join(w.env.STROM_CONFIG_DIR!, "config.json");
  const cfg = readJsonFile(file);
  if (who === "agent") delete cfg["hypotheses.decide"];
  else cfg["hypotheses.decide"] = who;
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2));
};
/** The children of a family as the tree has them now. */
const kids = (w: World, id: string) => Tree.open(w.cwd, w.env).get<Family>(id)!.children.map((c) => c.person);
/** No word addressing the person. */
const impersonal = (s: string) => assert.doesNotMatch(s, /(?<![\p{L}\p{M}])(vy|vás|váš|vaše|ty|tvůj)(?![\p{L}\p{M}])/iu);

test("the link: a variant only of a decision, only a label; none holds, left open, taken back; several proposals by their IDs, at most 50", () => {
  const base = `strom-research://hypothesis?tree=${ID}&id=H0001`;
  assert.deepEqual(parseLink(`${base}&do=decide&variant=b`), { action: "hypothesis", tree: ID, id: "H0001", do: "decide", variant: "B" });
  assert.deepEqual(parseLink(`${base}&do=abandon`), { action: "hypothesis", tree: ID, id: "H0001", do: "abandon" });
  assert.deepEqual(parseLink(`${base}&do=keep-open`), { action: "hypothesis", tree: ID, id: "H0001", do: "keep-open" });
  assert.deepEqual(parseLink(`${base}&do=reopen`), { action: "hypothesis", tree: ID, id: "H0001", do: "reopen" });
  assert.deepEqual(parseLink(base), { action: "hypothesis", tree: ID, id: "H0001", do: "decide" });
  // never a text: a variant is a label, only with a decision
  for (const bad of ["Č", "B C", "ABCD", "1", encodeURIComponent("B; strom seal adopt")]) assert.throws(() => parseLink(`${base}&do=decide&variant=${bad}`), LinkError, bad);
  assert.throws(() => parseLink(`${base}&do=abandon&variant=B`), LinkError);
  assert.throws(() => parseLink(`${base}&do=forget`), LinkError);
  const many = `strom-research://hypotheses?tree=${ID}&do=accept`;
  assert.deepEqual(parseLink(`${many}&ids=H0001,h2,H0001`), { action: "hypotheses", tree: ID, do: "accept", ids: "H0001,H2" });
  assert.throws(() => parseLink(`${many}&ids=`), LinkError);
  assert.throws(() => parseLink(`${many}&ids=H1,P0001`), LinkError);
  assert.throws(() => parseLink(`${many}&ids=${Array.from({ length: 51 }, (_, i) => `H${i + 1}`).join(",")}`), LinkError);
  assert.throws(() => parseLink(`${many}&ids=H1&decide=agent`), LinkError);
});

test("a variant picked in the app: confirmed with Enter, written as the person's in the app; again the same — nothing; changed — the decision before kept; taken back while the tree records nothing", opts, async () => {
  const w = await world();
  try {
    // picked: the question, its variants, what it would write; Enter = yes, Enter = the app's words
    const d = await link(w, "hypothesis?tree=<id>&id=H1&do=decide&variant=A", ["", ""]);
    assert.equal(d.code, 0, d.out + d.err);
    assert.match(d.out, /^ H0001 · Čí syn je Josef\?$/mu, d.out);
    assert.match(d.out, /^ {4}B\) syn Jakuba a Anny$/mu, d.out);
    assert.match(d.out, /Aplikace Strom žádá: rozhodnout hypotézu H0001: platí varianta A – syn Václava a Marie/u, d.out);
    assert.match(d.out, /Proč\? \(Enter = „rozhodnuto v aplikaci Strom: varianta A“, 0 = nic neměnit\)/u, d.out);
    assert.match(d.out, /✓ Hypotéza H0001 je rozhodnutá\./u, d.out);
    impersonal(d.out);
    let h = hyp(w, "H0001");
    assert.deepEqual([h.state, h.chosen, h.decidedBy, h.decidedIn, h.decision, h.previous], ["decided", "A", "user", "app", "rozhodnuto v aplikaci Strom: varianta A", undefined]);
    // on the tree at once (K1.5): Josef a child of F1, said in the research language
    assert.deepEqual(kids(w, "F0001"), ["P0001"]);
    assert.match(d.out, /Ve stromu hned: Josef Lhoták \(P0001\) jako dítě rodiny Václav Lhoták \+ Marie Lhotová \(F0001\)\./u, d.out);
    // the change line says where it was decided
    const t = Tree.open(w.cwd, w.env);
    const lines = changeLines(t, t.readOps().filter((o) => o.op === "hypothesis.decide"), "", "cs").map((l) => l.text).join("\n");
    assert.match(lines, /H0001 rozhodnuto v aplikaci Strom: A – rozhodnuto v aplikaci Strom: varianta A/u, lines);
    assert.match(t.readOps().at(-1)!.summary ?? "", /in the Strom app$/u);
    // the same again: said, nothing written
    const n = opCount(w);
    const same = await link(w, "hypothesis?tree=<id>&id=H1&do=decide&variant=A", []);
    assert.match(same.out, /H0001 je rozhodnutá: platí varianta A – rozhodnuto v aplikaci Strom \d/u, same.out);
    assert.match(same.out, /Nic se nemění\./u, same.out);
    assert.doesNotMatch(same.out, /\d\.\./u, "a day that ends with its dot ends the sentence");
    assert.doesNotMatch(same.out, /\d\.\.(?!\.)/u, "a day that ends with its dot ends the sentence: never \"10. 11..\"");
    assert.equal(opCount(w), n);
    // a variant it has not: said, nothing written
    const none = await link(w, "hypothesis?tree=<id>&id=H1&do=decide&variant=C", []);
    assert.match(none.out, /H0001 nemá variantu C \(varianty: A, B\)\. Nic se nestalo\./u, none.out);
    // changed: why said; the decision before kept
    const c = await link(w, "hypothesis?tree=<id>&id=H1&do=decide&variant=B", ["a", "Matrika S0001 jmenuje Jakuba"]);
    assert.equal(c.code, 0, c.out + c.err);
    assert.match(c.out, /změnit rozhodnutí hypotézy H0001: nově platí varianta B/u, c.out);
    h = hyp(w, "H0001");
    assert.deepEqual([h.state, h.chosen, h.decision, h.decidedIn], ["decided", "B", "Matrika S0001 jmenuje Jakuba", "app"]);
    assert.deepEqual([h.previous?.state, h.previous?.chosen, h.previous?.by, h.previous?.in], ["decided", "A", "user", "app"]);
    // what A wrote taken off, B written
    assert.deepEqual([kids(w, "F0001"), kids(w, "F0002")], [[], ["P0001"]]);
    assert.match(c.out, /Ze stromu odebráno: Josef Lhoták \(P0001\) jako dítě rodiny .*\(F0001\)\.\n.*Ve stromu hned: Josef Lhoták \(P0001\) jako dítě rodiny .*\(F0002\)\./u, c.out);
    // 0 at why: nothing written
    const n2 = opCount(w);
    await link(w, "hypothesis?tree=<id>&id=H1&do=abandon", ["", "0"]);
    assert.equal(opCount(w), n2);
    assert.equal(hyp(w, "H0001").state, "decided");
    // taken back: open again, the decision before kept
    const r = await link(w, "hypothesis?tree=<id>&id=H1&do=reopen", ["", ""]);
    assert.equal(r.code, 0, r.out + r.err);
    assert.match(r.out, /✓ Hypotéza H0001 je znovu otevřená\./u, r.out);
    h = hyp(w, "H0001");
    assert.deepEqual([h.state, h.chosen, h.decidedIn, h.previous?.chosen, h.previous?.in, h.wrote], ["open", undefined, undefined, "B", "app", undefined]);
    assert.deepEqual(kids(w, "F0002"), [], "what the decision wrote is taken off with it");
    assert.match(r.out, /Ze stromu odebráno: Josef Lhoták \(P0001\) jako dítě rodiny .*\(F0002\)\./u, r.out);
    // open: nothing to take back
    const again = await link(w, "hypothesis?tree=<id>&id=H1&do=reopen", []);
    assert.match(again.out, /H0001 je otevřená, není co vracet\./u, again.out);
    // none holds: abandoned, the app's words
    const a = await link(w, "hypothesis?tree=<id>&id=H1&do=abandon", ["", ""]);
    assert.match(a.out, /✓ Hypotéza H0001 je rozhodnutá: neplatí žádná z jejích variant\./u, a.out);
    h = hyp(w, "H0001");
    assert.deepEqual([h.state, h.decision, h.decidedIn], ["abandoned", "neplatí žádná z variant – rozhodnuto v aplikaci Strom", "app"]);
    assert.deepEqual([kids(w, "F0001"), kids(w, "F0002")], [[], []], "none holds: nothing written");
    impersonal([c.out, r.out, a.out].join("\n"));
  } finally {
    w.cleanup();
  }
});

test("taken back while nothing stands on what it wrote: an agent's record of it, or other work on it — refused with how many links; reopen refused to an agent, to an open one", opts, async () => {
  const w = await world();
  try {
    await link(w, "hypothesis?tree=<id>&id=H1&do=decide&variant=A", ["", ""]);
    // a fact of Josef's own since: it does not rest on whose son he is — taken back all the same
    await w.ok(["event", "add", "P1", "CHR", "--date", "1850", "--cite", "S1"]);
    const back = await link(w, "hypothesis?tree=<id>&id=H1&do=reopen", ["", ""]);
    assert.match(back.out, /Ze stromu odebráno: Josef Lhoták \(P0001\) jako dítě rodiny .*\(F0001\)\./u, back.out);
    assert.deepEqual([hyp(w, "H0001").state, kids(w, "F0001")], ["open", []]);
    await link(w, "hypothesis?tree=<id>&id=H1&do=decide&variant=A", ["", ""]);
    // other work on what the decision wrote: a fact of the family since
    await w.ok(["event", "add", "F1", "MARR", "--date", "1849", "--cite", "S1"]);
    const n = opCount(w);
    const r = await link(w, "hypothesis?tree=<id>&id=H1&do=reopen", []);
    assert.match(r.out, /Na tom, co rozhodnutí hypotézy H0001 zapsalo do stromu, už stojí další práce \(vazby: 1\); odkazem ho vrátit nejde\./u, r.out);
    assert.equal(opCount(w), n);
    const cli = await w.run(["hypothesis", "decide", "H1", "--reopen", "--json"]);
    assert.notEqual(cli.code, 0);
    assert.match(cli.out + cli.err, /hypothesis\.reopen\.work/u);
    assert.deepEqual(kids(w, "F0001"), ["P0001"], "nothing taken off");
    // changed for B: what other work stands on stays the tree's — B's link then cannot be written (Josef's parents):
    // said before, cancel suggested (Enter: nothing changes)
    const stays = /Stará vazba zůstane ve stromu, stojí na ní další práce: Josef Lhoták \(P0001\) jako dítě rodiny .*\(F0001\); nová se nezapíše: Josef Lhoták \(P0001\) jako dítě rodiny .*\(F0002\)\./u;
    const n0 = opCount(w);
    const c0 = await link(w, "hypothesis?tree=<id>&id=H1&do=decide&variant=B", [""]);
    assert.match(c0.out, stays, c0.out);
    assert.match(c0.out, /Pokračovat\? \(a\/n\)/u, c0.out);
    assert.deepEqual([opCount(w), hyp(w, "H0001").chosen], [n0, "A"]);
    // gone on all the same: decided for B, the old link kept, B's not written with why, left to the agent
    const c = await link(w, "hypothesis?tree=<id>&id=H1&do=decide&variant=B", ["a", ""]);
    assert.equal(c.code, 0, c.out + c.err);
    assert.match(c.out, /Ve stromu zůstává, stojí na tom další práce: Josef Lhoták \(P0001\) jako dítě rodiny .*\(F0001\)\./u, c.out);
    assert.match(c.out, /Do stromu nezapsáno: Josef Lhoták \(P0001\) jako dítě rodiny .*\(F0002\) \(stará vazba zůstává, stojí na ní další práce\)\./u, c.out);
    assert.match(c.out, /Co se do stromu nezapsalo, zapíše agent při své příští práci\./u, c.out);
    assert.deepEqual([kids(w, "F0001"), kids(w, "F0002"), hyp(w, "H0001").chosen, hyp(w, "H0001").wrote], [["P0001"], [], "B", undefined]);
    // recorded by an agent with its sources (not by the decision): refused as before
    await w.ok(["hypothesis", "decide", "H2", "--variant", "A", "--decision", "křest S0001 v Lhotě"]);
    await w.ok(["hypothesis", "add", "Čí dcera je Anna?", "--about", "P5", "--variant", "A: Václava a Marie", "--variant", "B: jiných"]); // H3
    await w.ok(["hypothesis", "link", "H3", "A", "--child", "P5", "--of", "F1"]);
    await w.ok(["hypothesis", "argue", "H3", "A", "--for", "křest S0001 jmenuje Václava"]);
    decides(w, "agent");
    await w.ok(["hypothesis", "decide", "H3", "--variant", "A", "--decision", "křest S0001"], AGENT);
    assert.deepEqual([kids(w, "F0001"), hyp(w, "H0003").wrote], [["P0001"], undefined], "an agent's decision writes nothing by itself");
    await w.ok(["family", "child", "F1", "P5", "--cite", "S1"], AGENT);
    decides(w, "person");
    const rec = await link(w, "hypothesis?tree=<id>&id=H3&do=reopen", []);
    assert.match(rec.out, /Rozhodnutí hypotézy H0003 už je zapsané ve stromu \(vazby: 1\); odkazem ho vrátit nejde\./u, rec.out);
    const cli3 = await w.run(["hypothesis", "decide", "H3", "--reopen", "--json"]);
    assert.match(cli3.out + cli3.err, /hypothesis\.reopen\.recorded/u);
    // an agent never takes a decision back
    const agent = await w.run(["hypothesis", "decide", "H2", "--reopen"], AGENT);
    assert.notEqual(agent.code, 0);
    assert.equal(hyp(w, "H0002").state, "decided");
    // the person here: taken back, the reason kept
    await w.ok(["hypothesis", "decide", "H2", "--reopen", "--reason", "křest S0001 je jiného Josefa"]);
    const h2 = hyp(w, "H0002");
    assert.deepEqual([h2.state, h2.previous?.chosen, h2.previous?.by, h2.previous?.in], ["open", "A", "user", undefined]);
    const open = await w.run(["hypothesis", "decide", "H2", "--reopen", "--json"]);
    assert.match(open.out + open.err, /hypothesis\.reopen\.open/u);
    impersonal([back.out, r.out, c0.out, c.out, rec.out].join("\n"));
    assert.equal((await w.ok(["check"])).code, 0);
  } finally {
    w.cleanup();
  }
});

test("a fact, name or source of the child's own is no work on whose child it is: taken back and changed as if none were there; a merge into it is", opts, async () => {
  const w = await world();
  try {
    await w.ok(["hypothesis", "argue", "H1", "A", "--for", "křest S0001 jmenuje Václava"]);
    await w.ok(["hypothesis", "decide", "H1", "--variant", "A", "--decision", "křest S0001"]);
    await w.ok(["event", "add", "P1", "BIRT", "--date", "1850", "--cite", "S1"]);
    await w.ok(["name", "add", "P1", "Josephus /Lhoták/"]);
    await w.ok(["event", "add", "P2", "OCCU", "--value", "sedlák", "--cite", "S2"]);
    // taken back: the link off, the facts stay
    const r = await w.ok(["hypothesis", "decide", "H1", "--reopen", "--reason", "jiný Josef"]);
    assert.match(r.out, /taken off the tree: child P0001 of F0001 \(F0001\)/u, r.out);
    assert.deepEqual([hyp(w, "H0001").state, kids(w, "F0001")], ["open", []]);
    // decided again, a fact of Josef's since, changed for B: A's link off, B's written — the tree as decided
    await w.ok(["hypothesis", "decide", "H1", "--variant", "A", "--decision", "křest S0001"]);
    await w.ok(["event", "add", "P1", "DEAT", "--date", "1900"]);
    const c = await w.ok(["hypothesis", "decide", "H1", "--variant", "B", "--decision", "Jakub", "--reason", "jiný zápis"]);
    assert.match(c.out, /taken off the tree: child P0001 of F0001 \(F0001\)\non the tree now: child P0001 of F0002 \(F0002\)/u, c.out);
    assert.doesNotMatch(c.out, /kept on the tree|not written/u, c.out);
    assert.deepEqual([kids(w, "F0001"), kids(w, "F0002")], [[], ["P0001"]]);
    // the change fully written: nothing of the earlier variant left to the agent (its source S1 went with its link)
    assert.doesNotMatch(c.out, /agent/u, c.out);
    assert.doesNotMatch((await w.ok(["brief"])).out, /Decided by the user/u);
    // another record of Josef merged into him since: that stands on whose son he is
    await w.ok(["person", "add", "Josef /Lhoták/", "--sex", "M"]); // P6
    await w.ok(["person", "merge", "P1", "P6", "--reason", "týž Josef"]);
    const m = await w.run(["hypothesis", "decide", "H1", "--reopen", "--json"]);
    assert.match(m.out + m.err, /hypothesis\.reopen\.work/u, m.out + m.err);
    assert.equal((await w.ok(["check"])).code, 0);
  } finally {
    w.cleanup();
  }
});

test("said before a change the tree cannot follow, on the hypothesis's own screen too; a link the tree refuses said why and left to the agent — never in an archive", opts, async () => {
  const w = await world();
  try {
    await w.ok(["hypothesis", "decide", "H1", "--variant", "A", "--decision", "křest"]);
    await w.ok(["cite", "F1", "S2"]);
    // the hypothesis's screen (no variant in the link): change → B → said first, Enter cancels
    const n = opCount(w);
    const s0 = await link(w, "hypothesis?tree=<id>&id=H1", ["", "1", "2", ""]);
    assert.match(s0.out, /Stará vazba zůstane ve stromu, stojí na ní další práce: Josef Lhoták \(P0001\) jako dítě rodiny .*\(F0001\); nová se nezapíše: Josef Lhoták \(P0001\) jako dítě rodiny .*\(F0002\)\./u, s0.out);
    assert.deepEqual([opCount(w), hyp(w, "H0001").chosen], [n, "A"]);
    // the decision changed to none holds: nothing to write, nothing said first
    // a child with birth parents already: not written, why, and the agent's
    await w.ok(["person", "add", "Filip /Lhoták/", "--sex", "M"]); // P6
    await w.ok(["family", "child", "F2", "P6"]);
    await w.ok(["hypothesis", "add", "Čí syn je Filip?", "--about", "P6", "--variant", "A: syn Václava a Marie", "--variant", "B: jiných"]); // H3
    await w.ok(["hypothesis", "link", "H3", "A", "--child", "P6", "--of", "F1"]);
    const d = await link(w, "hypothesis?tree=<id>&id=H3&do=decide&variant=A", ["", ""]);
    assert.equal(d.code, 0, d.out + d.err);
    assert.match(d.out, /Do stromu nezapsáno: Filip Lhoták \(P0006\) jako dítě rodiny .*\(F0001\) \(už má rodiče narozením v rodině .*\(F0002\)\)\./u, d.out);
    assert.match(d.out, /Co se do stromu nezapsalo, zapíše agent při své příští práci\./u, d.out);
    impersonal([s0.out, d.out].join("\n"));
    // an archive: why, never the agent
    await w.ok(["hypothesis", "decide", "H3", "--reopen", "--reason", "znovu"]);
    await w.ok(["mode", "archive"], { tty: true, answers: ["", "", ""] });
    const a = await link(w, "hypothesis?tree=<id>&id=H3&do=decide&variant=A", ["", ""]);
    assert.match(a.out, /Do stromu nezapsáno: Filip Lhoták \(P0006\) .*\(už má rodiče narozením v rodině/u, a.out);
    assert.doesNotMatch(a.out, /agent/iu, a.out);
  } finally {
    w.cleanup();
  }
});

test("a hypothesis whose variants connect nothing is a pick (K1.6): Enter decides it, the tree stays, said so; changed, taken back, none holds, left open; never _REOPEN tree", opts, async () => {
  const w = await world();
  try {
    const fams = () => Tree.open(w.cwd, w.env).list<Family>("family").map((f) => `${f.id}:${f.children.map((c) => c.person).join(",")}:${f.retracted ? "x" : ""}`).join(" ");
    const before = fams();
    const n = opCount(w);
    const d = await link(w, "hypothesis?tree=<id>&id=H2&do=decide&variant=A", ["", ""]);
    assert.equal(d.code, 0, d.out + d.err);
    assert.match(d.out, /Aplikace Strom žádá: rozhodnout hypotézu H0002: platí varianta A – v Lhotě\nVýzkum: [^\n]*\nStrom se nezmění\./u, d.out);
    assert.doesNotMatch(d.out, /nejde rozhodnout volbou|Ve stromu hned|připojí/u, d.out);
    assert.match(d.out, /✓ Hypotéza H0002 je rozhodnutá\./u, d.out);
    impersonal(d.out);
    let h = hyp(w, "H0002");
    assert.deepEqual([h.state, h.chosen, h.decidedBy, h.decidedIn, h.wrote], ["decided", "A", "user", "app", undefined]);
    assert.equal(fams(), before, "only the decision written");
    assert.deepEqual(Tree.open(w.cwd, w.env).readOps().slice(n).map((o) => o.op), ["hypothesis.decide"]);
    // in the file for the app: a pick, decided in the app, never "the tree records it"
    const base = { for: "strom", research: true, hypothesisLinks: true, hypothesisDecider: true, hypothesisPick: { agent: true } } as const;
    const block = () => (exportGedcom(Tree.open(w.cwd, w.env), base as never).text ?? "").split(/\n(?=1 )/u).find((b) => b.startsWith("1 _STROM_HYPO") && b.includes("Kde se Josef narodil?")) ?? "";
    assert.match(block(), /\n2 _BY app\n(?:.*\n)*2 _PICK Y\n/u, block());
    assert.doesNotMatch(block(), /_REOPEN/u, block());
    // changed to B: the same, the decision before kept
    const c = await link(w, "hypothesis?tree=<id>&id=H2&do=decide&variant=B", ["", ""]);
    assert.match(c.out, /změnit rozhodnutí hypotézy H0002: nově platí varianta B – jinde\nVýzkum: [^\n]*\nStrom se nezmění\./u, c.out);
    h = hyp(w, "H0002");
    assert.deepEqual([h.chosen, h.previous?.chosen, h.previous?.in], ["B", "A", "app"]);
    // taken back: open again, nothing on the tree to take off
    const r = await link(w, "hypothesis?tree=<id>&id=H2&do=reopen", ["", ""]);
    assert.equal(r.code, 0, r.out + r.err);
    assert.equal(hyp(w, "H0002").state, "open");
    // none holds; then left open after taking that back
    await link(w, "hypothesis?tree=<id>&id=H2&do=abandon", ["", ""]);
    assert.equal(hyp(w, "H0002").state, "abandoned");
    await link(w, "hypothesis?tree=<id>&id=H2&do=reopen", ["", ""]);
    const k = await link(w, "hypothesis?tree=<id>&id=H2&do=keep-open", [""]);
    assert.match(k.out, /✓ Hypotéza H0002 zůstává otevřená\./u, k.out);
    assert.equal(fams(), before);
    // a variant without a link beside one with: what the earlier decision wrote is taken off — never "the tree stays"
    await w.ok(["hypothesis", "add", "Je Josef syn Václava?", "--about", "P1", "--variant", "A: syn Václava a Marie", "--variant", "B: syn někoho jiného"]); // H3
    await w.ok(["hypothesis", "link", "H3", "A", "--child", "P1", "--of", "F1"]);
    await link(w, "hypothesis?tree=<id>&id=H3&do=decide&variant=A", ["", ""]);
    assert.deepEqual(kids(w, "F0001"), ["P0001"]);
    const m = await link(w, "hypothesis?tree=<id>&id=H3&do=decide&variant=B", ["", ""]);
    assert.doesNotMatch(m.out, /Strom se nezmění/u, m.out);
    assert.deepEqual([hyp(w, "H0003").chosen, kids(w, "F0001")], ["B", []]);
  } finally {
    w.cleanup();
  }
});

test("not a pick of the app (the same person, siblings, either beside whose child): said, then its whole screen; left open — with a proposal, without, already", opts, async () => {
  const w = await world();
  try {
    await w.ok(["person", "add", "Josef /Lhoták/", "--sex", "M"]); // P6
    await w.ok(["hypothesis", "add", "Je Josef z Lhoty týž?", "--about", "P1", "--variant", "A: tentýž", "--variant", "B: jiný"]); // H3
    await w.ok(["hypothesis", "link", "H3", "A", "--same", "P1", "P6"]);
    const n = opCount(w);
    const s = await link(w, "hypothesis?tree=<id>&id=H3&do=decide&variant=A", ["n"]);
    assert.match(s.out, /H0003 nejde rozhodnout volbou v aplikaci; rozhoduje se tady, na celé obrazovce\./u, s.out);
    assert.match(s.out, /rozhodnout hypotézu: Je Josef z Lhoty týž\?/u, s.out);
    assert.equal(opCount(w), n);
    assert.equal(hyp(w, "H0003").state, "open");
    // whose child beside the same person: decided in the research; siblings too
    const mixed = { ...hyp(w, "H0001"), variants: [{ label: "A", claim: "x", support: [], links: [{ kind: "child", person: "P0001", family: "F0001" }] }, { label: "B", claim: "y", support: [], links: [{ kind: "same", persons: ["P0001", "P0006"] }] }] } as unknown as Hypothesis;
    assert.equal(pickableInApp(mixed), false);
    assert.equal(pickableInApp({ ...mixed, variants: [{ label: "A", claim: "x", support: [], links: [{ kind: "siblings", persons: ["P0001", "P0006"] }] }, { label: "B", claim: "y", support: [] }] } as unknown as Hypothesis), false);
    assert.equal(pickableInApp({ ...mixed, variants: [{ label: "A", claim: "x", support: [] }, { label: "B", claim: "y", support: [] }] } as unknown as Hypothesis), true, "no links at all: a pick");
    // left open, with the agent's proposal: the proposal not taken
    await w.ok(["hypothesis", "propose", "H1", "--variant", "A", "--decision", "křest S0001 jmenuje Václava"], AGENT);
    const k = await link(w, "hypothesis?tree=<id>&id=H1&do=keep-open", [""]);
    assert.match(k.out, /nechat hypotézu H0001 otevřenou, návrh agenta nepřijmout/u, k.out);
    assert.match(k.out, /✓ Hypotéza H0001 zůstává otevřená\./u, k.out);
    let h = hyp(w, "H0001");
    assert.deepEqual([h.state, h.proposal, typeof h.leftOpen], ["open", undefined, "string"]);
    // left open already, no proposal since: nothing
    const n2 = opCount(w);
    const k2 = await link(w, "hypothesis?tree=<id>&id=H1&do=keep-open", []);
    assert.match(k2.out, /Hypotéza H0001 už je ponechaná otevřená\. Nic se nemění\./u, k2.out);
    assert.equal(opCount(w), n2);
    // a decided one is not left open: taken back
    await link(w, "hypothesis?tree=<id>&id=H1&do=decide&variant=B", ["", ""]);
    const k3 = await link(w, "hypothesis?tree=<id>&id=H1&do=keep-open", []);
    assert.match(k3.out, /Znovu otevřená bude po vrácení rozhodnutí\./u, k3.out);
    h = hyp(w, "H0001");
    assert.equal(h.state, "decided");
  } finally {
    w.cleanup();
  }
});

test("the agent's proposals taken at once: listed, the ones it cannot take said why; one yes, each decided as proposed in the app", opts, async () => {
  const w = await world();
  try {
    await w.ok(["hypothesis", "propose", "H1", "--variant", "B", "--decision", "matrika S0001 jmenuje Jakuba"], AGENT);
    await w.ok(["hypothesis", "propose", "H2", "--variant", "A", "--decision", "křest S0001 v Lhotě"], AGENT);
    const r = await link(w, "hypotheses?tree=<id>&do=accept&ids=H1,H2,H7", [""]);
    assert.equal(r.code, 0, r.out + r.err);
    assert.match(r.out, /Návrhy agenta k přijetí:\n {2}H0001 → varianta B: syn Jakuba a Anny/u, r.out);
    assert.match(r.out, /\n {2}H0002 → varianta A: v Lhotě\n/u, r.out);
    assert.match(r.out, /Vynechané:\n {2}H7: v tomto výzkumu není/u, r.out);
    assert.match(r.out, /✓ Rozhodnuto podle návrhu: 2\./u, r.out);
    impersonal(r.out);
    const h = hyp(w, "H0001");
    assert.deepEqual([h.state, h.chosen, h.decidedIn, h.decidedBy, h.proposal], ["decided", "B", "app", "user", undefined]);
    assert.deepEqual(kids(w, "F0002"), ["P0001"], "on the tree at once, as one decided alone");
    assert.match(r.out, /H0001: Ve stromu hned: Josef Lhoták \(P0001\) jako dítě rodiny .*\(F0002\)\./u, r.out);
    assert.deepEqual([hyp(w, "H0002").state, hyp(w, "H0002").chosen, hyp(w, "H0002").decidedIn], ["decided", "A", "app"], "no links: only the decision (K1.6)");
    // nothing to take: said, nothing written
    const n = opCount(w);
    const none = await link(w, "hypotheses?tree=<id>&do=accept&ids=H1", []);
    assert.match(none.out, /Žádný z návrhů agenta tu nejde přijmout\. Nic se nestalo\.\n {2}H0001: návrh už není/u, none.out);
    assert.equal(opCount(w), n);
    // a decided one changed by its proposal while other work stands on the old link: said first, nothing promised,
    // Enter cancels; a yes changes the decision, the old link stays
    await w.ok(["hypothesis", "decide", "H1", "--variant", "A", "--decision", "křest", "--reason", "křest"]);
    await w.ok(["cite", "F1", "S2"]);
    await w.ok(["hypothesis", "propose", "H1", "--variant", "B", "--decision", "matrika S0001 jmenuje Jakuba", "--reason", "matrika S0001 to vyvrací"], AGENT);
    const n2 = opCount(w);
    const warn = await link(w, "hypotheses?tree=<id>&do=accept&ids=H1", [""]);
    assert.match(warn.out, /H0001 → varianta B: syn Jakuba a Anny\n {4}Stará vazba zůstane ve stromu, stojí na ní další práce: Josef Lhoták \(P0001\) jako dítě rodiny .*\(F0001\); nová se nezapíše: Josef Lhoták \(P0001\) jako dítě rodiny .*\(F0002\)\./u, warn.out);
    assert.doesNotMatch(warn.out, /připojí/u, warn.out);
    assert.match(warn.out, /\(a\/n\) \[n\]/u, warn.out);
    assert.deepEqual([opCount(w), hyp(w, "H0001").chosen, hyp(w, "H0001").proposal?.variant], [n2, "A", "B"]);
    impersonal(warn.out);
    const yes = await link(w, "hypotheses?tree=<id>&do=accept&ids=H1", ["a"]);
    assert.match(yes.out, /✓ Rozhodnuto podle návrhu: 1\./u, yes.out);
    assert.equal(hyp(w, "H0001").chosen, "B");
    assert.deepEqual(kids(w, "F0001"), ["P0001"], "the old link stays");
  } finally {
    w.cleanup();
  }
});

test("for an app that decides them by a pick: who decided where, the decision before, the proposal (never in an archive), what speaks against — in the file, valid; /status waiting and its features; the gate", opts, async () => {
  const w = await world();
  try {
    await link(w, "hypothesis?tree=<id>&id=H1&do=decide&variant=A", ["", ""]);
    await link(w, "hypothesis?tree=<id>&id=H1&do=decide&variant=B", ["", "Matrika S0001 jmenuje Jakuba"]);
    await w.ok(["hypothesis", "propose", "H2", "--variant", "A", "--decision", "křest S0001 v Lhotě"], AGENT);
    const t = Tree.open(w.cwd, w.env);
    const base = { for: "strom", research: true, hypothesisLinks: true, hypothesisDecider: true } as const;
    const plain = exportGedcom(t, base as never).text ?? "";
    assert.doesNotMatch(plain, /_PICK|_PREV|_PROP|_AGAINST|_BY app/u, "an older app: today's file");
    const file = exportGedcom(t, { ...base, hypothesisPick: { agent: true } } as never).text ?? "";
    const block = (text: string, q: string) => text.split(/\n(?=1 )/u).find((b) => b.startsWith("1 _STROM_HYPO") && b.includes(q)) ?? "";
    const h1 = block(file, "Čí syn je Josef?");
    assert.match(h1, /\n2 _BY app\n/u, h1);
    assert.match(h1, /\n2 _PICK Y\n/u, h1);
    assert.match(h1, /\n2 _PREV A\n3 _BY app\n3 DECI rozhodnuto v aplikaci Strom: varianta A\n3 _AT \d{4}-\d{2}-\d{2}\n/u, h1);
    assert.match(h1, /\n3 _AGAINST sčítání S0002 uvádí Josefa u Václava\n4 SOUR @S\d+@/u, h1);
    assert.doesNotMatch(h1, /_REOPEN/u, "nothing stands on what it wrote");
    const h2 = block(file, "Kde se Josef narodil?");
    assert.match(h2, /\n2 STAT open\n/u, h2);
    assert.match(h2, /\n2 _PROP A\n3 DECI křest S0001 v Lhotě\n3 _AT \d{4}-\d{2}-\d{2}/u, h2);
    assert.match(h2, /\n2 _PICK Y\n/u, "no links: a pick too (K1.6)");
    assert.equal(hasGedErrors(validateGedcom(file)), false, JSON.stringify(validateGedcom(file)));
    // where no agent works: no proposal, no agent
    const archive = exportGedcom(t, { ...base, hypothesisPick: { agent: false } } as never).text ?? "";
    assert.doesNotMatch(archive, /_PROP/u);
    // the bridge's /tree.ged: the same for another copy of the app, nothing new for the production app
    const ged = (url: string) => buildGed({ root: w.cwd, env: { ...w.env, STROM_APP_URL: url }, head: headOf(w.cwd) ?? "", version: "3.30.0", links: [], budgetMs: 0 }).bytes.toString("utf8");
    assert.match(block(ged("https://beta.stromapp.info/run/"), "Kde se Josef narodil?"), /\n2 _PROP A\n/u);
    assert.match(block(ged("https://beta.stromapp.info/run/"), "Čí syn je Josef?"), /\n2 _PICK Y\n/u);
    assert.doesNotMatch(ged("https://stromapp.info/run/"), /_PICK|_PROP|_PREV/u);
    // the decision on the tree at once (K1.5): Josef a child of F2 in the file and in the bridge's /tree.ged
    assert.match(file, /\n0 @F0002@ FAM\n(?:[1-9].*\n)*1 CHIL @P0001@\n/u);
    assert.match(ged("https://stromapp.info/run/"), /\n0 @F0002@ FAM\n(?:[1-9].*\n)*1 CHIL @P0001@\n/u);
    // a fact of Josef's own: nothing rests on it — it can be taken back
    await w.ok(["event", "add", "P1", "OCCU", "--value", "rolník"]);
    const own = block(exportGedcom(Tree.open(w.cwd, w.env), { ...base, hypothesisPick: { agent: true } } as never).text ?? "", "Čí syn je Josef?");
    assert.doesNotMatch(own, /_REOPEN/u, own);
    // other work on what it wrote (another child of the family): it cannot be taken back, and A picked changes nothing
    // on the tree (Josef stays F2's, A's link cannot be written) — said, so the app never offers "another variant changes it"
    await w.ok(["family", "child", "F2", "P3", "--relation", "adopted"]);
    const recFile = exportGedcom(Tree.open(w.cwd, w.env), { ...base, hypothesisPick: { agent: true } } as never).text ?? "";
    const rec = block(recFile, "Čí syn je Josef?");
    assert.match(rec, /\n2 _REOPEN no\n3 TYPE work\n3 _COUNT 1\n3 _STAYS A\n/u, rec);
    assert.equal(hasGedErrors(validateGedcom(recFile)), false, JSON.stringify(validateGedcom(recFile)));
    // /status waiting: for the app as the menu has them, each with its person, the proposal, whether a pick decides it
    const items = waitingFor(Tree.open(w.cwd, w.env), { hypothesesApp: { open: true } }).filter((x) => x.item.kind === "hypothesis");
    assert.deepEqual(items.map((x) => [x.item.id, x.item.person, x.item.proposal, x.item.pick, x.terminalOnly]), [["H0002", "P0001", "A", true, undefined]]);
    await w.ok(["hypothesis", "add", "Kdo je otec Anny?", "--about", "P5", "--variant", "A: Jakub", "--variant", "B: jiný"]); // H3
    await w.ok(["hypothesis", "link", "H3", "A", "--child", "P5", "--of", "F1"]);
    const open = waitingFor(Tree.open(w.cwd, w.env), { hypothesesApp: { open: true } }).filter((x) => x.item.kind === "hypothesis");
    assert.deepEqual(open.map((x) => [x.item.id, x.item.person, x.item.pick]), [["H0002", "P0001", true], ["H0003", "P0005", true]]);
    assert.deepEqual(waitingFor(Tree.open(w.cwd, w.env), {}).filter((x) => x.item.kind === "hypothesis"), [], "an older app: none");
    // the features; the gate — another copy of the app from 3.27.0-beta.4, the production app not yet
    assert.ok(BRIDGE_FEATURES.includes("hypothesis.decide.link") && BRIDGE_FEATURES.includes("hypotheses.accept.link"));
    const prod = new Settings({ ...w.env, STROM_APP_URL: "https://stromapp.info/run/" }, {});
    const beta = new Settings({ ...w.env, STROM_APP_URL: "https://beta.stromapp.info/run/" }, {});
    assert.equal(APP_DECIDES_HYPOTHESES_BETA, "3.27.0-beta.4");
    assert.equal(APP_DECIDES_HYPOTHESES, undefined, "the production app decides no hypothesis yet");
    assert.equal(appDecidesHypotheses(prod, "3.40.0"), false);
    assert.equal(appDecidesHypotheses(prod, "3.26.0"), false, "the production app today");
    assert.equal(appDecidesHypotheses(beta, "3.27.0-beta.3"), false, "the beta before the one that decides");
    assert.equal(appDecidesHypotheses(beta, "3.27.0-beta.4"), true);
    assert.equal(appDecidesHypotheses(beta, undefined), false, "a beta copy of unknown version: nothing, as production");
    assert.equal(appDecidesHypotheses(prod, "3.30.0", "3.30.0"), true);
    assert.equal(appDecidesHypotheses(prod, "3.29.9", "3.30.0"), false);
    assert.equal(appDecidesHypotheses(prod, undefined, "3.30.0"), false, "an unknown version stays off");
    assert.equal(appDecidesHypotheses(beta, "3.29.0", "3.30.0", "3.30.0-beta.1"), false);
  } finally {
    w.cleanup();
  }
});
