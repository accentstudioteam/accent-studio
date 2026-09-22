import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { Logo } from "@/components/Logo";
import { LANG_NAME } from "@/lib/game";
import { hours } from "@/lib/admin";
import { DOC_KINDS, IDENTITY_WORD, LANGUAGES, RAIL_FIELDS, closeAccount, dataRequest, identityUrl, myAccount, setLanguages, setPayout, submitIdentity, withdrawConsent, type Account, type DocKind } from "@/lib/account";
import { when } from "@/lib/verify";

interface Props {
  onBack: () => void;
  onChanged?: () => void;
}

const day = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "");

/** The contributor's account: who you are, your languages, how you get paid, the identity check, your consent, your data, leaving. */
export function Account({ onBack, onChanged }: Props) {
  const { session, signOut } = useAuth();
  const [a, setA] = useState<Account | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setA(await myAccount());
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "Couldn't load your account.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const apply = async (fn: () => Promise<Account>, done: string) => {
    setErr(null);
    setFlash(null);
    try {
      setA(await fn());
      setFlash(done);
      onChanged?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "That didn't work.");
    }
  };

  return (
    <div className="app">
      <div className="topbar">
        <button className="brand" onClick={onBack} style={{ background: "none", border: "none" }}><span style={{ color: "var(--mut)", fontFamily: "var(--mono)", fontSize: "0.9rem" }}>‹ home</span></button>
        <Logo height={22} />
      </div>
      <div className="shell">
        <div className="eyebrow" style={{ marginBottom: 6 }}>Your account{a ? ` · ${a.speaker_id}` : ""}</div>
        <h1 className="h1" style={{ marginBottom: 14 }}>{a?.full_name ? `${a.full_name.split(" ")[0]}.` : "You."}</h1>
        {err && <div className="tile" style={{ borderColor: "var(--coral)", marginBottom: 14 }}><div className="tbody" style={{ color: "var(--coral)" }}>{err}</div></div>}
        {flash && <div className="tile" style={{ borderColor: "var(--acc)", marginBottom: 14 }}><div className="tbody">{flash}</div></div>}
        {!a && !err && <div className="muted">Loading…</div>}
        {a && (
          <div className="stack">
            <div className="sheet">
              <div className="handle" />
              <div className="shead"><i />You</div>
              <div className="row2">
                <div className="tile"><div className="tlbl">Speaker id</div><div className="ttitle" style={{ fontFamily: "var(--mono)", fontSize: "0.95rem" }}>{a.speaker_id}</div><div className="tbody muted small">Labs only ever see this, never your name.</div></div>
                <div className="tile"><div className="tlbl">Since</div><div className="ttitle">{day(a.joined_at)}</div><div className="tbody muted small">{a.stats.rallies} rallies · {a.stats.scenes} scenes · {hours(a.stats.verified_seconds)} verified</div></div>
              </div>
              <div className="tile dash"><div className="tbody small">{a.email ?? "no email"}{a.city || a.country ? ` · ${[a.city, a.country].filter(Boolean).join(", ")}` : ""}. To change your email or where you live, write to hello@accentstudio.io.</div></div>
              {a.status === "paused" && <div className="tile" style={{ borderColor: "var(--gold)" }}><div className="tlbl" style={{ color: "var(--gold)" }}>Paused until {day(a.paused_until)}</div><div className="tbody small">{a.paused_reason}</div></div>}
            </div>

            <Languages a={a} onSave={(langs, primary) => void apply(() => setLanguages(langs, primary), "Languages saved.")} />
            <Payout a={a} onSave={(rail, details) => void apply(() => setPayout(rail, details), "Payout details saved.")} />
            <IdentityCheck a={a} userId={session?.user.id ?? "demo"} onDone={(next) => { setA(next); setFlash("Photos received. A member of the team checks them, usually within two days."); }} onError={setErr} />

            <div className="sheet">
              <div className="handle" />
              <div className="shead"><i className="g" />Your consent</div>
              {a.consent ? (
                <div className="tile">
                  <div className="tbody small">Contributor Agreement v{a.consent.agreement_version}, signed {day(a.consent.signed_at)}.{a.consent.withdrawn_at ? ` Withdrawn ${day(a.consent.withdrawn_at)}.` : ""}</div>
                  <div className="tbody muted small" style={{ marginTop: 4, fontFamily: "var(--mono)" }}>record {a.consent.record_sha256.slice(0, 16)}…</div>
                  {a.consent.url && <a href={a.consent.url} target="_blank" rel="noopener noreferrer" className="tbody small" style={{ color: "var(--acc)", display: "inline-block", marginTop: 6 }}>Read the agreement</a>}
                </div>
              ) : (
                <div className="tile"><div className="tbody small">No consent record found.</div></div>
              )}
              {a.status !== "withdrawn" && a.status !== "closed" && <Withdraw onConfirm={(reason) => void apply(() => withdrawConsent(reason), "Consent withdrawn. Your sessions leave future deliveries; verified earnings are still paid.")} />}
            </div>

            <DataRequests a={a} onRequest={(kind, note) => void apply(() => dataRequest(kind, note), kind === "copy" ? "Asked for a copy of your data. It comes by email within 30 days." : "Asked for deletion. We confirm by email what is deleted and what the law makes us keep.")} />

            {a.status !== "closed" && (
              <div className="sheet">
                <div className="handle" />
                <div className="shead"><i className="g" />Leaving</div>
                <CloseAccount onConfirm={(reason) => void apply(() => closeAccount(reason), "Your account is closed. Verified earnings are still paid; write to hello@accentstudio.io if you change your mind.")} />
              </div>
            )}
            <button className="pill ghost" onClick={() => void signOut()}>Sign out</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Languages({ a, onSave }: { a: Account; onSave: (langs: string[], primary: string) => void }) {
  const [langs, setLangs] = useState<string[]>(a.languages);
  const [primary, setPrimary] = useState<string>(a.primary_language ?? a.languages[0] ?? "pcm");
  const toggle = (code: string) => setLangs((l) => (l.includes(code) ? l.filter((x) => x !== code) : [...l, code]));
  const changed = [...langs].sort().join() !== [...a.languages].sort().join() || primary !== a.primary_language;
  return (
    <div className="sheet">
      <div className="handle" />
      <div className="shead"><i />Your languages</div>
      <div className="tile">
        <div className="tlbl">Pick every language you play in</div>
        <div className="chips">
          {LANGUAGES.map((l) => <button key={l.code} type="button" className={`chip${langs.includes(l.code) ? " on" : ""}`} onClick={() => toggle(l.code)}>{l.name}</button>)}
        </div>
      </div>
      <div className="field"><label>Your strongest</label>
        <select value={primary} onChange={(e) => setPrimary(e.target.value)}>
          {langs.map((c) => <option key={c} value={c}>{LANG_NAME[c] ?? c}</option>)}
        </select>
      </div>
      <button className="pill ghost" disabled={!changed || !langs.length || !langs.includes(primary)} onClick={() => onSave(langs, primary)}>Save languages</button>
    </div>
  );
}

function Payout({ a, onSave }: { a: Account; onSave: (rail: string, details: Record<string, string>) => void }) {
  const [rail, setRail] = useState<string>(a.payout?.rail ?? a.rails[0]?.key ?? "mpesa");
  const [d, setD] = useState<Record<string, string>>(a.payout?.details ?? {});
  const fields = RAIL_FIELDS[rail] ?? [];
  const railName = a.rails.find((r) => r.key === rail)?.name ?? rail;
  const ready = fields.every((f) => f.options || f.label.includes("optional") || (d[f.key] ?? "").trim().length > 0);
  return (
    <div className="sheet">
      <div className="handle" />
      <div className="shead"><i className="g" />How you get paid</div>
      <div className="tile dash"><div className="tbody muted small">A payout goes by the method here; add the details before you request one. Only the founders see them, to send the money. Minimums: {a.rails.map((r) => `${r.name} US$${r.min}`).join(" · ")}.</div></div>
      <div className="field"><label>Method</label>
        <select value={rail} onChange={(e) => { setRail(e.target.value); setD(a.payout?.rail === e.target.value ? a.payout.details : {}); }}>
          {a.rails.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
        </select>
      </div>
      {fields.map((f) => (
        <div key={f.key} className="field">
          <label>{f.label}</label>
          {f.options ? (
            <select value={d[f.key] ?? f.options[0]} onChange={(e) => setD((x) => ({ ...x, [f.key]: e.target.value }))}>
              {f.options.map((o) => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
            </select>
          ) : (
            <input value={d[f.key] ?? ""} onChange={(e) => setD((x) => ({ ...x, [f.key]: e.target.value }))} placeholder={f.hint} inputMode={f.key === "account_number" || f.key === "phone" ? "tel" : undefined} />
          )}
        </div>
      ))}
      {a.payout && <div className="tbody muted small">Saved {when(a.payout.updated_at)} · {a.rails.find((r) => r.key === a.payout?.rail)?.name ?? a.payout.rail}.</div>}
      <button className="pill mint" disabled={!ready} onClick={() => onSave(rail, { ...Object.fromEntries(fields.filter((f) => f.options).map((f) => [f.key, d[f.key] ?? f.options?.[0] ?? ""])), ...d })}>Save {railName} details</button>
    </div>
  );
}

function IdentityCheck({ a, userId, onDone, onError }: { a: Account; userId: string; onDone: (next: Account) => void; onError: (msg: string) => void }) {
  const [kind, setKind] = useState<DocKind>("nin");
  const [doc, setDoc] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [links, setLinks] = useState<{ doc: string | null; selfie: string | null } | null>(null);
  const id = a.identity;
  const canSubmit = !id || id.status === "rejected";
  const go = async () => {
    if (!doc || !selfie) return;
    setProgress("Starting…");
    try {
      const next = await submitIdentity(userId, doc, selfie, kind, setProgress);
      setDoc(null);
      setSelfie(null);
      onDone(next);
    } catch (e) {
      onError(e instanceof Error ? e.message.replace(/^.*?: /, "") : "The upload failed.");
    }
    setProgress(null);
  };
  const view = async () => {
    if (!id?.doc_path || !id.selfie_path) return;
    setLinks({ doc: await identityUrl(id.doc_path), selfie: await identityUrl(id.selfie_path) });
  };
  return (
    <div className="sheet">
      <div className="handle" />
      <div className="shead"><i />Identity check{id ? ` · ${IDENTITY_WORD[id.status]}` : ""}</div>
      <div className="tile dash"><div className="tbody muted small">One photo of an ID and one selfie, checked by a person and kept in a private store nobody but the founders can open. It confirms you are the person who signed, so pay goes to the right hands{a.identity_required ? "; it is needed before the first payout" : ""}. Never shared with labs.</div></div>
      {id && (
        <div className="tile" style={{ borderColor: id.status === "verified" ? "var(--acc)" : id.status === "rejected" ? "var(--coral)" : "var(--gold)" }}>
          <div className="tlbl">{IDENTITY_WORD[id.status]}</div>
          <div className="tbody small">{DOC_KINDS.find((k) => k.code === id.doc_kind)?.name ?? id.doc_kind} · sent {when(id.submitted_at)}{id.reviewed_at ? ` · checked ${when(id.reviewed_at)}` : ""}{id.note ? ` · ${id.note}` : ""}</div>
          {id.doc_path && !links && <button type="button" className="pill ghost" style={{ marginTop: 8, width: "auto" }} onClick={() => void view()}>See what you sent</button>}
          {links && <div className="tbody small" style={{ marginTop: 6 }}>{links.doc ? <a href={links.doc} target="_blank" rel="noopener noreferrer" style={{ color: "var(--acc)" }}>document</a> : "document (demo)"} · {links.selfie ? <a href={links.selfie} target="_blank" rel="noopener noreferrer" style={{ color: "var(--acc)" }}>selfie</a> : "selfie (demo)"}</div>}
        </div>
      )}
      {canSubmit && (
        <>
          <div className="field"><label>Document</label>
            <select value={kind} onChange={(e) => setKind(e.target.value as DocKind)}>{DOC_KINDS.map((k) => <option key={k.code} value={k.code}>{k.name}</option>)}</select>
          </div>
          <div className="field"><label>Photo of the document</label><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setDoc(e.target.files?.[0] ?? null)} /></div>
          <div className="field"><label>A selfie, holding it</label><input type="file" accept="image/jpeg,image/png,image/webp" capture="user" onChange={(e) => setSelfie(e.target.files?.[0] ?? null)} /></div>
          <button className="pill mint" disabled={!doc || !selfie || !!progress} onClick={() => void go()}>{progress ?? (id?.status === "rejected" ? "Send again" : "Send for checking")}</button>
        </>
      )}
    </div>
  );
}

function Withdraw({ onConfirm }: { onConfirm: (reason: string) => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (!open) return <button className="pill ghost" onClick={() => setOpen(true)}>Withdraw consent</button>;
  return (
    <div className="tile" style={{ borderColor: "var(--gold)" }}>
      <div className="tlbl" style={{ color: "var(--gold)" }}>Withdrawing consent</div>
      <div className="tbody small">You stop playing at once; open rallies and bookings close. Your sessions leave every future delivery. Deliveries already handed to a lab are covered by clause 6 of the agreement. Verified earnings are still paid. This cannot be undone from the app.</div>
      <div className="field"><label>Why · optional</label><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="helps us do better" /></div>
      <div className="btn-row">
        <button className="pill" style={{ width: "auto", background: "var(--gold)", color: "#0d0b08" }} onClick={() => onConfirm(reason)}>Yes, withdraw my consent</button>
        <button className="pill ghost" style={{ width: "auto" }} onClick={() => setOpen(false)}>Keep it</button>
      </div>
    </div>
  );
}

function DataRequests({ a, onRequest }: { a: Account; onRequest: (kind: "copy" | "delete", note: string) => void }) {
  const [note, setNote] = useState("");
  const openCopy = a.data_requests.some((r) => r.kind === "copy" && r.status === "open");
  const openDelete = a.data_requests.some((r) => r.kind === "delete" && r.status === "open");
  return (
    <div className="sheet">
      <div className="handle" />
      <div className="shead"><i />Your data</div>
      <div className="tile dash"><div className="tbody muted small">Under clause 9 you can ask for a copy of everything we hold about you, or for deletion. Deletion removes your name, email and photos; recordings already delivered under a licence stay pseudonymous, as the agreement explains. Either lands by email within 30 days.</div></div>
      <div className="field"><label>Anything to add · optional</label><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. only the recordings from August" /></div>
      <div className="btn-row">
        <button className="pill ghost" style={{ width: "auto" }} disabled={openCopy} onClick={() => onRequest("copy", note)}>{openCopy ? "Copy requested" : "Ask for a copy"}</button>
        <button className="pill ghost" style={{ width: "auto" }} disabled={openDelete} onClick={() => onRequest("delete", note)}>{openDelete ? "Deletion requested" : "Ask for deletion"}</button>
      </div>
      {a.data_requests.map((r) => <div key={r.id} className="tile"><div className="tbody small">{r.kind === "copy" ? "A copy of your data" : "Deletion"} · {r.status} · asked {when(r.created_at)}{r.handled_at ? ` · answered ${when(r.handled_at)}` : ""}{r.response ? ` · ${r.response}` : ""}</div></div>)}
    </div>
  );
}

function CloseAccount({ onConfirm }: { onConfirm: (reason: string) => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (!open) return <button className="pill ghost" onClick={() => setOpen(true)}>Close my account</button>;
  return (
    <div className="tile" style={{ borderColor: "var(--coral)" }}>
      <div className="tlbl" style={{ color: "var(--coral)" }}>Closing your account</div>
      <div className="tbody small">Open rallies and bookings close now. Verified earnings are still paid on the normal schedule, so add your payout details first. Your consent stays as signed unless you withdraw it above.</div>
      <div className="field"><label>Why · optional</label><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="helps us do better" /></div>
      <div className="btn-row">
        <button className="pill" style={{ width: "auto", background: "var(--coral)", color: "#0d0b08" }} onClick={() => onConfirm(reason)}>Yes, close it</button>
        <button className="pill ghost" style={{ width: "auto" }} onClick={() => setOpen(false)}>Stay</button>
      </div>
    </div>
  );
}
