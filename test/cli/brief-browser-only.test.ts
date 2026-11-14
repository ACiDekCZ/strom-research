// An archive only a person's browser goes to (its terms in strom's list, or its robots.txt), with a downloader of the
// direct route alone installed for it: strom fetch refuses that connector whole — its images, its catalogue (--find)
// too. The brief never advises strom fetch or --crop there: it names the connector as shut, and the images come one at
// a time through the agent's browser (strom media save) where the person allowed "through the browser" and strom keeps
// that browser, else by the person's hand. A refused --find says the next step: the archive's own site. Two synthetic
// archives of the same property, decided by the property alone. No request leaves this computer.

import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import http from "node:http";
import { World, fakeConnector, hasGit, pluginDir, readJsonFile } from "../helpers.ts";
import { testHooks } from "../../src/core/net.ts";
import { grantWay } from "../../src/core/terms.ts";

const opts = { skip: !hasGit };

const out: string[] = [];
const keep = { request: https.request, get: https.get, hrequest: http.request, hget: http.get, fetch: globalThis.fetch };
const refuse = (u: unknown) => {
  out.push(String(u));
  throw new Error("no network in this test");
};
let ahead = 0;
before(() => {
  (https as { request: unknown }).request = refuse;
  (https as { get: unknown }).get = refuse;
  (http as { request: unknown }).request = refuse;
  (http as { get: unknown }).get = refuse;
  globalThis.fetch = (u) => Promise.reject(refuse(u));
  testHooks.now = () => Date.now() + ahead;
  testHooks.sleep = async (ms) => {
    ahead += ms;
  };
});
after(() => {
  Object.assign(https, { request: keep.request, get: keep.get });
  Object.assign(http, { request: keep.hrequest, get: keep.hget });
  globalThis.fetch = keep.fetch;
  testHooks.now = undefined;
  testHooks.sleep = undefined;
});

const ARCHIVES = [
  { connector: "lhota-old", host: "www.archiv-lhota.example", name: "Archiv Lhota", book: "https://www.archiv-lhota.example/kniha/5359" },
  { connector: "podhradi-old", host: "matriky.podhradi.example", name: "Archiv Podhradí", book: "https://matriky.podhradi.example/detail/77" },
];

/** The agent's browser strom keeps: the Claude in Chrome extension in a profile of this computer's Chrome. */
function extension(w: World): void {
  const home = w.env.HOME!;
  const dir =
    process.platform === "darwin"
      ? path.join(home, "Library", "Application Support", "Google", "Chrome")
      : process.platform === "win32"
        ? path.join(w.env.LOCALAPPDATA ?? path.join(home, "AppData", "Local"), "Google", "Chrome", "User Data")
        : path.join(home, ".config", "google-chrome");
  fs.mkdirSync(path.join(dir, "Default", "Extensions", "fcoeoabgfenejglbffodgkkbkcdhcgfn"), { recursive: true });
}

/** The brief's line of one archive in its Record sets ("archive <host>: …"). */
const archiveOf = (books: string, host: string) => books.split("\n").find((l) => l.trim().startsWith(`archive ${host}:`)) ?? "";

const section = (brief: string, name: string) => {
  const at = brief.indexOf(`\n## ${name}`);
  if (at < 0) return "";
  const next = brief.indexOf("\n#", at + 4);
  return brief.slice(at, next < 0 ? undefined : next);
};

