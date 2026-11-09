// What is seen of the verification against the originals (spec 065): the brief of a task of verification (each fact,
// its originals and their images, how — read first, then compare; a search for the record), strom verify status with
// the sweep's selection, and the counts in strom check, strom doctor and strom stats (K6.9, K6.5), in the research
// language; an archive says none of it. Made-up people (Lhoták, Lhota), a place in Cyrillic.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import type { Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");

const open = (w: World) => Tree.open(w.cwd, w.env);
/** The brief's section of the facts to verify, up to the next section. */
const toVerify = (brief: string) => {
  const from = brief.indexOf("## To verify");
  const to = brief.indexOf("\n## ", from + 1);
  return from < 0 ? "" : brief.slice(from, to < 0 ? undefined : to);
};
const verifyTasks = (w: World) => open(w).list<Task>("task").filter((t) => t.origin.startsWith("verify:") && (t.state === "open" || t.state === "doing"));

/**
 * Jan Lhoták (P1, the line G0001), his parents Josef (P2) and Marie (P3). Register B1 with Josef's baptism scanned
 * (M1, the entry cut out), its death entry in the same book with no image of its own; register B2 with no images here
 * (Marie's baptism). An index (S4) is no original. The line's planning queues the facts to verify.
 */
async function lhotaci() {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  await w.ok(["research", "new", "Předci Jana", "--new-person", "Jan /Lhoták/", "--sex", "M", "--born", "1880"]); // P1
  await w.ok(["person", "add", "Josef /Lhoták/", "--sex", "M"]); // P2
  await w.ok(["person", "add", "Marie /Lhotová/", "--sex", "F"]); // P3
  await w.ok(["family", "add", "--partner", "P2", "--partner", "P3", "--child", "P1"]); // F1
  await w.ok(["recordset", "add", "Lhota 1, N Z 1840-1920", "--kinds", "baptism,death", "--places", "Lhota", "--years", "1840-1920"]); // B1
  await w.ok(["recordset", "add", "Lhotka 2, N 1840-1870", "--kinds", "baptism", "--places", "Lhotka", "--years", "1840-1870"]); // B2
  const scan = path.join(w.dir, "0012.jpg");
  fs.copyFileSync(path.join(fixtures, "s0001.jpg"), scan);
  await w.ok(["media", "add", scan, "--recordset", "B0001", "--image", "12"]); // M1
  const original = (title: string, kind: string, set: string, ...more: string[]) => ["source", "add", title, "--kind", kind, "--recordset", set, "--locator", "fol. 12", "--information", "primary", ...more];
  await w.ok(original("Křest Josefa Lhotáka 1850", "baptism", "B0001", "--media", "M0001", "--clip", "M0001@0.1,0.2,0.5,0.3")); // S1
  await w.ok(original("Úmrtí Josefa Lhotáka 1910", "death", "B0001")); // S2
  await w.ok(original("Křest Marie Lhotové 1852", "baptism", "B0002")); // S3
  await w.ok(["source", "add", "Index křtů Lhota", "--kind", "index", "--information", "primary"]); // S4
  const add = async (owner: string, kind: string, ...more: string[]) => (await w.ok(["event", "add", owner, kind, ...more, "--json"])).json.event.id as string;
  const f = {
    josefBirth: await add("P2", "BIRT", "--date", "1850", "--place", "Lhota", "--cite", "S0001", "--locator", "fol. 12"),
    josefDeath: await add("P2", "DEAT", "--date", "1910", "--place", "Лхота", "--cite", "S0002", "--locator", "fol. 80"),
    marieBirth: await add("P3", "BIRT", "--date", "1852", "--place", "Lhotka", "--cite", "S0003", "--locator", "fol. 3"),
    janBirth: await add("P1", "BIRT", "--date", "1880", "--place", "Lhota", "--cite", "S0004"), // an index only
  };
  await w.ok(["frontier", "--research", "G0001", "--apply"]);
  return { w, f };
}

