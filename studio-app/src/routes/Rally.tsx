import { useCallback, useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { formatClock, useRecorder } from "@/lib/recorder";
import { uploadRecording } from "@/lib/upload";
import { cardAudioUrl, loadRally, rateTurn, submitTurn, turnUrl, type Rally as RallyState } from "@/lib/game";

const AXES: [keyof Scores, string, string][] = [
  ["tone", "Tone", "Did it sound like the person on the card?"],
  ["prompt_adherence", "The situation", "Did they play the situation, not something else?"],
  ["mood", "Mood", "Did the feeling land: vexed, calm, playful?"],
  ["clarity", "Clarity", "Could you hear every word?"],
];
type Scores = { tone: number; prompt_adherence: number; mood: number; clarity: number };

function extFor(mime: string): string {
  const base = mime.split(";")[0];
  if (base.includes("mp4")) return "mp4";
  if (base.includes("ogg")) return "ogg";
  if (base.includes("wav")) return "wav";
  return "webm";
}

export function Rally({ sessionId, onBack }: { sessionId: string; onBack: () => void }) {
  const [r, setR] = useState<RallyState | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [scores, setScores] = useState<Scores>({ tone: 0, prompt_adherence: 0, mood: 0, clarity: 0 });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const rec = useRecorder(r?.max_turn_seconds ?? 30);

  const load = useCallback(async () => {
    try {
      const next = await loadRally(sessionId);
      setR(next);
      // playback links for every turn we don't have yet
      const missing = next.turns.filter((t) => !urls[t.turn_id]);
      if (missing.length) {
        const pairs = await Promise.all(missing.map(async (t) => [t.turn_id, await turnUrl(t.audio_path)] as const));
        setUrls((u) => ({ ...u, ...Object.fromEntries(pairs.filter(([, v]) => v).map(([k, v]) => [k, v as string])) }));
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "Couldn't load the rally.");
    }
  }, [sessionId, urls]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 20_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const send = async () => {
    if (!r || !rec.blob) return;
    setBusy(true);
    setErr(null);
    try {
      const path = `${r.session_id}/turn-${r.next_turn_no}-a${r.next_attempt}-${r.my_speaker_id}.${extFor(rec.mime)}`;
      const base = rec.mime.split(";")[0] || "audio/webm";
      await uploadRecording(path, rec.blob, base, (pct) => setProgress(pct), "sessions");
      await submitTurn(r.session_id, path, rec.seconds);
      rec.reset();
      setProgress(null);
      setFlash(r.has_partner ? "Sent. Your partner is up next." : "Sent. We'll pair you with a partner; you'll see it here when they reply.");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "Couldn't send your take.");
      setProgress(null);
    }
    setBusy(false);
  };

  const submitRating = async () => {
    if (!r?.rate_turn_id) return;
    if (Object.values(scores).some((v) => v === 0)) return setErr("Rate all four before you continue.");
    setBusy(true);
    setErr(null);
    try {
      const out = await rateTurn(r.rate_turn_id, scores);
      setScores({ tone: 0, prompt_adherence: 0, mood: 0, clarity: 0 });
      setFlash(out.redo ? `Rated ${out.aggregate.toFixed(2)}. Below 4, so your partner will say it again.` : out.complete ? `Rated ${out.aggregate.toFixed(2)}. That was the last turn. Rally complete.` : `Rated ${out.aggregate.toFixed(2)}. Now record your reply.`);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "Couldn't save the rating.");
    }
    setBusy(false);
  };

  if (!r) {
    return (
      <div className="app">
        <div className="topbar"><button className="brand" onClick={onBack} style={{ background: "none", border: "none" }}><span style={{ color: "var(--mut)", fontFamily: "var(--mono)", fontSize: "0.9rem" }}>‹ back</span></button><Logo height={22} /></div>
        <div className="shell">{err ? <div className="tile" style={{ borderColor: "var(--coral)" }}><div className="tbody" style={{ color: "var(--coral)" }}>{err}</div></div> : <div className="full-center"><div className="spin" /></div>}</div>
      </div>
    );
  }

  const cardAudio = cardAudioUrl(r.card.audio_path);
  const rateTarget = r.rate_turn_id ? r.turns.find((t) => t.turn_id === r.rate_turn_id) : null;
  const recording = rec.status === "recording" || rec.status === "requesting";

  return (
    <div className="app">
      <div className="topbar">
        <button className="brand" onClick={onBack} style={{ background: "none", border: "none" }}><span style={{ color: "var(--mut)", fontFamily: "var(--mono)", fontSize: "0.9rem" }}>‹ rallies</span></button>
        <span className="chip" style={{ fontFamily: "var(--mono)", fontSize: "0.7rem" }}>turn {Math.min(r.turn_count + 1, r.turns_target)} of {r.turns_target}</span>
      </div>
      <div className="shell">
        <div className="eyebrow" style={{ marginBottom: 6 }}>{r.card.title}{r.status === "complete" ? " · complete" : r.has_partner ? "" : " · waiting for a partner"}</div>
        <h1 className="h1" style={{ marginBottom: 14, fontSize: "clamp(1.4rem,6vw,2rem)" }}>{r.my_turn ? (r.redo ? "Say it again." : r.turn_count === 0 ? "Open the rally." : "Your reply.") : r.owe_rating ? "Listen, then rate." : r.status === "complete" ? "Rally done." : "Waiting on your partner."}</h1>

        <div className="sheet" style={{ marginBottom: 18 }}>
          <div className="handle" />
          <div className="shead"><i className="g" />The card · in your language</div>
          <div className="tile acc">
            <div className="tlbl">The situation {cardAudio && <>· <a href={cardAudio} target="_blank" rel="noopener noreferrer" style={{ color: "var(--acc)" }}>▶ listen</a></>}</div>
            <div className="ttitle" style={{ fontSize: "1rem", lineHeight: 1.35 }}>{r.card.situation}</div>
          </div>
          <div className="tile">
            <div className="tlbl">You are</div>
            <div className="tbody">{r.card.persona}</div>
          </div>
          <div className="tile dash">
            <div className="tlbl">Your partner is</div>
            <div className="tbody muted">{r.card.partner_persona}</div>
          </div>
        </div>

        {r.turns.length > 0 && (
          <div className="sheet" style={{ marginBottom: 18 }}>
            <div className="handle" />
            <div className="shead"><i />The rally so far</div>
            {r.turns.map((t) => (
              <div key={t.turn_id} className={t.mine ? "tile" : "tile dash"}>
                <div className="tlbl">Turn {t.turn_no}{t.attempt > 1 ? ` · take ${t.attempt}` : ""} · {t.mine ? "you" : "your partner"} · {Math.round(t.seconds)}s{t.status === "redo" ? " · redo asked" : ""}</div>
                {urls[t.turn_id] ? <audio controls preload="none" src={urls[t.turn_id]} style={{ width: "100%" }} /> : <div className="tbody muted">Loading audio…</div>}
                {t.mine && t.rating && (
                  <div className="tbody muted" style={{ marginTop: 6, fontSize: "0.8rem" }}>
                    Rated {Number(t.rating.aggregate).toFixed(2)} · tone {t.rating.tone} · situation {t.rating.prompt_adherence} · mood {t.rating.mood} · clarity {t.rating.clarity}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {flash && <div className="tile" style={{ borderColor: "var(--acc)", marginBottom: 14 }}><div className="tbody">{flash}</div></div>}
        {err && <div className="tile" style={{ borderColor: "var(--coral)", marginBottom: 14 }}><div className="tbody" style={{ color: "var(--coral)" }}>{err}</div></div>}

        {r.owe_rating && rateTarget && (
          <div className="sheet" style={{ marginBottom: 18 }}>
            <div className="handle" />
            <div className="shead"><i className="g" />Rate turn {rateTarget.turn_no}</div>
            {AXES.map(([key, label, hint]) => (
              <div key={key} className="tile">
                <div className="tlbl">{label}</div>
                <div className="tbody muted" style={{ fontSize: "0.8rem", marginBottom: 8 }}>{hint}</div>
                <div className="stars" role="radiogroup" aria-label={label}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <s key={n} role="radio" aria-checked={scores[key] === n} tabIndex={0} className={scores[key] >= n ? "" : "dim"} onClick={() => setScores((s) => ({ ...s, [key]: n }))} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setScores((s) => ({ ...s, [key]: n })); }} style={{ cursor: "pointer" }}>★</s>
                  ))}
                </div>
              </div>
            ))}
            <div className="tbody muted" style={{ fontSize: "0.8rem" }}>Rate what you heard, nothing else. Ratings are checked against the audio by a linguist. A take below 4 goes back for another try, which is normal, not a punishment.</div>
            <button className="pill mint" disabled={busy} onClick={() => void submitRating()}>{busy ? "Saving…" : "Save rating"}</button>
          </div>
        )}

        {r.my_turn && (
          <div className="sheet" style={{ marginBottom: 18 }}>
            <div className="handle" />
            <div className="shead"><i />{r.redo ? `Turn ${r.next_turn_no} · take ${r.next_attempt}` : `Turn ${r.next_turn_no}`}</div>
            <div className={"tile rectile" + (recording ? " live" : "")}>
              {rec.blob ? (
                <>
                  <audio controls src={rec.url ?? undefined} style={{ width: "100%" }} />
                  {progress !== null ? (
                    <>
                      <div className="progress" style={{ width: "100%", marginTop: 12 }}><div className="fill" style={{ width: `${Math.max(3, progress)}%` }} /></div>
                      <div className="rectime" style={{ marginTop: 6 }}>{progress >= 99 ? "Almost there…" : `Sending… ${progress}%`}</div>
                    </>
                  ) : (
                    <div className="btn-row" style={{ marginTop: 10 }}>
                      <button className="pill ghost" disabled={busy} onClick={() => rec.reset()}>Re-record</button>
                      <button className="pill mint" disabled={busy} onClick={() => void send()}>Send this take</button>
                    </div>
                  )}
                </>
              ) : recording ? (
                <div className="recwrap">
                  <div className="reclive" aria-hidden="true"><span className="recdot" />REC {formatClock(rec.seconds)}</div>
                  <button type="button" className="recbtn rec" onClick={() => rec.stop()} aria-label="Stop recording"><span className="core" /></button>
                  <div className="wv livewv" aria-hidden="true">
                    {Array.from({ length: 28 }).map((_, j) => {
                      const v = rec.levels[rec.levels.length - 28 + j] ?? 0;
                      return <i key={j} className="live" style={{ height: `${Math.max(8, Math.round(v * 100))}%` }} />;
                    })}
                  </div>
                  <div className="rectime" style={{ color: "var(--coral)" }}>{rec.status === "requesting" ? "Asking for the mic…" : `Recording… up to ${r.max_turn_seconds}s`}</div>
                  <div className="progress" style={{ width: "100%" }}><div className="fill" style={{ width: `${Math.min(100, (rec.seconds / r.max_turn_seconds) * 100)}%`, background: "var(--coral)" }} /></div>
                </div>
              ) : (
                <div className="recwrap">
                  <button type="button" className="recbtn" onClick={() => void rec.start()} aria-label="Start recording"><span className="core" /></button>
                  <div className="rectime">{r.redo ? "Your partner asked for another take. Tap to record." : "Tap to record your turn. Improvise; there are no lines."}</div>
                </div>
              )}
              {rec.error && <div className="tbody" style={{ color: "var(--coral)", marginTop: 8 }}>{rec.error}</div>}
            </div>
          </div>
        )}

        {!r.my_turn && !r.owe_rating && r.status !== "complete" && (
          <div className="tile" style={{ marginBottom: 18 }}>
            <div className="tbody muted">{r.has_partner ? "Your partner has the next turn. This page refreshes on its own; you can also come back later from your rallies." : "Your take is in. As soon as a stranger who speaks your language joins, they'll rate it and reply."}</div>
          </div>
        )}
        {r.status === "complete" && (
          <div className="tile" style={{ borderColor: "var(--acc)", marginBottom: 18 }}>
            <div className="tbody">All {r.turns_target} turns are in and rated. A linguist verifies the transcript next; your verified time shows up in your earnings after that.</div>
          </div>
        )}
      </div>
    </div>
  );
}
