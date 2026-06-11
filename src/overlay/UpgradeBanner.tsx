import type { Entitlement } from "../engine/entitlement";

type Props = {
  entitlement: Entitlement;
  onOpen: () => void;
};

// Per-state banner copy + the call to action. `subscribed` shows nothing (handled by the caller).
const COPY: Record<Exclude<Entitlement, "subscribed">, { label: string; cta: string }> = {
  trial: { label: "✦ Pro trial active", cta: "Keep Pro" },
  lapsed: { label: "✦ Pro paused — your stable is frozen", cta: "Resubscribe" },
  never: { label: "✦ Unlock DragonsAid Pro", cta: "Upgrade" },
};

/**
 * The trial-status / upgrade banner (PRD #48, issue #58) — a slim line below the dock that appears
 * whenever the user isn't subscribed, opening the subscribe screen. It's the standing, non-deceptive
 * entry to Pro; the cap-hit nudges (#56) are the other, contextual entry. Renders nothing for a
 * subscribed user. No gating logic — it just reads `entitlement` to pick its words.
 */
export function UpgradeBanner({ entitlement, onOpen }: Props) {
  if (entitlement === "subscribed") return null;
  const { label, cta } = COPY[entitlement];
  return (
    <div className={`upgrade-banner upgrade-banner--${entitlement}`}>
      <span className="upgrade-banner__label">{label}</span>
      <button className="upgrade-banner__cta" onClick={onOpen}>
        {cta}
      </button>
    </div>
  );
}
