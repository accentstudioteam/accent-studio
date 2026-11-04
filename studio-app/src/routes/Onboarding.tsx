import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/auth/AuthProvider";
import { LOCALES, RAILS } from "@/lib/labels";
import type { Locale, PayoutRail } from "@/lib/types";
import { Logo } from "../components/Logo";

/** First sign-in: a handle and a language before the Studio opens. The payout rail can wait. */
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
    <div className="app ankara studio-ank">
      <div className="topbar">
        <Logo height={22} tone="mono" />
      </div>

      <div className="shell wide sx-rise">
        <div className="sx-head">
          <div>
            <div className="eyebrow">Step into the studio</div>
            <h1 className="h1">Set up your booth.</h1>
          </div>
        </div>
        <p className="sx-note">A few basics and you&rsquo;re ready. You can change these any time from Settings.</p>

        <div className={`sheet${busy ? " sx-working" : ""}`} style={{ marginBottom: 12 }}>
          <div className="shead"><i />Handle · your stage name</div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="handle">Handle</label>
            <input
              id="handle"
              value={handle}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="e.g. lagos_lynx"
              onChange={(e) => setHandle(e.target.value)}
            />
          </div>
          <div className="sx-meta">lowercase, letters, numbers and _ · shown to partners as <b>{cleanHandle ? `@${cleanHandle}` : "@yourname"}</b></div>
        </div>

        <div className="sheet" style={{ marginBottom: 12 }}>
          <div className="shead"><i className="g" />The language you&rsquo;ll play in</div>
          <div className="row2" role="radiogroup" aria-label="Language">
            {LOCALES.map((l) => (
              <button
                key={l.code}
                type="button"
                role="radio"
                aria-checked={locale === l.code}
                className={`tile${locale === l.code ? " sx-spine-mint" : ""}`}
                onClick={() => setLocale(l.code)}
              >
                <div className="ttitle"><span aria-hidden="true">{l.flag}</span> {l.name}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="sheet" style={{ marginBottom: 12 }}>
          <div className="shead"><i />How you&rsquo;d like to cash out · optional for now</div>
          <div className="row2" role="radiogroup" aria-label="Payout method">
            {RAILS.map((r) => (
              <button
                key={r.code}
                type="button"
                role="radio"
                aria-checked={rail === r.code}
                className={`tile${rail === r.code ? " sx-spine-mint" : ""}`}
                onClick={() => setRail(rail === r.code ? null : r.code)}
              >
                <div className="spread">
                  <div className="ttitle">{r.name}</div>
                  <span className="sx-meta">{r.min}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="btn-row">
          <button type="button" className="pill mint" disabled={!canSave || busy} onClick={() => void save()}>
            {busy ? "Saving…" : "Enter the studio"}
          </button>
        </div>
        {err && (
          <div className="sx-block sx-block-coral sx-pop" role="alert" style={{ marginTop: 12 }}>
            <div className="tlbl">That didn&rsquo;t save</div>
            <div className="tbody">{err}</div>
          </div>
        )}
      </div>
    </div>
  );
}
