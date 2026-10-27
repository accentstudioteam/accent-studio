import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Logo } from "../components/Logo";
import { Notice, Page } from "@/components/ankara-ui";

/** The front door, in the "Ankara Blocks" direction. The magic-link call and its
 * redirect are exactly as they were; only the markup changed. */
export function SignIn() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [msgKind, setMsgKind] = useState<"" | "ok" | "err">("");
  const [busy, setBusy] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setMsgKind("err");
      setMsg("That email doesn't look right.");
      return;
    }
    setBusy(true);
    setMsgKind("");
    setMsg("Sending your magic link…");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/studio` },
    });
    setBusy(false);
    if (error) {
      setMsgKind("err");
      setMsg(error.message);
    } else {
      setMsgKind("ok");
      setMsg("Check your inbox. The link signs you straight in.");
    }
  }

  return (
    <Page dock={false}>
      <div className="topbar">
        <Logo height={24} tone="mono" />
      </div>
      <div className="lab muted" style={{ marginTop: 18 }}>Private preview</div>
      <h2 className="pg">Sign in to the studio.</h2>
      <p className="note-p">Access is invite-only while we build. Enter your email and we'll send a one-tap sign-in link.</p>

      <form onSubmit={send}>
        <div className="field" style={{ marginTop: 18 }}>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <button className="btn btn-mint btn-block" type="submit" style={{ marginTop: 14 }} disabled={busy}>{busy ? "Sending…" : "Send magic link"}</button>
      </form>
      {msg && <div style={{ marginTop: 16 }}><Notice tone={msgKind === "err" ? "coral" : "gold"}>{msg}</Notice></div>}
    </Page>
  );
}
