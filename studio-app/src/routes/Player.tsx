import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/auth/AuthProvider";
import { PlayerHome } from "@/routes/PlayerHome";
import { Rally } from "@/routes/Rally";
import { Join } from "@/routes/Join";
import type { Onboarding } from "@/lib/types";

/** The contributor's app: home with rallies, or one rally. Falls back to Join if they never signed. */
export function Player() {
  const { session } = useAuth();
  const [me, setMe] = useState<Onboarding | null>(null);
  const [rally, setRally] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    void supabase.rpc("my_onboarding").then(({ data }) => setMe((data as Onboarding) ?? null));
  }, [session]);

  if (!me) return <div className="full-center"><div className="spin" /></div>;
  if (!me.contributor || !me.consent || me.consent.withdrawn_at) return <Join />;
  if (rally) return <Rally sessionId={rally} onBack={() => setRally(null)} />;
  return <PlayerHome me={me} onOpenRally={setRally} />;
}
