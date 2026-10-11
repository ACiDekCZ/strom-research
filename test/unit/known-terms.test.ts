// strom's curated list of archives' terms (assets/archives.json): a level there is a confirmed one — a connector's
// "allowed" needs no person's word, a connector taken over no confirmation — and the strictest of all that is known
// still holds; its pace a floor, its paths kept off; a test's own list (STROM_ARCHIVES_FILE) gives "allowed" only to
// this computer itself, by the address strom connects to. No request leaves this computer.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { hostPace, politeGet, NetError } from "../../src/core/net.ts";
import { knownDisallow, knownPaceMs, shippedTerms } from "../../src/core/knownterms.ts";
import { allows, archiveLevel, pendingQuestions, takeOverConnectors, termsFor, termsHooks, type ConnectorLike } from "../../src/core/terms.ts";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "strom known terms "));
const dirs: string[] = [];
after(() => {
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
  termsHooks.lookup = undefined;
});
const settings = () => {
  const d = tmp();
  dirs.push(d);
  return { STROM_CONFIG_DIR: d };
};
const connector = (name: string, hosts: string[], automation: string, more: Record<string, unknown> = {}): ConnectorLike => ({ name, manifest: { title: name, hosts, policy: { automation: automation as "allowed" }, ...more } });

test("the list: each archive with its level, terms and the sentence quoted, the day checked", () => {
  const level = (h: string) => termsFor({}, h)?.level;
  assert.equal(level("www.mza.cz"), "restricted");
  assert.equal(level("www.szukajwarchiwach.gov.pl"), "restricted");
  for (const h of ["ebadatelna.soapraha.cz", "aron.vychodoceskearchivy.cz", "imgx.vychodoceskearchivy.cz", "content.landesarchiv-berlin.de", "www.landesarchiv-berlin.de", "portal.nacr.cz", "data.matricula-online.eu", "kramerius.mzk.cz", "kramerius5.nkp.cz", "ndk.cz", "geneteka.genealodzy.pl", "metryki.genealodzy.pl"])
    assert.equal(level(h), "allowed", h);
  for (const h of ["digi.soalitomerice.cz", "digi.archives.cz", "digi2.archives.cz", "katalog.ahmp.cz"]) {
    assert.equal(level(h), "restricted", h);
    assert.equal(termsFor({}, h)?.browserOnly, true, h);
  }
  assert.equal(level("digi.ceskearchivy.cz"), "manual");
  assert.equal(level("www.familysearch.org"), "forbidden");
  assert.equal(level("www.portafontium.eu"), "unknown");
  assert.equal(level("digital.martin-opitz-bibliothek.de"), "unknown");
  assert.equal(level("www.example.org"), undefined);
  for (const k of shippedTerms()) {
    assert.match(k.checked ?? "", /^2026-\d\d-\d\d$/, k.host);
    if (k.level !== "unknown" && !k.browserOnly) assert.ok(k.quote && k.terms, `${k.host}: quoted, with its address`);
  }
  // the site's Crawl-delay: a floor, slower only; the paths its robots.txt keeps off
  assert.equal(knownPaceMs("geneteka.genealodzy.pl"), 120_000);
  assert.equal(knownPaceMs("metryki.genealodzy.pl"), 60_000);
  assert.equal(hostPace({ recent: [] }, { minIntervalMs: 2000, source: "its terms" }, undefined, "geneteka.genealodzy.pl").minIntervalMs, 120_000);
  assert.equal(hostPace({ recent: [] }, { minIntervalMs: 300_000, source: "slower still" }, undefined, "geneteka.genealodzy.pl").minIntervalMs, 300_000);
  assert.equal(hostPace({ recent: [] }, { minIntervalMs: 2000, source: "x" }, undefined, "archive.example.org").minIntervalMs, 2000);
  assert.ok(knownDisallow("data.matricula-online.eu").includes("/*/suchen"));
});

test("a level of the list is confirmed: a new connector's allowed there needs no word; anything stricter still holds", () => {
  const env = settings();
  const level = (c: ConnectorLike, url = c.manifest.hosts[0]!) => archiveLevel(env, { connector: c, url, readOnly: true });
  const praha = level(connector("praha", ["ebadatelna.soapraha.cz"], "allowed"));
  assert.equal(praha.level, "allowed");
  assert.ok(praha.from.includes("terms"));
  assert.deepEqual(allows(praha, "images"), { ok: true, human: false }, "no question");
  // a connector that found no terms says nothing where the list knows them
  assert.equal(level(connector("praha2", ["ebadatelna.soapraha.cz"], "unknown")).level, "allowed");
  // stricter than the list: the stricter holds — the connector's own reading, a bot check
  assert.equal(level(connector("praha3", ["ebadatelna.soapraha.cz"], "manual")).level, "manual");
  assert.equal(level(connector("praha4", ["ebadatelna.soapraha.cz"], "allowed", { browser: { pages: true } })).level, "restricted");
  // the list stricter than the connector: the list holds
  assert.equal(level(connector("mza", ["www.mza.cz"], "allowed")).level, "restricted");
  assert.equal(level(connector("fs", ["www.familysearch.org"], "allowed")).level, "forbidden");
  const ahmp = level(connector("ahmp", ["katalog.ahmp.cz"], "unknown"));
  assert.equal(ahmp.level, "restricted");
  assert.equal(ahmp.browserOnly?.by, "robots", "the list quotes its robots.txt: said as robots, not as terms");
  assert.equal(allows(ahmp, "images").ok, false);
  // a host the list does not know: a new connector's allowed waits for the person, as before
  const other = level(connector("jiny", ["archive.example.org"], "allowed"));
  assert.equal(other.level, "unknown");
  assert.deepEqual(other.from, ["new connector"]);
  // what the level covers, for the agent
  assert.match(level(connector("nacr", ["portal.nacr.cz"], "allowed")).scope ?? "", /catalogue only/);
});

