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
  partner_alias?: string | null;
  partner_avatar?: string | null;
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
  my_alias: string | null;
  /** The stored Ankara character, a property of the person like the alias.
   *  Optional because demo mode does not supply one; the UI falls back. */
  my_avatar?: string | null;
  partner_alias: string | null;
  partner_avatar?: string | null;
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
  if (ms < 60_000) return `in ${Math.ceil(ms / 1000)} s`;
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

/* ============================================================================
   Browsing and joining: the rally list a contributor picks from.

   pp_browse(pid) lists every rally in a project the contributor can see, with
   the three states the list has to show, and how many of their slots are used.
   pp_join(sid) puts them in one. Both are the agreed contract; the shapes
   below are that contract, nothing added.
   ========================================================================= */

/** `open`: nobody has joined. `waiting`: one person is in and needs a partner. `mine`: already theirs. */
export type BrowseState = "open" | "waiting" | "mine";

export interface BrowseRally {
  session_id: string;
  card_title: string;
  card_situation: string;
  domain: string;
  turns_target: number;
  state: BrowseState;
  /** A generated anonymous name ("Calm Squirrel"). Real names are never shown. */
  partner_alias: string | null;
  /** The stored Ankara character that goes with that alias. */
  partner_avatar?: string | null;
  turn_count: number;
  can_join: boolean;
}

export interface Browse {
  max_open: number;
  my_open_count: number;
  rallies: BrowseRally[];
}

/** How many rallies a contributor may hold at once, for the screens that have
 * no pp_browse answer to hand (Home). Every screen that does hold one uses the
 * server's `max_open` instead of this. */
export const MAX_OPEN_RALLIES = 3;

export async function browse(projectId: string | null = null): Promise<Browse> {
  if (isDemo()) return demo.browse(projectId);
  const { data, error } = await supabase.rpc("pp_browse", { pid: projectId });
  if (error) throw error;
  return data as Browse;
}

export async function joinRally(sessionId: string): Promise<{ session_id: string; role: "a" | "b" }> {
  if (isDemo()) return demo.joinRally(sessionId);
  const { data, error } = await supabase.rpc("pp_join", { sid: sessionId });
  if (error) throw error;
  return data as { session_id: string; role: "a" | "b" };
}

/** A project the contributor is playing on. */
export interface PlayerProject {
  project_id: string;
  name: string;
  language: string;
  /** Optional counts; rendered only when the server sends them. */
  open_count?: number | null;
  waiting_count?: number | null;
  mine_count?: number | null;
  note?: string | null;
}

/** The projects this contributor is on.
 *
 * NOTE: pp_browse / pp_join are the agreed contract; a project list is not in
 * it yet. Until `pp_my_projects` lands, a missing function is read as "no
 * project list to show", and the play flow goes straight to pp_browse(null) —
 * every rally the contributor can see. Any other error is a real error. */
export async function myProjects(): Promise<PlayerProject[]> {
  if (isDemo()) return demo.projects();
  const { data, error } = await supabase.rpc("pp_my_projects");
  if (error) {
    if (error.code === "PGRST202" || /could not find the function|does not exist/i.test(error.message)) return [];
    throw error;
  }
  return (data ?? []) as PlayerProject[];
}

/** "retail_market_haggle" -> "Retail · market haggle". The domain is a tag, not a sentence. */
export function domainLabel(domain: string): string {
  const parts = domain.split("_").filter(Boolean);
  if (!parts.length) return "";
  const head = parts[0];
  const rest = parts.slice(1).join(" ");
  const cap = head.charAt(0).toUpperCase() + head.slice(1);
  return rest ? `${cap} · ${rest}` : cap;
}
