import { useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/auth/AuthProvider";
import { LOCALES, RAILS } from "@/lib/labels";
import type { Locale, PayoutRail } from "@/lib/types";
import { Logo } from "../components/Logo";

/** The staff member's own booth: handle, language, payout rail. Saves to their profile row. */
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
    <div className="app ankara studio-ank">
      <div className="topbar">
        <button type="button" className="sx-link" onClick={onBack}>‹ back</button>
        <Logo height={22} tone="mono" />
      </div>

      <div className="shell wide">
        <div className="sx-head">
          <div>
            <div className="eyebrow">Your booth</div>
            <h1 className="h1">Settings</h1>
          </div>
        </div>

        <div className={`sheet${busy ? " sx-working" : ""}`} style={{ marginBottom: 12 }}>
          <div className="shead"><i />Handle</div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="handle">Handle</label>
            <input
              id="handle"
              value={handle}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => setHandle(e.target.value)}
            />
          </div>
          <div className="sx-meta">shown as <b>{cleanHandle ? `@${cleanHandle}` : "@yourname"}</b></div>
        </div>

        <div className="sheet" style={{ marginBottom: 12 }}>
          <div className="tlbl">Appearance</div>
          <div className="tbody" style={{ marginBottom: 10 }}>System follows this device. Pick Light or Dark to hold one regardless.</div>
          <ThemeToggle />
        </div>
        <div className="sheet" style={{ marginBottom: 12 }}>
          <div className="shead"><i className="g" />Language</div>
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
          <div className="shead"><i />Payout method</div>
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

        <div className="btn-row" style={{ alignItems: "center", marginBottom: 12 }}>
          <button type="button" className="pill mint" disabled={!canSave || busy} onClick={() => void save()}>
            {busy ? "Saving…" : "Save changes"}
          </button>
          {msg && msgKind === "ok" && <span key={msg} className="chip sx-ok sx-pop" role="status">{msg}</span>}
        </div>
        {msg && msgKind === "err" && (
          <div className="sx-block sx-block-coral sx-pop" role="alert" style={{ marginBottom: 12 }}>
            <div className="tlbl">That didn&rsquo;t save</div>
            <div className="tbody">{msg}</div>
          </div>
        )}

        <p className="sx-note">Signing out ends this staff session on this device only.</p>
        <button type="button" className="pill ghost" onClick={() => void signOut()}>Sign out</button>
      </div>
    </div>
  );
}
