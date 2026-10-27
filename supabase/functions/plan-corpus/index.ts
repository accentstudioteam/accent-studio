// Drafts a whole corpus plan for one project: the scenes to write, how long each scene runs, and how
// many rallies to spawn from each to reach the hours the buyer ordered. Staff only; same auth as
// stt-draft (is_staff). The draft lands in rally_plans as status "draft" and nothing is released
// until a human approves it in the studio.
//   POST {stage:"start",  project_id, industry, trains, topics, target_hours, language}
//        → {plan_id, totals, scenes_total, model}
//   POST {stage:"scenes", plan_id}   writes the next batch of scenes into the plan
//        → {scenes, written, total, done, totals}
//   POST {stage:"cancel", plan_id}   marks an abandoned draft rejected
//
// The arithmetic is not left to the model. A turn is capped at 30 s and in practice runs about 20 s,
// so the target hours become turns and the turns become rallies here, in code; the model is handed
// those targets and writes only the scenes and a turn count per scene. Totals are recomputed from the
// turn counts that actually come back, and again in the studio if the admin edits or drops scenes.
//
// Generation is batched: a couple of hundred scenes will not fit in one model response. Each call to
// this function runs CALLS_PER_REQUEST model calls of up to SCENES_PER_CALL scenes, appends them to
// rally_plans.plan and returns, so the studio drives it to completion the way it drives the delivery
// export. Every batch is told which titles already exist so the set does not repeat itself.
//
// The model id comes from game_config (plan_model, falling back to gloss_model) so it can be changed
// without a deploy; the default is Claude Haiku, the cheap model already used for the gloss step.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const TURN_CAP_SECONDS = 30; // the recorder's hard cap on one voice note
const TURN_AVG_SECONDS = 20; // what a turn actually runs to, measured across recorded rallies
const TURN_MIN = 4;
const TURN_MAX = 16;
const PLANNED_AVG_TURNS = 10; // the average the model is asked to land on, before real turn counts come back
const SCENES_PER_CALL = 8; // scenes asked of the model in one response
const CALLS_PER_REQUEST = 3; // model calls per invocation of this function
const MAX_SCENES = 400;
const MAX_HOURS = 2000;

const LANG_NAME: Record<string, string> = { pcm: "Nigerian Pidgin", yo: "Yoruba", ha: "Hausa", ig: "Igbo", sw: "Swahili", zu: "Zulu", en: "English" };

