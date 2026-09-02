import { useState } from "react";
import type { Nav } from "@/prototype/types";
import { ScreenHead, Stepper } from "@/prototype/ui";
import { INTERVIEW_TASKS } from "@/prototype/mock";

export function InterviewInvite({ nav }: { nav: Nav }) {
  return (
    <>
      <div className="hero-emoji">🎬</div>
      <ScreenHead
        eyebrow="Interview · you're invited"
        title="Nice voice. Let's do a short interview."
        lede="Your sample passed screening. The interview is three quick voice tasks you record on your own time, about 5 minutes total. No live call."
      />

      <div className="rows" style={{ marginBottom: 22 }}>
        {INTERVIEW_TASKS.map((t, i) => (
          <div className="row" key={i}>
            <span className="ricon">{["📖", "🎭", "💢"][i]}</span>
            <div className="rmain">
              <div className="rt">{t.kind}</div>
              <div className="rs">{t.prompt}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="actionbar">
        <button className="pill mint" onClick={() => nav.next()}>
          Start the interview
        </button>
      </div>
    </>
  );
}

export function InterviewBrief({ nav }: { nav: Nav }) {
  return (
    <>
      <ScreenHead
        eyebrow="Before you start"
        title="Three things for a clean take."
      />
      <ul className="rlist" style={{ marginBottom: 22 }}>
        <li><span className="rico">🤫</span> Find a quiet room. No fan, no TV, no music.</li>
        <li><span className="rico">📱</span> Hold your phone a hand's width from your mouth.</li>
        <li><span className="rico">😄</span> Be natural. We want the real you, not a news anchor.</li>
      </ul>
      <div className="tile dash" style={{ marginBottom: 22 }}>
        <div className="tlbl">Good to know</div>
        <div className="tbody muted">
          You can re-record any task before you submit. We only review your final take.
        </div>
      </div>
      <div className="actionbar">
        <button className="pill mint" onClick={() => nav.next()}>I'm ready</button>
      </div>
    </>
  );
}

export function InterviewTasks({ nav }: { nav: Nav }) {
  const [step, setStep] = useState(0);
  const [recorded, setRecorded] = useState<boolean[]>([false, false, false]);
  const [state, setState] = useState<"idle" | "rec" | "done">("idle");
  const task = INTERVIEW_TASKS[step];
  const isLast = step === INTERVIEW_TASKS.length - 1;

  function finishTask() {
    const upd = [...recorded];
    upd[step] = true;
    setRecorded(upd);
    if (isLast) {
      nav.next();
    } else {
      setStep(step + 1);
      setState("idle");
    }
  }

  return (
    <>
      <Stepper total={INTERVIEW_TASKS.length} current={step} />
      <div className="eyebrow" style={{ marginBottom: 8 }}>
        Task {step + 1} of {INTERVIEW_TASKS.length} · {task.kind}
      </div>
      <h1 className="h1" style={{ marginBottom: 20, fontSize: "clamp(1.5rem,6vw,2.1rem)" }}>
        {task.prompt}
      </h1>

      <div className="sheet" style={{ marginBottom: 22 }}>
        <div className="handle" />
        <div className="shead"><i />{task.kind}</div>
        <div className="tile acc">
          <div className="tlbl">Prompt</div>
          <div className="ttitle" style={{ fontWeight: 600, fontSize: "0.95rem", lineHeight: 1.4 }}>
            {task.text}
          </div>
        </div>
        <div className="tile" style={{ paddingTop: 18, paddingBottom: 18 }}>
          <div className="recwrap">
            <button
              className={"recbtn" + (state === "rec" ? " rec" : "")}
              onClick={() => setState(state === "rec" ? "done" : "rec")}
            >
              <span className="core" />
            </button>
            <div className="rectime">
              {state === "idle" ? "Tap to record" : state === "rec" ? "00:11 · recording…" : "00:18 · captured"}
            </div>
          </div>
        </div>
      </div>

      <div className="actionbar btn-row">
        {state === "done" && (
          <button className="pill ghost" onClick={() => setState("idle")}>Re-record</button>
        )}
        <button className="pill mint" disabled={state !== "done"} onClick={finishTask}>
          {isLast ? "Finish & submit" : "Next task"}
        </button>
      </div>
    </>
  );
}

export function InterviewSubmitted({ nav }: { nav: Nav }) {
  return (
    <div className="full-center" style={{ minHeight: "70vh" }}>
      <div className="center" style={{ maxWidth: 360 }}>
        <div className="hero-emoji">✅</div>
        <h1 className="h1" style={{ marginBottom: 12 }}>Interview submitted.</h1>
        <p className="muted" style={{ marginBottom: 16, fontSize: "0.95rem" }}>
          A native-speaker reviewer will listen to your takes. You'll hear back
          within a couple of days.
        </p>
        <div className="badge pending" style={{ marginBottom: 24 }}>● In review</div>
        <div className="btn-row">
          <button className="pill ghost" onClick={() => nav.go("decision-waitlisted")}>
            Waitlisted view
          </button>
          <button className="pill mint" onClick={() => nav.go("decision-accepted")}>
            Accepted view
          </button>
        </div>
      </div>
    </div>
  );
}

export function DecisionAccepted({ nav }: { nav: Nav }) {
  return (
    <div className="full-center" style={{ minHeight: "70vh" }}>
      <div className="center" style={{ maxWidth: 360 }}>
        <div className="hero-emoji">🎉</div>
        <div className="badge ok" style={{ marginBottom: 14 }}>● You're in</div>
        <h1 className="h1" style={{ marginBottom: 12 }}>Welcome to the cast.</h1>
        <p className="muted" style={{ marginBottom: 24, fontSize: "0.95rem" }}>
          You passed the interview. Next we set up your booth: confirm your
          identity, sign a few agreements, and pick how you get paid. Takes about
          five minutes, once.
        </p>
        <button className="pill mint" onClick={() => nav.go("onb-welcome")}>
          Set up my booth
        </button>
      </div>
    </div>
  );
}

export function DecisionWaitlisted({ nav }: { nav: Nav }) {
  return (
    <div className="full-center" style={{ minHeight: "70vh" }}>
      <div className="center" style={{ maxWidth: 360 }}>
        <div className="hero-emoji">⏳</div>
        <div className="badge pending" style={{ marginBottom: 14 }}>● Waitlisted</div>
        <h1 className="h1" style={{ marginBottom: 12 }}>You're on the list.</h1>
        <p className="muted" style={{ marginBottom: 24, fontSize: "0.95rem" }}>
          Your language is at capacity right now. We open new spots every week
          and invite from the waitlist in order. We'll email you the moment a
          seat opens.
        </p>
        <button className="pill ghost" onClick={() => nav.openIndex()}>
          Back to all screens
        </button>
      </div>
    </div>
  );
}
