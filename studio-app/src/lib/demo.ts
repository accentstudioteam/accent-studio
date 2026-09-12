// Demo mode: the real screens on an in-memory backend with a simulated partner.
// Nothing is saved. Active when the page carries ?demo=player or window.ACCENT_DEMO is set
// (the chat artifact sets it). Partner turns use the founders' recorded scene clips.
import type { Rally, RallySummary, RallyTurn } from "@/lib/game";
import type { Onboarding } from "@/lib/types";

declare global {
  interface Window {
    ACCENT_DEMO?: string;
    ACCENT_DEMO_CLIPS?: Record<string, string>;
  }
}

export function isDemo(): boolean {
  if (typeof window === "undefined") return false;
  if (window.ACCENT_DEMO) return true;
  return new URLSearchParams(window.location.search).get("demo") === "player";
}

const ME = "spk_pcm_ng_48213";
const PARTNER = "spk_pcm_ng_77104";
const TURNS_TARGET = 6;
const PARTNER_CLIPS = ["scene_mkt_02", "scene_mkt_04", "scene_mkt_06", "scene_bank_02", "scene_bank_04"];
const SAMPLE_TAKES = ["scene_mkt_01", "scene_mkt_03", "scene_mkt_05", "scene_bank_01", "scene_bank_03", "scene_bank_05"];

const CARDS = [
  { id: "c1", title: "Market Day", situation: "Na market day. Tomato don cost. Customer wan price am down, seller no gree.", persona_a: "Buyer wey like to play and haggle. E get small money, e no wan pay too much.", persona_b: "Seller wey stand for e price, but e like this customer and e no wan lose am.", domain: "retail_market_haggle" },
  { id: "c2", title: "Banking Wahala", situation: "Money don comot for your account wey you no spend. Na POS transaction wey you no know. You call the bank customer care.", persona_a: "Customer wey vex well well. E wan make dem return the money today today.", persona_b: "Bank agent wey calm. E wan help, but e must follow process before e fit block anything.", domain: "retail_banking_fraud" },
  { id: "c3", title: "Telco Trouble", situation: "Your data bundle don finish overnight, and you no even use am. You call customer care.", persona_a: "Subscriber wey confuse and vex small. E wan know where the data go.", persona_b: "Customer care person wey dey try explain the plan and offer something.", domain: "telco_support" },
];

interface DemoTurn extends RallyTurn {
  url: string;
}
interface DemoSession {
  id: string;
  card: (typeof CARDS)[number];
  status: Rally["status"];
  has_partner: boolean;
  turn_count: number;
  next: "me" | "partner" | null;
  turns: DemoTurn[];
  updated_at: string;
  lowRatingGiven: boolean;
  due_at: string | null;
  quietPartner: boolean;
  abandoned_reason: "partner_quiet" | null;
  flags: string[];
}

const state: { sessions: DemoSession[]; blobs: Record<string, string>; timers: number[] } = { sessions: [], blobs: {}, timers: [] };
let counter = 0;
const now = () => new Date().toISOString();

function clipUrl(name: string): string {
  const inline = window.ACCENT_DEMO_CLIPS?.[name];
  return inline ?? `${window.location.origin}/audio/${name}.mp3`;
}

export function demoSampleTake(): { url: string; seconds: number } {
  const name = SAMPLE_TAKES[counter % SAMPLE_TAKES.length];
  return { url: clipUrl(name), seconds: 6 };
}

export const demoOnboarding: Onboarding = {
  invited: false,
  invitation: null,
  contributor: { speaker_id: ME, primary_language: "pcm", languages: ["pcm"], withdrawn_at: null },
  consent: { agreement_version: "1.2", agreement_sha256: "48ff6cdd711040ed76709162c9a3ad45a88c67ca6a6b1b6dcdfc07db883497d1", signed_at: now(), record_sha256: "8d4c1f0a9e2b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d", withdrawn_at: null },
  agreement: { version: "1.2", document_id: "ASC-CA-1.2", effective_date: "2026-09-12", sha256: "48ff6cdd711040ed76709162c9a3ad45a88c67ca6a6b1b6dcdfc07db883497d1", url: "https://accentstudio.io/legal/Accent_Studio_Contributor_Agreement_v1.2.pdf", active: true },
};

function latestByTurn(s: DemoSession): DemoTurn[] {
  const map = new Map<number, DemoTurn>();
  for (const t of s.turns) if (!map.has(t.turn_no) || map.get(t.turn_no)!.attempt < t.attempt) map.set(t.turn_no, t);
  return [...map.values()].sort((a, b) => a.turn_no - b.turn_no);
}

