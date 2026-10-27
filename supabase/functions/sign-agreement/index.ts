// A signed-in, invited applicant signs the Contributor Agreement.
// Creates the contributor (speaker id) and the Annex A consent record with its
// SHA-256 fingerprint, marks the invitation accepted, and emails the record.
//
// The signing act is deliberate: the person types their legal name, attests that
// it is real, and initials the three clauses that carry weight. The email link
// only proves control of the inbox; the typed name and the initials are the
// signature.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SITE, button, esc, send, shell, tile } from "./mail.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** The clauses that get initialled, and the exact words shown beside each box.
 *  The server owns this list so the recorded wording can never be set by the
 *  client. Join.tsx renders a mirror of it; change both together and bump the
 *  clause's version when its wording changes. */
export const CLAUSES = [
  {
    id: "biometric",
    clause: "4",
    version: "1",
    heading: "Your voice as biometric data",
    text:
      "I give my explicit consent to Accent Studio recording my voice and processing it as biometric data, for the purposes set out in clause 4 of the Contributor Agreement.",
  },
  {
    id: "buyer_limits",
    clause: "5",
    version: "1",
    heading: "What buyers may never do",
    text:
      "I have read clause 5: buyers may never identify me, clone my individual voice, use my voice to verify identity, surveil anyone, or pass the raw data on. Every licence Accent Studio signs says so.",
  },
  {
    id: "withdrawal",
    clause: "6",
    version: "1",
    heading: "Your right to withdraw",
    text:
      "I understand that I may withdraw my consent at any time under clause 6, that new use stops and undelivered recordings are deleted within 30 days, that deliveries already made to a buyer are covered by clause 6, and that verified earnings are still paid.",
  },
] as const;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Canonical JSON: keys sorted at every depth, array order kept, no whitespace.
 *  Anyone can recompute the fingerprint from record_json. Flat records hash
 *  exactly as they did before the nested clause list was added. */
export function canonical(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (typeof value === "object") {
    const rec = value as Record<string, unknown>;
    return "{" + Object.keys(rec).sort().map((k) => JSON.stringify(k) + ":" + canonical(rec[k])).join(",") + "}";
  }
  return JSON.stringify(value);
}

/** A legal name: at least one letter, no control characters, whitespace collapsed. */
export function cleanLegalName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 120) return null;
  if (!/\p{L}/u.test(name)) return null;
  return name;
}

