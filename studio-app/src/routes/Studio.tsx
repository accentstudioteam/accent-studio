import { useState } from "react";
import { Home } from "@/routes/Home";
import { Settings } from "@/routes/Settings";

type View = "home" | "settings";

/** The signed-in, onboarded app. Holds the current in-app view. */
export function Studio() {
  const [view, setView] = useState<View>("home");

  if (view === "settings") return <Settings onBack={() => setView("home")} />;
  return <Home onSettings={() => setView("settings")} />;
}
