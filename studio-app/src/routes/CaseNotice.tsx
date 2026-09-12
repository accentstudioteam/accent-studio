import { useCallback, useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { daysLeft, myCases, respond, when, type CaseReason, type MyCase } from "@/lib/verify";

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

/** What a contributor sees under clause 15: the notice, the window to respond, and the decision. */
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
    <div className="shell">
      <div className="eyebrow" style={{ marginBottom: 6 }}>Clause 15 · honest participation</div>
      <h1 className="h1" style={{ marginBottom: 14, fontSize: "clamp(1.4rem,6vw,2rem)" }}>{items && items.length === 0 ? "Nothing to see here." : "A session of yours is being checked."}</h1>
      {err && <div className="tile" style={{ borderColor: "var(--coral)", marginBottom: 14 }}><div className="tbody" style={{ color: "var(--coral)" }}>{err}</div></div>}
      {!items && !err && <div className="muted">Loading…</div>}
      {items && items.length === 0 && <div className="tbody muted">No session of yours has been questioned. If one ever is, you will read about it here first and by email.</div>}
      <div className="stack">
        {items?.map((c) => <NoticeSheet key={c.id} c={c} onChanged={load} />)}
      </div>
    </div>
  );

  if (embedded) return body;
  return (
    <div className="app">
      <div className="topbar">
        <button className="brand" onClick={onBack} style={{ background: "none", border: "none" }}><span style={{ color: "var(--mut)", fontFamily: "var(--mono)", fontSize: "0.9rem" }}>‹ home</span></button>
        <Logo height={22} />
      </div>
      {body}
    </div>
  );
}

function NoticeSheet({ c, onChanged }: { c: MyCase; onChanged: () => Promise<void> }) {
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
    <div className="sheet">
      <div className="handle" />
      <div className="shead"><i className="g" />{c.status === "decided" ? "Decided" : c.status === "responded" ? "Your response is in" : "Notice"}</div>
      <div className="tile acc">
        <div className="tlbl">What was flagged · {when(c.notice_sent_at)}</div>
        <div className="tbody">A member of our team reviewed {c.sessions.length === 1 ? "a session" : `${c.sessions.length} sessions`} of yours and believes {REASON_TEXT[c.reason]}.</div>
        <div className="tbody muted small" style={{ marginTop: 6 }}>{c.sessions.map((s) => `${s.title} · ${when(s.date)}`).join(" / ")}</div>
        {c.detail && <div className="tbody small" style={{ marginTop: 8 }}><span className="muted">The reviewer wrote:</span> {c.detail}</div>}
      </div>
      <div className="tile dash">
        <div className="tlbl">What this means</div>
        <div className="tbody muted small">Only {c.sessions.length === 1 ? "this session pauses" : "these sessions pause"} until a decision. Every other verified session is paid on the normal schedule. Low quality is never dishonesty; this is about honesty only. A different team member from the one who raised the flag decides, after reading your response. <a href={AGREEMENT} target="_blank" rel="noopener noreferrer" style={{ color: "var(--acc)" }}>Clause 15</a> has the full process, and you can ask for the record of this case.</div>
      </div>

      {open && (
        <div className="tile">
          <div className="tlbl">Your response · {left} day{left === 1 ? "" : "s"} left, until {when(c.respond_by)}</div>
          <div className="field"><textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Say what happened, in your own words. You can also reply to the email we sent." /></div>
          <button className="pill mint" disabled={busy || text.trim().length < 5} onClick={() => void send()}>{busy ? "Sending…" : "Send my response"}</button>
          {err && <div className="tbody small" style={{ color: "var(--coral)", marginTop: 8 }}>{err}</div>}
        </div>
      )}
      {c.status === "notice_sent" && !open && <div className="tile"><div className="tbody muted small">The response window closed on {when(c.respond_by)}. A decision follows; you will see it here and by email.</div></div>}
      {c.response && (
        <div className="tile" style={{ borderColor: "var(--acc)" }}>
          <div className="tlbl">You wrote · {when(c.responded_at)}</div>
          <div className="tbody">{c.response}</div>
          {c.status === "responded" && <div className="tbody muted small" style={{ marginTop: 6 }}>Thank you. A different team member decides next and you will be told here and by email.</div>}
        </div>
      )}
      {c.status === "decided" && c.decision && (
        <div className="tile" style={{ borderColor: c.decision === "dismissed" ? "var(--acc)" : "var(--coral)" }}>
          <div className="tlbl">Decision · {when(c.decided_at)}</div>
          <div className="tbody">
            {c.decision === "dismissed" && "No dishonesty was found. Nothing changes: pay for these sessions goes ahead and the case is closed."}
            {c.decision === "confirmed" && "Dishonesty was confirmed for the sessions listed. Pending pay for those sessions only is forfeited. Your verified earnings from every other session are still paid, and your account stays open."}
            {c.decision === "confirmed_account_closed" && "Dishonesty was confirmed for the sessions listed and your account is closed. Pending pay for those sessions is forfeited; verified earnings from every other session are still paid."}
            {c.decision_reason && <div className="muted small" style={{ marginTop: 6 }}>The reason: {c.decision_reason}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
