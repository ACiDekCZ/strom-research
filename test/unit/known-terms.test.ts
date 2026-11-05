// strom's curated list of archives' terms (assets/archives.json): a level there is a confirmed one — a connector's
// "allowed" needs no person's word, a connector taken over no confirmation — and the strictest of all that is known
// still holds; its pace a floor, its paths kept off; a test's own list (STROM_ARCHIVES_FILE) gives "allowed" only to
// this computer itself, by the address strom connects to. No request leaves this computer.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { hostPace, politeGet, robotsVerdict, NetError } from "../../src/core/net.ts";
import { knownDisallow, knownPaceMs, readPack, shippedTerms, strictestEntry, within, type KnownTerms } from "../../src/core/knownterms.ts";
import { assetPath } from "../../src/core/assets.ts";
import { allows, archiveLevel, pendingQuestions, takeOverConnectors, termsFor, termsHooks, termsOpen, type ConnectorLike } from "../../src/core/terms.ts";

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
  assert.equal(level("www.szukajwarchiwach.gov.pl"), "restricted");
  assert.equal(level("photos.szukajwarchiwach.gov.pl"), "restricted");
  for (const h of ["aron.vychodoceskearchivy.cz", "imgx.vychodoceskearchivy.cz", "portal.nacr.cz", "data.matricula-online.eu", "kramerius.mzk.cz", "kramerius5.nkp.cz", "ndk.cz", "geneteka.genealodzy.pl", "metryki.genealodzy.pl", "skanoteka.genealodzy.pl", "polona.pl", "www.sbc.org.pl", "dir.icm.edu.pl"])
    assert.equal(level(h), "allowed", h);
  for (const h of ["katalog.ahmp.cz", "www.mza.cz", "mza.cz", "images.soalitomerice.cz", "images.archives.cz", "digi.nacr.cz", "www.szukajwarchiwach.gov.pl", "swietogen.genbaza.pl", "www.basia.famula.pl", "www.metrikai.lt"]) {
    assert.equal(level(h), "restricted", h);
    assert.equal(termsFor({}, h)?.browserOnly, true, h);
  }
  // the digital reading rooms of ZA Opava and SOA Litoměřice show their images from an image server closed to every
  // robot: by hand only, a person's browser only — no permission "through the browser" could help
  for (const h of ["digi.soalitomerice.cz", "digi.archives.cz", "digi2.archives.cz"]) {
    assert.equal(level(h), "manual", h);
    assert.equal(termsFor({}, h)?.browserOnly, true, h);
  }
  // Landesarchiv Berlin: its Impressum asks its consent for any use — restricted, not for a person's browser only
  for (const h of ["landesarchiv-berlin.de", "content.landesarchiv-berlin.de", "www.landesarchiv-berlin.de"]) {
    assert.equal(level(h), "restricted", h);
    assert.equal(termsFor({}, h)?.browserOnly, undefined, h);
  }
  // Matricula: allowed, not for a person's browser only (its robots.txt group for AI crawlers is no agent's own web tool)
  assert.equal(level("data.matricula-online.eu"), "allowed");
  assert.equal(termsFor({}, "data.matricula-online.eu")?.browserOnly, undefined);
  // the DDB's interface for programs: restricted until a person reads its terms of use; MyHeritage and the DFG-Viewer
  // keep AI agents off by name: by hand only
  assert.equal(level("api.deutsche-digitale-bibliothek.de"), "restricted");
  // eBadatelna (SOA Praha): its robots.txt names AI agents (ClaudeBot, GPTBot) — by hand only, the agent's browser neither
  for (const h of ["myheritage.com", "www.myheritage.com", "dfg-viewer.de", "ebadatelna.soapraha.cz"]) {
    assert.equal(level(h), "manual", h);
    assert.equal(termsFor({}, h)?.browserOnly, true, h);
  }
  assert.equal(level("www.archion.de"), "forbidden");
  assert.equal(level("digi.ceskearchivy.cz"), "manual");
  assert.equal(termsFor({}, "digi.ceskearchivy.cz")?.browserOnly, true);
  assert.equal(level("www.familysearch.org"), "forbidden");
  assert.equal(level("www.portafontium.eu"), "restricted");
  assert.equal(level("mapy.geoportal.gov.pl"), "restricted");
  for (const h of ["genealogiawarchiwach.pl", "fbc.pionier.net.pl", "tsdial.archives.gov.ua"]) {
    assert.equal(level(h), "unknown", h);
    assert.equal(termsFor({}, h)?.browserOnly, true, h);
  }
  assert.equal(level("digital.martin-opitz-bibliothek.de"), "unknown");
  assert.equal(level("www.example.org"), undefined);
  for (const k of shippedTerms()) {
    assert.match(k.checked ?? "", /^2026-\d\d-\d\d$/, k.host);
    if (k.level !== "unknown" && !k.browserOnly) assert.ok(k.quote && k.terms, `${k.host}: quoted, with its address`);
  }
  // the site's Crawl-delay: a floor, slower only; the paths its robots.txt keeps off
  assert.equal(knownPaceMs("geneteka.genealodzy.pl"), 120_000);
  assert.equal(knownPaceMs("geneszukacz.genealodzy.pl"), 120_000, "Geneteka's own pace");
  assert.equal(knownPaceMs("metryki.genealodzy.pl"), 60_000);
  assert.equal(knownPaceMs("skanoteka.genealodzy.pl"), 60_000);
  assert.equal(knownPaceMs("pomerania.genbaza.pl"), 10_000);
  assert.equal(knownPaceMs("www.portafontium.eu"), 10_000);
  // MZA (Acta Publica): its images only as a browser saves them — at least 4 s apart in the agent's browser
  assert.equal(knownPaceMs("www.mza.cz"), 4000);
  assert.ok(knownDisallow("www.mza.cz").includes("/scitacioperaty/"), "its census records stay off");
  // the image servers of SOA Litoměřice and ZA Opava, the National Archives' police registrations: robots.txt "Disallow: /"
  for (const h of ["images.soalitomerice.cz", "images.archives.cz", "digi.nacr.cz"]) {
    assert.deepEqual(knownDisallow(h), ["/"], h);
    assert.equal(termsFor({}, h)?.quoteFrom, "robots", h);
  }
  assert.equal(hostPace({ recent: [] }, { minIntervalMs: 2000, source: "its terms" }, undefined, "geneteka.genealodzy.pl").minIntervalMs, 120_000);
  assert.equal(hostPace({ recent: [] }, { minIntervalMs: 300_000, source: "slower still" }, undefined, "geneteka.genealodzy.pl").minIntervalMs, 300_000);
  assert.equal(hostPace({ recent: [] }, { minIntervalMs: 2000, source: "x" }, undefined, "archive.example.org").minIntervalMs, 2000);
  assert.ok(knownDisallow("data.matricula-online.eu").includes("/*/suchen"));
  assert.deepEqual(knownDisallow("ebadatelna.soapraha.cz"), ["/d/", "/a/"]);
});

