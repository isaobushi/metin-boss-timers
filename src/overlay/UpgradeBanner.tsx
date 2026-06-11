import type { Entitlement } from "../engine/entitlement";
import { t, type ChromeKey } from "../engine/chrome";
import type { Locale } from "../engine/localeTypes";

/** Banner copy per non-subscribed state — one typed entry pairs label and CTA, exhaustive by type. */
const COPY: Record<Exclude<Entitlement, "subscribed">, { labelKey: ChromeKey; ctaKey: ChromeKey }> = {
  trial: { labelKey: "banner.trialLabel", ctaKey: "banner.trialCta" },
  lapsed: { labelKey: "banner.lapsedLabel", ctaKey: "banner.lapsedCta" },
  never: { labelKey: "banner.neverLabel", ctaKey: "banner.neverCta" },
};

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
  const { labelKey, ctaKey } = COPY[entitlement];
  return (
    <div className={`upgrade-banner upgrade-banner--${entitlement}`}>
      <span className="upgrade-banner__label">{t(labelKey, locale)}</span>
      <button className="upgrade-banner__cta" onClick={onOpen}>
        {t(ctaKey, locale)}
      </button>
    </div>
  );
}
