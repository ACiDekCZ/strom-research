// The Strom app's pictures of a person and of a couple (spec 107): the portrait (1 OBJE under INDI, 2 _STROM_KIND
// photo), the attachment it is cut from (another OBJE, its original's 2 _STROM_SHA), the couple's photo (1 OBJE under
// FAM, no _STROM_KIND) — and in its JSON (data version 23) Person.photo, attachments, photoSource, Partnership.photo.
// The research keeps none of them: a send that carries them writes only the user's edit beside them, leaves nothing
// unwritten, makes no task, in a research and in an archive; the file the app gets back carries none of them, so a picture taken off in
// the app never comes back from the research (the app carries its own over itself).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit };

const PIXEL = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/";
const SHA = "a".repeat(64);

/** Václav Lhoták (P1) and Eva Lhotáková (P2), married in Lhota (F1); the Strom file as the app was given it. */
async function world(): Promise<{ w: World; given: string }> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  await w.ok(["person", "add", "Václav /Lhoták/", "--sex", "M", "--born", "1890"]); // P1
  await w.ok(["person", "add", "Eva /Lhotáková/", "--sex", "F", "--born", "1893"]); // P2
  await w.ok(["family", "add", "--partner", "P1", "--partner", "P2"]); // F1
  await w.ok(["event", "add", "F1", "MARR", "--date", "1915", "--place", "Lhota"]);
  const given = path.join(w.dir, "given.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", given]);
  return { w, given };
}

/** A record of the file (INDI or FAM by its REFN) with lines added under it. */
function under(t: string, refn: string, lines: string[]): string {
  return t
    .split(/\n(?=0 )/)
    .map((r) => (new RegExp(`\\n1 REFN ${refn}\\n`).test(`${r}\n`) ? `${r}\n${lines.join("\n")}` : r))
    .join("\n");
}

/** The file as the app 3.30 sends it: Václav's portrait cut from a wedding photo he has as an attachment, the couple's photo. */
function withPictures(t: string): string {
  const file = (level: number) => [`${level} FILE ${PIXEL.slice(0, 60)}`, `${level + 1} CONC ${PIXEL.slice(60)}`];
  let out = t.replace(/^1 SOUR STROM_RESEARCH$/m, "1 SOUR STROM\n2 VERS 3.30.0");
  out = under(out, "P0001", [
    // beside the pictures one edit of the user's: the file is read (its death written), the pictures leave no trace
    "1 DEAT", "2 DATE 1960", "2 PLAC Lhota",
    "1 OBJE", "2 FORM jpg", "2 TITL Václav – portrét", "2 _STROM_KIND photo", ...file(2),
    "1 OBJE", "2 FORM jpg", "2 TITL svatba-1915.jpg", "2 _STROM_SHA " + SHA, ...file(2),
  ]);
  out = under(out, "F0001", ["1 OBJE", "2 FORM jpg", "2 TITL svatba-1915.jpg", ...file(2), "2 _DATE 2026-11-16"]);
  return out;
}

/** The app's JSON (data version 23) of this research with the same pictures, a portrait's source and the couple's photo. */
function appJson(w: World, out: string): string {
  const id = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
  fs.writeFileSync(out, JSON.stringify({
    version: 23,
    research: { id, head },
    persons: {
      a: {
        id: "a", firstName: "Václav", lastName: "Lhoták", gender: "male", birthDate: "1890", refn: "P0001", refnType: "strom-research", parentIds: [], childIds: [], partnerships: ["u"],
        deathDate: "1960", deathPlace: "Lhota",
        photo: PIXEL, photoOriginalName: "Václav – portrét",
        attachments: [{ id: "att1", name: "svatba-1915.jpg", mimeType: "image/jpeg", dataUrl: PIXEL, original: { sha256: SHA } }],
        photoSource: { attachmentId: "att1", region: { x: 0.1, y: 0.1, w: 0.3, h: 0.4 }, quarterTurns: 1, angle: -2.5, mirror: true },
      },
      b: {
        id: "b", firstName: "Eva", lastName: "Lhotáková", gender: "female", birthDate: "1893", refn: "P0002", refnType: "strom-research", parentIds: [], childIds: [], partnerships: ["u"],
        photo: PIXEL, photoSource: { partnershipId: "u", region: { x: 0.5, y: 0.1, w: 0.3, h: 0.4 } },
      },
    },
    partnerships: { u: { id: "u", person1Id: "a", person2Id: "b", childIds: [], status: "married", refn: "F0001", photo: PIXEL, photoOriginalName: "svatba-1915.jpg", photoDate: "2026-11-16" } },
  }));
  return out;
}

