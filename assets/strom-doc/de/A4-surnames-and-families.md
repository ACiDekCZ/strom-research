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
  bearbeiten…**, **Stammlinie ab dieser Person beginnen…**, **Buch der Stammlinie…**. Die Wahl einer Stammlinie in
  der Ansicht des Stammbaums beschreibt A6.
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
- **Bedienung:** **Stammbaum-Überblick → Stammlinien → Weitere Familien**. In der Werkzeugleiste **Stammlinien →
  Weitere Familien** (A6).
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
- **Bedienung:** **Stammbaum-Überblick → Stammlinien**, Feld „Stammlinie, Ort oder Person suchen…“. Die Liste
  **Stammlinien** in der Werkzeugleiste hat dieselbe Reihenfolge und dieselben Namen, mit **Ganzer Stammbaum** und
  **Weitere Familien** (A6).
- **Gilt seit:** App 3.19.0 (Liste **Stammlinien** in der Werkzeugleiste 3.21.0)

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
