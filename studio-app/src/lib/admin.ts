// Admin operations: the overview, staff roles and invites, the contributor roster and controls, and the
// audit queue where a second editor checks sampled verifications. RPC wrappers; demo mode runs in memory.
import { supabase } from "@/lib/supabase";
import { isDemo } from "@/lib/demo";
import { demoAdmin } from "@/lib/demoAdmin";
import { demoVerify } from "@/lib/demoVerify";

export interface Overview {
  contributors: { active: number; paused: number; closed: number; active_7d: number };
  pipeline: { applications_new: number; invitations_open: number };
  play: { rallies_7d: number; scenes_7d: number; active_now: number; bookings_upcoming: number };
  cutting_room: { queue: number; verified_total: number; verified_hours: number; audit_pending: number; cases_open: number };
  money: { requested_usd: number; cleared_usd: number; held_usd: number; paid_usd: number };
  labs: { projects_open: number; deliveries_ready: number; inquiries_new: number };
}

export interface StaffPerson {
  id: string;
  email: string;
  handle: string | null;
  editor_id: string | null;
  is_admin: boolean;
  is_linguist: boolean;
  is_contributor: boolean;
  verified: number;
  audited: number;
  last_verified_at: string | null;
  last_sign_in_at: string | null;
  created_at: string;
  me: boolean;
}
export interface StaffInvite {
  email: string;
  note: string | null;
  created_at: string;
  signed_up: boolean;
}
export interface AdminEvent {
  at: string;
  actor: string | null;
  kind: string;
  detail: Record<string, unknown>;
}
export interface Staff {
  people: StaffPerson[];
  invited: StaffInvite[];
  events: AdminEvent[];
  admins: number;
}
export type StaffRole = "admin" | "linguist";

export type ContributorStatus = "active" | "paused" | "closed" | "withdrawn";
export interface ContributorRow {
  id: string;
  speaker_id: string;
  full_name: string | null;
  email: string | null;
  languages: string[];
  primary_language: string | null;
  country: string | null;
  city: string | null;
  created_at: string;
  last_active_at: string | null;
  status: ContributorStatus;
  paused_until: string | null;
  paused_reason: string | null;
  closed_at: string | null;
  closed_reason: string | null;
  withdrawn_at: string | null;
  admin_note: string | null;
  rallies: number;
  scenes: number;
  abandoned: number;
  verified_seconds: number;
  avg_quality: number | null;
  earned_usd: number;
  paid_usd: number;
  held_usd: number;
  cleared_usd: number;
  arena_strikes: number;
  arena_paused_until: string | null;
  quiet_count: number;
  open_cases: number;
  confirmed_cases: number;
  consent: { agreement_version: string; signed_at: string; withdrawn_at: string | null; record_sha256: string } | null;
}
export interface ContributorSession {
  id: string;
  title: string;
  mode: "async" | "live";
  status: string;
  abandoned_reason: string | null;
  abandoned_by_me: boolean | null;
  at: string;
  language: string;
  partner: string | null;
  quality_tier: string | null;
  verified: boolean | null;
  audit_outcome: string | null;
  my_seconds: number;
  earned_usd: number | null;
  earning_status: string | null;
}
export interface ContributorPayout {
  id: string;
  rail: string;
  amount_usd: number;
  status: string;
  requested_at: string;
  paid_at: string | null;
  reference: string | null;
}
export interface ContributorCase {
  id: string;
  reason: string;
  status: string;
  decision: string | null;
  created_at: string;
  decided_at: string | null;
}
export interface ContributorBooking {
  id: string;
  starts_at: string;
  status: string;
  language: string;
}
export interface SentNotification {
  id: number;
  kind: string;
  created_at: string;
  sent_at: string | null;
  attempts: number;
  error: string | null;
}
export interface ContributorDetail extends ContributorRow {
  notifications: SentNotification[];
  sessions: ContributorSession[];
  payouts: ContributorPayout[];
  cases: ContributorCase[];
  bookings: ContributorBooking[];
  events: AdminEvent[];
}
export interface Roster {
  people: ContributorRow[];
  counts: { active: number; paused: number; closed: number; withdrawn: number };
}
export type ContributorAction = "pause" | "unpause" | "close" | "reopen" | "note";

