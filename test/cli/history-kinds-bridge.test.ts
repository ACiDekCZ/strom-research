// The kinds of history looked for through the bridge (spec 035, the app's Settings → History "look for"): /status says
// them (the research's, whether its own, this computer's); the app leaves a kind out at once (this research or this
// computer), never adds one — a link that asks in the terminal, the whole change there; align previewed (GET
// /history/align), done on the person's click only as far as it is free (hidden and shown again, taken back by its undo),
// the tasks of the kinds turned on through the link history-align; GET /history says what align hid and what is being
// looked for again.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { LINK_ACTIONS, parseLink } from "../../src/core/links.ts";
import { EVENT_KINDS } from "../../src/core/eventkinds.ts";

const opts = { skip: !hasGit || process.platform === "win32", timeout: 240_000 };
const APP = "https://beta.stromapp.info";
const NAMES = ["--name-cs", "Lhotsko", "--name-en", "Lhota Land", "--name-de", "Lhotaland"];
const ALL = [...EVENT_KINDS];
type Info = { pid: number; port: number; token: string; url: string };

function ask(url: string, opt: { method?: string; body?: string } = {}): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: any }> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = { Origin: APP };
    if (opt.body !== undefined) headers["Content-Type"] = "text/plain; charset=utf-8";
    const req = http.request(url, { agent: false, method: opt.method ?? "GET", headers }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (d) => (text += d));
      res.on("end", () => {
        let body: any = text;
        try {
          body = JSON.parse(text);
        } catch {
          // not JSON
        }
        resolve({ status: res.statusCode ?? 0, headers: res.headers, body });
      });
    });
    req.on("error", reject);
    req.end(opt.body);
  });
}

const post = (url: string, body: unknown) => ask(url, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) });

function catalogFile(w: World): string {
  return path.join(w.home, "shared", "history", "regions", "cz-lhota.json");
}

/** The region's events, as a session of history writes them: [n, year, kind]. */
function writeEvents(w: World, events: [number, number, string][]): void {
  const c = readJsonFile(catalogFile(w));
  const source = { title: "Dějiny Lhotska", url: "https://example.org/lhotsko", checked: "2026-10-01", quote: "1850", sha: "0".repeat(64) };
  c.events = events.map(([n, from, kind]) => ({ id: `cz-lhota-${String(n).padStart(4, "0")}`, from, to: from, kind, text: { cs: "Událost", en: "Event", de: "Ereignis" }, source, by: "x", at: "2026-10-01T00:00:00Z" }));
  c.next = events.length + 1;
  fs.writeFileSync(catalogFile(w), JSON.stringify(c));
}

/** Jan Lhoták born 1850 at Lhota (in cz-lhota from 1800), the history on; a war, a law and an economy event found. */
async function world(): Promise<{ w: World; id: string }> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["research", "new", "Předci Jana Lhotáka", "--new-person", "Jan /Lhoták/", "--sex", "M", "--born", "1850", "--born-place", "Lhota"]);
  await w.ok(["config", "set", "experiments.history", "on"], { tty: true, answers: ["a"] });
  await w.ok(["history", "region", "cz-lhota", ...NAMES]);
  await w.ok(["history", "map", "Lhota", "--region", "cz-lhota:1800-"]);
  writeEvents(w, [
    [1, 1848, "law"],
    [2, 1849, "economy"],
    [3, 1866, "war"],
  ]);
  return { w, id: readJsonFile(path.join(w.cwd, "strom.json")).id };
}

const treeKinds = (w: World) => readJsonFile(path.join(w.cwd, "strom.json")).historyKinds;
const userKinds = (w: World) => readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json")).historyKinds;

