import { useCallback, useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { LANG_NAME } from "@/lib/game";
import { KIND_LABEL, NOTIFY_LABEL, STATUS_LABEL, contributor, contributorSet, contributors, hours, type ContributorAction, type ContributorDetail, type ContributorRow, type Roster } from "@/lib/admin";
import { TIER_WORD, money } from "@/lib/earn";
import { REASON_LABEL, when } from "@/lib/verify";

interface Props {
  onBack: () => void;
  embedded?: boolean;
}
type Filter = "all" | "active" | "paused" | "closed" | "withdrawn" | "cases";

const STATUS_COLOR: Record<ContributorRow["status"], string | undefined> = { active: "var(--acc)", paused: "var(--gold)", closed: "var(--coral)", withdrawn: undefined };

/** Founder view: every signed contributor with their numbers, and one person in depth with the controls. */
export function Contributors({ onBack, embedded }: Props) {
  const [r, setR] = useState<Roster | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setR(await contributors());
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "Couldn't load the roster.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const needle = search.trim().toLowerCase();
  const shown = (r?.people ?? []).filter((p) => (filter === "all" ? true : filter === "cases" ? p.open_cases > 0 : p.status === filter))
    .filter((p) => !needle || [p.speaker_id, p.full_name, p.email, p.city, p.country].some((v) => (v ?? "").toLowerCase().includes(needle)));

  const body = open ? (
    <Detail cid={open} onBack={() => { setOpen(null); void load(); }} />
  ) : (
    <div className="shell" style={{ maxWidth: 720 }}>
      <div className="spread" style={{ marginBottom: 16, alignItems: "flex-start" }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Founder tools</div>
          <h1 className="h1">Contributors{r ? ` · ${r.people.length}` : ""}</h1>
        </div>
        <button className="pill ghost" style={{ flex: "none", width: "auto" }} onClick={() => void load()}>Refresh</button>
      </div>
      {r && (
        <div className="row2" style={{ marginBottom: 14 }}>
          <div className="tile acc"><div className="tlbl">Active</div><div className="ttitle">{r.counts.active}</div></div>
          <div className="tile"><div className="tlbl">Paused</div><div className="ttitle" style={{ color: r.counts.paused ? "var(--gold)" : undefined }}>{r.counts.paused}</div></div>
          <div className="tile"><div className="tlbl">Closed</div><div className="ttitle">{r.counts.closed}</div></div>
          <div className="tile"><div className="tlbl">Withdrew consent</div><div className="ttitle">{r.counts.withdrawn}</div></div>
        </div>
      )}
      <div className="field" style={{ marginBottom: 8 }}><label>Find</label><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="speaker id, name, email, city" /></div>
      <div className="chips" style={{ marginBottom: 12 }}>
        {([["all", "All"], ["active", "Active"], ["paused", "Paused"], ["closed", "Closed"], ["withdrawn", "Withdrawn"], ["cases", "With open cases"]] as [Filter, string][]).map(([k, label]) => (
          <button key={k} type="button" className={`chip${filter === k ? " on" : ""}`} onClick={() => setFilter(k)}>{label}</button>
        ))}
      </div>
      {err && <div className="tile" style={{ borderColor: "var(--coral)", marginBottom: 14 }}><div className="tbody" style={{ color: "var(--coral)" }}>{err}</div></div>}
      {!r && !err && <div className="muted">Loading…</div>}
      {r && shown.length === 0 && <div className="muted">Nobody matches.</div>}
      <div className="stack">
        {shown.map((p) => <Row key={p.id} p={p} onOpen={() => setOpen(p.id)} />)}
      </div>
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

function Row({ p, onOpen }: { p: ContributorRow; onOpen: () => void }) {
  return (
    <button type="button" className="tile" onClick={onOpen} style={{ textAlign: "left", cursor: "pointer", width: "100%" }}>
      <div className="spread" style={{ alignItems: "flex-start" }}>
        <div>
          <div className="ttitle" style={{ fontFamily: "var(--mono)", fontSize: "0.95rem" }}>{p.speaker_id}</div>
          <div className="tbody muted small" style={{ marginTop: 4 }}>{p.full_name ?? "no name"} · {LANG_NAME[p.primary_language ?? ""] ?? p.primary_language ?? "?"} · {[p.city, p.country].filter(Boolean).join(", ")} · joined {when(p.created_at)}{p.last_active_at ? ` · active ${when(p.last_active_at)}` : ""}</div>
          <div className="tbody muted small" style={{ marginTop: 2 }}>{p.rallies} rallies · {p.scenes} scenes · {hours(p.verified_seconds)} verified · quality {p.avg_quality != null ? Number(p.avg_quality).toFixed(2) : "none yet"} · earned {money(p.earned_usd)} · paid {money(p.paid_usd)}{Number(p.held_usd) > 0 ? ` · held ${money(p.held_usd)}` : ""}</div>
          <div className="chips" style={{ marginTop: 8 }}>
            {p.open_cases > 0 && <span className="chip gold">{p.open_cases} open case{p.open_cases === 1 ? "" : "s"}</span>}
            {p.confirmed_cases > 0 && <span className="chip coral">{p.confirmed_cases} confirmed</span>}
            {p.arena_strikes > 0 && <span className="chip">{p.arena_strikes} arena strike{p.arena_strikes === 1 ? "" : "s"}</span>}
            {p.quiet_count > 0 && <span className="chip">went quiet {p.quiet_count}×</span>}
          </div>
        </div>
        <span className="chip" style={{ flex: "none", borderColor: STATUS_COLOR[p.status], color: STATUS_COLOR[p.status] }}>{STATUS_LABEL[p.status]}</span>
      </div>
    </button>
  );
}

function Detail({ cid, onBack }: { cid: string; onBack: () => void }) {
  const [d, setD] = useState<ContributorDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [days, setDays] = useState("7");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const x = await contributor(cid);
      setD(x);
      setNote(x.admin_note ?? "");
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "Couldn't load this contributor.");
    }
  }, [cid]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (action: ContributorAction, r: string | null, n: number | null) => {
    setBusy(true);
    setErr(null);
    try {
      await contributorSet(cid, action, r, n);
      setReason("");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "That didn't work.");
    }
    setBusy(false);
  };

  return (
    <div className="shell" style={{ maxWidth: 720 }}>
      <button type="button" onClick={onBack} style={{ background: "none", border: "none", color: "var(--mut)", fontFamily: "var(--mono)", fontSize: "0.9rem", padding: 0, marginBottom: 10, cursor: "pointer" }}>‹ contributors</button>
      {err && <div className="tile" style={{ borderColor: "var(--coral)", marginBottom: 14 }}><div className="tbody" style={{ color: "var(--coral)" }}>{err}</div></div>}
      {!d && !err && <div className="muted">Loading…</div>}
      {d && (
        <>
          <div className="eyebrow" style={{ marginBottom: 6 }}>{d.full_name ?? "Contributor"} · {d.email ?? "no email"} · {LANG_NAME[d.primary_language ?? ""] ?? d.primary_language ?? "?"}{d.languages.length > 1 ? ` (+${d.languages.length - 1})` : ""} · {[d.city, d.country].filter(Boolean).join(", ")}</div>
          <h1 className="h1" style={{ marginBottom: 14, fontFamily: "var(--mono)", fontSize: "clamp(1.3rem,5vw,1.8rem)" }}>{d.speaker_id}</h1>

          <div className="sheet" style={{ marginBottom: 18 }}>
            <div className="handle" />
            <div className="shead"><i className={d.status === "active" ? undefined : "g"} />Status · {STATUS_LABEL[d.status]}</div>
            {d.status === "paused" && <div className="tile" style={{ borderColor: "var(--gold)" }}><div className="tlbl" style={{ color: "var(--gold)" }}>Paused until {when(d.paused_until ?? "")}</div><div className="tbody small">{d.paused_reason}</div></div>}
            {d.status === "closed" && <div className="tile" style={{ borderColor: "var(--coral)" }}><div className="tlbl" style={{ color: "var(--coral)" }}>Closed {when(d.closed_at ?? "")}</div><div className="tbody small">{d.closed_reason ?? "by a clause 15 decision"}</div></div>}
            {d.status === "withdrawn" && <div className="tile dash"><div className="tbody small">Consent withdrawn {when(d.withdrawn_at ?? "")}. Their sessions leave future deliveries.</div></div>}
            <div className="row2">
              <div className="tile"><div className="tlbl">Verified</div><div className="ttitle">{hours(d.verified_seconds)}</div><div className="tbody muted small">{d.rallies} rallies · {d.scenes} scenes · {d.abandoned} closed early by them</div></div>
              <div className="tile"><div className="tlbl">Quality</div><div className="ttitle">{d.avg_quality != null ? Number(d.avg_quality).toFixed(2) : "none yet"}</div><div className="tbody muted small">average across verified sessions</div></div>
              <div className="tile"><div className="tlbl">Money</div><div className="ttitle">{money(d.earned_usd)}</div><div className="tbody muted small">paid {money(d.paid_usd)} · ready {money(d.cleared_usd)}{Number(d.held_usd) > 0 ? ` · held ${money(d.held_usd)}` : ""}</div></div>
              <div className="tile"><div className="tlbl">Integrity</div><div className="ttitle">{d.open_cases} open</div><div className="tbody muted small">{d.confirmed_cases} confirmed · {d.arena_strikes} arena strikes · quiet {d.quiet_count}×</div></div>
            </div>
            <div className="tile dash"><div className="tlbl">Consent</div><div className="tbody small">{d.consent ? `Agreement v${d.consent.agreement_version}, signed ${when(d.consent.signed_at)}${d.consent.withdrawn_at ? `, withdrawn ${when(d.consent.withdrawn_at)}` : ""}` : "No record"}{d.consent ? <span style={{ fontFamily: "var(--mono)", color: "var(--mut)" }}> · {d.consent.record_sha256.slice(0, 12)}…</span> : null}</div></div>
          </div>

          <div className="sheet" style={{ marginBottom: 18 }}>
            <div className="handle" />
            <div className="shead"><i className="g" />Controls</div>
            {d.status !== "closed" && d.status !== "withdrawn" && (
              <>
                <div className="field"><label>Reason · the contributor sees it</label><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. several takes sounded read, not played; let's talk first" /></div>
                <div className="btn-row">
                  {d.status === "paused" ? (
                    <button className="pill ghost" style={{ width: "auto" }} disabled={busy} onClick={() => void act("unpause", null, null)}>Lift the pause</button>
                  ) : (
                    <>
                      <div className="field" style={{ width: 90, flex: "none" }}><label>Days</label><input inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} /></div>
                      <button className="pill ghost" style={{ width: "auto" }} disabled={busy || reason.trim().length < 3} onClick={() => void act("pause", reason, Number(days) || 7)}>Pause</button>
                    </>
                  )}
                  <button className="pill" style={{ width: "auto", background: "var(--coral)", color: "#0d0b08" }} disabled={busy || reason.trim().length < 3} onClick={() => void act("close", reason, null)}>Close the account</button>
                </div>
                <div className="tbody muted small">A pause blocks new rallies and bookings until it lifts; verified earnings still pay. Closing ends open rallies and bookings; earnings from sessions not under a case are still paid.</div>
              </>
            )}
            {d.status === "closed" && <button className="pill ghost" style={{ width: "auto" }} disabled={busy} onClick={() => void act("reopen", null, null)}>Reopen the account</button>}
            <div className="field"><label>Private note · staff only</label><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything the team should know." /></div>
            <button className="pill ghost" style={{ width: "auto" }} disabled={busy || note === (d.admin_note ?? "")} onClick={() => void act("note", note, null)}>Save the note</button>
          </div>

          <div className="sheet" style={{ marginBottom: 18 }}>
            <div className="handle" />
            <div className="shead"><i />Sessions · {d.sessions.length}</div>
            {d.sessions.length === 0 && <div className="tbody muted small">None yet.</div>}
            {d.sessions.map((s) => (
              <div key={s.id} className="tile">
                <div className="spread" style={{ alignItems: "flex-start" }}>
                  <div>
                    <div className="tbody small">{s.title} · {s.mode === "live" ? "live scene" : "rally"} with {s.partner ?? "?"} · {when(s.at)}</div>
                    <div className="tbody muted small" style={{ marginTop: 2 }}>{s.status}{s.abandoned_reason ? ` (${s.abandoned_reason.replace(/_/g, " ")}${s.abandoned_by_me ? ", by them" : ""})` : ""} · {Math.round(Number(s.my_seconds))} s of theirs{s.earned_usd != null ? ` · ${money(s.earned_usd)} ${s.earning_status}` : ""}{s.audit_outcome ? ` · audit ${s.audit_outcome}` : ""}</div>
                  </div>
                  <span className="chip" style={{ flex: "none" }}>{s.verified ? TIER_WORD[s.quality_tier ?? ""] ?? s.quality_tier : "not verified"}</span>
                </div>
              </div>
            ))}
          </div>

          {(d.cases.length > 0 || d.payouts.length > 0 || d.bookings.length > 0) && (
            <div className="sheet" style={{ marginBottom: 18 }}>
              <div className="handle" />
              <div className="shead"><i className="g" />Cases, payouts, bookings</div>
              {d.cases.map((c) => <div key={c.id} className="tile"><div className="tbody small">Case · {REASON_LABEL[c.reason as keyof typeof REASON_LABEL] ?? c.reason} · {c.decision ? `decided: ${c.decision.replace(/_/g, " ")}` : c.status.replace(/_/g, " ")} · {when(c.created_at)}</div></div>)}
              {d.payouts.map((p) => <div key={p.id} className="tile"><div className="tbody small">Payout · {money(p.amount_usd)} by {p.rail} · {p.status} · {when(p.paid_at ?? p.requested_at)}{p.reference ? ` · ${p.reference}` : ""}</div></div>)}
              {d.bookings.map((b) => <div key={b.id} className="tile"><div className="tbody small">Booking · {new Date(b.starts_at).toLocaleString("en-GB", { timeZone: "Africa/Lagos", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} Lagos · {b.status.replace(/_/g, " ")}</div></div>)}
            </div>
          )}

          {d.notifications.length > 0 && (
            <div className="sheet" style={{ marginBottom: 18 }}>
              <div className="handle" />
              <div className="shead"><i />Emails · {d.notifications.length}</div>
              {d.notifications.map((n) => <div key={n.id} className="tile"><div className="tbody small">{when(n.created_at)} · {NOTIFY_LABEL[n.kind] ?? n.kind} · {n.sent_at ? "sent" : n.error ? `failed: ${n.error}` : "waiting"}{n.attempts > 1 ? ` · ${n.attempts} attempts` : ""}</div></div>)}
            </div>
          )}
          {d.events.length > 0 && (
            <div className="sheet">
              <div className="handle" />
              <div className="shead"><i />Staff actions</div>
              {d.events.map((e, n) => <div key={n} className="tile"><div className="tbody small">{when(e.at)} · {e.actor ?? "?"} · {KIND_LABEL[e.kind] ?? e.kind}{e.detail.reason ? ` · ${String(e.detail.reason)}` : ""}{e.detail.days ? ` · ${String(e.detail.days)} days` : ""}</div></div>)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
