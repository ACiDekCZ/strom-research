# Method: the tree check

A tree check reads the research and proposes; it never changes it. Each
finding is a proposal the user accepts (it becomes a task of the queue, done
later by the research's usual commands) or dismisses (never reported again).

## Rules

- **Read only.** No command that writes the tree: no person, family, event,
  source, place, task, story, hypothesis or conflict is added, edited, retracted
  or merged in this session. The only writes are `strom audit add`, `strom audit
  checked`, `strom audit summary` and `strom audit order`. What looks wrong is a
  finding, never a fix.
- **Every finding with its proof.** `--proof` names each record that shows it,
  with what that record says word for word (`--proof S0012:"bapt. 3. 4. 1801"`,
  `--proof P0004:"story: born in Lhota"`). No proof that a reader can check in
  the data → no finding.
- **The user's values and the family tree's are only proposed** (`--suggest-only`):
  a value the user wrote or confirmed, or one imported from a family tree, is
  never the thing to change — the finding says what the research found against it.
- **At most 30 findings a run**, every check together. Weigh them: the ones
  that block the research or grow the tree most first. Give each check asked a
  share; G (where to search next) and A (stories) first.
- **One finding, one problem.** `--code` names the kind of problem in a word or
  a few joined by `-` (`story-no-facts`, `place-two-spellings`,
  `parish-wrong`): with the check and the records it makes the finding's id,
  the same in every run. The same problem of other records is another finding.
- **A dismissed finding is never reported again**: its id is refused
  (`audit.dismissed`); the brief names those of the records in scope. An
  accepted one already has its task (`audit.accepted`).
- `--what` and `--fix`: one sentence each, in the research's language, plain
  words for the user — what is wrong, and what setting it right takes (it is the
  task's done-when once accepted). `--minutes` what an agent would take for it.
- Each check gone through: `strom audit checked <type>` — also when it found
  nothing. At the end: `strom audit summary "…"` (a sentence: how the tree
  stands), the steps of what to do next in order with why (`strom audit order
  <kind>[:<subject>] --why "…"`, at most 10; the built-in steps of the brief are
  the ones to order, a finding's id may be one), then close the task done.

## The checks

- **A. Stories and notes against the facts**: a story that rests on no fact, a
  story or note that says what the facts contradict (another year, place,
  spouse), a note promising what is not there.
- **B. Decided by the data**: an open hypothesis or conflict the data already
  decides (say which records decide it); a task waiting whose aim is met elsewhere.
- **C. Left unfinished**: records of a transfer or an import still marked taken
  over, files of `inputs/` with parts not gone through, notes naming IDs that do
  not exist.
- **D. Places**: one place written differently, a place in another parish or
  estate than its records.
- **E. Possible duplicates** the validation does not see (name variants, Latin or
  German forms) — `strom person compare` for each pair before a finding.
- **F. A fact whose record speaks of another person or year** by its transcript
  (no image: comparing with the image is verification, not this check).
- **G. Where to search next**: at the ends of the branches and the lines that
  stand still, the concrete source for the place and time — a register, parish,
  archive, census, land register — from the places' jurisdictions, the books
  (`strom recordset list`), the lessons, the searches done and the archives strom
  knows. What the research does not know (no register known for a place) is
  said so, and finding it out is the fix.
- **H. Sources**: a fact with no source, a citation without a page or an image,
  a source of another parish than the place of its event.
- **I. Names in the family**: one name or surname written unevenly (variants,
  feminine forms, a description for a name) — only proposed (`--suggest-only`).
- **J. Families and gaps**: an unusual gap between the baptisms of the children
  (a child to look for), two siblings of one name with no death of the elder,
  a marriage after the children's births with no legitimation.
- **K. Life and time in the texts**: what only the texts say — a witness or
  godparent after their death, a residence in a transcript against the facts.
- **L. Houses**: a person in a house with no source, a house with no position,
  residents of a house overlapping in an impossible time.

## Reading the tree

Read through strom alone: `strom person show P…`, `strom family show F…`,
`strom source show S…`, `strom story show P…`, `strom find …`, `strom edge`,
`strom check`, `strom recordset list`, `strom lesson list`, `strom search list`,
`strom place show L…`, `strom house show H…`. A large scope: line by line,
person by person, the oldest generations first; the brief gives the people of
the scope (only what changed, with --changed).
