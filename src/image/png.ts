// PNG decoder and encoder over node:zlib: every colour type and bit depth,
// interlaced or not, transparency flattened onto white (a document on paper).

import zlib from "node:zlib";
import type { RawImage } from "./image.ts";

export class PngError extends Error {}

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Undo the per-row filters of one (sub)image in place; returns the raw rows. */
function unfilter(data: Uint8Array, start: number, width: number, height: number, bpp: number, bitsPerPixel: number): { rows: Uint8Array; used: number } {
  const stride = Math.ceil((width * bitsPerPixel) / 8);
  const rows = new Uint8Array(stride * height);
  let p = start;
  for (let y = 0; y < height; y++) {
    const type = data[p++]!;
    const row = y * stride;
    const prev = row - stride;
    for (let x = 0; x < stride; x++) {
      const raw = data[p++]!;
      const a = x >= bpp ? rows[row + x - bpp]! : 0;
      const b = y > 0 ? rows[prev + x]! : 0;
      const c = y > 0 && x >= bpp ? rows[prev + x - bpp]! : 0;
      let v: number;
      switch (type) {
        case 0:
          v = raw;
          break;
        case 1:
          v = raw + a;
          break;
        case 2:
          v = raw + b;
          break;
        case 3:
          v = raw + ((a + b) >> 1);
          break;
        case 4:
          v = raw + paeth(a, b, c);
          break;
        default:
          throw new PngError(`unknown PNG filter ${type}`);
      }
      rows[row + x] = v & 0xff;
    }
  }
  return { rows, used: p - start };
}

export function decodePng(bytes: Uint8Array): RawImage {
  for (let i = 0; i < 8; i++) if (bytes[i] !== SIGNATURE[i]) throw new PngError("not a PNG file");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 8;
  let width = 0;
  let height = 0;
  let depth = 8;
  let colour = 0;
  let interlace = 0;
  let palette: Uint8Array | undefined;
  let trns: Uint8Array | undefined;
  const idat: Uint8Array[] = [];
  while (pos + 8 <= bytes.length) {
    const len = view.getUint32(pos);
    const type = String.fromCharCode(...bytes.subarray(pos + 4, pos + 8));
    const body = bytes.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = view.getUint32(pos + 8);
      height = view.getUint32(pos + 12);
      depth = body[8]!;
      colour = body[9]!;
      interlace = body[12]!;
    } else if (type === "PLTE") palette = body;
    else if (type === "tRNS") trns = body;
    else if (type === "IDAT") idat.push(body);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  if (!width || !height) throw new PngError("PNG without IHDR");
  const samples = colour === 0 ? 1 : colour === 2 ? 3 : colour === 3 ? 1 : colour === 4 ? 2 : colour === 6 ? 4 : 0;
  if (!samples) throw new PngError(`unknown PNG colour type ${colour}`);
  const bitsPerPixel = samples * depth;
  const bpp = Math.max(1, bitsPerPixel >> 3);
  const inflated = new Uint8Array(zlib.inflateSync(Buffer.concat(idat)));

  const grey = colour === 0 || colour === 4;
  const out: RawImage = { width, height, channels: grey ? 1 : 3, data: new Uint8Array(width * height * (grey ? 1 : 3)) };
  const maxv = (1 << depth) - 1;
  const read = (rows: Uint8Array, stride: number, x: number, y: number, s: number): number => {
    if (depth === 8) return rows[y * stride + x * samples + s]!;
    if (depth === 16) {
      const p = y * stride + (x * samples + s) * 2;
      return rows[p]!; // high byte
    }
    const bit = (x * samples + s) * depth;
    const byte = rows[y * stride + (bit >> 3)]!;
    return (byte >> (8 - depth - (bit & 7))) & maxv;
  };
  const scale = (v: number) => (depth === 8 || depth === 16 ? v : Math.round((v * 255) / maxv));
  const place = (rows: Uint8Array, w: number, h: number, x0: number, y0: number, dx: number, dy: number) => {
    const stride = Math.ceil((w * bitsPerPixel) / 8);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const tx = x0 + x * dx;
        const ty = y0 + y * dy;
        const o = (ty * width + tx) * out.channels;
        let r: number;
        let g: number;
        let b: number;
        let alpha = 255;
        if (colour === 3) {
          const idx = read(rows, stride, x, y, 0);
          r = palette?.[idx * 3] ?? 0;
          g = palette?.[idx * 3 + 1] ?? 0;
          b = palette?.[idx * 3 + 2] ?? 0;
          if (trns && idx < trns.length) alpha = trns[idx]!;
        } else if (grey) {
          r = g = b = scale(read(rows, stride, x, y, 0));
          if (colour === 4) alpha = scale(read(rows, stride, x, y, 1));
        } else {
          r = scale(read(rows, stride, x, y, 0));
          g = scale(read(rows, stride, x, y, 1));
          b = scale(read(rows, stride, x, y, 2));
          if (colour === 6) alpha = scale(read(rows, stride, x, y, 3));
        }
        // flatten transparency onto white paper
        const f = (v: number) => Math.round((v * alpha + 255 * (255 - alpha)) / 255);
        if (out.channels === 1) out.data[o] = f(r);
        else {
          out.data[o] = f(r);
          out.data[o + 1] = f(g);
          out.data[o + 2] = f(b);
        }
      }
  };
  if (interlace === 0) {
    place(unfilter(inflated, 0, width, height, bpp, bitsPerPixel).rows, width, height, 0, 0, 1, 1);
  } else {
    // Adam7: seven passes, each a small filtered image
    const passes = [
      [0, 0, 8, 8],
      [4, 0, 8, 8],
      [0, 4, 4, 8],
      [2, 0, 4, 4],
      [0, 2, 2, 4],
      [1, 0, 2, 2],
      [0, 1, 1, 2],
    ] as const;
    let p = 0;
    for (const [x0, y0, dx, dy] of passes) {
      const w = Math.ceil((width - x0) / dx);
      const h = Math.ceil((height - y0) / dy);
      if (w <= 0 || h <= 0) continue;
      const { rows, used } = unfilter(inflated, p, w, h, bpp, bitsPerPixel);
      place(rows, w, h, x0, y0, dx, dy);
      p += used;
    }
  }
  return out;
}

