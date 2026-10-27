import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/auth/AuthProvider";
import { PlayerHome } from "@/routes/PlayerHome";
import { PlayerPlay } from "@/routes/PlayerPlay";
import { Rally } from "@/routes/Rally";
import { Join } from "@/routes/Join";
import { CaseNotice } from "@/routes/CaseNotice";
import { Earnings } from "@/routes/Earnings";
import { Booth } from "@/routes/Booth";
import { Arena } from "@/routes/Arena";
import { Account } from "@/routes/Account";
import { Logo } from "@/components/Logo";
import { Dock, PlayerSidebar, type DockTab } from "@/components/StudioNav";
import { useMedia } from "@/lib/useMedia";
import type { Onboarding } from "@/lib/types";
import { demoOnboarding, isDemo } from "@/lib/demo";
import { Page } from "@/components/ankara-ui";

type Tab = "home" | "play" | "live" | "money" | "you";

/** The contributor's app: five places (Home, Play, Live, Money, You) on a floating dock on phones and a sidebar on a desk,
 * where Play splits into the rally list and the open rally. A scene or a notice opens on top. Falls back to Join if they never signed. */
export function Player() {
  const { session, signOut } = useAuth();
  const desk = useMedia("(min-width: 900px)");
  const [me, setMe] = useState<Onboarding | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [rally, setRally] = useState<string | null>(null);
  // Which project Play is open on, held here so it survives a trip into a rally.
  const [pid, setPid] = useState<string | null>(null);
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

  if (!me) return <div className="ankara page-root"><div className="scroll no-dock"><div className="sys">Opening your app</div></div></div>;
  if (!me.contributor || !me.consent || me.consent.withdrawn_at) return <Join />;
  if (me.contributor.closed_at) {
    return (
      <Page dock={false}>
        <div className="topbar"><Logo height={24} tone="mono" /></div>
        <div className="lab muted" style={{ marginTop: 18 }}>Clause 15</div>
        <h2 className="pg">This account is closed.</h2>
        <div className="card pad" style={{ marginTop: 14 }}>
          <p>{me.contributor.closed_reason ? `Reason: ${me.contributor.closed_reason}. ` : "The decision and its reason were sent to your registered email. "}Verified earnings from sessions not involved in the decision are still paid on the normal schedule. You can ask for the record of the case, and you can complain to your data protection authority, by writing to privacy@accentstudio.io.</p>
        </div>
        <button className="btn btn-outline btn-block signout" type="button" onClick={() => void signOut()}>Sign out</button>
      </Page>
    );
  }
  if (me.contributor.paused_until && new Date(me.contributor.paused_until) > new Date()) {
    const until = new Date(me.contributor.paused_until).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "Africa/Lagos" });
    return (
      <Page dock={false}>
        <div className="topbar"><Logo height={24} tone="mono" /></div>
        <div className="lab muted" style={{ marginTop: 18 }}>Paused</div>
        <h2 className="pg">Your account is paused until {until}.</h2>
        <div className="blk blk-gold pat-zig-6 bal">
          <div className="lab">Why</div>
          <p style={{ fontSize: 14.5, fontWeight: 500, marginTop: 8, lineHeight: 1.45 }}>{me.contributor.paused_reason ?? "A member of the team paused new sessions for now."}</p>
        </div>
        <div className="card pad" style={{ marginTop: 14 }}>
          <p>No new rallies or bookings until then. Your verified earnings are not affected and pay on the normal schedule; you can still request a payout from Money. Questions: hello@accentstudio.io.</p>
        </div>
        <div className="btn-row" style={{ marginTop: 14 }}>
          <button className="btn btn-outline" type="button" onClick={() => { setTab("money"); }}>Money</button>
          <button className="btn btn-outline" type="button" onClick={() => void signOut()}>Sign out</button>
        </div>
      </Page>
    );
  }

  const go = (k: string) => {
    setRally(null);
    setNotices(false);
    setTab(k as Tab);
    reloadMe();
  };
  const home = () => go("home");
  // On a desk a rally opens beside the list, so it always lives under Play.
  const openRally = (id: string) => {
    setRally(id);
    if (desk) setTab("play");
  };
  const tabs: DockTab[] = [
    { key: "home", label: "Home", icon: "home" },
    { key: "play", label: "Play", icon: "play", badge: counts.play },
    { key: "live", label: "Live", icon: "live", badge: counts.live, soon: counts.soon },
    { key: "money", label: "Money", icon: "money" },
    { key: "you", label: "You", icon: "you" },
  ];
  const side = <PlayerSidebar tabs={tabs} active={tab} onPick={go} speakerId={me.contributor.speaker_id} onSignOut={() => void signOut()} />;
  // The dock sits on top of the Ankara screens, so it wears the skin's own dock (tokens.css, `.ankara .dock`).
  // The studio's dock is left exactly as it was: only the player passes `skin`.
  const dock = <Dock tabs={tabs} active={tab} onPick={go} skin="ankara" />;
  const frame = (node: JSX.Element) => (desk ? <div className="player-desk">{side}<main className="player-main">{node}</main></div> : node);

  // Leaf screens stand alone on a phone (their own back link); on a desk they sit in the main column beside the sidebar.
  if (scene) return frame(<Arena sessionId={scene} onBack={() => { setScene(null); setTab("live"); }} />);
  if (notices) return frame(<CaseNotice onBack={() => setNotices(false)} />);
  if (rally && !desk) return <Rally sessionId={rally} onBack={() => setRally(null)} />;

  const homeProps = { me, onOpenRally: openRally, onNotices: () => setNotices(true), onEarnings: () => go("money"), onBooth: () => go("live"), onPlayTab: () => go("play"), onJoinScene: (sid: string) => setScene(sid), onAccount: () => go("you"), onCounts: setCounts };
  // Play: the projects this contributor is on, the rallies inside one, and joining.
  const playProps = { projectId: pid, onPickProject: setPid, onOpenRally: openRally, onHome: home };
  let screen: JSX.Element;
  if (tab === "you") screen = <Account onBack={home} onChanged={reloadMe} />;
  else if (tab === "money") screen = <Earnings onBack={home} />;
  else if (tab === "live") screen = <Booth language={me.contributor.primary_language ?? "pcm"} onBack={home} onJoin={(sid) => setScene(sid)} />;
  else if (tab === "play" && desk) {
    screen = (
      <div className="split">
        <div className="split-list"><PlayerPlay {...playProps} /></div>
        <div className="split-detail">
          {rally ? (
            <Rally key={rally} sessionId={rally} onBack={() => setRally(null)} />
          ) : (
            <Page dock={false}>
              <div className="card pad" style={{ marginTop: 32 }}>
                <h3>Pick a rally.</h3>
                <p>The ones already yours first, then the ones somebody is waiting in, then the ones nobody has touched. Join one from the list and it opens here.</p>
              </div>
            </Page>
          )}
        </div>
      </div>
    );
  } else if (tab === "play") screen = <PlayerPlay {...playProps} />;
  else screen = <PlayerHome {...homeProps} />;

  if (desk) return <div className="player-desk">{side}<main className="player-main">{screen}</main></div>;
  // `.ankara` on the frame is what puts the dock in the skin; the screen inside carries its own.
  return <div className="ankara has-dock">{screen}{dock}</div>;
}
