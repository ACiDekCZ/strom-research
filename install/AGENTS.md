# Strom Research — for AI agents

The user wants to research their family history with you, using strom: a
program that makes you a careful genealogical researcher (parish registers,
archives, evidence, a family tree for the Strom app). Talk to the user in
their language.

1. Check whether strom is installed: run `strom --version`. strom and the
   research live on the computer where it is installed. If you work on a
   computer of your own (a cloud machine or server, not the user's), tell the
   user before you install it: the research would be kept there, not on their
   computer, and the Strom app on their computer could not open it. Install it
   where they want it.
2. If it is not, ask the user for permission to install it. The installer is
   a short script — read it before you run it: it downloads the program for
   this computer from the project's GitHub release, checks it against the
   release's SHASUMS256.txt, puts it into the user's own folder (no admin
   rights) and adds that folder to PATH. Source:
   https://github.com/ACiDekCZ/strom-research/tree/main/install
   - Windows (PowerShell):
     `Invoke-WebRequest -UseBasicParsing https://raw.githubusercontent.com/ACiDekCZ/strom-research/main/install/install.ps1 -OutFile "$env:TEMP\strom-install.ps1"`,
     read the file, then
     `Get-Content -Raw -Encoding UTF8 "$env:TEMP\strom-install.ps1" | iex`
     (read as UTF-8: Windows PowerShell 5.1 would take the file in another code page)
   - macOS, Linux:
     `curl -fsSL https://raw.githubusercontent.com/ACiDekCZ/strom-research/main/install/install.sh -o /tmp/strom-install.sh`,
     read the file, then `sh /tmp/strom-install.sh`
   If your own safety checks stop a step, do not work around them: show the
   user the command, say what it does, and let them allow it or run it
   themselves in a terminal. (People use the one-line forms:
   `irm https://raw.githubusercontent.com/ACiDekCZ/strom-research/main/install/install.ps1 | iex` on Windows, `curl -fsSL https://raw.githubusercontent.com/ACiDekCZ/strom-research/main/install/install.sh | sh`
   elsewhere.) The installer prints the full path of strom; use that path
   until a new terminal has it on PATH.
3. Run `strom`. It says where things stand and what to do next — follow it.
   Not set up yet: ask the user where to keep the research (suggest the
   default it names) and which language they want, then run the setup
   command it gives you. `strom guide` explains the whole work.
4. Do the research through strom, the way it says — that is what makes it
   right:
   - Start it as `strom` tells you (a research for the person, then
     `strom session start`: the brief of your task); finish each session with
     `strom session close`.
   - Look for records through strom: its catalogue, its downloaders for the
     archives (an archive without one: build it, `strom connector new`), and
     `strom media view` to read an image it fetched.
   - A find is told to the user only once it is recorded: the record as a
     source with your transcript (`strom source add`), the facts citing it.
     Tell it from strom — `strom person card "<name>"` — with the book, the
     page and how sure it is. What you saw without strom (on a web page, from
     memory) is not a find until it is recorded; say that it is unverified.
     Never make up a record, a name or a detail you could not read.
   - Change the research ONLY through `strom` commands, never by editing its
     files. `strom check` says whether it is consistent.
   Ask the user before decisions: whom to research, what they know, anything
   that needs their permission. When strom opens a window asking for consent,
   tell the user to answer it — you cannot.
5. Next time the user can simply ask you to continue the research, or run
   `strom` in a terminal (or the "Strom research" shortcut on the desktop).
   To remove strom again: `strom uninstall` (the research stays).

Source code and license (MPL-2.0): https://github.com/ACiDekCZ/strom-research
