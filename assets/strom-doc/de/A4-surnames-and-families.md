<a id="A4"></a>
# A4 Stammlinien und Nachnamen

Das Kapitel beschreibt, wie die App aus dem Stammbaum Stammlinien bildet und wie sie mit Nachnamen umgeht. Dazu
gehören der Geburtsname, der Ehename, weibliche Formen und verbundene Formen eines Namens.
Beschrieben wird die Strom-App 3.21.2. Änderungen aus einer neueren Version tragen deren Nummer.
Wie die Namen aus GEDCOM in den Stammbaum kommen, beschreibt [A2](A2-loading-a-family-tree.md).

<a id="A4.1"></a>
## A4.1 Die Stammlinie und ihr Stammvater

Eine Stammlinie ist die Linie in männlicher Folge vom ältesten bekannten Träger des Namens. Die App berechnet sie nur
aus den Daten des Stammbaums und speichert nur Korrekturen von Hand, sodass derselbe Stammbaum immer dieselben
Stammlinien ergibt.
Die Stammlinie bestimmt der Stammvater, nicht der Nachname. Ein Nachname kann so mehrere unverbundene Stammlinien
haben, und eine Stammlinie kann mehrere Schreibungen des Namens haben.

Jede Person hat eine Herkunftslinie. Die App findet sie über den „Elternteil in der Linie“:

| Situation | Elternteil in der Linie |
|---|---|
| Ein Vater ist erfasst | der Vater, auch wenn der Nachname des Kindes anders geschrieben ist |
| Das Kind trägt den Nachnamen der Mutter und nicht den des Vaters | die Mutter (das Kind gehört zu ihrer Herkunftslinie) |
| Der Vater fehlt und das Kind trägt nicht den Nachnamen der Mutter | niemand, das Kind begründet eine eigene Stammlinie |
| Person ohne brauchbaren Nachnamen | der Vater, sonst die Mutter |

