// Two emails for a new lab inquiry from the /labs contact form, invoked with { id }
// right after the row is inserted:
//   1. a notification to hello@accentstudio.io, reply-to set to the lab contact
//   2. a designed acknowledgement to the lab contact with the sample bundle attached
// Not JWT-gated (the site uses a publishable key). Safety: unguessable uuid, row
// must be under 15 minutes old, each mail is sent at most once.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SITE = "https://accentstudio.io";
const INBOX = Deno.env.get("LABS_INBOX") ?? "hello@accentstudio.io";
const SAMPLE_URL = `${SITE}/samples/Accent_Studio_Sample_Delivery.pdf`;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
}

const AMBER = "#f0a84b";

function tile(label: string, body: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px"><tr><td style="background:#1d1913;border:1px solid #2b2418;border-radius:14px;padding:16px 18px">
    <div style="font-family:Consolas,'Courier New',monospace;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#96897a;margin-bottom:6px">${label}</div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#c9bfad">${body}</div></td></tr></table>`;
}

function shell(inner: string, footer: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Accent Studio</title></head>
<body style="margin:0;padding:0;background:#0d0b08">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d0b08"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
  <tr><td style="padding:0 4px 22px"><img src="${SITE}/brand/png/lockup/accent-studio-lockup-dark-amber-256h.png" width="190" height="19" alt="Accent Studio" style="display:block;border:0;width:190px;height:auto"></td></tr>
  <tr><td style="background:#17140e;border:1px solid #2b2418;border-radius:20px;padding:30px 28px">${inner}</td></tr>
  <tr><td style="padding:22px 6px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#6b6152">${footer}</td></tr>
</table></td></tr></table></body></html>`;
}

export function ackHtml(name: string, org: string, message: string | null): string {
  const first = esc(name.trim().split(/\s+/)[0] || "there");
  const inner = `
    <div style="font-family:Consolas,'Courier New',monospace;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${AMBER};margin-bottom:12px">Request received</div>
    <h1 style="margin:0 0 14px;font-family:'Arial Black',Arial,Helvetica,sans-serif;font-weight:900;font-size:30px;line-height:1.08;letter-spacing:-0.5px;color:#f4eee1">Thanks, ${first}. The sample bundle is attached.</h1>
    <p style="margin:0 0 22px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#c9bfad">We've logged your request for ${esc(org)}. Within one business day a founder replies personally with an honest read on fit for your use case, a walkthrough of the schema, and pricing for the locales you need. Audio for the sample sessions ships on request under a short evaluation licence.</p>
    ${tile("What's in the attached sample", "A 46-page delivery bundle exactly as a buyer receives it: 10 full sessions, 118 verified turns across Nigerian Pidgin, Yoruba, Hausa, Igbo, Swahili and Zulu, the JSONL and Parquet schema reference, word-level source-to-target alignments, evaluation baselines, and the signed consent register.")}
    ${message ? tile("What you told us", `<span style="color:#f4eee1">&ldquo;${esc(message.trim()).replace(/\n/g, "<br>")}&rdquo;</span>`) : ""}
    ${tile("Compliance in one line", "Pseudonymous speakers, explicit biometric consent hashed into every session, no re-identification, no cloning of individual speakers, and a licence written for training-data buyers.")}
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:10px 0 4px"><tr><td style="background:${AMBER};border-radius:999px">
      <a href="mailto:${INBOX}?subject=${encodeURIComponent(`Accent Studio · ${org}`)}" style="display:inline-block;padding:14px 24px;font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:15px;color:#0d0b08;text-decoration:none">Reply with your locales and target hours</a></td></tr></table>
    <div style="font-family:Consolas,'Courier New',monospace;font-size:12px;color:#96897a;margin-top:10px">or just reply to this email, it reaches a founder directly</div>`;
  const footer = `You're getting this because someone at ${esc(org)} requested the sample bundle at accentstudio.io/labs. If that wasn't you, ignore this email and nothing else will follow.<br>Accent Studio, Inc. &middot; <a href="${SITE}/privacy" style="color:#96897a">privacy</a>`;
  return shell(inner, footer);
}

export function ackText(name: string, org: string, message: string | null): string {
  const first = name.trim().split(/\s+/)[0] || "there";
  return [
    `Thanks, ${first}. The sample bundle is attached.`,
    "",
    `We've logged your request for ${org}. Within one business day a founder replies personally with an honest read on fit, a walkthrough of the schema, and pricing for the locales you need. Audio for the sample sessions ships on request under a short evaluation licence.`,
    "",
    "In the attached sample: a 46-page delivery bundle as a buyer receives it. 10 sessions, 118 verified turns across six locales, JSONL and Parquet schema reference, word-level alignments, evaluation baselines, signed consent register.",
    message ? `\nWhat you told us: "${message.trim()}"` : "",
    "\nCompliance in one line: pseudonymous speakers, explicit biometric consent hashed into every session, no re-identification, no cloning of individual speakers.",
    "",
    `Reply to this email with your locales and target hours. It reaches a founder directly. ${SAMPLE_URL}`,
    "",
    `Accent Studio, Inc. · ${SITE}/privacy`,
  ].join("\n");
}

