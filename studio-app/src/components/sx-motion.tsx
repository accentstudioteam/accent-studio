import { useEffect, useRef, useState, type CSSProperties } from "react";

/* ============================================================================
   The Studio's motion, as two reusable pieces.

   The CSS primitives live in tokens.css under "ANKARA · THE STUDIO · MOTION
   PRIMITIVES"; these are the only two that need to know anything React does.
   Nothing here touches data, an RPC or a hook order in the screens that use it:
   both are presentation driven by what the poll already returned.
   ========================================================================= */

type Mark = "in" | "flash";

/**
 * Which rows in a polled list are NEW and which have just CHANGED.
 *
 * A live surface — the verification queue, the rally board — reads itself every
 * few seconds. Without this, a rally arriving and a rally going overdue look
 * exactly like a rally that has sat there for an hour. Give it the list, a key
 * and a string that describes the row's state; it hands back the class to put
 * on the row: `sx-enter-row` the first time it is seen, `sx-flash` when its
 * state string changes, nothing the rest of the time.
 *
 * The snapshot is committed in an effect, not during render, so React's double
 * render in development cannot mark a row as already seen before it animates.
 */
export function useRowMotion<T>(
  items: readonly T[] | null | undefined,
  keyOf: (x: T) => string,
  stateOf: (x: T) => string,
): (x: T) => string {
  const fns = useRef({ keyOf, stateOf });
  fns.current = { keyOf, stateOf };
  const seen = useRef<Map<string, string>>(new Map());
  const [marks, setMarks] = useState<Map<string, Mark>>(new Map());

  useEffect(() => {
    if (!items) return;
    const { keyOf: k, stateOf: s } = fns.current;
    const next = new Map<string, string>();
    const m = new Map<string, Mark>();
    for (const it of items) {
      const key = k(it);
      const state = s(it);
      next.set(key, state);
      const was = seen.current.get(key);
      if (was === undefined) m.set(key, "in");
      else if (was !== state) m.set(key, "flash");
    }
    seen.current = next;
    if (!m.size) {
      setMarks((cur) => (cur.size ? new Map() : cur));
      return;
    }
    setMarks(m);
    // let the animation finish, then drop the classes so a later poll can
    // re-apply them and the animation runs again
    const id = window.setTimeout(() => setMarks((cur) => (cur.size ? new Map() : cur)), 1100);
    return () => window.clearTimeout(id);
  }, [items]);

  return (x: T) => {
    const m = marks.get(fns.current.keyOf(x));
    return m === "in" ? " sx-enter-row" : m === "flash" ? " sx-flash" : "";
  };
}

/**
 * A figure that counts up from zero when it lands.
 *
 * The counting is done in CSS (`.sx-countup`, which animates a registered
 * custom property), so there is no interval and no re-render per frame. The
 * visible number is generated content, so the real one goes beside it for a
 * screen reader. A browser without `@property` shows the final figure at once.
 */
export function Num({ value, className }: { value: number | null | undefined; className?: string }) {
  const raw = Number(value);
  const n = Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : 0;
  return (
    <>
      <span
        className={`sx-countup${className ? ` ${className}` : ""}`}
        style={{ "--sx-cv": n } as CSSProperties}
        aria-hidden="true"
      />
      <span className="sr">{n}</span>
    </>
  );
}
