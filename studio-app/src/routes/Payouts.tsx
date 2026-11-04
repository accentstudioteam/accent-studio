import { useCallback, useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { Num, useRowMotion } from "@/components/sx-motion";
import { markPaid, money, payoutsQueue, type PayoutQueue, type QueuedPayout } from "@/lib/earn";
import { when } from "@/lib/verify";

interface Props {
  onBack: () => void;
  embedded?: boolean;
}

/** Founder view: payout requests to send, and the money picture across the ledger. */
export function Payouts({ onBack, embedded }: Props) {
  const [q, setQ] = useState<PayoutQueue | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  // the last payout marked paid, named at the top of the screen: money left the building
  const [ack, setAck] = useState<string | null>(null);

  const load = useCallback(async () => {
    setReading(true);
    try {
      setQ(await payoutsQueue());
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "Couldn't load the payouts.");
    }
    setReading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const requested = q?.payouts.filter((p) => p.status === "requested") ?? [];
  const done = q?.payouts.filter((p) => p.status !== "requested") ?? [];

  // one motion map across both lists: a request arriving enters at the top, and
  // the same row, once paid, flashes mint where it lands in the sent list
  const rowCls = useRowMotion(q?.payouts, (p) => p.id, (p) => `${p.status}|${p.reference ?? ""}`);

  const body = (
    <div className="shell wide">
      <div className="sx-head">
        <div>
          <div className="eyebrow">Ledger</div>
          <h1 className="h1">Payouts{q ? <> · <Num value={requested.length} /> to send</> : ""}</h1>
        </div>
      </div>

      {q && (
        <div className="stats sx-rise">
          <div className={`stat${requested.length ? " sx-spine-gold" : ""}`}><div className="n">{money(q.requested_usd)}</div><div className="s">Requested, to send</div></div>
          <div className="stat"><div className="n">{money(q.cleared_usd)}</div><div className="s">Cleared, not yet requested</div></div>
          <div className={`stat${Number(q.held_usd) > 0 ? " sx-spine-coral" : ""}`}><div className={`n${Number(q.held_usd) > 0 ? " sx-fig-coral" : ""}`}>{money(q.held_usd)}</div><div className="s">On hold · clause 15</div></div>
          <div className="stat sx-spine-mint"><div className="n">{money(q.paid_usd)}</div><div className="s">Paid so far</div></div>
        </div>
      )}

      <div className={`sx-bar${reading ? " sx-working" : ""}`}>
        <span className="sx-bar-lab">Due within 14 days</span>
        {q && <span className={`chip num${requested.length ? " gold" : ""}`}>{requested.length} to send</span>}
        {q && <span className="chip num">{done.length} sent</span>}
        <div className="sx-bar-end">
          <button type="button" className="pill ghost" onClick={() => void load()}>Refresh</button>
        </div>
      </div>

      <p className="sx-note">
        Admins only: linguists never see this screen. Send the money by the rail the contributor chose, then mark it paid with the transaction reference.
        The lines behind the request move to paid and appear on the contributor&rsquo;s statement. Payouts are due within 14 days of the request.
      </p>

      {ack && (
        <div className="sx-block sx-block-mint sx-pop" style={{ marginBottom: 12 }} role="status">
          <div className="tlbl">Marked paid</div>
          <div className="tbody">{ack}</div>
        </div>
      )}
      {err && (
        <div className="sx-block sx-block-coral sx-pop" style={{ marginBottom: 12 }}>
          <div className="tlbl">The payouts didn&rsquo;t load</div>
          <div className="tbody">{err}</div>
        </div>
      )}
      {!q && !err && <div className="full-center"><div className="spin" /></div>}
      {q && requested.length === 0 && (
        <div className="empty sx-pop" style={{ marginBottom: 12 }}>
          <b>Nothing to send.</b>
          <span>A request appears here the moment a contributor asks for a payout; the money behind it is already verified and cleared.</span>
        </div>
      )}
      {requested.length > 0 && (
        <div className="stack sx-enter">
          {requested.map((p) => <PayoutCard key={p.id} p={p} cls={rowCls(p)} onChanged={load} onPaid={setAck} />)}
        </div>
      )}

      {done.length > 0 && (
        <>
          <div className="tlbl" style={{ margin: "18px 2px 6px" }}>Sent · {done.length}</div>
          <div className="sx-list sx-enter">
            {done.map((p) => (
              <div key={p.id} className={`sx-row${p.status === "paid" ? " sx-spine-mint" : " sx-spine-coral"}${rowCls(p)}`}>
                <div className="sx-row-top">
                  <div className="sx-row-main">
                    <div className="sx-row-t">{money(p.amount_usd)} by {p.rail}</div>
                    <div className="sx-row-s">{p.speaker_id}{p.paid_by ? ` · by ${p.paid_by}` : ""}</div>
                    <div className="sx-row-m">{when(p.paid_at ?? p.requested_at)}{p.reference ? ` · ${p.reference}` : ""}</div>
                  </div>
                  <div className="sx-row-end">
                    <span className={`chip${p.status === "paid" ? " on" : " coral"}`}>{p.status}</span>
                  </div>
                </div>
              </div>
            ))}
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

/** One request to send. Gold spine while it waits; once the reference is saved
 *  it slides out of this list and the same payout flashes mint under Sent. */
function PayoutCard({ p, cls, onChanged, onPaid }: { p: QueuedPayout; cls: string; onChanged: () => Promise<void>; onPaid: (msg: string) => void }) {
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [paid, setPaid] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pay = async () => {
    setBusy(true);
    setErr(null);
    try {
      await markPaid(p.id, ref);
      setPaid(true);
      onPaid(`${money(p.amount_usd)} to ${p.speaker_id} by ${p.rail} · ${ref.trim()}. The ${p.lines} ${p.lines === 1 ? "line" : "lines"} behind it are now on their statement as paid.`);
      await onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "Couldn't mark it paid.");
    }
    setBusy(false);
  };
  return (
    <div className={`sheet sx-spine-gold${cls}${busy ? " sx-working" : ""}${paid ? " sx-leave" : ""}`}>
      <div className="sx-row-top">
        <div className="sx-row-main">
          <div className="ttitle">{money(p.amount_usd)} by {p.rail}</div>
          <div className="sx-meta">{p.speaker_id} · {p.lines} verified {p.lines === 1 ? "rally" : "rallies"} · requested {when(p.requested_at)}</div>
        </div>
        <div className="sx-row-end">
          <span className="chip gold">to send</span>
        </div>
      </div>
      {p.details && Object.keys(p.details).length > 0 ? (
        <div className="tile"><div className="tlbl">Send to</div><div className="tbody small mono">{Object.entries(p.details).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`).join(" · ")}</div>{p.identity && <div className="sx-meta" style={{ marginTop: 4 }}>identity {p.identity}</div>}</div>
      ) : (
        <div className="tile dash sx-spine-coral"><div className="tbody muted small">No payout details on file for this rail; ask the contributor to add them in Account.</div></div>
      )}
      <div className="field" style={{ marginBottom: 0 }}><label>Transaction reference</label><input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. M-Pesa QGH7… or USDC tx 0x…" /></div>
      <div className="btn-row" style={{ alignItems: "center" }}>
        <button type="button" className="pill mint" disabled={busy || paid || ref.trim().length < 3} onClick={() => void pay()}>{busy ? "Saving…" : paid ? "Paid" : "Mark paid"}</button>
        {paid && <span className="chip sx-ok sx-pop" role="status">✓ paid</span>}
      </div>
      {err && <div className="sx-block sx-block-coral sx-pop"><div className="tbody">{err}</div></div>}
    </div>
  );
}
