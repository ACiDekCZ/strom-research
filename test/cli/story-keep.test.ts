// A story written again loses nothing of the version before without a word: each fact, each source of its
// background, each source and link its text named stays, or goes on purpose with a reason (--drop). And the
// sources a story rests on are said wherever it is shown: strom story show, and the Strom file (2 SOUR under _STORY).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { validateGedcom } from "../../src/gedcom/validate.ts";

const opts = { skip: !hasGit };

async function world(): Promise<World> {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci", "--new-person", "Jan /Lhoták/", "--sex", "M"]); // P1
  await w.ok(["source", "add", "Křest Jana 1850", "--kind", "baptism", "--information", "primary"]); // S1
  await w.ok(["source", "add", "Dějiny hasičů ve Lhotě", "--kind", "web", "--url", "https://obec.example.org/hasici"]); // S2
  await w.ok(["source", "add", "Kronika Lhotecka", "--kind", "book"]); // S3: the background
  await w.ok(["event", "add", "P1", "BAPM", "--date", "1850", "--place", "Lhotečka", "--cite", "S1", "--status", "proven"]); // E1
  await w.ok(["event", "add", "P1", "OCCU", "--value", "mlynář", "--cite", "S1", "--status", "proven"]); // E2
  await w.ok(["event", "add", "P1", "EVEN", "--label", "Požár stavení", "--date", "NOV 1905", "--place", "Lhotečka", "--cite", "S2", "--status", "lead"]); // E3
  return w;
}

const OLD =
  "Jan se narodil roku 1850 ve Lhotečce a byl mlynářem.\n\nV listopadu 1905 hořelo stavení.\n\n" +
  "Opírá se o: [K-01] S0001, [OK-01] S0002 — https://obec.example.org/hasici/1905.";

