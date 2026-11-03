// Identifying the places of the facts (core/placeid.ts): the queue the person asks for, and the agent's commands that
// write what it found — identified surely, a question for the person, not located with what would decide it, the
// coordinates checked, the facts' places written as the record says.

import fs from "node:fs";
import { register } from "../cli/registry.ts";
import { counted, lines, table } from "../cli/format.ts";
import { UsageError } from "../core/errors.ts";
import { listOpt } from "../core/records.ts";
import { refuseInArchive } from "../core/state.ts";
import { isAgent } from "../core/which.ts";
import type { Place } from "../core/model.ts";
import {
  answerPlaces,
  cancelPlaces,
  factForms,
  identifyEstimate,
  identifyPlace,
  parseCandidate,
  parseJurisdiction,
  PLACE_TAKES,
  placeState,
  proposePlace,
  queueBatches,
  queueOrder,
  queuePlaces,
  raisePlacesTask,
  readPlacesFile,
  recordIndex,
  rewriteForm,
  undoPlaces,
  unlocatePlace,
  verifyPlace,
  identifyingNow,
  mergePlaces,
  parseAltName,
  parseDrop,
  placeIdOf,
  PLACE_FLAGS,
  REQUEST_MAX,
  type PlaceDetails,
  type PlaceFlag,
  type PlaceStep,
  type PlaceTake,
  type QueueRequest,
} from "../core/placeid.ts";
import { actsAsArchive } from "../core/state.ts";

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function written(tree: { written: { summary: string }[] }): string {
  return lines(...tree.written.map((o) => o.summary));
}

const name = (p: Place) => p.names[0]?.name ?? p.id;

/** What identify and verify write of a place beside its coordinates. */
const DETAIL_OPTIONS = [
  { name: "name", type: "string", value: "<name>", description: "today's (official) name, when the record's first is not it: the old one stays as a form or an old name" },
  { name: "alt", type: "string", multiple: true, value: "<name[@lang][:from-to]>", description: 'another name of the place (another language, an old name, an old spelling), e.g. "Ober Lhota@de:-1945"; one year: "Lhotow@cs:1654"; a --form of the same name is kept as this name alone (repeatable)' },
  { name: "form", type: "string", multiple: true, value: "<place>", description: "another form of the facts that is the same place (kept among the record's names as a form, out of the queue; repeatable)" },
  { name: "kind", type: "string", value: "<kind>", description: "village, town, part of a municipality, …" },
  { name: "parent", type: "string", value: "<L…>", description: "the place it is part of" },
  { name: "jurisdiction", type: "string", multiple: true, value: "<kind:name[:from-to]>", description: 'e.g. "parish:Lhotov:1784-" or "district:Lhotov" (repeatable)' },
  { name: "drop-jurisdiction", type: "string", multiple: true, value: "<kind:name>", description: "a jurisdiction of the record found wrong: taken off, --why says why (repeatable)" },
] as const;


