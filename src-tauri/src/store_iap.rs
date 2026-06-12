// Microsoft Store IAP commands (PRD #48, issue #58) — the Rust half of the two TS seams:
// `read_store_license` feeds the #55 adapter (overlay/entitlementSource.ts) and `store_purchase`
// drives overlay/purchaseFlow.ts. Both are Windows-only (`Windows.Services.Store`); every other
// platform answers "unsupported" so the TS side can keep its dev-stub behavior without platform
// sniffing or extra capabilities.
//
// Trust story (ADR-0002): `read_store_license` is a LOCAL read of the OS-cached app license —
// `GetAppLicenseAsync` never hits the network from this binary; Windows refreshes the cache in the
// background. `store_purchase` opens the Store's own purchase dialog (the one OS-mediated exception).
//
// Both commands return plain status strings rather than structured errors: the TS adapters fold any
// failure into their fail-open paths ("unverifiable" / "error"), so Rust-side detail would be unused.

/// The two Pro subscription add-ons' Store IDs (Partner Center, see purchaseFlow.ts PLAN_STORE_ID —
/// keep in sync). License entries key off the SKU Store ID ("9MT2ZXJL1P1N/0010"), hence prefix-match;
/// the product IDs (InAppOfferToken) are matched too, as a fallback shape.
#[cfg(windows)]
const PRO_STORE_IDS: [&str; 2] = ["9MT2ZXJL1P1N", "9PNLM89SZ2NL"];
#[cfg(windows)]
const PRO_OFFER_TOKENS: [&str; 2] = ["dragonsaid_pro_annual", "dragonsaid_pro_monthly"];

/// Read the OS-cached Store license for the Pro add-ons.
/// Returns "active" | "expired" | "absent" | "unverifiable" | "unsupported".
#[tauri::command]
pub async fn read_store_license() -> String {
  #[cfg(windows)]
  {
    // The WinRT `.join()` waits block; keep them off the async runtime's core threads.
    return tauri::async_runtime::spawn_blocking(win::read_license)
      .await
      .unwrap_or_else(|_| "unverifiable".into());
  }
  #[cfg(not(windows))]
  "unsupported".into()
}

/// Run the Store purchase dialog for `store_id` (an add-on Store ID), attached to the calling window.
/// Returns "succeeded" | "alreadyPurchased" | "cancelled" | "error" | "unsupported".
#[tauri::command]
pub async fn store_purchase(window: tauri::Window, store_id: String) -> String {
  #[cfg(windows)]
  {
    // The purchase dialog needs a window to parent to (IInitializeWithWindow) — a Win32 app has no
    // CoreWindow for the Store UI to find on its own. Grab the HWND here (Window isn't needed after),
    // as a plain isize so this module's `windows` crate version never has to match tauri's.
    let hwnd = match window.hwnd() {
      Ok(h) => h.0 as isize,
      Err(_) => return "error".into(),
    };
    return tauri::async_runtime::spawn_blocking(move || win::purchase(hwnd, &store_id))
      .await
      .unwrap_or_else(|_| "error".into());
  }
  #[cfg(not(windows))]
  {
    let _ = (window, store_id);
    "unsupported".into()
  }
}

#[cfg(windows)]
mod win {
  use super::{PRO_OFFER_TOKENS, PRO_STORE_IDS};
  use windows::core::{Interface, HSTRING};
  use windows::Services::Store::{StoreContext, StorePurchaseStatus};
  use windows::Win32::Foundation::HWND;
  use windows::Win32::UI::Shell::IInitializeWithWindow;

  pub fn read_license() -> String {
    // Any failure (unpackaged dev run, Store service hiccup) is "unverifiable" — the TS adapter's
    // fail-open grace handles it; we never guess a definitive state from an error.
    read_license_inner().unwrap_or_else(|_| "unverifiable".into())
  }

  fn read_license_inner() -> windows::core::Result<String> {
    let ctx = StoreContext::GetDefault()?;
    // .join() = the blocking wait (windows-future 0.3 renamed .get()); we're on a blocking thread.
    let license = ctx.GetAppLicenseAsync()?.join()?;
    let addons = license.AddOnLicenses()?;
    // Manual IMapView walk (HSTRING → StoreLicense): "active" if ANY Pro add-on license is live,
    // "expired" if Pro entries exist but none live (the definitive lapse the mapper freezes on),
    // "absent" if the user never had one (TS folds that to unverifiable → grace decides never/Pro).
    let mut matched = false;
    let mut active = false;
    let iter = addons.First()?;
    while iter.HasCurrent()? {
      let entry = iter.Current()?.Value()?;
      let sku = entry.SkuStoreId().map(|s| s.to_string()).unwrap_or_default();
      let token = entry.InAppOfferToken().map(|s| s.to_string()).unwrap_or_default();
      let ours = PRO_STORE_IDS.iter().any(|id| sku.starts_with(id))
        || PRO_OFFER_TOKENS.iter().any(|t| token == *t);
      if ours {
        matched = true;
        if entry.IsActive().unwrap_or(false) {
          active = true;
        }
      }
      iter.MoveNext()?;
    }
    Ok(if active { "active" } else if matched { "expired" } else { "absent" }.into())
  }

  pub fn purchase(hwnd: isize, store_id: &str) -> String {
    purchase_inner(hwnd, store_id).unwrap_or_else(|_| "error".into())
  }

  fn purchase_inner(hwnd: isize, store_id: &str) -> windows::core::Result<String> {
    let ctx = StoreContext::GetDefault()?;
    // Parent the Store dialog to our window — without this, RequestPurchaseAsync fails in Win32 apps.
    let init: IInitializeWithWindow = ctx.cast()?;
    unsafe { init.Initialize(HWND(hwnd as *mut _))? };
    let result = ctx.RequestPurchaseAsync(&HSTRING::from(store_id))?.join()?;
    let status = result.Status()?;
    Ok(
      if status == StorePurchaseStatus::Succeeded {
        "succeeded"
      } else if status == StorePurchaseStatus::AlreadyPurchased {
        "alreadyPurchased"
      } else if status == StorePurchaseStatus::NotPurchased {
        "cancelled" // the user closed the dialog without buying — not an error
      } else {
        "error" // NetworkError / ServerError — the Store itself couldn't complete it
      }
      .into(),
    )
  }
}
