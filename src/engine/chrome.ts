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
// ---- Spanish chrome table (#99) ----
// Free-translated UI strings (informal register). 171 keys supplied; the rest fall back to
// English (same partial pattern as DE). Best-effort, pending a native Spanish review.
const ES_PARTIAL: Partial<ChromeTable> = {
  // ---- DockBar ----
  "dock.drag": "arrastra para mover",
  "dock.skills": "habilidades",
  "dock.cooldowns": "cooldown dungeon",
  "dock.expiring": "objetos caducados",
  "dock.routine": "entrenamiento",
  "dock.settings": "ajustes",
  "dock.quit": "salir de Dragon's Aid",

  // ---- TimerScreen ----
  "timer.noSkills": "sin habilidades — añade algunas en ⚙ ajustes",
  "timer.back": "volver a mazmorras",
  "timer.hintLeftClick": "clic izquierdo",
  "timer.hintStopStart": "parar / iniciar",
  "timer.hintRightClick": "clic derecho",
  "timer.hintReset": "reiniciar",

  // ---- BossSelect ----
  "bossSelect.title": "SELECCIONA MAZMORRA",

  // ---- SequenceScreen ----
  "sequence.back": "volver a selección de boss",
  "sequence.switchToColumns": "Cambiar a Columnas (Fase 2)",
  "sequence.switchToElements": "Cambiar a Elementos (Fase 1)",
  "sequence.switchToColumnsTitle": "cambiar a columnas (Fase 2)",
  "sequence.switchToElementsTitle": "cambiar a elementos (Fase 1)",
  "sequence.columnsLabel": "Columnas",
  "sequence.elementsLabel": "Elementos",
  "sequence.undo": "deshacer último",
  "sequence.clear": "limpiar",
  "sequence.queenShift": "Turno de reina",
  "sequence.queenShiftTitle": "reina: desplaza el orden una posición (1·2·3·4 → 4·1·2·3)",
  "sequence.empty": "toca arriba para registrar el orden — toca un chip para marcarlo",
  "sequence.chipTitle": "toca cuando esté destruido / abierto",
  "sequence.titleElements": "TEMPLUM · ELEMENTOS",
  "sequence.titleColumns": "TEMPLUM · COLUMNAS",

  // ---- BossSettings ----
  "boss.bossNamePlaceholder": "nombre del boss",
  "boss.deleteBoss": "eliminar boss",
  "boss.colSkill": "HABILIDAD",
  "boss.colSec": "SEG",
  "boss.colSound": "SONIDO",
  "boss.colHotkey": "TECLA",
  "boss.skillNamePlaceholder": "nombre",
  "boss.durationTitle": "duración (segundos)",
  "boss.soundTitle": "sonido reproducido en los avisos de esta habilidad",
  "boss.previewSound": "previsualizar este sonido",
  "boss.hotkeyTitle": "tecla para reiniciar este temporizador — haz clic y luego pulsa una tecla (Esc para borrar)",
  "boss.removeSkill": "eliminar habilidad",
  "boss.noSkills": "todavía sin habilidades",
  "boss.addSkill": "+ AÑADIR HABILIDAD",

  // ---- CooldownSettings ----
  "cooldown.title": "COOLDOWNS",
  "cooldown.colName": "NOMBRE",
  "cooldown.colTag": "TAG",
  "cooldown.colDuration": "DURACIÓN",
  "cooldown.namePlaceholder": "nombre",
  "cooldown.tagPlaceholder": "tag",
  "cooldown.tagTitle": "etiqueta corta mostrada en la barra (derivada del nombre; editable)",
  "cooldown.durationTitle": "duración (horas / minutos)",
  "cooldown.removeCooldown": "eliminar cooldown",
  "cooldown.noCooldowns": "todavía sin cooldowns",
  "cooldown.addCooldown": "+ AÑADIR COOLDOWN",

  // ---- RecurringSettings ----
  "recurring.colName": "NOMBRE",
  "recurring.colDuration": "DURACIÓN",
  "recurring.colRank": "RANGO",
  "recurring.namePlaceholder": "nombre",
  "recurring.durationTitle": "duración (días / horas / minutos)",
  "recurring.removeItem": "eliminar objeto",
  "recurring.titleItems": "OBJETOS CADUCADOS",
  "recurring.titleRoutine": "ENTRENAMIENTO",
  "recurring.addItem": "+ AÑADIR OBJETO",
  "recurring.addRoutine": "+ AÑADIR ENTRENAMIENTO",
  "recurring.noItems": "todavía sin objetos caducados",
  "recurring.noRoutine": "todavía sin entrenamientos",
  "recurring.markMaxed": "al máximo — retirar del entrenamiento (reversible)",
  "recurring.restoreMaxed": "al máximo — haz clic para restaurar en el entrenamiento",
  "recurring.customTraining": "+ ENTRENAMIENTO PERSONALIZADO",
  "recurring.pickerFilter": "filtrar entrenamientos…",
  "recurring.alreadyAdded": "ya añadido",

  // ---- CooldownPicker ----
  "picker.startCooldown": "iniciar un cooldown",
  "picker.hint": "desplaza para cambiar el tiempo",
  "picker.itemTitle": "haz clic para iniciar · desplaza para ajustar la duración",

  // ---- CooldownStrip ----
  "cooldownStrip.pillHint": "clic izquierdo reinicia · clic derecho borra",

  // ---- ExpiringAccordion ----
  "expiring.empty": "todavía sin objetos caducados",
  "expiring.refresh": "renovar — restampar un ciclo completo desde ahora",
  "expiring.start": "iniciar — estampar un ciclo completo desde ahora",

  // ---- RoutineAccordion ----
  "routine.empty": "todavía sin entrenamientos",
  "routine.sectionBooks": "Libros de habilidades",
  "routine.sectionLanguages": "Idiomas",
  "routine.sectionChores": "Utilidades",
  "routine.readSuccessReady": "lectura exitosa — avanza un peldaño y restampa la ventana de 24h",
  "routine.readSuccessEarly": "leído ahora (cooldown omitido) — avanza un peldaño y restampa desde ahora",
  "routine.readFailReady": "lectura fallida — libro quemado, sin avance; restampa la ventana de 24h",
  "routine.readFailEarly": "leído ahora (cooldown omitido) pero fallido — libro quemado, sin avance; restampa desde ahora",
  "routine.markDoneReady": "marcar como hecho — restampar un ciclo completo desde ahora",
  "routine.markDoneEarly": "hecho antes — restampar desde ahora (renuncias a la espera)",
  "routine.skipCooldown": "usa el scroll para omitir el cooldown y leer antes (objeto usado)",

  // ---- RungCurtain ----
  "rung.triggerTitle": "establecer peldaño actual",
  "rung.filterPlaceholder": "filtrar peldaños…",
  "rung.filterAriaLabel": "filtrar peldaños",
  "rung.noMatch": "sin resultados",

  // ---- CharacterSwitcher ----
  "char.activeCharacterTitle": "personaje activo",
  "char.frozenTitle": "Congelado — renueva la suscripción para usar este personaje",
  "char.editTitle": "editar / clasificar",
  "char.editFrozenTitle": "congelado — renueva la suscripción para editar",
  "char.deleteTitle": "eliminar",
  "char.deleteFrozenTitle": "congelado — renueva la suscripción para gestionar",
  "char.deleteOnlyTitle": "el único personaje no se puede eliminar",
  "char.newCharacter": "+ Nuevo personaje",
  "char.addWithPro": "✦ Añade personajes con Pro",

  // ---- CharacterWizard ----
  "wizard.newCharacter": "NUEVO PERSONAJE",
  "wizard.editCharacter": "EDITAR PERSONAJE",
  "wizard.cancel": "cancelar",
  "wizard.namePlaceholder": "nombre del personaje…",
  "wizard.nameAriaLabel": "nombre del personaje",
  "wizard.back": "← Atrás",
  "wizard.next": "Siguiente →",
  "wizard.save": "Guardar",
  "wizard.create": "Crear",

  // ---- TourCard ----
  "tour.welcomeTitle": "BIENVENIDO",
  "tour.dockTitle": "LA BARRA",
  "tour.characterTitle": "TU PERSONAJE",
  "tour.skillsTitle": "MAZMORRAS",
  "tour.cooldownsTitle": "COOLDOWNS",
  "tour.itemsTitle": "OBJETOS CADUCADOS",
  "tour.routineTitle": "ENTRENAMIENTO",
  "tour.settingsTitle": "AJUSTES",
  "tour.doneTitle": "TODO LISTO",
  "tour.next": "Siguiente →",
  "tour.back": "← Atrás",
  "tour.finish": "Entendido",
  "tour.skip": "✕ Saltar tour",
  "tour.makeItYours": "⚙ Personalízala →",

  // ---- SubscribeScreen ----
  "subscribe.title": "DRAGONSAID PRO",
  "subscribe.planAriaLabel": "Plan de suscripción",
  "subscribe.bestValue": "MEJOR PRECIO",
  "subscribe.planAnnual": "Anual",
  "subscribe.planMonthly": "Mensual",
  "subscribe.startTrial": "Empieza la prueba gratuita de 7 días",
  "subscribe.done": "Hecho",
  "subscribe.notNow": "Ahora no",
  "subscribe.resubscribe": "Volver a suscribirse",
  "subscribe.subscribe": "Suscribirse",
  "subscribe.orSubscribeNow": "o suscríbete ahora",
  "subscribe.error": "La Tienda no ha podido completar la compra — no se ha modificado nada. Inténtalo de nuevo en un momento.",

  // ---- UpgradeBanner ----
  "banner.trialLabel": "✦ Prueba Pro activa",
  "banner.trialCta": "Mantener Pro",
  "banner.lapsedLabel": "✦ Pro en pausa — tu cuadra está congelada",
  "banner.lapsedCta": "Volver a suscribirse",
  "banner.neverLabel": "✦ Desbloquea Dragon's Aid Pro",
  "banner.neverCta": "Mejorar",

  // ---- CapNudge ----
  "cap.seePro": "Ver Pro",
  "cap.dismiss": "Descartar",

  // ---- SettingsApp ----
  "settings.title": "AJUSTES",
  "settings.resetToDefaults": "restablecer esta sección a los valores predeterminados",
  "settings.resetConfirm": "¿Restablecer esta sección a sus valores predeterminados? Las demás secciones no cambiarán.",
  "settings.close": "cerrar",
  "settings.tabDungeons": "Mazmorras",
  "settings.tabCooldowns": "Cooldowns",
  "settings.tabItems": "Objetos",
  "settings.tabRoutine": "Entrenamiento",
  "settings.tabLanguage": "Idioma",
  "settings.addBoss": "+ AÑADIR BOSS",
  "settings.closeTitle": "cerrar ajustes",
  "settings.explainDungeons": "Mazmorras — tus bosses y sus chips de habilidad: nombres, duraciones, sonidos y teclas globales.",
  "settings.explainCooldowns": "Cooldowns — respawns únicos de mazmorras; establece aquí la duración de cada uno.",
  "settings.explainItems": "Objetos caducados — pet, disfraz, montura; establece cuánto dura cada ciclo.",
  "settings.explainRoutine": "Entrenamiento — el menú de tareas recurrentes; añade entradas y ajusta la ventana de cada una.",
  "settings.showAround": "ENSÉÑAME A USARLA",
  "settings.showAroundHint": "Reproduce el tour rápido de la barra y sus herramientas.",

  // ---- LocaleSettings ----
  "locale.title": "IDIOMA",
  "locale.hint": "Los nombres de contenido se muestran en el idioma seleccionado. Los nombres libres que escribiste tú nunca se cambian.",
  "locale.filterPlaceholder": "filtrar idiomas…",
  "locale.filterAriaLabel": "filtrar idiomas",

  // ---- BackupSection ----
  "backup.export": "EXPORTAR COPIA DE SEGURIDAD",
  "backup.import": "IMPORTAR COPIA DE SEGURIDAD",
  "backup.exported": "Copia de seguridad exportada.",
  "backup.imported": "Copia de seguridad importada.",
  "backup.invalid": "Este archivo no es una copia de seguridad válida — no se ha modificado nada.",
};

