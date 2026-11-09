<a id="R14"></a>
# R14 Siegel und Unversehrtheit der Forschung

Jede Änderung einer Forschung schreibt strom als Operation in die Protokolle ihrer Geschichte (`data/ops`) und
versiegelt sie mit dem Schlüssel dieses Computers, zusammen mit einem Commit in der Geschichte der Forschung (git).
`strom verify` vergleicht jeden Eintrag und jeden Commit mit seinem Siegel und sagt, was außerhalb von strom geändert
wurde. Das Kapitel beschreibt, welche Wege weiter strom anbietet, und ausführlich das Annehmen einer Forschung, wie sie
ist (`strom seal accept`). Beschrieben wird die Forschung 1.30.1.

<!-- zdroj: research:39c56a89 strom help verify („seal check of every record and commit“), strom help repair, strom help seal adopt, strom help seal accept · src/core/accept.ts (záhlaví) · src/core/tree.ts commit (commitSeal klíčem tohoto počítače), requireKey · CHANGELOG.cs.md 1.30.1 · dirigent:spec/072-prijmout-stav/spec.md -->

<a id="R14.1"></a>
## R14.1 Was nicht zu seinem Siegel passt, und die Wege weiter

Was `strom verify` findet, bestimmt, welcher Weg weiterführt. Jeden startet ein Mensch in seinem eigenen Terminal.

