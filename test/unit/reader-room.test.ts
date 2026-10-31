// A reader of an agent that fences by folders only (Codex's sandbox, agy's workspace) works in a room of its own: Codex
// writes its report in a folder that holds it alone (never the whole notes/readings, with every other reading's reports
// and results), mirrored to the report as it goes; agy opens copies of its views in a folder that holds them alone
// (never every document's .strom/views). Fakes of both, started as strom starts them.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World } from "../helpers.ts";
import { codexRunner } from "../../src/runners/codex.ts";
import { antigravityRunner } from "../../src/runners/antigravity.ts";
import { DOC_NEXT } from "../../src/core/document.ts";

const unix = { skip: process.platform === "win32" };

/** A tree's readings and views as they are: other readings' reports and results beside this one's, every document's views. */
function place(w: World): { readings: string; views: string[]; report: string; room: string } {
  const readings = path.join(w.dir, "strom ř", "notes", "readings");
  const viewsDir = path.join(w.dir, "strom ř", ".strom", "views");
  fs.mkdirSync(readings, { recursive: true });
  fs.mkdirSync(viewsDir, { recursive: true });
  fs.writeFileSync(path.join(readings, "D0001-1.md"), "# another reading\n");
  fs.writeFileSync(path.join(readings, "D0001.json"), "{}\n");
  fs.writeFileSync(path.join(viewsDir, "other-document.jpg"), "x");
  const views = ["pohled-1.jpg", "pohled-2.jpg"].map((n) => path.join(viewsDir, n));
  for (const v of views) fs.writeFileSync(v, `image ${path.basename(v)}`);
  const report = path.join(readings, "D0002-1.md");
  fs.writeFileSync(report, `# Document D0002 · reader 1\n\n${DOC_NEXT}\n`);
  const room = path.join(w.dir, "shared", "cache", "readers", "D0002-1");
  fs.mkdirSync(room, { recursive: true });
  fs.writeFileSync(path.join(room, "reader-settings.json"), "{}");
  return { readings, views, report, room };
}

function prompt(views: string[], report: string): string {
  return `Read these views:\n${views.map((v) => `- page: ${v}`).join("\n")}\nWrite your report to ${report} AS YOU GO.\n`;
}

/** A fake agent: its arguments and stdin noted, then what `body` does (a node script). */
function fake(w: World, name: string, body: string): string {
  const bin = path.join(w.dir, "bin");
  fs.mkdirSync(bin, { recursive: true });
  const script = path.join(w.dir, `${name}.mjs`);
  fs.writeFileSync(
    script,
    `import fs from "node:fs";\nconst args = process.argv.slice(2);\nconst input = args.at(-1) === "-" ? fs.readFileSync(0, "utf8") : "";\n` +
      `fs.writeFileSync(${JSON.stringify(path.join(w.dir, `${name}.json`))}, JSON.stringify({ args, input }));\n${body}\n`,
  );
  fs.writeFileSync(path.join(bin, name), `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(script)} "$@"\n`, { mode: 0o755 });
  w.env.PATH = `${bin}${path.delimiter}${w.env.PATH}`;
  return path.join(w.dir, `${name}.json`);
}

