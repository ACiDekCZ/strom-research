// The Strom app's "work on the queue" (spec 052, the app's ZADANI_VYZKUM_hledani-ve-fronte.md, section 5): the link
// strom-research://work?tree=<id>&do=tasks[&n=1..100]|loop, taken in the terminal — what would start shown (the first
// tasks in the run's order, n tasks, the session's time, the gate), started only on the person's yes (no by default);
// nothing started beside work already going on; the loop only under a gate (none: n tasks or the gate offered instead).
// A scripted agent (the script runner) and a fake terminal only. Made-up names only (Lhoták, Lhota).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { parseLink, LinkError, linkText } from "../../src/core/links.ts";
import { enterWorker } from "../../src/core/workers.ts";

const opts = { skip: !hasGit, timeout: 240_000 };

/** The agent: each session writes a note, settles its task (done) and closes. */
const AGENT = `
import { spawnSync } from "node:child_process";
const strom = (...a) => spawnSync("strom", a, { encoding: "utf8", env: process.env, shell: process.platform === "win32" });
const task = /## Task (T\\d{4})/.exec(process.env.STROM_PROMPT ?? "")?.[1];
strom("note", "add", "P1", "Lhoták z Lhoty " + task);
if (task) strom("task", "done", task, "--result", "nalezeno");
strom("session", "close", "--summary", "hotovo", "--next", "další");
`;

/** Jan Lhoták (P1), seven tasks of his line, a gate "Zkouška" here (not set), the scripted agent. */
async function world(): Promise<World & { id: string }> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  await w.ok(["research", "new", "Předci Jana", "--new-person", "Jan /Lhoták/", "--sex", "M"]);
  for (let i = 1; i <= 7; i++)
    await w.ok(["task", "add", `Zápis ${i} v Lhotě`, "--level", "locate", "--where", "katalog archivu Lhota", "--why", "rodiče", "--done-when", "zápis", "--about", "P1", "--priority", String(Math.max(1, 5 - i))]);
  const gate = path.join(w.home, "shared", "plugins", "gates", "zkouska");
  fs.mkdirSync(gate, { recursive: true });
  fs.writeFileSync(path.join(gate, "gate.json"), JSON.stringify({ interface: 1, title: "Zkouška", command: ["node", "gate.ts"] }));
  fs.writeFileSync(path.join(gate, "gate.ts"), `import fs from "node:fs";\nfs.appendFileSync("asked.txt", "asked\\n");\nprocess.exit(0);\n`);
  const agent = path.join(w.home, "agent-done.mjs");
  fs.writeFileSync(agent, AGENT);
  Object.assign(w.env, { STROM_RUNNER_SCRIPT: agent, STROM_AGENT: "script" });
  return Object.assign(w, { id: readJsonFile(path.join(w.cwd, "strom.json")).id as string });
}

const sessions = (w: World) => {
  const dir = path.join(w.cwd, "data", "sessions");
  return fs.existsSync(dir) ? fs.readdirSync(dir).length : 0;
};
const gateAsked = (w: World) => {
  const f = path.join(w.home, "shared", "plugins", "gates", "zkouska", "asked.txt");
  return fs.existsSync(f) ? fs.readFileSync(f, "utf8").split("\n").filter(Boolean).length : 0;
};
const PERSON = /(?<![\p{L}\p{M}\p{N}])(vy|váš|vaše|vám|ty|tvůj)(?![\p{L}\p{M}\p{N}])/iu;

