<a id="R5"></a>
# R5 Widersprüche

Wie in der Forschung ein Widerspruch entsteht, wer ihn entscheidet, was der Agent nicht überschreiben darf und wo ein
Widerspruch gezeigt und entschieden wird. Beschrieben werden die Forschung 1.25.2 und die Strom-App 3.21.2.

<a id="R5.1"></a>
## R5.1 Ein Widerspruch hält fest, dass die Quellen nicht übereinstimmen

Wenn sich Einträge über eine Person unterscheiden (Name, Datum, Alter), wählt der Agent nicht stillschweigend einen
von ihnen. Er erfasst einen Widerspruch: beide Aussagen mit ihren Quellen und die Frage, die zu entscheiden ist. Der
Widerspruch bleibt offen, bis ihn jemand mit Begründung entscheidet ([R5.3](#R5.3)).

- **Grenzen:**
  - ein Widerspruch hat mindestens 2 Aussagen und betrifft mindestens eine Person oder einen anderen Eintrag;
  - die betroffene Angabe wird mit einem GEDCOM-Kennzeichen erfasst (BIRT, DEAT, NAME, SEX…). Die App zeigt den
    Widerspruch dann bei dieser Angabe;
  - ein Widerspruch entsteht auch, wenn sich zwei unabhängige Lesungen derselben Zelle unterscheiden (siehe
    [R3](R3-verification-and-citation.md));
  - was den Widerspruch entscheiden würde, wird als Aufgabe zum Widerspruch erfasst;
  - einen offenen Widerspruch bei einer Person mit belegten Angaben meldet die Prüfung des Stammbaums als Warnung.
- **Bedienung:** Terminal: `strom conflict add "<otázka>" --about P… --fact BIRT --claim "S…: …" --claim "S…: …"`,
  `strom conflict list [--about P…] [--all]`, `strom conflict show X…`, Aufgabe zum Widerspruch `strom task add … --about X…`,
  Prüfung `strom check`.
- **Gilt seit:** Forschung 1.0.0

<!-- zdroj: research:assets/method/recording.md:69-85 · assets/method/core.md:38-41 „Nothing is deleted“ · assets/method/verify.md:11-12 · src/commands/analysis.ts:470-512 conflict add, :601 list, :626 show · src/core/check.ts:98 open-conflict -->

<a id="R5.1.1"></a>
### R5.1.1 Andere Eltern bedeuten zwei Personen, keinen Widerspruch

Zwei Einträge, die demselben Namen andere Eltern geben (eine andere Mutter), beschreiben **zwei Personen**. Das gilt
auch im selben Haus und beim selben Namen des Vaters. Der Unterschied wird nicht mit einem Fehler des Schreibers
erklärt und nicht nach der Mehrheit der Einträge entschieden.

- **Grenzen:** „Ist es dieselbe Frau?“ ist eine Hypothese, kein Widerspruch. Eine Person mit einem Widerspruch ist es
  erst, wenn das ein anderer Eintrag belegt. Erfundenes Beispiel: zwei Taufen einer Marie Vlková in derselben
  Gemeinde, einmal mit der Mutter Horáková, einmal mit einer anderen Mutter. Das sind zwei Maries und eine Hypothese,
  ob es eine ist.
- **Bedienung:** Terminal: `strom hypothesis add`.
- **Gilt seit:** Forschung 1.0.0

<!-- zdroj: research:assets/method/core.md:15-22 „A namesake is not your person“ · assets/method/recording.md:74-76 -->

<a id="R5.2"></a>
## R5.2 Eine Änderung aus der App an einer durch einen Eintrag belegten Angabe wird zum Widerspruch

Änderungen aus der Strom-App erfasst die Forschung so, dass nichts verschwindet, worauf sie sich stützt. Die
Änderung einer Angabe, die ein Eintrag belegt hat, überschreibt die Angabe darum nicht. Es entsteht ein Widerspruch
zwischen dem Wert aus der App und dem Wert der Forschung.

- **Grenzen:** was mit einer Änderung aus der App geschieht:
  1. eine neue Angabe oder Person: sie wird als **Hinweis** mit der Quelle „Änderungen in der Strom-App ({Tag})“
     erfasst;
  2. Änderung einer Angabe, die kein Eintrag belegt: die Angabe wird berichtigt (mit Grund);
  3. Präzisierung einer durch einen Eintrag belegten Angabe (ein Ort, wo keiner war, ein Tag zum Jahr, ein genauerer
     Ort): sie wird der Angabe hinzugefügt, ohne Widerspruch;
  4. eine andere Änderung einer durch einen Eintrag belegten Angabe: **Widerspruch**. Ebenso beim Namen, beim Titel
     vor und nach dem Namen und beim Geschlecht;
  5. ein Kind, das anderen Eltern zugeordnet wurde als denen, bei denen die Forschung es als geboren führt: immer ein
     Widerspruch „Eltern“;
  6. eine Person, die in einer Kopie der App entfernt und inzwischen anderswo geändert wurde (in einer anderen Kopie
     oder in der Forschung): ein Widerspruch, ob sie im Stammbaum bleibt.
- Eine durch einen Eintrag belegte Angabe ist eine Angabe im Zustand **Belegt** oder **Wahrscheinlich**, die eine
  andere Quelle zitiert als einen Stammbaum, die Familienüberlieferung oder einen eigenen Text des Autors.
- Bis zur Entscheidung bleibt in der App der Wert aus der App, die Forschung hat an dieser Stelle ihren eigenen.
- Dieselbe Änderung, erneut gesendet, legt keinen neuen Widerspruch an. Eine anders geänderte Änderung überschreibt
  nur die Seite der App im offenen Widerspruch.
- **Bedienung:** App: nach dem Senden **Geschrieben, {n} Widersprüche zu entscheiden** und **Anzeigen**. Terminal: die
  Ausgabe von `strom sync` sagt bei jeder Änderung **ein Widerspruch zum Entscheiden (die Forschung hat es aus einem
  Eintrag)** oder **ein Widerspruch zum Entscheiden (die Forschung hat andere Eltern)**. Das Senden lässt sich
  zurücknehmen: `strom sync undo I…`.
- **Gilt seit:** Forschung 1.5.0. Präzisierung ohne Widerspruch und Widerspruch der Eltern seit 1.12.0, Widerspruch
  einer entfernten Person seit 1.20.0.

<!-- zdroj: research:src/core/sync.ts:1-19, recordBacked :2238, výběr akce :2406-2520 (refine :2511, addsTo :3475), parentsConflict :2848, openConflict :3486, conflictOfEdit :4888 · src/core/conflicts.ts:19 isEditConflict · cs.json ui.sync.do.conflict, ui.sync.do.parents, ui.sync.do.refine, ui.sync.source.app.day · app:strings.ts sync.flyConflict, sync.showConflicts, sync.writtenConflictsSub · CHANGELOG.cs.md 1.20.0 -->

<a id="R5.2.1"></a>
### R5.2.1 Wenn die Änderung aus der App gilt

Eine Option des Stammbaums bestimmt, was mit der Änderung einer durch einen Eintrag belegten Angabe geschieht:

- **ein Widerspruch zum Entscheiden** (Standard): die Forschung hält den Wert aus dem Eintrag und legt einen
  Widerspruch an;
- **Die eigene Änderung gilt:** die Angabe aus dem Eintrag wird mit Grund zurückgezogen, und die Änderung gilt. Nichts
  wird gelöscht, es bleibt in der Historie.
- **Grenzen:** das Strom-Archiv und eine Forschung, die auf ihren Agenten wartet, nehmen Änderungen aus der App immer
  als gültig. Der Widerspruch der Eltern und der Widerspruch einer entfernten Person entstehen auch dort.
- **Bedienung:** Terminal: `strom config set sync.edits conflict|user`. Die Option gilt für einen Stammbaum.
  **Die eigene Änderung gilt** darf nur der Mensch einschalten: der Stammbaum fragt „Sollen eigene Änderungen in der
  Strom-App vor dem gelten, was ein Eintrag sagt?“.
- **Gilt seit:** Forschung 1.5.0; Strom-Archiv und die Frage an den Menschen seit 1.12.0.

<!-- zdroj: research:v1.25.2 src/core/config.ts:283 sync.edits · src/commands/setup.ts:1163-1167 syncDecisions requireHuman · src/core/sync.ts:2283-2285 mirror · src/core/state.ts:44 actsAsArchive · cs.json ui.sync.mode.conflict, ui.sync.mode.user, ui.sync.edits.archive, ui.consent.edits.user -->

<a id="R5.3"></a>
## R5.3 Wer einen Widerspruch entscheidet

Einen Widerspruch zwischen Quellen entscheidet der Agent, wenn die Quellen eine Schlussfolgerung zulassen. Ein
Widerspruch aus einer Änderung in der App wartet auf den Menschen. Im Strom-Archiv und in einer Forschung, die auf
ihren Agenten wartet, entscheidet alle Widersprüche der Mensch. Jede Entscheidung hat eine Schlussfolgerung und eine
Begründung: welcher Beleg welchen überwog.

- **Grenzen:**
  - eine Entscheidung ohne Schlussfolgerung oder ohne Begründung wird nicht erfasst;
  - bei der Entscheidung wird erfasst, wer entschieden hat: der Benutzer (Terminal ohne Agent, Link aus der App) oder
    der Agent (seine Sitzung). Aus dem Menü und aus dem Link endet die Begründung mit den Worten „(Entscheidung des
    Nutzers)“;
  - der Mensch kann auch einen Widerspruch zwischen Quellen entscheiden: er wählt die Aussage, die stimmt, oder
    schreibt eine eigene Schlussfolgerung;
  - ein entschiedener Widerspruch lässt sich nur mit Grund erneut entscheiden. Die frühere Entscheidung bleibt in der
    Notiz des Widerspruchs („früher vom Benutzer entschieden…“, „früher in der Forschung entschieden…“).
- **Bedienung:** Terminal: `strom conflict resolve X… --resolution "…" --reasoning "…"`, erneut mit `--reason "…"`.
  Wo im Menü und in der App entschieden wird: [R5.6](#R5.6).
- **Gilt seit:** Forschung 1.0.0. Die zweite Entscheidung nur mit Grund seit 1.6.0, die Erfassung, wer entschieden
  hat, seit 1.14.0.
- **Ab Forschung 1.26.0:**
  - einen Widerspruch aus einer Änderung entscheidet nur der Mensch. Dem Agenten lehnt die Forschung die Entscheidung
    ab, bis der Mensch sie ihm überlässt (`strom conflict leave X…`, in der App **Dem Agenten überlassen**);
    `strom conflict leave` ist nur für den Menschen;
  - Widersprüche aus Änderungen, die der Agent früher entschieden hat, öffnet die Korrektur `strom fixes
    show|run|undo edit-decisions` erneut. Die Entscheidung des Agenten bleibt in der Notiz des Widerspruchs, die
    Angaben ändern sich nicht. Die Korrektur startet nur der Mensch im Terminal, im Strom-Archiv gibt es sie nicht.
    Solange sie nicht gelaufen ist, weist `strom check` auf solche Widersprüche hin.

<!-- zdroj: research:assets/method/recording.md:76-78 · src/commands/analysis.ts:515-598 conflict resolve (by :561, poznámka „earlier decided“ :572-573, zápis :581) · src/core/conflicts.ts:105-113 againAllowed conflict.decided · src/core/conflicts.ts:27 conflictsToDecide · src/cli/context.ts:577 actor · cs.json ui.link.conflict.by, ui.conflict.earlier.* · 1.26.0: src/commands/analysis.ts:525, :572 conflict.users, :625 conflict leave (commit 1189532f) · src/commands/fixes.ts edit-decisions, strom check agent-decided-edit (commit 740e1893) -->

<a id="R5.3.1"></a>
### R5.3.1 Ein Widerspruch aus einer Änderung wird durch eine Seite entschieden

Ein Widerspruch aus einer Änderung in der App hat zwei Seiten: den Wert aus der App und den Wert der Forschung.
Entschieden wird durch die Wahl einer Seite.

- **Wert aus der App:** er wird in die Angabe geschrieben. Die Angabe aus dem Eintrag wird mit Grund zurückgezogen und
  bleibt in der Historie. Der Wert aus der App steht daneben als **Möglich**. Ein Hinweis wird direkt berichtigt.
- **Wert der Forschung:** die Angabe in der Forschung bleibt, wie sie ist. Die App bekommt den Wert der Forschung,
  wenn sie deren Fassung lädt (vorher wird eine Sicherung gespeichert).
- **Grenzen:** eine Schlussfolgerung, die genau mit dem Wert einer Seite übereinstimmt, gilt als Wahl dieser Seite.
  Eine Schlussfolgerung, die keiner Seite entspricht, schließt den Widerspruch, ändert aber die Angabe nicht; die
  Ausgabe sagt, wie der Wert aus der App zu übernehmen ist. Widerspruch der Eltern: der Wert aus der App verschiebt
  das Kind zu den Eltern aus der App.
- **Bedienung:** Terminal: `strom conflict resolve X… --take user|research --reasoning "…"`.
- **Gilt seit:** Forschung 1.12.0

<!-- zdroj: research:src/core/sync.ts:4771-4800 takeSide · src/commands/analysis.ts:543-550 (strana podle závěru), :596 ui.conflict.left · cs.json ui.conflict.left · app:strings.ts conflict.keepNote, conflict.takeNote -->

<a id="R5.4"></a>
## R5.4 Die Entscheidung des Menschen gilt

Was der Mensch entschieden hat (in der App, über einen Link aus ihr oder im Terminal), gilt. Der Agent entscheidet
es nur auf Grund einer Quelle erneut, die die Entscheidung noch nicht abgewogen hat, und mit Grund. Eine neue Lesung
desselben Eintrags ändert nichts.

- **Grenzen:**
  - abgewogene Quellen sind die Quellen aller Aussagen des Widerspruchs und beim Widerspruch aus einer Änderung auch
    die Quellen der geänderten Angabe;
  - dieselbe Regel gilt für einen neuen Widerspruch zur selben Angabe derselben Person: der Agent legt ihn nur mit
    einer neuen Quelle und einem Grund an;
  - eine einmal gewählte Seite lässt sich nicht erneut wählen, die Angabe ändern dann die Befehle für Angaben.
    Ausnahme: ob eine Person im Stammbaum bleibt, lässt sich in beide Richtungen erneut entscheiden;
  - eine Entscheidung des Agenten kann der Agent mit Grund erneut entscheiden, ohne neue Quelle.
- **Bedienung:** Terminal: `strom conflict resolve X… --resolution "…" --reasoning "…" --source S… --reason "<co
  nový záznam ukazuje>"`. Ohne neue Quelle lehnt strom ab und schlägt vor, den Menschen zu fragen.
- **Gilt seit:** Forschung 1.14.0

<!-- zdroj: research:src/core/conflicts.ts:89-98 weighedSources, :100-132 againAllowed (conflict.taken, conflict.user-decided) · src/commands/analysis.ts:495-509 conflict add · assets/method/recording.md:78-82 -->

<a id="R5.5"></a>
## R5.5 Was der Agent nicht überschreibt

Manches ist das Wort des Menschen. Der Agent überschreibt es nicht, auch wenn er etwas anderes findet. Den
Unterschied erfasst er daneben, oder er fragt.

- **Abschrift des Benutzers:** eine Abschrift eines Eintrags aus der App liest der Agent selbst blind. Übereinstimmung:
  eine Notiz bei der Quelle, dass auch die Forschung sie gelesen hat. Unterschied: ein Widerspruch mit beiden
  Lesungen. Die Abschrift des Benutzers wird nicht überschrieben und gilt nicht als belegt. Das ist eine Regel der
  Methodik des Agenten.
- **Freigegebene Erzählung:** nach der Freigabe durch den Menschen ist sie gesperrt. Eine neue Fassung erfasst der
  Agent daneben, und sie wartet auf den Menschen: anstelle der alten freigeben oder die alte behalten.
- **Lage eines Ortes von Hand:** eine von Hand gesetzte Lage wird nicht geändert. Wenn die Einträge etwas anderes
  sagen, erscheint in **Wartet auf Bearbeitung** die Frage **Widerspruch der Lage** ([R4.3](R4-places.md#R4.3)).
- **Entscheidung des Menschen in einem Widerspruch:** [R5.4](#R5.4).
- **Bedienung:** Terminal: `strom story approve P…`, `strom story discard P…`; Menü **Was wartet**.
- **Gilt seit:** Abschrift des Benutzers Forschung 1.12.0, freigegebene Erzählung 1.10.0, Lage von Hand 1.25.0.
- **Ab Forschung 1.26.0:** `strom story approve|discard` startet nur der Mensch. Dem Agenten lehnt die Forschung auch
  das Erfassen einer Erzählung gleich als freigegeben ab (`strom story set --final`).

<!-- zdroj: research:assets/method/verify.md:19-24 · src/commands/story.ts:94-96, :103 story approve, :121 story discard (1.26.0 person only, story.final) · src/core/placeid.ts:714 personsHand, :805-808 place.manual, :924 · app:strings.ts places.dialog.whoHand, places.waiting.kind.conflict -->

<a id="R5.6"></a>
## R5.6 Wo Widersprüche zu sehen sind und wo sie entschieden werden

In der App sind Widersprüche bei der Person und bei ihren Angaben zu sehen. Die Entscheidung wird aber immer in der
Forschung erfasst, auf dem Computer, auf dem die Forschung läuft. Die App öffnet die Forschung im Terminal, und dieses
fragt nach Bestätigung und Grund.

- **App – wo ein Widerspruch zu sehen ist:**
  - Menü der Person **Was die Forschung weiß** mit der Zahl der Widersprüche, im Dialog der Abschnitt **Widersprüche**
    (offene und entschiedene);
  - Forschungsbereich, Abschnitt **Was die Forschung weiß**: eine Zeile für jeden offenen Widerspruch;
  - beim Bearbeiten einer Person am Feld die Marke **Widerspruch ›**;
  - auf der Karte der Person eine Marke des Widerspruchs (eingeschaltet in **Auf der Karte zeigen → Widersprüchliche
    Quellen**).
- **App – Widerspruch aus einer Änderung:** eine Karte mit den Seiten **Aus der App** und **In der Forschung** und den
  Optionen **Wert aus der App behalten** und **Wert der Forschung übernehmen**. Die Option öffnet die Forschung.
  Außerhalb des Computers mit der Forschung sagt die Karte **Entschieden wird im Terminal auf dem Computer mit der
  Forschung: strom → Was wartet.**
- **App – Widerspruch zwischen Quellen:** „Hier widersprechen sich die Quellen; entschieden wird in der Forschung.“
  Optionen **In der Forschung entscheiden** (Terminal: **Was stimmt?**, eine Aussage oder **Etwas anderes (ich
  schreibe es)**, dann **Warum? (was entscheidet)**) und **Dem Agenten überlassen** (Gespräch mit dem Agenten; strom
  sagt vorher, dass der Agent mit dem Abonnement oder dem KI-Guthaben arbeitet). Im Strom-Archiv gibt es die Option
  **Dem Agenten überlassen** nicht.
- **Terminal:** Menü **Was wartet**, Gruppe **Widersprüche zu entscheiden**, die ältesten zuerst. Optionen **Der Wert
  aus der Strom-App gilt**, **Der Wert der Forschung gilt** (im Archiv **Der Wert im Strom-Archiv gilt**), **Offen
  lassen**. Ein Widerspruch zwischen Quellen bietet die Aussagen wie im Link an.
- **Grenzen:** in einer Forschung mit Agent zeigt **Was wartet** nur Widersprüche aus Änderungen in der App.
  Widersprüche zwischen Quellen stehen dort nur im Strom-Archiv und in einer Forschung, die auf den Agenten wartet.
  Sonst zeigt sie das Terminal nur in `strom conflict list`. In **Wartet auf Bearbeitung** der App gibt es keine
  Widersprüche.
- **Bedienung:** siehe oben; im Terminal außerdem `strom conflict show X…`.
- **Gilt seit:** App 3.4.0 (**Was die Forschung weiß**, **Widerspruch ›**, **In der Forschung entscheiden**, **Dem
  Agenten überlassen**), der Abschnitt im Forschungsbereich und die Marke auf der Karte seit App 3.5.0. Die Wahl der
  Seite seit App 3.11.0 mit Forschung 1.14.0. Widersprüche in **Was wartet** seit Forschung 1.20.0.
- **Ab Forschung 1.26.0:**
  - **Dem Agenten überlassen** bietet die App auch bei einem Widerspruch aus einer Änderung an; der Link überlässt den
    Widerspruch zuerst dem Agenten (`strom conflict leave`);
  - eine in der App gewählte Seite wird im Terminal nur bestätigt, der Grund ist freiwillig (**Warum? (was
    entscheidet; Enter: ohne Grund, 0: nichts entscheiden)**). Ohne Grund wird „in der Strom-App gewählt“ erfasst;
  - **Was wartet** bietet die Optionen mit den Worten der App an: **Wert aus der App behalten**, **Wert der Forschung
    übernehmen** (im Archiv **Wert des Strom-Archivs übernehmen**), **Offen lassen**.

<!-- zdroj: research:src/core/waiting.ts:127 TERMINAL_ONLY, :443-449 · src/cli/menu-waiting.ts:486-513 decideConflictHere · src/cli/menu-links.ts:510-561 decideConflict, pickClaim · src/commands/links.ts:235-246 · src/core/live.ts:2063 decide.link · src/core/stromapp.ts APP_DECIDES_CONFLICTS="3.11.0" · app:v3.21.2 strings.ts research.knows, research.conflicts, research.conflictTag, research.decide, research.leaveToAgent, conflict.*, cardDensity.cardConflict · ui/person-research-ui.ts:139-150, :178-210 · ui/conflict-decide-ui.ts · research-decide.ts:55 canDecideInApp · 1.26.0: research:cs.json ui.wait.conflict.take.*, ui.link.conflict.whyMaybe, ui.link.conflict.inApp (commit 1189532f) · app:src/research-conflict-card.ts conflictCardView (agent u rozporu z úpravy) -->

<a id="R5.6.1"></a>
### R5.6.1 Was sich aus der App durch eine Seite entscheiden lässt

Die Wahl einer Seite bietet die App nur bei einem offenen Widerspruch aus einer Änderung an, der beide Seiten hat und
eine Person der Forschung betrifft.

- **Grenzen:**
  - es geht um den Wert eines Ereignisses (Datum, Ort, Wert) einer Person oder eines Paares, den Namen, den Titel vor
    und nach dem Namen, das Geschlecht;
  - mindestens eine Seite hat einen Wert; eine leere Seite wird als **(leer)** gezeigt;
  - einen Widerspruch der Eltern kann man aus der App nicht durch eine Seite entscheiden. Die App zeigt bei ihm nur
    **In der Forschung entscheiden**, oder er wird im Terminal in **Was wartet** entschieden;
  - eine in einem anderen Fenster entfernte oder geänderte Person: die App fragt **In den Stammbaum zurückholen** /
    **Entfernt lassen** oder **Aus dem Stammbaum entfernen** / **Im Stammbaum lassen**. Die Option öffnet auch die
    Forschung im Terminal.
- **Gilt seit:** App 3.11.0 mit Forschung 1.14.0

<!-- zdroj: research:src/core/conflicts.ts:48-62 BY_SIDE, sidesOf · app:v3.21.2 research-decide.ts:28-66 DECIDE_FACTS, canDecideInApp · ui/research-removed-ui.ts:97-125 · strings.ts conflict.person.* -->
