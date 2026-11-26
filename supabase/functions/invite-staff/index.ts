// Staff invite: adds a linguist or admin to the allowlist and emails a branded
// invitation in the Ankara Blocks style. JWT-gated; the caller must be an admin.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SITE, button, esc, p, send, shell, tile } from "./mail.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

  let body: { email?: string; role?: string; note?: string } = {};
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }

  const email = (body.email ?? "").trim().toLowerCase();
  const role = body.role ?? "linguist";
  const note = body.note ?? "";

  if (!email.includes("@")) return json({ error: "bad email" }, 400);
  if (role !== "linguist" && role !== "admin") return json({ error: "role must be linguist or admin" }, 400);

  // Call the staff_invite RPC as the caller so the is_admin() check passes
  const { data: result, error } = await caller.rpc("staff_invite", { email, role, note });
  if (error) return json({ error: error.message }, 400);

  // Send branded invitation email
  const roleName = role === "admin" ? "an admin" : "a linguist";
  const inner = `
    ${p(`You&rsquo;ve been invited to join the Accent Studio team as <b>${esc(roleName)}</b>.`)}
    ${tile("What you'll do", role === "linguist"
      ? "Verify and audit recorded sessions in the cutting room: listen to what was said, check the transcript, and score the quality of the recording. The speakers are paid at the rate your work confirms."
      : "Full access to the studio: manage contributors, review payouts, run projects, and oversee quality."
    )}
    ${tile("How to get in", `Go to <a href="${SITE}/studio" style="color:#0B6B47">${esc(SITE.replace("https://", ""))}/studio</a> and sign in with the magic link sent to this email address. Your ${esc(role)} role is already on.`)}
    ${button(SITE + "/studio", "Open the studio")}`;

  const text = [
    "You're invited to the team.",
    "",
    `You've been invited to join the Accent Studio team as ${roleName}.`,
    "",
    role === "linguist"
      ? "You'll verify and audit recorded sessions in the cutting room: listen to what was said, check the transcript, and score quality."
      : "Full access to the studio: manage contributors, review payouts, run projects, and oversee quality.",
    "",
    `Sign in at ${SITE}/studio using the magic link sent to this email. Your ${role} role is already on.`,
  ].join("\n");

  const mail = await send({
    to: [email],
    subject: "You're invited to the Accent Studio team",
    html: shell(
      "Accent Studio · team",
      "You’re on the team.",
      inner,
      `You’re getting this because an admin at Accent Studio added you as ${esc(roleName)}. Questions? Reply to this email.`,
    ),
    text,
  });
  if (!mail.ok) console.error("staff invite mail failed", mail.status, mail.body);

  return json({ ...(result as Record<string, unknown>), mailed: mail.ok });
});
