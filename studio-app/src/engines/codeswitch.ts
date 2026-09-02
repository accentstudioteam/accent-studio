// Heuristic code-switch tagger. Classifies each token of a target-language
// transcript as English (EN) or target (TGT) using an English gazetteer +
// function-word set, and emits the switch spans. This is a rules v1; a trained
// classifier replaces it in the model phase, but this already tags the common
// banking/telco/fintech code-switch that dominates the corpus.

const EN_FUNCTION = new Set([
  "the", "a", "an", "and", "or", "but", "so", "to", "of", "in", "on", "for",
  "is", "are", "was", "were", "i", "you", "we", "they", "he", "she", "it",
  "my", "your", "our", "me", "please", "thank", "thanks", "yes", "no", "not",
  "this", "that", "here", "there", "now", "today", "okay", "ok", "how", "much",
  "have", "will", "can", "do", "did", "up", "out", "with", "at", "one", "two",
]);

// Domain English terms that survive verbatim inside Pidgin / Swahili speech.
const EN_TERMS = new Set([
  "bank", "account", "pos", "transaction", "transactions", "refund", "card",
  "data", "bundle", "network", "sim", "airtime", "verify", "verified",
  "verification", "id", "kyc", "tier", "selfie", "app", "payment", "balance",
  "receipt", "phone", "screen", "charging", "replacement", "unlimited",
  "social", "video", "streaming", "usage", "log", "system", "bonus", "final",
  "price", "market", "customer", "agent", "morning", "sorry", "good",
  "fixed", "route", "traffic", "fare", "meeting", "radio", "short-cut", "five",
  "stars", "tip", "service", "seconds", "minutes",
]);

// Target-language particles / markers that are unambiguously non-English.
const TGT_MARKERS = new Set([
  // Pidgin
  "o", "abeg", "dey", "don", "wey", "na", "sha", "commot", "wetin", "make",
  "sabi", "wahala", "oga", "aunty", "abi", "biko", "ehen", "ehn", "haba",
  // Swahili / Sheng
  "ni", "kwa", "sawa", "habari", "asante", "ndio", "hapana", "pesa", "sasa",
  "bwana", "karibu", "tafadhali", "naomba", "niaje", "poa", "bomba",
]);

export type Lang = "EN" | "TGT";

export interface TokenTag {
  token: string;
  lang: Lang;
}

export interface CodeSwitchResult {
  tags: TokenTag[];
  switches: string[]; // e.g. ["EN->PCM", "PCM->EN"]  (target label passed in)
  hasSwitch: boolean;
  enRatio: number;
}

function classify(raw: string): Lang {
  const t = raw.toLowerCase().replace(/[^a-z0-9'-]/g, "");
  if (!t) return "TGT";
  if (TGT_MARKERS.has(t)) return "TGT";
  if (EN_FUNCTION.has(t) || EN_TERMS.has(t)) return "EN";
  // English morphology hints
  if (/(tion|ing|ment|ed|ly)$/.test(t) && t.length > 4) return "EN";
  return "TGT";
}

/** `targetLabel` is the ISO-ish tag for the non-English side, e.g. "PCM", "SW". */
export function tagCodeSwitch(text: string, targetLabel = "PCM"): CodeSwitchResult {
  const tokens = text.split(/\s+/).filter(Boolean);
  const tags: TokenTag[] = tokens.map((tok) => ({ token: tok, lang: classify(tok) }));

  const switches: string[] = [];
  for (let i = 1; i < tags.length; i++) {
    if (tags[i].lang !== tags[i - 1].lang) {
      const from = tags[i - 1].lang === "EN" ? "EN" : targetLabel;
      const to = tags[i].lang === "EN" ? "EN" : targetLabel;
      const pair = `${from}->${to}`;
      if (!switches.includes(pair)) switches.push(pair);
    }
  }
  const enCount = tags.filter((t) => t.lang === "EN").length;
  return {
    tags,
    switches: switches.length ? switches : [`${targetLabel}->${targetLabel}`],
    hasSwitch: switches.length > 0,
    enRatio: tokens.length ? enCount / tokens.length : 0,
  };
}
