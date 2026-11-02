// robots.txt and an archive's terms: where the terms in strom's list (a quote word for word) expressly allow automated
// use, a Disallow of the site's robots.txt alone yields — carefully, at its Crawl-delay at least; a robots.txt that
// names AI agents or strom, the paths the list keeps off and archives without such terms stay as they were. No request
// leaves this computer (a server on 127.0.0.1, a test's own list of terms).

import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { hostPace, parseAiRobots, parseRobots, parseToolRobots, politeGet, readHostState, robotsNamesAi, robotsYields, NetError, type RobotsState } from "../../src/core/net.ts";
import { knownDisallow, openByTerms } from "../../src/core/knownterms.ts";
import { archiveLevel, termsFor, termsHooks, termsOpen } from "../../src/core/terms.ts";
import { webGate } from "../../src/core/webgate.ts";

const dirs: string[] = [];
const tmp = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "strom robots terms "));
  dirs.push(d);
  return d;
};
after(() => {
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
  termsHooks.lookup = undefined;
});

const read = (text: string): RobotsState => {
  const tools = parseToolRobots(text);
  return { at: Date.now(), status: 200, groups: parseRobots(text), ...(tools.length ? { tools } : {}), ai: parseAiRobots(text) };
};

test("robots.txt that names AI agents or strom in a group with a Disallow: an explicit ban — no terms make it yield", () => {
  const plain = read("User-agent: *\nDisallow: /data\nCrawl-delay: 3\n");
  assert.deepEqual(plain.ai, []);
  assert.equal(robotsNamesAi(plain), undefined);
  assert.equal(robotsYields(plain, true), true, "terms that expressly allow it: robots.txt alone yields");
  assert.equal(robotsYields(plain, false), false, "no such terms: robots.txt holds");
  assert.equal(robotsYields(undefined, true), false, "nothing read: nothing to yield");
  // named, any case, a version after the token
  for (const text of ["User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nDisallow: /data\n", "User-agent: CCBot/2.0\nUser-agent: Google-Extended\nDisallow: /\n", "User-agent: anthropic-ai\nDisallow: /data\n"]) {
    const r = read(text);
    assert.ok(robotsNamesAi(r), text);
    assert.equal(robotsYields(r, true), false, text);
  }
  assert.deepEqual(read("User-agent: CCBot/2.0\nUser-agent: Google-Extended\nDisallow: /\n").ai, ["ccbot", "google-extended"]);
  // strom itself, an agent's own web tool by name
  assert.equal(robotsNamesAi(read("User-agent: Strom-Research\nDisallow: /data\n")), "strom-research");
  assert.equal(robotsNamesAi(read("User-agent: Claude-User\nDisallow: /\n")), "claude-user");
  // a group that names them but keeps nothing off is no ban; another (no AI) crawler's group says nothing
  assert.equal(robotsNamesAi(read("User-agent: GPTBot\nDisallow:\n\nUser-agent: *\nDisallow: /data\n")), undefined);
  assert.equal(robotsNamesAi(read("User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow: /data\n")), undefined);
  // read by an older strom (what it names of AI not kept): not known — it holds
  assert.ok(robotsNamesAi({ at: Date.now(), status: 200, groups: parseRobots("User-agent: *\nDisallow: /data\n") }));
});

test("the terms that count: an allowed entry of the list with automatedUse, quoted from its terms — anything less, robots.txt holds", () => {
  const base = { host: "open.example.org", level: "allowed" as const, terms: "https://open.example.org/terms", quote: "Data may be used without restriction, by programs too.", automatedUse: true };
  assert.equal(openByTerms(base), true);
  assert.equal(openByTerms({ ...base, automatedUse: undefined }), false, "no mark: as before");
  assert.equal(openByTerms({ ...base, level: "restricted" }), false);
  assert.equal(openByTerms({ ...base, quote: undefined }), false, "no quote word for word");
  assert.equal(openByTerms({ ...base, terms: undefined }), false, "no address of the terms");
  assert.equal(openByTerms({ ...base, quoteFrom: "robots" }), false, "a quote of its robots.txt is no terms");
  assert.equal(openByTerms({ ...base, browserOnly: true }), false);
  assert.equal(openByTerms(undefined), false);
  // strom's own list: the open map services marked so, the archive's paths there kept off still; others unmarked
  for (const h of ["services.cuzk.gov.cz", "ags.cuzk.gov.cz"]) assert.equal(termsOpen({}, h), true, h);
  for (const h of ["data.matricula-online.eu", "ebadatelna.soapraha.cz", "www.mza.cz", "www.familysearch.org", "katalog.ahmp.cz", "archive.example.org"]) assert.equal(termsOpen({}, h), false, h);
  assert.ok(knownDisallow("ags.cuzk.gov.cz").includes("/archiv/"), "the archive of old maps: kept off by the list, whatever the terms of the services say");
});

test("the paths the list keeps off are never asked where the terms are open — its robots.txt saying nothing of them", async () => {
  const dir = tmp();
  // the site's robots.txt as read a moment ago, keeping nothing off: nothing goes out to read it again
  fs.writeFileSync(path.join(dir, "ags.cuzk.gov.cz.json"), JSON.stringify({ recent: [], robots: { at: Date.now(), status: 404, groups: [], ai: [] } }));
  await assert.rejects(
    politeGet("https://ags.cuzk.gov.cz/arcgis4/rest/services/Archiv/CO/ImageServer/exportImage?f=image", { stateDir: dir, hosts: ["ags.cuzk.gov.cz"], robots: true, fetchImpl: (() => Promise.reject(new Error("no request may leave"))) as typeof fetch }),
    (e: unknown) => e instanceof NetError && e.failure === "robots",
  );
});