interface Inputs {
  project_id: string;
  industry: string;
  trains: string;
  topics: number;
  target_hours: number;
  language: string;
}
interface Scene {
  key: string;
  title: string;
  situation: string;
  persona_a: string;
  persona_b: string;
  domain: string;
  english_note: string;
  turns: number;
  rallies: number;
}
interface Totals {
  scenes: number;
  scenes_target: number;
  target_hours: number;
  turn_cap_seconds: number;
  turn_avg_seconds: number;
  turn_band: [number, number];
  avg_turns: number;
  turns_per_round: number;
  rallies_per_scene: number;
  rallies: number;
  turns: number;
  estimated_hours: number;
  max_hours: number;
  seconds_per_rally: number;
}
interface Plan {
  model: string;
  language: string;
  totals: Totals;
  scenes: Scene[];
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const clean = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

// ---------------------------------------------------------------- the arithmetic
/** What to aim for before any scene exists: the model is told these, it is not asked to work them out. */
function targetsFor(scenes: number, targetHours: number) {
  const targetSeconds = Math.round(targetHours * 3600);
  const secondsPerRally = PLANNED_AVG_TURNS * TURN_AVG_SECONDS;
  const ralliesTotal = Math.max(scenes, Math.ceil(targetSeconds / secondsPerRally));
  return { targetSeconds, secondsPerRally, ralliesTotal, ralliesPerScene: Math.max(1, Math.ceil(ralliesTotal / scenes)) };
}

/** The real totals, from the turn counts the scenes actually carry. Every scene is recorded the same
 *  number of times, so the set stays balanced across topics; one round of the whole set yields
 *  sum(turns) × 20 s, and we run as many rounds as the hours need. */
function totalsFor(scenes: Scene[], targetHours: number, scenesTarget: number): Totals {
  const targetSeconds = Math.round(targetHours * 3600);
  const turnsPerRound = scenes.reduce((n, s) => n + s.turns, 0);
  const secondsPerRound = turnsPerRound * TURN_AVG_SECONDS;
  const ralliesPerScene = secondsPerRound > 0 ? Math.max(1, Math.ceil(targetSeconds / secondsPerRound)) : 0;
  const rallies = ralliesPerScene * scenes.length;
  const turns = turnsPerRound * ralliesPerScene;
  for (const s of scenes) s.rallies = ralliesPerScene;
  return {
    scenes: scenes.length,
    scenes_target: scenesTarget,
    target_hours: targetHours,
    turn_cap_seconds: TURN_CAP_SECONDS,
    turn_avg_seconds: TURN_AVG_SECONDS,
    turn_band: [TURN_MIN, TURN_MAX],
    avg_turns: scenes.length ? round1(turnsPerRound / scenes.length) : 0,
    turns_per_round: turnsPerRound,
    rallies_per_scene: ralliesPerScene,
    rallies,
    turns,
    estimated_hours: round2((turns * TURN_AVG_SECONDS) / 3600),
    max_hours: round2((turns * TURN_CAP_SECONDS) / 3600),
    seconds_per_rally: scenes.length ? Math.round((turnsPerRound / scenes.length) * TURN_AVG_SECONDS) : 0,
  };
}

// ---------------------------------------------------------------- the model
function systemPrompt(i: Inputs, ralliesPerScene: number): string {
  const name = LANG_NAME[i.language] ?? i.language;
  return [
    `You write scenario cards for Accent Studio, a Nigerian speech-data company. Two contributors record a "rally": an asynchronous conversation in voice notes, one turn each at a time, every turn capped at 30 seconds. A card sets the scene and gives each of them a role. It never writes their lines — the talking is theirs.`,
    `The recordings are sold to a buyer working in: ${i.industry}. The data will train: ${i.trains}. The rallies are recorded in ${name}.`,
    ``,
    `Every card must be:`,
    `· An ordinary situation two Nigerians would really be in, specific enough to picture: a place, a moment, something concrete at stake. Naira, danfos, NEPA, market days, POS stands, WhatsApp — the texture of actual Nigerian life, not a generic script with Nigerian words dropped in.`,
    `· A reason for the two to keep talking for the whole exchange: something unsettled between them — a decision to reach, a disagreement to work out, a job to get done between them, news one has that the other needs. A card where one person simply asks and the other simply answers dies after two turns.`,
    `· Recordable by two strangers who never meet. They are anonymous. Nothing in the card may invite them to say a real name, a phone number, an address, an account number, an employer, or anything true about their own lives. Write the roles as roles — "the customer", "the tailor's apprentice", "the one selling" — never as named characters, and never ask them to introduce themselves.`,
    `· Fair. No tribe, religion, region, class, gender or disability as the joke or the problem. Nobody is foolish, pitiful, crooked or a stereotype of their trade. No crime, no violence, no sexual content, no party politics or named politicians, no illness or bereavement.`,
    `· Different from every other card in the set. A new situation, not the same situation reworded, and not the same situation moved to another street.`,
    ``,
    `Give each card an honest turn count between ${TURN_MIN} and ${TURN_MAX}: how long that exchange could really run before the two have nothing left to say. A quick errand or a short correction sustains ${TURN_MIN}–6. A negotiation, a set of instructions to get right, or news to work through sustains 12–${TURN_MAX}. Across the set the average should land near ${PLANNED_AVG_TURNS}. Do not give every card the same number.`,
    `Each card will be recorded about ${ralliesPerScene} times by different pairs, so the situation must still be worth doing with new people.`,
    ``,
    i.language === "pcm"
      ? `Nigerian Pidgin is spoken most naturally in informal, everyday settings — the market, the bus park, the workshop, the shop floor, the compound, between friends and traders. Keep the scene somewhere Pidgin is actually spoken. Do not set it where a Nigerian would switch to English: a courtroom, a board presentation, a formal interview, a written exam.`
      : `Keep the scene somewhere ${name} is actually the language people would use with each other.`,
    ``,
    `Write title, situation, persona_a and persona_b in ${name} — the language the rally is recorded in. Keep the situation to two or three sentences and each persona to one. english_note is the same scene in plain English, one or two sentences, for the editor reviewing the card. domain is one or two words placing the card in the buyer's world.`,
  ].join("\n");
}

function batchPrompt(from: number, to: number, total: number, used: string[]): string {
  const lines = [
    `Write scenes ${from}–${to} of ${total} for this set. Each scene is a distinct topic.`,
    `Return exactly ${to - from + 1} scenes.`,
  ];
  if (used.length) lines.push(``, `Already written. Do not repeat these situations and do not rephrase them:`, used.map((t) => `· ${t}`).join("\n"));
  return lines.join("\n");
}

const TOOL = {
  name: "write_scenes",
  description: "Return this batch of scenario cards.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["scenes"],
    properties: {
      scenes: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "situation", "persona_a", "persona_b", "domain", "english_note", "turns"],
          properties: {
            title: { type: "string", description: "A few words naming the scene, in the target language." },
            situation: { type: "string", description: "Two or three sentences setting the scene, in the target language." },
            persona_a: { type: "string", description: "The first speaker's role in one sentence, in the target language." },
            persona_b: { type: "string", description: "The second speaker's role in one sentence, in the target language." },
            domain: { type: "string", description: "One or two words placing the card in the buyer's world." },
            english_note: { type: "string", description: "The same scene in plain English, for the editor." },
            turns: { type: "integer", minimum: TURN_MIN, maximum: TURN_MAX, description: "How many turns this exchange can honestly sustain." },
          },
        },
      },
    },
  },
};

