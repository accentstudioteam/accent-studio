// The founder's admin screens on an in-memory backend: staff, the contributor roster and the overview.
// Nothing is saved.
import type { AdminEvent, ContributorAction, ContributorDetail, ContributorRow, NotifyLog, NotifyRun, Overview, Roster, Staff, StaffInvite, StaffPerson, StaffRole } from "@/lib/admin";

const now = () => new Date().toISOString();
const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const ahead = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
const ME = "edt_00108";

const state: { people: StaffPerson[]; invited: StaffInvite[]; events: AdminEvent[]; contributors: ContributorDetail[]; seq: number } = { people: [], invited: [], events: [], contributors: [], seq: 0 };

const row = (i: Partial<ContributorDetail> & Pick<ContributorDetail, "id" | "speaker_id" | "full_name" | "email">): ContributorDetail => ({
  languages: ["pcm"],
  primary_language: "pcm",
  country: "NG",
  city: "Lagos",
  created_at: ago(40 * 24 * 60),
  last_active_at: ago(90),
  status: "active",
  paused_until: null,
  paused_reason: null,
  closed_at: null,
  closed_reason: null,
  withdrawn_at: null,
  admin_note: null,
  rallies: 12,
  scenes: 1,
  abandoned: 0,
  verified_seconds: 2140,
  avg_quality: 4.4,
  earned_usd: 9.51,
  paid_usd: 5.2,
  held_usd: 0,
  cleared_usd: 4.31,
  arena_strikes: 0,
  arena_paused_until: null,
  quiet_count: 0,
  open_cases: 0,
  confirmed_cases: 0,
  consent: { agreement_version: "1.2", signed_at: ago(40 * 24 * 60), withdrawn_at: null, record_sha256: "3f1c9a02e7b14d6c8a5f0e9b2c7d4a1f6e3b8c5d2a9f7e4b1c6d3a8f5e2b9c7d" },
  notifications: [],
  sessions: [],
  payouts: [],
  cases: [],
  bookings: [],
  events: [],
  ...i,
});

