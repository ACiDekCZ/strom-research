# What's new in Strom Research

English · [Čeština](CHANGELOG.cs.md) · [Deutsch](CHANGELOG.de.md)

The changes of each version in short. The full notes and the install lines are on
[GitHub Releases](https://github.com/ACiDekCZ/strom-research/releases).

## 1.24.0

*In preparation: the betas up to 1.24.0-beta.2. The section is complete with the release.*

- **Places mapped once for every research on this computer.** A place another research here has mapped to its
  regions of history is taken over when it is surely the same place (the same name and the same coordinates, parish
  or district) and every research maps it alike; only the place's map crosses, nothing of the family. A place of the
  same name that is not surely the same is offered to the agent as a suggestion; the agent maps only the rest.
  `strom history adopt --dry-run` says what would be taken.
- **The fixes of a research for the Strom app.** The bridge lists what `strom fixes` offers in the research (title,
  what it does, how many items, its state, whether it can be put back), free and without writing anything; the link
  `strom-research://fixes` opens a fix in the research's terminal, where setting it right or putting it back is
  always asked first.
- **The page of each scan in the Strom app.** The Strom file now gives each source the page of its scan in the online
  archive: the page of its first image, else the source's own address. The Strom app links it for the excerpts the
  file leaves out and for the sources without an excerpt. Only a public web page, never a recordset's address; the
  standard GEDCOM file keeps the address in the note. The date of the research's version in the Strom file carries its
  time too, so the app shows the day it was made also around midnight.
- **A house number, an age and a period as they were written.** The word for a house number ("No.", "čp.") is put only before
  a number standing alone; a street with its number goes into the file as it is. An age of "05y" is read as 5 years.
  Both come back from the Strom app the same, no edit of the user's. A period the Strom app keeps ("1871/1882", or
  open at one end) comes into the research as from … to …, never as a date somewhere between.
- **The question about history says where it holds.** Turning the events of history on or off holds for every
  research on this computer; the question says so, and how to change it for one research alone.
- **A weak or refused model of the agent said by the doctor.** When no model is chosen for the research and the
  agent's own default is one the research found weak or refused for its work, `strom doctor` warns and gives the
  command to choose one; it never chooses itself.
- **strom from npm keeps its channel.** strom installed with npm stays on the channel it was installed from, also
  after a release; a channel chosen with `strom update --channel` is kept for it too.
- **A failed command takes back only its own.** A command that saved on the way and then failed takes back only what
  came after its save, so the research never looks changed outside strom. Where writing is refused because the
  research was changed outside strom, the person reads it in the research's language, with the way out that fits; an
  agent still reads it in English.

## 1.23.0

*2026-10-30 · goes with the Strom app 3.18.0.*

- **A person shown by the name chosen.** A woman born under one name, married under another and back at the first
  after a divorce can be shown by that name again without it being added twice: `strom name primary <person>
  "<name>"` (and `--clear`), or `strom name add --primary`. The choice is the user's alone, never read from a record;
  corrections, citations and the sync with the Strom app still go by the birth name. The Strom file marks the chosen
  name, the standard GEDCOM file gives it first. The Strom app 3.18.0 shows the person by it, and a name chosen there
  comes back with the sync.
- **The file for the Strom app without warnings.** Exporting for the Strom app warned of a non-standard tag on each
  person with a chosen name and on several marks of sources; the check now knows every tag of Strom's own.
- **A commit made with git on top of a research sealed with two keys (Windows).** `strom check` advised `strom repair`
  and never `strom repair` at once, and `strom repair` undid the work written with the terminal's key. `strom repair`
  now undoes only what was done outside strom, the work of both keys stays; then `strom seal adopt` in a terminal
  unites the keys — `strom check` says the two steps in this order. Started by an agent's desktop app packaged for
  Windows, `strom repair` leaves such a research as it is and points to the terminal; a write refused there points to
  the terminal too, no longer to `strom repair` first. After a commit made with git that changed no record, `strom
  repair` says it sealed the research again, no longer "nothing to repair".
