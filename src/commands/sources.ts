// source · cite · repo · recordset · place — where the evidence comes from.

import { opLine } from "../core/proposals.ts";
import { browserOnlyAccess, browserOnlyArchive } from "../core/byhand.ts";
import { OFF_MAP_HOW, offMapLine, placesOffMap } from "../core/places.ts";
import { addPlaceName, nameWithSyntax, otherNames, parseAltName, personsHand } from "../core/placeid.ts";
import { isAgent } from "../core/which.ts";
import fs from "node:fs";
import { commands, register, type CommandDef, type Input } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { LIST_PAGE_MAX, counted, lines, moreLine, paginate, shellArg, table, truncate } from "../cli/format.ts";
import { UsageError } from "../core/errors.ts";
import { ui } from "../cli/ui.ts";
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
  type PlaceName,
  type RecordSet,
  type Repository,
  type Source,
} from "../core/model.ts";
import { create, csvOpt, listOpt, normId, requireRecord, textOpt, update } from "../core/records.ts";
import { makeNote, makeNotes, parseDate } from "../core/actions.ts";
import { calibrationLine, fitCalibration } from "../core/calibration.ts";
import { foldText } from "../core/text.ts";
import { locatorOverlap, recognizeLocation, sourceCallNumber, sourceImage } from "../core/sourcefields.ts";
import { clipNote, clipText, imageOfRef, MAX_CLIPS, transcriptNote } from "../core/media.ts";
import { mediaOrient, partRegion } from "../core/views.ts";
import { fileToShown } from "../image/image.ts";
import { formatName } from "../core/people.ts";
import { yearsOption, yearsOverlap } from "../core/years.ts";
import type { Tree } from "../core/tree.ts";
import { readAgainOf, unverifiedReading, type ReadAgain } from "../core/sourceread.ts";
import { levelWords } from "../core/archiveasks.ts";
import { bookUrlKey, sameBooks, sameBookText } from "../core/samebook.ts";
import { handReading, typedByHand, userReading } from "../core/readers.ts";
import { agentClipped, joinedText, mergeOverlappingClips, researchWritesNow, type JoinedClip } from "../core/clipmerge.ts";
import { transcriptDiffers } from "../core/transcriptguard.ts";
import { decideProposal, proposeTranscript, type ProposalResult } from "../core/proposal.ts";
import { confirmAnswer, confirmCheck, confirmSummary } from "../core/confirm.ts";

function written(tree: Tree): string {
  return lines(...tree.written.map((o) => opLine(tree, o)));
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
 * Of the picture as the view showed it (a photo upright, turned by its EXIF); kept as the picture lies in its file.
 */
function clipRefs(tree: Tree, specs: string[], shared: string | undefined): Clip[] {
  return specs.map((spec) => {
    const m = /^([^@]+?)(?:@(.+))?$/.exec(spec.trim()) ?? [];
    let [ref, where] = [m[1] ?? "", m[2]];
    // "M0012:0.1,0.2,0.3,0.1" — the colon of a record set's image number stays hers
    const colon = !where && /^([Mm]\d+):(.+)$/.exec(ref);
    if (colon) [ref, where] = [colon[1]!, colon[2]!];
    const media = mediaRefs(tree, [ref])[0]!;
    if (!where) return { media, region: { x: 0, y: 0, w: 1, h: 1 } };
    const w = /^(?:(left|right|top|bottom)(?::|$))?(.*)$/.exec(where.trim())!;
    const img = tree.get<Media>(media);
    const region = partRegion({ half: w[1], crop: w[2] || undefined }, img, mediaOrient(shared, img));
    return { media, region };
  });
}

/** What the agent learns of clips joined on write: one entry is one clip on its image. */
function joinedNote(joined: JoinedClip[]): string | undefined {
  if (!joined.length) return undefined;
  return `clips that overlap on one image joined into one (one entry, one clip; another only where it goes on apart — another column, a page break — or for a detail or an entry nearly whole inside a larger clip, kept beside it): ${joined.map(joinedText).join("; ")}`;
}

/** "Teinitz an der Elbe@de:1850-1918" → another name of a place. */
export function altName(a: string): Place["names"][number] {
  return parseAltName(a);
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
        throw new UsageError(`changing ${overwritten.join(", ")} of ${id} needs --reason`, { hint: 'what a record says is evidence: e.g. --reason "re-read at full resolution"', code: "record.needs-reason", params: { id, fields: overwritten.map((k) => `--${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`).join(", ") } });
      return { ...cur, ...changes, ...(note ? { notes: [...cur.notes, ...makeNotes(tree, note)] } : {}) };
    },
    { op: `${type}.edit`, summary: `${id} ${[...given.map(([k]) => k), ...(note ? ["note"] : [])].join(", ") || "edited"}`, reason },
  );
}

/** The options of an add command, for its edit: all optional, no defaults. */
function editOptions(options: CommandDef["options"], extra: NonNullable<CommandDef["options"]> = []): NonNullable<CommandDef["options"]> {
  return [...extra, ...(options ?? []).map((o) => ({ ...o, description: o.description.replace(/\s*\(default[^)]*\)/, "") }))];
}

/**
 * A book registered twice is fetched twice (every image asked of the archive again): a link another book of the
 * research has is refused, pointing to that book — unless --again says why this is another book (then kept on it).
 */
function sameLink(tree: Tree, url: string | undefined, again: string | undefined, said: string[], self?: string): RecordSet["duplicates"] {
  const same = url ? sameBooks(tree, { url }, self).filter((x) => x.by === "url") : [];
  if (!same.length) {
    if (again) said.push("--again: no other book of the research has this link — nothing to explain");
    return undefined;
  }
  const first = same[0]!.book.id;
  if (!again)
    throw new UsageError(`this link is the book ${same.map(sameBookText).join(", ")} of the research already — the same book is never registered twice`, {
      hint: `read it: strom read ${first} --images <from-to> · its images not here yet: strom fetch <connector> <book> --images <from-to> --recordset ${first} · another book at the same link (another film): --again "<why>"`,
    });
  said.push(`registered beside ${same.map((x) => x.book.id).join(", ")} (the same link): ${again}`);
  return { of: same.map((x) => x.book.id), reason: again };
}

function readText(ctx: Context) {
  return (p: string) => fs.readFileSync(ctx.resolvePath(p), "utf8");
}

