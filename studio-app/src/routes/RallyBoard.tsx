import { useCallback, useEffect, useRef, useState } from "react";
import { Logo } from "@/components/Logo";
import { LANG_NAME, turnUrl } from "@/lib/game";
import {
  BOARD_POLL_MS,
  DETAIL_POLL_MS,
  FILTERS,
  STATUS_WORD,
  clock,
  rallyBoard,
  rallyDetail,
  secs,
  since,
  until,
  type Board,
  type BoardFilter,
  type BoardRally,
  type RallyDetail,
  type RallyTurn,
} from "@/lib/rallyBoard";

interface Props {
  onBack: () => void;
  embedded?: boolean;
}

const lang = (l: string) => LANG_NAME[l] ?? l;
const domainWord = (d: string | null) => (d ? d.replace(/_/g, " ") : null);

/** The floor: every rally in flight, who is in it, who is overdue, and what has been recorded.
 *  A read-only window — nothing here starts, ends or nudges a rally. */
export function RallyBoard({ onBack, embedded }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const body = openId
    ? <RallyDetailView sid={openId} onBack={() => setOpenId(null)} />
    : <BoardList onOpen={setOpenId} />;

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

function BoardList({ onOpen }: { onOpen: (sid: string) => void }) {
  const [b, setB] = useState<Board | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<BoardFilter>("in_flight");
  const [project, setProject] = useState<string>("");
  const [readAt, setReadAt] = useState<number>(Date.now());
  const [, tick] = useState(0);

  const load = useCallback(async () => {
    try {
      setB(await rallyBoard(filter, project || null));
      setReadAt(Date.now());
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "Couldn't load the board.");
    }
  }, [filter, project]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), BOARD_POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  // keep "read 12 s ago" and the overdue clocks honest between reads
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 5_000);
    return () => window.clearInterval(id);
  }, []);

  const ago = Math.round((Date.now() - readAt) / 1000);
  const n = b?.rallies.length ?? 0;

  return (
    <div className="shell" style={{ maxWidth: 820 }}>
      <div className="spread" style={{ marginBottom: 16, alignItems: "flex-start" }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>The floor</div>
          <h1 className="h1">Rally board{b ? ` · ${n}` : ""}</h1>
        </div>
        <div className="btn-row" style={{ flex: "none" }}>
          <button className="pill ghost" onClick={() => void load()}>Refresh</button>
        </div>
      </div>

      <div className="tile" style={{ marginBottom: 14 }}>
        <div className="tbody muted" style={{ fontSize: "0.85rem" }}>
          Rallies as they happen: who is in each one, how far it has gone, whose turn it is and when that turn is due.
          A partner has {b?.reply_window_hours ?? 24} hours to answer; past that the rally shows as overdue and the sweep will close it.
          Overdue first, then the ones still waiting on a partner, then whatever moved most recently.
          Nothing on this screen changes a rally. Reads every {Math.round(BOARD_POLL_MS / 1000)} seconds{b ? ` · last read ${ago < 5 ? "just now" : `${ago} s ago`}` : ""}.
        </div>
      </div>

      <div className="chips" style={{ marginBottom: 10 }} role="group" aria-label="Status">
        {FILTERS.map(([k, label]) => (
          <button
            key={k}
            type="button"
            aria-pressed={filter === k}
            className={`chip${filter === k ? " on" : ""}${k === "overdue" && (b?.counts.overdue ?? 0) > 0 ? " coral" : ""}`}
            style={{ cursor: "pointer" }}
            onClick={() => setFilter(k)}
          >
            {label}{b ? ` ${b.counts[k] ?? 0}` : ""}
          </button>
        ))}
      </div>

      {b && b.projects.length > 1 && (
        <div className="field" style={{ marginBottom: 14 }}>
          <label htmlFor="rb-project">Project</label>
          <select id="rb-project" value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="">Every project</option>
            {b.projects.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.rallies}</option>)}
          </select>
        </div>
      )}

      {err && <div className="tile" style={{ borderColor: "var(--coral)", marginBottom: 14 }}><div className="tbody" style={{ color: "var(--coral)" }}>{err}</div></div>}
      {!b && !err && <div className="muted">Loading…</div>}
      {b && n === 0 && (
        <div className="empty">
          <b>Nothing here.</b>
          <span>No rally matches this filter{project ? " in this project" : ""}. The board reads itself every {Math.round(BOARD_POLL_MS / 1000)} seconds, so a new one appears on its own.</span>
        </div>
      )}

      <div className="stack">
        {b?.rallies.map((r) => <BoardRow key={r.session_id} r={r} onOpen={onOpen} />)}
      </div>
    </div>
  );
}

