// `strom doc`: "How Strom works" — the documentation of the research and the Strom app, carried with strom
// (core/doc.ts): its contents, a rule by its number, a search. Read only; no tree, no lock, no network.

import { register } from "../cli/registry.ts";
import { UsageError } from "../core/errors.ts";
import { table } from "../cli/format.ts";
import { ui } from "../cli/ui.ts";
import { langName } from "../core/lang.ts";
import { docBook, docLangOf, docNear, docNumber, docSearch, docUnder, docUrl, type DocBook, type DocEntry } from "../core/doc.ts";

/** How many a search lists without --limit. */
const SEARCH_ROWS = 10;

const shortPin = (pin: string) => pin.slice(0, 7);

/** A number with its title and link, as --json lists them. */
const item = (book: DocBook, e: DocEntry) => ({ number: e.number, title: e.title, url: docUrl(book.lang, e.number) });

register({
  path: ["doc"],
  summary: "How Strom works: the rules of the research and the Strom app — contents, a rule by its number, a search (carried with strom, offline)",
  group: "start",
  description:
    "The documentation \"How Strom works\" (stromapp.info/doc) in the version carried with this strom. Without an argument, its contents: the chapters of R (the research), A (the Strom app) and S (the two together). A number (R10.1, A6.5.1; r4.3 and R4-3 read the same): the rule — its title, text, why, what holds it, where it is controlled, since when — and the rules under it, with its link on the web. Words: the rules whose titles, register of terms or text hold them all, best first. In the research language (--lang another; one it is not written in: English). For the person's questions how or why Strom does something: answer with the rule's number and its link.",
  args: [{ name: "number-or-words", description: "a number (R10.1, A6.5.1), or words to look for", variadic: true }],
  examples: ["strom doc", "strom doc R2.3", "strom doc hypothesis --lang en", "strom doc R2 --json"],
  run(ctx, { args, opts }) {
    const asked = docLangOf(ctx.uiLang());
    const book = docBook(asked.lang);
    const lang = book.lang;
    const t = (key: Parameters<typeof ui>[1], values: Record<string, string | number> = {}) => ui(lang, key, values);
    const note = asked.fallback ? t("ui.docs.fallback", { language: langName(asked.fallback, "en") }) : undefined;
    const base = { lang, pin: book.pin, ...(asked.fallback ? { fallback: asked.fallback } : {}) };
    const words = args.flatMap((a) => a.split(/\s+/u)).filter(Boolean);
    const head = (title: string) => [title, ...(note ? [note] : [])];

    // the contents
    if (!words.length) {
      const url = docUrl(lang);
      const text = [
        ...head(`${book.title} · strom-doc ${shortPin(book.pin)}`),
        ...book.parts.flatMap((p) => ["", p.title, table(p.chapters.map((c) => [`  ${c}`, book.entries.get(c)!.title]))]),
        "",
        t("ui.docs.how"),
        url,
      ].join("\n");
      const parts = book.parts.map((p) => ({ part: p.id, title: p.title, chapters: p.chapters.map((c) => item(book, book.entries.get(c)!)) }));
      return { text, data: { ...base, title: book.title, url, parts } };
    }

    // a rule, a chapter
    const number = words.length === 1 ? docNumber(words[0]!) : undefined;
    if (number) {
      const entry = book.entries.get(number);
      if (!entry) {
        const near = docNear(book, number);
        const pin = shortPin(book.pin);
        // a person reads it in the research's language (ui.error.doc.unknown…), an agent the English
        throw new UsageError(`no ${number} in How Strom works (strom-doc ${pin})${near.length ? ` — near: ${near.join(", ")}` : ""}`, {
          hint: near.length ? `strom doc ${near[0]} · the contents: strom doc` : "strom doc",
          ...(near.length ? { code: "doc.unknown", params: { number, pin, near: near.join(", "), first: near[0]! } } : { code: "doc.unknown.none", params: { number, pin } }),
        });
      }
      const under = docUnder(book, number);
      const url = docUrl(lang, number);
      const text = [
        ...head(`${entry.number} ${entry.title}`),
        ...(entry.text ? ["", entry.text] : []),
        ...(under.length ? ["", t(entry.depth === 1 ? "ui.docs.chapter" : "ui.docs.under"), table(under.map((e) => [`${"  ".repeat(e.depth - entry.depth)}${e.number}`, e.title]))] : []),
        "",
        url,
      ].join("\n");
      return {
        text,
        data: { ...base, number, title: entry.title, chapter: entry.chapter, text: entry.text, ...(entry.why ? { why: entry.why } : {}), url, ...(under.length ? { rules: under.map((e) => item(book, e)) } : {}) },
      };
    }

    // a search
    const query = words.join(" ");
    const limit = opts.limit === undefined ? SEARCH_ROWS : Number(opts.limit);
    if (!(Number.isInteger(limit) && limit > 0)) throw new UsageError(`invalid --limit "${String(opts.limit)}": a whole number, 1 or more`, { hint: `strom doc ${query} --limit 20` });
    const found = docSearch(book, query);
    const shown = found.slice(0, limit);
    const text = found.length
      ? [
          ...head(t("ui.docs.found", { query, n: found.length })),
          table(shown.map(({ entry }) => [`  ${entry.number}`, entry.title])),
          ...(found.length > shown.length ? [t("ui.docs.more", { n: found.length - shown.length, query, all: found.length })] : []),
        ].join("\n")
      : [...head(t("ui.docs.none", { query }))].join("\n");
    return { text, data: { ...base, query, total: found.length, results: shown.map(({ entry }) => item(book, entry)) } };
  },
});
