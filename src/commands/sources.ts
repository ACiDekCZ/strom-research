// source · cite · repo · recordset · place — where the evidence comes from.

import { OFF_MAP_HOW, offMapLine, placesOffMap } from "../core/places.ts";
import fs from "node:fs";
import { commands, register, type CommandDef, type Input } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { lines, moreLine, paginate, table, truncate } from "../cli/format.ts";
import { UsageError } from "../core/errors.ts";
import {
  ACCESS,
  AUTOMATION,
  JURISDICTIONS,
  SOURCE_KINDS,
  type Calibration,
  type Citation,
  type Clip,
  type Family,
  type Media,
  type Person,
  type Place,
  type RecordSet,
  type Repository,
  type Source,
} from "../core/model.ts";
import { create, csvOpt, listOpt, normId, requireRecord, textOpt, update } from "../core/records.ts";
import { makeNote, parseDate } from "../core/actions.ts";
import { calibrationLine, fitCalibration } from "../core/calibration.ts";
import { foldText } from "../core/text.ts";
import { clipNote, clipText, imageOfRef, MAX_CLIPS, transcriptNote } from "../core/media.ts";
import { partRegion } from "../core/views.ts";
import { formatName } from "../core/people.ts";
import type { Tree } from "../core/tree.ts";

function written(tree: Tree): string {
  return lines(...tree.written.map((o) => o.summary), tree.dryRun ? "(dry run — nothing written)" : undefined);
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], name: string, fallback: T): T {
  if (v === undefined) return fallback;
  if (!allowed.includes(v as T)) throw new UsageError(`invalid --${name} "${String(v)}"`, { hint: allowed.join(", ") });
  return v as T;
}

/** Like oneOf, but nothing when the option was not given (for edits). */
function optOneOf<T extends string>(v: unknown, allowed: readonly T[], name: string): T | undefined {
  return v === undefined ? undefined : oneOf(v, allowed, name, allowed[0]!);
}

/** "B0001:57" or "M0012" → a registered image. Only registered images can be cited. */
function mediaRefs(tree: Tree, refs: string[]): string[] {
  return refs.map((ref) => {
    const at = /^([Bb]\d+):(\d+)$/.exec(ref);
    if (!at) return requireRecord<Media>(tree, ref, "media").id;
    const b = requireRecord<RecordSet>(tree, at[1]!, "recordset").id;
    const m = imageOfRef(tree.list<Media>("media"), b, Number(at[2]));
    if (!m) throw new UsageError(`image ${at[2]} of ${b} is not registered`, { hint: `strom media add <file> --recordset ${b} --image ${at[2]}` });
    return m.id;
  });
}

/**
 * Where the entry is on an image, as its view was cut: "M0012@0.05,0.4,0.45,0.18", "B0001:57@left:0.1,0.4,0.8,0.1"
 * (a half, then a crop within it), pixels of the registered image, or "M0012" alone (the entry is the whole image).
 */
function clipRefs(tree: Tree, specs: string[]): Clip[] {
  return specs.map((spec) => {
    const m = /^([^@]+?)(?:@(.+))?$/.exec(spec.trim()) ?? [];
    let [ref, where] = [m[1] ?? "", m[2]];
    // "M0012:0.1,0.2,0.3,0.1" — the colon of a record set's image number stays hers
    const colon = !where && /^([Mm]\d+):(.+)$/.exec(ref);
    if (colon) [ref, where] = [colon[1]!, colon[2]!];
    const media = mediaRefs(tree, [ref])[0]!;
    if (!where) return { media, region: { x: 0, y: 0, w: 1, h: 1 } };
    const w = /^(?:(left|right|top|bottom)(?::|$))?(.*)$/.exec(where.trim())!;
    const region = partRegion({ half: w[1], crop: w[2] || undefined }, tree.get<Media>(media));
    return { media, region };
  });
}

/** "Teinitz an der Elbe@de:1850-1918" → another name of a place. */
function altName(a: string): Place["names"][number] {
  const m = /^(.+?)(?:@([a-z]{2,3}))?(?::(\d{3,4})?-(\d{3,4})?)?$/.exec(a);
  if (!m) throw new UsageError(`invalid --alt "${a}"`, { hint: 'e.g. "Teinitz an der Elbe@de:1850-1918"' });
  const n: Place["names"][number] = { name: m[1]!.trim() };
  if (m[2]) n.lang = m[2];
  if (m[3]) n.from = Number(m[3]);
  if (m[4]) n.to = Number(m[4]);
  return n;
}

/**
 * An edit: only the options given change; --note adds a note. Overwriting a
 * value an evidence field already had (what a record says, where it is) needs
 * --reason; filling in an empty one does not.
 */
