<a id="A1"></a>
# A1 Aplikacja w skrócie

Jak aplikacja Strom działa jako całość, na jednej stronie. Każda sekcja prowadzi do rozdziału z dokładnymi zasadami.
Opisuje aplikację Strom 3.21.2 i badanie 1.25.2; zmiany z nowszej wersji mają przy sobie jej numer.

<a id="A1.1"></a>
## A1.1 Drzewo genealogiczne w przeglądarce, dane na urządzeniu

Aplikacja Strom to drzewo genealogiczne w przeglądarce (stromapp.info) lub w jednym pliku HTML. Drzewa zapisują się
w pamięci przeglądarki na tym urządzeniu. Nie ma konta ani serwera z danymi.

- **Granice:** pamięć przeglądarki należy do jednej przeglądarki na jednym urządzeniu. Na inne urządzenie drzewo
  przenosi się plikiem (kopia zapasowa JSON, GEDCOM, samodzielny HTML, [A7](A7-book-pages-and-export.md)).
- **Obowiązuje od:** aplikacja 1.0.0

<!-- zdroj: app:strings.ts about.description, embeddedMode.infoText1, embeddedMode.infoText2 -->

<a id="A1.2"></a>
## A1.2 Osoby, relacje i rody

Drzewo tworzą osoby i relacje między nimi: rodzice i dzieci, partnerzy i ich związki. Z drzewa aplikacja składa
**rody**: ród to linia po mieczu od najstarszego znanego nosiciela nazwiska, z członkami i z tymi, którzy weszli do
rodu przez małżeństwo. Nazwiska zna w formie żeńskiej i męskiej (Horák i Horáková, Jaworski i Jaworska).

- Szczegółowo: [A4](A4-surnames-and-families.md).

<a id="A1.3"></a>
## A1.3 Widoki: otoczenie jednej osoby

Aplikacja pokazuje zawsze otoczenie jednej **osoby w centrum**, nie całe drzewo naraz. Widoki **Rodzina**,
**Potomkowie**, **Oś czasu**, **Wachlarz** i **Mapa** czytają to samo otoczenie na różne sposoby. Widok może
wyróżnić jeden ród.

- Szczegółowo: [A6](A6-views.md).

<a id="A1.4"></a>
## A1.4 Wczytanie i wyniki

Drzewo genealogiczne z innego programu wczytuje się z pliku GEDCOM. Aplikacja mówi, co przejęła, a co pominęła.
Na zewnątrz daje kopię zapasową, GEDCOM, księgę rodu, strony rodu i drzewa, stronę osoby, plakat i samodzielny plik
HTML. Osoby żyjące domyślnie przy tym chroni.

- Wczytanie: [A2](A2-loading-a-family-tree.md). Scalanie drzew: [A8](A8-merging-trees.md). Wyniki i ochrona
  żyjących: [A7](A7-book-pages-and-export.md).

<a id="A1.5"></a>
## A1.5 Źródła, udokumentowanie i kontrola

Do danych zapisuje się źródła, cytaty, wycinki zapisów i załączniki. Aplikacja pokazuje, gdzie brakuje dowodów,
a kontrola drzewa szuka błędów i niezgodności w danych.

- Udokumentowanie: [A3](A3-evidence-in-the-app.md), stopnie pewności [R3.8](R3-verification-and-citation.md#R3.8).
  Kontrola drzewa: [A5](A5-tree-check.md).

<a id="A1.6"></a>
## A1.6 Aplikacja i badanie

Aplikacja działa także bez badania. Z badaniem Strom Research na tym samym komputerze pokazuje drzewo badania, jego
pracę i to, co badanie wie o osobach, a zmiany wysyła z powrotem do badania ([R1.6](R1-research-in-brief.md#R1.6)).

- Połączenie: [S1](S1-connecting-app-and-research.md). Zmiany z aplikacji: [S2](S2-edits-from-the-app.md).
  Co wie badanie: [S3](S3-what-the-research-knows.md). Badanie sterowane z aplikacji:
  [S4](S4-research-from-the-app.md). Telefon: [S5](S5-phone.md).

<a id="A1.7"></a>
## A1.7 Jak działa Strom w aplikacji

Ta dokumentacja jest dołączona do aplikacji i czyta się ją także bez internetu. Okno **Jak działa Strom** ma spis
treści części A, R i S, **Słowniczek pojęć** i wyszukiwanie według słowa lub numeru zasady.

- **Granice:**
  - otwarcie okna niczego nie wysyła i niczego nie wczytuje z sieci;
  - numer zasady i Enter przechodzą prosto do zasady (`R4.3`); nieznany numer pokazuje spis treści;
  - odnośniki między zasadami mają **Wstecz**; **W sieci** otwiera tę samą zasadę na stromapp.info;
  - zasada nowsza niż połączone badanie mówi o tym („Badania połączone z tym drzewem mają wersję …, to obowiązuje
    od …”).
- **Obsługa:** aplikacja: **Akcje → Jak działa Strom**, na telefonie **Więcej → Jak działa Strom** albo **O aplikacji
  → Jak działa Strom**. Kółko **?** w nagłówku otwiera pomoc od razu przy zasadzie: w Przeglądzie badania i małym
  panelu przy sekcjach **Kolejka** ([R2.4](R2-lines-and-queue.md#R2.4)), **Czeka na decyzję** ([R6.4](R6-awaiting-action.md#R6.4))
  i **Teraz** ([R7](R7-when-the-agent-works.md), przy wstrzymaniu [R7.6](R7-when-the-agent-works.md#R7.6)), w oknie **Miejsca** ([R4.5](R4-places.md#R4.5)), w menedżerze miejsc
  ([R4.4](R4-places.md#R4.4)), w panelu sprzeczności ([R5.3](R5-conflicts.md#R5.3)) i w **Co wie badanie → Sprzeczności**
  ([R5.6](R5-conflicts.md#R5.6)). W oknie jest też **Przewodnik po aplikacji**. W badaniu: `strom doc`
  ([R1.8](R1-research-in-brief.md#R1.8)).
- **Obowiązuje od:** aplikacja 3.24.0

<!-- zdroj: app:src/help/help-data.ts, src/help/topics.ts HELP_TOPICS · src/ui/help-mark.ts · strings.ts help.title, index, search, searchPh, web, back, unknown, verRes, topics; tour.menu · vendor/strom-doc/PIN · prace/1105-app-napoveda-impl (§1–§11, e2e help.spec: otevření okna bez síťového požadavku) -->
