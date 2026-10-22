// strom fixes: what a fix of strom's left behind in a research — found free from the research's own data (a reading of
// a crop an older strom read from the whole image reduced, where a sharper part was at hand), said with its estimate,
// set right only by a person at their own terminal (a few first, then the rest), the decision kept in strom.json.
// An agent and a run nobody watches never start it; nothing is overwritten; a reading strom records now says its
// image, crop, agent and model.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { encodeImage } from "../../src/image/index.ts";
import { compareReadings, estimateFix, headImages } from "../../src/commands/fixchecks.ts";
import type { Finding } from "../../src/core/reader.ts";
import type { Media } from "../../src/core/model.ts";
import { Tree } from "../../src/core/tree.ts";

const opts = { skip: !hasGit };
const W = 1708;
const H = 1331;

/** Images 1–2 of B0001, W×H (a scan reduced); of image 1 the part 0.03,0.46,0.47,0.27 at 2000×895 (M0003, 2.5×). */
async function world(): Promise<World> {
  const w = new World();
  await w.withTree();
  // the readings below were read by the script agent, as it reads now: no other model to offer them to (new-model)
  w.env.STROM_AGENT = "script";
  await w.ok(["recordset", "add", "Kniha oddaných 1801–1830", "--kinds", "marriage"]);
  const dir = path.join(w.dir, "skeny");
  fs.mkdirSync(dir);
  const img = (name: string, width: number, height: number, grey: number) =>
    fs.writeFileSync(path.join(dir, name), encodeImage({ width, height, channels: 3, data: new Uint8Array(width * height * 3).fill(grey) }, "jpeg"));
  img("s0001.jpg", W, H, 200);
  img("s0002.jpg", W, H, 180);
  await w.ok(["media", "add", dir, "--recordset", "B1"]);
  const part = path.join(w.dir, "výřez ř.jpg");
  fs.writeFileSync(part, encodeImage({ width: 2000, height: 895, channels: 3, data: new Uint8Array(2000 * 895 * 3).fill(120) }, "jpeg"));
  await w.ok(["media", "add", part, "--recordset", "B1", "--image", "1", "--crop", "0.03,0.46,0.47,0.27"]);
  // registered before the readings below (as a fetch weeks back), through the tree as strom writes it
  const tree = Tree.open(w.cwd, w.env);
  tree.withTreeLock(() => {
    for (const id of ["M0001", "M0002", "M0003"]) tree.put({ ...tree.get<Media>(id)!, created: "2026-10-01T08:00:00.000Z" }, { op: "media.update", targets: [id], summary: `${id} registered weeks back` });
    tree.commit("Images registered weeks back");
  });
  return w;
}

const append = (file: string, rec: object) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(rec) + "\n");
};

/**
 * A blind reading of a crop of image 1 as an older strom left it: its report (no Strom: line in its head), the views
 * it made for its reader (whole image M0001, reduced) and its reader — `ago` minutes back.
 */
function oldReading(w: World, k: number, crop: [number, number, number, number], text: string, ago: number): string {
  const stem = `2026-10-20-M0001-${k}`;
  const dir = path.join(w.cwd, "notes", "readings");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, `${stem}-1.md`),
    `# Reading M0001 · batch 1 of 1\nQuestion: Přepsat zápis celý; nejisté označit [?]\nBlind: yes\n\n## Image 1 · M0001\nresult: found\nentries:\n- ${text}\n`,
  );
  const begun = Date.now() - ago * 60_000;
  const [x, y, cw, ch] = crop;
  append(path.join(w.cwd, ".strom", "views", "views.jsonl"), { reader: 1, key: "M0001", kind: "crop", region: { x: Math.round(x * W), y: Math.round(y * H), w: Math.round(cw * W), h: Math.round(ch * H) }, W, H, at: new Date(begun - 2000).toISOString() });
  append(path.join(w.cwd, ".strom", "metrics", "readers.jsonl"), { reader: `read-${stem}-1`, kind: "read", agent: "script", outcome: "ok", images: 1, wallMs: 30_000, ms: 30_000, at: new Date(begun + 30_000).toISOString() });
  return stem;
}

const READER = 'const p = process.env.STROM_PROMPT ?? "";\nfor (const m of p.matchAll(/^- (M\\d{4}) · image (\\d+)/gm)) console.log("## Image " + m[2] + " · " + m[1] + "\\nresult: found\\nentries:\\n- Jan Novák, Marie Dvořáková, dům 12, 1822\\n");\n';

