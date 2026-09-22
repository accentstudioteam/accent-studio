// Demo of the Cutting Room on an in-memory backend. Two finished rallies built from the
// founders' recorded clips, you as the editor, a second team member who signs decisions
// (clause 15: the person who raised a flag cannot decide it), and the contributor's view.
// Nothing is saved.
import { demo } from "@/lib/demo";
import type { Case, CaseEvent, CaseReason, Cases, Decision, EarningPost, MyCase, Queue, SaveTurnInput, Speaker, TurnVerification, VerifyResult, Workbench, WorkTurn } from "@/lib/verify";
import type { PayoutQueue, QueuedPayout } from "@/lib/earn";
import type { Delivery, ExportStep, Plan, Project, ProjectInput } from "@/lib/projects";
import type { AuditDone, AuditQueue, AuditResult } from "@/lib/admin";

/** What an English-trained Whisper typically makes of these clips: the draft the editor corrects. */
const DRAFTS: Record<string, string> = {
  scene_mkt_01: "Madam, how much for this basket of tomato? I beg, don't talk, say now two thousand naira, oh.",
  scene_mkt_02: "My friend, this one is fresh from farm this morning. Give me one thousand eight hundred.",
  scene_mkt_03: "Ah, it's too much, oh! Take one thousand two hundred, make I they go.",
  scene_mkt_04: "Eh! You don't turn market woman like me? Give me one thousand five hundred, now final price be that, oh!",
  scene_mkt_05: "One thousand three hundred! Last last, I no get change.",
  scene_mkt_06: "Okay, come collect them. Ah! You be strong customer, oh.",
  scene_bank_01: "Morning, oh. Now so I wake this morning, see say POS where I no use come out 50k for my account.",
  scene_bank_02: "Ah, we are sorry, sir. I beg, they calm, make I quick check your account.",
  scene_bank_03: "I beg, sharp sharp. I need my money back today, today!",
  scene_bank_04: "Oga, I they see three unauthorized transaction. I go block them now, make I run your refund.",
  scene_bank_05: "Sharp! Thank you. You don't save me plenty wahala today.",
};
const STT_NOTE = "English-trained model on Pidgin: expect English spellings and guessed words. Rewrite as spoken.";

/** What the gloss model makes of each machine draft: close, with the draft's errors carried in. */
const GLOSSES: Record<string, string> = {
  scene_mkt_01: "Madam, how much is this basket of tomatoes? Please, don't say two thousand naira.",
  scene_mkt_02: "My friend, these are fresh from the farm this morning. Give me one thousand eight hundred.",
  scene_mkt_03: "Ah, that's too much! Take one thousand two hundred and let me go.",
  scene_mkt_04: "Eh! Have you turned into a market woman like me? Give me one thousand five hundred, that is the final price!",
  scene_mkt_05: "One thousand three hundred! Final offer, I don't have change.",
  scene_mkt_06: "Okay, come and take them. Ah! You are a tough customer.",
  scene_bank_01: "Good morning. I woke up this morning and saw that a POS I never used took 50k out of my account.",
  scene_bank_02: "Ah, we are sorry, sir. Please stay calm, let me quickly check your account.",
  scene_bank_03: "Please, quickly. I need my money back today!",
  scene_bank_04: "Sir, I can see three unauthorised transactions. I will block them now and start your refund.",
  scene_bank_05: "Great! Thank you. You have saved me a lot of trouble today.",
};

/** Word error rate: word-level edit distance over the reference length. */
export function wer(ref: string, hyp: string): number {
  const words = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s'’-]/gu, " ").split(/\s+/).filter(Boolean);
  const r = words(ref);
  const h = words(hyp);
  if (r.length === 0) return h.length === 0 ? 0 : 1;
  let prev = Array.from({ length: h.length + 1 }, (_, j) => j);
  for (let i = 1; i <= r.length; i++) {
    const cur = [i];
    for (let j = 1; j <= h.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1));
    prev = cur;
  }
  return Math.round((prev[h.length] / r.length) * 1000) / 1000;
}

const ME = "edt_00108";
const OTHER = "edt_00417"; // "Ada", the second team member in the demo
const TIERS = [
  { tier: "platinum", min: 4.75, x: 1.2 },
  { tier: "gold", min: 4.25, x: 1.0 },
  { tier: "silver", min: 3.5, x: 0.7 },
  { tier: "floor", min: 0, x: 0.5 },
];
const WINDOW_DAYS = 7;

/** The founders' notes for each clip: what was said, as spoken, and an English gloss. */
export const NOTES: Record<string, { text: string; en: string }> = {
  scene_mkt_01: { text: "Madam, how much for dis basket of tomato? Abeg, no talk say na two thousand naira o!", en: "Ma'am, how much for this basket? Please don't say ₦2,000." },
  scene_mkt_02: { text: "My friend, dis one na fresh from farm dis morning. Give me one thousand eight hundred.", en: "These are fresh from the farm this morning. Give me ₦1,800." },
  scene_mkt_03: { text: "Ah, e too much o! Take one thousand two hundred, make i dey go.", en: "That's too much. Take ₦1,200 and let me go." },
  scene_mkt_04: { text: "Ehn! You don turn market woman like me? Give me one thousand five hundred, na final price be dat o!", en: "You've become a market woman like me! ₦1,500, that's the final price." },
  scene_mkt_05: { text: "One thousand three hundred! Last last, I no get change.", en: "₦1,300, final offer. I don't have change." },
  scene_mkt_06: { text: "Okay, come collect am. Ah! You be strong customer o.", en: "Okay, take it. You're a tough negotiator." },
  scene_bank_01: { text: "Morning o. Naso I wake this morning see say POS wey i no use commot 50k for my account!", en: "I woke up and saw ₦50,000 leave my account through a POS I never used." },
  scene_bank_02: { text: "Ah, we dey sorry sir. Abeg dey calm, make I quick check your account.", en: "I am so sorry. Please stay calm, let me check your account right now." },
  scene_bank_03: { text: "Abeg sharp-sharp. I need my money back today-today!", en: "Please don't waste time. I need my money back today." },
  scene_bank_04: { text: "Oga, I dey see three unauthorized transaction. I go block am now, make I run your refund.", en: "Sir, I can see three unauthorized transactions. I'll block the card and start the refund." },
  scene_bank_05: { text: "Sharp! Thank you. You don save me plenty wahala today.", en: "Nice. Thank you. You've saved me from a lot of stress today." },
};

