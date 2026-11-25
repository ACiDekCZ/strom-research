// Returning a waiting task to the agent from What waits (spec 089, core/retry.ts, strom task wake --retry): offered only
// for images the agent could manage alone once the cause is gone — the browser held the downloads back (held), images
// to be saved by hand of an archive the agent's browser may reach (ready, no-extension), a viewer strom media save does
// not know (screen: only read from the screen, even with no images named) — never a letter, the family, an archive the
// person did not allow through the browser; why it waits now said beside it, with its images. The person's alone (an
// agent refused), all or none, no answer written, the browser's saves of it dropped; first in the queue with its earlier
// sessions not counted and not taken as images the user has to download; held back again it waits once more saying so,
// at most RETRY_MAX returns a day. Two synthetic archives, no request leaves this computer.

import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import http from "node:http";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { fixedClock } from "../fixed-clock.ts";
import { grantWay } from "../../src/core/terms.ts";
import { Tree } from "../../src/core/tree.ts";
import { waitingFor } from "../../src/core/waiting.ts";
import { rankedQueue } from "../../src/commands/tasks.ts";
import { RETRY_MAX, RETRY_WINDOW_MS, retryLimit, retryOf, type RetryView } from "../../src/core/retry.ts";
import type { Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit };
const AGENT = { CLAUDECODE: "1", CLAUDE_CODE_SESSION_ID: "lhotak-vraci" };

const out: string[] = [];
const keep = { request: https.request, get: https.get, hrequest: http.request, hget: http.get, fetch: globalThis.fetch };
const refuse = (u: unknown) => {
  out.push(String(u));
  throw new Error("no network in this test");
};
before(() => {
  (https as { request: unknown }).request = refuse;
  (https as { get: unknown }).get = refuse;
  (http as { request: unknown }).request = refuse;
  (http as { get: unknown }).get = refuse;
  globalThis.fetch = (u) => Promise.reject(refuse(u));
});
after(() => {
  Object.assign(https, { request: keep.request, get: keep.get });
  Object.assign(http, { request: keep.hrequest, get: keep.hget });
  globalThis.fetch = keep.fetch;
});

const LHOTA = { host: "www.archiv-lhota.example", page: (book: number, n: number) => `https://www.archiv-lhota.example/kniha/${book}?snimek=${n}` };
const PODHRADI = { host: "matriky.podhradi.example", page: (book: number, n: number) => `https://matriky.podhradi.example/detail/${book}#${n}` };
const ARON = "https://www.archiv-lhota.example/aron/pozemkova-kniha/9";

/** The Claude in Chrome extension in a profile of this computer's Chrome (the agent's browser strom keeps). */
function extension(w: World, on = true): void {
  const home = w.env.HOME!;
  const dir =
    process.platform === "darwin"
      ? path.join(home, "Library", "Application Support", "Google", "Chrome")
      : process.platform === "win32"
        ? path.join(w.env.LOCALAPPDATA ?? path.join(home, "AppData", "Local"), "Google", "Chrome", "User Data")
        : path.join(home, ".config", "google-chrome");
  const ext = path.join(dir, "Default", "Extensions", "fcoeoabgfenejglbffodgkkbkcdhcgfn");
  if (on) fs.mkdirSync(ext, { recursive: true });
  else fs.rmSync(ext, { recursive: true, force: true });
}

const records = (w: World) => path.join(w.cwd, ".strom", "browser-saves.json");

/** The agent's browser held image n of a task's book back (its record of strom media save, held). */
function held(w: World, task: string, recordset: string, n: number, more: Record<string, unknown> = {}): void {
  const f = records(w);
  const was = fs.existsSync(f) ? (readJsonFile(f) as unknown as Record<string, unknown>[]) : [];
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify([...was, { task, n, recordset, host: LHOTA.host, url: LHOTA.page(11, n), file: `held-${task}-${n}`, at: Date.now(), held: true, ...more }]));
}

