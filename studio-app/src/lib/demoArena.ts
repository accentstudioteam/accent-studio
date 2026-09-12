// The booth and a live scene on an in-memory backend, with time compressed: a booking on a slot where
// someone is waiting pairs at once and opens now, the partner arrives two seconds after you, the scene
// runs 45 seconds with two twists, and the partner "speaks" with the founders' clips. No microphone.
import type { Availability, ArenaConfig, BookResult, Booking, Mine, Scene, Twist } from "@/lib/arena";

const PARTNER = "spk_pcm_ng_77104";
const ME = "spk_pcm_ng_48213";
const CFG: ArenaConfig = { slot_minutes: 15, scene_seconds: 45, hours: { from: 8, to: 22 }, book_ahead_minutes: 60, max_upcoming: 3, reschedule_cutoff_hours: 2, cancel_cutoff_hours: 2, open_before_minutes: 5, join_grace_minutes: 10, strikes_to_pause: 3, pause_days: 14, showed_up_credit_minutes: 5, timezone: "Africa/Lagos" };
const TWISTS: Twist[] = [
  { at_seconds: 15, text: "Twist: your phone dey ring. Answer am small, then come back to the matter." },
  { at_seconds: 30, text: "Twist: the other person just mention money wey you no expect. React to am." },
];
const now = () => new Date().toISOString();
const daysFromNow = (d: number, h: number, m: number) => {
  const t = new Date();
  t.setUTCDate(t.getUTCDate() + d);
  t.setUTCHours(h - 1, m, 0, 0); // Lagos wall clock
  return t;
};

interface DemoBooking extends Booking {
  paired_now: boolean;
}
interface DemoScene {
  session_id: string;
  starts_at: string;
  started_at: string | null;
  ended_at: string | null;
  partner_joined: boolean;
  my_joined: boolean;
  my_track: { turn_id: string; seconds: number } | null;
  partner_track: { turn_id: string; seconds: number; rated: boolean } | null;
  status: Scene["status"];
  chemistry: number | null;
}

const state: { bookings: DemoBooking[]; scenes: Record<string, DemoScene>; waiting: Set<string>; strikes: number; seq: number } = { bookings: [], scenes: {}, waiting: new Set(), strikes: 0, seq: 0 };

function seed() {
  if (state.waiting.size) return;
  // a few slots where another player is already waiting, tomorrow and the day after
  for (const [d, h, m] of [[1, 18, 30], [1, 19, 0], [2, 9, 15], [2, 20, 45]] as [number, number, number][]) state.waiting.add(daysFromNow(d, h, m).toISOString());
  state.bookings.push({ slot_id: "demo-b0", starts_at: daysFromNow(-3, 19, 0).toISOString(), status: "done", session_id: "demo-live-0", session_status: "complete", paired_now: false });
}

