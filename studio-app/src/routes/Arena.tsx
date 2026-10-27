import { useCallback, useEffect, useRef, useState } from "react";
import { finish, join, rate, type Scene } from "@/lib/arena";
import { ArenaCall, DEFAULT_ICE, SupabaseSignal } from "@/lib/rtc";
import { openArenaMic, type ArenaMic } from "@/lib/arenaAudio";
import { uploadRecording } from "@/lib/upload";
import { isDemo } from "@/lib/demo";
import { IcBack, IcStar, Notice, Page } from "@/components/ankara-ui";

type Phase = "lobby" | "countdown" | "live" | "uploading" | "rate" | "done" | "lapsed";
type Scores = { tone: number; prompt_adherence: number; mood: number; clarity: number };
const AXES: [keyof Scores, string, string][] = [
  ["tone", "Tone", "Did they sound like the person on the card?"],
  ["prompt_adherence", "The situation", "Did they play the situation, not something else?"],
  ["mood", "Mood", "Did the feeling land?"],
  ["clarity", "Clarity", "Could you hear every word?"],
];
const DEMO_CLIPS = ["scene_bank_02", "scene_bank_04", "scene_bank_02", "scene_bank_04"];
const clipUrl = (name: string) => window.ACCENT_DEMO_CLIPS?.[name] ?? `${window.location.origin}/audio/${name}.mp3`;
const extFor = (mime: string) => (mime.includes("mp4") ? "mp4" : mime.includes("ogg") ? "ogg" : mime.includes("wav") ? "wav" : "webm");
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, "0")}`;

interface Props {
  sessionId: string;
  onBack: () => void;
}

/** A live scene: the green room, a countdown, five minutes of improv with twists and a chemistry meter, then the rating. */
export function Arena({ sessionId, onBack }: Props) {
  const [scene, setScene] = useState<Scene | null>(null);
  const [phase, setPhase] = useState<Phase>("lobby");
  const [err, setErr] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [myLevel, setMyLevel] = useState(0);
  const [theirLevel, setTheirLevel] = useState(0);
  const [chem, setChem] = useState(0);
  const [twist, setTwist] = useState<string | null>(null);
  const [callState, setCallState] = useState<string>("not connected");
  const [progress, setProgress] = useState<string | null>(null);
  const [scores, setScores] = useState<Scores>({ tone: 0, prompt_adherence: 0, mood: 0, clarity: 0 });
  const [busy, setBusy] = useState(false);
  const [demoSpeaking, setDemoSpeaking] = useState(false);
  const micRef = useRef<ArenaMic | null>(null);
  const callRef = useRef<ArenaCall | null>(null);
  const remoteRef = useRef<HTMLAudioElement | null>(null);
  const talk = useRef({ me: 0, them: 0, switches: 0, last: "" as "" | "me" | "them" });
  const startedRef = useRef<number | null>(null);
  const liveStart = useRef<number | null>(null);
  const theirRef = useRef(0);
  const speakRef = useRef(false);
  const elapsedRef = useRef(0);
  const chemRef = useRef(0);
  const finishedRef = useRef(false);
  const demoClip = useRef<HTMLAudioElement | null>(null);

  const load = useCallback(async () => {
    try {
      const s = await join(sessionId);
      setScene(s);
      setErr(null);
      return s;
    } catch (e) {
      const msg = e instanceof Error ? e.message.replace(/^.*?: /, "") : "Couldn't join the scene.";
      setErr(msg);
      if (/lapsed|no_show|abandoned|cancelled/.test(msg)) setPhase("lapsed");
      return null;
    }
  }, [sessionId]);

  // Join, open the mic and the call, then wait for the partner.
  useEffect(() => {
    let alive = true;
    void (async () => {
      const s = await load();
      if (!s || !alive) return;
      if (s.my_track) {
        setPhase(s.partner_track && !s.partner_track.rated ? "rate" : "done");
        return;
      }
      if (isDemo()) return;
      try {
        const mic = await openArenaMic();
        if (!alive) return mic.close();
        micRef.current = mic;
        const signal = new SupabaseSignal(sessionId);
        const call = new ArenaCall(signal, s.me === "b", s.my_speaker_id, {
          onRemoteStream: (stream) => {
            if (remoteRef.current) {
              remoteRef.current.srcObject = stream;
              void remoteRef.current.play().catch(() => undefined);
            }
          },
          onState: (st) => setCallState(String(st)),
          onSync: (d) => {
            if (typeof d.level === "number") setTheirLevel(d.level);
          },
          onPeerHello: () => void load(),
        }, s.ice && s.ice.length ? s.ice : DEFAULT_ICE);
        call.addStream(mic.stream);
        call.hello();
        callRef.current = call;
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Microphone unavailable.");
      }
    })();
    return () => {
      alive = false;
      callRef.current?.close();
      micRef.current?.close();
      demoClip.current?.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Poll until both are in; the server stamps started_at when the second player joins.
  useEffect(() => {
    if (phase !== "lobby") return;
    const id = window.setInterval(() => void load(), isDemo() ? 1000 : 3000);
    return () => window.clearInterval(id);
  }, [phase, load]);

  useEffect(() => {
    if (phase !== "lobby" || !scene?.started_at) return;
    startedRef.current = new Date(scene.started_at).getTime();
    setPhase("countdown");
  }, [phase, scene?.started_at]);

  // Three seconds of countdown, then live; the recording starts on the same tick.
  useEffect(() => {
    if (phase !== "countdown") return;
    const t = window.setTimeout(() => {
      setPhase("live");
      micRef.current?.startRecording();
    }, 3000);
    return () => window.clearTimeout(t);
  }, [phase]);

  // The partner's level and the demo "speaking" button feed the clock through refs, so the clock never restarts.
  useEffect(() => {
    theirRef.current = theirLevel;
  }, [theirLevel]);
  useEffect(() => {
    speakRef.current = demoSpeaking;
  }, [demoSpeaking]);

  // The live clock, levels, chemistry and twists. Starts once, when the scene goes live.
  useEffect(() => {
    if (phase !== "live" || !scene) return;
    liveStart.current ??= Date.now();
    const id = window.setInterval(() => {
      const e = (Date.now() - (liveStart.current ?? Date.now())) / 1000;
      elapsedRef.current = e;
      setElapsed(e);
      const mine = isDemo() ? (speakRef.current ? 0.35 + Math.random() * 0.4 : 0.03) : (micRef.current?.level() ?? 0);
      setMyLevel(mine);
      callRef.current?.sync({ level: Math.round(mine * 100) / 100 });
      const theirs = theirRef.current;
      const t = talk.current;
      const who = mine > 0.12 && theirs <= 0.12 ? "me" : theirs > 0.12 && mine <= 0.12 ? "them" : "";
      if (who) {
        if (who === "me") t.me += 1;
        else t.them += 1;
        if (t.last && t.last !== who) t.switches += 1;
        t.last = who;
      }
      const total = t.me + t.them;
      const balance = total ? 1 - Math.abs(t.me - t.them) / total : 0;
      const flow = Math.min(1, t.switches / Math.max(1, e / 12));
      const c = Math.round((balance * 6 + flow * 4) * 10) / 10;
      chemRef.current = c;
      setChem(c);
      const tw = scene.twists.find((x) => e >= x.at_seconds && e < x.at_seconds + 15);
      setTwist(tw ? tw.text : null);
      if (e >= scene.scene_seconds && !finishedRef.current) void endScene();
    }, 250);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, scene]);

  // Demo partner: plays the founders' bank-agent clips in turn, with a level meter to match.
  useEffect(() => {
    if (!isDemo() || phase !== "live") return;
    let i = 0;
    let stop = false;
    const speak = () => {
      if (stop || i >= DEMO_CLIPS.length) return;
      const a = new Audio(clipUrl(DEMO_CLIPS[i++]));
      demoClip.current = a;
      const meter = window.setInterval(() => setTheirLevel(0.3 + Math.random() * 0.4), 200);
      a.onended = () => {
        window.clearInterval(meter);
        setTheirLevel(0.02);
        window.setTimeout(speak, 5500);
      };
      void a.play().catch(() => {
        window.clearInterval(meter);
        setTheirLevel(0.02);
        window.setTimeout(speak, 5500);
      });
    };
    const first = window.setTimeout(speak, 1500);
    return () => {
      stop = true;
      window.clearTimeout(first);
      demoClip.current?.pause();
    };
  }, [phase]);

  const endScene = async () => {
    if (finishedRef.current || !scene) return;
    finishedRef.current = true;
    setPhase("uploading");
    setProgress("Stopping the recording…");
    try {
      let path = `${sessionId}/turn-${scene.me === "a" ? 1 : 2}-a1-${scene.my_speaker_id}.webm`;
      let seconds = Math.round(elapsedRef.current);
      if (!isDemo()) {
        const mic = micRef.current;
        if (!mic) throw new Error("no recording");
        const out = await mic.stopRecording();
        seconds = Math.round(out.seconds);
        path = `${sessionId}/turn-${scene.me === "a" ? 1 : 2}-a1-${scene.my_speaker_id}.${extFor(out.mime)}`;
        await uploadRecording(path, out.blob, out.mime.split(";")[0] || "audio/webm", (pct) => setProgress(`Sending your track… ${pct}%`), "sessions");
        callRef.current?.close();
        mic.close();
      } else {
        for (let pct = 10; pct <= 100; pct += 30) {
          setProgress(`Sending your track… ${pct}%`);
          await new Promise((r) => setTimeout(r, 220));
        }
      }
      await finish(sessionId, path, seconds, chemRef.current);
      setProgress(null);
      const s = await load();
      setPhase(s?.partner_track && !s.partner_track.rated ? "rate" : "done");
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "Couldn't finish the scene.");
      setPhase("done");
    }
  };

  const submitRating = async () => {
    if (Object.values(scores).some((v) => v === 0)) return setErr("Rate all four before you continue.");
    setBusy(true);
    setErr(null);
    try {
      await rate(sessionId, scores);
      setPhase("done");
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "Couldn't save the rating.");
    }
    setBusy(false);
  };

  // Waiting for the partner's track before rating: poll while done and unrated.
  useEffect(() => {
    if (phase !== "done" || !scene || scene.partner_track) return;
    const id = window.setInterval(async () => {
      const s = await load();
      if (s?.partner_track && !s.partner_track.rated) setPhase("rate");
    }, isDemo() ? 1500 : 5000);
    return () => window.clearInterval(id);
  }, [phase, scene, load]);

  const remaining = scene ? Math.max(0, scene.scene_seconds - elapsed) : 0;
  const title = phase === "lobby" ? (scene?.partner_joined ? "Both in. Starting…" : "The green room.") : phase === "countdown" ? "Ready…" : phase === "live" ? "Live." : phase === "uploading" ? "Sending your track." : phase === "rate" ? "Rate your partner." : phase === "lapsed" ? "This scene did not happen." : "Scene done.";

  const live = phase === "live";
  const sub = phase === "lobby" ? "Green room" : phase === "countdown" ? "Starting" : live ? `Live · ${fmt(remaining)} left` : phase === "uploading" ? "Sending" : phase === "rate" ? "Rating" : phase === "lapsed" ? "Closed" : "Done";

  return (
    <Page dock={false}>
      <div className="topbar">
        <button className="back" type="button" onClick={onBack} disabled={live} aria-label="Back to the booth"><IcBack /></button>
        <div>
          <div className="lab muted">{scene?.card.title ?? "Live Arena"}{scene ? ` · with ${scene.partner ?? "a stranger"}` : ""}</div>
        </div>
        <span className={`chip ${live ? "chip-coral" : "chip-cream"}`}>{live ? <><i className="dot" />{`LIVE · ${fmt(remaining)}`}</> : isDemo() ? "demo" : callState}</span>
      </div>
      <h2 className="pg">{title}</h2>
      <audio ref={remoteRef} autoPlay playsInline />

      {err && <Notice tone="coral">{err}</Notice>}

      {scene && phase !== "rate" && (
        <div className="blk blk-gold pat-rings-6 bal">
          <div className="lab">The situation</div>
          <h3 style={{ fontSize: 20, marginTop: 4, lineHeight: 1.2 }}>{scene.card.situation}</h3>
          <div className="row" style={{ alignItems: "flex-start", flexDirection: "column", gap: 6 }}>
            <span className="plate" style={{ padding: "5px 10px", fontSize: 13.5, fontWeight: 600 }}>You are {scene.card.persona}</span>
            <span className="plate" style={{ padding: "5px 10px", fontSize: 13.5, fontWeight: 600 }}>Your partner is {scene.card.partner_persona}</span>
          </div>
        </div>
      )}

      {phase === "lobby" && scene && (
        <div className="card pad" style={{ marginTop: 16 }}>
          <div className="eyebrow">{sub}</div>
          <p>{scene.partner_joined ? "Your partner is in the room." : `Waiting for ${scene.partner ?? "your partner"} to arrive. The scene starts the moment you are both here; if they are not in within ${isDemo() ? "a few seconds (demo)" : "ten minutes"}, you are credited and free to go.`}</p>
          {!isDemo() && <p className="note-p">Microphone {micRef.current ? "ready" : "opening…"} · call {callState}. Keep this screen open.</p>}
        </div>
      )}

      {phase === "countdown" && <div className="prompt" role="status" aria-label="Starting in three"><span aria-hidden="true">3 · 2 · 1</span></div>}

      {live && scene && (
        <>
          {twist && (
            <div className="blk blk-coral pat-zig-6 livecard">
              <div className="lab">Twist</div>
              <h3 style={{ marginTop: 4 }}>{twist}</h3>
            </div>
          )}
          <div className="slots" style={{ marginTop: 16 }}>
            <div className="card pad">
              <div className="eyebrow">You</div>
              <div className="rail" style={{ marginTop: 8 }} aria-hidden="true"><i style={{ width: `${Math.round(myLevel * 100)}%` }} /></div>
            </div>
            <div className="card pad">
              <div className="eyebrow">{scene.partner ?? "Partner"}</div>
              <div className="rail" style={{ marginTop: 8 }} aria-hidden="true"><i style={{ width: `${Math.round(theirLevel * 100)}%` }} /></div>
            </div>
          </div>
          <div className="blk blk-mint pat-dia-6 tier">
            <div className="lab">Chemistry</div>
            <h3>{chem.toFixed(1)}</h3>
            <div className="prog" aria-hidden="true"><i style={{ width: `${Math.max(2, chem * 10)}%` }} /></div>
            <p>Fills when you both speak, take turns and keep it flowing. It is a live quality signal, not your pay.</p>
          </div>
          {isDemo() && <button className="btn btn-outline btn-block" type="button" style={{ marginTop: 12 }} onMouseDown={() => setDemoSpeaking(true)} onMouseUp={() => setDemoSpeaking(false)} onTouchStart={() => setDemoSpeaking(true)} onTouchEnd={() => setDemoSpeaking(false)}>Hold to act out speaking (demo)</button>}
          <button className="btn btn-mint btn-block" type="button" style={{ marginTop: 12 }} onClick={() => void endScene()}>End the scene</button>
        </>
      )}

      {phase === "uploading" && <div className="card pad" style={{ marginTop: 16 }}><p>{progress ?? "Working…"}</p></div>}

      {phase === "rate" && scene && (
        <div className="card pad rform" style={{ marginLeft: 0, width: "100%" }}>
          <h3>Rate {scene.partner ?? "your partner"}</h3>
          {AXES.map(([key, label, hint]) => (
            <div className={`rrow${scores[key] ? " set" : ""}`} key={key}>
              <div className="rrow-h"><span className="rlab">{label}</span></div>
              <div className="rhint">{hint}</div>
              <div className="srow" role="radiogroup" aria-label={label}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={scores[key] === n} aria-label={`${n} of 5`} className={`sbtn${scores[key] >= n ? " on" : ""}`} onClick={() => setScores((s) => ({ ...s, [key]: n }))}>
                    <IcStar />
                  </button>
                ))}
              </div>
            </div>
          ))}
          <p className="rnote">Rate what you heard. A linguist checks ratings against the audio.</p>
          <button className="btn btn-mint btn-block" type="button" disabled={busy} onClick={() => void submitRating()}>{busy ? "Saving…" : "Save rating"}</button>
        </div>
      )}

      {phase === "done" && (
        <div className="donecard in-rise" style={{ marginTop: 16 }}>
          <div className="eyebrow">Scene done</div>
          <h2>Your track is in.</h2>
          <p>{scene?.partner_track ? "Your partner's is in too." : "Your partner's follows."} A linguist verifies both; your verified minutes show in Money after that, at the base rate times your tier.</p>
          <button className="btn btn-mint btn-block" type="button" onClick={onBack}>Back to the booth</button>
        </div>
      )}

      {phase === "lapsed" && (
        <>
          <Notice>{err ?? "This scene was closed."} If your partner did not show, the showed-up credit is in your earnings and no strike is on you.</Notice>
          <button className="btn btn-outline btn-block" type="button" style={{ marginTop: 12 }} onClick={onBack}>Back to the booth</button>
        </>
      )}
    </Page>
  );
}
