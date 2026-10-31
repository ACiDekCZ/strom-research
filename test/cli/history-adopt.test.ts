// The places of the facts another research on this computer maps (core/placeadopt.ts): a second tree takes the places
// it surely shares with the first — the same name and the records agree (coordinates within 2 km, the same parish, the
// same district or county), every research that has it maps it the same, every region's catalog here — before its places'
// task is raised; a place of the name where nothing tells, or the researches differ, is a suggestion in the brief of the
// task; coordinates far apart, a region with no catalog: nothing. A place this tree's map has (the person's word, skipped,
// to be determined again) is never touched. Of another tree only its map and its place records are read, nothing written.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import type { Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit, timeout: 240_000 };
const NAMES = (cs: string, en: string, de: string) => ["--name-cs", cs, "--name-en", en, "--name-de", de];
/** A Cyrillic place: its NFD form decomposes (й). */
const CYRILLIC = "Подгорный";

async function place(w: World, name: string, o: { lat?: number; lon?: number; parish?: string; district?: string; county?: string } = {}): Promise<string> {
  const coords = o.lat !== undefined ? ["--lat", String(o.lat), "--lon", String(o.lon)] : [];
  const id: string = (await w.ok(["place", "add", name, "--kind", "village", ...coords, "--json"])).json.place.id;
  for (const kind of ["parish", "district", "county"] as const) if (o[kind]) await w.ok(["place", "jurisdiction", id, "--kind", kind, "--name", o[kind]!]);
  return id;
}

async function facts(w: World, places: string[]): Promise<void> {
  let year = 1870;
  for (const p of places) await w.ok(["event", "add", "P0001", "RESI", "--date", String(year++), "--place", p]);
}

async function tree(w: World, name: string, who: string): Promise<string> {
  await w.ok(["init", name]);
  w.cwd = w.treeDir(name);
  await w.ok(["research", "new", `Předci ${who}`, "--new-person", who, "--sex", "M", "--born", "1850", "--born-place", "Lhota"]);
  return w.cwd;
}

function places(dir: string): Record<string, any> {
  return readJsonFile(path.join(dir, "history", "places.json")).places;
}

async function tasks(w: World): Promise<Task[]> {
  return (await w.ok(["task", "list", "--state", "all", "--full", "--json", "--limit", "500"])).json.tasks;
}

