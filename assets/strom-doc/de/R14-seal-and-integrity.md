<a id="R14"></a>
# R14 Siegel und Unversehrtheit der Forschung

Jede Änderung einer Forschung schreibt strom als Operation in die Protokolle ihrer Geschichte (`data/ops`) und
versiegelt sie mit dem Schlüssel dieses Computers, zusammen mit einem Commit in der Geschichte der Forschung (git).
`strom verify` vergleicht jeden Eintrag und jeden Commit mit seinem Siegel und sagt, was außerhalb von strom geändert
wurde. Das Kapitel beschreibt, welche Wege weiter strom anbietet, und ausführlich das Annehmen einer Forschung, wie sie
ist (`strom seal accept`), eine Geschichte, die älter ist als die Forschung, und das Rückgängigmachen einer Reparatur
(`strom repair undo`). Beschrieben wird die Forschung 1.30.1; Änderungen aus einer neueren Version tragen ihre Nummer.

<!-- zdroj: research:39c56a89 strom help verify („seal check of every record and commit“), strom help repair, strom help seal adopt, strom help seal accept · src/core/accept.ts (záhlaví) · src/core/tree.ts commit (commitSeal klíčem tohoto počítače), requireKey · CHANGELOG.cs.md 1.30.1 · dirigent:spec/072-prijmout-stav/spec.md -->

<a id="R14.1"></a>
## R14.1 Was nicht zu seinem Siegel passt, und die Wege weiter

Was `strom verify` findet, bestimmt, welcher Weg weiterführt. Jeden startet ein Mensch in seinem eigenen Terminal.

