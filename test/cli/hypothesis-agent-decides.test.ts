// Who decides the hypotheses (hypotheses.decide, the person's setting; spec 060): where nothing is set the agent (K1.9);
// "person" — an agent proposes, anyone may set it. "agent" again where the person is set (the person's yes: an agent
// asking, or removing the person, is refused for the consent), the agent decides one itself
// once a support of the variant cites a source; never a decision of the person's, never a big branch off the tree on one
// source. The decision is marked as the agent's (decidedByAgent, decidedAt), recorded on the tree by the brief like the
// person's, said in the change lines; the person deciding again takes the mark away. The bridge says the setting
// (/status hypotheses.decide), sets "person" at once and "agent" only through the link that asks in the terminal; the
// Strom file says who decided (_BY agent, DECI, _AT) only for an app that shows it.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { exportGedcom } from "../../src/gedcom/export.ts";
import { decidedToRecord } from "../../src/core/hypolinks.ts";
import { changeLines } from "../../src/core/changelog.ts";
import { BRIDGE_FEATURES } from "../../src/core/live.ts";
import { Settings } from "../../src/core/config.ts";
import { APP_SHOWS_HYPOTHESIS_DECIDER, appShowsHypothesisDecider } from "../../src/core/stromapp.ts";
import { guideText } from "../../src/commands/guide.ts";
import { commandSheet } from "../../src/brief/sheet.ts";
import type { Hypothesis } from "../../src/core/model.ts";

const opts = { skip: !hasGit };
const AGENT = { env: { AI_AGENT: "1" } };
const APP = "https://beta.stromapp.info";

/**
 * Jan Lhoták (P1, the research's) whose parents are unknown; a couple Václav Lhoták + Marie Lhotová (P2, P3, F1) found
 * in the records. H1: whose son Jan is — A the couple's (linked), B another family's. H2: where he was born — no links.
 * S1 a baptism, S2 a census.
 */
async function world(): Promise<World> {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci Jana", "--new-person", "Jan /Lhoták/", "--sex", "M"]); // P1
  await w.ok(["person", "add", "Václav /Lhoták/", "--sex", "M"]); // P2
  await w.ok(["person", "add", "Marie /Lhotová/", "--sex", "F"]); // P3
  await w.ok(["family", "add", "--partner", "P2", "--partner", "P3"]); // F1
  await w.ok(["source", "add", "Křest Jana 1850 v Lhotě", "--kind", "baptism"]); // S1
  await w.ok(["source", "add", "Sčítání lidu 1857, Lhota č. 3", "--kind", "census"]); // S2
  await w.ok(["hypothesis", "add", "Čí syn je Jan?", "--about", "P1", "--variant", "A: syn Václava a Marie", "--variant", "B: z jiné rodiny"]); // H1
  await w.ok(["hypothesis", "link", "H1", "A", "--child", "P1", "--of", "F1"]);
  await w.ok(["hypothesis", "add", "Kde se Jan narodil?", "--about", "P1", "--variant", "A: v Lhotě", "--variant", "B: jinde"]); // H2
  return w;
}

const hyp = (w: World, id: string) => Tree.open(w.cwd, w.env).get<Hypothesis>(id)!;
/** The change lines of the decisions, in Czech. */
const said = (w: World): string => {
  const t = Tree.open(w.cwd, w.env);
  return changeLines(t, t.readOps().filter((o) => o.op === "hypothesis.decide"), "", "cs").map((l) => l.text).join("\n");
};
const ops = (w: World): string =>
  (fs.readdirSync(path.join(w.cwd, "data", "ops"), { recursive: true }) as string[])
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => fs.readFileSync(path.join(w.cwd, "data", "ops", f), "utf8"))
    .join("");

