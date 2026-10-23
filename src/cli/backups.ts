// The backup before another channel or an older version (core/backup.ts), as the CLI makes it: every research this
// computer knows, the shared folder with its images and the settings, the README in the person's language, kept in the user config, said in a line.

import { EXIT, StromError } from "../core/errors.ts";
import { backupOnce, backupsDir, BackupFailed, mb, type BackupRecord, type SharedMedia, type Transition } from "../core/backup.ts";
import type { Context } from "./context.ts";
import { installation, replacedHolding } from "../core/self.ts";
import { ui } from "./ui.ts";
import { mb as sizeIn } from "../core/tidy.ts";
import { isAgent } from "../core/which.ts";
import { refusedCode, SANDBOX_HINT } from "../core/writable.ts";

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
      ...(ctx.settings.shared()?.value ? { shared: ctx.settings.shared()!.value } : {}),
      transition: t,
      readme: (media) => ui(lang, "ui.backup.readme", { ...said, date: when(new Date().toISOString()), media: mediaSaid(lang, media) }),
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
    // room on the disk only where the disk is full (found on Windows: an agent's sandbox refused the backup's lock, EPERM,
    // and strom advised freeing room); a refused write says so — under an agent most likely its sandbox
    const code = e instanceof BackupFailed ? e.code : (e as NodeJS.ErrnoException).code;
    const why = (e instanceof BackupFailed && e.room) || code === "ENOSPC" ? "room" : refusedCode(code) ? "refused" : "other";
    const agent = isAgent(ctx.env);
    if (opts.update)
      throw new StromError(`the backup before going from ${said.from} to ${said.to} could not be made: ${detail} — nothing was installed`, {
        exitCode: EXIT.noBackup,
        hint:
          why === "room"
            ? `free room on the disk (${where}), then strom update --channel ${opts.update.channel} again`
            : why === "refused"
              ? `${agent ? `writing into ${where} was refused — ${SANDBOX_HINT}` : `writing into ${where} is refused: a folder with the right to write in it`}; then strom update --channel ${opts.update.channel} again`
              : `strom doctor says more; then strom update --channel ${opts.update.channel} again`,
        ...(why !== "room" ? { hintCode: `backup.failed.update.${why}` } : {}),
        code: "backup.failed.update",
        params,
        details: { from: t.from, to: t.to, where, ...(e instanceof BackupFailed && e.room ? { room: e.room } : {}) },
      });
    throw new StromError(`the backup before going from ${said.from} to ${said.to} could not be made: ${detail} — nothing is switched: this strom opens no family tree for writing until it is made (tried again at each run)`, {
      exitCode: EXIT.noBackup,
      hint:
        why === "room"
          ? `tell the user: free room on the disk (${where}), then run strom again — or go back: strom update --channel ${back}`
          : why === "refused"
            ? agent
              ? `writing into ${where} was refused — ${SANDBOX_HINT}`
              : `writing into ${where} is refused: a folder with the right to write in it, then run strom again — or go back: strom update --channel ${back}`
            : `strom doctor says more; run strom again — or go back: strom update --channel ${back}`,
      ...(why !== "room" ? { hintCode: `backup.failed.${why}` } : {}),
      code: "backup.failed",
      params,
      details: { from: t.from, to: t.to, where, ...(e instanceof BackupFailed && e.room ? { room: e.room } : {}) },
    });
  }
}

/** How the shared images are in a backup, for its README. */
function mediaSaid(lang: string, media: SharedMedia | undefined): string {
  if (!media || !media.files) return ui(lang, "ui.backup.media.none");
  return ui(lang, `ui.backup.media.${media.how}`, { n: media.files, size: sizeIn(media.bytes, lang) });
}

/** Where the backup is, in a line: the person's language, or JSON for an agent (--json). Shared images left out are said. */
export function backupSaid(ctx: Context, b: BackupRecord): string {
  if (ctx.json) return JSON.stringify({ backup: { path: b.path, bytes: b.bytes, from: b.from, to: b.to, ...(b.media ? { media: b.media } : {}) } });
  const made = ui(ctx.uiLang(), "ui.backup.made", { ...sides(b), path: b.path, size: mb(b.bytes) });
  return b.media?.how === "left" ? `${made}\n${ui(ctx.uiLang(), "ui.backup.media.left.line", { size: sizeIn(b.media.bytes, ctx.uiLang()) })}` : made;
}

/** The last backup in a line (the menu, strom doctor). */
export function lastBackupLine(lang: string, b: BackupRecord): string {
  return ui(lang, "ui.backup.last", { ...sides(b), date: when(b.at), path: b.path });
}
