// Confirmation email for a new player application (the waitlist).
// Invoked by the public /apply page right after the row is inserted, with { id }.
// Deliberately not JWT-gated (the site uses a publishable key, not a JWT); safety
// comes from: the id is an unguessable uuid, the row must be under 15 minutes old,
// and the mail is only ever sent once, to the applicant's own address.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SITE = "https://accentstudio.io";
const LANG: Record<string, string> = {
  pcm: "Nigerian Pidgin",
  yo: "Yoruba",
  ha: "Hausa",
  ig: "Igbo",
  sw: "Swahili",
  zu: "Zulu",
  en: "English",
};
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
}

function listWords(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "your language";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

const SHARE_TEXT = "Get paid to play voice scenes in your own language. I'm on the Accent Studio waitlist, join me:";
function shareLinks(): { whatsapp: string; telegram: string; x: string; email: string } {
  const link = (ref: string) => `${SITE}/apply?ref=${ref}`;
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${SHARE_TEXT} ${link("whatsapp")}`)}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(link("telegram"))}&text=${encodeURIComponent(SHARE_TEXT)}`,
    x: `https://x.com/intent/post?text=${encodeURIComponent(SHARE_TEXT)}&url=${encodeURIComponent(link("x"))}`,
    email: `mailto:?subject=${encodeURIComponent("Get paid to teach AI your language")}&body=${encodeURIComponent(`${SHARE_TEXT}\n${link("email")}`)}`,
  };
}

