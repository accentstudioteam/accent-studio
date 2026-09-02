import { useState } from "react";
import type { Nav } from "@/prototype/types";
import { ScreenHead } from "@/prototype/ui";
import { MOCK_USER, MOCK_PROMPT, MOCK_PARTNER_TAKE, MOCK_QUEUE } from "@/prototype/mock";

const BARS = [55, 32, 78, 44, 68, 88, 52, 72, 38, 58, 48, 34, 64, 40, 60, 30, 70, 46];

export function Home({ nav }: { nav: Nav }) {
  return (
    <>
      <div className="spread" style={{ marginBottom: 18, alignItems: "flex-start" }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Playing in {MOCK_USER.localeName}</div>
          <h1 className="h1">Hey, {MOCK_USER.handle}.</h1>
        </div>
        <button className="chip" style={{ flex: "none" }} onClick={() => nav.go("wallet")}>
          {MOCK_USER.apBalance.toLocaleString()} AP
        </button>
      </div>

      <div className="row" style={{ marginBottom: 16 }}>
        <span className="ricon">🏅</span>
        <div className="rmain">
          <div className="rt">{MOCK_USER.rank} · {MOCK_USER.tier} tier</div>
          <div className="rs">Quality multiplier {MOCK_USER.multiplier} · 🔥 {MOCK_USER.streak}-day streak</div>
        </div>
        <button className="badge ok" onClick={() => nav.go("progression")} style={{ cursor: "pointer" }}>rank up</button>
      </div>

      <div className="tile" style={{ marginBottom: 20 }}>
        <div className="spread" style={{ marginBottom: 8 }}>
          <span className="tlbl" style={{ margin: 0 }}>Today's goal · 3 of 5 takes</span>
          <span className="mono" style={{ fontSize: "0.7rem", color: "var(--acc2)" }}>+60 AP</span>
        </div>
        <div className="progress"><div className="fill" style={{ width: "60%" }} /></div>
      </div>

      <div className="stack" style={{ marginBottom: 18 }}>
        <div className="sheet">
          <div className="handle" />
          <div className="shead"><i className="g" />Ping · ready</div>
          <div className="tile acc">
            <div className="tlbl">Next up</div>
            <div className="ttitle">{MOCK_PROMPT.scenario}</div>
            <div className="tbody muted" style={{ marginTop: 6 }}>Say the English prompt in your language. A partner rates it.</div>
          </div>
          <button className="pill" onClick={() => nav.go("volley-record")}>Start a rally</button>
        </div>

        <div className="sheet">
          <div className="handle" />
          <div className="shead"><i />Live · arena</div>
          <div className="tile">
            <div className="tlbl">3-player roleplay</div>
            <div className="ttitle">Improv a scene with a stranger.</div>
          </div>
          <button className="pill mint" onClick={() => nav.go("arena-lobby")}>Enter the arena</button>
        </div>
      </div>

      <div className="rows" style={{ marginBottom: 8 }}>
        <button className="row tap" onClick={() => nav.go("cutting-room-queue")}>
          <span className="ricon">✎</span>
          <div className="rmain"><div className="rt">The Cutting Room</div><div className="rs">{MOCK_QUEUE.length} takes to verify · +35 AP each</div></div>
          <span className="rend">›</span>
        </button>
        <button className="row tap" onClick={() => nav.go("wallet")}>
          <span className="ricon">💰</span>
          <div className="rmain"><div className="rt">Wallet</div><div className="rs">{MOCK_USER.verifiedMinutes} verified min · ready to cash out</div></div>
          <span className="rend">›</span>
        </button>
        <button className="row tap" onClick={() => nav.go("profile")}>
          <span className="ricon">👤</span>
          <div className="rmain"><div className="rt">Profile & trust</div><div className="rs">Trust {Math.round(MOCK_USER.trustScore * 100)}% · {MOCK_USER.rank}</div></div>
          <span className="rend">›</span>
        </button>
      </div>
    </>
  );
}

export function VolleyRecord({ nav }: { nav: Nav }) {
  const [state, setState] = useState<"idle" | "rec" | "done">("idle");
  return (
    <>
      <div className="eyebrow" style={{ marginBottom: 8 }}>Volley · turn 3 · {MOCK_PROMPT.role}</div>
      <h1 className="h1" style={{ marginBottom: 18, fontSize: "clamp(1.5rem,6vw,2.1rem)" }}>Say it in your language.</h1>

      <div className="sheet" style={{ marginBottom: 20 }}>
        <div className="handle" />
        <div className="shead"><i className="g" />English prompt</div>
        <div className="tile acc">
          <div className="tlbl">{MOCK_PROMPT.scenario} · say naturally</div>
          <div className="ttitle" style={{ fontWeight: 600, lineHeight: 1.4 }}>"{MOCK_PROMPT.english}"</div>
        </div>
        <div className="tile" style={{ paddingTop: 18, paddingBottom: 18 }}>
          <div className="recwrap">
            <button className={"recbtn" + (state === "rec" ? " rec" : "")} onClick={() => setState(state === "rec" ? "done" : "rec")}>
              <span className="core" />
            </button>
            <div className="rectime">{state === "idle" ? "Tap to record" : state === "rec" ? "00:05 · recording…" : "00:07 · captured"}</div>
          </div>
          {state === "done" && (
            <div className="wv" style={{ marginTop: 14 }}>
              {BARS.map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}
            </div>
          )}
        </div>
      </div>

      <div className="actionbar btn-row">
        {state === "done" && <button className="pill ghost" onClick={() => setState("idle")}>Re-record</button>}
        <button className="pill" disabled={state !== "done"} onClick={() => nav.go("volley-submitted")}>Submit take</button>
      </div>
    </>
  );
}

export function VolleySubmitted({ nav }: { nav: Nav }) {
  return (
    <div className="full-center" style={{ minHeight: "68vh" }}>
      <div className="center" style={{ maxWidth: 360 }}>
        <div className="hero-emoji">🎧</div>
        <h1 className="h1" style={{ marginBottom: 12 }}>Take sent.</h1>
        <p className="muted" style={{ marginBottom: 20, fontSize: "0.95rem" }}>
          A partner will rate it on tone, prompt, mood and clarity. While you wait,
          rate someone else's take and earn AP.
        </p>
        <button className="pill mint" onClick={() => nav.go("volley-rate")}>Rate a take</button>
        <button className="pill ghost" style={{ marginTop: 10 }} onClick={() => nav.go("home")}>Back to home</button>
      </div>
    </div>
  );
}

export function VolleyRate({ nav }: { nav: Nav }) {
  const AXES = ["Tone", "Prompt", "Mood", "Clarity"] as const;
  const [scores, setScores] = useState<Record<string, number>>({});
  const [playing, setPlaying] = useState(false);
  const rated = AXES.every((a) => scores[a]);
  const avg = rated ? AXES.reduce((s, a) => s + scores[a], 0) / AXES.length : 0;

  return (
    <>
      <div className="eyebrow" style={{ marginBottom: 8 }}>Volley · rate the take</div>
      <h1 className="h1" style={{ marginBottom: 18, fontSize: "clamp(1.5rem,6vw,2.1rem)" }}>How was @{MOCK_PARTNER_TAKE.handle}'s take?</h1>

      <div className="sheet" style={{ marginBottom: 18 }}>
        <div className="handle" />
        <div className="shead"><i />@{MOCK_PARTNER_TAKE.handle} · {MOCK_PARTNER_TAKE.duration}</div>
        <div className="tile">
          <button className="wv" style={{ width: "100%", background: "none", border: "none", cursor: "pointer" }} onClick={() => setPlaying(!playing)}>
            {BARS.map((h, i) => <i key={i} className={playing && i > 9 ? "mu" : undefined} style={{ height: `${h}%` }} />)}
          </button>
        </div>
        <div className="tile dash">
          <div className="tlbl">What they said</div>
          <div className="tbody">"{MOCK_PARTNER_TAKE.transcript}"</div>
        </div>
      </div>

      <div className="stack" style={{ marginBottom: 18 }}>
        {AXES.map((axis) => (
          <div className="spread" key={axis}>
            <span className="slabel" style={{ margin: 0 }}>{axis}</span>
            <div className="stars">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} className={scores[axis] >= n ? "on" : ""} onClick={() => setScores({ ...scores, [axis]: n })}>★</button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {rated && avg < 4 && (
        <div className="tile dash" style={{ marginBottom: 16 }}>
          <div className="tlbl" style={{ color: "var(--coral)" }}>Below 4 · sent back</div>
          <div className="tbody muted">Average {avg.toFixed(1)}. The take goes back to them for a redo before it ships.</div>
        </div>
      )}

      <div className="actionbar">
        <button className="pill mint" disabled={!rated} onClick={() => nav.go("home")}>
          {rated ? `Submit rating (${avg.toFixed(1)})` : "Rate all four"}
        </button>
      </div>
    </>
  );
}

export function ArenaLobby({ nav }: { nav: Nav }) {
  const [searching, setSearching] = useState(false);
  return (
    <>
      <div className="hero-emoji">🎭</div>
      <ScreenHead eyebrow="Arena · blind duet" title="Find a scene partner." lede="You'll be paired with a stranger. No names, no photos. Nobody can rig a scene." />
      <div className="sheet" style={{ marginBottom: 20 }}>
        <div className="handle" />
        <div className="shead"><i />Matchmaking</div>
        <div className="tile" style={{ textAlign: "center", paddingTop: 24, paddingBottom: 24 }}>
          {searching ? (
            <>
              <div className="spin" style={{ margin: "0 auto 14px" }} />
              <div className="tbody muted">Finding a native {MOCK_USER.localeName} speaker…</div>
            </>
          ) : (
            <div className="tbody muted">Tap below to enter the queue. Scenes run about 5 minutes.</div>
          )}
        </div>
      </div>
      <div className="actionbar">
        {!searching ? (
          <button className="pill mint" onClick={() => setSearching(true)}>Enter the queue</button>
        ) : (
          <button className="pill mint" onClick={() => nav.go("arena-scene")}>Partner found · start</button>
        )}
      </div>
    </>
  );
}

export function ArenaScene({ nav }: { nav: Nav }) {
  const [twist, setTwist] = useState(false);
  return (
    <>
      <div className="spread" style={{ marginBottom: 14 }}>
        <span className="badge ok">● live · 02:14</span>
        <span className="chip" style={{ background: "var(--accdim)" }}>Chemistry 8.7</span>
      </div>

      <div className="sheet" style={{ marginBottom: 16 }}>
        <div className="handle" />
        <div className="shead"><i />Your persona</div>
        <div className="tile acc">
          <div className="tlbl">Play this character</div>
          <div className="ttitle">The Impatient Exec</div>
          <div className="tbody muted" style={{ marginTop: 4 }}>customer · fast · clipped</div>
        </div>
        <div className="tile">
          <div className="tlbl">Chemistry</div>
          <div className="progress" style={{ marginTop: 6 }}><div className="fill" style={{ width: "87%" }} /></div>
        </div>
        {twist && (
          <div className="tile dash" style={{ borderColor: "var(--gold)" }}>
            <div className="tlbl" style={{ color: "var(--goldb)" }}>⚡ Twist</div>
            <div className="tbody">Your partner reveals they know your manager. React.</div>
          </div>
        )}
        <div className="tile">
          <div className="tlbl">Live transcript</div>
          <div className="tbody"><b>You:</b> Abeg, I need this sorted now-now.</div>
          <div className="tbody muted" style={{ marginTop: 4 }}><b>Partner:</b> I hear you. Make I check am sharp-sharp.</div>
        </div>
      </div>

      <div className="actionbar btn-row">
        {!twist ? (
          <button className="pill ghost" onClick={() => setTwist(true)}>Trigger twist</button>
        ) : (
          <button className="pill ghost" onClick={() => setTwist(false)}>Clear twist</button>
        )}
        <button className="pill mint" onClick={() => nav.go("arena-result")}>End scene</button>
      </div>
    </>
  );
}

export function ArenaResult({ nav }: { nav: Nav }) {
  return (
    <div className="full-center" style={{ minHeight: "70vh" }}>
      <div className="center" style={{ maxWidth: 360 }}>
        <div className="hero-emoji">👏</div>
        <div className="badge ok" style={{ marginBottom: 14 }}>● Standing ovation</div>
        <h1 className="h1" style={{ marginBottom: 6 }}>Chemistry 8.7</h1>
        <p className="muted" style={{ marginBottom: 20, fontSize: "0.95rem" }}>A flowing scene. That's premium dual-channel audio, and a bonus for both of you.</p>
        <div className="row" style={{ marginBottom: 10 }}>
          <span className="ricon">✨</span>
          <div className="rmain"><div className="rt">Scene reward</div><div className="rs">Base + chemistry bonus</div></div>
          <span className="rend" style={{ color: "var(--acc2)" }}>+150 AP</span>
        </div>
        <button className="pill mint" onClick={() => nav.go("home")}>Back to home</button>
      </div>
    </div>
  );
}

export function CuttingRoomQueue({ nav }: { nav: Nav }) {
  return (
    <>
      <ScreenHead eyebrow="The Cutting Room" title="Verify the takes." lede="Listen, fix the transcript, approve. Every correction earns AP and ships cleaner data." />
      <div className="rows" style={{ marginBottom: 8 }}>
        {MOCK_QUEUE.map((q, i) => (
          <button className="row tap" key={i} onClick={() => nav.go("cutting-room-verify")}>
            <span className="ricon">{q.icon}</span>
            <div className="rmain"><div className="rt">{q.t}</div><div className="rs">{q.s}</div></div>
            <span className="rend" style={{ color: "var(--acc2)" }}>{q.end}</span>
          </button>
        ))}
      </div>
    </>
  );
}

export function CuttingRoomVerify({ nav }: { nav: Nav }) {
  const [text, setText] = useState("Oga, I see three unauthorized transactions. I go block am now.");
  const [playing, setPlaying] = useState(false);
  return (
    <>
      <div className="eyebrow" style={{ marginBottom: 8 }}>Cutting Room · Banking Wahala · T4</div>
      <h1 className="h1" style={{ marginBottom: 18, fontSize: "clamp(1.5rem,6vw,2.1rem)" }}>Fix the transcript.</h1>

      <div className="sheet" style={{ marginBottom: 16 }}>
        <div className="handle" />
        <div className="shead"><i />Track · 00:06</div>
        <div className="tile">
          <button className="wv" style={{ width: "100%", background: "none", border: "none", cursor: "pointer" }} onClick={() => setPlaying(!playing)}>
            {BARS.map((h, i) => <i key={i} className={playing && i > 11 ? "mu" : undefined} style={{ height: `${h}%` }} />)}
          </button>
        </div>
        <div className="tile dash">
          <div className="tlbl">Raw machine transcript</div>
          <div className="tbody muted" style={{ textDecoration: "line-through" }}>oga i see three unauthorized transaction i go block am now</div>
        </div>
      </div>

      <div className="field">
        <label>Your verified transcript</label>
        <input value={text} onChange={(e) => setText(e.target.value)} />
      </div>

      <div className="tile" style={{ marginBottom: 18 }}>
        <div className="spread"><span className="tlbl" style={{ margin: 0 }}>Step 1 of 2 · transcript</span><span className="mono" style={{ color: "var(--acc2)" }}>+35 AP</span></div>
      </div>

      <div className="actionbar">
        <button className="pill" onClick={() => nav.go("cutting-room-align")}>Next · match the words →</button>
        <div className="mono center" style={{ fontSize: "0.62rem", color: "var(--faint)", marginTop: 10 }}>
          Next you'll link each English phrase to your language.
        </div>
      </div>
    </>
  );
}

const SRC_TOKENS = ["Good morning.", "I woke up", "and saw that", "₦50,000", "left", "my account"];
const TGT_TOKENS = ["Good morning.", "I wake up", "see say", "POS commot 50k", "for", "my account!"];

interface Link {
  color: number; // palette index 0-5, or -1 for null particle
  src: number[];
  tgt: number[];
}

export function CuttingRoomAlign({ nav }: { nav: Nav }) {
  const [tgt, setTgt] = useState<string[]>(TGT_TOKENS);
  const [links, setLinks] = useState<Link[]>([]);
  const [pendSrc, setPendSrc] = useState<number[]>([]);
  const [pendTgt, setPendTgt] = useState<number[]>([]);
  const [mode, setMode] = useState<"match" | "edit">("match");
  const [editing, setEditing] = useState<number | null>(null);

  const linkOfSrc = (i: number) => links.find((l) => l.src.includes(i));
  const linkOfTgt = (i: number) => links.find((l) => l.tgt.includes(i));

  function srcClass(i: number): string {
    const l = linkOfSrc(i);
    if (l) return `atok p${l.color + 1}`;
    if (pendSrc.includes(i)) return "atok pending";
    return "atok";
  }
  function tgtClass(i: number): string {
    const l = linkOfTgt(i);
    if (l) return l.color === -1 ? "atok nu" : `atok p${l.color + 1}`;
    if (pendTgt.includes(i)) return "atok pending";
    return "atok";
  }

  function tapSrc(i: number) {
    if (mode !== "match" || linkOfSrc(i)) return;
    setPendSrc((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));
  }
  function tapTgt(i: number) {
    if (mode === "edit") {
      setEditing(i);
      return;
    }
    if (linkOfTgt(i)) return;
    setPendTgt((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));
  }

  function link() {
    if (!pendSrc.length || !pendTgt.length) return;
    setLinks((ls) => [...ls, { color: ls.filter((l) => l.color >= 0).length % 6, src: pendSrc, tgt: pendTgt }]);
    setPendSrc([]);
    setPendTgt([]);
  }
  function markParticle() {
    if (pendSrc.length || !pendTgt.length) return;
    setLinks((ls) => [...ls, { color: -1, src: [], tgt: pendTgt }]);
    setPendTgt([]);
  }
  function undo() {
    setLinks((ls) => ls.slice(0, -1));
  }
  function clearPend() {
    setPendSrc([]);
    setPendTgt([]);
  }

  const allTgtLinked = tgt.every((_, i) => !!linkOfTgt(i));
  const canLink = pendSrc.length > 0 && pendTgt.length > 0;
  const canParticle = pendSrc.length === 0 && pendTgt.length > 0;

  return (
    <>
      <div className="spread" style={{ marginBottom: 8 }}>
        <div className="eyebrow" style={{ margin: 0 }}>Cutting Room · step 2 · align</div>
        <div className="amode">
          <button className={mode === "match" ? "on" : ""} onClick={() => { setMode("match"); setEditing(null); }}>Match</button>
          <button className={mode === "edit" ? "on" : ""} onClick={() => { setMode("edit"); clearPend(); }}>Edit</button>
        </div>
      </div>
      <h1 className="h1" style={{ marginBottom: 8, fontSize: "clamp(1.5rem,6vw,2.1rem)" }}>Match the words.</h1>
      <p className="muted" style={{ fontSize: "0.9rem", marginBottom: 20 }}>
        {mode === "match"
          ? "Tap an English phrase, then tap the word(s) in your language that carry it. Languages don't line up 1-to-1, that's the point."
          : "Tap any word in your take to fix its spelling."}
      </p>

      <span className="slabel">English source</span>
      <div className="amatch" style={{ marginBottom: 18 }}>
        {SRC_TOKENS.map((t, i) => (
          <button key={i} className={srcClass(i)} onClick={() => tapSrc(i)} disabled={mode === "edit"}>
            {t}
          </button>
        ))}
      </div>

      <span className="slabel">Your take · {tgt.length} words</span>
      <div className="amatch" style={{ marginBottom: 18 }}>
        {tgt.map((t, i) =>
          editing === i ? (
            <span key={i} className="atok pending">
              <input
                autoFocus
                value={t}
                onChange={(e) => setTgt((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
                onBlur={() => setEditing(null)}
                onKeyDown={(e) => e.key === "Enter" && setEditing(null)}
                size={Math.max(t.length, 3)}
              />
            </span>
          ) : (
            <button key={i} className={tgtClass(i)} onClick={() => tapTgt(i)}>
              {t}
            </button>
          )
        )}
      </div>

      {mode === "match" && (pendSrc.length > 0 || pendTgt.length > 0) && (
        <div className="tile" style={{ marginBottom: 14 }}>
          <div className="spread">
            <span className="tbody muted" style={{ fontSize: "0.82rem" }}>
              {canLink ? "Ready to link this pair." : canParticle ? "Target-only. Mark as a particle with no English source?" : "Now pick the matching word(s)."}
            </span>
          </div>
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button className="pill ghost" style={{ padding: 10, fontSize: "0.66rem" }} onClick={clearPend}>Clear</button>
            {canParticle && <button className="pill ghost" style={{ padding: 10, fontSize: "0.66rem" }} onClick={markParticle}>No source ·</button>}
            {canLink && <button className="pill mint" style={{ padding: 10, fontSize: "0.66rem" }} onClick={link}>Link ✓</button>}
          </div>
        </div>
      )}

      <div className="spread" style={{ marginBottom: 18 }}>
        <span className="mono" style={{ fontSize: "0.68rem", color: allTgtLinked ? "var(--acc2)" : "var(--mut)" }}>
          {links.length} pairs · {allTgtLinked ? "all words aligned" : "keep matching"}
        </span>
        {links.length > 0 && (
          <button className="mono" style={{ fontSize: "0.68rem", color: "var(--coral)" }} onClick={undo}>undo last</button>
        )}
      </div>

      <div className="actionbar">
        <div className="binary" style={{ marginBottom: 12 }}>
          <button className="no" onClick={() => nav.go("cutting-room-queue")} aria-label="Reject">✕</button>
          <button className="yes" disabled={!allTgtLinked} style={!allTgtLinked ? { opacity: 0.4 } : undefined} onClick={() => nav.go("cutting-room-queue")} aria-label="Approve">✓</button>
        </div>
        <div className="mono center" style={{ fontSize: "0.62rem", color: "var(--faint)" }}>
          {allTgtLinked ? "Approve to lock the aligned take · +35 AP" : "Align every word to approve"}
        </div>
      </div>
    </>
  );
}
