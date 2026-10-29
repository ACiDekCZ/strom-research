// The images in the log of an agent's session: left out, their size said. Claude Code's stream carries each image an
// agent looks at twice in one line (the tool's result for the model, message…source.data, and for its own record,
// tool_use_result.file.base64 — 650 000 characters each): found 2026-10-27, 16 GB of logs in a week, 95–99 % of them
// images strom keeps anyway (the scans, their views). What is left out is only the image's data inside its JSON string:
// the line stays valid JSON, everything else in it as it was.
//
// One cut for everything that writes or shrinks a log: the runners as each line comes (runLog), strom tidy over a
// closed log of any size, piece by piece (ImageCut): never a regular expression over a huge string (one of 39 MB threw
// "Maximum call stack size exceeded" in the old tidy).

import fs from "node:fs";
import path from "node:path";

/** Shorter runs of base64 stay: a key, a hash, a signature is no image. */
export const IMAGE_MIN = 2048;

/**
 * Where image data begins inside a JSON string: under the keys of Claude Code's stream (source.data, file.base64), the
 * same in a JSON text carried inside a string (escaped), and a data: URL.
 */
const STARTS = ['"data":"', '"data": "', '"base64":"', '"base64": "', '\\"data\\":\\"', '\\"base64\\":\\"', ";base64,"] as const;
const HOLD = Math.max(...STARTS.map((s) => s.length)) - 1;

function isB64(c: number): boolean {
  return (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57) || c === 43 || c === 47 || c === 61;
}

/** A path safe in any JSON string, however deep (no quote, no backslash, no control character). */
function plainPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/"/g, "'").replace(/[\u0000-\u001f\u007f]/g, "");
}

/** What stands in an image's place. */
export function imageMark(chars: number, view?: string): string {
  return `[image ${Math.round((chars * 3) / 4 / 1024)} kB left out${view ? `: ${plainPath(view)}` : ""}]`;
}

/**
 * The image data cut out of a text that comes in pieces (a log read a megabyte at a time, a line split anywhere): each
 * piece's text out as soon as it is known, at most a few characters and the start of a run of base64 held — memory
 * fixed whatever the size of a line or of an image.
 */
export class ImageCut {
  private view: string | undefined;
  private tail = "";
  private inRun = false;
  private held = "";
  private count = 0;

  constructor(view?: string) {
    this.view = view;
  }

  push(text: string): string {
    const s = this.tail + text;
    this.tail = "";
    const out: string[] = [];
    let i = 0;
    const next = new Array<number>(STARTS.length).fill(-2);
    for (;;) {
      if (this.inRun) {
        let j = i;
        while (j < s.length && isB64(s.charCodeAt(j))) j++;
        if (this.held.length < IMAGE_MIN) this.held += s.slice(i, Math.min(j, i + IMAGE_MIN - this.held.length));
        this.count += j - i;
        if (j === s.length) break; // the run goes on in the next piece
        out.push(this.count >= IMAGE_MIN ? imageMark(this.count, this.view) : this.held);
        this.inRun = false;
        this.held = "";
        this.count = 0;
        i = j;
        continue;
      }
      // the nearest start of image data (each start's next place remembered: one pass over the text)
      let at = -1;
      let len = 0;
      for (let k = 0; k < STARTS.length; k++) {
        if (next[k]! !== -1 && next[k]! < i) next[k] = s.indexOf(STARTS[k]!, i);
        const n = next[k]!;
        if (n !== -1 && (at === -1 || n < at)) {
          at = n;
          len = STARTS[k]!.length;
        }
      }
      if (at === -1) {
        // a start may be cut in two by the end of this piece: its first characters held
        const keep = Math.max(i, s.length - HOLD);
        out.push(s.slice(i, keep));
        this.tail = s.slice(keep);
        break;
      }
      out.push(s.slice(i, at + len));
      i = at + len;
      this.inRun = true;
    }
    return out.join("");
  }

  /** What is still held, at the end of the text. */
  end(): string {
    let out = this.tail;
    if (this.inRun) out += this.count >= IMAGE_MIN ? imageMark(this.count, this.view) : this.held;
    this.tail = "";
    this.inRun = false;
    this.held = "";
    this.count = 0;
    return out;
  }
}

/** A text (a line of a log) without its image data, the view it shows named when known. */
export function withoutImages(text: string, view?: string): string {
  const cut = new ImageCut(view);
  return cut.push(text) + cut.end();
}

/** A line small enough to be read for what it names (never an image's line whole). */
const SMALL = 1 << 20;
/** How many calls' files are remembered (a session's recent ones: an image's result follows its call). */
const CALLS = 500;

/**
 * The log of an agent's session written a whole line at a time, its images left out — the view each showed named when
 * the line or the call that read it says it (tool_use_result.file.filePath; the file_path of the call by its id). What
 * the runner reads of the stream it reads from the full line; only the log is without the images.
 */
export class RunLog {
  private file: string;
  private out: string[] = [];
  private files = new Map<string, string>();

  constructor(file: string) {
    this.file = file;
  }

  /** One whole line of the stream (without its newline). */
  line(text: string): void {
    this.out.push(this.cut(text), "\n");
  }

  /** The end of the stream without its newline: written as it is (images out). */
  rest(text: string): void {
    if (text) this.out.push(this.cut(text));
  }

  /** strom's own words in the log, in their place among the lines. */
  note(text: string): void {
    this.out.push(text);
  }

  /** What was given so far, into the log. */
  flush(): void {
    if (!this.out.length) return;
    const text = this.out.join("");
    this.out = [];
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.appendFileSync(this.file, text);
  }

  private cut(text: string): string {
    const bare = withoutImages(text);
    if (bare === text) {
      if (text.length < SMALL && text.includes('"tool_use"')) this.learn(text);
      return text;
    }
    const view = this.viewOf(bare);
    return view ? withoutImages(text, view) : bare;
  }

  /** The files the agent's calls name, by the call's id. */
  private learn(text: string): void {
    let msg: { message?: { content?: unknown } };
    try {
      msg = JSON.parse(text) as typeof msg;
    } catch {
      return;
    }
    const content = msg?.message?.content;
    if (!Array.isArray(content)) return;
    for (const b of content as { type?: unknown; id?: unknown; input?: { file_path?: unknown } }[])
      if (b?.type === "tool_use" && typeof b.id === "string" && typeof b.input?.file_path === "string") {
        this.files.set(b.id, b.input.file_path);
        if (this.files.size > CALLS) this.files.delete(this.files.keys().next().value!);
      }
  }

  /** The one file an image's line shows, when it says it or its call did. */
  private viewOf(bare: string): string | undefined {
    if (bare.length >= SMALL) return undefined;
    let msg: { tool_use_result?: { file?: { filePath?: unknown } }; message?: { content?: unknown } };
    try {
      msg = JSON.parse(bare) as typeof msg;
    } catch {
      return undefined;
    }
    const own = msg?.tool_use_result?.file?.filePath;
    if (typeof own === "string" && own) return own;
    const content = msg?.message?.content;
    if (!Array.isArray(content)) return undefined;
    const named = new Set<string>();
    for (const b of content as { type?: unknown; tool_use_id?: unknown }[])
      if (b?.type === "tool_result" && typeof b.tool_use_id === "string") {
        const f = this.files.get(b.tool_use_id);
        if (f) named.add(f);
      }
    return named.size === 1 ? [...named][0] : undefined;
  }
}