export function notifyHtml(r: { name: string; org: string; email: string; message: string | null; created_at: string }): string {
  const inner = `
    <div style="font-family:Consolas,'Courier New',monospace;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${AMBER};margin-bottom:12px">New lab inquiry</div>
    <h1 style="margin:0 0 18px;font-family:'Arial Black',Arial,Helvetica,sans-serif;font-weight:900;font-size:26px;line-height:1.1;color:#f4eee1">${esc(r.org)}</h1>
    ${tile("Contact", `<span style="color:#f4eee1">${esc(r.name)}</span> &middot; <a href="mailto:${esc(r.email)}" style="color:${AMBER}">${esc(r.email)}</a>`)}
    ${tile("Message", r.message ? esc(r.message.trim()).replace(/\n/g, "<br>") : "<i>No message.</i>")}
    ${tile("Received", esc(new Date(r.created_at).toUTCString()))}
    <p style="margin:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#c9bfad">They've been sent the sample bundle and told a founder replies within one business day. Reply to this email and it goes straight to them. Triage it under Founder tools in the <a href="${SITE}/studio" style="color:${AMBER}">studio</a>.</p>`;
  return shell(inner, "Internal notification from the accentstudio.io labs form.");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let id = "";
  try {
    ({ id } = await req.json());
  } catch {
    return json({ error: "bad json" }, 400);
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id ?? "")) return json({ error: "bad id" }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: r, error } = await admin
    .from("lab_inquiries")
    .select("id, name, org, email, message, created_at, notified_at, ack_sent_at")
    .eq("id", id)
    .maybeSingle();
  if (error || !r) return json({ error: "not found" }, 404);
  if (Date.now() - new Date(r.created_at).getTime() > 15 * 60 * 1000) return json({ error: "too late" }, 403);

  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return json({ ok: false, skipped: "RESEND_API_KEY is not set" });
  const from = Deno.env.get("MAIL_FROM") ?? "Accent Studio <hello@accentstudio.io>";

  const send = (payload: Record<string, unknown>) =>
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, ...payload }),
    });

  const result: Record<string, unknown> = { ok: true };

  if (!r.notified_at) {
    const res = await send({
      to: [INBOX],
      reply_to: r.email,
      subject: `Lab inquiry · ${r.org} · ${r.name}`,
      html: notifyHtml(r),
      text: `New lab inquiry\n\n${r.org}\n${r.name} · ${r.email}\n\n${r.message ?? "(no message)"}\n\nReply to this email to answer them. Triage in ${SITE}/studio.`,
    });
    if (res.ok) await admin.from("lab_inquiries").update({ notified_at: new Date().toISOString() }).eq("id", id);
    else {
      console.error("notify failed", res.status, await res.text());
      result.notify = "failed";
    }
  }

  if (!r.ack_sent_at) {
    const res = await send({
      to: [r.email],
      reply_to: INBOX,
      subject: `Your Accent Studio sample bundle, ${r.name.trim().split(/\s+/)[0] || "there"}`,
      html: ackHtml(r.name, r.org, r.message),
      text: ackText(r.name, r.org, r.message),
      attachments: [{ path: SAMPLE_URL, filename: "Accent_Studio_Sample_Delivery.pdf" }],
    });
    if (res.ok) await admin.from("lab_inquiries").update({ ack_sent_at: new Date().toISOString() }).eq("id", id);
    else {
      console.error("ack failed", res.status, await res.text());
      result.ack = "failed";
    }
  }

  return json(result, result.notify === "failed" || result.ack === "failed" ? 502 : 200);
});
