// The agent's texts never give two opposite instructions about an archive only a person's browser goes to: each text
// that keeps the agent's browser off an archive's images also names the one exception the brief gives (the person's
// permission "through the browser", no connector: strom media save, one image at a time).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import "../../src/commands/index.ts";
import { assetPath, methodFor } from "../../src/core/assets.ts";
import { guideText } from "../../src/commands/guide.ts";
import { globalText } from "../../src/agents/global.ts";

const BAN = /not through a browser either|never download from an archive yourself|you never download from an archive yourself/iu;

test("agent texts: a ban on the browser at an archive's images names the strom media save exception", () => {
  const texts: Record<string, string> = {
    "method/waiting.md": fs.readFileSync(assetPath("method", "waiting.md"), "utf8"),
    "method of link (reading.md)": methodFor("link", ["by-hand"]),
    guide: guideText("en", "https://stromapp.info/"),
    "global (skill, AGENTS block)": globalText("https://stromapp.info/"),
  };
  for (const [name, text] of Object.entries(texts)) {
    if (!BAN.test(text)) continue;
    assert.match(text, /strom media save T… --image <n>|`strom media\s+save`|strom media save/u, `${name}: a ban without the exception`);
    assert.match(text, /through the browser/u, `${name}: the exception without the person's permission`);
  }
  // the waiting method's own section says it where the ban is, not elsewhere
  const waiting = texts["method/waiting.md"]!;
  const section = waiting.slice(waiting.indexOf("## Images saved by hand"), waiting.indexOf("## A letter or the family"));
  assert.match(section, /not through a browser either\.[\s\S]*The one exception[\s\S]*strom media save T… --image <n> --at\s+<its page>/u);
  assert.match(section, /a check whether a\s+person is there is the person's to pass/u);
});
