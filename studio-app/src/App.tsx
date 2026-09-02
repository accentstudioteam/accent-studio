import { useAuth } from "@/auth/AuthProvider";
import { SignIn } from "@/routes/SignIn";
import { Blocked } from "@/routes/Blocked";
import { Home } from "@/routes/Home";

export function App() {
  const { session, profile, loading } = useAuth();

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

  return <Home />;
}
