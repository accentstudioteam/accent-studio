import { useId, useMemo } from "react";
import { avatarSVG, type AnkaraAvatar } from "@/components/ankara-avatars";

/* ============================================================================
   The handful of pieces the Ankara player screens share.

   Rally.tsx keeps its own copies (it is the reference port and is being edited
   elsewhere); these are the same shapes, lifted so the eight other screens do
   not each repeat them. Nothing here invents a look: every class name below
   already exists in the .ankara block of tokens.css, bar `.seats` / `.seat`,
   which are appended there with the rest of the play flow.
   ========================================================================= */

export const IcBack = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>;
export const IcArrow = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h13M12 5l7 7-7 7" /></svg>;
export const IcStar = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.3 6.4L12 17.1l-5.8 3.2 1.3-6.4L2.8 9.5l6.4-.8z" /></svg>;
export const IcPlay = () => <svg className="ic-play" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" /></svg>;

/** The prototype's .ava. The sprites declare <mask id="vm-…">, so each mount needs its own id. */
export function Ava({ who, size, className = "" }: { who: AnkaraAvatar; size: number; className?: string }) {
  const raw = useId();
  const uid = raw.replace(/[^a-zA-Z0-9]/g, "");
  const html = useMemo(() => avatarSVG(who, size, uid), [who, size, uid]);
  return <span className={`ava ${className}`.trim()} style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** The prototype's .phone, standing in for the viewport: see .ankara.page-root in tokens.css. */
export function Page({ children, dock = true }: { children: React.ReactNode; dock?: boolean }) {
  return (
    <div className="ankara page-root">
      <div className={`scroll${dock ? "" : " no-dock"}`}>{children}</div>
    </div>
  );
}

/** The avatar picker's `.pad .top` idiom: back arrow and eyebrow on one line, the page heading under it.
 * The fragment keeps `h2.pg` a direct child of `.scroll`, which is what `.ankara .scroll>h2.pg` wants. */
export function TopBar({ onBack, backLabel = "Back", eyebrow, title, right }: { onBack?: () => void; backLabel?: string; eyebrow?: string; title: string; right?: React.ReactNode }) {
  return (
    <>
      <div className="topbar">
        {onBack && <button className="back" type="button" onClick={onBack} aria-label={backLabel}><IcBack /></button>}
        <div>{eyebrow && <div className="lab muted">{eyebrow}</div>}</div>
        {right}
      </div>
      <h2 className="pg">{title}</h2>
    </>
  );
}

/** The three rally slots a contributor may hold, and how many are gone.
 * `.seats` / `.seat` are the one pair of class names here that the prototype
 * did not have: see the note beside them at the end of tokens.css. */
export function Seats({ used, max }: { used: number; max: number }) {
  const n = Math.max(1, max);
  return (
    <div className="seats" role="group" aria-label={`${used} of ${n} rally slots in play`}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className={`seat${i < used ? " taken" : ""}`}>
          <b>{i < used ? "In play" : "Free"}</b>
          <span>Slot {i + 1}</span>
        </div>
      ))}
    </div>
  );
}

/** The prototype's .notice, used here for every error and every confirmation. */
export function Notice({ tone = "gold", children }: { tone?: "gold" | "coral"; children: React.ReactNode }) {
  return <div className={`notice in-pop${tone === "coral" ? " notice-coral" : ""}`}>{children}</div>;
}