test("the connectors taken over: only those whose hosts the list does not know are to be confirmed — all known, no question", () => {
  const env = settings();
  takeOverConnectors(env, [connector("praha", ["ebadatelna.soapraha.cz"], "allowed"), connector("mza", ["www.mza.cz"], "allowed"), connector("jiny", ["archive.example.org"], "allowed")], false);
  assert.deepEqual(pendingQuestions(env).find((q) => q.kind === "takeover")?.connectors, ["jiny"]);
  const all = settings();
  takeOverConnectors(all, [connector("praha", ["ebadatelna.soapraha.cz"], "allowed"), connector("vca", ["aron.vychodoceskearchivy.cz", "imgx.vychodoceskearchivy.cz"], "allowed")], false);
  assert.deepEqual(pendingQuestions(all), []);
  // …and they run as before: their reading kept as it was taken over
  assert.equal(archiveLevel(all, { connector: connector("vca", ["aron.vychodoceskearchivy.cz", "imgx.vychodoceskearchivy.cz"], "allowed"), url: "imgx.vychodoceskearchivy.cz", readOnly: true }).level, "allowed");
});

test("a test's own list: allowed only for this computer itself, by the address strom connects to, with settings of its own; stricter for any host", () => {
  const env = settings();
  const file = path.join(env.STROM_CONFIG_DIR, "test-archives.json");
  fs.writeFileSync(
    file,
    JSON.stringify({
      archives: [
        { host: "127.0.0.1", level: "allowed" },
        { host: "archive.example.org", level: "allowed" },
        { host: "loopback.test", level: "allowed" },
        { host: "elsewhere.test", level: "allowed" },
        { host: "both.test", level: "allowed" },
        { host: "strict.example.org", level: "manual" },
      ],
    }),
  );
  termsHooks.lookup = (h) => (h === "loopback.test" ? ["127.0.0.1", "::1"] : h === "elsewhere.test" ? ["93.184.215.14"] : h === "both.test" ? ["127.0.0.1", "93.184.215.14"] : []);
  const own = { ...env, STROM_ARCHIVES_FILE: file };
  assert.equal(termsFor(own, "127.0.0.1")?.level, "allowed");
  assert.equal(termsFor(own, "loopback.test")?.level, "allowed", "a name that resolves to this computer");
  assert.equal(termsFor(own, "archive.example.org"), undefined, "a public host given as allowed: left out");
  assert.equal(termsFor(own, "elsewhere.test"), undefined, "a name resolving to a public address: left out");
  assert.equal(termsFor(own, "both.test"), undefined, "one public address among them: left out");
  assert.equal(termsFor(own, "strict.example.org")?.level, "manual", "stricter: any host");
  assert.equal(termsFor({ STROM_ARCHIVES_FILE: file }, "127.0.0.1"), undefined, "never without settings of its own");
  // strom's own list cannot be taken away by it
  fs.writeFileSync(file, JSON.stringify({ archives: [{ host: "mza.cz", level: "allowed" }] }));
  assert.equal(termsFor(own, "www.mza.cz")?.level, "restricted");
  termsHooks.lookup = undefined;
});

test("the paths the list keeps off are not asked, whatever robots.txt strom read says", async () => {
  const dir = tmp();
  dirs.push(dir);
  // the site's robots.txt as read a moment ago, letting everything in: nothing goes out to read it again
  fs.writeFileSync(path.join(dir, "data.matricula-online.eu.json"), JSON.stringify({ recent: [], robots: { at: Date.now(), status: 200, groups: [{ agents: ["*"], allow: [], disallow: [] }] } }));
  await assert.rejects(
    politeGet("https://data.matricula-online.eu/de/suchen/?q=Novak", { stateDir: dir, hosts: ["data.matricula-online.eu"], robots: true }),
    (e: unknown) => e instanceof NetError && e.failure === "robots" && /\/\*\/suchen/.test(e.message),
  );
});
