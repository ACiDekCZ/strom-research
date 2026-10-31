// The page of a scan in the online archive for the Strom app: only an address a person may open, never made up.

import { test } from "node:test";
import assert from "node:assert/strict";
import { excerptPage, publicPage, sourcePage } from "../../src/core/scanlink.ts";
import type { Media, Source } from "../../src/core/model.ts";

const src = (o: Partial<Source>): Source => ({ id: "S0001", type: "source", kind: "baptism", title: "Křest", information: "primary", form: "original", notes: [], ...o }) as unknown as Source;
const img = (id: string, url?: string): Media => ({ id, type: "media", sha: "0", file: "x", mime: "image/jpeg", size: 1, notes: [], ...(url ? { url } : {}) }) as unknown as Media;

test("publicPage: http(s) on a site's name only", () => {
  for (const ok of ["https://archive.example.org/book/1/40", "http://digi.example.cz/d/12/3?x=1#p", " https://archive.example.org/ "])
    assert.equal(publicPage(ok), ok.trim(), ok);
  for (const no of [undefined, "", "javascript:alert(1)", "file:///C:/scan.jpg", "data:image/jpeg;base64,AA", "ftp://archive.example.org/x", "https://user:pass@archive.example.org/x", "http://localhost:4000/scan", "http://127.0.0.1/scan", "http://192.168.1.5/scan", "http://[::1]/scan", "http://nas/scan", "http://nas.local/scan", "http://scans.home.arpa/x", "archive.example.org/book"])
    assert.equal(publicPage(no), undefined, String(no));
});

test("excerptPage: the image's page; the source's own where it goes on from it, the source on that image alone", () => {
  const book = "https://archive.example.org/book/1";
  assert.equal(excerptPage(book, src({})), book);
  assert.equal(excerptPage(book, src({ url: `${book}/40`, clips: [{ media: "M1", region: { x: 0, y: 0, w: 1, h: 1 } }] })), `${book}/40`, "more exactly the same page");
  assert.equal(excerptPage(book, src({ url: `${book}?image=40`, media: ["M1"] })), `${book}?image=40`);
  assert.equal(excerptPage(`${book}/40`, src({ url: book, media: ["M1"] })), `${book}/40`, "the book is less than the page");
  assert.equal(excerptPage(`${book}/40`, src({ url: `${book}/41`, media: ["M1"] })), `${book}/40`, "another page: the image's");
  assert.equal(excerptPage(book, src({ url: `${book}/40`, media: ["M1", "M2"] })), book, "on two images: the source's page is one of them");
  assert.equal(excerptPage(book, src({ url: "https://other.example.org/book/1/40", media: ["M1"] })), book, "another site");
  assert.equal(excerptPage(undefined, src({ url: `${book}/40`, media: ["M1"] })), undefined, "no page of its own: the source's WWW serves");
  assert.equal(excerptPage("javascript:alert(1)", src({})), undefined);
});

test("sourcePage: the page of its first image with one, else its own address — never a recordset's", () => {
  const all = new Map([["M1", img("M1")], ["M2", img("M2", "https://archive.example.org/book/1/7")]]);
  const get = (id: string) => all.get(id);
  assert.equal(sourcePage(src({ clips: [{ media: "M1", region: { x: 0, y: 0, w: 1, h: 1 } }], media: ["M2"] }), get), "https://archive.example.org/book/1/7");
  assert.equal(sourcePage(src({ media: ["M1"], url: "https://news.example.org/1890/4" }), get), "https://news.example.org/1890/4");
  assert.equal(sourcePage(src({ recordset: "B1" }), get), undefined);
  assert.equal(sourcePage(src({ url: "file:///C:/Users/x/scan.pdf" }), get), undefined);
});