test("history adopt: a second tree takes what another research maps surely the same, suggests what nothing tells, leaves the rest — the person's places untouched, nothing of the other tree read but its places", opts, async () => {
  const w = new World();
  try {
    // A: the first research, every place mapped
    await w.withTree("Lhotákovi");
    const a = w.cwd;
    await w.ok(["research", "new", "Předci Jana Lhotáka", "--new-person", "Jan /Lhoták/", "--sex", "M", "--born", "1850", "--born-place", "Lhota"]);
    await w.ok(["config", "set", "experiments.history", "on"], { tty: true, answers: ["a"] });
    await w.ok(["history", "region", "cz-lhota", ...NAMES("Lhotsko", "Lhota Land", "Lhotaland")]);
    await w.ok(["history", "region", "cz-jinde", ...NAMES("Jinde", "Elsewhere", "Anderswo")]);
    await w.ok(["history", "region", "cz-chybi", ...NAMES("Chybí", "Missing", "Fehlend")]);
    await place(w, "Lhota", { lat: 49.62, lon: 15.07 });
    await place(w, "Horní Lhota", { parish: "Svatá Lhota" });
    await place(w, "Malá Lhota", { district: "Horní okres" });
    await place(w, "Lhotínek", { lat: 49.7, lon: 15.1 });
    await place(w, "Dolní Lhota", { lat: 49.8, lon: 15.2 });
    await place(w, CYRILLIC, { lat: 50.1, lon: 15.3 });
    await place(w, "Podlesí", { lat: 49.65, lon: 15.15 });
    for (const [name, lat] of [["Lhotěnka", 49.4], ["Lhotárna", 49.45], ["Hájek", 49.5]] as const) await place(w, name, { lat, lon: 15.0 });
    await facts(w, ["Horní Lhota", "Malá Lhota", "Lhotínek", "Dolní Lhota", CYRILLIC, "Podlesí", "Nová Ves", "Lhotěnka", "Lhotárna", "Hájek"]);
    // the person's word in A: taken in B as the research's, never as B's person's
    await w.ok(["history", "assign", "Lhota", "--region", "cz-lhota:1800-"]);
    for (const p of ["Horní Lhota", "Malá Lhota", "Lhotínek", CYRILLIC, "Podlesí", "Nová Ves", "Lhotárna", "Hájek"]) await w.ok(["history", "map", p, "--region", "cz-lhota:1800-"]);
    await w.ok(["history", "map", "Lhotěnka", "--region", "cz-jinde"]);
    await w.ok(["history", "map", "Dolní Lhota", "--region", "cz-chybi"]);
    fs.rmSync(path.join(w.home, "shared", "history", "regions", "cz-chybi.json"));
    const aId = readJsonFile(path.join(a, "strom.json")).id;

    // C: a third research — Podlesí the same place by its coordinates yet another region; Lhota without a record, mapped the same
    await tree(w, "Lhotákovi z Podlesí", "Petr /Lhoták/");
    await place(w, "Podlesí", { lat: 49.651, lon: 15.151 });
    await facts(w, ["Podlesí"]);
    await w.ok(["history", "map", "Podlesí", "--region", "cz-jinde:1850-"]);
    await w.ok(["history", "map", "Lhota", "--region", "cz-lhota:1800-"]);

    // B: the second research, nothing mapped yet; its places written decomposed (NFD) too
    const b = await tree(w, "Lhotákovi z Lhoty", "Josef /Lhoták/");
    await place(w, "Lhota", { lat: 49.621, lon: 15.071 }); // 0.13 km: the same
    await place(w, "Horní Lhota".normalize("NFD"), { parish: "Svatá Lhota".normalize("NFD") });
    await place(w, "Malá Lhota", { county: "Horní okres" });
    await place(w, "Lhotínek", { lat: 49.9, lon: 15.1 }); // 22 km: another village of the name
    await place(w, "Dolní Lhota", { lat: 49.8, lon: 15.2 });
    await place(w, CYRILLIC.normalize("NFD"), { lat: 50.1003, lon: 15.3002 });
    await place(w, "Podlesí", { lat: 49.652, lon: 15.152 });
    for (const [name, lat] of [["Lhotěnka", 49.4], ["Lhotárna", 49.45], ["Hájek", 49.5]] as const) await place(w, name, { lat, lon: 15.0 });
    await facts(w, ["Horní Lhota".normalize("NFD"), "Malá Lhota", "Lhotínek", "Dolní Lhota", CYRILLIC.normalize("NFD"), "Podlesí", "Nová Ves", "Lhotěnka", "Lhotárna", "Hájek", "Lhotíkov"]);
    // the person of B: Lhotěnka theirs, Lhotárna skipped, Hájek to be determined again
    await w.ok(["history", "assign", "Lhotěnka", "--region", "cz-lhota"]);
    await w.ok(["history", "skip", "--place", "Lhotárna"]);
    await w.ok(["history", "assign", "Hájek", "--redo"]);

    // what B would take — and of A only its map and its place records read, nothing written there
    const aPlaces = fs.readFileSync(path.join(a, "history", "places.json"));
    const read: string[] = [];
    const wrote: string[] = [];
    const real = { readFileSync: fs.readFileSync, readdirSync: fs.readdirSync, writeFileSync: fs.writeFileSync, renameSync: fs.renameSync };
    const under = (p: unknown, out: string[]) => typeof p === "string" && path.resolve(p).startsWith(a + path.sep) && out.push(path.relative(a, p).split(path.sep).join("/"));
    (fs as any).readFileSync = (p: any, ...r: any[]) => (under(p, read), (real.readFileSync as any)(p, ...r));
    (fs as any).readdirSync = (p: any, ...r: any[]) => (under(p, read), (real.readdirSync as any)(p, ...r));
    (fs as any).writeFileSync = (p: any, ...r: any[]) => (under(p, wrote), (real.writeFileSync as any)(p, ...r));
    (fs as any).renameSync = (p: any, q: any) => (under(q, wrote), real.renameSync(p, q));
    let plan: any;
    try {
      plan = (await w.ok(["history", "adopt", "--dry-run", "--json"])).json;
    } finally {
      Object.assign(fs, real);
    }
    assert.ok(read.includes("history/places.json"), read.join(", "));
    assert.ok(read.some((f) => f.startsWith("data/places/")), "its place records");
    const other = read.filter((f) => f !== "strom.json" && f !== "history/places.json" && f !== "data/places" && !/^data\/places\/L\d+\.json$/u.test(f));
    assert.deepEqual(other, [], "nothing else of another tree read: no person, family, source");
    assert.deepEqual(wrote, [], "nothing written in another tree");
    assert.deepEqual(fs.readFileSync(path.join(a, "history", "places.json")), aPlaces);

    const taken = Object.fromEntries(plan.taken.map((t: any) => [t.place, t.by]));
    assert.deepEqual(taken, { Lhota: "coords", "Horní Lhota": "parish", "Malá Lhota": "district", [CYRILLIC]: "coords" });
    assert.deepEqual(plan.suggested.map((s: any) => s.place).sort(), ["Nová Ves", "Podlesí"]);
    const podlesi = plan.suggested.find((s: any) => s.place === "Podlesí");
    assert.deepEqual(podlesi.options.map((o: any) => o.regions[0].id).sort(), ["cz-jinde", "cz-lhota"], "the researches differ: both");
    assert.deepEqual(plan.left.sort(), ["Dolní Lhota", "Lhotínek", "Lhotíkov"].sort(), "far apart, no catalog, nobody maps it");
    assert.equal(plan.written, false);
    assert.equal(fs.existsSync(path.join(b, "history", "places.json")) ? Object.keys(places(b)).length : 0, 2, "a dry run writes nothing (Lhotěnka, Hájek only)");

    // before the places' task: taken as one sealed operation, the rest left to the task
    await w.ok(["frontier", "--apply"]);
    const map = places(b);
    for (const p of ["Lhota", "Horní Lhota", "Malá Lhota", CYRILLIC]) {
      assert.equal(map[p]?.from?.tree, aId, `${p} from A`);
      assert.equal(map[p]?.manual, undefined, `${p}: never the person's word here`);
      assert.deepEqual(map[p]?.regions, [{ id: "cz-lhota", from: 1800 }]);
    }
    assert.equal(map.Lhotěnka.manual, true, "the person's own map untouched");
    assert.deepEqual(map.Lhotěnka.regions, [{ id: "cz-lhota" }]);
    assert.equal(map.Hájek.state, "redo", "to be determined again: untouched");
    assert.equal(map.Lhotárna, undefined, "skipped: untouched");
    for (const p of ["Podlesí", "Nová Ves", "Lhotínek", "Dolní Lhota", "Lhotíkov"]) assert.equal(map[p], undefined, `${p}: not taken`);
    const ops = (fs.readdirSync(path.join(b, "data", "ops"), { recursive: true }) as string[])
      .filter((f) => f.endsWith(".jsonl"))
      .flatMap((f) => fs.readFileSync(path.join(b, "data", "ops", f), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)))
      .filter((o) => o.op === "history.adopt");
    assert.deepEqual(ops.map((o) => o.summary), [`Places mapped as another research on this computer maps them: 4 (Horní Lhota, Lhota, Malá Lhota, ${CYRILLIC})`], "one operation for the batch");
    const pt = (await tasks(w)).find((t) => t.origin === "history:places")!;
    assert.deepEqual([...pt.where].sort(), ["Dolní Lhota", "Hájek", "Lhotínek", "Lhotíkov", "Nová Ves", "Podlesí"].sort());
    await w.ok(["check"]);

    // the brief of the places' task: the suggestions, each with the other research's record and the command
    const brief = (await w.ok(["brief", pt.id])).out;
    assert.match(brief, /## Places another research on this computer maps/u);
    assert.match(brief, /"Nová Ves" — another research on this computer maps "Nová Ves" \(no place record there\) to cz-lhota:1800- — use it only if it is the same place: strom history map "Nová Ves" --region cz-lhota:1800-/u);
    assert.match(brief, /"Podlesí" — .*49\.650, 15\.150; the same coordinates as here\) to cz-lhota:1800- \(the researches differ\)/u);
    assert.match(brief, /"Podlesí" — .*to cz-jinde:1850- \(the researches differ\)/u);
    assert.doesNotMatch(brief, /maps "Lhotínek"|maps "Dolní Lhota"/u, "far apart or no catalog: nothing");
    assert.doesNotMatch(brief, /Lhotákovi z Podlesí|Petr|Lhotákovi"/u, "no name of another research or its people");

    // a tree whose every place another research maps surely: never a places' task
    const d = await tree(w, "Lhotákovi z Lhotínku", "Karel /Lhoták/");
    await place(w, "Lhota", { lat: 49.6205, lon: 15.0705 });
    await w.ok(["frontier", "--apply"]);
    assert.equal(places(d).Lhota.from.tree, aId);
    assert.ok(!(await tasks(w)).some((t) => t.origin === "history:places"), "everything mapped by others: no task");
    // nothing more to take in B; the agent may still map a taken place otherwise
    w.cwd = b;
    const again = (await w.ok(["history", "adopt", "--json"])).json;
    assert.deepEqual([again.taken.length, again.suggested.length, again.left.length], [0, 2, 3]);
    await w.ok(["history", "map", "Lhota", "--region", "cz-jinde"], { env: { CLAUDECODE: "1" } });
    assert.deepEqual(places(b).Lhota, { ...places(b).Lhota, regions: [{ id: "cz-jinde" }] });
    assert.equal(places(b).Lhota.from, undefined);

  } finally {
    w.cleanup();
  }
});
