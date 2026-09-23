// Readers: an agent with a clean context that looks at a batch of images and
// writes down what is on them — and nothing else. The main researcher gets
// back a short report instead of a context full of images.
//
// From measurements in earlier research: an image stays in the context of whoever
// opened it and is paid for on every later turn, so the cost of a reader grows
// with the square of its batch; ten images per reader cost a third per image
// of fifty. Readers never write to the research; the researcher records what
// they found (and what they did not: a search "by reader").

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
}

export interface Finding {
  image: string;
  result: "found" | "nothing" | "unclear";
}

/** Split into batches of at most `size` images (never more than BATCH_MAX). */
export function batches<T>(items: T[], size = BATCH): T[][] {
  const n = Math.max(1, Math.min(BATCH_MAX, size));
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n));
  return out;
}

export function readerPrompt(o: { question: string; images: ReaderImage[]; report: string; lang: string; context?: string | undefined; blind?: boolean }): string {
  return `You are a READER for a genealogical research. You are not the researcher: you do not decide
anything and you do not write anywhere except your report file. Do not run any commands.

THE QUESTION
${o.question}
${o.context ? `\nWhat the researcher knows (to recognise the family — never to fill in what you cannot read):\n${o.context}\n` : ""}${o.blind ? "\nThis is a BLIND reading: transcribe what is written, exactly; do not interpret or complete names from expectations.\n" : ""}
THE IMAGES (open each file with your image reader, one at a time, in this order)
${o.images
  .map((i) => {
    const head = `- ${i.id}${i.image !== undefined ? ` · image ${i.image}` : ""}${i.page ? ` · page ${i.page}` : ""}`;
    return i.parts?.length
      ? `${head} — ${i.parts.length} overlapping parts at full resolution, read them together:\n${i.parts.map((p) => `    ${p.label}: ${p.view}`).join("\n")}`
      : `${head}: ${i.view}`;
  })
  .join("\n")}

THE REPORT
Write your report to ${o.report} AS YOU GO — after every image, not at the end.
For every image, this block (in ${o.lang === "en" ? "English" : `the research language (${o.lang})`}; transcriptions in the language of the record;
the words "Image", "result", "found", "nothing", "unclear" and "done" stay in English — strom reads them):

## Image <image number> · <M… id>
result: found | nothing | unclear
entries: every entry that answers the question — word for word as written (the original
  language and spelling), with the column it stands in: date, house, names, parents,
  godparents/witnesses, remarks; one entry per line
illegible: what you could not read, and where
hand: the writing (ink, script, language, abbreviations)
certainty: for each name in an entry, how sure you are (%)

"nothing" is a valid and valuable result: say what you checked. "Illegible" beats a guess.
When all images are done, finish with one line: "done: <n> images, found on <image numbers or none>".`;
}

/** The result of each image in a report ("## Image 114 · M0012" … "result: found"). */
export function parseReport(text: string): Finding[] {
  const out: Finding[] = [];
  const blocks = text.split(/^##\s+/m).slice(1);
  for (const b of blocks) {
    const head = b.split("\n")[0] ?? "";
    const id = /\b(M\d{4,})\b/.exec(head)?.[1] ?? /Image\s+(\d+)/i.exec(head)?.[1];
    if (!id) continue;
    const r = /^result:\s*(\p{L}+)/imu.exec(b)?.[1]?.toLowerCase();
    out.push({ image: id, result: r === "found" ? "found" : r === "nothing" ? "nothing" : "unclear" });
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
