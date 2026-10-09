// The brief by level: the method's parts a level uses and no others, the writing commands of its sheet with their
// usage from the registry, and the size of both — what every session of that level carries on every turn.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import "../../src/commands/index.ts";
import { assetPath, methodFor, methodPage, METHOD_CONDITIONS } from "../../src/core/assets.ts";
import { commandSheet } from "../../src/brief/sheet.ts";
import { TASK_LEVELS } from "../../src/core/model.ts";

const EVERY = [...METHOD_CONDITIONS];
const sheet = (level: string) => commandSheet(level, { connectors: [{ name: "example-archive", archive: "Example Archive", serves: true }, { name: "other-archive", serves: false }] });
const line = (text: string, command: string) => text.split("\n").find((l) => l.startsWith(`  strom ${command} `)) ?? "";

test("method pages: every mark names levels or conditions, is closed, and none nests", () => {
  const known = new Set<string>([...TASK_LEVELS, ...METHOD_CONDITIONS]);
  for (const file of fs.readdirSync(assetPath("method")).filter((f) => f.endsWith(".md"))) {
    let open = false;
    for (const l of fs.readFileSync(assetPath("method", file), "utf8").split("\n")) {
      const mark = /^<!-- for ([^>]*?) -->$/u.exec(l);
      if (mark) {
        assert.ok(!open, `${file}: a mark inside a mark`);
        open = true;
        for (const w of mark[1]!.trim().split(/\s+/u)) assert.ok(known.has(w), `${file}: unknown "${w}"`);
      } else if (l === "<!-- end -->") {
        assert.ok(open, `${file}: an end without its mark`);
        open = false;
      } else assert.doesNotMatch(l, /<!--/u, `${file}: a mark not on its own line`);
    }
    assert.ok(!open, `${file}: a mark not closed`);
  }
  // nothing of the marks reaches a brief
  for (const level of TASK_LEVELS) assert.doesNotMatch(methodFor(level, EVERY), /<!--/u);
});

