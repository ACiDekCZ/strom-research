// What strom records of the reading of scans and of the load on the archives (.strom/metrics, the views' record) —
// recorded only, nothing decided from it: each request to an archive by session, book and host with the pauses for
// its pace, a part's gain and "no sharper"; each view with its size, kind, book and image; each reader with its model,
// views and outcome; the use of a session as its agent says it. From the fetches and the views the share of images
// fetched and never looked at is counted (M11). An archive records nothing; strom tidy keeps it within limits.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { opts, program, world } from "./connectors.helpers.ts";
import { readJsonFile, World } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { tidy, tidyPlan, trimJournal } from "../../src/core/tidy.ts";

const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");
const DAY = 24 * 3600_000;

function journal(file: string): Record<string, any>[] {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
}
const metrics = (w: World, ...p: string[]) => path.join(w.cwd, ".strom", "metrics", ...p);
const views = (w: World) => journal(path.join(w.cwd, ".strom", "views", "views.jsonl"));

/** The share of images fetched in a research that no view (nor reader) looked at: M11, from the two records. */
function fetchedUnread(w: World): { fetched: string[]; unread: string[] } {
  const fetched = new Set<string>();
  for (const f of journal(metrics(w, "fetch.jsonl"))) if (f.rs) for (const n of f.got ?? []) fetched.add(`${f.rs}:${n}`);
  const seen = new Set(views(w).filter((v) => v.rs !== undefined && v.img !== undefined).map((v) => `${v.rs}:${v.img}`));
  return { fetched: [...fetched], unread: [...fetched].filter((k) => !seen.has(k)) };
}

test("fetch and views recorded: requests by host with the pauses for its pace, the views' size and kind — what was fetched and never looked at counted", opts, async () => {
  const { w, a } = await world();
  await w.ok(["recordset", "add", "Týnec N 1784–1820", "--kinds", "baptism"]); // B0001
  await w.ok(["fetch", "zkusebni", "5359", "--images", "1-2", "--recordset", "B1"]);
  const [f] = journal(metrics(w, "fetch.jsonl"));
  assert.ok(f);
  const { at, ms, hosts, ...rest } = f;
  assert.match(at, /^\d{4}-\d\d-\d\dT/);
  assert.equal(typeof ms, "number");
  assert.deepEqual(rest, { by: "user", connector: "zkusebni", via: "direct", cmd: "fetch", book: "5359", rs: "B0001", asked: [1, 2], requests: 2, got: [1, 2], result: "ok" });
  assert.equal(hosts["127.0.0.1"].requests, 2, "each request to the archive, by host");
  assert.ok(hosts["127.0.0.1"].paceMs > 0, "the pause for the host's pace between the two");
  assert.equal(a.hits.filter((h) => h.startsWith("/img/")).length, 2);

  // a view: its size, the scan's, its kind, book and image, the size it was made for and where that came from
  await w.ok(["media", "view", "B1:1"]);
  const v = views(w).at(-1)!;
  assert.deepEqual(
    { key: v.key, by: v.by, kind: v.kind, rs: v.rs, img: v.img, W: v.W, H: v.H, w: v.w, h: v.h, capFrom: v.capFrom, cached: v.cached, reader: v.reader },
    { key: "M0001", by: "user", kind: "whole", rs: "B0001", img: 1, W: 400, H: 300, w: 400, h: 300, capFrom: "default", cached: false, reader: undefined },
  );
  assert.equal(typeof v.cap, "number");
  await w.ok(["media", "view", "B1:1"]);
  assert.equal(views(w).at(-1)!.cached, true, "the same view again: made before");
  await w.ok(["media", "view", "B1:1", "--half", "left", "--max", "300"]);
  assert.deepEqual([views(w).at(-1)!.kind, views(w).at(-1)!.cap, views(w).at(-1)!.capFrom], ["half", 300, "option"]);
  await w.ok(["media", "view", "B1:1", "--split", "2x1"]);
  assert.deepEqual(views(w).slice(-2).map((x) => x.kind), ["split", "split"]);

  // M11: two images fetched, one looked at
  assert.deepEqual(fetchedUnread(w), { fetched: ["B0001:1", "B0001:2"], unread: ["B0001:2"] });
  w.cleanup();
  await a.close();
});

