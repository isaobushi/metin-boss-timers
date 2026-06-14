// Pure UI-chrome resolver (PRD #77, slice #84): the module that owns "how a chrome string is
// spelled in a given locale". Its interface is two stable shapes:
//   - `t(key, locale) → string` — the public resolver components call
//   - `resolveChrome(tables, key, locale) → string` — the pure core `t()` wraps, exported so
//     tests can drive the fallback path with stub tables before a second locale ships (same
//     approach as locale.test.ts for the equivalent content-catalog bind)
//
// SEPARATION OF CONCERNS: this resolver handles UI CHROME (buttons, labels, titles, empty
// states, aria-labels, tooltips, confirm copy) — strings that are FREE-TRANSLATED for each
// locale. Game content (boss/ability/item names) must be TRANSCRIBED from the official client
// and lives in `contentCatalog.ts`. These two concerns are deliberately separate modules with
// no shared table; routing a game term through `t()` would risk translating something that
// must be transcribed verbatim.
//
// KEY NAMING: stable, surface-namespaced identifiers (`surface.concept`). Each surface has
// its own section in the English table so a future translator can navigate by surface. The
// table shape is `Record<ChromeKey, string>` — unknown keys are compile errors in `t()` calls,
// while non-`en` tables (Slice 5+) can be `Partial<Record<ChromeKey, string>>` with runtime
// English fallback for any missing key.

import type { Locale } from "./localeTypes";

// ---- English chrome table ----
// Grouped by surface (section comments). These are the authoritative English strings; every
// `en` value must match the literal that was in the component before this migration — verified
// by the issue's "English output unchanged" acceptance criterion.