function matches(text: string | undefined, q: string): boolean {
  return !!text && foldText(text).includes(foldText(q));
}

// ── sources ────────────────────────────────────────────────────────────────

/** A list longer than this ends with the filters that make it shorter. */
const LONG_LIST = 30;

register(
  {
    path: ["source", "add"],
    summary: "Add a source: one record, document or tree that says something",
    group: "sources",
    tree: true,
    writes: true,
    description:
      "An original register entry or certificate is primary evidence; family trees and memories are\n" +
      "authored/derivative — facts citing only them stay leads. --transcript @file reads a file.\n" +
      `One source is one entry (its clips: the entry, and its continuation over a page break — at most ${MAX_CLIPS});\n` +
      "several entries of one page are several sources.",
    args: [{ name: "title", description: 'short title: "Baptism of Jan Novák, Týnec 1905"', required: true }],
    options: [
      { name: "kind", type: "string", value: "<kind>", description: `${SOURCE_KINDS.slice(0, 8).join(", ")}, … (default other)` },
      { name: "recordset", type: "string", value: "<B…>", description: "the book or collection it is in" },
      { name: "repo", type: "string", value: "<R…>", description: "archive holding it" },
      { name: "input", type: "string", value: "<I…>", description: "the input (document from the user) it comes from" },
      { name: "locator", type: "string", value: "<where>", description: "where in the book: entry number, column — with --folio and --image the rest; alone the whole location; an empty one in an edit empties it" },
      { name: "folio", type: "string", value: "<as written>", description: 'the folio or page as the book numbers it, with its word: "fol. 12v", "pag. 112"' },
      { name: "image", type: "string", value: "<n>", description: "the image number(s) as the portal counts them (34, 57-58) — only for an entry with no registered image (--clip, --media give it)" },
      { name: "call-number", type: "string", value: "<sig>", description: "the book's call number — for an entry in no record set of the research (or another one)" },
      { name: "date", type: "string", value: "<date>", description: "when the record was made (GEDCOM date)" },
      { name: "transcript", type: "string", value: "<text|@file>", description: "word-for-word transcription, original language" },
      { name: "translation", type: "string", value: "<text|@file>", description: "translation into the research language" },
      { name: "language", type: "string", value: "<code>", description: "language of the record, e.g. la, de, cs" },
      { name: "information", type: "string", value: "<kind>", description: "primary (eyewitness), secondary, unknown (default)" },
      { name: "form", type: "string", value: "<form>", description: "original (default), derivative (copy, index — the default for --kind index and in a record set of kind index only), authored (compiled work)" },
      { name: "url", type: "string", value: "<url>", description: "link to the record: the lasting address of its page in the archive's viewer (a permalink, not the image's own address), else the catalog entry — the Strom app links it" },
      { name: "media", type: "string", multiple: true, value: "<M…|B…:n>", description: "the registered image(s) the record is on (repeatable)" },
      {
        name: "clip",
        type: "string",
        multiple: true,
        value: "<M…@x,y,w,h>",
        description: `where the entry itself is on its image — the crop you read it in (the view prints it); one more per page break it runs over (at most ${MAX_CLIPS})`,
      },
      { name: "note", type: "string", value: "<text>", description: "short note" },
    ],
    examples: [
      'strom source add "Křest Jana Nováka 1905" --kind baptism --recordset B0001 --folio "fol. 45" --locator "č. 12" --language la --information primary --transcript @zapis.txt --clip B0001:2@0.05,0.40,0.45,0.18',
      'strom source add "Oddavky Jana Lhotáka 1890" --kind marriage --repo R0001 --call-number "Lhota 7" --folio "pag. 112" --image 57 --locator "č. 3" --url https://archive.example.org/view/57',
      'strom source add "Rodinný strom od tety Marie" --kind family-tree --form authored --input I0001',
    ],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const book = opts.recordset ? requireRecord<RecordSet>(tree, opts.recordset as string, "recordset") : undefined;
      if (opts.repo) requireRecord(tree, opts.repo as string, "repository");
      if (opts.input) requireRecord(tree, opts.input as string, "input");
      // the research's clips of one image that overlap are one entry cut twice: one clip (a person's stay as given)
      const given = clipRefs(tree, listOpt(opts.clip), ctx.settings.shared()?.value);
      const merged = researchWritesNow(tree, ctx.env, ctx.io.tty) ? mergeOverlappingClips(given) : { clips: given, joined: [] };
      const clips = merged.clips;
      if (clips.length > MAX_CLIPS) throw new UsageError(`at most ${MAX_CLIPS} clips: an entry, and its continuation over a page break — several entries are several sources (one strom source add each)`);
      const media = [...new Set([...mediaRefs(tree, csvOpt(opts.media)), ...clips.map((c) => c.media)])];
      // a line of an index is a copy made by another hand; a book with its own index holds originals too
      const kind = oneOf(opts.kind, SOURCE_KINDS, "kind", "other");
      const form = kind === "index" || (book && book.kinds.length > 0 && book.kinds.every((k) => k === "index")) ? "derivative" : "original";
      const transcript = textOpt(opts.transcript, readText(ctx));
      // typed by hand at the person's own terminal: the user's reading (an agent's, a script's, a batch's write is none)
      const hand = transcript?.trim() && typedByHand(ctx.env, { tty: ctx.io.tty, batch: ctx.inBatch }) ? handReading(transcript, new Date().toISOString()) : undefined;
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
          folio: str(opts.folio),
          image: str(opts.image),
          callNumber: str(opts["call-number"]),
          date: parseDate(opts.date as string | undefined, "record date"),
          transcript,
          translation: textOpt(opts.translation, readText(ctx)),
          language: str(opts.language)?.toLowerCase(),
          information: oneOf(opts.information, ["primary", "secondary", "unknown"] as const, "information", "unknown"),
          form: oneOf(opts.form, ["original", "derivative", "authored"] as const, "form", form),
          url: str(opts.url),
          accessed: str(opts.url) ? new Date().toISOString().slice(0, 10) : undefined,
          ...(media.length ? { media } : {}),
          ...(clips.length ? { clips } : {}),
          ...(hand ? { read: { user: hand } } : {}),
          note: str(opts.note),
        },
        (id) => `+${id} source "${truncate(args[0]!, 60)}"${media.length ? ` on ${media.join(" ")}` : ""}`,
        media,
      );
      return { text: lines(written(tree), overlapLine(src), joinedNote(merged.joined), clipNote(tree, src), transcriptNote(tree, src), "", `cite it: strom cite <event> ${src.id} --locator "…"`), data: { source: src, ...(locatorOverlap(src) ? { locatorOverlap: locatorOverlap(src) } : {}) } };
    },
  },
  {
    path: ["source", "list"],
    summary: "List sources (filter by text, kind, recordset)",
    group: "sources",
    tree: true,
    args: [{ name: "filter", description: "text in title, locator, folio, image or transcript", mistaken: ["find", "search", "text"] }],
    options: [
      { name: "kind", type: "string", value: "<kind>", description: "only this kind" },
      { name: "recordset", type: "string", value: "<B…>", description: "only from this recordset" },
      { name: "full", type: "boolean", description: "--json: whole records instead of one row each" },
    ],
    run(ctx: Context, { args, opts }: Input) {
      const tree = ctx.tree();
      let all = tree.list<Source>("source").filter((s) => !s.retracted);
      if (args[0]) all = all.filter((s) => matches(s.title, args[0]!) || matches(s.locator, args[0]!) || matches(s.folio, args[0]!) || matches(s.image, args[0]!) || matches(s.transcript, args[0]!));
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
      const shared = ctx.settings.shared()?.value;
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
      const again = readAgainState(tree, s);
      const loc = locationOf(tree, s);
      const text = lines(
        `${s.id} ${s.title}`,
        `kind ${s.kind} · ${s.form} · information ${s.information}${s.language ? ` · language ${s.language}` : ""}${s.date ? ` · dated ${s.date}` : ""}`,
        s.recordset || s.repository ? `in     ${[s.recordset, s.repository].filter(Boolean).join(" · ")}${s.locator ? ` · ${s.locator}` : ""}` : s.locator ? `at     ${s.locator}` : undefined,
        // what finds the entry again when its link no longer leads to it: the archive, the book's call number, the folio, the image
        loc.line ? `find   ${loc.line}` : undefined,
        loc.proposed ? `from its locator: ${[loc.proposed.folio ? `--folio ${shellArg(loc.proposed.folio)}` : "", loc.proposed.image ? `--image ${shellArg(loc.proposed.image)}` : "", loc.proposed.locator !== undefined ? locatorArg(loc.proposed.locator) : ""].filter(Boolean).join(" ")} (strom source edit ${s.id} to take them)` : undefined,
        // with a proposal, its edit says the rest (of the fields it takes too)
        overlapLine(s, !loc.proposed),
        s.url ? `url    ${s.url}` : undefined,
        s.media?.length ? `images ${s.media.map((id) => { const m = tree.get<Media>(id); return m ? `${id}${m.recordset ? ` (${m.recordset}:${m.image ?? "?"})` : ""}` : id; }).join(" · ")} — strom media view <M…>` : undefined,
        // as --clip takes them: of the picture as its view shows it
        s.clips?.length ? `clips  ${s.clips.map((c, i) => `${i + 1}. ${clipText({ media: c.media, region: fileToShown(c.region, mediaOrient(shared, tree.get<Media>(c.media))) })}`).join(" · ")} — where the entry is on its image` : undefined,
        s.transcript ? `\ntranscript\n${s.transcript}` : undefined,
        s.translation ? `\ntranslation\n${s.translation}` : undefined,
        againLine(again, s.id, again?.state === "unchecked" ? (unverifiedReading(tree, s)?.places ?? 0) : 0),
        citing.length ? `\ncited by\n${citing.map((c) => `  ${c}`).join("\n")}` : "\ncited by nothing yet",
        ...s.notes.map((n) => `note   ${n.text}`),
      );
      return {
        text,
        data: {
          source: s,
          ...(loc.image ? { image: loc.image.value, ...(loc.image.derived ? { imageDerived: true } : {}) } : {}),
          ...(loc.callNumber ? { callNumber: loc.callNumber } : {}),
          ...(loc.proposed ? { proposed: loc.proposed } : {}),
          ...(locatorOverlap(s) ? { locatorOverlap: locatorOverlap(s) } : {}),
          citedBy: citing,
          ...(again ? { readAgain: again } : {}),
        },
      };
    },
  },
);

