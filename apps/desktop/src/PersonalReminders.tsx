import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { native } from "./native";
import type { ReminderDefinition } from "./types";

const emptyReminder = (): ReminderDefinition => ({
  id: "", title: "", description: "", type: "DAILY", reminder_time: "09:00",
  secondary_reminder_time: null, monthly_due_day: null, days_before: 0,
  priority: "NORMAL", is_active: true, updated_at: "",
});

export function PersonalReminders() {
  const [items, setItems] = useState<ReminderDefinition[]>([]);
  const [draft, setDraft] = useState<ReminderDefinition | null>(null);
  const [deleting, setDeleting] = useState<ReminderDefinition | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const refresh = () => native.personal().then((values) => { if (active) setItems(values); })
      .catch((reason) => { if (active) setError(String(reason)); });
    void refresh();
    const subscription = listen("cache-updated", () => { void refresh(); });
    return () => { active = false; void subscription.then((remove) => remove()); };
  }, []);

  async function save() {
    if (!draft || busy) return;
    setBusy(true); setError("");
    try {
      await native.savePersonal(draft, !draft.id);
      setItems(await native.personal());
      setDraft(null);
    } catch (reason) { setError(String(reason)); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!deleting || busy) return;
    setBusy(true); setError("");
    try {
      await native.deletePersonal(deleting.id);
      setItems(await native.personal());
      setDeleting(null);
    } catch (reason) { setError(String(reason)); }
    finally { setBusy(false); }
  }

  return <section>
    <div className="flex justify-between items-center gap-3 mb-3">
      <div><h2 className="font-bold text-lg">My reminders</h2><p className="muted text-sm">Private to this computer. Create and manage reminders while offline.</p></div>
      <button className="btn primary" onClick={() => { setError(""); setDraft(emptyReminder()); }}>Add reminder</button>
    </div>
    {error && <p role="alert" className="text-red-700 mb-3">{error}</p>}
    {items.length === 0 ? <p className="card p-6 muted text-sm">No personal reminders yet.</p> : <div className="grid gap-3">{items.map((item) => <article key={item.id} className="card p-5 flex justify-between gap-4">
      <div><h3 className="font-bold">{item.title}</h3><p className="muted text-sm mt-1">{item.description}</p>
        <p className="text-sm mt-2">{item.type === "DAILY" ? "Daily" : `Monthly · day ${item.monthly_due_day}`} · {item.reminder_time.slice(0, 5)}{item.secondary_reminder_time && ` and ${item.secondary_reminder_time.slice(0, 5)}`} · {item.priority.toLowerCase()} priority{!item.is_active && " · Paused"}</p>
        {item.type === "MONTHLY" && <p className="muted text-xs mt-1">Starts {item.days_before} days before due date · Remind me later: next day</p>}
      </div>
      <div className="flex gap-2 items-start"><button className="btn secondary" aria-label={`Edit ${item.title}`} onClick={() => { setError(""); setDraft({ ...item }); }}>Edit</button><button className="btn secondary" aria-label={`Delete ${item.title}`} onClick={() => { setError(""); setDeleting(item); }}>Delete</button></div>
    </article>)}</div>}
    {draft && <div className="fixed inset-0 bg-black/40 grid place-items-center p-5 z-50"><form role="dialog" aria-modal="true" aria-labelledby="personal-form-title" className="card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-4" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <h2 id="personal-form-title" className="text-xl font-bold">{draft.id ? "Edit reminder" : "Add reminder"}</h2>
      <p className="muted text-sm">Saved on this computer. All times use this computer’s local timezone.</p>
      <label className="block text-sm">Title<input className="field mt-1" autoFocus required maxLength={200} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
      <label className="block text-sm">Description<textarea className="field mt-1" maxLength={5000} value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
      <label className="block text-sm">Repeat<select className="field mt-1" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as ReminderDefinition["type"], monthly_due_day: e.target.value === "MONTHLY" ? 1 : null, secondary_reminder_time: null })}><option value="DAILY">Daily</option><option value="MONTHLY">Monthly</option></select></label>
      <label className="block text-sm">Reminder time<input className="field mt-1" type="time" required value={draft.reminder_time.slice(0, 5)} onChange={(e) => setDraft({ ...draft, reminder_time: e.target.value })} /></label>
      {draft.type === "DAILY" ? <label className="block text-sm">Second reminder time (optional)<input className="field mt-1" type="time" value={draft.secondary_reminder_time?.slice(0, 5) ?? ""} onChange={(e) => setDraft({ ...draft, secondary_reminder_time: e.target.value || null })} /></label> : <>
        <label className="block text-sm">Day of month<input className="field mt-1" type="number" min={1} max={31} required value={draft.monthly_due_day ?? 1} onChange={(e) => setDraft({ ...draft, monthly_due_day: Number(e.target.value) })} /></label>
        <p className="muted text-xs">Shorter months use the last day of the month.</p>
        <label className="block text-sm">Start reminding days before due date<input className="field mt-1" type="number" min={0} max={31} required value={draft.days_before} onChange={(e) => setDraft({ ...draft, days_before: Number(e.target.value) })} /></label>
      </>}
      <label className="block text-sm">Priority<select className="field mt-1" value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value as ReminderDefinition["priority"] })}><option value="LOW">Low</option><option value="NORMAL">Normal</option><option value="HIGH">High</option></select></label>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} />Active</label>
      {draft.id && <p className="muted text-xs">Saving replaces pending reminders with the new schedule and keeps completed history.</p>}
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <div className="flex justify-end gap-3"><button type="button" className="btn secondary" disabled={busy} onClick={() => setDraft(null)}>Cancel</button><button className="btn primary" disabled={busy}>{busy ? "Saving…" : "Save reminder"}</button></div>
    </form></div>}
    {deleting && <div className="fixed inset-0 bg-black/40 grid place-items-center p-5 z-50"><div role="dialog" aria-modal="true" aria-labelledby="delete-title" className="card p-6 w-full max-w-md">
      <h2 id="delete-title" className="text-xl font-bold">Delete {deleting.title}?</h2><p className="muted text-sm my-4">This removes the reminder and its local history from this computer.</p>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <div className="flex justify-end gap-3"><button className="btn secondary" disabled={busy} onClick={() => setDeleting(null)}>Cancel</button><button className="btn primary" disabled={busy} onClick={() => void remove()}>{busy ? "Deleting…" : "Delete reminder"}</button></div>
    </div></div>}
  </section>;
}