function editFields<T extends Source | Repository | RecordSet | Place>(
  tree: Tree,
  ref: string,
  type: "source" | "repository" | "recordset" | "place",
  fields: Record<string, unknown>,
  /** Evidence fields, with the value that means "not known yet" (filling it in is no change). */
  evidence: Record<string, unknown>,
  opts: Input["opts"],
  merge: (cur: T) => Partial<T> = () => ({}),
): T {
  const id = requireRecord<T>(tree, ref, type).id;
  const given = Object.entries(fields).filter(([, v]) => v !== undefined && !(Array.isArray(v) && v.length === 0));
  const note = str(opts.note);
  const reason = str(opts.reason);
  return update<T>(
    tree,
    id,
    type,
    (cur) => {
      const merged = merge(cur);
      const changes = { ...Object.fromEntries(given), ...merged } as Record<string, unknown>;
      const keys = Object.keys(changes);
      if (!keys.length && !note) throw new UsageError("nothing to change", { hint: `strom help ${type === "repository" ? "repo" : type} edit` });
      const old = cur as unknown as Record<string, unknown>;
      const overwritten = keys.filter((k) => k in evidence && old[k] !== undefined && old[k] !== evidence[k] && JSON.stringify(old[k]) !== JSON.stringify(changes[k]));
      if (overwritten.length && !reason)
        throw new UsageError(`changing ${overwritten.join(", ")} of ${id} needs --reason`, { hint: 'what a record says is evidence: e.g. --reason "re-read at full resolution"' });
      return { ...cur, ...changes, ...(note ? { notes: [...cur.notes, makeNote(tree, note)] } : {}) };
    },
    { op: `${type}.edit`, summary: `${id} ${[...given.map(([k]) => k), ...(note ? ["note"] : [])].join(", ") || "edited"}`, reason },
  );
}

/** The options of an add command, for its edit: all optional, no defaults. */
function editOptions(options: CommandDef["options"], extra: NonNullable<CommandDef["options"]> = []): NonNullable<CommandDef["options"]> {
  return [...extra, ...(options ?? []).map((o) => ({ ...o, description: o.description.replace(/\s*\(default[^)]*\)/, "") }))];
}

function readText(ctx: Context) {
  return (p: string) => fs.readFileSync(ctx.resolvePath(p), "utf8");
}

function matches(text: string | undefined, q: string): boolean {
  return !!text && foldText(text).includes(foldText(q));
}

// ── sources ────────────────────────────────────────────────────────────────

