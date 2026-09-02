import { useAuth } from "@/auth/AuthProvider";

/** Shown to an authenticated user who is not on the allowlist. */
export function Blocked() {
  const { session, signOut } = useAuth();
  return (
    <div className="full-center">
      <div style={{ width: "100%", maxWidth: 380 }} className="center">
        <div style={{ fontSize: "2rem", marginBottom: 14 }}>🔒</div>
        <h1 className="h1" style={{ marginBottom: 12 }}>
          Not open yet.
        </h1>
        <p className="muted" style={{ marginBottom: 24, fontSize: "0.95rem" }}>
          You're signed in as {session?.user.email}, but the studio is still in
          private preview. We'll open the doors soon.
        </p>
        <button className="pill ghost" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    </div>
  );
}
