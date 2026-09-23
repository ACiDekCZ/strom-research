// Error types with stable exit codes. Every error carries an optional hint:
// the exact command the caller (usually an agent) should run next.

export const EXIT = {
  ok: 0,
  error: 1,
  usage: 2,
  needsInput: 3,
  needsConsent: 4,
  locked: 5,
} as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];

export class StromError extends Error {
  readonly exitCode: ExitCode;
  readonly hint: string | undefined;
  readonly details: unknown;

  constructor(message: string, opts: { exitCode?: ExitCode; hint?: string; details?: unknown } = {}) {
    super(message);
    this.name = "StromError";
    this.exitCode = opts.exitCode ?? EXIT.error;
    this.hint = opts.hint;
    this.details = opts.details;
  }

  toJSON(): Record<string, unknown> {
    const out: Record<string, unknown> = { status: "error", message: this.message };
    if (this.hint) out.hint = this.hint;
    if (this.details !== undefined) out.details = this.details;
    return out;
  }
}

/** Invalid arguments or an ambiguous reference. */
export class UsageError extends StromError {
  constructor(message: string, opts: { hint?: string; details?: unknown } = {}) {
    super(message, { ...opts, exitCode: EXIT.usage });
    this.name = "UsageError";
  }
}

export interface Candidate {
  id: string;
  label: string;
}

/** A name matched more than one record. Never pick one silently. */
export class AmbiguousError extends StromError {
  readonly candidates: Candidate[];

  constructor(query: string, candidates: Candidate[]) {
    super(`"${query}" matches ${candidates.length} records`, {
      exitCode: EXIT.usage,
      hint: "use the ID instead of the name",
      details: { candidates },
    });
    this.name = "AmbiguousError";
    this.candidates = candidates;
  }

  override toJSON(): Record<string, unknown> {
    return { status: "ambiguous", message: this.message, hint: this.hint, candidates: this.candidates };
  }
}

export interface Need {
  key: string;
  kind: "config" | "consent";
  question: string;
  default?: string;
  scopes?: string[];
  /** Command that satisfies the need. */
  set: string;
}

/** A setting is missing and there is no TTY to ask. */
export class NeedsInputError extends StromError {
  readonly needs: Need[];

  constructor(needs: Need[]) {
    super(`missing setting: ${needs.map((n) => n.key).join(", ")}`, {
      exitCode: EXIT.needsInput,
      hint: needs.map((n) => n.set).join("\n"),
    });
    this.name = "NeedsInputError";
    this.needs = needs;
  }

  override toJSON(): Record<string, unknown> {
    return { status: "needs-input", needs: this.needs };
  }
}

/** A human must grant consent on a terminal. Agents must never grant it. */
export class NeedsConsentError extends StromError {
  readonly needs: Need[];

  constructor(needs: Need[]) {
    super(`consent required — ${needs.map((n) => n.question).join(" · ")}`, {
      exitCode: EXIT.needsConsent,
      hint: `ask the user to run in their own terminal: ${needs.map((n) => n.set).join(" ; ")}`,
    });
    this.name = "NeedsConsentError";
    this.needs = needs;
  }

  override toJSON(): Record<string, unknown> {
    return { status: "needs-consent", needs: this.needs, hint: this.hint };
  }
}

export class LockedError extends StromError {
  constructor(message: string, hint?: string) {
    super(message, { exitCode: EXIT.locked, ...(hint ? { hint } : {}) });
    this.name = "LockedError";
  }
}