/**
 * Lhota (the person allowed it "through the browser", its land registers under /aron/ only read from the screen) and
 * Podhradí (not allowed), both only through a browser; the extension in Chrome. Tasks: T1 images of B1 by hand, T2 a
 * letter, T3 a land register of /aron/ (words only), T4 an image of B1 the browser held back, T5 images of B2
 * (Podhradí), T6 the family.
 */
async function world(): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  const file = path.join(w.dir, "archives-test.json");
  fs.writeFileSync(
    file,
    JSON.stringify({
      archives: [
        { host: LHOTA.host, name: "Archiv Lhota", level: "restricted", browserOnly: true, screenOnly: ["/aron/"], checked: "2026-11-01" },
        { host: PODHRADI.host, name: "Archiv Podhradí", level: "restricted", browserOnly: true, checked: "2026-11-01" },
      ],
    }),
  );
  w.env.STROM_ARCHIVES_FILE = file;
  assert.ok(grantWay(w.env, [LHOTA.host], "browser", { by: "terminal" }));
  extension(w);
  await w.ok(["research", "new", "X", "--new-person", "Jan /Lhoták/"]);
  await w.ok(["recordset", "add", "Lhota N 1784–1820", "--url", LHOTA.page(11, 1)]); // B1
  await w.ok(["recordset", "add", "Podhradí N 1790–1830", "--url", PODHRADI.page(22, 1)]); // B2
  const add = (what: string, where: string, ...more: string[]) => w.ok(["task", "add", what, "--level", "link", "--where", where, "--why", "rodiče", "--done-when", "zápis nalezen", ...more]);
  await add("Křest Jana Lhotáka", "B0001"); // T1
  await w.ok(["task", "wait", "T1", "--images", "B1:5-7", "--on", "Snímky 5–7 knihy Lhota N 1784–1820 uložit ručně"]);
  await w.ok(["task", "add", "Opis oddacího zápisu", "--level", "request", "--where", "matrika Lhota", "--why", "rodiče", "--done-when", "odpověď", "--anyway"]); // T2
  await w.ok(["task", "wait", "T2", "--on", "Odpověď matriky na žádost o opis.", "--kind", "letter", "--to", "Matriční úřad Lhota"]);
  await add("Pozemková kniha Lhota", "pozemkové knihy", "--anyway"); // T3
  await w.ok(["task", "wait", "T3", "--on", `Pozemková kniha ${ARON} – jen v prohlížeči archivu`]);
  await add("Úmrtí Jana Lhotáka", "B0001", "--anyway"); // T4
  await w.ok(["task", "wait", "T4", "--images", "B1:8", "--on", "Snímek 8 knihy Lhota"]);
  held(w, "T0004", "B0001", 8);
  await add("Křest v Podhradí", "B0002", "--anyway"); // T5
  await w.ok(["task", "wait", "T5", "--images", "B2:3", "--on", "Snímek 3 knihy Podhradí uložit ručně"]);
  await w.ok(["task", "add", "Vzpomínky na Jana", "--level", "locate", "--where", "rodina", "--why", "a", "--done-when", "b", "--anyway"]); // T6
  await w.ok(["task", "wait", "T6", "--on", "Vzpomínky rodiny na Jana.", "--kind", "family"]);
  return w;
}

const shared = (w: World) => path.join(w.home, "shared");
const retries = (w: World): Record<string, RetryView | undefined> =>
  Object.fromEntries(
    waitingFor(Tree.open(w.cwd, w.env), { shared: shared(w) })
      .filter((x) => x.task)
      .map((x) => [x.task!.id, x.item.retry as RetryView | undefined]),
  );
const task = async (w: World, id: string): Promise<Task> => (await w.ok(["task", "show", id, "--json"])).json.task;
const fail = async (w: World, args: string[], env?: Record<string, string>) => {
  const r = await w.run([...args, "--json"], env ? { env } : {});
  assert.notEqual(r.code, 0, r.out);
  return JSON.parse(r.out) as { code: string; params?: Record<string, string> };
};