test("bridge: /status says the kinds looked for; POST /history/kinds leaves a kind out at once (this research, this computer, back to this computer's), an added one only through the link — the whole change there", opts, async () => {
  const { w, id } = await world();
  try {
    const info = (await w.ok(["live", "start", "--json"])).json as Info;
    const status = async () => (await ask(`${info.url}/status`)).body;
    const s = await status();
    for (const f of ["history.kinds", "history.align"]) assert.ok(s.features.includes(f), f);
    assert.deepEqual([s.experiments.kinds, s.experiments.kindsOwn, s.experiments.kindsDefault], [ALL, false, ALL]);
    const url = `${info.url}/history/kinds`;
    // the body: only the known kinds, scope tree|default, inherit only for the research without kinds
    for (const bad of [{}, { kinds: ["válka"] }, { kinds: "war" }, { kinds: ["war"], scope: "world" }, { scope: "default", inherit: true }, { kinds: ["war"], inherit: true }, { kinds: ["war"], extra: 1 }]) {
      const r = await post(url, bad);
      assert.equal(r.status, 400, JSON.stringify(bad));
      assert.equal(r.body.code, "history.kinds.body");
    }
    // left out for this research: at once, the person's own config untouched; align now suggested (a law and an economy event to hide)
    const off = await post(url, { kinds: ALL.filter((k) => k !== "law" && k !== "economy") });
    assert.equal(off.status, 200, JSON.stringify(off.body));
    assert.deepEqual(off.body.experiments.kinds, ALL.filter((k) => k !== "law" && k !== "economy"));
    assert.equal(off.body.experiments.kindsOwn, true);
    assert.deepEqual(off.body.experiments.kindsDefault, ALL);
    assert.equal(off.body.alignSuggested, true);
    assert.notEqual(off.body.head, off.body.parent);
    assert.equal(treeKinds(w), "all,-law,-economy", "written as meant: all but those");
    assert.equal(userKinds(w), undefined);
    // the same again: 200, nothing written
    const same = await post(url, { kinds: ALL.filter((k) => k !== "law" && k !== "economy") });
    assert.equal(same.status, 200);
    assert.equal(same.body.head, same.body.parent);
    // one added (law back): refused with the link that asks in the terminal, nothing changed
    const add = await post(url, { kinds: ALL.filter((k) => k !== "economy") });
    assert.equal(add.status, 403, JSON.stringify(add.body));
    assert.equal(add.body.code, "history.kinds.link");
    assert.deepEqual(add.body.added, ["law"]);
    assert.match(add.body.error, /terminálu, který otevře odkaz/u);
    assert.equal(add.body.text, "A kind of history added is looked for only on the word given in the terminal the link opens.");
    const link = parseLink(add.body.link);
    assert.deepEqual(link, { action: "history-kinds", tree: id, scope: "tree", kinds: "all,-economy" });
    assert.equal(treeKinds(w), "all,-law,-economy");
    // this computer's: left out for every research without its own (this one keeps its own)
    const user = await post(url, { kinds: ["war", "epidemic"], scope: "default" });
    assert.equal(user.status, 200, JSON.stringify(user.body));
    assert.deepEqual(user.body.experiments.kindsDefault, ["war", "epidemic"]);
    assert.deepEqual(user.body.experiments.kinds, ALL.filter((k) => k !== "law" && k !== "economy"), "its own stays");
    assert.equal(userKinds(w), "all,-census,-state,-emigration,-law,-economy,-disaster,-other", "in the form of the one before (all): a kind of a later strom looked for too");
    // back to this computer's (fewer): at once; this computer's adding back: the link with scope=default
    const inherit = await post(url, { scope: "tree", inherit: true });
    assert.equal(inherit.status, 200, JSON.stringify(inherit.body));
    assert.deepEqual([inherit.body.experiments.kinds, inherit.body.experiments.kindsOwn], [["war", "epidemic"], false]);
    assert.equal(treeKinds(w), undefined);
    const more = await post(url, { kinds: ALL, scope: "default" });
    assert.equal(more.status, 403);
    assert.deepEqual(parseLink(more.body.link), { action: "history-kinds", tree: id, scope: "default", kinds: "all" });
    // its parameters in the order the Strom app writes them (tree, scope, kinds|inherit)
    assert.equal(more.body.link, `strom-research://history-kinds?tree=${id}&scope=default&kinds=all`);
    assert.equal(userKinds(w), "all,-census,-state,-emigration,-law,-economy,-disaster,-other");
    // the status says it as it is now
    const now = await status();
    assert.deepEqual([now.experiments.kinds, now.experiments.kindsOwn, now.experiments.kindsDefault], [["war", "epidemic"], false, ["war", "epidemic"]]);
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("bridge: GET /history/align previews (?kinds= without setting anything); POST /history/align hides and shows again on its plan, taken back by its undo; another plan by now: 409 with the preview; GET /history says by align", opts, async () => {
  const { w } = await world();
  try {
    await w.ok(["config", "set", "history.kinds", "all,-law,-economy", "--for-tree"]);
    const info = (await w.ok(["live", "start", "--json"])).json as Info;
    const url = `${info.url}/history/align`;
    // ?kinds=: were these looked for — nothing set; an unknown kind 400
    const what = await ask(`${url}?kinds=war`);
    assert.equal(what.status, 200, JSON.stringify(what.body));
    assert.deepEqual(what.body.kinds, ["war"]);
    assert.equal((await ask(`${url}?kinds=v%C3%A1lka`)).body.code, "history.kinds.body");
    assert.equal(treeKinds(w), "all,-law,-economy");
    const preview = (await ask(url)).body;
    assert.match(preview.plan, /^[0-9a-f]{16}$/u);
    assert.deepEqual(preview.hide.general, { n: 2, kinds: { law: 1, economy: 1 } }, "the events' IDs left out");
    assert.deepEqual(preview.shared, { n: 2, kinds: { law: 1, economy: 1 } });
    assert.deepEqual(preview.backfill, []);
    // the body
    for (const bad of [{}, { plan: preview.plan }, { plan: "x", hide: true }, { plan: preview.plan, hide: "yes" }, { plan: preview.plan, hide: true, prune: true }]) {
      const r = await post(url, bad);
      assert.equal(r.status, 400, JSON.stringify(bad));
      assert.equal(r.body.code, "history.align.body");
    }
    // another plan: refused with the preview as it is
    const old = await post(url, { plan: "0".repeat(16), hide: true });
    assert.equal(old.status, 409);
    assert.equal(old.body.code, "history.align.changed");
    assert.equal(old.body.preview.plan, preview.plan);
    // done on the person's click: hidden here, the shared catalog untouched, no task
    const tasksBefore = (await w.ok(["task", "list", "--state", "all", "--json", "--limit", "500"])).json.tasks.length;
    const done = await post(url, { plan: preview.plan, hide: true, backfill: true });
    assert.equal(done.status, 200, JSON.stringify(done.body));
    assert.deepEqual(done.body.done, { hidden: 2, shown: 0, tasks: 0 });
    assert.match(done.body.undo, /^\d{14}-[0-9a-f]{6}$/u);
    assert.equal(done.body.backfill, undefined, "nothing to look for again");
    assert.notEqual(done.body.head, done.body.parent);
    assert.equal((await w.ok(["task", "list", "--state", "all", "--json", "--limit", "500"])).json.tasks.length, tasksBefore);
    assert.ok(readJsonFile(catalogFile(w)).events.every((e: { retracted?: unknown }) => !e.retracted));
    // GET /history: hidden by align, with the align that hid them
    const h = (await ask(`${info.url}/history`)).body;
    const byAlign = h.hidden.filter((x: { by?: string }) => x.by === "align");
    assert.deepEqual(byAlign.map((x: { event: string; align: string }) => [x.event, x.align]).sort(), [["cz-lhota-0001", done.body.undo], ["cz-lhota-0002", done.body.undo]]);
    // nothing left: the plan done, a second click hides nothing
    const again = (await ask(url)).body;
    assert.equal(again.hide.general.n, 0);
    // taken back: shown again, the second time 409
    const undo = await post(`${url}/undo`, { undo: done.body.undo });
    assert.equal(undo.status, 200, JSON.stringify(undo.body));
    assert.deepEqual(undo.body.undone, { shown: 2, hidden: 0 });
    assert.equal((await ask(`${info.url}/history`)).body.hidden.filter((x: { by?: string }) => x.by === "align").length, 0);
    assert.equal((await post(`${url}/undo`, { undo: done.body.undo })).status, 409);
    const none = await post(`${url}/undo`, { undo: "20260101000000-abcdef" });
    assert.equal(none.status, 404);
    assert.equal(none.body.code, "history.align.undo");
    assert.equal((await post(`${url}/undo`, { undo: "../x" })).status, 400);
    // the CLI: --kinds only previews; an agent's --undo or --only-hide is the person's (never the bridge's way round)
    const kinds = await w.run(["history", "align", "--kinds", "war", "--yes", "--json"]);
    assert.notEqual(kinds.code, 0);
    assert.match(kinds.out + kinds.err, /history\.kinds/u);
    const hide = await w.run(["history", "align", "--yes", "--only-hide", "--json"], { env: { CLAUDECODE: "1" } });
    assert.equal(hide.code, 4, hide.out + hide.err);
    const again2 = (await post(url, { plan: (await ask(url)).body.plan, hide: true })).body;
    const agent = await w.run(["history", "align", "--undo", again2.undo, "--json"], { env: { CLAUDECODE: "1" } });
    assert.equal(agent.code, 4, agent.out + agent.err);
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("bridge: a kind turned on — POST /history/align never raises its tasks (the link history-align with the estimate); GET /history says kindsFill once they are raised in the terminal", opts, async () => {
  const { w, id } = await world();
  try {
    await w.ok(["config", "set", "history.kinds", "all,-law", "--for-tree"]);
    await w.ok(["history", "done", "cz-lhota"]);
    await w.ok(["config", "set", "history.kinds", "all", "--for-tree"], { tty: true, answers: ["a"] });
    const info = (await w.ok(["live", "start", "--json"])).json as Info;
    const url = `${info.url}/history/align`;
    const preview = (await ask(url)).body;
    assert.equal(preview.backfill.length, 1);
    assert.deepEqual([preview.backfill[0].region, preview.backfill[0].kinds, preview.sessions], ["cz-lhota", ["law"], 1]);
    // only the tasks asked, nothing to hide: 403 with the link
    const r = await post(url, { plan: preview.plan, hide: true, backfill: true });
    assert.equal(r.status, 403, JSON.stringify(r.body));
    assert.equal(r.body.code, "history.align.link");
    assert.deepEqual(parseLink(r.body.link), { action: "history-align", tree: id });
    assert.deepEqual([r.body.backfill.n, r.body.backfill.sessions], [1, 1]);
    assert.equal((await w.ok(["task", "list", "--state", "all", "--json", "--limit", "500"])).json.tasks.filter((t: { origin?: string }) => t.origin === "history:gaps:cz-lhota").length, 0);
    // the link in the terminal: align's preview and its question — the yes raises the task
    const yes = await w.run(["link", "open", r.body.link], { tty: true, answers: ["a", ""] });
    assert.equal(yes.code, 0, yes.out + yes.err);
    assert.match(yes.out, /Aplikace Strom žádá: srovnat dějiny s hledanými druhy/u);
    assert.match(yes.out, /K dohledání tam, kde se dějiny prošly bez těchto druhů: úkolů 1/u);
    assert.doesNotMatch(yes.out, /\b(vy|váš|ty|tvůj)\b/iu);
    const h = (await ask(`${info.url}/history`)).body;
    const region = h.regions["cz-lhota"];
    assert.deepEqual(region.kindsFill, { kinds: ["law"], state: "queued" }, JSON.stringify(region));
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("link history-kinds: only known kinds, scope tree|default, inherit for the research alone; in the terminal the change and its estimate, set on the yes, align offered; a no changes nothing; an archive refused in a sentence", opts, async () => {
  for (const a of ["history-kinds", "history-align"]) assert.ok((LINK_ACTIONS as readonly string[]).includes(a), a);
  const T = "0f8c2d4e-1b2a-4c3d-9e8f-7a6b5c4d3e2f";
  assert.deepEqual(parseLink(`strom-research://history-kinds?tree=${T}&kinds=Epidemic,war`), { action: "history-kinds", tree: T, scope: "tree", kinds: "war,epidemic" });
  for (const bad of [`kinds=v%C3%A1lka`, `kinds=war&scope=world`, `inherit=1&scope=default`, `inherit=1&kinds=war`, `inherit=yes`, ``, `kinds=war;rm`]) assert.throws(() => parseLink(`strom-research://history-kinds?tree=${T}&${bad}`), /./u, bad);
  assert.deepEqual(parseLink(`strom-research://history-align?tree=${T}&prune=1`), { action: "history-align", tree: T, prune: "1" });
  assert.throws(() => parseLink(`strom-research://history-align?tree=${T}&prune=yes`));
  const { w, id } = await world();
  try {
    await w.ok(["config", "set", "history.kinds", "all,-law", "--for-tree"]);
    await w.ok(["history", "done", "cz-lhota"]);
    const link = `strom-research://history-kinds?tree=${id}&kinds=all&scope=tree`;
    // no: nothing
    const no = await w.run(["link", "open", link], { tty: true, answers: ["n", ""] });
    assert.match(no.out, /Aplikace Strom žádá: hledat v tomto výzkumu tyto druhy dějin: /u, no.out + no.err);
    assert.match(no.out, /Přibude: zákon/u);
    assert.match(no.out, /úkolů 1, asi 1 sezení agenta/u);
    assert.doesNotMatch(no.out, /\b(vy|váš|ty|tvůj)\b/iu);
    assert.equal(treeKinds(w), "all,-law");
    // yes: set; align offered — a no there leaves what was found as it is
    const yes = await w.run(["link", "open", link], { tty: true, answers: ["a", "n", ""] });
    assert.equal(yes.code, 0, yes.out + yes.err);
    assert.match(yes.out, /Druhy dějin jsou nastavené/u);
    assert.match(yes.out, /Srovnat dějiny s nimi hned/u);
    assert.equal(treeKinds(w), "all");
    // the same again: nothing asked
    const same = await w.run(["link", "open", link], { tty: true, answers: [""] });
    assert.match(same.out, /Tyto druhy se už hledají/u);
    assert.doesNotMatch(same.out, /Aplikace Strom žádá/u);
    // an archive: one sentence, nothing asked
    await w.ok(["mode", "archive"], { tty: true });
    const archived = await w.run(["link", "open", `strom-research://history-kinds?tree=${id}&kinds=war&scope=tree`], { tty: true, answers: [""] });
    assert.doesNotMatch(archived.out, /Aplikace Strom žádá/u, archived.out);
    assert.equal(treeKinds(w), "all");
  } finally {
    w.cleanup();
  }
});
