// A scripted "agent" for testing `strom run`: it does what a real agent is
// told to do in the brief, through the strom on its PATH.
import { spawnSync } from "node:child_process";

const strom = (...args: string[]) => {
  const r = spawnSync("strom", args, { encoding: "utf8", env: process.env, shell: process.platform === "win32" });
  process.stdout.write(`$ strom ${args.join(" ")} → ${r.status}\n`);
  if (r.status !== 0) process.stdout.write(r.stdout + r.stderr);
  return r;
};

const prompt = process.env.STROM_PROMPT ?? "";

// A reader (strom read): opens nothing, writes a report — a find on the first image of the batch.
if (process.env.STROM_READER === "1") {
  const { appendFileSync } = await import("node:fs");
  const report = /Write your report to (.+?) AS YOU GO/.exec(prompt)?.[1];
  // strom clips: where each entry is (every entry found at the same place), then the check (a title with "cizí" is the wrong entry, "úzký" cut off once)
  if (prompt.includes("find that entry on it")) {
    // a title with "prošlé" is a search over many entries, not one entry
    for (const m of prompt.matchAll(/^### (S\d{4}) — (.*)\n(?:(?!###)[\s\S])*?^image (M\d{4}):/gm))
      appendFileSync(report!, m[2]!.includes("prošlé") ? `## ${m[1]} · ${m[3]}\nresult: many\n\n` : `## ${m[1]} · ${m[3]}\nresult: found\nregion: 0.1,0.2,0.5,0.1\n\n`);
    process.exit(0);
  }
  if (prompt.includes("cut-out of a scan")) {
    // "úzký": cut off at the bottom the first time, whole once cut out wider
    const again = /-check\d-\d+\.md$/.test(report!);
    for (const m of prompt.matchAll(/^### (S\d{4}) · (M\d{4}) — (.*)$/gm))
      appendFileSync(report!, `## ${m[1]} · ${m[2]}\nverdict: ${m[3]!.includes("cizí") ? "wrong\nwhy: another child" : m[3]!.includes("úzký") && !again ? "cut\nmissing: bottom\nwhy: the last line is cut off" : "ok"}\n\n`);
    process.exit(0);
  }
  // strom transcripts: the words ("nečitelný" cannot be read), then the check ("oprava": corrected, "cizí": another entry)
  if (prompt.includes("write the entry's words")) {
    for (const m of prompt.matchAll(/^### (S\d{4}) — (.*)$/gm))
      appendFileSync(report!, m[2]!.includes("nečitelný") ? `## ${m[1]}\nresult: unreadable\n\n` : `## ${m[1]}\nresult: read\ntranscript:\nJoannes filius\nJosephi Nowak [?]\n\n`);
    process.exit(0);
  }
  if (prompt.includes("hold the words against it")) {
    for (const m of prompt.matchAll(/^### (S\d{4}) — (.*)$/gm))
      appendFileSync(
        report!,
        m[2]!.includes("cizí")
          ? `## ${m[1]}\nverdict: wrong\ntranscript:\nwhy: another child\n\n`
          : m[2]!.includes("oprava")
            ? `## ${m[1]}\nverdict: fixed\ntranscript:\nJoannes filius\nJosephi Nowák\nwhy: the surname\n\n`
            : `## ${m[1]}\nverdict: ok\ntranscript:\nwhy: as written\n\n`,
      );
    process.exit(0);
  }
  const images = [...prompt.matchAll(/^- (M\d{4}) · image (\d+)/gm)].map((m) => ({ id: m[1]!, n: m[2]! }));
  if (process.env.AGENT_MODE === "reader-silent") {
    console.log(`## Image ${images[0]!.n} · ${images[0]!.id}\nresult: nothing`);
    process.exit(0);
  }
  images.forEach((img, i) => {
    appendFileSync(report!, `## Image ${img.n} · ${img.id}\nresult: ${i === 0 ? "found" : "nothing"}\nentries: ${i === 0 ? "Franz · 18. Oktober · Haus 13" : "—"}\n\n`);
  });
  console.log(`done: ${images.length} images, found on ${images[0]?.n}`);
  process.exit(0);
}
const task = /## Task (T\d{4})/.exec(prompt)?.[1];
const mode = process.env.AGENT_MODE ?? "work";

if (mode === "limit") {
  console.log("Claude usage limit reached. Your limit resets at 7pm.");
  process.exit(1);
}
if (mode === "die") process.exit(0); // leaves the session open
if (mode === "denied") {
  // what an agent reports when its permissions refuse strom (stands in for Claude's permission_denials)
  console.log("denied: Bash: strom input show I0001");
  process.exit(0);
}
if (mode === "sleep") {
  await new Promise((r) => setTimeout(r, 30_000)); // stopped by the session time limit
  process.exit(0);
}
if (mode === "idle") {
  // works on nothing, hands the task back
  strom("session", "close", "--continue", "--summary", "nothing yet", "--next", "try again");
  process.exit(0);
}
if (mode === "echo") {
  // what the agent got: its arguments and the prompt on stdin
  const stdin = await new Promise<string>((resolve) => {
    let s = "";
    process.stdin.on("data", (d) => (s += d)).on("end", () => resolve(s));
  });
  console.log(`args: ${process.argv.slice(2).join(" ")}`);
  console.log(`stdin: ${stdin.includes("## Task") ? "brief" : "none"}`);
  strom("session", "close", "--continue", "--summary", "echo", "--next", "echo");
  process.exit(0);
}

strom("source", "add", "Křest Jana Nováka 1905", "--kind", "baptism", "--recordset", "B1", "--locator", "fol. 45", "--form", "original", "--information", "primary", "--transcript", "Joannes filius Josephi");
strom("event", "add", "P1", "CHR", "--date", "25 JUN 1905", "--cite", "S1", "--status", "proven");
strom("search", "add", "Křty Novák 1903-1907", "--recordset", "B1", "--years", "1903-1907", "--surname", "Novák", "--method", "page-by-page", "--result", "found", "--found", "S1");
if (task) strom("task", "done", task, "--result", "baptism found fol. 45");
strom("session", "close", "--summary", "baptism of Jan found", "--next", "marriage of Josef");
