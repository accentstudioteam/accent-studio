import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderStatus = "idle" | "requesting" | "recording" | "done" | "error";

const CANDIDATE_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];
const LEVEL_HISTORY = 28;

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  return CANDIDATE_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

function friendlyError(e: unknown): string {
  const name = (e as { name?: string })?.name ?? "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Microphone permission was refused. Allow the mic for this site and try again.";
  }
  if (name === "NotFoundError") return "No microphone was found on this device.";
  if (typeof MediaRecorder === "undefined") return "This browser can't record audio. Try Chrome or Safari.";
  return "Recording didn't start. Check the mic and try again.";
}

/** Browser-native audio capture with a running timer, live input levels, and a playable result. */
export function useRecorder(maxSeconds = 60) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [mime, setMime] = useState("audio/webm");
  const [error, setError] = useState<string | null>(null);
  /** Rolling input level history, 0..1, newest last. Empty unless recording. */
  const [levels, setLevels] = useState<number[]>([]);

  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const startedAtRef = useRef(0);
  const urlRef = useRef<string | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const stopMeter = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
  };

  /**
   * Phone microphones are quiet once the browser's automatic gain is off, so the mic
   * runs through our own chain: a fixed boost, a gentle compressor that evens out loud
   * and soft passages, and a limiter that stops peaks from distorting. The recorder and
   * the level meter both read the processed signal. Returns null if Web Audio is unavailable,
   * in which case the raw stream is recorded.
   */
  const buildChain = (stream: MediaStream): { processed: MediaStream; analyser: AnalyserNode } | null => {
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      void ctx.resume().catch(() => undefined);
      const src = ctx.createMediaStreamSource(stream);
      const pre = ctx.createGain();
      pre.gain.value = 3.2; // about +10 dB
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -24;
      comp.knee.value = 12;
      comp.ratio.value = 4;
      comp.attack.value = 0.003;
      comp.release.value = 0.25;
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -4;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.001;
      limiter.release.value = 0.08;
      const post = ctx.createGain();
      post.gain.value = 1.15;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      const dest = ctx.createMediaStreamDestination();
      src.connect(pre);
      pre.connect(comp);
      comp.connect(limiter);
      limiter.connect(post);
      post.connect(analyser);
      post.connect(dest);
      return { processed: dest.stream, analyser };
    } catch {
      return null;
    }
  };

  const startMeter = (analyser: AnalyserNode) => {
    try {
      const buf = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        const level = Math.min(1, rms * 2.4);
        setLevels((prev) => [...prev.slice(-(LEVEL_HISTORY - 1)), level]);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      // metering is cosmetic; recording continues without it
    }
  };

  const stop = useCallback(() => {
    clearTimer();
    const rec = recRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setStatus("requesting");
    try {
      // Raw capture. The browser's speech-call processing (echo cancellation, noise
      // suppression, automatic gain) is tuned for phone calls and makes voices sound
      // muffled and pumped; for a voice assessment we want the microphone as it is.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1, sampleRate: 48000 },
      });
      streamRef.current = stream;
      const chain = buildChain(stream);
      const source = chain ? chain.processed : stream;
      const type = pickMimeType();
      const rec = type ? new MediaRecorder(source, { mimeType: type, audioBitsPerSecond: 128_000 }) : new MediaRecorder(source, { audioBitsPerSecond: 128_000 });
      recRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      rec.onstop = () => {
        stopMeter();
        const finalType = rec.mimeType || type || "audio/webm";
        const out = new Blob(chunksRef.current, { type: finalType });
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        const objectUrl = URL.createObjectURL(out);
        urlRef.current = objectUrl;
        setMime(finalType);
        setBlob(out);
        setUrl(objectUrl);
        setSeconds(Math.round(((Date.now() - startedAtRef.current) / 1000) * 10) / 10);
        setLevels([]);
        setStatus("done");
      };
      rec.start(250);
      startedAtRef.current = Date.now();
      setSeconds(0);
      setLevels([]);
      setStatus("recording");
      if (chain) startMeter(chain.analyser);
      timerRef.current = window.setInterval(() => {
        const s = (Date.now() - startedAtRef.current) / 1000;
        setSeconds(Math.floor(s));
        if (s >= maxSeconds) stop();
      }, 200);
    } catch (e) {
      setStatus("error");
      setError(friendlyError(e));
    }
  }, [maxSeconds, stop]);

  const reset = useCallback(() => {
    clearTimer();
    stopMeter();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setBlob(null);
    setUrl(null);
    setSeconds(0);
    setLevels([]);
    setError(null);
    setStatus("idle");
  }, []);

  useEffect(() => {
    return () => {
      clearTimer();
      stopMeter();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  return { status, seconds, blob, url, mime, error, levels, start, stop, reset };
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
