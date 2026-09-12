import { supabase } from "@/lib/supabase";
import { demo, isDemo } from "@/lib/demo";

export interface RallySummary {
  session_id: string;
  status: "waiting" | "active" | "complete" | "abandoned";
  title: string;
  language: string;
  turn_count: number;
  turns_target: number;
  updated_at: string;
  my_turn: boolean;
  waiting_for_partner: boolean;
  due_at: string | null;
  abandoned_reason: "partner_quiet" | "withdrawn" | "admin" | null;
}

export interface RallyTurn {
  turn_id: string;
  turn_no: number;
  attempt: number;
  mine: boolean;
  audio_path: string;
  seconds: number;
  status: "recorded" | "rated" | "redo" | "verified";
  created_at: string;
  rating: { tone: number; prompt_adherence: number; mood: number; clarity: number; aggregate: number } | null;
}

export interface Rally {
  session_id: string;
  status: RallySummary["status"];
  language: string;
  turn_count: number;
  turns_target: number;
  card: { title: string; situation: string; persona: string; partner_persona: string; audio_path: string | null; domain: string };
  my_speaker_id: string;
  i_am: "a" | "b";
  has_partner: boolean;
  my_turn: boolean;
  owe_rating: boolean;
  rate_turn_id: string | null;
  redo: boolean;
  next_turn_no: number;
  next_attempt: number;
  max_turn_seconds: number;
  due_at: string | null;
  i_owe: boolean;
  abandoned_reason: "partner_quiet" | "withdrawn" | "admin" | null;
  flags: string[];
  turns: RallyTurn[];
}

/** "in 3 h", "in 25 min", "overdue" */
export function dueLabel(iso: string | null): string {
  if (!iso) return "";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "overdue";
  const min = Math.round(ms / 60000);
  if (min < 60) return `in ${min} min`;
  const h = Math.round(min / 60);
  return h < 48 ? `in ${h} h` : `in ${Math.round(h / 24)} days`;
}

export const LANG_NAME: Record<string, string> = { pcm: "Nigerian Pidgin", yo: "Yoruba", ha: "Hausa", ig: "Igbo", sw: "Swahili", zu: "Zulu", en: "English" };

export async function mySessions(): Promise<RallySummary[]> {
  if (isDemo()) return demo.mySessions();
  const { data, error } = await supabase.rpc("pp_my_sessions");
  if (error) throw error;
  return (data ?? []) as RallySummary[];
}

export async function startRally(language: string): Promise<{ session_id: string; joined: boolean }> {
  if (isDemo()) return demo.startRally();
  const { data, error } = await supabase.rpc("pp_start", { lang: language });
  if (error) throw error;
  return data as { session_id: string; joined: boolean };
}

export async function loadRally(sessionId: string): Promise<Rally> {
  if (isDemo()) return demo.loadRally(sessionId);
  const { data, error } = await supabase.rpc("pp_session", { sid: sessionId });
  if (error) throw error;
  return data as Rally;
}

export async function submitTurn(sessionId: string, path: string, seconds: number): Promise<void> {
  if (isDemo()) return demo.submitTurn(sessionId, path, seconds);
  const { error } = await supabase.rpc("pp_submit_turn", { sid: sessionId, path, secs: seconds });
  if (error) throw error;
}

export async function rateTurn(turnId: string, r: { tone: number; prompt_adherence: number; mood: number; clarity: number }): Promise<{ aggregate: number; redo: boolean; complete?: boolean }> {
  if (isDemo()) return demo.rateTurn(turnId, r);
  const { data, error } = await supabase.rpc("pp_rate_turn", { tid: turnId, ...r });
  if (error) throw error;
  return data as { aggregate: number; redo: boolean; complete?: boolean };
}

/** Short-lived playback URL for a turn in a rally the caller belongs to. */
export async function turnUrl(path: string): Promise<string | null> {
  if (isDemo()) return demo.turnUrl(path);
  const { data } = await supabase.storage.from("sessions").createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
}

export function cardAudioUrl(path: string | null): string | null {
  if (!path) return null;
  return supabase.storage.from("cards").getPublicUrl(path).data.publicUrl;
}
