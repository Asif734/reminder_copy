"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BellRing, CalendarClock, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { queries } from "@/lib/api";

export default function Dashboard() {
  const reminders = useQuery({ queryKey: ["reminders"], queryFn: queries.reminders });
  const active = reminders.data?.items.filter((item) => item.is_active) ?? [];
  return <AppShell title="Dashboard" subtitle="Global reminders available to every installed app." action={<Link href="/reminders/new" className="btn btn-primary flex gap-2"><Plus size={18} />New reminder</Link>}><section className="grid sm:grid-cols-2 gap-4 max-w-3xl"><div className="card p-5"><div className="flex justify-between"><div><p className="muted text-sm">Active reminders</p><p className="text-3xl font-semibold mt-3">{reminders.isLoading ? "—" : active.length}</p></div><span className="h-10 w-10 grid place-items-center bg-emerald-50 text-emerald-700 rounded-xl"><BellRing size={20} /></span></div></div><div className="card p-5"><div className="flex justify-between"><div><p className="muted text-sm">Total reminders</p><p className="text-3xl font-semibold mt-3">{reminders.data?.total ?? "—"}</p></div><span className="h-10 w-10 grid place-items-center bg-emerald-50 text-emerald-700 rounded-xl"><CalendarClock size={20} /></span></div></div></section><div className="card p-6 mt-7 max-w-3xl"><h2 className="font-semibold text-lg">How updates work</h2><p className="muted text-sm mt-2 leading-6">Create or change a reminder here. Each installed desktop app receives the global schedule when someone clicks Update reminders while connected to this server. Downloaded schedules continue working offline.</p></div></AppShell>;
}
