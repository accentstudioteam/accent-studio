import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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
import { RallyBoard } from "@/routes/RallyBoard";
import { LinguistEarnings } from "@/routes/LinguistEarnings";

type View = "home" | "settings" | "applications" | "labs" | "cards" | "rallies" | "verify" | "audit" | "integrity" | "payouts" | "projects" | "team" | "contributors" | "earnings";
interface NavState { view: View; sessionId: string | null }

/** The signed-in studio: one shell, a sidebar (or a strip on phones) with what is waiting, and the current screen inside it. */
export function Studio() {
  const { profile, signOut } = useAuth();
  const [view, setView] = useState<View>("home");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [ov, setOv] = useState<Overview | null>(null);
  const admin = !!profile?.is_admin;
  const staff = admin || !!profile?.is_linguist;

  // --- Browser-history integration so the OS back button navigates within the app ---
  const navRef = useRef<NavState>({ view: "home", sessionId: null });
  const fromPop = useRef(false);

  useEffect(() => {
    window.history.replaceState(navRef.current, "");
    const onPop = (e: PopStateEvent) => {
      const s = e.state as NavState | null;
      if (!s) return;
      fromPop.current = true;
      navRef.current = s;
      setView(s.view);
      setSessionId(s.sessionId);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (fromPop.current) { fromPop.current = false; return; }
    const next: NavState = { view, sessionId };
    if (next.view === navRef.current.view && next.sessionId === navRef.current.sessionId) return;
    navRef.current = next;
    window.history.pushState(next, "");
  }, [view, sessionId]);

  const back = useCallback(() => window.history.back(), []);
  // --- end history integration ---

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
          { key: "rallies", label: "Rally board", group: "The floor" },
          { key: "verify", label: "Queue", group: "Cutting Room", count: ov?.cutting_room.queue },
          { key: "audit", label: "Audit", group: "Cutting Room", count: ov?.cutting_room.audit_pending },
          { key: "integrity", label: "Cases", group: "Cutting Room", count: ov?.cutting_room.cases_open, accent: "gold" as const },
          { key: "earnings", label: "Earnings", group: "Your work" },
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
        { key: "earnings", label: "Money", icon: "money" },
        { key: "settings", label: "You", icon: "you" },
      ];
  const dockActive = dockTabs.some((t) => t.key === view) ? view : view === "audit" || view === "integrity" || view === "rallies" ? "verify" : view === "applications" || view === "team" ? "contributors" : view === "labs" || view === "cards" ? "projects" : view === "earnings" ? "earnings" : "home";
  let content: ReactNode;
  switch (view) {
    case "rallies":
      content = <RallyBoard onBack={back} embedded />;
      break;
    case "settings":
      content = <Settings onBack={back} />;
      break;
    case "applications":
      content = <Applications onBack={back} />;
      break;
    case "labs":
      content = <LabInquiries onBack={back} />;
      break;
    case "cards":
      content = <Cards onBack={back} />;
      break;
    case "integrity":
      content = <Integrity onBack={back} embedded />;
      break;
    case "payouts":
      content = <Payouts onBack={back} embedded />;
      break;
    case "projects":
      content = <Projects onBack={back} embedded />;
      break;
    case "team":
      content = <Team onBack={back} embedded />;
      break;
    case "earnings":
      content = <LinguistEarnings onBack={back} embedded />;
      break;
    case "contributors":
      content = <Contributors onBack={back} embedded />;
      break;
    case "audit":
      content = sessionId
        ? <Workbench sessionId={sessionId} onBack={back} onCases={() => go("integrity")} embedded />
        : <Audit onBack={back} onOpen={setSessionId} embedded />;
      break;
    case "verify":
      content = sessionId
        ? <Workbench sessionId={sessionId} onBack={back} onCases={() => go("integrity")} embedded />
        : <Verify onBack={back} onOpen={setSessionId} onCases={() => go("integrity")} embedded />;
      break;
    default:
      content = <Home ov={ov} onGo={go} onRefresh={refresh} />;
  }

  // `ankara studio-ank` is the whole skin switch: `.ankara` brings the player
  // app's tokens and base, `.studio-ank` the dense admin flavour of them. Both
  // are needed; see the ANKARA · THE STUDIO block at the end of tokens.css.
  return (
    <div className="app ankara studio-ank">
      <div className="topbar">
        <Logo height={22} tone="mono" />
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="chip num">{profile?.editor_id ?? profile?.handle ?? "studio"}</span>
          <button type="button" className="chip" onClick={() => void signOut()}>Sign out</button>
        </div>
      </div>
      <div className="studio with-dock has-dock">
        <StudioNav items={items} active={view} onPick={go} />
        {/* keyed on the view so moving between sections is a deliberate
            transition rather than a swap: `.sx-view` replays on every mount. */}
        <main className="studio-main">
          <div className="sx-view" key={sessionId ? `${view}:open` : view}>{content}</div>
        </main>
        {/* The dock wears the player skin's own dock, which is what `skin` is for. */}
        <Dock tabs={dockTabs} active={dockActive} onPick={go} skin="ankara" />
      </div>
    </div>
  );
}
