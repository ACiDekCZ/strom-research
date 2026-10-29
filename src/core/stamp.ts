// What a research is at now, told by two small files and nothing else (no git started, no record read): the commit
// its history is at, and its strom.json. Every change strom makes to the data is committed, so the same stamp means
// the same records — what was found of them may be kept (the menu between its rounds, strom's checks of the readings).

import fs from "node:fs";
import path from "node:path";

/** The commit a research's history is at (the hash, read from its ref; none: "nohead"). */
export function headOf(root: string): string {
  const git = path.join(root, ".git");
  try {
    const ref = fs.readFileSync(path.join(git, "HEAD"), "utf8").trim();
    const m = /^ref:\s*(.+)$/u.exec(ref);
    if (!m) return ref;
    try {
      return fs.readFileSync(path.join(git, ...m[1]!.split("/")), "utf8").trim();
    } catch {
      // packed (git gc): its line in packed-refs
      const packed = fs.readFileSync(path.join(git, "packed-refs"), "utf8");
      return packed.split("\n").find((l) => l.endsWith(` ${m[1]}`))?.split(" ")[0] ?? "nohead";
    }
  } catch {
    return "nohead";
  }
}

/** A file's size and time of change ("-": none). */
export function fileStamp(file: string): string {
  try {
    const st = fs.statSync(file);
    return `${st.size}:${st.mtimeMs}`;
  } catch {
    return "-";
  }
}

/** The research as it is now: its commit and its strom.json. */
export function researchStamp(root: string): string {
  return `${headOf(root)}|${fileStamp(path.join(root, "strom.json"))}`;
}

/** The files of a folder (not its subfolders' files), each with its stamp, by name ("-": no such folder). */
export function dirStamp(dir: string): string {
  let names: string[];
  try {
    names = fs.readdirSync(dir).sort();
  } catch {
    return "-";
  }
  return names.map((n) => `${n}=${fileStamp(path.join(dir, n))}`).join(",");
}
