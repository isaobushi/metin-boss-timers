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
 * for a two-outcome **✓/✗** read gesture, but only while its gate is **ready**: a ladder row
 * deliberately drops the plain gate's permissive "done early", because you cannot read the same book
 * twice in 24h and `position` is real progress data, so it shows just the countdown + readout while
 * the gate counts down. A **capped** ladder is the inert trophy end state: no gesture, no gate
 * countdown — just the `… ✓ max` readout (still tappable, since the curtain is the misclick fix).
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
              // Ladder row: ✓/✗ only when the gate is ready (no early logging — it would record a
              // read that couldn't have happened); nothing while it counts down or once capped.
              !capped &&
              row.ready && (
                <span className="dock-acc__reads">
                  <button
                    className="dock-acc__done"
                    onClick={() => onRead(row.defId, true)}
                    title="successful read — advance the rung and restamp the 24h gate"
                  >
                    ✓
                  </button>
                  <button
                    className="dock-acc__fail"
                    onClick={() => onRead(row.defId, false)}
                    title="failed read — book burned, no advance; restamp the 24h gate"
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
