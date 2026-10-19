// The pages of a PDF of scans, without a program: a scanner (or a phone's scanning app) puts each page as one JPEG
// that covers it, and that JPEG is the page — read here from the file as it is (zlib for compressed object streams,
// nothing else). A page with anything more (two pictures, a drawing of its own, a picture placed turned) is not
// taken: such a PDF is drawn by the system (core/readable.ts) or said not readable here.

import zlib from "node:zlib";

type Value = number | boolean | null | string | Name | Ref | Value[] | Dict;
interface Name {
  name: string;
}
interface Ref {
  ref: number;
}
interface Dict {
  dict: Map<string, Value>;
}

interface Obj {
  value: Value;
  /** Where its stream begins (after "stream" and its end of line), when it has one. */
  stream?: number;
}

const isName = (v: Value | undefined): v is Name => !!v && typeof v === "object" && "name" in v;
const isRef = (v: Value | undefined): v is Ref => !!v && typeof v === "object" && "ref" in v;
const isDict = (v: Value | undefined): v is Dict => !!v && typeof v === "object" && "dict" in v;

const WHITE = new Set([0x00, 0x09, 0x0a, 0x0c, 0x0d, 0x20]);
const DELIM = new Set([0x28, 0x29, 0x3c, 0x3e, 0x5b, 0x5d, 0x7b, 0x7d, 0x2f, 0x25]);

/** A reader of PDF values from bytes (the syntax only: numbers, names, strings, arrays, dictionaries, references). */
class Parser {
  readonly b: Uint8Array;
  p: number;

  constructor(b: Uint8Array, p: number) {
    this.b = b;
    this.p = p;
  }

  private skip(): void {
    for (;;) {
      while (this.p < this.b.length && WHITE.has(this.b[this.p]!)) this.p++;
      if (this.b[this.p] !== 0x25) return; // %: a comment to the end of the line
      while (this.p < this.b.length && this.b[this.p] !== 0x0a && this.b[this.p] !== 0x0d) this.p++;
    }
  }

  private word(): string {
    const start = this.p;
    while (this.p < this.b.length && !WHITE.has(this.b[this.p]!) && !DELIM.has(this.b[this.p]!)) this.p++;
    return Buffer.from(this.b.subarray(start, this.p)).toString("latin1");
  }

  value(depth = 0): Value {
    if (depth > 64) throw new Error("nested too deep");
    this.skip();
    const c = this.b[this.p];
    if (c === undefined) throw new Error("ends early");
    if (c === 0x2f) {
      this.p++;
      return { name: this.word() };
    }
    if (c === 0x3c && this.b[this.p + 1] === 0x3c) {
      this.p += 2;
      const dict = new Map<string, Value>();
      for (;;) {
        this.skip();
        if (this.b[this.p] === 0x3e && this.b[this.p + 1] === 0x3e) {
          this.p += 2;
          return { dict };
        }
        const key = this.value(depth + 1);
        if (!isName(key)) throw new Error("a key that is no name");
        dict.set(key.name, this.value(depth + 1));
      }
    }
    if (c === 0x3c) {
      const end = this.b.indexOf(0x3e, this.p);
      if (end < 0) throw new Error("ends early");
      this.p = end + 1;
      return "";
    }
    if (c === 0x28) {
      // a string: only stepped over (nothing here reads one)
      let level = 0;
      for (; this.p < this.b.length; this.p++) {
        const ch = this.b[this.p];
        if (ch === 0x5c) this.p++;
        else if (ch === 0x28) level++;
        else if (ch === 0x29 && --level === 0) {
          this.p++;
          return "";
        }
      }
      throw new Error("ends early");
    }
    if (c === 0x5b) {
      this.p++;
      const out: Value[] = [];
      for (;;) {
        this.skip();
        if (this.b[this.p] === 0x5d) {
          this.p++;
          return out;
        }
        out.push(this.value(depth + 1));
      }
    }
    const w = this.word();
    if (!w) throw new Error(`unexpected byte ${c}`);
    if (w === "true" || w === "false") return w === "true";
    if (w === "null") return null;
    const n = Number(w);
    if (!Number.isFinite(n)) return w;
    // "12 0 R": a reference
    if (Number.isInteger(n) && n >= 0) {
      const back = this.p;
      this.skip();
      const g = this.word();
      if (/^\d+$/.test(g)) {
        this.skip();
        if (this.b[this.p] === 0x52 && (this.p + 1 >= this.b.length || WHITE.has(this.b[this.p + 1]!) || DELIM.has(this.b[this.p + 1]!))) {
          this.p++;
          return { ref: n };
        }
      }
      this.p = back;
    }
    return n;
  }
}

