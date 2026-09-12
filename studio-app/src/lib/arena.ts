// The booth and the live scene: bookings, pairing, joining, finishing, rating. RPC wrappers; demo in memory.
import { supabase } from "@/lib/supabase";
import { isDemo } from "@/lib/demo";
import { demoArena } from "@/lib/demoArena";

export interface ArenaConfig {
  slot_minutes: number;
  scene_seconds: number;
  hours: { from: number; to: number };
  book_ahead_minutes: number;
  max_upcoming: number;
  reschedule_cutoff_hours: number;
  cancel_cutoff_hours: number;
  open_before_minutes: number;
  join_grace_minutes: number;
  strikes_to_pause: number;
  pause_days: number;
  showed_up_credit_minutes: number;
  timezone: string;
}
export type SlotStatus = "open" | "paired" | "cancelled" | "late_cancel" | "lapsed" | "done" | "no_show" | "showed_up";
export interface Booking {
  slot_id: string;
  starts_at: string;
  status: SlotStatus;
  language?: string;
  reschedule_count?: number;
  session_id: string | null;
  partner?: string | null;
  session_status?: string | null;
  abandoned_reason?: string | null;
  can_join?: boolean;
}
export interface Mine {
  config: ArenaConfig;
  strikes: number;
  paused_until: string | null;
  languages: string[];
  upcoming: Booking[];
  past: Booking[];
}
export interface Availability {
  starts_at: string;
  waiting: number;
}
export interface BookResult {
  slot_id: string;
  starts_at: string;
  paired: boolean;
  session_id: string | null;
}
export interface Twist {
  at_seconds: number;
  text: string;
}
export interface Scene {
  session_id: string;
  status: "waiting" | "active" | "complete" | "abandoned";
  language: string;
  me: "a" | "b";
  starts_at: string;
  started_at: string | null;
  ended_at: string | null;
  partner_joined: boolean;
  partner: string | null;
  my_speaker_id: string;
  card: { title: string; situation: string; persona: string; partner_persona: string; audio_path: string | null; domain: string | null };
  twists: Twist[];
  scene_seconds: number;
  my_track: { turn_id: string; seconds: number } | null;
  partner_track: { turn_id: string; seconds: number; rated: boolean } | null;
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const mine = (): Promise<Mine> => (isDemo() ? demoArena.mine() : rpc<Mine>("arena_mine"));
export const availability = (lang: string, from: Date, to: Date): Promise<Availability[]> =>
  isDemo() ? demoArena.availability(lang, from, to) : rpc<Availability[]>("arena_availability", { lang, from_ts: from.toISOString(), to_ts: to.toISOString() });
export const book = (lang: string, startsAt: Date): Promise<BookResult> => (isDemo() ? demoArena.book(lang, startsAt) : rpc<BookResult>("arena_book", { lang, starts_at: startsAt.toISOString() }));
export const reschedule = (slotId: string, startsAt: Date): Promise<BookResult> =>
  isDemo() ? demoArena.reschedule(slotId, startsAt) : rpc<BookResult>("arena_reschedule", { slot_id: slotId, new_starts_at: startsAt.toISOString() });
export const cancel = (slotId: string): Promise<{ strike: boolean }> => (isDemo() ? demoArena.cancel(slotId) : rpc<{ strike: boolean }>("arena_cancel", { slot_id: slotId }));
export const join = (sid: string): Promise<Scene> => (isDemo() ? demoArena.join(sid) : rpc<Scene>("arena_join", { sid }));
export const finish = (sid: string, path: string, secs: number, chemistry: number): Promise<{ complete: boolean }> =>
  isDemo() ? demoArena.finish(sid, path, secs, chemistry) : rpc<{ complete: boolean }>("arena_finish", { sid, path, secs, chemistry });
export const rate = (sid: string, r: { tone: number; prompt_adherence: number; mood: number; clarity: number }): Promise<void> =>
  isDemo() ? demoArena.rate(sid, r) : rpc<unknown>("arena_rate", { sid, ...r }).then(() => undefined);

/** Slot grid for one day in the booth's timezone, on the configured minute grid within opening hours. */
export function slotsForDay(day: Date, cfg: ArenaConfig): Date[] {
  const out: Date[] = [];
  const y = day.getFullYear();
  const m = day.getMonth();
  const d = day.getDate();
  for (let h = cfg.hours.from; h < cfg.hours.to; h++) {
    for (let mm = 0; mm < 60; mm += cfg.slot_minutes) {
      out.push(lagosDate(y, m, d, h, mm));
    }
  }
  return out;
}

/** A Date for a wall-clock time in Africa/Lagos (UTC+1, no daylight saving). */
export function lagosDate(y: number, m: number, d: number, h: number, mm: number): Date {
  return new Date(Date.UTC(y, m, d, h - 1, mm, 0, 0));
}
export const lagos = (iso: string | Date, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }): string =>
  new Date(iso).toLocaleString("en-GB", { ...opts, timeZone: "Africa/Lagos" });
export const lagosTime = (iso: string | Date): string => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });
export const untilLabel = (iso: string): string => {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "now";
  const min = Math.round(ms / 60000);
  if (min < 60) return `in ${min} min`;
  const h = Math.round(min / 60);
  return h < 48 ? `in ${h} h` : `in ${Math.round(h / 24)} days`;
};
