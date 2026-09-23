// Files shipped with strom (method pack, templates). They live in assets/
// next to src/ and dist/, so the same relative path works from both.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "assets");

export function assetPath(...parts: string[]): string {
  return path.join(ROOT, ...parts);
}

const cache = new Map<string, string>();

export function readAsset(...parts: string[]): string | undefined {
  const file = assetPath(...parts);
  if (cache.has(file)) return cache.get(file);
  try {
    const text = fs.readFileSync(file, "utf8");
    cache.set(file, text);
    return text;
  } catch {
    return undefined;
  }
}

/** Method text for a task level: the core plus the level's own page (+ reading for work in books). */
export function methodFor(level: string | undefined): string {
  const parts = [readAsset("method", "core.md")];
  if (level) parts.push(readAsset("method", `${level}.md`));
  if (level && ["link", "verify", "enrich"].includes(level)) parts.push(readAsset("method", "recording.md"));
  if (level && ["link", "verify", "enrich", "intake"].includes(level)) parts.push(readAsset("method", "reading.md"));
  return parts.filter(Boolean).join("\n");
}
