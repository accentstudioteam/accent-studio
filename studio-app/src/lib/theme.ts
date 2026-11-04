/* ============================================================================
   Appearance: system, light or dark.

   The stylesheet already understands a manual override. Dark is selected by
   `:root[data-theme="dark"]`, and the system-dark media rule is guarded with
   `:root:not([data-theme="light"])`, so setting the attribute to "light" holds
   light on a dark phone and "dark" holds dark on a light one. Removing it hands
   the choice back to the device. Nothing in the app set it until now.

   Applied at boot, before React renders, so the first paint is already right.
   ========================================================================= */

export type Theme = "system" | "light" | "dark";

const KEY = "accent:theme";

export function readTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
}

export function setTheme(theme: Theme): void {
  try {
    if (theme === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    /* private mode or blocked storage: still apply for this visit */
  }
  applyTheme(theme);
}

/** What the device itself is asking for, for the "System" label. */
export function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-color-scheme: dark)").matches;
}
