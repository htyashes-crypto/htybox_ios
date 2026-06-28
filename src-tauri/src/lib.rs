#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  use tauri::Manager;

  tauri::Builder::default()
    .plugin(tauri_plugin_barcode_scanner::init())
    .setup(|app| {
      let salt_path = app
        .path()
        .app_local_data_dir()
        .expect("could not resolve app local data path")
        .join("stronghold-salt.txt");
      app.handle()
        .plugin(tauri_plugin_stronghold::Builder::with_argon2(&salt_path).build())?;

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
