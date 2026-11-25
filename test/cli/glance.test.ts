// The app's screen Research on a device before it has the tree (spec 094 K3.13, src/core/glance.ts): GET <token>/glance
// says who works where and since when, the lines in the order of work, what waits for the person with what a device
// may do about each, the last 24 hours and the tree's size — each person it names by ID with the name, its texts as the
// phone's page says them, nothing of an agent, a model, a folder or a link of the computer; an archive the tree and the
// day alone. GET <token>/people?q= finds a person by the name (D1): at most 8, any script, a decomposed name too.

import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { World, hasGit, until } from "../helpers.ts";
import type { Glance } from "../../src/core/glance.ts";

const AGENT = { env: { AI_AGENT: "1" } };
// an app that decides hypotheses (its gate: core/stromapp.ts appDecidesHypotheses)
const APP = { Origin: "https://beta.stromapp.info", "X-Strom-App-Version": "99.0.0" };
const ID = /\b[PFSEXHTG]\d{4,}\b/u;
const skip = !hasGit || process.platform === "win32";

function ask(url: string, headers: Record<string, string> = {}): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { agent: false, headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("error", reject);
    req.end();
  });
}

test("the glance (GET <token>/glance): the lines, who works and on what, what waits and what a device may do, the people named; nothing of the computer; the app's pages alone; an archive the tree and the day", { skip, timeout: 180_000 }, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    await w.ok(["lang", "cs"]);
    for (const t of (await w.ok(["task", "list", "--state", "all", "--json"])).json.tasks as { id: string }[]) await w.ok(["task", "drop", t.id, "--reason", "test"]);
    const jan = (await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M", "--born", "1850", "--json"])).json.person.id as string;
    const line = (await w.ok(["research", "new", "Předci Jana", "--person", jan, "--json"])).json.research.id as string;
    // a request sent by letter, about Jan by ID in its words (said by the name)
    const letter = (await w.ok(["task", "add", "Opis křtu", "--level", "request", "--where", "matrika Lhota", "--why", "rodiče", "--done-when", "odpověď", "--about", jan, "--anyway", "--json"])).json.task.id as string;
    // its words with a file and a link of strom's own: only the computer opens them, a device sees neither
    await w.ok(["task", "wait", letter, "--on", `Odpověď matriky o ${jan}, soubor /Users/x/Documents/dopis.pdf, strom-research://open?tree=x.`, "--kind", "letter", "--to", "Matriční úřad Lhota"]);
    // what the family remembers: the person answers it
    const family = (await w.ok(["task", "add", "Vzpomínky rodiny", "--level", "locate", "--where", "rodina", "--why", "a", "--done-when", "b", "--about", jan, "--anyway", "--json"])).json.task.id as string;
    await w.ok(["task", "wait", family, "--on", "Vzpomínky rodiny na Jana.", "--kind", "family"]);
    // a question of whose son Jan was, an agent's proposal on it: the device decides it
    const hyp = (await w.ok(["hypothesis", "add", `Čí syn je ${jan}?`, "--about", jan, "--variant", "A: syn Václava", "--variant", "B: syn Josefa", "--json"], AGENT)).json.hypothesis.id as string;
    await w.ok(["hypothesis", "propose", hyp, "--variant", "A", "--decision", `křest ${jan}`], AGENT);
    // an agent at work on the line's task
    const work = (await w.ok(["task", "add", `Sňatek ${jan}`, "--level", "locate", "--where", "matrika Lhota", "--why", "manželka", "--done-when", "zápis", "--about", jan, "--json"])).json.task.id as string;
    await w.ok(["session", "start", work, "--json"], AGENT);

    const info = (await w.ok(["live", "start", "--json"])).json as { url: string; port: number };
    const status = JSON.parse((await ask(`${info.url}/status`, APP)).body) as { features: string[] };
    for (const f of ["glance", "people.search", "finds.person"]) assert.ok(status.features.includes(f), f);

    const got = await ask(`${info.url}/glance`, APP);
    assert.equal(got.status, 200, got.body);
    assert.equal(got.headers["access-control-allow-origin"], APP.Origin, "the app's pages may read it");
    assert.equal(got.headers["cache-control"], "no-store");
    const g = JSON.parse(got.body) as Glance;

    // the tree before it is downloaded
    assert.deepEqual([g.tree.name, g.tree.lang, g.tree.state, g.tree.persons, g.tree.families], ["Lhotákovi", "cs", "research", 1, 0]);
    assert.match(g.head, /^[0-9a-f]{40}$/u);
    assert.equal(g.day?.persons, 1);
    assert.ok((g.day?.saves ?? 0) >= 1, JSON.stringify(g.day));

    // the line, in the order of work
    assert.deepEqual(g.lines.map((l) => [l.id, l.n, l.name, l.way, l.direction, l.state, l.focus, l.working]), [[line, 1, "Předci Jana", "up", "ancestors", "active", jan, true]]);

    // who works now: on that line, the task by its ID and its words with the name
    assert.equal(g.now.length, 1, JSON.stringify(g.now));
    assert.deepEqual([g.now[0]!.line, g.now[0]!.way, g.now[0]!.task?.id, g.now[0]!.person], [line, "up", work, jan]);
    assert.equal(g.now[0]!.task?.text, "Sňatek Jan Lhoták");
    assert.equal(g.lastWorked, undefined, "somebody at work now");

    // what waits: each with what a device may do about it
    const of = (id: string) => g.waiting.items.find((x) => x.id === id)!;
    assert.equal(g.waiting.n, 3, JSON.stringify(g.waiting));
    assert.deepEqual([of(letter).person, of(letter).line, of(letter).phase, of(letter).what, of(letter).on], [jan, line, "todo", "Opis křtu", "Odpověď matriky o Jan Lhoták, soubor."]);
    assert.deepEqual([of(letter).group.name, of(letter).group.kind], ["Matriční úřad Lhota", "office"]);
    assert.deepEqual(of(letter).do, ["answer", "sent"]);
    assert.ok(of(family).do.includes("answer"), JSON.stringify(of(family)));
    const h = of(hyp);
    assert.deepEqual([h.kind, h.do, h.hypothesis?.variants.map((v) => v.label), h.hypothesis?.proposal], ["hypothesis", ["decide"], ["A", "B"], { variant: "A", decision: "křest Jan Lhoták" }]);
    // each person named by ID: the name and the years
    assert.deepEqual(g.people, { [jan]: { name: "Jan Lhoták", span: "*1850" } });

    // nothing only the computer has: no agent, model, step, folder, link, spend; no ID in a text
    assert.ok(!got.body.includes(w.home), "no folder of this computer");
    assert.doesNotMatch(got.body, /strom-research(-[\p{L}\p{N}]+)?:/u);
    assert.doesNotMatch(got.body, /"(who|agent|agentName|model|lastStep|path|work|links|spend|session)"/u);
    for (const t of [...g.now.map((n) => n.task?.text ?? ""), ...g.waiting.items.flatMap((x) => [x.what, x.on ?? ""]), ...g.lines.map((l) => l.name)]) assert.doesNotMatch(t, ID, t);

    // asked again with nothing changed: the same
    assert.deepEqual(JSON.parse((await ask(`${info.url}/glance`, APP)).body), g);
    // the tree's file not made yet: no size; made for the app: its size and head said before a device downloads it
    assert.equal(g.tree.ged, undefined);
    const file = await ask(`${info.url}/tree.ged`, APP);
    assert.equal(file.status, 200);
    let sized: Glance | undefined;
    await until("the size of the tree's file", async () => {
      sized = JSON.parse((await ask(`${info.url}/glance`, APP)).body) as Glance;
      return !!sized.tree.ged;
    }, { ms: 20_000, state: () => sized?.tree });
    assert.equal(sized!.tree.ged!.bytes, Buffer.byteLength(file.body, "utf8"));
    assert.equal(sized!.tree.ged!.head, g.head);

    // the letter sent, as the device says it (POST waiting/<T> {do: sent}): sent now, it may be taken back
    const sent = await fetch(`${info.url}/waiting/${letter}`, { method: "POST", headers: { ...APP, "Content-Type": "text/plain;charset=UTF-8" }, body: JSON.stringify({ do: "sent" }) });
    assert.equal(sent.status, 200, await sent.text());
    const after = JSON.parse((await ask(`${info.url}/glance`, APP)).body) as Glance;
    const was = after.waiting.items.find((x) => x.id === letter)!;
    assert.deepEqual([was.phase, was.do, !!was.sentAt], ["sent", ["answer", "unsent"], true]);

    // the secret as /status: another one or none — nothing
    assert.equal((await ask(`http://127.0.0.1:${info.port}/${"0".repeat(32)}/glance`, APP)).status, 404);
    assert.equal((await ask(`http://127.0.0.1:${info.port}/glance`, APP)).status, 404);

    // an archive: the tree and the day alone — nobody works there, nothing waits
    await w.ok(["mode", "archive"], { tty: true });
    let archived: Glance | undefined;
    await until("the bridge sees the archive", async () => {
      archived = JSON.parse((await ask(`${info.url}/glance`, APP)).body) as Glance;
      return archived.tree.state === "archive";
    }, { ms: 20_000, state: () => archived });
    assert.deepEqual([archived!.now, archived!.runs, archived!.lines, archived!.waiting], [[], [], [], { n: 0, items: [] }]);
    assert.equal(archived!.tree.persons, 1);

    // a page that is no Strom app: nothing, no CORS (its secret replaced at once: asked last)
    const foreign = await ask(`${info.url}/glance`, { Origin: "https://evil.example" });
    assert.equal(foreign.status, 404);
    assert.equal(foreign.headers["access-control-allow-origin"], undefined);
    assert.equal(foreign.body, "");
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("the glance of each version of the app (GET <token>/glance): what /status/waiting gives that version, whichever asks first", { skip, timeout: 180_000 }, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    await w.ok(["lang", "cs"]);
    for (const t of (await w.ok(["task", "list", "--state", "all", "--json"])).json.tasks as { id: string }[]) await w.ok(["task", "drop", t.id, "--reason", "test"]);
    const jan = (await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M", "--born", "1850", "--json"])).json.person.id as string;
    const letter = (await w.ok(["task", "add", "Opis křtu", "--level", "request", "--where", "matrika Lhota", "--why", "rodiče", "--done-when", "odpověď", "--about", jan, "--anyway", "--json"])).json.task.id as string;
    await w.ok(["task", "wait", letter, "--on", "Odpověď matriky.", "--kind", "letter", "--to", "Matriční úřad Lhota"]);
    // a question with an agent's proposal: only an app that decides hypotheses is given it
    const hyp = (await w.ok(["hypothesis", "add", `Čí syn je ${jan}?`, "--about", jan, "--variant", "A: syn Václava", "--variant", "B: syn Josefa", "--json"], AGENT)).json.hypothesis.id as string;
    await w.ok(["hypothesis", "propose", hyp, "--variant", "A", "--decision", "křest"], AGENT);

    const info = (await w.ok(["live", "start", "--json"])).json as { url: string };
    // an app of no version said (an older one, a device without its copy) and one that decides hypotheses
    const OLD = { Origin: APP.Origin };
    const glance = async (h: Record<string, string>) => (JSON.parse((await ask(`${info.url}/glance`, h)).body) as Glance).waiting.items.map((x) => x.id).sort();
    const waiting = async (h: Record<string, string>) => (JSON.parse((await ask(`${info.url}/status/waiting`, h)).body) as { waiting: { id: string }[] }).waiting.map((x) => x.id).sort();
    const each = async (first: Record<string, string>, then: Record<string, string>, why: string) => {
      const a = await glance(first);
      const b = await glance(then);
      assert.deepEqual(a, await waiting(first), `${why}: the first asked`);
      assert.deepEqual(b, await waiting(then), `${why}: the second asked`);
    };
    await each(APP, OLD, "the newer first");
    assert.deepEqual(await glance(APP), [hyp, letter].sort());
    assert.deepEqual(await glance(OLD), [letter]);
    // a new state: the other way round
    await w.ok(["person", "add", "Petr /Lhoták/", "--sex", "M"]);
    await each(OLD, APP, "the older first");
    assert.deepEqual(await glance(OLD), [letter]);
    assert.deepEqual(await glance(APP), [hyp, letter].sort());
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("people (GET <token>/people?q=): at most 8 by the name with the years and the place; any script, a decomposed name; fewer than two letters none; the app's pages alone", { skip, timeout: 120_000 }, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    for (let i = 0; i < 9; i++) await w.ok(["person", "add", `Petr${"a".repeat(i)} /Lhoták/`, "--sex", "M"]);
    const zdenka = (await w.ok(["person", "add", "Zdeňka /Lhotáková/", "--sex", "F", "--json"])).json.person.id as string;
    await w.ok(["event", "add", zdenka, "BIRT", "--date", "1861", "--place", "Lhota, Čechy"]);
    await w.ok(["event", "add", zdenka, "DEAT", "--date", "1920"]);
    const olga = (await w.ok(["person", "add", "Ольга /Лхотакова/", "--sex", "F", "--json"])).json.person.id as string;
    await w.ok(["event", "add", olga, "DEAT", "--date", "1901", "--place", "Лхота"]);
    // a place whose first part is a folder of the computer: the next part a device may see; nothing of it: no place
    const rehor = (await w.ok(["person", "add", "Řehoř /Šťastný/", "--sex", "M", "--json"])).json.person.id as string;
    await w.ok(["event", "add", rehor, "DEAT", "--date", "1901", "--place", "/Users/x/Documents/tajne, Praha"]);
    const vit = (await w.ok(["person", "add", "Vít /Lhotský/", "--sex", "M", "--json"])).json.person.id as string;
    await w.ok(["event", "add", vit, "BIRT", "--date", "1870", "--place", "C:\\Users\\x\\tajne"]);

    const info = (await w.ok(["live", "start", "--json"])).json as { url: string; port: number };
    const find = async (q: string) => {
      const r = await ask(`${info.url}/people?q=${encodeURIComponent(q)}`, APP);
      assert.equal(r.status, 200, r.body);
      assert.equal(r.headers["access-control-allow-origin"], APP.Origin);
      return (JSON.parse(r.body) as { people: { id: string; name: string; span?: string; place?: string }[] }).people;
    };
    assert.equal((await find("Lhoták")).length, 8, "at most 8");
    assert.deepEqual(await find("zdeňka"), [{ id: zdenka, name: "Zdeňka Lhotáková", span: "1861–1920", place: "Lhota" }]);
    assert.deepEqual(await find("Zdeňka".normalize("NFD")), await find("zdeňka"), "a decomposed query");
    assert.equal((await find("zdeňka"))[0]!.name, "Zdeňka Lhotáková".normalize("NFC"), "said in NFC");
    assert.deepEqual(await find("ольга лхот"), [{ id: olga, name: "Ольга Лхотакова", span: "†1901", place: "Лхота" }]);
    assert.deepEqual(await find("rehor"), [{ id: rehor, name: "Řehoř Šťastný", span: "†1901", place: "Praha" }]);
    assert.deepEqual(await find("Řehoř".normalize("NFD")), await find("rehor"), "a decomposed query");
    assert.deepEqual(await find("vít lhotský"), [{ id: vit, name: "Vít Lhotský", span: "*1870" }], "no place, never an empty one");
    assert.deepEqual(await find("l"), [], "fewer than two letters");
    assert.deepEqual(await find(""), []);
    assert.deepEqual(await find("Nikdo"), []);

    // the secret as /status; a page that is no Strom app: nothing (asked last: its secret replaced at once)
    assert.equal((await ask(`http://127.0.0.1:${info.port}/${"0".repeat(32)}/people?q=lhot`, APP)).status, 404);
    const foreign = await ask(`${info.url}/people?q=lhot`, { Origin: "https://evil.example" });
    assert.equal(foreign.status, 404);
    assert.equal(foreign.headers["access-control-allow-origin"], undefined);
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});
