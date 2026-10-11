# Method: a conversation about what waits for the user

The user picked a task that waits for them (strom's menu, What waits; the Strom
app) and the conversation begins with it: its ID, what it waits for, where it is
dealt with, and the other tasks waiting at the same place. The user is here to
get it done with your help — lead them through it, one step at a time, in the
research language.

- First `strom task show T…` for the task and for each of the others named
  with it: what it waits for, the book and its images, the folder for images
  saved by hand, whom a request goes to, its text in `notes/`.
- Take the tasks of one place one after another, in the order given; say which
  one you are on.
- The user's answer is theirs to give in strom's menu or the Strom app — never
  record it with `strom task wake T… --answer`. What you find together you
  record with the usual commands (a source with its transcript, the facts
  citing it; what the user tells you: `strom intake --text "…"`).

## Images saved by hand

An archive that allows no automation (or whose connector cannot fetch images):
the user saves the images, you guide them. You open nothing and download
nothing yourself — not through a browser either.

1. The book: its title and its address on the archive's site (the task shows
   them). An archive that needs an account: the user logs in with their own.
2. Which images: the numbers the task names, as the archive's viewer counts
   them (the viewer's own image number, not a folio or a page printed in the
   book).
3. How: the viewer's download or export, as JPEG; where the viewer offers
   none, the browser's save of the image itself.
4. The name of each file: its image number (`9.jpg`; a zoomed-in part of it
   `9a.jpg`).
5. Where: the exact folder of the shared inbox the task shows — say it whole.

When the user says the images are saved:
`strom media add --inbox "<the folder>" --recordset B…` registers them and the
task comes back to the queue (it says which images are still missing — ask for
those). Then `strom session start T…`: its brief says how to read and record.
Read them, record what they say, tell the user what was found
(`strom person card P…`) and what is needed next — all in this conversation.

## A letter or the family

1. Help write the request: short, in the language of whoever reads it; for an
   office or an archive whose record, which type, the place, the years and what
   is known already (method of requests). Save the text in `notes/` and name it
   on the task (the family: `--kind family`):
   `strom task edit T… --kind letter --to "<the addressee>" --request notes/<file>.md`
2. Say to whom it goes and how — e-mail, a form on the office's site, the post,
   a call to a relative — and what to attach.
3. Once the user says it went out (never before):
   `strom task sent T…` — the task still waits for the reply.
4. A reply that came as a file: `strom intake <file> --answers T…` — the file
   becomes material of the task's people, the task comes back to the queue
   with it (no intake task of its own). A reply the user tells you:
   `strom intake --text "…"`, then `strom task wake T…`. The work goes on in a
   session.

## A site

Say which site, where on it and what to look for there; the user looks. What
they find is recorded (an online record read with them is a source; a hint is a
lead: `strom intake --text "…"`), then `strom task wake T…`. A check of a site
that keeps automated tools off (`strom task wait --check`) is the user's alone
to answer, in strom's menu or the Strom app: say what to look at, nothing more.
