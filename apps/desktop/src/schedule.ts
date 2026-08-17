import type {Occurrence} from "./types";
export function dueOccurrences(items:Occurrence[],now=new Date()){return items.filter(item=>item.status!=="COMPLETED"&&new Date(item.snoozed_until??item.scheduled_at)<=now)}
export function todayDateString(date:Date=new Date()){const year=date.getFullYear();const month=String(date.getMonth()+1).padStart(2,"0");const day=String(date.getDate()).padStart(2,"0");return `${year}-${month}-${day}`;}
export function sections(items:Occurrence[],today=todayDateString()){return {today:items.filter(x=>x.scheduled_date===today&&x.status!=="COMPLETED"&&x.status!=="OVERDUE"),upcoming:items.filter(x=>x.scheduled_date>today&&x.status!=="COMPLETED"),overdue:items.filter(x=>x.status==="OVERDUE"),completed:items.filter(x=>x.status==="COMPLETED")}}
