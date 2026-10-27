import { useAuth } from "@/auth/AuthProvider";
import { Page } from "@/components/ankara-ui";

/** Shown to an authenticated user who is not on the allowlist, in the "Ankara Blocks" direction. */
export function Blocked() {
  const { session, signOut } = useAuth();
  return (
    <Page dock={false}>
      <div className="lab muted" style={{ marginTop: 24 }}>Private preview</div>
      <h2 className="pg">Not open yet.</h2>
      <div className="blk blk-gold pat-rings-6 bal">
        <div className="lab">You are signed in</div>
        <p style={{ fontSize: 14.5, fontWeight: 500, marginTop: 8, lineHeight: 1.45 }}>
          as {session?.user.email}, but the studio is still in private preview. We'll open the doors soon.
        </p>
      </div>
      <button className="btn btn-outline btn-block signout" type="button" onClick={() => void signOut()}>Sign out</button>
    </Page>
  );
}