function BoardRow({ r, onOpen }: { r: BoardRally; onOpen: (sid: string) => void }) {
  const pair = r.a_alias && r.b_alias ? `${r.a_alias} and ${r.b_alias}` : r.a_alias ? `${r.a_alias}, alone so far` : "nobody yet";
  return (
    <button type="button" className={r.overdue ? "tile acc" : "tile"} onClick={() => onOpen(r.session_id)} style={{ textAlign: "left", cursor: "pointer", width: "100%" }}>
      <div className="spread" style={{ alignItems: "flex-start" }}>
        <div>
          <div className="ttitle">{r.card_title}</div>
          <div className="tbody muted" style={{ marginTop: 4, fontSize: "0.85rem" }}>
            {r.project ?? "no project"} · {lang(r.language)}{domainWord(r.domain) ? ` · ${domainWord(r.domain)}` : ""} · {r.turns_done} of {r.turns_target} turns · {secs(r.seconds)} recorded
          </div>
          <div className="tbody muted" style={{ marginTop: 2, fontSize: "0.8rem" }}>
            {pair}
            {r.next_alias ? ` · ${r.next_alias} to speak` : ""}
            {r.due_at ? ` · due ${until(r.due_at)}` : ""}
          </div>
          <div className="tbody muted" style={{ marginTop: 2, fontSize: "0.75rem", fontFamily: "var(--mono)" }}>
            moved {since(r.last_move_at)}
          </div>
          <div className="chips" style={{ marginTop: 8 }}>
            {r.overdue && <span className="chip coral">overdue</span>}
            {r.transcripts > 0 && <span className="chip">{r.transcripts} transcribed</span>}
            {r.abandoned_reason && <span className="chip gold">{r.abandoned_reason.replace(/_/g, " ")}</span>}
            {r.flags.map((f) => <span key={f} className="chip gold">{f.replace(/_/g, " ")}</span>)}
          </div>
        </div>
        <span className="chip" style={{ flex: "none" }}>{STATUS_WORD[r.status]}</span>
      </div>
    </button>
  );
}

