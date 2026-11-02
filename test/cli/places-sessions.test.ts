// Identifying places in more sessions at once (spec 034; the Strom app's places window, "run now"): the link
// strom-research://places?…&do=run asks how many sessions now when the queue takes more than one — each count with its
// estimate — and runs them one after another (strom run --places); one batch is asked as before; Ctrl-C after the
// session at work. The task of the queue in the research's language, its count as the queue is now. Any script, any accent.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { readPlacesFile } from "../../src/core/placeid.ts";
import { placesSessions } from "../../src/cli/menu-links.ts";
import { translator } from "../../src/cli/menu-parts.ts";
import type { Context } from "../../src/cli/context.ts";
import type { Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit, timeout: 240_000 };
const agent = path.join(import.meta.dirname, "..", "fixtures", "places-agent.ts");

// 17 places off the map, in no archive's area: one session of 15, one of 2 (BATCH_MAX 15) — a Cyrillic one, an NFD one
const PLACES = ["Лгота", "Lhotákov".normalize("NFD"), ...Array.from({ length: 15 }, (_, i) => `Lhota ${i + 1}`)];

async function world(n = PLACES.length): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  await w.ok(["research", "new", "Předci Jana Lhotáka", "--new-person", "Jan /Lhoták/", "--sex", "M", "--born", "1850", "--born-place", PLACES[0]!]);
  for (const [i, place] of PLACES.slice(1, n).entries()) await w.ok(["person", "add", `Anna${i} /Lhotáková/`, "--sex", "F", "--born", String(1851 + i), "--born-place", place]);
  Object.assign(w.env, { STROM_RUNNER_SCRIPT: agent, STROM_AGENT: "script" });
  return w;
}

function placeTasks(w: World): Task[] {
  return Tree.open(w.cwd, w.env)
    .list<Task>("task")
    .filter((t) => t.origin === "places:identify")
    .sort((a, b) => a.id.localeCompare(b.id));
}

const sessions = (w: World) => {
  const dir = path.join(w.cwd, "data", "sessions");
  return fs.existsSync(dir) ? fs.readdirSync(dir).length : 0;
};
const queued = (w: World) => Object.keys(readPlacesFile(Tree.open(w.cwd, w.env)).queue).length;

test("the task of the queue of places: in the research's language, its count kept as the queue is now", opts, async () => {
  const w = await world();
  try {
    await w.ok(["place", "queue", "--all"]);
    const [t] = placeTasks(w);
    assert.equal(t!.what, "Ztotožnit místa údajů ve frontě (17)");
    assert.match(t!.why, /^Osoba o to požádala: /u);
    assert.equal(t!.doneWhen, "Každé místo fronty ztotožněné, s otázkou, nebo nedohledané.");
    // one place out of the queue by the person: the same task, the count now
    await w.ok(["place", "unlocated", "Lhota 15", "--why", "žádný záznam ji nejmenuje"]);
    const after = placeTasks(w);
    assert.deepEqual(
      after.map((x) => [x.id, x.state, x.what]),
      [[t!.id, "open", "Ztotožnit místa údajů ve frontě (16)"]],
    );
    // a task an older strom wrote in English: in the research's language at the next change of the queue
    const tree = Tree.open(w.cwd, w.env);
    tree.withTreeLock(() =>
      tree.putMany([{ ...after[0]!, what: "Identify the places of the facts in the queue (16)", why: "The person asked.", doneWhen: "Every place." } as Task], [], { op: "task.edit", targets: [t!.id], summary: "old text" }),
    );
    await w.ok(["place", "unlocated", "Lhota 14", "--why", "žádný záznam ji nejmenuje"]);
    assert.deepEqual(
      placeTasks(w).map((x) => [x.what, x.doneWhen]),
      [["Ztotožnit místa údajů ve frontě (15)", "Každé místo fronty ztotožněné, s otázkou, nebo nedohledané."]],
    );
  } finally {
    w.cleanup();
  }
});

test("strom run --places: one session for each batch of the queue until no place waits; alone, never with --task", opts, async () => {
  const w = await world();
  try {
    await w.ok(["place", "queue", "--all"]);
    assert.notEqual((await w.run(["run", "--places", "--task", "T0001"])).code, 0, "--places takes the task alone");
    const r = await w.ok(["run", "--places", "--max", "5", "--json"]);
    assert.equal(r.json.sessions.length, 2, r.err);
    assert.equal(r.json.stop, "empty");
    assert.equal(r.json.stopped, "žádná místa ke ztotožnění nezbývají");
    assert.equal(queued(w), 0);
    // the first task done with places still queued, the next one raised: each session its batch, each count kept
    const tasks = placeTasks(w);
    assert.deepEqual(
      tasks.map((x) => [x.state, x.what]),
      [
        ["done", "Ztotožnit místa údajů ve frontě (2)"],
        ["done", "Ztotožnit místa údajů ve frontě (1)"],
      ],
    );
    assert.deepEqual(
      r.json.sessions.map((x: { task: string }) => x.task),
      tasks.map((x) => x.id),
    );
  } finally {
    w.cleanup();
  }
});

