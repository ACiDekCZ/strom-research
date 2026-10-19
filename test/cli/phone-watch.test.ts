// What a paired phone's page shows of the research, with real processes (the phone's server on the loopback alone —
// STROM_PHONE_TEST): the tree whose QR code paired it opened; of the tree shown what waits, the last 24 hours, the
// newest change and the progress — never a path of this computer or a record's ID; the other trees' marks in the
// switcher; another page of the network, a phone not paired and a tree gone answered as for the photos.

import { mock, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { World, hasGit, until } from "../helpers.ts";
import { decodeQr, svgModules, terminalModules } from "../qr-decode.ts";
import { OVERVIEW_MS, treeOverview } from "../../src/core/phone-watch.ts";

const APP = { Origin: "https://stromapp.info", "Content-Type": "text/plain;charset=UTF-8" };
const ID = /\[[A-Z]\d{4,}\]/;

function request(url: string, headers: Record<string, string> = {}): Promise<{ status: number; body: Record<string, any> }> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { agent: false, headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (d: Buffer) => chunks.push(d));
      res.on("end", () => {
        let body: Record<string, any> = {};
        try {
          body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        } catch {
          // no JSON
        }
        resolve({ status: res.statusCode ?? 0, body });
      });
    });
    req.on("error", reject);
    req.end();
  });
}

const skip = !hasGit || process.platform === "win32";

