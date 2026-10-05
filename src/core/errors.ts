// Error types with stable exit codes. Every error carries an optional hint:
// the exact command the caller (usually an agent) should run next.

export const EXIT = {
  ok: 0,
  error: 1,
  usage: 2,
  needsInput: 3,
  needsConsent: 4,
  locked: 5,
  cancelled: 130,
} as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];

/**
 * What went wrong as a program reads it (the Strom app says it in its own language — its language need not be the
 * research's): a stable code and its parameters (IDs), beside the English message.
 */
export interface ErrorCode {
  code: string;
  params?: Record<string, string>;
}

export class StromError extends Error {
  readonly exitCode: ExitCode;
  readonly hint: string | undefined;
  readonly details: unknown;
  readonly code: string | undefined;
  readonly params: Record<string, string> | undefined;

  constructor(message: string, opts: { exitCode?: ExitCode; hint?: string; details?: unknown } & Partial<ErrorCode> = {}) {
    super(message);
    this.name = "StromError";
    this.exitCode = opts.exitCode ?? EXIT.error;
    this.hint = opts.hint;
    this.details = opts.details;
    this.code = opts.code;
    this.params = opts.params;
  }

  toJSON(): Record<string, unknown> {
    const out: Record<string, unknown> = { status: "error", message: this.message };
    if (this.hint) out.hint = this.hint;
    if (this.details !== undefined) out.details = this.details;
    if (this.code) out.code = this.code;
    if (this.params) out.params = this.params;
    return out;
  }
}

/** Invalid arguments or an ambiguous reference. */
export class UsageError extends StromError {
  constructor(message: string, opts: { hint?: string; details?: unknown } & Partial<ErrorCode> = {}) {
    super(message, { ...opts, exitCode: EXIT.usage });
    this.name = "UsageError";
  }
}

export interface Candidate {
  id: string;
  label: string;
}

/** Ctrl-C at a question: the person stopped it, nothing was changed — said calmly, never as an error. */
export class Cancelled extends StromError {
  constructor() {
    super("cancelled with Ctrl-C, nothing changed", { exitCode: EXIT.cancelled, code: "cancelled" });
    this.name = "Cancelled";
  }
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
    const keys = needs.map((n) => n.key).join(", ");
    super(`missing setting: ${keys}`, { exitCode: EXIT.needsInput, hint: needs.map((n) => n.set).join("\n"), code: "setting.missing", params: { keys } });
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

  /** `says`: the question as the person reads it (their language) — said so at a terminal (ui.error.consent). */
  constructor(needs: Need[], says?: string) {
    super(`consent required — ${needs.map((n) => n.question).join(" · ")}`, {
      exitCode: EXIT.needsConsent,
      hint: `ask the user to run in their own terminal: ${needs.map((n) => n.set).join(" ; ")}`,
      ...(says ? { code: "consent", params: { question: says, set: needs.map((n) => n.set).join(" ; ") } } : {}),
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