test("the link places with more batches: how many sessions now, each with its estimate; 0 none, Enter the whole small queue", opts, async () => {
  const w = await world();
  try {
    const id = readJsonFile(path.join(w.cwd, "strom.json")).id;
    const link = `strom-research://places?tree=${id}&do=run`;
    await w.ok(["place", "queue", "--all"]);
    const none = await w.run(["link", "open", link], { tty: true, answers: ["a", "0"] });
    assert.match(none.out, /Kolik sezení spustit teď\? Celá fronta je 2 sezení; zbylá místa zůstanou ve frontě první pro další běhy\./u, none.out);
    assert.match(none.out, /^ {3}1 {2}1 sezení – zhruba 8–15 minut$/mu, none.out);
    assert.match(none.out, /^ {3}2 {2}celá fronta, 2 sezení – zhruba 16–30 minut$/mu, none.out);
    assert.match(none.out, /^ {3}0 {2}teď žádné – ztotožnění zůstane ve frontě první$/mu, none.out);
    assert.match(none.out, /Sezení nespuštěná teď přijdou s dalšími běhy výzkumu/u);
    assert.doesNotMatch(none.out, /Spustit jedno sezení hned\?/u, "more batches: how many, not yes or no");
    assert.doesNotMatch(none.out, /\b(vy|váš|vaše|ty|tvůj)\b/iu);
    assert.deepEqual(placeTasks(w).map((x) => x.state), ["open"], "none now: the task waits first in the queue");
    assert.equal(sessions(w), 0);
    // Enter: the whole queue (two sessions), one after another
    const all = await w.run(["link", "open", link], { tty: true, answers: ["a", ""] });
    assert.match(all.out, /Sezení jedno po druhém; Ctrl-C požádá rozpracované sezení o dokončení a běh zastaví/u, all.out);
    assert.equal(sessions(w), 2, all.out);
    assert.equal(queued(w), 0);
  } finally {
    w.cleanup();
  }
});

test("the link places with one batch: asked yes or no as before, one session", opts, async () => {
  const w = await world(3);
  try {
    const id = readJsonFile(path.join(w.cwd, "strom.json")).id;
    const link = `strom-research://places?tree=${id}&do=run`;
    await w.ok(["place", "queue", "--all"]);
    const no = await w.run(["link", "open", link], { tty: true, answers: ["a", "n"] });
    assert.match(no.out, /Spustit jedno sezení hned\?/u, no.out);
    assert.doesNotMatch(no.out, /Kolik sezení/u);
    assert.deepEqual(placeTasks(w).map((x) => x.state), ["open"]);
    const yes = await w.run(["link", "open", link], { tty: true, answers: ["a", "a"] });
    assert.equal(sessions(w), 1, yes.out + yes.err);
    assert.equal(queued(w), 0);
  } finally {
    w.cleanup();
  }
});

test("how many sessions: 1, 2, 3 and the whole queue; the whole suggested up to three, else one; a price only measured", () => {
  const asked: { question: string; labels: string[]; suggested: number; back?: string }[] = [];
  const ctx = {
    choose: async (question: string, choices: { label: string }[], suggested: number, o: { back?: string } = {}) => {
      asked.push({ question, labels: choices.map((c) => c.label), suggested, ...(o.back ? { back: o.back } : {}) });
      return suggested;
    },
  } as unknown as Context;
  const tree = { list: () => [] } as unknown as Tree;
  const t = translator("de");
  return (async () => {
    assert.equal(await placesSessions(ctx, t, "de", tree, 2), 2);
    assert.equal(await placesSessions(ctx, t, "de", tree, 3), 3);
    assert.equal(await placesSessions(ctx, t, "de", tree, 7), 1);
    assert.deepEqual(asked[0]!.labels, ["1 Sitzung – etwa 8–15 Minuten", "die ganze Warteschlange, 2 Sitzungen – etwa 16–30 Minuten"]);
    assert.equal(asked[1]!.labels.length, 3);
    assert.deepEqual(asked[2]!.labels, [
      "1 Sitzung – etwa 8–15 Minuten",
      "2 Sitzungen – etwa 16–30 Minuten",
      "3 Sitzungen – etwa 24–45 Minuten",
      "die ganze Warteschlange, 7 Sitzungen – etwa 56–105 Minuten",
    ]);
    assert.equal(asked[2]!.suggested, 0);
    assert.equal(asked[2]!.back, "jetzt keine – die Bestimmung bleibt zuerst in der Warteschlange");
    assert.match(asked[2]!.question, /Die ganze Warteschlange sind 7 Sitzungen/u);
  })();
});

test("strom run --places: Ctrl-C asks the session at work to finish, then the run stops — no next session, the task back", { ...opts, skip: !hasGit || process.platform === "win32" }, async () => {
  const w = await world();
  try {
    await w.ok(["place", "queue", "--all"]);
    const child = spawn(process.execPath, [path.join(import.meta.dirname, "..", "..", "src", "cli.ts"), "run", "--places", "--max", "2"], {
      cwd: w.cwd,
      env: { ...w.env, AGENT_MODE: "wait" },
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    const exited = new Promise<number | null>((resolve) => child.on("exit", (code) => resolve(code)));
    for (const end = Date.now() + 30_000; Date.now() < end && !(/▶ N0001/u.test(out) && fs.existsSync(path.join(w.cwd, "data", "sessions", "N0001.json"))); )
      await new Promise((r) => setTimeout(r, 100));
    assert.match(out, /▶ N0001/u, out);
    child.kill("SIGINT");
    const code = await Promise.race([exited, new Promise<"late">((r) => setTimeout(() => r("late"), 60_000))]);
    if (code === "late") child.kill("SIGKILL");
    assert.equal(code, 0, out);
    assert.match(out, /Ctrl-C: sezení N0001 dostalo žádost skončit/u, out);
    assert.ok(!fs.existsSync(path.join(w.cwd, "data", "sessions", "N0002.json")), "no next session");
    assert.deepEqual(placeTasks(w).map((x) => x.state), ["open"], "the task back in the queue");
    assert.equal(queued(w), 17, "the places stay queued");
  } finally {
    w.cleanup();
  }
});