const EN = {
  // ---- DockBar ----
  "dock.drag":            "drag to move",
  "dock.skills":          "skills",
  "dock.cooldowns":       "dungeon cooldowns",
  "dock.expiring":        "expiring items",
  "dock.routine":         "training",
  "dock.settings":        "settings",
  "dock.quit":            "quit Dragon's Aid",

  // ---- TimerScreen ----
  "timer.noSkills":       "no skills — add some in ⚙ settings",
  "timer.back":           "back to dungeons",
  // The hint renders with inline <b> tags, so it is split at the bold boundaries: the JSX keeps
  // the structure (<b>{leftClick}</b> {stopStart} · <b>{rightClick}</b> {reset}) and each segment
  // is its own key — a translator authors all four; the · separator stays layout, not language.
  "timer.hintLeftClick":  "left-click",
  "timer.hintStopStart":  "stop / start",
  "timer.hintRightClick": "right-click",
  "timer.hintReset":      "reset",

  // ---- BossSelect ----
  "bossSelect.title":     "SELECT DUNGEON",

  // ---- SequenceScreen ----
  "sequence.back":            "back to boss select",
  "sequence.switchToColumns": "Switch to Columns (Phase 2)",
  "sequence.switchToElements": "Switch to Elements (Phase 1)",
  // The title (tooltip) variants are authored separately rather than derived by .toLowerCase():
  // a runtime case transform would corrupt locales with their own casing rules (German nouns).
  "sequence.switchToColumnsTitle": "switch to columns (Phase 2)",
  "sequence.switchToElementsTitle": "switch to elements (Phase 1)",
  "sequence.columnsLabel":    "Columns",
  "sequence.elementsLabel":   "Elements",
  "sequence.undo":            "undo last",
  "sequence.clear":           "clear",
  "sequence.queenShift":      "Queen shift",
  "sequence.queenShiftTitle": "queen: shift the order one place (1·2·3·4 → 4·1·2·3)",
  "sequence.empty":           "tap above to record the order — tap a chip to tick it off",
  "sequence.chipTitle":       "tap when destroyed / opened",
  "sequence.titleElements":   "TEMPLUM · ELEMENTS",
  "sequence.titleColumns":    "TEMPLUM · COLUMNS",

  // ---- BossSettings ----
  "boss.bossNamePlaceholder": "boss name",
  "boss.deleteBoss":          "delete boss",
  "boss.colSkill":            "SKILL",
  "boss.colSec":              "SEC",
  "boss.colSound":            "SOUND",
  "boss.colHotkey":           "HOTKEY",
  "boss.skillNamePlaceholder": "name",
  "boss.durationTitle":       "duration (seconds)",
  "boss.soundTitle":          "sound played on this skill's cues",
  "boss.previewSound":        "preview this sound",
  "boss.hotkeyTitle":         "hotkey to reset this timer — click, then press a key (Esc clears)",
  "boss.removeSkill":         "remove skill",
  "boss.noSkills":            "no skills yet",
  "boss.addSkill":            "+ ADD SKILL",

  // ---- CooldownSettings ----
  "cooldown.title":           "COOLDOWNS",
  "cooldown.colName":         "NAME",
  "cooldown.colTag":          "TAG",
  "cooldown.colDuration":     "DURATION",
  "cooldown.namePlaceholder": "name",
  "cooldown.tagPlaceholder":  "tag",
  "cooldown.tagTitle":        "short label shown in the strip (auto-derived from the name; editable)",
  "cooldown.durationTitle":   "duration (hours / minutes)",
  "cooldown.removeCooldown":  "remove cooldown",
  "cooldown.noCooldowns":     "no cooldowns yet",
  "cooldown.addCooldown":     "+ ADD COOLDOWN",

  // ---- RecurringSettings ----
  "recurring.colName":        "NAME",
  "recurring.colDuration":    "DURATION",
  "recurring.colRank":        "RANK",
  "recurring.namePlaceholder": "name",
  "recurring.durationTitle":  "duration (days / hours / minutes)",
  "recurring.removeItem":     "remove item",
  "recurring.titleItems":     "EXPIRING ITEMS",
  "recurring.titleRoutine":   "TRAINING",
  "recurring.addItem":        "+ ADD ITEM",
  "recurring.addRoutine":     "+ ADD TRAINING",
  "recurring.noItems":        "no expiring items yet",
  "recurring.noRoutine":      "no training items yet",
  "recurring.markMaxed":      "maxed — retire from training (reversible)",
  "recurring.restoreMaxed":   "maxed — click to restore to training",
  "recurring.customTraining": "+ CUSTOM TRAINING",
  "recurring.pickerFilter":   "filter training…",
  "recurring.alreadyAdded":   "already added",

  // ---- CooldownPicker ----
  "picker.startCooldown":     "start a cooldown",
  "picker.hint":              "scroll to change time",
  "picker.itemTitle":         "click to start · scroll to tune duration",

  // ---- CooldownStrip ----
  // The pill tooltip's chrome suffix; the `${name} — ` prefix is game content and stays in JSX.
  "cooldownStrip.pillHint":   "left-click restart · right-click clear",

  // ---- ExpiringAccordion ----
  "expiring.empty":           "no expiring items yet",
  "expiring.refresh":         "refresh — restamp a full cycle from now",
  "expiring.start":           "start — stamp a full cycle from now",

  // ---- RoutineAccordion ----
  "routine.empty":            "no training items yet",
  // Section-band headers (#57). These name UI groupings, not game terms — chrome, not catalog.
  "routine.sectionBooks":     "Skill Books",
  "routine.sectionLanguages": "Languages",
  "routine.sectionChores":    "Utilities",
  "routine.readSuccessReady": "successful read — advance the rung and restamp the 24h gate",
  "routine.readSuccessEarly": "read now (skipped the cooldown) — advance the rung and restamp from now",
  "routine.readFailReady":    "failed read — book burned, no advance; restamp the 24h gate",
  "routine.readFailEarly":    "read now (skipped the cooldown) but failed — book burned, no advance; restamp from now",
  "routine.markDoneReady":    "mark done — restamp a full cycle from now",
  "routine.markDoneEarly":    "done early — restamp from now (forfeits the wait)",
  "routine.skipCooldown":     "use the scroll to skip the cooldown for an early read (used an item)",

  // ---- RungCurtain ----
  "rung.triggerTitle":        "set current rung",
  "rung.filterPlaceholder":   "filter rungs…",
  "rung.filterAriaLabel":     "filter rungs",
  "rung.noMatch":             "no match",

  // ---- CharacterSwitcher ----
  "char.activeCharacterTitle":  "active character",
  "char.frozenTitle":           "Frozen — resubscribe to use this character",
  "char.editTitle":             "edit / classify",
  "char.editFrozenTitle":       "frozen — resubscribe to edit",
  "char.deleteTitle":           "delete",
  "char.deleteFrozenTitle":     "frozen — resubscribe to manage",
  "char.deleteOnlyTitle":       "the only character can't be deleted",
  "char.newCharacter":          "+ New character",
  "char.addWithPro":            "✦ Add characters with Pro",

  // ---- CharacterWizard ----
  "wizard.newCharacter":    "NEW CHARACTER",
  "wizard.editCharacter":   "EDIT CHARACTER",
  "wizard.cancel":          "cancel",
  "wizard.namePlaceholder": "character name…",
  "wizard.nameAriaLabel":   "character name",
  "wizard.back":            "← Back",
  "wizard.next":            "Next →",
  "wizard.save":            "Save",
  "wizard.create":          "Create",

  // ---- TourCard (#70 — the 9-beat first-run tour; keys are referenced from tourSteps.ts) ----
  // Glossary note: the domain term is "Elapsable item" (CONTEXT.md), whose established user-facing
  // surface form is "expiring items" (dock.expiring, recurring.titleItems) — the tour matches the
  // labels the user actually sees. Avoid-words hold everywhere: no reminder/daily/quest/alarm.
  "tour.welcomeTitle":   "WELCOME",
  "tour.welcomeBody":    "This dock floats on top of your game — each glyph below is a tool. A quick tour of every section follows; skip any time.",
  "tour.dockTitle":      "THE DOCK",
  "tour.dockBody":       "The bar stays on top of the game window. Drag the grip to park it anywhere; every tool opens right below it.",
  "tour.characterTitle": "YOUR CHARACTER",
  "tour.characterBody":  "Who do you play? Name, empire, class — Training tailors its menu of chores to exactly that. More characters can join later from the chip at the dock's left.",
  "tour.skillsTitle":    "DUNGEONS",
  "tour.skillsBody":     "⚔ opens your Dungeons: pick the boss you're fighting and each skill becomes a draining chip with sound cues in its final seconds, reset by global hotkeys mid-fight.",
  "tour.cooldownsTitle": "COOLDOWNS",
  "tour.cooldownsBody":  "⏱ starts one-shot countdowns to a fixed moment — dungeon re-entry, a spawn you're waiting out. They follow the clock and survive restarts.",
  "tour.itemsTitle":     "EXPIRING ITEMS",
  "tour.itemsBody":      "⧗ watches what runs out — pet, costume, mount. Each shows the days left; ↻ restamps a fresh cycle when you feed or renew.",
  "tour.routineTitle":   "TRAINING",
  "tour.routineBody":    "✓ is a menu of rolling chores — skill-book reads, Biologist hand-ins. You're not behind: pick what fits your character, and ✓ restamps it to its next window.",
  "tour.settingsTitle":  "SETTINGS",
  "tour.settingsBody":   "⚙ opens the settings window — bosses, hotkeys, sounds, language and backups live there. No need to go in now.",
  "tour.doneTitle":      "ALL SET",
  "tour.doneBody":       "That's the dock. Find this tour again under ⚙ → Show me around. Good hunting!",
  "tour.next":           "Next →",
  "tour.back":           "← Back",
  "tour.finish":         "Got it",
  "tour.skip":           "✕ Skip tour",
  "tour.makeItYours":    "⚙ Make it yours →",

  // ---- SubscribeScreen ----
  "subscribe.title":                "DRAGONSAID PRO",
  "subscribe.planAriaLabel":        "Subscription plan",
  "subscribe.bestValue":            "BEST VALUE",
  "subscribe.planAnnual":           "Annual",
  "subscribe.planMonthly":          "Monthly",
  "subscribe.startTrial":           "Start 7-day free trial",
  "subscribe.done":                 "Done",
  "subscribe.notNow":               "Not now",
  "subscribe.ledeTrial":            "You're trying Pro free. Lock it in to keep your stable when the trial ends.",
  "subscribe.ledeLapsed":           "Welcome back. Resubscribe to instantly thaw your frozen stable — nothing was lost.",
  "subscribe.ledeSubscribed":       "You're Pro. Thanks for keeping the app growing.",
  "subscribe.ledeDefault":          "The maintained, growing Pro app — curated dungeon knowledge, for your whole stable.",
  "subscribe.unlock1":              "Prebuilt dungeon sequences — Templum Serpens & more",
  "subscribe.unlock2":              "Your whole stable — unlimited character profiles",
  "subscribe.unlock3":              "Skill catalog autofilled by race & empire",
  "subscribe.unlock4":              "Per-ability ladders — M1→G1 books-remaining tracking",
  "subscribe.unlock5":              "Every cap lifted — bosses, reminders, characters",
  "subscribe.resubscribe":          "Resubscribe",
  "subscribe.subscribe":            "Subscribe",
  "subscribe.orSubscribeNow":       "or subscribe now",
  "subscribe.error":                "The Store couldn't complete the purchase — nothing was changed. Try again in a moment.",

  // ---- UpgradeBanner ----
  "banner.trialLabel":          "✦ Pro trial active",
  "banner.trialCta":            "Keep Pro",
  "banner.lapsedLabel":         "✦ Pro paused — your stable is frozen",
  "banner.lapsedCta":           "Resubscribe",
  "banner.neverLabel":          "✦ Unlock Dragon's Aid Pro",
  "banner.neverCta":            "Upgrade",

  // ---- CapNudge ----
  "cap.addBoss":        "Lite includes 1 custom boss. Pro lifts every cap — build as many boss sequences as you like.",
  "cap.addCharacter":   "Lite is a single character. Pro unlocks your whole stable — unlimited profiles.",
  "cap.addReminder":    "Lite includes 3 reminders. Pro lifts the cap so you can track every chore.",
  "cap.seePro":         "See Pro",
  "cap.dismiss":        "Dismiss",

  // ---- SettingsApp ----
  "settings.title":             "SETTINGS",
  "settings.resetToDefaults":   "reset this section to defaults",
  "settings.resetConfirm":      "Reset this section to its defaults? Your other sections won't change.",
  "settings.close":             "close",
  "settings.tabDungeons":       "Dungeons",
  "settings.tabCooldowns":      "Cooldowns",
  "settings.tabItems":          "Items",
  "settings.tabRoutine":        "Training",
  "settings.tabLanguage":       "Language",
  "settings.addBoss":           "+ ADD BOSS",
  "settings.closeTitle":        "close settings",
  // Per-tab explainer headers (#72) — a persistent one-liner in glossary language, teaching on
  // every visit (not just first-run). Wording mirrors the tour beats so the two surfaces agree.
  "settings.explainDungeons":   "Dungeons — your bosses and their skill chips: names, durations, sounds and global hotkeys.",
  "settings.explainCooldowns":  "Cooldowns — one-shot dungeon respawns; set each one's duration here.",
  "settings.explainItems":      "Expiring items — pet, costume, mount; set how long each cycle runs.",
  "settings.explainRoutine":    "Training — the menu of rolling chores; add entries and tune each one's window.",
  // The tour-replay row (#73) — the permanent home the Done beat points at (tour.doneBody).
  "settings.showAround":        "SHOW ME AROUND",
  "settings.showAroundHint":    "Replay the quick tour of the dock and its tools.",

  // ---- LocaleSettings ----
  "locale.title":   "LANGUAGE",
  "locale.hint":    "Content names are shown in the selected language. Free-text names you typed yourself are never changed.",
  "locale.filterPlaceholder": "filter languages…",
  "locale.filterAriaLabel":   "filter languages",

  // ---- BackupSection ----
  "backup.export":    "EXPORT BACKUP",
  "backup.import":    "IMPORT BACKUP",
  "backup.hint":      "A portable copy of all your dungeons, cooldowns, characters and training. Importing a Pro backup into Lite keeps everything — anything over the caps stays frozen until you resubscribe.",
  "backup.exported":  "Backup exported.",
  "backup.imported":  "Backup imported.",
  "backup.invalid":   "That file isn't a valid backup — nothing was changed.",
} as const;

