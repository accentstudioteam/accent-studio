import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRecorder } from "@/lib/recorder";
import { uploadRecording } from "@/lib/upload";
import { cardAudioUrl, dueLabel, LANG_NAME, loadRally, rateTurn, submitTurn, turnUrl, type Rally as RallyState, type RallyTurn } from "@/lib/game";
import { demo, demoSampleTake, isDemo } from "@/lib/demo";
import { avatarById, avatarFor, avatarSVG, UNKNOWN_AVATAR, type AnkaraAvatar } from "@/components/ankara-avatars";
import { haptic } from "@/lib/haptics";

/* ============================================================================
   The rally screen in the approved "Ankara Blocks" direction.

   The markup and class names below are the prototype's
   (scratchpad/ankara-demo/app.html); its CSS lives in tokens.css under the
   .ankara scope. The data, the RPCs and every rule of the game are the ones
   that were already here:
     · a turn is yours only when the server says my_turn (next === me AND no
       rating owed) — the mic is gated on that flag alone,
     · turns[] is latest-attempt-only, so a redone take disappears from the
       payload; nothing here accumulates takes,
     · ratings arrive on the 20 s poll (2.5 s in the demo),
     · turns_target, max_turn_seconds, the redo threshold and the attempt cap
       all come from the payload, never from a constant in this file.
   ========================================================================= */

const AXES: [keyof Scores, string, string][] = [
  ["tone", "Tone", "Did it sound like the person on the card?"],
  ["prompt_adherence", "The situation", "Did they play the situation, not something else?"],
  ["mood", "Mood", "Did the feeling land: vexed, calm, playful?"],
  ["clarity", "Clarity", "Could you hear every word?"],
];
type Scores = { tone: number; prompt_adherence: number; mood: number; clarity: number };

/** Prototype: WORDS */
const WORDS = ["", "Not there", "Needs work", "Okay", "Good", "Excellent"];

/* ---------- prototype helpers, lifted as-is ---------- */
const fmt = (s: number) => {
  const v = Math.max(0, Math.round(s));
  return `${Math.floor(v / 60)}:${`0${v % 60}`.slice(-2)}`;
};
const mean = (arr: number[]) => (arr.length ? arr.reduce((t, v) => t + v, 0) / arr.length : 0);
const reduced = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function genLevels(n: number, seed: number): number[] {
  const out: number[] = [];
  let x = seed * 9301 + 49297;
  for (let i = 0; i < n; i++) {
    x = (x * 9301 + 49297) % 233280;
    const r = x / 233280;
    out.push(Math.min(1, 0.18 + 0.82 * (0.5 + 0.5 * Math.sin(i * 0.55 + seed)) * (0.55 + 0.45 * r)));
  }
  return out;
}
function resample(arr: number[], n: number, seed: number): number[] {
  if (!arr.length) return genLevels(n, seed);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const idx = Math.min(arr.length - 1, Math.floor((i * arr.length) / n));
    out.push(Math.max(0.08, Math.min(1, arr[idx])));
  }
  return out;
}
/** A stable seed for a turn, so its waveform never reshuffles between polls. */
const seedOf = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 997;
};

function compliment(agg: number, attempt: number, maxAttempts: number): [string, string] {
  if (agg >= 4.75) return ["Perfect run!", "Your partner heard every word and every feeling."];
  if (agg >= 4.5) return ["You sound great!", "That is a strong take. Keep that energy."];
  if (agg >= 4) return ["Great job!", "Solid take. On to the next turn."];
  if (attempt >= maxAttempts) return ["Awesome, that one counts.", `Take ${attempt} is accepted. On to the next turn.`];
  return ["Good try. One more take.", `Below 4, so you say it again. Take ${attempt + 1} of ${maxAttempts}.`];
}

/* ---------- prototype icons ---------- */
const IcPlay = () => <svg className="ic-play" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" /></svg>;
const IcPause = () => <svg className="ic-pause" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" /></svg>;
const IcStar = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.3 6.4L12 17.1l-5.8 3.2 1.3-6.4L2.8 9.5l6.4-.8z" /></svg>;
const IcClock = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>;
const IcTick = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5" /></svg>;
const IcChevDown = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>;
const IcBack = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>;
const IcMic = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" stroke="none" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3" /><path d="M8.5 21h7" /></svg>;

