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
