export type Status="PENDING"|"SNOOZED"|"COMPLETED"|"OVERDUE";
export type Occurrence={id:string;reminder_id:string;title:string;description:string|null;type:"DAILY"|"MONTHLY";priority:"LOW"|"NORMAL"|"HIGH";scheduled_date:string;scheduled_at:string;due_at:string;status:Status;snoozed_until:string|null;completed_at:string|null;updated_at:string};
export type ReminderDefinition = {
  id: string;
  title: string;
  description: string | null;
  type: "DAILY" | "MONTHLY";
  reminder_time: string;
  secondary_reminder_time: string | null;
  monthly_due_day: number | null;
  days_before: number;
  priority: "LOW" | "NORMAL" | "HIGH";
  is_active: boolean;
  updated_at: string;
};
