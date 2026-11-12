<a id="S3"></a>
# S3 Was die Forschung weiß

Das Kapitel beschreibt, was die App über eine Person aus der Forschung zeigt: den Dialog **Was die Forschung weiß**
mit den Abschnitten **Über der Person**, **Widersprüche**, **Hypothesen** und **Durchsucht** und den gleichnamigen
Abschnitt im Panel der Forschung. Beschrieben werden die Strom-App 3.21.2 (und die Forschung 1.25.2). Änderungen aus einer neueren Version tragen deren Nummer.

<a id="S3.1"></a>
## S3.1 Was die Forschung weiß liest nur, was die Forschung gesendet hat

Die Forschung fügt zu jeder Person in den Stammbaum für die App besondere Blöcke hinzu: Widersprüche, Hypothesen,
durchsuchte Quellen und den Rand des Stammbaums über der Person. Die App zeigt sie nur an. Nichts davon ändert sich in
der App, und die App sendet sie nicht zurück; sie leben in der Forschung. Der Kopf des Dialogs trägt das Datum der
Forschung „Stand …“.

- **Woher:** von der Brücke (der Stammbaum, den die App aus der laufenden Forschung lädt, siehe
  [S1](S1-connecting-app-and-research.md)) oder aus der Datei `output/tree-strom.ged`. Beides entsteht durch
  denselben Export der Forschung.