test("the link work: parsed with fixed values only — do loop|tasks, n 1–100 only with tasks, nothing else", () => {
  const id = "0b3f7c2e-5a41-4c8e-9d21-7e6f5a4b3c2d";
  assert.deepEqual(parseLink(`strom-research://work?tree=${id}&do=loop`), { action: "work", tree: id, do: "loop" });
  assert.deepEqual(parseLink(`strom-research://work?tree=${id}&do=tasks`), { action: "work", tree: id, do: "tasks" });
  assert.deepEqual(parseLink(`strom-research://work?tree=${id}&do=tasks&n=5`), { action: "work", tree: id, do: "tasks", n: "5" });
  assert.deepEqual(parseLink(`strom-research://work?tree=${id}&do=tasks&n=100`), { action: "work", tree: id, do: "tasks", n: "100" });
  assert.deepEqual(parseLink(`strom-research://work?tree=${id}&do=tasks&n=007`), { action: "work", tree: id, do: "tasks", n: "7" });
  const link = parseLink(`strom-research://work?tree=${id}&do=tasks&n=12`);
  assert.equal(linkText(link as Exclude<typeof link, { action: "menu" }>), `strom-research://work?tree=${id}&do=tasks&n=12`);
  for (const bad of [
    `strom-research://work?tree=${id}`,
    `strom-research://work?tree=${id}&do=run`,
    `strom-research://work?tree=${id}&do=LOOP`,
    `strom-research://work?tree=${id}&do=tasks&n=0`,
    `strom-research://work?tree=${id}&do=tasks&n=101`,
    `strom-research://work?tree=${id}&do=tasks&n=1000`,
    `strom-research://work?tree=${id}&do=tasks&n=-5`,
    `strom-research://work?tree=${id}&do=tasks&n=`,
    `strom-research://work?tree=${id}&do=tasks&n=x5`,
    `strom-research://work?tree=${id}&do=tasks&n=5x`,
    `strom-research://work?tree=${id}&do=tasks&n=%205`,
    `strom-research://work?tree=${id}&do=tasks&n=5.0`,
    `strom-research://work?tree=${id}&do=tasks&n=５`,
    `strom-research://work?tree=${id}&do=loop&n=5`,
    `strom-research://work?do=tasks&n=5`,
  ])
    assert.throws(() => parseLink(bad), LinkError, bad);
});

test("the link work, n tasks: the first tasks in the run's order, n, the time and no gate shown; Enter and no start nothing, yes runs --tasks n here", opts, async () => {
  const w = await world();
  try {
    await w.ok(["task", "order", "T6", "--next"]);
    const link = `strom-research://work?tree=${w.id}&do=tasks&n=2`;
    const enter = await w.run(["link", "open", link], { tty: true, answers: [""] });
    assert.match(enter.out, /Aplikace Strom žádá: samostatná práce agenta na frontě, úkolů: 2/u, enter.out);
    // the one put next first, five shown, the rest counted
    const listed = [...enter.out.matchAll(/^ {2,3}\d\. (.+)$/gmu)].map((m) => m[1]);
    assert.equal(listed.length, 5, enter.out);
    assert.equal(listed[0], "Zápis 6 v Lhotě", enter.out);
    assert.match(enter.out, /… a další úkoly: 2/u, enter.out);
    assert.match(enter.out, /Skončí po vyřízení úkolů: 2 \(hotové, čekající, odložené nebo vzdané\); úkol vrácený do fronty se nepočítá; nejvýš 4 sezení\./u);
    assert.match(enter.out, /Podmínka: žádná \(nastavení run\.gate\)\./u);
    assert.match(enter.out, /minut/u, "the session's time");
    assert.doesNotMatch(enter.out, /\$|odhad/u, "no estimate of a price");
    assert.doesNotMatch(enter.out, PERSON);
    assert.match(enter.out, /Pokračovat\? \(a\/n\) \[n\]/u, "no by default");
    assert.equal(sessions(w), 0, "Enter: no");
    const no = await w.run(["link", "open", link], { tty: true, answers: ["n"] });
    assert.equal(no.code, 0, no.err);
    assert.equal(sessions(w), 0, "no: nothing started");
    // yes: strom run --tasks 2 in this terminal — the one put next first, two tasks settled
    const yes = await w.run(["link", "open", link], { tty: true, answers: ["a"] });
    assert.match(yes.out, /Sezení za sezením v tomto okně; Ctrl-C požádá rozpracované sezení o dokončení a běh zastaví/u, yes.out);
    assert.match(yes.out, /vyřízené úkoly: 2/u, yes.out);
    assert.equal(sessions(w), 2, yes.out + yes.err);
    assert.equal((await w.ok(["task", "show", "T6", "--json"])).json.task.state, "done");
    // a gate set: asked once for n tasks, said so
    await w.ok(["config", "set", "run.gate", "zkouska"], { tty: true, answers: ["a"] });
    const once = await w.run(["link", "open", `strom-research://work?tree=${w.id}&do=tasks`], { tty: true, answers: ["n"] });
    assert.match(once.out, /úkolů: 5/u, "no n: the app's default, 5");
    assert.match(once.out, /Podmínka: Zkouška – ptá se jednou, před prvním sezením/u, once.out);
  } finally {
    w.cleanup();
  }
});

