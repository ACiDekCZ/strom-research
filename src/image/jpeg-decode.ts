// JPEG decoder: baseline and progressive (Huffman), any chroma subsampling,
// restart intervals, JFIF / Adobe (RGB, YCbCr, CMYK, YCCK). Archive scans are
// JPEG almost always; nothing else is needed to crop and enlarge them.
// Follows ITU T.81 and the structure of libjpeg's decoder.

import type { RawImage } from "./image.ts";

const ZIGZAG = new Int32Array([
  0, 1, 8, 16, 9, 2, 3, 10, 17, 24, 32, 25, 18, 11, 4, 5, 12, 19, 26, 33, 40, 48, 41, 34, 27, 20, 13, 6, 7, 14, 21, 28, 35, 42, 49, 56, 57, 50, 43, 36, 29,
  22, 15, 23, 30, 37, 44, 51, 58, 59, 52, 45, 38, 31, 39, 46, 53, 60, 61, 54, 47, 55, 62, 63,
]);

export class JpegError extends Error {}

interface Huffman {
  /** Fast path: the next 9 bits → (length << 8) | value, or 0 when the code is longer. */
  lookup: Uint16Array;
  maxcode: Int32Array;
  valptr: Int32Array;
  mincode: Int32Array;
  values: Uint8Array;
}

const LOOKUP_BITS = 9;

function buildHuffman(counts: Uint8Array, values: Uint8Array): Huffman {
  const maxcode = new Int32Array(18).fill(-1);
  const valptr = new Int32Array(17);
  const mincode = new Int32Array(17);
  const lookup = new Uint16Array(1 << LOOKUP_BITS);
  let code = 0;
  let k = 0;
  for (let len = 1; len <= 16; len++) {
    valptr[len] = k;
    mincode[len] = code;
    const n = counts[len - 1]!;
    for (let i = 0; i < n; i++, k++, code++) {
      if (len <= LOOKUP_BITS) {
        const shift = LOOKUP_BITS - len;
        const base = code << shift;
        for (let f = 0; f < 1 << shift; f++) lookup[base + f] = (len << 8) | values[k]!;
      }
    }
    maxcode[len] = n ? code - 1 : -1;
    code <<= 1;
  }
  maxcode[17] = 0x7fffffff;
  return { lookup, maxcode, valptr, mincode, values };
}

interface Component {
  id: number;
  h: number;
  v: number;
  tq: number;
  blocksPerLine: number;
  blocksPerColumn: number;
  /** Row stride in blocks of the coefficient buffer (padded to whole MCUs). */
  stride: number;
  coefs: Int16Array;
  dcTable?: Huffman;
  acTable?: Huffman;
  pred: number;
}

interface Frame {
  progressive: boolean;
  width: number;
  height: number;
  hmax: number;
  vmax: number;
  mcusPerLine: number;
  mcusPerColumn: number;
  components: Component[];
}

/** Bits of the entropy-coded data; stops at a marker. */
class BitReader {
  private readonly data: Uint8Array;
  private pos: number;
  private buf = 0;
  private bits = 0;
  /** A marker (RSTn, EOI, …) was reached. */
  marker = -1;
  constructor(data: Uint8Array, start: number) {
    this.data = data;
    this.pos = start;
  }

  get offset(): number {
    return this.pos;
  }

  private fill(): void {
    while (this.bits <= 24) {
      let byte = 0;
      if (this.marker < 0 && this.pos < this.data.length) {
        byte = this.data[this.pos]!;
        if (byte === 0xff) {
          const next = this.data[this.pos + 1] ?? 0;
          if (next === 0) this.pos += 2; // stuffed zero
          else {
            this.marker = next; // leave the marker for the caller; feed zeros
            byte = 0;
          }
        } else this.pos++;
      }
      this.buf = (this.buf << 8) | byte;
      this.bits += 8;
    }
  }

  peek(n: number): number {
    if (this.bits < n) this.fill();
    return (this.buf >>> (this.bits - n)) & ((1 << n) - 1);
  }

  skip(n: number): void {
    this.bits -= n;
    this.buf &= (1 << this.bits) - 1;
  }

  read(n: number): number {
    if (n === 0) return 0;
    const v = this.peek(n);
    this.skip(n);
    return v;
  }

  bit(): number {
    return this.read(1);
  }

