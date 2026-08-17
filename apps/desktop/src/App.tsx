import { useEffect, useMemo, useState } from "react";
import { BellRing, Check, CloudOff, RefreshCw, Timer } from "lucide-react";
import { listen } from "@tauri-apps/api/event";

import { native } from "./native";
import { sections } from "./schedule";
import type { Occurrence } from "./types";

const SERVER_ADDRESS_KEY = "reminder_server_address";

export default function App() {
  const [items, setItems] = useState<Occurrence[]>([]);
  const [serverAvailable, setServerAvailable] = useState(true);
  const [updateMessage, setUpdateMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [showServerInput, setShowServerInput] = useState(false);
  const [serverAddress, setServerAddress] = useState(() => localStorage.getItem(SERVER_ADDRESS_KEY) ?? "192.168.1.158");
  const grouped = useMemo(() => sections(items), [items]);

  async function updateReminders(address: string) {
    setBusy(true);
    setUpdateMessage("");
    try {
      setItems(await native.sync(address));
      localStorage.setItem(SERVER_ADDRESS_KEY, address.trim());
      setServerAvailable(true);
      setUpdateMessage("Reminders updated successfully.");
      setShowServerInput(false);
    } catch (error) {
      setServerAvailable(false);
      setItems(await native.cached());
      const reason = error instanceof Error ? error.message : String(error);
      setUpdateMessage(`Update failed: ${reason}. Offline reminders were kept.`);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    let active = true;
    native.cached().then((cached) => active && setItems(cached));
    native.enableAutostart().catch(() => {});
    const unlistenSync = listen("sync-requested", () => setShowServerInput(true));
    const unlistenCache = listen("cache-updated", async () => setItems(await native.cached()));
    return () => {
      active = false;
      unlistenSync.then((remove) => remove());
      unlistenCache.then((remove) => remove());
    };
  }, []);

  async function act(kind: "complete" | "snooze", id: string, minutes = 10) {
    if (kind === "complete") await native.complete(id);
    else await native.snooze(id, minutes);
    setItems(await native.cached());
  }

  return (
    <main className="min-h-screen">
      <header className="bg-[#123d2f] text-white px-7 py-6 flex justify-between items-center">
        <div className="flex gap-3 items-center">
          <span className="p-2 bg-white/15 rounded-xl"><BellRing /></span>
          <div><h1 className="text-xl font-bold">Reminders</h1><p className="text-sm text-emerald-100/70">Schedules continue on this computer while offline</p></div>
        </div>
        <div className="flex gap-3 items-center">
          {!serverAvailable && <span className="text-xs flex gap-2"><CloudOff size={16} />Server unavailable</span>}
          <button aria-label="Update reminders" className="btn bg-white/15 flex gap-2 items-center" onClick={() => setShowServerInput(true)}><RefreshCw size={17} className={busy ? "animate-spin" : ""} />Update reminders</button>
          <button className="btn bg-white/15" onClick={() => native.hide()}>Hide</button>
        </div>
      </header>
      <div className="p-6 max-w-5xl mx-auto space-y-8">
        {updateMessage && <p role="status" className={`card p-4 text-sm ${serverAvailable ? "text-emerald-700" : "text-red-700"}`}>{updateMessage}</p>}
        <ReminderSection title="Today" items={grouped.today} act={act} />
        <ReminderSection title="Overdue" items={grouped.overdue} act={act} />
        <ReminderSection title="Upcoming" items={grouped.upcoming} act={act} />
        <ReminderSection title="Completed" items={grouped.completed} act={act} />
      </div>
      {showServerInput && <div className="fixed inset-0 bg-black/40 grid place-items-center p-5 z-50"><form className="card p-6 w-full max-w-md" onSubmit={(event) => { event.preventDefault(); void updateReminders(serverAddress); }}><h2 className="text-xl font-bold">Update reminders</h2><p className="muted text-sm mt-2 mb-5">Enter the IP address of the computer running the reminder server.</p><label className="text-sm font-bold" htmlFor="server-address">Server IP address or URL</label><input id="server-address" className="field mt-2" value={serverAddress} onChange={(event) => setServerAddress(event.target.value)} placeholder="192.168.1.158" required autoFocus /><p className="muted text-xs mt-2">An IP uses port 8000 automatically. You can also enter a full URL.</p><div className="flex justify-end gap-3 mt-6"><button type="button" className="btn secondary" onClick={() => setShowServerInput(false)} disabled={busy}>Cancel</button><button className="btn primary" disabled={busy}>{busy ? "Updating…" : "Update"}</button></div></form></div>}
    </main>
  );
}

function ReminderSection({ title, items, act }: { title: string; items: Occurrence[]; act: (kind: "complete" | "snooze", id: string, minutes?: number) => Promise<void> }) {
  return <section><h2 className="font-bold text-lg mb-3">{title}<span className="ml-2 text-xs bg-slate-200 px-2 py-1 rounded-full">{items.length}</span></h2>{items.length === 0 ? <div className="card p-6 muted text-sm">Nothing here.</div> : <div className="grid gap-3">{items.map((item) => <article key={item.id} className="card p-5 flex gap-5 justify-between items-start"><div><div className="flex gap-2 items-center"><h3 className="font-bold">{item.title}</h3><span className="text-[11px] font-bold bg-emerald-50 text-emerald-700 px-2 py-1 rounded">{item.type}</span></div><p className="muted text-sm mt-2">{item.description}</p><p className="text-xs mt-3">{new Date(item.scheduled_at).toLocaleString()} · {item.status}</p></div>{item.status !== "COMPLETED" && <div className="flex gap-2 shrink-0"><button className="btn secondary flex gap-2" onClick={() => act("snooze", item.id, 10)}><Timer size={17} />Remind me later</button><button className="btn primary flex gap-2" onClick={() => act("complete", item.id)}><Check size={17} />Done</button></div>}</article>)}</div>}</section>;
}
