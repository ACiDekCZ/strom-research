// Finding where entries already read are on their scans (the clips of old
// sources): a reader looks at each image with a grid and says where the entry
// is; strom cuts that out and a second reader checks the cut-out shows the
// whole entry, and that entry. Only what passes the check becomes a clip.
// Readers never write to the research; strom does, from their reports.

import type { Region } from "./model.ts";

export interface ClipJob {
  source: string;
  title: string;
  /** Where in the book, when it was recorded, who it names. */
  facts: string[];
  /** The words read in it (the start of the transcript). */
  words?: string | undefined;
  images: { media: string; view: string }[];
}

export interface CheckJob {
  source: string;
  title: string;
  words?: string | undefined;
  media: string;
  view: string;
}

const RULES = `You are a READER for a genealogical research. You are not the researcher: you do not decide
anything and you do not write anywhere except your report file. Do not run any commands.`;

export function locatePrompt(jobs: ClipJob[], report: string): string {
  return `${RULES}

Each entry below was read earlier from the image(s) named with it. Open each image (one at a time,
in this order), find that entry on it, and say where it is. The images carry a grid of tenths with
labels (0.1 … 0.9 across and down): read the position off it, to hundredths.

THE ENTRIES
${jobs
  .map((j) =>
    [
      `### ${j.source} — ${j.title}`,
      ...j.facts,
      j.words ? `words: ${j.words}` : undefined,
      ...j.images.map((i) => `image ${i.media}: ${i.view}`),
    ]
      .filter(Boolean)
      .join("\n"),
  )
  .join("\n\n")}

THE REPORT
Write your report to ${report} AS YOU GO — after every entry, not at the end. For each entry and image:

## <S… id> · <M… id>
result: found | nothing | unclear | many
region: x,y,w,h

x,y is the top left corner, w,h the width and height — all as fractions of the whole image (0–1).
The region holds the whole entry: every column of its row or rows, its notes in the margin — rather
a little generous than cut, and no more of the entries above and below than it has to. An entry
that runs over to the next page: a block for each image. "nothing" when the entry is not on the
image, "unclear" when you cannot tell which one it is — never a guess. "many" when it is not one entry
at all but a search over many entries or pages (a section read through, a whole book, "not found in
…", a description of the book): no region then — a page picked out of many would show nothing of it.
The words "result", "found", "nothing", "unclear", "many" and "region" stay in English: strom reads them.
When all are done, finish with one line: "done: <n> entries".`;
}

export function checkPrompt(jobs: CheckJob[], report: string): string {
  return `${RULES}

Each file below is a cut-out of a scan that should show one entry of a register. Open each (one at
a time, in this order) and check it against what the entry says.

THE CUT-OUTS
${jobs.map((j) => [`### ${j.source} · ${j.media} — ${j.title}`, j.words ? `words: ${j.words}` : undefined, `cut-out: ${j.view}`].filter(Boolean).join("\n")).join("\n\n")}

THE REPORT
Write your report to ${report} AS YOU GO. For each cut-out:

## <S… id> · <M… id>
verdict: ok | cut | wrong
missing: top, bottom, left, right (only with cut: the sides where a part of the entry is cut off)
why: a few words

ok: the entry is there whole (a little of its neighbours does not matter). cut: it is there, but a
part of it is missing — strom cuts it out wider on those sides and asks again. wrong: another entry,
or none. The words "verdict", "ok", "cut", "wrong", "missing", "top", "bottom", "left" and "right"
stay in English: strom reads them.
When all are done, finish with one line: "done: <n> cut-outs".`;
}

export interface Located {
  source: string;
  media: string;
  result: "found" | "nothing" | "unclear" | "many";
  region?: Region;
}

/** The blocks of a report: "## S0012 · M0034" and its lines. */
function blocks(text: string): { source: string; media: string; body: string }[] {
  const out: { source: string; media: string; body: string }[] = [];
  for (const b of text.split(/^##\s+/m).slice(1)) {
    const head = b.split("\n")[0] ?? "";
    const source = /\b(S\d{4,})\b/.exec(head)?.[1];
    const media = /\b(M\d{4,})\b/.exec(head)?.[1];
    if (source && media) out.push({ source, media, body: b });
  }
  return out;
}

export function parseLocated(text: string): Located[] {
  return blocks(text).map(({ source, media, body }) => {
    const r = /^result:\s*(\p{L}+)/imu.exec(body)?.[1]?.toLowerCase();
    const result = r === "found" ? "found" : r === "nothing" ? "nothing" : r === "many" ? "many" : "unclear";
    const nums = /^region:\s*([\d.]+)\s*[,;\s]\s*([\d.]+)\s*[,;\s]\s*([\d.]+)\s*[,;\s]\s*([\d.]+)/im.exec(body)?.slice(1).map(Number);
    const ok = nums && nums.every((n) => Number.isFinite(n) && n >= 0 && n <= 1) && nums[2]! > 0.005 && nums[3]! > 0.003;
    if (result !== "found" || !ok) return { source, media, result: result === "found" ? "unclear" : result };
    const [x, y, w, h] = nums!;
    return { source, media, result, region: { x: x!, y: y!, w: Math.min(w!, 1 - x!), h: Math.min(h!, 1 - y!) } };
  });
}

export type Side = "top" | "bottom" | "left" | "right";

export interface Checked {
  source: string;
  media: string;
  verdict: "ok" | "cut" | "wrong";
  /** With cut: where a part of the entry is cut off (none said: all round). */
  missing?: Side[];
  why?: string;
}

export function parseChecked(text: string): Checked[] {
  return blocks(text).map(({ source, media, body }) => {
    const v = /^verdict:\s*(\p{L}+)/imu.exec(body)?.[1]?.toLowerCase();
    const why = /^why:\s*(.+)$/im.exec(body)?.[1]?.trim();
    const sides = (/^missing:\s*(.+)$/im.exec(body)?.[1] ?? "").toLowerCase().match(/\b(top|bottom|left|right)\b/g) as Side[] | null;
    const verdict = v === "ok" ? "ok" : v === "cut" ? "cut" : "wrong";
    return { source, media, verdict, ...(verdict === "cut" && sides?.length ? { missing: [...new Set(sides)] } : {}), ...(why ? { why } : {}) };
  });
}

/** A region cut out wider where the check found the entry cut off: half as much again on each such side (all round when none was said). */
export function widen(r: Region, missing: Side[] | undefined): Region {
  const sides = missing?.length ? missing : (["top", "bottom", "left", "right"] as Side[]);
  const dx = Math.max(0.02, r.w * 0.5);
  const dy = Math.max(0.02, r.h * 0.5);
  let [x0, y0, x1, y1] = [r.x, r.y, r.x + r.w, r.y + r.h];
  if (sides.includes("left")) x0 -= dx;
  if (sides.includes("right")) x1 += dx;
  if (sides.includes("top")) y0 -= dy;
  if (sides.includes("bottom")) y1 += dy;
  const f = (n: number) => Math.min(1, Math.max(0, n));
  const k = (n: number) => Math.round(n * 1e4) / 1e4;
  [x0, y0, x1, y1] = [f(x0), f(y0), f(x1), f(y1)];
  return { x: k(x0), y: k(y0), w: k(x1 - x0), h: k(y1 - y0) };
}
