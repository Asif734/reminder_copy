"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { api } from "@/lib/api";

export default function NewReminder() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [type, setType] = useState("DAILY");
  const [error, setError] = useState("");
  const create = useMutation({ mutationFn: (body: unknown) => api("/reminders", { method: "POST", body: JSON.stringify(body) }), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["reminders"] }); router.push("/reminders"); }, onError: (requestError) => setError(requestError.message) });

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const secondTime = form.get("secondary_reminder_time");
    create.mutate({ title: form.get("title"), description: form.get("description") || null, type, reminder_time: `${form.get("reminder_time")}:00`, secondary_reminder_time: type === "DAILY" && secondTime ? `${secondTime}:00` : null, monthly_due_day: type === "MONTHLY" ? Number(form.get("monthly_due_day")) : null, days_before: type === "MONTHLY" ? Number(form.get("days_before")) : 5, priority: form.get("priority") });
  }

  return <AppShell title="Create reminder" subtitle="This schedule will be available to every installed app."><form onSubmit={submit} className="card p-6 max-w-3xl"><div className="grid md:grid-cols-2 gap-5"><label className="md:col-span-2"><span className="label">Title *</span><input name="title" className="field" required maxLength={200} /></label><label className="md:col-span-2"><span className="label">Description</span><textarea name="description" className="field min-h-24" /></label><label><span className="label">Reminder type *</span><select className="field" value={type} onChange={(event) => setType(event.target.value)}><option>DAILY</option><option>MONTHLY</option></select></label><label><span className="label">First reminder time *</span><input name="reminder_time" type="time" className="field" required /></label>{type === "DAILY" && <label><span className="label">Second reminder time (optional)</span><input name="secondary_reminder_time" type="time" className="field" /></label>}{type === "MONTHLY" && <><label><span className="label">Due day *</span><input name="monthly_due_day" type="number" min="1" max="31" defaultValue="15" className="field" required /></label><label><span className="label">Days before *</span><input name="days_before" type="number" min="0" max="31" defaultValue="5" className="field" required /></label></>}<label><span className="label">Priority</span><select name="priority" className="field" defaultValue="NORMAL"><option>LOW</option><option>NORMAL</option><option>HIGH</option></select></label></div>{error && <p role="alert" className="text-red-700 bg-red-50 p-3 rounded-lg mt-5">{error}</p>}<div className="flex justify-end gap-3 mt-7"><button type="button" onClick={() => router.back()} className="btn btn-secondary">Cancel</button><button disabled={create.isPending} className="btn btn-primary">{create.isPending ? "Saving…" : "Save reminder"}</button></div></form></AppShell>;
}
