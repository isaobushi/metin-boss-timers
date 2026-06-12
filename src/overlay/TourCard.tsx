import { useLayoutEffect, useState } from "react";
import { t } from "../engine/chrome";
import type { Locale } from "../engine/localeTypes";
import { advanceTour, initialTour, type TourEvent } from "../engine/tourMachine";
import { TOUR_STEPS, type TourStep } from "../engine/tourSteps";

type Props = {
  onFinish: () => void;
  onSkip: () => void;
  /**
   * Fires with the active step on mount and on every move (slice 3, #71) — App drives the real
   * shell from it (spotlight ring, exclusive panel, cooldown pin via tourDrive). Step state stays
   * local on purpose; this is the additive mirror, not a lift.
   */
  onStepChange: (step: TourStep) => void;
  /** The active content locale — resolves chrome strings per-locale. Required so a new call site can't silently un-localize. */
  locale: Locale;
};

/**
 * The first-run coach card (PRD #63, slice #70) — walks the 8 tourSteps beats with Back / Next /
 * Skip and a step counter. It anchors directly under the dock (ADR-0003: the tour lives in the
 * dock shell, no new routing concept) while the beat's LIVE panel opens below it — App reacts to
 * onStepChange and drives the real shell (slice 3, #71), so the ringed glyph above and its working
 * tool below are both visible while the card explains them. Step state is local and ephemeral on
 * purpose: only the seen/unseen gate persists (slice 1), so an app restart mid-tour restarts it
 * from the top rather than resuming half-told.
 *
 * The exits: Finish (next on the last beat), Skip (offered on every beat), and App's click-a-tool
 * escape hatch all funnel into the slice-1 gate via onFinish/onSkip.
 *
 * Deliberately no scrim: the game must stay visible behind the overlay (a dim layer would black out
 * the transparent window the app floats over). Focus is the positive ring on the glyph, nothing else.
 */
export function TourCard({ onFinish, onSkip, onStepChange, locale }: Props) {
  const [tour, setTour] = useState(initialTour);
  const step = TOUR_STEPS[tour.index];
  const last = tour.index === TOUR_STEPS.length - 1;

  // Mirror the active beat up to App before paint (layout, not passive, effect): the shell must
  // re-drive panel state in the same frame, or a beat change — and especially mount over lingering
  // pre-tour panel state — would flash the wrong panel for a frame.
  useLayoutEffect(() => {
    onStepChange(step);
  }, [step, onStepChange]);

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