| Was geschah | Weg | Was er tut |
|---|---|---|
| ein Eintrag außerhalb von strom geändert oder angelegt, die Geschichte (git) ist lesbar | `strom repair` | stellt den letzten versiegelten Stand her: geänderte Einträge werden wiederhergestellt, außerhalb von strom angelegte entfernt; Kopien alles Ersetzten bleiben in `.strom/quarantine/` |
| eine auf einem anderen Computer versiegelte Forschung | `strom seal adopt` | prüft die Kette der Operationen und den Hash jedes Eintrags und legt für die Forschung den Schlüssel dieses Computers an |
| eine verlorene Geschichte: die ältesten Protokolle von `data/ops` fehlen und die Geschichte (git) ist nicht lesbar oder fehlt; die Einträge sind, wie strom sie schrieb | `strom seal accept` | stellt nichts her und übernimmt nichts: versiegelt die Forschung, wie sie jetzt ist, als neue Grundlage ([R14.2](#R14.2)) |

- **Prüft der Code:**
  - bei lesbarer Geschichte (git) verweist strom nicht auf `strom seal accept`: `strom repair` holt die verlorenen
    Protokolle aus ihr zurück;
  - bei beschädigter oder fehlender Geschichte melden `strom verify` und `strom check` den Befund `git-damaged` (die
    Geschichte ist nicht lesbar, Objekte fehlen, oder die Forschung hat keine Geschichte) und raten bei jeder Datei,
    die nicht zu ihrem Siegel passt: „die Geschichte (git) ist beschädigt, strom repair stellt sie nicht wieder her –
    nach Durchsicht der Einträge in einem eigenen Terminal: strom seal accept“;
  - ein Schreiben in eine Forschung mit beschädigter Geschichte lehnt strom mit „die Geschichte (git) der Forschung
    ist beschädigt: nichts geschrieben“ (Code `tree.git-damaged`) und demselben Rat ab, statt mit dem Fehler von git.
    Früher blieb daran jedes Schreiben und `strom check` stehen.
- **Bedienung:** Terminal: `strom verify`, `strom check`, `strom repair`, `strom seal adopt`, `strom seal accept`.
- **Gilt seit:** Forschung 1.30.1

<!-- zdroj: research:39c56a89 src/core/accept.ts ACCEPT_HINT, acceptWay (jen bez .git nebo s git.damaged; čitelná historie → nic, strom repair vrátí logy), GIT_DAMAGED, guardOrDamaged · src/commands/checks.ts check a verify (acceptWay nad verifyFull) · src/core/integrity.ts assertIntact, gitDamagedError (tree.git-damaged) · de.json ui.check.accept.hint, ui.error.tree.git-damaged(.hint) · strom help repair, strom help seal adopt · CHANGELOG.de.md 1.30.1 -->

<a id="R14.2"></a>
## R14.2 Die Forschung annehmen, wie sie ist: `strom seal accept`

Ein Cloud-Laufwerk (etwa iCloud Drive) kann einer Forschung die ältesten Protokolle der Geschichte (`data/ops`) und
Objekte ihrer Geschichte (git) nehmen. Die Einträge bleiben, wie strom sie schrieb, aber `strom verify` meldet sie als
außerhalb von strom angelegt oder geändert, und `strom repair` hat nichts zurückzugeben oder gäbe einen älteren Stand
zurück. `strom seal accept` nimmt die Forschung, wie sie jetzt ist, als neue versiegelte Grundlage. Darüber entscheidet
ein Mensch, der die Einträge vorher durchgesehen hat.

- **Zuerst die Zahlen:** ohne Bestätigung ändert der Befehl nichts. Er listet auf, was das Annehmen täte:
  - Einträge ohne Geschichte;
  - Einträge neuer als der Rest ihrer Geschichte;
  - weitere Dateien der Forschung (Geschichte, Qualität, `strom.json`), die nicht zu ihrem Siegel passen;
  - wie viele Protokolle der Geschichte im Ordner sind;
  - den Zustand der Geschichte (git): **lesbar** (die Änderung kommt hinzu), **ihre letzte Änderung nicht von strom**
    (neu versiegelt), **beschädigt** (ganz beiseitegelegt, nichts gelöscht, eine neue begonnen), **keine** (eine neue
    begonnen);
  - die iCloud-Kopien von Dateien, die beiseitegelegt werden, und die, die an ihrem Ort bleiben
    ([R14.2.1](#R14.2.1)).
- **Bestätigung:** ein Mensch beantwortet im eigenen Terminal **Die Forschung so annehmen, wie sie jetzt ist?**. Die
  vorgegebene Antwort ist Nein.
- **Der Unterschied:** `strom repair` stellt den letzten versiegelten Stand her, `strom seal adopt` übernimmt eine auf
  einem anderen Computer versiegelte Forschung; `strom seal accept` stellt nichts her und übernimmt nichts
  ([R14.1](#R14.1)).
- **Bedienung:** Terminal: `strom seal accept --preview` (nur die Zahlen, darf auch ein Agent), `strom seal accept`.
  Geht auch im Strom-Archiv.
- **Gilt seit:** Forschung 1.30.1

<!-- zdroj: research:39c56a89 src/commands/checks.ts seal accept (planAccept → acceptSaid; preview nebo neinteraktivně jen počty, exit 4; confirm(ui.accept.ask, false)) · src/core/accept.ts AcceptPlan (unsealed, edited, other, logs, git ok|unsealed|damaged|missing, moveAside, copies) · de.json ui.accept.title, unsealed, edited, other, logs, git.*, aside, copies, does, ask · src/cli/help.ts ARCHIVE_COMMANDS „seal accept“ · CHANGELOG.de.md 1.30.1 -->

<a id="R14.2.1"></a>
### R14.2.1 Was das Annehmen tut

Nach der Bestätigung nennt eine versiegelte Änderung jede Datei, die nicht zu ihrem Siegel passt, wie sie jetzt ist:
kein Eintrag geändert, nichts gelöscht.

- **Prüft der Code:**
  - eine signierte Operation (`seal.accept`) trägt den Hash jeder solchen Datei, und strom hält sie in einem
    versiegelten Commit fest;
  - eine beschädigte Geschichte (git) wird ganz in den Ordner `.git-damaged-<wann>` neben der Forschung beiseitegelegt
    und eine neue begonnen; der Ordner mit der alten Geschichte gehört nicht zur neuen. Ohne Geschichte wird eine neue
    begonnen, eine lesbare Geschichte bekommt nur die Änderung hinzu;
  - iCloud-Kopien von Dateien (etwa „P0001 2.json“) in den Ordnern `data/`, `history/` und `quality/` sowie Kopien von
    Sperren in `.strom/` kommen nach `.strom/accepted-<wann>/`; als Einträge werden sie nie versiegelt. Kopien an
    anderer Stelle der Forschung (neben `strom.json`, in `.strom/`, in `output/`) werden nur aufgelistet und bleiben,
    wo sie sind;
  - am Ende läuft die volle Prüfung erneut: „strom verify: in Ordnung – jeder Eintrag passt zu seinem Siegel“, oder wie
    viele Probleme bleiben („strom verify findet noch Probleme: N“);
  - ein zweiter Lauf tut nichts: „nichts anzunehmen – jeder Eintrag passt zu seinem Siegel“.
- **Gilt seit:** Forschung 1.30.1

<!-- zdroj: research:39c56a89 src/core/accept.ts applyAccept (appendOp seal.accept files[path, sha], targets []; tree.commit; .git-damaged-<stamp>, git.initRepo, .git/info/exclude /.git-damaged-*/; .strom/accepted-<stamp>), cloudCopies (SEALED_DIRS data, history, quality; kopie zámků v .strom; kořen, .strom, output jen vypsat), isCloudCopy, nothingToAccept · src/commands/checks.ts (po přijetí verifyFull) · de.json ui.accept.does, done, gitmoved, copiesmoved, verified, still, nothing -->

<a id="R14.2.2"></a>
### R14.2.2 Was das Annehmen hütet und nie regelt

- **Prüft der Code:**
  - eine Forschung nimmt nur ein Mensch im eigenen interaktiven Terminal an, über dasselbe Tor wie
    `strom seal adopt`; `--yes` nimmt sie nie an („--yes nimmt die Forschung nie an: ein Mensch entscheidet im eigenen
    Terminal“). Außerhalb eines interaktiven Terminals listet der Befehl nur die Zahlen und den Satz „Über das Annehmen
    der Forschung entscheidet nur ein Mensch im eigenen Terminal – strom seal accept“;
  - ein Agent darf nur `--preview`; das Annehmen selbst lehnt strom einem Agenten ab, und der Agent nennt dem Menschen
    den Befehl;
  - nichts wird angenommen, solange die Brücke zur Strom-App auf der Forschung läuft (`strom live stop`, dann erneut)
    oder an ihr gearbeitet wird (`strom session finish`, dann erneut);
  - nach der Bestätigung macht strom den Plan unter der Sperre der Forschung neu; hat sich die Forschung seit der
    Durchsicht geändert, wird nichts angenommen („die Forschung hat sich seit der Durchsicht geändert: nichts
    angenommen“);
  - eine auf einem anderen Computer versiegelte Forschung wird zuerst übernommen (`strom seal adopt`);
  - andere Befunde der Prüfung regelt das Annehmen nie: ein umgeschriebenes Protokoll, eine gefälschte Operation,
    einen anderen Schlüssel, Dateien nur in der Cloud, einen gelöschten Eintrag oder eine Datei in `data/`, die kein
    für strom lesbarer Eintrag ist. Mit einem solchen Befund wird nichts angenommen („Nicht angenommen: die Prüfung
    findet, was das Annehmen nie regelt“), und den Weg sagt `strom verify`.
- **Gilt seit:** Forschung 1.30.1

<!-- zdroj: research:39c56a89 src/commands/checks.ts seal accept (agentMay jen --preview; ctx.yes → accept.yes; requireHuman jako seal adopt; liveRunning → accept.bridge; liveWorkers/runsAtWork → accept.busy; tree.requireKey) · src/core/accept.ts SETTLED (unsealed, manual-edit, history-edited, quality-edited, config-edited, foreign-commit), planAccept refused (jiné kódy; recordReadable), applyAccept samePlan → accept.changed · src/cli/help.ts HUMAN_COMMANDS · de.json ui.accept.person, refused, ui.error.accept.* · strom help seal accept -->