/** The reason proposed with a locator cut to its rest (what it said is in the fields now). */
const FIELDS_REASON = "the folio and image are in their own fields";

/** The locator without what the proposal takes into fields (the folio, the image or both): "" when nothing is left, undefined when it takes nothing of it. */
function restWithout(s: Source, taken: { folio?: string; image?: string }): string | undefined {
  const o = locatorOverlap({ locator: s.locator, folio: taken.folio ?? s.folio, image: taken.image ?? s.image });
  return o ? o.rest ?? "" : undefined;
}

/** The locator option a proposal gives: its rest, or emptied when nothing is left of it (N1-a). */
const locatorArg = (rest: string) => `--locator ${rest ? shellArg(rest) : '""'} --reason "${FIELDS_REASON}"`;

/**
 * When a source's locator names the folio or the image its fields give too (spec 075 N1): what the PAGE says of it
 * (once: the same number as the locator says it, another the field's) and the edit that keeps the locator to the
 * rest — never written by itself (decision 5).
 */
function overlapLine(s: Pick<Source, "id" | "folio" | "image" | "locator">, withEdit = true): string | undefined {
  const o = locatorOverlap(s);
  if (!o) return undefined;
  const said = [
    o.folio ? (o.folio.same ? `the folio (${o.folio.named}) too` : `folio ${o.folio.named}, the field ${s.folio!.trim()}`) : "",
    o.image ? (o.image.same ? `the image (${o.image.named}) too` : `image ${o.image.named}, the field ${s.image!.trim()}`) : "",
  ].filter(Boolean).join(" and ");
  const differs = !!(o.folio && !o.folio.same) || !!(o.image && !o.image.same);
  const page = differs ? "the PAGE says the field's" : "the PAGE says it once";
  // nothing left of it once the fields say it: emptied (N1-a)
  const fix = withEdit ? ` · the locator ${o.rest ? "to its rest" : "emptied, nothing else in it"}: strom source edit ${s.id} ${locatorArg(o.rest ?? "")}` : "";
  return `its locator names ${said} — ${page}, the locator is kept as it is${fix}`;
}