test("written again: a fact, a source of the background, a source or link the text named — kept, or left out on purpose with the reason", opts, async () => {
  const w = await world();
  await w.ok(["story", "set", "P1", "--text", OLD, "--fact", "E1", "--fact", "E2", "--fact", "E3", "--source", "S3"]);

  // everything left out at once: refused with the list, and how to keep each or leave it out
  const bare = await w.run(["story", "set", "P1", "--text", "Jan byl mlynář.", "--fact", "E1"]);
  assert.equal(bare.code, 2);
  assert.match(bare.err, /the story of P0001 had what this version leaves out/);
  assert.match(bare.err, /E0002 OCCU \[proven\] \(a fact\) → --fact E0002/);
  assert.match(bare.err, /E0003 EVEN NOV 1905 Lhotečka \[lead\] \(a fact\)/);
  assert.match(bare.err, /S0003 Kronika Lhotecka \(a source\) → --source S0003/);
  assert.match(bare.err, /S0002 Dějiny hasičů ve Lhotě · https:\/\/obec\.example\.org\/hasici \(a source\)/);
  assert.match(bare.err, /https:\/\/obec\.example\.org\/hasici\/1905 \(a link\)/, "the sentence's full stop is no part of the link");
  assert.match(bare.err, /--drop "<E…\|S…\|link> <why>"/);
  const json = await w.run(["story", "set", "P1", "--text", "Jan byl mlynář.", "--fact", "E1", "--json"]);
  assert.equal(json.json.code, "story.loses");
  assert.deepEqual(json.json.details.lost.map((l: { ref: string }) => l.ref).sort(), ["E0002", "E0003", "S0002", "S0003", "https://obec.example.org/hasici/1905"].sort());
  // nothing was written
  assert.equal((await w.ok(["story", "show", "P1", "--json"])).json.story.text, OLD);

  // the facts kept: the source a fact of the new one cites (S2 by E3) is kept with it — the text need not name it
  const kept = "Jan se narodil roku 1850 ve Lhotečce a byl mlynářem.\n\nPodle stránky Dějiny hasičů ve Lhotě hořelo v listopadu 1905 stavení (https://obec.example.org/hasici/1905).";
  await w.ok(["story", "set", "P1", "--text", kept, "--fact", "E1", "--fact", "E2", "--fact", "E3", "--source", "S3"]);

  // left out on purpose, each with its reason: written, the reasons kept with the story and in the history
  const r = await w.ok(["story", "set", "P1", "--text", "Jan byl mlynář ve Lhotečce.", "--fact", "E1", "--fact", "E2",
    "--drop", "E0003 požár se ho netýká – jiné stavení", "--drop", "S2 stránka mluví o jiném Janovi", "--drop", "https://obec.example.org/hasici/1905 totéž", "--drop", "S3 kronika nic o mlýnu neříká"]);
  assert.match(r.out, /P0001 story rewritten: \d+ words, draft; left out on purpose: E0003, S0002, https:\/\/obec\.example\.org\/hasici\/1905, S0003/);
  const st = (await w.ok(["story", "show", "P1", "--json"])).json.story;
  assert.deepEqual(st.dropped, [
    { ref: "E0003", why: "požár se ho netýká – jiné stavení" },
    { ref: "S0002", why: "stránka mluví o jiném Janovi" },
    { ref: "https://obec.example.org/hasici/1905", why: "totéž" },
    { ref: "S0003", why: "kronika nic o mlýnu neříká" },
  ]);
  assert.match((await w.ok(["story", "show", "P1"])).out, /left out on purpose of the version before\n  E0003: požár se ho netýká – jiné stavení\n/);
  const ops = (fs.readdirSync(path.join(w.cwd, "data", "ops"), { recursive: true }) as string[]).filter((f) => f.endsWith(".jsonl")).map((f) => fs.readFileSync(path.join(w.cwd, "data", "ops", f), "utf8")).join("");
  assert.match(ops, /"reason":"E0003: požár se ho netýká – jiné stavení; S0002: stránka mluví o jiném Janovi;/);

  // what the version before left out is not asked for again; a --drop needs a reason, and is never of what it keeps
  await w.ok(["story", "set", "P1", "--text", "Jan byl mlynář ve Lhotečce, kde se narodil.", "--fact", "E1", "--fact", "E2"]);
  assert.match((await w.run(["story", "set", "P1", "--text", "Jan.", "--fact", "E1", "--drop", "E0002"])).err, /--drop needs what and why/);
  assert.match((await w.run(["story", "set", "P1", "--text", "Jan.", "--fact", "E1", "--fact", "E2", "--drop", "E0002 proč"])).err, /E0002 is both kept/);
  assert.match((await w.run(["story", "set", "P1", "--text", "Jan.", "--fact", "E1", "--drop", "P0001 proč"])).err, /--drop takes a fact \(E…\), a source \(S…\) or a link/);
  w.cleanup();
});

test("written again: a fact taken back goes by itself; the lock and a couple's story are checked the same way", opts, async () => {
  const w = await world();
  await w.ok(["story", "set", "P1", "--text", "Jan byl mlynář, v roce 1905 hořelo.", "--fact", "E1", "--fact", "E2", "--fact", "E3", "--final"]);
  await w.ok(["event", "retract", "E3", "--reason", "jiný Jan"]);
  // approved: the new version waits beside it — and is compared with it all the same
  assert.match((await w.run(["story", "set", "P1", "--text", "Jan byl mlynář.", "--fact", "E1"])).err, /E0002 OCCU/);
  const r = await w.ok(["story", "set", "P1", "--text", "Jan byl mlynář.", "--fact", "E1", "--fact", "E2"]);
  assert.match(r.out, /waits for the user's approval/);
  // the new version waiting is what the next one is compared with
  assert.equal((await w.run(["story", "set", "P1", "--text", "Jan.", "--fact", "E1"])).code, 2);

  // a couple's story (F…)
  await w.ok(["person", "add", "Anna /Lhotáková/", "--sex", "F"]); // P2
  await w.ok(["family", "add", "--partner", "P1", "--partner", "P2"]); // F1
  await w.ok(["event", "add", "F1", "MARR", "--date", "1875", "--place", "Lhotečka", "--cite", "S1", "--status", "proven"]); // E4
  await w.ok(["story", "set", "F1", "--text", "Svatba byla roku 1875 (S0003).", "--fact", "E4"]);
  const lost = await w.run(["story", "set", "F1", "--text", "Svatba byla roku 1875.", "--fact", "E4"]);
  assert.equal(lost.code, 2);
  assert.match(lost.err, /the story of F0001 had what this version leaves out[\s\S]*S0003 Kronika Lhotecka \(a source\)/);
  await w.ok(["story", "set", "F1", "--text", "Svatba byla roku 1875.", "--fact", "E4", "--source", "S3"]);
  w.cleanup();
});

test("the sources a story rests on are said: story show (title and address under each fact), its JSON, the Strom file", opts, async () => {
  const w = await world();
  await w.ok(["story", "set", "P1", "--text", "Jan byl mlynář. Roku 1905 prý hořelo.", "--fact", "E1", "--fact", "E3", "--source", "S3"]);
  const show = (await w.ok(["story", "show", "P1"])).out;
  assert.match(show, /rests on\n  E0001 P0001 BAPM 1850 Lhotečka \[proven\]\n      ← S0001 Křest Jana 1850\n  E0003 P0001 EVEN NOV 1905 Lhotečka \[lead\]\n      ← S0002 Dějiny hasičů ve Lhotě · https:\/\/obec\.example\.org\/hasici\n/);
  assert.match(show, /the background of place and time from\n  S0003 Kronika Lhotecka\n/);
  const data = (await w.ok(["story", "show", "P1", "--json"])).json;
  assert.deepEqual(data.sources, [
    { id: "S0001", title: "Křest Jana 1850", facts: ["E0001"], background: false },
    { id: "S0002", title: "Dějiny hasičů ve Lhotě", url: "https://obec.example.org/hasici", facts: ["E0003"], background: false },
    { id: "S0003", title: "Kronika Lhotecka", facts: [], background: true },
  ]);

  await w.ok(["export", "gedcom"]);
  const ged = fs.readFileSync(path.join(w.cwd, "output", "tree-strom.ged"), "utf8");
  assert.match(ged, /2 DATA EVEN NOV 1905 Lhotečka \[S0002\]\n2 SOUR @S0001@\n2 SOUR @S0002@\n2 SOUR @S0003@\n/);
  // the source of the background is a record of the file, though no fact cites it
  assert.match(ged, /0 @S0003@ SOUR\n1 TITL Kronika Lhotecka\n/);
  assert.deepEqual(validateGedcom(ged).filter((f) => f.level === "error"), []);
  // the new version beside an approved story: its sources too
  await w.ok(["story", "approve", "P1"]);
  await w.ok(["story", "set", "P1", "--text", "Jan byl mlynář. Roku 1905 prý hořelo, říkají Dějiny hasičů ve Lhotě.", "--fact", "E1", "--fact", "E3", "--source", "S3"]);
  await w.ok(["export", "gedcom"]);
  const again = fs.readFileSync(path.join(w.cwd, "output", "tree-strom.ged"), "utf8");
  assert.match(again, /3 _AT \d{4}-\d\d-\d\d\n|2 _DRAFT\n[\s\S]*3 SOUR @S0002@\n/);
  assert.match(again, /2 _DRAFT\n(?:[34] .*\n)*3 SOUR @S0003@\n/);
  assert.deepEqual(validateGedcom(again).filter((f) => f.level === "error"), []);
  // the standard file keeps the story as a note, no extension tags
  assert.ok(!fs.readFileSync(path.join(w.cwd, "output", "tree.ged"), "utf8").includes("_STORY"));
  w.cleanup();
});

test("a fact told from a lead whose source the text does not name: said, by its title, ID or address — any script", opts, async () => {
  const w = await world();
  const vague = await w.ok(["story", "set", "P1", "--text", "Jan byl mlynář. Podle staršího výzkumu v roce 1905 hořelo.", "--fact", "E1", "--fact", "E3"]);
  assert.match(vague.out, /note: told from a lead, the text does not say where it comes from — name the source \(its title\) in the text:\n  E0003 ← S0002 Dějiny hasičů ve Lhotě · https:\/\/obec\.example\.org\/hasici/);
  // named by its title, decomposed (NFD) as a keyboard may write it
  const named = await w.ok(["story", "set", "P1", "--text", "Jan byl mlynář. Podle stránky „Dějiny hasičů ve Lhotě“ v roce 1905 hořelo.".normalize("NFD"), "--fact", "E1", "--fact", "E3"]);
  assert.doesNotMatch(named.out, /told from a lead/);
  // its ID amid another script is no ID glued to a word: "дS0002" names nothing, "(S0002)" does
  assert.match((await w.ok(["story", "set", "P1", "--text", "Ян був мельником; пожежа 1905 — дS0002.", "--fact", "E1", "--fact", "E3", "--drop", "https://x.example.org/ no"])).out, /told from a lead/);
  assert.doesNotMatch((await w.ok(["story", "set", "P1", "--text", "Ян був мельником; пожежа 1905 (S0002).", "--fact", "E1", "--fact", "E3"])).out, /told from a lead/);
  w.cleanup();
});

// The Strom app's own parser (../strom: the app released, ../strom-beta: the one coming): the sources under _STORY
// pass by an app that does not read them — the story as before, every source a source of the app, and its copy sent
// back changes nothing.
for (const dir of ["strom", "strom-beta"]) {
  const repo = path.resolve(import.meta.dirname, "..", "..", "..", dir);
  const tsx = path.join(repo, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
  test(`the Strom app (${dir}, its own parser and exporter): the story's sources pass by, the story as before, sent back nothing changed`, { skip: !hasGit || !fs.existsSync(tsx) }, async () => {
    const w = await world();
    await w.ok(["story", "set", "P1", "--text", "Jan byl mlynář. Roku 1905 prý hořelo.", "--title", "Mlynář", "--fact", "E1", "--fact", "E3", "--source", "S3", "--final"]);
    await w.ok(["story", "set", "P1", "--text", "Jan byl mlynář. Roku 1905 hořelo, říkají Dějiny hasičů ve Lhotě.", "--fact", "E1", "--fact", "E3", "--source", "S3"]);
    const given = path.join(w.dir, "given.ged");
    await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", given]);
    const text = fs.readFileSync(given, "utf8");
    assert.match(text, /\n2 SOUR @S0003@\n/);
    const [tree, head] = [/^1 _STROM_TREE (.+)$/m.exec(text)![1]!, /^1 _STROM_HEAD (.+)$/m.exec(text)![1]!];
    const script = path.join(w.dir, "app.ts");
    fs.writeFileSync(
      script,
      `import fs from "node:fs";
import { parseGedcom, convertToStrom } from ${JSON.stringify(path.join(repo, "src", "ged-parser.ts"))};
import { exportToGedcom } from ${JSON.stringify(path.join(repo, "src", "ged-exporter.ts"))};
const data = convertToStrom(parseGedcom(fs.readFileSync(process.argv[2]!, "utf8"))).data as any;
const p = (Object.values(data.persons) as any[]).find((x) => x.refn === "P0001");
fs.writeFileSync(process.argv[3]!, exportToGedcom(data, "Lhotákovi", { research: { id: ${JSON.stringify(tree)}, head: ${JSON.stringify(head)} } }).content);
console.log(JSON.stringify({ story: p.story, sources: Object.values(data.sources ?? {}).map((s: any) => s.title ?? s.name).sort() }));
`,
    );
    const back = path.join(w.dir, "back.ged");
    const r = spawnSync(tsx, [script, given, back], { cwd: repo, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    const read = JSON.parse(r.stdout.trim().split("\n").pop()!) as { story: { title: string; status: string; text: string; facts: string[]; draft?: { text: string; facts: string[] } }; sources: string[] };
    assert.equal(read.story.title, "Mlynář");
    assert.equal(read.story.status, "final");
    assert.equal(read.story.text, "Jan byl mlynář. Roku 1905 prý hořelo.");
    assert.deepEqual(read.story.facts, ["BAPM 1850 Lhotečka [S0001]", "EVEN NOV 1905 Lhotečka [S0002]"]);
    assert.equal(read.story.draft?.text, "Jan byl mlynář. Roku 1905 hořelo, říkají Dějiny hasičů ve Lhotě.");
    assert.equal(read.story.draft?.facts.length, 2);
    for (const t of ["Křest Jana 1850", "Dějiny hasičů ve Lhotě", "Kronika Lhotecka"]) assert.ok(read.sources.includes(t), `${t} in ${read.sources.join(" | ")}`);
    assert.deepEqual((await w.ok(["sync", back, "--json"])).json.changes, [], "sent back: nothing changed");
    w.cleanup();
  });
}
