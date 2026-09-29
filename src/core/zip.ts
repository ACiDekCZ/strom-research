// ZIP files without a dependency: written as they go (deflated where it helps,
// images stored as they are), read by their central directory. No ZIP64: a
// package over 4 GB or 65 535 files is refused. Names are UTF-8.

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { StromError } from "./errors.ts";

const LOCAL = 0x04034b50;
const CENTRAL = 0x02014b50;
const END = 0x06054b50;
const MAX = 0xffffffff;
/** Already compressed: deflating them again only costs time. */
const PACKED = /\.(jpe?g|png|gif|webp|tiff?|jp2|zip|gz|pdf|mp4|mov|mp3|heic)$/i;

export class ZipTooLarge extends StromError {}

interface Written {
  name: Buffer;
  crc: number;
  size: number;
  csize: number;
  method: number;
  offset: number;
  time: number;
  date: number;
  mode: number;
}

function dos(d: Date): { time: number; date: number } {
  const y = Math.max(1980, d.getFullYear());
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((y - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

export class ZipWriter {
  private fd: number;
  private offset = 0;
  private entries: Written[] = [];
  readonly file: string;

  constructor(file: string) {
    this.file = file;
    this.fd = fs.openSync(file, "w");
  }

  get bytes(): number {
    return this.offset;
  }

  private write(b: Buffer): void {
    fs.writeSync(this.fd, b);
    this.offset += b.length;
  }

  /** One file; `name` with forward slashes. */
  add(name: string, data: Buffer, opts: { mode?: number; mtime?: Date } = {}): void {
    let body = data;
    let method = 0;
    if (!PACKED.test(name) && !name.endsWith("/") && data.length > 64) {
      const z = zlib.deflateRawSync(data);
      if (z.length < data.length) {
        body = z;
        method = 8;
      }
    }
    const n = Buffer.from(name, "utf8");
    if (this.entries.length >= 0xffff || this.offset + 30 + n.length + body.length + 46 * (this.entries.length + 1) > MAX)
      throw new ZipTooLarge("the package would be over 4 GB or 65 535 files");
    const e: Written = { name: n, crc: zlib.crc32(data), size: data.length, csize: body.length, method, offset: this.offset, ...dos(opts.mtime ?? new Date()), mode: opts.mode ?? (name.endsWith("/") ? 0o755 : 0o644) };
    const h = Buffer.alloc(30);
    h.writeUInt32LE(LOCAL, 0);
    h.writeUInt16LE(20, 4);
    h.writeUInt16LE(0x0800, 6); // names in UTF-8
    h.writeUInt16LE(method, 8);
    h.writeUInt16LE(e.time, 10);
    h.writeUInt16LE(e.date, 12);
    h.writeUInt32LE(e.crc, 14);
    h.writeUInt32LE(e.csize, 18);
    h.writeUInt32LE(e.size, 22);
    h.writeUInt16LE(n.length, 26);
    h.writeUInt16LE(0, 28);
    this.write(h);
    this.write(n);
    this.write(body);
    this.entries.push(e);
  }

  /** An empty folder (git needs its empty ones). */
  addDir(name: string): void {
    this.add(name.endsWith("/") ? name : `${name}/`, Buffer.alloc(0));
  }

  /** A file from disk, its mode and time kept. */
  addFile(name: string, file: string): void {
    const st = fs.statSync(file);
    this.add(name, fs.readFileSync(file), { mode: st.mode & 0o777, mtime: st.mtime });
  }

  close(): void {
    const start = this.offset;
    for (const e of this.entries) {
      const c = Buffer.alloc(46);
      c.writeUInt32LE(CENTRAL, 0);
      c.writeUInt16LE((3 << 8) | 20, 4); // made on Unix: the mode is kept
      c.writeUInt16LE(20, 6);
      c.writeUInt16LE(0x0800, 8);
      c.writeUInt16LE(e.method, 10);
      c.writeUInt16LE(e.time, 12);
      c.writeUInt16LE(e.date, 14);
      c.writeUInt32LE(e.crc, 16);
      c.writeUInt32LE(e.csize, 20);
      c.writeUInt32LE(e.size, 24);
      c.writeUInt16LE(e.name.length, 28);
      const dir = e.name[e.name.length - 1] === 0x2f;
      c.writeUInt32LE((((dir ? 0o040000 : 0o100000) | e.mode) << 16 | (dir ? 0x10 : 0)) >>> 0, 38);
      c.writeUInt32LE(e.offset, 42);
      this.write(c);
      this.write(e.name);
    }
    const end = Buffer.alloc(22);
    end.writeUInt32LE(END, 0);
    end.writeUInt16LE(this.entries.length, 8);
    end.writeUInt16LE(this.entries.length, 10);
    end.writeUInt32LE(this.offset - start, 12);
    end.writeUInt32LE(start, 16);
    this.write(end);
    fs.closeSync(this.fd);
  }

  /** Give up: the half-written file goes. */
  abort(): void {
    try {
      fs.closeSync(this.fd);
    } catch {
      // closed already
    }
    fs.rmSync(this.file, { force: true });
  }
}

export interface ZipEntry {
  /** Forward slashes, checked: relative, no "..". */
  name: string;
  size: number;
  csize: number;
  method: number;
  crc: number;
  offset: number;
  dir: boolean;
  link: boolean;
}

export class BadZip extends StromError {}

/** A name a package may carry: relative, inside it, no drive, no "..". Undefined for anything else. */
export function safeEntryName(raw: string): string | undefined {
  const name = raw.replace(/\\/g, "/");
  if (!name || name.startsWith("/") || /^[A-Za-z]:/.test(name) || name.includes("\0")) return undefined;
  const parts = name.split("/").filter((p) => p !== "" && p !== ".");
  if (parts.some((p) => p === "..")) return undefined;
  return parts.join("/") + (name.endsWith("/") ? "/" : "");
}

/** The entries of a ZIP file (what a system's own "compress" makes too). Unsafe names: BadZip. */
export function readZip(file: string): ZipEntry[] {
  const fd = fs.openSync(file, "r");
  try {
    const size = fs.fstatSync(fd).size;
    const tail = Buffer.alloc(Math.min(size, 22 + 0xffff));
    fs.readSync(fd, tail, 0, tail.length, size - tail.length);
    let at = -1;
    for (let i = tail.length - 22; i >= 0; i--)
      if (tail.readUInt32LE(i) === END) {
        at = i;
        break;
      }
    if (at < 0) throw new BadZip("not a ZIP file");
    const count = tail.readUInt16LE(at + 10);
    const cdSize = tail.readUInt32LE(at + 12);
    const cdStart = tail.readUInt32LE(at + 16);
    if (cdStart === MAX || count === 0xffff) throw new BadZip("a ZIP64 file (over 4 GB) — unpack it with the system and give the folder");
    const cd = Buffer.alloc(cdSize);
    fs.readSync(fd, cd, 0, cdSize, cdStart);
    const out: ZipEntry[] = [];
    let p = 0;
    for (let i = 0; i < count; i++) {
      if (cd.readUInt32LE(p) !== CENTRAL) throw new BadZip("a damaged ZIP file");
      const flags = cd.readUInt16LE(p + 8);
      const nameLen = cd.readUInt16LE(p + 28);
      const extraLen = cd.readUInt16LE(p + 30);
      const commentLen = cd.readUInt16LE(p + 32);
      const raw = cd.subarray(p + 46, p + 46 + nameLen);
      const rawName = flags & 0x0800 ? raw.toString("utf8") : raw.toString("latin1");
      const name = safeEntryName(rawName);
      if (name === undefined) throw new BadZip(`a file outside the package: ${rawName}`);
      const attr = cd.readUInt32LE(p + 38) >>> 16;
      out.push({
        name,
        method: cd.readUInt16LE(p + 10),
        crc: cd.readUInt32LE(p + 16),
        csize: cd.readUInt32LE(p + 20),
        size: cd.readUInt32LE(p + 24),
        offset: cd.readUInt32LE(p + 42),
        dir: name.endsWith("/"),
        link: (attr & 0o170000) === 0o120000,
      });
      p += 46 + nameLen + extraLen + commentLen;
    }
    return out;
  } finally {
    fs.closeSync(fd);
  }
}

/** The content of one entry, its checksum checked. */
export function readEntry(file: string, e: ZipEntry): Buffer {
  const fd = fs.openSync(file, "r");
  try {
    const h = Buffer.alloc(30);
    fs.readSync(fd, h, 0, 30, e.offset);
    if (h.readUInt32LE(0) !== LOCAL) throw new BadZip(`a damaged ZIP file (${e.name})`);
    const start = e.offset + 30 + h.readUInt16LE(26) + h.readUInt16LE(28);
    const body = Buffer.alloc(e.csize);
    fs.readSync(fd, body, 0, e.csize, start);
    const data = e.method === 0 ? body : e.method === 8 ? zlib.inflateRawSync(body) : undefined;
    if (!data) throw new BadZip(`${e.name}: a compression strom does not read (${e.method})`);
    if (data.length !== e.size || zlib.crc32(data) !== e.crc) throw new BadZip(`${e.name} is damaged in the ZIP file`);
    return data;
  } finally {
    fs.closeSync(fd);
  }
}

/** Unpack into a folder (which must not hold the names already). Links and the system's own litter are left out. */
export function unzipTo(file: string, dir: string, entries = readZip(file)): string[] {
  const written: string[] = [];
  for (const e of entries) {
    if (e.link || e.name.startsWith("__MACOSX/") || path.posix.basename(e.name) === ".DS_Store") continue;
    const to = path.join(dir, ...e.name.split("/").filter(Boolean));
    if (e.dir) {
      fs.mkdirSync(to, { recursive: true });
      continue;
    }
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.writeFileSync(to, readEntry(file, e));
    written.push(e.name);
  }
  return written;
}
