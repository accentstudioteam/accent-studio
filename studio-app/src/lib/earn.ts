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
export interface QueuedPayout extends PayoutRow {
  speaker_id: string;
  lines: number;
  paid_by: string | null;
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
export const monthName = (ym: string): string => new Date(`${ym}-01T00:00:00Z`).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const myEarnings = (): Promise<MyEarnings> => (isDemo() ? demo.myEarnings() : rpc<MyEarnings>("my_earnings"));
export const requestPayout = (rail: string): Promise<{ amount_usd: number }> => (isDemo() ? demo.requestPayout(rail) : rpc<{ amount_usd: number }>("request_payout", { rail }));
export const cancelPayout = (pid: string): Promise<void> => (isDemo() ? demo.cancelPayout(pid) : rpc<unknown>("cancel_payout", { pid }).then(() => undefined));
export const payoutsQueue = (): Promise<PayoutQueue> => (isDemo() ? demoVerify.payoutsQueue() : rpc<PayoutQueue>("payouts_queue"));
export const markPaid = (pid: string, reference: string): Promise<{ amount_usd: number }> => (isDemo() ? demoVerify.markPaid(pid, reference) : rpc<{ amount_usd: number }>("mark_paid", { pid, reference }));
