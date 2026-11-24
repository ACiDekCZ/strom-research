// What helps most (spec 105 K4.1, core/waitgain.ts): each thing that waits for the person with tasks behind it says how
// much dealing with it grows the tree — a new generation above a person the research reaches, the direct line, the
// tasks it frees — and why, in the research's language; strom task list --state waiting --order gain puts the most
// first; the order of What waits stays as it is.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { update } from "../../src/core/records.ts";
import { waitingFor } from "../../src/core/waiting.ts";
import { gainSays, type Gain } from "../../src/core/waitgain.ts";
import type { Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit };
const HOST = "digi.example.net";

/**
 * Matěj (P1, the research's focus), his parents Josef (P2) and Анна (P3, a name in Cyrillic) with none of their own, his
 * brother Karel (P4: family, no ancestor). Waiting: T1 Josef's baptism, its images (book B0001, which an open T2 and a
 * parked T3 need too); T4 a letter about Karel; T5 about Matěj and Анна, waiting for an archive's permission whose
 * question waits (one of its tasks, no item of its own); and a question of another archive no task waits for.
 */
async function world(): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["research", "new", "Předci Matěje", "--new-person", "Matěj /Lhoták/", "--sex", "M", "--born", "1900"]);
  await w.ok(["person", "add", "Josef /Lhoták/", "--sex", "M", "--born", "1870"]); // P2
  await w.ok(["person", "add", "Анна /Лготова/", "--sex", "F", "--born", "1872"]); // P3
  await w.ok(["person", "add", "Karel /Lhoták/", "--sex", "M", "--born", "1903"]); // P4
  await w.ok(["family", "add", "--partner", "P2", "--partner", "P3", "--child", "P1", "--child", "P4"]);
  await w.ok(["recordset", "add", "Lhota N 1860–1880", "--url", "https://www.archiv.example.org/book/1"]); // B0001
  await w.ok(["recordset", "add", "Lhota O 1890–1900", "--url", `https://${HOST}/book/4`]); // B0002
  const add = (what: string, where: string, ...about: string[]) =>
    w.ok(["task", "add", what, "--level", "link", "--where", where, "--why", "rodiče", "--done-when", "zápis", ...about.flatMap((p) => ["--about", p]), "--anyway"]);
  await add("Křest Josefa", "B0001", "P2"); // T1
  await add("Křest Anny", "B0001", "P3"); // T2
  await add("Křest Josefa, druhý ročník", "B0001", "P2"); // T3
  await add("Vzpomínky na Karla", "rodina", "P4"); // T4
  await add("Oddavky rodičů Matěje", "B0002", "P1", "P3"); // T5
  await w.ok(["task", "wait", "T1", "--images", "B0001:5-6", "--on", "Snímky 5–6 knihy Lhota N k uložení ručně."]);
  await w.ok(["task", "park", "T3", "--reason", "až po T1"]);
  await w.ok(["task", "wait", "T4", "--on", "Vzpomínky rodiny na Karla.", "--kind", "family"]);
  await w.ok(["task", "wait", "T5", "--on", "Rozhodnutí o snímcích archivu."]);
  const at = new Date(Date.now() - 3_600_000).toISOString();
  fs.writeFileSync(
    path.join(w.env.STROM_CONFIG_DIR!, "archives.json"),
    JSON.stringify({
      archives: {},
      pending: [
        { kind: "permission", key: `permission:${HOST}`, at, host: HOST, title: "Digitální archiv Lhota" },
        { kind: "permission", key: "permission:other.example.com", at, host: "other.example.com", title: "Jiný archiv" },
      ],
    }),
  );
  const tree = Tree.open(w.cwd, w.env);
  tree.withTreeLock(() => {
    update<Task>(tree, "T0005", "task", (t) => ({ ...t, awaitsPermission: { hosts: [HOST], since: at, title: "Digitální archiv Lhota" } }), { op: "task.edit", summary: "T0005 waits for the archive's decision" });
    tree.commit("T0005 waits for the archive's decision");
  });
  return w;
}

