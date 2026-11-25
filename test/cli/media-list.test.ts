// Material sent to a list of people (spec 137 K2.2, K2.4, K2.5; feature media.list): the app puts the list first
// (PUT lists/<id>: name, kind, rule as it says it, the IDs of its people as they are now, how many the research has not
// got), then each file names it (X-Strom-List-Ref). The input keeps the list as it was sent (notes/lists/<hash>.json);
// up to 50 of its people are the input's people (People concerned), a longer list is only named with its file. The
// intake task is named by the list, and its brief says to match the names read to those people first.

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit || process.platform === "win32", timeout: 240_000 };
const APP = "https://beta.stromapp.info";
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");
const img = (name: string) => fs.readFileSync(path.join(fixtures, name));
const sha = (b: Uint8Array) => crypto.createHash("sha256").update(b).digest("hex");
const SCAN = img("base420.jpg");
const PAGE = img("base444.jpg");
const PEOPLE = 60;

type Got = { status: number; text: string };
function ask(url: string, method: string, headers: Record<string, string>, body?: string | Buffer): Promise<Got> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { agent: false, method, headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (d: Buffer) => chunks.push(d));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("error", reject);
    req.end(body);
  });
}
const coded = (r: Got) => [r.status, JSON.parse(r.text).code, JSON.parse(r.text).params];