function seed() {
  if (state.people.length) return;
  state.people = [
    { id: "u-me", email: "you@accentstudio.io", handle: "you", editor_id: ME, is_admin: true, is_linguist: true, is_contributor: false, verified: 41, audited: 6, last_verified_at: ago(130), last_sign_in_at: ago(5), created_at: ago(120 * 24 * 60), me: true },
    { id: "u-ada", email: "ada@accentstudio.io", handle: "ada", editor_id: "edt_00417", is_admin: false, is_linguist: true, is_contributor: false, verified: 37, audited: 4, last_verified_at: ago(6), last_sign_in_at: ago(6), created_at: ago(90 * 24 * 60), me: false },
    { id: "u-tunde", email: "tunde@accentstudio.io", handle: "tunde", editor_id: "edt_00922", is_admin: false, is_linguist: true, is_contributor: false, verified: 12, audited: 0, last_verified_at: ago(3 * 24 * 60), last_sign_in_at: ago(2 * 24 * 60), created_at: ago(20 * 24 * 60), me: false },
  ];
  state.invited = [{ email: "kemi.linguist@gmail.com", note: "staff: linguist · Yoruba batch", created_at: ago(26 * 60), signed_up: false }];
  state.events = [
    { at: ago(26 * 60), actor: ME, kind: "staff_invite", detail: { email: "kemi.linguist@gmail.com", role: "linguist" } },
    { at: ago(20 * 24 * 60), actor: ME, kind: "staff_role", detail: { email: "tunde@accentstudio.io", role: "linguist", on: true } },
  ];
  state.contributors = [
    row({
      id: "c-48213", speaker_id: "spk_pcm_ng_48213", full_name: "Chidi O.", email: "chidi@example.com", rallies: 14, scenes: 1, verified_seconds: 2612, avg_quality: 4.31, earned_usd: 11.62, paid_usd: 5.2, cleared_usd: 6.42, open_cases: 1, last_active_at: ago(12),
      sessions: [
        { id: "demo-s1", title: "Market Day", mode: "async", status: "complete", abandoned_reason: null, abandoned_by_me: false, at: ago(130), language: "pcm", partner: "spk_pcm_ng_77104", quality_tier: null, verified: false, audit_outcome: null, my_seconds: 15, earned_usd: null, earning_status: null },
        { id: "demo-s2", title: "Banking Wahala", mode: "async", status: "abandoned", abandoned_reason: "partner_quiet", abandoned_by_me: false, at: ago(48 * 60), language: "pcm", partner: "spk_pcm_ng_30556", quality_tier: null, verified: false, audit_outcome: null, my_seconds: 15, earned_usd: null, earning_status: null },
        { id: "demo-s0", title: "Okada Price", mode: "async", status: "complete", abandoned_reason: null, abandoned_by_me: false, at: ago(3 * 24 * 60), language: "pcm", partner: "spk_pcm_ng_30556", quality_tier: "gold", verified: true, audit_outcome: null, my_seconds: 96, earned_usd: 0.43, earning_status: "cleared" },
        { id: "demo-live-0", title: "Banking Wahala", mode: "live", status: "complete", abandoned_reason: null, abandoned_by_me: false, at: ago(3 * 24 * 60 + 30), language: "pcm", partner: "spk_pcm_ng_77104", quality_tier: "gold", verified: true, audit_outcome: "upheld", my_seconds: 298, earned_usd: 1.32, earning_status: "cleared" },
      ],
      payouts: [
        { id: "pay-1", rail: "usdc", amount_usd: 2.31, status: "requested", requested_at: ago(26 * 60), paid_at: null, reference: null },
        { id: "pay-a0", rail: "usdc", amount_usd: 5.2, status: "paid", requested_at: ago(31 * 24 * 60), paid_at: ago(29 * 24 * 60), reference: "0x9c…41" },
      ],
      bookings: [{ id: "b1", starts_at: ahead(1), status: "paired", language: "pcm" }],
      notifications: [
        { id: 31, kind: "statement", created_at: ago(21 * 24 * 60), sent_at: ago(21 * 24 * 60), attempts: 1, error: null },
        { id: 40, kind: "reply_due", created_at: ago(3 * 24 * 60), sent_at: ago(3 * 24 * 60), attempts: 1, error: null },
      ],
    }),
    row({ id: "c-77104", speaker_id: "spk_pcm_ng_77104", full_name: "Ngozi A.", email: "ngozi@example.com", rallies: 21, scenes: 3, verified_seconds: 4020, avg_quality: 4.72, earned_usd: 21.4, paid_usd: 15.9, cleared_usd: 5.5, last_active_at: ago(40) }),
    row({ id: "c-30556", speaker_id: "spk_pcm_ng_30556", full_name: "Emeka U.", email: "emeka@example.com", rallies: 9, scenes: 0, abandoned: 3, quiet_count: 3, verified_seconds: 1300, avg_quality: 3.9, earned_usd: 4.62, paid_usd: 0, cleared_usd: 4.62, last_active_at: ago(3 * 24 * 60), arena_strikes: 1 }),
    row({ id: "c-51920", speaker_id: "spk_yo_ng_51920", full_name: "Bola F.", email: "bola@example.com", languages: ["yo", "pcm"], primary_language: "yo", city: "Ibadan", rallies: 4, scenes: 0, verified_seconds: 610, avg_quality: 4.5, earned_usd: 2.71, paid_usd: 0, cleared_usd: 2.71, last_active_at: ago(5 * 24 * 60) }),
    row({
      id: "c-09311", speaker_id: "spk_pcm_ng_09311", full_name: "Seun K.", email: "seun@example.com", rallies: 2, scenes: 0, verified_seconds: 240, avg_quality: 2.9, earned_usd: 0.53, paid_usd: 0, cleared_usd: 0, held_usd: 0.53, open_cases: 1, last_active_at: ago(9 * 24 * 60),
      cases: [{ id: "case-x", reason: "not_live", status: "notice_sent", decision: null, created_at: ago(2 * 24 * 60), decided_at: null }],
    }),
    row({ id: "c-22007", speaker_id: "spk_pcm_ng_22007", full_name: "Ife D.", email: "ife@example.com", status: "closed", closed_at: ago(12 * 24 * 60), closed_reason: "clause 15: replayed audio confirmed", rallies: 6, verified_seconds: 800, avg_quality: 3.2, earned_usd: 1.9, paid_usd: 1.9, cleared_usd: 0, confirmed_cases: 1, last_active_at: ago(13 * 24 * 60) }),
  ];
}

const strip = (c: ContributorDetail): ContributorRow => {
  const { sessions: _s, payouts: _p, cases: _c, bookings: _b, events: _e, notifications: _n, ...r } = c;
  return r;
};
const find = (cid: string): ContributorDetail => {
  seed();
  const c = state.contributors.find((x) => x.id === cid);
  if (!c) throw new Error("no such contributor");
  return c;
};
const log = (kind: string, subject: ContributorDetail | null, detail: Record<string, unknown>) => {
  const e: AdminEvent = { at: now(), actor: ME, kind, detail };
  state.events = [e, ...state.events];
  if (subject) subject.events = [e, ...subject.events];
};

