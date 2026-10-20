# What's new in Strom Research

English · [Čeština](CHANGELOG.cs.md) · [Deutsch](CHANGELOG.de.md)

The changes of each version in short. The full notes and the install lines are on
[GitHub Releases](https://github.com/ACiDekCZ/strom-research/releases).

## 1.18.0

*In preparation: the betas up to 1.18.0-beta.9. The section is complete with the release.*

- **Phone photos upright.** A photo turned by its EXIF orientation is read as it is meant to be seen, upright; the
  places marked on it (excerpts, the halves of a spread, a cut-out part) are of the picture as it is shown. The
  photo itself stays as it was.
- **HEIC photos and PDF documents can be read.** HEIC photos from a phone and the pages of a PDF are converted to
  JPEG for reading — on macOS, Windows and Linux — and the original is kept as it came. A HEIC photo goes to the
  Strom app as a JPEG excerpt. Where nothing on the computer converts a picture, one sentence says so and what would
  help; `strom tidy` clears the converted pictures away after 30 days or above 500 MB.
- **One document read at once.** `strom document read` reads a photo, a scan or a PDF of one document — a register
  entry, a letter, a deed, a gravestone, the back of a photo: the transcript word for word, its translation, what its
  old words and abbreviations mean, and the people it names, with who of the tree they may be. Nothing is filled in:
  a name the document does not have is left out — a surname too, never taken from a father or another family —,
  what cannot be read is marked; a second reader can read it blind. Nothing of it enters the tree by itself. A
  document read already says so, so it is not read a second time by mistake. A document read again is shown under
  the name of its file, never a code. A document sent from the Strom app finds the agent as the terminal does — one
  installed in a folder of its own, by npm or Homebrew too — instead of saying no agent is set up.
- **Photos from a phone.** `strom phone on`, turned on by the person alone, lets a phone on the home network (Wi-Fi
  or a cable — never a mobile network or a VPN) reach this computer. The phone is paired once by its QR code; its
  page then takes photos or picks them from the gallery and sends them whole into a tree of the research, with a
  note and the person they show — as "Add materials" in the Strom app does. A photo stays on the phone until the
  computer has it, so a connection cut midway loses nothing.
- **The research watched from a phone.** The phone's page shows what the research does — what is worked on now,
  what waits for a decision, the last 24 hours and the latest changes, refreshed every 10 seconds while the page is
  looked at — only to look at: nothing on the phone answers, starts or decides anything. A computer out of reach is
  said, with the last data and their time. The page opens the tree whose QR code paired it, and it can be added to
  the home screen as an icon that opens it without pairing again. What waits and the changes read whole on the phone:
  no text of what waits is cut, more of it than the first 20 comes on a tap, a change of many lines unfolds whole;
  What waits is the last part of the page. A change older than today has its date beside the time (the year only when
  it is not this one). Finds, under Now, say what the research found since the phone looked last (the last 24 hours
  at least, older ones on a tap) — new people, sources, facts found, corrected or newly cited, conflicts resolved —
  the new ones marked; something new while the page is open shows only as a count in the tab's title and a small label.
- **A consent in one language, asked in the terminal too.** A consent only a person gives (unpacking a research,
  removing a tree, a window said no to) is said whole in the research's language. What opens the computer outward,
  costs money or runs another's program — Remote Control, downloaders without asking first, the condition of the agent
  working alone, a hook, an archive's own pace, the phone connection, tuning the reading — asks yes or no in the
  terminal as well; Enter says no, `--yes` never answers it. When `strom update` is declined, it says nothing was
  installed and which version stays, and ends with an error code; a failed install is said in the research's language
  too.
- **A wrong name or note taken back.** `strom name retract` takes back a name misread or given to the wrong person,
  `strom note retract` a note, and `strom note edit` corrects one — of a person, a fact or a task, each with its
  reason; nothing is deleted. What is taken back is shown nowhere any more — not to the agent, not in the GEDCOM or
  `strom find`, so the Strom app no longer shows it once it loads the tree, and a sync never brings it back; `strom
  person show --history` says what it was, when and why, and `strom name restore` or `strom note restore` puts it
  back.
- **Fixes from reports.** The menu's goodbye says how to start strom again where the terminal window does not know the
  command yet (after the one-line install: `strom` in a new window, the full path in this one; the full path also
  where another `strom` answers the name first), and says when the Strom app's bridge goes on running and how to stop
  it; the menu's choice of a family tree goes back with 0. The bridge no longer holds the family tree's folder, so
  Windows can delete it, and ends by itself once the tree is gone (`strom trees remove` deletes a tree). An end of the
  tree where the baptism names no father is a closed end once nothing runs on it, no longer waiting for a decision for
  good. A source renamed in the Strom app is renamed in the research too, and a source's call number or page reaches
  the app on the source itself, also before anything cites it. With `excerpts.for all` a source nobody cites yet gets
  its excerpt in the Strom app too, wherever it fits under the limit beside the cited ones, which never get smaller
  for it; what did not fit is said.

## 1.17.0

*2026-10-19 · goes with the Strom app 3.13.1.*

- **What hypotheses would connect, first.** The tasks to fill in what the variants of an open hypothesis would
  connect go first in the queue — also in an existing research after the update — so the Strom app can show those
  links soon.
- **The Strom app's bridge runs while an agent works.** The bridge no longer ends after two quiet hours while an
  agent works in the tree (a paused run too), so the Strom app sees the research at work even in a tree it does not
  follow. A bridge that ended for quiet comes back at its address when work starts again; one stopped with
  `strom live stop` stays stopped.
- **An interrupted download is said and tidied.** A download whose process ended midway is reported as interrupted,
  with what was saved and what is missing; its work folder is cleared away.
- **New material reported in the research's language.** What came in (registered material, what was added, likely
  duplicates, married names, tasks) is said in the language of the research.
- **Counts as the language says them.** Texts count in the forms of their language: 1 task, 2 tasks, 5 tasks — in
  Czech 1 úkol, 2 úkoly, 5 úkolů, in German 1 Änderung, 2 Änderungen — instead of "task(s)".
- **More in the research's language.** The people without a record of their own (`strom person list --unproven`,
  where `strom check` points), what `strom export gedcom` wrote and a counter warning of `strom check` are said in
  the research's language, their counts too — the size and quality of the images as the language writes them (in
  Czech 0,4 MB · kvalita běžná).
- **Saving on Windows waits for an antivirus.** A file written while an antivirus or the search indexer briefly holds
  it is saved — or read — after a short wait instead of failing. A file held longer stops the command as a whole,
  with nothing of it half saved, and the message says another program holds the file and the command can simply run
  again.
- **Errors for an agent in English.** What an agent reads is English whatever the research's language; a person at
  the terminal or in the menu reads it in the research's language as before.

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
