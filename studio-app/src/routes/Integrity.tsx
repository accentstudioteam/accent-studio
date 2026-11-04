import { useCallback, useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { Num, useRowMotion } from "@/components/sx-motion";
import { REASON_LABEL, STATUS_LABEL, cases, daysLeft, decide, notify, review, when, type Case, type CaseStatus, type Cases, type Decision } from "@/lib/verify";
import { isDemo } from "@/lib/demo";

interface Props {
  onBack: () => void;
  embedded?: boolean;
}

const DECISION_LABEL: Record<Decision, string> = { dismissed: "Dismissed · no dishonesty", confirmed: "Confirmed · these sessions forfeited", confirmed_account_closed: "Confirmed · account closed" };
const EVENT_LABEL: Record<string, string> = { flagged: "Flag raised", reviewed: "Reviewed by a person", dismissed_at_review: "Dismissed at review", notice_sent: "Notice sent, response window open", responded: "Contributor responded", decided: "Decision", decision_mailed: "Decision emailed" };
const STAGES: CaseStatus[] = ["flagged", "under_review", "notice_sent", "responded", "decided"];

/** A case's state as a spine. Open cases are gold, whatever stage they are at:
 *  the stage is written in the chip. A decision is mint if it cleared the
 *  contributor and coral if it did not. */
function spineOf(c: Case): string {
  if (c.status !== "decided") return " sx-spine-gold";
  return c.decision === "dismissed" ? " sx-spine-mint" : " sx-spine-coral";
}
function chipOf(c: Case): string {
  if (c.status !== "decided") return " gold";
  return c.decision === "dismissed" ? " on" : " coral";
}

/** Clause 15 cases: flag → review by a person → notice → 7-day response → decision by someone else → log. */
export function Integrity({ onBack, embedded }: Props) {
  const [data, setData] = useState<Cases | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  const load = useCallback(async () => {
    setReading(true);
    try {
      const next = await cases();
      setData(next);
      setErr(null);
      setOpen((o) => o ?? next.cases[0]?.id ?? null);
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "Couldn't load the cases.");
    }
    setReading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // a case arriving enters; a case that moved a stage, got a response or was
  // decided washes once — coral when the decision went against the contributor
  const rowCls = useRowMotion(data?.cases, (c) => c.id, (c) => `${c.status}|${c.decision ?? ""}|${c.events.length}|${c.response ? 1 : 0}`);
  const count = (s: CaseStatus) => data?.cases.filter((c) => c.status === s).length ?? 0;
  const openCases = data ? data.cases.filter((c) => c.status !== "decided").length : 0;

  const body = (
    <div className="shell wide">
      <div className="sx-head">
        <div>
          <div className="eyebrow">Integrity · clause 15{data ? ` · you are ${data.my_editor}` : ""}</div>
          <h1 className="h1">Cases{data ? <> · <Num value={data.cases.length} /></> : ""}</h1>
        </div>
      </div>

      <div className={`sx-bar${reading ? " sx-working" : ""}`}>
        <span className="sx-bar-lab">By stage</span>
        {data && STAGES.map((s) => (
          <span key={s} className={`chip num${s !== "decided" && count(s) > 0 ? " gold" : ""}`}>{STATUS_LABEL[s].split(" · ")[0].toLowerCase()} {count(s)}</span>
        ))}
        <div className="sx-bar-end">
          {data && openCases > 0 && <span className="sx-meta">{openCases} open</span>}
          <button type="button" className="pill ghost" onClick={() => void load()}>Refresh</button>
        </div>
      </div>

      <p className="sx-note">
        A flag changes nothing on its own. A person reviews it. If it stands, the contributor is told what was flagged and why, in the app and by email,
        and has {data?.response_window_days ?? 7} days to respond. Someone other than the person who raised the flag decides. Confirmed dishonesty forfeits pay
        for the affected sessions only. Every step is logged and the contributor can ask for the record.
      </p>

      {err && (
        <div className="sx-block sx-block-coral sx-pop" style={{ marginBottom: 12 }}>
          <div className="tlbl">The cases didn&rsquo;t load</div>
          <div className="tbody">{err}</div>
        </div>
      )}
      {!data && !err && <div className="full-center"><div className="spin" /></div>}
      {data && data.cases.length === 0 && (
        <div className="empty sx-pop">
          <b>No cases.</b>
          <span>Flags are raised from the workbench. One lands here the moment a linguist raises it.</span>
        </div>
      )}
      {data && data.cases.length > 0 && (
        <div className="sx-list sx-enter">
          {data.cases.map((c) => <CaseRows key={c.id} c={c} cls={rowCls(c)} open={open === c.id} onToggle={() => setOpen(open === c.id ? null : c.id)} onChanged={load} />)}
        </div>
      )}
    </div>
  );

  if (embedded) return body;
  return (
    <div className="app ankara studio-ank">
      <div className="topbar">
        <button type="button" className="sx-link" onClick={onBack}>‹ back</button>
        <Logo height={22} tone="mono" />
      </div>
      {body}
    </div>
  );
}

/** One case: a row you press, and when it is open, the stage it is at and the
 *  controls for that stage as a second row under it. Both carry the case's spine. */
function CaseRows({ c, cls, open, onToggle, onChanged }: { c: Case; cls: string; open: boolean; onToggle: () => void; onChanged: () => Promise<void> }) {
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
  const spine = spineOf(c);
  const flashCls = cls === " sx-flash" ? (c.status === "decided" && c.decision !== "dismissed" ? " sx-flash sx-flash-coral" : c.status === "decided" ? cls : " sx-flash sx-flash-gold") : cls;
  const stageWord = c.status === "decided" && c.decision ? DECISION_LABEL[c.decision].split(" · ")[0] : STATUS_LABEL[c.status].split(" · ")[0];

  return (
    <>
      <button type="button" className={`sx-row${spine}${flashCls}`} aria-expanded={open} onClick={onToggle}>
        <div className="sx-row-top">
          <div className="sx-row-main">
            <div className="sx-row-t">{REASON_LABEL[c.reason]}</div>
            <div className="sx-row-s">{c.speaker_id ?? "?"} · {c.sessions.map((s) => s.title).join(", ")}</div>
            <div className="sx-row-m">raised {when(c.created_at)} by {c.raised_by ?? "?"}{windowOpen ? ` · ${daysLeft(c.respond_by)} day${daysLeft(c.respond_by) === 1 ? "" : "s"} left to respond` : ""}</div>
          </div>
          <div className="sx-row-end">
            <span className={`chip${chipOf(c)}`}>{windowOpen && <i className="sx-live" aria-hidden="true" />}{stageWord}</span>
          </div>
        </div>
      </button>

      {open && (
        <div className={`sx-row sx-view${spine}${busy ? " sx-working" : ""}`}>
          <div className="stack">
            {flash && (
              <div className="sx-block sx-block-mint sx-pop" role="status">
                <div className="tlbl">Done</div>
                <div className="tbody">{flash}</div>
              </div>
            )}
            {err && <div className="sx-block sx-block-coral sx-pop"><div className="tlbl">That didn&rsquo;t work</div><div className="tbody">{err}</div></div>}

            <div className="tile">
              <div className="tlbl">What was flagged</div>
              <div className="sx-read">{c.detail ?? <span className="muted">No detail written.</span>}</div>
              <div className="sx-meta" style={{ marginTop: 6 }}>{c.sessions.map((s) => `${s.title} · ${when(s.date)} · ${s.verification_status ?? "not verified"}`).join(" / ")}</div>
            </div>

            {c.status === "flagged" && (
              <div className="tile dash">
                <div className="tlbl">1 · Review by a person</div>
                <div className="tbody muted small" style={{ marginBottom: 8 }}>Listen again. If there is nothing here, dismiss it and the hold lifts. If it stands, proceed: the next step tells the contributor.</div>
                <div className="field"><label>Your note (the contributor does not see this)</label><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
                <div className="btn-row">
                  <button type="button" className="pill gold" disabled={busy !== null} onClick={() => void run("proceed", () => review(c.id, note, true), "Reviewed. Send the notice when ready.")}>{busy === "proceed" ? "Saving…" : "Proceed to notice"}</button>
                  <button type="button" className="pill ghost" disabled={busy !== null} onClick={() => void run("dismiss", () => review(c.id, note, false), "Dismissed. Nothing is withheld.")}>{busy === "dismiss" ? "Saving…" : "Dismiss"}</button>
                </div>
              </div>
            )}

            {c.status === "under_review" && (
              <div className="tile dash">
                <div className="tlbl">2 · Notice</div>
                <div className="tbody muted small" style={{ marginBottom: 8 }}>Emails the contributor what was flagged and why, shows it on their home screen, and opens the response window. Only these sessions pause; everything else is paid as normal.</div>
                <button type="button" className="pill gold" disabled={busy !== null} onClick={() => void run("notice", () => notify(c.id, "notice"), "Notice sent. The response window is open.")}>{busy === "notice" ? "Sending…" : "Send the notice"}</button>
              </div>
            )}

            {c.status === "notice_sent" && windowOpen && (
              <div className="tile dash">
                <div className="tlbl"><i className="sx-live" aria-hidden="true" style={{ marginRight: 6 }} />3 · Waiting for the response</div>
                <div className="tbody small">Notice sent {when(c.notice_sent_at)}{c.notice_mailed === false ? " (the email did not send; the in-app notice stands)" : ""}. The contributor has {daysLeft(c.respond_by)} day{daysLeft(c.respond_by) === 1 ? "" : "s"} left, until {when(c.respond_by)}.</div>
              </div>
            )}

            {c.response && (
              <div className="tile sx-spine-mint">
                <div className="tlbl">The contributor&rsquo;s response · {when(c.responded_at)}</div>
                <div className="sx-read">{c.response}</div>
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
                    <button type="button" className="pill mint" disabled={busy !== null || reason.trim().length < 5} onClick={() => void run("dismiss", () => decide(c.id, "dismissed", reason), "Decided: dismissed. Pay goes ahead.")}>{busy === "dismiss" ? "Saving…" : "Dismiss"}</button>
                    <button type="button" className="pill gold" disabled={busy !== null || reason.trim().length < 5} onClick={() => void run("confirm", () => decide(c.id, "confirmed", reason), "Decided: confirmed. These sessions are forfeited.")}>{busy === "confirm" ? "Saving…" : "Confirm"}</button>
                    <button type="button" className="pill coral" disabled={busy !== null || reason.trim().length < 5} onClick={() => void run("close", () => decide(c.id, "confirmed_account_closed", reason), "Decided: confirmed and the account is closed.")}>{busy === "close" ? "Saving…" : "Confirm and close the account"}</button>
                  </div>
                )}
              </div>
            )}

            {c.status === "decided" && c.decision && (
              <div className={`tile${c.decision === "dismissed" ? " sx-spine-mint" : " sx-spine-coral"}`}>
                <div className="tlbl">Decision · {c.decided_by ?? "?"} · {when(c.decided_at)}</div>
                <div className="tbody">{DECISION_LABEL[c.decision]}{c.decision_reason ? `. ${c.decision_reason}` : ""}</div>
                {!mailedDecision && <button type="button" className="pill ghost" style={{ marginTop: 8 }} disabled={busy !== null} onClick={() => void run("mail", () => notify(c.id, "decision"), "Decision emailed.")}>{busy === "mail" ? "Sending…" : "Email the decision"}</button>}
                {mailedDecision && <div className="sx-meta" style={{ marginTop: 4 }}>Decision emailed.</div>}
              </div>
            )}

            <div className="tile">
              <div className="tlbl">The record</div>
              <ul className="timeline">
                {c.events.map((e, i) => <li key={i}><span className="sx-meta" style={{ flex: "none" }}>{when(e.at)}</span><span>{EVENT_LABEL[e.kind] ?? e.kind}{e.actor ? ` · ${e.actor}` : ""}{e.detail && typeof e.detail.decision === "string" ? ` · ${String(e.detail.decision).replace(/_/g, " ")}` : ""}</span></li>)}
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
