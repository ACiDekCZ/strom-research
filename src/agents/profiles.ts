// Agent profiles: how each agent CLI delegates work and which model does what.
//
// Tiers (lessons of earlier research, generalised):
//   lead    the main researcher — judgement, evidence, decisions
//   vision  reading handwriting and scans — never weaker than lead
//   text    print, catalogues, indexes, typed documents
//   cheap   mechanical work: downloads, renaming, counting
//
// Claude Code has native subagents with a model per call, so it delegates
// inside its session. Agents without model-selectable subagents read scans
// themselves in small batches (a reader started by strom is planned).

export type Tier = "lead" | "vision" | "text" | "cheap";
export const TIERS: Tier[] = ["lead", "vision", "text", "cheap"];

export interface AgentProfile {
  id: string;
  name: string;
  command: string;
  /** "native": the agent's own subagents; "strom": no model-selectable subagents (reads itself for now). */
  delegation: "native" | "strom";
  /** What the user types to end a conversation with it. */
  exit: string;
  /** Where to get it, for the user. */
  url: string;
  /** Default model per tier (undefined = the agent's own default). */
  models: Partial<Record<Tier, string>>;
  /** Extra instructions for this agent, rendered into its instruction file (with the numbers of its reading of scans). */
  instructions(models: Partial<Record<Tier, string>>, reading?: ReadingNumbers): string;
}

/**
 * The numbers of reading scans the texts below give: by default about six scans a batch, a stop at about 30 views and
 * at most 24 views a call — what strom tuned for the agent and model where it did (core/tune.ts: only smaller batches
 * and an earlier stop, from the reading it measured).
 */
export interface ReadingNumbers {
  batch: number;
  viewsStop: number;
  viewsPerCall: number;
}

export const DEFAULT_READING_NUMBERS: ReadingNumbers = { batch: 6, viewsStop: 30, viewsPerCall: 24 };

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
/** "six" — a small number in words, as the texts always said it; a bigger one in digits. */
export function inWords(n: number): string {
  return WORDS[n] ?? String(n);
}

/** The scans a call gives at four views each (halves and crops). */
const perCall = (n: ReadingNumbers) => Math.max(1, Math.floor(n.viewsPerCall / 4));

function delegationRules(n: ReadingNumbers): string {
  const first = inWords(n.batch);
  return `- Browsing a book, an index or a range of images ("is our surname on this page?")
  is delegated; so is anything self-contained that returns little.
- About ${first} scans (images B…:n) per delegate, four views each (halves and
  crops); tell it to write down what each call gave before the next, to stop
  at about ${n.viewsStop} views and return what it has, and never to open again a view
  cleared from its context (its notes hold it). It asks for the
  views of a scan (or of a few) in one call —
  \`strom media view B0001:57-${56 + Math.min(4, perCall(n))} --half both\` — and opens them together.
- Fetch the images before you delegate: a delegate never fetches, nor waits
  for an archive — it reports the images missing or too small, and you fetch them.
- Every delegate gets the full question (what counts as a find, which years,
  which names) and exactly what to write down — page numbers and headings
  only, the entries of one surname, one entry whole: it transcribes nothing
  else. It returns for each image: image and page, find, nothing or unclear
  (where on the image), what was illegible, the hand, certainty per name.
- A delegate's "unclear" on an image of the range: look at that place closer
  (\`--crop\`) before you record the range as searched in vain — else record
  it inconclusive, with the place in its note.
- Delegates never write to the research. You record their findings through
  strom; a negative result of a delegate is recorded as a search "by reader".
- Only entries that will get a citation need your own eyes.`;
}

