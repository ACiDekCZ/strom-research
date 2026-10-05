// Several browsers on one bridge (the app's PLAN_vic-prohlizecu.md): every send that waits is written in its turn, a
// research busy is tried again (never a send left waiting for ever, an original answered 503 to send again), and an
// archive takes away only what the window that sends had — a window with data older than its head takes nothing.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import crypto from "node:crypto";
import { hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import type { Person } from "../../src/core/model.ts";
import { world, post, get, marked } from "./sync.helpers.ts";

const opts = { skip: !hasGit || process.platform === "win32" };
const app = { Origin: "https://beta.stromapp.info" };

/** The sends as the app follows them, once each has come to rest (none pending), or after a while (written one after another: a loaded machine takes its time). */
async function settled(url: string, n: number, ms = 60_000): Promise<{ intake: string; state: string; tree?: string; tries?: number }[]> {
  let sends: { intake: string; state: string; tree?: string; tries?: number }[] = [];
  for (const until = Date.now() + ms; Date.now() < until; ) {
    sends = JSON.parse((await get(`${url}/status?poll=1`)).body).sends;
    if (sends.length >= n && sends.every((s) => s.state !== "pending")) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  return sends;
}

test("three browsers send at once: every send that waits is written in its turn — none left pending", opts, async () => {
  const { w, ged } = await world();
  // each send waits only a moment for its answer: the others come while one is written
  w.env.STROM_SYNC_ANSWER_MS = "50";
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const t = fs.readFileSync(ged, "utf8");
    const a = marked(t.replace(/(1 REFN P0003\r?\n2 TYPE strom-research\r?\n)/, "$11 BIRT\n2 DATE 1890\n"), "treeA", "s1");
    const b = marked(t.replace(/(1 REFN P0003\r?\n2 TYPE strom-research\r?\n)/, "$11 DEAT\n2 DATE 1960\n"), "treeB", "s1");
    const c = marked(t.replace(/(1 REFN P0003\r?\n2 TYPE strom-research\r?\n)/, "$11 OCCU mlynář\n"), "treeC", "s1");
    const answers = await Promise.all([a, b, c].map((x) => post(`${info.url}/sync`, x, app)));
    assert.ok(answers.every((r) => r.status === 200 || r.status === 202), answers.map((r) => r.body).join(" | "));
    const sends = await settled(info.url, 3);
    assert.deepEqual(sends.map((s) => s.state).sort(), ["written", "written", "written"], JSON.stringify(sends));
    const karel = (await w.ok(["person", "show", "P3", "--json"])).json.person;
    assert.deepEqual(karel.events.map((e: { kind: string }) => e.kind).sort(), ["BIRT", "DEAT", "OCCU"], "all three browsers' edits are in");
  } finally {
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});

test("the research busy (another strom holding it): a send is tried again until it is written, an original is answered 503 to send again later", opts, async () => {
  const { w, ged } = await world();
  Object.assign(w.env, { STROM_SYNC_ANSWER_MS: "3000", STROM_LOCK_WAIT_MS: "200", STROM_SYNC_RETRY_MS: "300" });
  const info = (await w.ok(["live", "start", "--json"])).json;
  const lock = path.join(w.cwd, ".strom", "tree.lock");
  try {
    // somebody at work: the tree held
    fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, host: os.hostname(), at: new Date().toISOString(), owner: "a test" }));
    const text = marked(fs.readFileSync(ged, "utf8").replace(/(1 REFN P0003\r?\n2 TYPE strom-research\r?\n)/, "$11 BIRT\n2 DATE 1890\n"), "treeA", "s1");
    const r = await post(`${info.url}/sync`, text, app);
    assert.equal(r.status, 202, r.body);
    assert.deepEqual({ ok: JSON.parse(r.body).ok, pending: JSON.parse(r.body).pending }, { ok: true, pending: true }, "an app of 3.8 reads ok: sent");
    // tried again while busy: said in sends, still pending
    let busy: { state: string; tries?: number } | undefined;
    for (let i = 0; i < 60 && !busy?.tries; i++) {
      await new Promise((res) => setTimeout(res, 100));
      busy = JSON.parse((await get(`${info.url}/status?poll=1`)).body).sends[0];
    }
    assert.equal(busy?.state, "pending");
    assert.ok((busy?.tries ?? 0) >= 1);
    // an original meanwhile: send it again later
    const png = fs.readFileSync(path.join(import.meta.dirname, "..", "fixtures", "images", "png-bw.png"));
    const sha = crypto.createHash("sha256").update(png).digest("hex");
    const put = await new Promise<{ status: number; retry?: string }>((resolve, reject) => {
      const req = http.request(`${info.url}/media/${sha}`, { method: "PUT", headers: { ...app, "X-Strom-Person": "P0001", "Content-Length": String(png.length) } }, (res) => {
        res.resume();
        res.on("end", () => resolve({ status: res.statusCode ?? 0, retry: res.headers["retry-after"] as string | undefined }));
      });
      req.on("error", reject);
      req.end(png);
    });
    assert.deepEqual(put, { status: 503, retry: "30" });
    // what the app reads meanwhile is answered as always: never 503 (the lock is only a writer's)
    assert.equal((await get(`${info.url}/status?poll=1&app=3.9.0`)).status, 200);
    assert.equal((await get(`${info.url}/media/${sha}?app=3.9.0`)).status, 404);
    // the research free again: written by itself, nobody sends it again
    fs.rmSync(lock);
    const sends = await settled(info.url, 1);
    assert.equal(sends[0]!.state, "written");
  } finally {
    fs.rmSync(lock, { force: true });
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});

