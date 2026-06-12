import { t } from "../engine/chrome";
import type { Locale } from "../engine/localeTypes";

type Props = {
  onFinish: () => void;
  onSkip: () => void;
  /** The active content locale — resolves chrome strings per-locale. Required so a new call site can't silently un-localize. */
  locale: Locale;
};

/**
 * The first-run coach card (PRD #63, slice #68) — the PLACEHOLDER for the section tour. It renders
 * below the dock in the exclusive-panel slot (ADR-0003: the tour lives in the dock shell, no new
 * routing concept), with the two exits the real tour will keep: Finish and Skip, both of which mark
 * the tour seen forever. Later slices replace this single card with the spotlight step sequence
 * (tourMachine/tourSteps); the mount point and exit wiring stay.
 *
 * Deliberately no scrim: the game must stay visible behind the overlay (a dim layer would black out
 * the transparent window the app floats over).
 */
export function TourCard({ onFinish, onSkip, locale }: Props) {
  return (
    <div className="dock-acc tour-card" role="dialog" aria-label={t("tour.welcomeTitle", locale)}>
      <p className="tour-card__title">{t("tour.welcomeTitle", locale)}</p>
      <p className="tour-card__body">{t("tour.welcomeBody", locale)}</p>
      <div className="tour-card__actions">
        <button className="tour-card__finish" onClick={onFinish}>
          {t("tour.finish", locale)}
        </button>
        <button className="tour-card__skip" onClick={onSkip}>
          {t("tour.skip", locale)}
        </button>
      </div>
    </div>
  );
}
