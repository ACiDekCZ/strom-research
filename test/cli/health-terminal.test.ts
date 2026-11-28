// The tree check as a person reads it in the terminal (verification of 091, findings 1–3): strom health in the
// research's language (--lang too; English for an agent), each step a strom command a person types (the bridge's
// action only in --json), the facts to verify "of N people", and the reports' times in local time, never UTC.

import { test } from "node:test";
import assert from "node:assert/strict";
import { World, hasGit } from "../helpers.ts";
import { builtinLines, localAt, stepWords } from "../../src/commands/health.ts";
import type { HealthBuiltin, HealthStep } from "../../src/core/health.ts";

const opts = { skip: !hasGit, timeout: 240_000 };

function sample(): HealthBuiltin {
  return {
    at: "2026-11-28T12:31:00.000Z",
    head: "abc1234",
    check: { ok: false, errors: 2, warnings: 1, unproven: 3, at: "2026-11-28T12:31:00.000Z" },
    growth: { days: 30, persons: 4, facts: 9, sources: 2 },
    lines: [{ id: "G0001", name: "Lhoták", state: "active", tasks: 0, waiting: 4, stuck: true }],
    queue: { open: 0, parked: 1, empty: true },
    sentOld: [{ id: "T0007", what: "Matrika Lhota", sentDay: "2026-09-01", days: 88 }],
    decide: { conflict: 2, story: 1 },
    fixes: [{ id: "participant-names", count: 413, paid: false }],
    verify: { waiting: 6, byLine: { G0001: { people: 5, facts: 6 } } },
    edges: { unsearched: 2, people: ["P0003", "P0004"] },
    batches: { open: 0, unsorted: 0 },
    material: { unlinked: 3 },
    tasksAudit: 0,
    citations: { noPage: 1, noImage: 0 },
    steps: [
      { kind: "check", count: 2, action: "open" },
      { kind: "line-stuck", subject: "G0001", count: 4, action: "waiting?research=G0001" },
      { kind: "line-stuck", subject: "G0002", action: "work?research=G0002" },
      { kind: "sent-old", count: 1, action: "waiting" },
      { kind: "decide", count: 3, action: "waiting" },
      { kind: "queue-empty", action: "open" },
      { kind: "fix", subject: "participant-names", count: 413, action: "fixes?id=participant-names" },
      { kind: "verify-line", subject: "G0001", count: 6, action: "verify-line:G0001" },
      { kind: "edge", count: 2, action: "open" },
      { kind: "material", count: 3, action: "materials" },
    ],
  };
}

test("health's words: every step a strom command, never the bridge's action; each language its own; the facts of N people", () => {
  const b = sample();
  for (const lang of ["en", "cs", "de", "pl"]) {
    const text = builtinLines(b, lang).join("\n");
    for (const s of b.steps) assert.ok(!text.includes(s.action) || !/[?:]/u.test(s.action), `${lang}: ${s.action}`);
    assert.doesNotMatch(text, /\?research=|\?id=|verify-line:|→ (?:open|waiting|materials)$/mu, lang);
    for (const s of b.steps) assert.match(stepWords(s as HealthStep, lang).command, /^strom [\p{L}]/u, `${lang}: ${s.kind}`);
    assert.doesNotMatch(text, /\{[\p{L}]+\}/u, `${lang}: no placeholder left`);
  }
  assert.deepEqual(
    b.steps.map((s) => stepWords(s as HealthStep, "en").command),
    [
      "strom check",
      "strom task list --research G0001 --state waiting",
      "strom run --research G0002",
      "strom task list --state waiting",
      "strom status",
      "strom run",
      "strom fixes show participant-names",
      "strom verify bulk --scope line --of G0001 --dry-run",
      "strom edge",
      "strom input list",
    ],
  );
  const en = builtinLines(b, "en").join("\n");
  assert.match(en, /Facts to verify: 6 \(G0001: 6 facts of 5 people\)/u);
  assert.doesNotMatch(en, /6 of 5/u);
  assert.match(en, /^  1\. the data check found errors: 2 → strom check$/mu);
  assert.match(builtinLines(b, "cs").join("\n"), /Údaje k ověření: 6 \(G0001: 6 údajů u 5 osob\)/u);
  assert.match(builtinLines(b, "cs").join("\n"), /^Další kroky:$/mu);
  assert.match(builtinLines(b, "de").join("\n"), /6 Angaben zu 5 Personen/u);
  assert.match(builtinLines(b, "pl").join("\n"), /6 faktów u 5 osób/u);
  // one of one: the singular
  assert.match(builtinLines({ ...b, verify: { waiting: 1, byLine: { G0001: { people: 1, facts: 1 } } } }, "cs").join("\n"), /1 údaj u 1 osoby/u);
});

test("health's times: local time, never UTC", () => {
  const tz = process.env.TZ;
  try {
    process.env.TZ = "Europe/Prague";
    assert.equal(localAt("2026-11-28T12:31:00.000Z"), "2026-11-28 13:31");
    process.env.TZ = "America/New_York";
    assert.equal(localAt("2026-11-28T02:05:00.000Z"), "2026-11-27 21:05");
  } finally {
    if (tz === undefined) delete process.env.TZ;
    else process.env.TZ = tz;
  }
  assert.equal(localAt("no time"), "no time");
});

test("strom health in the research's language (--lang too), English for an agent; list and show in local time", opts, async () => {
  const tz = process.env.TZ;
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    await w.ok(["person", "add", "Čeněk /Lhoták/", "--sex", "M"]);
    const cs = await w.ok(["health"]);
    assert.match(cs.out, /^Kontrola stromu · celý strom · [0-9a-f]{7}$/mu);
    assert.match(cs.out, /^Kontrola dat: v pořádku/mu);
    assert.match(cs.out, /^Přibylo za 30 dní: \+1 osob/mu);
    assert.doesNotMatch(cs.out, /tree check|grew in/iu);
    const de = await w.ok(["health", "--lang", "de"]);
    assert.match(de.out, /^Prüfung des Stammbaums · /mu);
    const agent = await w.ok(["health"], { env: { CLAUDECODE: "1" } });
    assert.match(agent.out, /^Tree check · the whole tree · /mu);
    assert.match(agent.out, /^Data check: in order/mu);
    // an agent asking in a language gets it
    assert.match((await w.ok(["health", "--lang", "pl"], { env: { CLAUDECODE: "1" } })).out, /^Kontrola drzewa · /mu);

    process.env.TZ = "Asia/Tokyo";
    const saved = await w.ok(["health", "--save", "--json"]);
    const at = ((await w.ok(["health", "list", "--json"])).json.reports as { id: string; at: string }[])[0]!.at;
    assert.equal(saved.json.id, "C0001");
    const utc = at.slice(0, 16).replace("T", " ");
    const local = localAt(at);
    assert.notEqual(local, utc, "Tokyo is never UTC");
    for (const args of [["health", "list"], ["health", "show", "C0001"]]) {
      const out = (await w.ok(args)).out;
      assert.ok(out.includes(local), `${args.join(" ")}: ${out}`);
      assert.ok(!out.includes(utc), `${args.join(" ")}: no UTC`);
    }
    assert.match((await w.ok(["health", "show", "C0001"])).out, /Vestavěná část tehdy:/u);
  } finally {
    if (tz === undefined) delete process.env.TZ;
    else process.env.TZ = tz;
    w.cleanup();
  }
});
