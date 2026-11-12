// strom repair where the history (git) is older than the research (found 2026-11-09: a research in iCloud Drive, its
// .git an older copy with "index 2" and "HEAD 2" beside it, its oldest log gone — strom verify said "unsealed" and
// pointed to strom repair, which would have removed the work of every later session). strom verify says then the way
// that loses nothing; strom repair removing more than a few records, or any record with a sign of a lost history, is
// the person's decision at their terminal; what strom repair removed the person puts back with strom repair undo.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit };
const agent = { CLAUDECODE: "1" };

const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

/** Every file of a folder with its hash. */
function snapshot(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) out.set(path.relative(dir, p), crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex"));
    }
  };
  walk(dir);
  return out;
}

function logs(root: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(d, e.name));
      else if (e.name.endsWith(".jsonl")) out.push(path.join(d, e.name));
    }
  };
  walk(path.join(root, "data", "ops"));
  return out.sort();
}

/**
 * Lhotákovi: two people, then the history (git) copied away; then more work — people, a family, a note. Then the older
 * copy of .git back in place, iCloud's copies of its files beside it, and the oldest log gone.
 */
async function reverted(w: World): Promise<{ root: string; later: string[] }> {
  const root = await w.withTree("Lhotákovi");
  await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M", "--born", "1850"]);
  await w.ok(["person", "add", "Žofie /Lhotáková/", "--sex", "F", "--born", "1855"]);
  const older = path.join(w.dir, "older git");
  fs.cpSync(path.join(root, ".git"), older, { recursive: true });
  await w.ok(["person", "add", "Ота /Лхотак/", "--sex", "M", "--born", "1878"]);
  await w.ok(["person", "add", "Eva /Lhotáková/", "--sex", "F", "--born", "1880"]);
  await w.ok(["person", "add", "Václav /Lhoták/", "--sex", "M", "--born", "1902"]);
  await w.ok(["person", "add", "Marie /Lhotáková/", "--sex", "F", "--born", "1905"]);
  await w.ok(["family", "add", "--partner", "P0003", "--partner", "P0004", "--child", "P0005"]);
  await w.ok(["note", "add", "P0005", "Narozen ve Lhotě."]);
  const later = fs.readdirSync(path.join(root, "data", "persons")).filter((n) => !["P0001.json", "P0002.json"].includes(n));
  // the older copy of the history back, as a cloud drive leaves it
  fs.rmSync(path.join(root, ".git"), { recursive: true, force: true });
  fs.cpSync(older, path.join(root, ".git"), { recursive: true });
  fs.copyFileSync(path.join(root, ".git", "index"), path.join(root, ".git", "index 2"));
  fs.copyFileSync(path.join(root, ".git", "HEAD"), path.join(root, ".git", "HEAD 2"));
  // and the oldest log gone
  fs.rmSync(logs(root)[0]!);
  return { root, later };
}