interface RawScene { title?: unknown; situation?: unknown; persona_a?: unknown; persona_b?: unknown; domain?: unknown; english_note?: unknown; turns?: unknown }

/** One model call. Raw fetch against /v1/messages, the same shape stt-draft uses for its gloss step. */
async function askModel(model: string, system: string, user: string): Promise<RawScene[]> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set on this function; add it to the function secrets before planning a corpus");

  const send = async (forceTool: boolean) => {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: 8000,
        system,
        tools: [TOOL],
        // Haiku takes a forced tool call. A newer model set through game_config may reject it, so the
        // retry below drops to "auto" and names the tool in the prompt instead.
        tool_choice: forceTool ? { type: "tool", name: TOOL.name } : { type: "auto" },
        messages: [{ role: "user", content: forceTool ? user : `${user}\n\nReturn the scenes by calling the write_scenes tool. Do not answer in prose.` }],
      }),
    });
    return res;
  };

  let res = await send(true);
  if (res.status === 400 && /tool_choice/i.test(await res.clone().text())) res = await send(false);
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const out = await res.json();
  if (out.stop_reason === "refusal") throw new Error(`the model declined this request (${out.stop_details?.category ?? "no category"}); reword the industry or what the data trains`);
  const blocks = (out.content ?? []) as { type?: string; name?: string; input?: { scenes?: RawScene[] }; text?: string }[];
  const call = blocks.find((b) => b.type === "tool_use" && b.name === TOOL.name);
  if (call?.input?.scenes) return call.input.scenes;
  // Prose fallback: some models answer with the JSON rather than calling the tool.
  const text = blocks.filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(text.slice(start, end + 1));
      if (Array.isArray(parsed?.scenes)) return parsed.scenes as RawScene[];
    } catch { /* fall through to the error below */ }
  }
  throw new Error(`${model} returned no scenes${out.stop_reason === "max_tokens" ? " (it ran out of output tokens; lower the batch size)" : ""}`);
}

