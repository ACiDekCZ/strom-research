// The page an event of history stands on, read by strom itself: the quoted words found on it in any script and accent,
// its year in them; only a page of text, https, not too large, its robots.txt kept to; read once, then from its copy.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { checkQuote, checkQuotes, findPassages, htmlText, mainQuote, pageParts, PageError, quoteProblem, quotesProblem, readPage, PAGE_MAX_BYTES, PART_CHARS } from "../../src/core/pagecheck.ts";

const PAGE = `<!doctype html><html lang="cs-CZ"><head><title>Kronika &ndash; Lhota</title><style>p { color: red } /* 1777 */</style>
<script>document.write("V roce 1777 vyhořela Lhota")</script></head><body>
<!-- V roce 1888 nic -->
<template><p>Roku 1999 šablona</p></template>
<p>V&nbsp;roce 1866 zasáhla Lho&shy;tu epidemie cholery &ndash; zemřelo 42&nbsp;obyvatel&#46;</p>
<p>&bdquo;Velký po&zcaron;&aacute;r&ldquo; roku 1842 zni&#x10D;il p&#367;l vsi.</p>
<p>В 1866 году в Лхоте была холера.</p>
<p>In den Jahren 1914–1918 fielen dreißig Männer.</p>
</body></html>`;

async function server(): Promise<{ base: string; hits: Record<string, number>; close: () => void }> {
  const hits: Record<string, number> = {};
  const s = http.createServer((req, res) => {
    const p = req.url ?? "/";
    hits[p] = (hits[p] ?? 0) + 1;
    if (p === "/robots.txt") return res.writeHead(200, { "content-type": "text/plain" }).end("User-agent: *\nDisallow: /hidden\n");
    if (p === "/page") return res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(PAGE);
    if (p === "/latin2") return res.writeHead(200, { "content-type": "text/html" }).end(Buffer.concat([Buffer.from('<meta charset="iso-8859-2"><p>Roku 1866 '), Buffer.from([0xb9, 0x6b, 0x6f, 0x6c, 0x61]), Buffer.from("</p>")]));
    if (p === "/plain") return res.writeHead(200, { "content-type": "text/plain; charset=utf-8" }).end("Sčítání lidu 1921: <b>312</b> obyvatel");
    if (p === "/forbidden") return res.writeHead(403).end();
    if (p === "/pdf") return res.writeHead(200, { "content-type": "application/pdf" }).end("%PDF 1866");
    // a news site's page that sends to a consent page of another site
    if (p === "/away") return res.writeHead(302, { location: `http://localhost:${(s.address() as AddressInfo).port}/consent` }).end();
    if (p === "/big") return res.writeHead(200, { "content-type": "text/html" }).end(Buffer.alloc(PAGE_MAX_BYTES + 10, 0x20));
    return res.writeHead(404).end();
  });
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
  s.unref();
  return { base: `http://127.0.0.1:${(s.address() as AddressInfo).port}`, hits, close: () => s.close() };
}

const ENV = { STROM_TEST_HOSTS: "1" };
const shared = () => fs.mkdtempSync(path.join(os.tmpdir(), "strom page ěš "));
const sleeps: number[] = [];
const o = { sleep: async (ms: number) => void sleeps.push(ms) };

test("pagecheck: the page's text — no scripts, styles, comments, templates; entities, soft hyphens; its title and language", () => {
  const p = htmlText(PAGE);
  assert.equal(p.title, "Kronika – Lhota");
  assert.equal(p.lang, "cs-cz");
  assert.match(p.text, /V roce 1866 zasáhla Lhotu epidemie cholery – zemřelo 42 obyvatel\./);
  assert.match(p.text, /„Velký požár“ roku 1842 zničil půl vsi\./);
  for (const gone of ["1777", "1888", "1999", "color"]) assert.ok(!p.text.includes(gone), gone);
});

