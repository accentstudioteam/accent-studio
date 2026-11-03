import { useCallback, useEffect, useRef, useState } from "react";
import { Logo } from "@/components/Logo";
import { Num, useRowMotion } from "@/components/sx-motion";
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

  if (embedded) return <div className="sx-view" key={openId ?? "board"}>{body}</div>;
  return (
    <div className="app ankara studio-ank">
      <div className="topbar">
        <button type="button" className="sx-link" onClick={onBack}>‹ back</button>
        <Logo height={22} tone="mono" />
      </div>
      <div className="sx-view" key={openId ?? "board"}>{body}</div>
    </div>
  );
}

function BoardList({ onOpen }: { onOpen: (sid: string) => void }) {
  const [b, setB] = useState<Board | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<BoardFilter>("in_flight");
  const [project, setProject] = useState<string>("");
  const [readAt, setReadAt] = useState<number>(Date.now());
  const [reading, setReading] = useState(false);
  const [, tick] = useState(0);

  const load = useCallback(async () => {
    setReading(true);
    try {
      setB(await rallyBoard(filter, project || null));
      setReadAt(Date.now());
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "Couldn't load the board.");
    }
    setReading(false);
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

  // This is the liveliest surface in the Studio: it reads itself every twenty
  // seconds, so a rally arriving enters and one that just went overdue, took a
  // turn or changed hands washes once in its own colour.
  const rowCls = useRowMotion(
    b?.rallies,
    (r) => r.session_id,
    (r) => `${r.status}|${r.overdue ? 1 : 0}|${r.turns_done}|${r.transcripts}|${r.next_alias ?? ""}|${r.abandoned_reason ?? ""}`,
  );

  const ago = Math.round((Date.now() - readAt) / 1000);
  const n = b?.rallies.length ?? 0;

  return (
    <div className="shell wide">
      <div className="sx-head">
        <div>
          <div className="eyebrow">The floor</div>
          <h1 className="h1">Rally board{b ? <> · <Num value={n} /></> : ""}</h1>
        </div>
      </div>

      <div className={`sx-bar${reading ? " sx-working" : ""}`} role="group" aria-label="Status">
        {FILTERS.map(([k, label]) => (
          <button
            key={k}
            type="button"
            aria-pressed={filter === k}
            className={`chip${filter === k ? " on" : ""}${k === "overdue" && (b?.counts.overdue ?? 0) > 0 ? " coral" : ""}${k === "overdue" && filter !== "overdue" && (b?.counts.overdue ?? 0) > 0 ? " sx-pulse" : ""}`}
            onClick={() => setFilter(k)}
          >
            {label}{b ? ` ${b.counts[k] ?? 0}` : ""}
          </button>
        ))}
        {b && b.projects.length > 1 && (
          <>
            <label className="sx-bar-lab" htmlFor="rb-project">Project</label>
            <select id="rb-project" className="sx-sel" value={project} onChange={(e) => setProject(e.target.value)}>
              <option value="">Every project</option>
              {b.projects.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.rallies}</option>)}
            </select>
          </>
        )}
        <div className="sx-bar-end">
          {b && <span className="sx-meta">{ago < 5 ? "read just now" : `read ${ago} s ago`}</span>}
          <button type="button" className="pill ghost" onClick={() => void load()}>Refresh</button>
        </div>
      </div>

      <p className="sx-note">
        Rallies as they happen: who is in each one, how far it has gone, whose turn it is and when that turn is due.
        A partner has {b?.reply_window_hours ?? 24} hours to answer; past that the rally shows as overdue and the sweep will close it.
        Overdue first, then the ones still waiting on a partner, then whatever moved most recently.
        Nothing on this screen changes a rally. Reads every {Math.round(BOARD_POLL_MS / 1000)} seconds.
      </p>

      {err && (
        <div className="sx-block sx-block-coral sx-pop" style={{ marginBottom: 12 }}>
          <div className="tlbl">The board didn&rsquo;t load</div>
          <div className="tbody">{err}</div>
        </div>
      )}
      {!b && !err && <div className="full-center"><div className="spin" /></div>}
      {b && n === 0 && (
        <div className="empty sx-pop">
          <b>Nothing here.</b>
          <span>No rally matches this filter{project ? " in this project" : ""}. The board reads itself every {Math.round(BOARD_POLL_MS / 1000)} seconds, so a new one appears on its own.</span>
        </div>
      )}

      {b && n > 0 && (
        <div className="sx-list sx-enter">
          {b.rallies.map((r) => <BoardRow key={r.session_id} r={r} cls={rowCls(r)} onOpen={onOpen} />)}
        </div>
      )}
    </div>
  );
}

