<a id="R13"></a>
# R13 Ein Problem melden: `strom error`

Wenn in der Forschung, beim Herunterladen, in der Strom-App oder bei der Installation etwas schiefgeht, packt
`strom error` in eine einzige ZIP-Datei, was nötig ist, um zu erkennen, was geschehen ist. Nichts über die Menschen des
Stammbaums kommt hinein, und strom sendet nichts: die Datei schickt ein Mensch selbst. Beschrieben wird die Forschung
1.30.0.

<!-- zdroj: dirigent:spec/070-hlaseni-chyby/spec.md · research:6c6e7c3b CHANGELOG.cs.md 1.30.0 (Problém nahlášený v jednom souboru) · strom help error · src/commands/error.ts · src/core/report.ts -->

<a id="R13.1"></a>
## R13.1 Ein Befehl, eine Datei

`strom error` gibt aus, was der Bericht enthalten wird, fragt **Bericht erstellen?** und speichert die ZIP-Datei. Es
sagt, wo die Datei liegt, wie groß sie ist und wohin sie zu schicken ist.

- **Prüft der Code:**
  - die Datei kommt in den Ordner Downloads, sonst in den aktuellen Ordner; in einer Forschung ohne Ordner Downloads in
    den Benutzerordner, nie in die Forschung;
  - der Bericht hat höchstens 2 MB: längere Protokolle werden gekürzt;
  - der Befehl liest die Forschung nur, er schreibt nichts in sie;
  - strom sendet nichts: „Per E-Mail an {adresse} zu senden, mit ein paar Worten dazu, was passiert ist. strom selbst
    sendet nichts; die Datei lässt sich vorher öffnen und durchsehen (README.txt sagt, was wo ist).“
- **Bedienung:** Terminal: `strom error`; im Menü von `strom`: **Einstellungen → Wartung → Ein Problem melden: eine
  ZIP-Datei zum Versenden (nichts über die Menschen des Stammbaums)**.
- **Gilt seit:** Forschung 1.30.0

<!-- zdroj: research:6c6e7c3b src/commands/error.ts (ctx.readOnly, cíl ZIPu) · src/core/report.ts REPORT_MAX_BYTES · cs.json ui.report.summary, ui.report.create, ui.report.done, ui.report.send, ui.maintenance.title, ui.maintenance.report -->

<a id="R13.2"></a>
## R13.2 Was der Bericht enthält und was nicht

| Bereich | Was darin ist |
|---|---|
| dieser Computer | Version und Kanal von strom, Node, git, System, Sprache, freier Platz |
| Einstellungen von strom | ohne Pfade und Anmeldungen |
| `strom doctor` | alle Prüfungen |
| Agenten | welche installiert sind, ihre Versionen, das Standardmodell, die Hooks von strom |
| Konnektoren | Liste, Versionen, erlaubte Server, letzter Test (ohne Anmeldungen) |
| die Brücke zur Strom-App | Lauf, Version der App, letzte Synchronisation |
| die Forschung in Zahlen | Anzahlen, `strom check`, git, Downloads, Sitzungen (ohne Namen) |
| technische Protokolle | Protokolle von strom der letzten 7 Tage (Brücke, Aufräumen, Downloads) |
| Befehle | mit einem Fehler beendete Befehle, auch die aus dem Gespräch mit dem Agenten |

- **Prüft der Code:**
  - Namen, Orte, Notizen, Abschriften, Bilder und E-Mails kommen nicht in den Bericht oder werden durch feste Codes
    ersetzt (zum Beispiel ‹a1b2c›): dasselbe Wort hat im ganzen Bericht denselben Code, sodass zu sehen ist, dass es
    um dasselbe geht, aber nicht, was es ist;
  - Pfade mit dem Benutzernamen werden maskiert; Anmeldungen, Schlüssel und Token kommen nie hinein;
  - Forschungen heißen im Bericht nur R1, R2…, nie nach ihrem Pfad;
  - ein Bereich, der sich nicht lesen lässt, hat in der Ausgabe ✗ und den Fehler („nicht lesbar (…)“); der Bericht
    entsteht aus den übrigen;
  - im ZIP sind README.txt (was wo ist) und report.json.
- **Gilt seit:** Forschung 1.30.0

<!-- zdroj: research:6c6e7c3b cs.json ui.report.area.* (system, config, doctor, agents, connectors, bridge, research, logs, commands), ui.report.area.failed, ui.report.readme.intro · src/core/redact.ts (stálé kódy) · src/core/cmdlog.ts (výzkumy jen R1, R2…, 6c6e7c3b) · src/commands/error.ts:85-97, :408 -->

<a id="R13.3"></a>
## R13.3 Welches Problem, welcher Befehl

`--about` fügt Einzelheiten eines Bereichs hinzu. Es lässt sich mehrmals angeben.

| Problem | Befehl |
|---|---|
| das Herunterladen hält an, schlägt fehl oder wartet lange | `strom error --about fetch` |
| Strom-App: Synchronisation, Brücke, der Stammbaum erscheint nicht | `strom error --about sync` |
| Agent: ein Gespräch oder `strom run` ist schiefgegangen | `strom error --about agent` |
| Installation oder Aktualisierung von strom | `strom error --about install` |
| alles unter Windows | `strom error --about windows` |
| etwas anderes | `strom error` |

- **Was ein Bereich hinzufügt:** Downloads im Detail (jeder, sein Konnektor, Wartezeiten und Fehler); die Brücke im
  Detail (Synchronisationen, Schranken der App); Sitzungen des Agenten im Detail (Schritte und Exit-Codes); die
  Installation im Detail (PATH, Aktualisierungen, Sicherungen der Installation); Windows (Ausführungsrichtlinie von
  PowerShell, lange Pfade, OneDrive).
