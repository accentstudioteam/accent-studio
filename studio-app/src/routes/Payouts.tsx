import { useCallback, useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
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

  const load = useCallback(async () => {
    try {
      setQ(await payoutsQueue());
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "Couldn't load the payouts.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const requested = q?.payouts.filter((p) => p.status === "requested") ?? [];
  const done = q?.payouts.filter((p) => p.status !== "requested") ?? [];

  const body = (
    <div className="shell" style={{ maxWidth: 720 }}>
      <div className="spread" style={{ marginBottom: 16, alignItems: "flex-start" }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Ledger</div>
          <h1 className="h1">Payouts{q ? ` · ${requested.length} to send` : ""}</h1>
        </div>
        <button className="pill ghost" style={{ flex: "none", width: "auto" }} onClick={() => void load()}>Refresh</button>
      </div>
      {q && (
        <div className="row2" style={{ marginBottom: 14 }}>
          <div className="tile acc"><div className="tlbl">Requested, to send</div><div className="ttitle">{money(q.requested_usd)}</div></div>
          <div className="tile"><div className="tlbl">Cleared, not yet requested</div><div className="ttitle">{money(q.cleared_usd)}</div></div>
          <div className="tile"><div className="tlbl">On hold · clause 15</div><div className="ttitle" style={{ color: Number(q.held_usd) > 0 ? "var(--gold)" : undefined }}>{money(q.held_usd)}</div></div>
          <div className="tile"><div className="tlbl">Paid so far</div><div className="ttitle">{money(q.paid_usd)}</div></div>
        </div>
      )}
      <div className="tile" style={{ marginBottom: 14 }}>
        <div className="tbody muted" style={{ fontSize: "0.85rem" }}>Admins only: linguists never see this screen. Send the money by the rail the contributor chose, then mark it paid with the transaction reference. The lines behind the request move to paid and appear on the contributor's statement. Payouts are due within 14 days of the request.</div>
      </div>
      {err && <div className="tile" style={{ borderColor: "var(--coral)", marginBottom: 14 }}><div className="tbody" style={{ color: "var(--coral)" }}>{err}</div></div>}
      {q && requested.length === 0 && <div className="muted" style={{ marginBottom: 14 }}>Nothing waiting to be sent.</div>}
      <div className="stack">
        {requested.map((p) => <PayoutCard key={p.id} p={p} onChanged={load} />)}
      </div>
      {done.length > 0 && (
        <div className="sheet" style={{ marginTop: 18 }}>
          <div className="handle" />
          <div className="shead"><i />Sent</div>
          {done.map((p) => (
            <div key={p.id} className="tile">
              <div className="spread">
                <div className="tbody small">{p.speaker_id} · {p.rail} · {when(p.paid_at ?? p.requested_at)}{p.reference ? ` · ${p.reference}` : ""}{p.paid_by ? ` · by ${p.paid_by}` : ""}</div>
                <span className="chip" style={{ flex: "none" }}>{money(p.amount_usd)} · {p.status}</span>
              </div>
            </div>
          ))}
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

function PayoutCard({ p, onChanged }: { p: QueuedPayout; onChanged: () => Promise<void> }) {
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pay = async () => {
    setBusy(true);
    setErr(null);
    try {
      await markPaid(p.id, ref);
      await onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "Couldn't mark it paid.");
    }
    setBusy(false);
  };
  return (
    <div className="sheet">
      <div className="handle" />
      <div className="spread" style={{ alignItems: "flex-start" }}>
        <div>
          <div className="ttitle">{money(p.amount_usd)} by {p.rail}</div>
          <div className="tbody muted small" style={{ marginTop: 4, fontFamily: "var(--mono)" }}>{p.speaker_id} · {p.lines} verified {p.lines === 1 ? "rally" : "rallies"} · requested {when(p.requested_at)}</div>
        </div>
        <span className="chip" style={{ flex: "none", borderColor: "var(--gold)", color: "var(--gold)" }}>to send</span>
      </div>
      <div className="field"><label>Transaction reference</label><input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. M-Pesa QGH7… or USDC tx 0x…" /></div>
      <button className="pill mint" disabled={busy || ref.trim().length < 3} onClick={() => void pay()}>{busy ? "Saving…" : "Mark paid"}</button>
      {err && <div className="tbody small" style={{ color: "var(--coral)" }}>{err}</div>}
    </div>
  );
}
