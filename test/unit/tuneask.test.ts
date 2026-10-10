// When a question about the reading of scans is asked again (core/tuneask.ts, chapter 7): only when the data changed —
// another model under the key, the sample grown by half, the ratio moved by a quarter or the signal gone and back, new
// material, a new method — never for time alone, at most once in 30 days; "never" only for another model or method.
// Its ID is the same every time and never one of a search's (Q + digits).

import { test } from "node:test";
import assert from "node:assert/strict";
import { ASK, dueAgain, fingerprintOf, questionId, QUESTION_KINDS, type Basis, type TuneAnswer } from "../../src/core/tuneask.ts";

const DAY = 24 * 3600_000;
const NOW = Date.parse("2026-10-10T12:00:00Z");
const basis = (b: Partial<Basis> = {}): Basis => ({ metric: "M5", value: 0.4, samples: 40, ratio: 3, material: ["M0004"], reported: "claude-opus-5-5", rev: 1, ...b });
const answered = (choice: string, daysAgo: number, b: Partial<Basis> = {}): TuneAnswer => {
  const bs = basis(b);
  return { choice, at: new Date(NOW - daysAgo * DAY).toISOString(), fingerprint: fingerprintOf(bs), by: "terminal", strom: "1.13.1", basis: bs };
};

test("a question's ID: the same for the same kind, key and scope; never digits only (a search's Q…)", () => {
  const a = questionId("negatives.weak", "claude opus", "book:B0023");
  assert.match(a, /^Q[0-9a-f]{6}$/);
  assert.equal(a, questionId("negatives.weak", "claude opus", "book:B0023"));
  assert.notEqual(a, questionId("negatives.weak", "claude opus", "book:B0024"));
  assert.notEqual(a, questionId("views.sharper", "claude opus", "book:B0023"));
  assert.notEqual(a, questionId("negatives.weak", "codex gpt-5", "book:B0023"));
  // over many scopes (Cyrillic and accents too): each has a letter
  for (const kind of QUESTION_KINDS) for (let i = 0; i < 300; i++) assert.match(questionId(kind, "grok", `book:Кн${i}ž`), /^Q(?=[0-9a-f]*[a-f])[0-9a-f]{6}$/);
});

test("the fingerprint is the basis, whatever the order of its fields", () => {
  assert.equal(fingerprintOf(basis()), fingerprintOf({ rev: 1, reported: "claude-opus-5-5", material: ["M0004"], ratio: 3, samples: 40, value: 0.4, metric: "M5" }));
  assert.notEqual(fingerprintOf(basis()), fingerprintOf(basis({ samples: 41 })));
  assert.match(fingerprintOf(basis()), /^sha1:[0-9a-f]{40}$/);
});

test("asked again only when the data changed, never for time alone", () => {
  const q = (b: Partial<Basis> = {}) => ({ basis: basis(b) });
  // the same data, long after: not again
  assert.equal(dueAgain(q(), answered("no", 200), NOW), false);
  // 1: another model said under the key
  assert.equal(dueAgain(q({ reported: "claude-opus-5-6" }), answered("no", 40), NOW), true);
  // 2: the sample grown by half and by at least ten
  assert.equal(dueAgain(q({ samples: 60 }), answered("no", 40), NOW), true);
  assert.equal(dueAgain(q({ samples: 59 }), answered("no", 40), NOW), false, "less than half more");
  assert.equal(dueAgain({ basis: basis({ samples: 9 }) }, answered("no", 40, { samples: 6 }), NOW), false, "half more, but fewer than ten");
  // 3: the ratio moved by a quarter; the signal gone and back
  assert.equal(dueAgain(q({ ratio: 3.75 }), answered("no", 40), NOW), true);
  assert.equal(dueAgain(q({ ratio: 2.3 }), answered("no", 40), NOW), false, "less than a quarter");
  assert.equal(dueAgain(q(), answered("no", 40), NOW, new Date(NOW - 5 * DAY).toISOString()), true, "gone after the answer, back now");
  assert.equal(dueAgain(q(), answered("no", 40), NOW, new Date(NOW - 50 * DAY).toISOString()), false, "gone before the answer");
  // 4: new material in its scope
  assert.equal(dueAgain(q({ material: ["M0004", "M0007"] }), answered("no", 40), NOW), true);
  // 5: a new method of the kind
  assert.equal(dueAgain(q({ rev: 2 }), answered("no", 40), NOW), true);
});

test("at most once in 30 days; never asks again only for another model or method; later after 30 days", () => {
  const q = (b: Partial<Basis> = {}) => ({ basis: basis(b) });
  const within = ASK.againDays - 1;
  for (const b of [{ reported: "x" }, { samples: 100 }, { rev: 2 }, { material: ["M9"] }]) assert.equal(dueAgain(q(b), answered("no", within), NOW), false, JSON.stringify(b));
  assert.equal(dueAgain(q(), answered("later", within), NOW), false);
  assert.equal(dueAgain(q(), answered("later", ASK.againDays + 1), NOW), true);
  const never = answered("never", 90);
  assert.equal(dueAgain(q({ samples: 400, ratio: 9, material: ["M1", "M2"] }), never, NOW, new Date(NOW - DAY).toISOString()), false);
  assert.equal(dueAgain(q({ reported: "claude-opus-5-6" }), never, NOW), true);
  assert.equal(dueAgain(q({ rev: 2 }), never, NOW), true);
});
