// backup — what to back up: the one folder that holds every research and the shared images, where it is and how big;
// or one research packed into a file (strom pack). Read only: nothing is copied (spec 017, M3).

import fs from "node:fs";
import path from "node:path";
import { register } from "../cli/registry.ts";
import { lines } from "../cli/format.ts";
import { ui } from "../cli/ui.ts";
import { lastBackupLine } from "../cli/backups.ts";
import { backupsDir, lastBackup } from "../core/backup.ts";
import { mb } from "../core/tidy.ts";

/** Is `p` the folder `dir` or inside it? */
function within(p: string, dir: string): boolean {
  const rel = path.relative(dir, p);
  return !rel || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

/**
 * Bytes a folder takes on the disk: each file once (a hard link of a backup counts where it was seen first), links never
 * followed, the folders of `skip` left out.
 */
function sizeOnDisk(dir: string, seen: Set<string>, skip: string[] = []): number {
  let total = 0;
  const walk = (p: string) => {
    if (skip.some((s) => path.resolve(s) === path.resolve(p))) return;
    let st: fs.Stats;
    try {
      st = fs.lstatSync(p);
    } catch {
      return;
    }
    if (st.isSymbolicLink()) return;
    if (st.isDirectory()) {
      let names: string[] = [];
      try {
        names = fs.readdirSync(p);
      } catch {
        return;
      }
      for (const name of names) walk(path.join(p, name));
      return;
    }
    const id = `${st.dev}:${st.ino}`;
    if (seen.has(id)) return;
    seen.add(id);
    total += st.size;
  };
  walk(dir);
  return total;
}

register({
  path: ["backup"],
  summary: "What to back up: the one folder that holds every research and the shared images, where it is and its size (read only)",
  group: "setup",
  description:
    "Every family tree, the shared images (scans, the Strom app's originals, the phone's photos) and the connectors are in\n" +
    "one folder: copied whole onto another disk or into a cloud folder, it is a backup strom reads again (strom check).\n" +
    "Its subfolder backups holds the backups strom makes by itself before another version; a copy elsewhere does not\n" +
    "need it. One research into one file for someone else: strom pack. Nothing is copied by this command.",
  examples: ["strom backup", "strom backup --json"],
  run(ctx) {
    const home = ctx.settings.home()?.value;
    const lang = ctx.uiLang();
    const t = (key: Parameters<typeof ui>[1], params?: Record<string, string | number>) => ui(lang, key, params);
    if (!home) return { text: t("ui.backup.what.nohome"), data: { home: null } };
    const seen = new Set<string>();
    const backups = backupsDir(home);
    const shared = ctx.settings.shared()?.value ?? path.join(home, "shared");
    const treesDir = ctx.settings.trees()?.value ?? home;
    // what lies outside the folder: another folder of the trees, the shared one elsewhere, a research opened from elsewhere
    const outside = [...new Set([treesDir, shared, ...ctx.knownTrees().map((k) => k.root)].filter((p) => fs.existsSync(p) && !within(p, home)))].filter((p, _, all) => !all.some((o) => o !== p && within(p, o)));
    const bytes = sizeOnDisk(home, seen, [backups]);
    const sharedBytes = within(shared, home) ? sizeOnDisk(shared, new Set()) : 0;
    const elsewhere = outside.map((p) => ({ path: p, bytes: sizeOnDisk(p, seen) }));
    // the backups take only what they do not share with the research (linked images take no room twice)
    const backupsBytes = fs.existsSync(backups) ? sizeOnDisk(backups, seen) : 0;
    const last = lastBackup(ctx.env);
    const text = lines(
      t("ui.backup.what.title"),
      t("ui.backup.what.home", { path: ctx.display(home), size: mb(bytes, lang) }),
      within(shared, home) ? t("ui.backup.what.shared", { size: mb(sharedBytes, lang) }) : undefined,
      ...elsewhere.map((o) => t("ui.backup.what.outside", { path: ctx.display(o.path), size: mb(o.bytes, lang) })),
      t("ui.backup.what.copy"),
      fs.existsSync(backups) ? t("ui.backup.what.backups", { size: mb(backupsBytes, lang) }) : undefined,
      "",
      t("ui.backup.what.pack", { menu: t("ui.menu.trees") }),
      last ? lastBackupLine(lang, last) : undefined,
    );
    return {
      text,
      data: {
        home,
        bytes,
        shared: { path: shared, bytes: within(shared, home) ? sharedBytes : elsewhere.find((o) => o.path === shared)?.bytes ?? 0, inside: within(shared, home) },
        outside: elsewhere,
        backups: { path: backups, bytes: backupsBytes, needed: false },
        pack: "strom pack",
        ...(last ? { last } : {}),
      },
    };
  },
});
