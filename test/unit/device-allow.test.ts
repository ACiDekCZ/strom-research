// What a device of the home network may ask a tree's bridge through the gateway (src/core/device-allow.ts): denied
// unless named — every group of reads and of the person's writes passes, every group only the computer has is refused
// with its action, and so is anything unknown or any path that is no plain path of the bridge.

import { test } from "node:test";
import assert from "node:assert/strict";
import { deviceAllows } from "../../src/core/device-allow.ts";

const SHA = "a".repeat(64);
const SECRET = "Zx9_secretOfTheBridge0";

type Case = [method: string, path: string, body?: unknown];

const ALLOWED: Case[] = [
  // reads
  ["GET", "status"],
  ["GET", "status/work"],
  ["GET", "tree.ged"],
  ["GET", "images.ged"],
  ["GET", `image/${SHA}`],
  ["GET", "log"],
  ["GET", "recent"],
  ["GET", "whats-new"],
  ["GET", `media/${SHA}`],
  ["GET", "excerpt/S12"],
  ["GET", "excerpts"],
  ["GET", "material"],
  ["GET", `material/${SHA}/uses`],
  ["GET", "queue"],
  ["GET", "directions/people"],
  ["GET", "places"],
  ["GET", "quality"],
  ["GET", "surnames"],
  ["GET", "history"],
  ["GET", "history/align"],
  ["GET", "sources/split"],
  ["GET", "read/D4"],
  ["GET", "read/D4/page/2.jpg"],
  ["GET", "reads"],
  ["GET", "fixes"],
  ["GET", "waiting/T0007/fix"],
  ["GET", "group/place%3ALhota/note"],
  ["GET", "offline/B3"],
  // what only reads, though asked by POST
  ["POST", "duplicates", {}],
  ["POST", "images", { sha: [SHA] }],
  ["POST", "media/known", { sha: [SHA] }],
  // sends
  ["POST", "sync", {}],
  ["POST", "sync/I12/again", {}],
  ["POST", "cancel", {}],
  // materials
  ["POST", "batch/B5/done", {}],
  ["POST", "batch/B5/done", { sort: false }],
  ["PUT", "lists/L2", { items: [] }],
  ["POST", "material/assign", {}],
  ["POST", "material/hide", {}],
  ["POST", "material/edit", {}],
  ["POST", "material/delete", {}],
  // sources
  ["POST", "source/retract", {}],
  ["POST", "source/restore", {}],
  ["POST", "sources/confirm", {}],
  ["POST", "sources/proposal", {}],
  ["POST", "sources/split", {}],
  ["POST", "sources/split/undo", {}],
  // what waits
  ["POST", "waiting/T0007", { do: "sent" }],
  ["POST", "waiting/T0007", { do: "unsent" }],
  ["POST", "waiting/T0007", { do: "answer", text: "Lhota" }],
  ["POST", "waiting/T0007", { do: "retry" }],
  ["POST", "waiting/W-B-3", { do: "keep" }],
  ["POST", "group/place%3ALhota", { do: "sent" }],
  // facts
  ["POST", "facts/confirm", {}],
  ["POST", "facts/revert", {}],
  ["POST", "conflict/keep", {}],
  // history and places
  ["POST", "history/hide", {}],
  ["POST", "history/skip", {}],
  ["POST", "history/delete", {}],
  ["POST", "history/map", {}],
  ["POST", "history/first", {}],
  ["POST", "history/align", {}],
  ["POST", "history/align/undo", {}],
  ["POST", "quality/dismiss", {}],
  ["POST", "places/answer", {}],
  ["POST", "places/undo", {}],
  // lines and the queue
  ["POST", "directions/G3", {}],
  ["POST", "directions/G3/state", { state: "paused" }],
  ["POST", "directions/order", { order: ["G3"] }],
  ["POST", "directions/G3/gather/undo", {}],
  ["POST", "queue/T0007", {}],
  // runs
  ["POST", "runs/stop", {}],
  ["POST", "verify/stop", {}],
  ["POST", "settings/runs", { max: 1 }],
];