// ---- French chrome table (#99) ----
// Free-translated UI strings (informal register). 171 keys supplied; the rest fall back to
// English (same partial pattern as DE). Best-effort, pending a native French review.
const FR_PARTIAL: Partial<ChromeTable> = {
  // ---- DockBar ----
  "dock.drag": "glisse pour déplacer",
  "dock.skills": "compétences",
  "dock.cooldowns": "cooldown donjon",
  "dock.expiring": "objets en expiration",
  "dock.routine": "entraînement",
  "dock.settings": "paramètres",
  "dock.quit": "quitter Dragon's Aid",

  // ---- TimerScreen ----
  "timer.noSkills": "aucune compétence — ajoutes-en dans ⚙ paramètres",
  "timer.back": "retour aux donjons",
  "timer.hintLeftClick": "clic gauche",
  "timer.hintStopStart": "stop / démarrer",
  "timer.hintRightClick": "clic droit",
  "timer.hintReset": "réinitialiser",

  // ---- BossSelect ----
  "bossSelect.title": "SÉLECTIONNER DONJON",

  // ---- SequenceScreen ----
  "sequence.back": "retour à la sélection boss",
  "sequence.switchToColumns": "Passer aux Colonnes (Phase 2)",
  "sequence.switchToElements": "Passer aux Éléments (Phase 1)",
  "sequence.switchToColumnsTitle": "passer aux colonnes (Phase 2)",
  "sequence.switchToElementsTitle": "passer aux éléments (Phase 1)",
  "sequence.columnsLabel": "Colonnes",
  "sequence.elementsLabel": "Éléments",
  "sequence.undo": "annuler",
  "sequence.clear": "effacer",
  "sequence.queenShift": "Décalage reine",
  "sequence.queenShiftTitle": "reine : décale l'ordre d'une position (1·2·3·4 → 4·1·2·3)",
  "sequence.empty": "touche ci-dessus pour enregistrer l'ordre — touche un chip pour le cocher",
  "sequence.chipTitle": "touche quand détruit / ouvert",
  "sequence.titleElements": "TEMPLUM · ÉLÉMENTS",
  "sequence.titleColumns": "TEMPLUM · COLONNES",

  // ---- BossSettings ----
  "boss.bossNamePlaceholder": "nom du boss",
  "boss.deleteBoss": "supprimer boss",
  "boss.colSkill": "COMPÉTENCE",
  "boss.colSec": "SEC",
  "boss.colSound": "SON",
  "boss.colHotkey": "RACCOURCI",
  "boss.skillNamePlaceholder": "nom",
  "boss.durationTitle": "durée (secondes)",
  "boss.soundTitle": "son joué lors des alertes de cette compétence",
  "boss.previewSound": "écouter ce son",
  "boss.hotkeyTitle": "raccourci pour réinitialiser ce timer — clique, puis appuie sur une touche (Échap efface)",
  "boss.removeSkill": "supprimer compétence",
  "boss.noSkills": "aucune compétence pour l'instant",
  "boss.addSkill": "+ AJOUTER COMPÉTENCE",

  // ---- CooldownSettings ----
  "cooldown.title": "COOLDOWNS",
  "cooldown.colName": "NOM",
  "cooldown.colTag": "TAG",
  "cooldown.colDuration": "DURÉE",
  "cooldown.namePlaceholder": "nom",
  "cooldown.tagPlaceholder": "tag",
  "cooldown.tagTitle": "étiquette courte affichée dans la barre (dérivée du nom ; modifiable)",
  "cooldown.durationTitle": "durée (heures / minutes)",
  "cooldown.removeCooldown": "supprimer cooldown",
  "cooldown.noCooldowns": "aucun cooldown pour l'instant",
  "cooldown.addCooldown": "+ AJOUTER COOLDOWN",

  // ---- RecurringSettings ----
  "recurring.colName": "NOM",
  "recurring.colDuration": "DURÉE",
  "recurring.colRank": "RANG",
  "recurring.namePlaceholder": "nom",
  "recurring.durationTitle": "durée (jours / heures / minutes)",
  "recurring.removeItem": "supprimer objet",
  "recurring.titleItems": "OBJETS EN EXPIRATION",
  "recurring.titleRoutine": "ENTRAÎNEMENT",
  "recurring.addItem": "+ AJOUTER OBJET",
  "recurring.addRoutine": "+ AJOUTER ENTRAÎNEMENT",
  "recurring.noItems": "aucun objet en expiration pour l'instant",
  "recurring.noRoutine": "aucun entraînement pour l'instant",
  "recurring.markMaxed": "au maximum — retirer de l'entraînement (réversible)",
  "recurring.restoreMaxed": "au maximum — clique pour remettre dans l'entraînement",
  "recurring.customTraining": "+ ENTRAÎNEMENT PERSONNALISÉ",
  "recurring.pickerFilter": "filtrer entraînements…",
  "recurring.alreadyAdded": "déjà ajouté",

  // ---- CooldownPicker ----
  "picker.startCooldown": "démarrer un cooldown",
  "picker.hint": "fais défiler pour changer le temps",
  "picker.itemTitle": "clique pour démarrer · fais défiler pour régler la durée",

  // ---- CooldownStrip ----
  "cooldownStrip.pillHint": "clic gauche redémarre · clic droit efface",

  // ---- ExpiringAccordion ----
  "expiring.empty": "aucun objet en expiration pour l'instant",
  "expiring.refresh": "renouveler — reposer un cycle complet à partir de maintenant",
  "expiring.start": "démarrer — poser un cycle complet à partir de maintenant",

  // ---- RoutineAccordion ----
  "routine.empty": "aucun entraînement pour l'instant",
  "routine.sectionBooks": "Livres de compétences",
  "routine.sectionLanguages": "Langues",
  "routine.sectionChores": "Utilitaires",
  "routine.readSuccessReady": "lecture réussie — monte d'un échelon et repose la fenêtre de 24h",
  "routine.readSuccessEarly": "lu maintenant (cooldown sauté) — monte d'un échelon et repose à partir de maintenant",
  "routine.readFailReady": "lecture ratée — livre brûlé, aucune progression ; repose la fenêtre de 24h",
  "routine.readFailEarly": "lu maintenant (cooldown sauté) mais raté — livre brûlé, aucune progression ; repose à partir de maintenant",
  "routine.markDoneReady": "marquer comme fait — repose un cycle complet à partir de maintenant",
  "routine.markDoneEarly": "fait en avance — repose à partir de maintenant (renonce à l'attente)",
  "routine.skipCooldown": "utilise le défilement pour sauter le cooldown et lire en avance (objet utilisé)",

  // ---- RungCurtain ----
  "rung.triggerTitle": "définir l'échelon actuel",
  "rung.filterPlaceholder": "filtrer échelons…",
  "rung.filterAriaLabel": "filtrer échelons",
  "rung.noMatch": "aucun résultat",

  // ---- CharacterSwitcher ----
  "char.activeCharacterTitle": "personnage actif",
  "char.frozenTitle": "Gelé — réabonne-toi pour utiliser ce personnage",
  "char.editTitle": "modifier / classer",
  "char.editFrozenTitle": "gelé — réabonne-toi pour modifier",
  "char.deleteTitle": "supprimer",
  "char.deleteFrozenTitle": "gelé — réabonne-toi pour gérer",
  "char.deleteOnlyTitle": "le seul personnage ne peut pas être supprimé",
  "char.newCharacter": "+ Nouveau personnage",
  "char.addWithPro": "✦ Ajouter des personnages avec Pro",

  // ---- CharacterWizard ----
  "wizard.newCharacter": "NOUVEAU PERSONNAGE",
  "wizard.editCharacter": "MODIFIER LE PERSONNAGE",
  "wizard.cancel": "annuler",
  "wizard.namePlaceholder": "nom du personnage…",
  "wizard.nameAriaLabel": "nom du personnage",
  "wizard.back": "← Retour",
  "wizard.next": "Suivant →",
  "wizard.save": "Enregistrer",
  "wizard.create": "Créer",

  // ---- TourCard ----
  "tour.welcomeTitle": "BIENVENUE",
  "tour.dockTitle": "LA BARRE",
  "tour.characterTitle": "TON PERSONNAGE",
  "tour.skillsTitle": "DONJONS",
  "tour.cooldownsTitle": "COOLDOWNS",
  "tour.itemsTitle": "OBJETS EN EXPIRATION",
  "tour.routineTitle": "ENTRAÎNEMENT",
  "tour.settingsTitle": "PARAMÈTRES",
  "tour.doneTitle": "TOUT EST PRÊT",
  "tour.next": "Suivant →",
  "tour.back": "← Retour",
  "tour.finish": "Compris",
  "tour.skip": "✕ Passer le tour",
  "tour.makeItYours": "⚙ Personnalise-la →",

  // ---- SubscribeScreen ----
  "subscribe.title": "DRAGONSAID PRO",
  "subscribe.planAriaLabel": "Formule d'abonnement",
  "subscribe.bestValue": "MEILLEUR RAPPORT",
  "subscribe.planAnnual": "Annuel",
  "subscribe.planMonthly": "Mensuel",
  "subscribe.startTrial": "Commencer l'essai gratuit de 7 jours",
  "subscribe.done": "Fait",
  "subscribe.notNow": "Pas maintenant",
  "subscribe.resubscribe": "Se réabonner",
  "subscribe.subscribe": "S'abonner",
  "subscribe.orSubscribeNow": "ou abonne-toi maintenant",
  "subscribe.error": "Le Store n'a pas pu finaliser l'achat — rien n'a été modifié. Réessaie dans un moment.",

  // ---- UpgradeBanner ----
  "banner.trialLabel": "✦ Essai Pro actif",
  "banner.trialCta": "Conserver Pro",
  "banner.lapsedLabel": "✦ Pro en pause — ta collection est gelée",
  "banner.lapsedCta": "Se réabonner",
  "banner.neverLabel": "✦ Débloquer Dragon's Aid Pro",
  "banner.neverCta": "Mettre à niveau",

  // ---- CapNudge ----
  "cap.seePro": "Voir Pro",
  "cap.dismiss": "Ignorer",

  // ---- SettingsApp ----
  "settings.title": "PARAMÈTRES",
  "settings.resetToDefaults": "réinitialiser cette section aux valeurs par défaut",
  "settings.resetConfirm": "Réinitialiser cette section à ses valeurs par défaut ? Les autres sections ne changeront pas.",
  "settings.close": "fermer",
  "settings.tabDungeons": "Donjons",
  "settings.tabCooldowns": "Cooldowns",
  "settings.tabItems": "Objets",
  "settings.tabRoutine": "Entraînement",
  "settings.tabLanguage": "Langue",
  "settings.addBoss": "+ AJOUTER BOSS",
  "settings.closeTitle": "fermer les paramètres",
  "settings.explainDungeons": "Donjons — tes boss et leurs chips de compétence : noms, durées, sons et raccourcis globaux.",
  "settings.explainCooldowns": "Cooldowns — respawns uniques des donjons ; règle ici la durée de chacun.",
  "settings.explainItems": "Objets en expiration — pet, costume, monture ; règle la durée de chaque cycle.",
  "settings.explainRoutine": "Entraînement — le menu des tâches récurrentes ; ajoute des entrées et règle la fenêtre de chacune.",
  "settings.showAround": "FAIS-MOI VISITER",
  "settings.showAroundHint": "Rejouer le tour rapide de la barre et de ses outils.",

  // ---- LocaleSettings ----
  "locale.title": "LANGUE",
  "locale.hint": "Les noms de contenu sont affichés dans la langue sélectionnée. Les noms libres que tu as saisis toi-même ne sont jamais modifiés.",
  "locale.filterPlaceholder": "filtrer les langues…",
  "locale.filterAriaLabel": "filtrer les langues",

  // ---- BackupSection ----
  "backup.export": "EXPORTER LA SAUVEGARDE",
  "backup.import": "IMPORTER LA SAUVEGARDE",
  "backup.exported": "Sauvegarde exportée.",
  "backup.imported": "Sauvegarde importée.",
  "backup.invalid": "Ce fichier n'est pas une sauvegarde valide — rien n'a été modifié.",
};

