// The tree for the Strom app (GET /tree.ged) carries an ETag told by the research's head and the file's variant (feature
// ged.etag): the app that has the tree already asks with If-None-Match and gets 304 with no body — nothing made, not even
// after the bridge started again with nothing kept (1109: a research of 79 MB sent whole at each opening of the app, the
// research unchanged). Another head or another variant (the app's version): 200 and another ETag. With ?stale=1 the
// older one's ETag. The app's page reads the ETag and the X-Strom-* headers only when CORS shows them, and sends
// If-None-Match only when its preflight lets it through.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import { World, hasGit } from "../helpers.ts";
import { BRIDGE_FEATURES, gedTag, tagMatches } from "../../src/core/live.ts";
import { gedStoreDir } from "../../src/core/liveged.ts";

const opts = { skip: !hasGit || process.platform === "win32", timeout: 180_000 };
const APP = "https://beta.stromapp.info";

function ask(url: string, headers: Record<string, string> = {}, method = "GET"): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { agent: false, method, headers: { Origin: APP, ...headers } }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (d) => (body += d));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
    });
    req.on("error", reject);
    req.end();
  });
}

const headOf = (ged: string) => /^1 _STROM_HEAD (\S+)/m.exec(ged)?.[1];
const keptFiles = (w: World) => (fs.existsSync(gedStoreDir(w.cwd)) ? fs.readdirSync(gedStoreDir(w.cwd)).filter((f) => f.endsWith(".ged")) : []);

async function until(what: string, ok: () => boolean, ms = 30_000): Promise<void> {
  const by = Date.now() + ms;
  while (!ok()) {
    if (Date.now() > by) assert.fail(`waited ${ms} ms in vain: ${what}`);
    await new Promise((r) => setTimeout(r, 50));
  }
}

test("If-None-Match: a list, weak or strong, or *", () => {
  const tag = gedTag("a".repeat(40), JSON.stringify({ app: "3.26.0" }));
  assert.match(tag, /^"[0-9a-f]{32}"$/u);
  assert.notEqual(gedTag("a".repeat(40), JSON.stringify({ app: "3.25.0" })), tag, "another variant: another tag");
  assert.notEqual(gedTag("b".repeat(40), JSON.stringify({ app: "3.26.0" })), tag, "another head: another tag");
  const m = (v?: string) => tagMatches({ headers: v === undefined ? {} : { "if-none-match": v } }, tag);
  assert.equal(m(tag), true);
  assert.equal(m(`W/${tag}`), true);
  assert.equal(m(`"x", ${tag}`), true);
  assert.equal(m("*"), true);
  assert.equal(m('"x"'), false);
  assert.equal(m(undefined), false);
});

test("the tree's ETag: 304 with no body while head and variant stay — nothing made, also by a bridge started again with nothing kept; 200 after a commit and for another app's version; ?stale=1 the older one's; CORS shows it and lets If-None-Match through", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  Object.assign(w.env, { STROM_LIVE_POLL_MS: "200", STROM_LIVE_QUIET_MS: "300", STROM_APP_URL: `${APP}/run/` });
  await w.ok(["person", "add", "Jan /Lhoták/".normalize("NFD"), "--sex", "M", "--born", "1950"]);
  let info = (await w.ok(["live", "start", "--json"])).json as { url: string };
  try {
    const st = JSON.parse((await ask(`${info.url}/status`)).body);
    assert.ok(st.features.includes("ged.etag"));
    assert.ok(BRIDGE_FEATURES.indexOf("ged.etag") > BRIDGE_FEATURES.indexOf("ged.stale"), "appended");

    // the preflight of the app's page asking with If-None-Match: let through
    const pre = await ask(`${info.url}/tree.ged`, { "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "if-none-match, x-strom-app-version" }, "OPTIONS");
    assert.equal(pre.status, 204);
    assert.match(String(pre.headers["access-control-allow-headers"]), /if-none-match/iu);

    const first = await ask(`${info.url}/tree.ged`);
    assert.equal(first.status, 200);
    const tag = String(first.headers.etag);
    assert.match(tag, /^"[0-9a-f]{32}"$/u);
    for (const h of ["ETag", "X-Strom-Head", "X-Strom-Stale", "X-Strom-Head-Now"]) assert.ok(String(first.headers["access-control-expose-headers"]).split(/,\s*/u).includes(h), h);
    assert.equal(first.headers["access-control-allow-origin"], APP);

    // the same again with its ETag: 304, no body, the same ETag and head
    const same = await ask(`${info.url}/tree.ged`, { "If-None-Match": tag });
    assert.deepEqual([same.status, same.body, same.headers.etag, same.headers["x-strom-head"]], [304, "", tag, headOf(first.body)]);
    assert.match(String(same.headers["access-control-expose-headers"]), /ETag/u);
    // a tag of nothing it made: the tree
    assert.equal((await ask(`${info.url}/tree.ged`, { "If-None-Match": '"0000"' })).status, 200);

    // a bridge started again, nothing kept on disk: 304 at once, nothing made
    await until("kept on disk", () => keptFiles(w).length > 0);
    await w.ok(["live", "stop"]);
    fs.rmSync(gedStoreDir(w.cwd), { recursive: true, force: true });
    info = (await w.ok(["live", "start", "--json"])).json as { url: string };
    const cold = await ask(`${info.url}/tree.ged`, { "If-None-Match": tag });
    assert.deepEqual([cold.status, cold.body, cold.headers.etag], [304, "", tag]);
    await new Promise((r) => setTimeout(r, 500));
    assert.deepEqual(keptFiles(w), [], "nothing made for it");

    // another app's version: another variant, another tree and ETag
    const other = await ask(`${info.url}/tree.ged?app=3.0.0`, { "If-None-Match": tag });
    assert.equal(other.status, 200);
    assert.notEqual(other.headers.etag, tag);
    assert.equal((await ask(`${info.url}/tree.ged?app=3.0.0`, { "If-None-Match": String(other.headers.etag) })).status, 304);

    // a commit: the tree again with another ETag
    await w.ok(["person", "add", "Marie /Kroutilová/", "--sex", "F"]);
    const after = await ask(`${info.url}/tree.ged`, { "If-None-Match": tag });
    assert.equal(after.status, 200);
    assert.match(after.body, /Kroutilová/u);
    const tag2 = String(after.headers.etag);
    assert.notEqual(tag2, tag);
    assert.equal((await ask(`${info.url}/tree.ged`, { "If-None-Match": tag2 })).status, 304);

    // ?stale=1 after another commit: the older one at once with its own ETag; the app holding it gets 304, still told it
    // is older; the app holding the newest gets 304 at once
    await w.ok(["person", "add", "Karel /Lhoták/", "--sex", "M"]);
    const older = await ask(`${info.url}/tree.ged?stale=1`);
    assert.deepEqual([older.status, older.headers["x-strom-stale"], older.headers.etag], [200, "1", tag2]);
    const olderKept = await ask(`${info.url}/tree.ged?stale=1`, { "If-None-Match": tag2 });
    assert.deepEqual([olderKept.status, olderKept.body, olderKept.headers["x-strom-stale"], olderKept.headers.etag], [304, "", "1", tag2]);
    assert.notEqual(olderKept.headers["x-strom-head-now"], olderKept.headers["x-strom-head"]);
    const newest = await ask(`${info.url}/tree.ged`);
    assert.match(newest.body, /Karel/u);
    const now = await ask(`${info.url}/tree.ged?stale=1`, { "If-None-Match": String(newest.headers.etag) });
    assert.deepEqual([now.status, now.headers["x-strom-stale"]], [304, undefined]);
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});