/** Every object of the file by its number: written directly, or in a compressed object stream (the later one wins). */
function objects(b: Uint8Array): Map<number, Obj> {
  const text = Buffer.from(b.buffer, b.byteOffset, b.byteLength).toString("latin1");
  const out = new Map<number, Obj>();
  const found = /(?:^|[\s>\]])(\d+)\s+(\d+)\s+obj\b/g;
  for (let m = found.exec(text); m; m = found.exec(text)) {
    try {
      const p = new Parser(b, m.index + m[0].length);
      const value = p.value();
      const o: Obj = { value };
      const after = /^\s*stream(\r\n|\n|\r)/.exec(text.slice(p.p, p.p + 32));
      if (after) o.stream = p.p + after[0].length;
      out.set(Number(m[1]), o);
      found.lastIndex = Math.max(found.lastIndex, p.p);
    } catch {
      // not an object after all (a number in a stream): go on
    }
  }
  // object streams (PDF 1.5): the objects packed in them, unless written directly
  for (const o of [...out.values()]) {
    const d = isDict(o.value) ? o.value.dict : undefined;
    if (!d || o.stream === undefined || !isName(d.get("Type")) || (d.get("Type") as Name).name !== "ObjStm") continue;
    const data = streamData(b, out, o);
    if (!data) continue;
    const n = Number(resolve(out, d.get("N")));
    const first = Number(resolve(out, d.get("First")));
    if (!Number.isInteger(n) || !Number.isInteger(first)) continue;
    try {
      const head = new Parser(data, 0);
      const pairs: [number, number][] = [];
      for (let i = 0; i < n; i++) pairs.push([Number(head.value()), Number(head.value())]);
      for (const [num, off] of pairs) if (!out.has(num)) out.set(num, { value: new Parser(data, first + off).value() });
    } catch {
      // a broken object stream: what came of it stays
    }
  }
  return out;
}

function resolve(objs: Map<number, Obj>, v: Value | undefined, depth = 0): Value | undefined {
  while (isRef(v) && depth++ < 32) v = objs.get(v.ref)?.value;
  return v;
}

/** The bytes of an object's stream as written (its /Length, else up to "endstream"); decompressed when it is Flate. */
function rawStream(b: Uint8Array, objs: Map<number, Obj>, o: Obj): Uint8Array | undefined {
  if (o.stream === undefined || !isDict(o.value)) return undefined;
  const len = resolve(objs, o.value.dict.get("Length"));
  if (typeof len === "number" && len > 0 && o.stream + len <= b.length) {
    const tail = Buffer.from(b.subarray(o.stream + len, o.stream + len + 16)).toString("latin1");
    if (/^\s*endstream/.test(tail)) return b.subarray(o.stream, o.stream + len);
  }
  const end = Buffer.from(b.buffer, b.byteOffset, b.byteLength).indexOf("endstream", o.stream, "latin1");
  if (end < 0) return undefined;
  let e = end;
  if (b[e - 1] === 0x0a) e--;
  if (b[e - 1] === 0x0d) e--;
  return b.subarray(o.stream, e);
}

