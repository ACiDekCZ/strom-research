// The bridge says what the last 24 hours added (/status recent, GET /recent?hours=N): the Strom app's "last 24 h"
// counted it from /log, which gives the last 500 commits — an agent at work makes a thousand a day.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { resetCache } from "../../src/core/git.ts";
import { recentChanges } from "../../src/core/recent.ts";

const HOUR = 3_600_000;
/** Commits that change nothing of the records (an agent's notes, its sessions) between those that do. */
const NOISE = 600;

function gitIn(cwd: string) {
  return (args: string[], input?: string): string => {
    const r = spawnSync("git", args, { cwd, input, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
    if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
    return r.stdout;
  };
}

/**
 * The history made again with its own times: the first `old` commits (the tree and a person) 30 hours ago, the rest
 * spread over the last 20 hours with NOISE commits that change nothing between them — the same trees, the last one the
 * tree as it is.
 */
function spreadHistory(cwd: string, old: number): void {
  const git = gitIn(cwd);
  const real = git(["rev-list", "--reverse", "HEAD"]).trim().split("\n");
  const now = Math.floor(Date.now() / 1000);
  const fresh = real.length - old;
  const slots = fresh + NOISE;
  const step = Math.floor((20 * 3600) / slots);
  let stream = "";
  let mark = 0;
  let slot = 0;
  const commit = (when: number, message: string, files?: string) => {
    mark++;
    const msg = Buffer.from(message, "utf8");
    stream += `commit refs/heads/strom-recent-test\nmark :${mark}\ncommitter Strom <strom@example.org> ${when} +0000\ndata ${msg.length}\n${message}\n`;
    if (mark > 1) stream += `from :${mark - 1}\n`;
    if (files !== undefined) stream += `deleteall\n${files}`;
    stream += "\n";
  };
  const filesOf = (c: string) =>
    git(["ls-tree", "-r", "-z", c])
      .split("\0")
      .filter(Boolean)
      .map((entry) => {
        const [meta = "", file = ""] = entry.split("\t");
        const [mode, , sha] = meta.split(" ");
        return `M ${mode} ${sha} ${file}\n`;
      })
      .join("");
  real.forEach((c, i) => {
    const message = git(["log", "-1", "--format=%B", c]);
    if (i < old) return commit(now - 30 * 3600 + i, message, filesOf(c));
    // before each commit of the records its share of the others
    const before = Math.floor(NOISE / fresh) + (i - old < NOISE % fresh ? 1 : 0);
    for (let n = 0; n < before; n++) commit(now - 20 * 3600 + step * slot++, "Session notes\n");
    commit(now - 20 * 3600 + step * slot++, message, filesOf(c));
  });
  git(["fast-import", "--quiet"], stream);
  const tip = git(["rev-parse", "refs/heads/strom-recent-test"]).trim();
  git(["reset", "-q", "--hard", tip]);
  git(["update-ref", "-d", "refs/heads/strom-recent-test"]);
  resetCache();
}

test("the bridge says what the last 24 hours added, however many commits they made", { skip: !hasGit }, async (t) => {
  const w = new World();
  try {
    await w.withTree("Dvořákovi");
    await w.ok(["person", "add", "Žofie /Dvořáková/", "--sex", "F"]); // P0001: before the window
    const git = gitIn(w.cwd);
    const old = Number(git(["rev-list", "--count", "HEAD"]).trim());
    const names = ["Čeněk /Dvořák/", "Řehoř /Dvořák/", "Ludmila /Šťastná/", "Jiří /Šťastný/", "Božena /Kůrková/", "Václav /Kůrka/", "Anežka /Bílá/", "Ondřej /Bílý/", "Zdeňka /Žáková/", "Tomáš /Žák/", "Marie /Nováčková/", "Jan /Nováček/", "Kateřina /Hruškova/", "Łucja /Wróbel/", "Ольга /Петрова/", "Jindřich /Dvořák/", "Eliška /Dvořáková/"];
    for (const name of names) await w.ok(["person", "add", name]); // P0002–P0018
    // added and merged into another within the window, added and taken back: not added
    await w.ok(["person", "add", "Řehoř /Dvořák/"]); // P0019
    await w.ok(["person", "merge", "P0003", "P0019", "--reason", "týž Řehoř, zapsaný dvakrát"]);
    await w.ok(["person", "add", "Omyl /Zápisu/"]); // P0020
    await w.ok(["person", "retract", "P0020", "--reason", "zapsán omylem"]);
    await w.ok(["source", "add", "Křestní zápis Čeňka", "--kind", "baptism"]); // S0001
    spreadHistory(w.cwd, old);
    const head = git(["rev-parse", "HEAD"]).trim();
    const all = Number(git(["rev-list", "--count", "HEAD"]).trim());
    assert.ok(all - old > 500, `${all - old} commits in the window`);

    const info = (await w.ok(["live", "start", "--json"])).json as { url: string };
    try {
      type Recent = { hours: number; since: string; from: string | null; head: string; at: string; commits: number; persons: { added: number; ids: string[] }; sources: { added: number; ids: string[] } };
      type Status = { features: string[]; head: string; recent?: Recent };
      const status = async () => (await (await fetch(`${info.url}/status`)).json()) as Status;
      let s = await status();
      assert.ok(s.features.includes("status.recent"), JSON.stringify(s.features));
      // worked out in the background: /status says it once it is ready, never waits for it
      for (let i = 0; i < 100 && s.recent?.head !== head; i++) {
        await new Promise((r) => setTimeout(r, 100));
        s = await status();
      }
      const recent = s.recent!;
      assert.equal(recent?.head, head, JSON.stringify(s.recent));
      assert.equal(recent.hours, 24);
      assert.ok(Math.abs(Date.parse(recent.since) - (Date.now() - 24 * HOUR)) < 5 * 60_000, recent.since);
      // the window starts after the last commit before it: the person added then
      assert.equal(recent.from, git(["rev-parse", `HEAD~${all - old}`]).trim());
      assert.equal(recent.commits, all - old);
      const ids = Array.from({ length: 17 }, (_, i) => `P${String(i + 2).padStart(4, "0")}`);
      assert.deepEqual(recent.persons, { added: 17, ids });
      assert.deepEqual(recent.sources, { added: 1, ids: ["S0001"] });

      // other windows: 48 hours hold the whole research (no commit before them)
      const two = (await (await fetch(`${info.url}/recent?hours=48`)).json()) as Recent;
      assert.equal(two.from, null);
      assert.equal(two.commits, all);
      assert.deepEqual(two.persons, { added: 18, ids: ["P0001", ...ids] });
      const hour = (await (await fetch(`${info.url}/recent?hours=1`)).json()) as Recent;
      assert.ok(hour.from && hour.commits < (all - old) / 10 && hour.persons.added <= 1, JSON.stringify(hour));
      for (const bad of ["0", "169", "x", "-3"]) assert.equal((await fetch(`${info.url}/recent?hours=${bad}`)).status, 400, bad);

      // /log as before: the newest 500 commits, newest first
      const { entries } = (await (await fetch(`${info.url}/log`)).json()) as { entries: { head: string }[] };
      assert.deepEqual(
        entries.map((e) => e.head),
        git(["rev-list", "-n500", "HEAD"]).trim().split("\n"),
      );

      // cheap whatever the number of commits
      let t0 = performance.now();
      await status();
      const statusMs = performance.now() - t0;
      t0 = performance.now();
      await recentChanges(w.cwd, w.env);
      const recentMs = performance.now() - t0;
      t.diagnostic(`${all} commits: /status ${statusMs.toFixed(0)} ms, the summary worked out in ${recentMs.toFixed(0)} ms`);
      assert.ok(recentMs < 5000, `${recentMs} ms`);
    } finally {
      await w.run(["live", "stop"]);
    }
  } finally {
    w.cleanup();
  }
});
