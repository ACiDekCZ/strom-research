// Raster images in memory and what is done with scans: crop, scale, contrast,
// rotation, a grid to point at places. Pure TypeScript, no dependencies —
// the codecs are in jpeg.ts and png.ts.

export interface RawImage {
  width: number;
  height: number;
  /** 1 = grey, 3 = RGB (8 bits each, row by row). */
  channels: 1 | 3;
  data: Uint8Array;
}

export function blank(width: number, height: number, channels: 1 | 3, value = 255): RawImage {
  return { width, height, channels, data: new Uint8Array(width * height * channels).fill(value) };
}

/** Cut out a rectangle (clamped to the image). */
export function crop(img: RawImage, x: number, y: number, w: number, h: number): RawImage {
  const x0 = Math.max(0, Math.min(img.width - 1, Math.round(x)));
  const y0 = Math.max(0, Math.min(img.height - 1, Math.round(y)));
  const cw = Math.max(1, Math.min(img.width - x0, Math.round(w)));
  const ch = Math.max(1, Math.min(img.height - y0, Math.round(h)));
  const c = img.channels;
  const out = new Uint8Array(cw * ch * c);
  for (let row = 0; row < ch; row++) {
    const from = ((y0 + row) * img.width + x0) * c;
    out.set(img.data.subarray(from, from + cw * c), row * cw * c);
  }
  return { width: cw, height: ch, channels: c, data: out };
}

/** Resize to w × h: area averaging when shrinking (no aliasing on fine script), bilinear when enlarging. */
export function resize(img: RawImage, w: number, h: number): RawImage {
  w = Math.max(1, Math.round(w));
  h = Math.max(1, Math.round(h));
  if (w === img.width && h === img.height) return img;
  const c = img.channels;
  const out = new Uint8Array(w * h * c);
  const sx = img.width / w;
  const sy = img.height / h;
  if (sx >= 1 && sy >= 1) {
    // Each output pixel is the mean of the source area it covers (with fractional edges).
    const acc = new Float64Array(c);
    for (let oy = 0; oy < h; oy++) {
      const fy0 = oy * sy;
      const fy1 = fy0 + sy;
      for (let ox = 0; ox < w; ox++) {
        const fx0 = ox * sx;
        const fx1 = fx0 + sx;
        acc.fill(0);
        let total = 0;
        for (let yy = Math.floor(fy0); yy < Math.min(img.height, Math.ceil(fy1)); yy++) {
          const wy = Math.min(fy1, yy + 1) - Math.max(fy0, yy);
          for (let xx = Math.floor(fx0); xx < Math.min(img.width, Math.ceil(fx1)); xx++) {
            const wgt = wy * (Math.min(fx1, xx + 1) - Math.max(fx0, xx));
            const p = (yy * img.width + xx) * c;
            for (let k = 0; k < c; k++) acc[k]! += img.data[p + k]! * wgt;
            total += wgt;
          }
        }
        const o = (oy * w + ox) * c;
        for (let k = 0; k < c; k++) out[o + k] = Math.round(acc[k]! / total);
      }
    }
    return { width: w, height: h, channels: c, data: out };
  }
  for (let oy = 0; oy < h; oy++) {
    const fy = Math.max(0, Math.min(img.height - 1, (oy + 0.5) * sy - 0.5));
    const y0 = Math.floor(fy);
    const y1 = Math.min(img.height - 1, y0 + 1);
    const ty = fy - y0;
    for (let ox = 0; ox < w; ox++) {
      const fx = Math.max(0, Math.min(img.width - 1, (ox + 0.5) * sx - 0.5));
      const x0 = Math.floor(fx);
      const x1 = Math.min(img.width - 1, x0 + 1);
      const tx = fx - x0;
      const o = (oy * w + ox) * c;
      for (let k = 0; k < c; k++) {
        const a = img.data[(y0 * img.width + x0) * c + k]!;
        const b = img.data[(y0 * img.width + x1) * c + k]!;
        const d = img.data[(y1 * img.width + x0) * c + k]!;
        const e = img.data[(y1 * img.width + x1) * c + k]!;
        out[o + k] = Math.round((a * (1 - tx) + b * tx) * (1 - ty) + (d * (1 - tx) + e * tx) * ty);
      }
    }
  }
  return { width: w, height: h, channels: c, data: out };
}

export function toRgb(img: RawImage): RawImage {
  if (img.channels === 3) return img;
  const out = new Uint8Array(img.width * img.height * 3);
  for (let i = 0, p = 0; i < img.data.length; i++, p += 3) out[p] = out[p + 1] = out[p + 2] = img.data[i]!;
  return { width: img.width, height: img.height, channels: 3, data: out };
}

/** Put a picture into another at x, y (its top left corner), clipped at the edges; same channels. */
export function paste(into: RawImage, img: RawImage, x: number, y: number): void {
  const c = into.channels;
  const x0 = Math.max(0, x);
  const x1 = Math.min(into.width, x + img.width);
  if (x1 <= x0) return;
  for (let row = Math.max(0, y); row < Math.min(into.height, y + img.height); row++) {
    const from = ((row - y) * img.width + (x0 - x)) * c;
    into.data.set(img.data.subarray(from, from + (x1 - x0) * c), (row * into.width + x0) * c);
  }
}

