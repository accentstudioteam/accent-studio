import { useCallback, useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { REASON_LABEL, STATUS_LABEL, cases, daysLeft, decide, notify, review, when, type Case, type Cases, type Decision } from "@/lib/verify";
import { isDemo } from "@/lib/demo";

interface Props {
  onBack: () => void;
  embedded?: boolean;
}

const DECISION_LABEL: Record<Decision, string> = { dismissed: "Dismissed · no dishonesty", confirmed: "Confirmed · these sessions forfeited", confirmed_account_closed: "Confirmed · account closed" };
const EVENT_LABEL: Record<string, string> = { flagged: "Flag raised", reviewed: "Reviewed by a person", dismissed_at_review: "Dismissed at review", notice_sent: "Notice sent, response window open", responded: "Contributor responded", decided: "Decision", decision_mailed: "Decision emailed" };

/** Clause 15 cases: flag → review by a person → notice → 7-day response → decision by someone else → log. */
export function Integrity({ onBack, embedded }: Props) {
  const [data, setData] = useState<Cases | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await cases();
      setData(next);
      setErr(null);
      setOpen((o) => o ?? next.cases[0]?.id ?? null);
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "Couldn't load the cases.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const body = (
    <div className="shell" style={{ maxWidth: 720 }}>
      <div className="spread" style={{ marginBottom: 16, alignItems: "flex-start" }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Integrity · clause 15{data ? ` · you are ${data.my_editor}` : ""}</div>
          <h1 className="h1">Cases{data ? ` · ${data.cases.length}` : ""}</h1>
        </div>
        <button className="pill ghost" style={{ flex: "none", width: "auto" }} onClick={() => void load()}>Refresh</button>
      </div>
      <div className="tile" style={{ marginBottom: 14 }}>
        <div className="tbody muted" style={{ fontSize: "0.85rem" }}>
          A flag changes nothing on its own. A person reviews it. If it stands, the contributor is told what was flagged and why, in the app and by email, and has {data?.response_window_days ?? 7} days to respond. Someone other than the person who raised the flag decides. Confirmed dishonesty forfeits pay for the affected sessions only. Every step is logged and the contributor can ask for the record.
        </div>
      </div>
      {err && <div className="tile" style={{ borderColor: "var(--coral)", marginBottom: 14 }}><div className="tbody" style={{ color: "var(--coral)" }}>{err}</div></div>}
      {data && data.cases.length === 0 && <div className="muted">No cases. Flags are raised from the workbench.</div>}
      <div className="stack">
        {data?.cases.map((c) => <CaseSheet key={c.id} c={c} open={open === c.id} onToggle={() => setOpen(open === c.id ? null : c.id)} onChanged={load} />)}
      </div>
    </div>
  );

  if (embedded) return body;
  return (
    <div className="app">
      <div className="topbar">
        <button className="brand" onClick={onBack} style={{ background: "none", border: "none" }}><span style={{ color: "var(--mut)", fontFamily: "var(--mono)", fontSize: "0.9rem" }}>‹ back</span></button>
        <Logo height={22} />
      </div>
      {body}
    </div>
  );
}

function CaseSheet({ c, open, onToggle, onChanged }: { c: Case; open: boolean; onToggle: () => void; onChanged: () => Promise<void> }) {
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(key);
    setErr(null);
    try {
      await fn();
      setFlash(done);
      await onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "Something went wrong.");
    }
    setBusy(null);
  };

  const windowOpen = c.status === "notice_sent" && c.respond_by && new Date(c.respond_by).getTime() > Date.now();
  const canDecide = c.status === "responded" || (c.status === "notice_sent" && !windowOpen);
  const mailedDecision = c.events.some((e) => e.kind === "decision_mailed");
  const color = c.status === "decided" ? (c.decision === "dismissed" ? "var(--acc)" : "var(--coral)") : "var(--gold)";

  return (
    <div className="sheet">
      <div className="handle" />
      <button type="button" onClick={onToggle} style={{ width: "100%", textAlign: "left", cursor: "pointer" }}>
        <div className="spread" style={{ alignItems: "flex-start", gap: 12 }}>
          <div>
            <div className="ttitle">{REASON_LABEL[c.reason]}</div>
            <div className="tbody muted" style={{ marginTop: 4, fontSize: "0.85rem", fontFamily: "var(--mono)" }}>{c.speaker_id ?? "?"} · {c.sessions.map((s) => s.title).join(", ")} · raised {when(c.created_at)} by {c.raised_by ?? "?"}</div>
          </div>
          <span className="chip" style={{ flex: "none", borderColor: color, color }}>{c.status === "decided" && c.decision ? DECISION_LABEL[c.decision].split(" · ")[0] : STATUS_LABEL[c.status].split(" · ")[0]}</span>
        </div>
      </button>

      {open && (
        <>
          <div className="tile">
            <div className="tlbl">What was flagged</div>
            <div className="tbody">{c.detail ?? <span className="muted">No detail written.</span>}</div>
            <div className="tbody muted small" style={{ marginTop: 6 }}>{c.sessions.map((s) => `${s.title} · ${when(s.date)} · ${s.verification_status ?? "not verified"}`).join(" / ")}</div>
          </div>

          {c.status === "flagged" && (
            <div className="tile dash">
              <div className="tlbl">1 · Review by a person</div>
              <div className="tbody muted small" style={{ marginBottom: 8 }}>Listen again. If there is nothing here, dismiss it and the hold lifts. If it stands, proceed: the next step tells the contributor.</div>
              <div className="field"><label>Your note (the contributor does not see this)</label><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
              <div className="btn-row">
                <button className="pill mint" disabled={busy !== null} onClick={() => void run("proceed", () => review(c.id, note, true), "Reviewed. Send the notice when ready.")}>Proceed to notice</button>
                <button className="pill ghost" disabled={busy !== null} onClick={() => void run("dismiss", () => review(c.id, note, false), "Dismissed. Nothing is withheld.")}>Dismiss</button>
              </div>
            </div>
          )}

          {c.status === "under_review" && (
            <div className="tile dash">
              <div className="tlbl">2 · Notice</div>
              <div className="tbody muted small" style={{ marginBottom: 8 }}>Emails the contributor what was flagged and why, shows it on their home screen, and opens the response window. Only these sessions pause; everything else is paid as normal.</div>
              <button className="pill mint" disabled={busy !== null} onClick={() => void run("notice", () => notify(c.id, "notice"), "Notice sent. The response window is open.")}>{busy === "notice" ? "Sending…" : "Send the notice"}</button>
            </div>
          )}

          {c.status === "notice_sent" && windowOpen && (
            <div className="tile dash">
              <div className="tlbl">3 · Waiting for the response</div>
              <div className="tbody small">Notice sent {when(c.notice_sent_at)}{c.notice_mailed === false ? " (the email did not send; the in-app notice stands)" : ""}. The contributor has {daysLeft(c.respond_by)} day{daysLeft(c.respond_by) === 1 ? "" : "s"} left, until {when(c.respond_by)}.</div>
            </div>
          )}

          {c.response && (
            <div className="tile" style={{ borderColor: "var(--acc)" }}>
              <div className="tlbl">The contributor's response · {when(c.responded_at)}</div>
              <div className="tbody">{c.response}</div>
            </div>
          )}

          {canDecide && (
            <div className="tile dash">
              <div className="tlbl">4 · Decision{c.raised_by_me ? " · by someone else" : ""}</div>
              <div className="tbody muted small" style={{ marginBottom: 8 }}>
                {c.raised_by_me ? (isDemo() ? "You raised this flag, so a different team member must decide. In the demo, Ada (edt_00417) signs the decision." : "You raised this flag, so a different team member must decide it. Ask them to open this case.") : `Raised by ${c.raised_by ?? "?"}; you can decide. Confirmed dishonesty forfeits pending pay for these sessions only.`}
              </div>
              <div className="field"><label>The reason, in plain words (the contributor reads this)</label><textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
              {(!c.raised_by_me || isDemo()) && (
                <div className="btn-row">
                  <button className="pill mint" disabled={busy !== null || reason.trim().length < 5} onClick={() => void run("dismiss", () => decide(c.id, "dismissed", reason), "Decided: dismissed. Pay goes ahead.")}>Dismiss</button>
                  <button className="pill" disabled={busy !== null || reason.trim().length < 5} onClick={() => void run("confirm", () => decide(c.id, "confirmed", reason), "Decided: confirmed. These sessions are forfeited.")} style={{ background: "var(--gold)", color: "#0d0b08" }}>Confirm</button>
                  <button className="pill ghost" disabled={busy !== null || reason.trim().length < 5} onClick={() => void run("close", () => decide(c.id, "confirmed_account_closed", reason), "Decided: confirmed and the account is closed.")} style={{ borderColor: "var(--coral)", color: "var(--coral)" }}>Confirm and close the account</button>
                </div>
              )}
            </div>
          )}

          {c.status === "decided" && c.decision && (
            <div className="tile" style={{ borderColor: color }}>
              <div className="tlbl">Decision · {c.decided_by ?? "?"} · {when(c.decided_at)}</div>
              <div className="tbody">{DECISION_LABEL[c.decision]}{c.decision_reason ? `. ${c.decision_reason}` : ""}</div>
              {!mailedDecision && <button className="pill ghost" style={{ marginTop: 8 }} disabled={busy !== null} onClick={() => void run("mail", () => notify(c.id, "decision"), "Decision emailed.")}>{busy === "mail" ? "Sending…" : "Email the decision"}</button>}
            </div>
          )}

          <div className="tile">
            <div className="tlbl">The record</div>
            <ul className="timeline">
              {c.events.map((e, i) => <li key={i}><span className="muted" style={{ fontFamily: "var(--mono)", flex: "none" }}>{when(e.at)}</span><span>{EVENT_LABEL[e.kind] ?? e.kind}{e.actor ? ` · ${e.actor}` : ""}{e.detail && typeof e.detail.decision === "string" ? ` · ${String(e.detail.decision).replace(/_/g, " ")}` : ""}</span></li>)}
            </ul>
          </div>
          {flash && <div className="tbody small" style={{ color: "var(--acc)" }}>{flash}</div>}
          {err && <div className="tbody small" style={{ color: "var(--coral)" }}>{err}</div>}
        </>
      )}
    </div>
  );
}
