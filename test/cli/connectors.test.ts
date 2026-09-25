// Connectors: plugins in the plugins folder (<shared>/plugins/connectors/<name>/
// — copy a folder in and it is there), run by strom — every request paced by
// strom's limiter, a refusal stopping everything, the images checked, what was
// fetched registered with its provenance. The user's consent (on a terminal,
// never an agent's) is needed when they ask for it (connectors.consent on), and
// always for code that goes round strom. A local server plays the archive; the
// pauses are recorded, not slept.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { spawnSync } from "node:child_process";
import type { AddressInfo } from "node:net";
import { World, hasGit, fakeConnector, pluginDir, readJsonFile } from "../helpers.ts";
import { testHooks, DEFAULT_PACE } from "../../src/core/net.ts";
import { encodeJpeg } from "../../src/image/jpeg-encode.ts";
import { decodeJpeg } from "../../src/image/jpeg-decode.ts";
import { blank } from "../../src/image/image.ts";

const opts = { skip: !hasGit };
const scans = path.join(import.meta.dirname, "..", "fixtures", "images");

const pauses: number[] = [];
testHooks.sleep = async (ms) => void pauses.push(ms);
after(() => (testHooks.sleep = undefined));

interface Archive {
  base: string;
  hits: string[];
  /** The forms members signed in with. */
  signins: Record<string, string>[];
  close: () => Promise<void>;
}

/**
 * A small archive portal: a catalogue, a book, its images. Book "zakazana"
 * answers 403, "chyba" an error page in place of an image, "useknuta" images
 * cut short. The search form wants a session (a cookie from /login) and the
 * portal's own header, as real portals do.
 */
/** Which fixture each tile of image 1 is: column-row (of image 2, the next one). */
const TILE: Record<string, number> = { "0-0": 1, "1-0": 2, "0-1": 3, "1-1": 1 };

async function archive(): Promise<Archive> {
  const hits: string[] = [];
  const signins: Record<string, string>[] = [];
  const catalog = (place: string) => JSON.stringify([{ id: "5359", title: `${place} N 1784–1820`, callNumber: "17", years: "1784-1820", kinds: ["baptism"], places: [place], url: "https://archive.example.org/5359", images: 3 }]);
  const s = http.createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://x");
    hits.push(u.pathname);
    if (u.pathname === "/catalog" && u.searchParams.get("place") === "Velké Město")
      return res.end(JSON.stringify(Array.from({ length: 40 }, (_, i) => ({ id: `k${i + 1}`, title: `Velké Město N ${1700 + i}`, places: ["Velké Město", "Dolní Lhota", "Čížkov"], images: 200 }))));
    if (u.pathname === "/catalog") return res.end(catalog(u.searchParams.get("place") ?? ""));
    if (u.pathname === "/login") return res.writeHead(302, { location: "/search-page", "set-cookie": "SESSION=s1; Path=/; HttpOnly" }).end();
    if (u.pathname === "/search-page") return res.end("<form>");
    if (u.pathname === "/search") {
      let body = "";
      req.on("data", (d) => (body += d));
      return req.on("end", () => {
        const ok = req.method === "POST" && req.headers.cookie === "SESSION=s1" && req.headers["x-requested-with"] === "XMLHttpRequest" && /form-urlencoded/.test(String(req.headers["content-type"]));
        if (!ok) return res.writeHead(400).end(`no session: ${req.method} ${req.headers.cookie}`);
        return res.end(catalog(new URLSearchParams(body).get("place") ?? ""));
      });
    }
    if (u.pathname === "/book/5359") return res.end(JSON.stringify({ id: "5359", title: "Týnec N 1784–1820", images: 3 }));
    // a part of an image, drawn from the original: as big as the whole image, so twice the detail of a quarter
    if (/^\/part\/5359\/\d+\.jpg$/.test(u.pathname)) {
      hits[hits.length - 1] += u.search;
      return res.writeHead(200, { "content-type": "image/jpeg" }).end(fs.readFileSync(path.join(scans, "s0003.jpg")));
    }
    // members sign in with a form, and the pages they see repeat what they typed (as some portals do)
    if (u.pathname === "/signin") {
      let body = "";
      req.on("data", (d) => (body += d));
      return req.on("end", () => {
        const f = Object.fromEntries(new URLSearchParams(body));
        signins.push(f);
        const html = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        res.writeHead(200, { "set-cookie": "MEMBER=1; Path=/" }).end(`Vítejte ${f.name}, heslo: ${html(f.pass ?? "")}`);
      });
    }
    if (u.pathname === "/whoami") return res.end(`member ${req.headers.cookie ?? "none"} · ${encodeURIComponent(signins.at(-1)?.pass ?? "")}`);
    if (u.pathname === "/echo") return res.end(`key ${req.headers["x-api-key"] ?? "none"}`);
    if (u.pathname === "/hop") return res.writeHead(302, { location: `http://127.0.0.1:${u.searchParams.get("port")}/echo` }).end();
    // behind a bot check: a browser that passed it (its cookie) gets the portal, anything else the check
    if (u.pathname.startsWith("/g/")) {
      if (!/(^|; )passed=1/.test(String(req.headers.cookie ?? "")))
        return res.writeHead(200, { "content-type": "text/html" }).end(`<html><head><META NAME="robots" CONTENT="noindex,nofollow"><script src="/_Incapsula_Resource?SWJIYLWA=5074a744e2e3d891"></script></head><body></body></html>`);
      if (u.pathname === "/g/catalog") {
        const page = Number(u.searchParams.get("page") ?? 1);
        return res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ books: [{ id: String(5358 + page), title: `${u.searchParams.get("place")} ${page === 1 ? "N" : "Z"} 1784–1820`, images: 3 }], next: page < 2 }));
      }
      if (u.pathname === "/g/book/zakazana") return res.writeHead(403).end("no");
      if (u.pathname === "/g/book/5359") return res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ id: "5359", title: "Týnec N 1784–1820", images: 3 }));
      const gi = /^\/g\/img\/5359\/([1-3])\.jpg$/.exec(u.pathname);
      if (gi) return res.writeHead(200, { "content-type": "image/jpeg" }).end(fs.readFileSync(path.join(scans, `s000${gi[1]}.jpg`)));
      return res.writeHead(404).end();
    }
    // a portal that shows its images in tiles only: 2 × 2 of 400 × 300 px
    const tile = /^\/tile\/5359\/(\d+)\/(\d)-(\d)\.jpg$/.exec(u.pathname);
    if (tile) return res.writeHead(200, { "content-type": "image/jpeg" }).end(fs.readFileSync(path.join(scans, `s000${((TILE[`${tile[2]}-${tile[3]}`]! + Number(tile[1]) - 2) % 3) + 1}.jpg`)));
    // a stand-in: a tiny picture in place of an image the portal will not give
    if (/^\/thumb\/\d+\.jpg$/.test(u.pathname)) return res.writeHead(200, { "content-type": "image/jpeg" }).end(encodeJpeg(blank(120, 97, 3, 200)));
    if (/^\/same\/\d+\.jpg$/.test(u.pathname)) return res.writeHead(200, { "content-type": "image/jpeg" }).end(fs.readFileSync(path.join(scans, "s0001.jpg")));
    const img = /^\/img\/([^/]+)\/(\d+)\.jpg$/.exec(u.pathname);
    if (img && img[1] === "zakazana") return res.writeHead(403).end();
    if (img && img[1] === "chyba") return res.writeHead(200, { "content-type": "image/jpeg" }).end(`<!DOCTYPE html><html><body>Too many requests — try again later.</body></html>`);
    const scan = img && Number(img[2]) >= 1 && Number(img[2]) <= 3 ? fs.readFileSync(path.join(scans, `s000${img[2]}.jpg`)) : undefined;
    if (scan && img![1] === "useknuta") return res.writeHead(200, { "content-type": "image/jpeg" }).end(scan.subarray(0, Math.floor(scan.length * 0.6)));
    if (scan) return res.writeHead(200, { "content-type": "image/jpeg" }).end(scan);
    return res.writeHead(404).end();
  });
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
  s.unref(); // a failed test does not keep the run waiting
  return { base: `http://127.0.0.1:${(s.address() as AddressInfo).port}`, hits, signins, close: () => new Promise<void>((r) => s.close(() => r())) };
}

async function world(): Promise<{ w: World; a: Archive; dir: string }> {
  const w = new World();
  await w.withTree();
  const a = await archive();
  const dir = await fakeConnector(w, "zkusebni", a.base);
  return { w, a, dir };
}

/** Replace the program of a connector (the SDK and the manifest stay). */
function program(dir: string, code: string): void {
  fs.writeFileSync(path.join(dir, "connector.ts"), code);
}