test("What waits: return to the agent offered only for images the agent could manage now — held back, by hand where its browser reaches, a viewer only read from the screen (no images named); never a letter, the family, an archive not allowed; why it waits now and its images (K1.2, K1.2b, K2.1, K3.1)", opts, async () => {
  const w = await world();
  try {
    let r = retries(w);
    assert.deepEqual(
      Object.entries(r)
        .filter(([, v]) => v)
        .map(([k]) => k)
        .sort(),
      ["T0001", "T0003", "T0004"],
    );
    const t1 = r.T0001!;
    assert.deepEqual([t1.why, t1.host, t1.images, t1.can, t1.screen, t1.again], ["ready", LHOTA.host, 3, true, undefined, undefined]);
    // (the research's language: Czech)
    assert.match(t1.says, /^prohlížeč agenta k Archiv Lhota teď dosáhne – snímky uloží sám$/u);
    const t3 = r.T0003!;
    assert.deepEqual([t3.why, t3.screen, t3.images, t3.can], ["screen", true, undefined, true]);
    assert.match(t3.says, /jen čtení z obrazovky, snímky se neuloží/u);
    const t4 = r.T0004!;
    assert.deepEqual([t4.why, t4.host, t4.images], ["held", LHOTA.host, 1]);
    assert.match(t4.says, new RegExp(`^prohlížeč zadržel stahování z ${LHOTA.host.replace(/\./g, "\\.")} – `, "u"));
    // the extension gone: what waits now said so — the screen's with its note
    extension(w, false);
    r = retries(w);
    assert.deepEqual([r.T0001?.why, r.T0003?.why, r.T0003?.screen, r.T0004?.why], ["no-extension", "no-extension", true, "held"]);
    assert.match(r.T0001!.says, /rozšíření Claude in Chrome není připojené/u);
    assert.match(r.T0003!.says, /; jen čtení z obrazovky, snímky se neuloží$/u);
    // strom's own list: the land registers of MZA (ARON) only read from the screen
    const { knownScreenOnly } = await import("../../src/core/knownterms.ts");
    assert.equal(knownScreenOnly("https://www.mza.cz/aron/apu/1234"), true);
    assert.equal(knownScreenOnly("https://www.mza.cz/actapublica/matrika/detail/1"), false);
    assert.deepEqual(out, [], "nothing left this computer");
  } finally {
    w.cleanup();
  }
});

