// The rally board: a read-only window onto rallies in flight, for staff.
// Two RPCs, both gated on is_staff() and both writing nothing:
//   admin_rally_board(p_status, p_project) — the list
//   admin_rally(sid)                       — one rally, turn by turn
// Contributors are named only by their anonymous alias, never a real name.
import { supabase } from "@/lib/supabase";
import { isDemo } from "@/lib/demo";

export type RallyStatus = "open" | "waiting" | "active" | "complete" | "abandoned";
export type BoardFilter = "all" | "in_flight" | "overdue" | RallyStatus;
export type Side = "a" | "b";

export interface BoardRally {
  session_id: string;
  status: RallyStatus;
  mode: "async" | "live";
  language: string;
  card_title: string;
  card_situation: string;
  domain: string | null;
  project_id: string | null;
  project: string | null;
  a_alias: string | null;
  b_alias: string | null;
  turns_done: number;
  turns_target: number;
  next_alias: string | null;
  next_side: Side | null;
  due_at: string | null;
  overdue: boolean;
  seconds: number;
  /** How many of the latest takes already have a machine transcript. */
  transcripts: number;
  flags: string[];
  abandoned_reason: string | null;
  created_at: string;
  last_move_at: string;
}

export interface BoardProject {
  id: string;
  name: string;
  language: string;
  rallies: number;
}

export interface Board {
  now: string;
  reply_window_hours: number;
  status: BoardFilter;
  project_id: string | null;
  counts: Record<BoardFilter, number>;
  projects: BoardProject[];
  rallies: BoardRally[];
}

/** One word of a machine transcript, with its place in the audio. */
export interface TranscriptWord {
  w?: string;
  word?: string;
  start?: number;
  end?: number;
}
export interface TranscriptSegment {
  start?: number;
  end?: number;
  text?: string;
}
/** The machine's draft of a take. Nothing generates these on its own: a staff
 *  member runs stt-draft on a finished session, so absence is normal, not broken. */
export interface RallyTranscript {
  status: "pending" | "running" | "done" | "failed" | "skipped";
  engine: string | null;
  text: string | null;
  gloss: string | null;
  confidence: number | null;
  detected_language: string | null;
  error: string | null;
  updated_at: string;
  segments: TranscriptSegment[] | null;
  words: TranscriptWord[] | null;
}

export interface RallyRating {
  tone: number;
  prompt_adherence: number;
  mood: number;
  clarity: number;
  aggregate: number | null;
  rater_side: Side;
  rater_alias: string | null;
}

export interface RallyTurn {
  turn_id: string;
  turn_no: number;
  attempt: number;
  latest: boolean;
  side: Side;
  alias: string | null;
  audio_path: string;
  seconds: number;
  status: string;
  created_at: string;
  rated_at: string | null;
  rating: RallyRating | null;
  transcript: RallyTranscript | null;
  verified: { text: string | null; gloss: string | null; updated_at: string } | null;
}

export interface RallyDetail {
  session_id: string;
  status: RallyStatus;
  mode: "async" | "live";
  language: string;
  created_at: string;
  last_move_at: string;
  completed_at: string | null;
  due_at: string | null;
  overdue: boolean;
  turns_target: number;
  turns_done: number;
  seconds: number;
  flags: string[];
  abandoned_reason: string | null;
  project: { id: string; name: string; buyer: string; language: string; status: string } | null;
  card: { title: string; situation: string; persona_a: string; persona_b: string; domain: string | null; english_note: string | null; audio_path: string | null };
  participants: { a: { alias: string | null; joined_at: string | null } | null; b: { alias: string | null; joined_at: string | null } | null };
  next: { alias: string | null; side: Side } | null;
  stt: { engine: string; show: boolean; note?: string; language?: string | null };
  turns: RallyTurn[];
}

const EMPTY_BOARD: Board = {
  now: new Date().toISOString(),
  reply_window_hours: 24,
  status: "all",
  project_id: null,
  counts: { all: 0, in_flight: 0, overdue: 0, open: 0, waiting: 0, active: 0, complete: 0, abandoned: 0 },
  projects: [],
  rallies: [],
};

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const rallyBoard = (status: BoardFilter = "in_flight", projectId: string | null = null): Promise<Board> =>
  isDemo() ? Promise.resolve({ ...EMPTY_BOARD, status }) : rpc<Board>("admin_rally_board", { p_status: status, p_project: projectId });

export const rallyDetail = (sid: string): Promise<RallyDetail> => {
  if (isDemo()) return Promise.reject(new Error("The rally board is turned off inside the chat demo."));
  return rpc<RallyDetail>("admin_rally", { sid });
};

/** How long the board waits between reads. The app polls; it holds no socket. */
export const BOARD_POLL_MS = 20_000;
/** The open rally refreshes more slowly: a take lands in minutes, not seconds, and
 *  a tighter loop would fight whoever is listening. */
export const DETAIL_POLL_MS = 30_000;

export const FILTERS: [BoardFilter, string][] = [
  ["in_flight", "In flight"],
  ["overdue", "Overdue"],
  ["waiting", "Needs a partner"],
  ["active", "Both in"],
  ["open", "Not started"],
  ["complete", "Finished"],
  ["abandoned", "Gone quiet"],
  ["all", "Everything"],
];

export const STATUS_WORD: Record<RallyStatus, string> = {
  open: "nobody in it",
  waiting: "waiting on a partner",
  active: "both in",
  complete: "finished",
  abandoned: "gone quiet",
};

/** "4 min ago", "3 h ago", "2 days ago". */
export function since(iso: string | null): string {
  if (!iso) return "never";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
}

/** "in 6 h" or "5 h late". */
export function until(iso: string | null): string {
  if (!iso) return "no clock";
  const min = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  const late = min < 0;
  const m = Math.abs(min);
  const body = m < 60 ? `${m} min` : m < 2880 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} days`;
  return late ? `${body} late` : `in ${body}`;
}

export const secs = (n: number | string | null | undefined): string => {
  const v = Number(n ?? 0);
  return v < 60 ? `${Math.round(v)} s` : `${Math.floor(v / 60)} m ${String(Math.round(v % 60)).padStart(2, "0")} s`;
};

export const clock = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
