// A process taking a lock many times and adding one to a counter under it each time (test/unit/lock-nolink.test.ts):
// several of them side by side lose no addition only when the lock lets one in at a time. With "nolink" the disk
// takes no hard links (the lock is created exclusively instead). With "slow" it also shows a lock's content to other
// processes only 400 ms after it was made, and its time as 0 till then (a drive redirected over Remote Desktop); one
// holder found inside beside another ends the process with 3.

import fs from "node:fs";
import { acquireLock, diskForTests, linkForTests } from "../../src/core/lock.ts";

const [file, counter, times, mode] = process.argv.slice(2) as [string, string, string, string];
if (mode === "nolink" || mode === "slow")
  linkForTests(() => {
    throw Object.assign(new Error("EISDIR: link refused"), { code: "EISDIR" });
  });
// not there yet for this process: made in the last 400 ms by another one
const unseen = (f: string) => {
  if (Date.now() - fs.statSync(f).ctimeMs >= 400) return false;
  try {
    return (JSON.parse(fs.readFileSync(f, "utf8")) as { pid: number }).pid !== process.pid;
  } catch {
    return true;
  }
};
if (mode === "slow")
  diskForTests({
    read: (f) => (unseen(f) ? "" : fs.readFileSync(f, "utf8")),
    stat: (f) => {
      const st = fs.statSync(f);
      return unseen(f) ? Object.assign(st, { mtimeMs: 0 }) : st;
    },
  });
const inside = `${counter}.inside`;
for (let i = 0; i < Number(times); i++) {
  const release = acquireLock(file, { owner: `worker ${process.pid}`, waitMs: 60_000 });
  try {
    try {
      fs.writeFileSync(inside, String(process.pid), { flag: "wx" });
    } catch {
      process.exit(3);
    }
    const n = Number(fs.readFileSync(counter, "utf8"));
    fs.writeFileSync(counter, String(n + 1));
    fs.rmSync(inside);
  } finally {
    release();
  }
}