/** A server on 127.0.0.1 with this robots.txt; every other path answers 200. */
async function server(robotsTxt: string): Promise<{ origin: string; paths: string[]; close: () => void }> {
  const paths: string[] = [];
  const s = http.createServer((q, r) => {
    paths.push(q.url ?? "");
    if (q.url === "/robots.txt") r.writeHead(200, { "content-type": "text/plain" }).end(robotsTxt);
    else r.writeHead(200, { "content-type": "application/json" }).end('{"ok":true}');
  });
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
  return { origin: `http://127.0.0.1:${(s.address() as AddressInfo).port}`, paths, close: () => s.close() };
}

test("terms that allow it + a Disallow in robots.txt only: asked, at its Crawl-delay at least; robots.txt naming AI, or no such terms: not asked", async () => {
  const srv = await server("User-agent: *\nDisallow: /data\nCrawl-delay: 3\n");
  try {
    const dir = tmp();
    const pauses: number[] = [];
    const opts = { stateDir: dir, hosts: ["127.0.0.1"], robots: true, termsOpen: () => true, sleep: async () => {}, onPause: (p: { ms: number }) => pauses.push(p.ms) };
    const res = await politeGet(`${srv.origin}/data/house?no=7`, opts);
    assert.equal(res.status, 200);
    assert.deepEqual(srv.paths, ["/robots.txt", "/data/house?no=7"], "its robots.txt first, then the one request");
    // the pace there: its Crawl-delay at least, the same for every later request
    const state = readHostState(dir, "127.0.0.1").state;
    assert.ok(hostPace(state, {}, undefined, "127.0.0.1").minIntervalMs >= 3000);
    assert.ok(pauses.length >= 1 && pauses.every((ms) => ms <= 3000) && pauses.some((ms) => ms > 2000), `paused at its Crawl-delay: ${pauses.join(", ")}`);

    // no such terms (strom's own list knows no 127.0.0.1): robots.txt holds, nothing asked
    const plain = tmp();
    await assert.rejects(politeGet(`${srv.origin}/data/house?no=7`, { stateDir: plain, hosts: ["127.0.0.1"], robots: true, sleep: async () => {} }), (e: unknown) => e instanceof NetError && e.failure === "robots");
  } finally {
    srv.close();
  }
  const ai = await server("User-agent: GPTBot\nUser-agent: ClaudeBot\nDisallow: /\n\nUser-agent: *\nDisallow: /data\n");
  try {
    await assert.rejects(
      politeGet(`${ai.origin}/data/house?no=7`, { stateDir: tmp(), hosts: ["127.0.0.1"], robots: true, termsOpen: () => true, sleep: async () => {} }),
      (e: unknown) => e instanceof NetError && e.failure === "robots",
      "a robots.txt that names AI agents: an explicit ban, the terms change nothing",
    );
    assert.deepEqual(ai.paths, ["/robots.txt"]);
  } finally {
    ai.close();
  }
});

test("the level and the agent's web tools: robots.txt alone yields to terms that allow it — said as the terms, never as robots.txt; else as before", () => {
  const config = tmp();
  const file = path.join(config, "test-archives.json");
  fs.writeFileSync(
    file,
    JSON.stringify({
      archives: [
        { host: "open.test", level: "allowed", terms: "https://open.test/terms", quote: "Open data: any use, by programs too.", automatedUse: true },
        { host: "plain.test", level: "allowed", terms: "https://plain.test/terms", quote: "Images for study." },
      ],
    }),
  );
  termsHooks.lookup = (h) => (h.endsWith(".test") ? ["127.0.0.1"] : []);
  const env = { STROM_CONFIG_DIR: config, HOME: config, STROM_ARCHIVES_FILE: file, STROM_ISOLATED: "1" };
  assert.equal(termsFor(env, "open.test")?.level, "allowed");
  assert.equal(termsOpen(env, "open.test"), true);
  assert.equal(termsOpen(env, "plain.test"), false);
  const shared = tmp();
  const netDir = path.join(shared, "net");
  fs.mkdirSync(netDir);
  const keepIn = (host: string, text: string) => fs.writeFileSync(path.join(netDir, `${host}.json`), JSON.stringify({ recent: [], robots: read(text) }));
  const levelIn = (host: string) => archiveLevel(env, { url: `https://${host}/`, net: netDir, readOnly: true });
  const gate = (url: string) => webGate({ env, url, shared, agent: "claude" });

  // the whole site kept off by robots.txt only, terms that allow it: no browser only, the terms quoted
  keepIn("open.test", "User-agent: *\nDisallow: /\n");
  const open = levelIn("open.test");
  assert.equal(open.level, "allowed");
  assert.equal(open.browserOnly, undefined);
  assert.equal(open.quoteBy, "strom");
  assert.equal(open.terms, "https://open.test/terms");
  assert.equal(gate("https://open.test/wfs/query.asp?id=1").allow, true, "the agent's own web tool too");
  // …and the same with AI agents named: robots.txt holds
  keepIn("open.test", "User-agent: *\nDisallow: /\n\nUser-agent: GPTBot\nDisallow: /\n");
  assert.equal(levelIn("open.test").browserOnly?.by, "robots");
  assert.equal(gate("https://open.test/wfs/query.asp?id=1").allow, false);
  // no such terms: as before
  keepIn("plain.test", "User-agent: *\nDisallow: /\n");
  const plain = levelIn("plain.test");
  assert.equal(plain.browserOnly?.by, "robots");
  assert.equal(plain.level, "restricted");
  keepIn("plain.test", "User-agent: *\nDisallow: /data\n");
  assert.equal(gate("https://plain.test/data/1").allow, false);
  assert.equal(gate("https://plain.test/other").allow, true);
  termsHooks.lookup = undefined;
});
