import { useState } from "react";
import type { RoutineSection } from "../engine/recurring";
import { displayName, type Locale } from "../engine/contentCatalog";
import { raceKey } from "../engine/contentKeys";
import { RungCurtain } from "./RungCurtain";
import { ScrollIcon } from "./icons";
import type { RoutineRow } from "./useRecurring";
import { t, type ChromeKey } from "../engine/chrome";
import { tip } from "./Tooltip";

/** The Routine bands in display order (#57): race Abilities first, then Languages, then the universals. */
const SECTIONS: { key: RoutineSection; labelKey: ChromeKey }[] = [
  { key: "books", labelKey: "routine.sectionBooks" },
  { key: "languages", labelKey: "routine.sectionLanguages" },
  { key: "chores", labelKey: "routine.sectionChores" },
];

type Props = {
  /** The gate routine items, projected with their live state (see `useRecurring`). */
  rows: RoutineRow[];
  /** The active character's race — prefixes the Skill Books school sub-headers ("Sura - Black Magic", #57). */
  race?: string;
  /** The active content locale — resolves the Race prefix per-locale (slice #83). Required so a new call site can't silently un-localize. */
  locale: Locale;
  /** Mark a plain (ladder-less) routine done — restamps a full cycle from now (also starts one). */
  onDone: (defId: string) => void;
  /** Log a ladder read outcome: ✓ (success) advances the rank + restamps the gate, ✗ (fail) restamps only. */
  onRead: (defId: string, success: boolean) => void;
  /** Snap a ladder def's rank to a chosen rung (the set-rung curtain, #46) — writes progress only. */
  onSetRung: (defId: string, rungLabel: string) => void;
  /** Deep-link to the Training settings tab — the ⚙ in the panel's header row (design walk). */
  onOpenSettings?: () => void;
};

/**
 * The ✓ Routine panel expanded below the dock bar (#38): the standing checklist of `gate` chores
 * (biologist hand-in, daily book reading). Each row reads **ready** when it is do-able now (the
 * rolling clock has rolled over, or it was never done) — highlighted, with a ✓ to mark it done —
 * or the live countdown until it next becomes do-able once satisfied. Marking done restamps the
 * rolling cycle, moving the item out of the ready set until it comes due again.
 *
 * A row carrying a ladder (#44/#45/#46) shows its rung readout (`M3 · 2→M4`, or the `… ✓ max`
 * trophy) beneath the name — tappable to open the set-rung curtain (#46) — and swaps the single ✓
 * for a two-outcome **✓/✗** read gesture: ✓ a successful read (advance the rung + restamp the gate),
 * ✗ a failed read (book burned, gate restamped, no advance). The #46 curtain corrects any mistaken
 * advance. A **capped** ladder is the inert trophy end state: no gesture, no gate countdown — just
 * the `… ✓ max` readout (still tappable, since the curtain is the misclick fix).
 *
 * **Early-read lock (design walk).** While a row counts down its ✓/✗ (or the plain gate's ✓) lock
 * — performing a read disables the buttons, so a satisfied chore can't be re-logged by a stray tap.
 * In-game items can still skip the cooldown, so each row carries a third **scroll** glyph that is
 * the buttons' exact mirror: enabled only while they're locked, disabled whenever they're live.
 * Tapping the scroll ("I used an item") re-enables the read buttons and disarms itself while the
 * timer runs on — so the loop repeats (read → scroll → read → scroll) up the rungs. A ready row is
 * never locked, so its scroll just sits disabled. The unlock is UI-only (never persisted).
 *
 * The rows are banded into the three Routine sections (#57) — **Skill Books** (the race-filtered
 * class Abilities), **Languages**, **Chores** (the universal gates + any plain user-added one) —
 * each under a quiet header, so a classified Character's race subset reads as its own section. The
 * headers appear only when more than one section is present: an unclassified Character (chores only)
 * stays a clean flat list. Within Skill Books the Abilities sub-group by *school* (the Build tree),
 * each under a "Race - School" header (e.g. "Sura - Black Magic") — the only band that sub-groups.
 * Row rendering is identical across sections.
 */