interface DemoTurn extends WorkTurn {
  clip: string;
}
interface DemoSession {
  id: string;
  title: string;
  situation: string;
  persona_a: string;
  persona_b: string;
  domain: string;
  session_status: "complete" | "abandoned";
  flags: string[];
  abandoned_reason: string | null;
  completed_at: string;
  speakers: { a: string; b: string };
  turns: DemoTurn[];
  status: Workbench["verification"]["status"];
  claimed: "me" | "other" | null;
  claimed_at: string | null;
  result: VerifyResult | null;
  earnings: EarningPost[];
  editor_score: number | null;
  notes: string | null;
  hold: boolean;
  verified_by: "me" | "other" | null;
  verified_at: string | null;
  audit_pick: boolean;
  audit: AuditDone | null;
}
interface DemoCase extends Case {
  contributor: string; // speaker id
}

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const now = () => new Date().toISOString();
const clipUrl = (name: string): string => window.ACCENT_DEMO_CLIPS?.[name] ?? `${window.location.origin}/audio/${name}.mp3`;
const rating = (rater: Speaker, tone: number, sit: number, mood: number, clarity: number) => ({ tone, prompt_adherence: sit, mood, clarity, aggregate: (tone + sit + mood + clarity) / 4, rater });

function turn(session: string, no: number, speaker: Speaker, speakerId: string, clip: string, seconds: number, r: WorkTurn["rating"], minutesAgo: number): DemoTurn {
  const path = `${session}/turn-${no}-a1-${speakerId}.mp3`;
  demo.storeBlob(path, clipUrl(clip)); // so the shared turnUrl() resolves it like a real signed URL
  return { turn_id: `${session}-t${no}`, turn_no: no, attempt: 1, latest: true, speaker, speaker_id: speakerId, audio_path: path, seconds, status: "rated", created_at: ago(minutesAgo), rating: r, verification: null, draft: null, clip };
}

const A1 = "spk_pcm_ng_48213";
const B1 = "spk_pcm_ng_77104";
const B2 = "spk_pcm_ng_30556";

const state: { sessions: DemoSession[]; cases: DemoCase[]; payouts: QueuedPayout[]; projects: Project[]; deliveries: Delivery[]; seq: number } = { sessions: [], cases: [], payouts: [], projects: [], deliveries: [], seq: 0 };
const BASE_READY_SECONDS = 3712; // rallies verified before the demo started
const BASE_READY_SESSIONS = 41;
const fakeSha = (seed: string) => Array.from({ length: 64 }, (_, i) => "0123456789abcdef"[(seed.charCodeAt(i % seed.length) * (i + 7)) % 16]).join("");