/**
 * Where a source's entry stands, to find it again (spec 075): its archive, the book's call number (its own or its
 * record set's), folio, image (its own or that of its registered images) — and what its locator names of the folio
 * and the image while they are not given (a proposal: written only by strom source edit).
 */
function locationOf(tree: Tree, s: Source): { line?: string; image?: { value: string; derived: boolean }; callNumber?: string; proposed?: { folio?: string; image?: string; locator?: string } } {
  const set = s.recordset ? tree.get<RecordSet>(s.recordset) : undefined;
  const repoId = s.repository ?? set?.repository;
  const repo = repoId ? tree.get<Repository>(repoId) : undefined;
  const callNumber = sourceCallNumber(s, set);
  const image = sourceImage(s, (id) => tree.get<Media>(id));
  const parts = [
    repo ? `${repo.id} ${repo.name}` : "",
    callNumber ? `call number ${callNumber}${s.callNumber?.trim() ? "" : " (its book's)"}` : "",
    s.folio ? s.folio : "",
    image ? `image ${image.value}${image.derived ? " (from its images)" : ""}` : "",
  ].filter(Boolean);
  const found = recognizeLocation(s.locator);
  const proposed: { folio?: string; image?: string; locator?: string } = { ...(!s.folio && found.folio ? { folio: found.folio } : {}), ...(!image && found.image ? { image: found.image } : {}) };
  // what is left of the locator once both are fields (N1): proposed with them, never a part the fields do not take —
  // emptied ("") when nothing is left (N1-a)
  const rest = proposed.folio || proposed.image ? restWithout(s, proposed) : undefined;
  if (rest !== undefined) proposed.locator = rest;
  return {
    ...(parts.length && (callNumber || s.folio || image) ? { line: parts.join(" · ") } : {}),
    ...(image ? { image } : {}),
    ...(callNumber ? { callNumber } : {}),
    ...(proposed.folio || proposed.image ? { proposed } : {}),
  };
}

// ── repositories ───────────────────────────────────────────────────────────

/** The website's host without "www.", lowercase: https://www.FamilySearch.org/search → familysearch.org. */
function siteOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

/** An archive already here under this name or on this website. */
export function sameRepository(all: Repository[], name: string, url: string | undefined): Repository | undefined {
  const folded = foldText(name);
  const site = siteOf(url);
  return all.find((r) => foldText(r.name) === folded || (site !== undefined && siteOf(r.url) === site));
}

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
      { name: "automation", type: "string", value: "<a>", description: "allowed, manual (images by hand only — a person), forbidden (no automated request), unknown (default); an archive whose terms only restrict automation: strom allow archive <host> --level restricted" },
      { name: "note", type: "string", value: "<text>", description: "short note" },
      { name: "another", type: "boolean", description: "a different archive, though one here has its name or website" },
    ],
    examples: ['strom repo add "State Archive, online reading room" --country CZ --url https://archive.example.org --automation manual'],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      // One archive, one record: a second "FamilySearch" splits its books, terms and lessons in two (found in a live run).
      const twin = opts.another ? undefined : sameRepository(tree.list<Repository>("repository"), args[0]!, str(opts.url));
      if (twin)
        throw new UsageError(`${twin.id} "${twin.name}" is this archive already${twin.url ? ` (${twin.url})` : ""}`, {
          hint: `use it: --repo ${twin.id} (strom repo show ${twin.id}) — a different archive after all: add --another`,
        });
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
        `automation  ${r.automation}${r.automation === "forbidden" ? " — no automated request at all" : r.automation === "manual" ? " — the catalogue may be read; images by hand only (a person)" : ""}`,
        r.terms ? `terms       ${r.terms}` : undefined,
        sets.length ? `\nrecord sets\n${table(sets.map((b) => [`  ${b.id}`, b.title, b.years ?? "", b.access]))}` : undefined,
        ...r.notes.map((n) => `note        ${n.text}`),
      );
      return { text, data: { repository: r, recordsets: sets } };
    },
  },
);

// ── record sets ────────────────────────────────────────────────────────────

/** The registered images of a record set (N0216: found by a trial fetch, "registered already — nothing fetched"). */
export interface ImagesHere {
  /** Image numbers with a whole image (each once). */
  registered: number;
  /** Their numbers, as ranges [from, to]. */
  ranges: [number, number][];
  /** Numbers with only parts of the image (a half, a detail): no whole image to read. */
  partsOnly: [number, number][];
  /** Numbers with more than one whole copy (the sharpest is the image). */
  copies: [number, number][];
  /** Images of the record set registered without a number. */
  unnumbered: number;
}

function asRanges(nums: number[]): [number, number][] {
  const s = [...new Set(nums)].sort((a, b) => a - b);
  const out: [number, number][] = [];
  for (const n of s) {
    const last = out.at(-1);
    if (last && n === last[1] + 1) last[1] = n;
    else out.push([n, n]);
  }
  return out;
}

export function imagesHere(tree: Tree, recordset: string): ImagesHere {
  const whole = new Map<number, number>();
  const parts = new Set<number>();
  let unnumbered = 0;
  for (const m of tree.list<Media>("media")) {
    if (m.recordset !== recordset || m.retracted) continue;
    if (m.image === undefined) unnumbered++;
    else if (m.part) parts.add(m.image);
    else whole.set(m.image, (whole.get(m.image) ?? 0) + 1);
  }
  return {
    registered: whole.size,
    ranges: asRanges([...whole.keys()]),
    partsOnly: asRanges([...parts].filter((n) => !whole.has(n))),
    copies: asRanges([...whole].filter(([, k]) => k > 1).map(([n]) => n)),
    unnumbered,
  };
}

