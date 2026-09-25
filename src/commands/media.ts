// media add · list · show · view — scans and photos of records.
//
// An image is registered once (its content hash is its identity), stored in
// the shared media store, and tied to its record set and image number. It is
// looked at only through views; only a registered image can be cited.

import fs from "node:fs";
import path from "node:path";
import { register } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { lines, moreLine, paginate, runs, shellArg, table, truncate } from "../cli/format.ts";
import { UsageError } from "../core/errors.ts";
import type { Input, Media, RecordSet, Region, Source, Task } from "../core/model.ts";
import { makeNote } from "../core/actions.ts";
import { clipText, collectFiles, fileSha256, findImage, imageNumbers, imageOfRef, inboxFolders, inputPath, isWhole, mimeOf, otherCopies, parseImageList, regionText, sharperPart, storeShared } from "../core/media.ts";
import { create, normId, requireRecord, update } from "../core/records.ts";
import { imageSizeOfFile } from "../image/index.ts";
import { imageOf, pageOf } from "../core/calibration.ts";
import { describeView, makeView, partRegion, viewRegion, VIEW_MAX, type ViewSpec } from "../core/views.ts";
import { listConnectors, missingConsents } from "../core/connector.ts";
import { now, type Tree } from "../core/tree.ts";

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".tif", ".tiff", ".gif", ".webp", ".heic", ".jp2", ".bmp"]);

/** The first bytes of a file — enough for the image size, without reading a 20 MB scan. */
/** One image to register: the file, its number in the book, where it is from. */
export interface NewImage {
  file: string;
  image?: number | undefined;
  url?: string | undefined;
  from: string;
  /** A part of the image, fetched sharper: where it is in the whole image. */
  part?: Region | undefined;
  fetched?: { connector: string; book: string; via?: "browser" } | undefined;
}

/**
 * Register images of a record set: stored once by content, each with its number
 * and provenance. Tasks that waited for images of the book go back into the queue.
 */
export function registerImages(tree: Tree, shared: string, items: NewImage[], recordset: string | undefined): { added: Media[]; again: string[]; woken: string[]; clashes: string[]; copies: string[] } {
  // a withdrawn image is no longer known: its file can be registered again, where it belongs
  const known = new Map(tree.list<Media>("media").filter((m) => !m.retracted).map((m) => [m.sha, m]));
  const added: Media[] = [];
  const again: string[] = [];
  const clashes: string[] = [];
  const copies: string[] = [];
  tree.withTreeLock(() => {
    for (const it of items) {
      const sha = fileSha256(it.file);
      const k = known.get(sha);
      if (k) {
        again.push(k.id);
        // the same scan as another image: a portal serving another book's images, or a file given the wrong number
        const as = (m: { recordset?: string | undefined; image?: number | undefined; part?: Region | undefined }) => `${m.recordset ?? "no record set"}${m.image !== undefined ? `:${m.image}` : ""}${m.part ? ` part ${regionText(m.part)}` : ""}`;
        // a portal whose sharpest part is the whole scan gives the image again: that is no clash
        const sameScan = k.recordset === recordset && k.image === it.image && isWhole(k.part) && isWhole(it.part);
        if (!sameScan && as(k) !== as({ recordset, image: it.image, part: it.part }))
          clashes.push(`${as({ recordset, image: it.image, part: it.part })} is the same file as ${k.id} (${as(k)}) — not registered again: the portal may have given another book's image, or a number is wrong; check before citing either`);
        continue;
      }
      const stored = tree.dryRun ? it.file : storeShared(shared, it.file, sha);
      const size = imageSizeOfFile(it.file);
      const m = create<Media>(
        tree,
        "media",
        {
          sha,
          file: path.relative(shared, stored).split(path.sep).join("/"),
          mime: mimeOf(it.file),
          size: fs.statSync(it.file).size,
          ...(size ? { width: size.width, height: size.height } : {}),
          recordset,
          image: it.image,
          part: it.part,
          url: it.url,
          from: it.from,
          fetched: it.fetched,
          accessed: new Date().toISOString().slice(0, 10),
        },
        (id) => `+${id} ${it.part ? `part ${regionText(it.part)} of image` : "image"}${it.image !== undefined ? ` ${it.image}` : ""}${recordset ? ` of ${recordset}` : ""}`,
        recordset ? [recordset] : [],
      );
      known.set(sha, m);
      added.push(m);
      // another copy of an image already there (a reduced download, then the full one): the sharpest is the image
      const others = otherCopies([...known.values()], m);
      if (others.length && recordset && it.image !== undefined) {
        const best = findImage([...known.values()], recordset, it.image)!;
        const size = (x: Media) => (x.width ? ` ${x.width}×${x.height}` : "");
        copies.push(
          `${recordset}:${it.image} has ${others.length + 1} copies — ${best.id === m.id ? `${m.id}${size(m)} is the sharpest: it is the image now` : `${best.id}${size(best)} is sharper and stays the image`}; views of the others use it (${others.map((x) => `${x.id}${size(x)}`).join(", ")})`,
        );
      }
    }
  });
  const woken: string[] = [];
  if (recordset && added.length)
    for (const t of tree.list<Task>("task").filter((t) => t.state === "waiting" && (t.where.includes(recordset) || (t.waitingOn ?? "").includes(recordset)))) {
      // what it asked for and what is still missing, for the session that takes it up
      const have = new Set(tree.list<Media>("media").filter((m) => m.recordset === recordset).map((m) => m.image)); // a part counts: it was asked for too
      const missing = t.awaits?.recordset === recordset ? (parseImageList(t.awaits.images) ?? []).filter((n) => !have.has(n)) : [];
      const note = `${added.length} image(s) of ${recordset} registered${t.awaits ? ` (it waited for images ${t.awaits.images}${missing.length ? `; still missing: ${runs(missing)}` : ""})` : ""}`;
      update<Task>(tree, t.id, "task", (x) => {
        const { awaits: _, ...rest } = x;
        return { ...rest, state: "open", notes: [...x.notes, makeNote(tree, note)] };
      }, {
        op: "task.wake",
        summary: `${t.id} wake: images of ${recordset} arrived`,
      });
      woken.push(t.id);
    }
  return { added, again, woken, clashes, copies };
}

