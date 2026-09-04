import { useAuth } from "@/auth/AuthProvider";
import { Sheet, Tile, Waveform } from "@/components/Sheet";
import { LOCALE_NAME } from "@/lib/labels";
import { Logo } from "../components/Logo";

const DEMO_BARS = [55, 32, 78, 44, 68, 88, 52, 72, 38, 58, 48, 34, 64, 40];

export function Home({ onSettings, onApplications, onLabInquiries }: { onSettings: () => void; onApplications?: () => void; onLabInquiries?: () => void }) {
  const { profile, session } = useAuth();
  const name = profile?.handle ?? session?.user.email?.split("@")[0] ?? "player";
  const lang = profile?.locale ? LOCALE_NAME[profile.locale] : null;

  return (
    <div className="app">
      <div className="topbar">
        <Logo height={22} />
        <button
          aria-label="Settings"
          onClick={onSettings}
          style={{
            background: "transparent",
            border: "1px solid var(--line)",
            borderRadius: 10,
            width: 40,
            height: 40,
            color: "var(--ink2)",
            fontSize: "1.1rem",
          }}
        >
          ⚙
        </button>
      </div>

      <div className="shell">
        <div className="spread" style={{ marginBottom: 20, alignItems: "flex-start" }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              {lang ? `Playing in ${lang}` : "Welcome back"}
            </div>
            <h1 className="h1">Hey, {name}.</h1>
          </div>
          <div className="chip" style={{ flex: "none" }}>
            {profile?.ap_balance ?? 0} AP
          </div>
        </div>

        <div className="stack">
          {profile?.is_admin && (
            <Sheet title="Founder tools">
              <Tile label="Waitlist">
                <div className="ttitle">Player applications</div>
                <div className="tbody muted" style={{ marginTop: 6 }}>
                  Read, listen and triage everyone who applied at accentstudio.io/apply.
                </div>
              </Tile>
              <button className="pill mint" onClick={onApplications}>Open applications</button>
              <Tile label="Labs">
                <div className="ttitle">Lab inquiries</div>
                <div className="tbody muted" style={{ marginTop: 6 }}>
                  Every sample-bundle request from accentstudio.io/labs. They also land in hello@ with reply-to set to the lab.
                </div>
              </Tile>
              <button className="pill" onClick={onLabInquiries} style={{ background: "#f0a84b", color: "#0d0b08" }}>Open lab inquiries</button>
            </Sheet>
          )}
          <Sheet title="Ping · ready when you are">
            <Tile label="Next up">
              <div className="ttitle">A fraud dispute is waiting.</div>
              <div className="tbody muted" style={{ marginTop: 6 }}>
                Say the English prompt in your language, your way. Your partner
                rates the take.
              </div>
            </Tile>
            <Tile label="Chidi · 00:14">
              <Waveform bars={DEMO_BARS} played={8} />
            </Tile>
            <button className="pill" disabled>
              Start a rally · soon
            </button>
          </Sheet>

          <Sheet title="Live · arena" accent="gold">
            <Tile label="Persona" variant="acc">
              <div className="ttitle">Improv a scene with a stranger.</div>
            </Tile>
            <button className="pill ghost" disabled>
              Enter the arena · soon
            </button>
          </Sheet>

          <p
            className="muted center"
            style={{ fontSize: "0.8rem", marginTop: 10 }}
          >
            This is the studio shell. Game screens land next, built on these
            same tiles.
          </p>
        </div>
      </div>
    </div>
  );
}
