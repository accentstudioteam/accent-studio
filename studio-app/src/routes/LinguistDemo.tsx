import { useState } from "react";
import { Logo } from "@/components/Logo";
import { Verify } from "@/routes/Verify";
import { Workbench } from "@/routes/Workbench";
import { Integrity } from "@/routes/Integrity";
import { CaseNotice } from "@/routes/CaseNotice";
import { demoVerify } from "@/lib/demoVerify";

type Tab = "queue" | "cases" | "contributor";

/** The Cutting Room demo: the queue and workbench, the clause 15 cases, and the contributor's side of a case. Nothing is saved. */
export function LinguistDemo() {
  const [tab, setTab] = useState<Tab>("queue");
  const [sid, setSid] = useState<string | null>(null);
  const [epoch, setEpoch] = useState(0);

  const reset = () => {
    demoVerify.reset();
    setSid(null);
    setTab("queue");
    setEpoch((n) => n + 1);
  };

  return (
    <div className="app" key={epoch}>
      <div className="topbar">
        <Logo height={22} />
        <span className="chip" style={{ fontFamily: "var(--mono)", fontSize: "0.7rem" }}>Cutting Room · demo</span>
      </div>
      <div className="shell" style={{ maxWidth: 720, paddingBottom: 0 }}>
        <div className="tile" style={{ borderColor: "var(--gold)", marginBottom: 12 }}>
          <div className="tlbl" style={{ color: "var(--gold)" }}>Demo · nothing is saved</div>
          <div className="tbody muted" style={{ fontSize: "0.85rem" }}>
            You are a linguist. Two finished rallies wait in the queue, built from the founders' own clips. Claim one and a machine draft arrives for every take a few seconds later (an English-trained model on Pidgin, so it needs correcting; the founders' notes show what a careful linguist writes). Turn 4 of Market Day is a clean take that its partner rated 2.25: mark the rating "too low", flag the rater, then follow the case through review, notice, the contributor's response and a decision signed by a second team member.{" "}
            <button type="button" onClick={reset} style={{ background: "none", border: "none", color: "var(--acc)", padding: 0, font: "inherit", cursor: "pointer" }}>Reset the demo</button>
          </div>
        </div>
        <div className="chips" style={{ marginBottom: 6 }}>
          {([["queue", "Queue"], ["cases", "Cases"], ["contributor", "The contributor's view"]] as [Tab, string][]).map(([k, label]) => (
            <button key={k} type="button" className={`chip${tab === k ? " on" : ""}`} onClick={() => { setTab(k); if (k !== "queue") setSid(null); }}>{label}</button>
          ))}
        </div>
      </div>
      {tab === "queue" && (sid ? <Workbench sessionId={sid} onBack={() => setSid(null)} onCases={() => setTab("cases")} embedded /> : <Verify onBack={() => undefined} onOpen={setSid} onCases={() => setTab("cases")} embedded />)}
      {tab === "cases" && <Integrity onBack={() => setTab("queue")} embedded />}
      {tab === "contributor" && (
        <>
          <div className="shell" style={{ maxWidth: 720, paddingTop: 0, paddingBottom: 0 }}>
            <div className="tbody muted small" style={{ marginBottom: 8 }}>Signed in as the contributor who rated turn 4 (spk_pcm_ng_48213). The notice appears here once it is sent from Cases.</div>
          </div>
          <CaseNotice onBack={() => setTab("queue")} embedded />
        </>
      )}
    </div>
  );
}
