import { useState } from "react";
import type { Nav } from "@/prototype/types";
import { ScreenHead, Stepper } from "@/prototype/ui";
import { LOCALES } from "@/lib/labels";

const STEPS = 4;

export function ApplyIntro({ nav }: { nav: Nav }) {
  return (
    <>
      <div className="hero-emoji">🎙️</div>
      <ScreenHead
        eyebrow="Apply · join the cast"
        title="Get paid to teach AI your language."
        lede="Accent Studio is a voice game. You improvise short scenes in your own language, and get paid per verified hour. First, a quick application and a short interview."
      />

      <span className="slabel">What we're looking for</span>
      <ul className="rlist" style={{ marginBottom: 22 }}>
        <li><span className="rico">✓</span> You speak one of our languages natively</li>
        <li><span className="rico">✓</span> A phone with a working mic, in a quiet room</li>
        <li><span className="rico">✓</span> You can act a little — play a character, have fun</li>
        <li><span className="rico">✓</span> You're 18 or older</li>
      </ul>

      <div className="sheet" style={{ marginBottom: 22 }}>
        <div className="handle" />
        <div className="shead"><i className="g" />What you earn</div>
        <div className="tile">
          <div className="tlbl">Per verified hour of audio</div>
          <div className="bignum gold" style={{ marginTop: 4 }}>$7.20–$30</div>
          <div className="tbody muted" style={{ marginTop: 8 }}>
            Scaled by your language's demand and a peer-quality multiplier.
            Cash out to M-Pesa, Paystack, PayPal or USDC.
          </div>
        </div>
      </div>

      <div className="actionbar">
        <button className="pill mint" onClick={() => nav.next()}>
          Start application
        </button>
      </div>
    </>
  );
}

export function ApplyForm({ nav }: { nav: Nav }) {
  const [locale, setLocale] = useState<string | null>(null);
  const [region, setRegion] = useState("");
  const [age, setAge] = useState<string | null>(null);
  const [gender, setGender] = useState<string | null>(null);
  const ok = locale && region.trim() && age && gender;

  return (
    <>
      <Stepper total={STEPS} current={0} />
      <ScreenHead eyebrow="Application · 1 of 4" title="Tell us about your voice." />

      <div style={{ marginBottom: 18 }}>
        <span className="slabel">Native language you'll play in</span>
        <div className="opt-grid">
          {LOCALES.map((l) => (
            <button
              key={l.code}
              className={locale === l.code ? "opt on" : "opt"}
              onClick={() => setLocale(l.code)}
            >
              <span className="emoji">{l.flag}</span>
              <span className="nm">{l.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>City / accent region</label>
        <input placeholder="e.g. Lagos, Nairobi, Kano" value={region} onChange={(e) => setRegion(e.target.value)} />
      </div>

      <div style={{ marginBottom: 18 }}>
        <span className="slabel">Age band</span>
        <div className="opt-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
          {["18–24", "25–34", "35–44", "45–54", "55–64", "65+"].map((a) => (
            <button key={a} className={age === a ? "opt on" : "opt"} onClick={() => setAge(a)}>
              <span className="nm" style={{ fontSize: "0.85rem" }}>{a}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 22 }}>
        <span className="slabel">Gender</span>
        <div className="opt-grid">
          {["Female", "Male", "Non-binary", "Prefer not to say"].map((g) => (
            <button key={g} className={gender === g ? "opt on" : "opt"} onClick={() => setGender(g)}>
              <span className="nm" style={{ fontSize: "0.85rem" }}>{g}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="actionbar">
        <button className="pill mint" disabled={!ok} onClick={() => nav.next()}>
          Continue
        </button>
      </div>
    </>
  );
}

export function ApplyVoiceSample({ nav }: { nav: Nav }) {
  const [state, setState] = useState<"idle" | "rec" | "done">("idle");
  return (
    <>
      <Stepper total={STEPS} current={1} />
      <ScreenHead
        eyebrow="Application · 2 of 4"
        title="Record a short intro."
        lede="Say hello and tell us why you want to join, in your own language. 15–30 seconds. This is how we hear your voice quality."
      />

      <div className="sheet" style={{ marginBottom: 22 }}>
        <div className="handle" />
        <div className="shead"><i />Voice sample</div>
        <div className="tile" style={{ paddingTop: 20, paddingBottom: 20 }}>
          <div className="recwrap">
            <button
              className={"recbtn" + (state === "rec" ? " rec" : "")}
              onClick={() => setState(state === "rec" ? "done" : "rec")}
            >
              <span className="core" />
            </button>
            <div className="rectime">
              {state === "idle" ? "Tap to record" : state === "rec" ? "00:08 · recording…" : "00:22 · captured"}
            </div>
          </div>
        </div>
        {state === "done" && (
          <div className="tile">
            <div className="wv">
              {[55, 32, 78, 44, 68, 88, 52, 72, 38, 58, 48, 34, 64, 40, 60, 30].map((h, i) => (
                <i key={i} style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="actionbar btn-row">
        {state === "done" && (
          <button className="pill ghost" onClick={() => setState("idle")}>Re-record</button>
        )}
        <button className="pill mint" disabled={state !== "done"} onClick={() => nav.next()}>
          Continue
        </button>
      </div>
    </>
  );
}

export function ApplyMotivation({ nav }: { nav: Nav }) {
  const [why, setWhy] = useState("");
  const [ref, setRef] = useState("");
  return (
    <>
      <Stepper total={STEPS} current={2} />
      <ScreenHead eyebrow="Application · 3 of 4" title="A couple of quick questions." />

      <div className="field">
        <label>Why do you want to join? (optional)</label>
        <input placeholder="A sentence is plenty" value={why} onChange={(e) => setWhy(e.target.value)} />
      </div>
      <div className="field">
        <label>How did you hear about us? (optional)</label>
        <input placeholder="Friend, X, WhatsApp, Discord…" value={ref} onChange={(e) => setRef(e.target.value)} />
      </div>

      <div className="cbx" style={{ marginTop: 8 }} />
      <div className="tile dash" style={{ marginTop: 8, marginBottom: 22 }}>
        <div className="tlbl">Heads up</div>
        <div className="tbody muted">
          After you apply, we review your voice sample and invite you to a short
          voice interview. Most reviews take under 48 hours.
        </div>
      </div>

      <div className="actionbar">
        <button className="pill mint" onClick={() => nav.next()}>
          Submit application
        </button>
      </div>
    </>
  );
}

export function ApplySubmitted({ nav }: { nav: Nav }) {
  return (
    <div className="full-center" style={{ minHeight: "70vh" }}>
      <div className="center" style={{ maxWidth: 360 }}>
        <div className="hero-emoji">📨</div>
        <h1 className="h1" style={{ marginBottom: 12 }}>Application in.</h1>
        <p className="muted" style={{ marginBottom: 8, fontSize: "0.95rem" }}>
          We're reviewing your voice sample now. You'll get an email and an
          in-app nudge when your interview is ready, usually within 48 hours.
        </p>
        <div className="badge pending" style={{ margin: "16px 0 24px" }}>
          ● Under review
        </div>
        <button className="pill mint" onClick={() => nav.next()}>
          See the interview step
        </button>
        <button className="pill ghost" style={{ marginTop: 10 }} onClick={() => nav.openIndex()}>
          Jump to any screen
        </button>
      </div>
    </div>
  );
}
