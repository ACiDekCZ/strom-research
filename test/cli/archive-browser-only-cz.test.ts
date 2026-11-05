// Five Czech archives strom's list keeps for a person's browser (assets/archives.json, 4 November 2026): the Moravian
// Land Archives' Acta Publica (its images only as a browser saves them), SOA Praha's eBadatelna (its robots.txt names
// AI agents: by hand only), and the image servers of SOA Litoměřice and ZA Opava and the National Archives' police
// registrations (robots.txt "Disallow: /"). A research that worked there before reads the new level at once: a
// person's permission "slowly" from before is kept as said, and no longer takes an image straight through strom — the
// task is told the browser or the person's hand. No request leaves this computer.

import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, fakeConnector, hasGit, pluginDir, readJsonFile } from "../helpers.ts";
import { testHooks } from "../../src/core/net.ts";
import { archivesFile, grantWay } from "../../src/core/terms.ts";

const opts = { skip: !hasGit };
let ahead = 0;
testHooks.now = () => Date.now() + ahead;
testHooks.sleep = async (ms) => {
  ahead += ms;
};
after(() => {
  testHooks.sleep = undefined;
  testHooks.now = undefined;
});

type Check = { allow: boolean; route?: string; human?: boolean; why?: string; level?: string; permission?: string; reason: string };
const check = async (w: World, url: string, browser = true, env: Record<string, string> = {}) =>
  JSON.parse((await w.run(["net", "web", "--check", url, ...(browser ? ["--browser"] : []), "--json"], { env })).out) as Check;

test("MZA (Acta Publica): a permission \"slowly\" from before stays the person's, takes no image through strom fetch any more; its images through the browser with \"through the browser\", at least 4 s apart", opts, async () => {
  const w = new World();
  const tree = await w.withTree("Lhotákovi");
  try {
    await w.ok(["research", "new", "X", "--new-person", "Jan /Lhoták/"]);
    await w.ok(["recordset", "add", "Lhota N 1784–1820", "--kinds", "baptism", "--places", "Lhota", "--years", "1784-1820", "--access", "online-free", "--url", "https://www.mza.cz/actapublica/matrika/detail/1"]); // B1
    await w.ok(["task", "add", "Křest Jan", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]); // T1
    // a downloader of the archive, its images straight through strom — and the person's "slowly" given before
    await fakeConnector(w, "mza", "", { automation: "restricted" });
    const file = path.join(pluginDir(w, "mza"), "connector.json");
    fs.writeFileSync(file, JSON.stringify({ ...readJsonFile(file), hosts: ["www.mza.cz"] }));
    assert.ok(grantWay(w.env, ["www.mza.cz"], "slow", { by: "terminal" }));
    const word = () => {
      const r = (readJsonFile(archivesFile(w.env)) as { archives: Record<string, { way?: string; at?: string; by?: string }> }).archives["www.mza.cz"]!;
      return { way: r.way, at: r.at, by: r.by };
    };
    const said = word();

    // strom fetch: no image straight through strom, whatever was said before — the browser or the person's hand
    const r = await w.run(["fetch", "mza", "5359", "--images", "1-2", "--recordset", "B1", "--json"], {});
    assert.notEqual(r.code, 0);
    assert.match(r.err + r.out, /only through a person's browser/);
    assert.match(r.err + r.out, /strom task wait T… --images B…:1-2/);
    assert.deepEqual(word(), said, "the person's word kept as said");
    assert.equal(said.way, "slow");

    // the brief: the archive as it holds now
    assert.match((await w.ok(["brief", "T1"])).out, /archive [a-z.]*mza\.cz: restricted — only through a person's browser/);
    assert.match((await w.ok(["recordset", "show", "B1"])).out, /only through a person's browser/);

    // the web fetch: never; the agent's browser: only with "through the browser" — the person's
    assert.equal((await check(w, "https://www.mza.cz/actapublica/matrika/detail/1", false)).allow, false);
    const before = await check(w, "https://www.mza.cz/actapublica/matrika/detail/1");
    assert.equal(before.allow, false);
    assert.match(before.reason, /--way browser — the person's, never yours/);
    assert.match(before.reason, /strom task wait/);
    grantWay(w.env, ["www.mza.cz"], "browser", { by: "terminal" });
    const now = await check(w, "https://www.mza.cz/actapublica/matrika/detail/1", true, { STROM_TEST_HUMAN_PACE_MS: "1000" });
    assert.deepEqual([now.allow, now.route, now.human], [true, "browser", true]);
    assert.match(now.reason, /at least 4 s apart/, "its pace a floor of a person's");
    // its census records: by its help only — not through the browser either
    assert.equal((await check(w, "https://www.mza.cz/scitacioperaty/digisada/detail/1")).allow, false);
    // nothing of the research rewritten
    assert.equal((await w.ok(["recordset", "show", "B1", "--json"])).json.recordset.access, "online-free");
    assert.ok(fs.existsSync(tree));
  } finally {
    w.cleanup();
  }
});

test("eBadatelna (SOA Praha): by hand only — the web fetch and the browser neither, never a permission that could not help, whatever the person said", opts, async () => {
  const w = new World();
  await w.withTree();
  try {
    for (const browser of [false, true]) {
      const r = await check(w, "https://ebadatelna.soapraha.cz/d/1234/5", browser);
      assert.equal(r.allow, false, `browser ${browser}`);
      assert.equal(r.level, "manual");
      assert.doesNotMatch(r.reason, /--way browser/);
      assert.match(r.reason, /saves what is needed by hand: strom task wait/);
    }
    grantWay(w.env, ["ebadatelna.soapraha.cz"], "browser", { by: "terminal" });
    const r = await check(w, "https://ebadatelna.soapraha.cz/pages/SearchPage", true);
    assert.equal(r.allow, false, "a permission said before does not open it");
    assert.doesNotMatch(r.reason, /--way browser/);
  } finally {
    w.cleanup();
  }
});

test("the image servers of SOA Litoměřice and ZA Opava, the National Archives' police registrations: robots.txt \"Disallow: /\" — the agent's browser neither, before any permission", opts, async () => {
  const w = new World();
  await w.withTree();
  try {
    for (const host of ["images.soalitomerice.cz", "images.archives.cz", "digi.nacr.cz"]) {
      const url = `https://${host}/img/1/2.jpg`;
      const web = await check(w, url, false);
      assert.equal(web.allow, false, host);
      assert.doesNotMatch(web.reason, /--way browser/, host);
      const before = await check(w, url);
      assert.equal(before.allow, false, host);
      assert.doesNotMatch(before.reason, /--way browser/, host);
      grantWay(w.env, [host], "browser", { by: "terminal" });
      const after = await check(w, url);
      assert.equal(after.allow, false, host);
      assert.equal(after.why, "robots", host);
    }
  } finally {
    w.cleanup();
  }
});
