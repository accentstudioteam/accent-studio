import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { LANG_NAME } from "@/lib/game";
import { hours } from "@/lib/admin";
import { DOC_KINDS, IDENTITY_WORD, LANGUAGES, RAIL_FIELDS, closeAccount, dataRequest, identityUrl, myAccount, setLanguages, setPayout, submitIdentity, withdrawConsent, type Account, type DocKind } from "@/lib/account";
import { when } from "@/lib/verify";
import { avatarById, avatarFor } from "@/components/ankara-avatars";
import { Ava, Notice, Page, TopBar } from "@/components/ankara-ui";

interface Props {
  onBack: () => void;
  onChanged?: () => void;
  /** The stored avatar id, so this screen shows the same face as the rally and the mail. */
  avatar?: string | null;
}

const day = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "");

/* ============================================================================
   You, in the approved "Ankara Blocks" direction.

   The prototype's You screen is .you-card (the avatar and speaker id) over
   .rows (the list of facts). Everything below it — languages, payout, the
   identity check, consent, data requests, closing — keeps its own RPC, its own
   validation and its own wording; only the markup is the skin's.
   ========================================================================= */
export function Account({ onBack, onChanged, avatar }: Props) {
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
    <Page>
      <TopBar onBack={onBack} backLabel="Back home" eyebrow={`Your account${a ? ` · ${a.speaker_id}` : ""}`} title={a?.full_name ? `${a.full_name.split(" ")[0]}.` : "You."} />

      {err && <Notice tone="coral">{err}</Notice>}
      {flash && <Notice>{flash}</Notice>}
      {!a && !err && <div className="sys">Opening your account</div>}

      {a && (
        <>
          <div className="card you-card">
            <Ava who={avatar ? avatarById(avatar) : avatarFor(a.speaker_id)} size={64} />
            <div>
              <b>{a.full_name ?? a.speaker_id}</b>
              <span className="mono">{a.speaker_id} · since {day(a.joined_at)}</span>
            </div>
          </div>

          <ul className="card rows">
            <li><span>Rallies</span><span className="v">{a.stats.rallies}</span></li>
            <li><span>Scenes</span><span className="v">{a.stats.scenes}</span></li>
            <li><span>Verified</span><span className="v">{hours(a.stats.verified_seconds)}</span></li>
            <li><span>Contact</span><span className="v">{a.email ?? "no email"}{a.city || a.country ? ` · ${[a.city, a.country].filter(Boolean).join(", ")}` : ""}</span></li>
          </ul>
          <p className="note-p">Labs only ever see your speaker id, never your name. To change your email or where you live, write to hello@accentstudio.io.</p>

          {a.status === "paused" && <Notice>Paused until {day(a.paused_until)}. {a.paused_reason}</Notice>}

          <Languages a={a} onSave={(langs, primary) => void apply(() => setLanguages(langs, primary), "Languages saved.")} />
          <Payout a={a} onSave={(rail, details) => void apply(() => setPayout(rail, details), "Payout details saved.")} />
          <IdentityCheck a={a} userId={session?.user.id ?? "demo"} onDone={(next) => { setA(next); setFlash("Photos received. A member of the team checks them, usually within two days."); }} onError={setErr} />

          <div className="sec-h"><h3>Your consent</h3></div>
          <div className="card pad">
            {a.consent ? (
              <>
                <p>Contributor Agreement v{a.consent.agreement_version}, signed {day(a.consent.signed_at)}.{a.consent.withdrawn_at ? ` Withdrawn ${day(a.consent.withdrawn_at)}.` : ""}</p>
                <p className="mono muted" style={{ marginTop: 6 }}>record {a.consent.record_sha256.slice(0, 16)}…</p>
                {a.consent.url && <a className="btn btn-outline btn-sm" style={{ marginTop: 10 }} href={a.consent.url} target="_blank" rel="noopener noreferrer">Read the agreement</a>}
              </>
            ) : (
              <p>No consent record found.</p>
            )}
          </div>
          {a.status !== "withdrawn" && a.status !== "closed" && <Withdraw onConfirm={(reason) => void apply(() => withdrawConsent(reason), "Consent withdrawn. Your sessions leave future deliveries; verified earnings are still paid.")} />}

          <DataRequests a={a} onRequest={(kind, note) => void apply(() => dataRequest(kind, note), kind === "copy" ? "Asked for a copy of your data. It comes by email within 30 days." : "Asked for deletion. We confirm by email what is deleted and what the law makes us keep.")} />

          {a.status !== "closed" && (
            <>
              <div className="sec-h"><h3>Leaving</h3></div>
              <CloseAccount onConfirm={(reason) => void apply(() => closeAccount(reason), "Your account is closed. Verified earnings are still paid; write to hello@accentstudio.io if you change your mind.")} />
            </>
          )}
          <button className="btn btn-outline btn-block signout" type="button" onClick={() => void signOut()}>Sign out</button>
        </>
      )}
    </Page>
  );
}

