// Who decides the hypotheses, for a person (spec 060): the setup asks it (a person at a terminal only), the menu's
// settings change it (the agent deciding: on the person's second yes), What waits shows the open hypotheses with no
// proposal where the person decides them (left open: gone from it), one screen decides one, leaves it open or changes
// its decision (the reason asked, an agent's decision said so) — from What waits, a person's review and the Strom app's
// links (strom-research://hypothesis, strom-research://hypotheses). An archive says nothing of an agent.

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { waitingFor } from "../../src/core/waiting.ts";
import type { Hypothesis } from "../../src/core/model.ts";

const opts = { skip: !hasGit };
const AGENT = { env: { AI_AGENT: "1" } };

/**
 * Josef Lhoták (P1, the research's) whose parents are unknown; a couple Václav Lhoták + Marie Lhotová (P2, P3, F1).
 * H1: whose son Josef is — A the couple's (linked), B another family's. H2: where he was born — no links. S1 a baptism.
 */
async function world(): Promise<World> {
  const w = new World();
  await w.withTree();
  await w.ok(["lang", "cs"]);
  await w.ok(["research", "new", "Předci Josefa", "--new-person", "Josef /Lhoták/", "--sex", "M"]); // P1
  await w.ok(["person", "add", "Václav /Lhoták/", "--sex", "M"]); // P2
  await w.ok(["person", "add", "Marie /Lhotová/", "--sex", "F"]); // P3
  await w.ok(["family", "add", "--partner", "P2", "--partner", "P3"]); // F1
  await w.ok(["source", "add", "Křest Josefa 1850 v Lhotě", "--kind", "baptism"]); // S1
  await w.ok(["hypothesis", "add", "Čí syn je Josef?", "--about", "P1", "--variant", "A: syn Václava a Marie", "--variant", "B: z jiné rodiny"]); // H1
  await w.ok(["hypothesis", "link", "H1", "A", "--child", "P1", "--of", "F1"]);
  await w.ok(["hypothesis", "add", "Kde se Josef narodil?", "--about", "P1", "--variant", "A: v Lhotě", "--variant", "B: jinde"]); // H2
  return w;
}

const hyp = (w: World, id: string) => Tree.open(w.cwd, w.env).get<Hypothesis>(id)!;
const decide = async (w: World) => (await w.ok(["config", "get", "hypotheses.decide"])).out.trim();
const treeId = (w: World) => readJsonFile(path.join(w.cwd, "strom.json")).id as string;
const link = (w: World, query: string, answers: string[], tty = true) => w.run(["link", "open", `strom-research://${query.replace("<id>", treeId(w))}`], { tty, answers });
/** No word addressing the person, in any of the research's languages here. */
const impersonal = (s: string) => assert.doesNotMatch(s, /(?<![\p{L}\p{M}])(vy|vás|váš|vaše|ty|tvůj|rozhoduji)(?![\p{L}\p{M}])/iu);
/** The number of a menu item, by its words. */
const itemOf = (out: string, words: string) => new RegExp(String.raw`^ +(\d) {2}${words}`, "mu").exec(out)?.[1];

