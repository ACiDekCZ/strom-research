// Research language: the language the agent uses with the user and for
// research texts (notes, tasks, stories). CLI output itself is English.

import type { Env } from "./paths.ts";

/** BCP 47 primary tag, e.g. "cs", "en", "de". */
export function normalizeLang(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const v = value.trim();
  if (v === "" || v === "C" || v === "POSIX") return undefined;
  // "cs_CZ.UTF-8" -> "cs", "de-AT" -> "de"
  const m = /^([A-Za-z]{2,3})(?:[-_.@]|$)/.exec(v);
  return m?.[1]?.toLowerCase();
}

/** Detect the user's language from the environment and the OS locale. */
export function detectLang(env: Env): string {
  for (const key of ["LC_ALL", "LC_MESSAGES", "LANG", "LANGUAGE"]) {
    const lang = normalizeLang(env[key]?.split(":")[0]);
    if (lang) return lang;
  }
  try {
    const lang = normalizeLang(Intl.DateTimeFormat().resolvedOptions().locale);
    if (lang) return lang;
  } catch {
    // Intl unavailable: fall through
  }
  return "en";
}

const NAMES: Record<string, string> = {
  cs: "Czech",
  sk: "Slovak",
  de: "German",
  pl: "Polish",
  en: "English",
  hu: "Hungarian",
  fr: "French",
  it: "Italian",
  es: "Spanish",
  uk: "Ukrainian",
  ru: "Russian",
  sl: "Slovenian",
  hr: "Croatian",
  nl: "Dutch",
  sv: "Swedish",
  da: "Danish",
  nb: "Norwegian",
  fi: "Finnish",
  pt: "Portuguese",
  lt: "Lithuanian",
  lv: "Latvian",
};

/** The name of a language — in English, or in another language for a person who reads it ("čeština"). */
export function langName(code: string, inLang?: string): string {
  if (inLang && inLang !== "en") {
    try {
      const name = new Intl.DisplayNames([inLang], { type: "language", fallback: "none" }).of(code);
      if (name) return name;
    } catch {
      // an unknown code: the English name, or the code
    }
  }
  return NAMES[code] ?? code;
}

export function isValidLang(value: string): boolean {
  return /^[a-z]{2,3}$/.test(value);
}