  /** After a restart marker: byte-align and continue after it. */
  restart(): void {
    this.buf = 0;
    this.bits = 0;
    if (this.marker >= 0xd0 && this.marker <= 0xd7) {
      this.pos += 2;
      this.marker = -1;
      return;
    }
    // no marker seen yet: find the next RST
    while (this.pos + 1 < this.data.length) {
      if (this.data[this.pos] === 0xff && this.data[this.pos + 1]! >= 0xd0 && this.data[this.pos + 1]! <= 0xd7) {
        this.pos += 2;
        this.marker = -1;
        return;
      }
      this.pos++;
    }
  }

  /** Where the scan data ends: the position of the marker that ended it. */
  end(): number {
    let p = this.pos;
    while (p + 1 < this.data.length && !(this.data[p] === 0xff && this.data[p + 1] !== 0 && !(this.data[p + 1]! >= 0xd0 && this.data[p + 1]! <= 0xd7))) p++;
    return p;
  }
}

function decodeHuffman(r: BitReader, h: Huffman): number {
  const look = h.lookup[r.peek(LOOKUP_BITS)]!;
  if (look) {
    r.skip(look >> 8);
    return look & 0xff;
  }
  let code = r.read(LOOKUP_BITS);
  let len = LOOKUP_BITS;
  while (code > h.maxcode[len]!) {
    code = (code << 1) | r.bit();
    len++;
    if (len > 16) throw new JpegError("invalid Huffman code");
  }
  return h.values[h.valptr[len]! + code - h.mincode[len]!]!;
}

function extend(v: number, s: number): number {
  return v < 1 << (s - 1) ? v - (1 << s) + 1 : v;
}

interface Scan {
  components: Component[];
  ss: number;
  se: number;
  ah: number;
  al: number;
}

function decodeScan(data: Uint8Array, start: number, frame: Frame, scan: Scan, restartInterval: number): number {
  const r = new BitReader(data, start);
  const { ss, se, ah, al } = scan;
  const single = scan.components.length === 1;
  let eobrun = 0;
  for (const c of scan.components) c.pred = 0;

  const p1 = 1 << al;
  const m1 = -1 << al;

  const decodeBlock = (c: Component, off: number) => {
    const coefs = c.coefs;
    if (!frame.progressive) {
      const t = decodeHuffman(r, c.dcTable!);
      c.pred += t === 0 ? 0 : extend(r.read(t), t);
      coefs[off] = c.pred;
      for (let k = 1; k < 64; ) {
        const rs = decodeHuffman(r, c.acTable!);
        const s = rs & 15;
        const run = rs >> 4;
        if (s === 0) {
          if (run < 15) break;
          k += 16;
          continue;
        }
        k += run;
        if (k > 63) break;
        coefs[off + ZIGZAG[k]!] = extend(r.read(s), s);
        k++;
      }
      return;
    }
    if (ss === 0) {
      // DC scans
      if (ah === 0) {
        const t = decodeHuffman(r, c.dcTable!);
        c.pred += t === 0 ? 0 : extend(r.read(t), t);
        coefs[off] = c.pred * (1 << al);
      } else if (r.bit()) coefs[off]! |= p1;
      return;
    }
    if (ah === 0) {
      // AC first pass
      if (eobrun > 0) {
        eobrun--;
        return;
      }
      for (let k = ss; k <= se; ) {
        const rs = decodeHuffman(r, c.acTable!);
        const s = rs & 15;
        const run = rs >> 4;
        if (s === 0) {
          if (run < 15) {
            eobrun = (1 << run) - 1;
            if (run) eobrun += r.read(run);
            break;
          }
          k += 16;
          continue;
        }
        k += run;
        if (k > 63) break;
        coefs[off + ZIGZAG[k]!] = extend(r.read(s), s) * (1 << al);
        k++;
      }
      return;
    }
    // AC refinement (libjpeg decode_mcu_AC_refine)
    let k = ss;
    const refine = (z: number) => {
      if (r.bit() && (coefs[off + z]! & p1) === 0) coefs[off + z] = coefs[off + z]! + (coefs[off + z]! >= 0 ? p1 : m1);
    };
    if (eobrun === 0) {
      for (; k <= se; k++) {
        const rs = decodeHuffman(r, c.acTable!);
        let run = rs >> 4;
        let s = rs & 15;
        if (s) s = r.bit() ? p1 : m1;
        else if (run !== 15) {
          eobrun = 1 << run;
          if (run) eobrun += r.read(run);
          break;
        }
        do {
          const z = ZIGZAG[k]!;
          if (coefs[off + z] !== 0) refine(z);
          else if (--run < 0) break;
          k++;
        } while (k <= se);
        if (s && k <= se) coefs[off + ZIGZAG[k]!] = s;
      }
    }
    if (eobrun > 0) {
      for (; k <= se; k++) {
        const z = ZIGZAG[k]!;
        if (coefs[off + z] !== 0) refine(z);
      }
      eobrun--;
    }
  };

  const blockOffset = (c: Component, row: number, col: number) => 64 * (row * c.stride + col);

  let mcus: number;
  let next: (i: number) => void;
  if (single) {
    // A single component: its own blocks in raster order, no MCU padding.
    const c = scan.components[0]!;
    mcus = c.blocksPerLine * c.blocksPerColumn;
    next = (i) => decodeBlock(c, blockOffset(c, Math.floor(i / c.blocksPerLine), i % c.blocksPerLine));
  } else {
    mcus = frame.mcusPerLine * frame.mcusPerColumn;
    next = (i) => {
      const mrow = Math.floor(i / frame.mcusPerLine);
      const mcol = i % frame.mcusPerLine;
      for (const c of scan.components)
        for (let v = 0; v < c.v; v++) for (let h = 0; h < c.h; h++) decodeBlock(c, blockOffset(c, mrow * c.v + v, mcol * c.h + h));
    };
  }
  for (let i = 0; i < mcus; i++) {
    if (restartInterval && i > 0 && i % restartInterval === 0) {
      r.restart();
      eobrun = 0;
      for (const c of scan.components) c.pred = 0;
    }
    next(i);
  }
  return r.end();
}