function filters(objs: Map<number, Obj>, d: Map<string, Value>): string[] {
  const f = resolve(objs, d.get("Filter"));
  const list = Array.isArray(f) ? f.map((x) => resolve(objs, x)) : f === undefined ? [] : [f];
  return list.map((x) => (isName(x) ? x.name : "?"));
}

function streamData(b: Uint8Array, objs: Map<number, Obj>, o: Obj): Uint8Array | undefined {
  const raw = rawStream(b, objs, o);
  if (!raw || !isDict(o.value)) return undefined;
  const f = filters(objs, o.value.dict);
  if (!f.length) return raw;
  if (f.length === 1 && f[0] === "FlateDecode" && !o.value.dict.get("DecodeParms")) {
    try {
      return new Uint8Array(zlib.inflateSync(raw));
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export interface PdfScans {
  /** How many pages the PDF has. */
  pages: number;
  /** Each page's JPEG as it covers the page (index 0 = page 1); undefined where the page is more than one JPEG. */
  jpegs: (Uint8Array | undefined)[];
  /** How far each page is turned when shown (its /Rotate: 0, 90, 180 or 270, clockwise). */
  rotate: number[];
}

/**
 * The pages of a PDF and, for each, the one JPEG it consists of when it is a scan; undefined when the file cannot be
 * read so (encrypted, broken, no pages found).
 */
export function pdfScans(b: Uint8Array): PdfScans | undefined {
  let objs: Map<number, Obj>;
  try {
    objs = objects(b);
  } catch {
    return undefined;
  }
  const text = Buffer.from(b.buffer, b.byteOffset, b.byteLength).toString("latin1");
  if (/\/Encrypt\s/.test(text)) return undefined;
  // the catalog: the last /Root said (an update written after the first version wins)
  const roots = [...text.matchAll(/\/Root\s+(\d+)\s+\d+\s+R/g)];
  let catalog = roots.length ? resolve(objs, { ref: Number(roots[roots.length - 1]![1]) }) : undefined;
  if (!isDict(catalog)) catalog = [...objs.values()].map((o) => o.value).find((v) => isDict(v) && isName(v.dict.get("Type")) && (v.dict.get("Type") as Name).name === "Catalog");
  if (!isDict(catalog)) return undefined;
  const pages: { page: Map<string, Value>; resources: Value | undefined; rotate: number; box: Value | undefined }[] = [];
  const seen = new Set<Value>();
  const walk = (node: Value | undefined, inherited: { resources: Value | undefined; rotate: number; box: Value | undefined }, depth: number) => {
    const n = resolve(objs, node);
    if (!isDict(n) || seen.has(n) || depth > 64 || pages.length > 100_000) return;
    seen.add(n);
    const d = n.dict;
    const here = {
      resources: d.has("Resources") ? d.get("Resources") : inherited.resources,
      rotate: d.has("Rotate") ? Number(resolve(objs, d.get("Rotate"))) || 0 : inherited.rotate,
      box: d.has("MediaBox") ? d.get("MediaBox") : inherited.box,
    };
    const kids = resolve(objs, d.get("Kids"));
    if (Array.isArray(kids)) for (const k of kids) walk(k, here, depth + 1);
    else pages.push({ page: d, ...here });
  };
  walk(catalog.dict.get("Pages"), { resources: undefined, rotate: 0, box: undefined }, 0);
  if (!pages.length) return undefined;
  const jpegs = pages.map((p) => pageJpeg(b, objs, p.page, p.resources, p.box, p.rotate));
  return { pages: pages.length, jpegs, rotate: pages.map((p) => (((p.rotate % 360) + 360) % 360) as number) };
}

/** The one JPEG a page consists of: one picture, DCT alone, as big as the page (as it lies, before /Rotate). */
function pageJpeg(b: Uint8Array, objs: Map<number, Obj>, page: Map<string, Value>, resources: Value | undefined, box: Value | undefined, rotate: number): Uint8Array | undefined {
  if (![0, 90, 180, 270].includes(((rotate % 360) + 360) % 360)) return undefined;
  const res = resolve(objs, resources);
  if (!isDict(res)) return undefined;
  const xo = resolve(objs, res.dict.get("XObject"));
  if (!isDict(xo) || xo.dict.size !== 1) return undefined;
  const ref = [...xo.dict.values()][0];
  const o = isRef(ref) ? objs.get(ref.ref) : undefined;
  if (!o || !isDict(o.value)) return undefined;
  const d = o.value.dict;
  const sub = resolve(objs, d.get("Subtype"));
  if (!isName(sub) || sub.name !== "Image") return undefined;
  const f = filters(objs, d);
  if (f.length !== 1 || f[0] !== "DCTDecode" || d.has("Decode") || d.has("SMask") || d.has("Mask")) return undefined;
  // as big as the page: the same proportions (a picture placed turned, or on part of the page, is drawn by the system)
  const w = Number(resolve(objs, d.get("Width")));
  const h = Number(resolve(objs, d.get("Height")));
  const mb = resolve(objs, box);
  if (!Array.isArray(mb) || mb.length !== 4 || !(w > 0 && h > 0)) return undefined;
  const [x0, y0, x1, y1] = mb.map((v) => Number(resolve(objs, v)));
  const pw = Math.abs(x1! - x0!);
  const ph = Math.abs(y1! - y0!);
  if (!(pw > 0 && ph > 0) || Math.abs(w / h / (pw / ph) - 1) > 0.03) return undefined;
  if (!drawnWhole(b, objs, page, pw, ph)) return undefined;
  const jpeg = rawStream(b, objs, o);
  if (!jpeg || jpeg[0] !== 0xff || jpeg[1] !== 0xd8) return undefined;
  return jpeg;
}

/**
 * Whether the page's content draws its picture over the whole page, upright: the matrices (cm) before the picture
 * (Do) together scale the unit square to the page's width and height, neither turned nor slanted.
 */
function drawnWhole(b: Uint8Array, objs: Map<number, Obj>, page: Map<string, Value>, pw: number, ph: number): boolean {
  const c = resolve(objs, page.get("Contents"));
  const parts = Array.isArray(c) ? c : [page.get("Contents")];
  let text = "";
  for (const part of parts) {
    const o = isRef(part) ? objs.get(part.ref) : undefined;
    const data = o ? streamData(b, objs, o) : undefined;
    if (!data) return false;
    text += Buffer.from(data).toString("latin1") + "\n";
  }
  const at = text.search(/\/[^\s/<>\[\]()]+\s+Do\b/);
  if (at < 0) return false;
  // a b c d e f: each later matrix applies first (m' = m × current)
  let m = [1, 0, 0, 1, 0, 0];
  const num = "([-+]?(?:\\d+\\.?\\d*|\\.\\d+))";
  for (const x of text.slice(0, at).matchAll(new RegExp(`${Array(6).fill(num).join("\\s+")}\\s+cm\\b`, "g"))) {
    const [a, b2, c2, d, e, f] = x.slice(1).map(Number) as [number, number, number, number, number, number];
    m = [a * m[0]! + b2 * m[2]!, a * m[1]! + b2 * m[3]!, c2 * m[0]! + d * m[2]!, c2 * m[1]! + d * m[3]!, e * m[0]! + f * m[2]! + m[4]!, e * m[1]! + f * m[3]! + m[5]!];
  }
  const near = (v: number, want: number) => Math.abs(v - want) <= want * 0.03;
  return near(Math.abs(m[0]!), pw) && near(Math.abs(m[3]!), ph) && Math.abs(m[1]!) < pw * 0.01 && Math.abs(m[2]!) < ph * 0.01 && m[0]! > 0 && m[3]! > 0;
}