register(
  {
    path: ["place", "identify"],
    summary: "Write a place identified surely: its coordinates, names, parent and jurisdictions, why and from what",
    group: "sources",
    tree: true,
    writes: true,
    description:
      "Only when it is sure which place of the name it is (the parish of the records, the district, the years agree). Probable: strom place propose. Not to be determined: strom place unlocated. A place the person put on the map is never changed: strom place propose --conflict, or strom place verify.",
    args: [{ name: "place", description: "place ID (L0012) or the place as the facts write it", required: true }],
    options: [
      { name: "lat", type: "string", value: "<deg>", description: "latitude" },
      { name: "lon", type: "string", value: "<deg>", description: "longitude" },
      { name: "why", type: "string", value: "<text>", description: "why it is this place (the records' parish, district, years)" },
      { name: "source-title", type: "string", value: "<title>", description: "the reference it stands on (a gazetteer, a register of places)" },
      { name: "source-url", type: "string", value: "<url>", description: "its address" },
      ...DETAIL_OPTIONS,
      { name: "separate", type: "string", multiple: true, value: "<L…>", description: "a record nearer than 1.5 km that is another place (a part of it, a neighbour) — said, never assumed (repeatable)" },
    ],
    examples: [
      'strom place identify "H. Lhota" --lat 49.61 --lon 15.23 --name "Horní Lhota" --jurisdiction "parish:Lhotov" --why "the parish of the registers; the other Horní Lhota is 200 km away" --source-title "Register of places"',
      'strom place identify "Lhota" --lat 50.2 --lon 15.9 --name "Lhotów" --alt "Lhotau@de:-1945" --why "…"',
    ],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      refuseInArchive(tree, "place identify", ctx.settings.agent(tree.config).value);
      const lat = Number(opts.lat);
      const lon = Number(opts.lon);
      const title = str(opts["source-title"]);
      const url = str(opts["source-url"]);
      if (url && !title) throw new UsageError("--source-url with its --source-title");
      const r = identifyPlace(tree, args[0]!, {
        lat,
        lon,
        why: String(opts.why ?? ""),
        ...(title ? { source: { title, ...(url ? { url } : {}) } } : {}),
        ...detailsOf(opts),
        separate: listOpt(opts.separate),
        by: isAgent(ctx.env) || ctx.env.STROM_SESSION ? "research" : "person",
      });
      raisePlacesTask(tree, actsAsArchive(tree));
      return stepResult(tree, r);
    },
  },
  {
    path: ["place", "unlocated"],
    summary: "A place that cannot be determined yet: why, and what would decide it (it comes back by itself once that is known)",
    group: "sources",
    tree: true,
    writes: true,
    args: [{ name: "place", description: "place ID (L0012) or the place as the facts write it", required: true }],
    options: [
      { name: "why", type: "string", value: "<text>", description: "why not (≤ 300 characters)" },
      { name: "needs", type: "string", value: "<text>", description: "what would decide it (≤ 300 characters)" },
    ],
    examples: ['strom place unlocated "Lhota" --why "three villages of the name in the parish\'s region; the records give no house or district" --needs "the parish or the district of the record"'],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      refuseInArchive(tree, "place unlocated", ctx.settings.agent(tree.config).value);
      const p = unlocatePlace(tree, args[0]!, String(opts.why ?? ""), str(opts.needs));
      raisePlacesTask(tree, actsAsArchive(tree));
      return { text: written(tree), data: { place: p } };
    },
  },
  {
    path: ["place", "propose"],
    summary: "Ask the person which place it is (1–3 candidates), or about coordinates the records contradict",
    group: "sources",
    tree: true,
    writes: true,
    description: "Probable, not sure: the person chooses in What waits (the app, the menu). --conflict: the coordinates on the map against what the records say.",
    args: [{ name: "place", description: "place ID (L0012) or the place as the facts write it", required: true }],
    options: [
      { name: "candidate", type: "string", multiple: true, value: "<name|lat|lon|why[|district|country|source|url]>", description: "a candidate (1–3)" },
      { name: "conflict", type: "boolean", description: "the coordinates now contradict the records" },
      { name: "why", type: "string", value: "<text>", description: "what the question is about" },
    ],
    examples: ['strom place propose "Lhota" --candidate "Lhota|49.6|15.2|parish Lhotov of the registers|Lhotov|CZ" --candidate "Lhota|50.1|14.9|the same name nearer|Jinov|CZ"'],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      refuseInArchive(tree, "place propose", ctx.settings.agent(tree.config).value);
      const cands = listOpt(opts.candidate).map(parseCandidate);
      const p = proposePlace(tree, args[0]!, { kind: opts.conflict ? "conflict" : "propose", candidates: cands, ...(str(opts.why) ? { why: str(opts.why) } : {}) });
      raisePlacesTask(tree, actsAsArchive(tree));
      return { text: written(tree), data: { place: p } };
    },
  },
  {
    path: ["place", "verify"],
    summary: "The coordinates of a place checked: right, or why it cannot be decided",
    group: "sources",
    tree: true,
    writes: true,
    description:
      "The coordinates are never moved; what the check found of the place is written with it: its other and old names (--alt), the forms of the facts that are it (--form: no second record of one place), today's name (--name), its jurisdictions (--jurisdiction; a wrong one taken off with --drop-jurisdiction and --why).",
    options: [
      { name: "ok", type: "boolean", description: "the records agree with the coordinates" },
      { name: "undecided", type: "string", value: "<why>", description: "it cannot be decided, and why" },
      { name: "why", type: "string", value: "<text>", description: "with --ok: on what (kept with the check); with --drop-jurisdiction: why it is wrong" },
      ...DETAIL_OPTIONS,
    ],
    args: [{ name: "place", description: "place ID (L0012) or the place as the facts write it", required: true }],
    examples: [
      'strom place verify L0002 --ok --why "the parish of the registers"',
      'strom place verify L0002 --ok --alt "Lhotau@de:-1945" --form "Nová Lhota" --drop-jurisdiction "parish:Lhotov" --jurisdiction "parish:Horní Lhota" --why "the town had its own parish; Lhotov was the source\'s"',
      'strom place verify L0002 --undecided "the records name no parish"',
    ],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      refuseInArchive(tree, "place verify", ctx.settings.agent(tree.config).value);
      if (!!opts.ok === !!opts.undecided)
        throw new UsageError("--ok or --undecided \"<why>\"", { hint: `strom place verify ${args[0] ?? "L…"} --ok --why "on what" (names found: --alt, --form)` });
      const r = verifyPlace(tree, args[0]!, opts.ok ? { ok: true, ...(str(opts.why) ? { why: str(opts.why) } : {}) } : { ok: false, why: String(opts.undecided) }, detailsOf(opts));
      raisePlacesTask(tree, actsAsArchive(tree));
      return stepResult(tree, r);
    },
  },
  {
    path: ["place", "merge"],
    summary: "Two records of one place made one: names, forms and jurisdictions into the other, the duplicate retracted",
    group: "sources",
    tree: true,
    writes: true,
    description:
      "Only when sure it is one place (the same parish and district, an old name of the town); --reason says why. The person's coordinates win. Records further than 1.5 km apart are not merged: ask the person with strom place propose --conflict.",
    args: [{ name: "place", description: "the duplicate's ID (L0012)", required: true }],
    options: [
      { name: "into", type: "string", value: "<L…>", description: "the record it is the same place as" },
    ],
    examples: ['strom place merge L0003 --into L0002 --reason "Nová Lhota is the old name of Horní Lhota; the same parish"'],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      refuseInArchive(tree, "place merge", ctx.settings.agent(tree.config).value);
      if (!str(opts.into)) throw new UsageError("--into <L…>: the record it is the same place as", { hint: `strom place merge ${args[0]} --into L… --reason "…"` });
      const p = mergePlaces(tree, args[0]!, String(opts.into), String(opts.reason ?? ""));
      raisePlacesTask(tree, actsAsArchive(tree));
      return { text: written(tree), data: { place: p } };
    },
  },
  {
    path: ["place", "rewrite"],
    summary: "Write the facts' place as its record says (a variant, an abbreviation, a street into the house) — or ask the person",
    group: "sources",
    tree: true,
    writes: true,
    description:
      "One operation: every fact with the form gets the record's name; the street or number into --house; the form stays a name of the record, the transcripts unchanged. A fact whose house says another thing is left. A part of a municipality or another of the same name, a bare number: --propose (the person decides).",
    args: [{ name: "form", description: "the place as the facts write it", required: true }],
    options: [
      { name: "to", type: "string", value: "<L…>", description: "the place record the facts mean" },
      { name: "house", type: "string", value: "<street and number>", description: "what of the form is the house (K3.1)" },
      { name: "reason", type: "string", value: "<text>", description: "why (required unless --propose)" },
      { name: "propose", type: "boolean", description: "a question for the person instead" },
      { name: "why", type: "string", value: "<text>", description: "with --propose: what the question is about" },
    ],
    examples: ['strom place rewrite "H. Lhota" --to L0002 --reason "an abbreviation of Horní Lhota in the registers"', 'strom place rewrite "Lhota, Dlouhá" --to L0002 --house "Dlouhá" --reason "a street of the town"'],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      refuseInArchive(tree, "place rewrite", ctx.settings.agent(tree.config).value);
      if (!str(opts.to)) throw new UsageError("--to <L…>: the place record the facts mean");
      const r = rewriteForm(tree, args[0]!, { place: String(opts.to), ...(str(opts.house) ? { house: str(opts.house) } : {}) }, {
        ...(str(opts.reason) ? { reason: str(opts.reason) } : {}),
        propose: !!opts.propose,
        ...(str(opts.why) ? { why: str(opts.why) } : {}),
      });
      return {
        text: lines(written(tree), r.left ? `left: ${counted(r.left, "fact")} (their house says another thing — never written over)` : undefined),
        data: { place: r.place, changed: r.changed, left: r.left, asked: r.asked },
      };
    },
  },
  {
    path: ["place", "queue"],
    summary: "Queue places to be identified (or their coordinates checked) — or show the queue",
    group: "sources",
    tree: true,
    writes: true,
    description:
      "Nothing is spent by queueing: the research works through the queue in sessions of one area at a time (task places:identify, its estimate first). Without places and --all: the queue, its sessions and the estimate.",
    args: [{ name: "places", description: "place IDs (L0012) or places as the facts write them", variadic: true }],
    options: [
      { name: "all", type: "boolean", description: "every place of the facts off the map" },
      { name: "check", type: "boolean", description: "check the coordinates of places on the map (with --all: every one)" },
      { name: "request", type: "string", value: "<file|->", description: `the request as JSON ("-" = stdin): {"forms": […], "places": ["L…"], "all": "offmap|placed", "check": true, "flags": {"<form>": "${PLACE_FLAGS.join("|")}"}} (at most ${REQUEST_MAX})` },
    ],
    examples: ["strom place queue", 'strom place queue "H. Lhota" L0002', "strom place queue --all", "strom place queue --all --check"],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const json = requestOf(ctx, opts.request, args.length > 0 || !!opts.all, ["offmap", "placed"]);
      const asked = json || args.length || opts.all;
      if (asked) {
        refuseInArchive(tree, "place queue", ctx.settings.agent(tree.config).value);
        const ids = args.filter((a) => /^[Ll]\d+$/u.test(a.trim()));
        const forms = args.filter((a) => !ids.includes(a));
        const r = queuePlaces(
          tree,
          json ?? { forms, places: ids, ...(opts.all ? { all: opts.check ? ("placed" as const) : ("offmap" as const) } : {}), ...(opts.check ? { check: true } : {}) },
          isAgent(ctx.env) ? "research" : "person",
        );
        raisePlacesTask(tree, actsAsArchive(tree));
        const said = r.skipped.map((s) => `  ${s.form}: ${SKIP_SAID[s.why]}`);
        return { text: lines(r.queued.length ? `queued: ${counted(r.queued.length, "place")}` : "nothing queued", ...said, queueText(tree)), data: { queued: r.queued, skipped: r.skipped, ...queueData(tree) } };
      }
      // the queue shown: its task kept with it (a link's run asks for it), never in an archive
      raisePlacesTask(tree, actsAsArchive(tree));
      return { text: queueText(tree), data: queueData(tree) };
    },
  },
  {
    path: ["place", "unqueue"],
    summary: "Take places out of the queue of identification",
    group: "sources",
    tree: true,
    writes: true,
    args: [{ name: "places", description: "place IDs (L0012) or places as the facts write them", variadic: true }],
    options: [
      { name: "all", type: "boolean", description: "the whole queue" },
      { name: "request", type: "string", value: "<file|->", description: `the request as JSON ("-" = stdin): {"forms": […], "places": ["L…"], "all": "queued"} (at most ${REQUEST_MAX})` },
    ],
    examples: ['strom place unqueue "H. Lhota"', "strom place unqueue --all"],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const json = requestOf(ctx, opts.request, args.length > 0 || !!opts.all, ["queued"]);
      if (!json && !args.length && !opts.all) throw new UsageError("which places: their IDs or forms, or --all");
      const ids = args.filter((a) => /^[Ll]\d+$/u.test(a.trim()));
      const r = cancelPlaces(tree, json ?? { forms: args.filter((a) => !ids.includes(a)), places: ids, ...(opts.all ? { all: "queued" as const } : {}) });
      raisePlacesTask(tree, actsAsArchive(tree));
      return {
        text: lines(r.cancelled.length ? `taken out: ${counted(r.cancelled.length, "place")}` : "nothing taken out", ...r.skipped.map((s) => `  ${s.form}: ${SKIP_SAID[s.why]}`)),
        data: r,
      };
    },
  },
  {
    path: ["place", "answer"],
    summary: "Answer the research's question about a place (the person's own)",
    group: "sources",
    tree: true,
    writes: true,
    person: "Answering a question about a place is the person's own: the app's What waits or strom's menu, never an agent",
    args: [{ name: "places", description: "place IDs (L0012)", variadic: true }],
    options: [
      { name: "places-from", type: "string", value: "<file|->", description: 'many places from a file ("-" = stdin): JSON {"places": ["L…"], "expect": {"L…": "<time>"}}' },
      { name: "take", type: "string", value: `<${PLACE_TAKES.join("|")}>`, description: "a candidate (c1–c3), keep the coordinates, unknown, none of them, yes/no to a form; several places: first" },
      { name: "dry", type: "boolean", description: "only what it would do" },
      { name: "expect", type: "string", multiple: true, value: "<L…=time>", description: "the place as the person saw it (its question's time or its last change): changed since, it is not answered (repeatable)" },
    ],
    examples: ["strom place answer L0012 --take c1", "strom place answer L0012 L0015 --take first --dry"],
    run(ctx, { args, opts }) {
      const tree = ctx.tree();
      const take = String(opts.take ?? "");
      if (!(PLACE_TAKES as readonly string[]).includes(take)) throw new UsageError(`--take ${PLACE_TAKES.join(", ")}`, { code: "places.body" });
      const expect: Record<string, string> = {};
      for (const e of listOpt(opts.expect)) {
        const m = /^([Ll]\d{1,9})=(.{1,40})$/u.exec(e.trim());
        if (!m) throw new UsageError(`--expect "${e}": <L…>=<time>`, { code: "places.body" });
        expect[placeIdOf(m[1]!) ?? m[1]!.toUpperCase()] = m[2]!;
      }
      let ids = args;
      if (typeof opts["places-from"] === "string") {
        if (args.length) throw new UsageError("either places or --places-from", { code: "places.body" });
        const from = opts["places-from"];
        const text = from === "-" ? (ctx.io.stdinText?.() ?? "") : fs.existsSync(ctx.resolvePath(from)) ? fs.readFileSync(ctx.resolvePath(from), "utf8") : undefined;
        if (text === undefined) throw new UsageError(`no file ${from}`);
        const got = manyOf(text);
        ids = got.places;
        Object.assign(expect, got.expect);
      }
      if (!ids.length) throw new UsageError("which places: their IDs (L…), or --places-from", { code: "places.body" });
      const r = answerPlaces(tree, ids, take as PlaceTake, { dry: !!opts.dry, ...(Object.keys(expect).length ? { expect } : {}) });
      // one place, not answered: said as an error (the app asks again with the place as it is now)
      if (ids.length === 1 && !r.done.length && r.skipped[0]) {
        const s = r.skipped[0];
        if (s.why === "take") throw new UsageError(`${s.place}: --take ${take} is no answer to its question`, { code: "places.body", params: { place: s.place } });
        if (s.why === "unknown") throw new UsageError(`there is no place ${s.place} in this research`, { code: "place.unknown", params: { place: s.place }, hint: "strom place list" });
        throw new UsageError(`${s.place} changed since its question was seen${s.why === "no-question" ? " (no question waits)" : ""}`, { code: "places.changed", params: { place: s.place } });
      }
      return {
        text: lines(
          opts.dry ? `would answer: ${counted(r.done.length, "place")}${r.facts ? `, ${counted(r.facts, "fact")} set right` : ""}` : written(tree),
          ...r.skipped.map((s) => `  ${s.place}: ${s.why}`),
          r.undo ? `undo: strom place undo ${r.undo}` : undefined,
        ),
        data: r,
      };
    },
  },
  {
    path: ["place", "undo"],
    summary: "Undo the person's last step on places (answers)",
    group: "sources",
    tree: true,
    writes: true,
    person: "Undoing the person's answers is the person's own",
    args: [{ name: "step", description: "the step's id (the answer prints it)", required: true }],
    examples: ["strom place undo u1a2b3c"],
    run(ctx, { args }) {
      const tree = ctx.tree();
      const r = undoPlaces(tree, args[0]!);
      return { text: written(tree), data: r };
    },
  },
);

