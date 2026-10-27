// The studio's transactional mail, in the Ankara Blocks style.
//
// Five edge functions share this file byte for byte: notify, sign-agreement,
// invite-contributor, integrity-notice, and this _shared copy they are kept in
// step with. The exported signatures -- esc, tile, button, shell, send -- are
// fixed; they are called around sixty times across those functions and none of
// them typecheck against this file, so a changed signature breaks silently.
// Everything here is a restyle of the internals, not a new API. The only
// additions are avatarImg(), who() and p(), which are new exports nothing old
// has to use.
//
// LIGHT, NOT DARK. The player app is cream and paper; mail that opened near
// black was a jarring handover into it, and a dark template is exactly what
// Gmail's and Outlook's own dark-mode inversion mangles worst (it re-colours
// text but not the table backgrounds behind it). A light template declares
// `color-scheme: light only`, which Apple Mail and Outlook.com honour, and
// degrades to something readable in the clients that ignore it. The Ankara
// Blocks language -- colour blocks, 2px ink outlines, hard offset shadows --
// also only exists on a pale ground.
//
// MIDNIGHT REMAP. The call sites still carry inline colours from the old dark
// shell: `color:#f4eee1` meant "emphasis", `color:#c9bfad` meant "body". On
// cream those are invisible. relight() rewrites exactly those five literals,
// anchored to `color:` so a background can never be caught by it, as the inner
// HTML passes through shell(). Nothing in this file writes any of the five as a
// text colour, so the pass is idempotent and the other three functions get the
// new palette without being edited.
export const SITE = "https://accentstudio.io";
export const INBOX = Deno.env.get("LABS_INBOX") ?? "hello@accentstudio.io";

const INK = "#0D0B08";
const CREAM = "#F4EEE1";
const PAPER = "#FBF8F1";
const MINT = "#45E0A0";
const GOLD = "#E0A24E";
const CORAL = "#E08A5C";
const LILAC = "#A78BFA";
const INK_BODY = "#4A4034"; // body text on cream
const INK_MUTED = "#6E6354"; // labels, footer
const DEEP = "#0B6B47"; // the lockup's own green; mint is unreadable as text
const RULE = "#E2D8C4";

// Bricolage Grotesque is the brand face; it is never loaded (no web font
// survives Outlook), it is simply used when the reader happens to have it.
const DISPLAY = "'Bricolage Grotesque','Arial Black','Helvetica Neue',Helvetica,Arial,sans-serif";
const TEXT = "Arial,Helvetica,sans-serif";
const MONO = "Consolas,'Courier New',monospace";

/** The twelve Ankara Blocks characters, same ids as the app and the database. */
export const AVATAR_IDS = [
  "mamaput", "danfo", "areaboss", "bisi", "okada", "queen",
  "bankoga", "chairman", "corper", "dj", "tailor", "ngozi",
];

export function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
}

