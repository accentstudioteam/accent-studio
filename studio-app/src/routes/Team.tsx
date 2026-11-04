import { useCallback, useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { Num, useRowMotion } from "@/components/sx-motion";
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

  // a role switched on or off washes the person's row once; a new invite enters
  const personCls = useRowMotion(
    s?.people,
    (p) => p.id,
    (p) => `${p.is_admin ? 1 : 0}|${p.is_linguist ? 1 : 0}|${p.verified}|${p.audited}`,
  );
  const inviteCls = useRowMotion(s?.invited, (i) => i.email, (i) => (i.signed_up ? "up" : "waiting"));

  const body = (
    <div className="shell wide">
      <div className="sx-head">
        <div>
          <div className="eyebrow">Founder tools</div>
          <h1 className="h1">Team{s ? <> · <Num value={s.people.length} /></> : ""}</h1>
        </div>
        <div className="btn-row">
          <button type="button" className="pill ghost" onClick={() => void load()}>Refresh</button>
        </div>
      </div>

      <p className="sx-note">
        Linguists verify and audit rallies and handle clause 15 cases; they never see money or the roster. Admins see everything and send
        payouts. An invite puts the email on the sign-in list; the role is on the moment they sign in. Every change is logged with who made it.
      </p>

      {err && (
        <div className="sx-block sx-block-coral sx-pop" style={{ marginBottom: 12 }}>
          <div className="tlbl">That didn&rsquo;t work</div>
          <div className="tbody">{err}</div>
        </div>
      )}
      {flash && (
        <div className="sx-block sx-block-mint sx-pop" style={{ marginBottom: 12 }}>
          <div className="tlbl">Invited</div>
          <div className="tbody">{flash}</div>
        </div>
      )}

      <div className={`sheet${busy ? " sx-working" : ""}`} style={{ marginBottom: 14 }}>
        <div className="shead"><i className="g" />Invite someone</div>
        <div className="field">
          <label htmlFor="team-email">Email</label>
          <input id="team-email" type="email" inputMode="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
        </div>
        <div className="row2">
          <div className="field">
            <label htmlFor="team-role">Role</label>
            <select id="team-role" value={role} onChange={(e) => setRole(e.target.value as StaffRole)}>
              <option value="linguist">Linguist</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="team-note">Note · optional</label>
            <input id="team-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Yoruba batch" />
          </div>
        </div>
        <button type="button" className="pill mint" disabled={busy || !email.includes("@")} onClick={() => void invite()}>{busy ? "Saving…" : "Invite"}</button>
      </div>

      {!s && !err && <div className="full-center"><div className="spin" /></div>}

      {s && (
        <>
          <div className="tlbl" style={{ margin: "4px 2px 6px" }}>People · {s.people.length}</div>
          {s.people.length === 0 ? (
            <div className="empty sx-pop"><b>Nobody yet.</b><span>Invite someone above; they appear here the moment they sign in.</span></div>
          ) : (
            <div className="sx-list sx-enter" style={{ marginBottom: 14 }}>
              {s.people.map((p) => (
                <PersonRow key={p.id} p={p} cls={personCls(p)} lastAdmin={p.is_admin && s.admins <= 1} onSet={(r, on) => void act(() => staffSet(p.id, r, on))} />
              ))}
            </div>
          )}
        </>
      )}

      {s && s.invited.length > 0 && (
        <>
          <div className="tlbl" style={{ margin: "4px 2px 6px" }}>Invited, not yet in · {s.invited.length}</div>
          <div className="sx-list sx-enter" style={{ marginBottom: 14 }}>
            {s.invited.map((i) => (
              <div key={i.email} className={`sx-row sx-spine-gold${inviteCls(i)}`}>
                <div className="sx-row-top">
                  <div className="sx-row-main">
                    <div className="sx-row-t">{i.email}</div>
                    <div className="sx-row-s">{i.note?.replace(/^staff:\s*/, "") ?? ""}{i.note ? " · " : ""}invited {when(i.created_at)}{i.signed_up ? " · signed up" : ""}</div>
                  </div>
                  <div className="sx-row-end">
                    <button type="button" className="pill ghost" onClick={() => void act(() => staffUninvite(i.email))}>Remove invite</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {s && s.events.length > 0 && (
        <>
          <div className="tlbl" style={{ margin: "4px 2px 6px" }}>Changes</div>
          <div className="sx-list tight sx-enter">
            {s.events.map((e, n) => (
              <div key={n} className="sx-row sx-enter-row">
                <div className="sx-meta">
                  {when(e.at)} · <b>{e.actor ?? "?"}</b> · {KIND_LABEL[e.kind] ?? e.kind} · {String(e.detail.email ?? "")}
                  {e.detail.role ? ` · ${String(e.detail.role)}${"on" in e.detail ? (e.detail.on ? " on" : " off") : ""}` : ""}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );

  if (embedded) return body;
  return (
    <div className="app ankara studio-ank">
      <div className="topbar">
        <button type="button" className="sx-link" onClick={onBack}>‹ back</button>
        <Logo height={22} tone="mono" />
      </div>
      {body}
    </div>
  );
}

/** One person on the staff. An admin carries the gold spine, a linguist the mint one; the roles are chips, the switches are pills. */
function PersonRow({ p, cls, lastAdmin, onSet }: { p: StaffPerson; cls: string; lastAdmin: boolean; onSet: (role: StaffRole, on: boolean) => void }) {
  return (
    <div className={`sx-row${p.is_admin ? " sx-spine-gold" : p.is_linguist ? " sx-spine-mint" : ""}${cls}`}>
      <div className="sx-row-top">
        <div className="sx-row-main">
          <div className="sx-row-t">{p.email}{p.me ? " · you" : ""}</div>
          <div className="sx-row-m">
            {p.editor_id ?? "no editor id"}{p.handle ? ` · ${p.handle}` : ""} · {p.verified} verified · {p.audited} audited{p.last_verified_at ? ` · last ${when(p.last_verified_at)}` : ""}
          </div>
          <div className="chips">
            {p.is_admin && <span className="chip gold">admin</span>}
            {p.is_linguist && <span className="chip">linguist</span>}
            {p.is_contributor && <span className="chip">also a contributor</span>}
            {!p.is_admin && !p.is_linguist && <span className="chip">no role</span>}
          </div>
        </div>
      </div>
      <div className="btn-row" style={{ marginTop: 8 }}>
        <button type="button" className="pill ghost" disabled={p.is_admin && lastAdmin} onClick={() => onSet("admin", !p.is_admin)}>{p.is_admin ? "Remove admin" : "Make admin"}</button>
        <button type="button" className="pill ghost" onClick={() => onSet("linguist", !p.is_linguist)}>{p.is_linguist ? "Remove linguist" : "Make linguist"}</button>
      </div>
      {p.is_admin && lastAdmin && <div className="sx-meta" style={{ marginTop: 6 }}>The only admin; make someone else admin first.</div>}
    </div>
  );
}