export function toGrey(img: RawImage): RawImage {
  if (img.channels === 1) return img;
  const out = new Uint8Array(img.width * img.height);
  for (let i = 0, p = 0; i < out.length; i++, p += 3) out[i] = Math.round(0.299 * img.data[p]! + 0.587 * img.data[p + 1]! + 0.114 * img.data[p + 2]!);
  return { width: img.width, height: img.height, channels: 1, data: out };
}

/**
 * Stretch the contrast between two percentiles of brightness. Done on the
 * part being read, never on the whole scan (a dark margin would flatten the
 * ink of the column — a lesson from reading faded registers).
 */
export function stretch(img: RawImage, lowPct = 1, highPct = 99): RawImage {
  const c = img.channels;
  const hist = new Uint32Array(256);
  const n = img.width * img.height;
  for (let i = 0; i < n; i++) {
    const p = i * c;
    const lum = c === 1 ? img.data[p]! : Math.round(0.299 * img.data[p]! + 0.587 * img.data[p + 1]! + 0.114 * img.data[p + 2]!);
    hist[lum]!++;
  }
  const at = (pct: number) => {
    let acc = 0;
    // at least one pixel: 0 % is the darkest value present, 100 % the lightest
    const target = Math.max(1, Math.ceil((pct / 100) * n));
    for (let v = 0; v < 256; v++) {
      acc += hist[v]!;
      if (acc >= target) return v;
    }
    return 255;
  };
  const lo = at(lowPct);
  const hi = Math.max(lo + 1, at(highPct));
  const map = new Uint8Array(256);
  for (let v = 0; v < 256; v++) map[v] = Math.max(0, Math.min(255, Math.round(((v - lo) * 255) / (hi - lo))));
  const out = new Uint8Array(img.data.length);
  for (let i = 0; i < out.length; i++) out[i] = map[img.data[i]!]!;
  return { ...img, data: out };
}

/** Rotate by 90, 180 or 270 degrees clockwise. */
export function rotate(img: RawImage, degrees: 90 | 180 | 270): RawImage {
  const { width: w, height: h, channels: c } = img;
  const nw = degrees === 180 ? w : h;
  const nh = degrees === 180 ? h : w;
  const out = new Uint8Array(img.data.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [nx, ny] = degrees === 90 ? [h - 1 - y, x] : degrees === 180 ? [w - 1 - x, h - 1 - y] : [y, w - 1 - x];
      const s = (y * w + x) * c;
      const d = (ny * nw + nx) * c;
      for (let k = 0; k < c; k++) out[d + k] = img.data[s + k]!;
    }
  return { width: nw, height: nh, channels: c, data: out };
}

/** 3×5 pixel digits for grid labels. */
const DIGITS = ["111101101101111", "010110010010111", "111001111100111", "111001111001111", "101101111001001", "111100111001111", "111100111101111", "111001001001001", "111101111101111", "111101111001111"];

function label(img: RawImage, text: string, x: number, y: number, scale: number): void {
  const c = img.channels;
  const put = (px: number, py: number, v: number[]) => {
    if (px < 0 || py < 0 || px >= img.width || py >= img.height) return;
    const p = (py * img.width + px) * c;
    for (let k = 0; k < c; k++) img.data[p + k] = v[k] ?? v[0]!;
  };
  const fg = c === 3 ? [200, 0, 0] : [0];
  const bg = [255, 255, 255];
  const cw = 4 * scale;
  // white box behind, so the digits stay readable on ink
  for (let py = y - scale; py < y + 6 * scale; py++) for (let px = x - scale; px < x + text.length * cw; px++) put(px, py, bg);
  [...text].forEach((ch, i) => {
    const bits = DIGITS[Number(ch)];
    if (!bits) return;
    for (let r = 0; r < 5; r++)
      for (let col = 0; col < 3; col++)
        if (bits[r * 3 + col] === "1")
          for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) put(x + i * cw + col * scale + dx, y + r * scale + dy, fg);
  });
}

/**
 * A grid of tenths with labels 0–10 along the edges: the agent reads off where
 * something is ("x 0.3–0.5, y 0.6–0.7") and asks for exactly that crop.
 */
export function grid(img: RawImage, parts = 10): RawImage {
  const out = { ...img, data: new Uint8Array(img.data) };
  const c = out.channels;
  const line = c === 3 ? [220, 0, 0] : [0];
  const scale = Math.max(1, Math.round(Math.min(img.width, img.height) / 400));
  const put = (x: number, y: number) => {
    const p = (y * out.width + x) * c;
    for (let k = 0; k < c; k++) out.data[p + k] = line[k] ?? line[0]!;
  };
  for (let i = 1; i < parts; i++) {
    const x = Math.round((i * out.width) / parts);
    const y = Math.round((i * out.height) / parts);
    for (let yy = 0; yy < out.height; yy += i % 5 === 0 ? 1 : 2) for (let t = 0; t < (i % 5 === 0 ? scale + 1 : scale); t++) if (x + t < out.width) put(x + t, yy);
    for (let xx = 0; xx < out.width; xx += i % 5 === 0 ? 1 : 2) for (let t = 0; t < (i % 5 === 0 ? scale + 1 : scale); t++) if (y + t < out.height) put(xx, y + t);
  }
  for (let i = 0; i <= parts; i++) {
    const x = Math.min(out.width - 8 * scale, Math.round((i * out.width) / parts) + 2 * scale);
    const y = Math.min(out.height - 8 * scale, Math.round((i * out.height) / parts) + 2 * scale);
    label(out, String(i), x, 2 * scale, scale);
    label(out, String(i), 2 * scale, y, scale);
  }
  return out;
}
