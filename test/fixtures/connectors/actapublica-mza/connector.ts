// A strom connector for ACTA PUBLICA, the parish registers of the Moravian Land Archives in Brno
// (https://www.mza.cz/actapublica) — interface 1 (strom's plugins/connectors/README.md).
//
// The archive lets an image be saved only by the standard means of a web browser, so this connector never asks the
// archive for anything itself: every page it reads comes through the person's own browser (browser.pages), planned
// and paced by strom, and the images are saved from the archive's own viewer in the person's tab
// (browser.viewer "openseadragon") — what the viewer shows, one after the other. `locate` names the book's page of each
// image (its page n of the viewer); it never gives the tiles or the image server's addresses.
// It reaches the portal only through get(): never with the fetch function or a network library.

import { book, done, fail, get, located, log, request } from "./sdk.ts";

const BASE = "https://www.mza.cz/actapublica/";
/** Result pages read at most for one search (20 books a page): each one is a page of the person's browser. */
const MAX_PAGES = 10;

const req = await request();

/** Plain text of an HTML fragment. */
function text(html: string): string {
  return html
    .replace(/<[^>]*>/gu, " ")
    .replace(/&nbsp;/gu, " ")
    .replace(/&quot;/gu, '"')
    .replace(/&#0?39;/gu, "'")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&amp;/gu, "&")
    .replace(/\s+/gu, " ")
    .trim()
    .normalize("NFC");
}

/** "1892 - 1925" → [1892, 1925]; " - " → undefined. */
function range(s: string): [number, number] | undefined {
  const m = /(\p{Nd}{3,4})\s*[-–]\s*(\p{Nd}{3,4})/u.exec(s);
  return m ? [Number(m[1]), Number(m[2])] : undefined;
}

/** The place names of a popover: <strong>Lhota</strong><br><strong>Dolní Lhota</strong> … */
function places(dataContent: string): string[] {
  const html = dataContent.replace(/&lt;/gu, "<").replace(/&gt;/gu, ">").replace(/&quot;/gu, '"');
  return [...html.matchAll(/<strong>([^<]+)<\/strong>/gu)].map((m) => text(m[1]!));
}

interface Ranges {
  births?: [number, number];
  marriages?: [number, number];
  deaths?: [number, number];
  indexes: ([number, number] | undefined)[];
}

function describe(r: Ranges): { kinds: string[]; years?: string; letters: string; span?: [number, number] } {
  const kinds: string[] = [];
  let letters = "";
  if (r.births) (kinds.push("baptism"), (letters += "N"));
  if (r.marriages) (kinds.push("marriage"), (letters += "O"));
  if (r.deaths) (kinds.push("burial"), (letters += "Z"));
  if (r.indexes.some(Boolean)) (kinds.push("index"), (letters += letters ? " I" : "I"));
  const all = [r.births, r.marriages, r.deaths, ...r.indexes].filter((x): x is [number, number] => !!x);
  if (!all.length) return { kinds, letters };
  const span: [number, number] = [Math.min(...all.map((a) => a[0])), Math.max(...all.map((a) => a[1]))];
  return { kinds, letters, span, years: `${span[0]}-${span[1]}` };
}

function title(creator: string, number: string, d: { letters: string; span?: [number, number] }): string {
  return [creator, number, d.letters, d.span ? `${d.span[0]}–${d.span[1]}` : ""].filter(Boolean).join(" ");
}

/** The viewer's images, as the book's page sets it up: CreateSeadragon([tile sources], [image names], [statuses], …). */
function viewerImages(html: string): { names: string[]; statuses: number[] } | undefined {
  const m = /CreateSeadragon\(\s*(\[[\s\S]*?\])\s*,\s*(\[[\s\S]*?\])\s*,\s*(\[[\s\S]*?\])/u.exec(html);
  if (!m) return undefined;
  try {
    const names = JSON.parse(m[2]!) as unknown[];
    const statuses = JSON.parse(m[3]!) as unknown[];
    return { names: names.map(String), statuses: statuses.map((s) => Number(s) || 0) };
  } catch {
    return undefined;
  }
}

async function detail(id: string) {
  if (!/^\p{Nd}+$/u.test(id)) fail(`"${id}" is not a book of ACTA PUBLICA: use the number of its page matrika/detail/<id>`);
  const url = `${BASE}matrika/detail/${id}`;
  const page = await get(url);
  if (page.status !== 200 || !page.text) fail(`book ${id}: HTTP ${page.status} for ${url}`);
  const html = page.text!;
  const head = (label: string) => new RegExp(`${label}</span>\\s*<br>\\s*<span[^>]*>([^<]*)</span>`, "u").exec(html)?.[1]?.trim() ?? "";
  const number = text(head("Číslo knihy"));
  const creator = text(head("Původce"));
  if (!number) fail(`book ${id}: no register on ${url}`);
  const value = (label: string) => range(new RegExp(`${label}:\\s*<span[^>]*>([^<]*)</span>`, "u").exec(html)?.[1] ?? "");
  const r: Ranges = {
    births: value("Narození"),
    marriages: value("Oddaní"),
    deaths: value("Zemřelí"),
    indexes: [value("Index narození"), value("Index oddaní"), value("Index zemřelí")],
  };
  const obce = /title="Obce"[^>]*data-content="([^"]*)"/u.exec(html)?.[1] ?? "";
  return { url, html, number, creator, ranges: r, places: places(obce), images: viewerImages(html) };
}

