import { useCallback, useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
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

  const load = useCallback(async () => {
    try {
      setQ(await queue());
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "Couldn't load the queue.");
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), isDemo() ? 4_000 : 30_000);
    return () => window.clearInterval(id);
  }, [load]);

  const body = (
    <div className="shell" style={{ maxWidth: 720 }}>
      <div className="spread" style={{ marginBottom: 16, alignItems: "flex-start" }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Cutting Room{q ? ` · you are ${q.my_editor}` : ""}</div>
          <h1 className="h1">Verification queue{q ? ` · ${q.sessions.length}` : ""}</h1>
        </div>
        <div className="btn-row" style={{ flex: "none" }}>
          <button className="pill ghost" onClick={() => void load()}>Refresh</button>
          <button className="pill ghost" onClick={onCases}>Cases</button>
        </div>
      </div>

      <div className="tile" style={{ marginBottom: 14 }}>
        <div className="tbody muted" style={{ fontSize: "0.85rem" }}>
          Every finished rally lands here, oldest first. Open one to hold it for {q?.claim_minutes ?? 30} minutes, listen to each take, write the transcript as spoken and the English gloss, mark your confidence and any issues, and check each peer rating against the audio. Verify to lock the rally and set its quality tier. {q ? `${q.verified_count} verified so far.` : ""}
        </div>
      </div>

      {err && <div className="tile" style={{ borderColor: "var(--coral)", marginBottom: 14 }}><div className="tbody" style={{ color: "var(--coral)" }}>{err}</div></div>}
      {!q && !err && <div className="muted">Loading…</div>}
      {q && q.sessions.length === 0 && <div className="empty"><b>The queue is clear.</b><span>Rallies land here the moment both players finish, oldest first. Check the audit queue meanwhile.</span></div>}

      <div className="stack">
        {q?.sessions.map((s) => <QueueRow key={s.session_id} s={s} onOpen={onOpen} />)}
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

function QueueRow({ s, onOpen }: { s: QueueItem; onOpen: (id: string) => void }) {
  const held = s.status === "in_progress" && !s.claimed_by_me;
  const state = s.claimed_by_me ? "Yours" : held ? `Held by ${s.claim_editor ?? "another editor"}` : "Open";
  const closed = s.session_status === "abandoned";
  return (
    <button type="button" className={s.claimed_by_me ? "tile acc" : "tile"} onClick={() => onOpen(s.session_id)} style={{ textAlign: "left", cursor: "pointer", width: "100%" }}>
      <div className="spread" style={{ alignItems: "flex-start" }}>
        <div>
          <div className="ttitle">{s.title}</div>
          <div className="tbody muted" style={{ marginTop: 4, fontSize: "0.85rem" }}>
            {LANG_NAME[s.language] ?? s.language} · {s.mode === "live" ? "live scene, two tracks" : closed ? "closed, partner went quiet" : "complete"} · {s.turns} {s.mode === "live" ? "tracks" : "turns"} · {Math.round(s.seconds)} s · ready {since(s.ready_since)}
          </div>
          <div className="tbody muted" style={{ marginTop: 2, fontSize: "0.75rem", fontFamily: "var(--mono)" }}>{s.speakers.filter(Boolean).join(" · ")}</div>
          <div className="chips" style={{ marginTop: 8 }}>
            {s.flags.includes("short_rally") && <span className="chip gold">short rally</span>}
            {s.flags.includes("rotation_override") && <span className="chip gold">pair past rotation</span>}
            {s.hold && <span className="chip coral">integrity hold</span>}
          </div>
        </div>
        <span className="chip" style={{ flex: "none", opacity: held ? 0.7 : 1 }}>{state}</span>
      </div>
    </button>
  );
}
