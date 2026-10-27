import { useCallback, useEffect, useState } from "react";
import { LANG_NAME } from "@/lib/game";
import { availability, book, cancel, lagos, lagosTime, mine, reschedule, slotsForDay, untilLabel, type Availability, type Booking, type Mine } from "@/lib/arena";
import { isDemo } from "@/lib/demo";
import { Notice, Page, TopBar } from "@/components/ankara-ui";

interface Props {
  language: string;
  onBack: () => void;
  onJoin: (sessionId: string) => void;
}

const STATUS_WORD: Record<string, string> = { open: "waiting for a partner", paired: "paired", cancelled: "cancelled", late_cancel: "cancelled late", lapsed: "nobody else booked", done: "played", no_show: "you did not show", showed_up: "partner did not show · you were credited" };

/* ============================================================================
   The booth in the approved "Ankara Blocks" direction.

   Scenes are the prototype's Live screen: .slots of coloured .slot blocks. The
   time grid has no prototype equivalent (the mock never booked anything), so it
   is .chip in a .slotgrid, both built from the tokens already in the skin.
   availability / book / reschedule / cancel and every cut-off rule are
   untouched; only the markup changed.
   ========================================================================= */
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
    <Page>
      <TopBar onBack={onBack} backLabel="Back home" eyebrow={`Live Arena · ${LANG_NAME[language] ?? language} · Lagos time`} title={moving ? "Pick the new time." : "Book a scene."} />

      {err && <Notice tone="coral">{err}</Notice>}
      {flash && <Notice>{flash}</Notice>}
      {paused && <Notice>Live bookings are paused until {lagos(m!.paused_until!)} after missed scenes. Ping-Pong stays open, and your verified earnings are not affected.</Notice>}

      {m && m.upcoming.length > 0 && (
        <>
          <div className="sec-h"><h3>Your scenes</h3></div>
          <div className="slots">
            {m.upcoming.map((b) => (
              <div key={b.slot_id} className={`blk ${b.status === "paired" ? "blk-mint pat-zig-6" : "blk-lilac pat-dia-6"} slot`}>
                <span className="chip chip-cream">{STATUS_WORD[b.status] ?? b.status}</span>
                <b>{lagos(b.starts_at)}</b>
                <span>{untilLabel(b.starts_at)} · {b.status === "paired" ? `paired with ${b.partner ?? "a stranger"}; the room opens ${cfg?.open_before_minutes ?? 5} minutes before` : "waiting for someone to pick the same time"}</span>
                <div className="btn-row" style={{ marginTop: 6 }}>
                  {b.can_join && b.session_id && <button className="btn btn-ink btn-sm" type="button" onClick={() => onJoin(b.session_id!)}>Join the room</button>}
                  {!b.can_join && (b.reschedule_count ?? 0) === 0 && <button className="btn btn-outline btn-sm" type="button" disabled={busy} onClick={() => { setMoving(b); setPick(null); setFlash(null); }}>Move once</button>}
                  <button className="btn btn-outline btn-sm" type="button" disabled={busy} onClick={() => void doCancel(b)}>Cancel</button>
                </div>
              </div>
            ))}
          </div>
          {moving && <p className="note-p">Moving {lagos(moving.starts_at)}. Pick a new time below. <button className="btn btn-outline btn-sm" type="button" onClick={() => setMoving(null)}>Keep it</button></p>}
        </>
      )}

      <div className="sec-h"><h3>{moving ? "New time" : "Pick a time"}</h3></div>
      <div className="chips">
        {[0, 1, 2, 3, 4, 5, 6].map((d) => (
          <button key={d} type="button" className={`chip ${day === d ? "chip-ink" : "chip-cream"}`} aria-pressed={day === d} onClick={() => { setDay(d); setPick(null); }}>
            {d === 0 ? "Today" : d === 1 ? "Tomorrow" : lagos(dayDate(d), { weekday: "short", day: "numeric" })}
          </button>
        ))}
      </div>
      <p className="note-p" style={{ marginTop: 8 }}>Mint slots already have a player waiting: pick one and you are paired at once. Any other slot pairs you with the next player who picks it. Scenes last {Math.round((cfg?.scene_seconds ?? 300) / 60)} minutes.</p>
      <div className="slotgrid" style={{ marginTop: 10 }}>
        {slots.map((s) => {
          const t = s.getTime();
          const w = waitingAt.get(t) ?? 0;
          const off = t < earliest;
          const on = pick?.getTime() === t;
          return (
            <button key={t} type="button" className={`chip ${on ? "chip-ink" : w ? "chip-mint" : "chip-cream"}`} aria-pressed={on} disabled={off || busy || Boolean(paused)} onClick={() => setPick(s)} title={w ? `${w} waiting` : ""}>
              {lagosTime(s)}{w ? <i>{w}</i> : null}
            </button>
          );
        })}
      </div>

      {pick && (
        <div className="blk blk-gold pat-rings-6 bal">
          <div className="lab">{moving ? "Move to" : "Book"}</div>
          <h3 style={{ fontSize: 20, marginTop: 4 }}>{lagos(pick)}</h3>
          <p style={{ fontSize: 13.5, fontWeight: 500, marginTop: 4 }}>{waitingAt.get(pick.getTime()) ? "Paired straight away with the player waiting there." : "Someone picking the same time pairs with you."}</p>
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button className="btn btn-ink" type="button" disabled={busy} onClick={() => void confirm()}>{busy ? "Booking…" : moving ? "Move it" : "Book it"}</button>
            <button className="btn btn-outline" type="button" disabled={busy} onClick={() => setPick(null)}>Not this one</button>
          </div>
        </div>
      )}

      <div className="card pad" style={{ marginTop: 16 }}>
        <div className="eyebrow">How the booth works</div>
        <p>
          Two players, one scene, {Math.round((cfg?.scene_seconds ?? 300) / 60)} minutes, on your phones, each of you recorded separately. The room opens {cfg?.open_before_minutes ?? 5} minutes before. You can move a booking once, up to {cfg?.reschedule_cutoff_hours ?? 2} hours before it starts, and cancel a paired scene without a strike up to {cfg?.cancel_cutoff_hours ?? 2} hours before. Not in the room {cfg?.join_grace_minutes ?? 10} minutes after the start is a no-show: a strike for you, and {cfg?.showed_up_credit_minutes ?? 5} minutes at the base rate credited to the player who showed up. {cfg?.strikes_to_pause ?? 3} strikes pause live bookings for {cfg?.pause_days ?? 14} days. Strikes never touch verified earnings and are not an integrity matter.
          {m && m.strikes > 0 ? ` You have ${m.strikes} strike${m.strikes === 1 ? "" : "s"}.` : ""}
        </p>
      </div>

      {m && m.past.length > 0 && (
        <>
          <div className="sec-h"><h3>Past scenes</h3></div>
          <ul className="card lines">
            {m.past.map((b) => (
              <li key={b.slot_id}>
                <span className="t">{lagos(b.starts_at)}</span>
                <span className="chip chip-cream">{STATUS_WORD[b.status] ?? b.status}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {isDemo() && <p className="note-p">Demo · time is compressed: a mint slot pairs you and opens the room at once.</p>}
    </Page>
  );
}
