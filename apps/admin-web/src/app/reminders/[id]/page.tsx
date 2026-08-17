import { AppShell } from "@/components/app-shell";
export default async function ReminderDetail({params}:{params:Promise<{id:string}>}){const {id}=await params;return <AppShell title="Reminder details" subtitle="Global reminder definition."><div className="card p-6"><p className="muted text-sm">Reminder ID</p><p className="font-mono mt-2">{id}</p></div></AppShell>}
