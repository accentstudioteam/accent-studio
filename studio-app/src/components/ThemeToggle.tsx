import { useEffect, useState } from "react";
import { readTheme, setTheme, systemPrefersDark, type Theme } from "@/lib/theme";

/* A three-way segmented control: System, Light, Dark. Built from the chip
   recipe both skins already have, so it sits naturally in the player's You
   screen and the Studio's Settings alike. */
const OPTIONS: { key: Theme; label: string }[] = [
  { key: "system", label: "System" },
  { key: "light", label: "Light" },
  { key: "dark", label: "Dark" },
];

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setLocal] = useState<Theme>(() => readTheme());
  const [sysDark, setSysDark] = useState(() => systemPrefersDark());

  // Keep the "System" hint honest if the device flips while the screen is open.
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const on = () => setSysDark(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const pick = (t: Theme) => {
    setTheme(t);
    setLocal(t);
  };

  return (
    <div className="chips" role="radiogroup" aria-label="Appearance">
      {OPTIONS.map((o) => {
        const on = theme === o.key;
        const hint = o.key === "system" && !compact ? ` · ${sysDark ? "dark now" : "light now"}` : "";
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={on}
            className={`chip${on ? " chip-mint on" : ""}`}
            onClick={() => pick(o.key)}
          >
            {o.label}
            {hint}
          </button>
        );
      })}
    </div>
  );
}
