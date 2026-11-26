// Data model. One record = one JSON file under data/<collection>/<ID>.json.
// Facts are "conclusions" backed by citations; nothing is ever deleted,
// records and facts are retracted with a reason instead.

export const RECORD_TYPES = {
  research: { prefix: "G", dir: "researches" },
  person: { prefix: "P", dir: "persons" },
  family: { prefix: "F", dir: "families" },
  source: { prefix: "S", dir: "sources" },
  repository: { prefix: "R", dir: "repositories" },
  recordset: { prefix: "B", dir: "recordsets" },
  place: { prefix: "L", dir: "places" },
  search: { prefix: "Q", dir: "searches" },
  task: { prefix: "T", dir: "tasks" },
  conflict: { prefix: "X", dir: "conflicts" },
  hypothesis: { prefix: "H", dir: "hypotheses" },
  lesson: { prefix: "K", dir: "lessons" },
  input: { prefix: "I", dir: "inputs" },
  session: { prefix: "N", dir: "sessions" },
  media: { prefix: "M", dir: "images" },
  house: { prefix: "A", dir: "houses" },
} as const;

export type RecordType = keyof typeof RECORD_TYPES;

/** Prefixes of IDs that are not files of their own (embedded records). */
export const EMBEDDED_PREFIXES = {
  event: "E",
} as const;

export const ALL_PREFIXES: Record<string, string> = {
  ...Object.fromEntries(Object.entries(RECORD_TYPES).map(([t, v]) => [t, v.prefix])),
  ...EMBEDDED_PREFIXES,
};

/** Certainty of the conclusion (a fact). The quality of each piece of evidence is on its citation (GEDCOM QUAY). */
export const STATUSES = ["proven", "probable", "possible", "lead", "disproven", "retracted"] as const;
export type Status = (typeof STATUSES)[number];
/** The statuses a name takes (spec 066 P5): no disproven or retracted — a name found wrong is retracted itself. */
export const NAME_STATUSES = ["proven", "probable", "possible", "lead"] as const;

export type Sex = "M" | "F" | "U";

export interface Note {
  text: string;
  at: string;
  /** Session ID, or "user" for notes entered outside a session. */
  by: string;
  /** The texts it had before it was corrected (strom note edit), oldest first. */
  edits?: NoteEdit[];
  /**
   * The whole text of a note of the user's own family tree when it is longer than `text` holds (500 characters: an
   * older strom's limit); `text` is its beginning. Optional, a field of its own — an older strom keeps it and shows the
   * beginning. Read the note's text through `noteWhole`.
   */
  whole?: string;
}

/** A text a note (or a fact's note) had before it was corrected: when it was replaced, by whom and why. */
export interface NoteEdit {
  text: string;
  at: string;
  by: string;
  reason: string;
}

/** A name or a note taken back as wrong: when, by whom (a session ID or "user") and why. */
export interface Retraction {
  at: string;
  reason: string;
  by: string;
}

/**
 * A note taken back (strom note retract): kept apart from the notes — shown nowhere, given to no agent, in no GEDCOM —
 * for the history and to be put back. A fact's note keeps the time it was taken back as its own.
 */
export interface RetractedNote extends Note {
  retracted: Retraction;
}

export interface Citation {
  source: string;
  locator?: string;
  quote?: string;
  /** Information of the source FOR THIS FACT: the same entry is primary for a baptism date, secondary for an age. */
  information?: "primary" | "secondary" | "unknown";
  /**
   * The main citation of its fact (spec 095): chosen by the user alone — in the Strom app or in the terminal — never by
   * an agent; at most one citation of a fact. First in the order of the fact's citations (core/citeorder.ts).
   */
  main?: { by: "user"; at: string };
}

/**
 * A citation the user removed from a fact (spec 095 K3): kept so that the research never cites it there again on its
 * own — an agent may only with a reason, which closes the entry (`cleared`).
 */
export interface UncitedEntry {
  source: string;
  locator?: string;
  at: string;
  by: "user";
  /** The sync that brought the removal (I…), none: removed in the terminal. */
  sync?: string;
  /** Cited again with a reason: the entry no longer refuses. */
  cleared?: { at: string; reason: string };
}

export const PARTICIPANT_ROLES = ["godparent", "witness", "officiant", "informant", "midwife", "other"] as const;
export type ParticipantRole = (typeof PARTICIPANT_ROLES)[number];

export interface Participant {
  person?: string;
  name?: string;
  role: ParticipantRole;
  note?: string;
}

export interface Event {
  id: string;
  /** GEDCOM tag: BIRT, CHR, DEAT, MARR, OCCU, RESI, ... */
  kind: string;
  date?: string;
  /** The settlement (and the places above it) — never a house. */
  place?: string;
  /** The house number or address within the place, as the record gives it ("13", "13/2"). */
  house?: string;
  /** Cause (of a death, as the record gives it: "Lungensucht", "tuberculosis"). */
  cause?: string;
  /** Value for attribute events (OCCU "farmer", ...). */
  value?: string;
  /** Label of an EVEN ("Fire", "Military service"). */
  label?: string;
  /** Age stated in the record, GEDCOM form ("27y", "27y 3m", INFANT) — events of a person. */
  age?: string;
  /** Ages of the partners at a family event (a marriage states both): person ID → GEDCOM age. */
  ages?: Record<string, string>;
  participants?: Participant[];
  status: Status;
  citations: Citation[];
  /** Citations the user removed from this fact (spec 095 K3), never cited again unasked. */
  uncited?: UncitedEntry[];
  note?: string;
  /** The texts the note had before it was corrected, oldest first. */
  noteEdits?: NoteEdit[];
  /** The note taken back (strom note retract), kept for the history. */
  retractedNotes?: RetractedNote[];
  retracted?: { at: string; reason: string };
  /**
   * Where the value came from (spec 066): an import of a family tree (a lead: an agent changes it only with a record
   * cited) or the user (never changed by an agent — only proposed). No origin: the research's own. `parts` names the
   * parts that are the import's (none named: the whole fact).
   */
  origin?: ValueOrigin<"date" | "place" | "value">;
  /** The import's value before the research changed it with a record cited (spec 066): `strom event revert` puts it back. */
  was?: ValueWas<"date" | "place" | "value"> & { date?: string; place?: string; value?: string };
  /**
   * The person confirmed the fact against the scan (spec 065, `strom verify confirm`, the app's "verified by the scan").
   * The status stays as it is; no verification queues it again and no agent changes it. Optional: no SCHEMA_VERSION raised.
   */
  confirmed?: FactConfirmed;
  /** The last verification of the fact against its originals by an agent (spec 065, `strom verify done`). */
  verified?: FactVerified;
  /**
   * One copy of an event the Strom app shares among people (spec 085: a census of a household, a move) — a person's
   * fact only (`_STROM_SHARE`). Read, kept and given back; the research makes it only of a census household (strom
   * census add, spec 106 K3: an id of its own, the relation as the role) and keeps the copies' common fields alike
   * (core/household.ts). Optional: no
   * SCHEMA_VERSION raised.
   */
  share?: EventShare;
  /**
   * The person's (or the couple's) own event of a role at another's (spec 085 K2.2: a godparent's own "godparenthood",
   * `_STROM_ROLE`): never the baptism or marriage itself. Read, kept and given back. Optional: no SCHEMA_VERSION raised.
   */
  roleAt?: EventRoleAt;
}

/** The app's ID of a shared event as the research takes it: opaque, 1–64 letters and digits (an app's own ID, never text of a person). */
export const SHARE_ID = /^[A-Za-z0-9]{1,64}$/;

/** The mark of a shared event: the app's ID of it (opaque, letters and digits) and the person's role in it, as written. */
export interface EventShare {
  id: string;
  /** The person's role as the user wrote it ("maid"); none: a member of the household. */
  role?: string;
}

/** Whose event a role was at: our person (P…) or family (F…), and the GEDCOM tag of that event (BAPM, MARR…). */
export interface EventRoleAt {
  role: ParticipantRole;
  at?: string;
  kind?: string;
}

/** A fact confirmed by the person (spec 065). */
export interface FactConfirmed {
  at: string;
  by: "user";
}

/** An agent's verification of a fact against the originals it cites (spec 065). */
export interface FactVerified {
  at: string;
  /** The session that verified it, or "agent". */
  by: string;
  /** The model that looked at the original. */
  model?: string;
  /** proven: the original says so (status raised); kept: it stays as it was, `reason` says why. */
  result: "proven" | "kept";
  reason?: string;
  task?: string;
  /** The sources whose originals were looked at (the citations that prove it then). */
  cites: string[];
  /** 2: another model than every one that read those sources agreed. */
  readers?: 2;
}

/** Where a fact's, a name's or a sex's value came from (spec 066). */
export interface ValueOrigin<P extends string> {
  by: "import" | "user";
  /** The source of the import (S…). */
  source?: string;
  parts?: P[];
  /**
   * The user's value as their own family tree gave it — the Strom app's file or JSON taken in — and not changed by the
   * person since (the Strom file's `_STROM_ORIGIN tree`): the user's to guard (an agent only proposes), but nothing the
   * person confirmed. Without it, `by: "user"` is the person's own change: an edit, a value put back, a proposal taken, an
   * edit the Strom app sent. Only with `by: "user"`; an older strom ignores it and takes the value for the user's. Optional:
   * no SCHEMA_VERSION raised.
   */
  tree?: true;
}

