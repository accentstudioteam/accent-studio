// Word-alignment engine: types a source→target span pair by linguistic
// phenomenon, and proposes an initial alignment for an editor to confirm in the
// Cutting Room. Rules v1 (Pidgin/Swahili-aware); a statistical aligner can
// pre-fill later, but the typing rules stay useful as labels.

export type AlignType =
  | "direct"
  | "lexical"
  | "aspect_shift"
  | "serial_verb"
  | "copula_substitution"
  | "null_particle"
  | "null_source"
  | "numeric_expansion"
  | "emphatic_particle"
  | "honorific_addition"
  | "discourse_marker";

const ASPECT = /\b(don|dey|go|bin)\b/i;              // Pidgin aspect markers
const SERIAL = /\b(see say|comot|commot|waka go)\b/i; // serial-verb constructions
const COPULA = /\b(na|ni|yi)\b/i;                     // "is/that is" substitutes
const EMPHATIC = /\b(o|sha|jare)\b/i;                 // emphatic particles
const DISCOURSE = /\b(ehn|ehen|abeg|haba|oh|ah)\b/i;  // discourse markers
const HONORIFIC = /\b(oga|aunty|sir|madam|bwana|ma)\b/i;
const NUMWORDS = /\b(thousand|hundred|fifty|five|ten|twenty|k)\b/i;

export interface AlignSpan {
  src: string;
  tgt: string;
  type: AlignType;
  confidence: number;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9₦'\s-]/g, "").trim();
}

/** Classify a single source↔target span pair. */
export function typeSpan(src: string, tgt: string): AlignType {
  const s = norm(src);
  const t = norm(tgt);
  if (!s && t) {
    if (EMPHATIC.test(t)) return "emphatic_particle";
    if (DISCOURSE.test(t)) return "discourse_marker";
    if (HONORIFIC.test(t)) return "honorific_addition";
    return "null_particle";
  }
  if (s && !t) return "null_source";
  if (s === t) return "direct";
  if (SERIAL.test(t)) return "serial_verb";
  if (COPULA.test(t) && t.split(" ").length <= 4) return "copula_substitution";
  if (ASPECT.test(t) && !ASPECT.test(s)) return "aspect_shift";
  if (/[₦$]|\d/.test(s) && NUMWORDS.test(t)) return "numeric_expansion";
  if (HONORIFIC.test(t) && !HONORIFIC.test(s)) return "honorific_addition";
  return "lexical";
}

/**
 * Propose a monotonic alignment between source and target token spans. Extra
 * target tokens with no clear source are flagged as null particles. Returns
 * proposals with a confidence the editor can accept or override.
 */
export function autoAlign(srcSpans: string[], tgtSpans: string[]): AlignSpan[] {
  const out: AlignSpan[] = [];
  const n = Math.min(srcSpans.length, tgtSpans.length);
  for (let i = 0; i < n; i++) {
    const type = typeSpan(srcSpans[i], tgtSpans[i]);
    const conf = type === "direct" ? 0.99 : type === "lexical" ? 0.9 : 0.82;
    out.push({ src: srcSpans[i], tgt: tgtSpans[i], type, confidence: conf });
  }
  // leftover target spans → particles / null-source
  for (let i = n; i < tgtSpans.length; i++) {
    out.push({ src: "", tgt: tgtSpans[i], type: typeSpan("", tgtSpans[i]), confidence: 0.8 });
  }
  for (let i = n; i < srcSpans.length; i++) {
    out.push({ src: srcSpans[i], tgt: "", type: "null_source", confidence: 0.75 });
  }
  return out;
}

export const ALIGN_TYPE_LABEL: Record<AlignType, string> = {
  direct: "direct",
  lexical: "lexical",
  aspect_shift: "aspect shift",
  serial_verb: "serial verb",
  copula_substitution: "copula",
  null_particle: "null particle",
  null_source: "null source",
  numeric_expansion: "numeric",
  emphatic_particle: "emphatic",
  honorific_addition: "honorific",
  discourse_marker: "discourse marker",
};
