import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/auth/AuthProvider";
import { Logo } from "@/components/Logo";
import type { Onboarding as OnboardingState } from "@/lib/types";
import { Notice, Page } from "@/components/ankara-ui";

const LANG: Record<string, string> = { pcm: "Nigerian Pidgin", yo: "Yoruba", ha: "Hausa", ig: "Igbo", sw: "Swahili", zu: "Zulu", en: "English" };
const STEPS = 3;

/** The three clauses that get initialled. A mirror of CLAUSES in the
 *  sign-agreement edge function, which owns the canonical wording and writes it
 *  into the consent record: change both together, and bump a clause's version
 *  there when its wording changes. Three deliberate marks, not a dozen. */
const CLAUSES = [
  {
    id: "biometric",
    clause: "4",
    heading: "Your voice as biometric data",
    text:
      "I give my explicit consent to Accent Studio recording my voice and processing it as biometric data, for the purposes set out in clause 4 of the Contributor Agreement.",
  },
  {
    id: "buyer_limits",
    clause: "5",
    heading: "What buyers may never do",
    text:
      "I have read clause 5: buyers may never identify me, clone my individual voice, use my voice to verify identity, surveil anyone, or pass the raw data on. Every licence Accent Studio signs says so.",
  },
  {
    id: "withdrawal",
    clause: "6",
    heading: "Your right to withdraw",
    text:
      "I understand that I may withdraw my consent at any time under clause 6, that new use stops and undelivered recordings are deleted within 30 days, that deliveries already made to a buyer are covered by clause 6, and that verified earnings are still paid.",
  },
] as const;

/** Same rules the edge function applies, so the button tells the truth. */
const tidyName = (s: string) => s.replace(/\s+/g, " ").trim();
const nameOk = (s: string) => {
  const n = tidyName(s);
  return n.length >= 2 && n.length <= 120 && /\p{L}/u.test(n);
};
const tidyInitials = (s: string) => s.replace(/\s+/g, " ").trim().toUpperCase();
const initialsOk = (s: string) => /^\p{L}[\p{L}.\-' ]{1,5}$/u.test(tidyInitials(s));

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

/* ============================================================================
   Joining the cast, in the approved "Ankara Blocks" direction.

   The three steps are the prototype's .pips, the short version is a stack of
   .card blocks and the signature is a .checkrow each. invitation_preview,
   signInWithOtp, my_onboarding and the sign-agreement function are called in
   exactly the same order, with the same guards.
   ========================================================================= */

/** The prototype's .pips, standing in for the old Midnight stepper. */
function Steps({ current }: { current: number }) {
  return (
    <div className="pips" role="img" aria-label={`Step ${current + 1} of ${STEPS}`} style={{ marginTop: 14 }}>
      {Array.from({ length: STEPS }).map((_, i) => (
        <span key={i} className={`pip${i < current ? " ok done" : i === current ? " cur" : ""}`} />
      ))}
    </div>
  );
}

function Tick({ checked, onToggle, children }: { checked: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} className={`checkrow${checked ? " on" : ""}`} onClick={onToggle}>
      <span className="box" aria-hidden="true">{checked ? "✓" : ""}</span>
      <span className="lbl">{children}</span>
    </button>
  );
}

function Head({ eyebrow, title, lede }: { eyebrow?: string; title: string; lede?: string }) {
  return (
    <>
      {eyebrow && <div className="lab muted" style={{ marginTop: 14 }}>{eyebrow}</div>}
      <h2 className="pg">{title}</h2>
      {lede && <p className="note-p">{lede}</p>}
    </>
  );
}

/** What the signer hands the sign-agreement function. */
export interface SignaturePayload {
  legal_name: string;
  name_attested: true;
  initials: Record<string, string>;
}

/* ----------------------------------------------------------------------------
   The signing act.

   Not two reflexive ticks: the person reads their legal name back, corrects it
   if we got it wrong, says in so many words that it is real, and puts their
   initials against the three clauses that carry weight. Built from the .field,
   .checkrow and .card pad recipes already in the stylesheet.
   ------------------------------------------------------------------------- */
