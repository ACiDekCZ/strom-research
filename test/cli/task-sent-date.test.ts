// The day a request really went out (spec 149, K057): strom task sent --date — kept as given, put right on a task
// marked sent already (the day before said, the same command with it puts it back), refused in the future or when no
// day of the calendar; how long it waits and the 30 days without a reply count from it, by the calendar of this
// computer — the day is never shown a day off around midnight, in any time zone. The menu's What waits asks the day
// (Enter today) and puts it right; the bridge takes {"do": "sent", "at": "YYYY-MM-DD"} (feature waiting.sentDay), one
// day for a whole place.

import { test } from "node:test";
import assert from "node:assert/strict";
import { World, hasGit } from "../helpers.ts";
import { fixedClock } from "../fixed-clock.ts";
import { Tree } from "../../src/core/tree.ts";
import type { Task } from "../../src/core/model.ts";
import { normId } from "../../src/core/records.ts";
import { givenSentDay, localDay, sentDay, sentOn } from "../../src/core/waitkind.ts";
import { sentWords } from "../../src/cli/menu-waiting.ts";
import { typedDay } from "../../src/cli/menu-links.ts";
import { translator } from "../../src/cli/menu-parts.ts";
import { changeLines } from "../../src/core/changelog.ts";
import { get, post } from "./sync.helpers.ts";

const opts = { skip: !hasGit };
const bridged = { skip: !hasGit || process.platform === "win32" };
const app = { Origin: "https://beta.stromapp.info", "Content-Type": "application/json" };

/** Noon of 27 Nov 2026 on this computer's clock. */
const NOON = () => new Date(2026, 10, 27, 12, 0, 0).getTime();

/** Letters to the registry office of Lhota (T1, T2), one to Lhotice (T3), the family (T4). */
async function world(): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["research", "new", "Předci Lhotáka", "--new-person", "Ondřej /Lhoták/", "--sex", "M", "--born", "1902"]);
  const add = (what: string) => w.ok(["task", "add", what, "--level", "request", "--where", "matrika Lhota", "--why", "rodiče", "--done-when", "odpověď", "--about", "P1", "--anyway"]);
  for (const what of ["Opis křtu Ondřeje", "Opis sňatku rodičů", "Opis z Lhotic", "Vzpomínky na Ondřeje"]) await add(what);
  await w.ok(["task", "wait", "T1", "--on", "Odpověď matriky na žádost o opis křtu.", "--kind", "letter", "--to", "Matriční úřad Lhota"]);
  await w.ok(["task", "wait", "T2", "--on", "Odpověď matriky na žádost o opis sňatku.", "--kind", "letter", "--to", "Matriční úřad Lhota"]);
  await w.ok(["task", "wait", "T3", "--on", "Odpověď matriky v Lhoticích.", "--kind", "letter", "--to", "Matriční úřad Lhotice"]);
  await w.ok(["task", "wait", "T4", "--on", "Vzpomínky rodiny.", "--kind", "family"]);
  return w;
}

const task = (w: World, id: string) => Tree.open(w.cwd, w.env).get<Task>(normId(id, "task"))!;
const code = async (w: World, args: string[]) => {
  const r = await w.run([...args, "--json"]);
  assert.notEqual(r.code, 0, r.out);
  return JSON.parse(r.out).code as string;
};