test("connector new: in the plugins folder, next to the contract, kept out of every repository", opts, async () => {
  const w = new World();
  await w.ok(["setup", "--yes"]); // no tree needed: a connector serves them all
  const r = await w.ok(["connector", "new", "statni-archiv", "--url", "https://digi.example.org/portal", "--title", "Státní archiv Čížkov"]);
  const dir = pluginDir(w, "statni-archiv");
  assert.deepEqual(fs.readdirSync(dir).sort(), ["DISCOVERY.md", "README.md", "connector.json", "connector.ts", "package.json", "sdk.ts"]);
  const m = readJsonFile(path.join(dir, "connector.json"));
  assert.equal(m.interface, 1);
  assert.equal(m.name, undefined, "the folder's name is its name");
  assert.deepEqual(m.hosts, ["digi.example.org"]);
  assert.equal(m.policy.automation, "unknown", "nobody knows yet what the portal allows");
  assert.match(fs.readFileSync(path.join(dir, "DISCOVERY.md"), "utf8"), /Building the connector for Státní archiv Čížkov[\s\S]*`\.\.\/README\.md`[\s\S]*Terms of use[\s\S]*strom connector test statni-archiv/);
  assert.match(r.out, /finds out what the portal allows — before any code/);
  assert.doesNotMatch(r.out, /consent/, "it runs once it is written");
  // the plugins folder explains itself, and carries the contract
  const plugins = path.join(w.home, "shared", "plugins");
  assert.match(fs.readFileSync(path.join(plugins, "README.md"), "utf8"), /copying its folder in/);
  assert.match(fs.readFileSync(path.join(plugins, "connectors", "README.md"), "utf8"), /# Connectors — interface 1[\s\S]*version 1 and it does not change[\s\S]*"http":\{"url"/);
  // …and no plugin ends up in a repository by accident: only strom's READMEs are seen by git
  const shared = path.join(w.home, "shared");
  assert.equal(spawnSync("git", ["init", "-q"], { cwd: shared }).status, 0);
  fs.writeFileSync(path.join(plugins, "connectors", "stray.zip"), "x");
  const seen = spawnSync("git", ["status", "--porcelain", "--untracked-files=all", "plugins"], { cwd: shared, encoding: "utf8" }).stdout;
  assert.deepEqual(seen.trim().split("\n").map((l) => l.slice(3)).sort(), ["plugins/.gitignore", "plugins/README.md", "plugins/connectors/README.md"]);
  assert.equal((await w.run(["connector", "new", "Velká Písmena", "--url", "https://x.org"])).code, 2);
  assert.equal((await w.run(["connector", "new", "bez-url"])).code, 2);
  assert.equal((await w.run(["connector", "new", "statni-archiv", "--url", "https://x.org"])).code, 2, "exists already");
  const list = await w.ok(["connector", "list"]);
  assert.match(list.out, /statni-archiv\s+Státní archiv Čížkov\s+find,list,fetch\s+automation unknown\s+ready/);
  assert.match(list.out, /folder: .*plugins\/connectors — copy a connector's folder in to install it/);
  // an agent's sandbox may not write here (found with Codex): strom's own copies stay as they are, reading still works
  if (process.platform !== "win32" && process.getuid?.() !== 0) {
    const folder = path.join(plugins, "connectors");
    const contract = path.join(folder, "README.md");
    fs.writeFileSync(contract, "an older contract");
    fs.chmodSync(contract, 0o444);
    fs.chmodSync(folder, 0o555);
    try {
      assert.match((await w.ok(["connector", "list"])).out, /statni-archiv\s+Státní archiv Čížkov/);
      assert.match((await w.ok(["connector", "show", "statni-archiv"])).out, /statni-archiv/);
    } finally {
      fs.chmodSync(folder, 0o755);
      fs.chmodSync(contract, 0o644);
    }
    assert.equal(fs.readFileSync(contract, "utf8"), "an older contract");
  }
  w.cleanup();
});

test("copying a folder in is installing it; the user who asked to be asked allows it the first time they use it", opts, async () => {
  const { w, a, dir } = await world();
  // someone gives the user a connector: they copy its folder in
  fs.cpSync(dir, pluginDir(w, "kopie"), { recursive: true });
  // two copies that cannot run, and say why
  fs.cpSync(dir, pluginDir(w, "Archiv Čížkov"), { recursive: true });
  fs.cpSync(dir, pluginDir(w, "stary"), { recursive: true });
  const old = readJsonFile(path.join(pluginDir(w, "stary"), "connector.json"));
  delete old.interface;
  fs.writeFileSync(path.join(pluginDir(w, "stary"), "connector.json"), JSON.stringify(old));
  fs.cpSync(dir, pluginDir(w, "_odlozeny"), { recursive: true }); // put aside: ignored
  const list = (await w.ok(["connector", "list"])).out;
  assert.match(list, /kopie\s+Testovací archiv[\s\S]*zkusebni\s+Testovací archiv/);
  assert.match(list, /Archiv Čížkov {2}⚠ cannot run: the folder's name is the connector's name: .* rename it \(e\.g\. archiv-cizkov\)/);
  assert.match(list, /stary {2}⚠ cannot run: connector\.json: interface: 1/);
  assert.doesNotMatch(list, /_odlozeny/);
  assert.equal((await w.run(["fetch", "stary", "--find", "x"])).code, 2);
  // it runs at once
  assert.match((await w.ok(["connector", "test", "kopie", "--find", "Týnec"])).out, /Týnec N 1784–1820/);
  a.hits.length = 0;
  // the user wants to be asked first: an agent (or a script) gets the question for the user, and nothing is sent
  assert.match((await w.ok(["config", "set", "connectors.consent", "on"])).out, /connectors\.consent = on/);
  assert.match((await w.ok(["connector", "list"])).out, /kopie\s+Testovací archiv\s+find,list,fetch\s+automation allowed\s+needs your consent; hosts not allowed: 127\.0\.0\.1/);
  const t = await w.run(["connector", "test", "kopie", "--find", "Týnec"]);
  assert.equal(t.code, 4);
  assert.match(t.err, /consent required — Run connector kopie \(Testovací archiv\), with automated access to 127\.0\.0\.1\?\n→ ask the user to run in their own terminal: strom allow connector kopie/);
  const agent = new World();
  Object.assign(agent.env, w.env, { CLAUDECODE: "1" });
  agent.cwd = w.cwd;
  assert.equal((await agent.run(["connector", "test", "kopie", "--find", "Týnec"], { tty: true, answers: ["y", "y"] })).code, 4, "an agent's terminal is not the user's");
  assert.deepEqual(a.hits, [], "nothing was sent");
  // the user, in their terminal: the warning, the question, and on it goes
  const r = await w.run(["connector", "test", "kopie", "--find", "Týnec"], { tty: true, answers: ["y", "y"] });
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /Connector kopie [\d.]+ — Testovací archiv[\s\S]*its code uses no network of its own \(checked\); your agent may go on improving it/);
  assert.match(r.out, /Automated access to 127\.0\.0\.1[\s\S]*gets your IP blocked/);
  assert.match(r.out, /Týnec N 1784–1820/);
  assert.match((await w.ok(["connector", "list"])).out, /kopie\s+Testovací archiv\s+find,list,fetch\s+automation allowed\s+allowed\n/);
  assert.equal((await w.ok(["connector", "test", "kopie", "--find", "Týnec"])).code, 0, "allowed: no more questions");
  w.cleanup();
  agent.cleanup();
  await a.close();
});

test("consent: only the user, on a terminal — never --yes, --json or an agent's session", opts, async () => {
  const { w, a, dir } = await world();
  await w.ok(["config", "set", "connectors.consent", "on"]);
  for (const flags of [[], ["--yes"], ["--json"]]) assert.equal((await w.run(["allow", "connector", "zkusebni", ...flags])).code, 4, flags.join(" "));
  const agent = new World();
  Object.assign(agent.env, w.env, { STROM_SESSION: "S0001" });
  agent.cwd = w.cwd;
  const refused = await agent.run(["allow", "connector", "zkusebni"], { tty: true, answers: ["y", "y"] });
  assert.equal(refused.code, 4, "inside an agent's session");
  assert.match(refused.err, /an agent cannot answer this/);
  assert.equal((await w.run(["allow", "host", "127.0.0.1"], { tty: true, answers: [] })).code, 0, "no answer is a no");
  assert.equal(fs.existsSync(path.join(w.env.STROM_CONFIG_DIR!, "consents.json")), false);
  // the user reads the warning and says yes to the connector, and to its host
  const r = await w.run(["allow", "connector", "zkusebni"], { tty: true, answers: ["y", "y"] });
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /Automated access to 127\.0\.0\.1[\s\S]*gets your IP blocked[\s\S]*at least 2 s apart, no hourly cap/);
  assert.match(r.out, /connector zkusebni allowed\nhosts allowed: 127\.0\.0\.1/);
  const c = readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "consents.json"));
  assert.equal(c.connectors.zkusebni.dir, dir);
  assert.match(c.connectors.zkusebni.hash, /^[0-9a-f]{64}$/);
  assert.ok(c.hosts["127.0.0.1"]);
  assert.match((await w.ok(["allow", "connector", "zkusebni"], { tty: true })).out, /allowed already/);
  assert.match((await w.ok(["consents"])).out, /connectors\n  zkusebni[\s\S]*hosts \(automated access\)\n  127\.0\.0\.1/);
  // taking it back
  assert.match((await w.ok(["allow", "host", "127.0.0.1", "--revoke"], { tty: true })).out, /consent taken back/);
  assert.equal((await w.run(["connector", "test", "zkusebni", "--find", "Týnec"])).code, 4);
  assert.match((await w.ok(["allow", "connector", "zkusebni", "--revoke"], { tty: true })).out, /consent taken back — it does not run now/);
  assert.match((await w.ok(["connector", "list"])).out, /zkusebni\s.*needs your consent/);
  assert.deepEqual(a.hits, []);
  w.cleanup();
  agent.cleanup();
  await a.close();
});

