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
  /** Extra instructions for this agent, rendered into its instruction file. */
  instructions(models: Partial<Record<Tier, string>>): string;
}

const DELEGATION_RULES = `- Browsing a book, an index or a range of images ("is our surname on this page?")
  is delegated; so is anything self-contained that returns little.
- About ten scans (images B…:n) per delegate, never more than twelve; it opens
  as many halves and crops of them as reading needs, but tell it to stop at
  about 80 views and return what it has: every view stays in its context to
  the end. It asks for the views of a scan (or of a few) in one call —
  \`strom media view B0001:57-60 --half both\` — and opens them together.
- Every delegate gets the full question (what counts as a find, which years,
  which names) and returns for each image: image and page, find or nothing,
  what was illegible, the hand, and certainty per name — written as it goes.
- Delegates never write to the research. You record their findings through
  strom; a negative result of a delegate is recorded as a search "by reader".
- Only entries that will get a citation need your own eyes.`;

/** For agents that cannot pick a model for a subagent (Codex, Antigravity, OpenCode, Grok): read yourself, in small batches. */
export const SELF_READING = `## Reading scans (Codex, Antigravity, OpenCode, Grok)

Read the images yourself, with your strongest model — never hand old
handwriting to a faster or cheaper model, subagent or pass. Read them
in batches of at most ten: open a batch (one call gives its views —
\`strom media view B0001:57-66 --half both\` — open them together), write
down what it gave (strom search add … for what was not found, facts for what
was), then open the next. Every image and view stays in your context to the end: after about 80
views, write down what you found and go on. A name or place the next search depends on:
read it again on a crop at full resolution (\`strom media view … --crop\`)
before you record it.
`;

/**
 * The agents strom can start working alone without the user's personal add-ons (agent.addons): Claude Code
 * (--strict-mcp-config, --tools, no auto-memory) and Codex (its plugins, apps, hooks and memories off). The others have
 * no such switch — nothing is made up for them, and the setting is not offered.
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
    instructions: (m) => `## Delegating work (Claude Code)

Use the Agent tool for subagents; each has a clean context and only its answer
comes back to you. Choose the model by the kind of work:

| work | model |
|---|---|
| handwriting: registers, indexes, land books, any scan read closely | \`${m.vision ?? "opus"}\` — never cheaper |
| print and type: documents of the 20th century, catalogues, web pages, big text files | \`${m.text ?? "sonnet"}\` |
| mechanical: downloads, renaming, counting, a plain grep | \`${m.cheap ?? "haiku"}\` |
| judgement: identity, conflicts, which task next, writing to strom | nobody — you |

${DELEGATION_RULES}
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
    instructions: () => SELF_READING,
  },
  antigravity: {
    id: "antigravity",
    name: "Antigravity CLI",
    command: "agy",
    exit: "/quit",
    url: "https://antigravity.google/docs/cli",
    delegation: "strom",
    models: {},
    instructions: () => SELF_READING,
  },
  opencode: {
    id: "opencode",
    name: "OpenCode",
    command: "opencode",
    exit: "/exit",
    url: "https://opencode.ai",
    delegation: "strom",
    models: {},
    instructions: () => SELF_READING,
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
    instructions: () => SELF_READING,
  },
};

export const DEFAULT_AGENT = "claude";

export function profile(id: string): AgentProfile {
  const p = PROFILES[id];
  if (!p) throw new Error(`unknown agent "${id}"`);
  return p;
}
