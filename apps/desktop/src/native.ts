import {invoke} from "@tauri-apps/api/core";
import type {Occurrence} from "./types";
export const native={sync:(serverAddress:string)=>invoke<Occurrence[]>("sync_now",{serverAddress}),cached:()=>invoke<Occurrence[]>("list_cached"),complete:(id:string)=>invoke("complete_occurrence",{id}),snooze:(id:string,minutes:number)=>invoke("snooze_occurrence",{id,minutes}),hide:()=>invoke("hide_main_window"),dismissPopup:()=>invoke("dismiss_reminder_popup"),enableAutostart:()=>invoke("enable_autostart")};