function Languages({ a, onSave }: { a: Account; onSave: (langs: string[], primary: string) => void }) {
  const [langs, setLangs] = useState<string[]>(a.languages);
  const [primary, setPrimary] = useState<string>(a.primary_language ?? a.languages[0] ?? "pcm");
  const toggle = (code: string) => setLangs((l) => (l.includes(code) ? l.filter((x) => x !== code) : [...l, code]));
  const changed = [...langs].sort().join() !== [...a.languages].sort().join() || primary !== a.primary_language;
  return (
    <>
      <div className="sec-h"><h3>Your languages</h3></div>
      <div className="card pad">
        <div className="eyebrow">Pick every language you play in</div>
        <div className="chips" style={{ marginTop: 8 }}>
          {LANGUAGES.map((l) => (
            <button key={l.code} type="button" aria-pressed={langs.includes(l.code)} className={`chip ${langs.includes(l.code) ? "chip-mint" : "chip-cream"}`} onClick={() => toggle(l.code)}>{l.name}</button>
          ))}
        </div>
        <div className="field" style={{ marginTop: 14 }}>
          <label htmlFor="primary">Your strongest</label>
          <select id="primary" value={primary} onChange={(e) => setPrimary(e.target.value)}>
            {langs.map((c) => <option key={c} value={c}>{LANG_NAME[c] ?? c}</option>)}
          </select>
        </div>
        <button className="btn btn-mint btn-block" type="button" style={{ marginTop: 12 }} disabled={!changed || !langs.length || !langs.includes(primary)} onClick={() => onSave(langs, primary)}>Save languages</button>
      </div>
    </>
  );
}

