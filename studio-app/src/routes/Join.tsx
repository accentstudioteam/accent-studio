import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/auth/AuthProvider";
import { Logo } from "@/components/Logo";
import { CheckRow, ScreenHead, Stepper } from "@/prototype/ui";
import type { Onboarding as OnboardingState } from "@/lib/types";

const LANG: Record<string, string> = { pcm: "Nigerian Pidgin", yo: "Yoruba", ha: "Hausa", ig: "Igbo", sw: "Swahili", zu: "Zulu", en: "English" };
const STEPS = 3;

interface Preview {
  first_name: string;
  email_masked: string;
  email: string;
  language: string;
  project_name: string | null;
  expires_at: string;
  accepted: boolean;
  expired: boolean;
}

function readToken(): string | null {
  const t = new URLSearchParams(window.location.search).get("i");
  if (t && /^[0-9a-f]{48}$/.test(t)) {
    try {
      sessionStorage.setItem("join_token", t);
    } catch {
      // ignore
    }
    return t;
  }
  try {
    return sessionStorage.getItem("join_token");
  } catch {
    return null;
  }
}

function Problem({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <div className="tile" style={{ borderColor: "var(--coral)", marginBottom: 14 }}>
      <div className="tbody" style={{ color: "var(--coral)" }}>{text}</div>
    </div>
  );
}

