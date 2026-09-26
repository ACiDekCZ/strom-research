// Hooks: the user's programs told of what is saved into a research.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit };

/** A hook "zapis" that writes what it got — and what strom says of the first target — into its folder. */
async function world(events?: string[]): Promise<World & { hook: string }> {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci Josefa", "--new-person", "Josef /Novák/", "--sex", "M", "--born", "ABT 1885"]);
  const hook = path.join(w.home, "shared", "plugins", "hooks", "zapis");
  fs.mkdirSync(hook, { recursive: true });
  fs.writeFileSync(path.join(hook, "hook.json"), JSON.stringify({ interface: 1, title: "Zápis", command: ["node", "hook.ts"], ...(events ? { events } : {}) }));
  fs.writeFileSync(
    path.join(hook, "hook.ts"),
    `import fs from "node:fs";
import { execFileSync } from "node:child_process";
const save = JSON.parse(fs.readFileSync(0, "utf8"));
const who = save.events[0].targets[0];
const card = who?.startsWith("P") ? execFileSync("strom", ["person", "show", who], { cwd: save.tree.root, encoding: "utf8", shell: process.platform === "win32" }) : "";
fs.appendFileSync("got.jsonl", JSON.stringify({ ...save, card, env: process.env.STROM_HOOK }) + "\\n");
console.log("told of", save.events.map((e) => e.op).join(" "));
`,
  );
  return Object.assign(w, { hook });
}

/** What the hook got so far (it runs in the background: wait for it). */
async function got(w: World & { hook: string }, n: number): Promise<Record<string, any>[]> {
  const file = path.join(w.hook, "got.jsonl");
  for (let i = 0; i < 100; i++) {
    const lines = fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim().split("\n").filter(Boolean) : [];
    if (lines.length >= n) return lines.map((l) => JSON.parse(l));
    await new Promise((r) => setTimeout(r, 100));
  }
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim().split("\n").map((l) => JSON.parse(l)) : [];
}

test("a hook the user turned on is told of what was saved — in the background, only what it wants, and may read more through strom", opts, async () => {
  const w = await world(["person.add", "family.*"]);
  // a folder alone does nothing
  await w.ok(["person", "add", "Marie /Nováková/", "--sex", "F"]);
  await new Promise((r) => setTimeout(r, 500));
  assert.ok(!fs.existsSync(path.join(w.hook, "got.jsonl")), "not on: never started");
  const on = await w.ok(["hook", "on", "zapis"], { tty: true });
  assert.match(on.out, /zapis: on — told of what is saved \(person\.add, family\.\*\)/);
  await w.ok(["person", "add", "Anna /Nováková/", "--sex", "F", "--born", "1912"]);
  const [first] = await got(w, 1);
  assert.equal(first!.hook, "zapis");
  assert.equal(first!.tree.name, "Novákovi");
  assert.match(first!.commit, /^[0-9a-f]{7,}$/);
  assert.deepEqual(first!.events.map((e: { op: string }) => e.op), ["person.add"], "the fact of her birth is not what it wants");
  assert.equal(first!.events[0].targets[0], "P0003");
  assert.match(first!.card, /Anna/, "it read more of her through strom");
  assert.equal(first!.env, "zapis");
  assert.match(fs.readFileSync(path.join(w.hook, "hook.log"), "utf8"), /told of person\.add/);
  // what it does not want starts it not
  await w.ok(["task", "add", "Křest", "--level", "locate", "--where", "Kamenice", "--why", "a", "--done-when", "b", "--about", "P1"]);
  await new Promise((r) => setTimeout(r, 700));
  assert.equal((await got(w, 1)).length, 1);
  // off: told no more
  await w.ok(["hook", "off", "zapis"], { tty: true });
  await w.ok(["person", "add", "Jan /Novák/", "--sex", "M"]);
  await new Promise((r) => setTimeout(r, 700));
  assert.equal((await got(w, 1)).length, 1);
  w.cleanup();
});

test("a hook is the user's: an agent neither turns it on nor off; a broken hook never breaks a save", opts, async () => {
  const w = await world();
  w.env.CLAUDECODE = "1";
  const agent = await w.run(["hook", "on", "zapis"]);
  assert.equal(agent.code, 4);
  assert.match(agent.err + agent.out, /an agent cannot answer this/);
  delete w.env.CLAUDECODE;
  await w.ok(["hook", "on", "zapis"], { tty: true });
  const list = await w.ok(["hook", "list", "--json"]);
  assert.deepEqual(list.json.on, ["zapis"]);
  // broken: its program is gone — the research goes on
  fs.rmSync(path.join(w.hook, "hook.ts"));
  await w.ok(["person", "add", "Marie /Nováková/", "--sex", "F"]);
  // gone altogether
  fs.rmSync(w.hook, { recursive: true });
  await w.ok(["person", "add", "Anna /Nováková/", "--sex", "F"]);
  w.cleanup();
});

test("strom hook test: the hook run now on the last operations saved, or on one named — and what it printed", opts, async () => {
  const w = await world(["person.*"]);
  const r = await w.ok(["hook", "test", "zapis", "--last", "3"]);
  assert.match(r.out, /zapis: \d operation\(s\) — ended well/);
  assert.match(r.out, /told of person\.add/);
  const one = await w.ok(["hook", "test", "zapis", "--op", "person.add", "--target", "P0001", "--json"]);
  assert.equal(one.json.status, 0);
  assert.match((await got(w, 2))[1]!.card, /Josef/);
  const none = await w.ok(["hook", "test", "zapis", "--op", "task.done"]);
  assert.match(none.out, /zapis wants none of these: task\.done/);
  w.cleanup();
});