| Was geschah | Weg | Was er tut |
|---|---|---|
| ein Eintrag außerhalb von strom geändert oder angelegt, die Geschichte (git) ist lesbar | `strom repair` | stellt den letzten versiegelten Stand her: geänderte Einträge werden wiederhergestellt, außerhalb von strom angelegte entfernt; Kopien alles Ersetzten bleiben in `.strom/quarantine/`; ab Forschung 1.31.0 fragt es den Menschen, bevor es mehr als 3 Einträge entfernt ([R14.3](#R14.3)), und `strom repair undo` legt die Kopien zurück ([R14.3.1](#R14.3.1)) |
| eine auf einem anderen Computer versiegelte Forschung | `strom seal adopt` | prüft die Kette der Operationen und den Hash jedes Eintrags und legt für die Forschung den Schlüssel dieses Computers an |
| eine verlorene Geschichte: die ältesten Protokolle von `data/ops` fehlen und die Geschichte (git) ist nicht lesbar oder fehlt; die Einträge sind, wie strom sie schrieb | `strom seal accept` | stellt nichts her und übernimmt nichts: versiegelt die Forschung, wie sie jetzt ist, als neue Grundlage ([R14.2](#R14.2)) |
| ab Forschung 1.31.0: die Geschichte (git) ist lesbar, aber älter als die Forschung; `strom repair` würde Arbeit entfernen | nie `strom repair`: zuerst eine Sicherung des ganzen Ordners, dann `.git` aus einer Sicherung oder aus Time Machine, oder `strom seal accept` | nichts wird entfernt ([R14.1.1](#R14.1.1)) |

- **Prüft der Code:**
  - bei lesbarer Geschichte (git) verweist strom nicht auf `strom seal accept`: `strom repair` holt die verlorenen
    Protokolle aus ihr zurück. Ab Forschung 1.31.0 eine Ausnahme: eine Geschichte, älter als die Forschung
    ([R14.1.1](#R14.1.1));
  - bei beschädigter oder fehlender Geschichte melden `strom verify` und `strom check` den Befund `git-damaged` (die
    Geschichte ist nicht lesbar, Objekte fehlen, oder die Forschung hat keine Geschichte) und raten bei jeder Datei,
    die nicht zu ihrem Siegel passt: „die Geschichte (git) ist beschädigt, strom repair stellt sie nicht wieder her –
    nach Durchsicht der Einträge in einem eigenen Terminal: strom seal accept“;
  - ein Schreiben in eine Forschung mit beschädigter Geschichte lehnt strom mit „die Geschichte (git) der Forschung
    ist beschädigt: nichts geschrieben“ (Code `tree.git-damaged`) und demselben Rat ab, statt mit dem Fehler von git.
    Früher blieb daran jedes Schreiben und `strom check` stehen.
- **Bedienung:** Terminal: `strom verify`, `strom check`, `strom repair`, `strom repair undo`, `strom seal adopt`,
  `strom seal accept`.
- **Gilt seit:** Forschung 1.30.1; 1.31.0: Geschichte älter als die Forschung, Frage von `strom repair`, `strom repair undo`

<!-- zdroj: research:39c56a89 src/core/accept.ts ACCEPT_HINT, acceptWay (jen bez .git nebo s git.damaged; čitelná historie → nic, strom repair vrátí logy), GIT_DAMAGED, guardOrDamaged · src/commands/checks.ts check a verify (acceptWay nad verifyFull) · src/core/integrity.ts assertIntact, gitDamagedError (tree.git-damaged) · de.json ui.check.accept.hint, ui.error.tree.git-damaged(.hint) · strom help repair, strom help seal adopt · CHANGELOG.de.md 1.30.1 -->

<a id="R14.1.1"></a>
### R14.1.1 Eine Geschichte, älter als die Forschung: `history-reverted`

Ein Cloud-Laufwerk kann eine ältere Kopie der Geschichte (git) in eine Forschung zurücklegen, oft mit iCloud-Kopien in
`.git` (etwa `index 2`, `HEAD 2`). Die Geschichte ist lesbar, aber die seit dieser Kopie geschriebenen Einträge fehlen
in ihr. `strom verify` meldet sie dann als außerhalb von strom angelegt, und `strom repair` würde sie entfernen. Darum
ermittelt strom zuerst, was `strom repair` tun würde, und wo es Arbeit entfernen würde, rät es zu dem Weg, der nichts
verliert.

- **Prüft der Code:**
  - die Geschichte gilt als älter als die Forschung, wenn `strom repair` mindestens einen Eintrag entfernen würde, den
    eine unversehrte signierte Operation aus den Protokollen der Geschichte im Ordner geschrieben hat, auf den andere
    Einträge verweisen oder der eine niedrigere Nummer hat als der höchste Eintrag seiner Art im versiegelten Stand
    (die älteste Geschichte ging verloren); oder wenn in `.git` iCloud-Kopien liegen und die Reparatur etwas entfernen
    würde;
  - `strom verify` und `strom check` melden dann den Befund `history-reverted` mit der Anzahl: „die Geschichte (git)
    ist älter als die Forschung: strom repair würde N Einträge entfernen“. Dazu und bei jedem Befund, bei dem sie sonst
    zu `strom repair` raten würden, raten sie: „zuerst den ganzen Ordner der Forschung sichern; dann .git aus einer
    Sicherung oder aus Time Machine zurückholen – oder nach Durchsicht der Einträge in einem eigenen Terminal: strom
    seal accept (nie strom repair: es würde diese Arbeit entfernen)“;
  - ein Schreiben in eine solche Forschung lehnt strom mit „die Geschichte (git) ist älter als die Forschung – strom
    repair würde N Einträge entfernen: nichts geschrieben“ ab (Code `tree.history-reverted`), mit demselben Rat und
    einem Verweis auf `strom verify`;
  - bei beschädigter oder fehlender Geschichte (`git-damaged`) gilt weiter der Weg aus [R14.1](#R14.1):
    `strom seal accept`.
- **Bedienung:** Terminal: `strom verify`, `strom check`; dann nach dem Rat: eine Sicherung des Ordners, `.git` aus
  einer Sicherung oder aus Time Machine, oder `strom seal accept` ([R14.2](#R14.2)).
- **Gilt seit:** Forschung 1.31.0
- **Warum:** eine Forschung in iCloud Drive mit einer älteren Kopie von `.git` und ohne ihre ältesten Protokolle
  meldete Einträge als unversiegelt, und `strom repair` hätte Einträge aus Jahren der Arbeit entfernt (Befund vom
  9. 11. 2026).

<!-- zdroj: research:0c6f2205 src/core/repair.ts (záhlaví, nález 2026-11-09), planRepair (sealedWork, referenced, older, cloudCopies), historyLost, HISTORY_REVERTED, LOST_HINT, repairWay (ne při GIT_DAMAGED), lostFinding, historyLostError (tree.history-reverted), lostOnRepair · src/core/integrity.ts assertIntact (lostOnRepair → historyLostError) · src/commands/checks.ts sealWay (check, verify) · de.json ui.check.lost, ui.check.lost.hint, ui.error.tree.history-reverted(.hint) · CHANGELOG.cs.md 1.31.0 -->

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

<a id="R14.3"></a>
## R14.3 `strom repair` fragt den Menschen

`strom repair` bringt die Forschung in ihren letzten versiegelten Stand zurück ([R14.1](#R14.1)). Zuerst ermittelt es,
was es tun würde. Würde es mehr Einträge oder Arbeit entfernen, entscheidet der Mensch in seinem eigenen Terminal.

- **Grenzen:**
  - es fragt, wenn es mehr als 3 Einträge entfernen würde oder irgendeinen Eintrag mit einem Zeichen einer Geschichte,
    die älter ist als die Forschung ([R14.1.1](#R14.1.1)); sonst repariert es ohne Frage;
  - vor der Frage sagt es, wie viele Einträge (und Dateien) es entfernen und wie viele Dateien es nach dem versiegelten
    Stand (einem Commit) zurückschreiben würde, und davon wie viele Einträge Operationen geschrieben haben, die in
    ihren eigenen Protokollen versiegelt sind, auf wie viele andere Einträge verweisen, wie viele älter sind als der
    versiegelte Stand und welche iCloud-Kopien in `.git` liegen;
  - dann: „Zuerst den ganzen Ordner der Forschung sichern. Eine Kopie alles Entfernten bleibt in .strom/quarantine/,
    strom repair undo legt sie zurück.“ Mit einem Zeichen einer älteren Geschichte rät es statt der Reparatur zu
    `.git` aus einer Sicherung oder aus Time Machine, oder zu `strom seal accept`;
  - die Frage **N Einträge entfernen?** hat als Vorgabe nein (Enter).
- **Prüft der Code:**
  - ein Agent, `--yes` und ein Lauf ohne Terminal bekommen die Frage nie: nur die Zahlen und „Über das Entfernen von
    Einträgen entscheidet nur ein Mensch im eigenen Terminal – strom repair“ (`needs-consent`, Exit 4); der Agent sagt
    es dem Menschen;
  - nach dem Ja macht strom den Plan unter der Sperre der Forschung erneut; hat sich die Forschung seit der Durchsicht
    geändert, wird nichts repariert („die Forschung hat sich seit der Durchsicht geändert: nichts repariert“);
  - neben den Kopien in `.strom/quarantine/<stamp>/` bewahrt es eine Liste dessen auf, was es entfernt und was es
    überschrieben hat, und sagt nach der Reparatur „rückgängig: strom repair undo <stamp>“ ([R14.3.1](#R14.3.1)).
- **Bedienung:** Terminal: `strom repair`.
- **Gilt seit:** Forschung 1.31.0

<!-- zdroj: research:0c6f2205 src/core/repair.ts REPAIR_ASKS_ABOVE = 3, repairAsks, historyLost, applyRepair (MANIFEST repair.json vedle kopií), sameRepair · src/commands/checks.ts repair (planRepair → repairAsks → requireHuman window false → confirm(ui.repair.ask, false); pod zámkem planRepair znovu, repair.changed; ui.repair.undo.how), repairSaid, repairQuestion · src/cli/context.ts requireHuman (NeedsConsentError) · src/core/errors.ts EXIT.needsConsent 4 · de.json ui.repair.ask.*, ui.repair.ask, ui.repair.person, ui.error.repair.changed · strom help repair · CHANGELOG.cs.md 1.31.0 -->

<a id="R14.3.1"></a>
### R14.3.1 Eine Reparatur rückgängig machen: `strom repair undo`

Was `strom repair` entfernt oder überschrieben hat, legt `strom repair undo` aus seinen Kopien in `.strom/quarantine/`
zurück.

- **Grenzen:**
  - ohne Stempel listet es die Kopien auf, die `strom repair` aufbewahrt hat, die neueste zuerst, jede mit der Zahl
    ihrer Dateien und Einträge; ohne Kopien: „keine Kopien von strom repair in .strom/quarantine/“. Die Liste darf
    jeder starten, auch ein Agent;
  - mit Stempel sagt es zuerst, was das Zurücklegen tun würde: die zurückgelegten Dateien (und die Einträge darunter),
    seit der Reparatur geänderte Dateien, die bleiben, wie sie jetzt sind, und Dateien, die strom nicht versiegelt
    (iCloud-Kopien, unbekannte Dateien) und die in der Quarantäne bleiben. Die Frage **Zurücklegen?** hat als Vorgabe
    nein;
  - es legt eine Datei zurück, die die Reparatur entfernt hat und die seitdem nicht im Ordner ist, und eine Datei, die
    die Reparatur überschrieben hat und die sich seitdem nicht geändert hat. Bei Kopien aus `strom repair` der
    Forschung 1.30 (ohne Liste dessen, was die Reparatur überschrieben hat) legt es nur Dateien zurück, die im Ordner
    fehlen;
  - nichts zurückzulegen: „nichts zurückzulegen – jede Datei ist wie ihre Kopie oder wurde seitdem geändert“.
- **Prüft der Code:**
  - das Zurücklegen mit Stempel ist nur für einen Menschen im eigenen Terminal; anderswo gibt strom nur die Zahlen und
    „Über das Zurücklegen dessen, was strom repair entfernt hat, entscheidet nur ein Mensch im eigenen Terminal – strom
    repair undo <stamp>“ (Exit 4);
  - es legt nur in eine Forschung zurück, wie strom sie versiegelt hat: mit Änderungen außerhalb von strom wird nichts
    zurückgelegt („die Forschung hat Änderungen, die strom nicht versiegelt hat: nichts zurückgelegt“, Einzelheiten
    sagt `strom verify`);
  - nichts wird zurückgelegt, solange über der Forschung die Brücke zur Strom-App läuft (`strom live stop`, dann
    erneut) oder jemand an ihr arbeitet (`strom session finish`, dann erneut);
  - nach dem Ja macht es den Plan unter der Sperre der Forschung erneut; hat sich die Forschung seit der Durchsicht
    geändert, wird nichts zurückgelegt („die Forschung hat sich seit der Durchsicht geändert: nichts zurückgelegt“);
  - eine signierte Operation (`repair.undo`) nennt jeden zurückgelegten Eintrag, wie er ist, und strom speichert sie
    mit einem versiegelten Commit; im Ordner wird nichts gelöscht. Am Ende startet es die vollständige Prüfung erneut,
    wie `strom verify`.
- **Bedienung:** Terminal: `strom repair undo` (die Liste), `strom repair undo <stamp>`.
- **Gilt seit:** Forschung 1.31.0; legt auch Kopien aus `strom repair` der Forschung 1.30 zurück

<!-- zdroj: research:0c6f2205 src/core/repair.ts REPAIR_ASKS_ABOVE = 3, repairAsks, historyLost, applyRepair (MANIFEST repair.json vedle kopií), sameRepair · src/commands/checks.ts repair (planRepair → repairAsks → requireHuman window false → confirm(ui.repair.ask, false); pod zámkem planRepair znovu, repair.changed; ui.repair.undo.how), repairSaid, repairQuestion · src/cli/context.ts requireHuman (NeedsConsentError) · src/core/errors.ts EXIT.needsConsent 4 · de.json ui.repair.ask.*, ui.repair.ask, ui.repair.person, ui.error.repair.changed · strom help repair · CHANGELOG.cs.md 1.31.0 -->1
