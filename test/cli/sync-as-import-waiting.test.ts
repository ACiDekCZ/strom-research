// What waits asks about a send of the Strom app that added many people as the person's own (1127, feature
// waiting.import): "did they come of a family tree (an import, a merge)?" — an older app marked no import, so every
// value came in as the person's (the app's ✓ "confirmed by a person"). The item W-S-I… (kind import, section decide,
// group app) for a send of at least sync.importAsk new people (default 20, 0 never) with a name still the person's own
// that cites a send, not answered yet; in /status and the menu's What waits, in an archive too. The bridge: GET
// /waiting/W-S-I…/preview (strom sync as-import's preview, nothing written), POST /waiting/W-S-I… {do: import|own}
// (strom sync as-import --apply | --own, as the person). Any script, any accent.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { archiveWaiting, waitingFor } from "../../src/core/waiting.ts";
import { importAnswered } from "../../src/core/sendimport.ts";
import type { Input, Person } from "../../src/core/model.ts";

const skip = !hasGit || process.platform === "win32";
const opts = { skip, timeout: 240_000 };
const APP = "https://beta.stromapp.info";
/** As the Strom app's bridge writes a send (strom sync … --apply in its process): the person's. */
const FROM_APP = { env: { STROM_FOR_APP: "1" } };

type Answer = { status: number; body: any; headers: http.IncomingHttpHeaders };
function request(url: string, method = "GET", body?: unknown, headers: Record<string, string> = { Origin: APP }): Promise<Answer> {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? undefined : Buffer.from(typeof body === "string" ? body : JSON.stringify(body), "utf8");
    const req = http.request(url, { agent: false, method, headers: { ...headers, ...(data ? { "Content-Type": "text/plain;charset=UTF-8", "Content-Length": String(data.length) } : {}) } }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (d) => (text += d));
      res.on("end", () => {
        let parsed: any = text;
        try {
          parsed = JSON.parse(text);
        } catch {
          // not JSON
        }
        resolve({ status: res.statusCode ?? 0, body: parsed, headers: res.headers });
      });
    });
    req.on("error", reject);
    req.end(data);
  });
}

const open = (w: World) => Tree.open(w.cwd, w.env);
const gitHead = (w: World) => execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
const ged = (lines: string[]) => [...lines, "0 TRLR", ""].join("\n");
const appHead = ["0 HEAD", "1 SOUR STROM", "2 VERS 3.31.0", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8"];

/** The first three people of a send: diacritics, written decomposed (NFD), a non-Latin script. */
const FIRST = ["Žofie /Lhotská/", "Ludmila /Lhotáková/".normalize("NFD"), "Ярослав /Лхотак/"];
const GIVEN = ["Jan", "Josef", "Karel", "Marie", "Anna", "Václav", "Ondřej", "František", "Antonín", "Jiří", "Tereza", "Barbora", "Kateřina", "Alžběta", "Vojtěch", "Matěj", "Dorota", "Rozálie", "Bohumil", "Eliška"];
/** A send of an older app (nothing marked of an import) adding `n` people: Lhotákovi and Lhotovi. */
function people(n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const name = FIRST[i] ?? `${GIVEN[i % GIVEN.length]} /${i % 2 ? "Lhota" : "Lhoták"}/`;
    out.push(`0 @I${i + 1}@ INDI`, `1 NAME ${name}`, `1 SEX ${i % 3 ? "M" : "F"}`, "1 BIRT", `2 DATE ${1850 + i}`, "2 PLAC Horní Lhota");
  }
  return out;
}

/** A research in Czech the app sent `n` people to, unmarked (the app's bridge writes it: the person's); its input. */
async function sent(n: number): Promise<{ w: World; input: string }> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  const file = path.join(w.dir, "send.ged");
  fs.writeFileSync(file, ged([...appHead, ...people(n)]));
  const r = await w.ok(["sync", file, "--apply", "--force", "--json"], FROM_APP);
  return { w, input: r.json.input as string };
}

const imports = (w: World) => waitingFor(open(w)).filter((x) => x.item.kind === "import");
const byName = (w: World, given: string) => open(w).list<Person>("person").find((p) => p.names.some((n) => n.given === given))!;

