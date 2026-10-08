// The backup before another channel or an older version (core/backup.ts), as the CLI makes it: every research this
// computer knows and the settings, the README in the person's language, kept in the user config, said in a line.

import { EXIT, StromError } from "../core/errors.ts";
import { backupOnce, backupsDir, BackupFailed, mb, type BackupRecord, type Transition } from "../core/backup.ts";
import type { Context } from "./context.ts";
import { installation, replacedHolding } from "../core/self.ts";
import { ui } from "./ui.ts";

/** A local date and time for a sentence. */
function when(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** The versions as a sentence says them: their channels too where the version stays the same. */
function sides(t: Transition): { from: string; to: string } {
  const same = t.from === t.to;
  return { from: `${t.from}${same && t.fromChannel ? ` (${t.fromChannel})` : ""}`, to: `${t.to}${same && t.toChannel ? ` (${t.toChannel})` : ""}` };
}

/**
 * Make the backup of this change unless one was made for it already. Returns the one made now (undefined: made
 * before, or nothing to back up — no home). Throws a StromError (exit 6) with the reason and what to do when it
 * cannot: `update` — strom update stops before it installs; otherwise this strom opens no research for writing.
 */
export function backupBefore(ctx: Context, t: Transition, opts: { update?: { channel: string } } = {}): BackupRecord | undefined {
  const home = ctx.settings.home()?.value;
  if (!home) return undefined;
  const lang = ctx.uiLang();
  const said = sides(t);
  try {
    // never inside what strom update replaces (app/, node/ of the installer's folder): the backup would go with it
    const inst = installation();
    const inside = inst.kind === "installed" && inst.root ? replacedHolding(inst.root, [backupsDir(home)])[0] : undefined;
    if (inside) throw new BackupFailed(`${backupsDir(home)} lies inside ${inside.entry}, which strom update replaces — the research belongs outside strom's program folder`);
    return backupOnce({
      home,
      env: ctx.env,
      trees: () => ctx.knownTrees().map((k) => k.root),
      research: [ctx.settings.trees()?.value, ctx.settings.shared()?.value].filter((p): p is string => !!p),
      transition: t,
      readme: ui(lang, "ui.backup.readme", { ...said, date: when(new Date().toISOString()) }),
      record: (made, before) => {
        ctx.settings.config.backups = [...before, made];
        ctx.settings.save();
      },
    });
  } catch (e) {
    const detail = e instanceof BackupFailed ? e.message : (e as Error).message;
    const where = backupsDir(home);
    const back = t.fromChannel ?? "stable";
    const params = { ...said, detail, where, back, channel: opts.update?.channel ?? "" };
    if (opts.update)
      throw new StromError(`the backup before going from ${said.from} to ${said.to} could not be made: ${detail} — nothing was installed`, {
        exitCode: EXIT.noBackup,
        hint: `free room on the disk (${where}), then strom update --channel ${opts.update.channel} again`,
        code: "backup.failed.update",
        params,
        details: { from: t.from, to: t.to, where, ...(e instanceof BackupFailed && e.room ? { room: e.room } : {}) },
      });
    throw new StromError(`the backup before going from ${said.from} to ${said.to} could not be made: ${detail} — nothing is switched: this strom opens no family tree for writing until it is made (tried again at each run)`, {
      exitCode: EXIT.noBackup,
      hint: `tell the user: free room on the disk (${where}), then run strom again — or go back: strom update --channel ${back}`,
      code: "backup.failed",
      params,
      details: { from: t.from, to: t.to, where, ...(e instanceof BackupFailed && e.room ? { room: e.room } : {}) },
    });
  }
}

/** Where the backup is, in a line: the person's language, or JSON for an agent (--json). */
export function backupSaid(ctx: Context, b: BackupRecord): string {
  if (ctx.json) return JSON.stringify({ backup: { path: b.path, bytes: b.bytes, from: b.from, to: b.to } });
  return ui(ctx.uiLang(), "ui.backup.made", { ...sides(b), path: b.path, size: mb(b.bytes) });
}

/** The last backup in a line (the menu, strom doctor). */
export function lastBackupLine(lang: string, b: BackupRecord): string {
  return ui(lang, "ui.backup.last", { ...sides(b), date: when(b.at), path: b.path });
}