// ---- Polish chrome table (#99) ----
// Free-translated UI strings (informal register). 171 keys supplied; the rest fall back to
// English (same partial pattern as DE). Best-effort, pending a native Polish review.
const PL_PARTIAL: Partial<ChromeTable> = {
  // ---- DockBar ----
  "dock.drag": "przeciągnij, aby przenieść",
  "dock.skills": "umiejętności",
  "dock.cooldowns": "cooldowny lochów",
  "dock.expiring": "wygasające przedmioty",
  "dock.routine": "trening",
  "dock.settings": "ustawienia",
  "dock.quit": "wyjdź z Dragon's Aid",

  // ---- TimerScreen ----
  "timer.noSkills": "brak umiejętności — dodaj je w ⚙ ustawieniach",
  "timer.back": "wróć do lochów",
  "timer.hintLeftClick": "lewy przycisk myszy",
  "timer.hintStopStart": "stop / start",
  "timer.hintRightClick": "prawy przycisk myszy",
  "timer.hintReset": "resetuj",

  // ---- BossSelect ----
  "bossSelect.title": "WYBIERZ LOCH",

  // ---- SequenceScreen ----
  "sequence.back": "wróć do wyboru bossa",
  "sequence.switchToColumns": "Przełącz na Kolumny (Faza 2)",
  "sequence.switchToElements": "Przełącz na Żywioły (Faza 1)",
  "sequence.switchToColumnsTitle": "przełącz na kolumny (Faza 2)",
  "sequence.switchToElementsTitle": "przełącz na żywioły (Faza 1)",
  "sequence.columnsLabel": "Kolumny",
  "sequence.elementsLabel": "Żywioły",
  "sequence.undo": "cofnij ostatnie",
  "sequence.clear": "wyczyść",
  "sequence.queenShift": "Przesunięcie królowej",
  "sequence.queenShiftTitle": "królowa: przesuń kolejność o jedno miejsce (1·2·3·4 → 4·1·2·3)",
  "sequence.empty": "kliknij powyżej, aby zapisać kolejność — kliknij chip, aby go odhaczyć",
  "sequence.chipTitle": "kliknij, gdy zniszczony / otwarty",
  "sequence.titleElements": "TEMPLUM · ŻYWIOŁY",
  "sequence.titleColumns": "TEMPLUM · KOLUMNY",

  // ---- BossSettings ----
  "boss.bossNamePlaceholder": "nazwa bossa",
  "boss.deleteBoss": "usuń bossa",
  "boss.colSkill": "UMIEJĘTNOŚĆ",
  "boss.colSec": "SEK",
  "boss.colSound": "DŹWIĘK",
  "boss.colHotkey": "SKRÓT",
  "boss.skillNamePlaceholder": "nazwa",
  "boss.durationTitle": "czas trwania (sekundy)",
  "boss.soundTitle": "dźwięk odtwarzany przy podpowiedziach tej umiejętności",
  "boss.previewSound": "odsłuchaj dźwięk",
  "boss.hotkeyTitle": "skrót do resetowania tego timera — kliknij, a następnie naciśnij klawisz (Esc czyści)",
  "boss.removeSkill": "usuń umiejętność",
  "boss.noSkills": "brak umiejętności",
  "boss.addSkill": "+ DODAJ UMIEJĘTNOŚĆ",

  // ---- CooldownSettings ----
  "cooldown.title": "COOLDOWNY",
  "cooldown.colName": "NAZWA",
  "cooldown.colTag": "TAG",
  "cooldown.colDuration": "CZAS",
  "cooldown.namePlaceholder": "nazwa",
  "cooldown.tagPlaceholder": "tag",
  "cooldown.tagTitle": "krótka etykieta widoczna na pasku (pochodna od nazwy; edytowalna)",
  "cooldown.durationTitle": "czas trwania (godziny / minuty)",
  "cooldown.removeCooldown": "usuń cooldown",
  "cooldown.noCooldowns": "brak cooldownów",
  "cooldown.addCooldown": "+ DODAJ COOLDOWN",

  // ---- RecurringSettings ----
  "recurring.colName": "NAZWA",
  "recurring.colDuration": "CZAS",
  "recurring.colRank": "RANGA",
  "recurring.namePlaceholder": "nazwa",
  "recurring.durationTitle": "czas trwania (dni / godziny / minuty)",
  "recurring.removeItem": "usuń przedmiot",
  "recurring.titleItems": "WYGASAJĄCE PRZEDMIOTY",
  "recurring.titleRoutine": "TRENING",
  "recurring.addItem": "+ DODAJ PRZEDMIOT",
  "recurring.addRoutine": "+ DODAJ TRENING",
  "recurring.noItems": "brak wygasających przedmiotów",
  "recurring.noRoutine": "brak elementów treningu",
  "recurring.markMaxed": "maks. — wycofaj z treningu (odwracalne)",
  "recurring.restoreMaxed": "maks. — kliknij, aby przywrócić do treningu",
  "recurring.customTraining": "+ WŁASNY TRENING",
  "recurring.pickerFilter": "filtruj trening…",
  "recurring.alreadyAdded": "już dodano",

  // ---- CooldownPicker ----
  "picker.startCooldown": "uruchom cooldown",
  "picker.hint": "przewiń, aby zmienić czas",
  "picker.itemTitle": "kliknij, aby uruchomić · przewiń, aby dostosować czas",

  // ---- CooldownStrip ----
  "cooldownStrip.pillHint": "lewy przycisk — restart · prawy przycisk — usuń",

  // ---- ExpiringAccordion ----
  "expiring.empty": "brak wygasających przedmiotów",
  "expiring.refresh": "odśwież — wystaw nowy pełny cykl od teraz",
  "expiring.start": "uruchom — wystaw pełny cykl od teraz",

  // ---- RoutineAccordion ----
  "routine.empty": "brak elementów treningu",
  "routine.sectionBooks": "Księgi umiejętności",
  "routine.sectionLanguages": "Języki",
  "routine.sectionChores": "Narzędzia",
  "routine.readSuccessReady": "udana lektura — awansuj o szczebel i wystaw nową bramkę 24h",
  "routine.readSuccessEarly": "przeczytano teraz (pominięto cooldown) — awansuj o szczebel i wystaw bramkę od teraz",
  "routine.readFailReady": "nieudana lektura — księga spalona, brak awansu; wystaw bramkę 24h",
  "routine.readFailEarly": "przeczytano teraz (pominięto cooldown) ale nieudanie — księga spalona, brak awansu; wystaw bramkę od teraz",
  "routine.markDoneReady": "oznacz jako wykonane — wystaw nowy pełny cykl od teraz",
  "routine.markDoneEarly": "wykonane wcześniej — wystaw cykl od teraz (rezygnujesz z czekania)",
  "routine.skipCooldown": "użyj scrolla, aby pominąć cooldown i przeczytać wcześniej (użyto przedmiotu)",

  // ---- RungCurtain ----
  "rung.triggerTitle": "ustaw aktualny szczebel",
  "rung.filterPlaceholder": "filtruj szczeble…",
  "rung.filterAriaLabel": "filtruj szczeble",
  "rung.noMatch": "brak wyników",

  // ---- CharacterSwitcher ----
  "char.activeCharacterTitle": "aktywna postać",
  "char.frozenTitle": "Zamrożono — odnów subskrypcję, aby użyć tej postaci",
  "char.editTitle": "edytuj / klasyfikuj",
  "char.editFrozenTitle": "zamrożono — odnów subskrypcję, aby edytować",
  "char.deleteTitle": "usuń",
  "char.deleteFrozenTitle": "zamrożono — odnów subskrypcję, aby zarządzać",
  "char.deleteOnlyTitle": "jedynej postaci nie można usunąć",
  "char.newCharacter": "+ Nowa postać",
  "char.addWithPro": "✦ Dodaj postacie z Pro",

  // ---- CharacterWizard ----
  "wizard.newCharacter": "NOWA POSTAĆ",
  "wizard.editCharacter": "EDYTUJ POSTAĆ",
  "wizard.cancel": "anuluj",
  "wizard.namePlaceholder": "nazwa postaci…",
  "wizard.nameAriaLabel": "nazwa postaci",
  "wizard.back": "← Wstecz",
  "wizard.next": "Dalej →",
  "wizard.save": "Zapisz",
  "wizard.create": "Utwórz",

  // ---- TourCard ----
  "tour.welcomeTitle": "WITAJ",
  "tour.dockTitle": "PASEK NARZĘDZI",
  "tour.characterTitle": "TWOJA POSTAĆ",
  "tour.skillsTitle": "LOCHY",
  "tour.cooldownsTitle": "COOLDOWNY",
  "tour.itemsTitle": "WYGASAJĄCE PRZEDMIOTY",
  "tour.routineTitle": "TRENING",
  "tour.settingsTitle": "USTAWIENIA",
  "tour.doneTitle": "GOTOWE",
  "tour.next": "Dalej →",
  "tour.back": "← Wstecz",
  "tour.finish": "Rozumiem",
  "tour.skip": "✕ Pomiń tour",
  "tour.makeItYours": "⚙ Dostosuj →",

  // ---- SubscribeScreen ----
  "subscribe.title": "DRAGONSAID PRO",
  "subscribe.planAriaLabel": "Plan subskrypcji",
  "subscribe.bestValue": "NAJLEPSZA OFERTA",
  "subscribe.planAnnual": "Roczny",
  "subscribe.planMonthly": "Miesięczny",
  "subscribe.startTrial": "Rozpocznij 7-dniowy bezpłatny okres próbny",
  "subscribe.done": "Gotowe",
  "subscribe.notNow": "Nie teraz",
  "subscribe.resubscribe": "Odnów subskrypcję",
  "subscribe.subscribe": "Subskrybuj",
  "subscribe.orSubscribeNow": "lub subskrybuj teraz",
  "subscribe.error": "Sklep nie mógł sfinalizować zakupu — nic nie zostało zmienione. Spróbuj ponownie za chwilę.",

  // ---- UpgradeBanner ----
  "banner.trialLabel": "✦ Próba Pro aktywna",
  "banner.trialCta": "Zatrzymaj Pro",
  "banner.lapsedLabel": "✦ Pro wstrzymane — twoja stajnia jest zamrożona",
  "banner.lapsedCta": "Odnów subskrypcję",
  "banner.neverLabel": "✦ Odblokuj Dragon's Aid Pro",
  "banner.neverCta": "Ulepsz",

  // ---- CapNudge ----
  "cap.seePro": "Zobacz Pro",
  "cap.dismiss": "Odrzuć",

  // ---- SettingsApp ----
  "settings.title": "USTAWIENIA",
  "settings.resetToDefaults": "przywróć domyślne ustawienia tej sekcji",
  "settings.resetConfirm": "Przywrócić domyślne ustawienia tej sekcji? Pozostałe sekcje nie zostaną zmienione.",
  "settings.close": "zamknij",
  "settings.tabDungeons": "Lochy",
  "settings.tabCooldowns": "Cooldowny",
  "settings.tabItems": "Przedmioty",
  "settings.tabRoutine": "Trening",
  "settings.tabLanguage": "Język",
  "settings.addBoss": "+ DODAJ BOSSA",
  "settings.closeTitle": "zamknij ustawienia",
  "settings.explainDungeons": "Lochy — twoi bossowie i ich chipy umiejętności: nazwy, czasy trwania, dźwięki i globalne skróty klawiszowe.",
  "settings.explainCooldowns": "Cooldowny — jednorazowe odrodzenia w lochach; ustaw tutaj czas trwania każdego.",
  "settings.explainItems": "Wygasające przedmioty — pet, kostium, wierzchowiec; ustaw jak długo trwa każdy cykl.",
  "settings.explainRoutine": "Trening — menu cyklicznych zadań; dodaj pozycje i dostosuj okno czasowe każdej.",
  "settings.showAround": "OPROWADŹ MNIE",
  "settings.showAroundHint": "Odtwórz krótki tour po pasku narzędzi i jego funkcjach.",

  // ---- LocaleSettings ----
  "locale.title": "JĘZYK",
  "locale.hint": "Nazwy treści są wyświetlane w wybranym języku. Własne nazwy, które sam wpisałeś, nigdy nie są zmieniane.",
  "locale.filterPlaceholder": "filtruj języki…",
  "locale.filterAriaLabel": "filtruj języki",

  // ---- BackupSection ----
  "backup.export": "EKSPORTUJ KOPIĘ",
  "backup.import": "IMPORTUJ KOPIĘ",
  "backup.exported": "Kopia wyeksportowana.",
  "backup.imported": "Kopia zaimportowana.",
  "backup.invalid": "Ten plik nie jest prawidłową kopią zapasową — nic nie zostało zmienione.",
};