test("the link work: a run or a session already at work — said, nothing started, nothing asked", opts, async () => {
  const w = await world();
  try {
    const leave = enterWorker(w.cwd, "run-1", "strom run", "0.0.0");
    try {
      const r = await w.run(["link", "open", `strom-research://work?tree=${w.id}&do=tasks&n=3`], { tty: true, answers: ["a", "a"] });
      assert.match(r.out, /Na tomto výzkumu se už pracuje \(běhy: 1, sezení: 0\)\. Nic dalšího se nespustilo\./u, r.out);
      assert.doesNotMatch(r.out, /\(a\/n\)/u, "nothing asked");
      assert.equal(sessions(w), 0);
    } finally {
      leave();
    }
  } finally {
    w.cleanup();
  }
});

test("the link work, loop without a gate: not started — n tasks instead, the gate picked as in the settings, or nothing; with a gate, asked before each session", opts, async () => {
  const w = await world();
  try {
    const link = `strom-research://work?tree=${w.id}&do=loop`;
    // nothing (Enter: 0 is suggested)
    const none = await w.run(["link", "open", link], { tty: true, answers: [""] });
    assert.match(none.out, /Automatická práce běží jen pod podmínkou \(nastavení run\.gate\)/u, none.out);
    assert.match(none.out, / {3}1 {2}Teď jen určitý počet úkolů\n {3}2 {2}Nastavit podmínku \(jako v nastavení\)\n {3}0 {2}Teď nic\n/u, none.out);
    assert.doesNotMatch(none.out, /\(a\/n\)/u);
    assert.doesNotMatch(none.out, PERSON);
    assert.equal(sessions(w), 0);
    // n tasks instead: 3 asked, the question default no → nothing; then yes → run --tasks 3
    const asked = await w.run(["link", "open", link], { tty: true, answers: ["1", "3", ""] });
    assert.match(asked.out, /Kolik úkolů\? \(1–100; 0 nic\)/u, asked.out);
    assert.match(asked.out, /úkolů: 3/u, asked.out);
    assert.equal(sessions(w), 0);
    const three = await w.run(["link", "open", link], { tty: true, answers: ["1", "3", "a"] });
    assert.match(three.out, /vyřízené úkoly: 3/u, three.out);
    assert.equal(sessions(w), 3, three.out + three.err);
    // the gate as in the settings (the person's yes to it), then shown and asked, no by default
    const gate = await w.run(["link", "open", link], { tty: true, answers: ["2", "1", "", "a", ""] });
    assert.match(gate.out, /Podmínka: Zkouška – ptá se před každým sezením\./u, gate.out);
    assert.match(gate.out, /Sezení za sezením, dokud je práce a podmínka to dovolí\./u);
    assert.equal(sessions(w), 3, "set, then not started without a yes");
    assert.equal(gateAsked(w), 0);
    // with the gate: yes → strom run --loop, the gate asked before each session, on until the queue is empty
    const loop = await w.run(["link", "open", link], { tty: true, answers: ["a"] });
    assert.doesNotMatch(loop.out, /Automatická práce běží jen pod podmínkou/u, loop.out);
    assert.ok(sessions(w) > 4, loop.out + loop.err);
    assert.ok(gateAsked(w) >= sessions(w) - 3, `gate asked ${gateAsked(w)}×`);
    assert.match(loop.out, /žádné otevřené úkoly/u, loop.out);
  } finally {
    w.cleanup();
  }
});
