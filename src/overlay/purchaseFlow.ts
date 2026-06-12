// The in-app purchase flow (PRD #48, issue #58) — drives the Microsoft Store's subscription
// purchase / trial-start dialog via the Rust `store_purchase` command (src-tauri/src/store_iap.rs).
//
// The production happy path: this flow opens the Store purchase dialog → on success Windows updates
// the OS-cached license → `confirmPurchase` (the #55 adapter) stamps grace + the trial window and
// re-reads the license, so the gate unlocks at runtime exactly as the screen promises.
//
// Runs with no Store keep the old stub behavior: the web demo and non-Windows Tauri report success
// with the entitlement the purchase WOULD grant (reflected via the dev entitlement setter), so the
// screen stays fully demoable end-to-end.
import { invoke, isTauri } from "@tauri-apps/api/core";
import { type Entitlement, isPro } from "../engine/entitlement";
import { confirmPurchase, resolveLaunchEntitlement } from "./entitlementSource";

/** The two subscription options. Annual is the default (surfaced first); monthly is the cheap fallback. */
export type Plan = "annual" | "monthly";

/**
 * Display prices, hardcoded in EUR (set in Partner Center 2026-06-12). The Store's own purchase
 * dialog always shows the buyer's localized price — these label our screen only.
 */
export const PLAN_PRICE: Record<Plan, string> = {
  annual: "€5.99 / year",
  monthly: "€1.79 / month",
};

/**
 * The subscription add-ons' Store IDs (Partner Center: dragonsaid_pro_annual / dragonsaid_pro_monthly;
 * keep in sync with PRO_STORE_IDS in src-tauri/src/store_iap.rs).
 */
const PLAN_STORE_ID: Record<Plan, string> = {
  annual: "9MT2ZXJL1P1N",
  monthly: "9PNLM89SZ2NL",
};

/**
 * The SKU a trial-start purchases: the 7-day trial is configured on the ANNUAL add-on only (Partner
 * Center), so "start trial" buys the annual SKU and the Store presents the trial offer in its own
 * dialog. Load-bearing — if a dedicated trial SKU ever exists, change it HERE.
 */
const TRIAL_STORE_ID = PLAN_STORE_ID.annual;

/** What a purchase/trial attempt yields. `ok` carries the entitlement the user is now on. */
export type PurchaseResult = { ok: true; entitlement: Entitlement } | { ok: false; reason: "cancelled" | "error" };

/** What the Rust `store_purchase` command reports. */
type RawPurchaseStatus = "succeeded" | "alreadyPurchased" | "cancelled" | "error" | "unsupported";

/**
 * Run the actual Store purchase for a given product (the subscription add-on's annual/monthly SKU;
 * the trial rides the annual one). Non-Store runs short-circuit to success with the entitlement the
 * action would grant.
 */
async function runStorePurchase(product: Plan | "trial"): Promise<PurchaseResult> {
  const granted = product === "trial" ? "trial" : "subscribed";
  if (!isTauri()) return { ok: true, entitlement: granted }; // web demo / npm run dev — no Store exists
  try {
    const storeId = product === "trial" ? TRIAL_STORE_ID : PLAN_STORE_ID[product];
    const status = await invoke<RawPurchaseStatus>("store_purchase", { storeId });
    if (status === "unsupported") return { ok: true, entitlement: granted }; // Tauri-on-macOS dev
    if (status === "succeeded") return { ok: true, entitlement: await confirmPurchase(granted) };
    if (status === "alreadyPurchased") {
      // The user already owns the subscription — a running trial IS ownership of the add-on, so a
      // mid-trial Subscribe (or a reinstall's re-tap) lands here. Re-resolve from the license and
      // the UNTOUCHED trial stamp; stamping `subscribed` here would relabel an active trial as paid
      // and kill the trial-ending nudge (review of this PR). If the read isn't Pro, they paid: subscribed.
      const resolved = await resolveLaunchEntitlement();
      return { ok: true, entitlement: isPro(resolved) ? resolved : "subscribed" };
    }
    return { ok: false, reason: status === "cancelled" ? "cancelled" : "error" };
  } catch {
    return { ok: false, reason: "error" }; // invoke failed — treat like a Store error, never unlock
  }
}

/** Start the 7-day free trial. Resolves to `trial` on success. */
export const startTrial = (): Promise<PurchaseResult> => runStorePurchase("trial");

/** Subscribe on the chosen plan. Both plans grant `subscribed`; the plan picks the Store SKU/price. */
export const subscribe = (plan: Plan): Promise<PurchaseResult> => runStorePurchase(plan);
