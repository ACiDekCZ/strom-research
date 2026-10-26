// What waits, split as the Strom app counts it (core/waiting.ts waitingSplit, waitingLine): what only the terminal
// shows (an own edit's conflict, a question about the reading of scans, a send of the app, a milder archive) said apart
// from the count, what waits for a reply too (also on its own) — the rest is the app's number; neither: the line as it was.

import { test } from "node:test";
import assert from "node:assert/strict";
import { inApp, waitingLine, waitingSplit, TERMINAL_ONLY, type Waiting, type WaitingKind } from "../../src/core/waiting.ts";

/** A thing that waits, as waitingFor makes it: its kind and phase, marked when only the terminal shows it. */
function thing(kind: WaitingKind, phase: "todo" | "sent" = "todo", terminalOnly = false): Waiting {
  return {
    ...(terminalOnly ? { terminalOnly: true as const } : {}),
    item: { id: `${kind}-${phase}`, what: kind, on: "", at: "2026-10-01T10:00:00Z", kind, section: "decide", group: { key: kind, name: kind, kind: "other" }, phase, actions: [], order: 0 },
  };
}

const mixed = [thing("letter"), thing("images"), thing("letter", "sent"), thing("conflict", "todo", true), thing("tune", "todo", true)];

test("the split: all, only here in the terminal, waiting for a reply, the app's number", () => {
  assert.deepEqual(waitingSplit(mixed), { all: 5, here: 2, sent: 1, app: 2 });
  assert.deepEqual(mixed.filter(inApp).map((w) => w.item.kind), ["letter", "images", "letter"]);
  assert.deepEqual(waitingSplit([]), { all: 0, here: 0, sent: 0, app: 0 });
  // the options the bridge never asks for: each kind of the terminal's own
  assert.deepEqual([...TERMINAL_ONLY].sort(), ["conflicts", "milder", "sends", "tune"]);
});

test("the line of the menu: what is only here and what waits for a reply said, each on its own, in every language; neither: as it was", () => {
  assert.equal(waitingLine("cs", mixed), "Čeká: 5 (z toho 2 jen tady v terminálu, 1 čeká na odpověď)");
  assert.equal(waitingLine("en", mixed), "Waiting: 5 (of these 2 only here in the terminal, 1 waiting for a reply)");
  assert.equal(waitingLine("de", mixed), "Wartet: 5 (davon 2 nur hier im Terminal, 1 wartet auf Antwort)");
  const threeSent = [...mixed, thing("family", "sent"), thing("web", "sent")];
  assert.equal(waitingLine("cs", threeSent), "Čeká: 7 (z toho 2 jen tady v terminálu, 3 čekají na odpověď)");
  assert.equal(waitingLine("de", threeSent), "Wartet: 7 (davon 2 nur hier im Terminal, 3 warten auf Antwort)");
  // only here, nothing sent
  assert.equal(waitingLine("cs", [thing("letter"), thing("send", "todo", true)]), "Čeká: 2 (z toho 1 jen tady v terminálu)");
  // nothing only here, something sent: the sent ones said on their own — N − sent is still the app's number
  assert.equal(waitingLine("cs", [thing("letter"), thing("letter", "sent")]), "Čeká: 2 (z toho 1 čeká na odpověď)");
  assert.equal(waitingLine("en", [thing("letter"), thing("images"), thing("letter", "sent")]), "Waiting: 3 (of these 1 waiting for a reply)");
  assert.equal(waitingLine("de", [thing("letter"), thing("letter", "sent"), thing("web", "sent")]), "Wartet: 3 (davon 2 warten auf Antwort)");
  // neither only here nor sent: the line as it was
  assert.equal(waitingLine("cs", [thing("letter"), thing("images")]), "Čeká: 2");
  assert.equal(waitingLine("en", [thing("letter")]), "Waiting: 1");
  // the plan's line: the same split
  assert.equal(waitingLine("cs", mixed, "ui.plan.waiting"), "Čeká: 5 (z toho 2 jen tady v terminálu, 1 čeká na odpověď) · v menu: Co čeká");
});
