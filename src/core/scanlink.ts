// The page of a scan in the online archive, as the Strom app links it ("the page in the archive"): each excerpt's own
// (_URL under its OBJE), and the source's (WWW) — for the excerpts the file leaves out, and the sources of no excerpt.
// What a connector or an agent gave: the image's page (Media.url), the source's own address (Source.url). Only an
// address a person may open: http(s), a site's name — never this computer, a home network or a login in the address.
// Nothing is made up: a recordset's address is the book, not a page of it, and is never taken for one.

import type { Media, Source } from "./model.ts";

/** Names that are never a public site: this computer, a home or company network. */
const LOCAL_NAMES = /(?:^|\.)(?:localhost|local|lan|home|internal|intranet|corp|home\.arpa)$/iu;

/** An address a person may open in their browser: http(s) on a public site's name; anything else undefined. */
export function publicPage(address: string | undefined): string | undefined {
  const text = address?.trim();
  if (!text || !URL.canParse(text)) return undefined;
  const u = new URL(text);
  if (u.protocol !== "http:" && u.protocol !== "https:") return undefined;
  if (u.username || u.password) return undefined;
  const host = u.hostname.replace(/\.$/u, "");
  // a site has a name of two labels at least; an address of numbers (IPv4, IPv6 in brackets) is no archive's page
  if (!host.includes(".") || /^\[.*\]$/u.test(host) || /^\d+(?:\.\d+){3}$/u.test(host) || LOCAL_NAMES.test(host)) return undefined;
  return text;
}

/** Whether `more` is the same page as `less`, said more exactly: the same site, its address going on from it. */
function goesOn(more: URL, less: URL): boolean {
  if (more.origin !== less.origin || more.href === less.href) return false;
  const path = less.pathname.replace(/\/+$/u, "");
  if (more.pathname.replace(/\/+$/u, "") === path) return !less.search && !less.hash && !!(more.search || more.hash);
  return more.pathname.startsWith(`${path}/`) && !less.search && !less.hash;
}

/** The images a source is on: those its entry is cut from, then those it cites. */
function imagesOf(s: Source): string[] {
  return [...new Set([...(s.clips ?? []).map((c) => c.media), ...(s.media ?? [])])];
}

/**
 * The page of one of a source's images (its excerpt's _URL): the image's own; the source's own address instead where
 * it is that page more exactly (on the same site, going on from the image's address — a portal's page of the book
 * against the page of its image) and the source is on that one image alone. Never the source's address for an image
 * of no address of its own: the app takes the source's (WWW) then.
 */
export function excerptPage(imageUrl: string | undefined, s: Source): string | undefined {
  const image = publicPage(imageUrl);
  if (!image) return undefined;
  const own = publicPage(s.url);
  if (own && imagesOf(s).length === 1 && goesOn(new URL(own), new URL(image))) return own;
  return image;
}

/** A source's page in the archive (its WWW): the page of its first image with one, else its own address. */
export function sourcePage(s: Source, media: (id: string) => Media | undefined): string | undefined {
  for (const id of imagesOf(s)) {
    const page = excerptPage(media(id)?.url, s);
    if (page) return page;
  }
  return publicPage(s.url);
}