/** The import's value kept when the research changed it (spec 066): only the parts changed, the first change's. */
export interface ValueWas<P extends string> {
  /** The source of the import the value came from. */
  source?: string;
  parts: P[];
  /** The import's citations the change took off (`revert` gives them back). */
  cites?: Citation[];
  /** The sources the research changed it on. */
  because: string[];
  at: string;
  by: string;
}

export const NAME_KINDS = ["birth", "married", "religious", "alias"] as const;

export interface Name {
  given: string;
  surname: string;
  /**
   * The title before the name ("Ing.", "MUDr.", "hrabě") and the title or epithet after it ("ml.", "Ph.D."): GEDCOM
   * NAME > NPFX / NSFX, the Strom app's titleBefore / titleAfter (of the name the person is shown by). Never part of
   * the name itself — not searched, matched or compared with it.
   */
  prefix?: string;
  suffix?: string;
  kind?: (typeof NAME_KINDS)[number];
  /**
   * The name the person is shown by now — the user's choice, never told from a record (a divorced woman back at her
   * birth surname, spec 024): at most one name of a person; none marked, the name of their identity (primaryName).
   * Only how the person is shown (currentName): the identity a correction, a citation, pairing and a sync go by stays
   * primaryName. GEDCOM NAME > _STROM_PRIMARY Y.
   */
  primary?: true;
  /**
   * The name after a marriage the user chose as the one now (spec 010 K4.2: changed in the Strom app): over the rule of
   * the latest marriage (core/married.ts) until the user chooses another; at most one name of a person. Only the order
   * the files give the names after a marriage in (the one now last) — never how the person is shown (primary).
   */
  marriedNow?: true;
  /** The records that give the person this name (in this form). */
  citations?: Citation[];
  /** Where the name came from (spec 066): an import or the user; none, the research's. */
  origin?: ValueOrigin<"given" | "surname">;
  /** The import's name before the research changed it with a record cited (spec 066). */
  was?: ValueWas<"given" | "surname"> & { given?: string; surname?: string };
  /**
   * How sure the name is, as a fact's status (spec 066 P5): drawn from a record that names the person (strom cite P… S…
   * --status, name add / person add with --cite). Any name may have one; none: the name stands on its citations alone (a
   * name of an imported family tree shows its origin). Optional: no SCHEMA_VERSION raised.
   */
  status?: Status;
  /**
   * The person confirmed the name against the scan (spec 066 P5, as a fact's: spec 065) — the name of their identity
   * (primaryName) alone. Its status stays as it is; no agent changes it. Optional: no SCHEMA_VERSION raised.
   */
  confirmed?: FactConfirmed;
  /** The last verification of the name against its originals by an agent — the name of their identity alone. */
  verified?: FactVerified;
}

/**
 * A name taken back as wrong (strom name retract): kept apart from the names — not shown, not given to an agent, not
 * in a GEDCOM, never matched or searched — for the history and to be put back (strom name restore).
 */
export interface RetractedName extends Name {
  retracted: Retraction;
}

export interface BaseRecord {
  id: string;
  type: RecordType;
  created: string;
  updated: string;
  retracted?: { at: string; reason: string };
  /** A duplicate merged into this record (it stays, retracted, for the history). */
  mergedInto?: string;
  /** Notes taken back (strom note retract), apart from `notes`: shown nowhere but in the history. */
  retractedNotes?: RetractedNote[];
}

/** Identity of a record in another system (Strom app, a GEDCOM file). */
export interface ExternalRef {
  system: string;
  id: string;
}

/** An ID line a family tree's program gave a record (_UID, UID, RIN, EXID, _FSFTID, AFN): its tag, its value as written, an EXID's TYPE. */
export interface OriginalId {
  tag: string;
  value: string;
  type?: string;
}

/**
 * The IDs a record had in a family tree it came from (spec 066 K3.2): the import's source (Source.imported), the
 * record's xref in that file (without @) and its ID lines as written. `xid`: the record did not come of that import
 * (merged with one that did, or the user's own the app joined it to) — the IDs are its, no value of it the import's.
 */
export interface OriginalIds {
  source: string;
  xref?: string;
  ids?: OriginalId[];
  xid?: true;
}

/** Limits of original IDs: lines in an entry, entries on a record, the longest value, TYPE and xref. */
export const ORIGINAL_IDS_LIMITS = { ids: 20, entries: 50, value: 200, type: 300, xref: 100 } as const;

/**
 * The story of a person or a couple, written for the family from the facts —
 * prose on top of the evidence, never evidence itself.
 */
export interface Story {
  title?: string;
  /** A draft until the user approves it. */
  status: "draft" | "final";
  /** Paragraphs separated by a blank line; **bold** is kept. */
  text: string;
  /** The facts it leans on (E…). */
  facts: string[];
  /** The sources of the background of place and time it tells (S…): not facts of the person. */
  sources?: string[];
  /** The events of the history of the places it tells as the background of its time (stories.history; their IDs). */
  history?: string[];
  /** The author's caveat. */
  note?: string;
  /** What it left out on purpose of the version before it, and why (strom story set --drop). */
  dropped?: { ref: string; why: string }[];
  at: string;
  by: string;
  /**
   * A new version written after the user approved the story (the lock): it waits for them — approved, it takes the
   * story's place; discarded, the approved one stays. The approved story is never rewritten in place.
   */
  draft?: StoryDraft;
}

/** A new version of an approved story, waiting for the user. */
export interface StoryDraft {
  title?: string;
  text: string;
  facts: string[];
  sources?: string[];
  history?: string[];
  note?: string;
  dropped?: { ref: string; why: string }[];
  at: string;
  by: string;
}

export interface Person extends BaseRecord {
  type: "person";
  names: Name[];
  /** Names taken back (strom name retract), apart from `names`. */
  retractedNames?: RetractedName[];
  sex: Sex;
  /** Where the sex came from (spec 066): an import or the user; none, the research's. */
  sexOrigin?: ValueOrigin<never>;
  /** The import's sex before the research changed it with a record cited (spec 066). */
  sexWas?: Omit<ValueWas<never>, "parts"> & { sex: Sex };
  events: Event[];
  story?: Story;
  notes: Note[];
  refs?: ExternalRef[];
  /** The IDs the person had in the family trees they came from (spec 066 K3.2). */
  originalIds?: OriginalIds[];
  /**
   * How to reach the person (spec 134 U11): the user's data — the e-mails another family tree or the Strom app gives
   * them. No evidence, no citation, no origin; empty never written.
   */
  contact?: PersonContact;
}

/** A person's contact: e-mail addresses, each once. */
export interface PersonContact {
  emails?: string[];
}

export const CHILD_RELATIONS = ["birth", "adopted", "step", "foster", "unknown"] as const;
export type ChildRelation = (typeof CHILD_RELATIONS)[number];

export interface ChildLink {
  person: string;
  relation: ChildRelation;
  relations?: Record<string, ChildRelation>;
}

export interface Family extends BaseRecord {
  type: "family";
  partners: string[];
  /**
   * The children: `relation` to both partners, `relations` where it differs
   * for one of them (partner ID → relation: a stepchild of the husband, the
   * wife's own).
   */
  children: ChildLink[];
  events: Event[];
  story?: Story;
  /** The records that show the family itself — a couple, a child's parents — where no fact of it carries them. */
  citations?: Citation[];
  notes: Note[];
  refs?: ExternalRef[];
  /** The IDs the family had in the family trees it came from (spec 066 K3.2). */
  originalIds?: OriginalIds[];
  /** Two parents of a child who are no couple, as the Strom app keeps them (its _STROM_NO_COUPLE). */
  noCouple?: true;
  /**
   * How the couple is bound where its facts cannot say it: partners or separated (the Strom app's _STAT); a family of
   * one partner — married to somebody unknown, with no child or with their children — any of the four (its bare MARR,
   * DIV or _STAT); none: the one parent's children, no couple.
   */
  union?: Union;
  /**
   * The partner the files write as HUSB, kept when a sex of the partners changed and the sides would otherwise swap
   * (U01-e): an app that guesses an unknown sex by the side sees no change. Never a woman HUSB beside a man.
   */
  husb?: string;
}

export const UNIONS = ["married", "divorced", "partners", "separated"] as const;
export type Union = (typeof UNIONS)[number];

export const DIRECTIONS = ["ancestors", "descendants", "person", "question"] as const;
export type Direction = (typeof DIRECTIONS)[number];

/** Whom a review covers: the person, with their partners and children, or with their ancestors. */
export const REVIEW_SCOPES = ["person", "family", "line"] as const;

export const RESEARCH_STATES = ["active", "paused", "done"] as const;
export type ResearchState = (typeof RESEARCH_STATES)[number];

