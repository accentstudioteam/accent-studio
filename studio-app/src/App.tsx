import { useAuth } from "@/auth/AuthProvider";
import { SignIn } from "@/routes/SignIn";
import { Blocked } from "@/routes/Blocked";
import { Onboarding } from "@/routes/Onboarding";
import { Studio } from "@/routes/Studio";
import { Prototype } from "@/prototype/Prototype";
import { Apply } from "@/routes/Apply";
import { Join } from "@/routes/Join";
import { Player } from "@/routes/Player";
import { demoRole, isDemo } from "@/lib/demo";
import { LinguistDemo } from "@/routes/LinguistDemo";

export function App() {
  const { session, profile, loading } = useAuth();

  // Public player application (the waitlist) at /apply. Vercel rewrites that
  // path to this shell; no sign-in involved.
  if (typeof window !== "undefined" && /\/apply\/?$/.test(window.location.pathname)) {
    return <Apply />;
  }

  // Demo of the player app on an in-memory backend: ?demo=player, or the chat artifact. Nothing is saved.
  if (isDemo()) return demoRole() === "linguist" ? <LinguistDemo /> : <Player />;

  // Invited applicants join here: sign in by email, sign the agreement. Public until signed in.
  const joining = typeof window !== "undefined" && /\/studio\/join\/?$/.test(window.location.pathname);
  if (joining && !loading) return <Join />;

  // Click-through prototype of every screen, activated via /studio?proto.
  // Renders before the auth gate so flows can be reviewed without signing in.
  if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("proto")) {
    return <Prototype />;
  }

  if (loading) {
    return (
      <div className="full-center">
        <div className="spin" />
      </div>
    );
  }

  if (!session) return <SignIn />;

  // Founders and linguists: the studio. Everyone else who is allowlisted is a
  // signed contributor and gets the player app. Row-level security is the real
  // boundary; this is routing.
  if (profile?.is_admin) {
    if (!profile.locale) return <Onboarding />;
    return <Studio />;
  }
  // Contracted linguists get the studio too; row-level security limits what they can read.
  if (profile?.is_linguist) return <Studio />;
  if (profile?.is_allowlisted) return <Player />;
  return <Blocked />;
}