test("the phone watches the research: paired by a tree's QR code, that tree opened; what waits, the day and the progress without paths or IDs; the switcher's marks", { skip }, async () => {
  const w = new World();
  try {
    await w.withTree("Dvořákovi");
    await w.ok(["lang", "cs"]);
    await w.ok(["person", "add", "Anežka /Dvořáková/", "--sex", "F"]); // P0001
    await w.ok(["task", "add", "Křest Anežky", "--level", "locate", "--where", "farnost Sloup", "--why", "rodiče", "--done-when", "zápis", "--about", "P0001"]);
    // what it waits on as an agent writes it: an ID, a link, a path of this computer, a bare ID
    await w.ok(["task", "wait", "T0001", "--on", "Poslat odkaz na knihu narozených [B0001] (https://www.archiv.example.org/kniha/12, /Users/nekdo/kniha.pdf, H0003)."]);
    const treeA = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
    // a second tree, in another script; its bridge shows the QR code
    await w.ok(["init", "Жуковы"]);
    const dirB = w.treeDir("Жуковы");
    const treeB = JSON.parse(fs.readFileSync(path.join(dirB, "strom.json"), "utf8")).id as string;
    assert.notEqual(treeA, treeB);

    const env = { STROM_ISOLATED: "1", STROM_PHONE_TEST_ANSWER: "yes", STROM_PHONE_TEST_ANSWER_MS: "200", STROM_LIVE_POLL_MS: "100" };
    const bridge = (await w.ok(["live", "start", "--json"], { env, cwd: dirB })).json as { url: string };
    assert.equal((await fetch(`${bridge.url}/phone/on`, { method: "POST", headers: APP, body: JSON.stringify({ lang: "cs" }) })).status, 200);
    let address = "";
    await until("the phone's server", async () => {
      address = (await request(`${bridge.url}/phone`)).body.addresses?.[0]?.url ?? "";
      return !!address;
    }, { ms: 20_000 });
    const pair = async (code: string) => {
      const r = await fetch(`${address}/pair`, { method: "POST", headers: { "Content-Type": "text/plain;charset=UTF-8", Origin: address }, body: JSON.stringify({ code }) });
      assert.equal(r.status, 200);
      return { body: (await r.json()) as Record<string, any>, cookie: r.headers.get("set-cookie")!.split(";")[0]! };
    };

    // paired by the QR code of the second tree's bridge: that tree opened
    const fromB = await pair(decodeQr(svgModules(await (await fetch(`${bridge.url}/phone/qr.svg`)).text())).text.split("#")[1]!);
    assert.equal(fromB.body.tree, treeB);
    const me = { Cookie: fromB.cookie };
    // strom phone qr in the first tree's folder: the page opens that one
    const shown = await w.ok(["phone", "qr"], { tty: true });
    const fromA = await pair(decodeQr(terminalModules(shown.out.split("\n\n")[0]!)).text.split("#")[1]!);
    assert.equal(fromA.body.tree, treeA);
    // the icon on the home screen (an iPhone's web app has cookies of its own): a code while the help is shown, given
    // back by the icon unpaired for a key of its own of the same phone — once, never to another page
    const icon = await fetch(`${address}/phone/icon.png`);
    assert.deepEqual([icon.status, icon.headers.get("content-type")], [200, "image/png"]);
    assert.ok((await icon.arrayBuffer()).byteLength > 1000);
    const own = { "Content-Type": "text/plain;charset=UTF-8", Origin: address };
    assert.equal((await fetch(`${address}/phone/home`, { method: "POST", headers: own })).status, 401, "paired alone");
    assert.equal((await fetch(`${address}/phone/home`, { method: "POST", headers: { ...me, Origin: "http://evil.example" } })).status, 403);
    const home = await fetch(`${address}/phone/home?tree=${encodeURIComponent(treeA)}`, { method: "POST", headers: { ...me, ...own } });
    assert.equal(home.status, 200);
    const homeCode = ((await home.json()) as { code: string }).code;
    assert.match(homeCode, /^[A-Za-z0-9_-]{22}$/);
    assert.equal((await fetch(`${address}/home`, { method: "POST", headers: { ...own, Origin: "http://evil.example" }, body: JSON.stringify({ code: homeCode }) })).status, 403);
    const claimed = await fetch(`${address}/home`, { method: "POST", headers: own, body: JSON.stringify({ code: homeCode }) });
    assert.equal(claimed.status, 200);
    const iconMe = { Cookie: claimed.headers.get("set-cookie")!.split(";")[0]! };
    assert.notEqual(iconMe.Cookie, me.Cookie);
    const iconSaid = (await claimed.json()) as { id: string; tree: string };
    assert.equal(iconSaid.tree, treeA, "the icon opens the tree shown as it was added");
    assert.equal(iconSaid.id, ((await (await fetch(`${address}/whoami`, { headers: me })).json()) as { id: string }).id, "the same phone");
    assert.equal((await request(`${address}/phone/state?tree=${treeB}`, iconMe)).status, 200);
    assert.equal((await request(`${address}/phone/state`, me)).status, 200, "the browser's key still holds");
    assert.equal((await fetch(`${address}/home`, { method: "POST", headers: own, body: JSON.stringify({ code: homeCode }) })).status, 410, "once alone");
    assert.ok(!fs.readFileSync(path.join(w.env.STROM_CONFIG_DIR!, "phones.json"), "utf8").includes(iconMe.Cookie.split("=")[1]!), "never the key");

    // nothing of the research unpaired, nothing to another page of the network
    assert.equal((await request(`${address}/phone/log?tree=${treeA}`)).status, 401);
    assert.equal((await request(`${address}/phone/log?tree=${treeA}`, { ...me, Origin: "http://evil.example" })).status, 403);
    assert.equal((await request(`${address}/phone/state?tree=${treeA}`, { ...me, Origin: "http://evil.example" })).status, 403);

    // the tree shown: what waits (its text without the IDs), no agent at work, the newest change; the other tree's marks
    const state = await request(`${address}/phone/state?tree=${encodeURIComponent(treeA)}`, me);
    assert.equal(state.status, 200);
    const marks = Object.fromEntries(state.body.trees.map((t: Record<string, any>) => [t.name, [t.working, t.waiting, t.archive]]));
    assert.deepEqual(marks, { Dvořákovi: [false, 1, false], Жуковы: [false, 0, false] });
    const o = state.body.shown;
    assert.deepEqual(o.now, []);
    assert.equal(o.lastWorked, undefined, "nobody has worked on it");
    assert.equal(o.waiting.n, 1);
    assert.equal(o.waiting.items.length, 1);
    assert.equal(o.waiting.items[0].on, "Poslat odkaz na knihu narozených (archiv.example.org).");
    assert.ok(!ID.test(JSON.stringify(o)), JSON.stringify(o));
    assert.doesNotMatch(JSON.stringify(o), /https?:|\/Users\/|H0003|T0001/u, "no link, path or bare ID");
    assert.match(o.latest, /^[0-9a-f]{12}$/);
    assert.ok(!JSON.stringify(state.body).includes(w.home), "no path of this computer");
    // the last 24 hours, worked out in the background
    let day: Record<string, any> = {};
    await until("the day", async () => !!(day = (await request(`${address}/phone/state?tree=${treeA}`, me)).body.shown.day), { ms: 20_000 });
    assert.ok(day.persons >= 1 && day.saves >= 3, JSON.stringify(day));
    // no tree asked: no overview
    assert.equal((await request(`${address}/phone/state`, me)).body.shown, undefined);
    // a tree asked that is gone: as the progress answers it
    const gone = await request(`${address}/phone/state?tree=nope`, me);
    assert.deepEqual([gone.status, gone.body.code], [404, "phone.tree-gone"]);

    // the progress: newest first, without IDs; fewer asked, more said
    const log = await request(`${address}/phone/log?tree=${encodeURIComponent(treeA)}`, me);
    assert.equal(log.status, 200);
    assert.ok(log.body.changes.length >= 3);
    assert.equal(log.body.changes[0].id, o.latest);
    assert.equal(log.body.more, false);
    for (const c of log.body.changes) {
      assert.ok(Number.isFinite(Date.parse(c.at)));
      assert.ok(c.lines.length >= 1 && c.lines.length <= 3, JSON.stringify(log.body.changes));
      assert.ok(!c.lines.some((l: string) => ID.test(l)), c.lines.join(" | "));
    }
    assert.ok(log.body.changes.some((c: { lines: string[] }) => c.lines.some((l) => l.includes("Anežka Dvořáková"))), JSON.stringify(log.body.changes));
    assert.ok(!JSON.stringify(log.body).includes(w.home));
    const one = await request(`${address}/phone/log?tree=${treeA}&limit=1`, me);
    assert.deepEqual([one.body.changes.length, one.body.more], [1, true]);
    assert.equal((await request(`${address}/phone/log?tree=nope`, me)).body.code, "phone.tree-gone");

    // a new change: the newest one another, on top of the progress
    await w.ok(["person", "add", "Ольга /Жукова/", "--sex", "F"]);
    await until("the new change", async () => (await request(`${address}/phone/state?tree=${treeA}`, me)).body.shown.latest !== o.latest, { ms: 20_000 });
    const after = await request(`${address}/phone/log?tree=${treeA}`, me);
    assert.notEqual(after.body.changes[0].id, o.latest);
    assert.equal(after.body.changes[1].id, o.latest);
    assert.ok(after.body.changes[0].lines.some((l: string) => l.includes("Ольга Жукова")), JSON.stringify(after.body.changes[0]));

    // an agent at work on it (a conversation strom did not start): its line in "Now", the tree marked working
    const workers = path.join(w.cwd, ".strom", "workers");
    fs.mkdirSync(workers, { recursive: true });
    const since = new Date().toISOString();
    fs.writeFileSync(path.join(workers, "chat-1.json"), JSON.stringify({ pid: process.pid, host: os.hostname(), at: since, owner: "Codex conversation" }));
    let busy: Record<string, any> = {};
    await until("at work", async () => (busy = (await request(`${address}/phone/state?tree=${treeA}`, me)).body).shown.now.length === 1, { ms: 20_000 });
    const line = busy.shown.now[0];
    assert.deepEqual([line.way, line.since, line.paused], ["other", since, undefined]);
    assert.ok(line.name && !ID.test(line.name), line.name);
    assert.equal(busy.shown.lastWorked, undefined);
    assert.equal(busy.trees.find((t: { id: string }) => t.id === treeA).working, true);
  } finally {
    w.cleanup();
  }
});

