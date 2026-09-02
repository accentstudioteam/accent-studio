import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/auth/AuthProvider";
import { LOCALES, RAILS } from "@/lib/labels";
import type { Locale, PayoutRail } from "@/lib/types";

export function Settings({ onBack }: { onBack: () => void }) {
  const { profile, session, refresh, signOut } = useAuth();
  const [handle, setHandle] = useState(profile?.handle ?? "");
  const [locale, setLocale] = useState<Locale | null>(profile?.locale ?? null);
  const [rail, setRail] = useState<PayoutRail | null>(profile?.payout_rail ?? null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgKind, setMsgKind] = useState<"" | "ok" | "err">("");

  const cleanHandle = handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  const canSave = cleanHandle.length >= 3 && locale !== null;

  async function save() {
    if (!canSave || !session) return;
    setBusy(true);
    setMsg("");
    setMsgKind("");
    const { error } = await supabase
      .from("profiles")
      .update({ handle: cleanHandle, locale, payout_rail: rail })
      .eq("id", session.user.id);
    setBusy(false);
    if (error) {
      setMsgKind("err");
      setMsg(error.code === "23505" ? "That handle is taken." : error.message);
      return;
    }
    await refresh();
    setMsgKind("ok");
    setMsg("Saved.");
  }

  return (
    <div className="app">
      <div className="topbar">
        <button className="brand" onClick={onBack} style={{ background: "none", border: "none" }}>
          <span style={{ color: "var(--mut)", fontFamily: "var(--mono)", fontSize: "0.9rem" }}>
            ‹ back
          </span>
        </button>
        <div className="brand">
          <span className="lamp" />
          Accent&nbsp;<em>Studio</em>
        </div>
      </div>

      <div className="shell">
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          Your booth
        </div>
        <h1 className="h1" style={{ marginBottom: 24 }}>
          Settings.
        </h1>

        <div className="stack">
          <div className="field">
            <label htmlFor="handle">Handle</label>
            <input
              id="handle"
              value={handle}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => setHandle(e.target.value)}
            />
            <span className="mono" style={{ fontSize: "0.66rem", color: "var(--faint)" }}>
              shown as {cleanHandle ? `@${cleanHandle}` : "@yourname"}
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
              Language
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
              Payout method
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

          <button className="pill mint" disabled={!canSave || busy} onClick={() => void save()}>
            {busy ? "Saving…" : "Save changes"}
          </button>
          {msg && (
            <div className={`msg ${msgKind}`} style={{ textAlign: "center" }}>
              {msg}
            </div>
          )}

          <button
            className="pill ghost"
            style={{ marginTop: 10 }}
            onClick={() => void signOut()}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
