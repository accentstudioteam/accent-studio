import { useEffect, useRef, useState, type MouseEvent } from "react";

const clock = (s: number): string => {
  const safe = Number.isFinite(s) && s > 0 ? s : 0;
  return `${Math.floor(safe / 60)}:${Math.floor(safe % 60).toString().padStart(2, "0")}`;
};

interface VoiceNoteProps {
  src: string | null;
  seconds: number;
  tone: "me" | "them";
}

/** A voice note inside a chat bubble: play or pause, a bar you can tap to seek, and the time. Only one note plays at a time. */
export function VoiceNote({ src, seconds, tone }: VoiceNoteProps) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [at, setAt] = useState(0);
  const [duration, setDuration] = useState(seconds);

  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    const onTime = () => setAt(a.currentTime);
    const onMeta = () => {
      if (Number.isFinite(a.duration)) setDuration(a.duration);
    };
    const onEnd = () => {
      setIsPlaying(false);
      setAt(0);
    };
    const onPlay = () => {
      setIsPlaying(true);
      document.querySelectorAll("audio").forEach((other) => {
        if (other !== a && !other.paused) other.pause();
      });
    };
    const onPause = () => setIsPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnd);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
    };
  }, [src]);

  const toggle = () => {
    const a = ref.current;
    if (!a) return;
    if (a.paused) void a.play().catch(() => setIsPlaying(false));
    else a.pause();
  };
  const seek = (e: MouseEvent<HTMLDivElement>) => {
    const a = ref.current;
    if (!a || !duration) return;
    const box = e.currentTarget.getBoundingClientRect();
    a.currentTime = Math.max(0, Math.min(1, (e.clientX - box.left) / box.width)) * duration;
  };

  if (!src) return <div className={`vnote ${tone}`}><span className="vtime">Loading…</span></div>;
  const pct = duration ? Math.min(100, (at / duration) * 100) : 0;
  return (
    <div className={`vnote ${tone}`}>
      <audio ref={ref} src={src} preload="metadata" />
      <button type="button" className="vplay" onClick={toggle} aria-label={isPlaying ? "Pause" : "Play"}>
        {isPlaying ? (
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><rect x="2" y="1.5" width="3.6" height="11" rx="1" fill="currentColor" /><rect x="8.4" y="1.5" width="3.6" height="11" rx="1" fill="currentColor" /></svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3.5 1.8v10.4c0 .8.9 1.3 1.6.9l8-5.2c.6-.4.6-1.4 0-1.8l-8-5.2c-.7-.4-1.6.1-1.6.9z" fill="currentColor" /></svg>
        )}
      </button>
      <div className="vbar" onClick={seek} role="slider" aria-label="Position" aria-valuemin={0} aria-valuemax={Math.round(duration)} aria-valuenow={Math.round(at)}>
        <div className="vfill" style={{ width: `${pct}%` }} />
        <div className="vknob" style={{ left: `${pct}%` }} />
      </div>
      <span className="vtime">{isPlaying || at > 0 ? clock(at) : clock(duration)}</span>
    </div>
  );
}