function sharedDir(ctx: Context): string {
  return ctx.settings.shared()!.value;
}

function pageLabel(tree: Tree, m: Media): string {
  if (m.page) return m.page;
  const b = m.recordset && m.image !== undefined ? tree.get<RecordSet>(m.recordset) : undefined;
  return (b && pageOf(b, m.image!)) ?? "";
}

/** "M0012", "B0001:57", "I0002" — or a record set with --image / --page. */
function resolveTarget(tree: Tree, shared: string, ref: string, opts: Record<string, unknown>): { key: string; file: string; media?: Media } {
  const at = /^([Bb]\d+):(\d+)$/.exec(ref.trim());
  if (at || /^[Bb]\d+$/.test(ref.trim())) {
    const b = requireRecord<RecordSet>(tree, at ? at[1]! : ref, "recordset");
    let image = at ? Number(at[2]) : opts.image !== undefined ? Number(opts.image) : undefined;
    if (image === undefined && opts.page !== undefined) {
      image = imageOf(b, Number.parseInt(String(opts.page), 10));
      if (image === undefined) throw new UsageError(`${b.id} has no consistent calibration to find page ${opts.page}`, { hint: `measure it: strom recordset calibrate ${b.id} --point <image>=<page>` });
    }
    if (image === undefined) throw new UsageError("which image?", { hint: `${b.id}:57, or --image 57, or --page 112` });
    const m = imageOfRef(tree.list<Media>("media"), b.id, image);
    if (!m) throw new UsageError(`image ${image} of ${b.id} is not registered`, { hint: `strom media list --recordset ${b.id} · strom media add <files> --recordset ${b.id}` });
    return { key: m.id, file: path.join(shared, m.file), media: m };
  }
  const id = normId(ref);
  if (id.startsWith("I")) {
    const i = requireRecord<Input>(tree, id, "input");
    const file = inputPath(tree, i);
    if (!file) throw new UsageError(`${i.id} has no file`);
    return { key: i.id, file };
  }
  const m = requireRecord<Media>(tree, id, "media");
  return { key: m.id, file: path.join(shared, m.file), media: m };
}