export interface Research extends BaseRecord {
  type: "research";
  name: string;
  focus: string;
  direction: Direction;
  state: ResearchState;
  /** When its state last changed (strom research pause|done|resume); before, its creation. */
  stateSince?: string;
  priority: number;
  /** Its place in the order of work (1 = first; core/order.ts). Missing in a research of an older strom: by priority. */
  order?: number;
  limits?: { generations?: number; before?: number };
  /**
   * A person research that reviews what is recorded (strom review): whom, and a second reading by this model.
   * `people`: a review of several people (strom review P… P…), the focus the first of them (what an older strom,
   * which knows no `people`, reviews); `unproven`: they are the people no record of their own proves (strom
   * review --unproven), a batch at a time, each until a record proves them.
   */
  review?: { scope: (typeof REVIEW_SCOPES)[number]; reread?: string; people?: string[]; unproven?: boolean };
  question?: string;
  parent?: string;
  notes: Note[];
}

export const SOURCE_KINDS = [
  "baptism", "birth", "marriage", "death", "burial", "census", "civil", "church", "land", "tax",
  "military", "court", "notarial", "newspaper", "index", "letter", "photo", "family-tree",
  "family-memory", "certificate", "book", "web", "other",
] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

/** A record or document that says something: one register entry, one certificate, one family tree. */
export interface Source extends BaseRecord {
  type: "source";
  kind: SourceKind;
  title: string;
  recordset?: string;
  repository?: string;
  input?: string;
  /** Where exactly: folio, page, entry number, image — with folio and image given apart, the rest (entry number, column). */
  locator?: string;
  /** The folio or page as the book numbers it, with its word: "fol. 12v", "pag. 112" (spec 075; core/sourcefields.ts). */
  folio?: string;
  /** The entry's image number(s) as the archive's portal counts them ("34", "57–58"); none: those of its registered images. */
  image?: string;
  /** The book's call number, where the entry is in no record set of the research or in another one than its record set says. */
  callNumber?: string;
  /** Date the record was made (GEDCOM form). */
  date?: string;
  transcript?: string;
  translation?: string;
  /** Language of the record (BCP 47). */
  language?: string;
  information: "primary" | "secondary" | "unknown";
  form: "original" | "derivative" | "authored";
  url?: string;
  accessed?: string;
  /** The registered images the record is on (M…). Only registered images can be cited. */
  media?: string[];
  /** Where the entry itself is on its images: the part a reader cut out (two when it runs over a page break). */
  clips?: Clip[];
  /**
   * A source the user wrote in the Strom app, taken in by strom sync: whether its transcript counts as the user's
   * reading of the record (the app's "my transcripts are evidence" when it was sent, or "transcript verified").
   */
  app?: { read: boolean; verified?: boolean };
  /** A reading of a document the person confirmed in the Strom app (strom document read): D…, and its entry (e1 …). */
  reading?: string;
  readingEntry?: string;
  /** The readings of its record made again from its original (strom document read --source): D…, oldest first; none changes the source. */
  readings?: string[];
  /**
   * The person's word on a reading again that differs in a matter of fact with no task of it (read.sourceTask ask or
   * never): now with the agent, into the queue (task: the task it made), just keep it — that reading asked no more —,
   * or (a transcript the person confirmed) review: a wording proposed to the person (task: theirs, core/proposal.ts).
   * appended: the places went into a task of the source not ended. unsure: asked by the person of a reading with no
   * matter of fact both readers are sure of, only of places they are not sure of (queue or review; optional: an older
   * strom keeps it and ignores it).
   */
  readDecided?: { reading: string; take: "now" | "queue" | "keep" | "review"; at: string; task?: string; appended?: true; unsure?: true };
  /**
   * Who read it beyond what the history says (core/readers.ts): the user's own reading — typed by hand at the person's
   * terminal, the transcript confirmed in the Strom app (the bridge), or kept by the fix of the readers (an earlier
   * strom counted every write of "user" as one). Its mark (`txt`): the transcript it is of — once the research changes
   * the transcript it counts no more (an optional field: an older strom keeps it).
   */
  read?: {
    user?: UserReading;
    /**
     * The marks (core/readers.ts transcriptMark) of the wordings proposed for this transcript that the person declined,
     * keeping theirs (core/proposal.ts): never proposed again. Optional: an older strom keeps it and ignores it.
     */
    declined?: string[];
  };
  /**
   * The source is an import of a family tree from another program (spec 066): its key in the research ("R1", "R2"…),
   * the program and its version, the file's date (HEAD DATE), when it was imported, the file and its hash.
   */
  imported?: { key: string; program?: string; version?: string; date?: string; at?: string; file?: string; sha?: string };
  /**
   * The person deleted the source (spec 117, strom source retract; `retracted.reason` "deleted"): the citations taken
   * off the facts, names and families with it, the tasks and conflicts it changed — what strom source restore puts
   * back. Optional: an older strom keeps it and sees the source retracted.
   */
  deleted?: SourceDeletion;
  notes: Note[];
}

/** What deleting a source (strom source retract) took off the tree, kept to put it back (core/sourceretract.ts). */
export interface SourceDeletion {
  at: string;
  by: "user";
  /** Where the person deleted it: the Strom app (the bridge) or the terminal. */
  via?: "bridge" | "terminal";
  reason?: string;
  cites: DeletedCitation[];
  /** The facts whose status the citations left could not carry: as sure as they were before. */
  lowered?: { owner: string; event: string; from: Status; to: Status }[];
  /** The tasks it ended or narrowed: each as it was, and when the deletion changed it (put back only if unchanged since). */
  tasks?: { was: Task; after: string }[];
  /** The conflicts it marked for review. */
  conflicts?: string[];
}

/** One citation of a deleted source as it stood: on a fact (event), a name (its index and parts), or a family itself. */
export interface DeletedCitation {
  owner: string;
  /** The fact's tag (NAME a name's, FAM a family's own). */
  fact: string;
  event?: string;
  name?: { index: number; given: string; surname: string };
  /** Its place among the citations it stood in. */
  at: number;
  citation: Citation;
}

/** The user's reading of a source: how (by hand, confirmed in the app, kept by the fix), when, of which transcript. */
export interface UserReading {
  how: "hand" | "confirm" | "earlier";
  at: string;
  /** The mark of the transcript read (core/readers.ts transcriptMark). */
  txt?: string;
}

/** The entry on one registered image: a region of it in fractions (0–1) of that image (M…, a whole image or a part of one). */
export interface Clip {
  media: string;
  region: Region;
}

export const AUTOMATION = ["allowed", "manual", "forbidden", "unknown"] as const;

export interface Repository extends BaseRecord {
  type: "repository";
  name: string;
  country?: string;
  region?: string;
  url?: string;
  /** Terms of use in a sentence, and a link if there is one. */
  terms?: string;
  /** May tools download from it automatically? */
  automation: (typeof AUTOMATION)[number];
  notes: Note[];
}

export const ACCESS = ["online-free", "online-login", "onsite", "request", "lost", "unknown"] as const;

export interface Calibration {
  image: number;
  page: string;
}

/** A book, film or collection: "Týnec nad Labem 17, births 1861–1869". */
export interface RecordSet extends BaseRecord {
  type: "recordset";
  title: string;
  repository?: string;
  callNumber?: string;
  kinds: string[];
  places: string[];
  /** "1784-1820" */
  years?: string;
  access: (typeof ACCESS)[number];
  url?: string;
  images?: number;
  calibration: Calibration[];
  /** How the pages are laid out; what a reader must know. */
  layout?: string;
  /** Registered knowingly beside these books of the same link or the same book of a connector, and why. */
  duplicates?: { of: string[]; reason: string };
  notes: Note[];
}

export const JURISDICTIONS = ["parish", "civil", "diocese", "manor", "district", "county", "state", "other"] as const;

export interface Jurisdiction {
  kind: (typeof JURISDICTIONS)[number];
  name: string;
  from?: number;
  to?: number;
  repository?: string;
  recordsets?: string[];
}

/**
 * What a name of a place record is, after the first (today's): a form the facts write that was identified as the place
 * ("form"), or another name of it — another language, a historical name ("alt"). Optional: a name written before it
 * was kept has none (an older strom keeps it and ignores it; no SCHEMA_VERSION raised).
 */
export const PLACE_NAME_KINDS = ["form", "alt"] as const;
export type PlaceNameKind = (typeof PLACE_NAME_KINDS)[number];

export interface PlaceName {
  name: string;
  lang?: string;
  from?: number;
  to?: number;
  kind?: PlaceNameKind;
}

export interface Place extends BaseRecord {
  type: "place";
  names: PlaceName[];
  kind?: string;
  coords?: { lat: number; lon: number };
  /** Why it has no coordinates: not identified yet (which of the villages of this name). Given coordinates clear it. */
  unlocated?: string;
  parent?: string;
  jurisdictions: Jurisdiction[];
  /**
   * How the place was identified (core/placeid.ts): by whom, when, why and from what; checked by the research; what
   * would decide it while it is not identified; a question for the person. Optional: an older strom keeps it and
   * ignores it (no SCHEMA_VERSION raised).
   */
  locating?: PlaceLocating;
  notes: Note[];
}

/**
 * Who put a place on the map: the research, the person (in the app or by hand). "adopted" (taken from another research
 * here) is read, never written: no coordinates are taken from another research (it shows its records as a proposal only).
 */
export const PLACE_BY = ["research", "person", "adopted"] as const;
export type PlaceBy = (typeof PLACE_BY)[number];

/** One place a question offers (at most three): where it is and why. */
export interface PlaceCandidate {
  id: string;
  name: string;
  district?: string;
  country?: string;
  lat: number;
  lon: number;
  why: string;
  source?: { title: string; url?: string };
}