/** A request of the app (the bridge: --request -), checked: forms, places, all, check, flags — at most REQUEST_MAX. */
function requestOf(ctx: { io: { stdinText?: () => string }; resolvePath(p: string): string }, from: unknown, alsoArgs: boolean, alls: readonly string[]): QueueRequest | undefined {
  if (typeof from !== "string") return undefined;
  if (alsoArgs) throw new UsageError("either places and --all, or --request", { code: "places.body" });
  const text = from === "-" ? (ctx.io.stdinText?.() ?? "") : fs.existsSync(ctx.resolvePath(from)) ? fs.readFileSync(ctx.resolvePath(from), "utf8") : undefined;
  if (text === undefined) throw new UsageError(`no file ${from}`);
  const bad = (why: string) => new UsageError(`the request: ${why}`, { code: "places.body" });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw bad("a JSON object");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw bad("a JSON object");
  const b = body as Record<string, unknown>;
  const strings = (v: unknown, name: string): string[] => {
    if (v === undefined) return [];
    if (!Array.isArray(v) || !v.every((x) => typeof x === "string" && x.trim() && x.length <= 300)) throw bad(`${name}: a list of texts`);
    return v as string[];
  };
  const forms = strings(b.forms, "forms");
  const places = strings(b.places, "places");
  if (places.some((x) => !/^[Ll]\d{1,9}$/u.test(x.trim()))) throw bad("places: IDs of places (L…)");
  if (forms.length + places.length > REQUEST_MAX) throw bad(`at most ${REQUEST_MAX} places`);
  if (b.all !== undefined && !alls.includes(String(b.all))) throw bad(`all: ${alls.join(" or ")}`);
  if (b.check !== undefined && typeof b.check !== "boolean") throw bad("check: true or false");
  const flags: Record<string, PlaceFlag> = {};
  if (b.flags !== undefined) {
    if (!b.flags || typeof b.flags !== "object" || Array.isArray(b.flags)) throw bad("flags: {\"<form>\": \"far|district|label|choices\"}");
    for (const [k, v] of Object.entries(b.flags as Record<string, unknown>)) {
      if (!(PLACE_FLAGS as readonly unknown[]).includes(v)) throw bad(`flags: ${PLACE_FLAGS.join(", ")}`);
      flags[k.normalize("NFC").trim()] = v as PlaceFlag;
    }
  }
  if (!forms.length && !places.length && b.all === undefined) throw bad("forms, places or all");
  return {
    forms: forms.map((f) => f.normalize("NFC").trim()),
    places: places.map((x) => x.trim().toUpperCase()),
    ...(b.all !== undefined ? { all: b.all as QueueRequest["all"] } : {}),
    ...(b.check ? { check: true } : {}),
    ...(Object.keys(flags).length ? { flags } : {}),
  };
}

