import type { ComponentType } from "react";

/** Navigation surface handed to every prototype screen. */
export interface Nav {
  /** Jump to a screen by id. */
  go: (id: string) => void;
  /** Go back to the previous screen in history. */
  back: () => void;
  /** Advance to the next screen in the registry order. */
  next: () => void;
  /** Open the full screen index. */
  openIndex: () => void;
  /** True if there is somewhere to go back to. */
  canBack: boolean;
}

export type Phase =
  | "Apply"
  | "Interview"
  | "Onboarding"
  | "Game"
  | "Economy"
  | "Account";

export interface ScreenDef {
  id: string;
  title: string;
  phase: Phase;
  Component: ComponentType<{ nav: Nav }>;
}