test("hypotheses.decide: the agent's where nothing is set (a research of 1.28 too); the person set by anyone; an agent turning it back to agent is refused for the person's consent, the person sets it", opts, async () => {
  const w = await world();
  try {
    // nothing set: the AI decides (K1.9), strom.json untouched
    assert.equal((await w.ok(["config", "get", "hypotheses.decide"])).out.trim(), "agent");
    assert.equal(readJsonFile(path.join(w.cwd, "strom.json")).settings?.["hypotheses.decide"], undefined);
    assert.match((await w.ok(["config", "where"])).out, /hypotheses\.decide[^\n]*agent[^\n]*default/u);
    // the person: anyone, at once
    await w.ok(["config", "set", "hypotheses.decide", "person"], AGENT);
    assert.equal((await w.ok(["config", "get", "hypotheses.decide"])).out.trim(), "person");
    // the person decides: the agent proposes, deciding refused as before (the catalog says when it may)
    const r = await w.run(["hypothesis", "decide", "H2", "--decision", "S1 v Lhotě"], AGENT);
    assert.equal(r.code, 4, r.out + r.err);
    const cat = (await w.ok(["commands", "--json"])).json;
    const decide = (cat.commands ?? cat).find((c: { command: string }) => c.command === "hypothesis decide");
    assert.ok(decide.userOnly, "still the person's in the catalog");
    assert.match(decide.agentMay, /hypotheses\.decide agent/u);
    // an agent asking for it: the person's consent, nothing changed
    for (const scope of [[], ["--for-tree"]]) {
      const a = await w.run(["config", "set", "hypotheses.decide", "agent", ...scope], AGENT);
      assert.equal(a.code, 4, a.out + a.err);
      assert.match(a.out + a.err, /strom config set hypotheses\.decide agent/u);
    }
    // a script without a terminal neither
    assert.equal((await w.run(["config", "set", "hypotheses.decide", "agent", "--for-tree"])).code, 4);
    // removing the person's choice would let the agent decide: the person's consent too
    const unset = await w.run(["config", "unset", "hypotheses.decide"], AGENT);
    assert.equal(unset.code, 4, unset.out + unset.err);
    assert.match(unset.out + unset.err, /strom config unset hypotheses\.decide/u);
    assert.equal((await w.ok(["config", "get", "hypotheses.decide"])).out.trim(), "person");
    // the person in the terminal
    await w.ok(["config", "set", "hypotheses.decide", "agent", "--for-tree"], { tty: true });
    assert.equal((await w.ok(["config", "get", "hypotheses.decide"])).out.trim(), "agent");
    // the same again: nothing asked; back to the person: anyone
    await w.ok(["config", "set", "hypotheses.decide", "agent", "--for-tree"], AGENT);
    await w.ok(["config", "set", "hypotheses.decide", "person", "--for-tree"], AGENT);
    assert.equal((await w.ok(["config", "get", "hypotheses.decide"])).out.trim(), "person");
    assert.equal((await w.run(["config", "set", "hypotheses.decide", "nobody", "--for-tree"], { tty: true })).code, 2);
    // the tree's own value removed by the person: the user's person holds
    await w.ok(["config", "unset", "hypotheses.decide", "--for-tree"], { tty: true });
    assert.equal((await w.ok(["config", "get", "hypotheses.decide"])).out.trim(), "person");
  } finally {
    w.cleanup();
  }
});

