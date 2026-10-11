// How big an image each agent's model takes in whole. An agent shrinks a bigger image itself before its model sees
// it (and pays for the pixels it threw away in a slower read), so strom makes views no bigger than that:
//   Claude Code   ≤ 2000 px for Opus 4.7+, Sonnet 5+, Fable and Mythos (the image limit of their model catalogue;
//                 older models — Opus/Sonnet 4.6, Haiku — take 1568 on the API side)
//   Codex         ≤ 2048 px and about 2.5 megapixels at its default detail
//   OpenCode      ≤ 2000×2000 by default (attachment.image), the provider's model limit beyond it
//   Grok Build    shrinks to a size it does not say; Antigravity counts tokens per image, not pixels
// Unknown: 1568 px, what every vision model takes without shrinking it again.

/** The long side of a view every vision model takes in whole. */
export const IMAGE_MAX = 1568;
/** What the newer models take in whole, and Claude Code, Codex and OpenCode pass on unshrunk. */
export const IMAGE_MAX_LARGE = 2000;
/**
 * The long side of a whole image shown to find an entry on it (strom media view without --half, --crop or --split):
 * the entry is found as surely as at 2000 px for half the tokens; it is read from a crop or a half at the model's size.
 */
export const OVERVIEW_MAX = 1400;

/** A Claude model name or alias ("opus", "claude-opus-4-7", "claude-sonnet-5-5[1m]", "us.anthropic.claude-…"): its family and version. */
export function claudeModel(model: string): { family: string; version?: number } | undefined {
  const m = /(opus|sonnet|haiku|fable|mythos)(?:[-.]?(\d{1,2})(?:[-.](\d{1,2})(?!\d))?(?!\d))?/.exec(model.toLowerCase());
  if (!m) return undefined;
  // "claude-3-5-sonnet-…": the version before the family (an old model)
  const before = /(\d{1,2})(?:[-.](\d{1,2}))?[-.](?:opus|sonnet|haiku)/.exec(model.toLowerCase());
  if (!m[2] && before) return { family: m[1]!, version: Number(before[1]) + Number(before[2] ?? 0) / 10 };
  return { family: m[1]!, ...(m[2] ? { version: Number(m[2]) + Number(m[3] ?? 0) / 10 } : {}) };
}

/**
 * The longest side of a view for this agent and model (the model strom starts it with; undefined = the agent's own
 * default). Claude Code's own default is a model of the current line (Opus or Sonnet 5): 2000. A model given as a
 * family alone ("opus", "sonnet", "fable") is that family's newest — haiku stays at 1568 (not among the larger ones).
 */
export function imageMax(agent: string | undefined, model: string | undefined): number {
  const m = model?.trim() || undefined;
  switch (agent) {
    case "claude": {
      if (!m || m === "default" || m === "best") return IMAGE_MAX_LARGE;
      const c = claudeModel(m);
      if (!c) return IMAGE_MAX;
      if (c.family === "fable" || c.family === "mythos") return IMAGE_MAX_LARGE;
      if (c.version === undefined) return c.family === "haiku" ? IMAGE_MAX : IMAGE_MAX_LARGE;
      if (c.family === "opus") return c.version >= 4.7 ? IMAGE_MAX_LARGE : IMAGE_MAX;
      if (c.family === "sonnet") return c.version >= 5 ? IMAGE_MAX_LARGE : IMAGE_MAX;
      return IMAGE_MAX;
    }
    case "codex":
    case "opencode":
      return IMAGE_MAX_LARGE;
    default:
      return IMAGE_MAX;
  }
}
