import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Logo } from "@/components/Logo";
import { CheckRow, ScreenHead, Stepper } from "@/prototype/ui";
import { formatClock, useRecorder } from "@/lib/recorder";

const STEPS = 4;
const MAX_SAMPLE_SECONDS = 30;
/** The three short recordings per language: key, title, instruction. */
const PARTS: [string, string, string][] = [
  ["intro", "Your name and your city", "Say: my name is…, I live in…. Five to ten seconds."],
  ["morning", "Your morning so far", "Two or three sentences, the way you'd tell a friend. Ten to twenty seconds."],
  ["act", "Now act", "You're a delivery rider calling a customer to say their package is late. Sound like you mean it. Ten to fifteen seconds."],
];
const SITE = "https://accentstudio.io";

const LANGS: [string, string][] = [
  ["pcm", "Nigerian Pidgin"],
  ["yo", "Yoruba"],
  ["ha", "Hausa"],
  ["ig", "Igbo"],
  ["sw", "Swahili"],
  ["zu", "Zulu"],
  ["en", "English"],
  ["other", "Another language"],
];
const COUNTRIES: [string, string][] = [
  ["NG", "Nigeria"],
  ["KE", "Kenya"],
  ["ZA", "South Africa"],
  ["GH", "Ghana"],
  ["TZ", "Tanzania"],
  ["UG", "Uganda"],
  ["RW", "Rwanda"],
  ["CM", "Cameroon"],
  ["GB", "United Kingdom"],
  ["US", "United States"],
  ["CA", "Canada"],
  ["ZZ", "Somewhere else"],
];
const AGE_BANDS = ["18-24", "25-34", "35-44", "45-54", "55+"];
const GENDERS: [string, string][] = [
  ["woman", "Woman"],
  ["man", "Man"],
  ["nonbinary", "Non-binary"],
  ["prefer_not", "Prefer not to say"],
];
const DEVICES: [string, string][] = [
  ["android", "Android phone"],
  ["ios", "iPhone"],
  ["desktop", "Laptop or desktop"],
];
const HOURS: [string, string][] = [
  ["<2", "Under 2 hours"],
  ["2-5", "2 to 5 hours"],
  ["5-10", "5 to 10 hours"],
  ["10+", "10 hours or more"],
];
const PAYOUTS: [string, string][] = [
  ["paystack", "Bank transfer via Paystack (Nigeria)"],
  ["flutterwave", "Flutterwave (West Africa)"],
  ["mpesa", "M-Pesa (Kenya, Tanzania)"],
  ["paypal", "PayPal"],
  ["stripe", "Bank transfer via Stripe (UK, EU, US)"],
  ["usdc", "USDC (crypto)"],
  ["undecided", "Not sure yet"],
];

type Phase = "intro" | "about" | "languages" | "voice" | "finish" | "done" | "duplicate";

interface Form {
  full_name: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  languages: string[];
  primary_language: string;
  other_language: string;
  age_band: string;
  gender: string;
  device: string;
  hours_per_week: string;
  motivation: string;
  referral: string;
  payout_pref: string;
  consent_contact: boolean;
  consent_sample: boolean;
  website: string; // honeypot, must stay empty
}

interface Sample {
  blob: Blob;
  mime: string;
  seconds: number;
  url: string;
}

const EMPTY: Form = {
  full_name: "",
  email: "",
  phone: "",
  country: "",
  city: "",
  languages: [],
  primary_language: "",
  other_language: "",
  age_band: "",
  gender: "",
  device: "",
  hours_per_week: "",
  motivation: "",
  referral: "",
  payout_pref: "",
  consent_contact: false,
  consent_sample: false,
  website: "",
};

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function langName(code: string, other: string): string {
  if (code === "other") return other.trim() || "your other language";
  return LANGS.find(([c]) => c === code)?.[1] ?? code;
}

