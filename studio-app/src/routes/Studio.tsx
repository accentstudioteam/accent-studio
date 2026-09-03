import { useState } from "react";
import { Home } from "@/routes/Home";
import { Settings } from "@/routes/Settings";
import { Applications } from "@/routes/Applications";

type View = "home" | "settings" | "applications";

/** The signed-in, onboarded app. Holds the current in-app view. */
export function Studio() {
  const [view, setView] = useState<View>("home");

  if (view === "settings") return <Settings onBack={() => setView("home")} />;
  if (view === "applications") return <Applications onBack={() => setView("home")} />;
  return <Home onSettings={() => setView("settings")} onApplications={() => setView("applications")} />;
}
