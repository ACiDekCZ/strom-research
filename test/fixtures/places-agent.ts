// A scripted agent for the sessions identifying places (strom run --places): it reads its brief, marks each place of
// the batch as not located and closes the session done. AGENT_MODE=wait: works until strom says the person asks it to
// finish (Ctrl-C of the run), then writes nothing down and hands the task back.
import { spawnSync } from "node:child_process";

const strom = (...args: string[]) => {
  const r = spawnSync("strom", args, { encoding: "utf8", env: process.env, shell: process.platform === "win32" });
  process.stdout.write(`$ strom ${args.join(" ")} → ${r.status}\n`);
  if (r.status !== 0) process.stdout.write(r.stdout + r.stderr);
  return r;
};

if (process.env.AGENT_MODE === "wait") {
  for (let i = 0; i < 600; i++) {
    const r = strom("task", "list");
    if (/the user asks you to finish this session now/u.test(r.stderr)) {
      strom("session", "close", "--continue", "--summary", "asked to finish: nothing identified yet", "--next", "the places of the batch");
      process.exit(0);
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  process.exit(0);
}

const brief = strom("brief").stdout;
const forms = [...brief.matchAll(/^ {2}"(.+?)" — /gmu)].map((m) => m[1]!);
for (const form of forms) strom("place", "unlocated", form, "--why", "no record names it", "--needs", "a parish register of the place");
strom("session", "close", "--done", `${forms.length} not located`, "--next", "the next places of the queue");