register(
  {
    path: ["source", "add"],
    summary: "Add a source: one record, document or tree that says something",
    group: "sources",
    tree: true,
    writes: true,
    description:
      "An original register entry or certificate is primary evidence; family trees and memories are\n" +
      "authored/derivative — facts citing only them stay leads. --transcript @file reads a file.",
    args: [{ name: "title", description: 'short title: "Baptism of Jan Novák, Týnec 1905"', required: true }],
    options: [
      { name: "kind", type: "string", value: "<kind>", description: `${SOURCE_KINDS.slice(0, 8).join(", ")}, … (default other)` },
      { name: "recordset", type: "string", value: "<B…>", description: "the book or collection it is in" },
      { name: "repo", type: "string", value: "<R…>", description: "archive holding it" },
      { name: "input", type: "string", value: "<I…>", description: "the input (document from the user) it comes from" },
      { name: "locator", type: "string", value: "<where>", description: "folio, page, entry number, image" },
      { name: "date", type: "string", value: "<date>", description: "when the record was made (GEDCOM date)" },
      { name: "transcript", type: "string", value: "<text|@file>", description: "word-for-word transcription, original language" },
      { name: "translation", type: "string", value: "<text|@file>", description: "translation into the research language" },
      { name: "language", type: "string", value: "<code>", description: "language of the record, e.g. la, de, cs" },
      { name: "information", type: "string", value: "<kind>", description: "primary (eyewitness), secondary, unknown (default)" },
      { name: "form", type: "string", value: "<form>", description: "original (default), derivative (copy, index — the default for --kind index and in a record set of kind index only), authored (compiled work)" },
      { name: "url", type: "string", value: "<url>", description: "link to the image or catalog entry" },
      { name: "media", type: "string", multiple: true, value: "<M…|B…:n>", description: "the registered image(s) the record is on (repeatable)" },
      {
        name: "clip",
        type: "string",
        multiple: true,
        value: "<M…@x,y,w,h>",
        description: "where the entry itself is on its image — the crop you read it in (the view prints it); a second one when it runs over a page break",
      },
      { name: "note", type: "string", value: "<text>", description: "short note" },
    ],
    examples: [
      'strom source add "Křest Jana Nováka 1905" --kind baptism --recordset B0001 --locator "fol. 45, č. 12" --language la --information primary --transcript @zapis.txt --clip B0001:2@0.05,0.40,0.45,0.18',
      'strom source add "Rodinný strom od tety Marie" --kind family-tree --form authored --input I0001',
    ],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const book = opts.recordset ? requireRecord<RecordSet>(tree, opts.recordset as string, "recordset") : undefined;
      if (opts.repo) requireRecord(tree, opts.repo as string, "repository");
      if (opts.input) requireRecord(tree, opts.input as string, "input");
      const clips = clipRefs(tree, listOpt(opts.clip));
      if (clips.length > MAX_CLIPS) throw new UsageError(`at most ${MAX_CLIPS} clips: an entry, and its continuation over a page break`);
      const media = [...new Set([...mediaRefs(tree, csvOpt(opts.media)), ...clips.map((c) => c.media)])];
      // a line of an index is a copy made by another hand; a book with its own index holds originals too
      const kind = oneOf(opts.kind, SOURCE_KINDS, "kind", "other");
      const form = kind === "index" || (book && book.kinds.length > 0 && book.kinds.every((k) => k === "index")) ? "derivative" : "original";
      const src = create<Source>(
        tree,
        "source",
        {
          kind,
          title: args[0]!.trim(),
          recordset: opts.recordset ? normId(opts.recordset as string) : undefined,
          repository: opts.repo ? normId(opts.repo as string) : undefined,
          input: opts.input ? normId(opts.input as string) : undefined,
          locator: str(opts.locator),
          date: parseDate(opts.date as string | undefined, "record date"),
          transcript: textOpt(opts.transcript, readText(ctx)),
          translation: textOpt(opts.translation, readText(ctx)),
          language: str(opts.language)?.toLowerCase(),
          information: oneOf(opts.information, ["primary", "secondary", "unknown"] as const, "information", "unknown"),
          form: oneOf(opts.form, ["original", "derivative", "authored"] as const, "form", form),
          url: str(opts.url),
          accessed: str(opts.url) ? new Date().toISOString().slice(0, 10) : undefined,
          ...(media.length ? { media } : {}),
          ...(clips.length ? { clips } : {}),
          note: str(opts.note),
        },
        (id) => `+${id} source "${truncate(args[0]!, 60)}"${media.length ? ` on ${media.join(" ")}` : ""}`,
        media,
      );
      return { text: lines(written(tree), clipNote(tree, src), transcriptNote(tree, src), "", `cite it: strom cite <event> ${src.id} --locator "…"`), data: { source: src } };
    },
  },
  {
    path: ["source", "list"],
    summary: "List sources (filter by text, kind, recordset)",
    group: "sources",
    tree: true,
    args: [{ name: "filter", description: "text in title, locator or transcript" }],
    options: [
      { name: "kind", type: "string", value: "<kind>", description: "only this kind" },
      { name: "recordset", type: "string", value: "<B…>", description: "only from this recordset" },
      { name: "full", type: "boolean", description: "--json: whole records instead of one row each" },
    ],
    run(ctx: Context, { args, opts }: Input) {
      const tree = ctx.tree();
      let all = tree.list<Source>("source").filter((s) => !s.retracted);
      if (args[0]) all = all.filter((s) => matches(s.title, args[0]!) || matches(s.locator, args[0]!) || matches(s.transcript, args[0]!));
      if (opts.kind) all = all.filter((s) => s.kind === opts.kind);
      if (opts.recordset) all = all.filter((s) => s.recordset === normId(opts.recordset as string));
      const page = paginate(all, ctx.limit, ctx.page);
      const text = all.length
        ? lines(table(page.items.map((s) => [s.id, s.kind, truncate(s.title, 60), s.locator ?? "", s.form === "original" ? "" : s.form])), moreLine(page, "strom source list"))
        : "no sources match";
      const rows = opts.full ? page.items : page.items.map((s) => ({ id: s.id, kind: s.kind, title: s.title, locator: s.locator, form: s.form, information: s.information }));
      return { text, data: { total: page.total, sources: rows } };
    },
  },
  {
    path: ["source", "show"],
    summary: "One source with its transcript and every fact that cites it",
    group: "sources",
    tree: true,
    args: [{ name: "source", description: "source ID (S0001)", required: true }],
    run(ctx, { args }) {
      const tree = ctx.tree();
      const s = requireRecord<Source>(tree, args[0]!, "source");
      const citing: string[] = [];
      const at = (c: Citation) => (c.locator ? ` (${c.locator})` : "");
      for (const p of tree.list<Person>("person")) {
        for (const n of p.names) for (const c of n.citations ?? []) if (c.source === s.id) citing.push(`${p.id} name ${formatName(n)}${at(c)}`);
        for (const e of p.events) for (const c of e.citations) if (c.source === s.id) citing.push(`${p.id} ${e.id} ${e.kind}${at(c)}`);
      }
      for (const f of tree.list<Family>("family")) {
        for (const c of f.citations ?? []) if (c.source === s.id) citing.push(`${f.id} the family${at(c)}`);
        for (const e of f.events) for (const c of e.citations) if (c.source === s.id) citing.push(`${f.id} ${e.id} ${e.kind}${at(c)}`);
      }
      const text = lines(
        `${s.id} ${s.title}`,
        `kind ${s.kind} · ${s.form} · information ${s.information}${s.language ? ` · language ${s.language}` : ""}${s.date ? ` · dated ${s.date}` : ""}`,
        s.recordset || s.repository ? `in     ${[s.recordset, s.repository].filter(Boolean).join(" · ")}${s.locator ? ` · ${s.locator}` : ""}` : s.locator ? `at     ${s.locator}` : undefined,
        s.url ? `url    ${s.url}` : undefined,
        s.media?.length ? `images ${s.media.map((id) => { const m = tree.get<Media>(id); return m ? `${id}${m.recordset ? ` (${m.recordset}:${m.image ?? "?"})` : ""}` : id; }).join(" · ")} — strom media view <M…>` : undefined,
        s.clips?.length ? `clips  ${s.clips.map((c, i) => `${i + 1}. ${clipText(c)}`).join(" · ")} — where the entry is on its image` : undefined,
        s.transcript ? `\ntranscript\n${s.transcript}` : undefined,
        s.translation ? `\ntranslation\n${s.translation}` : undefined,
        citing.length ? `\ncited by\n${citing.map((c) => `  ${c}`).join("\n")}` : "\ncited by nothing yet",
        ...s.notes.map((n) => `note   ${n.text}`),
      );
      return { text, data: { source: s, citedBy: citing } };
    },
  },
);