- **Bedienung:** `--since 2d|1w|12h|JJJJ-MM-TT` bestimmt, wie weit die Protokolle zurückreichen (standardmäßig
  7 Tage).
- **Gilt seit:** Forschung 1.30.0

<!-- zdroj: research:6c6e7c3b strom help error (tabulka), REPORT_ABOUT · cs.json ui.report.area.fetch, sync, agent, install, windows -->

<a id="R13.4"></a>
## R13.4 Wo das Problem auftrat und was geschah

Der Bericht sagt, wo das Problem aufgetreten ist, und kann eine Beschreibung in den Worten des Menschen enthalten.

- **Prüft der Code:**
  - ein Mensch am Terminal bekommt die Frage **Wo ist das Problem aufgetreten?**: **in einem Gespräch mit einem
    Agenten**, **im Terminal, strom ohne Agenten**, **in der Strom-App**, **unbekannt**; mit
    `--where chat|terminal|app|unknown` wird nicht gefragt;
  - von einem Agenten ohne `--where` gestartet: der Ort bleibt „unbekannt“, und strom sagt dem Agenten, er solle den
    Menschen fragen und den Befehl erneut starten;
  - `--note "…"` ist die Beschreibung des Problems in den Worten des Menschen, höchstens 2000 Zeichen; Namen aus der
    Forschung werden darin maskiert.
- **Bedienung:** `strom error --where app --about sync`, `strom error --since 2d --note "das Herunterladen hielt
  mittendrin an"`.
- **Gilt seit:** Forschung 1.30.0

<!-- zdroj: research:6c6e7c3b src/commands/error.ts (otázka jen interaktivně; pod agentem where unknown) · cs.json ui.report.where.q, .chat, .terminal, .app, .unknown · strom help error --note (≤2000 characters, masked) -->

<a id="R13.5"></a>
## R13.5 Daten von Personen nur mit Zustimmung

Liegt das Problem bei einer bestimmten Person, Familie oder einem Buch, lassen sich deren Daten hinzufügen. Nur auf
ausdrücklichen Wunsch.

- **Prüft der Code:**
  - `--with-data` mit `--person P…`, `--family F…` oder `--book B…` fügt die Datei data.json hinzu: Namen, Angaben,
    Orte, Zitationen und wie sicher jede Angabe ist. Bilder, Notizen und Abschriften nicht;
  - ein Mensch am Terminal bekommt die Frage **Dem Bericht hinzufügen?**;
  - ein Agent muss `--yes-data` angeben, und das nur nach einem ausdrücklichen „ja“ des Menschen im Gespräch; ohne es
    endet der Befehl mit dem Hinweis, dass die Zustimmung fehlt.
- **Bedienung:** `strom error --about fetch --with-data --book B0001`.
- **Gilt seit:** Forschung 1.30.0

<!-- zdroj: research:6c6e7c3b strom help error --with-data, --person, --family, --book, --yes-data · src/core/reportdata.ts · cs.json ui.report.data.q, ui.report.data.add -->

<a id="R13.6"></a>
## R13.6 Eine beschädigte Forschung, das Strom-Archiv und außerhalb einer Forschung

- **Prüft der Code:**
  - eine beschädigte Forschung wird nur gelesen; was sich nicht lesen lässt, hat in der Ausgabe ✗, und der Rest des
    Berichts entsteht;
  - im Strom-Archiv hat der Bericht keine Agenten, keine Sitzungen und kein `--about agent`; die Frage **Wo ist das
    Problem aufgetreten?** hat kein „in einem Gespräch mit einem Agenten“ und bietet statt „im Terminal, strom ohne
    Agenten“ **im Terminal** an;
  - außerhalb einer Forschung gestartet: der Bericht hat jede bekannte Forschung, nur in Zahlen und mit maskiertem
    Namen; mit einem Fehler beendete Befehle aus allen.
- **Gilt seit:** Forschung 1.30.0

<!-- zdroj: research:6c6e7c3b CHANGELOG.cs.md 1.30.0 („Výzkum se jen čte, i rozbitý.“) · src/commands/error.ts (archiv: bez agentů a gate.log; mimo výzkum jen otisky známých výzkumů) · cs.json ui.report.where.terminal.archive, ui.report.area.research.archive -->

<a id="R13.7"></a>
## R13.7 Der Agent und das Melden eines Problems

Der Agent kennt den Befehl. Sagt ein Mensch, dass er ein Problem mit strom hat, oder will er „einen Fehler schicken“,
fragt der Agent, wo es aufgetreten ist (in diesem Gespräch, im Terminal ohne Agenten oder in der Strom-App), errät es
nie und startet `strom error --where …` mit dem passenden `--about` und mit `--note` in den Worten des Menschen. Dann
nennt er den Pfad zur Datei und die Adresse, die strom ausgegeben hat.

- **Prüft der Code:** Daten von Personen fügt der Agent nur mit `--yes-data` hinzu, das er nur nach ausdrücklicher
  Zustimmung des Menschen angeben darf ([R13.5](#R13.5)).
- **Nur Methodik:** der Agent schickt die Datei nie, öffnet sie nicht und überträgt ihren Inhalt nicht ins Gespräch.
- **Gilt seit:** Forschung 1.30.0

<!-- zdroj: research:6c6e7c3b src/commands/guide.ts:371-378 (A PROBLEM WITH STROM) · CHANGELOG.cs.md 1.30.0 -->
