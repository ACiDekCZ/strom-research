// What a person reads never addresses them (Milan, 2026-10-04): strom's own texts for a person (ui.*, log.* in every
// language) and what an agent writes for the person to read in strom's menu and the Strom app — what a task waits for
// (strom task wait --on), whom it waits on (--to). Nor does such a text speak as the agent ("Prosím o…", "snímky pak
// určím sám"): it says what is needed and from whom, in the infinitive or as a noun ("Odpověď matriky na žádost z 21. 9.").
//
// One detector for both: the catalog test reads every text of strom's catalogs thoroughly; a command refuses only the
// clear cases — names of people and quotations of a record ("Grete", "křest dítěte", "Ihre Taufe" at a sentence's start)
// never trip it. Any script: words are bounded by letters, marks and digits, never \b; the text is read as NFC.

/** Not inside a word: letters, marks and digits of any script. */
const B = "(?<![\\p{L}\\p{M}\\p{N}])";
const E = "(?![\\p{L}\\p{M}\\p{N}])";
const words = (list: string, flags = "iu") => new RegExp(`${B}(?:${list})${E}`, flags);

/** Czech nouns whose genitive ends like an imperative (-ěte): a child, a count — words of the records. */
const CS_NOT_IMPERATIVE = new Set(["dítěte", "hraběte", "markraběte", "nemluvněte", "roběte", "kotěte", "štěněte", "hříběte", "jehněte", "prasátěte"]);
/** Forms of "váš" that are also a surname's (Vaša: Vaši, Vaše) — after a name inside a sentence ("rychtáře Matěje Vaši") the surname. */
const CS_SURNAME_LIKE = new Set(["vaši", "vaše", "vaší", "vašim", "vaším"]);
const AFTER_NAME = /[^\s.!?:;]\s+\p{Lu}[\p{L}\p{M}]*\s+$/u;

interface Markers {
  /** Clear in any text of the language. */
  clear: RegExp[];
  /** Only in strom's own catalogs (a name or a record's word could look like it elsewhere). */
  thorough: RegExp[];
  /**
   * Speaking as the agent (the first person, a request): only in what an agent writes — strom's catalogs give the
   * person's own words for their choices ("Ask me about everything", "napíšu sám"). In a text of this language only (in
   * another the same letters are another word: Czech "my" is "we").
   */
  agent?: RegExp[];
  /** A match that is not one after all; `before`: the text before it. */
  not?: (word: string, before: string) => boolean;
}

const MARKERS: Record<string, Markers> = {
  en: {
    clear: [words("you|your|yours|yourself|yourselves")],
    thorough: [],
    agent: [words("please|me|my|myself|let me"), words("I(?:'ll|'m|'ve|'d|’ll|’m|’ve|’d| will| can| need| shall| would)", "u")],
  },
  cs: {
    clear: [
      // the forms of váš, tvůj listed whole, never a stem: Vašek, Vaška, Vaškovi, Vašková are names
      words(
        "vy|vás|vám|vámi|váš|vaše|vašeho|vašemu|vaší|vaši|vašim|vaším|vašich|vašimi|tvůj|tvoje|tvojí|tvojím|tvojich|tvojimi|tvé|tvým|tvou|tebe|tobě|tebou|jste|jsi|máte|máš|chcete|chceš|můžete|můžeš|musíte|musíš|budete|budeš|najdete|pošlete|zašlete|odešlete|přepošlete|otevřete|přihlaste|vyberte|přineste",
      ),
      // the imperative of the plural, polite: Zkontrolujte, zadejte, najděte, vyplňte, buďte, spusťte, uložte, napište, ověřte, uvidíte
      words("\\p{L}{2,}(?:ejte|ujte|ěte|ňte|ďte|ťte|žte|šte|řte|íte)"),
    ],
    thorough: [words("ty|tě|tví|tvá|tvého|tvému|tvými|\\p{L}{2,}ete")],
    agent: [words("prosím|prosíme|mi|mně|já|potřebuji|potřebuju|určím|zjistím|přečtu|dohledám|pošlu|napíšu")],
    not: (w, before) => {
      const l = w.toLocaleLowerCase("cs");
      return CS_NOT_IMPERATIVE.has(l) || (CS_SURNAME_LIKE.has(l) && w !== l && AFTER_NAME.test(before));
    },
  },
  de: {
    clear: [
      // "Dir." is a Direktor of a record, never "to you"
      words("du|dich|dir(?!\\.)|dein|deine|deinen|deinem|deiner|deines|euch|euer|eure|euren|eurem|eurer|eures"),
      // the polite form inside a sentence ("… wenn Sie …"); at a sentence's start "Sie", "Ihre" may be "she", "her"
      new RegExp(`(?<=[\\p{L}\\p{M}\\p{N},;)]\\s+)(?:Sie|Ihr|Ihre|Ihren|Ihrem|Ihrer|Ihres|Ihnen)${E}`, "u"),
    ],
    thorough: [words("Sie|Ihr|Ihre|Ihren|Ihrem|Ihrer|Ihres|Ihnen", "u")],
    agent: [words("bitte|ich|mich|mir|mein|meine|meinen|meinem|meiner|meines")],
  },
};

/**
 * The word by which a text addresses the person (or speaks as the agent), in the research language and English; undefined
 * when it does not. `thorough`: strom's own catalogs — every word that could address, names aside. `clear`: only what
 * clearly addresses the person, nothing of the agent's first person (a session's summary, where a reading may be the
 * agent's own: "Zápis jsem přečetl").
 */
export function addressesPerson(text: string, lang: string, opts: { thorough?: boolean; clear?: boolean } = {}): string | undefined {
  const t = text.normalize("NFC");
  for (const l of new Set([lang, "en"])) {
    const m = MARKERS[l];
    if (!m) continue;
    for (const re of [...m.clear, ...(opts.thorough ? m.thorough : opts.clear ? [] : l === lang ? (m.agent ?? []) : [])]) {
      const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
      for (const found of t.matchAll(g)) if (!m.not?.(found[0], t.slice(0, found.index))) return found[0];
    }
  }
  return undefined;
}
