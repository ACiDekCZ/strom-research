// What the bridge works out for a state of the research (/log, /fixes) is made one at a time: an agent's commits a second
// apart no longer start one more making each, side by side (core/live.ts OneAtATime).

import { test } from "node:test";
import assert from "node:assert/strict";
import { OneAtATime } from "../../src/core/live.ts";

function later<T>(): { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void } {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((ok, no) => ((resolve = ok), (reject = no)));
  return { promise, resolve, reject };
}

test("asks for newer states while one is made wait for one next making, for the state when it starts", async () => {
  let state = "a";
  const made: string[] = [];
  const pending = new Map<string, ReturnType<typeof later<string>>>();
  const one = new OneAtATime<string>(
    () => state,
    (key) => {
      made.push(key);
      const l = later<string>();
      pending.set(key, l);
      return l.promise;
    },
  );
  const a1 = one.ask("a");
  const a2 = one.ask("a");
  state = "b";
  const b = one.ask("b");
  state = "c";
  const c = one.ask("c");
  assert.deepEqual(made, ["a"], "one at a time");
  pending.get("a")!.resolve("made a");
  assert.equal(await a1, "made a");
  assert.equal(await a2, "made a");
  // the next, once, for the state now (c): b and c are answered by it
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(made, ["a", "c"]);
  pending.get("c")!.resolve("made c");
  assert.equal(await b, "made c");
  assert.equal(await c, "made c");
  // nothing being made: an ask starts at once
  state = "d";
  const d = one.ask("d");
  assert.deepEqual(made, ["a", "c", "d"]);
  pending.get("d")!.resolve("made d");
  assert.equal(await d, "made d");
});

test("a making that fails fails its asks; the next is made all the same, and a make that throws is a failed ask", async () => {
  let state = "a";
  const one = new OneAtATime<string>(
    () => state,
    (key) => (key === "x" ? (() => { throw new Error("thrown"); })() : key === "a" ? Promise.reject(new Error("failed a")) : Promise.resolve(`made ${key}`)),
  );
  const a = one.ask("a");
  state = "b";
  const b = one.ask("b");
  await assert.rejects(a, /failed a/u);
  assert.equal(await b, "made b");
  await assert.rejects(one.ask("x"), /thrown/u);
  assert.equal(await one.ask("e"), "made e");
});
