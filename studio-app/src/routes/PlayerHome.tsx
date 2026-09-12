import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { Logo } from "@/components/Logo";
import { LANG_NAME, mySessions, startRally, type RallySummary } from "@/lib/game";
import type { Onboarding } from "@/lib/types";

const POLL_MS = 20_000;

export function PlayerHome({ me, onOpenRally }: { me: Onboarding; onOpenRally: (sessionId: string) => void }) {
  const { signOut } = useAuth();
  const [rallies, setRallies] = useState<RallySummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const language = me.contributor?.primary_language ?? "pcm";

  const load = useCallback(async () => {
    try {
      setRallies(await mySessions());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't load your rallies.");
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), POLL_MS);
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

  const yourTurn = rallies.filter((r) => r.my_turn && r.status !== "complete");
  const waiting = rallies.filter((r) => !r.my_turn && r.status !== "complete");
  const done = rallies.filter((r) => r.status === "complete");

  return (
    <div className="app">
      <div className="topbar">
        <Logo height={22} />
        <span className="chip" style={{ fontFamily: "var(--mono)", fontSize: "0.7rem" }}>{me.contributor?.speaker_id ?? "cast"}</span>
      </div>
      <div className="shell">
        <div className="spread" style={{ marginBottom: 18, alignItems: "flex-start" }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Playing in {LANG_NAME[language] ?? language}</div>
            <h1 className="h1">Ping-Pong.</h1>
          </div>
        </div>

        <div className="sheet" style={{ marginBottom: 18 }}>
          <div className="handle" />
          <div className="shead"><i className="g" />How a rally works</div>
          <div className="tile">
            <div className="tbody muted">
              You get a card in your language: a situation and who you are in it. You record one voice note, up to 30 seconds, your way. A stranger gets the other role, listens, rates your take on four things, and records theirs. Six turns and the rally is done. Below 4 out of 5 you say it again.
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
        {waiting.length > 0 && (
          <>
            <span className="slabel">Waiting on a partner · {waiting.length}</span>
            <div className="stack" style={{ marginBottom: 18 }}>
              {waiting.map((r) => <RallyRow key={r.session_id} r={r} onOpen={onOpenRally} />)}
            </div>
          </>
        )}
        {done.length > 0 && (
          <>
            <span className="slabel">Completed · {done.length}</span>
            <div className="stack" style={{ marginBottom: 18 }}>
              {done.map((r) => <RallyRow key={r.session_id} r={r} onOpen={onOpenRally} />)}
            </div>
          </>
        )}
        {rallies.length === 0 && <div className="muted" style={{ marginBottom: 18 }}>No rallies yet. Tap Play a rally to get your first card.</div>}

        <div className="tile" style={{ marginBottom: 14 }}>
          <div className="tlbl">Your agreement</div>
          <div className="tbody muted" style={{ fontSize: "0.85rem" }}>
            Signed v{me.consent?.agreement_version} · record {me.consent?.record_sha256.slice(0, 12)}… · Withdraw any time by emailing privacy@accentstudio.io from your registered address.
          </div>
        </div>
        <button className="pill ghost" onClick={() => void signOut()}>Sign out</button>
      </div>
    </div>
  );
}

function RallyRow({ r, onOpen, accent }: { r: RallySummary; onOpen: (id: string) => void; accent?: boolean }) {
  const when = new Date(r.updated_at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const sub = r.status === "complete" ? `Complete · ${r.turn_count} turns` : r.my_turn ? (r.turn_count === 0 ? "Record the first turn" : "Rate your partner, then record") : r.waiting_for_partner ? "Your take is in. Waiting for a partner to join" : "Partner's turn";
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
