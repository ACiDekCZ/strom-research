// `strom doc`: "How Strom works" carried with strom — the contents, a rule by its number, a search; in the research's
// language (else the person's; one it is not written in: English, said so); outside a research too; never writes.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World } from "../helpers.ts";

const PIN = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "..", "..", "package.json"), "utf8")).stromDoc as string;

test("outside a research: the contents, a rule, a chapter, in the person's language, nothing written", async () => {
  const w = new World();
  const before = fs.readdirSync(w.dir).sort();
  // the contents: the parts with their chapters, how to go on, the web
  const contents = await w.ok(["doc"], { env: { STROM_LANG: "cs" } });
  assert.match(contents.out, /^Jak Strom funguje · strom-doc [0-9a-f]{7}\n/u, contents.out);
  assert.match(contents.out, /^ {2}R2 +\S/mu);
  assert.match(contents.out, /^ {2}A1 +\S/mu);
  assert.match(contents.out, /strom doc R2\.3/u);
  assert.match(contents.out, /\nhttps:\/\/stromapp\.info\/doc\/cs\/\n?$/u);
  const json = (await w.ok(["doc", "--json"], { env: { STROM_LANG: "cs" } })).json;
  assert.equal(json.lang, "cs");
  assert.equal(json.pin, PIN);
  assert.equal(json.fallback, undefined);
  assert.deepEqual(
    json.parts.map((p: { part: string }) => p.part),
    ["R", "A", "S"],
  );
  assert.deepEqual(json.parts[0].chapters[1], { number: "R2", title: json.parts[0].chapters[1].title, url: "https://stromapp.info/doc/cs/R2/" });

  // a rule as typed (r2-3 = R2.3): its title, text, the rules under it, its link
  const rule = await w.ok(["doc", "r2-3"], { env: { STROM_LANG: "de" } });
  assert.match(rule.out, /^R2\.3 \S/u, rule.out);
  assert.match(rule.out, /^ {2}R2\.3\.1 +\S/mu);
  assert.match(rule.out, /\nhttps:\/\/stromapp\.info\/doc\/de\/R2\/#R2\.3\n?$/u);
  const r = (await w.ok(["doc", "R2.3", "--json"], { env: { STROM_LANG: "de" } })).json;
  assert.deepEqual(Object.keys(r).sort(), ["chapter", "lang", "number", "pin", "rules", "text", "title", "url"]);
  assert.equal(r.number, "R2.3");
  assert.equal(r.chapter, "R2");
  assert.ok(r.text.length > 20);
  assert.equal(r.url, "https://stromapp.info/doc/de/R2/#R2.3");
  assert.ok(r.rules.some((x: { number: string }) => x.number === "R2.3.1"));
  // a chapter: its rules, its page
  const chapter = (await w.ok(["doc", "R2", "--json"], { env: { STROM_LANG: "en" } })).json;
  assert.equal(chapter.url, "https://stromapp.info/doc/en/R2/");
  assert.ok(chapter.rules.every((x: { number: string; url: string }) => x.number.startsWith("R2.") && x.url.startsWith("https://stromapp.info/doc/en/R2/#")));
  assert.deepEqual(fs.readdirSync(w.dir).sort(), before, "nothing written: no research, no settings");
  w.cleanup();
});

test("a rule's why comes with it in its language", async () => {
  const w = new World();
  for (const [lang, label] of [["cs", "Proč"], ["en", "Why"], ["de", "Warum"], ["pl", "Dlaczego"]] as const) {
    // the first rule of the contents' order that has a why
    let found = "";
    for (const n of ["R2.1", "R2.2", "R2.3", "R4.1", "R5.1", "R10.1", "R10.3"]) {
      const r = (await w.ok(["doc", n, "--json", "--lang", lang])).json;
      if (r.why) {
        found = n;
        assert.ok(r.why.length > 5, `${lang} ${n}`);
        assert.match((await w.ok(["doc", n, "--lang", lang])).out, new RegExp(`${label}:`, "u"), `${lang} ${n}`);
        break;
      }
    }
    assert.ok(found, `${lang}: a rule with a why`);
  }
  w.cleanup();
});

test("a search: any accent, NFD as NFC, best first, the rest counted; nothing found is no error", async () => {
  const w = new World();
  const cs = { env: { STROM_LANG: "cs" } };
  const nfc = (await w.ok(["doc", "pořadí", "linií", "--json"], cs)).json;
  assert.equal(nfc.query, "pořadí linií");
  assert.ok(nfc.total >= 1);
  assert.equal(nfc.results[0].number, "R2.1.4", JSON.stringify(nfc.results));
  assert.match(nfc.results[0].url, /^https:\/\/stromapp\.info\/doc\/cs\/R2\/#R2\.1\.4$/u);
  const nfd = (await w.ok(["doc", "pořadí linií".normalize("NFD"), "--json"], cs)).json;
  assert.deepEqual(nfd.results, nfc.results, "NFD");
  assert.deepEqual((await w.ok(["doc", "PORADI", "LINII", "--json"], cs)).json.results, nfc.results, "no accents, upper case");
  // many found: ten shown, the rest counted with how to see them
  const many = await w.ok(["doc", "linie"], cs);
  const all = (await w.ok(["doc", "linie", "--json", "--limit", "500"], cs)).json;
  assert.ok(all.total > 10, `${all.total}`);
  assert.equal(all.results.length, all.total);
  assert.equal((await w.ok(["doc", "linie", "--json"], cs)).json.results.length, 10);
  assert.match(many.out, new RegExp(`^A dalších ${all.total - 10}: strom doc linie --limit ${all.total}$`, "mu"), many.out);
  // another script, nothing found
  const none = await w.ok(["doc", "Ярослав"], { env: { STROM_LANG: "pl" } });
  assert.match(none.out, /^Dla „Ярослав” nic nie znaleziono/u, none.out);
  assert.equal((await w.ok(["doc", "Ярослав", "--json"])).json.total, 0);
  const bad = await w.run(["doc", "linie", "--limit", "0"]);
  assert.equal(bad.code, 2);
  w.cleanup();
});

test("a number the documentation does not have: exit 2 with the nearest", async () => {
  const w = new World();
  const r = await w.run(["doc", "R2.9"], { env: { STROM_LANG: "en" } });
  assert.equal(r.code, 2);
  assert.match(r.out + r.err, /no R2\.9 in How Strom works .*near: R2, R2\.1/u, r.err);
  assert.match(r.out + r.err, /strom doc R2/u);
  const j = await w.run(["doc", "R99", "--json"]);
  assert.equal(j.code, 2);
  w.cleanup();
});

test("an unknown number and a wrong --limit: the person reads them in the research's language, an agent in English", async () => {
  const w = new World();
  const cs = await w.run(["doc", "R2.9"], { env: { STROM_LANG: "cs" } });
  assert.equal(cs.code, 2);
  assert.match(cs.err, /^chyba: R2\.9 v Jak Strom funguje není \(strom-doc [0-9a-f]{7}\) – nejblíž: R2, R2\.1/u, cs.err);
  assert.match(cs.err, /\n→ strom doc R2 · obsah: strom doc\n/u, cs.err);
  const de = await w.run(["doc", "R2.9"], { env: { STROM_LANG: "de" } });
  assert.match(de.err, /^Fehler: R2\.9 gibt es in Wie Strom funktioniert nicht/u, de.err);
  const pl = await w.run(["doc", "R2.9"], { env: { STROM_LANG: "pl" } });
  assert.match(pl.err, /^błąd: R2\.9 nie ma w Jak działa Strom/u, pl.err);
  const limit = await w.run(["doc", "linie", "--limit", "0"], { env: { STROM_LANG: "cs" } });
  assert.equal(limit.code, 2);
  assert.match(limit.err, /^chyba: --limit je celé číslo od 1 – „0“ jím není\n$/u, limit.err);
  // an agent: the English, as every command says it to an agent
  const agent = await w.run(["doc", "R2.9"], { env: { STROM_LANG: "cs", CLAUDECODE: "1" } });
  assert.equal(agent.code, 2);
  assert.match(agent.err, /^error: no R2\.9 in How Strom works \(strom-doc [0-9a-f]{7}\) — near: R2, R2\.1/u, agent.err);
  const agentLimit = await w.run(["doc", "linie", "--limit", "0"], { env: { STROM_LANG: "cs", CLAUDECODE: "1" } });
  assert.match(agentLimit.err, /^error: --limit must be a positive number\n/u, agentLimit.err);
  // a program: the code and its params
  const j = await w.run(["doc", "R2.9", "--json"], { env: { STROM_LANG: "cs" } });
  assert.match(j.out + j.err, /"code": ?"doc\.unknown"/u);
  w.cleanup();
});

test("the language: --lang over the research's, the research's over the person's; one it is not written in is English, said so", async () => {
  const w = new World();
  const tree = await w.withTree("Lhotákovi");
  const config = path.join(tree, "strom.json");
  fs.writeFileSync(config, JSON.stringify({ ...JSON.parse(fs.readFileSync(config, "utf8")), lang: "de" }, null, 2));
  assert.equal((await w.ok(["doc", "--json"], { env: { LANG: "pl_PL.UTF-8" } })).json.lang, "de", "the research's");
  assert.equal((await w.ok(["doc", "--json", "--lang", "pl"])).json.lang, "pl", "--lang");
  assert.match((await w.ok(["doc", "R2"])).out, /^R2 \S/u);
  // Slovak: English, and a line saying so
  const sk = await w.ok(["doc", "R2", "--lang", "sk"]);
  assert.match(sk.out, /^R2 \S.*\n.*not written in /u, sk.out);
  assert.match(sk.out, /https:\/\/stromapp\.info\/doc\/en\/R2\//u);
  const skj = (await w.ok(["doc", "--json", "--lang", "sk"])).json;
  assert.equal(skj.lang, "en");
  assert.equal(skj.fallback, "sk");
  w.cleanup();
});

test("a person's help ends with how Strom works, in each language", async () => {
  const w = new World();
  for (const [lang, line] of [
    ["en", "How Strom works: strom doc · stromapp.info/doc/en/"],
    ["cs", "Jak Strom funguje: strom doc · stromapp.info/doc/cs/"],
    ["de", "Wie Strom funktioniert: strom doc · stromapp.info/doc/de/"],
    ["pl", "Jak działa Strom: strom doc · stromapp.info/doc/pl/"],
  ] as const) {
    const own = (await w.ok(["help", "--human"], { tty: true, env: { STROM_LANG: lang } })).out;
    assert.equal(own.trimEnd().split("\n").at(-1), line, `${lang}:\n${own}`);
  }
  // a language strom has no catalog of: the English line, the English documentation
  assert.equal((await w.ok(["help", "--human"], { tty: true, env: { STROM_LANG: "sk" } })).out.trimEnd().split("\n").at(-1), "How Strom works: strom doc · stromapp.info/doc/en/");
  w.cleanup();
});

test("the agent's instructions point to the documentation for the person's questions", async () => {
  const w = new World();
  const tree = await w.withTree("Lhotákovi");
  const agents = fs.readFileSync(path.join(tree, "AGENTS.md"), "utf8");
  assert.match(agents, /answer from `strom doc`/u);
  assert.match(agents, /name the rule's number and give the link `strom doc` prints with it/u);
  w.cleanup();
});