/* ---------- avatar ---------- */
/** The sprites declare <mask id="vm-…">; useId gives each mount its own copy. */
function Ava({ who, size, className = "" }: { who: AnkaraAvatar; size: number; className?: string }) {
  const raw = useId();
  const uid = raw.replace(/[^a-zA-Z0-9]/g, "");
  const html = useMemo(() => avatarSVG(who, size, uid), [who, size, uid]);
  return <span className={`ava ${className}`.trim()} style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: html }} />;
}

/* ---------- voice note ---------- */
type NoteState = "idle" | "uploading";

/** The prototype's .note, driven by a real <audio> element. */
function Note({ src, seconds, levels, label, time, mine, state = "idle", ring, status }: {
  src: string | null;
  seconds: number;
  levels: number[];
  label: string;
  time: string;
  mine: boolean;
  state?: NoteState;
  ring?: number;
  status?: "tick" | "rated" | null;
}) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    const onPlay = () => {
      setPlaying(true);
      document.querySelectorAll("audio").forEach((other) => {
        if (other !== a && !other.paused) other.pause();
      });
    };
    const onStop = () => setPlaying(false);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onStop);
    a.addEventListener("ended", onStop);
    return () => {
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onStop);
      a.removeEventListener("ended", onStop);
    };
  }, [src]);

  const toggle = () => {
    const a = ref.current;
    if (!a) return;
    if (a.paused) void a.play().catch(() => setPlaying(false));
    else a.pause();
  };

  const bars = levels.map((v, i) => <i key={i} style={{ height: `${5 + Math.round(v * 23)}px` }} />);
  const offset = ring === undefined ? undefined : (138.2 * (1 - ring / 100)).toFixed(1);

  return (
    <div className={`note${playing ? " playing" : ""}${state === "uploading" ? " uploading" : ""}`}>
      {src && <audio ref={ref} src={src} preload="metadata" />}
      <button className="play" type="button" onClick={toggle} disabled={!src} aria-label={`Play voice note, ${fmt(seconds)}`}>
        <IcPlay />
        <IcPause />
        {mine && (
          <svg className="ring" viewBox="0 0 50 50" aria-hidden="true">
            <circle className="bg" cx="25" cy="25" r="22" />
            <circle className="fg" cx="25" cy="25" r="22" style={offset === undefined ? undefined : { strokeDashoffset: offset }} />
          </svg>
        )}
      </button>
      <div className="wave" style={{ "--dur": `${seconds}s` } as CSSProperties}>
        <div className="wave-base">{bars}</div>
        <div className="wave-fill">{bars}</div>
      </div>
      <div className="note-foot">
        <span className="dur">{fmt(seconds)}</span>
        <span className="meta">
          {label} · {time}
          {mine && (
            <span className={`st ${state === "uploading" ? "clock" : status ?? ""}`.trim()}>
              {state === "uploading" ? <IcClock /> : status === "rated" ? "Rated" : status === "tick" ? <IcTick /> : null}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

/* ---------- the gold card that lands when a rating comes back ---------- */
function ScoreCard({ t, maxAttempts, onParty }: { t: RallyTurn; maxAttempts: number; onParty: (node: HTMLElement) => void }) {
  const r = t.rating!;
  const box = useRef<HTMLDivElement | null>(null);
  const [agg, setAgg] = useState(reduced() ? r.aggregate : 0);
  const [lit, setLit] = useState<number>(reduced() ? 5 : 0);
  const [comp, setComp] = useState(reduced());

  useEffect(() => {
    if (reduced()) {
      haptic.score(r.aggregate);
      return;
    }
    const timers: number[] = [];
    let raf = 0;
    timers.push(window.setTimeout(() => {
      const t0 = performance.now();
      const frame = (ts: number) => {
        const p = Math.min(1, (ts - t0) / 700);
        const e = 1 - Math.pow(1 - p, 3);
        setAgg(r.aggregate * e);
        if (p < 1) raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
      for (let k = 1; k <= 5; k++) timers.push(window.setTimeout(() => setLit(k), k * 90));
      timers.push(window.setTimeout(() => {
        setComp(true);
        haptic.score(r.aggregate);
        if (r.aggregate >= 5 && box.current) onParty(box.current);
      }, 820));
    }, 300));
    return () => {
      timers.forEach(window.clearTimeout);
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.turn_id]);

  const [ct, cs] = compliment(r.aggregate, t.attempt, maxAttempts);
  return (
    <div className="rcard in-rating" ref={box}>
      <div className="eyebrow">Rated by your partner</div>
      <div className={`comp${comp ? " slam" : ""}`} aria-live="polite">
        <div className="comp-t">{comp ? ct : ""}</div>
        <div className="comp-s">{comp ? cs : ""}</div>
      </div>
      <div className={`agg${agg >= r.aggregate ? " bounce" : ""}`}>
        <b>{agg.toFixed(2)}</b>
        <span>/ 5</span>
      </div>
      {AXES.map(([key, label]) => (
        <div className="axr" key={key}>
          <span>{label}</span>
          <span className="stars" aria-label={`${r[key]} of 5`}>
            {[1, 2, 3, 4, 5].map((n) => (
              <span key={n} className={`star${n <= r[key] && n <= lit ? " lit" : ""}`}><IcStar /></span>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}

const clockTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const turnLabelFor = (t: RallyTurn) => `Turn ${t.turn_no}${t.attempt > 1 ? ` · take ${t.attempt}` : ""}`;

/** What the partner still owes on a live rally, for the dashed bubble at the end of the thread. */
function pendingPartner(r: RallyState): { turn: number | null; text: string } | null {
  if (r.status !== "waiting" && r.status !== "active") return null;
  if (!r.has_partner) return { turn: null, text: "Your take is in. A stranger who speaks your language joins, rates it and replies." };
  if (r.i_owe || r.owe_rating) return null;
  const theirRedo = r.turns.some((t) => !t.mine && t.status === "redo");
  const redoTurn = r.turns.filter((t) => !t.mine).slice(-1)[0]?.turn_no ?? null;
  return { turn: theirRedo ? redoTurn : r.turn_count + 1, text: `${theirRedo ? "Saying it again" : "Their reply"} · due ${dueLabel(r.due_at)}` };
}

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
  const [sample, setSample] = useState<{ url: string; seconds: number } | null>(null);
  const [fake, setFake] = useState<{ seconds: number; levels: number[] } | null>(null);
  const rec = useRecorder(r?.max_turn_seconds ?? 30);

  // presentation only
  const [rules, setRules] = useState<"shut" | "open" | "closing">("shut");
  // Shown on every open, in-progress rallies included: the warning only works if it is unmissable.
  const [names, setNames] = useState<"shut" | "open" | "closing">("shut");
  const warned = useRef(false);
  useEffect(() => {
    if (!r || warned.current) return;
    warned.current = true;
    setNames("open");
  }, [r]);
  const closeNames = useCallback(() => {
    setNames("closing");
    window.setTimeout(() => setNames("shut"), reduced() ? 10 : 240);
  }, []);
  const [cardOpen, setCardOpen] = useState(true);
  const [atBottom, setAtBottom] = useState(true);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const confettiRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  // Partner takes seen so far, so the poll can tell a new reply from a redraw. Null until the first load.
  const seenTheirs = useRef<number | null>(null);
  // Mirrors the recorder so load() can check it without taking the recorder as a dependency.
  const capturing = useRef(false);
  useEffect(() => {
    capturing.current = rec.status === "recording" || rec.status === "requesting" || fake !== null;
  }, [rec.status, fake]);

  // Demo: act out a recording for a few seconds, then stand in one of the founders' clips. The mic is never touched.
  const startFakeRecording = () => {
    const started = Date.now();
    const id = window.setInterval(() => {
      const s = (Date.now() - started) / 1000;
      setFake((f) => ({ seconds: s, levels: [...(f?.levels ?? []).slice(-27), 0.25 + Math.random() * 0.6] }));
      if (s >= 4.2) {
        window.clearInterval(id);
        setFake(null);
        setSample(demoSampleTake());
      }
    }, 100);
  };

  const load = useCallback(async () => {
    try {
      const next = await loadRally(sessionId);
      // A reply that landed since the last poll. Never buzz mid-take: the mic hears the motor.
      const theirs = next.turns.filter((t) => !t.mine).length;
      if (seenTheirs.current !== null && theirs > seenTheirs.current && !capturing.current) haptic.reply();
      seenTheirs.current = theirs;
      setR(next);
      if (next.status === "abandoned") setFlash(null);
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
    const id = window.setInterval(() => void load(), isDemo() ? 2_500 : 20_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const send = async () => {
    if (!r || (!rec.blob && !sample)) return;
    setBusy(true);
    setErr(null);
    try {
      const path = `${r.session_id}/turn-${r.next_turn_no}-a${r.next_attempt}-${r.my_speaker_id}.${sample ? "mp3" : extFor(rec.mime)}`;
      if (sample) {
        // demo only: a founder's clip stands in for the microphone
        demo.storeBlob(path, sample.url);
        for (let pct = 8; pct <= 96; pct += 22) {
          setProgress(pct);
          await new Promise((res) => setTimeout(res, 140));
        }
        await submitTurn(r.session_id, path, sample.seconds);
        setSample(null);
      } else {
        const base = rec.mime.split(";")[0] || "audio/webm";
        await uploadRecording(path, rec.blob!, base, (pct) => setProgress(pct), "sessions");
        await submitTurn(r.session_id, path, rec.seconds);
      }
      rec.reset();
      setProgress(null);
      haptic.sent();
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
      haptic.rated();
      setFlash(out.redo ? `Rated ${out.aggregate.toFixed(2)}. Below 4, so your partner will say it again.` : out.complete ? `Rated ${out.aggregate.toFixed(2)}. That was the last turn. Rally complete.` : `Rated ${out.aggregate.toFixed(2)}. Now record your reply.`);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "Couldn't save the rating.");
    }
    setBusy(false);
  };

  /* ---------- the prototype's confetti ---------- */
  const party = useCallback((n: number, origin: HTMLElement | null) => {
    const layer = confettiRef.current;
    const root = rootRef.current;
    if (!layer || !root || reduced() || typeof layer.animate !== "function") return;
    const pr = root.getBoundingClientRect();
    let ox = pr.width / 2;
    let oy = pr.height * 0.22;
    if (origin) {
      const b = origin.getBoundingClientRect();
      ox = b.left + b.width / 2 - pr.left;
      oy = b.top + b.height * 0.3 - pr.top;
    }
    const cols = ["#45E0A0", "#E0A24E", "#E08A5C", "#A78BFA"];
    for (let i = 0; i < n; i++) {
      const d = document.createElement("i");
      const w = 6 + Math.random() * 6;
      d.style.cssText = `left:${ox}px;top:${oy}px;background:${cols[i % 4]};width:${w}px;height:${w * (0.6 + Math.random() * 0.8)}px;`;
      layer.appendChild(d);
      const dx = (Math.random() - 0.5) * 280;
      const dy1 = -60 - Math.random() * 130;
      const dy2 = 180 + Math.random() * 180;
      const rot = (Math.random() - 0.5) * 720;
      const anim = d.animate(
        [
          { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
          { transform: `translate(${dx * 0.6}px,${dy1}px) rotate(${rot * 0.4}deg)`, opacity: 1, offset: 0.35 },
          { transform: `translate(${dx}px,${dy2}px) rotate(${rot}deg)`, opacity: 0 },
        ],
        { duration: 1400, easing: "cubic-bezier(.2,.6,.3,1)", fill: "forwards" },
      );
      anim.onfinish = () => d.remove();
    }
  }, []);

  const complete = r?.status === "complete";
  useEffect(() => {
    if (complete) party(30, null);
  }, [complete, party]);

  /* ---------- thread stickiness: the prototype's "↓ New" chip ---------- */
  const turnCount = r?.turns.length ?? 0;
  useEffect(() => {
    const el = threadRef.current;
    if (!el || !atBottom) return;
    el.scrollTop = el.scrollHeight;
  }, [turnCount, atBottom, r?.owe_rating, r?.my_turn, flash, err]);

  const onThreadScroll = () => {
    const el = threadRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 48);
  };
  const jumpDown = () => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: reduced() ? "auto" : "smooth" });
    setAtBottom(true);
  };

  if (!r) {
    return (
      <div className="ankara rally-root">
        <header className="hdr">
          <div className="hdr-row1">
            <button className="back" type="button" onClick={onBack} aria-label="Back to your rallies"><IcBack /></button>
            <div className="hdr-partner"><div className="p-text"><span className="p-name">Rally</span><span className="p-title">{err ? "Couldn't load" : "Opening…"}</span></div></div>
          </div>
        </header>
        <div className="thread-wrap">
          <div className="thread">{err ? <div className="notice">{err}</div> : <div className="sys">Opening the rally</div>}</div>
        </div>
      </div>
    );
  }

  const cardAudio = cardAudioUrl(r.card.audio_path);
  const pending = pendingPartner(r);
  const rateTarget = r.rate_turn_id ? r.turns.find((t) => t.turn_id === r.rate_turn_id) : null;
  const recording = rec.status === "recording" || rec.status === "requesting" || fake !== null;
  const liveSeconds = fake ? fake.seconds : rec.seconds;
  const liveLevels = fake ? fake.levels : rec.levels;

  // The character is stored on the contributor now, so it is the same face here,
  // on every other rally, and in the mail. avatarFor() is only the demo-mode and
  // pre-backfill fallback.
  const me = r.my_avatar ? avatarById(r.my_avatar) : avatarFor(r.my_speaker_id);
  const partner = !r.has_partner ? UNKNOWN_AVATAR : r.partner_avatar ? avatarById(r.partner_avatar) : avatarFor(r.session_id, 5);
  // The attempt cap is DB game config; pp_session does not surface it, so this
  // mirrors the server value and only ever drives wording and pip state.
  const maxAttempts = 3;
  const mineOnTurn = (no: number) => (no % 2 === 1 ? r.i_am === "a" : r.i_am === "b");
  const latestTurn = (no: number) => [...r.turns].reverse().find((t) => t.turn_no === no) ?? null;

  const myRated = r.turns.filter((t) => t.mine && t.rating).map((t) => t.rating!.aggregate);
  const score = myRated.length ? mean(myRated) : null;
  const recordedTotal = r.turns.filter((t) => t.mine).reduce((s, t) => s + t.seconds, 0);

  const sending = progress !== null;
  const preview = (rec.blob || sample) && !sending;
  const draftLevels = sample ? genLevels(36, seedOf(r.session_id)) : resample(rec.levels, 36, seedOf(r.session_id));
  const draftSeconds = sample ? sample.seconds : rec.seconds;

  const pips = Array.from({ length: r.turns_target }, (_, i) => {
    const no = i + 1;
    const t = latestTurn(no);
    const mine = mineOnTurn(no);
    const done = !!t;
    const ok = !!(t && t.rating && (Number(t.rating.aggregate) >= 4 || t.attempt >= maxAttempts));
    const cur = r.status !== "complete" && no === r.next_turn_no;
    const att = Math.max(t ? t.attempt : 1, no === r.next_turn_no ? r.next_attempt : 1);
    const cls = ["pip", mine ? "mine" : "", done ? "done" : "", ok ? "ok" : "", cur && (!done || r.next_attempt > 1) ? "cur" : "", cur && r.my_turn ? "pulse" : "", complete ? "cascade" : ""].filter(Boolean).join(" ");
    const state = ok ? "accepted" : done ? "recorded" : cur ? "now" : "to come";
    return {
      key: no,
      cls,
      att,
      style: complete ? { animationDelay: `${i * 80}ms` } : undefined,
      label: `turn ${no}${mine ? " (you)" : " (partner)"}: ${state}${att > 1 ? `, take ${att}` : ""}`,
    };
  });

  const ratedCount = Object.values(scores).filter((v) => v > 0).length;
  const avgNow = ratedCount === 4 ? mean(Object.values(scores)) : 0;
  const avgLine =
    ratedCount === 4
      ? `Average ${avgNow.toFixed(2)}${avgNow >= 4 ? " · they continue" : rateTarget && rateTarget.attempt >= maxAttempts ? " · third take counts" : " · they say it again"}`
      : ratedCount === 0
        ? "Tap the stars on all four."
        : `${4 - ratedCount} more to rate.`;

  const promptText = r.redo ? `SAY IT AGAIN · TAKE ${r.next_attempt}` : `TURN ${r.next_turn_no} · YOU'RE UP`;

  /* ---------- composer ---------- */
  let composer: JSX.Element | null = null;
  if (r.status === "complete" || r.status === "abandoned") {
    composer = null;
  } else if (r.my_turn && preview) {
    composer = (
      <div className="c-state" id="c-prev">
        <div className="draft-wrap">
          <div className="draft">
            <div className="draft-lab">Draft</div>
            <Note src={sample ? sample.url : rec.url} seconds={draftSeconds} levels={draftLevels} label={`Turn ${r.next_turn_no}${r.next_attempt > 1 ? ` · take ${r.next_attempt}` : ""}`} time={clockTime(new Date().toISOString())} mine={false} />
          </div>
        </div>
        <div className="c-actions">
          <button className="btn btn-outline" type="button" disabled={busy} onClick={() => { rec.reset(); setSample(null); }}>Re-record</button>
          <button className="btn btn-mint" type="button" disabled={busy} onClick={() => void send()}>Send</button>
        </div>
      </div>
    );
  } else if (r.my_turn && sending) {
    composer = (
      <div className="c-state">
        <div className="c-text">
          <strong>{progress! >= 99 ? "Almost there…" : `Sending… ${progress}%`}</strong>
          <span>Your note is on its way to the studio.</span>
        </div>
        <span className="mic dim" aria-hidden="true"><IcMic /></span>
      </div>
    );
  } else if (r.my_turn && recording) {
    const bars = Array.from({ length: 28 }, (_, j) => liveLevels[liveLevels.length - 28 + j] ?? 0);
    // A ceiling exists, but counting down to it makes people rush and cut their own story
    // short. Show the time they have used, and only mention the limit in the last fifteen
    // seconds, when it is finally information they can act on.
    const nearEnd = liveSeconds >= r.max_turn_seconds - 15;
    const left = Math.max(0, Math.ceil(r.max_turn_seconds - liveSeconds));
    composer = (
      <div className="c-state">
        <div className="rec-left">
          <div className={`timer${nearEnd ? " last5" : ""}`} aria-live="off"><span id="rec-time">{fmt(liveSeconds)}</span></div>
          <div className="meter" aria-hidden="true">{bars.map((v, j) => <i key={j} style={{ height: `${6 + Math.round(v * 30)}px` }} />)}</div>
          {nearEnd && <div className="rail" aria-hidden="true"><i style={{ width: `${Math.min(100, (liveSeconds / r.max_turn_seconds) * 100)}%` }} /></div>}
          <div className="c-sub">{fake ? "Recording (demo) · a sample clip stands in for your voice" : rec.status === "requesting" ? "Asking for the mic…" : nearEnd ? `Wrap up, ${left}s left` : "Recording · take your time"}</div>
        </div>
        <button className="stop" type="button" onClick={() => (fake ? undefined : rec.stop())} aria-label="Stop recording"><span className="stop-core" /></button>
      </div>
    );
  } else if (r.my_turn) {
    composer = (
      <div className="c-state">
        <div className="c-text">
          <strong>{r.redo ? `Say it again · take ${r.next_attempt} of ${maxAttempts}` : `Tap to record · up to ${fmt(r.max_turn_seconds)}`}</strong>
          <span>{isDemo() ? "Demo · a sample clip stands in for your voice" : "Improvise. No script."}</span>
        </div>
        <button className="mic" type="button" onClick={() => (isDemo() ? startFakeRecording() : void rec.start())} aria-label="Record your voice note"><IcMic /></button>
      </div>
    );
  } else {
    const title = r.owe_rating && rateTarget ? `Listen, then rate turn ${rateTarget.turn_no}` : r.has_partner ? "Waiting for your partner…" : "Waiting for a partner…";
    const sub = r.owe_rating ? "Your mic comes back after you rate." : r.has_partner ? `Their reply is due ${dueLabel(r.due_at)}.` : "Replies are due within 24 hours.";
    composer = (
      <div className="c-state">
        <div className="c-text"><strong>{title}</strong><span>{sub}</span></div>
        <span className="mic dim" aria-hidden="true"><IcMic /></span>
      </div>
    );
  }

  return (
    <div className="ankara rally-root" ref={rootRef}>
      <header className="hdr">
        <div className="hdr-row1">
          <button className="back" type="button" onClick={onBack} aria-label="Back to your rallies"><IcBack /></button>
          <div className="hdr-partner">
            <Ava who={partner} size={36} className="p-ava" />
            <div className="p-text">
              <span className="p-name">{r.has_partner ? r.partner_alias ?? "Partner" : "Finding a partner"}</span>
              <span className="p-title">{r.card.title}</span>
            </div>
          </div>
          <button className="chip chip-cream rulesbtn" type="button" onClick={() => setRules("open")} aria-label="How a rally works">Rules</button>
        </div>
        <div className="hdr-row2">
          <div className="turns">
            <div className="pips" role="img" aria-label={pips.map((p) => p.label).join("; ")}>
              {pips.map((p) => (
                <span key={p.key} className={p.cls} style={p.style}>
                  {p.att > 1 && <span className="att">{p.att}</span>}
                </span>
              ))}
            </div>
            <span className="turn-label">Turn {Math.min(r.next_turn_no, r.turns_target)} of {r.turns_target}</span>
          </div>
          <div className="counter">
            <span className="c-lab">Score</span>
            <span className="c-val bump" key={`s${score ?? "none"}`}>{score === null ? "–" : score.toFixed(2)}</span>
          </div>
          <div className="counter">
            <span className="c-lab">Recorded</span>
            <span className="c-val bump" key={`r${recordedTotal}`}>{fmt(recordedTotal)}</span>
          </div>
        </div>
      </header>

      <div className="thread-wrap">
        <div className="thread" ref={threadRef} onScroll={onThreadScroll} role="log" aria-live="polite" aria-relevant="additions">
          <div className="sys">Rally opened · {r.card.title}</div>

          <div className={`card in-card${cardOpen ? "" : " collapsed"}`}>
            <div className="eyebrow">Your card · {LANG_NAME[r.language] ?? r.language}</div>
            <h2>{r.card.title}</h2>
            <button className="collapse" type="button" aria-label={cardOpen ? "Hide the card" : "Show the card"} aria-expanded={cardOpen} onClick={() => setCardOpen((v) => !v)}><IcChevDown /></button>
            {cardOpen && (
              <div className="card-body">
                <p>{r.card.situation}</p>
                <div className="roles">
                  <div className="role"><b>You are</b><span>{r.card.persona}</span></div>
                  <div className="role"><b>Your partner is</b><span>{r.card.partner_persona}</span></div>
                </div>
                {cardAudio && (
                  <a className="btn btn-ink listen" href={cardAudio} target="_blank" rel="noopener noreferrer">
                    <IcPlay /><span>Listen to the card</span><i className="lfill" aria-hidden="true" />
                  </a>
                )}
              </div>
            )}
          </div>

          {r.turns.map((t) => {
            const label = turnLabelFor(t);
            const time = clockTime(t.created_at);
            const levels = genLevels(36, seedOf(t.turn_id));
            return (
              <div className="tgroup" key={t.turn_id}>
                <div className={`msg ${t.mine ? "right" : "left in-left"}`}>
                  <Ava who={t.mine ? me : partner} size={36} />
                  <div className="bubble">
                    <Note
                      src={urls[t.turn_id] ?? null}
                      seconds={t.seconds}
                      levels={levels}
                      label={label}
                      time={time}
                      mine={t.mine}
                      status={t.rating ? "rated" : "tick"}
                    />
                  </div>
                </div>
                {t.mine && t.rating && <ScoreCard t={t} maxAttempts={maxAttempts} onParty={(node) => party(12, node)} />}
                {!t.mine && t.rating && (
                  <div className="ratechip in-pop">
                    <span>You rated {Number(t.rating.aggregate).toFixed(2)}</span>
                    <span className="mstars" aria-hidden="true">{"★".repeat(Math.floor(Number(t.rating.aggregate)))}{"☆".repeat(5 - Math.floor(Number(t.rating.aggregate)))}</span>
                    {t.status === "redo" && <span>· they'll say it again</span>}
                  </div>
                )}
              </div>
            );
          })}

          {r.my_turn && (
            <div className="prompt" role="heading" aria-level={3} aria-label={promptText}>
              <span aria-hidden="true">
                {promptText.split("").map((ch, i) => (
                  <span className="ch" key={i} style={{ animationDelay: `${i * 30}ms` }}>{ch}</span>
                ))}
              </span>
            </div>
          )}

          {r.owe_rating && rateTarget && (
            <div className="rform card in-left">
              <h3>Listen, then rate turn {rateTarget.turn_no}</h3>
              {AXES.map(([key, label, hint]) => (
                <div className={`rrow${scores[key] ? " set" : ""}`} key={key}>
                  <div className="rrow-h">
                    <span className="rlab">{label}</span>
                    <span className="rword">{scores[key] ? WORDS[scores[key]] : ""}</span>
                  </div>
                  <div className="rhint">{hint}</div>
                  <div className="srow" role="radiogroup" aria-label={label}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={scores[key] === n}
                        aria-label={`${n} of 5, ${WORDS[n]}`}
                        className={`sbtn${scores[key] >= n ? " on" : ""}`}
                        onClick={() => setScores((s) => ({ ...s, [key]: n }))}
                      >
                        <IcStar />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="avgline" aria-live="polite">{avgLine}</div>
              <p className="rnote">Rate what you heard, nothing else. Ratings are checked against the audio by a linguist. A take below 4 goes back for another try, which is normal, not a punishment.</p>
              <button className="btn btn-mint btn-block rsend" type="button" disabled={busy || ratedCount < 4} onClick={() => void submitRating()}>{busy ? "Saving…" : "Send rating"}</button>
            </div>
          )}

          {pending && (
            <div className="msg left in-left">
              <Ava who={partner} size={36} />
              <div className="bubble dashed">
                {pending.turn ? `Turn ${pending.turn} · ` : ""}{pending.text}
                <span className="dots" aria-hidden="true"><i /><i /><i /></span>
              </div>
            </div>
          )}

          {flash && <div className="notice in-pop">{flash}</div>}
          {err && <div className="notice in-pop shake">{err}</div>}
          {rec.error && <div className="notice in-pop">{rec.error}</div>}

          {r.status === "complete" && (
            <div className="donecard in-rise">
              <div className="eyebrow">All {r.turns_target} turns in</div>
              <h2>Rally complete</h2>
              <div className="stats">
                <div><b>{score === null ? "–" : score.toFixed(2)}</b><span>Score</span></div>
                <div><b>{fmt(recordedTotal)}</b><span>Recorded</span></div>
              </div>
              <p>All {r.turns_target} turns are in and rated. A linguist verifies the transcript next; your verified time shows up in Money after that.{r.flags.includes("short_rally") ? " This rally came out short, so the linguist will take a closer look; that is a check, not a penalty." : ""}</p>
              <button className="btn btn-mint btn-block" type="button" onClick={onBack}>Back to your rallies</button>
            </div>
          )}

          {r.status === "abandoned" && (
            <div className="notice in-pop">Your partner didn't reply within 24 hours, so this rally is closed. Every take you recorded here is kept, goes to the linguist, and counts toward your verified time. Tap Play and you'll be paired fresh.</div>
          )}
        </div>
        {!atBottom && <button className="newchip" type="button" onClick={jumpDown}>↓ New</button>}
      </div>

      {composer && <div className="composer card">{composer}</div>}

      <div className={`sheet-wrap${names === "open" ? " open" : names === "closing" ? " closing" : ""}`} hidden={names === "shut"}>
        <button className="scrim" type="button" aria-label="Close" tabIndex={-1} onClick={closeNames} />
        <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="names-title">
          <div className="grab" aria-hidden="true" />
          <div className="eyebrow">Before you record</div>
          <h2 id="names-title">Keep real names out of it.</h2>
          <p style={{ marginBottom: 14 }}>
            In here you are <strong>{r.my_alias ?? "your alias"}</strong>, and that is all your partner ever learns about you.
            Everything you record becomes part of a dataset other people will hear, so anything you say out loud stays in it.
          </p>
          <ol className="rules">
            <li>Don't say your own name, and don't ask your partner for theirs.</li>
            <li>Leave out phone numbers, addresses, your workplace or your school.</li>
            <li>Play the person on the card. Invent a name if the scene needs one.</li>
            <li>If a real name slips out, record the take again. You can redo up to {maxAttempts} times.</li>
          </ol>
          <button className="btn btn-mint btn-block" type="button" onClick={closeNames}>Got it</button>
        </div>
      </div>

      <div className={`sheet-wrap${rules === "open" ? " open" : rules === "closing" ? " closing" : ""}`} hidden={rules === "shut"}>
        <button className="scrim" type="button" aria-label="Close rules" tabIndex={-1} onClick={() => { setRules("closing"); window.setTimeout(() => setRules("shut"), reduced() ? 10 : 240); }} />
        <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="rules-title">
          <div className="grab" aria-hidden="true" />
          <div className="eyebrow">Ping-pong rally</div>
          <h2 id="rules-title">How a rally works</h2>
          <ol className="rules">
            <li>You get a card in your language: a situation and who you are in it.</li>
            <li>Record one voice note, up to {r.max_turn_seconds} seconds, your way. No script.</li>
            <li>A stranger has the other role. They listen, rate your take on four things, then reply.</li>
            <li>{r.turns_target} turns and the rally is done.</li>
            <li>Below 4 out of 5 you say it again (up to {maxAttempts} takes). Normal, not a punishment.</li>
            <li>Each reply is due within 24 hours. If a partner goes quiet the rally closes, your takes still count, and your next Play pairs you fresh.</li>
          </ol>
          <button className="btn btn-mint btn-block" type="button" onClick={() => { setRules("closing"); window.setTimeout(() => setRules("shut"), reduced() ? 10 : 240); }}>Got it, let's play</button>
        </div>
      </div>

      <div className="confetti" ref={confettiRef} aria-hidden="true" />
    </div>
  );
}
