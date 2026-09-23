// Benchmark at target scale: `node scripts/bench.ts [persons]` (default 5000,
// ~10x the largest research in the old workflow). Seeds a tree through the
// Tree API, then times commands the way an agent runs them: a fresh process
// each (cold, what agents pay) and in-process (warm).

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { main } from "../src/cli/main.ts";
import { Tree } from "../src/core/tree.ts";
import { addPerson } from "../src/core/actions.ts";
import type { Family, Person } from "../src/core/model.ts";

const N = Number(process.argv[2] ?? 5000);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom bench ěš "));
const env: Record<string, string> = {
  ...(process.env as Record<string, string>),
  HOME: path.join(dir, "home"),
  STROM_CONFIG_DIR: path.join(dir, "config"),
  GIT_CONFIG_GLOBAL: path.join(dir, "gitconfig"),
  LANG: "cs_CZ.UTF-8",
};
fs.mkdirSync(env.HOME!, { recursive: true });
fs.writeFileSync(env.GIT_CONFIG_GLOBAL!, "");
const quiet = { stdout: () => {}, stderr: (s: string) => process.stderr.write(s), tty: false };
await main(["setup", "--yes"], quiet, env, dir);
await main(["init", "Bench"], quiet, env, dir);
const root = path.join(env.HOME!, "Documents", "Strom", "Bench");

const t0 = performance.now();
const tree = Tree.open(root, env);
const surnames = ["Novák", "Svoboda", "Dvořák", "Černý", "Procházka", "Kučera", "Veselý", "Horák", "Němec", "Pokorný"];
const given = ["Jan", "Josef", "Marie", "Anna", "František", "Václav", "Terezie", "Karel", "Rozálie", "Antonín"];
const ids: string[] = [];
// One lock for the whole import, as `strom import` does.
tree.withTreeLock(() => {
for (let i = 0; i < N; i++) {
  const p = addPerson(tree, {
    name: `${given[i % 10]} /${surnames[(i * 7) % 10]}/`,
    sex: i % 2 ? "F" : "M",
    born: String(1950 - Math.floor(i / 2) * 0 - (Math.floor(Math.log2(i + 1)) * 28)),
    bornPlace: `Obec ${i % 97}`,
    died: i % 3 ? String(2000 - Math.floor(Math.log2(i + 1)) * 28) : undefined,
    note: i % 5 === 0 ? "Poznámka k osobě, jak ji rodina pamatuje — mlynář, pak domkář v čp. 12." : undefined,
  });
  ids.push(p.id);
}
});
// Pedigree: person k has parents 2k+1 and 2k+2 (a full binary ancestry).
tree.withTreeLock(() => {
  const now = new Date().toISOString();
  for (let k = 0; 2 * k + 2 < N; k++) {
    const f: Family = {
      id: tree.allocate("F"),
      type: "family",
      partners: [ids[2 * k + 1]!, ids[2 * k + 2]!],
      children: [{ person: ids[k]!, relation: "birth" }],
      events: [],
      notes: [],
      created: now,
      updated: now,
    };
    tree.put(f, { op: "family.add", targets: [f.id], summary: `+${f.id}` });
  }
});
tree.commit(`Bench seed: ${N} persons`);
const seedMs = performance.now() - t0;

const cli = path.join(import.meta.dirname, "..", "src", "cli.ts");
function cold(args: string[]): number {
  const s = performance.now();
  const r = spawnSync(process.execPath, [cli, ...args], { cwd: root, env, encoding: "utf8" });
  if (r.status !== 0 && r.status !== 1) throw new Error(`${args.join(" ")}: ${r.stderr}`);
  return performance.now() - s;
}
async function warm(args: string[]): Promise<number> {
  const s = performance.now();
  await main(args, quiet, env, root);
  return performance.now() - s;
}

const baseline = cold(["help", "guide"]); // node startup + module load, no tree access
const cases: [string, string[]][] = [
  ["orientation", []],
  ["person list", ["person", "list"]],
  ["person list filter", ["person", "list", "novak jan"]],
  ["person show", ["person", "show", "P0001"]],
  ["research new", ["research", "new", "Předci", "--person", "P0001"]],
  ["research show", ["research", "show", "G0001"]],
  ["event add (write+commit)", ["event", "add", "P0001", "OCCU", "--value", "mlynář"]],
  ["note add (write+commit)", ["note", "add", "P0002", "Krátká poznámka"]],
  ["verify --fast", ["verify", "--fast"]],
  ["guard", ["guard"]],
  ["status", ["status"]],
  ["verify (full)", ["verify"]],
  ["check (full)", ["check"]],
];
console.log(`seed: ${N} persons, ${Math.max(0, Math.floor((N - 1) / 2))} families in ${(seedMs / 1000).toFixed(1)} s`);
console.log(`process start + module load: ${baseline.toFixed(0)} ms\n`);
console.log("command".padEnd(28) + "cold ms".padStart(9) + "warm ms".padStart(9));
for (const [name, args] of cases) {
  const c = cold(args);
  const w = await warm(args);
  console.log(name.padEnd(28) + c.toFixed(0).padStart(9) + w.toFixed(0).padStart(9));
}
if (process.argv.includes("--keep")) console.log(`\nkept: ${root}\nenv: HOME=${env.HOME} STROM_CONFIG_DIR=${env.STROM_CONFIG_DIR} GIT_CONFIG_GLOBAL=${env.GIT_CONFIG_GLOBAL}`);
else fs.rmSync(dir, { recursive: true, force: true });
void (null as unknown as Person);
