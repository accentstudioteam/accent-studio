import { useState } from "react";
import type { Nav } from "@/prototype/types";
import { ScreenHead, Stepper, CheckRow } from "@/prototype/ui";
import { LOCALES, RAILS } from "@/lib/labels";
import { AGREEMENTS } from "@/prototype/mock";
import { AGREEMENTS_FULL } from "@/prototype/legal";

const ONB_STEPS = 6; // profile, id, docs, payout, training, done

export function OnbWelcome({ nav }: { nav: Nav }) {
  return (
    <>
      <div className="hero-emoji">🎛️</div>
      <ScreenHead
        eyebrow="Onboarding · one-time setup"
        title="Let's set up your booth."
        lede="Five quick steps and you're ready to play. We take compliance seriously because your voice is yours, so a couple of these are legal."
      />
      <div className="rows" style={{ marginBottom: 22 }}>
        {[
          ["👤", "Your profile", "Handle, language, region"],
          ["🪪", "Verify your identity", "A government ID and a selfie"],
          ["✍️", "Sign your agreements", "Ownership, voice release, contractor"],
          ["💸", "Set up payouts", "How you want to get paid"],
          ["🎓", "Quick training", "How the games work"],
        ].map(([ic, t, s], i) => (
          <div className="row" key={i}>
            <span className="ricon">{ic}</span>
            <div className="rmain">
              <div className="rt">{t}</div>
              <div className="rs">{s}</div>
            </div>
            <span className="rend">{i + 1}</span>
          </div>
        ))}
      </div>
      <div className="actionbar">
        <button className="pill mint" onClick={() => nav.next()}>Begin setup</button>
      </div>
    </>
  );
}

