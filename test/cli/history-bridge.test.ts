// What the ancestors lived through (experiments.history) for the Strom app: the bridge says whether the experiment is
// on for the tree and the fingerprint of its answer (/status), gives the events at the tree's places (GET /history,
// within its limits), takes what the person hides or shows again (POST /history/hide, an archive's too), turns it off
// for the tree but never on (POST /experiments), and says when the answer changed without a commit (the event history,
// a catalog another tree wrote). The link experiment turns it on on the person's word in the terminal, off at once.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { LINK_ACTIONS, parseLink } from "../../src/core/links.ts";

const opts = { skip: !hasGit || process.platform === "win32", timeout: 180_000 };
const APP = "https://beta.stromapp.info";
const NAMES = ["--name-cs", "Lhotsko", "--name-en", "Lhota Land", "--name-de", "Lhotaland"];
type Info = { pid: number; port: number; token: string; url: string };

function ask(url: string, opt: { method?: string; body?: string; origin?: string | null } = {}): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: any }> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {};
    if (opt.origin !== null) headers.Origin = opt.origin ?? APP;
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

const post = (url: string, body: unknown, origin?: string | null) => ask(url, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), ...(origin !== undefined ? { origin } : {}) });

function catalogFile(w: World): string {
  return path.join(w.home, "shared", "history", "regions", "cz-lhota.json");
}

/** Events written into the shared catalog as a session of history would have (their pages read, checked). */
function writeEvents(w: World, events: [n: number, year: number, kind: string, text: string][]): void {
  const file = catalogFile(w);
  const c = readJsonFile(file);
  const source = { title: "Dějiny Lhoty", url: "https://example.org/lhota", checked: "2026-10-01", quote: "1866", sha: "0".repeat(64) };
  c.events = events.map(([n, from, kind, text]) => ({ id: `cz-lhota-${String(n).padStart(4, "0")}`, from, to: from, kind, text: { cs: text, en: text, de: text }, source, by: "x", at: "2026-10-01T00:00:00Z" }));
  c.next = events.length + 1;
  fs.writeFileSync(file, JSON.stringify(c));
}

/** A tree of Jan Lhoták born at Lhota (mapped, with another name), died at Nová Lhota (not mapped yet). */
async function world(on = true): Promise<{ w: World; id: string }> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["research", "new", "Předci Jana Lhotáka", "--new-person", "Jan /Lhoták/", "--sex", "M", "--born", "1850", "--born-place", "Lhota"]);
  await w.ok(["event", "add", "P0001", "DEAT", "--date", "1925", "--place", "Nová Lhota"]);
  if (on) {
    await w.ok(["config", "set", "experiments.history", "on"], { tty: true, answers: ["a"] });
    await w.ok(["history", "region", "cz-lhota", ...NAMES]);
    await w.ok(["history", "map", "Lhota", "--region", "cz-lhota:1800-", "--also", "Lhota pod Horou"]);
    writeEvents(w, [
      [1, 1866, "epidemic", "Cholera ve Lhotě"],
      [2, 1921, "census", "Sčítání lidu"],
    ]);
  }
  return { w, id: readJsonFile(path.join(w.cwd, "strom.json")).id };
}

async function bridge(w: World): Promise<Info> {
  return (await w.ok(["live", "start", "--json"])).json as Info;
}

