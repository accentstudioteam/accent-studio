import { useCallback, useEffect, useState } from "react";
import { daysLeft, myCases, respond, when, type CaseReason, type MyCase } from "@/lib/verify";
import { Notice, Page, TopBar } from "@/components/ankara-ui";

const AGREEMENT = "https://accentstudio.io/legal/Accent_Studio_Contributor_Agreement_v1.2.pdf";

/** The reason in the contributor's own terms. */
const REASON_TEXT: Record<CaseReason, string> = {
  rating_mismatch: "the ratings you gave a partner's takes do not match what our editor heard in the audio",
  not_live: "the voice in your takes did not sound live; it may have been synthetic, replayed or pre-recorded",
  impersonation: "the voice in your takes did not sound like the person who signed up",
  duplicate_content: "the same or near-identical content appeared across sessions",
  filler: "the takes contained filler, repeated or nonsense content rather than the scene",
  pairing_interference: "something suggested the pairing system was worked around to reach a chosen partner",
  voice_taken_outside: "something suggested a partner's voice was taken outside the app",
  identity: "the identity, age, language or region on your account did not match what we found",
  other: "something in these sessions needs your explanation",
};

interface Props {
  onBack: () => void;
  embedded?: boolean;
}

/* ============================================================================
   Clause 15 in the approved "Ankara Blocks" direction. This screen only ever
   opens from the player's Home, so it follows the same skin. myCases and
   respond are called exactly as before, with the same response window.
   ========================================================================= */
export function CaseNotice({ onBack, embedded }: Props) {
  const [items, setItems] = useState<MyCase[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await myCases());
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "Couldn't load your notices.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const body = (
    <>
      {err && <Notice tone="coral">{err}</Notice>}
      {!items && !err && <div className="sys">Opening your notices</div>}
      {items && items.length === 0 && <p className="note-p">No session of yours has been questioned. If one ever is, you will read about it here first and by email.</p>}
      {items?.map((c) => <NoticeCase key={c.id} c={c} onChanged={load} />)}
    </>
  );

  if (embedded) return body;
  return (
    <Page dock={false}>
      <TopBar onBack={onBack} backLabel="Back home" eyebrow="Clause 15 · honest participation" title={items && items.length === 0 ? "Nothing to see here." : "A session of yours is being checked."} />
      {body}
    </Page>
  );
}

function NoticeCase({ c, onChanged }: { c: MyCase; onChanged: () => Promise<void> }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const left = daysLeft(c.respond_by);
  const open = c.status === "notice_sent" && left > 0;

  const send = async () => {
    setBusy(true);
    setErr(null);
    try {
      await respond(c.id, text);
      await onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "Couldn't send your response.");
    }
    setBusy(false);
  };

  return (
    <>
      <div className="sec-h"><h3>{c.status === "decided" ? "Decided" : c.status === "responded" ? "Your response is in" : "Notice"}</h3><span className="lab muted">{when(c.notice_sent_at)}</span></div>

      <div className="blk blk-gold pat-rings-6 bal">
        <div className="lab">What was flagged</div>
        <p style={{ fontSize: 14.5, fontWeight: 500, marginTop: 8, lineHeight: 1.45 }}>A member of our team reviewed {c.sessions.length === 1 ? "a session" : `${c.sessions.length} sessions`} of yours and believes {REASON_TEXT[c.reason]}.</p>
        <p className="mono" style={{ marginTop: 8 }}>{c.sessions.map((s) => `${s.title} · ${when(s.date)}`).join(" / ")}</p>
        {c.detail && <p style={{ fontSize: 13.5, fontWeight: 500, marginTop: 8 }}>The reviewer wrote: {c.detail}</p>}
      </div>

      <div className="card pad" style={{ marginTop: 14 }}>
        <div className="eyebrow">What this means</div>
        <p>Only {c.sessions.length === 1 ? "this session pauses" : "these sessions pause"} until a decision. Every other verified session is paid on the normal schedule. Low quality is never dishonesty; this is about honesty only. A different team member from the one who raised the flag decides, after reading your response. <a href={AGREEMENT} target="_blank" rel="noopener noreferrer">Clause 15</a> has the full process, and you can ask for the record of this case.</p>
      </div>

      {open && (
        <div className="card pad" style={{ marginTop: 14 }}>
          <div className="eyebrow">Your response · {left} day{left === 1 ? "" : "s"} left, until {when(c.respond_by)}</div>
          <div className="field" style={{ marginTop: 10 }}>
            <label htmlFor={`resp-${c.id}`}>In your own words</label>
            <textarea id={`resp-${c.id}`} rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Say what happened. You can also reply to the email we sent." />
          </div>
          <button className="btn btn-mint btn-block" type="button" style={{ marginTop: 12 }} disabled={busy || text.trim().length < 5} onClick={() => void send()}>{busy ? "Sending…" : "Send my response"}</button>
          {err && <Notice tone="coral">{err}</Notice>}
        </div>
      )}
      {c.status === "notice_sent" && !open && <p className="note-p">The response window closed on {when(c.respond_by)}. A decision follows; you will see it here and by email.</p>}

      {c.response && (
        <div className="card pad" style={{ marginTop: 14 }}>
          <div className="eyebrow">You wrote · {when(c.responded_at)}</div>
          <p>{c.response}</p>
          {c.status === "responded" && <p className="note-p">Thank you. A different team member decides next and you will be told here and by email.</p>}
        </div>
      )}

      {c.status === "decided" && c.decision && (
        <div className={`blk ${c.decision === "dismissed" ? "blk-mint pat-zig-6" : "blk-coral pat-zig-6"} bal`}>
          <div className="lab">Decision · {when(c.decided_at)}</div>
          <p style={{ fontSize: 14.5, fontWeight: 500, marginTop: 8, lineHeight: 1.45 }}>
            {c.decision === "dismissed" && "No dishonesty was found. Nothing changes: pay for these sessions goes ahead and the case is closed."}
            {c.decision === "confirmed" && "Dishonesty was confirmed for the sessions listed. Pending pay for those sessions only is forfeited. Your verified earnings from every other session are still paid, and your account stays open."}
            {c.decision === "confirmed_account_closed" && "Dishonesty was confirmed for the sessions listed and your account is closed. Pending pay for those sessions is forfeited; verified earnings from every other session are still paid."}
          </p>
          {c.decision_reason && <p className="mono" style={{ marginTop: 8 }}>The reason: {c.decision_reason}</p>}
        </div>
      )}
    </>
  );
}
