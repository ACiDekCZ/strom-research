<a id="R7"></a>
# R7 Wann und wie lange der Agent arbeitet

Wie lange der Agent der Forschung allein arbeitet, wann die nächste Sitzung beginnt und warum ein Lauf endet.
Beschrieben werden die Forschung 1.25.2 und die Strom-App 3.21.2. Änderungen aus einer neueren Version tragen deren Nummer.

<a id="R7.1"></a>
## R7.1 Die Arbeit allein läuft in Sitzungen

Arbeitet der Agent allein, nimmt er Aufgaben aus der Warteschlange ([R2.2](R2-lines-and-queue.md#R2.2)) ohne den
Menschen. Eine Sitzung ist eine Aufgabe. Ein Lauf startet eine oder mehrere Sitzungen nacheinander; zwischen ihnen
kann er eine Bedingung fragen ([R7.4](#R7.4)).

- **Grenzen:**
  - ohne Option 1 Sitzung; `--max <n>` höchstens n; `--loop` Sitzung auf Sitzung, solange es Arbeit gibt;
  - `--task T…`: die gewählten Aufgaben in der angegebenen Reihenfolge, jede eine Sitzung; eine inzwischen erledigte
    oder übernommene Aufgabe wird übersprungen;
  - `--until HH:MM`: danach beginnt keine Sitzung, eine laufende läuft zu Ende. Eine Uhrzeit, die heute schon vorbei
    ist, bedeutet morgen;
  - ohne offene Aufgabe in der Warteschlange endet jeder Lauf.
- **Bedienung:** Terminal: Menü **Den Agenten allein arbeiten lassen**, Optionen **Die Warteschlange in dieser
  Reihenfolge abarbeiten – wie viele, steht zur Wahl** (1–100, wie `--max`), **Nur die aus der Liste gewählten
  Aufgaben** (wie `--task`) und **Weiterarbeiten lassen, solange es Arbeit gibt und die Bedingung „…“ es
  erlaubt** (wie `--loop`, nur mit gesetzter Bedingung); Befehl `strom run`. Die Strom-App 3.21.2 stellt die Arbeit
  allein nicht ein; sie zeigt den Zustand des Laufs ([R7.4](#R7.4)), und eine Sitzung lässt sich aus ihr abschließen
  ([R7.3](#R7.3)).
- **Gilt seit:** Forschung 1.0.0 (`--max`, `--until`, `--task`), `--loop` seit 1.2.0
- **Ab Forschung 1.32.0:** `--tasks <n>` (1–100) endet nach n erledigten Aufgaben: fertig, wartend auf den Menschen,
  zurückgestellt oder aufgegeben nach ihrer Sitzung (auch eine Aufgabe, die der Lauf zurückstellte, weil er an ihr
  hängen blieb). Eine unfertige Aufgabe, die in die Warteschlange zurückgeht (der Agent hat sie nicht beendet, das
  Zeitlimit, eine Unterbrechung), zählt nicht. Höchstens 2×n Sitzungen. `--tasks` geht nicht mit `--max`, `--loop`,
  `--task`, `--until` noch mit einer anderen Wahl der Aufgaben. Die Bedingung wird einmal gefragt, wie bei `--max`
  ([R7.4.1](#R7.4.1)). Arbeit an der Warteschlange über einen Link der Strom-App: [R7.1.2](#R7.1.2).

<!-- zdroj: research:src/commands/session.ts:737-783 (popis a volby run), :830 max, :694 parseUntil · src/cli/menu.ts:288-375 (v1.25.2) · cs.json ui.menu.run, ui.run.queue, ui.run.pick, ui.run.loop, ui.run.how · 1.32.0: src/commands/session.ts TASKS_MAX=100, SETTLED (done, waiting, parked, dropped), --tasks (max = 2×n, odmítnutí s --max, --loop, --task, --until a dalšími volbami výběru), popis run · CHANGELOG.cs.md 1.32.0 · spec 052 K6.3 -->

<a id="R7.1.1"></a>
### R7.1.1 Warum ein Lauf endet

- Am Ende gibt der Lauf **Sitzungen: N · Ende: …** aus: **fertig**, **keine offenen Aufgaben**,
  **Zeitlimit** (`--until`), **von Hand angehalten** ([R7.3](#R7.3)), **Limit des Abonnements** ([R7.6](#R7.6)),
  **der Agent ist nicht angemeldet** ([R7.7](#R7.7)), die Antwort der Bedingung ([R7.4](#R7.4)) oder ein Fehler
  (Belege, Versagen des Agenten, Modell).
- Wenn die übrigen Aufgaben ein Archiv brauchen, das nicht antwortet, wartet ein Lauf mit `--loop` und `--until`
  (**⏸ warte bis …**), ein anderer endet.
- **Gilt seit:** Forschung 1.0.0; das Warten auf ein Archiv, das nicht antwortet, seit 1.22.0
- **Ab Forschung 1.32.0:** ein Lauf mit `--tasks` endet mit **N Aufgaben erledigt**, oder nach 2×n Sitzungen mit
  **Sitzungen: … (höchstens so viele für die gewünschten Aufgaben) – erledigte Aufgaben: …**.
- **Ab Forschung 1.36.0:** ein Lauf, dem nur Aufgaben in einem eingeschränkten Archiv geblieben sind, das eine andere
  Sitzung nutzt, wartet höchstens `archive.wait` und endet mit **nichts weiter zu tun – die übrigen Aufgaben brauchen
  das Archiv …** ([R9.13](R9-archives.md#R9.13)).

<!-- zdroj: research:src/commands/session.ts:853 Stop, :1220-1268, :1277-1285 · cs.json ui.run.summary, ui.run.stop.*, ui.run.asleep.wait · CHANGELOG.cs.md 1.22.0 · 1.32.0: session.ts Stop tasks|sessions, cs.json ui.run.stop.tasks, ui.run.stop.sessions -->

<a id="R7.1.2"></a>
### R7.1.2 Arbeit an der Warteschlange über einen Link der Strom-App

- Mit dem Link `strom-research://work` kann die Strom-App um die Arbeit des Agenten allein an der Warteschlange bitten:
  eine bestimmte Anzahl Aufgaben, oder Arbeit, solange es etwas zu tun gibt. Der Link öffnet das Terminal der
  Forschung ([S4.5](S4-research-from-the-app.md#S4.5)). Es zeigt, was starten würde, und startet es erst auf ein Ja;
  die Standardantwort ist Nein.
- **Grenzen:**
  - das Terminal zeigt die ersten 5 Aufgaben in der Reihenfolge, in der `strom run` sie nimmt (eine Aufgabe mit
    **sofort** zuerst), wie viele es noch gibt, wann der Lauf endet, das Zeitlimit der Sitzung und die Bedingung
    ([R7.4](#R7.4));
  - die Anzahl der Aufgaben ist 1–100, ohne Angabe 5. Gestartet wird `strom run --tasks N` ([R7.1](#R7.1)); die
    Bedingung wird einmal gefragt, vor der ersten Sitzung;
  - Arbeit, solange es etwas zu tun gibt, läuft nur unter einer Bedingung und startet `strom run --loop`. Ohne
    gesetzte Bedingung startet nichts: das Terminal bietet stattdessen eine Anzahl Aufgaben, das Einstellen einer
    Bedingung oder nichts (Standard) an;
  - wenn an der Forschung schon ein Lauf oder eine Sitzung arbeitet, startet nichts weiter. Bei leerer Warteschlange
    auch nicht. Fehlt auf dem Computer das Terminalprogramm des Agenten, sagt das Terminal das, bevor es etwas fragt;
  - der Lauf geht im selben Terminalfenster. Strg-C bittet die laufende Sitzung um Abschluss und hält den Lauf an
    ([R7.3](#R7.3)); der Rest bleibt in der Warteschlange;
  - die Brücke startet die Arbeit des Agenten nicht, nur das Terminal nach dem Ja.
- **Bedienung:** ein Link aus der Strom-App (`strom-research://work` mit `do=tasks` und `n`, oder `do=loop`), in der
  App 3.28.0 **An der Warteschlange arbeiten…** ([S4.2.3](S4-research-from-the-app.md#S4.2.3)); Terminal: `strom link open "<Link>"`.
- **Gilt seit:** Forschung 1.32.0
- **Ab Forschung 1.36.0:** Bei **Agent aus der Strom-App starten: ohne Rückfrage** startet die Arbeit ohne Frage nach
  einem Ja; die Bedingung fragt weiter ([S4.5.5](S4-research-from-the-app.md#S4.5.5)).
- **Ab Forschung 1.36.0:** der Link kann Aufgaben nennen (`do=tasks` mit `task=T…,T…`, nur Nummern von Aufgaben,
  höchstens 100, nie mit `n`): **Jetzt bearbeiten** nach einer Probe der Prüfung
  ([S7.5.1](S7-reliability-and-verification.md#S7.5.1)). Das Terminal zeigt „Diese Aufgaben, in dieser Reihenfolge:“
  und „Eine Sitzung je Aufgabe (N Sitzungen), dann Ende; was nicht fertig wird, geht zurück in die Warteschlange.“
  Nach einem Ja startet es `strom run --task` mit diesen Aufgaben in der Reihenfolge des Links. Aufgaben, die nicht mehr
  warten (erledigt, zurückgenommen oder von einem anderen gehalten), lässt es aus und sagt, wie viele; wartet keine,
  startet nichts.

<!-- zdroj: 1.36.0: research:7116bb60 src/cli/menu-links.ts workOn, src/core/links.ts (task= jen s do=tasks, ne s n, 1–LINK_WORK_MAX) · cs.json ui.link.work.picked.* · research:src/cli/menu-links.ts workRun (WORK_LIST=5, agentCliHere, busyIn, taskQueue s RUN_TURNS, loop jen s run.gate, choose výchozí „Teď nic“, asks … false, run --tasks | --loop) · src/core/links.ts LINK_WORK_DOS, LINK_WORK_MAX=100, LINK_WORK_DEFAULT=5 · src/commands/links.ts case "work" · cs.json ui.link.work.*, ui.link.what.work.*, ui.run.next, ui.run.limit, ui.link.cost · CHANGELOG.cs.md 1.32.0 · spec 052 K6.2 (cesta terminál, most agenta nespouští) -->

<a id="R7.2"></a>
## R7.2 Jede Sitzung hat ein Zeitlimit

Eine Sitzung dauert höchstens die eingestellte Zahl von Minuten, Standard 60. Der Agent kennt die Endzeit im Voraus,
und strom erinnert ihn daran. Beim Limit hält strom ihn an und bringt eine nicht abgeschlossene Aufgabe in die
Warteschlange zurück.

- **Grenzen:**
  - in den letzten 10 Minuten (kurze Sitzung: im letzten Viertel) sagt jeder Befehl `strom`, wie viel Zeit bleibt;
    in den letzten 3 Minuten (kurze Sitzung: im letzten Achtel) fordert er auf, das Gefundene zu erfassen und die
    Sitzung zu schließen;
  - beim Limit bekommt ein Agent, der das kann (Claude Code, Codex, OpenCode, Grok), noch 5 Minuten zum Erfassen und
    Schließen;
  - eine Aufgabe, bei der 2 Sitzungen nacheinander nichts erfasst haben, wird zurückgestellt (**… zurückgestellt**);
    vom Menschen beendete Sitzungen zählen nicht;
  - Reihenfolge: `--minutes` > Variable `STROM_RUN_MINUTES` > Einstellung des Stammbaums >
    Einstellung des Computers > 60.
- **Bedienung:** Terminal: **Einstellungen: Agent, allein arbeiten, Nachrichten, Archive, Wartung → Der Agent allein →
  Zeit für eine Aufgabe: N Min.** (5–600; 0 kehrt ohne Änderung zurück); `strom config set run.minutes <n>`
  (`--for-tree`: nur dieser Stammbaum). App: nichts.
- **Gilt seit:** Forschung 1.0.0 (60 Minuten, Zurückstellen der Aufgabe); Erinnerungen und 5 Minuten zum Erfassen seit
  1.2.0

<!-- zdroj: research:src/core/config.ts:223 DEFAULT_RUN_MINUTES=60, run.minutes tree:true · src/core/clock.ts REMIND_MS, CLOSE_MS, WRAP_UP_MS, clockLine :103-118 · session.ts:705 MAX_IDLE_SESSIONS=2, :750 popis · src/cli/menu-settings.ts:300-317 (v1.25.2) · cs.json ui.alone.minutes, ui.alone.minutes.ask, ui.run.parked -->

<a id="R7.3"></a>
## R7.3 Eine Sitzung lässt sich um Abschluss bitten

Der Mensch kann eine laufende Sitzung bitten, zu enden. Der Agent beginnt nichts Neues, erfasst, was er gefunden hat,
und schließt die Sitzung. Dann endet der Lauf, und keine weitere Sitzung beginnt. Nichts wird gewaltsam angehalten.

- **Grenzen:**
  - der Agent sieht die Bitte beim nächsten Befehl `strom`; ein neuer Leser beginnt nicht, die Arbeit eines
    Subagenten hält strom nicht mittendrin an;
  - Strg-C im Terminal des Laufs: beim ersten Mal dieselbe Bitte, beim zweiten Mal sofortiges Anhalten (die Aufgabe
    kehrt in die Warteschlange zurück). Unter Windows und mit `--interactive` hält schon das erste Strg-C sofort an.
- **Bedienung:** Terminal: `strom session finish [N…]` (laufen mehrere Sitzungen, ist anzugeben, welche), Strg-C. App:
  **Forschungsübersicht**, beim arbeitenden Agenten **Abschließen und beenden**; bestätigt wird im Terminal der
  Forschung. Wenn der Lauf auf die Bedingung wartet, fehlt die Schaltfläche.
- **Gilt seit:** Forschung 1.8.0, App 3.5.0
- **Ab Forschung 1.36.0:** ein Lauf lässt sich auch von außen und einzeln anhalten, `strom run stop <run-…>
  [--finish]`; bei mehreren Läufen hat in der App jeder sein eigenes **Abschließen und beenden** ([R7.10.2](#R7.10.2)).

<!-- zdroj: research:src/commands/session.ts:198-221 session finish, :865 onSignal, :1194 askedToFinish · src/core/clock.ts askFinish, refuseReadersWhenFinishing · runners/runner.ts:296 OWN_GROUP · src/cli/menu-links.ts:473 finishSession · app:v3.21.2 research-overview-ui.ts:810,868 (!w.paused) · strings.ts live.finishSession -->

<a id="R7.4"></a>
## R7.4 Die Bedingung entscheidet, ob die nächste Sitzung beginnt

Die Bedingung ist ein Programm, das strom vor einer Sitzung fragt: weiter, warten oder anhalten. Sie wird nur vom
Menschen gesetzt, für den ganzen Computer. Ohne Bedingung läuft der Lauf weiter, solange es Arbeit gibt.

- **Grenzen:**
  - **weiter**: die Sitzung beginnt; **warten**: der Lauf wartet und fragt erneut; **anhalten**: der Lauf endet.
    Alles andere (Absturz des Programms, keine Antwort innerhalb von 120 s, `claude-usage` 660 s) ist ein Fehler, und
    der Lauf endet;
  - wann erneut zu fragen ist, sagt die Bedingung; sonst nach 15 Minuten, nie früher als nach 1 Minute. Strg-C
    beendet das Warten; mit `--until` beendet es die angegebene Uhrzeit (**Zeitlimit**);
  - `--loop` und `--until`: eine Frage vor jeder Sitzung; von Hand gestartete Aufgaben: eine Frage
    ([R7.4.1](#R7.4.1));
  - strom liefert die Bedingung `claude-usage` mit ([R7.5](#R7.5)); eine eigene Bedingung ist ein Ordner
    `plugins/gates/<Name>/`;
  - ein Lauf ohne gesetzte Bedingung (`--no-gate`) oder mit einer anderen (`--gate`) braucht die Zustimmung des
    Menschen.
- **Bedienung:** Terminal: **Einstellungen → Der Agent allein → Immer weiter unter einer Bedingung: …** (eine
  Bedingung oder **keine**); `strom config set run.gate "<Name> [was ihr mitgeben]"`, `strom config unset run.gate`;
  beides bestätigt der Mensch. App: die **Forschungsübersicht** zeigt bei einem wartenden Lauf **Pausiert** und
  **weiter um …**.
- **Gilt seit:** Forschung 1.2.0, App 3.5.0 (Zustand Pausiert)

<!-- zdroj: research:src/core/gate.ts:27-34 DEFAULT_TIMEOUT_S, DEFAULT_WAIT_MS, MIN_WAIT_MS, askGate :209-254, SHIPPED :124 · session.ts:911 gateHolds, :1038-1063 wait, markPaused, runGate :1357-1380 · config.ts run.gate tree:false · setup.ts:1537-1548 · app:v3.21.2 research-overview-ui.ts:340-347, strings.ts live.statePaused, live.pausedUntil -->

<a id="R7.4.1"></a>
### R7.4.1 Von Hand gestartete Aufgaben: „Trotzdem starten?“

- Eine Sitzung, `--max`, `--task` und das Menü sind eine Wahl des Menschen. Die Bedingung wird einmal gefragt, vor
  der ersten Sitzung. Würde sie nicht starten (warten, anhalten, Fehler), kommt die Frage **Die Bedingung „…“
  würde jetzt nicht starten — …. Trotzdem starten?** Enter bedeutet nein: der Lauf endet (**nicht gestartet —
  die Bedingung „…“: …**). Ja: die Sitzungen beginnen, und die Bedingung wird nicht mehr gefragt, außer
  bei der Obergrenze ([R7.4.2](#R7.4.2)).
- Startet den Lauf der Agent, antwortet der Mensch in einem Systemfenster. Ein Skript, das niemand fragen kann, hält
  sich an die Bedingung.
- **Gilt seit:** Forschung 1.2.0

<!-- zdroj: research:src/commands/session.ts:1027-1037, startAnyway :1400-1411 · cs.json ui.run.gate.once, ui.run.gate.anyway, ui.run.stop.gate.declined -->

<a id="R7.4.2"></a>
### R7.4.2 Obergrenze: eine feste Grenze

- Die Bedingung kann eine Antwort als feste Grenze des Menschen kennzeichnen (`hard`). Der Lauf endet dann (**die
  Obergrenze der Bedingung „…“**), und kein „trotzdem“ überschreitet sie.
- Die Bedingung kann das Fenster des Plans des Agenten überwachen (`watch`). Dann fragt sie vor jeder Sitzung jedes
  Laufs, und eine Sitzung in Arbeit bekommt die Bitte um Abschluss ([R7.3](#R7.3)), wenn der Agent eine Nutzung des
  Fensters an der angegebenen Grenze meldet.
- **Gilt seit:** Forschung 1.14.0

<!-- zdroj: research:src/core/gate.ts:64-71 hard, watch, parseSaid :330-348 · session.ts:1012-1026, onLimits :1175-1182 · cs.json ui.run.gate.cap, ui.run.cap.finish, ui.run.stop.gate.cap -->

<a id="R7.4.3"></a>
### R7.4.3 Aufzeichnung der Antworten der Bedingung

- Jede Antwort hat eine Zeile in der Ausgabe des Laufs: **· Bedingung …: … (Code …;
  .strom/gate.log)**: der Name der Bedingung, ihre Antwort mit Grund und der Code.
- Zugleich eine JSON-Zeile in `.strom/gate.log` des Stammbaums: wann, die Bedingung und was ihr übergeben wurde, Code,
  Urteil, Grund, Warten, Limits des Plans und was der Lauf tat (`go`, `wait`, `stop`, `anyway`). Aufbewahrt werden
  90 Tage, höchstens 2 MB.
- **Bedienung:** Terminal: **Der Agent allein → Was würde die Bedingung jetzt sagen?**, `strom gate test`.
- **Gilt seit:** Forschung 1.14.0 (Aufzeichnung); die Frage aus dem Menü seit 1.3.0

<!-- zdroj: research:src/core/gate.ts GATE_LOG, GateRecord :264-287, recordGate :311 · session.ts:1003-1007, :1069-1078 · src/core/tidy.ts:49 gate {days: 90, bytes: 2 MB} · menu-settings.ts:432-452 (v1.25.2) -->

<a id="R7.5"></a>
## R7.5 Die Bedingung claude-usage hält das Tempo der Woche

`claude-usage` hält die Arbeit des Agenten allein im wöchentlichen Limit des Claude-Abonnements. Sie vergleicht, wie
viel Prozent der Woche seit ihrer Erneuerung vergangen sind (ein Tag ≈ 14,3 %), mit der Nutzung der Woche. Eine
Sitzung beginnt nur, wenn der Vorsprung (vergangen − genutzt) mindestens die angegebene Zahl n ist.

- **Grenzen:** die Schritte gehen in dieser Reihenfolge, es entscheidet der erste, der zutrifft:
  1. n ist keine ganze Zahl 0–99, oder die Obergrenze ist keine ganze Zahl 1–100: anhalten (jeder Lauf);
  2. der Agent ist nicht Claude Code, oder Claude Code läuft mit einem API-Schlüssel: weiter;
  3. die Nutzung aus der Meldung des Agenten in diesem Lauf (höchstens 15 Minuten alt), sonst aus `claude -p /usage`.
     Nicht lesbar: 3 Versuche im Abstand von 30 s, dann 15 Minuten warten. Claude Code ist nicht angemeldet: anhalten
     ([R7.7](#R7.7));
  4. eine Woche ohne Zeit der Erneuerung: genutzt 0 % → weiter, sonst 15 Minuten warten;
  5. genutzt ≥ Obergrenze: anhalten, fest ([R7.5.4](#R7.5.4));
  6. das Fünfstundenfenster ist erschöpft (100 %): bis zu seiner Erneuerung und 1 Minute warten;
  7. Vorsprung ≥ Bedarf ([R7.5.1](#R7.5.1)), nach einem Warten mit Zuschlag ([R7.5.2](#R7.5.2)): weiter;
  8. die letzten 2 Stunden vor der Erneuerung der Woche, und bis 100 % (oder bis zur Obergrenze) bleiben mindestens
     10 Punkte: weiter;
  9. sonst warten ([R7.5.3](#R7.5.3)).
- **Bedienung:** Terminal: **Immer weiter unter einer Bedingung** → **Claude usage** → n eingeben (angeboten wird 10;
  nur mit Claude Code auf dem Computer); `strom config set run.gate "claude-usage 10"`. Ohne Zahl gilt 0.
- **Gilt seit:** Forschung 1.2.0; nicht lesbare Nutzung und fehlende Anmeldung seit 1.25.2
- **Ab Forschung 1.26.0:** das Menü und `strom config set` nehmen nur ein ganzes n 0–99 an (in 1.25.2 auch ein n mit
  Dezimalstellen, das dann den Lauf anhält).

<!-- zdroj: research:assets/plugins/gates/claude-usage/gate.ts (v1.25.2 = HEAD) :209-312, FRESH_MS, ATTEMPTS=3, RETRY_MS=30 s, UNREAD_WAIT=15 min, AFTER_RESET=60 s, END_WINDOW=2 h, SESSION_POINTS=10 · gate.json timeout 660 · menu-settings.ts:322-357 (v1.25.2) · HEAD src/core/gate.ts pointsProblem -->

<a id="R7.5.1"></a>
### R7.5.1 Anfang der Woche

- Der Bedarf ist die kleinere der Zahlen n und die Hälfte des vergangenen Teils der Woche; das volle n gilt ab 2·n %
  der Woche. Gleich nach der Erneuerung beginnt eine Sitzung. Beispiel: n = 10, vergangen 12 % → Bedarf 6; eine
  Sitzung beginnt bei einer Nutzung von höchstens 6 %.
- **Gilt seit:** Forschung 1.15.0

<!-- zdroj: research:assets/plugins/gates/claude-usage/gate.ts:280 need = min(min, gone/2) · CHANGELOG.cs.md 1.15.0 -->

<a id="R7.5.2"></a>
### R7.5.2 Zuschlag nach dem Warten

- Hat die Bedingung wegen eines kleinen Vorsprungs gewartet, lässt sie erst mit einem Zuschlag von 2 Punkten wieder
  starten (bei 15: Vorsprung 17), am Anfang der Woche anteilig weniger (2 · Bedarf / n). Dann lässt sie Sitzungen
  nacheinander starten, bis der Vorsprung unter den Bedarf fällt.
- Die Woche des Wartens merkt sie sich in `hold.json` in ihrem Ordner; eine neue Woche beginnt ohne Zuschlag.
- **Gilt seit:** Forschung 1.22.0

<!-- zdroj: research:assets/plugins/gates/claude-usage/gate.ts RESERVE=2 :71, reserve :287, holding/hold :368-387 · CHANGELOG.cs.md 1.22.0 -->

<a id="R7.5.3"></a>
### R7.5.3 Wie lange sie wartet

- Bis zum ersten der Zeitpunkte: die Woche holt den Vorsprung mit Zuschlag auf; die letzten 2 Stunden der Woche
  beginnen (nur wenn bis 100 % oder bis zur Obergrenze mindestens 10 Punkte bleiben); die Woche erneuert sich (und
  1 Minute). Nie über die Erneuerung hinaus, immer mindestens 5 Minuten.
- Die Antwort nennt die Nutzung, den vergangenen Teil, den Vorsprung und auf welchen Vorsprung sie wartet.
- **Gilt seit:** Forschung 1.2.0; die letzten 2 Stunden seit 1.15.0

<!-- zdroj: research:assets/plugins/gates/claude-usage/gate.ts:294-312 (caught, last, after, now + 5 min), T.cs head, hold -->

<a id="R7.5.4"></a>
### R7.5.4 Obergrenze der Woche

- `claude-usage 10 --cap 95`: bei einer Nutzung der Woche von 95 % und mehr beginnt keine Sitzung, in keinem Lauf und
  auch nicht nach „Trotzdem starten?“. Der Lauf endet und nennt die Nutzung und wann sich die Woche erneuert.
- Sie fragt vor jeder Sitzung jedes Laufs ([R7.4.2](#R7.4.2)). Eine laufende Sitzung bekommt die Bitte um Abschluss
  erst bei 99 % der Woche, auch wenn die Obergrenze niedriger ist. `--cap` ohne n: es gelten die Obergrenze und das
  Tempo mit n = 0.
- **Bedienung:** Terminal: `strom config set run.gate "claude-usage 10 --cap 95"`. Das Menü nimmt die Obergrenze in
  1.25.2 nicht an, seit 1.26.0 schon.
- **Gilt seit:** Forschung 1.14.0
- **Ab Forschung 1.26.0:** eine laufende Sitzung bekommt die Bitte um Abschluss schon bei der Obergrenze
  (`--cap 95`: bei 95 % der Woche; `--cap 100`: bei 99 %).

<!-- zdroj: research:assets/plugins/gates/claude-usage/gate.ts:213-219 --cap, :271-272 cap hard, FINISH_AT=0.99 :54, answer() watch :204 · src/core/gate.ts capProblem :159 · menu-settings.ts:350 (v1.25.2) · 1.26.0: gate.ts finish min(0.99, cap/100) (commit 6276a16f) -->

<a id="R7.6"></a>
## R7.6 Das Limit des Abonnements hält den Lauf an

Wenn der Agent während einer Sitzung auf das Limit seines Abonnements stößt, wird die Sitzung geschlossen, und der
Lauf endet: **Limit des Abonnements (erneuert sich …)**. Bis Forschung 1.33.0 wartet der Lauf nicht, auch nicht mit
`--loop`, und das hängt nicht von der Bedingung ab; ab 1.34.0 siehe unten.

- **Grenzen:** die Aufgabe kehrt in die Warteschlange zurück; die Zeit der Erneuerung erscheint nur, wenn der Agent
  sie genannt hat. Warten kann nur die Bedingung.
- **Gilt seit:** Forschung 1.0.0
- **Ab Forschung 1.34.0:** ein Lauf, der von selbst weitergeht (`--loop`, `--until`) und eine Bedingung hat
  ([R7.4](#R7.4)), endet nach dem Limit nicht. Die Aufgabe kehrt in die Warteschlange zurück (als nächste kann eine
  andere kommen), der Lauf wartet bis zur Erneuerung des Limits und eine Minute mehr, fragt dann die Bedingung neu
  und macht weiter. Terminal: „⏸ das Limit des Agenten-Plans ist erschöpft (Fünf-Stunden-Fenster) — Warten bis zur
  Erneuerung (…), dann wird die Bedingung neu gefragt und die Arbeit geht weiter (Strg-C beendet den Lauf)“; die
  Strom-App zeigt den Lauf als pausiert mit dem Grund.
  - Zeit der Erneuerung: aus der Angabe des Agenten über das erschöpfte Fenster des Plans (Fünf-Stunden-Fenster,
    Woche; beide erschöpft: das spätere), sonst aus der Zeit, die der Agent genannt hat (Datum und Uhrzeit,
    „in 2 hours“, „7pm“ nur in der Zeitzone des Computers). Eine Zeit mehr als 8 Tage voraus oder in der
    Vergangenheit wird nicht genommen. Unbekannte Zeit: der Lauf wartet 15 Minuten („…, der Zeitpunkt der Erneuerung
    unbekannt — Warten bis …, dann wird die Bedingung neu gefragt“);
  - Erneuerung erst nach der Zeit von `--until`: der Lauf endet mit **Zeitlimit**;
  - eine durch das Limit unterbrochene Sitzung zählt für die Aufgabe nicht als Misserfolg des Agenten;
  - unverändert: ein Lauf von Hand (eine Aufgabe, `--tasks n`, `--max` ohne `--loop`) und ein Lauf ohne Bedingung
    enden mit **Limit des Abonnements** wie bisher. Die Meldung von Claude Code „You've hit your limit · resets …“
    und eine Ablehnung des Agenten wegen des Limits gelten als Limit.
- **Ab Forschung 1.36.0:** ein Limit, auf das ein Lauf stößt, hält neue Sitzungen aller Läufe desselben Agenten auf
  dem Computer an ([R7.10.3](#R7.10.3)).

<!-- zdroj: research:src/commands/session.ts:1196-1206 closeSession (session.limit), :1255-1259 · src/core/session.ts:248-262 · runners/runner.ts:226 looksLikeLimit · cs.json ui.run.stop.limit, ui.run.stop.resets · 1.34.0: research:8f24e9f7 src/commands/session.ts:1453-1483 (gateHolds && gate, limitResume, limitReserve, DEFAULT_WAIT_MS 15 min, until → time, markPaused), :1363 metrics.limit, src/core/planlimit.ts limitResume, timeOf, LIMIT_RESERVE_MS 60 s, FURTHEST_MS · 03146702 (B8: „You've hit your limit“, odmítnutý rate_limit_event) · cs.json ui.run.limit.wait, ui.run.limit.unknown, ui.run.limit.why, ui.run.limit.five_hour, ui.run.limit.seven_day · dirigent:prace/1115-vyzkum-k036-limit-obnova -->

<a id="R7.7"></a>
## R7.7 Ein nicht angemeldeter Agent

Ein Agent, der nicht bei seinem Abonnement angemeldet ist, führt keine Sitzung aus. Der Lauf endet: **der Agent ist
nicht angemeldet – einmal … starten und anmelden**.

- **Grenzen:**
  - vor der ersten Sitzung prüft strom das bei Claude Code: bis Forschung 1.33.0 nur mit einem eigenen Ordner
    (`agent.claudeConfigDir` oder `CLAUDE_CONFIG_DIR`, ein anderer als `~/.claude`), seit 1.34.0 auch mit dem
    Standardordner. Der Lauf endet dann ohne Sitzung und ohne Frage an die Bedingung;
  - sonst erkennt es die Bedingung `claude-usage` (sie hält an; bei einem Lauf von Hand kommt **Trotzdem starten?**,
    [R7.4.1](#R7.4.1)), oder eine Sitzung, die mit einem Fehler der Anmeldung endet.
- **Gilt seit:** Forschung 1.25.2; das Anhalten nach einer Sitzung mit einem Fehler der Anmeldung seit 1.0.0
- **Ab Forschung 1.34.0:** Claude Code im Terminal, das strom selbst startet (selbstständiges Arbeiten, die Leser von
  Scans und Dokumenten, [R8.3](R8-reading-scans.md#R8.3)), hat eine eigene Anmeldung, nicht die der Claude-App. Wenn
  `claude auth status` sagt, dass es nicht angemeldet ist:
  - `strom read` und das übrige Lesen durch Leser (Ausschnitte, Abschriften, ein Dokument aus der App) starten keinen
    Leser und enden sofort: **Claude Code im Terminal ist nicht angemeldet – … startet es selbst (nicht die
    Claude-App, die ihre eigene Anmeldung hat)**, mit dem Hinweis **einmal im Terminal anmelden: …, dann /login**;
  - ein Leser, der mit einem Fehler der Anmeldung endet, sagt das mit der Anleitung zur Anmeldung, im Verlauf und in
    der Zusammenfassung, nie nur „auth“;
  - `strom doctor` hat eine eigene Zeile **Anmeldung Claude Code**: **Claude Code im Terminal angemeldet** oder die
    Warnung **Claude Code im Terminal ist nicht angemeldet – …** mit der Behebung **… im Terminal, dann /login**. In
    einem Strom-Archiv wird die Anmeldung weder geprüft noch gesagt.

  Eine Antwort, aus der die Anmeldung nicht hervorgeht, entscheidet nichts. Terminal: `claude`, dann `/login`;
  `strom doctor`.
- **Ab Forschung 1.35.0:** eine Anmeldeprüfung, die nicht innerhalb von 5 s antwortet, entscheidet nichts und beendet
  alles, was sie gestartet hat, auch unter Windows, wo das Programm des Agenten früher weiterlaufen konnte.

<!-- zdroj: research:src/commands/session.ts:916 loggedOut, :1260-1264 auth · src/core/claudedir.ts claudeConfigSet :33, forClaude, claudeLoggedIn :91 · gate.ts:253-258 loggedIn · CHANGELOG.cs.md 1.25.2 · 1.34.0 (K040): src/core/agentcli.ts requireClaudeLogin, agentLoggedOut (agent.logged-out) · src/commands/readers.ts refuseReadersLoggedOut, readerAuthSaid · src/commands/read.ts · src/commands/session.ts loggedOut bez claudeConfigSet · src/commands/setup.ts doctor login (ne v archivu) · assets/lang/*.json ui.read.auth, ui.doc.login*, ui.error.agent.logged-out* · CHANGELOG 1.34.0 · 1.35.0: research:bb79ee54 src/core/claudedir.ts AUTH_STATUS_MS 5000, claudeLoggedIn přes src/core/runsync.ts runSync (win32 taskkill /T /F, jinde skupina procesů) · CHANGELOG.cs.md 1.35.0 „Windows: po kontrole přihlášení nic neběží dál“ -->

<a id="R7.8"></a>
## R7.8 Strom-Archiv: eine Forschung, an der kein Agent arbeitet

Eine Forschung kann nur ein **Strom-Archiv** sein: die Daten werden in der Strom-App eingegeben, und die Forschung hält
sie mit Quellen, Originalen und Historie. Kein Agent arbeitet daran, und nichts wird erforscht. Das Archiv schaltet nur
der Mensch ein und aus, in beide Richtungen; dabei wird nichts gelöscht.

- **Prüft der Code:**
  - die Arbeit des Agenten wird im Archiv abgelehnt: Chat (`strom chat`), Arbeit allein, neue Linie, Durchsicht einer
    Person, Lesen von Scans (`strom read`, `strom clips`, `strom transcripts`), Lesen eines Dokuments, Bestimmung von
    Orten. Die Ablehnung sagt in einem Satz, wo die Forschung eingeschaltet wird;
  - das Umschalten auf das Archiv stellt offene, begonnene und wartende Aufgaben zurück, mit dem Grund
    „zurückgestellt: die Forschung ist ein Strom-Archiv“. Eine neue Aufgabe im Archiv wartet zurückgestellt. Nach dem
    Einschalten der Forschung kehren die Aufgaben dorthin zurück, wo sie waren: in die Warteschlange oder zurück zum
    Warten auf den Menschen;
  - auf das Archiv lässt sich nicht umschalten, solange jemand an der Forschung arbeitet. Die Sitzung wird zuerst
    abgeschlossen;
  - das Einschalten der Forschung ohne Agenten auf dem Computer bietet an, einen Agenten zu installieren. Ohne Agenten
    bleibt das Archiv, wie es war;
  - das Umschalten bestätigt der Mensch; der Agent tut es nicht.
- Was die App an das Archiv sendet, wird erfasst, wie es kommt: [S2.4](S2-edits-from-the-app.md#S2.4). Wie die App
  das Archiv zeigt: [S1.3](S1-connecting-app-and-research.md#S1.3).
- **Warum:** das Archiv ist für einen Stammbaum ohne KI-Agenten: die Daten aus der App haben ihre Historie, Quellen und
  eine Sicherung (`strom pack`), und für das Lesen wird nichts bezahlt (Code, CHANGELOG 1.20.0).
- **Bedienung:** Terminal: Menü der Forschung, erster Punkt; `strom mode` (zeigt es an), `strom mode archive`,
  `strom mode research`. Bei neuen Forschungen fragt `strom setup` (**Was soll eine neue Forschung auf diesem Computer
  sein?**); geändert wird das über **Einstellungen → Neue Forschungen: Forschung oder nur ein Strom-Archiv**.
- **Gilt seit:** Forschung 1.12.0; Wahl für neue Forschungen auch mit einem Agenten auf dem Computer 1.15.0;
  abgelehntes Lesen von Scans 1.20.0

<!-- zdroj: research:src/core/mode.ts (hlavička, switchMode, holdForArchive, heldInArchive) · research:src/core/state.ts refuseInArchive · research:src/commands/trees.ts strom mode (liveWorkers, agentReady, requireHuman "mode") · refuseInArchive v session.ts:805 (run), start.ts (chat), research.ts (research new, review), document.ts, placeid.ts, calibrate.ts · cs.json archive.held, ui.mode.*, ui.archive.refuse · CHANGELOG 1.15.0, 1.20.0 · switchMode od v1.12.0 -->

<a id="R7.8.1"></a>
### R7.8.1 Eine Forschung wartet auf einen Agenten

Eine Forschung, deren Agent auf diesem Computer nicht ist (nicht installiert, oder die Forschung wurde von einem
anderen Computer übertragen), wartet auf ihn. Bis dahin verhält sie sich wie ein Strom-Archiv.

- **Prüft der Code:**
  - was die App sendet, wird wie im Archiv erfasst; der Agent bekommt nichts, und die Arbeit des Agenten wird
    mit einem Satz abgelehnt, dass die Forschung auf einen Agenten wartet und wo er installiert oder ein anderer
    gewählt wird;
  - der gespeicherte Modus ändert sich nicht, und die Aufgaben, die die Forschung hatte, werden nicht zurückgestellt. Nach der Installation des
    Agenten macht die Forschung von selbst mit den Aufgaben weiter, die sie hatte;
  - ein Agent, der gerade in der Forschung arbeitet (auch ein anderer als der eingestellte), macht sie zur Forschung.
- **Warum:** ein Archiv ist die Wahl des Menschen, und strom erfasst sie nicht für ihn. Eine Forschung ohne Agenten
  verhält sich nur wie ein Archiv, deshalb macht sie nach der Installation des Agenten von selbst mit den Aufgaben
  weiter, die sie hatte.
- **Bedienung:** Terminal: Menü, erster Punkt (**Nur als Strom-Archiv behalten: die Daten aus der Strom-App
  speichern** oder die Installation des Agenten); `strom mode` zeigt den Zustand. Die App zeigt eine solche Forschung
  als **Archiv** ([S1.3](S1-connecting-app-and-research.md#S1.3)).
- **Gilt seit:** Forschung 1.15.0; 1.35.0: neue Aufgaben zurückgestellt
- **Ab Forschung 1.35.0:** eine Aufgabe, die inzwischen kommt (zu gesendetem Material, ein Scan zum Lesen), entsteht
  zurückgestellt wie im Archiv. In die Warteschlange kehrt sie zurück, sobald ein Agent an der Forschung zu arbeiten
  beginnt (Beginn einer Sitzung, `strom run`, Chat; auch ein anderer als der eingestellte), oder wenn der eingestellte
  Agent wieder auf dem Computer ist.

<!-- zdroj: research:src/core/state.ts (hlavička, stateOf, actsAsArchive, kindOf, refuseInArchive agent.missing) · cs.json ui.mode.is.waiting, ui.waiting.refuse, ui.menu.keeparchive · CHANGELOG 1.15.0 · 1.35.0: research:31def74a src/core/state.ts heldWhereNobody (parked, heldBy archive, waiting.held), settleWaiting (atWork: session start, run, chat; jinak stateOf research) · src/core/records.ts create · CHANGELOG.cs.md 1.35.0 „Rodinný materiál … odložený, dokud tu agent není“ -->

<a id="R7.9"></a>
## R7.9 Eine Aufgabe hält die Sitzung, die an ihr arbeitet

An einer Forschung können mehrere Agenten zugleich arbeiten: die Arbeit allein (`strom run`), ein Gespräch (`strom
chat`), ein Agent, der `strom` direkt in seinem Terminal aufruft, und auch ein anderer Computer mit derselben
Forschung. Eine Aufgabe hat immer nur einen, der an ihr arbeitet: Die offene Sitzung hält sie, solange deren Agent ein
Lebenszeichen gibt. Eine verlassene Aufgabe wird von selbst frei.

- **Prüft der Code:**
  - die Wahl einer Aufgabe und ihre Belegung geschehen in einem Schritt. Wollen zwei dieselbe Aufgabe, bekommt sie
    einer; der andere nimmt die nächste freie. Das gilt für `strom run`, `strom chat`, `strom session start`, `strom
    task start`, einen Link aus der Strom-App und einen Agenten, der direkt arbeitet;
  - Lebenszeichen: der Prozess eines Laufs oder Gesprächs, den strom gestartet hat, auf diesem Computer; sonst jeder
    Befehl `strom` dieser Sitzung. Einen Agenten, der direkt arbeitet, erkennt die Forschung an der Nummer seines
    Gesprächs (Claude Code, Codex…): zwei solche Agenten haben je eine eigene Sitzung;
  - ohne Lebenszeichen länger als `task.hold` (Standard 30 Min.) verfällt das Halten. Ist der Prozess des Halters auf
    diesem Computer beendet, verfällt es sofort;
  - eine verfallene Sitzung übernimmt nur ein Interessent. Die alte Sitzung wird als unterbrochen geschlossen, mit der
    Notiz „übernommen nach N Minuten ohne Lebenszeichen; begonnene Arbeit in N…“; was darin geschrieben wurde, bleibt,
    und die Aufgabe geht in die Warteschlange zurück;
  - ein alter Halter, der nach der Übernahme aufwacht (Computer im Ruhezustand, angehaltener Prozess), schreibt nichts
    mehr: ein schreibender Befehl wird abgelehnt und sagt, welche Sitzung die Aufgabe wann übernommen hat. Lesen darf
    er weiter. `strom task done` und andere Einträge zu einer Aufgabe, die eine andere Sitzung hält, werden abgelehnt;
  - wer eine Aufgabe will, die eine andere Sitzung hält, bekommt einen Satz: „T12 hält Claude Code (Sitzung N0040)
    seit 14:05, zuletzt 14:31; frei spätestens um 15:01.“ Hält sie ein lebender Prozess auf diesem Computer, steht
    statt der Uhrzeit „frei, sobald es endet“. `strom run` nimmt die nächste freie Aufgabe, `strom session start T…`
    wird abgelehnt, mit dem Angebot der nächsten (`strom task next`). Auf das Freiwerden wird nicht gewartet;
  - `strom run` übernimmt verfallene Sitzungen am Anfang jeder Sitzung und lässt Aufgaben aus, die eine andere Sitzung
    hält („T12 ausgelassen: ein anderer Agent arbeitet daran“).
- **Nur Methodik:** ein Agent, der direkt arbeitet, gibt mindestens alle 20 Minuten einen Befehl `strom`; ein langes
  Lesen von Scans ohne ihn würde die Aufgabe freigeben.
- **Grenzen:**
  - die Zeit stammt vom selben Computer; bei einer Forschung auf einem gemeinsamen Laufwerk von einem anderen Computer
    entscheidet nur das letzte Lebenszeichen. Bei verstellten Uhren hält eine Reservierung eher länger, doppelt wird
    sie nie;
  - ein älteres strom neben diesem hält keine Aufgaben: seine Sitzungen beurteilt das neue strom nach seinem Lauf und
    nach dem letzten Eintrag, sonst ab dem Beginn der Sitzung;
  - nichts davon steht in den Daten der Forschung; das Halten ist nur ein lokaler Zustand neben der Forschung.
- **In der App:** wer eine Aufgabe hält und bis wann, zeigt die Forschungsübersicht
  ([S4.1](S4-research-from-the-app.md#S4.1), [S4.2](S4-research-from-the-app.md#S4.2)).
- **Bedienung:** Terminal: `strom config set task.hold <Minuten>` (z. B. `45m`, `2h`; 5 Min. bis 24 Std., gilt für
  diesen Computer, nicht für eine Forschung), `strom task next`; das Menü zeigt in der Zeile über die Arbeit auch
  Agenten, die direkt arbeiten („Gerade arbeitet ein Agent direkt in der Forschung.“).
- **Gilt seit:** Forschung 1.36.0

<!-- zdroj: research:1e58aa7b, f08b6574, 23b20c27 src/core/holds.ts (Hold by run|chat|agent, agentSession, BEAT_MS 60 s, holdAlive: proces tady mrtvý → hned, jinak lastSign < task.hold; lastSign max(beat, mtime), budoucnost jako teď; sessionLife: bez holdu worker, run.lock, ops logy, jinak start) · src/core/session.ts claimTask, takeOver (session.taken: „převzato po … bez známky života; rozdělaná práce v …“), :574 session.taken · src/core/errors.ts:122 task.held, task.held.here · src/commands/session.ts:217-225 (session start: sign of life, at least once every 20 minutes, task.held), :985-997 (run: vynechá držené, převzetí na začátku sezení) · src/brief/brief.ts:1668, src/commands/guide.ts:152 (aspoň jednou za 20 minut) · src/core/config.ts:242-246, :335 task.hold (tree: false, 5 min–24 h, výchozí 30) · ověřeno: strom config set task.hold 3 / 25h / --for-tree odmítnuto (izolovaně) · cs.json ui.error.task.held(.here), ui.error.session.taken, ui.run.skip.held, ui.menu.working.direct(.more), session.taken · CHANGELOG.cs.md 1.36.0 „Více agentů a výzkumů najednou“ · dirigent:spec/127 K1.1–K1.5, K5.1–K5.3, navrh-rezervace.md kap. 1–4, 6 -->

<a id="R7.10"></a>
## R7.10 Lauf einer Linie: jede Linie kann einen eigenen Lauf haben

Das Arbeiten allein ([R7.1](#R7.1)) lässt sich für eine Linie starten (`strom run --research G…`). Jede Linie hat
höchstens einen Lauf. Die Läufe verschiedener Linien und der Lauf der ganzen Warteschlange arbeiten nebeneinander,
jeder an anderen Aufgaben.

- **Prüft der Code:**
  - der Lauf einer Linie hält seine Linie, solange sein Prozess lebt. Ein zweiter Lauf derselben Linie wird sofort
    mit einem Satz abgelehnt: „Die Linie Vorfahren von Jan Horák hat schon einen Lauf (seit 14:05) – eine Linie, ein
    Lauf. Er lässt sich in seinem Fenster anhalten.“;
  - der Lauf einer Linie nimmt die Aufgaben, deren Hauptlinie seine ist. Die Hauptlinie einer Aufgabe ist ihre eigene
    Linie, und wenn diese beendet ist, die engste aktive Linie ihrer Personen ([R2.1.3](R2-lines-and-queue.md#R2.1.3)).
    Er nimmt auch gemeinsame Aufgaben (ein gemeinsamer Vorfahre, Hilfe für eine andere Linie,
    [R2.3](R2-lines-and-queue.md#R2.3)), deren Hauptlinie keinen eigenen Lauf hat. Eine Aufgabe, deren Hauptlinie ein
    anderer Lauf hält, nimmt er nie;
  - der Lauf der ganzen Warteschlange lässt jede Aufgabe einer Linie mit eigenem Lauf aus, und auch eine gemeinsame
    Aufgabe, deren Personen zu einer solchen Linie gehören. Die Arbeit außerhalb der Linien, die Ortsgeschichte und
    die Orte bleiben bei ihm;
  - das wird bei jeder Wahl einer Aufgabe beurteilt, bevor die Aufgabe beansprucht wird ([R7.9](#R7.9)). Eine Aufgabe,
    an der schon eine andere Sitzung arbeitet, wird nicht übernommen: die laufende Sitzung schließt sie ab;
  - Gespräche (`strom chat`) halten keine Linie und zählen nicht zu den Läufen ([R7.10.1](#R7.10.1));
  - der Lauf einer Linie startet nicht neben einem Lauf eines strom älter als 1.25. Neben einem Lauf eines neueren
    strom, der keine Linien kennt, startet er und sagt das: jener kann auch Aufgaben dieser Linie nehmen, nie aber
    die, an der gerade gearbeitet wird.
- **Grenzen:**
  - der Lauf einer Linie hat ein eigenes Terminalfenster mit dem Titel „Strom · Horák · Vorfahren von Jan Horák
    (G0002)“; der Agent benennt seine Sitzung nach der Linie. Inzwischen lässt sich aus dem Menü der Lauf einer
    anderen Linie starten;
  - das Fenster derselben Linie öffnet sich nicht gleich nach dem ersten noch einmal („Ein Fenster für die Linie …
    wurde gerade geöffnet – der Lauf geht dort weiter.“);
  - nur eine aktive Linie: weder eine pausierte noch eine beendete Linie bekommt einen Lauf
    ([R2.1.2](R2-lines-and-queue.md#R2.1.2));
  - die Forschung merkt sich den Agenten, mit dem die Linie zuletzt lief, und bietet ihn beim nächsten Mal im Menü
    und in der App an;
  - die Warnung bei einem Lauf neben einem anderen Lauf sagt, dass sich der Verbrauch des Abonnements addiert.
- **In der App:** **Agent auf diese Richtung ansetzen** ([S4.3.3](S4-research-from-the-app.md#S4.3.3)); Läufe im
  Bereich **Jetzt** ([S4.1.8](S4-research-from-the-app.md#S4.1.8)).
- **Bedienung:** Terminal: Menü **Den Agenten allein arbeiten lassen**; bei zwei und mehr aktiven Linien fragt es
  **Woran arbeiten?**: **die ganze Warteschlange (Linien mit eigenem Lauf ausgenommen)** oder eine Linie („– in einem
  eigenen Fenster“; eine Linie mit Lauf „– hat schon einen Lauf“ und startet nicht). Befehl `strom run --research G…`
  (mit den übrigen Optionen aus [R7.1](#R7.1)); die Nummern der Linien zeigt `strom research list`.
- **Gilt seit:** Forschung 1.36.0

<!-- zdroj: research:089875ec src/core/linerun.ts (lineHolds .strom/lines/<G>.json zámek s procesem, run.line.held, run.line.older pro strom před 1.25, lineRunFilter: obecný běh vynechá úkol s linií drženou jiným během; běh linie bere hlavní linii G nebo úkoly v G, jejichž hlavní linii nedrží jiný běh; linie úkolu = vlastní + hlavní (placer core/offline.ts) + linie jeho lidí; mimo linie, dějiny, místa žádnou; rememberLineAgent) · src/cli/menu.ts runMenu (ui.run.where, ui.run.whole, ui.run.line.item/busy/held, openInNewTerminal title Strom · strom · linie (G…), key linie, ui.run.window, ui.run.window.recent; dějiny jen celá fronta) · src/commands/session.ts:1107 enterRun (research, agent) · cs.json ui.run.line, ui.run.line.older, ui.run.beside, ui.run.others · help run (Runs of lines) · CHANGELOG.cs.md 1.36.0 · dirigent:spec/126 U11, prace/1121-research-126-linie-b1 -->

<a id="R7.10.1"></a>
### R7.10.1 Höchstens so viele Läufe gleichzeitig: `run.parallel`

In einem Stammbaum arbeiten höchstens `run.parallel` Läufe gleichzeitig (Standard 3, 1–10): der Lauf der ganzen
Warteschlange und die Läufe der Linien zusammen. Gespräche zählen nicht.

- **Prüft der Code:**
  - gezählt wird beim Start eines Laufs, unter einer kurzen Sperre der Linien des Stammbaums. Ein Lauf über das Limit
    wird abgelehnt und sagt, welche Läufe arbeiten und wie man sie anhält;
  - erhöhen darf den Wert nur ein Mensch: `strom config set run.parallel <n>` fragt „Bis zu N Läufe des Agenten
    gleichzeitig in einem Stammbaum erlauben (jetzt M)? Jeder Lauf verbraucht das Abo des Agenten – der Verbrauch
    addiert sich.“ Der Agent erhöht den Wert nicht. Senken darf ihn jeder, auch die App
    ([S4.4.12](S4-research-from-the-app.md#S4.4.12));
  - ein Senken unter die Zahl der laufenden Läufe hält keinen an; ein neuer Lauf startet, sobald es weniger sind.
- **Grenzen:** die Einstellung gilt für diesen Computer, nicht für einen Stammbaum.
- **Bedienung:** Terminal: `strom config set run.parallel <n>`, zurück mit `strom config unset run.parallel`.
- **Gilt seit:** Forschung 1.36.0

<!-- zdroj: research:089875ec src/core/linerun.ts (run.parallel, hint strom config set run.parallel <n>, rozhovory se nepočítají) · src/core/config.ts run.parallel (tree: false, DEFAULT_RUN_PARALLEL 3, RUN_PARALLEL_MAX 10, „only you raise it“) · src/commands/setup.ts runsDecision (requireHuman jen při zvýšení), cs.json ui.consent.runParallel · src/core/live.ts runsLimitWrite (POST settings/runs: snížení, zvýšení 403 runs.raise s příkazem, mimo 1–10 400 runs.max) · src/core/liveruns.ts runLimits · help run -->

<a id="R7.10.2"></a>
### R7.10.2 Einen Lauf anhalten

Jeder Lauf lässt sich einzeln anhalten; die übrigen Läufe arbeiten weiter. Das Anhalten unterbricht nichts mit
Gewalt.

- **Grenzen:**
  - `strom run stop <run-…>`: die laufende Sitzung schließt ihre Aufgabe ab, und keine weitere startet. Mit
    `--finish` wird die laufende Sitzung zusätzlich gebeten, sofort abzuschließen: der Agent schreibt auf, was er
    gefunden hat, und schließt die Sitzung wie `strom session finish` ([R7.3](#R7.3));
  - ein Lauf, der wartet (auf die Bedingung, das Limit des Abonnements oder ein Archiv), endet sofort;
  - der Lauf liest die Bitte innerhalb von ein, zwei Sekunden und sagt das in seinem Terminal. Strg-C im Fenster des
    Laufs hält nur diesen Lauf an;
  - die Nummer eines Laufs (`run-…`) nennt die Ablehnung eines Laufs über das Limit ([R7.10.1](#R7.10.1)) und
    `strom session list --open`;
  - nach dem Ende des Laufs einer Linie nimmt ihre Aufgaben wieder der Lauf der ganzen Warteschlange.
- **In der App:** **Stoppen** und **Abschließen und beenden** im Block des Laufs
  ([S4.1.8](S4-research-from-the-app.md#S4.1.8)).
- **Bedienung:** Terminal: `strom run stop <run-…> [--finish]`, Strg-C im Fenster des Laufs.
- **Gilt seit:** Forschung 1.36.0

<!-- zdroj: research:src/commands/session.ts run stop (help: the task at work is finished, no next one starts; --finish; a run that waits ends at once; read within a second or two) · src/core/live.ts POST runs/stop · src/commands/links.ts finish?run= finishRun (strom run stop <run> --finish) · STOP_HINT src/core/linerun.ts · help run stop -->

<a id="R7.10.3"></a>
### R7.10.3 Was sich die Läufe auf einem Computer teilen

Läufe auf einem Computer (alle Forschungen mit demselben gemeinsamen Ordner) teilen sich das Limit des Abonnements des
Agenten, die Fragen an die Bedingung, die Anfragen an Websites und die Leser von Scans.

- **Prüft der Code:**
  - ein Limit des Abonnements, auf das ein Lauf stößt ([R7.6](#R7.6)), gilt für alle Läufe desselben Agenten (und
    Kontos) auf dem Computer: keine neue Sitzung startet, bis sich das Limit erneuert. Ein Lauf unter einer Bedingung
    mit `--loop` oder `--until` wartet, jeder andere endet (**Limit des Abonnements**). Eine laufende Sitzung macht
    weiter;
  - die Läufe fragen ihre Bedingungen ([R7.4](#R7.4)) nacheinander: die nächste erst, nachdem die Sitzung, die die
    Bedingung durchgelassen hat, gestartet ist;
  - die Seiten einer Website, die die Agenten öffnen, zählen für `web.perHost` ([R9.3](R9-archives.md#R9.3)) aus allen
    Sitzungen auf dem Computer in den letzten `run.minutes`;
  - auf dem ganzen Computer lesen höchstens `read.parallel` Leser gleichzeitig Scans
    ([R8.3.1](R8-reading-scans.md#R8.3.1)).
- **Gilt seit:** Forschung 1.36.0

<!-- zdroj: research:src/core/machine.ts (limit-<agent>.json ve sdílené složce agents/, brána po jednom, sloty čtenářů) · src/core/web.ts web.perHost za run.minutes ze všech sezení · src/core/config.ts read.parallel, web.perHost (počítáno na počítač) · help run (What runs share on this computer) · CHANGELOG.cs.md 1.36.0 · dirigent:spec/126 U8 -->

<a id="R7.10.4"></a>
### R7.10.4 Lauf einer Linie über einen Link der App Strom

- Der Link `strom-research://work` mit `research=G…` (und gegebenenfalls `agent=…`) bittet um den Lauf einer Linie.
  Das Terminal der Forschung öffnet ihn in einem neuen Fenster mit dem Namen der Linie, sagt „Lauf der Linie …: nur
  ihre Aufgaben – eine andere Linie kann daneben einen eigenen Lauf haben.“, den Agenten und die ersten 5 Aufgaben
  der Linie und startet `strom run --research G…` mit `--tasks N` oder `--loop` wie in [R7.1.2](#R7.1.2).
- **Grenzen:**
  - nichts startet, wenn die Linie nicht in der Forschung ist oder pausiert oder beendet ist, wenn das Programm des
    gewählten Agenten nicht auf dem Computer ist, wenn die Linie schon einen Lauf hat, wenn an der Forschung ein Lauf
    eines strom älter als 1.25 arbeitet, oder bei voller Zahl der Läufe („Es arbeiten schon so viele Läufe
    gleichzeitig wie erlaubt (3 von 3, Einstellung run.parallel). Nichts weiter wurde gestartet.“);
  - die Bestätigung richtet sich nach der Einstellung **Agent aus der Strom-App starten**
    ([S4.5.5](S4-research-from-the-app.md#S4.5.5));
  - ein Link für die ganze Warteschlange wird neben einem Lauf der ganzen Warteschlange oder einer Sitzung außerhalb
    der Läufe der Linien weiterhin abgelehnt. Die Läufe der Linien zählen für ihn nur in `run.parallel`; die
    Warteschlange, die er zeigt, hat keine Aufgaben der Linien mit eigenem Lauf;
  - `strom-research://finish` mit `run=run-…` bittet den Lauf abzuschließen und zu enden wie
    `strom run stop <run-…> --finish` ([R7.10.2](#R7.10.2)).
- **Bedienung:** die App ([S4.3.3](S4-research-from-the-app.md#S4.3.3)); Terminal: `strom link open "<Link>"`.
- **Gilt seit:** Forschung 1.36.0

<!-- zdroj: research:src/cli/menu-links.ts workRun byLine (ui.link.direction.none, ui.link.work.line.state, ui.link.work.agent, ui.link.work.older, ui.run.line.held, ui.link.work.cap; obecný odkaz: busy bez běhů linií, runRefusal max; lineRunFilter; ui.run.line, ui.link.work.agent.is; run --research [--agent] --tasks|--loop) · src/commands/links.ts lineWindow (titulek Strom · strom · linie (G…), klíč linie), finish run= → finishRun · src/core/links.ts work research=, agent= -->