// ── repositories ───────────────────────────────────────────────────────────

register(
  {
    path: ["repo", "add"],
    summary: "Add an archive, library or portal that holds records",
    group: "sources",
    tree: true,
    writes: true,
    description: "--automation says whether tools may download from it: record what its terms of use allow.",
    args: [{ name: "name", description: 'e.g. "SOA Praha (eBadatelna)"', required: true }],
    options: [
      { name: "country", type: "string", value: "<code>", description: "ISO country code, e.g. CZ, DE, PL" },
      { name: "region", type: "string", value: "<text>", description: "region it covers" },
      { name: "url", type: "string", value: "<url>", description: "website or portal" },
      { name: "terms", type: "string", value: "<text>", description: "terms of use in one sentence (+ link)" },
      { name: "automation", type: "string", value: "<a>", description: "allowed, manual (browser only), forbidden, unknown (default)" },
      { name: "note", type: "string", value: "<text>", description: "short note" },
    ],
    examples: ['strom repo add "State Archive, online reading room" --country CZ --url https://archive.example.org --automation manual'],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const r = create<Repository>(
        tree,
        "repository",
        {
          name: args[0]!.trim(),
          country: str(opts.country)?.toUpperCase(),
          region: str(opts.region),
          url: str(opts.url),
          terms: str(opts.terms),
          automation: oneOf(opts.automation, AUTOMATION, "automation", "unknown"),
          note: str(opts.note),
        },
        (id) => `+${id} repository "${args[0]}"`,
      );
      return { text: written(tree), data: { repository: r } };
    },
  },
  {
    path: ["repo", "list"],
    summary: "Archives and portals known in this tree",
    group: "sources",
    tree: true,
    run(ctx) {
      const all = ctx.tree().list<Repository>("repository");
      return {
        text: all.length ? table(all.map((r) => [r.id, r.name, r.country ?? "", r.automation, r.url ?? ""])) : 'none yet → strom repo add "<name>" --country <CC> --url <url>',
        data: { repositories: all },
      };
    },
  },
  {
    path: ["repo", "show"],
    summary: "One archive: terms, record sets, lessons",
    group: "sources",
    tree: true,
    args: [{ name: "repo", description: "repository ID (R0001)", required: true }],
    run(ctx, { args }) {
      const tree = ctx.tree();
      const r = requireRecord<Repository>(tree, args[0]!, "repository");
      const sets = tree.list<RecordSet>("recordset").filter((b) => b.repository === r.id);
      const text = lines(
        `${r.id} ${r.name}${r.country ? ` (${r.country}${r.region ? `, ${r.region}` : ""})` : ""}`,
        r.url ? `url         ${r.url}` : undefined,
        `automation  ${r.automation}${r.automation === "forbidden" ? " — never download with tools" : r.automation === "manual" ? " — browser only" : ""}`,
        r.terms ? `terms       ${r.terms}` : undefined,
        sets.length ? `\nrecord sets\n${table(sets.map((b) => [`  ${b.id}`, b.title, b.years ?? "", b.access]))}` : undefined,
        ...r.notes.map((n) => `note        ${n.text}`),
      );
      return { text, data: { repository: r, recordsets: sets } };
    },
  },
);

// ── record sets ────────────────────────────────────────────────────────────