test("the agent decides on a cited record: marked as its own, recorded by the brief, said in the change lines; without a cited source refused; --proposed and --keep-open stay the person's", opts, async () => {
  const w = await world();
  try {
    await w.ok(["config", "set", "hypotheses.decide", "agent", "--for-tree"], { tty: true });
    // no support citing a source: refused with what to run, nothing written
    const before = hyp(w, "H0001").updated;
    const none = await w.run(["hypothesis", "decide", "H1", "--variant", "A", "--decision", "křest jmenuje rodiče", "--json"], AGENT);
    assert.equal(none.code, 2, none.out + none.err);
    assert.equal(none.json.code, "hypothesis.evidence");
    assert.match(none.out + none.err, /strom hypothesis argue H0001 A --for/u);
    // a source not in the research is no cited record either
    await w.ok(["hypothesis", "argue", "H1", "A", "--for", "S0099 jmenuje otce"], AGENT);
    assert.equal((await w.run(["hypothesis", "decide", "H1", "--variant", "A", "--decision", "křest"], AGENT)).code, 2);
    assert.equal(hyp(w, "H0001").state, "open");
    // the person's own ways stay the person's
    await w.ok(["hypothesis", "propose", "H2", "--variant", "A", "--decision", "S1 v Lhotě"], AGENT);
    for (const argv of [
      ["hypothesis", "decide", "H2", "--proposed"],
      ["hypothesis", "decide", "H2", "--keep-open"],
      ["hypothesis", "decide", "H1", "--decision", "nic"],
    ])
      assert.equal((await w.run(argv, AGENT)).code, 4, argv.join(" "));
    assert.notEqual(hyp(w, "H0001").updated, before, "argued");
    // cited in short (S1) — decided, the agent's
    await w.ok(["hypothesis", "argue", "H1", "A", "--for", "S1: křest jmenuje Václava Lhotáka otcem"], AGENT);
    const done = await w.ok(["hypothesis", "decide", "H1", "--variant", "A", "--decision", "křest S0001 jmenuje rodiče"], AGENT);
    assert.match(done.out, /record it on the tree now/u);
    assert.match(done.out, /tell the user in a sentence/u);
    const h = hyp(w, "H0001");
    assert.deepEqual([h.state, h.chosen, h.decidedBy], ["decided", "A", undefined]);
    assert.ok(h.decidedByAgent, "who decided");
    assert.match(h.decidedAt ?? "", /^\d{4}-\d{2}-\d{2}T/u);
    assert.match(ops(w), /H0001 decided for A by the agent/u);
    assert.match((await w.ok(["hypothesis", "show", "H1"])).out, /by the agent/u);
    // recorded on the tree like the person's: the brief and decidedToRecord
    assert.deepEqual(decidedToRecord(Tree.open(w.cwd, w.env)).map((x) => x.hypothesis.id), ["H0001"]);
    const brief = (await w.ok(["brief"])).out;
    assert.match(brief, /## Decided \(by the user, or by an agent where said\) — record it on the tree first\n {2}H0001 Čí syn je Jan\? — decided for A by the agent: /u);
    assert.match(brief, /the user lets you decide the hypotheses/u, "H2 still open: the rule below it");
    // the change lines in the research language
    assert.match(said(w), /H0001 rozhodl agent: A – křest S0001 jmenuje rodiče/u);
    // a decision of the agent's: the agent may change it on a new record; the person's: never
    await w.ok(["hypothesis", "argue", "H1", "B", "--for", "S2 jiný otec"], AGENT);
    await w.ok(["hypothesis", "decide", "H1", "--variant", "B", "--decision", "sčítání S0002", "--reason", "nový zápis"], AGENT);
    assert.equal(hyp(w, "H0001").chosen, "B");
    await w.ok(["hypothesis", "decide", "H1", "--variant", "A", "--decision", "křest platí", "--reason", "přečteno znovu"]);
    const p = hyp(w, "H0001");
    assert.deepEqual([p.chosen, p.decidedBy, p.decidedByAgent], ["A", "user", undefined], "the person's: the mark gone");
    const back = await w.run(["hypothesis", "decide", "H1", "--variant", "B", "--decision", "S2", "--reason", "x", "--json"], AGENT);
    assert.equal(back.code, 2, back.out + back.err);
    assert.equal(back.json.code, "hypothesis.user");
    assert.match(back.out + back.err, /strom hypothesis propose H0001/u);
    // abandoning one open needs no cited source
    await w.ok(["hypothesis", "decide", "H2", "--abandon", "--decision", "nelze určit"], AGENT);
    assert.deepEqual([hyp(w, "H0002").state, hyp(w, "H0002").decidedBy, !!hyp(w, "H0002").decidedByAgent], ["abandoned", undefined, true]);
    assert.match(said(w), /H0002 odložil agent: nelze určit/u);
    assert.doesNotMatch(said(w), /křest S0001 jmenuje rodiče/u, "decided again by the person: the agent's lines say the question");
    assert.match(said(w), /H0001 rozhodl agent: A – Čí syn je Jan\?\nH0001 rozhodl agent: B – Čí syn je Jan\?/u);
    // in a batch the same
    await w.ok(["hypothesis", "add", "Kdy se Jan oženil?", "--about", "P1", "--variant", "A: 1875", "--variant", "B: 1880"]); // H3
    await w.ok(["hypothesis", "argue", "H3", "A", "--for", "S0002 uvádí manželku"], AGENT);
    await w.ok(["batch", 'hypothesis decide H3 --variant A --decision "S0002"'], AGENT);
    assert.ok(hyp(w, "H0003").decidedByAgent);
  } finally {
    w.cleanup();
  }
});

test("a big branch off the tree: the agent decides it only on two sources and no objection; old hypotheses without marks as before", opts, async () => {
  const w = await world();
  try {
    await w.ok(["config", "set", "hypotheses.decide", "agent", "--for-tree"], { tty: true });
    // eight children of the couple, nobody of them on the tree: the variant A joins ten people
    for (let i = 0; i < 8; i++) {
      await w.ok(["person", "add", `Dítě${i} /Lhoták/`, "--sex", "M"]);
      await w.ok(["family", "child", "F1", `P${i + 4}`]);
    }
    await w.ok(["hypothesis", "argue", "H1", "A", "--for", "S1 křest jmenuje rodiče"], AGENT);
    const one = await w.run(["hypothesis", "decide", "H1", "--variant", "A", "--decision", "S1", "--json"], AGENT);
    assert.equal(one.code, 2, one.out + one.err);
    assert.equal(one.json.code, "hypothesis.branch");
    assert.match(one.out + one.err, /joins 10 people off the tree/u);
    assert.match(one.out + one.err, /strom hypothesis propose H0001 --variant A/u);
    // two sources, but an objection: still the person's
    await w.ok(["hypothesis", "argue", "H1", "A", "--for", "S2 bydlí s rodiči"], AGENT);
    await w.ok(["hypothesis", "argue", "H1", "A", "--against", "jiný Jan v sousední vsi"], AGENT);
    assert.equal((await w.run(["hypothesis", "decide", "H1", "--variant", "A", "--decision", "S1, S2"], AGENT)).code, 2);
    assert.equal(hyp(w, "H0001").state, "open");
    // a hypothesis of nine off the tree is no big branch: decided on one source
    const w2 = await world();
    try {
      await w2.ok(["config", "set", "hypotheses.decide", "agent", "--for-tree"], { tty: true });
      for (let i = 0; i < 7; i++) {
        await w2.ok(["person", "add", `Dítě${i} /Lhoták/`, "--sex", "M"]);
        await w2.ok(["family", "child", "F1", `P${i + 4}`]);
      }
      await w2.ok(["hypothesis", "argue", "H1", "A", "--for", "S1"], AGENT);
      await w2.ok(["hypothesis", "decide", "H1", "--variant", "A", "--decision", "S1"], AGENT);
      assert.ok(hyp(w2, "H0001").decidedByAgent);
    } finally {
      w2.cleanup();
    }
    // decided by the person before 060 (no decidedByAgent): as before — the person's, recorded by the brief as theirs
    await w.ok(["hypothesis", "decide", "H2", "--decision", "v Lhotě"]);
    const h2 = hyp(w, "H0002");
    assert.deepEqual([h2.decidedBy, h2.decidedByAgent], ["user", undefined]);
    assert.doesNotMatch((await w.ok(["hypothesis", "show", "H2"])).out, /by the agent/u);
  } finally {
    w.cleanup();
  }
});

test("--keep-open without a proposal: an open hypothesis left open by the person (leftOpen), a decided one refused", opts, async () => {
  const w = await world();
  try {
    await w.ok(["hypothesis", "decide", "H2", "--keep-open"]);
    const h = hyp(w, "H0002");
    assert.equal(h.state, "open");
    assert.match(h.leftOpen ?? "", /^\d{4}-\d{2}-\d{2}T/u);
    assert.match(ops(w), /H0002 left open/u);
    await w.ok(["hypothesis", "decide", "H2", "--decision", "v Lhotě"]);
    const r = await w.run(["hypothesis", "decide", "H2", "--keep-open"]);
    assert.equal(r.code, 2);
    assert.match(r.err, /H0002 has no proposal to leave/u);
  } finally {
    w.cleanup();
  }
});

test("the agent's texts say the setting: the guide, the sheet, AGENTS.md — the agent's where nothing is set", opts, async () => {
  assert.match(guideText(undefined, APP), /here: person\)\n {2}The user decides them: .*strom hypothesis propose/u);
  assert.match(guideText(undefined, APP, 1, "linux", false, "agent"), /here: agent\)\n {2}The user lets you decide them/u);
  const sheet = commandSheet("verify", { decides: true });
  assert.match(sheet, /hypothesis decide/u);
  assert.doesNotMatch(commandSheet("verify"), /hypothesis decide/u);
  const w = await world();
  try {
    assert.match(fs.readFileSync(path.join(w.cwd, "AGENTS.md"), "utf8"), /The user lets you decide the hypotheses/u);
    assert.match((await w.ok(["guide"])).out, /here: agent\)\n {2}The user lets you decide them/u);
    await w.ok(["config", "set", "hypotheses.decide", "person", "--for-tree"]);
    assert.match((await w.ok(["guide"])).out, /here: person\)\n {2}The user decides them/u);
    await w.ok(["agents", "sync"]);
    assert.match(fs.readFileSync(path.join(w.cwd, "AGENTS.md"), "utf8"), /A hypothesis is theirs to decide/u);
    // the help says both choices and how to change them; propose says the agent's mode
    const set = (await w.ok(["help", "config", "set"])).out;
    assert.match(set, /hypotheses\.decide {2}person \| agent/u);
    assert.match(set, /strom config set hypotheses\.decide person/u);
    assert.match(set, /hypotheses\.decide: agent \(default where nothing is set/u);
    assert.match((await w.ok(["help", "hypothesis", "propose"])).out, /hypotheses\.decide agent.*\n?.*strom hypothesis decide/su);
  } finally {
    w.cleanup();
  }
});

