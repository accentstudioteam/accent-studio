import { useCallback, useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { LANG_NAME, dueLabel, mySessions, startRally, type RallySummary } from "@/lib/game";
import type { Onboarding } from "@/lib/types";
import { demo, isDemo } from "@/lib/demo";
import { demoAccount } from "@/lib/demoAccount";
import { myCases, daysLeft, type MyCase } from "@/lib/verify";
import { money, myEarnings, type MyEarnings } from "@/lib/earn";
import { lagos, mine as arenaMine, untilLabel, type Mine as ArenaMine } from "@/lib/arena";

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

  return (
    <div className="app">
      <div className="topbar">
        <Logo height={22} />
        <button type="button" className="chip" aria-label="Your account" title="Your account" style={{ fontFamily: "var(--mono)", fontSize: "0.7rem", cursor: "pointer", whiteSpace: "nowrap" }} onClick={onAccount}>{me.contributor?.speaker_id ?? "cast"}</button>
      </div>
      <div className="shell">
        {isDemo() && (
          <div className="tile" style={{ borderColor: "var(--gold)", marginBottom: 16 }}>
            <div className="tlbl" style={{ color: "var(--gold)" }}>Demo · nothing is saved</div>
            <div className="tbody muted" style={{ fontSize: "0.85rem" }}>
              You are a signed contributor. A simulated partner joins, rates your takes and replies with real Pidgin clips. The third take is rated low on purpose so you can see the redo.{" "}
              <button type="button" onClick={() => { demo.reset(); demoAccount.reset(); void load(); }} style={{ background: "none", border: "none", color: "var(--acc)", padding: 0, font: "inherit", cursor: "pointer" }}>Reset the demo</button>
            </div>
          </div>
        )}
        {notices.length > 0 && (
          <button type="button" className="tile" onClick={onNotices} style={{ borderColor: "var(--gold)", marginBottom: 16, textAlign: "left", cursor: "pointer", width: "100%" }}>
            <div className="tlbl" style={{ color: "var(--gold)" }}>Clause 15 · {notices.some((n) => n.status === "notice_sent") ? "a session of yours is being checked" : notices.some((n) => n.status === "responded") ? "your response is in" : "decided"}</div>
            <div className="tbody" style={{ fontSize: "0.9rem" }}>
              {notices.some((n) => n.status === "notice_sent") ? `You have ${daysLeft(notices.find((n) => n.status === "notice_sent")?.respond_by ?? null)} days to respond. Nothing else is withheld.` : "Open to read the details."}
            </div>
          </button>
        )}
        {earn && (
          <button type="button" className="tile" onClick={onEarnings} style={{ marginBottom: 16, textAlign: "left", cursor: "pointer", width: "100%" }}>
            <div className="spread">
              <div>
                <div className="tlbl">Earnings</div>
                <div className="ttitle">{money(earn.cleared_usd)} ready{Number(earn.held_usd) > 0 ? ` · ${money(earn.held_usd)} on hold` : ""}{Number(earn.requested_usd) > 0 ? ` · ${money(earn.requested_usd)} on its way` : ""}</div>
                <div className="tbody muted" style={{ marginTop: 4, fontSize: "0.85rem" }}>{money(earn.base_rates.standard)} per verified hour times your tier · paid so far {money(earn.paid_usd)}</div>
              </div>
              <span className="chip" style={{ flex: "none" }}>Open</span>
            </div>
          </button>
        )}
        <div className="spread" style={{ marginBottom: 18, alignItems: "flex-start" }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>{mode === "play" ? "Ping-Pong" : "Playing in"} · {LANG_NAME[language] ?? language}</div>
            <h1 className="h1">{mode === "play" ? "Your rallies." : "Today."}</h1>
          </div>
        </div>

        {mode === "home" && (
        <div className="sheet" style={{ marginBottom: 18 }}>
          <div className="handle" />
          <div className="shead"><i className="g" />Live Arena</div>
          {(() => {
            const next = arena?.upcoming[0];
            const joinable = arena?.upcoming.find((b) => b.can_join && b.session_id);
            return (
              <>
                <div className={next ? "tile acc" : "tile"}>
                  <div className="tlbl">{next ? "Your next scene" : "Five minutes, live, with a stranger"}</div>
                  <div className="ttitle" style={{ fontSize: "1rem" }}>{next ? `${lagos(next.starts_at)} · ${untilLabel(next.starts_at)}` : "Book a scene in the booth."}</div>
                  <div className="tbody muted" style={{ marginTop: 4, fontSize: "0.85rem" }}>{next ? (next.status === "paired" ? `Paired with ${next.partner ?? "a stranger"}. Be there five minutes early.` : "Waiting for a partner to pick the same time.") : "Pick a 15-minute slot, get paired with whoever picks the same one, improvise a scene on your phones, each of you recorded separately."}</div>
                </div>
                {joinable ? <button className="pill" onClick={() => onJoinScene(joinable.session_id!)} style={{ background: "var(--live)", color: "#fff" }}>Join the room now</button> : <button className="pill ghost" onClick={onBooth}>{next ? "Open the booth" : "Book a scene"}</button>}
              </>
            );
          })()}
        </div>
        )}

        <div className="sheet" style={{ marginBottom: 18 }}>
          <div className="handle" />
          <div className="shead"><i className="g" />{mode === "play" ? "How a rally works" : "Ping-Pong"}</div>
          <div className="tile">
            <div className="tbody muted">
              {mode === "home" ? `${yourTurn.length ? `${yourTurn.length} waiting on you` : "Nothing waiting on you"}${waiting.length ? ` · ${waiting.length} with a partner` : ""}${done.length ? ` · ${done.length} closed` : ""}. ` : ""}You get a card in your language: a situation and who you are in it. You record one voice note, up to 30 seconds, your way. A stranger gets the other role, listens, rates your take on four things, and records theirs. Six turns and the rally is done. Below 4 out of 5 you say it again. Each reply is due within 24 hours; if a partner goes quiet the rally closes, your takes still count, and your next Play pairs you fresh.
            </div>
          </div>
          <button className="pill mint" disabled={busy} onClick={() => void play()}>{busy ? "Finding a card…" : "Play a rally"}</button>
          {err && <div className="tbody" style={{ color: "var(--coral)", marginTop: 8 }}>{err}</div>}
        </div>

        {yourTurn.length > 0 && (
          <>
            <span className="slabel">Your turn · {yourTurn.length}</span>
            <div className="stack" style={{ marginBottom: 18 }}>
              {yourTurn.map((r) => <RallyRow key={r.session_id} r={r} onOpen={onOpenRally} accent />)}
            </div>
          </>
        )}
        {mode === "home" && (waiting.length > 0 || done.length > 0) && <button className="pill ghost" style={{ marginBottom: 18 }} onClick={onPlayTab}>All your rallies · {rallies.length}</button>}
        {mode === "play" && waiting.length > 0 && (
          <>
            <span className="slabel">Waiting on a partner · {waiting.length}</span>
            <div className="stack" style={{ marginBottom: 18 }}>
              {waiting.map((r) => <RallyRow key={r.session_id} r={r} onOpen={onOpenRally} />)}
            </div>
          </>
        )}
        {mode === "play" && done.length > 0 && (
          <>
            <span className="slabel">Closed · {done.length}</span>
            <div className="stack" style={{ marginBottom: 18 }}>
              {done.map((r) => <RallyRow key={r.session_id} r={r} onOpen={onOpenRally} />)}
            </div>
          </>
        )}
        {rallies.length === 0 && <div className="empty" style={{ marginBottom: 18 }}><b>No rallies yet.</b><span>Tap Play a rally to get your first card. A stranger gets the other role; six turns and it is done.</span></div>}

        {mode === "home" && (
        <div className="tile" style={{ marginBottom: 14 }}>
          <div className="tlbl">Your agreement</div>
          <div className="tbody muted" style={{ fontSize: "0.85rem" }}>
            Signed v{me.consent?.agreement_version} · record {me.consent?.record_sha256.slice(0, 12)}… · Withdraw any time from your account.
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

function RallyRow({ r, onOpen, accent }: { r: RallySummary; onOpen: (id: string) => void; accent?: boolean }) {
  const when = new Date(r.updated_at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const sub = r.status === "complete" ? `Complete · ${r.turn_count} turns` : r.status === "abandoned" ? (r.abandoned_reason === "partner_quiet" ? "Partner went quiet · your takes are kept" : "Closed") : r.my_turn ? (r.turn_count === 0 ? "Record the first turn" : `Rate your partner, then record · due ${dueLabel(r.due_at)}`) : r.waiting_for_partner ? "Your take is in. Waiting for a partner to join" : `Partner's turn · due ${dueLabel(r.due_at)}`;
  return (
    <button type="button" className={accent ? "tile acc" : "tile"} onClick={() => onOpen(r.session_id)} style={{ textAlign: "left", cursor: "pointer", width: "100%" }}>
      <div className="spread">
        <div>
          <div className="ttitle">{r.title}</div>
          <div className="tbody muted" style={{ marginTop: 4, fontSize: "0.85rem" }}>{sub} · {when}</div>
        </div>
        <span className="chip" style={{ flex: "none" }}>{r.turn_count}/{r.turns_target}</span>
      </div>
    </button>
  );
}