test("a history older than the research: verify says the way that loses nothing, strom repair waits for the person, strom repair undo puts the work back", opts, async () => {
  const w = new World();
  try {
    const { root, later } = await reverted(w);
    assert.equal(later.length, 4, later.join(", "));
    const data = path.join(root, "data");
    const before = snapshot(data);

    // the check: never strom repair, the count of what it would remove, the way that loses nothing
    const verify = await w.run(["verify"], { tty: true });
    assert.equal(verify.code, 1, verify.out + verify.err);
    assert.match(verify.out, /history-reverted/, verify.out);
    assert.match(verify.out, /historie \(git\) je starší než výzkum: strom repair by odebral \d+ záznam/u, verify.out);
    assert.match(verify.out, /Time Machine/, verify.out);
    assert.match(verify.out, /strom seal accept/, verify.out);
    assert.doesNotMatch(verify.out, /→ strom repair/, verify.out);
    const json = (await w.run(["verify", "--json"], { env: agent })).json;
    const lost = json.findings.find((f: { code: string }) => f.code === "history-reverted");
    assert.ok(lost, JSON.stringify(json));
    assert.ok(lost.count >= 5, JSON.stringify(lost));
    assert.match(lost.message, /written by operations sealed in their logs/);
    assert.match(lost.message, /index 2|HEAD 2/);
    assert.match(lost.hint, /back up the whole research folder first/);
    assert.ok(json.findings.every((f: { hint?: string }) => !f.hint?.startsWith("strom repair")), JSON.stringify(json.findings));
    assert.match((await w.run(["check"], { tty: true })).out, /history-reverted/);
    // a write is refused with the same way
    const write = await w.run(["person", "add", "Petr /Lhoták/", "--sex", "M", "--json"], { env: agent });
    assert.notEqual(write.code, 0);
    assert.equal(write.json.code, "tree.history-reverted", write.out);
    assert.match(write.json.hint, /Time Machine/);

    // strom repair: an agent, a script, --yes, a no — only the count, nothing removed
    const byAgent = await w.run(["repair", "--json"], { env: agent, tty: true, answers: ["a"] });
    assert.equal(byAgent.code, 4, byAgent.out + byAgent.err);
    assert.equal(byAgent.json.status, "needs-consent", byAgent.out);
    assert.match(byAgent.json.needs[0].question, /strom repair would remove \d+ records \(\d+ written by operations sealed in their logs/);
    assert.match(byAgent.json.needs[0].question, /an agent cannot answer this/);
    assert.equal((await w.run(["repair"])).code, 4);
    assert.equal((await w.run(["repair", "--yes"], { tty: true })).code, 4);
    const no = await w.run(["repair"], { tty: true, answers: ["n"] });
    assert.equal(no.code, 0, no.out + no.err);
    assert.match(no.out, /strom repair by odebral \d+ záznam/u, no.out);
    assert.match(no.out, /zapsané operacemi zapečetěnými ve vlastních lozích/u, no.out);
    assert.match(no.out, /kopie z iCloudu uvnitř \.git/u, no.out);
    assert.match(no.out, /Nejdřív zálohovat celou složku výzkumu/u, no.out);
    assert.deepEqual(snapshot(data), before, "nothing removed without the person's yes");

    // the person's yes: removed, a copy kept, the way back said
    const yes = await w.ok(["repair"], { tty: true, answers: ["a"] });
    const stamp = /strom repair undo (\d{4}-\S+)/u.exec(yes.out)?.[1];
    assert.ok(stamp, yes.out);
    for (const name of later) assert.equal(fs.existsSync(path.join(data, "persons", name)), false, name);
    assert.ok(fs.existsSync(path.join(root, ".strom", "quarantine", stamp, "repair.json")));

    // the copies listed for anybody; putting back is the person's
    const list = await w.ok(["repair", "undo", "--json"], { env: agent });
    assert.deepEqual(list.json.quarantines.map((q: { stamp: string }) => q.stamp), [stamp]);
    assert.ok(list.json.quarantines[0].records >= 5, list.out);
    const agentUndo = await w.run(["repair", "undo", stamp, "--json"], { env: agent, tty: true, answers: ["a"] });
    assert.equal(agentUndo.code, 4, agentUndo.out);
    assert.equal(agentUndo.json.status, "needs-consent");
    assert.equal((await w.run(["repair", "undo", stamp])).code, 4);
    const after = snapshot(data);
    assert.equal((await w.ok(["repair", "undo", stamp], { tty: true, answers: ["n"] })).code, 0);
    assert.deepEqual(snapshot(data), after);
    assert.equal((await w.run(["repair", "undo", "../nic"], { tty: true, answers: ["a"] })).code, 1);

    // put back: every record as it was before strom repair, sealed — verify clean, strom goes on
    const back = await w.ok(["repair", "undo", stamp], { tty: true, answers: ["a"] });
    assert.match(back.out, /vráceno: \d+ soubor/u, back.out);
    const persons = (m: Map<string, string>) => new Map([...m].filter(([k]) => k.startsWith(`persons${path.sep}`) || k.startsWith(`families${path.sep}`) || k.startsWith(`notes${path.sep}`)));
    assert.deepEqual(persons(snapshot(data)), persons(before));
    await w.ok(["verify"]);
    await w.ok(["person", "add", "Petr /Lhoták/", "--sex", "M"]);
    await w.ok(["verify"]);
    assert.equal(git(root, "status", "--porcelain", "--", "data"), "");
    assert.match(git(root, "log", "-2", "--format=%s"), /Repair undone/);
  } finally {
    w.cleanup();
  }
});

test("a few records an agent wrote by hand: strom repair as ever; more than a few: the person decides; undo of a copy without its list", opts, async () => {
  const w = new World();
  try {
    const root = await w.withTree("Lhotákovi");
    await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M"]);
    const persons = path.join(root, "data", "persons");
    const hand = (id: string) => fs.writeFileSync(path.join(persons, `${id}.json`), fs.readFileSync(path.join(persons, "P0001.json"), "utf8").replaceAll("P0001", id));
    // one: the hint stays strom repair, an agent may run it, nothing asked
    hand("P0002");
    const v = (await w.run(["verify", "--json"], { env: agent })).json;
    assert.ok(v.findings.some((f: { hint?: string }) => f.hint === "strom repair"), JSON.stringify(v));
    assert.ok(!v.findings.some((f: { code: string }) => f.code === "history-reverted"));
    await w.ok(["repair"], { env: agent });
    assert.equal(fs.existsSync(path.join(persons, "P0002.json")), false);

    // four: asked first, an agent gets the count
    for (const id of ["P0002", "P0003", "P0004", "P0005"]) hand(id);
    const r = await w.run(["repair", "--json"], { env: agent });
    assert.equal(r.code, 4, r.out);
    assert.match(r.json.needs[0].question, /would remove 4 records/);
    assert.ok(fs.existsSync(path.join(persons, "P0005.json")));
    const yes = await w.ok(["repair"], { tty: true, answers: ["a"] });
    const stamp = /strom repair undo (\d{4}-\S+)/u.exec(yes.out)![1]!;
    assert.equal(fs.existsSync(path.join(persons, "P0005.json")), false);

    // a copy as an older strom kept it (no list of what it wrote): what is not there now goes back, nothing written over
    fs.rmSync(path.join(root, ".strom", "quarantine", stamp, "repair.json"));
    // onto a research changed outside strom: refused, nothing put back
    fs.writeFileSync(path.join(persons, "P0001.json"), fs.readFileSync(path.join(persons, "P0001.json"), "utf8").replace("Lhoták", "Lhota"));
    const refused = await w.run(["repair", "undo", stamp], { tty: true, answers: ["a"] });
    assert.equal(refused.code, 1, refused.out + refused.err);
    assert.match(refused.err, /výzkum má změny, které strom nezapečetil/u, refused.err);
    assert.equal(fs.existsSync(path.join(persons, "P0005.json")), false);
    await w.ok(["repair"], { env: agent });
    await w.ok(["repair", "undo", stamp], { tty: true, answers: ["a"] });
    for (const id of ["P0002", "P0003", "P0004", "P0005"]) assert.ok(fs.existsSync(path.join(persons, `${id}.json`)), id);
    await w.ok(["verify"]);
  } finally {
    w.cleanup();
  }
});

test("a research whose .git is gone: verify says the person's strom seal accept, strom repair removes nothing", opts, async () => {
  const w = new World();
  try {
    const root = await w.withTree("Lhotákovi");
    await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M"]);
    await w.ok(["person", "add", "Žofie /Lhotáková/", "--sex", "F"]);
    fs.rmSync(logs(root)[0]!);
    fs.rmSync(path.join(root, ".git"), { recursive: true, force: true });
    const data = snapshot(path.join(root, "data"));
    const verify = await w.run(["verify"], { tty: true });
    assert.equal(verify.code, 1, verify.out);
    assert.match(verify.out, /strom seal accept/, verify.out);
    assert.doesNotMatch(verify.out, /→ strom repair/, verify.out);
    assert.notEqual((await w.run(["repair"], { tty: true, answers: ["a"] })).code, 0);
    assert.deepEqual(snapshot(path.join(root, "data")), data);
  } finally {
    w.cleanup();
  }
});
