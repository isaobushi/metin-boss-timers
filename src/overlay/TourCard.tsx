import { useState } from "react";
import { t } from "../engine/chrome";
import type { Locale } from "../engine/localeTypes";
import { advanceTour, initialTour, type TourEvent } from "../engine/tourMachine";
import { TOUR_STEPS } from "../engine/tourSteps";

type Props = {
  onFinish: () => void;
  onSkip: () => void;
  /** The active content locale — resolves chrome strings per-locale. Required so a new call site can't silently un-localize. */
  locale: Locale;
};

/**
 * The first-run coach card (PRD #63, slice #70) — walks the 8 tourSteps beats as descriptive copy
 * with Back / Next / Skip and a step counter. It renders below the dock in the exclusive-panel
 * slot (ADR-0003: the tour lives in the dock shell, no new routing concept). Step state is local
 * and ephemeral on purpose: only the seen/unseen gate persists (slice 1), so an app restart
 * mid-tour restarts it from the top rather than resuming half-told.
 *
 * Slice 3 (#71) adds the spotlight + panel driving from each step's dockSegment/panelToOpen; the
 * exits stay as they are: Finish (next on the last beat), Skip (offered on every beat), and App's
 * click-a-tool escape hatch all funnel into the slice-1 gate via onFinish/onSkip.
 *
 * Deliberately no scrim: the game must stay visible behind the overlay (a dim layer would black out
 * the transparent window the app floats over).
 */
export function TourCard({ onFinish, onSkip, locale }: Props) {
  const [tour, setTour] = useState(initialTour);
  const step = TOUR_STEPS[tour.index];
  const last = tour.index === TOUR_STEPS.length - 1;

  // Terminal events exit through the slice-1 gate (mark seen + persist); the rest just move.
  const dispatch = (ev: TourEvent) => {
    const next = advanceTour(tour, ev, TOUR_STEPS.length);
    if (next.done) (ev === "skip" ? onSkip : onFinish)();
    else setTour(next);
  };

  return (
    <div className="dock-acc tour-card" role="dialog" aria-label={t(step.copy.title, locale)}>
      <div className="tour-card__head">
        <p className="tour-card__title">{t(step.copy.title, locale)}</p>
        <span className="tour-card__counter">
          {tour.index + 1} / {TOUR_STEPS.length}
        </span>
      </div>
      <p className="tour-card__body">{t(step.copy.body, locale)}</p>
      <div className="tour-card__actions">
        <button className="tour-card__skip" onClick={() => dispatch("skip")}>
          {t("tour.skip", locale)}
        </button>
        <div className="tour-card__nav">
          <button className="tour-card__back" onClick={() => dispatch("back")} disabled={tour.index === 0}>
            {t("tour.back", locale)}
          </button>
          <button className="tour-card__finish" onClick={() => dispatch(last ? "finish" : "next")}>
            {last ? t("tour.finish", locale) : t("tour.next", locale)}
          </button>
        </div>
      </div>
    </div>
  );
}
