// Earnings and payouts: one line per speaker per verified rally, paid per verified hour at the
// published base rate times the speaker's tier. RPC wrappers; demo mode runs in memory.
import { supabase } from "@/lib/supabase";
import { demo, isDemo } from "@/lib/demo";
import { demoVerify } from "@/lib/demoVerify";

export type LineStatus = "held" | "cleared" | "requested" | "paid" | "forfeited";
export interface EarningLine {
  id: string;
  session_id: string;
  title: string;
  date: string;
  language: string;
  verified_seconds: number;
  quality_tier: string | null;
  multiplier: number;
  base_rate_usd: number;
  amount_usd: number;
  status: LineStatus;
  month: string;
}
export interface PayoutRow {
  id: string;
  requested_at: string;
  rail: string;
  amount_usd: number;
  status: "requested" | "paid" | "cancelled";
  paid_at: string | null;
  reference: string | null;
}
export interface Rail {
  key: string;
  name: string;
  min: number;
}
export interface MyEarnings {
  cleared_usd: number;
  held_usd: number;
  requested_usd: number;
  paid_usd: number;
  forfeited_usd: number;
  ap_per_usd: number;
  payout_days: number;
  base_rates: { standard: number; scarce: number };
  rails: Rail[];
  my_rail: string | null;
  rail_min: number | null;
  open_request: boolean;
  lines: EarningLine[];
  payouts: PayoutRow[];
}
/** One rally a contributor has recorded that no linguist has priced yet. */
export interface ProvisionalRally {
  session_id: string;
  title: string;
  date: string;
  seconds: number;
  base_rate_usd: number;
  estimate_usd: number;
  /** "recording" while the rally is still going; "reviewing" once it is closed and waiting on a linguist. */
  stage: "recording" | "reviewing";
  held: boolean;
}
/** my_provisional_earnings: recorded seconds nobody has checked yet, priced at the lowest quality tier. */
export interface Provisional {
  pending_seconds: number;
  pending_rallies: number;
  estimate_usd: number;
  recording_usd: number;
  reviewing_usd: number;
  multiplier: number;
  tier: string;
  top_multiplier: number;
  base_rate_usd: number | null;
  held_seconds: number;
  held_rallies: number;
  rallies: ProvisionalRally[];
}
export interface QueuedPayout extends PayoutRow {
  speaker_id: string;
  lines: number;
  paid_by: string | null;
  details?: Record<string, string> | null;
  identity?: string | null;
}
export interface PayoutQueue {
  payouts: QueuedPayout[];
  requested_usd: number;
  held_usd: number;
  cleared_usd: number;
  paid_usd: number;
}

export const STATUS_WORD: Record<LineStatus, string> = { held: "on hold", cleared: "ready", requested: "on its way", paid: "paid", forfeited: "forfeited" };
export const TIER_WORD: Record<string, string> = { platinum: "Platinum", gold: "Gold", silver: "Silver", floor: "Floor" };
export const money = (n: number | string | null | undefined): string => `$${Number(n ?? 0).toFixed(2)}`;
export const ap = (usd: number | string, perUsd: number): string => `${Math.round(Number(usd) * perUsd).toLocaleString()} AP`;
/** How long that is, the way a person would say it: "48 seconds", "1 minute", "11 minutes". */
export const spoken = (secs: number | string): string => {
  const n = Math.round(Number(secs ?? 0));
  if (n < 60) return `${n} second${n === 1 ? "" : "s"}`;
  const m = Math.round(n / 60);
  return `${m} minute${m === 1 ? "" : "s"}`;
};
export const monthName = (ym: string): string => new Date(`${ym}-01T00:00:00Z`).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const myEarnings = (): Promise<MyEarnings> => (isDemo() ? demo.myEarnings() : rpc<MyEarnings>("my_earnings"));
export const myProvisional = (): Promise<Provisional> => (isDemo() ? demo.myProvisional() : rpc<Provisional>("my_provisional_earnings"));
export const requestPayout = (rail: string): Promise<{ amount_usd: number }> => (isDemo() ? demo.requestPayout(rail) : rpc<{ amount_usd: number }>("request_payout", { rail }));
export const cancelPayout = (pid: string): Promise<void> => (isDemo() ? demo.cancelPayout(pid) : rpc<unknown>("cancel_payout", { pid }).then(() => undefined));
export const payoutsQueue = (): Promise<PayoutQueue> => (isDemo() ? demoVerify.payoutsQueue() : rpc<PayoutQueue>("payouts_queue"));
export const markPaid = (pid: string, reference: string): Promise<{ amount_usd: number }> => (isDemo() ? demoVerify.markPaid(pid, reference) : rpc<{ amount_usd: number }>("mark_paid", { pid, reference }));