test("strom task wake --retry: the person's alone, all or none; open, first in the queue together, no answer, the note of what it waited on, the browser's saves dropped; gone from What waits; held back again it waits saying so; at most RETRY_MAX a day (K1.1, K1.3, K1.4, K1.5)", opts, async () => {
  // "tried again HH:MM" is said of today alone: a fixed clock, never across midnight
  const clock = fixedClock();
  const w = await world();
  Object.assign(w.env, clock.env);
  try {
    await w.ok(["task", "add", "Rodiče Jana", "--level", "locate", "--where", "katalog", "--why", "a", "--done-when", "b", "--priority", "5", "--anyway"]); // T7, open, higher
    // an agent never: refused, nothing written
    assert.equal((await fail(w, ["task", "wake", "T1", "--retry"], AGENT)).code, "task.retry-person");
    assert.equal((await task(w, "T1")).state, "waiting");
    // not with an answer; several only with --retry
    assert.equal((await fail(w, ["task", "wake", "T1", "--retry", "--answer", "hotovo"])).code, "task.retry-answer");
    assert.notEqual((await w.run(["task", "wake", "T1", "T4"])).code, 0);
    // all or none: a letter among them — nothing returned
    const no = await fail(w, ["task", "wake", "T1", "T2", "--retry"]);
    assert.deepEqual([no.code, no.params?.task], ["task.retry-not", "T0002"]);
    assert.equal((await fail(w, ["task", "wake", "T5", "--retry"])).code, "task.retry-not", "an archive not allowed through the browser");
    assert.equal((await fail(w, ["task", "wake", "T6", "--retry"])).code, "task.retry-not", "the family");
    assert.equal((await fail(w, ["task", "wake", "T7", "--retry"])).code, "task.not-waiting");
    assert.equal((await task(w, "T1")).state, "waiting");

    const done = (await w.ok(["task", "wake", "T4", "T1", "--retry", "--json"])).json;
    assert.deepEqual(done.tasks.map((t: Task) => t.id), ["T0004", "T0001"]);
    for (const id of ["T1", "T4"]) {
      const t = await task(w, id);
      assert.equal(t.state, "open");
      assert.deepEqual(t.queueAt, { do: "next", at: done.at });
      assert.deepEqual(t.retried, { at: done.at, by: "user", times: [done.at] });
      assert.equal(t.answers, undefined, "nothing written as the person's answer");
      assert.match(t.notes.at(-1)!.text, /^vráceno agentovi z Co čeká; čekalo na: /u);
    }
    assert.match((await task(w, "T4")).notes.at(-1)!.text, /zadržel snímek 8/u, "what it waited on then");
    assert.equal(fs.existsSync(records(w)), false, "the browser's saves of it dropped");
    const r = retries(w);
    assert.equal("T0001" in r || "T0004" in r, false, "gone from What waits");

    // first in the queue, both, before the higher priority — not taken as images the user has to download
    const q = rankedQueue(Tree.open(w.cwd, w.env));
    assert.deepEqual(new Set(q.slice(0, 2).map((x) => x.task.id)), new Set(["T0001", "T0004"]));
    assert.equal(q[2]!.task.id, "T0007");
    for (const x of q.slice(0, 2)) {
      assert.match(x.why, /the person returned it to the agent \(What waits\)/);
      assert.doesNotMatch(x.why, /needs images the user has to download/);
    }

    // held back again: back in What waits, saying it was tried again
    const again = async () => {
      await w.ok(["task", "wait", "T4", "--images", "B1:8", "--on", "Snímek 8 knihy Lhota"]);
      held(w, "T0004", "B0001", 8);
      return retries(w).T0004!;
    };
    let v = await again();
    const first = (await task(w, "T4")).retried!.at;
    assert.equal(new Date(first).toDateString(), new Date(2026, 10, 18).toDateString(), "on the fixed clock");
    assert.deepEqual(v.again, { at: first });
    const d = new Date(first);
    const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    assert.ok(v.says.endsWith(`; zkoušeno znovu ${hm}, zase zadrženo`), v.says);
    // returned twice more: the fourth within a day refused, said when
    for (let i = 0; i < RETRY_MAX - 1; i++) {
      await w.ok(["task", "wake", "T4", "--retry"]);
      v = await again();
    }
    const t4 = await task(w, "T4");
    assert.equal(t4.retried!.times.length, RETRY_MAX);
    assert.deepEqual([v.can, v.until], [false, new Date(Date.parse(first) + RETRY_WINDOW_MS).toISOString()]);
    const limit = await fail(w, ["task", "wake", "T4", "--retry"]);
    assert.deepEqual([limit.code, limit.params?.until], ["task.retry-limit", v.until]);
    assert.equal((await task(w, "T4")).state, "waiting");
    // --expect: only the task as it was
    assert.equal((await fail(w, ["task", "wake", "T3", "--retry", "--expect", "2020-01-01T00:00:00.000Z"])).code, "task.changed");
    assert.equal((await w.ok(["task", "wake", "T3", "--retry", "--expect", (await task(w, "T3")).updated])).code, 0);
    assert.deepEqual(out, [], "nothing left this computer");
  } finally {
    w.cleanup();
    clock.stop();
  }
});

