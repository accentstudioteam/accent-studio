// The contributor's account: languages, payout details, the identity check, consent, data requests, closure.
// RPC wrappers; demo mode runs in memory.
import { supabase } from "@/lib/supabase";
import { isDemo } from "@/lib/demo";
import { demoAccount } from "@/lib/demoAccount";
import { uploadRecording } from "@/lib/upload";

export type AccountStatus = "active" | "paused" | "closed" | "withdrawn";
export type IdentityStatus = "pending" | "verified" | "rejected";
export type DocKind = "nin" | "passport" | "drivers_licence" | "voters_card" | "national_id";
export interface Rail {
  key: string;
  name: string;
  min: number;
}
export interface PayoutDetails {
  rail: string;
  details: Record<string, string>;
  updated_at: string;
}
export interface Identity {
  status: IdentityStatus;
  doc_kind: DocKind | null;
  submitted_at: string;
  reviewed_at: string | null;
  note: string | null;
  doc_path: string | null;
  selfie_path: string | null;
}
export interface DataRequest {
  id: string;
  kind: "copy" | "delete";
  note: string | null;
  status: "open" | "done" | "declined";
  created_at: string;
  handled_at: string | null;
  response: string | null;
}
export interface Account {
  speaker_id: string;
  full_name: string | null;
  email: string | null;
  city: string | null;
  country: string | null;
  languages: string[];
  primary_language: string | null;
  joined_at: string;
  status: AccountStatus;
  paused_until: string | null;
  paused_reason: string | null;
  closed_at: string | null;
  closed_reason: string | null;
  withdrawn_at: string | null;
  consent: { agreement_version: string; agreement_sha256: string; signed_at: string; record_sha256: string; withdrawn_at: string | null; url: string | null } | null;
  payout: PayoutDetails | null;
  identity: Identity | null;
  data_requests: DataRequest[];
  rails: Rail[];
  identity_required: boolean;
  stats: { rallies: number; scenes: number; verified_seconds: number };
}

export const LANGUAGES: { code: string; name: string }[] = [
  { code: "pcm", name: "Nigerian Pidgin" },
  { code: "yo", name: "Yoruba" },
  { code: "ha", name: "Hausa" },
  { code: "ig", name: "Igbo" },
  { code: "sw", name: "Swahili" },
  { code: "zu", name: "Zulu" },
];
export const DOC_KINDS: { code: DocKind; name: string }[] = [
  { code: "nin", name: "NIN slip or card" },
  { code: "passport", name: "International passport" },
  { code: "drivers_licence", name: "Driver's licence" },
  { code: "voters_card", name: "Voter's card" },
  { code: "national_id", name: "National ID card" },
];
/** What each rail needs, in the order the form shows it. */
export const RAIL_FIELDS: Record<string, { key: string; label: string; hint: string; options?: string[] }[]> = {
  mpesa: [
    { key: "phone", label: "M-Pesa number", hint: "07XX XXX XXX or +254 7XX XXX XXX" },
    { key: "name", label: "Name on the line · optional", hint: "as Safaricom has it" },
  ],
  paystack: [
    { key: "bank_name", label: "Bank", hint: "e.g. GTBank, Access, Opay" },
    { key: "account_number", label: "Account number", hint: "10-digit NUBAN" },
    { key: "account_name", label: "Account name", hint: "as the bank has it" },
  ],
  flutterwave: [
    { key: "bank_name", label: "Bank", hint: "e.g. GTBank, Access, Opay" },
    { key: "account_number", label: "Account number", hint: "10-digit NUBAN" },
    { key: "account_name", label: "Account name", hint: "as the bank has it" },
  ],
  usdc: [
    { key: "network", label: "Network", hint: "where the wallet lives", options: ["base", "polygon", "ethereum", "solana", "tron"] },
    { key: "token", label: "Token", hint: "", options: ["USDC", "USDT"] },
    { key: "address", label: "Wallet address", hint: "0x… on Base, Polygon or Ethereum; the full address on Solana or Tron" },
  ],
  stripe: [{ key: "email", label: "Email on the account", hint: "" }],
  paypal: [{ key: "email", label: "PayPal email", hint: "" }],
};
export const IDENTITY_WORD: Record<IdentityStatus, string> = { pending: "being checked", verified: "verified", rejected: "not accepted" };

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const myAccount = (): Promise<Account> => (isDemo() ? demoAccount.get() : rpc<Account>("my_account"));
export const setLanguages = (langs: string[], primary: string): Promise<Account> => (isDemo() ? demoAccount.setLanguages(langs, primary) : rpc<Account>("account_set_languages", { langs, primary_lang: primary }));
export const setPayout = (rail: string, details: Record<string, string>): Promise<Account> => (isDemo() ? demoAccount.setPayout(rail, details) : rpc<Account>("account_set_payout", { rail, details }));
export const withdrawConsent = (reason: string): Promise<Account> => (isDemo() ? demoAccount.withdrawConsent(reason) : rpc<Account>("account_withdraw_consent", { reason }));
export const closeAccount = (reason: string): Promise<Account> => (isDemo() ? demoAccount.close(reason) : rpc<Account>("account_close", { reason }));
export const dataRequest = (kind: "copy" | "delete", note: string): Promise<Account> => (isDemo() ? demoAccount.dataRequest(kind, note) : rpc<Account>("account_data_request", { kind, note }));

/** Uploads the two photos into the contributor's own folder of the private identity bucket, then records the check. */
export async function submitIdentity(userId: string, doc: File, selfie: File, kind: DocKind, onProgress: (label: string) => void): Promise<Account> {
  if (isDemo()) return demoAccount.submitIdentity(kind);
  const ext = (f: File) => (f.type === "application/pdf" ? "pdf" : f.type === "image/png" ? "png" : f.type === "image/webp" ? "webp" : "jpg");
  const stamp = Date.now();
  const docPath = `${userId}/doc-${stamp}.${ext(doc)}`;
  const selfiePath = `${userId}/selfie-${stamp}.${ext(selfie)}`;
  await uploadRecording(docPath, doc, doc.type || "image/jpeg", (pct) => onProgress(`Sending the document… ${pct}%`), "identity");
  await uploadRecording(selfiePath, selfie, selfie.type || "image/jpeg", (pct) => onProgress(`Sending the selfie… ${pct}%`), "identity");
  onProgress("Recording the check…");
  return rpc<Account>("identity_submit", { doc_path: docPath, selfie_path: selfiePath, doc_kind: kind });
}

/** A short-lived link to one of the identity photos, for the owner or an admin. */
export async function identityUrl(path: string): Promise<string | null> {
  if (isDemo()) return null;
  const { data } = await supabase.storage.from("identity").createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}
