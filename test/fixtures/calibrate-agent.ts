// A scripted reader for strom media calibrate: it answers each case of the prompt as a reader would, from what the
// test says is on the scans (CAL_TRUTH: a JSON file, a word of the entry asked for → its words), and reads worse on a
// small view when the test wants it to (CAL_SMALL: below this long side the names are lost; CAL_FIND_SMALL: below it
// the entry is not found). Images without the entry (N…) are found to have none.
import fs from "node:fs";
import { imageSize } from "../../src/image/index.ts";

const prompt = process.env.STROM_PROMPT ?? "";
const report = /Write your report to (.+?) AS YOU GO/.exec(prompt)?.[1];
if (!report) process.exit(2);
const truth: Record<string, string> = process.env.CAL_TRUTH ? JSON.parse(fs.readFileSync(process.env.CAL_TRUTH, "utf8")) : {};
const small = Number(process.env.CAL_SMALL ?? 0);
const findSmall = Number(process.env.CAL_FIND_SMALL ?? 0);
if (process.env.CAL_PROMPT_OUT) fs.appendFileSync(process.env.CAL_PROMPT_OUT, prompt + "\n=====\n");
const find = prompt.includes("say whether that entry is on it");
for (const block of prompt.split(/^### /m).slice(1)) {
  const [head = "", ...rest] = block.split("\n");
  const id = /^([CN]\d+)/.exec(head)![1]!;
  const files = rest.map((l) => /^(?:image|left half|right half): (.+)$/.exec(l)?.[1]).filter((f): f is string => !!f);
  const long = Math.max(...files.map((f) => {
    const s = imageSize(new Uint8Array(fs.readFileSync(f)))!;
    return Math.max(s.width, s.height);
  }));
  const words = Object.entries(truth).find(([k]) => head.includes(k))?.[1] ?? "";
  if (find) {
    const there = id.startsWith("C") && !(findSmall && long < findSmall);
    fs.appendFileSync(report, there ? `## ${id}\nfound: yes\nwhere: from 0.38 to 0.52\n\n` : `## ${id}\nfound: no\nwhere: —\n\n`);
  } else {
    // a small view: only the numbers read, the names unsure
    const read = small && long < small ? words.replace(/\p{L}+/gu, "[?]") : words;
    fs.appendFileSync(report, `## ${id}\nfound: yes\ntranscript:\n${read}\n${small && long < small ? "illegible: the names\n" : ""}\n`);
  }
}
console.log(`done: cases\ncost: 0.05`);