register(
  {
    path: ["recordset", "add"],
    summary: "Add a book, film or collection of records (e.g. a parish register volume)",
    group: "sources",
    tree: true,
    writes: true,
    args: [{ name: "title", description: 'e.g. "Týnec nad Labem 17, births 1861–1869"', required: true }],
    options: [
      { name: "repo", type: "string", value: "<R…>", description: "archive holding it" },
      { name: "call-number", type: "string", value: "<sig>", description: "signature / call number" },
      { name: "kinds", type: "string", value: "<list>", description: "record kinds, comma separated: baptism,marriage,burial — with index when it is or has an index" },
      { name: "places", type: "string", value: "<list>", description: "places covered, comma separated" },
      { name: "years", type: "string", value: "<from-to>", description: "e.g. 1784-1820" },
      { name: "access", type: "string", value: "<a>", description: `${ACCESS.join(", ")} (default unknown)` },
      { name: "url", type: "string", value: "<url>", description: "link to the images or catalog" },
      { name: "images", type: "string", value: "<n>", description: "number of images" },
      { name: "layout", type: "string", value: "<text>", description: "how pages are laid out (columns, two years per page, …)" },
      { name: "note", type: "string", value: "<text>", description: "short note" },
    ],
    examples: ['strom recordset add "Týnec nad Labem 17, N 1861-1869" --repo R0001 --kinds baptism --places "Týnec nad Labem,Bělušice" --years 1861-1869 --access online-free --url https://…'],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      if (opts.repo) requireRecord(tree, opts.repo as string, "repository");
      const years = str(opts.years);
      if (years && !/^\d{3,4}(-\d{3,4})?$/.test(years)) throw new UsageError(`invalid --years "${years}"`, { hint: "use 1784 or 1784-1820" });
      const images = opts.images === undefined ? undefined : Number(opts.images);
      if (images !== undefined && (!Number.isInteger(images) || images < 1)) throw new UsageError("--images must be a positive number");
      const b = create<RecordSet>(
        tree,
        "recordset",
        {
          title: args[0]!.trim(),
          repository: opts.repo ? normId(opts.repo as string) : undefined,
          callNumber: str(opts["call-number"]),
          kinds: csvOpt(opts.kinds),
          places: csvOpt(opts.places),
          years,
          access: oneOf(opts.access, ACCESS, "access", "unknown"),
          url: str(opts.url),
          images,
          calibration: [],
          layout: str(opts.layout),
          note: str(opts.note),
        },
        (id) => `+${id} record set "${truncate(args[0]!, 60)}"`,
      );
      return { text: written(tree), data: { recordset: b } };
    },
  },
  {
    path: ["recordset", "list"],
    summary: "Books and collections known in this tree",
    group: "sources",
    tree: true,
    args: [{ name: "filter", description: "text in title, place or call number" }],
    options: [{ name: "full", type: "boolean", description: "--json: whole records instead of one row each" }],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      let all = tree.list<RecordSet>("recordset");
      if (args[0]) all = all.filter((b) => matches(b.title, args[0]!) || b.places.some((p) => matches(p, args[0]!)) || matches(b.callNumber, args[0]!));
      return {
        text: all.length ? table(all.map((b) => [b.id, truncate(b.title, 60), b.years ?? "", b.access, b.calibration.length ? "calibrated" : ""])) : "no record sets match",
        data: { recordsets: opts.full ? all : all.map((b) => ({ id: b.id, title: b.title, years: b.years, access: b.access, places: b.places, calibrated: b.calibration.length > 0 })) },
      };
    },
  },
  {
    path: ["recordset", "show"],
    summary: "One record set: access, calibration, what has been searched in it",
    group: "sources",
    tree: true,
    args: [{ name: "recordset", description: "record set ID (B0001)", required: true }],
    run(ctx, { args }) {
      const tree = ctx.tree();
      const b = requireRecord<RecordSet>(tree, args[0]!, "recordset");
      const repo = b.repository ? tree.get<Repository>(b.repository) : undefined;
      const text = lines(
        `${b.id} ${b.title}`,
        repo ? `in          ${repo.id} ${repo.name}${b.callNumber ? ` · ${b.callNumber}` : ""} · automation ${repo.automation}` : b.callNumber ? `call number ${b.callNumber}` : undefined,
        `covers      ${[b.kinds.join(", "), b.places.join(", "), b.years].filter(Boolean).join(" · ") || "(not described)"}`,
        `access      ${b.access}${b.url ? ` · ${b.url}` : ""}${b.images ? ` · ${b.images} images` : ""}`,
        b.layout ? `layout      ${b.layout}` : undefined,
        calibrationLine(b),
        ...b.notes.map((n) => `note        ${n.text}`),
        "",
        `searched in it: strom searched ${b.id}`,
      );
      return { text, data: { recordset: b, calibration: fitCalibration(b.calibration) } };
    },
  },
  {
    path: ["recordset", "calibrate"],
    summary: "Record which page/folio is on which image (measured, never guessed)",
    group: "sources",
    tree: true,
    writes: true,
    description: "Measure at least two distant images. strom fits page = a·image + b and says if the book is not linear.",
    args: [{ name: "recordset", description: "record set ID (B0001)", required: true }],
    options: [{ name: "point", type: "string", multiple: true, value: "<image=page>", description: "a measured point, e.g. 95=189 or 12=7r (repeatable)" }],
    examples: ["strom recordset calibrate B0001 --point 95=189 --point 100=199"],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const raw = listOpt(opts.point);
      if (raw.length === 0) throw new UsageError("give at least one --point image=page");
      const points: Calibration[] = raw.map((p) => {
        const m = /^(\d+)\s*=\s*(.+)$/.exec(p);
        if (!m) throw new UsageError(`invalid --point "${p}"`, { hint: "use image=page, e.g. 95=189" });
        return { image: Number(m[1]), page: m[2]!.trim() };
      });
      const id = normId(args[0]!, "recordset");
      const b = update<RecordSet>(tree, id, "recordset", (r) => {
        const byImage = new Map(r.calibration.map((c) => [c.image, c]));
        for (const p of points) byImage.set(p.image, p);
        return { ...r, calibration: [...byImage.values()].sort((x, y) => x.image - y.image) };
      }, { op: "recordset.calibrate", summary: `${id} calibration ${points.map((p) => `${p.image}=${p.page}`).join(" ")}` });
      return { text: lines(written(tree), calibrationLine(b)), data: { recordset: b, fit: fitCalibration(b.calibration) } };
    },
  },
);

// ── places ─────────────────────────────────────────────────────────────────

function placeName(p: Place): string {
  return p.names[0]?.name ?? p.id;
}

export function findPlaces(tree: Tree, q: string): Place[] {
  const key = foldText(q);
  return tree.list<Place>("place").filter((p) => p.names.some((n) => foldText(n.name) === key || foldText(n.name).startsWith(key)));
}

