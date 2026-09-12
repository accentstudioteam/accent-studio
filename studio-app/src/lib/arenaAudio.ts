// Microphone capture for a live scene: the same raw chain as the recorder (no browser call processing,
// a fixed boost, a gentle compressor, a limiter), exposed as a stream for the call and recorded locally
// at the same time, so each speaker's track is clean and separate.
export interface ArenaMic {
  stream: MediaStream;
  level: () => number;
  startRecording: () => void;
  stopRecording: () => Promise<{ blob: Blob; mime: string; seconds: number }>;
  close: () => void;
}

function pickMime(): string | undefined {
  const cands = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return cands.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t));
}

export async function openArenaMic(): Promise<ArenaMic> {
  const raw = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1, sampleRate: 48000 },
  });
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  let stream = raw;
  let analyser: AnalyserNode | null = null;
  let ctx: AudioContext | null = null;
  if (Ctx) {
    ctx = new Ctx();
    void ctx.resume().catch(() => undefined);
    const src = ctx.createMediaStreamSource(raw);
    const pre = ctx.createGain();
    pre.gain.value = 3.2;
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
    analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    const dest = ctx.createMediaStreamDestination();
    src.connect(pre);
    pre.connect(comp);
    comp.connect(limiter);
    limiter.connect(post);
    post.connect(analyser);
    post.connect(dest);
    stream = dest.stream;
  }
  const buf = analyser ? new Uint8Array(analyser.fftSize) : null;
  const level = () => {
    if (!analyser || !buf) return 0;
    analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128;
      sum += v * v;
    }
    return Math.min(1, Math.sqrt(sum / buf.length) * 2.4);
  };

  let rec: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let startedAt = 0;
  const mime = pickMime();
  return {
    stream,
    level,
    startRecording: () => {
      chunks = [];
      rec = mime ? new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 128_000 }) : new MediaRecorder(stream, { audioBitsPerSecond: 128_000 });
      rec.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunks.push(ev.data);
      };
      rec.start(1000);
      startedAt = Date.now();
    },
    stopRecording: () =>
      new Promise((resolve) => {
        const r = rec;
        if (!r || r.state === "inactive") return resolve({ blob: new Blob(chunks, { type: mime ?? "audio/webm" }), mime: mime ?? "audio/webm", seconds: Math.round(((Date.now() - startedAt) / 1000) * 10) / 10 });
        r.onstop = () => resolve({ blob: new Blob(chunks, { type: r.mimeType || mime || "audio/webm" }), mime: r.mimeType || mime || "audio/webm", seconds: Math.round(((Date.now() - startedAt) / 1000) * 10) / 10 });
        r.stop();
      }),
    close: () => {
      try {
        rec?.state !== "inactive" && rec?.stop();
      } catch {
        // already stopped
      }
      raw.getTracks().forEach((t) => t.stop());
      void ctx?.close().catch(() => undefined);
    },
  };
}
