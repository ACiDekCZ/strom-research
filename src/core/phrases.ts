// Texts strom itself writes into a research (the tasks it proposes: frontier,
// intake) are in the research language, like everything the agent writes.
// English is built in; a language adds assets/lang/<code>.json with the same
// keys (any it leaves out stay English). {name} marks a value filled in.

import { readAsset } from "./assets.ts";

export const PHRASES = {
  "estimate.marriage": "their marriage {year}",
  "estimate.child": "the eldest child known, {year}",
  "reason.unknown": "parents unknown",
  "reason.unproven": "parents not proven by a record",
  "born.about": " (born ~{year}, estimated from {from})",
  "the.birthplace": "the birthplace",
  "whole.book": "the whole book",

  "link.what": "Baptism of {name}{place}{about}",
  "link.place": ", {place}",
  "link.why": "{reason}; the baptism entry names both parents (generation {generation} of {research})",
  "link.done": "entry found and recorded with its parents — or {years} searched without it",

  "locate.what": "Where are the baptisms of {place}{around}? (for {name}{about})",
  "locate.around": " around {year}",
  "locate.where": "jurisdiction of {place}",
  "locate.where.unknown": "birthplace unknown — find it first",
  "locate.years": ", years {from}–{to}",
  "locate.why": "{reason}; no record set is known for the place and time",
  "locate.done": "a record set with access (URL or call number) is recorded and a link task points at it",

  "request.what": "Ask for the records of {name}: {tasks} found nothing",
  "request.where": "the archive or parish holding the records of {place}, or the family",
  "request.why": "{reason}; the record sets and archives known so far are exhausted",
  "request.done": "a request is sent (strom task wait … --on \"<reply>\") or the user decides the line ends here",

  "story.what": "Write the story of {name}",
  "story.more.what": "Add to the story of {name}: {count} new facts",
  "story.where": "the facts recorded (strom person show {id})",
  "story.why": "{count} facts from records tell the life (generation {generation} of {research}); the family reads it in the Strom app's family book",
  "story.done": "strom story set {id} with every fact it rests on (--fact) — a draft until the user approves it",
  "story.sources.what": "Beyond the registers, for the story of {name}: newspapers, directories, military, land and court records, graves, the history of the place",
  "story.sources.where": "the digitised newspapers, books and archives of the country and time; the web (indexes and trees are leads only)",
  "story.sources.why": "the story is to tell more than the registers do — every word still on a record; then strom proposes the story",
  "story.sources.done": "each find recorded as a source and a fact with its citation (the person matched by more than the name), the history of the place as a source, every search recorded — also in vain",
  "tune.negatives.what": "Search again for {name} in {book}: the earlier search found nothing on weak scans, a sharper copy is here now",
  "tune.negatives.why": "the negative search ({searches}) was made on views enlarged beyond the scans' detail; the sharper copy has {gain}× the detail — the person decided to search again",
  "tune.negatives.done": "the images {pages} read again on the sharper copies: the entry found and recorded, or the search recorded again as negative",

  "review.research": "Review of {name}",
  "review.unproven.research": "People without a record of their own",
  "review.more": " (and {count} more after these)",
  "review.mentions.what": "What the tree already says of {name} outside their data: {list}{more}",
  "review.mentions.why": "records, notes or the diary name {name}, yet their data do not show it — the cheapest finds of a review ({research})",
  "review.mentions.done": "each one read: what it says of {name} is recorded with its source, or a note says why not (strom person show {id})",
  "review.entries.what": "Read whole the entries of {name}: {list}{more}",
  "review.entries.why": "their images are here, but only part of each entry is recorded — the transcript, the godparents or witnesses, house, occupations, ages ({research})",
  "review.entries.done": "each entry transcribed whole (strom source edit … --transcript) and what it adds recorded: participants, house, occupation, age",
  "review.verify.what": "Check the facts of {name} that rest on one reading: {list}{more}",
  "review.verify.why": "each stands on a single reading of its image; a second, independent one proves it or shows a mistake ({research})",
  "review.verify.done": "each fact's entry read again blind (strom read M… --blind): the readings agree → proven; they differ → a conflict with both",
  "sync.verify.what": "Read for the research what the user wrote of {name} in the Strom app: {list}",
  "sync.verify.why": "the facts stand on the user's transcript (the Strom app, {source}) or the user read the record otherwise than the research; the research's own reading of each record proves them or shows a mistake",
  "sync.verify.done": "each record found and read independently (its image registered, strom read M… --blind): the readings agree → noted on the source and the facts kept; they differ → a conflict with both readings",
  "sync.reading.note": "The user read this record otherwise in the Strom app ({source}); the research's reading stays until it is read again:",
  "sync.reading.page": "page",
  "conflict.app.decided": "the user's decision in the Strom app",
  "conflict.app.noted": "{decided}: {note}",
  "sync.reading.text": "transcript",
  "archive.held": "kept for later: the research is an archive (the data come from the Strom app); back in the queue when work with an agent is switched on",
  "archive.removed": "removed in the Strom app",
  "review.reread.what": "Read again with {model} what the facts of {name} rest on: {list}{more}",
  "review.reread.why": "only another model read these entries; {model} is the one the user reads with now ({research})",
  "review.reread.done": "each fact's entry read blind with {model} (strom read M… --blind): agreed → noted on the fact; differs → a conflict with both readings",
  "review.conflicts.what": "Decide what is left open about {name}: {list}{more}",
  "review.conflicts.why": "conflicts between records and competing hypotheses wait for a decision ({research})",
  "review.conflicts.done": "each resolved or decided with its reasoning (strom conflict resolve, strom hypothesis decide) — or a task says what would decide it",
  "hypothesis.links.what": "Say what the variants of {list} would connect",
  "hypothesis.links.why": "these hypotheses name their people only in the words of their variants; the Strom app shows what a variant would connect — and where the tree ends — only from its links",
  "hypothesis.links.done": "each variant read (strom hypothesis show {first} …) and what it would connect said: strom hypothesis link H… <letter> --child P… --of F… (or --parents P… [P…], --same, --partners, --siblings); a variant that connects nothing clear stays without links",

  "review.marriage.what": "Marriage of {name} and {partner}{at} (before their first child, {year})",
  "review.marriage.why": "their children are recorded, their marriage is not; the entry gives both parents, ages and houses ({research})",
  "review.marriage.done": "the entry found and recorded with its witnesses — or {years} searched without it",
  "review.marriage.locate.what": "Where are the marriages of {place} around {year}? (for {name} and {partner})",
  "review.death.what": "Death of {name}{at} (after {year}, the last record of them)",
  "review.death.why": "no death or burial is recorded; the entry gives the date, the age, often the cause and the house ({research})",
  "review.death.done": "the entry found and recorded — or the books from {year} searched without it",
  "review.death.locate.what": "Where are the deaths of {place} after {year}? (for {name})",
  "review.locate.why": "no record set is known for the place and time ({research})",

  "session.user": "stopped by the user",
  "session.run": "the run stopped before the session ended (interrupted, or the computer went down)",
  "session.chat": "the conversation ended before the session was closed",
  "session.agent": "the agent stopped ({outcome}) without closing the session",
  "session.limit": "the agent's plan limit ran out before the session was closed{resets}",

  "transcript.read": "Transcript written by a reader ({model}) from the entry cut out of its scan and checked by a second reader ({date}, strom transcripts).",

  "app.media.what": "Analyse {count} file(s) the user sent from the Strom app — {who} ({first}–{last})",
  "app.media.nobody": "for the research",
  "app.media.why": "Originals from the user, sent from the Strom app (kept unchanged): find out what each is, whom it is about and what it can prove.",
  "app.scan.what": "Read the scan the user sent of {source} ({title})",
  "app.scan.why": "The user sent the record itself from the Strom app: the research reads it for itself — its reading confirms the user's transcript or shows a mistake.",
  "app.scan.done": "the entry read from the scan (strom read {media} --blind) and compared with {source}: they agree → noted on the source; they differ → a note with both readings and the facts on it checked",
  "batch.unnamed": "material from the Strom app",
  "batch.top": "its first level",
  "batch.what": "Sort the batch “{name}” ({part}/{parts}): {count} file(s) of {folder} ({first}–{last})",
  "batch.why": "The user sent many files from the Strom app at once ({who}); they are kept unchanged outside the tree's history. First look over all of them cheaply (names, folders, a small view), then read what belongs to the family — what is not of the family is said so and nothing of it written.",
  "batch.note": "The user's note to the batch: “{note}”.",
  "batch.book": "Many numbered images in one folder: probably the scans of a book — registered as images of its record set (strom media add --from-input I… --recordset B…), not read file by file.",
  "batch.done": "every file sorted (strom input sort I… --as source|document|photo|unrelated, with the person it is of) and what a record or document says recorded and cited as from any material — the images of a book registered as its images",
  "intake.files": "Analyse {count} files from {folder} ({first}–{last})",
  "intake.the.material": "the material",
  "intake.tree.imported": "Review imported tree {id} ({name})",
  "intake.tree.read": "Read the family tree {id} ({name}), not imported",
  "intake.text": "Process text {id}",
  "intake.text.file": "Process text {id} ({name})",
  "intake.other": "Analyse {id} ({name})",
  "intake.why.imported": "{persons} persons came in as leads{matched}: they guide the research, they prove nothing.",
  "intake.why.matched": ", {matched} matched existing persons",
  "intake.why.read": "Registered without importing it: nothing of it is in the tree; what it says can guide the research, it proves nothing.",
  "intake.why": "Material from the user: find out who and what it is about, and what it can prove.",
  "intake.done.imported": "the leads are checked for obvious mistakes (duplicates, impossible dates) and the first locate/link tasks exist",
  "intake.done.read": "what it adds to the tree is entered as leads citing it (strom source add … --kind family-tree --form authored --input {id}) — or the input is skipped with a reason (strom input skip {id} --reason …)",
  "intake.done": "every person and fact in it is recorded (a source if it is an original document, leads otherwise) and cited — or the input is skipped with a reason (strom input skip I… --reason …)",

  "task.answer": "The user answered (to: {asked}): {answer}",

  // who is at work, for the Strom app (the bridge's working)
  "who.run": "{agent} on its own",
  "who.chat": "{agent} conversation",

  // what a commit saved, for the Strom app (core/changelog.ts)
  "log.person.add": "New person: {who}",
  "log.person.name": "Name recorded: {who}",
  "log.person.edit": "Changed: {who}",
  "log.person.cite": "A record for {who}",
  "log.person.retract": "Withdrawn: {who}",
  "log.merge": "Two records of one merged: {who}",
  "log.family.add": "New family: {who}",
  "log.family.child": "A child of {who}: {child}",
  "log.family.edit": "Family changed: {who}",
  "log.family.cite": "A record for the family {who}",
  "log.event.add": "{who} – {fact}",
  "log.event.edit": "Refined: {who} – {fact}",
  "log.event.cite": "A record for: {who} – {fact}",
  "log.event.uncite": "A record no longer cited: {who} – {fact}",
  "log.event.recite": "The record the fact was taken from is cited again: {who} – {fact}",
  "log.person.uncite": "A record no longer cited for {who}",
  "log.family.uncite": "A record no longer cited for the family {who}",
  "log.event.retract": "Withdrawn: {who} – {fact}",
  "log.source.add": "Record from a source: {name}",
  "log.source.edit": "Record changed: {name}",
  "log.search.found": "Searched, found: {name}",
  "log.search.negative": "Searched, nothing there: {name}",
  "log.search.partial": "Searched, found in part: {name}",
  "log.search.inconclusive": "Searched, not clear: {name}",
  "log.recordset.add": "New book: {name}",
  "log.recordset.edit": "Book changed: {name}",
  "log.recordset.calibrate": "Which years are where in the book: {name}",
  "log.media": "New images: {name} (images {images})",
  "log.media.one": "New image: {name} (image {image})",
  "log.media.loose": "New images: {n}",
  "log.reading": "Read through: {name} (images {images})",
  "log.task.add": "New task: {name}",
  "log.task.done": "Done: {name}",
  "log.task.park": "Put aside: {name}",
  "log.task.drop": "Dropped: {name}",
  "log.task.wait": "Waits for an answer: {name}",
  "log.task.wake": "Back to the agent: {name}",
  "log.task.edit": "Task changed: {name}",
  "log.session.start": "The agent began: {name}",
  "log.session.close": "The agent finished: {name}",
  "log.lesson.add": "Learned: {name}",
  "log.lesson.edit": "Lesson corrected: {name}",
  "log.hypothesis.add": "A question weighed: {name}",
  "log.hypothesis.argue": "Weighed further: {name}",
  "log.hypothesis.link": "What a variant would connect: {name}",
  "log.hypothesis.variant": "Another possibility weighed: {name}",
  "log.hypothesis.decide": "Decided: {name}",
  "log.conflict.add": "The records disagree: {name}",
  "log.conflict.resolve": "Disagreement settled: {name}",
  "log.conflict.edit": "The edit in the disagreement now: {name}",
  "log.place.add": "New place: {name}",
  "log.place.edit": "Place refined: {name}",
  "log.repository.add": "New archive: {name}",
  "log.repository.edit": "Archive changed: {name}",
  "log.story.set": "Story: {who}",
  "log.story.approve": "Story approved: {who}",
  "log.story.discard": "The new version of the story not wanted, the approved one stays: {who}",
  "log.note.add": "Note: {name}",
  "log.input.add": "Material from the family: {name}",
  "log.input.sync": "Family tree taken in: {name}",
  "log.name.add": "Name recorded: {name} – {who}",
  "log.input.done": "Material gone through: {name}",
  "log.person.restore": "Back again: {who}",
  "log.family.retract": "Family withdrawn: {who}",
  "log.source.retract": "Record withdrawn: {name}",
  "log.place.retract": "Place withdrawn: {name}",
  "log.repository.retract": "Archive withdrawn: {name}",
  "log.name.remove": "Name taken off: {name} – {who}",
  "log.note.remove": "Note taken off: \"{note}\" – {name}",
  "log.note.edit": "Note corrected: {name}",
  "log.event.status": "How sure a fact is, changed: {who} – {fact}",
  "log.event.restore": "A fact back again: {who} – {fact}",
  "log.input.sync.undo": "Family tree taken back: {name}",
  "log.input.app": "Edits sent from the Strom app",
  "log.input.app.undo": "Edits from the Strom app taken back",
  "log.research.add": "New direction of the research: {name}",
  "log.research.edit": "Direction changed: {name}",
  "log.research.pause": "Direction paused: {name}",
  "log.research.resume": "Direction taken up again: {name}",
  "log.research.done": "Direction ended: {name}",
  "log.mode.archive": "The research is now an archive",
  "log.mode.research": "Research switched on again",
  "log.reading.loose": "Images read through: {n}",
  "log.clips": "Entries marked on their scans: {n} of {total}",
  "log.transcripts": "Entries transcribed from their cut-outs: {n} of {total}",
  "log.tree.create": "Research begun: {name}",
  "log.repair": "The data put back as they were last sealed",
  "log.chat.saved": "Saved after a conversation with the agent",
  "log.migrate": "The family tree's data brought up to date for a newer strom",
  "log.setting": "Setting of the research changed: {key}",
  "log.image": "{name}, image {image}",
  "log.media.edit": "Image changed: {name}",
  "log.media.retract": "Image withdrawn: {name}",
  "log.input.edit": "Material added to: {name}",
  "log.input.skip": "Material put aside as of no use: {name}",
  "log.input.sort": "Material sorted: {name}",
  "log.record.edit": "Changed: {name}",
} as const;

