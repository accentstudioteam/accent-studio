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
  is_admin: boolean;
  is_linguist?: boolean;
  editor_id?: string | null;
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

export type ApplicationStatus = "submitted" | "invited" | "interview_scheduled" | "interviewed" | "in_review" | "accepted" | "accepted_to_project" | "onboarded" | "waitlisted" | "rejected";

export interface ApplicationSample {
  language: string;
  part?: string;
  path: string;
  seconds: number;
}

/** Public player application. Doubles as the waitlist. */
export interface Application {
  id: string;
  created_at: string;
  full_name: string;
  email: string;
  phone: string | null;
  country: string;
  city: string | null;
  languages: string[];
  primary_language: string;
  other_language: string | null;
  age_band: string | null;
  gender: string | null;
  device: string | null;
  hours_per_week: string | null;
  motivation: string | null;
  referral: string | null;
  payout_pref: string | null;
  sample_path: string | null;
  sample_seconds: number | null;
  samples: ApplicationSample[];
  consent_contact: boolean;
  consent_sample: boolean;
  user_agent: string | null;
  status: ApplicationStatus;
  notes: string | null;
}

export type LabInquiryStatus = "new" | "replied" | "qualified" | "closed";

/** Inbound request from a lab via the /labs contact form. */
export interface LabInquiry {
  id: string;
  created_at: string;
  name: string;
  org: string;
  email: string;
  message: string | null;
  user_agent: string | null;
  status: LabInquiryStatus;
  notes: string | null;
  notified_at: string | null;
  ack_sent_at: string | null;
}

export interface Project {
  id: string;
  created_at: string;
  name: string;
  buyer: string;
  language: string;
  target_hours: number;
  tier: "standard" | "aligned" | "exclusive";
  deadline: string | null;
  status: "open" | "delivering" | "closed";
  notes: string | null;
}

export interface AgreementVersion {
  version: string;
  document_id: string;
  effective_date: string;
  sha256: string;
  url: string;
  active: boolean;
}

/** What public.my_onboarding() returns for the signed-in person. */
export interface Onboarding {
  invited: boolean;
  invitation: {
    token: string;
    expires_at: string;
    accepted_at: string | null;
    full_name: string;
    primary_language: string;
    languages: string[];
    country: string;
    project_name: string | null;
    project_language: string | null;
  } | null;
  contributor: { speaker_id: string; primary_language: string | null; languages: string[]; withdrawn_at: string | null; closed_at: string | null } | null;
  consent: { agreement_version: string; agreement_sha256: string; signed_at: string; record_sha256: string; withdrawn_at: string | null } | null;
  agreement: AgreementVersion | null;
}
