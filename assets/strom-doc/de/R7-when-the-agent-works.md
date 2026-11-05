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
  Aufgaben** (wie `--task`) und **Weiterarbeiten lassen, solange es Arbeit gibt und die Bedingung „{name}“ es
  erlaubt** (wie `--loop`, nur mit gesetzter Bedingung); Befehl `strom run`. Die Strom-App 3.21.2 stellt die Arbeit
  allein nicht ein; sie zeigt den Zustand des Laufs ([R7.4](#R7.4)), und eine Sitzung lässt sich aus ihr abschließen
  ([R7.3](#R7.3)).
- **Gilt seit:** Forschung 1.0.0 (`--max`, `--until`, `--task`), `--loop` seit 1.2.0

<!-- zdroj: research:src/commands/session.ts:737-783 (popis a volby run), :830 max, :694 parseUntil · src/cli/menu.ts:288-375 (v1.25.2) · cs.json ui.menu.run, ui.run.queue, ui.run.pick, ui.run.loop, ui.run.how -->

<a id="R7.1.1"></a>
### R7.1.1 Warum ein Lauf endet

- Am Ende gibt der Lauf **Sitzungen: {n} · Ende: {Grund}** aus: **fertig**, **keine offenen Aufgaben**,
  **Zeitlimit** (`--until`), **von Hand angehalten** ([R7.3](#R7.3)), **Limit des Abonnements** ([R7.6](#R7.6)),
  **der Agent ist nicht angemeldet** ([R7.7](#R7.7)), die Antwort der Bedingung ([R7.4](#R7.4)) oder ein Fehler
  (Belege, Versagen des Agenten, Modell).
- Wenn die übrigen Aufgaben ein Archiv brauchen, das nicht antwortet, wartet ein Lauf mit `--loop` und `--until`
  (**⏸ warte bis {at}**), ein anderer endet.
- **Gilt seit:** Forschung 1.0.0; das Warten auf ein Archiv, das nicht antwortet, seit 1.22.0

<!-- zdroj: research:src/commands/session.ts:853 Stop, :1220-1268, :1277-1285 · cs.json ui.run.summary, ui.run.stop.*, ui.run.asleep.wait · CHANGELOG.cs.md 1.22.0 -->

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
  - eine Aufgabe, bei der 2 Sitzungen nacheinander nichts erfasst haben, wird zurückgestellt (**{task} zurückgestellt**);
    vom Menschen beendete Sitzungen zählen nicht;
  - Reihenfolge: `--minutes` > Variable `STROM_RUN_MINUTES` > Einstellung des Stammbaums >
    Einstellung des Computers > 60.
- **Bedienung:** Terminal: **Einstellungen: Agent, allein arbeiten, Nachrichten, Archive, Wartung → Der Agent allein →
  Zeit für eine Aufgabe: {minutes} Min.** (5–600; 0 kehrt ohne Änderung zurück); `strom config set run.minutes <n>`
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
    `plugins/gates/<název>/`;
  - ein Lauf ohne gesetzte Bedingung (`--no-gate`) oder mit einer anderen (`--gate`) braucht die Zustimmung des
    Menschen.
- **Bedienung:** Terminal: **Einstellungen → Der Agent allein → Immer weiter unter einer Bedingung: {gate}** (eine
  Bedingung oder **keine**); `strom config set run.gate "<název> [co jí předat]"`, `strom config unset run.gate`;
  beides bestätigt der Mensch. App: die **Forschungsübersicht** zeigt bei einem wartenden Lauf **Pausiert** und
  **weiter um {t}**.
- **Gilt seit:** Forschung 1.2.0, App 3.5.0 (Zustand Pausiert)

<!-- zdroj: research:src/core/gate.ts:27-34 DEFAULT_TIMEOUT_S, DEFAULT_WAIT_MS, MIN_WAIT_MS, askGate :209-254, SHIPPED :124 · session.ts:911 gateHolds, :1038-1063 wait, markPaused, runGate :1357-1380 · config.ts run.gate tree:false · setup.ts:1537-1548 · app:v3.21.2 research-overview-ui.ts:340-347, strings.ts live.statePaused, live.pausedUntil -->

<a id="R7.4.1"></a>
### R7.4.1 Von Hand gestartete Aufgaben: „Trotzdem starten?“

- Eine Sitzung, `--max`, `--task` und das Menü sind eine Wahl des Menschen. Die Bedingung wird einmal gefragt, vor
  der ersten Sitzung. Würde sie nicht starten (warten, anhalten, Fehler), kommt die Frage **Die Bedingung „{name}“
  würde jetzt nicht starten — {reason}. Trotzdem starten?** Enter bedeutet nein: der Lauf endet (**nicht gestartet —
  die Bedingung „{name}“: {reason}**). Ja: die Sitzungen beginnen, und die Bedingung wird nicht mehr gefragt, außer
  bei der Obergrenze ([R7.4.2](#R7.4.2)).
- Startet den Lauf der Agent, antwortet der Mensch in einem Systemfenster. Ein Skript, das niemand fragen kann, hält
  sich an die Bedingung.
- **Gilt seit:** Forschung 1.2.0

<!-- zdroj: research:src/commands/session.ts:1027-1037, startAnyway :1400-1411 · cs.json ui.run.gate.once, ui.run.gate.anyway, ui.run.stop.gate.declined -->

<a id="R7.4.2"></a>
### R7.4.2 Obergrenze: eine feste Grenze

- Die Bedingung kann eine Antwort als feste Grenze des Menschen kennzeichnen (`hard`). Der Lauf endet dann (**die
  Obergrenze der Bedingung „{name}“**), und kein „trotzdem“ überschreitet sie.
- Die Bedingung kann das Fenster des Plans des Agenten überwachen (`watch`). Dann fragt sie vor jeder Sitzung jedes
  Laufs, und eine Sitzung in Arbeit bekommt die Bitte um Abschluss ([R7.3](#R7.3)), wenn der Agent eine Nutzung des
  Fensters an der angegebenen Grenze meldet.
- **Gilt seit:** Forschung 1.14.0

<!-- zdroj: research:src/core/gate.ts:64-71 hard, watch, parseSaid :330-348 · session.ts:1012-1026, onLimits :1175-1182 · cs.json ui.run.gate.cap, ui.run.cap.finish, ui.run.stop.gate.cap -->

<a id="R7.4.3"></a>
### R7.4.3 Aufzeichnung der Antworten der Bedingung

- Jede Antwort hat eine Zeile in der Ausgabe des Laufs: **· Bedingung {name}: {word}{reason} (Code {status};
  .strom/gate.log)**.
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
Lauf endet: **Limit des Abonnements (erneuert sich {at})**. Der Lauf wartet nicht, auch nicht mit `--loop`. Das hängt
nicht von der Bedingung ab.

- **Grenzen:** die Aufgabe kehrt in die Warteschlange zurück; die Zeit der Erneuerung erscheint nur, wenn der Agent
  sie genannt hat. Warten kann nur die Bedingung.
- **Gilt seit:** Forschung 1.0.0

<!-- zdroj: research:src/commands/session.ts:1196-1206 closeSession (session.limit), :1255-1259 · src/core/session.ts:248-262 · runners/runner.ts:226 looksLikeLimit · cs.json ui.run.stop.limit, ui.run.stop.resets -->

<a id="R7.7"></a>
## R7.7 Ein nicht angemeldeter Agent

Ein Agent, der nicht bei seinem Abonnement angemeldet ist, führt keine Sitzung aus. Der Lauf endet: **der Agent ist
nicht angemeldet – einmal {command} starten und anmelden**.

- **Grenzen:**
  - vor der ersten Sitzung prüft strom das nur bei Claude Code mit einem eigenen Ordner (`agent.claudeConfigDir` oder
    `CLAUDE_CONFIG_DIR`, ein anderer als `~/.claude`). Der Lauf endet dann ohne Sitzung und ohne Frage an die
    Bedingung;
  - sonst erkennt es die Bedingung `claude-usage` (sie hält an; bei einem Lauf von Hand kommt **Trotzdem starten?**,
    [R7.4.1](#R7.4.1)), oder eine Sitzung, die mit einem Fehler der Anmeldung endet.
- **Gilt seit:** Forschung 1.25.2; das Anhalten nach einer Sitzung mit einem Fehler der Anmeldung seit 1.0.0

<!-- zdroj: research:src/commands/session.ts:916 loggedOut, :1260-1264 auth · src/core/claudedir.ts claudeConfigSet :33, forClaude, claudeLoggedIn :91 · gate.ts:253-258 loggedIn · CHANGELOG.cs.md 1.25.2 -->

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
  - was die App sendet, wird wie im Archiv erfasst; für den Agenten entsteht nichts, und die Arbeit des Agenten wird
    mit einem Satz abgelehnt, dass die Forschung auf einen Agenten wartet und wo er installiert oder ein anderer
    gewählt wird;
  - der gespeicherte Modus ändert sich nicht, und die Aufgaben werden nicht zurückgestellt. Nach der Installation des
    Agenten macht die Forschung von selbst mit den Aufgaben weiter, die sie hatte;
  - ein Agent, der gerade in der Forschung arbeitet (auch ein anderer als der eingestellte), macht sie zur Forschung.
- **Bedienung:** Terminal: Menü, erster Punkt (**Nur als Strom-Archiv behalten: die Daten aus der Strom-App
  speichern** oder die Installation des Agenten); `strom mode` zeigt den Zustand. Die App zeigt eine solche Forschung
  als **Archiv** ([S1.3](S1-connecting-app-and-research.md#S1.3)).
- **Gilt seit:** Forschung 1.15.0

<!-- zdroj: research:src/core/state.ts (hlavička, stateOf, actsAsArchive, kindOf, refuseInArchive agent.missing) · cs.json ui.mode.is.waiting, ui.waiting.refuse, ui.menu.keeparchive · CHANGELOG 1.15.0 -->
