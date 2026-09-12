// The Cutting Room: verification queue, session workbench and the clause 15 integrity
// process. RPC wrappers; in demo mode they run on the in-memory linguist backend.
import { supabase } from "@/lib/supabase";
import { isDemo } from "@/lib/demo";
import { demoVerify } from "@/lib/demoVerify";

export type Speaker = "a" | "b";
export type VerificationStatus = "pending" | "in_progress" | "verified" | "forfeited";
export type RatingCheck = "fair" | "too_high" | "too_low";
export type CaseReason = "rating_mismatch" | "not_live" | "impersonation" | "duplicate_content" | "filler" | "pairing_interference" | "voice_taken_outside" | "identity" | "other";
export type CaseStatus = "flagged" | "under_review" | "notice_sent" | "responded" | "decided";
export type Decision = "dismissed" | "confirmed" | "confirmed_account_closed";

export interface QueueItem {
  session_id: string;
  status: VerificationStatus;
  session_status: "complete" | "abandoned";
  mode?: "async" | "live";
  title: string;
  language: string;
  domain: string | null;
  turns: number;
  seconds: number;
  flags: string[];
  abandoned_reason: string | null;
  speakers: [string | null, string | null];
  claimed_by: string | null;
  claimed_by_me: boolean | null;
  claimed_at: string | null;
  claim_editor: string | null;
  ready_since: string;
  hold: boolean;
}
export interface Queue {
  me: string;
  my_editor: string;
  claim_minutes: number;
  sessions: QueueItem[];
  verified_count: number;
}

export interface TurnRating {
  tone: number;
  prompt_adherence: number;
  mood: number;
  clarity: number;
  aggregate: number;
  rater: Speaker;
}
export interface TurnVerification {
  verified_text: string | null;
  english_gloss: string | null;
  emotion_label: string | null;
  confidence: number | null;
  issues: string[];
  verified_seconds: number | null;
  rating_check: RatingCheck | null;
  updated_at: string;
  draft_wer?: number | null;
  draft_engine?: string | null;
  alignments?: unknown[];
  aligned_at?: string | null;
  aligner?: string | null;
}
/** The machine's first pass at a take. Never shown to contributors, never used to grade them. */
export interface Draft {
  status: "pending" | "running" | "done" | "failed" | "skipped";
  engine: string | null;
  text: string | null;
  confidence: number | null;
  detected_language: string | null;
  error: string | null;
  updated_at: string;
  gloss?: string | null;
  gloss_engine?: string | null;
  gloss_error?: string | null;
}
export interface SttRoute {
  engine: string;
  language: string | null;
  show: boolean;
  note?: string;
}
export interface WorkTurn {
  turn_id: string;
  turn_no: number;
  attempt: number;
  latest: boolean;
  speaker: Speaker;
  speaker_id: string | null;
  audio_path: string;
  seconds: number;
  status: string;
  created_at: string;
  rating: TurnRating | null;
  verification: TurnVerification | null;
  draft: Draft | null;
}
export interface Tier {
  tier: string;
  min: number;
  x: number;
}
export interface SessionVerification {
  status: VerificationStatus;
  claimed_by: string | null;
  claimed_by_me: boolean | null;
  claimed_at: string | null;
  editor_score: number | null;
  peer_score: number | null;
  quality_score: number | null;
  quality_tier: string | null;
  multiplier: number | null;
  verified_seconds: number | null;
  notes: string | null;
  hold: boolean;
  verified_at: string | null;
  editor_id: string | null;
  audit_pick: boolean;
  aligned_turns?: number | null;
}
export interface Workbench {
  session_id: string;
  session_status: "complete" | "abandoned";
  mode?: "async" | "live";
  language: string;
  flags: string[];
  abandoned_reason: string | null;
  completed_at: string;
  turns_target: number;
  card: { title: string; situation: string; persona_a: string; persona_b: string; domain: string | null; audio_path: string | null; english_note: string | null };
  speakers: { a: string | null; b: string | null };
  peer_score: number | null;
  verification: SessionVerification;
  cases: { id: string; who: Speaker; reason: CaseReason; status: CaseStatus; decision: Decision | null }[];
  tiers: Tier[];
  stt: SttRoute;
  earnings?: EarningPost[];
  turns: WorkTurn[];
}