register(
  {
    path: ["place", "add"],
    summary: "Add a place with its names over time, coordinates and parent place",
    group: "sources",
    tree: true,
    writes: true,
    args: [{ name: "name", description: "current name", required: true }],
    options: [
      { name: "alt", type: "string", multiple: true, value: "<name[@lang][:from-to]>", description: 'other name, e.g. "Teinitz an der Elbe@de:1850-1918" (repeatable)' },
      { name: "kind", type: "string", value: "<kind>", description: "village, town, parish, estate, district, …" },
      { name: "lat", type: "string", value: "<deg>", description: "latitude" },
      { name: "lon", type: "string", value: "<deg>", description: "longitude" },
      { name: "unlocated", type: "string", value: "<why>", description: "no coordinates yet, and why: not identified which of the places of this name it is (coordinates given later clear it)" },
      { name: "parent", type: "string", value: "<L…>", description: "place it belongs to" },
      { name: "note", type: "string", value: "<text>", description: "short note" },
    ],
    examples: ['strom place add "Týnec nad Labem" --alt "Teinitz an der Elbe@de" --kind town --lat 50.042 --lon 15.358', 'strom place add "Lhota" --kind village --unlocated "which Lhota: the record gives no parish"'],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const names: Place["names"] = [{ name: args[0]!.trim() }];
      for (const a of listOpt(opts.alt)) names.push(altName(a));
      const lat = opts.lat === undefined ? undefined : Number(opts.lat);
      const lon = opts.lon === undefined ? undefined : Number(opts.lon);
      if ((lat === undefined) !== (lon === undefined)) throw new UsageError("give both --lat and --lon");
      if (opts.parent) requireRecord(tree, opts.parent as string, "place");
      const existing = findPlaces(tree, args[0]!).filter((p) => foldText(placeName(p)) === foldText(args[0]!));
      const p = create<Place>(
        tree,
        "place",
        {
          names,
          kind: str(opts.kind),
          coords: lat !== undefined && lon !== undefined ? { lat, lon } : undefined,
          unlocated: lat === undefined ? str(opts.unlocated) : undefined,
          parent: opts.parent ? normId(opts.parent as string) : undefined,
          jurisdictions: [],
          note: str(opts.note),
        },
        (id) => `+${id} place "${args[0]}"`,
      );
      const warn = existing.length ? `note: a place with this name exists already: ${existing.map((e) => e.id).join(", ")}` : undefined;
      return { text: lines(written(tree), warn), data: { place: p } };
    },
  },
  {
    path: ["place", "list"],
    summary: "Places known in this tree — or, with --off-map, the places of facts not on the Strom app's map yet",
    group: "sources",
    tree: true,
    args: [{ name: "filter", description: "part of a name" }],
    options: [{ name: "off-map", type: "boolean", description: "places of facts without coordinates (no place record yet, or one without them), the most facts first" }],
    examples: ["strom place list", "strom place list --off-map"],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      if (opts["off-map"]) {
        const off = placesOffMap(tree);
        return {
          text: off.length ? lines(...off.map(offMapLine), OFF_MAP_HOW) : "every place of a fact is on the map (or says why not)",
          data: { offMap: off.map((m) => ({ name: m.name, events: m.events, place: m.place?.id })) },
        };
      }
      const all = args[0] ? tree.list<Place>("place").filter((p) => p.names.some((n) => matches(n.name, args[0]!))) : tree.list<Place>("place");
      return {
        text: all.length
          ? table(all.map((p) => [p.id, placeName(p), p.names.slice(1).map((n) => n.name).join(", "), p.jurisdictions.map((j) => `${j.kind}: ${j.name}`).join("; ")]))
          : "no places match",
        data: { places: all },
      };
    },
  },
  {
    path: ["place", "show"],
    summary: "One place: names, jurisdictions over time, where its records are",
    group: "sources",
    tree: true,
    args: [{ name: "place", description: "place ID (L0001) or name", required: true }],
    run(ctx, { args }) {
      const tree = ctx.tree();
      const ref = args[0]!;
      let p: Place;
      if (/^L\d+$/i.test(ref)) p = requireRecord<Place>(tree, ref, "place");
      else {
        const hits = findPlaces(tree, ref);
        if (hits.length !== 1) throw new UsageError(hits.length ? `"${ref}" matches ${hits.length} places` : `no place "${ref}"`, { hint: "strom place list" });
        p = hits[0]!;
      }
      const span = (from?: number, to?: number) => (from || to ? ` (${from ?? ""}–${to ?? ""})` : "");
      const text = lines(
        `${p.id} ${placeName(p)}${p.kind ? ` · ${p.kind}` : ""}${p.coords ? ` · ${p.coords.lat}, ${p.coords.lon}` : ""}`,
        p.names.length > 1 ? `names  ${p.names.map((n) => `${n.name}${n.lang ? `@${n.lang}` : ""}${span(n.from, n.to)}`).join(" · ")}` : undefined,
        p.parent ? `in     ${p.parent}` : undefined,
        p.jurisdictions.length
          ? "jurisdictions\n" +
              table(p.jurisdictions.map((j) => [`  ${j.kind}`, j.name + span(j.from, j.to), j.repository ?? "", (j.recordsets ?? []).join(" ")]))
          : "jurisdictions (none yet) → strom place jurisdiction " + p.id + " --kind parish --name …",
        ...p.notes.map((n) => `note   ${n.text}`),
      );
      return { text, data: { place: p } };
    },
  },
  {
    path: ["place", "jurisdiction"],
    summary: "Record which parish, civil office, estate … a place belonged to, and when",
    group: "sources",
    tree: true,
    writes: true,
    description: "This is how strom knows where the records of a place are for a given year.",
    args: [{ name: "place", description: "place ID (L0001)", required: true }],
    options: [
      { name: "kind", type: "string", value: "<kind>", description: JURISDICTIONS.join(", ") },
      { name: "name", type: "string", value: "<name>", description: "e.g. the parish name" },
      { name: "from", type: "string", value: "<year>", description: "since" },
      { name: "to", type: "string", value: "<year>", description: "until" },
      { name: "repo", type: "string", value: "<R…>", description: "archive holding its records" },
      { name: "recordset", type: "string", multiple: true, value: "<B…>", description: "its record sets (repeatable)" },
    ],
    examples: ["strom place jurisdiction L0001 --kind parish --name \"Týnec nad Labem\" --from 1784 --repo R0001 --recordset B0001"],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      if (!opts.kind || !opts.name) throw new UsageError("--kind and --name are required");
      const kind = oneOf(opts.kind, JURISDICTIONS, "kind", "other");
      const from = opts.from === undefined ? undefined : Number(opts.from);
      const to = opts.to === undefined ? undefined : Number(opts.to);
      if (opts.repo) requireRecord(tree, opts.repo as string, "repository");
      const recordsets = csvOpt(opts.recordset).map((b) => requireRecord<RecordSet>(tree, b, "recordset").id);
      const id = normId(args[0]!, "place");
      const p = update<Place>(tree, id, "place", (pl) => {
        const j: Place["jurisdictions"][number] = { kind, name: String(opts.name).trim() };
        if (from) j.from = from;
        if (to) j.to = to;
        if (opts.repo) j.repository = normId(opts.repo as string);
        j.recordsets = recordsets; // always a list, even an empty one: the record is validated so
        return { ...pl, jurisdictions: [...pl.jurisdictions, j] };
      }, { op: "place.jurisdiction", summary: `${id} ${kind} ${opts.name}` });
      return { text: written(tree), data: { place: p } };
    },
  },
);

