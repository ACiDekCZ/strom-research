// A reader of QR codes for the tests, written apart from the encoder (src/core/qr.ts): it finds the symbol in the
// modules, reads its format (error correction, mask) by the nearest valid code, checks the version information,
// unmasks, reads the codewords, checks every block's error correction by its syndromes (log tables, not the encoder's
// multiplication) and reads the bytes of the byte mode. Anything wrong: an error.

const EXP = new Array<number>(512);
const LOG = new Array<number>(256).fill(0);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]!;
}
const mul = (a: number, b: number) => (a && b ? EXP[LOG[a]! + LOG[b]!]! : 0);

/** Level M of the standard, versions 1–10: EC codewords per block, then the data codewords of each block. */
const M_BLOCKS: Record<number, [number, number[]]> = {
  1: [10, [16]],
  2: [16, [28]],
  3: [26, [44]],
  4: [18, [32, 32]],
  5: [24, [43, 43]],
  6: [16, [27, 27, 27, 27]],
  7: [18, [31, 31, 31, 31]],
  8: [22, [38, 38, 39, 39]],
  9: [22, [36, 36, 36, 37, 37]],
  10: [26, [43, 43, 43, 43, 44]],
};
const ALIGNMENT: Record<number, number[]> = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50] };

function bch(value: number, bits: number, poly: number, polyBits: number): number {
  let v = value << (polyBits - 1);
  for (let i = bits + polyBits - 2; i >= polyBits - 1; i--) if ((v >>> i) & 1) v ^= poly << (i - (polyBits - 1));
  return (value << (polyBits - 1)) | v;
}

const popcount = (n: number) => n.toString(2).replace(/0/g, "").length;

export interface Decoded {
  text: string;
  version: number;
  level: "L" | "M" | "Q" | "H";
  mask: number;
}

