// A QR code of a short text (the address a phone opens to pair: core/phone.ts), with nothing but Node: bytes (UTF-8),
// error correction M (15 % of the symbol may be lost — a glare, a crease of a screen), versions 1–10 (up to 213 bytes,
// 57×57 modules). Drawn as an SVG (the Strom app shows it) and in a terminal (strom phone qr), both with the quiet zone
// of four modules a camera needs.

/** Data codewords and error correction of level M, versions 1–10: [EC codewords of a block, blocks of each data length]. */
const BLOCKS: readonly (readonly [number, readonly (readonly [number, number])[]])[] = [
  [10, [[1, 16]]],
  [16, [[1, 28]]],
  [26, [[1, 44]]],
  [18, [[2, 32]]],
  [24, [[2, 43]]],
  [16, [[4, 27]]],
  [18, [[4, 31]]],
  [22, [[2, 38], [2, 39]]],
  [22, [[3, 36], [2, 37]]],
  [26, [[4, 43], [1, 44]]],
];

/** The centres of the alignment patterns of each version (both axes). */
const ALIGN: readonly (readonly number[])[] = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

export const QR_MAX_VERSION = BLOCKS.length;

function dataCodewords(version: number): number {
  return BLOCKS[version - 1]![1].reduce((n, [count, len]) => n + count * len, 0);
}

/** The bytes a version of level M holds (the mode and the length counted). */
export function qrCapacity(version: number): number {
  return Math.floor((dataCodewords(version) * 8 - 4 - (version < 10 ? 8 : 16)) / 8);
}

// Reed–Solomon over GF(256), the polynomial x⁸ + x⁴ + x³ + x² + 1
function gfMul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function rsDivisor(degree: number): number[] {
  const out = new Array<number>(degree).fill(0);
  out[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < out.length; j++) {
      out[j] = gfMul(out[j]!, root);
      if (j + 1 < out.length) out[j]! ^= out[j + 1]!;
    }
    root = gfMul(root, 2);
  }
  return out;
}

function rsRemainder(data: readonly number[], divisor: readonly number[]): number[] {
  const out = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ out.shift()!;
    out.push(0);
    divisor.forEach((c, i) => (out[i]! ^= gfMul(c, factor)));
  }
  return out;
}

/** The codewords of the text in a version: mode, length, the bytes, the end and the padding, blocks interleaved with their error correction. */
function codewords(bytes: Uint8Array, version: number): number[] {
  const bits: number[] = [];
  const put = (value: number, n: number) => {
    for (let i = n - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  put(0b0100, 4);
  put(bytes.length, version < 10 ? 8 : 16);
  for (const b of bytes) put(b, 8);
  const capacity = dataCodewords(version) * 8;
  put(0, Math.min(4, capacity - bits.length));
  put(0, (8 - (bits.length % 8)) % 8);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  for (let pad = 0xec; data.length < capacity / 8; pad ^= 0xec ^ 0x11) data.push(pad);

  const [ecLen, groups] = BLOCKS[version - 1]!;
  const divisor = rsDivisor(ecLen);
  const blocks: { data: number[]; ec: number[] }[] = [];
  let at = 0;
  for (const [count, len] of groups) {
    for (let i = 0; i < count; i++) {
      const d = data.slice(at, at + len);
      at += len;
      blocks.push({ data: d, ec: rsRemainder(d, divisor) });
    }
  }
  const out: number[] = [];
  const longest = Math.max(...blocks.map((b) => b.data.length));
  for (let i = 0; i < longest; i++) for (const b of blocks) if (i < b.data.length) out.push(b.data[i]!);
  for (let i = 0; i < ecLen; i++) for (const b of blocks) out.push(b.ec[i]!);
  return out;
}

const MASKS: readonly ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

/** How hard a symbol is to read (the rules of the standard: runs, blocks, patterns like a finder's, the balance of dark). */
function penalty(m: boolean[][]): number {
  const size = m.length;
  let score = 0;
  const line = (get: (i: number, j: number) => boolean) => {
    for (let i = 0; i < size; i++) {
      let run = 1;
      for (let j = 1; j <= size; j++) {
        if (j < size && get(i, j) === get(i, j - 1)) run++;
        else {
          if (run >= 5) score += run - 2;
          run = 1;
        }
      }
      for (let j = 0; j + 11 <= size; j++) {
        const w = Array.from({ length: 11 }, (_, k) => (get(i, j + k) ? 1 : 0)).join("");
        if (w === "10111010000" || w === "00001011101") score += 40;
      }
    }
  };
  line((y, x) => m[y]![x]!);
  line((x, y) => m[y]![x]!);
  let dark = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (m[y]![x]) dark++;
      if (x + 1 < size && y + 1 < size) {
        const c = m[y]![x];
        if (m[y]![x + 1] === c && m[y + 1]![x] === c && m[y + 1]![x + 1] === c) score += 3;
      }
    }
  }
  const total = size * size;
  score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
  return score;
}

