# Reminder Platform Architecture

## Product model

The platform publishes one global reminder feed. There are no administrators, member
accounts, passwords, sessions, assignments, or server-side reports. Anyone who can reach the
admin web application can manage the feed, and every desktop installation can download it.

## Runtime

- `admin-web` provides the no-login dashboard and global reminder management.
- `api-gateway` exposes the reminder API to browsers and desktop installations.
- `reminder-service` stores global daily and monthly definitions in PostgreSQL.
- `desktop` downloads definitions on demand and stores them in local SQLite.
- PostgreSQL is the server system of record. Redis remains available for shared service
  health and infrastructure compatibility; it is not used to schedule desktop reminders.

The authentication, user, server occurrence, report, Celery worker, and Celery Beat services
are not part of the runtime topology.

## Offline scheduling

An installation connects to the gateway only when **Update reminders** is selected. A
successful update replaces its local definition set and reconciles pending local occurrences.
Disabled, deleted, and changed definitions take effect on that update.

The native desktop process checks SQLite every minute. It creates an idempotent occurrence for
each local daily cycle and monthly cycle, then displays the popup or native notification when
the local scheduled time is reached. Completion and snooze state belong to that installation
and are never uploaded.

Because definitions are local, existing schedules continue when the server, admin computer,
network, or internet connection is unavailable. A machine that has not downloaded a new or
changed definition cannot learn about it until its next successful update.

## Network boundary

There is intentionally no application-level authorization. The deployment must therefore be
treated as trusted-network software. Restrict ports `3000` and `8000` to the intended LAN or a
private VPN; exposing them publicly would allow anyone to read and modify global reminders.
