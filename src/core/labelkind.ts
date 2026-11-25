// The kind of fact an event of its own (EVEN + TYPE) names by its label: "Census", "Sčítání lidu", "Volkszählung" …

import { EVENT_KINDS } from "./model.ts";
import { foldText } from "./text.ts";
import { LABELS, labels, type LabelKey } from "../gedcom/labels.ts";
import { UI, ui, type UIKey } from "../cli/ui.ts";

const fold = (s: string | undefined) => (s ? foldText(s).replace(/\s+/g, " ").trim() : "");
/** Christening and baptism are one fact here, as in the import. */
const kindOf = (k: string) => (k === "CHR" ? "BAPM" : k);

/** The words a fact's label may name a kind of fact by (EVEN + TYPE): its tag, its name, the app's and strom's words for it. */
let labelKinds: Map<string, string> | undefined;
export function kindOfLabel(label: string | undefined): string | undefined {
  if (!labelKinds) {
    const m = new Map<string, string>();
    const set = (word: string, kind: string) => {
      const k = fold(word);
      if (k && !m.has(k)) m.set(k, kindOf(kind));
    };
    for (const [kind, name] of Object.entries(EVENT_KINDS)) {
      if (kind === "EVEN") continue;
      set(kind, kind);
      set(name, kind);
      for (const lang of ["en", "cs", "de", "pl", "sk"]) {
        if (`ui.ev.${kind}` in UI) set(ui(lang, `ui.ev.${kind}` as UIKey), kind);
        if (kind in LABELS.en) set(labels(lang)(kind as LabelKey), kind);
      }
    }
    labelKinds = m;
  }
  return label ? labelKinds.get(fold(label)) : undefined;
}

/** A census of a person: `CENS`, or an event of its own whose label names a census ("Sčítání lidu", written so by hand). */
export const isCensus = (e: { kind: string; label?: string | undefined }): boolean => e.kind === "CENS" || (e.kind === "EVEN" && kindOfLabel(e.label) === "CENS");