const tasks = async (w: World): Promise<string[]> => ((await w.ok(["task", "list", "--all", "--json"])).json.tasks as { id: string }[]).map((t) => t.id);

/** What a send of the file does: its plan, what it wrote, what it left unwritten. */
async function sent(w: World, file: string): Promise<{ plan: unknown[]; applied: unknown[]; skipped: unknown[]; notWritten: unknown[] }> {
  const plan = (await w.ok(["sync", file, "--json"])).json.changes as unknown[];
  const r = (await w.ok(["sync", file, "--apply", "--json"])).json;
  return { plan, applied: r.applied ?? [], skipped: r.skipped ?? [], notWritten: r.notWritten ?? [] };
}

/** The Strom file the app gets back: no picture of the app's in it (the research's own excerpts aside). */
async function back(w: World): Promise<string> {
  const file = path.join(w.dir, `back-${Math.random().toString(36).slice(2)}.ged`);
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "all", "--out", file], { env: { STROM_APP_URL: "https://beta.stromapp.info/run/" } });
  return fs.readFileSync(file, "utf8");
}

for (const mode of ["research", "archive"] as const)
  test(`spec 107 (${mode}): the portrait, its original and the couple's photo in the app's GEDCOM — only the edit beside them written, nothing unwritten, no task; none goes back, none comes back once taken off`, opts, async () => {
    const { w, given } = await world();
    if (mode === "archive") await w.ok(["mode", "archive"], { tty: true, answers: ["a"] });
    const before = await tasks(w);
    const file = path.join(w.dir, "app.ged");
    fs.writeFileSync(file, withPictures(fs.readFileSync(given, "utf8")));
    const said = await w.run(["sync", file]);
    assert.equal(said.code, 0, said.out + said.err);
    assert.doesNotMatch(said.out + said.err, /OBJE|_STROM_KIND|_DATE|FILE|unsupported|nepodporov|obráz|fotk/i, "no word of the pictures");
    const r = await sent(w, file);
    assert.deepEqual(r.plan.map((c) => (c as { kind: string }).kind), ["fact.new"], JSON.stringify(r.plan));
    assert.deepEqual(r.applied.map((a) => (a as { do: string }).do), ["event.add"], JSON.stringify(r.applied));
    assert.deepEqual([r.skipped, r.notWritten], [[], []]);
    assert.deepEqual(await tasks(w), before, "no task of a picture");
    assert.doesNotMatch(await back(w), /\n1 OBJE\n/, "no picture of a person or a couple goes back");
    // the portrait and the couple's photo taken off in the app: nothing to take away, nothing that brings them back
    const off = path.join(w.dir, "off.ged");
    fs.writeFileSync(off, under(fs.readFileSync(given, "utf8").replace(/^1 SOUR STROM_RESEARCH$/m, "1 SOUR STROM\n2 VERS 3.30.0"), "P0001", ["1 DEAT", "2 DATE 1960", "2 PLAC Lhota"]));
    assert.deepEqual(await sent(w, off), { plan: [], applied: [], skipped: [], notWritten: [] });
    assert.doesNotMatch(await back(w), /\n1 OBJE\n/);
    w.cleanup();
  });

for (const mode of ["research", "archive"] as const)
  test(`spec 107 (${mode}): the app's JSON of data version 23 — photo, attachments, photoSource, Partnership.photo — read with no word of them, only the edit beside them`, opts, async () => {
    const { w } = await world();
    if (mode === "archive") await w.ok(["mode", "archive"], { tty: true, answers: ["a"] });
    const before = await tasks(w);
    const run = await w.run(["sync", appJson(w, path.join(w.dir, "app.json")), "--json"]);
    assert.equal(run.code, 0, run.out + run.err);
    assert.doesNotMatch(run.out + run.err, /version|verze|photo|unsupported/i, "no word of the data version or the pictures");
    const r = await sent(w, appJson(w, path.join(w.dir, "app2.json")));
    assert.deepEqual(r.plan.map((c) => (c as { kind: string }).kind), ["fact.new"], JSON.stringify(r.plan));
    assert.deepEqual([r.skipped, r.notWritten], [[], []]);
    assert.deepEqual(await tasks(w), before);
    w.cleanup();
  });