/** Ranges said: "4–19, 21–42"; more than `most` of them cut, with how to see them all. */
function rangesText(r: [number, number][], most: number, all: string): string {
  const said = r.slice(0, most).map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`)).join(", ");
  return r.length > most ? `${said}, … (${r.length} ranges: ${all})` : said;
}

const IMAGE_RANGES_SHOWN = 12;

function imagesLines(h: ImagesHere, b: RecordSet, full: boolean): string[] {
  const most = full ? Infinity : IMAGE_RANGES_SHOWN;
  const all = `strom recordset show ${b.id} --images`;
  const count = (n: [number, number][]) => n.reduce((k, [a, z]) => k + z - a + 1, 0);
  const out = [h.registered ? `images      ${h.registered}${b.images ? ` of ${b.images}` : ""} registered — ${rangesText(h.ranges, most, all)}` : "images      none registered whole"];
  if (h.partsOnly.length) out.push(`            only in parts (no whole image to read): ${count(h.partsOnly)} — ${rangesText(h.partsOnly, most, all)}`);
  if (h.copies.length) out.push(`            in several copies (the sharpest is the image): ${count(h.copies)} — ${rangesText(h.copies, most, all)}`);
  if (h.unnumbered) out.push(`            without an image number: ${h.unnumbered}`);
  return out;
}

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
      { name: "places", type: "string", value: "<list>", description: "places covered, comma separated", aliases: ["place"] },
      { name: "years", type: "string", value: "<from-to>", description: "e.g. 1784-1820" },
      { name: "access", type: "string", value: "<a>", description: `${ACCESS.join(", ")} (default unknown)` },
      { name: "url", type: "string", value: "<url>", description: "link to the images or catalog" },
      { name: "images", type: "string", value: "<n>", description: "number of images" },
      { name: "layout", type: "string", value: "<text>", description: "how pages are laid out (columns, two years per page, …)" },
      { name: "note", type: "string", value: "<text>", description: "short note" },
      { name: "again", type: "string", value: "<reason>", description: "register it although a book of the research has the same link: why it is another book (another film, another copy)" },
    ],
    examples: ['strom recordset add "Týnec nad Labem 17, N 1861-1869" --repo R0001 --kinds baptism --places "Týnec nad Labem,Bělušice" --years 1861-1869 --access online-free --url https://…'],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      if (opts.repo) requireRecord(tree, opts.repo as string, "repository");
      const said: string[] = [];
      const duplicates = sameLink(tree, str(opts.url), str(opts.again), said);
      const years = yearsOption(str(opts.years), said, "1784-1820");
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
          duplicates,
        },
        (id) => `+${id} record set "${truncate(args[0]!, 60)}"`,
      );
      // an archive only a person's browser reaches: what strom's list says, whatever access was given (nothing rewritten)
      const only = browserOnlyArchive(tree, b.url, ctx.settings.shared()?.value);
      if (only)
        said.push(
          `${b.id}: ${only.title ?? only.host} lets automated tools in only through a person's browser (strom's list of archives) — no connector, no web fetch; its images by the person's hand: strom task wait T… --images ${b.id}:<numbers> --on "…"${b.access === "online-free" ? " (access online-free: free to view, by a person)" : ""}`,
        );
      return { text: lines(written(tree), ...said), data: { recordset: b, ...(only ? { browserOnly: only } : {}) } };
    },
  },
  {
    path: ["recordset", "list"],
    summary: "Books and collections known in this tree",
    group: "sources",
    tree: true,
    args: [{ name: "filter", description: "text in title, place or call number", mistaken: ["find", "search", "text"] }],
    options: [
      { name: "place", type: "string", value: "<name>", description: "only the books of this place (diacritics optional)" },
      { name: "kind", type: "string", value: "<kind>", description: "only the books holding this kind of record (baptism, marriage, burial…)" },
      { name: "years", type: "string", value: "<from-to>", description: "only the books whose years reach into these" },
      { name: "repo", type: "string", value: "<R…>", description: "only the books of this archive" },
      { name: "full", type: "boolean", description: "--json: whole records instead of one row each" },
    ],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      let all = tree.list<RecordSet>("recordset");
      if (args[0]) all = all.filter((b) => matches(b.title, args[0]!) || b.places.some((p) => matches(p, args[0]!)) || matches(b.callNumber, args[0]!));
      // the filters agents look for (K14): a place, a kind of record, years, an archive
      if (typeof opts.place === "string") all = all.filter((b) => b.places.some((p) => matches(p, String(opts.place))));
      if (typeof opts.kind === "string") all = all.filter((b) => b.kinds.some((k) => matches(k, String(opts.kind))));
      const years = yearsOption(opts.years, []);
      if (years) all = all.filter((b) => yearsOverlap(b.years, years));
      if (typeof opts.repo === "string") {
        const repo = requireRecord(tree, String(opts.repo), "repository").id;
        all = all.filter((b) => b.repository === repo);
      }
      // a long list ends with its filters: a book is found by them, never by searching the list (N0280)
      const filters = [
        args[0] ? undefined : "<text>",
        opts.place === undefined ? "--place <name>" : undefined,
        opts.kind === undefined ? "--kind <kind>" : undefined,
        opts.years === undefined ? "--years <from-to>" : undefined,
        opts.repo === undefined ? "--repo <R…>" : undefined,
      ].filter(Boolean);
      // A page at most (--limit, LIST_PAGE_MAX rows: under ~20 kB — an agent's tool keeps a longer output in a file and
      // shows only its start, N0280, N0281); a long list says its filters first, where a cut output still shows them.
      const page = paginate(all, Math.min(ctx.limit, LIST_PAGE_MAX), ctx.page);
      const narrow = all.length > LONG_LIST && filters.length ? `${all.length} record sets — narrow: strom recordset list ${filters.join(" ")}` : undefined;
      return {
        text: all.length
          ? lines(
              narrow,
              table(page.items.map((b) => [b.id, truncate(b.title, 60), b.years ?? "", b.access, b.calibration.length ? "calibrated" : ""])),
              moreLine(page, ["strom recordset list", ...(args[0] ? [shellArg(args[0])] : []), ...(["place", "kind", "years", "repo"] as const).filter((k) => typeof opts[k] === "string").map((k) => `--${k} ${shellArg(String(opts[k]))}`)].join(" ")),
            )
          : "no record sets match",
        data: { total: page.total, recordsets: opts.full ? page.items : page.items.map((b) => ({ id: b.id, title: b.title, years: b.years, access: b.access, places: b.places, calibrated: b.calibration.length > 0 })) },
      };
    },
  },
  {
    path: ["recordset", "show"],
    summary: "One record set: access, calibration, what has been searched in it",
    group: "sources",
    tree: true,
    args: [{ name: "recordset", description: "record set ID (B0001)", required: true }],
    options: [{ name: "images", type: "boolean", description: "the registered images in full: every range, those only in parts, those in several copies" }],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const b = requireRecord<RecordSet>(tree, args[0]!, "recordset");
      const repo = b.repository ? tree.get<Repository>(b.repository) : undefined;
      const here = imagesHere(tree, b.id);
      const only = browserOnlyArchive(tree, b.url ?? repo?.url, ctx.settings.shared()?.value);
      const text = lines(
        `${b.id} ${b.title}`,
        repo ? `in          ${repo.id} ${repo.name}${b.callNumber ? ` · ${b.callNumber}` : ""} · automation ${repo.automation}` : b.callNumber ? `call number ${b.callNumber}` : undefined,
        `covers      ${[b.kinds.join(", "), b.places.join(", "), b.years].filter(Boolean).join(" · ") || "(not described)"}`,
        `access      ${only ? browserOnlyAccess(b.access, only).replace("B…", b.id) : b.access}${b.url ? ` · ${b.url}` : ""}${b.images ? ` · ${b.images} images` : ""}`,
        ...imagesLines(here, b, opts.images === true),
        b.layout ? `layout      ${b.layout}` : undefined,
        calibrationLine(b),
        ...b.notes.map((n) => `note        ${n.text}`),
        "",
        `searched in it: strom searched ${b.id}`,
      );
      return { text, data: { recordset: b, calibration: fitCalibration(b.calibration), images: here, ...(only ? { browserOnly: only } : {}) } };
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

/**
 * The other names of a place as place list shows them (words alone, no language or years): each once, never today's
 * again — a form of the facts made today's name and given as another name in a language too (--form X --alt X@de)
 * shows as X once; place show keeps the language apart.
 */
function listedNames(p: Place): string[] {
  const seen = new Set([placeName(p).normalize("NFC")]);
  return otherNames(p)
    .map((n) => n.name.normalize("NFC"))
    .filter((n) => !seen.has(n) && !!seen.add(n));
}

/** Who writes a place's coordinates: an agent (a session of the research) or the person by hand. */
function byWhom(ctx: Context): "research" | "person" {
  return isAgent(ctx.env) || ctx.env.STROM_SESSION ? "research" : "person";
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
      // the name written with the syntax of another name ("Lhotau@de:1850"): its name, language and years, never kept whole
      const first: PlaceName = { name: args[0]!.normalize("NFC").trim() };
      const named = { names: [nameWithSyntax(first) ?? first] } as Place;
      for (const n of listOpt(opts.alt).map(altName)) addPlaceName(named, n.name, "alt", n);
      const names = named.names;
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
          // who put it on the map: the person by hand, an agent (the research) — core/placeid.ts
          locating: lat !== undefined ? { by: byWhom(ctx), at: new Date().toISOString() } : undefined,
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
          ? table(all.map((p) => [p.id, placeName(p), listedNames(p).join(", "), p.jurisdictions.map((j) => `${j.kind}: ${j.name}`).join("; ")]))
          : "no places match",
        data: { places: all },
      };
    },
  },
  {
    path: ["place", "show"],
    summary: "One place: names, the forms the facts write, jurisdictions over time, where its records are",
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
      const others = otherNames(p);
      const text = lines(
        `${p.id} ${placeName(p)}${p.kind ? ` · ${p.kind}` : ""}${p.coords ? ` · ${p.coords.lat}, ${p.coords.lon}` : ""}`,
        others.some((n) => n.kind !== "form") ? `names  ${[p.names[0]!, ...others.filter((n) => n.kind !== "form")].map((n) => `${n.name}${n.lang ? `@${n.lang}` : ""}${span(n.from, n.to)}`).join(" · ")}` : undefined,
        others.some((n) => n.kind === "form") ? `forms  ${others.filter((n) => n.kind === "form").map((n) => n.name).join(" · ")}` : undefined,
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
      const year = (name: "from" | "to") => {
        if (opts[name] === undefined) return undefined;
        const y = Number(opts[name]);
        if (!/^\s*\d{3,4}\s*$/.test(String(opts[name]))) throw new UsageError(`invalid --${name} "${String(opts[name])}"`, { hint: `a year: --${name} 1784` });
        return y;
      };
      const from = year("from");
      const to = year("to");
      if (from !== undefined && to !== undefined && from > to) throw new UsageError(`--from ${from} is after --to ${to}`, { hint: `--from ${to} --to ${from}` });
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
      "how good it is (kind, form, information, date, locator, folio, image, call number, transcript, record set) needs\n" +
      "--reason; filling in doesn't.",
    args: [{ name: "source", description: "source ID (S0001)", required: true }],
    options: [
      ...editOptions(addOptions("source add"), [{ name: "title", type: "string", value: "<text>", description: "a better title" }]).filter((o) => o.name !== "input"),
      { name: "clip-remove", type: "string", value: "<n|all>", description: "take away a clip that is wrong (its number in strom source show), or all of them" },
    ],
    examples: [
      'strom source edit S0001 --translation "Jan, son of Josef" --media B0001:2',
      'strom source edit S0001 --information secondary --reason "the entry was written years later"',
      'strom source edit S0001 --url https://archive.example.org/view/58 --image 58 --reason "the archive moved its viewer; found again by call number and folio"',
      "strom source edit S0001 --clip M0001@0.05,0.42,0.45,0.16",
    ],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      if (opts.recordset) requireRecord(tree, opts.recordset as string, "recordset");
      if (opts.repo) requireRecord(tree, opts.repo as string, "repository");
      const clips = clipRefs(tree, listOpt(opts.clip), ctx.settings.shared()?.value);
      const drop = str(opts["clip-remove"]);
      const media = [...new Set([...mediaRefs(tree, csvOpt(opts.media)), ...clips.map((c) => c.media)])];
      let transcript = textOpt(opts.transcript, readText(ctx));
      const hand = transcript?.trim() && typedByHand(ctx.env, { tty: ctx.io.tty, batch: ctx.inBatch });
      let joined: JoinedClip[] = [];
      // a transcript the person read or confirmed is theirs (core/transcriptguard.ts): another's new wording of it is
      // proposed to them instead (a note, their task), and whatever else the edit gives is written as asked
      const before = requireRecord<Source>(tree, args[0]!, "source");
      let proposed: ProposalResult | undefined;
      if (transcript !== undefined && !tree.personWrites && userReading(before) && transcriptDiffers(before.transcript, transcript)) {
        // a new wording of what the record says is evidence, as any change of a transcript: why, always
        if (!str(opts.reason))
          throw new UsageError(`changing transcript of ${before.id} needs --reason`, { hint: 'what a record says is evidence: e.g. --reason "re-read at full resolution"', code: "record.needs-reason", params: { id: before.id, fields: "--transcript" } });
        proposed = proposeTranscript(tree, before.id, transcript, { why: str(opts.reason)! });
        transcript = undefined;
        const rest = [opts.title, opts.kind, opts.recordset, opts.repo, opts.locator, opts.folio, opts.image, opts["call-number"], opts.date, opts.translation, opts.language, opts.information, opts.form, opts.url, opts.note, drop].some((v) => v !== undefined) || media.length > 0 || clips.length > 0;
        if (!rest) return { text: lines(written(tree), proposed.line), data: { source: tree.get<Source>(before.id), proposal: proposed } };
      }
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
          folio: str(opts.folio),
          image: str(opts.image),
          callNumber: str(opts["call-number"]),
          date: opts.date === undefined ? undefined : parseDate(opts.date as string, "record date"),
          transcript,
          translation: textOpt(opts.translation, readText(ctx)),
          language: str(opts.language)?.toLowerCase(),
          information: optOneOf(opts.information, ["primary", "secondary", "unknown"] as const, "information"),
          form: optOneOf(opts.form, ["original", "derivative", "authored"] as const, "form"),
          url: str(opts.url),
          accessed: str(opts.url) ? new Date().toISOString().slice(0, 10) : undefined,
        },
        { kind: "other", form: undefined, information: "unknown", date: undefined, locator: undefined, folio: undefined, image: undefined, callNumber: undefined, transcript: undefined, recordset: undefined },
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
          const all = [...kept, ...clips.filter((c) => !kept.some((k) => clipText(k) === clipText(c)))];
          // the research's clips of one image that overlap are one entry cut twice: one clip — those there already only
          // when the history shows the research wrote them (core/clipmerge.ts agentClipped), else they stay as they are
          let merged = researchWritesNow(tree, ctx.env, ctx.io.tty) ? mergeOverlappingClips(all) : { clips: all, joined: [] };
          if (merged.joined.length && kept.length && !agentClipped(tree.readOps(), new Set([cur.id])).has(cur.id)) merged = mergeOverlappingClips(all, (_, i) => i < kept.length);
          joined = merged.joined;
          const next = merged.clips;
          if (next.length > MAX_CLIPS) throw new UsageError(`at most ${MAX_CLIPS} clips: an entry, and its continuation over a page break`, { hint: `take one away: --clip-remove <n> (strom source show ${cur.id})` });
          return {
            // --locator "": the locator emptied, its folio and image in their fields (N1-a) — a change as any other
            ...(typeof opts.locator === "string" && !opts.locator.trim() && cur.locator !== undefined ? { locator: undefined } : {}),
            ...(media.some((m) => !(cur.media ?? []).includes(m)) ? { media: [...new Set([...(cur.media ?? []), ...media])] } : {}),
            ...(drop !== undefined || clips.length ? { clips: next.length ? next : undefined } : {}),
            // a new wording typed by hand at the person's terminal: their reading of it (anyone else's: a reading of the
            // wording before counts no more — its mark is another's)
            ...(hand && transcript !== cur.transcript ? { read: { ...cur.read, user: handReading(transcript!, new Date().toISOString()) } } : {}),
          };
        },
      );
      // a locator that names what the folio or image given now say too: said, the rest proposed (N1)
      const where = opts.locator !== undefined || opts.folio !== undefined || opts.image !== undefined ? locatorOverlap(s) : undefined;
      return { text: lines(written(tree), where ? overlapLine(s) : undefined, joinedNote(joined), media.length ? clipNote(tree, s) : undefined, media.length || clips.length ? transcriptNote(tree, s) : undefined, proposed?.line), data: { source: s, ...(proposed ? { proposal: proposed } : {}), ...(where ? { locatorOverlap: where } : {}) } };
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
      // an archive recorded milder than before (its terms allow more): the person's word — making it stricter is anybody's
      const next = optOneOf(opts.automation, AUTOMATION, "automation");
      const cur = next ? requireRecord<Repository>(tree, args[0]!, "repository") : undefined;
      const strict = (x: string) => (x === "forbidden" ? 3 : x === "manual" ? 2 : 0);
      if (cur && next && strict(next) < strict(cur.automation))
        ctx.requireHuman(`Record ${cur.id} ${cur.name} as automation ${next} — milder than ${cur.automation}?`, `strom repo edit ${cur.id} --automation ${next}`, `repo:${cur.id}`, ui(ctx.uiLang(), "ui.archive.level.milder", { title: cur.name, level: levelWords(ctx.uiLang(), next), now: levelWords(ctx.uiLang(), cur.automation) }));
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
      const said: string[] = [];
      const years = yearsOption(str(opts.years), said, "1784-1820");
      const images = opts.images === undefined ? undefined : Number(opts.images);
      if (images !== undefined && (!Number.isInteger(images) || images < 1)) throw new UsageError("--images must be a positive number");
      const cur = requireRecord<RecordSet>(tree, args[0]!, "recordset");
      // a link changed is checked; --again alone explains the link the book has
      const url = str(opts.url);
      const changed = url !== undefined && bookUrlKey(url) !== bookUrlKey(cur.url ?? "");
      const duplicates = sameLink(tree, changed ? url : str(opts.again) ? cur.url : undefined, str(opts.again), said, cur.id);
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
        (cur) => (duplicates ? { duplicates: { of: [...new Set([...(cur.duplicates?.of ?? []), ...duplicates.of])], reason: duplicates.reason } } : {}),
      );
      return { text: lines(written(tree), ...said), data: { recordset: b } };
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
      const by = byWhom(ctx);
      const had = requireRecord<Place>(tree, args[0]!, "place");
      // the person's hand wins (spec 034 K2.5): an agent never moves coordinates the person gave
      if (lat !== undefined && by === "research" && personsHand(had))
        throw new UsageError(`${had.id}: the coordinates were given by the person${had.locating ? "" : " (or before the research kept who)"} — the research does not change them`, {
          code: "place.manual",
          hint: `the records say otherwise: strom place propose ${had.id} --conflict --candidate …`,
        });
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
          const named = { names: cur.names.map((n) => ({ ...n })) } as Place;
          for (const n of alt) addPlaceName(named, n.name, "alt", n);
          const add = JSON.stringify(named.names) !== JSON.stringify(cur.names);
          // located at last: no longer "not identified"; who put it there kept, any question of it closed
          return {
            ...(add ? { names: named.names } : {}),
            ...(lat !== undefined && cur.unlocated ? { unlocated: undefined } : {}),
            ...(lat !== undefined ? { locating: { by, at: new Date().toISOString() } } : {}),
          };
        },
      );
      return { text: written(tree), data: { place: p } };
    },
  },
);