export interface CaseEvent {
  at: string;
  kind: string;
  actor: string | null;
  detail: Record<string, unknown> | null;
}
export interface CaseSession {
  session_id: string;
  title: string;
  date: string;
  verification_status: VerificationStatus | null;
  seconds: number | null;
}
export interface Case {
  id: string;
  created_at: string;
  status: CaseStatus;
  reason: CaseReason;
  detail: string | null;
  speaker_id: string | null;
  sessions: CaseSession[];
  raised_by: string | null;
  raised_by_me: boolean;
  reviewer: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  notice_sent_at: string | null;
  notice_mailed: boolean | null;
  respond_by: string | null;
  response: string | null;
  responded_at: string | null;
  decided_by: string | null;
  decision: Decision | null;
  decision_reason: string | null;
  decided_at: string | null;
  contributor_seen_at: string | null;
  events: CaseEvent[];
}
export interface Cases {
  me: string;
  my_editor: string;
  response_window_days: number;
  cases: Case[];
}
/** What a contributor sees of a case: the notice, the window, their response, the decision. */
export interface MyCase {
  id: string;
  status: CaseStatus;
  reason: CaseReason;
  detail: string | null;
  sessions: { title: string; date: string }[];
  notice_sent_at: string;
  respond_by: string;
  response: string | null;
  responded_at: string | null;
  decision: Decision | null;
  decision_reason: string | null;
  decided_at: string | null;
}

export interface SaveTurnInput {
  turn_id: string;
  verified_text: string;
  english_gloss: string;
  emotion: string | null;
  confidence: number | null;
  issues: string[];
  verified_seconds: number | null;
  rating_check: RatingCheck | null;
  alignments: unknown[];
}

export const REASON_LABEL: Record<CaseReason, string> = {
  rating_mismatch: "Rating does not match the audio",
  not_live: "Not a live voice (synthetic, replayed or pre-recorded)",
  impersonation: "Someone else's voice",
  duplicate_content: "Same content across sessions",
  filler: "Filler, repeated or nonsense content",
  pairing_interference: "Interfering with pairing",
  voice_taken_outside: "Took a partner's voice outside the app",
  identity: "Misrepresented identity, age, language or region",
  other: "Other",
};
export const EMOTIONS = ["neutral", "frustrated", "empathetic", "playful", "firm_friendly", "relieved", "skeptical", "focused_professional", "reassuring", "apologetic"] as const;
export const ISSUES: [string, string][] = [
  ["noise", "Background noise"],
  ["clipping", "Distorted or clipped"],
  ["too_quiet", "Too quiet"],
  ["off_brief", "Off the card"],
  ["wrong_language", "Not the target language"],
  ["pii", "Real personal details spoken"],
  ["not_live", "Sounds replayed or synthetic"],
  ["filler", "Filler or nonsense"],
];
export const CONFIDENCE: [number, string][] = [
  [1, "Sure"],
  [0.85, "Mostly sure"],
  [0.7, "Unsure in places"],
  [0.5, "Guessing"],
];
export const STATUS_LABEL: Record<CaseStatus, string> = {
  flagged: "Flagged · awaiting review",
  under_review: "Reviewed · notice not sent yet",
  notice_sent: "Notice sent · waiting for a response",
  responded: "Response in · awaiting a decision",
  decided: "Decided",
};

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const queue = (): Promise<Queue> => (isDemo() ? demoVerify.queue() : rpc<Queue>("vq_queue"));
export const claim = (sid: string): Promise<void> => (isDemo() ? demoVerify.claim(sid) : rpc<unknown>("vq_claim", { sid }).then(() => undefined));
export const workbench = (sid: string): Promise<Workbench> => (isDemo() ? demoVerify.workbench(sid) : rpc<Workbench>("vq_session", { sid }));
export const saveTurn = (i: SaveTurnInput): Promise<void> =>
  isDemo()
    ? demoVerify.saveTurn(i)
    : rpc<unknown>("vq_save_turn", { tid: i.turn_id, verified_text: i.verified_text, english_gloss: i.english_gloss, emotion: i.emotion, confidence: i.confidence, issues: i.issues, verified_seconds: i.verified_seconds, rating_check: i.rating_check, alignments: i.alignments }).then(() => undefined);