// ---- Turkish chrome table (#99) ----
// Free-translated UI strings (informal register). 171 keys supplied; the rest fall back to
// English (same partial pattern as DE). Best-effort, pending a native Turkish review.
const TR_PARTIAL: Partial<ChromeTable> = {
  // ---- DockBar ----
  "dock.drag": "taşımak için sürükle",
  "dock.skills": "beceriler",
  "dock.cooldowns": "zindan cooldown'ları",
  "dock.expiring": "süresi dolan eşyalar",
  "dock.routine": "antrenman",
  "dock.settings": "ayarlar",
  "dock.quit": "Dragon's Aid'den çık",

  // ---- TimerScreen ----
  "timer.noSkills": "beceri yok — ⚙ ayarlardan ekle",
  "timer.back": "zindanlara geri dön",
  "timer.hintLeftClick": "sol tık",
  "timer.hintStopStart": "durdur / başlat",
  "timer.hintRightClick": "sağ tık",
  "timer.hintReset": "sıfırla",

  // ---- BossSelect ----
  "bossSelect.title": "ZİNDAN SEÇ",

  // ---- SequenceScreen ----
  "sequence.back": "boss seçimine geri dön",
  "sequence.switchToColumns": "Sütunlara Geç (Aşama 2)",
  "sequence.switchToElements": "Elementlere Geç (Aşama 1)",
  "sequence.switchToColumnsTitle": "sütunlara geç (Aşama 2)",
  "sequence.switchToElementsTitle": "elementlere geç (Aşama 1)",
  "sequence.columnsLabel": "Sütunlar",
  "sequence.elementsLabel": "Elementler",
  "sequence.undo": "geri al",
  "sequence.clear": "temizle",
  "sequence.queenShift": "Kraliçe kaydırma",
  "sequence.queenShiftTitle": "kraliçe: sırayı bir adım kaydır (1·2·3·4 → 4·1·2·3)",
  "sequence.empty": "sırayı kaydetmek için yukarıya dokun — işaretlemek için bir chip'e dokun",
  "sequence.chipTitle": "yok edildiğinde / açıldığında dokun",
  "sequence.titleElements": "TEMPLUM · ELEMENTLER",
  "sequence.titleColumns": "TEMPLUM · SÜTUNLAR",

  // ---- BossSettings ----
  "boss.bossNamePlaceholder": "boss adı",
  "boss.deleteBoss": "boss'u sil",
  "boss.colSkill": "BECERİ",
  "boss.colSec": "SAN",
  "boss.colSound": "SES",
  "boss.colHotkey": "KISA YOL",
  "boss.skillNamePlaceholder": "ad",
  "boss.durationTitle": "süre (saniye)",
  "boss.soundTitle": "bu becerinin uyarılarında çalınan ses",
  "boss.previewSound": "bu sesi dinle",
  "boss.hotkeyTitle": "bu zamanlayıcıyı sıfırlamak için kısayol — tıkla, sonra bir tuşa bas (Esc temizler)",
  "boss.removeSkill": "beceriyi kaldır",
  "boss.noSkills": "henüz beceri yok",
  "boss.addSkill": "+ BECERİ EKLE",

  // ---- CooldownSettings ----
  "cooldown.title": "COOLDOWN'LAR",
  "cooldown.colName": "AD",
  "cooldown.colTag": "ETİKET",
  "cooldown.colDuration": "SÜRE",
  "cooldown.namePlaceholder": "ad",
  "cooldown.tagPlaceholder": "etiket",
  "cooldown.tagTitle": "çubukta gösterilen kısa etiket (addan otomatik türetilir; düzenlenebilir)",
  "cooldown.durationTitle": "süre (saat / dakika)",
  "cooldown.removeCooldown": "cooldown'ı kaldır",
  "cooldown.noCooldowns": "henüz cooldown yok",
  "cooldown.addCooldown": "+ COOLDOWN EKLE",

  // ---- RecurringSettings ----
  "recurring.colName": "AD",
  "recurring.colDuration": "SÜRE",
  "recurring.colRank": "DERECE",
  "recurring.namePlaceholder": "ad",
  "recurring.durationTitle": "süre (gün / saat / dakika)",
  "recurring.removeItem": "eşyayı kaldır",
  "recurring.titleItems": "SÜRESİ DOLAN EŞYALAR",
  "recurring.titleRoutine": "ANTRENMAN",
  "recurring.addItem": "+ EŞYA EKLE",
  "recurring.addRoutine": "+ ANTRENMAN EKLE",
  "recurring.noItems": "henüz süresi dolan eşya yok",
  "recurring.noRoutine": "henüz antrenman öğesi yok",
  "recurring.markMaxed": "maksimum — antrenmanı sonlandır (geri alınabilir)",
  "recurring.restoreMaxed": "maksimum — antrenmana geri döndürmek için tıkla",
  "recurring.customTraining": "+ ÖZEL ANTRENMAN",
  "recurring.pickerFilter": "antrenman ara…",
  "recurring.alreadyAdded": "zaten eklendi",

  // ---- CooldownPicker ----
  "picker.startCooldown": "cooldown başlat",
  "picker.hint": "süreyi değiştirmek için kaydır",
  "picker.itemTitle": "başlatmak için tıkla · süreyi ayarlamak için kaydır",

  // ---- CooldownStrip ----
  "cooldownStrip.pillHint": "sol tık yeniden başlat · sağ tık temizle",

  // ---- ExpiringAccordion ----
  "expiring.empty": "henüz süresi dolan eşya yok",
  "expiring.refresh": "yenile — şu andan itibaren tam bir döngü damgala",
  "expiring.start": "başlat — şu andan itibaren tam bir döngü damgala",

  // ---- RoutineAccordion ----
  "routine.empty": "henüz antrenman öğesi yok",
  "routine.sectionBooks": "Beceri Kitapları",
  "routine.sectionLanguages": "Diller",
  "routine.sectionChores": "Yardımcı Araçlar",
  "routine.readSuccessReady": "başarılı okuma — basamağı yükselt ve 24 saatlik kapıyı yeniden damgala",
  "routine.readSuccessEarly": "şimdi oku (cooldown atlandı) — basamağı yükselt ve şu andan itibaren yeniden damgala",
  "routine.readFailReady": "başarısız okuma — kitap yandı, ilerleme yok; 24 saatlik kapıyı yeniden damgala",
  "routine.readFailEarly": "şimdi oku (cooldown atlandı) ama başarısız — kitap yandı, ilerleme yok; şu andan itibaren yeniden damgala",
  "routine.markDoneReady": "tamamlandı olarak işaretle — şu andan itibaren tam bir döngü damgala",
  "routine.markDoneEarly": "erken tamamlandı — şu andan itibaren yeniden damgala (beklemeyi feda et)",
  "routine.skipCooldown": "erken okuma için cooldown'ı atlamak üzere kaydır (eşya kullanıldı)",

  // ---- RungCurtain ----
  "rung.triggerTitle": "mevcut basamağı ayarla",
  "rung.filterPlaceholder": "basamakları ara…",
  "rung.filterAriaLabel": "basamakları filtrele",
  "rung.noMatch": "sonuç yok",

  // ---- CharacterSwitcher ----
  "char.activeCharacterTitle": "aktif karakter",
  "char.frozenTitle": "Donduruldu — bu karakteri kullanmak için yeniden abone ol",
  "char.editTitle": "düzenle / sınıflandır",
  "char.editFrozenTitle": "donduruldu — düzenlemek için yeniden abone ol",
  "char.deleteTitle": "sil",
  "char.deleteFrozenTitle": "donduruldu — yönetmek için yeniden abone ol",
  "char.deleteOnlyTitle": "tek karakter silinemez",
  "char.newCharacter": "+ Yeni karakter",
  "char.addWithPro": "✦ Pro ile karakter ekle",

  // ---- CharacterWizard ----
  "wizard.newCharacter": "YENİ KARAKTER",
  "wizard.editCharacter": "KARAKTERİ DÜZENLE",
  "wizard.cancel": "iptal",
  "wizard.namePlaceholder": "karakter adı…",
  "wizard.nameAriaLabel": "karakter adı",
  "wizard.back": "← Geri",
  "wizard.next": "İleri →",
  "wizard.save": "Kaydet",
  "wizard.create": "Oluştur",

  // ---- TourCard ----
  "tour.welcomeTitle": "HOŞ GELDİN",
  "tour.dockTitle": "DOCK",
  "tour.characterTitle": "KARAKTERİN",
  "tour.skillsTitle": "ZİNDANLAR",
  "tour.cooldownsTitle": "COOLDOWN'LAR",
  "tour.itemsTitle": "SÜRESİ DOLAN EŞYALAR",
  "tour.routineTitle": "ANTRENMAN",
  "tour.settingsTitle": "AYARLAR",
  "tour.doneTitle": "HAZIRSIN",
  "tour.next": "İleri →",
  "tour.back": "← Geri",
  "tour.finish": "Anladım",
  "tour.skip": "✕ Turu atla",
  "tour.makeItYours": "⚙ Kendi haline getir →",

  // ---- SubscribeScreen ----
  "subscribe.title": "DRAGONSAID PRO",
  "subscribe.planAriaLabel": "Abonelik planı",
  "subscribe.bestValue": "EN İYİ DEĞER",
  "subscribe.planAnnual": "Yıllık",
  "subscribe.planMonthly": "Aylık",
  "subscribe.startTrial": "7 günlük ücretsiz denemeyi başlat",
  "subscribe.done": "Tamam",
  "subscribe.notNow": "Şimdi değil",
  "subscribe.resubscribe": "Yeniden abone ol",
  "subscribe.subscribe": "Abone ol",
  "subscribe.orSubscribeNow": "veya şimdi abone ol",
  "subscribe.error": "Mağaza satın almayı tamamlayamadı — hiçbir şey değiştirilmedi. Biraz sonra tekrar dene.",

  // ---- UpgradeBanner ----
  "banner.trialLabel": "✦ Pro deneme aktif",
  "banner.trialCta": "Pro'yu koru",
  "banner.lapsedLabel": "✦ Pro duraklatıldı — ahırın donduruldu",
  "banner.lapsedCta": "Yeniden abone ol",
  "banner.neverLabel": "✦ Dragon's Aid Pro'yu aç",
  "banner.neverCta": "Yükselt",

  // ---- CapNudge ----
  "cap.seePro": "Pro'yu gör",
  "cap.dismiss": "Kapat",

  // ---- SettingsApp ----
  "settings.title": "AYARLAR",
  "settings.resetToDefaults": "bu bölümü varsayılanlara sıfırla",
  "settings.resetConfirm": "Bu bölümü varsayılan değerlerine sıfırlamak istiyor musun? Diğer bölümler değişmeyecek.",
  "settings.close": "kapat",
  "settings.tabDungeons": "Zindanlar",
  "settings.tabCooldowns": "Cooldown'lar",
  "settings.tabItems": "Eşyalar",
  "settings.tabRoutine": "Antrenman",
  "settings.tabLanguage": "Dil",
  "settings.addBoss": "+ BOSS EKLE",
  "settings.closeTitle": "ayarları kapat",
  "settings.explainDungeons": "Zindanlar — boss'ların ve beceri chip'leri: adlar, süreler, sesler ve global kısayollar.",
  "settings.explainCooldowns": "Cooldown'lar — tek seferlik zindan yeniden doğmaları; burada her birinin süresini ayarla.",
  "settings.explainItems": "Süresi dolan eşyalar — pet, kostüm, binek; her döngünün ne kadar süreceğini ayarla.",
  "settings.explainRoutine": "Antrenman — dönen görevler menüsü; girdi ekle ve her birinin penceresini ayarla.",
  "settings.showAround": "GEZİNTİYE ÇIKAR",
  "settings.showAroundHint": "Dock ve araçlarının kısa turunu tekrar oynat.",

  // ---- LocaleSettings ----
  "locale.title": "DİL",
  "locale.hint": "İçerik adları seçilen dilde gösterilir. Kendin yazdığın serbest metin adlar hiçbir zaman değiştirilmez.",
  "locale.filterPlaceholder": "dil ara…",
  "locale.filterAriaLabel": "dilleri filtrele",

  // ---- BackupSection ----
  "backup.export": "YEDEK DIŞA AKTAR",
  "backup.import": "YEDEK İÇE AKTAR",
  "backup.exported": "Yedek dışa aktarıldı.",
  "backup.imported": "Yedek içe aktarıldı.",
  "backup.invalid": "Bu dosya geçerli bir yedek değil — hiçbir şey değiştirilmedi.",
};