function RallyDetailView({ sid, onBack }: { sid: string; onBack: () => void }) {
  const [d, setD] = useState<RallyDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loadingUrl, setLoadingUrl] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const load = useCallback(async () => {
    try {
      const next = await rallyDetail(sid);
      if (!mounted.current) return;
      setD(next);
      setErr(null);
    } catch (e) {
      if (!mounted.current) return;
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "Couldn't load the rally.");
    }
  }, [sid]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), DETAIL_POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  // Short-lived signed URL from the sessions bucket, the same way the bench gets one.
  const listen = async (t: RallyTurn) => {
    setLoadingUrl(t.turn_id);
    try {
      const u = await turnUrl(t.audio_path);
      if (u) setUrls((m) => ({ ...m, [t.turn_id]: u }));
      else setErr("That take has no playable audio in the sessions bucket.");
    } catch {
      setErr("Couldn't sign a playback URL for that take.");
    }
    setLoadingUrl(null);
  };

  return (
    <div className="shell" style={{ maxWidth: 820 }}>
      <div className="spread" style={{ marginBottom: 16, alignItems: "flex-start" }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>The floor · one rally</div>
          <h1 className="h1">{d?.card.title ?? "Rally"}</h1>
        </div>
        <div className="btn-row" style={{ flex: "none" }}>
          <button className="pill ghost" onClick={() => void load()}>Refresh</button>
          <button className="pill ghost" onClick={onBack}>Back to the board</button>
        </div>
      </div>

      {err && <div className="tile" style={{ borderColor: "var(--coral)", marginBottom: 14 }}><div className="tbody" style={{ color: "var(--coral)" }}>{err}</div></div>}
      {!d && !err && <div className="muted">Loading…</div>}
      {d && (
        <>
          <div className="sheet" style={{ marginBottom: 14 }}>
            <div className="handle" />
            <div className="shead"><i />The card</div>
            <div className="tile">
              <div className="tlbl">Situation</div>
              <div className="tbody">{d.card.situation}</div>
            </div>
            <div className="row2">
              <div className="tile"><div className="tlbl">A{d.participants.a?.alias ? ` · ${d.participants.a.alias}` : ""}</div><div className="tbody">{d.card.persona_a}</div></div>
              <div className="tile"><div className="tlbl">B{d.participants.b?.alias ? ` · ${d.participants.b.alias}` : ""}</div><div className="tbody">{d.card.persona_b}</div></div>
            </div>
            {d.card.english_note && <div className="tbody muted small" style={{ marginTop: 8 }}>In English: {d.card.english_note}</div>}
            <div className="chips" style={{ marginTop: 10 }}>
              <span className="chip">{STATUS_WORD[d.status]}</span>
              <span className="chip">{lang(d.language)}</span>
              {domainWord(d.card.domain) && <span className="chip">{domainWord(d.card.domain)}</span>}
              <span className="chip">{d.turns_done} of {d.turns_target} turns</span>
              <span className="chip">{secs(d.seconds)} recorded</span>
              {d.project && <span className="chip">{d.project.name}</span>}
              {d.overdue && <span className="chip coral">overdue · {until(d.due_at)}</span>}
              {!d.overdue && d.due_at && <span className="chip">due {until(d.due_at)}</span>}
              {d.abandoned_reason && <span className="chip gold">{d.abandoned_reason.replace(/_/g, " ")}</span>}
              {d.flags.map((f) => <span key={f} className="chip gold">{f.replace(/_/g, " ")}</span>)}
            </div>
            <div className="tbody muted small" style={{ marginTop: 8 }}>
              Opened {clock(d.created_at)} · last moved {since(d.last_move_at)}
              {d.next?.alias ? ` · ${d.next.alias} is next to speak` : ""}
            </div>
          </div>

          {d.turns.length === 0 ? (
            <div className="empty">
              <b>No takes yet.</b>
              <span>{d.status === "open" ? "Nobody has joined this one." : "Whoever is in it has not recorded a turn."} The screen reads itself every {Math.round(DETAIL_POLL_MS / 1000)} seconds.</span>
            </div>
          ) : (
            <div className="stack">
              {d.turns.map((t) => (
                <TurnCard
                  key={t.turn_id}
                  t={t}
                  finished={d.status === "complete" || d.status === "abandoned"}
                  sttShow={d.stt.show}
                  url={urls[t.turn_id]}
                  loading={loadingUrl === t.turn_id}
                  onListen={() => void listen(t)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TurnCard({ t, finished, sttShow, url, loading, onListen }: { t: RallyTurn; finished: boolean; sttShow: boolean; url?: string; loading: boolean; onListen: () => void }) {
  return (
    <div className={t.latest ? "sheet" : "sheet"} style={t.latest ? undefined : { opacity: 0.65 }}>
      <div className="handle" />
      <div className="spread" style={{ alignItems: "flex-start" }}>
        <div>
          <div className="ttitle">Turn {t.turn_no}{t.attempt > 1 ? ` · take ${t.attempt}` : ""}</div>
          <div className="tbody muted small" style={{ marginTop: 4 }}>
            {t.alias ?? "unknown"} ({t.side.toUpperCase()}) · {secs(t.seconds)} · recorded {since(t.created_at)}
            {!t.latest ? " · replaced by a later take" : ""}
          </div>
        </div>
        <span className="chip" style={{ flex: "none" }}>{t.status}</span>
      </div>

      {url ? (
        <audio controls src={url} style={{ width: "100%", marginTop: 8 }} />
      ) : (
        <button className="pill ghost" style={{ marginTop: 8 }} onClick={onListen} disabled={loading}>{loading ? "Signing a link…" : "Load the take"}</button>
      )}

      {t.rating ? (
        <div className="tile" style={{ marginTop: 10 }}>
          <div className="tlbl">Rated {t.rating.aggregate != null ? Number(t.rating.aggregate).toFixed(2) : "?"} by {t.rating.rater_alias ?? "their partner"}</div>
          <div className="tbody muted small">tone {t.rating.tone} · on the card {t.rating.prompt_adherence} · mood {t.rating.mood} · clarity {t.rating.clarity}</div>
        </div>
      ) : (
        <div className="tbody muted small" style={{ marginTop: 10 }}>Not rated yet.</div>
      )}

      <Transcript t={t} finished={finished} sttShow={sttShow} />
    </div>
  );
}

/** The machine transcript, or an honest account of why there isn't one.
 *  Nothing drafts these automatically: a staff member runs stt-draft on a finished rally. */
function Transcript({ t, finished, sttShow }: { t: RallyTurn; finished: boolean; sttShow: boolean }) {
  const d = t.transcript;

  if (!d) {
    return (
      <div className="tile" style={{ marginTop: 10 }}>
        <div className="tlbl">Transcript</div>
        <div className="tbody muted small">
          {!sttShow
            ? "No machine transcript. No engine is routed for this language yet, so there is nothing to draft."
            : finished
              ? "No machine transcript yet. Nothing drafts these on its own — an editor runs the draft from the Cutting Room bench once the rally is finished."
              : "No machine transcript yet. Drafting runs on finished rallies, and this one is still going."}
        </div>
      </div>
    );
  }
  if (d.status === "pending" || d.status === "running") {
    return (
      <div className="tile" style={{ marginTop: 10 }}>
        <div className="tlbl">Transcript</div>
        <div className="tbody muted small"><span className="dots" aria-hidden="true"><i /><i /><i /></span>Drafting{d.engine ? ` with ${d.engine}` : ""}…</div>
      </div>
    );
  }
  if (d.status === "failed" || d.status === "skipped" || !d.text) {
    return (
      <div className="tile" style={{ marginTop: 10, borderColor: d.status === "failed" ? "var(--coral)" : undefined }}>
        <div className="tlbl">Transcript</div>
        <div className="tbody muted small">
          {d.status === "skipped" ? "The draft was skipped for this take." : `The draft ${d.status === "failed" ? "failed" : "came back empty"}${d.error ? `: ${d.error}` : "."}`}
        </div>
      </div>
    );
  }

  const words = d.words?.length ?? 0;
  const segments = d.segments?.length ?? 0;
  return (
    <div className="tile" style={{ marginTop: 10 }}>
      <div className="tlbl">
        Machine transcript{d.engine ? ` · ${d.engine}` : ""}{d.confidence != null ? ` · confidence ${Number(d.confidence).toFixed(2)}` : ""}
      </div>
      <div className="tbody" style={{ marginTop: 4 }}>{d.text}</div>
      {d.gloss && <div className="tbody muted small" style={{ marginTop: 6 }}>In English: {d.gloss}</div>}
      {t.verified?.text && (
        <>
          <div className="tlbl" style={{ marginTop: 10 }}>What a linguist wrote</div>
          <div className="tbody">{t.verified.text}</div>
          {t.verified.gloss && <div className="tbody muted small" style={{ marginTop: 4 }}>In English: {t.verified.gloss}</div>}
        </>
      )}
      <div className="tbody muted small" style={{ marginTop: 6, fontFamily: "var(--mono)", fontSize: "0.7rem" }}>
        {segments} segment{segments === 1 ? "" : "s"}{words ? ` · ${words} word${words === 1 ? "" : "s"} timed` : " · no per-word timing"}
        {d.detected_language ? ` · heard as ${d.detected_language}` : ""} · drafted {since(d.updated_at)}
      </div>
    </div>
  );
}
