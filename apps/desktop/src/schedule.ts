import type {Occurrence} from "./types";
export function dueOccurrences(items:Occurrence[],now=new Date()){return items.filter(item=>item.status!=="COMPLETED"&&new Date(item.snoozed_until??item.scheduled_at)<=now)}
export function todayDateString(date:Date=new Date()){const year=date.getFullYear();const month=String(date.getMonth()+1).padStart(2,"0");const day=String(date.getDate()).padStart(2,"0");return `${year}-${month}-${day}`;}
function effectiveDate(item:Occurrence){return item.snoozed_until?todayDateString(new Date(item.snoozed_until)):item.scheduled_date;}
export function sections(items:Occurrence[],today=todayDateString()){return {today:items.filter(x=>effectiveDate(x)===today&&x.status!=="COMPLETED"&&x.status!=="OVERDUE"),upcoming:items.filter(x=>effectiveDate(x)>today&&x.status!=="COMPLETED"&&x.status!=="OVERDUE"),overdue:items.filter(x=>x.status==="OVERDUE"||(x.status!=="COMPLETED"&&effectiveDate(x)<today)),completed:items.filter(x=>x.status==="COMPLETED")}}