/** A question about a place for the person (the app's What waits, kind place). */
export interface PlaceQuestion {
  /** propose: which of the candidates; conflict: the coordinates against what the records say; form: how the facts write it. */
  kind: "propose" | "conflict" | "form";
  at: string;
  candidates?: PlaceCandidate[];
  /** A conflict: the coordinates now. */
  current?: { lat: number; lon: number; label?: string };
  /** A form: the facts' place (and house) before and after. */
  change?: { from: { place: string; house?: string }; to: { place: string; house?: string }; facts: number };
  why?: string;
}

export interface PlaceLocating {
  by: PlaceBy;
  at: string;
  why?: string;
  source?: { title: string; url?: string };
  /** The day the research checked the coordinates and found them right (K6.6). */
  verified?: string;
  /** On what the research found them right. */
  verifiedWhy?: string;
  /** The reference the check of the coordinates stood on (strom place verify --source-title). */
  verifiedSource?: { title: string; url?: string };
  /** Checked, and why it could not be decided. */
  checkWhy?: string;
  /** When the research last checked the coordinates (right or undecided): a check queued before it is done. */
  checked?: string;
  /** Not identified: what would decide it. */
  needs?: string;
  /** Not identified: how much was known of it then (facts citing a record, jurisdictions, parent) — more is something new (K2.3). */
  context?: number;
  /** The person kept these coordinates against the research's question: not asked again while they stay. */
  kept?: { lat: number; lon: number };
  question?: PlaceQuestion;
}

export const SEARCH_METHODS = ["index", "page-by-page", "full-text", "catalog", "web", "request", "other"] as const;
export const SEARCH_RESULTS = ["found", "negative", "partial", "inconclusive"] as const;

/** What was searched where — also, and especially, when nothing was found. */
export interface Search extends BaseRecord {
  type: "search";
  question: string;
  recordsets: string[];
  scope: { years?: string; surnames?: string[]; places?: string[]; pages?: string };
  method: (typeof SEARCH_METHODS)[number];
  result: (typeof SEARCH_RESULTS)[number];
  findings: string[];
  task?: string;
  /** Who looked: the main agent, a reader, or the user. */
  by: "main" | "reader" | "user";
  notes: Note[];
}

/** How the task queue is ordered (core/queue.ts). */
export const STRATEGIES = ["balanced", "depth", "priority"] as const;
export type Strategy = (typeof STRATEGIES)[number];
/**
 * Work off the lines of a research with several (setting queue.offLine, core/offline.ts): now and then (the default — one
 * task off the lines in queue.offLineShare), after the lines' work, as the lines' work, never. An older strom that knows no
 * "occasional" takes it as its default (last).
 */
export const OFF_LINE_CHOICES = ["occasional", "last", "normal", "never"] as const;
export type OffLine = (typeof OFF_LINE_CHOICES)[number];

/** The person's answer to a task's check of a site: the book and its images there, only to be viewed there, nothing there. */
export const CHECK_ANSWERS = ["works", "view", "no"] as const;
export type CheckAnswer = (typeof CHECK_ANSWERS)[number];

/** The longest answer of the person to a waiting task (strom task wake --answer, the Strom app's answer). */
export const ANSWER_MAX = 4000;

/** The person's answer to what a task waited for (Task.answers). */
export interface PersonAnswer {
  by: "person";
  /** What the task asked (its waitingOn then). */
  asked: string;
  /** The site the person checked (awaitsCheck). */
  url?: string;
  check?: CheckAnswer;
  /** Their words. */
  answer?: string;
  at: string;
  /** Where they gave it: their terminal (strom's menu too), a window of the system. */
  via?: "terminal" | "window";
  /**
   * Given in the Strom app (its What waits, through the bridge): no via then. Optional, a field of its own — an older
   * strom keeps it and reads the answer as the person's (a new value of via it would refuse).
   */
  givenIn?: "app";
  /** The whole answer when it is longer than `answer` holds (500 characters: an older strom's limit), at most 4000. */
  whole?: string;
}

/** A file that came for what a task waited for (Task.files). */
export interface TaskFile {
  /** The input it became (I…), or the image of a source the research had of the same content (M…). */
  input: string;
  /** Who handed it over: "user" (a terminal), "app" (the Strom app through the bridge), "agent", a session. */
  by: string;
  /** What the task asked (its waitingOn then). */
  asked: string;
  at: string;
}

/** What a task waits for, as the agent says it (strom task wait --kind; core/waitkind.ts reads the rest). */
export const WAIT_KINDS = ["letter", "family", "web", "other"] as const;

export const TASK_LEVELS = ["intake", "locate", "link", "verify", "enrich", "request", "narrate"] as const;
export const TASK_STATES = ["open", "doing", "done", "parked", "waiting", "dropped"] as const;

/** What strom task audit --fix changed on a task (Task.auditFix). */
export interface TaskAuditFix {
  at: string;
  by: string;
  givenIn?: "app";
  before: { waitingOn?: string; wait?: Task["wait"]; awaits?: Task["awaits"]; where: string[] };
  made: string[];
  after: Record<string, string>;
}

/** A unit of research work. Contract: what, where, why, done-when. */
export interface Task extends BaseRecord {
  type: "task";
  level: (typeof TASK_LEVELS)[number];
  /** 1 (low) .. 5 (urgent) */
  priority: number;
  what: string;
  where: string[];
  why: string;
  doneWhen: string;
  subject: string[];
  research?: string;
  state: (typeof TASK_STATES)[number];
  parkedUntil?: string;
  /** Why it was put aside (strom task park --reason, or strom run parking a stuck task). */
  parkedReason?: string;
  /**
   * Parked by strom run because strom was refused to the agent in its sessions again and again (its sandbox): "denied"
   * — one such task at a time, until a session records something (K031). Optional: an older strom keeps it.
   */
  parkedFor?: string;
  /**
   * A task of history for these kinds of events alone (strom history align: a kind turned on, looked for where the
   * history was looked for without it). Optional: an older strom keeps it and looks for every kind.
   */
  kinds?: string[];
  /** Put aside because the research is an archive: back in the queue when work with an agent is switched on. */
  heldBy?: "archive";
  /** What it was when the archive put it aside, when it was not open: waiting for the user — waiting again after. */
  heldFrom?: "waiting";
  waitingOn?: string;
  /**
   * The images it waits for, which the user saves by hand: of this record set, into this folder of the shared inbox.
   * `again`: those of them saved once more (strom media save --again; as `images`, "23–25") — registered already, what
   * it waits for is their new copy; each leaves the list as its new copy is taken. Optional: an older strom ignores it.
   */
  awaits?: { recordset: string; images: string; folder: string; since?: string; again?: string };
  /**
   * The person's check of a site it waits for (strom task wait --check): the address, and what to check there — a
   * site that keeps automated tools off, the source still necessary. Only the person answers it.
   */
  awaitsCheck?: { url: string; ask: string };
  /**
   * The person's decision about an archive's images it waits for (or was put aside over): the archive's hosts, since
   * when, its name — woken in every research here once the person decides (core/archivewait.ts). Optional: an older
   * strom keeps it and ignores it.
   */
  awaitsPermission?: { hosts: string[]; since: string; title?: string };
  /**
   * What it waits for, as the agent says it (strom task wait --kind/--to/--request/--url): a letter (by post or e-mail),
   * the family, a site, other; whom (an office, an archive, the family); the request's text saved in the tree's notes/;
   * the site; the book the person is to search (--book), when it is not the one its where names (core/books.ts
   * waitTarget). Optional, each: what a task waits for is otherwise read from its words (core/waitkind.ts); an older
   * strom keeps book and ignores it. Gone when it waits no more.
   */
  wait?: { kind?: (typeof WAIT_KINDS)[number]; to?: string; note?: string; url?: string; book?: string };
  /**
   * The request it waits on went out (strom task sent): the letter mailed, the family asked — when, by whom. Not a
   * consent, not a wake: the task still waits. Gone when it waits no more, or is set waiting again.
   */
  sent?: { at: string; by: string };
  /**
   * The task it was split off by strom task audit --fix (one book per task: the wait of the other named several).
   * Optional: an older strom keeps it and ignores it.
   */
  splitFrom?: string;
  /**
   * What strom task audit --fix changed on it, for undoing it (--unfix): the wait before, the tasks it made, each
   * task's `updated` right after — undone only while none has changed since. Optional: an older strom keeps it.
   */
  auditFix?: TaskAuditFix;
  /**
   * The person kept its wait as it is (strom task audit --keep): the kinds of findings then and a hash of the wait —
   * it holds while the wait is the same and finds nothing more. Optional: an older strom keeps it.
   */
  auditKept?: { at: string; by: string; givenIn?: "app"; kinds: string[]; wait: string };
  /**
   * What the person answered for it (strom task wake --answer/--check, only by the person: their terminal, a window of
   * the system, strom's menu) — kept apart from the notes, which an agent writes too.
   */
  answers?: PersonAnswer[];
  /**
   * Files that came for what it waited for (strom intake --answers, the Strom app's file to a task): each an input of
   * the research (or the image it had of that content), who handed it over (the user, the app, an agent), what the task
   * asked then. Not the person's words: only that the file came. Optional: an older strom keeps it and ignores it.
   */
  files?: TaskFile[];
  result?: string;
  produced?: string[];
  /**
   * How the task helps a line of the research though none of its people is in one (strom task add|edit --helps): an
   * ancestor's sibling as a godparent or witness, the same house, a surname for an ancestor — the line named by its ID
   * (G…) when said. Without it a task off the lines goes as queue.offLine says — occasional by default: now and then
   * one, the rest after the lines' work (core/offline.ts). Optional:
   * an older strom keeps it and ignores it.
   */
  helps?: string;
  /**
   * The person's word on when it comes (strom task order, the Strom app's "do it now" / "at the end"): next — before all
   * else but the task at work, once (gone when a session on it ends); last — after everything in the queue, until it is
   * done or set back. Optional: an older strom keeps it and ignores it.
   */
  queueAt?: { do: "next" | "last"; at: string };
  /**
   * The other houses (A…) a task of a house works on with its own (spec 030 part 2): neighbouring houses of the same
   * family in the same municipality, at most two more. Optional: an older strom keeps it and ignores it.
   */
  houses?: string[];
  /**
   * When the person asked for it (ISO; strom house request, the Strom app's link): such a task is never held while its
   * kind of work is switched off. Optional: an older strom keeps it and ignores it.
   */
  asked?: string;
  /**
   * The person returned it to the agent from What waits (strom task wake --retry: the menu, the Strom app) — images its
   * archive's browser held back, or that the agent's browser reaches now: the last time (at), by whom, given in the app,
   * and the last times (at most 5, ISO) — the queue counts only the sessions after it, at most RETRY_MAX returns a day
   * (core/retry.ts). Optional: an older strom keeps it and ignores it.
   */
  retried?: { at: string; by: string; givenIn?: "app"; times: string[] };
  /**
   * A new wording proposed for a transcript the person read or confirmed (core/proposal.ts): the person's decision alone,
   * to take it or keep the transcript — never the queue's nor an agent's (core/transcriptguard.ts). The latest
   * proposal; an earlier one is in the notes. Optional: an older strom keeps it and ignores it.
   */
  proposal?: TranscriptProposal;
  /**
   * A participant's note the Strom app sent that is only the beginning of the research's (core/shorternote.ts): the
   * person's decision whether the shorter one is taken or the research's kept. Optional: an older strom keeps it and
   * ignores it.
   */
  shorterNote?: ShorterNote;
  origin: string;
  notes: Note[];
}

