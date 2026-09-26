# strom hooks — interface 1

A hook is a program of yours that strom tells what was saved into a research:
a person added to the family tree, a fact found, a task done, a session
closed. What it does with it is up to you — a message to your phone, a line
in a log, a backup. strom starts it in the background after each save and
never waits for it: a hook that is slow or fails never holds up or breaks the
research.

    plugins/hooks/
      README.md                this interface
      my-hook/                 one hook: hook.json and its program
        hook.log               what it printed (strom keeps it)

**Turn one on**: `strom hook on <name>` — only you (an agent asks you in a
window of the system). A folder alone does nothing: an agent may build a hook
for you, but it runs only once you turn it on. `strom hook off <name>`,
`strom hook list`. **Try it**: `strom hook test <name>` runs it now on the last
operations saved in the research you are in, waits and shows what it printed
(`--op person.add --target P0001`: one operation you name).

## hook.json

    {
      "interface": 1,
      "title": "My phone",
      "command": ["node", "hook.ts"],
      "events": ["person.add", "family.child", "session.close"]
    }

- `command`: the program and its arguments, run in the hook's folder. `node`
  is strom's own Node (TypeScript runs as it is) — best on every system.
- `events`: the operations it wants — one (`person.add`), a kind
  (`person.*`) or all (`*`, the default). Saves with none of them do not start
  it.
- `timeout`: seconds `strom hook test` waits for it (default 60).

## What it gets

One JSON document on stdin (also in the file `STROM_EVENT_FILE`): one save
into one research, with the operations it saved that the hook wants.

    {
      "interface": 1,
      "hook": "my-hook",
      "tree": { "name": "Novákovi", "id": "…", "root": "/…/Novákovi", "lang": "en" },
      "commit": "3f2a9c1…",
      "at": "2026-10-02T14:03:11.000Z",
      "events": [
        { "op": "person.add", "targets": ["P0012"], "summary": "+P0012 Josef /Novák/ · E0031 BIRT 1851 …",
          "at": "2026-10-02T14:03:10.412Z", "by": "N0007" }
      ]
    }

- `op`: what was done — `person.add` (a person in the family tree),
  `family.add`, `family.child` (a child linked to parents), `event.add` (a
  fact: birth, marriage, death…), `event.edit`, `person.merge`, `source.add`
  (a record read), `media.add` (a scan), `task.add`, `task.done`, `task.wait`
  (waiting for you), `story.set`, `session.start`, `session.close`… — the same
  names as the research's history.
- `targets`: the records it concerns — read more of them through strom, as
  the user would: `strom person card P0012`, `strom person show P0012 --json`,
  `strom session show N0007`.
- `by`: the session that saved it (N0007), or `user`.
- `tree`: which research. A hook you turn on hears from all your researches;
  to hear from some only, let it skip the others by `tree.name` or `tree.id`
  (e.g. a list in a config file of its own).

Environment variables, besides the user's own: `STROM_HOOK` (its name),
`STROM_TREE` (the research's folder — run strom there), `STROM_LANG` (the
research language), `STROM_EVENT_FILE`. What the hook itself writes through
strom tells no hook again.

## An example: a message to your phone (Telegram)

    // hook.ts — the bot's token and your chat's id in config.json beside it
    import fs from "node:fs";
    import { execFileSync } from "node:child_process";
    const cfg = JSON.parse(fs.readFileSync("config.json", "utf8"));
    const save = JSON.parse(fs.readFileSync(0, "utf8"));
    for (const e of save.events.filter((e) => e.op === "person.add")) {
      const card = execFileSync("strom", ["person", "card", e.targets[0]], { cwd: save.tree.root, encoding: "utf8" });
      await fetch(`https://api.telegram.org/bot${cfg.token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: cfg.chat, text: `${save.tree.name}: a new person\n\n${card}` }),
      });
    }

Keep secrets such as a token in the hook's own folder: the `.gitignore` of the
plugins folder keeps every plugin out of any repository.