test("What waits: the open hypotheses with no proposal where the person decides them, after the proposals; left open — gone; the agent deciding them — none", opts, async () => {
  const w = await world();
  try {
    const kinds = (o: { hypothesesOpen?: boolean }) => waitingFor(Tree.open(w.cwd, w.env), { hypotheses: true, ...o }).filter((x) => x.item.kind === "hypothesis").map((x) => x.item.id);
    assert.deepEqual(kinds({}), [], "without the person deciding them: only proposals");
    assert.deepEqual(kinds({ hypothesesOpen: true }), ["H0001", "H0002"]);
    // a proposal comes first
    await w.ok(["hypothesis", "propose", "H2", "--variant", "A", "--decision", "křest S0001 v Lhotě"], AGENT);
    assert.deepEqual(kinds({ hypothesesOpen: true }), ["H0002", "H0001"]);
    // the proposal not taken: left open, it waits no more
    await w.ok(["hypothesis", "decide", "H2", "--keep-open"]);
    assert.deepEqual(kinds({ hypothesesOpen: true }), ["H0001"]);
    // the menu: What waits, the group (the one in it opened at once): Decide / Leave it open — left open
    const menu = await w.ok([], { tty: true, answers: ["0"] });
    const item = itemOf(menu.out, "Co čeká");
    assert.ok(item, menu.out);
    const r = await w.ok([], { tty: true, answers: [item, "1", "2", "0", "0"] });
    assert.match(r.out, /Hypotézy k rozhodnutí/u, r.out);
    assert.match(r.out, /^ H0001 · hypotéza · od /mu, r.out);
    assert.match(r.out, /^ Čí syn je Josef\?$/mu, r.out);
    assert.match(r.out, /^ {4}A\) syn Václava a Marie$/mu, r.out);
    assert.match(r.out, /^ {3}1 {2}Rozhodnout$/mu, r.out);
    assert.match(r.out, /^ {3}2 {2}Nechat otevřenou$/mu, r.out);
    assert.match(r.out, /Hypotéza zůstává otevřená; Co čeká ji už neukazuje/u, r.out);
    impersonal(r.out);
    const h = hyp(w, "H0001");
    assert.deepEqual([h.state, typeof h.leftOpen], ["open", "string"]);
    assert.deepEqual(kinds({ hypothesesOpen: true }), [], "left open: no longer waiting");
    assert.match((await w.ok([], { tty: true, answers: [item, "0"] })).out, /Nic nečeká\./u);
    // the agent deciding them: What waits shows none without a proposal
    await w.ok(["hypothesis", "add", "Kdy se Josef oženil?", "--about", "P1", "--variant", "A: 1875", "--variant", "B: 1880"]); // H3
    assert.ok(kinds({ hypothesesOpen: true }).includes("H0003"));
    await w.ok(["config", "set", "hypotheses.decide", "agent", "--for-tree"], { tty: true });
    const a = await w.ok([], { tty: true, answers: [item, "0", "0"] });
    assert.doesNotMatch(a.out, /Kdy se Josef oženil/u, a.out);
  } finally {
    w.cleanup();
  }
});