test("pagecheck: the quote found in any accent, decomposed, another script, its parts in order; the year in it", () => {
  const text = htmlText(PAGE).text;
  const y = { from: 1866, to: 1866 };
  assert.equal(quoteProblem(text, "V roce 1866 zasáhla Lhotu epidemie cholery - zemřelo 42 obyvatel.", y), undefined, "a hyphen for the dash");
  assert.equal(quoteProblem(text, "V roce 1866 zasáhla Lhotu epidemie cholery".normalize("NFD"), y), undefined, "decomposed");
  assert.equal(quoteProblem(text, "v roce 1866   ZASÁHLA lhotu", y), undefined, "case and spaces");
  assert.equal(quoteProblem(text, "В 1866 году в Лхоте была холера.", y), undefined, "Cyrillic");
  assert.equal(quoteProblem(text, "V roce 1866 … zemřelo 42 obyvatel", y), undefined, "a part left out");
  assert.equal(quoteProblem(text, '"Velký požár" roku 1842', { from: 1842, to: 1842 }), undefined, "straight quotes for „“");
  assert.equal(quoteProblem(text, "In den Jahren 1914-1918 fielen", { from: 1914, to: 1918 }), undefined);
  assert.match(quoteProblem(text, "In den Jahren 1914 fielen", { from: 1914, to: 1918 })!, /year 1918/);
  assert.match(quoteProblem(text, "zemřelo 42 obyvatel … V roce 1866", y)!, /not on the page/, "parts out of order");
  assert.match(quoteProblem(text, "V roce 18660 zasáhla", y)!, /year 1866/, "a year only as a year");
  assert.match(quoteProblem(text, "Roku 1866 vyhořela Lhota", y)!, /not on the page/);
  assert.match(quoteProblem(text, `1866 ${"x".repeat(300)}`, y)!, /at most 300/);
});

