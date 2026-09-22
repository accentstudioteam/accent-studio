import { useCallback, useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { LANG_NAME, cardAudioUrl, turnUrl } from "@/lib/game";
import { REASON_LABEL, STATUS_LABEL, claim, draft as requestDraft, flag, verifySession, when, workbench, type CaseReason, type Speaker, type VerifyResult, type Workbench as Bench } from "@/lib/verify";
import { WorkTurnCard } from "@/routes/WorkTurnCard";
import { isDemo } from "@/lib/demo";

const TIER_LABEL: Record<string, string> = { platinum: "Platinum", gold: "Gold", silver: "Silver", floor: "Quality floor" };

interface Props {
  sessionId: string;
  onBack: () => void;
  onCases?: () => void;
  embedded?: boolean;
}

/** One rally on the linguist's bench: the card, every take, the peer ratings, and the verify step. */
export function Workbench({ sessionId, onBack, onCases, embedded }: Props) {
  const [w, setW] = useState<Bench | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await workbench(sessionId);
      setW(next);
      setErr(null);
      const missing = next.turns.filter((t) => !urls[t.turn_id]);
      if (missing.length) {
        const pairs = await Promise.all(missing.map(async (t) => [t.turn_id, await turnUrl(t.audio_path)] as const));
        setUrls((u) => ({ ...u, ...Object.fromEntries(pairs.filter(([, v]) => v).map(([k, v]) => [k, v as string])) }));
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "Couldn't load the rally.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  // while the vendor is drafting, keep the bench fresh
  const drafting = Boolean(w && w.verification.status === "in_progress" && w.turns.some((t) => t.latest && t.draft && (t.draft.status === "pending" || t.draft.status === "running")));
  useEffect(() => {
    if (!drafting) return;
    const id = window.setInterval(() => void load(), isDemo() ? 1_200 : 4_000);
    return () => window.clearInterval(id);
  }, [drafting, load]);

  const [draftErr, setDraftErr] = useState<string | null>(null);
  const runDrafts = async (retry: boolean) => {
    setDraftErr(null);
    const pending = requestDraft(sessionId, retry);
    window.setTimeout(() => void load(), 600); // show the running state while the vendor works; polling takes over from there
    try {
      const r = await pending;
      if (r.skipped > 0 && r.reason) setDraftErr(r.reason);
    } catch (e) {
      setDraftErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "Drafting failed.");
    }
    await load();
  };

  const doClaim = async () => {
    setBusy(true);
    setErr(null);
    try {
      await claim(sessionId);
      await load();
      void runDrafts(false); // the vendor works while the editor starts listening
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "Couldn't claim the rally.");
    }
    setBusy(false);
  };

  const doVerify = async () => {
    if (!score) return setErr("Give the rally an editor score first.");
    setBusy(true);
    setErr(null);
    try {
      const r = await verifySession(sessionId, score, notes);
      setResult(r);
      setFlash(null);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "Couldn't verify the rally.");
    }
    setBusy(false);
  };

  const doFlag = async (who: Speaker, reason: CaseReason, detail: string, tid: string) => {
    await flag(sessionId, who, reason, detail, tid);
    setFlash(`Case opened against ${w?.speakers[who] ?? `speaker ${who.toUpperCase()}`}: ${REASON_LABEL[reason]}. Pay for this rally waits until it is decided. Nothing else changes yet.`);
    await load();
  };

  const topbar = (
    <div className="topbar">
      <button className="brand" onClick={onBack} style={{ background: "none", border: "none" }}><span style={{ color: "var(--mut)", fontFamily: "var(--mono)", fontSize: "0.9rem" }}>‹ queue</span></button>
      {w ? <span className="chip" style={{ fontFamily: "var(--mono)", fontSize: "0.7rem" }}>{w.verification.status.replace("_", " ")}</span> : <Logo height={22} />}
    </div>
  );

  if (!w) {
    const inner = <div className="shell" style={{ maxWidth: 720 }}>{err ? <div className="tile" style={{ borderColor: "var(--coral)" }}><div className="tbody" style={{ color: "var(--coral)" }}>{err}</div></div> : <div className="full-center"><div className="spin" /></div>}</div>;
    return embedded ? inner : <div className="app">{topbar}{inner}</div>;
  }

  const v = w.verification;
  const mine = v.status === "in_progress" && Boolean(v.claimed_by_me);
  const heldByOther = v.status === "in_progress" && !v.claimed_by_me;
  const latest = w.turns.filter((t) => t.latest);
  const saved = latest.filter((t) => t.verification?.verified_text && t.verification.confidence != null).length;
  const cardAudio = cardAudioUrl(w.card.audio_path);
  const title = v.status === "verified" ? `Verified · ${TIER_LABEL[v.quality_tier ?? ""] ?? v.quality_tier}.` : v.status === "forfeited" ? "Forfeited under clause 15." : mine ? "Verify this rally." : heldByOther ? "Held by another editor." : "Claim it to start.";

  const body = (
    <div className="shell bench">
      {embedded && <button type="button" onClick={onBack} style={{ background: "none", border: "none", color: "var(--mut)", fontFamily: "var(--mono)", fontSize: "0.9rem", padding: 0, marginBottom: 10, cursor: "pointer" }}>‹ queue</button>}
      <div className="eyebrow" style={{ marginBottom: 6 }}>{w.card.title} · {LANG_NAME[w.language] ?? w.language} · {w.mode === "live" ? "live scene" : w.session_status === "abandoned" ? "closed, partner went quiet" : "complete"} · {when(w.completed_at)}</div>
      <h1 className="h1" style={{ marginBottom: 14, fontSize: "clamp(1.4rem,6vw,2rem)" }}>{title}</h1>
      {v.status === "verified" && v.audit_outcome && <div className="tile" style={{ borderColor: v.audit_outcome === "adjusted" ? "var(--gold)" : "var(--acc)", marginBottom: 14 }}><div className="tbody small">Audited {when(v.audited_at ?? "")} by {v.audit_editor_id ?? "?"}: {v.audit_outcome === "upheld" ? "the verification was upheld." : "the score was adjusted and unpaid lines re-priced."}</div></div>}
      {v.status === "verified" && !v.audit_outcome && v.audit_pick && <div className="tile dash" style={{ marginBottom: 14 }}><div className="tbody muted small">Drawn for the random audit: a second editor will listen before delivery.</div></div>}

      <div className="sheet" style={{ marginBottom: 18 }}>
        <div className="handle" />
        <div className="shead"><i className="g" />The card</div>
        <div className="tile acc">
          <div className="tlbl">The situation {cardAudio && <>· <a href={cardAudio} target="_blank" rel="noopener noreferrer" style={{ color: "var(--acc)" }}>▶ listen</a></>}</div>
          <div className="ttitle" style={{ fontSize: "1rem", lineHeight: 1.35 }}>{w.card.situation}</div>
          {w.card.english_note && <div className="tbody muted small" style={{ marginTop: 6 }}>{w.card.english_note}</div>}
        </div>
        <div className="row2">
          <div className="tile"><div className="tlbl">Speaker A · {w.speakers.a ?? "?"}</div><div className="tbody small">{w.card.persona_a}</div></div>
          <div className="tile"><div className="tlbl">Speaker B · {w.speakers.b ?? "?"}</div><div className="tbody small">{w.card.persona_b}</div></div>
        </div>
        {(w.flags.length > 0 || w.abandoned_reason) && (
          <div className="tile dash">
            <div className="tlbl">Notes from the game</div>
            <div className="tbody muted small">
              {w.abandoned_reason === "partner_quiet" && "One partner stopped replying, so the rally closed early. The takes here are kept, count for the speaker who stayed, and are verified like any other. "}
              {w.flags.includes("short_rally") && "The rally came out shorter than the minimum; check it is real content, not a rushed one. "}
              {w.flags.includes("rotation_override") && "This pair had already played their rotation together; listen for arranged content. "}
            </div>
          </div>
        )}
        {w.cases.length > 0 && (
          <div className="tile" style={{ borderColor: "var(--gold)" }}>
            <div className="tlbl">Integrity cases on this rally</div>
            {w.cases.map((c) => <div key={c.id} className="tbody small">Speaker {c.who.toUpperCase()} · {REASON_LABEL[c.reason]} · {c.decision ? `decided: ${c.decision.replace(/_/g, " ")}` : STATUS_LABEL[c.status]}</div>)}
            {onCases && <button className="pill ghost" style={{ marginTop: 8 }} onClick={onCases}>Open the cases</button>}
          </div>
        )}
        {v.status === "pending" && <button className="pill mint" disabled={busy} onClick={() => void doClaim()}>{busy ? "Claiming…" : "Claim this rally"}</button>}
        {heldByOther && <div className="tbody muted small">Another editor is working on it. It frees itself when their hold expires.</div>}
        {mine && <div className="tbody muted small">Held by you since {when(v.claimed_at)}. {saved} of {latest.length} takes saved.{w.stt.show && w.stt.engine !== "none" ? ` Machine drafts: ${latest.filter((t) => t.draft?.status === "done").length} of ${latest.length}${drafting ? ", drafting…" : ""}.` : ""}</div>}
        {mine && !drafting && w.stt.engine !== "none" && latest.some((t) => !t.draft || t.draft.status === "failed" || t.draft.status === "skipped") && (
          <button className="pill ghost" onClick={() => void runDrafts(true)}>{latest.some((t) => t.draft) ? "Retry the machine drafts" : "Ask for machine drafts"}</button>
        )}
        {draftErr && <div className="tbody small" style={{ color: "var(--gold)" }}>Drafts: {draftErr}</div>}
      </div>

      {flash && <div className="tile" style={{ borderColor: "var(--gold)", marginBottom: 14 }}><div className="tbody">{flash}</div></div>}
      {err && <div className="tile" style={{ borderColor: "var(--coral)", marginBottom: 14 }}><div className="tbody" style={{ color: "var(--coral)" }}>{err}</div></div>}

      <div className="sheet" style={{ marginBottom: 18 }}>
        <div className="handle" />
        <div className="shead"><i />{w.mode === "live" ? "The two tracks" : "The takes"} · {latest.length}{w.peer_score != null ? ` · peer score ${Number(w.peer_score).toFixed(2)}` : ""}</div>
            {w.mode === "live" && <div className="tbody muted small">A live scene: each speaker's whole five minutes is one track, recorded on their own phone. Transcribe the track as spoken; the partner's words are not in it.</div>}
        {w.turns.map((t) => <WorkTurnCard key={`${t.turn_id}-${t.verification?.updated_at ?? ""}`} t={t} w={w} src={urls[t.turn_id] ?? null} canEdit={mine && t.latest} onSaved={() => void load()} onFlag={doFlag} />)}
      </div>

      {mine && (
        <div className="sheet" style={{ marginBottom: 18 }}>
          <div className="handle" />
          <div className="shead"><i className="g" />Verify</div>
          <div className="tile">
            <div className="tlbl">Editor score · how well does this rally serve as data?</div>
            <div className="tbody muted small" style={{ marginBottom: 8 }}>Natural speech, on the card, clean enough to use. The tier is the partner's ratings blended half and half with this score, against the published thresholds.</div>
            <div className="stars" role="radiogroup" aria-label="Editor score">
              {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={score === n} aria-label={`${n} of 5`} className={score >= n ? "on" : ""} onClick={() => setScore(n)}>★</button>)}
            </div>
          </div>
          <div className="field">
            <label>Notes for the audit (optional)</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the auditor or the next linguist should know." />
          </div>
          <div className="tbody muted small">
            Thresholds: {w.tiers.filter((t) => t.min > 0).map((t) => `${TIER_LABEL[t.tier] ?? t.tier} from ${t.min} (x${t.x})`).join(" · ")} · below that the floor (x0.5). Verifying locks the transcripts and sets the tier; pay for the rally follows unless a case holds it.
          </div>
          <button className="pill mint" disabled={busy || saved < latest.length} onClick={() => void doVerify()}>{busy ? "Verifying…" : saved < latest.length ? `Save all ${latest.length} takes first` : "Verify this rally"}</button>
        </div>
      )}

      {(v.status === "verified" || v.status === "forfeited") && (
        <div className="tile" style={{ borderColor: v.status === "verified" ? "var(--acc)" : "var(--coral)", marginBottom: 18 }}>
          <div className="tlbl">{v.status === "verified" ? `Verified by ${v.editor_id ?? "you"} · ${when(v.verified_at)}` : "Forfeited"}</div>
          <div className="tbody">
            {v.status === "verified" ? (
              <>Peer {v.peer_score != null ? Number(v.peer_score).toFixed(2) : "none"} + editor {v.editor_score} → <b>{Number(v.quality_score).toFixed(2)}</b> · <b>{TIER_LABEL[v.quality_tier ?? ""] ?? v.quality_tier}</b> x{v.multiplier} · {Number(v.verified_seconds).toFixed(1)} verified seconds{v.audit_pick ? " · picked for random audit" : ""}{v.hold ? ". Pay is on hold until the open case is decided." : "."}{(() => { const ws = latest.map((t) => t.verification?.draft_wer).filter((x): x is number => x != null); return ws.length ? ` Machine drafts were ${Math.round((ws.reduce((a, b) => a + Number(b), 0) / ws.length) * 100)}% off on average.` : ""; })()}</>
            ) : (
              "Confirmed dishonesty under clause 15. Pending pay for this rally is forfeited; every other verified rally is still paid."
            )}
            {v.notes && <div className="muted small" style={{ marginTop: 6 }}>Notes: {v.notes}</div>}
            {(result?.earnings ?? w.earnings ?? []).length > 0 && (
              <div className="small" style={{ marginTop: 8 }}>
                <div className="tlbl">Posted to the ledger · per speaker per verified hour</div>
                {(result?.earnings ?? w.earnings ?? []).map((e) => (
                  <div key={e.speaker} className="tbody small">Speaker {e.speaker.toUpperCase()} · {e.speaker_id} · {Math.round(Number(e.seconds))} s · {e.tier} x{e.multiplier} at ${Number(e.base_rate_usd)}/h → <b>${Number(e.amount_usd).toFixed(2)}</b> · {e.status === "held" ? "on hold, clause 15" : e.status}</div>
                ))}
              </div>
            )}
            {result && !v.hold && <div className="muted small" style={{ marginTop: 6 }}>Locked. The transcripts ship in the next delivery export.</div>}
          </div>
        </div>
      )}
      {isDemo() && <div className="muted small center" style={{ marginBottom: 18 }}>Demo · nothing is saved · clips are the founders' own recordings</div>}
    </div>
  );

  return embedded ? body : <div className="app">{topbar}{body}</div>;
}
