// The contributor's account on an in-memory backend. Nothing is saved.
import type { Account, DocKind } from "@/lib/account";

const now = () => new Date().toISOString();
const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

let state: Account | null = null;

function seed(): Account {
  if (state) return state;
  state = {
    speaker_id: "spk_pcm_ng_48213",
    full_name: "Chidi O.",
    email: "chidi@example.com",
    city: "Lagos",
    country: "NG",
    languages: ["pcm"],
    primary_language: "pcm",
    joined_at: ago(40 * 24 * 60),
    status: "active",
    paused_until: null,
    paused_reason: null,
    closed_at: null,
    closed_reason: null,
    withdrawn_at: null,
    consent: { agreement_version: "1.2", agreement_sha256: "48ff6cdd711040ed76709162c9a3ad45a88c67ca6a6b1b6dcdfc07db883497d1", signed_at: ago(40 * 24 * 60), record_sha256: "8d4c1f0a9e2b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d", withdrawn_at: null, url: "https://accentstudio.io/legal/Accent_Studio_Contributor_Agreement_v1.2.pdf" },
    payout: null,
    identity: null,
    data_requests: [],
    rails: [
      { key: "mpesa", name: "M-Pesa", min: 5 },
      { key: "paystack", name: "Paystack", min: 5 },
      { key: "flutterwave", name: "Flutterwave", min: 5 },
      { key: "stripe", name: "Stripe", min: 10 },
      { key: "paypal", name: "PayPal", min: 10 },
      { key: "usdc", name: "USDC · USDT", min: 2 },
    ],
    identity_required: false,
    stats: { rallies: 14, scenes: 1, verified_seconds: 2612 },
  };
  return state;
}

export const demoAccount = {
  get: async (): Promise<Account> => ({ ...seed() }),

  setLanguages: async (langs: string[], primary: string): Promise<Account> => {
    const a = seed();
    const known = ["pcm", "yo", "ha", "ig", "sw", "zu"];
    const clean = [...new Set(langs.filter((l) => known.includes(l)))].sort();
    if (!clean.length) throw new Error("pick at least one language");
    if (!clean.includes(primary)) throw new Error("your strongest language must be one of the ones you picked");
    a.languages = clean;
    a.primary_language = primary;
    return { ...a };
  },

  setPayout: async (rail: string, details: Record<string, string>): Promise<Account> => {
    const a = seed();
    const d = Object.fromEntries(Object.entries(details).map(([k, v]) => [k, (v ?? "").trim()]));
    if (rail === "mpesa" && !/^(\+?254|0)[17]\d{8}$/.test(d.phone?.replace(/\s/g, "") ?? "")) throw new Error("enter the M-Pesa number, like 07XX XXX XXX or +254 7XX XXX XXX");
    if ((rail === "paystack" || rail === "flutterwave") && !/^\d{10}$/.test(d.account_number ?? "")) throw new Error("the account number is the 10-digit NUBAN");
    if (rail === "usdc" && !/^0x[0-9a-fA-F]{40}$/.test(d.address ?? "") && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(d.address ?? "")) throw new Error(`that does not look like a ${d.network || "wallet"} address`);
    if ((rail === "stripe" || rail === "paypal") && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email ?? "")) throw new Error("enter the email on the account");
    a.payout = { rail, details: d, updated_at: now() };
    return { ...a };
  },

  submitIdentity: async (kind: DocKind): Promise<Account> => {
    const a = seed();
    if (a.identity?.status === "verified") throw new Error("your identity is already verified");
    a.identity = { status: "pending", doc_kind: kind, submitted_at: now(), reviewed_at: null, note: null, doc_path: "demo/doc.jpg", selfie_path: "demo/selfie.jpg" };
    return { ...a };
  },

  dataRequest: async (kind: "copy" | "delete", note: string): Promise<Account> => {
    const a = seed();
    if (a.data_requests.some((r) => r.kind === kind && r.status === "open")) throw new Error("that request is already open");
    a.data_requests = [{ id: `dr-${a.data_requests.length + 1}`, kind, note: note.trim() || null, status: "open", created_at: now(), handled_at: null, response: null }, ...a.data_requests];
    return { ...a };
  },

  withdrawConsent: async (_reason: string): Promise<Account> => {
    const a = seed();
    a.status = "withdrawn";
    a.withdrawn_at = now();
    if (a.consent) a.consent = { ...a.consent, withdrawn_at: now() };
    return { ...a };
  },

  close: async (reason: string): Promise<Account> => {
    const a = seed();
    a.status = "closed";
    a.closed_at = now();
    a.closed_reason = `left: ${reason.trim() || "no reason given"}`;
    return { ...a };
  },

  reset: () => {
    state = null;
  },
};