// ---- Romanian chrome table (#99) ----
// Free-translated UI strings (informal register). 171 keys supplied; the rest fall back to
// English (same partial pattern as DE). Best-effort, pending a native Romanian review.
const RO_PARTIAL: Partial<ChromeTable> = {
  // ---- DockBar ----
  "dock.drag": "trage pentru a muta",
  "dock.skills": "abilități",
  "dock.cooldowns": "cooldown temniță",
  "dock.expiring": "obiecte expirate",
  "dock.routine": "antrenament",
  "dock.settings": "setări",
  "dock.quit": "ieși din Dragon's Aid",

  // ---- TimerScreen ----
  "timer.noSkills": "fără abilități — adaugă câteva în ⚙ setări",
  "timer.back": "înapoi la temnițe",
  "timer.hintLeftClick": "clic stânga",
  "timer.hintStopStart": "oprește / pornește",
  "timer.hintRightClick": "clic dreapta",
  "timer.hintReset": "resetează",

  // ---- BossSelect ----
  "bossSelect.title": "ALEGE TEMNIȚA",

  // ---- SequenceScreen ----
  "sequence.back": "înapoi la selecția boss-ului",
  "sequence.switchToColumns": "Comută la Coloane (Faza 2)",
  "sequence.switchToElements": "Comută la Elemente (Faza 1)",
  "sequence.switchToColumnsTitle": "comută la coloane (Faza 2)",
  "sequence.switchToElementsTitle": "comută la elemente (Faza 1)",
  "sequence.columnsLabel": "Coloane",
  "sequence.elementsLabel": "Elemente",
  "sequence.undo": "anulează ultimul",
  "sequence.clear": "șterge",
  "sequence.queenShift": "Tura reginei",
  "sequence.queenShiftTitle": "regina: deplasează ordinea cu o poziție (1·2·3·4 → 4·1·2·3)",
  "sequence.empty": "atinge sus pentru a înregistra ordinea — atinge un chip pentru a-l marca",
  "sequence.chipTitle": "atinge când e distrus / deschis",
  "sequence.titleElements": "TEMPLUM · ELEMENTE",
  "sequence.titleColumns": "TEMPLUM · COLOANE",

  // ---- BossSettings ----
  "boss.bossNamePlaceholder": "numele boss-ului",
  "boss.deleteBoss": "șterge boss-ul",
  "boss.colSkill": "ABILITATE",
  "boss.colSec": "SEC",
  "boss.colSound": "SUNET",
  "boss.colHotkey": "TASTĂ",
  "boss.skillNamePlaceholder": "nume",
  "boss.durationTitle": "durată (secunde)",
  "boss.soundTitle": "sunetul redat la alertele acestei abilități",
  "boss.previewSound": "previzualizează acest sunet",
  "boss.hotkeyTitle": "tastă pentru a reseta acest cronometru — fă clic, apoi apasă o tastă (Esc pentru a șterge)",
  "boss.removeSkill": "șterge abilitatea",
  "boss.noSkills": "încă fără abilități",
  "boss.addSkill": "+ ADAUGĂ ABILITATE",

  // ---- CooldownSettings ----
  "cooldown.title": "COOLDOWN-URI",
  "cooldown.colName": "NUME",
  "cooldown.colTag": "ETICHETĂ",
  "cooldown.colDuration": "DURATĂ",
  "cooldown.namePlaceholder": "nume",
  "cooldown.tagPlaceholder": "etichetă",
  "cooldown.tagTitle": "etichetă scurtă afișată în bară (derivată din nume; editabilă)",
  "cooldown.durationTitle": "durată (ore / minute)",
  "cooldown.removeCooldown": "șterge cooldown-ul",
  "cooldown.noCooldowns": "încă fără cooldown-uri",
  "cooldown.addCooldown": "+ ADAUGĂ COOLDOWN",

  // ---- RecurringSettings ----
  "recurring.colName": "NUME",
  "recurring.colDuration": "DURATĂ",
  "recurring.colRank": "RANG",
  "recurring.namePlaceholder": "nume",
  "recurring.durationTitle": "durată (zile / ore / minute)",
  "recurring.removeItem": "șterge obiectul",
  "recurring.titleItems": "OBIECTE EXPIRATE",
  "recurring.titleRoutine": "ANTRENAMENT",
  "recurring.addItem": "+ ADAUGĂ OBIECT",
  "recurring.addRoutine": "+ ADAUGĂ ANTRENAMENT",
  "recurring.noItems": "încă fără obiecte expirate",
  "recurring.noRoutine": "încă fără antrenamente",
  "recurring.markMaxed": "la maxim — scoate din antrenament (reversibil)",
  "recurring.restoreMaxed": "la maxim — fă clic pentru a restabili în antrenament",
  "recurring.customTraining": "+ ANTRENAMENT PERSONALIZAT",
  "recurring.pickerFilter": "filtrează antrenamente…",
  "recurring.alreadyAdded": "deja adăugat",

  // ---- CooldownPicker ----
  "picker.startCooldown": "pornește un cooldown",
  "picker.hint": "derulează pentru a schimba timpul",
  "picker.itemTitle": "fă clic pentru a porni · derulează pentru a ajusta durata",

  // ---- CooldownStrip ----
  "cooldownStrip.pillHint": "clic stânga resetează · clic dreapta șterge",

  // ---- ExpiringAccordion ----
  "expiring.empty": "încă fără obiecte expirate",
  "expiring.refresh": "reînnoiește — re-marchează un ciclu complet de acum",
  "expiring.start": "pornește — marchează un ciclu complet de acum",

  // ---- RoutineAccordion ----
  "routine.empty": "încă fără antrenamente",
  "routine.sectionBooks": "Cărți de Abilități",
  "routine.sectionLanguages": "Limbi",
  "routine.sectionChores": "Utilitare",
  "routine.readSuccessReady": "citire reușită — avansează un rang și re-marchează fereastra de 24h",
  "routine.readSuccessEarly": "citit acum (cooldown omis) — avansează un rang și re-marchează de acum",
  "routine.readFailReady": "citire eșuată — carte arsă, fără avansare; re-marchează fereastra de 24h",
  "routine.readFailEarly": "citit acum (cooldown omis) dar eșuat — carte arsă, fără avansare; re-marchează de acum",
  "routine.markDoneReady": "marchează ca finalizat — re-marchează un ciclu complet de acum",
  "routine.markDoneEarly": "finalizat mai devreme — re-marchează de acum (renunți la așteptare)",
  "routine.skipCooldown": "folosește scroll-ul pentru a omite cooldown-ul și a citi mai devreme (obiect consumat)",

  // ---- RungCurtain ----
  "rung.triggerTitle": "setează rangul curent",
  "rung.filterPlaceholder": "filtrează ranguri…",
  "rung.filterAriaLabel": "filtrează ranguri",
  "rung.noMatch": "niciun rezultat",

  // ---- CharacterSwitcher ----
  "char.activeCharacterTitle": "personaj activ",
  "char.frozenTitle": "Înghețat — reînnoiește abonamentul pentru a folosi acest personaj",
  "char.editTitle": "editează / clasifică",
  "char.editFrozenTitle": "înghețat — reînnoiește abonamentul pentru a edita",
  "char.deleteTitle": "șterge",
  "char.deleteFrozenTitle": "înghețat — reînnoiește abonamentul pentru a gestiona",
  "char.deleteOnlyTitle": "singurul personaj nu poate fi șters",
  "char.newCharacter": "+ Personaj nou",
  "char.addWithPro": "✦ Adaugă personaje cu Pro",

  // ---- CharacterWizard ----
  "wizard.newCharacter": "PERSONAJ NOU",
  "wizard.editCharacter": "EDITEAZĂ PERSONAJUL",
  "wizard.cancel": "anulează",
  "wizard.namePlaceholder": "numele personajului…",
  "wizard.nameAriaLabel": "numele personajului",
  "wizard.back": "← Înapoi",
  "wizard.next": "Următorul →",
  "wizard.save": "Salvează",
  "wizard.create": "Creează",

  // ---- TourCard ----
  "tour.welcomeTitle": "BUN VENIT",
  "tour.dockTitle": "BARA",
  "tour.characterTitle": "PERSONAJUL TĂU",
  "tour.skillsTitle": "TEMNIȚE",
  "tour.cooldownsTitle": "COOLDOWN-URI",
  "tour.itemsTitle": "OBIECTE EXPIRATE",
  "tour.routineTitle": "ANTRENAMENT",
  "tour.settingsTitle": "SETĂRI",
  "tour.doneTitle": "GATA",
  "tour.next": "Următorul →",
  "tour.back": "← Înapoi",
  "tour.finish": "Am înțeles",
  "tour.skip": "✕ Sari peste tur",
  "tour.makeItYours": "⚙ Personalizează →",

  // ---- SubscribeScreen ----
  "subscribe.title": "DRAGONSAID PRO",
  "subscribe.planAriaLabel": "Plan de abonament",
  "subscribe.bestValue": "CEA MAI BUNĂ OFERTĂ",
  "subscribe.planAnnual": "Anual",
  "subscribe.planMonthly": "Lunar",
  "subscribe.startTrial": "Începe perioada de probă gratuită de 7 zile",
  "subscribe.done": "Gata",
  "subscribe.notNow": "Nu acum",
  "subscribe.resubscribe": "Reabonează-te",
  "subscribe.subscribe": "Abonează-te",
  "subscribe.orSubscribeNow": "sau abonează-te acum",
  "subscribe.error": "Magazinul nu a putut finaliza achiziția — nimic nu a fost modificat. Încearcă din nou într-un moment.",

  // ---- UpgradeBanner ----
  "banner.trialLabel": "✦ Probă Pro activă",
  "banner.trialCta": "Păstrează Pro",
  "banner.lapsedLabel": "✦ Pro în pauză — grajdul tău este înghețat",
  "banner.lapsedCta": "Reabonează-te",
  "banner.neverLabel": "✦ Deblochează Dragon's Aid Pro",
  "banner.neverCta": "Obține Pro",

  // ---- CapNudge ----
  "cap.seePro": "Vezi Pro",
  "cap.dismiss": "Închide",

  // ---- SettingsApp ----
  "settings.title": "SETĂRI",
  "settings.resetToDefaults": "resetează această secțiune la valorile implicite",
  "settings.resetConfirm": "Resetezi această secțiune la valorile implicite? Celelalte secțiuni nu se vor modifica.",
  "settings.close": "închide",
  "settings.tabDungeons": "Temnițe",
  "settings.tabCooldowns": "Cooldown-uri",
  "settings.tabItems": "Obiecte",
  "settings.tabRoutine": "Antrenament",
  "settings.tabLanguage": "Limbă",
  "settings.addBoss": "+ ADAUGĂ BOSS",
  "settings.closeTitle": "închide setările",
  "settings.explainDungeons": "Temnițe — boss-ii tăi și chip-urile lor de abilități: nume, durate, sunete și taste globale.",
  "settings.explainCooldowns": "Cooldown-uri — respawn-uri unice de temnițe; setează aici durata fiecăruia.",
  "settings.explainItems": "Obiecte expirate — pet, costum, montură; setează cât durează fiecare ciclu.",
  "settings.explainRoutine": "Antrenament — meniul de sarcini recurente; adaugă intrări și ajustează fereastra fiecăreia.",
  "settings.showAround": "ARATĂ-MI CUM",
  "settings.showAroundHint": "Redă turul rapid al barei și al instrumentelor sale.",

  // ---- LocaleSettings ----
  "locale.title": "LIMBĂ",
  "locale.hint": "Numele de conținut sunt afișate în limba selectată. Numele libere pe care le-ai scris tu nu sunt niciodată modificate.",
  "locale.filterPlaceholder": "filtrează limbi…",
  "locale.filterAriaLabel": "filtrează limbi",

  // ---- BackupSection ----
  "backup.export": "EXPORTĂ COPIE DE REZERVĂ",
  "backup.import": "IMPORTĂ COPIE DE REZERVĂ",
  "backup.exported": "Copie de rezervă exportată.",
  "backup.imported": "Copie de rezervă importată.",
  "backup.invalid": "Acest fișier nu este o copie de rezervă validă — nimic nu a fost modificat.",
};