test("an archive takes away only what the window that sends had: one with data older than the research it was given (another browser added someone) takes nothing away; what it had and removed goes", opts, async () => {
  const { w, ged } = await world();
  await w.ok(["mode", "archive"], { tty: true });
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const head = () => fs.readFileSync(ged, "utf8").match(/^1 _STROM_HEAD (.+)$/m)![1]!;
    const fresh = async () => {
      await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", ged]);
      return fs.readFileSync(ged, "utf8");
    };
    // window A sends the tree as it was given (it has Josef, Anna, Karel)
    const first = await fresh();
    assert.equal((await post(`${info.url}/sync`, marked(first.replace(/(1 REFN P0003\r?\n2 TYPE strom-research\r?\n)/, "$11 OCCU mlynář\n"), "treeA", "a1"), app)).status, 200);
    // browser B adds Petr
    const forB = await fresh();
    const withPetr = forB.replace(/(0 @[^@]+@ FAM\r?\n)/, "0 @X1@ INDI\n1 NAME Petr /Novák/\n1 SEX M\n1 BIRT\n2 DATE 1912\n$1");
    assert.equal((await post(`${info.url}/sync`, marked(withPetr, "treeB", "b1"), app)).status, 200);
    const petr = () => Tree.open(w.cwd, w.env).list<Person>("person").find((p) => p.names[0]?.given === "Petr");
    assert.ok(petr() && !petr()!.retracted);
    // window A: its old data, but the newest head (a window of the same browser loaded it meanwhile) — no Petr in it
    const newest = await fresh();
    const stale = first.replace(/^1 _STROM_HEAD .*$/m, `1 _STROM_HEAD ${newest.match(/^1 _STROM_HEAD (.+)$/m)![1]}`).replace(/(1 REFN P0003\r?\n2 TYPE strom-research\r?\n)/, "$11 OCCU mlynář\n1 NOTE z okna A\n");
    const r = JSON.parse((await post(`${info.url}/sync`, marked(stale, "treeA", "a2"), app)).body);
    assert.equal(r.kept, 1, JSON.stringify(r));
    assert.ok(!petr()!.retracted, "Petr stays: window A never had him");
    // the same on its sends[] item: an app that heard only 202 learns it there
    const a2 = (JSON.parse((await get(`${info.url}/status?poll=1`)).body).sends as { intake: string; kept?: number }[]).find((s) => s.intake === r.intake);
    assert.equal(a2?.kept, 1, JSON.stringify(a2));
    // B had him; it takes him out: he goes (with the reason)
    const fromB = await fresh();
    const noPetr = fromB.replace(new RegExp(`0 @${petr()!.id}@ INDI\\r?\\n(?:[1-9].*\\r?\\n)*`), "");
    const gone = JSON.parse((await post(`${info.url}/sync`, marked(noPetr, "treeB", "b2"), app)).body);
    assert.equal(gone.kept, undefined, JSON.stringify(gone));
    const b2 = (JSON.parse((await get(`${info.url}/status?poll=1`)).body).sends as { intake: string; kept?: number }[]).find((s) => s.intake === gone.intake);
    assert.equal(b2?.kept, undefined, JSON.stringify(b2));
    assert.match(petr()!.retracted?.reason ?? "", /odebráno v aplikaci Strom/);
    assert.ok(head());
    assert.match((await w.ok(["check"])).out, /^ok/);
  } finally {
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});
