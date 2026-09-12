// Demo of the Cutting Room on an in-memory backend. Two finished rallies built from the
// founders' recorded clips, you as the editor, a second team member who signs decisions
// (clause 15: the person who raised a flag cannot decide it), and the contributor's view.
// Nothing is saved.
import { demo } from "@/lib/demo";
import type { Case, CaseEvent, CaseReason, Cases, Decision, MyCase, Queue, SaveTurnInput, Speaker, TurnVerification, VerifyResult, Workbench, WorkTurn } from "@/lib/verify";

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
  editor_score: number | null;
  notes: string | null;
  hold: boolean;
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

const state: { sessions: DemoSession[]; cases: DemoCase[]; seq: number } = { sessions: [], cases: [], seq: 0 };

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
    status: "pending", claimed: null, claimed_at: null, result: null, editor_score: null, notes: null, hold: false,
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
    status: "pending", claimed: null, claimed_at: null, result: null, editor_score: null, notes: null, hold: false,
  };
  const telco: DemoSession = {
    id: "demo-s3", title: "Telco Trouble", situation: "Your data bundle don finish overnight, and you no even use am. You call customer care.",
    persona_a: "Subscriber wey confuse and vex small. E wan know where the data go.", persona_b: "Customer care person wey dey try explain the plan and offer something.",
    domain: "telco_support", session_status: "complete", flags: [], abandoned_reason: null, completed_at: ago(25), speakers: { a: B1, b: B2 },
    turns: [1, 2, 3, 4, 5, 6].map((n) => turn("demo-s3", n, n % 2 ? "a" : "b", n % 2 ? B1 : B2, `scene_bank_0${((n - 1) % 5) + 1}`, 5, rating(n % 2 ? "b" : "a", 4, 5, 4, 5), 40 - n * 2)),
    status: "in_progress", claimed: "other", claimed_at: ago(6), result: null, editor_score: null, notes: null, hold: false,
  };
  state.sessions = [bank, market, telco];
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
        verified_at: s.result ? now() : null, editor_id: s.result ? ME : null, audit_pick: false,
      },
      cases: state.cases.filter((c) => c.sessions.some((x) => x.session_id === s.id)).map((c) => ({ id: c.id, who: c.contributor === s.speakers.a ? "a" : "b", reason: c.reason, status: c.status, decision: c.decision })),
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
    s.result = { peer_score: peer, quality_score: q, quality_tier: tier.tier, multiplier: tier.x, verified_seconds: secs, hold, draft_wer: draftWer, aligned_turns: latest(s).filter((t) => (t.verification?.alignments?.length ?? 0) > 0).length };
    s.editor_score = editorScore;
    s.notes = notes.trim() || null;
    s.status = "verified";
    s.hold = hold;
    return s.result;
  },

  /** The demo's vendor: every take gets a draft a couple of seconds after the rally is claimed. */
  draft: async (sid: string): Promise<{ ok: boolean; done: number; failed: number; skipped: number }> => {
    const s = find(sid);
    const todo = latest(s).filter((t) => !t.draft || t.draft.status === "failed" || t.draft.status === "skipped");
    for (const t of todo) t.draft = { status: "running", engine: "whisper-large-v3 (demo)", text: null, confidence: null, detected_language: null, error: null, updated_at: now() };
    await new Promise((res) => setTimeout(res, 2500));
    for (const t of todo) t.draft = { status: "done", engine: "whisper-large-v3 (demo)", text: DRAFTS[t.clip] ?? null, confidence: 0.82, detected_language: "en", error: null, updated_at: now() };
    return { ok: true, done: todo.length, failed: 0, skipped: 0 };
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

  reset: () => {
    state.sessions = [];
    state.cases = [];
    state.seq = 0;
  },
};