const DENIED: [...Case, string][] = [
  // the agent's work, what spends its sessions
  ["POST", "verify", {}, "verify"],
  ["POST", "verify/bulk", {}, "verify.bulk"],
  ["GET", "material/sort", undefined, "material.sort"],
  ["POST", "material/sort", {}, "material.sort"],
  ["POST", "batch/B5/done", { sort: true }, "batch.sort"],
  ["POST", "read/D4/again", {}, "read"],
  ["POST", "read/D4/cancel", {}, "read"],
  ["GET", "sources/read", undefined, "sources.read"],
  ["POST", "sources/read", {}, "sources.read"],
  ["POST", "sources/S3/read/D4/task", {}, "sources.read"],
  ["POST", "places/identify", {}, "places.identify"],
  ["POST", "places/run", {}, "places.run"],
  ["POST", "history/place", {}, "history.place"],
  ["POST", "history/kinds", {}, "history.kinds"],
  ["POST", "experiments", {}, "experiments"],
  ["POST", "intake", {}, "intake"],
  ["POST", "sourceTask", {}, "sourceTask"],
  ["POST", "hypotheses", {}, "hypotheses"],
  ["POST", "stories", {}, "stories"],
  // the research's and the computer's settings
  ["POST", "live", { do: "stop" }, "live"],
  ["POST", "offline", {}, "offline"],
  ["POST", "offline/B3", {}, "offline"],
  ["POST", "books", {}, "books"],
  ["POST", "books/aside", {}, "books.aside"],
  ["POST", "census", {}, "census"],
  ["POST", "settings/sort", {}, "settings.sort"],
  ["POST", "adopt", {}, "adopt"],
  ["GET", "adopt", undefined, "adopt"],
  ["GET", "transfer", undefined, "transfer"],
  ["GET", "phone", undefined, "phone"],
  ["POST", "phone/pair", { mode: "app" }, "phone"],
  // decisions of this version the computer's alone (U9b brings them to devices)
  ["POST", "conflict/C4", { keep: "a" }, "conflict.decide"],
  ["POST", "sync/I12/undo", {}, "sync.undo"],
  ["POST", "directions", { name: "Lhoták" }, "directions.new"],
  ["POST", "directions/preview", {}, "directions.preview"],
  // a wait answered otherwise than the person in the app does
  ["POST", "waiting/T0007", { do: "fix" }, "waiting.fix"],
  ["POST", "waiting/T0007", {}, "waiting.do"],
  ["POST", "waiting/W-B-3", { do: "sent" }, "waiting.branch"],
  // files go by PUT /device/media; the stream of events is the gateway's own
  ["PUT", `media/${SHA}`, undefined, "media.put"],
  ["GET", "events", undefined, "events"],
  // methods and paths nobody named
  ["DELETE", "status", undefined, "delete.status"],
  ["PATCH", "facts/confirm", {}, "patch.facts"],
  ["GET", "nothing/known", undefined, "nothing"],
  ["POST", "status", {}, "status"],
];

const MALFORMED: Case[] = [
  ["GET", ""],
  ["GET", "/status"],
  ["GET", "status/"],
  ["GET", "../config.json"],
  ["GET", "media/../../etc/passwd"],
  ["GET", "read/%2e%2e/page/1.jpg"],
  ["GET", "read/%2E%2E"],
  ["GET", "media%2f..%2fconfig"],
  ["GET", "status//work"],
  ["GET", "http://127.0.0.1:47990/status"],
  ["GET", "//evil.example/status"],
  ["GET", "status?x=1"],
  ["GET", "status#x"],
  ["GET", "status\\..\\x"],
  ["GET", "sta\u0000tus"],
  ["GET", `${SECRET}/status`],
  ["GET", `status/${SECRET}`],
  // encoded, or inside a word
  ["GET", `status/${[...SECRET].map((c) => `%${c.charCodeAt(0).toString(16)}`).join("")}`],
  ["GET", `status/${SECRET.slice(0, 3)}%${SECRET.charCodeAt(3).toString(16)}${SECRET.slice(4)}`],
  ["GET", `image/x${SECRET}`],
];

test("the gateway lets a device read the research and write what the person writes in the app — every group named", () => {
  for (const [m, p, b] of ALLOWED) {
    const r = deviceAllows(m, p, b, SECRET);
    assert.deepEqual(r, { ok: true, path: p }, `${m} ${p} ${JSON.stringify(b)}`);
  }
});

test("what only the computer does, and anything not named, is refused with its action", () => {
  for (const [m, p, b, action] of DENIED) assert.deepEqual(deviceAllows(m, p, b, SECRET), { ok: false, action }, `${m} ${p} ${JSON.stringify(b)}`);
});

test("a path that climbs, is encoded to climb, is doubled, an address of its own, or carries the bridge's secret: refused as a path", () => {
  for (const [m, p] of MALFORMED) assert.deepEqual(deviceAllows(m, p, undefined, SECRET), { ok: false, action: "path" }, JSON.stringify(p));
});

test("a path in any script passes as a word (a group's key with diacritics, NFC or NFD, Cyrillic)", () => {
  for (const key of ["place:Lhota u Lhotky", "místo:Lhotka", "место:Лхота", "místo:Lhota".normalize("NFD")]) {
    const p = `group/${key.replace(/ /g, "%20")}/note`;
    assert.equal(deviceAllows("GET", p).ok, true, p);
  }
});
