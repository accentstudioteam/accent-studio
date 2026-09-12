// Admin action: invite an applicant to a project. Creates the invitation, moves the
// application to "invited", and emails a branded invitation with the join link.
// JWT-gated at the gateway; the caller must also be an admin (checked in the database).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SITE, button, esc, send, shell, tile } from "./mail.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const LANG: Record<string, string> = { pcm: "Nigerian Pidgin", yo: "Yoruba", ha: "Hausa", ig: "Igbo", sw: "Swahili", zu: "Zulu", en: "English" };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const auth = req.headers.get("Authorization") ?? "";
  const url = Deno.env.get("SUPABASE_URL")!;
  const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: who } = await caller.auth.getUser();
  if (!who?.user) return json({ error: "sign in first" }, 401);
  const { data: isAdmin } = await caller.rpc("is_admin");
  if (!isAdmin) return json({ error: "admins only" }, 403);

  let body: { application_id?: string; project_id?: string | null } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad json" }, 400);
  }
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  if (!UUID.test(body.application_id ?? "")) return json({ error: "bad application id" }, 400);
  if (body.project_id && !UUID.test(body.project_id)) return json({ error: "bad project id" }, 400);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: app } = await admin.from("applications").select("id, full_name, email, primary_language, other_language, status").eq("id", body.application_id).maybeSingle();
  if (!app) return json({ error: "application not found" }, 404);
  const { data: project } = body.project_id
    ? await admin.from("projects").select("id, name, language").eq("id", body.project_id).maybeSingle()
    : { data: null };

  // Reuse an open invitation for this email if one exists, otherwise create one.
  const { data: existing } = await admin
    .from("invitations")
    .select("id, token, expires_at")
    .eq("application_id", app.id)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  let invitation = existing;
  if (!invitation) {
    const { data: created, error } = await admin
      .from("invitations")
      .insert({ application_id: app.id, project_id: project?.id ?? null, email: app.email.toLowerCase(), invited_by: who.user.id })
      .select("id, token, expires_at")
      .single();
    if (error || !created) return json({ error: "could not create invitation" }, 500);
    invitation = created;
  }
  if (app.status === "submitted" || app.status === "in_review" || app.status === "waitlisted" || app.status === "accepted") {
    await admin.from("applications").update({ status: "invited" }).eq("id", app.id);
  }

  const first = esc(String(app.full_name ?? "").trim().split(/\s+/)[0] || "there");
  const language = app.primary_language === "other" ? (app.other_language || "your language") : (LANG[app.primary_language] ?? app.primary_language);
  const link = `${SITE}/studio/join?i=${invitation.token}`;
  const expires = new Date(invitation.expires_at).toUTCString().replace(/:\d\d GMT$/, " UTC");
  const inner = `
    <p style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#c9bfad">We listened to your story and we would like you in the cast${project ? ` for <b style="color:#f4eee1">${esc(project.name)}</b>` : ""}. Sessions are in ${esc(language)}, played on your phone, paid per verified hour at the published rate.</p>
    ${tile("What happens when you accept", "<b style=\"color:#f4eee1\">1.</b> You sign in with a one-time link we email you. &nbsp;<b style=\"color:#f4eee1\">2.</b> You read and sign the Contributor Agreement, two ticks, no small print hidden. &nbsp;<b style=\"color:#f4eee1\">3.</b> A short recorded interview with a linguist in your language. &nbsp;<b style=\"color:#f4eee1\">4.</b> Onboarding, then your first paid session.")}
    ${tile("Before you sign", `The agreement is 11 pages in plain language. Read it first if you like: <a href="${SITE}/legal/Accent_Studio_Contributor_Agreement_v1.2.pdf" style="color:#45e0a0">Contributor Agreement v1.2 (PDF)</a>. Pay terms are on <a href="${SITE}/#earn" style="color:#45e0a0">accentstudio.io/#earn</a>.`)}
    ${button(link, "Accept the invitation")}
    <div style="font-family:Consolas,'Courier New',monospace;font-size:12px;color:#96897a;margin-top:10px">This link is for ${esc(app.email)} only and expires ${esc(expires)}.</div>`;
  const text = [
    `Welcome to the cast, ${first}.`,
    "",
    `We listened to your story and we would like you in the cast${project ? ` for ${project.name}` : ""}. Sessions are in ${language}, played on your phone, paid per verified hour at the published rate.`,
    "",
    "When you accept: sign in with a one-time link, read and sign the Contributor Agreement (two ticks), a short recorded interview with a linguist, then onboarding and your first paid session.",
    `Agreement: ${SITE}/legal/Accent_Studio_Contributor_Agreement_v1.2.pdf · Pay terms: ${SITE}/#earn`,
    "",
    `Accept: ${link}`,
    `This link is for ${app.email} only and expires ${expires}.`,
  ].join("\n");

  const mail = await send({
    to: [app.email],
    subject: `You're invited to the cast, ${first}`,
    html: shell("Accent Studio · invitation", `Welcome to the cast, ${first}.`, inner, `You're getting this because you applied at accentstudio.io/apply and we'd like to work with you. Not interested any more? Ignore this email and nothing else will follow.`),
    text,
  });
  if (!mail.ok) console.error("invite mail failed", mail.status, mail.body);
  return json({ ok: true, invitation_id: invitation.id, mailed: mail.ok, expires_at: invitation.expires_at });
});
