// A downloader made before strom knew its archive as one only a person's browser goes to (strom's list: the Moravian
// Land Archives' Acta Publica): a connector of the direct route alone, no browser.* in its connector.json, its catalogue
// and images straight from the archive's servers. strom refuses it before any request — the catalogue, the images, a
// test and a probe alike, the person's permission "slowly" from before kept as given and never used — and says the
// ways that remain: the person's permission "through the browser" (an agent's browser strom keeps, one image at a
// time) or the person's hand. No request leaves this computer: every way out of the process refuses and is counted.

import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import http from "node:http";
import http2 from "node:http2";
import { World, fakeConnector, hasGit, pluginDir, readJsonFile } from "../helpers.ts";
import { testHooks } from "../../src/core/net.ts";
import { archivesFile, grantWay } from "../../src/core/terms.ts";

const opts = { skip: !hasGit };

const out: string[] = [];
const keep = { request: https.request, get: https.get, hrequest: http.request, hget: http.get, connect: http2.connect, fetch: globalThis.fetch };
const refuse = (u: unknown) => {
  out.push(String(u instanceof URL ? u.href : typeof u === "object" && u ? ((u as { host?: string; hostname?: string }).hostname ?? (u as { host?: string }).host) : u));
  throw new Error("no network in this test");
};
let ahead = 0;
before(() => {
  (https as { request: unknown }).request = refuse;
  (https as { get: unknown }).get = refuse;
  (http as { request: unknown }).request = refuse;
  (http as { get: unknown }).get = refuse;
  (http2 as { connect: unknown }).connect = refuse;
  globalThis.fetch = (u) => Promise.reject(refuse(u));
  testHooks.now = () => Date.now() + ahead;
  testHooks.sleep = async (ms) => {
    ahead += ms;
  };
});
after(() => {
  Object.assign(https, { request: keep.request, get: keep.get });
  Object.assign(http, { request: keep.hrequest, get: keep.hget });
  (http2 as { connect: unknown }).connect = keep.connect;
  globalThis.fetch = keep.fetch;
  testHooks.now = undefined;
  testHooks.sleep = undefined;
});

const PERSON: Record<string, string> = {};
const CLAUDE: Record<string, string> = { CLAUDECODE: "1" };
const CODEX: Record<string, string> = { CODEX_THREAD_ID: "t1" };

/** Every way the connector reaches the archive: its catalogue, its images, a test of each, a probe of a page. */
const WAYS = [
  ["fetch", "mza-old", "--find", "Lhota"],
  ["fetch", "mza-old", "5359", "--list"],
  ["fetch", "mza-old", "5359", "--images", "1-2", "--recordset", "B1"],
  ["connector", "test", "mza-old", "--find", "Lhota"],
  ["connector", "test", "mza-old", "--fetch", "5359", "--images", "1"],
  ["connector", "probe", "mza-old", "https://www.mza.cz/actapublica/matrika/detail/5359"],
  ["connector", "probe", "mza-old", "https://iiif.mza.cz/iipsrv?IIIF=/5359/1.jp2/full/full/0/default.jpg"],
];

