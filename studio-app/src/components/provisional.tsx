import { useId, useState } from "react";
import { money, spoken, type Provisional } from "@/lib/earn";

/* ============================================================================
   "Recorded, not checked yet": what a contributor has put in that no linguist
   has priced.

   An `earnings` row only appears once a session is verified, so until then a
   balance of $0.00 is the only signal a rally ever happened. These two pieces
   show the other half, deliberately quietly.

   Why it looks the way it does: the real balance is the gold .blk, and this
   must never be mistaken for it. So it is the plain .card surface with the
   soft outline and a soft shadow, and the figure is in --muted rather than
   ink. No new colour, font or shadow is introduced; `.prov*` in tokens.css is
   those three substitutions and nothing else.

   The hint the founder asked for is a real <button> with aria-expanded and
   aria-controls, not a title= or a :hover, so it works from the keyboard and
   is announced.
   ========================================================================= */

/** Priced at the rate their recent verified work has earned, so it reads as the real figure. */
function Why({ p, id }: { p: Provisional; id: string }) {
  return (
    <div className="prov-why" id={id}>
      <p>
        Nothing is paid until one of our linguists has sat and listened to the rally. Two things move the number when they do. They can shorten a turn that has silence or two people talking over each other in it, so the time can come down a little. And they score the take, which sets your rate for it. The best takes pay ×{p.top_multiplier} of the hourly rate.
      </p>
      <p>
        We work this figure out at ×{p.multiplier}, the rate your recent checked work has earned. Score higher on these and it goes up; score lower and it comes down. It is our best guess, not a promise.
      </p>
      <p>
        {p.held_rallies > 0
          ? `One thing is left out of it: ${p.held_rallies === 1 ? "a rally" : `${p.held_rallies} rallies`} of yours is being checked under clause 15, so ${spoken(p.held_seconds)} is not counted here at all until that is decided.`
          : "If a rally is ever caught by a clause 15 check, it drops out of this figure until the case is decided."}
      </p>
    </div>
  );
}

/** The disclosure button plus its panel. `extra` rides in the same row, so Home keeps one line of chips. */
function WhyToggle({ p, extra }: { p: Provisional; extra?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = `prov-why-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <>
      <div className="prov-foot">
        <button className="btn btn-outline btn-sm" type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}>
          {open ? "Close this" : "Why it can change"}
        </button>
        {extra}
      </div>
      {open && <Why p={p} id={id} />}
    </>
  );
}

/** Home: the real balance sits in the gold block above; this is the quiet line under it. */
export function ProvisionalStrip({ p, onOpenMoney }: { p: Provisional; onOpenMoney: () => void }) {
  if (p.pending_rallies === 0 && p.held_rallies === 0) return null;
  return (
    <div className="card prov">
      <div className="lab">Recorded, not checked yet</div>
      <div className="prov-fig">
        <b>{money(p.estimate_usd)}</b>
        <span>still to be checked</span>
      </div>
      <p>
        {p.pending_rallies > 0
          ? `${spoken(p.pending_seconds)} across ${p.pending_rallies} ${p.pending_rallies === 1 ? "rally" : "rallies"}. A linguist has to listen before any of it is yours, so it is not in your balance yet. Money has the whole picture.`
          : "Everything you have recorded is being checked under clause 15, so there is nothing to count here yet. Money has the whole picture."}
      </p>
      <WhyToggle p={p} extra={<button className="btn btn-outline btn-sm" type="button" onClick={onOpenMoney}>Open Money</button>} />
    </div>
  );
}

/** Money: the same figure with the arithmetic behind it, and the rallies it came from. */
export function ProvisionalBlock({ p }: { p: Provisional }) {
  if (p.pending_rallies === 0 && p.held_rallies === 0) return null;
  const rate = p.base_rate_usd;
  return (
    <div className="card prov prov-full">
      <div className="lab">Recorded, not checked yet</div>
      <div className="prov-fig">
        <b>{money(p.estimate_usd)}</b>
        <span>still to be checked</span>
      </div>
      <p>
        {p.pending_rallies > 0
          ? `${spoken(p.pending_seconds)} across ${p.pending_rallies} ${p.pending_rallies === 1 ? "rally" : "rallies"}${rate ? `, at ${money(rate)} an hour and your rate of ×${p.multiplier}` : ""}. This is not in your balance and you cannot take it out.`
          : "Everything you have recorded is being checked under clause 15, so there is nothing to count here yet."}
      </p>
      {(Number(p.recording_usd) > 0 || Number(p.reviewing_usd) > 0 || p.held_rallies > 0) && (
        <div className="prov-chips">
          {Number(p.recording_usd) > 0 && <span className="chip chip-cream">{money(p.recording_usd)} still in play</span>}
          {Number(p.reviewing_usd) > 0 && <span className="chip chip-cream">{money(p.reviewing_usd)} waiting on a linguist</span>}
          {p.held_rallies > 0 && <span className="chip chip-coral">{p.held_rallies} held, not counted</span>}
        </div>
      )}
      <WhyToggle p={p} />
      {p.rallies.length > 0 && (
        <ul className="lines">
          {p.rallies.map((r) => (
            <li key={r.session_id} style={{ opacity: r.held ? 0.7 : 1 }}>
              <span className="d">{Math.round(r.seconds)}s</span>
              <span className="t">
                {r.title}
                <small className="mono muted" style={{ display: "block", fontWeight: 400, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r.held ? "held under clause 15" : r.stage === "recording" ? "still in play" : "waiting on a linguist"}
                </small>
              </span>
              <span className="amt">{r.held ? "—" : money(r.estimate_usd)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