export const demoAdmin = {
  overview: async (): Promise<Overview> => {
    seed();
    const count = (s: ContributorRow["status"]) => state.contributors.filter((c) => c.status === s).length;
    return {
      contributors: { active: count("active"), paused: count("paused"), closed: count("closed"), active_7d: 4 },
      pipeline: { applications_new: 17, invitations_open: 3 },
      play: { rallies_7d: 23, scenes_7d: 4, active_now: 2, bookings_upcoming: 5 },
      cutting_room: { queue: 2, verified_total: 41, verified_hours: 1.03, audit_pending: 1, cases_open: 1 },
      money: { requested_usd: 2.31, cleared_usd: 23.56, held_usd: 0.53, paid_usd: 28.2 },
      labs: { projects_open: 1, deliveries_ready: 0, inquiries_new: 2 },
    };
  },

  staff: async (): Promise<Staff> => {
    seed();
    return { people: state.people, invited: state.invited, events: state.events.filter((e) => e.kind.startsWith("staff_")), admins: state.people.filter((p) => p.is_admin).length };
  },

  staffInvite: async (email: string, role: StaffRole, note: string) => {
    seed();
    const e = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error("that is not an email address");
    const existing = state.people.find((p) => p.email === e);
    if (existing) {
      if (role === "admin") existing.is_admin = true;
      else existing.is_linguist = true;
    } else {
      state.invited = [{ email: e, note: `staff: ${role}${note.trim() ? ` · ${note.trim()}` : ""}`, created_at: now(), signed_up: false }, ...state.invited.filter((i) => i.email !== e)];
    }
    log("staff_invite", null, { email: e, role, already_signed_up: !!existing });
    return { email: e, already_signed_up: !!existing };
  },

  staffSet: async (uid: string, role: StaffRole, on: boolean) => {
    seed();
    const p = state.people.find((x) => x.id === uid);
    if (!p) throw new Error("no such person");
    if (role === "admin" && !on && p.is_admin && state.people.filter((x) => x.is_admin).length <= 1) throw new Error("there must be at least one admin");
    if (role === "admin") p.is_admin = on;
    else p.is_linguist = on;
    if (on && !p.editor_id) p.editor_id = `edt_${String(++state.seq + 1200).padStart(5, "0")}`;
    log("staff_role", null, { email: p.email, role, on, self: p.me });
    return { editor_id: p.editor_id };
  },

  staffUninvite: async (email: string) => {
    seed();
    const before = state.invited.length;
    state.invited = state.invited.filter((i) => i.email !== email.trim().toLowerCase());
    log("staff_uninvite", null, { email, removed: before - state.invited.length });
    return { removed: before - state.invited.length };
  },

  contributors: async (): Promise<Roster> => {
    seed();
    const count = (s: ContributorRow["status"]) => state.contributors.filter((c) => c.status === s).length;
    return { people: state.contributors.map(strip), counts: { active: count("active"), paused: count("paused"), closed: count("closed"), withdrawn: count("withdrawn") } };
  },

  contributor: async (cid: string): Promise<ContributorDetail> => ({ ...find(cid) }),

  contributorSet: async (cid: string, action: ContributorAction, reason: string | null, days: number | null): Promise<ContributorRow> => {
    const c = find(cid);
    const r = reason?.trim() || null;
    if (action === "pause") {
      if (!r) throw new Error("give a reason; the contributor sees it");
      c.status = "paused";
      c.paused_until = ahead(Math.max(1, days ?? 7));
      c.paused_reason = r;
    } else if (action === "unpause") {
      c.status = "active";
      c.paused_until = null;
      c.paused_reason = null;
    } else if (action === "close") {
      if (!r) throw new Error("give a reason; the contributor sees it");
      c.status = "closed";
      c.closed_at = now();
      c.closed_reason = r;
      c.paused_until = null;
      c.paused_reason = null;
      c.bookings = c.bookings.map((b) => (b.status === "open" || b.status === "paired" ? { ...b, status: "cancelled" } : b));
    } else if (action === "reopen") {
      c.status = "active";
      c.closed_at = null;
      c.closed_reason = null;
    } else if (action === "note") {
      c.admin_note = r;
    }
    log(`contributor_${action}`, c, { speaker_id: c.speaker_id, reason: r, days });
    return strip(c);
  },

  notifyLog: async (): Promise<NotifyLog> => {
    seed();
    const recent = state.contributors.flatMap((c) => c.notifications.map((n) => ({ ...n, speaker_id: c.speaker_id }))).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return { recent, unsent: 0, sent_7d: recent.filter((n) => n.sent_at && Date.now() - new Date(n.sent_at).getTime() < 7 * 86_400_000).length, cron: [{ name: "accent-sweeps", schedule: "*/5 * * * *", active: true }, { name: "accent-notify", schedule: "*/15 * * * *", active: true }] };
  },

  notifyNow: async (): Promise<NotifyRun> => {
    seed();
    const c = state.contributors[0];
    const n = { id: 90 + state.seq++, kind: "booking_soon", created_at: now(), sent_at: now(), attempts: 1, error: null };
    c.notifications = [n, ...c.notifications];
    return { claimed: 1, sent: 1, failed: 0, results: [{ id: n.id, kind: n.kind, ok: true }] };
  },

  reset: () => {
    state.people = [];
    state.invited = [];
    state.events = [];
    state.contributors = [];
    state.seq = 0;
  },
};
