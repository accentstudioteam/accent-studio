// Sends what is due: a reply reminder four hours before the window closes, a booked scene starting in about
// an hour, a clause 15 response window closing within a day, a payout marked paid, and the month-end
// statement. pg_cron calls it every fifteen minutes with the shared key; an admin can call it from the
// studio with their own session. Candidates and claims live in SQL (notify_claim / notify_done), so a
// crash or a mail failure retries up to three times and nothing is sent twice.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SITE, button, esc, send, shell, tile } from "./mail.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-notify-key",
};
const APP = `${SITE}/studio`;

interface Item {
  id: number;
  kind: "reply_due" | "booking_soon" | "case_window_closing" | "payout_paid" | "statement";
  ref: string;
  detail: Record<string, unknown>;
  contributor_id: string;
  email: string | null;
  speaker_id: string | null;
  attempt: number;
}
interface Mail {
  subject: string;
  eyebrow: string;
  title: string;
  inner: string;
  text: string;
  footer: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
const money = (n: unknown) => `US$${Number(n ?? 0).toFixed(2)}`;
const str = (v: unknown) => (v == null ? "" : String(v));
const when = (iso: unknown) => (iso ? new Date(String(iso)).toLocaleString("en-GB", { timeZone: "Africa/Lagos", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) + " Lagos time" : "");
const day = (iso: unknown) => (iso ? new Date(String(iso)).toLocaleDateString("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short" }) : "");
const monthName = (ym: string) => new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const TIER: Record<string, string> = { platinum: "Platinum", gold: "Gold", silver: "Silver", floor: "Floor" };
const STATUS: Record<string, string> = { held: "on hold", cleared: "ready", requested: "on its way", paid: "paid", forfeited: "forfeited" };
const REASON: Record<string, string> = {
  rating_mismatch: "ratings that did not match the audio",
  not_live: "a voice that did not sound live",
  impersonation: "a voice that did not sound like the person who signed up",
  duplicate_content: "the same content across sessions",
  filler: "filler rather than the scene",
  pairing_interference: "the pairing being worked around",
  voice_taken_outside: "a partner's voice taken outside the app",
  identity: "account details that did not match",
  other: "something that needs your explanation",
};
const FOOTER = "You're getting this because you are a signed Accent Studio contributor. Reminders and statements are part of the service; there is no marketing here.";

function compose(it: Item): Mail {
  const d = it.detail;
  const partner = str(d.partner) || "your partner";
  if (it.kind === "reply_due") {
    const due = when(d.due_at);
    return {
      subject: `Your reply in ${str(d.title)} is due by ${due}`,
      eyebrow: "Ping-Pong",
      title: `${esc(partner)} is waiting for your reply.`,
      inner: `${tile("The rally", `${esc(str(d.title))} · with ${esc(partner)}`)}${tile("Reply by", esc(due))}
        <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#c9bfad">One take, up to 30 seconds, in your language, your way. After the window the rally closes early; your takes are kept and still count.</p>${button(APP, "Open the rally")}`,
      text: `${partner} is waiting for your reply in ${str(d.title)}. Reply by ${due}. After the window the rally closes early; your takes are kept and still count. ${APP}`,
      footer: FOOTER,
    };
  }
  if (it.kind === "booking_soon") {
    const at = when(d.starts_at);
    return {
      subject: `Your live scene starts at ${at}`,
      eyebrow: "Live Arena",
      title: "Your scene is in about an hour.",
      inner: `${tile("Starts", esc(at))}${tile("With", esc(partner))}
        <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#c9bfad">The room opens five minutes before. Headphones, a quiet place, a charged phone. If you are not in within ten minutes of the start your partner is credited and you take a strike, so cancel now if you cannot make it.</p>${button(APP, "Open the booth")}`,
      text: `Your live scene starts at ${at} with ${partner}. The room opens five minutes before. If you are not in within ten minutes of the start your partner is credited and you take a strike; cancel now if you cannot make it. ${APP}`,
      footer: FOOTER,
    };
  }
  if (it.kind === "case_window_closing") {
    const by = when(d.respond_by);
    const reason = REASON[str(d.reason)] ?? REASON.other;
    return {
      subject: "One day left to respond to the clause 15 notice",
      eyebrow: "Clause 15",
      title: "Your response window closes tomorrow.",
      inner: `${tile("Respond by", esc(by))}${tile("The notice was about", esc(reason))}
        <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#c9bfad">You do not have to respond. If you want your side read before anyone decides, reply in the app or by replying to this email before the window closes. A different member of the team from the one who raised the flag decides.</p>${button(APP, "Respond in the app")}`,
      text: `Your clause 15 response window closes at ${by}. The notice was about ${reason}. Reply in the app (${APP}) or by replying to this email if you want your side read before anyone decides.`,
      footer: FOOTER,
    };
  }
  if (it.kind === "payout_paid") {
    return {
      subject: `Your payout of ${money(d.amount_usd)} was sent`,
      eyebrow: "Earnings",
      title: `${money(d.amount_usd)} is on its way.`,
      inner: `${tile("Sent by", esc(str(d.rail)))}${tile("Reference", esc(str(d.reference) || "none given"))}${tile("Sent", esc(when(d.paid_at)))}
        <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#c9bfad">It lands on the rail's own timing. The lines behind it now show as paid on your statement. If it has not arrived in five working days, reply to this email with the reference.</p>${button(`${APP}`, "Open earnings")}`,
      text: `Your payout of ${money(d.amount_usd)} was sent by ${str(d.rail)}${d.reference ? ` (reference ${str(d.reference)})` : ""} on ${when(d.paid_at)}. If it has not arrived in five working days, reply to this email with the reference. ${APP}`,
      footer: FOOTER,
    };
  }
  // statement
  const ym = str(d.month);
  const lines = (d.lines as Record<string, unknown>[] | undefined) ?? [];
  const totals = (d.totals as Record<string, unknown> | undefined) ?? {};
  const payouts = (d.payouts as Record<string, unknown>[] | undefined) ?? [];
  const balance = (d.balance as Record<string, unknown> | undefined) ?? {};
  const row = (l: Record<string, unknown>) => `${day(l.date)} · ${esc(str(l.title))}${l.mode === "live" ? " (live)" : ""} · ${Math.round(Number(l.seconds ?? 0) / 60)} min · ${TIER[str(l.tier)] ?? str(l.tier) ?? ""} · <b style="color:#f4eee1">${money(l.amount_usd)}</b> · ${STATUS[str(l.status)] ?? str(l.status)}`;
  const linesHtml = lines.length ? lines.map((l) => `<div style="padding:4px 0;border-bottom:1px solid #2b2418">${row(l)}</div>`).join("") : "No verified sessions this month.";
  const payoutsHtml = payouts.length ? payouts.map((p) => `<div style="padding:4px 0">${day(p.at)} · ${money(p.amount_usd)} by ${esc(str(p.rail))} · ${esc(str(p.status))}${p.reference ? ` · ${esc(str(p.reference))}` : ""}</div>`).join("") : "None this month.";
  return {
    subject: `Your Accent Studio statement for ${monthName(ym)}`,
    eyebrow: "Statement",
    title: `${monthName(ym)}: ${money(totals.earned_usd)} earned.`,
    inner: `${tile(`Verified sessions · ${lines.length}`, linesHtml)}
      ${tile("This month", `${Math.round(Number(totals.seconds ?? 0) / 60)} verified minutes · ${money(totals.earned_usd)} earned${Number(totals.forfeited_usd ?? 0) > 0 ? ` · ${money(totals.forfeited_usd)} forfeited under clause 15` : ""}`)}
      ${tile("Payouts this month", payoutsHtml)}
      ${tile("Your balance today", `${money(balance.cleared_usd)} ready to request · ${money(balance.requested_usd)} on its way · ${money(balance.held_usd)} on hold · ${money(balance.paid_usd)} paid to date`)}
      <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#c9bfad">Pay is per verified hour at the published base rate times your tier for each session. Anything on hold is tied to an open clause 15 case and is released or forfeited with the decision.</p>${button(APP, "Open earnings")}`,
    text: [
      `Your statement for ${monthName(ym)} (${str(d.speaker_id)})`,
      "",
      ...(lines.length ? lines.map((l) => `- ${day(l.date)} · ${str(l.title)} · ${Math.round(Number(l.seconds ?? 0) / 60)} min · ${TIER[str(l.tier)] ?? ""} · ${money(l.amount_usd)} · ${STATUS[str(l.status)] ?? str(l.status)}`) : ["No verified sessions this month."]),
      "",
      `This month: ${Math.round(Number(totals.seconds ?? 0) / 60)} verified minutes, ${money(totals.earned_usd)} earned.`,
      `Payouts: ${payouts.length ? payouts.map((p) => `${money(p.amount_usd)} by ${str(p.rail)} (${str(p.status)})`).join(", ") : "none"}.`,
      `Balance today: ${money(balance.cleared_usd)} ready, ${money(balance.requested_usd)} on its way, ${money(balance.held_usd)} on hold, ${money(balance.paid_usd)} paid to date.`,
      APP,
    ].join("\n"),
    footer: FOOTER,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // the cron's shared key, or an admin's own session
  let allowed = false;
  const key = req.headers.get("x-notify-key");
  if (key) {
    const secret = Deno.env.get("NOTIFY_SECRET");
    if (!secret) return json({ error: "NOTIFY_SECRET is not set on the function" }, 503);
    allowed = key === secret;
  }
  if (!allowed) {
    const auth = req.headers.get("Authorization") ?? "";
    if (auth) {
      const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
      const { data: isAdmin } = await caller.rpc("is_admin");
      allowed = !!isAdmin;
    }
  }
  if (!allowed) return json({ error: "forbidden" }, 403);

  let body: { limit?: number; source?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const limit = Math.max(1, Math.min(200, Number(body.limit ?? 50)));
  const { data, error } = await admin.rpc("notify_claim", { lim: limit });
  if (error) return json({ error: error.message }, 500);
  const items = (data ?? []) as Item[];
  let sent = 0;
  let failed = 0;
  const results: { id: number; kind: string; ok: boolean; error?: string }[] = [];
  for (const it of items) {
    if (!it.email) {
      await admin.rpc("notify_done", { nid: it.id, ok: false, err: "no email on file" });
      failed += 1;
      results.push({ id: it.id, kind: it.kind, ok: false, error: "no email on file" });
      continue;
    }
    let ok = false;
    let err: string | null = null;
    try {
      const m = compose(it);
      const r = await send({ to: [it.email], subject: m.subject, html: shell(`Accent Studio · ${m.eyebrow}`, m.title, m.inner, m.footer), text: m.text });
      ok = r.ok;
      if (!r.ok) err = `${r.status} ${r.body}`.slice(0, 300);
    } catch (e) {
      err = e instanceof Error ? e.message : String(e);
    }
    await admin.rpc("notify_done", { nid: it.id, ok, err });
    if (ok) sent += 1;
    else failed += 1;
    results.push({ id: it.id, kind: it.kind, ok, error: err ?? undefined });
  }
  return json({ ok: true, source: body.source ?? "manual", claimed: items.length, sent, failed, results: results.slice(0, 25) });
});
