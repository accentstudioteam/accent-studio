import { useCallback, useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { LANG_NAME } from "@/lib/game";
import { availability, book, cancel, lagos, lagosTime, mine, reschedule, slotsForDay, untilLabel, type Availability, type Booking, type Mine } from "@/lib/arena";
import { isDemo } from "@/lib/demo";

interface Props {
  language: string;
  onBack: () => void;
  onJoin: (sessionId: string) => void;
}

const STATUS_WORD: Record<string, string> = { open: "waiting for a partner", paired: "paired", cancelled: "cancelled", late_cancel: "cancelled late", lapsed: "nobody else booked", done: "played", no_show: "you did not show", showed_up: "partner did not show · you were credited" };

/** The booth: pick a 15-minute slot, get paired with whoever picks the same one, show up, play the scene. */
export function Booth({ language, onBack, onJoin }: Props) {
  const [m, setM] = useState<Mine | null>(null);
  const [day, setDay] = useState(0);
  const [avail, setAvail] = useState<Availability[]>([]);
  const [pick, setPick] = useState<Date | null>(null);
  const [moving, setMoving] = useState<Booking | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setM(await mine());
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "Couldn't load the booth.");
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), isDemo() ? 3_000 : 30_000);
    return () => window.clearInterval(id);
  }, [load]);

  const dayDate = (offset: number) => {
    const t = new Date();
    t.setUTCDate(t.getUTCDate() + offset);
    return t;
  };
  useEffect(() => {
    if (!m) return;
    const d = dayDate(day);
    const slots = slotsForDay(d, m.config);
    if (!slots.length) return;
    void availability(language, slots[0], slots[slots.length - 1]).then(setAvail).catch(() => setAvail([]));
  }, [m, day, language]);

  const confirm = async () => {
    if (!pick) return;
    setBusy(true);
    setErr(null);
    try {
      const r = moving ? await reschedule(moving.slot_id, pick) : await book(language, pick);
      setFlash(r.paired ? `Paired for ${lagos(r.starts_at)}. Be in the room five minutes early; the other player is counting on you.` : `Booked ${lagos(r.starts_at)}. You are paired the moment someone else picks that time; we tell you here.`);
      setPick(null);
      setMoving(null);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "Couldn't book.");
    }
    setBusy(false);
  };

  const doCancel = async (b: Booking) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await cancel(b.slot_id);
      setFlash(r.strike ? "Cancelled. That was inside two hours of a paired scene, so it counts as a strike." : "Cancelled. No strike.");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "Couldn't cancel.");
    }
    setBusy(false);
  };

  const cfg = m?.config;
  const waitingAt = new Map(avail.map((a) => [new Date(a.starts_at).getTime(), a.waiting]));
  const slots = cfg ? slotsForDay(dayDate(day), cfg) : [];
  const earliest = cfg ? Date.now() + cfg.book_ahead_minutes * 60_000 : Date.now();
  const paused = m?.paused_until && new Date(m.paused_until).getTime() > Date.now();

  return (
    <div className="app">
      <div className="topbar">
        <button className="brand" onClick={onBack} style={{ background: "none", border: "none" }}><span style={{ color: "var(--mut)", fontFamily: "var(--mono)", fontSize: "0.9rem" }}>‹ home</span></button>
        <Logo height={22} />
      </div>
      <div className="shell">
        <div className="eyebrow" style={{ marginBottom: 6 }}>Live Arena · {LANG_NAME[language] ?? language} · times in Lagos</div>
        <h1 className="h1" style={{ marginBottom: 14, fontSize: "clamp(1.4rem,6vw,2rem)" }}>{moving ? "Pick the new time." : "Book a scene."}</h1>
        {err && <div className="tile" style={{ borderColor: "var(--coral)", marginBottom: 14 }}><div className="tbody" style={{ color: "var(--coral)" }}>{err}</div></div>}
        {flash && <div className="tile" style={{ borderColor: "var(--acc)", marginBottom: 14 }}><div className="tbody">{flash}</div></div>}
        {paused && <div className="tile" style={{ borderColor: "var(--gold)", marginBottom: 14 }}><div className="tbody">Live bookings are paused until {lagos(m!.paused_until!)} after missed scenes. Ping-Pong stays open, and your verified earnings are not affected.</div></div>}

        {m && m.upcoming.length > 0 && (
          <div className="sheet" style={{ marginBottom: 18 }}>
            <div className="handle" />
            <div className="shead"><i className="g" />Your scenes</div>
            {m.upcoming.map((b) => (
              <div key={b.slot_id} className={b.status === "paired" ? "tile acc" : "tile dash"}>
                <div className="spread" style={{ alignItems: "flex-start" }}>
                  <div>
                    <div className="ttitle" style={{ fontSize: "1rem" }}>{lagos(b.starts_at)} · {untilLabel(b.starts_at)}</div>
                    <div className="tbody muted small" style={{ marginTop: 3 }}>{b.status === "paired" ? `Paired with ${b.partner ?? "a stranger"}. The room opens ${cfg?.open_before_minutes ?? 5} minutes before.` : "Waiting for someone to pick the same time. You are paired the moment they do."}</div>
                  </div>
                  <span className="chip" style={{ flex: "none" }}>{STATUS_WORD[b.status] ?? b.status}</span>
                </div>
                <div className="btn-row" style={{ marginTop: 10 }}>
                  {b.can_join && b.session_id && <button className="pill mint" onClick={() => onJoin(b.session_id!)}>Join the room</button>}
                  {!b.can_join && (b.reschedule_count ?? 0) === 0 && <button className="pill ghost" disabled={busy} onClick={() => { setMoving(b); setPick(null); setFlash(null); }}>Move once</button>}
                  <button className="pill ghost" disabled={busy} onClick={() => void doCancel(b)}>Cancel</button>
                </div>
              </div>
            ))}
            {moving && <div className="tbody muted small">Moving {lagos(moving.starts_at)}. Pick a new time below. <button type="button" onClick={() => setMoving(null)} style={{ background: "none", border: "none", color: "var(--acc)", padding: 0, font: "inherit", cursor: "pointer" }}>Keep it</button></div>}
          </div>
        )}

        <div className="sheet" style={{ marginBottom: 18 }}>
          <div className="handle" />
          <div className="shead"><i />{moving ? "New time" : "Pick a time"}</div>
          <div className="chips" style={{ marginBottom: 8 }}>
            {[0, 1, 2, 3, 4, 5, 6].map((d) => <button key={d} type="button" className={`chip${day === d ? " on" : ""}`} onClick={() => { setDay(d); setPick(null); }}>{d === 0 ? "Today" : d === 1 ? "Tomorrow" : lagos(dayDate(d), { weekday: "short", day: "numeric" })}</button>)}
          </div>
          <div className="tbody muted small" style={{ marginBottom: 8 }}>Green slots already have a player waiting: pick one and you are paired at once. Any other slot pairs you with the next player who picks it. Scenes last {Math.round((cfg?.scene_seconds ?? 300) / 60)} minutes.</div>
          <div className="slotgrid">
            {slots.map((s) => {
              const t = s.getTime();
              const w = waitingAt.get(t) ?? 0;
              const off = t < earliest;
              const on = pick?.getTime() === t;
              return (
                <button key={t} type="button" className={`slot${w ? " waiting" : ""}${on ? " on" : ""}`} disabled={off || busy || Boolean(paused)} onClick={() => setPick(s)} title={w ? `${w} waiting` : ""}>
                  {lagosTime(s)}{w ? <i>{w}</i> : null}
                </button>
              );
            })}
          </div>
          {pick && (
            <div className="tile" style={{ marginTop: 10, borderColor: "var(--acc)" }}>
              <div className="tbody">{moving ? "Move to" : "Book"} <b>{lagos(pick)}</b>{waitingAt.get(pick.getTime()) ? ", paired straight away with the player waiting there." : ". Someone picking the same time pairs with you."}</div>
              <div className="btn-row" style={{ marginTop: 8 }}>
                <button className="pill mint" disabled={busy} onClick={() => void confirm()}>{busy ? "Booking…" : moving ? "Move it" : "Book it"}</button>
                <button className="pill ghost" disabled={busy} onClick={() => setPick(null)}>Not this one</button>
              </div>
            </div>
          )}
        </div>

        <div className="tile" style={{ marginBottom: 14 }}>
          <div className="tlbl">How the booth works</div>
          <div className="tbody muted small">
            Two players, one scene, {Math.round((cfg?.scene_seconds ?? 300) / 60)} minutes, on your phones, each of you recorded separately. The room opens {cfg?.open_before_minutes ?? 5} minutes before. You can move a booking once, up to {cfg?.reschedule_cutoff_hours ?? 2} hours before it starts, and cancel a paired scene without a strike up to {cfg?.cancel_cutoff_hours ?? 2} hours before. Not in the room {cfg?.join_grace_minutes ?? 10} minutes after the start is a no-show: a strike for you, and {cfg?.showed_up_credit_minutes ?? 5} minutes at the base rate credited to the player who showed up. {cfg?.strikes_to_pause ?? 3} strikes pause live bookings for {cfg?.pause_days ?? 14} days. Strikes never touch verified earnings and are not an integrity matter.
            {m && m.strikes > 0 ? ` You have ${m.strikes} strike${m.strikes === 1 ? "" : "s"}.` : ""}
          </div>
        </div>

        {m && m.past.length > 0 && (
          <div className="sheet" style={{ marginBottom: 18 }}>
            <div className="handle" />
            <div className="shead"><i />Past scenes</div>
            {m.past.map((b) => (
              <div key={b.slot_id} className="tile">
                <div className="spread"><div className="tbody small">{lagos(b.starts_at)}</div><span className="chip" style={{ flex: "none", fontSize: "0.6rem" }}>{STATUS_WORD[b.status] ?? b.status}</span></div>
              </div>
            ))}
          </div>
        )}
        {isDemo() && <div className="muted small center" style={{ marginBottom: 18 }}>Demo · time is compressed: a green slot pairs you and opens the room at once</div>}
      </div>
    </div>
  );
}
