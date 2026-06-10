// The in-app purchase flow (PRD #48, issue #58) — the seam that would drive the Microsoft Store's
// subscription purchase / trial-start UI. It is STUBBED here: the real flow needs the Partner Center
// subscription add-on and Store identity (#16, HITL), which can't be built in-repo. The stub lets the
// subscribe screen be built and demoed end-to-end now; the real path replaces `runStorePurchase`.
//
// In production the happy path is: this flow opens the Store purchase dialog → on success Windows
// updates the OS-cached license → the `storeLicense` adapter (#55) re-reads it and the gate unlocks.
// The stub short-circuits that loop by reporting the entitlement the purchase WOULD grant, so the
// caller can reflect the unlock immediately (in dev via the entitlement dev-setter).
import type { Entitlement } from "../engine/entitlement";

/** The two subscription options. Annual is the default (surfaced first); monthly is the $1 fallback. */
export type Plan = "annual" | "monthly";

/** Placeholder prices — the exact annual price is out of scope per the PRD; set in Partner Center (#58). */
export const PLAN_PRICE: Record<Plan, string> = {
  annual: "$9.99 / year",
  monthly: "$1 / month",
};

/** What a purchase/trial attempt yields. `ok` carries the entitlement the user is now on. */
export type PurchaseResult = { ok: true; entitlement: Entitlement } | { ok: false; reason: "cancelled" | "error" };

/**
 * Run the actual Store purchase for a given Store product. TODO(#16/#58): invoke the Windows Store
 * IAP for `product` (the subscription add-on's annual/monthly SKU, or the trial). Until that exists,
 * the stub reports success with the entitlement the action would grant, so the screen is fully demoable.
 */
async function runStorePurchase(product: Plan | "trial"): Promise<PurchaseResult> {
  return { ok: true, entitlement: product === "trial" ? "trial" : "subscribed" };
}

/** Start the 7-day free trial. Resolves to `trial` on success. */
export const startTrial = (): Promise<PurchaseResult> => runStorePurchase("trial");

/** Subscribe on the chosen plan. Both plans grant `subscribed`; the plan picks the Store SKU/price. */
export const subscribe = (plan: Plan): Promise<PurchaseResult> => runStorePurchase(plan);
