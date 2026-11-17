<a id="A12"></a>
# A12 The portrait and the couple's photo

A person's portrait is a square cut from a photo. The crop is chosen in an editor over the whole photo and can be
changed at any time, because the whole photo stays with the person as an attachment. A couple can have its own
**couple's photo** (a wedding or joint photo) and the portraits of both partners from it. The chapter describes the
Strom app 3.30.0.

<!-- zdroj: dirigent:spec/107-vyrez-portretu (K1.1–K2.3) · app:59b9dde9..6a00396f (dirigent:prace/1116-app-107-vyrez) · app:docs/ZADANI_DEV_vyrez-portretu.md §1–§10, rozhodnutí D1–D12 · app:src/photo.ts, src/portrait-editor-model.ts, src/ui/portrait-editor.ts · app:CHANGELOG.cs.md 3.30.0 -->

<a id="A12.1"></a>
## A12.1 The portrait crop editor

A photo chosen when editing a person opens in the editor **Portrait crop**. A frame in the shape of the photo on the
card stands still and the photo moves, zooms and rotates under it.

- **In the editor:**
  - **moving** by dragging the photo; the movement stops before an empty space would remain in the frame;
  - **Zoom** from 100 % (the frame covers the shorter side of the photo) up to at most 800 %; the crop always has at
    least 128 px of the original photo, so a small photo zooms less (at most to twice its real resolution);
    **Default** returns the initial crop: the largest square from the centre;
  - **Rotate** by 90° to the left and to the right;
  - **Straighten** by at most 45° to either side in steps of 0.5°, with a grid over the frame while dragging; the
    photo zooms in meanwhile so that no empty corner remains in the frame;
  - **Flip**;
  - **Preview**: the person's card with the shape and size of the photo from Settings ([A6.1.4](A6-views.md#A6.1.4)),
    the square from **Person page** and the 4 : 5 crop from **Family pages**. The sentence under the preview: “A
    circle on the card; the whole square is saved.” (for a rounded square “A rounded square on the card; the whole
    square is saved.”).
- **Done** returns the portrait to editing the person; it is saved only with its **Save**. **Cancel** (also Escape)
  leaves editing the person as it was and the file is not used. Editing the person closed without saving leaves
  nothing, neither the portrait nor the original.
- The saved portrait is a square of 256 × 256 px in JPEG format. Transparent areas (PNG) get a white background; from
  a GIF the first frame is taken. A circle or a rounded square is only the shape on the card: the whole square is
  saved.