test("the queue: a task returned to the agent after three sessions and no images is not behind work that can be done now — only the sessions after the return count (K1.5)", opts, async () => {
  const w = await world();
  try {
    // T7: open work of the same priority; T8: a book's task tried three times, then waiting for images by hand
    await w.ok(["task", "add", "Rodiče Jana", "--level", "locate", "--where", "katalog", "--why", "a", "--done-when", "b", "--anyway"]); // T7
    await w.ok(["task", "add", "Sňatek Jana Lhotáka", "--level", "link", "--where", "B0001", "--why", "a", "--done-when", "b", "--anyway"]); // T8
    for (let i = 0; i < 3; i++) {
      await w.ok(["session", "start", "T8"]);
      await w.ok(["session", "close", "--continue", "--summary", "snímky chybí", "--next", "dál"]);
    }
    await w.ok(["task", "wait", "T8", "--images", "B1:20", "--on", "Snímek 20 knihy Lhota uložit ručně"]);
    await w.ok(["task", "wake", "T8", "--retry"]);
    const q = rankedQueue(Tree.open(w.cwd, w.env));
    const at = (id: string) => q.findIndex((x) => x.task.id === id);
    assert.ok(at("T0008") < at("T0007"), q.map((x) => `${x.task.id}: ${x.why}`).join("\n"));
    assert.doesNotMatch(q[at("T0008")]!.why, /tried \d×|needs images/);
    // once a session on it ended, its turn is over — counted from the return: tried once
    await w.ok(["session", "start", "T8"]);
    await w.ok(["session", "close", "--continue", "--summary", "zase nic", "--next", "dál"]);
    const after = rankedQueue(Tree.open(w.cwd, w.env)).find((x) => x.task.id === "T0008")!;
    assert.match(after.why, /tried 1×/);
  } finally {
    w.cleanup();
  }
});

test("retryLimit: RETRY_MAX returns within RETRY_WINDOW_MS, then not before the oldest of them + the window; the older ones not counted (fixed clock)", () => {
  const now = Date.parse("2026-11-24T12:00:00.000Z");
  const h = (n: number) => new Date(now - n * 3600_000).toISOString();
  const t = (times: string[]) => ({ retried: { at: times.at(-1)!, by: "user", times } }) as unknown as Task;
  assert.deepEqual(retryLimit(t([h(30), h(5), h(2)]), now), { can: true });
  assert.deepEqual(retryLimit(t([h(20), h(5), h(2)]), now), { can: false, until: new Date(now - 20 * 3600_000 + RETRY_WINDOW_MS).toISOString() });
  assert.deepEqual(retryLimit(t([h(23), h(20), h(5), h(2)]), now), { can: false, until: new Date(now - 20 * 3600_000 + RETRY_WINDOW_MS).toISOString() });
  assert.deepEqual(retryLimit({} as Task, now), { can: true });
  assert.equal(typeof retryOf, "function");
});