register({
  path: ["source", "confirm"],
  summary: "The user's confirmation of the research's transcript of a source, as the Strom app sends it (its bridge)",
  group: "sources",
  tree: true,
  writes: true,
  hidden: true,
  description:
    "The user read the record and the research's transcript agrees: their reading of that wording (--undo takes it\n" +
    "back). Only the Strom app confirms, through its bridge — nobody confirms for a person.",
  args: [{ name: "source", description: "source ID (S0001)", required: true }],
  options: [
    { name: "txt", type: "string", value: "<mark>", description: "the mark of the wording confirmed, as the Strom file gives it (_TXT)" },
    { name: "undo", type: "boolean", description: "take the confirmation back" },
  ],
  examples: ["strom source confirm S0001 --txt 0123456789abcdef"],
  run(ctx, { args, opts }) {
    // the person's own, in the Strom app: its bridge runs this as theirs (never with an agent's marks)
    if (ctx.env.STROM_FOR_APP !== "1" || isAgent(ctx.env))
      throw new UsageError("a transcript is confirmed by the user alone, in the Strom app (the source's viewer)", { code: "confirm.app" });
    const tree = ctx.tree();
    const id = normId(args[0]!);
    const confirm = opts.undo !== true;
    const asked = confirmCheck(tree, id, str(opts.txt) ?? "", confirm);
    if ("refused" in asked) throw new UsageError(asked.refused.why, { code: asked.refused.code, ...(asked.refused.params ? { params: asked.refused.params } : {}) });
    if ("same" in asked) return { text: `${id}: nothing to change`, data: asked.same };
    const s = asked.write;
    update<Source>(tree, id, "source", () => s, { op: confirm ? "source.confirm" : "source.unconfirm", summary: confirmSummary(s, confirm) });
    const answer = confirmAnswer(tree, id);
    return { text: written(tree), data: answer };
  },
});

