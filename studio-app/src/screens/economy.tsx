import { useState } from "react";
import type { Nav } from "@/prototype/types";
import { ScreenHead } from "@/prototype/ui";
import { MOCK_USER, MOCK_LEDGER, RAILS_NOTE } from "@/prototype/mock";
import { RAILS } from "@/lib/labels";

// AP -> cash illustration: 1,000 AP ≈ $1 for the mock.
const AP_TO_USD = 0.001;

export function Wallet({ nav }: { nav: Nav }) {
  const usd = (MOCK_USER.apBalance * AP_TO_USD).toFixed(2);
  return (
    <>
      <div className="eyebrow" style={{ marginBottom: 10 }}>Wallet</div>
      <div className="tile acc" style={{ marginBottom: 16 }}>
        <div className="tlbl">Accent Points balance</div>
        <div className="bignum" style={{ marginTop: 4 }}>{MOCK_USER.apBalance.toLocaleString()}</div>
        <div className="tbody muted" style={{ marginTop: 6 }}>≈ ${usd} cash · {MOCK_USER.verifiedMinutes} verified minutes this cycle</div>
      </div>

      <div className="grid g3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 18 }}>
        <div className="tile"><div className="tlbl">Tier</div><div className="ttitle" style={{ color: "var(--gold)" }}>{MOCK_USER.tier}</div></div>
        <div className="tile"><div className="tlbl">Multiplier</div><div className="ttitle" style={{ color: "var(--acc)" }}>{MOCK_USER.multiplier}</div></div>
        <div className="tile"><div className="tlbl">Streak</div><div className="ttitle">🔥 {MOCK_USER.streak}</div></div>
      </div>

      <button className="pill mint" style={{ marginBottom: 10 }} onClick={() => nav.go("cashout")}>Cash out</button>
      <button className="row tap" style={{ width: "100%" }} onClick={() => nav.go("ledger")}>
        <span className="ricon">📜</span>
        <div className="rmain"><div className="rt">Transaction history</div><div className="rs">Earnings, corrections, cashouts</div></div>
        <span className="rend">›</span>
      </button>

      <div className="tile dash" style={{ marginTop: 16 }}>
        <div className="tlbl">How pay works</div>
        <div className="tbody muted">{RAILS_NOTE}</div>
      </div>
    </>
  );
}

export function Cashout({ nav }: { nav: Nav }) {
  const [amount, setAmount] = useState("2000");
  const [rail, setRail] = useState<string | null>("mpesa");
  const usd = ((Number(amount) || 0) * AP_TO_USD).toFixed(2);
  const ok = Number(amount) >= 2000 && rail;
  return (
    <>
      <ScreenHead eyebrow="Cash out" title="Turn AP into money." />
      <div className="field">
        <label>Amount (AP)</label>
        <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))} />
        <span className="mono" style={{ fontSize: "0.66rem", color: "var(--faint)" }}>≈ ${usd} · minimum 2,000 AP</span>
      </div>
      <div style={{ marginBottom: 20 }}>
        <span className="slabel">Pay to</span>
        <div className="opt-grid">
          {RAILS.map((r) => (
            <button key={r.code} className={rail === r.code ? "opt on" : "opt"} onClick={() => setRail(r.code)}>
              <span className="nm">{r.name}</span>
              <span className="sub">{r.min}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="actionbar">
        <button className="pill mint" disabled={!ok} onClick={() => nav.go("cashout-confirm")}>Review cashout</button>
      </div>
    </>
  );
}

export function CashoutConfirm({ nav }: { nav: Nav }) {
  return (
    <div className="full-center" style={{ minHeight: "68vh" }}>
      <div className="center" style={{ maxWidth: 360 }}>
        <div className="hero-emoji">✅</div>
        <h1 className="h1" style={{ marginBottom: 12 }}>Cashout requested.</h1>
        <p className="muted" style={{ marginBottom: 20, fontSize: "0.95rem" }}>
          2,000 AP (≈ $2.00) to M-Pesa. Payouts settle within 7 business days once
          your verified hours clear QA.
        </p>
        <div className="badge pending" style={{ marginBottom: 24 }}>● Processing</div>
        <button className="pill mint" onClick={() => nav.go("home")}>Back to home</button>
      </div>
    </div>
  );
}

export function Ledger({ nav: _nav }: { nav: Nav }) {
  return (
    <>
      <ScreenHead eyebrow="History" title="Every point, tracked." />
      <div className="rows">
        {MOCK_LEDGER.map((l, i) => (
          <div className="row" key={i}>
            <span className="ricon">{l.icon}</span>
            <div className="rmain"><div className="rt">{l.t}</div><div className="rs">{l.s} · {l.d}</div></div>
            <span className="rend" style={{ color: l.end.startsWith("+") ? "var(--acc2)" : "var(--coral)" }}>{l.end}</span>
          </div>
        ))}
      </div>
    </>
  );
}