- **Was der Dialog nicht zeigt:**
  - die Grade der Sicherheit von Angaben ([R3.1](R3-verification-and-citation.md#R3.1)) und die Belege
    ([R3.8](R3-verification-and-citation.md#R3.8));
  - **Wartet auf Bearbeitung** ([R6](R6-awaiting-action.md));
  - Linien und die Warteschlange als Ganzes ([S4](S4-research-from-the-app.md)); Linien und Aufgaben der Person
    stehen nur im Abschnitt **Über der Person** ([S3.3](#S3.3)).
- **Grenzen:**
  - Ein Stammbaum aus einem anderen Programm und eine Kopie ohne Blöcke der Forschung haben den Dialog nicht.
  - Widersprüche können aus einer neueren Version der Forschung stammen, die die App gelesen, aber noch nicht geladen
    hat ([S2](S2-edits-from-the-app.md)). Ein aus der App entschiedener Widerspruch verschwindet sofort, noch vor
    dem Laden der neuen Version. Der Dialog kann sich so von den geladenen Daten unterscheiden.
- **Bedienung:** App: nichts einzustellen. Terminal: die Datei entsteht bei jedem Schreiben der Forschung.
- **Gilt seit:** App 3.4.0 mit Forschung 1.6.0

<!-- zdroj: app:src/ged-parser.ts:185-335 _STROM_CONFLICT/_STROM_HYPO/_STROM_SEARCHED/_STROM_EDGE, :2351-2375 _STROM_ASOF · src/ged-exporter.ts (bloky nepíše) · src/ui/research-sync-ui.ts:2908-2937 researchConflictsOf, researchConflictsShown, settledConflicts · research:src/gedcom/export.ts:760-805 known() · src/commands/output.ts:94 · src/core/live.ts (hlavička: "The app never sends them back") -->

<a id="S3.1.1"></a>
### S3.1.1 Wann die Forschung die Blöcke sendet

Die Forschung fügt die Blöcke nur in den Stammbaum für die Strom-App ein, und nur wenn die App den jeweiligen Teil
zeigen kann. Sie richtet sich nach der Version der App, die sie kennt.

| Teil | App seit | Forschung seit |
|---|---|---|
| Widersprüche, durchsuchte Quellen, „Stand“ | 3.4.0 | 1.6.0 |
| **Über der Person** | 3.6.0 | 1.9.0 |
| Hypothesen mit Versionen und dem Schalter **Zeigen** | 3.11.0 | 1.14.0 |

- **Grenzen:** eine unbekannte Version der App und eine andere Kopie der App (eigene Adresse der App) gelten als
  aktuell.
- **Gilt seit:** Forschung 1.6.0

<!-- zdroj: research:src/core/stromapp.ts APP_OPENS_LINKS="3.4.0", APP_SHOWS_EDGES="3.6.0", APP_SHOWS_HYPOTHESIS_LINKS="3.11.0" · src/commands/output.ts:94 appOpensLinks, appShowsEdges -->

<a id="S3.2"></a>
## S3.2 Wo sich Was die Forschung weiß öffnet

Der Dialog öffnet sich aus dem Angebot der Person, Untermenü **Forschung → Was die Forschung weiß**. Der Eintrag ist
dort nur, wenn die Forschung über die Person etwas weiß: mindestens einen Widerspruch, eine Hypothese, eine
durchsuchte Quelle oder den Abschnitt **Über der Person**. Offene Widersprüche trägt er als Zahl, z. B.
„2 Widersprüche“.

- **Weitere Wege in den Dialog** (jeder öffnet ihn an seiner Stelle):
  - die Marke **Widerspruch ›** an einem Feld in der Bearbeitung der Person (bei Geburts- und Sterbedatum und -ort,
    Name, Geschlecht, Titel und Namenszusatz): ein Widerspruch, der sich durch eine Seite entscheiden lässt,
    öffnet die Karte des Widerspruchs, sonst den Dialog;
  - das Angebot der Person, der Block der Signale „n Widersprüche · n Hypothesen“ mit dem Link **Was die Forschung
    weiß ›**;
  - der offene Ansatz des Forschungsrands über der Karte öffnet den Abschnitt **Über der Person** ([S3.3](#S3.3));
  - bei einer nur in der Ansicht verbundenen Beziehung **Was die Forschung zur Verbindung weiß** und die
    Beschriftung der Linie „nicht belegt“ ([S3.5.1](#S3.5.1));
  - die Karte des Widerspruchs, **Mehr unter Was die Forschung weiß ›**;
  - die Zeile des Abschnitts im Panel der Forschung ([S3.7](#S3.7)).
- **Grenzen:**
  - Lesen geht überall: auf dem Telefon, in einem gesperrten Stammbaum und auch schreibgeschützt.
  - Schaltflächen, die die Forschung öffnen, gibt es nur am Computer (Gerät ohne Touch-Zeiger), mit eingeschaltetem
    **Strom Research auf diesem Computer** und nur die, die die Forschung gemeldet hat
    ([S1](S1-connecting-app-and-research.md)).
  - Eine Insel allein (Familie außerhalb des Stammbaums) fügt keinen Eintrag ins Angebot ein.
- **Bedienung:** App: Angebot der Person → **Forschung → Was die Forschung weiß**.
- **Gilt seit:** App 3.4.0
- **Ab App 3.22.0:** im Untermenü **Forschung** stehen oben die Linien, in denen die Person ist.

<!-- zdroj: app:src/ui/person-research-ui.ts:140-150 personResearchKnows, markResearchConflicts · src/ui/context-menu.ts personSection · src/ui/card-signals-ui.ts · src/card-signals.ts:171-194 · src/ui/view-links-ui.ts:326 · src/renderer.ts:5479 · src/ui/research-edge-ui.ts:205, :364 · src/ui/conflict-panel-ui.ts:274 · src/ui/research-ui.ts:2119 researchLinkAvailable · HEAD context-menu.ts personInLineItems (spec 038 §5.1) -->

<a id="S3.3"></a>
## S3.3 Über der Person zeigt, wo der Stammbaum endet und was weiter geschieht

Der Abschnitt steht bei einer Person, über der der Stammbaum nicht weitergeht: sie hat keine Eltern, nur einen
Elternteil, oder kein Eintrag belegt die Eltern. Er sagt, warum die Suche hier steht und was weiter geschieht.

- **Warum es endet:** z. B. „Vater im Eintrag nicht genannt“, „Die Matriken sind nicht erhalten“, „Bekannte
  Matriken beginnen 1784“, „Lücke in den Matriken“, „Durchsucht, nicht gefunden“, „Ein Archiv bleibt“, „Teilweise
  durchsucht“, „Noch nicht gesucht“, „Geburtsort unbekannt“, „Die Eltern sind durch keinen Eintrag belegt“. Eine
  Grenze der Linie ersetzt es: „Hier endet das Limit der Richtung“, „Die Richtung ist pausiert“, „Die Richtung ist
  beendet“, „Wahrscheinlich lebend, wird nicht erforscht“ ([R2.1.2](R2-lines-and-queue.md#R2.1.2)).
- **Was weiter geschieht:** „Der Agent arbeitet gerade daran“, „Wartet auf Antwort“, „In der Warteschlange als 3.“,
  „Eine Aufgabe kommt mit der nächsten Sitzung“, „Wartet außerhalb der Warteschlange (pausierte Richtung)“, „Strom
  hat nichts mehr vorzuschlagen. Jetzt ist eine eigene Entscheidung gefragt.“, „Nichts ist geplant“. Die App
  berechnet das live aus dem, was die Forschung gerade tut.
- **Zeitleiste „Taufe 1780–1800“:** die Jahre, in denen die Taufe gesucht wird, mit der Legende *durchsucht, nicht
  gefunden* / *keine Matriken* / *nicht durchsucht* und einer Schätzung des Geburtsjahrs (▲, z. B. „geschätzt 1790
  aus der Heirat 1815“).
- **Bekannte Geburtsbücher** mit Zugang: *kostenlos online*, *online, Anmeldung*, *Lesesaal*, *auf Anfrage*,
  *nicht erhalten*.
- **Aufgaben:** Platz in der Warteschlange oder warum sie steht (*pausierte Richtung*, *beendete Richtung*, *Familie
  außerhalb des Baums*, *zurückgestellt bis …*); erledigte unter **Versuchte Aufgaben · n**.
- **Arbeit:** Zahl der Suchen, Zahl der Sitzungen des Agenten mit Kosten, „zuletzt …“. Im Archiv gibt es
  weder Sitzungen noch Kosten.
- **Hypothesen:** mögliche Verbindung zu einer anderen Person, Familie außerhalb des Stammbaums („Familie außerhalb
  des Baums, 4 Personen“), wie viele Aufgaben warten, welche Aufgaben die Hypothese testen.
- Der Link „2 offene Widersprüche ↓“ springt zum Abschnitt **Widersprüche**.
- **Grenzen:** „Stand …“ steht im Kopf des Abschnitts nur, wenn die Forschung älter als heute ist.
- **Bedienung:** App: **Einstellungen → Stammbaumansicht → Forschungsrand** (*Aus* / *Zu entscheiden* / *Alle*)
  steuert nur die offenen Ansätze über den Karten, nicht diesen Abschnitt. Die Auswahl gibt es nur bei einem
  Stammbaum aus der Forschung. *Zu entscheiden* fehlt bei einer Kopie, die keine Warteschlange hat. Terminal:
  `strom edge`.
- **Gilt seit:** App 3.6.0 mit Forschung 1.9.0; mehrere Familien außerhalb des Stammbaums seit App 3.13.0 mit
  Forschung 1.16.0

<!-- zdroj: app:src/ui/research-edge-ui.ts researchEdgeSectionHtml, :372-373 stale asOf, :445-448 sessions/cost, edgeOf · :560-600 nastavení · index.html:22496, :22540 · strings.ts researchEdge.* · research:src/core/edge.ts EDGE_MISSING, EDGE_SCOPES, EDGE_ENDS, EDGE_NEXT · CHANGELOG 3.13.0 -->

<a id="S3.3.1"></a>
### S3.3.1 Aktionen bei Über der Person

| Schaltfläche | Wann sie da ist | Was sie öffnet |
|---|---|---|
| **Chat** (**Im Chat entscheiden**, wenn „Jetzt ist eine eigene Entscheidung gefragt“) | immer | ein Gespräch mit dem Agenten über die Person |
| **Überprüfung der Person** | immer | die Überprüfung der Person in der Forschung |
| **Richtung fortsetzen** | die Linie ist pausiert oder beendet | ein Terminal mit der Auswahl der Linie |
| **Antworten** | eine Aufgabe der Person wartet auf Antwort | die Aufgabe in der Forschung ([R6](R6-awaiting-action.md)) |

- **Grenzen:** nur bei einer Person aus der Forschung, nur wo die Forschung den Link gemeldet hat ([S3.2](#S3.2)). Im
  Archiv und in einer Forschung, die auf einen Agenten wartet, gibt es keine, weil jede zum Agenten führt.
- **Bedienung:** App: Schaltflächen unter dem Abschnitt.
- **Gilt seit:** App 3.6.0
- **Ab App 3.22.0:** **Richtung fortsetzen** setzt die Linie direkt über die Brücke fort, wenn die Forschung das
  kann, ohne Terminal.

<!-- zdroj: app:v3.21.2 src/ui/research-edge-ui.ts:489-506, :539-548 · HEAD research-edge-ui.ts managesDirections -->

<a id="S3.4"></a>
## S3.4 Widersprüche

Der Abschnitt **Widersprüche** zeigt die Widersprüche der Person und der Familien, in denen die Person Partner ist.
Offene stehen zuerst, dann entschiedene mit der Zeile „entschieden: … (…)“. Die Quelle lässt sich im
Quellenbetrachter öffnen. Was ein Widerspruch ist, wo er zu sehen ist und wie er entschieden wird, beschreibt
[R5.6](R5-conflicts.md#R5.6). Die Entscheidung durch eine Seite aus der App beschreibt
[R5.6.1](R5-conflicts.md#R5.6.1).

- **Grenzen:** **In der Forschung entscheiden** und **Dem Agenten überlassen** gibt es nur bei einer Person aus der
  Forschung und nur, wo die Forschung sie gemeldet hat.
  **Dem Agenten überlassen** fehlt im Archiv und in einer Forschung, die auf einen Agenten wartet.
- **Bedienung:** siehe [R5.6](R5-conflicts.md#R5.6).
- **Gilt seit:** App 3.4.0 mit Forschung 1.6.0
- **Ab App 3.22.0:** ein durch eine Änderung in der App entstandener Widerspruch trägt den Text „Eine Änderung in
  der App weicht hier von der Forschung ab; entschieden wird in der Forschung.“ (bisher immer „Hier widersprechen
  sich die Quellen; entschieden wird in der Forschung.“).

<!-- zdroj: app:src/ui/person-research-ui.ts showPersonResearchDialog (Rozpory), activeResearchNoAgent · research:src/gedcom/export.ts:760-805 · HEAD person-research-ui.ts conflictFromEdit, strings.ts conflict.editOnly · HEAD research-decide.ts conflictFromEdit -->

<a id="S3.5"></a>
## S3.5 Hypothesen

Der Abschnitt **Hypothesen** zeigt die Hypothesen, die die Person betreffen: sie ist ihr Gegenstand, oder eine
Version nennt sie. Jede Hypothese ist aufklappbar. Unter dem Namen stehen Nummer und Stand: *offen*, *entschieden für
B*, *verworfen*, die Zahl der Versionen und eine Notiz. Offene sind aufgeklappt.

- **Zeile einer Version:** Buchstabe und Behauptung (eine lange klappt auf) und was die Version mit dem Stammbaum tut:
  „gezeigt · + 2 Personen · Finden“, „+ 2 Personen“, „So steht es schon im Stammbaum“, „Nur Text, nicht
  darstellbar.“, „keine Verbindung zu Personen im Baum“, bei einer entschiedenen *gewählt*, „Jetzt wirklich
  verbunden“, „Nicht mehr gültig: …“.
- **Welche Hypothesen die Forschung sendet:** offene; entschiedene und verworfene nur die, deren Versionen
  Verbindungen tragen, und einer App, die Hypothesen entscheidet ([S3.5.2](#S3.5.2)), auch die, die sich in der App
  entscheiden lassen, auch ohne Verbindung (damit sie sich ändern und wieder öffnen lassen). Zurückgezogene nie.
- **Wer entschieden hat:** eine Hypothese, die der Agent entschieden hat ([R10.3.2](R10-people-and-hypotheses.md#R10.3.2)),
  trägt *vom Agenten entschieden* mit dem Tag und **Begründung** (der Text der Entscheidung in der Sprache der
  Forschung; ein langer klappt auf).
- **Grenzen:** eine Hypothese lässt sich aus der App durch die Wahl einer Version entscheiden, die das Terminal der
  Forschung bestätigt ([S3.5.2](#S3.5.2)); sonst wird in der Forschung entschieden
  ([R10.3.1](R10-people-and-hypotheses.md#R10.3.1)). Wer entscheidet, der Mensch oder der Agent, ist eine Wahl der
  Forschung ([R10.3.2](R10-people-and-hypotheses.md#R10.3.2)).
- **Angebot Die KI entscheidet:** bei gespeichertem **Der Mensch entscheidet** und 10 oder mehr offenen Hypothesen
  im Stammbaum steht über den Hypothesen der Satz „N offene Hypothesen warten auf die Entscheidung eines Menschen;
  mit „Die KI entscheidet“ entscheidet der Agent sie selbst, jede mit Begründung.“ Das Umstellen wird in der
  Forschung bestätigt, in der App wird die KI nicht eingeschaltet ([R10.3.2](R10-people-and-hypotheses.md#R10.3.2)).
- **Bedienung:** App: Schalter **Zeigen** bei der Version ([S3.5.1](#S3.5.1)); **Wählen** bei der Version und die
  weiteren Wahlmöglichkeiten ([S3.5.2](#S3.5.2)); **In der Forschung entscheiden**, bei einer entschiedenen **In der
  Forschung ändern**, öffnet die Hypothese in der Forschung auf diesem Computer; **Auf „Die KI entscheidet“ umstellen**
  öffnet die Forschung im Terminal, **Ausblenden** blendet das Angebot für diese Forschung aus.
- **Gilt seit:** App 3.11.0 mit Forschung 1.14.0 (Versionen, Stand, **Zeigen**); Liste der Hypothesen seit App 3.4.0
- **Ab App 3.25.0:** *vom Agenten entschieden* mit Begründung (mit Forschung 1.29.0), **In der Forschung
  entscheiden**, **In der Forschung ändern** und das Angebot **Die KI entscheidet**.
- **Ab App 3.27.0:** mit Forschung 1.31.0 die Entscheidung durch die Wahl einer Version direkt auf der Karte
  ([S3.5.2](#S3.5.2)).

<!-- zdroj: app:src/ui/person-research-ui.ts researchHypothesesHtml · strings.ts research.hypo*, hypoByAgent, hypoReason, hypoChange, decideInResearch, viewLinks.*, hypoOfferAgent, hypoOfferSwitch, hypoOfferHide · person-research-ui.ts researchHypothesesOffer (HYPOTHESES_OFFER_MIN = 10) · research:src/gedcom/export.ts:309-325 hypothesisPeople, _BY agent / DECI / _AT (brána APP_SHOWS_HYPOTHESIS_DECIDER) · CHANGELOG 3.11.0, 3.25.0 -->

<a id="S3.5.1"></a>
### S3.5.1 Zeigen: nur in der Ansicht verbunden

Der Schalter **Zeigen** zeichnet eine Version der Hypothese in den Stammbaum als „Nur in der Ansicht verbunden“. Die
Daten des Stammbaums ändern sich dadurch nicht. Versionen einer Hypothese schließen sich aus; eingeschaltet kann
höchstens eine sein oder keine.

- **Grenzen:**
  - den Schalter gibt es nur bei einer offenen Hypothese und nur bei einer Version, die sich zeichnen lässt;
  - gezeichnet wird nur in den Ansichten Familie und Nachkommen ([A6](A6-views.md));
  - die Auswahl gehört zum Gerät und zum Stammbaum; sie geht mit einer Sicherung von allem, nicht mit einer Kopie des
    Stammbaums;
  - mit der Brücke nur, wenn die Forschung Verbindungen von Hypothesen sendet.
- **Bedienung:** App: **Zeigen** im Dialog; bei einer gezeichneten Verbindung das Angebot **Was die Forschung zur
  Verbindung weiß**.
- **Gilt seit:** App 3.11.0 mit Forschung 1.14.0

<!-- zdroj: app:src/view-links.ts strom-view-links:{treeId}, strom-view-links-master:{treeId}, viewLinksAvailable (HYPOTHESIS_LINKS) · src/ui/view-links-ui.ts:326 · strings.ts viewLinks.state -->

<a id="S3.5.2"></a>
### S3.5.2 Eine Hypothese in der App entscheiden

Die Karte einer Hypothese in **Was die Forschung weiß** lässt die Hypothese entscheiden: bei jeder Version steht
**Wählen**. Jede Wahl öffnet das Terminal der Forschung, wo sie bestätigt wird
([R10.3.3](R10-people-and-hypotheses.md#R10.3.3)); bis zur Bestätigung ändert sich in der App nichts.

- **Karte:** Versionen mit **Dafür:** und **Dagegen:** und **Quellen (n)** (die Quellen, die die Version nennt); der
  Vorschlag des Agenten („vom Agenten vorgeschlagen: B“) mit **Vorschlag B annehmen**, beim Verwerfen **Annehmen:
  keine Version trifft zu**; unter den Versionen **Keine Version trifft zu** und **Offen lassen**. Eine Version, die
  50 und mehr Personen verbindet, hat ein Etikett („verbindet 214 Personen“). Bei einer Version kann stehen, was sie
  mit dem Stammbaum tut: bei einer Version, die niemanden verbindet, „Der Stammbaum ändert sich nicht, nur die
  Entscheidung wird eingetragen.“ (derselbe Satz wie beim Warten und in **Wartet auf Bearbeitung**; beim Wechsel von
  einer Version mit Verknüpfung erscheint er nicht, die Verknüpfung verschwindet aus dem Stammbaum), bei einer Version,
  deren Verknüpfungen der Stammbaum schon hat, „Der Stammbaum bleibt, wie er ist; die Forschung trägt nur die
  Entscheidung ein.“ und bei einer Version, bei der die alte Verknüpfung bleibt, „Der Stammbaum ändert sich nicht: Die
  alte Verknüpfung bleibt, auf ihr baut weitere Arbeit auf.“
- **Hypothese ohne Verbindung:** eine Hypothese, deren Versionen niemanden mit dem Stammbaum verbinden (etwa woher
  eine Person kam), wird genauso entschieden. Der Stammbaum ändert sich nicht, die Forschung trägt nur die
  Entscheidung ein.
- **Warten:** „Wartet auf Bestätigung in der Forschung“ und „Im Terminal der Forschung zu bestätigen (Enter = ja):
  H0001 für Version B entscheiden. Danach fragt das Terminal optional nach einer Begründung. Bis zur Bestätigung
  ändert sich hier nichts.“ Bei einer Version, die niemanden verbindet und keine Verbindung einer früheren
  Entscheidung aus dem Stammbaum nimmt, kommt hinzu: „Der Stammbaum ändert sich nicht, nur die Entscheidung wird
  eingetragen.“ Nach 10 Minuten „Von der Forschung noch nicht bestätigt“: „Seit über 10 Minuten keine
  Bestätigung. Das Terminal ist womöglich geschlossen geblieben; „Erneut öffnen“ fragt noch einmal.“ mit **Erneut
  öffnen** und **Warten beenden**. Hat die Forschung inzwischen anders entschieden: „In der Forschung bereits
  entschieden: A“.
- **Nach der Bestätigung** lädt die App die neue Version der Forschung (die Verbindungen hat die Forschung
  geschrieben), und der Stammbaum wird aktualisiert; die Meldung „Hypothese H0001 entschieden: B“, auf der Karte „in
  der App entschieden“. Hat die Version der Forschung auch andere Änderungen, fragt die App (**Laden** oder
  **Später**: „der Stammbaum bleibt vorerst unverändert“); vor dem Laden legt sie eine Sicherung an. Nach einer
  Entscheidung schaltet die App **Zeigen** ([S3.5.1](#S3.5.1)) bei den anderen Hypothesen derselben Person aus; nach
  der Wahl einer Version, die niemanden verbindet, bleiben sie gezeigt.
- **Entschiedene Hypothese:** „Gilt seit {Tag}: B“ und frühere Entscheidungen („vorher: A, …“). **Ändern** zeigt die
  Versionen wieder mit **Wählen** (**Änderung abbrechen**; nach der Begründung der Änderung fragt das Terminal).
  **Wieder öffnen** sagt, was sich im Stammbaum ändert („Die Verbindung von 2 Personen verschwindet aus dem
  Stammbaum.“, „Im Stammbaum ändert sich nichts.“). Wo sich nicht wieder öffnen lässt, steht statt der Schaltfläche der
  Grund („Wieder öffnen geht nicht: Auf der Verbindung, die die Entscheidung eingetragen hat, baut weitere Arbeit auf
  (2 Verknüpfungen). Ändern ist möglich.“) und der Link **In der Forschung entscheiden**.
- **Wartet auf Bearbeitung:** Hypothesen zu entscheiden stehen in der Gruppe **Hypothesen zu entscheiden**
  (Chip **Entscheidungen**, [S4.4](S4-research-from-the-app.md#S4.4)): „H0022 · Frage“, der Vorschlag des Agenten mit **Vorschlag B annehmen**
  und **Offen lassen** oder die Versionen mit **Wählen**; **Mehr ›** öffnet die Karte bei der Person. Mit einer
  Forschung, die Vorschläge auf einmal annimmt: ein Kästchen bei einer Hypothese mit Vorschlag, **Alle mit Vorschlag
  auswählen**, „n ausgewählt.“ (bei einer großen Verbindung „Große Verbindung: H0001 → B verbindet 214 Personen.“) und **Vorschläge annehmen (n)**, höchstens 50 auf einmal
  („Höchstens 50 auf einmal.“). Das Terminal bestätigt einmal; die Meldung sagt, wie viele Vorschläge angenommen
  wurden. Bei einer Hypothese, die sich hier nicht entscheiden lässt: „Hier entscheidet nur die Forschung.“ Ändert
  keine Wahl einer Zeile den Stammbaum, steht darunter einmal „Der Stammbaum ändert sich nicht, nur die Entscheidung
  wird eingetragen.“; lassen nur manche Versionen ihn unverändert, steht es bei jeder von ihnen.
- **Rand des Stammbaums:** die Blase „?“ an einem Rand mit Hypothese hat bei den Versionen ebenfalls **Wählen**.
- **Grenzen:**
  - die Wahlmöglichkeiten gibt es nur mit einer Forschung auf diesem Computer, die sie kann; auf Telefon, Tablet und im
    Browser anderswo liest die Karte nur („Entschieden wird auf dem Computer mit der Forschung.“), eine
    schreibgeschützte Kopie ebenso;
  - eine Version, die Personen zusammenführt oder Geschwister macht: „Über das Zusammenführen von Personen wird in der
    Forschung entschieden.“;
  - mit einer älteren Forschung bleibt die Karte wie bisher, mit **In der Forschung entscheiden** ([S3.5](#S3.5)).
- **Bedienung:** **Was die Forschung weiß** → **Hypothesen**: **Wählen**, **Vorschlag … annehmen**, **Keine Version
  trifft zu**, **Offen lassen**, **Ändern**, **Wieder öffnen**; **Wartet auf Bearbeitung** → **Hypothesen zu entscheiden**.
  Wahlmöglichkeiten, die das Terminal öffnen, tragen seine Marke ([S4.5.1](S4-research-from-the-app.md#S4.5.1)).
- **Gilt seit:** App 3.27.0 mit Forschung 1.31.0

<!-- zdroj: app:src/research-hypothesis-pick.ts hypothesisPickable (pick | old | remote | readonly | merge; HYPOTHESIS_DECIDE_LINK_FEATURE), HYPOTHESIS_BIG_JOIN = 50, hypothesisLinkUrl, hypothesesAcceptUrl, hypothesisChoiceStays, hypothesisCannotReopen · src/ui/person-research-ui.ts (verze s Vybrat, Pro/Proti, Zdroje, návrh, Žádná verze neplatí, Nechat otevřenou, Změnit, Zrušit změnu, Vrátit na otevřenou, nejde vrátit → Rozhodnout ve výzkumu, hypoRemote, hypoMerge) · src/ui/hypothesis-wait-ui.ts, src/research-hypothesis-wait.ts (čekání, 10 min, Otevřít znovu, Zrušit čekání; Načíst / Později se zálohou) · src/ui/hypothesis-waiting-ui.ts (Co čeká: Rozhodnout, Přijmout návrh, Nechat otevřenou, Vybrat, Víc ›, Vybrat vše s návrhem, Přijmout návrhy (n), ≤ 50, Tady rozhoduje jen výzkum.) · src/ui/research-edge-ui.ts (bublina kraje, Vybrat) · strings.ts research.hypoPick, hypoPickAria, hypoNone, hypoLeave, hypoProposal, hypoAccept, hypoAcceptNone, hypoFor, hypoAgainst, hypoSources, hypoWait, hypoWaitAsk, hypoWaitLong, hypoWaitLongText, hypoWaitAgain, hypoWaitStop, hypoChangeReason, hypoDecidedToast, hypoElsewhere, hypoByApp, hypoLoadLater, hypoLoad, hypoChangeHere, hypoChangeCancel, hypoHoldsSince, hypoBefore, hypoReopen, hypoReopenLoss, hypoReopenNone, hypoCannotReopenWork, hypoStaysNote, hypoBig, hypoInTreeNote, hypoKeepsTree, hypoMerge, hypoRemote, hypoAcceptMany, hypoSelectAll, hypoOnlyResearch, hypoAcceptMax, hypoSelected, decide · commity b6cd39f2, 92383f57, 4ed3251a, 8d7f1597, 364df0cd · spec 074 · K1.6 (verze bez vazby): app 91b16655 research-hypothesis-pick.ts hypothesisVariantLinksNobody, hypothesisChoiceKeepsTree (otevřená, zrušená, dřív zvolená verze také bez vazby, _STAYS) · src/research-hypotheses.ts (čekací text + hypoKeepsTree) · src/research-hypothesis-waiting.ts plan.keepsTree, versions[].keepsTree · src/ui/hypothesis-waiting-ui.ts hwr-keeps, hwr-version-note · src/ui/hypothesis-wait-ui.ts researchHypothesisUnlinkOthers (ne u verze bez vazby) · research c769f2eb export.ts (rozhodnuté/zrušené pickableInApp s hypothesisPick) · karta: app 7a222325 src/research-hypothesis-card.ts variantNote (noLink jen když hypothesisChoiceKeepsTree → hypoKeepsTree; hypoNoLinkNote zrušen) · CHANGELOG.cs.md 3.27.0 -->

<a id="S3.6"></a>
## S3.6 Durchsucht

Der Abschnitt **Durchsucht** ist eine Tabelle der Suchen, die die Forschung zur Person geschrieben hat: **Eintrag**,
**Jahre**, **Ergebnis** (*gefunden* / *nichts*). Sortiert wird nach dem ersten Jahr. Dazu gehören Suchen aus
Aufgaben, deren Gegenstand die Person ist.

- **Grenzen:** die Forschung unterscheidet mehr Ergebnisse, als die App zeigt. *gefunden* ist nur ein gefundener
  Eintrag. Alles andere, auch eine teilweise Suche oder eine ohne Schluss, ist *nichts*. Was eine Suche ohne
  Ergebnis ist, beschreibt [R3.6](R3-verification-and-citation.md#R3.6).
- **Bedienung:** App: nur lesen. Terminal: Suchen schreibt der Agent.
- **Gilt seit:** App 3.4.0 mit Forschung 1.6.0

<!-- zdroj: app:src/ui/person-research-ui.ts (Prohledáno) · src/ged-parser.ts _STROM_SEARCHED (TITL, DATE, RESN, _AT) · research:src/gedcom/export.ts:760-805 RESN found|none · strings.ts research.searched*, found, none -->

<a id="S3.7"></a>
## S3.7 Abschnitt Was die Forschung weiß im Panel der Forschung

Das Panel der Forschung hat den Abschnitt **Was die Forschung weiß** mit der Zusammenfassung „3 Widersprüche ·
1 Hypothese“. Er hat eine Zeile für jeden offenen Widerspruch („Marie Vlková · Geburt: 1790 × 1791“) und dann für
jede offene Hypothese („Marie Vlková · Hypothese: Otec z Horákova mlýna“). Ein Klick öffnet den Dialog der Person
beim jeweiligen Widerspruch oder bei der Hypothese.

- **Grenzen:**
  - das Panel ist nur beim Live-Verfolgen einer Forschung zu sehen, die nicht beendet ist und zum geöffneten
    Stammbaum gehört ([S4](S4-research-from-the-app.md));
  - ohne offene Widersprüche und Hypothesen gibt es den Abschnitt nicht.
- **Bedienung:** App: Panel der Forschung, Abschnitt **Was die Forschung weiß**.
- **Gilt seit:** App 3.5.0

<!-- zdroj: app:src/ui/research-overview-ui.ts appendOverviewKnows · strings.ts live.knowsTitle, live.hypothesisRow · commit 228ac6a -->