function summary(s: DemoSession): RallySummary {
  const oweRating = latestByTurn(s).some((t) => !t.mine && t.status === "recorded");
  return {
    session_id: s.id,
    status: s.status,
    title: s.card.title,
    language: "pcm",
    turn_count: s.turn_count,
    turns_target: TURNS_TARGET,
    updated_at: s.updated_at,
    my_turn: s.status !== "complete" && s.status !== "abandoned" && (s.next === "me" || oweRating),
    waiting_for_partner: s.status === "waiting" && s.turn_count >= 1,
    due_at: s.due_at,
    abandoned_reason: s.abandoned_reason,
  };
}

export const demo = {
  mySessions: async (): Promise<RallySummary[]> => {
    for (const s of state.sessions) await demo.loadRally(s.id); // applies the reply-window sweep
    return state.sessions.map(summary).sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
  },

  startRally: async (): Promise<{ session_id: string; joined: boolean }> => {
    const open = state.sessions.find((s) => s.status === "waiting" || s.status === "active");
    if (open) return { session_id: open.id, joined: false };
    // every second rally in the demo gets a partner who goes quiet, to show the closure
    const s: DemoSession = { id: `demo-${++counter}`, card: CARDS[(counter - 1) % CARDS.length], status: "waiting", has_partner: false, turn_count: 0, next: "me", turns: [], updated_at: now(), lowRatingGiven: false, due_at: null, quietPartner: counter % 2 === 0, abandoned_reason: null, flags: [] };
    state.sessions.unshift(s);
    return { session_id: s.id, joined: false };
  },

  loadRally: async (id: string): Promise<Rally> => {
    const s = state.sessions.find((x) => x.id === id);
    if (!s) throw new Error("not your rally");
    // the demo's reply window is 12 seconds instead of 24 hours
    if (s.status === "active" && s.next === "partner" && s.due_at && new Date(s.due_at).getTime() < Date.now()) {
      s.status = "abandoned";
      s.abandoned_reason = "partner_quiet";
      s.next = null;
      s.due_at = null;
      s.updated_at = now();
    }
    const latest = latestByTurn(s);
    const partnerUnrated = [...latest].reverse().find((t) => !t.mine && t.status === "recorded");
    const redo = [...latest].reverse().find((t) => t.mine && t.status === "redo");
    const oweRating = Boolean(partnerUnrated);
    return {
      session_id: s.id,
      status: s.status,
      language: "pcm",
      turn_count: s.turn_count,
      turns_target: TURNS_TARGET,
      card: { title: s.card.title, situation: s.card.situation, persona: s.card.persona_a, partner_persona: s.card.persona_b, audio_path: null, domain: s.card.domain },
      my_speaker_id: ME,
      i_am: "a",
      has_partner: s.has_partner,
      my_turn: s.status !== "complete" && s.status !== "abandoned" && s.next === "me" && !oweRating,
      owe_rating: oweRating && s.status !== "abandoned",
      rate_turn_id: partnerUnrated?.turn_id ?? null,
      redo: Boolean(redo),
      next_turn_no: redo ? redo.turn_no : s.turn_count + 1,
      next_attempt: redo ? redo.attempt + 1 : 1,
      max_turn_seconds: 30,
      due_at: s.due_at,
      i_owe: s.next === "me",
      abandoned_reason: s.abandoned_reason,
      flags: s.flags,
      turns: latest.map(({ url: _url, ...t }) => t),
    };
  },

  /** The "upload": remember the blob URL under the path the real app would use. */
  storeBlob: (path: string, url: string) => {
    state.blobs[path] = url;
  },

  submitTurn: async (id: string, path: string, seconds: number): Promise<void> => {
    const s = state.sessions.find((x) => x.id === id);
    if (!s) throw new Error("not your rally");
    const r = await demo.loadRally(id);
    if (!r.my_turn) throw new Error("not your turn");
    const url = state.blobs[path] ?? demoSampleTake().url;
    s.turns.push({ turn_id: `t-${s.id}-${r.next_turn_no}-${r.next_attempt}`, turn_no: r.next_turn_no, attempt: r.next_attempt, mine: true, audio_path: path, seconds, status: "recorded", created_at: now(), rating: null, url });
    s.turn_count = Math.max(s.turn_count, r.next_turn_no);
    s.next = "partner";
    s.due_at = new Date(Date.now() + (s.quietPartner ? 12_000 : 24 * 3600_000)).toISOString();
    s.updated_at = now();
    if (s.quietPartner && s.has_partner) return; // the quiet partner never replies
    schedulePartner(s);
  },

  rateTurn: async (turnId: string, r: { tone: number; prompt_adherence: number; mood: number; clarity: number }) => {
    const s = state.sessions.find((x) => x.turns.some((t) => t.turn_id === turnId));
    const t = s?.turns.find((x) => x.turn_id === turnId);
    if (!s || !t || t.mine || t.status !== "recorded") throw new Error("you cannot rate this turn");
    const aggregate = (r.tone + r.prompt_adherence + r.mood + r.clarity) / 4;
    t.rating = { ...r, aggregate };
    const redo = aggregate < 4 && t.attempt < 3;
    t.status = redo ? "redo" : "rated";
    s.updated_at = now();
    if (redo) {
      s.next = "partner";
      schedulePartner(s, true);
      return { aggregate, redo: true, complete: false };
    }
    const complete = s.turn_count >= TURNS_TARGET && latestByTurn(s).every((x) => x.status !== "recorded");
    if (complete) {
      s.status = "complete";
      s.next = null;
      s.due_at = null;
    } else {
      s.next = "me";
      s.due_at = new Date(Date.now() + 24 * 3600_000).toISOString();
    }
    return { aggregate, redo: false, complete };
  },

  turnUrl: async (path: string): Promise<string | null> => {
    for (const s of state.sessions) for (const t of s.turns) if (t.audio_path === path) return t.url;
    return state.blobs[path] ?? null;
  },

  reset: () => {
    state.timers.forEach(clearTimeout);
    state.sessions = [];
    state.blobs = {};
  },
};

