import { useEffect, useState } from "react";

/** True while the viewport matches the query; updates as the window is resized or rotated. */
export function useMedia(query: string): boolean {
  const get = () => typeof window !== "undefined" && "matchMedia" in window && window.matchMedia(query).matches;
  const [matches, setMatches] = useState<boolean>(get);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return matches;
}