export function RoutineAccordion({ rows, race, locale, onDone, onRead, onSetRung, onOpenSettings }: Props) {
  // Early-read unlock (design walk) — the set of defIds whose ✓/✗ the scroll has re-opened mid-
  // countdown. The scroll and the read buttons are always in opposite states: while counting down a
  // read locks the buttons and arms the scroll; tapping the scroll (you used an item) re-enables the
  // buttons and disarms itself, the timer running on underneath. So the loop repeats — read, scroll,
  // read, scroll — climbing the rungs without waiting. Transient & UI-only (never persisted); a read
  // clears the entry so the next read re-arms the scroll, and a ready row needs no unlock at all.
  const [unlocked, setUnlocked] = useState<ReadonlySet<string>>(() => new Set());
  const unlockEarly = (defId: string) => setUnlocked((s) => new Set(s).add(defId));
  const clearUnlock = (defId: string) =>
    setUnlocked((s) => {
      if (!s.has(defId)) return s;
      const next = new Set(s);
      next.delete(defId);
      return next;
    });

  // Header row: the panel's name + the in-card ⚙ — present on the empty state too, since that's
  // exactly when you'd head to settings to add training.
  const head = (
    <div className="dock-acc__head">
      <span className="dock-acc__head-title">{t("recurring.titleRoutine", locale)}</span>
      {onOpenSettings && (
        <button className="card-gear" onClick={onOpenSettings} {...tip(t("dock.settings", locale))}>
          ⚙
        </button>
      )}
    </div>
  );
  if (rows.length === 0) {
    return (
      <div className="dock-acc">
        {head}
        <div className="dock-acc__empty">{t("routine.empty", locale)}</div>
      </div>
    );
  }
  const renderRow = (row: RoutineRow) => {
    const capped = row.ladder?.capped ?? false;
    const rowClass = capped ? " is-capped" : row.ready ? " is-ready" : " is-done";
    // A counting-down row's read buttons are locked until ready, unless the scroll unlocked an
    // early read. The scroll itself is dead once the row is ready (nothing to unlock).
    const isUnlocked = unlocked.has(row.defId);
    const locked = !row.ready && !isUnlocked;
    // The scroll is the read buttons' mirror: enabled exactly when they're locked (a read happened
    // and the gate is counting down), disabled whenever they're live. Tapping it unlocks an early
    // read, which flips both back.
    const skipBtn = (
      <button
        className="dock-acc__skip"
        disabled={!locked}
        onClick={() => unlockEarly(row.defId)}
        {...tip(t("routine.skipCooldown", locale))}
      >
        <ScrollIcon />
      </button>
    );
    return (
      <div className={`dock-acc__row${rowClass}`} key={row.defId}>
        <span className="dock-acc__main">
          <span className="dock-acc__name">{row.name}</span>
          {row.ladder && (
            <RungCurtain
              text={row.ladder.text}
              ladderId={row.ladder.ladderId}
              currentRung={row.ladder.rungLabel}
              onPick={(label) => onSetRung(row.defId, label)}
              locale={locale}
            />
          )}
        </span>
        {/* The gate readout — suppressed on a capped ladder (its gate has stopped; the trophy
            readout under the name says everything). */}
        {!capped && <span className={`dock-acc__val${row.ready ? " dock-ready" : " dock-muted"}`}>{row.text}</span>}
        {row.ladder ? (
          // Ladder row: ✓/✗ for the two read outcomes. Locked while counting down (re-enabled by
          // the scroll for an item-driven early read, which restamps from now). Gone only at the
          // cap (the inert trophy). The tooltip flips to spell out the early-read sense.
          !capped && (
            <span className="dock-acc__reads">
              <button
                className="dock-acc__done"
                disabled={locked}
                onClick={() => {
                  onRead(row.defId, true);
                  clearUnlock(row.defId);
                }}
                {...tip(row.ready ? t("routine.readSuccessReady", locale) : t("routine.readSuccessEarly", locale))}
              >
                ✓
              </button>
              <button
                className="dock-acc__fail"
                disabled={locked}
                onClick={() => {
                  onRead(row.defId, false);
                  clearUnlock(row.defId);
                }}
                {...tip(row.ready ? t("routine.readFailReady", locale) : t("routine.readFailEarly", locale))}
              >
                ✗
              </button>
              {skipBtn}
            </span>
          )
        ) : (
          // Plain gate row: the single ✓ (locked while counting down, scroll-unlockable for an
          // item-driven early "done"), with the same scroll affordance as the ladder rows.
          <span className="dock-acc__reads">
            <button
              className="dock-acc__done"
              disabled={locked}
              onClick={() => {
                onDone(row.defId);
                clearUnlock(row.defId);
              }}
              {...tip(row.ready ? t("routine.markDoneReady", locale) : t("routine.markDoneEarly", locale))}
            >
              ✓
            </button>
            {skipBtn}
          </span>
        )}
      </div>
    );
  };

  // The Skill Books band sub-grouped by school (the Build tree), each under a "Race - School" header.
  // Schools appear in first-seen (catalog) order, rows kept in order within each; the sub-header shows
  // only for a real school, so the generic unclassified "Skill Books" seed (no school) renders flat.
  const renderBooks = (bookRows: RoutineRow[]) => {
    const order: string[] = [];
    const bySchool = new Map<string, RoutineRow[]>();
    for (const r of bookRows) {
      const key = r.school ?? "";
      if (!bySchool.has(key)) {
        bySchool.set(key, []);
        order.push(key);
      }
      bySchool.get(key)!.push(r);
    }
    // Resolve the Race prefix per-locale (PRD #77, slice #83 wires up the live locale); `key` (the
    // school/Build) is already resolved upstream in useRecurring. No race → just the school.
    const raceLabel = race ? displayName(raceKey(race), locale) : undefined;
    return order.map((key) => (
      <div className="dock-acc__school" key={key || "_"}>
        {key && <div className="dock-acc__school-head">{raceLabel ? `${raceLabel} - ${key}` : key}</div>}
        {bySchool.get(key)!.map(renderRow)}
      </div>
    ));
  };

  // Group rows into the three bands (in `SECTIONS` order), keeping catalog order within each. Headers
  // show only when more than one band is non-empty — a chores-only (unclassified) Character reads flat.
  const banded = SECTIONS.map((s) => ({ ...s, rows: rows.filter((r) => r.section === s.key) })).filter(
    (s) => s.rows.length > 0,
  );
  const showHeaders = banded.length > 1;
  return (
    <div className="dock-acc">
      {head}
      {banded.map((band) => (
        <div className={`dock-acc__section dock-acc__section--${band.key}`} key={band.key}>
          {showHeaders && <div className="dock-acc__section-head">{t(band.labelKey, locale)}</div>}
          {band.key === "books" ? renderBooks(band.rows) : band.rows.map(renderRow)}
        </div>
      ))}
    </div>
  );
}
