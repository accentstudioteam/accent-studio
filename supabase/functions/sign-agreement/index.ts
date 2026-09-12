// A signed-in, invited applicant signs the Contributor Agreement.
// Creates the contributor (speaker id) and the Annex A consent record with its
// SHA-256 fingerprint, marks the invitation accepted, and emails the record.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SITE, button, esc, send, shell, tile } from "./mail.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Canonical JSON: the Annex A fields, keys sorted, no whitespace. Anyone can recompute the fingerprint from record_json. */
export function canonical(record: Record<string, unknown>): string {
  const keys = Object.keys(record).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + JSON.stringify(record[k] ?? null)).join(",") + "}";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: who } = await caller.auth.getUser();
  const user = who?.user;
  if (!user?.email) return json({ error: "sign in first" }, 401);

  let body: { accepted_terms?: boolean; biometric_consent?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad json" }, 400);
  }
  if (body.accepted_terms !== true || body.biometric_consent !== true) {
    return json({ error: "both boxes must be ticked" }, 400);
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

  const { data: app } = await admin.from("applications").select("id, full_name, languages, primary_language, country").eq("id", inv.application_id).single();
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
    biometric_consent: true,
    signed_at,
    signature_method: "app_otp_email",
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

  const first = esc(String(app.full_name ?? "").trim().split(/\s+/)[0] || "there");
  const inner = `
    <p style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#c9bfad">You signed the Contributor Agreement v${esc(agreement.version)} on ${esc(signed_at.replace("T", " ").replace("Z", " UTC"))}. This email is your copy of the record. Keep it.</p>
    ${tile("Your speaker ID", `<span style="font-family:Consolas,'Courier New',monospace;color:#f4eee1">${esc(contributor.speaker_id)}</span><br>Datasets carry this identifier, never your name.`)}
    ${tile("Consent record fingerprint (SHA-256)", `<span style="font-family:Consolas,'Courier New',monospace;color:#45e0a0;word-break:break-all">${record_sha256}</span><br>This fingerprint travels inside every dataset session you record. Present it to us at any time and we will confirm the record exists.`)}
    ${tile("Agreement signed", `Version ${esc(agreement.version)}, document ${esc(agreement.document_id)}, SHA-256 <span style="font-family:Consolas,'Courier New',monospace;word-break:break-all">${esc(agreement.sha256)}</span>`)}
    ${tile("Changing your mind", "Withdraw at any time under Settings in the app or by emailing privacy@accentstudio.io from this address. Undelivered recordings are deleted within 30 days. Verified earnings are never cancelled.")}
    ${button(agreement.url, "Download the agreement you signed")}`;
  const text = [
    `Signed, ${first}.`,
    "",
    `You signed the Contributor Agreement v${agreement.version} on ${signed_at}.`,
    `Speaker ID: ${contributor.speaker_id}`,
    `Consent record fingerprint (SHA-256): ${record_sha256}`,
    `Agreement: version ${agreement.version}, document ${agreement.document_id}, SHA-256 ${agreement.sha256}, ${agreement.url}`,
    "",
    "Withdraw at any time under Settings in the app or by emailing privacy@accentstudio.io from this address.",
  ].join("\n");
  const mail = await send({
    to: [email],
    subject: `Signed. Your consent record, ${first}`,
    html: shell("Accent Studio · consent record", `Signed, ${first}.`, inner, "You're getting this because you signed the Contributor Agreement in the Accent Studio app."),
    text,
  });
  if (!mail.ok) console.error("consent mail failed", mail.status, mail.body);

  return json({ ok: true, speaker_id: contributor.speaker_id, agreement_version: agreement.version, agreement_sha256: agreement.sha256, signed_at, record_sha256, mailed: mail.ok });
});
