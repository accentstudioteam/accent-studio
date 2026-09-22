import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/auth/AuthProvider";
import { PlayerHome } from "@/routes/PlayerHome";
import { Rally } from "@/routes/Rally";
import { Join } from "@/routes/Join";
import { CaseNotice } from "@/routes/CaseNotice";
import { Earnings } from "@/routes/Earnings";
import { Booth } from "@/routes/Booth";
import { Arena } from "@/routes/Arena";
import { Account } from "@/routes/Account";
import { Logo } from "@/components/Logo";
import { Dock } from "@/components/StudioNav";
import type { Onboarding } from "@/lib/types";
import { demoOnboarding, isDemo } from "@/lib/demo";

type Tab = "home" | "play" | "live" | "money" | "you";

/** The contributor's app: five places on a floating dock (Home, Play, Live, Money, You), with a rally, a scene or a notice on top. Falls back to Join if they never signed. */
export function Player() {
  const { session, signOut } = useAuth();
  const [me, setMe] = useState<Onboarding | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [rally, setRally] = useState<string | null>(null);
  const [scene, setScene] = useState<string | null>(null);
  const [notices, setNotices] = useState(false);
  const [counts, setCounts] = useState({ play: 0, live: 0, soon: false });
  const reloadMe = () => {
    if (isDemo()) return;
    void supabase.rpc("my_onboarding").then(({ data }) => setMe((data as Onboarding) ?? null));
  };

  useEffect(() => {
    if (isDemo()) {
      setMe(demoOnboarding);
      return;
    }
    if (!session) return;
    void supabase.rpc("my_onboarding").then(({ data }) => setMe((data as Onboarding) ?? null));
  }, [session]);

  if (!me) return <div className="full-center"><div className="spin" /></div>;
  if (!me.contributor || !me.consent || me.consent.withdrawn_at) return <Join />;
  if (me.contributor.closed_at) {
    return (
      <div className="app">
        <div className="topbar"><Logo height={22} /></div>
        <div className="shell">
          <div className="eyebrow" style={{ marginBottom: 6 }}>Clause 15</div>
          <h1 className="h1" style={{ marginBottom: 14 }}>This account is closed.</h1>
          <div className="tile" style={{ marginBottom: 14 }}>
            <div className="tbody">{me.contributor.closed_reason ? `Reason: ${me.contributor.closed_reason}. ` : "The decision and its reason were sent to your registered email. "}Verified earnings from sessions not involved in the decision are still paid on the normal schedule. You can ask for the record of the case, and you can complain to your data protection authority, by writing to privacy@accentstudio.io.</div>
          </div>
          <button className="pill ghost" onClick={() => void signOut()}>Sign out</button>
        </div>
      </div>
    );
  }
  if (me.contributor.paused_until && new Date(me.contributor.paused_until) > new Date()) {
    const until = new Date(me.contributor.paused_until).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "Africa/Lagos" });
    return (
      <div className="app">
        <div className="topbar"><Logo height={22} /></div>
        <div className="shell">
          <div className="eyebrow" style={{ marginBottom: 6 }}>Paused</div>
          <h1 className="h1" style={{ marginBottom: 14 }}>Your account is paused until {until}.</h1>
          <div className="tile" style={{ borderColor: "var(--gold)", marginBottom: 14 }}>
            <div className="tlbl" style={{ color: "var(--gold)" }}>Why</div>
            <div className="tbody">{me.contributor.paused_reason ?? "A member of the team paused new sessions for now."}</div>
          </div>
          <div className="tile" style={{ marginBottom: 14 }}>
            <div className="tbody">No new rallies or bookings until then. Your verified earnings are not affected and pay on the normal schedule; you can still request a payout from Money. Questions: hello@accentstudio.io.</div>
          </div>
          <div className="btn-row">
            <button className="pill ghost" onClick={() => { setTab("money"); }}>Money</button>
            <button className="pill ghost" onClick={() => void signOut()}>Sign out</button>
          </div>
        </div>
      </div>
    );
  }

  const go = (k: string) => {
    setRally(null);
    setNotices(false);
    setTab(k as Tab);
    reloadMe();
  };
  const home = () => go("home");

  if (scene) return <Arena sessionId={scene} onBack={() => { setScene(null); setTab("live"); }} />;
  if (rally) return <Rally sessionId={rally} onBack={() => setRally(null)} />;
  if (notices) return <CaseNotice onBack={() => setNotices(false)} />;

  const dock = (
    <Dock
      tabs={[
        { key: "home", label: "Home", icon: "home" },
        { key: "play", label: "Play", icon: "play", badge: counts.play },
        { key: "live", label: "Live", icon: "live", badge: counts.live, soon: counts.soon },
        { key: "money", label: "Money", icon: "money" },
        { key: "you", label: "You", icon: "you" },
      ]}
      active={tab}
      onPick={go}
    />
  );
  let screen: JSX.Element;
  if (tab === "you") screen = <Account onBack={home} onChanged={reloadMe} />;
  else if (tab === "money") screen = <Earnings onBack={home} />;
  else if (tab === "live") screen = <Booth language={me.contributor.primary_language ?? "pcm"} onBack={home} onJoin={(sid) => setScene(sid)} />;
  else screen = <PlayerHome me={me} mode={tab === "play" ? "play" : "home"} onOpenRally={setRally} onNotices={() => setNotices(true)} onEarnings={() => go("money")} onBooth={() => go("live")} onPlayTab={() => go("play")} onJoinScene={(sid) => setScene(sid)} onAccount={() => go("you")} onCounts={setCounts} />;
  return <div className="has-dock">{screen}{dock}</div>;
}
