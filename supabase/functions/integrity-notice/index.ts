// Staff action for a clause 15 case: email the contributor the notice (which opens the
// 7-day response window) or the decision. The caller must be staff; the case is read with
// the service role; the status change goes through the caller's own session so the event
// log names the editor who sent it.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SITE, esc, send, shell, tile } from "./mail.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const AGREEMENT = `${SITE}/legal/Accent_Studio_Contributor_Agreement_v1.2.pdf`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** What each reason means, said to the contributor. */
const REASON: Record<string, string> = {
  rating_mismatch: "the ratings you gave a partner's takes do not match what our editor heard in the audio",
  not_live: "the voice in your takes did not sound live; it may have been synthetic, replayed or pre-recorded",
  impersonation: "the voice in your takes did not sound like the person who signed up",
  duplicate_content: "the same or near-identical content appeared across sessions",
  filler: "the takes contained filler, repeated or nonsense content rather than the scene",
  pairing_interference: "something suggested the pairing system was worked around to reach a chosen partner",
  voice_taken_outside: "something suggested a partner's voice was taken outside the app",
  identity: "the identity, age, language or region on your account did not match what we found",
  other: "something in these sessions needs your explanation",
};
const DECISION: Record<string, string> = {
  dismissed: "No dishonesty was found. Nothing changes: pay for these sessions goes ahead as normal and the case is closed.",
  confirmed: "Dishonesty was confirmed for the sessions listed. Pending pay for those sessions only is forfeited. Verified earnings from every other session are still paid on the normal schedule, and your account stays open.",
  confirmed_account_closed: "Dishonesty was confirmed for the sessions listed, and because of its seriousness your account is closed. Pending pay for the listed sessions is forfeited. Verified earnings from every other session are still paid on the normal schedule.",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const auth = req.headers.get("Authorization") ?? "";
  const url = Deno.env.get("SUPABASE_URL")!;
  const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: who } = await caller.auth.getUser();
  if (!who?.user) return json({ error: "sign in first" }, 401);
  const { data: isStaff } = await caller.rpc("is_staff");
  if (!isStaff) return json({ error: "staff only" }, 403);

  let body: { case_id?: string; kind?: string } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad json" }, 400);
  }
  if (!UUID.test(body.case_id ?? "")) return json({ error: "bad case id" }, 400);
  if (body.kind !== "notice" && body.kind !== "decision") return json({ error: "kind must be notice or decision" }, 400);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: c } = await admin.from("integrity_cases").select("*").eq("id", body.case_id).maybeSingle();
  if (!c) return json({ error: "case not found" }, 404);
  if (body.kind === "notice" && c.status !== "under_review") return json({ error: "review the case before sending a notice" }, 409);
  if (body.kind === "decision" && c.status !== "decided") return json({ error: "decide the case first" }, 409);

  const { data: sessions } = await admin.from("pp_sessions").select("id, card_id, completed_at, updated_at").in("id", c.session_ids as string[]);
  const cardIds = [...new Set((sessions ?? []).map((s) => s.card_id as string))];
  const { data: cards } = cardIds.length ? await admin.from("scenario_cards").select("id, title").in("id", cardIds) : { data: [] };
  const titleOf = new Map((cards ?? []).map((k) => [k.id as string, k.title as string]));
  const { data: contributor } = await admin.from("contributors").select("speaker_id").eq("id", c.contributor_id).maybeSingle();
  const { data: user } = await admin.auth.admin.getUserById(c.contributor_id);
  const email = user?.user?.email;
  if (!email) return json({ error: "the contributor has no email on file" }, 409);
  const { data: me } = await admin.from("profiles").select("editor_id").eq("id", who.user.id).maybeSingle();

  const sessionLines = (sessions ?? [])
    .map((s) => `<li>${esc(titleOf.get(s.card_id as string) ?? "Session")} · ${esc(day((s.completed_at ?? s.updated_at) as string))}</li>`)
    .join("");
  const reason = REASON[c.reason as string] ?? REASON.other;
  const days = Number(Deno.env.get("RESPONSE_WINDOW_DAYS") ?? 7);
  const speaker = esc(contributor?.speaker_id ?? "");

  let subject: string;
  let title: string;
  let inner: string;
  let text: string;
  if (body.kind === "notice") {
    const respondBy = new Date(Date.now() + days * 86_400_000).toISOString();
    subject = "A session of yours is being checked";
    title = "A session of yours is being checked.";
    inner = `
      <p style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#c9bfad">A member of our team reviewed the sessions below and believes ${esc(reason)}. Under clause 15 of the Contributor Agreement you are told exactly what was flagged and why, and you have ${days} days to respond before anyone decides anything.</p>
      ${tile("Sessions involved", `<ul style="margin:0;padding-left:18px">${sessionLines}</ul>`)}
      ${c.detail ? tile("What the reviewer noted", esc(String(c.detail))) : ""}
      ${tile("What happens now", `<b style="color:#f4eee1">1.</b> Reply in the app (the notice is on your home screen) or by replying to this email, by <b style="color:#f4eee1">${esc(day(respondBy))}</b>. &nbsp;<b style="color:#f4eee1">2.</b> A different member of our team from the one who raised the flag decides, reading your response. &nbsp;<b style="color:#f4eee1">3.</b> You are told the decision and the reason.`)}
      ${tile("What is not affected", `Only the sessions listed pause pending the decision. Verified earnings from every other session are paid on the normal schedule. Low quality is never treated as dishonesty; this notice is about honesty only. <a href="${AGREEMENT}" style="color:#45e0a0">Clause 15</a> has the full process.`)}
      <div style="font-family:Consolas,'Courier New',monospace;font-size:12px;color:#96897a;margin-top:10px">Speaker ${speaker} · case ${esc(String(c.id).slice(0, 8))}</div>`;
    text = [
      "A session of yours is being checked.",
      "",
      `A member of our team reviewed the sessions below and believes ${reason}. Under clause 15 of the Contributor Agreement you are told what was flagged and why, and you have ${days} days to respond before anyone decides anything.`,
      "",
      "Sessions involved:",
      ...(sessions ?? []).map((s) => `- ${titleOf.get(s.card_id as string) ?? "Session"} · ${day((s.completed_at ?? s.updated_at) as string)}`),
      c.detail ? `\nWhat the reviewer noted: ${c.detail}` : "",
      "",
      `Respond in the app (${SITE}/studio) or by replying to this email by ${day(respondBy)}. A different member of our team from the one who raised the flag decides, reading your response. You are told the decision and the reason.`,
      "Only the sessions listed pause. Verified earnings from every other session are paid on the normal schedule. Low quality is never treated as dishonesty.",
      `Clause 15: ${AGREEMENT}`,
    ].join("\n");
  } else {
    subject = "Decision on the session that was checked";
    title = c.decision === "dismissed" ? "No dishonesty found." : "Decision on your flagged sessions.";
    const outcome = DECISION[c.decision as string] ?? "";
    inner = `
      <p style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#c9bfad">${esc(outcome)}</p>
      ${tile("Sessions involved", `<ul style="margin:0;padding-left:18px">${sessionLines}</ul>`)}
      ${c.decision_reason ? tile("The reason", esc(String(c.decision_reason))) : ""}
      ${c.response ? tile("Your response was read", esc(String(c.response))) : tile("Your response", "No response was received within the window.")}
      ${tile("Your rights", `You can ask for the record of this case, including the notice and any response, under clause 9 of the <a href="${AGREEMENT}" style="color:#45e0a0">Contributor Agreement</a>, and you can complain to your data protection authority.`)}
      <div style="font-family:Consolas,'Courier New',monospace;font-size:12px;color:#96897a;margin-top:10px">Speaker ${speaker} · case ${esc(String(c.id).slice(0, 8))}</div>`;
    text = [
      title,
      "",
      outcome,
      "",
      "Sessions involved:",
      ...(sessions ?? []).map((s) => `- ${titleOf.get(s.card_id as string) ?? "Session"} · ${day((s.completed_at ?? s.updated_at) as string)}`),
      c.decision_reason ? `\nThe reason: ${c.decision_reason}` : "",
      c.response ? `\nYour response was read: ${c.response}` : "\nNo response was received within the window.",
      "",
      `You can ask for the record of this case under clause 9 of the Contributor Agreement (${AGREEMENT}) and you can complain to your data protection authority.`,
    ].join("\n");
  }

  const mail = await send({
    to: [email],
    subject,
    html: shell("Accent Studio · clause 15", title, inner, "You're getting this because you are a signed contributor and a session of yours was reviewed under clause 15 of the Contributor Agreement."),
    text,
  });
  if (!mail.ok) console.error("integrity mail failed", mail.status, mail.body);

  if (body.kind === "notice") {
    // status change through the editor's own session, so the event names them
    const { error } = await caller.rpc("ic_mark_notice", { cid: c.id, mailed: mail.ok });
    if (error) return json({ error: error.message }, 409);
  } else {
    await admin.from("integrity_events").insert({ case_id: c.id, actor: who.user.id, actor_label: me?.editor_id ?? "staff", kind: "decision_mailed", detail: { mailed: mail.ok } });
  }
  return json({ ok: true, mailed: mail.ok });
});
