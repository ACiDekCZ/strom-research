// Readers: an agent with a clean context that looks at a batch of images and
// writes down what is on them — and nothing else. The main researcher gets
// back a short report instead of a context full of images.
//
// From measurements in earlier research: an image stays in the context of whoever
// opened it and is paid for on every later turn, so the cost of a reader grows
// with the square of its batch; ten images per reader cost a third per image
// of fifty. Readers never write to the research; the researcher records what
// they found (and what they did not: a search "by reader").

import { foldText } from "./text.ts";

export const BATCH = 10;
export const BATCH_MAX = 12;

export interface ReaderImage {
  /** M0012 */
  id: string;
  image?: number | undefined;
  page?: string | undefined;
  /** Absolute path of the view to open. */
  view: string;
  /** A region too big for one look: its overlapping parts at full resolution. */
  parts?: { label: string; view: string }[];
  /** The parts are the left and right half of a double page (each page sharper than the whole image in one view). */
  halves?: boolean;
}

/** How many views a reader opens for an image. */
export function viewCount(i: Pick<ReaderImage, "parts">): number {
  return i.parts?.length || 1;
}

export interface Finding {
  /** The M… id of the block's head, else its image number (as before). */
  image: string;
  result: "found" | "nothing" | "unclear";
  /** The image number of the head ("## Image 57 · M0012"). */
  number?: number | undefined;
  media?: string | undefined;
  /** Each entry the reader wrote, one per line, as written. */
  entries?: string[];
  /** What the reader could not read — also in a "nothing" block, where a possible match may hide. */
  illegible?: string[];
  certainty?: string[];
  hand?: string[];
  /** The page numbers written on the image. */
  pages?: string | undefined;
  /** A jump in the page numbering, pages missing before this image. */
  gaps?: string[];
  /** Another part of the book begins here (place, year, kind of record). */
  section?: string[];
  /** The block as the reader wrote it (without its "## " head). */
  text: string;
}

/**
 * Split into batches of at most `size` views (never more than BATCH_MAX): what a reader opens stays in its context,
 * so a double page read as its two halves counts twice. An image of more views than that is a batch of its own.
 */
export function batches<T>(items: T[], size = BATCH, views: (item: T) => number = () => 1): T[][] {
  const n = Math.max(1, Math.min(BATCH_MAX, size));
  const out: T[][] = [];
  let open: T[] = [];
  let count = 0;
  for (const item of items) {
    const v = Math.max(1, views(item));
    if (open.length && count + v > n) {
      out.push(open);
      open = [];
      count = 0;
    }
    open.push(item);
    count += v;
  }
  if (open.length) out.push(open);
  return out;
}

export function readerPrompt(o: { question: string; images: ReaderImage[]; report: string; lang: string; context?: string | undefined; blind?: boolean }): string {
  return `You are a READER for a genealogical research. You are not the researcher: you do not decide
anything and you do not write anywhere except your report file. Do not run any commands.

THE QUESTION
${o.question}
${o.context ? `\nWhat the researcher knows (to recognise the family — never to fill in what you cannot read):\n${o.context}\n` : ""}${o.blind ? "\nThis is a BLIND reading: transcribe what is written, exactly; do not interpret or complete names from expectations.\n" : ""}
THE IMAGES (open each file with your image reader, one at a time, in this order)
${o.images.some((i) => i.halves) ? "A double page comes as its two halves, each sharper than the whole image; they overlap at the gutter. An entry may\nrun across both pages: read the two halves of an image together, line by line, and write one block for the image.\n" : ""}${o.images
  .map((i) => {
    const head = `- ${i.id}${i.image !== undefined ? ` · image ${i.image}` : ""}${i.page ? ` · page ${i.page}` : ""}`;
    if (i.parts?.length && i.halves)
      return `${head} — a double page in two halves:\n${i.parts.map((p) => `    ${p.label}: ${p.view}`).join("\n")}`;
    return i.parts?.length
      ? `${head} — ${i.parts.length} overlapping parts at full resolution, read them together:\n${i.parts.map((p) => `    ${p.label}: ${p.view}`).join("\n")}`
      : `${head}: ${i.view}`;
  })
  .join("\n")}

THE REPORT
Write your report to ${o.report} AS YOU GO — after every image, not at the end. Its first lines are
strom's: keep them as they are and write below them.
For every image, this block (in ${o.lang === "en" ? "English" : `the research language (${o.lang})`}; transcriptions in the language of the record;
the words "Image", "result", "found", "nothing", "unclear", "entries", "illegible", "hand", "certainty", "pages",
"gaps", "section" and "done" stay in English — strom reads them):

## Image <image number> · <M… id>
result: found | nothing | unclear
entries: every entry that answers the question — word for word as written (the original
  language and spelling), where it stands (left/right page, which entry from the top) and the
  column it stands in: date, house, names, parents, godparents/witnesses, remarks; one entry per line
illegible: what you could not read, and where (leave the line out when everything was legible)
hand: the writing (ink, script, language, abbreviations)
certainty: for each name in an entry, how sure you are (%)
pages: the page number(s) written on the image, as written (leave the line out when there is none)
gaps: only when pages are missing before this image — the numbering jumps, a page is cut out or
  left blank: what you see, e.g. "pages 87–94 missing: 86 is followed by 95"
section: only when another part of the book begins on this image (another place, year or kind
  of record): what it is

"unclear" is for a possible match you cannot confirm: a name you cannot read while the other
details fit (age, house, date, parents), or a name you are not sure of. Write it as an entry, with
where it stands and why it might answer the question — never hide it inside a "nothing" block.
"nothing" is a valid and valuable result: say what you checked. "Illegible" beats a guess.
When all images are done, finish with one line: "done: <n> images, found on <image numbers or none>".`;
}

