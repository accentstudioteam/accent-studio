import { useCallback, useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
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

  const load = useCallback(async () => {
    try {
      setQ(await auditQueue());
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "Couldn't load the audit queue.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const body = (
    <div className="shell" style={{ maxWidth: 720 }}>
      <div className="spread" style={{ marginBottom: 16, alignItems: "flex-start" }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Cutting Room{q ? ` · you are ${q.my_editor}` : ""}</div>
          <h1 className="h1">Audit queue{q ? ` · ${q.pending.length}` : ""}</h1>
        </div>
        <button className="pill ghost" style={{ flex: "none", width: "auto" }} onClick={() => void load()}>Refresh</button>
      </div>
      <div className="tile" style={{ marginBottom: 14 }}>
        <div className="tbody muted" style={{ fontSize: "0.85rem" }}>
          {q ? `${q.sample_pct}% of verified rallies are drawn at random for a second ear. ` : ""}Listen to the takes against the transcripts and the editor's score. Uphold it, or adjust the score if the tier is wrong: unpaid lines are re-priced with the new score, lines already requested or paid are left as they were, and the delivery names the outcome. You cannot audit a rally you verified.
          {q ? ` ${q.audited_total} audited of ${q.verified_total} verified.` : ""}
        </div>
      </div>
      {err && <div className="tile" style={{ borderColor: "var(--coral)", marginBottom: 14 }}><div className="tbody" style={{ color: "var(--coral)" }}>{err}</div></div>}
      {flash && <div className="tile" style={{ borderColor: "var(--acc)", marginBottom: 14 }}><div className="tbody">{flash}</div></div>}
      {!q && !err && <div className="muted">Loading…</div>}
      {q && q.pending.length === 0 && <div className="muted" style={{ marginBottom: 14 }}>Nothing drawn for audit right now.</div>}
      <div className="stack">
        {q?.pending.map((a) => <AuditCard key={a.session_id} a={a} onOpen={onOpen} onChanged={load} onDone={setFlash} />)}
      </div>
      {q && q.done.length > 0 && (
        <div className="sheet" style={{ marginTop: 18 }}>
          <div className="handle" />
          <div className="shead"><i />Audited</div>
          {q.done.map((d) => <DoneRow key={d.session_id} d={d} />)}
        </div>
      )}
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

function AuditCard({ a, onOpen, onChanged, onDone }: { a: AuditItem; onOpen?: (sid: string) => void; onChanged: () => Promise<void>; onDone: (msg: string) => void }) {
  const [outcome, setOutcome] = useState<"upheld" | "adjusted">("upheld");
  const [score, setScore] = useState(String(a.editor_score));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const n = Number(score);
  const scoreOk = outcome === "upheld" || (Number.isFinite(n) && n >= 1 && n <= 5);

  const record = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await auditRecord(a.session_id, outcome, outcome === "adjusted" ? n : null, note);
      onDone(`${a.title}: ` + (r.outcome === "upheld" ? `Upheld at ${tier(r.quality_tier)}.` : `Adjusted to ${tier(r.quality_tier)}: ${r.lines_repriced} line${r.lines_repriced === 1 ? "" : "s"} re-priced${r.lines_untouched ? `, ${r.lines_untouched} already requested or paid left as they were` : ""}.`));
      await onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "Couldn't record the audit.");
    }
    setBusy(false);
  };

  return (
    <div className="sheet">
      <div className="handle" />
      <div className="spread" style={{ alignItems: "flex-start" }}>
        <div>
          <div className="ttitle">{a.title}</div>
          <div className="tbody muted small" style={{ marginTop: 4 }}>
            {LANG_NAME[a.language] ?? a.language} · {a.mode === "live" ? "live scene" : "rally"} · {a.turns} {a.mode === "live" ? "tracks" : "takes"} · {hours(a.verified_seconds)} · verified by {a.editor_id ?? "?"} {when(a.verified_at)}
          </div>
        </div>
        <span className="chip" style={{ flex: "none" }}>{tier(a.quality_tier)}</span>
      </div>
      <div className="row2">
        <div className="tile"><div className="tlbl">Editor's score</div><div className="ttitle">{Number(a.editor_score).toFixed(2)}</div></div>
        <div className="tile"><div className="tlbl">Peer score</div><div className="ttitle">{a.peer_score != null ? Number(a.peer_score).toFixed(2) : "none"}</div></div>
      </div>
      <div className="chips">
        {a.mine && <span className="chip gold">you verified this one</span>}
        {a.hold && <span className="chip coral">integrity hold</span>}
        {a.paid && <span className="chip">some lines already requested or paid</span>}
      </div>
      {onOpen && <button className="pill ghost" onClick={() => onOpen(a.session_id)}>Open the bench and listen</button>}
      {a.mine ? (
        <div className="tbody muted small">A different editor audits this rally.</div>
      ) : (
        <>
          <div className="chips" role="radiogroup" aria-label="Outcome">
            <button type="button" role="radio" aria-checked={outcome === "upheld"} className={`chip${outcome === "upheld" ? " on" : ""}`} onClick={() => setOutcome("upheld")}>Uphold</button>
            <button type="button" role="radio" aria-checked={outcome === "adjusted"} className={`chip${outcome === "adjusted" ? " on" : ""}`} onClick={() => setOutcome("adjusted")}>Adjust the score</button>
          </div>
          {outcome === "adjusted" && (
            <div className="field"><label>Your score, 1 to 5</label><input inputMode="decimal" value={score} onChange={(e) => setScore(e.target.value)} placeholder="e.g. 3.5" /></div>
          )}
          <div className="field"><label>Note{outcome === "adjusted" ? " · why the score moves" : " · optional"}</label><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={outcome === "adjusted" ? "What the editor missed or over-credited." : "Anything worth keeping."} /></div>
          <button className="pill mint" disabled={busy || !scoreOk || (outcome === "adjusted" && note.trim().length < 3)} onClick={() => void record()}>{busy ? "Saving…" : outcome === "upheld" ? "Uphold the verification" : "Record the adjusted score"}</button>
          {err && <div className="tbody small" style={{ color: "var(--coral)" }}>{err}</div>}
        </>
      )}
    </div>
  );
}

function DoneRow({ d }: { d: AuditDone }) {
  return (
    <div className="tile">
      <div className="spread" style={{ alignItems: "flex-start" }}>
        <div>
          <div className="tbody small">{d.title} · {LANG_NAME[d.language] ?? d.language} · verified by {d.editor_id ?? "?"} · audited by {d.auditor_id ?? "?"} {when(d.audited_at)}</div>
          {d.note && <div className="tbody muted small" style={{ marginTop: 4 }}>{d.note}</div>}
        </div>
        <span className={`chip${d.outcome === "adjusted" ? " gold" : ""}`} style={{ flex: "none" }}>{d.outcome === "upheld" ? `upheld · ${tier(d.quality_tier)}` : `${tier(d.original_tier)} to ${tier(d.quality_tier)}`}</span>
      </div>
    </div>
  );
}
