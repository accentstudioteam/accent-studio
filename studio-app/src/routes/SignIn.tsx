import { useState } from "react";
import { supabase } from "@/lib/supabase";

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
    <div className="full-center">
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div className="brand" style={{ marginBottom: 26, fontSize: "1.2rem" }}>
          <span className="lamp" />
          Accent&nbsp;<em>Studio</em>
        </div>
        <div className="eyebrow">Private preview</div>
        <h1 className="h1" style={{ marginBottom: 12 }}>
          Sign in to the studio.
        </h1>
        <p className="muted" style={{ marginBottom: 26, fontSize: "0.95rem" }}>
          Access is invite-only while we build. Enter your email and we'll send a
          one-tap sign-in link.
        </p>
        <form onSubmit={send} className="stack">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <button className="pill mint" type="submit" disabled={busy}>
            {busy ? "Sending…" : "Send magic link"}
          </button>
        </form>
        <div className={`msg ${msgKind}`} style={{ marginTop: 16 }}>
          {msg}
        </div>
      </div>
    </div>
  );
}
