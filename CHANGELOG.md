# What's new in Strom Research

English · [Čeština](CHANGELOG.cs.md) · [Deutsch](CHANGELOG.de.md)

The changes of each version in short. The full notes and the install lines are on
[GitHub Releases](https://github.com/ACiDekCZ/strom-research/releases).

## 1.17.0

*In preparation: the betas up to 1.17.0-beta.3. The section is complete with the release.*

- **What hypotheses would connect, first.** The tasks to fill in what the variants of an open hypothesis would
  connect go first in the queue — also in an existing research after the update — so the Strom app can show those
  links soon.
- **An interrupted download is said and tidied.** A download whose process ended midway is reported as interrupted,
  with what was saved and what is missing; its work folder is cleared away.
- **New material reported in the research's language.** What came in (registered material, what was added, likely
  duplicates, married names, tasks) is said in the language of the research.

## 1.16.0

*2026-10-17 · goes with the Strom app 3.13.0.*

- **The terminal for the research's windows (macOS).** What the Strom app opens in a terminal, and a conversation
  handed over to a new window, can open in iTerm2 instead of the system's terminal: the settings' first item, the
  setup when both are here, or `strom config set terminal iterm2`. A terminal not installed falls back to the
  system's and says so in the window; `strom doctor` names the one chosen. On Windows the system decides it.
- **Each person where the tree ends, with its own variants.** When an open hypothesis joins the tree at several
  people, each of them carries the variants that name it and the family off the tree it belongs to, so the Strom app
  can show all of them, not only the first.
- **Where the tree ends, person by person.** `strom edge --json` lists each person a hypothesis joins, with the
  variants and the family of each one.
- **The surname after a marriage, both ways with the Strom app.** A name after a marriage the Strom app sends back
  comes in as a name of the married kind, never as a rename or another form of the birth name; the same surname is
  the same name whatever first name goes with it. Changed or taken off in the app, the old one goes where only edits
  in the app gave it; one a record gives stays. `strom intake` reads `_MARNM` of other programs as a married name.
  A research started earlier from such a family tree (MyHeritage, Legacy, PAF) gets them from the file it keeps:
  `strom input names I…` shows them, `--apply` adds only these names, citing the import, `--undo` takes them back.
- **One archive, one question.** When one archive's images come from several hosts (its site, an album, an image
  server), the permission it needs is asked once and decided for all of them, not host by host.
- **Lines of research in Czech.** The Czech texts say „linie výzkumu“ (lines of research) everywhere now.

## 1.15.0

*2026-10-16 · goes with the Strom app 3.12.0.*

- **A Strom archive by choice, with an AI agent too.** The setup asks whether new family trees are researches with the
  agent or only a Strom archive; the settings change it for one family tree or for the new ones.
- **A research waiting for its agent.** A family tree whose AI agent is not on this computer keeps what the Strom app
  sends, as a Strom archive does. Once the agent is installed, the research goes on by itself.
- **One book of an archive, fetched once.** A book already in the research is named instead of being registered and
  fetched again, so an archive is never asked twice for the same images.
- **Faster reading.** Five readers read the scans at the same time (the setting `read.parallel`, 1 to 10), and a long
  download says how far it is ("40/109 images"). The readers begin while a book is still downloading: its images are
  registered ten at a time, and what did not come is said exactly; Ctrl-C keeps what came. An archive gets the same
  requests at the same pace. A book can also be fetched in the background while the agent works on (`strom fetch
  --background`), never from an archive that allows only a person's pace. A search for one entry can stop at the find
  (`strom read --until-found`): the images read are said exactly, and only they count as searched.
- **Family trees from other programs.** A GEDCOM file saved with a byte order mark or in UTF-16 (as some Windows
  programs save it) is read as a family tree; a family tree of another research is taken in as a foreign one.
- **Cleaner on one computer.** The live view ends cleanly on every system, Windows too, and the Strom app learns that
  it ended. Another strom on the same computer (from npm, or built from the sources) never takes over the links of the
  Strom app or the update channel.
- **Fixes from real researches.** The daily ration of working alone lets a new week begin at once, uses what is left
  in the week's last two hours instead of waiting past the reset, and says when the week resets. Ages written as
  fractions (½ roku, 1 1/2 years, ein halbes Jahr) are read, and a list of images (`strom read --images 5-19,21-39`)
  is read as given. A book is fetched by the session that reads it, never ahead for a later one;
  `strom fetch --recordset` finds the book itself; counts and commands are said as typed.
- **What's new.** After `strom update` and with `strom --version`, a link to this list in the research language. The
  Strom app shows the points of a new research version in its own “What's new” window.

## 1.14.0

*2026-10-11 · goes with the Strom app 3.11.0.*

- **Each archive's terms.** strom keeps to how far each archive allows automated access: allowed, restricted, by hand
  only, or not at all. Where the terms are unclear, the person decides once. A refusal pauses an archive for a day.
- **What waits, in places.** Things for the person are sorted by kind and grouped by where they are done: one archive,
  one office, the family, one site. A letter or a question can be marked as sent.
- **Reading old handwriting.** Scans at the size each view needs, a reader of scans on the person's model, and the
  reading tuned on the research's own proven records.
- **With the Strom app 3.11.0.** A conflict between an edit in the app and a record is decided in the app; hypotheses
  show what each variant would connect.
- **A smaller brief that knows more**, and the reasoning effort is the person's choice (`model.effort`).
- **`strom grep`** searches the research's inputs, notes and output, through accents too.