/** A participant's note sent shorter than the research's (Task.shorterNote): the fact, who, the notes as compared (core/sync.ts noteLine). */
export interface ShorterNote {
  event: string;
  role: string;
  /** Who: a person of the tree, else the name as written. */
  person?: string;
  name?: string;
  /** The note the file gave (a character the cut broke at its end left out). */
  sent: string;
  /** The research's note it is the beginning of. */
  whole: string;
}

/** A new wording proposed for a transcript the person read or confirmed (Task.proposal). */
export interface TranscriptProposal {
  source: string;
  /** The wording proposed (NFC). */
  text: string;
  /** Who proposed it (a session ID, "agent"), when, and why when said. */
  by: string;
  at: string;
  why?: string;
  /** The reading of a document it came from (D…), when it did. */
  reading?: string;
  /** Proposed of the places that reading's readers are not sure of, by the person's word (optional: an older strom ignores it). */
  unsure?: true;
  /**
   * What the person's decision replaced, so that it can be undone (core/proposal.ts, take undo): the decision, the
   * transcript and the person's reading before it, the wordings declined before, and how the task waited. Optional:
   * an older strom keeps it and ignores it.
   */
  was?: ProposalWas;
}

/** The state before the person decided a proposal (TranscriptProposal.was). */
export interface ProposalWas {
  take: "proposal" | "keep";
  at: string;
  transcript?: string;
  user?: UserReading;
  declined?: string[];
  state: string;
  waitingOn?: string;
  wait?: Task["wait"];
  parkedReason?: string;
  heldBy?: string;
  heldFrom?: string;
}

export interface Conflict extends BaseRecord {
  type: "conflict";
  title: string;
  /** The fact it is about, by its GEDCOM tag (BIRT, DEAT, NAME, SEX, MARR…), when known. */
  fact?: string;
  subject: string[];
  /**
   * value: the claim as strom compares it; text: as a person reads it, in the research's language (the Strom app shows it).
   * sent (spec 094): a conflict of two sends of the Strom app — the research's value an earlier send of the user wrote
   * (its input, its device), the user's side the send that opened it (its device): both sides named by their devices.
   * Optional; none where an agent or a record gave the research's value.
   */
  claims: { source?: string; value: string; note?: string; text?: string; sent?: { input?: string; client?: AppClient } }[];
  /**
   * A conflict of the user's edit in the Strom app with a fact of the research: that fact, the user's value of it and
   * the sources they gave it — what `strom conflict resolve --take user` writes.
   */
  edit?: { event: string; date?: string; place?: string; value?: string; cites?: Citation[] };
  /**
   * A conflict of whose child a person is (FAMC) the user's parents opened: the child, the research's family of them and
   * the parents the user gave — what `strom conflict resolve --take user` writes (the child moved to those parents).
   */
  parents?: { child: string; from: string; partners: string[]; to?: string };
  /**
   * A conflict of which name the person is shown by (NAME, the mark Name.primary): each claim's value the name marked
   * ("Given /Surname/"), "" none — what `strom conflict resolve --take` marks.
   */
  primary?: true;
  /**
   * A proposal of an agent (spec 066): a change of a value that came from an import (`kind` import) or the user (`kind`
   * user) — the agent may not change it, so it proposes. Claims: the value now (the user's side), the value proposed
   * (the research's side, citing the source). `--take research` writes the proposal as the person's own act.
   */
  proposal?: {
    kind: "import" | "user";
    by: string;
    at: string;
    cites?: Citation[];
    /** A name proposed: the person, the name's index now and its parts proposed. */
    name?: { person: string; index: number; given?: string; surname?: string };
    /** A sex proposed: the person and the sex. */
    sex?: { person: string; sex: Sex };
    /** The fact proposed taken back (its reason). */
    retract?: { event: string; reason: string };
    /** The name proposed to be shown by: the person and the index of the name. */
    primary?: { person: string; index: number };
  };
  state: "open" | "resolved";
  resolution?: string;
  reasoning?: string;
  /**
   * Who decided it: the user (in the Strom app, or at a terminal — a link, the menu) or an agent (a session, or one
   * outside a session). A user's decision stands: an agent decides it again only on a source it did not weigh, with a
   * reason. None: decided by an older strom.
   */
  decidedBy?: "user" | "agent";
  /** The user decided it in the Strom app (its link with the side picked there). */
  decidedIn?: "app";
  /**
   * A conflict of the user's edit the person left to the agent (the Strom app's "Leave it to the agent", strom conflict
   * leave): only then may an agent decide it — otherwise it is the person's alone.
   */
  leftToAgent?: string;
  decidedAt?: string;
  /** A conflict of the user's edit decided for a side: whose value the fact keeps. */
  taken?: "user" | "research";
  /**
   * To be looked at again (spec 117 K1.7): sources it stands on the person deleted. Gone when it is decided (again),
   * kept as decided (strom conflict keep) or the sources restored. Optional: an older strom keeps it and ignores it.
   */
  review?: { why: "source.retracted"; sources: string[]; at: string };
  notes: Note[];
}

/**
 * What a variant of a hypothesis would connect, were it true (strom hypothesis link): whose child a person is — a
 * family of the tree, or one or two parents who have no family together —, two records of one person, a couple, or
 * siblings whose parents are unknown. Nothing of it is a link of the tree: the variant's claim, said so a program can
 * show it (the Strom app: _VAR / _LINK under _STROM_HYPO).
 */
export const VARIANT_LINK_KINDS = ["child", "same", "partners", "siblings"] as const;
export type VariantLink =
  | { kind: "child"; person: string; family?: string; parents?: string[] }
  | { kind: "same" | "partners" | "siblings"; persons: string[] };

export interface HypothesisVariant {
  label: string;
  claim: string;
  support: string[];
  against: string[];
  /** What it would connect (optional: an older strom keeps the field as it is). */
  links?: VariantLink[];
  /**
   * Every person and family its links have named, kept when they are taken off: the label stays that claim's (the
   * Strom app remembers "H0022, variant B"), so links naming other people are a new variant, never this one again.
   */
  linked?: string[];
}

