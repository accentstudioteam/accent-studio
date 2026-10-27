import { useCallback, useEffect, useState } from "react";
import { LANG_NAME, dueLabel, mySessions, startRally, type RallySummary } from "@/lib/game";
import type { Onboarding } from "@/lib/types";
import { demo, isDemo } from "@/lib/demo";
import { demoAccount } from "@/lib/demoAccount";
import { myCases, daysLeft, type MyCase } from "@/lib/verify";
import { money, myEarnings, type MyEarnings } from "@/lib/earn";
import { lagos, mine as arenaMine, untilLabel, type Mine as ArenaMine } from "@/lib/arena";
import { avatarFor } from "@/components/ankara-avatars";
import { Ava, IcArrow, Notice, Page } from "@/components/ankara-ui";

/* ============================================================================
   Home and Play in the approved "Ankara Blocks" direction.

   The class names are the prototype's (.topbar, .earn, .livecard, .cta,
   .sec-h, .rallies, .rally-row), which live under .ankara in tokens.css.
   The data, the polling and every RPC are exactly the ones that were here:
   mySessions / myCases / myEarnings / arenaMine on the same 20 s loop (2.5 s
   in the demo), startRally on the same button, and onCounts fed the same
   three numbers for the dock badges.
   ========================================================================= */

const POLL_MS = 20_000;

