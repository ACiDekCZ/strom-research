# strom plugins

Plugins extend strom on this computer: one folder per kind of plugin, and in
it one folder per plugin. The folder's name is the plugin's name.

    plugins/
      connectors/              downloaders for archive portals
        README.md              their interface (version 1)
        example-archive/       one connector: connector.json and its program

**Install** a plugin by copying its folder in: `strom connector list` shows it
and it can run at once, paced by strom and only to the hosts it names. To be
asked before any plugin runs: `strom config set connectors.consent on`. A
plugin whose code goes round strom always needs your yes, in your terminal
(`strom allow connector <name>`).

**Build** one with your agent: `strom connector new <name> --url <portal>`.

**Remove** one by deleting its folder (or `strom connector remove <name>`).

Plugins are programs on this computer, put here by you: the `.gitignore` here
keeps them out of any repository. strom writes this file, the `.gitignore` and
`connectors/README.md`, and keeps them up to date.