test("strom fixes: a blind reading of a crop read reduced is found, said with its estimate, and remembered as declined", opts, async () => {
  const w = await world();
  try {
    const stem = oldReading(w, 1, [0.05, 0.5, 0.2, 0.15], "Jan Novák [?], dům [?]", 30);
    // elsewhere on the image (no sharper part there) and image 2 (none): nothing
    oldReading(w, 2, [0.6, 0.1, 0.3, 0.2], "Josef Dvořák", 20);
    const list = await w.ok(["fixes", "--json"]);
    const c = list.json.checks.find((x: { id: string }) => x.id === "blind-reduced");
    assert.equal(c.state, "pending");
    assert.equal(c.found.count, 1);
    assert.equal(c.found.exact, 1);
    assert.equal(c.found.estimated, 0);
    assert.equal(c.items[0].reading, stem);
    assert.equal(c.items[0].media, "M0001");
    assert.equal(c.items[0].from, "M0003");
    assert.equal(c.items[0].unclear, 2);
    assert.equal(c.items[0].crop, "0.0498,0.5004,0.2002,0.1503");
    assert.equal(c.estimate.level, "cheap");
    assert.equal(c.estimate.calls, 1);
    // what it is, what it found, what setting it right does and does not, the estimate: in the research language
    const show = await w.ok(["fixes", "show", "blind-reduced", "--lang", "cs"]);
    assert.match(show.out, /Čtení části snímku ze zmenšeného snímku — 1 čtení čeká na rozhodnutí/);
    assert.match(show.out, /Nalezeno: 1 čtení \(1 místo\) — přesně podle záznamu stromu o čtení/);
    assert.match(show.out, new RegExp(`${stem} · M0001 \\(B0001:1\\) · ostřejší kopie M0003 \\(2\\.\\d×\\)`));
    assert.match(show.out, /Nic se nepřepíše ani nesmaže/);
    assert.match(show.out, /Náročnost: levné · 1 volání čtenáře · asi 1 min/);
    assert.doesNotMatch(show.out, /\$|USD|Kč/, "no amounts");
    // strom doctor says it, the fix to run beside it
    const doctor = await w.run(["doctor", "--json"]);
    const line = doctor.json.checks.find((x: { name: string }) => x.name === "fixes");
    assert.equal(line.status, "warn");
    assert.equal(line.fix, "strom fixes show blind-reduced");
    // the menu: one line while it waits, the way to it
    const menu = await w.ok([], { tty: true, answers: ["0"] });
    assert.match(menu.out, /^Oprava stromu čeká na rozhodnutí: Čtení části snímku ze zmenšeného snímku \(1\) — Nastavení → Údržba → Opravy$/m);
    // declining is the person's: an agent, a run nobody watches → exit 4, nothing kept
    for (const env of [{ CLAUDECODE: "1" }, { STROM_NONINTERACTIVE: "1" }] as Record<string, string>[]) {
      const r = await w.run(["fixes", "decline", "blind-reduced"], { env });
      assert.equal(r.code, 4, JSON.stringify(env));
    }
    assert.equal(JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).fixes, undefined);
    // a person at their terminal: kept with the research, never offered again
    await w.ok(["fixes", "decline", "blind-reduced"], { tty: true });
    const kept = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).fixes["blind-reduced"];
    assert.equal(kept.decision, "declined");
    assert.match(kept.version, /^\d+\.\d+\.\d+/);
    const after = await w.ok(["fixes", "--json"]);
    assert.equal(after.json.checks[0].state, "declined");
    assert.equal((await w.run(["doctor", "--json"])).json.checks.find((x: { name: string }) => x.name === "fixes").status, "ok");
    assert.doesNotMatch((await w.ok([], { tty: true, answers: ["0"] })).out, /Oprava stromu/);
    // asked again
    await w.ok(["fixes", "reopen", "blind-reduced"], { tty: true });
    assert.equal((await w.ok(["fixes", "--json"])).json.checks[0].state, "pending");
  } finally {
    w.cleanup();
  }
});

