// A tree of the Strom app from a browser the app cannot reach strom from (Safari), moved to one it can — always on a
// person's word: the question names the tree, how many people and the browser; no is nothing set up (the app's
// ZADANI_VYZKUM_prenos-prohlizece.md, points 3–5). No such browser here: its download page (nothing installs by
// itself), the research from the file without a browser, or nothing.

import path from "node:path";
import type { Context } from "./context.ts";
import { droppedPaths, translator } from "./menu-parts.ts";
import { appBrowsers, browserKind, browserName, defaultBrowser, type Browser, type BrowserKind } from "../core/chromium.ts";
import type { UIKey } from "./ui.ts";
import { findTransfer, transferDirs, transferMark, type TransferMark } from "../core/transfer.ts";
import { openForUser } from "../core/open.ts";

export const CHROME_DOWNLOAD = "https://www.google.com/chrome/";
export const EDGE_DOWNLOAD = "https://www.microsoft.com/edge/download";

/**
 * Where the tree goes: the browser it moves to (`installed`: installed by the person just now, from the download page —
 * its first start asks its own questions first), or no browser — the research from the file.
 */
export type Move = { file: string; mark: TransferMark; from: BrowserKind } & ({ browser: Browser; installed?: boolean } | { without: true });

/** Where the tree comes from, in words of the person's language ("Safari", "telefonu nebo tabletu", "původním prohlížeči"). */
export function fromWords(t: (key: UIKey) => string, kind: BrowserKind): string {
  return browserName(kind) ?? t(kind === "mobile" ? "ui.move.from.mobile" : "ui.move.from.other");
}

const out = (ctx: Context, line: string) => ctx.io.stdout(line + "\n");

/** The tree's file of the move: found where a browser saves it, else its path asked for. None: given up. */
async function moveFile(ctx: Context, token: string, given: string | undefined): Promise<{ file: string; mark: TransferMark } | undefined> {
  const t = translator(ctx.uiLang());
  const found = findTransfer(token, transferDirs(ctx.env, ctx.cwd, ctx.settings.config.browserDownloads), given);
  if (found) {
    out(ctx, t("ui.move.file", { file: ctx.display(found.file) }));
    return found;
  }
  for (;;) {
    const a = (await ctx.ask(t("ui.move.file.ask", { name: given ? path.basename(given) : "strom-prenos-….json" }))).trim();
    if (!a || a === "0") return undefined;
    const file = path.resolve(ctx.cwd, droppedPaths(a)[0] ?? a);
    const mark = transferMark(file);
    if (mark && mark.token === token) return { file, mark };
    out(ctx, t("ui.move.file.other"));
  }
}

/** The browser the tree moves to, asked: one — move or no; several — which, or none. None: the person said no. */
async function pickBrowser(ctx: Context, mark: TransferMark, here: Browser[]): Promise<Browser | undefined> {
  const t = translator(ctx.uiLang());
  const values = { tree: mark.tree, persons: mark.persons };
  // a tree with nobody in it yet (installed from the app's first page): the app opens there
  const empty = mark.persons === 0;
  if (here.length === 1) {
    const i = await ctx.choose(t(empty ? "ui.move.empty" : "ui.move.ask", { ...values, browser: here[0]!.name }), [{ label: t(empty ? "ui.move.go" : "ui.move.yes") }], 0, { back: t("ui.move.no") });
    return i === 0 ? here[0] : undefined;
  }
  const i = await ctx.choose(t(empty ? "ui.move.empty.which" : "ui.move.which", values), here.map((b) => ({ label: b.name })), 0, { back: t(empty ? "ui.move.no" : "ui.move.none") });
  return i === undefined ? undefined : here[i];
}

/**
 * What going on without a browser means, said before the research is made from the file — and how the move is finished
 * later: with a browser here (the person said no to it), in that one; with none, once one is installed.
 */
function without(ctx: Context, from: string, here: Browser[]): void {
  const t = translator(ctx.uiLang());
  out(ctx, `${t("ui.move.without.what", { from })} ${here.length ? t("ui.move.without.later.here", { browser: here[0]!.name }) : t("ui.move.without.later.none")}`);
}

/**
 * The app's tree moving from `from` (its file: `given`, the name the app gave it): the file found, the browser it moves
 * to asked — or, none here, how to go on. Undefined: nothing is set up (said).
 */
export async function moveTree(ctx: Context, token: string, said: BrowserKind | undefined, given: string | undefined): Promise<Move | undefined> {
  const t = translator(ctx.uiLang());
  // never in silence: only a person at a terminal moves a tree
  if (!ctx.interactive) {
    out(ctx, t("ui.move.terminal"));
    return undefined;
  }
  const file = await moveFile(ctx, token, given);
  if (!file) {
    out(ctx, t("ui.move.cancelled"));
    return undefined;
  }
  // the browser the line said, else the one the file's mark says (a line from a phone may lose it on Windows: too long)
  const from: BrowserKind = said && said !== "other" ? said : (browserKind(file.mark.from) ?? said ?? "other");
  const found = { ...file, from };
  const fromName = fromWords(t, from);
  // the file stays where it is unless the tree is handed over (said where, D9)
  const kept = () => out(ctx, t("ui.move.file.kept", { file: ctx.display(found.file) }));
  let installed = false;
  for (;;) {
    // the system's default browser suggested first when it is one of them (Windows: Edge, or Chrome when chosen so)
    const def = defaultBrowser(ctx.env);
    const here = appBrowsers(ctx.env).sort((a, b) => Number(b.name === def) - Number(a.name === def));
    if (here.length) {
      const browser = await pickBrowser(ctx, found.mark, here);
      if (browser) return { ...found, browser, ...(installed ? { installed } : {}) };
      out(ctx, t("ui.move.stays", { from: fromName }));
      kept();
      // the research from the file without a browser, or the end
      const i = await ctx.choose(t("ui.move.then"), [{ label: t("ui.move.without") }], 1, { back: t("ui.move.end") });
      if (i !== 0) return undefined;
      without(ctx, fromName, here);
      return { ...found, without: true };
    }
    // no browser here the app reaches strom from: one to download (the person installs it), the file, or nothing
    out(ctx, t("ui.move.nobrowser"));
    const i = await ctx.choose(t("ui.move.then"), [{ label: t("ui.move.get.chrome") }, { label: t("ui.move.get.edge") }, { label: t("ui.move.without") }], process.platform === "win32" ? 1 : 0, { back: t("ui.move.cancel") });
    if (i === 0 || i === 1) {
      const url = i === 0 ? CHROME_DOWNLOAD : EDGE_DOWNLOAD;
      out(ctx, openForUser(url, ctx.env) ? t("ui.move.get.opened", { url }) : t("ui.app.url", { url }));
      // installed by the person (this terminal waits meanwhile; the wait for the tree starts only after): looked for again
      await ctx.ask(t("ui.move.get.wait"));
      installed = true;
      continue;
    }
    if (i === 2) {
      without(ctx, fromName, []);
      return { ...found, without: true };
    }
    out(ctx, t("ui.move.cancelled"));
    kept();
    return undefined;
  }
}
