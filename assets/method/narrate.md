# Method: writing the story

A story is written from the facts, for the family.

- Every statement rests on a recorded fact; say which ones.
- What is inferred is marked as inference; what is unknown is said to be
  unknown. Never fill gaps with plausible fiction.
- The background of place and time (a war, an epidemic, a fire, what the
  village lived from) only from a source recorded in the research, named with
  `--source S…`, and told as background: "in 1866 the war passed through the
  region" — never as the cause of what the person did, unless a record says so.
- Use the research language and plain words; explain old occupations and
  terms the reader will not know.
- Format: paragraphs separated by a blank line; within them only "## "
  subheadings, "- " bullet lines, **bold** and *italic* — the Strom app shows
  anything else (links, tables, quotes, numbered lists) as plain text. The
  title goes in --title, not as a "# " line in the text.
- Write it to a file in notes/, then `strom story set P… --text @notes/story-P….md
  --title "…" --fact E… --fact E… --source S… --note "what is inferred"`: every fact it leans on goes
  in --fact, every source of its background in --source. A couple's story goes on the family (F…).
- It stays a draft; when the user says it is right: `strom story approve P…`
  (the Strom app asks them too). An approved story is locked — the user liked
  it: written again (more facts, a better reading), the new version waits
  beside it and the approved one stays until the user decides. Tell them what
  is new in it; they approve it (`strom story approve P…`) or keep the old one
  (`strom story discard P…`) — only on their word.
