// The live bridge: the Strom app follows a research while it goes on. strom
// runs a small web server on this computer only (127.0.0.1, a random port, a
// secret token in every address) that only reads: the app, opened with
// ?live=<address>, takes the tree's GEDCOM from it and hears what changes —
// who is at work on what, what was recorded, what waits for the user. Nothing
// leaves the computer. It runs until strom live stop (or the app's switch,
// POST /live) or the computer goes off — or, when the person chose so
// (live.idleMinutes, 0 by default: never), ends by itself when nobody has asked
// it anything for that while and nobody works in the tree.
//
//   GET <token>/status     the tree, its researches, who is at work, what waits; what the research takes from
//                          the app (accepts). ?poll=1: the app asking now and then — the bridge's idle time goes on.
//                          Made once for a state of the research on a thread of its own (core/livestatus.ts) and
//                          answered from it while the state lasts. ?parts=1 (feature status.parts): without the parts
//                          that weigh (waiting; queue, queueMore, queueCounts; offLine; researches), with parts {name:
//                          rev} instead — the same rev, the same part. Each of working (who is at work; the event
//                          working too): the place record (L…) of the book the agent examines, when the research knows
//                          it (place, core/workplace.ts; none: not known) — feature working.place; work on a family
//                          (a couple's story): the family (family F…) and its husband, else wife, as the person —
//                          feature working.family. A task that belongs to no line but helps one says how, as the
//                          queue does (helps: question | joins | agent | partner | branch, with research the line it
//                          helps); one off the lines or added to a line says its branch (branch B-P…) — feature
//                          working.helps.
//                          Holds (spec 127, core/holdsview.ts): working lists agents working directly too (strom
//                          started no run or conversation for them: who "<agent> working directly", from the holds of
//                          .strom/holds); each with its session's hold {by: run|chat|agent, since, beat (its last sign
//                          of life), until? (free by then at the latest — task.hold; none: a live process on this
//                          computer holds it, free when it ends)} — feature task.holds; a run waiting for a restricted
//                          archive another session uses: paused {until, reason, archive, since} and waits {archive,
//                          since, until (it stops waiting then at the latest — archive.wait)} — feature archive.holds.
//                          A task of the queue an open session holds: heldBy {session, who (the agent's name), by,
//                          since, beat, until?}; one whose archive another uses now (or one waiting for it goes first):
//                          archiveHeld {site, until, own (a session of this research), by: run|chat|agent|fetch|waiting,
//                          session? (own), since?, beat?} — the same in GET /queue and POST /queue/<T…>.
//                          working[].saving {recordset, saved, of} (feature working.saving): the images the agent's own
//                          browser saves for its task (strom media save) — of those given to it in this session how many
//                          came; such a task is no item of waiting (nor of a line's waiting count) while its session
//                          holds it, one the browser held an image of back or nobody holds any more is (core/ownsave.ts).
//                          work {gate, minutes} (features work.link, run.tasks; none in an archive or a research
//                          waiting for its agent): before the Strom app's link work (strom-research://work?tree=…&do=loop|
//                          tasks[&n=1..100 | &task=T…,T… — feature work.tasks: these tasks, one session each], taken in the terminal on the person's yes — the bridge never starts an agent)
//                          the gate the agent works alone under as the settings name it (title and what it is given),
//                          null with none set (the loop is not started then, n tasks are), and a session's minutes
//                          (run.minutes). busy {sessions, runs} sees a run from its start, while it waits for its gate too.
//                          confirm: ask|no (run.confirm, the person's): whether the terminal asks before the agent starts.
//                          Runs by line (spec 126; features run.lines, run.agents; none in an archive or a research
//                          waiting for its agent): runs [{id (run-…), research (G…|null: the whole queue), agent,
//                          agentName, model?, since, state: working|between|paused|finishing, paused? {until, reason
//                          (limit|archive, else as said), since?}, session?, task? (while a session works), lastStep?
//                          (its terminal's last step, at most 200 characters), sessions (done)}] and runsEnded [{id,
//                          research, agent, since, ended, why: done|stopped|limit|gate|time|archive|error}] (the last 10
//                          minutes) — both read at each ask, never part of a state kept; working[].run (the run whose
//                          session it is); researches[].run (the run holding the line), canStart, why?
//                          (archive|waitingAgent|noAgent|oldRun|running|paused|done|limit|empty), agent? (of its last
//                          run); limits {maxRuns (run.parallel), running, cap: 10}; agents [{id, name, default?}] (those
//                          strom can start here); queue[].run (the line's run that takes it; none: the whole queue's);
//                          queueCounts.general (the whole queue's run's). The link work takes research=G…[&agent=…]:
//                          strom run --research G… [--agent …] in a window "Strom · <tree> · <line> (G…)".
//                          books (feature books, no gate of the app's version; none in an archive or a research waiting
//                          for its agent; part books): the books most tasks need, to download by hand (core/books.ts) —
//                          {settings {minTasks, minTasksOwn, minTasksDefault, sameBook: yes|no, sameBookOwn,
//                          sameBookDefault}, list [as strom task books --json, without ids and dir: id, title, folder,
//                          tasks, waiting, offer, download (whole|selected|range|none), downloadTerms? {how, says, from,
//                          host}, need?, images?, onDisk, missing?, url?, archive?, years?, pending? (files lying in its
//                          folder, not taken yet)], more (beyond 100)}; only books something waits for or offered. A task
//                          of the waiting list or the queue names its book (book: B…: the one it waits for, else the one
//                          live book its record sets name); a queue item put first by queue.sameBook says sameBook: B….
//                          What helps most (feature waiting.gain, spec 105 K4.1, no gate of the app's version — an older
//                          app reads nothing of it; core/waitgain.ts): an item of waiting with tasks behind it (a task, an
//                          archive's question) whose dealing with grows the tree carries gain {score, says (the research's
//                          language, the parts joined by " · "), parts: [{kind: generation, person: P…, name, missing:
//                          parents|father|mother} | {kind: line} | {kind: unblocks, n}]} — new ancestors and the tasks
//                          it frees; none on the others. The order stays strom's: the app sorts by gain.score itself.
//                          handoffs (feature handoffs, every app, an archive too): the ids of the app's links
//                          (strom-research://…&handoff=<uuid>) taken in the last minute — a terminal came up for it, or
//                          what needs none was done (core/handoffs.ts) — newest first, [] with none; read at each ask,
//                          with parts=1 too, never part of a state kept.
//                          features: what the bridge does that the app may ask about (BRIDGE_FEATURES, bridgeFeatures:
//                          a few only for an app of the version that reads what they need; an archive's without the
//                          agent's). name-status (spec 066 P5) only for an app of APP_READS_NAME_STATUS, whose /tree.ged
//                          says a name's status, confirmation and verification under NAME (2 _STROM_EID P….N): the app
//                          offers Verify (POST /verify {fact: P….N}) and Confirm against the scan (POST /facts/confirm
//                          {fact: P….N}) at the name of a person's identity — the confirmation in an archive too.
//                          person.contact (spec 134 U11, every app, an archive too): a person's contact (their e-mails)
//                          is the research's — strom sync and an app's handover read it as 1 RESI / 2 EMAIL, as the
//                          app's older residence of nothing but a note "E-mail: …" and as 1 EMAIL, and /tree.ged
//                          writes it as 1 RESI / 2 EMAIL (at most three to a RESI), no date, status or mark of strom's.
//   GET <token>/status/<part>  one of those parts: {part, rev, head, …its fields as /status carries them}; 404
//                          status.part for another name.
//                          A queue item off the lines of a research with several (core/offline.ts) says offLine:
//                          "occasional" (now and then one), "last" (after the lines' work) or "never" (not taken) — its
//                          branch's choice, else queue.offLine; one that helps a line says how (helps: question | joins |
//                          agent | partner | branch) and goes with that line (research) — feature tasks.offLine. Each
//                          says its branch (B-P…, off the lines or added to a line), the person's own turn (own: next |
//                          last) and why it stands there (why: {kind: own, do} | {kind: line, research} | {kind: helps,
//                          research?, by} | {kind: off, mode: occasional|last|normal, branch?} | {kind: paused,
//                          research}; none for a task about nobody) — feature queue.own. Each in the queue says its place
//                          in the whole queue (pos: 1 the next, the one at work first; none for one put aside), and
//                          queueCounts {research: {G…: n}, branch: {B-P…: n}, next, parked} counts the queue's tasks by
//                          the same research and branch GET /queue filters by — feature queue.page; queueCounts.kind
//                          {verify|records|material|places|enrich|request|story|history|census|house|other: n} (only
//                          the kinds with a task; census apart — feature census, house apart — feature house) and each
//                          item's taskKind: the kind of the work (core/taskkind.ts) — feature queue.kind; a task of a
//                          house says its key (house: "<town>|<number>", as GET /houses; none for a municipality's) —
//                          feature house. The order is strom
//                          run's (core/queue.ts runOrder): one story first at a story's turn, the tasks of history by
//                          their pace; kind: story | history says such a task (none for the research's work)
//   GET <token>/tree.ged   the tree for the Strom app, as it is now, each entry with its image (the settings excerpts.*);
//                          for an app that keeps them the bounds of a lineage the person set (_STROM_LINE, _STROM_LINES;
//                          feature lineage.read: strom sync takes them back); under each _STORY (and its 2 _DRAFT) the
//                          sources it rests on as 2 SOUR @S…@ (3 SOUR), each a record of the file — those its facts cite,
//                          those of its background and those its text names by ID (feature story.sources); made on a
//                          thread of its own (core/liveged.ts: new images decode whole scans, the file of a big research
//                          is tens of MB) — one making at a time, the asks for the same file wait for it together, /status and the rest answer meanwhile;
//                          made once for each head and variant (the app's version, links, images' settings) and kept on
//                          disk (.strom/cache/live-ged: a bridge started again gives it at once); X-Strom-Head its head.
//                          A person's contact (feature person.contact): 1 RESI with 2 EMAIL lines alone (three at most,
//                          then another RESI) — no event of the research; read back by strom sync as the contact.
//                          ?stale=1 (feature ged.stale): the last one made of the variant at once, though the research
//                          changed since (X-Strom-Stale: 1, X-Strom-Head-Now), the new one told by the event change. While
//                          the app follows (/events), a change is told once the tree of its head is made (at most 45 s).
//                          ETag (feature ged.etag) told by the head and the variant (none for a file with images left
//                          for later); If-None-Match naming it: 304, no body, nothing made or waited for (with ?stale=1
//                          the older one's ETag, its 304 still X-Strom-Stale); ETag and X-Strom-* shown to the app's page
//                          (Access-Control-Expose-Headers), If-None-Match let through its preflight.
//                          ?images=ref (feature ged.imagesByHash, spec 071): each excerpt by reference, not in the file —
//                          2 FILE strom-image:<sha256 of the JPEG's bytes> with 3 _MIME, _WIDTH, _HEIGHT, _BYTES; a variant
//                          of its own (its own ETag, with ?stale=1 too), its images kept by their hashes as it is made
//                          (.strom/cache/live-images: those the kept files name and those of the last hour, the rest
//                          go); X-Strom-Images: ref | data says which file came (another value asked: data, as always);
//                          packed (Content-Encoding: gzip, once for each file) for an app that takes it (Accept-Encoding),
//                          the file with its images in it never (an older app gets it as always).
//                          ?media=app (feature media.app, spec 108): the files of the app's tree too — each record of
//                          the material in the tree an OBJE at each of its places as the app sent it (a portrait with
//                          _STROM_KIND photo and a couple's photo with _PRIM Y first, then the attachments by their
//                          order; an event's under its event; a source's as 2 _SOUR under its person's or couple's,
//                          else at the source): with images=ref 2 FILE strom-image:<sha256 of its working copy> with
//                          3 _MIME, _WIDTH, _HEIGHT, _BYTES (else a data URL), _STROM_SHA, _STROM_ORIENT, TITL
//                          (_STROM_NAME beside a title), FORM with 3 TYPE, _DATE, NOTE; a file the app cannot show
//                          (no working copy, not an image of at most 2 MB) by its name and hash alone (originalOnly). A
//                          variant of its own (its own ETag); the head given so kept (.strom/sync/media-heads.json,
//                          the last 500): the base a send's files are compared with. Without it: as before.
//                          Under a person's fact its copy of an event the app shares among people (2 _STROM_SHARE <id>,
//                          3 _ROLE the person's role as written), under a fact of a person or a family a role at
//                          another's event (2 _STROM_ROLE <role>, 3 _STROM_AT @…@ only of this file, 4 TYPE its tag) —
//                          feature event.share: read by strom intake and strom sync, kept and given back as they came
//   GET <token>/image/<sha256>   one image the file names by reference: the JPEG (a file of the app's tree, media=app:
//                          its working copy from the shared store, of its type), Cache-Control private, a year, immutable,
//                          ETag its hash (If-None-Match: 304); never made because it is asked for — 404 image.unknown
//                          (the app takes the file with its images in it), 400 image.sha
//   POST <token>/images    several: {"images": [sha256…]} (1–IMAGES_AT_ONCE) → {images: [{sha, mime, bytes, data (base64)}],
//                          missing: [not here], more: [not in this answer, its size reached: asked again]}; read only,
//                          with its Content-Length (one cut short is no answer), never packed (base64 of JPEGs packs
//                          little and slowly: the app waits longer for a packed one); 400 images.body. Of the files of
//                          the app's tree only the working copies of records in the tree — never another file of the
//                          shared store (missing)
//   GET <token>/images.ged the same as tree.ged (the address an older strom gave)
//   GET <token>/log        what the research saved, newest first (each commit: when, what, for which task;
//                          text: its lines as the user reads them, kinds: what each is about, sources: the S… each
//                          names — only when one does; head: the change, as strom history back and the link back take
//                          it; a return in time: kind "return", to: the change it went back to, toAt: when that was —
//                          feature history.back); run: the run (strom run, its worker run-…) whose session it was
//                          (feature run.lines; never in an archive) — a run's start and end are no entries here
//   GET <token>/whats-new  what is new in this strom (?lang=cs|en|de, else en): {version, lang, url, points} — the
//                          running version's section of the changelog shipped with it; asking keeps no bridge running
//   GET <token>/recent     what the research added in the last hours (?hours=1…168, 24 when not given): the people and
//                          sources added, the commits — the same as /status recent (core/recent.ts)
//   GET <token>/finds      what the research found of the family since a moment (?since=ISO, else the last 24 hours, at
//                          most 31 days back; ?lang=, else the research language): {since, groups: [{key, kind, title?,
//                          name?, span?, place?, at, lines: [{kind, text, at, fact?, span?, decided?}]}], cut?, earlier?}
//                          (place: a family's, where it married, its first part; decided: a hypothesis decided, the
//                          variant chosen — both optional, K3.13) — the same as the
//                          phone's page's Finds (core/phone-finds.ts treeFinds), cleaned as for it (no path, no record's
//                          ID in a text); feature finds. An archive or a research waiting for its agent: none ({since, groups: []},
//                          the same as the phone's page; nothing found by an agent is said there)
//                          feature finds.person: each person's group, each child line and each family's group (by its
//                          first partner) says `person` (P…) for "Show in the tree" (spec 094 D3; the phone's page: never)
//   GET <token>/glance     the app's screen Research on a device before it has the tree (spec 094 K3.13, core/glance.ts;
//                          feature glance): {head, headAt?, tree {id, name, lang, state, kind?, persons, families, ged?
//                          {bytes, head}}, day? {persons, sources, saves, since}, now: [{since, paused?, line?, way, task?
//                          {id, text}, person?, family?, run?}], runs: [{id, line, way, since, state, paused?, task?}],
//                          lastWorked?, lines: [{id, n, name, direction, way, state, tasks, waiting, working, since, focus?,
//                          reason?}], waiting {n, items: [{id, kind, section, phase, what, on?, at, sentAt?, sentDay?, group, person?, persons?,
//                          line?, branch?, retry? {can, until?, says, n?}, hypothesis?, do: [answer|sent|unsent|retry|line|keep|never|decide]}]},
//                          people {P…: {name, span?}}} — made of /status for the state now and the app's version (kept
//                          for both, as /status is), the runs read
//                          at each ask; texts as the phone's page says them, nothing of an agent, a model, a folder or a
//                          link. An archive, a research waiting for its agent: tree and day alone; a newer strom's research:
//                          {tree, locked {code}}
//   GET <token>/people?q=  a person by the name (spec 094 D1, feature people.search): {people: [{id, name, span?, place?}]},
//                          at most 8 (core/people.ts peopleFound); the place: its first part with something left as a
//                          device sees it, else none; fewer than two letters or digits: none
//   GET <token>/events     server-sent events: hello, change, working, history; end before the bridge ends ({reason: stopped |
//                          restart | idle | gone | signal, back: another bridge at this address at once — absent: not
//                          known, at}): strom live stop asks it through .strom/live-stop.json, the same on every system;
//                          asked while something the app sent is written, it ends once that is written (meanwhile
//                          .strom/live-busy.json says so to the one asking, which waits — at most a while)
//   POST <token>/sync      the Strom app sends the user's edited tree back (?send=, or on its own): kept in the
//                          inbox to be shown and written on the user's word (strom sync) — nothing of the
//                          research changes; /status says what waits there (inbox) and how each send went (sends);
//                          ?media=app: the send carries every file of its tree — a place of one the app was given with
//                          the files (GET /tree.ged?media=app of its _STROM_HEAD) and no longer has is taken off.
//                          Files by reference (spec 133, feature sync.mediaRef): `_STROM_DATA <sha>` where FILE data:…
//                          would be, the research's excerpt with no FILE; a hash the research cannot find (the shared
//                          store, its own files) refuses the whole send before anything is kept: 409
//                          {ok: false, code: sync.media-ref-unknown, error, shas: [≤ 50]} — the app sends it with the data
//   POST <token>/cancel    …or says it sends nothing ({"reason": "unchanged" | "cancelled" | "no-tree"})
//   GET <token>/media/<sha256>   whether the research has a file of that content (an original the app would send);
//                          ?file=1: the file itself (the original, for the app's viewer)
//   GET <token>/excerpt/<S…>   a source's excerpts the file left out (_STROM_IMG_OMITTED), as the file would carry
//                          them (?clip=<mark> one, ?level=sharp|normal|small|smaller, another the research's): JPEGs as data URLs with where
//                          each is; what takes long is made over several asks (202 {later}, asked again); made on a
//                          thread of its own, one source after another, the bridge answering the rest meanwhile
//   GET <token>/excerpts?missing=1   what the file left out that the app could load: each source, its marks, about how
//                          large (nothing made to say it)
//   GET <token>/material   the family's files the research keeps (core/material.ts), ?person=P… / ?batch=<id>,
//                          ?files=0 (the batches only); each file's title, kind, date, hidden (hidden ones stay listed),
//                          `people`: the names of the people it names. The files of the app's tree too (spec 102 M1):
//                          origin "app", links (their places not taken off: {type, ref, event?}), kind as the user said
//                          it; a person's portrait alone is none; one with no place left is hidden, reason "removed"
//                          (M3). Each file's `uses` (M2, feature material.uses): {excerpts: n, sources: [S…], tasks: n,
//                          of: [{source, via: input|excerpt|media, title, cited: [P…] (≤ 5), citedCount, inTree}]} —
//                          `of` (spec 102 K1.14, feature material.sourceOf): the sources the file is the source of
//                          (made or sorted from it, cut out of or with an image of the same content), the people
//                          citing them named in `people` too. `left` (feature material.left): {at, sort, why:
//                          nothing-said|nothing-new|dropped|accepted|refused, said?} — the last sort done that took it
//                          proposed nothing of it, or the file took over all it proposed (accepted: the title, kind and
//                          date proposed, the people proposed — none too; spec 147 K1), or the person decided of its
//                          proposal (accepted|refused, POST /material/sort/<id>/decided; spec 147 K2) — accepted and
//                          refused only with feature material.accepted (from the sorts kept here, counted as read; a
//                          later proposal takes it off). `sameAs` (feature
//                          material.sameAs): the oldest other file of the same content (SHA-256). ?trees=1 (feature
//                          material.trees, spec 117 K2.1): the family trees' files too, kind "tree" — an input of a family
//                          tree (GEDCOM, the app's JSON) with its bytes, never one a sync sent nor an old import without
//                          its file; `uses.of` via input only for a source standing. Without it: as before.
//                          `houses` (feature material.houses, spec 145): the houses the file is material of, [{id: A…,
//                          key}] — the id and key of the house's row of GET /houses (none: no field)
//   GET <token>/material/<I…>/uses   where the research uses a file (V10): {excerpts: [{source, recordset?, page?,
//                          sha}], sources: [{id, title}], tasks: [{id, title, state}], of (as above), houses (as
//                          above)}; 404 material.file
//   POST <token>/material/assign   the people files are of ({files: [I…] | batch, add: [P…], remove: [P…]}): strom
//                          input assign, all or nothing; {files, people, kept, head}. A file in the app's tree: a person
//                          added is a place at them (its next file of the tree has it as their attachment), taken off
//                          their places are (M4)
//   POST <token>/material/hide     files hidden or shown again ({files: [I…], hidden: true|false, reason: unrelated |
//                          duplicate}): strom input hide | unskip; {files, people, head}. Shown again, a file removed
//                          from the app's tree gets back the places the last write took off (M3)
//   POST <token>/material/edit     the title, kind, date of files ({ids: [I…] (1–500), title?, kind?, date?}, "" takes
//                          one off; feature material.edit, spec 102 M5, V11): strom input edit; {files, changed, was:
//                          {I…: {title?, kind?, date?}} (the same edit with them takes it back), people, head, warnings?}.
//                          All refused 400 material.body | material.date, 404 material.file|person|batch, 403
//                          material.readonly, 409 material.busy (+ Retry-After).
//   POST <token>/material/delete   files of the material deleted for good (spec 102 K1.17, V3, feature
//                          material.delete), the person's in the app's dialog, in two steps: {files: [I…] (1–500), dryRun: true} → {files, dryRun: true, impacts:
//                          [{id, name, sha, sources: [{id, title, via: input|excerpt|media, citedCount}], excerpts, people,
//                          links, tasks, bytes: deleted|kept, keptWhy?: sameAs|otherResearch, sameAs?}], confirm} (nothing
//                          written; confirm: signed by the bridge with the seal key over the files and the impacts, 15
//                          minutes); {files, confirm} → strom input delete: {files, deleted, impacts, head}. Impacts
//                          changed since: 409 material.delete-changed {impacts}; no confirm that holds: 400 material.body;
//                          404 material.file, 403 material.readonly, 409 material.busy (+ Retry-After), 403 app.only.
//                          A family tree's file (feature material.trees, spec 117 K2.1–K2.3) as any file — one a source
//                          standing was made of (source.input, input.source) has impacts[].blockedBy [S…] and is deleted
//                          only with it: {files, confirm} alone 409 material.source-live {sources: [S…]} (params.sources
//                          "S…,S…"); {files, retractSources: [S…] (only of blockedBy), dryRun: true} → {files,
//                          retractSources, dryRun, impacts, sourceImpacts (as /source/retract's impacts), confirm} —
//                          one confirm over both; {files, retractSources, confirm} → strom input delete
//                          --retract-sources: the sources deleted first, the files taken back, one commit, only then the
//                          bytes (R7; a failure anywhere writes nothing): {files, deleted, retracted, impacts,
//                          sourceImpacts, head}; changed since: 409 material.delete-changed {impacts, sourceImpacts};
//                          a source unknown or deleted already: 404 source.unknown | 409 source.retracted {id}.
//   POST <token>/material/sort     files sorted by readers of the research (V13, feature material.sort — only where
//                          accepts.read is: never an archive nor a research waiting for its agent; live-sort.ts):
//                          {ids: [I…] (1–50), text (≤ 2000 characters)} → 202 {id, state: "queued"}; sorted one at a time
//                          detached from the bridge (strom material sort <id>), nothing written to the research. The
//                          bridge signs each with the tree's seal key: a record said to be the app's without it is
//                          never started (failed, reason "unsigned"; not the app's: 404, not in /status).
//                          GET <token>/material/sort/<id> {id, state: queued|working|done|failed|cancelled, files, at,
//                          proposals?: [{id, title?, date?, kind?, links?: [{type: person|family|event|source|back|
//                          portrait, ref, event?}], unrelated?: true, why, sure: high|medium|low}], reason?} — the
//                          proposals as the research is now: none the person gave or took off, no ID it does not have;
//                          back: on the proposal of the FRONT, ref its back (I…, another file of the sort its reader
//                          was given; one back per front, one front per back, never a back of a back — e.g. {id: I0001,
//                          links: [{type: back, ref: I0003}]}: I0003 the back of I0001); portrait: a picture of ref's
//                          face (P…, one at most); unrelated: the
//                          file plainly not of the family (only why and sure then; the person hides it, never strom). POST <token>/material/sort/<id>/cancel
//                          {id, state, cancelled}. Refused 404 sort.none (no agent here {why}, an unknown sort), 503
//                          sort.not-ready {why} (+ Retry-After), 429 sort.queue (one at work and 3 queued), 429 sort.limit
//                          {per, most, cost} (read.app: a sort is one reading for each ten files it begins), 400
//                          material.body, 404 material.file, 423 locked, 403 app.only. /status sorts: the app's sorts
//                          queued or at work [{id, state, files, at, since, run?, part?, parts?}] (none in an archive)
//                          A run (51–1500 ids, V2a, feature material.sortRun): parts of 50 in the order of ids, each a sort of its own signed with
//                          its run, part (1…n) and parts (n) → 202 {id: <its first part>, state: "queued", run: "run-…",
//                          parts: [sort-…]}; one item of the queue; its first part counted against read.app as taken,
//                          each other one as it starts, only when read.app and its readers allow (else the run waits).
//                          GET <token>/material/sort/<run-…> {id, run: true, state: queued|working|done|cancelled|failed,
//                          files, filesDone, parts: [{id, part, state, files, filesDone?}], waiting?: {why: read.app |
//                          limit | …, retry?}} (ended: cancelled when a part was cancelled, else done when a part is done, else failed);
//                          POST …/<run-…>/cancel: its parts not done stopped, {id, state, cancelled}
//                          POST <token>/material/sort/<id|run-…>/decided {ids: [I…], how: accepted|refused|open} (spec 147
//                          K2, feature material.decided): what the person decided of the proposals of a sort done, kept
//                          in its record (nothing written to the research; open takes it back) → {id, decided: [{id, how,
//                          at}]}; GET of a sort done says them too (decided). Such a file is left (why accepted|refused)
//                          until a later sort proposes something of it. Refused 404 sort.none, 409 sort.state {state}
//                          (not done), 400 material.body (no ids, a file not of the sort, another how), 403 app.only.
//   POST <token>/source/retract    a source deleted by the person (spec 117 K1.1–K1.7, R4, J7; feature source.retract),
//                          in the app's dialog, in two steps: {sources: [S…] (1–50), dryRun: true} → {sources, dryRun:
//                          true, impacts: [{id, title, input?, counts: {persons: 0, names, events, families, stories},
//                          cites: [{owner, fact, event?, others, locator?, main?}], stories: [{owner, inText}], bare:
//                          [{owner, fact, event?}], lowered: [{owner, fact, event?, from, to}] (a bare one among them),
//                          conflicts: [{id, status, becomes: review|unchanged}], tasks: [{id, state, becomes: dropped|
//                          narrowed, heldBy?}], files: [I…], images, more: {…}}] (200 a list at most), confirm} (nothing
//                          written; confirm: signed by the bridge with the seal key over the sources and the impacts, 15
//                          minutes); {sources, confirm} → strom source retract --confirm (checked again under the
//                          tree's lock): {sources, retracted, impacts, head}. Impacts changed since: 409
//                          source.retract-changed {impacts}; no confirm that holds, a body it cannot read, more than
//                          50: 400 source.body; 404 source.unknown {id}; 409 source.retracted {id}; 403 source.readonly
//                          (+ reasonCode; not sealed here: no confirm); 409 source.busy (+ Retry-After); 500
//                          source.failed. No queue an agent could write to.
//   POST <token>/source/restore    sources the person deleted put back ({sources: [S…] (1–50)}): strom source restore;
//                          {restored, citations, skipped: [{source, owner, fact, event?, why: gone|already|main}],
//                          raised, tasks, conflicts, head}. 409 source.notRetracted {id} | source.notRestorable {id,
//                          why: merged|other}, otherwise as /source/retract.
//   POST <token>/conflict/keep     a decided conflict marked for review (a deleted source it stood on) kept as decided
//                          ({conflict: X…}): strom conflict keep; {conflict, head}. 404 conflict.unknown {id}, 409
//                          conflict.notMarked {id} (open, or no mark), 400 source.body, 403 source.readonly, 409
//                          source.busy (+ Retry-After), 500 source.failed.
//                          Every write of the app's (these, PUT /media, /batch/<id>/done, /waiting, /group) answers
//                          `head` after it and `parent`, the head just before it (nothing written: parent = head) —
//                          the app takes head as its version only when parent is the head it knew
//   GET <token>/media/<sha256>?thumb=128|256|512   a small JPEG preview of a file (core/thumbs.ts, kept in
//                          .strom/thumbs): 400 thumb.size, 404, 410 media.gone, 415 thumb.type (none of this kind here)
//   PUT <token>/lists/<id>  a list of people material is sent to ({name, kind: fixed|auto|work, rule?: the rule as the
//                          app says it, ruleData?, persons: [P…] as they are now, missing?: how many of its people the
//                          research has not got, at?}): kept by the bridge (.strom/lists/<id>.json; the same id again
//                          replaces it) until a file names it; {list, persons, unknown}. 400 list.bad-body, 413
//                          list.large, 403 app.only
//   PUT <token>/media/<sha256>   an original from the app, unchanged (the body; X-Strom-Name, -Person, -Source,
//                          -Region, -Note): streamed to disk, its hash checked, kept outside git
//                          (strom media original) — of a source an image, else material of people; a task for the
//                          agent (an intake task, a task to read the scan of a source) only with intake.auto on, else
//                          the file waits in the material: {input} or {known, added?} with no task (spec 130 K1.3);
//                          X-Strom-Batch, -Path (and -Zip: 1, a ZIP unpacked here): one file of a batch
//                          X-Strom-List-Ref: <id> — sent to a list of people (spec 137, media.list) the app put
//                          first (below): kept on the input (Input.list, its people as sent in notes/lists/), up to 50
//                          of its people the input's people too; with -Source (media.list.source) kept on the scan
//                          (Media.list), up to 50 of its people those of its task to read it; not with -Task, -Read,
//                          -Batch; 404 media.no-list {list} for a list not sent
//                          X-Strom-Family: F… (with commas; X-Strom-Person beside it too) — a couple's original
//                          (spec 108 V9, accepts.media.family): material of both partners (Input.families) with an
//                          intake task as for a person's with intake.auto on (put aside in an archive); media.bad-header for no F…, 404
//                          media.no-family {family} for a couple the research has not got; the place in the tree
//                          (familyPhoto) a send gives it
//                          X-Strom-Task: T… — a file for what a waiting task waits for: an input of its people
//                          handed to it, the task back in the queue (strom media original --task); for a task that
//                          waits for images of a book (accepts.media.taskImages) an image of it, X-Strom-Image: its
//                          number (else the name's, else the order of those missing; a task that does not know
//                          which images: the book's next free number, its waiting item's inbox.next), X-Strom-Replace:
//                          1 another scan there replaced — put into its folder of the inbox and registered from there
//                          Prefer: respond-async (feature media.queued; a batch's file or a person's or couple's
//                          material — never with X-Strom-Task, -Read, -Source): its kind and its end checked at once
//                          (415 media.type, 422 media.cut-short …), then queued (core/mediaqueue.ts: the bytes in the
//                          shared store's .incoming as *.queued, the job in .strom/media-queue, kept over the bridge's
//                          end) and answered 202 {sha, bytes, queued: true, batch?} with Preference-Applied:
//                          respond-async; the same file at the same place again one job. Written by the bridge's
//                          writer (core/livequeue.ts, strom media queued — one strom at a time, the tree's lock free
//                          between them): those of no batch a moment after (STROM_MEDIA_QUEUE_MS, 300 ms), a batch's
//                          with its close in one commit (or after 10 s with no file of it, STROM_MEDIA_BATCH_QUIET_MS).
//                          A file the research has is said at once as before (200 {known, kind, batch?, head, parent}).
//                          The writes run in the bridge's warm writer (core/warmwriter.ts), a strom started for each
//                          after it failed. Without Prefer: written before the answer, as before
//   POST <token>/media/known   what the research has of many files at once ({shas: [SHA-256] (at most 5000)},
//                          feature media.known): {known: {<sha>: {id, kind, mime, bytes, here} | {queued: true} |
//                          null}} — a working copy of a file of the app's tree by its own hash too, while its bytes are
//                          in the shared store (spec 133); 413 media.known-many {max}, 400 media.known-body. Read only. GET /media/<sha> of a
//                          queued file: 404 {known: null, queued: true}
//   POST <token>/batch/<id>/done   the batch is whole ({name, files, person, note, sort?: true|false}): with
//                          intake.auto on its files become sorting tasks, off (the default, spec 130) they wait in the
//                          material unsorted; sort decides for this batch alone (true on a batch closed unsorted: its
//                          tasks made then) (a batch nobody closes is closed a day after its last file, by the
//                          setting); its queued files written in the same commit; tasks [T…] (none: []), auto (the
//                          setting), sort (whether this batch is sorted by tasks); `files` says what became of each file
//                          of it [{sha, path?, input? | known? | refused?: {code, why} | zip?, added?, task?}]; 400
//                          batch.bad-body (sort no boolean). house?: "<key>" | "A…" (spec 030, feature house.material):
//                          its files (new and known) become the house's material, no sorting task unless sort: true —
//                          + house (A…); checked before anything is closed: 404 house.unknown, 400 house.body (+
//                          reasonCode house.town: its municipality no place record yet), 409 house.archive
//   POST <token>/waiting/<T…>   a request of a waiting task sent ({"do": "sent" | "unsent"}): strom task sent [--undo],
//                          the user's — a fact the person gives, never an answer or a decision; the task still waits.
//                          {"do": "sent", "at": "YYYY-MM-DD"} (feature waiting.sentDay, spec 149): the day it really went
//                          out (strom task sent --date), on a task marked sent already that day put right → {sent: [T… if
//                          changed], task, phase, sentAt, sentDay, head}; 400 waiting.bad-date {at} (no day, in the future),
//                          400 waiting.bad-body ("at" with unsent)
//                          {"do": "answer", "text", "expect"?}: the person's answer (strom task wake --answer), kept
//                          as theirs given in the app, the task back in the queue (feature waiting.answer) — an agent
//                          here is kept off the bridge's address by its hooks (core/bridgeguard.ts)
//                          A wait not written as strom needs it (feature tasks.audit, spec 109 U2, core/taskaudit.ts;
//                          /status waiting items carry `audit` {kinds, fix: whole|part|none, stamp} while it is so and
//                          the person did not keep it as it is): {"do": "fix", "expect"?: stamp} = strom task audit T…
//                          --fix (one book per task, the rest split off; what already lies in its folders taken) →
//                          {task, tasks: [T…, the ones split off], woke: [T… back in the queue], head, parent};
//                          {"do": "unfix"} = --unfix (while none of its tasks changed; the ones split off taken back) →
//                          {task, tasks, head, parent}; {"do": "keep", "expect"?: stamp} = --keep, {"do": "unkeep"} =
//                          --unkeep → {task, kept: {at, by, givenIn, kinds, wait} | null, head, parent} — as given in the
//                          app (givenIn app). Refused 409 waiting.changed {id, at} (fix, keep: the task changed since
//                          stamp), 409 audit.none {id} (nothing found, nothing to fix, undo or take back), 409
//                          audit.changed {id, changed} (unfix: these changed since the fix; `changed` [T…] beside), 404
//                          waiting.none {id}
//                          {"do": "retry", "expect"?: the item's at} (feature waiting.retry, spec 089, core/retry.ts):
//                          the task returned to the agent — strom task wake T… --retry, the person's in the app (givenIn
//                          app), no answer written; only an item whose /status `retry` says can → {task, state: "open",
//                          head, parent}; 409 retry.not {id} (none offered), 409 retry.limit {id, until}, 409
//                          waiting.changed {id, at}, 404 waiting.none {id}
//   GET <token>/waiting/<T…>/fix   the task's wait checked now (as strom task audit T… --json): {task, at, findings:
//                          [{kind, books?, unknown?, url?}], fix: {can, stamp, changes: [{op: wait-images | wait-book |
//                          split | folder, …}], left}, kept, fixed}; 404 waiting.none {id}, 409 audit.none {id}
//   POST <token>/group/<key>    the same for one place of What waits ({"do": "sent", "at"?: "YYYY-MM-DD"}: each of its
//                          requests still to be sent, all on that one day (+ sentDay); {"do": "unsent", "tasks": [T…]}:
//                          only those, when they are of it and sent; {"do":
//                          "retry"}: each of its items whose `retry` says can, returned to the agent at once in What
//                          waits' order → {retried: [T…], group, head, parent}, none: {retried: []} and nothing written)
//   GET <token>/group/<key>/note   the request texts of that place's tasks joined for one e-mail ({text, notes, tasks})
//   POST <token>/conflict/<X…>   refused (403 decide.link): a conflict is the person's to decide in the terminal, through
//                          the link conflict&do=decide — the bridge cannot tell the app from an agent on this computer
//   GET <token>/adopt      a new research waits for a tree of the app: its mark, name, until when; transfer: true when
//                          the tree comes from a browser the app cannot reach strom from; existing: true when it goes
//                          into a research made before, its tree never came (POST /adopt hands it over)
//   GET <token>/transfer   that tree's file as it came (strom-prenos-….json), only while the research waits for it
//   POST <token>/read      a document read at once ({files: [sha256], readers, lang, person, note, region}; its files sent
//                          first: PUT /media with X-Strom-Read: 1): queued, read one at a time (live-read.ts) — 202
//                          {read: D…}; /status reads and the event read follow it; never in an archive
//   GET <token>/read/<D…>  its result (what its readers wrote so far too); /read/<D…>/page/<n>.jpg each page's picture
//   POST <token>/read/<D…>/again {readers}, /read/<D…>/cancel; GET <token>/reads — the readings of the last 90 days
//                          (feature read.choose: /status accepts.read.choices — the agents, models, efforts each reader
//                          may read with and the defaults; "with": [{agent, model, effort}] per reader in POST /read and
//                          again; readers.who in the result, who (no modelName) in /status reads and /reads; feature
//                          read.choices.now: each model's now/nowName — what an alias last ran on here, when known;
//                          feature read.variantKind: each variant's kind in the result, entries[].variants and
//                          source.variants — core/variantkind.ts; feature read.readerState: each reader's state
//                          queued|reading|done|failed and secs in who, failure.reader)
//   POST <token>/sources/read {source, clip, readers, lang, with, taskChoice}: a source's record read again from its
//                          original here, never from its transcript (feature read.source) — 202 {read, state, version,
//                          source}; its result's source {id, agree, variants, task}, nothing of the source changed;
//                          404 read.source.none, 409 read.source.noscan | notext | running (+read). A task only of a
//                          matter of fact both readers are sure of (variants[].sure false: not; judged: T… an earlier
//                          task held it or a wording the person declined, D… the person just kept that reading).
//                          taskChoice true (feature read.sourceTask): as read.sourceTask says (/status
//                          accepts.read.sourceTask ask|always|never) — the result's source: taskSetting, taskOffer (places
//                          the person may decide on), task + taskFor agent|person (person: a wording proposed for their
//                          review of a transcript they confirmed), decided saved (just kept), openTask (the source's task
//                          not ended a task chosen would go into), appended (the places went into it), state (as /status
//                          readAgain), unsureOffer (feature read.sourceTask.unsure: no matter of fact sure left to
//                          decide, places not sure no task holds — the person may hand them over; a transcript they
//                          confirmed: only with a place the new reading read, found in it); without taskChoice
//                          (an older app): a task at once, as before
//   POST <token>/sources/<S…>/read/<D…>/task {"how": "now"|"queue"|"save"|"review"}: the person's word on that reading
//                          (strom source reading; save = just keep; review only for a transcript the person confirmed,
//                          now|queue never for one) — {ok, source, reading, how, task?, taskFor?, appended?, chat? (now:
//                          strom-research://task?…&do=chat), head, parent}; 400 read.decide.invalid, 404 read.decide.none
//                          | noreading, 409 read.decide.task (+task) | done | nothing | confirmed | unconfirmed |
//                          noproposal | declined, 503 research.busy. With "unsure": true (feature
//                          read.sourceTask.unsure; how queue or review alone, else 400): the reading's places not sure
//                          handed over by the person's word — queue: a task of the agent's to look at each on the scan,
//                          review: a wording proposed to the person; {…, unsure: true}; 409 read.decide.sure (a matter
//                          of fact sure waits: decide without unsure) | nothing (no place not sure left unjudged)
//   POST <token>/sourceTask {"sourceTask": "ask"|"always"|"never"}: what a source read again that differs in a matter of
//                          fact becomes in this research (read.sourceTask in its strom.json) — {ok, sourceTask, head,
//                          parent}; 400 sourceTask.invalid, 409 sourceTask.archive, 503 research.busy. /status readAgain
//                          {"S…": {read, state unchecked|saved|task, task?, taskFor?, taskOpen?, taskQueued?, minorOnly?,
//                          unsureOnly?, unsureOffer?, proposal? {text, by, task, at}}}: each source whose newest reading again differs
//                          (core/sourceread.ts readAgainOf; none in an archive or a research waiting for its agent)
//                          The Strom file: 1 _STROM_ORIG Y under SOUR where the original is here and a transcript to
//                          hold a reading against (APP_READS_SOURCES_AGAIN; never in an archive)
//   GET <token>/history    what the ancestors lived through (the experiment experiments.history, core/pastevents.ts):
//                          the events at the places of the tree's facts, the places with their state, what the person
//                          hid, the state of the search and its rev (an archive's too; what was found stays while off);
//                          at most 3000 events and 5000 places (those with events first): state.truncated; the regions
//                          of the tree's places (never limited): state, order, weight, events, hidden, gaps and fill;
//                          each place's regions, people, why, manual, redo + note, skip, its record (feature history.regions);
//                          kindsFill {kinds, state: queued|running} on a region and a place whose kinds turned on are being
//                          looked for (align); an event hidden by align has by "align" and align <its undo>
//   GET <token>/history/align[?kinds=war,epidemic]   what aligning the history with the kinds looked for would do (strom
//                          history align --json, the events' IDs left out; ?kinds=: were these looked for, nothing set):
//                          {kinds, plan (its mark), hide {general, local: {n, kinds}}, show {n, kinds}, backfill [{region |
//                          place, label, kinds, years?}], sessions, pace, busy, shared {n, kinds}} — read only; 400
//                          history.kinds.body, 409 history.archive, 503 research.busy (+ Retry-After) (feature history.align)
//   POST <token>/history/align {plan, hide: true, backfill: true}: done on the person's click after that preview — hidden
//                          and shown again here (free; strom history align --yes --only-hide --plan): {done {hidden, shown,
//                          tasks: 0}, undo?, backfill?, head, parent}; the tasks for the kinds turned on spend sessions and
//                          are never raised here: backfill {said, code history.align.link, link strom-research://history-align
//                          ?tree=…, n, sessions, pace} (403 when nothing was hidden). 409 history.align.changed with the
//                          preview as it is now, 400 history.align.body, 409 history.archive, 503 research.busy
//   POST <token>/history/align/undo {undo}: that align taken back (its events shown again, the hides it took away back;
//                          its tasks stay) — {undone {shown, hidden}, head, parent}; 404 history.align.undo, 409
//                          history.align.undone, 400 history.align.body
//   GET <token>/sources/split[?all=1]   what splitting the older sources' locators into folio and image would do (strom
//                          source split --json): {split [{source, title, before {locator?, folio?, image?}, after {…}}]
//                          (the first 10, ?all=1 every one), count, unrecognized, unrecognizedExamples (up to 3 of their
//                          locators, the location's text alone), nothing, undos [{id, at, sources}], plan (its mark)} — read only; 409 source.split.archive, 503 research.busy (feature sources.split)
//   POST <token>/sources/split {plan}: done on the person's click after that preview, as the user's (strom source split
//                          --apply --plan): {done {split: n}, undo, head, parent} — nothing else of the tree changes; 409
//                          source.split.plan with the preview as it is now, 409 source.split.archive, 400 source.split.body
//   POST <token>/sources/split/undo {undo}: that split taken back whole (strom source split --undo) — {undone {restored:
//                          n}, head, parent}; 404 source.split.undo, 409 source.split.changed {count, sources [{id, title}]
//                          (the first 5)}: changed since, nothing undone; 400 source.split.body
//   POST <token>/history/kinds {kinds: [...], scope: "tree" | "default"} | {scope: "tree", inherit: true}: the kinds of
//                          history looked for, a kind left out at once (strom config set history.kinds … [--for-tree];
//                          default: this computer's, for the researches without their own) — {experiments {kinds,
//                          kindsOwn, kindsDefault}, alignSuggested, head, parent}; a kind added is the person's alone: 403
//                          history.kinds.link with the link strom-research://history-kinds?tree=…&kinds=…&scope=…
//                          (inherit=1) and added — the whole change there; 400 history.kinds.body, 409 history.archive, 503
//                          research.busy (feature history.kinds). /status experiments.kinds, kindsOwn, kindsDefault
//   POST <token>/history/hide   an event hidden at a place, a person or in the whole tree ({event, place} | {event,
//                          person} | {event, tree: true}), or everything of a region ({region}); "do": "show" shows it
//                          again: strom history hide|show, the person's; {hidden, head, parent} — refused 400
//                          history.body, 404 history.event|history.person|history.region, 503 research.busy (+
//                          Retry-After); an archive's too (features history.hide, history.hide.all)
//   POST <token>/history/skip   {region} | {place}, "do": "undo" to look for it again: no history of a region or at a
//                          place in this research (strom history skip|unskip, the person's) — {skip: {regions, places},
//                          head, parent}; refused 400 history.body, 404 history.region|history.place, 503 research.busy
//                          (feature history.skip)
//   POST <token>/history/delete {event}, "do": "restore" to bring it back: an event deleted by the person (strom history
//                          delete|restore) — a region's from every tree on this computer, a local one from this tree;
//                          never written again by the research until restored. {event, scope, deleted, head, parent};
//                          GET /history `deleted` lists them with what their row needs. Refused 400 history.body, 404
//                          history.event, 409 history.retracted, 503 research.busy (features history.delete, history.delete.restore)
//   POST <token>/history/map    a place's regions as the person knows them ({place, regions: [{id, from?, to?}]}), the
//                          place determined again ({place, redo: true, note?}: at most 200 characters after NFC) or back
//                          to the research ({place, do: "auto"}): strom history assign, the person's; the research never
//                          maps a place so assigned — {place, map, head, parent}; refused 400 history.body, 404
//                          history.region|history.place, 503 research.busy (feature history.map)
//   POST <token>/history/first  {region}: that region's history first of the regions (the app's person card: its places'
//                          region with no catalog yet) — strom history first, the person's; still at history's next turn
//                          (the pace). {region, task?, first: [{region, at}]}; refused only while the history of the
//                          regions is on: 409 history.off (+ link name=regions: turning it on is the person's, in the terminal), 409 history.archive |
//                          history.done | history.skipped, 404 history.region (no place of the tree in it yet), 400 history.body,
//                          503 research.busy
//   POST <token>/history/place  {place: "L…"}: the history of a place and its surroundings — never started here (it
//                          spends a session): always 403 history.link with the link strom-research://history?tree=…&place=
//                          L…&do=search (the estimate and the person's yes in the terminal; the task on top of the queue)
//                          and the estimate; refused 400 history.body, 404 history.place, 409 history.off while the
//                          history of the places is off (+ link name=placeHistory) |
//                          history.archive (feature history.place). /status history.placeEstimate {minutes, usd?: three
//                          measured sessions}, history.placesAuto (read only); GET /history places[x].history|at|why|area,
//                          events scope "place" with place {key, id?, name}, suggest [L…]
//   POST <token>/stories   {"history": false|true}: the history of the places in the stories of this research
//                          (stories.history in its strom.json; the person's own config stays) — {stories, head, parent};
//                          refused 400 stories.body, 409 history.off (+ link: the history itself is turned on by the
//                          person, in the terminal), 503 research.busy (feature stories.history). /status: stories.history
//                          (on while the history is on, unless turned off); an approved story is never rewritten for it
//   POST <token>/hypotheses {"decide": "person"|"agent"}: who decides the hypotheses of this research (hypotheses.decide in
//                          its strom.json) — {ok, decide, head, parent}; "agent" is the person's alone: 403 hypotheses.link
//                          with the link strom-research://hypotheses?tree=…&decide=agent (the terminal asks); 400
//                          hypotheses.invalid, 409 hypotheses.archive, 503 research.busy (feature hypotheses.decide).
//                          /status hypotheses {decide} (none in an archive or a research waiting for its agent)
//   POST <token>/sources/confirm {"source": "S…", "txt": "<its _TXT>", "confirm": true|false}: the user confirms the
//                          research's transcript of a source (the user's reading of that wording), or takes it back —
//                          {ok, source, read, conf?, txt, head, parent}; the same state again: 200, nothing written;
//                          400 confirm.invalid, 404 confirm.none, 409 confirm.archive | confirm.merged (+into) |
//                          confirm.retracted (taking back passes) | confirm.reader (not the research's reading, or the
//                          user's own of another kind) | confirm.changed (+txt: the wording now), 503 research.busy
//                          (feature sources.confirm). The Strom file: 2 _TXT, 2 _CONF under 1 _STROM_READ (APP_CONFIRMS_TRANSCRIPTS)
//   POST <token>/facts/revert {"person": "P…", "ref": "<its 3 _REF>", "part"?: "DATE"|"PLAC"|"VAL"|"GIVN"|"SURN"|"SEX"}:
//                          the user puts back what an imported family tree said of a value the research or they changed
//                          (the Strom file's 2 _STROM_WAS: E… a fact, N:P…:<n> a name, SEX:P… a sex; without part every
//                          part changed) — strom event revert | person revert as the person's, the value theirs from then
//                          on — {ok, reverted: {owner, ref, parts}, head, parent}; 400 revert.invalid, 404 revert.unknown
//                          (no such value, or not the person's), 409 revert.nothing (nothing changed to put back), 503
//                          research.busy (feature origin). The Strom file: _STROM_ORIGIN, _STROM_WAS (APP_SHOWS_ORIGIN).
//                          Feature origin.import: a send marking a value of an import (_STROM_IMPORT Ix) that an earlier
//                          send wrote as the person's own — the same since, unconfirmed, nothing kept to put back — makes
//                          it the import's (strom sync's change origin.import, the person's sync alone; an undo puts it back)
//   POST <token>/verify {"person": "P…"} | {"family": "F…"} | {"fact": "E…" | "P….N"}, "dry"?: true: the user asks the facts
//                          verified against their originals (spec 065; strom verify facts … --living), first in the
//                          queue — {ok, task|null, state?: wait|asked|images|permission, position? (wait, asked: the
//                          task's place in the queue), tasks?: [{task, state, position?, facts}] (not dry: every task
//                          it touches, nearest to its turn first, the first on top), facts: [{fact, kind, how:
//                          read|search, record?: {source, title, page?}, with?}], estimate: {sessions, usd?}, head, parent};
//                          the name of a person's identity (spec 066 P5, feature name-status) as a fact: fact P0012.N,
//                          kind NAME; read together with the person's birth or baptism (BIRT, CHR, BAPM) whose
//                          original it cites too — either asked for brings the other along, first the name, each
//                          saying the other in with (the fact's id, P….N); facts and tasks' facts hold P….N too;
//                          dry: nothing written, head == parent; 400 verify.invalid, 404 verify.unknown,
//                          409 verify.archive | verify.nothing | verify.retracted, 503 research.busy (feature verify)
//   POST <token>/verify/bulk {"scope": "line"|"lineage"|"tree", "of"?: "G…"|"P…", "order"?: "ancestors"|"weakest"|
//                          "oldest", "try"?: n, "budget"?: usd, "dry"?: true}: the user's bulk verification (strom verify
//                          bulk), after the lines' work; a family tree's leads too, their record looked for — {ok,
//                          people, facts, how: {read, search} (of the facts), tasks (not dry), left, estimate, head,
//                          parent}; 400 verify.invalid, 404 verify.unknown, 409 verify.archive | verify.nothing, 503
//                          research.busy (feature verify.bulk). Not dry: first (a try's tasks first in the queue, as
//                          the person's "verify" — spec 065 K7.1) and working (a run or a session at work now: the app
//                          offers the link work?do=tasks&task=<tasks> only when false — K7.2) — feature verify.tryFirst
//   POST <token>/verify/stop {"scope"?: "all"|"bulk"}: the user stops the verification (strom verify stop [--bulk]) —
//                          the tasks nobody started dropped, one at work goes on, their facts not queued again by
//                          themselves — {ok, dropped, facts, head, parent}; nothing to stop: dropped 0, nothing written;
//                          400 verify.invalid, 409 verify.archive, 503 research.busy (feature verify.stop)
//   POST <token>/facts/confirm {"fact": "E…" | "P….N", "txt"?: "<its 3 _TXT>", "confirm": true|false}: the user confirms a
//                          fact against the scan, or takes it back (strom verify confirm E… [--undo] [--txt]; an archive's
//                          too) — {ok, fact, owner, confirmed?, head, parent}; the same state again: 200, nothing written;
//                          txt: the mark of the value the app showed (the Strom file's 3 _TXT under 2 _STROM_EID), a fact
//                          changed since refused 409 confirm.changed (+txt: the mark now, now: {date?, place?, value?}),
//                          nothing written; without txt as before; 400 factconfirm.invalid, 404 factconfirm.unknown, 409
//                          factconfirm.retracted | factconfirm.merged, 503 research.busy (features facts.confirm,
//                          facts.confirm.value). The name of a person's identity (spec 066 P5, feature name-status):
//                          fact P0012.N (the Strom file's 2 _STROM_EID under its NAME) — {ok, fact: "P0012.N", owner:
//                          "P0012", confirmed?, head, parent}, its status as it is, tasks of verification leave it; a name
//                          changed since 409 confirm.changed with now: {given, surname}; 404 factconfirm.unknown (no such
//                          person, or no name), 409 factconfirm.retracted | factconfirm.merged (the person).
//                          /status verify {waiting, asked, images, permission, kept, confirmed,
//                          fix?: {at, facts, people}} (none in an archive or a research waiting for its agent; the names
//                          of people's identities counted with the facts). The Strom
//                          file: 2 _STROM_EID, _STROM_CONFIRMED, _STROM_VERIFY (3 _POS), _STROM_CHECKED (APP_SHOWS_VERIFY;
//                          under NAME, its 2 _STROM_EID P….N: APP_READS_NAME_STATUS, where features say name-status)
//   POST <token>/sources/proposal {"source": "S…", "task": "T…", "take": "proposal"|"keep"|"undo", "proposed"?: "<mark>"}:
//                          the user decides a new wording an agent proposed for a transcript they read (core/proposal.ts;
//                          the waiting item of kind transcript carries it, with its mark): taken as theirs (read.user,
//                          confirm) or the transcript kept (the wording never proposed again); undo takes the decision of
//                          that task back (the transcript and their reading as before, their confirmation too; the
//                          proposal waits again) — {ok, source, read?, conf?, txt, task, take, head, parent}; 400
//                          proposal.invalid, 404 proposal.none, 409 proposal.archive | proposal.decided | proposal.changed
//                          (+proposed: the mark now; undo: the transcript changed since, or another wording waits) |
//                          proposal.undo (nothing to undo), 503 research.busy (features sources.proposal, sources.proposal.undo)
//   POST <token>/experiments   {"regions": false} | {"places": false} | {"history": false} (both) |
//                          {"historyPlaces": false} (each place's history by itself): off for this research (its
//                          strom.json; the person's own config stays; off already: 200, nothing written) — {experiments,
//                          head, parent}; true is refused (403 experiments.link with the link strom-research://experiment…
//                          &name=regions|placeHistory|history&do=on: only a person turns it on, in the terminal the link
//                          opens) (feature experiments.split for regions|places). /status: experiments.history (either
//                          is on), experiments.regions, experiments.places, experiments.historyPace
//                          (how often: sometimes|rare|idle — read only: the person's own choice, in the terminal, the
//                          setup or the settings; a body with it is refused 400 experiments.body), history.rev; the event
//                          history {rev} when what GET /history answers changed without a new commit
//   GET <token>/surnames   the forms of a surname that are one family's (core/surnames.ts): {rev, groups, rejected,
//                          suggestions, state {truncated, persons, skipped}} — what the research suggests from its
//                          records and what the person decided (quality/surnames.json); read in an archive too, and in
//                          a research waiting for its agent; 503 research.busy (+ Retry-After) while the research is
//                          being written (features surnames.suggest, surnames.read). The person's groups and rejections
//                          come back by strom sync (the Strom file's header notes), never written here
//   POST <token>/duplicates  two people the app shows as a possible duplicate, judged by the research (core/duplicates.ts):
//                          {"pairs": [["P…", "P…"], …]} (at most 1000) → {rev, verdicts: [{pair, verdict?, reason,
//                          years?, into?, at?, by?}]} — read only, nothing written; 400 duplicates.body, 503 research.busy
//                          (+ Retry-After) while the research is being written (feature duplicates.judge)
//   POST <token>/quality/dismiss  a finding of the app's validation marked no error by the person ({kind, persons,
//                          subject?}, "do": "undo" to take it back): strom quality dismiss|undo, by "app" → {ok, rev};
//                          400 quality.body, 404 person.no-match {person}, 503 research.busy (feature quality.dismiss)
//   GET <token>/places     the places of the facts and the research's place records (core/placesview.ts): {rev, places:
//                          {L…: {name, names [{name, lang?, from?, to?, kind?: form|alt}] (each once; feature
//                          places.nameKinds), country?, district?, parish?, parent?, jurisdictions, coords?, state?, by?,
//                          at?, why?, source?, verified?, checkWhy?, needs?, waiting?, current?, forms, facts, persons}},
//                          forms: {<as the facts write it>: {place} | {state} | {}}, queue {queued, running, batches,
//                          estimate {minutes, usd?: three measured sessions}}, counts {offMap, placed, proposed,
//                          unlocated}}; read in an archive too; 503 research.busy while written (feature places.identify)
//   POST <token>/places/identify  {"do": "queue"|"cancel", forms?, places?, all?: offmap|placed|queued, check?, flags?}:
//                          strom place queue|unqueue, the person's, free — {ok, queued, cancelled?, skipped, queue};
//                          400 places.body, 409 places.archive, 503 research.busy; a run asked for (and POST
//                          <token>/places/run): 403 places.link with strom-research://places?tree=…&do=run[&place=L…]
//   POST <token>/places/answer  {place, take, expect?} | {places, take: first|keep, dry?, expect?}: strom place answer,
//                          the person's — {ok, place, undo, head, parent} | {ok, done, skipped, undo} | dry {places,
//                          facts}; 400 places.body, 409 places.changed {place}, 503 research.busy (feature places.answer)
//   POST <token>/places/undo  {undo}: strom place undo — {ok, restored, places, head}; 409 places.undo.later (feature
//                          places.undo). The questions of places wait in /status waiting as kind "place" (section decide)
//   GET <token>/quality    what the person marked no error (quality/dismissed.json): {rev, dismissed}; read in an archive
//                          too (feature quality.read). /status: quality.rev; the event quality {rev} when the file changed
//   GET <token>/health     the tree check's reports (spec 091, core/audit.ts): {rev, reports: [{id C…, at, scope, ai,
//                          changed?, head?, task?, state built|queued|running|done|stopped|failed, done?, total?,
//                          findings?, counts {new, accepted, dismissed}, reason?, order?, summary?, lang}]} newest
//                          first, at most 10; GET <token>/health/<C…> {report (+ builtin), findings}, 404 health.unknown;
//                          GET <token>/health/builtin[?scope=tree|line:G…|person:P…] {builtin} (core/health.ts), 400
//                          health.scope; read in an archive too (its built-in reports alone), 503 research.busy while
//                          written (feature health). /status: health {rev, last?, before?, left?}
//   POST <token>/health    {ai: [A–L], scope?, changed?, dry?}: strom health --ai, a task first in the queue — {id, task,
//                          estimate, head, parent} | dry {estimate, head, parent}; 400 health.body | health.scope, 409
//                          health.archive | health.running {id, task}; POST <token>/health/stop {id?}: strom health stop
//                          — {ok, id, state}, 404 health.none (feature health.ai)
//   POST <token>/audit/<id>  {do: accept|dismiss|undo, expect?}: strom audit accept|dismiss|undo by "app" — {finding,
//                          rev}; POST <token>/audit {ids, do, expect?} {findings, rev} (one commit); 400 audit.body, 404
//                          audit.unknown, 409 audit.started | health.rev {rev} (feature audit.decide). Never a device's
//   GET <token>/directions/people  who is in which line: {people: {P…: [G…, …]}, places, lines, branches, rev, head} —
//                          people: the narrowest line first, only active and paused ones; a line of descendants: its
//                          person and their descendants within its generations (the app loads it when head changes;
//                          feature directions.people). places: every person's places among the lines by the rule the
//                          queue places tasks by (core/offline.ts personPlaces; done lines too) {P…: [{line?, role:
//                          line|partner|branch|island, branch?: B-P…}]}, a person outside them all absent — what the
//                          Strom file says (_STROM_DIRECTION); lines [{id, name, direction, focus, state}]; branches
//                          [{id, person, via {person, rel}, nearest?, line?, mode?}]; rev its fingerprint, /status
//                          directions.rev (feature directions.places). An archive: all empty, no rev
//   POST <token>/directions  {person, direction: ancestors|descendants|question, name?, question?, limits?:
//                          {generations?, before?}, note?, branch?}: strom research new (+ strom intake --text … --research
//                          G… for note) — {direction, head, parent}, the line last in the order of work; its tasks come
//                          with the next run. name missing: made in the research's language. branch (B-P…): strom research
//                          new --branch — the branch goes with the new line, its proposal answered (404 offline.none: no
//                          such branch now, nothing made).
//                          400 directions.body, 404 directions.person, 409 directions.exists {existing {id, name, state}}
//                          (the same person and kind — a question: the same question — in any state). moveTasks:
//                          true|false (feature directions.move): --move-tasks | --keep-tasks, the tasks of the wider
//                          lines it is inside about its people only (open or waiting, no line paused) — moved: n more
//   POST <token>/directions/preview  the same body: nothing written — {ok, inside: [the wider lines it would be inside],
//                          move: how many of their tasks would move} (move 0: nothing to ask; feature directions.move)
//   POST <token>/directions/<G…>/gather/undo  strom research gather G… --undo: the line's last taking given back —
//                          {ok, back: n, head, parent}; 409 gather.none (nothing taken), 404 directions.none
//   POST <token>/directions/<G…>  {name?, question?, limits?: {generations?: n|null, before?: y|null}, reason?}: strom
//                          research edit (null: no limit; reason: why a paused line waits) — {direction, effect?: {said,
//                          outside, back?}, head, parent}; effect only when a limit moved tasks (none deleted: they wait
//                          outside the line). 400 directions.body, 404 directions.none (feature directions.edit)
//   POST <token>/directions/<G…>/state  {do: pause|done|resume, reason?}: strom research pause|done|resume — {direction,
//                          head, parent} (in that state already: head = parent). 400 directions.body, 404 directions.none
//   POST <token>/directions/order  {order: [G…, …]}: strom research order — {order: [every line in the new order],
//                          ignored?: [IDs no line has], head, parent}; the lines not named after the named ones in their
//                          order until now. 400 directions.body (feature directions.order)
//                          Every write of the lines: 409 directions.archive (an archive, a research waiting for its
//                          agent), 503 research.busy (+ Retry-After), 423 locked, 507 disk.full. /status: researches[] in
//                          the order of work with order, limits, question?, review?, created, parent?, found? {days,
//                          sessions, persons, sources, people} (the line's sessions of the last 7 days; missing when
//                          they added nobody and no source; feature directions.found); caps {directionsWrite, directionsOrder, orderMode: weight|strict,
//                          directionKinds, duplicateDirections: false, offLineBranches: true} — not in an archive
//                          The work off the lines (spec 038 K7, feature offLine.branches; never in an archive or a
//                          research waiting for its agent): /status offLine (only with two lines or more) {mode:
//                          occasional|last|normal|never, own (the person's, not the default), share, suggest, tasks,
//                          queued, ownTasks, branches: [{id: B-P…, person, via {person, rel: sibling|partner|child|
//                          parent|other}, nearest?, tasks, persons, samples [{id, text}] (in the order of the queue),
//                          mode (+ line), line?, own, grows?}]}; a branch that grows waits in /status waiting as kind
//                          "branch" {id: W-B-P…, branch, person, research?, tasks, persons, at, what}
//                          A send of the Strom app that added many people as the person's own (an older app marked no
//                          import; 1127, feature waiting.import, sync.importAsk — default 20, 0 never): kind "import",
//                          section decide, group app, actions [answer] {id: W-S-I…, input, day, persons, samples [{id,
//                          name}] (3), at, what} — in an archive too (the person's data; the only item there)
//   GET <token>/waiting/W-S-I…/preview  what the answer import changes, read from the history (strom sync as-import I…
//                          --json, nothing written): {input, day, persons, change {values, persons, names, sexes, facts},
//                          stay {values, changed, confirmed, was, other}, done, samples [{id, name, values}], values,
//                          answer?, source?}; 404 waiting.none (answered, no longer asked), 503 research.busy (+ Retry-After)
//   GET <token>/offline/<B-…>   one branch and all its open tasks (those not taken too): {branch, tasks: [{id, text,
//                          pos?, person?, own?}]}; 404 offline.none, 409 directions.archive, 503 research.busy
//   GET <token>/queue      a page of the whole queue (feature queue.page): ?from=<0…> (among the tasks the filter
//                          leaves) &count=<1…100, 50> &branch=B-P… &research=G… &state=next|parked &kind=<a kind of
//                          core/taskkind.ts: verify, records, material, places, enrich, request, story, history, census,
//                          house, other; feature queue.kind> &known=<kind>[,<kind>…] (feature census: at most 20, each
//                          [a-z.]{1,32}; with kind=other only, else ignored): kind=other without it gives every kind past
//                          spec 065's too (census, house), known= keeps the kinds it names out — {items (as /status
//                          queue[], with pos), total (what the filter leaves), from, next? (from of the next page), head};
//                          in the order of the queue, those put aside after it without pos; an archive: none. 400
//                          queue.query, 503 research.busy (+ Retry-After). &q=<1…100 characters> (feature queue.search):
//                          only the tasks the filters leave that hold every word of it, with any accent or none — in
//                          the task's text, its people's names, its record sets (title, call number, archive, places),
//                          its ID and its people's; never its line or branch — still in the order of the queue, then
//                          paged; + q (as searched, trimmed), match? {T…: id|person} (the rows of the page found by
//                          their number alone), elsewhere? {id, state} (a task number out of the queue: done, waiting…).
//                          A task number (T0123, t123, 123): that task first, then the texts holding the number; a
//                          person's (P12): the tasks about them. What was searched is never written (live.log: q=…)
//   POST <token>/offline/<B-…>  {mode: occasional|last|normal|never|default} | {mode: "line", line: G…}: strom offline
//                          set (for the branch's new tasks too) — {branch, head, parent}; 400 offline.body, 404
//                          offline.none, 404 directions.none (the line)
//   POST <token>/runs/stop  {run: run-…}: the run finishes the task at work and starts no next one (strom run stop) —
//                          {ok, run: {as runs[] has it, state: finishing}}; 404 runs.unknown, 400 runs.body (feature
//                          run.stop; the link finish?run=… finishes it at once: the agent writes down what it found)
//   POST <token>/settings/runs  {max: 1…10}: lower — strom config set run.parallel n (the runs at work go on) — {ok,
//                          limits}; higher: 403 runs.raise {command} (only the person raises it, in the terminal);
//                          400 runs.max (feature run.limit)
//   POST <token>/settings/run  {"confirm": "ask" | "no"} (exactly; spec 123 P2, feature run.confirm): the question before
//                          the agent starts from the app's links (run.confirm, this computer's — every research; /status
//                          work.confirm) — "ask": strom config unset run.confirm, from anywhere; "no": strom config set
//                          run.confirm no, only the Strom app on this computer (one line in live.log), else 403 run.raise
//                          {command, reason: device|browser} — {run {confirm}} (as it holds already: nothing written);
//                          400 run.body, 409 run.archive (+ reasonCode), 503 research.busy, 500 run.failed
//   POST <token>/live      {idleMinutes: 0…10080}: strom config set live.idleMinutes (this computer's, every bridge takes
//                          it; nothing committed) — {live: {idleMinutes, idleChoices}} as /status live says it (feature
//                          live.idle) — or {do: "stop"}: 202 {stopping: true}, ended as strom live stop ends it (end
//                          {reason: stopped, back: false, by: "app"}) but its address kept, never brought back by new
//                          work in the tree (feature live.stop; the link live&do=start starts it again: live.start); 400
//                          live.body, 503 research.busy, 500 live.failed
//   POST <token>/offline   {mode?: occasional|last|normal|never|default, suggest?: true|false}: strom config set
//                          queue.offLine … / queue.suggestLines yes|no --for-tree (default: config unset) — {offLine
//                          (without branches), head, parent}; 400 offline.body
//   POST <token>/books     {minTasks?: 1…999|"default", sameBook?: yes|no|"default"} (at least one): strom config set
//                          books.minTasks … / queue.sameBook … --for-tree ("default": config unset --for-tree) — {books
//                          {settings} (as /status books.settings), head, parent (head when nothing changed)}; feature
//                          books; 400 books.body, 409 directions.archive, 503 research.busy
//   POST <token>/census    {"on": true|false} (exactly): census records as a source of this research — strom config set
//                          census on|off --for-tree, the person's decision in the app (no window, no link) — {census
//                          {on, held}, head, parent (head when the value holds already: nothing written)}; feature
//                          census; 400 census.body, 409 census.archive (an archive, a research waiting for its agent),
//                          409 seal.foreign | tree.not-downloaded, 423 locked, 503 research.busy (+ Retry-After), 507
//                          disk.full, 500 census.failed (+ reasonCode). /status census {on, held}: always there; held —
//                          the census tasks open or waiting kept out of the queue and What waits while it is off (one at
//                          work not counted: its session finishes it), 0 while on, in an archive and where the research
//                          waits for its agent
//   GET <token>/houses     the research's houses (spec 030 §4.2, feature house): {rev, houses: [{id?, key, place {key,
//                          id?, name}, house, name?, numbers? [{number, from?, to?, certainty}], persons, years?, state
//                          (none | queued | running | done | waiting | held), at?, task?, work? (takeover | house | town),
//                          question? {id: T…, text}, summary {events, holders, residents, unknown, materials, passed}}]}
//                          — the houses with a record, a task or a material (none only of the tree's facts); read in an
//                          archive too; 503 research.busy (+ Retry-After). rev: the fingerprint of the houses, their
//                          tasks, their material and their municipalities' skeletons (core/houses.ts housesRev), as
//                          /status houses.rev
//   GET <token>/houses/<key|A…>  one house whole (spec 030 §2.4 as §4.2 says it; the key URL-encoded, | as %7C): {id?,
//                          key, place, house, name?, nameBy?, state, at?, task?, work?, question?, persons [P…], years?,
//                          numbers, location?, timeline, holders, residents, look?, maps?, passed, manual, unknown,
//                          archiveOnly, materials [{id: I…, kind: own-research | file | memory, title, at, file?}],
//                          sensitive?, same? [{id: A…, key}] (records of the same house the person joined in the
//                          app: its _HOUSE _SAME, read by POST /sync), town? {id, text?, passed, manual, archiveOnly,
//                          maps} (its municipality's skeleton), rev} — every item with its id (n…, e…, h…, r…, p…, o…, u…, a…, m…), a maps[]
//                          item may name a layer of /status houses.layers (layer: its id), no recent; a house of the
//                          tree's facts alone too (state none, its lists empty); 404 house.unknown, 503
//                          research.busy
//   POST <token>/houses/confirm  {house: <key|A…>, what: renumber|location|notSame, id?: n…, lat?, lon?}: the person's
//                          word on a house in the app — strom house confirm in the app's environment (no window) — {house
//                          (as GET /houses/<key>), head, parent}; feature house.confirm; 400 house.body, 404
//                          house.unknown (also a house the research has no record of), 409 house.archive (+ reasonCode),
//                          409 seal.foreign | tree.not-downloaded, 423 locked, 503 research.busy (+ Retry-After), 507
//                          disk.full, 500 house.failed
//   POST <token>/houses/material  {house: <key|A…>, memory?: {text, witness?, witnessConsent}, name?, files?: [I…]} (one
//                          at least): files of the research made the house's, a memory written down as a material of it
//                          (the witness kept only with witnessConsent true), the house's name after a family (the
//                          person's: nameBy user) — strom house add material, then strom house add name; no task; a house
//                          of the tree's facts gets its record — {house (as GET /houses/<key>), head, parent}; feature
//                          house.material (files sent now: POST <token>/batch/<id>/done with house); errors as
//                          /houses/confirm (400 house.body + reasonCode house.town: its municipality no place record
//                          yet; 404 house.unknown {file} for a material not in the research). /status houses {on, rev,
//                          counts {done, running, queued, waiting, held}, auto? {houses, towns}, estimate? {houses,
//                          towns, minutes, usd?, measured, perHouse {minutes, usd?}, perTown {minutes, usd?}}, layers?
//                          [{id, kind?, label, type: wms, url, layers, format?, attribution, license, minZoom?, bbox
//                          [w, s, e, n]}]}: always there (feature house) — on, the setting houses as it holds here (the
//                          tree's own value both ways); counts by state, held the tasks of houses the setting off keeps
//                          aside (core/houses.ts housesHeldCount); auto, estimate (core/houseauto.ts) once the tree's
//                          facts give a house; layers (assets/maplayers.json, core/maplayers.ts) those whose bbox holds a
//                          municipality of a house, else left out (a house's maps[] item refers to one: layer); an
//                          archive or a research waiting for its agent: on false, zeros, nothing more. The link
//                          house?tree=…&do=import (feature house.import, not in an archive) takes in a research of the
//                          person's own in the terminal (strom house import)
//   POST <token>/houses    {"on": true|false} (exactly): the history of the tree's houses looked for by itself — strom
//                          config set houses on|off --for-tree, the person's decision in the app (no window, no link) —
//                          {houses (as /status houses), head, parent (head when the value holds already: nothing
//                          written)}; feature house.auto (an archive too: there 409); 400 house.body, 409 house.archive
//                          (an archive, a research waiting for its agent; + reasonCode), 409 seal.foreign |
//                          tree.not-downloaded, 423 locked, 503 research.busy (+ Retry-After), 507 disk.full, 500
//                          house.failed (+ reasonCode)
//   POST <token>/houses/request  {house: <key|A…>, with?: [<key|A…>] (at most 2, the same municipality)}: the history of
//                          a house of the tree asked for (feature house.request: only where the research has its
//                          agent; never house.request.direct — the bridge never starts an agent). The setting houses
//                          off: 403 house.link {error, code, text, link strom-research://house?tree=…&house=<key>&do=
//                          search[&with=<key>,…], estimate {minutes, usd?, measured, perHouse, perTown}} — the estimate
//                          and the person's yes in the terminal. On: strom house request --yes (the person's word in
//                          the app) — its task (and its municipality's skeleton when it has none) on top of the queue —
//                          {house (its row, as GET /houses), task, state: queued, town?, head, parent}. 400 house.body
//                          (+ reasonCode house.town: its municipality no place record yet), 404 house.unknown (nobody of
//                          the tree lived there), 409 house.archive (+ reasonCode), 423 locked, 503 research.busy (+
//                          Retry-After), 507 disk.full, 500 house.failed
//                          The look of a house (spec 145 T1, feature house.look): /status houses look (the setting
//                          houses.look, on by default; not in an archive); a task of a house's look is a house's
//                          work with look: true (GET /houses, /houses/<ref>: work house, look true); a house's lookCheck
//                          {next: material|picture|source|none, text, task?, at, origin}, a municipality's skeleton its
//                          pictures [{id, url, license, credit?, shows, origin}] and fieldNames [{id, name, kind?, lat?,
//                          lon?, house?, url?, source?, origin}]. The chain holds in the queue: a house's research after its
//                          municipality's skeleton alive, its look after its research alive, whatever is moved to the top.
//                          A conversation about a house (feature house.chat, only where the research has its agent):
//                          the link strom-research://house?tree=…&house=<key|A…>&do=chat — asked in the terminal, then
//                          strom chat --house (the house, its skeleton, the house method, its list of sources loaded);
//                          what it finds goes into the house (the bridge's events, as any change), a follow-up task only
//                          when the person asks for one.
//                          The story of a house (spec 145 T4, feature house.story, only where the research has its
//                          agent): GET /houses/<ref> story {status: draft|final|null, title?, text, facts, sources?, at,
//                          people: [{id, died}] (the tree's people it names: the living kept out of what the app shares),
//                          draft? (a new version beside an approved one: title?, text, facts, sources?, at, people),
//                          task? {id, state}} — none when the house has neither a story nor its task. It comes by itself
//                          (the setting stories on) after a house's last research step when the house tells enough.
//   POST <token>/houses/story  {house: <key|A…>}: the story of a house asked for — strom house story --yes (the person's
//                          word in the app): its task on top of the queue, never an agent started — {house (as GET
//                          /houses/<ref>), task, made, head, parent}. 404 house.unknown, 400 house.body (+ reasonCode
//                          house.story.none: nothing of the house written yet), 409 house.archive (+ reasonCode), 423
//                          locked, 503 research.busy (+ Retry-After), 507 disk.full, 500 house.failed. Approving it or
//                          keeping the approved one: the link strom-research://story?tree=…&house=A…&do=final|keep (the
//                          person in the terminal, as a person's story); the bridge's waiting has it (kind story, house:
//                          its key, no person) only for an app from APP_SHOWS_HOUSE_STORY.
//   POST <token>/intake    {"auto": true|false} (exactly): what the app sends gone through by the agent by itself — a
//                          batch once whole, a file of no batch as it comes, the same file again with more said of it, a
//                          file shown again (spec 130 K1.3) — strom config set intake.auto on|off --for-tree, the person's decision
//                          in the app (no window, no link) — {intake {auto}, head, parent (head when the value holds
//                          already: nothing written)}; feature intake.auto; 400 intake.body, 409 intake.archive (an
//                          archive, a research waiting for its agent; + reasonCode), 409 seal.foreign |
//                          tree.not-downloaded, 423 locked, 503 research.busy (+ Retry-After), 507 disk.full, 500
//                          intake.failed. /status intake {auto}: not in an archive nor a research waiting for its agent
//   POST <token>/settings/sort  {"confirm": "ask" | "no"} (exactly; spec 102 U8, feature sort.confirm, no gate of the
//                          app's version): the question before a sort of the material (strom material sort) — "ask":
//                          strom config set sort.confirm ask --for-tree — {sort {confirm}, head, parent (head when the
//                          value holds already: nothing written)}; "no" (strom config set sort.confirm no --for-tree) by
//                          the person in the terminal, or the Strom app on this computer (spec 123 P2, feature
//                          sort.confirm.app; one line in live.log in the research's language) — never a device of the
//                          home network nor what is no browser's fetch (no Sec-Fetch-Mode: cors): 403 sort.raise
//                          {command, reason: device|browser} (200 when no holds already);
//                          400 sort.body, 409 sort.archive (an archive, a research waiting for its agent; + reasonCode),
//                          409 seal.foreign | tree.not-downloaded, 423 locked, 503 research.busy, 500 sort.failed. The
//                          bridge sorts nothing by it (POST /material/sort is the app's dialog, the person's ask). /status
//                          sort {confirm: ask|no}: not in an archive nor a research waiting for its agent
//   POST <token>/books/aside  {file (as /status books.aside lists it), do: discard|take|image, image?: n} (feature
//                          inbox.aside): strom media aside <file> --discard|--take|--image n — a file of a book's folder
//                          of the inbox set aside, not taken (the same file as another image: only discard; another scan
//                          than the image of its number: discard, take — it is that image, the one there withdrawn —, or
//                          image n) — {done, added, replaced, aside (the list now), head, parent}; 400 aside.body, 404
//                          aside.unknown {aside}, 409 aside.same | aside.taken | directions.archive, 503 research.busy
//   POST <token>/queue/<T…>  {do: next|last|default}: strom task order --next|--last|--default (any open task; next
//                          once, the last chosen first) — {task (as queue[]), was ({} or {own: next|last, at}: its turn
//                          before), head, parent}; {do: restore, was: {} | {own, at}}: the turn put back exactly as it
//                          was (strom task order --default | --restore <own>@<at>; at not later than now, at most 30
//                          days ago) — feature queue.next; 400 queue.body, 404 queue.none, 409 queue.doing
//   POST <token>/waiting/W-S-I…  {do: import|own} (feature waiting.import): import — strom sync as-import I… --apply (the
//                          research backed up first; only values unchanged since the send and unconfirmed become the
//                          family tree's ○○; back in the terminal: strom sync as-import I… --undo) {input, answer: import,
//                          values, persons, backup?: true, head, parent}; own — strom sync as-import I… --own (nothing
//                          changes, never asked again) {input, answer: own, head, parent}. Always the person's (the
//                          bridge's strom writes as the person, STROM_FOR_APP). 400 waiting.body, 404 waiting.none,
//                          503 research.busy (+ Retry-After), 423 locked, 507 disk.full
//   POST <token>/waiting/W-B-…  {do: line|keep|never, line?: G…}: strom offline answer (a new line for it: POST
//                          /directions with branch) — {branch, answer, head, parent}; 400 offline.body, 404 waiting.none
//                          (it waits no more), offline.none, directions.none. Every write off the lines: 409
//                          directions.archive, 503 research.busy (+ Retry-After), 423 locked, 507 disk.full
//   GET <token>/fixes      strom's fixes of this research (strom fixes, commands/fixchecks.ts): {rev, fixes: [{id, title,
//                          summary ({cs, en, de, pl}), unit, count, left?, state pending|declined|fixed|nothing, undoable,
//                          applied?, at?, cost? free|cheap|medium|expensive, since, paid, towns?}]} — street-places'
//                          towns: [{town, key, count, places}] the municipalities whose bare numbers wait for the
//                          person's answer, never one answered (feature fixes.towns) — free (no agent, no network,
//                          nothing written); where nobody researches only those that rewrite by rules; 503 research.busy
//                          (+ Retry-After) while the research is being written (feature fixes.list). Set right or put
//                          back only by the person, in the terminal: the link fixes?tree=…&id=…[&do=undo]
//
// Only pages of the Strom app may read it (CORS: https://stromapp.info, its beta, and a
// local copy on localhost for its development), and a browser asks first
// whether a public page may talk to this computer (Private Network Access).
//
// It never ends because of one error: a read that fails while another strom
// writes is tried again at the next tick, a request that fails answers 500.
// What it did and what went wrong is in .strom/live.log (start, end and why,
// errors with their stack).
//
// The secret: started again by itself — a newer strom on disk (live start
// --current), one that ended without a word (reviveLive), the first run of a
// newer strom bringing its bridges back, a start after it ended when idle (a new
// session too, when its secret is kept and the tree is no archive) — it
// takes the address it had (.strom/live-last.json: its port while free, its
// token), so the app following it goes on by itself. Ended for good (strom live
// stop, strom uninstall) its secret is dropped: the next bridge gets a new one
// (its port kept), the address the app kept no longer works, and the app gets
// the new one when the research is opened in it again (strom app, ?live=). A
// request with the secret from a page that is no Strom app (an Origin the
// bridge does not let in; never "null", none at all, or a copy of the app on
// this computer) means the address got out: the secret is replaced at once,
// written where the next strom app reads it, the app's open event streams
// ended, and that request answered as one without the secret. What is being
// written then (a send, an original) is finished; only new requests need the
// new secret. Nothing is replaced on a timer.

import { factIn, factNow, settleVerify, verifyCounts } from "./verify.ts";
import { settleNameStatus } from "./namestatusfix.ts";
import { browserState, treeBrowserArchives } from "./browserhelp.ts";
import { opsLogsOf } from "./opslog.ts";
import { placeOfWork } from "./workplace.ts";
import { notDownloaded, settleNotesBack } from "./integrity.ts";
import fs from "node:fs";
import zlib from "node:zlib";
import os from "node:os";
import http from "node:http";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { configDir, userHome, type Env } from "./paths.ts";
import { noteTestProcess } from "./testnote.ts";
import { newerTree, now, SEAL_FOREIGN, sealedHere, Tree, TREE_FILE, VERSION, type Op } from "./tree.ts";
import { readTree } from "./readtree.ts";
import { readJsonIfExists } from "./json.ts";
import { changeLines, type ChangeKind } from "./changelog.ts";
import { RETURN_OP } from "./timetravel.ts";
import { effectiveDirection, scopes, type Scope } from "./directions.ts";
import { gatherPreview, lastGather } from "./gather.ts";
import { linePeople } from "./frontier.ts";
import { BRANCH_MODES, branchJson, branchKey, branchModeOf, branchOf, lineOf, OFFLINE_FILE, offLineJson, offLineView, placer, readOffline, type BranchView, type OfflineFile, type OffLineView, type Placed } from "./offline.ts";
import { directionsOf, directionsRev, placesJson } from "./tablemarks.ts";
import { ancestorGenerations, displayName, peopleFound, primaryName } from "./people.ts";
import { parseNameEid } from "./namestatus.ts";
import { findEventOwner, sameDirection } from "./actions.ts";
import { foundByLine, type Found } from "./found.ts";
import { orderMode, orderNumbers, workOrder } from "./order.ts";
import { phrase } from "./phrases.ts";
import { excerptLevel, excerptSizes, INPUT_MARK, LEVELS, turned } from "./excerpt.ts";
import { endWork, excerptAnswer, excerptOnThread, fixesOnThread, gedOnThread, gedSizeKnown, gedVariant, storedGed, storeGed, tidyStoredGeds, widgetOnThread, type GedImages, type GedMade } from "./liveged.ts";
import { IMAGE_MIME, IMAGE_SHA, imageFile, readImage } from "./liveimages.ts";
import { markServedWithMedia, treeMediaFile } from "./treemedia.ts";
import { isStatusPart, splitStatus, StatusKeeper, STATUS_PARTS, type StatusPart } from "./livestatus.ts";
import { withSendClient, adoptedAt, notWrittenList, adoptedEmpty, adoptionWait, noteAdoptAsked, markSentAgain, undoneSend, undoneSince, failReceived, inboxTrees, markAdopted, noteAdoptFailed, noteNothingSent, pendingAdoption, receiveAdopted, receivedAll, receivedPending, receiveTree, recentSends, refuseReceived, stampAppVersion, syncConflicts, SYNC_INBOX, SYNC_MAX_BYTES, namesOf, type Change, type MediaWritten, type PlanTimes, type ReceiveTimes, type Skipped } from "./sync.ts";
import { isArchive, isDemo, modeOf, settleArchive } from "./mode.ts";
import { actsAsArchive, kindOf, settleWaiting, stateOf } from "./state.ts";
import { forStory } from "./stories.ts";
import { censusHeldCount, censusHidden } from "./census.ts";
import { kindCounts, kindMatches, parseKnownKinds, parseTaskKind, TASK_KINDS, taskKind, type TaskKind } from "./taskkind.ts";
import { archiveRow, forHouse, houseByRef, houseIndex, houseKeyOfTask, houseRows, housesRev, houseView, listRow, researchHouses, type HouseIndex, type HouseRow } from "./houses.ts";
import { HOUSE_GROUP_MAX, houseAskEstimate, houseEstimate, housesBridgeStatus } from "./houseauto.ts";
import { factMark, nameMark, transcriptMark } from "./readers.ts";
import { quiet, raiseHypothesisLinkTasks, settleHypothesisLinks } from "./hypolinks.ts";
import { settleReaders } from "./readerfix.ts";
import { settleProven } from "./provenfix.ts";
import { settleHeldProposals, settleOrigins } from "./originfix.ts";
import { settleClips } from "./clipmerge.ts";
import { settleNotes } from "./notefix.ts";
import { PROFILES } from "../agents/profiles.ts";
import { ui } from "../cli/ui.ts";
import { DISK_FULL, EXIT, isDiskFull, StromError, UsageError } from "./errors.ts";
import { acquireLock, liveHolder } from "./lock.ts";
import { checkAsked, checkEdit, material, MATERIAL_MOST_EDIT, MATERIAL_MOST_FILES, MATERIAL_MOST_PEOPLE, materialUses, peopleOf, workingCopyBySha, workingCopyOf } from "./material.ts";
import { checkMediaRefs, type MediaRefCheck } from "./appmedia.ts";
import { checkDeleteConfirm, checkRetractWith, deleteConfirm, DELETE_MOST_FILES, deleteImpacts, deleteSourceImpacts, refuseLiveSources } from "./materialdelete.ts";
import { checkRetractConfirm, keepable, restorable, RETRACT_MOST, retractConfirm, retractImpacts } from "./sourceretract.ts";
import { cachedThumb, THUMB_SIZES } from "./thumbs.ts";
import { checkOriginalMeta, cleanIncoming, freeBytes, knownOriginal, materialWaiting, originalMax, ORIGINAL_RESERVE, ORIGINAL_TYPES, parseRegion } from "./originals.ts";
import { checkSentList, keepSentList, LIST_BODY_MAX, LIST_ID, readSentList } from "./lists.ts";
import { BATCH_ID, batchEstimate, batchLimits, batchPath, batchStatus, idleBatches, readBatch } from "./batches.ts";

/** New images for the app, made for at most so long when the tree changed (the rest the next time). */
const LIVE_IMAGES_MS = 20_000;
/** The trees for the app kept in memory, one for each variant (two windows of two versions of the app). */
const GEDS_KEPT = 2;
/** The images of the tree's file asked at once (POST /images): at most so many hashes. */
export const IMAGES_AT_ONCE = 500;
/** …and an answer holds at most so many bytes of them (the rest asked again: `more`). */
export const IMAGES_ANSWER_BYTES = 8 * 1024 * 1024;
/** An image by its hash never changes: the browser keeps it a year (it is private: the bridge's address is secret). */
const IMAGE_CACHE = "private, max-age=31536000, immutable";
/**
 * How long a change waits to be told while the tree for the app that follows it is made (the app then loads it at
 * once, the tree it shows meanwhile the one before): told without it after so long (STROM_LIVE_CHANGE_WAIT_MS).
 */
const CHANGE_WAIT_MS = 45_000;
/** How long the bridge makes the excerpts of one source the app asks for (/excerpt/<S>): the rest the next ask makes. */
const EXCERPT_MS = 20_000;
/** A source with more excerpts than this is answered without the pictures: the app asks for each (?clip=). */
const EXCERPTS_AT_ONCE = 12;
import { anyoneAtWork, liveWorkers, otherVersionsAtWork, type Paused } from "./workers.ts";
import { widgetTree, widgetWriter, type WidgetTree } from "./widget.ts";
import { lifeOf, monthSpend, openSessions } from "./session.ts";
import type { Life } from "./holds.ts";
import { archiveHeldOf, directAtWork, heldArchives, heldTasks, holdsStamp, holdView, waitsView, whoDirect, type ArchiveHeldView, type HeldByView, type HoldView, type WaitsView } from "./holdsview.ts";
import { busyIn, workingNow } from "./busy.ts";
import { effectiveState, restoredTurn, runOrder, turnWas, type Ranked } from "./queue.ts";
import { humanTask } from "../cli/human.ts";
import { foldText } from "./text.ts";
import { knownNewerVersion, updateChannel } from "./update.ts";
import { whatsNew } from "./whatsnew.ts";
import type { SyncInput } from "./sync.ts";
import { gitProgram, runGit } from "./git.ts";
import { RECENT_HOURS, recentChanges, recentNow, type Recent } from "./recent.ts";
import { findsForApp, treeFinds } from "./phone-finds.ts";
import { glanceLocked, glanceOf, withAsking, withRuns, type Glance } from "./glance.ts";
import { askingNow } from "./deviceagent.ts";
import { forPhone } from "./phone-watch.ts";
import { APP_READS_NAME_STATUS, APP_READS_NAME_STATUS_BETA, APP_SHOWS_ORIGIN, APP_SHOWS_ORIGIN_BETA, appReadsMainCitation, appReadsNameStatus, appSendsUncite, appDecidesHypotheses, appOpensLinks, appShowsHouseStory, appShowsOrigin, appShowsStoryDrafts, appUrlSetting, isAppVersion, isStromAppOrigin, stromAppState } from "./stromapp.ts";
import { suggestSurnames } from "./surnames.ts";
import { judgePairs, pairsOf, PAIRS_MAX } from "./duplicates.ts";
import { askOf, qualityRev, readDismissed } from "./quality.ts";
import { builtin as healthBuiltin, healthStatus, type FixSeen } from "./health.ts";
import { AUDIT_TYPES, REPORTS_LISTED, decisionsOf, findingView, healthRev, isAuditType, isFindingId, isReportId, listReports, readReport, runInfo, scopeOf, type HealthScope } from "./audit.ts";
import { BOOKS_MIN_TASKS, BOOKS_MIN_TASKS_MAX, configFile, DEFAULT_RUN_MINUTES, RUN_PARALLEL_MAX, LIVE_IDLE_CHOICES, LIVE_IDLE_MAX_MINUTES, loadUserConfig, readStored, Settings } from "./config.ts";
import { asideFiles, folderFiles } from "./inboxwait.ts";
import { gateLabel } from "./gate.ts";
import { LINK_SCHEME, linkActions, linkHandlerState, linkHandlerStateLater, linkScheme, linkText, type HandlerState } from "./links.ts";
import { handoffsNow } from "./handoffs.ts";
import { autoTidy } from "./tidy.ts";
import { askPhoneOn, endPhoneLater, pairCode, pairUrl, phoneConfig, phoneProbe, phoneRunning, phoneState, phoneSummary, phoneTestPortRefused, phoneTestYesHint, removePhone, restorePhone, revivePhone, stopPhone, type PairedPhone } from "./phone.ts";
import { qrSvg } from "./qr.ts";
import { clientOfDevice, deviceEvents, deviceName, devicePairCode, devicePairNow, devicePairShown, devicePairUrl, deviceRows, devicesList, devicesOn, hostOf, removeDevice, renameDevice, restoreDevice, type Device, type DeviceRow } from "./devices.ts";
import { deviceAppState, ensureDeviceApp, noteDeviceAppSource } from "./deviceapp.ts";
import { localName } from "./device-gateway.ts";
import { diskVersion, lastingLauncher, stromLauncher } from "./self.ts";
import { watchInbox } from "./inboxwatch.ts";
import { warmWriter } from "./warmwriter.ts";
import { mediaQueue } from "./livequeue.ts";
import { batchQueued, cleanQueued, queuedShas, queueTag } from "./mediaqueue.ts";
import { DEVICE_HEADER, viaEnv } from "./devicevia.ts";
import { closeBatchBy, committed, diskFullSaid, forApp, fullWhere, langOf, receiveOriginal, refusal, refusalOf, type Receiver } from "./receive.ts";
import { splitMark, splitPlan, splitUndos } from "./sourcesplit.ts";
import { ANSWER_MAX, HIDE_REASONS, OFF_LINE_CHOICES, type AppClient, type Family, type Input, type Media, type OffLine, type Person, type Place, type RecordSet, type Repository, type Direction, type Research, type Session, type Source, type Task, type TreeConfig } from "./model.ts";
import { normId } from "./records.ts";
import { confirmCheck, type ConfirmRefusal } from "./confirm.ts";
import { answersInApp, archiveWaiting, importWaiting, requestTexts, savedByAgentNow, waitingFor } from "./waiting.ts";
import { sendInput, sendPlan } from "./sendimport.ts";
import { RETRY_MAX, retryOf, type RetryView } from "./retry.ts";
import { savingView, type SavingView } from "./ownsave.ts";
import { bookOfTask, bookRows, type BookRow } from "./books.ts";
import { fileRefused } from "./taskfiles.ts";
import { givenSentDay, SENDABLE, sentDay, waitKindOf, waitPhaseOf, type WaitKind } from "./waitkind.ts";
import { auditOf } from "./taskaudit.ts";
import { agentsHere } from "./apps.ts";
import { runLimits, runsLive, runsNow, type EndedRun, type RunsNow, type RunView } from "./liveruns.ts";
import { askRunStop, RUN_ID } from "./runstate.ts";
import { runTakers } from "./linerun.ts";
import { counted } from "../cli/format.ts";
import { AppReadings, appReadSpend, readAccepts, statusReads, type ReadingsSeen } from "./live-read.ts";
import { AppSorts } from "./live-sort.ts";
import { appSortSpend, statusSorts } from "./sort.ts";
import { readAgainAll } from "./sourceread.ts";
import { checkNote, forHistory, historyAnswer, historyOn, historyRev, MAX_EVENTS, MAX_PLACES, placesOn, placesPinned, regionsOn } from "./pastevents.ts";
import { alignData, alignEmpty, planAlign } from "./historyalign.ts";
import { EVENT_KINDS, kindsAdded, kindsNamed, kindsOf, kindsSetting, type EventKind } from "./eventkinds.ts";
import { placeEstimate, placeRecord } from "./placehistory.ts";
import { PLACE_FLAGS, PLACE_TAKES, REQUEST_MAX } from "./placeid.ts";
import { placesView, placeView, queueView } from "./placesview.ts";
import { decodeGedcom, looksLikeGedcom } from "../gedcom/encoding.ts";

export interface LiveInfo {
  port: number;
  token: string;
  pid: number;
  /** The address the app is given (?live=…). */
  url: string;
  started: string;
  /** The strom version that serves it (a bridge of an older strom has none). */
  version?: string;
  /** Started now on another address than the bridge before had (its port was taken, or its secret dropped by strom live stop): the app needs the new one. */
  moved?: boolean;
}

/**
 * What the bridge says to the app: the sentence in the research's language (`error`, what an app before 3.9 shows), and
 * as a program reads it — a stable `code` with its `params`, and `text` in English — for the app to say it in its own
 * language (found on Windows: a Czech sentence inside the English app).
 */
const CODES = {
  "ui.sync.bridge.failed": "send.failed",
  "ui.sync.bridge.adopt": "adopt.failed",
  "ui.sync.bridge.large": "tree.large",
  "ui.sync.bridge.adopting": "adopt.busy",
  "ui.sync.bridge.other": "tree.other-research",
  "ui.sync.bridge.foreign": "tree.foreign",
  "ui.sync.bridge.empty": "tree.empty",
  "ui.sync.bridge.noids": "tree.no-ids",
  "ui.media.large": "media.large",
  "ui.media.full": "media.full",
  "ui.seal.bridge": SEAL_FOREIGN,
  "ui.seal.bridge.twokeys": "seal.other-key",
  "ui.error.tree.not-downloaded": "tree.not-downloaded",
  "ui.experiments.link": "experiments.link",
  "ui.history.place.link": "history.link",
  "ui.house.link": "house.link",
  "ui.places.link": "places.link",
  "ui.history.kinds.link": "history.kinds.link",
  "ui.history.align.link": "history.align.link",
  "ui.hypotheses.link": "hypotheses.link",
} as const;

/**
 * The kinds of history this research looks for, as /status says them (feature history.kinds): those looked for here
 * (always a list, in the order of the kinds), whether it is the research's own value (strom.json, --for-tree) or this
 * computer's, and this computer's (for the researches without their own and the new ones).
 */
function kindsStatus(tree: Tree, settings: Settings): { kinds: EventKind[]; kindsOwn: boolean; kindsDefault: EventKind[] } {
  return { kinds: settings.historyKinds(tree.config), kindsOwn: readStored(tree.config, "history.kinds", "") !== undefined, kindsDefault: settings.historyKinds(undefined) };
}
/** What the app sends that the research writes (the routes after the secret): refused while it is sealed elsewhere. */
/** A region's ID as the app sends it (core/pastevents.ts regionIdOk). */
const REGION_ID = /^[a-z0-9][a-z0-9-]{0,23}$/u;

/** A place as the app sends it: one line of text, at most 300 characters. */
function placeOk(v: unknown): v is string {
  return typeof v === "string" && !!v.trim() && v.length <= 300 && !/[\u0000-\u001f\u007f]/u.test(v);
}

const APP_WRITES = new Set(["health", "audit", "sync", "adopt", "media", "lists", "batch", "waiting", "group", "material", "read", "history", "experiments", "quality", "places", "directions", "offline", "queue", "census", "intake", "houses"]);
/** A route of APP_WRITES, or a setting of the tree's own (settings/sort: its strom.json; settings/runs is this computer's). */
const writesTree = (what: string | undefined, sub: string | undefined): boolean => APP_WRITES.has(what ?? "") || (what === "settings" && sub === "sort");
/** A file refused (its error's code): what the bridge says of it. */
const REFUSED: Record<string, keyof typeof CODES> = {
  "tree.other-research": "ui.sync.bridge.other",
  "tree.foreign": "ui.sync.bridge.foreign",
  "tree.no-ids": "ui.sync.bridge.noids",
  "tree.empty": "ui.sync.bridge.empty",
  "tree.unreadable": "ui.sync.bridge.empty",
};
function said(lang: string, key: keyof typeof CODES, params: Record<string, string> = {}): { error: string; code: string; text: string; params?: Record<string, string> } {
  return { error: ui(lang, key, params), code: CODES[key], text: ui("en", key, params), ...(Object.keys(params).length ? { params } : {}) };
}

/*
 * The refusals (receive.ts refusal()). An upload of the app refused (PUT /media/<sha256>, a batch's file, POST
 * /batch/<id>/done, GET /media/<sha256>): the English sentence (`error`, `text`) and its stable `code` with `params` for the app to say it in the person's
 * language (feature `media.codes`). Each code, its answer and its params:
 * - `app.only` 403 — not from the Strom app's pages
 * - `media.bad-sha` 400 — the address names no SHA-256
 * - `media.bad-header` 400 {header} — a header that is not what it should be (X-Strom-Person, -Source, -Batch, -Zip,
 *   -Path, -Name, -Note, -Task)
 * - `media.bad-region` 400 {region} — X-Strom-Region is no part of an image
 * - `media.no-person` 404 {person} — no such person in the research; `media.no-family` 404 {family} — no such couple
 *   (X-Strom-Family); `media.no-source` 404 {source} — no such source; `media.no-list` 404 {list} — no list of that
 *   mark sent (X-Strom-List-Ref: PUT lists/<id> first)
 * - `list.bad-body` 400, `list.large` 413 — PUT lists/<id>: a body that is no list, a list too large
 * - `media.no-shared` 500 — the research has no shared folder for files (strom setup)
 * - `media.large` 413 {mb} (and `max`) — larger than the research takes; `media.full` 507 (and `free`) — no room
 *   (these two: `error` in the research's language, `text` English — said() above)
 * - `disk.full` 507 {where} — no room left on the disk as a write met it (any write of the app: a send, an adoption, an
 *   original, a batch, the material, a waiting task): `error` in the research's language, `text` English, `where` the
 *   folder (feature `disk.full`); nothing was lost
 * - `tree.not-downloaded` 409 {n, first} — files of the research not downloaded from iCloud yet (only their placeholder
 *   here): nothing written until they are (/status `notDownloaded`, feature `tree.notDownloaded`)
 * - `media.sha-differs` 409 {sha} — the file is not the one its address names
 * - `media.type` 415 {name} — not a kind of file the research takes
 * - `media.cut-short` 422 {name, kind: JPEG|PNG|PDF}; `media.too-small` 422 {name, bytes} — the file is not whole
 * - `media.refused` 400 — refused for another reason (the English sentence says why); `media.failed` 500 — went wrong
 * - `media.gone` 410 {known} — GET …?file=1: the research knows it, its file is not on this computer
 * - `research.busy` 503 (and Retry-After, `retry`) — another strom holds the research: send it again in a while
 * - `media.held` 503 (and Retry-After, `retry` in seconds) — another program (an antivirus, a sync or backup tool) held
 *   a file sent or queued, or it could not be read now (found on Windows: EBUSY as a batch was closed): `error` in the
 *   research's language, `text` English, never the file's path; nothing written or lost — POST /batch/<id>/done: the
 *   bridge writes the batch's queued files again by itself, the app closes it again after `retry`
 * - `batch.bad-id` 400 {batch}; `batch.zip-alone` 400 — a ZIP outside a batch; `batch.zip-unreadable` 400 {name}
 * - `batch.closed` 409 {batch} — the batch is closed already: send the rest as a new batch
 * - `batch.full-files` 413 {batch, files}; `batch.full-bytes` 413 {batch, gb} — the most a batch takes
 * - `batch.none` 404 {batch} — POST /batch/<id>/done: no such batch here; `batch.bad-body` 400 — its body no JSON
 * - `waiting.none` 409 {id} — X-Strom-Task: the task waits no more; `waiting.no-file` 409 {id} — it waits for the
 *   person's check of a site or decision about an archive (the app offers the inbox folder then)
 * - images a task waits for (X-Strom-Task, a task waiting for images of a book; accepts.media.taskImages): 200 {task,
 *   image, images, by: image|name|order, added, same, replaced, aside, woken, back, inbox: {have, want?, missing,
 *   next? — the book's next free number, a task that does not know which images (none: want)},
 *   state, head, parent}, else `waiting.image-unknown` 409 {missing, task} — it is not known which image it is (say
 *   X-Strom-Image); `waiting.image-unwanted` 409 {want, task} — a number the task does not ask for;
 *   `waiting.image-exists` 409 {image, task} — another scan there already (again with X-Strom-Replace: 1: the old one
 *   withdrawn and kept); `waiting.image-same` 409 {image, same: M…, as: "B…:n", sameRecordset?, sameImage?, task} —
 *   the file is the same as another image taken already (another number or book): nothing taken; `waiting.pdf` 415 — a PDF whose pages cannot be made images here; `media.type` 415 — no image
 *   of a book; `media.bad-header` 400 {header: X-Strom-Image | X-Strom-Replace}
 *
 * A request marked sent (POST /waiting/<T…>, /group/<key>): 200 {sent | unsent: [the tasks it marked], head, task?,
 * phase?, group?}; the person's answer (POST /waiting/<T…> {"do": "answer"}): 200 {task, state: "open", head, parent};
 * returned to the agent (waiting.retry: POST /waiting/<T…> {"do": "retry"}: 200 {task, state: "open", head, parent};
 * POST /group/<key> {"do": "retry"}: 200 {retried: [T…], group, head, parent}); else
 * - `app.only` 403; `waiting.bad-body` 400 — no JSON {"do": "sent" | "unsent" | "answer" | "retry" | "fix" | "unfix" |
 *   "keep" | "unkeep"} (a group's unsent: with its "tasks"; an answer: its "text", 1–4000 characters; "expect" only with
 *   an answer, a retry, fix or keep)
 * - a retry: `retry.not` 409 {id} — the agent could not manage it alone (no `retry` on its item: a letter, the family, a
 *   check, an archive's permission, images only the person saves); `retry.limit` 409 {id, until} — returned 3 times
 *   within a day, again from `until`; `waiting.changed` 409 {id, at}
 * - an answer: `waiting.changed` 409 {id, at} — the task waits for something else since the item's `at` the app sent
 *   as "expect" (nothing written); `waiting.no-answer` 409 {id, kind} — answered in the terminal (a check of a site)
 * - the audit's fix and keeping (tasks.audit): `waiting.changed` 409 {id, at} — the task changed since the stamp sent as
 *   "expect"; `audit.none` 409 {id} — nothing found (fix, keep), no fix to undo (unfix), not kept (unkeep);
 *   `audit.changed` 409 {id, changed} and `changed` [T…] — unfix: tasks of the fix changed since, nothing undone
 * - `waiting.none` 404 {id} — no task that waits; `group.none` 404 {group} — nothing waits at that place (also GET
 *   /group/<key>/note); `waiting.not-sendable` 409 {id, kind} — it waits for no request to send
 * - `research.busy` 503 (and Retry-After, `retry`); `locked` 423; `waiting.failed` 500
 *
 * A decision of a conflict (POST /conflict/<X…>): always `decide.link` 403 {id}, nothing read or written — the person
 * decides it in the terminal, through the link conflict&do=decide (the bridge cannot tell the app from an agent here).
 *
 * A document to read (POST /read, /read/<D…>/again, /read/<D…>/cancel; GET /read/<D…>, its pages, /reads — live-read.ts):
 * - `app.only` 403; `locked` 423; `read.none` 404 {id} — an archive, a research waiting for its agent, no reading of the
 *   app of that id; `read.not-ready` 503 {why} (and `resets`) — accepts.read.why
 * - `read.bad-body` 400; `read.lang` 400 {lang}; `read.region` 400; `read.no-person` 404 {person}
 * - `read.no-file` 404 / 410 {sha} — no such file in the research / not on this computer; `read.type` 415 {sha, mime};
 *   `read.large` 413 {sha, mb}; `read.pages` 413 {pages}
 * - `read.limit` 429 {per: queue | hour | day, most} (and Retry-After, `retry`); `read.busy` 409 {id} — again while read
 * - `read.no-page` 404, `read.page-gone` 410 {id, page}; `research.busy` 503 (`retry`); `read.failed` 500
 * - `read.with` 400 {at, field: agent | model | effort} — a reader not offered; `read.agent` 409 {at, agent, why, resets}
 *   — its agent cannot read now (limit, auth)
 * - POST /sources/read: `read.source.none` 404 {source}; `read.source.noscan` 409 {source, clip} — no original here;
 *   `read.source.notext` 409 {source} — no transcript to hold it against; `read.source.running` 409 {source, read}
 */
/** Where a running bridge of a tree is noted. */
export function liveFile(root: string): string {
  return path.join(root, ".strom", "live.json");
}

/** What the bridge did and what went wrong: plain text, the newest LIVE_LOG_BYTES at most. */
export function liveLogFile(root: string): string {
  return path.join(root, ".strom", "live.log");
}

const LIVE_LOG_BYTES = 200 * 1024;

/** How a bridge ended (the end event's reason, live-last.json's ended.kind). */
type EndKind = "stopped" | "restart" | "idle" | "gone" | "signal";

/**
 * How long a bridge's research must stay gone (no strom.json, its .strom deleted) before the bridge ends: seen gone at
 * two looks at least this far apart (STROM_LIVE_GONE_MS of the tests).
 */
const GONE_MS = 10_000;

/** How often a running bridge reads live.idleMinutes again (STROM_LIVE_IDLE_READ_MS of the tests). */
const IDLE_READ_MS = Number(process.env.STROM_LIVE_IDLE_READ_MS ?? 60_000);

/** The last bridge of a tree, kept after it ended: its address to take again, whether it ended as it should. */
interface LiveLast {
  port: number;
  /** None once the bridge was ended for good (strom live stop): the next one gets a new secret, at this port. */
  token?: string;
  pid: number;
  started: string;
  /**
   * How it ended (idle, stopped, a signal); none while it runs — or when it ended without a word. kind (1.29.0): which
   * end it was — only one that ended idle comes back with new work in the tree; none: an older strom's (its reason read).
   */
  ended?: { at: string; reason: string; kind?: EndKind };
  /** The tree's folder (its real path) the bridge was of: a copy of the research with its .strom is another folder. None: an older strom's. */
  root?: string;
}

/** The tree's folder as the system names it (its links followed: /tmp is /private/tmp on a Mac) — never normalized. */
function realRoot(root: string): string {
  try {
    return fs.realpathSync(root);
  } catch {
    return path.resolve(root);
  }
}

/** Whether two paths are one folder: the same name, else the same folder of the same disk; undefined when one is not there. */
function sameFolder(a: string, b: string): boolean | undefined {
  if (a === b) return true;
  try {
    const x = fs.statSync(a, { bigint: true });
    const y = fs.statSync(b, { bigint: true });
    return x.dev === y.dev && x.ino === y.ino;
  } catch {
    return undefined;
  }
}

/**
 * Where a process runs (its working folder): a bridge runs in its tree's folder (on Windows a newer one in the settings'
 * folder, never asked there). Undefined where it cannot be asked (Windows; lsof missing) — then a process is taken for
 * what its note says, as before.
 */
function processCwd(pid: number): string | undefined {
  if (process.platform === "linux") {
    try {
      return fs.readlinkSync(`/proc/${pid}/cwd`);
    } catch {
      return undefined;
    }
  }
  if (process.platform !== "darwin") return undefined;
  const r = spawnSync("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"], { encoding: "utf8", timeout: 10_000 });
  if (r.error || r.status !== 0) return undefined;
  const line = (r.stdout ?? "").split("\n").find((l) => l.startsWith("n"));
  return line ? line.slice(1) : undefined;
}

/**
 * A bridge running in another tree's folder than this one's (an older strom's, whose note names no folder) — never
 * ended for this tree. Its folder, else undefined. A folder of no tree (a bridge run elsewhere) is not another tree's.
 */
function bridgeElsewhere(pid: number, root: string): string | undefined {
  const cwd = processCwd(pid);
  return cwd && sameFolder(cwd, realRoot(root)) === false && fs.existsSync(path.join(cwd, "strom.json")) ? cwd : undefined;
}

/**
 * The folder a bridge's note (live.json, live-last.json) belongs to when it is not this tree's: a research copied with
 * its .strom (by hand, Finder) carries the original's notes — its bridge never taken for the copy's own, never ended by
 * it, its address never taken over (found on Mac: the copy's strom ended the original's bridge and served the Strom app
 * following the original at its address). A note of an older strom names no folder: its process, while it is a bridge,
 * is asked where it runs. A folder named that is no longer there is not another one: the research was moved.
 */
function foreignNote(root: string, note: { root?: unknown; pid?: unknown }): string | undefined {
  if (typeof note.root === "string") return sameFolder(note.root, realRoot(root)) === false ? note.root : undefined;
  if (typeof note.pid === "number" && note.pid !== process.pid && isBridge(note.pid)) return bridgeElsewhere(note.pid, root);
  return undefined;
}

function lastFile(root: string): string {
  return path.join(root, ".strom", "live-last.json");
}

/** The last bridge of this tree — and, when the note there is another folder's (a research copied with its .strom), that folder. */
function readLastOf(root: string): { last?: LiveLast; foreign?: string } {
  try {
    const last = JSON.parse(fs.readFileSync(lastFile(root), "utf8")) as LiveLast;
    if (!Number.isInteger(last.port) || !(last.token === undefined || /^[0-9a-f]{32}$/.test(last.token))) return {};
    const foreign = foreignNote(root, last);
    return foreign ? { foreign } : { last };
  } catch {
    return {};
  }
}

function readLast(root: string): LiveLast | undefined {
  return readLastOf(root).last;
}

function writeLast(root: string, last: LiveLast): void {
  try {
    const file = lastFile(root);
    fs.writeFileSync(`${file}.${process.pid}`, JSON.stringify({ ...last, root: realRoot(root) }, null, 2));
    fs.renameSync(`${file}.${process.pid}`, file);
  } catch {
    // the next start takes a new address
  }
}

/**
 * How the bridge works the widget's overview out: on a thread of its own, or here (STROM_LIVE_STATUS_THREAD=0) — one that
 * fails said either way (`said`: into live.log while the bridge runs), and looked at again at the next check.
 */
export function widgetMaker(root: string, env: Env, said: (text: string) => void): (now: number) => Promise<WidgetTree | undefined> {
  const make = env.STROM_LIVE_STATUS_THREAD === "0" ? async (now: number) => widgetTree(root, env, { running: true, now }) : (now: number) => widgetOnThread({ root, env, now });
  return (now) =>
    make(now).catch((e: unknown) => {
      said(`the widget failed (tried again): ${errorText(e)}`);
      throw e;
    });
}

/**
 * What a strom of the bridge's said of its error: --json gives it on stdout ({"status":"error","message"}), else the
 * "error:" line of stderr. None: undefined.
 */
export function takeError(stdout: string, stderr: string): string | undefined {
  try {
    const j = JSON.parse(stdout) as { status?: string; message?: unknown };
    if (j && j.status === "error" && typeof j.message === "string" && j.message.trim()) return j.message.trim().slice(0, 300);
  } catch {
    // not its JSON: stderr says it
  }
  return stderr.trim().split("\n").find((l) => l.startsWith("error:"))?.slice(6).trim() || undefined;
}

/** One line (or an error with its stack) into the bridge's log; never fails, never grows past its size. */
export function noteLive(root: string, text: string): void {
  try {
    // the research moved or taken off: its folder never made again for a line of the log (found on Mac: a folder
    // left where the person moved the research from) — nor its .strom, deleted by hand (it is made by what starts a
    // bridge: its lock, its log's folder)
    if (!fs.existsSync(path.join(root, "strom.json"))) return;
    const file = liveLogFile(root);
    if (!fs.existsSync(path.dirname(file))) return;
    fs.appendFileSync(file, `${new Date().toISOString()} [${process.pid}] ${text}\n`);
    const size = fs.statSync(file).size;
    if (size > LIVE_LOG_BYTES) {
      const kept = fs.readFileSync(file).subarray(size - LIVE_LOG_BYTES / 2);
      const from = kept.indexOf(10) + 1;
      fs.writeFileSync(file, kept.subarray(from));
    }
  } catch {
    // a log that cannot be written stops nothing
  }
}

/** A folder as the system knows it (its disk and number): another folder made under the same name is another one. */
function folderId(dir: string): string | undefined {
  try {
    const st = fs.statSync(dir, { bigint: true });
    return st.isDirectory() ? `${st.dev}:${st.ino}` : undefined;
  } catch {
    return undefined;
  }
}

function errorText(e: unknown): string {
  return e instanceof Error ? (e.stack ?? `${e.name}: ${e.message}`) : String(e);
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** The bridge of this tree when it runs (never another folder's whose note came with a copy of the research). */
export function liveRunning(root: string): LiveInfo | undefined {
  try {
    const { root: of, ...info } = JSON.parse(fs.readFileSync(liveFile(root), "utf8")) as LiveInfo & { root?: string };
    if (info.pid && alive(info.pid) && !foreignNote(root, { root: of, pid: info.pid })) return info;
  } catch {
    // none
  }
  return undefined;
}

/**
 * Where the tree's bridge claims the tree (.strom/live-owner.json: its pid, its folder, since when) — one bridge per
 * research, whatever starts them and when: a newer strom's bridge taking over from the one before and a strom starting
 * the tree's bridge at that moment once ran both, one at the address the app follows, the other at another port, both
 * taking in the inbox (found 2026-11-09 at an update). Claimed and given up only under the tree's owner lock
 * (liveOwnerLock), which also guards live.json being written and removed at a start and an end.
 */
function liveOwnerFile(root: string): string {
  return path.join(root, ".strom", "live-owner.json");
}

/**
 * How long a claim counts by itself while its bridge is not in live.json yet (it starts: the tree settled, /status made
 * first, its port waited for): after it only a bridge live.json names holds the tree — a claim left by one ended without
 * a word is never another's process that got its number (Windows tells no bridge by its command).
 */
const CLAIM_FRESH_MS = 120_000;

/** What a tree's claim is done under (a moment: read, compare, write); never waited for long — without it, as before. */
function withLiveOwner<T>(root: string, fn: () => T): T {
  let release: (() => void) | undefined;
  try {
    // a research gone (its .strom deleted, moved): its folder never made again for a lock
    if (fs.existsSync(path.join(root, ".strom"))) release = acquireLock(path.join(root, ".strom", "live-owner.lock"), { owner: "the tree's bridge", waitMs: 10_000, staleMs: 60_000 });
  } catch {
    // its folder not to be written, or held by one stuck: the claim and the notes as they come
  }
  try {
    return fn();
  } finally {
    release?.();
  }
}

/**
 * The bridge this one takes over from: the one that started it with a newer strom (STROM_LIVE_REPLACES; one of an
 * older strom names none — its parent then, which started it). None: a bridge started by strom, which ended the one before.
 */
function replacedBridge(env: Env): number | undefined {
  const said = Number(env.STROM_LIVE_REPLACES);
  if (Number.isInteger(said) && said > 0) return said;
  return env.STROM_LIVE_RENEWED ? process.ppid : undefined;
}

/**
 * Another bridge holding this tree (it runs and is a bridge, never the one this one takes over from): the one whose claim
 * counts (live-owner.json), else the one live.json names (a bridge of an older strom claims nothing) — one that started
 * late (strom gave up waiting for it, another was started meanwhile) or at the same moment as another is never a second
 * bridge of the tree.
 */
function rivalBridge(root: string, env: Env, ignore?: number): number | undefined {
  const replaces = replacedBridge(env);
  const named = liveRunning(root);
  const other = (pid: unknown): pid is number => typeof pid === "number" && pid !== process.pid && pid !== replaces && pid !== ignore && isBridge(pid);
  try {
    const owner = JSON.parse(fs.readFileSync(liveOwnerFile(root), "utf8")) as { pid?: unknown; root?: unknown; at?: unknown };
    const fresh = named?.pid === owner.pid || Date.now() - Date.parse(String(owner.at)) < CLAIM_FRESH_MS;
    if (fresh && other(owner.pid) && !foreignNote(root, owner)) return owner.pid;
  } catch {
    // no claim: a bridge of an older strom, or none
  }
  return named && other(named.pid) ? named.pid : undefined;
}

/** This bridge holds the tree now (under the owner lock). */
function writeOwner(root: string): void {
  // no research there (moved, taken off): nothing made
  if (!fs.existsSync(path.join(root, TREE_FILE))) return;
  const file = liveOwnerFile(root);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}.${process.pid}`, JSON.stringify({ pid: process.pid, root: realRoot(root), at: new Date().toISOString() }));
  fs.renameSync(`${file}.${process.pid}`, file);
}

/**
 * Claim the tree for this bridge: the other bridge that holds it (this one then ends), else none — claimed. `ignore`: a
 * bridge that holds it no more (the new one that did not take over, being ended).
 */
function claimTree(root: string, env: Env, ignore?: number): number | undefined {
  return withLiveOwner(root, () => {
    const rival = rivalBridge(root, env, ignore);
    if (rival) return rival;
    try {
      writeOwner(root);
    } catch {
      // a folder not to be written: live.json says the bridge
    }
    return undefined;
  });
}

/** The claim given up by the bridge that ends (only its own: the bridge it handed over to holds it already). */
function dropOwner(root: string): void {
  withLiveOwner(root, () => {
    try {
      const owner = JSON.parse(fs.readFileSync(liveOwnerFile(root), "utf8")) as { pid?: unknown };
      if (owner.pid === process.pid) fs.rmSync(liveOwnerFile(root), { force: true });
    } catch {
      // none
    }
  });
}

/** live.json removed when it still names that bridge (an ended one's): never the note of one that came up meanwhile. */
function dropLiveNote(root: string, pid: number): void {
  withLiveOwner(root, () => {
    try {
      const now = JSON.parse(fs.readFileSync(liveFile(root), "utf8")) as { pid?: unknown };
      if (now.pid === pid || typeof now.pid !== "number" || !alive(now.pid)) fs.rmSync(liveFile(root), { force: true });
    } catch {
      // none, or not readable: nobody's
      fs.rmSync(liveFile(root), { force: true });
    }
  });
}

/**
 * The bridge that started this one to take over from it (a newer strom on disk), when another bridge holds the tree:
 * not the tree's bridge either — ended too, never left to go on beside it (found 2026-11-09 after an update: a bridge of
 * an older strom, whose successor ended for the tree's bridge, took that for "did not take over" and ran on for hours
 * from a version's folder the update had removed). Only that bridge — the one that said so (STROM_LIVE_REPLACES) or, of
 * an older strom, this one's parent — never one live.json names (that one checks its claim itself), never a process that
 * is no bridge; on Windows, which cannot tell a bridge by its command, only asked through its stop file, never a signal.
 */
function endStarter(root: string, env: Env, holder: number): void {
  const starter = replacedBridge(env);
  if (!starter || starter === holder || starter === process.pid) return;
  if (liveRunning(root)?.pid === starter) return;
  const how = endBridge(starter, root, { why: `another bridge of this tree runs (${holder}): the bridge of strom ${env.STROM_LIVE_RENEWED ?? VERSION} it started ended for it`, back: false, askOnly: process.platform === "win32" });
  if (how === "stopped" || how === "killed") noteLive(root, `the bridge ${starter} that started this one (${process.pid}) ended too: another bridge of this tree runs (${holder})`);
}

function sleep(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Start the bridge of a tree in the background (or find it running); undefined when it did not come up.
 * `current`: what is asked for is new (a copy with images): a bridge of an older strom is started again.
 */
export function startLive(root: string, env: Env, opts: { current?: boolean; why?: string } = {}): LiveInfo | undefined {
  const running = liveRunning(root);
  if (running && (!opts.current || running.version === VERSION)) return running;
  // no research there (moved, taken off): nothing to start, its folder never made again
  if (!fs.existsSync(path.join(root, "strom.json"))) return undefined;
  // one strom at a time starts a tree's bridge: another that wants it now finds it (found on Mac: an update starting a
  // bridge hundreds of times over)
  let release: () => void;
  try {
    release = acquireLock(path.join(root, ".strom", "live-start.lock"), { owner: "starting the bridge", waitMs: 15_000, staleMs: 60_000 });
  } catch {
    return liveRunning(root);
  }
  try {
    const now = liveRunning(root);
    if (now && (!opts.current || now.version === VERSION)) return now;
    // said by the one that starts it (two strom at once: one line, found on Mac)
    if (opts.why) noteLive(root, opts.why);
    return startNow(root, env, now);
  } finally {
    release();
  }
}

/** How little room on the disk of a research means no bridge starts there (its lock, its notes, live.json). */
const BRIDGE_ROOM = 1024 * 1024;

/**
 * Why a bridge did not start (strom live start, strom app --live): no room on the disk of the research — tried by a
 * small file written, as the system may say room it does not give — else the last line its log got since `since`
 * (none: undefined). Never throws.
 */
export function notStartedWhy(root: string, since: number): { full: true } | { full: false; line?: string } {
  const free = freeBytes(root);
  let full = free !== undefined && free < BRIDGE_ROOM;
  if (!full) {
    const probe = path.join(root, ".strom", `.room-${process.pid}`);
    try {
      fs.mkdirSync(path.dirname(probe), { recursive: true });
      fs.writeFileSync(probe, Buffer.alloc(64 * 1024));
    } catch (e) {
      full = isDiskFull(e);
    } finally {
      try {
        fs.rmSync(probe, { force: true });
      } catch {
        // what is left goes with the next tidy
      }
    }
  }
  if (full) return { full: true };
  try {
    const lines = fs.readFileSync(liveLogFile(root), "utf8").split("\n").filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      const m = /^(\S+) \[\d+\] (.*)$/u.exec(lines[i]!);
      if (!m) continue;
      if (!(Date.parse(m[1]!) >= since - 1000)) break;
      // the first line of what it said (a stack's message, never the stack)
      return { full: false, line: m[2]!.slice(0, 300) };
    }
  } catch {
    // no log: nothing to say
  }
  return { full: false };
}

function startNow(root: string, env: Env, running: LiveInfo | undefined): LiveInfo | undefined {
  if (running) stopLive(root, `a bridge of strom ${VERSION} is wanted (this one: ${running.version ?? "older"})`, { back: true });
  // the one ended was handing over to the bridge of the strom on disk, which runs now (one started would be of that
  // strom too): that one is the tree's
  const meanwhile = liveRunning(root);
  if (meanwhile && meanwhile.pid !== running?.pid) return meanwhile;
  dropLiveNote(root, meanwhile?.pid ?? running?.pid ?? 0);
  const before = readLast(root);
  const child = spawnBridge(root, env);
  // (a stuck bridge before it is ended first: up to some seconds) — a computer under load starts one slowly (the tree
  // settled, /status made first): the bridge still starting, its process alive, is waited for longer, never for ever
  const started = Date.now();
  // (STROM_LIVE_START_MS: the first wait made short, so a test proves a slow start is waited for without a slow computer)
  const firstMs = Number(env.STROM_LIVE_START_MS ?? BRIDGE_START_MS);
  for (;;) {
    const info = liveRunning(root);
    if (info) return before && (before.port !== info.port || before.token !== info.token) ? { ...info, moved: true } : info;
    const waited = Date.now() - started;
    if (waited < firstMs) sleep(50);
    else if (waited < BRIDGE_START_MAX_MS && child.pid !== undefined && isBridge(child.pid)) sleep(250);
    else return undefined;
  }
}

/** How long a bridge started is waited for to say it is there; still starting (its process alive): at most this long. */
const BRIDGE_START_MS = 10_000;
const BRIDGE_START_MAX_MS = 60_000;

/**
 * A bridge started on its own (detached). Nothing of it holds the tree's folder, which Windows would then refuse to
 * delete (found on Windows: the folder of a research could not be deleted after the menu closed, its bridge running on
 * for hours): on Windows it runs in the settings' folder, as the phone's server does (the tree is named to it:
 * STROM_TREE; bridgeCwd), and its log is no open file of the process (stderr) — each line opened, appended and closed
 * (noteLive), errors nobody caught too; what Node says when the process cannot even start is what `strom live serve`
 * shows in the foreground.
 */
function spawnBridge(root: string, env: Env, extra: Record<string, string> = {}): ChildProcess {
  // the version in use (a bridge outlives the strom that starts it; renewed: the newer one on disk)
  const { command, args } = lastingLauncher();
  try {
    // its log's folder (a research handed over comes without its .strom)
    fs.mkdirSync(path.dirname(liveLogFile(root)), { recursive: true });
  } catch {
    // without a log
  }
  // the bridge a bridge takes over from is said to it alone, never passed on to one a strom of it starts
  const { STROM_LIVE_REPLACES: _replaced, ...inherited } = env as NodeJS.ProcessEnv;
  const child = spawn(command, [...args, "live", "serve"], {
    cwd: bridgeCwd(root, env),
    env: { ...inherited, STROM_TREE: root, STROM_SPAWNED: "1", ...extra },
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
  return child;
}

/**
 * Where a bridge runs. On Windows the settings' folder (else the user's home), never its tree's: a folder a process runs
 * in cannot be deleted there. Elsewhere its tree's folder, which deleting or moving it never minds: an older strom (1.17
 * and before, on macOS and Linux) tells its tree's bridge by the folder it runs in, and one in another folder it never
 * ends — going back to it left the bridge running at the app's address, the older one's at another (found in the test
 * of a switch from the beta back to the release).
 */
export function bridgeCwd(root: string, env: Env, platform: NodeJS.Platform = process.platform): string {
  if (platform !== "win32" && fs.existsSync(root)) return root;
  const dir = configDir(env);
  try {
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  } catch {
    return userHome(env);
  }
}

/**
 * The bridge ended for good (strom live stop, strom uninstall): its secret dropped, its port kept — the next bridge gets a
 * new secret, the address the app kept is dead (the app gets the new one when the research is opened in it again). Whether
 * there was one to drop.
 */
export function dropLiveSecret(root: string, why: string): boolean {
  const last = readLast(root);
  if (!last?.token) return false;
  const { token: _dropped, ...rest } = last;
  writeLast(root, { ...rest, ended: last.ended ?? { at: new Date().toISOString(), reason: why } });
  noteLive(root, `its secret dropped (${why}): the next bridge gets a new one, at port ${last.port} while free — the Strom app gets it when the research is opened in it again (strom app)`);
  return true;
}

/** The bridge's last address forgotten: the next one gets a new secret (and port) — the address the app kept is dead. */
export function forgetLive(root: string): void {
  fs.rmSync(lastFile(root), { force: true });
  noteLive(root, "its address forgotten (strom live stop --forget): the next bridge gets a new one");
}

/** Whether a process is a bridge of strom (its command says "live serve"): a number taken by another program is never stopped. */
function isBridge(pid: number, platform: NodeJS.Platform = process.platform): boolean {
  if (!alive(pid)) return false;
  if (platform === "win32") return true;
  const r = spawnSync("ps", ["-o", "stat=,command=", "-p", String(pid)], { encoding: "utf8", timeout: 10_000 });
  // ps not to be asked: the bridge's own note is what there is
  if (r.error || r.status === null) return true;
  const out = (r.stdout ?? "").trim();
  return !out.startsWith("Z") && /\blive\s+serve\b/.test(out);
}

/** Where a bridge is asked to end: the same way on every system (a signal on Windows ends a process without a word). */
export function liveStopFile(root: string): string {
  return path.join(root, ".strom", "live-stop.json");
}

/** What a bridge is asked when it is to end: which bridge, why (into its log), whether another one comes at its address. */
interface StopAsk {
  pid: number;
  why: string;
  back?: boolean;
  /** Asked by the Strom app (POST <token>/live {"do": "stop"}): said so in the end event. */
  by?: "app";
}

/** Where a bridge asked to end says it writes what the app sent (a send, an original, an adoption): it ends after it. */
function liveBusyFile(root: string): string {
  return path.join(root, ".strom", "live-busy.json");
}

/** How long a bridge's "still writing" counts (it says it again every moment while it waits; a bridge stuck says nothing). */
const BUSY_FRESH_MS = 10_000;

/** How long the one asking a bridge to end waits while it says it writes (STROM_LIVE_STOP_WRITE_MS), then a signal. */
function stopWriteMs(env: Env = process.env): number {
  const ms = Number(env.STROM_LIVE_STOP_WRITE_MS ?? 30_000);
  return Number.isFinite(ms) && ms >= 0 ? ms : 30_000;
}

/** Whether the bridge of that number says now that it ends once what it writes is written. */
function bridgeWrites(root: string, pid: number): boolean {
  try {
    const said = JSON.parse(fs.readFileSync(liveBusyFile(root), "utf8")) as { pid?: number; at?: number };
    return said.pid === pid && typeof said.at === "number" && Date.now() - said.at < BUSY_FRESH_MS;
  } catch {
    return false;
  }
}

function readStopAsk(root: string): StopAsk | undefined {
  try {
    const ask = JSON.parse(fs.readFileSync(liveStopFile(root), "utf8")) as StopAsk;
    return Number.isInteger(ask.pid) && typeof ask.why === "string" ? ask : undefined;
  } catch {
    return undefined;
  }
}

/**
 * End a bridge's process: asked to through its stop file (it says the end to the app, closes its streams and ends — the
 * same on every system), else (a bridge of an older strom, or one stuck) by a signal: SIGTERM where a process hears it,
 * and when it does not end within a while ended for good (SIGKILL; on Windows a signal is that at once). A bridge that
 * says it writes what the app sent (a send, an original — cut short it would be lost or sent again) is waited for while
 * it says so, at most `writeMs` (STROM_LIVE_STOP_WRITE_MS, 30 s); only then a signal. How it ended: "stopped" as it
 * should, "killed" for good, "alive" when even that did not end it, "gone" when no bridge ran.
 */
export function endBridge(pid: number, root: string, opts: { waitMs?: number; askMs?: number; writeMs?: number; platform?: NodeJS.Platform; why?: string; back?: boolean; askOnly?: boolean } = {}): "stopped" | "killed" | "alive" | "gone" | "elsewhere" {
  const platform = opts.platform ?? process.platform;
  const waitMs = opts.waitMs ?? 3000;
  if (!isBridge(pid, platform)) return "gone";
  // a bridge of another folder (a note copied with the research) is never ended for this tree
  if (bridgeElsewhere(pid, root)) return "elsewhere";
  // ended: no such process, or one that only waits for its parent to hear it ended (a zombie)
  const ended = () => {
    if (!alive(pid)) return true;
    if (platform === "win32") return false;
    const r = spawnSync("ps", ["-o", "stat=", "-p", String(pid)], { encoding: "utf8", timeout: 5000 });
    return !r.error && (!(r.stdout ?? "").trim() || (r.stdout ?? "").trim().startsWith("Z"));
  };
  const gone = (ms: number, also: () => boolean = () => false) => {
    for (let t = 0; t < ms; t += 100) {
      if (ended() || also()) return true;
      sleep(100);
    }
    return ended() || also();
  };
  const file = liveStopFile(root);
  const taken = () => readStopAsk(root)?.pid !== pid;
  try {
    let asked = false;
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(`${file}.${process.pid}`, JSON.stringify({ pid, why: opts.why ?? "asked to end", ...(opts.back === undefined ? {} : { back: opts.back }) }));
      fs.renameSync(`${file}.${process.pid}`, file);
      asked = true;
    } catch {
      // its folder cannot be written: a signal is what there is
    }
    // heard: it takes the ask within a moment, then ends (its last streams closed)
    let heard = asked && gone(opts.askMs ?? 1000, taken);
    // heard, but something the app sent is being written: waited for while the bridge says so, at most a while
    if (asked && !heard && bridgeWrites(root, pid)) {
      const writeMs = opts.writeMs ?? stopWriteMs();
      const from = Date.now();
      while (!heard && Date.now() - from < writeMs && bridgeWrites(root, pid)) heard = gone(Math.min(250, writeMs - (Date.now() - from)), taken);
      if (!heard && bridgeWrites(root, pid)) noteLive(root, `the bridge ${pid} still wrote what the app sent after ${Math.round((Date.now() - from) / 1000)} s: ended without waiting longer`);
    }
    if (heard) {
      if (gone(waitMs + 1000)) return "stopped";
    } else if (opts.askOnly) {
      // only asked (a process not to be told for a bridge by its command): one that did not hear is left as it is
      return "alive";
    } else {
      // not heard (a bridge of an older strom, one stuck): asked by a signal — on Windows that ends it at once, unheard
      const signal = platform === "win32" ? "SIGKILL" : "SIGTERM";
      try {
        process.kill(pid, signal);
      } catch (e) {
        return (e as NodeJS.ErrnoException).code === "ESRCH" ? "stopped" : "alive";
      }
      if (gone(platform === "win32" ? 2000 : waitMs)) return platform === "win32" ? "killed" : "stopped";
      if (platform === "win32") return "alive";
    }
    try {
      process.kill(pid, "SIGKILL");
    } catch (e) {
      return (e as NodeJS.ErrnoException).code === "ESRCH" ? "stopped" : "alive";
    }
    return gone(2000) ? "killed" : "alive";
  } finally {
    // an ask nobody took is not left for a bridge that comes later with that number
    if (readStopAsk(root)?.pid === pid) fs.rmSync(file, { force: true });
  }
}

/**
 * Stop the bridge of a tree (why: into its log; back: another bridge comes at its address at once — the app following it
 * goes on): how it went — "none" when none ran, "alive" when it could not be ended.
 */
export function stopLive(root: string, why = "strom live stop", opts: { back?: boolean } = {}): "none" | "stopped" | "killed" | "alive" {
  const info = liveRunning(root);
  if (!info) return "none";
  noteLive(root, `stop asked: ${why}`);
  const last = readLast(root);
  if (last?.pid === info.pid) writeLast(root, { ...last, ended: { at: new Date().toISOString(), reason: why, kind: opts.back ? "restart" : "stopped" } });
  const how = endBridge(info.pid, root, { why, back: opts.back ?? false });
  if (how === "elsewhere") {
    noteLive(root, `a bridge of another folder (${info.pid}) is named in live.json: not ended, not this tree's`);
    fs.rmSync(liveFile(root), { force: true });
    return "none";
  }
  if (how === "killed") noteLive(root, `the bridge ${info.pid} did not end when asked: ended for good (SIGKILL)`);
  if (how === "alive") {
    noteLive(root, `the bridge ${info.pid} could not be ended`);
    return "alive";
  }
  // (the bridge it handed over to may have written its own note meanwhile: kept)
  dropLiveNote(root, info.pid);
  // no bridge of that number ran (it ended meanwhile, the number another program's): none was stopped
  return how === "gone" ? "none" : how;
}

/**
 * Whether the Strom app has this tree: its bridge runs, or the last one kept its secret address (the app was given it;
 * never after strom live stop or uninstall) — and the person did not say there is no app. What is said of the app
 * (after intake: where the material is in it) only then.
 */
export function appHasTree(root: string, settings: Settings): boolean {
  if (stromAppState(settings) === "no") return false;
  return !!liveRunning(root) || !!readLast(root)?.token;
}

/** Whether a bridge's end was its idle time running out (its kind, else the reason an older strom wrote: "idle: …"). */
function endedIdle(last: LiveLast): boolean {
  if (last.ended?.kind) return last.ended.kind === "idle";
  return /^idle\b/.test(last.ended?.reason ?? "");
}

/**
 * The bridge of a tree that ended without a word (a crash, killed) is started again — on its address, so the
 * Strom app following it goes on by itself. One that ended as it should (idle, stopped) stays so — but new work in the
 * tree (work: a session starts) brings back one that ended idle, at its address, when the app was given it (its secret
 * kept: never after strom live stop or uninstall) and the tree is no archive: the app watching the tree without
 * following it (/status?poll=1) sees it at work again.
 */
export function reviveLive(root: string, env: Env, opts: { work?: boolean } = {}): LiveInfo | undefined {
  const last = readLast(root);
  if (!last || alive(last.pid) || liveRunning(root)) return undefined;
  if (last.ended) {
    if (!opts.work || !last.token || !endedIdle(last)) return undefined;
    try {
      if (isArchive({ config: readJsonIfExists<{ mode?: string }>(path.join(root, TREE_FILE)) ?? {} })) return undefined;
    } catch {
      return undefined;
    }
  }
  const why = last.ended
    ? `work in the tree again: the bridge ${last.pid} that ended idle started again at its address`
    : `the bridge ${last.pid} ended without a word: started again`;
  const info = startLive(root, env, { why });
  // one that does not come up is not tried at every session again (each try waits for it some seconds)
  if (!info) writeLast(root, { ...last, ended: { at: new Date().toISOString(), reason: "did not start again" } });
  return info;
}

/** The pages that may read the bridge: the Strom app, and a local copy of it for its development. */
function allowedOrigin(origin: string | undefined): string | undefined {
  return origin && isStromAppOrigin(origin) ? origin : undefined;
}

/**
 * A request with the secret from a page that is no Strom app: the address got out. Not one without an Origin (curl, a
 * process of this computer, the app's EventSource), "null" (the app opened as a file), a page the bridge lets in, nor the
 * copy of the app the person set (strom.app.url).
 */
function foreignOrigin(origin: string | undefined, env: Env): boolean {
  if (origin === undefined || origin === "null" || allowedOrigin(origin)) return false;
  try {
    const said = appUrlSetting(new Settings(env, {}));
    if (!said.invalid && new URL(said.url).origin === origin) return false;
  } catch {
    // no setting to read: the pages the bridge lets in are what there is
  }
  return true;
}

/** An address as the log says it: never its secret (one replaced meanwhile neither), never what the queue was searched for. */
export function masked(url: string | undefined): string {
  // the bridge's secret, and what the person searched for in the queue (GET /queue?q=): never in the log
  return String(url ?? "").replace(/\/[0-9a-f]{32}(?=[/?]|$)/, "/…").replace(/([?&])q=[^&#]*/gu, "$1q=…");
}

/** live.json written whole: a strom reading it meanwhile never takes a half for no bridge. */
function writeLive(root: string, info: LiveInfo): void {
  const file = liveFile(root);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}.${process.pid}`, JSON.stringify({ ...info, root: realRoot(root) }, null, 2));
  fs.renameSync(`${file}.${process.pid}`, file);
}

function head(root: string): string {
  const r = spawnSync(gitProgram() ?? "git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", windowsHide: true });
  return r.status === 0 ? r.stdout.trim() : "";
}

/** The last commit and when it was made (the app: "changed 5 min ago"). */
function tip(root: string): { head: string; at?: string } {
  const r = spawnSync(gitProgram() ?? "git", ["log", "-1", "--format=%H%x1f%cI"], { cwd: root, encoding: "utf8", windowsHide: true });
  const [head = "", at = ""] = r.status === 0 ? r.stdout.trim().split("\x1f") : [];
  return { head, ...(at ? { at } : {}) };
}

/** What one commit saved, as lines: each change a command listed, else its subject. */
function saved(subject: string, body: string): string[] {
  const listed = body.split("\n").filter((l) => l.startsWith("- ")).map((l) => l.slice(2));
  return listed.length ? listed : [subject];
}

function subjects(root: string, from: string, to: string): string[] {
  const r = spawnSync(gitProgram() ?? "git", ["log", "--format=%x1e%s%x1f%b", from ? `${from}..${to}` : "-1", to], { cwd: root, encoding: "utf8", windowsHide: true });
  if (r.status !== 0) return [];
  const commits = r.stdout.split("\x1e").slice(1).reverse();
  return commits.flatMap((c) => {
    const [subject = "", body = ""] = c.split("\x1f");
    return saved(subject.trim(), body);
  });
}

/** At most so many commits /log gives (the app takes no more). */
const LOG_MAX = 500;

/**
 * What the research saved, newest first: each commit, when, what, and the task
 * it was saved for — the session whose operation log (data/ops/N….jsonl) or
 * record the commit wrote, else the one session open at that time.
 */
/** The operations each commit logged (data/ops/*.jsonl only grow: its added lines), in the order they were made. */
function opsByCommit(root: string, range: string[]): Map<string, Op[]> {
  const out = new Map<string, Op[]>();
  const r = runGit(root, ["log", ...range, "--format=%x1e%H", "-p", "--unified=0", "--no-color", "--no-ext-diff", "--", "data/ops/"]);
  if (r.status !== 0) return out;
  for (const c of r.stdout.split("\x1e").slice(1)) {
    const [hash = "", ...rest] = c.split("\n");
    const ops: Op[] = [];
    for (const line of rest)
      if (line.startsWith("+{"))
        try {
          ops.push(JSON.parse(line.slice(1)) as Op);
        } catch {
          // a line cut short: its commit is said by its subject
        }
    out.set(hash.trim(), ops.sort((a, b) => a.at.localeCompare(b.at)));
  }
  return out;
}

/**
 * The people and sources of a send under the IDs the research gave them, by the app's xref (@…@): those it brought
 * (person.add, source.add) and those it named by the app's own marks, given their IDs when it came. None: nothing.
 */
function idsOf(applied: { do: string; id: string; before?: unknown }[], known?: { persons: Record<string, string>; sources: Record<string, string> }): { ids?: { persons: Record<string, string>; sources: Record<string, string> } } {
  const brought = (kind: string) =>
    Object.fromEntries(applied.filter((a) => a.do === kind && typeof a.before === "string" && a.before.startsWith("x:")).map((a) => [`@${String(a.before).slice(2)}@`, a.id]));
  const ids = { persons: { ...(known?.persons ?? {}), ...brought("person.add") }, sources: { ...(known?.sources ?? {}), ...brought("source.add") } };
  return Object.keys(ids.persons).length || Object.keys(ids.sources).length ? { ids } : {};
}

/** What the bridge does that an app may ask about (each added once, never taken away; origin.ids said only with the IDs sent: bridgeFeatures). */
/**
 * What the tree's file answers carry beside it: not kept by the browser (the app keeps its tree), and the headers the
 * app on its own page reads (CORS shows a page only those named): its ETag, the head it is of, an older one's marks.
 */
const GED_HEADERS = { "Cache-Control": "no-store", "Access-Control-Expose-Headers": "ETag, X-Strom-Head, X-Strom-Stale, X-Strom-Head-Now, X-Strom-Images" };

/** The client takes a packed answer (Accept-Encoding: gzip, not refused by q=0). */
function takesGzip(req: http.IncomingMessage): boolean {
  return String(req.headers["accept-encoding"] ?? "")
    .split(",")
    .some((part) => {
      const [name, ...params] = part.trim().toLowerCase().split(";");
      return (name === "gzip" || name === "*") && !params.some((x) => /^\s*q\s*=\s*0(\.0*)?\s*$/u.test(x));
    });
}

/** Vary of a packed answer: what it varied by already (the page asking: Origin) and Accept-Encoding. */
function varyGzip(res: http.ServerResponse): string {
  return [res.getHeader("Vary"), "Accept-Encoding"].filter((x) => x !== undefined && x !== "").join(", ");
}

/** Bytes packed by gzip off the bridge's own thread (zlib's pool). */
function gzipped(bytes: Uint8Array, level: number): Promise<Buffer> {
  return new Promise((resolve, reject) => zlib.gzip(bytes, { level }, (e, out) => (e ? reject(e) : resolve(out))));
}

/** How the tree's file is asked to carry its images: ?images=ref by reference (spec 071), anything else in it as always. */
function imagesAsked(req: Pick<http.IncomingMessage, "url">): GedImages {
  return new URLSearchParams((req.url ?? "").split("?")[1] ?? "").get("images") === "ref" ? "ref" : "data";
}

/** Does the app ask for the files of its tree with it (?media=app, spec 108)? Else the file as before. */
function mediaAsked(req: Pick<http.IncomingMessage, "url">): boolean {
  return new URLSearchParams((req.url ?? "").split("?")[1] ?? "").get("media") === "app";
}

/** The ETag of the tree's file for the app (feature ged.etag): told by the research's head and the file's variant alone. */
export function gedTag(head: string, variant: string): string {
  return `"${crypto.createHash("sha256").update(`${head}\n${variant}`, "utf8").digest("hex").slice(0, 32)}"`;
}

/** Does the request's If-None-Match name this ETag (a list, weak or strong, or *)? */
export function tagMatches(req: Pick<http.IncomingMessage, "headers">, tag: string): boolean {
  const asked = req.headers["if-none-match"];
  if (!asked) return false;
  return String(asked)
    .split(",")
    .map((t) => t.trim().replace(/^W\//u, ""))
    .some((t) => t === "*" || t === tag);
}

/** A send naming by reference a file the research cannot find (spec 133 §1.4): refused whole, 409. */
const MEDIA_REF_UNKNOWN = "sync.media-ref-unknown";

/** How many hashes POST /media/known takes at once. */
export const MEDIA_KNOWN_MAX = 5000;

export const BRIDGE_FEATURES = ["sync.again", "sync.undoneSince", "sync.takenBack", "sync.conflictEdit", "sync.since", "sync.ids", "family.noCouple", "family.alone", "adopt.transfer", "adopt.empty", "material.list", "person.titles", "media.codes", "hypothesis.links", "status.recent", "spend.readers", "hypothesis.intree", "archive.permission", "task.check", "waiting.groups", "waiting.sent", "waiting.note", "batch.kept", "live.end", "whats.new", "terminal.choice", "person.marriedSurname", "phone", "read.now", "read.sync", "excerpt.get", "log.sources", "material.assign", "material.thumb", "seal.foreign", "tree.state", "disk.full", "tree.notDownloaded", "sync.removed", "tree.kind", "experiments", "experiments.off", "experiments.link", "experiments.split", "history.events", "history.hide", "experiments.pace", "history.first", "history.regions", "history.hide.all", "history.skip", "history.map", "history.delete", "history.delete.restore", "stories.history", "history.place", "surnames.suggest", "surnames.read", "lineage.read", "duplicates.judge", "quality.dismiss", "quality.read", "person.primary", "fixes.list", "fixes.towns", "history.back", "places.identify", "places.answer", "places.undo", "tasks.offLine", "status.busy", "history.kinds", "history.align", "places.nameKinds", "directions.edit", "directions.order", "directions.found", "directions.people", "directions.places", "offLine.branches", "queue.own", "story.sources", "queue.page", "status.parts", "waiting.answer", "browser.state", "working.place", "working.family", "working.helps", "hypotheses.decide", "sources.confirm", "read.sourceTask", "read.sourceTask.unsure", "read.choose", "read.choices.now", "read.source", "read.sourceEntry", "read.blindText", "read.kinds", "read.variantKind", "read.readerState", "live.idle", "live.stop", "live.start", "sources.proposal", "sources.proposal.undo", "origin", "origin.ids", "origin.import", "verify", "verify.bulk", "facts.confirm", "verify.stop", "ged.stale", "facts.confirm.value", "ged.etag", "ged.imagesByHash", "hypothesis.decide.link", "hypotheses.accept.link", "sources.fields", "sources.split", "queue.search", "queue.next", "work.link", "run.tasks", "queue.kind", "work.tasks", "verify.tryFirst", "event.share", "citations.order", "sync.notWritten.codes", "citations.main", "citations.remove", "books", "media.app", "material.links", "material.edit", "material.uses", "material.sort", "tasks.audit", "handoffs", "material.sourceOf", "material.left", "material.sameAs", "material.accepted", "material.decided", "material.sortRun", "material.delete", "inbox.aside", "source.retract", "material.trees", "census", "house", "house.material", "house.confirm", "house.import", "house.auto", "house.request", "house.chat", "house.look", "house.story", "name-status", "task.holds", "archive.holds", "media.queued", "media.known", "intake.auto", "run.lines", "run.agents", "run.stop", "run.limit", "directions.move", "sync.mediaRef", "person.contact", "media.list", "media.list.source", "waiting.gain", "sort.confirm", "working.saving", "waiting.retry", "sort.confirm.app", "run.confirm", "finds", "finds.person", "glance", "people.search", "waiting.import", "waiting.sentDay", "waiting.persons", "material.houses", "health", "health.ai", "audit.decide"] as const;

/**
 * What only a research with its agent here does (accepts.read: none in an archive, nor where it waits for its agent);
 * finds: what an agent found, which an archive never says (GET finds answers none there).
 */
const AGENT_FEATURES: ReadonlySet<string> = new Set(["material.sort", "material.decided", "run.lines", "run.agents", "run.stop", "run.limit", "directions.move", "sort.confirm", "sort.confirm.app", "run.confirm", "finds", "finds.person", "house.import", "house.request", "house.chat", "house.story", "health.ai", "audit.decide"]);
const withoutAgent = (features: readonly string[]): readonly string[] => features.filter((f) => !AGENT_FEATURES.has(f));
/**
 * The sample research (strom demo, spec 143 K2.2): looked through as a research, but nothing that starts or offers an
 * agent — the agent's features, and the links and the tasks that start one (work.link, run.tasks, work.tasks), a task
 * returned to the agent (waiting.retry) and the bulk verification it does (verify.bulk, verify.tryFirst); what waits
 * carries no chat with the agent (core/waiting.ts) and accepts no reading at once (accepts.read).
 */
const DEMO_HIDDEN: ReadonlySet<string> = new Set(["work.link", "run.tasks", "work.tasks", "waiting.retry", "verify.bulk", "verify.tryFirst"]);
const forDemo = (features: readonly string[]): readonly string[] => withoutAgent(features).filter((f) => !DEMO_HIDDEN.has(f));

/**
 * The gateway of the devices of the home network (devices.mode on, the person's in their terminal): the dialog to
 * connect a device and the list of them (device.gateway), a device renamed (device.rename: PUT phone/devices/<id>), the
 * event device of the stream (device.events). Off: nothing said at all. No device.phonePage (said until 1.37.0-beta.7):
 * one way to pair — the app's code alone, the phone's page no choice of the app any more (an app that still asks for it
 * gets the app's code).
 */
const DEVICE_FEATURES: readonly string[] = ["device.gateway", "device.rename", "device.events"];
/**
 * A device starts the agent as the app on the computer does (spec 094 K3.15: device/agent of the gateway, the bridge's
 * own work of the agent through it) — only where the agent researches: never in an archive or a research waiting for
 * its agent.
 */
const DEVICE_AGENT_FEATURES: readonly string[] = ["device.agent"];
/** The rows of the devices looked at for the event device at most this often. */
const DEVICE_EVENTS_MS = 5000;
const withDevices = (features: readonly string[], env: Env, agent = true): readonly string[] => (devicesOn(env) ? [...features, ...DEVICE_FEATURES, ...(agent ? DEVICE_AGENT_FEATURES : [])] : features);

/**
 * What the bridge says it does to the app of that version: BRIDGE_FEATURES, but origin.ids only where its /tree.ged
 * carries the original IDs (the gate of the origins, the same version of the app as the file goes by) — an app that is
 * told so takes the research's file as the IDs' keeper and drops its own (found by the joint check of spec 066).
 * name-status (spec 066 P5: a name's status, confirmation and verification — its id P….N) only where /tree.ged says
 * them under NAME (APP_READS_NAME_STATUS, the same version of the app as the file goes by: `nameGate`, `nameBeta`);
 * the person's in an archive too (the confirmation against the scan is theirs).
 */
export function bridgeFeatures(
  settings: Settings,
  version?: string,
  gate: string | undefined = APP_SHOWS_ORIGIN,
  beta: string | undefined = APP_SHOWS_ORIGIN_BETA,
  nameGate: string | undefined = APP_READS_NAME_STATUS,
  nameBeta: string | undefined = APP_READS_NAME_STATUS_BETA,
): readonly string[] {
  // spec 095: the main citation only to an app that reads it (its /tree.ged carries _STROM_MAIN), a citation removed
  // only from one whose file says it (APP_SENDS_UNCITE); the order and the codes of what is not written to every one
  const off = new Set<string>([
    ...(appShowsOrigin(settings, version, gate, beta) ? [] : ["origin.ids"]),
    ...(appReadsMainCitation(settings, version) ? [] : ["citations.main"]),
    ...(appSendsUncite(version) ? [] : ["citations.remove"]),
    ...(appReadsNameStatus(settings, version, nameGate, nameBeta) ? [] : ["name-status"]),
  ]);
  return off.size ? BRIDGE_FEATURES.filter((f) => !off.has(f)) : BRIDGE_FEATURES;
}

/**
 * /status with the links of the app taken in the last minute (feature handoffs, core/handoffs.ts): read at each ask,
 * never kept with what is made for a state — a link taken changes nothing of the research.
 */
export function withHandoffs(made: string, ids: readonly string[], runs?: { runs: RunView[]; runsEnded: EndedRun[] }): string {
  const more = runs ? `,"runs":${JSON.stringify(runs.runs)},"runsEnded":${JSON.stringify(runs.runsEnded)}` : "";
  return `${made.slice(0, made.lastIndexOf("}"))},"handoffs":${JSON.stringify(ids)}${more}}`;
}

/** /status work: the gate the agent works alone under (its title and what it is given), none set null; a session's minutes. */
function workOf(tree: Tree, settings: Settings): { gate: string | null; minutes: number; confirm: "ask" | "no" } {
  const spec = settings.runGate();
  // whether the terminal asks before the agent starts from the link work (run.confirm, the person's): the app says it (spec 126)
  return { gate: spec ? gateLabel(settings.shared()?.value, spec) : null, minutes: settings.number("run.minutes", tree.config, DEFAULT_RUN_MINUTES), confirm: settings.runConfirm() };
}

/** /status busy: how many sessions and runs work now. */
function busyOf(tree: Tree): { sessions: number; runs: number } {
  const b = busyIn(tree);
  return { sessions: b.sessions.length, runs: b.runs };
}

/** /status recent, when it is ready. */
function recentOf(root: string, env: Env, head: string): { recent?: Recent } {
  const recent = head ? recentNow(root, env, head) : undefined;
  return recent ? { recent } : {};
}

/** What git says of one commit (its time, message, files and the operations it logged): never changes for its hash. */
interface RawCommit {
  head: string;
  at: string;
  subject: string;
  body: string;
  files: string;
  ops: Op[];
}

function rawCommits(root: string, range: string[]): RawCommit[] {
  const r = runGit(root, ["log", ...range, "--format=%x1e%H%x1f%cI%x1f%s%x1f%b%x1f", "--name-only"]);
  if (r.status !== 0) return [];
  const ops = opsByCommit(root, range);
  return r.stdout
    .split("\x1e")
    .slice(1)
    .map((c) => {
      const [head = "", at = "", subject = "", body = "", files = ""] = c.split("\x1f");
      return { head, at, subject, body, files, ops: ops.get(head) ?? [] };
    });
}

/**
 * A task as the app shows it (/log, a change's entries, who is at work): its ID first — the app groups the history by
 * it — then its text with the records it names by their names, as the queue says it. A task's own words stay as they
 * were written (an old task strom wrote in English is not written anew).
 */
function taskTitle(tree: Tree, task: Task): string {
  return `${task.id} ${humanTask(tree, task.what, tree.lang)}`;
}

export { notWrittenOf } from "./sync.ts";

/** The commits as the app reads them — what depends on the research now (names, tasks, directions) worked out afresh. */
function rendered(tree: Tree, raws: RawCommit[]): HistoryEntry[] {
  const sessions = new Map(tree.list<Session>("session").map((s) => [s.id, s]));
  let all: Scope[] | undefined;
  const now = Date.now();
  const titles = new Map<string, string>();
  // an archive's history says nothing of tasks (asked once, not for each commit)
  const tasks = !actsAsArchive(tree);
  const taskOf = (s: Session | undefined): { task?: string } => {
    if (!s?.task) return {};
    const task = tree.get<Task>(s.task);
    if (task && !titles.has(task.id)) titles.set(task.id, taskTitle(tree, task));
    return { task: task ? titles.get(task.id)! : s.task };
  };
  return raws.map(({ head, at, subject, body, files, ops }) => {
    const named = new Set<string>();
    for (const f of files.split("\n")) {
      const m = /^data\/(?:ops\/(?:[^/]+\/)*(N\d+)(?:\.[^/]*)?\.jsonl|sessions\/(N\d+)\.json)$/.exec(f.trim());
      if (m) named.add((m[1] ?? m[2])!);
    }
    const when = Date.parse(at);
    const open = named.size ? [] : [...sessions.values()].filter((s) => Date.parse(s.started) <= when && when <= (s.ended ? Date.parse(s.ended) : now));
    const s = named.size === 1 ? sessions.get([...named][0]!) : open.length === 1 ? open[0] : undefined;
    const lines = changeLines(tree, ops, subject.trim(), tree.lang, undefined, tasks);
    // the directions only when a session needs them (they cost)
    const research = s ? sessionResearch(tree, s, s.research ? [] : (all ??= scopes(tree))) : undefined;
    // the sources each line names, for the app to open them (only when one does)
    const sources = lines.some((l) => l.sources?.length) ? { sources: lines.map((l) => l.sources ?? []) } : {};
    // the run whose session it was (spec 126: the app's follow-up of a run); never in an archive
    const run = tasks && s?.worker?.startsWith("run-") ? { run: s.worker } : {};
    return { head, at, what: saved(subject.trim(), body), text: lines.map((l) => l.text), kinds: lines.map((l) => l.kind), ...sources, ...taskOf(s), ...(research ? { research } : {}), ...run, ...viaOf(ops), ...returnOf(ops) };
  });
}

/**
 * A return in time (strom history back), for the app to show it apart: the change it went back to (its first 8, as
 * strom history back takes it) and when that change was. Nothing for any other commit.
 */
/** The device of the Strom app whose send a commit wrote (spec 094). */
function viaOf(ops: Op[]): { via?: AppClient } {
  const v = ops.find((x) => x.via)?.via;
  return v ? { via: v } : {};
}

function returnOf(ops: Op[]): { kind?: "return"; to?: string; toAt?: string } {
  const o = ops.find((x) => x.op === RETURN_OP);
  const m = o ? /^Return to the state of (\S+) \(([0-9a-f]{7,40})\)/u.exec(o.summary) : null;
  return m ? { kind: "return", to: m[2]!, toAt: m[1]! } : {};
}

export interface HistoryEntry {
  head: string;
  at: string;
  what: string[];
  text: string[];
  kinds: ChangeKind[];
  /** The sources each line of `text` names (S…, as the research has them now): only when a line names one. */
  sources?: string[][];
  task?: string;
  research?: string;
  /** The run (strom run, its worker) whose session made it (spec 126). */
  run?: string;
  /** The device of the Strom app whose send it wrote (spec 094): its ID and name. */
  via?: AppClient;
  /** A return in time (strom history back): `to` the change it went back to (its first 8), `toAt` when that was. */
  kind?: "return";
  to?: string;
  toAt?: string;
}

export function history(root: string, tree: Tree, range: string[] = [`-n${LOG_MAX}`]): HistoryEntry[] {
  return rendered(tree, rawCommits(root, range));
}

/**
 * What the bridge works out for a state of the research (/log for a head, /fixes for their stamp), one at a time: an ask
 * for the state being made waits for it; an ask for another waits for the next, made once for the state as it is when
 * that one starts. (An agent's commits a second apart each made one more, side by side on a busy computer: each took
 * longer, and the answers came ten seconds late and later — found 2026-11-04.)
 */
export class OneAtATime<T> {
  private making?: { key: string; done: Promise<T> };
  private next?: Promise<T>;
  private readonly keyNow: () => string;
  private readonly make: (key: string) => Promise<T>;
  constructor(keyNow: () => string, make: (key: string) => Promise<T>) {
    this.keyNow = keyNow;
    this.make = make;
  }

  ask(key: string): Promise<T> {
    if (!this.making) return this.start(key);
    if (this.making.key === key) return this.making.done;
    this.next ??= this.making.done
      .catch(() => undefined)
      .then(() => {
        this.next = undefined;
        return this.start(this.keyNow());
      });
    return this.next;
  }

  private start(key: string): Promise<T> {
    let done: Promise<T>;
    try {
      done = this.make(key);
    } catch (e) {
      done = Promise.reject(e);
    }
    const now = { key, done };
    this.making = now;
    const over = () => {
      if (this.making === now) this.making = undefined;
    };
    done.then(over, over);
    return done;
  }
}

/**
 * The history a bridge gives again and again (/log, each change): what git says of a commit is kept by its hash, so
 * after a new commit git is asked about the new ones only — the same entries, in the same order, as history() gives.
 */
export class HistoryCache {
  private known = new Map<string, RawCommit>();
  /** How many commits the last log() asked git about (the new ones only, once it knows the rest). */
  read = 0;
  private readonly root: string;
  constructor(root: string) {
    this.root = root;
  }

  /** The last LOG_MAX commits up to `h`, newest first (as history(root, tree) at h). */
  log(tree: Tree, h: string): HistoryEntry[] {
    return rendered(tree, this.raws(h));
  }

  /** What git says of the last LOG_MAX commits up to `h`, newest first: asked about the ones it does not know only. */
  raws(h: string): RawCommit[] {
    if (!h) return [];
    const listed = runGit(this.root, ["rev-list", `-n${LOG_MAX}`, h]);
    if (listed.status !== 0) return rawCommits(this.root, [`-n${LOG_MAX}`, h]);
    const order = listed.stdout.split("\n").filter(Boolean);
    // the newest ones it has not seen; anything else unknown (a history written anew): all of it again
    let k = 0;
    while (k < order.length && !this.known.has(order[k]!)) k++;
    if (order.slice(k).some((x) => !this.known.has(x))) k = order.length;
    const fresh = k ? rawCommits(this.root, [`-n${k}`, h]) : [];
    this.read = k;
    if (fresh.length !== k || fresh.some((c, i) => c.head !== order[i])) {
      this.read = order.length;
      return this.keep(rawCommits(this.root, [`-n${LOG_MAX}`, h]));
    }
    return this.keep(order.map((x, i) => (i < k ? fresh[i]! : this.known.get(x)!)));
  }

  /** The commits after `from` up to `to` (a change the app hears), newest first; kept for the next /log. */
  since(tree: Tree, range: string[]): HistoryEntry[] {
    const raws = rawCommits(this.root, range);
    for (const c of raws) this.known.set(c.head, c);
    // never more than a few hundred kept: the oldest go first (a /log after it asks git about them again)
    for (const old of this.known.keys()) {
      if (this.known.size <= 2 * LOG_MAX) break;
      this.known.delete(old);
    }
    return rendered(tree, raws);
  }

  private keep(raws: RawCommit[]): RawCommit[] {
    // oldest first, as since() adds the newer ones after them
    this.known = new Map([...raws].reverse().map((c) => [c.head, c]));
    return raws;
  }
}

/**
 * The direction a task belongs to, for the app's names of directions on tasks and its filter: its own, else the one it
 * helps (core/offline.ts); off the lines, helping none: when it comes as its branch's choice or the tree's says
 * (offLine: occasional — now and then one; last — after the lines' work; never — not taken), nothing while it is
 * taken as the lines' work; its branch (B-P…), also when the branch was added to a line.
 */
function researchOf(place: (t: Task) => Placed, offLine: OffLine, file: OfflineFile, t: Task): { research?: string; offLine?: Exclude<OffLine, "normal">; helps?: string; branch?: string } {
  const p = place(t);
  const mode = p.off ? branchModeOf(file, offLine, p.branch).mode : undefined;
  return { ...(p.research ? { research: p.research } : {}), ...(mode && mode !== "normal" ? { offLine: mode } : {}), ...(p.helps ? { helps: p.helps } : {}), ...(p.branch ? { branch: p.branch } : {}) };
}

/** The one person a task is about (its subject names exactly one), for the app's badge on that person. */
function personOf(t: Task | undefined): { person?: string } {
  const people = (t?.subject ?? []).filter((id) => /^P\d{1,7}$/.test(id));
  return people.length === 1 ? { person: people[0]! } : {};
}

/** Who works, as the user reads it: "Claude Code on its own", "Codex conversation" in the research language. */
export function whoAtWork(label: string, lang: string): string {
  const run = /^(.+) on its own$/.exec(label);
  if (run) return phrase(lang, "who.run", { agent: run[1]! });
  const chat = /^(.+) conversation$/.exec(label);
  return chat ? phrase(lang, "who.chat", { agent: chat[1]! }) : label;
}

/**
 * The person an agent works on, for the app to follow it in the tree: the first person its task is about (a marriage
 * names both, the one it asks about first), else the last one its session wrote about. Work on a family (a couple's
 * story, its marriage — subject F…, or a record of it written last): its first partner as the person, the husband, else
 * the wife (an app reading only `person` follows the couple so), and the family itself (feature working.family).
 */
function workedOn(tree: Tree, ops: Op[], task: Task | undefined): { person?: string; family?: string } {
  const of = (id: string): { person?: string; family?: string } | undefined => {
    if (/^P\d{1,7}$/.test(id)) return tree.get(id) !== undefined ? { person: id } : undefined;
    if (!/^F\d{1,7}$/.test(id)) return undefined;
    const fam = tree.get<Family>(id);
    if (!fam) return undefined;
    const partners = fam.partners.filter((p) => tree.get(p) !== undefined);
    const husband = partners.find((p) => tree.get<Person>(p)?.sex === "M") ?? partners.find((p) => p === fam.husb) ?? partners[0];
    return { ...(husband ? { person: husband } : {}), family: id };
  };
  for (const id of task?.subject ?? []) {
    const found = of(id);
    if (found) return found;
  }
  // a record written: its last person, else its family
  for (let i = ops.length - 1; i >= 0; i--) {
    const targets = ops[i]!.targets ?? [];
    const person = targets.findLast((id) => /^P\d{1,7}$/.test(id) && tree.get(id) !== undefined);
    if (person) return { person };
    for (const id of [...targets].reverse()) {
      const found = of(id);
      if (found) return found;
    }
  }
  return {};
}

/** What a session wrote, in its order (a line being written, or a log not readable: left out). */
function sessionOps(root: string, s: Session): Op[] {
  let lines: string[] = [];
  try {
    lines = opsLogsOf(path.join(root, "data"), s.id).flatMap((file) => fs.readFileSync(file, "utf8").split("\n"));
  } catch {
    return [];
  }
  const ops: Op[] = [];
  for (const line of lines) {
    try {
      if (line.trim()) ops.push(JSON.parse(line) as Op);
    } catch {
      // a line being written
    }
  }
  return ops;
}

/**
 * Who is at work now, on which task: an agent strom started (a run, a conversation) and its open session, and an agent
 * working directly (no run, no conversation of strom's) whose session strom holds alive (spec 127, core/holds.ts). Each
 * with its session's hold (hold {by, since, beat, until?}; until none: a live process on this computer holds it, free
 * when it ends) — feature task.holds — and a run waiting for a restricted archive another session uses, its wait
 * (waits {archive, since, until}) beside its paused — feature archive.holds.
 */
function working(root: string, tree: Tree, all: Scope[]): { who: string; since: string; run?: string; session?: string; task?: string; person?: string; family?: string; place?: string; research?: string; helps?: string; branch?: string; paused?: Paused; hold?: HoldView; waits?: WaitsView; saving?: SavingView }[] {
  const open = openSessions(tree);
  const at = Date.now();
  let place: ((t: Task) => Placed) | undefined;
  const of = (s: Session | undefined, life?: Life) => {
    const task = s?.task ? tree.get<Task>(s.task) : undefined;
    // its own line, its task's — or the line its task helps and how, or its branch off the lines (core/offline.ts, as
    // the queue places it); a task about nobody: none
    const own = s ? sessionResearch(tree, s, all) : undefined;
    const p = s && !own && task ? (place ??= placer(tree, all))(task) : undefined;
    const research = own ?? p?.research;
    const hold = s ? holdView(s, life ?? lifeOf(tree, s, at)) : undefined;
    // the images its agent's browser saves now (feature working.saving): the agent's work, never waiting for the person
    const saving = s ? savingView(tree, s, task, undefined, at) : undefined;
    return {
      ...(s ? { session: s.id, ...(s.task ? { task: task ? taskTitle(tree, task) : s.task } : {}), ...worked(tree, sessionOps(root, s), task) } : {}),
      ...(research ? { research } : {}),
      ...(p?.helps ? { helps: p.helps } : {}),
      ...(p?.branch ? { branch: p.branch } : {}),
      ...(hold ? { hold } : {}),
      ...(saving ? { saving } : {}),
    };
  };
  const started = liveWorkers(root).map((w) => {
    const waits = waitsView(w.paused);
    // what it waits for as a word is the runs' (runs[].paused.reason), never said here
    const { kind: _kind, ...paused } = w.paused ?? { until: "" };
    return {
      who: whoAtWork(w.label, tree.lang),
      since: w.since,
      // the run whose work it is (spec 126): a conversation has none
      ...(w.id.startsWith("run-") ? { run: w.id } : {}),
      ...(w.paused ? { paused } : {}),
      ...of(open.find((x) => x.worker === w.id)),
      ...(waits ? { waits } : {}),
    };
  });
  const direct = directAtWork(tree, at).map(({ session: s, life }) => ({ who: whoDirect(s, tree.lang), since: life.hold?.since ?? s.started, ...of(s, life) }));
  return [...started, ...direct];
}

/** The person and the place (L…, core/workplace.ts) an agent works on, from what its session wrote and its task. */
function worked(tree: Tree, ops: Op[], task: Task | undefined): { person?: string; family?: string; place?: string } {
  const place = placeOfWork(tree, ops, task);
  return { ...workedOn(tree, ops, task), ...(place ? { place } : {}) };
}

/** The direction a session worked on: its own, else its task's. */
function sessionResearch(tree: Tree, s: Session, all: Scope[]): string | undefined {
  if (s.research) return s.research;
  const task = s.task ? tree.get<Task>(s.task) : undefined;
  return task ? effectiveDirection(tree, task, all) : undefined;
}

/** At most so many characters of a reason or a summary the app is sent. */
const SHORT = 140;
const short = (text: string) => (text.length > SHORT ? `${text.slice(0, SHORT - 1).trimEnd()}…` : text);

/** Generations the app is told of a direction of ancestors: parents first. */
const DIRECTION_GENERATIONS = 12;

/**
 * The directions of the research for the app: how each goes, its tasks (each task counted in the one
 * direction it belongs to), whether an agent is at work on it, why it was paused or ended and since when,
 * the ancestors known in each generation, and what its last session did.
 */
function directions(tree: Tree, all: Scope[], queued: Task[], workingOn: (string | undefined)[], found?: Map<string, Found>, runs?: RunsNow): Record<string, unknown>[] {
  const tasks = tree.list<Task>("task");
  // the images the agent's own browser saves while its session holds the task: nothing for the person (1124)
  let agentSaves: Set<string> | undefined;
  // census records off: their tasks wait for nobody (spec 106)
  const censusHide = censusHidden(new Settings(tree.env, {}).census(tree.config));
  // each task in the one direction it belongs to — or helps (core/offline.ts)
  const line = lineOf(tree, all);
  const of = new Map(tasks.map((t) => [t.id, line(t)]));
  const ended = tree
    .list<Session>("session")
    .filter((s) => s.state !== "open" && s.ended && s.summary)
    .sort((a, b) => b.ended!.localeCompare(a.ended!));
  // in the order of work (core/order.ts): active, paused and ended alike, each its place
  const places = orderNumbers(all.map((x) => x.research));
  return workOrder(all.map((x) => x.research)).map((r) => {
    // a paused or ended one: what would come back to the queue
    const inQueue = r.state === "active" ? queued.filter((t) => of.get(t.id) === r.id).length : tasks.filter((t) => ["open", "doing"].includes(t.state) && of.get(t.id) === r.id).length;
    const reason = r.state === "active" ? undefined : [...r.notes].reverse().find((n) => n.text.startsWith(`${r.state}: `))?.text.slice(r.state.length + 2).trim();
    const last = ended.find((s) => sessionResearch(tree, s, all) === r.id);
    let generations: number[] | undefined;
    if (r.direction === "ancestors" && tree.get(r.focus)) {
      const gens = ancestorGenerations(tree, r.focus, DIRECTION_GENERATIONS + 1);
      const deepest = Math.min(Math.max(2, ...gens.values()), DIRECTION_GENERATIONS + 1);
      generations = [];
      for (let g = 2; g <= deepest; g++) generations.push([...gens.values()].filter((n) => n === g).length);
    }
    return {
      id: r.id,
      name: r.name,
      state: r.state,
      direction: r.direction,
      focus: r.focus,
      tasks: inQueue,
      waiting: tasks.filter((t) => t.state === "waiting" && of.get(t.id) === r.id && !censusHide(t) && !(agentSaves ??= savedByAgentNow(tree, tasks)).has(t.id)).length,
      working: workingOn.includes(r.id),
      ...(reason ? { reason: short(reason) } : {}),
      since: r.stateSince ?? (r.state === "active" ? r.created : r.updated),
      ...(generations ? { generations } : {}),
      ...(last ? { last: { at: last.ended, text: short(last.summary!.replace(/\s+/g, " ").trim()) } } : {}),
      order: places.get(r.id)!,
      limits: { ...(r.limits?.generations ? { generations: r.limits.generations } : {}), ...(r.limits?.before ? { before: r.limits.before } : {}) },
      ...(r.question ? { question: r.question } : {}),
      ...(r.review ? { review: { scope: r.review.scope } } : {}),
      created: r.created,
      ...(r.parent ? { parent: r.parent } : {}),
      ...(found?.get(r.id) ? { found: found.get(r.id) } : {}),
      // its run, whether one can start now (and why not), the agent of its last run (spec 126, feature run.lines)
      ...(runs ? runs.line(r, queued) : {}),
    };
  });
}

/** Each line's finds of the last days, worked out again with a new commit (or after a minute: the days move on). */
const foundCache = new Map<string, { head: string; at: number; found: Map<string, Found> }>();
function foundNow(tree: Tree, all: Scope[], h: string): Map<string, Found> {
  const had = foundCache.get(tree.root);
  if (had && had.head === h && Date.now() - had.at < 60_000) return had.found;
  const found = foundByLine(tree, (s) => sessionResearch(tree, s, all));
  foundCache.set(tree.root, { head: h, at: Date.now(), found });
  return found;
}

/**
 * Who is in which line (GET /directions/people): the narrowest line first, only active and paused ones. A line of
 * descendants: the descendants of its person within its generations; a question: its person (core/frontier.ts linePeople).
 */
function directionPeople(tree: Tree, all: Scope[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const lines = all
    .filter((s) => s.research.state !== "done" && !s.research.retracted)
    .map((s) => ({ id: s.research.id, people: s.research.direction === "descendants" || s.research.direction === "question" ? linePeople(tree, s.research) : s.people }))
    .sort((a, b) => a.people.size - b.people.size || a.id.localeCompare(b.id));
  for (const s of lines) for (const p of s.people.keys()) (out[p] ??= []).push(s.id);
  return out;
}

/** The fingerprint of the lines, the branches and every person's places at a head of each research (core/tablemarks.ts). */
const directionsRevs = new Map<string, { head: string; rev: string }>();

/** The fingerprint of GET /directions/people `places` (/status directions.rev): worked out once a head. */
function directionsRevAt(tree: Tree, h: string): string {
  const had = directionsRevs.get(tree.root);
  if (had && h && had.head === h) return had.rev;
  const rev = directionsRev(directionsOf(tree));
  if (h) directionsRevs.set(tree.root, { head: h, rev });
  return rev;
}

/** What the app may do with the lines here (/status caps): nothing in an archive or a research waiting for its agent. */
function capsOf(tree: Tree, settings: Settings): Record<string, unknown> {
  return {
    directionsWrite: true,
    directionsOrder: true,
    orderMode: orderMode(settings.strategy(tree.config)),
    directionKinds: ["ancestors", "descendants", "question"],
    duplicateDirections: false,
    // the branches off the lines, the choices of the tree, a branch and a task, why a task stands where it does, a
    // branch that grows in What waits (spec 038 K7)
    offLineBranches: true,
  };
}

/** How long what the system says of the links is taken as true (asking it costs a program started). */
const LINKS_FRESH_MS = 60_000;
/** No links after links that worked: asked again so soon, and taken only when said again. */
const LINKS_AGAIN_MS = 5_000;

/**
 * What the bridge says of the links, asked of the system now and then: the first time at once, then in the background
 * (the bridge never waits for it) — until it answers, what it said last. The system that does not answer (a failed or
 * slow query: unknown) changes nothing. No links after links that worked are taken only when the system says so twice
 * in a row: an applet being made again, a moment of LaunchServices — and the Strom app forgot the links (found on Mac).
 */
export function linksWatch(
  read: { now: () => HandlerState; later: () => Promise<HandlerState> },
  opts: { freshMs?: number; againMs?: number; clock?: () => number } = {},
): () => string[] {
  const freshMs = opts.freshMs ?? LINKS_FRESH_MS;
  const againMs = opts.againMs ?? LINKS_AGAIN_MS;
  const clock = opts.clock ?? Date.now;
  let seen: { at: number; actions: string[] } | undefined;
  let asking = false;
  // none said once after links that worked: not taken yet
  let doubt = false;
  // asked again in a few seconds rather than in a minute
  const soon = () => clock() - freshMs + againMs;
  return () => {
    if (!seen) {
      const state = read.now();
      seen = { at: state === "unknown" ? soon() : clock(), actions: linkActions(state) };
    } else if (clock() - seen.at > freshMs && !asking) {
      asking = true;
      read.later().then(
        (state) => {
          asking = false;
          const was = seen?.actions ?? [];
          if (state === "unknown") {
            seen = { at: was.length ? clock() : soon(), actions: was };
            return;
          }
          const actions = linkActions(state);
          if (!actions.length && was.length && !doubt) {
            doubt = true;
            seen = { at: soon(), actions: was };
            return;
          }
          doubt = false;
          seen = { at: clock(), actions };
        },
        () => {
          asking = false;
          seen = { at: clock(), actions: seen?.actions ?? [] };
        },
      );
    }
    return seen.actions;
  };
}

let linksOf: (() => string[]) | undefined;

/** The strom-research:// links this computer takes: said to the app only while the scheme leads to this strom. */
function links(env: Env): string[] {
  linksOf ??= linksWatch({ now: () => linkHandlerState(env), later: () => linkHandlerStateLater(env) });
  return linksOf();
}

/**
 * A second installation's own scheme (strom-research-beta), for the app to build its links with — said whenever it is
 * not the person's strom-research (whether they lead here says `links`).
 */
function linkSchemeOf(env: Env): { linkScheme?: string } {
  const scheme = linkScheme(env);
  return scheme !== LINK_SCHEME ? { linkScheme: scheme } : {};
}

/** The beta channel this bridge's strom runs on, for the app to say so; the releases: nothing said. */
function channelOf(env: Env): { channel?: "beta" } {
  return updateChannel(env) === "beta" ? { channel: "beta" } : {};
}

/** At most so many tasks of the queue the app is told (the rest counted): what comes next, then what was put aside. */
const QUEUE_NEXT = 14;
const QUEUE_PARKED = 6;

/** A task of the queue as the app is told it (/status queue[], the answer to POST /queue/<T…>). */
interface QueueItem {
  id: string;
  text: string;
  state: "next" | "parked";
  /** Its place in the whole queue (1: the next one, the one at work first): none for a task put aside (feature queue.page). */
  pos?: number;
  person?: string;
  research?: string;
  offLine?: Exclude<OffLine, "normal">;
  helps?: string;
  /** Its branch off the lines (B-P…), also when the branch was added to a line. */
  branch?: string;
  /** The person's own turn for it (strom task order): next, once — or last. */
  own?: "next" | "last";
  /** Why it stands where it does (core/queue.ts Reason): none for a task about nobody. */
  why?: Ranked["reason"];
  /** A story to write, or a task of the history of the places: none for the research's work. */
  kind?: "story" | "history";
  /** The kind of the task as the person sees the work (core/taskkind.ts; GET /queue?kind= filters by it) — feature queue.kind. */
  taskKind: TaskKind;
  /** The house a task of a house is of (spec 030, taskKind house): its key as GET /houses gives it; none of a municipality. */
  house?: string;
  /** Its book (spec 105): the one it waits for, else the one its where names (core/books.ts bookOfTask). */
  book?: string;
  /** queue.sameBook: it stands before the rest as a task of the book the last session read (its ID). */
  sameBook?: string;
  /** The run of a line that takes it (spec 126, feature run.lines): none — the whole queue's (a general run). */
  run?: string;
  /** An open session holds it now (spec 127 K3.1, feature task.holds): which, who, since when, its last sign, free by when. */
  heldBy?: HeldByView;
  /** Its archive (a restricted site) another session uses now: it waits for it (spec 127 K3.1, feature archive.holds). */
  archiveHeld?: ArchiveHeldView;
}

/** The holds of the tasks and the archives held now, worked out once for the items of a queue. */
interface QueueHolds {
  tasks: Map<string, HeldByView>;
  sites: ReturnType<typeof heldArchives>;
  /** The run of a line that takes a task (spec 126): none — the whole queue's. */
  runs?: (t: Task) => string | undefined;
}

function queueHolds(tree: Tree, settings: Settings, runs?: (t: Task) => string | undefined): QueueHolds {
  return { tasks: heldTasks(tree), sites: heldArchives(tree, settings.shared()?.value), runs: runs ?? (actsAsArchive(tree) ? undefined : runTakers(tree)) };
}

/** The run of a line that takes it (run), and: held by a session (heldBy), else waiting for its archive another uses (archiveHeld). */
function holdPart(tree: Tree, t: Task, h: QueueHolds | undefined): { run?: string; heldBy?: HeldByView; archiveHeld?: ArchiveHeldView } {
  if (!h) return {};
  const by_ = h.runs?.(t);
  const run = by_ ? { run: by_ } : {};
  const by = h.tasks.get(t.id);
  if (by) return { ...run, heldBy: by };
  if (t.state !== "open" && t.state !== "doing") return run;
  const a = archiveHeldOf(tree, t, h.sites);
  return a ? { ...run, archiveHeld: a } : run;
}

/**
 * Where a task stands among the lines as the queue says it: ranked, as the queue placed it (core/queue.ts — the one
 * place, also what GET /queue filters by and /status queueCounts counts), else as it stands among the lines alone.
 */
function whereInQueue(place: (t: Task) => Placed, offLine: OffLine, file: OfflineFile, t: Task, r?: Ranked): ReturnType<typeof researchOf> {
  if (!r) return researchOf(place, offLine, file, t);
  return { ...(r.research ? { research: r.research } : {}), ...(r.offLine && r.offLine !== "normal" ? { offLine: r.offLine } : {}), ...(r.helps ? { helps: r.helps.by } : {}), ...(r.branch ? { branch: r.branch } : {}) };
}

/** One task as the queue has it: ranked (in the queue: its place, its why, its own turn), else as it stands among the lines alone. */
function queueItem(tree: Tree, place: (t: Task) => Placed, offLine: OffLine, file: OfflineFile, state: "next" | "parked", t: Task, r?: Ranked, pos?: number, holds?: QueueHolds): QueueItem {
  return { id: t.id, text: humanTask(tree, t.what, tree.lang), state, ...(pos ? { pos } : {}), ...personOf(t), ...whereInQueue(place, offLine, file, t, r), ...(r?.own ? { own: r.own } : {}), ...(r?.reason ? { why: r.reason } : {}), ...(forStory(t) ? { kind: "story" as const } : forHistory(t) ? { kind: "history" as const } : {}), taskKind: taskKind(t), ...housePart(tree, t), ...bookPart(tree, t), ...(r?.sameBook ? { sameBook: r.sameBook } : {}), ...holdPart(tree, t, holds) };
}

/** The houses of a tree's facts, read once for all the queue's tasks of houses (a tree's object is one state of it). */
const houseIndexes = new WeakMap<Tree, HouseIndex>();
function housePart(tree: Tree, t: Task): { house?: string } {
  if (!forHouse(t)) return {};
  const index = () => {
    let i = houseIndexes.get(tree);
    if (!i) houseIndexes.set(tree, (i = houseIndex(tree)));
    return i;
  };
  const house = houseKeyOfTask(tree, t, index);
  return house ? { house } : {};
}

function bookPart(tree: Tree, t: Task): { book?: string } {
  const book = bookOfTask(tree, t);
  return book ? { book } : {};
}

/** The tasks put aside (parked, not back by their date): after the queue, by their IDs — no place in it. */
function parkedTasks(tree: Tree): Task[] {
  const today = now().slice(0, 10);
  return tree.list<Task>("task").filter((t) => effectiveState(t, today) === "parked");
}

/**
 * The queue in its order, worked out once for a state of the research and shared by /status, GET /queue's pages and
 * filters, GET /offline/<B-…> and the answer to POST /queue/<T…> (a queue of thousands ranked once, not for every page):
 * worked out again with a new commit, a new day, a change of the tree's or this computer's settings or of the choices off
 * the lines — and after STROM_LIVE_QUEUE_MS (10 s) for what changes beside them (an archive left alone for a while).
 * rev: the fingerprint of the queue's order and of the research (the app keeps its pages while it stays).
 */
const rankedCache = new Map<string, { at: number; key: string; ranked: Ranked[]; parked: Task[]; rev: string }>();
function rankedNow(tree: Tree, settings: Settings, h: string): { ranked: Ranked[]; parked: Task[]; rev: string; key: string } {
  const mtime = (file: string) => {
    try {
      return String(fs.statSync(file).mtimeMs);
    } catch {
      return "-";
    }
  };
  const key = [h, now().slice(0, 10), settings.strategy(tree.config), settings.offLine(tree.config), String(settings.sameBook(tree.config)), mtime(path.join(tree.root, TREE_FILE)), mtime(configFile(tree.env)), mtime(path.join(tree.root, ...OFFLINE_FILE.split("/")))].join("|");
  const had = rankedCache.get(tree.root);
  if (had && had.key === key && Date.now() - had.at < Number(tree.env.STROM_LIVE_QUEUE_MS ?? 10_000)) return had;
  // the order strom run takes them (core/queue.ts runOrder): a story at its turn, the tasks of history by their pace
  const ranked = runOrder(tree, tree.list<Task>("task"), settings.strategy(tree.config));
  // what a page needs, kept with the order: a page asked again reads no task of the research (thousands of files)
  const parked = parkedTasks(tree);
  const rev = crypto.createHash("sha256").update([h, ranked.map((r) => r.task.id).join(","), parked.map((t) => t.id).join(",")].join("|")).digest("hex").slice(0, 16);
  const made = { at: Date.now(), key, ranked, parked, rev };
  rankedCache.set(tree.root, made);
  return made;
}

/** The agent's queue in its order, for the user (records by their names), and how many more there are. */
function queue(tree: Tree, ranked: Ranked[], parked: Task[], all: Scope[], offLine: OffLine, holds?: QueueHolds): { queue: QueueItem[]; queueMore: number } {
  const place = placer(tree, all);
  const file = readOffline(tree);
  const shown = [...ranked.slice(0, QUEUE_NEXT).map((r, i) => queueItem(tree, place, offLine, file, "next", r.task, r, i + 1, holds)), ...parked.slice(0, QUEUE_PARKED).map((t) => queueItem(tree, place, offLine, file, "parked", t, undefined, undefined, holds))];
  return { queue: shown, queueMore: ranked.length + parked.length - shown.length };
}

/**
 * How many tasks of the queue each line and each branch has, for the app's labels without the whole queue (/status
 * queueCounts, feature queue.page): the same field GET /queue?research= and ?branch= filter by, counted from the queue
 * already ranked — next: all in the queue, parked: those put aside.
 */
/**
 * /status census (spec 106): on — the setting as it holds for this research; held — its census tasks open or waiting
 * kept out of the queue and What waits while it is off (one at work not counted), 0 while on, in an archive and where
 * the research waits for its agent.
 */
export function censusStatus(tree: Tree, settings: Settings): { on: boolean; held: number } {
  const on = settings.census(tree.config);
  return { on, held: actsAsArchive(tree) ? 0 : censusHeldCount(tree.list<Task>("task"), on) };
}

function queueCounts(ranked: Ranked[], parked: number, rev?: string, runs?: (t: Task) => string | undefined): { research: Record<string, number>; branch: Record<string, number>; kind: Partial<Record<TaskKind, number>>; next: number; parked: number; general?: number; rev?: string } {
  const research: Record<string, number> = {};
  const branch: Record<string, number> = {};
  for (const r of ranked) {
    if (r.research) research[r.research] = (research[r.research] ?? 0) + 1;
    if (r.branch) branch[r.branch] = (branch[r.branch] ?? 0) + 1;
  }
  // by the kind of the work (feature queue.kind): only the kinds with a task, the same GET /queue?kind= filters by
  // how many the whole queue's run takes (spec 126): the tasks of the lines with a run of their own aside
  const general = runs ? ranked.filter((r) => !runs(r.task)).length : undefined;
  return { research, branch, kind: kindCounts(ranked.map((r) => r.task)), next: ranked.length, parked, ...(general !== undefined ? { general } : {}), ...(rev ? { rev } : {}) };
}

/** At most so many tasks in one page of GET /queue; so many when the app says none. */
export const QUEUE_PAGE_MAX = 100;
const QUEUE_PAGE = 50;

/** What GET /queue asks: where the page starts among the tasks the filter leaves, how many, which. */
export interface QueueAsk {
  from: number;
  count: number;
  branch?: string;
  research?: string;
  state?: "next" | "parked";
  /** Only the tasks of this kind (feature queue.kind, core/taskkind.ts). */
  kind?: TaskKind;
  /** With kind other: the kinds the app knows, kept out of other (feature census; else every kind past spec 065's is other). */
  known?: string[];
  /** What to find among them (feature queue.search): trimmed, 1…QUERY_MAX characters. */
  q?: string;
}

/** At most so many characters of what GET /queue?q= searches for. */
export const QUERY_MAX = 100;

/** The query of GET /queue read, or why it is none (400 queue.query). */
export function queueAsk(q: URLSearchParams): QueueAsk | { bad: string } {
  const shape = `?from=<0…>&count=<1…${QUEUE_PAGE_MAX}>&branch=B-P…&research=G…&state=next|parked&kind=${TASK_KINDS.join("|")}&known=<kind>[,<kind>…]&q=<1…${QUERY_MAX} characters> (each optional)`;
  const known = new Set(["from", "count", "branch", "research", "state", "kind", "known", "q", "app", "poll"]);
  for (const k of q.keys()) if (!known.has(k)) return { bad: `unknown ${k}: ${shape}` };
  const int = (k: string, dflt: number, min: number, max: number): number | undefined => {
    const v = q.get(k);
    if (v === null || v === "") return dflt;
    if (!/^\d{1,9}$/u.test(v)) return undefined;
    const n = Number(v);
    return n < min || n > max ? undefined : n;
  };
  const from = int("from", 0, 0, 999_999_999);
  const count = int("count", QUEUE_PAGE, 1, QUEUE_PAGE_MAX);
  if (from === undefined || count === undefined) return { bad: shape };
  const ask: QueueAsk = { from, count };
  const b = q.get("branch");
  if (b !== null) {
    const key = branchKey(b);
    if (!key) return { bad: `branch=B-P…: ${shape}` };
    ask.branch = key;
  }
  const g = q.get("research");
  if (g !== null) {
    const m = /^G(\d{1,9})$/iu.exec(g.trim());
    if (!m) return { bad: `research=G…: ${shape}` };
    ask.research = `G${m[1]!.padStart(4, "0")}`;
  }
  const st = q.get("state");
  if (st !== null) {
    if (st !== "next" && st !== "parked") return { bad: `state=next|parked: ${shape}` };
    ask.state = st;
  }
  const kd = q.get("kind");
  if (kd !== null) {
    const k = parseTaskKind(kd);
    if (!k) return { bad: `kind=${TASK_KINDS.join("|")}: ${shape}` };
    ask.kind = k;
  }
  // the kinds the app knows (feature census): out of other; its shape checked always, its words only with kind=other
  const kn = q.get("known");
  if (kn !== null) {
    const words = parseKnownKinds(kn);
    if (!words) return { bad: `known=<kind>[,<kind>…] (at most 20, each a-z or .): ${shape}` };
    if (ask.kind === "other") ask.known = words;
  }
  // what to find: never said back in a refusal (nor in the log — masked)
  const find = q.get("q");
  if (find !== null) {
    const text = find.trim();
    if (!text || [...text].length > QUERY_MAX) return { bad: `q=<1…${QUERY_MAX} characters, not only spaces>: ${shape}` };
    ask.q = text;
  }
  return ask;
}

/**
 * A page of the whole queue (GET /queue, feature queue.page): the tasks in the order of the queue — those put aside
 * after, without a place — as /status queue[] says each (pos: its place in the whole queue), only those of a branch,
 * a line (as /status queueCounts counts them) or a state when asked; total: how many the filter leaves. The same order
 * as /status (runOrder), nothing ranked again for the filter. An archive (and a research waiting for its agent): no
 * queue.
 */
export function queuePage(
  tree: Tree,
  settings: Settings,
  ask: QueueAsk,
  h: string,
): { items: QueueItem[]; total: number; from: number; next?: number; rev?: string; q?: string; match?: Record<string, "id" | "person">; elsewhere?: { id: string; state: Task["state"] } } {
  if (actsAsArchive(tree)) return { items: [], total: 0, from: ask.from, ...(ask.q !== undefined ? { q: ask.q } : {}) };
  const all = scopes(tree);
  const place = placer(tree, all);
  const offLine = settings.offLine(tree.config);
  const file = readOffline(tree);
  const order = rankedNow(tree, settings, h);
  const ranked = ask.state === "parked" ? [] : order.ranked;
  type Entry = { t: Task; r?: Ranked; pos?: number; where: ReturnType<typeof researchOf> };
  const entries: Entry[] = [];
  for (const [i, r] of ranked.entries()) entries.push({ t: r.task, r, pos: i + 1, where: whereInQueue(place, offLine, file, r.task, r) });
  if (ask.state !== "next") for (const t of order.parked) entries.push({ t, where: whereInQueue(place, offLine, file, t) });
  const left = entries.filter((e) => (!ask.branch || e.where.branch === ask.branch) && (!ask.research || e.where.research === ask.research) && (!ask.kind || kindMatches(taskKind(e.t), ask.kind, ask.known)));
  // what the person searches for: among what the filters leave, in the order of the queue, then paged
  const found = ask.q === undefined ? undefined : searchQueue(tree, order, left, ask.q);
  const rows = found ? found.rows : left;
  const page = rows.slice(ask.from, ask.from + ask.count);
  const holds = page.length ? queueHolds(tree, settings) : undefined;
  const items = page.map((e) => queueItem(tree, place, offLine, file, e.r ? "next" : "parked", e.t, e.r, e.pos, holds));
  const end = ask.from + page.length;
  const answer = { items, total: rows.length, from: ask.from, ...(end < rows.length ? { next: end } : {}), rev: order.rev };
  if (!found) return answer;
  const match = Object.fromEntries(page.flatMap((e) => (found.match.has(e.t.id) ? [[e.t.id, found.match.get(e.t.id)!]] : [])));
  return { ...answer, q: ask.q, ...(Object.keys(match).length ? { match } : {}), ...(found.elsewhere ? { elsewhere: found.elsewhere } : {}) };
}

/** A task number as the person types it (T0123, t123, 123): the whole query, nothing else. */
const TASK_NUMBER = /^[Tt]?0*(\d{1,9})$/u;
/** A person's number (P12, p0012): the whole query. */
const PERSON_NUMBER = /^[Pp]0*(\d{1,9})$/u;

/**
 * Text folded for searching the queue: foldText (case, the marks of any accent, ß, ł, đ, ø, æ, œ) — any mark left,
 * and the dotless ı, too.
 */
function searchFold(s: string): string {
  return foldText(s).replace(/\p{M}/gu, "").replace(/ı/gu, "i");
}

/**
 * What the queue's search reads of a task, folded (each field apart: a word is found within one): the task's text as the
 * app shows it and as written, every name of its people (birth and later surnames, the forms the tree knows; a
 * couple's two), its record sets (title, call number, the archive's name, their places) and what else it says where
 * to look — and apart, its ID and its people's IDs. Not its line or branch: the app's chips filter by those.
 */
interface TaskHay {
  text: string;
  ids: string;
}

function taskHay(tree: Tree, t: Task): TaskHay {
  const fields: string[] = [humanTask(tree, t.what, tree.lang), t.what];
  const ids: string[] = [t.id];
  const person = (p: Person) => {
    for (const n of p.names) fields.push(`${n.given} ${n.surname}`);
  };
  const place = (ref: string) => {
    const l = /^L\d+$/u.test(ref) ? tree.get<Place>(ref) : undefined;
    if (l?.type === "place") for (const n of l.names) fields.push(n.name);
    else fields.push(ref);
  };
  for (const id of t.subject) {
    const r = tree.get<Person | Family>(id);
    if (r?.type === "person") {
      ids.push(r.id);
      person(r);
    } else if (r?.type === "family")
      for (const x of r.partners) {
        const p = tree.get<Person>(x);
        if (p?.type === "person") person(p);
      }
  }
  for (const w of t.where) {
    const r = /^[BRL]\d+$/u.test(w) ? tree.get<RecordSet | Repository | Place>(w) : undefined;
    if (r?.type === "recordset") {
      fields.push(r.title, r.callNumber ?? "");
      const repo = r.repository ? tree.get<Repository>(r.repository) : undefined;
      if (repo?.type === "repository") fields.push(repo.name);
      for (const p of r.places) place(p);
    } else if (r?.type === "repository") fields.push(r.name);
    else if (r?.type === "place") place(r.id);
    else fields.push(w);
  }
  return { text: fields.filter(Boolean).map(searchFold).join("\u0001"), ids: ids.map(searchFold).join("\u0001") };
}

/**
 * What the queue's search read of each task, kept for a state of the research — the same key the queue's order is
 * kept by (rankedNow: a new commit, a new day, the settings): a search asked again, or the next page, reads no task.
 */
const hayCache = new Map<string, { key: string; hay: Map<string, TaskHay> }>();
function haysOf(tree: Tree, key: string): (t: Task) => TaskHay {
  let kept = hayCache.get(tree.root);
  if (!kept || kept.key !== key) hayCache.set(tree.root, (kept = { key, hay: new Map() }));
  const hay = kept.hay;
  return (t) => {
    let h = hay.get(t.id);
    if (!h) hay.set(t.id, (h = taskHay(tree, t)));
    return h;
  };
}

/**
 * GET /queue?q= (feature queue.search): the tasks the filters left that hold every word of q (each within one field:
 * the task's text, its people's names, its record sets, archives and places, its ID and its people's), in the order of
 * the queue — nothing ranked by the match. A task number (T0123, t123, 123): that task first (match "id"), then those
 * whose text holds the number; one out of the queue (done, dropped, waiting…) is said apart (elsewhere), one that is
 * not, nothing. A person's number (P12): the tasks about that person (match "person"), never by their text.
 */
function searchQueue<E extends { t: Task }>(tree: Tree, order: { ranked: Ranked[]; parked: Task[]; key: string }, left: E[], q: string): { rows: E[]; match: Map<string, "id" | "person">; elsewhere?: { id: string; state: Task["state"] } } {
  const match = new Map<string, "id" | "person">();
  const hay = haysOf(tree, order.key);
  const person = PERSON_NUMBER.exec(q);
  if (person) {
    const id = `P${String(Number(person[1])).padStart(4, "0")}`;
    const rows = left.filter((e) => e.t.subject.includes(id));
    for (const e of rows) match.set(e.t.id, "person");
    return { rows, match };
  }
  const words = searchFold(q).split(" ").filter(Boolean);
  const holds = (field: string) => words.length > 0 && words.every((w) => field.includes(w));
  const task = TASK_NUMBER.exec(q);
  if (!task) return { rows: left.filter((e) => holds(`${hay(e.t).text}\u0001${hay(e.t).ids}`)), match };
  const id = `T${String(Number(task[1])).padStart(4, "0")}`;
  const exact = left.find((e) => e.t.id === id);
  if (exact) match.set(id, "id");
  // the number in the text of others (an ID of one task is no text of another: T1234 is not found for 123)
  const rows = [...(exact ? [exact] : []), ...left.filter((e) => e.t.id !== id && holds(hay(e.t).text))];
  const inQueue = order.ranked.some((r) => r.task.id === id) || order.parked.some((t) => t.id === id);
  const t = inQueue ? undefined : tree.get<Task>(id);
  const elsewhere = t?.type === "task" && !t.retracted ? { id, state: effectiveState(t, now().slice(0, 10)) } : undefined;
  return { rows, match, ...(elsewhere ? { elsewhere } : {}) };
}

/**
 * The work off the lines for /status (only a research of several lines, never an archive): the tree's choice, the
 * branches — each with a few of its tasks in the order of the queue — and which grow (core/offline.ts).
 */
function offLineOf(tree: Tree, settings: Settings, all: Scope[], ranked: Ranked[]): { offLine?: Record<string, unknown> } {
  const v = offLineView(tree, settings, all);
  return v ? { offLine: offLineJson(inQueueOrder(v, ranked), (t) => humanTask(tree, t.what, tree.lang)) } : {};
}

/** The tasks of each branch in the order of the queue (those not in it after, by their IDs). */
function inQueueOrder(v: OffLineView, ranked: Ranked[]): OffLineView {
  return { ...v, branches: v.branches.map((b) => branchInQueueOrder(b, ranked)) };
}

/** A branch's tasks in the order of the queue (those not in it — a branch not researched — after, by their IDs). */
function branchInQueueOrder(b: BranchView, ranked: Ranked[]): BranchView {
  const at = new Map(ranked.map((r, i) => [r.task.id, i]));
  const rank = (t: Task) => at.get(t.id) ?? ranked.length;
  return { ...b, tasks: [...b.tasks].sort((x, y) => rank(x) - rank(y) || x.id.localeCompare(y.id, "en", { numeric: true })) };
}

/**
 * One branch off the lines as the app reads it (/status offLine.branches[], GET /offline/<B-…>, the answers to the
 * writes): its tasks in the order of the queue; undefined when it is no branch now.
 */
function branchNow(tree: Tree, settings: Settings, key: string): { view: BranchView; json: Record<string, unknown>; pos: Map<string, number> } | undefined {
  const b = branchOf(tree, settings, key);
  if (!b) return undefined;
  const { ranked } = rankedNow(tree, settings, head(tree.root));
  const view = branchInQueueOrder(b, ranked);
  return { view, json: branchJson(view, (t) => humanTask(tree, t.what, tree.lang)), pos: new Map(ranked.map((r, i) => [r.task.id, i + 1])) };
}

/** A task as the queue has it now (the answer to POST /queue/<T…>): ranked, else as it stands among the lines. */
function queueTask(tree: Tree, settings: Settings, id: string): QueueItem | undefined {
  const t = tree.get<Task>(id);
  if (!t) return undefined;
  const all = scopes(tree);
  const { ranked } = rankedNow(tree, settings, head(tree.root));
  const at = ranked.findIndex((x) => x.task.id === id);
  return queueItem(tree, placer(tree, all), settings.offLine(tree.config), readOffline(tree), t.state === "parked" ? "parked" : "next", t, ranked[at], at < 0 ? undefined : at + 1, queueHolds(tree, settings));
}

/** At most this many books in /status books (the rest counted in `more`). */
const BOOKS_LIST_MAX = 100;

/**
 * The tree's settings of the books (spec 105): books.minTasks and queue.sameBook as they hold, whether set for the tree
 * (…Own; false: the default), and the defaults — what the app shows and POST /books changes.
 */
function booksSettings(tree: Tree, settings: Settings): { minTasks: number; minTasksOwn: boolean; minTasksDefault: number; sameBook: "yes" | "no"; sameBookOwn: boolean; sameBookDefault: "no" } {
  return {
    minTasks: settings.booksMinTasks(tree.config),
    minTasksOwn: readStored(tree.config, "books.minTasks", "") !== undefined,
    minTasksDefault: BOOKS_MIN_TASKS,
    sameBook: settings.sameBook(tree.config) ? "yes" : "no",
    sameBookOwn: readStored(tree.config, "queue.sameBook", "") !== undefined,
    sameBookDefault: "no",
  };
}

/**
 * /status books (spec 105, feature books): the settings, and the books — each one something waits on (the app's groups
 * by book), and those offered to download (offer) — the most tasks first, at most BOOKS_LIST_MAX (more: the rest). Each
 * as strom task books --json says it, without the task IDs and the folder's path; pending: the files lying in its folder
 * not taken yet (only when any). aside (feature inbox.aside, only when any): the files of the books' folders set aside,
 * not taken — a question each for the person (asideJson, POST /books/aside).
 */
function booksStatus(tree: Tree, settings: Settings): Record<string, unknown> {
  const shared = settings.shared()?.value;
  const rows = bookRows(tree, settings.booksMinTasks(tree.config)).filter((r) => r.waiting > 0 || r.offer);
  const shown = rows.slice(0, BOOKS_LIST_MAX).map((r: BookRow) => {
    const { ids: _ids, ...row } = r;
    const pending = shared ? folderFiles(path.join(shared, "inbox", r.folder)).length : 0;
    return { ...row, ...(pending ? { pending } : {}) };
  });
  const aside = asideJson(tree, settings);
  return { settings: booksSettings(tree, settings), list: shown, more: rows.length - shown.length, ...(aside.length ? { aside } : {}) };
}

/**
 * The files of the books' folders of the inbox set aside, not taken (B0408, B0374; feature inbox.aside), newest first:
 * {file (as it lies in the book's folder, the key of the answer), name (the file's own name, as saved: what a person
 * reads), recordset, image?, kind: "same" (the same file as image `media`, registered under another number) | "other"
 * (another scan than `media`, the image of its number), media, at} — each a question for the person (POST /books/aside).
 */
function asideJson(tree: Tree, settings: Settings): Record<string, unknown>[] {
  return asideFiles(tree, settings.shared()?.value).map((a) => ({ file: a.file, name: a.name, recordset: a.recordset, ...(a.image !== undefined ? { image: a.image } : {}), kind: a.kind, media: a.media, at: a.at }));
}

/** The work off the lines without its branches (the answer to POST /offline): also for a research of one line, where nothing is off them. */
function offLineSummary(tree: Tree, settings: Settings): Record<string, unknown> {
  const v = offLineView(tree, settings);
  if (v) return offLineJson(v, (t) => t.what, false);
  return { mode: settings.offLine(tree.config), own: settings.resolve("queue.offLine", tree.config) !== undefined, share: settings.offLineShare(tree.config), suggest: settings.suggestLines(tree.config).on, tasks: 0, queued: 0, ownTasks: tree.list<Task>("task").filter((t) => (t.state === "open" || t.state === "doing") && t.queueAt).length };
}

/** The last tree the Strom app sent (through the bridge) that the research took and has not taken back — and which send it was. */
function lastIntake(root: string, tree: Tree): { id: string; at: string; state: "written"; received?: string } | undefined {
  const last = tree
    .list<SyncInput>("input")
    .filter((i) => i.sync && !i.sync.undone && i.sync.applied.length && i.name.startsWith("strom-app-"))
    .sort((a, b) => a.created.localeCompare(b.created))
    .pop();
  if (!last) return undefined;
  const sent = receivedAll(root).find((r) => r.input === last.id);
  return { id: last.id, at: last.created, state: "written", ...(sent ? { received: sent.intake } : {}) };
}

/**
 * What the research takes from the app (a gate the other way: the app shows what it can do by it). mode: an archive
 * (no agent; the app's data written as they come) or a research. sync.auto: what becomes of a send — "write" (at once:
 * additions, leads corrected, a record's fact changed a conflict for the user), "mirror" (an archive: the user's word
 * wins, what the app no longer has withdrawn), "off" (it waits for the user's word: sync.review on); sources: the app's
 * sources and citations are taken; verified: its transcripts weigh as the app says (_STROM_TRANSCRIPTS,
 * _STROM_VERIFIED); media: originals through PUT /media/<sha256> — how large one may be, what room is left, which kinds.
 */
/**
 * /status live (feature live.idle): how long the bridge runs on with nobody asking — whole minutes, 0: until it is
 * stopped or the computer goes off (the default) — and the choices the app offers (POST <token>/live writes one).
 */
export function liveState(env: Env): { idleMinutes: number; idleChoices: number[] } {
  return { idleMinutes: new Settings(env, {}).liveIdleMinutes(), idleChoices: [...LIVE_IDLE_CHOICES] };
}

function accepts(tree: Tree, settings: Settings, env: Env, seen?: ReadingsSeen): Record<string, unknown> {
  const mode = modeOf(tree);
  // a document read at once (live-read.ts): none in an archive, nor where the research waits for its agent, nor in the
  // sample research (strom demo: its readers are an agent's, which nothing there offers)
  const read = isDemo(tree.config) ? undefined : readAccepts(tree, settings, env, seen);
  const state = stateOf(tree);
  const shared = settings.shared()?.value;
  const free = shared ? freeBytes(shared) : undefined;
  return {
    mode,
    // a research whose agent is not on this computer waits for it, kept as an archive meanwhile (its mode stays)
    ...(state === "waiting" ? { agentHere: false } : {}),
    sync: { auto: state !== "research" ? "mirror" : settings.syncReview(tree.config) ? "off" : "write" },
    sources: true,
    verified: true,
    media: shared
      ? {
          max: originalMax(env),
          ...(free !== undefined ? { free: Math.max(0, free - ORIGINAL_RESERVE) } : {}),
          types: ORIGINAL_TYPES.map((t) => ({ mime: t.mime, ext: t.ext })),
          region: true,
          // put aside where nobody researches: an archive, and a research waiting for its agent (back when it is here)
          tasks: state !== "research" ? "parked" : "open",
          // a file to a task that waits for one (X-Strom-Task): an archive has none
          task: mode !== "archive",
          // images a task waits for (X-Strom-Task with X-Strom-Image, -Replace): into its folder of the inbox, registered
          taskImages: mode !== "archive",
          batch: { ...batchLimits(env), zip: true },
          estimate: batchEstimate(tree),
          // a couple's original (X-Strom-Family, spec 108 V9): material of both partners
          family: true,
        }
      : null,
    ...(read ? { read } : {}),
  };
}

/**
 * The version of the Strom app that asks (the app's spec docs/ZADANI_VYZKUM_app-vstup-dat.md, "Verze aplikace pro
 * most"): its header X-Strom-App-Version, else ?app=<version> (an EventSource sends no header of its own) — so what the
 * bridge writes goes by the app that reads it, two windows of two versions each their own. None: the app's version
 * strom was given (STROM_APP_VERSION, strom.version), else unknown.
 */
export function appVersionOf(req: { url?: string | undefined; headers: http.IncomingHttpHeaders }, settings: Settings): string | undefined {
  return saidAppVersion(req) ?? settings.stromVersion();
}

/** The version the request itself says the app is (X-Strom-App-Version, else ?app=), only a version of the app; else none. */
export function saidAppVersion(req: { url?: string | undefined; headers: http.IncomingHttpHeaders }): string | undefined {
  const header = req.headers["x-strom-app-version"];
  const query = new URLSearchParams((req.url ?? "").split("?")[1] ?? "").get("app");
  const said = (Array.isArray(header) ? header[0] : header)?.trim() || query?.trim();
  return said && isAppVersion(said) ? said : undefined;
}

/**
 * The folder a new research of this computer is made in (strom.trees, else the home: `strom init`'s), for the app to show
 * where a research of a copy of its tree would go (spec 139 K5.4) — only a text to show; none where nothing is set up.
 */
function treesRootOf(env: Env, settings: Settings = new Settings(env, {})): { treesRoot?: string } {
  const at = settings.trees()?.value;
  return at ? { treesRoot: at } : {};
}

/** What the app shows beside the tree. */
/**
 * /status worked out (on the bridge's thread of /status, core/livestatus.ts: it reads the whole research — never on the
 * bridge's own thread, which answers everything else meanwhile).
 */
export function status(root: string, env: Env, version?: string, seen?: ReadingsSeen): Record<string, unknown> {
  // a research a newer strom wrote (a beta's, this strom back on the releases): said, never opened
  const refused = newerTree(root, env);
  if (refused) {
    const config = readJsonIfExists<TreeConfig>(path.join(root, TREE_FILE));
    return {
      strom: VERSION,
      features: withDevices(withoutAgent(bridgeFeatures(new Settings(env, {}), version)), env, false),
      ...channelOf(env),
      tree: { id: config?.id, name: config?.name, lang: config?.lang },
      path: root,
      ...treesRootOf(env),
      locked: { code: refused.code, reason: refused.message, way: refused.hint, ...(refused.params ?? {}) },
      live: liveState(env),
      links: links(env),
      ...linkSchemeOf(env),
      phone: phoneSummaryNow(env),
    };
  }
  const tree = Tree.open(root, env);
  const settings = new Settings(env, {});
  const newer = knownNewerVersion(settings, env);
  const intake = lastIntake(root, tree);
  const last = tip(root);
  const all = scopes(tree);
  // an archive, or a research waiting for its agent (none on this computer): nobody works on it — no agent, no
  // directions, nobody at work, nothing waiting for the person, no queue, nothing spent (Milan's decisions,
  // 2026-10-03 and 2026-10-15); what waits for the agent says so (accepts.agentHere)
  // the sample research (strom demo): shown as a research, whether an agent is here or not — looked through without
  // one (spec 143 K2.2), nothing of an agent offered: none named, no runs, no way to start one
  const demo = isDemo(tree.config);
  const archive = !demo && actsAsArchive(tree);
  const order = archive ? undefined : rankedNow(tree, settings, last.head);
  const ranked = order?.ranked ?? [];
  const next = ranked.map((r) => r.task);
  const atWork = archive ? [] : working(root, tree, all);
  // where the research is on this computer, and the agent that works on it (an archive: none)
  const agent = archive || demo ? undefined : settings.agent(tree.config).value;
  const where = settings.agentWhere();
  // the runs (spec 126, feature run.lines): their limit, the agents here, the lines' runs and which run takes each task —
  // none in an archive or a research waiting for its agent (runs[] and runsEnded[] are read at each ask: withHandoffs)
  const runs = archive || demo ? undefined : runsNow(tree, settings, env);
  const takers = runs?.taker;
  // a newer strom on disk than this bridge runs (it starts again with it in a moment): for the app to say so
  const disk = diskVersion(env);
  return {
    strom: VERSION,
    // what this bridge does, for an app to go by rather than the version (a bridge run from the sources says the
    // candidate it is, found on Mac: an app took 1.11.0 for an old research)
    features: demo ? withDevices(forDemo(bridgeFeatures(settings, version)), env, false) : withDevices(archive ? withoutAgent(bridgeFeatures(settings, version)) : bridgeFeatures(settings, version), env, !archive),
    ...channelOf(env),
    ...(disk && disk.version !== (env.STROM_LIVE_RENEWED ?? VERSION) ? { installed: disk.version } : {}),
    // what the research is (an archive, a research, one waiting for its agent) — the app says it beside the tree
    // demo: the sample research (strom demo) — for the app to mark it so (an app that does not know it loses nothing:
    // the agent's features are not said for it)
    tree: { id: tree.config.id, name: tree.config.name, lang: tree.lang, state: demo ? "research" : stateOf(tree), kind: kindOf(tree), ...(demo ? { demo: true } : {}) },
    path: root,
    ...treesRootOf(env, settings),
    // sealed on this computer (writing works), or on another (its folder brought here, strom's settings gone): the
    // app's writes are refused with seal.foreign until the person takes it over (strom seal adopt, the menu, the link seal)
    seal: tree.key ? "here" : "elsewhere",
    // files of the research only in iCloud (placeholders `.X.json.icloud`): the app's writes are refused with
    // tree.not-downloaded until they are downloaded; the tree is still served as it reads
    notDownloaded: notDownloaded(root).length,
    ...(agent && PROFILES[agent] ? { agent: { id: agent, name: PROFILES[agent]!.name, ...(where === "app" || where === "terminal" ? { where } : {}) } } : {}),
    head: last.head,
    ...(last.at ? { headAt: last.at } : {}),
    // what the last 24 hours added (the app's "last 24 h"; /log gives only the last 500 commits): worked out in the
    // background, its own head said — none until it is ready
    ...recentOf(root, env, last.head),
    persons: tree.countLive("person"),
    families: tree.count("family"),
    researches: archive ? [] : directions(tree, all, next, atWork.filter((w) => !w.paused).map((w) => w.research), foundNow(tree, all, last.head), runs),
    ...(runs ? { limits: runs.limits, agents: runs.agents } : {}),
    // what the app may do with the lines (directions.*): none in an archive or a research waiting for its agent
    ...(archive ? {} : { caps: capsOf(tree, settings) }),
    working: atWork,
    open: archive ? [] : openSessions(tree).map((s) => ({ id: s.id, task: s.task, started: s.started })),
    // what works now, for the app to say a new version waits for it (spec 037 K2.2): the sessions open with their agent
    // still at work, the runs — an update goes on without stopping them, what starts after them runs the new version
    ...(archive ? {} : { busy: busyOf(tree) }),
    // before the agent works on the queue alone (the link work): the person's gate (run.gate, as the settings name it;
    // none: the loop is not started, n tasks are) and a session's time — none in an archive or a research waiting for its agent
    ...(archive || demo ? {} : { work: workOf(tree, settings) }),
    // what waits for the person, ordered and grouped by the place where it is dealt with (core/waiting.ts): the tasks,
    // a new version of an approved story (for an app that shows it: the _DRAFT gate), an archive's images that wait for
    // the person's decision and the connectors taken over (none in an archive) — the person decides in the terminal a
    // link opens (archive&host=, task&do=)
    // (an archive: only a send asked about — the person's data, nothing of an agent)
    waiting: archive ? archiveWaiting(tree).map((w) => w.item) : waitingFor(tree, {
      shared: settings.shared()?.value,
      claude: () => settings.agent(tree.config).value === "claude" && agentsHere(env).some((a) => a.id === "claude" && a.cli),
      stories: appShowsStoryDrafts(settings, version),
      // a house's story among them only for an app that shows one (spec 145 T4: an older one takes it for a person's)
      houseStories: appShowsHouseStory(settings, version),
      // the hypotheses, for an app that decides one by a pick (spec 074 V13): as the menu's What waits has them
      ...(appDecidesHypotheses(settings, version) ? { hypothesesApp: { open: settings.hypothesesDecide(tree.config) === "person" } } : {}),
      scopes: all,
      // how each wait is written, checked (feature tasks.audit, spec 109 U2): `audit` on an item whose wait is not as
      // strom needs it — part of the item, so of the part's rev too
      audit: true,
      // what helps most (feature waiting.gain, spec 105 K4.1): `gain` on an item whose dealing with grows the tree
      gain: true,
    }).map((w) => w.item),
    live: liveState(env),
    links: links(env),
    ...linkSchemeOf(env),
    // the experiments searched for this tree, and the fingerprint of what GET /history answers (only for a tree that has
    // anything of it, or with the experiment on: an older app reads nothing new)
    // (how often it takes a session: read only — a pace is the person's, chosen in the terminal)
    experiments: { history: historyOn(tree, settings), regions: regionsOn(tree, settings), places: placesOn(tree, settings), historyPace: settings.historyPace(tree.config), ...kindsStatus(tree, settings) },
    // the history of the places in the stories (stories.history): on while the history is on, unless turned off
    stories: { history: settings.storyHistory(tree.config) },
    // census records as a source (spec 106, feature census): always there — held 0 while on, in an archive and where
    // the research waits for its agent
    census: censusStatus(tree, settings),
    // the research of houses (spec 030, features house, house.auto): always there — on the setting as it holds here, the
    // houses counted by state (held: the tasks the setting off keeps aside), rev the fingerprint of the houses, their
    // tasks, their material and their municipalities' skeletons; auto and estimate once the tree's facts give a house,
    // layers where a map layer covers a municipality of one — an archive: on false, zeros, nothing more
    houses: housesBridgeStatus(tree, settings, archive),
    // what the app sends gone through by the agent by itself (spec 130, feature intake.auto): off unless the person
    // turned it on — none in an archive or a research waiting for its agent (nothing is sorted there)
    ...(archive ? {} : { intake: { auto: settings.intakeAuto(tree.config) } }),
    // the question before a sort of the material (spec 102 U8, feature sort.confirm): ask unless the person set no —
    // none in an archive or a research waiting for its agent (nothing is sorted there)
    ...(archive ? {} : { sort: { confirm: settings.sortConfirm(tree.config) } }),
    // who decides the hypotheses (hypotheses.decide, feature hypotheses.decide): nobody in an archive or a research
    // waiting for its agent — no key there
    ...(archive ? {} : { hypotheses: { decide: settings.hypothesesDecide(tree.config) } }),
    // the facts against their originals (spec 065, feature verify): what waits, what was verified or confirmed — none in
    // an archive or a research waiting for its agent (nobody verifies there)
    ...(archive ? {} : { verify: verifyCounts(tree) }),
    // what became of each source's newest reading again that differs from its transcript (the app's source viewer,
    // core/sourceread.ts readAgainOf): none in an archive or a research waiting for its agent
    ...(archive ? {} : { readAgain: readAgainAll(tree) }),
    ...historyOfStatus(tree, settings, last.head, archive),
    // the fingerprint of what GET /quality answers (the person's "not an error")
    quality: { rev: qualityRev(tree, last.head) },
    // the tree check (spec 091 V4, feature health): its reports' fingerprint, the newest, a run's place in the queue
    health: healthStatus(tree, settings, last.head, ranked, archive),
    // the fingerprint of every person's places among the lines (GET /directions/people places): none in an archive
    ...(archive ? {} : { directions: { rev: directionsRevAt(tree, last.head) } }),
    // an archive: nobody works on it — its tasks put aside are no queue, nothing spent (Milan's decision, 2026-10-03)
    ...(archive ? { queue: [], queueMore: 0 } : queue(tree, ranked, order?.parked ?? [], all, settings.offLine(tree.config), queueHolds(tree, settings, takers ?? (() => undefined)))),
    // how many tasks of the queue each line and branch has (the labels; the tasks themselves: GET /queue)
    queueCounts: queueCounts(ranked, order?.parked.length ?? 0, order?.rev, takers),
    // the work off the lines of a research of several (spec 038 K7): the tree's choice, the branches, which grow
    ...(archive ? {} : offLineOf(tree, settings, all, ranked)),
    // the books the tasks need (spec 105, feature books): those waited on, those offered to download — none in an
    // archive or a research waiting for its agent
    ...(archive ? {} : { books: booksStatus(tree, settings) }),
    ...(newer ? { update: { version: newer } } : {}),
    ...(archive ? {} : { spend: spendOf(root, tree) }),
    ...(intake ? { lastIntake: intake } : {}),
    accepts: accepts(tree, settings, env, seen),
    // the documents the app asked to be read and the research's own readings: at work, and ended in the last week
    ...(archive || !seen ? {} : { reads: statusReads(seen, settings.agent(tree.config).value) }),
    // the app's sorts of its material queued or at work (live-sort.ts; what one proposed: GET /material/sort/<id>)
    ...(archive ? {} : { sorts: statusSorts(root, tree.key) }),
    // the agent's browser for archives only a person's browser goes to (spec 048 K5.3): ready (Claude Code with Claude
    // in Chrome), no extension (its address), or an agent whose browser strom does not keep — and the tree's archives
    // where it would help, with the person's permission "through the browser" or not (none in an archive)
    ...(archive ? {} : { browser: browserStatus(tree, env, agent, settings.shared()?.value) }),
    inbox: { trees: inboxTrees(root, env), material: materialWaiting(tree) },
    sends: recentSends(root, tree),
    batches: batchStatus(tree),
    // the phone connection, this computer's (an archive's too: the person sends photos into it)
    phone: phoneSummaryNow(env),
  };
}

/**
 * The fingerprint of what GET /history answers (core/pastevents.ts historyRev), worked out again with a new commit or
 * after STROM_LIVE_HISTORY_MS (a minute): a catalog of the shared folder changes without the tree's commits.
 */
const historyRevs = new Map<string, { at: number; head: string; rev: string }>();
function historyRevNow(tree: Tree, settings: Settings, h: string, fresh?: string): string {
  const had = historyRevs.get(tree.root);
  if (fresh === undefined && had && had.head === h && Date.now() - had.at < Number(tree.env.STROM_LIVE_HISTORY_MS ?? 60_000)) return had.rev;
  const rev = fresh ?? historyRev(tree, settings.shared()?.value, settings);
  historyRevs.set(tree.root, { at: Date.now(), head: h, rev });
  return rev;
}

/** What this thread knows of the history's rev (the bridge's tick, GET /history): told to the thread of /status. */
export function historyRevKnown(root: string): { at: number; head: string; rev: string } | undefined {
  return historyRevs.get(root);
}

/** The history's rev the bridge's thread found, taken by the thread of /status when newer than its own. */
export function historyRevLearn(root: string, known: { at: number; head: string; rev: string } | undefined): void {
  const had = historyRevs.get(root);
  if (known && (!had || had.at < known.at)) historyRevs.set(root, known);
}

/** A tree the app is told the history of: with the experiment on, or one that has anything of it (its history/ folder). */
function historyShown(tree: Tree, settings: Settings): boolean {
  return historyOn(tree, settings) || fs.existsSync(path.join(tree.root, "history"));
}

/**
 * /status history {rev}: only for a tree whose history is shown (an older app reads nothing new). Where it is looked
 * for (no archive, the history on): how long a session on a place's history takes, what such sessions cost here (three
 * measured), and whether each place with coordinates is looked for by itself (read only: the person's, in the terminal).
 */
function historyOfStatus(tree: Tree, settings: Settings, h: string, archive: boolean): { history?: { rev: string; placeEstimate?: ReturnType<typeof placeEstimate>; placesAuto?: boolean } } {
  if (!historyShown(tree, settings)) return {};
  const searched = !archive && historyOn(tree, settings);
  return { history: { rev: historyRevNow(tree, settings, h), ...(searched ? { placeEstimate: placeEstimate(tree), placesAuto: settings.historyPlacesAuto(tree.config) } : {}) } };
}

/** The limits of GET /history (a test lowers them: STROM_LIVE_HISTORY_EVENTS, STROM_LIVE_HISTORY_PLACES). */
function historyLimits(env: Env): { events: number; places: number } {
  const n = (v: string | undefined, d: number) => (v && /^\d{1,6}$/.test(v) && Number(v) > 0 ? Math.min(Number(v), d) : d);
  return { events: n(env.STROM_LIVE_HISTORY_EVENTS, MAX_EVENTS), places: n(env.STROM_LIVE_HISTORY_PLACES, MAX_PLACES) };
}

/** What the month cost: the agent's sessions with their readers, and the readings the app asked (in no session). */
function spendOf(root: string, tree: Tree): Record<string, unknown> {
  const month = new Date().toISOString().slice(0, 7);
  const spent = monthSpend(tree, month);
  const reads = appReadSpend(root, month);
  // the app's sorts of its material (live-sort.ts): their readers too
  const sorts = appSortSpend(root, month, tree.key);
  if (!reads.count && !sorts.count) return { ...spent, currency: "USD" };
  const cents = (n: number) => Math.round(n * 100) / 100;
  const more = reads.amount + sorts.amount;
  return { ...spent, amount: cents(spent.amount + more), readers: cents((spent.readers ?? 0) + more), ...(reads.count ? { reads } : {}), ...(sorts.count ? { sorts } : {}), currency: "USD" };
}

/** The phone connection for /status, looked at again at most every ten seconds (the app asks every minute, each bridge). */
let phoneSummarySeen: { at: number; value: ReturnType<typeof phoneSummary> } | undefined;
function phoneSummaryNow(env: Env): ReturnType<typeof phoneSummary> {
  if (!phoneSummarySeen || Date.now() - phoneSummarySeen.at > 10_000) phoneSummarySeen = { at: Date.now(), value: phoneSummary(env) };
  return phoneSummarySeen.value;
}

/** Run the bridge of the tree here, until idle or stopped. */
export function serveLive(root: string, env: Env): Promise<number | undefined> {
  noteTestProcess(root, env, "live");
  // the tree's bridge runs already, or another one claimed the tree a moment before (a newer strom's bridge taking over
  // while a strom starts one): this one is not needed — it ends before it writes or takes anything, and so does the
  // bridge that started it to take over (none of the tree's either). What it ended for: the bridge that holds the tree
  // (strom live serve: exit EXIT.locked, so the bridge that started it knows it ended for another bridge, not that it
  // could not start).
  const before = claimTree(root, env);
  if (before) {
    noteLive(root, `another bridge of this tree runs already (${before}): this one (${process.pid}) ends`);
    endStarter(root, env, before);
    return Promise.resolve(before);
  }
  // the stroms it started that write (a send, an adoption, an original, a batch): never started again under them
  const kids = new Set<ChildProcess>();
  const track = (child: ChildProcess) => {
    kids.add(child);
    child.once("exit", () => kids.delete(child));
  };
  // the notes of the material a send of the app took off with no reason (1.35.0): given back and what waited with them
  // committed, before anything else is written unasked — the research writable again before anybody writes
  try {
    const back = settleNotesBack(Tree.open(root, env), quiet);
    if (back) noteLive(root, `notes of the material given back: ${counted(back, "file")} a send of the Strom app had taken them off`);
  } catch (e) {
    noteLive(root, `the notes of the material not given back now: ${errorText(e)}`);
  }
  // an archive switched by an older strom: its tasks that wait put aside before the app asks (logged, with the reason)
  try {
    const held = settleArchive(Tree.open(root, env));
    if (held.length) noteLive(root, `an archive: ${counted(held.length, "task")} put aside (${held.join(", ")})`);
  } catch (e) {
    noteLive(root, `an archive's tasks not put aside now: ${errorText(e)}`);
  }
  // a research whose agent came back (installed since): what was put aside while it waited back in the queue
  try {
    const back = settleWaiting(Tree.open(root, env));
    if (back.length) noteLive(root, `the research's agent is here: ${counted(back.length, "task")} back in the queue (${back.join(", ")})`);
  } catch (e) {
    noteLive(root, `the tasks put aside while the research waited not back now: ${errorText(e)}`);
  }
  // the tasks an older strom made to say those links: first in the queue (once)
  try {
    const raised = raiseHypothesisLinkTasks(Tree.open(root, env));
    if (raised) noteLive(root, `hypotheses: ${counted(raised.length, "task")} to say their variants' links first in the queue (${raised.join(", ")})`);
  } catch (e) {
    noteLive(root, `the tasks to say the hypotheses' links not raised now: ${errorText(e)}`);
  }
  // older hypotheses: the links of their variants their claims say beyond doubt, the rest a task for the agent (once)
  try {
    const done = settleHypothesisLinks(Tree.open(root, env));
    if (done) noteLive(root, `hypotheses: ${counted(done.linked.length, "variant link")} filled in from their claims, ${counted(done.tasks.length, "task")} for the rest`);
  } catch (e) {
    noteLive(root, `the links of the hypotheses' variants not filled in now: ${errorText(e)}`);
  }
  // a write of the user alone is no reading of a source, proven needs the original record: what an older strom counted
  // otherwise set right (once; strom fixes undo puts it back)
  try {
    const done = settleReaders(Tree.open(root, env));
    if (done) noteLive(root, `readers of the sources: ${counted(done.changed, "source")} no more read by the user, ${counted(done.kept, "source")} kept as the user's own`);
  } catch (e) {
    noteLive(root, `the readers of the sources not set right now: ${errorText(e)}`);
  }
  try {
    const done = settleProven(Tree.open(root, env));
    if (done) noteLive(root, `facts proven without the original record: ${counted(done.changed, "fact")} made probable, ${counted(done.left, "fact")} a person made proven waiting for a look`);
  } catch (e) {
    noteLive(root, `the facts proven without the original record not set right now: ${errorText(e)}`);
  }
  // where the values came from (an imported family tree, the user): marked once, only marks (spec 066)
  try {
    const done = settleOrigins(Tree.open(root, env));
    if (done) noteLive(root, `where the values came from: ${counted(done.changed, "mark")} in ${counted(done.records, "record")}`);
  } catch (e) {
    noteLive(root, `where the values came from not marked now: ${errorText(e)}`);
  }
  // the facts with their original cited, not yet verified against it: queued once (spec 065)
  try {
    const done = settleVerify(Tree.open(root, env));
    if (done) noteLive(root, `facts to verify against their originals: ${counted(done.facts, "fact")} of ${counted(done.people, "person", "people")} queued`);
  } catch (e) {
    noteLive(root, `the facts to verify against their originals not queued now: ${errorText(e)}`);
  }
  // how sure a name is: the names a record of the research's names made probable once (spec 066 P5)
  try {
    const done = settleNameStatus(Tree.open(root, env));
    if (done) noteLive(root, `how sure a name is: ${counted(done.changed, "name")} made probable in ${counted(done.records, "record")}`);
  } catch (e) {
    noteLive(root, `how sure the names are not set now: ${errorText(e)}`);
  }
  // an agent's proposals whose value proposed holds now: closed by themselves (no value written)
  try {
    const done = settleHeldProposals(Tree.open(root, env));
    if (done?.length) noteLive(root, `proposals settled by themselves (the value proposed holds now): ${done.map((c) => c.id).join(", ")}`);
  } catch (e) {
    noteLive(root, `the proposals that hold not closed now: ${errorText(e)}`);
  }
  // the overlapping clips of one image the research wrote: joined into one (once)
  try {
    const done = settleClips(Tree.open(root, env));
    if (done) noteLive(root, `overlapping clips of one image: ${counted(done.joined.length, "source")} joined into one, ${counted(done.left.length, "source")} left as they are (a person's, or not told whose)`);
  } catch (e) {
    noteLive(root, `the overlapping clips of one image not joined now: ${errorText(e)}`);
  }
  // the notes a send of the Strom app wrote to a fact alike (before 1.34.0): set right once, the wrong one kept in its history
  try {
    const done = settleNotes(Tree.open(root, env));
    if (done) noteLive(root, `notes a send of the app wrote to a fact alike: ${counted(done.notes, "note")} of ${counted(done.facts, "fact")} set right, ${counted(done.left.length, "fact")} changed since, left as they are${done.left.length ? ` (${done.left.join(", ")}; asked of the person: ${done.asked.join(", ")})` : ""}${done.backup ? `; backed up first: ${done.backup.path}` : ""}`);
  } catch (e) {
    noteLive(root, `the notes a send of the app wrote to a fact alike not set right now: ${errorText(e)}`);
  }
  // the phone connection on and its server gone (the computer started again): started again beside the bridge
  try {
    if (phoneConfig(env).on && !phoneRunning(env)) {
      revivePhone(env);
      noteLive(root, "the phone connection is on and its server was gone: started again");
    }
  } catch (e) {
    noteLive(root, `the phone's server not started again now: ${errorText(e)}`);
  }
  // the address of the last bridge, so the app that followed it finds this one (its secret: none once it was ended for
  // good — a new one); replaced while it runs when a page that is no Strom app comes with it (leaked)
  const { last, foreign } = readLastOf(root);
  // the notes of another folder's bridge (the research copied with its .strom): a new address of its own — a port the
  // system picks and a new secret, so the app following the original never comes here
  if (foreign) noteLive(root, `the bridge's notes came from another folder (${foreign}): a new address`);
  let token = last?.token ?? crypto.randomBytes(16).toString("hex");
  // what this bridge says of itself (live.json), once it listens
  let live: LiveInfo | undefined;
  // how long it runs on with nobody asking (STROM_LIVE_IDLE_MS > live.idleMinutes > 0: never by itself); read again
  // now and then (the person's choice changes for every bridge of this computer) and at once when the app writes it
  let idleMs = new Settings(env, {}).liveIdleMs();
  let idleRead = Date.now();
  const pollMs = Number(env.STROM_LIVE_POLL_MS ?? 2000);
  const streams = new Set<http.ServerResponse>();
  let lastAsked = Date.now();
  // the trees for the app made last, one for each variant (core/liveged.ts gedVariant: the app's version, the links, the
  // images' settings…), the newest GEDS_KEPT; each kept on disk as well (.strom/cache/live-ged), for the next bridge
  const geds = new Map<string, GedMade>();
  const keepGed = (variant: string, made: GedMade) => {
    geds.delete(variant);
    geds.set(variant, made);
    while (geds.size > GEDS_KEPT) geds.delete(geds.keys().next().value!);
  };
  // the app's version the tree was last asked for by: made for it again when a commit comes, before the change is told
  // (a bridge taking over from one of an older strom: the version the app asked that one with)
  let gedFollow: { version: string | undefined; images?: GedImages; media?: boolean } | undefined =
    env.STROM_LIVE_GED_FOR !== undefined ? { version: env.STROM_LIVE_GED_FOR || undefined, ...(env.STROM_LIVE_GED_IMAGES === "ref" ? { images: "ref" as const } : {}), ...(env.STROM_LIVE_GED_MEDIA === "app" ? { media: true } : {}) } : undefined;
  // a change told once the tree that goes with it is made (sayChange: set once the bridge listens)
  let sayChange: ((from: string, to: string) => void) | undefined;
  // the files kept on disk written one after another
  let storing: Promise<void> = Promise.resolve();
  /** The excerpts the tree's file of that head leaves out, though the research has them (the same for every app): /excerpts. */
  let left: GedMade["left"] | undefined;
  let log: { head: string; text: string } | undefined;
  // the glance of the state /status was last made for, for each version of the app as /status is (GET glance; the runs
  // added at each ask), the research's names with it
  const glanceKept = new Map<string, { key: string; glance: Glance }>();
  // /log worked out for one head at a time (the asks for it wait for it together, those for a newer one for the next)
  const logs = new OneAtATime<string>(
    () => head(root),
    (h) =>
      log?.head === h
        ? Promise.resolve(log.text)
        : keeper.log(h).then((text) => {
            log = { head: h, text };
            return text;
          }),
  );
  // what git said of each commit, kept: a new commit costs only itself (/log, the changes heard)
  const histories = new HistoryCache(root);

  /** A request that failed: said to the app, written into the log — the bridge goes on. */
  const failed = (req: http.IncomingMessage, res: http.ServerResponse, e: unknown) => {
    noteLive(root, `${req.method} ${masked(req.url)} failed: ${errorText(e)}`);
    try {
      // an answer begun (the events) is only ended
      if (res.headersSent) res.end();
      else {
        // a send or an adoption that went wrong on the way: its stable code too, for the app to say it in its words
        const what = req.method === "POST" ? (req.url ?? "").split("?")[0]!.split("/")[2] : undefined;
        if (isDiskFull(e)) {
          res.writeHead(507, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(diskFullSaid(langOf(root, env), root)));
          return;
        }
        const code = what === "sync" ? CODES["ui.sync.bridge.failed"] : what === "adopt" ? CODES["ui.sync.bridge.adopt"] : undefined;
        res.writeHead(500, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify({ error: (e as Error)?.message ?? String(e), ...(code ? { code } : {}) }));
      }
    } catch {
      res.destroy();
    }
  };

  const safely = (req: http.IncomingMessage, res: http.ServerResponse, fn: () => void) => {
    try {
      fn();
    } catch (e) {
      failed(req, res, e);
    }
  };
  // what receives an original or closes a batch (receive.ts, shared with the phone's server)
  // what the app sent written by a strom kept warm (core/warmwriter.ts), the files it queued one commit at a time
  // (core/livequeue.ts): the writer started with the first write, the queue taken over as the bridge listens
  const writer = warmWriter({ root, env: forApp(env, root), note: (text) => noteLive(root, text), track });
  const media = mediaQueue({ root, env, run: writer.run, note: (text) => noteLive(root, text) });
  const receiver: Receiver = { root, env, note: (text) => noteLive(root, text), track, head: () => head(root), safely, run: writer.run, queued: (job) => media.queued(job) };
  // The device of the home network a request came from (spec 094): the one its gateway names (X-Strom-Device) while
  // devices.mode is on and that device is paired here — its row's id and name, never what the request says of itself;
  // none for any other request. Every strom a write runs is given it (core/devicevia.ts), so each operation it writes
  // names the device beside the person: the writes of the app's (writeFor) by personEnv, an original and a batch closed
  // by receiverOf; a send names its device in itself (sync.ts withSendClient).
  const devicesOf = new WeakMap<http.IncomingMessage, AppClient | null>();
  const deviceOf = (req: http.IncomingMessage): AppClient | undefined => {
    if (!devicesOf.has(req)) {
      const said = req.headers[DEVICE_HEADER];
      devicesOf.set(req, (said ? clientOfDevice(env, said) : undefined) ?? null);
    }
    return devicesOf.get(req) ?? undefined;
  };
  /** The environment of a strom a request's write runs: the person's for the app (forApp), its device named. */
  const personEnv = (req: http.IncomingMessage): NodeJS.ProcessEnv => ({ ...forApp(env, root), ...viaEnv(deviceOf(req)) });
  /** What receives an original or closes a batch for a request: its device named (the job of a file queued keeps it). */
  const receiverOf = (req: http.IncomingMessage): Receiver => {
    const via = deviceOf(req);
    return via ? { ...receiver, via } : receiver;
  };
  // the documents the app asks to be read (live-read.ts): their queue read one at a time, each by a strom of its own
  const reads = new AppReadings({ root, env, settings: () => new Settings(env, {}), note: (text) => noteLive(root, text), safely });
  const sorts = new AppSorts({ root, env, settings: () => new Settings(env, {}), note: (text) => noteLive(root, text), safely });
  // /status made on a thread of its own, kept for the state it was made for (core/livestatus.ts): the state is the commit
  // and what changes beside it — the day, who is at work, the tree's settings, this computer's, the choices off the lines
  const stamp = (file: string) => {
    try {
      return String(fs.statSync(file).mtimeMs);
    } catch {
      return "-";
    }
  };
  // the shared folder whose restricted archives' holds (<shared>/net/holds) the state goes by beside the research's own
  let holdsShared: string | undefined;
  try {
    holdsShared = new Settings(env, {}).shared()?.value;
  } catch {
    holdsShared = undefined;
  }
  const keeper = new StatusKeeper({
    root,
    env,
    git: gitProgram() ?? "git",
    atWork: () => JSON.stringify(liveWorkers(root)) + holdsStamp(root, holdsShared),
    stateNow: () => [now().slice(0, 10), stamp(path.join(root, TREE_FILE)), stamp(configFile(env)), stamp(path.join(root, ...OFFLINE_FILE.split("/"))), historyRevs.get(root)?.rev ?? "", JSON.stringify(agentsHere(env)), diskVersion(env)?.version ?? ""].join("|"),
    known: () => historyRevKnown(root),
    inline: (version, key) => splitStatus(status(root, env, version, reads.seen), key),
    logHere: (h) => JSON.stringify({ entries: histories.log(Tree.open(root, env), h) }),
    note: (text) => noteLive(root, text),
  });
  // the app's version of the last /status asked: made for it again before it asks, when a commit comes
  // (a bridge that takes over from one of an older strom: the version the app asked that one with)
  let statusVersion: string | undefined = env.STROM_LIVE_STATUS_FOR || undefined;

  /**
   * What changes something (a send, an adoption, an original, a batch, the app saying nothing came): one line in the
   * log of how it went — its answer's code, marks and why, so the research keeps a trace of each (found on Windows: a
   * refused send and a material taken in left none).
   */
  const told = (req: http.IncomingMessage, res: http.ServerResponse) => {
    const started = Date.now();
    let body = "";
    const end = res.end.bind(res) as (...a: unknown[]) => http.ServerResponse;
    res.end = ((...a: unknown[]) => {
      if (typeof a[0] === "string" && a[0].length < 65536) body = a[0];
      return end(...a);
    }) as typeof res.end;
    res.on("finish", () => {
      let said: Record<string, unknown> = {};
      try {
        said = body ? (JSON.parse(body) as Record<string, unknown>) : {};
      } catch {
        // not JSON: the status alone
      }
      const marks = ["code", "reasonCode", "decided", "take", "intake", "input", "changes", "applied", "pending", "keptAs", "known", "batch", "sha", "read", "state"]
        .filter((k) => said[k] !== undefined && said[k] !== null && typeof said[k] !== "object")
        .map((k) => `${k} ${String(said[k]).slice(0, 80)}`);
      if (Array.isArray(said.conflicts) && said.conflicts.length) marks.push(`conflicts ${said.conflicts.length}`);
      if (Array.isArray(said.skipped) && said.skipped.length) marks.push(`skipped ${said.skipped.length}`);
      const why = res.statusCode >= 400 ? String(said.text ?? said.reason ?? said.error ?? "").replace(/\s+/g, " ").slice(0, 300) : "";
      const route = masked(req.url).replace(/\?.*$/, "");
      noteLive(root, `${req.method} ${route} → ${res.statusCode}${marks.length ? ` · ${marks.join(", ")}` : ""}${why ? ` · ${why}` : ""} (${Date.now() - started} ms)`);
    });
  };

  // what the app sends now (its body still coming, its answer not given): a bridge asked to end waits for it
  let incoming = 0;
  const server = http.createServer((req, res) => {
    if (req.method === "POST" || req.method === "PUT") {
      told(req, res);
      incoming++;
      let done = false;
      const over = () => {
        if (!done) incoming--;
        done = true;
      };
      res.once("finish", over);
      res.once("close", over);
    }
    safely(req, res, () => answer(req, res));
  });
  // an original of hundreds of MB takes its time to come
  server.requestTimeout = 30 * 60_000;
  // a connection the app keeps open is not closed under a request it sends again a moment later (a busy computer:
  // the client's own wait runs out after Node's 5 s, the request comes as the connection closes — "reset")
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  /**
   * The secret came from a page that is no Strom app: replaced at once — written where strom app reads it (live.json,
   * live-last.json), the event streams on the old one ended (the app notices), said in the log. What is being written
   * meanwhile finishes; every new request needs the new secret.
   */
  const leaked = (req: http.IncomingMessage, from: string, what: string | undefined) => {
    token = crypto.randomBytes(16).toString("hex");
    for (const s of streams) s.end();
    streams.clear();
    if (live) {
      live = { ...live, token, url: `http://127.0.0.1:${live.port}/${token}` };
      try {
        const now = liveRunning(root);
        if (!now || now.pid === process.pid) writeLive(root, live);
        const was = readLast(root);
        if (!was || was.pid === process.pid) writeLast(root, { port: live.port, token, pid: process.pid, started: live.started });
      } catch (e) {
        noteLive(root, `the new secret not written: ${errorText(e)}`);
      }
    }
    const page = from.replace(/[\u0000-\u001f\u007f]/g, "?").slice(0, 200);
    noteLive(root, `${req.method} /…/${String(what ?? "").slice(0, 40)} came with the secret from ${page}, a page that is no Strom app: the address got out — a new secret, the old one no longer works (the Strom app gets the new one when the research is opened in it again: strom app)`);
  };

  /**
   * The tree for the app as it is now (at its head; made again for another head, version of the app or links), with its
   * ETag (feature ged.etag): the app that has it already (If-None-Match) gets 304 and no body.
   */
  const giveGed = async (req: http.IncomingMessage, res: http.ServerResponse, version: string | undefined, images: GedImages, media = false) => {
    const made = await makeGed(version, images, media);
    const tag = gedTagOf(made);
    if (media) servedMedia(made.head);
    if (tag && tagMatches(req, tag)) return void res.writeHead(304, { ...GED_HEADERS, ETag: tag, "X-Strom-Head": made.head, "X-Strom-Images": images }).end();
    await sendGed(req, res, made, images, { ...(tag ? { ETag: tag } : {}), "X-Strom-Head": made.head });
  };
  // the file by reference packed once (gzip): what the app loads after each change is a few per cent of the whole file
  const packed = new WeakMap<GedMade, Promise<Buffer>>();
  /**
   * A tree's file for the app given: the one by reference packed (Content-Encoding: gzip) for an app that takes it
   * (Accept-Encoding: gzip; a browser always does), the whole file as always (an older app gets nothing new).
   */
  const sendGed = async (req: http.IncomingMessage, res: http.ServerResponse, made: GedMade, images: GedImages, extra: Record<string, string>) => {
    const head = { "Content-Type": "text/plain; charset=utf-8", ...GED_HEADERS, ...extra, "X-Strom-Images": images };
    if (images === "ref" && takesGzip(req)) {
      let gz = packed.get(made);
      if (!gz) packed.set(made, (gz = gzipped(made.bytes, 6)));
      const bytes = await gz;
      if (res.destroyed) return;
      return void res.writeHead(200, { ...head, "Content-Encoding": "gzip", Vary: varyGzip(res), "Content-Length": String(bytes.length) }).end(bytes);
    }
    res.writeHead(200, { ...head, ...(images === "ref" ? { Vary: varyGzip(res) } : {}), "Content-Length": String(made.bytes.length) }).end(made.bytes);
  };
  // the variant each file made is of (its ETag is told by its head and variant)
  const madeFor = new WeakMap<GedMade, string>();
  /** The ETag of a file made: none for one with images left for later (made again with them next time). */
  const gedTagOf = (made: GedMade): string | undefined => {
    const variant = madeFor.get(made);
    return variant === undefined || made.left.sources.some((x) => x.omitted.why === "later") ? undefined : gedTag(made.head, variant);
  };
  /**
   * The app has the tree of the head now already (If-None-Match its ETag): 304 at once, nothing made, nothing waited for
   * — but only for a file made whole (one with images left for later has no ETag the app could hold).
   */
  const gedUnchanged = (req: http.IncomingMessage, res: http.ServerResponse, version: string | undefined, images: GedImages, media = false): boolean => {
    if (!req.headers["if-none-match"]) return false;
    const h = head(root);
    const { variant } = variantOf(version, images, media);
    const tag = gedTag(h, variant);
    if (!tagMatches(req, tag)) return false;
    if (media) servedMedia(h);
    res.writeHead(304, { ...GED_HEADERS, ETag: tag, "X-Strom-Head": h, "X-Strom-Images": images }).end();
    return true;
  };
  /** What a tree's file for the app of that version is made by beyond the head (core/liveged.ts gedVariant). */
  const variantOf = (version: string | undefined, images: GedImages = "data", media = false) => {
    const offered = links(env);
    const opens = appOpensLinks(new Settings(env, {}), version) ? offered.join(" ") : "";
    return { offered, variant: gedVariant(root, env, version, opens, images, media) };
  };
  /**
   * The app given the tree of this head with the files of its tree (media=app, spec 108): kept, the base its next send's
   * files are compared with (core/treemedia.ts servedWithMedia) — never a reason the file is not given.
   */
  const servedMedia = (h: string) => {
    try {
      markServedWithMedia(root, h);
    } catch (e) {
      noteLive(root, `the head given with the tree's files not kept: ${errorText(e)}`);
    }
  };
  // the file being made now and what for (one at a time: the requests for the same wait for it together)
  let making: { key: string; done: Promise<GedMade> } | undefined;
  /**
   * The tree for the app made for its head and variant, when it is not made yet: kept on disk from before (a bridge
   * started again, a research that did not change), else made on a thread of its own (core/liveged.ts), the bridge
   * answering everything else meanwhile, and kept on disk — but a file with images left for later (the time to make
   * them ran out), made again next time.
   */
  const makeGed = async (version: string | undefined, images: GedImages = "data", media = false): Promise<GedMade> => {
    for (;;) {
      const h = head(root);
      const { offered, variant } = variantOf(version, images, media);
      // made again for another version of the app (two windows, two versions: each gets what it reads)
      const kept = geds.get(variant);
      if (kept && kept.head === h) {
        madeFor.set(kept, variant);
        return kept;
      }
      const key = `${h}|${variant}`;
      if (making && making.key !== key) {
        // another being made (another head, another version): made after it
        await making.done.catch(() => undefined);
        continue;
      }
      if (!making) {
        const job = async () => {
          const stored = await storedGed(root, env, variant, h);
          if (stored) {
            madeFor.set(stored, variant);
            return stored;
          }
          const made = await gedOnThread({ root, env, head: h, version, links: offered, budgetMs: LIVE_IMAGES_MS, ...(images === "ref" ? { images } : {}), ...(media ? { media } : {}) });
          madeFor.set(made, variant);
          if (made.head === h && !made.left.sources.some((x) => x.omitted.why === "later"))
            storing = storing.then(() => storeGed(root, variant, made)).catch((e) => noteLive(root, `the tree's file not kept on disk: ${errorText(e)}`));
          return made;
        };
        const now = { key, done: job() };
        making = now;
        now.done.then(
          (made) => {
            if (making === now) making = undefined;
            keepGed(variant, made);
            left = made.left;
          },
          () => {
            if (making === now) making = undefined;
          },
        );
      }
      return making.done;
    }
  };
  /**
   * The tree asked with ?stale=1 (feature ged.stale): the last one made of its variant at once, though the research
   * changed since — X-Strom-Head its head, X-Strom-Stale: 1 and X-Strom-Head-Now the head now; the tree of the head now
   * made meanwhile and told by the event change (from the head the app has). Nothing made of its variant yet (the first
   * time, another strom or app): made now, as without it.
   */
  const giveStale = async (req: http.IncomingMessage, res: http.ServerResponse, version: string | undefined, images: GedImages, media = false) => {
    const h = head(root);
    const { variant } = variantOf(version, images, media);
    const older = geds.get(variant) ?? (await storedGed(root, env, variant));
    if (older) madeFor.set(older, variant);
    if (older?.head === h) keepGed(variant, older);
    if (!older || older.head === h) return afterQuiet(() => giveGed(req, res, version, images, media).catch((e) => failed(req, res, e)));
    if (media) servedMedia(older.head);
    // the older one with its own ETag: the app holding it already gets 304 (still told it is older), the new one made
    const tag = gedTagOf(older);
    const stale = { "X-Strom-Head": older.head, "X-Strom-Stale": "1", "X-Strom-Head-Now": h, "X-Strom-Images": images };
    if (tag && tagMatches(req, tag)) res.writeHead(304, { ...GED_HEADERS, ETag: tag, ...stale }).end();
    else await sendGed(req, res, older, images, { ...(tag ? { ETag: tag } : {}), ...stale });
    afterQuiet(() =>
      makeGed(version, images, media).then(
        (made) => sayChange?.(older.head, made.head),
        (e) => noteLive(root, `the tree for the app not made: ${errorText(e)}`),
      ),
    );
  };

  /**
   * One image of the tree's file by its hash (GET /image/<sha256>, spec 071): its JPEG as kept when a file was made
   * with it (core/liveimages.ts) — never made because it is asked for — or a file of the app's tree (spec 108, media=app):
   * the working copy of a record in the tree from the shared store, of its own type (core/treemedia.ts). Unchanging (its content is its name): kept by
   * the browser for a year, ETag its hash (If-None-Match: 304). Refused: 400 image.sha, 404 image.unknown (not here:
   * the app takes the whole file instead).
   */
  const giveImage = async (req: http.IncomingMessage, res: http.ServerResponse, sha: string): Promise<void> => {
    const json = (code: number, body: unknown) => void res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(body));
    if (!IMAGE_SHA.test(sha)) return json(400, refusal("/image/<sha256>: the 64 hex of an image the tree's file names (2 FILE strom-image:…)", "image.sha", { sha: sha.slice(0, 64) }));
    const tag = `"${sha}"`;
    const headers = { "Cache-Control": IMAGE_CACHE, ETag: tag, "Access-Control-Expose-Headers": "ETag" };
    // a file of the app's tree (spec 108): its working copy in the shared store, only of a record in the tree
    const own = treeMediaFile(root, new Settings(env, {}).shared()?.value, sha);
    // the browser has it (its name is its content): nothing read
    if (tagMatches(req, tag) && (own || fs.existsSync(imageFile(root, sha)))) return void res.writeHead(304, headers).end();
    const got = (await readImage(root, sha)) ?? (own ? await readTreeMedia(own.file, sha) : undefined);
    if (!got) return json(404, refusal(`no image ${sha} here: the tree's file with its images in it (/tree.ged without ?images=ref) has them all`, "image.unknown", { sha }));
    const mime = own && !fs.existsSync(imageFile(root, sha)) ? own.mime : IMAGE_MIME;
    res.writeHead(200, { "Content-Type": mime, "Content-Length": String(got.length), ...headers }).end(got);
  };
  /** The bytes of a file of the app's tree, only when they still give its hash. */
  const readTreeMedia = async (file: string, sha: string): Promise<Buffer | undefined> => {
    const bytes = await fs.promises.readFile(file).catch(() => undefined);
    return bytes && crypto.createHash("sha256").update(bytes).digest("hex") === sha ? bytes : undefined;
  };

  /**
   * Several images of the tree's file by their hashes (POST /images {"images": [sha256…]}, spec 071): read only. Each
   * given whole as base64 with its hash, kind and size, in the order asked, until the answer holds IMAGES_ANSWER_BYTES
   * of them (one at least); those beyond in `more` (asked again), those not here in `missing` (the app takes the whole
   * file for them). The answer has its length: one cut short is never taken as whole; it is never packed (gzip). Refused: 400 images.body (not
   * {"images": [64 hex…]}, none, more than IMAGES_AT_ONCE). The files of the app's tree (spec 108) too, each of its own
   * type: only the working copies of records in the tree, never another file of the shared store.
   */
  const giveImages = async (req: http.IncomingMessage, res: http.ServerResponse) => {
    const json = (code: number, body: unknown) => {
      if (res.headersSent) return;
      const text = JSON.stringify(body);
      res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Content-Length": String(Buffer.byteLength(text)) }).end(text);
    };
    const max = 128 * 1024;
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const c of req as AsyncIterable<Buffer>) {
      size += c.length;
      if (size <= max) chunks.push(c);
    }
    const bad = () => json(400, refusal(`the body: {"images": ["<sha256>", …]}, 1 to ${IMAGES_AT_ONCE} of them`, "images.body", { max: String(IMAGES_AT_ONCE) }));
    if (size > max) return bad();
    let asked: unknown;
    try {
      asked = (JSON.parse(Buffer.concat(chunks).toString("utf8")) as { images?: unknown } | null)?.images;
    } catch {
      return bad();
    }
    if (!Array.isArray(asked) || !asked.length || asked.length > IMAGES_AT_ONCE || asked.some((x) => typeof x !== "string" || !IMAGE_SHA.test(x.toLowerCase()))) return bad();
    const shas = [...new Set((asked as string[]).map((x) => x.toLowerCase()))];
    const cap = Number(env.STROM_LIVE_IMAGES_BYTES ?? IMAGES_ANSWER_BYTES);
    const shared = new Settings(env, {}).shared()?.value;
    const images: { sha: string; mime: string; bytes: number; data: string }[] = [];
    const missing: string[] = [];
    const more: string[] = [];
    let held = 0;
    for (const sha of shas) {
      // the app gone meanwhile: nothing more read (its request read whole is no sign: it ends as it is read)
      if (res.destroyed) return;
      // a file of the app's tree (spec 108): its working copy in the shared store, only of a record in the tree
      const own = treeMediaFile(root, shared, sha);
      if (images.length && held >= cap) {
        // the answer full: only whether it is here (the next answer reads it whole, and says missing one gone since)
        if (own || (await fs.promises.stat(imageFile(root, sha)).then(() => true, () => false))) more.push(sha);
        else missing.push(sha);
        continue;
      }
      const excerpt = await readImage(root, sha);
      const bytes = excerpt ?? (own ? await readTreeMedia(own.file, sha) : undefined);
      if (!bytes) {
        missing.push(sha);
        continue;
      }
      // one that would take the answer over its size waits for the next (but the first always comes)
      if (images.length && held + bytes.length > cap) {
        more.push(sha);
        held = cap;
        continue;
      }
      held += bytes.length;
      images.push({ sha, mime: excerpt || !own ? IMAGE_MIME : own.mime, bytes: bytes.length, data: bytes.toString("base64") });
    }
    // never packed, though the app takes it: base64 of JPEGs packs about a quarter, slower to pack than to send
    // (the app waited for its answers; the slim tree.ged is packed still)
    json(200, { images, missing, more });
  };

  /**
   * What the app would load to have every image of the research (/excerpts?missing=1): the sources whose excerpts the
   * file of the head now leaves out, though the research has them (not those whose image is not here), each with the
   * marks of its excerpts, how large they come (made ones exactly, the rest estimated) and whether all are made.
   */
  const giveLeft = async (res: http.ServerResponse, version: string | undefined) => {
    const h = head(root);
    const now = left && left.head === h ? left : (await makeGed(version, gedFollow?.images, gedFollow?.media)).left;
    const tree = Tree.open(root, env);
    const shared = new Settings(env, {}).shared()?.value;
    const level = excerptLevel(now.level) ?? LEVELS[1]!;
    const media = tree.list<Media>("media");
    const sources = !shared
      ? []
      : now.sources
          .filter((x) => x.omitted.why !== "missing")
          .map((x) => ({ x, size: excerptSizes(tree, shared, x.source, level, media) }))
          .filter(({ size }) => size.clips.length)
          .map(({ x, size }) => ({ source: x.source.id, why: x.omitted.why, clips: size.clips, bytes: size.bytes, ready: size.ready, ...(size.estimated ? { estimated: true } : {}) }));
    const body = {
      head: now.head,
      level: level.name,
      count: sources.length,
      clips: sources.reduce((n, x) => n + x.clips.length, 0),
      bytes: sources.reduce((n, x) => n + x.bytes, 0),
      estimated: sources.some((x) => x.estimated),
      sources,
    };
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Strom-Head": now.head }).end(JSON.stringify(body));
  };

  // the excerpts asked for are made one source after another, as the app asks (each on a thread of its own)
  let excerpting: Promise<unknown> = Promise.resolve();
  /**
   * One source's excerpts for the app (/excerpt/<S>[?clip=…&level=…]): as its file would carry them (turned for an app
   * that does not turn them), at the research's quality or the one asked for, never made smaller for a limit. Made for
   * EXCERPT_MS at most: the rest later (202, asked again — the made ones come from the cache). Made on a thread of its
   * own (core/liveged.ts): the bridge answers everything else meanwhile.
   */
  const giveExcerpt = (req: http.IncomingMessage, res: http.ServerResponse, version: string | undefined, id: string) => {
    const q = new URLSearchParams((req.url ?? "").split("?")[1] ?? "");
    const ask = { root, env, version, id, clip: q.get("clip") ?? undefined, level: q.get("level"), budgetMs: Number(env.STROM_LIVE_EXCERPT_MS ?? EXCERPT_MS), atOnce: EXCERPTS_AT_ONCE };
    const send = (got: { code: number; text: string }) => res.writeHead(got.code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(got.text);
    // what is refused at once by its address: no thread for it
    if (!/^S\d{1,9}$/.test(id) || (ask.clip !== undefined && ask.clip !== INPUT_MARK && !/^c[0-9a-f]{10}$/.test(ask.clip))) {
      const a = excerptAnswer(ask);
      return void send({ code: a.code, text: JSON.stringify(a.body) });
    }
    const done = excerpting.then(() => excerptOnThread(ask));
    excerpting = done.catch(() => undefined);
    done.then(
      (got) => safely(req, res, () => send(got)),
      (e) => failed(req, res, e),
    );
  };

  // A commit a moment ago: another may follow at once — the tree is made once none came for quietMs (at most
  // quietMaxMs after it was asked for), and then from the newest; a tree already made for the head now: at once.
  const quietMs = Number(env.STROM_LIVE_QUIET_MS ?? 2000);
  const quietMaxMs = Number(env.STROM_LIVE_QUIET_MAX_MS ?? 6000);
  // strom's fixes as the app was last told them, while nothing they are found by changed (fixesStamp) and the research
  // is as much of an archive as then
  let fixesKept: { key: string; text: string } | undefined;
  // the stamp is told by the files alone (no read of the research): here; what it finds, on a thread of its own
  // (seconds on a large research, after each commit: the bridge answered nothing meanwhile — found 2026-11-04)
  type FixChecks = typeof import("../commands/fixchecks.ts");
  const fixesNow = (m: FixChecks) => {
    const tree = Tree.open(root, env);
    const settings = new Settings(env, {});
    const archive = actsAsArchive(tree);
    return { tree, settings, archive, key: `${m.fixesStamp(tree, m.fixEnvOf(settings, env, tree))}|${archive}` };
  };
  let fixes: OneAtATime<string> | undefined;
  const fixesOf = (m: FixChecks) =>
    (fixes ??= new OneAtATime<string>(
      () => fixesNow(m).key,
      (key) => {
        if (fixesKept?.key === key) return Promise.resolve(fixesKept.text);
        // the thread failed (or is turned off): found here, as before
        const here = () => {
          const now = fixesNow(m);
          return { key: now.key, text: JSON.stringify(m.fixesForApp(now.tree, now.settings, env, { archive: now.archive })) };
        };
        const found = env.STROM_LIVE_STATUS_THREAD === "0" ? Promise.resolve().then(here) : fixesOnThread({ root, env }).catch(here);
        return found.then((made) => {
          // kept for the stamp the research was read at (a commit since: another)
          fixesKept = made;
          return made.text;
        });
      },
    ));
  const giveFixes = (req: http.IncomingMessage, res: http.ServerResponse) => {
    import("../commands/fixchecks.ts").then(
      (m) =>
        safely(req, res, () => {
          const { key } = fixesNow(m);
          const answer = (text: string) => {
            if (!req.destroyed) res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(text);
          };
          if (fixesKept?.key === key) return answer(fixesKept.text);
          fixesOf(m).ask(key).then(answer, (e) => failed(req, res, e));
        }),
      (e) => failed(req, res, e),
    );
  };
  /**
   * The tree check's built-in part now (GET /health/builtin[?scope=tree|line:G…|person:P…], feature health): strom's
   * fixes as GET /fixes has them (its cache), the rest read here. 400 health.scope.
   */
  const giveHealthBuiltin = (req: http.IncomingMessage, res: http.ServerResponse, scopeRaw: string | undefined) => {
    const json = (code: number, body: unknown) => {
      if (!req.destroyed && !res.headersSent) res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(body));
    };
    let scope: HealthScope;
    try {
      scope = scopeOf(Tree.open(root, env), scopeRaw);
    } catch (e) {
      return json(400, refusal((e as Error).message, "health.scope"));
    }
    const answer = (fixesText: string | undefined) =>
      safely(req, res, () => {
        let seen: FixSeen[] = [];
        try {
          const all = fixesText ? (JSON.parse(fixesText) as { fixes?: { id: string; count: number; state: string; cost?: string; paid: boolean }[] }).fixes ?? [] : [];
          seen = all.map((f) => ({ id: f.id, count: f.count, state: f.state, ...(f.cost ? { cost: f.cost } : {}), paid: f.paid }));
        } catch {
          // none said
        }
        json(200, { builtin: healthBuiltin(Tree.open(root, env), env, { scope, fixes: seen }) });
      });
    import("../commands/fixchecks.ts").then(
      (m) =>
        safely(req, res, () => {
          const { key } = fixesNow(m);
          if (fixesKept?.key === key) return answer(fixesKept.text);
          fixesOf(m).ask(key).then(answer, () => answer(undefined));
        }),
      () => answer(undefined),
    );
  };
  const afterQuiet = (fn: () => void) => {
    const asked = Date.now();
    const look = () => {
      let since = Infinity;
      try {
        const { head: h, at } = tip(root);
        if (![...geds.values()].some((g) => g.head === h)) since = at ? Date.now() - Date.parse(at) : Infinity;
      } catch {
        // git not answering: the tree is made now (it says why)
      }
      const left = asked + quietMaxMs - Date.now();
      if (!(since < quietMs) || left <= 0) return fn();
      setTimeout(look, Math.max(100, Math.min(quietMs - since, left)));
    };
    look();
  };

  /** A write refused as the research is sealed on another computer: said in its language, the way in `params.set`. */
  const sealRefusal = () => {
    let lang = "en";
    let name = "";
    try {
      const config = readJsonIfExists<TreeConfig>(path.join(root, TREE_FILE));
      lang = config?.lang ?? lang;
      name = config?.name ?? name;
    } catch {
      // said in English
    }
    return { ...said(lang, "ui.seal.bridge", { name, set: "strom seal adopt" }), seal: "elsewhere" };
  };

  /** A write refused as files of the research are only in iCloud: said in its language, how many and the first. */
  const cloudRefusal = (files: string[]) => {
    let lang = "en";
    try {
      lang = readJsonIfExists<TreeConfig>(path.join(root, TREE_FILE))?.lang ?? lang;
    } catch {
      // said in English
    }
    return { ...said(lang, "ui.error.tree.not-downloaded", { n: String(files.length), first: files[0]! }), notDownloaded: files.length };
  };

  const answer = (req: http.IncomingMessage, res: http.ServerResponse) => {
    const [, t, what, sub, act, rest, tail, past] = (req.url ?? "").split("?")[0]!.split("/");
    // the app asking now and then (?poll=1) or by itself what is new keeps no bridge running; anything else does
    if (!(req.method === "GET" && ((what === "status" && /[?&]poll=1(?:&|$)/.test(req.url ?? "")) || what === "whats-new"))) lastAsked = Date.now();
    // the secret from a page that is no Strom app: replaced, this request answered as one without it (no data, no CORS)
    if (t === token && foreignOrigin(req.headers.origin, env)) {
      leaked(req, String(req.headers.origin), what);
      res.writeHead(404).end();
      return;
    }
    const origin = allowedOrigin(req.headers.origin);
    const version = appVersionOf(req, new Settings(env, {}));
    // what the app sends may change what /status says without a commit (a send waiting, a reading, a batch): made again
    // (what only reads, though asked by POST: the images of the tree's file, what the research has of files)
    const onlyReads = req.method === "POST" && (what === "images" || (what === "media" && sub === "known"));
    if (req.method !== "GET" && req.method !== "OPTIONS" && !onlyReads) res.once("finish", () => keeper.forget());
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      // a busy answer's Retry-After seen by the app's page too (outside the CORS safelist; also as retry in the body);
      // an answer naming headers of its own (the GED's, an image's) names them instead
      res.setHeader("Access-Control-Expose-Headers", "Retry-After");
    }
    if (req.method === "OPTIONS") {
      if (origin) {
        // (DELETE: a device of the home network taken off, while their gateway is on)
        res.setHeader("Access-Control-Allow-Methods", devicesOn(env) ? "GET, POST, PUT, DELETE" : "GET, POST, PUT");
        res.setHeader("Access-Control-Allow-Headers", String(req.headers["access-control-request-headers"] ?? ""));
        if (req.headers["access-control-request-private-network"]) res.setHeader("Access-Control-Allow-Private-Network", "true");
        // the app asks every minute: its browser asks first only every ten
        res.setHeader("Access-Control-Max-Age", "600");
      }
      res.writeHead(origin ? 204 : 403).end();
      return;
    }
    // sealed on another computer: nothing the app sends is written until the person takes it over here — said so (409
    // seal.foreign, in the research's language with the way), never "send again in a moment" (found in the audit)
    if ((req.method === "POST" || req.method === "PUT") && t === token && origin && !onlyReads && writesTree(what, sub) && !newerTree(root, env) && !sealedHere(root, env)) {
      req.resume();
      res.writeHead(409, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(sealRefusal()));
      return;
    }
    // files of the research only in iCloud: nothing the app sends is written over them (409 tree.not-downloaded, the
    // way in the research's language), never "send again in a moment"
    const cloud = (req.method === "POST" || req.method === "PUT") && t === token && origin && !onlyReads && writesTree(what, sub) ? notDownloaded(root) : [];
    if (cloud.length) {
      req.resume();
      res.writeHead(409, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(cloudRefusal(cloud)));
      return;
    }
    if (req.method === "POST" && t === token && what === "sync" && sub && act === "again") {
      again(req, res, origin, decodeURIComponent(sub));
      return;
    }
    if (req.method === "POST" && t === token && what === "sync") {
      receive(req, res, origin);
      return;
    }
    if (req.method === "POST" && t === token && what === "cancel") {
      nothing(req, res, origin);
      return;
    }
    if (req.method === "POST" && t === token && what === "adopt") {
      receive(req, res, origin, "adopt");
      return;
    }
    if (req.method === "PUT" && t === token && what === "lists" && sub && !act) {
      listPut(req, res, origin, decodeURIComponent(sub));
      return;
    }
    if (req.method === "PUT" && t === token && what === "media") {
      // the warm writer started as the original comes (it loads while the bytes come)
      writer.warm();
      original(req, res, origin, sub ?? "");
      return;
    }
    // what the research has of many files by their hashes at once (read only)
    if (req.method === "POST" && t === token && what === "media" && sub === "known" && !act) {
      mediaKnown(req, res);
      return;
    }
    if (req.method === "POST" && t === token && what === "batch" && act === "done") {
      batchDone(req, res, origin, decodeURIComponent(sub ?? ""));
      return;
    }
    // a decided conflict marked for review kept as decided (spec 117 J4): no decision of it — the decision stands as the
    // person made it, only the mark of a source they deleted goes (deciding it again stays the terminal's, below)
    if (req.method === "POST" && t === token && what === "conflict" && sub === "keep" && !act) {
      writeFor(req, res, origin, conflictKeep());
      return;
    }
    if (req.method === "POST" && t === token && what === "conflict" && sub && !act) {
      // the bridge cannot tell the app from an agent on this computer (the secret is in the research's folder, an Origin
      // is a header any program sets): a conflict is the person's to decide, in the terminal its link opens — refused
      // before anything is read or opened
      req.resume();
      const id = decoded(sub).slice(0, 32);
      res
        .writeHead(403, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" })
        .end(JSON.stringify(refusal(`a conflict is decided in the terminal, through the link strom-research://conflict?…&id=${id}&do=decide — not through the bridge`, "decide.link", { id })));
      return;
    }
    if (req.method === "POST" && t === token && what === "waiting" && sub && !act) {
      // a branch that grows (W-B-…: answered as strom offline answer), a send asked about (W-S-I…: strom sync as-import),
      // else a task's request marked sent
      const id = decoded(sub);
      writeFor(req, res, origin, /^W-B-/iu.test(id) ? branchAnswerWrite(id) : /^W-S-/iu.test(id) ? importAnswerWrite(id) : waitingWrite(id));
      return;
    }
    // the bridge itself: how long it runs on with nobody asking (this computer's choice), or ended now from the app
    if (req.method === "POST" && t === token && what === "live" && !sub) {
      writeFor(req, res, origin, liveWrite());
      return;
    }
    // the runs (spec 126): one asked to stop, the limit of runs at once lowered
    if (req.method === "POST" && t === token && what === "runs" && sub === "stop" && !act) {
      writeFor(req, res, origin, runStopWrite());
      return;
    }
    if (req.method === "POST" && t === token && what === "settings" && sub === "runs" && !act) {
      writeFor(req, res, origin, runsLimitWrite());
      return;
    }
    // the question before a sort of the material (spec 102 U8): asked again from anywhere, taken away only by the app on
    // this computer (spec 123 P2)
    if (req.method === "POST" && t === token && what === "settings" && sub === "sort" && !act) {
      writeFor(req, res, origin, sortConfirmWrite(req));
      return;
    }
    // the question before the agent starts from the app's links (spec 123 P2): the same, this computer's
    if (req.method === "POST" && t === token && what === "settings" && sub === "run" && !act) {
      writeFor(req, res, origin, runConfirmWrite(req));
      return;
    }
    // census records as a source (spec 106)
    if (req.method === "POST" && t === token && what === "houses" && (sub === "confirm" || sub === "material" || sub === "request" || sub === "story") && !act) {
      writeFor(req, res, origin, sub === "confirm" ? houseConfirmWrite() : sub === "material" ? houseMaterialWrite() : sub === "story" ? houseStoryWrite() : houseRequestWrite());
      return;
    }
    // the history of the houses by itself (spec 030 part 2, feature house.auto)
    if (req.method === "POST" && t === token && what === "houses" && !sub) {
      writeFor(req, res, origin, housesWrite());
      return;
    }
    if (req.method === "POST" && t === token && what === "census" && !sub) {
      writeFor(req, res, origin, censusWrite());
      return;
    }
    // the batches sorted by themselves (spec 130)
    if (req.method === "POST" && t === token && what === "intake" && !sub) {
      writeFor(req, res, origin, intakeWrite());
      return;
    }
    // the tree's settings of the books (spec 105)
    if (req.method === "POST" && t === token && what === "books" && !sub) {
      writeFor(req, res, origin, booksWrite());
      return;
    }
    // a file of a book's folder of the inbox set aside (B0408, B0374): the person's answer which one is the image
    if (req.method === "POST" && t === token && what === "books" && sub === "aside") {
      writeFor(req, res, origin, asideWrite());
      return;
    }
    // work off the lines: a branch's choice, the tree's, a task's own turn — each a strom command
    if (req.method === "POST" && t === token && what === "offline" && !act) {
      writeFor(req, res, origin, sub ? offlineBranchWrite(decoded(sub)) : offlineTreeWrite());
      return;
    }
    if (req.method === "POST" && t === token && what === "queue" && sub && !act) {
      writeFor(req, res, origin, queueWrite(decoded(sub)));
      return;
    }
    if (req.method === "POST" && t === token && what === "group" && sub && !act) {
      writeFor(req, res, origin, groupWrite(decoded(sub)));
      return;
    }
    if (req.method === "POST" && t === token && what === "material" && (sub === "assign" || sub === "hide" || sub === "edit") && !act) {
      writeFor(req, res, origin, materialWrite(sub));
      return;
    }
    if (req.method === "POST" && t === token && what === "material" && sub === "delete" && !act) {
      writeFor(req, res, origin, materialDelete());
      return;
    }
    // a source the person deletes, puts back; a decision kept without it (spec 117)
    if (req.method === "POST" && t === token && what === "source" && (sub === "retract" || sub === "restore") && !act) {
      writeFor(req, res, origin, sub === "retract" ? sourceRetract() : sourceRestore());
      return;
    }
    if (req.method === "POST" && t === token && what === "history" && sub === "hide" && !act) {
      writeFor(req, res, origin, historyHide());
      return;
    }
    if (req.method === "POST" && t === token && what === "history" && sub === "place" && !act) {
      writeFor(req, res, origin, historyPlace());
      return;
    }
    if (req.method === "POST" && t === token && what === "history" && sub === "first" && !act) {
      writeFor(req, res, origin, historyFirst());
      return;
    }
    if (req.method === "POST" && t === token && what === "history" && sub === "delete" && !act) {
      writeFor(req, res, origin, historyDelete());
      return;
    }
    if (req.method === "POST" && t === token && what === "history" && sub === "skip" && !act) {
      writeFor(req, res, origin, historySkip());
      return;
    }
    if (req.method === "POST" && t === token && what === "history" && sub === "map" && !act) {
      writeFor(req, res, origin, historyMap());
      return;
    }
    if (req.method === "POST" && t === token && what === "history" && sub === "kinds" && !act) {
      writeFor(req, res, origin, historyKinds());
      return;
    }
    if (req.method === "POST" && t === token && what === "history" && sub === "align" && (!act || act === "undo")) {
      writeFor(req, res, origin, act === "undo" ? historyAlignUndo() : historyAlign());
      return;
    }
    if (req.method === "POST" && t === token && what === "sources" && sub === "split" && (!act || act === "undo")) {
      writeFor(req, res, origin, act === "undo" ? sourceSplitUndo() : sourceSplit());
      return;
    }
    if (req.method === "POST" && t === token && what === "stories" && !sub) {
      writeFor(req, res, origin, storiesWrite());
      return;
    }
    if (req.method === "POST" && t === token && what === "hypotheses" && !sub) {
      writeFor(req, res, origin, hypothesesWrite());
      return;
    }
    if (req.method === "POST" && t === token && what === "sources" && sub === "confirm" && !act) {
      writeFor(req, res, origin, confirmWrite());
      return;
    }
    if (req.method === "POST" && t === token && what === "facts" && sub === "revert" && !act) {
      writeFor(req, res, origin, revertWrite());
      return;
    }
    if (req.method === "POST" && t === token && what === "facts" && sub === "confirm" && !act) {
      writeFor(req, res, origin, factConfirmWrite());
      return;
    }
    if (req.method === "POST" && t === token && what === "verify" && !act) {
      const how = !sub ? verifyWrite() : sub === "bulk" ? verifyBulkWrite() : sub === "stop" ? verifyStopWrite() : undefined;
      if (how) {
        writeFor(req, res, origin, how);
        return;
      }
    }
    if (req.method === "POST" && t === token && what === "sourceTask" && !sub) {
      writeFor(req, res, origin, sourceTaskWrite());
      return;
    }
    if (req.method === "POST" && t === token && what === "sources" && sub && act === "read" && rest && tail === "task" && past === undefined) {
      writeFor(req, res, origin, readTaskWrite(decoded(sub), decoded(rest)));
      return;
    }
    if (req.method === "POST" && t === token && what === "sources" && sub === "proposal" && !act) {
      writeFor(req, res, origin, proposalWrite());
      return;
    }
    // the lines of the research: made, changed, paused / ended / resumed, put in order — each a strom command
    // a line's last taking of tasks given back (spec 126 K2.15)
    if (req.method === "POST" && t === token && what === "directions" && sub && act === "gather" && rest === "undo" && !tail) {
      const id = decoded(sub).toUpperCase();
      if (/^G\d{1,9}$/.test(id)) writeFor(req, res, origin, gatherUndo(id));
      else {
        req.resume();
        res.writeHead(404, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(refusal("no such line", "directions.none", { id: sub })));
      }
      return;
    }
    if (req.method === "POST" && t === token && what === "directions" && !rest) {
      const id = sub ? decoded(sub).toUpperCase() : undefined;
      if (!sub && !act) writeFor(req, res, origin, directionNew());
      else if (sub === "order" && !act) writeFor(req, res, origin, directionsOrder());
      else if (sub === "preview" && !act) writeFor(req, res, origin, directionPreview());
      else if (id && /^G\d{1,9}$/.test(id) && !act) writeFor(req, res, origin, directionEdit(id));
      else if (id && /^G\d{1,9}$/.test(id) && act === "state") writeFor(req, res, origin, directionState(id));
      else {
        req.resume();
        res.writeHead(404, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(refusal("no such line", "directions.none", { id: sub ?? "" })));
      }
      return;
    }
    if (req.method === "POST" && t === token && what === "places" && sub === "identify" && !act) {
      writeFor(req, res, origin, placesIdentify());
      return;
    }
    if (req.method === "POST" && t === token && what === "places" && sub === "answer" && !act) {
      writeFor(req, res, origin, placesAnswer());
      return;
    }
    if (req.method === "POST" && t === token && what === "places" && sub === "undo" && !act) {
      writeFor(req, res, origin, placesUndo());
      return;
    }
    if (req.method === "POST" && t === token && what === "places" && sub === "run" && !act) {
      // identifying places spends the agent's sessions: never started here, only by the link (the person's yes)
      writeFor(req, res, origin, placesRunRefused());
      return;
    }
    // the tree check (spec 091): the AI checks asked, stopped; findings decided — the person's, never a device's
    if (req.method === "POST" && t === token && what === "health" && (!sub || sub === "stop") && !act) {
      writeFor(req, res, origin, sub === "stop" ? healthStop() : healthWrite());
      return;
    }
    if (req.method === "POST" && t === token && what === "audit" && !act) {
      writeFor(req, res, origin, auditDecide(sub ? decoded(sub) : undefined));
      return;
    }
    if (req.method === "POST" && t === token && what === "quality" && sub === "dismiss" && !act) {
      writeFor(req, res, origin, qualityDismiss());
      return;
    }
    if (req.method === "POST" && t === token && what === "duplicates" && !sub) {
      duplicates(req, res);
      return;
    }
    if (req.method === "POST" && t === token && what === "experiments" && !sub) {
      writeFor(req, res, origin, experimentsWrite());
      return;
    }
    // the images of the tree's file by their hashes, several at once (read only: nothing written, nothing made)
    if (req.method === "POST" && t === token && what === "images" && !sub) {
      giveImages(req, res).catch((e) => failed(req, res, e));
      return;
    }
    if ((req.method === "GET" || req.method === "POST" || ((req.method === "DELETE" || req.method === "PUT") && sub === "devices" && devicesOn(env))) && t === token && what === "phone") {
      phone(req, res, origin, sub, act);
      return;
    }
    if ((req.method === "GET" || req.method === "POST") && t === token && (what === "read" || what === "reads" || (what === "sources" && sub === "read")) && reads.answer(req, res, origin, what, sub === undefined ? undefined : decoded(sub), act, rest)) return;
    if ((req.method === "GET" || req.method === "POST") && t === token && what === "material" && sub === "sort" && sorts.answer(req, res, origin, what, sub, act, rest)) return;
    if (req.method !== "GET" || t !== token) {
      res.writeHead(404).end();
      return;
    }
    try {
      if (what === "adopt") {
        // the new research started from the app's link: which tree of the app it waits for (its mark), its name
        // until when it waits (the app says so in its window), and whether the tree comes from another browser
        // (transfer: the app takes it from GET /transfer first)
        const wait = adoptionWait(root);
        const mark = wait?.token;
        // the app got here: a terminal still waiting says no more that it may be kept from it (D7)
        if (wait) noteAdoptAsked(root);
        const tree = Tree.open(root, env);
        // handed over already (its link opened again): said so — gone, not a tree the research never waited for
        const taken = mark ? undefined : adoptedAt(root, 0);
        const body = wait
          ? { token: wait.token, name: tree.config.name, tree: tree.config.id, until: wait.until, ...(wait.transfer ? { transfer: true } : {}), ...(wait.existing ? { existing: true } : {}) }
          : taken
            ? { adopted: true, name: tree.config.name, tree: tree.config.id, error: "the tree was handed over to this research already" }
            : { error: "this research waits for no tree" };
        const text = JSON.stringify(body);
        res.writeHead(mark ? 200 : taken ? 410 : 404, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(text);
      } else if (what === "transfer") {
        // the app's tree from a browser the app cannot reach strom from, as it came — only while the research waits
        // for it (the app in the browser it moved to checks its mark, then hands it over as POST /adopt)
        const file = adoptionWait(root)?.transfer;
        if (!file) {
          res.writeHead(404, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify({ error: "this research waits for no tree moving here" }));
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Content-Length": String(fs.statSync(file).size) });
        fs.createReadStream(file)
          .on("error", () => res.destroy())
          .pipe(res);
      } else if (what === "media") {
        // what the research has of this content: said — or, asked for, the file itself
        const sha = (sub ?? "").toLowerCase();
        const shared = new Settings(env, {}).shared()?.value;
        const tree = /^[0-9a-f]{64}$/.test(sha) ? readTree(root, env) : undefined;
        // a file of the app's tree whose original is not here yet: its working copy
        const known = tree ? (knownOriginal(tree, shared, sha) ?? workingCopyOf(tree, shared, sha)) : undefined;
        const json = (code: number, body: Record<string, unknown>) => res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(body));
        const thumb = new URLSearchParams((req.url ?? "").split("?")[1] ?? "").get("thumb");
        if (thumb !== null && !(THUMB_SIZES as readonly number[]).includes(Number(thumb))) json(400, refusal(`?thumb=${THUMB_SIZES.join("|")} (the longer side in pixels)`, "thumb.size"));
        // queued (PUT with Prefer: respond-async), not written yet: the research has it in a moment
        else if (!known) json(404, { known: null, ...(tree && queuedShas(root).has(sha) ? { queued: true } : {}) });
        else if (thumb !== null) giveThumb(req, res, known, sha, Number(thumb));
        else if (!/[?&]file=1(?:&|$)/.test(req.url ?? "")) json(200, { known: known.id, kind: known.kind, mime: known.mime, bytes: known.bytes, ...(known.name ? { name: known.name } : {}), here: !!known.file && fs.existsSync(known.file) });
        else if (!known.file || !fs.existsSync(known.file)) json(410, { known: known.id, ...refusal("its file is not on this computer", "media.gone", { known: known.id }) });
        else {
          const size = fs.statSync(known.file).size;
          res.writeHead(200, { "Content-Type": known.mime, "Content-Length": String(size), "Cache-Control": "no-store", "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(known.name ?? path.basename(known.file))}` });
          fs.createReadStream(known.file).on("error", (e) => failed(req, res, e)).pipe(res);
        }
      } else if (what === "excerpt" && sub && !act) {
        giveExcerpt(req, res, version, decoded(sub).toUpperCase());
      } else if (what === "excerpts" && !sub) {
        if (new URLSearchParams((req.url ?? "").split("?")[1] ?? "").get("missing") !== "1") res.writeHead(400, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(refusal("/excerpts?missing=1: the excerpts the tree's file leaves out", "excerpts.missing")));
        // the plan of the file the tree's head has: made when the commits stop coming, as the tree is
        else afterQuiet(() => giveLeft(res, version).catch((e) => failed(req, res, e)));
      } else if (what === "material" && sub && act === "uses" && !rest) {
        // where the research uses one file of the material (spec 102 M2, V10)
        const json = (code: number, body: unknown) => res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(body));
        try {
          json(200, materialUses(Tree.open(root, env), decoded(sub)));
        } catch (e) {
          const r = refusedAsked(e);
          json(r.code, r.body);
        }
      } else if (what === "material") {
        // the family's files the research keeps — an archive's too, which nobody sorts: the app shows them again
        const q = new URLSearchParams((req.url ?? "").split("?")[1] ?? "");
        const person = (q.get("person") ?? "").toUpperCase();
        const batch = q.get("batch") ?? "";
        const files = q.get("files");
        // the family trees' files too (spec 117 K2.1): only to an app that asks, never to an older one
        const trees = q.get("trees");
        const json = (code: number, body: unknown) => res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(body));
        if ((q.has("person") && !/^P\d{1,9}$/.test(person)) || (q.has("batch") && !BATCH_ID.test(batch)) || (files !== null && files !== "0" && files !== "1") || (trees !== null && trees !== "0" && trees !== "1"))
          json(400, { ...refusal("?person=P… (a person of the research), ?batch=<the batch's mark>, ?files=0 (the batches only), ?trees=1 (the family trees' files too)", "material.query") });
        else json(200, material(Tree.open(root, env), new Settings(env, {}).shared()?.value, { ...(person ? { person } : {}), ...(batch ? { batch } : {}), ...(files === "0" ? { files: false } : {}), ...(trees === "1" ? { trees: true } : {}) }));
      } else if (what === "history" && !sub) {
        // what the ancestors lived through: read in an archive too, and in a research waiting for its agent
        const tree = Tree.open(root, env);
        const settings = new Settings(env, {});
        const got = historyAnswer(tree, settings.shared()?.value, settings, historyLimits(env));
        historyRevNow(tree, settings, head(root), got.state.rev);
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(got));
      } else if (what === "history" && sub === "align" && !act) {
        // what aligning the history with the kinds looked for would do (?kinds=: were these looked for) — read only,
        // never in an archive (nothing is looked for there), never while the research is written
        const q = new URLSearchParams((req.url ?? "").split("?")[1] ?? "");
        const json = (code: number, body: unknown, retry?: number) => res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...(retry ? { "Retry-After": String(retry) } : {}) }).end(JSON.stringify(body));
        const asked = q.has("kinds") ? kindsNamed((q.get("kinds") ?? "").split(",").map((k) => k.trim()).filter(Boolean)) : undefined;
        const tree = Tree.open(root, env);
        const holder = liveHolder(path.join(root, ".strom", "tree.lock"));
        if (q.has("kinds") && !asked) json(400, refusal(`?kinds=war,epidemic,…: the kinds of history (${EVENT_KINDS.join(", ")}), none for none`, "history.kinds.body"));
        else if (actsAsArchive(tree)) json(409, refusal("nobody researches here: nothing of history is looked for", "history.archive"));
        else if (writing || adopting || personWriting || (holder && !(holder.pid === process.pid && holder.host === os.hostname()))) json(503, { ...refusal("the research is being written: ask again in a while", "research.busy"), retry: 5 }, 5);
        else json(200, alignPreview(tree, asked));
      } else if (what === "sources" && sub === "split" && !act) {
        // what splitting the older sources' locators would do — read only, never in an archive, never while written
        const q = new URLSearchParams((req.url ?? "").split("?")[1] ?? "");
        const json = (code: number, body: unknown, retry?: number) => res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...(retry ? { "Retry-After": String(retry) } : {}) }).end(JSON.stringify(body));
        const tree = Tree.open(root, env);
        const holder = liveHolder(path.join(root, ".strom", "tree.lock"));
        if (actsAsArchive(tree)) json(409, splitArchive());
        else if (writing || adopting || personWriting || (holder && !(holder.pid === process.pid && holder.host === os.hostname()))) json(503, { ...refusal("the research is being written: ask again in a while", "research.busy"), retry: 5 }, 5);
        else json(200, splitPreview(tree, q.get("all") === "1"));
      } else if (what === "surnames" && !sub) {
        // the forms of a surname: suggested from the records, decided by the person — never while the research is written
        const json = (code: number, body: unknown, retry?: number) => res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...(retry ? { "Retry-After": String(retry) } : {}) }).end(JSON.stringify(body));
        const holder = liveHolder(path.join(root, ".strom", "tree.lock"));
        if (writing || adopting || personWriting || (holder && !(holder.pid === process.pid && holder.host === os.hostname()))) json(503, { ...refusal("the research is being written: ask again in a while", "research.busy"), retry: 5 }, 5);
        else json(200, suggestSurnames(Tree.open(root, env)));
      } else if (what === "places" && !sub) {
        // the places of the facts, their records and the queue: read in an archive too, and in a research waiting for its
        // agent — never while the research is written
        const holder = liveHolder(path.join(root, ".strom", "tree.lock"));
        if (writing || adopting || personWriting || (holder && !(holder.pid === process.pid && holder.host === os.hostname())))
          res.writeHead(503, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Retry-After": "5" }).end(JSON.stringify({ ...refusal("the research is being written: ask again in a while", "research.busy"), retry: 5 }));
        else res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(placesView(Tree.open(root, env))));
      } else if (what === "directions" && sub === "people" && !act) {
        // who is in which line: none in an archive or a research waiting for its agent (it shows no lines)
        const tree = Tree.open(root, env);
        // …and every person's places among the lines by the rule of the queue (core/offline.ts personPlaces): the same the
        // Strom file says (_STROM_DIRECTION), with their fingerprint
        const h = head(root);
        if (actsAsArchive(tree)) res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify({ people: {}, places: {}, lines: [], branches: [], head: h }));
        else {
          const all = scopes(tree);
          const d = directionsOf(tree, all);
          const rev = directionsRev(d);
          if (h) directionsRevs.set(root, { head: h, rev });
          res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify({ people: directionPeople(tree, all), places: placesJson(d.places), lines: d.lines, branches: d.branches, rev, head: h }));
        }
      } else if (what === "offline" && sub && !act) {
        // one branch off the lines and all its open tasks (also those not taken): never in an archive, never while written
        const json = (code: number, body: unknown, retry?: number) => res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...(retry ? { "Retry-After": String(retry) } : {}) }).end(JSON.stringify(body));
        const holder = liveHolder(path.join(root, ".strom", "tree.lock"));
        const tree = Tree.open(root, env);
        const key = branchKey(decoded(sub));
        if (writing || adopting || personWriting || (holder && !(holder.pid === process.pid && holder.host === os.hostname()))) json(503, { ...refusal("the research is being written: ask again in a while", "research.busy"), retry: 5 }, 5);
        else if (actsAsArchive(tree)) json(409, directionsArchive(tree).body);
        else {
          const b = key ? branchNow(tree, new Settings(env, {}), key) : undefined;
          if (!b) json(404, noBranch(key ?? decoded(sub).slice(0, 40)).body);
          else json(200, { branch: b.json, tasks: b.view.tasks.map((x) => ({ id: x.id, text: humanTask(tree, x.what, tree.lang), ...(b.pos.has(x.id) ? { pos: b.pos.get(x.id) } : {}), ...personOf(x), ...(x.queueAt ? { own: x.queueAt.do } : {}) })) });
        }
      } else if (what === "queue" && !sub) {
        // a page of the whole queue, of a branch or a line (feature queue.page): never while the research is written;
        // an archive's is empty
        const json = (code: number, body: unknown, retry?: number) => res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...(retry ? { "Retry-After": String(retry) } : {}) }).end(JSON.stringify(body));
        const holder = liveHolder(path.join(root, ".strom", "tree.lock"));
        const ask = queueAsk(new URLSearchParams((req.url ?? "").split("?")[1] ?? ""));
        if ("bad" in ask) json(400, refusal(ask.bad, "queue.query"));
        else if (writing || adopting || personWriting || (holder && !(holder.pid === process.pid && holder.host === os.hostname()))) json(503, { ...refusal("the research is being written: ask again in a while", "research.busy"), retry: 5 }, 5);
        else {
          const h = head(root);
          json(200, { ...queuePage(Tree.open(root, env), new Settings(env, {}), ask, h), head: h });
        }
      } else if (what === "quality" && !sub) {
        // what the person marked no error: read in an archive too
        const tree = Tree.open(root, env);
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify({ rev: qualityRev(tree), dismissed: readDismissed(tree).dismissed }));
      } else if (what === "health" && !act) {
        // the tree check (spec 091, feature health): its reports, one with its findings, the built-in part now — read in
        // an archive too, never while the research is written
        const json = (code: number, body: unknown, retry?: number) => res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...(retry ? { "Retry-After": String(retry) } : {}) }).end(JSON.stringify(body));
        const holder = liveHolder(path.join(root, ".strom", "tree.lock"));
        if (writing || adopting || personWriting || (holder && !(holder.pid === process.pid && holder.host === os.hostname()))) json(503, { ...refusal("the research is being written: ask again in a while", "research.busy"), retry: 5 }, 5);
        else if (sub === "builtin") giveHealthBuiltin(req, res, new URLSearchParams((req.url ?? "").split("?")[1] ?? "").get("scope") ?? undefined);
        else {
          const tree = Tree.open(root, env);
          const decisions = decisionsOf(tree);
          // an archive: the built-in reports alone (it says nothing of an agent or the AI)
          const archive = actsAsArchive(tree);
          if (!sub) json(200, { rev: healthRev(tree), reports: listReports(tree, archive ? Infinity : undefined).filter((r) => !archive || !r.ai.length).slice(0, REPORTS_LISTED).map((r) => runInfo(tree, r, { decisions })) });
          else {
            const id = decoded(sub).toUpperCase();
            const found = isReportId(id) ? readReport(tree, id) : undefined;
            const r = found && (!archive || !found.ai.length) ? found : undefined;
            if (!r) json(404, refusal(`no report ${id.slice(0, 12)} of the tree check`, "health.unknown", { id: id.slice(0, 12) }));
            else json(200, { report: runInfo(tree, r, { builtin: true, decisions }), findings: (r.findings ?? []).map((f) => findingView(tree, r, f, decisions)) });
          }
        }
      } else if (what === "houses" && (!sub || !act)) {
        // the research's houses (spec 030 §4.2, feature house): the list, or one house whole by its key (| as %7C) or A…
        // — read in an archive too, never while the research is written
        const json = (code: number, body: unknown, retry?: number) => res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...(retry ? { "Retry-After": String(retry) } : {}) }).end(JSON.stringify(body));
        const holder = liveHolder(path.join(root, ".strom", "tree.lock"));
        if (writing || adopting || personWriting || (holder && !(holder.pid === process.pid && holder.host === os.hostname()))) json(503, { ...refusal("the research is being written: ask again in a while", "research.busy"), retry: 5 }, 5);
        else {
          const tree = Tree.open(root, env);
          const all = houseRows(tree);
          const rev = housesRev(tree, all);
          // an archive: its houses, never a state of a research or a task (nobody researches there)
          const rows = actsAsArchive(tree) ? all.map(archiveRow) : all;
          if (!sub) json(200, { rev, houses: researchHouses(rows).map(listRow) });
          else {
            const ref = decoded(sub);
            let row;
            try {
              row = ref ? houseByRef(tree, ref, rows) : undefined;
            } catch {
              row = undefined;
            }
            if (!row) json(404, refusal(`no house "${ref.slice(0, 80)}" in this research`, "house.unknown"));
            else json(200, { ...houseView(tree, row), rev });
          }
        }
      } else if (what === "fixes" && !sub) {
        // strom's fixes of this research, as strom fixes finds them: free, nothing written — set right or put back only
        // by the person, in the terminal the link fixes opens; never while the research is written
        const holder = liveHolder(path.join(root, ".strom", "tree.lock"));
        if (writing || adopting || personWriting || (holder && !(holder.pid === process.pid && holder.host === os.hostname())))
          res.writeHead(503, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Retry-After": "5" }).end(JSON.stringify({ ...refusal("the research is being written: ask again in a while", "research.busy"), retry: 5 }));
        else giveFixes(req, res);
      } else if (what === "waiting" && sub && act === "preview" && !rest && /^W-S-/iu.test(decoded(sub))) {
        // what the answer "from a family tree" changes of a send asked about (strom sync as-import's preview): read only,
        // from the history — never while the research is written
        const holder = liveHolder(path.join(root, ".strom", "tree.lock"));
        if (writing || adopting || personWriting || (holder && !(holder.pid === process.pid && holder.host === os.hostname())))
          res.writeHead(503, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Retry-After": "5" }).end(JSON.stringify({ ...refusal("the research is being written: ask again in a while", "research.busy"), retry: 5 }));
        else {
          const got = importPreview(decoded(sub));
          res.writeHead(got.code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(got.body));
        }
      } else if (what === "waiting" && sub && act === "fix" && !rest) {
        // how a waiting task's wait is written, checked now, and the fix strom proposes (feature tasks.audit): read only
        const got = auditPreview(decoded(sub));
        res.writeHead(got.code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(got.body));
      } else if (what === "group" && act === "note") {
        // the request texts of one place, for one e-mail: read only
        const got = groupNote(decoded(sub));
        res.writeHead(got.code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(got.body));
      } else if (what === "status" && !sub) {
        // made on its thread, kept for the state of the research (core/livestatus.ts); parts=1: without the parts that
        // weigh, their revs instead (feature status.parts: the app asks a part only when its rev changed)
        const lite = new URLSearchParams((req.url ?? "").split("?")[1] ?? "").get("parts") === "1";
        statusVersion = version;
        keeper.get(version).then(
          // the runs (spec 126): read now, never kept with what was made (a run's step changes every few seconds)
          (made) => res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(withHandoffs(lite ? made.lite : made.full, handoffsNow(root), made.runs ? runsLive(root, () => new Settings(env, {}).agent(Tree.open(root, env).config).value) : undefined)),
          (e) => failed(req, res, e),
        );
      } else if (what === "status" && sub && !act) {
        // one part of /status that weighs (feature status.parts): {part, rev, head, …its fields as /status carries them}
        const part = decoded(sub);
        if (!isStatusPart(part)) res.writeHead(404, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(refusal(`no such part of /status: ${Object.keys(STATUS_PARTS).join(", ")}`, "status.part")));
        else
          keeper.get(version).then(
            (made) => res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(made.parts[part].text),
            (e) => failed(req, res, e),
          );
      } else if (what === "whats-new") {
        // what is new in this strom, from the changelog shipped with it (the app's window "What's new")
        const lang = new URLSearchParams((req.url ?? "").split("?")[1] ?? "").get("lang");
        const text = JSON.stringify(whatsNew(VERSION, lang, updateChannel(env)));
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(text);
      } else if (what === "recent") {
        // what another window of hours added (the same as /status recent); worked out now, the bridge answers others meanwhile
        const said = new URLSearchParams((req.url ?? "").split("?")[1] ?? "").get("hours");
        const hours = said === null ? RECENT_HOURS : /^\d{1,3}$/.test(said) ? Number(said) : NaN;
        const json = (code: number, body: unknown) => res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(body));
        if (!(hours >= 1 && hours <= 168)) json(400, { error: "?hours=1…168 (24 when not given)" });
        else
          recentChanges(root, env, hours).then(
            (r) => (r ? json(200, r) : json(404, { error: "the research has no commit yet" })),
            (e) => failed(req, res, e),
          );
      } else if (what === "finds" && !sub) {
        // what the research found since the person last looked (the app's screen Research, feature finds): the phone's
        // page's Finds, a fact said in the language asked; kept for the head and the window (asked again: nothing read).
        // An archive, a research waiting for its agent: none, as on the phone's page
        const q = new URLSearchParams((req.url ?? "").split("?")[1] ?? "");
        const text = JSON.stringify(findsForApp(treeFinds(root, env, q.get("since") ?? undefined, Date.now(), q.get("lang") ?? undefined)));
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(text);
      } else if (what === "glance" && !sub) {
        // the screen Research of the app on a device before it has the tree (spec 094 K3.13, feature glance; core/glance.ts):
        // made of what /status made for the state now, kept for it; the runs read at each ask, as /status reads them
        keeper.get(version).then(
          async (made) => {
            const lite = JSON.parse(made.lite) as Record<string, unknown>;
            // what was made for this version of the app (another version's /status may say otherwise: the hypotheses)
            const kept = glanceKept.get(version ?? "");
            // the last 24 hours not worked out for /status at this head yet (it says the last it has): now, off this
            // thread (as GET recent)
            if (!lite.locked && (lite.recent as { head?: string } | undefined)?.head !== lite.head && kept?.key !== made.key) {
              const recent = await recentChanges(root, env, RECENT_HOURS);
              if (recent) lite.recent = recent;
            }
            let g: Glance;
            if (lite.locked) g = glanceLocked(lite);
            else if (kept?.key === made.key) g = kept.glance;
            else {
              const part = (p: StatusPart, field: string): unknown[] => {
                const v = (JSON.parse(made.parts[p].text || "{}") as Record<string, unknown>)[field];
                return Array.isArray(v) ? v : [];
              };
              g = glanceOf(Tree.open(root, env), { status: lite, researches: part("researches", "researches"), waiting: part("waiting", "waiting") });
              glanceKept.set(version ?? "", { key: made.key, glance: g });
            }
            const runs = made.runs ? runsLive(root, () => new Settings(env, {}).agent(Tree.open(root, env).config).value).runs : [];
            // the size of the tree's file as last made (made after the glance was: read at each ask, two or three stamps)
            const ged = lite.locked ? undefined : await gedSizeKnown(root);
            if (ged) g = { ...g, tree: { ...g.tree, ged } };
            // what waits for the person at the computer (spec 094 K3.15): read at each ask, as the runs
            const asking = lite.locked ? [] : askingNow(root, runs.map((r) => r.id));
            if (!req.destroyed) res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(withAsking(withRuns(g, runs), asking)));
          },
        ).catch((e) => failed(req, res, e));
      } else if (what === "people" && !sub) {
        // a person searched for by the name (spec 094 D1, feature people.search): at most 8 {id, name, span?, place?}
        const q = new URLSearchParams((req.url ?? "").split("?")[1] ?? "").get("q") ?? "";
        const people = peopleFound(Tree.open(root, env), q, forPhone).map(({ birth: _b, death: _d, ...p }) => ({ ...p, name: forPhone(p.name) || p.id }));
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify({ people }));
      } else if (what === "log") {
        // on the thread of /status: git asked of the commits it does not know (a hundred at first: a second), each read
        // as the app reads it (every session, each name and task: a second on a large research, at each change)
        const h = head(root);
        const answer = (text: string) => {
          if (!req.destroyed) res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(text);
        };
        if (log?.head === h) answer(log.text);
        else logs.ask(h).then(answer, (e) => failed(req, res, e));
      } else if (what === "tree.ged" || what === "images.ged") {
        // the images by reference (?images=ref, feature ged.imagesByHash), else in the file as always
        const images = imagesAsked(req);
        // the files of the app's tree with it (?media=app, feature media.app), else the file as before
        const media = mediaAsked(req);
        gedFollow = { version, images, ...(media ? { media } : {}) };
        // the app has the tree of the head now (its ETag, feature ged.etag): 304 at once, nothing made
        if (gedUnchanged(req, res, version, images, media)) return;
        // the last one made at once, the new one told by an event (feature ged.stale)
        if (new URLSearchParams((req.url ?? "").split("?")[1] ?? "").get("stale") === "1") giveStale(req, res, version, images, media).catch((e) => failed(req, res, e));
        // made when the commits stop coming (an agent's commands one after another): once for them all
        else afterQuiet(() => giveGed(req, res, version, images, media).catch((e) => failed(req, res, e)));
      } else if (what === "image" && sub && !act) {
        giveImage(req, res, decoded(sub).toLowerCase()).catch((e) => failed(req, res, e));
      } else if (what === "events") {
        statusVersion = version;
        keeper.get(version).then(
          (made) => {
            if (req.destroyed) return;
            res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store", Connection: "keep-alive" });
            res.write(`event: hello\ndata: ${made.full}\n\n`);
            streams.add(res);
            req.on("close", () => streams.delete(res));
            res.on("error", () => streams.delete(res));
          },
          (e) => failed(req, res, e),
        );
      } else res.writeHead(404).end();
    } catch (e) {
      failed(req, res, e);
    }
  };

  // What the app sends is written at once (an archive; a research unless the user reviews each send, sync.review on):
  // by a strom of its own (strom sync <file> --apply), so the bridge answers meanwhile; one at a time — a send that
  // comes while one is written waits in the inbox, and every one that waits is written in its turn, the oldest first
  // (one of each tree of the app: a newer send of the same tree replaces the one that waits). The research busy (another
  // strom holding it longer than a writer waits): the send is tried again a while later, not left waiting for ever.
  let writing: string | undefined;
  let retryAt: ReturnType<typeof setTimeout> | undefined;
  /** Where a send's time went (ms), for its one line in live.log: no names, no data — its mark, sizes and times. */
  interface SendClock {
    from: number;
    intake?: string;
    bytes?: number;
    body?: number;
    decode?: number;
    undone?: number;
    got?: ReceiveTimes;
    /** Its writer's run (ms), and the phases it said (strom sync --json). */
    child?: number;
    phases?: Record<string, number>;
    plans?: number;
    planParts?: PlanTimes;
    answer?: { code: number; at: number };
    /** What it carries of its files (spec 133): by reference, excerpts without FILE, with data. */
    media?: Omit<MediaRefCheck, "unknown">;
    writing?: boolean;
    said?: boolean;
  }
  const secs = (ms: number | undefined) => (!ms ? "0 s" : ms < 1000 ? `${(ms / 1000).toFixed(2)} s` : `${(ms / 1000).toFixed(1)} s`);
  const parts = (p: PlanTimes | undefined) =>
    p && Object.keys(p).length ? ` (${(["ours", "given", "since", "after", "mend", "rest"] as const).filter((k) => p[k] !== undefined).map((k) => `${k} ${secs(p[k])}`).join(", ")})` : "";
  const noteSend = (c: SendClock) => {
    if (c.said || c.writing) return;
    c.said = true;
    const at = [
      c.body !== undefined ? `body ${secs(c.body)}` : undefined,
      c.decode !== undefined ? `decode ${secs(c.decode)}` : undefined,
      c.undone !== undefined ? `undone ${secs(c.undone)}` : undefined,
      c.got?.ids !== undefined ? `known ids+file ${secs(c.got.ids)}` : undefined,
      c.got?.plan !== undefined ? `plan ${secs(c.got.plan)}${parts(c.got.planParts)}` : undefined,
      c.child !== undefined
        ? `writer ${secs(c.child)}${c.phases ? ` (read ${secs(c.phases.read)}, plan ${secs(c.phases.plan)}${parts(c.planParts)}, plans ${c.plans ?? 0}, lock ${secs(c.phases.lock)}, apply ${secs(c.phases.apply)}, settle ${secs(c.phases.settle)})` : ""}`
        : undefined,
      c.media ? `files by reference ${c.media.dataRefs}, excerpts without FILE ${c.media.excerptsWithoutFile}, with data ${c.media.withData}` : undefined,
      c.answer ? `answered ${c.answer.code} at ${secs(c.answer.at)}` : "answered before",
    ].filter(Boolean);
    noteLive(root, `send ${c.intake ?? c.got?.intake ?? "?"}${c.bytes !== undefined ? ` ${(c.bytes / 1e6).toFixed(1)} MB` : ""}: ${at.join(", ")}`);
  };
  /** The reply of a send, timed: its line said at the answer — or once its writer is done, while one writes it. */
  const timedReply = (c: SendClock, reply: (code: number, body: Record<string, unknown>) => void) => (code: number, body: Record<string, unknown>) => {
    c.answer = { code, at: performance.now() - c.from };
    reply(code, body);
    noteSend(c);
  };
  const WRITE_ANSWER_MS = Number(env.STROM_SYNC_ANSWER_MS ?? 20_000);
  const RETRY_MS = Number(env.STROM_SYNC_RETRY_MS ?? 30_000);
  const RETRIES = 5;
  const writesAtOnce = () => {
    try {
      const tree = Tree.open(root, env);
      return actsAsArchive(tree) || !new Settings(env, {}).syncReview(tree.config);
    } catch {
      return false;
    }
  };
  /** The next send that waits to be written: the oldest. */
  const writeNext = () => {
    if (writing || !writesAtOnce()) return;
    const next = receivedPending(root).at(-1);
    if (next)
      write({ file: path.join(root, SYNC_INBOX, next.file), changes: next.changes, intake: next.intake, ...(next.counting ? { counting: true as const } : {}), clock: { from: performance.now(), intake: next.intake } }, () => {});
  };
  /**
   * A send written by a strom of its own. One the bridge left to it to count (`counting`: planned once, there — never
   * here as well): the app waits for the answer until that strom says how many changes it brings, from then on at most
   * WRITE_ANSWER_MS; one it refuses as it reads it is refused as the bridge refuses one (400, the file kept aside).
   */
  const write = (sent: { file: string; changes: number; intake: string; counting?: true; clock?: SendClock }, reply: (code: number, body: Record<string, unknown>) => void) => {
    // its count, once known (a send counted by the bridge: known from the start)
    let count: number | undefined = sent.counting ? undefined : sent.changes;
    const pendingBody = (extra: Record<string, unknown> = {}) => ({ ok: true, inbox: false, pending: true, ...extra, ...(count !== undefined ? { changes: count } : {}), intake: sent.intake });
    if (writing) {
      reply(202, pendingBody());
      return;
    }
    writing = sent.intake;
    const clock = sent.clock ?? { from: performance.now(), intake: sent.intake };
    clock.writing = true;
    const started = performance.now();
    const { command, args } = stromLauncher();
    const child = spawn(command, [...args, "sync", sent.file, "--apply", "--json"], {
      cwd: root,
      env: { ...forApp(env, root), STROM_SYNC_TELL: "1" },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    track(child);
    let out = "";
    let err = "";
    let reading = false;
    let answered = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const wait = () => {
      timer = setTimeout(() => {
        answered = true;
        reply(202, pendingBody());
      }, WRITE_ANSWER_MS);
    };
    if (count !== undefined) wait();
    child.stdout.on("data", (d: Buffer) => (out += d.toString("utf8")));
    child.stderr.on("data", (d: Buffer) => {
      err += d.toString("utf8");
      if (count !== undefined && reading) return;
      for (const line of err.split("\n")) {
        if (line === "strom-sync: reading") reading = true;
        const n = /^strom-sync: planned (\d+)$/.exec(line);
        if (n && count === undefined) {
          count = Number(n[1]);
          // counted: the app waits no longer than any send's answer waits; nothing new: answered once settled
          if (count > 0) wait();
        }
      }
    });
    child.on("error", (e) => noteLive(root, `a send could not be written: ${errorText(e)}`));
    child.on("close", (code) => {
      clearTimeout(timer);
      clock.child = performance.now() - started;
      let data: { input?: string | null; changes?: Change[]; message?: string; code?: string; params?: Record<string, string>; skipped?: Skipped[]; applied?: { do: string; id: string; before?: unknown }[]; media?: MediaWritten[]; retracted?: string[]; phases?: Record<string, number>; plans?: number; planParts?: PlanTimes } = {};
      try {
        data = JSON.parse(out) as typeof data;
      } catch {
        // said by the exit code
      }
      if (data.phases) Object.assign(clock, { phases: data.phases, plans: data.plans, planParts: data.planParts });
      const why = data.message ?? err.trim().split("\n").find((l) => l.startsWith("error:"))?.slice(6).trim() ?? "the send was not written";
      // the research busy: tried again a while later (the app keeps following it as pending)
      const busy = code === EXIT.locked;
      const done = () => {
        clock.writing = false;
        noteSend(clock);
        writing = undefined;
        // the next that waits; the research busy: a while later
        if (busy) {
          clearTimeout(retryAt);
          retryAt = setTimeout(writeNext, RETRY_MS);
          retryAt.unref?.();
        } else writeNext();
      };
      if (code === 0 && count === undefined) count = data.changes?.length ?? 0;
      // refused as it was read, before it was counted (another research's, without the research's IDs, empty…): as the
      // bridge refuses a send it counts itself — no record of it left, the file kept aside, the app told why
      if (sent.counting && count === undefined && reading && code !== null && code !== 0 && !busy) {
        let keptAs: string | undefined;
        try {
          keptAs = refuseReceived(root, sent.intake);
        } catch (e) {
          noteLive(root, `the send ${sent.intake} refused was not kept aside: ${errorText(e)}`);
        }
        noteLive(root, `the send ${sent.intake} was refused (${data.code ?? `exit ${code}`})`);
        if (!answered) {
          let lang = "en";
          try {
            lang = Tree.open(root, env).lang;
          } catch {
            // said in English
          }
          const key = data.code ? REFUSED[data.code] : undefined;
          if (data.code === DISK_FULL || isDiskFull(why)) reply(507, { ...diskFullSaid(lang, root), ...(keptAs ? { keptAs } : {}) });
          else reply(400, { ...(key ? said(lang, key) : { error: why, code: "tree.refused", text: why }), ...(keptAs ? { keptAs } : {}) });
        }
        return done();
      }
      // counted by its writer, nothing new: answered as a send that brings nothing (nothing waits, nothing written)
      if (sent.counting && code === 0 && count === 0) {
        noteLive(root, `the send ${sent.intake} brought nothing new${data.input ? ` (the same as ${data.input})` : ""}`);
        if (!answered) reply(200, { ok: true, changes: 0, file: path.basename(sent.file), inbox: false, head: head(root), conflicts: [], intake: sent.intake });
        return done();
      }
      if (code !== 0) noteLive(root, `the send ${sent.intake} was not written (exit ${code}${busy ? ", the research busy: tried again later" : ""}): ${why}`);
      // the same file as a sync before (sent again unchanged): nothing new, the input it was then only named
      else noteLive(root, `the send ${sent.intake} ${data.input && data.changes?.length ? `written: ${data.input}` : `brought nothing new${data.input ? ` (the same as ${data.input})` : ""}`}${data.skipped?.length ? `, ${counted(data.skipped.length, "change")} left out` : ""}`);
      if (code !== 0) {
        const r = failReceived(root, sent.intake, why, busy, { code: data.code, params: data.params });
        if (busy && r && (r.tries ?? 0) >= RETRIES) failReceived(root, sent.intake, `the research was busy ${RETRIES} times: ${why}`, false);
      }
      if (!answered) {
        if (code === 0) {
          // the conflicts it opened: the app says the user has something to decide, and whose
          let conflicts: ReturnType<typeof syncConflicts> = [];
          try {
            if (data.input) conflicts = syncConflicts(Tree.open(root, env), data.input);
          } catch {
            // the app finds them in /status.sends
          }
          const changes = data.changes ?? [];
          reply(200, {
            ok: true,
            inbox: false,
            changes: count ?? sent.changes,
            applied: changes.filter((c) => c.action !== "pick" && c.action !== "report").length - (data.skipped?.length ?? 0),
            // the people and sources it brought, under the IDs the research gave them (the app's xref → P…, S…): the app
            // keeps them as their REFN, its next send names them so (as an adoption's answer does)
            ...idsOf(data.applied ?? [], receivedAll(root).find((r) => r.intake === sent.intake)?.known),
            ...(changes.some((c) => c.kept) ? { kept: changes.filter((c) => c.kept).length } : {}),
            // what sends taken back since the copy was made brought: left out, not written again
            ...(changes.some((c) => c.takenBack) ? { takenBack: changes.filter((c) => c.takenBack).length } : {}),
            // every change not written, and why (never a silent nothing): taken back since, kept for a window that never
            // had it, only said (no longer in the file: the research never deletes), the user to pick (no state given) —
            // with the sources the user gave it that went unwritten with it (`cites`: the file's own keys, as `ids` has them)
            // each with its stable code and params (spec 095 K3.4), the app says it in its language by them
            ...(changes.some((c) => c.action === "report" || c.action === "pick") ? { notWritten: notWrittenList(changes) } : {}),
            // the changes the research could not write (the rest is written): what and why
            ...(data.skipped?.length ? { skipped: data.skipped } : {}),
            // the app's files it wrote (spec 108): each change with the place it is of and the record the file is (I…)
            ...(data.media?.length ? { media: data.media } : {}),
            // the research's sources the person deleted in the app, deleted with the send (spec 117 K1.4)
            ...(data.retracted?.length ? { retracted: data.retracted } : {}),
            // the sources that said they are an entry of a reading of a document (_STROM_READING): taken as the
            // research's reading, or not (why: a stable code) and so the app's own source as any
            ...(changes.some((c) => c.reading)
              ? { readings: changes.filter((c) => c.reading).map((c) => ({ source: c.source!.startsWith("x:") ? `@${c.source!.slice(2)}@` : c.source!, read: c.reading!.id, ok: c.reading!.ok, ...(c.reading!.entry ? { entry: c.reading!.entry } : {}), ...(c.reading!.code ? { code: c.reading!.code } : {}), ...(c.reading!.edited ? { edited: true } : {}) })) }
              : {}),
            head: head(root),
            ...(data.input ? { input: data.input } : {}),
            conflicts,
            intake: sent.intake,
          });
        } else if (busy) reply(202, pendingBody({ retry: Math.round(RETRY_MS / 1000) }));
        // a sentence the app shows as it is (3.8 shows "error" of a refusal), what went wrong beside it
        else {
          let lang = "en";
          try {
            lang = Tree.open(root, env).lang;
          } catch {
            // said in English
          }
          // why, as a program reads it too (a change the research cannot write: its people and families by name)
          let reasonNames: Record<string, string> | undefined;
          try {
            if (data.params) reasonNames = namesOf(Tree.open(root, env), data.params);
          } catch {
            // the IDs only
          }
          // sealed on another computer since it was asked (its key gone meanwhile): said as the bridge says it before
          if (data.code === SEAL_FOREIGN) reply(409, { ...sealRefusal(), intake: sent.intake });
          // sealed here with two keys of this computer (an app packaged for Windows and a terminal): united in a terminal
          else if (data.code === "seal.other-key") reply(409, { ...said(lang, "ui.seal.bridge.twokeys", { name: String(data.params?.name ?? ""), set: "strom seal adopt" }), intake: sent.intake });
          // no room on the disk: said as everywhere (507 disk.full), never the system's words with strom's inner path
          else if (data.code === DISK_FULL || isDiskFull(why)) reply(507, { ...diskFullSaid(lang, fullWhere(data, root)), reason: why, intake: sent.intake });
          else reply(500, { ...said(lang, "ui.sync.bridge.failed"), reason: why, ...(data.code ? { reasonCode: data.code } : {}), ...(data.params ? { reasonParams: data.params, reasonNames } : {}), intake: sent.intake });
        }
      }
      done();
    });
  };

  /**
   * The app's tree for a new research (POST /adopt), taken in here — by a strom of its own (strom sync --apply
   * --force: as the app's trees are, its sources the research's), whether or not the research in the terminal still
   * waits: adopted only once it is in. The app hears the head with it, or why not (a sentence; what went wrong in the
   * log and for the terminal); longer than the app waits: 202, adopted when it is in.
   */
  let adopting = false;
  const ADOPT_ANSWER_MS = Number(env.STROM_ADOPT_ANSWER_MS ?? 90_000);
  const adopt = (file: string, reply: (code: number, body: Record<string, unknown>) => void, lang: string, app: string | undefined) => {
    const tree = Tree.open(root, env).config.id;
    // no people yet (C1: installed from the app's start screen): handed over with nothing to take in — the research
    // stays empty, linked to the app, and the people the app adds later come by its sends (adopt.empty)
    if (adoptedEmpty(fs.readFileSync(file, "utf8"))) {
      try {
        markAdopted(root, undefined, app);
      } catch (e) {
        noteLive(root, `the app's tree was not taken in: ${errorText(e)}`);
        reply(500, { ...said(lang, "ui.sync.bridge.adopt"), reason: errorText(e) });
        return;
      }
      noteLive(root, "the app's tree taken in: no people in it yet");
      reply(200, { tree, head: head(root) ?? "", empty: true, ids: { persons: {}, sources: {} } });
      return;
    }
    adopting = true;
    const { command, args } = stromLauncher();
    const child = spawn(command, [...args, "sync", file, "--apply", "--force", "--json"], {
      cwd: root,
      env: forApp(env, root),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    track(child);
    let out = "";
    let err = "";
    child.stdout.on("data", (d: Buffer) => (out += d.toString("utf8")));
    child.stderr.on("data", (d: Buffer) => (err += d.toString("utf8")));
    let answered = false;
    const timer = setTimeout(() => {
      answered = true;
      reply(202, { tree, pending: true });
    }, ADOPT_ANSWER_MS);
    const failed = (why: string, full = false) => {
      noteLive(root, `the app's tree was not taken in: ${why}`);
      noteAdoptFailed(root, "other", why);
      if (!answered) reply(full ? 507 : 500, full ? { ...diskFullSaid(lang, root), reason: why } : { ...said(lang, "ui.sync.bridge.adopt"), reason: why });
    };
    let gone = false;
    child.on("error", (e) => {
      clearTimeout(timer);
      adopting = false;
      gone = true;
      failed(errorText(e));
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      adopting = false;
      if (gone) return; // the error said it
      // ended by a signal (killed, the system short of memory): said, never left without a word
      if (code === null) return failed(`its strom ended (${signal ?? "a signal"})`);
      let data: { input?: string | null; message?: string; code?: string; applied?: { do: string; id: string; before?: string }[] } = {};
      try {
        data = JSON.parse(out) as typeof data;
      } catch {
        // said by the exit code
      }
      if (code !== 0) {
        const why = data.message ?? err.trim().split("\n").find((l) => l.startsWith("error:"))?.slice(6).trim() ?? `exit ${code}`;
        return failed(why, data.code === DISK_FULL || isDiskFull(why));
      }
      try {
        markAdopted(root, data.input ?? undefined, app);
      } catch (e) {
        return failed(errorText(e));
      }
      noteLive(root, `the app's tree taken in${data.input ? ` (${data.input})` : ""}`);
      // what each of the app's people and sources is in the research (its xref → P…, S…): the app keeps them as their
      // REFN, so its next send is the research's people by their IDs (found on Windows: one renamed came as a new one)
      const ids = (kind: string) =>
        Object.fromEntries((data.applied ?? []).filter((a) => a.do === kind && a.before?.startsWith("x:")).map((a) => [`@${a.before!.slice(2)}@`, a.id]));
      if (!answered) reply(200, { tree, head: head(root) ?? "", ...(data.input ? { input: data.input } : {}), ids: { persons: ids("person.add"), sources: ids("source.add") } });
    });
  };

  /**
   * A tree of the app taken: written at once (or waiting in the inbox, sync.review on). Sends taken back after the state
   * it was sent from are said (`undoneSince`): the copy still carries what the research took back — the app loads the
   * research, or sends one of them again (POST /sync/<R…>/again; found on Windows: sent again after an undo, nothing
   * new, the app and the research apart without a word).
   */
  const take = (text: string, reply: (code: number, body: Record<string, unknown>) => void, again?: string, mediaApp?: boolean, clock?: SendClock) => {
    const undoneFrom = performance.now();
    const since = undoneSince(root, text);
    if (clock) clock.undone = performance.now() - undoneFrom;
    const told = (code: number, body: Record<string, unknown>) => reply(code, since.length && code < 400 ? { ...body, undoneSince: since } : body);
    // written at once, nothing being written: counted by the strom that writes it, as it plans it (once, there)
    const counts = !writing && writesAtOnce();
    const times: ReceiveTimes = {};
    if (clock) clock.got = times;
    const got = receiveTree(root, env, text, { ...(writing ? { keep: writing } : {}), ...(again ? { again } : {}), ...(mediaApp ? { mediaApp } : {}), ...(counts ? { plan: false } : {}), times });
    if (clock) clock.intake = got.intake;
    if (got.counting) {
      write({ ...got, ...(clock ? { clock } : {}) }, told);
      return;
    }
    const tree = Tree.open(root, env);
    // nothing new: nothing waits, nothing written
    if (!got.changes) {
      told(200, { ok: true, changes: 0, file: path.basename(got.file), inbox: false, head: head(root), conflicts: [], intake: got.intake });
      return;
    }
    if (actsAsArchive(tree) || !new Settings(env, {}).syncReview(tree.config)) {
      write({ ...got, ...(clock ? { clock } : {}) }, told);
      return;
    }
    told(200, { ok: true, changes: got.changes, file: path.basename(got.file), inbox: true, intake: got.intake });
  };

  /** A send taken back (strom sync undo), sent again by the app: its file as it came, from the state it was sent from. */
  const again = (req: http.IncomingMessage, res: http.ServerResponse, origin: string | undefined, intake: string) => {
    const reply = (code: number, body: Record<string, unknown>) => {
      if (!res.headersSent) res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(body));
    };
    const clock: SendClock = { from: performance.now() };
    const answer = timedReply(clock, reply);
    req.resume();
    if (!origin) return reply(403, refusal("only the Strom app may send a tree here", "app.only"));
    const text = undoneSend(root, intake);
    if (!text) return reply(404, { error: `no send ${intake.slice(0, 64)} taken back is kept here`, code: "send.none", intake });
    // what the app said of the send's files then (media=app) holds for it again
    const mediaApp = !!receivedAll(root).find((r) => r.intake === intake)?.mediaApp;
    clock.bytes = Buffer.byteLength(text);
    safely(req, res, () => {
      try {
        take(
          text,
          (code, body) => {
            if (code < 400 && typeof body.intake === "string") markSentAgain(root, intake, body.intake);
            answer(code, body);
          },
          intake,
          mediaApp,
          clock,
        );
      } catch (e) {
        const m = (e as Error).message;
        const code = e instanceof StromError ? e.code : undefined;
        const key = code ? REFUSED[code] : undefined;
        let lang = "en";
        try {
          lang = Tree.open(root, env).lang;
        } catch {
          // said in English
        }
        if (isDiskFull(e)) return answer(507, diskFullSaid(lang, root));
        answer(400, key ? said(lang, key) : { error: m, code: "tree.refused", text: m });
      }
    });
  };

  /** The user's tree from the app: only from its pages, only so large; the answer in the research's language. */
  const receive = (req: http.IncomingMessage, res: http.ServerResponse, origin: string | undefined, as: "sync" | "adopt" = "sync") => {
    // the app says the send carries every file of its tree (spec 108 P4): a place it no longer has may be taken off
    const mediaApp = new URLSearchParams((req.url ?? "").split("?")[1] ?? "").get("media") === "app";
    const clock: SendClock = { from: performance.now() };
    const answer = (code: number, body: Record<string, unknown>) =>
      res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(body));
    // a tree's send timed (live.log); an adoption, a refusal before the tree came: answered as they are
    const reply = as === "sync" ? timedReply(clock, answer) : answer;
    const lang = () => {
      try {
        return Tree.open(root, env).lang;
      } catch {
        return "en";
      }
    };
    if (!origin) {
      reply(403, refusal("only the Strom app may send a tree here", "app.only"));
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    let over = false;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > SYNC_MAX_BYTES) over = true;
      else chunks.push(c);
    });
    req.on("error", (e) => noteLive(root, `a tree from the app did not come whole: ${errorText(e)}`));
    req.on("end", () => safely(req, res, () => {
      clock.body = performance.now() - clock.from;
      clock.bytes = size;
      if (over) {
        reply(413, said(lang(), "ui.sync.bridge.large"));
        return;
      }
      try {
        // the version the app says with it (its file writes none of its own): the tree is read as that app means it
        // a GEDCOM's bytes by the same rule as a file's (the app sends UTF-8: the same text), the app's JSON as UTF-8
        const decodeFrom = performance.now();
        const body = Buffer.concat(chunks);
        const stamped = stampAppVersion(looksLikeGedcom(body) ? decodeGedcom(body).text : body.toString("utf8"), saidAppVersion(req));
        // a send of a device of the home network (its gateway names it, devices.mode on): as that device's, whatever it
        // says of itself (spec 094 K2.2)
        const device = as === "sync" ? clientOfDevice(env, req.headers["x-strom-device"]) : undefined;
        const text = device ? withSendClient(stamped, device) : stamped;
        clock.decode = performance.now() - decodeFrom;
        if (as === "sync") {
          // files by reference (spec 133): one the research cannot find refuses the whole send — nothing kept, no record
          const { unknown, ...counts } = checkMediaRefs(text, { tree: () => readTree(root, env), store: new Settings(env, {}).shared()?.value });
          clock.media = counts;
          if (unknown.length) {
            noteLive(root, `send refused: ${MEDIA_REF_UNKNOWN} (${unknown.length} ${unknown.length === 1 ? "file" : "files"} by reference not here)`);
            reply(409, { ok: false, code: MEDIA_REF_UNKNOWN, error: `the research does not have ${unknown.length === 1 ? "a file" : `${unknown.length} files`} the tree names by reference — send it with the files' data`, shas: unknown });
            return;
          }
        }
        if (as === "adopt") {
          if (adopting) {
            reply(409, said(lang(), "ui.sync.bridge.adopting"));
            return;
          }
          adopt(receiveAdopted(root, text, origin), reply, lang(), appVersionOf(req, new Settings(env, {})));
          return;
        }
        take(text, reply, undefined, mediaApp, clock);
      } catch (e) {
        const m = (e as Error).message;
        const code = e instanceof StromError ? e.code : undefined;
        // the new research in the terminal waits for it: told, it stops waiting
        if (as === "adopt" && pendingAdoption(root)) noteAdoptFailed(root, code === "tree.empty" ? "empty" : "other");
        const key = code ? REFUSED[code] : undefined;
        // what came, kept aside to be looked at (.strom/sync/kept/)
        const keptAs = e instanceof StromError ? (e.details as { kept?: string } | undefined)?.kept : undefined;
        // no room on the disk (found on Mac: "ENOSPC: no space left on device, mkdir …/.strom/sync" as tree.refused)
        if (isDiskFull(e)) reply(507, { ...diskFullSaid(lang(), root), ...(keptAs ? { keptAs } : {}) });
        else reply(400, { ...(key ? said(lang(), key) : { error: m, code: "tree.refused", text: m }), ...(keptAs ? { keptAs } : {}) });
      }
    }));
  };

  /**
   * An original from the app: only from its pages, only so large and while there is room; streamed to a file beside
   * the shared store (never all in memory), its SHA-256 checked, then taken by a strom of its own (strom media original),
   * which keeps it — the same content again is only said.
   */
  const original = (req: http.IncomingMessage, res: http.ServerResponse, origin: string | undefined, rawSha: string) => {
    // 503 is only "busy, send it again": always with when (Retry-After)
    const reply = (code: number, body: Record<string, unknown>) => {
      if (!res.headersSent) res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...(code === 503 ? { "Retry-After": "30" } : {}) }).end(JSON.stringify(body));
    };
    // refused before it is read: answered at once, the rest of the body read and thrown away — a connection closed
    // under a browser still sending is an error of the network to it, not the answer
    const refuse = (code: number, body: Record<string, unknown>) => {
      reply(code, body);
      req.resume();
    };
    if (!origin) return refuse(403, refusal("only the Strom app may send a file here", "app.only"));
    const sha = rawSha.toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(sha)) return refuse(400, refusal("the address names no SHA-256", "media.bad-sha"));
    const header = (n: string) => {
      const v = req.headers[n];
      return typeof v === "string" ? v : undefined;
    };
    let name: string;
    let named: string | undefined;
    let note: string | undefined;
    let meta: { persons: string[]; source?: string; families?: string[] };
    let list: string | undefined;
    let region: string | undefined;
    let batch: string | undefined;
    let where: string | undefined;
    let forTask: string | undefined;
    let image: number | undefined;
    let replace = false;
    let read = false;
    const zip = header("x-strom-zip") === "1";
    // what it is for checked on the bridge's tree to read from (written by a strom of its own)
    const tree = readTree(root, env);
    // the header read when it failed (its value not URI-encoded too): said by its name
    let at = "X-Strom-Batch";
    try {
      batch = header("x-strom-batch")?.trim();
      if (batch !== undefined && !BATCH_ID.test(batch)) throw new Error("X-Strom-Batch: the batch's mark (letters, digits, -)");
      at = "X-Strom-Zip";
      if (zip && !batch) throw new Error("X-Strom-Zip: a ZIP comes in a batch (X-Strom-Batch)");
      at = "X-Strom-Path";
      where = header("x-strom-path") ? batchPath(decodeURIComponent(header("x-strom-path")!)) : undefined;
      at = "X-Strom-Name";
      named = decodeURIComponent(header("x-strom-name") ?? "").trim() || undefined;
      name = named ?? sha.slice(0, 12);
      at = "X-Strom-Note";
      note = header("x-strom-note") ? decodeURIComponent(header("x-strom-note")!).slice(0, 500) : undefined;
      at = "X-Strom-Person";
      const persons = (header("x-strom-person") ?? "").split(",").map((p) => p.trim().toUpperCase()).filter(Boolean);
      if (persons.some((p) => !/^P\d{1,9}$/.test(p))) throw new Error("X-Strom-Person: IDs of the research's people (P…), with commas");
      at = "X-Strom-Family";
      const families = (header("x-strom-family") ?? "").split(",").map((f) => f.trim().toUpperCase()).filter(Boolean);
      if (families.some((f) => !/^F\d{1,9}$/.test(f))) throw new Error("X-Strom-Family: IDs of the research's couples (F…), with commas");
      at = "X-Strom-Source";
      const source = header("x-strom-source")?.trim().toUpperCase();
      if (source && !/^S\d{1,9}$/.test(source)) throw new Error("X-Strom-Source: the ID of a source of the research (S…)");
      at = "X-Strom-Region";
      region = header("x-strom-region")?.trim();
      parseRegion(region);
      at = "X-Strom-Task";
      const task = header("x-strom-task")?.trim();
      if (task !== undefined && !/^[Tt]\d{1,9}$/.test(task)) throw new Error("X-Strom-Task: the ID of a task of the research that waits (T…)");
      if (task && (batch || source)) throw new Error("X-Strom-Task: a file for a task comes in no batch and is no image of a source");
      forTask = task ? normId(task, "task") : undefined;
      at = "X-Strom-Image";
      const n = header("x-strom-image")?.trim();
      if (n !== undefined && (!/^\p{Nd}{1,6}$/u.test(n) || Number(n) < 1)) throw new Error("X-Strom-Image: the image's number in the book (1 or more)");
      if (n !== undefined && !task) throw new Error("X-Strom-Image: with X-Strom-Task — an image a task waits for");
      image = n !== undefined ? Number(n) : undefined;
      at = "X-Strom-Replace";
      const again = header("x-strom-replace")?.trim();
      if (again !== undefined && again !== "1") throw new Error("X-Strom-Replace: 1 — another scan at that image number replaces the one there");
      if (again && !task) throw new Error("X-Strom-Replace: with X-Strom-Task");
      replace = again === "1";
      at = "X-Strom-Read";
      const toRead = header("x-strom-read")?.trim();
      if (toRead !== undefined && toRead !== "1") throw new Error("X-Strom-Read: 1 — the file is to be read at once (POST /read)");
      if (toRead && (batch || source || task)) throw new Error("X-Strom-Read: a file to read comes in no batch, for no task and is no image of a source");
      read = toRead === "1";
      if (families.length && (source || task || batch)) throw new Error("X-Strom-Family: a couple's original comes in no batch, for no task and is no image of a source");
      at = "X-Strom-List-Ref";
      // the list of people it is sent to (spec 137, media.list): one the app put first (PUT lists/<id>)
      list = header("x-strom-list-ref")?.trim() || undefined;
      if (list !== undefined && !LIST_ID.test(list)) throw new Error("X-Strom-List-Ref: the list's mark (PUT lists/<id>)");
      // (with X-Strom-Source: a scan of a source of the list's people — media.list.source)
      if (list && (task || batch || read)) throw new Error("X-Strom-List-Ref: a file sent to a list comes in no batch, for no task and not to read");
      if (list && !readSentList(root, list)) throw new StromError(`no list ${list} sent here — send the list (PUT lists/${list}) and the file again`, { code: "media.no-list", params: { list } });
      meta = checkOriginalMeta(tree, { persons, source, families });
    } catch (e) {
      // a person or a source the research has not got: 404, its JSON body telling it from an address that is no bridge's
      const m = (e as Error).message;
      const coded = e instanceof StromError && e.code ? refusal(m, e.code, e.params ?? {}) : refusal(m, "media.bad-header", { header: at });
      return refuse(/^no (person|source|family|list)/.test(m) ? 404 : 400, coded);
    }
    // a file for a task (its "Add a file"): only for a task that waits for one — else refused before anything is kept
    // (the app offers the inbox folder then)
    if (forTask) {
      const no = fileRefused(tree.get<Task>(forTask), forTask);
      if (no) return refuse(409, refusal(no.message, no.code === "task.no-file" ? "waiting.no-file" : "waiting.none", { id: forTask }));
    }
    // a file to read: its reading shown under the name it came with now — also when the research had it already
    if (read) reads.named(sha, named);
    // answered once checked and queued (Prefer: respond-async, RFC 7240), written a moment later with what came with it:
    // a file of a batch, or material of people or a couple — never one for a task, to read now or an image of a source,
    // whose answer says what became of it
    const later = /(?:^|[,;\s])respond-async(?:$|[,;\s])/i.test(header("prefer") ?? "") && !forTask && !read && !meta.source && !region;
    const app = header("x-strom-app-version");
    receiveOriginal(receiverOf(req), req, res, { sha, name, note, persons: meta.persons, ...(meta.families ? { families: meta.families } : {}), ...(list ? { list } : {}), source: meta.source, region, batch, where, zip, task: forTask, ...(image !== undefined ? { image } : {}), ...(replace ? { replace } : {}), ...(read ? { read } : {}), ...(later ? { async: { origin, ...(app ? { app } : {}) } } : {}) });
  };

  /**
   * A list of people the app sends material to (PUT lists/<id>, spec 137, feature media.list): checked and kept by the
   * bridge (.strom/lists/<id>.json) until a file names it (X-Strom-List-Ref) — the strom that takes the file writes it
   * into the research. {list, persons, unknown}: how many of its people, how many of them the research has not got.
   */
  const listPut = (req: http.IncomingMessage, res: http.ServerResponse, origin: string | undefined, id: string) => {
    const json = (code: number, body: Record<string, unknown>) => {
      if (!res.headersSent) res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(body));
    };
    if (!origin) {
      req.resume();
      return json(403, refusal("only the Strom app may send a list here", "app.only"));
    }
    const chunks: Buffer[] = [];
    let size = 0;
    let over = false;
    req.on("data", (c: Buffer) => {
      if (over) return;
      size += c.length;
      if (size > LIST_BODY_MAX) over = true;
      else chunks.push(c);
    });
    req.on("end", () => safely(req, res, () => {
      if (over) return json(413, refusal(`a list's body is at most ${LIST_BODY_MAX} bytes`, "list.large", { max: String(LIST_BODY_MAX) }));
      let body: unknown;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        body = undefined;
      }
      const l = checkSentList(id, body);
      if ("code" in l) return json(l.code === "list.large" ? 413 : 400, refusal(l.why, l.code));
      keepSentList(root, l);
      const tree = readTree(root, env);
      const unknown = l.persons.filter((p) => tree.get(p)?.type !== "person").length;
      json(200, { list: l.id, persons: l.persons.length, unknown });
    }));
  };

  // closed one at a time with the queue's writes: the batch's queued files and its close one commit
  const closeBatchNow = (id: string, extra: string[], reply: (code: number, body: Record<string, unknown>) => void, by: Receiver = receiver) =>
    media.close(id, (done) =>
      closeBatchBy(by, id, extra, (code, body) => {
        reply(code, body);
        // not closed (a file held, the research busy, …): the queue writes the batch's files again in a while
        done(code === 200 || code === 202);
      }),
    );

  /**
   * What the research has of many files by their hashes (POST /media/known {shas: [...]}, at most MEDIA_KNOWN_MAX): for
   * each {id, kind, mime, bytes, here} as GET /media/<sha> says it, {queued: true} for one the bridge queued and has not
   * written yet, null for one it has not got. Read only, from the bridge's tree to read from; like GET /media, for the
   * app's pages (another site's page with the secret: the secret is changed, as for any address of the bridge).
   */
  const mediaKnown = (req: http.IncomingMessage, res: http.ServerResponse) => {
    const json = (code: number, body: Record<string, unknown>) => {
      if (!res.headersSent) res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(body));
    };
    let body = "";
    let over = false;
    req.on("data", (c: Buffer) => {
      if (over) return;
      body += c.toString("utf8");
      // 64 hex, quotes and a comma for each: more than the most it takes is refused as it comes
      if (body.length > MEDIA_KNOWN_MAX * 70 + 1024) over = true;
    });
    req.on("end", () => safely(req, res, () => {
      if (over) return json(413, refusal(`at most ${MEDIA_KNOWN_MAX} hashes at once`, "media.known-many", { max: String(MEDIA_KNOWN_MAX) }));
      let shas: unknown;
      try {
        shas = (JSON.parse(body) as { shas?: unknown }).shas;
      } catch {
        shas = undefined;
      }
      if (!Array.isArray(shas) || shas.some((x) => typeof x !== "string" || !/^[0-9a-fA-F]{64}$/.test(x))) return json(400, refusal("the body: JSON {shas: [SHA-256, …]}", "media.known-body"));
      if (shas.length > MEDIA_KNOWN_MAX) return json(413, refusal(`at most ${MEDIA_KNOWN_MAX} hashes at once`, "media.known-many", { max: String(MEDIA_KNOWN_MAX) }));
      const shared = new Settings(env, {}).shared()?.value;
      const tree = readTree(root, env);
      const queued = queuedShas(root);
      const known: Record<string, unknown> = {};
      for (const raw of shas as string[]) {
        const sha = raw.toLowerCase();
        if (sha in known) continue;
        // a working copy by its own hash too (spec 133: the app names the bytes it would send by reference)
        const k = knownOriginal(tree, shared, sha) ?? workingCopyOf(tree, shared, sha) ?? workingCopyBySha(tree, shared, sha);
        known[sha] = k ? { id: k.id, kind: k.kind, mime: k.mime, bytes: k.bytes, here: !!k.file && fs.existsSync(k.file) } : queued.has(sha) ? { queued: true } : null;
      }
      json(200, { known });
    }));
  };

  /** The app says a batch is whole: {name, files, person, note} — its files become sorting tasks (the note told in them). */
  const batchDone = (req: http.IncomingMessage, res: http.ServerResponse, origin: string | undefined, id: string) => {
    const reply = (code: number, body: Record<string, unknown>) => {
      if (!res.headersSent) res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...(code === 503 ? { "Retry-After": String(typeof body.retry === "number" ? body.retry : 30) } : {}) }).end(JSON.stringify(body));
    };
    if (!origin) return reply(403, refusal("only the Strom app may close a batch", "app.only"));
    if (!BATCH_ID.test(id) || (!readBatch(root, id) && !batchQueued(root, id))) {
      req.resume();
      return reply(404, { ...refusal(`no batch ${id.slice(0, 64)} here`, "batch.none", { batch: id.slice(0, 64) }), batch: id });
    }
    let body = "";
    req.on("data", (c: Buffer) => {
      if (body.length < 8192) body += c.toString("utf8");
    });
    req.on("end", () => safely(req, res, () => {
      let said: { name?: unknown; files?: unknown; person?: unknown; note?: unknown; sort?: unknown; house?: unknown } = {};
      try {
        said = body.trim() ? (JSON.parse(body) as typeof said) : {};
      } catch {
        return reply(400, { ...refusal("the body: JSON {name, files, person, note, sort, house}", "batch.bad-body"), batch: id });
      }
      // the house its files are material of (spec 030 §4.2 question 7, feature house.material): known before anything
      // is closed — an unknown one, an archive's: the batch stays open, nothing written
      let house: string | undefined;
      if (said.house !== undefined) {
        const tree = Tree.open(root, env);
        const row = houseOfBody(tree, { house: said.house });
        if ("code" in row) return reply(row.code, { ...row.body, batch: id });
        if (actsAsArchive(tree)) return reply(409, { ...houseArchive(tree).body, batch: id });
        if (!row.id && !row.tree?.place) return reply(400, { ...refusal(`the municipality of the house "${row.key}" is no place record yet`, "house.body"), reasonCode: "house.town", batch: id });
        house = row.id ?? row.key;
      }
      // this batch sorted (or not) whatever intake.auto says: the app's choice for it (spec 130)
      if (said.sort !== undefined && typeof said.sort !== "boolean") return reply(400, { ...refusal("sort: true or false", "batch.bad-body"), batch: id });
      const persons = (Array.isArray(said.person) ? said.person : said.person ? [said.person] : []).map((p) => String(p).trim().toUpperCase()).filter((p) => /^P\d{1,9}$/.test(p));
      const extra = [
        ...(typeof said.name === "string" && said.name.trim() ? [`--name=${said.name.trim().slice(0, 120)}`] : []),
        ...persons.flatMap((p) => ["--person", p]),
        ...(Number.isInteger(said.files) && (said.files as number) > 0 ? ["--expected", String(said.files)] : []),
        ...(typeof said.note === "string" && said.note.trim() ? [`--note=${said.note.trim().slice(0, 500)}`] : []),
        ...(said.sort === true ? ["--sort"] : said.sort === false ? ["--no-sort"] : []),
        ...(house ? [`--house=${house}`] : []),
      ];
      closeBatchNow(id, extra, reply, receiverOf(req));
    }));
  };

  /**
   * What the person writes from the app (POST /waiting/<T…>, /group/<key>: a request marked sent — a fact, never a
   * decision or a consent, which only the terminal takes): checked here, then written by a strom of its own as the
   * user's (forApp: the command the terminal runs, its lock, its log and commit), one at a time and never while a send or
   * an adoption is written — then busy (503 + Retry-After, research.busy: what the bridge says of an original or a batch
   * the research cannot take now). Its refusals by their codes; the research a newer strom wrote 423 `locked`, not from
   * the app's pages 403 `app.only`, a body that is no JSON object 400 `waiting.bad-body`.
   */
  let personWriting: string | undefined;
  const WRITE_RETRY_S = 5;
  interface AppWrite {
    /** What it is (said in live.log). */
    what: string;
    /** What the body asks, checked against the research as it is now: the command to run, else the answer. */
    ask(tree: Tree, body: Record<string, unknown>): { args: string[]; then?: string[] | ((first: Record<string, unknown>) => string[] | undefined) } | { code: number; body: Record<string, unknown> };
    /**
     * The answer once written (the command's --json data, the research's head after it). With a second command
     * (then): its data, the first command's in `first`.
     */
    done(tree: Tree, data: Record<string, unknown>, head: string): Record<string, unknown>;
    /** The command's refusal (its --json code, and all it said) as the app is told it; none: 500 `waiting.failed`. */
    refused(tree: Tree, code: string, why: string, data: Record<string, unknown>): { code: number; body: Record<string, unknown> } | undefined;
    /** What goes to the command's stdin (a long list of IDs: never a command line too long for Windows). */
    stdin?: string;
    /** Its own codes: a body that is no JSON object, the research busy (409 + Retry-After instead of 503), a failure. */
    codes?: { badBody: string; busy: string; failed: string };
    /** The research busy with its own codes: answered so (503 + Retry-After, as research.busy everywhere) — default 409. */
    busyStatus?: 409 | 503;
    /** The largest body it takes (default 8 kB). */
    max?: number;
  }
  const writeFor = (req: http.IncomingMessage, res: http.ServerResponse, origin: string | undefined, how: AppWrite) => {
    const reply = (code: number, body: Record<string, unknown>) => {
      if (!res.headersSent) res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...(code === 503 || (code === 409 && body.retry !== undefined) ? { "Retry-After": String(body.retry ?? WRITE_RETRY_S) } : {}) }).end(JSON.stringify(body));
    };
    const codes = how.codes ?? { badBody: "waiting.bad-body", busy: "research.busy", failed: "waiting.failed" };
    const busy = (why: string) => reply(how.codes ? (how.busyStatus ?? 409) : 503, { ...refusal(why, codes.busy), retry: WRITE_RETRY_S });
    const max = how.max ?? 8192;
    if (!origin) {
      req.resume();
      return reply(403, refusal("only the Strom app may write here", "app.only"));
    }
    let text = "";
    let over = false;
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > max) over = true;
      else chunks.push(c);
    });
    req.on("end", () => safely(req, res, () => {
      text = Buffer.concat(chunks).toString("utf8");
      // a research a newer strom wrote: never opened, never written (as /status says it: locked)
      const newer = newerTree(root, env);
      if (newer) return reply(423, { ...refusal(newer.message, "locked"), reasonCode: newer.code, ...(newer.params ? { reasonParams: newer.params } : {}) });
      let body: Record<string, unknown> = {};
      try {
        const parsed: unknown = text.trim() ? JSON.parse(text) : {};
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
        body = parsed as Record<string, unknown>;
      } catch {
        over = true;
      }
      if (over) return reply(400, refusal(size > max ? `the body: at most ${max} bytes` : `the body: a JSON object {"do": …}`, codes.badBody));
      const asked = how.ask(Tree.open(root, env), body);
      if ("code" in asked) return reply(asked.code, asked.body);
      // a send or an adoption being written, another write of the person's: asked again in a moment
      if (writing || adopting || personWriting) return busy("the research is busy — ask again in a moment");
      personWriting = how.what;
      // a second command after the first one wrote (then): run once the first ended well
      const run = (cmd: string[], then?: string[] | ((first: Record<string, unknown>) => string[] | undefined), first?: { data: Record<string, unknown>; parent?: string }): void => {
        personWriting = how.what;
        const { command, args } = stromLauncher();
        // --json before a bare "--" (what follows it is an argument as it is: a place may begin with a hyphen)
        const end = cmd.indexOf("--");
        const words = end < 0 ? [...cmd, "--json"] : [...cmd.slice(0, end), "--json", ...cmd.slice(end)];
        const child = spawn(command, [...args, ...words], { cwd: root, env: personEnv(req), stdio: [how.stdin === undefined ? "ignore" : "pipe", "pipe", "pipe"], windowsHide: true });
        track(child);
        if (how.stdin !== undefined) {
          child.stdin!.on("error", () => {
            // the command ended before reading it: said by its exit
          });
          child.stdin!.end(how.stdin);
        }
        let out = "";
        let err = "";
        child.stdout!.on("data", (d: Buffer) => (out += d.toString("utf8")));
        child.stderr!.on("data", (d: Buffer) => (err += d.toString("utf8")));
        child.on("error", (e) => {
          personWriting = undefined;
          reply(500, refusal(errorText(e), codes.failed));
        });
        child.on("close", (code, signal) => {
          personWriting = undefined;
          // ended by a signal (killed, the system short of memory): the app answered, never left waiting for good (a
          // request without an answer hung the app's write and the test suite); an error before it answered already
          if (code === null) {
            if (res.headersSent) return;
            const why = `its strom ended (${signal ?? "a signal"})`;
            noteLive(root, `${how.what} was not written: ${why}`);
            return reply(500, refusal(why, codes.failed));
          }
          let data: Record<string, unknown> = {};
          try {
            data = JSON.parse(out) as Record<string, unknown>;
          } catch {
            // said by the exit code
          }
          if (code === 0 && then) {
            const c = committed(data, () => head(root));
            // (a second command made of what the first wrote: its head before both, its data in `first`)
            if (typeof then !== "function") return run(then);
            const next = then(c.data);
            if (next) return run(next, undefined, { data: c.data, ...(c.parent !== undefined ? { parent: c.parent } : {}) });
          }
          const now = Tree.open(root, env);
          if (code === 0) {
            const c = committed(data, () => head(root));
            // two commands: the head before the first one is what the app goes back to
            const parent = first ? first.parent : c.parent;
            return reply(200, { ...how.done(now, first ? { ...c.data, first: first.data } : c.data, c.head), ...(parent !== undefined ? { parent } : {}) });
          }
          const why = String(data.message ?? err.trim().split("\n").find((l) => l.startsWith("error:"))?.slice(6).trim() ?? `exit ${code}`);
          noteLive(root, `${how.what} was not written (exit ${code}): ${why}`);
          // the research busy (another strom holding it longer than a writer waits)
          if (code === EXIT.locked) return busy(why);
          // no room on the disk: said as everywhere (507 disk.full)
          if (data.code === DISK_FULL || isDiskFull(why)) return reply(507, diskFullSaid(now.lang, fullWhere(data, root)));
          const known = typeof data.code === "string" ? how.refused(now, data.code, why, data) : undefined;
          reply(known?.code ?? 500, known?.body ?? { ...refusal(why, codes.failed), ...(typeof data.code === "string" ? { reasonCode: data.code } : {}) });
        });
      };
      run(asked.args, asked.then);
    }));
  };

  /**
   * The people a file of the family's material is of, added and taken off (POST /material/assign {files: [I…] | batch,
   * add: [P…], remove: [P…]}: strom input assign), files hidden and shown again (POST /material/hide {files, hidden,
   * reason}: strom input hide | unskip) — the person's, as written in the app; all or nothing. Answered with the files'
   * records as GET /material gives them, the people's names, and the people a file keeps through its batch (`kept`).
   * Refused: 400 material.body, 404 material.file | material.person | material.batch {id | batch}, 403 material.readonly
   * (nothing can be written into the research here), 409 material.busy (and Retry-After: another write holds it).
   */
  const MATERIAL_CODES = { badBody: "material.body", busy: "material.busy", failed: "material.failed" };
  const materialWrite = (kind: "assign" | "hide" | "edit"): AppWrite => {
    let ids: string[] = [];
    const shown = (tree: Tree, files: string[], kept: { person: string }[] = []) => {
      const got = material(tree, new Settings(env, {}).shared()?.value, { ids: files });
      return { files: got.files, people: { ...got.people, ...peopleOf(tree, kept.map((k) => k.person)) } };
    };
    const strings = (v: unknown, most: number): string[] | undefined => (v === undefined ? [] : Array.isArray(v) && v.length <= most && v.every((x) => typeof x === "string" && x.length <= 40) ? (v as string[]) : undefined);
    const bad = (why: string) => ({ code: 400, body: refusal(why, "material.body") });
    return {
      what: `the material: ${kind}`,
      codes: MATERIAL_CODES,
      max: 256 * 1024,
      ask(tree, body) {
        if (kind === "edit") {
          // the files as {ids} (the contract), or {files} as the other writes of the material say them
          const list = body.ids ?? body.files;
          const given = strings(list, MATERIAL_MOST_EDIT);
          if (list === undefined || !given || !given.length) return bad(`ids: 1 to ${MATERIAL_MOST_EDIT} IDs of the material (I…)`);
          const value = (v: unknown) => (v === undefined || v === null ? undefined : typeof v === "string" && v.length <= 2000 ? v : false);
          const title = value(body.title);
          const what = value(body.kind);
          const date = value(body.date);
          if (title === false || what === false || date === false) return bad(`title, kind, date: text ("" takes it off)`);
          try {
            checkEdit({ title, kind: what, date });
            checkAsked(tree, { files: given });
          } catch (e) {
            return refusedAsked(e);
          }
          if (!writableHere()) return { code: 403, body: refusal("nothing can be written into the research on this computer", "material.readonly") };
          ids = given;
          this.stdin = ids.join("\n");
          return { args: ["input", "edit", "--files-from", "-", ...(title !== undefined ? [`--title=${title}`] : []), ...(what !== undefined ? [`--kind=${what}`] : []), ...(date !== undefined ? [`--date=${date}`] : [])] };
        }
        const files = body.files === undefined ? undefined : strings(body.files, MATERIAL_MOST_FILES);
        if (body.files !== undefined && (!files || !files.length)) return bad(`files: 1 to ${MATERIAL_MOST_FILES} IDs of the material (I…)`);
        let args: string[];
        if (kind === "assign") {
          const batch = typeof body.batch === "string" && BATCH_ID.test(body.batch) ? body.batch : undefined;
          const add = strings(body.add, MATERIAL_MOST_PEOPLE);
          const remove = strings(body.remove, MATERIAL_MOST_PEOPLE);
          if ((files === undefined) === (batch === undefined) || (body.batch !== undefined && !batch)) return bad(`files: [I…] or batch: "<the batch's mark>" — one of them`);
          if (!add || !remove || !(add.length + remove.length)) return bad(`add, remove: up to ${MATERIAL_MOST_PEOPLE} people (P…), one of them not empty`);
          try {
            checkAsked(tree, { ...(batch ? { batch } : { files: files! }), add, remove });
          } catch (e) {
            return refusedAsked(e);
          }
          ids = files ?? [];
          args = ["input", "assign", ...(batch ? ["--batch", batch] : ["--files-from", "-"]), ...add.flatMap((p) => ["--add", p]), ...remove.flatMap((p) => ["--remove", p])];
        } else {
          if (!files) return bad(`files: 1 to ${MATERIAL_MOST_FILES} IDs of the material (I…)`);
          if (typeof body.hidden !== "boolean") return bad(`hidden: true (hide) or false (show again)`);
          const reason = body.reason === undefined || body.reason === null ? undefined : body.reason;
          if (reason !== undefined && !(HIDE_REASONS as readonly unknown[]).includes(reason)) return bad(`reason: ${HIDE_REASONS.join(" or ")}, or none`);
          try {
            checkAsked(tree, { files });
          } catch (e) {
            return refusedAsked(e);
          }
          ids = files;
          args = body.hidden ? ["input", "hide", "--files-from", "-", ...(reason ? ["--why", String(reason)] : [])] : ["input", "unskip", "--files-from", "-"];
        }
        // nothing can be written into the research here (unpacked read only, a copy of someone else's)
        if (!writableHere()) return { code: 403, body: refusal("nothing can be written into the research on this computer", "material.readonly") };
        this.stdin = ids.join("\n");
        return { args };
      },
      done(tree, data, head) {
        const files = Array.isArray(data.files) ? data.files.map(String) : ids;
        const kept = Array.isArray(data.kept) ? (data.kept as { id: string; person: string; batch: string }[]) : [];
        const edited = kind === "edit" ? { changed: Array.isArray(data.changed) ? data.changed : [], was: data.was ?? {}, ...(Array.isArray(data.warnings) ? { warnings: data.warnings } : {}) } : {};
        return { ...shown(tree, files, kept), ...(kind === "assign" ? { kept } : {}), ...edited, head };
      },
      refused(_tree, code, why) {
        if (code === "material.body" || code === "material.date") return { code: 400, body: refusal(why, code) };
        if (code === "material.file" || code === "material.person" || code === "material.batch") return { code: 404, body: refusal(why, code) };
        if (code === "fs.no-permission" || code === "fs.sandboxed" || code === "git.unwritable" || code === "needs-consent") return { code: 403, body: { ...refusal(why, "material.readonly"), reasonCode: code } };
        return undefined;
      },
    };
  };
  /**
   * Files of the family's material deleted for good (POST /material/delete, spec 102 K1.17, V3) — the person's, asked in
   * the app's dialog, never a queue an agent could write to: first {files, dryRun: true}, answered here without a write
   * with what it takes (impacts) and the bridge's confirmation of that list (signed with the seal key, 15 minutes); then
   * {files, confirm}: the impacts again, the same as signed, written by strom input delete --confirm (which checks it once
   * more under the tree's lock). Refused: 400 material.body (no confirm that holds, a body it cannot read), 404
   * material.file, 409 material.delete-changed {impacts} (the research changed since the person saw the list), 403
   * material.readonly, 409 material.busy (+ Retry-After). A family tree's file a source standing was made of (spec 117
   * K2.2): only with that source deleted first (retractSources, one confirm over both: impacts and sourceImpacts), else
   * 409 material.source-live {sources}.
   */
  const materialDelete = (): AppWrite => {
    let ids: string[] = [];
    let with_: string[] = [];
    const bad = (why: string) => ({ code: 400, body: refusal(why, "material.body") });
    const changed = (impacts: unknown, sourceImpacts?: unknown) => ({ code: 409, body: { ...refusal("the files would take other things with them than the list said: look at it again", "material.delete-changed"), impacts, ...(sourceImpacts ? { sourceImpacts } : {}) } });
    return {
      what: "the material: delete",
      codes: MATERIAL_CODES,
      max: 64 * 1024,
      ask(tree, body) {
        const list = body.files;
        const files = Array.isArray(list) && list.length && list.length <= DELETE_MOST_FILES && list.every((x) => typeof x === "string" && x.length <= 40) ? (list as string[]) : undefined;
        if (!files) return bad(`files: 1 to ${DELETE_MOST_FILES} IDs of the material (I…)`);
        const dry = body.dryRun === true;
        if (!dry && body.dryRun !== undefined && body.dryRun !== false) return bad("dryRun: true, or a confirm");
        if (!dry && typeof body.confirm !== "string") return bad("confirm: what the dry run answered (dryRun: true first)");
        // the sources made of a family tree's file, deleted with it (spec 117 K2.2): none, or 1–50 of them
        const given = body.retractSources === undefined || (Array.isArray(body.retractSources) && !body.retractSources.length) ? [] : sourceList(body.retractSources);
        if (!given) return bad(`retractSources: 1 to ${RETRACT_MOST} IDs of sources (S…) made of the files`);
        const shared = new Settings(env, {}).shared()?.value;
        let impacts;
        try {
          impacts = deleteImpacts(tree, shared, files);
        } catch (e) {
          return refusedAsked(e);
        }
        let sourceImpacts;
        try {
          checkRetractWith(impacts, given);
          sourceImpacts = deleteSourceImpacts(tree, given);
        } catch (e) {
          if (e instanceof StromError && e.code === "material.body") return bad(e.message);
          return sourceAsked(e);
        }
        if (!writableHere()) return { code: 403, body: refusal("nothing can be written into the research on this computer", "material.readonly") };
        const key = tree.key;
        if (!key) return { code: 403, body: refusal("the research is not sealed on this computer", "material.readonly") };
        const asked = impacts.map((i) => i.id);
        const sources = sourceImpacts.map((s) => s.id);
        const both = sources.length ? { sources, impacts: sourceImpacts } : undefined;
        if (dry) return { code: 200, body: { files: asked, ...(both ? { retractSources: sources } : {}), dryRun: true, impacts, ...(both ? { sourceImpacts } : {}), confirm: deleteConfirm(key, asked, impacts, Date.now(), both) } };
        // a source standing made of a file and not deleted with it: never the file alone (the confirm aside)
        try {
          refuseLiveSources(impacts, sources);
        } catch (e) {
          return refusedAsked(e);
        }
        const said = checkDeleteConfirm(key, asked, impacts, body.confirm, Date.now(), both);
        if (said === "changed") return changed(impacts, both ? sourceImpacts : undefined);
        if (said !== "ok") return bad("confirm: none that holds (signed by this bridge, at most 15 minutes old) — dryRun: true again");
        ids = asked;
        with_ = sources;
        this.stdin = ids.join("\n");
        return { args: ["input", "delete", "--files-from", "-", ...(sources.length ? [`--retract-sources=${sources.join(",")}`] : []), `--confirm=${String(body.confirm)}`] };
      },
      done(_tree, data, head) {
        return {
          files: Array.isArray(data.files) ? data.files : ids,
          deleted: Array.isArray(data.deleted) ? data.deleted : [],
          ...(with_.length ? { retracted: Array.isArray(data.retracted) ? data.retracted : [] } : {}),
          impacts: data.impacts ?? [],
          ...(with_.length ? { sourceImpacts: data.sourceImpacts ?? [] } : {}),
          head,
        };
      },
      refused(tree, code, why, data) {
        if (code === "material.delete-changed") {
          let impacts: unknown = [];
          let sourceImpacts: unknown;
          try {
            impacts = deleteImpacts(tree, new Settings(env, {}).shared()?.value, ids);
          } catch {
            // the files are gone meanwhile: the list is empty
          }
          if (with_.length)
            try {
              sourceImpacts = deleteSourceImpacts(tree, with_);
            } catch {
              // a source gone or deleted meanwhile: no list
              sourceImpacts = [];
            }
          return changed(impacts, sourceImpacts);
        }
        if (code === "material.source-live") {
          const params = (data.params as Record<string, unknown> | undefined) ?? {};
          const sources = String(params.sources ?? "").split(",").filter(Boolean);
          return { code: 409, body: { ...refusal(why, code, { sources: sources.join(",") }), sources } };
        }
        if (code.startsWith("source.")) {
          const r = sourceRefused(code, why, (data.params as Record<string, unknown> | undefined) ?? {});
          if (r) return r;
        }
        if (code === "material.body") return { code: 400, body: refusal(why, code) };
        if (code === "material.file") return { code: 404, body: refusal(why, code) };
        if (code === "fs.no-permission" || code === "fs.sandboxed" || code === "git.unwritable" || code === "needs-consent") return { code: 403, body: { ...refusal(why, "material.readonly"), reasonCode: code } };
        return undefined;
      },
    };
  };
  /**
   * A source deleted by the person, put back, a decision kept without it (POST /source/retract | /source/restore,
   * POST /conflict/keep; spec 117) — the person's in the app, never a queue an agent could write to. Retract in two steps
   * as /material/delete: {sources, dryRun: true} answered here without a write, with the impacts and the bridge's
   * confirmation of them (signed with the seal key, 15 minutes); {sources, confirm}: written by strom source retract
   * --confirm, which checks it once more under the tree's lock. Refused: 400 source.body, 404 source.unknown |
   * conflict.unknown {id}, 409 source.retracted | source.notRetracted | source.notRestorable | conflict.notMarked {id},
   * 409 source.retract-changed {impacts}, 403 source.readonly, 409 source.busy (+ Retry-After), 500 source.failed.
   */
  const SOURCE_CODES = { badBody: "source.body", busy: "source.busy", failed: "source.failed" };
  const sourceStatus: Record<string, number> = {
    "source.body": 400,
    "source.unknown": 404,
    "conflict.unknown": 404,
    "source.retracted": 409,
    "source.notRetracted": 409,
    "source.notRestorable": 409,
    "conflict.notMarked": 409,
  };
  const sourceRefused = (code: string, why: string, params: Record<string, unknown> = {}): { code: number; body: Record<string, unknown> } | undefined => {
    if (sourceStatus[code]) return { code: sourceStatus[code]!, body: refusal(why, code, Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))) };
    if (code === "fs.no-permission" || code === "fs.sandboxed" || code === "git.unwritable" || code === "needs-consent" || code === "seal.other-key") return { code: 403, body: { ...refusal(why, "source.readonly"), reasonCode: code } };
    return undefined;
  };
  const sourceAsked = (e: unknown) => {
    if (e instanceof StromError && e.code && sourceStatus[e.code]) return sourceRefused(e.code, e.message, e.params ?? {})!;
    throw e;
  };
  const readonly = (why: string) => ({ code: 403, body: refusal(why, "source.readonly") });
  const sourceList = (v: unknown): string[] | undefined => (Array.isArray(v) && v.length && v.length <= RETRACT_MOST && v.every((x) => typeof x === "string" && x.length <= 40) ? (v as string[]) : undefined);
  const sourceRetract = (): AppWrite => {
    let ids: string[] = [];
    const bad = (why: string) => ({ code: 400, body: refusal(why, "source.body") });
    const changed = (impacts: unknown) => ({ code: 409, body: { ...refusal("deleting the source would take other things with it than the list said: look at it again", "source.retract-changed"), impacts } });
    return {
      what: "a source deleted",
      codes: SOURCE_CODES,
      max: 64 * 1024,
      ask(tree, body) {
        const sources = sourceList(body.sources);
        if (!sources) return bad(`sources: 1 to ${RETRACT_MOST} IDs of sources (S…)`);
        const dry = body.dryRun === true;
        if (!dry && body.dryRun !== undefined && body.dryRun !== false) return bad("dryRun: true, or a confirm");
        if (!dry && typeof body.confirm !== "string") return bad("confirm: what the dry run answered (dryRun: true first)");
        let impacts;
        try {
          impacts = retractImpacts(tree, sources);
        } catch (e) {
          return sourceAsked(e);
        }
        if (!writableHere()) return readonly("nothing can be written into the research on this computer");
        const key = tree.key;
        if (!key) return readonly("the research is not sealed on this computer");
        const asked = impacts.map((i) => i.id);
        if (dry) return { code: 200, body: { sources: asked, dryRun: true, impacts, confirm: retractConfirm(key, asked, impacts) } };
        const said = checkRetractConfirm(key, asked, impacts, body.confirm);
        if (said === "changed") return changed(impacts);
        if (said !== "ok") return bad("confirm: none that holds (signed by this bridge, at most 15 minutes old) — dryRun: true again");
        ids = asked;
        this.stdin = ids.join("\n");
        return { args: ["source", "retract", "--sources-from", "-", `--confirm=${String(body.confirm)}`] };
      },
      done(_tree, data, head) {
        return { sources: Array.isArray(data.sources) ? data.sources : ids, retracted: Array.isArray(data.retracted) ? data.retracted : [], impacts: data.impacts ?? [], head };
      },
      refused(tree, code, why, data) {
        if (code === "source.retract-changed") {
          let impacts: unknown = [];
          try {
            impacts = retractImpacts(tree, ids);
          } catch {
            // a source gone or deleted meanwhile: no list
          }
          return changed(impacts);
        }
        return sourceRefused(code, why, (data.params as Record<string, unknown> | undefined) ?? {});
      },
    };
  };
  const sourceRestore = (): AppWrite => {
    let ids: string[] = [];
    return {
      what: "a source put back",
      codes: SOURCE_CODES,
      max: 16 * 1024,
      ask(tree, body) {
        const sources = sourceList(body.sources);
        if (!sources) return { code: 400, body: refusal(`sources: 1 to ${RETRACT_MOST} IDs of sources (S…)`, "source.body") };
        try {
          ids = restorable(tree, sources).map((s) => s.id);
        } catch (e) {
          return sourceAsked(e);
        }
        if (!writableHere()) return readonly("nothing can be written into the research on this computer");
        this.stdin = ids.join("\n");
        return { args: ["source", "restore", "--sources-from", "-"] };
      },
      done(_tree, data, head) {
        const { commit: _commit, ...got } = data;
        return { ...got, restored: Array.isArray(data.restored) ? data.restored : ids, head };
      },
      refused(_tree, code, why, data) {
        return sourceRefused(code, why, (data.params as Record<string, unknown> | undefined) ?? {});
      },
    };
  };
  const conflictKeep = (): AppWrite => {
    let id = "";
    return {
      what: "a decision kept without a deleted source",
      codes: SOURCE_CODES,
      ask(tree, body) {
        if (typeof body.conflict !== "string" || !body.conflict.trim() || body.conflict.length > 40) return { code: 400, body: refusal("conflict: the conflict's ID (X…)", "source.body") };
        try {
          id = keepable(tree, body.conflict).id;
        } catch (e) {
          return sourceAsked(e);
        }
        if (!writableHere()) return readonly("nothing can be written into the research on this computer");
        return { args: ["conflict", "keep", id] };
      },
      done(_tree, data, head) {
        return { conflict: typeof data.conflict === "string" ? data.conflict : id, head };
      },
      refused(_tree, code, why, data) {
        return sourceRefused(code, why, (data.params as Record<string, unknown> | undefined) ?? {});
      },
    };
  };
  /**
   * An event of history hidden at a place, a person or in the whole tree, or everything of a region, or shown again
   * (POST /history/hide {event, place} | {event, person} | {event, tree: true} | {region}, "do": "show"): strom history
   * hide|show, the person's choice as written in the app — an archive's too. An unknown place is no error (the app may
   * name one the research has no fact at). Answered with what is hidden now ({hidden: [{event, place|person|tree, at} |
   * {region, at}]}). Refused: 400 history.body, 404 history.event | history.person | history.region, 503 research.busy
   * (+ Retry-After).
   */
  const historyHide = (): AppWrite => {
    const bad = (why: string) => ({ code: 400, body: refusal(why, "history.body") });
    const EVENT = /^[\p{L}\p{N}][\p{L}\p{N}-]{0,79}$/u;
    return {
      what: "an event of history hidden or shown",
      codes: { badBody: "history.body", busy: "research.busy", failed: "history.failed" },
      busyStatus: 503,
      ask(_tree, body) {
        const shape = `{"event": "<its id>", "place": "<a place>"}, {"event", "person": "P…"}, {"event", "tree": true} or {"region": "<its id>"}, and "do": "show" to show it again`;
        if (body.do !== undefined && body.do !== "show" && body.do !== "hide") return bad(shape);
        const verb = body.do === "show" ? "show" : "hide";
        if (body.region !== undefined) {
          const region = typeof body.region === "string" ? body.region.trim() : "";
          if (!REGION_ID.test(region) || ["event", "place", "person", "tree"].some((k) => body[k] !== undefined)) return bad(shape);
          return { args: ["history", verb, `--region=${region}`] };
        }
        const event = typeof body.event === "string" ? body.event.trim() : "";
        if (!EVENT.test(event)) return bad(shape);
        const wheres = [body.place !== undefined, body.person !== undefined, body.tree !== undefined].filter(Boolean).length;
        if (wheres !== 1) return bad(shape);
        let where: string;
        if (body.place !== undefined) {
          if (!placeOk(body.place)) return bad(shape);
          where = `--place=${body.place.trim()}`;
        } else if (body.person !== undefined) {
          if (typeof body.person !== "string" || !/^P\d{1,9}$/iu.test(body.person.trim())) return bad(shape);
          where = `--person=${body.person.trim().toUpperCase()}`;
        } else {
          if (body.tree !== true) return bad(shape);
          where = "--tree";
        }
        return { args: ["history", verb, event, where] };
      },
      done(_tree, data, head) {
        return { hidden: Array.isArray(data.hidden) ? data.hidden : [], head };
      },
      refused(_tree, code, why) {
        if (code === "history.body") return { code: 400, body: refusal(why, code) };
        if (code === "history.event" || code === "history.person" || code === "history.region") return { code: 404, body: refusal(why, code) };
        return undefined;
      },
    };
  };

  /**
   * An event of history deleted by the person, or restored (POST /history/delete {event}, "do": "restore"): strom history
   * delete|restore, the person's — a region's from its shared catalog (every tree on this computer), a local one (L…)
   * from this tree; never written again by the research until restored (R4; nothing spent, always undone). Answered
   * with the person's deletions now ({event, scope, deleted: [...]} as GET /history `deleted`). Refused: 400
   * history.body, 404 history.event, 409 history.retracted (taken back by the research), 503 research.busy (+ Retry-After).
   */
  const historyDelete = (): AppWrite => {
    const bad = () => ({ code: 400, body: refusal(`the body: {"event": "<its id>"}, and "do": "restore" to bring it back`, "history.body") });
    const EVENT = /^[\p{L}\p{N}][\p{L}\p{N}-]{0,79}$/u;
    return {
      what: "an event of history deleted or restored",
      codes: { badBody: "history.body", busy: "research.busy", failed: "history.failed" },
      busyStatus: 503,
      ask(_tree, body) {
        if (Object.keys(body).some((k) => k !== "event" && k !== "do")) return bad();
        if (body.do !== undefined && body.do !== "restore" && body.do !== "delete") return bad();
        const event = typeof body.event === "string" ? body.event.trim() : "";
        if (!EVENT.test(event)) return bad();
        return { args: ["history", body.do === "restore" ? "restore" : "delete", event] };
      },
      done(_tree, data, head) {
        return { event: data.event, scope: data.scope, deleted: Array.isArray(data.deleted) ? data.deleted : [], head };
      },
      refused(_tree, code, why) {
        if (code === "history.body") return { code: 400, body: refusal(why, code) };
        if (code === "history.event") return { code: 404, body: refusal(why, code) };
        if (code === "history.retracted") return { code: 409, body: refusal(why, code) };
        return undefined;
      },
    };
  };

  /**
   * Places queued to be identified or checked, or taken out of the queue (POST /places/identify {"do": "queue" | "cancel",
   * forms?, places?, all?, check?, flags?}): strom place queue | unqueue, the person's word — nothing spent, nothing
   * started (the task of identification on top of the queue; a session only by the link). Answered {ok, queued,
   * cancelled?, skipped: [{form, why}], queue}. Refused: 400 places.body, 403 places.link (a run asked for: the link that
   * asks the person in the terminal), 409 places.archive (nobody researches here), 503 research.busy (+ Retry-After).
   */
  const PLACES_CODES = { badBody: "places.body", busy: "research.busy", failed: "places.failed" };
  const placesBad = (why: string) => ({ code: 400, body: refusal(why, "places.body") });
  const placesLink = (tree: Tree, place?: string) => {
    const link = linkText({ action: "places", tree: tree.config.id, do: "run", ...(place ? { place } : {}) }, linkScheme(env));
    return { code: 403, body: { ...said(tree.lang, "ui.places.link"), link } };
  };
  const placeIdIn = (v: unknown): string | undefined => (typeof v === "string" && /^L\d{1,9}$/iu.test(v.trim()) ? v.trim().toUpperCase() : undefined);
  const placesIdentify = (): AppWrite => {
    const shape = `the body: {"do": "queue"|"cancel", "forms": ["<a place as the facts write it>"], "places": ["L…"], "all": "offmap"|"placed" (queue) | "queued" (cancel), "check": true, "flags": {"<form>": "${PLACE_FLAGS.join("|")}"}} — at most ${REQUEST_MAX}`;
    return {
      what: "places queued or taken out of the queue",
      codes: PLACES_CODES,
      busyStatus: 503,
      max: 4 * 1024 * 1024,
      ask(tree, body) {
        // a session is the person's in the terminal: the link that asks them
        if (body.do === "run" || body.run !== undefined) return placesLink(tree, placeIdIn(body.place));
        if (Object.keys(body).some((k) => !["do", "forms", "places", "all", "check", "flags"].includes(k))) return placesBad(shape);
        if (body.do !== "queue" && body.do !== "cancel") return placesBad(shape);
        const cancel = body.do === "cancel";
        const forms = body.forms === undefined ? [] : body.forms;
        const places = body.places === undefined ? [] : body.places;
        if (!Array.isArray(forms) || !forms.every(placeOk) || !Array.isArray(places) || !places.every((x) => !!placeIdIn(x))) return placesBad(shape);
        if (forms.length + places.length > REQUEST_MAX) return placesBad(shape);
        if (body.all !== undefined && body.all !== (cancel ? "queued" : "offmap") && (cancel || body.all !== "placed")) return placesBad(shape);
        if (body.check !== undefined && (typeof body.check !== "boolean" || cancel)) return placesBad(shape);
        if (body.flags !== undefined) {
          const f = body.flags;
          if (cancel || !f || typeof f !== "object" || Array.isArray(f) || Object.entries(f).some(([k, v]) => !placeOk(k) || !(PLACE_FLAGS as readonly unknown[]).includes(v))) return placesBad(shape);
        }
        if (!forms.length && !places.length && body.all === undefined) return placesBad(shape);
        if (!cancel && actsAsArchive(tree)) return { code: 409, body: refusal("nobody researches here: no place is identified", "places.archive") };
        this.stdin = JSON.stringify({
          forms,
          places: places.map((x) => placeIdIn(x)!),
          ...(body.all !== undefined ? { all: body.all } : {}),
          ...(body.check ? { check: true } : {}),
          ...(body.flags !== undefined ? { flags: body.flags } : {}),
        });
        return { args: ["place", cancel ? "unqueue" : "queue", "--request", "-"] };
      },
      done(tree, data, head) {
        return {
          ok: true,
          queued: Array.isArray(data.queued) ? data.queued.length : 0,
          ...(Array.isArray(data.cancelled) ? { cancelled: data.cancelled.length } : {}),
          skipped: Array.isArray(data.skipped) ? data.skipped : [],
          queue: queueView(tree),
          head,
        };
      },
      refused(_tree, code, why) {
        if (code === "places.body") return placesBad(why);
        if (code === "archive" || code === "agent.missing") return { code: 409, body: { ...refusal(why, "places.archive"), reasonCode: code } };
        return undefined;
      },
    };
  };

  /**
   * The person's answer to the research's question of a place (POST /places/answer {place, take: c1|c2|c3|keep|unknown|
   * none|yes|no, expect?: the question's `at` as the app saw it}), or many at once ({places: [L…], take: first|keep,
   * dry?, expect?: {L…: at}}): strom place answer, the person's — nothing spent, one step undone as one. Answered {ok,
   * place (as GET /places has it), undo, head, parent}; many {ok, done, skipped: [{place, why}], undo, head}, dry {places,
   * facts}. Refused: 400 places.body, 409 places.changed {place} (changed since: the place as it is now), 503
   * research.busy (+ Retry-After).
   */
  const placesAnswer = (): AppWrite => {
    let one: string | undefined;
    let dry = false;
    const shape = `the body: {"place": "L…", "take": "c1"|"c2"|"c3"|"keep"|"unknown"|"none"|"yes"|"no", "expect"?: "<its question's at>"} or {"places": ["L…"], "take": "first"|"keep", "dry"?: true, "expect"?: {"L…": "<at>"}}`;
    return {
      what: "an answer to a question of a place",
      codes: PLACES_CODES,
      busyStatus: 503,
      max: 1024 * 1024,
      ask(tree, body) {
        if (Object.keys(body).some((k) => !["place", "places", "take", "dry", "expect"].includes(k))) return placesBad(shape);
        const take = typeof body.take === "string" ? body.take : "";
        if (!(PLACE_TAKES as readonly string[]).includes(take)) return placesBad(shape);
        if (body.place !== undefined) {
          const id = placeIdIn(body.place);
          if (!id || body.places !== undefined || body.dry !== undefined || take === "first") return placesBad(shape);
          if (body.expect !== undefined && (typeof body.expect !== "string" || !body.expect || body.expect.length > 40)) return placesBad(shape);
          if (!placeView(tree, id)) return placesBad(`there is no place ${id} in this research`);
          one = id;
          return { args: ["place", "answer", id, `--take=${take}`, ...(body.expect ? [`--expect=${id}=${String(body.expect)}`] : [])] };
        }
        const ids = Array.isArray(body.places) ? body.places.map(placeIdIn) : [];
        if (!ids.length || ids.length > REQUEST_MAX || ids.some((x) => !x) || (take !== "first" && take !== "keep")) return placesBad(shape);
        if (body.dry !== undefined && typeof body.dry !== "boolean") return placesBad(shape);
        const e = body.expect;
        if (e !== undefined && (!e || typeof e !== "object" || Array.isArray(e) || Object.entries(e).some(([k, v]) => !placeIdIn(k) || typeof v !== "string" || v.length > 40))) return placesBad(shape);
        dry = body.dry === true;
        this.stdin = JSON.stringify({ places: ids, ...(e ? { expect: e } : {}) });
        return { args: ["place", "answer", "--places-from", "-", `--take=${take}`, ...(dry ? ["--dry"] : [])] };
      },
      done(tree, data, head) {
        if (one) return { ok: true, place: placeView(tree, one) ?? null, ...(data.undo ? { undo: data.undo } : {}), head };
        const done = Array.isArray(data.done) ? (data.done as string[]) : [];
        // the preview: how many places, and how many facts stand at them (or have their place set right by a form's yes)
        if (dry) {
          const at = done.reduce((n, id) => n + (placeView(tree, id)?.facts ?? 0), 0);
          return { places: done.length, facts: Math.max(at, typeof data.facts === "number" ? data.facts : 0) };
        }
        return { ok: true, done, skipped: Array.isArray(data.skipped) ? data.skipped : [], ...(data.undo ? { undo: data.undo } : {}), head };
      },
      refused(tree, code, why) {
        if (code === "places.changed" && one) return { code: 409, body: { ...refusal(why, code, { place: one }), place: placeView(tree, one) ?? null } };
        if (code === "places.body" || code === "place.unknown") return placesBad(why);
        return undefined;
      },
    };
  };

  /**
   * The person's last step on places undone (POST /places/undo {undo: "<the answer's undo>"}): strom place undo — only
   * that step, while nothing changed its places since. Answered {ok, restored: [L…], places: {L…: as GET /places}, head,
   * parent}. Refused: 400 places.body, 409 places.undo.later, 503 research.busy (+ Retry-After).
   */
  const placesUndo = (): AppWrite => ({
    what: "the last step on places undone",
    codes: PLACES_CODES,
    busyStatus: 503,
    ask(_tree, body) {
      const undo = typeof body.undo === "string" ? body.undo.trim() : "";
      if (Object.keys(body).some((k) => k !== "undo") || !/^u[0-9a-z]{1,16}$/u.test(undo)) return placesBad(`the body: {"undo": "<the answer's undo>"}`);
      return { args: ["place", "undo", undo] };
    },
    done(tree, data, head) {
      const restored = Array.isArray(data.restored) ? (data.restored as string[]) : [];
      return { ok: true, restored, places: Object.fromEntries(restored.map((id) => [id, placeView(tree, id) ?? null])), head };
    },
    refused(_tree, code, why) {
      if (code === "places.undo.later") return { code: 409, body: refusal(why, code) };
      return undefined;
    },
  });

  /** POST /places/run: never here — 403 places.link with the link that asks the person in the terminal. */
  const placesRunRefused = (): AppWrite => ({
    what: "a run of identification",
    codes: PLACES_CODES,
    busyStatus: 503,
    ask(tree, body) {
      return placesLink(tree, placeIdIn(body.place));
    },
    done(_tree, data) {
      return data;
    },
    refused() {
      return undefined;
    },
  });

  /**
   * A finding of the app's validation marked no error by the person, or taken back (POST /quality/dismiss {kind, persons,
   * subject?, do?: "undo"}): strom quality dismiss|undo, written by "app". Answered {ok, rev}. Refused: 400 quality.body,
   * 404 person.no-match {person}, 503 research.busy (+ Retry-After).
   */
  const qualityDismiss = (): AppWrite => {
    const bad = (why: string) => ({ code: 400, body: refusal(why, "quality.body") });
    return {
      what: "a finding marked no error",
      codes: { badBody: "quality.body", busy: "research.busy", failed: "quality.failed" },
      busyStatus: 503,
      ask(tree, body) {
        if (Object.keys(body).some((k) => !["kind", "persons", "subject", "do"].includes(k))) return bad(`the body: {"kind", "persons": ["P…"], "subject"?, "do"?: "undo"}`);
        if (body.do !== undefined && body.do !== "undo" && body.do !== "dismiss") return bad(`"do": "undo" takes a mark back`);
        let ask;
        try {
          ask = askOf(tree, body.kind, body.persons, body.subject);
        } catch (e) {
          const err = e as { code?: string; params?: Record<string, string>; message: string };
          if (err.code === "person.no-match") return { code: 404, body: refusal(err.message, err.code, err.params ?? {}) };
          return bad(err.message);
        }
        return { args: ["quality", body.do === "undo" ? "undo" : "dismiss", ...(ask.subject ? [`--subject=${ask.subject}`] : []), "--", ask.kind, ...ask.persons] };
      },
      done(tree) {
        return { ok: true, rev: qualityRev(tree) };
      },
      refused(_tree, code, why) {
        if (code === "quality.body") return bad(why);
        const person = /P\d{1,9}/u.exec(why)?.[0];
        if (code === "person.no-match") return { code: 404, body: refusal(why, code, person ? { person } : {}) };
        return undefined;
      },
    };
  };

  /**
   * The AI checks of the tree check asked (POST /health {ai: ["G", …], scope?, changed?, dry?}, spec 091, feature
   * health.ai): strom health --ai, a task first in the queue (the next session does it; no terminal). dry: what it
   * would take, nothing written ({estimate}); else {id, task, head, parent}. 400 health.body | health.scope, 409
   * health.archive | health.running {id, task}, 503 research.busy.
   */
  const healthWrite = (): AppWrite => {
    let before = "";
    let dry = false;
    const bad = (why: string, code = "health.body") => ({ code: 400, body: refusal(why, code) });
    return {
      what: "a tree check asked",
      codes: { badBody: "health.body", busy: "research.busy", failed: "health.failed" },
      busyStatus: 503,
      ask(tree, body) {
        const { ai, scope, changed } = body;
        if (Object.keys(body).some((k) => !["ai", "scope", "changed", "dry"].includes(k))) return bad(`the body: {"ai": ["G", "A", …], "scope"?: {"kind": "tree"|"line"|"person", "id"?}, "changed"?: true, "dry"?: true}`);
        if (!Array.isArray(ai) || !ai.length || ai.length > AUDIT_TYPES.length || ai.some((t) => !isAuditType(t))) return bad(`"ai": the AI checks, one or more of ${AUDIT_TYPES.join(", ")} (the built-in part needs no request: GET /health/builtin)`);
        if ((changed !== undefined && typeof changed !== "boolean") || (body.dry !== undefined && typeof body.dry !== "boolean")) return bad(`"changed" and "dry": true or false`);
        let sc: HealthScope;
        try {
          sc = scopeOf(tree, scope);
        } catch (e) {
          return bad((e as Error).message, "health.scope");
        }
        dry = body.dry === true;
        before = head(root);
        return { args: ["health", "--ai", [...new Set(ai as string[])].join(","), "--scope", sc.kind === "tree" ? "tree" : `${sc.kind}:${sc.id}`, ...(changed ? ["--changed"] : []), ...(dry ? ["--dry"] : [])] };
      },
      done(_tree, data, h) {
        if (dry) return { estimate: data.estimate, ...(data.changed ? { changed: data.changed } : {}), head: before, parent: before };
        return { id: data.id, task: data.task, estimate: data.estimate, head: h, parent: before };
      },
      refused(_tree, code, why, data) {
        if (code === "health.body" || code === "health.scope") return bad(why, code);
        if (code === "health.archive") return { code: 409, body: refusal(why, code) };
        if (code === "health.running") {
          const p = (data.params ?? {}) as Record<string, string>;
          const id = p.id ?? /C\d{4,}/u.exec(why)?.[0];
          const task = p.task ?? /T\d{4,}/u.exec(why)?.[0];
          return { code: 409, body: { ...refusal(why, code), ...(id ? { id } : {}), ...(task ? { task } : {}) } };
        }
        return undefined;
      },
    };
  };

  /**
   * The tree check of the AI stopped (POST /health/stop {id?}, feature health.ai): strom health stop — queued, its task
   * put aside; at work, its session asked to finish (what it found stays). {ok, id, state}. 400 health.body, 404
   * health.none | health.unknown, 503 research.busy.
   */
  const healthStop = (): AppWrite => ({
    what: "a tree check stopped",
    codes: { badBody: "health.body", busy: "research.busy", failed: "health.failed" },
    busyStatus: 503,
    ask(_tree, body) {
      if (Object.keys(body).some((k) => k !== "id") || (body.id !== undefined && !isReportId(body.id))) return { code: 400, body: refusal(`the body: {"id"?: "C…"}`, "health.body") };
      return { args: ["health", "stop", ...(typeof body.id === "string" ? [body.id] : [])] };
    },
    done(_tree, data) {
      return { ok: true, id: data.id, state: data.state };
    },
    refused(_tree, code, why) {
      if (code === "health.none" || code === "health.unknown") return { code: 404, body: refusal(why, code) };
      return undefined;
    },
  });

  /**
   * The person's decision on findings of the tree check (POST /audit/<id> {do, expect?}, POST /audit {ids, do, expect?},
   * feature audit.decide): strom audit accept|dismiss|undo, all at once (one commit). One: {finding, rev}; many:
   * {findings, rev}. 400 audit.body, 404 audit.unknown, 409 audit.started | health.rev {rev}, 503 research.busy.
   */
  const auditDecide = (one: string | undefined): AppWrite => {
    const bad = (why: string) => ({ code: 400, body: refusal(why, "audit.body") });
    return {
      what: "findings decided",
      codes: { badBody: "audit.body", busy: "research.busy", failed: "audit.failed" },
      busyStatus: 503,
      max: 64 * 1024,
      ask(_tree, body) {
        const allowed = one ? ["do", "expect"] : ["ids", "do", "expect"];
        if (Object.keys(body).some((k) => !allowed.includes(k))) return bad(one ? `the body: {"do": "accept"|"dismiss"|"undo", "expect"?: "<health.rev>"}` : `the body: {"ids": ["A-1a2b3c4d", …], "do": "accept"|"dismiss"|"undo", "expect"?: "<health.rev>"}`);
        if (typeof body.do !== "string" || !["accept", "dismiss", "undo"].includes(body.do)) return bad(`"do": "accept", "dismiss" or "undo"`);
        if (body.expect !== undefined && (typeof body.expect !== "string" || !body.expect || body.expect.length > 40)) return bad(`"expect": the health.rev of /status`);
        const ids = one ? [one] : body.ids;
        if (!Array.isArray(ids) || !ids.length || ids.length > 500 || ids.some((id) => !isFindingId(id))) return bad(`"ids": the findings (A-1a2b3c4d …), 1 to 500`);
        return { args: ["audit", body.do, ...(typeof body.expect === "string" ? [`--expect=${body.expect}`] : []), "--", ...new Set(ids as string[])] };
      },
      done(tree, data) {
        const findings = (data.findings ?? []) as unknown[];
        return one ? { finding: findings[0] ?? null, rev: healthRev(tree) } : { findings, rev: healthRev(tree) };
      },
      refused(tree, code, why, data) {
        if (code === "audit.unknown") return { code: 404, body: refusal(why, code) };
        if (code === "audit.started") return { code: 409, body: refusal(why, code) };
        if (code === "health.rev") return { code: 409, body: { ...refusal(why, code), rev: ((data.params ?? {}) as Record<string, string>).rev ?? healthRev(tree) } };
        return undefined;
      },
    };
  };

  /**
   * Pairs the app shows as possible duplicates, judged (POST /duplicates {pairs}): read only — the Strom app's or not.
   * Answered {rev, verdicts}. Refused: 400 duplicates.body, 503 research.busy (+ Retry-After) while it is being written.
   */
  const duplicates = (req: http.IncomingMessage, res: http.ServerResponse) => {
    const json = (code: number, body: unknown, retry?: number) => {
      if (!res.headersSent) res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...(retry ? { "Retry-After": String(retry) } : {}) }).end(JSON.stringify(body));
    };
    const max = 128 * 1024;
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size <= max) chunks.push(c);
    });
    req.on("end", () =>
      safely(req, res, () => {
        const text = Buffer.concat(chunks).toString("utf8");
        // a JSON object {"pairs": …} only (the terminal's lines of two IDs are strom person compare's)
        const pairs = size > max || !text.trim().startsWith("{") ? undefined : pairsOf(text);
        if (!pairs) return json(400, refusal(`the body: {"pairs": [["P…", "P…"], …]}, at most ${PAIRS_MAX} pairs`, "duplicates.body"));
        const holder = liveHolder(path.join(root, ".strom", "tree.lock"));
        if (writing || adopting || personWriting || (holder && !(holder.pid === process.pid && holder.host === os.hostname()))) return json(503, { ...refusal("the research is being written: ask again in a while", "research.busy"), retry: 5 }, 5);
        const tree = Tree.open(root, env);
        json(200, { rev: qualityRev(tree), verdicts: judgePairs(tree, pairs) });
      }),
    );
  };

  /**
   * No history of a region or at a place in this research, or looked for again (POST /history/skip {region} | {place},
   * "do": "undo"): strom history skip|unskip, the person's. Answered with the skips now ({skip: {regions: [id…], places:
   * [place…]}}). Refused: 400 history.body, 404 history.region (no place of the tree in it) | history.place (no fact
   * writes it), 503 research.busy (+ Retry-After).
   */
  const historySkip = (): AppWrite => {
    const bad = () => ({ code: 400, body: refusal(`the body: {"region": "<its id>"} or {"place": "<a place>"}, and "do": "undo" to look for it again`, "history.body") });
    return {
      what: "history skipped or looked for again",
      codes: { badBody: "history.body", busy: "research.busy", failed: "history.failed" },
      busyStatus: 503,
      ask(_tree, body) {
        if (Object.keys(body).some((k) => k !== "region" && k !== "place" && k !== "do")) return bad();
        if (body.do !== undefined && body.do !== "undo" && body.do !== "skip") return bad();
        if ((body.region === undefined) === (body.place === undefined)) return bad();
        const verb = body.do === "undo" ? "unskip" : "skip";
        if (body.region !== undefined) {
          const region = typeof body.region === "string" ? body.region.trim() : "";
          if (!REGION_ID.test(region)) return bad();
          return { args: ["history", verb, `--region=${region}`] };
        }
        if (!placeOk(body.place)) return bad();
        return { args: ["history", verb, `--place=${body.place.trim()}`] };
      },
      done(_tree, data, head) {
        const skip = (data.skip ?? {}) as { regions?: unknown; places?: unknown };
        return { skip: { regions: Array.isArray(skip.regions) ? skip.regions : [], places: Array.isArray(skip.places) ? skip.places : [] }, head };
      },
      refused(_tree, code, why) {
        if (code === "history.body") return { code: 400, body: refusal(why, code) };
        if (code === "history.region" || code === "history.place") return { code: 404, body: refusal(why, code) };
        return undefined;
      },
    };
  };

  /**
   * A place's regions as the person knows them (POST /history/map {place, regions: [{id, from?, to?}]}), the place
   * determined again by the research ({place, redo: true, note?}) or back to what it determined ({place, do: "auto"}):
   * strom history assign, the person's — the research never maps a place so assigned. The note: one line of at most 200
   * characters after NFC, no broken characters. Answered with the place's entry ({place, map} — map null while it waits).
   * Refused: 400 history.body, 404 history.region (no catalog) | history.place (no fact writes it), 503 research.busy.
   */
  const historyMap = (): AppWrite => {
    const bad = (why = `the body: {"place", "regions": [{"id", "from"?, "to"?}]}, {"place", "redo": true, "note"?} or {"place", "do": "auto"}`) => ({ code: 400, body: refusal(why, "history.body") });
    const year = (v: unknown) => v === undefined || (typeof v === "number" && Number.isInteger(v) && v >= 100 && v <= 9999);
    return {
      what: "a place's regions",
      codes: { badBody: "history.body", busy: "research.busy", failed: "history.failed" },
      busyStatus: 503,
      ask(_tree, body) {
        if (Object.keys(body).some((k) => !["place", "regions", "redo", "note", "do"].includes(k))) return bad();
        if (!placeOk(body.place)) return bad();
        const place = body.place.trim();
        const ways = [body.regions !== undefined, body.redo !== undefined, body.do !== undefined].filter(Boolean).length;
        if (ways !== 1 || (body.note !== undefined && body.redo === undefined)) return bad();
        if (body.do !== undefined) {
          if (body.do !== "auto") return bad();
          return { args: ["history", "assign", "--auto", "--", place] };
        }
        if (body.redo !== undefined) {
          if (body.redo !== true) return bad();
          if (body.note === undefined || body.note === null) return { args: ["history", "assign", "--redo", "--", place] };
          if (typeof body.note !== "string") return bad();
          let note: string;
          try {
            note = checkNote(body.note);
          } catch (e) {
            return bad(e instanceof Error ? e.message : String(e));
          }
          return { args: ["history", "assign", "--redo", ...(note ? [`--note=${note}`] : []), "--", place] };
        }
        const regions = body.regions;
        if (!Array.isArray(regions) || !regions.length || regions.length > 20) return bad();
        const specs: string[] = [];
        for (const g of regions as unknown[]) {
          if (!g || typeof g !== "object" || Array.isArray(g)) return bad();
          const { id, from, to, ...rest } = g as Record<string, unknown>;
          if (Object.keys(rest).length || typeof id !== "string" || !REGION_ID.test(id) || !year(from) || !year(to)) return bad();
          if (typeof from === "number" && typeof to === "number" && to < from) return bad(`${id}: the later year first`);
          specs.push(`--region=${id}${from !== undefined || to !== undefined ? `:${from ?? ""}-${to ?? ""}` : ""}`);
        }
        return { args: ["history", "assign", ...specs, "--", place] };
      },
      done(_tree, data, head) {
        return { place: data.place, map: data.map ?? null, head };
      },
      refused(_tree, code, why) {
        if (code === "history.body" || code === "history.region.years") return { code: 400, body: refusal(why, "history.body") };
        if (code === "history.region" || code === "history.place") return { code: 404, body: refusal(why, code) };
        return undefined;
      },
    };
  };

  /**
   * A region's history first of the regions (POST /history/first {region}): strom history first, the person's word from
   * the app's person card — still at history's next turn. Refused: 400 history.body; 409 history.off with the link that
   * turns it on (the person's alone, in the terminal), 409 history.archive | history.done | history.skipped (the person
   * skipped the region: their word stays until they take it back, POST /history/skip "do": "undo"); 404 history.region; 503
   * research.busy (+ Retry-After).
   */
  const historyFirst = (): AppWrite => {
    const REGION = REGION_ID;
    return {
      what: "a region's history first",
      codes: { badBody: "history.body", busy: "research.busy", failed: "history.failed" },
      busyStatus: 503,
      ask(_tree, body) {
        const keys = Object.keys(body);
        const region = typeof body.region === "string" ? body.region.trim() : "";
        if (keys.some((k) => k !== "region") || !REGION.test(region)) return { code: 400, body: refusal(`the body: {"region": "<its id>"}`, "history.body") };
        return { args: ["history", "first", region] };
      },
      done(_tree, data, head) {
        return { region: data.region, ...(data.task ? { task: data.task } : {}), first: Array.isArray(data.first) ? data.first : [], head };
      },
      refused(tree, code, why) {
        if (code === "history.off") {
          // said in the research's language, as /history/place says it
          const link = linkText({ action: "experiment", tree: tree.config.id, name: "regions", do: "on" }, linkScheme(env));
          return { code: 409, body: { ...said(tree.lang, "ui.experiments.link"), code, link } };
        }
        if (code === "history.archive" || code === "history.done" || code === "history.skipped") return { code: 409, body: refusal(why, code) };
        if (code === "history.region") return { code: 404, body: refusal(why, code) };
        if (code === "history.body") return { code: 400, body: refusal(why, code) };
        return undefined;
      },
    };
  };

  /**
   * The history of a place and its surroundings asked for (POST /history/place {place: "L…"}): it spends the agent's
   * session and the bridge cannot tell the app from an agent, so it is never started here — always 403 history.link
   * with the link that asks the person in the terminal (strom-research://history?tree=…&place=L…&do=search: the
   * estimate, yes or no, the task on top of the queue). A place looked for already: the same (looked for again).
   * Refused before: 400 history.body (only the record's ID, never its name), 404 history.place (no such record), 409
   * history.off (+ the link that turns the history on), 409 history.archive (nobody researches here).
   */
  const historyPlace = (): AppWrite => ({
    what: "a place's history",
    codes: { badBody: "history.body", busy: "research.busy", failed: "history.failed" },
    busyStatus: 503,
    ask(tree, body) {
      const keys = Object.keys(body);
      const place = typeof body.place === "string" ? body.place.trim().toUpperCase() : "";
      if (keys.some((k) => k !== "place") || !/^L\d{1,9}$/u.test(place)) return { code: 400, body: refusal(`the body: {"place": "<L…>"}`, "history.body") };
      if (actsAsArchive(tree)) return { code: 409, body: refusal("nobody researches here: nothing of history is looked for", "history.archive") };
      const settings = new Settings(env, {});
      if (!placesOn(tree, settings)) {
        const link = linkText({ action: "experiment", tree: tree.config.id, name: "placeHistory", do: "on" }, linkScheme(env));
        return { code: 409, body: { ...said(tree.lang, "ui.experiments.link"), code: "history.off", link } };
      }
      if (!placeRecord(tree, place)) return { code: 404, body: refusal(`there is no place ${place} in this research`, "history.place") };
      const link = linkText({ action: "history", tree: tree.config.id, place, do: "search" }, linkScheme(env));
      return { code: 403, body: { ...said(tree.lang, "ui.history.place.link"), link, estimate: placeEstimate(tree) } };
    },
    done(_tree, data) {
      return data;
    },
    refused() {
      return undefined;
    },
  });

  /**
   * The experiments of this research as the app turns them (POST /experiments), off for this tree alone (its
   * strom.json; the person's own config stays): {"regions": false} the history of the regions, {"places": false} the
   * history of the places (by itself too), {"history": false} both (an app before the two were apart), {"historyPlaces":
   * false} the places looked for by themselves. Turning one on is the person's alone, in the terminal: refused 403
   * experiments.link with the link that opens it (strom-research://experiment?tree=…&name=regions|placeHistory|history|
   * places&do=on, in this installation's scheme). 400 experiments.body.
   */
  const experimentsWrite = (): AppWrite => {
    const NAMES = ["regions", "places", "history", "historyPlaces"] as const;
    const LINK = { regions: "regions", places: "placeHistory", history: "history", historyPlaces: "places" } as const;
    let before = "";
    let field: (typeof NAMES)[number] = "history";
    return {
      what: "the experiments of the research",
      codes: { badBody: "experiments.body", busy: "research.busy", failed: "experiments.failed" },
      busyStatus: 503,
      ask(tree, body) {
        const keys = Object.keys(body);
        const name = keys.length === 1 ? NAMES.find((n) => n === keys[0]) : undefined;
        if (!name || typeof body[name] !== "boolean") return { code: 400, body: refusal(`the body: {"regions": false}, {"places": false}, {"history": false} or {"historyPlaces": false}`, "experiments.body") };
        field = name;
        if (body[name]) {
          const link = linkText({ action: "experiment", tree: tree.config.id, name: LINK[name], do: "on" }, linkScheme(env));
          return { code: 403, body: { ...said(tree.lang, "ui.experiments.link"), link } };
        }
        before = head(root);
        const settings = new Settings(env, {});
        const regions = settings.historyRegions(tree.config);
        const places = settings.historyPlace(tree.config);
        const auto = tree.config.experimentsHistoryPlaces !== "off" && settings.historyPlacesAuto(tree.config);
        // what is off already stays as it is: 200, nothing written
        const sets: string[][] = [];
        if ((name === "regions" || name === "history") && regions) sets.push(["experiments.history"]);
        if ((name === "places" || name === "history") && places) sets.push(["experiments.placeHistory"]);
        if (name === "historyPlaces" && auto) sets.push(["experiments.historyPlaces"]);
        if (!sets.length) return { code: 200, body: { experiments: { [name]: false }, head: before, parent: before } };
        // both at once (an app before the two were apart): one command each, the places' first
        if (sets.length === 2) return { args: ["config", "set", "experiments.placeHistory", "off", "--for-tree"], then: ["config", "set", "experiments.history", "off", "--for-tree"] };
        const off = ["config", "set", sets[0]![0]!, "off", "--for-tree"];
        // the regions alone: the places that follow them kept as they are, written first
        const pin = name === "regions" ? placesPinned(tree, settings) : undefined;
        return pin ? { args: pin, then: off } : { args: off };
      },
      done(_tree, _data, h) {
        return { experiments: { [field]: false }, head: h, parent: before };
      },
      refused() {
        return undefined;
      },
    };
  };

  /** What aligning would do in this research, as GET /history/align answers it (the events' IDs left out). */
  const alignPreview = (tree: Tree, asked?: readonly EventKind[]) => {
    const settings = new Settings(env, {});
    const shared = settings.shared()?.value;
    const plan = planAlign(tree, shared, settings, asked);
    const { hide, show, shared: catalogs, ...rest } = alignData(tree, shared, plan, false, false);
    return { ...rest, hide, show, shared: { n: catalogs.n, kinds: catalogs.kinds } };
  };

  /**
   * The kinds of history looked for, as the app sets them (POST /history/kinds {kinds: [...], scope: "tree" | "default"},
   * or {scope: "tree", inherit: true}: this computer's again): a kind left out at once (anyone's), for this research
   * (strom config set history.kinds … --for-tree) or for this computer (the researches without their own); a kind added
   * spends sessions — the person's alone, in the terminal: 403 history.kinds.link with the link that asks there (the
   * whole change, never half of it written). Answered with the kinds as /status says them and alignSuggested (align
   * would now change something). 400 history.kinds.body, 409 history.archive, 503 research.busy.
   */
  const historyKinds = (): AppWrite => {
    let before = "";
    const answer = (tree: Tree, h: string, parent: string) => {
      const settings = new Settings(env, {});
      const shared = settings.shared()?.value;
      const tr = Tree.open(tree.root, env);
      return { experiments: kindsStatus(tr, settings), alignSuggested: !alignEmpty(planAlign(tr, shared, settings)), head: h, parent };
    };
    return {
      what: "the kinds of history looked for",
      codes: { badBody: "history.kinds.body", busy: "research.busy", failed: "history.kinds.failed" },
      busyStatus: 503,
      ask(tree, body) {
        const keys = Object.keys(body);
        const scope = body.scope ?? "tree";
        const inherit = body.inherit === true;
        const named = kindsNamed(body.kinds);
        const bad = () => ({ code: 400, body: refusal(`the body: {"kinds": ["war", "epidemic", …], "scope": "tree" | "default"} or {"scope": "tree", "inherit": true}; the kinds: ${EVENT_KINDS.join(", ")}`, "history.kinds.body") });
        if (keys.some((k) => k !== "kinds" && k !== "scope" && k !== "inherit") || (scope !== "tree" && scope !== "default")) return bad();
        if (body.inherit !== undefined && (typeof body.inherit !== "boolean" || scope !== "tree" || body.kinds !== undefined)) return bad();
        if (!inherit && !named) return bad();
        if (actsAsArchive(tree)) return { code: 409, body: refusal("nobody researches here: nothing of history is looked for", "history.archive") };
        before = head(root);
        const settings = new Settings(env, {});
        const mine = readStored(tree.config, "history.kinds", "");
        const computer = readStored(settings.config, "history.kinds", "");
        const now = scope === "tree" ? settings.historyKinds(tree.config) : settings.historyKinds(undefined);
        const next: EventKind[] = inherit ? settings.historyKinds(undefined) : named!;
        const added = kindsAdded(now, next);
        if (added.length) {
          // the whole change through the terminal: what it adds, the estimate, the person's yes
          const link = linkText(
            { action: "history-kinds", tree: tree.config.id, scope: scope as "tree" | "default", ...(inherit ? { inherit: "1" as const } : { kinds: kindsSetting(next, String(scope === "tree" ? (mine ?? computer ?? "") : (computer ?? ""))) }) },
            linkScheme(env),
          );
          return { code: 403, body: { ...said(tree.lang, "ui.history.kinds.link"), link, added } };
        }
        // nothing changes: 200, nothing written
        const same = inherit ? mine === undefined : kindsOf(kindsSetting(now)).join() === next.join();
        if (same) return { code: 200, body: answer(tree, before, before) };
        if (inherit) return { args: ["config", "unset", "history.kinds", "--for-tree"] };
        const value = kindsSetting(next, String((scope === "tree" ? (mine ?? computer) : computer) ?? ""));
        return { args: ["config", "set", "history.kinds", value, ...(scope === "tree" ? ["--for-tree"] : [])] };
      },
      done(tree, _data, h) {
        return answer(tree, h, before);
      },
      refused() {
        return undefined;
      },
    };
  };

  /**
   * The history aligned with the kinds looked for, on the person's click after the app's preview (POST /history/align
   * {plan: <the preview's mark>, hide: true, backfill: true}): hidden and shown again here (free, taken back by
   * POST /history/align/undo); the tasks that look for the kinds turned on spend sessions — the person's, in the terminal:
   * `backfill` in the answer with the link that asks there (strom-research://history-align), 403 history.align.link when
   * nothing else was asked or there was nothing to hide. Another plan by now: 409 history.align.changed with the preview
   * as it is. The shared catalogs are never pruned here (strom history align --prune-shared, the terminal).
   */
  const historyAlign = (): AppWrite => {
    let before = "";
    let backfill: Record<string, unknown> | undefined;
    return {
      what: "the history aligned with the kinds looked for",
      codes: { badBody: "history.align.body", busy: "research.busy", failed: "history.align.failed" },
      busyStatus: 503,
      ask(tree, body) {
        const keys = Object.keys(body);
        if (keys.some((k) => k !== "plan" && k !== "hide" && k !== "backfill") || typeof body.plan !== "string" || !/^[0-9a-f]{16}$/u.test(body.plan) || (body.hide !== undefined && typeof body.hide !== "boolean") || (body.backfill !== undefined && typeof body.backfill !== "boolean") || (!body.hide && !body.backfill))
          return { code: 400, body: refusal(`the body: {"plan": "<the mark of GET /history/align>", "hide": true, "backfill": true}`, "history.align.body") };
        if (actsAsArchive(tree)) return { code: 409, body: refusal("nobody researches here: nothing of history is looked for", "history.archive") };
        const preview = alignPreview(tree);
        if (preview.plan !== body.plan) return { code: 409, body: { ...refusal("align would now do otherwise than the preview said: see it again", "history.align.changed"), preview } };
        before = head(root);
        const link = linkText({ action: "history-align", tree: tree.config.id }, linkScheme(env));
        backfill = body.backfill && preview.backfill.length ? { code: "history.align.link", said: ui(tree.lang, "ui.history.align.link"), text: ui("en", "ui.history.align.link"), link, n: preview.backfill.length, sessions: preview.sessions, pace: preview.pace } : undefined;
        const hides = preview.hide.general.n + preview.hide.local.n + preview.show.n;
        if (!body.hide || !hides) {
          if (backfill) return { code: 403, body: { ...said(tree.lang, "ui.history.align.link"), link, backfill } };
          return { code: 200, body: { done: { hidden: 0, shown: 0, tasks: 0 }, head: before, parent: before } };
        }
        return { args: ["history", "align", "--yes", "--only-hide", "--plan", body.plan] };
      },
      done(_tree, data, h) {
        const d = (data.done ?? {}) as { hidden?: number; shown?: number; undo?: string };
        return { done: { hidden: d.hidden ?? 0, shown: d.shown ?? 0, tasks: 0 }, ...(d.undo ? { undo: d.undo } : {}), ...(backfill ? { backfill } : {}), head: h, parent: before };
      },
      refused(tree, code, why) {
        if (code === "history.align.changed") return { code: 409, body: { ...refusal(why, code), preview: alignPreview(tree) } };
        return undefined;
      },
    };
  };

  /** An align of the app taken back (POST /history/align/undo {undo}): its events shown again, the hides it took away back. 404 history.align.undo, 409 history.align.undone. */
  const historyAlignUndo = (): AppWrite => {
    let before = "";
    return {
      what: "an align of the history taken back",
      codes: { badBody: "history.align.body", busy: "research.busy", failed: "history.align.failed" },
      busyStatus: 503,
      ask(_tree, body) {
        const keys = Object.keys(body);
        if (keys.length !== 1 || typeof body.undo !== "string" || !/^\d{14}-[0-9a-f]{6}$/u.test(body.undo)) return { code: 400, body: refusal(`the body: {"undo": "<the undo of POST /history/align>"}`, "history.align.body") };
        before = head(root);
        return { args: ["history", "align", "--undo", body.undo] };
      },
      done(_tree, data, h) {
        return { undone: { shown: Number(data.shown ?? 0), hidden: Number(data.hidden ?? 0) }, head: h, parent: before };
      },
      refused(_tree, code, why) {
        if (code === "history.align.undo") return { code: 404, body: refusal(why, code) };
        if (code === "history.align.undone") return { code: 409, body: refusal(why, code) };
        return undefined;
      },
    };
  };

  /** What splitting the older sources' locators would do, as GET /sources/split answers it: the first ten (as strom source split shows them), or every one. */
  const splitPreview = (tree: Tree, all = false) => {
    const plan = splitPlan(tree);
    return { split: all ? plan.split : plan.split.slice(0, 10), count: plan.split.length, unrecognized: plan.unrecognized, unrecognizedExamples: plan.unrecognizedExamples, nothing: plan.nothing, undos: splitUndos(tree), plan: splitMark(plan) };
  };
  /** Nobody researches here (an archive, a research waiting for its agent): its sources are not split from the app. */
  const splitArchive = () => refusal("nobody researches here: the sources' locators are not split from the app", "source.split.archive");
  const SPLIT_CODES = { badBody: "source.split.body", busy: "research.busy", failed: "source.split.failed" };

  /**
   * The older sources' locators split into folio and image on the person's click after the app's preview (POST
   * /sources/split {plan: <the preview's mark>}): one operation, written as the user's (strom source split --apply
   * --plan), undone as one (POST /sources/split/undo). Another split by now: 409 source.split.plan with the preview as it is.
   */
  const sourceSplit = (): AppWrite => {
    let before = "";
    return {
      what: "the older sources' locators split into folio and image",
      codes: SPLIT_CODES,
      busyStatus: 503,
      ask(tree, body) {
        const keys = Object.keys(body);
        if (keys.length !== 1 || typeof body.plan !== "string" || !/^[0-9a-f]{16}$/u.test(body.plan)) return { code: 400, body: refusal(`the body: {"plan": "<the plan of GET /sources/split>"}`, "source.split.body") };
        if (actsAsArchive(tree)) return { code: 409, body: splitArchive() };
        const preview = splitPreview(tree);
        if (preview.plan !== body.plan) return { code: 409, body: { ...refusal("the split would now do otherwise than the preview said: see it again", "source.split.plan"), preview } };
        before = head(root);
        if (!preview.count) return { code: 200, body: { done: { split: 0 }, head: before, parent: before } };
        return { args: ["source", "split", "--apply", "--plan", body.plan] };
      },
      done(_tree, data, h) {
        return { done: { split: Number(data.count ?? 0) }, ...(typeof data.undo === "string" ? { undo: data.undo } : {}), head: h, parent: before };
      },
      refused(tree, code, why) {
        if (code === "source.split.plan") return { code: 409, body: { ...refusal(why, code), preview: splitPreview(tree) } };
        return undefined;
      },
    };
  };

  /** A split of the app taken back whole (POST /sources/split/undo {undo}). 404 source.split.undo; 409 source.split.changed: changed since, nothing undone. */
  const sourceSplitUndo = (): AppWrite => {
    let before = "";
    return {
      what: "a split of the sources' locators taken back",
      codes: SPLIT_CODES,
      busyStatus: 503,
      ask(_tree, body) {
        const keys = Object.keys(body);
        if (keys.length !== 1 || typeof body.undo !== "string" || !/^\d{14}-[0-9a-f]{6}$/u.test(body.undo)) return { code: 400, body: refusal(`the body: {"undo": "<the undo of POST /sources/split>"}`, "source.split.body") };
        before = head(root);
        return { args: ["source", "split", "--undo", body.undo] };
      },
      done(_tree, data, h) {
        return { undone: { restored: Array.isArray(data.restored) ? data.restored.length : 0 }, head: h, parent: before };
      },
      refused(tree, code, why, data) {
        if (code === "source.split.undo") return { code: 404, body: refusal(why, code) };
        if (code === "source.split.changed") {
          const p = data.params && typeof data.params === "object" ? (data.params as Record<string, unknown>) : {};
          const ids = String(p.sources ?? "").split(",").map((s) => s.trim()).filter(Boolean);
          return { code: 409, body: { ...refusal(why, code), count: ids.length, sources: ids.slice(0, 5).map((id) => ({ id, title: tree.get<Source>(id)?.title ?? id })) } };
        }
        return undefined;
      },
    };
  };

  /** The lines' codes (POST /directions…): a body that is not one, the research busy (503 + Retry-After), a failure. */
  const DIRECTION_CODES = { badBody: "directions.body", busy: "research.busy", failed: "directions.failed" };
  const badDirection = (why: string) => ({ code: 400, body: refusal(why, "directions.body") });
  /** Nobody researches here (an archive, a research waiting for its agent): no line is written. */
  const directionsArchive = (tree: Tree) => ({ code: 409, body: { ...refusal("nobody researches here: no line is written", "directions.archive"), reasonCode: stateOf(tree) } });
  /** The command's refusals as the app reads them. */
  const directionRefused = (code: string, why: string, data: Record<string, unknown>) => {
    if (code === "archive" || code === "agent.missing") return { code: 409, body: { ...refusal(why, "directions.archive"), reasonCode: code } };
    if (code === "directions.exists") return { code: 409, body: { ...refusal(why, code), existing: data.existing } };
    if (code === "directions.body") return { code: 400, body: refusal(why, code) };
    if (code === "offline.none") return { code: 404, body: refusalOf(why, data, code) };
    return undefined;
  };
  /** One line as /status researches[] says it, after a write. */
  const directionNow = (tree: Tree, id: string): Record<string, unknown> | undefined => {
    const all = scopes(tree);
    const queued = runOrder(tree, tree.list<Task>("task"), new Settings(env, {}).strategy(tree.config)).map((r) => r.task);
    return directions(tree, all, queued, [], foundNow(tree, all, head(root))).find((d) => d.id === id);
  };
  /** A text of the app's: one line, at most so many characters. */
  const textOk = (v: unknown, most: number): v is string => typeof v === "string" && !!v.trim() && v.length <= most;
  /** A limit as the app sends it: a whole number from 1, null (none) — or not sent. */
  const limitOk = (v: unknown) => v === undefined || v === null || (Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 9999);
  const limitsOf = (v: unknown, nulls: boolean): string | undefined => {
    if (v === undefined) return undefined;
    if (!v || typeof v !== "object" || Array.isArray(v)) return "limits: an object {generations?, before?}";
    const l = v as Record<string, unknown>;
    if (Object.keys(l).some((k) => k !== "generations" && k !== "before")) return "limits: only generations and before";
    if (!limitOk(l.generations) || !limitOk(l.before) || (!nulls && (l.generations === null || l.before === null))) return "limits: whole numbers from 1" + (nulls ? ", or null for none" : "");
    return undefined;
  };

  /**
   * A new line (POST /directions): strom research new, and what the person knows of it as material for the agent
   * (strom intake --text … --research G…) — nothing starts, nothing is spent; the next run proposes its tasks. A line of
   * the same person and kind (a question: the same question) is never made twice: 409 directions.exists {existing}.
   * `branch` (B-P…: a line made for a branch off the lines, What waits proposed one): strom research new --branch — the
   * branch goes with the new line, the proposal answered; no such branch now: 404 offline.none, nothing made.
   */
  /** The body of a new line checked (POST /directions and its preview): what is wrong as the answer, else the person. */
  const newLineOf = (tree: Tree, body: Record<string, unknown>): { code: number; body: Record<string, unknown> } | { p: Person; key?: string } => {
    const known = ["person", "direction", "name", "question", "limits", "note", "branch", "moveTasks"];
    if (Object.keys(body).some((k) => !known.includes(k))) return badDirection(`the body: ${known.join(", ")}`);
    const { person, direction, name, question, limits, note, branch, moveTasks } = body;
    if (typeof person !== "string" || !/^P\d{1,9}$/i.test(person)) return badDirection("person: the ID of a person (P…)");
    if (direction !== "ancestors" && direction !== "descendants" && direction !== "question") return badDirection("direction: ancestors, descendants or question");
    if (name !== undefined && !textOk(name, 200)) return badDirection("name: a text of at most 200 characters");
    if (direction === "question" ? !textOk(question, 1000) : question !== undefined) return badDirection(direction === "question" ? "question: the question (at most 1000 characters)" : "question: only for a question");
    const badLimits = limitsOf(limits, false);
    if (badLimits) return badDirection(badLimits);
    if (note !== undefined && !textOk(note, 20_000)) return badDirection("note: a text of at most 20000 characters");
    if (moveTasks !== undefined && typeof moveTasks !== "boolean") return badDirection("moveTasks: true or false");
    const key = branch === undefined ? undefined : branchKey(branch);
    if (branch !== undefined && (typeof branch !== "string" || branch.length > 40 || !key)) return badDirection("branch: B-P…");
    if (actsAsArchive(tree)) return directionsArchive(tree);
    if (key && !branchOf(tree, new Settings(env, {}), key)) return noBranch(key);
    const p = tree.get<Person>(person.toUpperCase());
    if (!p || p.type !== "person" || p.retracted) return { code: 404, body: refusal(`no person ${person}`, "directions.person", { id: person }) };
    const same = sameDirection(tree.list<Research>("research"), p.id, direction, question as string | undefined);
    if (same) return { code: 409, body: { ...refusal(`the line "${same.name}" is there already`, "directions.exists", { id: same.id }), existing: { id: same.id, name: same.name, state: same.state } } };
    return { p, ...(key ? { key } : {}) };
  };

  /**
   * What a new line would take from the wider lines it would be inside (POST /directions/preview, spec 126 K2.15):
   * the same body as POST /directions, nothing written — {inside: [G…], move: n}; move 0: nothing to ask.
   */
  const directionPreview = (): AppWrite => ({
    what: "a new line's preview",
    codes: DIRECTION_CODES,
    busyStatus: 503,
    ask(tree, body) {
      const ok = newLineOf(tree, body);
      if ("code" in ok) return ok;
      const l = (body.limits ?? {}) as { generations?: number; before?: number };
      const limits = { ...(l.generations ? { generations: l.generations } : {}), ...(l.before ? { before: l.before } : {}) };
      const preview = gatherPreview(tree, {
        focus: ok.p.id,
        direction: body.direction as Direction,
        ...(Object.keys(limits).length ? { limits } : {}),
        ...(typeof body.question === "string" ? { question: body.question.normalize("NFC").trim() } : {}),
      });
      return { code: 200, body: { ok: true, ...preview } };
    },
    done: (_tree, data) => data,
    refused: (_tree, code, why, data) => directionRefused(code, why, data),
  });

  /**
   * A line's last taking of tasks given back (POST /directions/<G…>/gather/undo, spec 126 K2.15): strom research gather
   * G… --undo — {ok: true, back: n}; nothing to give back: 409 gather.none.
   */
  const gatherUndo = (id: string): AppWrite => {
    let before = "";
    return {
      what: `the tasks taken by ${id}`,
      codes: DIRECTION_CODES,
      busyStatus: 503,
      ask(tree) {
        if (actsAsArchive(tree)) return directionsArchive(tree);
        const r = tree.get<Research>(id);
        if (!r || r.type !== "research") return { code: 404, body: refusal(`no line ${id}`, "directions.none", { id }) };
        if (!lastGather(tree, id)) return { code: 409, body: refusal(`${id} has taken no tasks to give back`, "gather.none", { id }) };
        before = head(root);
        return { args: ["research", "gather", id, "--undo"] };
      },
      done(_tree, data, h) {
        const back = Array.isArray(data.returned) ? data.returned.length : 0;
        return { ok: true, back, head: h, parent: before };
      },
      refused(_tree, code, why, data) {
        if (code === "gather.none") return { code: 409, body: refusal(why, "gather.none", { id }) };
        return directionRefused(code, why, data);
      },
    };
  };

  const directionNew = (): AppWrite => {
    let before = "";
    let withMove = false;
    return {
      what: "a new line",
      codes: DIRECTION_CODES,
      busyStatus: 503,
      ask(tree, body) {
        const ok = newLineOf(tree, body);
        if ("code" in ok) return ok;
        const { p, key } = ok;
        const { direction, name, question, limits, note, moveTasks } = body as { direction: string; name?: string; question?: string; limits?: unknown; note?: string; moveTasks?: boolean };
        withMove = moveTasks !== undefined;
        before = head(root);
        const l = (limits ?? {}) as { generations?: number; before?: number };
        // no name: one in the research's language, as the menu makes it
        const title = (name as string | undefined)?.normalize("NFC").trim() || (direction === "question" ? (question as string).normalize("NFC").trim() : ui(tree.lang, direction === "ancestors" ? "ui.research.title.ancestors" : "ui.research.title.descendants", { name: displayName(p) }));
        return {
          args: [
            "research", "new", "--person", p.id, "--direction", direction,
            ...(direction === "question" ? [`--question=${(question as string).normalize("NFC").trim()}`] : []),
            ...(l.generations ? ["--generations", String(l.generations)] : []),
            ...(l.before ? ["--before", String(l.before)] : []),
            ...(key ? ["--branch", key] : []),
            // the tasks of the wider lines it is inside about its people only (spec 126 K2.15): the app asked the person
            ...(moveTasks === true ? ["--move-tasks"] : moveTasks === false ? ["--keep-tasks"] : []),
            "--", title,
          ],
          ...(note !== undefined
            ? { then: (first: Record<string, unknown>) => {
                const id = (first.research as { id?: string } | undefined)?.id;
                return id ? ["intake", `--text=${(note as string).normalize("NFC").trim()}`, "--research", id] : undefined;
              } }
            : {}),
        };
      },
      done(tree, data, h) {
        const made = (data.first ?? data) as { research?: { id?: string }; moved?: unknown };
        const id = made.research?.id ?? "";
        // how many tasks moved to it (spec 126 K2.15): with moveTasks only
        const moved = withMove ? { moved: Array.isArray(made.moved) ? made.moved.length : 0 } : {};
        return { direction: directionNow(tree, id) ?? null, ...moved, head: h, parent: before };
      },
      refused(_tree, code, why, data) {
        return directionRefused(code, why, data);
      },
    };
  };

  /** A line changed (POST /directions/<G…>): strom research edit — its name, question, limits, why it waits. */
  const directionEdit = (id: string): AppWrite => {
    let before = "";
    return {
      what: `the line ${id}`,
      codes: DIRECTION_CODES,
      busyStatus: 503,
      ask(tree, body) {
        const known = ["name", "question", "limits", "reason"];
        if (!Object.keys(body).length || Object.keys(body).some((k) => !known.includes(k))) return badDirection(`the body: ${known.join(", ")} (at least one)`);
        const { name, question, limits, reason } = body;
        if (name !== undefined && !textOk(name, 200)) return badDirection("name: a text of at most 200 characters");
        if (question !== undefined && !textOk(question, 1000)) return badDirection("question: a text of at most 1000 characters");
        const badLimits = limitsOf(limits, true);
        if (badLimits) return badDirection(badLimits);
        if (reason !== undefined && !textOk(reason, 2000)) return badDirection("reason: a text of at most 2000 characters");
        if (actsAsArchive(tree)) return directionsArchive(tree);
        const r = tree.get<Research>(id);
        if (!r || r.type !== "research") return { code: 404, body: refusal(`no line ${id}`, "directions.none", { id }) };
        if (question !== undefined && r.direction !== "question") return badDirection(`${id} is no question`);
        if (reason !== undefined && r.state !== "paused") return badDirection(`${id} is not paused: reason says why a paused line waits`);
        before = head(root);
        const l = (limits ?? {}) as { generations?: number | null; before?: number | null };
        const limit = (v: number | null | undefined) => (v === null ? "none" : String(v));
        return {
          args: [
            "research", "edit", id,
            ...(name !== undefined ? [`--name=${(name as string).normalize("NFC").trim()}`] : []),
            ...(question !== undefined ? [`--question=${(question as string).normalize("NFC").trim()}`] : []),
            ...("generations" in l ? [`--generations=${limit(l.generations)}`] : []),
            ...("before" in l ? [`--before=${limit(l.before)}`] : []),
            ...(reason !== undefined ? [`--reason=${(reason as string).normalize("NFC").trim()}`] : []),
          ],
        };
      },
      done(tree, data, h) {
        return { direction: directionNow(tree, id) ?? null, ...(data.effect ? { effect: data.effect } : {}), head: h, parent: before };
      },
      refused(_tree, code, why, data) {
        return directionRefused(code, why, data);
      },
    };
  };

  /** A line paused, ended or resumed (POST /directions/<G…>/state): strom research pause|done|resume. */
  const directionState = (id: string): AppWrite => {
    let before = "";
    return {
      what: `the state of the line ${id}`,
      codes: DIRECTION_CODES,
      busyStatus: 503,
      ask(tree, body) {
        if (Object.keys(body).some((k) => k !== "do" && k !== "reason") || !["pause", "done", "resume"].includes(body.do as string)) return badDirection(`the body: {"do": "pause"|"done"|"resume", "reason"?: "…"}`);
        if (body.reason !== undefined && (body.do === "resume" || !textOk(body.reason, 2000))) return badDirection("reason: why it is paused or ended (at most 2000 characters)");
        if (actsAsArchive(tree)) return directionsArchive(tree);
        const r = tree.get<Research>(id);
        if (!r || r.type !== "research") return { code: 404, body: refusal(`no line ${id}`, "directions.none", { id }) };
        before = head(root);
        return { args: ["research", body.do as string, id, ...(body.reason !== undefined ? [`--reason=${(body.reason as string).normalize("NFC").trim()}`] : [])] };
      },
      done(tree, _data, h) {
        return { direction: directionNow(tree, id) ?? null, head: h, parent: before };
      },
      refused(_tree, code, why, data) {
        return directionRefused(code, why, data);
      },
    };
  };

  /** The lines in the order of work (POST /directions/order): strom research order; IDs no line has: ignored. */
  const directionsOrder = (): AppWrite => {
    let before = "";
    let ignored: string[] = [];
    return {
      what: "the order of the lines",
      codes: DIRECTION_CODES,
      busyStatus: 503,
      max: 64 * 1024,
      ask(tree, body) {
        const order = body.order;
        if (Object.keys(body).some((k) => k !== "order") || !Array.isArray(order) || order.length > 2000 || !order.every((x) => typeof x === "string" && x.length <= 40))
          return badDirection(`the body: {"order": ["G…", …]}`);
        if (actsAsArchive(tree)) return directionsArchive(tree);
        const lines = new Set(tree.list<Research>("research").map((r) => r.id));
        const named = (order as string[]).map((x) => x.trim().toUpperCase());
        ignored = (order as string[]).filter((x, i) => !lines.has(named[i]!));
        const valid = named.filter((x) => lines.has(x));
        before = head(root);
        if (!valid.length) return { code: 200, body: { order: workOrder(tree.list<Research>("research")).map((r) => r.id), ...(ignored.length ? { ignored } : {}), head: before, parent: before } };
        return { args: ["research", "order", "--", ...valid] };
      },
      done(_tree, data, h) {
        return { order: data.order, ...(ignored.length ? { ignored } : {}), head: h, parent: before };
      },
      refused(_tree, code, why, data) {
        return directionRefused(code, why, data);
      },
    };
  };

  /** Work off the lines' codes (POST /offline…, /queue/<T…>, /waiting/W-B-…): a body that is not one, busy (503), a failure. */
  const OFFLINE_CODES = { badBody: "offline.body", busy: "research.busy", failed: "offline.failed" };
  const badOffline = (why: string) => ({ code: 400, body: refusal(why, "offline.body") });
  /** No such branch now: its person is in a line, or nothing off the lines hangs on them. */
  const noBranch = (branch: string) => ({ code: 404, body: refusal(`no branch ${branch} now: its person is in a line, or nothing off the lines hangs on them`, "offline.none", { branch }) });
  /** A line as the app names it (G…), when the research has it and did not take it back. */
  const lineNamed = (tree: Tree, v: unknown): string | undefined => {
    if (typeof v !== "string" || v.length > 40) return undefined;
    const id = normId(v);
    const r = /^G\d+$/.test(id) ? tree.get<Research>(id) : undefined;
    return r && r.type === "research" && !r.retracted ? r.id : undefined;
  };
  const noLine = (v: unknown) => ({ code: 404, body: refusal(`no line ${String(v).slice(0, 40)}`, "directions.none", { id: String(v).slice(0, 40) }) });
  /** The commands' refusals of work off the lines as the app reads them. */
  const offlineRefused = (code: string, why: string, data: Record<string, unknown>) => {
    if (code === "archive" || code === "agent.missing") return { code: 409, body: { ...refusal(why, "directions.archive"), reasonCode: code } };
    if (code === "offline.none" || code === "directions.none" || code === "queue.none") return { code: 404, body: refusalOf(why, data, code) };
    if (code === "offline.body" || code === "queue.body") return { code: 400, body: refusal(why, code) };
    if (code === "queue.doing") return { code: 409, body: refusalOf(why, data, code) };
    return undefined;
  };

  /**
   * A branch's own choice (POST /offline/<B-…> {"mode": occasional|last|normal|never|default} | {"mode": "line", "line":
   * "G…"}): strom offline set B-… --mode … | --line G… | --default — for its new tasks too; never: its tasks wait out of
   * the queue (nothing deleted), no new work proposed there. As it is already: 200, head = parent. {branch, head, parent}.
   */
  const offlineBranchWrite = (raw: string): AppWrite => {
    const key = branchKey(raw);
    let before = "";
    return {
      what: `the branch ${key ?? raw.slice(0, 40)}`,
      codes: OFFLINE_CODES,
      busyStatus: 503,
      ask(tree, body) {
        const mode = body.mode;
        if (Object.keys(body).some((k) => k !== "mode" && k !== "line") || typeof mode !== "string" || ![...BRANCH_MODES, "default"].includes(mode) || (mode === "line") !== (body.line !== undefined))
          return badOffline(`the body: {"mode": "occasional"|"last"|"normal"|"never"|"default"} or {"mode": "line", "line": "G…"}`);
        if (actsAsArchive(tree)) return directionsArchive(tree);
        if (!key) return noBranch(raw.slice(0, 40));
        const settings = new Settings(env, {});
        const b = branchOf(tree, settings, key);
        // back to the default also for a branch that is none now (its person joined a line): the choice kept goes
        const kept = !b && mode === "default" && !!readOffline(tree).branches[key.slice(2)];
        if (!b && !kept) return noBranch(key);
        const line = mode === "line" ? lineNamed(tree, body.line) : undefined;
        if (mode === "line" && !line) return noLine(body.line);
        before = head(root);
        if (b && (mode === "default" ? !b.own : b.own && b.mode === mode && (mode !== "line" || b.line === line)))
          return { code: 200, body: { branch: branchNow(tree, settings, key)?.json ?? null, head: before, parent: before } };
        return { args: ["offline", "set", key, ...(mode === "default" ? ["--default"] : mode === "line" ? ["--line", line!] : ["--mode", mode])] };
      },
      done(tree, data, h) {
        return { branch: branchNow(tree, new Settings(env, {}), key!)?.json ?? data.branch ?? null, head: h, parent: before };
      },
      refused: (_tree, code, why, data) => offlineRefused(code, why, data),
    };
  };

  /**
   * The tree's choice (POST /offline {"mode"?: occasional|last|normal|never|default, "suggest"?: true|false}): strom
   * config set queue.offLine … --for-tree (default: config unset — this computer's, else occasional) and queue.suggestLines
   * yes|no --for-tree; as it is already: 200, head = parent. {offLine (without its branches), head, parent}.
   */
  const offlineTreeWrite = (): AppWrite => {
    let before = "";
    return {
      what: "the work off the lines",
      codes: OFFLINE_CODES,
      busyStatus: 503,
      ask(tree, body) {
        const { mode, suggest } = body;
        if (!Object.keys(body).length || Object.keys(body).some((k) => k !== "mode" && k !== "suggest") || (mode !== undefined && (typeof mode !== "string" || ![...OFF_LINE_CHOICES, "default"].includes(mode))) || (suggest !== undefined && typeof suggest !== "boolean"))
          return badOffline(`the body: {"mode"?: "occasional"|"last"|"normal"|"never"|"default", "suggest"?: true|false} (at least one)`);
        if (actsAsArchive(tree)) return directionsArchive(tree);
        before = head(root);
        const cmds: string[][] = [];
        const stored = readStored(tree.config, "queue.offLine", "");
        if (mode === "default" ? stored !== undefined : mode !== undefined && stored !== mode) cmds.push(mode === "default" ? ["config", "unset", "queue.offLine", "--for-tree"] : ["config", "set", "queue.offLine", mode as string, "--for-tree"]);
        if (suggest !== undefined && readStored(tree.config, "queue.suggestLines", "") !== (suggest ? "yes" : "no")) cmds.push(["config", "set", "queue.suggestLines", suggest ? "yes" : "no", "--for-tree"]);
        if (!cmds.length) return { code: 200, body: { offLine: offLineSummary(tree, new Settings(env, {})), head: before, parent: before } };
        return { args: cmds[0]!, ...(cmds[1] ? { then: () => cmds[1] } : {}) };
      },
      done(tree, _data, h) {
        return { offLine: offLineSummary(tree, new Settings(env, {})), head: h, parent: before };
      },
      refused: (_tree, code, why, data) => offlineRefused(code, why, data),
    };
  };

  /**
   * The tree's settings of the books (POST /books {"minTasks"?: 1…999|"default", "sameBook"?: "yes"|"no"|"default"}, at
   * least one; spec 105): strom config set books.minTasks n --for-tree, queue.sameBook yes|no --for-tree (default: config
   * unset) — as the person's own command; as it is already: 200, head = parent. {books: {settings}, head, parent}. Not in
   * an archive nor a research waiting for its agent (409 directions.archive).
   */
  const booksWrite = (): AppWrite => {
    let before = "";
    return {
      what: "the settings of the books",
      codes: { badBody: "books.body", busy: "research.busy", failed: "books.failed" },
      busyStatus: 503,
      ask(tree, body) {
        const { minTasks, sameBook } = body;
        const okMin = minTasks === undefined || minTasks === "default" || (typeof minTasks === "number" && Number.isInteger(minTasks) && minTasks >= 1 && minTasks <= BOOKS_MIN_TASKS_MAX);
        const okSame = sameBook === undefined || sameBook === "yes" || sameBook === "no" || sameBook === "default";
        if (!Object.keys(body).length || Object.keys(body).some((k) => k !== "minTasks" && k !== "sameBook") || !okMin || !okSame)
          return { code: 400, body: refusal(`the body: {"minTasks"?: 1…${BOOKS_MIN_TASKS_MAX} | "default", "sameBook"?: "yes" | "no" | "default"} (at least one)`, "books.body") };
        if (actsAsArchive(tree)) return directionsArchive(tree);
        before = head(root);
        const cmds: string[][] = [];
        const min = readStored(tree.config, "books.minTasks", "");
        if (minTasks === "default" ? min !== undefined : minTasks !== undefined && Number(min) !== minTasks)
          cmds.push(minTasks === "default" ? ["config", "unset", "books.minTasks", "--for-tree"] : ["config", "set", "books.minTasks", String(minTasks), "--for-tree"]);
        const same = readStored(tree.config, "queue.sameBook", "");
        if (sameBook === "default" ? same !== undefined : sameBook !== undefined && same !== sameBook)
          cmds.push(sameBook === "default" ? ["config", "unset", "queue.sameBook", "--for-tree"] : ["config", "set", "queue.sameBook", sameBook as string, "--for-tree"]);
        if (!cmds.length) return { code: 200, body: { books: { settings: booksSettings(tree, new Settings(env, {})) }, head: before, parent: before } };
        return { args: cmds[0]!, ...(cmds[1] ? { then: () => cmds[1] } : {}) };
      },
      done(tree, _data, h) {
        return { books: { settings: booksSettings(tree, new Settings(env, {})) }, head: h, parent: before };
      },
      refused: (_tree, code, why, data) => offlineRefused(code, why, data),
    };
  };

  /**
   * Census records as a source of this research (POST /census {"on": true|false}, exactly; spec 106): strom config set
   * census on|off --for-tree, in the app's environment — the person's decision there, turned on or off at once (no
   * window, no link). As it is already: 200, nothing written, head = parent. {census: {on, held}, head, parent} (held
   * counted after the write). 400 census.body; not in an archive nor a research waiting for its agent (409
   * census.archive, reasonCode: its state).
   */
  const censusWrite = (): AppWrite => {
    let before = "";
    return {
      what: "census records",
      codes: { badBody: "census.body", busy: "research.busy", failed: "census.failed" },
      busyStatus: 503,
      ask(tree, body) {
        const keys = Object.keys(body);
        if (keys.length !== 1 || keys[0] !== "on" || typeof body.on !== "boolean") return { code: 400, body: refusal(`the body: {"on": true} or {"on": false}`, "census.body") };
        if (actsAsArchive(tree)) return { code: 409, body: { ...refusal("nobody researches here: census records are not looked for", "census.archive"), reasonCode: stateOf(tree) } };
        before = head(root);
        const settings = new Settings(env, {});
        if (settings.census(tree.config) === body.on) return { code: 200, body: { census: censusStatus(tree, settings), head: before, parent: before } };
        return { args: ["config", "set", "census", body.on ? "on" : "off", "--for-tree"] };
      },
      done(tree, _data, h) {
        const now = Tree.open(tree.root, env);
        return { census: censusStatus(now, new Settings(env, {})), head: h, parent: before };
      },
      refused(tree, code, why) {
        if (code === "archive" || code === "agent.missing") return { code: 409, body: { ...refusal(why, "census.archive"), reasonCode: stateOf(tree) } };
        return undefined;
      },
    };
  };

  /** A house of the research as the app names it in a write's body (house: its key or A…): the row, else the refusal. */
  const houseOfBody = (tree: Tree, body: Record<string, unknown>): HouseRow | { code: number; body: Record<string, unknown> } => {
    const ref = body.house;
    if (typeof ref !== "string" || !ref.trim() || ref.length > 300) return { code: 400, body: refusal(`the body: {"house": "<its key or A…>", …}`, "house.body") };
    try {
      return houseByRef(tree, ref);
    } catch (e) {
      const code = e instanceof UsageError ? e.code : undefined;
      return code === "house.unknown" || !code
        ? { code: 404, body: refusal(`no house "${ref.slice(0, 80)}" in this research`, "house.unknown") }
        : { code: 400, body: { ...refusal(errorText(e), "house.body"), reasonCode: code } };
    }
  };
  /** A house whole as GET /houses/<key> gives it (its rev with it), after a write. */
  const houseAnswer = (tree: Tree, ref: string): Record<string, unknown> => {
    const rows = houseRows(tree);
    return { ...houseView(tree, houseByRef(tree, ref, rows)), rev: housesRev(tree, rows) };
  };
  /** A house's write refused by its command: as GET /houses says a house, the body's codes 400, an archive 409. */
  const houseRefused = (tree: Tree, code: string, why: string): { code: number; body: Record<string, unknown> } | undefined => {
    if (code === "house.unknown") return { code: 404, body: refusal(why, "house.unknown") };
    if (code === "archive" || code === "agent.missing") return { code: 409, body: { ...refusal(why, "house.archive"), reasonCode: stateOf(tree) } };
    if (code.startsWith("house.") || code === "usage") return { code: 400, body: { ...refusal(why, "house.body"), reasonCode: code } };
    return undefined;
  };
  const HOUSE_WRITE_CODES = { badBody: "house.body", busy: "research.busy", failed: "house.failed" };
  const houseArchive = (tree: Tree) => ({ code: 409, body: { ...refusal("nothing is written of houses in an archive of Strom", "house.archive"), reasonCode: stateOf(tree) } });

  /**
   * The history of the tree's houses looked for by itself (POST /houses {"on": true|false}, exactly; spec 030 §2.5, part
   * 2): strom config set houses on|off --for-tree, in the app's environment — the person's decision there (the app shows
   * auto and estimate first), turned on or off at once (no window, no link), as census records. As it is already: 200,
   * nothing written, head = parent. {houses: <as /status houses>, head, parent}. 400 house.body; not in an archive nor a
   * research waiting for its agent (409 house.archive, reasonCode: its state).
   */
  const housesWrite = (): AppWrite => {
    let before = "";
    return {
      what: "the history of the houses",
      codes: HOUSE_WRITE_CODES,
      busyStatus: 503,
      ask(tree, body) {
        const keys = Object.keys(body);
        if (keys.length !== 1 || keys[0] !== "on" || typeof body.on !== "boolean") return { code: 400, body: refusal(`the body: {"on": true} or {"on": false}`, "house.body") };
        if (actsAsArchive(tree)) return houseArchive(tree);
        before = head(root);
        const settings = new Settings(env, {});
        if (settings.houses(tree.config) === body.on) return { code: 200, body: { houses: housesBridgeStatus(tree, settings), head: before, parent: before } };
        return { args: ["config", "set", "houses", body.on ? "on" : "off", "--for-tree"] };
      },
      done(tree, _data, h) {
        const now = Tree.open(tree.root, env);
        return { houses: housesBridgeStatus(now, new Settings(env, {})), head: h, parent: before };
      },
      refused(tree, code, why) {
        if (code === "archive" || code === "agent.missing") return { code: 409, body: { ...refusal(why, "house.archive"), reasonCode: stateOf(tree) } };
        return undefined;
      },
    };
  };

  /**
   * The history of a house asked for in the app (POST /houses/request {house: <key|A…>, with?: [<key|A…>, …]}; spec 030
   * §2.6, part 2): only a house where somebody of the tree lived, its municipality a place record; with: at most
   * HOUSE_GROUP_MAX − 1 neighbouring houses of the same municipality. The history of the houses off: it spends the
   * agent's session and the bridge never starts one — 403 house.link with the link that asks the person in the terminal
   * (strom-research://house?tree=…&house=<key>&do=search[&with=…]) and the estimate. On: strom house request --yes — the
   * person's word given in the app — its task (and its municipality's skeleton when it has none) on top of the queue:
   * {house: <its row, as GET /houses>, task, state: "queued", town?, head, parent}. 400 house.body (reasonCode
   * house.town: its municipality no place record yet), 404 house.unknown (nobody of the tree lived there), 409
   * house.archive (reasonCode: its state), 503 research.busy.
   */
  const houseRequestWrite = (): AppWrite => {
    let before = "";
    return {
      what: "a house asked for",
      codes: HOUSE_WRITE_CODES,
      busyStatus: 503,
      ask(tree, body) {
        const bad = (why: string) => ({ code: 400, body: refusal(why, "house.body") });
        const shape = `the body: {"house": "<its key or A…>", "with"?: ["<key or A…>"] (at most ${HOUSE_GROUP_MAX - 1})}`;
        if (Object.keys(body).some((k) => k !== "house" && k !== "with")) return bad(shape);
        const more = body.with;
        if (more !== undefined && (!Array.isArray(more) || more.length > HOUSE_GROUP_MAX - 1 || !more.every((w) => typeof w === "string" && !!w.trim() && w.length <= 300))) return bad(shape);
        const row = houseOfBody(tree, body);
        if ("code" in row) return row;
        if (actsAsArchive(tree)) return houseArchive(tree);
        const lived = (r: HouseRow) => !!r.tree?.persons.size;
        if (!lived(row)) return { code: 404, body: refusal(`nobody of the tree lived in the house "${row.key}" — only such a house is researched`, "house.unknown") };
        const others: HouseRow[] = [];
        for (const w of (more as string[] | undefined) ?? []) {
          const r = houseOfBody(tree, { house: w });
          if ("code" in r) return r;
          if (!lived(r)) return { code: 404, body: refusal(`nobody of the tree lived in the house "${r.key}" — only such a house is researched`, "house.unknown") };
          if (r.place.key !== row.place.key) return bad(`"${r.key}" is in another municipality than "${row.key}" — only houses of one municipality go together`);
          if (r.key !== row.key && !others.some((o) => o.key === r.key)) others.push(r);
        }
        if (!row.place.id) return { code: 400, body: { ...refusal(`the municipality of the house "${row.key}" is no place record yet`, "house.body"), reasonCode: "house.town" } };
        const settings = new Settings(env, {});
        if (!settings.houses(tree.config)) {
          const link = linkText({ action: "house", tree: tree.config.id, do: "search", house: row.key, ...(others.length ? { with: others.map((o) => o.key).join(",") } : {}) }, linkScheme(env));
          const asked = houseAskEstimate(tree, row.place.id, 1 + others.length);
          const { perHouse, perTown } = houseEstimate(tree);
          return { code: 403, body: { ...said(tree.lang, "ui.house.link"), link, estimate: { ...asked, perHouse, perTown } } };
        }
        before = head(root);
        return { args: ["house", "request", "--yes", ...others.map((o) => `--with=${o.id ?? o.key}`), "--", row.id ?? row.key] };
      },
      done(tree, data, h) {
        const now = Tree.open(tree.root, env);
        const rows = houseRows(now);
        const row = houseByRef(now, String(data.house), rows);
        return { house: listRow(row), task: data.task, state: "queued", ...(typeof data.town === "string" ? { town: data.town } : {}), head: h, parent: before };
      },
      refused: houseRefused,
    };
  };

  /**
   * The story of a house asked for in the app (POST /houses/story {house: <key|A…>}; spec 145 T4): strom house story
   * --yes — the person's word given in the app — its task on top of the queue, the bridge starting no agent: {house: <the
   * house whole, as GET /houses/<ref>>, task, made, head, parent}. 404 house.unknown, 400 house.body (reasonCode
   * house.story.none: nothing of it written), 409 house.archive (reasonCode: its state).
   */
  const houseStoryWrite = (): AppWrite => {
    let before = "";
    return {
      what: "the story of a house asked for",
      codes: HOUSE_WRITE_CODES,
      busyStatus: 503,
      ask(tree, body) {
        if (Object.keys(body).some((k) => k !== "house")) return { code: 400, body: refusal(`the body: {"house": "<its key or A…>"}`, "house.body") };
        const row = houseOfBody(tree, body);
        if ("code" in row) return row;
        if (actsAsArchive(tree)) return houseArchive(tree);
        if (!row.id) return { code: 400, body: { ...refusal(`nothing of the house "${row.key}" is written yet — its story is written from its research`, "house.body"), reasonCode: "house.story.none" } };
        before = head(root);
        return { args: ["house", "story", "--yes", "--", row.id] };
      },
      done(tree, data, h) {
        const now = Tree.open(tree.root, env);
        return { house: houseAnswer(now, String(data.house)), task: data.task, made: data.made === true, head: h, parent: before };
      },
      refused: houseRefused,
    };
  };

  /**
   * The person's word on a house in the app (POST /houses/confirm {house, what: renumber|location|notSame, id?, lat?,
   * lon?}; spec 030 §2.7, §4.2): strom house confirm in the app's environment — the person's decision there, no window.
   * {house: <the house whole, as GET /houses/<key>>, head, parent}. 400 house.body, 404 house.unknown (also a house
   * the research has no record of: nothing of it to confirm), 409 house.archive (reasonCode: its state).
   */
  const houseConfirmWrite = (): AppWrite => {
    let id = "";
    return {
      what: "a house confirmed",
      codes: HOUSE_WRITE_CODES,
      busyStatus: 503,
      ask(tree, body) {
        const bad = (why: string) => ({ code: 400, body: refusal(why, "house.body") });
        const what = body.what;
        if (what !== "renumber" && what !== "location" && what !== "notSame") return bad(`the body: {"house", "what": "renumber" | "location" | "notSame", "id"?, "lat"?, "lon"?}`);
        if (body.id !== undefined && (typeof body.id !== "string" || !/^[a-z]\d{1,6}$/u.test(body.id))) return bad(`id: an item of the house ("n2")`);
        for (const k of ["lat", "lon"] as const) if (body[k] !== undefined && (typeof body[k] !== "number" || !Number.isFinite(body[k]))) return bad(`${k}: a number`);
        if ((body.lat === undefined) !== (body.lon === undefined)) return bad("lat and lon together");
        if (Math.abs(Number(body.lat ?? 0)) > 90 || Math.abs(Number(body.lon ?? 0)) > 180) return bad("lat, lon: a point on the Earth");
        const row = houseOfBody(tree, body);
        if ("code" in row) return row;
        if (actsAsArchive(tree)) return houseArchive(tree);
        if (!row.id) return { code: 404, body: refusal(`nothing to confirm of "${row.key}": the research has no record of it yet`, "house.unknown") };
        id = row.id;
        return {
          args: [
            "house", "confirm", row.id, what === "notSame" ? "not-same" : what,
            ...(typeof body.id === "string" ? [body.id] : []),
            ...(typeof body.lat === "number" ? ["--lat", String(body.lat), "--lon", String(body.lon)] : []),
          ],
        };
      },
      done(tree, _data, h) {
        return { house: houseAnswer(Tree.open(tree.root, env), id), head: h };
      },
      refused: houseRefused,
    };
  };

  /**
   * What the person gives a house in the app (POST /houses/material {house, memory?: {text, witness?, witnessConsent},
   * name?, files?: [I…]}; spec 030 §2.7, §4.2 question 7): files the research has made the house's, a memory written
   * down as a material of it (its witness named only with witnessConsent true), the house's name after a family — the
   * person's (nameBy user). strom house add material, then strom house add name; no task. A house of the tree's facts
   * gets its record. {house: <the house whole>, head, parent}. 400 house.body (reasonCode house.town: its municipality
   * is no place record yet), 404 house.unknown, 409 house.archive.
   */
  const houseMaterialWrite = (): AppWrite => {
    let ref = "";
    return {
      what: "a house's material",
      codes: HOUSE_WRITE_CODES,
      busyStatus: 503,
      max: 128 * 1024,
      ask(tree, body) {
        const bad = (why: string) => ({ code: 400, body: refusal(why, "house.body") });
        const files = body.files;
        if (files !== undefined && (!Array.isArray(files) || files.length > 500 || !files.every((f) => typeof f === "string" && /^I\d{1,9}$/u.test(f)))) return bad(`files: the material's IDs ["I…"]`);
        const memory = body.memory;
        let text: string | undefined;
        let witness: string | undefined;
        if (memory !== undefined) {
          const m = memory as Record<string, unknown>;
          if (!m || typeof m !== "object" || Array.isArray(m) || typeof m.text !== "string" || !m.text.trim() || m.text.length > 20000) return bad(`memory: {"text": "…", "witness"?: "…", "witnessConsent": true | false}`);
          if (m.witness !== undefined && (typeof m.witness !== "string" || m.witness.length > 200)) return bad("memory.witness: a name");
          if (m.witnessConsent !== undefined && typeof m.witnessConsent !== "boolean") return bad("memory.witnessConsent: true or false");
          text = m.text;
          if (m.witnessConsent === true && typeof m.witness === "string" && m.witness.trim()) witness = m.witness;
        }
        const name = body.name;
        if (name !== undefined && (typeof name !== "string" || !name.trim() || name.length > 200)) return bad("name: the house's name after a family");
        if (!(files as unknown[] | undefined)?.length && text === undefined && name === undefined) return bad(`the body: {"house", "memory"?, "name"?, "files"?} — one of them at least`);
        const row = houseOfBody(tree, body);
        if ("code" in row) return row;
        if (actsAsArchive(tree)) return houseArchive(tree);
        for (const f of (files as string[] | undefined) ?? []) if (!tree.get<Input>(f)) return { code: 404, body: { ...refusal(`no material ${f}`, "house.unknown"), file: f } };
        ref = row.id ?? row.key;
        const material = (files as string[] | undefined)?.length || text !== undefined
          ? ["house", "add", "material", ...((files as string[] | undefined) ?? []).map((f) => `--input=${f}`), ...(text !== undefined ? [`--memory=${text}`] : []), ...(witness ? [`--witness=${witness}`, "--witness-consent"] : []), "--", ref]
          : undefined;
        const named = (house: string) => ["house", "add", "name", `--name=${String(name)}`, "--", house];
        // the name after the material: of the record the first one made for a house of the tree's facts
        if (material && typeof name === "string") return { args: material, then: (first) => named(typeof first.house === "string" ? first.house : ref) };
        if (typeof name === "string") return { args: named(ref) };
        return { args: material! };
      },
      done(tree, data, h) {
        const id = typeof data.house === "string" ? data.house : ref;
        return { house: houseAnswer(Tree.open(tree.root, env), id), head: h };
      },
      refused: houseRefused,
    };
  };

  /**
   * The batches the app sends sorted by the agent by themselves once whole (POST /intake {"auto": true|false}, exactly;
   * spec 130): strom config set intake.auto on|off --for-tree, in the app's environment — the person's decision there,
   * turned on or off at once (no window, no link). As it is already: 200, nothing written, head = parent. {intake: {auto},
   * head, parent}. 400 intake.body; not in an archive nor a research waiting for its agent (409 intake.archive,
   * reasonCode: its state).
   */
  const intakeWrite = (): AppWrite => {
    let before = "";
    return {
      what: "the batches sorted by themselves",
      codes: { badBody: "intake.body", busy: "research.busy", failed: "intake.failed" },
      busyStatus: 503,
      ask(tree, body) {
        const keys = Object.keys(body);
        if (keys.length !== 1 || keys[0] !== "auto" || typeof body.auto !== "boolean") return { code: 400, body: refusal(`the body: {"auto": true} or {"auto": false}`, "intake.body") };
        if (actsAsArchive(tree)) return { code: 409, body: { ...refusal("nobody researches here: no batch is sorted", "intake.archive"), reasonCode: stateOf(tree) } };
        before = head(root);
        if (new Settings(env, {}).intakeAuto(tree.config) === body.auto) return { code: 200, body: { intake: { auto: body.auto }, head: before, parent: before } };
        return { args: ["config", "set", "intake.auto", body.auto ? "on" : "off", "--for-tree"] };
      },
      done(tree, _data, h) {
        const now = Tree.open(tree.root, env);
        return { intake: { auto: new Settings(env, {}).intakeAuto(now.config) }, head: h, parent: before };
      },
      refused(tree, code, why) {
        if (code === "archive" || code === "agent.missing") return { code: 409, body: { ...refusal(why, "intake.archive"), reasonCode: stateOf(tree) } };
        return undefined;
      },
    };
  };

  /**
   * Who may take a question away from the app (spec 123 P2: sort.confirm no, run.confirm no — a standing yes to what the
   * agent and its readers spend): only the Strom app in a browser on this computer, the person's switch confirmed in the
   * app's own dialog. Never a device of the home network (its gateway names it: "device") nor what is no browser's fetch
   * (a page's fetch says Sec-Fetch-Mode: cors, which a program has to make up: "browser"). undefined: it may. A fence,
   * not a vault: an agent that read the bridge's secret could make up the browser's headers too — kept away by the tree's
   * rules and hooks (core/bridgeguard.ts), and the change is said in live.log in the research's language.
   */
  const lowersFrom = (req: http.IncomingMessage): "device" | "browser" | undefined => {
    if (deviceOf(req) || req.headers[DEVICE_HEADER] !== undefined) return "device";
    if (req.headers["sec-fetch-mode"] !== "cors") return "browser";
    return undefined;
  };

  /**
   * The question before a sort of the material (POST /settings/sort {"confirm": "ask" | "no"}, exactly; spec 102 U8,
   * feature sort.confirm): asked again from the app at once (strom config set sort.confirm ask --for-tree, from
   * anywhere); taken away (a standing yes to paid readings: strom config set sort.confirm no --for-tree) by the person
   * in the terminal or in the Strom app on this computer (spec 123 P2, feature sort.confirm.app; said in live.log) —
   * never by a device of the home network nor what is no browser's fetch: 403 sort.raise {command, reason: device |
   * browser}. As it is already: 200, nothing written, head = parent. {sort: {confirm}, head, parent}. 400 sort.body; not
   * in an archive nor a research waiting for its agent (409 sort.archive, reasonCode: its state).
   */
  const sortConfirmWrite = (req: http.IncomingMessage): AppWrite => {
    let before = "";
    let lowered = false;
    return {
      what: "the question before a sort",
      codes: { badBody: "sort.body", busy: "research.busy", failed: "sort.failed" },
      busyStatus: 503,
      ask(tree, body) {
        const keys = Object.keys(body);
        if (keys.length !== 1 || keys[0] !== "confirm" || (body.confirm !== "ask" && body.confirm !== "no")) return { code: 400, body: refusal(`the body: {"confirm": "ask"} or {"confirm": "no"}`, "sort.body") };
        if (actsAsArchive(tree)) return { code: 409, body: { ...refusal("nobody researches here: nothing is sorted", "sort.archive"), reasonCode: stateOf(tree) } };
        before = head(root);
        if (new Settings(env, {}).sortConfirm(tree.config) === body.confirm) return { code: 200, body: { sort: { confirm: body.confirm }, head: before, parent: before } };
        const command = "strom config set sort.confirm no --for-tree";
        if (body.confirm === "no") {
          const reason = lowersFrom(req);
          if (reason) return { code: 403, body: { ...refusal(`a sort without the question only by the person, in the terminal or the Strom app on this computer: ${command}`, "sort.raise", { reason }), command, reason } };
          lowered = true;
          return { args: ["config", "set", "sort.confirm", "no", "--for-tree"] };
        }
        return { args: ["config", "set", "sort.confirm", "ask", "--for-tree"] };
      },
      done(tree, _data, h) {
        const now = Tree.open(tree.root, env);
        const confirm = new Settings(env, {}).sortConfirm(now.config);
        if (lowered && confirm === "no") noteLive(root, ui(langOf(root, env), "ui.live.unasked.sort"));
        return { sort: { confirm }, head: h, parent: before };
      },
      refused(tree, code, why) {
        if (code === "archive" || code === "agent.missing") return { code: 409, body: { ...refusal(why, "sort.archive"), reasonCode: stateOf(tree) } };
        return undefined;
      },
    };
  };

  /**
   * The person's answer to a file of the inbox set aside (POST /books/aside {file, do: "discard" | "take" | "image",
   * image?: n}; feature inbox.aside): strom media aside <file> --discard | --take | --image n — the same file as another
   * image: only discard (409 aside.same); another scan: discard (the image stays, the file into the system's trash),
   * take (it is the image of its number: the one there withdrawn, a cited one stays beside it), image n (it is image n,
   * not taken yet; 409 aside.taken). {aside: [the list now], done, added, replaced, head, parent}; 404 aside.unknown (no
   * such file set aside: answered already). Not in an archive nor a research waiting for its agent (409 directions.archive).
   */
  const asideWrite = (): AppWrite => {
    let before = "";
    return {
      what: "a file of the inbox set aside",
      codes: { badBody: "aside.body", busy: "research.busy", failed: "aside.failed" },
      busyStatus: 503,
      ask(tree, body) {
        const { file, do: act, image } = body;
        const ok =
          typeof file === "string" && file.length > 0 && file.length < 1024 && !/[\\/]/u.test(file) &&
          (act === "discard" || act === "take" || (act === "image" && typeof image === "number" && Number.isInteger(image) && image >= 1)) &&
          Object.keys(body).every((k) => k === "file" || k === "do" || (k === "image" && act === "image"));
        if (!ok) return { code: 400, body: refusal(`the body: {"file": "<as books.aside lists it>", "do": "discard" | "take" | "image", "image"?: n}`, "aside.body") };
        if (actsAsArchive(tree)) return directionsArchive(tree);
        before = head(root);
        return { args: ["media", "aside", file as string, act === "image" ? `--image=${image as number}` : `--${act as string}`] };
      },
      done(tree, data, h) {
        return { ...data, aside: asideJson(tree, new Settings(env, {})), head: h, parent: before };
      },
      refused(tree, code, why) {
        if (code === "aside.unknown") return { code: 404, body: { ...refusal(why, code), aside: asideJson(tree, new Settings(env, {})) } };
        if (code === "aside.same" || code === "aside.taken") return { code: 409, body: refusal(why, code) };
        return undefined;
      },
    };
  };

  /**
   * The bridge itself (POST /live): {"idleMinutes": n} — strom config set live.idleMinutes n (this computer's, every
   * tree's bridge; nothing of the research committed; as it is already: 200, nothing written) — or {"do": "stop"}: ended
   * as strom live stop ends it (the end event says by: "app"), once what the app sent is written — but its address kept,
   * so the bridge started again (strom live start, the link live&do=start, the research opened from the app) is where the
   * app looks; new work in the tree never brings it back (only an end when idle does). An archive too: no agent in it.
   */
  /**
   * A run asked to stop (POST /runs/stop {"run": "<id>"}, spec 126, feature run.stop): it finishes the task at work and
   * starts no next one (strom run stop <id>) — {ok: true, run: {…, state: "finishing"}}; no such run alive: 404
   * runs.unknown. Nothing in data/ is written: the run reads the stop between its sessions and while it waits.
   */
  const runStopWrite = (): AppWrite => ({
    what: "a run's stop",
    codes: { badBody: "runs.body", busy: "research.busy", failed: "runs.failed" },
    busyStatus: 503,
    ask(tree, body) {
      const id = body.run;
      if (Object.keys(body).length !== 1 || typeof id !== "string" || !RUN_ID.test(id)) return { code: 400, body: refusal(`the body: {"run": "run-…"}`, "runs.body") };
      if (!liveWorkers(root).some((w) => w.id === id)) return { code: 404, body: refusal(`no run ${id} at work`, "runs.unknown", { run: id }) };
      askRunStop(root, id, "stop", "app");
      noteLive(root, `${id}: asked to stop in the Strom app`);
      const own = () => new Settings(env, {}).agent(tree.config).value;
      const run = runsLive(root, own).runs.find((r) => r.id === id);
      return { code: 200, body: { ok: true, run: run ?? null } };
    },
    done: (_tree, data) => data,
    refused: () => undefined,
  });

  /**
   * The limit of runs at once (POST /settings/runs {"max": n}, spec 126, feature run.limit): lowered by the app at once
   * (strom config set run.parallel n; the runs at work go on) — {ok: true, limits}; raised only by the person in the
   * terminal (each run spends the subscription): 403 runs.raise {command}; outside 1–10: 400 runs.max.
   */
  const runsLimitWrite = (): AppWrite => ({
    what: "the limit of runs",
    codes: { badBody: "runs.max", busy: "research.busy", failed: "runs.failed" },
    busyStatus: 503,
    ask(_tree, body) {
      const n = body.max;
      if (Object.keys(body).length !== 1 || typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > RUN_PARALLEL_MAX)
        return { code: 400, body: refusal(`the body: {"max": 1…${RUN_PARALLEL_MAX}}`, "runs.max") };
      const limits = runLimits(root, new Settings(env, {}));
      const command = `strom config set run.parallel ${n}`;
      if (n > limits.maxRuns) return { code: 403, body: { ...refusal(`more runs at once only by the person in the terminal: ${command}`, "runs.raise", { max: String(n) }), command } };
      if (n === limits.maxRuns) return { code: 200, body: { ok: true, limits } };
      return { args: ["config", "set", "run.parallel", String(n)] };
    },
    done: () => ({ ok: true, limits: runLimits(root, new Settings(env, {})) }),
    refused: () => undefined,
  });

  /**
   * The question before the agent starts from the Strom app's links (POST /settings/run {"confirm": "ask" | "no"},
   * exactly; spec 123 P2, feature run.confirm; this computer's, every research): asked again from anywhere (strom config
   * unset run.confirm); taken away (a standing yes to the subscription or AI credit: strom config set run.confirm no) by
   * the person in the terminal or in the Strom app on this computer (said in live.log) — never by a device of the home
   * network nor what is no browser's fetch: 403 run.raise {command, reason: device | browser}. {run: {confirm}} (as it is
   * already: nothing written). 400 run.body; not in an archive nor a research waiting for its agent (409 run.archive,
   * reasonCode: its state). What says a price in money, consents, runs nobody watches and the gate run.gate still ask.
   */
  const runConfirmWrite = (req: http.IncomingMessage): AppWrite => {
    let lowered = false;
    return {
      what: "the question before the agent starts",
      codes: { badBody: "run.body", busy: "research.busy", failed: "run.failed" },
      busyStatus: 503,
      ask(tree, body) {
        const keys = Object.keys(body);
        if (keys.length !== 1 || keys[0] !== "confirm" || (body.confirm !== "ask" && body.confirm !== "no")) return { code: 400, body: refusal(`the body: {"confirm": "ask"} or {"confirm": "no"}`, "run.body") };
        if (actsAsArchive(tree)) return { code: 409, body: { ...refusal("nobody researches here: no agent starts", "run.archive"), reasonCode: stateOf(tree) } };
        if (new Settings(env, {}).runConfirm() === body.confirm) return { code: 200, body: { run: { confirm: body.confirm } } };
        if (body.confirm === "ask") return { args: ["config", "unset", "run.confirm"] };
        const command = "strom config set run.confirm no";
        const reason = lowersFrom(req);
        if (reason) return { code: 403, body: { ...refusal(`the agent without the question only by the person, in the terminal or the Strom app on this computer: ${command}`, "run.raise", { reason }), command, reason } };
        lowered = true;
        return { args: ["config", "set", "run.confirm", "no"] };
      },
      done() {
        const confirm = new Settings(env, {}).runConfirm();
        if (lowered && confirm === "no") noteLive(root, ui(langOf(root, env), "ui.live.unasked.run"));
        return { run: { confirm } };
      },
      refused(tree, code, why) {
        if (code === "archive" || code === "agent.missing") return { code: 409, body: { ...refusal(why, "run.archive"), reasonCode: stateOf(tree) } };
        return undefined;
      },
    };
  };

  const liveWrite = (): AppWrite => ({
    what: "the bridge's idle time",
    codes: { badBody: "live.body", busy: "research.busy", failed: "live.failed" },
    busyStatus: 503,
    ask(_tree, body) {
      const keys = Object.keys(body);
      if (keys.length === 1 && body.do === "stop") {
        const was = readLast(root);
        if (was?.pid === process.pid && !was.ended) writeLast(root, { ...was, ended: { at: new Date().toISOString(), reason: "stopped in the Strom app", kind: "stopped" } });
        noteLive(root, "stop asked: in the Strom app (its address kept)");
        // taken by the stop's own watch: it waits for what the app sent being written, then ends (the answer goes first)
        try {
          fs.writeFileSync(`${liveStopFile(root)}.${process.pid}`, JSON.stringify({ pid: process.pid, why: "stopped in the Strom app", back: false, by: "app" } satisfies StopAsk));
          fs.renameSync(`${liveStopFile(root)}.${process.pid}`, liveStopFile(root));
        } catch (e) {
          return { code: 500, body: refusal(`the bridge could not be asked to end: ${errorText(e)}`, "live.failed") };
        }
        return { code: 202, body: { stopping: true } };
      }
      const n = body.idleMinutes;
      if (keys.length !== 1 || typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > LIVE_IDLE_MAX_MINUTES)
        return { code: 400, body: refusal(`the body: {"idleMinutes": 0…${LIVE_IDLE_MAX_MINUTES}} (whole minutes; 0: never by itself) or {"do": "stop"}`, "live.body") };
      if (new Settings(env, {}).liveIdleMinutes() === n && readStored(loadUserConfig(env), "live.idleMinutes", "") !== undefined) return { code: 200, body: { live: liveState(env) } };
      return { args: ["config", "set", "live.idleMinutes", String(n)] };
    },
    done() {
      idleMs = new Settings(env, {}).liveIdleMs();
      idleRead = Date.now();
      lastAsked = Date.now();
      return { live: liveState(env) };
    },
    refused: () => undefined,
  });

  /**
   * A task's own turn (POST /queue/<T…> {"do": "next"|"last"|"default"}): strom task order T… --next|--last|--default —
   * next once, before everything but the work at hand (the last chosen first); last after everything; default back to
   * the queue's order. {"do": "restore", "was": {} | {"own": "next"|"last", "at": "<ISO>"}}: the turn put back exactly as
   * it was (strom task order --default | --restore <own>@<at>: at not later than now, at most 30 days ago) — feature
   * queue.next. Any open task. {task (as queue[] has it now), was (its turn before: {} or {own, at}), head, parent};
   * 400 queue.body, 404 queue.none (no open task), 409 queue.doing (at work).
   */
  const queueWrite = (raw: string): AppWrite => {
    const id = /^[Tt]\d{1,9}$/.test(raw) ? normId(raw) : raw.slice(0, 32);
    let before = "";
    let was: Record<string, unknown> = {};
    const shape = `the body: {"do": "next"|"last"|"default"} | {"do": "restore", "was": {} | {"own": "next"|"last", "at": "<ISO time>"}}`;
    return {
      what: `the turn of ${id}`,
      codes: { badBody: "queue.body", busy: "research.busy", failed: "queue.failed" },
      busyStatus: 503,
      ask(tree, body) {
        const restore = body.do === "restore";
        if (Object.keys(body).some((k) => k !== "do" && !(restore && k === "was")) || !["next", "last", "default", "restore"].includes(body.do as string)) return { code: 400, body: refusal(shape, "queue.body") };
        let args = [`--${body.do as string}`];
        if (restore) {
          const w = body.was;
          if (!w || typeof w !== "object" || Array.isArray(w) || Object.keys(w).some((k) => k !== "own" && k !== "at")) return { code: 400, body: refusal(shape, "queue.body") };
          const turn = w as Record<string, unknown>;
          if (!Object.keys(turn).length) args = ["--default"];
          else {
            const r = restoredTurn(turn.own, turn.at);
            if ("bad" in r) return { code: 400, body: refusal(`${r.bad} — ${shape}`, "queue.body") };
            args = ["--restore", `${r.do}@${r.at}`];
          }
        }
        if (actsAsArchive(tree)) return directionsArchive(tree);
        const t = /^T\d+$/.test(id) ? tree.get<Task>(id) : undefined;
        if (!t || t.type !== "task" || t.retracted || (t.state !== "open" && t.state !== "doing")) return { code: 404, body: refusal(`${id} is no open task`, "queue.none", { task: id }) };
        if (t.state === "doing") return { code: 409, body: refusal(`${id} is in progress: its turn is now`, "queue.doing", { task: id }) };
        before = head(root);
        // its turn before the write, for the app to put it back exactly (restore)
        was = turnWas(t, tree.list<Session>("session").filter((s) => s.state !== "open" && s.task));
        return { args: ["task", "order", id, ...args] };
      },
      done(tree, _data, h) {
        return { task: queueTask(tree, new Settings(env, {}), id) ?? null, was, head: h, parent: before };
      },
      refused: (_tree, code, why, data) => offlineRefused(code, why, data),
    };
  };

  /**
   * The answer to a send asked about (POST /waiting/W-S-I… {"do": "import"|"own"}; 1127): import — strom sync as-import
   * I… --apply (backed up first; the values unchanged since the send and unconfirmed the family tree's), own — --own
   * (nothing changes, never asked again). The command is the person's alone: the bridge's strom writes as the person
   * (STROM_FOR_APP, no agent's marks). {input, answer, values?, persons?, backup?: true, head, parent}; 400 waiting.body,
   * 404 waiting.none when it waits no more (answered elsewhere: the answer holds once).
   */
  const importAnswerWrite = (raw: string): AppWrite => {
    const id = raw.slice(0, 32);
    let before = "";
    let said = "";
    return {
      what: `the answer for ${id}`,
      codes: { badBody: "waiting.body", busy: "research.busy", failed: "waiting.failed" },
      busyStatus: 503,
      ask(tree, body) {
        if (Object.keys(body).some((k) => k !== "do") || (body.do !== "import" && body.do !== "own")) return { code: 400, body: refusal(`the body: {"do": "import"} or {"do": "own"}`, "waiting.body") };
        const w = importWaiting(tree, id);
        if (!w?.importSend) return noImport(id);
        before = head(root);
        said = body.do;
        return { args: ["sync", "as-import", w.importSend.input, said === "import" ? "--apply" : "--own"] };
      },
      done(_tree, data, h) {
        const input = typeof data.input === "string" ? data.input : id.replace(/^W-S-/iu, "");
        return {
          input,
          answer: said,
          ...(said === "import" ? { values: data.values ?? 0, persons: data.persons ?? 0, ...(data.backup ? { backup: true } : {}) } : {}),
          head: h,
          parent: before,
        };
      },
      // answered in the terminal meanwhile, the send taken back, marked already: it waits no more
      refused: (_tree, code, why) =>
        code === "sync.not-sync" || code === "sync.undone" || code === "sync.as-import.applied" ? { code: 404, body: refusal(why, "waiting.none", { id }) } : undefined,
    };
  };

  /**
   * The answer to a branch that grows (POST /waiting/W-B-… {"do": "line"|"keep"|"never", "line"?: "G…"}): strom offline
   * answer B-… — line: added to the nearest line (or the one named); keep: as it is, proposed again at twice the size;
   * never: not researched. A new line for it: POST /directions with "branch". {branch, answer, head, parent}; 404
   * waiting.none when it waits no more (answered elsewhere), 404 offline.none, 404 directions.none (no line to add it to).
   */
  const branchAnswerWrite = (raw: string): AppWrite => {
    const id = raw.slice(0, 48);
    const key = branchKey(id.replace(/^W-/iu, ""));
    let before = "";
    let said = "";
    return {
      what: `the answer for ${key ?? id}`,
      codes: OFFLINE_CODES,
      busyStatus: 503,
      ask(tree, body) {
        const word = body.do;
        if (Object.keys(body).some((k) => k !== "do" && k !== "line") || typeof word !== "string" || !["line", "keep", "never"].includes(word) || (body.line !== undefined && word !== "line"))
          return badOffline(`the body: {"do": "line"|"keep"|"never", "line"?: "G…"} (a new line for it: POST /directions with "branch")`);
        if (actsAsArchive(tree)) return directionsArchive(tree);
        if (!key) return noBranch(id);
        const b = branchOf(tree, new Settings(env, {}), key);
        if (!b) return noBranch(key);
        if (!b.grows) return { code: 404, body: refusal(`${id} waits no more: answered, or the branch is smaller than a line is proposed for`, "waiting.none", { id }) };
        const line = body.line !== undefined ? lineNamed(tree, body.line) : undefined;
        if (body.line !== undefined && !line) return noLine(body.line);
        if (word === "line" && !line && !b.nearest) return { code: 404, body: refusal(`${key} is near no line: name one ("line": "G…")`, "directions.none", { id: "" }) };
        before = head(root);
        said = word;
        return { args: ["offline", "answer", key, word, ...(line ? ["--line", line] : [])] };
      },
      done(tree, _data, h) {
        return { branch: branchNow(tree, new Settings(env, {}), key!)?.json ?? null, answer: said, head: h, parent: before };
      },
      refused: (_tree, code, why, data) => offlineRefused(code, why, data),
    };
  };

  /**
   * The history of the places in the stories as the app turns it (POST /stories {"history": false|true}): for this tree
   * (strom config set stories.history no|yes --for-tree; the person's own config stays) — both ways, nothing spent by
   * it (the stories are written anyway), an approved story never rewritten for it. On while the history of the places
   * is off: refused 409 history.off with the link that turns that on (the person's alone, in the terminal). 400 stories.body.
   */
  const storiesWrite = (): AppWrite => {
    let before = "";
    let on = false;
    return {
      what: "the stories of the research",
      codes: { badBody: "stories.body", busy: "research.busy", failed: "stories.failed" },
      busyStatus: 503,
      ask(tree, body) {
        const keys = Object.keys(body);
        if (!keys.length || keys.some((k) => k !== "history") || typeof body.history !== "boolean") return { code: 400, body: refusal(`the body: {"history": false} or {"history": true}`, "stories.body") };
        on = body.history;
        const settings = new Settings(env, {});
        if (on && !historyOn(tree, settings)) {
          const link = linkText({ action: "experiment", tree: tree.config.id, name: "history", do: "on" }, linkScheme(env));
          return { code: 409, body: { ...said(tree.lang, "ui.experiments.link"), code: "history.off", link } };
        }
        before = head(root);
        if (settings.storyHistory(tree.config) === on) return { code: 200, body: { stories: { history: on }, head: before, parent: before } };
        return { args: ["config", "set", "stories.history", on ? "yes" : "no", "--for-tree"] };
      },
      done(_tree, _data, h) {
        return { stories: { history: on }, head: h, parent: before };
      },
      refused() {
        return undefined;
      },
    };
  };

  /**
   * Who decides the hypotheses as the app sets it (POST /hypotheses {"decide": "person"|"agent"}): for this tree (strom
   * config set hypotheses.decide … --for-tree). Back to the person at once; the agent deciding is the person's yes alone,
   * in the terminal: 403 hypotheses.link with the link strom-research://hypotheses?tree=…&decide=agent. 409
   * hypotheses.archive (nobody decides there), 400 hypotheses.invalid.
   */
  const hypothesesWrite = (): AppWrite => {
    let before = "";
    return {
      what: "who decides the hypotheses",
      codes: { badBody: "hypotheses.invalid", busy: "research.busy", failed: "hypotheses.failed" },
      busyStatus: 503,
      ask(tree, body) {
        const keys = Object.keys(body);
        if (keys.length !== 1 || (body.decide !== "person" && body.decide !== "agent")) return { code: 400, body: refusal(`the body: {"decide": "person"} or {"decide": "agent"}`, "hypotheses.invalid") };
        if (actsAsArchive(tree)) return { code: 409, body: refusal("nobody researches here: no hypothesis is decided by an agent", "hypotheses.archive") };
        const settings = new Settings(env, {});
        before = head(root);
        if (settings.hypothesesDecide(tree.config) === body.decide) return { code: 200, body: { ok: true, decide: body.decide, head: before, parent: before } };
        if (body.decide === "agent") {
          // the person's yes in the terminal the link opens (the link's action registered by cli/menu-links.ts)
          const link = `${linkScheme(env)}://hypotheses?${new URLSearchParams({ tree: tree.config.id, decide: "agent" })}`;
          return { code: 403, body: { ...said(tree.lang, "ui.hypotheses.link"), link } };
        }
        return { args: ["config", "set", "hypotheses.decide", "person", "--for-tree"] };
      },
      done(_tree, _data, h) {
        return { ok: true, decide: "person", head: h, parent: before };
      },
      refused() {
        return undefined;
      },
    };
  };

  /**
   * The user confirming the research's transcript of a source, or taking it back (POST /sources/confirm {source, txt,
   * confirm}): strom source confirm, as the person's in the app — checked first against the research as it is now
   * (core/confirm.ts), again under the tree's lock by the command. {ok, source, read, conf?, txt, head, parent}; the same
   * state again: 200, nothing written. 400 confirm.invalid, 404 confirm.none, 409 confirm.archive | confirm.merged (+into)
   * | confirm.retracted | confirm.reader | confirm.changed (+txt: the wording now), 503 research.busy.
   */
  const confirmWrite = (): AppWrite => {
    let before = "";
    const refused = (r: ConfirmRefusal) => ({ code: r.status, body: { ...refusal(r.why, r.code, r.params ?? {}), ...(r.params?.into ? { into: r.params.into } : {}), ...(r.code === "confirm.changed" && r.params?.txt ? { txt: r.params.txt } : {}) } });
    return {
      what: "a transcript confirmed",
      codes: { badBody: "confirm.invalid", busy: "research.busy", failed: "confirm.failed" },
      busyStatus: 503,
      ask(tree, body) {
        const keys = Object.keys(body).sort().join(",");
        const { source, txt, confirm } = body;
        if (keys !== "confirm,source,txt" || typeof source !== "string" || !/^S\d{1,9}$/iu.test(source.trim()) || typeof txt !== "string" || !/^[A-Za-z0-9_-]{1,64}$/u.test(txt) || typeof confirm !== "boolean")
          return { code: 400, body: refusal(`the body: {"source": "S…", "txt": "<the source's _TXT>", "confirm": true | false}`, "confirm.invalid") };
        const id = normId(source);
        const asked = confirmCheck(tree, id, txt, confirm);
        if ("refused" in asked) return refused(asked.refused);
        before = head(root);
        if ("same" in asked) return { code: 200, body: { ok: true, ...asked.same, head: before, parent: before } };
        return { args: ["source", "confirm", id, "--txt", txt, ...(confirm ? [] : ["--undo"])] };
      },
      done(_tree, data, h) {
        return { ok: true, ...data, head: h, parent: before };
      },
      refused(_tree, code, why, data) {
        if (!code.startsWith("confirm.") || code === "confirm.app") return undefined;
        const params = data.params && typeof data.params === "object" ? Object.fromEntries(Object.entries(data.params as Record<string, unknown>).map(([k, v]) => [k, String(v)])) : {};
        return refused({ status: code === "confirm.none" ? 404 : 409, code: code as ConfirmRefusal["code"], why, params });
      },
    };
  };

  /**
   * The user putting back what an imported family tree said of a value (POST /facts/revert {person, ref, part?}): strom
   * event revert (a fact: E…) or person revert --name <n> | --sex (N:P…:<n>, SEX:P…), as the person's in the app — the
   * ref the Strom file's `3 _REF` under `2 _STROM_WAS`, of the person named (a family's fact: one of its partners).
   * {ok, reverted, head, parent}; 400 revert.invalid, 404 revert.unknown, 409 revert.nothing, 503 research.busy.
   */
  const revertWrite = (): AppWrite => {
    let before = "";
    const PARTS: Record<string, string> = { DATE: "date", PLAC: "place", VAL: "value", GIVN: "given", SURN: "surname", SEX: "sex" };
    const unknown = (why: string) => ({ code: 404, body: refusal(why, "revert.unknown") });
    const nothing = (why: string) => ({ code: 409, body: refusal(why, "revert.nothing") });
    return {
      what: "a family tree's value put back",
      codes: { badBody: "revert.invalid", busy: "research.busy", failed: "revert.failed" },
      busyStatus: 503,
      ask(tree, body) {
        const { person, ref, part } = body;
        const extra = Object.keys(body).filter((k) => !["person", "ref", "part"].includes(k));
        if (extra.length || typeof person !== "string" || !/^P\d{1,9}$/iu.test(person.trim()) || typeof ref !== "string" || !ref.trim() || ref.length > 64 || (part !== undefined && (typeof part !== "string" || !PARTS[part.toUpperCase()])))
          return { code: 400, body: refusal(`the body: {"person": "P…", "ref": "<the value's _REF>", "part"?: "DATE" | "PLAC" | "VAL" | "GIVN" | "SURN" | "SEX"}`, "revert.invalid") };
        const who = normId(person);
        const key = ref.trim().toUpperCase();
        const said = part === undefined ? undefined : PARTS[(part as string).toUpperCase()]!;
        const m = /^(?:SEX:(P\d{1,9})|N:(P\d{1,9}):(\d{1,4})|(E\d{1,9}))$/u.exec(key);
        if (!m) return unknown(`no value ${ref}`);
        before = head(root);
        if (m[4]) {
          let owner: Person | Family;
          try {
            owner = findEventOwner(tree, normId(m[4])).owner;
          } catch {
            return unknown(`no fact ${m[4]}`);
          }
          if (owner.id !== who && !(owner.type === "family" && owner.partners.includes(who))) return unknown(`${m[4]} is no fact of ${who}`);
          if (said === "sex" || said === "given" || said === "surname") return nothing(`a fact has no part ${part}`);
          return { args: ["event", "revert", normId(m[4]), ...(said ? ["--part", said] : [])] };
        }
        const id = normId((m[1] ?? m[2])!);
        if (id !== who) return unknown(`${key} is no value of ${who}`);
        const p = tree.get<Person>(id);
        if (!p || p.type !== "person" || p.retracted) return unknown(`no person ${id}`);
        if (m[1]) {
          if (said && said !== "sex") return nothing(`a sex has no part ${part}`);
          return { args: ["person", "revert", id, "--sex"] };
        }
        const n = Number(m[3]);
        if (!p.names[n - 1]) return unknown(`${id} has no name ${n}`);
        if (said && said !== "given" && said !== "surname") return nothing(`a name has no part ${part}`);
        return { args: ["person", "revert", id, "--name", String(n), ...(said ? ["--part", said] : [])] };
      },
      done(_tree, data, h) {
        return { ok: true, ...(data.reverted ? { reverted: data.reverted } : {}), head: h, parent: before };
      },
      refused(_tree, code, why) {
        if (code === "revert.unknown") return unknown(why);
        if (code === "revert.nothing") return nothing(why);
        if (code === "revert.part") return { code: 400, body: refusal(why, "revert.invalid") };
        return undefined;
      },
    };
  };

  /**
   * The facts against their originals (spec 065), the person's in the app — nobody verifies in an archive or a research
   * waiting for its agent (409 verify.archive; its refusals by strom: archive, agent.missing). The codes of the commands
   * verify.* as they come; 404 for verify.unknown, 400 for verify.invalid, else 409.
   */
  const VERIFY_CODES = { badBody: "verify.invalid", busy: "research.busy", failed: "verify.failed" };
  const verifyRefused = (code: string, why: string): { code: number; body: Record<string, unknown> } | undefined => {
    if (code === "archive" || code === "agent.missing" || code === "verify.archive") return { code: 409, body: refusal(why, "verify.archive") };
    if (code === "verify.invalid") return { code: 400, body: refusal(why, code) };
    if (code === "verify.unknown") return { code: 404, body: refusal(why, code) };
    if (code === "verify.nothing" || code === "verify.retracted") return { code: 409, body: refusal(why, code) };
    return undefined;
  };
  const noVerify = (tree: Tree) => (actsAsArchive(tree) ? { code: 409, body: refusal("nobody researches here: an archive, or a research waiting for its agent", "verify.archive") } : undefined);

  /**
   * The person's "verify" (POST /verify {person: P…} | {family: F…} | {fact: E…}, dry?): strom verify facts … --living
   * (the person asks: someone most likely alive too), first in the queue. {ok, task, state, position?, tasks: [{task,
   * state, position?, facts}], facts: [{fact, kind, how, record?: {source, title, page?}}], estimate: {sessions, usd?},
   * head, parent} — every task it touches (a person's and their marriages'), nearest to its turn first, the first one's
   * on top; position only of one waiting in the queue (wait, asked), never of one waiting for the scans or an archive's
   * permission (Dotazy 2 of the app). Dry: nothing written, task null, no tasks, head == parent. 400 verify.invalid, 404 verify.unknown, 409 verify.archive | verify.nothing |
   * verify.retracted, 503 research.busy.
   */
  const verifyWrite = (): AppWrite => {
    let before = "";
    let dry = false;
    return {
      what: "facts asked to be verified",
      codes: VERIFY_CODES,
      busyStatus: 503,
      ask(tree, body) {
        const keys = Object.keys(body).filter((k) => k !== "dry");
        const key = keys[0];
        const v = key ? body[key] : undefined;
        // a fact: E…, or the name of a person's identity (P….N, spec 066 P5)
        const shape: Record<string, RegExp> = { person: /^P\d{1,9}$/iu, family: /^F\d{1,9}$/iu, fact: /^(?:E\d{1,9}|P\d{1,9}\.N)$/iu };
        if (keys.length !== 1 || !shape[key!] || typeof v !== "string" || !shape[key!]!.test(v.trim()) || (body.dry !== undefined && typeof body.dry !== "boolean"))
          return { code: 400, body: refusal(`the body: {"person": "P…"} | {"family": "F…"} | {"fact": "E…" | "P….N"}, "dry"?: true`, "verify.invalid") };
        const no = noVerify(tree);
        if (no) return no;
        const named = key === "fact" ? parseNameEid(v) : undefined;
        const id = named ? `${named}.N` : normId(v.trim());
        if (key !== "fact") {
          const r = tree.get<Person | Family>(id);
          if (!r || r.type !== key) return { code: 404, body: refusal(`no ${key} ${id}`, "verify.unknown") };
          if (r.retracted || r.mergedInto) return { code: 409, body: refusal(`${id} was taken back${r.mergedInto ? ` (merged into ${r.mergedInto})` : ""}`, "verify.retracted") };
        }
        dry = body.dry === true;
        before = head(root);
        return { args: ["verify", "facts", ...(key === "fact" ? ["--fact", id] : [id]), "--living", ...(dry ? ["--dry-run"] : [])] };
      },
      done(_tree, data, h) {
        const { task, state, facts, estimate, position, tasks } = data;
        if (dry) return { ok: true, task: null, facts: facts ?? [], estimate, head: before, parent: before };
        return { ok: true, task: task ?? null, ...(state !== undefined ? { state } : {}), ...(position !== undefined ? { position } : {}), tasks: tasks ?? [], facts: facts ?? [], estimate, head: h, parent: before };
      },
      refused: (_tree, code, why) => verifyRefused(code, why),
    };
  };

  /**
   * The person's bulk verification (POST /verify/bulk {scope: line|lineage|tree, of?, order?, try?, budget?, dry?}):
   * strom verify bulk, after the lines' work — a family tree's leads too, their record looked for (Dotazy 2 of the
   * app, 3). {ok, people, facts, how: {read, search}, tasks, first, working, left, estimate: {sessions, usd?}, head,
   * parent}; first: a try's tasks first in the queue (K7.1), working: a run or a session at work now (K7.2) — feature
   * verify.tryFirst; dry: no tasks (nor first, working), head == parent. 400 verify.invalid, 404 verify.unknown, 409 verify.archive | verify.nothing, 503
   * research.busy.
   */
  const verifyBulkWrite = (): AppWrite => {
    let before = "";
    let dry = false;
    return {
      what: "a bulk verification",
      codes: VERIFY_CODES,
      busyStatus: 503,
      ask(tree, body) {
        const { scope, of, order, budget } = body;
        const tries = body.try;
        const extra = Object.keys(body).filter((k) => !["scope", "of", "order", "try", "budget", "dry"].includes(k));
        if (
          extra.length ||
          typeof scope !== "string" ||
          !["line", "lineage", "tree"].includes(scope) ||
          (of !== undefined && (typeof of !== "string" || !/^[GP]\d{1,9}$/iu.test(of.trim()))) ||
          (order !== undefined && (typeof order !== "string" || !["ancestors", "weakest", "oldest"].includes(order))) ||
          (tries !== undefined && (typeof tries !== "number" || !Number.isInteger(tries) || tries < 1)) ||
          (budget !== undefined && (typeof budget !== "number" || !(budget > 0) || !Number.isFinite(budget))) ||
          (body.dry !== undefined && typeof body.dry !== "boolean")
        )
          return { code: 400, body: refusal(`the body: {"scope": "line" | "lineage" | "tree", "of"?: "G…" | "P…", "order"?: "ancestors" | "weakest" | "oldest", "try"?: n, "budget"?: usd, "dry"?: true}`, "verify.invalid") };
        const no = noVerify(tree);
        if (no) return no;
        dry = body.dry === true;
        before = head(root);
        return {
          args: [
            "verify", "bulk", "--scope", scope,
            ...(typeof of === "string" ? ["--of", normId(of.trim())] : []),
            ...(typeof order === "string" ? ["--order", order] : []),
            ...(tries !== undefined ? ["--try", String(tries)] : []),
            ...(budget !== undefined ? ["--budget", String(budget)] : []),
            ...(dry ? ["--dry-run"] : []),
          ],
        };
      },
      done(tree, data, h) {
        const { people, facts, how, tasks, left, estimate, first } = data;
        // a try (feature verify.tryFirst): first says its tasks stand first in the queue, working whether the research
        // works now (a run, a session) — the app offers to work on them now only when it does not (spec 065 K7.2)
        return { ok: true, people, facts, how, ...(dry ? {} : { tasks: tasks ?? [], first: first === true, working: workingNow(tree) }), left, estimate, head: dry ? before : h, parent: before };
      },
      refused: (_tree, code, why) => verifyRefused(code, why),
    };
  };

  /**
   * The person stopping the verification (POST /verify/stop {scope?: all | bulk}): strom verify stop [--bulk] — the
   * tasks nobody started dropped, what was queued stays so (not queued again by itself). {ok, dropped, facts, head,
   * parent}; nothing to stop: dropped 0, nothing written. 400 verify.invalid, 409 verify.archive, 503 research.busy.
   */
  const verifyStopWrite = (): AppWrite => {
    let before = "";
    return {
      what: "the verification stopped",
      codes: VERIFY_CODES,
      busyStatus: 503,
      ask(tree, body) {
        const extra = Object.keys(body).filter((k) => k !== "scope");
        if (extra.length || (body.scope !== undefined && body.scope !== "all" && body.scope !== "bulk"))
          return { code: 400, body: refusal(`the body: {"scope"?: "all" | "bulk"}`, "verify.invalid") };
        const no = noVerify(tree);
        if (no) return no;
        before = head(root);
        return { args: ["verify", "stop", ...(body.scope === "bulk" ? ["--bulk"] : [])] };
      },
      done(_tree, data, h) {
        return { ok: true, dropped: Number(data.dropped ?? 0), facts: Number(data.facts ?? 0), head: data.dropped ? h : before, parent: before };
      },
      refused: (_tree, code, why) => verifyRefused(code, why),
    };
  };

  /**
   * The person's confirmation of a fact against the scan, or its taking back (POST /facts/confirm {fact: E…, txt?,
   * confirm}): strom verify confirm E… [--undo] [--txt] — an archive's and a research's waiting for its agent too (the
   * person's own). With txt (the mark of the value the app showed) a fact changed since is refused, 409 confirm.changed.
   * {ok, fact, owner, confirmed?, head, parent}; the same state again: 200, nothing written. 400 factconfirm.invalid,
   * 404 factconfirm.unknown, 409 factconfirm.retracted | factconfirm.merged, 503 research.busy.
   */
  const factConfirmWrite = (): AppWrite => {
    let before = "";
    // 409 confirm.changed: the mark now (txt) and what the fact says now (date, place, value; a name: given, surname),
    // for the app to show again — a part it does not have left out
    const changed = (why: string, all: Record<string, string | undefined>) => {
      const params = Object.fromEntries(Object.entries(all).filter((e): e is [string, string] => typeof e[1] === "string" && e[1] !== "undefined"));
      const { txt, fact: _f, ...now } = params;
      return { code: 409, body: { ...refusal(why, "confirm.changed", params), ...(txt ? { txt } : {}), now } };
    };
    return {
      what: "a fact confirmed against the scan",
      codes: { badBody: "factconfirm.invalid", busy: "research.busy", failed: "factconfirm.failed" },
      busyStatus: 503,
      ask(tree, body) {
        const keys = Object.keys(body).sort().join(",");
        const { fact, confirm, txt } = body;
        // a fact (E…) or the name of a person's identity (P….N, spec 066 P5: the Strom file's 2 _STROM_EID under NAME)
        const person = typeof fact === "string" && /^\s*P\d{1,9}\.N\s*$/iu.test(fact) ? parseNameEid(fact) : undefined;
        if ((keys !== "confirm,fact" && keys !== "confirm,fact,txt") || typeof fact !== "string" || (!person && !/^E\d{1,9}$/iu.test(fact.trim())) || typeof confirm !== "boolean" || (txt !== undefined && (typeof txt !== "string" || !/^[0-9a-f]{16}$/iu.test(txt))))
          return { code: 400, body: refusal(`the body: {"fact": "E…" | "P….N", "txt"?: "<its 3 _TXT under 2 _STROM_EID>", "confirm": true | false}`, "factconfirm.invalid") };
        const id = person ? `${person}.N` : normId(fact.trim());
        // the value the person saw (an older file, ?stale=1) is what is confirmed: changed since, refused before anything
        if (typeof txt === "string" && person) {
          const p = tree.get<Person>(person);
          const name = p && p.type === "person" && !p.retracted && !p.mergedInto && p.names.length ? primaryName(p) : undefined;
          if (name && nameMark(name) !== txt.toLowerCase()) return changed(`the name of ${person} changed since the app showed it: confirm what it says now`, { fact: id, txt: nameMark(name), given: name.given, surname: name.surname });
        } else if (typeof txt === "string") {
          const event = factIn(tree, id);
          if (event && factMark(event) !== txt.toLowerCase()) return changed(`${id} changed since the app showed it: confirm what it says now`, { fact: id, txt: factMark(event), ...factNow(event) });
        }
        before = head(root);
        return { args: ["verify", "confirm", id, ...(confirm ? [] : ["--undo"]), ...(typeof txt === "string" ? ["--txt", txt] : [])] };
      },
      done(_tree, data, h) {
        const r = (Array.isArray(data.results) ? data.results[0] : undefined) as { fact?: string; owner?: string; confirmed?: string; same?: boolean } | undefined;
        return { ok: true, fact: r?.fact, owner: r?.owner, ...(r?.confirmed ? { confirmed: r.confirmed } : {}), head: r?.same ? before : h, parent: before };
      },
      refused(_tree, code, why, data) {
        if (code === "confirm.changed") return changed(why, data.params && typeof data.params === "object" ? Object.fromEntries(Object.entries(data.params as Record<string, unknown>).map(([k, v]) => [k, String(v)])) : {});
        if (code === "factconfirm.invalid") return { code: 400, body: refusal(why, code) };
        if (code === "factconfirm.unknown") return { code: 404, body: refusal(why, code) };
        if (code === "factconfirm.retracted" || code === "factconfirm.merged") return { code: 409, body: refusal(why, code) };
        return undefined;
      },
    };
  };

  /**
   * The person's word on a source read again that differs in a matter of fact (POST /sources/<S…>/read/<D…>/task
   * {how: now|queue|save|review}): strom source reading, as theirs in the app (save: just keep). {ok, source, reading,
   * how, task?, taskFor?, appended?, chat?, head, parent} — chat: the link that opens the conversation about the task (now).
   * unsure true (feature read.sourceTask.unsure; how queue or review): its places not sure handed over (--unsure),
   * {…, unsure: true}; 409 read.decide.sure while a matter of fact sure waits for a decision.
   */
  const readTaskWrite = (source: string, reading: string): AppWrite => {
    let before = "";
    let how = "";
    return {
      what: "a reading again decided",
      codes: { badBody: "read.decide.invalid", busy: "research.busy", failed: "read.decide.failed" },
      busyStatus: 503,
      ask(_tree, body) {
        const keys = Object.keys(body).filter((k) => k !== "unsure");
        const unsure = body.unsure === true;
        if (keys.length !== 1 || (body.how !== "now" && body.how !== "queue" && body.how !== "save" && body.how !== "review") || ("unsure" in body && typeof body.unsure !== "boolean") || (unsure && body.how !== "queue" && body.how !== "review"))
          return { code: 400, body: refusal(`the body: {"how": "now" | "queue" | "save" | "review"} — with "unsure": true only queue or review`, "read.decide.invalid") };
        if (!/^S\d{1,9}$/iu.test(source) || !/^D\d{14}-[0-9a-f]{4}$/u.test(reading)) return { code: 400, body: refusal("the address: sources/<S…>/read/<D…>/task", "read.decide.invalid") };
        how = body.how;
        before = head(root);
        return { args: ["source", "reading", normId(source), "--take", how === "save" ? "keep" : how, "--reading", reading, ...(unsure ? ["--unsure"] : [])] };
      },
      done(_tree, data, h) {
        const { link, take: _t, places: _p, ...rest } = data;
        return { ok: true, ...rest, how, ...(typeof link === "string" ? { chat: link } : {}), head: h, parent: before };
      },
      refused(_tree, code, why, data) {
        if (!code.startsWith("read.decide.") || code === "read.decide.person") return undefined;
        const params = data.params && typeof data.params === "object" ? (data.params as Record<string, unknown>) : {};
        const status = code === "read.decide.invalid" ? 400 : code === "read.decide.none" || code === "read.decide.noreading" ? 404 : 409;
        return { code: status, body: { ...refusal(why, code, {}), ...(typeof params.task === "string" ? { task: params.task } : {}) } };
      },
    };
  };

  /**
   * What a source read again that differs in a matter of fact becomes in this research, as the app sets it (POST
   * /sourceTask {"sourceTask": "ask"|"always"|"never"}): strom config set read.sourceTask … --for-tree, the person's
   * choice in the app. {ok, sourceTask, head, parent}; the same again: 200, nothing written. 400 sourceTask.invalid, 409
   * sourceTask.archive (nobody reads there), 503 research.busy.
   */
  const sourceTaskWrite = (): AppWrite => {
    let before = "";
    let want = "";
    return {
      what: "what a reading again becomes",
      codes: { badBody: "sourceTask.invalid", busy: "research.busy", failed: "sourceTask.failed" },
      busyStatus: 503,
      ask(tree, body) {
        const keys = Object.keys(body);
        if (keys.length !== 1 || (body.sourceTask !== "ask" && body.sourceTask !== "always" && body.sourceTask !== "never"))
          return { code: 400, body: refusal(`the body: {"sourceTask": "ask" | "always" | "never"}`, "sourceTask.invalid") };
        if (actsAsArchive(tree)) return { code: 409, body: refusal("nobody researches here: no source is read again", "sourceTask.archive") };
        want = body.sourceTask;
        before = head(root);
        if (new Settings(env, {}).readSourceTask(tree.config) === want) return { code: 200, body: { ok: true, sourceTask: want, head: before, parent: before } };
        return { args: ["config", "set", "read.sourceTask", want, "--for-tree"] };
      },
      done(_tree, _data, h) {
        return { ok: true, sourceTask: want, head: h, parent: before };
      },
      refused() {
        return undefined;
      },
    };
  };

  /**
   * The user deciding a new wording an agent proposed for a transcript they read (POST /sources/proposal {source, task,
   * take, proposed?}): strom source proposal, as the person's in the app (core/proposal.ts) — checked first against the
   * research as it is now, again under the tree's lock by the command. {ok, source, read?, conf?, txt, task, take, head,
   * parent}. 400 proposal.invalid, 404 proposal.none, 409 proposal.archive | proposal.decided | proposal.changed
   * (+proposed: the mark of the wording proposed now) | proposal.undo, 503 research.busy. take undo: the decision of
   * the task taken back (core/proposal.ts undoProposal).
   */
  const proposalWrite = (): AppWrite => {
    let before = "";
    const no = (status: number, why: string, code: string, params: Record<string, string> = {}) => ({ code: status, body: { ...refusal(why, code, params), ...(params.proposed ? { proposed: params.proposed } : {}) } });
    return {
      what: "a proposed transcript decided",
      codes: { badBody: "proposal.invalid", busy: "research.busy", failed: "proposal.failed" },
      busyStatus: 503,
      ask(tree, body) {
        const keys = Object.keys(body).filter((k) => k !== "proposed").sort().join(",");
        const { source, task, take, proposed } = body;
        if (
          keys !== "source,take,task" ||
          typeof source !== "string" ||
          !/^S\d{1,9}$/iu.test(source.trim()) ||
          typeof task !== "string" ||
          !/^T\d{1,9}$/iu.test(task.trim()) ||
          (take !== "proposal" && take !== "keep" && take !== "undo") ||
          (proposed !== undefined && (typeof proposed !== "string" || !/^[A-Za-z0-9_-]{1,64}$/u.test(proposed)))
        )
          return no(400, `the body: {"source": "S…", "task": "T…", "take": "proposal" | "keep" | "undo", "proposed"?: "<the proposal's mark>"}`, "proposal.invalid");
        const id = normId(source);
        const tid = normId(task);
        if (actsAsArchive(tree)) return no(409, "an archive: no proposal is decided here", "proposal.archive");
        const s = tree.get<Source>(id);
        const tk = tree.get<Task>(tid);
        if (!s || s.type !== "source" || !tk || tk.type !== "task" || tk.proposal?.source !== s.id) return no(404, `${tid} proposes no wording for ${id}`, "proposal.none", { source: id, task: tid });
        if (take !== "undo" && (tk.state === "done" || tk.state === "dropped")) return no(409, `${tid} is decided already`, "proposal.decided", { source: id, task: tid });
        const mark = transcriptMark(tk.proposal.text);
        if (proposed && proposed !== mark) return no(409, `another wording was proposed for ${id} since — decide the one proposed now`, "proposal.changed", { source: id, task: tid, proposed: mark });
        before = head(root);
        return { args: ["source", "proposal", id, "--task", tid, "--take", take, ...(proposed ? ["--proposed", proposed] : [])] };
      },
      done(_tree, data, h) {
        return { ok: true, ...data, head: h, parent: before };
      },
      refused(_tree, code, why, data) {
        if (!code.startsWith("proposal.") || code === "proposal.person" || code === "proposal.failed") return undefined;
        const params = data.params && typeof data.params === "object" ? Object.fromEntries(Object.entries(data.params as Record<string, unknown>).map(([k, v]) => [k, String(v)])) : {};
        return no(code === "proposal.none" ? 404 : code === "proposal.invalid" ? 400 : 409, why, code, params);
      },
    };
  };

  /** A write of the app's the research cannot take as asked (checkAsked): its code, the HTTP status the app reads it by. */
  const refusedAsked = (e: unknown): { code: number; body: Record<string, unknown> } => {
    if (!(e instanceof StromError) || !e.code) throw e;
    // a family tree's file a source standing was made of (spec 117 K2.2): the sources as a list too
    if (e.code === "material.source-live") {
      const sources = String(e.params?.sources ?? "").split(",").filter(Boolean);
      return { code: 409, body: { ...refusal(e.message, e.code, e.params ?? {}), sources } };
    }
    return { code: e.code === "material.body" || e.code === "material.date" ? 400 : 404, body: refusal(e.message, e.code, e.params ?? {}) };
  };
  /** Whether the research can be written here at all: its history, its records, its locks. */
  const writableHere = (): boolean => {
    try {
      for (const d of [".git", "data", ".strom"]) fs.accessSync(path.join(root, d), fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  };

  /**
   * GET /media/<sha>?thumb=128|256|512: a small preview of a file of the material (core/thumbs.ts) — kept, else made by
   * a strom of its own (two at a time; the same one asked twice made once). 410 media.gone (the file not here), 415
   * thumb.type (no preview of this kind here: the app shows its icon), 503 thumb.busy (too many waiting), 500.
   */
  const THUMBS_AT_ONCE = 2;
  const THUMBS_WAITING = 400;
  const THUMB_MS = 90_000;
  let thumbsMaking = 0;
  const thumbsWaiting: (() => void)[] = [];
  const thumbsAsked = new Map<string, ((r: { code: number; file?: string; body?: Record<string, unknown> }) => void)[]>();
  const giveThumb = (req: http.IncomingMessage, res: http.ServerResponse, known: { id: string; file?: string }, sha: string, px: number) => {
    const json = (code: number, body: Record<string, unknown>) => {
      if (!res.headersSent) res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...(code === 503 ? { "Retry-After": "5" } : {}) }).end(JSON.stringify(body));
    };
    const send = (file: string) => {
      let size: number;
      try {
        size = fs.statSync(file).size;
      } catch (e) {
        return failed(req, res, e);
      }
      res.writeHead(200, { "Content-Type": "image/jpeg", "Content-Length": String(size), "Cache-Control": "private, max-age=86400" });
      fs.createReadStream(file).on("error", (e) => failed(req, res, e)).pipe(res);
    };
    if (!known.file || !fs.existsSync(known.file)) return json(410, { known: known.id, ...refusal("its file is not on this computer", "media.gone", { known: known.id }) });
    const have = cachedThumb(root, sha, px);
    if (have) return send(have);
    const key = `${sha}-${px}`;
    const answer = (r: { code: number; file?: string; body?: Record<string, unknown> }) => (r.file ? send(r.file) : json(r.code, r.body ?? {}));
    const asked = thumbsAsked.get(key);
    if (asked) return void asked.push(answer);
    if (thumbsWaiting.length >= THUMBS_WAITING) return json(503, { ...refusal("too many previews asked at once — ask again in a moment", "thumb.busy"), retry: 5 });
    thumbsAsked.set(key, [answer]);
    const done = (r: { code: number; file?: string; body?: Record<string, unknown> }) => {
      const all = thumbsAsked.get(key) ?? [];
      thumbsAsked.delete(key);
      thumbsMaking--;
      thumbsWaiting.shift()?.();
      for (const a of all) a(r);
    };
    const make = () => {
      thumbsMaking++;
      const { command, args } = stromLauncher();
      const child = spawn(command, [...args, "media", "thumb", sha, "--px", String(px), "--json"], { cwd: root, env: forApp(env, root), stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
      track(child);
      let out = "";
      child.stdout.on("data", (d: Buffer) => (out += d.toString("utf8")));
      child.stderr.on("data", () => {
        // said by its --json
      });
      const timer = setTimeout(() => child.kill(), THUMB_MS);
      let ended = false;
      const end = (r: { code: number; file?: string; body?: Record<string, unknown> }) => {
        if (ended) return;
        ended = true;
        clearTimeout(timer);
        done(r);
      };
      child.on("error", (e) => end({ code: 500, body: refusal(errorText(e), "thumb.failed") }));
      child.on("close", (code) => {
        let data: Record<string, unknown> = {};
        try {
          data = JSON.parse(out) as Record<string, unknown>;
        } catch {
          // said by the exit code
        }
        const file = typeof data.file === "string" ? data.file : undefined;
        if (code === 0 && file) return end({ code: 200, file });
        const why = String(data.message ?? `exit ${code}`);
        if (data.code === "thumb.type") return end({ code: 415, body: refusal(why, "thumb.type") });
        if (data.code === "media.gone") return end({ code: 410, body: { known: known.id, ...refusal(why, "media.gone", { known: known.id }) } });
        noteLive(root, `the preview of ${known.id} was not made: ${why}`);
        end({ code: 500, body: refusal(why, "thumb.failed") });
      });
    };
    if (thumbsMaking < THUMBS_AT_ONCE) make();
    else thumbsWaiting.push(make);
  };

  /** A part of the address, decoded (one that is not URI-encoded: none). */
  const decoded = (part: string | undefined): string => {
    try {
      return decodeURIComponent(part ?? "");
    } catch {
      return "";
    }
  };
  /**
   * The phone connection (core/phone.ts): this computer's, said the same by every bridge of it. GET phone — its state
   * (its server started again when on and gone); GET phone/qr.svg — the code to pair a phone (409 `phone.off`). From the
   * app's pages only: POST phone/on {"lang"} — the person asked in a window of the system, not waited for (`confirm`;
   * none can be shown here: `off` with the error `no-dialog`); POST phone/off — by anyone, a window that waits closed;
   * POST phone/remove/<id> (404 `phone.unknown`) and, a moment after, phone/restore/<id> (404 `phone.gone`).
   */
  const PHONE_EXPOSE = "X-Strom-Pair-Expires, X-Strom-Pair-Url";
  const PHONE_RESTORE_MS = 15_000;
  const phonesTakenOff = new Map<string, { phone: PairedPhone; at: number }>();
  // the devices of the home network taken off a moment ago (DELETE phone/devices/<id>, with the icons of their home
  // screens): put back within PHONE_RESTORE_MS
  const devicesTakenOff = new Map<string, { devices: Device[]; at: number; undo: string }>();
  /**
   * GET phone with the gateway of the devices on: the app for them (ready only as the gateway serves it — a copy under
   * the gate of the app's version is none), the computer's name a device may find it by (<name>.local, null: at an IP
   * address alone), the devices paired — a row each, the icons of their home screens folded in — and which of them are
   * here now (seen within a minute and a half: lastSeenAt is written at most once a minute); stale: a device asking at
   * none of the gateway's addresses now. Its pair: how long the device's code shown holds (qr.svg), none without one.
   */
  const devicesNow = () => {
    const name = localName(env);
    const hosts = phoneState(env).addresses.map((a) => hostOf(a.url));
    const ports = [...new Set(hosts.map((h) => h.slice(h.lastIndexOf(":") + 1)))];
    const list = deviceRows(devicesList(env), Date.now(), name ? [...hosts, ...ports.map((p) => `${name}:${p}`)] : hosts);
    const app = deviceAppState(env);
    return { app: app.app, appVersion: app.appVersion ?? null, name, list, connectedNow: list.filter((d) => d.connected).length };
  };
  let phoneRevived = 0;
  const phoneJson = (res: http.ServerResponse, code: number, body: unknown) => {
    if (!res.headersSent) res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Access-Control-Expose-Headers": PHONE_EXPOSE }).end(JSON.stringify(body));
  };
  const phoneNow = async () => {
    // on, its server gone: started again (once in ten seconds), a moment given to say its addresses
    if (phoneConfig(env).on && !phoneRunning(env) && Date.now() - phoneRevived > 10_000) {
      phoneRevived = Date.now();
      revivePhone(env);
      for (let i = 0; i < 20 && !phoneRunning(env); i++) await new Promise((r) => setTimeout(r, 100));
    }
    return { ...phoneState(env), ...phoneProbe(env) };
  };
  const phone = (req: http.IncomingMessage, res: http.ServerResponse, origin: string | undefined, sub: string | undefined, act: string | undefined) => {
    if (req.method === "GET") {
      req.resume();
      if (!sub) {
        // the gateway of the devices on: the copy of the app this computer runs is the one the devices get
        const devices = devicesOn(env);
        if (devices) {
          noteDeviceAppSource(env, req.headers.origin, appVersionOf(req, new Settings(env, {})));
          void ensureDeviceApp(env);
        }
        // the gateway on: the code that pairs is the device's (qr.svg shows it), never the phone page's code of before
        const paired = (s: Awaited<ReturnType<typeof phoneNow>>) => {
          const p = s.state === "on" ? devicePairNow(env) : undefined;
          return { ...s, pair: p ? { expiresAt: p.expiresAt } : null };
        };
        return void phoneNow().then((s) => phoneJson(res, 200, devices ? { ...paired(s), devices: devicesNow() } : s), (e) => failed(req, res, e));
      }
      if (sub === "qr.svg" && !act) {
        const s = phoneState(env);
        if (s.state !== "on") return phoneJson(res, 409, refusal("the phone connection is off", "phone.off"));
        if (!s.addresses.length) return phoneJson(res, 503, { ...refusal("the phone's server is starting: asked again in a moment", "phone.starting"), retry: 1 });
        const q = new URL(req.url ?? "/", "http://127.0.0.1").searchParams;
        // an address of the server now (a Wi-Fi's or a cable's), the first unless another is asked
        const asked = q.get("address");
        const address = asked ? s.addresses.find((a) => a.url === asked.replace(/\/+$/, ""))?.url : s.addresses[0]!.url;
        if (!address) return phoneJson(res, 404, refusal(`no address of the phone's server: ${asked} (GET phone says them)`, "phone.address", { addresses: s.addresses.map((a) => a.url).join(" ") }));
        const lang = q.get("lang")?.toLowerCase();
        const tree = readJsonIfExists<TreeConfig>(path.join(root, TREE_FILE))?.id;
        // the gateway of the devices on: one way to pair — the code of the app (pairing v2), never a new one of the phone's page
        let url: string;
        let expiresAt: string;
        if (devicesOn(env)) {
          const pair = devicePairShown(env, tree ? { tree } : {});
          url = devicePairUrl(address, pair);
          expiresAt = pair.expiresAt;
        } else {
          const pair = pairCode(env, { tree });
          url = pairUrl(address, pair.code, lang && /^[a-z]{2,3}$/.test(lang) ? lang : undefined);
          expiresAt = pair.expiresAt;
        }
        noteLive(root, `the phone connection: a QR code to pair a phone shown (${address}, until ${expiresAt})`);
        phoneSummarySeen = undefined;
        res
          .writeHead(200, {
            "Content-Type": "image/svg+xml; charset=utf-8",
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
            "X-Strom-Pair-Expires": expiresAt,
            "X-Strom-Pair-Url": address,
            "Access-Control-Expose-Headers": PHONE_EXPOSE,
          })
          .end(qrSvg(url));
        return;
      }
      return phoneJson(res, 404, refusal("no such address of the phone", "phone.not-found"));
    }
    if (!origin) {
      req.resume();
      return phoneJson(res, 403, refusal("only the Strom app may ask this here", "app.only"));
    }
    let text = "";
    req.on("data", (c: Buffer) => {
      if (text.length < 4096) text += c.toString("utf8");
    });
    req.on("end", () => safely(req, res, () => {
      phoneSummarySeen = undefined;
      if (sub === "on" && !act) {
        let lang: string | undefined;
        try {
          const said = (JSON.parse(text || "{}") as { lang?: unknown }).lang;
          if (typeof said === "string" && /^[A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})?$/.test(said)) lang = said.slice(0, 2).toLowerCase();
        } catch {
          // the research's language
        }
        const how = askPhoneOn(env, lang ?? Tree.open(root, env).lang);
        noteLive(root, `the phone connection: asked to turn it on — ${how === "confirm" ? "a window asks the person" : how === "on" ? "on already" : "no window can be shown here"}`);
        // a test of the network (lan): its port refused, or what the person runs to say yes (no answer of a test there)
        if (how === "no-dialog") return phoneJson(res, 200, { ...phoneState(env), state: "off", error: { code: "no-dialog", detail: phoneTestPortRefused(env) ?? phoneTestYesHint(env) ?? "no window of the system can be shown on this computer: strom phone on in a terminal" } });
        return phoneJson(res, 200, phoneState(env));
      }
      if (sub === "off" && !act) {
        const run = phoneRunning(env);
        const how = stopPhone(env, "the Strom app", { waitMs: 0 });
        if (run && how !== "none") endPhoneLater(env, run.pid);
        noteLive(root, `the phone connection: turned off (${how === "none" ? "no server ran" : `its server ${run?.pid} ends`})`);
        return phoneJson(res, 200, { ...phoneState(env), state: "off" });
      }
      if (sub === "pair" && !act && devicesOn(env)) return pairFor(res, text);
      if (sub === "devices" && act && devicesOn(env)) return deviceTakenOff(req, res, decoded(act).slice(0, 40), text);
      if ((sub === "remove" || sub === "restore") && act) {
        const id = decoded(act).slice(0, 40);
        const now = Date.now();
        for (const [k, v] of phonesTakenOff) if (now - v.at > PHONE_RESTORE_MS) phonesTakenOff.delete(k);
        if (sub === "remove") {
          const gone = removePhone(env, id);
          if (!gone) return phoneJson(res, 404, refusal(`no paired phone ${id}`, "phone.unknown", { id }));
          phonesTakenOff.set(id, { phone: gone, at: now });
          noteLive(root, `the phone ${id} taken off the paired ones`);
        } else {
          const taken = phonesTakenOff.get(id);
          if (!taken) return phoneJson(res, 404, refusal(`the phone ${id} cannot be put back now: pair it again`, "phone.gone", { id }));
          phonesTakenOff.delete(id);
          restorePhone(env, taken.phone);
          noteLive(root, `the phone ${id} put back`);
        }
        return phoneJson(res, 200, { phones: phoneState(env).phones });
      }
      phoneJson(res, 404, refusal("no such address of the phone", "phone.not-found"));
    }));
  };

  /**
   * POST phone/pair {mode: "app" | "page"} (device.gateway): a new code to pair a device and its QR code — always the
   * Strom app for the device (the code of the devices, pairing v2): one way to pair. page (an older app that offered the
   * phone's page alone) is taken, and given the app's code too: the gateway gives the app at / and /pair, or the page
   * that waits for it. The address carries the secret after #: given to the app alone, never written to a log whole.
   */
  const pairFor = (res: http.ServerResponse, text: string) => {
    try {
      const said = JSON.parse(text || "{}") as { mode?: unknown };
      if (said.mode !== undefined && said.mode !== "app" && said.mode !== "page") return phoneJson(res, 400, refusal(`the body: {"mode": "app" | "page"}`, "phone.pair-body"));
    } catch {
      return phoneJson(res, 400, refusal(`the body: {"mode": "app" | "page"}`, "phone.pair-body"));
    }
    const s = phoneState(env);
    if (s.state !== "on") return phoneJson(res, 409, refusal("the phone connection is off", "phone.off"));
    if (!s.addresses.length) return phoneJson(res, 503, { ...refusal("the phone's server is starting: asked again in a moment", "phone.starting"), retry: 1 });
    const address = s.addresses[0]!.url;
    const tree = readJsonIfExists<TreeConfig>(path.join(root, TREE_FILE))?.id;
    const code = devicePairCode(env, { mode: "app", ...(tree ? { tree } : {}) });
    const url = devicePairUrl(address, code);
    const expiresAt = code.expiresAt;
    noteLive(root, `a code to pair a device made (the app, ${address}, until ${expiresAt})`);
    phoneSummarySeen = undefined;
    return phoneJson(res, 200, { url, qr: qrSvg(url), expiresAt });
  };
  /**
   * DELETE phone/devices/<id>: the device unpaired at once with the icons of its home screen (their keys gone: 401 at
   * their next request), {undo} — put back by POST phone/devices/<id>/restore within PHONE_RESTORE_MS (410 device.gone
   * after); 404 device.unknown (an icon's id too: it goes with its device). PUT phone/devices/<id> {name} (device.rename):
   * the row renamed, {device, devices}; 400 device.name, 404 device.unknown.
   */
  const deviceTakenOff = (req: http.IncomingMessage, res: http.ServerResponse, id: string, text: string) => {
    const now = Date.now();
    for (const [k, v] of devicesTakenOff) if (now - v.at > PHONE_RESTORE_MS) devicesTakenOff.delete(k);
    const url = (req.url ?? "").split("?")[0]!.split("/");
    const restore = req.method === "POST" && url[5] === "restore" && url.length === 6;
    if (req.method === "PUT" && url.length === 5) {
      let name = "";
      try {
        name = deviceName((JSON.parse(text || "{}") as { name?: unknown } | null)?.name);
      } catch {
        // no name
      }
      if (!deviceRows(devicesList(env), now).some((d) => d.id === id)) return phoneJson(res, 404, refusal(`no paired device ${id}`, "device.unknown", { id }));
      if (!name) return phoneJson(res, 400, refusal(`the body: {"name": "1–60 characters"}`, "device.name"));
      const renamed = renameDevice(env, id, name);
      if (!renamed) return phoneJson(res, 404, refusal(`no paired device ${id}`, "device.unknown", { id }));
      noteLive(root, `the device ${id} renamed`);
      phoneSummarySeen = undefined;
      const devices = devicesNow();
      return phoneJson(res, 200, { device: devices.list.find((d) => d.id === id), devices });
    }
    if (req.method === "DELETE" && url.length === 5) {
      const gone = removeDevice(env, id);
      if (!gone) return phoneJson(res, 404, refusal(`no paired device ${id}`, "device.unknown", { id }));
      const undo = crypto.randomBytes(16).toString("base64url");
      devicesTakenOff.set(id, { devices: gone, at: now, undo });
      noteLive(root, `the device ${id} taken off the paired ones`);
      phoneSummarySeen = undefined;
      return phoneJson(res, 200, { undo, devices: devicesNow() });
    }
    if (restore) {
      const taken = devicesTakenOff.get(id);
      let said: { undo?: unknown } = {};
      try {
        said = (JSON.parse(text || "{}") as typeof said) ?? {};
      } catch {
        // no undo said: the device's id is enough
      }
      if (!taken || (said.undo !== undefined && said.undo !== taken.undo)) {
        if (!taken && devicesList(env).some((d) => d.id === id)) return phoneJson(res, 200, { devices: devicesNow() });
        return phoneJson(res, /^dv_[a-z2-7]{16}$/.test(id) ? 410 : 404, refusal(`the device ${id} cannot be put back now: pair it again`, /^dv_[a-z2-7]{16}$/.test(id) ? "device.gone" : "device.unknown", { id }));
      }
      devicesTakenOff.delete(id);
      restoreDevice(env, taken.devices);
      noteLive(root, `the device ${id} put back`);
      phoneSummarySeen = undefined;
      return phoneJson(res, 200, { devices: devicesNow() });
    }
    return phoneJson(res, 404, refusal("no such address of the phone", "phone.not-found"));
  };

  /** The items of one place of What waits (group.key), as /status says them. */
  const groupItems = (tree: Tree, key: string) => waitingFor(tree, { shared: new Settings(env, {}).shared()?.value, stories: false }).filter((w) => w.item.group.key === key);
  /** What the app does with a task's wait the audit found not as strom needs it (POST /waiting/<T…>, tasks.audit). */
  const AUDIT_DO = ["fix", "unfix", "keep", "unkeep"] as const;
  type AuditDo = (typeof AUDIT_DO)[number];
  /** A sent or not sent from the app: "sent" or "unsent", else none. */
  const sentWord = (body: Record<string, unknown>): "sent" | "unsent" | undefined => (body.do === "sent" || body.do === "unsent" ? body.do : undefined);
  /**
   * The day a request went out, as the app gives it with {"do": "sent", "at": "YYYY-MM-DD"} (feature waiting.sentDay,
   * spec 149 K1.6): none given, today as before; a day: --date; anything else, or a day with unsent, refused here.
   */
  const sentAt = (body: Record<string, unknown>, word: "sent" | "unsent"): { args: string[] } | { code: number; body: Record<string, unknown> } => {
    if (body.at === undefined) return { args: [] };
    if (word === "unsent") return { code: 400, body: refusal(`the body: {"do": "unsent"} takes no "at"`, "waiting.bad-body") };
    const given = typeof body.at === "string" ? givenSentDay(body.at) : { why: `"at" is the day it went out, "YYYY-MM-DD"` };
    if ("why" in given) return { code: 400, body: refusal(`the day: ${given.why}`, "waiting.bad-date", { at: typeof body.at === "string" ? body.at.slice(0, 40) : "" }) };
    return { args: [`--date=${given.day}`] };
  };
  /**
   * POST /waiting/<T…> {"do": "answer", "text", "expect"?}: the person's answer to what the task waits for, as strom task
   * wake T… --answer in their terminal — kept on the task as theirs, given in the app (givenIn app), the task back in the
   * queue; expect: its item's `at` as the app saw it (it waits for something else since: 409 waiting.changed).
   */
  const answerAsk = (tree: Tree, id: string, body: Record<string, unknown>): { args: string[] } | { code: number; body: Record<string, unknown> } => {
    const text = typeof body.text === "string" ? body.text.normalize("NFC").trim() : "";
    if (!text || text.includes("\0") || [...text].length > ANSWER_MAX)
      return { code: 400, body: refusal(`the body: JSON {"do": "answer", "text": "<the answer, 1–${ANSWER_MAX} characters>", "expect"?: "<the item's at>"}`, "waiting.bad-body") };
    if (body.expect !== undefined && typeof body.expect !== "string") return { code: 400, body: refusal(`the body: "expect" is the item's at`, "waiting.bad-body") };
    const t = /^T\d+$/.test(id) ? tree.get<Task>(id) : undefined;
    if (!t || t.type !== "task" || t.retracted || t.state !== "waiting") return { code: 404, body: refusal(`${id} is no task that waits`, "waiting.none", { id }) };
    if (typeof body.expect === "string" && body.expect !== t.updated) return { code: 409, body: refusal(`${id} waits for something else since (${t.updated}) — nothing written`, "waiting.changed", { id, at: t.updated }) };
    if (!answersInApp(t)) return { code: 409, body: refusal(`${id} is answered in the terminal (kind ${waitKindOf(t)})`, "waiting.no-answer", { id, kind: waitKindOf(t) }) };
    return { args: ["task", "wake", id, `--answer=${text}`, `--expect=${t.updated}`] };
  };
  /**
   * POST /waiting/<T…> {"do": "retry", "expect"?} (feature waiting.retry, spec 089): strom task wake T… --retry, the
   * person's in the app — only an item core/retry.ts offers (its `retry` in /status), checked here as the research says
   * it now (the command checks it again under the lock).
   */
  const retryAsk = (tree: Tree, id: string, body: Record<string, unknown>): { args: string[] } | { code: number; body: Record<string, unknown> } => {
    if (body.expect !== undefined && (typeof body.expect !== "string" || !body.expect.trim())) return { code: 400, body: refusal(`the body: "expect" is the item's at`, "waiting.bad-body") };
    const t = /^T\d+$/.test(id) ? tree.get<Task>(id) : undefined;
    if (!t || t.type !== "task" || t.retracted || t.state !== "waiting") return { code: 404, body: refusal(`${id} is no task that waits`, "waiting.none", { id }) };
    if (typeof body.expect === "string" && body.expect !== t.updated) return { code: 409, body: refusal(`${id} waits for something else since (${t.updated}) — nothing written`, "waiting.changed", { id, at: t.updated }) };
    const r = retryOf(tree, t, { shared: new Settings(env, {}).shared()?.value });
    if (!r) return { code: 409, body: refusal(`${id} is not returned to the agent (kind ${waitKindOf(t)})`, "retry.not", { id }) };
    if (!r.can) return { code: 409, body: refusal(`${id} was returned to the agent ${RETRY_MAX} times within a day — again from ${r.until}`, "retry.limit", { id, until: r.until ?? "" }) };
    return { args: ["task", "wake", id, "--retry", ...(typeof body.expect === "string" ? [`--expect=${body.expect}`] : [])] };
  };
  /** The command's refusal of a return to the agent, as the app is told it (none: the refusals of the rest). */
  const retryRefused = (tree: Tree, code: string, why: string, id: string, data: Record<string, unknown>): { code: number; body: Record<string, unknown> } | undefined => {
    const p = data.params && typeof data.params === "object" ? (data.params as Record<string, unknown>) : {};
    const of = typeof p.task === "string" ? p.task : id;
    if (code === "task.retry-not") return { code: 409, body: refusal(why, "retry.not", { id: of }) };
    if (code === "task.retry-limit") return { code: 409, body: refusal(why, "retry.limit", { id: of, until: typeof p.until === "string" ? p.until : "" }) };
    if (code === "task.changed") return { code: 409, body: refusal(why, "waiting.changed", { id: of, at: tree.get<Task>(of)?.updated ?? "" }) };
    if (code === "task.not-waiting" || code === "task.none") return { code: 404, body: refusal(why, "waiting.none", { id: of }) };
    return undefined;
  };
  /** The command's refusal of a request marked sent, as the app is told it. */
  const sentRefused = (code: string, why: string, id: string): { code: number; body: Record<string, unknown> } | undefined =>
    code === "task.not-waiting" || code === "task.none"
      ? { code: 404, body: refusal(why, "waiting.none", { id }) }
      : code === "task.not-sendable"
        ? { code: 409, body: refusal(why, "waiting.not-sendable", { id }) }
        : undefined;

  /**
   * POST /waiting/<T…> {"do": "fix" | "keep", "expect"?: <its audit's stamp>} | {"do": "unfix" | "unkeep"} (feature
   * tasks.audit, spec 109 U2): strom task audit T… --fix | --keep [--expect …] | --unfix | --unkeep, the person's as given
   * in the app. Checked here as far as the research says it now (the command checks it again under the lock).
   */
  const auditAsk = (tree: Tree, id: string, act: AuditDo, body: Record<string, unknown>): { args: string[] } | { code: number; body: Record<string, unknown> } => {
    const expects = act === "fix" || act === "keep";
    if (body.expect !== undefined && (!expects || typeof body.expect !== "string" || !body.expect.trim()))
      return { code: 400, body: refusal(expects ? `the body: "expect" is the audit's stamp (T…@<at>)` : `the body: {"do": "${act}"} takes no "expect"`, "waiting.bad-body") };
    const t = /^T\d+$/.test(id) ? tree.get<Task>(id) : undefined;
    // undone or taken back: the task as it is (one the fix woke waits no more); the rest only of a task that waits
    if (!t || t.type !== "task" || t.retracted || (expects && t.state !== "waiting")) return { code: 404, body: refusal(`${id} is no task that waits`, "waiting.none", { id }) };
    if (typeof body.expect === "string" && body.expect.trim() !== `${t.id}@${t.updated}`)
      return { code: 409, body: refusal(`${id} changed since the audit the app saw (${body.expect.trim()}) — nothing written`, "waiting.changed", { id, at: t.updated }) };
    return { args: ["task", "audit", id, `--${act}`, ...(typeof body.expect === "string" ? [`--expect=${body.expect.trim()}`] : [])] };
  };
  /** The command's refusal of an audit's write, as the app is told it. */
  const auditRefused = (tree: Tree, act: AuditDo, code: string, why: string, id: string, data: Record<string, unknown>): { code: number; body: Record<string, unknown> } | undefined => {
    if (code === "audit.none") return { code: 409, body: refusal(why, "audit.none", { id }) };
    if (code === "audit.changed" && act === "unfix") {
      const d = data.details && typeof data.details === "object" ? (data.details as { changed?: unknown }).changed : undefined;
      const changed = Array.isArray(d) ? d.map(String) : [];
      return { code: 409, body: { ...refusal(why, "audit.changed", { id, changed: changed.join(", ") }), changed } };
    }
    if (code === "audit.changed") return { code: 409, body: refusal(why, "waiting.changed", { id, at: tree.get<Task>(id)?.updated ?? "" }) };
    if (code === "waiting.none" || code === "task.not-waiting" || code === "task.none") return { code: 404, body: refusal(why, "waiting.none", { id }) };
    return undefined;
  };

  /**
   * POST /waiting/<T…> {"do": "sent" | "unsent"}: strom task sent T… [--undo], the user's — a fact, not a decision; the
   * person's answer (answer); the audit's fix, its undoing, the wait kept as it is and taken back (fix, unfix, keep, unkeep).
   */
  const waitingWrite = (raw: string): AppWrite => {
    const id = /^[Tt]\d{1,9}$/.test(raw) ? normId(raw, "task") : raw.slice(0, 32);
    let said: "sent" | "unsent" | "answer" | "retry" | AuditDo = "sent";
    const audit = (): AuditDo | undefined => (AUDIT_DO.includes(said as AuditDo) ? (said as AuditDo) : undefined);
    return {
      get what() {
        return audit() ? `${id} audit ${said}` : said === "answer" ? `${id} answered` : said === "retry" ? `${id} returned to the agent` : `${id} sent`;
      },
      // an answer of up to 4000 characters, each up to 4 bytes, in JSON's escapes
      max: 64 * 1024,
      ask(tree, body) {
        if (body.do === "answer") {
          said = "answer";
          return answerAsk(tree, id, body);
        }
        if (body.do === "retry") {
          said = "retry";
          return retryAsk(tree, id, body);
        }
        if (AUDIT_DO.includes(body.do as AuditDo)) {
          said = body.do as AuditDo;
          return auditAsk(tree, id, said, body);
        }
        const word = sentWord(body);
        if (!word) return { code: 400, body: refusal(`the body: JSON {"do": "sent" | "unsent" | "answer" | "retry" | "fix" | "unfix" | "keep" | "unkeep"}`, "waiting.bad-body") };
        said = word;
        const t = /^T\d+$/.test(id) ? tree.get<Task>(id) : undefined;
        if (!t || t.type !== "task" || t.retracted || t.state !== "waiting") return { code: 404, body: refusal(`${id} is no task that waits`, "waiting.none", { id }) };
        const kind = waitKindOf(t);
        if (!SENDABLE.includes(kind)) return { code: 409, body: refusal(`${id} waits for no request to send (kind ${kind})`, "waiting.not-sendable", { id, kind }) };
        const at = sentAt(body, word);
        if ("code" in at) return at;
        return { args: ["task", "sent", id, ...(word === "unsent" ? ["--undo"] : at.args)] };
      },
      done(tree, data, head) {
        const t = tree.get<Task>(id);
        if (said === "answer" || said === "retry") return { task: id, state: t?.state ?? "open", head };
        const strings = (x: unknown) => (Array.isArray(x) ? x.map(String) : []);
        if (said === "fix") return { task: id, tasks: strings(data.tasks), woke: strings(data.woke), head };
        if (said === "unfix") return { task: id, tasks: strings(data.tasks), head };
        if (said === "keep" || said === "unkeep") return { task: id, kept: data.kept ?? null, head };
        const marked = Array.isArray(data.marked) ? data.marked.map(String) : [];
        return { [said]: marked, task: id, ...(t ? { phase: waitPhaseOf(t) } : {}), ...(t?.state === "waiting" && t.sent ? { sentAt: t.sent.at, sentDay: sentDay(t.sent.at) } : {}), head };
      },
      refused: (tree, code, why, data) => {
        const act = audit();
        if (act) return auditRefused(tree, act, code, why, id, data);
        if (said === "retry") return retryRefused(tree, code, why, id, data);
        if (code === "task.bad-date") return { code: 400, body: refusal(why, "waiting.bad-date", { at: "" }) };
        return code === "task.changed" ? { code: 409, body: refusal(why, "waiting.changed", { id, at: tree.get<Task>(id)?.updated ?? "" }) } : code === "task.check-person" ? { code: 409, body: refusal(why, "waiting.no-answer", { id }) } : code === "task.answer-long" ? { code: 400, body: refusal(why, "waiting.bad-body") } : sentRefused(code, why, id);
      },
    };
  };

  /**
   * POST /group/<key> {"do": "sent"} — every item of the place still to be sent (a letter, the family, other) marked
   * sent: {sent: [those it marked], head}; {"do": "unsent", "tasks": [T…]} — only those of them that are of the place and
   * sent taken back (never "the last send" made out of the state: the app sends back the list the sent answered).
   */
  const groupWrite = (key: string): AppWrite => {
    let said: "sent" | "unsent" | "retry" = "sent";
    let day: string | undefined;
    return {
      get what() {
        return `${key.slice(0, 60)} ${said === "retry" ? "returned to the agent" : "sent"}`;
      },
      ask(tree, body) {
        // all of the place the agent could manage now, returned to it at once in What waits' order (waiting.retry)
        if (body.do === "retry") {
          said = "retry";
          const items = groupItems(tree, key);
          if (!key || !items.length) return { code: 404, body: refusal(`nothing waits at ${key.slice(0, 80) || "that place"}`, "group.none", { group: key.slice(0, 80) }) };
          const ids = items.filter((w) => w.task && (w.item.retry as RetryView | undefined)?.can).map((w) => w.task!.id);
          if (!ids.length) {
            const h = head(root);
            return { code: 200, body: { retried: [], group: key, head: h, parent: h } };
          }
          return { args: ["task", "wake", ...ids, "--retry"] };
        }
        const word = sentWord(body);
        const listed = Array.isArray(body.tasks) ? body.tasks.filter((x): x is string => typeof x === "string" && /^[Tt]\d{1,9}$/.test(x)).map((x) => normId(x, "task")) : [];
        if (!word || (word === "unsent" && !listed.length)) return { code: 400, body: refusal(`the body: JSON {"do": "sent", "at"?: "YYYY-MM-DD"} or {"do": "unsent", "tasks": ["T…"]}`, "waiting.bad-body") };
        said = word;
        const at = sentAt(body, word);
        if ("code" in at) return at;
        day = at.args.length ? at.args[0]!.slice("--date=".length) : undefined;
        const items = groupItems(tree, key);
        if (!key || !items.length) return { code: 404, body: refusal(`nothing waits at ${key.slice(0, 80) || "that place"}`, "group.none", { group: key.slice(0, 80) }) };
        const ids = items
          .filter((w) => w.task && SENDABLE.includes(w.item.kind as WaitKind) && (word === "sent" ? w.item.phase === "todo" : w.item.phase === "sent" && listed.includes(w.task.id)))
          .map((w) => w.task!.id);
        if (!ids.length) {
          const h = head(root);
          return { code: 200, body: { [word]: [], group: key, head: h, parent: h } };
        }
        return { args: ["task", "sent", ...ids, ...(word === "unsent" ? ["--undo"] : at.args)] };
      },
      done(_tree, data, head) {
        if (said === "retry") return { retried: Array.isArray(data.tasks) ? data.tasks.map((t) => String((t as { id?: unknown }).id)) : [], group: key, head };
        const marked = Array.isArray(data.marked) ? data.marked.map(String) : [];
        return { [said]: marked, group: key, ...(said === "sent" && day ? { sentDay: day } : {}), head };
      },
      refused: (tree, code, why, data) =>
        said === "retry" ? retryRefused(tree, code, why, key.slice(0, 80), data) : code === "task.bad-date" ? { code: 400, body: refusal(why, "waiting.bad-date", { at: day ?? "" }) } : sentRefused(code, why, key.slice(0, 80)),
    };
  };

  /**
   * GET /waiting/<T…>/fix (feature tasks.audit, spec 109 U2): the task's wait checked now, as strom task audit T… --json
   * says it — {task, at, findings, fix: {can, stamp, changes, left}, kept, fixed}; 404 waiting.none (no task that waits),
   * 409 audit.none (its wait is as strom needs it).
   */
  const auditPreview = (raw: string): { code: number; body: Record<string, unknown> } => {
    const id = /^[Tt]\d{1,9}$/.test(raw) ? normId(raw, "task") : raw.slice(0, 32);
    const tree = Tree.open(root, env);
    const t = /^T\d+$/.test(id) ? tree.get<Task>(id) : undefined;
    if (!t || t.type !== "task" || t.retracted || t.state !== "waiting") return { code: 404, body: refusal(`${id} is no task that waits`, "waiting.none", { id }) };
    const a = auditOf(tree, t, { shared: new Settings(env, {}).shared()?.value });
    if (!a.findings.length) return { code: 409, body: refusal(`${id}: its wait is as strom needs it`, "audit.none", { id }) };
    return { code: 200, body: { task: a.task, at: a.at, findings: a.findings, fix: a.fix, kept: a.kept, fixed: a.fixed } };
  };

  /** No such send asked about now: answered (here, in the terminal), or no longer asked. */
  const noImport = (id: string) => ({ code: 404, body: refusal(`${id} waits no more: answered, or no send asked about`, "waiting.none", { id }) });

  /** GET /waiting/W-S-I…/preview: what the answer "from a family tree" changes (strom sync as-import I… --json). */
  const importPreview = (raw: string): { code: number; body: Record<string, unknown> } => {
    const id = raw.slice(0, 32);
    const tree = Tree.open(root, env);
    const w = importWaiting(tree, id);
    if (!w?.importSend) return noImport(id);
    return { code: 200, body: { ...sendPlan(tree, sendInput(tree, w.importSend.input)) } };
  };

  /** GET /group/<key>/note: the request texts of the place's waiting tasks joined for one e-mail — each file once. */
  const groupNote = (key: string): { code: number; body: Record<string, unknown> } => {
    const tree = Tree.open(root, env);
    const items = key ? groupItems(tree, key) : [];
    if (!items.length) return { code: 404, body: refusal(`nothing waits at ${key.slice(0, 80) || "that place"}`, "group.none", { group: key.slice(0, 80) }) };
    return { code: 200, body: { ...requestTexts(tree, items.filter((w) => w.task).map((w) => w.task!)) } };
  };

  /** The app sends nothing (unchanged, the user said no, no tree of this research): strom sync --app stops waiting. */
  const nothing = (req: http.IncomingMessage, res: http.ServerResponse, origin: string | undefined) => {
    const reply = (code: number, body: Record<string, unknown>) =>
      res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(body));
    if (!origin) {
      reply(403, { error: "only the Strom app may say so" });
      return;
    }
    let body = "";
    req.on("data", (c: Buffer) => {
      if (body.length < 4096) body += c.toString("utf8");
    });
    req.on("end", () => safely(req, res, () => {
      let reason = "cancelled";
      try {
        reason = String((JSON.parse(body) as { reason?: unknown }).reason ?? reason);
      } catch {
        reason = body.trim() || reason;
      }
      reply(200, { ok: true, reason: noteNothingSent(root, reason) });
    }));
  };

  // What breaks where nobody catches it is written down; the bridge only reads, so it goes on.
  process.on("uncaughtException", (e) => noteLive(root, `uncaught: ${errorText(e)}`));
  process.on("unhandledRejection", (e) => noteLive(root, `unhandled: ${errorText(e)}`));

  return new Promise<number | undefined>((resolve) => {
    let up = false;
    let wanted = last?.port ?? 0;
    let tries = 0;
    // when the port is asked for again: at once after the bridge before ended (its port free — the address the app
    // follows answers again sooner), else after a while
    let again = 250;
    server.on("error", (e: NodeJS.ErrnoException) => {
      if (!up && wanted && e.code === "EADDRINUSE") {
        // the bridge before this one still holds it (stuck, or ending just now): ended, its port taken again — the
        // app following the address goes on; a port another program holds: another one (the app needs ?live= again)
        const before = last && last.pid !== process.pid ? last.pid : undefined;
        const ended = before && tries === 0 ? endBridge(before, root, { why: `a new bridge (${process.pid}) takes port ${wanted}`, back: true }) : "gone";
        if (ended === "elsewhere") {
          // a bridge of another folder (its note copied with the research): never ended, never its address — a new one
          noteLive(root, `a bridge of another folder (${before}) holds port ${wanted}: not ended`);
          token = crypto.randomBytes(16).toString("hex");
          tries = 20;
        } else if (ended !== "gone") {
          noteLive(root, `the bridge before (${before}) still held port ${wanted}: ended`);
          tries = 1;
          if (ended === "stopped" || ended === "killed") again = 0;
        }
        if (tries > 0 && tries++ < 20) {
          setTimeout(() => server.listen(wanted, "127.0.0.1"), again);
          again = 250;
          return;
        }
        noteLive(root, `port ${wanted} is taken: another one — the Strom app needs the new address (strom app --live)`);
        wanted = 0;
        server.listen(0, "127.0.0.1");
        return;
      }
      noteLive(root, `the server: ${errorText(e)}`);
      if (!up) resolve(undefined);
    });
    // taking over from the bridge of an older strom (it answers meanwhile): /status made first, so the app's first ask
    // here waits for no thread's start (a few seconds on a slow computer) — at most a while
    if (env.STROM_LIVE_RENEWED) void keeper.ready(statusVersion, Number(env.STROM_LIVE_READY_MS ?? 10_000)).then(() => server.listen(wanted, "127.0.0.1"));
    else server.listen(wanted, "127.0.0.1");
    server.once("listening", () => {
      up = true;
      // another bridge of this tree came up while this one started (its claim taken over meanwhile, a bridge of an older
      // strom that claims nothing): this one goes, nothing of it written — the check and the notes one step under the
      // tree's owner lock, so no other bridge writes its own between them
      const port = (server.address() as { port: number }).port;
      const meanwhile = withLiveOwner(root, () => {
        const rival = rivalBridge(root, env);
        if (rival) return rival;
        // its start in its log before live.json says it is there: what strom live start answers its log has said already
        const how = !last ? "a new address" : last.port === port ? (last.token ? "the address of the last bridge" : "the port of the last bridge, a new secret (it was ended for good)") : last.token ? "the token of the last bridge, another port" : "a new address";
        noteLive(root, `started: strom ${VERSION}, port ${port}, ${how}`);
        try {
          writeOwner(root);
        } catch {
          // a folder not to be written: live.json says the bridge
        }
        live = { port, token, pid: process.pid, url: `http://127.0.0.1:${port}/${token}`, started: new Date().toISOString(), version: VERSION };
        writeLive(root, live);
        // its address kept as soon as it says it is there (a bridge killed right after its start is brought back at it)
        writeLast(root, { port, token, pid: process.pid, started: live.started });
        // the files a bridge before left queued taken over; the warm writer starts with the first write of the app's
        // (a bridge that only answers reads starts no strom of its own and writes nothing into the research)
        media.takeOver();
        return undefined;
      });
      if (meanwhile || !live) {
        noteLive(root, `another bridge of this tree came up meanwhile (${meanwhile}): this one (${process.pid}) ends`);
        dropOwner(root);
        server.close();
        if (meanwhile) endStarter(root, env, meanwhile);
        return resolve(meanwhile);
      }
      // its research gone: no strom.json there, or the .strom it was started with deleted (gone, or another one in its
      // place) — the bridge then ends and makes neither again (noteLive, writeLast make no folder)
      // — and still gone when looked at again a while later (STROM_LIVE_GONE_MS): a disk away for a moment (a network
      // folder reconnecting, a disk waking) ends no bridge
      const dotStrom = folderId(path.join(root, ".strom"));
      const goneMs = Number(env.STROM_LIVE_GONE_MS ?? GONE_MS);
      let goneSince: number | undefined;
      let goneSeen = 0;
      const researchGone = () => {
        if (fs.existsSync(path.join(root, "strom.json")) && folderId(path.join(root, ".strom")) === dotStrom) {
          goneSince = undefined;
          goneSeen = 0;
          return false;
        }
        goneSince ??= Date.now();
        goneSeen++;
        return goneSeen >= 2 && Date.now() - goneSince >= goneMs;
      };
      // A read that fails (another strom writing that moment) is tried again at the next tick; written down once — each
      // part of the tick on its own (another part working meanwhile, the readings, the widget, is no "works again")
      const troubles = new Map<string, { text: string; times: number }>();
      const safe = <T>(what: string, fn: () => T): T | undefined => {
        const trouble = troubles.get(what);
        try {
          const got = fn();
          if (trouble) noteLive(root, `${what} works again (${trouble.times}× failed)`);
          troubles.delete(what);
          return got;
        } catch (e) {
          // the same error met at another place of the part (its stack another) is the same trouble
          const text = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
          if (trouble?.text === text) trouble.times++;
          else {
            troubles.set(what, { text, times: 1 });
            noteLive(root, `${what} failed (tried again): ${errorText(e)}`);
          }
          return undefined;
        }
      };

      // What changed: strom commits every change, so a new commit is news.
      let seen = safe("the start", () => head(root)) ?? "";
      // since when a change waits for its tree (the app that follows it loads it at once); a tree being made for it
      let untold: { since: number } | undefined;
      let prebuilding = false;
      const changeWaitMs = Number(env.STROM_LIVE_CHANGE_WAIT_MS ?? CHANGE_WAIT_MS);
      // what the last 24 hours added, worked out before the app asks (/status never waits for it)
      if (seen) recentNow(root, env, seen);
      // who is at work changes only with the workers present (.strom/workers: who, since, paused, alive) or a commit:
      // worked out again only then — nobody at work, nothing to read
      let atWorkKey: string | undefined;
      let atWorkNow: ReturnType<typeof working> = [];
      const atWork = (h: string) => {
        const present = liveWorkers(root);
        // and the holds (spec 127): an agent working directly, its sign of life, a restricted archive held or waited for
        const holds = holdsStamp(root, holdsShared);
        const key = `${h}\n${JSON.stringify(present)}\n${holds}`;
        if (key !== atWorkKey) {
          if (!present.length && !holds) atWorkNow = [];
          else {
            const tree = Tree.open(root, env);
            atWorkNow = working(root, tree, scopes(tree));
          }
          atWorkKey = key;
        }
        return atWorkNow;
      };
      let workers = safe("the start", () => JSON.stringify(atWork(seen))) ?? "";
      // the rows of the devices of the home network as last looked at (device.events): the first look, at the start,
      // says nothing — what changes after it is told (a device paired a moment after the start too)
      let deviceRowsSeen: DeviceRow[] | undefined = safe("the devices", () => (devicesOn(env) ? deviceRows(devicesList(env), Date.now()) : undefined));
      let devicesChecked = Date.now();
      // the research on the desktop (the Strom Widget of a Mac, the widget of Windows 11): the tree's overview written
      // while the bridge runs (core/widget.ts; none but on macOS and Windows) — the first a moment after the start, never in its way
      // (worked out on a thread of its own: a second and more on a large research, every check; off: here, as before —
      // the thread ended with the bridge says nothing) — and only when the state of the research /status is kept by
      // changed, else once a minute (the same research, nothing new to work out)
      let widgetEnds = false;
      const widget = widgetWriter(
        root,
        env,
        process.platform,
        Date.now,
        widgetMaker(root, env, (text) => {
          if (!widgetEnds) noteLive(root, text);
        }),
        () => keeper.keyNow(),
      );
      if (widget) setTimeout(() => safe("the widget", () => widget.tick(true)), 1000).unref?.();
      const send = (event: string, data: unknown) => {
        for (const s of streams) s.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };
      // a tree given older than the research (?stale=1) and the one of its head made since: the change from the older
      sayChange = (from, to) =>
        safe("a change", () => {
          if (!streams.size || from === to) return;
          const { head: h, at } = tip(root);
          const entries = histories.since(Tree.open(root, env), [`-n${LOG_MAX}`, `${from}..${to}`]);
          send("change", { head: to, what: subjects(root, from, to), at: (to === h ? at : undefined) ?? new Date().toISOString(), entries });
          if (to === h) {
            seen = to;
            untold = undefined;
          }
        });
      // the trees kept on disk by another strom: never given again
      setTimeout(() => void tidyStoredGeds(root).catch((e) => noteLive(root, `the trees kept on disk not tidied: ${errorText(e)}`)), 5000).unref?.();
      // a bridge taking over from one whose app followed the tree: its tree made before the app asks again
      if (gedFollow) {
        const follow = gedFollow;
        setTimeout(() => void makeGed(follow.version, follow.images, follow.media).catch((e) => noteLive(root, `the tree for the app not made: ${errorText(e)}`)), 3000).unref?.();
      }
      // sends left waiting when the bridge before ended (written at once): written now, one after another
      setTimeout(() => {
        try {
          writeNext();
        } catch (e) {
          noteLive(root, `the sends that wait were not written: ${errorText(e)}`);
        }
      }, 500).unref?.();
      // A newer strom on disk (an update, the installer run again, npm): the bridge starts again with it — at its port
      // with its token (the app goes on by itself), only once the new one starts, only while nothing is written; a new
      // one that does not start: this one goes on, said in the log (Milan's wish, 2026-10-03). Run from the sources:
      // never (each edit would count).
      const RENEW_MS = Number(env.STROM_LIVE_RENEW_MS ?? 60_000);
      const runs = env.STROM_LIVE_RENEWED ?? VERSION;
      let renewChecked = Date.now();
      let tried: string | undefined;
      let renewing = false;
      // something the app sent written now: its body coming, a strom of the bridge's writing it (a send, an adoption, an
      // original, a batch, the person's answer)
      // (the queue's writer and the warm writer at work too; files queued and not written yet keep it from renewing)
      const writesNow = () => incoming > 0 || writing !== undefined || adopting || kids.size > 0 || media.writing() || writer.busy();
      const busy = () => writesNow() || retryAt !== undefined || tidying || media.pending() > 0;
      // the order kept on a thread of its own (core/livetidy-worker.ts): seconds on a large research, the bridge answers
      // meanwhile; a thread that cannot start: kept here, as before
      let tidying = false;
      const tidyOffThread = () => {
        let w: Worker;
        try {
          const env1 = Object.fromEntries(Object.entries(env).filter((e): e is [string, string] => typeof e[1] === "string"));
          w = new Worker(new URL(`./livetidy-worker${path.extname(fileURLToPath(import.meta.url))}`, import.meta.url), { workerData: { root, env: env1 }, env: env1 });
        } catch (e) {
          noteLive(root, `keeping order not on its thread (${errorText(e)}): here`);
          return safe("keeping order", () => autoTidy(Tree.open(root, env)));
        }
        tidying = true;
        w.unref();
        const from = Date.now();
        const done = (why?: string) => {
          if (!tidying) return;
          tidying = false;
          noteLive(root, why ? `keeping order: ${why}` : `kept in order on its thread (${Date.now() - from} ms)`);
          void w.terminate();
        };
        w.once("message", (m: { ok: boolean; message?: string }) => done(m.ok ? undefined : m.message));
        w.once("error", (e) => done(errorText(e)));
        w.once("exit", (code) => done(code ? `its thread ended (exit ${code})` : undefined));
      };
      // The new bridge started while this one still answers: once it runs (its code loaded, a few seconds on a slow
      // computer) it asks this one to end through the stop file and takes the port at once, as a bridge wanted by
      // another strom does — the app waits a moment, not the new one's start (found: ~4.5 s without an answer when this
      // one closed first). One that does not take over (ends at once, never asks): this one goes on, said in the log.
      let handing: { pid: number | undefined; version: string } | undefined;
      // ended (stop): what a renewal waited for is dropped — never a new bridge started for one that ended meanwhile
      let over = false;
      // Whether the strom on disk starts at all (--version), asked without holding the bridge: it answers meanwhile — a
      // strom's start is seconds on a computer under load, which the app once waited out without an answer.
      const renew = (disk: { version: string; probe?: "fail" }) => {
        renewing = true;
        tried = disk.version;
        const { command, args } = lastingLauncher();
        const failed = (status: string, err: string) => {
          renewing = false;
          noteLive(root, `strom ${disk.version} is on disk but does not start (exit ${status}${err ? `: ${err.trim().split("\n").pop()?.slice(0, 200)}` : ""}): this bridge (${runs}) goes on`);
        };
        let probe: ChildProcess;
        try {
          probe = spawn(command, disk.probe === "fail" ? ["-e", "process.exit(7)"] : [...args, "--version"], { env: env as NodeJS.ProcessEnv, stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
        } catch (e) {
          return failed("?", errorText(e));
        }
        let err = "";
        probe.stderr?.on("data", (d: Buffer) => {
          if (err.length < 4096) err += d.toString("utf8");
        });
        const slow = setTimeout(() => {
          try {
            probe.kill("SIGKILL");
          } catch {
            // gone
          }
        }, 60_000);
        slow.unref?.();
        let heard = false;
        probe.once("error", (e) => {
          if (heard) return;
          heard = true;
          clearTimeout(slow);
          if (!over) failed("?", errorText(e));
        });
        probe.once("close", (code, signal) => {
          if (heard) return;
          heard = true;
          clearTimeout(slow);
          if (over) return;
          if (code !== 0) return failed(String(code ?? signal ?? "?"), err);
          handOver(disk);
        });
      };
      const handOver = (disk: { version: string }) => {
        noteLive(root, `strom ${disk.version} on disk: the bridge starts again with it (port ${port}, its token kept)`);
        const back = (why: string) => {
          if (!handing) return;
          const was = handing.pid;
          handing = undefined;
          renewing = false;
          // the tree claimed again (the new one claimed it as it started) — unless another bridge holds it meanwhile:
          // then that one is the tree's, and this one ends (the new one ended at once for it)
          const rival = claimTree(root, env, was);
          if (rival) return stop(`another bridge of this tree runs (${rival}): the bridge of strom ${disk.version} ended for it`, "restart", true);
          noteLive(root, `the bridge of strom ${disk.version} did not take over (${why}): this one (${runs}) goes on`);
        };
        let child: ChildProcess;
        try {
          child = spawnBridge(root, env, { STROM_LIVE_RENEWED: disk.version, STROM_LIVE_REPLACES: String(process.pid), STROM_LIVE_STATUS_FOR: statusVersion ?? "", ...(gedFollow ? { STROM_LIVE_GED_FOR: gedFollow.version ?? "", ...(gedFollow.images === "ref" ? { STROM_LIVE_GED_IMAGES: "ref" } : {}), ...(gedFollow.media ? { STROM_LIVE_GED_MEDIA: "app" } : {}) } : {}) });
        } catch (e) {
          renewing = false;
          return noteLive(root, `the bridge of strom ${disk.version} did not take over (${errorText(e)}): this one (${runs}) goes on`);
        }
        handing = { pid: child.pid, version: disk.version };
        child.once("exit", (code, signal) => back(code === EXIT.locked ? "it ended at once: another bridge of this tree runs" : `it ended at once (exit ${code ?? signal ?? "?"})`));
        setTimeout(() => {
          if (!handing) return;
          try {
            if (child.exitCode === null) child.kill("SIGKILL");
          } catch {
            // gone
          }
          back("it did not answer in time");
        }, Number(env.STROM_LIVE_RENEW_WAIT_MS ?? 30_000)).unref?.();
      };
      // the folders of the shared inbox tasks wait on (core/inboxwatch.ts): images the person saves there taken as they
      // come — a strom of the bridge's, as the person — and a task they complete back in the queue
      const inbox = watchInbox({
        root,
        env,
        shared: () => new Settings(env, {}).shared()?.value,
        busy,
        note: (line) => noteLive(root, line),
        take: (done) => {
          const { command, args } = stromLauncher();
          let child: ChildProcess;
          try {
            child = spawn(command, [...args, "media", "add", "--inbox", "--waiting", "--json"], { cwd: root, env: forApp(env, root), stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
          } catch (e) {
            noteLive(root, `images saved for waiting tasks not taken now: ${errorText(e)}`);
            return done(false);
          }
          track(child);
          let out = "";
          let err = "";
          child.stdout?.on("data", (d: Buffer) => (out += d.toString("utf8")));
          child.stderr?.on("data", (d: Buffer) => (err += d.toString("utf8")));
          let gone = false;
          child.on("error", (e) => {
            gone = true;
            noteLive(root, `images saved for waiting tasks not taken now: ${errorText(e)}`);
            done(false);
          });
          child.on("close", (code, signal) => {
            if (gone) return;
            // what lies in the folders changed (taken, or left there: /status books pending): made again at the next ask
            keeper.forget();
            // ended by a signal: said, and the inbox free to take them at its next look
            if (code === null) {
              noteLive(root, `images saved for waiting tasks not taken now: its strom ended (${signal ?? "a signal"})`);
              return done(false);
            }
            if (code !== 0) {
              // the research busy with another writer the whole wait (the agent's own take among them): nothing wrong —
              // the next look takes what is still there, quietly
              if (code === EXIT.locked) return done(false);
              // a real error: said with its words (--json gives them on stdout), never a bare exit code
              noteLive(root, `images saved for waiting tasks not taken now: ${takeError(out, err) ?? `exit ${code}`}`);
              return done(false);
            }
            try {
              const data = JSON.parse(out) as { taken?: { folder: string; added: number[]; problem?: string; left?: number; aside?: string[]; back?: string[]; byFolder?: string[]; sheets?: string[]; lying?: string[] }[]; woken?: string[] };
              for (const t of data.taken ?? []) {
                if (t.added.length || t.problem)
                  noteLive(root, `inbox ${t.folder}: ${t.problem ? `nothing taken — ${t.problem}` : `${counted(t.added.length, "image")} registered${t.left ? `, ${counted(t.left, "file")} without an image number left lying` : ""}`}`);
                // a file that is the same scan as another image: set aside, never deleted unsaid (B0408)
                for (const a of t.aside ?? []) noteLive(root, `inbox ${t.folder}: ${a}`);
                // named otherwise, taken in the folder's order; another sheet told by its content; settled with a part (spec 141)
                for (const c of t.byFolder ?? []) noteLive(root, `inbox ${t.folder}: in the folder's order: ${c}`);
                for (const c of t.sheets ?? []) noteLive(root, `inbox ${t.folder}: ${c}`);
                if (t.back?.length) noteLive(root, `inbox ${t.folder}: settled — back in the queue with a part of the images: ${t.back.join(", ")}${t.lying?.length ? `; left lying: ${t.lying.join(", ")}` : ""}`);
              }
              if (data.woken?.length) noteLive(root, `back in the queue (images saved): ${data.woken.join(", ")}`);
            } catch {
              // said by the exit code
            }
            done(true);
          });
        },
      });
      let batchesChecked = 0;
      let incomingCleaned = 0;
      // what GET /history answers, looked at again at most once a minute while the app follows (its rev and the head)
      let historyChecked = 0;
      let historySeen: { rev: string; head: string } | undefined;
      // what GET /quality answered when the bridge began: a mark of the person while nobody followed is told at once
      let qualitySeen: string | undefined = qualityRev({ root }, "0000000");
      const HISTORY_MS = Number(env.STROM_LIVE_HISTORY_MS ?? 60_000);
      // the first a few minutes after it starts, then once a day
      let tidied = Date.now() - Number(env.STROM_TIDY_MS ?? 24 * 3600_000) + Number(env.STROM_TIDY_FIRST_MS ?? 5 * 60_000);
      // Another bridge holds the tree (its claim, live.json naming it — not this one): this one is none of the tree's —
      // one left over beside it (started late, by an older strom, its successor ended) ends itself, looked at every
      // while (STROM_LIVE_OWNER_MS). One live.json names goes on: a bridge claiming the tree while it starts ends for it.
      const OWNER_MS = Number(env.STROM_LIVE_OWNER_MS ?? 10_000);
      let ownerChecked = Date.now();
      // (only read — live.json and the claim are written whole — never waiting for the owner lock in the bridge's tick)
      const heldBy = () => {
        let named: unknown;
        try {
          named = (JSON.parse(fs.readFileSync(liveFile(root), "utf8")) as { pid?: unknown }).pid;
        } catch {
          // none
        }
        return named === process.pid ? undefined : rivalBridge(root, env);
      };
      // The strom this bridge runs is gone from the disk (an update removed its version's folder, npm put another in
      // its place): what it loads only when needed (its threads, the widget) fails from now on — it ends, said in its
      // log (found 2026-11-09: a bridge whose version's folder an update had removed wrote a failure every 16 s for
      // hours). Seen gone at two looks STROM_LIVE_GONE_MS apart: files being replaced for a moment end no bridge.
      const ownCode = fileURLToPath(import.meta.url);
      let codeGoneSince: number | undefined;
      const codeGone = () => {
        if (fs.existsSync(ownCode)) {
          codeGoneSince = undefined;
          return false;
        }
        codeGoneSince ??= Date.now();
        return Date.now() - codeGoneSince >= goneMs;
      };
      const timer = setInterval(() => {
        // its research gone (taken off the computer, a test's folder, moved; its .strom deleted): nothing to follow —
        // even while handing over (found: bridges of a folder removed in the middle of it left running for hours)
        if (researchGone()) return stop("the research is no longer there", "gone", false);
        if (renewing) return;
        if (codeGone()) return stop(`the strom it runs is no longer on the disk (${path.dirname(path.dirname(path.dirname(ownCode)))}): this one (${process.pid}) ends`, "stopped", false);
        if (Date.now() - ownerChecked > OWNER_MS) {
          ownerChecked = Date.now();
          const holder = safe("the tree's claim", heldBy);
          if (holder) return stop(`another bridge of this tree holds it (${holder}): this one (${process.pid}) ends`, "stopped", false);
        }
        if (Date.now() - renewChecked > RENEW_MS) {
          renewChecked = Date.now();
          const disk = diskVersion(env);
          // never while another version works in the research (a run, a conversation started before the update): the new
          // bridge would bring its data to a newer schema under it (spec 037) — renewed once that work ends
          if (disk && disk.version !== runs && disk.version !== tried && !busy() && otherVersionsAtWork(root, disk.version).length === 0) return renew(disk);
        }
        // a batch nobody said is whole: closed a day after its last file, a phone's an hour after (looked at once a minute)
        if (Date.now() - batchesChecked > Number(env.STROM_BATCH_CHECK_MS ?? 60_000)) {
          batchesChecked = Date.now();
          let idle: string[] = [];
          try {
            idle = idleBatches(root, Date.now(), env);
          } catch (e) {
            noteLive(root, `the batches could not be looked at: ${errorText(e)}`);
          }
          for (const id of idle) closeBatchNow(id, ["--idle"], (code) => noteLive(root, code === 200 ? `the batch ${id} closed: no file came for a while` : `the batch ${id} not closed now (${code})`));
        }
        // the files of uploads cut short a day ago (media/.incoming/*.part), once an hour
        if (Date.now() - incomingCleaned > 3600_000) {
          incomingCleaned = Date.now();
          const shared = new Settings(env, {}).shared()?.value;
          const gone = shared ? cleanIncoming(shared) : 0;
          if (gone) noteLive(root, `${counted(gone, "upload")} cut short a day ago removed (media/.incoming)`);
          // this research's queued files no job names any more (never another research's, never one a job waits for)
          const orphans = shared ? safe("the queue's files", () => cleanQueued(shared, root, queueTag(readTree(root, env).config.id))) ?? 0 : 0;
          if (orphans) noteLive(root, `${counted(orphans, "queued file")} no job names removed (media/.incoming)`);
        }
        // what strom keeps beside the research in order, once a day (a tree tidied once; never while a send is written)
        if (Date.now() - tidied > Number(env.STROM_TIDY_MS ?? 24 * 3600_000) && !busy()) {
          tidied = Date.now();
          tidyOffThread();
        }
        // the idle time runs only while nobody works in the tree (a run waiting for its gate works too): the app watching
        // the tree without following it (/status?poll=1) still finds the bridge while an agent is at work
        // the queue of the documents the app asked to be read (one at a time); what changed of the readings, for the event read
        const readsChanged = safe("the readings", () => reads.tick()) ?? [];
        safe("the sorts", () => sorts.tick());
        // what /status says of the readings changed without a commit: made again at the next ask
        if (readsChanged.length) keeper.forget();
        if (streams.size || anyoneAtWork(root) || reads.active() || sorts.active()) lastAsked = Date.now();
        if (Date.now() - idleRead > IDLE_READ_MS) {
          idleRead = Date.now();
          const was = idleMs;
          idleMs = safe("the idle time", () => new Settings(env, {}).liveIdleMs()) ?? idleMs;
          // turned on now: its time counts from now, not from the last ask before it
          if (was === 0 && idleMs > 0) lastAsked = Date.now();
          // what /status says of it (live) changed without a commit: made again at the next ask
          if (was !== idleMs) keeper.forget();
        }
        if (idleMs > 0 && Date.now() - lastAsked > idleMs) return stop("idle: nobody asked for a while", "idle", false);
        safe("the widget", () => widget?.tick());
        // the devices of the home network (on): a row paired, renamed, unpaired, connected or gone — the event device
        // (looked at with nobody following too: a stream opened later is told what changed since, not what was before)
        if (Date.now() - devicesChecked >= DEVICE_EVENTS_MS) {
          devicesChecked = Date.now();
          safe("the devices", () => {
            if (!devicesOn(env)) return void (deviceRowsSeen = undefined);
            const rows = deviceRows(devicesList(env), Date.now());
            if (deviceRowsSeen) for (const e of deviceEvents(deviceRowsSeen, rows, new Date().toISOString())) send("device", e);
            deviceRowsSeen = rows;
          });
        }
        if (!streams.size) return;
        safe("a tick", () => {
          const { head: h, at } = tip(root);
          // a change told once the tree for the app that follows is made (it loads it at once; meanwhile it shows the
          // one before): made when the commits stop coming, told without it after changeWaitMs
          let tell = !!h && h !== seen;
          const follow = gedFollow;
          if (tell && follow && changeWaitMs > 0) {
            untold ??= { since: Date.now() };
            const ready = geds.get(variantOf(follow.version, follow.images, follow.media).variant)?.head === h;
            if (!ready && Date.now() - untold.since < changeWaitMs) {
              tell = false;
              if (!prebuilding && !(at && Date.now() - Date.parse(at) < quietMs)) {
                prebuilding = true;
                makeGed(follow.version, follow.images, follow.media)
                  .catch((e) => noteLive(root, `the tree for the app not made: ${errorText(e)}`))
                  .finally(() => (prebuilding = false));
              }
            }
          }
          if (tell) {
            // when the commit was made: the same as in /log, so the app knows it has it; each new commit as /log gives it (its task)
            const entries = histories.since(Tree.open(root, env), seen ? [`-n${LOG_MAX}`, `${seen}..${h}`] : ["-1", h]);
            send("change", { head: h, what: subjects(root, seen, h), at: at ?? new Date().toISOString(), entries });
            seen = h;
            untold = undefined;
            // the app asks /status after a change: made for the new commit before it asks
            keeper.warm(statusVersion);
          }
          for (const r of readsChanged) send("read", r);
          // what GET /history answers changed without a new commit (a catalog of the shared folder another tree's session
          // wrote): the event history {rev}; with a new commit the change said it already (the app reads /status again)
          if (Date.now() - historyChecked >= HISTORY_MS) {
            historyChecked = Date.now();
            const tree = Tree.open(root, env);
            const settings = new Settings(env, {});
            const rev = historyShown(tree, settings) ? historyRevNow(tree, settings, h, historyRev(tree, settings.shared()?.value, settings)) : undefined;
            // (a commit made since the head was read changes the rev too: its change says it, never a history of its own)
            if (rev && historySeen && historySeen.head === h && historySeen.rev !== rev && tip(root).head === h) send("history", { rev });
            historySeen = rev ? { rev, head: h } : undefined;
          }
          // what GET /quality answers changed (the person marked a finding no error, or took it back): the event quality {rev}
          // (never while the research is being written: the file before its commit would be told with the head before it)
          if (!liveHolder(path.join(root, ".strom", "tree.lock"))) {
            const q = qualityRev({ root }, h || "0000000");
            if (qualitySeen !== undefined && q.slice(8) !== qualitySeen.slice(8)) send("quality", { rev: q });
            qualitySeen = q;
          }
          const now = atWork(h);
          const w = JSON.stringify(now);
          if (w !== workers) {
            workers = w;
            send("working", now);
          }
        });
      }, pollMs);
      const keepAlive = setInterval(() => {
        for (const s of streams) s.write(": still here\n\n");
      }, 20_000);
      // asked to end (strom live stop, a newer bridge wanted): the same on every system — a signal on Windows ends the
      // process unheard, and the app following it would learn the end only when it gives up asking
      // — never in the middle of writing what the app sent (cut short, a send would be half taken, an original sent again):
      // taken once it is written, and meanwhile said to the one asking (live-busy.json), which waits a while
      let stopWaits = false;
      const stopAsked = setInterval(() => {
        const ask = readStopAsk(root);
        if (ask?.pid !== process.pid) {
          if (stopWaits) safe("the stop's wait", () => fs.rmSync(liveBusyFile(root), { force: true }));
          stopWaits = false;
          return;
        }
        if (writesNow()) {
          if (!stopWaits) noteLive(root, `asked to end (${ask.why}) while something the app sent is written: ends once it is written`);
          stopWaits = true;
          safe("the stop's wait", () => {
            fs.writeFileSync(`${liveBusyFile(root)}.${process.pid}`, JSON.stringify({ pid: process.pid, at: Date.now() }));
            fs.renameSync(`${liveBusyFile(root)}.${process.pid}`, liveBusyFile(root));
          });
          return;
        }
        fs.rmSync(liveStopFile(root), { force: true });
        stop(ask.why, ask.back ? "restart" : "stopped", ask.back ?? false, ask.by);
      }, Number(env.STROM_LIVE_STOP_MS ?? 200));
      // the end said to the app on its streams before they close: whether another bridge comes at this address (it goes
      // on following) or none (following ends now); a signal from outside: not known (the app asks /status)
      const stop = (why: string, reason: EndKind = "stopped", back?: boolean, by?: "app") => {
        // the bridge of the newer strom on disk asked to take over: handed over to it (live.json left for it to write
        // over in a moment, as the bridge before the hand-over left it)
        const handed = !!handing && reason === "restart";
        if (handed) noteLive(root, `handed over to the bridge of strom ${handing!.version} (${handing!.pid ?? "?"})`);
        handing = undefined;
        over = true;
        clearInterval(timer);
        clearInterval(keepAlive);
        clearInterval(stopAsked);
        // what a thread makes for the app is wanted no more
        widgetEnds = true;
        endWork();
        keeper.end();
        inbox.end();
        // the queue's files wait for the next bridge; the warm writer ends once what it writes is written
        media.end();
        writer.end();
        if (stopWaits) safe("the stop's wait", () => fs.rmSync(liveBusyFile(root), { force: true }));
        safe("the widget", () => widget?.end(reason === "gone"));
        send("end", { reason, ...(back === undefined ? {} : { back }), ...(by ? { by } : {}), at: new Date().toISOString() });
        for (const s of streams) s.end();
        server.close();
        // its claim given up (one it handed over to holds it already), its note removed — never another bridge's
        dropOwner(root);
        if (!handed) {
          withLiveOwner(root, () => {
            try {
              const now = JSON.parse(fs.readFileSync(liveFile(root), "utf8")) as LiveInfo;
              if (now.pid === process.pid) fs.rmSync(liveFile(root), { force: true });
            } catch {
              // gone already
            }
          });
        }
        const was = readLast(root);
        if (was?.pid === process.pid && !was.ended) writeLast(root, { ...was, ended: { at: new Date().toISOString(), reason: why, kind: reason } });
        noteLive(root, `ended: ${why}`);
        resolve(undefined);
      };
      process.once("SIGTERM", () => stop("SIGTERM", "signal"));
      process.once("SIGINT", () => stop("SIGINT", "signal"));
    });
  });
}

/** /status `browser`: the agent's browser here and the tree's archives only a person's browser goes to. */
function browserStatus(tree: Tree, env: Env, agent: string | undefined, shared: string | undefined): Record<string, unknown> {
  const s = browserState(env, agent, tree.root);
  return {
    state: s.state,
    ...(s.url ? { url: s.url } : {}),
    archives: treeBrowserArchives(tree, shared).map((a) => ({ host: a.host, ...(a.title ? { title: a.title } : {}), permitted: a.permitted })),
  };
}
