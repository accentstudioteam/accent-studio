import { useCallback, useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { KIND_LABEL, staff, staffInvite, staffSet, staffUninvite, type Staff, type StaffPerson, type StaffRole } from "@/lib/admin";
import { when } from "@/lib/verify";

interface Props {
  onBack: () => void;
  embedded?: boolean;
}

/** Founder view: who is a linguist or an admin, invites by email, and the log of role changes. */
export function Team({ onBack, embedded }: Props) {
  const [s, setS] = useState<Staff | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("linguist");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setS(await staff());
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "Couldn't load the team.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const invite = async () => {
    setBusy(true);
    setErr(null);
    setFlash(null);
    try {
      const r = await staffInvite(email, role, note);
      setFlash(r.already_signed_up ? `${r.email} already has an account; the ${role} role is on now.` : `${r.email} can sign in at accentstudio.io/studio with a magic link and lands as a ${role}.`);
      setEmail("");
      setNote("");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "Couldn't invite them.");
    }
    setBusy(false);
  };

  const act = async (fn: () => Promise<unknown>) => {
    setErr(null);
    setFlash(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "That didn't work.");
    }
  };

  const body = (
    <div className="shell" style={{ maxWidth: 720 }}>
      <div className="spread" style={{ marginBottom: 16, alignItems: "flex-start" }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Founder tools</div>
          <h1 className="h1">Team{s ? ` · ${s.people.length}` : ""}</h1>
        </div>
        <button className="pill ghost" style={{ flex: "none", width: "auto" }} onClick={() => void load()}>Refresh</button>
      </div>
      <div className="tile" style={{ marginBottom: 14 }}>
        <div className="tbody muted" style={{ fontSize: "0.85rem" }}>
          Linguists verify and audit rallies and handle clause 15 cases; they never see money or the roster. Admins see everything and send payouts. An invite puts the email on the sign-in list; the role is on the moment they sign in. Every change is logged with who made it.
        </div>
      </div>
      {err && <div className="tile" style={{ borderColor: "var(--coral)", marginBottom: 14 }}><div className="tbody" style={{ color: "var(--coral)" }}>{err}</div></div>}
      {flash && <div className="tile" style={{ borderColor: "var(--acc)", marginBottom: 14 }}><div className="tbody">{flash}</div></div>}

      <div className="sheet" style={{ marginBottom: 18 }}>
        <div className="handle" />
        <div className="shead"><i className="g" />Invite someone</div>
        <div className="field"><label>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" /></div>
        <div className="row2">
          <div className="field"><label>Role</label><select value={role} onChange={(e) => setRole(e.target.value as StaffRole)}><option value="linguist">Linguist</option><option value="admin">Admin</option></select></div>
          <div className="field"><label>Note · optional</label><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Yoruba batch" /></div>
        </div>
        <button className="pill mint" disabled={busy || !email.includes("@")} onClick={() => void invite()}>{busy ? "Saving…" : "Invite"}</button>
      </div>

      {!s && !err && <div className="muted">Loading…</div>}
      {s && (
        <div className="sheet" style={{ marginBottom: 18 }}>
          <div className="handle" />
          <div className="shead"><i />People · {s.people.length}</div>
          {s.people.map((p) => <PersonRow key={p.id} p={p} lastAdmin={p.is_admin && s.admins <= 1} onSet={(r, on) => void act(() => staffSet(p.id, r, on))} />)}
        </div>
      )}
      {s && s.invited.length > 0 && (
        <div className="sheet" style={{ marginBottom: 18 }}>
          <div className="handle" />
          <div className="shead"><i className="g" />Invited, not yet in · {s.invited.length}</div>
          {s.invited.map((i) => (
            <div key={i.email} className="tile">
              <div className="spread" style={{ alignItems: "flex-start" }}>
                <div>
                  <div className="tbody">{i.email}</div>
                  <div className="tbody muted small" style={{ marginTop: 4 }}>{i.note?.replace(/^staff:\s*/, "") ?? ""} · invited {when(i.created_at)}{i.signed_up ? " · signed up" : ""}</div>
                </div>
                <button className="pill ghost" style={{ width: "auto", flex: "none" }} onClick={() => void act(() => staffUninvite(i.email))}>Remove invite</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {s && s.events.length > 0 && (
        <div className="sheet">
          <div className="handle" />
          <div className="shead"><i />Changes</div>
          {s.events.map((e, n) => (
            <div key={n} className="tile">
              <div className="tbody small">{when(e.at)} · {e.actor ?? "?"} · {KIND_LABEL[e.kind] ?? e.kind} · {String(e.detail.email ?? "")}{e.detail.role ? ` · ${String(e.detail.role)}${"on" in e.detail ? (e.detail.on ? " on" : " off") : ""}` : ""}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (embedded) return body;
  return (
    <div className="app">
      <div className="topbar">
        <button className="brand" onClick={onBack} style={{ background: "none", border: "none" }}><span style={{ color: "var(--mut)", fontFamily: "var(--mono)", fontSize: "0.9rem" }}>‹ back</span></button>
        <Logo height={22} />
      </div>
      {body}
    </div>
  );
}

function PersonRow({ p, lastAdmin, onSet }: { p: StaffPerson; lastAdmin: boolean; onSet: (role: StaffRole, on: boolean) => void }) {
  return (
    <div className="tile">
      <div className="spread" style={{ alignItems: "flex-start" }}>
        <div>
          <div className="tbody">{p.email}{p.me ? " · you" : ""}</div>
          <div className="tbody muted small" style={{ marginTop: 4, fontFamily: "var(--mono)" }}>{p.editor_id ?? "no editor id"}{p.handle ? ` · ${p.handle}` : ""} · {p.verified} verified · {p.audited} audited{p.last_verified_at ? ` · last ${when(p.last_verified_at)}` : ""}</div>
        </div>
        <div className="chips" style={{ flex: "none", justifyContent: "flex-end" }}>
          {p.is_admin && <span className="chip gold">admin</span>}
          {p.is_linguist && <span className="chip">linguist</span>}
          {p.is_contributor && <span className="chip">also a contributor</span>}
        </div>
      </div>
      <div className="btn-row" style={{ marginTop: 8 }}>
        <button className="pill ghost" style={{ width: "auto" }} disabled={p.is_admin && lastAdmin} onClick={() => onSet("admin", !p.is_admin)}>{p.is_admin ? "Remove admin" : "Make admin"}</button>
        <button className="pill ghost" style={{ width: "auto" }} onClick={() => onSet("linguist", !p.is_linguist)}>{p.is_linguist ? "Remove linguist" : "Make linguist"}</button>
      </div>
      {p.is_admin && lastAdmin && <div className="tbody muted small" style={{ marginTop: 6 }}>The only admin; make someone else admin first.</div>}
    </div>
  );
}