- **Grenzen:**
  - Ohne brauchbaren Nachnamen sind eine Platzhalterperson, eine Person ohne Nachnamen und eine Frau, die unter dem
    Nachnamen des Ehemanns erfasst ist, wenn sie keinen erfassten Vater hat. Eine solche Person teilt nie eine
    Stammlinie und begründet keine.
  - Ein Stief- und ein Pflegeelternteil gibt die Stammlinie nicht weiter. Ein Adoptivelternteil gibt sie weiter, wenn
    kein anderer Vater erfasst ist.
  - Eine Stammlinie entsteht nur dort, wo mindestens eine echte Person mit Nachnamen ist. Stammvater ist die Person an
    der Spitze der Linie, wenn sie echt ist und einen Nachnamen hat. Sonst ist es der älteste Träger des Namens in der
    höchsten Generation, die einen hat.
  - Eine andere Schreibung des Nachnamens in der Linie teilt die Stammlinie nicht. Sie erscheint als unbestätigte
    Form der Stammlinie, siehe [A4.7](#A4.7).
  - „Ältester bekannter“ heißt nicht belegt. Die Belegstufe einer Person bestimmt
    [R3.8](R3-verification-and-citation.md#R3.8), auf die Stammlinie hat sie keinen Einfluss.
  - Eine Tochter bleibt Mitglied der Stammlinie ihres Vaters. Eine Ehefrau, die in die Stammlinie eingeheiratet hat,
    erscheint in der Stammlinie neben den Mitgliedern, wird aber nicht zu den Mitgliedern gezählt.
- **Bedienung:** **Stammbaum-Überblick → Stammlinien**. Das Detail einer Stammlinie zeigt **Orte**, **Namensformen**
  und **Mitglieder nach Generationen**; die Generationen werden vom Stammvater an römisch nummeriert.
- **Gilt seit:** App 3.19.0

<!-- zdroj: app:src/lineage.ts:1 hlavička modulu · :296 fatherOf · :317 surnameLooksMarried · :328 birthSurname · :393 computeLineages (kroky 1–4) · :756 rodGenerations · strings.ts treeOverview.rods.intro -->

<a id="A4.1.1"></a>
### A4.1.1 Stammlinie von Hand bearbeiten

Die Berechnung lässt sich im Dialog **Stammlinie bearbeiten…** korrigieren (Detail der Stammlinie oder das Angebot
**Aktionen zur Stammlinie** bei der Zeile **Stammlinie** einer Person).

| Bearbeitung | Element | Was geschieht |
|---|---|---|
| Anderer Stammvater | **Stammvater → Ändern…** | die Linie über der gewählten Person gibt die Stammlinie nicht weiter |
| Eigene Linie | **Linie ab Person beginnen…** (bei einer Person **Stammlinie ab dieser Person beginnen…**) | die Person und ihre Nachkommen bilden eine neue Stammlinie |
| Rückkehr | **Automatisch wiederherstellen** | die Stammlinie folgt wieder der Berechnung |
| Namensform | **+ Form**, **Form entfernen** | ändert die Formen des Nachnamens im ganzen Stammbaum ([A4.7](#A4.7)) |

- **Grenzen:**
  - Vor jeder Änderung erscheint die Vorschau **Was sich ändert** mit der Zahl der Mitglieder und Eingeheirateten.
    Eine Änderung ist ein Schritt zurück: „Jede Änderung lässt sich rückgängig machen (Rückgängig,
    Änderungsverlauf).“
  - Eine hinzugefügte Form kann zwei Stammlinien zusammenführen, und eine entfernte Form kann eine Stammlinie teilen.
    Stammlinien verbindet die Beziehung Eltern–Kind, nicht die Namensform („Die Linien verbindet keine Namensform,
    sondern eine Eltern-Kind-Beziehung.“).
  - Ein schreibgeschützter und ein verfolgter Stammbaum lassen sich nur ansehen. Ändern lässt sich nur der geöffnete
    Stammbaum.
  - Bei einem mit der Forschung verbundenen Stammbaum bekommt die Forschung die Korrektur der Stammlinie genauso wie
    die Gruppen von Formen (Senden der Änderungen siehe S2).
- **Gilt seit:** App 3.19.0

<!-- zdroj: app:src/lineage.ts:1036 LineageChange · :1176 applyLineageChange · :1247 previewOverride · src/ui/lineage-edit-ui.ts · src/ged-exporter.ts _STROM_LINE · strings.ts lineage.edit.*, lineage.preview.* -->

<a id="A4.2"></a>
## A4.2 Herkunftslinie und Eingeheiratete

Die Personenkarte und die Personenseite haben die Zeile **Stammlinie**. Ein Mitglied der Stammlinie hat dort die
Herkunftslinie und gegebenenfalls „· heiratete in Stammlinie …“. Wer in die Stammlinie eingeheiratet hat, hat
„Ehefrau in Stammlinie …“ oder „Ehemann in Stammlinie …“ und gegebenenfalls „· Herkunft: …“.

- **Grenzen:**
  - Als Ehefrau oder Ehemann erscheint eine Person, wenn sie keine eigene Stammlinie hat, wenn ihre Stammlinie nur
    sie selbst ist oder wenn ihre Stammlinie klein ist ([A4.3](#A4.3)) und die Heirat in eine große Stammlinie führt.
    Sonst erscheint sie als Mitglied.
  - Die Herkunftslinie des Ehemanns oder der Ehefrau wird nur genannt, wenn sie mehr als eine Person hat.
  - Eine Platzhalterperson und eine Person ohne Stammlinie und ohne Heirat in eine Stammlinie haben keine Zeile.
  - In Seiten und Exporten mit Schutz lebender Personen erscheint die Zeile bei einer lebenden Person nur bei der
    Option **Vollständige Daten** oder **Nur Nachname behalten**.
- **Bedienung:** das Angebot **Aktionen zur Stammlinie** bei der Zeile: **Stammlinie im Baum zeigen**, **Stammlinie
  bearbeiten…**, **Stammlinie ab dieser Person beginnen…**, **Buch der Stammlinie…**. Die Stammlinie als Personenauswahl
  in der Ansicht des Stammbaums beschreibt [A6.6](A6-views.md#A6.6).
- **Gilt seit:** App 3.19.0

<!-- zdroj: app:src/lineage.ts:793 marriedInto · :857 personRodRow · src/lineage-row.ts:40 personRodRowValue · :70 rodRowShown · strings.ts lineage.row.* -->

<a id="A4.3"></a>
## A4.3 Kleine Stammlinien und Weitere Familien

Eine Stammlinie mit höchstens 4 echten Mitgliedern ist klein. Eingeheiratete werden in diese 4 nicht gezählt. Kleine
Stammlinien stehen unter **Weitere Familien** (bis 4 Personen), große Stammlinien haben eine eigene Zeile.

- **Grenzen:**
  - Zu den **Weiteren Familien** gehört keine Stammlinie, die aus einer einzigen Person besteht, die in eine andere
    Stammlinie eingeheiratet hat. Eine solche Stammlinie steht gar nicht in der Liste der Stammlinien; die Person ist
    bei der Stammlinie zu sehen, in die sie eingeheiratet hat.
  - Zwei unterschiedliche Regeln: eine große Stammlinie wird von gleichnamigen Stammlinien nur gegenüber anderen
    großen unterschieden, eine kleine gegenüber allen ([A4.4](#A4.4)).
- **Bedienung:** **Stammbaum-Überblick → Stammlinien → Weitere Familien**. In der Werkzeugleiste **Auswahl ▾ → Stammlinien →
  Weitere Familien** ([A6.6.1](A6-views.md#A6.6.1); bis App 3.30.0 **Stammlinien → Weitere Familien**).
- **Gilt seit:** App 3.19.0

<!-- zdroj: app:src/lineage.ts:72 SMALL_ROD_MAX_MEMBERS · :710 isMarriedInOnly · :722 otherFamilyRods · strings.ts treeOverview.rods, familyPages.otherFams -->

<a id="A4.4"></a>
## A4.4 Reihenfolge und Namen der Stammlinien

Eine Stammlinie heißt nach dem Nachnamen des Stammvaters. Eine Stammlinie, die eine Frau begründet hat, trägt die
Form des ersten Mannes in der Linie. Hat eine Stammlinie denselben Namen wie andere Stammlinien, bekommt sie in
Klammern eine Unterscheidung.

| Reihenfolge der Unterscheidung | Beispiel |
|---|---|
| häufigster Ort der Stammlinie, wenn ihn keine andere Stammlinie hat | Horák (Brno) |
| Jahr des Stammvaters, wenn es keine andere Stammlinie hat | Horák (1702) |
| Vorname des Stammvaters | Horák (Jan) |
| Vorname und Jahr | Horák (Jan, 1702) |

- **Grenzen:**
  - Die Stammlinien sind von der größten an nach der Zahl der echten Mitglieder geordnet, bei Gleichstand nach der
    Geburt des Stammvaters.
  - Das Jahr des Stammvaters ist das Geburtsjahr, sonst das der Taufe, sonst das des ältesten Eintrags. Ein
    ungefähres Jahr wird „um“ gelesen.
  - Der Ort des Stammvaters ist der Geburtsort, sonst der Taufort, sonst das erste Ereignis mit Ort.
  - Sortierung im Überblick: **Größe** (Mitglieder und Eingeheiratete), **älteste** (Beginn der Stammlinie),
    **alphabetisch** (nach dem Namen in der Sprache der App). Die Wahl wird im Gerät gemerkt, nicht im Stammbaum.
  - Ab 20 großen Stammlinien hat der Überblick eine Suche und zeigt die ersten 20 Stammlinien, den Rest nach dem
    Aufklappen. Gesucht wird im Namen, in den Namensformen, Orten und Namen der Mitglieder.
  - Die Zeitleiste der Stammlinien ist auf 50 Jahre gerundet.
- **Bedienung:** **Stammbaum-Überblick → Stammlinien**, Feld „Stammlinie, Ort oder Person suchen…“. Der Abschnitt
  **Stammlinien** des Menüs **Auswahl ▾** in der Werkzeugleiste hat dieselbe Reihenfolge und dieselben Namen, mit
  **Weitere Familien** ([A6.6.1](A6-views.md#A6.6.1)).
- **Gilt seit:** App 3.19.0 (Liste **Stammlinien** in der Werkzeugleiste 3.21.0, ab 3.31.0 Abschnitt **Stammlinien**
  des Menüs **Auswahl ▾**)

<!-- zdroj: app:src/lineage.ts:393 computeLineages (řazení) · :567 summarise · :672 founderYearOf · :938 rodLabel · src/rods-overview.ts:23 rodSize · :33 sortRods · :46 AXIS_STEP · :79 rodMatches · :98 ROD_SEARCH_FROM · :114 founderPlace · src/ui/tree-overview.ts:160 RODS_SORT_KEY -->

<a id="A4.5"></a>
## A4.5 Weibliche und männliche Formen des Nachnamens

Die App paart die männliche und die weibliche Form eines Nachnamens als einen Namen: Horák und Horáková, Vlk und
Vlková, Jaworski und Jaworska. Die Paarung gilt für die Suche, das Zusammenführen von Personen, die Stammlinien und
den Vorschlag eines Ehenamens.

| Regel | Wann sie gilt | Beispiel |
|---|---|---|
| polnisch -ski/-cki/-dzki ↔ -ska/-cka/-dzka | männliche Form immer | Jaworski → Jaworska |
| tschechisch -ský ↔ -ská, -ý ↔ -á | in einem tschechischen Stammbaum | Lomský ↔ Lomská |
| tschechisch + -ová, -a → -ová | in einem tschechischen Stammbaum | Horák → Horáková, Vlk → Vlková |
| ausgefallenes e vor k, c, l | in einem tschechischen Stammbaum | Jalůvek → Jalůvková, Krušec → Krušcová |
| undeklinierbar -ů, -í, -ých | ändert sich nie | Macků, Kočí |

- **Grenzen:**
  - Ein Stammbaum ist tschechisch, wenn die App auf Tschechisch läuft oder wenn ein Nachname oder eine Gruppe von
    Formen einen tschechischen Buchstaben enthält (á é í ý č ď ě ň ř š ť ů ž ú ľ ĺ ŕ ä ô). Der Buchstabe ó macht
    einen Stammbaum nicht tschechisch.
  - Außerhalb eines tschechischen Stammbaums werden die tschechischen Regeln nicht angewandt. Ivanova wird so nicht
    mit Ivan gepaart.
  - Die weibliche Form -ska/-cka/-dzka gehört außerhalb eines tschechischen Stammbaums zu -ski. In einem tschechischen
    Stammbaum bleibt sie unter den tschechischen Regeln, weil es eine Schreibung ohne Diakritik sein kann (Liska statt
    Liška). Jaworski wird mit Jaworska trotzdem gepaart, aber die Suche „Jaworski“ findet eine als Jaworska erfasste
    Frau nicht.
  - Die polnische Form muss vor der Endung -i/-a mindestens 4 Zeichen haben. Ein Nachname mit weniger als 3 Zeichen
    bekommt keine weibliche Form.
  - Von -ová zurück werden alle möglichen männlichen Formen versucht (Jalůvková → Jalůvk, Jalůvka, Jalůvek). Der
    Stamm muss mindestens 3 Zeichen haben, sonst wird -ová als Adjektiv gelesen (Nová → Nový).
  - Formen, die der Benutzer verbindet ([A4.7](#A4.7)), gelten immer, auch außerhalb eines tschechischen Stammbaums.
- **Ab App 3.22.0:** Ein Stammbaum mit überwiegend polnischen Nachnamen ist polnisch und bekommt die
  tschechischen Regeln auch dann nicht, wenn die App auf Tschechisch läuft (Nowak bekommt nicht die Form Nowaková).
  Die weibliche Form -ska wird mit -ski in jedem Stammbaum gepaart, in dem -ski vorkommt.
- **Gilt seit:** App 1.16.0 (polnische Formen 3.21.2)

<!-- zdroj: app:src/surnames.ts (v3.21.2):29 CZECH_LETTERS · :39 POLISH_ADJECTIVAL · :42 polishPair · :64 genderRulesApply · :69 ruleForms · :89 czechRulesApply · :132 masculineForm · :164 masculineCandidates · :192 feminineForm · :263 sameSurname · HEAD src/surnames.ts treeSignals · CHANGELOG.cs.md 3.21.2, 3.22.0 -->

<a id="A4.6"></a>
## A4.6 Ehename und geführter Nachname

Eine Person hat den Geburtsnamen **Nachname** und getrennt davon den **Ehename**. Der Geburtsname bestimmt die
Stammlinie und die Namensformen. Der Ehename dient der Anzeige und der Suche.

Ist bei einer Frau der Ehename leer, bietet der Personeneditor „Vorschlag: …“ aus dem Nachnamen des Ehemanns an, in
die weibliche Form gesetzt nach [A4.5](#A4.5). **Übernehmen** füllt ihn aus, **Vorschlag ausblenden** blendet ihn
aus, und derselbe Vorschlag wird nicht mehr angeboten.

- **Grenzen:**
  - Ehemann ist der Mann aus einer Verbindung, die eine Ehe ist oder war (auch eine geschiedene). Unter den Ehen mit
    Datum gewinnt die mit dem spätesten Datum, sonst die letzte in der Reihenfolge. Eine Verbindung ohne Ehe ergibt
    keinen Vorschlag.
  - Ein platzhaltender Ehemann ergibt keinen Vorschlag. Der Vorschlag wird nicht angeboten, wenn er mit dem
    Geburtsnamen übereinstimmt.
  - Wo die Regeln nicht gelten, wird der Nachname des Ehemanns unverändert angeboten (Brenntaler).
  - Das Feld **Ehename** ist zu sehen, wenn es ausgefüllt ist, bei einer Frau mit einer Verbindung oder nach **+
    Ehename**.
  - **Geführter Nachname** (**Geburtsname** / **Ehename**) erscheint nur unter einem ausgefüllten Ehenamen. Das passt
    etwa nach einer Scheidung.
- **Bedienung:** die Anzeige aller Personen ändert **Einstellungen → Personenkarte → Nachname anzeigen**:

| Option | Geführt wird der Ehename | Geführt wird der Geburtsname |
|---|---|---|
| **Geburtsname** | Marie Horáková | Marie Horáková |
| **Ehename (geb. Geburtsname)** (Standard) | Marie Vlková (geb. Horáková) | Marie Horáková (früher Vlková) |
| **Ehename** | Marie Vlková | Marie Horáková (früher Vlková) |

  Der Vermerk „früher“ steht nur im Detail der Person (Angebot der Karte, Beziehungsbereich, Kopf des Editors), nicht
  auf den Karten.
- **Ab App 3.22.0:** bei einer Frau hat das Feld des Geburtsnamens den Hinweis „Nachname bei der Geburt“, und ein
  leerer Ehename sagt, dass hierher der durch Heirat erworbene Nachname gehört.
- **Gilt seit:** App 3.13.0 (geführter Nachname 3.18.0)

<!-- zdroj: app:src/married-suggestion.ts:46 suggestionHusband · :65 wifeSurnameOf · :83 suggestMarriedSurname · src/person-name.ts:46 surnameDisplay · :79 shownNameParts · src/ui/person-modal.ts:1483 refreshMarriedSurname · strings.ts person.*, settings.surnameDisplay, name.* -->

<a id="A4.6.1"></a>
### A4.6.1 Mehrere Ehen: der Nachname aus der letzten Ehe

Eine Person mit mehreren Namen nach der Heirat hat als **Ehename** den aus der letzten Ehe, nicht den zuletzt
geschriebenen. Die anderen Namen nach der Heirat stehen unter **Andere Schreibweisen des Namens**.

Marie Horáková hat zwei Ehen: 1880 (Ehemann Jan Vlk) und 1900 (Ehemann Josef Jaworski). Die Forschung schrieb
zuerst „Marie Jaworska“, dann „Marie Vlková“. Der **Ehename** ist Jaworska, „Marie Vlková“ steht unter **Andere
Schreibweisen des Namens**.

- **Grenzen:**
  - Eine Ehe ist eine Verbindung, die eine Ehe ist oder war (auch eine geschiedene); eine Verbindung ohne Ehe
    (**Partner**, **Getrennt**) zählt nicht.
  - Es gewinnt der Name, dessen Nachname zum Partner der Ehe mit dem spätesten Datum gehört. Ehen ohne Datum kommen
    erst danach an die Reihe, von der letzten in der Reihenfolge der Ehen an ([A6.4](A6-views.md#A6.4)).
  - Ein Nachname gehört zum Partner auch in der weiblichen Form (Vlk → Vlková, Jaworski → Jaworska), unabhängig von
    Groß- und Kleinschreibung und diakritischen Zeichen, auch in einem Stammbaum, in dem die Regeln der Formen
    ([A4.5](#A4.5)) keine weibliche Form ergeben.
  - Ein Name, der zu keinem Partner gehört, kommt erst nach ihnen an die Reihe; gehört keiner, gilt der zuletzt
    geschriebene.
  - Die nicht gewählten Namen nach der Heirat bleiben unter **Andere Schreibweisen des Namens**, mit ihren eigenen
    Vornamen. Nichts wird gelöscht.
  - Es gilt beim Laden eines Stammbaums aus der Forschung und einer GEDCOM-Datei eines anderen Programms (`NAME` mit
    `TYPE married` und `_MARNM`). Die Forschung ordnet die Namen nach der Heirat in ihrer Datei für die App nach
    derselben Regel, den aktuellen zuletzt, und die App übernimmt ihre Reihenfolge, wie sie ist. Bei einer älteren
    Forschung und bei einer Datei eines anderen Programms ermittelt die App die Regel selbst. Eine ältere App nimmt
    den zuletzt geschriebenen Namen und bekommt so von der Forschung ebenfalls den aktuellen.
- **Warum:** Namen nach der Heirat kommen in der Reihenfolge hinzu, in der die Forschung sie findet: ein neuerer
  Nachname etwa aus einem Sterbeeintrag vor einem älteren aus dem Traueintrag. Der zuletzt geschriebene muss also
  nicht der aus der letzten Ehe sein.
- **Bedienung:** ein anderer Ehename wird von Hand gewählt ([A4.6.2](#A4.6.2)).
- **Gilt seit:** App 3.31.0, Forschung 1.36.0 (vorher galt der zuletzt geschriebene Name nach der Heirat)

<!-- zdroj: app:bb706ed0 src/married-suggestion.ts marriagePartnersLatestFirst (married|divorced; s datem od nejpozdějšího, pak bez data od posledního v marriagesInOrder), surnameOfSpouse (surnameKey, wifeSurnameOf, feminineForm, masculineFormIn), lastMarriageSurnameIndex (bez shody Infinity, shoda → poslední v pořadí souboru) · src/ged-parser.ts readMarriedSurname (TYPE married, _MARNM), chooseLastMarriageName (nevybrané do nameVariants s křestními), MARRIED_LAST_TAG (se značkou bez přepočtu) · test src/__tests__/married-surname-last-marriage.test.ts · research:5476514e src/core/married.ts marriagesOf (union partners|separated mimo), marriedInOrder, namesInOrder · src/gedcom/export.ts (Strom soubor: jména po sňatku na konci, aktuální poslední; HEAD _STROM_MARRIED_LAST) · spec 010 K4.1, K4.3, K4.4 · dirigent:prace/1120-app-010-posledni-snatek, 1120-vyzkum-010-posledni-snatek -->

<a id="A4.6.2"></a>
### A4.6.2 Den Ehenamen von Hand ändern

Die Änderung des **Ehename** auf einen anderen Nachnamen (im Personeneditor oder in der Tabelle) ist eine Wahl des
Benutzers: Der frühere Ehename bleibt unter **Andere Schreibweisen des Namens**, und der gewählte verlässt sie.

- **Grenzen:**
  - Eine Korrektur der Schreibung (derselbe Nachname, nur diakritische Zeichen oder Groß- und Kleinschreibung
    anders) und das Leeren des Feldes fügen den anderen Schreibweisen nichts hinzu.
  - Der frühere Name behält seine eigenen Vornamen, wenn er welche hatte.
  - Die Forschung übernimmt die Wahl als aktuellen Namen nach der Heirat und hält sie gegen die Regel
    [A4.6.1](#A4.6.1), auch nach neuen Einträgen und einer neuen Ehe, bis in der App ein anderer gewählt wird. Die
    anderen Namen nach der Heirat bleiben in der Forschung.
  - Einen Namen nach der Heirat, den die Forschung noch nicht hat, fügt die Forschung hinzu und nimmt ihn gleich als
    aktuellen.
  - Eine Wahl ist nur eine Änderung gegenüber der Version, die die App von der Forschung bekam. Eine App, die eine
    neuere Version noch nicht geladen hat, wählt nichts.
  - Der Name, mit dem die Person in der Forschung gezeigt wird (`strom name primary`,
    [R10.5](R10-people-and-hypotheses.md#R10.5)), hat Vorrang vor der Wahl aus der App.
  - Die Wahl eines Namens, den die Forschung inzwischen entfernt oder zurückgezogen hat
    ([R10.5.1](R10-people-and-hypotheses.md#R10.5.1)), wird nicht übernommen.
  - Mit einer Forschung älter als 1.36.0 kehrt die Wahl beim nächsten Laden des Stammbaums zur Regel
    [A4.6.1](#A4.6.1) zurück.
- **Warum:** Der aktuelle Nachname muss nicht der aus der letzten Ehe sein, etwa ein nach einer Scheidung behaltener
  Nachname.
- **Bedienung:** die Wahl setzt nur die App (Feld **Ehename**); das Terminal hat dafür keinen Befehl. Bei der
  Übernahme zeigt `strom sync` die Zeile „aktueller Name nach der Heirat — …“, `strom sync undo I…` nimmt die Wahl
  zurück.
- **Gilt seit:** App 3.31.0, Forschung 1.36.0

<!-- zdroj: app:bb706ed0 src/data.ts updatePerson (marriedBefore/marriedNow, surnameKey: oprava pravopisu nic nepřidá, vymazání nic nepřidá, dřívější s marriedFirstName do nameVariants, zvolené z nameVariants pryč) · src/ui/table-view/table-ui.ts updatePerson · research:5476514e src/core/sync.ts name.now (porovnání se základem _STROM_HEAD, off: odebrané od základu nebo retractedNames, shown/primaryName přednost), apply name.now (addName kind married, marriedNow), undo name.now · src/core/married.ts marriedInOrder (primary > marriedNow > pravidlo) · assets/lang/cs.json ui.sync.name.now, ui.sync.do.name.now · strings.ts person.marriedSurname, nameVariants „Další tvary jména“ · spec 010 K4.2, K4.4 · ZADANI_VYZKUM_prijmeni-posledni-snatek.md „Odpověď výzkumu“ (odchylky) · Name.marriedNow a HEAD _STROM_MARRIED_LAST se nepopisují (vnitřní) -->

<a id="A4.7"></a>
## A4.7 Namensschreibweisen des Stammbaums und Vorschläge aus der Forschung

Verschiedene Schreibungen eines Namens (Horák, Horak, Horrák) lassen sich zu einer Gruppe verbinden. Die Gruppe gilt
für den ganzen Stammbaum: Suche, Zusammenführen von Personen und Stammlinien nehmen die Formen dann als einen Namen,
auch bei später hinzugefügten Personen.

- **Grenzen:**
  - Eine Gruppe, die sich mit einer anderen überschneidet, wird mit ihr zu einer verbunden.
  - Eine entfernte Form merkt sich der Stammbaum als abgelehntes Paar.
  - Die Form einer einzelnen Person (Spitzname, Hofname) gehört zu **Andere Schreibweisen des Namens** bei der
    Person, nicht zu den Gruppen des Stammbaums. Suche ([A4.8](#A4.8)) und Zusammenführen von Personen vergleichen
    auch diese Formen; nach dem Zusammenführen bleiben die Formen beider Personen, und die Schreibweise, die in einem
    Namenskonflikt unterlag, kommt hinzu.
  - **Aus der Forschung vorschlagen** zeigt die Vorschläge der Forschung in zwei Stufen: **Belegt** und **Nach
    Regeln**, jeder mit Grund und Belegen. Nichts wird ohne Bestätigung verbunden (**Übernehmen** / **Ablehnen**,
    **Rückgängig**).
  - Vorschläge werden nicht angeboten, wenn sie abgelehnt sind, schon in einer Gruppe liegen oder zwei Gruppen
    verbinden würden. Gezeigt werden 10 Vorschläge, weitere nach **Weitere … anzeigen**.
  - **Alle belegten übernehmen** und **Alle übernehmen, die sich nur in der Diakritik unterscheiden** erscheinen ab 2
    Vorschlägen.
  - „Vorschläge sind verfügbar, solange die Forschung läuft.“ Ohne Forschung erscheinen die zuletzt geladenen
    Vorschläge. Eine übernommene Gruppe „geht mit dem nächsten Senden an die Forschung“ (S2).
- **Bedienung:** **Stammbaum-Einstellungen → Namensschreibweisen…** (nur beim geöffneten Stammbaum), **Verknüpfen**,
  **Verknüpfung lösen**, **Aus der Forschung vorschlagen**. Die Form einer Stammlinie: **Stammlinie bearbeiten… → +
  Form** ([A4.1.1](#A4.1.1)).
- **Gilt seit:** App 1.15.0 (Vorschläge aus der Forschung 3.17.0)

<!-- zdroj: app:src/surnames.ts:291 addSurnameGroup · :329 removeSurnameForm · src/surname-suggest.ts:197 isRejected · :208 suggestionGroup · src/ui/surname-suggest-ui.ts:41 PAGE · src/ui/surnames-ui.ts · src/ui/tree-actions.ts:217 · strings.ts surnames.*, surnameSuggest.* · src/merge/matching.ts:197 writtenSurnames · src/merge/executor.ts:781 addLosingNameVariant, :951 nameVariants -->

<a id="A4.8"></a>
## A4.8 Suche und Sortierung von Namen

Die Suche nach einer Person beachtet weder Groß- und Kleinschreibung noch Diakritik noch Satzzeichen. Sie findet eine
Person unter dem Geburtsnamen, dem Ehenamen, allen ihren Formen ([A4.5](#A4.5), [A4.7](#A4.7)) und unter ihren
anderen Schreibweisen des Namens.

| Treffer der Anfrage | Rang |
|---|---|
| Anfang des Vornamens | 1. |
| Anfang des Nachnamens | 2. |
| Anfang des ganzen Namens | 3. |
| innerhalb des Vornamens, dann innerhalb des Nachnamens (früher im Text steht höher) | 4.–5. |
| andere Form des Nachnamens oder Namens: Anfang, dann innerhalb | 6.–7. |
| mehrere Wörter verteilt auf Namen und andere Form | 8. |
| Geburtsjahr | 9. |
| Todesursache oder Haus (nur Suche in der Werkzeugleiste) | 10. |

- **Grenzen:**
  - Bei Gleichstand und ohne Anfrage wird nach „Nachname Vorname“ sortiert, in der Sortierfolge des Browsers.
  - Findet die Person nur ein Nachname, den der Name auf der Karte nicht zeigt, nennt das Ergebnis ihn unter dem
    Namen („Ehename …“, „geb. …“, „früher …“).
  - Lateinische und deutsche Formen des Vornamens (Wenceslaus, Wenzel × Václav) werden nur beim Vergleich eines
    gelesenen Dokuments mit dem Stammbaum gepaart, nicht in der Suche.
- **Bedienung:** Suche in der Werkzeugleiste, Auswahl einer Person und Feld Nachname im erweiterten Filter.
- **Gilt seit:** App 3.0.0 (Ehename in der Suche 3.13.0)

<!-- zdroj: app:src/name-search.ts:26 searchableSurnames · :82 surnameMatchesQuery · src/merge/matching.ts:38 normalizeName · src/person-picker.ts:18 sortByName · :28 calculateMatchScore · :98 hiddenSurnameMatchHtml · src/search-filter.ts:95 · src/given-names.ts -->

<a id="A4.8.1"></a>
### A4.8.1 Gleiche Namen in der Personenauswahl

Wiederholt sich im Suchergebnis derselbe Name, hat jede solche Zeile unter dem Namen eine zweite, graue Zeile mit der
kürzesten Angabe, die sie von den anderen gleichnamigen unterscheidet. Eine Zeile mit eindeutigem Namen sieht aus
wie bisher.

- **Wann:** gleich ist, was die Zeile zeigt: der Name mit Titeln und dem Hinweis auf den Geburts- oder früheren
  Nachnamen sowie das Geburtsjahr, wenn die Liste es hinter den Namen schreibt. Verglichen wird wie bei der Suche,
  ohne Groß- und Kleinschreibung und diakritische Zeichen. Gezählt wird im ganzen Ergebnis, auch in den Zeilen nach
  den ersten 50.
- **Reihenfolge der Angaben:**
  1. Jahre: „* 1820 – † 1866“, nur die bekannten Teile und nur das Jahr. Ein Geburtsjahr, das die Liste hinter den
     Namen schreibt, wird nicht wiederholt;
  2. Partner: „⚭ Name“; bei mehreren Ehen der erste Partner, den die anderen Zeilen nicht haben;
  3. Eltern: „Tochter von Vater und Mutter“ (beim Mann „Sohn von“, ohne Geschlecht „Kind von“), nur bekannte Eltern;
  4. Ort: „Geburtsort …“, ohne ihn „Wohnort …“ (der letzte Wohnort mit Ort).
- **Grenzen:**
  - die Angaben werden in dieser Reihenfolge genommen, bis die Kombination keiner anderen Zeile der Gruppe entspricht.
    Gezeigt wird davon nur, was bekannt ist und was nicht alle anderen Zeilen der Gruppe gleich haben, verbunden mit
    „ · “. Schwestern mit denselben Eltern unterscheidet so der Geburtsort, nicht die Eltern; zwei „Radegunda
    Pokusná“, geboren 1900, haben „⚭ Bohuchval Zkoušek“ und „⚭ Sudivoj Pokus“, nicht „* 1900 · ⚭ …“. Eine Angabe,
    die nur einige Zeilen gleich haben, wird gezeigt;
  - unterscheidet die Zeile nur eine Angabe, die bei ihr nicht bekannt ist, wird ihre erste bekannte Angabe gezeigt,
    die nicht alle anderen gleich haben, und gibt es keine solche, „keine weiteren Angaben“. Eine Zeile, die nichts
    von einer anderen unterscheidet, zeigt alle ihre bekannten Angaben;
  - eine über eine Angabe gefundene Person (Ehename, Todesursache, Haus, [A4.8](#A4.8)) hat eine Zeile: die
    Unterscheidung und nach „ · “ den Fund. Ein Jahr, das der Fund schon nennt („† 1866 …“), wird in der
    Unterscheidung nicht wiederholt;
  - die Unterscheidungszeile verbreitert die Liste nicht: ein längeres Ende wird mit „…“ gekürzt. Der ganze Text
    steht im Tooltip der Zeile, und ein Bildschirmleser liest die Zeile als „Name, Unterscheidung“;
  - am Telefon ist die Liste so breit wie der Bildschirm.
- **Wo:** jede Auswahl einer Person aus einem Feld: die Suche in der Werkzeugleiste, das Hinzufügen einer Beziehung,
  das Ermitteln einer Verwandtschaft, das Lesen eines Dokuments, die Standardperson des Stammbaums und weitere. Die
  Auswahl einer Person für den Weg der Vorfahren auf der Karte ([A6.5.4](A6-views.md#A6.5.4)) hat eine eigene Liste
  ohne Unterscheidung.
- **Bedienung:** keine: es gilt von selbst. Tasten und das Laden zu je 50 Zeilen bleiben unverändert.
- **Gilt seit:** App 3.28.0

<!-- zdroj: app:f5d56ed3 src/picker-distinguish.ts rowKey (shownNameParts + birthNoteText, rok narození jen se showBirthYear, normalizeSearchText), distinguishFeatures (roky * – †, bez roku v řádku a bez části, kterou říká nález; partner první, kterého jiné řádky nemají; rodiče otec, matka, ostatní, bez zástupných; rodiště, jinak poslední bydliště s místem), distinguishLine (nejkratší předpona údajů, kterou nemá nikdo jiný; jinak první známý; jinak distNone), PickerDistinguisher (celý výsledek, i za 50) · src/person-picker.ts renderItem (person-picker-dist, nález na jednom řádku za „ · “, role option, aria-label a title „jméno, rozlišení“) · index.html .person-picker-dist (výpustka, min-width 330 px, telefon 100vw) · všechny new PersonPicker (search.ts, relation-modal.ts, kinship-ui.ts, read-document-ui.ts, tree-management.ts …); PathPersonPicker samostatný · strings.ts personPicker.distNone, distChild, distAnd, distBorn, distLived · app ac34f598 · dirigent:prace/1113-app-drobnosti-1112 · ZADANI_DEV_drobnosti-1112 §1 · app:1c4b7d19 distinguishLine (údaj shodný u všech ostatních řádků skupiny se vynechá; jinak první známý nesdílený; bez rozlišení vše) · dirigent:spec/085 A4.8.1 -->

<a id="A4.8.2"></a>
### A4.8.2 Suchbereich: Ganzer Stammbaum, Direkte Linie, In der Ansicht

Die Ergebnisse der Personensuche lassen sich auf die direkte Linie einer Person oder auf die Personen eingrenzen, die
die Ansicht gerade zeigt. Der Schalter **Suchbereich** ist im Kopf der aufgeklappten Ergebnisse: **Ganzer
Stammbaum**, **Direkte Linie**, **In der Ansicht**.

- **Direkte Linie** ist die Person selbst, alle ihre Vorfahren und alle ihre Nachkommen, ohne Partner, Geschwister
  und Platzhalterpersonen. Eine Zeile unter dem Schalter sagt, wessen: „Direkte Linie: Jan Horák · mit Vorfahren und
  Nachkommen“.
- **In der Ansicht** sind die Personen, die die Ansicht gerade zeigt: der gezeichnete Stammbaum oder Fächer, die
  Auswahl auf der Karte, die Zeilen der Tabelle nach dem Filter („In der Ansicht: Tabelle, gefiltert · 24 Personen“).
- **Wessen Linie:**
  - in der Werkzeugleiste die Person in der Mitte der Ansicht; auf der Karte und in der Tabelle die Hauptperson des
    Stammbaums („Direkte Linie: Jan Horák, Hauptperson des Stammbaums · mit Vorfahren und Nachkommen“): die Person aus
    **Standardperson und -ansicht** ([A6.1.1](A6-views.md#A6.1.1)), ohne sie die erste Person des Stammbaums;
  - in der Personenauswahl eines Dialogs die Person, aus der sich der Dialog geöffnet hat; in den Materialien die
    Person des Materials, ohne sie die Hauptperson des Stammbaums.
- **Grenzen:**
  - die Eingrenzung ist kein Filter: die Zahl der aktiven Filter ändert sich nicht und für sich hebt sie nichts
    hervor. Mit einer Suchanfrage oder einem Filter grenzt sie die Ergebnisse, die Hervorhebung im Stammbaum und die
    Zahlen ein; die Fußzeile der Filterleiste ergänzt „nur direkte Linie“ oder „nur in der Ansicht“, auf dem Telefon
    sagt die Filterliste „Gesucht wird nur in der direkten Linie: Jan Horák.“;
  - ein Bereich, den die Auswahl nicht anbieten kann, erscheint nicht, und gesucht wird im ganzen Stammbaum:
    **Direkte Linie** ohne Person, **In der Ansicht** ohne Ansicht hinter dem Dialog (ein anderer Dialog, eine
    Personenseite, das Fenster Personenlisten oder Materialien verdeckt sie) und bei einer Ansicht, die den ganzen
    Stammbaum zeigt (Zeitleiste mit dem ganzen Stammbaum);
  - wenn im eingegrenzten Bereich niemand ist, sagt das Ergebnis „In der direkten Linie niemand. Im ganzen Stammbaum
    3 Treffer.“ (oder „In der Ansicht niemand. …“) mit dem Link **Im ganzen Stammbaum suchen**; Enter sucht dort;
  - die Wahl gilt gemeinsam für die Werkzeugleiste und alle Personenauswahlen, bis die App geschlossen wird. Sie wird
    nicht gespeichert: nach dem Start ist immer **Ganzer Stammbaum** gewählt.
- **Wo:** Suche in der Werkzeugleiste; Personenauswahl in den Dialogen zum Hinzufügen einer Beziehung, der Eltern
  eines Kindes, eines gemeinsamen Ereignisses, **Verwandtschaft finden…**, Zusammenführen zweier Personen; Zuordnen
  einer Person in den Materialien und im Dialog des Materials.
- **Bedienung:** Klick auf den Bereich; Alt+←/→ zwischen den Bereichen (die Sprechblase zeigt „(Alt+←/→)“). Die
  Sprechblase des Bereichs sagt, was die Eingrenzung umfasst („Nur Jan Horák mit Vorfahren und Nachkommen“, „Nur die
  Personen, die die Ansicht gerade zeigt (24)“). Auf dem Telefon steht die Zahl der Ergebnisse am Ende der Zeile unter
  dem Schalter.
- **Gilt seit:** App 3.32.0

<!-- zdroj: app:82cfdbd3 src/search-scope.ts SearchScope, SEARCH_SCOPES, getSearchScope/setSearchScope (jen v paměti, po startu 'tree'), directLineIds (selection ancestors + descendants, bez zástupných), effectiveScope, offeredScopes, narrowIds, stepScope · app:7a72bd1e src/person-picker.ts PickerScopeSource, renderScopeHead (skryté nenabízené rozsahy, titulky, altKeys, lineRef/lineRefMain/viewRef, telefon počet na konci řádku), prázdné zúžení emptyLine/emptyView + searchWhole, Enter · src/ui/search-scope-ui.ts toolbarRefPerson (střed, mapa a tabulka hlavní osoba), mainPerson (defaultPersonId, startupPerson), toolbarViewIds (mapScopePersons, timelineScope 'tree' = null, tableShownPersonIds, getVisiblePersonIds), toolbarScopeSource, viewBehindDialog (stránka osoby, Seznamy osob, Materiály, víc dialogů), dialogScopeSource, materialScopeSource, toolbarScopeNote (footLine/footView, sheetLine/sheetView) · src/ui/search.ts applySearchFilter (zúžení není filtr, zvýraznění a počty) · scope: v relation-modal.ts, relationships-panel.ts, person-events.ts, kinship-ui.ts, merge-ui.ts, materials-window.ts, material-attach-ui.ts, search.ts · strings.ts searchScope.* · app:d5b87792 · dirigent:spec/137 K1, prace/1123-app-137-linie-material (Výsledek, dotazy A1–A2: osa s celým stromem bez V pohledu; bez hlavní osoby první osoba stromu) · ZADANI_UIX_hledani-linie-material-seznam „Rozhodnuto 23. 11.“ bod 4 (bez partnerů) -->
