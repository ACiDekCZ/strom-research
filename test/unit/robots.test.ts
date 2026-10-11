// robots.txt as strom reads it, the kinds of a refusal, what a host's state keeps of them, the times said in the clock
// on the wall here — and a refusal strom cannot read its record of taken as one (fail closed).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { hostPace, parseRobots, politeGet, readHostState, refusalKind, REFUSED_FOREVER, robotsAll, robotsVerdict, stamp, NetError, type RobotsState } from "../../src/core/net.ts";
import { allows, archiveLevel } from "../../src/core/terms.ts";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "strom robots "));
const robots = (text: string): RobotsState => ({ at: Date.now(), status: 200, groups: parseRobots(text) });

test("robots.txt: the groups of strom-research and * apply, any case, a version after the token; others, comments and stray rules left out", () => {
  const g = parseRobots(
    [
      "Disallow: /before-any-agent",
      "# a comment",
      "User-agent: Googlebot",
      "Disallow: /",
      "",
      "User-agent: Strom-Research/1.13",
      "User-agent: otherbot",
      "Disallow: /archiv/ # its archive",
      "Allow: /archiv/volne",
      "Crawl-delay: 5",
      "User-agent: *",
      "Disallow: /tmp",
      "Crawl-delay: abc",
    ].join("\r\n"),
  );
  assert.deepEqual(g, [
    { agents: ["strom-research/1.13"], allow: ["/archiv/volne"], disallow: ["/archiv/"], crawlDelay: 5 },
    { agents: ["*"], allow: [], disallow: ["/tmp"] },
  ]);
});

test("robots.txt: the longest rule wins, Allow at a tie, * and $; the whole site kept off only without an Allow", () => {
  const r = robots("User-agent: *\nDisallow: /kniha\nAllow: /kniha/volna\nDisallow: /*.pdf$\nDisallow:\n");
  assert.deepEqual(robotsVerdict(r, "/kniha/5359?image=2"), { allowed: false, line: "Disallow: /kniha" });
  assert.deepEqual(robotsVerdict(r, "/kniha/volna/1"), { allowed: true });
  assert.deepEqual(robotsVerdict(r, "/scan/1.pdf"), { allowed: false, line: "Disallow: /*.pdf$" });
  assert.deepEqual(robotsVerdict(r, "/scan/1.pdf?x=1"), { allowed: true }, "$: the end");
  assert.deepEqual(robotsVerdict(r, "/catalog"), { allowed: true }, "an empty Disallow keeps nothing off");
  assert.deepEqual(robotsVerdict(r, "/robots.txt"), { allowed: true });
  assert.deepEqual(robotsVerdict(undefined, "/x"), { allowed: true }, "none read: nothing said");
  const all = robots("User-agent: *\nDisallow: /\n");
  assert.equal(robotsAll(all), "Disallow: /");
  assert.deepEqual(robotsVerdict(all, "/catalog"), { allowed: false, line: "Disallow: /", all: true });
  assert.equal(robotsAll(robots("User-agent: *\nDisallow: /\nAllow: /public/\n")), undefined, "a part allowed: not the whole site");
  assert.equal(robotsAll(robots("User-agent: Googlebot\nDisallow: /\n")), undefined, "another tool's group");
  // diacritics and another script in a path: matched as the request has it
  const cs = robots("User-agent: *\nDisallow: /matriky/Týnec\nDisallow: /книги\n");
  assert.equal(robotsVerdict(cs, "/matriky/Týnec/1").allowed, false);
  assert.equal(robotsVerdict(cs, "/книги/5").allowed, false);
});

test("Crawl-delay: a floor of the pace — the user's own and the service's slower never made faster", () => {
  const s = { recent: [], robots: robots("User-agent: *\nCrawl-delay: 12\n") };
  assert.equal(hostPace(s).minIntervalMs, 12_000);
  assert.equal(hostPace({ ...s, own: { minIntervalMs: 1000, at: "" } }).minIntervalMs, 12_000);
  assert.equal(hostPace(s, { minIntervalMs: 20_000 }).minIntervalMs, 20_000);
  assert.equal(hostPace(s, undefined, { minIntervalMs: 10_000, perHour: 120 }).minIntervalMs, 12_000);
});

test("refusal kinds: the first request of a run — the client when the host never let strom in, or a second day; else a day; 401 with a login never", () => {
  const now = Date.now();
  const day = 24 * 3600_000;
  assert.equal(refusalKind({ recent: [], tracked: now - 1000 }, 403, { first: true, login: false }, now), "client", "never answered strom (it counts from the first request)");
  assert.equal(refusalKind({ recent: [], tracked: now - 1000, okAt: now - 500 }, 403, { first: true, login: false }, now), "first");
  assert.equal(refusalKind({ recent: [], latencyMs: 300 }, 403, { first: true, login: false }, now), "first", "met before strom counted: it answered");
  assert.equal(refusalKind({ recent: [], okAt: now - 2 * day, refusedFirst: { at: now - day - 3600_000 } }, 403, { first: true, login: false }, now), "client", "a second day");
  assert.equal(refusalKind({ recent: [], okAt: now - 2 * day, refusedFirst: { at: now } }, 403, { first: true, login: false }, now), "first", "the same day: not yet");
  assert.equal(refusalKind({ recent: [], tracked: now }, 403, { first: false, login: false }, now), "load");
  assert.equal(refusalKind({ recent: [], tracked: now }, 401, { first: true, login: true }, now), "login");
  assert.equal(refusalKind({ recent: [], tracked: now }, 403, { first: true, login: true }, now), "client", "a 403 is no login");
});