- **The seal key also where an older strom looks (Windows).** A key taken over from the copy of an app packaged for
  Windows is now kept in `%APPDATA%\strom\keys` too, where a terminal's strom 1.22.1 or older looks for it: back on an
  older version, the research is still sealed on this computer. A key there already is never replaced.
- **A couple's story approved from the Strom app.** The question in the terminal now names the story of the couple,
  no longer of a person.
- **A couple's story proposed by the research.** Once records tell a couple's life together (their wedding or a
  child, and two more facts) and one of the two has a story of their own, the research proposes the couple's story
  as it does a person's — their life together alone (the wedding, the household, the homes, the children, the
  widowhood), the partners' stories referred to, never told again. A person's story written after it says the
  marriage in a sentence; no story written already is shortened for it. `strom config set stories no` turns these off
  too.
- **`strom repair` in one language.** Every line it writes ("restored", "nothing to repair", …) is in the research's
  language for a person; an agent reads them in English as before.

## 1.22.2

*2026-10-30 · goes with the Strom app 3.17.1.*

- **Strom from an agent's desktop app and from a terminal write to one research again (Windows).** An agent's
  desktop app can be packaged for Windows (MSIX), and every file a strom it started made in strom's settings went to
  the app's private copy: the app's strom and the terminal's each had a seal key of their own, and each refused the other's writes as
  made outside strom. The settings are now outside AppData (`%USERPROFILE%\.config\strom`), taken over from the old
  folder and from the app's copy by themselves (both left as they were). A research split so heals itself where it can;
  else `strom seal adopt` in a terminal unites the keys (the menu offers it once) — every record checked, nothing lost,
  never `strom repair`. `strom update` started from such an app installs nothing (only the app would see it) and says
  to run it in a terminal; `strom doctor` finds a copy of the program an app keeps for itself.
- **`strom repair` after a commit made with git that changed no record** (an empty one, notes only) seals the research
  again; before, the commit stayed unsealed, every write was refused and there was nothing to repair.

## 1.22.1

*2026-10-29 · goes with the Strom app 3.17.0.*

- **An event of a place is not written again for its region.** When the history of a place was looked for before the
  regions it lies in, the region's history could add the same event once more (the same kind, the same years). The
  region now leaves out what one of its places has already; an event that touched the whole region is still written.
  What the agent reads for a place also says which of its regions are not looked through yet.

## 1.22.0

*2026-10-29 · goes with the Strom app 3.17.0.*

- **Each name once in what waits.** A task for material sent from the Strom app named each person twice in the
  widget and on the phone's page (the second time in brackets), and its text without names kept empty brackets; the
  menu, `strom plan`, the Strom app and the GEDCOM file showed the name with its ID repeated. Each says the name once.
- **The widget opens the right research.** With several trees of one name in the Strom app, the widget on the Mac's
  desktop could open one of the others; it now opens the tree of its own research.