export interface Hypothesis extends BaseRecord {
  type: "hypothesis";
  question: string;
  subject: string[];
  variants: HypothesisVariant[];
  state: "open" | "decided" | "abandoned";
  decision?: string;
  /** Decided for this variant (its label; strom hypothesis decide --variant). */
  chosen?: string;
  /**
   * Who decided it: the person (strom hypothesis decide is theirs; an older strom let an agent decide — no mark). An
   * agent's decision (hypotheses.decide agent) never sets it: an agent decided ⇔ decidedByAgent && decidedBy !== "user";
   * a hypothesis with neither (an older strom's) is the person's.
   */
  decidedBy?: "user";
  /** The agent that decided it (its session N…, its worker's name, or "agent"): only an agent's decision; the person's takes it off. */
  decidedByAgent?: string;
  /** When it was decided (ISO), by the person or an agent. */
  decidedAt?: string;
  /**
   * Decided by the person through the Strom app's link (the variant picked there, confirmed in the terminal: strom
   * hypothesis decide --from-app). Only the person's decision; the next one takes it off.
   */
  decidedIn?: "app";
  /**
   * The decision before the last change (decided again, or opened again): for the Strom app (_PREV) — the notes keep
   * every earlier one in words.
   */
  previous?: HypothesisPrevious;
  /** When the person left an open hypothesis with no proposal open (What waits; strom hypothesis decide --keep-open). */
  leftOpen?: string;
  /** What an agent proposes the person decide (strom hypothesis propose): taken off when the person decides. */
  proposal?: HypothesisProposal;
  /**
   * What the person's decision wrote on the tree itself (spec 074 K1.5): each link of its variant, the family it went
   * into and the sources it cited there. Taken off again when the person changes the decision or takes it back, while
   * no other work stands on it (core/hypolinks.ts workOnLink); an agent's decision never writes it.
   */
  wrote?: HypothesisWrote[];
  notes: Note[];
}

/** One link of a decided variant the person's decision wrote on the tree (Hypothesis.wrote). */
export interface HypothesisWrote {
  link: VariantLink;
  /** The family the link went into. */
  family: string;
  /** The family was made by the decision (else one of the tree's got the child). */
  made?: true;
  /** The sources the decision cited on the family (those it had already not counted). */
  cited?: string[];
  /** When it was written (ISO): anything changed after it on its people or family is other work. */
  at: string;
}

/** A decision of a hypothesis that a later one replaced (decided again, or opened again). */
export interface HypothesisPrevious {
  state: "decided" | "abandoned";
  /** Its variant (none: abandoned, or a hypothesis whose variants say nothing they connect). */
  chosen?: string;
  decision?: string;
  /** When it was decided (ISO). */
  at?: string;
  /** Who: the person, or an agent the person let decide. */
  by: "user" | "agent";
  /** The person's, through the Strom app's link. */
  in?: "app";
}

/** An agent's proposal of a decision of a hypothesis: the person decides it (What waits, strom hypothesis decide). */
export interface HypothesisProposal {
  /** The variant it would be decided for (none: abandoned, or a hypothesis whose variants say nothing they connect). */
  variant?: string;
  /** Which variant and why, as the decision would say it. */
  decision: string;
  /** None of the variants can be decided. */
  abandon?: true;
  /** A decided hypothesis that a new record overturns: why it is decided again. */
  reason?: string;
  /** The session (or "agent") that proposed it. */
  by: string;
  at: string;
}

export const LESSON_SCOPES = ["method", "repository", "recordset", "place", "project"] as const;
export const LESSON_MAX = 200;
export const LESSON_DETAIL_MAX = 2000;

/** Something learned, attached to what it is about, so it shows up only there. */
export interface Lesson extends BaseRecord {
  type: "lesson";
  scope: (typeof LESSON_SCOPES)[number];
  target?: string;
  rule: string;
  detail?: string;
  notes: Note[];
}

export const INPUT_KINDS = ["document", "photo", "tree", "text", "other"] as const;

/** Material the research starts from: kept unchanged, the base. */
/**
 * A list of people of the Strom app the material was sent to (spec 137): its name, kind and rule as the app said them,
 * how many of its people the research has (count) and has not (missing), when it was sent, and its file (notes/lists/
 * <hash>.json: the IDs of its people then). Up to 50 of them are the input's people too.
 */
export interface InputList {
  id: string;
  name: string;
  kind?: "fixed" | "auto" | "work";
  rule?: string;
  count: number;
  missing?: number;
  at: string;
  file: string;
}

/**
 * A device of the Strom app a send came from (spec 094): a browser's or profile's own random ID and, when it says one, a
 * name to read it by ("Chrome · Mac") — nothing of a person. Optional wherever it stands: an older app sends none.
 */
export interface AppClient {
  id: string;
  name?: string;
}

export interface Input extends BaseRecord {
  type: "input";
  name: string;
  /** Tree-relative path (inputs/...) or shared media path (media:<sha>). */
  file?: string;
  text?: string;
  sha?: string;
  size?: number;
  mime?: string;
  from?: string;
  kind: (typeof INPUT_KINDS)[number];
  state: "new" | "processed" | "skipped";
  source?: string;
  imported?: { persons: number; families: number; sources: number };
  /** The people it is of, as the user said (the Strom app: "send material" of a person). */
  persons?: string[];
  /** A batch of the Strom app it came in (.strom/batches/<id>.json), and its path there ("Babička/Dopisy/1946.jpg"). */
  batch?: string;
  path?: string;
  /**
   * The people the person took off the file (the Strom app's Assign, strom input assign --remove): never put back on it
   * by sorting, strom input sort or strom intake --person (the sorting's prompt lists them as taken off); added back by
   * the person, the mark goes.
   */
  declined?: { person: string; at: string; by: string }[];
  /** What it is, as whoever sorted the batch found (strom input sort): a record, a document, a photo, nothing of the family. */
  sorted?: { as: (typeof SORT_KINDS)[number]; persons?: string[]; source?: string; reason?: string; at: string; by: string };
  /** The readings of it (strom document read): D… — their results in notes/readings/<D…>.json. */
  read?: string[];
  /** What it is called, as a person or whoever sorted it named it ("Svatba Novákových, Lhota 1932"); else its name. */
  title?: string;
  /** When the document was written or the photo taken, a GEDCOM date ("1932", "ABT 1930") — not when it came. */
  date?: string;
  /**
   * Hidden from the family's material (the Strom app's Hide, strom input hide|skip, sorted as unrelated): when, by whom,
   * the reason's code, and the state it had, which strom input unskip gives it back. Gone when shown again.
   */
  hidden?: { at: string; by: string; reason?: (typeof HIDE_REASONS)[number]; was: "new" | "processed" };
  /**
   * A file of the Strom app's tree (a portrait, a couple's photo, an attachment of a person, a couple, an event or a
   * source), kept when a send brought it: the place it first came for. None: material of the research.
   */
  origin?: (typeof MEDIA_ORIGINS)[number];
  /** The working copy the app shows when it is not the file itself (the original came by PUT /media): kept as it came. */
  working?: { sha: string; mime: string; bytes: number; width?: number; height?: number };
  /** The original's EXIF orientation, as the app sent it (_STROM_ORIENT). */
  orient?: number;
  /** Who gave the title: the user (the app, strom input title) or the research (an agent sorting); when. */
  titled?: { by: "user" | "research"; at: string };
  /** What it is, as the user said in the app (3 TYPE under FORM). */
  materialKind?: (typeof MATERIAL_KINDS)[number];
  /** The couples (F…) it is of, as the app said with an original (X-Strom-Family). */
  families?: string[];
  /** The list of people the app sent it to (X-Strom-List-Ref, spec 137): named, its people as sent in its file. */
  list?: InputList;
  /** Its places in the tree of the Strom app: a record is in the tree while one of them is not retracted. */
  links?: MediaLink[];
  /** The houses it is material of (A…, spec 030): a research of a house taken in, a photo of it (strom house import). */
  houses?: string[];
  /** Who told a memory of a house (spec 030 §2.7), kept only when they agreed to be named. */
  witness?: string;
  /** A research of a house the person made themselves, taken in by strom house import (its text kept as it came). */
  ownResearch?: true;
  notes: Note[];
}

// ── a house (spec 030): what the research found of one house of the tree ────────────────────────────────────────

/** How sure a claim of a house is: high, medium, a guess (spec 030 K6.5); a number before a renumbering is probable. */
export const HOUSE_CERTAINTIES = ["high", "medium", "guess"] as const;
export type HouseCertainty = (typeof HOUSE_CERTAINTIES)[number];
export const HOUSE_NUMBER_CERTAINTIES = ["high", "medium", "guess", "probable"] as const;
/** Who wrote an item of a house: the research, a research of the person's own taken in (import), the person. */
export const HOUSE_ORIGINS = ["research", "import", "user"] as const;
export type HouseOrigin = (typeof HOUSE_ORIGINS)[number];
/** What happened to a house (the timeline's kinds). */
export const HOUSE_EVENT_KINDS = ["built", "rebuilt", "fire", "flood", "transfer", "renumber", "demolished", "auction", "other"] as const;
/** How a holder came to the house. */
export const HOUSE_HOLDER_HOWS = ["purchase", "inheritance", "marriage", "auction", "allotment", "other"] as const;
/** What a resident was in the house. */
export const HOUSE_RESIDENT_ROLES = ["farmer", "retired", "lodger", "servant", "tenant", "other"] as const;
/** How the house was put on the map: by its number today, a cadastral map, an old map, a description. */
export const HOUSE_LOCATION_HOWS = ["today-number", "cadastre", "old-map", "description", "other"] as const;
/** The kinds of maps of a house: the cadastre, a military survey, an orthophoto (today's, the 1950s'), other. */
export const HOUSE_MAP_KINDS = ["cadastre", "military", "ortho", "ortho-1950", "other"] as const;

/** Where a claim of a house comes from: a source of the research (with its page), or an address. */
export interface HouseSource {
  source?: string;
  page?: string;
  url?: string;
}

