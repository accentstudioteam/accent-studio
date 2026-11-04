import { useCallback, useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { Num, useRowMotion } from "@/components/sx-motion";
import { LANG_NAME } from "@/lib/game";
import { auditQueue, auditRecord, hours, type AuditDone, type AuditItem, type AuditQueue } from "@/lib/admin";
import { TIER_WORD } from "@/lib/earn";
import { when } from "@/lib/verify";

interface Props {
  onBack: () => void;
  onOpen?: (sessionId: string) => void;
  embedded?: boolean;
}

const tier = (t: string | null | undefined) => (t ? TIER_WORD[t] ?? t : "?");

/** The audit queue: a share of verified rallies gets a second editor's ear. Upheld or adjusted; adjusted re-prices unpaid lines. */
export function Audit({ onBack, onOpen, embedded }: Props) {
  const [q, setQ] = useState<AuditQueue | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  const load = useCallback(async () => {
    setReading(true);
    try {
      setQ(await auditQueue());
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "Couldn't load the audit queue.");
    }
    setReading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // a rally drawn for audit enters; one that gained a hold or a paid line flashes
  const rowCls = useRowMotion(q?.pending, (a) => a.session_id, (a) => `${a.hold ? 1 : 0}|${a.paid ? 1 : 0}|${a.mine ? 1 : 0}`);
  const doneCls = useRowMotion(q?.done, (d) => d.session_id, (d) => `${d.outcome}|${d.quality_tier ?? ""}`);

  const body = (
    <div className="shell wide">
      <div className="sx-head">
        <div>
          <div className="eyebrow">Cutting Room{q ? ` · you are ${q.my_editor}` : ""}</div>
          <h1 className="h1">Audit queue{q ? <> · <Num value={q.pending.length} /></> : ""}</h1>
        </div>
      </div>

      <div className={`sx-bar${reading ? " sx-working" : ""}`}>
        <span className="sx-bar-lab">Random sample</span>
        {q && <span className="chip num">{q.sample_pct}% drawn</span>}
        {q && <span className="chip num">{q.audited_total} of {q.verified_total} audited</span>}
        <div className="sx-bar-end">
          <button type="button" className="pill ghost" onClick={() => void load()}>Refresh</button>
        </div>
      </div>

      <p className="sx-note">
        {q ? `${q.sample_pct}% of verified rallies are drawn at random for a second ear. ` : ""}Listen to the takes against the transcripts and the editor&rsquo;s score.
        Uphold it, or adjust the score if the tier is wrong: unpaid lines are re-priced with the new score, lines already requested or paid are left as they were,
        and the delivery names the outcome. You cannot audit a rally you verified.
      </p>

      {flash && (
        <div className="sx-block sx-block-mint sx-pop" style={{ marginBottom: 12 }} role="status">
          <div className="tlbl">Recorded</div>
          <div className="tbody">{flash}</div>
        </div>
      )}
      {err && (
        <div className="sx-block sx-block-coral sx-pop" style={{ marginBottom: 12 }}>
          <div className="tlbl">The audit queue didn&rsquo;t load</div>
          <div className="tbody">{err}</div>
        </div>
      )}
      {!q && !err && <div className="full-center"><div className="spin" /></div>}
      {q && q.pending.length === 0 && (
        <div className="empty sx-pop" style={{ marginBottom: 12 }}>
          <b>Nothing drawn for audit.</b>
          <span>{q.sample_pct}% of verifications are sampled at random; the next one appears here the moment it is verified by someone else.</span>
        </div>
      )}
      {q && q.pending.length > 0 && (
        <div className="stack sx-enter">
          {q.pending.map((a) => <AuditCard key={a.session_id} a={a} cls={rowCls(a)} onOpen={onOpen} onChanged={load} onDone={setFlash} />)}
        </div>
      )}

      {q && q.done.length > 0 && (
        <>
          <div className="tlbl" style={{ margin: "18px 2px 6px" }}>Audited · {q.done.length}</div>
          <div className="sx-list sx-enter">
            {q.done.map((d) => <DoneRow key={d.session_id} d={d} cls={doneCls(d)} />)}
          </div>
        </>
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

/** One rally waiting for a second ear. Coral spine if integrity has it on hold,
 *  gold if you verified it yourself and so cannot audit it. */
function AuditCard({ a, cls, onOpen, onChanged, onDone }: { a: AuditItem; cls: string; onOpen?: (sid: string) => void; onChanged: () => Promise<void>; onDone: (msg: string) => void }) {
  const [outcome, setOutcome] = useState<"upheld" | "adjusted">("upheld");
  const [score, setScore] = useState(String(a.editor_score));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const n = Number(score);
  const scoreOk = outcome === "upheld" || (Number.isFinite(n) && n >= 1 && n <= 5);

  const record = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await auditRecord(a.session_id, outcome, outcome === "adjusted" ? n : null, note);
      setDone(true);
      onDone(`${a.title}: ` + (r.outcome === "upheld" ? `Upheld at ${tier(r.quality_tier)}.` : `Adjusted to ${tier(r.quality_tier)}: ${r.lines_repriced} line${r.lines_repriced === 1 ? "" : "s"} re-priced${r.lines_untouched ? `, ${r.lines_untouched} already requested or paid left as they were` : ""}.`));
      await onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "Couldn't record the audit.");
    }
    setBusy(false);
  };

  const spine = a.hold ? " sx-spine-coral" : a.mine ? " sx-spine-gold" : "";
  const flash = cls === " sx-flash" && a.hold ? " sx-flash sx-flash-coral" : cls;

  return (
    <div className={`sheet${spine}${flash}${busy ? " sx-working" : ""}${done ? " sx-leave" : ""}`}>
      <div className="sx-row-top">
        <div className="sx-row-main">
          <div className="ttitle">{a.title}</div>
          <div className="sx-meta">
            {LANG_NAME[a.language] ?? a.language} · {a.mode === "live" ? "live scene" : "rally"} · {a.turns} {a.mode === "live" ? "tracks" : "takes"} · {hours(a.verified_seconds)} · verified by {a.editor_id ?? "?"} {when(a.verified_at)}
          </div>
        </div>
        <div className="sx-row-end">
          <span className="chip">{tier(a.quality_tier)}</span>
        </div>
      </div>
      <div className="row2">
        <div className="stat"><div className="n">{Number(a.editor_score).toFixed(2)}</div><div className="s">Editor&rsquo;s score</div></div>
        <div className="stat"><div className="n">{a.peer_score != null ? Number(a.peer_score).toFixed(2) : "none"}</div><div className="s">Peer score</div></div>
      </div>
      {(a.mine || a.hold || a.paid) && (
        <div className="chips">
          {a.mine && <span className="chip gold">you verified this one</span>}
          {a.hold && <span className="chip coral">integrity hold</span>}
          {a.paid && <span className="chip">some lines already requested or paid</span>}
        </div>
      )}
      {onOpen && <button type="button" className="pill ghost" onClick={() => onOpen(a.session_id)}>Open the bench and listen</button>}
      {a.mine ? (
        <div className="tbody muted small">A different editor audits this rally.</div>
      ) : (
        <>
          <div className="chips" role="radiogroup" aria-label="Outcome">
            <button type="button" role="radio" aria-checked={outcome === "upheld"} className={`chip${outcome === "upheld" ? " on" : ""}`} onClick={() => setOutcome("upheld")}>Uphold</button>
            <button type="button" role="radio" aria-checked={outcome === "adjusted"} className={`chip${outcome === "adjusted" ? " on gold" : ""}`} onClick={() => setOutcome("adjusted")}>Adjust the score</button>
          </div>
          {outcome === "adjusted" && (
            <div className="field sx-pop" style={{ marginBottom: 0 }}><label>Your score, 1 to 5</label><input inputMode="decimal" value={score} onChange={(e) => setScore(e.target.value)} placeholder="e.g. 3.5" /></div>
          )}
          <div className="field" style={{ marginBottom: 0 }}><label>Note{outcome === "adjusted" ? " · why the score moves" : " · optional"}</label><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={outcome === "adjusted" ? "What the editor missed or over-credited." : "Anything worth keeping."} /></div>
          <div className="btn-row" style={{ alignItems: "center" }}>
            <button type="button" className={`pill${outcome === "adjusted" ? " gold" : " mint"}`} disabled={busy || done || !scoreOk || (outcome === "adjusted" && note.trim().length < 3)} onClick={() => void record()}>{busy ? "Saving…" : done ? "Recorded" : outcome === "upheld" ? "Uphold the verification" : "Record the adjusted score"}</button>
            {done && <span className="chip sx-ok sx-pop" role="status">✓ recorded</span>}
          </div>
          {err && <div className="sx-block sx-block-coral sx-pop"><div className="tbody">{err}</div></div>}
        </>
      )}
    </div>
  );
}

function DoneRow({ d, cls }: { d: AuditDone; cls: string }) {
  const adjusted = d.outcome === "adjusted";
  return (
    <div className={`sx-row${adjusted ? " sx-spine-gold" : ""}${cls === " sx-flash" && adjusted ? " sx-flash sx-flash-gold" : cls}`}>
      <div className="sx-row-top">
        <div className="sx-row-main">
          <div className="sx-row-t">{d.title}</div>
          <div className="sx-row-s">{LANG_NAME[d.language] ?? d.language} · verified by {d.editor_id ?? "?"} · audited by {d.auditor_id ?? "?"}</div>
          <div className="sx-row-m">{when(d.audited_at)}</div>
          {d.note && <div className="tbody muted small" style={{ marginTop: 3 }}>{d.note}</div>}
        </div>
        <div className="sx-row-end">
          <span className={`chip${adjusted ? " gold" : ""}`}>{d.outcome === "upheld" ? `upheld · ${tier(d.quality_tier)}` : `${tier(d.original_tier)} to ${tier(d.quality_tier)}`}</span>
        </div>
      </div>
    </div>
  );
}