function BoardRow({ r, cls, onOpen }: { r: BoardRally; cls: string; onOpen: (sid: string) => void }) {
  const pair = r.a_alias && r.b_alias ? `${r.a_alias} and ${r.b_alias}` : r.a_alias ? `${r.a_alias}, alone so far` : "nobody yet";
  const spine = r.overdue ? " sx-spine-coral" : r.status === "complete" ? " sx-spine-mint" : r.abandoned_reason ? " sx-spine-gold" : "";
  // an overdue row washes coral rather than mint when its state moves
  const flash = cls === " sx-flash" && r.overdue ? " sx-flash sx-flash-coral" : cls;
  return (
    <button
      type="button"
      className={`sx-row${spine}${flash}`}
      onClick={() => onOpen(r.session_id)}
      aria-label={`${r.card_title} · ${STATUS_WORD[r.status]}${r.overdue ? ", overdue" : ""}`}
    >
      <div className="sx-row-top">
        <div className="sx-row-main">
          <div className="sx-row-t">{r.card_title}</div>
          <div className="sx-row-s">
            {r.project ?? "no project"} · {lang(r.language)}{domainWord(r.domain) ? ` · ${domainWord(r.domain)}` : ""} · {r.turns_done} of {r.turns_target} turns · {secs(r.seconds)} recorded
          </div>
          <div className="sx-row-s">
            {pair}
            {r.next_alias ? ` · ${r.next_alias} to speak` : ""}
            {r.due_at ? ` · due ${until(r.due_at)}` : ""}
          </div>
          <div className="sx-row-m">moved {since(r.last_move_at)}</div>
          {(r.overdue || r.transcripts > 0 || r.abandoned_reason || r.flags.length > 0) && (
            <div className="chips">
              {r.overdue && <span className="chip coral">overdue</span>}
              {r.transcripts > 0 && <span className="chip">{r.transcripts} transcribed</span>}
              {r.abandoned_reason && <span className="chip gold">{r.abandoned_reason.replace(/_/g, " ")}</span>}
              {r.flags.map((f) => <span key={f} className="chip gold">{f.replace(/_/g, " ")}</span>)}
            </div>
          )}
        </div>
        <div className="sx-row-end">
          <span className="chip">{STATUS_WORD[r.status]}</span>
        </div>
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

  const turnCls = useRowMotion(
    d?.turns,
    (t) => t.turn_id,
    (t) => `${t.status}|${t.rating ? 1 : 0}|${t.transcript?.status ?? ""}|${t.verified?.updated_at ?? ""}`,
  );

  return (
    <div className="shell wide">
      <div className="sx-head">
        <div>
          <div className="eyebrow">The floor · one rally</div>
          <h1 className="h1">{d?.card.title ?? "Rally"}</h1>
        </div>
      </div>

      <div className="sx-bar">
        <span className="sx-bar-lab">Read only</span>
        {d && <span className="chip num">{d.turns_done} of {d.turns_target} turns</span>}
        {d && <span className="chip num">{secs(d.seconds)} recorded</span>}
        <div className="sx-bar-end">
          <button type="button" className="pill ghost" onClick={() => void load()}>Refresh</button>
          <button type="button" className="pill ghost" onClick={onBack}>Back to the board</button>
        </div>
      </div>

      {err && (
        <div className="sx-block sx-block-coral sx-pop" style={{ marginBottom: 12 }}>
          <div className="tlbl">Something didn&rsquo;t load</div>
          <div className="tbody">{err}</div>
        </div>
      )}
      {!d && !err && <div className="full-center"><div className="spin" /></div>}
      {d && (
        <>
          <div className="sheet sx-in-card" style={{ marginBottom: 12 }}>
            <div className="shead"><i />The card</div>
            <div className="tile">
              <div className="tlbl">Situation</div>
              <div className="sx-read">{d.card.situation}</div>
            </div>
            <div className="row2">
              <div className="tile"><div className="tlbl">A{d.participants.a?.alias ? ` · ${d.participants.a.alias}` : ""}</div><div className="tbody">{d.card.persona_a}</div></div>
              <div className="tile"><div className="tlbl">B{d.participants.b?.alias ? ` · ${d.participants.b.alias}` : ""}</div><div className="tbody">{d.card.persona_b}</div></div>
            </div>
            {d.card.english_note && <div className="tbody muted small">In English: {d.card.english_note}</div>}
            <div className="chips">
              <span className="chip">{STATUS_WORD[d.status]}</span>
              <span className="chip">{lang(d.language)}</span>
              {domainWord(d.card.domain) && <span className="chip">{domainWord(d.card.domain)}</span>}
              {d.project && <span className="chip">{d.project.name}</span>}
              {d.overdue && <span className="chip coral sx-pulse">overdue · {until(d.due_at)}</span>}
              {!d.overdue && d.due_at && <span className="chip">due {until(d.due_at)}</span>}
              {d.abandoned_reason && <span className="chip gold">{d.abandoned_reason.replace(/_/g, " ")}</span>}
              {d.flags.map((f) => <span key={f} className="chip gold">{f.replace(/_/g, " ")}</span>)}
            </div>
            <div className="sx-meta">
              Opened {clock(d.created_at)} · last moved {since(d.last_move_at)}
              {d.next?.alias ? ` · ${d.next.alias} is next to speak` : ""}
            </div>
          </div>

          {d.turns.length === 0 ? (
            <div className="empty sx-pop">
              <b>No takes yet.</b>
              <span>{d.status === "open" ? "Nobody has joined this one." : "Whoever is in it has not recorded a turn."} The screen reads itself every {Math.round(DETAIL_POLL_MS / 1000)} seconds.</span>
            </div>
          ) : (
            <div className="stack sx-enter">
              {d.turns.map((t) => (
                <TurnCard
                  key={t.turn_id}
                  t={t}
                  cls={turnCls(t)}
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

function TurnCard({ t, cls, finished, sttShow, url, loading, onListen }: { t: RallyTurn; cls: string; finished: boolean; sttShow: boolean; url?: string; loading: boolean; onListen: () => void }) {
  return (
    <div className={`sheet${cls}`} style={t.latest ? undefined : { opacity: 0.6 }}>
      <div className="spread" style={{ alignItems: "flex-start" }}>
        <div>
          <div className="ttitle">Turn {t.turn_no}{t.attempt > 1 ? ` · take ${t.attempt}` : ""}</div>
          <div className="sx-meta">
            {t.alias ?? "unknown"} ({t.side.toUpperCase()}) · {secs(t.seconds)} · recorded {since(t.created_at)}
            {!t.latest ? " · replaced by a later take" : ""}
          </div>
        </div>
        <span className="chip">{t.status}</span>
      </div>

      {url ? (
        <audio controls src={url} style={{ width: "100%" }} />
      ) : (
        <button type="button" className="pill ghost" onClick={onListen} disabled={loading}>{loading ? "Signing a link…" : "Load the take"}</button>
      )}

      {t.rating ? (
        <div className="tile sx-spine-mint">
          <div className="tlbl">Rated {t.rating.aggregate != null ? Number(t.rating.aggregate).toFixed(2) : "?"} by {t.rating.rater_alias ?? "their partner"}</div>
          <div className="sx-meta">tone {t.rating.tone} · on the card {t.rating.prompt_adherence} · mood {t.rating.mood} · clarity {t.rating.clarity}</div>
        </div>
      ) : (
        <div className="tbody muted small">Not rated yet.</div>
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
      <div className="tile dash">
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
      <div className="tile dash sx-working">
        <div className="tlbl">Transcript</div>
        <div className="tbody muted small"><span className="dots" aria-hidden="true"><i /><i /><i /></span>Drafting{d.engine ? ` with ${d.engine}` : ""}…</div>
      </div>
    );
  }
  if (d.status === "failed" || d.status === "skipped" || !d.text) {
    return (
      <div className={`tile dash${d.status === "failed" ? " sx-spine-coral" : ""}`}>
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
    <div className="tile">
      <div className="tlbl">
        Machine transcript{d.engine ? ` · ${d.engine}` : ""}{d.confidence != null ? ` · confidence ${Number(d.confidence).toFixed(2)}` : ""}
      </div>
      <div className="sx-read">{d.text}</div>
      {d.gloss && <div className="sx-read-sub">In English: {d.gloss}</div>}
      {t.verified?.text && (
        <>
          <div className="tlbl" style={{ marginTop: 10 }}>What a linguist wrote</div>
          <div className="sx-read">{t.verified.text}</div>
          {t.verified.gloss && <div className="sx-read-sub">In English: {t.verified.gloss}</div>}
        </>
      )}
      <div className="sx-meta" style={{ marginTop: 6 }}>
        {segments} segment{segments === 1 ? "" : "s"}{words ? ` · ${words} word${words === 1 ? "" : "s"} timed` : " · no per-word timing"}
        {d.detected_language ? ` · heard as ${d.detected_language}` : ""} · drafted {since(d.updated_at)}
      </div>
    </div>
  );
}
