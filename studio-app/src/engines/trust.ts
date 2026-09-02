// Trust, QA-multiplier, payout, rank, and anti-fraud math. All the numbers the
// economy and integrity systems run on. Pure functions, matches the PRD's
// published schedule so the prototype's figures are real, not decorative.

export type QaTier = "platinum" | "gold" | "silver" | "rejected";

/** Peer quality score (0..1) → tier + payout multiplier. PRD §9. */
export function qaTier(qualityScore: number): { tier: QaTier; multiplier: number } {
  if (qualityScore >= 0.95) return { tier: "platinum", multiplier: 1.2 };
  if (qualityScore >= 0.8) return { tier: "gold", multiplier: 1.0 };
  if (qualityScore >= 0.7) return { tier: "silver", multiplier: 0.7 };
  return { tier: "rejected", multiplier: 0 };
}

/** Aggregate a 4-axis peer rating (each 1..5) to a 0..1 quality score. */
export function ratingToQuality(r: { tone: number; prompt: number; mood: number; clarity: number }): number {
  const avg = (r.tone + r.prompt + r.mood + r.clarity) / 4;
  return Math.max(0, Math.min(1, avg / 5));
}

export interface TrustInputs {
  accepted: number; // takes accepted
  submitted: number; // takes submitted
  auditPasses: number;
  auditTotal: number;
  honeypotPasses: number;
  honeypotTotal: number;
  flags: number; // fraud/quality flags raised
}

/** Composite trust score 0..1. Drives queue access + shadowban thresholds. */
export function trustScore(t: TrustInputs): number {
  const acceptance = t.submitted ? t.accepted / t.submitted : 1;
  const audit = t.auditTotal ? t.auditPasses / t.auditTotal : 1;
  const honeypot = t.honeypotTotal ? t.honeypotPasses / t.honeypotTotal : 1;
  const flagPenalty = Math.min(0.5, t.flags * 0.1);
  const raw = acceptance * 0.4 + audit * 0.35 + honeypot * 0.25 - flagPenalty;
  return Math.max(0, Math.min(1, raw));
}

export type Standing = "trusted" | "watch" | "shadowban" | "banned";

export function standingFor(trust: number, flags: number): Standing {
  if (flags >= 3) return "banned";
  if (trust < 0.4) return "shadowban";
  if (trust < 0.6) return "watch";
  return "trusted";
}

/** Base $ per verified hour by tier band, before the QA multiplier. PRD §3. */
export function baseHourlyUsd(band: "standard" | "high_demand" | "bespoke"): [number, number] {
  if (band === "bespoke") return [18, 30];
  if (band === "high_demand") return [15, 24];
  return [7.2, 12];
}

export function payoutForHour(band: "standard" | "high_demand" | "bespoke", multiplier: number): [number, number] {
  const [lo, hi] = baseHourlyUsd(band);
  return [Math.round(lo * multiplier * 100) / 100, Math.round(hi * multiplier * 100) / 100];
}

export interface Rank {
  name: string;
  min: number;
}
export const RANKS: Rank[] = [
  { name: "Extra", min: 0 },
  { name: "Featured", min: 2000 },
  { name: "Supporting", min: 8000 },
  { name: "Lead", min: 25000 },
  { name: "Showrunner", min: 75000 },
];

export function rankForAp(ap: number): { current: Rank; next: Rank | null; toNext: number } {
  let current = RANKS[0];
  for (const r of RANKS) if (ap >= r.min) current = r;
  const next = RANKS.find((r) => r.min > ap) ?? null;
  return { current, next, toNext: next ? next.min - ap : 0 };
}

// ---- anti-fraud heuristics (signal stubs; models augment later) ----

/** Flags likely synthetic/cloned/pre-recorded audio from lightweight signals. */
export function syntheticAudioRisk(sig: { snrDb: number; clippingRatio: number; silenceRatio: number; spectralFlatness: number }): { risk: number; flag: boolean } {
  // unnaturally clean + flat spectrum + little natural silence => suspicious
  let risk = 0;
  if (sig.snrDb > 45) risk += 0.3; // studio-perfect on a phone scene is odd
  if (sig.spectralFlatness > 0.6) risk += 0.35; // TTS tends flatter
  if (sig.silenceRatio < 0.03) risk += 0.2; // no breaths/pauses
  if (sig.clippingRatio > 0.2) risk += 0.15;
  return { risk: Math.min(1, risk), flag: risk >= 0.5 };
}

/** SNR gate from PRD: below 15 dB auto-disqualifies. */
export function snrAcceptable(snrDb: number): boolean {
  return snrDb >= 15;
}
