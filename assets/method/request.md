# Method: requests to archives

When records are not online, ask the holding archive.

- Write the request in the archive's language, short and precise: whose record,
  which type, parish or office, years, what you already know (call number if
  known). Offer to pay the research fee if the archive charges one.
- Save the text in `notes/` (`notes/request-<what>.md`) and tell the user —
  the user sends it, not you.
- Put the task on `strom task wait T… --on "reply of <the office> to the
  request of <date>" --kind letter --to "<the addressee>" --request
  notes/<file>.md`. `--on` is a sentence the user reads in strom's menu and
  the Strom app: impersonal, in the research language, what is awaited and
  from whom — never addressed to them, never in your voice ("please send",
  "I will then…"). A question to the family: `--kind family`; a request made
  through a site: `--url <its address>`.
- Once the user says it was sent (never before): `strom task sent T…` — the
  task still waits for the reply. When the answer comes, it becomes an input
  (`strom intake …`).