/** Many places to answer at once: {"places": ["L…"], "expect"?: {"L…": "<time>"}}, at most REQUEST_MAX. */
function manyOf(text: string): { places: string[]; expect: Record<string, string> } {
  const bad = () => new UsageError(`the places: JSON {"places": ["L…"], "expect": {"L…": "<time>"}}, at most ${REQUEST_MAX}`, { code: "places.body" });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw bad();
  }
  const b = body as { places?: unknown; expect?: unknown } | null;
  if (!b || typeof b !== "object" || !Array.isArray(b.places) || b.places.length > REQUEST_MAX) throw bad();
  if (!b.places.every((x) => typeof x === "string" && /^[Ll]\d{1,9}$/u.test(x.trim()))) throw bad();
  const expect: Record<string, string> = {};
  if (b.expect !== undefined) {
    if (!b.expect || typeof b.expect !== "object" || Array.isArray(b.expect)) throw bad();
    for (const [k, v] of Object.entries(b.expect as Record<string, unknown>)) {
      if (!/^[Ll]\d{1,9}$/u.test(k) || typeof v !== "string" || v.length > 40) throw bad();
      expect[placeIdOf(k) ?? k.toUpperCase()] = v;
    }
  }
  return { places: (b.places as string[]).map((x) => x.trim().toUpperCase()), expect };
}