test("What waits: a send of 20 people unmarked asks whether they came of a family tree (W-S-I…, samples 3: diacritics, NFD, a non-Latin script); 19 asks nothing until sync.importAsk 5 --for-tree; 0 never; a number refused", opts, async () => {
  const { w, input } = await sent(20);
  try {
    const items = imports(w);
    assert.equal(items.length, 1);
    const it = items[0]!.item;
    assert.deepEqual(
      { id: it.id, kind: it.kind, section: it.section, group: it.group.key, phase: it.phase, actions: it.actions, input: it.input, persons: it.persons },
      { id: `W-S-${input}`, kind: "import", section: "decide", group: "app", phase: "todo", actions: ["answer"], input, persons: 20 },
    );
    assert.equal(it.day, open(w).get<Input>(input)!.created.slice(0, 10));
    const samples = it.samples as { id: string; name: string }[];
    assert.deepEqual(samples.map((s) => s.name), ["Žofie Lhotská", "Ludmila Lhotáková", "Ярослав Лхотак"], "in the order the send added them, NFC");
    assert.ok(samples.every((s) => /^P\d{4}$/u.test(s.id)));
    assert.match(it.what, /^Odeslání z aplikace .+ přidalo 20 lidí – přišli z rodokmenu \(import, sloučení\)\?$/u);
    assert.doesNotMatch(it.what, /\b(vy|ty|váš|tvůj)\b/iu);
  } finally {
    w.cleanup();
  }

  const small = await sent(19);
  try {
    assert.equal(imports(small.w).length, 0, "19 people: nothing asked");
    await small.w.ok(["config", "set", "sync.importAsk", "5", "--for-tree"]);
    assert.deepEqual(imports(small.w).map((x) => x.item.id), [`W-S-${small.input}`]);
    assert.equal(imports(small.w)[0]!.item.persons, 19);
    await small.w.ok(["config", "set", "sync.importAsk", "0", "--for-tree"]);
    assert.equal(imports(small.w).length, 0, "0: never");
    for (const bad of ["-1", "2.5", "abc"]) assert.notEqual((await small.w.run(["config", "set", "sync.importAsk", bad, "--for-tree"])).code, 0, bad);
    await small.w.ok(["config", "set", "sync.importAsk", "5", "--for-tree"]);
    assert.equal(imports(small.w).length, 1);
    // an archive asks it too (the person's data, nothing of an agent): the only thing that waits there
    const tree = open(small.w);
    tree.withTreeLock(() => {
      tree.updateConfig((c) => void (c.mode = "archive"), { op: "config.set", summary: "the research is an archive" });
      tree.commit("The research is an archive");
    });
    assert.deepEqual(archiveWaiting(open(small.w)).map((x) => x.item.id), [`W-S-${small.input}`]);
  } finally {
    small.w.cleanup();
  }
});

