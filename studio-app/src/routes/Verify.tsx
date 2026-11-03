import { useCallback, useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { Num, useRowMotion } from "@/components/sx-motion";
import { LANG_NAME } from "@/lib/game";
import { queue, type Queue, type QueueItem } from "@/lib/verify";
import { isDemo } from "@/lib/demo";

const since = (iso: string): string => {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
};

interface VerifyProps {
  onBack: () => void;
  onOpen: (sessionId: string) => void;
  onCases: () => void;
  embedded?: boolean;
}

/** The Cutting Room queue: every finished rally waiting for a linguist, oldest first. */
export function Verify({ onBack, onOpen, onCases, embedded }: VerifyProps) {
  const [q, setQ] = useState<Queue | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  // the row the editor just picked: it slides out before the bench rises in
  const [leaving, setLeaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setReading(true);
    try {
      setQ(await queue());
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "Couldn't load the queue.");
    }
    setReading(false);
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), isDemo() ? 4_000 : 30_000);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!leaving) return;
    const id = window.setTimeout(() => onOpen(leaving), 190);
    return () => window.clearTimeout(id);
  }, [leaving, onOpen]);

  // a live surface: a rally arriving enters, a rally changing hands flashes
  const rowCls = useRowMotion(
    q?.sessions,
    (s) => s.session_id,
    (s) => `${s.status}|${s.claimed_by_me ? 1 : 0}|${s.claim_editor ?? ""}|${s.session_status}|${s.turns}|${s.hold ? 1 : 0}`,
  );

  const body = (
    <div className="shell wide">
      <div className="sx-head">
        <div>
          <div className="eyebrow">Cutting Room{q ? ` · you are ${q.my_editor}` : ""}</div>
          <h1 className="h1">Verification queue{q ? <> · <Num value={q.sessions.length} /></> : ""}</h1>
        </div>
      </div>

      <div className={`sx-bar${reading ? " sx-working" : ""}`}>
        <span className="sx-bar-lab">Oldest first</span>
        {q && <span className="chip num">hold {q.claim_minutes} min</span>}
        {q && <span className="chip num">{q.verified_count} verified</span>}
        <div className="sx-bar-end">
          <button type="button" className="pill ghost" onClick={() => void load()}>Refresh</button>
          <button type="button" className="pill ghost" onClick={onCases}>Cases</button>
        </div>
      </div>

      <p className="sx-note">
        Every finished rally lands here, oldest first. Open one to hold it for {q?.claim_minutes ?? 30} minutes, listen to each take,
        write the transcript as spoken and the English gloss, mark your confidence and any issues, and check each peer rating against
        the audio. Verify to lock the rally and set its quality tier.
      </p>

      {err && (
        <div className="sx-block sx-block-coral sx-pop" style={{ marginBottom: 12 }}>
          <div className="tlbl">The queue didn&rsquo;t load</div>
          <div className="tbody">{err}</div>
        </div>
      )}
      {!q && !err && <div className="full-center"><div className="spin" /></div>}
      {q && q.sessions.length === 0 && (
        <div className="empty sx-pop">
          <b>The queue is clear.</b>
          <span>Rallies land here the moment both players finish, oldest first. Check the audit queue meanwhile.</span>
        </div>
      )}

      {q && q.sessions.length > 0 && (
        <div className="sx-list sx-enter">
          {q.sessions.map((s) => (
            <QueueRow key={s.session_id} s={s} cls={rowCls(s)} leaving={leaving === s.session_id} onPick={setLeaving} />
          ))}
        </div>
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

/** One rally in the queue. Its state is the spine on the leading edge — mint if it
 *  is yours, gold if another editor holds it, coral if integrity has it on hold. */
function QueueRow({ s, cls, leaving, onPick }: { s: QueueItem; cls: string; leaving: boolean; onPick: (id: string) => void }) {
  const held = s.status === "in_progress" && !s.claimed_by_me;
  const state = s.claimed_by_me ? "Yours" : held ? `Held by ${s.claim_editor ?? "another editor"}` : "Open";
  const closed = s.session_status === "abandoned";
  const spine = s.hold ? " sx-spine-coral" : s.claimed_by_me ? " sx-spine-mint" : held ? " sx-spine-gold" : "";
  return (
    <button
      type="button"
      className={`sx-row${spine}${cls}${leaving ? " sx-leave" : ""}`}
      onClick={() => onPick(s.session_id)}
      aria-label={`${s.title} · ${state}`}
    >
      <div className="sx-row-top">
        <div className="sx-row-main">
          <div className="sx-row-t">{s.title}</div>
          <div className="sx-row-s">
            {LANG_NAME[s.language] ?? s.language} · {s.mode === "live" ? "live scene, two tracks" : closed ? "closed, partner went quiet" : "complete"} · {s.turns} {s.mode === "live" ? "tracks" : "turns"} · {Math.round(s.seconds)} s · ready {since(s.ready_since)}
          </div>
          <div className="sx-row-m sx-clip">{s.speakers.filter(Boolean).join(" · ")}</div>
          {(s.flags.length > 0 || s.hold) && (
            <div className="chips">
              {s.flags.includes("short_rally") && <span className="chip gold">short rally</span>}
              {s.flags.includes("rotation_override") && <span className="chip gold">pair past rotation</span>}
              {s.hold && <span className="chip coral">integrity hold</span>}
            </div>
          )}
        </div>
        <div className="sx-row-end">
          <span className={`chip${s.claimed_by_me ? " on" : ""}`} style={held ? { opacity: 0.72 } : undefined}>{state}</span>
        </div>
      </div>
    </button>
  );
}
