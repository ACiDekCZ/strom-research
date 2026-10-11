// Lines of a file read piece by piece, never the whole file in memory: an agent's log of a long session runs to
// hundreds of MB (one was 692 MB — more than a string can hold) and strom runs on computers with little memory. A
// line is kept only up to a limit: a longer one (an image in a log) is skipped whole and counted, never kept.

import fs from "node:fs";
import zlib from "node:zlib";

/** How much is read at a time. */
export const LINE_CHUNK = 1 << 20;
/** The longest line kept; a longer one is skipped (counted in `long`). */
export const LINE_MAX = 8 << 20;
/** A compressed log (strom tidy's .log.gz) is unpacked at most to this size; a bigger one is not read. */
export const GZ_MAX = 128 << 20;

export interface LineOptions {
  /** Bytes read at a time (tests: small). */
  chunk?: number;
  /** The longest line kept, in bytes. */
  maxLine?: number;
  /** Looked at before a line becomes text: false — the line is left out (cheap for lines nobody needs). */
  filter?: (line: Buffer) => boolean;
}

export interface LineStats {
  lines: number;
  /** Lines longer than maxLine: skipped. */
  long: number;
  /** The most bytes of one line held at once (for the tests of the bound). */
  held: number;
}

/**
 * Each line from `read` (fills the buffer, returns how many bytes; 0 at the end), in order. Memory: one piece and at
 * most one line of maxLine. An error of `read` is thrown (the caller says the file was not read).
 */
export function eachLineOf(read: (buf: Buffer) => number, fn: (line: string) => void, o: LineOptions = {}): LineStats {
  const chunk = Math.max(1, o.chunk ?? LINE_CHUNK);
  const max = Math.max(1, o.maxLine ?? LINE_MAX);
  const buf = Buffer.alloc(chunk);
  const st: LineStats = { lines: 0, long: 0, held: 0 };
  let parts: Buffer[] = [];
  let len = 0;
  let dropping = false;
  const emit = (line: Buffer) => {
    st.lines++;
    if (o.filter && !o.filter(line)) return;
    const s = line.toString("utf8").trim();
    if (s) fn(s);
  };
  for (;;) {
    const n = read(buf);
    if (!(n > 0)) break;
    const view = buf.subarray(0, n);
    let start = 0;
    for (;;) {
      const nl = view.indexOf(0x0a, start);
      const piece = view.subarray(start, nl === -1 ? n : nl);
      if (nl === -1) {
        // the line goes on in the next piece: kept only while it stays within the limit
        if (!dropping) {
          if (len + piece.length > max) {
            dropping = true;
            parts = [];
            len = 0;
          } else if (piece.length) {
            parts.push(Buffer.from(piece));
            len += piece.length;
            st.held = Math.max(st.held, len);
          }
        }
        break;
      }
      if (dropping || len + piece.length > max) {
        st.lines++;
        st.long++;
      } else {
        st.held = Math.max(st.held, len + piece.length);
        emit(parts.length ? Buffer.concat([...parts, piece]) : piece);
      }
      dropping = false;
      parts = [];
      len = 0;
      start = nl + 1;
    }
  }
  if (dropping) {
    st.lines++;
    st.long++;
  } else if (len) emit(Buffer.concat(parts));
  return st;
}

/** Each line of a file (see eachLineOf). Throws when it cannot be opened or read. */
export function eachFileLine(file: string, fn: (line: string) => void, o: LineOptions = {}): LineStats {
  const fd = fs.openSync(file, "r");
  try {
    return eachLineOf((b) => fs.readSync(fd, b, 0, b.length, null), fn, o);
  } finally {
    fs.closeSync(fd);
  }
}

/** Each line of a compressed file (.gz), unpacked to at most GZ_MAX (a bigger one throws: not read). */
export function eachGzipLine(file: string, fn: (line: string) => void, o: LineOptions & { maxBytes?: number } = {}): LineStats {
  const data = zlib.gunzipSync(fs.readFileSync(file), { maxOutputLength: o.maxBytes ?? GZ_MAX });
  let at = 0;
  return eachLineOf(
    (b) => {
      const n = Math.min(b.length, data.length - at);
      data.copy(b, 0, at, at + n);
      at += n;
      return n;
    },
    fn,
    o,
  );
}
