// What the tests of gates share: they are split over files (gates*.test.ts) that run side by side.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { World, hasGit } from "../helpers.ts";

export const opts = { skip: !hasGit };
export const agent = path.join(import.meta.dirname, "..", "fixtures", "agent.ts");

/** A tree with three tasks and a gate "zkouška" that answers from a list, one answer each time it is asked. */
export async function world(answers: { code: number; say?: unknown }[]): Promise<World & { gate: string }> {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci Josefa", "--new-person", "Josef /Novák/", "--sex", "M", "--born", "ABT 1885", "--born-place", "Kamenice nad Lipou"]);
  for (const what of ["Křest", "Oddavky", "Úmrtí"]) await w.ok(["task", "add", what, "--level", "locate", "--where", "Kamenice", "--why", "a", "--done-when", "b", "--about", "P1"]);
  const gate = path.join(w.home, "shared", "plugins", "gates", "zkouska");
  fs.mkdirSync(gate, { recursive: true });
  fs.writeFileSync(path.join(gate, "gate.json"), JSON.stringify({ interface: 1, title: "Zkouška", command: ["node", "gate.ts"] }));
  fs.writeFileSync(path.join(gate, "answers.json"), JSON.stringify(answers));
  fs.writeFileSync(
    path.join(gate, "gate.ts"),
    `import fs from "node:fs";
const answers = JSON.parse(fs.readFileSync("answers.json", "utf8"));
const next = answers.shift() ?? { code: 0 };
fs.writeFileSync("answers.json", JSON.stringify(answers));
fs.appendFileSync("asked.txt", [process.env.STROM_SESSIONS, process.env.STROM_NEXT_TASK, process.env.STROM_LANG, process.env.STROM_AGENT].join(" ") + "\\n");
if (next.say !== undefined) console.log(typeof next.say === "string" ? next.say : JSON.stringify(next.say));
process.exit(next.code);
`,
  );
  Object.assign(w.env, { STROM_RUNNER_SCRIPT: agent, AGENT_MODE: "echo" });
  return Object.assign(w, { gate });
}