const SKIP_SAID: Record<string, string> = {
  manual: "the person put it on the map — only --check",
  identified: "identified already — only --check",
  queued: "queued already",
  running: "a session works on it now",
  unknown: "no fact of the tree has it",
  unlocated: "not located",
};

function detailsOf(opts: Record<string, unknown>): PlaceDetails {
  return {
    ...(str(opts.name) ? { name: str(opts.name) } : {}),
    alt: listOpt(opts.alt).map(parseAltName),
    forms: listOpt(opts.form),
    ...(str(opts.kind) ? { kind: str(opts.kind) } : {}),
    ...(str(opts.parent) ? { parent: placeRef(String(opts.parent)) } : {}),
    jurisdictions: listOpt(opts.jurisdiction).map(parseJurisdiction),
    drop: listOpt(opts["drop-jurisdiction"]).map(parseDrop),
  };
}

function stepResult(tree: { written: { summary: string }[] }, r: PlaceStep) {
  return {
    text: lines(written(tree), r.today ? `today's name first: ${r.today} (the one other name in use since a year with no end; --name sets another)` : undefined),
    data: { place: r.place, ...(r.today ? { today: r.today } : {}), ...(r.dropped.length ? { dropped: r.dropped } : {}) },
  };
}

function placeRef(ref: string): string {
  const m = /^[Ll](\d+)$/u.exec(ref.trim());
  if (!m) throw new UsageError(`--parent: a place ID (L0001), not "${ref}"`);
  return `L${m[1]!.padStart(4, "0")}`;
}

