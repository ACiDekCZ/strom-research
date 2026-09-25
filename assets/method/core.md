# Method: the core

You work to the Genealogical Proof Standard: search thoroughly, cite every
fact, analyse and correlate the evidence, resolve conflicts, and write the
conclusion so the next researcher can follow it.

- **Certainty is explicit.** `proven` — you read the original record yourself
  and it states the fact directly. `probable` — good evidence, but indirect or a
  single reading of hard handwriting. `possible` — weak evidence. `lead` — a
  family story, a family tree, an index or a guess: something to check, never a
  fact. Family trees and memories are leads, always.
- **A namesake is not your person.** Identify by year, place, house, occupation,
  spouse and parents — the mother's maiden name decides most cases. Two entries
  that give one name different parents (another mother) are **two people** —
  even in the same house, with the same father's name. Never explain the
  difference away as a clerk's error, never decide by majority. Your person is
  who the entry about your person's own family names; the others are separate
  persons, and "the same woman?" is a hypothesis (`strom hypothesis add`) with
  what would decide it.
- **Negative results are results.** Every search is recorded (`strom search add
  … --result negative`), with exactly what was covered. The most expensive
  mistake is to search the same book twice.
- **Check the premise first.** Before opening anything: `strom searched <where>`.
- **Extract everything the first time** you open a record: names, ages, house
  numbers, occupations, godparents, witnesses, midwife, remarks in the margin.
  Opening the same page again later costs more than writing it down now.
- **Nothing is deleted.** A wrong fact is retracted with a reason; a changed
  fact is edited with a reason. Contradictions become conflicts, competing
  explanations become hypotheses — never silently pick one.
- **Write as you go.** Record each finding as soon as you have it. Your context
  can be cut or summarised at any moment, and a session working alone is
  stopped at its time limit (the brief says when; near the end strom's output
  counts down): what is only in the conversation is lost, what is in strom is
  not. Going through many images, record each stretch when it is done (every
  ten images, each district or year): the finds, and `strom search add …
  --pages` for what was searched in vain — never all of it at the end.
- **Lessons belong where they apply.** A quirk of a register (its calibration,
  two years per page, a hand that writes 7 like 1) goes to `strom lesson add
  --on B…`, so whoever opens that book next sees it.
- **Stay within the task.** New questions become new tasks (`strom task add`,
  with where and done-when), not detours. A new task whose images are not here
  gets them now: through the archive's connector (built first when it has
  none), or — where the archive allows only that — it waits at once for what
  the user should download (`strom task wait T… --images B…:<numbers> --on
  "…"`); a later session would only find that out.
- **Hand over cleanly.** Close with a summary of what was proven, what was
  searched in vain, and the next cheapest step.