test("a host's state keeps a refusal of the client however far ahead, and what strom read of it; broken parts left out", () => {
  const dir = tmp();
  const at = Date.now();
  fs.writeFileSync(
    path.join(dir, "archiv.example.org.json"),
    JSON.stringify({ recent: [], blockedUntil: REFUSED_FOREVER, refusedKind: "client", refusedFirst: { at }, okAt: at, tracked: at, robots: { at, status: 200, groups: [{ agents: ["*"], allow: [], disallow: ["/"] }] } }),
  );
  const s = readHostState(dir, "archiv.example.org").state;
  assert.equal(s.blockedUntil, REFUSED_FOREVER);
  assert.equal(s.refusedKind, "client");
  assert.equal(robotsAll(s.robots), "Disallow: /");
  fs.writeFileSync(path.join(dir, "zly.example.org.json"), JSON.stringify({ recent: [], refusedKind: "nonsense", robots: { groups: "x" }, refusedFirst: 5, blockedUntil: REFUSED_FOREVER }));
  const b = readHostState(dir, "zly.example.org");
  assert.equal(b.broken, true);
  assert.deepEqual([b.state.refusedKind, b.state.robots, b.state.refusedFirst, b.state.blockedUntil], [undefined, undefined, undefined, REFUSED_FOREVER], "the wait kept, the rest left out");
});

test("times said in the clock on the wall here, never UTC: a refusal's reason", async () => {
  const was = process.env.TZ;
  process.env.TZ = "Pacific/Kiritimati"; // UTC+14: never the same hour as UTC
  const s = http.createServer((_q, r) => r.writeHead(403).end());
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
  try {
    const dir = tmp();
    await assert.rejects(politeGet(`http://127.0.0.1:${(s.address() as AddressInfo).port}/x`, { stateDir: dir, hosts: ["127.0.0.1"], sleep: async () => {} }), (e: NetError) => e.failure === "refused" && e.refusedKind === "client");
    const reason = readHostState(dir, "127.0.0.1").state.reason!;
    const local = new Date().toLocaleString("sv-SE", { timeZone: "Pacific/Kiritimati" }).slice(0, 13);
    assert.ok(reason.includes(`at ${local}`), `${reason} — local ${local}`);
    assert.equal(stamp(Date.UTC(2026, 9, 11, 4, 22)), "2026-10-11 18:22");
  } finally {
    if (was === undefined) delete process.env.TZ;
    else process.env.TZ = was;
    s.close();
  }
});

test("a site only a browser goes to: nothing straight through strom, its images through the browser with the permission; D8: a refusal strom cannot read its record of is one", () => {
  const only = { level: "restricted" as const, browserOnly: { by: "robots" as const, line: "Disallow: /" } };
  assert.deepEqual(allows(only, "catalogue"), { ok: false, why: "browser", needs: "browser" });
  assert.deepEqual(allows({ ...only, permission: "slow" }, "images", "direct"), { ok: false, why: "browser", needs: "browser" });
  assert.deepEqual(allows({ ...only, permission: "slow" }, "pages", "browser"), { ok: false, why: "permission", needs: "browser" }, "slowly opens nothing");
  assert.deepEqual(allows({ ...only, permission: "browser" }, "pages", "browser"), { ok: true, human: false });
  assert.deepEqual(allows({ ...only, permission: "browser" }, "images", "browser"), { ok: true, human: true });

  const config = tmp();
  const net = tmp();
  const env = { STROM_CONFIG_DIR: config, HOME: config };
  const c = { name: "x", manifest: { hosts: ["archiv.example.org"], policy: { automation: "allowed" as const }, title: "X" } };
  assert.equal(archiveLevel(env, { connector: c, url: "archiv.example.org", net, readOnly: true }).refused, undefined);
  // both unreadable: the person's settings and the host's state — taken as refused
  fs.writeFileSync(path.join(config, "archives.json"), "{ cut sh");
  fs.writeFileSync(path.join(net, "archiv.example.org.json"), "{ cut sh");
  const a = archiveLevel(env, { connector: c, url: "archiv.example.org", net, readOnly: true });
  assert.equal(a.level, "forbidden");
  assert.equal(a.refused?.unreadable, true);
  // the host's state readable (nothing refused): the person's settings cut short say nothing more
  fs.writeFileSync(path.join(net, "archiv.example.org.json"), JSON.stringify({ recent: [] }));
  assert.equal(archiveLevel(env, { connector: c, url: "archiv.example.org", net, readOnly: true }).refused, undefined);
  // a refusal of the client kept in the settings alone (net/ wiped): still refused
  fs.writeFileSync(path.join(config, "archives.json"), JSON.stringify({ archives: { "archiv.example.org": { refused: { host: "archiv.example.org", at: new Date().toISOString() } } }, pending: [] }));
  fs.rmSync(path.join(net, "archiv.example.org.json"));
  assert.equal(archiveLevel(env, { connector: c, url: "archiv.example.org", net, readOnly: true }).level, "forbidden");
});