test("the bridge: waiting.retry — one task and one place returned to the agent as the person's in the app (givenIn app); refused: none offered (a letter), changed, no task that waits, a bad body, the limit; waiting[].retry says held, ready, the screen with no images named, and again once held back again (K1.4, K2.1, K3.1)", { skip: !hasGit || process.platform === "win32" }, async () => {
  // "tried again HH:MM" is said of today alone: a fixed clock (the bridge's too), never across midnight
  const clock = fixedClock();
  const w = await world();
  Object.assign(w.env, clock.env);
  const info = (await w.ok(["live", "start", "--json"])).json;
  // the bridge on this computer only (127.0.0.1): plain http to it, https still refused
  Object.assign(http, { request: keep.hrequest, get: keep.hget });
  try {
    const { get, post } = await import("./sync.helpers.ts");
    const app = { Origin: "https://beta.stromapp.info", "Content-Type": "application/json" };
    const status = async () => JSON.parse((await get(`${info.url}/status?poll=1`)).body);
    const items = async () => new Map<string, Record<string, any>>((await status()).waiting.map((x: Record<string, any>) => [x.id, x]));
    const send = (id: string, body: unknown, at = "waiting") => post(`${info.url}/${at}/${encodeURIComponent(id)}`, typeof body === "string" ? body : JSON.stringify(body), app);
    const s = await status();
    assert.ok(s.features.includes("waiting.retry"));
    let it = await items();
    assert.deepEqual([it.get("T0001")?.retry?.why, it.get("T0001")?.retry?.images, it.get("T0001")?.retry?.can], ["ready", 3, true]);
    assert.deepEqual([it.get("T0003")?.retry?.why, it.get("T0003")?.retry?.screen, "images" in (it.get("T0003")?.retry ?? {})], ["screen", true, false]);
    assert.deepEqual([it.get("T0004")?.retry?.why, it.get("T0004")?.retry?.host], ["held", LHOTA.host]);
    for (const id of ["T0002", "T0005", "T0006"]) assert.equal(it.get(id)?.retry, undefined, id);

    // refused, nothing written
    const before = JSON.stringify(Tree.open(w.cwd, w.env).list<Task>("task").map((t) => [t.id, t.state, t.updated]));
    const letter = await send("T0002", { do: "retry" });
    assert.deepEqual([letter.status, JSON.parse(letter.body).code, JSON.parse(letter.body).params], [409, "retry.not", { id: "T0002" }]);
    const changed = await send("T0001", { do: "retry", expect: "2020-01-01T00:00:00.000Z" });
    assert.deepEqual([changed.status, JSON.parse(changed.body).code], [409, "waiting.changed"]);
    assert.equal((await send("T0099", { do: "retry" })).status, 404);
    assert.deepEqual([(await send("T0001", { do: "retry", expect: 5 })).status], [400]);
    const foreign = await post(`${info.url}/waiting/T0001`, JSON.stringify({ do: "retry" }), { "Content-Type": "application/json" });
    assert.deepEqual([foreign.status, JSON.parse(foreign.body).code], [403, "app.only"]);
    assert.equal(JSON.stringify(Tree.open(w.cwd, w.env).list<Task>("task").map((t) => [t.id, t.state, t.updated])), before);

    // one task
    const one = await send("T0001", { do: "retry", expect: it.get("T0001")!.at });
    assert.equal(one.status, 200, one.body);
    const ob = JSON.parse(one.body);
    assert.deepEqual([ob.task, ob.state], ["T0001", "open"]);
    assert.match(ob.head, /^[0-9a-f]{40}$/);
    assert.match(ob.parent, /^[0-9a-f]{40}$/);
    const t1 = await task(w, "T1");
    assert.deepEqual([t1.state, t1.retried?.givenIn, t1.retried?.by, t1.answers], ["open", "app", "user", undefined]);
    assert.equal(new Date(t1.retried!.at).toDateString(), new Date(2026, 10, 18).toDateString(), "the bridge on the fixed clock");
    assert.match(t1.notes.at(-1)!.text, /^vráceno agentovi z Co čeká v aplikaci Strom; čekalo na: /u);

    // one place: all of it offered, in What waits' order, one command
    it = await items();
    const key = it.get("T0004")!.group.key as string;
    const offered = [...it.values()].filter((x) => x.group.key === key && x.retry?.can).map((x) => x.id);
    assert.ok(offered.includes("T0004"));
    const group = await send(key, { do: "retry" }, "group");
    assert.equal(group.status, 200, group.body);
    assert.deepEqual([JSON.parse(group.body).retried, JSON.parse(group.body).group], [offered, key]);
    for (const id of offered) assert.equal((await task(w, id)).state, "open");
    assert.equal((await send("nikde-ž", { do: "retry" }, "group")).status, 404);

    // held back again: waits saying it was tried again
    await w.ok(["task", "wait", "T4", "--images", "B1:8", "--on", "Snímek 8 knihy Lhota"]);
    held(w, "T0004", "B0001", 8);
    it = await items();
    assert.deepEqual(it.get("T0004")?.retry?.again, { at: (await task(w, "T4")).retried!.at });
    assert.match(it.get("T0004")!.retry.says, /zkoušeno znovu \d\d:\d\d, zase zadrženo$/u);
    // the place again with nothing else offered there now but T4 … and once nothing is, nothing written
    const g2 = JSON.parse((await send(key, { do: "retry" }, "group")).body);
    assert.deepEqual(g2.retried, ["T0004"]);
    // a place with nothing the agent could manage: nothing written, said so
    const other = it.get("T0005")!.group.key as string;
    assert.notEqual(other, key);
    const head = JSON.parse((await send(other, { do: "retry" }, "group")).body);
    assert.deepEqual([head.retried, head.group, head.head === head.parent], [[], other, true]);
    assert.equal((await task(w, "T5")).state, "waiting");

    // the limit: returned RETRY_MAX times within a day
    for (let i = 0; i < RETRY_MAX - 1; i++) {
      await w.ok(["task", "wait", "T1", "--images", "B1:5-7", "--on", "Snímky 5–7 knihy Lhota"]);
      await w.ok(["task", "wake", "T1", "--retry"]);
    }
    await w.ok(["task", "wait", "T1", "--images", "B1:5-7", "--on", "Snímky 5–7 knihy Lhota"]);
    const lim = await send("T0001", { do: "retry" });
    const lb = JSON.parse(lim.body);
    assert.deepEqual([lim.status, lb.code, lb.params.id], [409, "retry.limit", "T0001"]);
    assert.equal(lb.params.until, new Date(Date.parse(t1.retried!.at) + RETRY_WINDOW_MS).toISOString());
    assert.deepEqual(out, [], "nothing left this computer");
  } finally {
    (http as { request: unknown }).request = refuse;
    (http as { get: unknown }).get = refuse;
    await w.ok(["live", "stop"]);
    w.cleanup();
    clock.stop();
  }
});