export function renderHtml(first: string, languages: string[], hasSamples: boolean): string {
  const langs = esc(listWords(languages));
  const name = esc(first);
  const share = shareLinks();
  const tile = (label: string, body: string) =>
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px"><tr><td style="background:#1d1913;border:1px solid #2b2418;border-radius:14px;padding:16px 18px">
      <div style="font-family:Consolas,'Courier New',monospace;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#96897a;margin-bottom:6px">${label}</div>
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#c9bfad">${body}</div></td></tr></table>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>You're on the list</title></head>
<body style="margin:0;padding:0;background:#0d0b08">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d0b08"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
  <tr><td style="padding:0 4px 22px"><img src="${SITE}/brand/png/lockup/accent-studio-lockup-dark-256h.png" width="190" height="19" alt="Accent Studio" style="display:block;border:0;width:190px;height:auto"></td></tr>
  <tr><td style="background:#17140e;border:1px solid #2b2418;border-radius:20px;padding:30px 28px">
    <div style="font-family:Consolas,'Courier New',monospace;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#45e0a0;margin-bottom:12px">You're on the list</div>
    <h1 style="margin:0 0 14px;font-family:'Arial Black',Arial,Helvetica,sans-serif;font-weight:900;font-size:30px;line-height:1.08;letter-spacing:-0.5px;color:#f4eee1">Welcome to the cast, ${name}.</h1>
    <p style="margin:0 0 22px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#c9bfad">Thanks for applying to Accent Studio. We read every application and listen to every sample ourselves. When ${langs} opens, you'll get an email with an invite to a short recorded interview, then onboarding.</p>
    ${tile("What happens next", "<b style=\"color:#f4eee1\">1.</b> We listen and place you by language. &nbsp;<b style=\"color:#f4eee1\">2.</b> You get an interview invite when your language opens. &nbsp;<b style=\"color:#f4eee1\">3.</b> Onboarding, then you play scenes and earn per verified hour.")}
    ${hasSamples ? tile("About your voice samples", "They're heard by our team to judge voice quality and fluency, nothing else. Never used for training, never sold, never in any dataset. Reply to this email if you want them deleted.") : ""}
    ${tile("Money", "Nobody is paid during the preview. You told us how you'd like to be paid later, and that's exactly what we build first.")}
    <div style="font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:16px;color:#f4eee1;margin:6px 0 10px">Know someone who talks like home? Send them the link.</div>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 6px"><tr>
      <td style="padding:0 8px 8px 0"><a href="${share.whatsapp}" style="display:inline-block;padding:12px 18px;background:#45e0a0;border-radius:999px;font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:14px;color:#0d0b08;text-decoration:none">Share on WhatsApp</a></td>
      <td style="padding:0 8px 8px 0"><a href="${share.telegram}" style="display:inline-block;padding:12px 18px;border:1px solid #45e0a0;border-radius:999px;font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:14px;color:#45e0a0;text-decoration:none">Telegram</a></td>
    </tr><tr>
      <td style="padding:0 8px 8px 0"><a href="${share.x}" style="display:inline-block;padding:12px 18px;border:1px solid #45e0a0;border-radius:999px;font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:14px;color:#45e0a0;text-decoration:none">Post on X</a></td>
      <td style="padding:0 8px 8px 0"><a href="${share.email}" style="display:inline-block;padding:12px 18px;border:1px solid #45e0a0;border-radius:999px;font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:14px;color:#45e0a0;text-decoration:none">Email a friend</a></td>
    </tr></table>
    <div style="font-family:Consolas,'Courier New',monospace;font-size:12px;color:#96897a;margin-top:4px">or copy: accentstudio.io/apply &nbsp;·&nbsp; the more voices in a language, the sooner it opens</div>
  </td></tr>
  <tr><td style="padding:22px 6px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#6b6152">
    You're getting this because you applied at accentstudio.io/apply. Reply to this email with any question. Your voice is biometric data and we treat it that way: <a href="${SITE}/privacy" style="color:#96897a">privacy policy</a>.<br>Accent Studio, Inc.
  </td></tr>
</table></td></tr></table></body></html>`;
}

export function renderText(first: string, languages: string[], hasSamples: boolean): string {
  return [
    `Welcome to the cast, ${first}.`,
    "",
    `Thanks for applying to Accent Studio. We read every application and listen to every sample ourselves. When ${listWords(languages)} opens, you'll get an email with an invite to a short recorded interview, then onboarding.`,
    "",
    "What happens next: we listen and place you by language; you get an interview invite when your language opens; then onboarding, scenes, and pay per verified hour.",
    hasSamples ? "\nYour voice samples are heard only to assess your application. Never used for training, never sold, never in any dataset. Reply if you want them deleted." : "",
    "\nNobody is paid during the preview. You told us how you'd like to be paid later, and that's what we build first.",
    "",
    `Know someone who talks like home? Send them ${SITE}/apply`,
    `Share on WhatsApp: ${shareLinks().whatsapp}`,
    "",
    `You're getting this because you applied at accentstudio.io/apply. Privacy: ${SITE}/privacy`,
    "Accent Studio, Inc.",
  ].join("\n");
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
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id ?? "")) {
    return json({ error: "bad id" }, 400);
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: a, error } = await admin
    .from("applications")
    .select("id, full_name, email, languages, other_language, samples, created_at, confirmation_sent_at")
    .eq("id", id)
    .maybeSingle();
  if (error || !a) return json({ error: "not found" }, 404);
  if (a.confirmation_sent_at) return json({ ok: true, already: true });
  if (Date.now() - new Date(a.created_at).getTime() > 15 * 60 * 1000) return json({ error: "too late" }, 403);

  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return json({ ok: false, skipped: "RESEND_API_KEY is not set" });
  const from = Deno.env.get("MAIL_FROM") ?? "Accent Studio <hello@accentstudio.io>";

  const first = String(a.full_name ?? "").trim().split(/\s+/)[0] || "there";
  const languages = ((a.languages as string[]) ?? []).map((l) =>
    l === "other" ? (a.other_language as string | null) || "another language" : LANG[l] ?? l
  );
  const hasSamples = Array.isArray(a.samples) && a.samples.length > 0;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [a.email],
      reply_to: "hello@accentstudio.io",
      subject: `You're on the list, ${first}`,
      html: renderHtml(first, languages, hasSamples),
      text: renderText(first, languages, hasSamples),
    }),
  });
  if (!res.ok) {
    console.error("resend failed", res.status, await res.text());
    return json({ error: "mail failed" }, 502);
  }
  await admin.from("applications").update({ confirmation_sent_at: new Date().toISOString() }).eq("id", id);
  return json({ ok: true });
});