/** The symbol read from rows of modules (true = dark), a quiet zone around it or none. */
export function decodeQr(rows: boolean[][]): Decoded {
  // the symbol: from the first dark module to the last (its finders take three corners)
  const ys = rows.map((r, y) => (r.includes(true) ? y : -1)).filter((y) => y >= 0);
  const xs = rows.flatMap((r) => r.map((d, x) => (d ? x : -1)).filter((x) => x >= 0));
  const top = Math.min(...ys);
  const left = Math.min(...xs);
  const size = Math.max(...ys) - top + 1;
  if (Math.max(...xs) - left + 1 !== size) throw new Error("not square");
  const at = (x: number, y: number) => rows[top + y]?.[left + x] === true;
  const version = (size - 17) / 4;
  if (!Number.isInteger(version) || version < 1 || !M_BLOCKS[version]) throw new Error(`no version of 1–10: ${size} modules`);

  // the finders
  for (const [fx, fy] of [[0, 0], [size - 7, 0], [0, size - 7]] as const) {
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        const ring = Math.max(Math.abs(x - 3), Math.abs(y - 3));
        if (at(fx + x, fy + y) !== (ring !== 2)) throw new Error(`no finder at ${fx},${fy}`);
      }
    }
  }
  // timing
  for (let i = 8; i < size - 8; i++) if (at(i, 6) !== (i % 2 === 0) || at(6, i) !== (i % 2 === 0)) throw new Error(`timing broken at ${i}`);

  // the format, both copies, each by the nearest of the 32 valid codes
  const read = (cells: [number, number][]) => cells.reduce((n, [x, y], i) => n | (Number(at(x, y)) << i), 0);
  const first: [number, number][] = [];
  for (let i = 0; i <= 5; i++) first.push([8, i]);
  first.push([8, 7], [8, 8], [7, 8]);
  for (let i = 9; i < 15; i++) first.push([14 - i, 8]);
  const second: [number, number][] = [];
  for (let i = 0; i < 8; i++) second.push([size - 1 - i, 8]);
  for (let i = 8; i < 15; i++) second.push([8, size - 15 + i]);
  if (!at(8, size - 8)) throw new Error("no dark module");
  const nearest = (raw: number) => {
    let best = { data: -1, d: 99 };
    for (let data = 0; data < 32; data++) {
      const d = popcount((bch(data, 5, 0x537, 11) ^ 0x5412) ^ raw);
      if (d < best.d) best = { data, d };
    }
    if (best.d > 3) throw new Error("format unreadable");
    return best.data;
  };
  const fmt = nearest(read(first));
  if (nearest(read(second)) !== fmt) throw new Error("the two copies of the format differ");
  const level = (["M", "L", "H", "Q"] as const)[fmt >>> 3]!;
  const mask = fmt & 7;
  if (level !== "M") throw new Error(`level ${level}: only M is read here`);

  if (version >= 7) {
    const want = bch(version, 6, 0x1f25, 13);
    let a = 0;
    let b = 0;
    for (let i = 0; i < 18; i++) {
      a |= Number(at(size - 11 + (i % 3), Math.floor(i / 3))) << i;
      b |= Number(at(Math.floor(i / 3), size - 11 + (i % 3))) << i;
    }
    if (a !== want || b !== want) throw new Error("version information wrong");
  }

  // what is no data
  const fn = (x: number, y: number) => {
    if ((x < 9 && y < 9) || (x >= size - 8 && y < 9) || (x < 9 && y >= size - 8)) return true;
    if (x === 6 || y === 6) return true;
    if (version >= 7 && ((x >= size - 11 && x < size - 8 && y < 6) || (y >= size - 11 && y < size - 8 && x < 6))) return true;
    const al = ALIGNMENT[version]!;
    for (const cx of al) {
      for (const cy of al) {
        if ((cx === 6 && cy === 6) || (cx === 6 && cy === al.at(-1)) || (cx === al.at(-1) && cy === 6)) continue;
        if (Math.abs(x - cx) <= 2 && Math.abs(y - cy) <= 2) return true;
      }
    }
    return false;
  };
  const masks = [
    (x: number, y: number) => (x + y) % 2 === 0,
    (_x: number, y: number) => y % 2 === 0,
    (x: number) => x % 3 === 0,
    (x: number, y: number) => (x + y) % 3 === 0,
    (x: number, y: number) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
    (x: number, y: number) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x: number, y: number) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
    (x: number, y: number) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
  ];
  const bits: number[] = [];
  let upward = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let k = 0; k < size; k++) {
      const y = upward ? size - 1 - k : k;
      for (const x of [col, col - 1]) if (!fn(x, y)) bits.push(Number(at(x, y) !== masks[mask]!(x, y)));
    }
    upward = !upward;
  }
  const [ecLen, lens] = M_BLOCKS[version]!;
  const total = lens.reduce((a, b) => a + b, 0) + ecLen * lens.length;
  if (bits.length < total * 8) throw new Error("too few modules for the codewords");
  const words: number[] = [];
  for (let i = 0; i < total; i++) words.push(bits.slice(i * 8, i * 8 + 8).reduce((a, b) => (a << 1) | b, 0));

  // the blocks again, each checked by its syndromes
  const blocks = lens.map(() => [] as number[]);
  let w = 0;
  for (let i = 0; i < Math.max(...lens); i++) lens.forEach((len, b) => i < len && blocks[b]!.push(words[w++]!));
  for (let i = 0; i < ecLen; i++) blocks.forEach((b) => b.push(words[w++]!));
  blocks.forEach((block, b) => {
    for (let j = 0; j < ecLen; j++) {
      const root = EXP[j]!;
      const s = block.reduce((acc, c) => mul(acc, root) ^ c, 0);
      if (s !== 0) throw new Error(`block ${b}: error correction wrong (syndrome ${j})`);
    }
  });
  const data = blocks.flatMap((block, b) => block.slice(0, lens[b]));
  const stream = data.flatMap((byte) => Array.from({ length: 8 }, (_, i) => (byte >>> (7 - i)) & 1));
  let pos = 0;
  const take = (n: number) => {
    let v = 0;
    for (let i = 0; i < n; i++) v = (v << 1) | stream[pos++]!;
    return v;
  };
  if (take(4) !== 0b0100) throw new Error("not the byte mode");
  const n = take(version < 10 ? 8 : 16);
  const bytes = Uint8Array.from({ length: n }, () => take(8));
  if (pos > stream.length) throw new Error("longer than the symbol");
  if (stream.length - pos >= 4 && take(4) !== 0) throw new Error("no terminator");
  return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes), version, level, mask };
}

/** The modules of an SVG of rectangles and a path of `M x y h n v1 h-n z` (what qrSvg draws). */
export function svgModules(svg: string): boolean[][] {
  const box = /viewBox="0 0 (\d+) (\d+)"/.exec(svg);
  if (!box) throw new Error("no viewBox");
  const n = Number(box[1]);
  const rows = Array.from({ length: n }, () => new Array<boolean>(n).fill(false));
  const d = /<path[^>]*\sd="([^"]*)"/.exec(svg)?.[1] ?? "";
  for (const m of d.matchAll(/M(\d+) (\d+)h(\d+)v1h-(\d+)z/g)) {
    const [x, y, w] = [Number(m[1]), Number(m[2]), Number(m[3])];
    for (let i = 0; i < w; i++) rows[y]![x + i] = true;
  }
  return rows;
}

/** The modules of half blocks in a terminal (colours aside): ▀ the upper dark, ▄ the lower, █ both. */
export function terminalModules(text: string): boolean[][] {
  const rows: boolean[][] = [];
  // eslint-disable-next-line no-control-regex
  for (const line of text.replace(/\x1b\[[0-9;]*m/g, "").split("\n")) {
    const chars = [...line];
    rows.push(chars.map((c) => c === "█" || c === "▀"));
    rows.push(chars.map((c) => c === "█" || c === "▄"));
  }
  return rows;
}
