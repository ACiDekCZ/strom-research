<a id="A10"></a>
# A10 Ein Ereignis mehrerer Personen

Eine Volkszählung, ein Wohnort oder eine Auswanderung eines ganzen Haushalts wird einmal eingetragen und gilt für
alle, die dabei waren. Ein Pate, Zeuge oder Trauender, der beim Ereignis einer anderen Person eingetragen ist,
erscheint auch im Leben des Paten, wenn er mit einer Person im Stammbaum verknüpft ist. Das Kapitel beschreibt die
Strom-App 3.28.0 und die Forschung 1.32.0. Wie ein gemeinsames Ereignis in GEDCOM gelesen und geschrieben wird, sagen
[A2.1](A2-loading-a-family-tree.md#A2.1) und [A2.7](A2-loading-a-family-tree.md#A2.7).

<!-- zdroj: dirigent:spec/085-sdilena-udalost U9, K1.1–K1.6, K2.1–K2.2 · app:1c4b7d19..e832e6e2 (dirigent:prace/1113-app-sdilena-udalost), app:f1d56989..80c2ffb9 (dirigent:prace/1113-app-085-nalezy) · app:CHANGELOG 3.28.0 -->

<a id="A10.1"></a>
## A10.1 Ein gemeinsames Ereignis: Gemeinsam mit

Ein Ereignis, das mehrere Personen zugleich erlebt haben, wird einmal eingetragen. Jede Person hat ihre eigene Kopie,
die gemeinsamen Angaben sind in allen Kopien gleich, und eine Änderung einer beliebigen Kopie gilt für alle.

- **Welche Ereignisse:** **Volkszählung**, **Wohnort**, **Auswanderung**, **Einwanderung**, **Militärdienst**,
  **Einbürgerung** und **Eigenes** (mit ausgefüllter Bezeichnung). Geburt, Taufe, Heirat, Tod und weitere Ereignisse
  gehören immer einer Person; bei ihnen werden die anderen als Paten und Zeugen eingetragen ([A10.5](#A10.5)).
- **Gemeinsame Angaben:** Art, Bezeichnung eines eigenen Ereignisses, Datum, Ort, Haus, Notiz, Quellen und
  Zitatqualität. **Jede Person für sich:** das Alter laut Eintrag, die Rolle beim Ereignis, der Forschungsstand und
  die Prüfung.
- **Grenzen:**
  - eine Änderung einer gemeinsamen Angabe wird in allen Kopien als ein Schritt **Rückgängig** gespeichert
    („{Ereignis}: bei N Personen gespeichert.“). Ist eine der Personen gesperrt, wird nichts gespeichert („Nichts
    gespeichert: Eine der Personen ist gesperrt, oder diese Ereignisart gehört nur zu einer Person.“);
  - solange weitere Personen das Ereignis teilen, lässt es sich nicht in eine Art nur für eine Person ändern: in der
    Auswahl der Art steht die Gruppe **Nur für eine Person** mit der Erklärung „Diese Arten lassen sich nicht teilen.
    Zuerst die anderen aus „Gemeinsam mit“ entfernen oder abtrennen (N).“;
  - die Rolle hat jede Person für sich: voreingestellt **Haushaltsmitglied**, oder **Andere Rolle…** mit einem
    eigenen Wort (Untermieter, Gesinde…);
  - bei 7 und mehr weiteren Personen zeigt die Liste die ersten 5 und **N weitere anzeigen** (zurück **Weniger
    anzeigen**);
  - das Löschen einer Person löscht nur ihre Kopie; die Bestätigung nennt „Gemeinsame Ereignisse bleiben bei den
    anderen:“ (höchstens 5 Zeilen, dann „…“). Eine Kopie, die als einzige bleibt, ist ein gewöhnliches Ereignis ihrer
    Person;
  - eine lebende Person, die der Schutz lebender Personen ([A7](A7-book-pages-and-export.md)) schützt, wird bei einem
    gemeinsamen Ereignis im Buch, auf den Seiten und im Export weder genannt noch gezählt.
- **Bedienung:** Bearbeiten eines Ereignisses der Person, der Abschnitt **Gemeinsam mit** mit den Spalten
  **Person**, **Rolle** und **Alter** und dem Hinweis „Datum, Ort, Haus, Notiz und Quellen gelten für alle. Das Alter
  hat jede Person für sich.“ Bei einem Ereignis mehrerer Personen steht über dem Formular die Leiste „Gemeinsames
  Ereignis von N Personen – Änderungen gelten für alle“.
  - das Menü der Zeile einer Person: **Person öffnen**, **Abtrennen (eigene Kopie behalten)** („Die Kopie bleibt,
    weitere Änderungen betreffen sie nicht.“), **Aus dem Ereignis entfernen** („Bei dieser Person verschwindet das
    Ereignis, bei den anderen bleibt es.“). Entfernen und Abtrennen werden mit den übrigen Änderungen als ein Schritt
    **Rückgängig** gespeichert;
  - Löschen in der Fußzeile: **Nur bei dieser Person löschen** („Bei den anderen N bleibt es.“), **Diese Person
    abtrennen**, **Bei allen N Personen löschen…** (die Bestätigung nennt die Personen, bei denen das Ereignis
    verschwindet). Beides lässt sich mit **Rückgängig** zurücknehmen.
- **Gilt seit:** App 3.28.0

<!-- zdroj: app:80c2ffb9 src/events.ts SHAREABLE_EVENT_TYPES (census, residence, emigration, immigration, military, naturalization, custom), SHARED_EVENT_COMMON_FIELDS (type, customLabel, date, place, address, note, sourceIds, citationQuay) · src/types.ts LifeEvent.shareId, shareRole · src/shared-events.ts, src/shared-event-editor.ts · src/ui/shared-event-ui.ts LARGE_HOUSEHOLD 7, SHOWN 5, openSharedRowMenu, openSharedDeleteMenu, sharedTakeOut, sharedDeleteAll · strings.ts events.sharedWith, sharedWithHint, sharedBanner, sharedCol*, sharedRoleDefault, sharedRoleOther, sharedRolePlaceholder, sharedShowMore, sharedShowLess, sharedOpenPerson, sharedSeparate(Hint), sharedRemove(Hint), sharedSeparateSelf, sharedDeleteSelf(Hint), sharedDeleteAll(Title, Lead), undoHint, sharedTypeLocked(Hint), sharedSaved, sharedSaveRefused, personDelete deleteShared · spec 085 K1.1–K1.3 · dirigent:prace/1113-app-sdilena-udalost Výsledek -->

<a id="A10.1.1"></a>
### A10.1.1 Person hinzufügen

**Person hinzufügen** im Abschnitt **Gemeinsam mit** öffnet eine Auswahl von Personen. Darin ist nichts im Voraus
angehakt.

- **Familie:** ohne Suchtext bietet sie die Gruppe „Familie · wer am {Datum} lebte“ an: Partner, Kinder, Eltern und
  Geschwister der Person, ohne Platzhalterpersonen. Wer im Jahr des Ereignisses nicht lebte, ist nicht darin, und die
  Auswahl sagt es („Ohne N Personen, die zum Datum nicht mehr lebten: …“, höchstens 3 Namen mit dem Todesjahr).
- **Suche:** sucht im ganzen Stammbaum, höchstens 50 Ergebnisse. Wer schon in **Gemeinsam mit** ist, hat „schon bei
  „Gemeinsam mit““. Ohne Ergebnis bietet sie **Neue Person „…“ anlegen** an und erinnert: „Wer nicht in den
  Stammbaum gehört (Untermieter, Gesinde), kommt nur in die Notiz des Ereignisses.“ **Anlegen und hinzufügen** legt
  die Person an und fügt sie hinzu.
- **Eine Person, die dasselbe Ereignis schon hat:** die Zeile zeigt „hat {Ereignis} bereits – wird verbunden“. Nach
  dem Speichern wird ihr eigener Eintrag an das gemeinsame Ereignis angeschlossen, und es entsteht keine neue Kopie;
  Alter und eigene Angaben der Person bleiben. Weichen ihre gemeinsamen Angaben ab, wird **Angleichen…** angeboten
  ([A10.3](#A10.3)).
- **Dasselbe Ereignis** heißt:
  - dieselbe Art (bei einem eigenen Ereignis auch dieselbe Bezeichnung);
  - ein vollständiges Datum: Tag, Monat und Jahr, ohne „etwa“, Zeitspanne oder Zeitraum;
  - derselbe Ort (ohne Rücksicht auf Leerzeichen an den Enden und auf Groß- und Kleinschreibung);
  - dasselbe Haus, oder ein Haus, das nur bei einem Eintrag steht (das verbundene Ereignis übernimmt es). Zwei
    verschiedene Häuser sind nie dasselbe Ereignis.
- **Bedienung:** **Hinzufügen (n)** fügt die gewählten Personen hinzu; sie werden mit dem Ereignis gespeichert.
- **Gilt seit:** App 3.28.0

<!-- zdroj: app:80c2ffb9 src/ui/shared-event-ui.ts showSharedPicker, familyCandidates (partneři, děti, rodiče, sourozenci, bez zástupných, živí k roku), hledání max 50 · src/shared-events.ts sameEventKey, isSameEvent (SHAREABLE, vlastní s názvem, úplné datum bez kvalifikátoru, místo trim + bez velikosti, dům shodný nebo jen u jednoho) · strings.ts personPicker.family, familyAlive, familyHidden, alreadyShared, joinsOwnRecord, createNamed, noteHint, addN, createAdd · spec 085 K1.6 a · dirigent:prace/1113-app-085-nalezy -->

<a id="A10.2"></a>
## A10.2 Wo ein gemeinsames Ereignis erscheint

Ein gemeinsames Ereignis steht im Leben jeder Person, die es hat. Wo mehrere Personen des Ereignisses an einer Stelle
sind, erscheint es einmal.

- **Liste der Ereignisse einer Person:** unter dem Ereignis die Zeile „mit …“: bis zu 3 Personen mit Namen, mehr als
  die ersten 2 und „und N weitere“. **Gemeinsames Ereignis öffnen** öffnet das Bearbeiten des Ereignisses.
- **Personenseite, Abschnitt Lebenslauf:** wie die übrigen Ereignisse der Person, mit der Zeile „mit …“.
- **Karte:** in der Blase eines Ortes ist das gemeinsame Ereignis eine Zeile mit allen Personen.
- **Zeitleiste der Familie:** einmal.
- **Buch und Familienseiten:** der Block **Familie gemeinsam**, wenn alle Personen des Ereignisses in dieser Familie
  sind (das Paar und seine Kinder), eine Zeile mit den Altern und der Quelle. Die Zeitleisten der Partner lassen
  dasselbe Ereignis dann aus. Eine Volkszählung steht im Buch bei der Ausführlichkeit **Alles**, bei der
  voreingestellten **Normal** nicht.
- **Tabelle:** eine Zeile ([A6.7.10](A6-views.md#A6.7.10)).
- **Grenzen:** Platzhalterpersonen und Lebende, die der Schutz lebender Personen schützt, werden in der Zeile weder
  genannt noch gezählt.
- **Gilt seit:** App 3.28.0

<!-- zdroj: app:80c2ffb9 src/shared-with-line.ts SHARED_LINE_MAX, sharedWithLine, sharedWithLineHtml, familyTogetherEvents (všechny kopie v rodině, bez zástupných a skrytých), familyTogetherLineHtml · src/book-blocks.ts familyTogetherHtml (skip pro časové osy partnerů) · strings.ts events.sharedLine, sharedLineMore, sharedLineOpen, book.familyTogether · spec 085 K1.4, §2h · dirigent:prace/1113-app-sdilena-udalost Výsledek (mapa, osa rodiny, kniha Běžně/Vše) · strings.ts book detail.normal, personPage sec.timeline -->

<a id="A10.3"></a>
## A10.3 Kopien weichen ab: Angleichen

Wenn die gemeinsamen Angaben der Kopien eines Ereignisses voneinander abweichen (zum Beispiel nach einem Import oder
Zusammenführen), sagt die App es und bietet an, sie anzugleichen. Selbst ändert sie nichts.

- **Wo:**
  - **Datenqualität**, Abschnitt **Zu prüfen**, Gruppe **Gemeinsame Ereignisse**: „{Ereignis} · {Person}: {Feld}
    weicht ab (…, bei den anderen …).“, bei mehreren Kopien „{Ereignis} · N Kopien weichen ab: …“
    ([A5.1](A5-tree-check.md#A5.1));
  - die Blase eines Befunds in der Ansicht Tabelle;
  - Bearbeiten des Ereignisses: die Leiste „Kopie weicht ab: … (…)“ mit **Vergleichen**.
- **Der Dialog Kopien angleichen · {Ereignis}:** zeigt nur die Felder, die abweichen (Art, Bezeichnung, Datum, Ort,
  Haus, Notiz, Quellen, Zitatqualität). Vorausgewählt ist der Wert der Mehrheit; bei gleicher Anzahl der Wert der
  Person, von der aus der Dialog geöffnet wurde. Ab 3 Feldern gibt es auch **Alles übernehmen von:** und eine Person.
  Die Zeile „Gleich: … Alter, Forschungsstand und Prüfung hat jede Person für sich, sie werden nicht angeglichen.“
- **Grenzen:** das Angleichen ist ein Schritt **Rückgängig**. **Abweichende Kopie abtrennen** (bei mehreren
  **Abweichende Kopien abtrennen (n)**) macht aus der abweichenden Kopie ein eigenständiges Ereignis ihrer Person.
- **Bedienung:** **Angleichen…** → **Bei N Personen angleichen**; **Öffnen** öffnet das Ereignis.
- **Gilt seit:** App 3.28.0

<!-- zdroj: app:80c2ffb9 src/shared-divergence.ts · src/validation.ts (groupShared, závažnost warning) · src/ui/tree-stats.ts · src/ui/shared-event-ui.ts (pruh sharedDiffers, sharedCompare) · strings.ts validation.groupShared, sharedDiffersOne, sharedDiffersMany, unify, separateCopy, separateCopies, openEvent, unifyTitle, unifyLead, unifyTakeAll, unifySame, unifyGo, unified, sharedFields · spec 085 §4 · dirigent:prace/1113-app-085-nalezy -->

<a id="A10.4"></a>
## A10.4 Dasselbe Ereignis getrennt eingetragen: Zu einem Ereignis verbinden

Dieselbe Volkszählung oder denselben Wohnort, bei mehreren Personen getrennt eingetragen (zum Beispiel aus einem
älteren Stammbaum oder aus einem anderen Programm), findet die Datenqualität und bietet an, sie zu verbinden. Nichts
wird von selbst verbunden, auch nicht bei einer Aktualisierung der Daten.

- **Wo:** **Datenqualität**, Abschnitt **Hinweise**:
  - eine Gruppe: „{Ereignis} {Datum}, {Ort}, {Haus} – bei N Personen getrennt eingetragen.“ (das Haus nur, wenn eingetragen) mit **Zu einem Ereignis
    verbinden**;
  - mehrere Gruppen: „N Ereignisse sind bei mehreren Personen getrennt eingetragen.“ mit **Einzeln durchgehen**. Der
    Dialog **Bei mehreren Personen getrennt eingetragene Ereignisse · N** bietet die Gruppen einzeln an: **Zu einem
    Ereignis verbinden**, **Später** (die Gruppe erscheint bis zum Schließen des Dialogs nicht wieder), **Zurück**
    (zurück zur Prüfung).
- **Grenzen:**
  - dasselbe Ereignis wird wie bei **Person hinzufügen** erkannt ([A10.1.1](#A10.1.1)). Verschiedene Häuser trennen
    die Gruppen; ein Eintrag ohne Haus wird dann an keine angeschlossen;
  - nach dem Verbinden ist es ein gemeinsames Ereignis; Alter und eigene Angaben jeder Person bleiben. Weichen die
    gemeinsamen Angaben ab, wird **Kopien angleichen** angeboten ([A10.3](#A10.3));
  - eine Gruppe, in der schon ein gemeinsames Ereignis ist, wird ihm angeschlossen („Wird dem gemeinsamen Ereignis
    von N Personen angeschlossen.“);
  - das Verbinden ist ein Schritt **Rückgängig** („{Ereignis}: bei N Personen zu einem Ereignis verbunden.“).
- **Bedienung:** **Stammbaum-Überblick → Datenqualität → Schnellaktionen → Validierungsdetails**, Abschnitt **Hinweise**.
- **Gilt seit:** App 3.28.0

<!-- zdroj: app:80c2ffb9 src/ui/same-event-join-ui.ts · src/shared-events.ts sameEventKey (domy dělí skupiny) · src/validation.ts (stopa info) · strings.ts validation.sameJoinLead, sameJoinSummary, sameJoinReview, sameJoin, sameJoinTitle, sameJoinHint, sameJoinToShare, sameJoinDone, later, nameLinkBack · spec 085 K1.6 b · dirigent:prace/1113-app-085-nalezy Výsledek -->

<a id="A10.5"></a>
## A10.5 Paten, Zeugen und weitere Beteiligte im Leben einer Person

Pate, Zeuge, Trauender und weitere Beteiligte werden bei dem Ereignis eingetragen, an dem sie beteiligt waren: bei
Taufe, Heirat, Tod. Ist ein Beteiligter mit einer Person des Stammbaums verknüpft, erscheint dieses Ereignis auch in
ihrem Leben.

- **Rollen:** **Pate/Patin**, **Zeuge**, **Amtsperson**, **Anwesend**; aus Dateien auch **Hebamme** und
  **Anzeigender**. Ein Beteiligter ist mit dem Namen eingetragen, wie er in der Quelle steht, und mit einem Detail
  (Gewerbe, „Nachbar“…).
- **Im Leben der verknüpften Person:** eine abgeleitete Zeile, zum Beispiel „Pate · Taufe: …“, „Patin · Taufe: …“,
  „Trauzeuge · Heirat: …“, „Trauzeugin · Heirat: …“, „Trauender · Heirat: …“, „Hebamme · Taufe: …“, „Anzeigender ·
  Tod: …“. Sie steht in der Liste der Ereignisse der Person und auf der Personenseite im Abschnitt **Lebenslauf**;
  die Zusammenfassung der Personenseite hat „Pate und Zeuge bei“ (bei einer Frau „Patin und Zeugin bei“).
- **Grenzen:**
  - eine abgeleitete Zeile ist kein eigenes Ereignis der Person: sie geht nicht in GEDCOM, die Tabelle, die Karte, das
    Buch, die Zeitleiste der Familie und die Zeitleiste im Dialog der Person;
  - die Zeile verschwindet, sobald die Person ein eigenes Ereignis ([A10.5.1](#A10.5.1)) hat, das auf dasselbe
    Ereignis verweist;
  - ein nur namentlich eingetragener Beteiligter erscheint in niemandes Leben; die Verknüpfung bietet
    [A10.5.2](#A10.5.2) an.
- **Bedienung:** Bearbeiten des Ereignisses, Abschnitt **Paten & Zeugen**: **+ Hinzufügen**, **Mit jemandem im
  Stammbaum verknüpfen**; ein verknüpfter Beteiligter hat die Marke **im Stammbaum**. Das Menü einer abgeleiteten
  Zeile: **Person öffnen**, **Auch als eigenes Ereignis eintragen**, **Verknüpfung lösen**.
- **Gilt seit:** App 3.28.0

<!-- zdroj: app:80c2ffb9 strings.ts events.roles, extraRoles, participants, addParticipant, participantName, participantNote, participantLink, participantInTree, derived*, derivedMenu, recordOwn, unlink · personPage godparentWitness · src/ui/shared-event-ui.ts (odvozené řádky jen v seznamu událostí a v Časové ose života) · spec 085 K2.1 · dirigent:prace/1113-app-sdilena-udalost Výsledek -->

<a id="A10.5.1"></a>
### A10.5.1 Auch als eigenes Ereignis eintragen

Eine Patenschaft oder Zeugenschaft lässt sich auch als eigenes Ereignis der Person eintragen, zum Beispiel damit sie
eine eigene Notiz oder Quelle hat.

- **Arten:** **Patenschaft** (Feld **Zur Taufe**), **Trauzeuge** (Feld **Zur Heirat**); bei einem anderen Ereignis
  das Feld **Zum Ereignis**. Das eigene Ereignis verweist auf die Taufe oder Heirat, zu der es gehört.
- **Grenzen:**
  - Datum, Ort und Quelle werden nach der Taufe vorausgefüllt („Nach der Taufe vorausgefüllt. Spätere Änderungen der
    Taufe werden nicht übernommen.“), bei einer Heirat entsprechend;
  - es ist nie eine Kopie der Taufe oder Heirat; Taufe und Heirat gehören weiter ihrer Person und ihrem Paar;
  - die abgeleitete Zeile ([A10.5](#A10.5)) erscheint dann nicht.
- **Bedienung:** Menü einer abgeleiteten Zeile → **Auch als eigenes Ereignis eintragen** („Legt eine Patenschaft mit
  Verweis auf die Taufe und derselben Quelle an.“). Nach dem Speichern „{Art}: bei {Name} gespeichert.“ Die Arten
  stehen auch in der Auswahl der Ereignisart.
- **Gilt seit:** App 3.28.0

<!-- zdroj: app:80c2ffb9 src/events.ts godparent, weddingWitness (roleAt) · strings.ts events.types.godparent „Kmotrovství“, weddingWitness „Svědek při sňatku“, recordOwnHintGodparent, recordOwnHintWitness, recordOwnPrefilled(Marriage, Event), refBaptism, refMarriage, refEvent, recordedOwn · src/ged-exporter.ts (1 EVEN, 2 TYPE, 2 _STROM_ROLE, 3 _STROM_AT, 4 TYPE BAPM|MARR) · spec 085 K2.2 -->

<a id="A10.5.2"></a>
### A10.5.2 Namentlich eingetragene Paten und Zeugen verknüpfen

Ein nur namentlich eingetragener Pate oder Zeuge, dem eine Person des Stammbaums entspricht, bekommt ein Angebot zur
Verknüpfung. Nichts wird von selbst verknüpft, und der eingetragene Name bleibt im Ereignis.

- **Wer angeboten wird:** nur Paten und Zeugen, nicht wer von Amts wegen beim Ereignis ist. Eine Person des
  Stammbaums mit demselben Vor- und Nachnamen (ohne Rücksicht auf Groß- und Kleinschreibung und diakritische Zeichen;
  auch der Ehename zählt), die zum Datum des Ereignisses lebte und mindestens 12 Jahre alt war. Ein Datum mit „etwa“
  erlaubt eine Abweichung von 2 Jahren; das Alter wird aus dem Geburtsdatum berechnet, sonst aus dem Taufdatum. Ohne
  Datum des Ereignisses wird niemand ausgeschlossen.
- **Wer nie:** die Person, der das Ereignis gehört, wer schon verknüpft ist, und wer abgelehnt wurde.
- **Grenzen:**
  - Geburtsjahr und Haus (die Adresse der Geburt, oder der Wohnort oder die Volkszählung, die dem Datum am nächsten
    liegt) werden beim Angebot nur gezeigt, sie entscheiden nicht;
  - eine Ablehnung merkt sich der Stammbaum und bietet sie nicht wieder an; in GEDCOM kommt sie zurück
    ([A2.7](A2-loading-a-family-tree.md#A2.7));
  - bei einem gemeinsamen Ereignis wird in allen Kopien verknüpft.
- **Bedienung:**
  - Bearbeiten des Ereignisses: eine graue Leiste „{Name} ({Angaben}) ist im Stammbaum – verknüpfen?“, bei mehreren
    Personen „N Personen namens … sind im Stammbaum – verknüpfen?“, die Schaltflächen **Verknüpfen**, **Nicht diese
    Person**, **Keine von ihnen**. Es gilt erst nach **Speichern**;
  - **Datenqualität**, Abschnitt **Hinweise**: „N namentlich eingetragene Paten und Zeugen entsprechen einer Person im
    Stammbaum.“ mit **Einzeln durchgehen**; der Dialog **Namentliche Paten und Zeugen, die wohl im Stammbaum sind ·
    N** speichert sofort, jede Verknüpfung oder Ablehnung ist ein Schritt **Rückgängig**. Unter der Liste
    „Abgelehnte werden nicht wieder angeboten (n).“
- **Gilt seit:** App 3.28.0

<!-- zdroj: app:80c2ffb9 src/participant-match.ts MIN_PARTICIPANT_AGE 12, cca ±2, attendsByOffice, příjmení po sňatku, linkRejected · src/ui/name-link-ui.ts · src/ui/shared-event-ui.ts (nabídka v editoru) · strings.ts events.linkOffer, linkOfferMany, link, notThisPerson, noneOfThem, linked · validation.nameLinkLead, nameLinkReview, nameLinkTitle, nameLinkHint, rejectedCount · spec 085 §6, 6g · dirigent:prace/1113-app-085-nalezy -->

<a id="A10.6"></a>
## A10.6 Personen und Stammbäume zusammenführen

Das Zusammenführen verdoppelt kein gemeinsames Ereignis.

- **Zusammenführen zweier Personen** ([A5.6](A5-tree-check.md#A5.6)): der Dialog **Gemeinsame Ereignisse nach dem
  Zusammenführen** zeigt die gemeinsamen Ereignisse beider Personen. Ein Ereignis, das beide haben, bleibt einmal
  („Einmal – beide sind dabei.“); weicht das Alter ab, wird es gewählt. Eine eigene Kopie, die mit dem gemeinsamen
  Ereignis der anderen Person übereinstimmt, wird ihm angeschlossen (angehakt „Dem gemeinsamen Ereignis anschließen
  (N Personen) – die eigene Kopie stimmt überein“).
- **Zusammenführen von Stammbäumen** ([A8](A8-merging-trees.md)): die gemeinsamen Ereignisse des hinzukommenden
  Stammbaums werden mit den Ereignissen des Zielstammbaums gepaart (dieselbe ID, sonst derselbe Eintrag) und
  übernehmen dessen gemeinsames Ereignis. Eine Person mit zwei gleichen Kopien behält eine. Ein gemeinsames Ereignis,
  dem eine Kopie geblieben ist, ist ein gewöhnliches Ereignis. Zusammenfassung: „Gemeinsame Ereignisse: n
  zusammengeführt“.
- **Gilt seit:** App 3.28.0

<!-- zdroj: app:80c2ffb9 src/merge/* (párování shareId, sjednocení kopií) · src/ui/person-merge (sharedTitle) · strings.ts personMerge.sharedTitle, merge.sharedOnce, sharedAttach, sharedJoined · spec 085 K1.5 · dirigent:prace/1113-app-sdilena-udalost Výsledek -->

<a id="A10.7"></a>
## A10.7 Früher gespeicherte Stammbäume

Ein Stammbaum, den eine ältere Version der App gespeichert hat, wird beim ersten Öffnen an die neue Version angepasst.
Vorher wird er einmal gesichert (**Vor der Anpassung der Daten an eine neue Version**). Die Anpassung verbindet nichts;
das Verbinden bietet die Datenqualität an ([A10.4](#A10.4)).

- **Eigenes Ereignis „Volkszählung“:** ein eigenes Ereignis einer Person mit dem Namen genau „Census“, „Sčítání lidu“,
  „Volkszählung“ oder „Spis ludności“ (ohne Rücksicht auf Groß- und Kleinschreibung und Leerzeichen an den Enden)
  wird zum Ereignis **Volkszählung**. Datum, Ort, Alter, Haus, Notiz, Quellen und Beteiligte bleiben. Eigene
  Ereignisse mit einem anderen Namen und Ereignisse eines Paares bleiben, wie sie sind. Das Zusammenführen nimmt dann
  ein eigenes „Census“ und eine Volkszählung als dasselbe Ereignis, sodass dieselbe Datei, erneut eingelesen, kein
  Ereignis hinzufügt.
- **Ungültiges Teilen** wird verworfen: eine ungültige Kennung, Teilen bei einer Art nur für eine Person und Teilen
  mit einer einzigen Kopie.
- **Bedienung:** keine, es läuft von selbst. Die Sicherung steht im Menü des Stammbaums → **Sicherungen** →
  **Sicherungsverlauf** ([S6.5](S6-tree-from-another-program.md#S6.5)).
- **Gilt seit:** App 3.28.0

<!-- zdroj: app:80c2ffb9 src/tree-manager.ts (verze dat 20, migrace), src/snapshots.ts 'pre-migration' · src/shared-events.ts (zahození neplatných shareId) · strings.ts snapshots.pre-migration „Před úpravou dat pro novou verzi“ · test gedcom-census-legacy.test.ts · dirigent:prace/1113-app-085-nalezy Výsledek (Census → census, záloha, NFC, trim, bez roleAt) -->