test("strom fixes run: an agent, a run nobody watches and --yes never start the paid readings", opts, async () => {
  const w = await world();
  try {
    oldReading(w, 1, [0.05, 0.5, 0.2, 0.15], "Jan Novák [?]", 30);
    w.env.STROM_RUNNER_SCRIPT = path.join(w.dir, "reader.mjs");
    fs.writeFileSync(w.env.STROM_RUNNER_SCRIPT, READER);
    const before = fs.readdirSync(path.join(w.cwd, "notes", "readings")).length;
    for (const env of [{ CLAUDECODE: "1" }, { STROM_NONINTERACTIVE: "1" }, { STROM_SESSION: "x1" }] as Record<string, string>[]) {
      const r = await w.run(["fixes", "run", "blind-reduced", "--agent", "script", "--lang", "en"], { env, tty: true, answers: ["2"] });
      assert.equal(r.code, 4, JSON.stringify(env));
    }
    const yes = await w.run(["fixes", "run", "blind-reduced", "--agent", "script", "--yes", "--lang", "en"], { tty: true, answers: ["1"] });
    assert.notEqual(yes.code, 0);
    assert.equal(fs.readdirSync(path.join(w.cwd, "notes", "readings")).length, before, "nothing read");
    // Enter at the person's terminal: later — nothing read, nothing kept
    const later = await w.ok(["fixes", "run", "blind-reduced", "--agent", "script", "--lang", "en"], { tty: true, answers: [""] });
    assert.match(later.out, /Left for later: strom fixes run blind-reduced/);
    assert.equal(fs.readdirSync(path.join(w.cwd, "notes", "readings")).length, before, "nothing read");
    assert.equal(JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).fixes, undefined);
  } finally {
    w.cleanup();
  }
});

test("strom fixes run: a few first, their summary and the rest with the estimate again; the new readings beside the old, a task where they differ", opts, async () => {
  const w = await world();
  try {
    const stems = [
      oldReading(w, 1, [0.05, 0.5, 0.2, 0.15], "Jan Novák [?], dům [?], 1822", 50),
      oldReading(w, 2, [0.06, 0.52, 0.2, 0.15], "Jan Novák, Marie Dvořáková, dům 12, 1822", 40),
      oldReading(w, 3, [0.25, 0.5, 0.2, 0.15], "Václav Černý [?]", 30),
      oldReading(w, 4, [0.1, 0.6, 0.2, 0.1], "Anna Svobodová", 20),
    ];
    w.env.STROM_RUNNER_SCRIPT = path.join(w.dir, "reader.mjs");
    fs.writeFileSync(w.env.STROM_RUNNER_SCRIPT, READER);
    const olds = Object.fromEntries(stems.map((s) => [s, fs.readFileSync(path.join(w.cwd, "notes", "readings", `${s}-1.md`), "utf8")]));
    // try on 3, then the rest
    const r = await w.ok(["fixes", "run", "blind-reduced", "--agent", "script", "--lang", "en"], { tty: true, answers: ["1", "1"] });
    assert.match(r.out, /1\s+Try it on the most promising first: 3 readings \(3 places\)/);
    const results = [...r.out.matchAll(/^Read again: (\d+) readings? \(\d+ places?\) — places the same (\d+), refined (\d+), different (\d+) · \d+ min/gm)];
    assert.equal(results.length, 2, r.out);
    assert.equal(results[0]![1], "3");
    assert.equal(results[1]![1], "1");
    // the rest estimated again by the real time of the first few, each choice with what it would take
    assert.match(r.out, /^What it would take: cheap · 1 reader call · about 1 min \(by the real time of the readings just done\)\n\nAnd the rest\?\n {3}1 {2}The remaining: 1 reading \(1 place\) — cheap, about 1 min\n/m);
    assert.match(r.out, /Set right: nothing of it waits\./);
    // nothing overwritten: the earlier reports as they were, the new ones beside them
    for (const s of stems) assert.equal(fs.readFileSync(path.join(w.cwd, "notes", "readings", `${s}-1.md`), "utf8"), olds[s]);
    const tasks = (await w.ok(["task", "list", "--json"])).json;
    const fixTasks = tasks.tasks.filter((t: { what: string }) => /^Hold the two readings of M0001 against each other/.test(t.what));
    // the same words read again from the sharper copy: no task; other words, or more read: a task each
    assert.equal(fixTasks.length, 3, JSON.stringify(fixTasks.map((t: { what: string }) => t.what)));
    assert.match(r.out, /^Tasks to hold the readings against each other: T0001, T0002$/m);
    assert.equal((await w.ok(["fixes", "--json"])).json.checks[0].state, "fixed");
    assert.equal(JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).fixes["blind-reduced"].decision, "fixed");
    // each new reading's head: strom, the agent, the model, the image, the crop and the sharper copy it was read from
    const fresh = fs.readdirSync(path.join(w.cwd, "notes", "readings")).filter((f) => !stems.some((s) => f.startsWith(s)));
    assert.equal(fresh.length, 4);
    const head = fs.readFileSync(path.join(w.cwd, "notes", "readings", fresh[0]!), "utf8").split(/^## /m)[0]!;
    assert.match(head, /^Strom: \d+\.\d+\.\d+/m);
    assert.match(head, /^Agent: script$/m);
    assert.match(head, /^Model: /m);
    assert.match(head, /^Blind: yes$/m);
    const img = headImages(head);
    assert.equal(img.length, 1);
    assert.equal(img[0]!.id, "M0001");
    assert.equal(img[0]!.ref, "B0001:1");
    assert.equal(img[0]!.from, "M0003");
    assert.ok(img[0]!.crop);
  } finally {
    w.cleanup();
  }
});

