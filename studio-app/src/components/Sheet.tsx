import type { ReactNode } from "react";

interface SheetProps {
  title: string;
  live?: boolean;
  accent?: "mint" | "gold";
  children: ReactNode;
}

/**
 * The outer sheet card: handle bar + centered mono header + stacked tiles.
 * This is the atomic surface for every screen in the app.
 */
export function Sheet({ title, live = true, accent = "mint", children }: SheetProps) {
  return (
    <div className="sheet">
      <div className="handle" />
      <div className="shead">
        {live && <i className={accent === "gold" ? "g" : undefined} />}
        {title}
      </div>
      {children}
    </div>
  );
}

interface TileProps {
  label?: string;
  variant?: "plain" | "acc" | "dash";
  children: ReactNode;
}

export function Tile({ label, variant = "plain", children }: TileProps) {
  const cls = variant === "acc" ? "tile acc" : variant === "dash" ? "tile dash" : "tile";
  return (
    <div className={cls}>
      {label && <div className="tlbl">{label}</div>}
      {children}
    </div>
  );
}

/** Vertical-bar waveform. `played` bars render solid, the rest muted. */
export function Waveform({ bars, played }: { bars: number[]; played: number }) {
  return (
    <div className="wv">
      {bars.map((h, i) => (
        <i key={i} className={i >= played ? "mu" : undefined} style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}
