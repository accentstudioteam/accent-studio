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

/** One rally on the linguist's bench: the card, every take, the peer ratings, and the verify step.
 *
 *  This is the one screen in the Studio that stays still. The card and the claim
 *  state sit in a sticky left column; the takes scroll beside them, so a linguist
 *  comparing a machine draft to what they hear never loses the situation. There
 *  is no pulse, no stagger and no flash on this surface on purpose — the motion
 *  belongs to the queue and the board, not to the thing being read. */
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
      <button type="button" className="sx-link" onClick={onBack}>‹ queue</button>
      {w ? <span className="chip num">{w.verification.status.replace("_", " ")}</span> : <Logo height={22} tone="mono" />}
    </div>
  );

  if (!w) {
    const inner = (
      <div className="shell bench">
        {err
          ? <div className="sx-block sx-block-coral sx-pop"><div className="tlbl">The bench didn&rsquo;t load</div><div className="tbody">{err}</div></div>
          : <div className="full-center"><div className="spin" /></div>}
      </div>
    );
    return embedded ? inner : <div className="app ankara studio-ank">{topbar}{inner}</div>;
  }

  const v = w.verification;
  const mine = v.status === "in_progress" && Boolean(v.claimed_by_me);
  const heldByOther = v.status === "in_progress" && !v.claimed_by_me;
  const latest = w.turns.filter((t) => t.latest);
  const saved = latest.filter((t) => t.verification?.verified_text && t.verification.confidence != null).length;
  const cardAudio = cardAudioUrl(w.card.audio_path);
  const title = v.status === "verified" ? `Verified · ${TIER_LABEL[v.quality_tier ?? ""] ?? v.quality_tier}.` : v.status === "forfeited" ? "Forfeited under clause 15." : mine ? "Verify this rally." : heldByOther ? "Held by another editor." : "Claim it to start.";
  const needDrafts = mine && !drafting && w.stt.engine !== "none" && latest.some((t) => !t.draft || t.draft.status === "failed" || t.draft.status === "skipped");

  const body = (
    <div className="shell bench">
      <div className="sx-head">
        <div>
          <div className="eyebrow">{w.card.title} · {LANG_NAME[w.language] ?? w.language} · {w.mode === "live" ? "live scene" : w.session_status === "abandoned" ? "closed, partner went quiet" : "complete"} · {when(w.completed_at)}</div>
          <h1 className="h1">{title}</h1>
        </div>
      </div>

      <div className={`sx-bar${drafting ? " sx-working" : ""}`}>
        {embedded && <button type="button" className="pill ghost" onClick={onBack}>‹ queue</button>}
        <span className="chip num">{saved} of {latest.length} saved</span>
        {w.peer_score != null && <span className="chip num">peer {Number(w.peer_score).toFixed(2)}</span>}
        {mine && w.stt.show && w.stt.engine !== "none" && (
          <span className="chip num">drafts {latest.filter((t) => t.draft?.status === "done").length}/{latest.length}{drafting ? "…" : ""}</span>
        )}
        <div className="sx-bar-end">
          {needDrafts && (
            <button type="button" className="pill ghost" onClick={() => void runDrafts(true)}>{latest.some((t) => t.draft) ? "Retry the machine drafts" : "Ask for machine drafts"}</button>
          )}
          {v.status === "pending" && <button type="button" className="pill mint" disabled={busy} onClick={() => void doClaim()}>{busy ? "Claiming…" : "Claim this rally"}</button>}
        </div>
      </div>

      {v.status === "verified" && v.audit_outcome && (
        <p className={`sx-note${v.audit_outcome === "adjusted" ? " sx-note-gold" : ""}`}>
          Audited {when(v.audited_at ?? "")} by {v.audit_editor_id ?? "?"}: {v.audit_outcome === "upheld" ? "the verification was upheld." : "the score was adjusted and unpaid lines re-priced."}
        </p>
      )}
      {v.status === "verified" && !v.audit_outcome && v.audit_pick && (
        <p className="sx-note">Drawn for the random audit: a second editor will listen before delivery.</p>
      )}
      {flash && <div className="sx-block sx-block-gold sx-pop" style={{ marginBottom: 12 }}><div className="tbody">{flash}</div></div>}
      {err && <div className="sx-block sx-block-coral sx-pop" style={{ marginBottom: 12 }}><div className="tlbl">That didn&rsquo;t work</div><div className="tbody">{err}</div></div>}
      {draftErr && <p className="sx-note sx-note-gold">Drafts: {draftErr}</p>}

      <div className="sx-split">
        {/* what you are checking against: the card, who was in it, the state of
            the hold. Sticky on a wide screen so it stays put while you type. */}
        <div className="sx-aside">
          <div className="sheet">
            <div className="shead"><i className="g" />The card</div>
            <div className="tile sx-spine-gold">
              <div className="tlbl">The situation {cardAudio && <>· <a href={cardAudio} target="_blank" rel="noopener noreferrer">▶ listen</a></>}</div>
              <div className="sx-read">{w.card.situation}</div>
              {w.card.english_note && <div className="sx-read-sub">{w.card.english_note}</div>}
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
              <div className="tile sx-spine-gold">
                <div className="tlbl">Integrity cases on this rally</div>
                {w.cases.map((c) => <div key={c.id} className="tbody small">Speaker {c.who.toUpperCase()} · {REASON_LABEL[c.reason]} · {c.decision ? `decided: ${c.decision.replace(/_/g, " ")}` : STATUS_LABEL[c.status]}</div>)}
                {onCases && <button type="button" className="pill ghost" style={{ marginTop: 6 }} onClick={onCases}>Open the cases</button>}
              </div>
            )}
            {heldByOther && <p className="sx-note">Another editor is working on it. It frees itself when their hold expires.</p>}
            {mine && <div className="sx-meta">Held by you since {when(v.claimed_at)}.</div>}
          </div>
        </div>

        {/* what you are writing */}
        <div>
          <div className="sheet" style={{ marginBottom: 12 }}>
            <div className="shead"><i />{w.mode === "live" ? "The two tracks" : "The takes"} · {latest.length}</div>
            {w.mode === "live" && <p className="sx-note" style={{ marginBottom: 2 }}>A live scene: each speaker&rsquo;s whole five minutes is one track, recorded on their own phone. Transcribe the track as spoken; the partner&rsquo;s words are not in it.</p>}
            {w.turns.map((t) => <WorkTurnCard key={`${t.turn_id}-${t.verification?.updated_at ?? ""}`} t={t} w={w} src={urls[t.turn_id] ?? null} canEdit={mine && t.latest} onSaved={() => void load()} onFlag={doFlag} />)}
          </div>

          {mine && (
            <div className="sheet" style={{ marginBottom: 12 }}>
              <div className="shead"><i className="g" />Verify</div>
              <div className="tile">
                <div className="tlbl">Editor score · how well does this rally serve as data?</div>
                <div className="tbody muted small" style={{ marginBottom: 6 }}>Natural speech, on the card, clean enough to use. The tier is the partner&rsquo;s ratings blended half and half with this score, against the published thresholds.</div>
                <div className="stars" role="radiogroup" aria-label="Editor score">
                  {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={score === n} aria-label={`${n} of 5`} className={score >= n ? "on" : ""} onClick={() => setScore(n)}>★</button>)}
                </div>
              </div>
              <div className="field">
                <label>Notes for the audit (optional)</label>
                <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the auditor or the next linguist should know." />
              </div>
              <p className="sx-note" style={{ margin: 0 }}>
                Thresholds: {w.tiers.filter((t) => t.min > 0).map((t) => `${TIER_LABEL[t.tier] ?? t.tier} from ${t.min} (x${t.x})`).join(" · ")} · below that the floor (x0.5). Verifying locks the transcripts and sets the tier; pay for the rally follows unless a case holds it.
              </p>
              <button type="button" className="pill mint" disabled={busy || saved < latest.length} onClick={() => void doVerify()}>{busy ? "Verifying…" : saved < latest.length ? `Save all ${latest.length} takes first` : "Verify this rally"}</button>
            </div>
          )}

          {(v.status === "verified" || v.status === "forfeited") && (
            <div className={`sheet sx-pop${v.status === "verified" ? " sx-spine-mint" : " sx-spine-coral"}`} style={{ marginBottom: 12 }}>
              <div className="shead"><i />{v.status === "verified" ? `Verified by ${v.editor_id ?? "you"} · ${when(v.verified_at)}` : "Forfeited"}</div>
              <div className="tbody">
                {v.status === "verified" ? (
                  <>Peer {v.peer_score != null ? Number(v.peer_score).toFixed(2) : "none"} + editor {v.editor_score} → <b>{Number(v.quality_score).toFixed(2)}</b> · <b>{TIER_LABEL[v.quality_tier ?? ""] ?? v.quality_tier}</b> x{v.multiplier} · {Number(v.verified_seconds).toFixed(1)} verified seconds{v.audit_pick ? " · picked for random audit" : ""}{v.hold ? ". Pay is on hold until the open case is decided." : "."}{(() => { const ws = latest.map((t) => t.verification?.draft_wer).filter((x): x is number => x != null); return ws.length ? ` Machine drafts were ${Math.round((ws.reduce((a, b) => a + Number(b), 0) / ws.length) * 100)}% off on average.` : ""; })()}</>
                ) : (
                  "Confirmed dishonesty under clause 15. Pending pay for this rally is forfeited; every other verified rally is still paid."
                )}
              </div>
              {v.notes && <div className="tbody muted small">Notes: {v.notes}</div>}
              {(result?.earnings ?? w.earnings ?? []).length > 0 && (
                <div className="tile">
                  <div className="tlbl">Posted to the ledger · per speaker per verified hour</div>
                  {(result?.earnings ?? w.earnings ?? []).map((e) => (
                    <div key={e.speaker} className="sx-meta">Speaker {e.speaker.toUpperCase()} · {e.speaker_id} · {Math.round(Number(e.seconds))} s · {e.tier} x{e.multiplier} at ${Number(e.base_rate_usd)}/h → <b>${Number(e.amount_usd).toFixed(2)}</b> · {e.status === "held" ? "on hold, clause 15" : e.status}</div>
                  ))}
                </div>
              )}
              {result && !v.hold && <div className="tbody muted small">Locked. The transcripts ship in the next delivery export.</div>}
            </div>
          )}
        </div>
      </div>

      {isDemo() && <div className="sx-meta center" style={{ marginTop: 6 }}>Demo · nothing is saved · clips are the founders&rsquo; own recordings</div>}
    </div>
  );

  return embedded ? body : <div className="app ankara studio-ank">{topbar}{body}</div>;
}
