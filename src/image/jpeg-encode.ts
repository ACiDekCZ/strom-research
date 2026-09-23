// Baseline JPEG encoder (the standard tables of ITU T.81 Annex K): the views
// strom makes of scans are written with it. 4:4:4 for colour — script and
// thin strokes keep their colour edges — or one grey channel.

import type { RawImage } from "./image.ts";

const ZIGZAG = [
  0, 1, 8, 16, 9, 2, 3, 10, 17, 24, 32, 25, 18, 11, 4, 5, 12, 19, 26, 33, 40, 48, 41, 34, 27, 20, 13, 6, 7, 14, 21, 28, 35, 42, 49, 56, 57, 50, 43, 36, 29, 22,
  15, 23, 30, 37, 44, 51, 58, 59, 52, 45, 38, 31, 39, 46, 53, 60, 61, 54, 47, 55, 62, 63,
];

const LUMA_Q = [
  16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55, 14, 13, 16, 24, 40, 57, 69, 56, 14, 17, 22, 29, 51, 87, 80, 62, 18, 22, 37, 56, 68, 109, 103, 77, 24,
  35, 55, 64, 81, 104, 113, 92, 49, 64, 78, 87, 103, 121, 120, 101, 72, 92, 95, 98, 112, 100, 103, 99,
];
const CHROMA_Q = [
  17, 18, 24, 47, 99, 99, 99, 99, 18, 21, 26, 66, 99, 99, 99, 99, 24, 26, 56, 99, 99, 99, 99, 99, 47, 66, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99,
  99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99, 99,
];

// Annex K.3 Huffman tables: counts of codes per length 1..16, then the values.
const DC_LUMA = { counts: [0, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0], values: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] };
const DC_CHROMA = { counts: [0, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0], values: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] };
const AC_LUMA = {
  counts: [0, 2, 1, 3, 3, 2, 4, 3, 5, 5, 4, 4, 0, 0, 1, 0x7d],
  values: [
    0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06, 0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08, 0x23, 0x42,
    0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0, 0x24, 0x33, 0x62, 0x72, 0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2a, 0x34, 0x35,
    0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67,
    0x68, 0x69, 0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98,
    0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7,
    0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4,
    0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa,
  ],
};
const AC_CHROMA = {
  counts: [0, 2, 1, 2, 4, 4, 3, 4, 7, 5, 4, 4, 0, 1, 2, 0x77],
  values: [
    0x00, 0x01, 0x02, 0x03, 0x11, 0x04, 0x05, 0x21, 0x31, 0x06, 0x12, 0x41, 0x51, 0x07, 0x61, 0x71, 0x13, 0x22, 0x32, 0x81, 0x08, 0x14, 0x42, 0x91, 0xa1, 0xb1,
    0xc1, 0x09, 0x23, 0x33, 0x52, 0xf0, 0x15, 0x62, 0x72, 0xd1, 0x0a, 0x16, 0x24, 0x34, 0xe1, 0x25, 0xf1, 0x17, 0x18, 0x19, 0x1a, 0x26, 0x27, 0x28, 0x29, 0x2a,
    0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66,
    0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8a, 0x92, 0x93, 0x94, 0x95, 0x96,
    0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5,
    0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf2, 0xf3, 0xf4,
    0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa,
  ],
};

interface Code {
  code: Int32Array;
  size: Int32Array;
}

function codes(spec: { counts: number[]; values: number[] }): Code {
  const code = new Int32Array(256);
  const size = new Int32Array(256);
  let c = 0;
  let k = 0;
  for (let len = 1; len <= 16; len++) {
    for (let i = 0; i < spec.counts[len - 1]!; i++, k++, c++) {
      code[spec.values[k]!] = c;
      size[spec.values[k]!] = len;
    }
    c <<= 1;
  }
  return { code, size };
}

const TABLES = { dcL: codes(DC_LUMA), acL: codes(AC_LUMA), dcC: codes(DC_CHROMA), acC: codes(AC_CHROMA) };

function scaledTable(base: number[], quality: number): number[] {
  const q = Math.max(1, Math.min(100, quality));
  const scale = q < 50 ? 5000 / q : 200 - q * 2;
  return base.map((v) => Math.max(1, Math.min(255, Math.floor((v * scale + 50) / 100))));
}

class Writer {
  private chunks: number[] = [];
  private buf = 0;
  private bits = 0;
  byte(b: number): void {
    this.chunks.push(b & 0xff);
  }
  word(w: number): void {
    this.byte(w >> 8);
    this.byte(w);
  }
  put(code: number, size: number): void {
    for (let i = size - 1; i >= 0; i--) {
      this.buf = (this.buf << 1) | ((code >> i) & 1);
      if (++this.bits === 8) {
        this.byte(this.buf);
        if (this.buf === 0xff) this.byte(0); // stuffing
        this.buf = 0;
        this.bits = 0;
      }
    }
  }
  flush(): void {
    if (this.bits > 0) this.put((1 << (8 - this.bits)) - 1, 8 - this.bits); // pad with ones
  }
  bytes(): Uint8Array {
    return Uint8Array.from(this.chunks);
  }
}

/** Forward DCT factor table: C(u) cos((2x+1)uπ/16) / 2. */
const FCOS = (() => {
  const t = new Float64Array(64);
  for (let u = 0; u < 8; u++) for (let x = 0; x < 8; x++) t[u * 8 + x] = ((u === 0 ? Math.SQRT1_2 : 1) * Math.cos(((2 * x + 1) * u * Math.PI) / 16)) / 2;
  return t;
})();

