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

export type Sex = "M" | "F" | "U";

export interface Note {
  text: string;
  at: string;
  /** Session ID, or "user" for notes entered outside a session. */
  by: string;
}

export interface Citation {
  source: string;
  locator?: string;
  quote?: string;
  /** Information of the source FOR THIS FACT: the same entry is primary for a baptism date, secondary for an age. */
  information?: "primary" | "secondary" | "unknown";
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
  note?: string;
  retracted?: { at: string; reason: string };
}

export const NAME_KINDS = ["birth", "married", "religious", "alias"] as const;

export interface Name {
  given: string;
  surname: string;
  kind?: (typeof NAME_KINDS)[number];
  /** The records that give the person this name (in this form). */
  citations?: Citation[];
}

export interface BaseRecord {
  id: string;
  type: RecordType;
  created: string;
  updated: string;
  retracted?: { at: string; reason: string };
  /** A duplicate merged into this record (it stays, retracted, for the history). */
  mergedInto?: string;
}

/** Identity of a record in another system (Strom app, a GEDCOM file). */
export interface ExternalRef {
  system: string;
  id: string;
}

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
  /** The author's caveat. */
  note?: string;
  at: string;
  by: string;
}

export interface Person extends BaseRecord {
  type: "person";
  names: Name[];
  sex: Sex;
  events: Event[];
  story?: Story;
  notes: Note[];
  refs?: ExternalRef[];
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
}

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
  priority: number;
  limits?: { generations?: number; before?: number };
  /** A person research that reviews what is recorded (strom review): whom, and a second reading by this model. */
  review?: { scope: (typeof REVIEW_SCOPES)[number]; reread?: string };
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
  /** Where exactly: folio, page, entry number, image. */
  locator?: string;
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
  notes: Note[];
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

export interface Place extends BaseRecord {
  type: "place";
  names: { name: string; lang?: string; from?: number; to?: number }[];
  kind?: string;
  coords?: { lat: number; lon: number };
  /** Why it has no coordinates: not identified yet (which of the villages of this name). Given coordinates clear it. */
  unlocated?: string;
  parent?: string;
  jurisdictions: Jurisdiction[];
  notes: Note[];
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

export const TASK_LEVELS = ["intake", "locate", "link", "verify", "enrich", "request", "narrate"] as const;
export const TASK_STATES = ["open", "doing", "done", "parked", "waiting", "dropped"] as const;

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
  waitingOn?: string;
  /** The images it waits for, which the user saves by hand: of this record set, into this folder of the shared inbox. */
  awaits?: { recordset: string; images: string; folder: string };
  result?: string;
  produced?: string[];
  origin: string;
  notes: Note[];
}

export interface Conflict extends BaseRecord {
  type: "conflict";
  title: string;
  subject: string[];
  claims: { source?: string; value: string; note?: string }[];
  state: "open" | "resolved";
  resolution?: string;
  reasoning?: string;
  notes: Note[];
}

export interface Hypothesis extends BaseRecord {
  type: "hypothesis";
  question: string;
  subject: string[];
  variants: { label: string; claim: string; support: string[]; against: string[] }[];
  state: "open" | "decided" | "abandoned";
  decision?: string;
  notes: Note[];
}

export const LESSON_SCOPES = ["method", "repository", "recordset", "place", "project"] as const;
export const LESSON_MAX = 200;

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
  notes: Note[];
}

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
  /** Fetched through a connector: which one, its ID of the book, and whether the user's browser fetched it. */
  fetched?: { connector: string; book: string; via?: "browser" };
  accessed?: string;
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
  turns?: number;
  durationMs?: number;
  /** Tool calls the agent's permissions refused. */
  denied?: number;
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
  /** The agent CLI: claude, codex, antigravity, opencode. */
  agent?: string;
  /** The model it ran on, when strom knows it (it started the agent with it, or the agent said so). */
  model?: string;
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
  | Search | Task | Conflict | Hypothesis | Lesson | Input | Session | Media;

/** Tree-level configuration stored in <tree>/strom.json. */
export interface TreeConfig {
  schema: number;
  /** Random id; names the seal key of this tree. */
  id: string;
  name: string;
  /** Research language (BCP 47 primary tag). */
  lang: string;
  created: string;
  createdWith: string;
  /** Agent for this tree (overrides the user's default). */
  agent?: string;
  /** Model per tier, per agent, for this tree. */
  models?: Record<string, Partial<Record<"lead" | "vision" | "text" | "cheap", string>>>;
  /** Size of the brief in tokens. */
  briefBudget?: number;
  /** Which GEDCOM files to write: both (default), standard, strom. */
  gedcomFor?: string;
  /** The Strom app version the Strom GEDCOM is for. */
  stromVersion?: string;
  /** Time limit of one `strom run` session in minutes. */
  runMinutes?: number;
  /** Order of the task queue: balanced (default), depth, priority. */
  queueStrategy?: string;
  /** Stories of the ancestors: yes or no (overrides the user's). */
  stories?: string;
  /** The main person of the tree: first in the GEDCOM files, where the Strom app opens. */
  mainPerson?: string;
  /** The entries cut out of their scans for the Strom app: quality, whose, limit in MB. */
  excerptsQuality?: string;
  excerptsFor?: string;
  excerptsMb?: number;
}

/** How sharp the entries cut out for the Strom app are, and whose they are (core/excerpt.ts). */
export const EXCERPT_QUALITIES = ["small", "normal", "sharp"] as const;
export type ExcerptQuality = (typeof EXCERPT_QUALITIES)[number];
export const EXCERPT_SCOPES = ["none", "line", "family", "connected", "all"] as const;
export type ExcerptScope = (typeof EXCERPT_SCOPES)[number];
/** Default limit of all of them in one file, MB. */
export const EXCERPTS_MAX_MB = 200;

export const SCHEMA_VERSION = 1;

export const NOTE_MAX = 500;

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