interface Found {
  id: string;
  number: string;
  creator: string;
  desc: ReturnType<typeof describe>;
  places: string[];
  images?: number;
}

/** Every book of a result list (search by place or by creator), page by page. */
async function results(first: string, what: string): Promise<Found[]> {
  const found: Found[] = [];
  let url: string | undefined = first;
  for (let p = 1; url && p <= MAX_PAGES; p++) {
    const page = await get(url);
    if (page.status !== 200 || !page.text) fail(`${what}: HTTP ${page.status}`);
    const html = page.text!;
    const body = /<tbody>([\s\S]*?)<\/tbody>/u.exec(html)?.[1] ?? "";
    for (const row of body.split(/<tr[^>]*>/u).slice(1)) {
      const id = /matrika\/detail\/(\p{Nd}+)/u.exec(row)?.[1];
      const tds = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gu)].map((m) => m[1]!);
      if (!id || tds.length < 7) continue;
      const cell = (td: string) => {
        const [main = "", rest = ""] = td.split(/<br\s*\/?>/u);
        return { main: range(text(main)), index: range(text(rest)) };
      };
      const [b, m, d] = [cell(tds[2]!), cell(tds[3]!), cell(tds[4]!)];
      found.push({
        id,
        number: text(tds[0]!),
        creator: text(tds[1]!.split(/<br\s*\/?>/u)[0]!),
        desc: describe({ births: b.main, marriages: m.main, deaths: d.main, indexes: [b.index, m.index, d.index] }),
        places: places(/data-content="([^"]*)"/u.exec(tds[5]!)?.[1] ?? ""),
        images: Number(text(tds[6]!)) || undefined,
      });
    }
    const next = new RegExp(`href="([^"]*[?&](?:amp;)?page=${p + 1})"`, "u").exec(html)?.[1];
    url = next ? new URL(next.replace(/&amp;/gu, "&"), first).href : undefined;
  }
  if (url) log(`${what}: more than ${MAX_PAGES * 20} books — only the first ${MAX_PAGES * 20} were read; narrow it (--years)`);
  return found;
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("cs").trim();

if (req.cmd === "find") {
  const want = req.years ? range(req.years) : undefined;
  // 1. The books whose list of places names the place.
  const books = new Map<string, Found>();
  for (const f of await results(`${BASE}matrika/hledani_obec?typ=obec&search_by_obec=${encodeURIComponent(req.place.normalize("NFC"))}`, `search for ${req.place}`)) books.set(f.id, f);
  const byPlace = books.size;
  // 2. All books of a parish (creator) of that name: some of them list only its other villages.
  const parishes = new Map<string, string>(); // creator → one of its books
  for (const f of books.values()) if (fold(f.creator) === fold(req.place) && !parishes.has(f.creator)) parishes.set(f.creator, f.id);
  for (const [creator, someBook] of parishes) {
    const page = await get(`${BASE}matrika/detail/${someBook}`);
    const pid = /hledani_puvodce\?puvodce_id=(\p{Nd}+)/u.exec(page.text ?? "")?.[1];
    if (!pid) continue;
    for (const f of await results(`${BASE}matrika/hledani_puvodce?puvodce_id=${pid}`, `books of ${creator}`)) books.set(f.id, f);
  }
  let shown = 0;
  for (const f of books.values()) {
    if (want && f.desc.span && (f.desc.span[1] < want[0] || f.desc.span[0] > want[1])) continue;
    shown++;
    book({ id: f.id, title: title(f.creator, f.number, f.desc), callNumber: f.number, years: f.desc.years, kinds: f.desc.kinds, places: f.places, url: `${BASE}matrika/detail/${f.id}`, images: f.images });
  }
  const more = books.size - byPlace;
  log(`${byPlace} books name "${req.place}"` + (more ? `, ${more} more belong to the parish ${[...parishes.keys()].join(", ")}` : "") + (want ? `; ${shown} cover ${req.years}` : ""));
} else if (req.cmd === "list") {
  const d = await detail(req.book);
  const desc = describe(d.ranges);
  if (!d.images) log(`book ${req.book}: the viewer shows no images`);
  const hidden = d.images ? d.images.statuses.filter((s) => s > 0).length : 0;
  if (hidden) log(`${hidden} images of this book are not public`);
  book({ id: req.book, title: title(d.creator, d.number, desc), callNumber: d.number, years: desc.years, kinds: desc.kinds, places: d.places, url: d.url, images: d.images?.names.length });
} else if (req.cmd === "locate") {
  // the book's page says which images it has; each is its page n of the viewer there, saved as the viewer shows it
  const d = await detail(req.book);
  const v = d.images;
  if (!v || !v.names.length) fail(`book ${req.book}: the viewer shows no images on ${d.url}`);
  for (const n of req.images) {
    if (n < 1 || n > v!.names.length) fail(`book ${req.book} has ${v!.names.length} images, not ${n}`);
    if ((v!.statuses[n - 1] ?? 0) > 0) fail(`image ${n} of book ${req.book} is not public`);
    const page = `${d.url}?image=${encodeURIComponent(v!.names[n - 1]!)}`;
    located(n, page, page, undefined, req.region);
  }
} else fail(`${req.cmd}: this connector only finds books, describes them and says where their images are — the images come from the archive's viewer in the person's browser`);
done();
