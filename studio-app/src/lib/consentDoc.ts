// A contributor's consent record as something an admin can hand over: a self-contained printable
// page (print to PDF from the browser), a machine-readable JSON file, and a check of the hosted
// agreement PDF against the hash that was recorded at signing. Admin-only, like the RPC that feeds
// it: the legal name is the point here and must not leave the Studio by any other route.
//
// The printable page mirrors the emailed copy (sign-agreement/mail.ts): the same tiles in the same
// order, light, with no web fonts and no script, so what the lawyer prints is what the signer got.
import { CLAUSE_HEADING, SIGNATURE_METHOD_LABEL, type Consent } from "@/lib/admin";

const esc = (s: unknown): string => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
const utc = (iso: string | null): string => (iso ? iso.replace("T", " ").replace(/\.\d{3}Z$/, "Z").replace(/\+00:00$/, "Z").replace("Z", " UTC") : "");

export const methodLabel = (m: string | null): string => (m ? SIGNATURE_METHOD_LABEL[m] ?? m.replace(/_/g, " ") : "not recorded");
export const clauseHeading = (id: string, clause: string): string => CLAUSE_HEADING[id] ?? `Clause ${clause}`;

/** The facts the page and the JSON share, so the two can never disagree. */
export function consentFacts(c: Consent, fallbackSpeakerId: string) {
  return {
    speaker_id: c.speaker_id ?? fallbackSpeakerId,
    alias: c.alias,
    legal_name: c.legal_name,
    legal_name_attested: c.legal_name_attested === true,
    signed_at: c.signed_at,
    withdrawn_at: c.withdrawn_at,
    signature_method: c.signature_method,
    signature_method_label: methodLabel(c.signature_method),
    accepted_terms: c.accepted_terms,
    biometric_consent: c.biometric_consent,
    agreement: {
      version: c.agreement_version,
      document_id: c.agreement?.document_id ?? null,
      effective_date: c.agreement?.effective_date ?? null,
      url: c.agreement?.url ?? null,
      sha256_recorded_at_signing: c.agreement_sha256,
      sha256_in_registry: c.agreement?.sha256 ?? null,
    },
    clauses_initialled: c.clauses_initialled.map((k) => ({ clause: k.clause, id: k.id, heading: clauseHeading(k.id, k.clause), version: k.version, initials: k.initials, text: k.text })),
    record_sha256: c.record_sha256,
  };
}
export type ConsentFacts = ReturnType<typeof consentFacts>;

const INK = "#0D0B08", CREAM = "#F4EEE1", PAPER = "#FBF8F1", MINT = "#45E0A0", BODY = "#4A4034", MUTED = "#6E6354", DEEP = "#0B6B47";
const TEXT = "Arial,Helvetica,sans-serif", MONO = "Consolas,'Courier New',monospace";

const tile = (label: string, body: string) =>
  `<div class="tile"><div class="lbl">${label}</div><div class="bd">${body}</div></div>`;
const mono = (s: unknown) => `<span class="mono">${esc(s)}</span>`;
const strong = (s: unknown) => `<b class="ink">${esc(s)}</b>`;

