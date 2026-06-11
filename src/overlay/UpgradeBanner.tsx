import type { Entitlement } from "../engine/entitlement";
import { t } from "../engine/chrome";
import type { Locale } from "../engine/localeTypes";

type Props = {
  entitlement: Entitlement;
  onOpen: () => void;
  /** The active content locale — resolves chrome strings per-locale. Required so a new call site can't silently un-localize. */
  locale: Locale;
};

/**
 * The trial-status / upgrade banner (PRD #48, issue #58) — a slim line below the dock that appears
 * whenever the user isn't subscribed, opening the subscribe screen. It's the standing, non-deceptive
 * entry to Pro; the cap-hit nudges (#56) are the other, contextual entry. Renders nothing for a
 * subscribed user. No gating logic — it just reads `entitlement` to pick its words.
 */
export function UpgradeBanner({ entitlement, onOpen, locale }: Props) {
  if (entitlement === "subscribed") return null;
  const labelKey = entitlement === "trial" ? "banner.trialLabel" : entitlement === "lapsed" ? "banner.lapsedLabel" : "banner.neverLabel";
  const ctaKey = entitlement === "trial" ? "banner.trialCta" : entitlement === "lapsed" ? "banner.lapsedCta" : "banner.neverCta";
  return (
    <div className={`upgrade-banner upgrade-banner--${entitlement}`}>
      <span className="upgrade-banner__label">{t(labelKey, locale)}</span>
      <button className="upgrade-banner__cta" onClick={onOpen}>
        {t(ctaKey, locale)}
      </button>
    </div>
  );
}
