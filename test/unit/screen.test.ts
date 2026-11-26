// How a screen of the menu is drawn (spec 144): widths, colours only on a person's terminal, the old Windows console,
// keys and values in their columns, commands never broken — in any script and in decomposed text.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  commandLine,
  commandsIn,
  crumbLine,
  decorate,
  listLines,
  optionLines,
  PLAIN,
  shortLabel,
  shown,
  terminalStyle,
  widthOf,
  wrap,
  plain,
  line,
  saidLines,
  type Style,
} from "../../src/cli/screen.ts";
import { shaped } from "../../src/cli/menu-parts.ts";

const tty = (columns: number | undefined, env: Record<string, string | undefined> = {}, platform: NodeJS.Platform = "linux", agent = false): Style =>
  terminalStyle({ tty: true, env, platform, columns: () => columns, agent });
const noColor = (columns: number): Style => tty(columns, { NO_COLOR: "1" });
const ESC = "\x1b";

test("the width: the terminal's between 60 and 100, never wrapped off a terminal", () => {
  assert.equal(widthOf(noColor(40)), 60);
  assert.equal(widthOf(noColor(80)), 80);
  assert.equal(widthOf(noColor(120)), 100);
  assert.equal(widthOf(PLAIN), Infinity);
  assert.equal(widthOf(terminalStyle({ tty: false, env: {}, platform: "linux", columns: () => 80, agent: false })), Infinity);
});

test("lines at 60, 80 and 100 columns: none longer, broken between words, the rest under the text", () => {
  const label = "Lhoták z Lhoty zapsal v knize narozených, oddaných i zemřelých všechno, co o rodu věděl, a ještě víc";
  for (const w of [60, 80, 100]) {
    const lines = optionLines([{ key: "1", label }, { key: "0", label: "Zpět" }], noColor(w));
    const text = lines.join("\n").split("\n");
    for (const l of text) assert.ok(shown(l) <= w, `${w}: ${l}`);
    if (w < 100) assert.match(text[1]!, /^ {7}\p{L}/u, `${w}: the second line under the text`);
    assert.equal(text.filter((l) => l.includes("[0]")).length, 1);
  }
  // off a terminal: one line, whole
  assert.equal(optionLines([{ key: "1", label }], PLAIN)[0], `  [1]  ${label}`);
});

test("colours: only on a person's terminal — NO_COLOR, FORCE_COLOR=0, TERM=dumb, an agent's shell and no terminal have none", () => {
  const opts = [{ key: "1", label: "Jazyk", value: "čeština" }, { key: "0", label: "Zpět" }];
  assert.match(optionLines(opts, tty(80)).join("\n"), new RegExp(`${ESC}\\[1m\\[1\\]`, "u"));
  for (const s of [tty(80, { NO_COLOR: "1" }), tty(80, { FORCE_COLOR: "0" }), tty(80, { FORCE_COLOR: "false" }), tty(80, { TERM: "dumb" }), tty(80, {}, "linux", true), PLAIN])
    assert.ok(!optionLines(opts, s).join("\n").includes(ESC));
  // FORCE_COLOR turns nothing on off a terminal (what goes to a file or a pipe stays plain)
  assert.equal(terminalStyle({ tty: false, env: { FORCE_COLOR: "1" }, platform: "linux", columns: () => 80, agent: false }).color, false);
  assert.equal(tty(80, { FORCE_COLOR: "1" }).color, true);
  // the meaning is the same without colour: the same characters
  const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/gu, "");
  assert.equal(strip(optionLines(opts, tty(80)).join("\n")), optionLines(opts, noColor(80)).join("\n"));
});

