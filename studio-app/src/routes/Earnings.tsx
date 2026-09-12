import { useCallback, useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { STATUS_WORD, TIER_WORD, ap, cancelPayout, money, monthName, myEarnings, requestPayout, type EarningLine, type MyEarnings } from "@/lib/earn";
import { when } from "@/lib/verify";

interface Props {
  onBack: () => void;
  embedded?: boolean;
}

const chipColor: Record<string, string> = { held: "var(--gold)", cleared: "var(--acc)", requested: "var(--acc2)", paid: "var(--ink2)", forfeited: "var(--coral)" };

/** The contributor's money: what is ready, what is on hold and why, what was paid, and the payout request. */
export function Earnings({ onBack, embedded }: Props) {
  const [e, setE] = useState<MyEarnings | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [rail, setRail] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await myEarnings();
      setE(next);
      setRail((r) => r || next.my_rail || next.rails[0]?.key || "");
      setErr(null);
    } catch (x) {
      setErr(x instanceof Error ? x.message.replace(/^.*?: /, "") : "Couldn't load your earnings.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const request = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await requestPayout(rail);
      setFlash(`Requested ${money(r.amount_usd)}. It lands within ${e?.payout_days ?? 14} days.`);
      await load();
    } catch (x) {
      setErr(x instanceof Error ? x.message.replace(/^.*?: /, "") : "Couldn't request the payout.");
    }
    setBusy(false);
  };
  const cancel = async (pid: string) => {
    setBusy(true);
    try {
      await cancelPayout(pid);
      setFlash("Cancelled. The money is back in your ready balance.");
      await load();
    } catch (x) {
      setErr(x instanceof Error ? x.message.replace(/^.*?: /, "") : "Couldn't cancel.");
    }
    setBusy(false);
  };

  const railOf = (k: string) => e?.rails.find((r) => r.key === k);
  const min = railOf(rail)?.min ?? null;
  const canRequest = Boolean(e && !e.open_request && min != null && Number(e.cleared_usd) >= min);
  const months = e ? [...new Set(e.lines.map((l) => l.month))] : [];
  const openPayout = e?.payouts.find((p) => p.status === "requested");

  const body = (
    <div className="shell">
      <div className="eyebrow" style={{ marginBottom: 6 }}>Earnings · per speaker, per verified hour</div>
      <h1 className="h1" style={{ marginBottom: 14, fontSize: "clamp(1.4rem,6vw,2rem)" }}>{e ? (Number(e.cleared_usd) > 0 ? `${money(e.cleared_usd)} ready.` : "Nothing ready yet.") : "Loading…"}</h1>
      {err && <div className="tile" style={{ borderColor: "var(--coral)", marginBottom: 14 }}><div className="tbody" style={{ color: "var(--coral)" }}>{err}</div></div>}
      {flash && <div className="tile" style={{ borderColor: "var(--acc)", marginBottom: 14 }}><div className="tbody">{flash}</div></div>}

      {e && (
        <>
          <div className="sheet" style={{ marginBottom: 18 }}>
            <div className="handle" />
            <div className="shead"><i />Your balance</div>
            <div className="row2">
              <div className="tile acc"><div className="tlbl">Ready to pay out</div><div className="ttitle" style={{ fontSize: "1.3rem" }}>{money(e.cleared_usd)}</div><div className="tbody muted small">{ap(e.cleared_usd, e.ap_per_usd)}</div></div>
              <div className="tile"><div className="tlbl">On hold · clause 15</div><div className="ttitle" style={{ fontSize: "1.3rem", color: Number(e.held_usd) > 0 ? "var(--gold)" : undefined }}>{money(e.held_usd)}</div><div className="tbody muted small">{Number(e.held_usd) > 0 ? "waits for a case decision" : "nothing held"}</div></div>
            </div>
            <div className="row2">
              <div className="tile"><div className="tlbl">On its way</div><div className="ttitle" style={{ fontSize: "1.1rem" }}>{money(e.requested_usd)}</div></div>
              <div className="tile"><div className="tlbl">Paid so far</div><div className="ttitle" style={{ fontSize: "1.1rem" }}>{money(e.paid_usd)}</div></div>
            </div>
            <div className="tbody muted small">Base rate {money(e.base_rates.standard)} per speaker per verified hour, times your tier after a linguist verifies the rally: Platinum x1.2, Gold x1.0, Silver x0.7, floor x0.5. A rally that is questioned under clause 15 waits; only a confirmed decision forfeits it, and only that rally.</div>
          </div>

          <div className="sheet" style={{ marginBottom: 18 }}>
            <div className="handle" />
            <div className="shead"><i className="g" />Payout</div>
            {openPayout ? (
              <div className="tile" style={{ borderColor: "var(--acc)" }}>
                <div className="tlbl">Requested · {when(openPayout.requested_at)}</div>
                <div className="tbody">{money(openPayout.amount_usd)} by {railOf(openPayout.rail)?.name ?? openPayout.rail}. It lands within {e.payout_days} days of the request.</div>
                <button className="pill ghost" style={{ marginTop: 10 }} disabled={busy} onClick={() => void cancel(openPayout.id)}>Cancel the request</button>
              </div>
            ) : (
              <>
                <div className="field">
                  <label>Pay me by</label>
                  <select value={rail} onChange={(x) => setRail(x.target.value)}>
                    {e.rails.map((r) => <option key={r.key} value={r.key}>{r.name} · minimum {money(r.min)}</option>)}
                  </select>
                </div>
                <div className="tbody muted small">{min != null && Number(e.cleared_usd) < min ? `The minimum for ${railOf(rail)?.name} is ${money(min)}. You have ${money(e.cleared_usd)} ready; keep playing.` : `Everything ready, ${money(e.cleared_usd)}, goes in one payout. A statement is issued monthly.`}</div>
                <button className="pill mint" disabled={busy || !canRequest} onClick={() => void request()}>{busy ? "Requesting…" : `Request ${money(e.cleared_usd)}`}</button>
              </>
            )}
            {e.payouts.filter((p) => p.status !== "requested").length > 0 && (
              <div className="tile">
                <div className="tlbl">Past payouts</div>
                {e.payouts.filter((p) => p.status !== "requested").map((p) => (
                  <div key={p.id} className="tbody small" style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span>{when(p.paid_at ?? p.requested_at)} · {railOf(p.rail)?.name ?? p.rail}{p.reference ? ` · ${p.reference}` : ""}</span>
                    <span style={{ color: p.status === "paid" ? "var(--acc)" : "var(--mut)" }}>{money(p.amount_usd)} · {p.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {months.length === 0 && <div className="tbody muted" style={{ marginBottom: 18 }}>No verified rallies yet. Earnings appear here as a linguist verifies each rally.</div>}
          {months.map((m) => {
            const lines = e.lines.filter((l) => l.month === m);
            const total = lines.filter((l) => l.status !== "forfeited").reduce((n, l) => n + Number(l.amount_usd), 0);
            return (
              <div key={m} className="sheet" style={{ marginBottom: 18 }}>
                <div className="handle" />
                <div className="shead"><i />{monthName(m)} · {money(total)}</div>
                {lines.map((l) => <Line key={l.id} l={l} />)}
              </div>
            );
          })}
        </>
      )}
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

function Line({ l }: { l: EarningLine }) {
  return (
    <div className="tile" style={{ opacity: l.status === "forfeited" ? 0.7 : 1 }}>
      <div className="spread" style={{ alignItems: "flex-start" }}>
        <div>
          <div className="ttitle" style={{ fontSize: "0.95rem" }}>{l.title}</div>
          <div className="tbody muted small" style={{ marginTop: 3 }}>{when(l.date)} · {Math.round(Number(l.verified_seconds))} s verified · {TIER_WORD[l.quality_tier ?? ""] ?? l.quality_tier ?? "?"} x{l.multiplier} at {money(l.base_rate_usd)}/h</div>
        </div>
        <div style={{ textAlign: "right", flex: "none" }}>
          <div className="ttitle" style={{ fontSize: "0.95rem", textDecoration: l.status === "forfeited" ? "line-through" : undefined }}>{money(l.amount_usd)}</div>
          <span className="chip" style={{ fontSize: "0.58rem", borderColor: chipColor[l.status], color: chipColor[l.status], background: "transparent" }}>{STATUS_WORD[l.status]}</span>
        </div>
      </div>
    </div>
  );
}