export function PlayerHome({ me, mode, onOpenRally, onNotices, onEarnings, onBooth, onPlayTab, onJoinScene, onAccount, onCounts }: { me: Onboarding; onOpenRally: (sessionId: string) => void; onNotices: () => void; onEarnings: () => void; onBooth: () => void; onPlayTab: () => void; onJoinScene: (sid: string) => void; onAccount: () => void; mode: "home" | "play"; onCounts?: (c: { play: number; live: number; soon: boolean }) => void }) {
  const [rallies, setRallies] = useState<RallySummary[]>([]);
  const [notices, setNotices] = useState<MyCase[]>([]);
  const [earn, setEarn] = useState<MyEarnings | null>(null);
  const [arena, setArena] = useState<ArenaMine | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const language = me.contributor?.primary_language ?? "pcm";

  const load = useCallback(async () => {
    try {
      const rs = await mySessions();
      setRallies(rs);
      setNotices(await myCases().catch(() => []));
      setEarn(await myEarnings().catch(() => null));
      const ar = await arenaMine().catch(() => null);
      setArena(ar);
      const soonMs = 60 * 60_000;
      onCounts?.({
        play: rs.filter((r) => (r.status === "waiting" || r.status === "active") && r.my_turn).length,
        live: ar?.upcoming.filter((b) => b.can_join).length ?? 0,
        soon: !!ar?.upcoming.some((b) => b.status === "paired" && new Date(b.starts_at).getTime() - Date.now() < soonMs),
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't load your rallies.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), isDemo() ? 2_500 : POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const play = async () => {
    setBusy(true);
    setErr(null);
    try {
      const { session_id } = await startRally(language);
      onOpenRally(session_id);
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "Couldn't start a rally.");
      setBusy(false);
    }
  };

  const live = (r: RallySummary) => r.status === "waiting" || r.status === "active";
  const yourTurn = rallies.filter((r) => live(r) && r.my_turn);
  const waiting = rallies.filter((r) => live(r) && !r.my_turn);
  const done = rallies.filter((r) => !live(r));

  const speakerId = me.contributor?.speaker_id ?? "cast";
  const next = arena?.upcoming[0];
  const joinable = arena?.upcoming.find((b) => b.can_join && b.session_id);
  const openNotice = notices.find((n) => n.status === "notice_sent");

  return (
    <Page>
      <div className="topbar">
        <Ava who={avatarFor(speakerId)} size={46} />
        <div>
          <div className="lab muted">{mode === "play" ? "Ping-Pong" : "Playing in"} · {LANG_NAME[language] ?? language}</div>
          <h1 className="hi">{mode === "play" ? "Your rallies." : "Today."}</h1>
        </div>
        <button className="chip chip-cream" type="button" onClick={onAccount} aria-label="Your account">{speakerId}</button>
      </div>

      {isDemo() && (
        <div className="card pad" style={{ marginTop: 14 }}>
          <div className="lab">Demo · nothing is saved</div>
          <p>
            You are a signed contributor. A simulated partner joins, rates your takes and replies with real Pidgin clips. The third take is rated low on purpose so you can see the redo.
          </p>
          <button className="btn btn-ink btn-sm" type="button" style={{ marginTop: 10 }} onClick={() => { demo.reset(); demoAccount.reset(); void load(); }}>Reset the demo</button>
        </div>
      )}

      {notices.length > 0 && (
        <button className="blk blk-coral press livecard" type="button" onClick={onNotices}>
          <div className="lab">Clause 15 · {openNotice ? "a session of yours is being checked" : notices.some((n) => n.status === "responded") ? "your response is in" : "decided"}</div>
          <h3 style={{ marginTop: 4 }}>{openNotice ? `${daysLeft(openNotice.respond_by)} days to respond` : "Open to read the details"}</h3>
          <p>{openNotice ? "Nothing else is withheld." : "The notice and the decision are both here."}</p>
        </button>
      )}

      {earn && (
        <button className="blk blk-gold pat-rings-6 press earn" type="button" onClick={onEarnings}>
          <span className="sticker sticker-gold">Money</span>
          <div className="lab">Earnings</div>
          <div className="money">
            <span className="naira">{money(earn.cleared_usd)}</span>
            <span className="usd">ready</span>
          </div>
          {(Number(earn.held_usd) > 0 || Number(earn.requested_usd) > 0) && (
            <div className="chips" style={{ marginTop: 8 }}>
              {Number(earn.held_usd) > 0 && <span className="chip chip-ink">{money(earn.held_usd)} on hold</span>}
              {Number(earn.requested_usd) > 0 && <span className="chip chip-cream">{money(earn.requested_usd)} on its way</span>}
            </div>
          )}
          <div className="row">
            <span style={{ fontSize: 12.5, fontWeight: 500, lineHeight: 1.35 }}>{money(earn.base_rates.standard)} per verified hour × your tier · paid so far {money(earn.paid_usd)}</span>
            <span className="chip chip-ink" style={{ flex: "none" }}>Open</span>
          </div>
        </button>
      )}

      {mode === "home" && (
        <div className="blk blk-lilac pat-dia-6 livecard">
          <div className="lt">
            <div className="lab">Live Arena</div>
            {next && <span className="count">{untilLabel(next.starts_at)}</span>}
          </div>
          <h3 style={{ marginTop: 6 }}>{next ? lagos(next.starts_at) : "Five minutes, live, with a stranger"}</h3>
          <p>{next ? (next.status === "paired" ? `Paired with ${next.partner ?? "a stranger"}. Be there five minutes early.` : "Waiting for a partner to pick the same time.") : "Pick a 15-minute slot, get paired with whoever picks the same one, improvise a scene on your phones, each of you recorded separately."}</p>
          <div className="lb">
            {joinable ? (
              <button className="btn btn-ink" type="button" onClick={() => onJoinScene(joinable.session_id!)}>Join the room now</button>
            ) : (
              <button className="btn btn-ink" type="button" onClick={onBooth}>{next ? "Open the booth" : "Book a scene"}</button>
            )}
          </div>
        </div>
      )}

      <button className="blk blk-ink cta" type="button" disabled={busy} onClick={() => void play()}>
        <span>{busy ? "Finding a card…" : "Play a rally"}</span>
        <span className="arrow"><IcArrow /></span>
      </button>

      {err && <div style={{ marginTop: 14 }}><Notice tone="coral">{err}</Notice></div>}

      <div className="card pad" style={{ marginTop: 16 }}>
        <div className="eyebrow">{mode === "play" ? "How a rally works" : "Ping-Pong"}</div>
        <p className="note-p" style={{ marginTop: 6 }}>
          {mode === "home" ? `${yourTurn.length ? `${yourTurn.length} waiting on you` : "Nothing waiting on you"}${waiting.length ? ` · ${waiting.length} with a partner` : ""}${done.length ? ` · ${done.length} closed` : ""}. ` : ""}You get a card in your language: a situation and who you are in it. You record one voice note, up to 30 seconds, your way. A stranger gets the other role, listens, rates your take on four things, and records theirs. Six turns and the rally is done. Below 4 out of 5 you say it again. Each reply is due within 24 hours; if a partner goes quiet the rally closes, your takes still count, and your next Play pairs you fresh.
        </p>
      </div>

      {yourTurn.length > 0 && (
        <>
          <div className="sec-h"><h3>Your turn</h3><span className="lab muted">{yourTurn.length}</span></div>
          <div className="rallies">{yourTurn.map((r) => <RallyRow key={r.session_id} r={r} onOpen={onOpenRally} accent />)}</div>
        </>
      )}

      {mode === "home" && (waiting.length > 0 || done.length > 0) && (
        <button className="btn btn-outline btn-block" type="button" style={{ marginTop: 16 }} onClick={onPlayTab}>All your rallies · {rallies.length}</button>
      )}

      {mode === "play" && waiting.length > 0 && (
        <>
          <div className="sec-h"><h3>Waiting on a partner</h3><span className="lab muted">{waiting.length}</span></div>
          <div className="rallies">{waiting.map((r) => <RallyRow key={r.session_id} r={r} onOpen={onOpenRally} />)}</div>
        </>
      )}

      {mode === "play" && done.length > 0 && (
        <>
          <div className="sec-h"><h3>Closed</h3><span className="lab muted">{done.length}</span></div>
          <div className="rallies">{done.map((r) => <RallyRow key={r.session_id} r={r} onOpen={onOpenRally} />)}</div>
        </>
      )}

      {rallies.length === 0 && (
        <div className="card pad" style={{ marginTop: 16 }}>
          <h3 style={{ fontSize: 18 }}>No rallies yet.</h3>
          <p className="note-p" style={{ marginTop: 4 }}>Tap Play a rally to get your first card. A stranger gets the other role; six turns and it is done.</p>
        </div>
      )}

      {mode === "home" && (
        <p className="note-p">Your agreement · signed v{me.consent?.agreement_version} · record {me.consent?.record_sha256.slice(0, 12)}… · withdraw any time from You.</p>
      )}
    </Page>
  );
}

function RallyRow({ r, onOpen, accent }: { r: RallySummary; onOpen: (id: string) => void; accent?: boolean }) {
  const when = new Date(r.updated_at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const sub = r.status === "complete" ? `Complete · ${r.turn_count} turns` : r.status === "abandoned" ? (r.abandoned_reason === "partner_quiet" ? "Partner went quiet · your takes are kept" : "Closed") : r.my_turn ? (r.turn_count === 0 ? "Record the first turn" : `Rate your partner, then record · due ${dueLabel(r.due_at)}`) : r.waiting_for_partner ? "Your take is in. Waiting for a partner to join" : `Partner's turn · due ${dueLabel(r.due_at)}`;
  return (
    <button type="button" className="card rally-row" onClick={() => onOpen(r.session_id)}>
      <Ava who={avatarFor(r.session_id, 5)} size={36} />
      <div>
        <b>{r.title}</b>
        <small>{sub} · {when}</small>
      </div>
      <span className={`chip ${accent ? "chip-mint" : "chip-cream"}`}>{r.turn_count}/{r.turns_target}</span>
    </button>
  );
}