function extFor(mime: string): string {
  const base = mime.split(";")[0];
  if (base.includes("mp4")) return "mp4";
  if (base.includes("ogg")) return "ogg";
  if (base.includes("wav")) return "wav";
  return "webm";
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      className="chip"
      onClick={onClick}
      aria-pressed={on}
      style={{
        cursor: "pointer",
        background: on ? "var(--acc)" : undefined,
        color: on ? "#0d0b08" : undefined,
        borderColor: on ? "var(--acc)" : undefined,
        fontWeight: on ? 700 : undefined,
      }}
    >
      {children}
    </button>
  );
}

function ChipGroup({ options, value, onChange }: { options: [string, string][]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {options.map(([v, label]) => (
        <Chip key={v} on={value === v} onClick={() => onChange(v)}>
          {label}
        </Chip>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}

function Problem({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <div className="tile" style={{ borderColor: "var(--coral)", marginBottom: 14 }}>
      <div className="tbody" style={{ color: "var(--coral)" }}>{text}</div>
    </div>
  );
}

/** Public player application. Doubles as the waitlist. No sign-in required. */
export function Apply() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [form, setForm] = useState<Form>(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    return ref ? { ...EMPTY, referral: ref.slice(0, 200) } : EMPTY;
  });
  const [samples, setSamples] = useState<Record<string, Sample>>({});
  const [current, setCurrent] = useState("");
  const [currentPart, setCurrentPart] = useState(PARTS[0][0]);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const rec = useRecorder(MAX_SAMPLE_SECONDS);

  useEffect(() => {
    document.title = "Apply · Accent Studio";
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    setProblem(null);
    if (phase === "voice") setCurrent((c) => (c && form.languages.includes(c) ? c : form.primary_language));
  }, [phase, form.languages, form.primary_language]);

  // A finished recording belongs to the language currently selected.
  useEffect(() => {
    if (rec.status !== "done" || !rec.blob || !current) return;
    const blob = rec.blob;
    const mime = rec.mime;
    const seconds = rec.seconds;
    const key = `${current}/${currentPart}`;
    setSamples((s) => {
      if (s[key]) URL.revokeObjectURL(s[key].url);
      return { ...s, [key]: { blob, mime, seconds, url: URL.createObjectURL(blob) } };
    });
    rec.reset();
  }, [rec, current, currentPart]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  const toggleLang = (code: string) =>
    setForm((f) => {
      const has = f.languages.includes(code);
      const languages = has ? f.languages.filter((c) => c !== code) : f.languages.length >= 8 ? f.languages : [...f.languages, code];
      const primary_language = languages.includes(f.primary_language) ? f.primary_language : languages[0] ?? "";
      return { ...f, languages, primary_language };
    });

  const switchLanguage = (code: string) => {
    rec.reset();
    setCurrent(code);
    setCurrentPart((PARTS.find(([p]) => !samples[`${code}/${p}`]) ?? PARTS[0])[0]);
  };

  const dropSample = (key: string) => {
    setSamples((s) => {
      if (!s[key]) return s;
      URL.revokeObjectURL(s[key].url);
      const next = { ...s };
      delete next[key];
      return next;
    });
    rec.reset();
  };

  const nextFromAbout = () => {
    if (form.full_name.trim().length < 2) return setProblem("Please give us your name.");
    if (!EMAIL_RE.test(form.email.trim())) return setProblem("That email doesn't look right.");
    if (!form.country) return setProblem("Pick the country you're in.");
    setPhase("languages");
  };

  const nextFromLanguages = () => {
    if (form.languages.length === 0) return setProblem("Pick at least one language you speak natively.");
    if (form.languages.includes("other") && !form.other_language.trim()) return setProblem("Tell us which other language.");
    if (!form.primary_language) return setProblem("Which one is your strongest?");
    if (!form.age_band) return setProblem("Pick your age band.");
    if (!form.device) return setProblem("Which device would you play on?");
    setPhase("voice");
  };

  const sampleCount = Object.keys(samples).length;
  const partsDone = (lang: string) => PARTS.filter(([p]) => samples[`${lang}/${p}`]).length;
  const hasPrimarySample = partsDone(form.primary_language) === PARTS.length;

  const submit = async () => {
    if (!form.consent_contact) return setProblem("We need permission to contact you about the waitlist.");
    if (sampleCount > 0 && !form.consent_sample) return setProblem("Tick the box so we can listen to your samples, or go back and remove them.");
    if (!form.payout_pref) return setProblem("Pick how you'd like to be paid later. 'Not sure yet' is fine.");
    if (form.website.trim()) {
      setPhase("done");
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const id = crypto.randomUUID();
      const uploaded: { language: string; part: string; path: string; seconds: number }[] = [];
      for (const [key, s] of Object.entries(samples)) {
        const [language, part] = key.split("/");
        const base = s.mime.split(";")[0] || "audio/webm";
        const path = `${id}/sample-${language}-${part}.${extFor(s.mime)}`;
        const { error } = await supabase.storage.from("applications").upload(path, s.blob, { contentType: base, upsert: false });
        if (error) {
          setProblem(`Your ${langName(language, form.other_language)} recording didn't upload. Check your connection and try again.`);
          setBusy(false);
          return;
        }
        uploaded.push({ language, part, path, seconds: s.seconds });
      }
      const primary = uploaded.find((u) => u.language === form.primary_language && u.part === PARTS[0][0]) ?? uploaded[0] ?? null;
      const { error } = await supabase.from("applications").insert({
        id,
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || null,
        country: form.country,
        city: form.city.trim() || null,
        languages: form.languages,
        primary_language: form.primary_language,
        other_language: form.languages.includes("other") ? form.other_language.trim() || null : null,
        age_band: form.age_band || null,
        gender: form.gender || null,
        device: form.device || null,
        hours_per_week: form.hours_per_week || null,
        motivation: form.motivation.trim() || null,
        referral: form.referral.trim() || null,
        payout_pref: form.payout_pref,
        sample_path: primary?.path ?? null,
        sample_seconds: primary?.seconds ?? null,
        samples: uploaded,
        consent_contact: form.consent_contact,
        consent_sample: form.consent_sample,
        user_agent: navigator.userAgent.slice(0, 400),
      });
      if (error) {
        if (error.code === "23505") setPhase("duplicate");
        else setProblem("Something went wrong saving your application. Please try again in a moment.");
        setBusy(false);
        return;
      }
      // Confirmation email. Fire and forget: the application is already saved.
      void supabase.functions.invoke("application-received", { body: { id } }).catch(() => undefined);
      setPhase("done");
    } catch {
      setProblem("Something went wrong. Please try again in a moment.");
    }
    setBusy(false);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${SITE}/apply`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const currentName = langName(current, form.other_language);
  const firstName = form.full_name.trim().split(/\s+/)[0] || "friend";

  return (
    <div className="app">
      <div className="topbar">
        <a href={SITE} aria-label="Accent Studio home" style={{ display: "block" }}>
          <Logo height={22} />
        </a>
        <span className="eyebrow" style={{ whiteSpace: "nowrap" }}>Waitlist</span>
      </div>

      <div className="shell">
        {phase === "intro" && (
          <>
            <div className="hero-emoji">🎙️</div>
            <ScreenHead
              eyebrow="The waitlist · join the cast"
              title="Get paid to teach AI your language."
              lede="Accent Studio is a voice game. You improvise short scenes in your own language and get paid per verified hour. This application is the waitlist: four minutes on your phone, no account needed."
            />
            <span className="slabel">What we're looking for</span>
            <ul className="rlist" style={{ marginBottom: 22 }}>
              <li><span className="rico">✓</span> You speak Nigerian Pidgin, Yoruba, Hausa, Igbo, Swahili or Zulu natively</li>
              <li><span className="rico">✓</span> A phone with a working mic and a quiet room</li>
              <li><span className="rico">✓</span> You can act a little: play a character, have fun</li>
              <li><span className="rico">✓</span> You're 18 or older</li>
            </ul>
            <div className="sheet" style={{ marginBottom: 22 }}>
              <div className="handle" />
              <div className="shead"><i className="g" />What happens next</div>
              <div className="tile">
                <div className="tbody muted">
                  We read every application and listen to every sample. When your language opens, you get an invite to a short recorded interview, then onboarding. Nobody is paid during the preview, but you tell us now how you'd like to be paid later.
                </div>
              </div>
            </div>
            <div className="actionbar">
              <button className="pill mint" onClick={() => setPhase("about")}>Start application</button>
            </div>
          </>
        )}

        {phase === "about" && (
          <>
            <Stepper total={STEPS} current={0} />
            <ScreenHead eyebrow="Application · 1 of 4" title="About you." />
            <Field label="Full name">
              <input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} autoComplete="name" maxLength={120} placeholder="As on your ID" />
            </Field>
            <Field label="Email">
              <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" inputMode="email" maxLength={200} placeholder="you@example.com" />
            </Field>
            <Field label="WhatsApp or phone (optional)">
              <input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel" inputMode="tel" maxLength={40} placeholder="+234…" />
            </Field>
            <Field label="Country you're in">
              <select value={form.country} onChange={(e) => set("country", e.target.value)}>
                <option value="">Choose…</option>
                {COUNTRIES.map(([c, n]) => (
                  <option key={c} value={c}>{n}</option>
                ))}
              </select>
            </Field>
            <Field label="City (optional)">
              <input value={form.city} onChange={(e) => set("city", e.target.value)} maxLength={120} placeholder="e.g. Lagos, Nairobi, Kano" />
            </Field>
            <input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => set("website", e.target.value)} style={{ position: "absolute", left: -9999, width: 1, height: 1, opacity: 0 }} aria-hidden="true" />
            <Problem text={problem} />
            <div className="actionbar btn-row">
              <button className="pill ghost" onClick={() => setPhase("intro")}>Back</button>
              <button className="pill mint" onClick={nextFromAbout}>Continue</button>
            </div>
          </>
        )}

        {phase === "languages" && (
          <>
            <Stepper total={STEPS} current={1} />
            <ScreenHead eyebrow="Application · 2 of 4" title="Your languages." lede="Pick every language you speak natively and want to work in. You'll record a short sample in each one next." />
            <Field label="Languages you speak natively">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {LANGS.map(([code, name]) => (
                  <Chip key={code} on={form.languages.includes(code)} onClick={() => toggleLang(code)}>{name}</Chip>
                ))}
              </div>
            </Field>
            {form.languages.includes("other") && (
              <Field label="Which other language?">
                <input value={form.other_language} onChange={(e) => set("other_language", e.target.value)} maxLength={80} placeholder="e.g. Twi, Amharic, Shona" />
              </Field>
            )}
            {form.languages.length > 1 && (
              <Field label="Your strongest">
                <ChipGroup options={form.languages.map((c) => [c, langName(c, form.other_language)])} value={form.primary_language} onChange={(v) => set("primary_language", v)} />
              </Field>
            )}
            <Field label="Age band">
              <ChipGroup options={AGE_BANDS.map((a) => [a, a])} value={form.age_band} onChange={(v) => set("age_band", v)} />
            </Field>
            <Field label="Gender (optional)">
              <ChipGroup options={GENDERS} value={form.gender} onChange={(v) => set("gender", v)} />
            </Field>
            <Field label="Device you'd play on">
              <ChipGroup options={DEVICES} value={form.device} onChange={(v) => set("device", v)} />
            </Field>
            <Problem text={problem} />
            <div className="actionbar btn-row">
              <button className="pill ghost" onClick={() => setPhase("about")}>Back</button>
              <button className="pill mint" onClick={nextFromLanguages}>Continue</button>
            </div>
          </>
        )}

        {phase === "voice" && (
          <>
            <Stepper total={STEPS} current={2} />
            <ScreenHead
              eyebrow="Application · 3 of 4"
              title="Three short recordings per language."
              lede="Each one is a few seconds. Your strongest language needs all three; the others are optional and help us place you faster."
            />

            <div className="tile" style={{ marginBottom: 16, borderColor: "var(--acc)" }}>
              <div className="tlbl">🔒 Only to assess your application</div>
              <div className="tbody" style={{ marginTop: 6 }}>
                These recordings are heard by our team to judge voice quality and fluency, nothing else. They are never used for training, never sold, and never included in any dataset. You can ask us to delete them at any time.
              </div>
            </div>

            <Field label="Language">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {form.languages.map((code) => (
                  <Chip key={code} on={current === code} onClick={() => switchLanguage(code)}>
                    {partsDone(code) === PARTS.length ? "✓ " : partsDone(code) > 0 ? `${partsDone(code)}/${PARTS.length} · ` : ""}
                    {langName(code, form.other_language)}
                    {code === form.primary_language ? " · strongest" : ""}
                  </Chip>
                ))}
              </div>
            </Field>

            <div className="sheet" style={{ marginBottom: 22 }}>
              <div className="handle" />
              <div className="shead"><i />Speak only {currentName}</div>
              {PARTS.map(([part, title, hint], i) => {
                const key = `${current}/${part}`;
                const s = samples[key];
                const active = currentPart === part && (rec.status === "recording" || rec.status === "requesting");
                const busyElsewhere = !active && (rec.status === "recording" || rec.status === "requesting");
                return (
                  <div key={part} className={"tile rectile" + (active ? " live" : "")}>
                    <div className="tlbl">{i + 1} · {title}{s ? " · done" : ""}</div>
                    <div className="tbody muted" style={{ marginTop: 4, marginBottom: 10 }}>{hint}</div>
                    {s ? (
                      <>
                        <audio controls src={s.url} style={{ width: "100%" }} />
                        <button className="pill ghost" style={{ marginTop: 10 }} onClick={() => dropSample(key)}>Re-record</button>
                      </>
                    ) : active ? (
                      <div className="recwrap">
                        <div className="reclive" aria-hidden="true"><span className="recdot" />REC {formatClock(rec.seconds)}</div>
                        <button type="button" className="recbtn rec" onClick={() => rec.stop()} aria-label="Stop recording">
                          <span className="core" />
                        </button>
                        <div className="wv livewv" aria-hidden="true">
                          {Array.from({ length: 28 }).map((_, j) => {
                            const v = rec.levels[rec.levels.length - 28 + j] ?? 0;
                            return <i key={j} className="live" style={{ height: `${Math.max(8, Math.round(v * 100))}%` }} />;
                          })}
                        </div>
                        <div className="rectime" style={{ color: "var(--coral)" }}>
                          {rec.status === "requesting" ? "Asking for the mic…" : "Recording… tap the button to stop"}
                        </div>
                        <div className="progress" style={{ width: "100%" }}>
                          <div className="fill" style={{ width: `${Math.min(100, (rec.seconds / MAX_SAMPLE_SECONDS) * 100)}%`, background: "var(--coral)" }} />
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="pill"
                        disabled={busyElsewhere}
                        onClick={() => {
                          setCurrentPart(part);
                          void rec.start();
                        }}
                        aria-label={`Record part ${i + 1}`}
                        style={{ background: "var(--coral)", color: "#0d0b08" }}
                      >
                        ● Record part {i + 1}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <Problem text={rec.error} />
            <div className="actionbar btn-row">
              {sampleCount === 0 ? (
                <button className="pill ghost" onClick={() => setPhase("finish")}>Skip for now</button>
              ) : (
                <button className="pill ghost" onClick={() => setPhase("languages")}>Back</button>
              )}
              <button className="pill mint" disabled={!hasPrimarySample} onClick={() => setPhase("finish")}>
                {hasPrimarySample ? "Continue" : `Record all 3 in ${langName(form.primary_language, form.other_language)}`}
              </button>
            </div>
          </>
        )}

        {phase === "finish" && (
          <>
            <Stepper total={STEPS} current={3} />
            <ScreenHead eyebrow="Application · 4 of 4" title="Last few things." />
            <Field label="Hours a week you could play">
              <ChipGroup options={HOURS} value={form.hours_per_week} onChange={(v) => set("hours_per_week", v)} />
            </Field>
            <Field label="How would you like to be paid, later?">
              <select value={form.payout_pref} onChange={(e) => set("payout_pref", e.target.value)}>
                <option value="">Choose…</option>
                {PAYOUTS.map(([v, n]) => (
                  <option key={v} value={v}>{n}</option>
                ))}
              </select>
              <div className="muted" style={{ fontSize: "0.8rem" }}>No payouts during the preview. This just tells us which rails to build first.</div>
            </Field>
            <Field label="Why do you want to join? (optional)">
              <input value={form.motivation} onChange={(e) => set("motivation", e.target.value)} maxLength={1000} placeholder="A sentence is plenty" />
            </Field>
            <Field label="How did you hear about us? (optional)">
              <input value={form.referral} onChange={(e) => set("referral", e.target.value)} maxLength={200} placeholder="Friend, X, WhatsApp, Discord…" />
            </Field>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              <CheckRow checked={form.consent_contact} onToggle={() => set("consent_contact", !form.consent_contact)}>
                You can contact me about the waitlist and interviews.
              </CheckRow>
              {sampleCount > 0 && (
                <CheckRow checked={form.consent_sample} onToggle={() => set("consent_sample", !form.consent_sample)}>
                  You can listen to my voice samples to assess my application only. They won't be used for training, sold, or included in any dataset, and I can ask for them to be deleted.
                </CheckRow>
              )}
            </div>
            <div className="muted" style={{ fontSize: "0.78rem", marginBottom: 14 }}>
              Your voice is biometric data and we treat it that way. See the <a href={`${SITE}/privacy`} style={{ color: "var(--acc)" }}>privacy policy</a>.
            </div>
            <Problem text={problem} />
            <div className="actionbar btn-row">
              <button className="pill ghost" disabled={busy} onClick={() => setPhase("voice")}>Back</button>
              <button className="pill mint" disabled={busy} onClick={submit}>{busy ? "Sending…" : "Submit application"}</button>
            </div>
          </>
        )}

        {phase === "done" && (
          <>
            <div className="hero-emoji">🎉</div>
            <ScreenHead eyebrow="You're on the list" title={`Welcome to the cast, ${firstName}.`} lede="We read every application and listen to every sample. When your language opens, you'll get an email with an invite to a short recorded interview." />
            <div className="sheet" style={{ marginBottom: 22 }}>
              <div className="handle" />
              <div className="shead"><i className="g" />Move up the list</div>
              <div className="tile">
                <div className="ttitle">Know someone who talks like home?</div>
                <div className="tbody muted" style={{ marginTop: 6 }}>Send them the link. The more voices in a language, the sooner it opens.</div>
                <div className="mono" style={{ marginTop: 10, fontSize: "0.85rem", color: "var(--acc)" }}>accentstudio.io/apply</div>
              </div>
              <button className="pill mint" onClick={copyLink}>{copied ? "Copied" : "Copy the link"}</button>
            </div>
            <div className="actionbar">
              <a className="pill ghost" href={SITE} style={{ textAlign: "center", textDecoration: "none" }}>Back to accentstudio.io</a>
            </div>
          </>
        )}

        {phase === "duplicate" && (
          <>
            <div className="hero-emoji">👋</div>
            <ScreenHead eyebrow="Already on the list" title="We already have you." lede={`There's an application under ${form.email.trim().toLowerCase()}. You don't need to apply twice. If you want to update anything, email hello@accentstudio.io.`} />
            <div className="actionbar">
              <a className="pill ghost" href={SITE} style={{ textAlign: "center", textDecoration: "none" }}>Back to accentstudio.io</a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