test("task sent --date: the day kept as given, shown and counted from it; put right on a task sent already (the day before said, the same command puts it back); the same day or none, nothing changed; refused in the future, no day of the calendar, with --undo", opts, async () => {
  const clock = fixedClock(NOON());
  const w = await world();
  try {
    const r = await w.ok(["task", "sent", "T1", "--date", "2026-11-24", "--json"]);
    assert.deepEqual([r.json.changed, r.json.sentAt, r.json.sentDay, r.json.phase], [true, "2026-11-24T12:00:00.000Z", "2026-11-24", "sent"]);
    assert.deepEqual([task(w, "T1").state, task(w, "T1").sent], ["waiting", { at: "2026-11-24T12:00:00.000Z", by: "user" }]);
    assert.match((await w.ok(["task", "show", "T1"])).out, /\nwaits {2}letter · Matriční úřad Lhota \([^)]+\) · sent 2026-11-24\n/u);
    // counted from it by the calendar: 3 days, whatever the hour
    const cs = translator("cs");
    assert.equal(sentWords(cs, "cs", task(w, "T1").sent!.at), "odesláno 24. 11. · před 3 dny");
    assert.equal(sentWords(cs, "cs", task(w, "T1").sent!.at, new Date(2026, 10, 27, 0, 5).getTime()), "odesláno 24. 11. · před 3 dny");
    // put right: the task still waits, the day before said with the command that puts it back, in the history
    const fix = await w.ok(["task", "sent", "T1", "--date", "2026-11-23"]);
    assert.match(fix.out, /T0001 sent on 2026-11-23 \(was 2026-11-24\) — back: strom task sent T0001 --date 2026-11-24\n/u);
    assert.deepEqual([task(w, "T1").state, task(w, "T1").sent?.at], ["waiting", "2026-11-23T12:00:00.000Z"]);
    const ops = Tree.open(w.cwd, w.env).readOps().filter((o) => o.targets.includes("T0001") && o.op.startsWith("task.sent"));
    assert.deepEqual(ops.map((o) => [o.op, o.summary]), [["task.sent", "T0001 request sent on 2026-11-24"], ["task.sent.date", "T0001 request sent on 2026-11-23 (was 2026-11-24)"]]);
    const tree = Tree.open(w.cwd, w.env);
    assert.match(changeLines(tree, ops.slice(1), "", "cs").map((l) => l.text).join("\n"), /^Opravené datum odeslání žádosti: /u);
    await w.ok(["task", "sent", "T1", "--date", "2026-11-24"]);
    assert.equal(sentDay(task(w, "T1").sent!.at), "2026-11-24");
    // the same day, or no day: nothing changed, the way to another day said
    const same = await w.ok(["task", "sent", "T1", "--date", "2026-11-24", "--json"]);
    assert.equal(same.json.changed, false);
    assert.match((await w.ok(["task", "sent", "T1"])).out, /T0001 was marked sent on 2026-11-24 already — nothing changed \(another day: strom task sent T0001 --date YYYY-MM-DD\)/u);
    // refused, nothing written: tomorrow, no day of the calendar, a day in another form, --undo with a day
    const before = JSON.stringify(Tree.open(w.cwd, w.env).list<Task>("task"));
    for (const bad of ["2026-11-28", "2026-02-30", "2026-13-01", "24.11.2026", "včera", "２０２６-１１-２０"]) assert.equal(await code(w, ["task", "sent", "T2", "--date", bad]), "task.bad-date", bad);
    assert.equal((await w.run(["task", "sent", "T2", "--undo", "--date", "2026-11-20"])).code === 0, false);
    assert.equal(JSON.stringify(Tree.open(w.cwd, w.env).list<Task>("task")), before);
    // today, and a day long before the task began to wait: both fine
    await w.ok(["task", "sent", "T2", "--date", "2026-11-27"]);
    assert.equal(sentWords(cs, "cs", task(w, "T2").sent!.at), "odesláno 27. 11. · dnes");
    await w.ok(["task", "sent", "T3", "--date", "2019-05-01"]);
    assert.match(sentWords(cs, "cs", task(w, "T3").sent!.at), /^odesláno 1\. 5\. 2019 · před \d+ dny · bez odpovědi přes 30 dní$/u);
    // the 30 days without a reply: from the day given — 30 days not yet, 31 marked
    await w.ok(["task", "sent", "T4", "--date", "2026-10-28"]);
    assert.equal(sentWords(cs, "cs", task(w, "T4").sent!.at), "odesláno 28. 10. · před 30 dny");
    await w.ok(["task", "sent", "T4", "--date", "2026-10-27"]);
    assert.equal(sentWords(cs, "cs", task(w, "T4").sent!.at), "odesláno 27. 10. · před 31 dny · bez odpovědi přes 30 dní");
    // several at once: one day for all
    await w.ok(["task", "sent", "T1", "T2", "--date", "2026-11-25"]);
    assert.deepEqual(["T1", "T2"].map((id) => sentDay(task(w, id).sent!.at)), ["2026-11-25", "2026-11-25"]);
  } finally {
    clock.stop();
    w.cleanup();
  }
});

