"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellRing, LayoutDashboard } from "lucide-react";

const nav = [["/dashboard", "Dashboard", LayoutDashboard], ["/reminders", "Reminders", BellRing]] as const;

export function AppShell({ children, title, subtitle, action }: { children: React.ReactNode; title: string; subtitle: string; action?: React.ReactNode }) {
  const path = usePathname();
  return <div className="min-h-screen flex"><aside className="w-60 bg-[#123d2f] text-white p-5 fixed inset-y-0 hidden md:block"><div className="flex items-center gap-3 font-bold text-lg mb-10"><span className="bg-white/15 p-2 rounded-lg"><BellRing size={20} /></span>Reminder</div><nav className="space-y-1">{nav.map(([href, label, Icon]) => <Link key={label} href={href} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${path.startsWith(href) ? "bg-white text-[#123d2f] font-bold" : "text-emerald-50/75 hover:bg-white/10"}`}><Icon size={18} />{label}</Link>)}</nav></aside><main className="flex-1 md:ml-60"><header className="bg-white border-b border-[#dce4df] px-6 md:px-10 py-7 flex items-center justify-between gap-4"><div><h1 className="text-2xl font-semibold">{title}</h1><p className="muted text-sm mt-1">{subtitle}</p></div>{action}</header><div className="p-6 md:p-10 max-w-[1500px] mx-auto">{children}</div></main></div>;
}
