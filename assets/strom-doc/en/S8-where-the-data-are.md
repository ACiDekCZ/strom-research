<a id="S8"></a>
# S8 Where the data are

The app keeps trees in the browser's storage on this device. The research and the Strom archive keep their tree in a
folder on the disk of this computer, with sources, material and history. From the research 1.35.0 the research also
holds the portraits, couples' photos and attachments of the tree from the app. The chapter describes the Strom app
3.30.0 and the research 1.35.0. How the bridge between them carries the tree is described in
[S1](S1-connecting-app-and-research.md) and [S2](S2-edits-from-the-app.md).

| What | Where it is | Lasting copy | Controls |
|---|---|---|---|
| the tree in the app, backups in the app | the browser's storage | a JSON file (**Save to file**, **Export**) | app: **Where the data is** |
| originals waiting for the research | the browser's storage, at most 2 GB | none until the research accepts them ([A3.4.1](A3-evidence-in-the-app.md#A3.4.1)) | app: **Settings → Data and privacy** |
| the research's tree, sources, material, history | the research's folder (by default `Strom` in Documents) | the pack `strom pack` | terminal |
| scans from archives, originals, the tree's files from the app | the research's shared folder (`shared`) | the pack `strom pack` | terminal |
| portraits, couples' photos, attachments | in the tree in the app; from the research 1.35.0 also in the research | a JSON file with images, or the research 1.35.0 | app and terminal |

<!-- zdroj: dirigent:spec/108-kde-se-co-uklada · app:src/storage.ts strom-db, strom-originals · strings.ts fileCopy.title „Kde jsou data“, fileCopy.intro, backupsNote · research:src/core/paths.ts:148 (Dokumenty/Strom), src/core/config.ts:276 shared · research:c9a4b614 CHANGELOG.cs.md 1.35.0 -->

<a id="S8.1"></a>
## S8.1 What is only in the browser

The tree in the app is only in this browser's storage until it is saved to a file. The browser can delete the
storage; the backups in the app lie in the same storage and disappear with it.

- The window **Where the data is** says whether the browser keeps the storage for good, when the tree was last saved
  to a file and how to keep the storage (installing as an app, persistent storage in Firefox, the Dock or the home
  screen in Safari).
- **Save to file** saves the whole tree with all data and images to a JSON file that can be opened again in Strom. An
  encrypted tree can be saved encrypted.
