import { useState } from "react";
import { Logo } from "@/components/Logo";
import { StudioNav } from "@/components/StudioNav";
import { Verify } from "@/routes/Verify";
import { Workbench } from "@/routes/Workbench";
import { Audit } from "@/routes/Audit";
import { Integrity } from "@/routes/Integrity";
import { CaseNotice } from "@/routes/CaseNotice";
import { Payouts } from "@/routes/Payouts";
import { Projects } from "@/routes/Projects";
import { Contributors } from "@/routes/Contributors";
import { Team } from "@/routes/Team";
import { Home } from "@/routes/Home";
import { demoVerify } from "@/lib/demoVerify";
import { demoAdmin } from "@/lib/demoAdmin";
import { overview, type Overview } from "@/lib/admin";

type Tab = "home" | "queue" | "audit" | "cases" | "payouts" | "projects" | "contributors" | "team" | "contributor";

const NOTE: Record<Tab, string> = {
  home: "Founder view. The dashboard: the numbers, what is waiting on someone, and the mail. Linguists see a simpler home with the Cutting Room doors.",
  queue: "",
  audit: "Okada Price was verified by Ada three days ago and drawn for the random audit. Listen from the bench, then uphold it or adjust the score; the unpaid lines are re-priced.",
  cases: "",
  payouts: "Only an admin (a founder) sees this screen and can mark a payout as sent. Linguists verify rallies; they never touch money.",
  projects: "Founder view. Plan a delivery, build it and preview the manifest a lab receives. Verify Market Day first and it joins the bundle.",
  contributors: "Founder view. Every signed contributor with their numbers; open one to pause or close the account with a reason they see, check identity photos, answer data requests.",
  team: "Founder view. Invite a linguist or an admin by email; roles switch on and off here and every change is logged.",
  contributor: "Signed in as the contributor who rated turn 4 (spk_pcm_ng_48213). The notice appears here once it is sent from Cases.",
};

/** The Cutting Room demo in the studio shell: the queue and bench, the audit queue, clause 15 cases, the founder's screens, and the contributor's side of a case. Nothing is saved. */
export function LinguistDemo() {
  const [tab, setTab] = useState<Tab>("queue");
  const [sid, setSid] = useState<string | null>(null);
  const [epoch, setEpoch] = useState(0);
  const [ov, setOv] = useState<Overview | null>(null);
  const loadOv = () => {
    overview().then(setOv).catch(() => setOv(null));
  };

  const reset = () => {
    demoVerify.reset();
    demoAdmin.reset();
    setSid(null);
    setTab("queue");
    setOv(null);
    setEpoch((n) => n + 1);
  };
  const go = (k: string) => {
    setTab(k as Tab);
    if (k !== "queue") setSid(null);
    if (k === "home") loadOv();
  };
  const items = [
    { key: "home", label: "Home (founder only)", group: "" },
    { key: "queue", label: "Queue", group: "Cutting Room", count: 2 },
    { key: "audit", label: "Audit", group: "Cutting Room", count: 1 },
    { key: "cases", label: "Cases", group: "Cutting Room" },
    { key: "contributors", label: "Contributors (founder only)", group: "Founder", count: 2, accent: "gold" as const },
    { key: "team", label: "Team (founder only)", group: "Founder" },
    { key: "payouts", label: "Payouts (founder only)", group: "Founder", count: 1, accent: "gold" as const },
    { key: "projects", label: "Projects (founder only)", group: "Founder" },
    { key: "contributor", label: "The contributor's view", group: "Other side" },
  ];
  const bench = sid ? <Workbench sessionId={sid} onBack={() => setSid(null)} onCases={() => go("cases")} embedded /> : null;

  return (
    <div className="app" key={epoch}>
      <div className="topbar">
        <Logo height={22} />
        <span className="chip" style={{ fontFamily: "var(--mono)", fontSize: "0.7rem" }}>Cutting Room · demo</span>
      </div>
      <div className="studio">
        <StudioNav items={items} active={tab} onPick={go} />
        <main className="studio-main">
          <div className="shell" style={{ maxWidth: 720, paddingBottom: 0 }}>
            <div className="tile" style={{ borderColor: "var(--gold)", marginBottom: 12 }}>
              <div className="tlbl" style={{ color: "var(--gold)" }}>Demo · nothing is saved</div>
              <div className="tbody muted" style={{ fontSize: "0.85rem" }}>
                You are a linguist. Two finished rallies wait in the queue, built from the founders' own clips. Claim one and a machine draft arrives for every take a few seconds later (an English-trained model on Pidgin, so it needs correcting; the founders' notes show what a careful linguist writes). Turn 4 of Market Day is a clean take that its partner rated 2.25: mark the rating "too low", flag the rater, then follow the case through review, notice, the contributor's response and a decision signed by a second team member.{" "}
                <button type="button" onClick={reset} style={{ background: "none", border: "none", color: "var(--acc)", padding: 0, font: "inherit", cursor: "pointer" }}>Reset the demo</button>
              </div>
            </div>
            {NOTE[tab] && <div className="tbody muted small" style={{ marginBottom: 8 }}>{NOTE[tab]}</div>}
          </div>
          {tab === "home" && <Home ov={ov} onGo={go} onRefresh={loadOv} asAdmin />}
          {tab === "queue" && (bench ?? <Verify onBack={() => undefined} onOpen={setSid} onCases={() => go("cases")} embedded />)}
          {tab === "audit" && (bench ?? <Audit onBack={() => go("queue")} onOpen={setSid} embedded />)}
          {tab === "cases" && <Integrity onBack={() => go("queue")} embedded />}
          {tab === "payouts" && <Payouts onBack={() => go("queue")} embedded />}
          {tab === "projects" && <Projects onBack={() => go("queue")} embedded />}
          {tab === "contributors" && <Contributors onBack={() => go("queue")} embedded />}
          {tab === "team" && <Team onBack={() => go("queue")} embedded />}
          {tab === "contributor" && <CaseNotice onBack={() => go("queue")} embedded />}
        </main>
      </div>
    </div>
  );
}
