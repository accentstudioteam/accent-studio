// Shared email shell for the studio's transactional mail, in the Midnight style.
export const SITE = "https://accentstudio.io";
export const INBOX = Deno.env.get("LABS_INBOX") ?? "hello@accentstudio.io";
const MINT = "#45e0a0";

export function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
}

export function tile(label: string, body: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px"><tr><td style="background:#1d1913;border:1px solid #2b2418;border-radius:14px;padding:16px 18px">
    <div style="font-family:Consolas,'Courier New',monospace;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#96897a;margin-bottom:6px">${label}</div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#c9bfad">${body}</div></td></tr></table>`;
}

export function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:10px 0 4px"><tr><td style="background:${MINT};border-radius:999px">
    <a href="${href}" style="display:inline-block;padding:14px 24px;font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:15px;color:#0d0b08;text-decoration:none">${label}</a></td></tr></table>`;
}

export function shell(eyebrow: string, title: string, inner: string, footer: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#0d0b08">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d0b08"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
  <tr><td style="padding:0 4px 22px"><img src="${SITE}/brand/png/lockup/accent-studio-lockup-dark-256h.png" width="190" height="19" alt="Accent Studio" style="display:block;border:0;width:190px;height:auto"></td></tr>
  <tr><td style="background:#17140e;border:1px solid #2b2418;border-radius:20px;padding:30px 28px">
    <div style="font-family:Consolas,'Courier New',monospace;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${MINT};margin-bottom:12px">${esc(eyebrow)}</div>
    <h1 style="margin:0 0 14px;font-family:'Arial Black',Arial,Helvetica,sans-serif;font-weight:900;font-size:30px;line-height:1.08;letter-spacing:-0.5px;color:#f4eee1">${title}</h1>
    ${inner}
  </td></tr>
  <tr><td style="padding:22px 6px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#6b6152">${footer}<br>Accent Studio, Inc. &middot; <a href="${SITE}/privacy" style="color:#96897a">privacy</a></td></tr>
</table></td></tr></table></body></html>`;
}

export async function send(payload: Record<string, unknown>): Promise<{ ok: boolean; status: number; body: string }> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return { ok: false, status: 0, body: "RESEND_API_KEY is not set" };
  const from = Deno.env.get("MAIL_FROM") ?? "Accent Studio <hello@accentstudio.io>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, reply_to: INBOX, ...payload }),
  });
  return { ok: res.ok, status: res.status, body: res.ok ? "" : await res.text() };
}