/**
 * What became of the newest reading again of a source that differs from its transcript (core/sourceread.ts readAgainOf,
 * as the Strom app's source viewer has it): unchecked (the person decides: strom source reading), saved, or held in a
 * task. None read again so: undefined.
 */
export function readAgainState(tree: Tree, s: Source): ReadAgain | undefined {
  return readAgainOf(tree, s);
}

function againLine(a: ReadAgain | undefined, id: string, places: number): string | undefined {
  if (!a) return undefined;
  const proposal = (a.proposal ? ` · a wording proposed to the person waits in ${a.proposal.task}` : "") + (a.unsureOffer ? ` · places its readers are not sure of no task holds: the person may hand them over for a look on the scan (strom source reading ${id} --take queue --unsure; a transcript they confirmed: --take review --unsure) — never without their word` : "");
  if (a.state === "unchecked") return `\nread again ${a.read} — differs from the transcript in ${counted(places, "matter of fact", "matters of fact")} both readers are sure of, NOT verified: the person decides (strom source reading ${id}) — the transcript stays as it is${proposal}`;
  if (a.state === "saved")
    return `\nread again ${a.read} — differs, ${a.minorOnly ? "in trifles alone" : a.unsureOnly ? "only in places its readers are not sure of" : "just kept by the person's word (asked no more)"}${proposal}`;
  const whose = a.taskFor === "person" ? "the person's task (a wording proposed for their review)" : "the task";
  return `\nread again ${a.read} — differs, held in ${whose} ${a.task ?? "?"}${a.taskOpen ? (a.taskQueued ? ", in the queue" : ", not ended") : ", ended"}${proposal}`;
}