/** Initials: two to six characters, letters with the stops and hyphens people use. */
export function cleanInitials(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.replace(/\s+/g, " ").trim().toUpperCase();
  if (!/^\p{L}[\p{L}.\-' ]{1,5}$/u.test(v)) return null;
  return v;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: who } = await caller.auth.getUser();
  const user = who?.user;
  if (!user?.email) return json({ error: "sign in first" }, 401);

  let body: { legal_name?: unknown; name_attested?: unknown; initials?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad json" }, 400);
  }

  const legal_name = cleanLegalName(body.legal_name);
  if (!legal_name) return json({ error: "type your full legal name" }, 400);
  if (body.name_attested !== true) return json({ error: "confirm that this is your real legal name" }, 400);

  const given = (body.initials ?? {}) as Record<string, unknown>;
  if (typeof given !== "object" || given === null || Array.isArray(given)) return json({ error: "initial all three clauses" }, 400);
  const initialled: { clause: string; id: string; initials: string; text: string; version: string }[] = [];
  for (const c of CLAUSES) {
    const marks = cleanInitials(given[c.id]);
    if (!marks) return json({ error: `initial clause ${c.clause} to sign` }, 400);
    initialled.push({ clause: c.clause, id: c.id, initials: marks, text: c.text, version: c.version });
  }

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const email = user.email.toLowerCase();

  // Already signed: return the existing record rather than creating a second one.
  const { data: existingRecord } = await admin
    .from("consent_records")
    .select("speaker_id, agreement_version, agreement_sha256, signed_at, record_sha256")
    .eq("contributor_id", user.id)
    .is("withdrawn_at", null)
    .order("signed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingRecord) return json({ ok: true, already: true, ...existingRecord });

  const { data: inv } = await admin
    .from("invitations")
    .select("id, application_id, project_id, expires_at, accepted_at, revoked_at")
    .eq("email", email)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!inv || new Date(inv.expires_at).getTime() < Date.now()) return json({ error: "no open invitation for this email" }, 403);

  // full_name is deliberately not read here: the app pre-fills it from my_onboarding
  // and the signer may correct it, so the typed name is the one that counts.
  const { data: app } = await admin.from("applications").select("id, languages, primary_language, country").eq("id", inv.application_id).single();
  const { data: agreement } = await admin.from("agreement_versions").select("version, sha256, url, document_id").eq("active", true).limit(1).single();
  if (!app || !agreement) return json({ error: "setup incomplete" }, 500);

  // Contributor row (reused if the person was created before, for example after a withdrawal).
  let { data: contributor } = await admin.from("contributors").select("id, speaker_id").eq("id", user.id).maybeSingle();
  if (!contributor) {
    const { data: sid } = await admin.rpc("new_speaker_id", { lang: app.primary_language, country: app.country });
    const { data: created, error } = await admin
      .from("contributors")
      .insert({ id: user.id, speaker_id: sid, application_id: app.id, project_id: inv.project_id, languages: app.languages, primary_language: app.primary_language, country: app.country })
      .select("id, speaker_id")
      .single();
    if (error || !created) return json({ error: "could not create contributor" }, 500);
    contributor = created;
  }

  // Annex A record. ip_hash is a salted hash of the network address; the address itself is never stored.
  const { data: saltValue } = await admin.rpc("private_setting", { k: "consent_ip_salt" });
  const salt = { value: typeof saltValue === "string" ? saltValue : "" };
  const ip = (req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? "").split(",")[0].trim() || "unknown";
  const ip_hash = await sha256Hex(`${salt?.value ?? ""}:${ip}`);
  const signed_at = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const record = {
    speaker_id: contributor.speaker_id,
    agreement_version: agreement.version,
    agreement_sha256: agreement.sha256,
    accepted_terms: true,
    // Explicit consent to biometric processing is the initialled clause 4, not a tick.
    biometric_consent: true,
    legal_name,
    legal_name_attested: true,
    clauses_initialled: initialled,
    signed_at,
    signature_method: "typed_name_initials_email_otp",
    ip_hash,
    withdrawn_at: null,
  };
  const record_sha256 = await sha256Hex(canonical(record));
  const { error: recErr } = await admin.from("consent_records").insert({
    contributor_id: user.id,
    ...record,
    record_json: record,
    record_sha256,
  });
  if (recErr) return json({ error: "could not store consent record" }, 500);

  await admin.from("invitations").update({ accepted_at: signed_at }).eq("id", inv.id);
  await admin.from("applications").update({ status: "onboarded" }).eq("id", app.id);
  await admin.from("profiles").update({ is_allowlisted: true }).eq("id", user.id);

  const first = esc(legal_name.split(/\s+/)[0] || "there");
  const when = esc(signed_at.replace("T", " ").replace("Z", " UTC"));
  const marks = initialled.map((c) => `Clause ${esc(c.clause)} (v${esc(c.version)}) &middot; <b style="color:#f4eee1">${esc(c.initials)}</b> &mdash; ${esc(CLAUSES.find((x) => x.id === c.id)!.heading)}`).join("<br>");
  const inner = `
    <p style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#c9bfad">You signed the Contributor Agreement v${esc(agreement.version)} on ${when}. This email is your copy of the record. Keep it.</p>
    ${tile("Signed by", `<span style="color:#f4eee1">${esc(legal_name)}</span><br>The legal name you typed, and your word that it is your real one. It lives in the consent record only: it is never shown to a partner, never shown to a buyer, and never attached to a recording.`)}
    ${tile("Signed at", `<span style="font-family:Consolas,'Courier New',monospace;color:#f4eee1">${when}</span>`)}
    ${tile("Agreement version", `<span style="color:#f4eee1">v${esc(agreement.version)}</span>, document ${esc(agreement.document_id)}, SHA-256 <span style="font-family:Consolas,'Courier New',monospace;word-break:break-all">${esc(agreement.sha256)}</span>`)}
    ${tile("Clauses you initialled", marks)}
    ${tile("Your speaker ID", `<span style="font-family:Consolas,'Courier New',monospace;color:#f4eee1">${esc(contributor.speaker_id)}</span><br>Datasets carry this identifier, never your name.`)}
    ${tile("Consent record fingerprint (SHA-256)", `<span style="font-family:Consolas,'Courier New',monospace;color:#45e0a0;word-break:break-all">${record_sha256}</span><br>This fingerprint travels inside every dataset session you record. Present it to us at any time and we will confirm the record exists.`)}
    ${tile("Changing your mind", "Withdraw at any time under Settings in the app or by emailing privacy@accentstudio.io from this address. Undelivered recordings are deleted within 30 days. Verified earnings are never cancelled.")}
    ${button(agreement.url, "Download the agreement you signed")}`;
  const text = [
    `Signed, ${legal_name.split(/\s+/)[0] || "there"}.`,
    "",
    `You signed the Contributor Agreement v${agreement.version} on ${signed_at}.`,
    `Signed by: ${legal_name} (the legal name you typed, held in the consent record only)`,
    `Agreement: version ${agreement.version}, document ${agreement.document_id}, SHA-256 ${agreement.sha256}, ${agreement.url}`,
    "Clauses you initialled:",
    ...initialled.map((c) => `  Clause ${c.clause} (v${c.version}) · ${c.initials} — ${CLAUSES.find((x) => x.id === c.id)!.heading}`),
    `Speaker ID: ${contributor.speaker_id}`,
    `Consent record fingerprint (SHA-256): ${record_sha256}`,
    "",
    "Withdraw at any time under Settings in the app or by emailing privacy@accentstudio.io from this address.",
  ].join("\n");
  const mail = await send({
    to: [email],
    subject: `Signed. Your consent record, ${legal_name.split(/\s+/)[0] || "there"}`,
    html: shell("Accent Studio · consent record", `Signed, ${first}.`, inner, "You're getting this because you signed the Contributor Agreement in the Accent Studio app."),
    text,
  });
  if (!mail.ok) console.error("consent mail failed", mail.status, mail.body);

  // The legal name is deliberately not returned: the app never needs it back.
  return json({ ok: true, speaker_id: contributor.speaker_id, agreement_version: agreement.version, agreement_sha256: agreement.sha256, signed_at, record_sha256, mailed: mail.ok });
});