/** Separable float inverse DCT of one dequantized block → 8×8 samples. */
const COS = (() => {
  const t = new Float64Array(64);
  for (let x = 0; x < 8; x++) for (let u = 0; u < 8; u++) t[x * 8 + u] = (u === 0 ? Math.SQRT1_2 : 1) * Math.cos(((2 * x + 1) * u * Math.PI) / 16) / 2;
  return t;
})();

function idct(block: Float64Array, tmp: Float64Array, out: Uint8Array, outOff: number, outStride: number): void {
  // rows: tmp[y][x] = Σu C(u) F(y,u) cos(...)
  for (let y = 0; y < 8; y++) {
    const r = y * 8;
    let zero = true;
    for (let u = 1; u < 8; u++) if (block[r + u] !== 0) zero = false;
    if (zero) {
      const dc = block[r]! * COS[0]!;
      for (let x = 0; x < 8; x++) tmp[r + x] = dc;
      continue;
    }
    for (let x = 0; x < 8; x++) {
      let s = 0;
      for (let u = 0; u < 8; u++) s += COS[x * 8 + u]! * block[r + u]!;
      tmp[r + x] = s;
    }
  }
  for (let x = 0; x < 8; x++)
    for (let y = 0; y < 8; y++) {
      let s = 0;
      for (let v = 0; v < 8; v++) s += COS[y * 8 + v]! * tmp[v * 8 + x]!;
      const val = Math.round(s + 128);
      out[outOff + y * outStride + x] = val < 0 ? 0 : val > 255 ? 255 : val;
    }
}

/** Samples of one component, at its own resolution (padded to whole blocks). */
function componentSamples(c: Component, quant: Int32Array): { data: Uint8Array; width: number } {
  const width = c.stride * 8;
  const rows = (c.coefs.length / 64 / c.stride) * 8;
  const out = new Uint8Array(width * rows);
  const block = new Float64Array(64);
  const tmp = new Float64Array(64);
  const blocks = c.coefs.length / 64;
  for (let b = 0; b < blocks; b++) {
    const off = b * 64;
    for (let i = 0; i < 64; i++) block[i] = c.coefs[off + i]! * quant[i]!;
    const row = Math.floor(b / c.stride);
    const col = b % c.stride;
    idct(block, tmp, out, row * 8 * width + col * 8, width);
  }
  return { data: out, width };
}

const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));