test("ČÚZK and RÚIAN: the open RÚIAN map service allowed, the archive's old maps never automated; the WMS/WFS open by its terms (its robots.txt yields)", () => {
  const known = (h: string) => termsFor({}, h);
  for (const h of ["ags.cuzk.gov.cz", "services.cuzk.gov.cz", "vdp.cuzk.gov.cz"]) {
    assert.equal(known(h)?.level, "allowed", h);
    assert.match((shippedTerms().find((k) => k.host === h) as { license?: string } | undefined)?.license ?? "", /creativecommons\.org\/licenses\/by\/4\.0/u, h);
    assert.equal(known(h)?.checked, "2026-11-03", h);
  }
  const off = (h: string, p: string) => !robotsVerdict({ at: 0, status: 200, groups: [{ agents: ["*"], allow: [], disallow: knownDisallow(h) }] }, p).allowed;
  assert.equal(off("ags.cuzk.gov.cz", "/arcgis/rest/services/RUIAN/MapServer/1/query?where=1%3D1&f=json"), false);
  assert.equal(off("ags.cuzk.gov.cz", "/archiv/"), true);
  assert.equal(off("ags.cuzk.gov.cz", "/arcgis4/rest/services/Archiv/CO/ImageServer/exportImage"), true);
  // the terms of the services expressly allow automated use: the list keeps no path of them off, robots.txt alone yields
  assert.equal(off("services.cuzk.gov.cz", "/wfs/inspire-ad-wfs.asp?service=WFS"), false);
  assert.equal(termsOpen({}, "services.cuzk.gov.cz"), true);
});

