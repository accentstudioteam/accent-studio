import { useAuth } from "@/auth/AuthProvider";
import { Sheet, Tile, Waveform } from "@/components/Sheet";

const DEMO_BARS = [55, 32, 78, 44, 68, 88, 52, 72, 38, 58, 48, 34, 64, 40];

export function Home() {
  const { profile, session, signOut } = useAuth();
  const name = profile?.handle ?? session?.user.email?.split("@")[0] ?? "player";

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <span className="lamp" />
          Accent&nbsp;<em>Studio</em>
        </div>
        <button
          className="chip"
          style={{ background: "transparent", cursor: "pointer" }}
          onClick={() => void signOut()}
        >
          sign out
        </button>
      </div>

      <div className="shell">
        <div className="spread" style={{ marginBottom: 20 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              Welcome back
            </div>
            <h1 className="h1">Hey, {name}.</h1>
          </div>
          <div className="chip">{profile?.ap_balance ?? 0} AP</div>
        </div>

        <div className="stack">
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
