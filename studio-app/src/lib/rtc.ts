// The live call: two phones connected directly over WebRTC. Signalling (offer, answer, ICE) rides a
// Supabase Realtime channel; a local BroadcastChannel stands in for tests and the demo. A data channel
// carries small sync messages (levels, twist markers). Perfect-negotiation pattern, so either side
// may start and glare resolves itself.
import { supabase } from "@/lib/supabase";

export interface SignalMessage {
  from: string;
  kind: "description" | "candidate" | "sync" | "hello" | "bye";
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit | null;
  sync?: Record<string, unknown>;
}
export interface Signal {
  send(msg: SignalMessage): Promise<void> | void;
  onMessage(cb: (msg: SignalMessage) => void): void;
  close(): void;
}

/** Signalling over a Supabase Realtime broadcast channel scoped to the scene. */
export class SupabaseSignal implements Signal {
  private channel;
  private cbs: ((m: SignalMessage) => void)[] = [];
  readonly ready: Promise<void>;
  constructor(sessionId: string) {
    this.channel = supabase.channel(`arena:${sessionId}`, { config: { broadcast: { self: false, ack: true } } });
    this.channel.on("broadcast", { event: "signal" }, ({ payload }) => this.cbs.forEach((cb) => cb(payload as SignalMessage)));
    this.ready = new Promise((resolve, reject) => {
      this.channel.subscribe((status) => {
        if (status === "SUBSCRIBED") resolve();
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") reject(new Error(`signalling ${status}`));
      });
    });
  }
  async send(msg: SignalMessage) {
    await this.ready;
    await this.channel.send({ type: "broadcast", event: "signal", payload: msg });
  }
  onMessage(cb: (m: SignalMessage) => void) {
    this.cbs.push(cb);
  }
  close() {
    void supabase.removeChannel(this.channel);
  }
}

/** Signalling between two tabs of one browser, for tests and the demo. */
export class LocalSignal implements Signal {
  private bc: BroadcastChannel;
  private cbs: ((m: SignalMessage) => void)[] = [];
  constructor(name: string) {
    this.bc = new BroadcastChannel(`arena-local:${name}`);
    this.bc.onmessage = (ev) => this.cbs.forEach((cb) => cb(ev.data as SignalMessage));
  }
  send(msg: SignalMessage) {
    this.bc.postMessage(msg);
  }
  onMessage(cb: (m: SignalMessage) => void) {
    this.cbs.push(cb);
  }
  close() {
    this.bc.close();
  }
}

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}
export const DEFAULT_ICE: IceServer[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];

export interface CallEvents {
  onRemoteStream?: (stream: MediaStream) => void;
  onState?: (state: RTCPeerConnectionState | "connecting-signal") => void;
  onSync?: (data: Record<string, unknown>) => void;
  onPeerHello?: () => void;
  onPeerBye?: () => void;
}

/** One side of the call. `polite` decides who yields on glare; make speaker B polite. */
export class ArenaCall {
  private pc: RTCPeerConnection;
  private makingOffer = false;
  private ignoreOffer = false;
  private dc: RTCDataChannel | null = null;
  private readonly me: string;
  private closed = false;
  /** Every local candidate gathered so far, so a late-arriving peer can be sent the lot. */
  private localCandidates: (RTCIceCandidateInit | null)[] = [];
  /** Remote candidates that arrived before the remote description; applied once it lands. */
  private pending: RTCIceCandidateInit[] = [];

