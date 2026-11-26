import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { when } from "@/lib/verify";

interface Props {
  onBack: () => void;
  embedded?: boolean;
}

interface Line {
  session_id: string;
  title: string;
  language: string;
  verified_seconds: number;
  at: string;
  outcome?: string;
  amount_usd: number;
  kind: "verify" | "audit";
}

interface Data {
  rate_usd: number;
  total_verified_seconds: number;
  total_audited_seconds: number;
  total_seconds: number;
  total_hours: number;
  total_earned_usd: number;
  verified_count: number;
  audited_count: number;
  verified: Line[];
  audited: Line[];
}

const usd = (n: number | string) => `$${Number(n).toFixed(2)}`;
const hrs = (secs: number) => (secs / 3600).toFixed(1);

export function LinguistEarnings({ onBack, embedded }: Props) {
  const [e, setE] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("my_linguist_earnings");
      if (error) throw new Error(error.message);
      setE(data as Data);
      setErr(null);
    } catch (x) {
      setErr(x instanceof Error ? x.message.replace(/^.*?: /, "") : "Couldn't load your earnings.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const all = [...(e?.verified ?? []), ...(e?.audited ?? [])].sort((a, b) => b.at.localeCompare(a.at));

  const body = (
    <div className="shell wide">
      <div className="sx-head">
        <div>
          <div className="eyebrow">Your work</div>
          <h1 className="h1">Earnings</h1>
        </div>
        <div className="btn-row">
          <button type="button" className="pill ghost" onClick={() => void load()}>Refresh</button>
        </div>
      </div>

      {err && (
        <div className="sx-block sx-block-coral sx-pop" style={{ marginBottom: 12 }}>
          <div className="tlbl">Error</div>
          <div className="tbody">{err}</div>
        </div>
      )}
      {!e && !err && <div className="full-center"><div className="spin" /></div>}

      {e && (
        <>
          <div className="blk blk-gold pat-rings-6 bal">
            <div className="lab">Total earned</div>
            <div className="money"><span className="naira">{usd(e.total_earned_usd)}</span></div>
            <div className="row">
              <span className="chip chip-ink">{e.total_hours} hrs audio</span>
              <span className="chip chip-cream">{usd(e.rate_usd)}/hr</span>
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.4, marginTop: 10, fontWeight: 500 }}>
              You earn {usd(e.rate_usd)} for every hour of audio you verify or audit.{" "}
              {e.verified_count > 0 && <>{e.verified_count} session{e.verified_count === 1 ? "" : "s"} verified</>}
              {e.verified_count > 0 && e.audited_count > 0 && ", "}
              {e.audited_count > 0 && <>{e.audited_count} audited</>}
              {e.verified_count === 0 && e.audited_count === 0 && "No sessions yet — they appear here as you work."}
              {(e.verified_count > 0 || e.audited_count > 0) && "."}
            </p>
          </div>

          {all.length > 0 && (
            <>
              <div className="tlbl" style={{ margin: "14px 2px 6px" }}>Sessions · {all.length}</div>
              <div className="sx-list sx-enter">
                {all.map((l, i) => (
                  <div key={`${l.session_id}-${l.kind}-${i}`} className={`sx-row${l.kind === "audit" ? " sx-spine-gold" : " sx-spine-mint"}`}>
                    <div className="sx-row-top">
                      <div className="sx-row-main">
                        <div className="sx-row-t">{l.title}</div>
                        <div className="sx-row-s">
                          {l.language} · {hrs(l.verified_seconds)} hrs · {when(l.at)}
                          {l.kind === "audit" && l.outcome ? ` · ${l.outcome}` : ""}
                        </div>
                      </div>
                      <div className="sx-row-end">
                        <span className={`chip ${l.kind === "audit" ? "chip-gold" : "chip-mint"}`}>{l.kind}</span>
                        <span className="chip chip-cream">{usd(l.amount_usd)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );

  if (embedded) return body;
  return (
    <div className="app ankara studio-ank">
      <div className="topbar">
        <button type="button" className="sx-link" onClick={onBack}>‹ back</button>
      </div>
      {body}
    </div>
  );
}
