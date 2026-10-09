// The links never go missing for a moment: the applet (macOS) is made beside and put in its place, so the scheme leads
// to this strom while it is made again; and the bridge takes "no links" after links that worked only when the system
// says so twice in a row (found on Mac: a bridge said links: [] for a moment and the Strom app forgot them).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World } from "../helpers.ts";
import { LINK_ACTIONS, LINUX_ENTRY, linkHandlerState, linkHandlerStateLater, macApp, registerLinks, type HandlerState, type Sys } from "../../src/core/links.ts";
import { linksWatch } from "../../src/core/live.ts";

test("made again, the applet (macOS) and the entry (Linux) lead to this strom at every moment: the new one made beside, then put in its place", () => {
  const w = new World();
  const env = { ...w.env, XDG_DATA_HOME: path.join(w.dir, "data"), XDG_CONFIG_HOME: path.join(w.dir, "cfg") };
  const appDir = macApp(env);
  for (const platform of ["darwin", "linux"] as const) {
    const states: HandlerState[] = [];
    let watching = false;
    const run: Sys = (cmd, args) => {
      if (cmd === "osascript") return { status: 0, stdout: fs.existsSync(appDir) ? `${appDir}\n` : "\n" };
      if (cmd === "xdg-mime" && args[0] === "query") return { status: 0, stdout: `${LINUX_ENTRY}\n` };
      // what the system says while each step is taken
      if (watching) states.push(linkHandlerState(env, platform, run));
      if (cmd === "osacompile") fs.mkdirSync(path.join(args[args.indexOf("-o") + 1]!, "Contents", "Resources"), { recursive: true });
      return { status: 0, stdout: "" };
    };
    assert.equal(registerLinks(env, platform, run), true, platform);
    watching = true;
    assert.equal(registerLinks(env, platform, run), true, `${platform}: made again`);
    assert.ok(states.length > 0, platform);
    assert.deepEqual(states.filter((s) => s !== "ours"), [], `${platform}: never without the links while made again`);
    // nothing left beside it
    const dir = platform === "darwin" ? path.dirname(appDir) : path.join(env.XDG_DATA_HOME, "applications");
    assert.deepEqual(fs.readdirSync(dir), [platform === "darwin" ? path.basename(appDir) : LINUX_ENTRY], platform);
  }
  w.cleanup();
});

test("an applet that cannot be made again leaves the one there as it was (macOS)", () => {
  const w = new World();
  const appDir = macApp(w.env);
  let fail = false;
  const run: Sys = (cmd, args) => {
    if (cmd === "osascript") return { status: 0, stdout: `${appDir}\n` };
    if (cmd === "osacompile") {
      if (fail) return { status: 1, stdout: "" };
      fs.mkdirSync(path.join(args[args.indexOf("-o") + 1]!, "Contents", "Resources"), { recursive: true });
    }
    return { status: 0, stdout: "" };
  };
  assert.equal(registerLinks(w.env, "darwin", run), true);
  fail = true;
  assert.equal(registerLinks(w.env, "darwin", run), false);
  assert.equal(linkHandlerState(w.env, "darwin", run), "ours", "the applet there still leads here");
  assert.deepEqual(fs.readdirSync(path.dirname(appDir)), [path.basename(appDir)], "nothing left beside it");
  w.cleanup();
});

test("the bridge's links: no links after links that worked are taken only when the system says so twice in a row; links again at once; a failed read keeps what was", async () => {
  let now = 0;
  const answers: (HandlerState | Error)[] = [];
  let asked = 0;
  const later = () => {
    asked++;
    const a = answers.shift() ?? "ours";
    return a instanceof Error ? Promise.reject(a) : Promise.resolve(a);
  };
  let first = 0;
  const links = linksWatch({ now: () => (first++, "ours"), later }, { freshMs: 60_000, againMs: 5_000, clock: () => now });
  const settle = () => new Promise((r) => setImmediate(r));
  const all = [...LINK_ACTIONS];

  assert.deepEqual(links(), all, "the first read at once");
  assert.equal(first, 1);
  // a moment without them (the applet made again): kept, asked again a few seconds later
  answers.push("none");
  now = 61_000;
  assert.deepEqual(links(), all);
  await settle();
  assert.equal(asked, 1);
  assert.deepEqual(links(), all, "one 'none' is not taken");
  now = 62_000;
  links();
  await settle();
  assert.equal(asked, 1, "not asked again before a few seconds");
  // …the next read says they are there: nothing happened
  answers.push("ours");
  now = 66_500;
  links();
  await settle();
  assert.equal(asked, 2);
  assert.deepEqual(links(), all);
  // gone for good: two reads in a row say so
  answers.push("other", "none");
  now = 130_000;
  links();
  await settle();
  assert.deepEqual(links(), all, "the first read of another handler is not taken either");
  now = 136_000;
  links();
  await settle();
  assert.equal(asked, 4);
  assert.deepEqual(links(), [], "the second in a row is");
  // back: taken at once
  answers.push("ours");
  now = 200_000;
  links();
  await settle();
  assert.deepEqual(links(), all);
  // a read that fails keeps what was
  answers.push(new Error("osascript did not answer"));
  now = 270_000;
  links();
  await settle();
  assert.deepEqual(links(), all);
  assert.equal(first, 1, "the system asked at once only the first time");
});

test("a system that does not answer (a program that fails, a timeout) says nothing of the links: unknown, never none — and the bridge keeps the links it had", async () => {
  const w = new World();
  const env = { ...w.env, XDG_DATA_HOME: path.join(w.dir, "data") };
  const failed: Sys = () => ({ status: null, stdout: "" });
  for (const platform of ["darwin", "win32", "linux"] as const) assert.equal(linkHandlerState(env, platform, failed), "unknown", platform);
  // osascript that ends with an error is no answer either; a definite answer of none is
  assert.equal(linkHandlerState(env, "darwin", () => ({ status: 1, stdout: "" })), "unknown");
  assert.equal(linkHandlerState(env, "darwin", () => ({ status: 0, stdout: "\n" })), "none");
  assert.equal(linkHandlerState(env, "win32", () => ({ status: 1, stdout: "" })), "none", "reg.exe: no such key");
  assert.equal(linkHandlerState(env, "linux", () => ({ status: 0, stdout: "\n" })), "none");
  // the same asked in the background
  const timedOut = async () => ({ status: null, stdout: "" });
  for (const platform of ["darwin", "win32", "linux"] as const) assert.equal(await linkHandlerStateLater(env, platform, timedOut), "unknown", platform);

  // the bridge: what it had stays, however long the system does not answer
  let now = 0;
  const links = linksWatch({ now: () => "ours", later: async () => "unknown" }, { freshMs: 60_000, againMs: 5_000, clock: () => now });
  const settle = () => new Promise((r) => setImmediate(r));
  assert.deepEqual(links(), [...LINK_ACTIONS]);
  for (let i = 1; i <= 3; i++) {
    now = i * 61_000;
    links();
    await settle();
    assert.deepEqual(links(), [...LINK_ACTIONS], `unknown ${i}× in a row`);
  }
  // no answer at the very start: no links said, asked again in a few seconds
  let state: HandlerState = "unknown";
  let asked = 0;
  now = 0;
  const fresh = linksWatch({ now: () => "unknown", later: async () => (asked++, state) }, { freshMs: 60_000, againMs: 5_000, clock: () => now });
  assert.deepEqual(fresh(), []);
  state = "ours";
  now = 5_500;
  fresh();
  await settle();
  assert.equal(asked, 1);
  assert.deepEqual(fresh(), [...LINK_ACTIONS]);
  w.cleanup();
});