test("what helps most: a new generation, the direct line, the tasks freed — scored and said in the research's language; no gain without a task; the order unchanged", opts, async () => {
  const w = await world();
  const tree = Tree.open(w.cwd, w.env);
  const plain = waitingFor(tree).map((x) => x.item);
  const items = waitingFor(tree, { gain: true }).map((x) => x.item);
  // the order of What waits stays strom's: the gain only adds a field
  assert.deepEqual(items.map((i) => [i.id, i.order]), plain.map((i) => [i.id, i.order]));
  assert.ok(plain.every((i) => !("gain" in i)), "asked for only");
  const by = (id: string) => items.find((i) => i.id === id)!;
  const gain = (id: string) => by(id).gain as Gain | undefined;

  // Josef: no parents, the research reaches him (generation 2), an ancestor; his book needed by T2 open and T3 parked
  assert.deepEqual(gain("T0001"), {
    score: 110,
    says: "nová generace: rodiče osoby Josef Lhoták · přímá linie · odblokuje 3 úkoly",
    parts: [{ kind: "generation", person: "P0002", name: "Josef Lhoták", missing: "parents" }, { kind: "line" }, { kind: "unblocks", n: 3 }],
  });
  // Karel: family, no ancestor, both parents known (unproven: never a new generation) — his own task alone, unsaid
  assert.deepEqual(gain("T0004"), { score: 10, says: "", parts: [] });
  // the archive's question: its task's people (Matěj's parents unproven — no generation; Анна's parents unknown), one task
  const question = gain(`permission:${HOST}`)!;
  assert.deepEqual((by(`permission:${HOST}`).tasks as string[]).filter((t) => t.startsWith("T")), ["T0005"]);
  assert.equal(question.score, 90);
  assert.deepEqual(question.parts, [{ kind: "generation", person: "P0003", name: "Анна Лготова", missing: "parents" }, { kind: "line" }]);
  assert.equal(question.says, "nová generace: rodiče osoby Анна Лготова · přímá linie");
  // a question no task waits for: nothing behind it, no gain
  assert.ok(by("permission:other.example.com"), "it waits");
  assert.equal(gain("permission:other.example.com"), undefined);
  assert.ok(!("gain" in by("permission:other.example.com")));

  // the parts said in English (and the plural of each language)
  assert.equal(gainSays("en", gain("T0001")!.parts), "a new generation: the parents of Josef Lhoták · the direct line · unblocks 3 tasks");
  assert.equal(gainSays("cs", [{ kind: "generation", person: "P0002", name: "Josef Lhoták", missing: "mother" }, { kind: "unblocks", n: 5 }]), "nová generace: matka osoby Josef Lhoták · odblokuje 5 úkolů");
  assert.equal(gainSays("de", [{ kind: "generation", person: "P0002", name: "Josef Lhoták", missing: "father" }]), "eine neue Generation: der Vater von Josef Lhoták");

  w.cleanup();
});

test("strom task list --state waiting --order gain: the most first, then as listed; why on each row; gain in --json; only with --state waiting", opts, async () => {
  const w = await world();
  const listed = (await w.ok(["task", "list", "--state", "waiting", "--json"])).json.tasks as { id: string; gain?: unknown }[];
  assert.deepEqual(listed.map((t) => t.id), ["T0001", "T0004", "T0005"]);
  assert.ok(listed.every((t) => !("gain" in t)));
  const r = await w.ok(["task", "list", "--state", "waiting", "--order", "gain", "--json"]);
  const tasks = r.json.tasks as { id: string; gain?: Gain }[];
  // T5 (90, its question's gain) before T4 (10)
  assert.deepEqual(tasks.map((t) => [t.id, t.gain?.score]), [["T0001", 110], ["T0005", 90], ["T0004", 10]]);
  assert.equal(tasks[0]!.gain!.says, "nová generace: rodiče osoby Josef Lhoták · přímá linie · odblokuje 3 úkoly");
  const text = (await w.ok(["task", "list", "--state", "waiting", "--order", "gain"])).out;
  const rows = text.split("\n").filter((l) => /^T\d{4}/u.test(l.trim()));
  assert.deepEqual(rows.map((l) => l.trim().slice(0, 5)), ["T0001", "T0005", "T0004"]);
  assert.match(rows[0]!, /\+110 nová generace: rodiče osoby Josef Lhoták · přímá linie · odblokuje 3 úkoly/u);
  assert.match(rows[1]!, /\+90 nová generace: rodiče osoby Анна Лготова/u);
  // only for the tasks that wait, only gain
  const queue = await w.run(["task", "list", "--order", "gain"]);
  assert.equal(queue.code, 2, queue.out + queue.err);
  assert.match(queue.err, /--state waiting --order gain/u);
  const other = await w.run(["task", "list", "--state", "waiting", "--order", "priority"]);
  assert.equal(other.code, 2);
  assert.match(other.err, /only gain/u);
  w.cleanup();
});