function chunk(type: string, body: Uint8Array): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(type, 4, "latin1");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
  return Buffer.concat([head, body, crc]);
}

/** Encode 8-bit grey or RGB; each row gets the filter that compresses it best (minimum sum). */
export function encodePng(img: RawImage): Uint8Array {
  const { width, height, channels } = img;
  const stride = width * channels;
  const raw = new Uint8Array((stride + 1) * height);
  const candidate = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const row = y * stride;
    let best = 0;
    let bestSum = Infinity;
    let bestRow = new Uint8Array(stride);
    for (let type = 0; type <= 4; type++) {
      let sum = 0;
      for (let x = 0; x < stride; x++) {
        const v = img.data[row + x]!;
        const a = x >= channels ? img.data[row + x - channels]! : 0;
        const b = y > 0 ? img.data[row - stride + x]! : 0;
        const c = y > 0 && x >= channels ? img.data[row - stride + x - channels]! : 0;
        const f = type === 0 ? v : type === 1 ? v - a : type === 2 ? v - b : type === 3 ? v - ((a + b) >> 1) : v - paeth(a, b, c);
        candidate[x] = f & 0xff;
        sum += Math.abs((f << 24) >> 24);
      }
      if (sum < bestSum) {
        bestSum = sum;
        best = type;
        bestRow = candidate.slice();
      }
    }
    raw[y * (stride + 1)] = best;
    raw.set(bestRow, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = channels === 1 ? 0 : 2;
  return new Uint8Array(Buffer.concat([Buffer.from(SIGNATURE), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 6 })), chunk("IEND", new Uint8Array(0))]));
}