  constructor(private signal: Signal, private polite: boolean, me: string, private events: CallEvents = {}, ice: IceServer[] = DEFAULT_ICE) {
    this.me = me;
    this.pc = new RTCPeerConnection({ iceServers: ice });
    this.pc.onicecandidate = ({ candidate }) => {
      const c = candidate ? candidate.toJSON() : null;
      this.localCandidates.push(c);
      void this.signal.send({ from: this.me, kind: "candidate", candidate: c });
    };
    this.pc.onconnectionstatechange = () => this.events.onState?.(this.pc.connectionState);
    this.pc.ontrack = ({ streams, track }) => {
      const stream = streams[0] ?? new MediaStream([track]);
      this.events.onRemoteStream?.(stream);
    };
    this.pc.onnegotiationneeded = async () => {
      // The polite side never opens: it waits for the first offer. An offer collision makes Chromium roll back,
      // and after that rollback its ICE gathering restarts and yields nothing, so the call never connects.
      if (this.polite && !this.pc.remoteDescription) return;
      try {
        this.makingOffer = true;
        await this.pc.setLocalDescription();
        await this.signal.send({ from: this.me, kind: "description", description: this.plainLocal() });
      } catch (e) {
        console.warn("negotiation", e);
      } finally {
        this.makingOffer = false;
      }
    };
    this.pc.ondatachannel = ({ channel }) => this.attachData(channel);
    if (!polite) this.attachData(this.pc.createDataChannel("sync"));
    this.signal.onMessage((m) => void this.handle(m));
    this.events.onState?.("connecting-signal");
  }

  /** The local description as a plain object: platform objects do not survive structured clone or JSON on every path. */
  private plainLocal(): RTCSessionDescriptionInit {
    const d = this.pc.localDescription!;
    return { type: d.type, sdp: d.sdp };
  }

  private attachData(ch: RTCDataChannel) {
    this.dc = ch;
    ch.onmessage = (ev) => {
      try {
        this.events.onSync?.(JSON.parse(ev.data));
      } catch {
        // ignore malformed sync
      }
    };
  }

  /** Adds the local (processed) microphone stream to the call. Call once. */
  addStream(stream: MediaStream) {
    for (const track of stream.getAudioTracks()) this.pc.addTrack(track, stream);
  }

  hello() {
    void this.signal.send({ from: this.me, kind: "hello" });
  }

  /** Small sync messages: mic levels, twist reached, ready to end. Over the data channel when open, else signalling. */
  sync(data: Record<string, unknown>) {
    if (this.dc && this.dc.readyState === "open") this.dc.send(JSON.stringify(data));
    else void this.signal.send({ from: this.me, kind: "sync", sync: data });
  }

  private async handle(m: SignalMessage) {
    if (this.closed || m.from === this.me) return;
    try {
      if (m.kind === "hello") {
        this.events.onPeerHello?.();
        await this.reoffer();
        return;
      }
      if (m.kind === "bye") {
        this.events.onPeerBye?.();
        return;
      }
      if (m.kind === "sync" && m.sync) {
        this.events.onSync?.(m.sync);
        return;
      }
      if (m.kind === "description" && m.description) {
        const offerCollision = m.description.type === "offer" && (this.makingOffer || this.pc.signalingState !== "stable");
        this.ignoreOffer = !this.polite && offerCollision;
        if (this.ignoreOffer) return;
        await this.pc.setRemoteDescription(m.description);
        for (const c of this.pending.splice(0)) await this.pc.addIceCandidate(c).catch(() => undefined);
        if (m.description.type === "offer") {
          await this.pc.setLocalDescription();
          await this.signal.send({ from: this.me, kind: "description", description: this.plainLocal() });
        }
        return;
      }
      if (m.kind === "candidate") {
        if (!this.pc.remoteDescription) {
          if (m.candidate) this.pending.push(m.candidate);
          return;
        }
        try {
          await this.pc.addIceCandidate(m.candidate ?? undefined);
        } catch (e) {
          if (!this.ignoreOffer) throw e;
        }
      }
    } catch (e) {
      console.warn("rtc", e);
    }
  }

  /** The peer arrived after our offer went out (nobody was listening): send the offer and the candidates again. */
  private async reoffer() {
    if (this.polite || this.closed) return;
    if (this.pc.connectionState === "connected" || this.pc.connectionState === "connecting") return;
    if (this.pc.signalingState !== "have-local-offer" || !this.pc.localDescription) return;
    await this.signal.send({ from: this.me, kind: "description", description: this.plainLocal() });
    for (const c of this.localCandidates) await this.signal.send({ from: this.me, kind: "candidate", candidate: c });
  }

  get state(): RTCPeerConnectionState {
    return this.pc.connectionState;
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    void this.signal.send({ from: this.me, kind: "bye" });
    this.pc.getSenders().forEach((s) => s.track?.stop());
    this.pc.close();
    this.signal.close();
  }
}
