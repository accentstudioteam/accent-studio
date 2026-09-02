// PII detection + redaction engine. Regex detectors for the personal data that
// realistically appears in African-market conversational audio transcripts.
// Replaces matches with synthetic tokens before any dataset compilation.
// This is the pattern layer; an NER model augments it in the model phase.

export type PiiType =
  | "phone"
  | "email"
  | "id_number"
  | "amount"
  | "full_name"
  | "card_number";

export interface PiiSpan {
  type: PiiType;
  original: string; // masked for display
  replacement: string;
  start: number;
  end: number;
}

interface Detector {
  type: PiiType;
  re: RegExp;
  token: string;
}

const DETECTORS: Detector[] = [
  // Card numbers first (most specific), then IDs, phones, etc.
  { type: "card_number", re: /\b(?:\d[ -]?){15,16}\b/g, token: "[SYNTHETIC-CARD]" },
  { type: "phone", re: /\b(?:\+?234|0)[789]\d{9}\b/g, token: "[SYNTHETIC-11-DIGIT]" }, // NG
  { type: "phone", re: /\b(?:\+?254|0)7\d{8}\b/g, token: "[SYNTHETIC-PHONE]" }, // KE
  { type: "email", re: /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi, token: "[SYNTHETIC-EMAIL]" },
  { type: "id_number", re: /\b\d{11}\b/g, token: "[SYNTHETIC-ID]" }, // NIN/BVN length
  { type: "amount", re: /(?:₦|N|NGN|KES|KSh)\s?\d[\d,]*(?:\.\d+)?/gi, token: "[AMOUNT]" },
  { type: "full_name", re: /\b(?:my name is|i am|this is)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/g, token: "[SYNTHETIC-NAME]" },
];

function mask(s: string): string {
  if (s.length <= 4) return "•".repeat(s.length);
  return s.slice(0, 2) + "•".repeat(Math.max(2, s.length - 4)) + s.slice(-2);
}

export interface PiiResult {
  redacted: string;
  spans: PiiSpan[];
  clean: boolean;
}

/**
 * Detect and redact PII. `keepAmounts` lets amounts through when the scenario
 * treats them as stage props (fictional figures), which is the norm for our
 * synthetic scenes; default redacts them for safety.
 */
export function scanPii(text: string, keepAmounts = false): PiiResult {
  const spans: PiiSpan[] = [];
  let redacted = text;

  for (const d of DETECTORS) {
    if (d.type === "amount" && keepAmounts) continue;
    redacted = redacted.replace(d.re, (m) => {
      spans.push({ type: d.type, original: mask(m), replacement: d.token, start: 0, end: 0 });
      return d.token;
    });
  }
  return { redacted, spans, clean: spans.length === 0 };
}

export const PII_LABEL: Record<PiiType, string> = {
  phone: "phone number",
  email: "email",
  id_number: "ID number",
  amount: "money amount",
  full_name: "full name",
  card_number: "card number",
};
