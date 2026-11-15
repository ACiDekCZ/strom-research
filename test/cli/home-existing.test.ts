// A folder that is the home of a research already (a copy put back, another computer's folder) taken as the home as it
// is: nothing moved, the old folder left as it was, its trees out of the list — on the person's word alone.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { EXIT } from "../../src/core/errors.ts";

const opts = { skip: !hasGit };

/** Every file under a folder with its content: what "left as it was" is checked by. */
function snapshot(dir: string): Map<string, string> {
  const all = new Map<string, string>();
  for (const e of fs.readdirSync(dir, { recursive: true, withFileTypes: true })) {
    const p = path.join(e.parentPath, e.name);
    if (e.isFile()) all.set(path.relative(dir, p), fs.readFileSync(p, "latin1"));
  }
  return all;
}

/** The research in the old home (the tree Lhotákovi), and another one's home beside it (the tree Lhotovi, set up by its own settings). */
async function twoHomes(): Promise<{ w: World; old: string; other: string; config: () => any }> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M"]);
  const old = w.home;
  const other = path.join(w.dir, "Výzkum z disku", "Strom");
  const elsewhere = { STROM_CONFIG_DIR: path.join(w.dir, "config of the other") };
  await w.ok(["setup", "--yes", "--home", other], { env: elsewhere });
  await w.ok(["init", "Lhotovi"], { env: elsewhere, cwd: w.dir });
  return { w, old, other, config: () => readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json")) };
}

test("setup --home <the home of a research already>: the way to use it said, never left behind by a flag; --use-existing takes it as it is, nothing moved", opts, async () => {
  const { w, old, other, config } = await twoHomes();
  const before = snapshot(old);
  // a script names it without the decision: asked, nothing changed
  const asked = await w.run(["setup", "--yes", "--home", other, "--json"]);
  assert.equal(asked.code, EXIT.needsInput, asked.out + asked.err);
  assert.match(asked.out, /--use-existing/);
  assert.match(asked.out, /Lhotovi/);
  assert.equal(config().home, old);
  // the setting alone: the same way said
  const set = await w.run(["config", "set", "home", other]);
  assert.equal(set.code, EXIT.needsInput, set.out + set.err);
  assert.match(set.out + set.err, /strom setup --home ".*Strom" --use-existing/);
  assert.equal(config().home, old);
  // an agent's --use-existing: the person decides (no window here: needs-consent)
  const agent = await w.run(["setup", "--yes", "--home", other, "--use-existing", "--json"], { env: { CLAUDECODE: "1" } });
  assert.equal(agent.code, EXIT.needsConsent, agent.out + agent.err);
  assert.equal(config().home, old);
  // the person's no in the window: nothing changed
  const no = await w.run(["setup", "--yes", "--home", other, "--use-existing", "--json"], { env: { CLAUDECODE: "1" }, dialog: false });
  assert.equal(no.json.code, "consent.refused");
  assert.equal(config().home, old);
  // the person's word (a script of theirs): used, the old folder as it was
  const used = await w.ok(["setup", "--yes", "--home", other, "--use-existing", "--json"]);
  assert.equal(config().home, other);
  assert.deepEqual(used.json.usedExisting.left.map((t: { name: string }) => t.name), ["Lhotákovi"]);
  assert.deepEqual(snapshot(old), before, "nothing in the old folder moved, written or deleted");
  assert.deepEqual(
    (await w.ok(["trees", "--json"], { cwd: w.dir })).json.trees.map((t: { name: string }) => t.name),
    ["Lhotovi"],
  );
  // and back: the old folder is the home of a research too
  await w.ok(["setup", "--yes", "--home", old, "--use-existing"]);
  assert.equal(config().home, old);
  w.cleanup();
});

test("the wizard: another folder that holds a research is offered to be used as it is; a folder that holds something else is still refused", opts, async () => {
  const { w, old, other, config } = await twoHomes();
  const before = snapshot(old);
  const full = path.join(w.dir, "Lhota plná");
  fs.mkdirSync(full);
  fs.writeFileSync(path.join(full, "poznámka.txt"), "x");
  const refused = await w.ok(["setup"], { tty: true, answers: ["", full, "0", "0", "0", "0", "0", "n", "0"] });
  assert.match(refused.out, /Ve složce .*Lhota plná už něco je/);
  assert.equal(config().home, old);
  // no: it stays
  const no = await w.ok(["setup"], { tty: true, answers: ["", other, "n", "0", "0", "0", "0", "0", "n", "0"] });
  assert.match(no.out, /Ve složce .*Strom už je výzkum \(rodokmeny: Lhotovi\)/);
  assert.match(no.out, /Rodokmeny ze složky .* pak v seznamu nebudou \(zůstanou tam beze změny\): Lhotákovi\./);
  assert.equal(config().home, old);
  // yes: used, nothing moved
  const yes = await w.ok(["setup"], { tty: true, answers: ["", other, "", "0", "0", "0", "0", "0", "n", "0"] });
  assert.match(yes.out, /✓ Teď se používá výzkum ve složce .*Výzkum z disku\/Strom\./);
  assert.match(yes.out, /Mimo seznam, beze změny ve složce .*: Lhotákovi/);
  assert.equal(config().home, other);
  assert.deepEqual(snapshot(old), before);
  w.cleanup();
});
