// Page ↔ image calibration of a record set.

import type { Calibration, RecordSet } from "./model.ts";

/** Fit page = a·image + b to numeric calibration points. */
export function fitCalibration(points: Calibration[]): { a: number; b: number; maxError: number } | undefined {
  const num = points.map((p) => ({ x: p.image, y: Number.parseInt(p.page, 10) })).filter((p) => Number.isFinite(p.y));
  if (num.length < 2) return undefined;
  const n = num.length;
  const mx = num.reduce((s, p) => s + p.x, 0) / n;
  const my = num.reduce((s, p) => s + p.y, 0) / n;
  const sxx = num.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  if (sxx === 0) return undefined;
  const a = num.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) / sxx;
  const b = my - a * mx;
  const maxError = Math.max(...num.map((p) => Math.abs(a * p.x + b - p.y)));
  return { a, b, maxError };
}


export function calibrationLine(b: RecordSet): string | undefined {
  if (b.calibration.length === 0) return undefined;
  const fit = fitCalibration(b.calibration);
  const pts = b.calibration.map((c) => `${c.image}→${c.page}`).join(" ");
  if (!fit) return `calibration ${pts}`;
  const formula = `page ≈ ${+fit.a.toFixed(3)}·image ${fit.b >= 0 ? "+" : "−"} ${Math.abs(+fit.b.toFixed(2))}`;
  const quality = fit.maxError < 0.51 ? "consistent" : `INCONSISTENT (off by up to ${fit.maxError.toFixed(1)} — the book is not linear; measure, do not compute)`;
  return `calibration ${pts} · ${formula} · ${quality}`;
}


/** The page on an image: measured, or computed from a consistent calibration ("≈"). */
export function pageOf(b: RecordSet, image: number): string | undefined {
  const exact = b.calibration.find((c) => c.image === image);
  if (exact) return exact.page;
  const fit = fitCalibration(b.calibration);
  if (!fit || fit.maxError >= 0.51) return undefined;
  return `≈${Math.round(fit.a * image + fit.b)}`;
}

/** The image a page is on, from a consistent calibration (undefined when the book is not linear). */
export function imageOf(b: RecordSet, page: number): number | undefined {
  const exact = b.calibration.find((c) => Number.parseInt(c.page, 10) === page);
  if (exact) return exact.image;
  const fit = fitCalibration(b.calibration);
  if (!fit || fit.maxError >= 0.51 || fit.a === 0) return undefined;
  return Math.round((page - fit.b) / fit.a);
}