test("one screen: an open hypothesis decided (a variant, why); a decided one's decision changed (the reason required, the earlier one kept); an agent's decision said so; an archive says nothing of an agent", opts, async () => {
  const w = await world();
  try {
    // decided from the Strom app's link: asked first, then the screen — Decide · B · why
    const d = await link(w, "hypothesis?tree=<id>&id=H2&do=decide", ["a", "1", "2", "Křest S0001 byl v Lhotě, narozen jinde – v Lhotici"]);
    assert.equal(d.code, 0, d.out + d.err);
    assert.match(d.out, /Aplikace Strom žádá: rozhodnout hypotézu: Kde se Josef narodil\?/u, d.out);
    assert.match(d.out, /Která varianta platí\?/u, d.out);
    assert.match(d.out, /✓ Hypotéza je rozhodnutá\./u, d.out);
    impersonal(d.out);
    assert.deepEqual([hyp(w, "H0002").state, hyp(w, "H0002").chosen, hyp(w, "H0002").decidedBy], ["decided", "B", "user"]);
    // decided: the decision shown, its change — A, and why (the reason of the change)
    const c = await link(w, "hypothesis?tree=<id>&id=H0002&do=decide", ["a", "1", "1", "Oprava: Lhotice patří k farnosti Lhota"]);
    assert.equal(c.code, 0, c.out + c.err);
    assert.match(c.out, /Aplikace Strom žádá: změnit rozhodnutí hypotézy: Kde se Josef narodil\?/u, c.out);
    assert.match(c.out, /^ {4}Rozhodnuto: varianta B – Křest S0001 byl v Lhotě, narozen jinde – v Lhotici$/mu, c.out);
    assert.match(c.out, /^ {3}1 {2}Změnit rozhodnutí$/mu, c.out);
    assert.doesNotMatch(c.out, /Rozhodl agent/u, "the person's own decision");
    const h = hyp(w, "H0002");
    assert.deepEqual([h.state, h.chosen, h.decision], ["decided", "A", "Oprava: Lhotice patří k farnosti Lhota"]);
    assert.match(JSON.stringify(h), /narozen jinde – v Lhotici/u, "the earlier decision stays readable");
    // 0 at the change: nothing written
    const kept = hyp(w, "H0002").updated;
    await link(w, "hypothesis?tree=<id>&id=H2&do=decide", ["a", "0"]);
    assert.equal(hyp(w, "H0002").updated, kept);
    // an agent's decision: said so on the screen
    await w.ok(["config", "set", "hypotheses.decide", "agent", "--for-tree"], { tty: true });
    await w.ok(["hypothesis", "argue", "H1", "A", "--for", "S1: křest jmenuje Václava Lhotáka otcem"], AGENT);
    await w.ok(["hypothesis", "decide", "H1", "--variant", "A", "--decision", "křest S0001 jmenuje rodiče"], AGENT);
    const g = await link(w, "hypothesis?tree=<id>&id=H1&do=decide", ["a", "0"]);
    assert.match(g.out, /^ {4}Rozhodnuto: varianta A – křest S0001 jmenuje rodiče$/mu, g.out);
    assert.match(g.out, /^ {4}Rozhodl agent \(/mu, g.out);
    // an archive: the decision, nothing of an agent
    await w.ok(["mode", "archive"], { tty: true, answers: ["", "", ""] });
    const z = await link(w, "hypothesis?tree=<id>&id=H1&do=decide", ["a", "0"]);
    assert.match(z.out, /Rozhodnuto: varianta A/u, z.out);
    assert.doesNotMatch(z.out, /agent|AI(?![\p{L}])/u, z.out);
  } finally {
    w.cleanup();
  }
});

test("the links: an unknown hypothesis said, nothing done; who decides them — the agent on the person's yes in the terminal, back to the person at once (without a terminal too)", opts, async () => {
  const w = await world();
  try {
    const none = await link(w, "hypothesis?tree=<id>&id=H9&do=decide", []);
    assert.match(none.out + none.err, /Hypotéza H9 v tomto výzkumu není\. Nic se nestalo\./u, none.out + none.err);
    // the agent: asked, what it means said — no: nothing changed
    const no = await link(w, "hypotheses?tree=<id>&decide=agent", ["n"]);
    assert.match(no.out, /Aplikace Strom žádá: nechat hypotézy tohoto výzkumu rozhodovat AI/u, no.out);
    assert.match(no.out, /Má hypotézy \(nejistá spojení lidí\) rozhodovat agent sám\?/u, no.out);
    assert.match(no.out, /v revizi osoby nebo z aplikace Strom/u, no.out);
    assert.equal(await decide(w), "person");
    // yes: the research's own
    const yes = await link(w, "hypotheses?tree=<id>&decide=agent", ["a"]);
    assert.match(yes.out, /✓ Hypotézy tohoto výzkumu teď rozhoduje AI/u, yes.out);
    assert.equal(readJsonFile(path.join(w.cwd, "strom.json"))["hypotheses.decide"], "agent", "the research's own");
    assert.equal(await decide(w), "agent");
    const again = await link(w, "hypotheses?tree=<id>&decide=agent", []);
    assert.match(again.out, /Hypotézy tohoto výzkumu už rozhoduje AI\. Nic se nezměnilo\./u, again.out);
    // back to the person: no terminal, nothing asked
    const back = await link(w, "hypotheses?tree=<id>&decide=person", [], false);
    assert.equal(back.code, 0, back.out + back.err);
    assert.equal(await decide(w), "person");
    impersonal(no.out + yes.out + again.out);
  } finally {
    w.cleanup();
  }
});

test("the menu's settings: who decides the hypotheses — the agent only on the person's second yes, back to the person; nothing of it in an archive", opts, async () => {
  const w = await world();
  try {
    const first = await w.ok([], { tty: true, answers: ["8", "1", "0", "0", "0"] });
    const n = itemOf(first.out, "Kdo rozhoduje hypotézy: Rozhoduje člověk");
    assert.ok(n, first.out);
    // the AI · the consent: no — nothing changed
    const no = await w.ok([], { tty: true, answers: ["8", "1", n, "2", "n", "0", "0"] });
    assert.match(no.out, /Kdo rozhoduje hypotézy – nejistá spojení lidí\?/u, no.out);
    assert.match(no.out, /^ {3}1 {2}Rozhoduje člověk$/mu, no.out);
    assert.match(no.out, /^ {3}2 {2}Rozhoduje AI$/mu, no.out);
    assert.equal(await decide(w), "person");
    // yes: this computer's (the research has no value of its own)
    await w.ok([], { tty: true, answers: ["8", "1", n, "2", "a", "0", "0"] });
    assert.equal(await decide(w), "agent");
    assert.equal(readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json"))["hypotheses.decide"], "agent", "this computer's");
    assert.equal(readJsonFile(path.join(w.cwd, "strom.json"))["hypotheses.decide"], undefined);
    const shown = await w.ok([], { tty: true, answers: ["8", "1", "0", "0", "0"] });
    assert.match(shown.out, /Kdo rozhoduje hypotézy: Rozhoduje AI/u, shown.out);
    // back to the person: no second question
    await w.ok([], { tty: true, answers: ["8", "1", n, "1", "0", "0"] });
    assert.equal(await decide(w), "person");
    impersonal(no.out);
    // an archive: not offered
    await w.ok(["mode", "archive"], { tty: true, answers: ["", "", ""] });
    const a = await w.ok([], { tty: true, answers: ["8", "1", "0", "0", "0"] });
    assert.doesNotMatch(a.out, /hypotéz/iu, a.out);
  } finally {
    w.cleanup();
  }
});

test("the setup asks who decides the hypotheses only a person at a terminal: no terminal or an agent — not asked, nothing written (the person decides)", opts, async () => {
  const w = await world();
  try {
    const config = () => readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json"));
    // without a terminal: nothing asked, nothing written
    const quiet = await w.ok(["setup", "--yes"]);
    assert.doesNotMatch(quiet.out, /Kdo rozhoduje hypotézy/u);
    assert.equal(await decide(w), "person");
    const asAgent = await w.run(["setup"], { tty: true, answers: Array(12).fill(""), ...AGENT });
    assert.doesNotMatch(asAgent.out, /Kdo rozhoduje hypotézy/u, asAgent.out);
    // a person: asked after the stories; Enter keeps the person
    const keep = await w.ok(["setup"], { tty: true, answers: Array(12).fill("") });
    assert.match(keep.out, /vyprávění[^]*Kdo rozhoduje hypotézy – nejistá spojení lidí\?[^\n]*\n {3}1 {2}Rozhoduje člověk\n {3}2 {2}Rozhoduje AI\n {3}0 {2}[^\n]+\nVybrat \[1\]/u, keep.out);
    impersonal(keep.out);
    assert.equal(await decide(w), "person");
    assert.equal(config()["hypotheses.decide"], undefined, "nothing written");
    // the AI, with the second yes: this computer's
    // language, folder, research, agent, model, effort, stories · the AI · yes · the rest kept
    const ai = await w.ok(["setup"], { tty: true, answers: ["", "", "", "", "", "", "", "2", "a", "", "", "", "", "", ""] });
    assert.match(ai.out, /Má hypotézy \(nejistá spojení lidí\) rozhodovat agent sám\?/u, ai.out);
    assert.equal(await decide(w), "agent");
  } finally {
    w.cleanup();
  }
});

test("a person's review offers the hypotheses about them: the list with each one's state, one opened on the same screen", opts, async () => {
  const w = await world();
  try {
    await w.ok(["hypothesis", "decide", "H2", "--variant", "A", "--decision", "křest S0001 v Lhotě"]);
    // 4 add to the research · 3 review one person · Josef · not the family · the hypotheses · H1 · Decide · A · why · 0 the list
    const r = await w.ok(["menu"], { tty: true, answers: ["4", "3", "Josef", "n", "1", "1", "1", "1", "Křest S0001 jmenuje Václava a Marii", "0", "n", "", "0", "0"] });
    assert.match(r.out, /^ {3}1 {2}Hypotézy o osobě \(2\)$/mu, r.out);
    assert.match(r.out, /^ {3}0 {2}Pokračovat$/mu, r.out);
    assert.match(r.out, /Hypotézy o osobě\n {3}1 {2}H0001 · otevřená · Čí syn je Josef\?\n {3}2 {2}H0002 · rozhodnutá · Kde se Josef narodil\?/u, r.out);
    assert.match(r.out, /✓ Hypotéza je rozhodnutá\./u, r.out);
    impersonal(r.out);
    assert.deepEqual([hyp(w, "H0001").state, hyp(w, "H0001").chosen], ["decided", "A"]);
  } finally {
    w.cleanup();
  }
});
