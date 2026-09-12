import { useState } from "react";
import { Home } from "@/routes/Home";
import { Settings } from "@/routes/Settings";
import { Applications } from "@/routes/Applications";
import { LabInquiries } from "@/routes/LabInquiries";
import { Cards } from "@/routes/Cards";
import { Verify } from "@/routes/Verify";
import { Workbench } from "@/routes/Workbench";
import { Integrity } from "@/routes/Integrity";
import { Payouts } from "@/routes/Payouts";
import { Projects } from "@/routes/Projects";

type View = "home" | "settings" | "applications" | "labs" | "cards" | "verify" | "integrity" | "payouts" | "projects";

/** The signed-in, onboarded studio. Holds the current in-app view. */
export function Studio() {
  const [view, setView] = useState<View>("home");
  const [sessionId, setSessionId] = useState<string | null>(null);

  if (view === "settings") return <Settings onBack={() => setView("home")} />;
  if (view === "applications") return <Applications onBack={() => setView("home")} />;
  if (view === "labs") return <LabInquiries onBack={() => setView("home")} />;
  if (view === "cards") return <Cards onBack={() => setView("home")} />;
  if (view === "integrity") return <Integrity onBack={() => setView("home")} />;
  if (view === "payouts") return <Payouts onBack={() => setView("home")} />;
  if (view === "projects") return <Projects onBack={() => setView("home")} />;
  if (view === "verify") {
    if (sessionId) return <Workbench sessionId={sessionId} onBack={() => setSessionId(null)} onCases={() => setView("integrity")} />;
    return <Verify onBack={() => setView("home")} onOpen={setSessionId} onCases={() => setView("integrity")} />;
  }
  return <Home onSettings={() => setView("settings")} onApplications={() => setView("applications")} onLabInquiries={() => setView("labs")} onCards={() => setView("cards")} onVerify={() => setView("verify")} onIntegrity={() => setView("integrity")} onPayouts={() => setView("payouts")} onProjects={() => setView("projects")} />;
}