function viewSpec(opts: Record<string, unknown>): ViewSpec {
  const num = (k: string) => {
    if (opts[k] === undefined) return undefined;
    const n = Number(opts[k]);
    if (!Number.isFinite(n) || n <= 0) throw new UsageError(`--${k} must be a positive number`);
    return n;
  };
  const half = opts.half as string | undefined;
  if (half && !["left", "right", "top", "bottom"].includes(half)) throw new UsageError(`invalid --half "${half}"`, { hint: "left, right, top or bottom" });
  const rot = opts.rotate === undefined ? undefined : Number(opts.rotate);
  if (rot !== undefined && ![90, 180, 270].includes(rot)) throw new UsageError("--rotate must be 90, 180 or 270");
  return {
    crop: opts.crop as string | undefined,
    half: half as ViewSpec["half"],
    scale: num("scale"),
    max: num("max"),
    contrast: Boolean(opts.contrast),
    grey: Boolean(opts.grey),
    grid: Boolean(opts.grid),
    rotate: rot as ViewSpec["rotate"],
    png: Boolean(opts.png),
  };
}

register(
  {
    path: ["media", "add"],
    summary: "Register scans or photos of records (a folder, files, or the shared inbox) — tied to a record set",
    group: "sources",
    tree: true,
    writes: true,
    lock: "sections",
    description:
      "Each image is stored once in the shared media store (by its content) and gets an ID (M…). The image number\n" +
      "is the last number in the file name (s0057.jpg → 57), or counted from --first. Look at them with strom media view.",
    args: [{ name: "paths", description: "image files or folders", variadic: true }],
    options: [
      { name: "recordset", type: "string", value: "<B…>", description: "the book or collection the images are of" },
      { name: "image", type: "string", value: "<n>", description: "image number (one file)" },
      { name: "first", type: "string", value: "<n>", description: "number the images in file order from n (instead of from their names)" },
      { name: "url", type: "string", value: "<url>", description: "where the images come from (portal, catalog entry)" },
      { name: "from", type: "string", value: "<text>", description: "who provided them or how they were obtained" },
      { name: "inbox", type: "boolean", description: "take the files the user put in the shared inbox (they are moved into the store); a folder there is named as the argument — one folder, one record set" },
      { name: "half", type: "string", value: "<side>", description: "the file is a half of image n: left, right, top or bottom (a half page saved on its own)" },
      { name: "crop", type: "string", value: "<x,y,w,h>", description: "the file is this part of image n: fractions of it, or pixels of the registered image (a detail saved from the viewer)" },
    ],
    examples: [
      "strom media add ~/Downloads/tynec17 --recordset B0001 --url https://archive.example.org/register/17",
      "strom media add --inbox register-17 --recordset B0001",
      "strom media add --inbox --recordset B0001",
      "strom media add ~/Downloads/40-left.jpg --recordset B0001 --image 40 --half left",
    ],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const shared = sharedDir(ctx);
      const inbox = path.join(shared, "inbox");
      let paths: string[];
      if (opts.inbox) {
        // Each folder in the inbox is one download: never two books into one record set.
        const folders = inboxFolders(inbox);
        if (args.length === 0 && folders.length > 1)
          throw new UsageError(`the inbox holds ${folders.length} downloads — one record set each`, {
            hint: folders.map((f) => `strom media add --inbox ${f.folder ? shellArg(f.folder) : "."} --recordset B…   (${f.files.length} file${f.files.length > 1 ? "s" : ""})`).join("\n"),
          });
        const only = folders.length === 1 && folders[0]!.folder ? path.join(inbox, folders[0]!.folder) : inbox;
        // a folder named in any Unicode form (NFD from a macOS shell, NFC on Linux)
        const inInbox = (a: string) => {
          const hit = folders.find((f) => f.folder && f.folder.normalize("NFC") === a.normalize("NFC").replace(/[\\/]+$/, ""));
          return hit ? path.join(inbox, hit.folder) : path.resolve(inbox, a);
        };
        paths = args.length ? args.map(inInbox) : [only];
        for (const p of paths)
          if (path.relative(inbox, p).startsWith("..")) throw new UsageError(`${ctx.display(p)} is not in the inbox`, { hint: "strom media add --inbox <folder in the inbox> --recordset B…" });
        // "." = the files lying in the inbox itself, not its folders
        paths = paths.flatMap((p) => (p === inbox ? (folders.find((f) => f.folder === "")?.files ?? []) : [p]));
      } else paths = args.map((a) => ctx.resolvePath(a));
      if (paths.length === 0) throw new UsageError("give files or folders, or --inbox");
      for (const p of paths) if (!fs.existsSync(p)) throw new UsageError(`no such file or folder: ${ctx.display(p)}`);
      const files = collectFiles(paths).filter((f) => IMAGE_EXT.has(path.extname(f).toLowerCase()));
      // numbers are read per folder: one download names its files one way
      const numbers = new Map<string, number | undefined>();
      for (const dir of new Set(files.map((f) => path.dirname(f)))) {
        const group = files.filter((f) => path.dirname(f) === dir);
        imageNumbers(group).forEach((n, i) => numbers.set(group[i]!, n));
      }
      if (files.length === 0) throw new UsageError("no images there", { hint: "JPEG, PNG, TIFF … files; documents go in with strom intake" });
      // a folder the user filled for a waiting task (strom task wait --images) says which book and which images
      const folderOf = (p: string) => (opts.inbox && !path.relative(inbox, p).startsWith("..") ? path.relative(inbox, p).split(path.sep)[0]?.normalize("NFC") : undefined);
      const folder = paths.length === 1 ? folderOf(paths[0]!) : undefined;
      const awaited = folder
        ? tree.list<Task>("task").find((t) => t.state === "waiting" && t.awaits && t.awaits.folder.normalize("NFC") === folder && (!opts.recordset || normId(String(opts.recordset), "recordset") === t.awaits.recordset))?.awaits
        : undefined;
      const named = folder ? /^([Bb]\d+)(?=\s|$)/.exec(folder)?.[1] : undefined;
      const recordset = opts.recordset
        ? requireRecord<RecordSet>(tree, String(opts.recordset), "recordset").id
        : (awaited?.recordset ?? (named && tree.get<RecordSet>(normId(named, "recordset")) ? normId(named, "recordset") : undefined));
      if (opts.image !== undefined && files.length > 1) throw new UsageError("--image is for one file; for many use --first or numbers in the file names");
      // a part of an image saved on its own: registered with its image, as a part fetched sharper is
      const wantsPart = opts.half !== undefined || opts.crop !== undefined;
      if (wantsPart && (files.length > 1 || !opts.recordset)) throw new UsageError("a part is one file of one image of a record set", { hint: "strom media add <file> --recordset B… --image <n> --half left" });
      const first = opts.first === undefined ? undefined : Number(opts.first);
      const items = files.map((file, i) => ({
        file,
        image: opts.image !== undefined ? Number(opts.image) : first !== undefined ? first + i : numbers.get(file),
        url: opts.url as string | undefined,
        // the original file name always stays: it is how the archive numbered the image
        from: opts.from ? `${opts.from} · ${path.basename(file)}` : path.basename(file),
      }));
      if (wantsPart && recordset) {
        const it = items[0]!;
        if (it.image === undefined) throw new UsageError("which image is it a part of? --image <n>", { hint: "strom media add <file> --recordset B… --image <n> --half left" });
        const whole = findImage(tree.list<Media>("media").filter((m) => !m.part), recordset, it.image);
        (it as { part?: Region }).part = partRegion(opts, whole);
      }
      if (recordset) {
        // an image of a book without its number cannot be cited — nor found again
        const bare = items.filter((it) => it.image === undefined);
        if (bare.length)
          throw new UsageError(`${bare.length} file(s) without an image number in the name: ${bare.slice(0, 5).map((it) => path.basename(it.file)).join(", ")}${bare.length > 5 ? " …" : ""}`, {
            hint: "name each by its number as the portal's viewer counts it (9.jpg), or --image <n> for one file, --first <n> for files in order",
          });
        // saved under the portal's own file name, a number can mean something else (×10, a call number)
        const want = awaited ? parseImageList(awaited.images) : undefined;
        if (want && !opts.first && opts.image === undefined && !items.some((it) => want.includes(it.image!)))
          throw new UsageError(`images ${awaited!.images} of ${recordset} were asked for, but the file names give ${runs(items.map((it) => it.image!))}`, {
            hint: "rename the files by the image number the viewer shows (9.jpg), or --image <n> for one file",
          });
      }
      const { added, again, woken, clashes, copies } = registerImages(tree, shared, items, recordset);
      if (opts.inbox && !tree.dryRun) {
        for (const f of files) fs.rmSync(f, { force: true }); // now in the store
        for (const p of paths) if (p !== inbox && fs.existsSync(p) && fs.statSync(p).isDirectory() && collectFiles([p]).length === 0) fs.rmSync(p, { recursive: true, force: true });
      }
      const nums = added.map((m) => m.image).filter((n): n is number => n !== undefined);
      const text = lines(
        added.length
          ? `${added.length} image(s) registered: ${added[0]!.id}${added.length > 1 ? `–${added.at(-1)!.id}` : ""}${recordset ? ` of ${recordset}` : ""}${nums.length ? ` (images ${runs(nums)})` : ""}`
          : "no new images",
        again.length ? `${again.length} already registered (same content): ${again.slice(0, 5).join(" ")}${again.length > 5 ? " …" : ""}` : undefined,
        ...clashes.slice(0, 10).map((c) => `⚠ ${c}`),
        ...copies.slice(0, 10),
        copies.length > 10 ? `… and ${copies.length - 10} more images with a sharper copy` : undefined,
        woken.length ? `back in the queue (they waited for these images): ${woken.join(" ")}` : undefined,
        tree.dryRun ? "(dry run — nothing written)" : undefined,
        added[0] ? `\nlook at one: strom media view ${recordset && added[0].image !== undefined ? `${recordset}:${added[0].image}` : added[0].id} --grid` : undefined,
      );
      return { text, data: { added: added.map((m) => ({ id: m.id, image: m.image })), again, woken, clashes, copies } };
    },
  },
  {
    path: ["media", "list"],
    summary: "Registered images (of one record set, a range of images)",
    group: "sources",
    tree: true,
    options: [
      { name: "recordset", type: "string", value: "<B…>", description: "only this record set" },
      { name: "images", type: "string", value: "<from-to>", description: "only these image numbers, e.g. 90-120" },
    ],
    run(ctx, { opts }) {
      const tree = ctx.tree();
      let all = tree.list<Media>("media");
      if (opts.recordset) {
        const b = requireRecord<RecordSet>(tree, String(opts.recordset), "recordset").id;
        all = all.filter((m) => m.recordset === b);
      }
      if (opts.images) {
        const m = /^(\d+)(?:-(\d+))?$/.exec(String(opts.images));
        if (!m) throw new UsageError("--images must be like 90-120");
        const lo = Number(m[1]);
        const hi = Number(m[2] ?? m[1]);
        all = all.filter((x) => x.image !== undefined && x.image >= lo && x.image <= hi);
      }
      all.sort((a, b) => (a.recordset ?? "").localeCompare(b.recordset ?? "") || (a.image ?? 0) - (b.image ?? 0) || Number(!!a.part) - Number(!!b.part));
      const page = paginate(all, ctx.limit, ctx.page);
      return {
        text: all.length
          ? lines(
              table(page.items.map((m) => [m.id, m.recordset ? `${m.recordset}:${m.image ?? "?"}` : "", m.part ? `part ${regionText(m.part)}` : "", pageLabel(tree, m), m.width ? `${m.width}×${m.height}` : "", `${Math.round(m.size / 1024)} kB`])),
              moreLine(page, "strom media list"),
            )
          : "no images registered → strom media add <folder> --recordset B…",
        data: { total: all.length, media: page.items.map((m) => ({ id: m.id, recordset: m.recordset, image: m.image, part: m.part, page: pageLabel(tree, m) || undefined, width: m.width, height: m.height })) },
      };
    },
  },
  {
    path: ["media", "show"],
    summary: "One image: where it is from, its page, the sources on it",
    group: "sources",
    tree: true,
    args: [{ name: "image", description: "M0012 or B0001:57", required: true }],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const t = resolveTarget(tree, sharedDir(ctx), args[0]!, opts);
      const m = t.media;
      if (!m) throw new UsageError("not a registered image", { hint: "strom media list" });
      const sources = tree.list<Source>("source").filter((s) => s.media?.includes(m.id));
      const b = m.recordset ? tree.get<RecordSet>(m.recordset) : undefined;
      const all = tree.list<Media>("media");
      const parts = !m.part && m.recordset && m.image !== undefined ? all.filter((x) => x.part && !x.retracted && x.recordset === m.recordset && x.image === m.image) : [];
      const copies = otherCopies(all, m);
      const image = copies.length && m.recordset && m.image !== undefined ? findImage(all, m.recordset, m.image) : undefined;
      return {
        text: lines(
          `${m.id} ${m.part ? `part ${regionText(m.part)} of ` : ""}${b ? `image ${m.image ?? "?"} of ${b.id} ${b.title}` : "image"}${pageLabel(tree, m) ? ` · page ${pageLabel(tree, m)}` : ""}`,
          `${m.width ? `${m.width}×${m.height} px · ` : ""}${Math.round(m.size / 1024)} kB · ${m.mime}${m.from ? ` · from ${m.from}` : ""}${m.url ? ` · ${m.url}` : ""}`,
          m.retracted ? `RETRACTED ${m.retracted.at.slice(0, 10)}: ${m.retracted.reason} — no view, part or excerpt uses it` : undefined,
          parts.length ? `parts of it, sharper (a view of the image uses them by itself): ${parts.map((p) => `${p.id} ${regionText(p.part!)}${p.width ? ` ${p.width}×${p.height}` : ""}`).join(" · ")}` : undefined,
          copies.length
            ? `other copies of the image: ${copies.map((c) => `${c.id}${c.width ? ` ${c.width}×${c.height}` : ""}`).join(" · ")} — the image is the sharpest (${image!.id}); a view of any copy uses it`
            : undefined,
          sources.length ? `sources on it: ${sources.map((s) => `${s.id} ${s.title}`).join(" · ")}` : "no source cites it yet",
          `view: strom media view ${m.id} [--half left|right] [--crop x,y,w,h] [--grid]`,
        ),
        data: { media: m, parts: parts.map((p) => p.id), copies: copies.map((c) => c.id), sources: sources.map((s) => s.id), page: pageLabel(tree, m) || undefined },
      };
    },
  },
  {
    path: ["media", "retract"],
    summary: "Withdraw an image registered wrongly — another book's, a wrong number, a part put in the wrong place (kept, marked retracted)",
    group: "sources",
    tree: true,
    writes: true,
    description:
      "The image stays in the research with the reason, but no view, sharper part or excerpt uses it any more, and its\n" +
      "file can be registered again where it belongs. An image a source still cites is not withdrawn: move the\n" +
      "source to the right image first (strom source edit S… --clip …, --clip-remove).",
    args: [{ name: "image", description: "M0012", required: true }],
    examples: ['strom media retract M0001 --reason "a part of another book\'s image 340, not of this one"'],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      if (!opts.reason) throw new UsageError("--reason is required", { hint: 'say why: --reason "another book\'s image, same number"' });
      const m = requireRecord<Media>(tree, normId(args[0]!), "media");
      if (m.retracted) return { text: `${m.id} is already retracted: ${m.retracted.reason}`, data: { media: m } };
      const citing = tree.list<Source>("source").filter((s) => !s.retracted && (s.media?.includes(m.id) || s.clips?.some((c) => c.media === m.id)));
      if (citing.length)
        throw new UsageError(`${m.id} is cited by ${citing.map((s) => s.id).join(", ")}`, { hint: `move them to the right image first: strom source show ${citing[0]!.id}` });
      const out = update<Media>(tree, m.id, "media", (x) => ({ ...x, retracted: { at: now(), reason: String(opts.reason) } }), { op: "media.retract", summary: `${m.id} retracted: ${truncate(String(opts.reason), 80)}` });
      return { text: lines(...tree.written.map((o) => o.summary)), data: { media: out } };
    },
  },
  {
    path: ["media", "view"],
    summary: "Make a view of an image to look at: a crop, a half page, enlarged, more contrast, a grid",
    group: "sources",
    tree: true,
    description:
      `Writes the view to .strom/views/ and prints its path: open that file with your image reader. Views are at most\n` +
      `${VIEW_MAX} px on the long side unless --scale says otherwise. Browse whole images reduced; read an entry by\n` +
      "cropping it — use --grid first to see where it is (the labels are tenths of the image).",
    args: [{ name: "image", description: "M0012, B0001:57 (record set:image), B0001 with --page, or an input I0002", required: true }],
    options: [
      { name: "crop", type: "string", value: "<x,y,w,h>", description: "part of the image: fractions (0.1,0.35,0.4,0.2) or pixels" },
      { name: "half", type: "string", value: "<side>", description: "left or right page of a double page (top, bottom)" },
      { name: "scale", type: "string", value: "<f>", description: "size of the result: 2 = twice the original pixels" },
      { name: "max", type: "string", value: "<px>", description: `longest side when not scaled (default ${VIEW_MAX})` },
      { name: "contrast", type: "boolean", description: "stretch faded ink (on the part shown)" },
      { name: "grey", type: "boolean", description: "greyscale" },
      { name: "grid", type: "boolean", description: "overlay a grid of tenths with labels, to point at a place" },
      { name: "rotate", type: "string", value: "<deg>", description: "90, 180 or 270" },
      { name: "image", type: "string", value: "<n>", description: "image number, with a record set ID" },
      { name: "page", type: "string", value: "<n>", description: "page or folio, with a calibrated record set ID" },
      { name: "png", type: "boolean", description: "lossless PNG instead of JPEG" },
    ],
    examples: [
      "strom media view B0001:2 --grid",
      "strom media view B0001:2 --half left --contrast",
      "strom media view M0001 --crop 0.05,0.40,0.45,0.18",
      "strom media view B0001 --page 112",
    ],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const shared = sharedDir(ctx);
      const t = resolveTarget(tree, shared, args[0]!, opts);
      const spec = viewSpec(opts);
      const all = tree.list<Media>("media");
      // a part of the image fetched sharper (or a sharper copy of all of it) shows the same place with more detail: it is used by itself
      let shown = t.media;
      let v;
      let sharper: { part: Media; gain: number } | undefined;
      if (t.media?.width && t.media.height && !t.media.part) {
        const px = viewRegion(spec, t.media.width, t.media.height);
        const s = sharperPart(all, t.media, { x: px.x / t.media.width, y: px.y / t.media.height, w: px.w / t.media.width, h: px.h / t.media.height });
        if (s) {
          sharper = s;
          shown = s.part;
          const whole = !s.part.part && !spec.crop && !spec.half;
          v = makeView(tree, path.join(shared, s.part.file), s.part.id, { ...spec, half: undefined, crop: whole ? undefined : regionText(s.crop) });
        }
      }
      v ??= makeView(tree, t.file, t.key, spec);
      const page = t.media ? pageLabel(tree, t.media) : "";
      // still too little detail: a connector that fetched the image may fetch this part of it sharper
      const base = shown?.part ?? { x: 0, y: 0, w: 1, h: 1 };
      const inWhole: Region = {
        x: base.x + (v.region.x / v.original.width) * base.w,
        y: base.y + (v.region.y / v.original.height) * base.h,
        w: (v.region.w / v.original.width) * base.w,
        h: (v.region.h / v.original.height) * base.h,
      };
      const whole = t.media?.recordset !== undefined && t.media.image !== undefined ? findImage(all, t.media.recordset, t.media.image) : undefined;
      const from = whole?.fetched ? listConnectors(shared).find((c) => c.name === whole.fetched!.connector) : undefined;
      const canPart = from && from.manifest.can.includes("part") && from.manifest.policy.automation !== "manual" && !missingConsents(ctx.env, from).code;
      const fetchPart =
        canPart && v.scale > 1.25 && inWhole.w * inWhole.h < 0.9
          ? `strom fetch ${from.name} --recordset ${whole!.recordset} --images ${whole!.image} --crop ${regionText(inWhole)}`
          : undefined;
      // The same part as a clip of the source read in it: of the whole image where it is registered.
      const clip =
        !t.media || (!spec.crop && !spec.half)
          ? undefined
          : whole && !whole.part
            ? clipText({ media: whole.id, region: inWhole })
            : clipText({ media: t.key, region: { x: v.region.x / v.original.width, y: v.region.y / v.original.height, w: v.region.w / v.original.width, h: v.region.h / v.original.height } });
      return {
        text: lines(
          describeView(v, (p) => ctx.display(p), fetchPart),
          clip ? `the source of an entry read here: --clip ${clip}` : undefined,
          sharper
            ? `from ${sharper.part.id}, ${sharper.part.part ? "a part of the image fetched sharper" : "a sharper copy of the image"} (${sharper.gain.toFixed(1)}× the detail of ${sharper.part.part ? "the whole image" : t.media!.id})`
            : undefined,
          page ? `page ${page}` : undefined,
        ),
        data: { view: v.file, width: v.width, height: v.height, scale: v.scale, region: v.region, original: v.original, image: t.key, ...(sharper ? { from: sharper.part.id } : {}), page: page || undefined, ...(clip ? { clip } : {}) },
      };
    },
  },
);