register({
  path: ["source", "proposal"],
  summary: "The person's decision on a new wording proposed for a transcript they read or confirmed: taken, or theirs kept",
  group: "sources",
  tree: true,
  writes: true,
  hidden: true,
  description:
    "A transcript the person read or confirmed is never changed by an agent: another wording is proposed to them\n" +
    "(strom source edit --transcript from an agent), one task per source that waits for them. Only the person decides it\n" +
    "— strom's menu (What waits), a link of the Strom app, or the app through its bridge (POST <token>/sources/proposal):\n" +
    "--take proposal writes the proposed wording as their transcript (their reading of it), --take keep keeps theirs and\n" +
    "the wording is never proposed again; --take undo takes their decision back (the transcript and their reading of it\n" +
    "as before, their confirmation too, or the wording no longer declined) and the proposal waits for them again.",
  args: [{ name: "source", description: "source ID (S0001)", required: true }],
  options: [
    { name: "take", type: "string", value: "proposal|keep|undo", description: "the proposed wording, the transcript as it is, or the decision undone (the newest of the source, or --task)" },
    { name: "task", type: "string", value: "<T…>", description: "the task of the proposal decided (default: the one that waits for the source)" },
    { name: "proposed", type: "string", value: "<mark>", description: "only if the wording proposed is still this one (its mark): else refused, proposal.changed" },
  ],
  examples: ["strom source proposal S0001 --take keep"],
  run(ctx, { args, opts }) {
    const take = str(opts.take);
    if (take !== "proposal" && take !== "keep" && take !== "undo") throw new UsageError("--take is proposal, keep or undo", { code: "proposal.invalid" });
    const tree = ctx.tree();
    const id = normId(args[0]!, "source");
    const fromApp = ctx.env.STROM_FOR_APP === "1" && !isAgent(ctx.env);
    const task = str(opts.task) ? normId(str(opts.task)!, "task") : undefined;
    const { source, task: t } = decideProposal(tree, id, take, { how: fromApp ? "confirm" : "hand", ...(task ? { task } : {}), ...(str(opts.proposed) ? { expect: str(opts.proposed)! } : {}) });
    return { text: written(tree), data: { ...confirmAnswer(tree, source.id), task: t.id, take } };
  },
});