export function OnbProfile({ nav }: { nav: Nav }) {
  const [handle, setHandle] = useState("");
  const [locale, setLocale] = useState<string | null>("pcm-NG");
  const clean = handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  const ok = clean.length >= 3 && locale;
  return (
    <>
      <Stepper total={ONB_STEPS} current={0} />
      <ScreenHead eyebrow="Step 1 · profile" title="Pick your stage name." />
      <div className="field">
        <label>Handle</label>
        <input value={handle} autoCapitalize="none" spellCheck={false} placeholder="e.g. lagos_lynx" onChange={(e) => setHandle(e.target.value)} />
        <span className="mono" style={{ fontSize: "0.66rem", color: "var(--faint)" }}>
          shown to partners as {clean ? `@${clean}` : "@yourname"}
        </span>
      </div>
      <div style={{ marginBottom: 22 }}>
        <span className="slabel">Language you'll play in</span>
        <div className="opt-grid">
          {LOCALES.map((l) => (
            <button key={l.code} className={locale === l.code ? "opt on" : "opt"} onClick={() => setLocale(l.code)}>
              <span className="emoji">{l.flag}</span>
              <span className="nm">{l.name}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="actionbar">
        <button className="pill mint" disabled={!ok} onClick={() => nav.next()}>Continue</button>
      </div>
    </>
  );
}

export function KycIdIntro({ nav }: { nav: Nav }) {
  return (
    <>
      <Stepper total={ONB_STEPS} current={1} />
      <div className="hero-emoji">🪪</div>
      <ScreenHead
        eyebrow="Step 2 · identity"
        title="Verify it's really you."
        lede="We confirm your identity once, to keep the platform fraud-free and to pay the right person. Here's our promise on what happens to it."
      />
      <ul className="rlist" style={{ marginBottom: 22 }}>
        <li><span className="rico">🔒</span> Your ID lives in an isolated, encrypted vault, separate from your voice data.</li>
        <li><span className="rico">🙈</span> Buyers of the data never see it. Audio is indexed only by a random ID.</li>
        <li><span className="rico">🗑️</span> You can request deletion of identifiable data at any time.</li>
      </ul>
      <div className="tile dash" style={{ marginBottom: 22 }}>
        <div className="tlbl">Accepted documents</div>
        <div className="tbody muted">National ID card, driver's license, or international passport.</div>
      </div>
      <div className="actionbar">
        <button className="pill mint" onClick={() => nav.next()}>Continue</button>
      </div>
    </>
  );
}

export function KycIdCapture({ nav }: { nav: Nav }) {
  const [front, setFront] = useState(false);
  const [back, setBack] = useState(false);
  return (
    <>
      <Stepper total={ONB_STEPS} current={1} />
      <ScreenHead eyebrow="Step 2 · identity" title="Upload your ID." />
      <span className="slabel">Front of document</span>
      <button className={"dropzone" + (front ? " on" : "")} style={{ width: "100%", marginBottom: 16 }} onClick={() => setFront(true)}>
        <span className="ic">{front ? "✅" : "📷"}</span>
        <div className="t">{front ? "Front captured" : "Tap to capture front"}</div>
        <div className="s">{front ? "id_front.jpg · looks sharp" : "camera or upload · JPG / PNG"}</div>
      </button>
      <span className="slabel">Back of document</span>
      <button className={"dropzone" + (back ? " on" : "")} style={{ width: "100%", marginBottom: 22 }} onClick={() => setBack(true)}>
        <span className="ic">{back ? "✅" : "📷"}</span>
        <div className="t">{back ? "Back captured" : "Tap to capture back"}</div>
        <div className="s">{back ? "id_back.jpg · looks sharp" : "camera or upload · JPG / PNG"}</div>
      </button>
      <div className="actionbar">
        <button className="pill mint" disabled={!front || !back} onClick={() => nav.next()}>Continue to selfie</button>
      </div>
    </>
  );
}

export function KycSelfie({ nav }: { nav: Nav }) {
  const [done, setDone] = useState(false);
  return (
    <>
      <Stepper total={ONB_STEPS} current={1} />
      <ScreenHead eyebrow="Step 2 · identity" title="Now a quick selfie." lede="We match your face to your ID to confirm you're the document holder. Look straight at the camera." />
      <div className="full-center" style={{ minHeight: 260, padding: 0, marginBottom: 22 }}>
        <button
          className={"dropzone" + (done ? " on" : "")}
          style={{ width: 200, height: 200, borderRadius: "50%", display: "grid", placeItems: "center" }}
          onClick={() => setDone(true)}
        >
          <div>
            <span className="ic" style={{ fontSize: "2.4rem" }}>{done ? "✅" : "🤳"}</span>
            <div className="s">{done ? "liveness ok" : "tap to scan"}</div>
          </div>
        </button>
      </div>
      <div className="actionbar">
        <button className="pill mint" disabled={!done} onClick={() => nav.next()}>Submit for review</button>
      </div>
    </>
  );
}

export function KycReview({ nav }: { nav: Nav }) {
  return (
    <>
      <Stepper total={ONB_STEPS} current={1} />
      <div className="hero-emoji">🔎</div>
      <ScreenHead eyebrow="Step 2 · identity" title="Verified." lede="In the real product this can take a few minutes. Here's the state you'll see." />
      <div className="rows" style={{ marginBottom: 22 }}>
        <div className="row"><span className="ricon">🪪</span><div className="rmain"><div className="rt">Document check</div><div className="rs">ID authentic, not expired</div></div><span className="badge ok">passed</span></div>
        <div className="row"><span className="ricon">🤳</span><div className="rmain"><div className="rt">Face match</div><div className="rs">Selfie matches ID</div></div><span className="badge ok">passed</span></div>
        <div className="row"><span className="ricon">🌍</span><div className="rmain"><div className="rt">Sanctions screen</div><div className="rs">No flags</div></div><span className="badge ok">passed</span></div>
      </div>
      <div className="actionbar">
        <button className="pill mint" onClick={() => nav.next()}>Continue to agreements</button>
      </div>
    </>
  );
}

export function DocsOverview({ nav }: { nav: Nav }) {
  return (
    <>
      <Stepper total={ONB_STEPS} current={2} />
      <div className="hero-emoji">✍️</div>
      <ScreenHead
        eyebrow="Step 3 · agreements"
        title="The paperwork, in plain sight."
        lede="Three short agreements. We show the full text, and log your acceptance cryptographically so it's provable and fair to both sides."
      />
      <div className="rows" style={{ marginBottom: 22 }}>
        {AGREEMENTS.map((a) => (
          <div className="row" key={a.id}>
            <span className="ricon">📄</span>
            <div className="rmain">
              <div className="rt">{a.name}</div>
              <div className="rs">{a.summary}</div>
            </div>
            <span className="badge pending">unsigned</span>
          </div>
        ))}
      </div>
      <div className="actionbar">
        <button className="pill mint" onClick={() => nav.next()}>Review &amp; sign</button>
      </div>
    </>
  );
}

export function DocSign({ nav }: { nav: Nav }) {
  const [docIdx, setDocIdx] = useState(0);
  // track which agreements have been scrolled to the end
  const [readSet, setReadSet] = useState<Set<number>>(new Set());
  const [agree, setAgree] = useState(false);
  const [assign, setAssign] = useState(false);

  const doc = AGREEMENTS_FULL[docIdx];
  const allRead = readSet.size === AGREEMENTS_FULL.length;
  const ready = allRead && agree && assign;

  function markRead(i: number) {
    setReadSet((prev) => {
      if (prev.has(i)) return prev;
      const n = new Set(prev);
      n.add(i);
      return n;
    });
  }

  return (
    <>
      <div className="eyebrow" style={{ marginBottom: 8 }}>Agreements · read all {AGREEMENTS_FULL.length}</div>
      <h1 className="h1" style={{ marginBottom: 14, fontSize: "clamp(1.4rem,5.5vw,2rem)" }}>
        {doc.name}.
      </h1>

      <div className="amode" style={{ display: "flex", marginBottom: 14, width: "100%" }}>
        {AGREEMENTS_FULL.map((a, i) => (
          <button
            key={a.id}
            className={i === docIdx ? "on" : ""}
            style={{ flex: 1, fontSize: "0.56rem", padding: "8px 4px" }}
            onClick={() => setDocIdx(i)}
          >
            {readSet.has(i) ? "✓ " : ""}{a.name.split(" ")[0]}
          </button>
        ))}
      </div>

      <div
        className="doc"
        style={{ marginBottom: 12, maxHeight: 320 }}
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.scrollTop + el.clientHeight >= el.scrollHeight - 28) markRead(docIdx);
        }}
      >
        <div className="mono" style={{ fontSize: "0.62rem", color: "var(--faint)", marginBottom: 10 }}>
          {doc.name} · {doc.version} · effective {doc.effective}
        </div>
        {doc.sections.map((c) => (
          <div key={c.h}>
            <h5 className="clause">{c.h}</h5>
            <p>{c.body}</p>
          </div>
        ))}
        <p className="muted" style={{ fontSize: "0.74rem", marginTop: 12 }}>
          End of {doc.name}. A countersigned copy is stored in your account under
          My Documents with its content hash.
        </p>
      </div>

      <div className="mono" style={{ fontSize: "0.64rem", color: allRead ? "var(--acc2)" : "var(--faint)", marginBottom: 14 }}>
        {allRead
          ? "✓ All three read in full."
          : `Read to the end of each · ${readSet.size} of ${AGREEMENTS_FULL.length} done` +
            (readSet.has(docIdx) ? "" : " · scroll this one to the end")}
      </div>

      <div className="stack" style={{ marginBottom: 18 }}>
        <CheckRow checked={agree} onToggle={() => setAgree(!agree)}>
          I have read and accept all three agreements: the Voice IP Assignment
          Agreement (v1.2), the Voice Likeness &amp; Audio Release (v1.1), and the
          Independent Contractor Agreement (v1.0).
        </CheckRow>
        <CheckRow checked={assign} onToggle={() => setAssign(!assign)}>
          I irrevocably assign ownership of my recordings and roleplay content to
          Accent Studio, Inc., I consent to the processing of my voice as biometric
          data, and I confirm I am 18 or older.
        </CheckRow>
      </div>

      <div className="tile dash" style={{ marginBottom: 18 }}>
        <div className="tlbl">Cryptographic consent event recorded on accept</div>
        <pre style={{ background: "transparent", border: "none", padding: 0, margin: 0, fontSize: "0.64rem", color: "var(--mut)" }}>{`{ consent_event: "CREATOR_AGREEMENTS_2026_09",
  agreements: ["ip_assignment@v1.2",
    "voice_release@v1.1", "contractor@v1.0"],
  timestamp_utc: "…", ip_hash: "sha256:…",
  terms_hash: "sha256:e3b0c442…",
  action: "CHECKBOX_AND_RECORD_BUTTON" }`}</pre>
      </div>

      <div className="actionbar">
        <button className="pill mint" disabled={!ready} onClick={() => nav.next()}>
          {ready ? "Accept & sign all three" : !allRead ? "Read every agreement first" : "Tick both boxes to sign"}
        </button>
        <div className="mono center" style={{ fontSize: "0.62rem", color: "var(--faint)", marginTop: 10 }}>
          One cryptographic consent event covers all three agreements.
        </div>
      </div>
    </>
  );
}

