# Reminder Desktop

Tauri 2 broadcast reminder client with a React UI and Rust-owned SQLite database.

## Features

- No-login manual synchronization of global recurring definitions
- SQLite definition and occurrence storage with local completion and snooze state
- Offline daily/monthly occurrence generation and native notifications
- Today, upcoming, overdue, and completed sections
- One-click completion and 10/30/60/120-minute snooze
- Official Tauri notification and autostart plugins
- System tray with Open Reminders, Sync Now, and Exit
- Closing the window hides it; only Exit terminates the process
- Autostart launches with a minimized argument

After a successful **Update reminders**, the server may go offline. The desktop runtime uses
the downloaded definitions and the computer's local timezone to create future daily and
monthly occurrences. Changes, disabled reminders, and deletions take effect on that computer
the next time the installation updates successfully.

## Development

Install Rust using `rustup`, plus the platform prerequisites from the Tauri 2 documentation.

The server address is entered in the app when **Update reminders** is selected and is remembered
on that installation. Entering a bare IPv4 address automatically uses HTTP port 8000.

```bash
npm ci
npm test
npm run build
npm run tauri dev
```

Windows packaging should be performed on a Windows CI runner. macOS packaging requires an
Apple signing identity for distributable builds.

## Personal offline reminders

Use **My reminders → Add reminder** to create a daily or monthly reminder without
connecting to a server. Personal reminders can be edited, paused, resumed, and
deleted on the same computer. They live in SQLite and survive app restarts and
server updates; they are never uploaded or distributed to other installations.
Downloaded global reminders remain managed through the admin dashboard.

Daily reminders support an optional second time. Monthly reminders support a due
day (clamped to the last day in shorter months) and a lead time in days. Editing a
personal reminder replaces its pending occurrences and keeps completed history.
Deleting it removes its local history as well.

**Remind me later** postpones monthly reminders until tomorrow at their originally
scheduled local time, including across month/year boundaries. Daily reminders
continue to snooze for 10 minutes. Both the popup and main window use this rule.

## Build and run on macOS

With Node.js, npm, Rust/Cargo, and the Xcode command line tools installed:

```bash
cd apps/desktop
npm ci
npm test
npm run tauri build
```

The packaged app is `src-tauri/target/release/bundle/macos/Reminder.app`.
The disk image installer is written to `src-tauri/target/release/bundle/dmg/`.
Open the disk image and drag **Reminder** into Applications, then launch it.
Use **My reminders → Add reminder** to start without any backend or internet.
Allow notifications if macOS asks. Closing the main window keeps reminders running;
use the system tray's **Exit** action to stop the app.

For development, run `npm run tauri dev` instead of the build command.
Python's `.venv` is used by the optional backend, while desktop JavaScript dependencies
are installed locally in `node_modules` by `npm ci`.