test("a level of the list is confirmed: a new connector's allowed there needs no word; anything stricter still holds", () => {
  const env = settings();
  const level = (c: ConnectorLike, url = c.manifest.hosts[0]!) => archiveLevel(env, { connector: c, url, readOnly: true });
  const hk = level(connector("hk", ["aron.vychodoceskearchivy.cz"], "allowed"));
  assert.equal(hk.level, "allowed");
  assert.ok(hk.from.includes("terms"));
  assert.deepEqual(allows(hk, "images"), { ok: true, human: false }, "no question");
  // a connector that found no terms says nothing where the list knows them
  assert.equal(level(connector("hk2", ["aron.vychodoceskearchivy.cz"], "unknown")).level, "allowed");
  // stricter than the list: the stricter holds — the connector's own reading, a bot check
  assert.equal(level(connector("hk3", ["aron.vychodoceskearchivy.cz"], "manual")).level, "manual");
  assert.equal(level(connector("hk4", ["aron.vychodoceskearchivy.cz"], "allowed", { browser: { pages: true } })).level, "restricted");
  // the list stricter than the connector: the list holds
  assert.equal(level(connector("mza", ["www.mza.cz"], "allowed")).level, "restricted");
  assert.equal(level(connector("fs", ["www.familysearch.org"], "allowed")).level, "forbidden");
  const ahmp = level(connector("ahmp", ["katalog.ahmp.cz"], "unknown"));
  assert.equal(ahmp.level, "restricted");
  assert.equal(ahmp.browserOnly?.by, "robots", "the list quotes its robots.txt: said as robots, not as terms");
  assert.equal(allows(ahmp, "images").ok, false);
  // MZA (Acta Publica): only a person's browser — a permission "slowly" from before stays the person's word but takes no
  // image straight through strom any more; its images through the agent's browser only with "through the browser"
  const mza = level(connector("mza2", ["www.mza.cz"], "restricted"));
  assert.equal(mza.browserOnly?.by, "terms");
  assert.deepEqual(allows({ ...mza, permission: "slow" }, "images"), { ok: false, why: "browser", needs: "browser" });
  assert.deepEqual(allows({ ...mza, permission: "slow" }, "catalogue"), { ok: false, why: "browser", needs: "browser" });
  assert.deepEqual(allows({ ...mza, permission: "slow" }, "images", "browser"), { ok: false, why: "permission", needs: "browser" });
  assert.deepEqual(allows({ ...mza, permission: "browser" }, "images", "browser"), { ok: true, human: true });
  // eBadatelna: by hand only where only a person's browser goes — nothing automated, the agent's browser neither, and
  // never a permission asked that could not help (whatever the person said before)
  const soap = level(connector("soap", ["ebadatelna.soapraha.cz"], "unknown"));
  assert.equal(soap.level, "manual");
  for (const permission of [undefined, "slow", "browser"] as const)
    for (const [activity, route] of [["catalogue", "direct"], ["images", "direct"], ["images", "browser"], ["pages", "browser"]] as const)
      assert.deepEqual(allows({ ...soap, ...(permission ? { permission } : {}) }, activity, route), { ok: false, why: "manual" }, `${permission} ${activity} ${route}`);
  // the person's "by hand" on an archive only a person's browser goes to: the catalogue neither
  assert.deepEqual(allows({ level: "restricted", permission: "manual", browserOnly: { by: "robots" } }, "catalogue"), { ok: false, why: "manual" });
  // a host the list does not know: a new connector's allowed waits for the person, as before
  const other = level(connector("jiny", ["archive.example.org"], "allowed"));
  assert.equal(other.level, "unknown");
  assert.deepEqual(other.from, ["new connector"]);
  // what the level covers, for the agent
  assert.match(level(connector("nacr", ["portal.nacr.cz"], "allowed")).scope ?? "", /catalogue only/);
});