function fdct(block: Float64Array, tmp: Float64Array, out: Float64Array): void {
  for (let y = 0; y < 8; y++)
    for (let u = 0; u < 8; u++) {
      let s = 0;
      for (let x = 0; x < 8; x++) s += FCOS[u * 8 + x]! * block[y * 8 + x]!;
      tmp[y * 8 + u] = s;
    }
  for (let u = 0; u < 8; u++)
    for (let v = 0; v < 8; v++) {
      let s = 0;
      for (let y = 0; y < 8; y++) s += FCOS[v * 8 + y]! * tmp[y * 8 + u]!;
      out[v * 8 + u] = s;
    }
}

function magnitude(v: number): { size: number; bits: number } {
  const a = Math.abs(v);
  let size = 0;
  while (a >> size) size++;
  return { size, bits: v < 0 ? v + (1 << size) - 1 : v };
}

export function encodeJpeg(img: RawImage, quality = 90): Uint8Array {
  const { width, height, channels } = img;
  const w = new Writer();
  const qL = scaledTable(LUMA_Q, quality);
  const qC = scaledTable(CHROMA_Q, quality);
  // SOI + JFIF
  w.word(0xffd8);
  w.word(0xffe0);
  w.word(16);
  for (const c of [0x4a, 0x46, 0x49, 0x46, 0]) w.byte(c);
  w.word(0x0101);
  w.byte(0);
  w.word(1);
  w.word(1);
  w.byte(0);
  w.byte(0);
  // DQT
  const tables = channels === 3 ? [qL, qC] : [qL];
  tables.forEach((t, i) => {
    w.word(0xffdb);
    w.word(67);
    w.byte(i);
    for (let k = 0; k < 64; k++) w.byte(t[ZIGZAG[k]!]!);
  });
  // SOF0
  w.word(0xffc0);
  w.word(8 + 3 * channels);
  w.byte(8);
  w.word(height);
  w.word(width);
  w.byte(channels);
  for (let c = 0; c < channels; c++) {
    w.byte(c + 1);
    w.byte(0x11);
    w.byte(c === 0 ? 0 : 1);
  }
  // DHT
  const dht = (cls: number, id: number, spec: { counts: number[]; values: number[] }) => {
    w.word(0xffc4);
    w.word(3 + 16 + spec.values.length);
    w.byte((cls << 4) | id);
    for (const n of spec.counts) w.byte(n);
    for (const v of spec.values) w.byte(v);
  };
  dht(0, 0, DC_LUMA);
  dht(1, 0, AC_LUMA);
  if (channels === 3) {
    dht(0, 1, DC_CHROMA);
    dht(1, 1, AC_CHROMA);
  }
  // SOS
  w.word(0xffda);
  w.word(6 + 2 * channels);
  w.byte(channels);
  for (let c = 0; c < channels; c++) {
    w.byte(c + 1);
    w.byte(c === 0 ? 0x00 : 0x11);
  }
  w.byte(0);
  w.byte(63);
  w.byte(0);

  const block = new Float64Array(64);
  const tmp = new Float64Array(64);
  const coef = new Float64Array(64);
  const pred = [0, 0, 0];
  const encodeBlock = (comp: number) => {
    fdct(block, tmp, coef);
    const q = comp === 0 ? qL : qC;
    const dc = comp === 0 ? TABLES.dcL : TABLES.dcC;
    const ac = comp === 0 ? TABLES.acL : TABLES.acC;
    const zz = new Int32Array(64);
    for (let k = 0; k < 64; k++) zz[k] = Math.round(coef[ZIGZAG[k]!]! / q[ZIGZAG[k]!]!);
    const diff = zz[0]! - pred[comp]!;
    pred[comp] = zz[0]!;
    const m = magnitude(diff);
    w.put(dc.code[m.size]!, dc.size[m.size]!);
    if (m.size) w.put(m.bits, m.size);
    let run = 0;
    for (let k = 1; k < 64; k++) {
      const v = zz[k]!;
      if (v === 0) {
        run++;
        continue;
      }
      while (run > 15) {
        w.put(ac.code[0xf0]!, ac.size[0xf0]!);
        run -= 16;
      }
      const mm = magnitude(v);
      const sym = (run << 4) | mm.size;
      w.put(ac.code[sym]!, ac.size[sym]!);
      w.put(mm.bits, mm.size);
      run = 0;
    }
    if (run > 0) w.put(ac.code[0]!, ac.size[0]!); // EOB
  };

  const data = img.data;
  for (let by = 0; by < height; by += 8)
    for (let bx = 0; bx < width; bx += 8)
      for (let comp = 0; comp < channels; comp++) {
        for (let y = 0; y < 8; y++)
          for (let x = 0; x < 8; x++) {
            // edge blocks repeat the last row/column
            const sx = Math.min(width - 1, bx + x);
            const sy = Math.min(height - 1, by + y);
            const p = (sy * width + sx) * channels;
            let v: number;
            if (channels === 1) v = data[p]!;
            else {
              const r = data[p]!;
              const g = data[p + 1]!;
              const b = data[p + 2]!;
              v = comp === 0 ? 0.299 * r + 0.587 * g + 0.114 * b : comp === 1 ? -0.168736 * r - 0.331264 * g + 0.5 * b + 128 : 0.5 * r - 0.418688 * g - 0.081312 * b + 128;
            }
            block[y * 8 + x] = v - 128;
          }
        encodeBlock(comp);
      }
  w.flush();
  w.word(0xffd9);
  return w.bytes();
}
