import { useState } from "react";
import type { Entitlement } from "../engine/entitlement";
import { PLAN_PRICE, type Plan } from "./purchaseFlow";
import { t } from "../engine/chrome";
import type { Locale } from "../engine/localeTypes";

type Props = {
  entitlement: Entitlement;
  onStartTrial: () => void;
  onSubscribe: (plan: Plan) => void;
  onClose: () => void;
  /** The active content locale — resolves chrome strings per-locale. Required so a new call site can't silently un-localize. */
  locale: Locale;
};

/**
 * The in-app subscribe screen (PRD #48, issue #58). Presents the Pro pitch and the two plans —
 * **annual surfaced first as the default**, $1/month as the fallback — plus a 7-day free trial for new
 * users. The copy sells "the maintained, growing Pro app," never per-dungeon, and there are no dark
 * patterns (close is always available; the cheaper plan is shown plainly alongside the annual one).
 *
 * It carries NO gating logic — it reads the current `entitlement` only to frame itself (a never-paid
 * user gets the trial; a lapsed user gets a "resubscribe to thaw" message with no second trial; a
 * trial user is nudged to lock in Pro). Purchase/trial actions are handed up via props to the stubbed
 * `purchaseFlow`; on success the gate unlocks at runtime through the same entitlement state.
 */
export function SubscribeScreen({ entitlement, onStartTrial, onSubscribe, onClose, locale }: Props) {
  const [plan, setPlan] = useState<Plan>("annual"); // annual is the default selection
  const trialEligible = entitlement === "never"; // the Store grants the 7-day trial once, to new users

  const lede =
    entitlement === "trial"
      ? t("subscribe.ledeTrial", locale)
      : entitlement === "lapsed"
        ? t("subscribe.ledeLapsed", locale)
        : entitlement === "subscribed"
          ? t("subscribe.ledeSubscribed", locale)
          : t("subscribe.ledeDefault", locale);

  const proUnlocks = [
    t("subscribe.unlock1", locale),
    t("subscribe.unlock2", locale),
    t("subscribe.unlock3", locale),
    t("subscribe.unlock4", locale),
    t("subscribe.unlock5", locale),
  ];

  return (
    <div className="panel subscribe">
      <div className="panel__title" data-tauri-drag-region>
        {t("subscribe.title", locale)}
      </div>
      <p className="subscribe__lede">{lede}</p>

      <ul className="subscribe__unlocks">
        {proUnlocks.map((u) => (
          <li key={u}>{u}</li>
        ))}
      </ul>

      {entitlement === "subscribed" ? (
        <button className="subscribe__primary" onClick={onClose}>
          {t("subscribe.done", locale)}
        </button>
      ) : (
        <>
          <div className="subscribe__plans" role="radiogroup" aria-label={t("subscribe.planAriaLabel", locale)}>
            <button
              role="radio"
              aria-checked={plan === "annual"}
              className={`subscribe__plan${plan === "annual" ? " is-selected" : ""}`}
              onClick={() => setPlan("annual")}
            >
              <span className="subscribe__plan-tag">{t("subscribe.bestValue", locale)}</span>
              <span className="subscribe__plan-name">{t("subscribe.planAnnual", locale)}</span>
              <span className="subscribe__plan-price">{PLAN_PRICE.annual}</span>
            </button>
            <button
              role="radio"
              aria-checked={plan === "monthly"}
              className={`subscribe__plan${plan === "monthly" ? " is-selected" : ""}`}
              onClick={() => setPlan("monthly")}
            >
              <span className="subscribe__plan-name">{t("subscribe.planMonthly", locale)}</span>
              <span className="subscribe__plan-price">{PLAN_PRICE.monthly}</span>
            </button>
          </div>

          {trialEligible ? (
            <>
              <button className="subscribe__primary" onClick={onStartTrial}>
                {t("subscribe.startTrial", locale)}
              </button>
              <button className="subscribe__secondary" onClick={() => onSubscribe(plan)}>
                {t("subscribe.orSubscribeNow", locale)} — {plan === "annual" ? PLAN_PRICE.annual : PLAN_PRICE.monthly}
              </button>
            </>
          ) : (
            <button className="subscribe__primary" onClick={() => onSubscribe(plan)}>
              {entitlement === "lapsed" ? t("subscribe.resubscribe", locale) : t("subscribe.subscribe", locale)} — {plan === "annual" ? PLAN_PRICE.annual : PLAN_PRICE.monthly}
            </button>
          )}

          <button className="subscribe__close" onClick={onClose}>
            {t("subscribe.notNow", locale)}
          </button>
        </>
      )}
    </div>
  );
}