test("the old Windows console: no faint text, ✓ ✗ in ASCII; Windows Terminal and others say who they are", () => {
  const old = tty(80, {}, "win32");
  assert.equal(old.faint, false);
  assert.equal(old.ascii, true);
  assert.equal(decorate("✓ Uloženo\n✗ Nenalezeno", old).replace(/\x1b\[[0-9;]*m/gu, ""), "+ Uloženo\nx Nenalezeno");
  assert.ok(!optionLines([{ key: "1", label: "Snímky", value: "3", extra: "Lhota 1890" }], old).join("").includes(`${ESC}[2m`));
  for (const env of [{ WT_SESSION: "x" }, { TERM_PROGRAM: "vscode" }, { ConEmuPID: "1" }, { TERM: "xterm" }]) {
    const s = tty(80, env, "win32");
    assert.equal(s.ascii, false, JSON.stringify(env));
    assert.equal(s.faint, true);
  }
  assert.equal(tty(80, {}, "darwin").ascii, false);
});

test("values in one column after the labels, at most 40; a longer label wrapped within it on a terminal, its value after · off one", () => {
  const options = [
    { key: "1", label: "Jazyk", value: "čeština" },
    { key: "2", label: "Agent", value: "Claude", extra: "model nejlepší" },
    { key: "3", label: "Šablona dopisu pro matriční úřad v Horní Lhotě", value: "vlastní" },
    { key: "0", label: "Zpět" },
  ];
  const lines = optionLines(options, PLAIN);
  assert.equal(lines[0], "  [1]  Jazyk  čeština".replace("Jazyk  ", `Jazyk${" ".repeat(40 - 5 + 2)}`));
  assert.equal(lines[0]!.indexOf("čeština"), lines[1]!.indexOf("Claude"));
  assert.match(lines[2]!, / · vlastní$/u);
  assert.deepEqual(lines.slice(-2), ["", "  [0]  Zpět"]);
  // a terminal: the label wrapped within its column, its value in the column beside its first line
  const term = optionLines(options, noColor(80)).join("\n").split("\n");
  const at = term[0]!.indexOf("čeština");
  assert.equal(term[2]!.indexOf("vlastní"), at, term.join("\n"));
  assert.match(term[2]!, /^ {2}\[3\] {2}Šablona dopisu pro matriční úřad v Horní +vlastní$/u);
  assert.equal(term[3], `${" ".repeat(7)}Lhotě`);
  for (const l of term) assert.ok(shown(l) <= 80, l);
  // a value said further wraps under the value, the label's further lines under the label
  const de = optionLines([{ key: "1", label: "Zeit", value: "60 Min." }, { key: "3", label: "Ohne die persönlichen Erweiterungen des Agenten", value: "an", extra: "Skills, Plugins, MCP-Server und noch etwas mehr" }], noColor(80)).join("\n").split("\n");
  assert.equal(de[1]!.indexOf("an  Skills"), de[0]!.indexOf("60 Min."), de.join("\n"));
  assert.match(de[2]!, /^ {7}Agenten +\S/u, de.join("\n"));
  assert.equal(de[2]!.search(/(?<=Agenten +)\S/u), de[0]!.indexOf("60 Min."), de.join("\n"));
  // keys aligned right: [9] under [10]
  const many = optionLines(Array.from({ length: 11 }, (_, i) => ({ key: String(i + 1), label: `Lhota ${i + 1}` })), PLAIN);
  assert.equal(many[8], "   [9]  Lhota 9");
  assert.equal(many[9], "  [10]  Lhota 10");
});

test("longer German texts wrap under their text at 60 columns, none over it", () => {
  const de = [
    { key: "1", label: "Sprache, Agent, Modell, was der Agent selbst darf, Geschichten… (Einrichtungsassistent)" },
    { key: "2", label: "Archive und Downloader: wie jedes Archiv erreicht wird, Bedingungen, Anmeldungen", value: "3 Archive" },
    { key: "0", label: "Zurück" },
  ];
  for (const l of optionLines(de, noColor(60)).join("\n").split("\n")) {
    assert.ok(shown(l) <= 60, l);
    if (!/\[\d\]/u.test(l) && l.trim()) assert.match(l, /^ {7}\S/u, l);
  }
});

test("decomposed text and other scripts: counted as shown, wrapped between words", () => {
  const nfd = "Lhoták z Lhoty".normalize("NFD");
  assert.equal(shown(nfd), 14);
  const opts = [{ key: "1", label: nfd, value: "2" }, { key: "2", label: "Лотак", value: "3" }, { key: "3", label: "ロータク家", value: "1" }];
  const lines = optionLines(opts, PLAIN);
  const col = (l: string, v: string) => shown(l.slice(0, l.lastIndexOf(v)));
  assert.equal(col(lines[0]!, "2"), col(lines[1]!, "3"));
  assert.equal(col(lines[1]!, "3"), col(lines[2]!, "1"));
  const greek = "Λοτάκ ".repeat(20).trim();
  for (const l of wrap([{ text: greek, role: "text" }], 60, 4).map(plain)) assert.ok(shown(l) <= 60);
});

test("a command is never broken and stands on a line of its own", () => {
  const cmd = "strom fixes show F12 --reread --pages 3-7 --from /Users/lhotak/Lhota/inputs/kniha-1890.pdf";
  const spans = [{ text: "Přečíst znovu: ", role: "text" as const }, { text: cmd, role: "command" as const }];
  const lines = wrap(spans, 60, 2).map(plain);
  assert.ok(lines.some((l) => l.includes(cmd)), lines.join("\n"));
  assert.equal(commandLine("strom fixes list", PLAIN), "    $ strom fixes list");
  assert.equal(line(spans, PLAIN), `Přečíst znovu: ${cmd}`);
});

test("commands a text names: strom and what the command takes, never the sentence after it", () => {
  const t = "Spustit strom fixes show F3 --reread a pak strom run. Jinak strom-beta guide.";
  const found = commandsIn(t).map(([s, e]) => t.slice(s, e));
  assert.deepEqual(found, ["strom fixes show F3 --reread", "strom run", "strom-beta guide"]);
  assert.deepEqual(commandsIn("Strom výzkum 1.37.0"), []);
  assert.deepEqual(commandsIn("strom Lhoták"), []);
  // coloured on a terminal, the text the same
  const c = decorate(t, tty(80));
  assert.match(c, new RegExp(`${ESC}\\[36mstrom fixes show F3 --reread${ESC}\\[0m`, "u"));
  assert.equal(decorate(t, noColor(80)), t);
  // JSON is never touched
  assert.equal(decorate('{"next":"strom run"}', tty(80)), '{"next":"strom run"}');
});

test("the crumbs and a short label: the way here; a label cut at its first aside, at most 40", () => {
  assert.equal(crumbLine(["Strom", "Nastavení", "Údržba"], PLAIN), "Strom › Nastavení › Údržba");
  assert.equal(shortLabel("Nastavení (na tomto počítači)"), "Nastavení");
  assert.equal(shortLabel("Archivy: stahovače · 3"), "Archivy");
  assert.equal(shortLabel("Pokračovat ve výzkumu s agentem Claude a nejlepším modelem", 24, true), "Pokračovat");
  const long = shortLabel("Stahovač Digitálního archivu Lhota a okolí pro knihy matrik narozených oddaných zemřelých", 40);
  assert.ok(shown(long) <= 40, long);
  assert.match(long, /…$/u);
});

test("a list: keys right, names in a column of at most 40, counts in one column with the headings' counts", () => {
  const parts = [
    {
      heading: { text: "Jen tady v terminálu", aside: "(v aplikaci Strom nejsou)", count: "12" },
      rows: [
        { key: "1", name: "Digitální archiv Lhota", count: "2", detail: "snímky 2" },
        { key: "10", name: "Matriční úřad Lhota", count: "10", detail: "dopis k odeslání" },
      ],
    },
    { heading: { text: "I v aplikaci Strom", count: "3" }, rows: [{ key: "11", name: "Rodina Lhotákových z Horní Lhoty a z Dolní Lhoty u Lhotic", count: "3" }] },
  ];
  const lines = listLines(parts, noColor(80));
  const countEnd = (l: string, count: string) => shown(l.slice(0, l.indexOf(` ${count}`, 8) + 1 + count.length));
  assert.equal(countEnd(lines[0]!, "12"), countEnd(lines[1]!, "2"));
  assert.equal(countEnd(lines[1]!, "2"), countEnd(lines[2]!, "10"));
  assert.match(lines[1]!, /^ {3}\[1\] {2}/u);
  assert.match(lines[2]!, /^ {2}\[10\] {2}/u);
  // the long name wrapped within its column, the rest under it
  const wrapped = lines.slice(lines.findIndex((l) => l.includes("[11]")));
  assert.ok(shown(wrapped[0]!.slice(7, wrapped[0]!.lastIndexOf("3")).trimEnd()) <= 40);
  assert.match(wrapped[1]!, /^ {8}\p{L}/u);
  // off a terminal: whole, its count after ·
  const flat = listLines(parts, PLAIN);
  assert.ok(flat.some((l) => l.includes("Rodina Lhotákových z Horní Lhoty a z Dolní Lhoty u Lhotic · 3")));
  for (const w of [60, 80, 100]) for (const l of listLines(parts, noColor(w))) assert.ok(shown(l) <= w, `${w}: ${l}`);
});

test("a long part of the crumbs cut between words with …, any script, decomposed text counted as shown", () => {
  assert.equal(crumbLine(["Strom", "Co čeká", "Matriční úřad Lhota nad Lhotkou u Horní Lhoty"], PLAIN), "Strom › Co čeká › Matriční úřad Lhota nad Lhotkou…");
  const nfd = crumbLine(["Strom", "Matriční úřad Lhota nad Lhotkou u Horní Lhoty".normalize("NFD")], PLAIN);
  assert.equal(nfd.normalize("NFC"), "Strom › Matriční úřad Lhota nad Lhotkou…");
  const cjk = crumbLine(["Strom", "日本語のテキストはとても長いのでここで切る必要がありますよね本当に長い名前です"], PLAIN).split(" › ")[1]!;
  assert.ok(shown(cjk) <= 32 && cjk.endsWith("…"), cjk);
});

test("Enter's prompt: the option's first word whole, without its comma, a short word first with the one after it", () => {
  assert.equal(shortLabel("Die Forschung mit dem Agenten fortsetzen", 24, true), "Die Forschung");
  assert.equal(shortLabel("Alles, Schritt für Schritt (die Einrichtung)", 24, true), "Alles");
  assert.equal(shortLabel("Ve výzkumu pokračovat s agentem a nejlepším modelem", 24, true), "Ve výzkumu");
  assert.equal(shortLabel("Ano (doporučeno)", 24, true), "Ano");
});

test("a command a sentence ends with on a line of its own ($ strom …); one in the middle of a sentence stays in it", () => {
  assert.deepEqual(saidLines("Vrátit, jak bylo: strom fixes undo F1", PLAIN), ["Vrátit, jak bylo:", "  $ strom fixes undo F1"]);
  assert.deepEqual(saidLines("Vyzkoušet: strom run. Pak dál.", PLAIN), ["Vyzkoušet:", "  $ strom run", "Pak dál."]);
  assert.deepEqual(saidLines("Jinak (strom fixes show new-model)", PLAIN, { indent: 2 }), ["  Jinak", "    $ strom fixes show new-model"]);
  assert.deepEqual(saidLines("strom fixes undo F1 zahodí jen to, co se zapsalo", PLAIN), ["strom fixes undo F1 zahodí jen to, co se zapsalo"]);
  // decomposed and another script before it: the same
  assert.deepEqual(
    saidLines("Знову прочитати: strom fixes run new-model".normalize("NFD"), PLAIN).map((l) => l.normalize("NFC")),
    ["Знову прочитати:", "  $ strom fixes run new-model"],
  );
  // wrapped on a terminal, the command never broken
  const wrapped = saidLines(`${"Dřívější čtení jiným modelem zůstalo otevřené ".repeat(3)}– přečíst znovu: strom fixes run new-model`, noColor(60)).join("\n").split("\n");
  for (const l of wrapped) assert.ok(shown(l) <= 60, l);
  assert.equal(wrapped.at(-1), "  $ strom fixes run new-model");
});

test("a list's detail never cut: wrapped under its own column on a terminal, whole off one", () => {
  const detail = "dopis k odeslání · Odpověď matriky na žádost o opis křestního zápisu Vojtěcha Lhotáka";
  const parts = [{ rows: [{ key: "1", name: "Matriční úřad Lhota nad Lhotkou u Horní Lhoty", count: "2", detail }] }];
  const lines = listLines(parts, noColor(80));
  for (const l of lines) assert.ok(shown(l) <= 80, l);
  const words = (t: string) => t.replace(/\s+/gu, " ").trim();
  const said = lines.map((l) => l.slice(50)).join(" ");
  assert.equal(words(said), words(detail));
  assert.ok(listLines(parts, PLAIN).some((l) => l.includes(detail)));
});

test("an item said as one text: its label, a state in the column of values, a list or a sentence after it", () => {
  assert.deepEqual(shaped("Čas na jeden úkol: 60 min", { as: "auto" }), { label: "Čas na jeden úkol", value: "60 min", extra: undefined });
  assert.deepEqual(shaped("Navrhovat linie: zapnuto (nic se nenavrhne, když agent pracuje)", { as: "auto" }), {
    label: "Navrhovat linie",
    value: "zapnuto",
    extra: "nic se nenavrhne, když agent pracuje",
  });
  const listed = shaped("Podklady: soubory, složky, texty, vzpomínky rodiny a fotografie", { as: "auto" });
  assert.equal(listed.value, undefined);
  assert.equal(listed.extra, "soubory, složky, texty, vzpomínky rodiny a fotografie");
  assert.deepEqual(shaped("Ano (doporučeno)", { as: "auto" }), { label: "Ano", value: undefined, extra: "doporučeno" });
});