const LEGACY: [RegExp, string][] = [
  [/color:\s*#f4eee1/gi, `color:${INK}`],
  [/color:\s*#c9bfad/gi, `color:${INK_BODY}`],
  [/color:\s*#96897a/gi, `color:${INK_MUTED}`],
  [/color:\s*#45e0a0/gi, `color:${DEEP}`],
  [/#2b2418/gi, RULE],
];
function relight(html: string): string {
  let out = html;
  for (const [re, to] of LEGACY) out = out.replace(re, to);
  return out;
}

/** A gutter row. Outlook drops a margin on a table; it cannot drop a cell. */
const gap = (px: number) => `<tr><td height="${px}" style="height:${px}px;font-size:0;line-height:0">&nbsp;</td></tr>`;

/** A labelled block: cream, 2px ink outline. The workhorse; some messages stack eight. */
export function tile(label: string, body: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:separate"><tr>
    <td bgcolor="${CREAM}" style="background:${CREAM};border:2px solid ${INK};padding:12px 14px">
      <div style="font-family:${MONO};font-size:10px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:${INK_MUTED};margin:0 0 5px">${label}</div>
      <div style="font-family:${TEXT};font-size:15px;line-height:1.5;color:${INK_BODY}">${body}</div>
    </td></tr>${gap(10)}</table>`;
}

/** Mint, ink outline, hard offset shadow. Full width on a phone. */
export function button(href: string, label: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${gap(6)}<tr><td>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="as-btn"><tr>
      <td bgcolor="${INK}" style="background:${INK};padding:0 4px 4px 0;font-size:0;line-height:0">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
          <td bgcolor="${MINT}" align="center" style="background:${MINT};border:2px solid ${INK};padding:13px 22px">
            <a href="${href}" style="display:inline-block;font-family:${DISPLAY};font-weight:800;font-size:15px;line-height:1.1;color:${INK};text-decoration:none">${label}</a>
          </td></tr></table>
      </td></tr></table>
  </td></tr>${gap(4)}</table>`;
}

/** A paragraph in the body voice. New; the old call sites inline their own and get relit. */
export function p(body: string): string {
  return `<p style="margin:0 0 10px;font-family:${TEXT};font-size:15px;line-height:1.6;color:${INK_BODY}">${body}</p>`;
}

const discColour = (seed: string) => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return [MINT, GOLD, CORAL, LILAC][h % 4];
};

/**
 * A contributor's face. Gmail strips SVG and Outlook ignores it, so the twelve
 * characters are committed as PNGs under brand/png/avatar/ and served from the
 * site: 128px square for a 64px slot, with the app's own disc and 2px ink ring
 * baked in because mail cannot clip an image. When the stored avatar is missing
 * or unknown -- an old queued notification, say -- this falls back to the alias
 * initial on a brand-coloured disc built from a table cell, which needs no
 * image at all.
 */
export function avatarImg(id: string | null | undefined, alias: string, px = 64): string {
  const face = String(id ?? "");
  if (AVATAR_IDS.includes(face)) {
    return `<img src="${SITE}/brand/png/avatar/accent-studio-avatar-${face}-128.png" width="${px}" height="${px}" alt="${esc(alias)}" style="display:block;border:0;outline:none;text-decoration:none;width:${px}px;height:${px}px;border-radius:${px}px">`;
  }
  const letter = esc((alias.trim()[0] ?? "?").toUpperCase());
  const disc = discColour(alias || "?");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${px}" height="${px}"><tr>
    <td width="${px}" height="${px}" align="center" valign="middle" bgcolor="${disc}" style="width:${px}px;height:${px}px;background:${disc};border:2px solid ${INK};border-radius:${px}px;font-family:${DISPLAY};font-weight:900;font-size:${Math.round(px * 0.42)}px;line-height:1;color:${INK}">${letter}</td>
  </tr></table>`;
}

/** Avatar, alias and a caption on one line: the face the message is about. */
export function who(avatar: string | null | undefined, alias: string, caption: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="64" valign="middle" style="width:64px;padding:0 14px 0 0">${avatarImg(avatar, alias, 64)}</td>
      <td valign="middle">
        <div style="font-family:${MONO};font-size:10px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:${INK_MUTED};margin:0 0 4px">${esc(caption)}</div>
        <div style="font-family:${DISPLAY};font-weight:800;font-size:21px;line-height:1.15;letter-spacing:-0.3px;color:${INK}">${esc(alias)}</div>
      </td>
    </tr>${gap(16)}</table>`;
}

/** The eyebrow decides the block colour, so the kinds are told apart at a glance. */
function accentFor(eyebrow: string): string {
  const e = eyebrow.toLowerCase();
  if (e.includes("ping-pong")) return MINT;
  if (e.includes("live arena")) return LILAC;
  if (e.includes("clause 15")) return CORAL;
  if (e.includes("consent")) return MINT;
  if (e.includes("invitation")) return LILAC;
  return GOLD; // earnings, statement, anything new
}

export function shell(eyebrow: string, title: string, inner: string, footer: string): string {
  const accent = accentFor(eyebrow);
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${esc(title)}</title>
<style>
:root{color-scheme:light only;supported-color-schemes:light only}
body{margin:0;padding:0;width:100%!important}
img{-ms-interpolation-mode:bicubic}
@media only screen and (max-width:600px){
  .as-outer{padding:18px 10px!important}
  .as-pad{padding:20px 16px!important}
  .as-h1{font-size:25px!important}
  .as-btn,.as-btn table{width:100%!important}
}
</style></head>
<body style="margin:0;padding:0;background:${CREAM};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${CREAM}" style="background:${CREAM};width:100%">
<tr><td align="center" class="as-outer" style="padding:30px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px">
  <tr><td style="padding:0 2px 16px">
    <img src="${SITE}/brand/png/lockup/accent-studio-lockup-light-256h.png" width="180" height="18" alt="Accent Studio" style="display:block;border:0;width:180px;height:auto">
  </td></tr>
  <tr><td bgcolor="${INK}" style="background:${INK};padding:0 5px 5px 0;font-size:0;line-height:0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${PAPER}" style="background:${PAPER};border:2px solid ${INK};width:100%">
      <tr><td class="as-pad" style="padding:26px 26px 26px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td bgcolor="${accent}" style="background:${accent};border:2px solid ${INK};padding:5px 10px;font-family:${MONO};font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;line-height:1.2;color:${INK}">${esc(eyebrow)}</td>
        </tr></table>
        <h1 class="as-h1" style="margin:14px 0 14px;font-family:${DISPLAY};font-weight:900;font-size:30px;line-height:1.1;letter-spacing:-0.7px;color:${INK}">${title}</h1>
        ${relight(inner)}
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:20px 6px 0;font-family:${TEXT};font-size:12px;line-height:1.6;color:${INK_MUTED}">${relight(footer)}<br>Accent Studio, Inc. &middot; <a href="${SITE}/privacy" style="color:${DEEP};text-decoration:underline">privacy</a></td></tr>
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