/** For agents that cannot pick a model for a subagent (Codex, Antigravity, OpenCode, Grok): read yourself, in small batches. */
export function selfReading(n: ReadingNumbers = DEFAULT_READING_NUMBERS): string {
  return `## Reading scans (Codex, Antigravity, OpenCode, Grok)

Read the images yourself, with your strongest model — never hand old
handwriting to a faster or cheaper model, subagent or pass. Read them
in batches of about ${inWords(n.batch)}: open a batch (one call gives its views —
\`strom media view B0001:57-${56 + Math.min(n.batch, perCall(n))} --half both\` — open them together), write
down what it gave (strom search add … for what was not found, facts for what
was), then open the next. After about ${n.viewsStop} views, write down what you found
and go on; a view cleared from your context is not opened again — your
notes hold it. A name or place the next search depends on:
read it again on a crop at full resolution (\`strom media view … --crop\`)
before you record it.
A batch handed to a sub-agent of your own (Codex: spawn_agent) gets the whole
question and the same numbers: about ${inWords(n.batch)} scans, at most ${n.viewsPerCall} views a
call, a stop at about ${n.viewsStop} views — and exactly what to write down;
its report is recorded at once (its "unclear": look there closer first).
OpenCode: this tree's subagent strom-scan-reader (strom and the file reader
only) reads on your model, or on the one the user set for handwriting: hand
it a batch with the whole question and exactly what to write down (page
numbers only, one surname's entries, one entry whole), and record what it
returns at once (a negative result as a search by reader; its "unclear":
look there closer first, else the search is inconclusive).
`;
}

export const SELF_READING = selfReading();

/**
 * The agents strom can start working alone without the user's personal add-ons (agent.addons): Claude Code
 * (--strict-mcp-config, --tools, no auto-memory) and Codex (its plugins, apps, hooks and memories off). The others have
 * no such switch — nothing is made up for them, and the setting is not offered. Grok has switches for a part only
 * (runners/grok.ts GROK_CLEAN: what it takes in of the other agents, its memory — never its own skills and plugins): it
 * gets them while the setting is off, and the setting is not offered for it, which would promise more.
 */
export const ADDON_SWITCHES: readonly string[] = ["claude", "codex"];

export const PROFILES: Record<string, AgentProfile> = {
  claude: {
    id: "claude",
    name: "Claude Code",
    command: "claude",
    exit: "/exit",
    url: "https://claude.com/claude-code",
    delegation: "native",
    models: { lead: undefined, vision: "opus", text: "sonnet", cheap: "haiku" },
    instructions: (m, n = DEFAULT_READING_NUMBERS) => `## Delegating work (Claude Code)

Use the Agent tool for subagents; each has a clean context and only its answer
comes back to you. Choose the model by the kind of work:

| work | model |
|---|---|
| handwriting: registers, indexes, land books, any scan read closely | \`${m.vision ?? "opus"}\` — never cheaper |
| print and type: documents of the 20th century, catalogues, web pages, big text files | \`${m.text ?? "sonnet"}\` |
| mechanical: downloads, renaming, counting, a plain grep | \`${m.cheap ?? "haiku"}\` |
| judgement: identity, conflicts, which task next, writing to strom | nobody — you |

Scans are read by this tree's subagent type \`strom-scan-reader\` (strom and the
file reader only, so it starts small); the model above still holds.

${delegationRules(n)}
- Send independent batches in ONE message so they run in parallel.
- Do not read a subagent's transcript or output file — its images would come
  into your context. Use only its final answer.
`,
  },
  codex: {
    id: "codex",
    name: "OpenAI Codex CLI",
    command: "codex",
    exit: "/quit",
    url: "https://developers.openai.com/codex/cli",
    delegation: "strom",
    models: {},
    instructions: (_m, n) => selfReading(n),
  },
  antigravity: {
    id: "antigravity",
    name: "Antigravity CLI",
    command: "agy",
    exit: "/quit",
    url: "https://antigravity.google/docs/cli",
    delegation: "strom",
    models: {},
    instructions: (_m, n) => selfReading(n),
  },
  opencode: {
    id: "opencode",
    name: "OpenCode",
    command: "opencode",
    exit: "/exit",
    url: "https://opencode.ai",
    delegation: "strom",
    models: {},
    instructions: (_m, n) => selfReading(n),
  },
  // xAI's Grok Build: its subagents take only its own models (no cheaper reader worth the images): it reads itself.
  grok: {
    id: "grok",
    name: "Grok Build",
    command: "grok",
    exit: "/quit",
    url: "https://x.ai/cli",
    delegation: "strom",
    models: {},
    instructions: (_m, n) => selfReading(n),
  },
};

export const DEFAULT_AGENT = "claude";

export function profile(id: string): AgentProfile {
  const p = PROFILES[id];
  if (!p) throw new Error(`unknown agent "${id}"`);
  return p;
}