- A portrait from a new file in which nothing was changed in the editor is byte for byte the same as a portrait before
  app 3.30.0. The original is saved even so ([A12.2](#A12.2)).
- When the crop covers less than 256 px of the original photo, the editor says once “The photo is small; the portrait
  may be blurry.”
- **Limits:**
  - in a read-only tree (an exported HTML page, a followed tree, a tree saved by a newer version of the app, a version
    preview) and at a locked person the portrait does not change: **Edit crop**, **Edit portrait crop**, **As
    portrait…** and **Use as portrait…** are missing or open nothing; the portrait is only shown;
  - a person deleted during the edit (in another window, on loading from the research) gets nothing: “The person is
    no longer in the tree; nothing was saved.”;
  - a file that is not an image or cannot be read is not opened by the editor; the app says so as before.
- **Controls:** editing a person, **Choose photo** at the photo. On a phone (up to 640 px) the editor fills the whole
  screen: the card preview, the switch **Zoom** | **Straighten** with one slider and under it ↺ ↻ and **Flip**.
- **Since:** app 3.30.0; the buttons for rotating the photo in editing a person are in the editor from 3.30.0.

<!-- zdroj: app:327d9734 src/ui/portrait-editor.ts (rámeček, posun, kolečko, dva prsty, ↺ ↻, narovnání s mřížkou, Zrcadlit, náhled karty / Stránka osoby / Rodinné stránky, telefon), src/photo.ts PHOTO_SIZE 256, PORTRAIT_MIN_SOURCE_PX 128, PORTRAIT_MAX_ANGLE 45, PORTRAIT_ANGLE_STEP 0.5, minZoomForAngle, cropToJpeg (bílý podklad) · src/portrait-editor-model.ts isIdentityPortrait (Hotovo beze změny z nového souboru = compressPhoto), isSmallPortrait · app:88859da2 src/ui/person-modal.ts handlePhotoInput → editor, Zrušit/Escape nechá dialog, dialog zavřený bez Uložit nic nenechá, #photo-rotate-left/right odstraněny · app:a2af453a jen ke čtení / zamčená osoba, personGone · app:ef688950 dlouhá jména, telefon na šířku · strings.ts portrait.title, preview, personPage, familyPages, savedCircle, savedRounded, rotate, straighten, zoom, reset, mirror, small, personGone · ZADANI_DEV §1, §9, §10 -->

<a id="A12.1.1"></a>
### A12.1.1 Keyboard, mouse and touch in the editor

| Input | What it does |
|---|---|
| dragging the photo (mouse, one finger) | moving |
| wheel | zoom around the pointer (× 1.15 per step) |
| two fingers | zoom around the centre of the fingers; there is no rotating with two fingers |
| double click or double tap on the photo, the key `0`, **Default** | the initial crop of the step |
| double click on the slider **Straighten** | 0° |
| ← → ↑ ↓ (focus on the frame) | moving by 1 % of the crop's side, with Shift by 10 % |
| `+` `=` `−` | zooming in and out by 10 % |
| `[` `]` | rotating by 90° to the left and to the right |
| slider **Straighten** ← → | ± 0.5°, with Shift ± 5°, Home and End ± 45° |
| Enter | **Done**; in the first of two steps **Next** ([A12.5](#A12.5)) |
| Escape | **Cancel**: closes only the editor, editing the person under it stays open |

- The frame gets the focus after opening. A screen reader announces zoom and straightening (“Zoom 290 %”,
  “Straighten −2.5°”) 300 ms after the last change. Tab moves through the editor and does not leave it.
- **Limits:** on a computer the footer has a hint of the keys, on a phone and a tablet not. The initial crop is the
  centre of the photo for a single portrait and the partner's half for a portrait from a couple's photo
  ([A12.5](#A12.5)).
- **Controls:** as in the table.
- **Since:** app 3.30.0

<!-- zdroj: app:327d9734 src/ui/portrait-editor.ts ZOOM_STEP 1.1, WHEEL_STEP 1.15, šipky 1 % / Shift 10 %, [ ], Enter, Escape ve fázi capture, live hlášení po 300 ms, past fokusu · app:4cea7fbd Výchozí / 0 / dvojklik = úvodní výřez kroku · strings.ts portrait.keys, frameAria, liveZoom, liveAngle, straightenHint · ZADANI_DEV §3 -->

<a id="A12.2"></a>
## A12.2 The original and the Portrait tag

A portrait remembers from which photo and how it was cut. The whole photo stays with the person as an attachment
tagged **Portrait**, and so the crop can be changed at any time without losing sharpness.

- **The original from a new file:** after **Done** and **Save** the person gets an attachment with the whole photo
  (JPEG, the longer side at most 1600 px, without rotation and flipping, named after the file). It counts in the
  person's total of attachments ([A3.4](A3-evidence-in-the-app.md#A3.4)).
- **The tag Portrait** is at the attachment the portrait is made from, in editing the person, in the person's
  materials and in the viewer's panel (the tooltip “The person’s portrait is cut from this photo.”). In editing the
  person the tag changes right away with the portrait, even before **Save**.
- **A portrait from a photo the person already has:** **As portrait…** in the row of an image attachment (before the
  bin), **Use as portrait…** in the ⋯ menu of the person's materials and in the viewer's panel (between **Download**
  and **Delete from the tree**). The editor opens over that attachment; no new attachment is made. From editing the
  person the result is saved with **Save**, from elsewhere right away: “Portrait of {name} replaced.” with **Undo**.
  The research does not need to be running for it.
- **The person already has a portrait:** the editor shows “This person already has a portrait. Done replaces it; this
  can be undone.” and the previews **Current** → **New**.
- **Deleting the attachment the portrait is made from:** the confirmation says “This is the portrait’s source. The
  portrait stays; its crop can then only change within the finished square.” The portrait stays without a link.
- **Remove** at the portrait in editing the person deletes the portrait and its link; the attachment stays without the
  tag.
- **Limits:** the item **As portrait…** is only at an image attachment with a preview (not at a PDF nor at a file only
  the research holds, [A3.4](A3-evidence-in-the-app.md#A3.4)) and only at an attachment that is not yet the source of
  the portrait. At a locked person and in a read-only tree it is missing. Portraits of two people from one photo are
  made by the couple's photo ([A12.5](#A12.5)).
- **Controls:** editing a person, the section of the photo and **Attachments**; the person page, the materials and the
  attachment's viewer.
- **Since:** app 3.30.0

<!-- zdroj: app:59b9dde9 src/types.ts PortraitCrop, PortraitSource (attachmentId | partnershipId), Person.photoSource · app:88859da2 originál = cropToJpeg celé fotky, ATTACHMENT_MAX_SIDE 1600, ATTACHMENT_QUALITY 0.8, jen z nového souboru · app:e6f0595d src/ui/attachments-ui.ts štítek Portrét, Jako portrét… (isImage && !originalOnly && !locked, ne u zdroje), materials-ui.ts / material-viewer-ui.ts Použít jako portrét… (mezi Stáhnout a Smazat ze stromu), danger.portraitSourceNote, unlinkPortraitFromAttachment, toast portraitReplaced s Vrátit · app:a2af453a Odebrat portrét → zdroj se smaže, příloha zůstane · D5 (bez běžícího výzkumu) · strings.ts attachments.asPortrait, portraitTag, portraitTagTitle, materials.useAsPortrait, portrait.replaceNote, current, newOne, replaced · ZADANI_DEV §4, §10 -->

<a id="A12.3"></a>
## A12.3 Editing the crop later

A portrait with an original can be cut again from the whole photo at any time. A portrait without an original can
only change within its square.

- **With an original:** the editor opens over the attachment or the couple's photo the portrait is made from, with
  the current crop.
- **Without an original** (a portrait from the time before app 3.30.0, from a GEDCOM import, from a merge without a
  source, after the source attachment was deleted): the editor works with the finished 256 px square. The crop can
  only get smaller, move inside, rotate, straighten and flip. The editor says so (“The whole photo is not stored; the
  crop can only get smaller.”) and offers **Choose the photo again…**: it opens the file choice and then goes on as a
  new photo ([A12.1](#A12.1)). Each further edit without an original makes the portrait softer; a new choice of the
  photo puts that right.
- **Portrait | Whole photo:** the enlarged portrait on the person page has at the bottom the switch **Portrait** |
  **Whole photo** when the portrait has its original in the tree. A saved person page (**Save as HTML**) has the link
  **Whole photo** in the enlarged portrait only when the file carries that photo (attachments or the couple's photo
  in the groups of content, [A7.6](A7-book-pages-and-export.md#A7.6)). A portrait without an original and other
  images have no switch.
- **Limits:** the result from editing a person is saved only with **Save**; from the person page it is written right
  away as one step (“Portrait updated.” with **Undo**) and the page is redrawn. In a read-only tree and at a locked
  person there is no editing ([A12.1](#A12.1)).
- **Controls:** editing a person, **Edit crop** between **Choose photo** and **Remove** (only with a photo); the
  person page, ⋯ **More actions** → **Edit portrait crop** (only at a person with a portrait that can be changed).
- **Since:** app 3.30.0

<!-- zdroj: app:1feae064 src/ui/person-modal.ts #photo-recrop-btn (labels.photoRecrop), editor nad zdrojem s photoSource, jinak squareOnly + chooseAgain → #input-photo · src/ui/person-page-ui.ts item('crop', editCrop) jen canEdit && person.photo, Hotovo = jedna transakce, toast portraitUpdated s Vrátit · app:dab74024 src/ui/image-viewer.ts přepínač Portrét | Celá fotka (jen s existujícím zdrojem), src/person-page.ts portraitLightbox odkaz Celá fotka jen když soubor fotku nese · strings.ts labels.photoRecrop, personPage.moreActions, editCrop, portrait, wholePhoto, portrait.noOriginal, chooseAgain, updated · ZADANI_DEV §2, §10 -->

<a id="A12.4"></a>
## A12.4 The couple's photo

A union can have one photo of the couple: a wedding or joint photo. It belongs to the union, not to one of the
partners.

- **The row Photo** at each union in the person's relationships:
  - without a photo **Choose photo** and the hint “A wedding or joint photo of the couple”;
  - with a photo a preview, **Choose photo** (replaces it), **Make portraits…** ([A12.5](#A12.5)), **Remove** and the
    size in kB. A click on the preview opens the viewer with the caption “{A} and {B} · couple’s photo” (the partners
    in the order as on the card), **Download** and **Make portraits…**.
- The photo is reduced like an attachment: a JPEG with the longer side at most 1600 px.
- Changes of the photo in the relationships are saved with the panel's **Save** and **Cancel** throws them away; the
  notice is without **Undo**. Outside the panel (the viewer from the Table, [A12.6](#A12.6)) it is written right away
  as one step with **Undo**.
- **Remove** asks (“Remove the couple’s photo?”, “Portraits made from it stay.”). The portraits stay without a link
  and from then on are edited only within their square ([A12.3](#A12.3)).
- **Deleting a union with a photo** first asks: “The couple’s photo goes with it. Portraits made from it stay.” A union
  without a photo is deleted as before.
- **Limits:** one photo per union; further photos of the couple only as attachments of the people. When one of the
  partners is locked or the tree is read-only, the row shows only the preview and the size.
- **Controls:** editing a person, section **Relationships** → **Manage relationships** (panel **Relationships:
  {name}**), at a union the row **Photo**; in the Unions table **Edit…** at the row
  ([A6.7.8](A6-views.md#A6.7.8)). On a phone the panel fills the whole screen and the row's buttons wrap.
- **Since:** app 3.30.0

<!-- zdroj: app:59b9dde9 src/types.ts Partnership.photo, photoOriginalName, photoDate (verze dat 23), unlinkPortraitsFromUnion · app:9a47896e src/ui/relationships-panel.ts partnershipPhotoRowHtml (Vybrat fotku, unionPhotoHint, náhled → prohlížeč s popiskem, Udělat portréty…, Odebrat s danger.unionPhotoPortraitsStay, kB, zamčený partner jen náhled a velikost), Uložit / Zrušit panelu (D7) · src/attachments.ts ATTACHMENT_MAX_SIDE 1600 · app:68c232ad potvrzení smazání svazku s fotkou deleteUnionPhotoNote (D1) · strings.ts relationships.unionPhoto, unionPhotoHint, makePortraits, unionPhotoCaption, danger.removeUnionPhotoTitle, removeUnionPhoto, unionPhotoPortraitsStay, deleteUnionTitle, deleteUnionPhotoNote, buttons.manageRelationships (index.html #link-relationships), relationships.title · ZADANI_DEV §6, D1, D7, D9 -->

<a id="A12.5"></a>
## A12.5 Portraits from the couple's photo

**Make portraits…** cuts the portrait of each partner from the couple's photo in one editor, step by step.

- The editor **Portraits from the couple’s photo** has a step for each partner in the order as on the card. The
  initial crop is the largest square in the left or right half of the photo; for a portrait-format photo in the upper
  and lower half. The frame of the other partner is shown dashed with the name.
- The steps can be switched in the header; the settings of a step are kept. The footer: **Cancel** · **Skip** ·
  **Next**, in the last step **Done**. A skipped step does not change the portrait.
- **A partner who has a portrait:** “{name} already has a portrait” and the choice **Keep the current portrait** (the
  default; “This step is skipped.”) or **Replace with a new crop** (“The current portrait can be restored.”).
- **A union with one known partner** has one step: “The other partner is unknown; a portrait is made for one person
  only.”
- **Done** saves all new portraits at once, each with a link to the couple's photo; no copy of the photo goes into the
  attachments. The notice: “2 portraits saved from the couple’s photo.” (with skipped ones “…, 1 skipped.”). **Undo**
  returns both portraits in one step; in the relationships the panel's **Save** and **Cancel** apply
  ([A12.4](#A12.4)).
- A portrait from a couple's photo is later edited over the couple's photo ([A12.3](#A12.3)).
- **Limits:** a locked partner gets no step; in a read-only tree there is no **Make portraits…**.
- **Controls:** **Make portraits…** in the row **Photo** in the relationships and in the viewer of the couple's photo
  (also from the Table, [A12.6](#A12.6)). Keys as in [A12.1.1](#A12.1.1).
- **Since:** app 3.30.0

<!-- zdroj: app:9a47896e src/ui/portrait-editor.ts dva kroky (pořadí partnerů jako na kartě, levá / pravá polovina, u fotky na výšku horní / dolní), Přeskočit, Ponechat / Nahradit, Hotovo = jedna transakce, photoSource.partnershipId bez kopie do příloh, toast fromUnion s Vrátit · app:4cea7fbd Výchozí = polovina partnera · app:327d9734 čárkovaný rámeček druhého partnera · D9 zamčený partner · strings.ts portrait.twoTitle, next, skip, skipped, done, hasPortrait, keep, keepSub, replace, replaceSub, keepStage, single, fromUnion · ZADANI_DEV §7 -->

<a id="A12.6"></a>
## A12.6 Where the portrait and the couple's photo appear

The crop applies everywhere a person's photo is shown. The couple's photo is only where the couple is spoken of: in
the relationships, in the Unions table, on person pages and in the family book.

| Place | Portrait (crop) | Couple's photo |
|---|---|---|
| the card in the tree, the hover preview, editing a person | yes | no |
| the person page (in the app and saved) | yes | first in the gallery **Images and documents** of both partners, the caption “{A} and {B} · couple’s photo”, counts among the images |
| family pages (pages of a family line and of the tree) | yes, cut to 4 : 5 | as on the person page |
| Family book | yes | in the family's chapter above the couple's events |
| poster, image export, printing the tree, slideshow | yes | no |
| Table › Unions | – | column **Photo** |
| the person's relationships | – | row **Photo** ([A12.4](#A12.4)) |

- **Table › Unions, column Photo:** in the group **Children and sources**, hidden at first. The cell shows a small
  preview; a click or tap opens the viewer with **Make portraits…**, which are written right away with **Undo**.
  Copying, CSV and XLSX have “yes”, or nothing. Sorting puts unions with a photo before unions without one. The value
  filter **with photo** / **without photo**; **Only** and **Without** in the cell filter the same way
  ([A6.7.6](A6-views.md#A6.7.6)). On a phone the row has a preview only when the column is switched on.
- **Family book:** the photo across the width of the column, at most 110 mm high, with a caption of the kind of union
  and the date (“Marriage, 18 Jun 1924”, for an unmarried couple “Partners”). It is there only with the part **Record
  clippings and photos** ([A7.4](A7-book-pages-and-export.md#A7.4)); a tree whose only images are couples' photos
  offers that part.
- **Pages:** the couple's photo is missing without the group of images and in a page that protects living people
  when at least one of the partners is living ([A12.7](#A12.7)).
- **Limits:** the tree (Family, Descendants, cards, connecting lines), the poster, printing and the slideshow do not
  show the couple's photo. The Table, Fan, Timeline, Map and statistics do not show the portrait (no change).
  **Tree overview** counts couples' photos among the photos and the originals of portraits among the attachments.
- **Controls:** Table › Unions, the choice of columns; the person page; export **Family book**.
- **Since:** app 3.30.0

<!-- zdroj: app:45f7ca2a src/ui/table-view/table-columns.ts:732 uPhoto (group uextra, skrytý, kind thumb), thumbCell (strings.table.yes, sortKey), table-filter.ts presence (withPhoto / withoutPhoto), prohlížeč s Udělat portréty… a Vrátit, telefon (D10) · app:fd1f0c3c src/person-page.ts couplePhotoItems (první v galerii, popisek, počet obrázků, bez skupiny obrázků / žijící partner pod ochranou), rodinné stránky totéž, src/book-blocks.ts couplePhotoHtml (jen parts.media, popisek fields.marriageRow / book.partners + datum), src/book-css.ts .book-photo--couple max-height 110mm · app:50e49518 src/ui/tree-overview.ts a src/attachments.ts: fotka svazku mezi fotkami, originál portrétu je příloha · ZADANI_DEV §5, §8, D10, D12 · strings.ts tableCols.uPhoto, tableFilter.withPhoto, withoutPhoto, table.groups.uextra, personPage.sec.materials, relationships.unionPhotoCaption, book.parts.media -->

<a id="A12.7"></a>
## A12.7 Export, privacy of living people and GEDCOM

The original of a portrait and the couple's photo are photos: they go into an export with photos and drop out with
them.

- **Content of the export** ([A7.3](A7-book-pages-and-export.md#A7.3)):
  - without **Photos** (also **Small file to send** and **Bare skeleton**) the portraits, their originals (even when
    attachments are exported) and the couples' photos disappear; an excerpt of the entry from such an original stays
    without a link;
  - without **Attachments, documents & source excerpts**, but with photos, the portraits and the couples' photos
    stay; portraits from attachments lose the link to the original.
- **Privacy of living people** ([A7.2](A7-book-pages-and-export.md#A7.2)): a living person loses the portrait, the
  original and the attachments; a union with at least one living partner loses the photo. The same on the pages and
  in the family book.
- **The GEDCOM export** writes the couple's photo as an ordinary picture of the family (`1 OBJE` at `FAM`), without a
  tag of Strom's own. The crop and the link of the portrait to the original are not written; the original goes as an
  ordinary attachment of the person. The export **Back to {program}** has no photos
  ([S6.6](S6-tree-from-another-program.md#S6.6)).
- **GEDCOM import:** the first picture of the family (a picture marked `_PRIM`, `_PRIMARY` or `_PERSONALPHOTO` `Y`
  comes first; written directly at the family or by a reference to a media record `@O1@`) becomes the couple's photo
  when it is contained directly in the file. The other pictures of the family are kept for **Back to {program}** as
  before; the picture that became the couple's photo is not written there again. A family photo the file only refers
  to by a path is offered for attaching ([A2.1.1](A2-loading-a-family-tree.md#A2.1.1)).
- **Limits:** a portrait after a GEDCOM import (from Strom and from elsewhere) has no link to an original and is edited
  within its square ([A12.3](#A12.3)). An attached file of a family photo replaces the lines kept for **Back to
  {program}**; it does not go back there then.
- **Controls:** **Export** → **Content**, **Privacy of living people**; **Import → Import GEDCOM**, the import summary.
- **Since:** app 3.30.0

<!-- zdroj: app:50e49518 src/photo.ts stripPhotos (portrét, photoSource, zdrojová příloha i při exportu příloh, Partnership.photo*, výřez zápisu bez fromAttachmentId), src/attachments.ts stripAttachments + dropDanglingPortraitSources, src/privacy.ts (žijící: photoSource, přílohy; svazek se žijícím partnerem bez fotky), CONTENT_PRESETS (small, skeleton bez fotek; back bez médií) · app:68c232ad src/ged-exporter.ts:2089 Partnership.photo → 1 OBJE u FAM bez _STROM_KIND, photoSource se nezapisuje · src/ged-parser.ts první obrázek rodiny (_PRIM/_PRIMARY/_PERSONALPHOTO Y první, na místě i @O1@) → Partnership.photo jen jako bezpečná data URL, ostatní v extras pro Zpět do, vložený se nezapíše dvakrát · src/ged-media-attach.ts attachGedcomMediaFile (partnershipId: jen obrázek, jen svazek bez fotky, dropMediaLink) · strings.ts privacy.contentPhotos, contentAttachments, presetSmall, presetSkeleton · ZADANI_DEV „Data a rozhraní“, §6 -->

<a id="A12.8"></a>
## A12.8 Photos in the data of the tree

The original of a portrait, the crop and the couple's photo are part of the tree (data version 23). They go with the
tree into the JSON backup and into the file **App with data**.

- **An older app** (from 3.19.0) opens a tree of version 23 read-only and does not save it, so that it does not throw
  away portraits, originals and couples' photos ([A6.7.7](A6-views.md#A6.7.7)).
- **Undo:** each **Done** outside editing a person is one step; in editing a person everything is saved and undone
  with its **Save**; two portraits from a couple's photo are one step.
- **Merging people:** the link to the original goes with the portrait that stays. For unions the photo of the kept
  union stays, and when it has none, the photo of the other one.
- **Merging trees** ([A8](A8-merging-trees.md)): the couple's photo from the merged file is added where the union in
  the tree has none; a portrait keeps the original of the portrait that won.
- **A tree from the research or a Strom archive:** neither the research nor the archive holds portraits, originals,
  couples' photos and links, and they do not send them. Loading a new version from the research keeps them in the
  tree: when the research has a photo of its own for a person or a couple, its photo applies; otherwise the photo
  from the tree stays. A portrait, attachment or couple's photo removed in the app does not come back with the next
  update.
- **Limits:** portraits, originals and couples' photos are only in the tree in the app and in its backups. A link to
  an original that does not fit (the original missing, the crop outside the photo, an angle over 45°) is dropped on
  loading; the portrait stays.
- **Since:** app 3.30.0

<!-- zdroj: app:src/types.ts:1814 STROM_DATA_VERSION 23 (app:59b9dde9) · src/photo.ts dropDanglingPortraitSources, sanitize při načtení · src/tree-manager.ts:659 isTreeNewer (jen ke čtení), strings.ts newerDataTitle · src/merge/executor.ts photoSource s vítězným portrétem, fotka svazku vítězného jinak druhého (app:59b9dde9, 50e49518) · app:50e49518 sloučení souboru: fotka svazku tam, kde chybí, originál podle bajtů · app:3f0312fb, 50e49518 src/research-link.ts carryOverMedia (fotka svazku a photoSource přenesené, vlastní fotka výzkumu vyhrává, odebrané se nevrací) · dirigent:spec/107 rozhodnutí: výzkum a archiv fotky nedrží (ZADANI_VYZKUM V2, V6, V7); obnova z výzkumu je spec 108, zatím nedokumentovat -->