test("the overview of the tree shown is kept longer than the page waits between two asks: worked out again only after it, or at a new change or an agent coming", { skip }, async () => {
  const w = new World();
  const now = { ms: Date.now() };
  const clock = mock.method(Date, "now", () => now.ms);
  try {
    await w.withTree("Dvořákovi");
    await w.ok(["task", "add", "Křest Anežky", "--level", "locate", "--where", "farnost Sloup", "--why", "rodiče", "--done-when", "zápis"]);
    await w.ok(["task", "wait", "T0001", "--on", "Odpověď farnosti"]);
    assert.ok(OVERVIEW_MS >= 15_000, "longer than the page's 10 s");
    const first = treeOverview(w.cwd, w.env);
    assert.equal(first.waiting.n, 1);
    // the page asks again 10 s later, then 14 s: nothing worked out again
    now.ms += 10_000;
    assert.equal(treeOverview(w.cwd, w.env).waiting, first.waiting);
    now.ms += 4_000;
    assert.equal(treeOverview(w.cwd, w.env).waiting, first.waiting);
    // past the time: worked out again
    now.ms += 2_000;
    const second = treeOverview(w.cwd, w.env);
    assert.notEqual(second.waiting, first.waiting);
    assert.deepEqual(second.waiting, first.waiting);
    // a new change: at once
    await w.ok(["person", "add", "Anežka /Dvořáková/", "--sex", "F"]);
    const changed = treeOverview(w.cwd, w.env);
    assert.notEqual(changed.latest, second.latest);
    assert.notEqual(changed.waiting, second.waiting);
    // an agent coming: at once
    const workers = path.join(w.cwd, ".strom", "workers");
    fs.mkdirSync(workers, { recursive: true });
    fs.writeFileSync(path.join(workers, "chat-1.json"), JSON.stringify({ pid: process.pid, host: os.hostname(), at: new Date(now.ms).toISOString(), owner: "Codex conversation" }));
    assert.equal(treeOverview(w.cwd, w.env).now.length, 1);
  } finally {
    clock.mock.restore();
    w.cleanup();
  }
});