function Payout({ a, onSave }: { a: Account; onSave: (rail: string, details: Record<string, string>) => void }) {
  const [rail, setRail] = useState<string>(a.payout?.rail ?? a.rails[0]?.key ?? "mpesa");
  const [d, setD] = useState<Record<string, string>>(a.payout?.details ?? {});
  const fields = RAIL_FIELDS[rail] ?? [];
  const railName = a.rails.find((r) => r.key === rail)?.name ?? rail;
  const ready = fields.every((f) => f.options || f.label.includes("optional") || (d[f.key] ?? "").trim().length > 0);
  return (
    <>
      <div className="sec-h"><h3>How you get paid</h3></div>
      <div className="card pad">
        <p className="note-p" style={{ marginTop: 0 }}>A payout goes by the method here; add the details before you request one. Only the founders see them, to send the money. Minimums: {a.rails.map((r) => `${r.name} US$${r.min}`).join(" · ")}.</p>
        <div className="field" style={{ marginTop: 14 }}>
          <label htmlFor="rail-method">Method</label>
          <select id="rail-method" value={rail} onChange={(e) => { setRail(e.target.value); setD(a.payout?.rail === e.target.value ? a.payout.details : {}); }}>
            {a.rails.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
          </select>
        </div>
        {fields.map((f) => (
          <div key={f.key} className="field" style={{ marginTop: 12 }}>
            <label htmlFor={`pf-${f.key}`}>{f.label}</label>
            {f.options ? (
              <select id={`pf-${f.key}`} value={d[f.key] ?? f.options[0]} onChange={(e) => setD((x) => ({ ...x, [f.key]: e.target.value }))}>
                {f.options.map((o) => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
              </select>
            ) : (
              <input id={`pf-${f.key}`} value={d[f.key] ?? ""} onChange={(e) => setD((x) => ({ ...x, [f.key]: e.target.value }))} placeholder={f.hint} inputMode={f.key === "account_number" || f.key === "phone" ? "tel" : undefined} />
            )}
          </div>
        ))}
        {a.payout && <p className="note-p">Saved {when(a.payout.updated_at)} · {a.rails.find((r) => r.key === a.payout?.rail)?.name ?? a.payout.rail}.</p>}
        <button className="btn btn-mint btn-block" type="button" style={{ marginTop: 12 }} disabled={!ready} onClick={() => onSave(rail, { ...Object.fromEntries(fields.filter((f) => f.options).map((f) => [f.key, d[f.key] ?? f.options?.[0] ?? ""])), ...d })}>Save {railName} details</button>
      </div>
    </>
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
    <>
      <div className="sec-h"><h3>Identity check</h3>{id && <span className={`chip ${id.status === "verified" ? "chip-mint" : id.status === "rejected" ? "chip-coral" : "chip-gold"}`}>{IDENTITY_WORD[id.status]}</span>}</div>
      <div className="card pad">
        <p className="note-p" style={{ marginTop: 0 }}>One photo of an ID and one selfie, checked by a person and kept in a private store nobody but the founders can open. It confirms you are the person who signed, so pay goes to the right hands{a.identity_required ? "; it is needed before the first payout" : ""}. Never shared with labs.</p>
        {id && (
          <p style={{ marginTop: 10, fontSize: 14 }}>
            {DOC_KINDS.find((k) => k.code === id.doc_kind)?.name ?? id.doc_kind} · sent {when(id.submitted_at)}{id.reviewed_at ? ` · checked ${when(id.reviewed_at)}` : ""}{id.note ? ` · ${id.note}` : ""}
          </p>
        )}
        {id?.doc_path && !links && <button className="btn btn-outline btn-sm" type="button" style={{ marginTop: 10 }} onClick={() => void view()}>See what you sent</button>}
        {links && <p className="mono" style={{ marginTop: 8 }}>{links.doc ? <a href={links.doc} target="_blank" rel="noopener noreferrer">document</a> : "document (demo)"} · {links.selfie ? <a href={links.selfie} target="_blank" rel="noopener noreferrer">selfie</a> : "selfie (demo)"}</p>}
        {canSubmit && (
          <>
            <div className="field" style={{ marginTop: 14 }}>
              <label htmlFor="doc-kind">Document</label>
              <select id="doc-kind" value={kind} onChange={(e) => setKind(e.target.value as DocKind)}>{DOC_KINDS.map((k) => <option key={k.code} value={k.code}>{k.name}</option>)}</select>
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="doc-file">Photo of the document</label>
              <input id="doc-file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setDoc(e.target.files?.[0] ?? null)} />
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="selfie-file">A selfie, holding it</label>
              <input id="selfie-file" type="file" accept="image/jpeg,image/png,image/webp" capture="user" onChange={(e) => setSelfie(e.target.files?.[0] ?? null)} />
            </div>
            <button className="btn btn-mint btn-block" type="button" style={{ marginTop: 12 }} disabled={!doc || !selfie || !!progress} onClick={() => void go()}>{progress ?? (id?.status === "rejected" ? "Send again" : "Send for checking")}</button>
          </>
        )}
      </div>
    </>
  );
}

function Withdraw({ onConfirm }: { onConfirm: (reason: string) => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (!open) return <button className="btn btn-outline btn-block" type="button" style={{ marginTop: 12 }} onClick={() => setOpen(true)}>Withdraw consent</button>;
  return (
    <div className="blk blk-gold pat-zig-6 bal">
      <div className="lab">Withdrawing consent</div>
      <p style={{ fontSize: 13.5, fontWeight: 500, marginTop: 6, lineHeight: 1.45 }}>You stop playing at once; open rallies and bookings close. Your sessions leave every future delivery. Deliveries already handed to a lab are covered by clause 6 of the agreement. Verified earnings are still paid. This cannot be undone from the app.</p>
      <div className="field" style={{ marginTop: 12 }}>
        <label htmlFor="wd-why">Why · optional</label>
        <input id="wd-why" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="helps us do better" />
      </div>
      <div className="btn-row" style={{ marginTop: 12 }}>
        <button className="btn btn-ink" type="button" onClick={() => onConfirm(reason)}>Yes, withdraw my consent</button>
        <button className="btn btn-outline" type="button" onClick={() => setOpen(false)}>Keep it</button>
      </div>
    </div>
  );
}

function DataRequests({ a, onRequest }: { a: Account; onRequest: (kind: "copy" | "delete", note: string) => void }) {
  const [note, setNote] = useState("");
  const openCopy = a.data_requests.some((r) => r.kind === "copy" && r.status === "open");
  const openDelete = a.data_requests.some((r) => r.kind === "delete" && r.status === "open");
  return (
    <>
      <div className="sec-h"><h3>Your data</h3></div>
      <div className="card pad">
        <p className="note-p" style={{ marginTop: 0 }}>Under clause 9 you can ask for a copy of everything we hold about you, or for deletion. Deletion removes your name, email and photos; recordings already delivered under a licence stay pseudonymous, as the agreement explains. Either lands by email within 30 days.</p>
        <div className="field" style={{ marginTop: 14 }}>
          <label htmlFor="dr-note">Anything to add · optional</label>
          <input id="dr-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. only the recordings from August" />
        </div>
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button className="btn btn-outline btn-sm" type="button" disabled={openCopy} onClick={() => onRequest("copy", note)}>{openCopy ? "Copy requested" : "Ask for a copy"}</button>
          <button className="btn btn-outline btn-sm" type="button" disabled={openDelete} onClick={() => onRequest("delete", note)}>{openDelete ? "Deletion requested" : "Ask for deletion"}</button>
        </div>
      </div>
      {a.data_requests.length > 0 && (
        <ul className="card lines">
          {a.data_requests.map((r) => (
            <li key={r.id}>
              <span className="d">{when(r.created_at)}</span>
              <span className="t">{r.kind === "copy" ? "A copy of your data" : "Deletion"}{r.response ? ` · ${r.response}` : ""}</span>
              <span className="chip chip-cream">{r.status}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function CloseAccount({ onConfirm }: { onConfirm: (reason: string) => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (!open) return <button className="btn btn-outline btn-block" type="button" onClick={() => setOpen(true)}>Close my account</button>;
  return (
    <div className="blk blk-coral pat-zig-6 bal">
      <div className="lab">Closing your account</div>
      <p style={{ fontSize: 13.5, fontWeight: 500, marginTop: 6, lineHeight: 1.45 }}>Open rallies and bookings close now. Verified earnings are still paid on the normal schedule, so add your payout details first. Your consent stays as signed unless you withdraw it above.</p>
      <div className="field" style={{ marginTop: 12 }}>
        <label htmlFor="cl-why">Why · optional</label>
        <input id="cl-why" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="helps us do better" />
      </div>
      <div className="btn-row" style={{ marginTop: 12 }}>
        <button className="btn btn-ink" type="button" onClick={() => onConfirm(reason)}>Yes, close it</button>
        <button className="btn btn-outline" type="button" onClick={() => setOpen(false)}>Stay</button>
      </div>
    </div>
  );
}