/** Every chrome key in the English table — the only valid argument to `t()`. */
export type ChromeKey = keyof typeof EN;

/** The English chrome table (the `en` locale's full record). */
type ChromeTable = Record<ChromeKey, string>;

// ---- German chrome table (slice #85) ----
// Free-translated DE strings. Informal "du" register (Metin2 DE client convention).
// German noun capitalisation is authored here — no runtime case transforms anywhere (see ~line 57).
// Omitted keys fall back to English (see resolveChrome). Keys left untranslated are noted in the
// PR body; any key the translator is unsure of should be omitted rather than guessed badly.
//
// Section comments mirror the EN table so a human reviewer can vet section by section.
const DE_PARTIAL: Partial<Record<ChromeKey, string>> = {
  // ---- DockBar ----
  "dock.drag":            "verschieben",
  "dock.skills":          "Skills",
  "dock.cooldowns":       "Dungeon-Cooldowns",
  "dock.expiring":        "Ablaufende Items",
  "dock.routine":         "Training",
  "dock.settings":        "Einstellungen",
  "dock.quit":            "Dragon's Aid beenden",

  // ---- TimerScreen ----
  "timer.noSkills":       "keine Skills — füge welche in ⚙ Einstellungen hinzu",
  "timer.back":           "zurück zu Dungeons",
  "timer.hintLeftClick":  "Linksklick",
  "timer.hintStopStart":  "stop / start",
  "timer.hintRightClick": "Rechtsklick",
  "timer.hintReset":      "zurücksetzen",

  // ---- BossSelect ----
  "bossSelect.title":     "DUNGEON WÄHLEN",

  // ---- SequenceScreen ----
  "sequence.back":                  "zurück zur Dungeon-Auswahl",
  "sequence.switchToColumns":       "Zu Spalten wechseln (Phase 2)",
  "sequence.switchToElements":      "Zu Elemente wechseln (Phase 1)",
  "sequence.switchToColumnsTitle":  "zu Spalten wechseln (Phase 2)",
  "sequence.switchToElementsTitle": "zu Elemente wechseln (Phase 1)",
  "sequence.columnsLabel":          "Spalten",
  "sequence.elementsLabel":         "Elemente",
  "sequence.undo":                  "rückgängig",
  "sequence.clear":                 "leeren",
  "sequence.queenShift":            "Queen-Verschiebung",
  "sequence.queenShiftTitle":       "Queen: Reihenfolge um eine Position verschieben (1·2·3·4 → 4·1·2·3)",
  "sequence.empty":                 "oben tippen, um die Reihenfolge aufzuzeichnen — Chip antippen zum Abhaken",
  "sequence.chipTitle":             "antippen wenn zerstört / geöffnet",
  "sequence.titleElements":         "TEMPLUM · ELEMENTE",
  "sequence.titleColumns":          "TEMPLUM · SPALTEN",

  // ---- BossSettings ----
  "boss.bossNamePlaceholder": "Boss-Name",
  "boss.deleteBoss":          "Boss löschen",
  "boss.colSkill":            "SKILL",
  "boss.colSec":              "SEK",
  "boss.colSound":            "SOUND",
  "boss.colHotkey":           "HOTKEY",
  "boss.skillNamePlaceholder": "Name",
  "boss.durationTitle":       "Dauer (Sekunden)",
  "boss.soundTitle":          "Sound für die Hinweise dieses Skills",
  "boss.previewSound":        "Sound vorhören",
  "boss.hotkeyTitle":         "Hotkey zum Zurücksetzen — klicken, dann Taste drücken (Esc löscht)",
  "boss.removeSkill":         "Skill entfernen",
  "boss.noSkills":            "noch keine Skills",
  "boss.addSkill":            "+ SKILL HINZUFÜGEN",

  // ---- CooldownSettings ----
  "cooldown.title":           "COOLDOWNS",
  "cooldown.colName":         "NAME",
  "cooldown.colTag":          "TAG",
  "cooldown.colDuration":     "DAUER",
  "cooldown.namePlaceholder": "Name",
  "cooldown.tagPlaceholder":  "Tag",
  "cooldown.tagTitle":        "Kurzbezeichnung im Strip (aus dem Namen abgeleitet; bearbeitbar)",
  "cooldown.durationTitle":   "Dauer (Stunden / Minuten)",
  "cooldown.removeCooldown":  "Cooldown entfernen",
  "cooldown.noCooldowns":     "noch keine Cooldowns",
  "cooldown.addCooldown":     "+ COOLDOWN HINZUFÜGEN",

  // ---- RecurringSettings ----
  "recurring.colName":        "NAME",
  "recurring.colDuration":    "DAUER",
  "recurring.colRank":        "RANG",
  "recurring.namePlaceholder": "Name",
  "recurring.durationTitle":  "Dauer (Tage / Stunden / Minuten)",
  "recurring.removeItem":     "Item entfernen",
  "recurring.titleItems":     "ABLAUFENDE ITEMS",
  "recurring.titleRoutine":   "TRAINING",
  "recurring.addItem":        "+ ITEM HINZUFÜGEN",
  "recurring.addRoutine":     "+ TRAINING HINZUFÜGEN",
  "recurring.noItems":        "noch keine ablaufenden Items",
  "recurring.noRoutine":      "noch keine Trainings-Items",
  "recurring.markMaxed":      "gemaxt — aus dem Training zurückziehen (umkehrbar)",
  "recurring.restoreMaxed":   "gemaxt — klicken, um ins Training zurückzuholen",
  "recurring.customTraining": "+ EIGENES TRAINING",
  "recurring.pickerFilter":   "Training filtern…",
  "recurring.alreadyAdded":   "bereits hinzugefügt",

  // ---- CooldownPicker ----
  "picker.startCooldown":     "Cooldown starten",
  "picker.hint":              "scrollen zum Ändern der Zeit",
  "picker.itemTitle":         "klicken zum Starten · scrollen zum Anpassen",

  // ---- CooldownStrip ----
  "cooldownStrip.pillHint":   "Linksklick neu starten · Rechtsklick löschen",

  // ---- ExpiringAccordion ----
  "expiring.empty":           "noch keine ablaufenden Items",
  "expiring.refresh":         "erneuern — neuen vollen Zyklus ab jetzt stempeln",
  "expiring.start":           "starten — vollen Zyklus ab jetzt stempeln",

  // ---- RoutineAccordion ----
  "routine.empty":            "noch keine Trainings-Items",
  "routine.sectionBooks":     "Skillbücher",
  "routine.sectionLanguages": "Sprachen",
  "routine.sectionChores":    "Hilfsmittel",
  "routine.readSuccessReady": "Lesen erfolgreich — Stufe erhöhen und 24h-Gate neu stempeln",
  "routine.readSuccessEarly": "jetzt gelesen (Cooldown übersprungen) — Stufe erhöhen und ab jetzt neu stempeln",
  "routine.readFailReady":    "Lesen fehlgeschlagen — Buch verbrannt, keine Stufenerhöhung; 24h-Gate neu stempeln",
  "routine.readFailEarly":    "jetzt gelesen (Cooldown übersprungen) aber fehlgeschlagen — Buch verbrannt, keine Stufenerhöhung; ab jetzt neu stempeln",
  "routine.markDoneReady":    "erledigt — vollen Zyklus ab jetzt neu stempeln",
  "routine.markDoneEarly":    "früh erledigt — ab jetzt neu stempeln (Wartezeit verfällt)",
  "routine.skipCooldown":     "Schriftrolle benutzen, um den Cooldown für ein frühes Lesen zu überspringen (Item benutzt)",

  // ---- RungCurtain ----
  "rung.triggerTitle":        "aktuelle Stufe festlegen",
  "rung.filterPlaceholder":   "Stufen filtern…",
  "rung.filterAriaLabel":     "Stufen filtern",
  "rung.noMatch":             "kein Treffer",

  // ---- CharacterSwitcher ----
  "char.activeCharacterTitle":  "aktiver Charakter",
  "char.frozenTitle":           "Eingefroren — abonniere erneut, um diesen Charakter zu nutzen",
  "char.editTitle":             "bearbeiten / klassifizieren",
  "char.editFrozenTitle":       "eingefroren — abonniere erneut zum Bearbeiten",
  "char.deleteTitle":           "löschen",
  "char.deleteFrozenTitle":     "eingefroren — abonniere erneut zum Verwalten",
  "char.deleteOnlyTitle":       "der einzige Charakter kann nicht gelöscht werden",
  "char.newCharacter":          "+ Neuer Charakter",
  "char.addWithPro":            "✦ Charaktere mit Pro hinzufügen",

  // ---- CharacterWizard ----
  "wizard.newCharacter":    "NEUER CHARAKTER",
  "wizard.editCharacter":   "CHARAKTER BEARBEITEN",
  "wizard.cancel":          "Abbrechen",
  "wizard.namePlaceholder": "Charaktername…",
  "wizard.nameAriaLabel":   "Charaktername",
  "wizard.back":            "← Zurück",
  "wizard.next":            "Weiter →",
  "wizard.save":            "Speichern",
  "wizard.create":          "Erstellen",

  // ---- TourCard ----
  "tour.welcomeTitle":   "WILLKOMMEN",
  "tour.welcomeBody":    "Diese Leiste schwebt über deinem Spiel — jedes Symbol darunter ist ein Werkzeug. Eine kurze Tour durch alle Bereiche folgt; überspringen geht jederzeit.",
  "tour.dockTitle":      "DIE LEISTE",
  "tour.dockBody":       "Die Leiste bleibt über dem Spielfenster. Zieh sie am Griff, wohin du willst; jedes Werkzeug öffnet sich direkt darunter.",
  "tour.characterTitle": "DEIN CHARAKTER",
  "tour.characterBody":  "Wen spielst du? Name, Reich, Klasse — Training stimmt sein Aufgaben-Menü genau darauf ab. Weitere Charaktere kommen später über den Chip links in der Leiste dazu.",
  "tour.skillsTitle":    "DUNGEONS",
  "tour.skillsBody":     "⚔ öffnet deine Dungeons: wähl den Boss, gegen den du kämpfst — jeder Skill wird zum ablaufenden Chip mit Tonsignalen in den letzten Sekunden, mitten im Kampf per globalem Hotkey zurücksetzbar.",
  "tour.cooldownsTitle": "COOLDOWNS",
  "tour.cooldownsBody":  "⏱ startet einmalige Countdowns auf einen festen Zeitpunkt — Dungeon-Wiedereintritt oder ein Spawn, auf den du wartest. Sie folgen der Uhr und überleben Neustarts.",
  "tour.itemsTitle":     "ABLAUFENDE ITEMS",
  "tour.itemsBody":      "⧗ behält im Blick, was abläuft — Pet, Kostüm, Mount. Jedes zeigt die Resttage; ↻ stempelt einen frischen Zyklus, wenn du fütterst oder erneuerst.",
  "tour.routineTitle":   "TRAINING",
  "tour.routineBody":    "✓ ist ein Menü wiederkehrender Aufgaben — Skillbuch-Lesen, Biologen-Abgaben. Du bist nicht im Rückstand: wähl, was zu deinem Charakter passt, und ✓ stempelt es aufs nächste Fenster.",
  "tour.settingsTitle":  "EINSTELLUNGEN",
  "tour.settingsBody":   "⚙ öffnet das Einstellungsfenster — Bosse, Hotkeys, Sounds, Sprache und Backups wohnen dort. Da müssen wir jetzt nicht rein.",
  "tour.doneTitle":      "FERTIG",
  "tour.doneBody":       "Das ist die Leiste. Du findest diese Tour jederzeit unter ⚙ → Führ mich herum. Gute Jagd!",
  "tour.next":           "Weiter →",
  "tour.back":           "← Zurück",
  "tour.finish":         "Verstanden",
  "tour.skip":           "✕ Tour überspringen",
  "tour.makeItYours":    "⚙ Pass es an →",

  // ---- SubscribeScreen ----
  // Short UI labels translated; long prose lede strings omitted (English fallback).
  "subscribe.title":         "DRAGONSAID PRO",
  "subscribe.planAriaLabel": "Abonnement-Plan",
  "subscribe.bestValue":     "BESTES ANGEBOT",
  "subscribe.planAnnual":    "Jährlich",
  "subscribe.planMonthly":   "Monatlich",
  "subscribe.startTrial":    "7-tägige kostenlose Testversion starten",
  "subscribe.done":          "Fertig",
  "subscribe.notNow":        "Nicht jetzt",
  "subscribe.resubscribe":   "Erneut abonnieren",
  "subscribe.subscribe":     "Abonnieren",
  "subscribe.orSubscribeNow": "oder jetzt abonnieren",
  "subscribe.error":         "Der Store konnte den Kauf nicht abschließen – es wurde nichts geändert. Versuch es gleich noch einmal.",

  // ---- UpgradeBanner ----
  "banner.trialLabel":   "✦ Pro-Testversion aktiv",
  "banner.trialCta":     "Pro behalten",
  "banner.lapsedLabel":  "✦ Pro pausiert — dein Stall ist eingefroren",
  "banner.lapsedCta":    "Erneut abonnieren",
  "banner.neverLabel":   "✦ Dragon's Aid Pro freischalten",
  "banner.neverCta":     "Upgraden",

  // ---- CapNudge ----
  "cap.seePro":    "Pro ansehen",
  "cap.dismiss":   "Schließen",

  // ---- SettingsApp ----
  "settings.title":           "EINSTELLUNGEN",
  "settings.resetToDefaults": "diesen Bereich auf Standardwerte zurücksetzen",
  "settings.resetConfirm":    "Diesen Bereich auf Standardwerte zurücksetzen? Deine anderen Bereiche bleiben unverändert.",
  "settings.close":           "schließen",
  "settings.tabDungeons":     "Dungeons",
  "settings.tabCooldowns":    "Cooldowns",
  "settings.tabItems":        "Items",
  "settings.tabRoutine":      "Training",
  "settings.tabLanguage":     "Sprache",
  "settings.addBoss":         "+ BOSS HINZUFÜGEN",
  "settings.closeTitle":      "Einstellungen schließen",
  "settings.explainDungeons":  "Dungeons — deine Bosse und ihre Skill-Chips: Namen, Dauern, Sounds und globale Hotkeys.",
  "settings.explainCooldowns": "Cooldowns — einmalige Dungeon-Respawns; stell hier die Dauer für jeden ein.",
  "settings.explainItems":     "Ablaufende Items — Pet, Kostüm, Mount; stell ein, wie lange jeder Zyklus läuft.",
  "settings.explainRoutine":   "Training — das Menü wiederkehrender Aufgaben; füge Einträge hinzu und stimm ihre Fenster ab.",
  "settings.showAround":       "FÜHR MICH HERUM",
  "settings.showAroundHint":   "Die kurze Tour durch die Leiste und ihre Werkzeuge erneut abspielen.",

  // ---- LocaleSettings ----
  "locale.title":  "SPRACHE",
  "locale.hint":   "Inhaltsnamen werden in der gewählten Sprache angezeigt. Selbst eingetragene Freitextnamen werden nie geändert.",
  "locale.filterPlaceholder": "Sprachen filtern…",
  "locale.filterAriaLabel":   "Sprachen filtern",

  // ---- BackupSection ----
  "backup.export":   "BACKUP EXPORTIEREN",
  "backup.import":   "BACKUP IMPORTIEREN",
  "backup.exported": "Backup exportiert.",
  "backup.imported": "Backup importiert.",
  "backup.invalid":  "Diese Datei ist kein gültiges Backup — nichts wurde geändert.",
};

