// The words strom says itself (its commands, options, help and English texts): what masking keeps of a command line or
// a message (core/redact.ts). Made once a process, when first asked.

import { vocabularyOf } from "../core/redact.ts";
import { commands, GLOBAL_OPTIONS, WRITE_OPTIONS } from "./registry.ts";
import { UI } from "./ui.ts";

let made: Set<string> | undefined;

export function stromVocabulary(): ReadonlySet<string> {
  if (made) return made;
  const texts: string[] = [...Object.values(UI)];
  for (const o of [...GLOBAL_OPTIONS, ...WRITE_OPTIONS]) texts.push(o.name, o.description);
  for (const c of commands()) {
    texts.push(...c.path, c.summary, c.description ?? "");
    for (const o of c.options ?? []) texts.push(o.name, o.description, o.value ?? "");
    for (const a of c.args ?? []) texts.push(a.name, a.description);
  }
  // what strom's logs and errors say besides (the system's, the network's)
  texts.push("strom ok error errors warning failed timeout timed out refused reset connection socket hang up status exit code signal killed stopped interrupted started ended running pid port bridge live sync app session run gate tidy fetch images pages requests host hosts pace wait waits backoff retry later done kept removed shrink compact json gedcom git commit uncommitted clean dirty lock locked held schema migrate migration version beta rc stable channel node npm installer install update doctor check");
  // the names of the programs and systems strom names (an agent, a browser, the system's own)
  texts.push("apple git github homebrew xcode claude codex opencode openai chatgpt antigravity grok gemini chrome chromium canary brave edge safari firefox windows macos linux ubuntu debian powershell onedrive icloud dropbox cli desktop");
  made = vocabularyOf(texts);
  return made;
}