test("strom fixes run: places left open read first; nothing disputed nor of the direct line, no narrower stage offered", opts, async () => {
  const w = await world();
  try {
    // four with places not read, two read whole: all of the last stage (nothing disputed, no direct line)
    const open = [1, 2, 3, 4].map((k) => oldReading(w, k, [0.04 + (k - 1) * 0.075, 0.5, 0.07, 0.15], `Jan Novák [?], Ялта ${k}`, 70 - k * 10));
    const whole = [5, 6].map((k) => oldReading(w, k, [0.04 + (k - 1) * 0.075, 0.5, 0.07, 0.15], `Anna Svobodová ${k}`, 70 - k * 10));
    const shown = await w.ok(["fixes", "show", "blind-reduced", "--lang", "en"]);
    assert.doesNotMatch(shown.out, /The disputed/);
    assert.deepEqual((await w.ok(["fixes", "show", "blind-reduced", "--json"])).json.stages, { disputed: 0, direct: 0, all: 6 });
    w.env.STROM_RUNNER_SCRIPT = path.join(w.dir, "reader.mjs");
    fs.writeFileSync(w.env.STROM_RUNNER_SCRIPT, READER);
    const r = await w.ok(["fixes", "run", "blind-reduced", "--agent", "script", "--lang", "en"], { tty: true, answers: ["1", "0"] });
    assert.match(r.out, /1\s+Try it on the most promising first: 3 readings \(3 places\) — cheap, about \d+ min\n\s+2\s+All: 6 readings \(6 places\) — medium, about \d+ min\n\s+3\s+No:/);
    assert.match(r.out, /^Read again: 3 readings \(3 places\) — /m);
    // three of the four with places not read were read again; the rest waits
    const fresh = fs.readdirSync(path.join(w.cwd, "notes", "readings")).filter((f) => ![...open, ...whole].some((s) => f.startsWith(s)));
    assert.equal(fresh.length, 3);
    assert.match(r.out, /1\s+The remaining: 3 readings \(3 places\) — cheap, about \d+ min/);
    const left = (await w.ok(["fixes", "--json"])).json.checks[0];
    assert.deepEqual(left.items.map((i: { reading: string }) => i.reading).sort(), [open[3], ...whole].sort());
  } finally {
    w.cleanup();
  }
});

test("strom fixes: without a record of the views on this computer, the place is estimated from the source's entry, and said so", opts, async () => {
  const w = await world();
  try {
    // the part fetched before the fix, a source whose entry lies in it, a blind reading of image 1 from another computer
    await w.ok(["source", "add", "Sňatek Jana Nováka 1822", "--kind", "marriage", "--recordset", "B0001", "--clip", "B0001:1@0.05,0.5,0.2,0.1"]);
    const dir = path.join(w.cwd, "notes", "readings");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "2026-10-05-M0001-1.md"), "# Reading M0001 · batch 1 of 1\nQuestion: Přepsat zápis celý\nBlind: yes\n\n## Image 1 · M0001\nresult: found\nentries:\n- Jan Novák [?]\n");
    const c = (await w.ok(["fixes", "--json"])).json.checks[0];
    assert.equal(c.found.count, 1);
    assert.equal(c.found.estimated, 1);
    assert.equal(c.items[0].estimated, true);
    assert.deepEqual(c.items[0].sources, ["S0001"]);
    const show = await w.ok(["fixes", "show", "blind-reduced", "--lang", "cs"]);
    assert.match(show.out, /Nalezeno: 1 čtení \(1 místo\) — odhadem podle toho, kde je zápis pramene na snímku, u každého čtení jedno místo/);
    assert.match(show.out, /^Odhad: tento počítač nemá záznam/m);
    // a reading after the fix with nothing to tell its place by: not judged, never a candidate
    fs.writeFileSync(path.join(dir, "2026-10-21-M0001-1.md"), "# Reading M0001 · batch 1 of 1\nQuestion: Přepsat zápis celý\nBlind: yes\n\n## Image 1 · M0001\nresult: found\nentries:\n- Jan Novák\n");
    assert.equal((await w.ok(["fixes", "--json"])).json.checks[0].found.count, 1);
  } finally {
    w.cleanup();
  }
});

