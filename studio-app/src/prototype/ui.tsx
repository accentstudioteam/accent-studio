import type { ReactNode } from "react";

/** Flow-progress dots. `done` steps before `current` render filled-dim. */
export function Stepper({ total, current }: { total: number; current: number }) {
  return (
    <div className="stepper">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={"dot" + (i === current ? " on" : i < current ? " done" : "")}
        />
      ))}
    </div>
  );
}

export function CheckRow({
  checked,
  onToggle,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={"checkrow" + (checked ? " on" : "")}
      onClick={onToggle}
      style={{ width: "100%", textAlign: "left" }}
    >
      <span className="box">{checked ? "✓" : ""}</span>
      <span className="lbl">{children}</span>
    </button>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="eyebrow">{children}</div>;
}

/** Standard screen intro: eyebrow + big title + optional lede. */
export function ScreenHead({
  eyebrow,
  title,
  lede,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
}) {
  return (
    <div style={{ marginBottom: 22 }}>
      {eyebrow && <div className="eyebrow" style={{ marginBottom: 8 }}>{eyebrow}</div>}
      <h1 className="h1" style={{ marginBottom: lede ? 10 : 0 }}>
        {title}
      </h1>
      {lede && (
        <p className="muted" style={{ fontSize: "0.95rem" }}>
          {lede}
        </p>
      )}
    </div>
  );
}