// ── edits: the options of each add, all optional ──────────────────────────

function addOptions(path: string): CommandDef["options"] {
  return commands().find((d) => d.path.join(" ") === path)?.options;
}

register(
  {
    path: ["source", "edit"],
    summary: "Correct or complete a source: transcript, translation, evidence quality, images, where it is",
    group: "sources",
    tree: true,
    writes: true,
    description:
      "Only the options given change; --media adds images, --note adds a note. Changing what a record says or\n" +
      "how good it is (kind, form, information, date, locator, transcript, record set) needs --reason; filling in doesn't.",
    args: [{ name: "source", description: "source ID (S0001)", required: true }],
    options: [
      ...editOptions(addOptions("source add"), [{ name: "title", type: "string", value: "<text>", description: "a better title" }]).filter((o) => o.name !== "input"),
      { name: "clip-remove", type: "string", value: "<n|all>", description: "take away a clip that is wrong (its number in strom source show), or all of them" },
    ],
    examples: [
      'strom source edit S0001 --translation "Jan, son of Josef" --media B0001:2',
      'strom source edit S0001 --information secondary --reason "the entry was written years later"',
      "strom source edit S0001 --clip M0001@0.05,0.42,0.45,0.16",
    ],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      if (opts.recordset) requireRecord(tree, opts.recordset as string, "recordset");
      if (opts.repo) requireRecord(tree, opts.repo as string, "repository");
      const clips = clipRefs(tree, listOpt(opts.clip));
      const drop = str(opts["clip-remove"]);
      const media = [...new Set([...mediaRefs(tree, csvOpt(opts.media)), ...clips.map((c) => c.media)])];
      const s = editFields<Source>(
        tree,
        args[0]!,
        "source",
        {
          title: str(opts.title),
          kind: optOneOf(opts.kind, SOURCE_KINDS, "kind"),
          recordset: opts.recordset ? normId(opts.recordset as string) : undefined,
          repository: opts.repo ? normId(opts.repo as string) : undefined,
          locator: str(opts.locator),
          date: opts.date === undefined ? undefined : parseDate(opts.date as string, "record date"),
          transcript: textOpt(opts.transcript, readText(ctx)),
          translation: textOpt(opts.translation, readText(ctx)),
          language: str(opts.language)?.toLowerCase(),
          information: optOneOf(opts.information, ["primary", "secondary", "unknown"] as const, "information"),
          form: optOneOf(opts.form, ["original", "derivative", "authored"] as const, "form"),
          url: str(opts.url),
          accessed: str(opts.url) ? new Date().toISOString().slice(0, 10) : undefined,
        },
        { kind: "other", form: undefined, information: "unknown", date: undefined, locator: undefined, transcript: undefined, recordset: undefined },
        opts,
        (cur) => {
          let kept = cur.clips ?? [];
          if (drop === "all") kept = [];
          else if (drop !== undefined) {
            const n = Number(drop);
            if (!Number.isInteger(n) || n < 1 || n > kept.length)
              throw new UsageError(kept.length ? `--clip-remove takes 1–${kept.length} or all` : `${cur.id} has no clips`, { hint: `strom source show ${cur.id}` });
            kept = kept.filter((_, i) => i !== n - 1);
          }
          const next = [...kept, ...clips.filter((c) => !kept.some((k) => clipText(k) === clipText(c)))];
          if (next.length > MAX_CLIPS) throw new UsageError(`at most ${MAX_CLIPS} clips: an entry, and its continuation over a page break`, { hint: `take one away: --clip-remove <n> (strom source show ${cur.id})` });
          return {
            ...(media.some((m) => !(cur.media ?? []).includes(m)) ? { media: [...new Set([...(cur.media ?? []), ...media])] } : {}),
            ...(drop !== undefined || clips.length ? { clips: next.length ? next : undefined } : {}),
          };
        },
      );
      return { text: lines(written(tree), media.length ? clipNote(tree, s) : undefined, media.length || clips.length ? transcriptNote(tree, s) : undefined), data: { source: s } };
    },
  },
  {
    path: ["repo", "edit"],
    summary: "Correct or complete an archive: its terms of use, whether tools may download, its site",
    group: "sources",
    tree: true,
    writes: true,
    args: [{ name: "repo", description: "archive ID (R0001)", required: true }],
    options: editOptions(addOptions("repo add"), [{ name: "name", type: "string", value: "<text>", description: "its name" }]),
    examples: ['strom repo edit R0001 --automation forbidden --terms "no automated downloads (https://…/terms)"'],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const r = editFields<Repository>(
        tree,
        args[0]!,
        "repository",
        {
          name: str(opts.name),
          country: str(opts.country)?.toUpperCase(),
          region: str(opts.region),
          url: str(opts.url),
          terms: str(opts.terms),
          automation: optOneOf(opts.automation, AUTOMATION, "automation"),
        },
        {},
        opts,
      );
      return { text: written(tree), data: { repository: r } };
    },
  },
  {
    path: ["recordset", "edit"],
    summary: "Correct or complete a record set: what it covers (kinds, places, years), access, layout",
    group: "sources",
    tree: true,
    writes: true,
    description: "--kinds and --places replace the lists (comma separated).",
    args: [{ name: "recordset", description: "record set ID (B0001)", required: true }],
    options: editOptions(addOptions("recordset add"), [{ name: "title", type: "string", value: "<text>", description: "its title" }]),
    examples: ['strom recordset edit B0001 --places "Týnec nad Labem,Bělušice,Lžovice" --layout "two pages per image; baptisms left, burials right"'],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      if (opts.repo) requireRecord(tree, opts.repo as string, "repository");
      const years = str(opts.years);
      if (years && !/^\d{3,4}(-\d{3,4})?$/.test(years)) throw new UsageError(`invalid --years "${years}"`, { hint: "use 1784 or 1784-1820" });
      const images = opts.images === undefined ? undefined : Number(opts.images);
      if (images !== undefined && (!Number.isInteger(images) || images < 1)) throw new UsageError("--images must be a positive number");
      const b = editFields<RecordSet>(
        tree,
        args[0]!,
        "recordset",
        {
          title: str(opts.title),
          repository: opts.repo ? normId(opts.repo as string) : undefined,
          callNumber: str(opts["call-number"]),
          kinds: csvOpt(opts.kinds),
          places: csvOpt(opts.places),
          years,
          access: optOneOf(opts.access, ACCESS, "access"),
          url: str(opts.url),
          images,
          layout: str(opts.layout),
        },
        {},
        opts,
      );
      return { text: written(tree), data: { recordset: b } };
    },
  },
  {
    path: ["place", "edit"],
    summary: "Complete a place: other names, kind, coordinates, the place it belongs to",
    group: "sources",
    tree: true,
    writes: true,
    description: "--alt adds names; a place's names are never removed.",
    args: [{ name: "place", description: "place ID (L0001)", required: true }],
    options: editOptions(addOptions("place add")),
    examples: ['strom place edit L0001 --alt "Teinitz an der Elbe@de:1850-1918" --lat 50.042 --lon 15.358', 'strom place edit L0001 --unlocated "two villages of this name in the district; the record does not say which"'],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const lat = opts.lat === undefined ? undefined : Number(opts.lat);
      const lon = opts.lon === undefined ? undefined : Number(opts.lon);
      if ((lat === undefined) !== (lon === undefined)) throw new UsageError("give both --lat and --lon");
      if ((lat !== undefined && !Number.isFinite(lat)) || (lon !== undefined && !Number.isFinite(lon))) throw new UsageError("--lat and --lon are numbers, e.g. 50.042");
      if (opts.parent) requireRecord(tree, opts.parent as string, "place");
      const alt = listOpt(opts.alt).map(altName);
      const p = editFields<Place>(
        tree,
        args[0]!,
        "place",
        {
          kind: str(opts.kind),
          coords: lat !== undefined && lon !== undefined ? { lat, lon } : undefined,
          unlocated: lat === undefined ? str(opts.unlocated) : undefined,
          parent: opts.parent ? normId(opts.parent as string) : undefined,
        },
        {},
        opts,
        (cur) => {
          const add = alt.filter((n) => !cur.names.some((x) => foldText(x.name) === foldText(n.name) && x.lang === n.lang));
          // located at last: no longer "not identified"
          return { ...(add.length ? { names: [...cur.names, ...add] } : {}), ...(lat !== undefined && cur.unlocated ? { unlocated: undefined } : {}) };
        },
      );
      return { text: written(tree), data: { place: p } };
    },
  },
);