export function DocsComplete({ nav }: { nav: Nav }) {
  return (
    <>
      <Stepper total={ONB_STEPS} current={2} />
      <div className="hero-emoji">🖋️</div>
      <ScreenHead eyebrow="Step 3 · agreements" title="Signed and logged." />
      <div className="rows" style={{ marginBottom: 22 }}>
        {AGREEMENTS.map((a) => (
          <div className="row" key={a.id}>
            <span className="ricon">📄</span>
            <div className="rmain">
              <div className="rt">{a.name}</div>
              <div className="rs mono" style={{ fontSize: "0.68rem" }}>sha256:e3b0c442… · {new Date().toISOString().slice(0, 10)}</div>
            </div>
            <span className="badge ok">signed</span>
          </div>
        ))}
      </div>
      <div className="actionbar">
        <button className="pill mint" onClick={() => nav.next()}>Set up payouts</button>
      </div>
    </>
  );
}

export function PayoutSetup({ nav }: { nav: Nav }) {
  const [rail, setRail] = useState<string | null>(null);
  const [detail, setDetail] = useState("");
  const ok = rail && detail.trim();
  return (
    <>
      <Stepper total={ONB_STEPS} current={3} />
      <ScreenHead eyebrow="Step 4 · payouts" title="How do you want to get paid?" lede="You can change this anytime. We only pay to a method in your own name." />
      <div style={{ marginBottom: 18 }}>
        <span className="slabel">Payout method</span>
        <div className="opt-grid">
          {RAILS.map((r) => (
            <button key={r.code} className={rail === r.code ? "opt on" : "opt"} onClick={() => setRail(r.code)}>
              <span className="nm">{r.name}</span>
              <span className="sub">{r.min}</span>
            </button>
          ))}
        </div>
      </div>
      {rail && (
        <div className="field">
          <label>
            {rail === "mpesa" ? "M-Pesa phone number"
              : rail === "usdc" ? "Wallet address"
              : rail === "paystack" || rail === "flutterwave" ? "Bank account / phone"
              : "Account email"}
          </label>
          <input value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Enter details" />
        </div>
      )}
      <div className="tile dash" style={{ marginTop: 8, marginBottom: 22 }}>
        <div className="tlbl">Note</div>
        <div className="tbody muted">You earn Accent Points (AP) as you play. Cash out to real money once you pass your rail's minimum.</div>
      </div>
      <div className="actionbar">
        <button className="pill mint" disabled={!ok} onClick={() => nav.next()}>Continue</button>
      </div>
    </>
  );
}