test("a part's gain recorded, and a part the portal gives no sharper: no request, recorded as such", opts, async () => {
  const { w, a, dir } = await world();
  const manifest = path.join(dir, "connector.json");
  fs.writeFileSync(manifest, JSON.stringify({ ...readJsonFile(manifest), can: [...readJsonFile(manifest).can, "part"] }));
  program(
    dir,
    fs.readFileSync(path.join(dir, "connector.ts"), "utf8").replace(
      "} else if (BASE) {",
      `} else if (req.cmd === "part") {
  const r = req.region;
  const url = BASE + "/part/" + req.book + "/" + req.image + ".jpg?r=" + [r.x, r.y, r.w, r.h].join(",");
  const got = await get(url, { save: "p" + req.image + ".jpg" });
  if (got.status !== 200) fail("part: HTTP " + got.status);
  image(req.image, "p" + req.image + ".jpg", url);
} else if (BASE) {`,
    ),
  );
  await w.ok(["recordset", "add", "Týnec N 1784–1820", "--kinds", "baptism"]); // B0001
  await w.ok(["fetch", "zkusebni", "5359", "--images", "1-2", "--recordset", "B1"]);
  // nearly the whole image as a part, as big as the whole: hardly more detail
  const r = await w.ok(["fetch", "zkusebni", "--recordset", "B1", "--images", "1", "--crop", "0,0,0.9,0.9"]);
  assert.match(r.out, /no sharper than the whole image/);
  const part = journal(metrics(w, "fetch.jsonl")).at(-1)!;
  assert.deepEqual([part.cmd, part.rs, part.img, part.part, part.got, part.requests, part.gain, part.noSharper, part.media, part.result], ["part", "B0001", 1, { x: 0, y: 0, w: 0.9, h: 0.9 }, [1], 1, 1.11, true, ["M0003"], "ok"]);
  // a part of another image as big: the portal gives no more — not asked, said and recorded
  const hits = a.hits.length;
  const skip = await w.ok(["fetch", "zkusebni", "--recordset", "B1", "--images", "2", "--crop", "0,0,0.95,0.95"]);
  assert.match(skip.out, /no sharper/);
  assert.equal(a.hits.length, hits, "no request");
  const none = journal(metrics(w, "fetch.jsonl")).at(-1)!;
  assert.deepEqual([none.cmd, none.img, none.requests, none.result, none.noSharper.gain, none.hosts], ["part", 2, 0, "no-sharper", 1.11, undefined]);
  w.cleanup();
  await a.close();
});

test("an archive records nothing of fetches (nobody reads there); a dry run neither", opts, async () => {
  const { w, a } = await world();
  await w.ok(["recordset", "add", "Týnec N 1784–1820", "--kinds", "baptism"]); // B0001
  await w.ok(["fetch", "zkusebni", "5359", "--images", "1", "--recordset", "B1", "--dry-run"]);
  assert.equal(fs.existsSync(metrics(w)), false, "a dry run asks nothing");
  await w.ok(["mode", "archive"], { tty: true });
  await w.ok(["fetch", "zkusebni", "5359", "--images", "1", "--recordset", "B1"]);
  assert.ok(a.hits.some((h) => h.startsWith("/img/")), "fetched");
  assert.equal(fs.existsSync(metrics(w)), false, "nothing recorded");
  w.cleanup();
  await a.close();
});

/** A reader that reports nothing found, says its use and what it cost, as an agent would. */
function reader(w: World): string {
  const file = path.join(w.dir, "reader.mjs");
  fs.writeFileSync(
    file,
    `const p = process.env.STROM_PROMPT ?? "";
if (p.startsWith("You are the researcher")) {
  console.log('usage: {"agentSession":"sess-1","model":"model-r"}');
  console.log('usage: {"in":12,"out":34,"cr":5600,"cw":700,"ctx":6312}');
  console.log("cost: 1.20");
} else {
  const { appendFileSync } = await import("node:fs");
  const report = /Write your report to (.+?) AS YOU GO/.exec(p)[1];
  for (const m of p.matchAll(/^- (M\\d{4}) · image (\\d+)/gm)) appendFileSync(report, "## Image " + m[2] + " · " + m[1] + "\\nresult: nothing\\n\\n");
  console.log('usage: {"agentSession":"reader-1","in":3,"out":9}');
  console.log("cost: 0.40");
}
`,
  );
  return file;
}