function seed() {
  if (state.sessions.length) return;
  const market: DemoSession = {
    id: "demo-s1", title: "Market Day", situation: "Na market day. Tomato don cost. Customer wan price am down, seller no gree.",
    persona_a: "Buyer wey like to play and haggle. E get small money, e no wan pay too much.", persona_b: "Seller wey stand for e price, but e like this customer and e no wan lose am.",
    domain: "retail_market_haggle", session_status: "complete", flags: [], abandoned_reason: null, completed_at: ago(130), speakers: { a: A1, b: B1 },
    turns: [
      turn("demo-s1", 1, "a", A1, "scene_mkt_01", 6, rating("b", 5, 5, 4, 5), 190),
      turn("demo-s1", 2, "b", B1, "scene_mkt_02", 5, rating("a", 5, 4, 5, 4), 175),
      turn("demo-s1", 3, "a", A1, "scene_mkt_03", 5, rating("b", 5, 5, 5, 4), 160),
      turn("demo-s1", 4, "b", B1, "scene_mkt_04", 6, rating("a", 2, 2, 3, 2), 150), // clean take, rated 2.25: the rater is the problem
      turn("demo-s1", 5, "a", A1, "scene_mkt_05", 4, rating("b", 4, 5, 5, 4), 140),
      turn("demo-s1", 6, "b", B1, "scene_mkt_06", 4, rating("a", 5, 5, 5, 5), 130),
    ],
    status: "pending", claimed: null, claimed_at: null, result: null, earnings: [], editor_score: null, notes: null, hold: false, verified_by: null, verified_at: null, audit_pick: false, audit: null,
  };
  const bank: DemoSession = {
    id: "demo-s2", title: "Banking Wahala", situation: "Money don comot for your account wey you no spend. Na POS transaction wey you no know. You call the bank customer care.",
    persona_a: "Customer wey vex well well. E wan make dem return the money today today.", persona_b: "Bank agent wey calm. E wan help, but e must follow process before e fit block anything.",
    domain: "retail_banking_fraud", session_status: "abandoned", flags: ["short_rally"], abandoned_reason: "partner_quiet", completed_at: ago(48 * 60), speakers: { a: A1, b: B2 },
    turns: [
      turn("demo-s2", 1, "a", A1, "scene_bank_01", 7, rating("b", 5, 5, 5, 4), 50 * 60),
      turn("demo-s2", 2, "b", B2, "scene_bank_02", 5, rating("a", 5, 5, 5, 5), 49 * 60),
      turn("demo-s2", 3, "a", A1, "scene_bank_03", 4, rating("b", 4, 5, 5, 5), 49 * 60),
      turn("demo-s2", 4, "b", B2, "scene_bank_04", 7, rating("a", 5, 5, 4, 5), 48 * 60),
      turn("demo-s2", 5, "a", A1, "scene_bank_05", 4, null, 48 * 60), // the partner went quiet before rating it
    ],
    status: "pending", claimed: null, claimed_at: null, result: null, earnings: [], editor_score: null, notes: null, hold: false, verified_by: null, verified_at: null, audit_pick: false, audit: null,
  };
  const telco: DemoSession = {
    id: "demo-s3", title: "Telco Trouble", situation: "Your data bundle don finish overnight, and you no even use am. You call customer care.",
    persona_a: "Subscriber wey confuse and vex small. E wan know where the data go.", persona_b: "Customer care person wey dey try explain the plan and offer something.",
    domain: "telco_support", session_status: "complete", flags: [], abandoned_reason: null, completed_at: ago(25), speakers: { a: B1, b: B2 },
    turns: [1, 2, 3, 4, 5, 6].map((n) => turn("demo-s3", n, n % 2 ? "a" : "b", n % 2 ? B1 : B2, `scene_bank_0${((n - 1) % 5) + 1}`, 5, rating(n % 2 ? "b" : "a", 4, 5, 4, 5), 40 - n * 2)),
    status: "in_progress", claimed: "other", claimed_at: ago(6), result: null, earnings: [], editor_score: null, notes: null, hold: false, verified_by: null, verified_at: null, audit_pick: false, audit: null,
  };
  // verified three days ago by Ada and drawn for the random audit: the one you can audit
  const okadaTurns = [1, 2, 3, 4, 5, 6].map((n) => turn("demo-s0", n, n % 2 ? "a" : "b", n % 2 ? A1 : B2, `scene_mkt_0${n}`, [6, 5, 5, 6, 4, 4][n - 1], rating(n % 2 ? "b" : "a", 5, 4, 5, 4), 3 * 24 * 60 + 60 - n * 3));
  for (const t of okadaTurns) t.verification = { verified_text: NOTES[t.clip].text, english_gloss: NOTES[t.clip].en, emotion_label: "playful", confidence: 0.92, issues: [], verified_seconds: t.seconds, rating_check: "fair", updated_at: ago(3 * 24 * 60), draft_wer: 0.31, draft_engine: "whisper-large-v3", alignments: [], aligned_at: null, aligner: null };
  const okadaEarnings: EarningPost[] = (["a", "b"] as Speaker[]).map((sp) => {
    const sec = okadaTurns.filter((t) => t.speaker === sp).reduce((n, t) => n + t.seconds, 0);
    return { speaker: sp, speaker_id: sp === "a" ? A1 : B2, seconds: sec, peer_score: 4.5, quality_score: 4.5, tier: "gold", multiplier: 1.0, base_rate_usd: 16, amount_usd: Math.round((sec / 3600) * 16 * 10000) / 10000, status: "cleared" };
  });
  const okada: DemoSession = {
    id: "demo-s0", title: "Okada Price", situation: "Okada man wan carry you go Yaba. The price wey e call too high. You wan price am down before you climb.",
    persona_a: "Passenger wey dey hurry but no wan pay too much.", persona_b: "Okada rider wey know say fuel don cost. E fit gree small.",
    domain: "transport_negotiation", session_status: "complete", flags: [], abandoned_reason: null, completed_at: ago(3 * 24 * 60 + 40), speakers: { a: A1, b: B2 },
    turns: okadaTurns,
    status: "verified", claimed: "other", claimed_at: ago(3 * 24 * 60 + 20), editor_score: 4.5, notes: "clean and playful; both stay in character", hold: false,
    result: { peer_score: 4.5, quality_score: 4.5, quality_tier: "gold", multiplier: 1.0, verified_seconds: 30, hold: false, draft_wer: 0.31, aligned_turns: 0, earnings: okadaEarnings },
    earnings: okadaEarnings, verified_by: "other", verified_at: ago(3 * 24 * 60), audit_pick: true, audit: null,
  };
  state.sessions = [bank, market, telco, okada];
}

const latest = (s: DemoSession) => s.turns.filter((t) => t.latest);
const find = (sid: string): DemoSession => {
  seed();
  const s = state.sessions.find((x) => x.id === sid);
  if (!s) throw new Error("no such rally");
  return s;
};
const caseOf = (cid: string): DemoCase => {
  const c = state.cases.find((x) => x.id === cid);
  if (!c) throw new Error("no such case");
  return c;
};
const log = (c: DemoCase, kind: string, actor: string, detail: Record<string, unknown> | null = null) => {
  const e: CaseEvent = { at: now(), kind, actor, detail };
  c.events = [...c.events, e];
};
const releaseHold = (sessionIds: string[]) => {
  for (const s of state.sessions) if (sessionIds.includes(s.id)) s.hold = state.cases.some((c) => c.status !== "decided" && c.sessions.some((x) => x.session_id === s.id));
};

export function demoNotesFor(audioPath: string): { text: string; en: string } | null {
  seed();
  for (const s of state.sessions) for (const t of s.turns) if (t.audio_path === audioPath) return NOTES[t.clip] ?? null;
  return null;
}

