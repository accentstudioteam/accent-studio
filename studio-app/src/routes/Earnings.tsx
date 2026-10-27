import { useCallback, useEffect, useState } from "react";
import { STATUS_WORD, TIER_WORD, ap, cancelPayout, money, monthName, myEarnings, requestPayout, type EarningLine, type MyEarnings } from "@/lib/earn";
import { when } from "@/lib/verify";
import { Notice, Page, TopBar } from "@/components/ankara-ui";

interface Props {
  onBack: () => void;
  embedded?: boolean;
}

/* ============================================================================
   Money, in the approved "Ankara Blocks" direction.

   The prototype's Money screen is .bal (the gold balance block), .tier (the
   rate block with its .prog bar), .lines (the statement) and .payout; all four
   are reused here as they stand. myEarnings / requestPayout / cancelPayout and
   every rule about minimums and open requests are untouched.
   ========================================================================= */

/** Which chip a line's status wears. The words themselves come from STATUS_WORD. */
const chipFor: Record<string, string> = { held: "chip-gold", cleared: "chip-mint", requested: "chip-lilac", paid: "chip-cream", forfeited: "chip-coral" };

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
  const past = e?.payouts.filter((p) => p.status !== "requested") ?? [];

  const body = (
    <>
      {err && <Notice tone="coral">{err}</Notice>}
      {flash && <Notice>{flash}</Notice>}
      {!e && !err && <div className="sys">Opening your earnings</div>}

      {e && (
        <>
          <div className="blk blk-gold pat-rings-6 bal">
            <div className="lab">Ready to pay out</div>
            <div className="money">
              <span className="naira">{money(e.cleared_usd)}</span>
              <span className="usd">{ap(e.cleared_usd, e.ap_per_usd)}</span>
            </div>
            <div className="row">
              <span className="chip chip-ink">On hold {money(e.held_usd)}</span>
              <span className="chip chip-cream">On its way {money(e.requested_usd)}</span>
              <span className="chip chip-cream">Paid {money(e.paid_usd)}</span>
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.4, marginTop: 10, fontWeight: 500 }}>
              {Number(e.held_usd) > 0 ? "What is on hold waits for a clause 15 decision. " : ""}Base rate {money(e.base_rates.standard)} per speaker per verified hour, times your tier after a linguist verifies the rally: Platinum ×1.2, Gold ×1.0, Silver ×0.7, floor ×0.5. Only a confirmed decision forfeits a rally, and only that rally.
            </p>
          </div>

          <div className="card pad payout">
            <div className="eyebrow">Payout</div>
            {openPayout ? (
              <>
                <h3 style={{ marginTop: 4 }}>{money(openPayout.amount_usd)} requested</h3>
                <p className="note-p" style={{ marginTop: 4 }}>By {railOf(openPayout.rail)?.name ?? openPayout.rail}, asked {when(openPayout.requested_at)}. It lands within {e.payout_days} days of the request.</p>
                <button className="btn btn-outline btn-block" type="button" style={{ marginTop: 12 }} disabled={busy} onClick={() => void cancel(openPayout.id)}>Cancel the request</button>
              </>
            ) : (
              <>
                <div className="field" style={{ marginTop: 10 }}>
                  <label htmlFor="rail">Pay me by</label>
                  <select id="rail" value={rail} onChange={(x) => setRail(x.target.value)}>
                    {e.rails.map((r) => <option key={r.key} value={r.key}>{r.name} · minimum {money(r.min)}</option>)}
                  </select>
                </div>
                <p className="payout-note">{min != null && Number(e.cleared_usd) < min ? `The minimum for ${railOf(rail)?.name} is ${money(min)}. You have ${money(e.cleared_usd)} ready; keep playing.` : `Everything ready, ${money(e.cleared_usd)}, goes in one payout. A statement is issued monthly.`}</p>
                <button className="btn btn-mint btn-block" type="button" style={{ marginTop: 10 }} disabled={busy || !canRequest} onClick={() => void request()}>{busy ? "Requesting…" : `Request ${money(e.cleared_usd)}`}</button>
              </>
            )}
          </div>

          {past.length > 0 && (
            <>
              <div className="sec-h"><h3>Past payouts</h3></div>
              <ul className="card lines">
                {past.map((p) => (
                  <li key={p.id}>
                    <span className="d">{when(p.paid_at ?? p.requested_at)}</span>
                    <span className="t">{railOf(p.rail)?.name ?? p.rail}{p.reference ? ` · ${p.reference}` : ""}</span>
                    <span className="amt">{money(p.amount_usd)}</span>
                    <span className={`chip ${p.status === "paid" ? "chip-mint" : "chip-cream"}`}>{p.status}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {months.length === 0 && <p className="note-p">No verified rallies yet. Earnings appear here as a linguist verifies each rally.</p>}
          {months.map((m) => {
            const lines = e.lines.filter((l) => l.month === m);
            const total = lines.filter((l) => l.status !== "forfeited").reduce((n, l) => n + Number(l.amount_usd), 0);
            return (
              <div key={m}>
                <div className="sec-h"><h3>{monthName(m)}</h3><span className="chip chip-cream">{money(total)}</span></div>
                <ul className="card lines">{lines.map((l) => <Line key={l.id} l={l} />)}</ul>
              </div>
            );
          })}
        </>
      )}
    </>
  );

  if (embedded) return body;
  return (
    <Page>
      <TopBar onBack={onBack} backLabel="Back home" eyebrow="Per speaker, per verified hour" title={e ? (Number(e.cleared_usd) > 0 ? `${money(e.cleared_usd)} ready.` : "Nothing ready yet.") : "Money."} />
      {body}
    </Page>
  );
}

function Line({ l }: { l: EarningLine }) {
  return (
    <li style={{ opacity: l.status === "forfeited" ? 0.7 : 1 }}>
      <span className="d">{when(l.date)}</span>
      <span className="t">
        {l.title}
        <small className="mono muted" style={{ display: "block", fontWeight: 400, overflow: "hidden", textOverflow: "ellipsis" }}>{Math.round(Number(l.verified_seconds))} s · {TIER_WORD[l.quality_tier ?? ""] ?? l.quality_tier ?? "?"} ×{l.multiplier} at {money(l.base_rate_usd)}/h</small>
      </span>
      <span className="amt" style={{ textDecoration: l.status === "forfeited" ? "line-through" : undefined }}>{money(l.amount_usd)}</span>
      <span className={`chip ${chipFor[l.status] ?? "chip-cream"}`}>{STATUS_WORD[l.status]}</span>
    </li>
  );
}
