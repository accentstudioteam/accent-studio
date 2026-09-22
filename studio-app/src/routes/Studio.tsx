import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { Logo } from "@/components/Logo";
import { Dock, StudioNav, type DockTab, type NavItem } from "@/components/StudioNav";
import { overview, type Overview } from "@/lib/admin";
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
import { Team } from "@/routes/Team";
import { Contributors } from "@/routes/Contributors";
import { Audit } from "@/routes/Audit";

type View = "home" | "settings" | "applications" | "labs" | "cards" | "verify" | "audit" | "integrity" | "payouts" | "projects" | "team" | "contributors";

/** The signed-in studio: one shell, a sidebar (or a strip on phones) with what is waiting, and the current screen inside it. */
export function Studio() {
  const { profile, signOut } = useAuth();
  const [view, setView] = useState<View>("home");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [ov, setOv] = useState<Overview | null>(null);
  const admin = !!profile?.is_admin;
  const staff = admin || !!profile?.is_linguist;

  const refresh = useCallback(() => {
    if (!admin) return;
    overview().then(setOv).catch(() => setOv(null));
  }, [admin]);

  useEffect(() => {
    refresh();
  }, [refresh, view]);

  const go = (key: string) => {
    setSessionId(null);
    setView(key as View);
  };
  const people = (ov?.contributors.identity_pending ?? 0) + (ov?.contributors.data_requests_open ?? 0);
  const items: NavItem[] = [
    { key: "home", label: "Home" },
    ...(staff
      ? [
          { key: "verify", label: "Queue", group: "Cutting Room", count: ov?.cutting_room.queue },
          { key: "audit", label: "Audit", group: "Cutting Room", count: ov?.cutting_room.audit_pending },
          { key: "integrity", label: "Cases", group: "Cutting Room", count: ov?.cutting_room.cases_open, accent: "gold" as const },
        ]
      : []),
    ...(admin
      ? [
          { key: "contributors", label: "Contributors", group: "People", count: people, accent: "gold" as const },
          { key: "applications", label: "Applications", group: "People", count: ov?.pipeline.applications_new },
          { key: "team", label: "Team", group: "People" },
          { key: "payouts", label: "Payouts", group: "Money", count: ov?.money.requested_count, accent: "gold" as const },
          { key: "projects", label: "Projects", group: "Labs", count: ov?.labs.deliveries_ready },
          { key: "labs", label: "Lab inquiries", group: "Labs", count: ov?.labs.inquiries_new },
          { key: "cards", label: "Cards", group: "Labs" },
        ]
      : []),
    { key: "settings", label: "Settings", group: "You" },
  ];

  const dockTabs: DockTab[] = admin
    ? [
        { key: "home", label: "Home", icon: "home" },
        { key: "verify", label: "Queue", icon: "queue", badge: ov?.cutting_room.queue },
        { key: "contributors", label: "People", icon: "people", badge: people },
        { key: "payouts", label: "Money", icon: "money", badge: ov?.money.requested_count },
        { key: "projects", label: "Labs", icon: "labs", badge: ov?.labs.deliveries_ready },
      ]
    : [
        { key: "home", label: "Home", icon: "home" },
        { key: "verify", label: "Queue", icon: "queue" },
        { key: "audit", label: "Audit", icon: "audit" },
        { key: "integrity", label: "Cases", icon: "cases" },
        { key: "settings", label: "You", icon: "you" },
      ];
  const dockActive = dockTabs.some((t) => t.key === view) ? view : view === "audit" || view === "integrity" ? "verify" : view === "applications" || view === "team" ? "contributors" : view === "labs" || view === "cards" ? "projects" : "home";
  let content: ReactNode;
  switch (view) {
    case "settings":
      content = <Settings onBack={() => go("home")} />;
      break;
    case "applications":
      content = <Applications onBack={() => go("home")} />;
      break;
    case "labs":
      content = <LabInquiries onBack={() => go("home")} />;
      break;
    case "cards":
      content = <Cards onBack={() => go("home")} />;
      break;
    case "integrity":
      content = <Integrity onBack={() => go("home")} embedded />;
      break;
    case "payouts":
      content = <Payouts onBack={() => go("home")} embedded />;
      break;
    case "projects":
      content = <Projects onBack={() => go("home")} embedded />;
      break;
    case "team":
      content = <Team onBack={() => go("home")} embedded />;
      break;
    case "contributors":
      content = <Contributors onBack={() => go("home")} embedded />;
      break;
    case "audit":
      content = sessionId
        ? <Workbench sessionId={sessionId} onBack={() => setSessionId(null)} onCases={() => go("integrity")} embedded />
        : <Audit onBack={() => go("home")} onOpen={setSessionId} embedded />;
      break;
    case "verify":
      content = sessionId
        ? <Workbench sessionId={sessionId} onBack={() => setSessionId(null)} onCases={() => go("integrity")} embedded />
        : <Verify onBack={() => go("home")} onOpen={setSessionId} onCases={() => go("integrity")} embedded />;
      break;
    default:
      content = <Home ov={ov} onGo={go} onRefresh={refresh} />;
  }

  return (
    <div className="app">
      <div className="topbar">
        <Logo height={22} />
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="chip" style={{ fontFamily: "var(--mono)", fontSize: "0.7rem" }}>{profile?.editor_id ?? profile?.handle ?? "studio"}</span>
          <button type="button" className="chip" style={{ cursor: "pointer" }} onClick={() => void signOut()}>Sign out</button>
        </div>
      </div>
      <div className="studio with-dock has-dock">
        <StudioNav items={items} active={view} onPick={go} />
        <main className="studio-main">{content}</main>
        <Dock tabs={dockTabs} active={dockActive} onPick={go} />
      </div>
    </div>
  );
}