test("the connectors taken over: only those whose hosts the list does not know are to be confirmed — all known, no question", () => {
  const env = settings();
  takeOverConnectors(env, [connector("hk", ["aron.vychodoceskearchivy.cz"], "allowed"), connector("mza", ["www.mza.cz"], "allowed"), connector("jiny", ["archive.example.org"], "allowed")], false);
  assert.deepEqual(pendingQuestions(env).find((q) => q.kind === "takeover")?.connectors, ["jiny"]);
  const all = settings();
  takeOverConnectors(all, [connector("hk", ["aron.vychodoceskearchivy.cz"], "allowed"), connector("vca", ["aron.vychodoceskearchivy.cz", "imgx.vychodoceskearchivy.cz"], "allowed")], false);
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

test("at the same level the stricter entry holds, whatever the order of the list: a person's browser, restricted, a slower pace, the host's own", () => {
  const site: KnownTerms = { host: "lhota.example.org", name: "Archiv Lhota", level: "restricted", scope: "the site" };
  const book: KnownTerms = { host: "matriky.lhota.example.org", name: "Archiv Lhota (matriky)", level: "restricted", browserOnly: true, quoteFrom: "robots", scope: "a person's browser only" };
  const pick = (all: KnownTerms[], host: string) => strictestEntry(all.filter((k) => within(host, k.host)));
  // the site's entry above the host, listed first, cannot lift what the host's own says
  assert.equal(pick([site, book], "matriky.lhota.example.org")?.browserOnly, true);
  assert.equal(pick([book, site], "matriky.lhota.example.org")?.browserOnly, true);
  assert.equal(pick([site, book], "www.lhota.example.org"), site, "another host of the site: the site's entry");
  // restricted before unknown at the same rank (it is known)
  const unknown: KnownTerms = { host: "lhota.example.org", level: "unknown" };
  assert.equal(pick([unknown, { ...site, host: "katalog.lhota.example.org" }], "katalog.lhota.example.org")?.level, "restricted");
  assert.equal(pick([{ ...site, host: "katalog.lhota.example.org" }, unknown], "katalog.lhota.example.org")?.level, "restricted");
  // a slower pace, then the more specific host
  const slow: KnownTerms = { host: "lhota.example.org", level: "allowed", pace: { minIntervalMs: 60_000 } };
  const own: KnownTerms = { host: "index.lhota.example.org", level: "allowed", scope: "the index" };
  assert.equal(pick([own, slow], "index.lhota.example.org"), slow);
  assert.equal(pick([{ ...slow, pace: undefined }, own], "index.lhota.example.org"), own);
  assert.equal(pick([own, { ...slow, pace: undefined }], "index.lhota.example.org"), own);
  // a stricter level still wins over all of it
  const manual: KnownTerms = { host: "lhota.example.org", level: "manual" };
  assert.equal(pick([book, manual], "matriky.lhota.example.org"), manual);
  // strom's own list: no host there is lifted by an entry of its site
  for (const k of shippedTerms()) {
    const hits = shippedTerms().filter((x) => within(k.host, x.host));
    const got = strictestEntry(hits)!;
    assert.ok(!hits.some((x) => x.browserOnly && x.level === got.level) || got.browserOnly, `${k.host}: a person's browser only`);
  }
});

test("the list: an archive whose viewer shows its images from a server the list closes whole is by hand only", () => {
  const list = readPack(assetPath("archives.json"));
  const closedWhole = (h: string) => knownDisallow(h).includes("/");
  let seen = 0;
  for (const a of list) {
    for (const from of a.imagesFrom ?? []) {
      assert.ok(list.some((x) => within(from, x.host)), `${a.host}: ${from} is not in the list`);
      if (!closedWhole(from)) continue;
      seen++;
      assert.ok(a.level === "manual" || a.level === "forbidden", `${a.host}: its images come from ${from}, closed to every robot — ${a.level}, not by hand`);
      assert.ok(a.browserOnly, `${a.host}: a person's browser only`);
      assert.match(a.scope ?? "", /by hand only/u, `${a.host}: its scope says so for the agent`);
    }
  }
  assert.ok(seen >= 3, "the reading rooms of ZA Opava and SOA Litoměřice");
});