/** 60 made-up people of Lhota (P0001…P0060), names with diacritics and in Cyrillic. */
function gedcom(): string {
  const lines = ["0 HEAD", "1 SOUR Test", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8"];
  const given = ["Václav", "Žofie", "Ёлка", "Jiří"];
  for (let i = 1; i <= PEOPLE; i++) lines.push(`0 @I${i}@ INDI`, `1 NAME ${given[i % given.length]} /Lhoták${i}/`, `1 SEX ${i % 2 ? "M" : "F"}`, "1 BIRT", `2 DATE ${1850 + i}`, "2 PLAC Lhota");
  lines.push("0 TRLR");
  return lines.join("\n") + "\n";
}

for (const mode of ["research", "archive"] as const)
  test(`spec 137 K2 (${mode}): material sent to a list of people — PUT lists/<id> and X-Strom-List-Ref; up to 50 of its people the input's people, a longer list named with its file; the task named by the list, its brief says to match the names to them first; media.list in the features`, opts, async () => {
    const w = new World();
    await w.withTree("Lhotákovi");
    await w.ok(["lang", "cs"]);
    const ged = path.join(w.dir, "lhota.ged");
    fs.writeFileSync(ged, gedcom());
    await w.ok(["intake", ged]);
    assert.equal(fs.readdirSync(path.join(w.cwd, "data", "persons")).filter((f) => /^P\d+\.json$/u.test(f)).length, PEOPLE);
    await w.ok(["config", "set", "intake.auto", "on", "--for-tree"], { tty: true }); // the person's switch: files get their tasks
    // a source the user transcribed in the app (the research has not read it): from a sync; its task to read it put
    // away, so a scan sent of it gets one
    const exported = path.join(w.dir, "strom.ged");
    await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", exported]);
    const synced = fs
      .readFileSync(exported, "utf8")
      .replace(/(1 REFN P0002\r?\n2 TYPE strom-research\r?\n)/, "$11 RESI\n2 DATE 1921\n2 PLAC Lhota\n2 SOUR @X9@\n3 PAGE arch 7\n")
      .replace(/(0 @U1@ SUBM)/, "0 @X9@ SOUR\n1 TITL Sčítání lidu 1921, Lhota\n1 TEXT Lhoták2, Lhoták3.\n$1");
    assert.notEqual(synced, fs.readFileSync(exported, "utf8"));
    fs.writeFileSync(path.join(w.dir, "z-aplikace.ged"), synced);
    await w.ok(["sync", path.join(w.dir, "z-aplikace.ged"), "--apply"]);
    const source = ((await w.ok(["source", "list", "--json"])).json.sources as { id: string; title: string }[]).find((x) => x.title === "Sčítání lidu 1921, Lhota")!.id;
    for (const t of (await w.ok(["task", "list", "--json"])).json.tasks as { id: string; level: string }[]) if (t.level === "verify") await w.ok(["task", "drop", t.id, "--reason", "test"]);
    if (mode === "archive") await w.ok(["mode", "archive"], { tty: true, answers: ["a"] });
    w.env.STROM_MEDIA_QUEUE_MS = "200"; // the queued files written a moment after
    const info = (await w.ok(["live", "start", "--json"])).json as { url: string };
    try {
      const status = JSON.parse((await ask(`${info.url}/status`, "GET", { Origin: APP })).text) as { features: string[] };
      assert.ok(status.features.includes("media.list"), "the feature the app's gate asks about (K2.5)");
      assert.ok(status.features.includes("media.list.source"), "a scan of a source sent to a list");
      const putList = (id: string, body: unknown, origin = true) => ask(`${info.url}/lists/${id}`, "PUT", { ...(origin ? { Origin: APP } : {}), "Content-Type": "application/json" }, JSON.stringify(body));
      const putFile = (b: Buffer, h: Record<string, string>) => ask(`${info.url}/media/${sha(b)}`, "PUT", { Origin: APP, "Content-Type": "application/octet-stream", "Content-Length": String(b.length), ...h }, b);

      // refused: not from the app, no list, an ID that is none of a person
      assert.equal((await putList("lhota-1921", { name: "x", persons: [] }, false)).status, 403);
      assert.deepEqual(coded(await putList("lhota-1921", { persons: ["P0001"] })).slice(0, 2), [400, "list.bad-body"]);
      assert.deepEqual(coded(await putList("lhota-1921", { name: "Sčítání", persons: ["Lhoták"] })).slice(0, 2), [400, "list.bad-body"]);
      assert.equal((await putList("lhota/1921", { name: "Sčítání", persons: [] })).status, 404, "no list's address");

      // a short list (the name in NFD, as a Mac's file names come): one ID the research has not got, two more without REFN
      const name = "Sčítání 1921 Lhota".normalize("NFD");
      const short = await putList("lhota-1921", { name, kind: "auto", rule: "narození v Lhotě 1851–1853", persons: ["P0002", "p0003", "P0999", "P0002"], missing: 2, at: "2026-11-23T10:00:00Z" });
      assert.equal(short.status, 200, short.text);
      assert.deepEqual(JSON.parse(short.text), { list: "lhota-1921", persons: 3, unknown: 1 });

      // a file naming a list not sent: 404 with its code; a list with a batch: refused before anything
      assert.deepEqual(coded(await putFile(SCAN, { "X-Strom-Person": "P0001", "X-Strom-List-Ref": "nikdy-neposlany" })), [404, "media.no-list", { list: "nikdy-neposlany" }]);
      assert.deepEqual(coded(await putFile(SCAN, { "X-Strom-List-Ref": "lhota-1921", "X-Strom-Batch": "davka-0001" })), [400, "media.bad-header", { header: "X-Strom-List-Ref" }]);

      // the person the dialog was opened from first, then the list's people the research has
      const one = await putFile(SCAN, { "X-Strom-Name": encodeURIComponent("sčítací arch.jpg"), "X-Strom-Person": "P0001", "X-Strom-List-Ref": "lhota-1921" });
      assert.equal(one.status, 200, one.text);
      const got = JSON.parse(one.text) as { input: string; task: string };
      type Shown = { persons: string[]; list: { id: string; name: string; kind: string; rule: string; count: number; missing: number; at: string; file: string } };
      const input = (await w.ok(["input", "show", got.input, "--json"])).json.input as Shown;
      assert.deepEqual(input.persons, ["P0001", "P0002", "P0003"]);
      assert.deepEqual({ ...input.list, file: undefined }, { id: "lhota-1921", name: "Sčítání 1921 Lhota".normalize("NFC"), kind: "auto", rule: "narození v Lhotě 1851–1853", count: 2, missing: 3, at: "2026-11-23T10:00:00.000Z", file: undefined });
      const kept = JSON.parse(fs.readFileSync(path.join(w.cwd, ...input.list.file.split("/")), "utf8")) as { persons: string[]; missing: number };
      assert.deepEqual([kept.persons, kept.missing], [["P0002", "P0003"], 3]);
      assert.equal(execFileSync("git", ["status", "--porcelain", "--untracked-files=all", "--", "notes"], { cwd: w.cwd, encoding: "utf8" }), "", "the list's file in the commit");
      const task = (await w.ok(["task", "show", got.task, "--json"])).json.task as { what: string; state: string; subject: string[] };
      assert.equal(task.state, mode === "archive" ? "parked" : "open");
      assert.match(task.what, /seznam „Sčítání 1921 Lhota“ \(2 osoby\)/u, task.what);
      assert.doesNotMatch(task.what, /Lhoták2/u, "named by the list, not by its people");
      assert.ok(["P0001", "P0002", "P0003"].every((p) => task.subject.includes(p)));
      const brief = (await w.ok(["brief", got.task])).out;
      assert.match(brief, /list: "Sčítání 1921 Lhota" \(automatic, rule: narození v Lhotě 1851–1853; 2 people, 3 more not in the research yet; as sent 2026-11-23\)/u, brief);
      assert.match(brief, /match each name you read on it to them first/u);
      assert.match(brief, /## People concerned[\s\S]*Lhoták2/u, "its people in People concerned");

      // the same file sent again to another list: the list it was sent to now, said as added
      const big = Array.from({ length: PEOPLE }, (_, i) => `P${String(i + 1).padStart(4, "0")}`);
      assert.equal((await putList("lhota-vsichni", { name: "Všichni z Lhoty", kind: "fixed", persons: big })).status, 200);
      const again = await putFile(SCAN, { "X-Strom-Person": "P0001", "X-Strom-List-Ref": "lhota-vsichni" });
      assert.equal(again.status, 200, again.text);
      assert.deepEqual([JSON.parse(again.text).known, JSON.parse(again.text).added?.list], [got.input, true]);
      const amended = (await w.ok(["input", "show", got.input, "--json"])).json.input as Shown;
      assert.deepEqual([amended.list.name, amended.list.count, amended.persons], ["Všichni z Lhoty", PEOPLE, ["P0001", "P0002", "P0003"]], "a long list adds none of its people");
      // …and again the same: nothing new
      const same = await putFile(SCAN, { "X-Strom-Person": "P0001", "X-Strom-List-Ref": "lhota-vsichni" });
      assert.equal(JSON.parse(same.text).added, undefined, same.text);

      // a long list on a new file (queued, as the app sends material): only the person named is its person, the
      // list named with its file of all IDs
      const queued = await putFile(PAGE, { "X-Strom-Person": "P0005", "X-Strom-List-Ref": "lhota-vsichni", Prefer: "respond-async" });
      assert.equal(queued.status, 202, queued.text);
      let page: (Shown & { id: string }) | undefined;
      for (let i = 0; i < 150 && !page; i++) {
        const k = JSON.parse((await ask(`${info.url}/media/known`, "POST", { Origin: APP, "Content-Type": "application/json" }, JSON.stringify({ shas: [sha(PAGE)] }))).text) as { known: Record<string, { id?: string } | null> };
        const id = k.known[sha(PAGE)]?.id;
        if (id) page = (await w.ok(["input", "show", id, "--json"])).json.input as Shown & { id: string };
        else await new Promise((r) => setTimeout(r, 200));
      }
      assert.ok(page, `the queued file written — live.log: ${fs.readFileSync(path.join(w.cwd, ".strom", "live.log"), "utf8").slice(-3000)}`);
      assert.deepEqual([page.persons, page.list.count], [["P0005"], PEOPLE]);
      assert.equal((JSON.parse(fs.readFileSync(path.join(w.cwd, ...page.list.file.split("/")), "utf8")) as { persons: string[] }).persons.length, PEOPLE);
      const pageTask = ((await w.ok(["input", "show", page.id, "--json"])).json.tasks as string[])[0];
      assert.ok(pageTask, "its intake task");
      const pageBrief = (await w.ok(["brief", pageTask])).out;
      assert.ok(pageBrief.includes(`the IDs of all its people: ${path.join(w.cwd, ...page.list.file.split("/"))}`), pageBrief);
      assert.match(pageBrief, /the user sent it for these people and the list's/u);

      // a scan of a source sent to a list (media.list.source): an image of the source keeping the list as sent, up to 50
      // of its people those of its task to read it; a list with a read (or a task, a batch) still refused
      const SOURCE_SCAN = img("grey.jpg");
      assert.deepEqual(coded(await putFile(SOURCE_SCAN, { "X-Strom-List-Ref": "lhota-1921", "X-Strom-Read": "1" })), [400, "media.bad-header", { header: "X-Strom-List-Ref" }]);
      assert.deepEqual(coded(await putFile(SOURCE_SCAN, { "X-Strom-Source": source, "X-Strom-List-Ref": "nikdy-neposlany" })), [404, "media.no-list", { list: "nikdy-neposlany" }]);
      const scan = await putFile(SOURCE_SCAN, { "X-Strom-Name": encodeURIComponent("arch 7.jpg"), "X-Strom-Source": source, "X-Strom-List-Ref": "lhota-1921" });
      assert.equal(scan.status, 200, scan.text);
      const onSource = JSON.parse(scan.text) as { media: string; source: string; task?: string };
      assert.equal(onSource.source, source);
      const shown = (await w.ok(["media", "show", onSource.media, "--json"])).json as { media: { list: Shown["list"] }; sources: string[] };
      assert.deepEqual([shown.sources, shown.media.list.name, shown.media.list.count, shown.media.list.missing], [[source], "Sčítání 1921 Lhota".normalize("NFC"), 2, 3]);
      assert.deepEqual((JSON.parse(fs.readFileSync(path.join(w.cwd, ...shown.media.list.file.split("/")), "utf8")) as { persons: string[] }).persons, ["P0002", "P0003"]);
      assert.match((await w.ok(["media", "show", onSource.media])).out, /sent to the list "Sčítání 1921 Lhota" · 2 people \(3 more not in the research\)/u);
      assert.ok(onSource.task, "its task to read the scan (intake.auto on)");
      const scanTask = (await w.ok(["task", "show", onSource.task!, "--json"])).json.task as { state: string; subject: string[] };
      assert.equal(scanTask.state, mode === "archive" ? "parked" : "open");
      assert.ok([source, "P0002", "P0003"].every((p) => scanTask.subject.includes(p)), scanTask.subject.join(" "));
      if (mode === "research") {
        const scanBrief = (await w.ok(["brief", onSource.task!])).out;
        assert.match(scanBrief, new RegExp(`${onSource.media} list: "Sčítání 1921 Lhota" \\(automatic`, "u"), scanBrief);
        assert.match(scanBrief, /the user sent the scan for the list's people: match each name you read on it to them first/u);
      }
    } finally {
      await w.ok(["live", "stop"]);
    }
    await w.ok(["check"]); // the lists' files written as logged, sealed operations
    w.cleanup();
  });