/** Invitation → sign in by email → sign the agreement → in the cast. */
export function Join() {
  const { session, signOut } = useAuth();
  const [token] = useState(readToken);
  const [preview, setPreview] = useState<Preview | null | "none">(null);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [state, setState] = useState<OnboardingState | null>(null);
  const [terms, setTerms] = useState(false);
  const [biometric, setBiometric] = useState(false);
  const [signed, setSigned] = useState<{ speaker_id: string; record_sha256: string; signed_at: string; agreement_version: string } | null>(null);

  useEffect(() => {
    document.title = "Join the cast · Accent Studio";
  }, []);

  // Invitation preview before sign-in.
  useEffect(() => {
    if (!token) {
      setPreview("none");
      return;
    }
    supabase.rpc("invitation_preview", { t: token }).then(({ data }) => {
      if (data) {
        setPreview(data as Preview);
        setEmail((data as Preview).email ?? "");
      } else setPreview("none");
    });
  }, [token]);

  // After sign-in: where are we?
  useEffect(() => {
    if (!session) return;
    supabase.rpc("my_onboarding").then(({ data, error }) => {
      if (error) setProblem("Couldn't load your invitation. Refresh the page.");
      else setState(data as OnboardingState);
    });
  }, [session]);

  const sendLink = async () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setProblem("That email doesn't look right.");
    setBusy(true);
    setProblem(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}/studio/join${token ? `?i=${token}` : ""}` },
    });
    setBusy(false);
    if (error) setProblem(error.message);
    else setSent(true);
  };

  const sign = async () => {
    if (!terms || !biometric) return setProblem("Tick both boxes to sign.");
    setBusy(true);
    setProblem(null);
    const { data, error } = await supabase.functions.invoke("sign-agreement", { body: { accepted_terms: true, biometric_consent: true } });
    setBusy(false);
    if (error || !data?.ok) {
      setProblem((data as { error?: string } | null)?.error ?? "Signing didn't go through. Try again in a moment.");
      return;
    }
    setSigned(data as typeof signed);
  };

  const agreement = state?.agreement;
  const consent = state?.consent ?? null;
  const contributor = state?.contributor ?? null;

  // ---------- Signed (now or earlier) ----------
  if (session && (signed || (consent && !consent.withdrawn_at))) {
    const rec = signed ?? { speaker_id: contributor?.speaker_id ?? "", record_sha256: consent!.record_sha256, signed_at: consent!.signed_at, agreement_version: consent!.agreement_version };
    return (
      <div className="app">
        <div className="topbar"><Logo height={22} /><span className="eyebrow">Cast</span></div>
        <div className="shell">
          <Stepper total={STEPS} current={2} />
          <ScreenHead eyebrow="Signed" title="You're in the cast." lede="Your consent record exists from this moment. We've emailed you a copy. Next comes a short recorded interview with a linguist in your language; we'll email you when it's scheduled." />
          <div className="sheet" style={{ marginBottom: 22 }}>
            <div className="handle" />
            <div className="shead"><i />Your record</div>
            <div className="tile"><div className="tlbl">Speaker ID · what datasets carry instead of your name</div><div className="ttitle mono" style={{ fontFamily: "var(--mono)" }}>{rec.speaker_id}</div></div>
            <div className="tile"><div className="tlbl">Consent record fingerprint · SHA-256</div><div className="tbody" style={{ fontFamily: "var(--mono)", fontSize: "0.72rem", color: "var(--acc)", wordBreak: "break-all" }}>{rec.record_sha256}</div></div>
            <div className="tile"><div className="tlbl">Agreement</div><div className="tbody">Version {rec.agreement_version} · signed {new Date(rec.signed_at).toUTCString()}</div>{agreement && <a href={agreement.url} style={{ color: "var(--acc)", fontSize: "0.9rem" }}>Download the agreement you signed</a>}</div>
          </div>
          <div className="tile" style={{ marginBottom: 18 }}>
            <div className="tlbl">Changing your mind</div>
            <div className="tbody muted">Withdraw at any time under Settings, or email privacy@accentstudio.io. Undelivered recordings are deleted within 30 days. Verified earnings are never cancelled.</div>
          </div>
          <button className="pill ghost" onClick={() => void signOut()}>Sign out</button>
        </div>
      </div>
    );
  }

  // ---------- Signed in, invited, not yet signed ----------
  if (session && state) {
    if (!state.invited) {
      return (
        <div className="full-center">
          <div style={{ width: "100%", maxWidth: 380 }} className="center">
            <div style={{ fontSize: "2rem", marginBottom: 14 }}>✉️</div>
            <h1 className="h1" style={{ marginBottom: 12 }}>No open invitation.</h1>
            <p className="muted" style={{ marginBottom: 24, fontSize: "0.95rem" }}>
              You're signed in as {session.user.email}, but there's no current invitation for that address. Invitations are sent to the email you applied with and last 14 days. Write to hello@accentstudio.io if you think this is wrong.
            </p>
            <button className="pill ghost" onClick={() => void signOut()}>Sign out</button>
          </div>
        </div>
      );
    }
    const inv = state.invitation;
    const lang = inv?.primary_language ? LANG[inv.primary_language] ?? inv.primary_language : "your language";
    return (
      <div className="app">
        <div className="topbar"><Logo height={22} /><span className="eyebrow">Join the cast</span></div>
        <div className="shell">
          <Stepper total={STEPS} current={1} />
          <ScreenHead eyebrow="Step 2 of 3 · the agreement" title={`Read it, then sign it, ${inv?.full_name?.split(" ")[0] ?? "friend"}.`} lede={`This is the whole deal for playing in ${lang}${inv?.project_name ? ` on ${inv.project_name}` : ""}. Plain language first, the full text behind the link. Nothing here is hidden from you.`} />

          <div className="sheet" style={{ marginBottom: 18 }}>
            <div className="handle" />
            <div className="shead"><i />The short version</div>
            <div className="tile"><div className="tlbl">What you give</div><div className="tbody">Voice recordings you make in the app, plus your language, region, age band and self-described gender. Your name is never attached to any recording.</div></div>
            <div className="tile"><div className="tlbl">Who hears you</div><div className="tbody">The partner you're paired with listens to your takes inside the app, to rate and reply, and never gets your name, contact details or a copy. They may not download, keep or sell your voice, and you promise the same about theirs. Our trained linguists listen to verify transcripts.</div></div>
            <div className="tile"><div className="tlbl">What buyers may never do</div><div className="tbody">Identify you, clone your individual voice, verify identity with it, surveil anyone, or pass the raw data on. Every licence we sign says so.</div></div>
            <div className="tile"><div className="tlbl">Money</div><div className="tbody">A published base rate per speaker per verified hour, shown before each session, then a quality multiplier after verification. A good-faith session never pays zero. Statements monthly, payout within 14 days of a request.</div></div>
            <div className="tile"><div className="tlbl">Honest play</div><div className="tbody">Your own live voice, honest ratings. If a session is questioned, a person reviews it, you're told and can respond within 7 days, and only the sessions involved can lose pay.</div></div>
            <div className="tile"><div className="tlbl">Changing your mind</div><div className="tbody">Withdraw any time, in the app or by email. New use stops, undelivered recordings are deleted within 30 days. You keep every right in your voice; you grant us a non-exclusive licence.</div></div>
            <div className="tile acc">
              <div className="tlbl">The full text</div>
              <div className="tbody">
                {agreement ? (
                  <>
                    <a href={agreement.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--acc)", fontWeight: 600 }}>Contributor Agreement v{agreement.version} (PDF, 11 pages)</a>
                    <div className="muted" style={{ fontSize: "0.72rem", fontFamily: "var(--mono)", marginTop: 6, wordBreak: "break-all" }}>Document {agreement.document_id} · SHA-256 {agreement.sha256}</div>
                  </>
                ) : (
                  "Loading the current version…"
                )}
              </div>
            </div>
          </div>

          <div className="sheet" style={{ marginBottom: 18 }}>
            <div className="handle" />
            <div className="shead"><i />Electronic signature</div>
            <CheckRow checked={terms} onToggle={() => setTerms((v) => !v)}>I have read this agreement and I accept it.</CheckRow>
            <CheckRow checked={biometric} onToggle={() => setBiometric((v) => !v)}>I give my explicit consent to the processing of my voice recordings as biometric data, as described in clause 4.</CheckRow>
            <div className="tbody muted" style={{ fontSize: "0.8rem" }}>Signing as {session.user.email}. Your identity was confirmed by the one-time link we emailed you. Tapping Sign creates a timestamped consent record; its fingerprint is emailed to you and written into every session you record.</div>
          </div>
          <Problem text={problem} />
          <div className="actionbar btn-row">
            <button className="pill ghost" onClick={() => void signOut()}>Not now</button>
            <button className="pill mint" disabled={!terms || !biometric || busy} onClick={() => void sign()}>{busy ? "Signing…" : "Sign the agreement"}</button>
          </div>
        </div>
      </div>
    );
  }

  if (session && !state) {
    return (
      <div className="full-center"><div className="spin" /></div>
    );
  }

  // ---------- Not signed in: invitation preview and email link ----------
  if (preview === null) return <div className="full-center"><div className="spin" /></div>;
  const p = preview === "none" ? null : preview;
  return (
    <div className="app">
      <div className="topbar"><Logo height={22} /><span className="eyebrow">Join the cast</span></div>
      <div className="shell">
        <Stepper total={STEPS} current={0} />
        {p && !p.expired && !p.accepted ? (
          <ScreenHead eyebrow="Step 1 of 3 · sign in" title={`Welcome, ${p.first_name}.`} lede={`You're invited to play in ${LANG[p.language] ?? p.language}${p.project_name ? ` on ${p.project_name}` : ""}. First, confirm it's you: we'll email a one-time sign-in link to ${p.email_masked}.`} />
        ) : p && p.accepted ? (
          <ScreenHead eyebrow="Invitation" title="Already accepted." lede="This invitation has been used. Sign in with the same email to see your record." />
        ) : p && p.expired ? (
          <ScreenHead eyebrow="Invitation" title="This invitation has expired." lede="Invitations last 14 days. Write to hello@accentstudio.io and we'll send a fresh one." />
        ) : (
          <ScreenHead eyebrow="Step 1 of 3 · sign in" title="Join the cast." lede="Enter the email you applied with. If there's an open invitation for it, the sign-in link takes you straight to the agreement." />
        )}
        {sent ? (
          <div className="tile" style={{ borderColor: "var(--acc)" }}>
            <div className="tlbl">Check your inbox</div>
            <div className="tbody">We sent a one-time sign-in link to <b>{email}</b>. Open it on this phone. It expires in an hour.</div>
          </div>
        ) : (
          <>
            <div className="field">
              <label htmlFor="jemail">Email you applied with</label>
              <input id="jemail" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <Problem text={problem} />
            <div className="actionbar">
              <button className="pill mint" disabled={busy} onClick={() => void sendLink()}>{busy ? "Sending…" : "Email me the sign-in link"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