/**
 * The modules of a QR code of the text (true = dark), without the quiet zone: the smallest version of 1–10 that holds
 * it, the mask that reads best. Longer than version 10 holds: an error.
 */
export function qrMatrix(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  let version = 1;
  while (version <= QR_MAX_VERSION && bytes.length > qrCapacity(version)) version++;
  if (version > QR_MAX_VERSION) throw new Error(`too long for a QR code of version ${QR_MAX_VERSION}: ${bytes.length} bytes (at most ${qrCapacity(QR_MAX_VERSION)})`);
  const size = 17 + 4 * version;
  const m = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const fixed = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const set = (x: number, y: number, dark: boolean) => {
    m[y]![x] = dark;
    fixed[y]![x] = true;
  };

  // timing, finders with their separators, alignment patterns
  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]] as const) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4);
      }
    }
  }
  const align = ALIGN[version - 1]!;
  for (const [i, cx] of align.entries()) {
    for (const [j, cy] of align.entries()) {
      // not over the finders
      if ((i === 0 && j === 0) || (i === 0 && j === align.length - 1) || (i === align.length - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }

  const format = (mask: number) => {
    // level M is 00
    const data = (0 << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    const bit = (i: number) => ((bits >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6));
    set(8, 8, bit(7));
    set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
    set(8, size - 8, true);
  };
  // the format's places kept before the data is placed (any mask: the same places)
  format(0);
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >>> i) & 1) === 1;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      set(a, b, dark);
      set(b, a, dark);
    }
  }

  // the data, two columns at a time from the right, up and down in turn, past the timing column
  const data = codewords(bytes, version);
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
        if (!fixed[y]![x] && i < data.length * 8) {
          m[y]![x] = ((data[i >>> 3]! >>> (7 - (i & 7))) & 1) === 1;
          i++;
        }
      }
    }
  }

  let best: boolean[][] | undefined;
  let bestScore = Infinity;
  for (let mask = 0; mask < MASKS.length; mask++) {
    const masked = m.map((row, y) => row.map((dark, x) => (!fixed[y]![x] && MASKS[mask]!(x, y) ? !dark : dark)));
    const keep = m.map((row) => row.slice());
    for (let y = 0; y < size; y++) m[y] = masked[y]!;
    format(mask);
    const score = penalty(m);
    if (score < bestScore) {
      bestScore = score;
      best = m.map((row) => row.slice());
    }
    for (let y = 0; y < size; y++) m[y] = keep[y]!;
  }
  return best!;
}

const QUIET = 4;

/**
 * An SVG of the QR code: black modules on white with the quiet zone, a viewBox and no size of its own (the page sizes
 * it), nothing but a rectangle and a path — no script, no link, no text.
 */
export function qrSvg(text: string): string {
  const m = qrMatrix(text);
  const n = m.length + 2 * QUIET;
  const parts: string[] = [];
  for (let y = 0; y < m.length; y++) {
    for (let x = 0; x < m.length; ) {
      if (!m[y]![x]) {
        x++;
        continue;
      }
      let run = 1;
      while (x + run < m.length && m[y]![x + run]) run++;
      parts.push(`M${x + QUIET} ${y + QUIET}h${run}v1h-${run}z`);
      x += run;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#fff"/><path fill="#000" d="${parts.join("")}"/></svg>\n`;
}

/**
 * The QR code for a terminal: two rows of modules in a line of half blocks, black on bright white whatever the
 * terminal's colours (a light code on dark is not read by every camera), the quiet zone around.
 */
export function qrTerminal(text: string): string {
  const m = qrMatrix(text);
  const n = m.length + 2 * QUIET;
  const dark = (x: number, y: number) => x >= QUIET && y >= QUIET && x < n - QUIET && y < n - QUIET && m[y - QUIET]![x - QUIET]!;
  const lines: string[] = [];
  for (let y = 0; y < n; y += 2) {
    let line = "";
    for (let x = 0; x < n; x++) {
      const top = dark(x, y);
      const bottom = y + 1 < n && dark(x, y + 1);
      line += top && bottom ? "█" : top ? "▀" : bottom ? "▄" : " ";
    }
    lines.push(`\x1b[30;107m${line}\x1b[0m`);
  }
  return lines.join("\n");
}