// ---- Italian chrome table (#99 slice 1) ----
// Free-translated IT strings, informal "tu" register (Metin2 IT client convention). Unlike the DE
// partial, this is authored COMPLETE (the maintainer reads Italian) — every ChromeKey is present —
// but it stays typed `Partial<ChromeTable>` like the others, so the English fallback still covers
// any key removed later. Chrome is UI, FREE-translated; game terms live in contentCatalog.ts and are
// transcribed, never routed through here. Section comments mirror the EN table for review.
const IT_PARTIAL: Partial<ChromeTable> = {
  // ---- DockBar ----
  "dock.drag":            "trascina per spostare",
  "dock.skills":          "abilità",
  "dock.cooldowns":       "cooldown dungeon",
  "dock.expiring":        "oggetti in scadenza",
  "dock.routine":         "allenamento",
  "dock.settings":        "impostazioni",
  "dock.quit":            "esci da Dragon's Aid",

  // ---- TimerScreen ----
  "timer.noSkills":       "nessuna abilità — aggiungine in ⚙ impostazioni",
  "timer.back":           "torna ai dungeon",
  "timer.hintLeftClick":  "clic sinistro",
  "timer.hintStopStart":  "stop / avvio",
  "timer.hintRightClick": "clic destro",
  "timer.hintReset":      "azzera",

  // ---- BossSelect ----
  "bossSelect.title":     "SELEZIONA DUNGEON",

  // ---- SequenceScreen ----
  "sequence.back":                  "torna alla selezione boss",
  "sequence.switchToColumns":       "Passa a Colonne (Fase 2)",
  "sequence.switchToElements":      "Passa a Elementi (Fase 1)",
  "sequence.switchToColumnsTitle":  "passa a colonne (Fase 2)",
  "sequence.switchToElementsTitle": "passa a elementi (Fase 1)",
  "sequence.columnsLabel":          "Colonne",
  "sequence.elementsLabel":         "Elementi",
  "sequence.undo":                  "annulla",
  "sequence.clear":                 "svuota",
  "sequence.queenShift":            "Spostamento regina",
  "sequence.queenShiftTitle":       "regina: sposta l'ordine di una posizione (1·2·3·4 → 4·1·2·3)",
  "sequence.empty":                 "tocca sopra per registrare l'ordine — tocca un chip per spuntarlo",
  "sequence.chipTitle":             "tocca quando distrutto / aperto",
  "sequence.titleElements":         "TEMPLUM · ELEMENTI",
  "sequence.titleColumns":          "TEMPLUM · COLONNE",

  // ---- BossSettings ----
  "boss.bossNamePlaceholder": "nome boss",
  "boss.deleteBoss":          "elimina boss",
  "boss.colSkill":            "ABILITÀ",
  "boss.colSec":              "SEC",
  "boss.colSound":            "SUONO",
  "boss.colHotkey":           "TASTO",
  "boss.skillNamePlaceholder": "nome",
  "boss.durationTitle":       "durata (secondi)",
  "boss.soundTitle":          "suono riprodotto sugli avvisi di questa abilità",
  "boss.previewSound":        "ascolta questo suono",
  "boss.hotkeyTitle":         "tasto per azzerare questo timer — clicca, poi premi un tasto (Esc cancella)",
  "boss.removeSkill":         "rimuovi abilità",
  "boss.noSkills":            "ancora nessuna abilità",
  "boss.addSkill":            "+ AGGIUNGI ABILITÀ",

  // ---- CooldownSettings ----
  "cooldown.title":           "COOLDOWN",
  "cooldown.colName":         "NOME",
  "cooldown.colTag":          "TAG",
  "cooldown.colDuration":     "DURATA",
  "cooldown.namePlaceholder": "nome",
  "cooldown.tagPlaceholder":  "tag",
  "cooldown.tagTitle":        "etichetta breve mostrata nella barra (derivata dal nome; modificabile)",
  "cooldown.durationTitle":   "durata (ore / minuti)",
  "cooldown.removeCooldown":  "rimuovi cooldown",
  "cooldown.noCooldowns":     "ancora nessun cooldown",
  "cooldown.addCooldown":     "+ AGGIUNGI COOLDOWN",

  // ---- RecurringSettings ----
  "recurring.colName":        "NOME",
  "recurring.colDuration":    "DURATA",
  "recurring.colRank":        "GRADO",
  "recurring.namePlaceholder": "nome",
  "recurring.durationTitle":  "durata (giorni / ore / minuti)",
  "recurring.removeItem":     "rimuovi oggetto",
  "recurring.titleItems":     "OGGETTI IN SCADENZA",
  "recurring.titleRoutine":   "ALLENAMENTO",
  "recurring.addItem":        "+ AGGIUNGI OGGETTO",
  "recurring.addRoutine":     "+ AGGIUNGI ALLENAMENTO",
  "recurring.noItems":        "ancora nessun oggetto in scadenza",
  "recurring.noRoutine":      "ancora nessun allenamento",
  "recurring.markMaxed":      "al massimo — ritira dall'allenamento (reversibile)",
  "recurring.restoreMaxed":   "al massimo — clicca per ripristinare nell'allenamento",
  "recurring.customTraining": "+ ALLENAMENTO PERSONALIZZATO",
  "recurring.pickerFilter":   "filtra allenamenti…",
  "recurring.alreadyAdded":   "già aggiunto",

  // ---- CooldownPicker ----
  "picker.startCooldown":     "avvia un cooldown",
  "picker.hint":              "scorri per cambiare il tempo",
  "picker.itemTitle":         "clicca per avviare · scorri per regolare la durata",

  // ---- CooldownStrip ----
  "cooldownStrip.pillHint":   "clic sinistro riavvia · clic destro cancella",

  // ---- ExpiringAccordion ----
  "expiring.empty":           "ancora nessun oggetto in scadenza",
  "expiring.refresh":         "rinnova — ristampa un ciclo intero da adesso",
  "expiring.start":           "avvia — stampa un ciclo intero da adesso",

  // ---- RoutineAccordion ----
  "routine.empty":            "ancora nessun allenamento",
  "routine.sectionBooks":     "Libri delle abilità",
  "routine.sectionLanguages": "Lingue",
  "routine.sectionChores":    "Utilità",
  "routine.readSuccessReady": "lettura riuscita — avanza di grado e ristampa il gate di 24h",
  "routine.readSuccessEarly": "letto ora (cooldown saltato) — avanza di grado e ristampa da adesso",
  "routine.readFailReady":    "lettura fallita — libro bruciato, nessun avanzamento; ristampa il gate di 24h",
  "routine.readFailEarly":    "letto ora (cooldown saltato) ma fallito — libro bruciato, nessun avanzamento; ristampa da adesso",
  "routine.markDoneReady":    "segna come fatto — ristampa un ciclo intero da adesso",
  "routine.markDoneEarly":    "fatto in anticipo — ristampa da adesso (rinunci all'attesa)",
  "routine.skipCooldown":     "usa lo scorrimento per saltare il cooldown e leggere in anticipo (oggetto usato)",

  // ---- RungCurtain ----
  "rung.triggerTitle":        "imposta il grado attuale",
  "rung.filterPlaceholder":   "filtra gradi…",
  "rung.filterAriaLabel":     "filtra gradi",
  "rung.noMatch":             "nessun risultato",

  // ---- CharacterSwitcher ----
  "char.activeCharacterTitle":  "personaggio attivo",
  "char.frozenTitle":           "Congelato — riabbonati per usare questo personaggio",
  "char.editTitle":             "modifica / classifica",
  "char.editFrozenTitle":       "congelato — riabbonati per modificare",
  "char.deleteTitle":           "elimina",
  "char.deleteFrozenTitle":     "congelato — riabbonati per gestire",
  "char.deleteOnlyTitle":       "l'unico personaggio non può essere eliminato",
  "char.newCharacter":          "+ Nuovo personaggio",
  "char.addWithPro":            "✦ Aggiungi personaggi con Pro",

  // ---- CharacterWizard ----
  "wizard.newCharacter":    "NUOVO PERSONAGGIO",
  "wizard.editCharacter":   "MODIFICA PERSONAGGIO",
  "wizard.cancel":          "annulla",
  "wizard.namePlaceholder": "nome personaggio…",
  "wizard.nameAriaLabel":   "nome personaggio",
  "wizard.back":            "← Indietro",
  "wizard.next":            "Avanti →",
  "wizard.save":            "Salva",
  "wizard.create":          "Crea",

  // ---- TourCard ----
  "tour.welcomeTitle":   "BENVENUTO",
  "tour.welcomeBody":    "Questa barra galleggia sopra il tuo gioco — ogni simbolo qui sotto è uno strumento. Segue un breve tour di ogni sezione; puoi saltarlo quando vuoi.",
  "tour.dockTitle":      "LA BARRA",
  "tour.dockBody":       "La barra resta sopra la finestra di gioco. Trascinala dalla maniglia dove vuoi; ogni strumento si apre proprio sotto.",
  "tour.characterTitle": "IL TUO PERSONAGGIO",
  "tour.characterBody":  "Chi giochi? Nome, regno, classe — l'Allenamento adatta il suo menu di attività esattamente a quello. Altri personaggi possono aggiungersi dopo dal chip a sinistra della barra.",
  "tour.skillsTitle":    "DUNGEON",
  "tour.skillsBody":     "⚔ apre i tuoi Dungeon: scegli il boss che stai affrontando e ogni abilità diventa un chip che si scarica con segnali sonori negli ultimi secondi, azzerabile con tasti globali durante lo scontro.",
  "tour.cooldownsTitle": "COOLDOWN",
  "tour.cooldownsBody":  "⏱ avvia conti alla rovescia singoli verso un momento fisso — rientro nel dungeon, uno spawn che stai aspettando. Seguono l'orologio e sopravvivono ai riavvii.",
  "tour.itemsTitle":     "OGGETTI IN SCADENZA",
  "tour.itemsBody":      "⧗ tiene d'occhio ciò che scade — pet, costume, cavalcatura. Ognuno mostra i giorni rimasti; ↻ ristampa un ciclo nuovo quando nutri o rinnovi.",
  "tour.routineTitle":   "ALLENAMENTO",
  "tour.routineBody":    "✓ è un menu di attività ricorrenti — letture di libri abilità, consegne al Biologo. Non sei indietro: scegli ciò che si adatta al tuo personaggio, e ✓ lo ristampa alla sua prossima finestra.",
  "tour.settingsTitle":  "IMPOSTAZIONI",
  "tour.settingsBody":   "⚙ apre la finestra delle impostazioni — boss, tasti, suoni, lingua e backup stanno lì. Non serve entrarci ora.",
  "tour.doneTitle":      "TUTTO PRONTO",
  "tour.doneBody":       "Questa è la barra. Ritrovi questo tour in ⚙ → Fammi fare un giro. Buona caccia!",
  "tour.next":           "Avanti →",
  "tour.back":           "← Indietro",
  "tour.finish":         "Capito",
  "tour.skip":           "✕ Salta il tour",
  "tour.makeItYours":    "⚙ Personalizzala →",

  // ---- SubscribeScreen ----
  "subscribe.title":                "DRAGONSAID PRO",
  "subscribe.planAriaLabel":        "Piano di abbonamento",
  "subscribe.bestValue":            "MIGLIOR PREZZO",
  "subscribe.planAnnual":           "Annuale",
  "subscribe.planMonthly":          "Mensile",
  "subscribe.startTrial":           "Inizia la prova gratuita di 7 giorni",
  "subscribe.done":                 "Fatto",
  "subscribe.notNow":               "Non ora",
  "subscribe.ledeTrial":            "Stai provando Pro gratis. Confermalo per mantenere la tua scuderia quando la prova finisce.",
  "subscribe.ledeLapsed":           "Bentornato. Riabbonati per scongelare subito la tua scuderia — non si è perso nulla.",
  "subscribe.ledeSubscribed":       "Sei Pro. Grazie per far crescere l'app.",
  "subscribe.ledeDefault":          "L'app Pro mantenuta e in crescita — conoscenza dei dungeon curata, per tutta la tua scuderia.",
  "subscribe.unlock1":              "Sequenze di dungeon predefinite — Templum Serpens e altre",
  "subscribe.unlock2":              "Tutta la tua scuderia — profili personaggio illimitati",
  "subscribe.unlock3":              "Catalogo abilità compilato automaticamente per classe e regno",
  "subscribe.unlock4":              "Scale per abilità — conteggio libri rimanenti M1→G1",
  "subscribe.unlock5":              "Ogni limite rimosso — boss, promemoria, personaggi",
  "subscribe.resubscribe":          "Riabbonati",
  "subscribe.subscribe":            "Abbonati",
  "subscribe.orSubscribeNow":       "oppure abbonati ora",
  "subscribe.error":                "Lo Store non ha potuto completare l'acquisto — non è stato modificato nulla. Riprova tra un momento.",

  // ---- UpgradeBanner ----
  "banner.trialLabel":          "✦ Prova Pro attiva",
  "banner.trialCta":            "Mantieni Pro",
  "banner.lapsedLabel":         "✦ Pro in pausa — la tua scuderia è congelata",
  "banner.lapsedCta":           "Riabbonati",
  "banner.neverLabel":          "✦ Sblocca Dragon's Aid Pro",
  "banner.neverCta":            "Aggiorna",

  // ---- CapNudge ----
  "cap.addBoss":        "Lite include 1 boss personalizzato. Pro rimuove ogni limite — crea tutte le sequenze di boss che vuoi.",
  "cap.addCharacter":   "Lite è un singolo personaggio. Pro sblocca tutta la tua scuderia — profili illimitati.",
  "cap.addReminder":    "Lite include 3 promemoria. Pro rimuove il limite così puoi tracciare ogni attività.",
  "cap.seePro":         "Scopri Pro",
  "cap.dismiss":        "Ignora",

  // ---- SettingsApp ----
  "settings.title":             "IMPOSTAZIONI",
  "settings.resetToDefaults":   "ripristina questa sezione ai valori predefiniti",
  "settings.resetConfirm":      "Ripristinare questa sezione ai valori predefiniti? Le altre sezioni non cambieranno.",
  "settings.close":             "chiudi",
  "settings.tabDungeons":       "Dungeon",
  "settings.tabCooldowns":      "Cooldown",
  "settings.tabItems":          "Oggetti",
  "settings.tabRoutine":        "Allenamento",
  "settings.tabLanguage":       "Lingua",
  "settings.addBoss":           "+ AGGIUNGI BOSS",
  "settings.closeTitle":        "chiudi impostazioni",
  "settings.explainDungeons":   "Dungeon — i tuoi boss e i loro chip abilità: nomi, durate, suoni e tasti globali.",
  "settings.explainCooldowns":  "Cooldown — respawn singoli dei dungeon; imposta qui la durata di ciascuno.",
  "settings.explainItems":      "Oggetti in scadenza — pet, costume, cavalcatura; imposta quanto dura ogni ciclo.",
  "settings.explainRoutine":    "Allenamento — il menu delle attività ricorrenti; aggiungi voci e regola la finestra di ciascuna.",
  "settings.showAround":        "FAMMI FARE UN GIRO",
  "settings.showAroundHint":    "Riproduci il breve tour della barra e dei suoi strumenti.",

  // ---- LocaleSettings ----
  "locale.title":   "LINGUA",
  "locale.hint":    "I nomi dei contenuti sono mostrati nella lingua selezionata. I nomi liberi che hai scritto tu non vengono mai cambiati.",
  "locale.filterPlaceholder": "filtra lingue…",
  "locale.filterAriaLabel":   "filtra lingue",

  // ---- BackupSection ----
  "backup.export":    "ESPORTA BACKUP",
  "backup.import":    "IMPORTA BACKUP",
  "backup.hint":      "Una copia portabile di tutti i tuoi dungeon, cooldown, personaggi e allenamenti. Importare un backup Pro in Lite mantiene tutto — ciò che supera i limiti resta congelato finché non ti riabboni.",
  "backup.exported":  "Backup esportato.",
  "backup.imported":  "Backup importato.",
  "backup.invalid":   "Questo file non è un backup valido — non è stato modificato nulla.",
};

