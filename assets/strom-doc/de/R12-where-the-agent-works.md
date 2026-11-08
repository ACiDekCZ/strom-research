<a id="R12"></a>
# R12 Wo der Agent arbeitet und was strom überwacht

Mit dem Agenten (Claude Code, Codex, Antigravity, Grok Build, OpenCode) wird im Terminal gesprochen oder in der
Desktop-App des Agenten, wenn strom sie öffnet; selbstständiges Arbeiten läuft ohne Gespräch. Danach unterscheidet sich, wo das Gespräch ist, welchen Browser der Agent nutzt, was strom überwacht, was
der Mensch tut und was ohne den Agenten im Terminal nicht geht. Die Regeln der Archive sind überall dieselben
([R9](R9-archives.md)); anders ist nur, wovor strom steht. Beschreibt die Forschung 1.29.0. Bei den Regeln wird
unterschieden, was **der Code prüft** (der Befehl `strom` oder der Hook des Agenten lehnt es ab) und was nur eine
**Regel der Methodik** ist. Was auf einem Mac nicht live geprüft ist, sagt [R12.6](#R12.6).

<!-- zdroj: dirigent:spec/062-hlidani-desktop-a-codex/spec.md K5.1, K5.2 · test/vysledek-desktop-chrome.md · test/vysledek-062-u4-desktop.md · test/vysledek-1106-vyzkum-062-desktop.md · research:CHANGELOG.de.md 1.29.0 · src/core/which.ts AGENTS -->

<a id="R12.1"></a>
## R12.1 Arten zu arbeiten: eine Tabelle

| Art zu arbeiten | Ort des Gesprächs | Browser des Agenten | Was strom überwacht | Schritt des Menschen | Ohne den Agenten im Terminal |
|---|---|---|---|---|---|
| Claude Code im Terminal | Terminal: Claude Code im Ordner der Forschung (`strom chat --where terminal`) | Chrome mit der Erweiterung Claude in Chrome ([R9.4.1](R9-archives.md#R9.4.1)) | Browser in Chrome ([R9.4](R9-archives.md#R9.4)), Webabruf ([R9.3](R9-archives.md#R9.3)), Befehle in der Kommandozeile des Agenten | Erlaubnis für ein Archiv ([R9.2](R9-archives.md#R9.2)) | – (Claude Code ist im Terminal) |
| App Claude (Tab Code) und Claude Code im Terminal | App Claude, Tab Code (`strom chat`) | Chrome mit Claude in Chrome oder der eingebaute Browser der App ([R12.2](#R12.2)) | Browser in Chrome und eingebauter Browser der App, Webabruf, Befehle in der Kommandozeile des Agenten und im Terminal der App ([R12.3](#R12.3)) | den Ordner bestätigen (Trust workspace) und die vorbereitete Nachricht senden; Erlaubnis für ein Archiv | nichts fehlt: selbstständiges Arbeiten und das Lesen von Scans laufen über Claude Code im Terminal |
| App Claude ohne Claude Code im Terminal | App Claude, Tab Code (`strom chat`) | wie in der Zeile darüber | wie in der Zeile darüber | wie in der Zeile darüber; eine Installation von Claude Code, die strom anbietet und die sich ablehnen lässt ([R12.4](#R12.4)) | selbstständiges Arbeiten (`strom run`), das Lesen von Scans durch die Leser (`strom read`) und Arbeit aus der Strom-App ([R12.4](#R12.4)) |
| Codex im Terminal | Terminal: Codex im Ordner der Forschung (`strom chat --where terminal`) | Browser, Chrome und Computersteuerung von Codex, wenn seine Einstellungen sie haben ([R12.5](#R12.5)) | Befehle `strom` nach den Regeln des Stammbaums für Codex; den Browser von Codex nach den Adressen in seinem Code, sobald der Mensch den Hook von strom bestätigt; nicht Computersteuerung und Websuche von Codex ([R12.5](#R12.5)) | dem Ordner der Forschung vertrauen (erst dann gelten die Regeln des Stammbaums) und den Hook von strom bestätigen (**Review hooks**, `/hooks`); Erlaubnis für ein Archiv | – (Codex ist im Terminal) |
| App ChatGPT (Codex) | App ChatGPT (`strom chat`) | wie bei Codex im Terminal: dieselben Einstellungen ([R12.5](#R12.5)) | wie bei Codex im Terminal ([R12.5](#R12.5)) | laut `strom chat` den Ordner bestätigen und die vorbereitete Nachricht senden (nicht geprüft, [R12.6](#R12.6)); den Hook von strom bestätigen (**Einstellungen › Hooks**); Erlaubnis für ein Archiv | selbstständiges Arbeiten, das Lesen von Scans durch die Leser und Arbeit aus der Strom-App ([R12.5](#R12.5)) |
| Antigravity im Terminal | Terminal: Antigravity (`agy`) im Ordner der Forschung (`strom chat`); die App Antigravity öffnet strom nicht ([R12.7](#R12.7)) | Browser von Antigravity, wenn der Agent einen hat; strom überwacht ihn nicht ([R12.7](#R12.7)) | nur, was `strom` selbst ablehnt: Befehle, die nur dem Menschen gehören; Antigravity hat keinen Hook und keine Regeln im Ordner der Forschung ([R12.7](#R12.7)) | Erlaubnis für ein Archiv | – (Antigravity ist im Terminal) |
| Grok Build im Terminal | Terminal: Grok (`grok`) im Ordner der Forschung (`strom chat`); eine App von Grok öffnet strom nicht ([R12.8](#R12.8)) | keiner, den strom überwachen würde ([R12.8](#R12.8)) | Webabruf ([R9.3](R9-archives.md#R9.3)) und Befehle in der Kommandozeile des Agenten: Hooks und Regeln von strom in `.grok/` ([R12.8](#R12.8)) | nichts weiter: `strom chat` startet Grok mit dem Ordner der Forschung als vertrauenswürdig; Erlaubnis für ein Archiv | – (Grok ist im Terminal) |
| OpenCode im Terminal | Terminal: OpenCode im Ordner der Forschung (`strom chat --where terminal`) | keiner, den strom überwachen würde ([R12.9](#R12.9)) | Befehle und Dateien nach den Regeln des Stammbaums in `opencode.json`; nicht Webabruf oder Browser ([R12.9](#R12.9)) | Befehle außer `strom` genehmigen, nach denen OpenCode fragt (außer auf der Stufe `full`); Erlaubnis für ein Archiv | – (OpenCode ist im Terminal) |
| App OpenCode | App OpenCode (`strom chat`) | wie bei OpenCode im Terminal | wie bei OpenCode im Terminal (nicht geprüft, [R12.6](#R12.6)) | laut `strom chat` den Ordner bestätigen und die vorbereitete Nachricht senden (nicht geprüft, [R12.6](#R12.6)); Erlaubnis für ein Archiv | selbstständiges Arbeiten, das Lesen von Scans durch die Leser und Arbeit aus der Strom-App ([R12.9](#R12.9)) |
| selbstständiger Lauf `strom run` | nirgends: der Agent arbeitet allein; den Verlauf zeigen das Terminal und die Strom-App ([S1.4](S1-connecting-app-and-research.md#S1.4)) | Claude Code: Chrome nach der Aufgabe ([R9.4.1](R9-archives.md#R9.4.1)); Codex: Browser und Computersteuerung abgeschaltet ([R12.5](#R12.5)); Grok: ohne die MCP-Server von Claude Code und Cursor ([R12.8](#R12.8)); Antigravity und OpenCode: strom ändert nichts | Claude Code und Grok: wie im Terminal; Codex: Befehle `strom`; Antigravity und OpenCode: was die Regeln nicht erlauben, wird abgelehnt, niemand wird gefragt ([R12.7](#R12.7), [R12.9](#R12.9)) | den Lauf starten; die Erlaubnis für ein Archiv vorher, beim Lauf ist niemand dabei ([R9.7](R9-archives.md#R9.7)) | der ganze Lauf: er endet, bevor eine Frage oder eine Kostenschätzung kommt ([R12.4](#R12.4)) |

- **Prüft der Code:**
  - die Hooks von strom in `.claude/settings.json` der Forschung führen Claude Code im Terminal und die App Claude
    (Tab Code) aus; Codex liest die Regeln des Stammbaums in `.codex/rules/strom.rules` und den Hook von strom in
    `.codex/hooks.json`, Grok Build in `.grok/config.toml` (und die Hooks von strom in `.grok/hooks/strom.json`),
    OpenCode in `opencode.json`;
    Antigravity liest nur die Anweisungen in `AGENTS.md`;
  - Befehle, die nur dem Menschen gehören (die Anmeldung, das Siegel, die Erlaubnis für ein Archiv und andere), lehnt
    `strom` selbst jedem Agenten ab, den es erkennt, bei allen fünf Agenten;
  - an den Apps der Agenten wird nichts abgeschaltet. Die einzige Ausnahme ist ein selbstständiger Lauf mit Codex ohne
    die persönlichen Erweiterungen des Agenten ([R12.5](#R12.5)).
- **Grenzen:** die Computersteuerung (Computer Use) überwacht strom bei keinem Agenten: der Agent steuert damit den
  Computer wie ein Mensch. Was die Computersteuerung in der Strom-App und in der Forschung kann und nicht kann, sagt
  [R12.10](#R12.10).
- **Nur Methodik:** in jeder Art zu arbeiten startet der Agent `strom` in seiner Kommandozeile und nutzt einen Browser,
  den strom nicht empfiehlt, nicht von sich aus ([R9.4.2](R9-archives.md#R9.4.2)).
- **Bedienung:** Terminal: `strom chat` (wo, sagt die Einstellung `agent.where`: `app` die App des Agenten,
  `terminal` das Terminal; ohne Einstellung die App, wenn sie installiert ist), `strom chat --where app|terminal`
  einmal anders, `strom agents use claude|codex|antigravity|grok|opencode`, `strom doctor` (Zeilen **Ort des Gesprächs**, **Agent im
  Terminal**, **Browser (Claude in Chrome)**, **Browser der Desktop-Apps**, **Hooks von Codex (Browser)**).
- **Gilt seit:** Forschung 1.29.0

<!-- zdroj: research:src/core/apps.ts DESKTOP_APPS (claude://code/new, codex://new; mac Claude.app, Codex.app, ChatGPT.app) · src/commands/start.ts:156-217 strom chat (where app|terminal, ui.chat.app.open) · src/core/config.ts:311 agent.where, :316 agent.addons · src/agents/files.ts codexRules · src/core/agentcli.ts · src/cli/main.ts:290 (def.person && isAgent) · src/core/which.ts detectAgent · assets/lang/de.json ui.doc.where, ui.doc.cli, ui.doc.browser, ui.doc.desktop · test/vysledek-desktop-chrome.md (Trust workspace, odkaz jen předvyplní zprávu) -->

<a id="R12.2"></a>
## R12.2 Der Browser in der App Claude

Die App Claude hat zwei Browser: Chrome mit der Erweiterung Claude in Chrome und ihren eigenen eingebauten Browser.
strom überwacht beide gleich.

- **Prüft der Code (Hook vor dem Öffnen einer Seite):**
  - der eingebaute Browser bekommt dieselben Regeln wie der Browser in Chrome ([R9.4](R9-archives.md#R9.4)): ein
    Archiv, das nur der Browser eines Menschen betreten darf, wird ohne die Erlaubnis **über den Browser** mit
    demselben Rat abgelehnt; ein erlaubtes wird aufgezeichnet und hält sein Tempo zusammen mit Chrome und dem
    Webabruf;
  - Werkzeuge auf einer Seite (Seite lesen, suchen, Skript) werden nach der Website geprüft, die in diesem Tab zuletzt
    geöffnet wurde. Die Tabs des eingebauten Browsers und von Chrome werden nicht verwechselt;
  - lokale Seiten (localhost, eine Datei auf dem Computer) werden nicht eingeschränkt. Die Brücke zur Strom-App wird
    immer abgelehnt.
- **Grenzen:** welchen Browser der Agent nutzt, bestimmt die App Claude: ihre Einstellung **Preferred browser** und ob
  die Erweiterung in Chrome verbunden ist. Mit Chrome als bevorzugtem Browser gehen Websites über Chrome. Die
  Computersteuerung der App Claude überwacht strom nicht: der Agent steuert damit den Computer wie ein Mensch.
- **Nur Methodik:** strom empfiehlt den eingebauten Browser nicht: der Agent nutzt ihn nicht von sich aus
  ([R9.4.2](R9-archives.md#R9.4.2)).
- **Warum:** die App Claude führt die Hooks der Forschung auch vor ihrem eingebauten Browser aus, also kann strom jede
  Adresse beurteilen wie bei Chrome.
- **Bedienung:** App Claude: Einstellung **Preferred browser**. Terminal: `strom doctor`, Zeile **Browser der
  Desktop-Apps** und beim Browser in Chrome **im Gespräch in der App Claude: ja; selbstständiges Arbeiten (strom run
  --chrome): nur mit Claude Code im Terminal**.
- **Gilt seit:** Forschung 1.29.0

<!-- zdroj: research:src/core/browser.ts (matcher mcp__(remote-devices__)?Claude_Browser__*) · src/core/chromehook.ts · src/core/webgate.ts browserGate · assets/lang/de.json ui.doc.desktop.unwatched, ui.doc.browser.apponly · CHANGELOG.de.md 1.29.0 · test/vysledek-062-u4-desktop.md kroky 1–3 · test/vysledek-1106-vyzkum-062-desktop.md bod 3 · test/vysledek-desktop-chrome.md bod 4, bod 6 -->

<a id="R12.3"></a>
## R12.3 Das Terminal der App Claude

Die App Claude hat auch ein eigenes Terminal. Befehle darin gelten genauso wie in der Kommandozeile des Agenten.

- **Prüft der Code (Hook vor einem Befehl im Terminal der App):**
  - was nur der Mensch tut, wird dem Agenten abgelehnt: die Anmeldung (`strom login`), das Siegel (`strom seal`),
    Installieren und Entfernen eines Konnektors, die Erlaubnis für ein Archiv (`strom allow`), eine Erzählung
    freigeben, eine Hypothese entscheiden, einen Ort beantworten und die anderen Befehle des Menschen, auch mit dem
    vollen Pfad zu `strom` oder einer Variablen davor;
  - git, das die Forschung dem Agenten verbietet, wird abgelehnt;
  - die Brücke zur Strom-App wird abgelehnt (ihre Adresse und die Datei, in der sie steht).
- **Grenzen:** strom nimmt das Terminal der App nicht in die erlaubten Befehle auf: jeden Befehl darin genehmigt der
  Mensch, wie bisher. Das Terminal der App ist die Login-Shell des Benutzers mit seinem Pfad zu den Programmen.
- **Nur Methodik:** der Agent startet `strom` in seiner Kommandozeile, nicht im Terminal der App.
- **Warum:** die Regeln von strom für die Kommandozeile des Agenten erreichen das Terminal der App nicht von selbst;
  der Hook von strom überträgt sie.
- **Bedienung:** keine: es gilt von selbst in der Forschung.
- **Gilt seit:** Forschung 1.29.0

<!-- zdroj: research:src/core/desktopterminal.ts desktopTerminalRefusal · src/core/bridgeguard.ts · src/agents/files.ts (CLAUDE.md: use Bash for strom commands … never its terminal) · test/vysledek-1106-vyzkum-062-desktop.md bod 4 · test/vysledek-062-u4-desktop.md krok 4, kroky 5–6 · CHANGELOG.de.md 1.29.0 -->

<a id="R12.4"></a>
## R12.4 Die App Claude ohne Claude Code im Terminal

Für ein Gespräch genügt die App Claude. Was strom selbst startet, führt Claude Code im Terminal aus.

- **Prüft der Code:**
  - selbstständiges Arbeiten (`strom run`), das Lesen von Scans durch die Leser (`strom read`), Korrekturen und Arbeit
    aus der Strom-App enden ohne Claude Code im Terminal mit dem Code `agent.cli-missing`, bevor eine Frage oder eine
    Kostenschätzung kommt. Die Meldung bietet an, das Gespräch in der App fortzusetzen (`strom chat`), und eine
    Installation von Claude Code;
  - die Brücke sagt der Strom-App mit demselben Code, dass das Lesen nicht bereit ist;
  - `strom setup` zeigt die Zeile **Claude – die App (selbstständiges Arbeiten und das Lesen von Scans brauchen Claude
    Code)** und bietet eine Installation von Claude Code an. Sie lässt sich ablehnen; ohne Menschen wird nur die
    Installationszeile ausgegeben;
  - `strom doctor` warnt (es ist kein Fehler) in der Zeile **Agent im Terminal**: **selbstständiges Arbeiten, das
    Lesen von Scans und Arbeit aus der Strom-App brauchen Claude Code im Terminal**; `strom doctor --fix` bietet die
    Installation an;
  - im Gespräch ohne Claude Code im Terminal liest der Scan-Leser von strom die Scans direkt im Gespräch (statt
    `strom read`).
- **Grenzen:** die Kopie von Claude Code, die die App Claude in sich trägt, nutzt strom nie: es startet nur Claude
  Code, das im Terminal installiert ist.
- **Warum:** das Gespräch führt die App, aber selbstständiges Arbeiten und die Leser startet strom mit dem Befehl
  Claude Code. Es vorher zu sagen erspart eine Zustimmung und eine Kostenschätzung, die zu nichts führen würden.
- **Bedienung:** Terminal: `strom doctor`, `strom doctor --fix`, `strom setup`, `strom chat`.
- **Gilt seit:** Forschung 1.29.0

<!-- zdroj: research:src/core/agentcli.ts CLI_MISSING, appWithoutCli, claudeInstallLine · src/commands/setup.ts:471 ui.doc.cli.missing · assets/lang/de.json ui.setup.cli.apponly · test/vysledek-1106-vyzkum-062-desktop.md bod 5 · prace/1106-vyzkum-062-desktop/pruzkum.md B · CHANGELOG.de.md 1.29.0 -->

<a id="R12.5"></a>
## R12.5 Codex: im Terminal und in der App ChatGPT

Codex läuft im Terminal oder in der App ChatGPT (die ältere eigene App Codex ging ihr voraus). Browser, Chrome und
Computersteuerung sind seine Plugins in einer Einstellung von Codex (`~/.codex/config.toml`), die Terminal und App
teilen. Den Browser steuert Codex mit JavaScript-Code (Werkzeug `js`), nicht mit der Adresse einer Seite.

- **Prüft der Code:**
  - Befehle `strom` nach den Regeln des Stammbaums für Codex (`.codex/rules/strom.rules`): `strom` ist erlaubt; die
    Anmeldung, das Siegel, Installieren und Entfernen eines Konnektors und git sind verboten. Codex liest diese
    Regeln, sobald der Mensch dem Ordner der Forschung vertraut;
  - vor jedem Aufruf des Browsers von Codex läuft der Hook von strom (`.codex/hooks.json`). Codex startet ihn, sobald
    der Mensch dem Ordner der Forschung vertraut und den Hook **strom** in Codex bestätigt (Trust). strom bestätigt
    nichts an Stelle des Menschen;
  - eine im Code geschriebene Adresse einer Seite: dieselbe Entscheidung wie beim Browser in Chrome
    ([R9.4](R9-archives.md#R9.4)). Ein Archiv, das nur der Browser eines Menschen betreten darf, wird ohne die
    Erlaubnis **über den Browser** mit demselben Rat abgelehnt; ein erlaubtes wird aufgezeichnet und hält sein Tempo
    zusammen mit dem Webabruf derselben Website. Zwei Seiten von Archiven in einem Aufruf werden abgelehnt: die Seiten
    gehen eine nach der anderen. Die Brücke zur Strom-App wird immer abgelehnt; lokale Adressen (localhost) beurteilt
    der Hook nicht;
  - Code, der mit einer Seite ohne Adresse arbeitet (Klick, zurück): für ihn gilt die Website, die der Hook in der
    Sitzung zuletzt durchgelassen hat;
  - Code ohne eine Adresse, die strom sehen würde, und ohne eine solche Website: wird nie abgelehnt. Er wird als nicht
    überwacht aufgezeichnet (`strom net web` zählt ihn), und der Agent bekommt einmal pro Sitzung den Rat, die Adresse
    jeder Seite direkt in den Aufruf zu schreiben;
  - eine Frage an den Menschen nimmt Codex aus einem Hook nicht an: wo strom fragen würde (mehr Anfragen an eine
    Website, als die Sitzung darf), wird der Aufruf abgelehnt;
  - ein selbstständiger Lauf (`strom run`) mit Codex ohne die persönlichen Erweiterungen des Agenten
    (`agent.addons off`, Standard) schaltet seine Plugins, den Browser und die Computersteuerung ab. Mit
    `agent.addons on` und im Gespräch bleiben sie, wie der Mensch sie hat;
  - `strom doctor`, `strom setup` und `strom chat` sagen es, wenn der Hook von strom auf die Bestätigung wartet, sich
    seit der Bestätigung geändert hat, in Codex ausgeschaltet ist, die Hooks von Codex ausgeschaltet sind, Codex dem
    Ordner der Forschung nicht vertraut oder die Hook-Datei fehlt. Den Zustand lesen sie nur aus den Einstellungen
    von Codex. Eine Hook-Datei, die nur fehlt oder veraltet ist, ist keine Warnung: sie wird von selbst neu geschrieben,
    wenn strom den Agenten das nächste Mal startet (`strom chat`, `strom run`), und bis dahin geht nichts verloren.
- **Grenzen:**
  - solange der Hook nicht bestätigt ist, und erneut nach jeder seiner Änderungen, überspringt Codex ihn: den Browser
    von Codex überwacht strom dann nicht;
  - die Computersteuerung von Codex (Code, der andere Apps steuert) lässt der Hook in Ruhe: strom überwacht sie nicht
    und zeichnet sie nicht auf ([R12.10](#R12.10));
  - die Websuche von Codex sieht kein Hook;
  - die Prüfung eines Archivs (`strom net web --check --browser`) und `strom doctor` rechnen mit dem Browser des
    Agenten nur bei Claude Code: mit Codex wartet eine Aufgabe bei einem Archiv nur über den Browser auf Bilder vom
    Menschen ([R9.4.3](R9-archives.md#R9.4.3));
  - ohne Codex im Terminal (nur die App ChatGPT) startet strom weder selbstständiges Arbeiten noch das Lesen von Scans
    durch die Leser noch Arbeit aus der Strom-App; es endet mit demselben Code `agent.cli-missing` wie bei Claude
    ([R12.4](#R12.4)).
- **Nur Methodik:** den Browser von Codex nutzt der Agent nicht von sich aus: in ein Archiv, das nur der Browser eines
  Menschen betreten darf, geht er damit nicht, und die Bilder speichert der Mensch
  ([R9.4.2](R9-archives.md#R9.4.2), [R9.6](R9-archives.md#R9.6)). Nutzt er ihn, schreibt er die Adresse jeder Seite
  direkt in den Aufruf (`tab.goto("https://…")`), eine Seite nach der anderen, und klickt sich nicht durch eine Reihe
  von Seiten eines Archivs.
- **Warum:** der Browser von Codex wird mit Code gesteuert, nicht mit der Adresse einer Seite. strom beurteilt nur
  eine Adresse, die es im Code sieht; Code ohne Adresse lehnt es daher nicht ab, sondern zeichnet ihn nur auf.
- **Bedienung:** App ChatGPT (Codex): **Einstellungen › Hooks** (oder **Review hooks** beim Nachrichtenfeld) → der Hook
  **strom** → **Trust**; Codex im Terminal im Ordner der Forschung: **Review hooks** (`/hooks`). Terminal:
  `strom doctor` (Zeilen **Browser der Desktop-Apps** und **Hooks von Codex (Browser)**), `strom agents sync`
  (schreibt die fehlende Hook-Datei), `strom net web` (Zahl der nicht überwachten Aufrufe),
  `strom config set agent.addons on|off`.
- **Gilt seit:** Forschung 1.27.0 (Browser und Computersteuerung im selbstständigen Lauf abgeschaltet);
  `agent.addons` seit 1.14.0; der Hook vor dem Browser von Codex und fehlendes Codex im Terminal seit 1.29.0

<!-- zdroj: research:src/agents/files.ts codexRules (allow strom; forbidden login, seal, connector add/remove, git; „read once the folder is trusted“), CODEX_HOOKS v AGENT_FILES · src/core/codexhook.ts (CODEX_BROWSER_TOOL mcp__node_repl__js, CODEX_HOOK_MATCHER, answerCodexEvent: codeUrls → answerChromeEvent navigate, >1 archiv deny, ask → deny, reachesBridge, loopback, page tool = poslední puštěný host, UNWATCHED + UNWATCHED_HINT jednou za sezení, computerUseOnly sky.* → nic; codexHookState trusted|modified|untrusted|disabled|off|folder|missing jen z config.toml) · src/commands/web.ts (unwatched v strom net web) · src/runners/codex.ts CODEX_CLEAN, codexBrowserOff · src/core/browserhelp.ts GUARDED_BROWSER_AGENTS = claude · src/core/agentcli.ts cliMissing · src/core/apps.ts codex (Codex.app, ChatGPT.app) · assets/lang/cs.json ui.doc.codexhooks.*, ui.doc.codexhooks.missing (bez varování od commitu 9bd14e84), ui.doc.desktop.codex · CHANGELOG.cs.md 1.27.0, 1.29.0 · dirigent:prace/1106-vyzkum-062-codex/karta.md Výsledek -->

<a id="R12.6"></a>
## R12.6 Was nicht geprüft ist

Die Tabelle [R12.1](#R12.1) beschreibt den Code der Forschung und das, was auf einem Mac in der App Claude (Tab Code)
geprüft wurde. Noch nicht live geprüft:

- die App Claude mit getrennter Erweiterung in Chrome oder mit dem eingebauten Browser als bevorzugtem: welchen
  Browser der Agent dann wählt (es folgt nur aus den Anweisungen der App an den Agenten);
- die Kommandozeile des Agenten in der App Claude und der Webabruf darin (die Hooks sind dieselben wie im Terminal);
- die Überwachung in der App Claude, wenn Claude Code nicht im Terminal ist (die App führt die Hooks mit ihrer eigenen
  Kopie von Claude Code aus);
- Codex live: weder im Terminal noch in der App ChatGPT (die Regeln des Stammbaums, der Hook vor dem Browser und seine
  Bestätigung, das Ablehnen und Aufzeichnen nicht überwachter Aufrufe, das Öffnen eines Gesprächs per Link, die
  Schritte des Menschen), noch dass sich die App ChatGPT wie die ältere App Codex verhält. Der Hook vor dem Browser
  von Codex ist aus dem Code beschrieben;
- die Computersteuerung von Codex: ob sie den Apps Stufen gibt wie die App Claude ([R12.10](#R12.10));
- Antigravity, Grok Build und OpenCode live in keiner Art zu arbeiten: die Regeln und Hooks von strom, die Schritte
  des Menschen, das Ablehnen der Befehle des Menschen;
- die App OpenCode: das Öffnen eines Gesprächs per Link und dass sie die Regeln in `opencode.json` der Forschung
  liest;
- Grok, im Ordner der Forschung anders als über `strom chat` geöffnet (in einem Ordner, dem es nicht vertraut): was
  von den Regeln und Hooks von strom dann gilt;
- ob Antigravity, Grok Build und OpenCode einen Browser oder eine Computersteuerung haben und wie der Agent sie nutzt
  (strom überwacht sie nicht);
- die Apps Claude, ChatGPT und OpenCode unter Windows.

- **Gilt seit:** Forschung 1.29.0

<!-- zdroj: test/vysledek-desktop-chrome.md Neověřeno · test/vysledek-062-u4-desktop.md Neověřeno · test/vysledek-1106-vyzkum-062-desktop.md Neověřeno · dirigent 6. 11. (ChatGPT.app × Codex.app) · spec 062 K5.1 (06. 11.: Antigravity, Grok, OpenCode jen z kódu) · spec 062 Mimo rozsah (Windows) -->

<a id="R12.7"></a>
## R12.7 Antigravity

Antigravity wird im Terminal mit dem Befehl `agy` gestartet. Antigravity hat auch eine App, aber strom öffnet darin
kein Gespräch (einen Link, der eines öffnen würde, kennt strom nicht): `strom chat` mit Antigravity ist immer im
Terminal.

- **Prüft der Code:**
  - `strom setup` (und `strom agents install`) schreibt in die Einstellungen von Antigravity eine Regel, dass `strom`
    ohne Nachfrage laufen darf (`command(strom)`);
  - Befehle, die nur dem Menschen gehören, lehnt `strom` selbst ab ([R12.1](#R12.1));
  - ein selbstständiger Lauf (`strom run`): was die Einstellungen von Antigravity nicht erlauben, wird abgelehnt,
    niemand wird gefragt. Hält Antigravity bei einem abgelehnten Befehl an, sagt strom ihm im selben Gespräch, nur
    über `strom` weiterzumachen, höchstens zweimal. Auf der Stufe `full` werden die Berechtigungen übersprungen;
  - Webabrufe und Suchen von Antigravity in einem selbstständigen Lauf werden erst danach in den Bericht der
    Forschung geschrieben.
- **Grenzen:**
  - Antigravity hat keinen Hook vor einem Webabruf, einem Browser oder einem Befehl: die Grenzen des Webs
    ([R9.3](R9-archives.md#R9.3)), Browser und Computersteuerung von Antigravity prüft strom nicht vorher;
  - Regeln für Dateien und git schreibt strom für Antigravity nicht in den Ordner der Forschung;
  - die Brücke zur Strom-App schützen nur ihre eigenen Prüfungen.
- **Nur Methodik:** die Anweisungen in `AGENTS.md`: der Agent arbeitet nur über `strom`, prüft eine Website vorher
  (`strom net web --check`), nutzt den Browser von Antigravity nicht von sich aus und geht damit nicht in ein Archiv,
  in das nur der Browser des Menschen darf ([R9.4.2](R9-archives.md#R9.4.2)).
- **Bedienung:** Terminal: `strom agents use antigravity`, `strom chat`, `strom setup`.
- **Gilt seit:** Forschung 1.0.0; das Weitermachen nach einem abgelehnten Befehl seit 1.14.0

<!-- zdroj: research:src/core/apps.ts (Antigravity: no known link, strom talks to it in the terminal) · src/core/apps.ts whereToTalk · src/agents/global.ts allowRules command(strom) · src/commands/setup.ts installGlobal · src/agents/launch.ts antigravity (--mode accept-edits, --dangerously-skip-permissions) · src/runners/antigravity.ts (headless: what would ask is refused; AGY_GO_ON = 2; ANTIGRAVITY_WEB) · src/core/metrics.ts webOpt (from: stream) · src/core/bridgeguard.ts (agent without hooks: Codex, OpenCode, Antigravity) · src/core/browserhelp.ts GUARDED_BROWSER_AGENTS · src/agents/files.ts AGENTS.md body 10, syncAgentFiles (žádný soubor Antigravity) · git tagy v1.0.0, v1.14.0 -->

<a id="R12.8"></a>
## R12.8 Grok Build

Grok Build wird im Terminal mit dem Befehl `grok` gestartet. Eine App von Grok öffnet strom nicht: `strom chat` mit
Grok ist immer im Terminal.

- **Prüft der Code:**
  - die Regeln des Stammbaums in `.grok/config.toml`: `strom` erlaubt; die Anmeldung, das Siegel, Installieren und
    Entfernen eines Konnektors, git, die Belege der Forschung und die Einstellungen des Menschen verboten. Grok liest
    sie nur in einem Ordner, dem es vertraut: `strom chat` und `strom run` starten es mit dem Ordner der Forschung als
    vertrauenswürdig (einmal je Forschung vermerkt);
  - die Hooks von strom in `.grok/hooks/strom.json`: vor einem Webabruf und einer Suche dieselben Regeln wie bei
    Claude Code ([R9.3](R9-archives.md#R9.3)); vor einem Befehl in der Kommandozeile des Agenten das Ablehnen der
    Brücke zur Strom-App;
  - ein selbstständiger Lauf ohne persönliche Erweiterungen (`agent.addons off`, Standard): Grok übernimmt keine
    Skills, MCP-Server und Hooks von Claude Code und Cursor und schaltet sein Gedächtnis ab; die Hooks von strom in
    `.grok/hooks` gelten weiter. Was die Regeln nicht erlauben, wird abgelehnt, niemand wird gefragt; auf der Stufe
    `full` gelten nur die Verbote.
- **Grenzen:**
  - die eigenen Skills, Plugins und MCP-Server von Grok bleiben auch im selbstständigen Lauf: einen Schalter für
    einen Lauf hat Grok nicht;
  - harmlose Befehle lässt Grok auch nach eigenem Urteil durch: es halten die Verbote, nicht die Liste des Erlaubten;
  - Browser und Computersteuerung von Grok überwacht strom nicht: es überwacht nur Claude in Chrome, den eingebauten
    Browser der App Claude ([R12.2](#R12.2)) und den Browser von Codex ([R12.5](#R12.5)).
- **Nur Methodik:** die Anweisungen in `AGENTS.md` und `.grok/rules/strom.md`: Scans liest Grok selbst, die Art des
  Delegierens aus `CLAUDE.md` gilt nicht für ihn.
- **Bedienung:** Terminal: `strom agents use grok`, `strom chat`, `strom config set agent.addons on|off`.
- **Gilt seit:** Forschung 1.4.0; die Hooks für das Web und der selbstständige Lauf ohne persönliche Erweiterungen
  seit 1.14.0; der Hook vor einem Befehl seit 1.27.0

<!-- zdroj: research:src/agents/files.ts treeRules(grok), grokConfig, GROK_RULES, grokHooks, GROK_HOOKS · src/core/web.ts grokWebHooks (web_fetch|web_search) · src/core/bridgeguard.ts grokShellHook (run_terminal_command|bash|shell) · src/runners/grok.ts grokTrust (--trust), GROK_CLEAN, dontAsk, --always-approve · src/agents/launch.ts grok · src/core/browserhelp.ts GUARDED_BROWSER_AGENTS · git tagy v1.4.0, v1.14.0, v1.27.0 -->

<a id="R12.9"></a>
## R12.9 OpenCode

OpenCode läuft im Terminal oder in der App OpenCode: `strom chat` öffnet sie per Link mit dem Ordner der Forschung
und einer vorbereiteten Nachricht. Das Modell nimmt die App aus `opencode.json` der Forschung.

- **Prüft der Code:**
  - die Regeln des Stammbaums in `opencode.json` im Ordner der Forschung: `strom` erlaubt; die Anmeldung, das Siegel,
    Installieren und Entfernen eines Konnektors und git verboten; die Belege der Forschung und die Geschichte
    (`.git`) werden weder gelesen noch geändert; ohne Nachfrage schreibt es nur in die Notizen (`notes/`) und in
    Konnektoren, die der Agent baut; seine eigenen Regeln und Anweisungen (`opencode.json`, `AGENTS.md`,
    `CLAUDE.md`) ändert der Agent nicht. Nach anderen Befehlen und Schreibzugriffen fragt OpenCode; auf der Stufe
    `full` tut es ohne Nachfrage alles, was die Regeln nicht verbieten;
  - ein selbstständiger Lauf: der Agent `strom-run` von OpenCode mit denselben Regeln; was fragen würde, wird
    abgelehnt (OpenCode würde sonst den ganzen Lauf bei der ersten Frage beenden);
  - ohne OpenCode im Terminal (nur die App) enden selbstständiges Arbeiten, das Lesen von Scans durch die Leser und
    Arbeit aus der Strom-App mit dem Code `agent.cli-missing`, wie bei Claude ([R12.4](#R12.4));
  - Webabrufe und Suchen von OpenCode in einem selbstständigen Lauf werden erst danach in den Bericht der Forschung
    geschrieben.
- **Grenzen:**
  - OpenCode hat keinen Hook: Webabrufe und Suchen erlauben die Regeln, und strom prüft sie nicht vorher
    ([R9.3](R9-archives.md#R9.3)); Browser und Computersteuerung, wenn OpenCode sie hat, überwacht strom nicht;
  - die persönlichen Erweiterungen von OpenCode bleiben auch im selbstständigen Lauf: einen Schalter dafür hat strom
    nicht.
- **Nur Methodik:** die Anweisungen in `AGENTS.md`: der Agent arbeitet nur über `strom`, prüft eine Website vorher
  (`strom net web --check`) und geht nicht in ein Archiv, in das nur der Browser des Menschen darf
  ([R9.4.2](R9-archives.md#R9.4.2)).
- **Bedienung:** Terminal: `strom agents use opencode`, `strom chat`, `strom chat --where app|terminal`.
- **Gilt seit:** Forschung 1.0.0; der Agent `strom-run` seit 1.4.0

<!-- zdroj: research:src/agents/files.ts opencodeConfig (bash strom * allow, login/seal/connector add|remove deny, git deny; read data/.git deny; edit notes allow; webfetch/websearch allow), OPENCODE_RUN_AGENT, refused (ask → deny) · src/core/apps.ts opencode (OpenCode.app, opencode://new?cwd=…&q=…) · src/commands/start.ts strom chat (model z opencode.json) · src/agents/launch.ts opencode (--auto) · src/core/agentcli.ts agentCliMissing · src/runners/opencode.ts OPENCODE_WEB · src/runners/runner.ts clean (jen Claude Code, Codex; Grok GROK_CLEAN) · git tagy v1.0.0, v1.4.0 -->

<a id="R12.10"></a>
## R12.10 Computersteuerung (Computer Use)

Die Computersteuerung (Computer Use) steuert den Computer wie ein Mensch: Bildschirmfotos, Klicken und Schreiben.
strom überwacht sie bei keinem Agenten und empfiehlt sie nicht; es schaltet an ihr nichts ab und nichts ein.

- **Grenzen:**
  - die App Claude gibt den Apps bei der Computersteuerung Stufen: der Browser nur zum Lesen (Bildschirmfoto, ohne
    Klicken und Schreiben), das Terminal nur zum Klicken (ohne Schreiben und Tasten), die anderen Apps voll. Die
    Strom-App im Browser und die Forschung im Terminal steuert sie daher mit der Computersteuerung nicht: die Strom-App
    geht mit den Werkzeugen der Seite im Browser (eingebauter Browser der App Claude, Claude in Chrome;
    [A9.4](A9-using-the-app.md#A9.4)), die Forschung mit dem Befehl `strom` in der Kommandozeile des Agenten;
  - ein Gespräch in der App Claude ohne Ordner der Forschung (Tab Chat) hat die Kommandozeile außerhalb des Computers:
    `strom` lässt sich darin nicht starten;
  - die Computersteuerung von Codex lässt der Hook von strom in Ruhe ([R12.5](#R12.5)). Ob sie den Apps Stufen gibt
    wie die App Claude, ist nicht geprüft ([R12.6](#R12.6));
  - die Regeln der Archive gelten genauso auch dort, wo strom nicht überwacht: Tempo, „nur von Hand“
    ([R9](R9-archives.md)).
- **Nur Methodik:** der Agent empfiehlt nie, die Computersteuerung einzuschalten. Wenn er sie hat: die Strom-App
  steuert er mit den Werkzeugen der Seite im Browser, nicht nach Punkten des Bildschirms; die Forschung mit dem Befehl
  `strom` in seiner Kommandozeile, nie durch Schreiben in das Fenster des Terminals; Zustimmungen und Einstellungen
  des Menschen (der Kartenhintergrund von OpenStreetMap, wie Änderungen an die Forschung gehen) überlässt er dem
  Menschen und sagt, was auf ihn wartet.
- **Bedienung:** keine: strom schaltet die Computersteuerung weder ab noch ein. Terminal: `strom doctor`, Zeile
  **Browser der Desktop-Apps**.
- **Gilt seit:** Forschung 1.29.0

<!-- zdroj: research:src/agents/files.ts AGENTS.md „## When you have computer use“ (Never suggest turning it on; page tools, not pixels; strom in own command line; consents left to the person; archives' rules) · src/core/codexhook.ts computerUseOnly (sky.*) · assets/lang/cs.json ui.doc.desktop.claude, ui.doc.desktop.codex · CHANGELOG.cs.md 1.29.0 · dirigent:test/vysledek-063-pruzkum.md kolo 1 (úrovně aplikací: prohlížeče read, terminály click, ostatní full; Chat bez složky má shell v cloudu) · spec/063-computer-use-usnadnit K1.3 -->