- A private browser window deletes the trees when it is closed.
- **Limits:**
  - each browser and each device has its own storage: a tree opened in Chrome is neither in Edge nor on the phone;
  - originals waiting for the research are not in the tree, in the backups or in the export
    ([A3.4.1](A3-evidence-in-the-app.md#A3.4.1));
  - in a tree without a research, portraits, couples' photos and attachments are only in the tree in the browser and
    in its files: "The files are only in this browser. Backup: Export all."
- **Controls:** app: the indicator **Only in browser** in the bar, **Where is my data?**; **Settings → Remind me to
  save to a file**.
- **Since:** app 3.0.0

<!-- zdroj: app:src/storage.ts strom-db · src/ui/file-copy-ui.ts · strings.ts fileCopy.title, intro, statePersistent, stateNotPersistent, statePrivate, backupsNote, save, quickHint, saveEncryptedBtn, details, settingLabel · materials.whereApp · S1.8 -->

<a id="S8.2"></a>
## S8.2 What is in the research and in the Strom archive

The research and the Strom archive keep the tree in a folder of their own on the disk. In it they have the tree with
its history, sources, material and tasks; scans from archives, originals and the tree's files from the app are in the
shared folder, each file once.

- The tree in the app and the tree in the research are two copies. What the app sends, the research writes as in
  [S2](S2-edits-from-the-app.md).
- The research's files that are not in the tree are shown by the app in the window **Materials** as **only in the
  archive** ([A3.5](A3-evidence-in-the-app.md#A3.5)).
- **Limits:**
  - an encrypted tree in the app does not mean an encrypted research: "The tree is encrypted; the research on disk is
    not.";
  - the research's material is shown only in the app on a computer.
- **Controls:** terminal: `strom pack` (a pack as a backup or for handing over), `strom unpack`, `strom trees remove`
  ([S8.6](#S8.6)); app: ⓘ **Where the files are** in the window **Materials**.
- **Since:** research 1.0.0; the tree's files from the app in the research 1.35.0

<!-- zdroj: research:src/core/paths.ts, src/core/config.ts (home, shared), src/core/media.ts sharedMediaPath (media/<sha[0:2]>/<sha[2:4]>/<sha><ext>) · app:strings.ts materials.whereTitle, whereArchiveResearch, whereEncryptedResearch, desktopOnlyResearch -->

<a id="S8.3"></a>
## S8.3 The tree's photos and attachments in the research

The research 1.35.0 and the Strom archive 1.35.0 hold the portraits, couples' photos and attachments of the tree from
the Strom app. Writing the tree hands them all over; the research stores each file once, by its content, with its
places in the tree ([R11.5.1](R11-material-from-the-user.md#R11.5.1)).

- The original of a portrait goes to the research as the original of an attachment tagged **Portrait**, the original
  of a couple's photo as material of both partners. An original creates a material task; in the Strom archive it waits
  set aside.
  - **From research 1.36.0:** the material task is created only with the setting **The agent goes through files sent
    to the research by itself** switched on; otherwise the original waits in Materials, not sorted yet
    ([R11.6](R11-material-from-the-user.md#R11.6)).
- Loading the tree from the research returns the files by their fingerprint: the app gets the portraits, couples'
  photos and attachments in their places. A file removed in the app is hidden by the research, not deleted
  ([A3.5.6](A3-evidence-in-the-app.md#A3.5.6)).
- **Limits:**
  - the research does not hold where in the whole photo the crop of a portrait is. The tree in the app keeps it when
    a new version is loaded; a tree loaded from the research for the first time has the portrait and the whole photo,
    but **Edit crop** works only inside the portrait's square ([A12.3](A12-portrait-and-couple-photo.md#A12.3));
  - the research up to 1.34 does not hold the tree's files: portraits, couples' photos and attachments are only in the
    app and loading from the research keeps them in the tree ([A12.8](A12-portrait-and-couple-photo.md#A12.8));
  - only on a computer and only with the research's bridge.
- **Controls:** app: writing the tree (**Send**, [S2](S2-edits-from-the-app.md)); **Research for this tree → Send
  original files**.
- **Since:** app 3.30.0, research 1.35.0

<!-- zdroj: dirigent:spec/108-kde-se-co-uklada (U8, K2.3, K2.6, K2.7) · app:3419afff POST /sync?media=app, 7263f1f6 GET /tree.ged?images=ref&media=app, 402b7d9b, e3e415f6 (X-Strom-Person, originál se štítkem Portrét), 59ff465e · src/research-link.ts carryOverMedia (photoSource ponechaný, base K2.3) · research:0834987b (X-Strom-Family), 3925b84a (_PRIM Y), 815bc90d, 91ab6230, 771d8af0 · research:src/core/treemedia.ts (hlavička) · research:c9a4b614 CHANGELOG.cs.md 1.35.0 -->

<a id="S8.4"></a>
## S8.4 The indicator Only in browser

The indicator **Only in browser** is lit when the tree has changes that no file holds. In a tree with a research on
the computer it is not lit when the research holds all its edits.

- Edits sent to the research, or fresh ones sent within 10 minutes, count as held. An edit not sent for longer (the
  bridge is not running, the research refused it, sending is manual) lights the indicator.
- The research up to 1.34 does not hold portraits, couples' photos and attachments: until a file has them, the
  indicator is lit even in a tree whose edits the research holds.
- With the research 1.35.0 the photos and attachments count as held after the first writing of the tree that handed
  them over. An image added after that waits like any edit not sent.
- **Limits:** an export without photos does not count as a copy of the photos. A research tree not opened since the
  app was updated counts as before until it is opened.
- **Controls:** app: the indicator in the bar opens **Where the data is**; **Save to file**.
- **Since:** app 3.0.0; 3.30.0: photos and attachments in the indicator
- **From app 3.31.0:** when the research holds the tree except the portraits, couples' photos and attachments, the
  indicator says **Photos only in browser**, the hover text "The research holds the tree, not its portraits, couples’
  photos and attachments: they are only in the browser, not in a file yet — the browser may clear them". The same is
  said by the line in **More** ("More – photos are not saved"), the notice ("Save the tree to a file now and then.")
  and the dialog **Where the data is** ("The research holds the tree, but portraits, couples’ photos and attachments
  added since then are only in the browser."). This holds only when all the trees the indicator counts are like
  that. When an edit also stays unsent for longer than 10 minutes, the indicator says **Only in browser** again.

<!-- zdroj: app:e434e730, a678b253 src/browser-media.ts browserMediaFingerprint, browserMediaSafe, archiveHoldsAppMedia · src/ui/research-sync-ui.ts researchHoldsTree, RESEARCH_HOLD_MS=10 min, researchArchiveHoldsMedia · src/tree-manager.ts noteFileCopy (export bez fotek), learnMediaFingerprints · src/ui/file-copy-ui.ts unsavedOutsideResearch · strings.ts fileCopy.indicatorShort, indicatorTitle · dirigent:spec/108-kde-se-co-uklada K1b.1, K2.6 · 3.31.0: app 110f4109 src/ui/research-sync-ui.ts researchHoldsTree → photos, src/file-copy.ts unsavedKind (všechny stromy photos), strings.ts fileCopy.photosShort, photosTitle, photosMoreHint, noticePhotos, copyPhotosSince, copyPhotosNever · SPEC.md 1120-app-108-diry -->

<a id="S8.5"></a>
## S8.5 The photos from the research could not be loaded

When the tree is loaded from a research that holds the tree's files but its photos cannot be loaded by their
fingerprint, the app loads the tree without them and removes nothing the research has.

- Until the photos come, writings of the tree only add: a file the tree in the app does not have now is not removed
  by the research.
- The app tries again by itself after 5 and after 30 seconds. When that fails, it announces "The photos from the
  research could not be loaded." with **Try again**.
- **Limits:** **Try again** loads the version from the research like any loading: when the tree has changed in the
  meantime, it asks.
- **Controls:** app: the notice → **Try again**.
- **Since:** app 3.30.0, research 1.35.0
- **From app 3.31.0:** when the tree is opened with **Follow live**, the photos come after the tree
  ([S1.4.1](S1-connecting-app-and-research.md#S1.4.1)). Photos that did not come are reported there by “Some photos
  did not load (N).” with **Try again**; it is not retried by
  itself after 5 s and 30 s. Until they come, the tree's writes still only
  add.

<!-- zdroj: app:src/ui/research-ui.ts startLiveFollow onDone (failed → noteResearchMediaMissed, bez researchMediaMissed a MEDIA_RETRY_MS), src/ui/image-load-chip.ts showFailed · spec 116 · app:6bbc2f82 src/ui/research-ui.ts noteResearchMediaMissed (zápisy jen přidávají), 61ef1bdd MEDIA_RETRY_MS=[5000, 30000], researchMediaMissed, tellResearchMediaMissed, researchRetryMedia · strings.ts sync.mediaMissed, sync.retry -->

<a id="S8.6"></a>
## S8.6 The pack and removing a tree: scans and family photos

`strom pack` and `strom trees remove` tell **archive scans** from **the family's photos and originals**. Scans can be
downloaded from the archive again, the family's photos and originals cannot.

- A scan is an image from an archive (a book or a downloaded image). A file that is both counts as the family's.
- `strom pack` lists both separately. Of the scans it packs those with records and those no one downloads again (or
  all); the family's photos and originals always all, with the reduced copies of the tree's files too. The pack also
  carries the batches from the app.
- The batches from the app go in the pack with their name, people and note too; `strom unpack` brings them back
  together with the batch's files ([R11.4](R11-material-from-the-user.md#R11.4)).
- `strom trees remove` first offers a backup as a pack with all the archive scans, the family's photos and the
  originals (`strom unpack` brings it back), then asks separately about the scans and separately about
  the family's photos and originals that no other family tree uses; for the family's photos the default answer is no.
  The removal is confirmed by typing the family tree's name. The files go to the bin as one folder "<name> – files".
- **Limits:**
  - a pack over 4 GB or over 65,535 files is refused by the research before anything is written: the research is
    carried by copying the whole folder (to a USB disk, to a cloud folder). `strom trees remove` says so at the backup
    and goes on without it;
  - only a person at the computer removes a family tree, not the agent.
- **Controls:** terminal: `strom pack [--all-images]`, `strom unpack "<file>"`, `strom trees remove`.
- **Since:** research 1.35.0

<!-- zdroj: research:31def74a src/commands/pack.ts (ui.pack.images, ui.pack.family, ui.pack.batches, pack.too-large), src/core/pack.ts (bez ZIP64), src/core/zip.ts ZIP_MAX_FILES=0xffff · src/commands/trees.ts:271-287 (záloha výchozí ano, skeny ano jen se zálohou, rodinné ne, název), ui.remove.images.folder · research:771d8af0 (zmenšené kopie v balíku) · assets/lang/cs.json ui.pack.*, ui.remove.*, ui.error.pack.too-large · ui.pack.batches, ui.unpack.batches (v1.35.0) · trees remove: strom pack --all-images · e6bbfb40 ui.pack.which, ui.remove.backup (1.36.0 jen texty) -->