export const demoArena = {
  mine: async (): Promise<Mine> => {
    seed();
    const upcoming = state.bookings.filter((b) => b.status === "open" || b.status === "paired").map((b) => ({ ...b, can_join: b.status === "paired" && b.paired_now }));
    const past = state.bookings.filter((b) => b.status !== "open" && b.status !== "paired");
    return { config: CFG, strikes: state.strikes, paused_until: null, languages: ["pcm"], upcoming, past };
  },

  availability: async (_lang: string, from: Date, to: Date): Promise<Availability[]> => {
    seed();
    return [...state.waiting].filter((iso) => new Date(iso) >= from && new Date(iso) <= to).map((iso) => ({ starts_at: iso, waiting: 1 }));
  },

  book: async (_lang: string, startsAt: Date): Promise<BookResult> => {
    seed();
    const iso = startsAt.toISOString();
    if (state.bookings.some((b) => b.starts_at === iso && (b.status === "open" || b.status === "paired"))) throw new Error("you already have that time");
    if (state.bookings.filter((b) => b.status === "open" || b.status === "paired").length >= CFG.max_upcoming) throw new Error(`you already hold ${CFG.max_upcoming} bookings; play one first`);
    const paired = state.waiting.has(iso);
    const slot_id = `demo-b${++state.seq}`;
    let session_id: string | null = null;
    if (paired) {
      state.waiting.delete(iso);
      session_id = `demo-live-${state.seq}`;
      // time is compressed in the demo: a paired scene opens right away
      state.scenes[session_id] = { session_id, starts_at: now(), started_at: null, ended_at: null, partner_joined: false, my_joined: false, my_track: null, partner_track: null, status: "waiting", chemistry: null };
    }
    state.bookings.unshift({ slot_id, starts_at: iso, status: paired ? "paired" : "open", language: "pcm", reschedule_count: 0, session_id, partner: paired ? PARTNER : null, session_status: paired ? "waiting" : null, paired_now: paired });
    return { slot_id, starts_at: iso, paired, session_id };
  },

  reschedule: async (slotId: string, startsAt: Date): Promise<BookResult> => {
    const b = state.bookings.find((x) => x.slot_id === slotId);
    if (!b || (b.status !== "open" && b.status !== "paired")) throw new Error("no such booking");
    if ((b.reschedule_count ?? 0) >= 1) throw new Error("a booking can be moved once; cancel it and book again instead");
    b.starts_at = startsAt.toISOString();
    b.reschedule_count = (b.reschedule_count ?? 0) + 1;
    b.status = "open";
    b.session_id = null;
    b.partner = null;
    b.paired_now = false;
    return { slot_id: slotId, starts_at: b.starts_at, paired: false, session_id: null };
  },

  cancel: async (slotId: string): Promise<{ strike: boolean }> => {
    const b = state.bookings.find((x) => x.slot_id === slotId);
    if (!b) throw new Error("no such booking");
    b.status = "cancelled";
    return { strike: false };
  },

  join: async (sid: string): Promise<Scene> => {
    const s = state.scenes[sid];
    if (!s) throw new Error("not your scene");
    if (!s.my_joined) {
      s.my_joined = true;
      window.setTimeout(() => {
        s.partner_joined = true;
        if (!s.started_at) {
          s.started_at = now();
          s.status = "active";
        }
      }, 2000);
    }
    return {
      session_id: sid, status: s.status, language: "pcm", me: "a", starts_at: s.starts_at, started_at: s.started_at, ended_at: s.ended_at, partner_joined: s.partner_joined, partner: PARTNER, my_speaker_id: ME,
      card: { title: "Banking Wahala", situation: "Money don comot for your account wey you no spend. Na POS transaction wey you no know. You call the bank customer care.", persona: "Customer wey vex well well. E wan make dem return the money today today.", partner_persona: "Bank agent wey calm. E wan help, but e must follow process before e fit block anything.", audio_path: null, domain: "retail_banking_fraud" },
      twists: TWISTS, scene_seconds: CFG.scene_seconds, my_track: s.my_track, partner_track: s.partner_track,
    };
  },

  finish: async (sid: string, _path: string, secs: number, chemistry: number): Promise<{ complete: boolean }> => {
    const s = state.scenes[sid];
    if (!s) throw new Error("not your scene");
    s.my_track = { turn_id: `${sid}-a`, seconds: secs };
    s.partner_track = { turn_id: `${sid}-b`, seconds: secs, rated: false };
    s.chemistry = chemistry;
    s.status = "complete";
    s.ended_at = now();
    const b = state.bookings.find((x) => x.session_id === sid);
    if (b) {
      b.status = "done";
      b.session_status = "complete";
    }
    return { complete: true };
  },

  rate: async (sid: string, _r: { tone: number; prompt_adherence: number; mood: number; clarity: number }): Promise<void> => {
    const s = state.scenes[sid];
    if (!s?.partner_track) throw new Error("your partner's track is not in yet");
    s.partner_track.rated = true;
  },

  reset: () => {
    state.bookings = [];
    state.scenes = {};
    state.waiting = new Set();
    state.strikes = 0;
    state.seq = 0;
  },
};
