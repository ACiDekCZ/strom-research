// A strom connector for __TITLE__ (__URL__) — interface 1 (../README.md).
// strom runs it (strom fetch, strom connector test); it reaches the portal
// only through get() and post() — never with fetch() or a network library.
// Read DISCOVERY.md first: what the portal allows decides what this may do.

import { book, done, fail, get, image, log, request } from "./sdk.ts";

const req = await request();

if (req.cmd === "find") {
  // The books that cover a place (and years): the portal's catalogue search.
  // TODO: get (or post, for a search form) the catalogue for req.place, read it, and for each book:
  // book({ id: "…", title: "…", callNumber: "…", years: "1784-1820", kinds: ["baptism"], places: ["…"], url: "…", images: 70 });
  log(`find ${req.place} ${req.years ?? ""}: not written yet`);
} else if (req.cmd === "list") {
  // One book: its title and number of images, from the portal's page for req.book.
  log(`list ${req.book}: not written yet`);
} else if (req.cmd === "fetch") {
  // The images asked for, one by one, in order — one request per image where the portal allows it.
  for (const n of req.images) {
    // TODO: the URL of image n of book req.book — the portal's own full-image link, or IIIF.
    const url = `__URL__/${encodeURIComponent(req.book)}/${n}`;
    const file = `s${String(n).padStart(4, "0")}.jpg`;
    const got = await get(url, { save: file });
    if (got.status !== 200) fail(`image ${n}: HTTP ${got.status}`);
    image(n, file, url);
  }
} else if (req.cmd === "part") {
  // Only with "part" in connector.json → can: a part of one image, sharper than the whole image
  // (IIIF: the region of the original; one request). req.region is in fractions of the whole image.
  fail("part: not written yet");
} else if (req.cmd === "locate") {
  // Only with "locate" in can and "browser" in routes: where the images are, for the user's browser
  // to fetch — the same address fetch would ask for (a part: req.region), nothing downloaded here.
  // located(n, url, "<the page a person opens>");
  fail("locate: not written yet");
}
done();
