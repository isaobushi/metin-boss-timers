mod store_iap;

// Quit the whole app. The overlay window is frameless (no titlebar close button), so
// the in-app ✕ triggers this; exiting the process closes a still-open settings window too.
#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
  app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_os::init())
    .plugin(tauri_plugin_store::Builder::new().build())
    .invoke_handler(tauri::generate_handler![
      quit_app,
      store_iap::read_store_license,
      store_iap::store_purchase
    ])
    .setup(|app| {
      // Global hotkeys are desktop-only; the default builder forwards fired shortcuts
      // to JS, where overlay/hotkeys.ts registers/unregisters per active boss.
      #[cfg(desktop)]
      app.handle().plugin(tauri_plugin_global_shortcut::Builder::new().build())?;
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