test("the day around midnight, in any time zone: today is this computer's day (tomorrow refused though UTC is there already), a day given is the same day on every clock, a request marked at 23:30 is of that day", opts, async () => {
  const tz = process.env.TZ;
  try {
    for (const zone of ["Europe/Prague", "America/Los_Angeles", "Pacific/Auckland", "Asia/Kolkata"]) {
      process.env.TZ = zone;
      const late = new Date(2026, 10, 27, 23, 30).getTime();
      const early = new Date(2026, 10, 28, 0, 30).getTime();
      assert.equal(localDay(late), "2026-11-27", zone);
      assert.equal(localDay(early), "2026-11-28", zone);
      assert.deepEqual(givenSentDay("2026-11-27", late), { day: "2026-11-27" }, zone);
      assert.ok("why" in givenSentDay("2026-11-28", late), zone);
      assert.deepEqual(givenSentDay("2026-11-28", early), { day: "2026-11-28" }, zone);
      // a day given, as given; a moment, the day of this computer's clock
      assert.equal(sentDay(sentOn("2026-11-27")), "2026-11-27", zone);
      assert.equal(sentDay(new Date(late).toISOString()), "2026-11-27", zone);
      assert.equal(sentDay(new Date(early).toISOString()), "2026-11-28", zone);
      const cs = translator("cs");
      assert.equal(sentWords(cs, "cs", sentOn("2026-11-27"), late), "odesláno 27. 11. · dnes", zone);
      assert.equal(sentWords(cs, "cs", sentOn("2026-11-27"), early), "odesláno 27. 11. · před 1 dnem", zone);
      assert.equal(sentWords(cs, "cs", new Date(late).toISOString(), early), "odesláno 27. 11. · před 1 dnem", zone);
      // what a person types in the menu
      assert.equal(typedDay("24. 11. 2026", late), "2026-11-24");
      assert.equal(typedDay("24.11.", late), "2026-11-24");
      assert.equal(typedDay("2026-11-27", late), "2026-11-27");
      assert.equal(typedDay("28. 11.", late), undefined, zone);
      assert.equal(typedDay("28. 11.", early), "2026-11-28", zone);
      assert.equal(typedDay("31. 2. 2026", late), undefined);
    }
  } finally {
    if (tz === undefined) delete process.env.TZ;
    else process.env.TZ = tz;
  }
});

test("task sent around midnight: at 23:30 in Los Angeles (UTC is the next day already) the request is of today, today may be given and tomorrow not", opts, async () => {
  const tz = process.env.TZ;
  process.env.TZ = "America/Los_Angeles";
  const clock = fixedClock(new Date(2026, 10, 27, 23, 30).getTime());
  const w = await world();
  try {
    assert.equal(new Date().toISOString().slice(0, 10), "2026-11-28", "UTC is the next day");
    const r = await w.ok(["task", "sent", "T1", "--json"]);
    assert.equal(r.json.sentDay, "2026-11-27");
    assert.match((await w.ok(["task", "show", "T1"])).out, / · sent 2026-11-27\n/u);
    await w.ok(["task", "sent", "T2", "--date", "2026-11-27"]);
    assert.equal(await code(w, ["task", "sent", "T3", "--date", "2026-11-28"]), "task.bad-date");
  } finally {
    clock.stop();
    w.cleanup();
    if (tz === undefined) delete process.env.TZ;
    else process.env.TZ = tz;
  }
});

test("the menu's What waits: Sent asks the day (a day typed kept, one in the future asked again), the whole place one day, a request sent put right", { skip: !hasGit || process.platform === "win32" }, async () => {
  const clock = fixedClock(NOON());
  const w = await world();
  try {
    // the whole place on one day: 3 What waits · 1 Lhota · its "sent for the whole group" · a · 20. 11. 2026
    const screen = await w.ok([], { tty: true, answers: ["3", "1", "0", "0"] });
    const n = /\[(\d)\] {2}Odesláno za celou skupinu/u.exec(screen.out)?.[1];
    assert.ok(n, screen.out);
    const group = await w.ok([], { tty: true, answers: ["3", "1", n!, "a", "20. 11. 2026", "0", "0"] });
    assert.match(group.out, /Den odeslání \(Enter = dnes; např\. 24\. 11\. 2026 nebo 2026-11-24\)/u);
    assert.match(group.out, /✓ Zapsáno jako odeslané 20\. 11\.: T0001, T0002 – dál čekají na odpověď\./u);
    assert.deepEqual(["T1", "T2"].map((id) => sentDay(task(w, id).sent!.at)), ["2026-11-20", "2026-11-20"]);
    // one: 3 What waits · 1 Lhotice (its one thing) · 1 Sent · a · tomorrow (asked again) · 24. 11. · 0 · 0
    const one = await w.ok([], { tty: true, answers: ["3", "1", "1", "a", "28. 11. 2026", "24. 11.", "0", "0"] });
    assert.match(one.out, /28\. 11\. 2026: takový den v kalendáři není, nebo teprve přijde/u);
    assert.match(one.out, /✓ Zapsáno jako odeslané 24\. 11\. – úkol dál čeká na odpověď\./u);
    assert.equal(task(w, "T3").sent?.at, "2026-11-24T12:00:00.000Z");
    // a request sent: its day put right (Enter goes back, nothing written); ? the sent · 1 Lhota · 1 T1 · its item · Enter
    const sent = await w.ok([], { tty: true, answers: ["3", "?", "1", "1", "0", "0", "0", "0"] });
    const m = /\[(\d)\] {2}Opravit datum odeslání/u.exec(sent.out)?.[1];
    assert.ok(m, sent.out);
    const kept = await w.ok([], { tty: true, answers: ["3", "?", "1", "1", m!, "", "0", "0", "0", "0"] });
    assert.match(kept.out, /Skutečný den odeslání \(např\. 24\. 11\. 2026 nebo 2026-11-24; Enter nebo 0 vrátí zpět\)/u);
    assert.equal(task(w, "T1").sent?.at, "2026-11-20T12:00:00.000Z", "Enter: nothing written");
    const fixed = await w.ok([], { tty: true, answers: ["3", "?", "1", "1", m!, "2026-11-22", "0", "0", "0", "0"] });
    assert.match(fixed.out, /✓ Odesláno 22\. 11\. – úkol dál čeká na odpověď\./u);
    assert.deepEqual([task(w, "T1").state, sentDay(task(w, "T1").sent!.at)], ["waiting", "2026-11-22"]);
  } finally {
    clock.stop();
    w.cleanup();
  }
});

