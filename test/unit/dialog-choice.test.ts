// A window with choices (core/dialog.ts): Enter takes the first choice — the recommended one — and Esc, closing the
// window or no answer in time decides nothing ("later"), on every system. Only the commands are looked at: no window.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { choiceCommand, type ChoiceText } from "../../src/core/dialog.ts";

const text: ChoiceText = { title: "Strom výzkum", question: "Stahovat pomalu, jeden snímek za 10 s?", choices: [{ key: "slow", label: "Povolit pomalu" }, { key: "manual", label: "Jen ručně" }], later: "Později", keys: "Ano – Povolit pomalu · Ne – Jen ručně · Storno – Později" };

test("macOS: the recommended button is the default (Enter), later the cancel button (Esc)", () => {
  const c = choiceCommand(text, "darwin")!;
  assert.equal(c.cmd, "osascript");
  const script = c.args[1]!;
  assert.match(script, /buttons \{"Později", "Jen ručně", "Povolit pomalu"\}/);
  assert.match(script, /default button "Povolit pomalu" cancel button "Později"/);
  assert.match(script, /giving up after \d+/);
});

test("Windows: Yes the recommended one and the default, Cancel later (Esc); which is which said in the text", () => {
  const c = choiceCommand(text, "win32")!;
  assert.equal(c.cmd, "powershell.exe");
  const ps = c.args.at(-1)!;
  assert.match(ps, /'YesNoCancel', 'Warning', 'Button1'/);
  assert.match(ps, /Ano – Povolit pomalu · Ne – Jen ručně · Storno – Později/);
});

test("Linux: zenity's OK (its default) the recommended one, later its cancel; kdialog's Yes", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom dialog "));
  try {
    for (const tool of ["zenity", "kdialog"]) {
      const bin = path.join(dir, tool);
      fs.mkdirSync(bin);
      fs.writeFileSync(path.join(bin, tool), "#!/bin/sh\n", { mode: 0o755 });
      // (on a Windows host, where Linux is only simulated, PATH is searched as Windows searches it: <tool>.cmd)
      fs.writeFileSync(path.join(bin, `${tool}.cmd`), "@exit /b 0\r\n");
      const c = choiceCommand(text, "linux", { PATH: bin })!;
      assert.equal(c.cmd, tool);
      if (tool === "zenity") {
        assert.deepEqual(c.args.slice(c.args.indexOf("--ok-label"), c.args.indexOf("--ok-label") + 4), ["--ok-label", "Povolit pomalu", "--cancel-label", "Později"]);
        assert.ok(!c.args.includes("--default-cancel"));
      } else assert.deepEqual(c.args.slice(c.args.indexOf("--yes-label"), c.args.indexOf("--yes-label") + 2), ["--yes-label", "Povolit pomalu"]);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
