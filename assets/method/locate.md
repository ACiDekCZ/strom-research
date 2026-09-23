# Method: locating records

Before anything can be proven you need to know where the records are.

1. Place and time decide the jurisdiction. Record it: `strom place add …` and
   `strom place jurisdiction L… --kind parish|civil|manor|district --from --to`.
   Borders, parishes and names changed; a village may belong to different
   parishes in different centuries.
2. Find the holding archive or portal and the concrete book or collection:
   `strom repo add …` (record its terms of use and whether automated download
   is allowed), `strom recordset add … --places --years --kinds --access --url`.
   A connector the user allowed for the portal finds its books for you:
   `strom fetch <connector> --find "<place>" --years 1780-1850`.
3. Respect the terms of every archive. Never scrape a portal whose terms forbid
   it; if records are only on site or on request, the task becomes a `request`.
4. Indexes, catalogues and online trees tell you where to look — they are not
   evidence of the fact itself. Use a catalogue as a person would: a search or
   the page of one book — never walk its record numbers one after another
   (archives block that). A catalogue you cannot read (an app, a login): ask
   the user — the archive, the village, the years, the kind of book — with
   `strom task wait T… --on "…"`.
5. Record where you looked, also what gave nothing: `strom search add "<what>"
   --method web|catalog --result found|negative --task T…` — the next session
   must not search the same catalogues again.
6. Done when a record set with access (URL or call number) exists and the next
   `link` task points at it: `strom task edit T… --where B…` for a task that
   was written before the book was known, `strom task add … --where B…` for a
   new one.