/** The queue, its sessions by area and what they take. */
function queueData(tree: Parameters<typeof readPlacesFile>[0]) {
  const file = readPlacesFile(tree);
  const forms = factForms(tree);
  const batches = queueBatches(tree, file, forms);
  const running = identifyingNow(tree) ? new Set((batches[0] ?? []).map(([k]) => k)) : new Set<string>();
  const recordOf = recordIndex(tree);
  return {
    queue: queueOrder(file).map(([k, e]) => {
      const p = recordOf(e.form);
      return { form: e.form, ...(p ? { place: p.id } : {}), state: placeState(p, e, running.has(k)), ...(e.check ? { check: true } : {}), ...(e.flag ? { flag: e.flag } : {}), at: e.at, by: e.by };
    }),
    batches: batches.length,
    estimate: identifyEstimate(tree, batches.length),
  };
}

function queueText(tree: Parameters<typeof readPlacesFile>[0]): string {
  const d = queueData(tree);
  if (!d.queue.length) return "the queue of places is empty";
  const est = d.estimate.queue;
  return lines(
    `queue: ${counted(d.queue.length, "place")} in ${counted(d.batches, "session")}${est ? ` — about ${est.minutes[0]}–${est.minutes[1]} min${est.usd ? `, $${est.usd[0]}–${est.usd[1]}` : ""}` : ""}`,
    table(d.queue.map((q) => [`  ${q.form}`, q.place ?? "", q.state ?? "", q.check ? "check" : "identify", q.flag ?? ""])),
  );
}