/** What every item of a house has: its own short ID within the house ("e3"), who wrote it. */
export interface HouseItem {
  id: string;
  origin: HouseOrigin;
  at?: string;
}

/** A number the house had, and when (spec 030 K1.1a): before a renumbering the person confirmed, at most probable. */
export interface HouseNumber extends HouseItem {
  number: string;
  from?: string;
  to?: string;
  certainty: (typeof HOUSE_NUMBER_CERTAINTIES)[number];
  sources?: HouseSource[];
  /** A renumbering the research proposes (the same family under two numbers): the person confirms it. */
  proposed?: true;
  text?: string;
  /** The day the person confirmed the renumbering. */
  confirmed?: string;
  /** The day the person said it is not the same house: never sent. */
  notSame?: string;
}

export interface HouseLocation {
  lat: number;
  lon: number;
  how: (typeof HOUSE_LOCATION_HOWS)[number];
  certainty: HouseCertainty;
  sources?: HouseSource[];
  origin: HouseOrigin;
  /** The day the person confirmed the point (or put it there). */
  confirmed?: string;
}

export interface HouseEvent extends HouseItem {
  date?: string;
  kind: (typeof HOUSE_EVENT_KINDS)[number];
  text: string;
  certainty: HouseCertainty;
  sources?: HouseSource[];
  /** The material it was read from (I…). */
  material?: string;
}

export interface HouseHolder extends HouseItem {
  name: string;
  /** The person of the tree, where it is one (P…): people off the tree are only named (K2.5). */
  person?: string;
  from?: string;
  to?: string;
  how: (typeof HOUSE_HOLDER_HOWS)[number];
  certainty: HouseCertainty;
  sources?: HouseSource[];
}

export interface HouseResident extends HouseItem {
  name: string;
  person?: string;
  role: (typeof HOUSE_RESIDENT_ROLES)[number];
  from?: string;
  to?: string;
  certainty?: HouseCertainty;
  sources?: HouseSource[];
}

export interface HouseLook {
  text: string;
  certainty: HouseCertainty;
  images?: { url?: string; license?: string; credit?: string; file?: string }[];
  origin: HouseOrigin;
}

export interface HouseMap extends HouseItem {
  kind: (typeof HOUSE_MAP_KINDS)[number];
  url?: string;
  /** Only a link to open by hand (a site that refuses automated reading). */
  manual?: true;
  sheet?: string;
  label?: string;
  /** A map layer strom ships (assets/maplayers.json, its id) the Strom app draws over the house's place. */
  layer?: string;
}

/** What was gone through for the house, found or not (K2.6): a later task never goes through it again. */
export interface HousePassed extends HouseItem {
  what: string;
  source?: string;
  url?: string;
  found?: boolean;
}

/** A link to go through by hand (the research of the person's own said so): never taken for gone through. */
export interface HouseManual extends HouseItem {
  what: string;
  url?: string;
  why?: string;
}

/** What is not known of the house: an open question, a disputed reading (a question to the person: T…). */
export interface HouseUnknown extends HouseItem {
  text: string;
  question?: string;
}

/** What is only in an archive's reading room: the archive, the fonds, the call number. */
export interface HouseArchiveOnly extends HouseItem {
  archive: string;
  fond?: string;
  signature?: string;
  what?: string;
  url?: string;
}

/** Who named the house: the person, a research taken in, the research. */
export const HOUSE_NAME_BYS = ["user", "import", "research"] as const;

/**
 * A house of the tree, as the research found it (spec 030, strom house): its municipality (a place record) and its
 * number as written; its key over the bridge is computed (core/houses.ts), never kept — a place renamed changes it.
 */
export interface House extends BaseRecord {
  type: "house";
  /** The municipality (L…). */
  place: string;
  /** The number as written (NFC): "16", "Dlouhá 12", "13/2"; "" in a municipality's record (town). */
  house: string;
  /** Its name after the family (the person's, a research taken in, the research's). */
  name?: string;
  nameBy?: (typeof HOUSE_NAME_BYS)[number];
  numbers: HouseNumber[];
  location?: HouseLocation;
  timeline: HouseEvent[];
  holders: HouseHolder[];
  residents: HouseResident[];
  look?: HouseLook;
  maps: HouseMap[];
  passed: HousePassed[];
  manual: HouseManual[];
  unknown: HouseUnknown[];
  archiveOnly: HouseArchiveOnly[];
  /** Items of the timeline that are sensitive (a confiscation, an expulsion of the 20th century): shared outputs hide them. */
  sensitive?: string[];
  /** Made by the person (strom house add, an import with --house): listed although nobody of the tree lived there. */
  byUser?: true;
  /**
   * Other records (A…) of the same house, as the person joined them in the Strom app (its `_HOUSE` with `1 _SAME`, read
   * by strom sync): the person's word, never the research's guess.
   */
  same?: string[];
  /**
   * A record of a municipality, not of a house (spec 030 part 2): the skeleton its houses are researched in — what was
   * gone through, what is only by hand or in a reading room, its maps — with no number. Never listed as a house.
   */
  town?: true;
  /** A municipality's short summary: its lordship, estate, parish, cadastral area, where its land registers are. */
  text?: string;
  /** The day the municipality's skeleton was done (its task closed done): no task of it is raised again. */
  done?: string;
  notes: Note[];
}

/** Which place of the app's tree a file of it first came for. */
export const MEDIA_ORIGINS = ["portrait", "couple", "attachment"] as const;

/** The places a file has in the app's tree: a person's attachment or portrait, a couple's or its photo, an event's, a source's. */
export const LINK_TYPES = ["person", "personPortrait", "family", "familyPhoto", "event", "source"] as const;

/** What a file of the material is, as the app and the material's list name it. */
export const MATERIAL_KINDS = ["photo", "document", "record", "other"] as const;

/** Why a place of a file stopped being one: the app left it out, a new version took the place, the user removed it. */
export const LINK_RETRACTIONS = ["app", "replaced", "removed"] as const;

/** A place of a file in the app's tree. */
export interface MediaLink {
  type: (typeof LINK_TYPES)[number];
  /** The person, family or source; of an event, its owner (P… or F…). */
  ref: string;
  /** The event (E…), for type event. */
  event?: string;
  /** Its order among the files of the place. */
  order: number;
  at: string;
  /** The send (I…) that gave it. */
  input?: string;
  retracted?: { at: string; reason: (typeof LINK_RETRACTIONS)[number]; input?: string };
}

/** Why a file of the material is hidden: nothing of the family, the same as another. */
export const HIDE_REASONS = ["unrelated", "duplicate"] as const;

/** What a file of a batch is found to be: a record (it becomes a source), a document of the family, a photo, nothing of the family. */
export const SORT_KINDS = ["source", "document", "photo", "unrelated"] as const;

/** One registered image (a scan of a page, a photo of a document): the file lives in shared/media. */
export interface Media extends BaseRecord {
  type: "media";
  /** SHA-256 of the file — its address in the shared media store. */
  sha: string;
  /** Path relative to the shared folder: media/ab/cd/<sha>.jpg */
  file: string;
  mime: string;
  size: number;
  width?: number;
  height?: number;
  recordset?: string;
  /** Number of the image within its record set, as the portal counts it. */
  image?: number;
  /** A part of that image, fetched sharper than the whole: where it is in the whole image, in fractions of it. */
  part?: Region;
  /** Page or folio on it, when read off the image (otherwise it comes from the calibration). */
  page?: string;
  url?: string;
  /** Where it came from: the original file name, a portal. */
  from?: string;
  /**
   * The entries on it as its file's name gave them, a portal naming its scans by them ("001-004.jpg": entries 1–4 —
   * never image 4; spec 141): what the agent checks against what it reads.
   */
  entries?: { from: number; to: number };
  /** Fetched through a connector: which one, its ID of the book, and whether the user's browser fetched it. */
  fetched?: { connector: string; book: string; via?: "browser" };
  accessed?: string;
  /** The list of people the app sent the scan of a source to (X-Strom-Source with X-Strom-List-Ref, spec 137). */
  list?: InputList;
  notes: Note[];
}

/** A part of an image, in fractions of it (0–1) from its top left corner. */
export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SessionMetrics {
  /** The model the agent reported it ran on (Claude Code's first event). */
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  costUsd?: number;
  /** Stopped before it said what it cost: more was spent than costUsd (if any) says. */
  costPartial?: boolean;
  /** What the readers it started cost (strom read, clips, transcripts) — apart from costUsd, the agent's own. */
  readersUsd?: number;
  /** How many readers it started. */
  readers?: number;
  /** A reader stopped before it said what it cost: more was spent than readersUsd says. */
  readersPartial?: boolean;
  turns?: number;
  durationMs?: number;
  /** Tool calls the agent's permissions refused. */
  denied?: number;
  /**
   * Of them, calls of strom itself (its permissions or its sandbox kept strom away — GitHub #8): a session with nothing
   * written and strom refused is no failure of the research, its task never parked for it.
   */
  stromDenied?: number;
  /** The plan's limit of the agent cut it off (strom run): no failure of the research, its task never parked for it. */
  limit?: true;
  /** Tool calls strom's own hook refused (an agent's web fetch past strom's limits for one server: core/web.ts). */
  refused?: number;
}

