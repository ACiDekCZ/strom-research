// GEDCOM reader: lines → a node tree, CONC/CONT joined. Tolerant: this reads
// files written by any program (and by people), not just our own.

export interface GedNode {
  level: number;
  xref?: string;
  tag: string;
  value: string;
  line: number;
  children: GedNode[];
}

const LINE = /^\s*(\d{1,2})\s+(?:(@[^@\s]+@)\s+)?([A-Za-z0-9_]+)(?:\s(.*))?$/;

export function parseGedcomText(text: string): { records: GedNode[]; problems: string[] } {
  const problems: string[] = [];
  const records: GedNode[] = [];
  const stack: GedNode[] = [];
  const rows = text.replace(/^﻿/, "").split(/\r\n|\r|\n/);
  rows.forEach((raw, i) => {
    if (!raw.trim()) return;
    const m = LINE.exec(raw);
    if (!m) {
      problems.push(`line ${i + 1}: not a GEDCOM line`);
      return;
    }
    // "@@" is a literal "@" (5.5.1); a lone pointer value stays as it is.
    const rawValue = m[4] ?? "";
    const value = /^@[^@\s]+@$/.test(rawValue) ? rawValue : rawValue.replace(/@@/g, "@");
    const node: GedNode = { level: Number(m[1]), tag: m[3]!.toUpperCase(), value, line: i + 1, children: [] };
    if (m[2]) node.xref = m[2];
    if (node.tag === "CONC" || node.tag === "CONT") {
      const parent = stack[node.level - 1];
      if (parent) parent.value += (node.tag === "CONT" ? "\n" : "") + node.value;
      return;
    }
    stack.length = node.level;
    if (node.level === 0) records.push(node);
    else {
      const parent = stack[node.level - 1];
      if (!parent) {
        problems.push(`line ${i + 1}: level ${node.level} without a parent`);
        return;
      }
      parent.children.push(node);
    }
    stack[node.level] = node;
  });
  return { records, problems };
}

export function child(n: GedNode, tag: string): GedNode | undefined {
  return n.children.find((c) => c.tag === tag);
}

export function children(n: GedNode, tag: string): GedNode[] {
  return n.children.filter((c) => c.tag === tag);
}

export function val(n: GedNode | undefined, tag: string): string | undefined {
  const c = n ? child(n, tag) : undefined;
  return c?.value.trim() || undefined;
}
