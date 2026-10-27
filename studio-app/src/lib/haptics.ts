// Short vibrations for the four moments that earn one.
//
// Android only. iOS Safari ships no Vibration API, so every call here is a
// silent no-op for roughly a third of our contributors. A buzz is therefore
// never allowed to be the only signal for anything: it decorates a visual
// state, it does not carry one.
//
// The microphone hears the vibration motor. A buzz during capture would be
// recorded into the take and sold on inside the dataset, so callers must not
// fire while a take is recording. The only caller at risk is the poll that
// notices a partner's reply, and it checks before it buzzes.

type Pattern = number | number[];

const able = () => typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
const calm = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function buzz(p: Pattern): void {
  if (!able()) return;
  // Reduced motion keeps the confirmation but drops the celebration to one tap.
  const pattern = calm() && Array.isArray(p) ? 18 : p;
  try {
    navigator.vibrate(pattern);
  } catch {
    // A browser may refuse on a page that has seen no gesture. It is decoration; let it go.
  }
}

export const haptic = {
  /** A take left the phone. */
  sent: () => buzz(18),
  /** Four axes rated, mic handed back. */
  rated: () => buzz(18),
  /** The score card settled. Bands match the compliment copy. */
  score: (aggregate: number) => buzz(aggregate >= 4.75 ? [14, 55, 14, 55, 28] : aggregate >= 4 ? [14, 55, 14] : 18),
  /** A partner's reply arrived while the player was looking at the thread. */
  reply: () => buzz([12, 70, 12]),
};