test("readers and sessions recorded: each reader's model, views, pixels, outcome, tokens; the use of a session as its agent says it — none when it says none", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci", "--new-person", "Jan /Novák/", "--sex", "M"]);
  await w.ok(["recordset", "add", "Žďár N 1847–1868", "--kinds", "baptism", "--places", "Žďár", "--years", "1847-1868"]);
  const scans = path.join(w.dir, "scans");
  fs.mkdirSync(scans);
  for (const f of ["s0001.jpg", "s0002.jpg"]) fs.copyFileSync(path.join(fixtures, f), path.join(scans, f));
  await w.ok(["media", "add", scans, "--recordset", "B1"]);
  w.env.STROM_RUNNER_SCRIPT = reader(w);
  await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b", "--about", "P1"]);
  await w.ok(["session", "start", "T1"]);
  const read = await w.ok(["read", "B1", "--images", "1-2", "--question", "Křty Nováků", "--agent", "script", "--json"]);
  const stem = read.json.reading as string;
  const [r] = journal(metrics(w, "readers.jsonl"));
  assert.ok(r);
  assert.deepEqual(
    { session: r.session, by: r.by, reader: r.reader, kind: r.kind, agent: r.agent, images: r.images, views: r.views, outcome: r.outcome, nothing: r.nothing, found: r.found, missing: r.missing, usd: r.usd, capFrom: r.capFrom, report: r.report },
    { session: "N0001", by: "N0001", reader: `read-${stem}-1`, kind: "read", agent: "script", images: 2, views: 2, outcome: "ok", nothing: 2, found: 0, missing: 0, usd: 0.4, capFrom: "default", report: path.join("notes", "readings", `${stem}-1.md`) },
  );
  assert.ok(r.px > 0, "the pixels its views hold");
  assert.equal(typeof r.key, "string");
  // the views made for it: a reader's
  assert.ok(views(w).slice(-2).every((v) => v.reader === 1 && v.rs === "B0001" && v.by === "N0001"));
  // its use as it said it
  const used = journal(metrics(w, "usage", `read-${stem}-1.jsonl`)).map(({ at: _a, ...x }) => x);
  assert.deepEqual(used.slice(1), [{ agentSession: "reader-1" }, { in: 3, out: 9 }]);
  assert.deepEqual([used[0]!.start, used[0]!.agent, used[0]!.reader], [true, "script", "read"]);
  await w.ok(["session", "close", "--continue", "--summary", "nic", "--next", "dál"]);

  // a session of strom run: its agent's use, per request, with its own id of the session
  await w.ok(["run", "--agent", "script"]);
  const session = journal(metrics(w, "usage", "N0002.jsonl")).map(({ at: _a, ...x }) => x);
  assert.deepEqual([session[0]!.start, session[0]!.agent, session[0]!.session, session[0]!.task], [true, "script", "N0002", "T0001"]);
  assert.deepEqual(session.slice(1), [{ agentSession: "sess-1", model: "model-r" }, { in: 12, out: 34, cr: 5600, cw: 700, ctx: 6312 }]);
  // an agent that says nothing of its use: no file
  fs.writeFileSync(w.env.STROM_RUNNER_SCRIPT!, 'console.log("cost: 0.10");\n');
  await w.ok(["run", "--agent", "script"]);
  assert.equal(fs.existsSync(metrics(w, "usage", "N0003.jsonl")), false);
  // nothing of it in the research's history
  assert.equal(fs.readFileSync(path.join(w.cwd, ".gitignore"), "utf8").includes(".strom"), true);
  w.cleanup();
});

test("strom tidy keeps the measurements within limits: older than 90 days and beyond 20 MB go, a journal keeps its newest lines", opts, async () => {
  const w = new World();
  await w.withTree();
  const line = (daysAgo: number, n: number) => JSON.stringify({ at: new Date(Date.now() - daysAgo * DAY).toISOString(), connector: "zkusebni", n }) + "\n";
  const put = (file: string, text: string, daysAgo: number) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
    const t = new Date(Date.now() - daysAgo * DAY);
    fs.utimesSync(file, t, t);
  };
  put(metrics(w, "fetch.jsonl"), line(120, 1) + line(100, 2) + line(10, 3) + line(1, 4), 1);
  put(metrics(w, "readers.jsonl"), line(5, 1), 5);
  put(metrics(w, "usage", "N0001.jsonl"), line(100, 1), 100);
  put(metrics(w, "usage", "N0002.jsonl"), line(2, 1), 2);
  put(metrics(w, "rollup.json"), "{}", 200); // a summary: never tidied
  const tree = Tree.open(w.cwd, w.env);
  const plan = tidyPlan(tree).items.filter((i) => i.kind === "metrics");
  assert.deepEqual(
    plan.map((i) => [i.path.split(path.sep).join("/"), i.do]),
    [
      [".strom/metrics/fetch.jsonl", "shrink"],
      [".strom/metrics/usage/N0001.jsonl", "remove"],
    ],
  );
  assert.ok(plan[0]!.bytes > 0);
  tidy(tree, tidyPlan(tree), "person");
  assert.deepEqual(journal(metrics(w, "fetch.jsonl")).map((x) => x.n), [3, 4]);
  assert.equal(fs.existsSync(metrics(w, "usage", "N0001.jsonl")), false);
  assert.ok(fs.existsSync(metrics(w, "usage", "N0002.jsonl")));
  assert.ok(fs.existsSync(metrics(w, "readers.jsonl")));
  assert.ok(fs.existsSync(metrics(w, "rollup.json")));
  // beyond its size: its newest part kept, whole lines
  const big = Array.from({ length: 100 }, (_, i) => line(1, i)).join("");
  const kept = trimJournal(big, Date.now() - 90 * DAY, 500);
  assert.ok(kept.length <= 500 && kept.length > 0);
  assert.ok(kept.split("\n").filter(Boolean).every((l) => JSON.parse(l).n >= 90));
  assert.ok(big.endsWith(kept));
  w.cleanup();
});
