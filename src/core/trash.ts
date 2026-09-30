// Into the system's trash, never deleted for good: a person can take it back.
// macOS: ~/.Trash (Finder's own delete when it lies on another disk); Windows:
// the Recycle Bin (PowerShell's VisualBasic FileSystem); Linux: gio trash, else
// the XDG trash folder of the user's home.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { StromError } from "./errors.ts";
import { userHome, type Env } from "./paths.ts";

function free(dir: string, name: string): string {
  let to = path.join(dir, name);
  for (let n = 2; fs.existsSync(to); n++) to = path.join(dir, `${name} (${n})`);
  return to;
}

function run(command: string, args: string[], env: Env): boolean {
  const r = spawnSync(command, args, { stdio: "ignore", windowsHide: true, timeout: 120_000, env: { ...process.env, ...env } });
  return !r.error && r.status === 0;
}

/** Move a file or folder into the trash; `name` is what it is called there. Throws when no trash takes it. */
export function moveToTrash(target: string, env: Env, name = path.basename(target), platform: NodeJS.Platform = process.platform): void {
  if (!fs.existsSync(target)) return;
  const fail = () => new StromError(`could not put ${target} into the trash`, { hint: "move the folder into the trash yourself" });
  if (env.STROM_TRASH) {
    // a test's own trash: nothing of the computer's
    fs.mkdirSync(env.STROM_TRASH, { recursive: true });
    fs.renameSync(target, free(env.STROM_TRASH, name));
    return;
  }
  if (platform === "darwin") {
    const trash = path.join(userHome(env), ".Trash");
    try {
      fs.mkdirSync(trash, { recursive: true });
      fs.renameSync(target, free(trash, name));
      return;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EXDEV") throw fail();
    }
    // on another disk: Finder puts it into that disk's own trash
    const script = `tell application "Finder" to delete (POSIX file ${JSON.stringify(target)} as alias)`;
    if (!run("osascript", ["-e", script], env)) throw fail();
    return;
  }
  if (platform === "win32") {
    const kind = fs.statSync(target).isDirectory() ? "DeleteDirectory" : "DeleteFile";
    const lit = `'${target.replace(/'/g, "''")}'`;
    const ps = `Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::${kind}(${lit}, 'OnlyErrorDialogs', 'SendToRecycleBin')`;
    if (!run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", ps], env) || fs.existsSync(target)) throw fail();
    return;
  }
  if (run("gio", ["trash", target], env) && !fs.existsSync(target)) return;
  // the XDG trash of the home: the file, and a note of where it came from
  const base = env.XDG_DATA_HOME || path.join(userHome(env), ".local", "share");
  const files = path.join(base, "Trash", "files");
  const info = path.join(base, "Trash", "info");
  try {
    fs.mkdirSync(files, { recursive: true });
    fs.mkdirSync(info, { recursive: true });
    const to = free(files, name);
    fs.renameSync(target, to);
    fs.writeFileSync(path.join(info, `${path.basename(to)}.trashinfo`), `[Trash Info]\nPath=${encodeURI(target)}\nDeletionDate=${new Date().toISOString().slice(0, 19)}\n`);
  } catch {
    throw fail();
  }
}