test("the menu's What waits: return to the agent — one thing with its images and why it waits now, then all of a place at once in What waits' order; shown last, the person's (K1.1, K2.1, K3.1)", opts, async () => {
  const w = await world();
  try {
    // What waits (3) → the archive's place (1) → its first thing, T1 (1) → return to the agent (5) → back, back, end
    const one = (await w.ok([], { tty: true, answers: ["3", "1", "1", "5", "0", "0", "0"] })).out;
    assert.match(one, /\n {3}5 {2}Vrátit agentovi vše \(3 úkoly, 4 snímky\)\n {3}0 {2}Zpět/u, "the place: all at once, last");
    assert.match(one, /teď: prohlížeč agenta k Archiv Lhota teď dosáhne – snímky uloží sám\n/u);
    assert.match(one, /\n {3}4 {2}Rozhovor s agentem\n {3}5 {2}Vrátit agentovi \(3 snímky\)\n {3}0 {2}Zpět/u, "the thing: last");
    assert.match(one, /✓ Vráceno agentovi, na řadě hned: vezme si ho běžící výzkum, jinak příští spuštění\./u);
    const t1 = await task(w, "T1");
    assert.deepEqual([t1.state, t1.retried?.by, t1.retried?.givenIn, t1.queueAt?.do], ["open", "user", undefined, "next"]);
    // the place's two left, at once: T3 (the screen) and T4 (held back) — one command, in What waits' order
    const all = (await w.ok([], { tty: true, answers: ["3", "1", "4", "0", "0"] })).out;
    assert.match(all, /\n {3}4 {2}Vrátit agentovi vše \(2 úkoly, 1 snímek\)\n/u);
    assert.match(all, /✓ Vráceno agentovi, na řadě hned: T0003, T0004/u);
    for (const id of ["T3", "T4"]) assert.equal((await task(w, id)).state, "open");
    assert.equal((await task(w, "T5")).state, "waiting", "never one not offered");
  } finally {
    w.cleanup();
  }
});