test("consents off (the default): a connector runs at once — code that goes round strom needs the user's yes, and only the user turns asking off", opts, async () => {
  const { w, a, dir } = await world();
  assert.deepEqual((await w.ok(["config", "get", "connectors.consent", "--json"])).json, { key: "connectors.consent", value: "off", source: "default" });
  assert.match((await w.ok(["connector", "test", "zkusebni", "--find", "Týnec"])).out, /Týnec N 1784–1820/);
  assert.match((await w.ok(["connector", "list"])).out, /zkusebni\s.*automation allowed\s+ready\n/);
  assert.match((await w.ok(["consents"])).out, /^consents: off — connectors run without asking \(paced by strom, only to their hosts\)/);
  assert.match((await w.ok(["allow", "connector", "zkusebni"])).out, /consents are off: connector zkusebni runs without asking — paced by strom, only to 127\.0\.0\.1/);
  // code that reaches the network itself: the user's yes, for exactly this code
  fs.appendFileSync(path.join(dir, "connector.ts"), "\nconst sneak = await fetch('https://elsewhere.example/');\n");
  const hits = a.hits.length;
  const t = await w.run(["connector", "test", "zkusebni", "--find", "Týnec"]);
  assert.equal(t.code, 4);
  assert.match(t.err, /consent required — Connector zkusebni \(Testovací archiv\) reaches the network itself, past strom's limiter — run it\?/);
  assert.match((await w.ok(["connector", "list"])).out, /zkusebni\s.*needs your consent\n/);
  const yes = await w.run(["allow", "connector", "zkusebni"], { tty: true, answers: ["y"] });
  assert.equal(yes.code, 0, yes.err);
  assert.match(yes.out, /⚠ its code reaches the network or other programs directly[\s\S]*connector zkusebni allowed\nhosts allowed: 127\.0\.0\.1/);
  assert.match((await w.ok(["connector", "list"])).out, /zkusebni\s.*ready\n/);
  fs.appendFileSync(path.join(dir, "connector.ts"), "\n// one more line\n");
  assert.match((await w.run(["connector", "test", "zkusebni", "--find", "Týnec"])).err, /and its code changed since you allowed it — run it\?/);
  assert.equal(a.hits.length, hits, "nothing was sent");
  // being asked first: anyone may turn it on, only the user turns it off again
  await w.ok(["config", "set", "connectors.consent", "on"]);
  const agent = new World();
  Object.assign(agent.env, w.env, { CLAUDECODE: "1" });
  agent.cwd = w.cwd;
  for (const cmd of [["config", "set", "connectors.consent", "off"], ["config", "unset", "connectors.consent"]]) {
    const r = await agent.run(cmd, { tty: true, answers: ["y"] });
    assert.equal(r.code, 4, cmd.join(" "));
    assert.match(r.err, /Let connectors run without asking you first\? \(an agent cannot answer this\)/);
  }
  assert.equal((await w.run(["config", "set", "connectors.consent", "off"])).code, 4, "not without a terminal");
  assert.equal((await w.ok(["config", "get", "connectors.consent"])).out.trim(), "on");
  assert.equal((await w.run(["config", "set", "connectors.consent", "off"], { tty: true })).code, 0, "the user, in their terminal");
  assert.equal((await w.ok(["config", "get", "connectors.consent"])).out.trim(), "off");
  w.cleanup();
  agent.cleanup();
  await a.close();
});

test("connector test: a few requests, the books found, what to register them with — files in its .test folder", opts, async () => {
  const { w, a, dir } = await world();
  const r = await w.ok(["connector", "test", "zkusebni", "--find", "Týnec nad Labem", "--years", "1780-1850"]);
  assert.match(r.out, /test find: 1 request\(s\)/);
  assert.match(r.out, /Týnec nad Labem N 1784–1820 \(17\) · 1784-1820 · baptism · 3 images/);
  assert.match(r.out, /strom recordset add "Týnec nad Labem N 1784–1820" --call-number 17 --kinds baptism --places "Týnec nad Labem" --years 1784-1820 --url https:\/\/archive\.example\.org\/5359 --access online-free/);
  assert.match(r.out, /then: strom fetch zkusebni 5359 --images <from-to> --recordset B…/);
  const f = await w.ok(["connector", "test", "zkusebni", "--fetch", "5359", "--images", "1-3", "--max", "2"]);
  assert.match(f.out, /test fetch: 2 request\(s\) · stopped: the run's limit of 2 requests/);
  assert.match(f.out, /images \(2\): 1=s0001\.jpg \d+ B 400×300 px, 2=s0002\.jpg/);
  assert.deepEqual(fs.readdirSync(path.join(dir, ".test")).sort(), ["s0001.jpg", "s0002.jpg"]);
  // many books: one line each, the first 30 — the rest in --json
  const many = await w.ok(["connector", "test", "zkusebni", "--find", "Velké Město"]);
  assert.match(many.out, /books \(40\):\n {2}k1 {2}Velké Město N 1700 · 200 images\n/);
  assert.match(many.out, /k30 {2}Velké Město N 1729 · 200 images\n {2}… 10 more — narrow it with --years, or read them all with --json\n {2}one of them, with the command to register it: strom connector test zkusebni --list <id>/);
  assert.doesNotMatch(many.out, /k31 |recordset add/);
  assert.equal((await w.ok(["connector", "test", "zkusebni", "--find", "Velké Město", "--json"])).json.books.length, 40);
  assert.equal((await w.run(["connector", "test", "zkusebni", "--max", "99", "--find", "x"])).code, 2);
  assert.equal((await w.run(["connector", "test", "zkusebni"])).code, 2, "what to try");
  assert.equal((await w.run(["connector", "test", dir, "--find", "x"])).code, 2, "by its name, not a path");
  // nothing of it is in the research
  assert.equal((await w.ok(["media", "list", "--json"])).json.total, 0);
  w.cleanup();
  await a.close();
});

test("fetch: paced, estimated, registered with where each image came from, and the tasks waiting for them wake up", opts, async () => {
  const { w, a } = await world();
  await w.ok(["recordset", "add", "Týnec N 1784–1820", "--kinds", "baptism", "--url", `${a.base}/book/5359`]); // B0001
  await w.ok(["research", "new", "X", "--new-person", "Jan /Novák/"]);
  await w.ok(["task", "add", "Křest", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]); // T1
  // the brief knows the book's archive has a connector the user allowed
  assert.match((await w.ok(["brief", "T1"])).out, /no images here yet — connector zkusebni fetches the ones you need: strom fetch zkusebni <book> --images <from-to> --recordset B0001/);
  await w.ok(["task", "wait", "T1", "--on", "images 1–3 of B0001"]);
  const dry = await w.ok(["fetch", "zkusebni", "5359", "--images", "1-3", "--recordset", "B1", "--dry-run"]);
  assert.match(dry.out, /dry run: would fetch images 1–3 of book 5359 as images of B0001 through zkusebni — nothing was fetched/);
  assert.deepEqual(a.hits, [], "a dry run never contacts the archive");
  pauses.length = 0;
  const r = await w.ok(["fetch", "zkusebni", "5359", "--images", "1-3", "--recordset", "B1"]);
  assert.match(r.err, /3 image\(s\) through zkusebni: at least 4 s at its pace \(one request per image, ≥2 s apart\)/);
  assert.match(r.out, /fetch: 3 request\(s\)/);
  assert.match(r.out, /3 image\(s\) of B0001 \(images 1–3\) fetched and registered/);
  assert.match(r.out, /back in the queue \(they waited for these images\): T0001/);
  assert.equal(pauses.length, 2, "no pause before the first request, one before each next");
  assert.ok(pauses.every((p) => p > DEFAULT_PACE.minIntervalMs - 500), pauses.join(","));
  const m = (await w.ok(["media", "show", "B1:2", "--json"])).json.media;
  assert.equal(m.url, `${a.base}/img/5359/2.jpg`);
  assert.equal(m.from, "connector zkusebni · s0002.jpg");
  assert.equal(m.image, 2);
  assert.equal((await w.ok(["task", "show", "T1", "--json"])).json.task.state, "open");
  assert.deepEqual(fs.readdirSync(path.join(w.cwd, ".strom", "fetch")), [], "the work folder is gone");
  // again: nothing new
  const hits = a.hits.length;
  assert.match((await w.ok(["fetch", "zkusebni", "5359", "--images", "1-3", "--recordset", "B1"])).out, /images 1–3 of B0001 are registered already — nothing fetched/);
  assert.equal(a.hits.length, hits, "not asked for again");
  // without a record set: into the inbox, a folder for the book
  const inbox = await w.ok(["fetch", "zkusebni", "5359", "--images", "2-3"]);
  assert.match(inbox.out, /2 image\(s\) fetched into the inbox: zkusebni 5359\/[\s\S]*strom media add --inbox "zkusebni 5359" --recordset B…/);
  assert.deepEqual(fs.readdirSync(path.join(w.home, "shared", "inbox", "zkusebni 5359")).sort(), ["s0002.jpg", "s0003.jpg"]);
  // finding books writes nothing
  assert.match((await w.ok(["fetch", "zkusebni", "--find", "Týnec"])).out, /Týnec N 1784–1820/);
  assert.equal((await w.run(["fetch", "zkusebni", "5359"])).code, 2, "which images?");
  assert.equal((await w.run(["fetch", "zkusebni", "5359", "--images", "1-1001"])).code, 2, "not more than a thousand at once");
  w.cleanup();
  await a.close();
});

test("a session and a form: cookies kept, the portal's headers, a POST — all through strom", opts, async () => {
  const { w, a, dir } = await world();
  program(
    dir,
    `import { book, done, fail, get, post, request } from "./sdk.ts";
const BASE = ${JSON.stringify(a.base)};
const req = await request();
if (req.cmd !== "find") fail("find only");
const start = await get(BASE + "/login");
const found = await post(BASE + "/search", { place: req.place }, { headers: { "X-Requested-With": "XMLHttpRequest", Referer: start.url! } });
if (found.status !== 200) fail("search: " + found.status + " " + found.text);
for (const b of JSON.parse(found.text!)) book(b);
done();
`,
  );
  const r = await w.ok(["fetch", "zkusebni", "--find", "Dolní Lhota"]);
  assert.match(r.out, /find \(\d+ s\): 2 request\(s\)/);
  assert.match(r.out, /Dolní Lhota N 1784–1820/);
  assert.deepEqual(a.hits, ["/login", "/search-page", "/search"], "the redirect followed by strom, with its cookie");
  // the next run starts without the cookie: the server wants a new session
  program(dir, `import { done, fail, post, request } from "./sdk.ts";\nawait request();\nconst r = await post(${JSON.stringify(a.base)} + "/search", { place: "x" }, { headers: { "X-Requested-With": "XMLHttpRequest" } });\nif (r.status !== 400) fail("a cookie of another run");\ndone();\n`);
  assert.equal((await w.run(["fetch", "zkusebni", "--find", "x"])).code, 0);
  w.cleanup();
  await a.close();
});

test("an error page or a broken download is not a scan: the run stops, nothing is registered", opts, async () => {
  const { w, a } = await world();
  await w.ok(["recordset", "add", "Kniha", "--kinds", "baptism"]); // B0001
  const page = await w.run(["fetch", "zkusebni", "chyba", "--images", "1-3", "--recordset", "B1"]);
  assert.equal(page.code, 1);
  assert.match(page.out, /stopped: image 1 \(s0001\.jpg\): not an image \(it begins "<!DOCTYPE html><"\) — an error page\?/);
  assert.equal(a.hits.filter((h) => h.startsWith("/img/chyba/")).length, 1, "not another request after it");
  const cut = await w.run(["fetch", "zkusebni", "useknuta", "--images", "1-3", "--recordset", "B1"]);
  assert.equal(cut.code, 1);
  assert.match(cut.out, /stopped: image 1 \(s0001\.jpg\): a JPEG cut short \(no end marker\) — the download broke off/);
  assert.equal((await w.ok(["media", "list", "--json"])).json.total, 0);
  w.cleanup();
  await a.close();
});

test("a stand-in is not a scan (a thumbnail, the same picture again); an image in tiles only is put together by strom", opts, async () => {
  const { w, a, dir } = await world();
  program(
    dir,
    `import { done, fail, get, image, imageFromTiles, log, request } from "./sdk.ts";
const BASE = ${JSON.stringify(a.base)};
const req = await request();
if (req.cmd !== "fetch") fail("fetch only");
for (const n of req.images) {
  const file = "s" + String(n).padStart(4, "0") + ".jpg";
  if (req.book === "tiles" || req.book === "gap") {
    const tiles = [];
    for (const [c, r] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      if (req.book === "gap" && c === 1 && r === 1) continue;
      const got = await get(BASE + "/tile/5359/" + n + "/" + c + "-" + r + ".jpg", { save: "t" + n + "-" + c + "-" + r + ".jpg" });
      log("tile " + c + "-" + r + " " + got.width + "x" + got.height);
      tiles.push({ file: "t" + n + "-" + c + "-" + r + ".jpg", x: c * 400, y: r * 300 });
    }
    imageFromTiles(n, file, tiles, { width: 800, height: 600 }, BASE + "/view/" + n);
  } else {
    const got = await get(BASE + "/" + req.book + "/" + n + ".jpg", { save: file });
    log("image " + n + " " + got.width + "x" + got.height);
    image(n, file, BASE + "/view/" + n);
  }
}
done();
`,
  );
  await w.ok(["recordset", "add", "Kniha", "--kinds", "baptism"]); // B0001
  // a thumbnail in place of the image: stopped, nothing registered — and the connector saw its size first
  const thumb = await w.run(["fetch", "zkusebni", "thumb", "--images", "1-2", "--recordset", "B1"]);

  assert.equal(thumb.code, 1);
  assert.match(thumb.err, /image 1 120x97/);
  assert.match(thumb.out, /stopped: image 1 \(s0001\.jpg\): 120×97 px — a placeholder or a thumbnail, not a scan/);
  // the same picture for another image
  const same = await w.run(["fetch", "zkusebni", "same", "--images", "1-2", "--recordset", "B1"]);

  assert.equal(same.code, 1);
  assert.match(same.out, /stopped: image 2 \(s0002\.jpg\): the same file as image 1 — a placeholder in place of both, neither is kept/);
  assert.equal((await w.ok(["media", "list", "--json"])).json.total, 0);
  // tiles: put together into one image, the tiles gone
  const t = await w.ok(["connector", "test", "zkusebni", "--fetch", "tiles", "--images", "1", "--max", "10"]);
  assert.match(t.err, /tile 1-1 400x300/);
  assert.match(t.out, /images \(1\): 1=s0001\.jpg \d+ B 800×600 px/);
  const test = path.join(dir, ".test");
  assert.deepEqual(fs.readdirSync(test).filter((f) => f !== "probe"), ["s0001.jpg"]);
  const whole = decodeJpeg(fs.readFileSync(path.join(test, "s0001.jpg")));
  const px = (img: { width: number; channels: number; data: Uint8Array }, x: number, y: number) => img.data[(y * img.width + x) * img.channels]!;
  for (const [x, y, c, r] of [[100, 100, 0, 0], [500, 100, 1, 0], [100, 400, 0, 1], [700, 550, 1, 1]] as const) {
    const src = decodeJpeg(fs.readFileSync(path.join(scans, `s000${TILE[`${c}-${r}`]}.jpg`)));
    assert.ok(Math.abs(px(whole, x, y) - px(src, x - c * 400, y - r * 300)) <= 12, `tile ${c}-${r} in its place`);
  }
  const reg = await w.ok(["fetch", "zkusebni", "tiles", "--images", "1-2", "--recordset", "B1"]);
  assert.match(reg.out, /2 image\(s\)/);
  assert.match((await w.ok(["media", "list"])).out, /M0001\s+B0001:1\s+800×600/);
  // another book of the portal gives the same scans: not registered as its images, and said so
  await w.ok(["recordset", "add", "Jiná kniha", "--kinds", "burial"]); // B0002
  const clash = await w.ok(["fetch", "zkusebni", "tiles", "--images", "1", "--recordset", "B2"]);
  assert.match(clash.out, /1 already registered\n⚠ B0002:1 is the same file as M0001 \(B0001:1\) — not registered again: the portal may have given another book's image/);
  assert.equal((await w.ok(["media", "list", "--json"])).json.total, 2);
  // a tile left out: a gap, not an image
  const gap = await w.run(["connector", "test", "zkusebni", "--fetch", "gap", "--images", "1"]);
  assert.match(gap.out, /stopped: image 1: the tiles leave a gap near 404,300 px of 800×600 — a tile is missing, or its x, y is wrong/);
  w.cleanup();
  await a.close();
});

test("the pace of a host: strom's pause and no cap made up — the user's own, set in their terminal, back with auto", opts, async () => {
  const { w, a } = await world();
  assert.match((await w.ok(["connector", "show", "zkusebni"])).out, /pace\s+at least 2 s apart, no hourly cap/);
  assert.equal((await w.run(["allow", "host", "127.0.0.1", "--pace", "1"])).code, 4, "the user's decision");
  assert.equal((await w.run(["allow", "host", "127.0.0.1", "--pace", "0.1"], { tty: true })).code, 2, "not below the shortest pause");
  const set = await w.ok(["allow", "host", "127.0.0.1", "--pace", "0.5", "--per-hour", "3000"], { tty: true });
  assert.match(set.out, /127\.0\.0\.1: at least 0\.5 s apart, at most 3000 an hour — yours/);
  assert.match((await w.ok(["consents"])).out, /127\.0\.0\.1 · at least 0\.5 s apart, at most 3000 an hour \(yours\)/);
  assert.match((await w.ok(["connector", "show", "zkusebni"])).out, /pace\s+at least 0\.5 s apart, at most 3000 an hour — yours for the host/);
  const back = await w.ok(["allow", "host", "127.0.0.1", "--pace", "auto", "--per-hour", "auto"], { tty: true });
  assert.match(back.out, /127\.0\.0\.1: at least 2 s apart, no hourly cap — the service's again/);
  w.cleanup();
  await a.close();
});

test("a refusal (403) stops the run and leaves the archive alone — until the user lifts it", opts, async () => {
  const { w, a } = await world();
  const r = await w.run(["fetch", "zkusebni", "zakazana", "--images", "1-5"]);
  assert.equal(r.code, 1);
  assert.match(r.out, /stopped: .*403/);
  assert.equal(a.hits.filter((h) => h.startsWith("/img/")).length, 1, "nothing after the refusal");
  assert.match((await w.ok(["consents"])).out, /127\.0\.0\.1 · ⛔ refused us — left alone until/);
  const again = await w.run(["fetch", "zkusebni", "5359", "--images", "1"]);
  assert.equal(again.code, 1);
  assert.match(again.out, /left alone until/);
  assert.equal(a.hits.length, 1, "not even another book");
  assert.equal((await w.run(["allow", "host", "127.0.0.1", "--unblock"])).code, 4, "only the user");
  assert.match((await w.ok(["allow", "host", "127.0.0.1", "--unblock"], { tty: true, answers: ["y"] })).out, /the refusal is lifted/);
  assert.equal((await w.run(["fetch", "zkusebni", "5359", "--images", "1"])).code, 0);
  w.cleanup();
  await a.close();
});

test("what the portal and the tree allow: manual stays manual, a forbidden archive is not fetched", opts, async () => {
  const { w, a } = await world();
  await fakeConnector(w, "rucni", a.base, { automation: "manual", terms: "https://archive.example.org/terms" });
  const m = await w.run(["fetch", "rucni", "5359", "--images", "1"]);
  assert.equal(m.code, 2);
  assert.match(m.err, /does not allow automated download[\s\S]*the user saves them by hand: strom task wait T… --images B…:1 --on/);
  assert.match((await w.ok(["fetch", "rucni", "--find", "Týnec"])).out, /Týnec N 1784–1820/, "finding books is fine");
  await w.ok(["repo", "add", "Archiv Čížkov", "--url", `${a.base}/`, "--automation", "forbidden"]);
  const f = await w.run(["fetch", "zkusebni", "5359", "--images", "1"]);
  assert.equal(f.code, 2);
  assert.match(f.err, /R0001 Archiv Čížkov is marked automation forbidden in this tree/);
  assert.equal(a.hits.filter((h) => h.startsWith("/img/")).length, 0);
  w.cleanup();
  await a.close();
});

test("the agent may improve an allowed connector — unless its code goes round strom: then every change needs a yes", opts, async () => {
  const { w, a, dir } = await world();
  await w.ok(["config", "set", "connectors.consent", "on"]);
  assert.equal((await w.run(["allow", "connector", "zkusebni"], { tty: true, answers: ["y", "y"] })).code, 0);
  // the agent works on it: still allowed, and the user can see it changed
  fs.appendFileSync(path.join(dir, "connector.ts"), "\n// handles the portal's second catalogue too\n");
  assert.equal((await w.run(["connector", "test", "zkusebni", "--find", "Týnec"])).code, 0);
  assert.match((await w.ok(["connector", "list"])).out, /zkusebni\s.*allowed \(changed since\)/);
  // code that reaches the network itself
  fs.appendFileSync(path.join(dir, "connector.ts"), "\nconst sneak = await fetch('https://elsewhere.example/');\n");
  const changed = await w.run(["connector", "test", "zkusebni", "--find", "Týnec"]);
  assert.equal(changed.code, 4);
  assert.match(changed.err, /changed since you allowed it/);
  assert.match((await w.ok(["connector", "show", "zkusebni"])).out, /⚠ reaches the network directly[\s\S]*connector\.ts:\d+ fetch\(\)/);
  const no = await w.run(["allow", "connector", "zkusebni"], { tty: true, answers: ["n"] });
  assert.match(no.out, /⚠ its code reaches the network or other programs directly[\s\S]*you will be asked again after every change/);
  assert.match(no.out, /not allowed — nothing changed/);
  assert.equal((await w.run(["allow", "connector", "zkusebni"], { tty: true, answers: ["y"] })).code, 0, "the user decides");
  fs.appendFileSync(path.join(dir, "connector.ts"), "\n// one more line\n");
  assert.equal((await w.run(["connector", "test", "zkusebni", "--find", "Týnec"])).code, 4, "exactly as it was allowed");
  // other ways round strom are seen too
  for (const [file, code] of [
    ["helper.mjs", 'import https from "node:https";\n'],
    ["pomoc.py", "import subprocess\n"],
    ["spust.py", "exec(kód)\n"],
    ["stahni.sh", "curl -o s0001.jpg https://elsewhere.example/1.jpg\n"],
    ["load.ts", "const m = await import(name);\n"],
  ]) {
    fs.writeFileSync(path.join(dir, file!), code!);
    assert.match((await w.ok(["connector", "show", "zkusebni"])).out, new RegExp(`${file!.replace(".", "\\.")}:1 `), file);
    fs.rmSync(path.join(dir, file!));
  }
  // what a word means in one language is not read into another: a regex's exec() in TypeScript, a fetch() of its own in Python
  fs.writeFileSync(path.join(dir, "rozbor.ts"), "export const nadpis = (html: string) => /<h1>(.*?)<\\/h1>/u.exec(html)?.[1];\n");
  fs.writeFileSync(path.join(dir, "pomoc.py"), "def fetch(kniha):\n    return re.compile('Žďár').search(kniha)\n");
  assert.doesNotMatch((await w.ok(["connector", "show", "zkusebni"])).out, /rozbor\.ts|pomoc\.py/);
  fs.rmSync(path.join(dir, "rozbor.ts"));
  fs.rmSync(path.join(dir, "pomoc.py"));
  fs.mkdirSync(path.join(dir, "node_modules"));
  assert.match((await w.ok(["connector", "show", "zkusebni"])).out, /node_modules\/ — libraries strom cannot check/);
  w.cleanup();
  await a.close();
});

test("a Node connector runs sandboxed: its own folder and the work folder, nothing else", opts, async () => {
  const { w, a, dir } = await world();
  program(
    dir,
    `import fs from "node:fs";
import path from "node:path";
import { done, log, request } from "./sdk.ts";
await request();
const tryIt = (what: string, f: () => void) => { try { f(); log(what + ": done"); } catch (e) { log(what + ": " + (e as { code?: string }).code); } };
tryIt("write outside", () => fs.writeFileSync(path.join(process.env.HOME!, "unikl.txt"), "x"));
tryIt("read outside", () => fs.readdirSync(process.env.HOME!));
tryIt("write inside", () => fs.writeFileSync(path.join(process.env.STROM_CONNECTOR_WORKDIR!, "tiles.txt"), "x"));
log("env: " + Object.keys(process.env).filter((k) => k.startsWith("STROM")).join(","));
done();
`,
  );
  const r = await w.ok(["connector", "test", "zkusebni", "--find", "x"]);
  assert.match(r.out, /write outside: ERR_ACCESS_DENIED/);
  assert.match(r.out, /read outside: ERR_ACCESS_DENIED/);
  assert.match(r.out, /write inside: done/);
  assert.match(r.out, /env: STROM_CONNECTOR_WORKDIR\n/, "nothing else of strom's environment");
  assert.equal(fs.existsSync(path.join(w.env.HOME!, "unikl.txt")), false);
  w.cleanup();
  await a.close();
});

test("connector add: from a folder, copied into the plugins folder under its name; remove deletes it", opts, async () => {
  const { w, a, dir } = await world();
  const outside = path.join(w.dir, "stažený konektor");
  fs.cpSync(dir, outside, { recursive: true });
  assert.equal((await w.run(["connector", "add", outside])).code, 4, "the user's");
  const named = await w.run(["connector", "add", outside], { tty: true, answers: ["y", "y"] });
  assert.equal(named.code, 0, named.err);
  assert.match(named.out, /connector stazeny-konektor allowed, installed in .*plugins\/connectors\/stazeny-konektor\nhosts allowed: 127\.0\.0\.1/, "a name made of the folder's");
  const r = await w.run(["connector", "add", outside, "--name", "stazeny"], { tty: true, answers: ["y"] });
  assert.equal(r.code, 0, r.err);
  assert.ok(fs.existsSync(path.join(pluginDir(w, "stazeny"), "connector.json")));
  assert.match((await w.ok(["connector", "test", "stazeny", "--find", "Týnec"])).out, /Týnec N 1784–1820/);
  assert.equal((await w.run(["connector", "add", outside, "--name", "Špatně"], { tty: true, answers: ["y"] })).code, 2);
  assert.equal((await w.run(["connector", "remove", "stazeny"])).code, 4, "the user's");
  assert.match((await w.ok(["connector", "remove", "stazeny"], { tty: true, answers: ["y"] })).out, /connector stazeny removed/);
  assert.equal(fs.existsSync(pluginDir(w, "stazeny")), false);
  assert.equal(readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "consents.json")).connectors.stazeny, undefined);
  w.cleanup();
  await a.close();
});

test("connector grep: the saved answers searched, each hit with the text round it — any case, any script, composed or not", opts, async () => {
  const { w, a, dir } = await world();
  const probe = path.join(dir, ".test", "probe");
  assert.match((await w.ok(["connector", "grep", "zkusebni", "anything"])).out, /nothing saved yet — strom connector probe zkusebni <url>/);
  fs.mkdirSync(probe, { recursive: true });
  const places = Array.from({ length: 30 }, (_, i) => `"Místo ${i}"`).join(", ");
  fs.writeFileSync(path.join(probe, "SearchPage"), `<html>\n<script>var tags = [${places}, "Žďár - obec Žďár", "Москва"];</script>\n<a href="../img/Kniha_03__005.jpg;jsessionid=X1">▼</a>\n</html>\n`);
  fs.writeFileSync(path.join(probe, "5"), `<a href="../img/Kniha_03__006.jpg">▼</a>\n<td>Kniha&nbsp;03</td><td>Kniha\n  03</td>\n`);
  fs.writeFileSync(path.join(probe, "s0001.jpg"), Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x4a, 0x70, 0x67, 0xff, 0xd9])); // "Jpg" inside, but an image
  const hit = await w.ok(["connector", "grep", "zkusebni", "ŽĎÁR", "--around", "12"]);
  assert.match(hit.out, /^2 hit\(s\) in 1 file\(s\) of .*\.test:$/m);
  assert.match(hit.out, /^probe\/SearchPage:2:372  \(2 hits\) …Místo 29", "Žďár - obec Žďár", "Москва"\]…$/m, "where it is, with the text round it");
  assert.equal((await w.ok(["connector", "grep", "zkusebni", "Žďár".normalize("NFD"), "--json"])).json.total, 2, "typed decomposed");
  assert.equal((await w.ok(["connector", "grep", "zkusebni", "москва", "--json"])).json.total, 1, "any script, any case");
  assert.equal((await w.ok(["connector", "grep", "zkusebni", " kniha 03 ", "--json"])).json.total, 2, "a space: any white space, &nbsp; too");
  const re = await w.ok(["connector", "grep", "zkusebni", "[^/\"]+\\.jpg", "--regex", "--json"]);
  assert.deepEqual(re.json.hits.map((h: { file: string; line: number; column: number }) => `${h.file}:${h.line}:${h.column}`), ["probe/5:1:17", "probe/SearchPage:3:17"], "images are not searched");
  assert.equal((await w.ok(["connector", "grep", "zkusebni", ".jpg", "--in", "5", "--json"])).json.total, 1);
  assert.equal((await w.ok(["connector", "grep", "zkusebni", ".jpg", "--in", "probe/5", "--json"])).json.total, 1);
  assert.equal((await w.run(["connector", "grep", "zkusebni", ".jpg", "--in", "6"])).code, 2);
  assert.equal((await w.run(["connector", "grep", "zkusebni", "[", "--regex"])).code, 2);
  const list = await w.ok(["connector", "grep", "zkusebni", "Místo", "--around", "8"]);
  assert.match(list.out, /^30 hit\(s\) in 1 file\(s\)/, "every hit counted");
  assert.match(list.out, /^probe\/SearchPage:2:22  \(30 hits\) …ags = \["Místo 0", "Místo 1"/m, "hits close together: one stretch of text");
  assert.ok(list.out.trim().split("\n").length < 10, list.out);
  assert.match((await w.ok(["connector", "grep", "zkusebni", "Místo", "--around", "0", "--limit", "10"])).out, /^… 20 more: strom connector grep zkusebni Místo --page 2$/m);
  // a page's characters as references, a script's as escapes: found as they read, shown as the file has them
  fs.writeFileSync(
    path.join(probe, "napoveda"),
    String.raw`<h2>Lze st&aacute;hnout sn&iacute;mek?</h2><p>jen prohl&iacute;že&#269;em - tla&#x10D;&iacute;tko</p><td>&#1050;&#1080;&#1111;&#1074;</td>` +
      "\n" + String.raw`<script>var v = Viewer(["https:\/\/img.example\/iip?f=Knížka_01.jp2"]);</script>` + "\n",
  );
  const read = await w.ok(["connector", "grep", "zkusebni", "stáhnout snímek", "--around", "4"]);
  assert.match(read.out, /^probe\/napoveda:1:9  …Lze st&aacute;hnout sn&iacute;mek\?<\/h…$/m, "found as it reads, shown as it is written");
  assert.equal((await w.ok(["connector", "grep", "zkusebni", "PROHLÍŽEČEM".normalize("NFD"), "--json"])).json.total, 1, "decomposed, any case");
  assert.equal((await w.ok(["connector", "grep", "zkusebni", "tlačítko", "--json"])).json.total, 1, "a reference by number");
  assert.equal((await w.ok(["connector", "grep", "zkusebni", "київ", "--json"])).json.total, 1, "any script");
  assert.equal((await w.ok(["connector", "grep", "zkusebni", "https://img.example/iip?f=Knížka", "--json"])).json.total, 1, "a script's escapes");
  assert.equal((await w.ok(["connector", "grep", "zkusebni", String.raw`https:\/\/img`, "--json"])).json.total, 1, "as the file has it: once, not twice");
  const jp2 = await w.ok(["connector", "grep", "zkusebni", String.raw`f=[^"]+\.jp2`, "--regex", "--json"]);
  assert.deepEqual(jp2.json.hits.map((h: { line: number; column: number }) => `${h.line}:${h.column}`), ["2:53"], "a pattern too, where the file has it");
  assert.match((await w.ok(["connector", "grep", "zkusebni", "Brno"])).out, /^not found in 3 saved file\(s\) of /);
  assert.deepEqual(a.hits, [], "nothing is requested");
  w.cleanup();
  await a.close();
});

test("connector probe: one request through strom while mapping a portal, the answer saved to read", opts, async () => {
  const { w, a, dir } = await world();
  const r = await w.ok(["connector", "probe", "zkusebni", `${a.base}/login`]);
  assert.match(r.out, new RegExp(`GET ${a.base}/login → 200 · no type · 6 B · after redirects ${a.base}/search-page`));
  assert.match(r.out, /saved: .*\.test\/probe\/search-page$/m);
  assert.equal(fs.readFileSync(path.join(dir, ".test", "probe", "search-page"), "utf8"), "<form>");
  const post = await w.ok(["connector", "probe", "zkusebni", `${a.base}/search`, "--method", "POST", "--body", "place=Lhota", "--header", "X-Requested-With: XMLHttpRequest", "--header", "Content-Type: application/x-www-form-urlencoded", "--save", "hledani.txt"]);
  assert.match(r.out, /^cookies kept for the next probe: SESSION \(--fresh starts without them\)$/m);
  assert.match(post.out, /POST .*\/search → 200/, "the session of the earlier probe, like one visit in a browser");
  assert.match(fs.readFileSync(path.join(dir, ".test", "probe", "hledani.txt"), "utf8"), /Lhota N 1784/);
  const fresh = await w.ok(["connector", "probe", "zkusebni", `${a.base}/search`, "--method", "POST", "--body", "place=Lhota", "--header", "X-Requested-With: XMLHttpRequest", "--header", "Content-Type: application/x-www-form-urlencoded", "--save", "bez-session.txt", "--fresh"]);
  assert.match(fresh.out, /POST .*\/search → 400/);
  assert.match(fs.readFileSync(path.join(dir, ".test", "probe", "bez-session.txt"), "utf8"), /no session: POST undefined/, "--fresh: a new session");
  const off = await w.run(["connector", "probe", "zkusebni", "https://elsewhere.example/app.js"]);
  assert.notEqual(off.code, 0);
  assert.match(off.err, /elsewhere\.example is not one of the hosts this connector may contact/);
  assert.equal((await w.run(["connector", "probe", "zkusebni", `${a.base}/x`, "--header", "bez dvojtečky"])).code, 2);
  assert.deepEqual(a.hits, ["/login", "/search-page", "/search", "/search"]);
  await w.ok(["connector", "test", "zkusebni", "--find", "Lhota"]);
  assert.ok(fs.existsSync(path.join(dir, ".test", "probe", "hledani.txt")), "a test starts afresh, but what probes saved stays");
  w.cleanup();
  await a.close();
});

test("a part of an image, sharper: one request, registered with its image — a view of that place uses it by itself", opts, async () => {
  const { w, a, dir } = await world();
  const manifest = path.join(dir, "connector.json");
  const m = readJsonFile(manifest);
  // it cannot yet: the user hears how to save the part by hand
  await w.ok(["recordset", "add", "Týnec N 1784–1820", "--kinds", "baptism"]); // B0001
  const cannot = await w.run(["fetch", "zkusebni", "5359", "--recordset", "B1", "--images", "1", "--crop", "0.5,0,0.5,0.5"]);
  assert.equal(cannot.code, 2);
  assert.match(cannot.err, /connector zkusebni fetches whole images only \(it cannot: part\)[\s\S]*zoomed in on it in the portal's viewer/);
  fs.writeFileSync(manifest, JSON.stringify({ ...m, can: [...m.can, "part"] }));
  const code = fs.readFileSync(path.join(dir, "connector.ts"), "utf8").replace(
    "} else if (BASE) {",
    `} else if (req.cmd === "part") {
  const r = req.region;
  const url = BASE + "/part/" + req.book + "/" + req.image + ".jpg?r=" + [r.x, r.y, r.w, r.h].join(",");
  const got = await get(url, { save: "p" + req.image + ".jpg" });
  if (got.status !== 200) fail("part: HTTP " + got.status);
  image(req.image, "p" + req.image + ".jpg", url);
} else if (BASE) {`,
  );
  program(dir, code);
  // which book? none of its images came through the connector yet
  const which = await w.run(["fetch", "zkusebni", "--recordset", "B1", "--images", "1", "--crop", "0.5,0,0.5,0.5"]);
  assert.equal(which.code, 2);
  assert.match(which.err, /which book of zkusebni\? none of the images of B0001 came through it/);
  await w.ok(["fetch", "zkusebni", "5359", "--images", "1-2", "--recordset", "B1"]); // M0001, M0002 — 400×300
  assert.deepEqual((await w.ok(["media", "show", "B1:1", "--json"])).json.media.fetched, { connector: "zkusebni", book: "5359" });
  // too small to read: the view says how to fetch that place sharper
  const small = await w.ok(["media", "view", "B1:1", "--crop", "0.6,0.1,0.3,0.3"]);
  assert.match(small.out, /enlarged from 120×90 px of the scan[\s\S]*this part sharper from the archive \(one request\): strom fetch zkusebni --recordset B0001 --images 1 --crop 0\.6,0\.1,0\.3,0\.3/);
  assert.equal((await w.run(["fetch", "zkusebni", "--recordset", "B1", "--images", "1-2", "--crop", "0.5,0,0.5,0.5"])).code, 2, "a part is of one image");
  assert.equal((await w.run(["fetch", "zkusebni", "--recordset", "B1", "--images", "1", "--crop", "0,0,1,1"])).code, 2, "that is the whole image");
  assert.equal((await w.run(["fetch", "zkusebni", "--recordset", "B1", "--images", "1", "--half", "middle"])).code, 2);
  const dry = await w.ok(["fetch", "zkusebni", "--recordset", "B1", "--images", "1", "--half", "right", "--crop", "0,0,1,0.5", "--dry-run"]);
  assert.match(dry.out, /would fetch part 0\.5,0,0\.5,0\.5 of image 1 of book 5359 as a part of B0001:1 through zkusebni/);
  a.hits.length = 0;
  // the upper right quarter: --half right, and its upper half
  const r = await w.ok(["fetch", "zkusebni", "--recordset", "B1", "--images", "1", "--half", "right", "--crop", "0,0,1,0.5"]);
  assert.deepEqual(a.hits, ["/part/5359/1.jpg?r=0.5,0,0.5,0.5"], "one request, for the part asked");
  assert.match(r.out, /part: 1 request\(s\)/);
  assert.match(r.out, /part 0\.5,0,0\.5,0\.5 of image 1 of B0001 fetched and registered: M0003 · 400×300 px · 2\.0× the detail of the whole image/);
  assert.match(r.out, /look at it: strom media view B0001:1 --crop 0\.5,0,0\.5,0\.5/);
  // the image is still the whole image; the part is with it
  const show = (await w.ok(["media", "show", "B1:1", "--json"])).json;
  assert.equal(show.media.id, "M0001");
  assert.deepEqual(show.parts, ["M0003"]);
  assert.match((await w.ok(["media", "show", "M3"])).out, /M0003 part 0\.5,0,0\.5,0\.5 of image 1 of B0001/);
  assert.match((await w.ok(["media", "list"])).out, /M0001\s+B0001:1\s+400×300[\s\S]*M0003\s+B0001:1\s+part 0\.5,0,0\.5,0\.5\s+400×300[\s\S]*M0002\s+B0001:2/);
  // the same place, looked at again: from the part, with twice the pixels
  const sharp = await w.ok(["media", "view", "B1:1", "--crop", "0.6,0.1,0.3,0.3", "--json"]);
  assert.equal(sharp.json.from, "M0003");
  assert.deepEqual(sharp.json.region, { x: 80, y: 60, w: 240, h: 180 }, "the place, in the part's pixels");
  assert.match((await w.ok(["media", "view", "B1:1", "--crop", "0.6,0.1,0.3,0.3"])).out, /from M0003, a part of the image fetched sharper \(2\.0× the detail of the whole image\)/);
  // a place outside the part: the whole image
  assert.equal((await w.ok(["media", "view", "B1:1", "--crop", "0.1,0.5,0.3,0.3", "--json"])).json.from, undefined);
  // again: registered already, nothing asked for; the whole image is not "registered" by its part
  assert.match((await w.ok(["fetch", "zkusebni", "--recordset", "B1", "--images", "1", "--crop", "0.5,0,0.5,0.5"])).out, /is registered already: M0003 — nothing fetched/);
  assert.equal(a.hits.length, 1);
  assert.match((await w.ok(["fetch", "zkusebni", "5359", "--images", "1", "--recordset", "B1"])).out, /images 1 of B0001 are registered already/);
  // tried while building it
  const t = await w.ok(["connector", "test", "zkusebni", "--fetch", "5359", "--images", "2", "--crop", "0,0.5,0.5,0.5"]);
  assert.match(t.out, /images \(1\): 2 part 0,0\.5,0\.5,0\.5=p2\.jpg \d+ B/);
  // a portal whose sharpest is the whole scan: its "part" is the image registered already — no clash, nothing new
  program(dir, code.replace('const url = BASE + "/part/"', 'const url = BASE + "/img/"').replace('url);\n} else if (BASE)', 'url, undefined, { x: 0, y: 0, w: 1, h: 1 });\n} else if (BASE)'));
  const whole = await w.ok(["fetch", "zkusebni", "--recordset", "B1", "--images", "2", "--crop", "0,0,0.5,0.5"]);
  assert.match(whole.out, /the portal's sharpest of image 2 is the whole scan, registered already: M0002 · 400×300 px — no part needed\nlook at it: strom media view B0001:2 --crop 0,0,0\.5,0\.5/);
  assert.doesNotMatch(whole.out, /⚠/);
  // a connector that gives another image than the one asked for is stopped
  program(dir, code.replace('image(req.image, "p"', 'image(req.image + 1, "p"'));
  const wrong = await w.run(["fetch", "zkusebni", "--recordset", "B1", "--images", "2", "--crop", "0,0,0.5,0.5"]);
  assert.match(wrong.out, /stopped: asked for a part of image 2, it gave image 3/);
  assert.equal((await w.ok(["media", "list", "--json"])).json.total, 3, "nothing registered");
  w.cleanup();
  await a.close();
});

test("the user's login: typed in by them alone, put into requests by strom — never seen by the connector, never sent elsewhere", opts, async () => {
  const { w, a, dir } = await world();
  const echo = http.createServer((req, res) => res.end(`key ${req.headers["x-api-key"] ?? "none"}`));
  await new Promise<void>((r) => echo.listen(0, "127.0.0.1", r));
  echo.unref();
  const echoPort = (echo.address() as AddressInfo).port;
  const manifest = path.join(dir, "connector.json");
  const m = readJsonFile(manifest);
  m.login = { about: "Členové vidí snímky v plné velikosti", url: `${a.base}/registrace`, fields: { user: "Uživatel", password: "Heslo", key: "Klíč k API" } };
  fs.writeFileSync(manifest, JSON.stringify(m));
  program(
    dir,
    `import { done, fail, get, log, login, post, request } from "./sdk.ts";
const BASE = ${JSON.stringify(a.base)};
const req = await request();
if (req.cmd !== "find") fail("find only");
log("login: " + (req.login ? "yes" : "no"));
if (req.login && req.place === "jinam") await post(BASE.replace("127.0.0.1", "localhost") + "/signin", { pass: login("password") });
else if (req.login && req.place === "hlavicka") await get(BASE + "/echo", { headers: { "X-Api-Key": login("password") } });
else if (req.login) {
  const r = await post(BASE + "/signin", { name: login("user"), pass: login("password"), remember: "1" });
  log("signed in: " + r.status + " " + r.text);
  log("whoami: " + (await get(BASE + "/whoami")).text);
  log("echo: " + (await get(BASE + "/echo", { headers: { "X-Api-Key": login("key") } })).text);
  log("hop: " + (await get(BASE + "/hop?port=${echoPort}", { headers: { "X-Api-Key": login("key") } })).text);
}
done();
`,
  );
  // none saved: it runs without one
  const before = await w.ok(["connector", "test", "zkusebni", "--find", "Týnec"]);
  assert.match(before.err, /login: no/);
  assert.match(before.out, /without a login \(the user may save one: strom login zkusebni\)/);
  assert.match((await w.ok(["connector", "show", "zkusebni"])).out, /login {6}none — the user may save one: strom login zkusebni — Členové vidí snímky v plné velikosti/);
  // an agent cannot type it in, not even in a terminal; nor can a script
  const agent = new World();
  Object.assign(agent.env, w.env, { CLAUDECODE: "1" });
  agent.cwd = w.cwd;
  const refused = await agent.run(["login", "zkusebni"], { tty: true, answers: ["Jana", "x"] });
  assert.equal(refused.code, 4);
  assert.match(refused.err, /Save your login to Testovací archiv for connector zkusebni\? \(an agent cannot answer this\)[\s\S]*strom login zkusebni/);
  assert.equal((await w.run(["login", "zkusebni"])).code, 4);
  // the user, in their terminal: what it is for and where it goes, then the fields
  const secret = "tajné heslo Ž&<x>";
  const saved = await w.run(["login", "zkusebni"], { tty: true, answers: ["Jana Nováková", secret, "k-4711-abcd"] });
  assert.equal(saved.code, 0, saved.err);
  assert.match(saved.out, /Your login to Testovací archiv, for connector zkusebni[\s\S]*what it gives: Členové vidí[\s\S]*kept on this computer only[\s\S]*only to 127\.0\.0\.1 and only over https[\s\S]*Heslo \(not shown\):[\s\S]*login for zkusebni saved/);
  assert.doesNotMatch(saved.out, /tajné/);
  const file = path.join(w.env.STROM_CONFIG_DIR!, "logins.json");
  if (process.platform !== "win32") assert.equal(fs.statSync(file).mode & 0o777, 0o600, "readable by the user alone");
  const inFiles = (root: string): string[] =>
    fs.readdirSync(root, { recursive: true, withFileTypes: true }).filter((e) => e.isFile() && fs.readFileSync(path.join(e.parentPath, e.name)).includes("tajné")).map((e) => e.name);
  assert.deepEqual([...inFiles(w.cwd), ...inFiles(path.join(w.home, "shared"))], [], "never in a tree or the shared folder");
  assert.match((await w.ok(["login"])).out, /zkusebni {2}saved \d{4}-\d\d-\d\d \(user, password, key\) — Členové/);
  // the change the user asked for: the host list grows after the login was saved
  fs.writeFileSync(manifest, JSON.stringify({ ...m, hosts: ["127.0.0.1", "localhost"] }));
  // with it: strom puts it in; what comes back has the password taken out
  const t = await w.ok(["connector", "test", "zkusebni", "--find", "Týnec"]);
  assert.match(t.err, /login: yes/);
  assert.match(t.out, /with the user's login/);
  assert.deepEqual(a.signins.at(-1), { name: "Jana Nováková", pass: secret, remember: "1" });
  assert.match(t.err, /signed in: 200 Vítejte Jana Nováková, heslo: \[login\]/, "the user's name is no secret");
  assert.match(t.err, /whoami: member MEMBER=1 · \[login\]/);
  assert.match(t.err, /echo: key \[login\]/, "a header too — and out of the answer");
  assert.match(t.err, /hop: key none/, "not sent on to another address");
  assert.doesNotMatch(t.out + t.err, /tajn|%C3%A9|&amp;&lt;|k-4711/);
  // a value a header cannot carry: said so, and the archive is not taken for silent
  const header = await w.run(["connector", "test", "zkusebni", "--find", "hlavicka"]);
  assert.match(header.out, /stopped: the login cannot go in the header X-Api-Key: it has letters a header cannot carry — send it in a form/);
  assert.doesNotMatch((await w.ok(["connector", "show", "zkusebni"])).out, /refused us|left alone/);
  // a host it was not saved for: refused before anything is sent
  const signins = a.signins.length;
  const other = await w.run(["connector", "test", "zkusebni", "--find", "jinam"]);
  assert.match(other.out, /stopped: the login was saved for 127\.0\.0\.1, not for localhost — the user saves it again for the connector as it is now: strom login zkusebni/);
  assert.equal(a.signins.length, signins);
  // it needs one: a run without it asks the user for it
  assert.match((await w.ok(["login", "zkusebni", "--remove"], { tty: true })).out, /the login for zkusebni is forgotten/);
  fs.writeFileSync(manifest, JSON.stringify({ ...m, login: { ...m.login, required: true } }));
  const need = await w.run(["connector", "test", "zkusebni", "--find", "Týnec"]);
  assert.equal(need.code, 4);
  assert.match(need.err, /Connector zkusebni needs your login to Testovací archiv[\s\S]*strom login zkusebni/);
  // its agent may not run it either
  assert.ok(readJsonFile(path.join(w.cwd, ".claude", "settings.json")).permissions.deny.includes("Bash(strom login:*)"));
  w.cleanup();
  agent.cleanup();
  echo.close();
  await a.close();
});

/**
 * The script strom gives the agent, run as a browser tab would run it: on the page's site, fetching from the
 * archive, each image "downloaded" into the folder under its name — except those Chrome blocks (a site's
 * second download, until the user allows it). The pauses it waits are recorded, not slept.
 */
async function runInTab(script: string, origin: string, downloads: string, opts: { blocked?: number[]; twice?: number[]; cookie?: string } = {}): Promise<{ line: string; waits: number[] }> {
  const waits: number[] = [];
  const saves: Promise<void>[] = [];
  const blobs = new Map<string, Blob>();
  let clicks = 0;
  const document = {
    body: { appendChild: () => undefined },
    createElement: () => {
      const a = {
        href: "",
        download: "",
        remove: () => undefined,
        click: () => {
          clicks++;
          const n = Number(/-(\d{4})(?:-part)?\./.exec(a.download)?.[1]);
          if (opts.blocked?.includes(n)) return;
          const blob = blobs.get(a.href)!;
          const write = async (name: string) => fs.writeFileSync(path.join(downloads, name), Buffer.from(await blob.arrayBuffer()));
          saves.push(write(a.download));
          if (opts.twice?.includes(n)) saves.push(write(a.download.replace(/(\.\w+)$/, " (1)$1")));
        },
      };
      return a;
    },
  };
  const URLs = { createObjectURL: (b: Blob) => (blobs.set(`blob:${blobs.size}`, b), `blob:${blobs.size - 1}`), revokeObjectURL: () => undefined };
  const later = (f: () => void, ms: number) => (waits.push(ms), ms >= 60000 ? undefined : f());
  const AsyncFunction = Object.getPrototypeOf(async () => undefined).constructor;
  const tab = new AsyncFunction("location", "fetch", "document", "URL", "setTimeout", `return ${script}`);
  // the browser sends its cookies (the check the user passed) with the tab's requests
  const browserFetch = (u: string, init: RequestInit = {}) => fetch(u, { ...init, headers: { ...(init.headers as Record<string, string>), ...(opts.cookie ? { cookie: opts.cookie } : {}) } });
  const line = await tab({ origin }, browserFetch, document, URLs, later);
  await Promise.all(saves);
  assert.ok(clicks > 0 || /^strom:/.test(line), line);
  return { line, waits: waits.filter((w) => w < 60000) };
}

test("through the browser: the connector says where the images are, strom plans and paces the browser's requests, then takes the files over", opts, async () => {
  const { w, a, dir } = await world();
  const manifest = path.join(dir, "connector.json");
  const m = readJsonFile(manifest);
  fs.writeFileSync(manifest, JSON.stringify({ ...m, can: [...m.can, "locate"], routes: ["direct", "browser"], policy: { automation: "allowed", pace: { minIntervalMs: 5000 } } }));
  // the choice is the user's — their agent may make it when they ask; it shows where it came from
  assert.match((await w.ok(["connector", "show", "zkusebni"])).out, /images {5}directly, through strom · can also: browser \(strom connector use zkusebni --via browser\)/);
  assert.equal((await w.run(["connector", "use", "zkusebni", "--via", "carrier-pigeon"])).code, 2);
  const use = await w.ok(["connector", "use", "zkusebni", "--via", "browser"]);
  assert.match(use.out, /zkusebni: images through your browser from now on \(127\.0\.0\.1\)[\s\S]*Chrome asks whether 127\.0\.0\.1 may download several files: allow it once/);
  assert.match((await w.ok(["connector", "show", "zkusebni"])).out, /images {5}through your browser \(chosen \d{4}-\d\d-\d\d by a command without a terminal \(an agent or the app\)\) · can also: direct/);
  const downloads = path.join(w.dir, "Stažené soubory");
  fs.mkdirSync(downloads);
  await w.ok(["config", "set", "browser.downloads", downloads]);
  await w.ok(["recordset", "add", "Týnec N 1784–1820", "--kinds", "baptism", "--url", `${a.base}/book/5359`]); // B0001
  await w.ok(["research", "new", "X", "--new-person", "Jan /Novák/"]);
  await w.ok(["task", "add", "Křest", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]); // T1
  await w.ok(["task", "wait", "T1", "--on", "images 1–3 of B0001"]);
  assert.match((await w.ok(["fetch", "zkusebni", "5359", "--images", "1-3", "--recordset", "B1", "--dry-run"])).out, /dry run: would fetch images 1–3 of book 5359 as images of B0001 through zkusebni, in your browser/);
  assert.deepEqual([...a.hits], [], "a dry run never contacts the archive");

  // the plan: the connector located the images (its book page, through strom); no image was fetched by strom
  const plan = await w.ok(["fetch", "zkusebni", "5359", "--images", "1-3", "--recordset", "B1", "--json"]);
  assert.deepEqual([...a.hits], ["/book/5359"], "only the book's page — the images are the browser's to fetch");
  const p = plan.json;
  assert.equal(p.plan.items.length, 3);
  assert.deepEqual(p.plan.items.map((i: { file: string }) => i.file), ["strom-zkusebni-5359-0001", "strom-zkusebni-5359-0002", "strom-zkusebni-5359-0003"]);
  assert.equal(p.plan.open, `${a.base}/robots.txt`, "a light page of the images' site");
  // the limiter reserved a time for each request of the browser: opening the page, then each image, 5 s apart
  const at = p.plan.items.map((i: { at: string }) => Date.parse(i.at));
  assert.ok(at.every((t: number, i: number) => i === 0 || t - at[i - 1] === 5000), at.join(","));
  const state = readJsonFile(path.join(w.home, "shared", "net", "127.0.0.1.json"));
  assert.equal(state.last, at[2], "strom's own requests to the archive wait until the browser's are over");
  const text = (await w.ok(["fetch", "zkusebni", "5359", "--images", "1-3", "--recordset", "B1", "--dry-run"])).out;
  assert.match(text, /through zkusebni, in your browser/);

  // the tab runs the script: Chrome saves image 1 and 2 (2 twice, as it does when the name is taken), blocks 3
  const tab = await runInTab(p.script, a.base, downloads, { blocked: [3], twice: [2] });
  assert.match(tab.line, /^strom-result 1:200:\d+ 2:200:\d+ 3:200:\d+$/);
  assert.ok(tab.waits.length >= 2 && tab.waits.every((ms) => ms > 0), "it waits for its times");
  assert.equal(a.hits.filter((h) => h.startsWith("/img/")).length, 3);
  const took = await w.ok(["fetch", "zkusebni", "--take", "--result", tab.line]);
  assert.match(took.out, /2 image\(s\) taken over from .*Stažené soubory: registered M0001 M0002/);
  assert.match(took.out, /images 3: the browser fetched them but saved nothing here — Chrome lets a site download one file until the user allows automatic downloads/);
  assert.match(took.out, /strom fetch zkusebni 5359 --images 3 --recordset B0001/);
  assert.match(took.out, /back in the queue \(they waited for these images\): T0001/);
  assert.deepEqual(fs.readdirSync(downloads), [], "what strom took over, and the second copy, are gone from the downloads folder");
  const m1 = (await w.ok(["media", "show", "B1:1", "--json"])).json.media;
  assert.deepEqual(m1.fetched, { connector: "zkusebni", book: "5359", via: "browser" });
  assert.equal(m1.from, "connector zkusebni · your browser · strom-zkusebni-5359-0001.jpg");
  assert.equal(m1.url, `${a.base}/book/5359?image=1`);
  assert.equal((await w.run(["check"])).code, 0, "the evidence is sound");

  // image 3 planned again: the old plan of it is replaced, not doubled; a broken download is not a scan
  const again = (await w.ok(["fetch", "zkusebni", "5359", "--images", "1-3", "--recordset", "B1", "--json"])).json;
  assert.deepEqual(again.plan.items.map((i: { n: number }) => i.n), [3], "what is registered is not planned again");
  fs.writeFileSync(path.join(downloads, "strom-zkusebni-5359-0003.jpg"), "<!DOCTYPE html><html><body>Too many requests — please try again later.</body></html>");
  const broken = await w.run(["fetch", "zkusebni", "--take"]);
  assert.equal(broken.code, 1);
  assert.match(broken.out, /image 3 \(strom-zkusebni-5359-0003\.jpg\): not an image .* removed; plan it again/);
  assert.deepEqual(fs.readdirSync(downloads), []);

  // the archive refused the browser: strom leaves it alone as if it had refused strom
  const refused = await w.run(["fetch", "zkusebni", "--take", "--result", "strom-result 3:403"]);
  assert.match(refused.out, /127\.0\.0\.1: it refused the browser \(HTTP 403 at .*\) — strom leaves it alone until/);
  const hits = a.hits.length;
  const next = await w.run(["fetch", "zkusebni", "5359", "--images", "3", "--recordset", "B1"]);
  assert.equal(next.code, 1);
  assert.match(next.out, /stopped: 127\.0\.0\.1: it refused the browser \(HTTP 403 .*\) — left alone until[\s\S]*nothing planned/);
  assert.equal(a.hits.length, hits, "nothing goes to an archive that refused — not even the connector's page");
  await w.ok(["allow", "host", "127.0.0.1", "--unblock"], { tty: true, answers: ["y"] });

  // back to direct: strom fetches it itself
  await w.ok(["connector", "use", "zkusebni", "--via", "direct"]);
  assert.match((await w.ok(["fetch", "zkusebni", "5359", "--images", "3", "--recordset", "B1"])).out, /1 image\(s\) of B0001 \(images 3–3\) fetched and registered/);
  w.cleanup();
  await a.close();
});

test("a portal behind a bot check: the user passes it in their browser, strom plans every page there and gives it to the connector", opts, async () => {
  const { w, a, dir } = await world();
  const manifest = path.join(dir, "connector.json");
  const m = readJsonFile(manifest);
  const G = `${a.base}/g`;
  program(
    dir,
    `import { book, done, fail, get, located, request } from "./sdk.ts";
const G = ${JSON.stringify(G)};
const req = await request();
if (req.cmd === "find") {
  for (let page = 1; ; page++) {
    const got = JSON.parse((await get(G + "/catalog?place=" + encodeURIComponent(req.place) + "&page=" + page)).text!);
    for (const b of got.books) book(b);
    if (!got.next) break;
  }
} else if (req.cmd === "list") {
  const got = await get(G + "/book/" + req.book);
  if (got.status !== 200) fail("book " + req.book + ": HTTP " + got.status);
  book(JSON.parse(got.text!));
} else if (req.cmd === "locate") {
  await get(G + "/book/" + req.book, { headers: { Referer: G + "/", "X-Requested-With": "XMLHttpRequest" } });
  for (const n of req.images) located(n, G + "/img/" + req.book + "/" + n + ".jpg", G + "/view/" + n);
} else fail("no");
done();
`,
  );
  // mapping it, strom meets the check: it says what it is and what to do
  const probe = await w.ok(["connector", "probe", "zkusebni", `${G}/catalog?place=T%C3%BDnec`]);
  assert.match(probe.out, /⚠ this is Imperva \(Incapsula\)'s check whether a person is there, not the page: the portal gives its pages to a real browser only[\s\S]*"browser": \{"pages": true\}[\s\S]*the user passes the check in their own browser, never you/);
  const direct = await w.run(["connector", "test", "zkusebni", "--find", "Týnec"]);
  assert.match(direct.err, /answered with Imperva \(Incapsula\)'s check whether a person is there, not the page/);
  // pages through the browser: the browser route alone, and no login of the connector's own
  fs.writeFileSync(manifest, JSON.stringify({ ...m, can: ["find", "list", "locate"], routes: ["direct", "browser"], browser: { pages: true }, policy: { automation: "allowed", pace: { minIntervalMs: 5000 } } }));
  assert.match((await w.ok(["connector", "list"])).out, /browser\.pages: every request goes through the browser — routes must be \["browser"\] alone/);
  fs.writeFileSync(manifest, JSON.stringify({ ...m, can: ["find", "list", "locate"], routes: ["browser"], browser: { pages: true }, policy: { automation: "allowed", pace: { minIntervalMs: 5000 } } }));
  const downloads = path.join(w.dir, "Stažené");
  fs.mkdirSync(downloads);
  await w.ok(["config", "set", "browser.downloads", downloads]);
  a.hits.length = 0;

  // find: the first page, planned in the limiter — nothing asked by strom itself
  const one = await w.ok(["fetch", "zkusebni", "--find", "Týnec", "--json"]);
  assert.deepEqual([...a.hits], [], "strom asks the portal nothing itself");
  assert.equal(one.json.plan.pages.length, 1);
  assert.match(one.json.plan.pages[0].url, /\/g\/catalog\?place=T%C3%BDnec&page=1$/);
  const text = (await w.run(["fetch", "zkusebni", "--find", "Týnec"])).out;
  assert.match(text, /browser plan: 1 page of 127\.0\.0\.1 for strom fetch zkusebni \(find\) — the portal answers a real browser only/);
  assert.match(text, /check whether a person is there \(a box to tick, a puzzle\)[\s\S]*stop and ask the user — that is theirs to do, never yours/);
  const again = (await w.ok(["fetch", "zkusebni", "--find", "Týnec", "--json"])).json;
  // the check, not the page: not taken, the user passes it
  const blocked = await runInTab(again.script, a.base, downloads);
  assert.match(blocked.line, /^strom-result p[0-9a-f]{16}:200:\d+$/);
  const notYet = await w.run(["fetch", "zkusebni", "--take", "--result", blocked.line]);
  assert.equal(notYet.code, 1);
  assert.match(notYet.out, /gave its check whether a person is there \(Imperva \(Incapsula\)\) instead of the page: the user passes it in that tab — never you — then run the same script again/);
  assert.deepEqual(fs.readdirSync(downloads), [], "what the browser saved is strom's to remove");
  // passed: the page is taken, the connector goes on — and asks for its next page
  const first = await runInTab(again.script, a.base, downloads, { cookie: "passed=1" });
  const t1 = await w.ok(["fetch", "zkusebni", "--take", "--result", first.line, "--json"]);
  assert.match(t1.json.taken[0], /^GET .*page=1 → 200/);
  assert.match(t1.json.then.plan.pages[0].url, /page=2$/, "the next page, planned");
  const second = await runInTab(t1.json.then.script, a.base, downloads, { cookie: "passed=1" });
  const t2 = await w.ok(["fetch", "zkusebni", "--take", "--result", second.line]);
  assert.match(t2.out, /find \(\d+ s\): 0 request\(s\) \+ 2 page\(s\) your browser got/);
  assert.match(t2.out, /books \(2\):[\s\S]*5359[\s\S]*5360/);
  // what the browser got is there to read while the connector is built
  assert.ok(fs.readdirSync(path.join(dir, ".test", "probe", "browser")).some((f) => /^catalog-[0-9a-f]{16}\.json$/.test(f)));
  assert.match((await w.ok(["connector", "grep", "zkusebni", "Týnec Z"])).out, /Týnec Z 1784–1820/);
  // the same again: from the pages the browser got, nothing planned
  assert.match((await w.ok(["fetch", "zkusebni", "--find", "Týnec"])).out, /books \(2\)/);

  // images: the book's page first, then the images, both in the browser
  await w.ok(["recordset", "add", "Týnec N 1784–1820", "--kinds", "baptism"]); // B0001
  const loc = (await w.ok(["fetch", "zkusebni", "5359", "--images", "1-2", "--recordset", "B1", "--json"])).json;
  assert.match(loc.plan.pages[0].url, /\/g\/book\/5359$/);
  assert.match(loc.script, /"headers":\{"X-Requested-With":"XMLHttpRequest"\}/, "only the headers a page's script may send");
  assert.match(loc.script, /"ref":"http:\/\/127\.0\.0\.1:\d+\/g\/"/, "the Referer as the tab's referrer");
  const bookPage = await runInTab(loc.script, a.base, downloads, { cookie: "passed=1" });
  const images = await w.ok(["fetch", "zkusebni", "--take", "--result", bookPage.line, "--json"]);
  assert.equal(images.json.then.plan.items.length, 2, "then the images, planned as ever");
  const tab = await runInTab(images.json.then.script, a.base, downloads, { cookie: "passed=1" });
  // a page planned and never fetched (a run given up) does not hold back the images the browser saved
  await w.ok(["fetch", "zkusebni", "--find", "Lhota"]);
  const got = await w.ok(["fetch", "zkusebni", "--take"]);
  assert.match(got.out, /2 image\(s\) taken over from .*: registered M0001 M0002/);
  assert.deepEqual(a.hits.filter((h) => h.startsWith("/g/")).sort(), ["/g/book/5359", "/g/catalog", "/g/catalog", "/g/catalog", "/g/img/5359/1.jpg", "/g/img/5359/2.jpg"].sort());

  // a refusal in the browser: the archive is left alone, as if strom had got it
  const no = (await w.ok(["fetch", "zkusebni", "zakazana", "--list", "--json"])).json;
  const refused = await runInTab(no.script, a.base, downloads, { cookie: "passed=1" });
  assert.match(refused.line, /:403:/);
  const r = await w.run(["fetch", "zkusebni", "--take", "--result", refused.line]);
  assert.match(r.out, /127\.0\.0\.1/);
  const later = await w.run(["fetch", "zkusebni", "--find", "Lhota"]);
  assert.equal(later.code, 1);
  assert.match(later.out, /nothing planned: 127\.0\.0\.1: .*left alone until/);
  w.cleanup();
  await a.close();
});

test("the browser route in the manifest: needs locate; a portal whose terms forbid automation stays manual in the browser too", opts, async () => {
  const { w, a, dir } = await world();
  const manifest = path.join(dir, "connector.json");
  const m = readJsonFile(manifest);
  fs.writeFileSync(manifest, JSON.stringify({ ...m, routes: ["browser"] }));
  assert.match((await w.ok(["connector", "list"])).out, /zkusebni {2}⚠ cannot run: connector\.json: routes "browser": the connector says where the images are — add "locate" to can/);
  fs.writeFileSync(manifest, JSON.stringify({ ...m, can: [...m.can, "locate"], routes: ["browser"], browser: { open: "https://elsewhere.example.org/login" } }));
  assert.match((await w.ok(["connector", "list"])).out, /browser\.open: a page on one of its hosts/);
  fs.writeFileSync(manifest, JSON.stringify({ ...m, can: [...m.can, "locate"], routes: ["browser"], browser: { open: `${a.base}/login` } }));
  // browser only: it cannot go direct, and it is used through the browser without being chosen
  assert.match((await w.run(["connector", "use", "zkusebni", "--via", "direct"])).err, /cannot fetch directly — only through the browser/);
  assert.match((await w.ok(["connector", "show", "zkusebni"])).out, /images {5}through your browser$/m);
  const plan = (await w.ok(["fetch", "zkusebni", "5359", "--images", "1", "--json"])).json;
  assert.equal(plan.plan.open, `${a.base}/login`, "the page the connector names, where the user logs in");
  // without a record set, what the browser downloaded goes into the inbox, a folder for the book
  const downloads = path.join(w.env.HOME!, "Downloads");
  fs.mkdirSync(downloads, { recursive: true });
  const tab = await runInTab(plan.script, a.base, downloads);
  assert.match((await w.ok(["fetch", "zkusebni", "--take", "--result", tab.line])).out, /1 image\(s\) taken over from .* into the inbox: zkusebni 5359\/ — register them: strom media add --inbox "zkusebni 5359" --recordset B…/);
  assert.deepEqual(fs.readdirSync(path.join(w.home, "shared", "inbox", "zkusebni 5359")), ["s0001.jpg"]);
  assert.match((await w.ok(["fetch", "zkusebni", "--take"])).out, /nothing of zkusebni waits to be taken over/);
  // a test says where the images are, fetching none
  const images = () => a.hits.filter((h) => h.startsWith("/img/")).length;
  const shown = images();
  const t = await w.ok(["connector", "test", "zkusebni", "--locate", "5359", "--images", "1-2"]);
  assert.match(t.out, /located \(2\):\n {2}1 {2}http:\/\/127\.0\.0\.1:\d+\/img\/5359\/1\.jpg\n {7}page http:\/\/127\.0\.0\.1:\d+\/book\/5359\?image=1/);
  assert.equal(images(), shown, "nothing downloaded");
  // manual: not through the browser either
  fs.writeFileSync(manifest, JSON.stringify({ ...m, can: [...m.can, "locate"], routes: ["direct", "browser"], policy: { automation: "manual" } }));
  assert.match((await w.run(["connector", "use", "zkusebni", "--via", "browser"])).err, /does not allow automated download .* through the browser neither/);
  w.cleanup();
  await a.close();
});

test("the agent's permissions: browser tools only for the sites of connectors set to the browser; full is the user's alone", opts, async () => {
  const { w, a, dir } = await world();
  const settings = async () => {
    await w.ok(["agents", "sync"]);
    return readJsonFile(path.join(w.cwd, ".claude", "settings.json")).permissions;
  };
  const before = await settings();
  assert.ok(!before.allow.some((r: string) => r.startsWith("mcp__claude-in-chrome")), "no browser without a connector that uses it");
  assert.ok(before.deny.includes("mcp__claude-in-chrome__file_upload"), "never a file of this computer uploaded to a site");
  assert.ok(before.deny.some((r: string) => /^Read\(.*\/Downloads\/\*\*\)$/.test(r)), "the downloads folder is the user's");
  const m = readJsonFile(path.join(dir, "connector.json"));
  fs.writeFileSync(path.join(dir, "connector.json"), JSON.stringify({ ...m, can: [...m.can, "locate"], routes: ["direct", "browser"] }));
  await w.ok(["connector", "use", "zkusebni", "--via", "browser"]);
  // The plugins folder is every tree's: browser tools only where the research works with that archive.
  assert.ok(!(await settings()).allow.some((r: string) => r.startsWith("mcp__claude-in-chrome")), "this tree has nothing of that archive yet");
  w.env.CLAUDECODE = "1";
  const noTools = await w.run(["fetch", "zkusebni", "--find", "Týnec"]);
  delete w.env.CLAUDECODE;
  assert.notEqual(noTools.code, 0);
  assert.match(noTools.err, /does not work with .+ yet, so you have no browser tools for 127\.0\.0\.1\n→ record the archive: strom repo add ".+" --url https:\/\/127\.0\.0\.1/);
  await w.ok(["repo", "add", "Zkušební archiv", "--url", `http://${m.hosts[0]}/`]);
  const after = await settings();
  assert.ok(after.allow.includes("mcp__claude-in-chrome__javascript_tool"));
  assert.ok(after.allow.includes("ClaudeInChromeDomain(127.0.0.1)"), "its sites, and no others");
  assert.ok(!after.allow.some((r: string) => /file_upload|upload_image|\*/.test(r) && r.startsWith("mcp__claude-in-chrome")));
  // full: never from an agent, a variable or --yes on its own; the person at the screen says yes (a window), or the user on a terminal after the warning
  const agent = await w.run(["config", "set", "agent.permissions", "full"]);
  assert.equal(agent.code, 4, "no window on this computer: the user runs it");
  assert.match(agent.out + agent.err, /strom config set agent\.permissions full/);
  assert.equal((await w.run(["config", "set", "agent.permissions", "full", "--yes"])).code, 4);
  w.env.STROM_AGENT_PERMISSIONS = "full";
  assert.equal((await w.ok(["config", "get", "agent.permissions"])).out.trim(), "auto", "no variable sets it");
  delete w.env.STROM_AGENT_PERMISSIONS;
  // From inside an agent's session: the window asks the person, the agent cannot answer it.
  w.env.CLAUDECODE = "1";
  const refused = await w.run(["config", "set", "agent.permissions", "full"], { dialog: false });
  assert.equal(refused.code, 1);
  assert.match(refused.err, /Nepovolili jste to/, "in the user's language");
  assert.equal((await w.ok(["config", "get", "agent.permissions"])).out.trim(), "auto");
  delete w.env.CLAUDECODE;
  const no = await w.run(["config", "set", "agent.permissions", "full"], { tty: true, answers: ["n"] });
  assert.equal(no.code, 1);
  assert.match(no.err, /Full: the agent does everything but what the tree's permissions deny/);
  await w.ok(["config", "set", "agent.permissions", "full"], { tty: true, answers: ["y"] });
  const loose = await settings();
  for (const r of ["Edit(.claude/**)", "Edit(CLAUDE.md)", "Bash(curl:*)", "Bash(wget:*)", "Edit(data/**)", "Bash(git:*)"]) assert.ok(loose.deny.includes(r), r);
  // back down: no terminal needed to tighten (the earlier name "list" still means auto)
  await w.ok(["config", "set", "agent.permissions", "list"]);
  assert.equal((await w.ok(["config", "get", "agent.permissions"])).out.trim(), "auto");
  assert.ok(!(await settings()).deny.includes("Bash(curl:*)"));
  // ask → auto lets the agent do more: the person says yes in the window
  await w.ok(["config", "set", "agent.permissions", "ask"]);
  w.env.CLAUDECODE = "1";
  await w.ok(["config", "set", "agent.permissions", "auto"], { dialog: true });
  delete w.env.CLAUDECODE;
  assert.equal((await w.ok(["config", "get", "agent.permissions"])).out.trim(), "auto");
  w.cleanup();
  await a.close();
});