export type PhraseKey = keyof typeof PHRASES;

const catalogs = new Map<string, Record<string, string>>();

/**
 * The catalog of a language (assets/lang/<code>.json); empty when there is none.
 * It holds these phrases and the texts a person reads in the guided menu (ui.*, src/cli/ui.ts).
 */
export function catalog(lang: string): Record<string, string> {
  if (!/^[a-z]{2,3}$/.test(lang) || lang === "en") return {};
  if (!catalogs.has(lang)) {
    let parsed: Record<string, string> = {};
    try {
      parsed = JSON.parse(readAsset("lang", `${lang}.json`) ?? "{}");
    } catch {
      // a broken catalog must not stop the research: English it is
    }
    catalogs.set(lang, parsed);
  }
  return catalogs.get(lang)!;
}

/** The command this strom is started with (a second installation's own: strom-beta): what {strom} in a text says. */
let commandName = "strom";
export function sayCommandAs(name: string): void {
  commandName = name;
}

/**
 * A template with its {values} filled in (an unknown {name} stays as it is). {strom}, unless given: the command this
 * strom is started with — the program to start where a text names it alone ("Start again with: {strom}"), also in a
 * window of the system or a file, which no output of a command passes.
 */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, name: string) => (name in values ? String(values[name]) : name === "strom" ? commandName : m));
}

/** A text of a language's catalog, or the English one where the catalog has none. */
export function localized(lang: string, key: string, english: string, values: Record<string, string | number> = {}): string {
  const own = catalog(lang)[key];
  return fill(typeof own === "string" && own ? own : english, values);
}

/** A text in the research language, its {values} filled in. */
export function phrase(lang: string, key: PhraseKey, values: Record<string, string | number> = {}): string {
  return localized(lang, key, PHRASES[key], values);
}
