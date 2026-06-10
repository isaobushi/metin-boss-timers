import { useState } from "react";
import type { Entitlement } from "../engine/entitlement";
import { PLAN_PRICE, type Plan } from "./purchaseFlow";

type Props = {
  entitlement: Entitlement;
  onStartTrial: () => void;
  onSubscribe: (plan: Plan) => void;
  onClose: () => void;
};

// What Pro unlocks — the curated, per-patch game-knowledge + scale that costs ongoing upkeep (PRD #48).
// Framed as the value of a maintained app, never "a dungeon a month".
const PRO_UNLOCKS = [
  "Prebuilt dungeon sequences — Templum Serpens & more",
  "Your whole stable — unlimited character profiles",
  "Skill catalog autofilled by race & empire",
  "Per-ability ladders — M1→G1 books-remaining tracking",
  "Every cap lifted — bosses, reminders, characters",
];

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
export function SubscribeScreen({ entitlement, onStartTrial, onSubscribe, onClose }: Props) {
  const [plan, setPlan] = useState<Plan>("annual"); // annual is the default selection
  const trialEligible = entitlement === "never"; // the Store grants the 7-day trial once, to new users

  const lede =
    entitlement === "trial"
      ? "You're trying Pro free. Lock it in to keep your stable when the trial ends."
      : entitlement === "lapsed"
        ? "Welcome back. Resubscribe to instantly thaw your frozen stable — nothing was lost."
        : entitlement === "subscribed"
          ? "You're Pro. Thanks for keeping the app growing."
          : "The maintained, growing Pro app — curated dungeon knowledge, for your whole stable.";

  return (
    <div className="panel subscribe">
      <div className="panel__title" data-tauri-drag-region>
        DUNGEONAID PRO
      </div>
      <p className="subscribe__lede">{lede}</p>

      <ul className="subscribe__unlocks">
        {PRO_UNLOCKS.map((u) => (
          <li key={u}>{u}</li>
        ))}
      </ul>

      {entitlement === "subscribed" ? (
        <button className="subscribe__primary" onClick={onClose}>
          Done
        </button>
      ) : (
        <>
          <div className="subscribe__plans" role="radiogroup" aria-label="Subscription plan">
            <button
              role="radio"
              aria-checked={plan === "annual"}
              className={`subscribe__plan${plan === "annual" ? " is-selected" : ""}`}
              onClick={() => setPlan("annual")}
            >
              <span className="subscribe__plan-tag">BEST VALUE</span>
              <span className="subscribe__plan-name">Annual</span>
              <span className="subscribe__plan-price">{PLAN_PRICE.annual}</span>
            </button>
            <button
              role="radio"
              aria-checked={plan === "monthly"}
              className={`subscribe__plan${plan === "monthly" ? " is-selected" : ""}`}
              onClick={() => setPlan("monthly")}
            >
              <span className="subscribe__plan-name">Monthly</span>
              <span className="subscribe__plan-price">{PLAN_PRICE.monthly}</span>
            </button>
          </div>

          {trialEligible ? (
            <>
              <button className="subscribe__primary" onClick={onStartTrial}>
                Start 7-day free trial
              </button>
              <button className="subscribe__secondary" onClick={() => onSubscribe(plan)}>
                or subscribe now — {plan === "annual" ? PLAN_PRICE.annual : PLAN_PRICE.monthly}
              </button>
            </>
          ) : (
            <button className="subscribe__primary" onClick={() => onSubscribe(plan)}>
              {entitlement === "lapsed" ? "Resubscribe" : "Subscribe"} — {plan === "annual" ? PLAN_PRICE.annual : PLAN_PRICE.monthly}
            </button>
          )}

          <button className="subscribe__close" onClick={onClose}>
            Not now
          </button>
        </>
      )}
    </div>
  );
}
