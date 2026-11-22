// The bridge's warm writer (core/warmwriter.ts): a strom that lives on between the writes of what the app sent and runs
// each command it is given — one at a time, through main() as bin strom would — answering with its exit code and what it
// printed. Each command gets the environment and folder it was started with, untouched by the one before it. Ends when
// the bridge lets it go (or ends itself).

import { settleColors } from "../cli/colors.ts";

settleColors(process.env);
const { main } = await import("../cli/main.ts");
const { installation, withInstallEnv } = await import("./self.ts");
// the environment of the installation, as bin strom sets it
Object.assign(process.env, withInstallEnv(process.env, installation().env));
const base: NodeJS.ProcessEnv = { ...process.env };
const home = process.cwd();

let chain: Promise<unknown> = Promise.resolve();

// what the first original needs: the index of the research's files by their hashes, read before it comes
chain = chain.then(async () => {
  try {
    const { Tree } = await import("./tree.ts");
    const { recordsBySha } = await import("./shaindex.ts");
    const root = base.STROM_TREE ?? home;
    recordsBySha(Tree.open(root, { ...base }), "media", "0".repeat(64));
  } catch {
    // read by the first command that asks
  }
});

const answer = async (m: { id: number; argv: string[] }) => {
  let stdout = "";
  let stderr = "";
  let code: number;
  try {
    code = await main(m.argv, { stdout: (s) => (stdout += s), stderr: (s) => (stderr += s), tty: false, stdinText: () => "" }, { ...base }, home);
  } catch (e) {
    // as a strom started for it ends on what it did not catch
    stderr += `${(e as Error)?.stack ?? String(e)}\n`;
    code = 1;
  }
  // nothing of one command left for the next
  process.exitCode = undefined;
  if (process.cwd() !== home) process.chdir(home);
  try {
    process.send?.({ id: m.id, code, stdout, stderr });
  } catch {
    // the bridge gone meanwhile: what was written is in the research (its commit), nobody to tell
  }
};

process.on("message", (m: { id?: unknown; argv?: unknown }) => {
  if (typeof m?.id !== "number" || !Array.isArray(m.argv)) return;
  const msg = { id: m.id, argv: m.argv.map(String) };
  chain = chain.then(() => answer(msg));
});
// let go by the bridge (or the bridge gone): what it writes now finishes, then it ends
process.on("disconnect", () => {
  void chain.then(() => process.exit(0));
});