/** One working session of an agent on one task. */
export interface Session extends BaseRecord {
  type: "session";
  task?: string;
  research?: string;
  state: "open" | "closed" | "interrupted";
  runner?: string;
  /** Which of the agents working side by side holds it (STROM_WORKER, set by strom chat). */
  worker?: string;
  /** The agent CLI: claude, codex, antigravity, opencode, grok. */
  agent?: string;
  /** The model it ran on, when strom knows it (it started the agent with it, or the agent said so). */
  model?: string;
  /** The reasoning effort it ran with, when strom knows it (it started the agent with it, or the agent's own config says it). */
  effort?: string;
  /** The device of the home network whose terminal started it (spec 094 K3.15: who started it). */
  device?: AppClient;
  /** The version of strom it ran with: its method and its checks. */
  strom?: string;
  /** Closed by strom, not by its agent: stopped by the user, its run or conversation gone, the agent quit. */
  endedBy?: "user" | "run" | "chat" | "agent";
  started: string;
  ended?: string;
  summary?: string;
  next?: string;
  metrics?: SessionMetrics;
  notes: Note[];
}

export type AnyRecord =
  | Person | Family | Research | Source | Repository | RecordSet | Place
  | Search | Task | Conflict | Hypothesis | Lesson | Input | Session | Media | House;

/** Tree-level configuration stored in <tree>/strom.json. */
export interface TreeConfig {
  schema: number;
  /**
   * An archive (the user's choice, strom mode): the user enters the data in the Strom app, the research keeps them,
   * their history and the sources — no agent works on it, its tasks wait put aside. None: a research with an agent.
   */
  mode?: "archive";
  /**
   * The sample research (strom demo): a made-up family put in place apart from the person's own trees, to look
   * through — an agent may work on it, but nothing offers or recommends one (spec 143).
   */
  demo?: true;
  /** Random id; names the seal key of this tree. */
  id: string;
  name: string;
  /** Research language (BCP 47 primary tag). */
  lang: string;
  created: string;
  createdWith: string;
  /** The strom that last brought the data to a newer schema (core/migrate.ts): an older strom names it when it refuses the tree. */
  migratedWith?: string;
  /** Agent for this tree (overrides the user's default). */
  agent?: string;
  /** Model per tier, per agent, for this tree — and its reasoning effort (model.effort). */
  models?: Record<string, Partial<Record<"lead" | "vision" | "text" | "cheap" | "effort", string>>>;
  /** Size of the brief in tokens. */
  briefBudget?: number;
  /** Which GEDCOM files to write: both (default), standard, strom. */
  gedcomFor?: string;
  /** The Strom app version the Strom GEDCOM is for. */
  stromVersion?: string;
  /** Time limit of one `strom run` session in minutes. */
  runMinutes?: number;
  /** Web requests to one server in one session through an agent's own web fetch before strom refuses or asks (web.perHost). */
  webPerHost?: number;
  /** Readers of strom read at the same time (read.parallel). */
  readParallel?: number;
  /** Order of the task queue: balanced (default), depth, priority. */
  queueStrategy?: string;
  /** Work off the lines (core/offline.ts): occasional (default), last, normal, never. */
  queueOffLine?: string;
  /** One task off the lines in so many (queue.offLineShare, occasional). */
  queueOffLineShare?: number;
  /** A line proposed for a branch off the lines that grows: yes (default) or no. */
  queueSuggestLines?: string;
  /** The tasks and the people of a branch from which a line is proposed for it. */
  queueSuggestTasks?: number;
  queueSuggestPersons?: number;
  /** The tasks a book needs to be offered to download by hand (books.minTasks; spec 105). */
  booksMinTasks?: number;
  /** Years either side of a date estimated from an age a search has to cover (search.ageMargin; spec 131). */
  searchAgeMargin?: number;
  /** After a session in a book on disk, the next task of that book first: no (default) or yes (queue.sameBook). */
  queueSameBook?: string;
  /** Stories of the ancestors: yes or no (overrides the user's). */
  stories?: string;
  /** The history of the regions of the tree's places for this tree alone, both ways ("on" | "off"; unset: the user's config). */
  experimentsHistory?: string;
  /** How often the experiment of history takes a session here, only less often than the user's (core/config.ts historyPace). */
  experimentsHistoryPace?: string;
  /** The history of each place with coordinates looked for by itself, turned off for this tree alone ("off"; on is the user's config). */
  experimentsHistoryPlaces?: string;
  /** The history of the places and their surroundings for this tree alone, both ways ("on" | "off"; unset: as experimentsHistory here, else the user's). */
  experimentsPlaceHistory?: string;
  /** The kinds of the history's events looked for in this tree alone, both ways (core/eventkinds.ts; unset: the user's config, else all). */
  historyKinds?: string;
  /** Census records as a source for this tree alone, both ways ("on" | "off"; unset: the user's config, else off — spec 106). */
  census?: string;
  /** The history of the tree's houses looked for by itself (spec 030 part 2): on, off (default). */
  houses?: string;
  /** The main person of the tree: first in the GEDCOM files, where the Strom app opens. */
  mainPerson?: string;
  /** The entries cut out of their scans for the Strom app: quality, whose, limit in MB. */
  excerptsQuality?: string;
  excerptsFor?: string;
  excerptsMb?: number;
  /** What a newer strom did once in this research (core/hypolinks.ts: "hypothesis-links"); an older one keeps it. */
  settled?: string[];
  /** The person's decision about each check of strom's fixes (commands/fixchecks.ts), by its id; an older strom keeps it. */
  fixes?: Record<string, { decision: "declined" | "fixed"; at: string; version: string; undone?: true }>;
}

/** How sharp the entries cut out for the Strom app are, and whose they are (core/excerpt.ts). */
export const EXCERPT_QUALITIES = ["small", "normal", "sharp"] as const;
export type ExcerptQuality = (typeof EXCERPT_QUALITIES)[number];
export const EXCERPT_SCOPES = ["none", "line", "family", "connected", "all"] as const;
export type ExcerptScope = (typeof EXCERPT_SCOPES)[number];
/** Default limit of all of them in one file, MB. */
export const EXCERPTS_MAX_MB = 200;

export const SCHEMA_VERSION = 4;

export const NOTE_MAX = 500;

/**
 * A note's whole text: the user's own long note whole (`whole`) while its text is still that whole's beginning ("…" at
 * its end, the rest the whole begins with), else its text — an older strom corrects a note's text (strom note edit) and
 * keeps a `whole` it does not know of: the correction is the note now (N2).
 */
export function noteWhole(n: { text: string; whole?: string | undefined }): string {
  if (n.whole === undefined) return n.text;
  const text = n.text.normalize("NFC").trimEnd();
  if (!text.endsWith("…")) return n.text;
  return n.whole.normalize("NFC").startsWith(text.slice(0, -1).trimEnd()) ? n.whole : n.text;
}

/**
 * A note of the user's own family tree, however long (a note of one's own is no limit of theirs): NFC, no spaces at the
 * end of a line, trimmed; longer than a note holds (NOTE_MAX, UTF-16 as the limit counts), its beginning as `text`
 * (ended by "…", never between the two halves of one character) and the whole as `whole`.
 */
export function treeNoteText(text: string): { text: string; whole?: string } {
  const whole = text.normalize("NFC").replace(/\s+\n/g, "\n").trim();
  if (whole.length <= NOTE_MAX) return { text: whole };
  let head = "";
  for (const ch of whole) {
    if (head.length + ch.length > NOTE_MAX - 1) break;
    head += ch;
  }
  return { text: `${head.trimEnd()}…`, whole };
}

/** Event tags accepted by `event add`, with friendly aliases. */
export const EVENT_KINDS: Record<string, string> = {
  BIRT: "birth",
  CHR: "christening",
  BAPM: "baptism",
  DEAT: "death",
  BURI: "burial",
  CREM: "cremation",
  MARR: "marriage",
  MARB: "marriage banns",
  MARC: "marriage contract",
  MARL: "marriage license",
  MARS: "marriage settlement",
  ANUL: "annulment",
  DIVF: "divorce filed",
  ADOP: "adoption",
  GRAD: "graduation",
  RETI: "retirement",
  CHRA: "adult christening",
  DIV: "divorce",
  ENGA: "engagement",
  OCCU: "occupation",
  RESI: "residence",
  EDUC: "education",
  RELI: "religion",
  EMIG: "emigration",
  IMMI: "immigration",
  NATU: "naturalization",
  CENS: "census",
  PROB: "probate",
  WILL: "will",
  CONF: "confirmation",
  FCOM: "first communion",
  ORDN: "ordination",
  NATI: "nationality",
  TITL: "title",
  MILI: "military service",
  EVEN: "other event",
};

export const FAMILY_EVENT_KINDS = new Set(["MARR", "MARB", "MARC", "MARL", "MARS", "DIV", "DIVF", "ANUL", "ENGA", "EVEN", "RESI", "CENS"]);

const ALIASES: Record<string, string> = Object.fromEntries(
  Object.entries(EVENT_KINDS).map(([tag, label]) => [label.replace(/ /g, "-"), tag]),
);

export function eventKind(input: string): string | undefined {
  const up = input.toUpperCase();
  if (up in EVENT_KINDS) return up;
  return ALIASES[input.toLowerCase().replace(/ /g, "-")];
}