/** The whole page as one HTML string. */
export function consentRecordHtml(f: ConsentFacts): string {
  const printed = new Date().toISOString().replace(/\.\d{3}Z$/, "Z").replace("T", " ").replace("Z", " UTC");
  const marks = f.clauses_initialled.length
    ? f.clauses_initialled.map((k) => `<div class="clause"><div>Clause ${esc(k.clause)} &middot; ${strong(k.heading)} &middot; initialled ${strong(k.initials)} <span class="muted">(wording v${esc(k.version)})</span></div><blockquote>${esc(k.text)}</blockquote></div>`).join("")
    : `<span class="muted">None. This record predates initialled clauses; consent was given by ticking the two consents and confirming an email passcode.</span>`;
  const hashNote = f.agreement.sha256_in_registry == null
    ? ""
    : f.agreement.sha256_in_registry === f.agreement.sha256_recorded_at_signing
      ? `<div class="muted">Matches the SHA-256 held for this version in the agreement registry.</div>`
      : `<div class="warn">Does not match the registry's SHA-256 for this version (${esc(f.agreement.sha256_in_registry)}).</div>`;
  const title = f.withdrawn_at ? "Consent record (withdrawn)" : "Consent record";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><title>${esc(title)} · ${esc(f.speaker_id)}</title>
<style>
:root{color-scheme:light only}
*{box-sizing:border-box}
body{margin:0;background:${CREAM};color:${BODY};font:15px/1.55 ${TEXT};-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{max-width:640px;margin:0 auto;padding:32px 18px 48px}
.card{background:${PAPER};border:2px solid ${INK};box-shadow:5px 5px 0 ${INK};padding:26px}
.eyebrow{display:inline-block;background:${MINT};border:2px solid ${INK};padding:5px 10px;font:700 11px/1.2 ${MONO};letter-spacing:2px;text-transform:uppercase;color:${INK}}
h1{margin:14px 0 6px;font:900 30px/1.1 'Bricolage Grotesque','Arial Black',${TEXT};letter-spacing:-.7px;color:${INK}}
.lede{margin:0 0 20px;font-size:16px;line-height:1.6}
.tile{background:${CREAM};border:2px solid ${INK};padding:12px 14px;margin:0 0 10px;break-inside:avoid}
.lbl{font:700 10px/1.2 ${MONO};letter-spacing:1.6px;text-transform:uppercase;color:${MUTED};margin:0 0 5px}
.bd{font-size:15px;line-height:1.5}
.ink{color:${INK}}
.mono{font-family:${MONO};word-break:break-all;color:${INK}}
.fp{font-family:${MONO};word-break:break-all;color:${DEEP};font-weight:700}
.muted{color:${MUTED};font-size:13px}
.warn{color:#9a3b12;font-size:13px;font-weight:700}
.clause{margin:0 0 10px}
.clause:last-child{margin:0}
blockquote{margin:4px 0 0;padding:6px 10px;border-left:3px solid ${INK};font-size:14px;color:${INK};background:${PAPER}}
.foot{padding:20px 6px 0;font-size:12px;line-height:1.6;color:${MUTED}}
.foot a{color:${DEEP}}
.bar{display:flex;gap:10px;margin:0 0 16px}
.bar button{font:700 14px/1 ${TEXT};color:${INK};background:${MINT};border:2px solid ${INK};box-shadow:3px 3px 0 ${INK};padding:11px 16px;cursor:pointer}
@media print{body{background:#fff}.page{padding:0;max-width:none}.card{box-shadow:none;border-width:1.5px}.bar{display:none}}
</style></head><body><div class="page">
<div class="bar"><button type="button" onclick="window.print()">Print or save as PDF</button></div>
<div class="card">
<span class="eyebrow">Accent Studio &middot; consent record</span>
<h1>${esc(title)}</h1>
<p class="lede">${f.legal_name ? `${esc(f.legal_name)} signed` : "The contributor signed"} the Contributor Agreement v${esc(f.agreement.version)} on ${esc(utc(f.signed_at))}.${f.withdrawn_at ? ` Consent was withdrawn on ${esc(utc(f.withdrawn_at))}.` : ""} This is Accent Studio&rsquo;s copy of the record, built from the same facts as the copy emailed to the signer.</p>
${tile("Signed by", f.legal_name ? `${strong(f.legal_name)}<br><span class="muted">${f.legal_name_attested ? "The legal name the signer typed, with their attestation that it is their real legal name. Nothing in this record verifies it against a government document." : "The legal name on record. No attestation was taken at signing."}</span>` : `<span class="muted">No legal name was taken at signing. The signer confirmed by email passcode; the application name is held separately.</span>`)}
${tile("Speaker ID", `${mono(f.speaker_id)}${f.alias ? ` &middot; known in the app as ${strong(f.alias)}` : ""}<br><span class="muted">Datasets carry this identifier, never the name.</span>`)}
${tile("Signed at", mono(utc(f.signed_at)))}
${tile("How it was signed", `${esc(f.signature_method_label)}${f.signature_method ? ` <span class="muted">(${esc(f.signature_method)})</span>` : ""}${f.accepted_terms != null || f.biometric_consent != null ? `<br><span class="muted">Terms accepted: ${f.accepted_terms ? "yes" : "no"} &middot; biometric consent: ${f.biometric_consent ? "yes" : "no"}</span>` : ""}`)}
${tile("Agreement", `${strong(`v${f.agreement.version}`)}${f.agreement.document_id ? `, document ${esc(f.agreement.document_id)}` : ""}${f.agreement.effective_date ? `, effective ${esc(f.agreement.effective_date)}` : ""}<br>SHA-256 at signing ${mono(f.agreement.sha256_recorded_at_signing ?? "not recorded")}${hashNote}${f.agreement.url ? `<br><a href="${esc(f.agreement.url)}" style="color:${DEEP}">${esc(f.agreement.url)}</a>` : ""}`)}
${tile("Clauses initialled", marks)}
${f.withdrawn_at ? tile("Withdrawn", `${mono(utc(f.withdrawn_at))}<br><span class="muted">New use stopped from this moment; undelivered recordings are deleted within 30 days; deliveries already made are covered by clause 6 of the agreement.</span>`) : ""}
${tile("Consent record fingerprint (SHA-256)", `<span class="fp">${esc(f.record_sha256)}</span><br><span class="muted">This fingerprint travels inside every dataset session the speaker recorded. It is the SHA-256 of the canonical JSON of the record, so anyone holding the record can recompute it.</span>`)}
</div>
<div class="foot">Printed from the Accent Studio admin on ${esc(printed)}. Contains the signer&rsquo;s legal name: for Accent Studio, its counsel and a buyer&rsquo;s diligence under NDA only.<br>Accent Studio, Inc. &middot; <a href="https://accentstudio.io/privacy">privacy</a></div>
</div></body></html>`;
}

/** Opens the printable record in a new tab from a blob, so nothing is written into the Studio's own document. */
export function openConsentRecord(f: ConsentFacts): void {
  const url = URL.createObjectURL(new Blob([consentRecordHtml(f)], { type: "text/html" }));
  const w = window.open(url, "_blank", "noopener");
  if (!w) window.location.assign(url);
  // the tab holds its own copy of the blob once loaded; revoke after it has had time to fetch
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** The same facts as JSON, downloaded as a file named by speaker id. */
export function downloadConsentJson(f: ConsentFacts): void {
  const body = JSON.stringify({ kind: "accent_studio_consent_record", exported_at: new Date().toISOString(), ...f }, null, 2);
  const url = URL.createObjectURL(new Blob([body], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `consent_${f.speaker_id}_v${f.agreement.version}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export type LiveHash = { state: "idle" } | { state: "checking" } | { state: "done"; sha256: string; matches: boolean } | { state: "failed"; why: string };

/** Fetches the hosted agreement PDF and hashes it in the browser. The host sends
 *  `Access-Control-Allow-Origin: *`, so this works from the Studio; if a host ever stops,
 *  the caller shows both hashes side by side instead. */
export async function hashLivePdf(url: string, recorded: string | null): Promise<LiveHash> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return { state: "failed", why: `the host answered ${res.status}` };
    const buf = await res.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buf);
    const sha256 = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
    return { state: "done", sha256, matches: recorded != null && sha256 === recorded.toLowerCase() };
  } catch (e) {
    return { state: "failed", why: e instanceof Error ? e.message : "the browser could not read the file" };
  }
}