export function decodeJpeg(bytes: Uint8Array): RawImage {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new JpegError("not a JPEG file");
  const quant: Int32Array[] = [];
  const dcTables: Huffman[] = [];
  const acTables: Huffman[] = [];
  let frame: Frame | undefined;
  let restartInterval = 0;
  let adobe: number | undefined;
  let jfif = false;
  let pos = 2;
  const u16 = (p: number) => (bytes[p]! << 8) | bytes[p + 1]!;

  while (pos < bytes.length) {
    if (bytes[pos] !== 0xff) {
      pos++;
      continue;
    }
    const marker = bytes[pos + 1]!;
    pos += 2;
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01 || marker === 0xff) {
      if (marker === 0xff) pos--;
      continue;
    }
    if (marker === 0xd9) break; // EOI
    const len = u16(pos);
    const seg = pos + 2;
    const end = pos + len;
    switch (marker) {
      case 0xe0: // APP0
        if (bytes[seg] === 0x4a && bytes[seg + 1] === 0x46 && bytes[seg + 2] === 0x49 && bytes[seg + 3] === 0x46) jfif = true;
        break;
      case 0xee: // APP14 Adobe
        if (bytes[seg] === 0x41 && bytes[seg + 1] === 0x64 && bytes[seg + 2] === 0x6f && bytes[seg + 3] === 0x62 && bytes[seg + 4] === 0x65) adobe = bytes[seg + 11];
        break;
      case 0xdb: {
        // DQT
        let p = seg;
        while (p < end) {
          const pq = bytes[p]! >> 4;
          const tq = bytes[p]! & 15;
          p++;
          const t = new Int32Array(64);
          for (let i = 0; i < 64; i++) {
            t[ZIGZAG[i]!] = pq ? u16(p + i * 2) : bytes[p + i]!;
          }
          p += pq ? 128 : 64;
          quant[tq] = t;
        }
        break;
      }
      case 0xc0:
      case 0xc1:
      case 0xc2: {
        // SOF0 baseline, SOF1 extended, SOF2 progressive (Huffman)
        if (bytes[seg] !== 8) throw new JpegError(`${bytes[seg]}-bit JPEG is not supported`);
        const height = u16(seg + 1);
        const width = u16(seg + 3);
        const n = bytes[seg + 5]!;
        if (!width || !height) throw new JpegError("JPEG without dimensions (DNL) is not supported");
        const comps: Component[] = [];
        for (let i = 0; i < n; i++) {
          const p = seg + 6 + i * 3;
          comps.push({ id: bytes[p]!, h: bytes[p + 1]! >> 4, v: bytes[p + 1]! & 15, tq: bytes[p + 2]!, blocksPerLine: 0, blocksPerColumn: 0, stride: 0, coefs: new Int16Array(0), pred: 0 });
        }
        const hmax = Math.max(...comps.map((c) => c.h));
        const vmax = Math.max(...comps.map((c) => c.v));
        const mcusPerLine = Math.ceil(width / (8 * hmax));
        const mcusPerColumn = Math.ceil(height / (8 * vmax));
        for (const c of comps) {
          c.blocksPerLine = Math.ceil(Math.ceil((width * c.h) / hmax) / 8);
          c.blocksPerColumn = Math.ceil(Math.ceil((height * c.v) / vmax) / 8);
          c.stride = mcusPerLine * c.h;
          c.coefs = new Int16Array(64 * c.stride * mcusPerColumn * c.v);
        }
        frame = { progressive: marker === 0xc2, width, height, hmax, vmax, mcusPerLine, mcusPerColumn, components: comps };
        break;
      }
      case 0xc3:
      case 0xc5:
      case 0xc6:
      case 0xc7:
      case 0xc9:
      case 0xca:
      case 0xcb:
      case 0xcd:
      case 0xce:
      case 0xcf:
        throw new JpegError("lossless, hierarchical and arithmetic-coded JPEG are not supported");
      case 0xc4: {
        // DHT
        let p = seg;
        while (p < end) {
          const tc = bytes[p]! >> 4;
          const th = bytes[p]! & 15;
          const counts = bytes.subarray(p + 1, p + 17);
          const total = counts.reduce((a, b) => a + b, 0);
          const values = bytes.slice(p + 17, p + 17 + total);
          (tc === 0 ? dcTables : acTables)[th] = buildHuffman(counts, values);
          p += 17 + total;
        }
        break;
      }
      case 0xdd:
        restartInterval = u16(seg);
        break;
      case 0xda: {
        // SOS
        if (!frame) throw new JpegError("scan before frame");
        const n = bytes[seg]!;
        const comps: Component[] = [];
        for (let i = 0; i < n; i++) {
          const id = bytes[seg + 1 + i * 2]!;
          const tables = bytes[seg + 2 + i * 2]!;
          const c = frame.components.find((x) => x.id === id);
          if (!c) throw new JpegError(`scan names an unknown component ${id}`);
          c.dcTable = dcTables[tables >> 4];
          c.acTable = acTables[tables & 15];
          comps.push(c);
        }
        const p = seg + 1 + n * 2;
        const scan: Scan = { components: comps, ss: bytes[p]!, se: bytes[p + 1]!, ah: bytes[p + 2]! >> 4, al: bytes[p + 2]! & 15 };
        pos = decodeScan(bytes, end, frame, scan, restartInterval);
        continue;
      }
      default:
        break; // APPn, COM and others are skipped
    }
    pos = end;
  }
  if (!frame) throw new JpegError("no image in the JPEG file");

  // Samples per component, then upsampling and colour conversion.
  const { width, height, hmax, vmax, components } = frame;
  const planes = components.map((c) => {
    const q = quant[c.tq];
    if (!q) throw new JpegError(`missing quantization table ${c.tq}`);
    return { c, ...componentSamples(c, q) };
  });
  // Subsampled components are interpolated between sample centres (libjpeg's
  // "fancy" upsampling), not repeated: no colour blocks along strokes.
  const compW = planes.map((pl) => Math.ceil((width * pl.c.h) / hmax));
  const compH = planes.map((pl) => Math.ceil((height * pl.c.v) / vmax));
  const sample = (i: number, x: number, y: number) => {
    const pl = planes[i]!;
    if (pl.c.h === hmax && pl.c.v === vmax) return pl.data[y * pl.width + x]!;
    const fx = Math.max(0, Math.min(compW[i]! - 1, ((x + 0.5) * pl.c.h) / hmax - 0.5));
    const fy = Math.max(0, Math.min(compH[i]! - 1, ((y + 0.5) * pl.c.v) / vmax - 0.5));
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const x1 = Math.min(compW[i]! - 1, x0 + 1);
    const y1 = Math.min(compH[i]! - 1, y0 + 1);
    const tx = fx - x0;
    const ty = fy - y0;
    const d = pl.data;
    const w = pl.width;
    return (d[y0 * w + x0]! * (1 - tx) + d[y0 * w + x1]! * tx) * (1 - ty) + (d[y1 * w + x0]! * (1 - tx) + d[y1 * w + x1]! * tx) * ty;
  };
  if (components.length === 1) {
    const out = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) out.set(planes[0]!.data.subarray(y * planes[0]!.width, y * planes[0]!.width + width), y * width);
    return { width, height, channels: 1, data: out };
  }
  const out = new Uint8Array(width * height * 3);
  const transform = adobe !== undefined ? adobe !== 0 : jfif || components.length === 3;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 3;
      let a = sample(0, x, y);
      let b = sample(1, x, y);
      let c = sample(2, x, y);
      if (components.length === 4) {
        // CMYK, or YCCK (Adobe transform 2). Adobe stores ink inverted (255 = none).
        const k = sample(3, x, y);
        if (adobe === 2) {
          const y0 = a;
          a = clamp(y0 + 1.402 * (c - 128));
          b = clamp(y0 - 0.344136 * (b - 128) - 0.714136 * (c - 128));
          c = clamp(y0 + 1.772 * (sample(1, x, y) - 128));
        }
        if (adobe !== undefined) {
          out[o] = clamp((a * k) / 255);
          out[o + 1] = clamp((b * k) / 255);
          out[o + 2] = clamp((c * k) / 255);
        } else {
          out[o] = clamp(((255 - a) * (255 - k)) / 255);
          out[o + 1] = clamp(((255 - b) * (255 - k)) / 255);
          out[o + 2] = clamp(((255 - c) * (255 - k)) / 255);
        }
        continue;
      }
      if (transform) {
        out[o] = clamp(a + 1.402 * (c - 128));
        out[o + 1] = clamp(a - 0.344136 * (b - 128) - 0.714136 * (c - 128));
        out[o + 2] = clamp(a + 1.772 * (b - 128));
      } else {
        out[o] = a;
        out[o + 1] = b;
        out[o + 2] = c;
      }
    }
  return { width, height, channels: 3, data: out };
}