test("strom fixes: an archive says nothing of them", opts, async () => {
  const w = await world();
  try {
    oldReading(w, 1, [0.05, 0.5, 0.2, 0.15], "Jan Novák [?]", 30);
    await w.ok(["mode", "archive"], { tty: true, answers: ["y"] });
    const r = await w.ok(["fixes", "--json"]);
    assert.deepEqual(r.json.checks, []);
    const doctor = await w.run(["doctor", "--json"]);
    assert.equal(doctor.json.checks.find((x: { name: string }) => x.name === "fixes"), undefined);
  } finally {
    w.cleanup();
  }
});

test("estimateFix: cheap, medium, expensive by the earlier readers' cost here, else by the number; the time by their times", () => {
  const w = new World();
  try {
    const root = w.dir;
    assert.equal(estimateFix(root, { agent: "claude", model: undefined, calls: 5, parallel: 3 }).level, "cheap");
    assert.equal(estimateFix(root, { agent: "claude", model: undefined, calls: 6, parallel: 3 }).level, "medium");
    const many = estimateFix(root, { agent: "claude", model: undefined, calls: 21, parallel: 3 });
    assert.equal(many.level, "expensive");
    assert.equal(many.basis, "count");
    assert.equal(many.minutes, 7, "21 readings, 3 at once, 60 s each");
    assert.equal(estimateFix(root, { agent: "grok", model: undefined, calls: 3, parallel: 3 }).minutes, 4);
    for (let i = 0; i < 4; i++) append(path.join(root, ".strom", "metrics", "readers.jsonl"), { reader: `read-x-${i}`, kind: "read", agent: "claude", model: "opus", outcome: "ok", images: 1, usd: 0.3, wallMs: 120_000, at: new Date().toISOString() });
    const e = estimateFix(root, { agent: "claude", model: "opus", calls: 4, parallel: 2 });
    assert.equal(e.basis, "earlier");
    assert.equal(e.earlier, 4);
    assert.equal(e.level, "medium", "4 × 0.30");
    assert.equal(e.minutes, 4, "2 rounds of 2 min");
    assert.equal(estimateFix(root, { agent: "claude", model: "opus", calls: 20, parallel: 2 }).level, "expensive");
    // the trial's own real time for each reading (readers at once and all): the rest estimated again by it, rounded up
    assert.equal(estimateFix(root, { agent: "claude", model: "opus", calls: 4, parallel: 2, perReading: 15 }).minutes, 1);
    assert.equal(estimateFix(root, { agent: "claude", model: "opus", calls: 1, parallel: 2, perReading: 89 }).minutes, 2, "89 s is not about 1 min");
    assert.equal(estimateFix(root, { agent: "codex", model: undefined, calls: 1, parallel: 1 }).minutes, 1, "60 s is 1 min");
  } finally {
    w.cleanup();
  }
});

test("compareReadings: the same words, refined (fewer uncertain places or more read), other words, nothing read", () => {
  const block = (entries: string[], illegible?: string[]): Finding => ({ image: "M0001", result: "found", text: entries.join("\n"), entries, ...(illegible ? { illegible } : {}) });
  assert.equal(compareReadings([block(["Jan Novák, dům 12"])], [block(["Jan Novák, dům 12"])]), "same");
  assert.equal(compareReadings([block(["Jan NOVÁK, dům 12"])], [block(["Jan Novák, dům 12"])]), "same", "case, NFD");
  assert.equal(compareReadings([block(["Jan Novák [?], dům 12"])], [block(["Jan Novák, dům 12"])]), "refined");
  assert.equal(compareReadings([block(["Jan Novák"])], [block(["Jan Novák, Marie Dvořáková, dům 12, 1822"])]), "refined");
  assert.equal(compareReadings([block(["Иван Петров"])], [block(["Иван Петров"])]), "same", "any script");
  assert.equal(compareReadings([block(["Jan Novák, dům 12"])], [block(["Václav Černý, dům 40"])]), "differ");
  assert.equal(compareReadings([block(["Jan Novák"])], []), "failed");
});