/** The simulated partner: joins, rates your latest take (once deliberately below 4 to show the redo), then records a reply. */
function schedulePartner(s: DemoSession, redoOnly = false) {
  const later = (ms: number, fn: () => void) => state.timers.push(window.setTimeout(fn, ms));
  later(2600, () => {
    if (!s.has_partner) s.has_partner = true;
    s.status = "active";
    // rate my latest recorded take
    const mine = [...latestByTurn(s)].reverse().find((t) => t.mine && t.status === "recorded");
    if (mine) {
      const low = !s.lowRatingGiven && mine.turn_no === 3 && mine.attempt === 1;
      const score = low ? { tone: 4, prompt_adherence: 3, mood: 4, clarity: 3 } : { tone: 5, prompt_adherence: 4, mood: 5, clarity: 4 };
      mine.rating = { ...score, aggregate: (score.tone + score.prompt_adherence + score.mood + score.clarity) / 4 };
      mine.status = low ? "redo" : "rated";
      if (low) s.lowRatingGiven = true;
      s.updated_at = now();
      if (low) {
        s.next = "me";
        return;
      }
    }
    if (redoOnly) {
      // partner re-records the turn I asked them to redo
      const theirs = [...latestByTurn(s)].reverse().find((t) => !t.mine && t.status === "redo");
      if (theirs) {
        s.turns.push({ ...theirs, turn_id: `${theirs.turn_id}-a${theirs.attempt + 1}`, attempt: theirs.attempt + 1, status: "recorded", rating: null, created_at: now(), url: clipUrl(PARTNER_CLIPS[(theirs.turn_no + 1) % PARTNER_CLIPS.length]) });
        s.next = "me";
        s.updated_at = now();
      }
      return;
    }
    if (s.turn_count >= TURNS_TARGET) {
      s.status = latestByTurn(s).every((x) => x.status !== "recorded") ? "complete" : s.status;
      if (s.status === "complete") s.next = null;
      return;
    }
    later(2400, () => {
      const no = s.turn_count + 1;
      const clip = PARTNER_CLIPS[(no / 2 - 1) % PARTNER_CLIPS.length] ?? PARTNER_CLIPS[0];
      s.turns.push({ turn_id: `t-${s.id}-${no}-1`, turn_no: no, attempt: 1, mine: false, audio_path: `${s.id}/turn-${no}-a1-${PARTNER}.mp3`, seconds: 7, status: "recorded", created_at: now(), rating: null, url: clipUrl(clip) });
      s.turn_count = no;
      s.next = "me";
      s.due_at = new Date(Date.now() + 24 * 3600_000).toISOString();
      s.updated_at = now();
    });
  });
}
