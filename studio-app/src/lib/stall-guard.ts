/* ============================================================================
   Keep a voice note playing when the file does not say how long it is.

   MediaRecorder streams, so it never wrote a Duration into the WebM header.
   Verified in-browser with this app's own recorder options: duration comes
   back Infinity. The browser therefore does not know where the file ends,
   runs to the edge of what it has buffered, and stops producing audio without
   firing `ended` and without setting `paused`. The note looks like it is still
   playing and is simply silent. Pressing play again works, because by then the
   file is in cache. Longer takes hit it far more often.

   The recorder writes a real duration now, so files made from today are fine.
   Everything recorded before that is not, and a contributor cannot record it
   again, so playback has to cope.

   This watches currentTime rather than trusting any event, because the failure
   mode is precisely that no event arrives.
   ========================================================================= */
import { useEffect, useRef, type RefObject } from "react";

const TICK_MS = 400;
const PATIENCE_MS = 1_400;
const PATIENCE_AFTER_DRY_MS = 700;
const DRY_WINDOW_MS = 3_000;
const MAX_NUDGES = 5;

interface Options {
  /** True while the note claims to be playing; the guard only runs then. */
  playing: boolean;
  /** The real length, from the database. Never read `duration`: it is Infinity. */
  seconds: number;
  /** Called when the guard concludes the take is over or unrecoverable. */
  onStopped?: () => void;
}

export function useStallGuard(ref: RefObject<HTMLAudioElement | null>, { playing, seconds, onStopped }: Options): void {
  const dry = useRef(0);

  // `waiting` and `stalled` mean the buffer ran out. That is not proof of a
  // stall, only of rebuffering, so it just shortens how long we wait.
  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    const onDry = () => {
      dry.current = Date.now();
    };
    a.addEventListener("waiting", onDry);
    a.addEventListener("stalled", onDry);
    return () => {
      a.removeEventListener("waiting", onDry);
      a.removeEventListener("stalled", onDry);
    };
  }, [ref]);

  useEffect(() => {
    if (!playing) return;
    let seen = -1;
    let since = Date.now();
    let nudges = 0;

    const id = window.setInterval(() => {
      const a = ref.current;
      if (!a || a.paused) return;

      // Still moving: healthy. A note that reaches its own end this way ends
      // on the element's own `ended` event, untouched.
      if (a.currentTime > seen + 0.05) {
        seen = a.currentTime;
        since = Date.now();
        nudges = 0;
        return;
      }

      const patience = Date.now() - dry.current < DRY_WINDOW_MS ? PATIENCE_AFTER_DRY_MS : PATIENCE_MS;
      if (Date.now() - since < patience) return;

      // Stopped at the length the database recorded: the take is simply over,
      // `ended` or no `ended`. load() rewinds to the top, because seeking needs
      // a duration these files do not carry.
      if (seconds > 0 && a.currentTime >= seconds - 0.3) {
        a.pause();
        a.load();
        onStopped?.();
        return;
      }

      since = Date.now();
      nudges += 1;
      if (nudges > MAX_NUDGES) {
        // It will not play. Stop claiming otherwise.
        a.pause();
        onStopped?.();
        return;
      }
      // A soft nudge first; from the third, take it down and bring it back up,
      // which shakes a wedged fetch loose.
      if (nudges >= 3) a.pause();
      void a.play().catch(() => {});
    }, TICK_MS);

    return () => window.clearInterval(id);
  }, [playing, seconds, ref, onStopped]);
}
