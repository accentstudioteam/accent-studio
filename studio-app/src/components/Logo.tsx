import { ACCENT_D, LOCKUP_H, LOCKUP_W, MARK_D, MARK_H, MARK_W, STUDIO_D } from "./logo-paths";

type Tone = "dark" | "light" | "mono";

interface LogoProps {
  /** Rendered height in px. The wordmark's ink height equals the mark's height. */
  height?: number;
  /** dark: mint mark, cream "Accent", mint "Studio". light: ink + spruce. mono: currentColor. */
  tone?: Tone;
  /** Override the accent (mark + "Studio") colour, e.g. the labs amber. */
  accent?: string;
  className?: string;
  title?: string;
}

const TONES: Record<Tone, { mark: string; accent: string; studio: string }> = {
  dark: { mark: "#45e0a0", accent: "#f4eee1", studio: "#45e0a0" },
  light: { mark: "#0d0b08", accent: "#0d0b08", studio: "#0d4a3d" },
  mono: { mark: "currentColor", accent: "currentColor", studio: "currentColor" },
};

/** Icon + wordmark lockup. Outlined wordmark, so it never depends on font loading. */
export function Logo({ height = 22, tone = "dark", accent, className, title = "Accent Studio" }: LogoProps) {
  const c = TONES[tone];
  const markFill = accent ?? c.mark;
  const studioFill = accent ?? c.studio;
  const width = (height * LOCKUP_W) / LOCKUP_H;
  return (
    <svg
      viewBox={`0 0 ${LOCKUP_W} ${LOCKUP_H}`}
      width={width}
      height={height}
      role="img"
      aria-label={title}
      className={className}
      style={{ display: "block", flexShrink: 0 }}
    >
      <path fill={markFill} fillRule="evenodd" d={MARK_D} />
      <path fill={c.accent} d={ACCENT_D} />
      <path fill={studioFill} d={STUDIO_D} />
    </svg>
  );
}

/** The icon alone. */
export function Mark({ size = 24, color = "#45e0a0", className }: { size?: number; color?: string; className?: string }) {
  const width = (size * MARK_W) / MARK_H;
  return (
    <svg viewBox={`0 0 ${MARK_W} ${MARK_H}`} width={width} height={size} aria-hidden="true" className={className} style={{ display: "block", flexShrink: 0 }}>
      <path fill={color} fillRule="evenodd" d={MARK_D} />
    </svg>
  );
}