test('a direct downloader of an archive only a person\'s browser goes to (Acta Publica): refused before any request — catalogue, images, test, probe; "slowly" from before kept as given, never used; the browser the person\'s, else by hand', opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  try {
    await w.ok(["recordset", "add", "Lhota N 1784–1820", "--kinds", "baptism", "--places", "Lhota", "--years", "1784-1820", "--url", "https://www.mza.cz/actapublica/matrika/detail/5359"]); // B1
    // installed before: the direct route alone, its catalogue on the archive's site, its images from its image server
    const dir = await fakeConnector(w, "mza-old", "https://www.mza.cz/actapublica", { automation: "restricted" });
    const file = path.join(dir, "connector.json");
    const m = readJsonFile(file);
    fs.writeFileSync(file, JSON.stringify({ ...m, hosts: ["www.mza.cz", "iiif.mza.cz"] }, null, 2));
    assert.equal(m.browser, undefined);
    assert.equal(m.routes, undefined, "the direct route alone");
    assert.equal(pluginDir(w, "mza-old"), dir);
    const said = () => (readJsonFile(archivesFile(w.env)) as { archives?: Record<string, { way?: string }> }).archives ?? {};

    const refused = async (env: Record<string, string>, permission?: string) => {
      for (const args of WAYS) {
        const r = await w.run([...args, "--json"], { env });
        const what = `${JSON.stringify(env)} ${args.join(" ")}`;
        assert.equal(r.code, 2, `${what}\n${r.out}${r.err}`);
        assert.equal(r.json?.code, "archive.browser", what);
        assert.match(r.json.message, /Moravský zemský archiv \(Acta Publica\) lets automated tools in only through a person's browser \(strom's known terms of the archive\) — no direct request through mza-old, a probe or your web tools/, what);
        const d = r.json.details;
        assert.equal(d.connector, "mza-old", what);
        assert.equal(d.by, "terms", what);
        assert.match(d.host, /mza\.cz$/, what);
        assert.match(d.manual, /^strom task wait T… --images B…:[^ ]+ --on "/, what);
        assert.match(r.json.hint, /the user saves what the research needs by hand: strom task wait T… --images B…:/, what);
        assert.equal(d.permission, permission, what);
        if (permission === "slow") assert.match(r.json.message, /the person's permission "slowly" from before is kept as given, and takes no direct request there/, what);
        // the person's "through the browser": for the person and an agent whose browser strom keeps — never another's
        if (env === CODEX) {
          assert.deepEqual(d.ways, ["manual"], what);
          assert.equal(d.browser, undefined, what);
          assert.match(r.json.hint, /strom does not keep your browser or computer use/, what);
        } else {
          assert.deepEqual(d.ways, ["browser", "manual"], what);
          if (permission === "browser") assert.equal(d.browser, undefined, what);
          else assert.equal(d.browser, `strom allow archive ${d.host} --way browser`, what);
        }
        if (env === PERSON && permission !== "browser") assert.match(r.json.hint, /only with the person's permission "through the browser" \(strom allow archive [a-z.]*mza\.cz --way browser — the person's\)/, what);
        if (env === CLAUDE) assert.match(r.json.hint, /Claude in Chrome extension is in no browser here/, what);
      }
      // the same in words, for an agent reading the text
      const text = await w.run(["fetch", "mza-old", "5359", "--images", "1-2", "--recordset", "B1"], { env });
      assert.equal(text.code, 2);
      assert.match(text.err, /only through a person's browser/);
      assert.match(text.err, /strom task wait T… --images B…:1-2/);
    };

    // nothing said by the person yet
    for (const env of [PERSON, CLAUDE, CODEX]) await refused(env);
    assert.ok(Object.values(said()).every((r) => !r.way), "no permission given");
    const pending = (await w.ok(["allow", "archive", "--json"])).json.pending as { kind?: string; host?: string }[];
    assert.deepEqual(pending.filter((p) => p.kind === "permission"), [], "no question of a permission that would not help: nothing asked");

    // the person's "slowly" from an earlier strom: kept as given, never used
    assert.ok(grantWay(w.env, ["www.mza.cz", "iiif.mza.cz"], "slow", { by: "terminal" }));
    const before = JSON.stringify(said());
    for (const env of [PERSON, CLAUDE, CODEX]) await refused(env, "slow");
    assert.equal(JSON.stringify(said()), before, "the person's word kept as said");
    assert.equal(said()["www.mza.cz"]?.way, "slow");
    assert.equal((await w.run(["allow", "archive", "www.mza.cz", "--way", "slow"], { tty: true })).code, 2, "never slowly again");

    // the person's "through the browser": the agent's browser, never the downloader — said so, not "connector use"
    const granted = await w.ok(["allow", "archive", "mza.cz", "--way", "browser"], { tty: true });
    assert.doesNotMatch(granted.out, /strom connector use mza-old --via browser/);
    assert.match(granted.out, /mza-old goes only directly: never there — the agent's browser saves its images one at a time \(strom media save\)/);
    for (const env of [PERSON, CLAUDE, CODEX]) await refused(env, "browser");

    // the research as it was: its book, no image, nothing fetched into the inbox
    assert.equal((await w.ok(["recordset", "show", "B1", "--json"])).json.recordset.url, "https://www.mza.cz/actapublica/matrika/detail/5359");
    assert.deepEqual((await w.ok(["media", "list", "--json"])).json.media ?? [], []);
    assert.equal(fs.existsSync(path.join(dir, ".test", "probe")), false, "no probe saved");
    assert.deepEqual(out, [], "nothing left this computer");
  } finally {
    w.cleanup();
  }
});