test("the Strom file says who decided (_BY agent, DECI, _AT) only for an app that shows it; without, the same file", opts, async () => {
  const w = await world();
  try {
    await w.ok(["config", "set", "hypotheses.decide", "agent", "--for-tree"], { tty: true });
    await w.ok(["hypothesis", "argue", "H1", "A", "--for", "S1"], AGENT);
    await w.ok(["hypothesis", "decide", "H1", "--variant", "A", "--decision", "křest S0001 jmenuje rodiče"], AGENT);
    await w.ok(["hypothesis", "decide", "H2", "--decision", "v Lhotě"]);
    const t = Tree.open(w.cwd, w.env);
    const plain = exportGedcom(t, { for: "strom", appVersion: "3.24.0", research: true, hypothesisLinks: true } as never).text ?? "";
    assert.doesNotMatch(plain, /_BY agent|\n2 _AT /u);
    const shown = exportGedcom(t, { for: "strom", appVersion: "3.24.0", research: true, hypothesisLinks: true, hypothesisDecider: true } as never).text ?? "";
    const block = (id: string) => shown.split(/\n(?=1 )/u).find((b) => b.startsWith("1 _STROM_HYPO") && b.includes(id)) ?? "";
    const h1 = block("Čí syn je Jan?");
    assert.match(h1, /\n2 _BY agent/u);
    assert.match(h1, /\n2 DECI křest S0001 jmenuje rodiče/u);
    assert.match(h1, /\n2 _AT \d{4}-\d{2}-\d{2}/u);
    // the person's decision of one without links: no hypothesis the app shows any more, as before
    assert.equal(block("Kde se Jan narodil?"), "");
    // the gate: no version released yet — another copy of the app at once, the production app only from its version
    const prod = new Settings({ ...w.env, STROM_APP_URL: "https://stromapp.info/run/" }, {});
    const beta = new Settings({ ...w.env, STROM_APP_URL: "https://beta.stromapp.info/run/" }, {});
    assert.equal(APP_SHOWS_HYPOTHESIS_DECIDER, "3.25.0", "set from the app's version that shows it, never a beta's");
    assert.equal(appShowsHypothesisDecider(prod, "3.24.0"), false);
    assert.equal(appShowsHypothesisDecider(prod), true, "an unknown version: today's");
    assert.equal(appShowsHypothesisDecider(prod, "3.25.0"), true);
    assert.equal(appShowsHypothesisDecider(beta, "3.24.0"), true);
    assert.equal(appShowsHypothesisDecider(prod, "3.25.0", "3.25.0"), true);
    assert.equal(appShowsHypothesisDecider(prod, "3.24.9", "3.25.0"), false);
    assert.equal(appShowsHypothesisDecider(prod, undefined, "3.25.0"), true, "an unknown version once released");
  } finally {
    w.cleanup();
  }
});