- **Much smaller session logs.** The logs of sessions and readers no longer keep the images the agent looked at
  (only their size and the view's path), so they are 95–99 % smaller.
- **Tidying that keeps up, a start that does not wait.** `strom tidy` handles logs of any size. Views of scans,
  downloads cut short and other things strom makes again are kept in order even without a yes; logs are only made
  smaller then, never removed. After a no, the question comes once more when `.strom` grows far beyond the research.
  Slow start on OneDrive or a network drive found and fixed: the menu and `strom doctor` no longer open every scan,
  return to the menu at once, doctor shows its progress and says when the research lies in a cloud folder or on a
  network drive; `strom doctor --timing` tells what took long. On a long research (hundreds of people, tens of
  thousands of scans) the menu shows what waits at once: its count is kept beside the research until something it
  stands on changes, and counted again in a fraction of a second.
- **An archive that stops answering stops the agent's loop; readers no longer wait out a silent service.** `strom
  fetch` says when to try again and what to do meanwhile; asked again in the same session it ends at once (exit 8) and
  sends nothing. A task whose archive is left alone waits out of the queue until then (the plan shows it put off until
  that time), and `strom run --loop` waits for that time instead of starting sessions with nothing to do. A reader
  whose agent goes silent after a retry of its service is resumed once where it stopped; still silent, it ends at
  once. Such a failure no longer makes the reading batches smaller.
- **The gate of the subscription's week lets several sessions run in a row.** Once it waits for points in hand, it goes again only
  with two more (at 15: 17), instead of one session after every wait.
- **What the ancestors lived through.** The events at the places of the tree — the history of a region from pages
  strom downloaded and checked itself, local events from the records read — shown by the Strom app. The first setup
  suggests it on; an installation set up before is asked once, at the first menu after the update (Enter: not now),
  and nothing turns on by itself. Only a person turns it on — then or later in the menu's Settings → The agent working
  alone → History, from the Strom app, or with `strom config set experiments.history on`; while it is
  off, nothing is looked for. The history of the regions and of the places are two switches, each also for one
  research alone (Settings → The agent working alone, `strom config set experiments.history|experiments.placeHistory
  on|off --for-tree`, or off from the Strom app) — a research's own choice wins both ways; with the places off, not
  even a place asked for is looked for. What was on before stays on for both, what was off for both. Once on, the
  places are mapped in the next session, and the regions are searched now and then between the family research's
  sessions: about every 5th (the default), every 10th, or only when nothing else is left
  (`strom config set experiments.historyPace`, the setup, the settings); `strom plan` says when, and all of them
  can go first at a person's word (`strom run --history`, the menu's "Look for history now"). The regions
  of the most people come first, a land before the state above it.
  Once a region's events are gathered, the years the tree's people lived there for more than 15 in a row with no
  event are looked through once more; years looked through are not raised again, in any research, until the region
  is asked for again.
  A region is searched only in the years the tree's people lived at its places (their facts there and five years
  around them; up to today only when the facts reach the last 30 years) — a few years at a war abroad are those years
  alone. When an ancestor found later lived there earlier or later, or another research shares the region, only the
  new years are searched, once. A region whose years none of the tree's people lived in (the facts at its places all
  lie before or after it) is not searched at all; the status and the Strom app say nobody of the tree lived there in
  those years. `strom history status` and `strom plan` show each region's years and what waits.
  What is shown is the person's to manage, in the Strom app or with `strom history`: an event hidden, or deleted —
  from every research on this computer, never written again — and restored; a region or a place skipped; a place's
  regions assigned by hand. `strom history list [--place L…] [--region <id>]` lists the events in the terminal: the
  years, the kind, the text in the research's language, the source, what is hidden or deleted.
  The history of a single place and its surroundings — fires, floods, battles nearby, the estate, the parish, the
  school — is looked for at a person's word (from a person's card in the Strom app), first at the next session, and
  kept for every research on this computer with that place. Each place with coordinates can be looked for by itself,
  the places of the most people first: Settings → The agent working alone → History of each place, by itself (off
  until turned on). An event asked for in a conversation is added by the agent from a page strom read, with its
  source.
  The stories take it as the background of their time: the events of the years each person lived at their places,
  each with its source, never as what the person did (a couple's, only the years both lived); nothing hidden or
  deleted. An approved story stays as it is —
  the history comes only with its next version, waiting for approval. Off in the settings or in the Strom app
  (`strom config set stories.history no`).
- **The forms of one surname.** `strom surname suggest` suggests which written forms of a surname are one family's: one
  person written so in the records (with the citations), or one sound spelled otherwise at one place in the same years
  — never the families of a woman's husband and her father; a reading mark after a name (`[?]`, `[!]`, `[…]`) is no
  form of its own. Only a person decides, in the terminal
  (`strom surname accept|reject|group`); an agent only suggests. The forms of one family widen the search of records
  and of people who may be one. `strom person compare` says of two people whether they are one, two or unsure, and why
  (merged already, a different sex, years far apart, a life that ended before the other began, other parents, one
  entry for both…). A finding marked no error stays so: `strom quality dismiss|undo|list`, the person's alone — two
  people marked so are never suggested as one again. `strom check` warns of an event or a marriage dated certainly
  after a person's death (an approximate date never), and the plan of a research raises a task to look into it, done
  by itself once the date is corrected or the finding marked no error. A participant of an event (a godparent, a
  witness) is a name, and what the record says of them goes in closing parentheses as the note:
  `--with "godparent:Jan Lhoták (sedlák, Lhota č. 12)"`; a name of more than four words or with a number is refused
  with what to put in the parentheses, a priest named as a witness is told to be the officiant, and a participant
  who may be one of the family around the entry is suggested by their number, never linked by itself. Names written
  so before are found by `strom check` and set apart by `strom fixes show|run participant-names` — free, by rules,
  in an archive too, all in one step, put back with `strom fixes undo participant-names`; only a person decides.
  A Strom app before 3.17 sends a period back as a range (from–to as between–and) and an age without its zero units
  (0y 2m 26d as 2m 26d); a sync took that for the user's edit — a disagreement, or a residence added as a lead beside
  the same one. Now an unedited tree comes back with no change; from an app that keeps them (3.17), a period made a
  range is the user's edit again, and an age of nothing (0y 0m 0d) is the same as 0y. What earlier syncs wrote so is found by `strom fixes
  show app-shapes` and set right by `strom fixes run app-shapes` — free, by rules, in an archive too, all in one
  step, put back with `strom fixes undo app-shapes`; only a person decides.
  A street is no place: a place written with a street or a house number ("Lhota, Lhotak Street 12") is refused on
  writing with the municipality to write and the street and number for `--house`, in any language and script; the
  history of places goes by the municipality, so places that differ only by their street are one. What was written
  so before is found by `strom check` and set right by `strom fixes show|run street-places` (the street to the house
  where it is empty or names the same) — free, in an archive too, all in one step, put back with `strom fixes undo
  street-places`; only a person decides.

## 1.21.0

*2026-10-26 · goes with the Strom app 3.16.0.*

- **"Waiting" says what the Strom app does not show.** The line in the menu and `strom plan` says how many of the
  waiting things are only here in the terminal and how many wait for a reply; the rest is the number the Strom app
  shows, so the two agree.
- **"What waits" puts the terminal's own first.** What only the terminal shows (a conflict of an own edit, a send of
  the app, a question about the reading of scans) is listed under "Only here in the terminal", the rest under
  "Also in the Strom app".
- **`strom input assign`, `hide` and `unskip` say what changed** in the research's language: each file, each task
  let go of or made, people by name, and how to take it back. Their JSON stays the same.
- **An overview of the research for a widget on the macOS desktop.** While the bridge runs (`strom live`), each
  tree's overview is kept in a file for a widget on the Mac's desktop: what is at work now, the finds of the last day
  and what waits, each text also without the names of people. Nothing is written off macOS.

## 1.20.0

*2026-10-25 · goes with the Strom app 3.16.0.*

- **The menu with nobody at a terminal says so at once.** Started where no one can answer (a closed input, a window
  without a terminal), the menu ends with one sentence in the research's language and what to do instead,
  no longer with an error of the program; a question whose input ends before an answer ends the menu the same way.
- **`strom check` speaks one language.** For a person every finding, the sum and the notes are in the research's
  language; for an agent all of it is in English, never a mix of both. It also says what this computer lacks: files
  of the shared folder not brought along (how many, the first, and to bring back the whole Strom folder), and files of
  a research in iCloud Drive not downloaded yet — said as that, never sent to `strom repair`, nothing written over
  them. A full disk is said alike everywhere, in the research's language with the folder whose disk it is; the
  bridge answers the app with `disk.full` (507) and `tree.not-downloaded` (409), and `strom live start` says why a
  bridge did not start.
- **When the agent's sandbox refuses git, the right place is named.** The message names the research's history (its
  `.git` folder) as the place refused, not git's own program.
- **A Strom archive starts no paid reading.** `strom read`, `strom clips` and `strom transcripts` are refused in an
  archive (and in a research waiting for its agent) with the one sentence the other refusals use; nothing is read
  and nothing written.
  Its texts promise nothing: material is "saved to the Strom archive" and the count is said, nothing
  more; a folder of more than 20 images offers to save them as family documents; the phone's page in an archive
  says "Save to the Strom archive"; the phone is in an archive's help. The help of an archive, and of a research
  waiting for its agent, offers only what works in it, with no tasks or queue; the how-to in a packed archive
  (`strom pack`) goes on in the Strom app. Nor does it announce a new task it never shows. **Its conflicts are decided in it:** an open one (the same fact edited differently in the Strom app and
  here) is said in the overview and in "What waits", decided there — the app's value or the archive's, and why —
  as the app's link decides it, and `strom conflict` is in an archive's help. `strom person show` of a person
  removed in the Strom app starts with that, the day and `strom sync undo I…` that puts them back; their relatives'
  listings mark them "(retracted)". **Two browsers on one archive:** a person removed in one is never written
  again as a new person by the other's older copy — untouched there, the removal stands and the app is told which
  send removed them; edited there, the edits are kept with them and a conflict asks whether they come back — a second
  copy that edited them otherwise is a conflict of its own against the first, never written over it, and once kept
  removed the same copy asks no more. An older copy without a person another window or the research edited since no longer
  removes them in silence: a conflict asks whether they go, and says who edited them (another copy of the app, the
  research, both); an edit taken back since (`strom sync undo`) counts for nothing, and once kept the same copy is only
  told so. Taking back the older copy's send after the person decided they go says they stay removed and how they
  come back (`strom conflict resolve X… --take research`). A send taken back (`strom sync undo`) and sent again from the app
  takes away again what it took away. Whether a person stays in the tree may be decided again: `strom history` says each
  decision with its own reasoning and whether the person left the tree or came back, and `strom conflict show` reads the
  earlier decisions in the research's language.
- **The backup before another version holds the shared folder too.** The shared images (scans, the Strom app's
  originals, the phone's photos) are linked into it where the disk can, taking no room twice, else copied; only
  when the disk has no room for that copy are they left out, and the backup says so; uploads of the app not yet whole
  and previews strom makes again stay out. **What to back up:**
  `strom backup` and Settings → Maintenance → "What to back up" name the one folder that holds
  every research and the shared images, with its size, or `strom pack` for one family tree.
- **`strom doctor` notices a network or redirected drive.** Where git cannot tell the folder it works in, the family
  trees there cannot keep their history; doctor now says so, as `strom init` does.
- **The family's material is put in order in the Strom app.** The people a photo or a document is of are added and
  taken off for many files at once, or for a whole batch; a file of nothing of the family, or the same as another, is
  hidden and shown again whenever needed — nothing is deleted. The app shows each file's title, kind and date
  (`strom input sort --title --date`) and small previews of photos, HEIC and PDFs, made once and kept aside.
  In the terminal: `strom input assign`, `strom input hide`, and `strom input unskip`, which also takes back a skip.
  Material added in the terminal or the menu to a family tree the Strom app has says where it is there: at the person
  → Materials.
- **A family tree from another computer, or moved by hand, is said — never replaced by another.** One sealed on another
  computer (or with strom's settings gone) reads, and a write says so in the research's language with the one step,
  `strom seal adopt`, offered by the menu, by the setup (which lists the family trees it found) and by a link of the
  Strom app, always on the person's yes; the bridge refuses the app's writes with `seal.foreign` (409). One no longer
  where it was is named with its old folder and the way to add the new one (`strom trees use <folder>`, remembered
  from then on); `strom app`, `strom live start` and every command refuse to open another in its place, and
  `strom trees forget` takes one no longer wanted off the list. `strom trees` and the bridge's `/status` say what
  each family tree is: a research, one waiting for its agent, or a Strom archive — for the app (`kind`) one waiting
  for its agent is an archive until an agent starts on it. An empty Strom app (its browser data cleared) asking for
  a new research gets the family trees already here offered first, to open one of them in the app.

## 1.19.0

*2026-10-22 · goes with the Strom app 3.15.0.*

- **An archive that went silent is waited for, not asked again and again.** When an archive stops answering, strom
  leaves it alone for an hour — two, then four when it stays silent the same day — and the agent hears until when:
  it goes on with other work, lets a download in the background wait for the archive (up to 30 minutes) and go on by
  itself, or closes the session to go on later. No more asking the archive over and over meanwhile.
- **The first tidy of an older research is offered once.** A research that gathered much beside it before strom kept
  order there by itself (logs of work sessions, views of scans and the like) gets one offer in the menu: what would
  go, how much and why, and nothing goes without a yes. After a yes it is kept in order by itself; after a no, the
  menu and the settings keep saying what can be freed. `strom pack`, removing a family tree and the menu say how big a
  package, a backup or the images are as everywhere else (1,5 MB in Czech, 24 kB for a small one), never "0.0 MB".
- **Digital libraries searched right at the first try.** For Kramerius of the Czech National Library and of the
  Moravian Library and for ANNO of the Austrian National Library, the agent gets the libraries' own search
  addresses — fewer failed requests and less guessing.
- **A part of a scan fetched sharper is read from.** Where a part of a scan came from the archive in more detail, the
  agent and its readers look at that place in it — also when the place they mark reaches a little past it, the rest
  said — instead of the whole scan, reduced; a sharper part that holds only some of the place is named with the way
  to look at it.
- **A document read more surely.** A reader writes its reading into its report as it goes, and a reading of two readers where
  only one read says so, never that they agree.
- **The phone connection waits for the research, not said as an error.** Before the research starts after the computer
  started again, `strom phone` and the settings say the connection is on and its server starts again with the research.
  On an iPhone the sheet of photos stays above the keyboard while a person or a note is typed, the persons offered in
  sight; the phone's server starts once, also when several start it at the same moment.
- **Fixes of strom's own mistakes, offered to decide.** When strom finds that an earlier version of its own did
  something wrong in a research, `strom fixes` and Settings → Maintenance → Fixes say what it is about, what was found
  and what a remedy would do, with how demanding it is; nothing happens without a yes, and a no is kept. The first:
  blind readings made from the reduced scan where a sharper part existed — read again beside the old ones, first on a
  few, nothing overwritten, a difference becomes a task. Held against each other by what was read — the names, dates
  and numbers of the transcript, not the words of the reader's comment (in German too, where every noun has a
  capital) — the task says in one sentence which of them differs; where a name may only begin a sentence, the readings
  are not said to agree. With nothing to read again, `strom fixes run` says so. The second: after the reading model or agent changed, the earlier readings worth reading again — with open
  places, readers who disagreed, an open conflict, a reading not confirmed at the source; said as "read by model X,
  now read by model Y", asked once per agent and model, each read again as it was read (the images of one reading
  together, a trial or a part always of whole readings). Counted in readings with their places and what a remedy takes
  in reader calls; offered by stage — the disputed alone (readers who differed, an open conflict, not confirmed at the
  source), with the direct line, or all — each with what it takes, the narrowest first, dates and witnesses only
  ordering them. The remedy may be read by another agent or model ready here (`strom fixes run <id> --agent <a>
  --model <m>`), with which one read before said; one that cannot read here is refused at once, with those that can.
  The time of a remedy is rounded up and, after the trial, measured again by the readings as they ran side by side.
- **A family tree strom may not write into says why.** strom writes Codex's rules into the research's folder: a strom
  command run on its own goes outside Codex's sandbox — on Windows too, where the sandbox kept the research's history
  closed and let nothing else run — while what the person decides and git itself stay forbidden. When an agent's
  sandbox still keeps strom from writing into the family tree's folder, strom says so and tells the agent what to do as
  it is there — run strom on its own, start Codex in the research's folder it trusts, or have the command approved
  outside the sandbox — instead of a bare "no permission" the agent retold as no access to the family tree. Where an
  agent leaves no mark of its own, strom knows it by its own mark on the agents it starts, or by the programs that
  started it, and names its sandbox as the likely cause, then OneDrive or the controlled folder access of Windows. A
  write the history refused is no longer said as missing rights to git itself, and a backup or an update that could not
  be written asks for a folder with the right to write in it, no longer to free room on the disk. `strom doctor` and
  `strom check` try writing into the research and say when it does not go, also where the folder cannot even be
  listed. On a disk without hard links (a network share, a drive redirected over Remote Desktop) strom writes again,
  its lock made another way, and a lock a slow disk does not show yet is no longer taken over after a moment; a family
  tree that cannot be created there leaves nothing behind, said in the research language. Installed with npm on
  Windows, `strom.cmd` runs strom where PowerShell refuses scripts.

## 1.18.0

*2026-10-21 · goes with the Strom app 3.14.0.*

- **Phone photos upright.** A photo turned by its EXIF orientation is read as it is meant to be seen, upright; the
  places marked on it (excerpts, the halves of a spread, a cut-out part) are of the picture as it is shown. The
  photo itself stays as it was.
- **HEIC photos and PDF documents can be read.** HEIC photos from a phone and the pages of a PDF are converted to
  JPEG for reading — on macOS, Windows and Linux — and the original is kept as it came. A HEIC photo goes to the
  Strom app as a JPEG excerpt. Where nothing on the computer converts a picture, one sentence says so and what would
  help; `strom tidy` clears the converted pictures away after 30 days or above 500 MB.
- **One document read at once.** `strom document read` reads a photo, a scan or a PDF of one document — a register
  entry, a letter, a deed, a gravestone, the back of a photo: the transcript word for word, its translation, what its
  old words and abbreviations mean, and the people it names, with who of the tree they may be. Nothing is filled in: a
  name the document does not have is left out — a surname too, never taken from a father or another family —, what
  cannot be read is marked; a second reader can read it blind. A
  document on a printed form, as a birth certificate, keeps its people — the child and both parents with their part in
  it, their names typed letter-spaced and a mother's birth name after "née" or "roz." too —, and a document read before
  shows them after the update with nothing read again. Each person and event it names comes with the place on the page
  where it stands, so the Strom app shows each its own excerpt. Nothing of it enters the tree by itself. A document read
  already says so, so it is not read a second time by mistake. A document read again is shown under the name of its
  file, never a code. A document sent from the Strom app finds the agent as the terminal does — one installed in a
  folder of its own, by npm or Homebrew too — instead of saying no agent is set up. Every agent the research works with
  reads it, with the model and effort set for the research.
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
  the app on the source itself, also before anything cites it. An emoji or another rare sign the Strom app's file
  damaged on its way (shown as ��) is no rename and no changed note: the research keeps its text. A place or another
  value longer than a line of the GEDCOM file (255 bytes) no longer stops the file from being written, and no emoji is
  split where a long line goes on. With `excerpts.for all` a source nobody cites yet gets its excerpt in the Strom app
  too, wherever it fits under the limit beside the cited ones, which never get smaller for it; what did not fit is
  said. The Strom app is told which images of a source the research has but its file left out, and loads them from
  the research on demand — a source at a time, or all at once with how many and about how big.

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