export function Signature({ applicationName, email, busy, problem, onSign, onProblem, onCancel }: {
  applicationName: string | null;
  email: string;
  busy: boolean;
  problem: string | null;
  onSign: (payload: SignaturePayload) => void;
  onProblem: (message: string) => void;
  onCancel: () => void;
}) {
  const [legalName, setLegalName] = useState("");
  const [attested, setAttested] = useState(false);
  const [initials, setInitials] = useState<Record<string, string>>({});
  const prefilled = useRef(false);

  // They gave us the name when they applied; show it rather than ask again.
  useEffect(() => {
    if (prefilled.current || !applicationName) return;
    prefilled.current = true;
    setLegalName(applicationName);
  }, [applicationName]);

  const submit = () => {
    if (!nameOk(legalName)) return onProblem("Type your full legal name as it appears on your documents.");
    if (!attested) return onProblem("Confirm that the name you typed is your real legal name.");
    const missing = CLAUSES.find((c) => !initialsOk(initials[c.id] ?? ""));
    if (missing) return onProblem(`Put your initials against clause ${missing.clause}: ${missing.heading.toLowerCase()}.`);
    onSign({
      legal_name: tidyName(legalName),
      name_attested: true,
      initials: Object.fromEntries(CLAUSES.map((c) => [c.id, tidyInitials(initials[c.id] ?? "")])),
    });
  };

  return (
    <>
      <div className="sec-h"><h3>Sign it</h3></div>
      <div className="field">
        <label htmlFor="legal-name">Your full legal name</label>
        <input
          id="legal-name"
          type="text"
          autoComplete="name"
          spellCheck={false}
          maxLength={120}
          value={legalName}
          onChange={(e) => setLegalName(e.target.value)}
          placeholder="As it appears on your documents"
        />
        <span className="hint">Taken from your application. Change it if we have it wrong.</span>
      </div>
      <div className="stack" style={{ marginTop: 12 }}>
        <Tick checked={attested} onToggle={() => setAttested((v) => !v)}>
          The name above is my real legal name, and I am signing this agreement myself.
        </Tick>
      </div>
      <p className="note-p">We take your word for this; nothing here checks your name against an ID document. If we ever turn identity checks on, they happen once, before your first payout, and never on a recording.</p>

      <div className="sec-h"><h3>Initial the three that matter</h3></div>
      <p className="note-p" style={{ marginTop: 0 }}>Three clauses, because these three are the ones that decide what happens to your voice. Your initials go in the record against the exact words below.</p>
      <div className="stack" style={{ marginTop: 12 }}>
        {CLAUSES.map((c) => (
          <div key={c.id} className="card pad">
            <div className="eyebrow">Clause {c.clause} · {c.heading}</div>
            <p>{c.text}</p>
            <div className="field" style={{ marginTop: 12, maxWidth: 160 }}>
              <label htmlFor={`initials-${c.id}`}>Your initials</label>
              <input
                id={`initials-${c.id}`}
                type="text"
                inputMode="text"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={6}
                value={initials[c.id] ?? ""}
                onChange={(e) => setInitials((v) => ({ ...v, [c.id]: e.target.value }))}
                placeholder="e.g. AO"
                style={{ textTransform: "uppercase" }}
              />
            </div>
          </div>
        ))}
      </div>

      <p className="note-p">Signing as {email}. The one-time link we emailed confirmed the inbox; the name and the initials above are the signature. Tapping Sign writes a timestamped consent record that can never be edited, only withdrawn. Your legal name stays in that record: partners see an alias, buyers see a speaker ID, and no recording ever carries your name.</p>
      {problem && <Notice tone="coral">{problem}</Notice>}
      <div className="btn-row" style={{ marginTop: 16 }}>
        <button className="btn btn-outline" type="button" onClick={onCancel}>Not now</button>
        <button className="btn btn-mint" type="button" disabled={busy} onClick={submit}>{busy ? "Signing…" : "Sign the agreement"}</button>
      </div>
    </>
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

  const sign = async (payload: SignaturePayload) => {
    setBusy(true);
    setProblem(null);
    const { data, error } = await supabase.functions.invoke("sign-agreement", { body: payload });
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
      <Page dock={false}>
        <div className="topbar"><Logo height={24} tone="mono" /><span className="chip chip-mint" style={{ marginLeft: "auto" }}>Cast</span></div>
        <Steps current={2} />
        <Head eyebrow="Signed" title="You're in the cast." lede="Your consent record exists from this moment. We've emailed you a copy. Next comes a short recorded interview with a linguist in your language; we'll email you when it's scheduled." />

        <div className="blk blk-mint pat-zig-6 bal">
          <div className="lab">Speaker ID · what datasets carry instead of your name</div>
          <h3 style={{ fontSize: 26, marginTop: 6, fontFamily: "var(--f-mono)" }}>{rec.speaker_id}</h3>
        </div>
        <ul className="card rows">
          <li><span>Agreement</span><span className="v">v{rec.agreement_version}</span></li>
          <li><span>Signed</span><span className="v">{new Date(rec.signed_at).toUTCString()}</span></li>
        </ul>
        <div className="card pad" style={{ marginTop: 14 }}>
          <div className="eyebrow">Consent record fingerprint · SHA-256</div>
          <p className="mono" style={{ wordBreak: "break-all", marginTop: 6 }}>{rec.record_sha256}</p>
          {agreement && <a className="btn btn-outline btn-sm" style={{ marginTop: 10 }} href={agreement.url}>Download the agreement you signed</a>}
        </div>
        <p className="note-p">Changing your mind: withdraw at any time from You, or email privacy@accentstudio.io. Undelivered recordings are deleted within 30 days. Verified earnings are never cancelled.</p>
        <button className="btn btn-outline btn-block signout" type="button" onClick={() => void signOut()}>Sign out</button>
      </Page>
    );
  }

  // ---------- Signed in, invited, not yet signed ----------
  if (session && state) {
    if (!state.invited) {
      return (
        <Page dock={false}>
          <div className="topbar"><Logo height={24} tone="mono" /></div>
          <Head eyebrow="Invitation" title="No open invitation." lede={`You're signed in as ${session.user.email}, but there's no current invitation for that address. Invitations are sent to the email you applied with and last 14 days. Write to hello@accentstudio.io if you think this is wrong.`} />
          <button className="btn btn-outline btn-block signout" type="button" onClick={() => void signOut()}>Sign out</button>
        </Page>
      );
    }
    const inv = state.invitation;
    const lang = inv?.primary_language ? LANG[inv.primary_language] ?? inv.primary_language : "your language";
    return (
      <Page dock={false}>
        <div className="topbar"><Logo height={24} tone="mono" /><span className="chip chip-cream" style={{ marginLeft: "auto" }}>Join the cast</span></div>
        <Steps current={1} />
        <Head eyebrow="Step 2 of 3 · the agreement" title={`Read it, then sign it, ${inv?.full_name?.split(" ")[0] ?? "friend"}.`} lede={`This is the whole deal for playing in ${lang}${inv?.project_name ? ` on ${inv.project_name}` : ""}. Plain language first, the full text behind the link. Nothing here is hidden from you.`} />

        <div className="sec-h"><h3>The short version</h3></div>
        <div className="stack">
          <div className="card pad"><div className="eyebrow">What you give</div><p>Voice recordings you make in the app, plus your language, region, age band and self-described gender. Your name is never attached to any recording.</p></div>
          <div className="card pad"><div className="eyebrow">Who hears you</div><p>The partner you're paired with listens to your takes inside the app, to rate and reply, and never gets your name, contact details or a copy. They may not download, keep or sell your voice, and you promise the same about theirs. Our trained linguists listen to verify transcripts.</p></div>
          <div className="card pad"><div className="eyebrow">What buyers may never do</div><p>Identify you, clone your individual voice, verify identity with it, surveil anyone, or pass the raw data on. Every licence we sign says so.</p></div>
          <div className="card pad"><div className="eyebrow">Money</div><p>A published base rate per speaker per verified hour, shown before each session, then a quality multiplier after verification. A good-faith session never pays zero. Statements monthly, payout within 14 days of a request.</p></div>
          <div className="card pad"><div className="eyebrow">Honest play</div><p>Your own live voice, honest ratings. If a session is questioned, a person reviews it, you're told and can respond within 7 days, and only the sessions involved can lose pay.</p></div>
          <div className="card pad"><div className="eyebrow">Changing your mind</div><p>Withdraw any time, in the app or by email. New use stops, undelivered recordings are deleted within 30 days. You keep every right in your voice; you grant us a non-exclusive licence.</p></div>
        </div>

        <div className="blk blk-gold pat-rings-6 bal">
          <div className="lab">The full text</div>
          {agreement ? (
            <>
              <h3 style={{ fontSize: 18, marginTop: 6 }}><a href={agreement.url} target="_blank" rel="noopener noreferrer">Contributor Agreement v{agreement.version} (PDF, 11 pages)</a></h3>
              <p className="mono" style={{ marginTop: 8, wordBreak: "break-all" }}>Document {agreement.document_id} · SHA-256 {agreement.sha256}</p>
            </>
          ) : (
            <p style={{ marginTop: 6, fontWeight: 500 }}>Loading the current version…</p>
          )}
        </div>

        <Signature
          applicationName={inv?.full_name ?? null}
          email={session.user.email ?? ""}
          busy={busy}
          problem={problem}
          onSign={(payload) => void sign(payload)}
          onProblem={setProblem}
          onCancel={() => void signOut()}
        />
      </Page>
    );
  }

  if (session && !state) {
    return <Page dock={false}><div className="sys">Opening your invitation</div></Page>;
  }

  // ---------- Not signed in: invitation preview and email link ----------
  if (preview === null) return <Page dock={false}><div className="sys">Opening your invitation</div></Page>;
  const p = preview === "none" ? null : preview;
  return (
    <Page dock={false}>
      <div className="topbar"><Logo height={24} tone="mono" /><span className="chip chip-cream" style={{ marginLeft: "auto" }}>Join the cast</span></div>
      <Steps current={0} />
      {p && !p.expired && !p.accepted ? (
        <Head eyebrow="Step 1 of 3 · sign in" title={`Welcome, ${p.first_name}.`} lede={`You're invited to play in ${LANG[p.language] ?? p.language}${p.project_name ? ` on ${p.project_name}` : ""}. First, confirm it's you: we'll email a one-time sign-in link to ${p.email_masked}.`} />
      ) : p && p.accepted ? (
        <Head eyebrow="Invitation" title="Already accepted." lede="This invitation has been used. Sign in with the same email to see your record." />
      ) : p && p.expired ? (
        <Head eyebrow="Invitation" title="This invitation has expired." lede="Invitations last 14 days. Write to hello@accentstudio.io and we'll send a fresh one." />
      ) : (
        <Head eyebrow="Step 1 of 3 · sign in" title="Join the cast." lede="Enter the email you applied with. If there's an open invitation for it, the sign-in link takes you straight to the agreement." />
      )}
      {sent ? (
        <div className="blk blk-mint pat-zig-6 bal">
          <div className="lab">Check your inbox</div>
          <p style={{ fontSize: 14.5, fontWeight: 500, marginTop: 8, lineHeight: 1.45 }}>We sent a one-time sign-in link to <b>{email}</b>. Open it on this phone. It expires in an hour.</p>
        </div>
      ) : (
        <>
          <div className="field" style={{ marginTop: 18 }}>
            <label htmlFor="jemail">Email you applied with</label>
            <input id="jemail" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          {problem && <Notice tone="coral">{problem}</Notice>}
          <button className="btn btn-mint btn-block" type="button" style={{ marginTop: 14 }} disabled={busy} onClick={() => void sendLink()}>{busy ? "Sending…" : "Email me the sign-in link"}</button>
        </>
      )}
    </Page>
  );
}