export interface EarningPost {
  speaker: Speaker;
  speaker_id: string | null;
  seconds: number;
  peer_score: number | null;
  quality_score: number;
  tier: string;
  multiplier: number;
  base_rate_usd: number;
  amount_usd: number;
  status: string;
}
export interface VerifyResult {
  peer_score: number | null;
  quality_score: number;
  quality_tier: string;
  multiplier: number;
  verified_seconds: number;
  hold: boolean;
  draft_wer: number | null;
  aligned_turns?: number;
  earnings?: EarningPost[];
}
export const verifySession = (sid: string, editorScore: number, notes: string): Promise<VerifyResult> =>
  isDemo() ? demoVerify.verify(sid, editorScore, notes) : rpc<VerifyResult>("vq_verify", { sid, editor_score: editorScore, notes });
export const flag = (sid: string, who: Speaker, reason: CaseReason, detail: string, tid: string | null): Promise<{ case_id: string }> =>
  isDemo() ? demoVerify.flag(sid, who, reason, detail, tid) : rpc<{ case_id: string }>("vq_flag", { sid, who, reason, detail, tid });

/** Asks the stt-draft function for a machine draft of every take that lacks one. Resolves when the vendor is done. */
export async function draft(sid: string, retry = false): Promise<{ ok: boolean; done: number; failed: number; skipped: number; reason?: string }> {
  if (isDemo()) return demoVerify.draft(sid);
  const { data, error } = await supabase.functions.invoke("stt-draft", { body: { session_id: sid, retry } });
  if (error) throw new Error(error.message);
  if (!data?.ok) throw new Error((data as { error?: string } | null)?.error ?? "Drafting failed");
  return data as { ok: boolean; done: number; failed: number; skipped: number; reason?: string };
}

/** Asks the gloss model for an English gloss of an edited transcript. Returns it; stores nothing. */
export async function regloss(turnId: string, text: string): Promise<{ gloss: string; engine: string }> {
  if (isDemo()) return demoVerify.regloss(turnId, text);
  const { data, error } = await supabase.functions.invoke("stt-draft", { body: { kind: "gloss", turn_id: turnId, text } });
  if (error) throw new Error(error.message);
  if (!data?.ok) throw new Error((data as { error?: string } | null)?.error ?? "Could not gloss");
  return { gloss: String(data.gloss ?? ""), engine: String(data.engine ?? "") };
}

export const cases = (): Promise<Cases> => (isDemo() ? demoVerify.cases() : rpc<Cases>("ic_cases"));
export const review = (cid: string, note: string, proceed: boolean): Promise<void> =>
  isDemo() ? demoVerify.review(cid, note, proceed) : rpc<unknown>("ic_review", { cid, note, proceed }).then(() => undefined);
export const decide = (cid: string, decision: Decision, reason: string): Promise<void> =>
  isDemo() ? demoVerify.decide(cid, decision, reason) : rpc<unknown>("ic_decide", { cid, decision, reason }).then(() => undefined);

/** Sends the notice or the decision email through the integrity-notice function; the notice also opens the response window. */
export async function notify(cid: string, kind: "notice" | "decision"): Promise<{ mailed: boolean }> {
  if (isDemo()) return demoVerify.notify(cid, kind);
  const { data, error } = await supabase.functions.invoke("integrity-notice", { body: { case_id: cid, kind } });
  if (error) throw new Error(error.message);
  if (!data?.ok) throw new Error((data as { error?: string } | null)?.error ?? "Could not send");
  return { mailed: Boolean(data.mailed) };
}

export const myCases = (): Promise<MyCase[]> => (isDemo() ? demoVerify.myCases() : rpc<MyCase[]>("my_cases"));
export const respond = (cid: string, text: string): Promise<void> =>
  isDemo() ? demoVerify.respond(cid, text) : rpc<unknown>("ic_respond", { cid, response: text }).then(() => undefined);

export function daysLeft(iso: string | null): number {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}
export const when = (iso: string | null): string => (iso ? new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