test("bridge: W-S-I… in /status waiting (feature waiting.import); GET …/preview counts and writes nothing; 400 a body that is not one; 503 busy; POST {do: import} marks the values the import's (head, parent), the item gone, 404 waiting.none after", opts, async () => {
  const { w, input } = await sent(20);
  Object.assign(w.env, { STROM_LOCK_WAIT_MS: "1500" });
  const id = `W-S-${input}`;
  try {
    const url = ((await w.ok(["live", "start", "--json"])).json as { url: string }).url;
    const status = async () => (await request(`${url}/status?app=3.33.0`)).body;
    const waits = (s: any) => (s.waiting as { kind: string }[]).filter((x) => x.kind === "import") as any[];
    let s = await status();
    assert.ok(s.features.includes("waiting.import"));
    assert.equal(waits(s).length, 1);
    assert.deepEqual([waits(s)[0].id, waits(s)[0].input, waits(s)[0].persons, waits(s)[0].samples.length], [id, input, 20, 3]);
    assert.equal(waits(s)[0].samples[1].name, "Ludmila Lhotáková");

    // the preview: what changes, nothing written
    const head = gitHead(w);
    const p = await request(`${url}/waiting/${id}/preview`);
    assert.equal(p.status, 200, JSON.stringify(p.body));
    assert.equal(p.body.input, input);
    assert.equal(p.body.persons, 20);
    assert.deepEqual(p.body.change, { values: 60, persons: 20, names: 20, sexes: 20, facts: 20 });
    assert.deepEqual(p.body.stay, { values: 0, changed: 0, confirmed: 0, was: 0, other: 0 });
    assert.deepEqual(p.body.samples.map((x: { name: string }) => x.name), ["Žofie Lhotská", "Ludmila Lhotáková", "Ярослав Лхотак"]);
    // the same as the command's preview
    const cmd = (await w.ok(["sync", "as-import", input, "--json"])).json;
    assert.deepEqual({ change: p.body.change, stay: p.body.stay, samples: p.body.samples, day: p.body.day }, { change: cmd.change, stay: cmd.stay, samples: cmd.samples, day: cmd.day });
    assert.equal(gitHead(w), head, "the preview writes nothing");
    assert.equal((await request(`${url}/waiting/W-S-I0999/preview`)).body.code, "waiting.none");

    // a body that is not one
    for (const body of [{ do: "yes" }, {}, { do: "import", input }, "[]"]) {
      const r = await request(`${url}/waiting/${id}`, "POST", body);
      assert.deepEqual([r.status, r.body.code], [400, "waiting.body"], JSON.stringify(body));
    }
    // held by another strom: busy (the preview and the answer), nothing written
    const lock = path.join(w.cwd, ".strom", "tree.lock");
    fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, host: os.hostname(), at: new Date().toISOString(), owner: "a test" }));
    try {
      const busy = await request(`${url}/waiting/${id}/preview`);
      assert.deepEqual([busy.status, busy.body.code, busy.headers["retry-after"] !== undefined], [503, "research.busy", true]);
      const write = await request(`${url}/waiting/${id}`, "POST", { do: "import" });
      assert.deepEqual([write.status, write.body.code, write.headers["retry-after"] !== undefined], [503, "research.busy", true], JSON.stringify(write.body));
    } finally {
      fs.rmSync(lock);
    }
    assert.equal(gitHead(w), head);
    assert.equal(waits(await status()).length, 1);

    // yes, from a family tree: the values the import's, value and status as they were
    const before = byName(w, "Žofie");
    const yes = await request(`${url}/waiting/${id}`, "POST", { do: "import" });
    assert.equal(yes.status, 200, JSON.stringify(yes.body));
    assert.deepEqual([yes.body.input, yes.body.answer, yes.body.values, yes.body.persons], [input, "import", 60, 20]);
    assert.equal(yes.body.parent, head);
    assert.equal(yes.body.head, gitHead(w));
    assert.notEqual(yes.body.head, head);
    const after = byName(w, "Žofie");
    assert.equal(after.names[0]!.origin?.by, "import");
    assert.equal(after.sexOrigin?.by, "import");
    assert.equal(after.events[0]!.origin?.by, "import");
    assert.deepEqual([after.events[0]!.date, after.events[0]!.status], [before.events[0]!.date, before.events[0]!.status]);
    assert.equal(byName(w, "Ярослав").names[0]!.origin?.by, "import");
    assert.equal(importAnswered(open(w), input), "import");
    // written as the person (the command is the person's alone)
    const ops = open(w).readOps().filter((o) => o.op.startsWith("sync.as-import"));
    assert.ok(ops.length > 0);
    assert.ok(ops.every((o) => o.by === "user"), JSON.stringify(ops.map((o) => o.by)));

    s = await status();
    assert.equal(waits(s).length, 0, "answered: no longer asked");
    const again = await request(`${url}/waiting/${id}`, "POST", { do: "own" });
    assert.deepEqual([again.status, again.body.code], [404, "waiting.none"]);
    assert.equal((await request(`${url}/waiting/${id}/preview`)).status, 404);
    await w.ok(["live", "stop"]);
  } finally {
    w.cleanup();
  }
});