test("an archive only a person's browser goes to: the brief advises no strom fetch or --crop for its direct downloader — strom media save through the agent's browser where allowed, else the person's hand; --find refused with the next step (two archives)", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  try {
    const file = path.join(w.dir, "archives-test.json");
    fs.writeFileSync(file, JSON.stringify({ archives: ARCHIVES.map((a) => ({ host: a.host, name: a.name, level: "restricted", browserOnly: true, checked: "2026-11-01" })) }));
    w.env.STROM_ARCHIVES_FILE = file;
    await w.ok(["research", "new", "X", "--new-person", "Jan /Lhoták/"]);
    let n = 0;
    for (const a of ARCHIVES) {
      n++;
      await w.ok(["recordset", "add", `Lhota N 17${80 + n}–1820`, "--kinds", "baptism", "--places", "Lhota", "--years", `17${80 + n}-1820`, "--access", "online-free", "--url", a.book]); // B<n>
      await w.ok(["task", "add", `Křest Jan ${n}`, "--level", "link", "--where", `B${n}`, "--why", "a", "--done-when", "b"]); // T<n>
      await fakeConnector(w, a.connector, "", { automation: "restricted" });
      const m = path.join(pluginDir(w, a.connector), "connector.json");
      fs.writeFileSync(m, JSON.stringify({ ...readJsonFile(m), hosts: [a.host] }, null, 2));
    }

    const books = async (task: string, env: Record<string, string> = {}) => {
      const brief = (await w.ok(["brief", task], { env })).out;
      return { brief, books: section(brief, "Record sets") };
    };

    // no permission yet: the connector named as shut, the images by the person's hand — never strom fetch
    n = 0;
    for (const a of ARCHIVES) {
      n++;
      const { brief, books: b } = await books(`T${n}`);
      assert.doesNotMatch(brief, new RegExp(`strom fetch ${a.connector}`), `${a.host}: no strom fetch of the shut connector\n${brief}`);
      // (the header's "strom fetch the rest" is of a site's own connector the agent builds — never of these)
      assert.doesNotMatch(brief, /strom fetch (?!the rest)/, `${a.host}: no strom fetch, no fetch --crop\n${brief}`);
      assert.match(b, /no images here yet — the user saves them by hand/, `${a.host}\n${brief}`);
      assert.match(brief, /connectors: (lhota-old, podhradi-old|podhradi-old, lhota-old): only a person's browser goes to their archives — refused there by strom fetch, --find too; its books on the archive's own site/, `${a.host}\n${brief}`);
      assert.doesNotMatch(b, /strom media save/, `${a.host}: not without the person's permission\n${brief}`);
      // its archive line: the person's way through the browser, never a fetch that would ask them
      const line = archiveOf(b, a.host);
      assert.match(line, /restricted — only through a person's browser · no decision of the person's yet: its images through your browser only once they allow it/, `${a.host}\n${brief}`);
      assert.match(line, new RegExp(`strom allow archive ${a.host.replace(/\./g, "\\.")} --way browser — the person's, never yours`), `${a.host}\n${brief}`);
      assert.doesNotMatch(line, /fetch/i, `${a.host}: no fetch on a browser-only archive's line\n${line}`);
    }

    // the person's "through the browser", and the agent's browser strom keeps: strom media save, one image at a time
    assert.ok(grantWay(w.env, ARCHIVES.map((a) => a.host), "browser", { by: "terminal" }));
    extension(w);
    n = 0;
    for (const a of ARCHIVES) {
      n++;
      const { brief, books: b } = await books(`T${n}`, { CLAUDECODE: "1" });
      assert.doesNotMatch(brief, /strom fetch (?!the rest)/, `${a.host}: no strom fetch, no fetch --crop\n${brief}`);
      assert.match(b, new RegExp(`strom media save T000${n} --image <n> --at <the archive's page of that image>`), `${a.host}\n${brief}`);
      assert.match(brief, /strom media add --inbox --waiting — it takes the file and says what came; never read the downloads folder yourself/, `${a.host}\n${brief}`);
      const line = archiveOf(b, a.host);
      assert.match(line, /the person's permission: through the browser · images sparingly through your browser: an index by halving/, `${a.host}\n${brief}`);
      assert.doesNotMatch(line, /fetch/i, `${a.host}: no fetch on a browser-only archive's line\n${line}`);
    }

    // its catalogue: refused with the exact next step — the archive's own site through the agent's browser
    for (const a of ARCHIVES) {
      const r = await w.run(["fetch", a.connector, "--find", "Lhota", "--years", "1780-1820", "--list", "--json"], { env: { CLAUDECODE: "1" } });
      assert.equal(r.code, 2, `${a.host}\n${r.out}${r.err}`);
      assert.equal(r.json?.code, "archive.browser", a.host);
      assert.match(r.json.message, /finding its books neither/, a.host);
      assert.match(r.json.hint, new RegExp(`^find the book on the archive's own site through your browser instead \\(https://${a.host.replace(/\./g, "\\.")}/ — its catalogue page by page, at a person's pace\\), then record it: strom recordset add "<title>" --url <the book's page there>`), a.host);
      assert.match(r.json.hint, /its images then one at a time: strom media save/, a.host);
    }
    // without the agent's browser: the person finds it on the archive's site
    for (const a of ARCHIVES) {
      const r = await w.run(["fetch", a.connector, "--find", "Lhota", "--json"], { env: { CODEX_THREAD_ID: "t1" } });
      assert.equal(r.code, 2, a.host);
      assert.match(r.json.hint, new RegExp(`^the book is found on the archive's own site \\(https://${a.host.replace(/\./g, "\\.")}/\\) by a person: strom task wait T… --check https://`), a.host);
    }
    assert.deepEqual(out, [], "nothing left this computer");
  } finally {
    w.cleanup();
  }
});
