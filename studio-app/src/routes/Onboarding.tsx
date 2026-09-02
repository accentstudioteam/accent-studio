import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/auth/AuthProvider";
import { LOCALES, RAILS } from "@/lib/labels";
import type { Locale, PayoutRail } from "@/lib/types";
import { Logo } from "../components/Logo";

export function Onboarding() {
  const { profile, session, refresh } = useAuth();
  const [handle, setHandle] = useState(profile?.handle ?? "");
  const [locale, setLocale] = useState<Locale | null>(profile?.locale ?? null);
  const [rail, setRail] = useState<PayoutRail | null>(profile?.payout_rail ?? null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const cleanHandle = handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  const canSave = cleanHandle.length >= 3 && locale !== null;

  async function save() {
    if (!canSave || !session) return;
    setBusy(true);
    setErr("");
    const { error } = await supabase
      .from("profiles")
      .update({ handle: cleanHandle, locale, payout_rail: rail })
      .eq("id", session.user.id);
    setBusy(false);
    if (error) {
      setErr(
        error.code === "23505"
          ? "That handle is taken. Try another."
          : error.message
      );
      return;
    }
    await refresh();
  }

  return (
    <div className="app">
      <div className="topbar">
        <Logo height={22} />
      </div>

      <div className="shell">
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          Step into the studio
        </div>
        <h1 className="h1" style={{ marginBottom: 8 }}>
          Set up your booth.
        </h1>
        <p className="muted" style={{ marginBottom: 26, fontSize: "0.95rem" }}>
          A few basics and you're ready to play. You can change these anytime.
        </p>

        <div className="stack">
          <div className="field">
            <label htmlFor="handle">Handle · your stage name</label>
            <input
              id="handle"
              value={handle}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="e.g. lagos_lynx"
              onChange={(e) => setHandle(e.target.value)}
            />
            <span
              className="mono"
              style={{ fontSize: "0.66rem", color: "var(--faint)" }}
            >
              lowercase, letters, numbers and _ · shown to partners as{" "}
              {cleanHandle ? `@${cleanHandle}` : "@yourname"}
            </span>
          </div>

          <div>
            <label
              className="mono"
              style={{
                fontSize: "0.62rem",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--mut)",
                display: "block",
                marginBottom: 10,
              }}
            >
              The language you'll play in
            </label>
            <div className="opt-grid">
              {LOCALES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  className={locale === l.code ? "opt on" : "opt"}
                  onClick={() => setLocale(l.code)}
                >
                  <span className="emoji">{l.flag}</span>
                  <span className="nm">{l.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              className="mono"
              style={{
                fontSize: "0.62rem",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--mut)",
                display: "block",
                marginBottom: 10,
              }}
            >
              How you'd like to cash out{" "}
              <span style={{ color: "var(--faint)" }}>· optional for now</span>
            </label>
            <div className="opt-grid">
              {RAILS.map((r) => (
                <button
                  key={r.code}
                  type="button"
                  className={rail === r.code ? "opt on" : "opt"}
                  onClick={() => setRail(rail === r.code ? null : r.code)}
                >
                  <span className="nm">{r.name}</span>
                  <span className="sub">{r.min}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            className="pill mint"
            disabled={!canSave || busy}
            onClick={() => void save()}
          >
            {busy ? "Saving…" : "Enter the studio"}
          </button>
          {err && (
            <div className="msg err" style={{ textAlign: "center" }}>
              {err}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