export function TrainingIntro({ nav }: { nav: Nav }) {
  const cards = [
    { ic: "🏓", t: "Volley", s: "Say an English prompt in your language. A partner rates your take. Score under 4 and you say it again." },
    { ic: "🎭", t: "The Arena", s: "Improvise a live scene with a stranger. A curveball drops mid-scene. A meter fills as it flows." },
    { ic: "✎", t: "The Cutting Room", s: "Later, you'll fix transcripts of others' takes and earn for every correction." },
  ];
  return (
    <>
      <Stepper total={ONB_STEPS} current={4} />
      <div className="hero-emoji">🎓</div>
      <ScreenHead eyebrow="Step 5 · training" title="How the games work." />
      <div className="stack" style={{ marginBottom: 22 }}>
        {cards.map((c) => (
          <div className="sheet" key={c.t}>
            <div className="handle" />
            <div className="shead"><i />{c.t}</div>
            <div className="tile">
              <div className="ttitle" style={{ marginBottom: 6 }}><span style={{ marginRight: 8 }}>{c.ic}</span>{c.t}</div>
              <div className="tbody muted">{c.s}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="actionbar">
        <button className="pill mint" onClick={() => nav.next()}>I've got it</button>
      </div>
    </>
  );
}

export function OnbComplete({ nav }: { nav: Nav }) {
  return (
    <div className="full-center" style={{ minHeight: "72vh" }}>
      <div className="center" style={{ maxWidth: 360 }}>
        <div className="hero-emoji">🎙️</div>
        <div className="badge ok" style={{ marginBottom: 14 }}>● Booth ready</div>
        <h1 className="h1" style={{ marginBottom: 12 }}>You're all set.</h1>
        <p className="muted" style={{ marginBottom: 24, fontSize: "0.95rem" }}>
          Identity verified, agreements signed, payouts ready. Time to play your
          first scene and start earning.
        </p>
        <button className="pill mint" onClick={() => nav.go("home")}>
          Enter the studio
        </button>
        <button className="pill ghost" style={{ marginTop: 10 }} onClick={() => nav.openIndex()}>
          Jump to any screen
        </button>
      </div>
    </div>
  );
}