test("method by level: a level gets the parts it uses, never the parts it does not", () => {
  const has = (level: string, re: RegExp, conditions: string[] = EVERY) => re.test(methodFor(level, conditions));
  // reading and recording entries: the levels that read records
  for (const level of ["link", "verify", "enrich"]) {
    assert.ok(has(level, /# Method: recording an entry/), level);
    assert.ok(has(level, /# Method: reading scans/), level);
    assert.ok(has(level, /Extract everything the first time/), level);
    assert.ok(has(level, /Say what a hypothesis would connect/), level);
    // the delegation rule and the premise check stay with them
    assert.ok(has(level, /A scan-reader subagent where your agent has one, strom-scan-reader, or your\n {2}own subagents — on your own model, never a faster one — read too, in batches\n {2}of at most twelve/), level);
    assert.ok(has(level, /Check the premise first/), level);
    // a whole view finds, a crop is read; an entry not found on a whole view is looked at in halves first
    assert.ok(has(level, /\*\*Transcribe only from a crop\*\*[\s\S]*`--half both` before calling it not found/), level);
  }
  assert.ok(has("intake", /# Method: reading scans/) && !has("intake", /# Method: recording an entry/));
  // locating books identifies people and searches, but reads no entry whole and connects nobody
  assert.ok(has("locate", /A namesake is not your person/));
  assert.ok(has("locate", /Negative results are results/));
  assert.ok(has("locate", /The tree first, then above it/));
  assert.ok(!has("locate", /Extract everything the first time/));
  assert.ok(!has("locate", /Say what a hypothesis would connect/));
  assert.ok(!has("locate", /# Method: reading scans|# Method: recording an entry/));
  // a story and a request: the premise, the task, the handover — no searching, no namesakes, no images
  for (const level of ["narrate", "request"]) {
    assert.ok(has(level, /Check the premise first/), level);
    assert.ok(has(level, /Stay within the task\.\*\* New questions become new tasks/), level);
    assert.ok(has(level, /Hand over cleanly/), level);
    for (const re of [/A namesake is not your person/, /Negative results are results/, /The tree first/, /Going through many images/, /A new task whose images are not here/])
      assert.ok(!has(level, re), `${level}: ${re}`);
  }
  assert.ok(has("narrate", /Certainty is explicit/));
  assert.ok(!has("request", /Certainty is explicit/));
  // no task: the whole method
  assert.match(methodFor(undefined), /A namesake is not your person[\s\S]*Say what a hypothesis would connect/);
});

test("method by the task's books: how images come is said for the way they come", () => {
  const connector = methodFor("link", ["connector"]);
  assert.match(connector, /\*\*No images here yet:\*\* the book's connector fetches them through strom/);
  assert.doesNotMatch(connector, /The archive has no connector yet: build one|Write `--on` for the user|Too small to read\?/);
  // never your own download, whatever the way
  assert.match(connector, /You never download from an archive yourself \(curl, a script, your browser\n {2}tools\) — only through a connector, paced by strom\./);
  assert.match(methodFor("link", ["connector", "part"]), /Too small to read\?/);
  const none = methodFor("link", ["no-connector"]);
  assert.match(none, /The archive has no connector yet: build one — now, you\./);
  assert.match(none, /Write `--on` for the user, in their\n {2}language/);
  assert.doesNotMatch(none, /No images here yet:|Too small to read\?/);
  // a connector that only finds books, or an archive that allows no automation: by hand, nothing to build
  const hand = methodFor("link", ["by-hand"]);
  assert.match(hand, /Write `--on` for the user, in their\n {2}language/);
  assert.match(hand, /where its connector only finds books/);
  assert.doesNotMatch(hand, /build one — now, you|No images here yet:/);
  // a level that fetches nothing gets none of it
  for (const level of ["intake", "locate", "narrate"]) assert.doesNotMatch(methodFor(level, EVERY), /build one — now, you|Too small to read\?/, level);
  // the calibration is said once: a link task's own page has it
  assert.equal(methodFor("link", EVERY).match(/strom recordset calibrate/gu)?.length, 1);
  assert.match(methodFor("verify", EVERY), /Page ↔ image: `strom recordset calibrate/);
  // one page, one mark: the level and a condition both needed
  const page = "a\n<!-- for link connector -->\nb\n<!-- end -->\nc";
  assert.equal(methodPage(page, "link", ["connector"]), "a\nb\nc");
  assert.equal(methodPage(page, "link", []), "a\nc");
  assert.equal(methodPage(page, "verify", ["connector"]), "a\nc");
});

test("sheet by level: the writing commands a level uses, with their usage from the registry", () => {
  const link = sheet("link");
  // where a source is cited: said once, then +cite in each command that takes all of it
  assert.match(link, /^ {2}\+cite = --cite <S…> --locator <where> --quote <text> --information primary\|secondary\|unknown — the record the line writes from$/m);
  assert.match(line(link, "event add"), /^ {2}strom event add <who> <kind> --date <date> --place <place> --house <no\.> .*--age <age\|who:age>… \+cite --with <role:who>… --status lead\|possible\|probable\|proven\|disproven --note <text ≤500>$/);
  // an edit after its add: what they share said as the add's, what is its own besides, and its reason
  assert.equal(line(link, "event edit"), "  strom event edit <event> [event add's options, not +cite] --without <role:who>… --reason <text>");
  assert.match(line(link, "cite"), /^ {2}strom cite <what> <source> --locator <where> --quote <text> --information primary\|secondary\|unknown --status <status>$/);
  assert.match(line(link, "name add"), /^ {2}strom name add <person> <name> --kind birth\|married\|religious\|alias --primary --prefix <title> --suffix <title> \+cite$/);
  assert.match(line(link, "person add"), /--sex M\|F\|U .*\+cite --status/);
  assert.match(line(link, "family add"), /^ {2}strom family add --partner <who>… --child <who>… .*\+cite/);
  assert.match(line(link, "family child"), /^ {2}strom family child <family> <child> --relation birth\|adopted\|step\|foster\|unknown \+cite$/);
  assert.match(line(link, "family edit"), /--remove <who> --reason <text>$/);
  assert.match(line(link, "source add"), /^ {2}strom source add <title ≤300> --kind <kind> .*--information primary\|secondary\|unknown --form original\|derivative\|authored .*--clip <M…@x,y,w,h>…/);
  assert.match(line(link, "recordset add"), /--access online-free\|online-login\|onsite\|request\|lost\|unknown/);
  // the rules of a status, once: a fact's only, proven only on primary information
  assert.match(link, /^ {2}--status is a fact's \(E…\) only, never a name's or a family's; proven only with a record of the time read directly \(--information primary\), else probable$/m);
  // the connectors after fetch
  assert.match(link, /\n {2}strom fetch <connector> \[book\] [^\n]*\n {2}connectors of these places: example-archive = Example Archive · others: other-archive — books of a place: strom fetch <connector> --find "<place>" --years <from-to>\n/);
  // what a task hardly uses is left to strom help
  assert.doesNotMatch(link, /--parallel|--minutes|--take|--png/);
  assert.match(link, /all options: strom help <command>\)/);

  // locating: places, archives and books, the task pointed at the book — no facts
  const locate = sheet("locate");
  for (const c of ["place add", "place jurisdiction", "repo add", "recordset add", "fetch", "task edit"]) assert.ok(line(locate, c), `locate: ${c}`);
  assert.match(line(locate, "place jurisdiction"), /--kind parish\|civil\|diocese\|manor\|district\|county\|state\|other/);
  for (const c of ["event add", "cite", "family add", "media view"]) assert.equal(line(locate, c), "", `locate: ${c}`);
  assert.doesNotMatch(locate, /--status is a fact's/);
  // a story records no entry, a request little
  const narrate = sheet("narrate");
  assert.ok(line(narrate, "story set"));
  for (const c of ["event add", "source add", "search add", "fetch", "cite"]) assert.equal(line(narrate, c), "", `narrate: ${c}`);
  const request = sheet("request");
  for (const c of ["source add", "event add", "fetch"]) assert.equal(line(request, c), "", `request: ${c}`);
  assert.ok(line(request, "task wait"));
  // an input: its people and their facts, merged into the researched ones
  const intake = sheet("intake");
  for (const c of ["source add", "person add", "event add", "family add", "person merge", "input sort"]) assert.ok(line(intake, c), `intake: ${c}`);
  assert.match(line(intake, "person merge"), /--reason <text>$/);
  // verify: the readings and what they change
  const verify = sheet("verify");
  for (const c of ["source edit", "event edit", "cite", "conflict add", "read"]) assert.ok(line(verify, c), `verify: ${c}`);
  assert.match(line(verify, "source edit"), /^ {2}strom source edit <source> \[source add's options, not --input\]/);
});

test("brief size by level: the method and the commands every session of a level carries stay within their budget", () => {
  // Characters of the method (every part a level can get) and the command sheet. 1.13.1 carried only the method:
  // link 16 083, verify 15 729, enrich 16 698, locate 5 690, intake 12 263, request 4 438, narrate 5 607 — the levels
  // that record entries carry more now, for the writing commands of the sheet (2.9 help calls a session before), and reading from a crop only (whole views are reduced for finding).
  const BUDGET: Record<string, number> = { link: 23_400, verify: 22_300, enrich: 23_500, locate: 7_600, intake: 16_600, request: 4_438, narrate: 5_607 };
  for (const level of TASK_LEVELS) {
    const size = methodFor(level, EVERY).length + sheet(level).length;
    assert.ok(size <= BUDGET[level]!, `${level}: ${size} > ${BUDGET[level]}`);
  }
});
