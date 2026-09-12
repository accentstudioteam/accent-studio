import { useState } from "react";
import { Home } from "@/routes/Home";
import { Settings } from "@/routes/Settings";
import { Applications } from "@/routes/Applications";
import { LabInquiries } from "@/routes/LabInquiries";
import { Cards } from "@/routes/Cards";

type View = "home" | "settings" | "applications" | "labs" | "cards";

/** The signed-in, onboarded app. Holds the current in-app view. */
export function Studio() {
  const [view, setView] = useState<View>("home");

  if (view === "settings") return <Settings onBack={() => setView("home")} />;
  if (view === "applications") return <Applications onBack={() => setView("home")} />;
  if (view === "labs") return <LabInquiries onBack={() => setView("home")} />;
  if (view === "cards") return <Cards onBack={() => setView("home")} />;
  return <Home onSettings={() => setView("settings")} onApplications={() => setView("applications")} onLabInquiries={() => setView("labs")} onCards={() => setView("cards")} />;
}