test("bridge: /status says the experiment and its rev only where the tree has it; GET /history gives the events, the places with their names and state, within its limits", opts, async () => {
  const off = await world(false);
  try {
    const info = await bridge(off.w);
    const s = (await ask(`${info.url}/status?app=3.16.0`)).body;
    assert.deepEqual(s.experiments, { history: false });
    assert.equal("history" in s, false, "nothing of it for a tree without it");
    for (const f of ["experiments", "experiments.off", "experiments.link", "history.events", "history.hide"]) assert.ok(s.features.includes(f), f);
    const h = (await ask(`${info.url}/history`)).body;
    assert.equal(h.state.on, false);
    assert.deepEqual(h.events, []);
  } finally {
    await off.w.run(["live", "stop"]);
    off.w.cleanup();
  }

  const { w } = await world();
  try {
    let info = await bridge(w);
    const s = (await ask(`${info.url}/status?app=3.16.0`)).body;
    assert.deepEqual(s.experiments, { history: true });
    assert.match(s.history.rev, /^[0-9a-f]{16}$/);
    const r = await ask(`${info.url}/history?app=3.16.0`);
    assert.equal(r.status, 200);
    assert.equal(r.headers["access-control-allow-origin"], APP);
    assert.equal(r.headers["cache-control"], "no-store");
    const h = r.body;
    assert.equal(h.state.on, true);
    assert.equal(h.state.rev, s.history.rev, "the rev /status said");
    assert.equal(h.state.truncated, undefined);
    assert.equal(h.lang, "cs");
    assert.deepEqual(h.events.map((e: { id: string }) => e.id), ["cz-lhota-0001", "cz-lhota-0002"]);
    assert.equal(h.events[0].region.id, "cz-lhota");
    assert.deepEqual(h.places["Lhota"].events, ["cz-lhota-0001", "cz-lhota-0002"]);
    assert.deepEqual(h.places["Lhota"].also, ["Lhota pod Horou"]);
    assert.equal(h.places["Nová Lhota"].state, "pending");
    assert.deepEqual(Object.keys(h.places), ["Lhota", "Nová Lhota"], "the places with events first");
    assert.deepEqual(h.hidden, []);
    // the secret and the app's pages as everywhere
    assert.equal((await ask(`http://127.0.0.1:${info.port}/${"0".repeat(32)}/history`)).status, 404);
    await w.run(["live", "stop"]);
    // lower limits: the places with events kept first, the events of the most places
    Object.assign(w.env, { STROM_LIVE_HISTORY_PLACES: "1" });
    info = await bridge(w);
    let t = (await ask(`${info.url}/history`)).body;
    assert.equal(t.state.truncated, true);
    assert.deepEqual(Object.keys(t.places), ["Lhota"]);
    await w.run(["live", "stop"]);
    delete w.env.STROM_LIVE_HISTORY_PLACES;
    Object.assign(w.env, { STROM_LIVE_HISTORY_EVENTS: "1" });
    info = await bridge(w);
    t = (await ask(`${info.url}/history`)).body;
    assert.equal(t.state.truncated, true);
    assert.equal(t.events.length, 1);
    assert.equal(t.places["Lhota"].events.length, 1);
    assert.deepEqual(t.places["Lhota"].events, [t.events[0].id], "a place names only the events sent");
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("bridge: POST /history/hide hides at a place or a person and shows again, answers what is hidden with head and parent; its refusals; an archive's too", opts, async () => {
  const { w } = await world();
  try {
    const info = await bridge(w);
    const url = `${info.url}/history/hide`;
    const hid = await post(url, { event: "cz-lhota-0001", place: "Lhota" });
    assert.equal(hid.status, 200, JSON.stringify(hid.body));
    assert.deepEqual(hid.body.hidden.map((x: { event: string; place: string }) => [x.event, x.place]), [["cz-lhota-0001", "Lhota"]]);
    assert.match(hid.body.head, /^[0-9a-f]{40}$/);
    assert.notEqual(hid.body.parent, hid.body.head, "written: a commit");
    assert.deepEqual((await ask(`${info.url}/history`)).body.hidden.map((x: { event: string }) => x.event), ["cz-lhota-0001"]);
    // the same again: nothing written (parent = head)
    const same = await post(url, { event: "cz-lhota-0001", place: "Lhota" });
    assert.equal(same.status, 200);
    assert.equal(same.body.parent, same.body.head);
    // at a person; at a place the research has no fact at (no error: the app may name one)
    assert.equal((await post(url, { event: "cz-lhota-0002", person: "P0001" })).status, 200);
    const elsewhere = await post(url, { event: "cz-lhota-0002", place: "Lhota nad Řekou" });
    assert.equal(elsewhere.status, 200, JSON.stringify(elsewhere.body));
    // shown again
    const shown = await post(url, { event: "cz-lhota-0001", place: "Lhota", do: "show" });
    assert.equal(shown.status, 200);
    assert.ok(!shown.body.hidden.some((x: { event: string }) => x.event === "cz-lhota-0001"));
    // refusals: the body, an unknown event or person, not the app
    for (const body of ["[]", "{}", JSON.stringify({ event: "cz-lhota-0001" }), JSON.stringify({ event: "cz-lhota-0001", place: "Lhota", person: "P0001" }), JSON.stringify({ event: "-x", place: "Lhota" }), JSON.stringify({ event: "cz-lhota-0001", person: "Jan" }), JSON.stringify({ event: "cz-lhota-0001", place: "Lhota", do: "maybe" })]) {
      const r = await post(url, body);
      assert.equal(r.status, 400, body);
      assert.equal(r.body.code, "history.body", body);
    }
    const noEvent = await post(url, { event: "cz-lhota-0099", place: "Lhota" });
    assert.equal(noEvent.status, 404);
    assert.equal(noEvent.body.code, "history.event");
    const noPerson = await post(url, { event: "cz-lhota-0001", person: "P0099" });
    assert.equal(noPerson.status, 404);
    assert.equal(noPerson.body.code, "history.person");
    assert.equal((await post(url, { event: "cz-lhota-0001", place: "Lhota" }, null)).status, 403, "only the Strom app");
    // files of the research only in iCloud: 409 tree.not-downloaded, nothing written
    const placeholder = path.join(w.cwd, "data", "persons", ".P0002.json.icloud");
    fs.writeFileSync(placeholder, "bplist00");
    const cloud = await post(url, { event: "cz-lhota-0001", place: "Lhota" });
    assert.equal(cloud.status, 409);
    assert.equal(cloud.body.code, "tree.not-downloaded");
    fs.rmSync(placeholder);
    // an archive: the person hides what the app shows there too
    await w.ok(["mode", "archive"], { tty: true });
    const archived = await post(url, { event: "cz-lhota-0001", place: "Lhota" });
    assert.equal(archived.status, 200, JSON.stringify(archived.body));
    const read = (await ask(`${info.url}/history`)).body;
    assert.ok(read.hidden.some((x: { event: string; place?: string }) => x.event === "cz-lhota-0001" && x.place === "Lhota"));
    assert.equal(read.state.search, "waiting", "nothing looked for in an archive");
    assert.ok(read.state.why);
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("bridge: POST /history/hide of a research sealed on another computer: 409 seal.foreign", opts, async () => {
  const { w, id } = await world();
  const key = path.join(w.env.STROM_CONFIG_DIR!, "keys", `${id}.key`);
  try {
    fs.rmSync(key);
    const info = await bridge(w);
    const r = await post(`${info.url}/history/hide`, { event: "cz-lhota-0001", place: "Lhota" });
    assert.equal(r.status, 409);
    assert.equal(r.body.code, "seal.foreign");
    const e = await post(`${info.url}/experiments`, { history: false });
    assert.equal(e.status, 409);
    assert.equal(e.body.code, "seal.foreign");
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("bridge: POST /experiments turns the history off for this tree only, never on — that is the link's, in the terminal", opts, async () => {
  const { w, id } = await world();
  try {
    const info = await bridge(w);
    const url = `${info.url}/experiments`;
    const on = await post(url, { history: true });
    assert.equal(on.status, 403);
    assert.equal(on.body.code, "experiments.link");
    assert.equal(on.body.link, `strom-research://experiment?tree=${id}&name=history&do=on`);
    assert.deepEqual(parseLink(on.body.link), { action: "experiment", tree: id, name: "history", do: "on" });
    assert.match(on.body.error, /^Hledání událostí dějin se zapíná jen v terminálu/, "the research's language");
    assert.match(on.body.text, /^The search for the events of history is turned on only in the terminal/);
    for (const body of ["{}", JSON.stringify({ history: "off" }), JSON.stringify({ history: false, stories: false })]) {
      const r = await post(url, body);
      assert.equal(r.status, 400, body);
      assert.equal(r.body.code, "experiments.body");
    }
    const off = await post(url, { history: false });
    assert.equal(off.status, 200, JSON.stringify(off.body));
    assert.deepEqual(off.body.experiments, { history: false });
    assert.notEqual(off.body.parent, off.body.head, "the tree's strom.json committed");
    assert.equal(readJsonFile(path.join(w.cwd, "strom.json")).experimentsHistory, "off");
    assert.equal(readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json")).experimentsHistory, "on", "the person's own config stays");
    assert.deepEqual((await ask(`${info.url}/status`)).body.experiments, { history: false });
    assert.match((await ask(`${info.url}/status`)).body.history.rev, /^[0-9a-f]{16}$/, "what was found is still said");
    const again = await post(url, { history: false });
    assert.equal(again.status, 200);
    assert.equal(again.body.parent, again.body.head, "off already: nothing written");
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("bridge: the event history when what GET /history answers changed without a commit — a catalog another tree of the shared folder wrote", opts, async () => {
  const { w } = await world();
  Object.assign(w.env, { STROM_LIVE_POLL_MS: "100", STROM_LIVE_HISTORY_MS: "150" });
  const ac = new AbortController();
  try {
    const info = await bridge(w);
    const events: { event: string; data: any }[] = [];
    const res = await fetch(`${info.url}/events`, { headers: { Origin: APP }, signal: ac.signal });
    const reader = res.body!.getReader();
    let buf = "";
    void (async () => {
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += new TextDecoder().decode(value);
          let i: number;
          while ((i = buf.indexOf("\n\n")) >= 0) {
            const chunk = buf.slice(0, i);
            buf = buf.slice(i + 2);
            const ev = /^event: (.+)$/m.exec(chunk)?.[1];
            const data = /^data: (.+)$/m.exec(chunk)?.[1];
            if (ev) events.push({ event: ev, data: data ? JSON.parse(data) : undefined });
          }
        }
      } catch {
        // aborted
      }
    })();
    const waitFor = async (pred: () => boolean, what: string) => {
      for (let i = 0; i < 100 && !pred(); i++) await new Promise((ok) => setTimeout(ok, 100));
      assert.ok(pred(), `${what}: ${JSON.stringify(events.map((e) => e.event))}`);
    };
    await waitFor(() => events.some((e) => e.event === "hello"), "hello");
    const before = (await ask(`${info.url}/status`)).body.history.rev;
    // a second tree of the same shared folder at the same place: its session writes an event into the region's catalog
    await w.ok(["init", "Lhotští"]);
    const b = w.treeDir("Lhotští");
    await w.ok(["person", "add", "Anna /Lhotská/", "--sex", "F"], { cwd: b });
    await w.ok(["event", "add", "P0001", "BIRT", "--date", "1870", "--place", "Lhota"], { cwd: b });
    await new Promise((ok) => setTimeout(ok, 300)); // the tick has looked at it since
    const n = events.length;
    writeEvents(w, [
      [1, 1866, "epidemic", "Cholera ve Lhotě"],
      [2, 1921, "census", "Sčítání lidu"],
      [3, 1880, "fire", "Požár Lhoty"],
    ]);
    await waitFor(() => events.slice(n).some((e) => e.event === "history"), "history");
    const said = events.slice(n).find((e) => e.event === "history")!;
    assert.match(said.data.rev, /^[0-9a-f]{16}$/);
    assert.notEqual(said.data.rev, before);
    assert.equal(events.slice(n).filter((e) => e.event === "change").length, 0, "no commit of this tree");
    assert.equal((await ask(`${info.url}/status`)).body.history.rev, said.data.rev, "/status says the same rev");
    assert.ok((await ask(`${info.url}/history`)).body.events.some((e: { id: string }) => e.id === "cz-lhota-0003"));
    // a commit of this tree: its change, no history event of it
    const m = events.length;
    await w.ok(["person", "add", "Marie /Lhotáková/", "--sex", "F"]);
    await waitFor(() => events.slice(m).some((e) => e.event === "change"), "change");
    await new Promise((ok) => setTimeout(ok, 500));
    assert.equal(events.slice(m).filter((e) => e.event === "history").length, 0, JSON.stringify(events.slice(m)));
  } finally {
    ac.abort();
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("link experiment: on asks once in the research's terminal (yes: on for this computer, the tree's off taken away), no: nothing; off at once; no terminal: nothing asked or turned on; an archive refused in a sentence", opts, async () => {
  assert.ok((LINK_ACTIONS as readonly string[]).includes("experiment"), "said in /status links and _STROM_LINKS");
  assert.throws(() => parseLink("strom-research://experiment?tree=0f8c2d4e-1b2a-4c3d-9e8f-7a6b5c4d3e2f&name=stories&do=on"));
  assert.throws(() => parseLink("strom-research://experiment?tree=0f8c2d4e-1b2a-4c3d-9e8f-7a6b5c4d3e2f&name=history&do=maybe"));
  const { w, id } = await world(false);
  const config = () => readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json")).experimentsHistory;
  const treeOwn = () => readJsonFile(path.join(w.cwd, "strom.json")).experimentsHistory;
  const link = (what: "on" | "off") => `strom-research://experiment?tree=${id}&name=history&do=${what}`;
  try {
    // no terminal: nothing asked, nothing turned on
    const quiet = await w.run(["link", "open", link("on"), "--json"]);
    assert.equal(config(), undefined, quiet.out + quiet.err);
    // a no: nothing
    const no = await w.run(["link", "open", link("on")], { tty: true, answers: ["n", ""] });
    assert.match(no.out, /Aplikace Strom žádá: hledat události dějin v místech tohoto stromu – války, epidemie, sčítání, změny státu\nVýzkum: Lhotákovi/u, no.out);
    assert.match(no.out, /Experiment: hledá se jen tehdy, když rodinný výzkum nemá co dělat, nejvýš jedno sezení denně do 60 minut\./u);
    assert.match(no.out, /platí pro všechny výzkumy na něm/u, "this computer's setting changes: said");
    assert.doesNotMatch(no.out, /\b(vy|váš|ty|tvůj)\b/iu);
    assert.equal(config(), undefined);
    // off for the tree first, then the yes: on here, the tree's off taken away
    await w.ok(["link", "open", link("off"), "--json"]);
    assert.equal(treeOwn(), "off");
    const yes = await w.run(["link", "open", link("on")], { tty: true, answers: ["a", ""] });
    assert.match(yes.out, /Hledání událostí dějin je pro tento výzkum zapnuté\./u, yes.out + yes.err);
    assert.equal(config(), "on");
    assert.equal(treeOwn(), undefined);
    // on already: nothing asked
    const again = await w.run(["link", "open", link("on")], { tty: true, answers: [""] });
    assert.match(again.out, /zapnuté už/u);
    assert.doesNotMatch(again.out, /Aplikace Strom žádá/u);
    // off in the terminal: no question
    const off = await w.run(["link", "open", link("off")], { tty: true, answers: [""] });
    assert.match(off.out, /Hledání událostí dějin je pro tento výzkum vypnuté; co už bylo nalezeno, zůstává\./u, off.out);
    assert.equal(treeOwn(), "off");
    assert.equal(config(), "on", "the person's own config stays");
    // an archive: one sentence, nothing of an agent, nothing changed
    await w.ok(["mode", "archive"], { tty: true });
    const archive = await w.run(["link", "open", link("on")], { tty: true, answers: ["a", ""] });
    assert.match(archive.out, /Dokud je výzkum vedený jako archiv, události dějin se nehledají\. Nic se nestalo\./u, archive.out);
    assert.doesNotMatch(archive.out, /agent|AI\b|Claude/iu);
    assert.equal(treeOwn(), "off");
  } finally {
    w.cleanup();
  }
});
