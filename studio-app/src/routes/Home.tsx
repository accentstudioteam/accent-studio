import { useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { NOTIFY_LABEL, notifyLog, notifyNow, type NotifyLog, type NotifyRun, type Overview } from "@/lib/admin";
import { money } from "@/lib/earn";

interface Props {
  ov: Overview | null;
  onGo: (view: string) => void;
  onRefresh: () => void;
  /** The demo shows the founder's dashboard without a signed-in admin. */
  asAdmin?: boolean;
}

const today = () => new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

/** The studio home. Admins get the dashboard: what is waiting, the numbers, the mail. Linguists get the Cutting Room doors. */
export function Home({ ov, onGo, onRefresh, asAdmin }: Props) {
  const { profile, session } = useAuth();
  const name = profile?.handle ?? session?.user.email?.split("@")[0] ?? (asAdmin ? "founder" : "there");
  const admin = asAdmin || !!profile?.is_admin;
  const [nl, setNl] = useState<NotifyLog | null>(null);
  const [run, setRun] = useState<NotifyRun | string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!admin) return;
    notifyLog().then(setNl).catch(() => setNl(null));
  }, [admin]);

  const sendNow = async () => {
    setSending(true);
    setRun(null);
    try {
      const r = await notifyNow();
      setRun(r);
      setNl(await notifyLog());
    } catch (e) {
      setRun(e instanceof Error ? e.message : "Couldn't send.");
    }
    setSending(false);
  };

  if (!admin) {
    return (
      <div className="shell" style={{ maxWidth: 720 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Cutting Room · {today()}</div>
        <h1 className="h1" style={{ marginBottom: 16 }}>Hey, {name}.</h1>
        <div className="sheet">
          <div className="handle" />
          <div className="shead"><i className="g" />Your desk</div>
          <div className="tile"><div className="tlbl">Verification queue</div><div className="tbody muted small">Finished rallies waiting for a linguist. Listen, transcribe as spoken, gloss, align, mark confidence, verify.</div></div>
          <button className="pill mint" onClick={() => onGo("verify")}>Open the queue</button>
          <div className="tile"><div className="tlbl">Audit</div><div className="tbody muted small">A second ear on sampled rallies verified by someone else.</div></div>
          <button className="pill ghost" onClick={() => onGo("audit")}>Open the audit queue</button>
          <div className="tile"><div className="tlbl">Clause 15 cases</div><div className="tbody muted small">Flags from the bench, reviewed by a person, decided by someone else.</div></div>
          <button className="pill ghost" onClick={() => onGo("integrity")}>Open the cases</button>
        </div>
      </div>
    );
  }

  const c = ov?.contributors;
  const cr = ov?.cutting_room;
  const m = ov?.money;
  const pl = ov?.play;
  const needs: { key: string; n: number; label: string; sub: string; gold?: boolean }[] = ov
    ? [
        { key: "verify", n: cr!.queue, label: "Rallies to verify", sub: "finished, waiting for a linguist" },
        { key: "audit", n: cr!.audit_pending, label: "Audits drawn", sub: "a second ear before delivery" },
        { key: "integrity", n: cr!.cases_open, label: "Open cases", sub: "clause 15, in review or awaiting a decision", gold: true },
        { key: "payouts", n: ov.money.requested_count, label: "Payouts to send", sub: `${money(m!.requested_usd)} requested`, gold: true },
        { key: "contributors", n: c!.identity_pending, label: "Identity checks", sub: "photos waiting for a look", gold: true },
        { key: "contributors", n: c!.data_requests_open, label: "Data requests", sub: "a copy or deletion, 30 days", gold: true },
        { key: "applications", n: ov.pipeline.applications_new, label: "New applications", sub: "from accentstudio.io/apply" },
        { key: "labs", n: ov.labs.inquiries_new, label: "Lab inquiries", sub: "sample-bundle requests" },
        { key: "projects", n: ov.labs.deliveries_ready, label: "Deliveries ready", sub: "bundles built, not yet handed over" },
      ]
    : [];
  const cronLine = nl ? (nl.cron.length ? nl.cron.map((x) => `${x.name} ${x.schedule}${x.active ? "" : " (off)"}`).join(" · ") : "no schedule found") : "";
  const lastLine = nl && nl.recent.length ? nl.recent.slice(0, 3).map((n) => `${NOTIFY_LABEL[n.kind] ?? n.kind} to ${n.speaker_id ?? "?"}${n.sent_at ? "" : n.error ? ` (failed: ${n.error})` : " (waiting)"}`).join(" · ") : "";
  const runLine = run == null ? "" : typeof run === "string" ? run : `Claimed ${run.claimed}, sent ${run.sent}, failed ${run.failed}.${run.results.some((r) => r.error) ? ` First error: ${run.results.find((r) => r.error)?.error}` : ""}`;

  return (
    <div className="shell dash">
      <div className="spread" style={{ marginBottom: 16, alignItems: "flex-start" }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Studio · {today()}</div>
          <h1 className="h1">Hey, {name}.</h1>
        </div>
        <button className="pill ghost auto" style={{ flex: "none" }} onClick={onRefresh}>Refresh</button>
      </div>

      {ov ? (
        <div className="stats">
          <div className="stat"><div className="tlbl">Contributors</div><div className="n">{c!.active}</div><div className="s">{c!.active_7d} played this week · {c!.paused} paused · {c!.closed} closed</div></div>
          <div className="stat"><div className="tlbl">This week</div><div className="n">{pl!.rallies_7d + pl!.scenes_7d}</div><div className="s">{pl!.rallies_7d} rallies · {pl!.scenes_7d} scenes · {pl!.active_now} live now · {pl!.bookings_upcoming} booked</div></div>
          <div className="stat"><div className="tlbl">Verified</div><div className="n">{cr!.verified_hours} h</div><div className="s">{cr!.verified_total} sessions · {ov.labs.projects_open} open project{ov.labs.projects_open === 1 ? "" : "s"}</div></div>
          <div className="stat"><div className="tlbl">Money</div><div className="n">{money(m!.requested_usd)}</div><div className="s">to send · {money(m!.cleared_usd)} ready · {money(m!.held_usd)} held · {money(m!.paid_usd)} paid</div></div>
        </div>
      ) : (
        <div className="muted" style={{ marginBottom: 14 }}>Loading the numbers…</div>
      )}

      <div className="dash-grid">
        <div className="sheet">
          <div className="handle" />
          <div className="shead"><i className="g" />Needs you</div>
          <div className="tile" style={{ padding: "2px 14px" }}>
            {needs.length === 0 && <div className="tbody muted small" style={{ padding: "10px 0" }}>Loading…</div>}
            {needs.map((x, i) => (
              <button key={`${x.key}-${i}`} type="button" className="need" onClick={() => onGo(x.key)}>
                <span className="nt">{x.label}<small>{x.sub}</small></span>
                <span className={`nn${x.n === 0 ? " zero" : x.gold ? " gold" : ""}`}>{x.n}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="stack">
          <div className="sheet">
            <div className="handle" />
            <div className="shead"><i />Reminders and statements</div>
            <div className="tile">
              <div className="tbody muted small">Reply due in four hours, a scene in an hour, a clause 15 window closing, a payout sent, and the month-end statement. The scheduler runs every fifteen minutes.</div>
              {nl && <div className="tbody muted small" style={{ marginTop: 6, fontFamily: "var(--mono)" }}>{nl.sent_7d} sent this week · {nl.unsent} waiting · {cronLine}</div>}
              {lastLine && <div className="tbody muted small" style={{ marginTop: 4 }}>Last: {lastLine}</div>}
              {runLine && <div className="tbody small" style={{ marginTop: 6, color: typeof run === "string" ? "var(--coral)" : "var(--acc)" }}>{runLine}</div>}
            </div>
            <button className="pill ghost" disabled={sending} onClick={() => void sendNow()}>{sending ? "Sending…" : "Send what is due now"}</button>
          </div>
          <div className="sheet">
            <div className="handle" />
            <div className="shead"><i />Shortcuts</div>
            <div className="btn-row" style={{ flexWrap: "wrap" }}>
              <button className="pill ghost auto" onClick={() => onGo("team")}>Team</button>
              <button className="pill ghost auto" onClick={() => onGo("cards")}>Card library</button>
              <button className="pill ghost auto" onClick={() => onGo("projects")}>Projects</button>
              <button className="pill ghost auto" onClick={() => onGo("settings")}>Settings</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
