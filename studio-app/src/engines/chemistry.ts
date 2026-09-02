// Chemistry engine. Scores how well a live scene flowed, from measurable signals
// a real session would emit. Pure function, 0–10. In production the signals come
// from LiveKit timing + STT; here the same math scores simulated or real inputs.

export interface SceneSignals {
  avgTurnLatencyMs: number; // gap between turns; ~350ms feels natural, >1500 drags
  turnBalance: number; // 0..1, how evenly the two speakers shared airtime
  emotionContinuity: number; // 0..1, did moods answer each other coherently
  overlapNaturalness: number; // 0..1, some interruption is good, too much is chaos
  promptAdherence: number; // 0..1, did they stay in the scene
  turns: number; // total turns; a scene needs room to breathe
}

export interface ChemistryResult {
  score: number; // 0..10, one decimal
  band: "cold" | "warm" | "flowing" | "electric";
  breakdown: { label: string; pts: number; max: number }[];
}

function latencyScore(ms: number): number {
  // best around 300–500ms; falls off either side
  if (ms <= 500) return 1 - Math.max(0, (300 - ms)) / 600;
  return Math.max(0, 1 - (ms - 500) / 1500);
}

export function scoreChemistry(s: SceneSignals): ChemistryResult {
  const parts = [
    { label: "Pace", pts: latencyScore(s.avgTurnLatencyMs) * 2.5, max: 2.5 },
    { label: "Balance", pts: s.turnBalance * 2, max: 2 },
    { label: "Emotional fit", pts: s.emotionContinuity * 2, max: 2 },
    { label: "Natural overlap", pts: s.overlapNaturalness * 1.5, max: 1.5 },
    { label: "In-scene", pts: s.promptAdherence * 2, max: 2 },
  ];
  let raw = parts.reduce((a, p) => a + p.pts, 0);
  // scenes that are too short can't build chemistry
  if (s.turns < 4) raw *= 0.7;
  const score = Math.round(Math.min(10, raw) * 10) / 10;
  const band = score >= 9 ? "electric" : score >= 7.5 ? "flowing" : score >= 5.5 ? "warm" : "cold";
  return { score, band, breakdown: parts.map((p) => ({ ...p, pts: Math.round(p.pts * 10) / 10 })) };
}

/** Standing-ovation threshold → bonus AP multiplier on the scene payout. */
export function chemistryBonus(score: number): number {
  if (score >= 9) return 1.5;
  if (score >= 7.5) return 1.25;
  if (score >= 5.5) return 1.0;
  return 0.8;
}
