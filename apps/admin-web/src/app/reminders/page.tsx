"use client";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Empty, Status } from "@/components/status";
import { api, queries } from "@/lib/api";

export default function Reminders() {
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ["reminders"], queryFn: queries.reminders });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["reminders"] });
  const toggle = useMutation({ mutationFn: ({ id, on }: { id: string; on: boolean }) => api(`/reminders/${id}/${on ? "enable" : "disable"}`, { method: "POST" }), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id: string) => api(`/reminders/${id}`, { method: "DELETE" }), onSuccess: refresh });
  return <AppShell title="Reminders" subtitle="Every reminder applies to every installed app." action={<Link href="/reminders/new" className="btn btn-primary flex gap-2"><Plus size={18} />New reminder</Link>}>{list.data?.items.length ? <div className="card overflow-x-auto"><table className="w-full text-sm"><thead className="bg-[#f3f7f4] text-left"><tr>{["Title", "Type", "Times", "Status", "Priority", "Actions"].map((heading) => <th key={heading} className="px-5 py-3">{heading}</th>)}</tr></thead><tbody>{list.data.items.map((reminder) => <tr key={reminder.id} className="border-t border-slate-100"><td className="px-5 py-4 font-medium">{reminder.title}</td><td className="px-5 py-4">{reminder.type}</td><td className="px-5 py-4">{reminder.reminder_time.slice(0, 5)}{reminder.secondary_reminder_time ? ` / ${reminder.secondary_reminder_time.slice(0, 5)}` : ""}</td><td className="px-5 py-4"><Status active={reminder.is_active} /></td><td className="px-5 py-4">{reminder.priority}</td><td className="px-5 py-4"><div className="flex gap-3"><button className="text-emerald-700 font-bold" onClick={() => toggle.mutate({ id: reminder.id, on: !reminder.is_active })}>{reminder.is_active ? "Disable" : "Enable"}</button><button className="text-red-700 font-bold" onClick={() => { if (confirm(`Delete ${reminder.title}?`)) remove.mutate(reminder.id); }}>Delete</button></div></td></tr>)}</tbody></table></div> : <Empty message={list.isLoading ? "Loading reminders…" : "No reminders have been created."} />}</AppShell>;
}
