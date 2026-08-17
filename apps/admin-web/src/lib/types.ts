export type ReminderType = "DAILY" | "MONTHLY";
export type Reminder = { id:string; title:string; description:string|null; type:ReminderType; reminder_time:string; secondary_reminder_time:string|null; monthly_due_day:number|null; days_before:number; priority:"LOW"|"NORMAL"|"HIGH"; is_active:boolean; created_by:string; created_at:string; updated_at:string };
export type ReminderPage = { items:Reminder[]; total:number; limit:number; offset:number };
