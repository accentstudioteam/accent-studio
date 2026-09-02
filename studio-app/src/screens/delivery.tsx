import type { Nav } from "@/prototype/types";
import { ScreenHead } from "@/prototype/ui";
import {
  FOUNDRY_STAGES,
  CORPORA,
  FOUNDRY_SESSIONS,
  PIPELINE_STEPS,
  BUNDLE_FILES,
  MANIFEST_ROW,
  CONSENT_EVENTS,
  DELIVERIES,
} from "@/prototype/mock";

// The Delivery phase is the internal foundry console: how played scenes become
// clean, labelled, aligned, packaged corpora shipped to labs. Investor-facing.

export function FoundryOverview({ nav }: { nav: Nav }) {
  return (
    <>
      <ScreenHead
        eyebrow="The Foundry · internal"
        title="From played to sold."
        lede="Every scene players record flows through here: captured, transcribed, cleaned, verified, aligned, packaged, and delivered. This is the data foundry."
      />

      <span className="slabel">Pipeline throughput</span>
      <div className="rows" style={{ marginBottom: 20 }}>
        {FOUNDRY_STAGES.map((s, i) => {
          const pct = Math.round((s.count / FOUNDRY_STAGES[0].count) * 100);
          return (
            <div className="row" key={s.key}>
              <span className="ricon">{s.icon}</span>
              <div className="rmain">
                <div className="rt">{s.label}</div>
                <div className="rs">{s.note}</div>
                <div className="progress" style={{ marginTop: 7 }}>
                  <div className="fill" style={{ width: `${pct}%`, opacity: 1 - i * 0.08 }} />
                </div>
              </div>
              <span className="rend" style={{ color: "var(--acc2)" }}>{s.count.toLocaleString()}</span>
            </div>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
        <div className="tile"><div className="tlbl">Verified hours</div><div className="ttitle" style={{ color: "var(--acc)" }}>178.4</div></div>
        <div className="tile"><div className="tlbl">Active corpora</div><div className="ttitle" style={{ color: "var(--gold)" }}>{CORPORA.length}</div></div>
      </div>

      <div className="rows">
        <button className="row tap" onClick={() => nav.go("corpus-builder")}>
          <span className="ricon">🗂️</span><div className="rmain"><div className="rt">Corpora</div><div className="rs">Datasets being assembled</div></div><span className="rend">›</span>
        </button>
        <button className="row tap" onClick={() => nav.go("pipeline-stages")}>
          <span className="ricon">⚙️</span><div className="rmain"><div className="rt">Processing pipeline</div><div className="rs">Watch one take get fixed</div></div><span className="rend">›</span>
        </button>
        <button className="row tap" onClick={() => nav.go("consent-audit")}>
          <span className="ricon">🔏</span><div className="rmain"><div className="rt">Consent audit log</div><div className="rs">Cryptographic chain of consent</div></div><span className="rend">›</span>
        </button>
        <button className="row tap" onClick={() => nav.go("delivery-receipt")}>
          <span className="ricon">🚚</span><div className="rmain"><div className="rt">Deliveries</div><div className="rs">Shipped bundles &amp; receipts</div></div><span className="rend">›</span>
        </button>
      </div>
    </>
  );
}

export function CorpusBuilder({ nav }: { nav: Nav }) {
  return (
    <>
      <ScreenHead eyebrow="Foundry · corpora" title="Datasets in the making." />
      <div className="rows" style={{ marginBottom: 8 }}>
        {CORPORA.map((c) => {
          const pct = Math.min(100, Math.round((c.hours / c.target) * 100));
          const badge = c.status === "delivered" ? "ok" : c.status === "qa" ? "pending" : "ok";
          return (
            <button className="row tap" key={c.id} onClick={() => nav.go("session-detail")} style={{ alignItems: "flex-start" }}>
              <span className="ricon">🗂️</span>
              <div className="rmain">
                <div className="rt">{c.name}</div>
                <div className="rs">{c.locale} · {c.sessions} sessions · buyer: {c.buyer}</div>
                <div className="progress" style={{ marginTop: 8 }}><div className="fill" style={{ width: `${pct}%` }} /></div>
                <div className="mono" style={{ fontSize: "0.64rem", color: "var(--mut)", marginTop: 5 }}>{c.hours.toFixed(1)} / {c.target} hrs · {pct}%</div>
              </div>
              <span className={`badge ${badge}`} style={{ flex: "none" }}>{c.status}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

export function SessionDetail({ nav }: { nav: Nav }) {
  const s = FOUNDRY_SESSIONS[0];
  const BARS = [40, 62, 30, 74, 50, 66, 88, 44, 60, 34, 70, 48, 58, 38, 64, 42];
  return (
    <>
      <div className="eyebrow" style={{ marginBottom: 8 }}>Session · {s.locale}</div>
      <h1 className="h1" style={{ marginBottom: 6, fontSize: "clamp(1.4rem,5.5vw,2rem)" }}>{s.scenario}</h1>
      <div className="mono" style={{ fontSize: "0.66rem", color: "var(--faint)", marginBottom: 18 }}>{s.id}</div>

      <div className="sheet" style={{ marginBottom: 16 }}>
        <div className="handle" />
        <div className="shead"><i />Dual-channel · {s.dur}</div>
        <div className="tile">
          <div className="tlbl">Channel 0 · customer</div>
          <div className="wv">{BARS.map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</div>
        </div>
        <div className="tile">
          <div className="tlbl">Channel 1 · agent</div>
          <div className="wv">{BARS.slice().reverse().map((h, i) => <i key={i} className="mu" style={{ height: `${h}%` }} />)}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
        <div className="tile"><div className="tlbl">Turns</div><div className="ttitle">{s.turns}</div></div>
        <div className="tile"><div className="tlbl">PII redactions</div><div className="ttitle" style={{ color: s.pii ? "var(--gold)" : "var(--acc)" }}>{s.pii}</div></div>
      </div>

      <div className="rows" style={{ marginBottom: 8 }}>
        <div className="row"><span className="ricon">✅</span><div className="rmain"><div className="rt">QA verification</div><div className="rs">Editor ed_pcm_3312 · conf 0.98</div></div><span className="badge ok">{s.qa}</span></div>
        <div className="row"><span className="ricon">🔗</span><div className="rmain"><div className="rt">Word alignment</div><div className="rs">Certified aligner review</div></div><span className={s.align === "done" ? "badge ok" : "badge pending"}>{s.align}</span></div>
        <button className="row tap" onClick={() => nav.go("manifest-view")}><span className="ricon">{"{ }"}</span><div className="rmain"><div className="rt">Manifest row</div><div className="rs">The JSONL a lab receives</div></div><span className="rend">›</span></button>
      </div>
    </>
  );
}

export function PipelineStages({ nav }: { nav: Nav }) {
  return (
    <>
      <ScreenHead
        eyebrow="Foundry · pipeline"
        title="One take, fixed into shape."
        lede="A raw recording becomes a clean, labelled, aligned row. Every step runs automatically or with a human in the loop."
      />

      <div className="rows" style={{ marginBottom: 20 }}>
        {PIPELINE_STEPS.map((p) => (
          <div className="row" key={p.key} style={p.state === "active" ? { borderColor: "var(--acc)" } : undefined}>
            <span className="ricon">{p.icon}</span>
            <div className="rmain"><div className="rt">{p.label}</div><div className="rs">{p.detail}</div></div>
            <span className={p.state === "done" ? "badge ok" : p.state === "active" ? "badge pending" : "badge"} style={p.state === "todo" ? { color: "var(--faint)", borderColor: "var(--line)" } : undefined}>
              {p.state === "done" ? "done" : p.state === "active" ? "running" : "queued"}
            </span>
          </div>
        ))}
      </div>

      <span className="slabel">What "fixing" looks like</span>
      <div className="sheet" style={{ marginBottom: 16 }}>
        <div className="handle" />
        <div className="shead"><i className="g" />Turn 1 · before → after</div>
        <div className="tile dash">
          <div className="tlbl">Raw STT</div>
          <div className="tbody muted" style={{ textDecoration: "line-through" }}>good morning i wake up see pos commot 50k</div>
        </div>
        <div className="tile acc">
          <div className="tlbl">Verified + cased + punctuated</div>
          <div className="tbody">Good morning. I wake up see say POS commot 50k for my account!</div>
        </div>
        <div className="tile">
          <div className="tlbl">Labels attached</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            <span className="badge ok">emotion: frustrated</span>
            <span className="badge pending">code-switch: EN→PCM</span>
            <span className="badge ok">aligned: 7 spans</span>
          </div>
        </div>
      </div>

      <div className="actionbar">
        <button className="pill mint" onClick={() => nav.go("package-build")}>See it packaged</button>
      </div>
    </>
  );
}

export function ManifestView({ nav }: { nav: Nav }) {
  return (
    <>
      <ScreenHead eyebrow="Foundry · schema" title="The schema is the product." lede="Every session serializes to this. One row, machine-readable, Hugging Face and PyTorch ready." />
      <pre style={{ fontSize: "0.62rem" }}>{MANIFEST_ROW}</pre>
      <div className="tile dash" style={{ marginTop: 14 }}>
        <div className="tlbl">Also in every bundle</div>
        <div className="tbody muted">Parquet index for filtering, standalone alignments file, consent log, speaker manifest, license, and SHA-256 checksums.</div>
      </div>
      <div className="actionbar">
        <button className="pill mint" onClick={() => nav.go("package-build")}>Package the bundle</button>
      </div>
    </>
  );
}

export function PackageBuild({ nav }: { nav: Nav }) {
  return (
    <>
      <ScreenHead eyebrow="Foundry · package" title="Assemble the bundle." lede="Clean audio and metadata, checksummed and signed, ready for delivery." />

      <span className="slabel">Bundle contents</span>
      <div className="rows" style={{ marginBottom: 16 }}>
        {BUNDLE_FILES.map((f) => (
          <div className="row" key={f.path}>
            <span className="ricon" style={{ fontSize: "0.9rem" }}>{f.ok ? "✅" : "⏳"}</span>
            <div className="rmain"><div className="rt mono" style={{ fontSize: "0.8rem", fontFamily: "var(--mono)" }}>{f.path}</div><div className="rs">{f.fmt}</div></div>
            <span className="rend">{f.size}</span>
          </div>
        ))}
      </div>

      <div className="tile" style={{ marginBottom: 16 }}>
        <div className="spread" style={{ marginBottom: 8 }}><span className="tlbl" style={{ margin: 0 }}>Format</span><span className="mono" style={{ fontSize: "0.7rem", color: "var(--acc2)" }}>WAV 24kHz · JSONL · Parquet</span></div>
        <div className="spread"><span className="tlbl" style={{ margin: 0 }}>Integrity</span><span className="mono" style={{ fontSize: "0.7rem", color: "var(--acc2)" }}>SHA-256 + PGP signed</span></div>
      </div>

      <div className="actionbar">
        <button className="pill mint" onClick={() => nav.go("delivery-receipt")}>Deliver to buyer</button>
        <div className="mono center" style={{ fontSize: "0.62rem", color: "var(--faint)", marginTop: 10 }}>Ships via presigned S3 URL over TLS 1.3</div>
      </div>
    </>
  );
}

export function ConsentAudit({ nav: _nav }: { nav: Nav }) {
  return (
    <>
      <ScreenHead eyebrow="Foundry · compliance" title="Provable consent." lede="Every speaker in every shipped dataset has a cryptographic consent event on file, hash-anchored to the exact agreements they accepted." />
      <div className="rows">
        {CONSENT_EVENTS.map((c) => (
          <div className="row" key={c.spk} style={{ alignItems: "flex-start" }}>
            <span className="ricon">🔏</span>
            <div className="rmain">
              <div className="rt mono" style={{ fontSize: "0.78rem", fontFamily: "var(--mono)" }}>{c.spk}</div>
              <div className="rs mono" style={{ fontSize: "0.64rem" }}>{c.event}</div>
              <div className="rs mono" style={{ fontSize: "0.64rem" }}>{c.ts} · terms sha256:{c.hash}</div>
            </div>
            <span className="badge ok" style={{ flex: "none" }}>active</span>
          </div>
        ))}
      </div>
      <div className="tile dash" style={{ marginTop: 14 }}>
        <div className="tlbl">Air-gapped identity</div>
        <div className="tbody muted">Speaker IDs here are cryptographic only. The mapping to real identity lives in an isolated vault that never ships with the data.</div>
      </div>
    </>
  );
}

export function DeliveryReceipt({ nav }: { nav: Nav }) {
  return (
    <>
      <ScreenHead eyebrow="Foundry · deliveries" title="Shipped." />
      <div className="rows" style={{ marginBottom: 16 }}>
        {DELIVERIES.map((d) => (
          <div className="row" key={d.id} style={{ alignItems: "flex-start" }}>
            <span className="ricon">🚚</span>
            <div className="rmain">
              <div className="rt">{d.corpus}</div>
              <div className="rs">{d.buyer} · {d.format} · {d.size}</div>
              <div className="mono" style={{ fontSize: "0.64rem", color: "var(--faint)", marginTop: 3 }}>{d.id} · {d.when}</div>
            </div>
            <span className="badge ok" style={{ flex: "none" }}>{d.status}</span>
          </div>
        ))}
      </div>

      <div className="sheet">
        <div className="handle" />
        <div className="shead"><i className="g" />Receipt · del_2026_09_02_0714</div>
        <div className="tile"><div className="tlbl">License</div><div className="tbody">Commercial · non-exclusive · perpetual · worldwide</div></div>
        <div className="tile"><div className="tlbl">Delivery</div><div className="tbody">Presigned S3 · TLS 1.3 · IP-whitelisted · 72h TTL</div></div>
        <div className="tile"><div className="tlbl">Bundle checksum</div><div className="tbody mono" style={{ fontFamily: "var(--mono)", fontSize: "0.66rem", wordBreak: "break-all" }}>b7c9e2a8f4d31c5e6b8a9d0f2e4c7b5a…</div></div>
        <button className="pill" onClick={() => nav.go("foundry-overview")}>Back to the foundry</button>
      </div>
    </>
  );
}
