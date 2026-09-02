// Persona + mood engine. Personas carry traits and a base emotion; the mood
// engine gives a scene an emotional arc across its turns. Dependency-free.

export type Emotion =
  | "neutral"
  | "frustrated"
  | "empathetic"
  | "playful"
  | "firm_friendly"
  | "relieved"
  | "skeptical"
  | "focused_professional"
  | "reassuring"
  | "apologetic";

export interface Persona {
  key: string;
  name: string;
  role: string; // customer, agent, buyer, seller, rider, driver, claimant, adjuster…
  traits: string[];
  baseMood: Emotion;
  blurb: string;
}

export const PERSONAS: Persona[] = [
  { key: "confused_senior", name: "The Confused Senior", role: "customer", traits: ["polite", "unsure", "repeats"], baseMood: "neutral", blurb: "older customer, screen-averse, needs patience" },
  { key: "impatient_exec", name: "The Impatient Exec", role: "customer", traits: ["fast", "clipped", "no time"], baseMood: "frustrated", blurb: "customer · fast · clipped" },
  { key: "suspicious_uncle", name: "The Suspicious Uncle", role: "customer", traits: ["distrustful", "probing"], baseMood: "skeptical", blurb: "certain it's a scam, wants proof" },
  { key: "worried_parent", name: "The Worried Parent", role: "customer", traits: ["anxious", "urgent"], baseMood: "frustrated", blurb: "money missing, real stakes" },
  { key: "empathetic_agent", name: "The Empathetic Agent", role: "agent", traits: ["warm", "calm", "solver"], baseMood: "empathetic", blurb: "agent · warm · professional" },
  { key: "by_the_book_agent", name: "The By-the-Book Agent", role: "agent", traits: ["precise", "policy-first"], baseMood: "focused_professional", blurb: "agent · correct, a little stiff" },
  { key: "market_seller", name: "The Market Seller", role: "seller", traits: ["shrewd", "warm", "holds price"], baseMood: "firm_friendly", blurb: "seller · friendly but immovable" },
  { key: "cheeky_buyer", name: "The Cheeky Buyer", role: "buyer", traits: ["playful", "teasing", "haggler"], baseMood: "playful", blurb: "buyer · here to win the haggle" },
  { key: "hurried_rider", name: "The Hurried Rider", role: "rider", traits: ["late", "tense"], baseMood: "frustrated", blurb: "rider · running late" },
  { key: "steady_driver", name: "The Steady Driver", role: "driver", traits: ["calm", "explains"], baseMood: "reassuring", blurb: "driver · unflappable" },
];

export function personasForRole(role: string): Persona[] {
  return PERSONAS.filter((p) => p.role === role);
}

/**
 * Build an emotional arc for one speaker across `turns` turns, starting from
 * their base mood and resolving toward a calmer end state (typical of a
 * complaint that gets solved). Deterministic given the inputs.
 */
export function moodArc(base: Emotion, turns: number, resolve = true): Emotion[] {
  const escalated: Emotion = base === "skeptical" ? "skeptical" : base === "playful" ? "playful" : "frustrated";
  const settled: Emotion[] = ["relieved", "firm_friendly", "neutral"];
  const arc: Emotion[] = [];
  for (let i = 0; i < turns; i++) {
    const t = turns <= 1 ? 1 : i / (turns - 1);
    if (!resolve) arc.push(base);
    else if (t < 0.34) arc.push(base);
    else if (t < 0.7) arc.push(escalated);
    else arc.push(settled[Math.min(settled.length - 1, Math.floor((t - 0.7) / 0.1))]);
  }
  return arc;
}

/** The counterpart (agent-side) emotion that best answers a given customer mood. */
export function responseMood(customer: Emotion): Emotion {
  switch (customer) {
    case "frustrated": return "empathetic";
    case "skeptical": return "reassuring";
    case "playful": return "firm_friendly";
    case "relieved": return "reassuring";
    default: return "focused_professional";
  }
}