test("pagecheck: read politely and kept — a second check asks nothing; robots.txt, a refusal, a PDF, a page too large: no page", async () => {
  const srv = await server();
  const sh = shared();
  try {
    const c = await checkQuote(`${srv.base}/page`, "V roce 1866 zasáhla Lhotu", { from: 1866, to: 1866 }, sh, ENV, o);
    assert.equal(c.page.title, "Kronika – Lhota");
    assert.match(c.checked, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(c.page.sha, /^[0-9a-f]{64}$/);
    await checkQuote(`${srv.base}/page`, "В 1866 году", { from: 1866, to: 1866 }, sh, ENV, o);
    assert.equal(srv.hits["/page"], 1, "the copy of 30 days");
    assert.equal(srv.hits["/robots.txt"], 1);
    assert.equal(fs.readdirSync(path.join(sh, "history", "pages")).filter((f) => f.endsWith(".txt.gz")).length, 1);
    // the year not in the quote: not even asked
    await assert.rejects(checkQuote(`${srv.base}/plain`, "Sčítání lidu", { from: 1921, to: 1921 }, sh, ENV, o), /does not say the year 1921/);
    assert.equal(srv.hits["/plain"], undefined);
    // the words not on the page: a quote's error, no page's
    await assert.rejects(checkQuote(`${srv.base}/page`, "V roce 1866 přišla povodeň", { from: 1866, to: 1866 }, sh, ENV, o), (e: Error) => !(e instanceof PageError) && /not on the page/.test(e.message));
    // plain text is text as it is; another charset by its meta
    assert.equal((await readPage(`${srv.base}/plain`, sh, ENV, o)).text, "Sčítání lidu 1921: <b>312</b> obyvatel");
    assert.match((await readPage(`${srv.base}/latin2`, sh, ENV, o)).text, /Roku 1866 škola/);
    const no = async (p: string, why: RegExp) => assert.rejects(readPage(`${srv.base}${p}`, sh, ENV, o), (e: Error) => e instanceof PageError && why.test(e.why));
    await no("/hidden", /robots\.txt/);
    assert.equal(srv.hits["/hidden"], undefined, "never asked");
    await no("/pdf", /not a page of text \(application\/pdf\)/);
    await no("/big", /larger than 5 MB/);
    await no("/missing", /HTTP 404/);
    await no("/away", /sends to another site \(localhost: a consent or login page as a rule\)/);
    await no("/forbidden", /refused/);
    // https only; plain http only to this computer in a test
    await assert.rejects(readPage("http://example.org/", sh, ENV, o), (e: Error) => e instanceof PageError && /only https/.test(e.why));
    await assert.rejects(readPage(`${srv.base}/page?x`, sh, {}, o), (e: Error) => e instanceof PageError && /only https/.test(e.why));
  } finally {
    srv.close();
    fs.rmSync(sh, { recursive: true, force: true });
  }
});

test("pagecheck: a period on two quotes of one page — the year it began in one, the year it ended in another; the app's quote the first", async () => {
  const text = htmlText(`<p>Roku 1939 vznikl protektorát.</p><p>Okupace trvala šest let.</p><p>Skončil v květnu 1945 osvobozením.</p>`).text;
  const y = { from: 1939, to: 1945 };
  assert.match(quoteProblem(text, "Roku 1939 vznikl protektorát.", y)!, /does not say the year 1945 — add a second --quote with the year 1945 .*or give the period the page says/);
  assert.equal(quotesProblem(text, ["Roku 1939 vznikl protektorát.", "Skončil v květnu 1945"], y), undefined);
  assert.equal(quotesProblem(text, ["Skončil v květnu 1945", "Roku 1939 vznikl".normalize("NFD")], y), undefined, "in any order, decomposed");
  assert.match(quotesProblem(text, ["Roku 1939 vznikl protektorát.", "Skončil v říjnu 1945"], y)!, /^quote 2: these words are not on the page/);
  assert.match(quotesProblem(text, ["Okupace trvala", "Skončil v květnu 1945"], y)!, /no quote says the year 1939/);
  assert.match(quotesProblem(text, ["Roku 1939 vznikl", `1945 ${"x".repeat(300)}`], y)!, /quote 2 is 305 characters — at most 300/);
  assert.equal(mainQuote(["Skončil v květnu 1945", " Roku  1939 vznikl "], 1939), "Roku 1939 vznikl", "the one with the year it began, cleaned");
});

test("pagecheck: the page in parts and the passages with the words looked for — any case and accent, decomposed, another script, across sentences", () => {
  const filler = Array.from({ length: 400 }, (_, i) => `Věta číslo ${i} o ničem.`).join(" ");
  const text = htmlText(`<p>${filler}</p><p>Pozemková reforma začala v dubnu 1919 záborem velkostatků. Skončila roku 1935.</p><p>В 1866 году была холера.</p><p>${filler}</p>`).text;
  const parts = pageParts(text);
  assert.ok(parts.length > 2);
  assert.ok(parts.every((p) => p.text.length <= PART_CHARS));
  assert.equal(parts.map((p) => p.text).join(" "), text, "nothing lost between parts");
  assert.ok(parts.slice(0, -1).every((p) => p.text.endsWith(".")), "a part ends at a sentence's end");
  const one = findPassages(text, ["pozemkova REFORMA"]);
  assert.equal(one.passages.length, 1);
  assert.match(one.passages[0]!.text, /Pozemková reforma začala v dubnu 1919 záborem velkostatků\. Skončila roku 1935\./);
  assert.ok(text.includes(one.passages[0]!.text), "the page's own words");
  assert.equal(one.passages[0]!.part, parts.findLastIndex((p) => p.at <= one.passages[0]!.at) + 1);
  assert.equal(findPassages(text, ["Pozemková reforma".normalize("NFD")]).passages.length, 1, "decomposed");
  assert.match(findPassages(text, ["холера"]).passages[0]!.text, /В 1866 году была холера\./);
  assert.match(findPassages(text, ["velkostatků. Skončila"]).passages[0]!.text, /Skončila roku 1935/, "across two sentences");
  assert.match(findPassages(text, ["reforma 1919"]).passages[0]!.text, /Pozemková reforma/, "all its words, the phrase nowhere");
  assert.equal(findPassages(text, ["mor 1680"]).passages.length, 0);
  const many = findPassages(text, ["ničem"], 5);
  assert.equal(many.passages.length, 5);
  assert.ok(many.more > 0);
});

test("pagecheck: several quotes checked on one read of the page", async () => {
  const srv = await server();
  const sh = shared();
  try {
    await assert.rejects(checkQuotes(`${srv.base}/page`, ["In den Jahren 1914"], { from: 1914, to: 1918 }, sh, ENV, o), /add a second --quote with the year 1918/);
    assert.equal(srv.hits["/page"], undefined, "not even asked");
    const c = await checkQuotes(`${srv.base}/page`, ["In den Jahren 1914", "1914–1918 fielen dreißig Männer"], { from: 1914, to: 1918 }, sh, ENV, o);
    assert.match(c.page.sha, /^[0-9a-f]{64}$/);
    await assert.rejects(checkQuotes(`${srv.base}/page`, ["In den Jahren 1914", "1918 fielen vierzig"], { from: 1914, to: 1918 }, sh, ENV, o), (e: Error & { hint?: string }) => /quote 2: these words are not on the page/.test(e.message) && /strom history page .*--find/.test(e.hint ?? ""));
    assert.equal(srv.hits["/page"], 1);
  } finally {
    srv.close();
    fs.rmSync(sh, { recursive: true, force: true });
  }
});
