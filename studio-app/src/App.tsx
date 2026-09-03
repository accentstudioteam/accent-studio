import { useAuth } from "@/auth/AuthProvider";
import { SignIn } from "@/routes/SignIn";
import { Blocked } from "@/routes/Blocked";
import { Onboarding } from "@/routes/Onboarding";
import { Studio } from "@/routes/Studio";
import { Prototype } from "@/prototype/Prototype";
import { Apply } from "@/routes/Apply";

export function App() {
  const { session, profile, loading } = useAuth();

  // Public player application (the waitlist) at /apply. Vercel rewrites that
  // path to this shell; no sign-in involved.
  if (typeof window !== "undefined" && /\/apply\/?$/.test(window.location.pathname)) {
    return <Apply />;
  }

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

  // Authenticated but the DB says they're not allowed in yet.
  // The allowlist is also enforced by row-level security, so this is
  // UX, not the security boundary.
  if (!profile?.is_allowlisted) return <Blocked />;

  // First run: no language picked yet. Locale is required to serve prompts.
  if (!profile.locale) return <Onboarding />;

  return <Studio />;
}