test("the brief of a task of verification lists each fact with its originals and their images, and how: read first, then compare", opts, async () => {
  const { w, f } = await lhotaci();
  try {
    const josef = verifyTasks(w).find((t) => t.subject[0] === "P0002");
    assert.ok(josef, "Josef's facts queued");
    const brief = (await w.ok(["brief", josef!.id])).out;
    const section = toVerify(brief);
    assert.ok(brief.includes("## To verify"), brief);
    // each fact on a line, how sure it is, its original and how to look at the entry
    assert.match(section, new RegExp(`^  ${f.josefBirth} BIRT 1850, Lhota \\[probable\\] · P0002`, "mu"), section);
    assert.match(section, new RegExp(`^  ${f.josefDeath} DEAT 1910, Лхота \\[probable\\]`, "mu"), section);
    assert.match(section, /^ {6}S0001 Křest Josefa Lhotáka 1850 · fol\. 12\n {8}the entry: strom media view M0001 --crop 0\.1,0\.2,0\.5,0\.3$/mu, section);
    assert.match(section, /^ {8}the book B0001 is here: find the image of fol\. 12 \(strom source show S0002\)/mu, section);
    // how: blind first, the result, a different value never overwritten, the reason in the research language
    assert.match(section, /Read the entry on the image of the original yourself first/);
    assert.match(section, /strom verify done E… --proven --image M…/);
    assert.match(section, /--kept --reason "…" — the reason in\n {2}Czech/);
    assert.match(section, /only proposes it \(a conflict the user decides\)/);
    assert.match(section, /confirmed against the scan is theirs: never changed/);
    // the task itself reads in the research language
    const shown = (await w.ok(["task", "show", josef!.id])).out;
    assert.match(shown, /Ověřit podle originálů údaje/u, shown);
    assert.match(shown, /strom verify done E… --proven --image M…/u, shown);

    // Marie's original is in a book with no image here: said, fetched only within the archive's terms
    const marie = verifyTasks(w).find((t) => t.subject[0] === "P0003")!;
    const mb = (await w.ok(["brief", marie.id])).out;
    assert.match(mb, /no image of it here \(B0002\): fetched only within the archive's terms/, mb);

    // a fact the person confirmed against the scan: theirs, said so in the brief of the task that held it
    await w.ok(["verify", "confirm", f.josefDeath], { env: { STROM_FOR_APP: "1" } });
    const after = (await w.ok(["brief", josef!.id])).out;
    assert.ok(!toVerify(after).includes(`${f.josefDeath} DEAT`), "a confirmed fact leaves the task");
    assert.match(toVerify(after), new RegExp(`^  ${f.josefBirth} BIRT`, "mu"));

    // the person's "verify" of a fact with no original read: a search for the record the citation names
    const asked = (await w.ok(["verify", "facts", "--fact", f.janBirth, "--living", "--json"])).json;
    assert.equal(asked.facts[0].how, "search");
    const search = (await w.ok(["brief", asked.task])).out;
    assert.match(search, /How \(no original of these facts was read/, search);
    assert.match(search, /strom cite E… S… --locator "…" --information primary/, search);
    assert.match(search, /nothing fetched beyond them; a sharper part of an image only offered to the user/, search);
    assert.match(search, /^ {6}S0004 Index křtů Lhota · index, not the original$/mu, search);
    assert.match((await w.ok(["task", "show", asked.task])).out, /Najít a přečíst zápisy k údajům/u);
  } finally {
    w.cleanup();
  }
});

test("K6.9, K6.5: strom check, doctor and stats say how many facts wait to be verified, those waiting for the scans apart; verify status gives the selection", opts, async () => {
  const { w } = await lhotaci();
  try {
    // Josef's two facts (their book is here), Marie's (no image of her book here); Jan's index no original
    const check = await w.run(["check", "--json"]);
    assert.deepEqual(check.json.verify, { waiting: 3, images: 1, permission: 0 }, check.out);
    const said = (await w.run(["check"])).out;
    assert.match(said, /^pozn\.: 3 údaje s citací originálu čekají na ověření podle něj \(na skeny: 1\) → strom verify status$/mu, said);
    // an agent reads it in English
    assert.match((await w.run(["check"], { env: { CLAUDECODE: "1" } })).out, /^note: 3 facts with the original cited waiting to be verified against it \(for the scans: 1\) → strom verify status$/mu);

    const stats = await w.ok(["stats"]);
    assert.match(stats.out, /^3 údaje s originálem čekají na ověření, ověřují se postupně \(na skeny: 1\)$/mu, stats.out);
    assert.deepEqual((await w.ok(["stats", "--json"])).json.verify, { waiting: 3, images: 1, permission: 0 });

    const doctor = (await w.run(["doctor", "--json"])).json;
    const row = doctor.checks.find((c: { name: string }) => c.name === "verify");
    assert.equal(row?.status, "ok", "a sentence, never a problem");
    assert.match(row.detail, /^3 údaje s citací originálu čekají na ověření, ověřují se postupně \(na skeny: 1\)$/u);

    // verify status: the counts and the sweep's selection in one line (nothing new: all queued)
    const status = (await w.ok(["verify", "status", "--json"])).json;
    assert.equal(status.waiting, 3);
    assert.deepEqual(
      { weak: status.funnel.weak, withOriginal: status.funnel.withOriginal, kinds: status.funnel.kinds, queued: status.funnel.queued, candidates: status.funnel.candidates, owners: status.funnel.owners },
      { weak: 3, withOriginal: 3, kinds: 3, queued: 3, candidates: 0, owners: 0 },
    );
    const text = (await w.ok(["verify", "status"])).out;
    assert.equal(text.split("\n").filter((l) => /^ {2}výběr: /u.test(l)).length, 1, text);
    assert.match(text, /^ {2}výběr: slabé 3 → s citací originálu 3 → ověřované druhy 3; vyřazeno: mimo rodokmen 0, vedlejší větve 0, žijící 0 → nové 0 \(osob a rodin 0\)$/mu, text);

    // nothing waiting: no line anywhere
    const tree = open(w);
    tree.withTreeLock(() => {
      for (const t of verifyTasks(w)) tree.put({ ...t, state: "dropped", result: "pryč" }, { op: "task.drop", targets: [t.id], summary: `${t.id} dropped` });
      tree.commit("Dropped");
    });
    assert.equal((await w.run(["check", "--json"])).json.verify, undefined);
    assert.doesNotMatch((await w.ok(["stats"])).out, /na ověření/u);
    assert.equal((await w.run(["doctor", "--json"])).json.checks.some((c: { name: string }) => c.name === "verify"), false);
  } finally {
    w.cleanup();
  }
});
