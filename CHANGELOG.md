# What's new in Strom Research

English · [Čeština](CHANGELOG.cs.md) · [Deutsch](CHANGELOG.de.md) · [Polski](CHANGELOG.pl.md)

The changes of each version in short. The full notes and the install lines are on
[GitHub Releases](https://github.com/ACiDekCZ/strom-research/releases).

## 1.30.0

*In preparation: the betas up to 1.30.0-beta.3. The section is complete with the release.*

- **Facts checked against their originals.** A birth, a baptism, a marriage, a death or a burial that cites its
  original record but stays probable or possible is verified by the agent against that original: it looks at the scan
  and either raises the fact to proven or writes down why it stays as it is. An older research is gone through once
  after the update (only people linked to the family tree, nobody living; `strom fixes undo verify-originals` takes it
  back), new facts as they come. By hand for a person, a family or one fact, first in the queue (`strom verify facts
  <whom>`, or from the Strom app); in bulk for a line, a lineage or the whole tree with an estimate of the cost – started
  by the user alone (`strom verify bulk`); stopped by `strom verify stop`. A fact the user confirms against the scan in
  the Strom app the agent never changes – it only proposes. A value the user entered or one from a family tree is never
  overwritten: what differs is a proposal for the user to decide. How many facts wait is said by `strom check`, `strom
  doctor`, `strom stats` and `strom verify status`.
  A confirmation in the Strom app holds for the value the user saw: a fact changed since is not confirmed.

- **Values from an imported family tree are guarded.** A tree from another program (GEDCOM) gives leads: the agent
  changes such a value only by a record it cites, and the value from the family tree stays kept beside it ("originally
  from the family tree: …") and can be put back (`strom event revert`, `strom person revert`). Without a cited record –
  and always when the user decides the hypotheses – the agent only proposes, as a conflict for the user to decide. What
  the user entered or changed, in the Strom app or in strom, the agent never changes: it only proposes – nor through a
  file it brings in with `strom sync`. The agent's proposals are told apart in `strom conflict list` and `show`, and
  close by themselves once the value proposed holds. A research made before is marked once after the update (which
  values came from an imported tree, which are the user's): no value changes, and `strom fixes undo origins` takes the
  marks back. A proposal whose value has changed since it was made (the user edited it) is out of date: it cannot be
  taken – nothing is written over the newer value – only closed keeping the value. What a proposal cannot carry (a cause
  changed together with a date) is said in the sync's result, never lost.
  A value that came with the family tree from the Strom app and nobody has changed since is guarded as the user's own.

- **A family tree imported again finds its people.** The IDs a program gave its people and families (MyHeritage's,
  Gramps', FamilySearch's and others' `_UID`, `EXID`, `_FSFTID`…) are kept: a tree of the same program taken in again
  (or into the research from another program) finds the people by them – never twice, the new facts added as leads; a
  newer file of the same program's tree with a name, sex or birth date changed there finds the same person, what differs
  added as a lead beside the research's and said; a person only maybe the same (another program's file, another ID of
  FamilySearch) is said, never joined and never put into a family where the one they may be is already, and `strom
  check` names two people with the same ID of a family tree to compare and merge. The IDs go back to the
  Strom app with the research. What the file has that is not taken (media, the program's own tags) is counted in the
  result. In a research made before, the IDs of its earlier imports are read from their files, so the
  same tree taken in again before the marks are set adds nobody twice either.

- **A problem reported in one file.** `strom error` packs what is needed to tell what happened into one ZIP in the
  downloads folder (else the current folder): the version, the system, `strom doctor`, the agents, the connectors, the
  bridge to the Strom app, the research in numbers only, the technical logs of the last 7 days (`--since`) and the
  commands that ended with an error. Nothing of the family tree goes in – names, places, notes, transcripts, images,
  paths with the user's name, logins and tokens are left out or masked to stable codes – and nothing is sent: the user
  sends the file, to the address the command says. `--about fetch|sync|agent|install|windows` adds the details of one
  area (the table is in `strom error --help`), `--where` says where the problem happened, `--note` says it in the user's
  words; the data of named people, families or a book only with `--with-data` and the user's yes. Asked to report a
  problem, the agent asks where it happened, runs it and tells the path – it never sends, opens or copies the file. In
  the menu: Maintenance → Report a problem. The research is only read, a broken one too.

- **The file for the Strom app is written for a research with a hypothesis decided with its reasons** again: for the
  app from 3.25.0 (or of a version unknown) `strom export gedcom` refused it and `output/tree-strom.ged` after a session
  stayed as it was (the research opened in the app through `strom app` was never affected). **Following a large
  research live in the Strom app opens much faster:** the tree for the app is made once for each state of the research
  and kept, also when the bridge starts again, and while the app follows, a change is told once its tree is ready.
  The bridge no longer ends when the research's disk is away for a moment, and a second bridge started for the same
  research ends at once instead of running on unseen.
  An app that has the newest tree already is sent nothing again.

- **A fact shown or edited at the terminal** (`strom event show`, `strom event edit`) is said in the research's
  language. In the Strom app, a family tree taken into the research no longer gives the first line of it as the
  reference of the whole tree: each fact says its own.
  **Family trees from Windows programs in code page 1250 or 1252 ("ANSI")** are read with their letters right – Czech,
  Polish, German, as the Strom app reads them. A character that cannot be read is said, never replaced silently.

- **Codex in the ChatGPT app, said as it is.** The setup there no longer speaks of Codex's hooks (that line is for Codex
  in the terminal), and `strom doctor` says to confirm them in the terminal alone. The ChatGPT app's browser runs
  through ChatGPT's cloud and calls no rule of strom's: strom no longer says it watches it, and the agent working there
  goes to an archive with restrictions only through the person (`strom task wait --images`). `strom doctor` and the
  setup say so as a warning, with the advice for ChatGPT's "cloud browser" dialog at such an archive: *Deny*, never
  access to all relevant sites. Codex in the terminal stays watched – now also its browser opened through
  `createBrowserTab`.

- **A download of a book's images that its connector stops on an error** says which images it did not fetch and the
  command that fetches them (only those – what came is not asked for again), ends with an error (it said success), and
  `strom fetch --status` and the brief tell what is left; a download an archive refuses part-way ends as before, with
  its own advice. **A transcript confirmed in the Strom app shortly after midnight** carries the new day, by this
  computer's calendar (it said the day before).
  **Building a connector:** `strom connector test` warns when one image costs many requests (tiles) and says what to
  look for first – the portal's link to the whole image, or the download of a whole book – with the time a book would
  take at the archive's pace; `strom connector new` quotes what strom knows of the archive's terms.

## 1.29.0

*2026-11-08 · goes with the Strom app 3.25.0.*

- **Who decides the hypotheses: the user, or the AI.** A new setting of the research (`strom config set hypotheses.decide`,
  the setup's question beside the other choices, Settings in strom's menu, the Strom app's research settings): *the AI decides*
  or *the user decides*. With the AI deciding, the agent decides a hypothesis itself once a cited
  record supports one variant, with the variant and its reason; it never overturns the user's own decision, and a branch
  of ten or more people off the tree it joins only on two sources with nothing against them – otherwise it proposes.
  Each of its decisions is marked as the agent's, listed among the changes and changeable at any time; switching the
  setting changes no decision made. Where nothing is chosen, the AI decides – in a research made before too; back to the
  user deciding: `strom config set hypotheses.decide person`. strom's setup recommends the AI's deciding and offers it
  first, *the user decides* chosen there is kept; once the user decides, only a person turns the AI's deciding on again,
  with a second yes.

- **Every hypothesis can be decided from the menu.** With the user deciding, what waits offers also the open
  hypotheses without the agent's proposal – decided with a variant and a reason, or left open; with the AI deciding
  (the default) it offers only the agent's proposals. From one person's review and from a link of the Strom app any
  hypothesis can be decided, whoever decides, and a decided or set-aside hypothesis can be decided again with a reason,
  the earlier decision kept readable. With the user deciding, the agent proposes a decision wherever the records point
  to one variant.

- **The research in the Strom app stays on.** The bridge to the Strom app no longer ends by itself after two hours with
  nobody asking: it runs until it is turned off or the computer goes off (`live.idleMinutes` 0 by default; a value set
  before stays). The Strom app gets a switch for each research and a choice in its settings – until the computer goes
  off, or after two hours with nobody asking – both written through the bridge. Turned off in the app, the bridge stays
  off (new work in the research does not bring it back) and keeps its address, so turning it on again – from the app
  through a link of strom, or with `strom live start` – needs no new connection.

- **The agents' desktop apps watched as the agent in the terminal is.** The built-in browser of the agent's app keeps the archives' terms as
  the agent's browser in Chrome does: an archive that lets in only a person's browser without the person's yes is
  refused with the same advice, an allowed one is recorded and kept to its pace; local pages are left alone. strom's
  commands typed into the app's own terminal follow the same rules as in the shell (what only a person does, the bridge
  of the Strom app); the agent is told to run strom through its shell. Nothing of the app is switched off. The app's
  terminal knows strom under any of its names – another channel's, a second installation's, the package through a
  package runner, a path to it. Codex's browser (in the ChatGPT app) keeps the same rules by the addresses its code names,
  once strom's hooks are confirmed in Codex – `strom doctor` and `strom chat` say when they wait; code naming no address
  is never refused, only recorded. With them confirmed, an archive that lets in only a person's browser opens to Codex's
  browser too with the person's permission "through the browser", as to the agent's browser in Chrome (`strom net web --check
  --browser`, `strom doctor`, the brief, the Strom app); unconfirmed, as before. Computer use stays unwatched. What strom watches in each agent and app: `strom doc R12`;
  an agent with computer use is told to drive the Strom app through a browser's page tools and the research through strom.

- **The agent's desktop app without the agent in the terminal.** strom now says what goes and what does not: the conversation in the app
  goes on, while working alone, reading scans and the work from the Strom app need the agent in the terminal – said
  before any question or estimate of the cost. The settings and `strom doctor --fix` offer to install it (it can be
  declined); `strom doctor` tells the browser in a conversation from the browser of a run alone. A conversation without it
  reads scans with strom's own scan reader.

- **A source counts as read by the user only when the user read it, and a fact is proven only from the original
  record.** A transcript typed by hand at the terminal, or confirmed in the Strom app, makes the user its reader; what
  imports, conversions and batches wrote under the user's account no longer does. A fact is proven only on a cited
  original record with primary information; one without it becomes probable, the reason kept in its history, while one
  the user made proven stays and waits in What waits to be kept or made probable (`strom fixes review proven-originals
  keep|lower`). Existing researches are set right once by themselves, listed among the changes (`strom fixes undo
  readers|proven-originals` puts it back). A GEDCOM of another program never makes the user a reader nor a fact proven.
  A confirmation in the app holds for the wording it was given to and can be taken back there; on an original record
  with primary information a fact may then be proven, otherwise at most probable.
  **A transcript the user read or confirmed is the user's.** Nothing but the user's own terminal or the Strom app
  changes it – whatever the command (an edit, a batch, a sync, a fix, an undo, an import). An agent's other wording is
  proposed instead: a note at the source and one task for the user per source, which no agent takes or closes;
  decided in What waits, through a link of the Strom app or in the app – the proposed wording taken as the user's, or
  the transcript kept and the same wording never proposed again; either decision can be taken back (the earlier
  transcript with its confirmation back, the proposal waiting again).

- **Each reader of a document with its own agent, model and effort, and a source read again from its original.** `strom
  document read|again --agent/--model/--effort` (and `--blind-…` for the blind reader), or the choice in the Strom app;
  with nothing chosen it reads as the research's settings say, never with a cheaper model. The result says who read it –
  in the terminal, in the reading's file and in the Strom app. A source is read again from its original on this computer
  (`strom document read --source S… [--clip …]`, or from the Strom app), its readers never shown the transcript; the new
  reading is kept beside the source, and where it differs a task holds the two against each other – the transcript, who
  read it and the user's confirmation stay as they were. Excerpts of one image that overlap or touch are read as one
  view, and words of the transcript outside the excerpt read (a heading of the page above it) count as no difference.
  `strom fixes` takes a reading of two readers as its first reader's: a blind reader of another model is never an
  earlier model to read again with, and a reading one of whose readers read with today's model counts as read with it.
  Reading again from the original reads as well as it can. The readers are told what the research knows of the record –
  its kind, language, date and where it stands, never its transcript or a name –, and a reader with a GPT model also to
  transcribe the entry in the middle of the excerpt, to leave out the neighbouring entries at its edge and to keep the
  original spelling letter by letter. Only the source's entry (the one the reader marks, else the one most within the
  excerpt) is held against the transcript; column labels without a counterpart („Dies:“, „Vater:“), the research's own
  heading of the record, notes of the research or a reader in brackets, a long ſ against s, an illegible place against
  nothing and words outside what both read are no difference. The Strom app gets in the reading's result which entry is
  the source's, the blind reader's whole text, a warning when the readers took the record for different kinds (a
  marriage × a baptism), and when the comparison cannot be written to the research – a research sealed on another
  computer, say – it is said instead of left out silently. Readers with a GPT model (Codex, OpenCode) see a small
  excerpt enlarged to about 2000 px (at most three times), also where the reading of scans was tuned to a smaller size
  (the tuning measures whole pages and halves, never a small excerpt), the others as before; a registered sharper part
  of the image that shows the whole place – or the whole excerpt, only its margin left out – is used, and for a place small on its scan a sharper crop from the archive is
  offered – never fetched by itself. The Codex reader runs without the notice program, plugins, apps, hooks and memories
  of Codex's settings and without its app's browser and computer use; Codex's settings are not changed.
  A model the Codex CLI installed here does not have ends the reading as a reader that failed with that reason, and a
  run of strom stops with it: the advice is to update Codex (`npm install -g @openai/codex@latest`) or to choose another
  model; models of Codex's catalog fetched by a newer Codex than the one installed are offered with a note.
  A reading asked from the Strom app is accepted at once though its strom takes long to queue it (another process holding
  the research, say): it is said as queued under its ID from the first moment and read under it, and one that cannot be
  queued then is said as failed, with the reason; the same source asked again meanwhile is refused as being read.
  The choice of the research's model (the setup, Settings in strom's menu)
  names the model Opus, Sonnet and the agent's own default last ran on, where a research on this computer saw it
  run – "Opus (now Opus 5.5)"; `strom doctor` and the settings say it beside the model kept, and the Strom app gets it
  with the readers to choose from. Unknown, it is said as before. What is kept stays Opus or Sonnet, so a newer model of
  its line is taken by itself; a fixed version set by hand (`strom config set model.lead <model>`) is offered as chosen
  now and stays that version.
  A reading whose blind reader read nothing (it failed, or ended with no entry) is its first reader's alone, as a
  reading of one reader – never every entry said to differ. The Strom app gets with each place two readings differ
  what kind of difference it is – a matter of fact (a name, number, date, person, a place one cannot read) or a trifle
  (spelling, an abbreviation, punctuation, a label, letter case) –, and where each reader is: waiting, reading, done in
  so many seconds, or failed, and which reader it was whose model was refused.
  **A source read again: what follows is the user's choice.** A task arises only of a matter of fact both readers
  read the same against the transcript (a name, number, date, person, a word the transcript could not read) – never of
  trifles (spelling, an abbreviation, punctuation), of a place the readers disagree on or one marked as not legible,
  nor of a place an earlier task judged already. The task says who read (agent · model · effort), that two readers of
  the same model are weaker evidence, and that the reading is only a lead: the transcript is changed only where the scan
  itself shows it. A new setting `read.sourceTask` says what follows: *ask* (the default) – the reading is kept beside
  the source as not verified until the user chooses: go through it with the agent now, put it in the queue, or just
  keep it (in the terminal right after the reading, later with `strom source reading S…`, or in the Strom app);
  *always* – a task at once; *never* – no task. One source has one task of its readings at a time. A reading with no
  matter of fact to decide, only places its readers are not sure of, makes no task by itself – not even with *always*;
  on the user's word alone (`strom source reading S… --take queue --unsure`, or in the Strom app) the agent gets a
  task to look at each such place on the scan: the transcript corrected with its reason where the scan surely shows
  it, elsewhere a note at the source. A transcript the user confirmed is never the agent's to change: the places the
  new reading read are proposed to the user for review instead (`--take review --unsure`).

- **Also:** the help lists the values of every setting of choices and says what each choice of who decides the
  hypotheses means; `strom help --human` lists every command only a person runs. An archive's permission given in a
  research outside the folder of the research updates that research's agent instructions too, and a site given
  (example.org) covers the addresses of it the research's books use. The terms of the Central Archives of Historical
  Records in Warsaw as the archive answered: the scans used freely, each cited by the original's place – archive, fonds,
  signature, page or folio. A conflict recorded in a batch with a labelled source (`--claim "@s: …"`) now cites that
  source; one an earlier version recorded so shows its value without the raw label and, where it can be told, cites
  its source in the Strom app and the GEDCOM. A conversation that ended no longer stays at work in the Strom app, even
  on a busy computer or after the computer's name changed. A place written in a sentence ("v Lhotě v čp. 12") no
  longer keeps its prepositions: the check offers the municipality as the research writes it, and a place record no
  longer gains a name like "v Lhotě v" — such names already written are set right once (undo: strom place undo).
  **Overlapping excerpts of one image are one.** Two excerpts of the same image the research marked overlapping by
  30 % or more of the smaller one become one covering both (one lying nearly whole inside a larger one – a detail, an
  entry beside the whole page – stays); excerpts the user marked stay as they are. A research made
  before has its overlapping excerpts joined once, each logged; the transcript and the user's confirmation stay.
  **A task in the queue from the Strom app.** A link of the app to a task in the queue shows it (what, why, when done)
  and offers to go through it with the agent now (with what tasks like it took here), to put it ahead in the queue,
  or to leave it. `strom doctor` says why a dearer change of its tuning towards accuracy is kept, and Codex's hook
  file only missing or out of date is no warning – it is written again the next time strom starts the agent.

## 1.28.0

*2026-11-06 · goes with the Strom app 3.24.0.*

- **How Strom works comes with strom: `strom doc`.** The documentation of the app and the research, in Czech, English,
  German and Polish, is part of strom and reads offline: `strom doc` lists its chapters, `strom doc R10.1` shows one rule
  with why it is so, `strom doc <words>` searches its titles, its index of terms and its text (accents and case aside).
  Each rule carries its link to the same page on stromapp.info. Asked how or why Strom does something, the agent answers
  from it with the rule's number. A person's help (`strom help --human`) ends with it.

- **Only the user decides a hypothesis.** The agent no longer decides between competing explanations itself: it proposes
  a variant with its reasons, and the hypothesis waits in strom's menu under What waits, to be decided as proposed,
  otherwise, or left open. What the decision connects, the agent records on the tree in its next session. Hypotheses
  decided earlier stay as they were. A hypothesis whose variants say what they would connect is decided only with the
  variant named.

- **An index is a lead, never proof.** A fact that only an index cites stays a lead until the entry itself is read and
  cited, as with a family tree or a memory.

- **A translation beside the transcript.** A record in another language or script than the research's – Latin, German
  Kurrent, Polish, Cyrillic – gets a translation into the research's language beside its word-for-word transcript.

- **Where the agent works, for the map of the Strom app.** While an agent works, strom tells the app which place the
  book it examines belongs to – the parish or village of its records, never the archive – so the app can show it on the
  map when following the work. When the research does not know it, it says nothing, and the app keeps to the person's
  own places. Work on a family names the couple – the husband, else the wife – and the family itself, so the app can
  turn to the pair.

- **DigiArchiv of the regional archive in Třeboň:** its terms as the archive confirmed them – selected images saved by
  hand only, never a whole book, no download tools – and how to cite an image's permanent link.

- **The list before a run shows what the run takes.** Under Let the agent work on its own, the tasks listed in the order
  the agent takes them now include the tasks of the history of the places in their turn – the places of the facts to
  map come first – marked as history.

- **The condition of a run in one line.** What the condition (`run.gate`) answered, how it is asked – before each
  session, once for tasks started by hand – and its cap are said in one line before the first session, not in three.
  An agent that reads web pages through its own helper is no longer reported as missing its web fetch; a tool
  really missing is said in the research's language.

## 1.27.0

*2026-11-05 · goes with the Strom app 3.23.0.*

- **Images saved by hand bring their task back by themselves.** Where an archive's images are saved by hand – an archive
  only a person's browser reaches, or one whose terms allow nothing else – the research asks for its book and the
  numbers of its images, and makes a folder for them in the inbox. What is saved there is taken by itself: at once while
  the bridge to the Strom app runs, else when the next session starts; files named otherwise are taken by their order
  when there are as many as images missing. The task comes back to the queue once all its images are there; with a part
  of them, What waits says how many are saved of how many and which are missing. A book of such an archive is no longer
  treated as free to fetch, and the research no longer offers to build a downloader for it – books and waits from
  earlier versions included, with nothing rewritten.

- **What waits is answered from the Strom app, and the images a task waits for are sent from it.** An answer written in
  the app brings the task back to the queue just as one typed in the terminal, kept whole and marked as given in the
  app; a task that has waited for something else since the app last looked is left as it is. Scans a task waits for go
  from the app straight to that task: numbered by the image the app names, else by the file's name, else by the order of
  those missing; a PDF page by page. A scan at a number the research has already is refused unless it replaces it – the
  one before withdrawn and kept, never deleted. A scan the same as another image taken already is refused, saying which
  one it is the same as; nothing is taken. They are taken the same way as images saved by hand, and the task comes back
  once all of them are there. A site with one book of its task shows its folder too, and how many images it has. The
  sites of one archive – such as the digital archive and the reading room of one regional archive – wait in one place
  under the archive's name, with its address.

- **The agent keeps off the bridge.** What the Strom app sends through the bridge is the person's own. The agent's
  hooks refuse a command or a web fetch that reads the bridge's address or calls it, and the agent is never told the
  secret address.

- **The agent's browser keeps the same rules as its web fetch.** Each page the agent opens in Chrome is counted and
  paced together with its other requests to the same site; a site whose terms forbid automation, one that refused, a
  path its robots.txt keeps off and the bridge stay closed to it. An archive only a person's browser reaches opens to it
  only with the person's permission "through the browser", one page at a time at a person's pace. The Strom app's
  Permission… at what waits for such an archive's images opens this question, also where no downloader reaches the
  archive. The browser or computer use of another agent – Codex, Antigravity – has no such check: the agent does not
  take it to such an archive on its own, and the person saves the images by hand. `strom doctor`, the agent's brief and
  What waits say once which agent and browser extension would let the agent save them itself, or that the extension is
  missing. Nothing is switched off: the browser and computer use of the agents' desktop apps the research does not
  watch, nor does it recommend them – it watches the agent's browser in Chrome, and the agent uses another only when the
  person asks for it explicitly. `strom doctor` and the agent's brief say so in words, and the agent is told never to
  work in a copy of the research an agent's desktop app opens in a worktree of its own. The Strom app learns from the
  bridge whether the agent's browser is ready, the extension is missing, or the agent has none the research keeps.

- **The agent's browser saves the images itself, one at a time.** Where the person allows an archive only a person's
  browser reaches "through the browser", the agent opens one image in Chrome and saves what the archive's own viewer
  shows – never more than the viewer gives, never larger than the original, at a person's pace. It saves only the image
  the tab shows at that image's own address – a viewer paged on to another image is refused, nothing saved. The research
  takes the saved file from the downloads folder into the task's folder under its number, and the task comes back once
  all its images are there. The permission can now be given for such an archive of the research's list that no
  downloader reaches. A downloader built for an archive whose viewer shows the images in tiles saves them through that
  viewer as well, a part of an image included, with the book's page opened once and never reloaded. A check whether a
  person is there is never passed by the agent. An archive whose robots.txt keeps every robot off the whole site counts
  as one only a person's browser reaches. What strom's list keeps for a person's hand stays saved by hand – a path of
  the records its robots.txt closes to every robot, AI agents kept off by name (as at the eBadatelna of SOA Praha),
  terms that allow nothing else, or a viewer that shows the images from an image server closed to every robot.

- A condition of the agent working alone that would not start tasks started by hand is said once, then only "Start
  anyway?". The gate of the subscription's week says the week's use against the most allowed by now, and how it is
  counted. `strom help --human` lists the order of tasks, work off the lines, fixes and leaving a conflict among the
  person's own commands. OpenCode's research goes on after a session it closed properly but reported as failed, and
  after a passing network error – the same session resumed after a short wait, within the session's time. Codex kept
  away from strom by its sandbox – also in a pipe, and on Windows with a command said through PowerShell – or a strom
  command its own rules refuse before it runs (on Windows strom in a pipe or after `;`) stops the research at once with what remains the person's choice, and such a session never puts its task aside. Thanks for the
  report on GitHub.
  A change the research made by itself in reading the scans, after which the readings got clearly less sure, is taken
  back at once – no longer only after 60 days – and `strom recent` says so.

- More archives of Czechia, Germany and Poland are known with their terms – what each allows automated tools, its pace
  and what only a person's browser reaches. Among them now the city archives of Brno and Ostrava, the Military Central
  Archive, Arcinsys of Hesse, of Lower Saxony and Bremen and of Schleswig-Holstein, the Bundesarchiv's invenio and its
  memorial book (only a person's browser), AGAD's galleries of the registers of the former eastern territories, LubGens
  (only a person's browser) and the indexes of Polish genealogical societies. Five more of Czechia only a person's
  browser reaches: the Acta Publica of the Moravian Land Archives (its images no longer through a downloader, even with
  a permission given before – kept as given; through the browser at least 4 seconds apart), the eBadatelna of SOA Praha
  and the image servers of SOA Litoměřice, ZA Opava and the National Archives' police registrations (by hand only). The
  digital reading rooms of SOA Litoměřice and ZA Opava show their images from those servers, so their images are saved
  by hand too – no permission "through the browser" is offered there. A task waiting for such images already is said
  only to wait for the images saved by hand, with no new advice to wait. A downloader made earlier for such an archive
  is refused before any request, its probe too, and says what remains: the person's permission "through the browser", or
  saving by hand.

- With all of 1.26.1: a write cut short no longer blocks the research for good.

## 1.26.1

*2026-11-04 · goes with the Strom app 3.22.0.*

- **A write cut short no longer blocks the research for good.** A command stopped between strom's `git add` and its
  commit (ended by the agent, or git's index held by another program on Windows) could leave its files in git's index:
  every write after it ended with "data was changed outside strom", while `strom verify` and `strom repair` found
  nothing. The new files such a write leaves in the index — gone from the folder, never in the history — are no change
  of anybody's: the next write takes them out by itself and goes on. `strom repair` always puts the whole index back to
  the sealed state, a record's change left there too. A lock a git ended mid-way left (`.git/index.lock`, older than 10
  minutes) is taken away by `strom repair`, and a write refused by it says so. A record truly deleted or edited outside
  strom is said as ever.

## 1.26.0

*2026-11-04 · goes with the Strom app 3.22.0.*

- **The lines of the research from the Strom app: created, changed, paused, put in order.** A line is created or changed
  in the app (its person, direction, question, limits), paused, ended or taken up again; the order of the lines is the
  order of work, and the phone's page moves a line up or down and pauses it. Work off the lines – a side branch no line
  reaches, such as an ancestor's sister and her family – now comes now and then, one task in ten sessions, instead of
  only at the end. Each such branch can have a choice of its own (now and then, at the end, as the lines' work, never,
  or added to a line), and a branch that grows gets a line proposed in What waits: add it to a line, create a line for
  it, leave it as it is, or not research it. The husband or wife of an ancestor belongs to the ancestor's line, and a
  line asking a question has its person in it. Any task can be taken next or put at the end, and each task in the queue
  says why it stands where it does. In the terminal: Settings → the agent working alone → Work off the lines, `strom
  offline`, `strom task order`.

- **A story written again loses nothing.** When the research writes a story anew – more facts, a better reading, a story
  taken over from older work – each fact, source and link of the version before stays, or goes only on purpose with the
  reason, kept with the story. The sources a story rests on are shown with it, title and address under each fact, also
  where the text does not name them, and a source the text names only by its code among them; the Strom app receives
  them with the story. A fact told from a lead names in the text where it comes from.

- A big family tree taken in on Windows (some 1 500 people and more) no longer fails in git over a command line too long
  (ENAMETOOLONG) with nothing of it kept: everything taken in is written.

- On a large research (hundreds of tasks in the queue, much waiting) the Strom app no longer says the research does
  not answer while its agent works: the connection works out the state of the research once for each change, on its
  own, and answers the app at once meanwhile – also while it keeps its order once a day, finds strom's fixes, reads
  the history after each change and makes the overview for the desktop widget.

- A story or a note comes to the Strom app with its spaces as written: two between words, a no-break or a narrow
  space are no longer made one plain space.

- **What is the user's to decide stays the user's.** A disagreement between the research and an edit made in the Strom
  app, the approval of a story or of its new version, and the answer for a branch that grows are decided by the user
  alone – in the app or in What waits; the agent is refused and only says that it waits. Taking back what the app sent
  or a synced tree (`strom sync undo`) and throwing away a tree that waits are the user's alone too. The app's "Leave it
  to the agent" hands such a disagreement over; a side picked in the app is only confirmed in the terminal, a reason
  optional. Identifying places: "Don't know" also answers a disagreement about a place's position and a proposed form of
  its name, and "Always the first candidate (A)" moves a disagreement to its candidate too – never over coordinates set
  by hand. The terminal uses the app's words: lead, proven, disproven, Don't know, None of them, the same choices of a
  side. Such a disagreement an agent decided before is found by `strom fixes show edit-decisions` and opened again for
  the user, the agent's decision kept in a note (`strom fixes undo edit-decisions` puts it back).

- **The gate of the subscription's week takes whole numbers from 0 to 99 and holds its cap.** The menu and `strom
  config set` refuse a fraction or 100 (before, it was saved and every run then ended) and the menu keeps a cap that
  is set; under a cap a session at work is asked to finish when the week reaches the cap, not only at 99 %. A task put
  aside until a date comes back on that day, as its help now says. Images that arrive wake only the tasks waiting for
  that book – never a check of a site left to the person, and a letter only when it waits for that book.
  Tasks woken so before are found by `strom fixes show woken-waits` and wait again as they waited.

## 1.25.2

*2026-11-03 · goes with the Strom app 3.21.2.*

- **The gate of the subscription's week no longer ends a run over one answer it cannot read.** It asks again, then
  waits a quarter of an hour and says what it got. An agent not logged in is said before the first session, with how to
  log in; the agent's default folder named in the environment is left out, so the agent keeps its usual login.
- **Identifying places: a check writes what it finds into the place's record.** Old names and spellings, the facts'
  other forms of the place and a wrong parish (taken off with the reason) go into the record also where the coordinates
  are the person's, never only into the history. A form close to a place with a record already is refused with the way
  to add it to that record; two records of one place can be merged. Today's name comes first (a place now in Poland
  under its Polish name, the German one as historical). A question on a place never takes the person's coordinates
  away from them. The places identified before are set right once by themselves (names written with their language
  and years as text, today's name first, the person's coordinates, old names kept only in the history), and the step
  can be undone. A session on the places begins its summary with what it did — identified, verified, asked, not
  located — and takes more places of neighbouring areas at once. "in Lhota in no. 12" no longer leaves "in Lhota in" as
  a place: the place is the municipality as the research writes it elsewhere, also where the sentence declined it. Each
  name goes into a place's record once.
- **The queue of places empties as the places are done.** A place identified, checked, asked about or not located leaves
  the queue with every form of it, also one the facts write otherwise since; the places a session already did are no
  longer taken again, and the count of what waits is right. What an earlier version left in the queue is taken out by
  itself (only places dealt with, the step can be undone); a check asked of a place waiting to be identified is kept as
  the check, and a check waiting for a form the facts now write as another place goes with them to that place. Each step on places is undone by its own number, also while another waits (the person's answers among
  them). A wrong name of a place's record — a slip of a record no fact writes any more, another place's name — can be
  taken off with the reason (`strom place names L… --drop`); the session on the places sees the record's other names
  with their language and years; a check can name the reference it stood on; a jurisdiction can be given for one year.
- In the conflicts of an edit from the app a house that says it is one already no longer gets its marker twice ("nr domu nr
  domu 12" in Polish), and the title's dash is the one of the research's language.
- The plan of what the agent does next no longer fails on a couple's story waiting: it names the two partners.

## 1.25.1

*2026-11-03 · goes with the Strom app 3.21.1.*

- **The archives' terms checked again, Polish sources added.** The terms and robots.txt of every archive strom knows
  were read again on 3 November 2026. SOA Praha's eBadatelna now keeps every robot off its scans (its robots.txt of
  2 November): its images only through the person's browser, as Třeboň's archive, which now refuses strom's requests.
  Porta fontium's terms are quoted (a page at a time, for the person's own research, cited with its address). New:
  PTG's Skanoteka (a minute between requests), GenBaza, BaSIA, Genealogia w Archiwach, the
  Lithuanian Metrikai and the archives of Lviv, Zhytomyr and Rivne (behind a bot check or closed to AI agents: the
  person's browser only), Polona and the Silesian Digital Library (public domain), the Małopolska Digital Library (for one's own use, never copied in bulk), and for places in Poland the names
  of Geoportal's PRNG and the Słownik geograficzny, with their own search.
- **Polish texts set right; a copied command works.** The Polish menu, messages, installer and these notes were
  reviewed: the same terms everywhere as in the Strom app 3.21.1 (Księga rodu, en dashes), grammar and plurals fixed;
  dates read as the app writes them, without leading zeros (3.11.2026), a month named in the case its word asks
  for (przed majem 1880). The command `strom unpack "…"` shown after
  packing a research or before removing one now has plain quotes in every language, so it works when copied.

## 1.25.0

*2026-11-03 · goes with the Strom app 3.21.0.*

- **In Polish.** The research speaks Polish: the menu, its messages, what it writes into the research, the
  installer and the phone's page; the notes and roles of the Strom file are Polish. A Polish system is recognized by itself,
  otherwise `strom config set lang pl`. The agent's help stays English.
- **The Strom widget on Windows too, and it opens the person.** A research now writes what the Strom widget shows of it (what it works
  on, the finds of the last 24 hours, what waits) also on Windows, into `%USERPROFILE%\.config\strom\widget`, with a
  mark of the strom that wrote it. A widget reading its file never holds up the bridge. `strom uninstall` takes the
  widget's files too, on a Mac as well; the research and the settings stay.
  A line or a find of the Strom widget about one person opens that person in the
  Strom app (its page, the tree around it), what waits opens the research's "Waiting" (an app that cannot open them
  yet opens the tree as before).
- **House numbers after the name of a village.** Places written as the name with a number alone (`Lhota 16`) can
  now be set right too (`strom fixes run street-places`): the place becomes the municipality, the number its house —
  only once the person says, for each municipality on its own, that its numbers are houses, with the facts it changes
  shown first. Parts of a town with a number (`Praha 5`) are never offered. The answer is kept with the research and
  `strom fixes undo street-places` puts everything back.
- **Back in time.** `strom history back <change>` returns the research to its state after an earlier change: first
  what would come back and what would be put aside, then only on the person's yes in the terminal. Nothing is deleted:
  records added since are put aside, and the return itself can be taken back the same way. The link
  `strom-research://back` opens it for one change; the bridge's log says a return apart.
- **Identifying places.** The research identifies the places of its records (`strom place identify`, `propose`,
  `unlocated`): a place sure from its records gets its coordinates, names and parish over time; where it is not sure,
  it asks the person with up to three candidates, or says what would decide it. The questions wait in "What waits",
  the bridge offers them to the Strom app, and `strom place undo` takes back the last answer. A queue of places the
  Strom app asks to identify now runs in as many sessions as the person picks, each count with its time and price.
  Each name of a place says whether it is a form the records write or another name of the place (another language, an
  old name), and a name given both ways is kept once. The Strom file gives the Strom app 3.21.0 the identified places
  with their names, position and parish.
- **Kinds of history.** `history.kinds` sets which kinds of events the history of the places looks for (wars,
  epidemics, …). `strom history align` says first what it would hide, show again and look for, and does it only on
  the person's yes; nothing found is deleted.
- **Side branches last.** In a research of several lines, work that helps no line waits until the lines have nothing
  to do (`queue.offLine`: last, by priority, or never).
- **Updates without stopping the work.** `strom update` installs each version into a folder of its own, so a run or a
  conversation under way goes on with its version; older versions go at the next update or with `strom tidy`, and
  `strom doctor` tells of them. The bridge keeps answering the Strom app while it renews itself and while it makes the
  tree's file.

## 1.24.0

*2026-10-31 · goes with the Strom app 3.19.0.*

- **Places mapped once for every research on this computer.** A place another research here has mapped to its
  regions of history is taken over when it is surely the same place (the same name and the same coordinates, parish
  or district) and every research maps it alike; only the place's map crosses, nothing of the family. A place of the
  same name that is not surely the same is offered to the agent as a suggestion; the agent maps only the rest.
  `strom history adopt --dry-run` says what would be taken. The question about turning the events of history on or off
  says it holds for every research on this computer, and how to change it for one research alone.
- **The fixes of a research for the Strom app.** The bridge lists what `strom fixes` offers in the research (title,
  what it does, how many items, its state, whether it can be put back), free and without writing anything; the link
  `strom-research://fixes` opens a fix in the research's terminal, where setting it right or putting it back is
  always asked first.
- **The page of each scan in the Strom app.** The Strom file now gives each source the page of its scan in the online
  archive: the page of its first image, else the source's own address. The Strom app links it for the excerpts the
  file leaves out and for the sources without an excerpt. Only a public web page, never a recordset's address; the
  standard GEDCOM file keeps the address in the note. The date of the research's version in the Strom file carries its
  time too, so the app shows the day it was made also around midnight.
- **A person's own lineage from the Strom app.** Where the Strom app marks that a person founds a lineage of their
  own or carries none of the family's, `strom sync` keeps it in the research and the Strom file gives it back, so the
  next send and another device show the same lineages; a merge of two people keeps the mark. The standard GEDCOM file
  says nothing of it. It needs the Strom app 3.19.0.
- **A house number, an age and a period as they were written.** The word for a house number ("No.", "čp.") is put only before
  a number standing alone; a street with its number goes into the file as it is. An age of "05y" is read as 5 years.
  Both come back from the Strom app the same, no edit of the user's. A period the Strom app keeps ("1871/1882", or
  open at one end) comes into the research as from … to …, never as a date somewhere between.
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
