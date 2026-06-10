import { RungCurtain } from "./RungCurtain";
import type { RoutineRow } from "./useRecurring";

type Props = {
  /** The gate routine items, projected with their live state (see `useRecurring`). */
  rows: RoutineRow[];
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
 */
export function RoutineAccordion({ rows, onDone, onRead, onSetRung }: Props) {
  if (rows.length === 0) {
    return (
      <div className="dock-acc">
        <div className="dock-acc__empty">no routine items yet</div>
      </div>
    );
  }
  return (
    <div className="dock-acc">
      {rows.map((row) => {
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
            {!capped && (
              <span className={`dock-acc__val${row.ready ? " dock-ready" : " dock-muted"}`}>{row.text}</span>
            )}
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
      })}
    </div>
  );
}