const FIELDS = ["result", "entries", "illegible", "hand", "certainty", "pages", "gaps", "section"] as const;
type Field = (typeof FIELDS)[number];
const LIST_FIELDS = ["entries", "illegible", "certainty", "hand", "gaps", "section"] as const;
/** "result: found", "- **illegible:** …" — a field of a block; its key stays English in every language. */
const FIELD = /^\s*(?:[-*]\s+)?\**(\p{L}+)\**\s*:\**\s*(.*)$/u;

/** Words a reader writes for "nothing here" (any language strom speaks, and some more). */
const NONE = new Set(["none", "nothing", "no", "na", "n", "nil", "nic", "zadne", "zadny", "zadna", "neni", "nichts", "kein", "keine", "keiner", "keines", "brak", "nie", "nema", "nemam", "нет", "ничего", "немає", "нема", "ninguno", "nada", "aucun", "rien", "nessuno", "niente"]);
const LEGIBLE = /^(?:(?:all|everything|fully|vse|vsechno|alles|komplett|uplne|wszystko|все)\s+)?(?:(?:is|je|ist|jest)\s+)?(?:gut\s+)?(?:legible|readable|citelne|citelny|lesbar|czytelne|читаемо|разборчиво)$/u;

/** A value that says nothing: "—", "none", "nic", "all legible", "none — everything legible". */
export function saysNothing(v: string): boolean {
  const folded = foldText(v).replace(/[^\p{L}\p{N}\s]+/gu, " ").replace(/\s+/g, " ").trim();
  if (!folded) return true;
  const words = folded.split(" ");
  if (NONE.has(words[0]!) && words.length <= 4) return true;
  return LEGIBLE.test(folded);
}

/**
 * Each image's block of a report ("## Image 114 · M0012" … "result: found"): its result, and what the reader
 * wrote of it — entries, what was illegible, how sure, the pages and gaps of the book. Reports written before
 * the fields pages/gaps/section existed read the same; a field a report lacks is simply absent.
 */
export function parseReport(text: string): Finding[] {
  const out: Finding[] = [];
  const blocks = text.split(/^##\s+/m).slice(1);
  for (const b of blocks) {
    const [head = "", ...body] = b.split("\n");
    const media = /\b(M\d{4,})\b/.exec(head)?.[1];
    const num = /Image\s+(\d+)/i.exec(head)?.[1];
    const id = media ?? num;
    if (!id) continue;
    const fields = new Map<Field, string[]>();
    let at: Field | undefined;
    for (const line of body) {
      const m = FIELD.exec(line);
      const key = m?.[1]?.toLowerCase() as Field | undefined;
      if (m && key && (FIELDS as readonly string[]).includes(key)) {
        at = key;
        const list = fields.get(key) ?? [];
        if (m[2]!.trim()) list.push(m[2]!.trim());
        fields.set(key, list);
      } else if (at && line.trim() && !/^done:/i.test(line.trim())) fields.get(at)!.push(line.trim().replace(/^[-*•]\s+/u, ""));
    }
    const r = /^\s*(?:[-*]\s+)?\**result\**\s*:\**\s*(\p{L}+)/imu.exec(b)?.[1]?.toLowerCase();
    const finding: Finding = { image: id, result: r === "found" ? "found" : r === "nothing" ? "nothing" : "unclear", text: b.replace(/\s+$/, "") };
    if (num !== undefined) finding.number = Number(num);
    if (media) finding.media = media;
    for (const k of LIST_FIELDS) {
      const v = (fields.get(k) ?? []).filter((x) => !saysNothing(x));
      if (v.length) finding[k] = v;
    }
    const pages = (fields.get("pages") ?? []).join(" ").trim();
    if (pages && !saysNothing(pages)) finding.pages = pages;
    out.push(finding);
  }
  return out;
}

/** Claude Code settings for a reader: it may read these views and write its report — nothing else. */
export function readerSettings(views: string[], report: string, toPermission: (p: string) => string): Record<string, unknown> {
  return {
    permissions: {
      allow: [...views.map((v) => `Read(${toPermission(v)})`), `Write(${toPermission(report)})`, `Edit(${toPermission(report)})`],
      deny: ["Bash", "WebFetch", "WebSearch"],
    },
  };
}
