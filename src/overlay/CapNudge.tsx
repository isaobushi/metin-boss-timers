import type { Mutation } from "../engine/entitlement";

type Props = {
  mutation: Mutation;
  onUpgrade: () => void;
  onDismiss: () => void;
};

// Per-cap copy: names the Lite limit just hit and exactly what Pro unlocks. Non-deceptive — it states
// the cap plainly and never implies the action will work after dismissing.
const COPY: Record<Mutation, string> = {
  addBoss: "Lite includes 1 custom boss. Pro lifts every cap — build as many boss sequences as you like.",
  addCharacter: "Lite is a single character. Pro unlocks your whole stable — unlimited profiles.",
  addReminder: "Lite includes 3 reminders. Pro lifts the cap so you can track every chore.",
};

/**
 * The cap-hit nudge (PRD #48, issue #56) — shown when a Lite user bumps a cap. It names the limit and
 * the Pro unlock, with one path up (Upgrade → subscribe screen) and a plain dismiss. No dark patterns:
 * the cap is stated honestly, the close is always there, nothing is pre-checked or guilt-framed.
 */
export function CapNudge({ mutation, onUpgrade, onDismiss }: Props) {
  return (
    <div className="cap-nudge" role="alert">
      <p className="cap-nudge__text">{COPY[mutation]}</p>
      <div className="cap-nudge__actions">
        <button className="cap-nudge__upgrade" onClick={onUpgrade}>
          See Pro
        </button>
        <button className="cap-nudge__dismiss" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