test("the bridge: {do: sent, at} keeps the day (feature waiting.sentDay, the item's sentDay), puts it right on a request sent, refuses no day, the future, at with unsent; a whole place on one day", bridged, async () => {
  const clock = fixedClock(NOON());
  const w = await world();
  Object.assign(w.env, clock.env);
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const status = JSON.parse((await get(`${info.url}/status?poll=1`)).body);
    assert.ok(status.features.includes("waiting.sentDay"));
    const send = (id: string, body: unknown) => post(`${info.url}/waiting/${id}`, JSON.stringify(body), app);
    const s = await send("T0001", { do: "sent", at: "2026-11-24" });
    assert.equal(s.status, 200, s.body);
    const sb = JSON.parse(s.body);
    assert.deepEqual([sb.sent, sb.phase, sb.sentAt, sb.sentDay], [["T0001"], "sent", "2026-11-24T12:00:00.000Z", "2026-11-24"]);
    const item = (JSON.parse((await get(`${info.url}/status?poll=1`)).body).waiting as { id: string; sentAt?: string; sentDay?: string }[]).find((i) => i.id === "T0001")!;
    assert.deepEqual([item.sentAt, item.sentDay], ["2026-11-24T12:00:00.000Z", "2026-11-24"]);
    // the same day: nothing; another: put right, still waiting
    assert.deepEqual(JSON.parse((await send("T0001", { do: "sent", at: "2026-11-24" })).body).sent, []);
    const fix = JSON.parse((await send("T1", { do: "sent", at: "2026-11-23" })).body);
    assert.deepEqual([fix.sent, fix.phase, fix.sentDay], [["T0001"], "sent", "2026-11-23"]);
    assert.equal(task(w, "T1").state, "waiting");
    // refused, nothing written
    const before = JSON.stringify(Tree.open(w.cwd, w.env).list<Task>("task"));
    for (const at of ["2026-11-28", "2026-02-30", "24. 11. 2026", 20261124, null]) {
      const r = await send("T0002", { do: "sent", at });
      assert.deepEqual([r.status, JSON.parse(r.body).code], [400, "waiting.bad-date"], String(at));
    }
    const un = await send("T0001", { do: "unsent", at: "2026-11-20" });
    assert.deepEqual([un.status, JSON.parse(un.body).code], [400, "waiting.bad-body"]);
    assert.equal(JSON.stringify(Tree.open(w.cwd, w.env).list<Task>("task")), before);
    // a whole place: what is still to send there, on one day
    const key = (JSON.parse((await get(`${info.url}/status?poll=1`)).body).waiting as { id: string; group: { key: string } }[]).find((i) => i.id === "T0002")!.group.key;
    const g = await post(`${info.url}/group/${encodeURIComponent(key)}`, JSON.stringify({ do: "sent", at: "2026-11-20" }), app);
    assert.equal(g.status, 200, g.body);
    assert.deepEqual([JSON.parse(g.body).sent, JSON.parse(g.body).sentDay], [["T0002"], "2026-11-20"]);
    assert.deepEqual([sentDay(task(w, "T1").sent!.at), sentDay(task(w, "T2").sent!.at)], ["2026-11-23", "2026-11-20"], "T1 sent before, as it was");
    const bad = await post(`${info.url}/group/family`, JSON.stringify({ do: "sent", at: "zítra" }), app);
    assert.deepEqual([bad.status, JSON.parse(bad.body).code], [400, "waiting.bad-date"]);
    assert.equal(task(w, "T4").sent, undefined);
  } finally {
    await w.ok(["live", "stop"]);
    clock.stop();
    w.cleanup();
  }
});
