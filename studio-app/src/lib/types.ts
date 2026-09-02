// Domain types mirrored from the Postgres schema (public schema).
// Keep in sync with supabase migrations.

export type Locale =
  | "pcm-NG"
  | "yo-NG"
  | "ha-NG"
  | "ig-NG"
  | "sw-KE"
  | "zu-ZA";

export type PayoutRail =
  | "mpesa"
  | "paystack"
  | "flutterwave"
  | "stripe"
  | "paypal"
  | "usdc";

export type QaTier = "platinum" | "gold" | "silver" | "rejected";

export interface Profile {
  id: string; // auth.users.id
  handle: string | null;
  locale: Locale | null;
  payout_rail: PayoutRail | null;
  ap_balance: number;
  trust_score: number;
  is_allowlisted: boolean;
  created_at: string;
}

export interface Prompt {
  id: string;
  locale: Locale;
  scenario: string;
  english_text: string;
  role_hint: string | null;
  active: boolean;
}

export interface Take {
  id: string;
  prompt_id: string;
  speaker_id: string;
  audio_path: string | null;
  duration_ms: number | null;
  status: "recorded" | "rated" | "redo" | "verified";
  created_at: string;
}

export interface Rating {
  id: string;
  take_id: string;
  rater_id: string;
  tone: number;
  prompt_adherence: number;
  mood: number;
  clarity: number;
  aggregate: number;
  created_at: string;
}
