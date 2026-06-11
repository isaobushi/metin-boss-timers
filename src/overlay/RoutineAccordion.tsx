import type { RoutineSection } from "../engine/recurring";
import { displayName, type Locale } from "../engine/contentCatalog";
import { raceKey } from "../engine/contentKeys";
import { RungCurtain } from "./RungCurtain";
import type { RoutineRow } from "./useRecurring";

/** The Routine bands in display order (#57): race Abilities first, then Languages, then the universals. */
const SECTIONS: { key: RoutineSection; label: string }[] = [
  { key: "books", label: "Skill Books" },
  { key: "languages", label: "Languages" },
  { key: "chores", label: "Utilities" },
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
 * ✗ a failed read (book burned, gate restamped, no advance). The gesture keeps the plain gate's
 * permissive "read early" — in-game items can skip/shorten the 24h cooldown, so a read really can
 * happen while the gate counts down; the buttons stay live and read as an explicit "skipped the
 * cooldown" early read (dimmed while counting down). The #46 curtain corrects any mistaken advance.
 * A **capped** ladder is the inert trophy end state: no gesture, no gate countdown — just the
 * `… ✓ max` readout (still tappable, since the curtain is the misclick fix).
 *
 * The rows are banded into the three Routine sections (#57) — **Skill Books** (the race-filtered
 * class Abilities), **Languages**, **Chores** (the universal gates + any plain user-added one) —
 * each under a quiet header, so a classified Character's race subset reads as its own section. The
 * headers appear only when more than one section is present: an unclassified Character (chores only)
 * stays a clean flat list. Within Skill Books the Abilities sub-group by *school* (the Build tree),
 * each under a "Race - School" header (e.g. "Sura - Black Magic") — the only band that sub-groups.
 * Row rendering is identical across sections.
 */
export function RoutineAccordion({ rows, race, locale, onDone, onRead, onSetRung }: Props) {
  if (rows.length === 0) {
    return (
      <div className="dock-acc">
        <div className="dock-acc__empty">no routine items yet</div>
      </div>
    );
  }
  const renderRow = (row: RoutineRow) => {
    const capped = row.ladder?.capped ?? false;
    const rowClass = capped ? " is-capped" : row.ready ? " is-ready" : " is-done";
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
            />
          )}
        </span>
        {/* The gate readout — suppressed on a capped ladder (its gate has stopped; the trophy
            readout under the name says everything). */}
        {!capped && <span className={`dock-acc__val${row.ready ? " dock-ready" : " dock-muted"}`}>{row.text}</span>}
        {row.ladder ? (
          // Ladder row: ✓/✗ for the two read outcomes, live whether or not the gate is ready —
          // in-game skips mean a read can happen mid-cooldown. While counting down they read as
          // an explicit "skipped the cooldown" early read (restamps from now). Gone only at the
          // cap (the inert trophy). The tooltip flips to spell out the early-read sense.
          !capped && (
            <span className="dock-acc__reads">
              <button
                className="dock-acc__done"
                onClick={() => onRead(row.defId, true)}
                title={
                  row.ready
                    ? "successful read — advance the rung and restamp the 24h gate"
                    : "read now (skipped the cooldown) — advance the rung and restamp from now"
                }
              >
                ✓
              </button>
              <button
                className="dock-acc__fail"
                onClick={() => onRead(row.defId, false)}
                title={
                  row.ready
                    ? "failed read — book burned, no advance; restamp the 24h gate"
                    : "read now (skipped the cooldown) but failed — book burned, no advance; restamp from now"
                }
              >
                ✗
              </button>
            </span>
          )
        ) : (
          // Plain gate row: the unchanged single ✓, with the permissive "done early" affordance.
          <button
            className="dock-acc__done"
            onClick={() => onDone(row.defId)}
            title={row.ready ? "mark done — restamp a full cycle from now" : "done early — restamp from now (forfeits the wait)"}
          >
            ✓
          </button>
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
      {banded.map((band) => (
        <div className="dock-acc__section" key={band.key}>
          {showHeaders && <div className="dock-acc__section-head">{band.label}</div>}
          {band.key === "books" ? renderBooks(band.rows) : band.rows.map(renderRow)}
        </div>
      ))}
    </div>
  );
}