/**
 * Per-locale tables: `en` is complete; every other locale is `Partial` with English fallback.
 * Keyed by `Locale` (not `string`) so adding a locale to the union without a chrome table — or
 * typo-ing its key here — is a compile error, matching the exhaustiveness `contentCatalog.ts`
 * already gets from its own `Record<Locale, …>` TABLES.
 */
const TABLES: Record<Locale, Partial<ChromeTable>> & { en: ChromeTable } = {
  en: EN,
  de: DE_PARTIAL,
  it: IT_PARTIAL,
};

/**
 * Resolve a chrome key against an arbitrary set of locale tables, falling back to English on
 * a missing key and to the raw key only as a last-resort defensive measure (unreachable for
 * any key present in the English table, which is every `ChromeKey`). Pure: exported so tests
 * can drive the fallback path with stub tables before a second locale ships.
 */
export function resolveChrome(tables: Record<string, Partial<Record<string, string>>>, key: string, locale: string): string {
  return tables[locale]?.[key] ?? tables["en"]?.[key] ?? key;
}

/**
 * Resolve a UI chrome string in `locale`. Falls back to English when the locale lacks the key
 * (so a partially-authored locale never renders blank — `de` deliberately omits the long prose
 * strings). The signature is intentionally two-arg (no default) so a new call site can't
 * silently un-localize.
 *
 * For game content (boss/ability/item names) use `displayName(catalogKey, locale)` in
 * `contentCatalog.ts` — these are separate concerns and must NOT share a table.
 */
export function t(key: ChromeKey, locale: Locale): string {
  return resolveChrome(TABLES, key, locale);
}