// ---- Portuguese chrome table (#99) ----
// Free-translated UI strings (informal register). 171 keys supplied; the rest fall back to
// English (same partial pattern as DE). Best-effort, pending a native Portuguese review.
const PT_PARTIAL: Partial<ChromeTable> = {
  // ---- DockBar ----
  "dock.drag": "arrasta para mover",
  "dock.skills": "habilidades",
  "dock.cooldowns": "cooldown masmorra",
  "dock.expiring": "objetos expirados",
  "dock.routine": "treino",
  "dock.settings": "definições",
  "dock.quit": "sair do Dragon's Aid",

  // ---- TimerScreen ----
  "timer.noSkills": "sem habilidades — adiciona algumas em ⚙ definições",
  "timer.back": "voltar às masmorras",
  "timer.hintLeftClick": "clique esquerdo",
  "timer.hintStopStart": "parar / iniciar",
  "timer.hintRightClick": "clique direito",
  "timer.hintReset": "reiniciar",

  // ---- BossSelect ----
  "bossSelect.title": "SELECIONA MASMORRA",

  // ---- SequenceScreen ----
  "sequence.back": "voltar à seleção de boss",
  "sequence.switchToColumns": "Mudar para Colunas (Fase 2)",
  "sequence.switchToElements": "Mudar para Elementos (Fase 1)",
  "sequence.switchToColumnsTitle": "mudar para colunas (Fase 2)",
  "sequence.switchToElementsTitle": "mudar para elementos (Fase 1)",
  "sequence.columnsLabel": "Colunas",
  "sequence.elementsLabel": "Elementos",
  "sequence.undo": "anular último",
  "sequence.clear": "limpar",
  "sequence.queenShift": "Turno da rainha",
  "sequence.queenShiftTitle": "rainha: desloca a ordem uma posição (1·2·3·4 → 4·1·2·3)",
  "sequence.empty": "toca em cima para registar a ordem — toca num chip para marcá-lo",
  "sequence.chipTitle": "toca quando estiver destruído / aberto",
  "sequence.titleElements": "TEMPLUM · ELEMENTOS",
  "sequence.titleColumns": "TEMPLUM · COLUNAS",

  // ---- BossSettings ----
  "boss.bossNamePlaceholder": "nome do boss",
  "boss.deleteBoss": "eliminar boss",
  "boss.colSkill": "HABILIDADE",
  "boss.colSec": "SEG",
  "boss.colSound": "SOM",
  "boss.colHotkey": "TECLA",
  "boss.skillNamePlaceholder": "nome",
  "boss.durationTitle": "duração (segundos)",
  "boss.soundTitle": "som reproduzido nos avisos desta habilidade",
  "boss.previewSound": "pré-visualizar este som",
  "boss.hotkeyTitle": "tecla para reiniciar este temporizador — clica e depois prime uma tecla (Esc para apagar)",
  "boss.removeSkill": "eliminar habilidade",
  "boss.noSkills": "ainda sem habilidades",
  "boss.addSkill": "+ ADICIONAR HABILIDADE",

  // ---- CooldownSettings ----
  "cooldown.title": "COOLDOWNS",
  "cooldown.colName": "NOME",
  "cooldown.colTag": "TAG",
  "cooldown.colDuration": "DURAÇÃO",
  "cooldown.namePlaceholder": "nome",
  "cooldown.tagPlaceholder": "tag",
  "cooldown.tagTitle": "etiqueta curta mostrada na barra (derivada do nome; editável)",
  "cooldown.durationTitle": "duração (horas / minutos)",
  "cooldown.removeCooldown": "eliminar cooldown",
  "cooldown.noCooldowns": "ainda sem cooldowns",
  "cooldown.addCooldown": "+ ADICIONAR COOLDOWN",

  // ---- RecurringSettings ----
  "recurring.colName": "NOME",
  "recurring.colDuration": "DURAÇÃO",
  "recurring.colRank": "NÍVEL",
  "recurring.namePlaceholder": "nome",
  "recurring.durationTitle": "duração (dias / horas / minutos)",
  "recurring.removeItem": "eliminar objeto",
  "recurring.titleItems": "OBJETOS EXPIRADOS",
  "recurring.titleRoutine": "TREINO",
  "recurring.addItem": "+ ADICIONAR OBJETO",
  "recurring.addRoutine": "+ ADICIONAR TREINO",
  "recurring.noItems": "ainda sem objetos expirados",
  "recurring.noRoutine": "ainda sem treinos",
  "recurring.markMaxed": "no máximo — retirar do treino (reversível)",
  "recurring.restoreMaxed": "no máximo — clica para restaurar no treino",
  "recurring.customTraining": "+ TREINO PERSONALIZADO",
  "recurring.pickerFilter": "filtrar treinos…",
  "recurring.alreadyAdded": "já adicionado",

  // ---- CooldownPicker ----
  "picker.startCooldown": "iniciar um cooldown",
  "picker.hint": "desliza para mudar o tempo",
  "picker.itemTitle": "clica para iniciar · desliza para ajustar a duração",

  // ---- CooldownStrip ----
  "cooldownStrip.pillHint": "clique esquerdo reinicia · clique direito apaga",

  // ---- ExpiringAccordion ----
  "expiring.empty": "ainda sem objetos expirados",
  "expiring.refresh": "renovar — recarimbar um ciclo completo a partir de agora",
  "expiring.start": "iniciar — carimbar um ciclo completo a partir de agora",

  // ---- RoutineAccordion ----
  "routine.empty": "ainda sem treinos",
  "routine.sectionBooks": "Livros de Habilidades",
  "routine.sectionLanguages": "Línguas",
  "routine.sectionChores": "Utilidades",
  "routine.readSuccessReady": "leitura bem-sucedida — avança um nível e recarimba a janela de 24h",
  "routine.readSuccessEarly": "lido agora (cooldown ignorado) — avança um nível e recarimba a partir de agora",
  "routine.readFailReady": "leitura falhada — livro queimado, sem avanço; recarimba a janela de 24h",
  "routine.readFailEarly": "lido agora (cooldown ignorado) mas falhou — livro queimado, sem avanço; recarimba a partir de agora",
  "routine.markDoneReady": "marcar como feito — recarimbar um ciclo completo a partir de agora",
  "routine.markDoneEarly": "feito antes — recarimbar a partir de agora (renuncias à espera)",
  "routine.skipCooldown": "usa o scroll para ignorar o cooldown e ler antes (objeto usado)",

  // ---- RungCurtain ----
  "rung.triggerTitle": "definir nível atual",
  "rung.filterPlaceholder": "filtrar níveis…",
  "rung.filterAriaLabel": "filtrar níveis",
  "rung.noMatch": "sem resultados",

  // ---- CharacterSwitcher ----
  "char.activeCharacterTitle": "personagem ativa",
  "char.frozenTitle": "Congelada — renova a subscrição para usar esta personagem",
  "char.editTitle": "editar / classificar",
  "char.editFrozenTitle": "congelada — renova a subscrição para editar",
  "char.deleteTitle": "eliminar",
  "char.deleteFrozenTitle": "congelada — renova a subscrição para gerir",
  "char.deleteOnlyTitle": "a única personagem não pode ser eliminada",
  "char.newCharacter": "+ Nova personagem",
  "char.addWithPro": "✦ Adiciona personagens com Pro",

  // ---- CharacterWizard ----
  "wizard.newCharacter": "NOVA PERSONAGEM",
  "wizard.editCharacter": "EDITAR PERSONAGEM",
  "wizard.cancel": "cancelar",
  "wizard.namePlaceholder": "nome da personagem…",
  "wizard.nameAriaLabel": "nome da personagem",
  "wizard.back": "← Voltar",
  "wizard.next": "Seguinte →",
  "wizard.save": "Guardar",
  "wizard.create": "Criar",

  // ---- TourCard ----
  "tour.welcomeTitle": "BEM-VINDO",
  "tour.dockTitle": "A BARRA",
  "tour.characterTitle": "A TUA PERSONAGEM",
  "tour.skillsTitle": "MASMORRAS",
  "tour.cooldownsTitle": "COOLDOWNS",
  "tour.itemsTitle": "OBJETOS EXPIRADOS",
  "tour.routineTitle": "TREINO",
  "tour.settingsTitle": "DEFINIÇÕES",
  "tour.doneTitle": "TUDO PRONTO",
  "tour.next": "Seguinte →",
  "tour.back": "← Voltar",
  "tour.finish": "Entendido",
  "tour.skip": "✕ Saltar tour",
  "tour.makeItYours": "⚙ Personaliza →",

  // ---- SubscribeScreen ----
  "subscribe.title": "DRAGONSAID PRO",
  "subscribe.planAriaLabel": "Plano de subscrição",
  "subscribe.bestValue": "MELHOR VALOR",
  "subscribe.planAnnual": "Anual",
  "subscribe.planMonthly": "Mensal",
  "subscribe.startTrial": "Começa a avaliação gratuita de 7 dias",
  "subscribe.done": "Feito",
  "subscribe.notNow": "Agora não",
  "subscribe.resubscribe": "Voltar a subscrever",
  "subscribe.subscribe": "Subscrever",
  "subscribe.orSubscribeNow": "ou subscreve agora",
  "subscribe.error": "A Loja não conseguiu concluir a compra — nada foi alterado. Tenta novamente dentro de momentos.",

  // ---- UpgradeBanner ----
  "banner.trialLabel": "✦ Avaliação Pro ativa",
  "banner.trialCta": "Manter Pro",
  "banner.lapsedLabel": "✦ Pro em pausa — o teu estábulo está congelado",
  "banner.lapsedCta": "Voltar a subscrever",
  "banner.neverLabel": "✦ Desbloqueia o Dragon's Aid Pro",
  "banner.neverCta": "Obter Pro",

  // ---- CapNudge ----
  "cap.seePro": "Ver Pro",
  "cap.dismiss": "Dispensar",

  // ---- SettingsApp ----
  "settings.title": "DEFINIÇÕES",
  "settings.resetToDefaults": "repor esta secção nos valores predefinidos",
  "settings.resetConfirm": "Repor esta secção nos valores predefinidos? As outras secções não serão alteradas.",
  "settings.close": "fechar",
  "settings.tabDungeons": "Masmorras",
  "settings.tabCooldowns": "Cooldowns",
  "settings.tabItems": "Objetos",
  "settings.tabRoutine": "Treino",
  "settings.tabLanguage": "Idioma",
  "settings.addBoss": "+ ADICIONAR BOSS",
  "settings.closeTitle": "fechar definições",
  "settings.explainDungeons": "Masmorras — os teus bosses e os seus chips de habilidade: nomes, durações, sons e teclas globais.",
  "settings.explainCooldowns": "Cooldowns — respawns únicos de masmorras; define aqui a duração de cada um.",
  "settings.explainItems": "Objetos expirados — pet, disfarce, montada; define quanto dura cada ciclo.",
  "settings.explainRoutine": "Treino — o menu de tarefas recorrentes; adiciona entradas e ajusta a janela de cada uma.",
  "settings.showAround": "ENSINA-ME A USAR",
  "settings.showAroundHint": "Reproduz o tour rápido da barra e das suas ferramentas.",

  // ---- LocaleSettings ----
  "locale.title": "IDIOMA",
  "locale.hint": "Os nomes de conteúdo são mostrados no idioma selecionado. Os nomes livres que escreveste nunca são alterados.",
  "locale.filterPlaceholder": "filtrar idiomas…",
  "locale.filterAriaLabel": "filtrar idiomas",

  // ---- BackupSection ----
  "backup.export": "EXPORTAR CÓPIA DE SEGURANÇA",
  "backup.import": "IMPORTAR CÓPIA DE SEGURANÇA",
  "backup.exported": "Cópia de segurança exportada.",
  "backup.imported": "Cópia de segurança importada.",
  "backup.invalid": "Este ficheiro não é uma cópia de segurança válida — nada foi alterado.",
};

const TABLES: Record<Locale, Partial<ChromeTable>> & { en: ChromeTable } = {
  en: EN,
  de: DE_PARTIAL,
  it: IT_PARTIAL,
  pt: PT_PARTIAL,
  ro: RO_PARTIAL,
  tr: TR_PARTIAL,
  pl: PL_PARTIAL,
  fr: FR_PARTIAL,
  es: ES_PARTIAL,
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
