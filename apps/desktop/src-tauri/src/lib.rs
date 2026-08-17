use chrono::{Datelike, Local, NaiveDate, NaiveTime, TimeZone, Utc};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager, State, WindowEvent,
};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_notification::NotificationExt;

fn api(server_address: &str, path: &str) -> Result<String, String> {
    let address = server_address.trim();
    if address.is_empty() {
        return Err("Server address is required".to_string());
    }
    let base = if address.starts_with("http://") || address.starts_with("https://") {
        address.trim_end_matches('/').to_string()
    } else {
        format!("http://{}:8000", address.trim_end_matches('/'))
    };
    reqwest::Url::parse(&base).map_err(|_| "Enter a valid server IP address or URL".to_string())?;
    Ok(format!("{base}/api/v1/{path}"))
}
#[derive(Debug, Serialize, Deserialize, Clone)]
struct Occurrence {
    id: String,
    reminder_id: String,
    title: String,
    description: Option<String>,
    #[serde(rename = "type")]
    kind: String,
    priority: String,
    scheduled_date: String,
    scheduled_at: String,
    due_at: String,
    status: String,
    snoozed_until: Option<String>,
    completed_at: Option<String>,
    updated_at: String,
}
#[derive(Debug, Serialize, Deserialize, Clone)]
struct ReminderDefinition {
    id: String,
    title: String,
    description: Option<String>,
    #[serde(rename = "type")]
    kind: String,
    reminder_time: String,
    secondary_reminder_time: Option<String>,
    monthly_due_day: Option<u32>,
    days_before: i64,
    priority: String,
    is_active: bool,
    updated_at: String,
}
#[derive(Debug, Deserialize)]
struct ReminderPage {
    items: Vec<ReminderDefinition>,
}
#[derive(Debug, Serialize, Clone)]
struct ReminderDelivery {
    occurrence: Occurrence,
}
struct Db(Mutex<Connection>);
fn migrate(c: &Connection) -> rusqlite::Result<()> {
    c.execute_batch("CREATE TABLE IF NOT EXISTS occurrences(id TEXT PRIMARY KEY,payload TEXT NOT NULL,updated_at TEXT NOT NULL,notified_trigger TEXT);CREATE TABLE IF NOT EXISTS reminder_definitions(id TEXT PRIMARY KEY,payload TEXT NOT NULL,updated_at TEXT NOT NULL);CREATE TABLE IF NOT EXISTS outbox(id TEXT PRIMARY KEY,kind TEXT NOT NULL,occurrence_id TEXT NOT NULL,payload TEXT NOT NULL,created_at TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0);CREATE TABLE IF NOT EXISTS sync_state(key TEXT PRIMARY KEY,value TEXT NOT NULL);")?;
    let _ = c.execute(
        "ALTER TABLE occurrences ADD COLUMN notified_trigger TEXT",
        [],
    );
    Ok(())
}
fn replace_definitions(c: &Connection, items: &[ReminderDefinition]) -> Result<(), String> {
    let active_ids = items
        .iter()
        .filter(|item| item.is_active)
        .map(|item| item.id.as_str())
        .collect::<HashSet<_>>();
    let removable_occurrences = {
        let mut statement = c
            .prepare("SELECT id,payload FROM occurrences")
            .map_err(|error| error.to_string())?;
        let rows = statement
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(|error| error.to_string())?
            .filter_map(Result::ok)
            .filter_map(|(id, payload)| {
                let occurrence = serde_json::from_str::<Occurrence>(&payload).ok()?;
                (!active_ids.contains(occurrence.reminder_id.as_str())
                    || occurrence.status == "PENDING")
                    .then_some(id)
            })
            .collect::<Vec<_>>();
        rows
    };
    let tx = c
        .unchecked_transaction()
        .map_err(|error| error.to_string())?;
    for id in removable_occurrences {
        tx.execute("DELETE FROM occurrences WHERE id=?1", [id])
            .map_err(|error| error.to_string())?;
    }
    tx.execute("DELETE FROM reminder_definitions", [])
        .map_err(|error| error.to_string())?;
    for item in items {
        tx.execute(
            "INSERT INTO reminder_definitions(id,payload,updated_at) VALUES(?1,?2,?3)",
            params![
                item.id,
                serde_json::to_string(item).unwrap(),
                item.updated_at
            ],
        )
        .map_err(|error| error.to_string())?;
    }
    tx.execute(
        "INSERT INTO sync_state(key,value) VALUES('last_definition_sync',?1) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        [Utc::now().to_rfc3339()],
    ).map_err(|error| error.to_string())?;
    tx.commit().map_err(|error| error.to_string())
}
fn parse_time(value: &str) -> Option<NaiveTime> {
    NaiveTime::parse_from_str(value, "%H:%M:%S")
        .or_else(|_| NaiveTime::parse_from_str(value, "%H:%M:%S%.f"))
        .ok()
}
fn days_in_month(year: i32, month: u32) -> u32 {
    let (next_year, next_month) = if month == 12 {
        (year + 1, 1)
    } else {
        (year, month + 1)
    };
    NaiveDate::from_ymd_opt(next_year, next_month, 1)
        .unwrap()
        .pred_opt()
        .unwrap()
        .day()
}
fn add_local_occurrence(
    c: &Connection,
    definition: &ReminderDefinition,
    cycle: &str,
    day: NaiveDate,
    at: NaiveTime,
    due_day: NaiveDate,
) -> Result<(), String> {
    let scheduled = Local
        .from_local_datetime(&day.and_time(at))
        .earliest()
        .ok_or_else(|| "Local reminder time is invalid".to_string())?;
    let due = Local
        .from_local_datetime(&due_day.and_time(at))
        .earliest()
        .ok_or_else(|| "Local due time is invalid".to_string())?;
    let id = format!("{}:{}", definition.id, cycle);
    let occurrence = Occurrence {
        id: id.clone(),
        reminder_id: definition.id.clone(),
        title: definition.title.clone(),
        description: definition.description.clone(),
        kind: definition.kind.clone(),
        priority: definition.priority.clone(),
        scheduled_date: day.to_string(),
        scheduled_at: scheduled.to_rfc3339(),
        due_at: due.to_rfc3339(),
        status: "PENDING".into(),
        snoozed_until: None,
        completed_at: None,
        updated_at: Utc::now().to_rfc3339(),
    };
    c.execute(
        "INSERT OR IGNORE INTO occurrences(id,payload,updated_at) VALUES(?1,?2,?3)",
        params![
            id,
            serde_json::to_string(&occurrence).unwrap(),
            occurrence.updated_at
        ],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}
fn materialize_local(c: &Connection) -> Result<(), String> {
    materialize_local_on(c, Local::now().date_naive())
}
fn materialize_local_on(c: &Connection, today: NaiveDate) -> Result<(), String> {
    let mut statement = c
        .prepare("SELECT payload FROM reminder_definitions")
        .map_err(|error| error.to_string())?;
    let definitions = statement
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|error| error.to_string())?
        .filter_map(Result::ok)
        .filter_map(|payload| serde_json::from_str::<ReminderDefinition>(&payload).ok())
        .collect::<Vec<_>>();
    for definition in definitions.iter().filter(|item| item.is_active) {
        let Some(primary) = parse_time(&definition.reminder_time) else {
            continue;
        };
        if definition.kind == "DAILY" {
            add_local_occurrence(c, definition, &today.to_string(), today, primary, today)?;
            if let Some(secondary) = definition
                .secondary_reminder_time
                .as_deref()
                .and_then(parse_time)
            {
                add_local_occurrence(
                    c,
                    definition,
                    &format!("{}#2", today),
                    today,
                    secondary,
                    today,
                )?;
            }
        } else if definition.kind == "MONTHLY" {
            let due_number = definition
                .monthly_due_day
                .unwrap_or(1)
                .min(days_in_month(today.year(), today.month()));
            let due_day = NaiveDate::from_ymd_opt(today.year(), today.month(), due_number).unwrap();
            let start_day = due_day - chrono::Duration::days(definition.days_before);
            if today >= start_day {
                add_local_occurrence(
                    c,
                    definition,
                    &format!("{:04}-{:02}", today.year(), today.month()),
                    today,
                    primary,
                    due_day,
                )?;
            }
        }
    }
    Ok(())
}
fn due_for_notification(
    c: &Connection,
    now: chrono::DateTime<Utc>,
) -> Result<Vec<(Occurrence, String)>, String> {
    let mut statement = c
        .prepare("SELECT payload,notified_trigger FROM occurrences")
        .map_err(|e| e.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?))
        })
        .map_err(|e| e.to_string())?;
    Ok(rows
        .filter_map(Result::ok)
        .filter_map(|(payload, notified)| {
            let item: Occurrence = serde_json::from_str(&payload).ok()?;
            if item.status == "COMPLETED" {
                return None;
            }
            let trigger = item
                .snoozed_until
                .clone()
                .unwrap_or_else(|| item.scheduled_at.clone());
            let due = chrono::DateTime::parse_from_rfc3339(&trigger)
                .ok()?
                .with_timezone(&Utc)
                <= now;
            (due && notified.as_deref() != Some(trigger.as_str())).then_some((item, trigger))
        })
        .collect())
}
fn deliver_due_reminders(app: &tauri::AppHandle) {
    let due = {
        let db = app.state::<Db>();
        db.0.lock()
            .ok()
            .and_then(|c| due_for_notification(&c, Utc::now()).ok())
            .unwrap_or_default()
    };
    for (item, trigger) in due {
        let popup_shown = app
            .get_webview_window("reminder")
            .map(|window| {
                let emitted = app
                    .emit_to(
                        "reminder",
                        "reminder-due",
                        ReminderDelivery {
                            occurrence: item.clone(),
                        },
                    )
                    .is_ok();
                let shown = window.show().is_ok();
                let _ = window.set_focus();
                emitted && shown
            })
            .unwrap_or(false);
        let delivered = if popup_shown {
            true
        } else {
            let body = item
                .description
                .as_deref()
                .unwrap_or("Open Reminder to mark this task done or snooze it.");
            app.notification()
                .builder()
                .title(&item.title)
                .body(body)
                .show()
                .is_ok()
        };
        if delivered {
            let db = app.state::<Db>();
            if let Ok(c) = db.0.lock() {
                let _ = c.execute(
                    "UPDATE occurrences SET notified_trigger=?1 WHERE id=?2",
                    params![trigger, item.id],
                );
            };
        }
    }
}
fn start_notification_scheduler(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        // Give the hidden popup webview time to register its event listener at startup.
        std::thread::sleep(std::time::Duration::from_secs(2));
        loop {
            let db = app.state::<Db>();
            if let Ok(c) = db.0.lock() {
                let _ = materialize_local(&c);
            };
            let _ = app.emit("cache-updated", ());
            deliver_due_reminders(&app);
            std::thread::sleep(std::time::Duration::from_secs(60));
        }
    });
}
#[tauri::command]
fn list_cached(db: State<Db>) -> Result<Vec<Occurrence>, String> {
    let c = db.0.lock().unwrap();
    let mut s = c
        .prepare("SELECT payload FROM occurrences ORDER BY updated_at")
        .map_err(|e| e.to_string())?;
    let rows = s
        .query_map([], |r| r.get::<_, String>(0))
        .map_err(|e| e.to_string())?;
    Ok(rows
        .filter_map(|x| x.ok().and_then(|v| serde_json::from_str(&v).ok()))
        .collect())
}
#[tauri::command]
async fn sync_now(
    server_address: String,
    db: State<'_, Db>,
    app: tauri::AppHandle,
) -> Result<Vec<Occurrence>, String> {
    let page: ReminderPage = reqwest::Client::new()
        .get(api(&server_address, "reminders?limit=100")?)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;
    {
        let c = db.0.lock().map_err(|e| e.to_string())?;
        replace_definitions(&c, &page.items)?;
        materialize_local(&c)?;
    }
    deliver_due_reminders(&app);
    list_cached(db)
}
fn update_local_status(
    db: &Db,
    id: &str,
    status: &str,
    snoozed_until: Option<String>,
    completed_at: Option<String>,
) -> Result<(), String> {
    let c = db.0.lock().map_err(|error| error.to_string())?;
    let payload: String = c
        .query_row("SELECT payload FROM occurrences WHERE id=?1", [id], |row| {
            row.get(0)
        })
        .map_err(|error| error.to_string())?;
    let mut item: Occurrence = serde_json::from_str(&payload).map_err(|error| error.to_string())?;
    item.status = status.to_string();
    item.snoozed_until = snoozed_until;
    item.completed_at = completed_at;
    item.updated_at = Utc::now().to_rfc3339();
    c.execute(
        "UPDATE occurrences SET payload=?1,updated_at=?2,notified_trigger=NULL WHERE id=?3",
        params![serde_json::to_string(&item).unwrap(), item.updated_at, id],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}
#[tauri::command]
async fn complete_occurrence(
    id: String,
    db: State<'_, Db>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();
    update_local_status(db.inner(), &id, "COMPLETED", None, Some(now))?;
    app.emit("cache-updated", ())
        .map_err(|error| error.to_string())
}
#[tauri::command]
async fn snooze_occurrence(
    id: String,
    minutes: i32,
    db: State<'_, Db>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    if ![10, 30, 60, 120].contains(&minutes) {
        return Err("Unsupported snooze duration".to_string());
    }
    let until = (Utc::now() + chrono::Duration::minutes(minutes.into())).to_rfc3339();
    update_local_status(db.inner(), &id, "SNOOZED", Some(until), None)?;
    app.emit("cache-updated", ())
        .map_err(|error| error.to_string())
}
#[tauri::command]
fn hide_main_window(app: tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.hide();
    }
}
#[tauri::command]
fn dismiss_reminder_popup(app: tauri::AppHandle) -> Result<(), String> {
    app.get_webview_window("reminder")
        .ok_or_else(|| "Reminder window is unavailable".to_string())?
        .hide()
        .map_err(|error| error.to_string())
}
#[tauri::command]
fn enable_autostart(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;
    app.autolaunch().enable().map_err(|e| e.to_string())
}
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .setup(|app| {
            let data = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data)?;
            let c = Connection::open(data.join("cache.sqlite3"))?;
            migrate(&c)?;
            app.manage(Db(Mutex::new(c)));
            start_notification_scheduler(app.handle().clone());
            let open = MenuItem::with_id(app, "open", "Open Reminders", true, None::<&str>)?;
            let sync = MenuItem::with_id(app, "sync", "Sync Now", true, None::<&str>)?;
            let exit = MenuItem::with_id(app, "exit", "Exit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &sync, &exit])?;
            TrayIconBuilder::new()
                .icon(
                    app.default_window_icon()
                        .ok_or("The application icon is unavailable")?
                        .clone(),
                )
                .menu(&menu)
                .on_menu_event(|app, e| match e.id.as_ref() {
                    "open" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "sync" => {
                        let _ = app.emit("sync-requested", ());
                    }
                    "exit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;
            if !std::env::args().any(|a| a == "--minimized") {
                app.get_webview_window("main").unwrap().show()?;
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                if window.label() != "reminder" {
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            list_cached,
            sync_now,
            complete_occurrence,
            snooze_occurrence,
            hide_main_window,
            dismiss_reminder_popup,
            enable_autostart
        ])
        .build(tauri::generate_context!())
        .expect("desktop runtime failed");
    app.run(|app, event| {
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Reopen { .. } = event {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }

        #[cfg(target_os = "macos")]
        let _ = (app, event);
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn migrations_are_idempotent() {
        let c = Connection::open_in_memory().unwrap();
        migrate(&c).unwrap();
        migrate(&c).unwrap();
        let n: i64 = c
            .query_row(
                "SELECT count(*) FROM sqlite_master WHERE type='table'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert!(n >= 3);
    }
    #[test]
    fn daily_definitions_generate_a_new_occurrence_each_day_offline() {
        let c = Connection::open_in_memory().unwrap();
        migrate(&c).unwrap();
        replace_definitions(
            &c,
            &[ReminderDefinition {
                id: "daily".into(),
                title: "Check".into(),
                description: None,
                kind: "DAILY".into(),
                reminder_time: "10:00:00".into(),
                secondary_reminder_time: None,
                monthly_due_day: None,
                days_before: 5,
                priority: "NORMAL".into(),
                is_active: true,
                updated_at: "2026-08-15T00:00:00Z".into(),
            }],
        )
        .unwrap();
        materialize_local_on(&c, NaiveDate::from_ymd_opt(2026, 8, 15).unwrap()).unwrap();
        materialize_local_on(&c, NaiveDate::from_ymd_opt(2026, 8, 16).unwrap()).unwrap();
        let count: i64 = c
            .query_row("SELECT count(*) FROM occurrences", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 2);
    }

    #[test]
    fn completed_monthly_reminder_returns_next_month_not_next_day() {
        let c = Connection::open_in_memory().unwrap();
        migrate(&c).unwrap();
        replace_definitions(
            &c,
            &[ReminderDefinition {
                id: "monthly".into(),
                title: "Pay invoice".into(),
                description: None,
                kind: "MONTHLY".into(),
                reminder_time: "10:00:00".into(),
                secondary_reminder_time: None,
                monthly_due_day: Some(15),
                days_before: 5,
                priority: "NORMAL".into(),
                is_active: true,
                updated_at: "2026-08-10T00:00:00Z".into(),
            }],
        )
        .unwrap();
        materialize_local_on(&c, NaiveDate::from_ymd_opt(2026, 8, 10).unwrap()).unwrap();

        let db = Db(Mutex::new(c));
        update_local_status(
            &db,
            "monthly:2026-08",
            "COMPLETED",
            None,
            Some("2026-08-10T10:01:00Z".into()),
        )
        .unwrap();

        let c = db.0.lock().unwrap();
        materialize_local_on(&c, NaiveDate::from_ymd_opt(2026, 8, 11).unwrap()).unwrap();
        let august_count: i64 = c
            .query_row("SELECT count(*) FROM occurrences", [], |row| row.get(0))
            .unwrap();
        assert_eq!(august_count, 1);

        materialize_local_on(&c, NaiveDate::from_ymd_opt(2026, 9, 10).unwrap()).unwrap();
        let total_count: i64 = c
            .query_row("SELECT count(*) FROM occurrences", [], |row| row.get(0))
            .unwrap();
        assert_eq!(total_count, 2);
    }
}
