import { useState } from "react";
import type { Nav } from "@/prototype/types";
import { ScreenHead } from "@/prototype/ui";
import { MOCK_USER, PROGRESSION, AGREEMENTS } from "@/prototype/mock";

export function Profile({ nav }: { nav: Nav }) {
  return (
    <>
      <div className="center" style={{ marginBottom: 22 }}>
        <div style={{
          width: 72, height: 72, borderRadius: "50%", margin: "0 auto 12px",
          background: "linear-gradient(135deg,#3aa07e,#186154)", display: "grid",
          placeItems: "center", fontSize: "1.8rem",
        }}>🎙️</div>
        <h1 className="h1" style={{ fontSize: "1.6rem" }}>@{MOCK_USER.handle}</h1>
        <div className="muted" style={{ fontSize: "0.9rem" }}>{MOCK_USER.localeName} · {MOCK_USER.region}</div>
        <div className="badge ok" style={{ marginTop: 10 }}>● {MOCK_USER.rank}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
        <div className="tile"><div className="tlbl">Verified minutes</div><div className="ttitle" style={{ color: "var(--acc)" }}>{MOCK_USER.verifiedMinutes}</div></div>
        <div className="tile"><div className="tlbl">Trust score</div><div className="ttitle" style={{ color: "var(--acc)" }}>{Math.round(MOCK_USER.trustScore * 100)}%</div></div>
        <div className="tile"><div className="tlbl">Tier</div><div className="ttitle" style={{ color: "var(--gold)" }}>{MOCK_USER.tier}</div></div>
        <div className="tile"><div className="tlbl">Streak</div><div className="ttitle">🔥 {MOCK_USER.streak} days</div></div>
      </div>

      <div className="rows">
        <button className="row tap" onClick={() => nav.go("progression")}>
          <span className="ricon">🏆</span><div className="rmain"><div className="rt">Progression</div><div className="rs">Your rank and what unlocks next</div></div><span className="rend">›</span>
        </button>
        <button className="row tap" onClick={() => nav.go("my-documents")}>
          <span className="ricon">📄</span><div className="rmain"><div className="rt">My documents</div><div className="rs">Signed agreements</div></div><span className="rend">›</span>
        </button>
        <button className="row tap" onClick={() => nav.go("consent-center")}>
          <span className="ricon">🔏</span><div className="rmain"><div className="rt">Consent center</div><div className="rs">Manage what you've agreed to</div></div><span className="rend">›</span>
        </button>
        <button className="row tap" onClick={() => nav.go("data-privacy")}>
          <span className="ricon">🛡️</span><div className="rmain"><div className="rt">Data & privacy</div><div className="rs">Export or delete your data</div></div><span className="rend">›</span>
        </button>
      </div>
    </>
  );
}

export function Progression({ nav: _nav }: { nav: Nav }) {
  const currentRank = MOCK_USER.rank;
  const currentIdx = PROGRESSION.findIndex((p) => p.rank === currentRank);
  return (
    <>
      <ScreenHead eyebrow="Progression" title="Play well, rank up." lede="Rank unlocks new games, higher-demand queues, and a better multiplier." />
      <div className="rows">
        {PROGRESSION.map((p, i) => {
          const done = i < currentIdx;
          const now = i === currentIdx;
          return (
            <div className="row" key={p.rank} style={now ? { borderColor: "var(--acc)" } : undefined}>
              <span className="ricon">{done ? "✅" : now ? "⭐" : "🔒"}</span>
              <div className="rmain">
                <div className="rt">{p.rank}{now && <span className="badge ok" style={{ marginLeft: 8 }}>you</span>}</div>
                <div className="rs">{p.perk}</div>
              </div>
              <span className="rend">{p.need}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

export function MyDocuments({ nav: _nav }: { nav: Nav }) {
  return (
    <>
      <ScreenHead eyebrow="My documents" title="Everything you signed." lede="Each agreement is stored with a cryptographic hash of the exact version you accepted." />
      <div className="rows">
        {AGREEMENTS.map((a) => (
          <div className="row" key={a.id}>
            <span className="ricon">📄</span>
            <div className="rmain">
              <div className="rt">{a.name}</div>
              <div className="rs mono" style={{ fontSize: "0.66rem" }}>{a.version} · sha256:e3b0c442… · 2026-09-02</div>
            </div>
            <span className="rend" style={{ color: "var(--acc2)" }}>PDF ↓</span>
          </div>
        ))}
      </div>
    </>
  );
}

export function ConsentCenter({ nav: _nav }: { nav: Nav }) {
  const [alerts, setAlerts] = useState(true);
  const [research, setResearch] = useState(true);
  return (
    <>
      <ScreenHead eyebrow="Consent center" title="You're in control." lede="Consent is layered and revocable. Turning something off applies going forward; already-anonymized data that can't be traced to you stays in shipped datasets." />
      <div className="rows" style={{ marginBottom: 16 }}>
        <div className="row">
          <span className="ricon">✍️</span>
          <div className="rmain"><div className="rt">Voice IP assignment</div><div className="rs">Required to play · signed v1.2</div></div>
          <span className="badge ok">active</span>
        </div>
        <button className="row tap" onClick={() => setResearch(!research)}>
          <span className="ricon">🔬</span>
          <div className="rmain"><div className="rt">Research use of new takes</div><div className="rs">Applies to takes from here on</div></div>
          <span className={research ? "badge ok" : "badge warn"}>{research ? "on" : "off"}</span>
        </button>
        <button className="row tap" onClick={() => setAlerts(!alerts)}>
          <span className="ricon">📣</span>
          <div className="rmain"><div className="rt">Product emails</div><div className="rs">Payout and scene reminders</div></div>
          <span className={alerts ? "badge ok" : "badge warn"}>{alerts ? "on" : "off"}</span>
        </button>
      </div>
      <div className="tile dash">
        <div className="tlbl">Withdraw all future consent</div>
        <div className="tbody muted" style={{ marginBottom: 10 }}>Stops new data collection and pauses your account. Your identity data can be deleted on request.</div>
        <button className="pill ghost" style={{ borderColor: "var(--coral)", color: "var(--coral)" }}>Withdraw consent</button>
      </div>
    </>
  );
}

export function DataPrivacy({ nav: _nav }: { nav: Nav }) {
  return (
    <>
      <ScreenHead eyebrow="Data & privacy" title="Your voice, decoupled." lede="How we keep your identity separate from the data buyers ever see." />
      <ul className="rlist" style={{ marginBottom: 22 }}>
        <li><span className="rico">🔗</span> Your audio is indexed only by a random ID. Your name, ID and payout details live in a separate encrypted vault.</li>
        <li><span className="rico">🧹</span> Spoken personal details are auto-redacted from transcripts before any data ships.</li>
        <li><span className="rico">🏛️</span> Buyers get anonymized data under contract. They never receive the vault.</li>
      </ul>
      <div className="rows">
        <button className="row tap"><span className="ricon">📦</span><div className="rmain"><div className="rt">Export my data</div><div className="rs">A copy of everything tied to your account</div></div><span className="rend">›</span></button>
        <button className="row tap"><span className="ricon">🗑️</span><div className="rmain"><div className="rt">Delete my identity data</div><div className="rs">Right to erasure of identifiable data</div></div><span className="rend">›</span></button>
      </div>
    </>
  );
}