test("a Codex reader writes in a folder that holds its report alone, mirrored to the report as it goes", unix, async () => {
  const w = new World();
  const p = place(w);
  const noted = fake(
    w,
    "codex",
    `const report = /Write your report to (.+?) AS YOU GO/.exec(input)[1];
fs.appendFileSync(report, "## Image 1\\nresult: nothing\\n");
// seen in the real report while it still works (--until-found looks there)
let mirrored = false;
for (let i = 0; i < 40 && !mirrored; i++) {
  mirrored = fs.readFileSync(${JSON.stringify(p.report)}, "utf8").includes("result: nothing");
  if (!mirrored) await new Promise((r) => setTimeout(r, 100));
}
fs.writeFileSync(${JSON.stringify(path.join(w.dir, "mirrored"))}, String(mirrored));
console.log(JSON.stringify({ type: "thread.started", thread_id: "t1" }));
console.log(JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "done" } }));
console.log(JSON.stringify({ type: "turn.completed", usage: { input_tokens: 1, output_tokens: 1 } }));`,
  );
  const text = prompt(p.views, p.report);
  const r = await codexRunner.run({ cwd: w.dir, prompt: text, kickoff: text, env: w.env, logFile: path.join(w.dir, "codex.log"), reader: true, readerFiles: { views: p.views, report: p.report, room: p.room }, timeoutMs: 30_000 });
  assert.equal(r.outcome, "ok");
  const { args, input } = JSON.parse(fs.readFileSync(noted, "utf8")) as { args: string[]; input: string };
  const staged = path.join(p.room, "report", "D0002-1.md");
  assert.ok(args.includes(`sandbox_workspace_write.writable_roots=${JSON.stringify([path.join(p.room, "report")])}`), args.join(" "));
  assert.ok(!args.some((a) => a.includes(p.readings)), "never the folder of every reading's reports");
  assert.ok(input.includes(`Write your report to ${staged} AS YOU GO`) && !input.includes(p.report));
  for (const v of p.views) assert.ok(input.includes(v), "its views where they are (Codex reads them in place)");
  assert.equal(fs.readFileSync(path.join(w.dir, "mirrored"), "utf8"), "true");
  assert.equal(fs.readFileSync(p.report, "utf8"), `# Document D0002 · reader 1\n\n${DOC_NEXT}\n## Image 1\nresult: nothing\n`);
  assert.ok(!fs.existsSync(path.join(p.room, "report")), "the room taken away");
  assert.ok(fs.existsSync(path.join(p.room, "reader-settings.json")));
  assert.equal(fs.readFileSync(path.join(p.readings, "D0001-1.md"), "utf8"), "# another reading\n");
  w.cleanup();
});

test("an agy reader opens copies of its own views in a folder that holds them alone; its answer goes into its report", unix, async () => {
  const w = new World();
  const p = place(w);
  const noted = fake(
    w,
    "agy",
    `const dir = args[args.indexOf("--add-dir") + 1];
fs.writeFileSync(${JSON.stringify(path.join(w.dir, "seen.json"))}, JSON.stringify(fs.readdirSync(dir).sort()));
console.log(JSON.stringify({ event: "result", result: { status: "SUCCESS", response: "## Document\\nkind: letter", usage: { input_tokens: 1, output_tokens: 1 } } }));`,
  );
  const text = prompt(p.views, p.report);
  const r = await antigravityRunner.run({ cwd: w.dir, prompt: text, kickoff: text, env: w.env, logFile: path.join(w.dir, "agy.log"), reader: true, readerFiles: { views: p.views, report: p.report, room: p.room }, timeoutMs: 30_000 });
  assert.equal(r.outcome, "ok");
  const { args } = JSON.parse(fs.readFileSync(noted, "utf8")) as { args: string[] };
  const dirs = args.flatMap((a, i) => (args[i - 1] === "--add-dir" ? [a] : []));
  assert.deepEqual(dirs, [path.join(p.room, "views")], "one folder: this reader's views alone");
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(w.dir, "seen.json"), "utf8")), ["pohled-1.jpg", "pohled-2.jpg"], "never another document's views");
  const first = args[args.indexOf("--print") + 1]!;
  for (const v of p.views) {
    assert.ok(!first.includes(v), "the views named where it may open them");
    assert.ok(first.includes(path.join(p.room, "views", path.basename(v))));
  }
  assert.ok(!args.includes("--dangerously-skip-permissions"));
  assert.equal(fs.readFileSync(p.report, "utf8"), `# Document D0002 · reader 1\n\n## Document\nkind: letter\n${DOC_NEXT}\n`);
  assert.ok(!fs.existsSync(path.join(p.room, "views")), "the copies taken away");
  for (const v of p.views) assert.ok(fs.existsSync(v), "the views themselves kept");
  w.cleanup();
});
