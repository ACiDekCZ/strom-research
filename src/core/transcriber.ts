// Transcripts of entries already on their scans (sources with a clip and no
// words — read before strom asked for them, or brought in from an older
// research): a reader writes the entry's words from its cut-out, a second
// reader holds them against the same cut-out. Readers never write to the
// research; strom does, from their reports.

export interface TranscribeJob {
  source: string;
  title: string;
  /** Where in the book, when, who it names — to know which entry it is. */
  facts: string[];
  /** The cut-outs of the entry (an entry over a page break: two). */
  views: { media: string; view: string }[];
}

export interface TranscriptCheckJob extends TranscribeJob {
  transcript: string;
}

const RULES = `You are a READER for a genealogical research. You are not the researcher: you do not decide
anything and you do not write anywhere except your report file. Do not run any commands.`;

const HOW = `The words as they stand in the record: its own language and script (Latin, German, Czech … —
never translated), its spelling, abbreviations as written, capitals as written; line by line as the
entry runs; a table's columns in their order, separated by " | ". A letter you cannot read: [?]; a
word: [...]; a word you read but are unsure of: the word and [?] after it. Only this entry — not the
one above or below it, even when a part of it shows in the cut-out.`;

const block = (j: TranscribeJob) => [`### ${j.source} — ${j.title}`, ...j.facts, ...j.views.map((v) => `cut-out ${v.media}: ${v.view}`)].join("\n");

export function transcribePrompt(jobs: TranscribeJob[], report: string): string {
  return `${RULES}

Each entry below is cut out of its scan (the cut-out file named with it). Open each (one at a time, in
this order) and write the entry's words. ${HOW}

THE ENTRIES
${jobs.map(block).join("\n\n")}

THE REPORT
Write your report to ${report} AS YOU GO — after every entry, not at the end:

## <S… id>
result: read | unreadable | other
transcript:
<the words, line by line>

"unreadable": you cannot read it; "other": the cut-out does not show this entry. The words "result",
"read", "unreadable", "other" and "transcript" stay in English: strom reads them.
When all are done, finish with one line: "done: <n> entries".`;
}

export function checkTranscriptPrompt(jobs: TranscriptCheckJob[], report: string): string {
  return `${RULES}

Each entry below is cut out of its scan, with the words another reader wrote from it. Open each cut-out
(one at a time, in this order) and hold the words against it, word by word. ${HOW}

THE ENTRIES
${jobs.map((j) => `${block(j)}\nwords read:\n${j.transcript}`).join("\n\n")}

THE REPORT
Write your report to ${report} AS YOU GO:

## <S… id>
verdict: ok | fixed | wrong
transcript:
<with fixed: the words as they should be, whole; with ok and wrong: nothing>
why: a few words

ok: the words are right (a [?] where the image is unclear is fine). fixed: a word or more was wrong or
missing — write the whole corrected transcript. wrong: the words are of another entry, or made up.
The words "verdict", "ok", "fixed", "wrong", "transcript" and "why" stay in English: strom reads them.
When all are done, finish with one line: "done: <n> entries".`;
}

/** The blocks of a report: "## S0012" and what follows it. */
function blocks(text: string): { source: string; body: string }[] {
  const out: { source: string; body: string }[] = [];
  for (const b of text.split(/^##\s+/m).slice(1)) {
    const source = /\b(S\d{4,})\b/.exec(b.split("\n")[0] ?? "")?.[1];
    if (source) out.push({ source, body: b.slice(b.indexOf("\n") + 1) });
  }
  return out;
}

/** The transcript lines of a block: after "transcript:", up to a "why:" line or the "done:" line. */
function words(body: string): string | undefined {
  const m = /^transcript:[ \t]*(.*)$/im.exec(body);
  if (!m) return undefined;
  const rest = [m[1] ?? "", ...body.slice(m.index + m[0].length).split("\n")];
  const out: string[] = [];
  for (const l of rest) {
    if (/^(why|verdict|result):/i.test(l.trim()) || /^done:\s*\d+/i.test(l.trim())) break;
    out.push(l.replace(/\s+$/, ""));
  }
  const text = out.join("\n").replace(/^\n+|\n+$/g, "").replace(/^```[a-z]*\n?|\n?```$/g, "");
  return text.trim() ? text.normalize("NFC") : undefined;
}

export function parseTranscribed(text: string): { source: string; result: "read" | "unreadable" | "other"; transcript?: string }[] {
  return blocks(text).map(({ source, body }) => {
    const r = /^result:\s*(\p{L}+)/imu.exec(body)?.[1]?.toLowerCase();
    const transcript = words(body);
    const result = r === "read" && transcript ? "read" : r === "other" ? "other" : "unreadable";
    return { source, result, ...(result === "read" ? { transcript: transcript! } : {}) };
  });
}

export function parseTranscriptChecks(text: string): { source: string; verdict: "ok" | "fixed" | "wrong"; transcript?: string; why?: string }[] {
  return blocks(text).map(({ source, body }) => {
    const v = /^verdict:\s*(\p{L}+)/imu.exec(body)?.[1]?.toLowerCase();
    const why = /^why:\s*(.+)$/im.exec(body)?.[1]?.trim();
    const fixed = words(body);
    const verdict = v === "ok" ? "ok" : v === "fixed" && fixed ? "fixed" : "wrong";
    return { source, verdict, ...(verdict === "fixed" ? { transcript: fixed! } : {}), ...(why ? { why } : {}) };
  });
}