export interface AuditItem {
  session_id: string;
  title: string;
  language: string;
  mode: "async" | "live";
  verified_at: string;
  editor_id: string | null;
  editor_score: number;
  peer_score: number | null;
  quality_score: number;
  quality_tier: string;
  verified_seconds: number;
  turns: number;
  mine: boolean;
  hold: boolean;
  paid: boolean;
}
export interface AuditDone {
  session_id: string;
  title: string;
  language: string;
  audited_at: string;
  auditor_id: string | null;
  editor_id: string | null;
  outcome: "upheld" | "adjusted";
  original_tier: string | null;
  quality_tier: string | null;
  original_editor_score: number | null;
  audit_score: number | null;
  note: string | null;
}
export interface AuditQueue {
  sample_pct: number;
  my_editor: string;
  pending: AuditItem[];
  done: AuditDone[];
  verified_total: number;
  audited_total: number;
}
export interface NotifyLog {
  recent: (SentNotification & { speaker_id: string | null })[];
  unsent: number;
  sent_7d: number;
  cron: { name: string; schedule: string; active: boolean }[];
}
export interface NotifyRun {
  claimed: number;
  sent: number;
  failed: number;
  results: { id: number; kind: string; ok: boolean; error?: string }[];
}
export const NOTIFY_LABEL: Record<string, string> = { reply_due: "reply due", booking_soon: "scene in an hour", case_window_closing: "clause 15 window closing", payout_paid: "payout sent", statement: "monthly statement" };

export interface AuditResult {
  outcome: "upheld" | "adjusted";
  quality_tier: string;
  lines_repriced: number;
  lines_untouched: number;
}

export const STATUS_LABEL: Record<ContributorStatus, string> = { active: "active", paused: "paused", closed: "closed", withdrawn: "withdrawn" };
export const KIND_LABEL: Record<string, string> = {
  audit: "audit",
  staff_role: "role changed",
  staff_invite: "invited",
  staff_uninvite: "invite removed",
  contributor_pause: "paused",
  contributor_unpause: "pause lifted",
  contributor_close: "closed",
  contributor_reopen: "reopened",
  contributor_note: "note",
};

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const overview = (): Promise<Overview> => (isDemo() ? demoAdmin.overview() : rpc<Overview>("admin_overview"));
export const staff = (): Promise<Staff> => (isDemo() ? demoAdmin.staff() : rpc<Staff>("staff_list"));
export const staffInvite = (email: string, role: StaffRole, note: string): Promise<{ email: string; already_signed_up: boolean }> =>
  isDemo() ? demoAdmin.staffInvite(email, role, note) : rpc("staff_invite", { email, role, note });
export const staffSet = (uid: string, role: StaffRole, on: boolean): Promise<{ editor_id: string | null }> =>
  isDemo() ? demoAdmin.staffSet(uid, role, on) : rpc("staff_set", { uid, role, on_: on });
export const staffUninvite = (email: string): Promise<{ removed: number }> => (isDemo() ? demoAdmin.staffUninvite(email) : rpc("staff_uninvite", { email }));
export const contributors = (): Promise<Roster> => (isDemo() ? demoAdmin.contributors() : rpc<Roster>("admin_contributors"));
export const contributor = (cid: string): Promise<ContributorDetail> => (isDemo() ? demoAdmin.contributor(cid) : rpc<ContributorDetail>("admin_contributor", { cid }));
export const contributorSet = (cid: string, action: ContributorAction, reason: string | null, days: number | null): Promise<ContributorRow> =>
  isDemo() ? demoAdmin.contributorSet(cid, action, reason, days) : rpc<ContributorRow>("admin_contributor_set", { cid, action, reason, days });
export const auditQueue = (): Promise<AuditQueue> => (isDemo() ? demoVerify.auditQueue() : rpc<AuditQueue>("audit_queue"));
export const auditRecord = (sid: string, outcome: "upheld" | "adjusted", score: number | null, note: string): Promise<AuditResult> =>
  isDemo() ? demoVerify.auditRecord(sid, outcome, score, note) : rpc<AuditResult>("audit_record", { sid, outcome, score, note });

export const notifyLog = (): Promise<NotifyLog> => (isDemo() ? demoAdmin.notifyLog() : rpc<NotifyLog>("notify_log", { lim: 100 }));
export async function notifyNow(): Promise<NotifyRun> {
  if (isDemo()) return demoAdmin.notifyNow();
  const { data, error } = await supabase.functions.invoke("notify", { body: { source: "studio", limit: 100 } });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(String(data.error));
  return data as NotifyRun;
}

export const hours = (secs: number | string | null | undefined): string => `${(Number(secs ?? 0) / 3600).toFixed(2)} h`;