type Info = { pid: number; port: number; token: string; url: string };
function ask(url: string, opt: { method?: string; body?: string } = {}): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = { Origin: APP };
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
        resolve({ status: res.statusCode ?? 0, body });
      });
    });
    req.on("error", reject);
    req.end(opt.body);
  });
}
const post = (url: string, body: unknown) => ask(url, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) });

test("bridge: /status says who decides; POST /hypotheses sets the person at once, the agent only through the link (403), a wrong body 400, an archive 409", { skip: !hasGit || process.platform === "win32", timeout: 240_000 }, async () => {
  const w = await world();
  try {
    assert.ok(BRIDGE_FEATURES.includes("hypotheses.decide"));
    const id = readJsonFile(path.join(w.cwd, "strom.json")).id;
    const info = (await w.ok(["live", "start", "--json"])).json as Info;
    const status = async () => (await ask(`${info.url}/status`)).body;
    const s = await status();
    assert.ok(s.features.includes("hypotheses.decide"));
    // nothing set: the AI decides (K1.9); the person from the app at once
    assert.deepEqual(s.hypotheses, { decide: "agent" });
    const toPerson = await post(`${info.url}/hypotheses`, { decide: "person" });
    assert.equal(toPerson.status, 200, JSON.stringify(toPerson.body));
    assert.notEqual(toPerson.body.head, toPerson.body.parent);
    assert.deepEqual((await status()).hypotheses, { decide: "person" });
    const url = `${info.url}/hypotheses`;
    for (const bad of [{}, { decide: "nobody" }, { decide: "agent", extra: 1 }, "x"]) {
      const r = await post(url, bad);
      assert.equal(r.status, 400, JSON.stringify(bad));
      assert.equal(r.body.code, "hypotheses.invalid");
    }
    const same = await post(url, { decide: "person" });
    assert.equal(same.status, 200, JSON.stringify(same.body));
    assert.equal(same.body.head, same.body.parent, "nothing written");
    const agent = await post(url, { decide: "agent" });
    assert.equal(agent.status, 403, JSON.stringify(agent.body));
    assert.equal(agent.body.code, "hypotheses.link");
    assert.equal(agent.body.link, `strom-research://hypotheses?tree=${id}&decide=agent`);
    assert.match(agent.body.error, /terminálu, který otevře odkaz/u);
    assert.equal((await status()).hypotheses.decide, "person");
    // set by the person in the terminal: the bridge says it, and back to the person at once
    await w.ok(["config", "set", "hypotheses.decide", "agent", "--for-tree"], { tty: true });
    assert.equal((await status()).hypotheses.decide, "agent");
    const off = await post(url, { decide: "person" });
    assert.equal(off.status, 200, JSON.stringify(off.body));
    assert.equal(off.body.decide, "person");
    assert.notEqual(off.body.head, off.body.parent);
    assert.equal((await status()).hypotheses.decide, "person");
    // an archive: nothing of it
    await w.ok(["mode", "archive"], { tty: true, answers: ["", "", ""] });
    assert.equal((await status()).hypotheses, undefined);
    const arch = await post(url, { decide: "person" });
    assert.equal(arch.status, 409, JSON.stringify(arch.body));
    assert.equal(arch.body.code, "hypotheses.archive");
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});