export const demoVerify = {
  queue: async (): Promise<Queue> => {
    seed();
    const open = state.sessions.filter((s) => s.status === "pending" || s.status === "in_progress");
    return {
      me: "demo-editor", my_editor: ME, claim_minutes: 30, verified_count: state.sessions.filter((s) => s.status === "verified").length,
      sessions: open.sort((a, b) => (a.completed_at < b.completed_at ? -1 : 1)).map((s) => ({
        session_id: s.id, status: s.status, session_status: s.session_status, title: s.title, language: "pcm", domain: s.domain,
        turns: latest(s).length, seconds: latest(s).reduce((n, t) => n + t.seconds, 0), flags: s.flags, abandoned_reason: s.abandoned_reason,
        speakers: [s.speakers.a, s.speakers.b], claimed_by: s.claimed ? (s.claimed === "me" ? "demo-editor" : "demo-other") : null, claimed_by_me: s.claimed === "me",
        claimed_at: s.claimed_at, claim_editor: s.claimed === "me" ? ME : s.claimed === "other" ? OTHER : null, ready_since: s.completed_at, hold: s.hold,
      })),
    };
  },

  claim: async (sid: string): Promise<void> => {
    const s = find(sid);
    if (s.status === "verified" || s.status === "forfeited") throw new Error("already verified");
    if (s.claimed === "other") throw new Error("held by another editor");
    s.status = "in_progress";
    s.claimed = "me";
    s.claimed_at = now();
  },

  workbench: async (sid: string): Promise<Workbench> => {
    const s = find(sid);
    const rated = latest(s).filter((t) => t.rating);
    const peer = rated.length ? Math.round((rated.reduce((n, t) => n + (t.rating?.aggregate ?? 0), 0) / rated.length) * 100) / 100 : null;
    return {
      session_id: s.id, session_status: s.session_status, language: "pcm", flags: s.flags, abandoned_reason: s.abandoned_reason, completed_at: s.completed_at, turns_target: 6,
      card: { title: s.title, situation: s.situation, persona_a: s.persona_a, persona_b: s.persona_b, domain: s.domain, audio_path: null, english_note: null },
      speakers: s.speakers, peer_score: peer,
      verification: {
        status: s.status, claimed_by: s.claimed ? "x" : null, claimed_by_me: s.claimed === "me", claimed_at: s.claimed_at,
        editor_score: s.editor_score, peer_score: s.result?.peer_score ?? null, quality_score: s.result?.quality_score ?? null, quality_tier: s.result?.quality_tier ?? null,
        multiplier: s.status === "forfeited" ? 0 : s.result?.multiplier ?? null, verified_seconds: s.result?.verified_seconds ?? null, notes: s.notes, hold: s.hold,
        verified_at: s.verified_at ?? (s.result ? now() : null), editor_id: s.result ? (s.verified_by === "other" ? OTHER : ME) : null, audit_pick: s.audit_pick,
        verified_by_me: s.verified_by === "me", audit_outcome: s.audit?.outcome ?? null, audit_editor_id: s.audit?.auditor_id ?? null, audited_at: s.audit?.audited_at ?? null,
      },
      cases: state.cases.filter((c) => c.sessions.some((x) => x.session_id === s.id)).map((c) => ({ id: c.id, who: c.contributor === s.speakers.a ? "a" : "b", reason: c.reason, status: c.status, decision: c.decision })),
      earnings: s.earnings,
      tiers: TIERS,
      stt: { engine: "whisper", language: "en", show: true, note: STT_NOTE },
      turns: s.turns.map(({ clip: _clip, ...t }) => t),
    };
  },

  saveTurn: async (i: SaveTurnInput): Promise<void> => {
    seed();
    const s = state.sessions.find((x) => x.turns.some((t) => t.turn_id === i.turn_id));
    const t = s?.turns.find((x) => x.turn_id === i.turn_id);
    if (!s || !t) throw new Error("no such turn");
    if (s.status !== "in_progress" || s.claimed !== "me") throw new Error("claim the rally first");
    const v: TurnVerification = { verified_text: i.verified_text.trim() || null, english_gloss: i.english_gloss.trim() || null, emotion_label: i.emotion, confidence: i.confidence, issues: i.issues, verified_seconds: i.verified_seconds, rating_check: i.rating_check, updated_at: now(), alignments: i.alignments ?? [], aligned_at: i.alignments?.length ? now() : null, aligner: i.alignments?.length ? ME : null };
    t.verification = v;
  },

  verify: async (sid: string, editorScore: number, notes: string): Promise<VerifyResult> => {
    const s = find(sid);
    if (s.status !== "in_progress" || s.claimed !== "me") throw new Error("claim the rally first");
    const missing = latest(s).filter((t) => !t.verification?.verified_text || t.verification.confidence == null).length;
    if (missing > 0) throw new Error(`${missing} turn(s) still need a transcript and a confidence`);
    const rated = latest(s).filter((t) => t.rating);
    const peer = rated.length ? Math.round((rated.reduce((n, t) => n + (t.rating?.aggregate ?? 0), 0) / rated.length) * 100) / 100 : null;
    const q = peer == null ? editorScore : Math.round(((peer + editorScore) / 2) * 100) / 100;
    const tier = TIERS.find((t) => q >= t.min) ?? TIERS[TIERS.length - 1];
    const secs = latest(s).reduce((n, t) => n + (t.verification?.verified_seconds ?? t.seconds), 0);
    const hold = state.cases.some((c) => c.status !== "decided" && c.sessions.some((x) => x.session_id === s.id));
    const wers: number[] = [];
    for (const t of latest(s)) {
      if (t.draft?.status === "done" && t.draft.text && t.verification?.verified_text) {
        const w = wer(t.verification.verified_text, t.draft.text);
        t.verification = { ...t.verification, draft_wer: w, draft_engine: t.draft.engine };
        wers.push(w);
      }
    }
    const draftWer = wers.length ? Math.round((wers.reduce((a, b) => a + b, 0) / wers.length) * 1000) / 1000 : null;
    // one line per speaker, priced per verified hour at $16 times that speaker's own tier
    s.earnings = (["a", "b"] as Speaker[]).map((sp) => {
      const mine = latest(s).filter((t) => t.speaker === sp);
      const sec = mine.reduce((n, t) => n + (t.verification?.verified_seconds ?? t.seconds), 0);
      const rated2 = mine.filter((t) => t.rating);
      const p2 = rated2.length ? Math.round((rated2.reduce((n, t) => n + (t.rating?.aggregate ?? 0), 0) / rated2.length) * 100) / 100 : null;
      const q2 = p2 == null ? editorScore : Math.round(((p2 + editorScore) / 2) * 100) / 100;
      const t2 = TIERS.find((t) => q2 >= t.min) ?? TIERS[TIERS.length - 1];
      const open = state.cases.some((c) => c.status !== "decided" && c.contributor === s.speakers[sp] && c.sessions.some((x) => x.session_id === s.id));
      return { speaker: sp, speaker_id: s.speakers[sp], seconds: sec, peer_score: p2, quality_score: q2, tier: t2.tier, multiplier: t2.x, base_rate_usd: 16, amount_usd: Math.round((sec / 3600) * 16 * t2.x * 10000) / 10000, status: open ? "held" : "cleared" };
    });
    s.result = { peer_score: peer, quality_score: q, quality_tier: tier.tier, multiplier: tier.x, verified_seconds: secs, hold, draft_wer: draftWer, aligned_turns: latest(s).filter((t) => (t.verification?.alignments?.length ?? 0) > 0).length, earnings: s.earnings };
    s.editor_score = editorScore;
    s.notes = notes.trim() || null;
    s.status = "verified";
    s.verified_by = "me";
    s.verified_at = now();
    s.hold = hold;
    return s.result;
  },

  /** The demo's vendor: every take gets a draft a couple of seconds after the rally is claimed. */
  draft: async (sid: string): Promise<{ ok: boolean; done: number; failed: number; skipped: number }> => {
    const s = find(sid);
    const todo = latest(s).filter((t) => !t.draft || t.draft.status === "failed" || t.draft.status === "skipped");
    for (const t of todo) t.draft = { status: "running", engine: "whisper-large-v3 (demo)", text: null, confidence: null, detected_language: null, error: null, updated_at: now() };
    await new Promise((res) => setTimeout(res, 2500));
    for (const t of todo) t.draft = { status: "done", engine: "whisper-large-v3 (demo)", text: DRAFTS[t.clip] ?? null, confidence: 0.82, detected_language: "en", error: null, updated_at: now(), gloss: GLOSSES[t.clip] ?? null, gloss_engine: "claude-haiku-4-5 (demo)", gloss_error: null };
    return { ok: true, done: todo.length, failed: 0, skipped: 0 };
  },

  /** The demo's gloss model: after a short wait it returns the founders' own gloss for the take. */
  regloss: async (turnId: string, _text: string): Promise<{ gloss: string; engine: string }> => {
    seed();
    await new Promise((res) => setTimeout(res, 900));
    for (const s of state.sessions) for (const t of s.turns) if (t.turn_id === turnId) return { gloss: NOTES[t.clip]?.en ?? "", engine: "claude-haiku-4-5 (demo)" };
    throw new Error("no such turn");
  },

  flag: async (sid: string, who: Speaker, reason: CaseReason, detail: string, tid: string | null): Promise<{ case_id: string }> => {
    const s = find(sid);
    const c: DemoCase = {
      id: `case-${++state.seq}`, created_at: now(), status: "flagged", reason, detail: detail.trim() || null, contributor: s.speakers[who], speaker_id: s.speakers[who],
      sessions: [{ session_id: s.id, title: s.title, date: s.completed_at, verification_status: s.status, seconds: latest(s).reduce((n, t) => n + t.seconds, 0) }],
      raised_by: ME, raised_by_me: true, reviewer: null, review_note: null, reviewed_at: null, notice_sent_at: null, notice_mailed: null, respond_by: null,
      response: null, responded_at: null, decided_by: null, decision: null, decision_reason: null, decided_at: null, contributor_seen_at: null, events: [],
    };
    log(c, "flagged", ME, { reason, turn_id: tid, session_id: sid });
    state.cases = [c, ...state.cases];
    s.hold = true;
    return { case_id: c.id };
  },

  cases: async (): Promise<Cases> => {
    seed();
    return { me: "demo-editor", my_editor: ME, response_window_days: WINDOW_DAYS, cases: state.cases };
  },

  review: async (cid: string, note: string, proceed: boolean): Promise<void> => {
    const c = caseOf(cid);
    if (c.status !== "flagged") throw new Error("this case was already reviewed");
    c.reviewer = ME;
    c.review_note = note.trim() || null;
    c.reviewed_at = now();
    if (proceed) {
      c.status = "under_review";
      log(c, "reviewed", ME, { proceed: true, note });
    } else {
      c.status = "decided";
      c.decided_by = ME;
      c.decision = "dismissed";
      c.decision_reason = note.trim() || null;
      c.decided_at = now();
      log(c, "dismissed_at_review", ME, { note });
      releaseHold(c.sessions.map((x) => x.session_id));
    }
  },

  notify: async (cid: string, kind: "notice" | "decision"): Promise<{ mailed: boolean }> => {
    const c = caseOf(cid);
    if (kind === "notice") {
      if (c.status !== "under_review") throw new Error("review the case before sending a notice");
      c.status = "notice_sent";
      c.notice_sent_at = now();
      c.notice_mailed = true;
      c.respond_by = new Date(Date.now() + WINDOW_DAYS * 86_400_000).toISOString();
      log(c, "notice_sent", ME, { mailed: true, respond_by: c.respond_by, demo: "no email leaves the demo" });
    } else {
      if (c.status !== "decided") throw new Error("decide the case first");
      log(c, "decision_mailed", ME, { mailed: true, demo: "no email leaves the demo" });
    }
    return { mailed: true };
  },

  /** In the demo the second team member signs the decision, because the person who raised the flag cannot. */
  decide: async (cid: string, decision: Decision, reason: string): Promise<void> => {
    const c = caseOf(cid);
    if (!(c.status === "responded" || (c.status === "notice_sent" && c.respond_by && new Date(c.respond_by).getTime() < Date.now()))) {
      throw new Error("wait for the response or the end of the response window");
    }
    c.status = "decided";
    c.decided_by = OTHER;
    c.decision = decision;
    c.decision_reason = reason.trim() || null;
    c.decided_at = now();
    log(c, "decided", OTHER, { decision, reason });
    for (const s of state.sessions) {
      if (!c.sessions.some((x) => x.session_id === s.id)) continue;
      if (decision === "dismissed") continue;
      s.status = "forfeited";
    }
    releaseHold(c.sessions.map((x) => x.session_id));
    for (const x of c.sessions) x.verification_status = state.sessions.find((s) => s.id === x.session_id)?.status ?? x.verification_status;
  },

  myCases: async (): Promise<MyCase[]> => {
    seed();
    return state.cases
      .filter((c) => c.notice_sent_at && c.contributor === A1)
      .map((c) => ({ id: c.id, status: c.status, reason: c.reason, detail: c.detail, sessions: c.sessions.map((s) => ({ title: s.title, date: s.date })), notice_sent_at: c.notice_sent_at!, respond_by: c.respond_by!, response: c.response, responded_at: c.responded_at, decision: c.decision, decision_reason: c.decision_reason, decided_at: c.decided_at }));
  },

  respond: async (cid: string, text: string): Promise<void> => {
    const c = caseOf(cid);
    if (c.status !== "notice_sent") throw new Error("this case is not open for a response");
    if (!text.trim()) throw new Error("write your response first");
    c.response = text.trim();
    c.responded_at = now();
    c.status = "responded";
    log(c, "responded", A1, { chars: text.trim().length });
  },

  /** The founder's payout queue: one request waiting, one already sent. */
  payoutsQueue: async (): Promise<PayoutQueue> => {
    seed();
    if (!state.payouts.length) state.payouts = [
      { id: "pay-1", requested_at: ago(26 * 60), rail: "usdc", amount_usd: 2.31, status: "requested", paid_at: null, reference: null, speaker_id: "spk_pcm_ng_48213", lines: 6, paid_by: null, details: { network: "base", token: "USDC", address: "0x9c4bE2f1a0d3C7e8B6a5F4d3C2b1A0e9D8c7B641" }, identity: "pending" },
      { id: "pay-0", requested_at: ago(31 * 24 * 60), rail: "paystack", amount_usd: 5.2, status: "paid", paid_at: ago(29 * 24 * 60), reference: "PSK-88213", speaker_id: "spk_pcm_ng_77104", lines: 9, paid_by: OTHER },
    ];
    const requested = state.payouts.filter((p) => p.status === "requested").reduce((n, p) => n + p.amount_usd, 0);
    const paid = state.payouts.filter((p) => p.status === "paid").reduce((n, p) => n + p.amount_usd, 0);
    const held = state.sessions.flatMap((s) => s.earnings).filter((e) => e.status === "held").reduce((n, e) => n + e.amount_usd, 0);
    const cleared = state.sessions.flatMap((s) => s.earnings).filter((e) => e.status === "cleared").reduce((n, e) => n + e.amount_usd, 0);
    return { payouts: state.payouts, requested_usd: requested, held_usd: held, cleared_usd: cleared, paid_usd: paid };
  },

  markPaid: async (pid: string, reference: string): Promise<{ amount_usd: number }> => {
    const p = state.payouts.find((x) => x.id === pid);
    if (!p || p.status !== "requested") throw new Error("this payout is already sent");
    p.status = "paid";
    p.paid_at = now();
    p.reference = reference;
    p.paid_by = ME;
    return { amount_usd: p.amount_usd };
  },

  /** Founder tab: one standing project; verified demo rallies join its pool. */
  projects: async (): Promise<Project[]> => {
    seed();
    if (!state.projects.length) state.projects = [{ id: "proj-1", name: "Standing Nigerian Pidgin corpus", buyer: "Accent Studio (standing)", language: "pcm", locale: "pcm-NG", target_hours: 50, tier: "standard", deadline: null, status: "open", notes: "Banking, market and telco scenes", created_at: ago(20 * 24 * 60), contributors: 12, available_seconds: 0, available_sessions: 0, held_sessions: 0, delivered_seconds: 0, deliveries: 0 }];
    const verified = state.sessions.filter((s) => s.status === "verified" && !s.hold);
    const delivered = state.deliveries.filter((d) => d.status === "ready");
    const deliveredSessions = new Set<string>(); // the demo remembers which demo rallies went out
    for (const d of delivered) for (const id of ((d as Delivery & { session_ids?: string[] }).session_ids ?? [])) deliveredSessions.add(id);
    const pool = verified.filter((s) => !deliveredSessions.has(s.id));
    const baseLeft = delivered.length ? 0 : BASE_READY_SECONDS;
    const p = state.projects[0];
    p.available_seconds = baseLeft + pool.reduce((n, s) => n + (s.result?.verified_seconds ?? 0), 0);
    p.available_sessions = (delivered.length ? 0 : BASE_READY_SESSIONS) + pool.length;
    p.held_sessions = state.sessions.filter((s) => s.status === "verified" && s.hold).length;
    p.delivered_seconds = delivered.reduce((n, d) => n + d.seconds, 0);
    p.deliveries = state.deliveries.length;
    p.status = delivered.length ? "delivering" : p.status;
    return state.projects;
  },

  saveProject: async (i: ProjectInput): Promise<{ id: string }> => {
    await demoVerify.projects();
    if (i.id) {
      const p = state.projects.find((x) => x.id === i.id);
      if (!p) throw new Error("no such project");
      Object.assign(p, { name: i.name, buyer: i.buyer, language: i.language, target_hours: i.target_hours, tier: i.tier, deadline: i.deadline, status: i.status, notes: i.notes || null });
      return { id: p.id };
    }
    const id = `proj-${state.projects.length + 1}`;
    state.projects.push({ id, name: i.name, buyer: i.buyer, language: i.language, locale: `${i.language}-NG`, target_hours: i.target_hours, tier: i.tier, deadline: i.deadline, status: i.status, notes: i.notes || null, created_at: now(), contributors: 0, available_seconds: 0, available_sessions: 0, held_sessions: 0, delivered_seconds: 0, deliveries: 0 });
    return { id };
  },

  deliveryPlan: async (pid: string): Promise<Plan> => {
    const p = (await demoVerify.projects()).find((x) => x.id === pid);
    if (!p) throw new Error("no such project");
    return { sessions: p.available_sessions, seconds: p.available_seconds, speakers: p.available_sessions ? 12 : 0, excluded: { held: p.held_sessions, withdrawn: 0, forfeited: state.sessions.filter((s) => s.status === "forfeited").length, delivered: state.deliveries.reduce((n, d) => n + d.session_count, 0), exclusive_elsewhere: 0, reserved: 0, other_project: 0, sold_elsewhere: 0 } };
  },

  createDelivery: async (pid: string, note: string): Promise<{ delivery_id: string; bundle_id: string; sessions: number; files: number }> => {
    const plan = await demoVerify.deliveryPlan(pid);
    if (plan.sessions === 0) throw new Error("nothing to deliver yet");
    const id = `del-${state.deliveries.length + 1}`;
    const bundle = `acc_pcm_standing_nigerian_pidgin_corpus_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}_${String(state.deliveries.length + 1).padStart(2, "0")}`;
    const pool = state.sessions.filter((s) => s.status === "verified" && !s.hold);
    const files = plan.sessions * 6;
    const d: Delivery & { session_ids: string[] } = { id, bundle_id: bundle, created_at: now(), status: "building", session_count: plan.sessions, speaker_count: plan.speakers, seconds: plan.seconds, files_total: files, files_done: 0, manifest_sha256: null, bundle_files: null, note: note.trim() || null, error: null, finished_at: null, created_by: ME, session_ids: pool.map((s) => s.id) };
    state.deliveries.unshift(d);
    return { delivery_id: id, bundle_id: bundle, sessions: plan.sessions, files };
  },

  deliveries: async (_pid: string): Promise<Delivery[]> => {
    seed();
    return state.deliveries;
  },

  exportStage: async (did: string, stage: "audio" | "meta"): Promise<ExportStep> => {
    const d = state.deliveries.find((x) => x.id === did);
    if (!d) throw new Error("no such delivery");
    await new Promise((res) => setTimeout(res, 350));
    if (stage === "audio") {
      const copied = Math.min(24, d.files_total - d.files_done);
      d.files_done += copied;
      return { ok: true, copied, remaining: d.files_total - d.files_done, total: d.files_total, errors: [] };
    }
    d.status = "ready";
    d.finished_at = now();
    d.manifest_sha256 = fakeSha(d.bundle_id);
    d.bundle_files = ["manifest.jsonl", "alignments.jsonl", "speakers.jsonl", "consent_log.jsonl", "index.csv", "README.md", "checksums.txt"].map((n) => ({ path: `${d.bundle_id}/${n}`, bytes: 2048 + n.length * 700, sha256: fakeSha(n) }))
      .concat(Array.from({ length: d.files_total }, (_, i) => ({ path: `${d.bundle_id}/audio/pcm-NG/sess_${Math.floor(i / 6) + 1}/turn-${String((i % 6) + 1).padStart(2, "0")}.mp3`, bytes: 96_000 + (i * 7919) % 40_000, sha256: fakeSha(`audio${i}`) })));
    return { ok: true, manifest_sha256: d.manifest_sha256, files: d.bundle_files.length, sessions: d.session_count, preview: JSON.parse(await demoVerify.bundlePreview(did)) };
  },

  /** The first manifest row, from the demo's Market Day rally when it has been verified. */
  bundlePreview: async (did: string): Promise<string> => {
    const d = state.deliveries.find((x) => x.id === did);
    const s = state.sessions.find((x) => x.id === "demo-s1" && x.status === "verified") ?? state.sessions.find((x) => x.status === "verified");
    const bundle = d?.bundle_id ?? "acc_pcm_demo";
    const turns = (s ? latest(s) : []).map((t) => ({
      turn_id: t.turn_no, speaker_id: t.speaker_id, channel: t.speaker === "a" ? 0 : 1, audio_file: `audio/pcm-NG/${s?.id}/turn-${String(t.turn_no).padStart(2, "0")}-${t.speaker_id}.mp3`, audio_sha256: fakeSha(t.turn_id),
      start_ms: 0, end_ms: Math.round((t.verification?.verified_seconds ?? t.seconds) * 1000), raw_stt_text: t.draft?.text ?? null, raw_stt_engine: t.draft?.engine ?? null, raw_stt_wer: t.verification?.draft_wer ?? null,
      verified_text: t.verification?.verified_text ?? null, english_gloss: t.verification?.english_gloss ?? null, english_source: t.verification?.english_gloss ?? null, emotion_label: t.verification?.emotion_label ?? null, editor_confidence: t.verification?.confidence ?? null,
      inter_turn_latency_ms: 0, latency_source: "async_none", peer_rating: t.rating ? { tone: t.rating.tone, prompt_adherence: t.rating.prompt_adherence, mood: t.rating.mood, clarity: t.rating.clarity, aggregate: t.rating.aggregate } : null,
      alignments: ((t.verification?.alignments as { src: { text: string } | null; tgt: { text: string } | null; type: string; confidence: number }[] | undefined) ?? []).map((a) => ({ src_span: a.src?.text ?? "", tgt_span: a.tgt?.text ?? "", type: a.type, confidence: a.confidence, reviewer_id: ME })),
    }));
    const row = {
      session_id: s?.id ?? "demo-s1", corpus_id: bundle, bundle_id: "multiling_conversational_v1.1", locale: "pcm-NG", scenario: s?.domain ?? "retail_market_haggle", scenario_title: s?.title ?? "Market Day", scenario_prompt_hash: fakeSha(s?.title ?? "x"),
      prompt_direction: "target_native", modality: "async_voice_notes", audio_layout: "per_turn_files", duration_seconds: s?.result?.verified_seconds ?? 30, recorded_at: s?.turns[0]?.created_at ?? now(), latency_source: "async_none",
      participants: [{ speaker_id: s?.speakers.a ?? A1, channel: 0, role: "speaker_a", persona_card: s?.persona_a, demographics: { age_band: "25-34", gender: "Man", accent_region: "Lagos_NG" }, consent_record_sha256: fakeSha("consent-a") }, { speaker_id: s?.speakers.b ?? B1, channel: 1, role: "speaker_b", persona_card: s?.persona_b, demographics: { age_band: "35-44", gender: "Woman", accent_region: "Ibadan_NG" }, consent_record_sha256: fakeSha("consent-b") }],
      verified_by_qc: { editor_id: ME, verification_timestamp: now(), confidence_score: 0.96, editor_score: s?.editor_score ?? 5, peer_score: s?.result?.peer_score ?? null, quality_score: s?.result?.quality_score ?? null, quality_tier: s?.result?.quality_tier ?? null, audit_status: "not_sampled" },
      license: { type: "commercial_non_exclusive", territory: "worldwide", term: "perpetual", license_id: `LIC-${bundle}`, buyer_ref: "buyer_accent_studio_standing" },
      turns,
    };
    return JSON.stringify(row, null, 2);
  },

  /** The audit queue: verified rallies drawn for a second look. You cannot audit what you verified. */
  auditQueue: async (): Promise<AuditQueue> => {
    seed();
    const picks = state.sessions.filter((s) => s.status === "verified" && s.audit_pick && !s.audit);
    const done = state.sessions.filter((s) => s.audit).map((s) => s.audit as AuditDone).sort((a, b) => (a.audited_at < b.audited_at ? 1 : -1));
    return {
      sample_pct: 30, my_editor: ME, verified_total: 41 + state.sessions.filter((s) => s.status === "verified").length, audited_total: 6 + done.length,
      pending: picks.map((s) => ({
        session_id: s.id, title: s.title, language: "pcm", mode: "async", verified_at: s.verified_at ?? now(), editor_id: s.verified_by === "other" ? OTHER : ME,
        editor_score: s.editor_score ?? 0, peer_score: s.result?.peer_score ?? null, quality_score: s.result?.quality_score ?? 0, quality_tier: s.result?.quality_tier ?? "gold",
        verified_seconds: s.result?.verified_seconds ?? 0, turns: latest(s).length, mine: s.verified_by === "me", hold: s.hold,
        paid: s.earnings.some((e) => e.status === "paid" || e.status === "requested"),
      })),
      done,
    };
  },

  auditRecord: async (sid: string, outcome: "upheld" | "adjusted", score: number | null, note: string): Promise<AuditResult> => {
    const s = find(sid);
    if (s.status !== "verified") throw new Error("not a verified rally");
    if (s.verified_by === "me") throw new Error("you verified this rally; a different editor audits it");
    if (s.audit) throw new Error("already audited");
    const fromTier = s.result?.quality_tier ?? null;
    const fromScore = s.editor_score;
    let tier = fromTier;
    let repriced = 0;
    if (outcome === "adjusted") {
      if (score == null || score < 1 || score > 5) throw new Error("an adjusted audit needs a score from 1 to 5");
      const peer = s.result?.peer_score ?? null;
      const q = peer == null ? score : Math.round(((peer + score) / 2) * 100) / 100;
      const t = TIERS.find((x) => q >= x.min) ?? TIERS[TIERS.length - 1];
      tier = t.tier;
      s.earnings = s.earnings.map((e) => {
        if (e.status !== "cleared" && e.status !== "held") return e;
        const eq = e.peer_score == null ? score : Math.round(((e.peer_score + score) / 2) * 100) / 100;
        const et = TIERS.find((x) => eq >= x.min) ?? TIERS[TIERS.length - 1];
        repriced += 1;
        return { ...e, quality_score: eq, tier: et.tier, multiplier: et.x, amount_usd: Math.round((e.seconds / 3600) * e.base_rate_usd * et.x * 10000) / 10000 };
      });
      if (s.result) s.result = { ...s.result, quality_score: q, quality_tier: t.tier, multiplier: t.x, earnings: s.earnings };
      s.editor_score = score;
    }
    s.audit = { session_id: s.id, title: s.title, language: "pcm", audited_at: now(), auditor_id: ME, editor_id: s.verified_by === "other" ? OTHER : ME, outcome, original_tier: fromTier, quality_tier: tier, original_editor_score: fromScore, audit_score: score, note: note.trim() || null };
    return { outcome, quality_tier: tier ?? "gold", lines_repriced: repriced, lines_untouched: s.earnings.length - repriced };
  },

  reset: () => {
    state.sessions = [];
    state.cases = [];
    state.payouts = [];
    state.projects = [];
    state.deliveries = [];
    state.seq = 0;
  },
};