test("bridge: POST {do: own} changes nothing, the item gone for good — not asked again after another send", opts, async () => {
  const { w, input } = await sent(20);
  const id = `W-S-${input}`;
  try {
    // the bridge started from an agent's shell: what the app answers is still the person's (STROM_FOR_APP, no agent's marks)
    // (its secret address never shown to an agent: the person's own look gives it)
    const pid = ((await w.ok(["live", "start", "--json"], { env: { CLAUDECODE: "1" } })).json as { pid: number }).pid;
    const shown = (await w.ok(["live", "start", "--json"])).json as { url: string; pid: number };
    assert.equal(shown.pid, pid, "the same bridge");
    const url = shown.url;
    const status = async () => (await request(`${url}/status?app=3.33.0`)).body;
    const waits = (s: any) => (s.waiting as { kind: string }[]).filter((x) => x.kind === "import");
    assert.equal(waits(await status()).length, 1);
    const head = gitHead(w);
    const names = () => open(w).list<Person>("person").map((p) => JSON.stringify([p.names, p.sexOrigin, p.events]));
    const was = names();
    const own = await request(`${url}/waiting/${id}`, "POST", { do: "own" });
    assert.equal(own.status, 200, JSON.stringify(own.body));
    assert.deepEqual(own.body, { input, answer: "own", head: gitHead(w), parent: head });
    assert.deepEqual(names(), was, "nothing changed");
    assert.equal(byName(w, "Žofie").names[0]!.origin?.by, "user");
    assert.equal(importAnswered(open(w), input), "own");
    assert.ok(open(w).readOps().filter((o) => o.op.startsWith("sync.as-import")).every((o) => o.by === "user"));
    assert.equal(waits(await status()).length, 0);
    // another send of the app (one fact changed): the answered send is not asked again
    const tree = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
    const lines = people(20).flatMap((l) => {
      const m = /^0 @I(\d+)@ INDI$/.exec(l);
      if (!m) return [l === "2 DATE 1850" ? "2 DATE 1849" : l];
      const p = open(w).list<Person>("person")[Number(m[1]) - 1]!;
      return [l, `1 REFN ${p.id}`, "2 TYPE strom-research"];
    });
    const next = path.join(w.dir, "send-2.ged");
    fs.writeFileSync(next, ged([...appHead, `1 _STROM_TREE ${tree}`, `1 _STROM_HEAD ${gitHead(w)}`, ...lines]));
    await w.ok(["sync", next, "--apply", "--edits", "user"], FROM_APP);
    assert.equal(waits(await status()).length, 0, "answered: never asked again");
    assert.equal(imports(w).length, 0);
    assert.equal((await request(`${url}/waiting/${id}`, "POST", { do: "import" })).body.code, "waiting.none");
    await w.ok(["live", "stop"]);
  } finally {
    w.cleanup();
  }
});

test("the menu's What waits: the send asked about — its screen (day, people, three names, what the marks mean, what changes, the command); 0 leaves it; yes marks it of the family tree", { skip: !hasGit }, async () => {
  const { w, input } = await sent(20);
  try {
    const head = gitHead(w);
    const look = await w.ok([], { tty: true, answers: ["3", "1", "0", "0", "0"] });
    assert.match(look.out, new RegExp(`W-S-${input} · rodokmen\\?`, "u"));
    assert.match(look.out, /přidalo 20 lidí – přišli z rodokmenu \(import, sloučení\)\?/u);
    assert.match(look.out, /Například: Žofie Lhotská \[P\d{4}\], Ludmila Lhotáková \[P\d{4}\], Ярослав Лхотак \[P\d{4}\]/u);
    assert.match(look.out, /✓ potvrdil člověk/u);
    assert.match(look.out, /Z rodokmenu: 60 údajů ✓ → ○○, 0 zůstane ✓/u);
    assert.match(look.out, new RegExp(`strom sync as-import ${input}`, "u"));
    assert.match(look.out, /\[1\] {2}Ano, z rodokmenu\n +\[2\] {2}Ne, zapsáno ručně\n\n *\[0\] {2}Zpět/u);
    assert.equal(gitHead(w), head, "0: nothing written");
    const yes = await w.ok([], { tty: true, answers: ["3", "1", "1", "0", "0"] });
    assert.match(yes.out, /60 údajů u 20 lidí/u);
    assert.equal(importAnswered(open(w), input), "import");
    assert.equal(byName(w, "Ярослав").names[0]!.origin?.by, "import");
    assert.equal(imports(w).length, 0);
  } finally {
    w.cleanup();
  }
});
