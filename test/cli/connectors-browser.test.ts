// Connectors: plugins in the plugins folder (<shared>/plugins/connectors/<name>/
// — copy a folder in and it is there), run by strom — every request paced by
// strom's limiter, a refusal stopping everything, the images checked, what was
// fetched registered with its provenance. The user's consent (on a terminal,
// never an agent's) is needed when they ask for it (connectors.consent on), and
// always for code that goes round strom. A local server plays the archive; the
// pauses are recorded, not slept.

import { readEntry, readZip, unzipTo, ZipWriter } from "../../src/core/zip.ts";
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
import { opts, scans, pauses, TILE, archive, world, program, runInTab } from "./connectors.helpers.ts";
import type { Archive } from "./connectors.helpers.ts";

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
  assert.match((await w.ok(["fetch", "zkusebni", "5359", "--images", "3", "--recordset", "B1"])).out, /1 image\(s\) of B0001 \(images 3\) fetched and registered/);
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
  // agent.browser always (the user's choice, never an agent's): the browser in every session, for the sites of the archives
  w.env.CLAUDECODE = "1";
  assert.equal((await w.run(["config", "set", "agent.browser", "always"])).code, 4);
  delete w.env.CLAUDECODE;
  await w.ok(["config", "set", "agent.browser", "always"], { tty: true, answers: ["a"] });
  const always = await settings();
  assert.ok(always.allow.includes("mcp__claude-in-chrome__navigate"));
  assert.ok(always.allow.includes("ClaudeInChromeDomain(127.0.0.1)"), "the connectors' sites without asking");
  assert.ok(always.deny.includes("mcp__claude-in-chrome__file_upload"), "still never an upload");
  await w.ok(["config", "unset", "agent.browser"]);
  assert.ok(!(await settings()).allow.some((r: string) => r.startsWith("mcp__claude-in-chrome")), "back: none");
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
  assert.match(refused.err, /Nepovoleno/, "in the user's language");
  assert.equal((await w.ok(["config", "get", "agent.permissions"])).out.trim(), "auto");
  delete w.env.CLAUDECODE;
  const no = await w.run(["config", "set", "agent.permissions", "full"], { tty: true, answers: ["n"] });
  assert.equal(no.code, 1);
  assert.match(no.err, /Všechno: agent dělá bez ptaní všechno kromě toho, co zakazují oprávnění stromu/, "in the user's language");
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