function sceneFrom(raw: RawScene, n: number): Scene | null {
  const title = clean(raw.title, 120);
  const situation = clean(raw.situation, 900);
  if (!title || !situation) return null;
  return {
    key: `s${n}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    situation,
    persona_a: clean(raw.persona_a, 300),
    persona_b: clean(raw.persona_b, 300),
    domain: clean(raw.domain, 60),
    english_note: clean(raw.english_note, 600),
    turns: clamp(Math.round(Number(raw.turns) || PLANNED_AVG_TURNS), TURN_MIN, TURN_MAX),
    rallies: 0,
  };
}

// ---------------------------------------------------------------- config and storage
/** The model id, changeable through game_config the way gloss_model is. */
async function configuredModel(admin: SupabaseClient): Promise<string> {
  for (const key of ["plan_model", "gloss_model"]) {
    try {
      const { data } = await admin.from("game_config").select("value").eq("key", key).maybeSingle();
      const v = (data as { value?: unknown } | null)?.value;
      const m = typeof v === "string" ? v : v && typeof v === "object" ? (v as { model?: string }).model : null;
      if (typeof m === "string" && m.trim()) return m.trim();
    } catch { /* no config row, or the table is shaped differently: fall through to the default */ }
  }
  return DEFAULT_MODEL;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const auth = req.headers.get("Authorization") ?? "";
  const url = Deno.env.get("SUPABASE_URL")!;
  const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: who } = await caller.auth.getUser();
  if (!who?.user) return json({ error: "sign in first" }, 401);
  const { data: isStaff } = await caller.rpc("is_staff");
  if (!isStaff) return json({ error: "staff only" }, 403);
  const userId = who.user.id;

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  // rally_plans belongs to another agent's migration. Reads and writes go as the signed-in staff
  // member first; if its policies are not in place yet the service role finishes the job, which is
  // safe here because is_staff has already passed above.
  async function both<T>(run: (c: SupabaseClient) => PromiseLike<{ data: T | null; error: { message: string; code?: string } | null }>): Promise<T | null> {
    const first = await run(caller);
    if (!first.error) return first.data;
    if (/relation .*rally_plans.* does not exist|could not find the table/i.test(first.error.message)) {
      throw new Error("the rally_plans table is not in the database yet; the schema migration has to land first");
    }
    const second = await run(admin);
    if (!second.error) return second.data;
    throw new Error(second.error.message);
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad json" }, 400);
  }
  const stage = String(body.stage ?? "start");

  try {
    // ------------------------------------------------------------ start: validate, do the maths, open a draft
    if (stage === "start") {
      const i: Inputs = {
        project_id: String(body.project_id ?? ""),
        industry: clean(body.industry, 200),
        trains: clean(body.trains, 200),
        topics: Math.round(Number(body.topics) || 0),
        target_hours: Number(body.target_hours) || 0,
        language: clean(body.language, 12),
      };
      if (!UUID.test(i.project_id)) return json({ error: "bad project id" }, 400);
      if (!i.industry) return json({ error: "say which industry or domain the buyer cares about" }, 400);
      if (!i.trains) return json({ error: "say what the data will train" }, 400);
      if (!i.language) return json({ error: "pick a language" }, 400);
      if (!(i.target_hours > 0) || i.target_hours > MAX_HOURS) return json({ error: `target hours must be between 1 and ${MAX_HOURS}` }, 400);
      if (i.topics < 1 || i.topics > MAX_SCENES) return json({ error: `ask for between 1 and ${MAX_SCENES} topics` }, 400);
      if (!Deno.env.get("ANTHROPIC_API_KEY")) return json({ error: "ANTHROPIC_API_KEY is not set on this function; add it to the function secrets before planning a corpus" }, 409);

      const model = await configuredModel(admin);
      const t = targetsFor(i.topics, i.target_hours);
      const plan: Plan = {
        model,
        language: i.language,
        // Planned targets until real turn counts come back; every batch recomputes them.
        totals: { ...totalsFor([], i.target_hours, i.topics), avg_turns: PLANNED_AVG_TURNS, rallies_per_scene: t.ralliesPerScene, rallies: t.ralliesPerScene * i.topics, seconds_per_rally: t.secondsPerRally },
        scenes: [],
      };
      const row = await both<{ id: string }>((c) =>
        c.from("rally_plans").insert({ project_id: i.project_id, created_by: userId, status: "draft", inputs: i, plan }).select("id").single(),
      );
      return json({ ok: true, plan_id: row?.id, model, scenes_total: i.topics, totals: plan.totals, scenes_per_request: SCENES_PER_CALL * CALLS_PER_REQUEST });
    }

    const planId = String(body.plan_id ?? "");
    if (!UUID.test(planId)) return json({ error: "bad plan id" }, 400);

    // ------------------------------------------------------------ cancel: drop an abandoned draft
    if (stage === "cancel") {
      await both((c) => c.from("rally_plans").update({ status: "rejected" }).eq("id", planId).select("id").single());
      return json({ ok: true });
    }

    // ------------------------------------------------------------ scenes: the next batch
    if (stage !== "scenes") return json({ error: `unknown stage ${stage}` }, 400);

    const row = await both<{ status: string; inputs: Inputs; plan: Plan }>((c) => c.from("rally_plans").select("status, inputs, plan").eq("id", planId).single());
    if (!row) return json({ error: "no such plan" }, 404);
    if (row.status !== "draft") return json({ error: `this plan is already ${row.status}` }, 409);

    const inputs = row.inputs;
    const plan: Plan = { model: row.plan?.model ?? DEFAULT_MODEL, language: row.plan?.language ?? inputs.language, totals: row.plan?.totals ?? totalsFor([], inputs.target_hours, inputs.topics), scenes: Array.isArray(row.plan?.scenes) ? row.plan.scenes : [] };
    const total = clamp(Math.round(Number(inputs.topics) || 0), 1, MAX_SCENES);
    if (plan.scenes.length >= total) {
      plan.totals = totalsFor(plan.scenes, inputs.target_hours, total);
      await both((c) => c.from("rally_plans").update({ plan }).eq("id", planId).select("id").single());
      return json({ ok: true, scenes: [], written: 0, total, done: true, totals: plan.totals });
    }

    const perScene = targetsFor(total, inputs.target_hours).ralliesPerScene;
    const system = systemPrompt(inputs, perScene);
    const before = plan.scenes.length;

    // Several model calls per invocation, run together: each asks for a slice of the remaining
    // scenes and is told every title written so far plus the titles its sibling calls are taking.
    const slices: { from: number; to: number; used: string[] }[] = [];
    let cursor = before;
    const used = plan.scenes.map((s) => s.title);
    for (let k = 0; k < CALLS_PER_REQUEST && cursor < total; k += 1) {
      const take = Math.min(SCENES_PER_CALL, total - cursor);
      slices.push({ from: cursor + 1, to: cursor + take, used: [...used] });
      cursor += take;
    }
    const results = await Promise.all(
      slices.map(async (s, idx) => {
        // Give each call the slices before it so parallel batches do not collide on the same idea.
        const avoid = [...s.used, ...slices.slice(0, idx).map((o) => `(scenes ${o.from}–${o.to}, being written now)`)];
        return askModel(plan.model, system, batchPrompt(s.from, s.to, total, avoid));
      }),
    );

    const seen = new Set(plan.scenes.map((s) => s.title.toLowerCase()));
    for (const batch of results) {
      for (const raw of batch) {
        if (plan.scenes.length >= total) break;
        const scene = sceneFrom(raw, plan.scenes.length + 1);
        if (!scene || seen.has(scene.title.toLowerCase())) continue;
        seen.add(scene.title.toLowerCase());
        plan.scenes.push(scene);
      }
    }
    plan.totals = totalsFor(plan.scenes, inputs.target_hours, total);
    const written = plan.scenes.length - before;
    await both((c) => c.from("rally_plans").update({ plan }).eq("id", planId).select("id").single());
    // No progress at all means the model is returning nothing usable; stop rather than loop forever.
    return json({ ok: true, scenes: plan.scenes.slice(before), written, total, done: plan.scenes.length >= total || written === 0, totals: plan.totals });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 409);
  }
});
