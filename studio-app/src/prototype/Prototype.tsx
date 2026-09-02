import { useCallback, useMemo, useState } from "react";
import { SCREENS } from "./registry";
import type { Nav, Phase } from "./types";
import { Logo } from "../components/Logo";

const PHASE_ORDER: Phase[] = [
  "Apply",
  "Interview",
  "Onboarding",
  "Game",
  "Economy",
  "Account",
  "Delivery",
];

/**
 * Click-through prototype harness. Activated via /studio?proto.
 * Holds a navigation stack over the screen registry, renders the
 * current screen inside the app shell, and offers a full screen index.
 * Entirely local, no backend.
 */
export function Prototype() {
  const [stack, setStack] = useState<string[]>([SCREENS[0].id]);
  const [indexOpen, setIndexOpen] = useState(false);

  const currentId = stack[stack.length - 1];
  const currentIdx = SCREENS.findIndex((s) => s.id === currentId);
  const current = currentIdx >= 0 ? SCREENS[currentIdx] : null;

  const go = useCallback((id: string) => {
    setStack((s) => [...s, id]);
    setIndexOpen(false);
    window.scrollTo(0, 0);
  }, []);
  const back = useCallback(() => {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
    window.scrollTo(0, 0);
  }, []);
  const next = useCallback(() => {
    const n = SCREENS[currentIdx + 1];
    if (n) go(n.id);
  }, [currentIdx, go]);

  const nav: Nav = useMemo(
    () => ({
      go,
      back,
      next,
      openIndex: () => setIndexOpen(true),
      canBack: stack.length > 1,
    }),
    [go, back, next, stack.length]
  );

  const grouped = useMemo(() => {
    return PHASE_ORDER.map((phase) => ({
      phase,
      items: SCREENS.filter((s) => s.phase === phase),
    })).filter((g) => g.items.length > 0);
  }, []);

  return (
    <div className="app">
      <div className="pbar">
        <button className="ico" onClick={back} disabled={!nav.canBack} aria-label="Back">
          ‹
        </button>
        <div className="ttl">{current ? current.title : "Coming in milestone 2"}</div>
        <span className="ph">{current ? current.phase : ""}</span>
        <button className="ico" onClick={() => setIndexOpen(true)} aria-label="All screens">
          ⊞
        </button>
      </div>

      <div className="shell">
        {current ? (
          <current.Component nav={nav} />
        ) : (
          <div className="full-center" style={{ minHeight: "60vh" }}>
            <div className="center" style={{ maxWidth: 320 }}>
              <div className="hero-emoji">🚧</div>
              <h1 className="h1" style={{ marginBottom: 10 }}>Next milestone.</h1>
              <p className="muted" style={{ marginBottom: 22, fontSize: "0.95rem" }}>
                <code style={{ color: "var(--acc2)" }}>{currentId}</code> lands in
                Milestone 2 (the game, economy and account screens).
              </p>
              <button className="pill ghost" onClick={back}>Go back</button>
            </div>
          </div>
        )}
      </div>

      {indexOpen && (
        <div className="pindex">
          <div
            className="spread"
            style={{ marginBottom: 22, position: "sticky", top: 0 }}
          >
            <Logo height={22} />
            <button className="ico" onClick={() => setIndexOpen(false)} aria-label="Close">
              ✕
            </button>
          </div>
          <div className="eyebrow" style={{ marginBottom: 18 }}>
            Prototype · {SCREENS.length} screens
          </div>
          {grouped.map((g) => (
            <div className="pindex-grp" key={g.phase}>
              <h4>{g.phase}</h4>
              {g.items.map((s, i) => (
                <button
                  key={s.id}
                  className="pindex-item"
                  onClick={() => go(s.id)}
                  style={
                    s.id === currentId
                      ? { borderColor: "var(--acc)", color: "var(--ink)" }
                      : undefined
                  }
                >
                  <span className="n">{String(i + 1).padStart(2, "0")}</span>
                  {s.title}
                  <span className="arr">›</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
