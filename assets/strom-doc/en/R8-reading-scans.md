<a id="R8"></a>
# R8 Finding and reading entries in scans

How the research finds a book, gets its images, who reads the images and how what was read is recorded. Describes
the research 1.25.2 and 1.26.0 (reading the scans does not change between them). Each rule says what is **enforced by
the code** (the `strom` command does it or refuses the entry) and what is only a **rule of the method** (an
instruction to the agent that the code does not check). **Why** gives the reason as the method or the research's
code states it.

The procedure in brief:

1. **The book:** from the place and time the agent determines the jurisdiction (parish, civil registry office), the
   archive and the particular book ([R8.1](#R8.1)).
2. **The images:** downloaded only through the archive's downloader, at the archive's pace and under its terms, and
   only those needed. Where the archive does not allow automated download, a person saves them ([R8.2](#R8.2)).
3. **Browsing:** a book or a range of images is read by **readers** (`strom read`): separate agents with a clean
   context, each with a batch of images and the whole question ([R8.3](#R8.3)). strom tunes how reading goes by
   itself ([R8.4](#R8.4)).
4. **Own look:** every entry that will be cited the main agent reads itself, from a crop at full resolution
   ([R8.5](#R8.5)).
5. **Recording:** a source with a clip and a transcription, facts only from what was read with certainty, and the
   search even without a find ([R8.6](#R8.6)).
6. **Certainty:** the degree of certainty by who read the entry and how; a hard spot needs a second, blind reading
   ([R8.7](#R8.7)).

> **Note: reading by a model is not one hundred per cent.** Old handwriting is read by an AI model, and the accuracy
> of reading depends on the model. The method wants the strongest model for old handwriting, never fast or cheap
> reading. Readers read with the model for handwriting (`model.vision`, otherwise `strom read --model`), and the size
> of the views follows the model ([R8.3.2](#R8.3.2)).
> The size of views can be calibrated (`strom media calibrate`, confirmed by a person), and strom tunes reading
> separately for each agent and model ([R8.4](#R8.4)).
> Even so the model makes mistakes: in names, house numbers, dates and places. That is why a reader gives its
> certainty in per cent for each name, "illegible" beats a guess, a hard spot gets a blind second reading, different
> readings are a conflict, and the method wants Proven only after the main agent has read the entry itself
> ([R8.7](#R8.7)).
> **Principle of the project:** important facts should ideally be verified by a person as well. The Strom app shows
> the excerpt of the entry beside the transcript at the source ([A3.3](A3-evidence-in-the-app.md#A3.3)). A transcript
> checked by a person can be marked **Transcription verified** ([A3.1.1](A3-evidence-in-the-app.md#A3.1.1); how the
> research counts it: [R3.5.1](R3-verification-and-citation.md#R3.5.1)). A wrong fact can be corrected in the app;
> an edit of a fact backed by a record becomes a conflict ([S2](S2-edits-from-the-app.md)).

<!-- zdroj: research:assets/method/reading.md:3-8 · src/agents/profiles.ts:5 vision, :147 · src/commands/read.ts:214 --model · src/core/reader.ts:226 certainty · assets/method/verify.md · Milan 4. 11. 2026 (zásada ověření člověkem) -->

<a id="R8.1"></a>
## R8.1 The book first

Before anything can be proven, it must be clear where the records are. The agent determines the jurisdiction of the
place at the time, the archive and the particular book (record set) with access: an address or a reference number.

- **Method only,** in this order:
  1. the place and time determine the jurisdiction (`strom place jurisdiction L… --kind parish|civil|manor|district
     --from --to`). A place read only uncertainly gives no parish or book until it is certain ([R8.5.2](#R8.5.2));
  2. the archive (`strom repo add`, with its terms of use) and the book (`strom recordset add … --places --years
     --kinds --access --url`). The archive's downloader finds books by itself: `strom fetch <downloader> --find
     "<place>" --years 1780-1850`;
  3. a catalogue is used as a person would: a search or the page of one book, never walking record numbers one after
     another;
  4. where it was searched, even without a result, is recorded (`strom search add … --method web|catalog`).
- Indexes, catalogues and online trees are only a pointer to where to look
  ([R3.3](R3-verification-and-citation.md#R3.3)).
- Done when the book with access exists and the task of proving points to it (`--where B…`).
- **Why:** borders, parishes and names changed; a village could belong to different parishes in different centuries.
  Archives block walking record numbers. A recorded fruitless search keeps the next session from searching the same
  catalogues again.
- **Controls:** terminal (agent).
- **Since:** research 1.0.0

<!-- zdroj: research:assets/method/locate.md:1-34 -->

<a id="R8.1.1"></a>
### R8.1.1 An index before browsing

- **Enforced by the code:** when a book is to be browsed image by image (`strom read`, `strom fetch`) and an index is
  known for the book's parish, years and kind of record that nobody has searched for it yet, strom names it before
  starting anything, with the command that reads it.
- **Limits:** from 30 images; a different threshold (or never) is set by a person's answer to the question
  `index.first` (`strom media calibrate --questions`). In a conversation it only says so; in a `strom run` session it
  refuses the reading until the agent gives `--no-index`.
- **Why:** according to a comment in the code, from roughly 20–40 images an index pays more than browsing. A case from
  real research: readers read 61 images of a marriage book while the parish index lay downloaded.
- **Since:** research 1.14.0

<!-- zdroj: research:src/core/indexfirst.ts:1-28 INDEX_FIRST_DEFAULT · src/commands/read.ts:217 --no-index, :265 guardIndexFirst -->

<a id="R8.1.2"></a>
### R8.1.2 A lesson about a book

A peculiarity of a book, an archive or a place is recorded on it as a lesson. Whoever works with the book next time
sees it.

- **Enforced by the code:**
  - a lesson is one sentence, at most 200 characters; of a longer text the beginning forms the lesson and the rest
    goes into the details (at most 2000 characters);
  - a lesson belongs to a book, an archive or a place that exists in the research (`--on B…|R…|L…`);
  - a task shows the lessons of the books it searches in (`strom task show`).
- **Method only:** this is where a book's calibration belongs, two years per page, a hand that writes 7 like 1. A note
  in a task or in the diary is not such a place: nobody would see it at the book.
- **Why:** a book's peculiarity should be seen by everyone who opens it next time (the method “Lessons belong where
  they apply”).
- **Controls:** terminal: `strom lesson add "<poučení>" --on B…`, `strom lesson list`, `strom lesson edit`.
- **Since:** research 1.0.0

<!-- zdroj: research:src/commands/analysis.ts lesson add (LESSON_MAX, --on repository|recordset|place) · research:src/core/model.ts:732 LESSON_MAX=200, LESSON_DETAIL_MAX=2000 · research:src/commands/tasks.ts:354 taskDetail lessons · research:assets/method/core.md "Lessons belong where they apply" -->

<a id="R8.2"></a>
## R8.2 Images only through a downloader

Images from an archive are downloaded only by strom, through that archive's downloader (connector) and at its pace.
The agent never downloads by itself: not by a command, a script or its own browser.

- **Enforced by the code:** every way to an archive follows the strictest known level of its terms:

| Level | What strom does by itself |
|---|---|
| allowed | catalogue and images, at the service's pace |
| restricted | catalogue; images only with a person's permission for the archive: slowly, or through their browser, otherwise by hand |
| by hand only | catalogue; images only by hand |
| forbidden | no automated access |
| unknown | as restricted |

- **Limits (enforced by the code):**
  - the level is the strictest of: the downloader's reading of the terms, the archive's record in the research, the
    terms shipped with strom, the strictest level strom has ever seen at the server, the robots.txt file and a refusal
    by the server;
  - only a person may make an archive milder, give permission and accept a milder reading by a downloader; an agent
    may only make an archive stricter;
  - pace: without a figure from the service at least 2 s between two requests to a server. With the permission
    "slowly" at most one image in 10 s and at most 120 an hour (a person's pace), unless the person set their own for
    the server; strom never makes it faster.
- **Method only:** download only the images the task reads, never a whole book "just in case". The book is downloaded
  by the session that reads it. An archive without a downloader: the agent builds one (`strom connector new`) by the
  portal's terms and robots.txt.
- Images that the archive does not allow to download automatically are saved by a person into a prepared folder
  ([R6.2.1](R6-awaiting-action.md#R6.2.1)); an archive's permission: [R6.3.1](R6-awaiting-action.md#R6.3.1).
  Browser-only archives, the agent's browser and the whole course: [R9](R9-archives.md).
- **Why:** the method wants the terms of every archive kept; a portal whose terms forbid it is not browsed
  automatically. An archive's hourly cap stops the rest of the work, so whole images first and parts only where an
  entry needs them.
- **Controls:** terminal: `strom fetch <downloader> … --images 40-69 --recordset B…`, `strom allow archive` (a person
  only). App: Awaiting action.
- **Since:** research 1.0.0 (downloading only through strom); the levels of terms and a person's pace 1.14.0

<!-- zdroj: research:src/core/terms.ts:1-30 (úrovně), :52-59 LEVELS, WAYS · src/core/net.ts:39 DEFAULT_PACE, :45 HUMAN_PACE · assets/method/reading.md:44-49, :89-104 · assets/method/locate.md:15-21 · cs.json ui.archive.level.* · CHANGELOG.cs.md 1.14.0, 1.15.0 -->

<a id="R8.3"></a>
## R8.3 Readers: who reads the images

A book or a range of images is gone through by **readers**, not by the main agent. A reader is a separate run of the
agent (the same program the research works with) with a clean context. It gets a batch of views and the whole
question and writes only its report.

- **Enforced by the code:**
  - a reader works in one empty folder outside the research, not in the research's folder;
  - it sees only its views and writes only its report into `notes/readings/`; it never writes to the research and
    runs no commands;
  - it reads with the model for handwriting: `--model`, otherwise the setting `model.vision` (for Claude Code the
    default `opus`);
  - without the agent's personal add-ons (skills, plugins, MCP servers) until a person turns on `agent.addons`;
  - in a Strom archive (without AI) no readers start.
- **Method only:** browsing a book is the readers' work, not the agent's own subagents'. A subagent
  (`strom-scan-reader`) reads only crops of found entries. The main agent records the find and the search itself, the
  search with `--by reader`.
- **Why:** an image stays in the context of whoever opened it; the main agent gets a short report instead of a context
  full of images. A folder outside the research: a reader must not take over the research's instructions (the files
  CLAUDE.md, AGENTS.md). The model for handwriting never weaker than the main one: a misread name sends the research
  to the wrong village.
- **Controls:** terminal: `strom read B… --images 40-69 --question "…"`. Run it in the foreground and let it finish
  (often ten minutes or more).
- **Since:** research 1.0.0; the empty folder outside the research and `agent.addons` 1.14.0

<!-- zdroj: research:src/core/reader.ts:1-9 · src/commands/read.ts:1-4, :183-200, :226, :304-309, :514-523 · src/commands/readers.ts:73-81 readerDesk, :128 refuseReadersInArchive · src/core/reader.ts:307-313 readerSettings · src/agents/profiles.ts:5, :147 · src/core/config.ts:314 agent.addons · assets/method/reading.md:51-68 -->

<a id="R8.3.1"></a>
### R8.3.1 Batches, readers at once and range

- **Batch:** 10 views per reader (`--batch`, at most 12). A double page read in halves is two views. Batches are as
  even as possible (11 images: 6 and 5, never 10 and 1).
- **Readers at once:** 5 readers at the same time (`--parallel`, 1 to 10; permanently `strom config set
  read.parallel <n>`).
- **Range:** at most 200 images in one reading; a list (`--images 5-19,21-39`) is read exactly as given.
- Images read before are said by strom at the start; it does not refuse the reading.
- **Why:** a reader's cost grows with the square of its batch (an image is paid for in every later turn); ten images
  per reader cost a third per image compared with fifty. Readers at once give the same readers and requests, only
  sooner; fewer when the agent's subscription runs out too fast. Hundreds of images in one reading are, according to
  the code, a mistake, not an intent.
- **Since:** research 1.0.0 (batch 10, at most 12); readers at once 1.15.0; the range of 200 images 1.14.0; a list
  with gaps 1.15.0

<!-- zdroj: research:src/core/reader.ts:5-15 BATCH, BATCH_MAX, :137-171 batches · src/core/config.ts:229-230, :277 read.parallel · src/core/media.ts:126 IMAGE_RANGE_MAX · src/commands/read.ts:113-120, :407-409 · CHANGELOG.cs.md 1.15.0 -->

<a id="R8.3.2"></a>
### R8.3.2 View size and a double page in halves

- **Size (enforced by the code):** a view is as big as the readers' model takes it whole: 2000 px on the longer side
  for newer models (Claude Opus 4.7 and newer, Sonnet 5 and newer, Fable; Codex and OpenCode), otherwise 1568 px.
  Different only when a person calibrated the size (`strom media calibrate`) or strom enlarged it for a book
  ([R8.4](#R8.4)).
- **A double page in halves:** in a blind reading, in a verification task and for an image a reader earlier reported
  as unclear, the reader gets a double page as two halves that overlap at the gutter (4 % of the width on each side).
  Only when a half is at least 1.25× sharper than the whole image in one view. Otherwise the double page is read
  whole; `--half both` forces halves, `--whole` forbids them, `--half left|right` takes only one side.
- **Crop (`--crop`):** only that part of every image, at full resolution. A crop larger than one view is given to the
  reader in overlapping parts. When a sharper part of the image came from the archive, it is read from that.
- **Why:** a bigger image is shrunk by the agent itself before the model sees it, and the thrown-away pixels are paid
  for by slower reading. A half shows each side sharper; for a nearly square double page the second view would cost
  more than it brings.
- **Since:** research 1.14.0; reading from a sharper part of the image 1.19.0

<!-- zdroj: research:src/agents/images.ts:1-54 IMAGE_MAX, IMAGE_MAX_LARGE, imageMax · src/core/views.ts:113-140 SPREAD_OVERLAP, SPREAD_GAIN, halves, readInHalves, :97 tiles · src/commands/read.ts:192-194, :332-339, :356-390, :59-85 sharperForReader · CHANGELOG.cs.md 1.19.0 „Ostřejší část snímku se opravdu čte“ -->

<a id="R8.3.3"></a>
### R8.3.3 What a reader writes

A reader writes its report as it goes, after each image, not at the end. For each image one block with the fields:

| Field | What it holds |
|---|---|
| `result` | `found`, `nothing`, `unclear` (a possible match that cannot be confirmed) |
| `entries` | every entry that answers the question, word for word in the original language and spelling, where it stands and in which column |
| `illegible` | what could not be read and where |
| `hand` | the handwriting: ink, script, language, abbreviations |
| `certainty` | for each name in the entry, how sure the reader is (%) |
| `pages` | the page numbers written on the image |
| `gaps` | pages missing before the image (the numbering jumps) |
| `section` | another part of the book starts on the image (place, year, kind of record) |

- **The reader's rules** (strom puts them into the reader's assignment):
  - transcribe only what the question asks for (only page numbers, only the entries of one surname, one entry whole);
  - "nothing" is a valid and valuable result: the reader says what it checked;
  - "illegible" beats a guess;
  - a possible match (an illegible name where the rest fits: age, house, date, parents) is `unclear` and an entry,
    never hidden in a `nothing` block;
  - what the research knows (`--context`) serves only to recognise the family, never to fill in what was not read;
  - in a blind reading (`--blind`) an exact transcription without expectations
    ([R3.5](R3-verification-and-citation.md#R3.5)).
- **Enforced by the code:** an unclear spot from this report keeps a fruitless search from being recorded over the
  range until someone looks at it closely ([R3.6](R3-verification-and-citation.md#R3.6)).
- **Why:** at an unclear spot the agent must look closely before the range counts as searched in vain; a possible
  match often hides in exactly what is illegible. A report written as it goes survives an outage: a resumed reader
  goes on with the images not yet in the report.
- **Since:** research 1.0.0; the fields `pages`, `gaps`, `section`, `unclear` as an entry and "only what the question
  asks for" 1.14.0

<!-- zdroj: research:src/core/reader.ts:188-240 readerPrompt, :266-300 parseReport · assets/method/reading.md:51-57, :76-77 · src/commands/readings.ts openUnclear, refuseNegativeOverUnclear -->

<a id="R8.3.4"></a>
### R8.3.4 A reader's time limit and a service outage

- **Enforced by the code:** a reader has 5 minutes and 1 minute for each view, at least 6 and at most 15 minutes. When
  readers of the same agent and model needed more, strom extends the limit: by the last 10 readers that finished or
  hit the limit (×1.5 after one that finished, ×2 after one that was stopped), never above 15 minutes. `--minutes`
  sets the limit by hand.
- **A service outage:** a reader whose model service is silent for 150 s after a retry is resumed once where it left
  off, with the time remaining. If it stays silent, it ends at once; its images are read again later. Such an outage
  does not make batches smaller.
- A reader stopped by the limit gave no answer for its images: strom says to look at them oneself, or to read them
  again with a longer limit.
- **Why:** cases from real research: a reader of one crop stood for 15 minutes and the agent waited for it; a reader
  of one crop ended at the limit of 6 minutes without a result, while the same reading with a limit of 12 minutes was
  done in 4. A silent service used to run all the way to the limit, and readers without a result made batches smaller.
- **Since:** research 1.14.0; resuming after a service outage 1.22.0

<!-- zdroj: research:src/core/reader.ts:17-91 readerMinutes, learnedReaderMinutes, READER_STALL_MS · src/commands/read.ts:493-496, :674-680 · src/core/readstats.ts readerLimit · CHANGELOG.cs.md 1.22.0 -->

<a id="R8.3.5"></a>
### R8.3.5 Reading until found

- **Enforced by the code:** with `--until-found` no further reader starts once one reports a find; readers at work
  finish. strom lists exactly which images nobody read.
- **Limits:** only the images read are searched; the search is recorded as `--result partial`, never as fruitless for
  the whole range.
- **Method only:** only for **one** particular entry (the baptism, marriage or burial of one person about whom enough
  is known). Never for all entries of a place or surname, nor where a namesake may come after the find. When the find
  is not the right one, the rest is read.
- **Why:** an image not read is not searched. A namesake is not the person sought
  ([R1.4](R1-research-in-brief.md#R1.4)).
- **Since:** research 1.15.0

<!-- zdroj: research:src/commands/read.ts:197-199, :216, :468-489, :596-631 · assets/method/reading.md:70-75 · CHANGELOG.cs.md 1.15.0 -->

<a id="R8.3.6"></a>
### R8.3.6 Reading a book that is being downloaded

- **Enforced by the code:** a book that `strom fetch` is downloading right now can be read at once. Readers start on
  the registered images (a batch at a time of 10) and wait for the rest. Images the download did not bring strom lists
  exactly; they are not read and do not count as fruitless.
- **Why:** faster reading; the archive gets the same requests at the same pace.
- **Since:** research 1.15.0

<!-- zdroj: research:src/commands/read.ts:195-196, :238-253, :411-456, :599-633 · CHANGELOG.cs.md 1.15.0 „Rychlejší čtení“ -->

<a id="R8.3.7"></a>
### R8.3.7 What comes back to the agent

- **Enforced by the code:** after the reading the agent gets a short summary: on which images there is a find, on
  which an unclear spot, what could not be read where there was nothing, and the gaps in the book. With it a ready
  command `strom search add … --by reader` with the result `found`, `partial`, `inconclusive` or `negative` and the
  gaps in `--note`. The reports are kept in the research.
- Images nobody reported and readers that failed are listed separately.
- **Method only:** the reports are not read whole, only through `strom readings` (`--match <surname>`, `--list`, one
  image: `strom readings B… --image 57`). Each report is recorded at once, before further readers start. Images read
  before: another question or a blind check is fine, the same question is not.
- **Why:** the main agent keeps in its context only what the readers found, not images or whole reports.
- **Controls:** terminal: `strom readings`.
- **Since:** research 1.0.0; `strom readings` 1.14.0

<!-- zdroj: research:src/commands/read.ts:641-689 · src/commands/readings.ts:467-478 · assets/method/reading.md:57-67 · src/core/reader.ts:1-3 -->

<a id="R8.4"></a>
## R8.4 Self-tuning of reading

strom measures how reading the scans goes and changes how it reads by itself accordingly. Only towards accuracy or
fewer requests to the archive.

- **Enforced by the code,** what strom may change by itself:
  - a book read worse than the others, or shown enlarged: the whole image at reading size, a double page in halves,
    from images already on the computer;
  - readers that lose context, reopen views or give no result: smaller batches and fewer views per call, never below
    half the default;
  - an archive that hit its limit: whole images first, halves and parts only for candidates;
  - a book from which the portal gave no sharper part: further parts are not offered;
  - images downloaded and never read: only what a task reads is downloaded;
  - each change returns to the default after 60 days without its signal and with new readings.
- **Limits (enforced by the code):** never a smaller view, a cheaper model, a reading that could miss an entry, nor
  more requests to the archive: that is for a person to decide (`strom media calibrate --questions`). It is decided
  after a session, never within one: a session goes by the values of its start. It holds separately for each agent and
  model. Each change is recorded with its reason.
- **Controls:** terminal: `strom media calibrate --report` (how reading went, free), `--questions` (what a person
  decides), `--reset` (back to the defaults); `strom config set tune.auto off` turns self-tuning off. Calibrating the
  size of views (`strom media calibrate`) is a paid reading of the research's own proven records and only a person
  confirms it.
- **Why:** according to the code only so that nothing gets worse by it: a change may add accuracy or save requests to
  the archive; what could take away accuracy or burden the archive is a question for a person.
- **Since:** research 1.14.0

<!-- zdroj: research:src/core/tune.ts:1-21 (A1–A7) · src/core/readstats.ts:88-99 TUNING smallest, backAfterDays · src/core/config.ts:337 tune.auto · src/commands/calibrate.ts:394-420 -->

<a id="R8.5"></a>
## R8.5 The main agent's own reading

An entry that will be cited the main agent looks at itself at full resolution. Old handwriting is dealt with by the
strongest model, never by fast or cheap reading.

- **Enforced by the code:** images are opened only as views of `strom media view` (a file in `.strom/views/`). A whole
  image has at most 1400 px on the longer side: for finding an entry, not for reading. A half, a crop and parts have
  the size the model takes whole (1568 or 2000 px). At most 12 images and 24 views per call.
- **Method only,** the procedure:
  1. find: the whole image with `--grid` (a grid in tenths), read off where the entry is;
  2. crop: `--crop x,y,width,height` (fractions of the image) or `--half left|right`; transcribe only from a crop or a
     half at full resolution. Faded ink `--contrast`, a page sideways `--rotate 90`, a page in parts `--split 2x2`;
     the whole view unclear: `--half both` before saying "not found";
  3. after about 30 views record what was found before opening more; a view that dropped out of the context is not
     reopened, the notes hold;
  4. a crop says "enlarged": the scan has no more detail. A sharper part can be downloaded only through a downloader
     that can do it.
- Page ↔ image: `strom recordset calibrate B… --point 57=112` (measured on the image, never guessed); then
  `strom media view B… --page 112`.
- **Why:** a reduced whole image is enough to find an entry for half the tokens, but not to read it. Every view stays
  in the context that opened it. Look at as few pixels as the question needs.
- **Controls:** terminal: `strom media view B…:57 --grid`, `strom media view B…:57 --crop 0.05,0.40,0.45,0.18`.
- **Since:** research 1.0.0 (views, `--grid`, `--crop`, `--contrast`, `--rotate`); sizes 1400/1568/2000 px,
  `--split`, the limits per call and about 30 views 1.14.0

<!-- zdroj: research:assets/method/reading.md:3-8, :18-50, :86-88 · src/commands/media.ts:239-241 VIEW_MAX_IMAGES, VIEW_MAX_VIEWS, :934-967 · src/agents/images.ts:14-18 OVERVIEW_MAX · src/agents/profiles.ts:43 DEFAULT_READING_NUMBERS viewsStop · src/commands/sources.ts:612-618 recordset calibrate -->

<a id="R8.5.1"></a>
### R8.5.1 A name and place for the next search

- **Method only:** a name or place on which the next search depends (surname, place of birth, parish) is read again
  on a crop at full resolution before it is recorded. What stays uncertain is recorded as uncertain and said so.
- **Why:** a misread name sends the research to the wrong village.
- **Since:** research 1.4.1

<!-- zdroj: research:assets/method/reading.md:3-8 -->

<a id="R8.5.2"></a>
### R8.5.2 An uncertainly read place is a lead

- **Method only:** a place read uncertainly (the readers differ, `[?]`, nothing else confirms it) is a lead, not a
  place. No parish, book or task follows from it until it is certain: an own look at the crop, the book's index, a
  gazetteer or cadastre (the village's parish from them, never from today's municipality). If it stays uncertain: a
  hypothesis with the readings as variants (`strom hypothesis add`) and a task that checks it (`--about H…`).
- **Why:** a task that took an uncertain place as certain would search in a book of another parish.
- **Since:** research 1.14.0

<!-- zdroj: research:assets/method/reading.md:10-15 · assets/method/locate.md:8-9 -->

<a id="R8.6"></a>
## R8.6 Recording a find

A found entry is recorded at once: the source with a clip, a transcription and the place in the book, the facts from
it and the search that found it.

- **Enforced by the code:** `strom batch --file notes/<file>` records all lines or none; it says all wrong lines at
  once.
- **Method only:**
  - a source from a scan gets `--clip` (the crop in which the entry was read), `--transcript` (the words of the entry
    line by line, what was not read `[?]`) and `--locator` (folio, page, order of the entry); in detail
    [R3.4](R3-verification-and-citation.md#R3.4);
  - an entry in a language or script other than the language of the research gets, beside the literal
    transcription, a translation into the language of the research (`--translation`), from research 1.28.0;
  - into the fields (`--date`, `--house`, `--age`, the name) only what was read with certainty. What is uncertain goes
    into the transcription with `[?]` and into the fact's note ("house 21 or 27"). What a reader reported as illegible
    stays illegible until the agent reads it itself. An empty column is empty; nothing is filled in by what is usual;
  - a name read only in part keeps the sure letters (`Anna /Kr[?]ková/`), a date with an uncertain day keeps the
    month;
  - the search is recorded even without a find, with the exact range of pages; pages missing from the book are not
    searched ([R3.6](R3-verification-and-citation.md#R3.6)).
- **Enforced by the code:** a fruitless search over a spot a reader reported as unclear is refused by strom
  ([R3.6](R3-verification-and-citation.md#R3.6)). A missing clip or transcription is pointed out.
- **Why:** the Strom app shows the entry cut out of the scan beside its words. By the sure fields the person is
  searched for further; a name with its sure letters can still be found. The most expensive mistake is to search the
  same book twice.
- **Controls:** terminal (agent). App: the source page shows the excerpt and the transcript
  ([A3.3](A3-evidence-in-the-app.md#A3.3)).
- **Since:** research 1.0.0; the clip 1.1.0

<!-- zdroj: research:assets/method/recording.md:1-27, :55-65 · assets/method/reading.md:76-84 · assets/method/core.md „Negative results are results“ · překlad: recording.md "--translation", link.md krok 7 (od v1.28.0) -->

<a id="R8.7"></a>
## R8.7 Certainty and verification of what was read

The degree of certainty of a fact from a scan depends on who read the entry and how.

- **Method only:** Proven only when the main agent read the entry itself and the entry states the fact directly. A
  conclusion that rests on one hard cell (a house number, an age, a name) needs a second, blind reading before Proven;
  different readings are a conflict, not a choice ([R3.5](R3-verification-and-citation.md#R3.5)).
- **Enforced by the code:** Proven needs a citation from a source that is not weak, with primary information
  ([R3.2](R3-verification-and-citation.md#R3.2)). The code does **not check** that the main agent read the entry
  itself, nor the blind reading.
- A document read by the research's readers: one reader → Possible; two blind readers agreeing → Probable
  ([R3.5.1](R3-verification-and-citation.md#R3.5.1)). Degrees of certainty: [R3.1](R3-verification-and-citation.md#R3.1).
- **Why:** the second reader must not know the expected value, otherwise it would "read" it. A fact goes above
  Probable only when two independent readings agree.
- **Since:** research 1.0.0; reading a document by the research's readers 1.18.0

<!-- zdroj: research:assets/method/verify.md:1-18 · assets/method/core.md:8-12 · src/core/evidence.ts:55-68 checkStatus · src/core/readsync.ts:194 readingGrade -->

<a id="R8.8"></a>
## R8.8 Reading a document from the app

A photo, scan or PDF of a document can be given from the app to the research's agent to read: a transcription, a
translation and an explanation. One reader can read it, or two independent ones; two are compared, and the result
shows the places where they differ. Nothing read goes into the tree without confirmation.

- **Enforced by the code:**
  - input: a photo, scan or PDF; several files are pages of one document; at most 10 pages and 50 MB per file. A page
    whose shorter side has fewer than 800 px is too small and the readers do not get it;
  - **1 reader** (faster, cheaper), or **2 independent readers** (more reliable, for adding to the tree); the choice is
    remembered;
  - each reader starts with a clean context and returns: a word-for-word transcription, a translation into the
    research's language, an explanation (terms, abbreviations, occupations, context) and the people, events and
    relations named;
  - the second reader reads blind and does not see the first reading. The transcriptions are compared word by word,
    the people by role and order, the events by kind and order. Where they differ there are variants;
  - a name a reader gives must stand in its transcription. Which people and places of the tree match is decided by
    strom, not by the reader;
  - at most 20 readings per hour and 60 per day (only a person can raise them); for one tree one document is read at
    a time and 3 more wait. In a Strom archive reading does not exist.
- **Result:**
  - the mark of agreement: **2 readers, agree**, **2 readers, K places differ**, or **1 reader**. On the page preview
    a green frame marks the selected entry and an amber one the places where the readers differ ("readers differ: the
    first reads “a”, the second “b”"). In the transcription `[?]` marks an uncertain reading and `[...]` an illegible
    or left-out place;
  - the sections **Transcription**, **Translation**, **Explanation**, **About the document**, **Mentioned**; **Copy
    transcription**;
  - a document that cannot be read gets a reason (blurred, glare over the text, taken at an angle, part of the page
    missing, too dark, too small, no written text in the picture) and advice on taking a better photo;
  - the result stays in the reading history (**Read documents**). It goes into the tree through **Suggest for the
    tree…**.
- **Limits:**
  - the research's agent and model for scans read it ([R8.3](#R8.3)); reading counts toward the research's cost, also
    a cancelled one: what the agent already read counts;
  - the window can be closed; reading goes on and the result is announced. The estimate in the window counts about a
    minute per reader, with Grok 4 minutes;
  - reading works only with a research that runs on this computer and has an agent set up; otherwise the dialog says
    why (**Not possible now: …**).
- **Controls:** app: **Research → Read a document…**, in the person menu **Read a document for this person…**; drag
  files into the window or **Choose files…**; optionally **Document concerns** (a person) and **Note**; **Readers**;
  **Read**. A file dragged into the app offers **Read now**, or **Add to materials**
  ([R11](R11-material-from-the-user.md)). History: **Research for this tree… → Read documents (N) ›**.
- **Since:** app 3.14.0, research 1.18.0

<!-- zdroj: app:src/ui/read-document-ui.ts · strings.ts read.* (menu, menuPerson, r1/r1Sub, r2/r2Sub, agree, differ, oneReader, variantNote, scanHint, whyText, advice, cancelled, closeNote, limit, propose, historyRow) · research:src/core/document.ts DOC_PAGES=10, SMALL_PX=800 · src/core/live-read.ts READ_MAX_BYTES=50 MB, READ_QUEUE_MAX=3, read.app (20/h, 60/den) · src/commands/document.ts:463 · config model.vision · spec 059 K1.1 -->
