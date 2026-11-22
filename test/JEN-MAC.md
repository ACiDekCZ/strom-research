# Tests that GitHub's runners skip (JEN-MAC: "only on a Mac")

The whole suite runs on every push in GitHub Actions (`.github/workflows/test.yml`: Ubuntu, Node 24, eight shards).
A test that cannot run there is never removed or turned off quietly: it skips itself with a condition, and a Mac with
the developer's folders still runs it (the whole `npm test` before a release). The workflow's step "Skipped here"
lists what each shard skipped.

On ubuntu-24.04: 41 tests skip (measured 2026-11-22). They are:

## macOS itself (11)

| Test file | Tests | Why |
|---|---|---|
| `test/cli/terminal.test.ts` | 6 | the terminals of macOS (Terminal, iTerm2, …): found by their apps and bundle IDs, opened with `open -b` |
| `test/cli/widget.test.ts` | 2 | the macOS widget's files under `~/Library` |
| `test/cli/remove.test.ts` | 1 | the trash of a Mac (`~/.Trash`) |
| `test/unit/readable.test.ts` | 1 | `sips` and PDFKit (`osascript`): a HEIC photo, a PDF of text |
| `test/cli/links-bridge.test.ts` | 1 | links of another installation set up through the macOS app bundle |

## The Strom app's sources beside the repository (26)

Run only where `../strom` and `../strom-beta` (the Strom app, with its `node_modules`) are next to this repository: the
app's own parser and exporter read what strom writes. A runner has only this repository.

`test/gedcom/app-tags.test.ts`, `test/gedcom/gedcom.test.ts`, `test/gedcom/long-lines.test.ts`,
`test/cli/sync-sex-unknown.test.ts`, `test/cli/sync-unknown-surname.test.ts`, `test/cli/sync-titles.test.ts`,
`test/cli/sync-nameless.test.ts`, `test/cli/sync-source-title.test.ts`, `test/cli/verify-app.test.ts`,
`test/cli/story-keep.test.ts`, `test/cli/excerpts-export.test.ts`, `test/cli/excerpts-links.test.ts`,
`test/cli/live-images-ref.test.ts`, `test/cli/edge.test.ts`.

## Elsewhere, not on a Mac either (4)

- `test/unit/beta-commit.test.ts` (3): skipped on the branch `beta`, whose tree already has the beta's agents' text;
  they run on `main`.
- `test/unit/runsync.test.ts` (1): Windows only.
