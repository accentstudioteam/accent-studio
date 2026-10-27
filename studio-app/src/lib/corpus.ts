// Corpus planning: the founder answers a few questions about a project, a model drafts the whole set
// of scenes, and on approval the scenes become scenario cards with unclaimed rallies behind them.
// Admins only. The drafting runs in the plan-corpus edge function; this drives it in batches and
// keeps the arithmetic identical on both sides so an edited plan still adds up.
//
// rally_plans (id, project_id, created_by, created_at, status, inputs, plan, approved_at) and
// pp_spawn(card uuid, n int) belong to the database agent's migration.
import { supabase } from "@/lib/supabase";
import { isDemo } from "@/lib/demo";

export const TURN_CAP_SECONDS = 30;
export const TURN_AVG_SECONDS = 20;
export const TURN_MIN = 4;
export const TURN_MAX = 16;

export interface PlanInputs {
  project_id: string;
  industry: string;
  trains: string;
  topics: number;
  target_hours: number;
  language: string;
}
export interface PlanScene {
  key: string;
  title: string;
  situation: string;
  persona_a: string;
  persona_b: string;
  domain: string;
  english_note: string;
  turns: number;
  rallies: number;
  /** Set when the plan is approved and the scene becomes a card. */
  card_id?: string;
}
export interface PlanTotals {
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
export interface CorpusPlan {
  model: string;
  language: string;
  totals: PlanTotals;
  scenes: PlanScene[];
}
export interface PlanRow {
  id: string;
  project_id: string;
  created_by: string | null;
  created_at: string;
  status: "draft" | "approved" | "rejected";
  inputs: PlanInputs;
  plan: CorpusPlan;
  approved_at: string | null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** The same sum the edge function does, re-run whenever the admin edits a turn count or drops a
 *  scene: one round of the whole set yields sum(turns) × 20 s, and the set runs as many rounds as
 *  the hours need. Every scene is recorded the same number of times, so topics stay balanced. */
export function recomputeTotals(scenes: PlanScene[], targetHours: number, scenesTarget: number): PlanTotals {
  const targetSeconds = Math.round(targetHours * 3600);
  const turnsPerRound = scenes.reduce((n, s) => n + s.turns, 0);
  const secondsPerRound = turnsPerRound * TURN_AVG_SECONDS;
  const ralliesPerScene = secondsPerRound > 0 ? Math.max(1, Math.ceil(targetSeconds / secondsPerRound)) : 0;
  const rallies = ralliesPerScene * scenes.length;
  const turns = turnsPerRound * ralliesPerScene;
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

/** Each scene carries the rally count the current totals imply. */
export function withRallies(scenes: PlanScene[], totals: PlanTotals): PlanScene[] {
  return scenes.map((s) => ({ ...s, rallies: totals.rallies_per_scene }));
}

interface StartReply { ok?: boolean; error?: string; plan_id?: string; model?: string; scenes_total?: number; totals?: PlanTotals }
interface BatchReply { ok?: boolean; error?: string; scenes?: PlanScene[]; written?: number; total?: number; done?: boolean; totals?: PlanTotals }

async function call<T>(body: Record<string, unknown>): Promise<T> {
  if (isDemo()) throw new Error("Corpus planning is turned off inside the chat demo.");
  const { data, error } = await supabase.functions.invoke("plan-corpus", { body });
  if (error) {
    // The function answers 4xx with a readable reason; surface that rather than "non-2xx status".
    const ctx = (error as { context?: Response }).context;
    let detail: string | null = null;
    if (ctx && typeof ctx.clone === "function") {
      try {
        const body = await ctx.clone().json();
        if (body?.error) detail = String(body.error);
      } catch { /* the body was not json, or was already read */ }
    }
    throw new Error(detail ?? error.message);
  }
  if ((data as { error?: string })?.error) throw new Error(String((data as { error?: string }).error));
  return data as T;
}

/** Opens a draft in rally_plans and returns the targets the arithmetic produced. */
export const startPlan = (inputs: PlanInputs): Promise<StartReply> => call<StartReply>({ stage: "start", ...inputs });

/** One batch of scenes. The function writes them into the plan itself. */
export const planBatch = (planId: string): Promise<BatchReply> => call<BatchReply>({ stage: "scenes", plan_id: planId });

export const cancelPlan = (planId: string): Promise<{ ok?: boolean }> => call<{ ok?: boolean }>({ stage: "cancel", plan_id: planId });

/** Drafts the whole set: start, then batch after batch until every scene is written. */
export async function draftPlan(inputs: PlanInputs, onProgress: (text: string) => void): Promise<{ planId: string; model: string; scenes: PlanScene[]; totals: PlanTotals }> {
  const started = await startPlan(inputs);
  if (!started.plan_id) throw new Error("the planner did not open a draft");
  const total = started.scenes_total ?? inputs.topics;
  onProgress(`Planning ${total} scenes with ${started.model ?? "the configured model"}…`);
  const scenes: PlanScene[] = [];
  let totals = started.totals ?? recomputeTotals([], inputs.target_hours, total);
  for (let guard = 0; guard < 120; guard += 1) {
    const step = await planBatch(started.plan_id);
    scenes.push(...(step.scenes ?? []));
    if (step.totals) totals = step.totals;
    onProgress(`Writing scenes · ${scenes.length} of ${step.total ?? total}`);
    if (step.done || !step.written) break;
  }
  if (!scenes.length) throw new Error("the model returned no usable scenes");
  return { planId: started.plan_id, model: started.model ?? "", scenes, totals };
}

export async function listPlans(projectId: string): Promise<PlanRow[]> {
  if (isDemo()) return [];
  const { data, error } = await supabase.from("rally_plans").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as PlanRow[];
}

export async function rejectPlan(planId: string): Promise<void> {
  const { error } = await supabase.from("rally_plans").update({ status: "rejected" }).eq("id", planId);
  if (error) throw new Error(error.message);
}

/** Releases an approved plan: one active scenario card per scene, then pp_spawn to put the
 *  unclaimed rallies behind it. The plan row keeps the scenes as approved, with their card ids. */
export async function approvePlan(
  planId: string,
  scenes: PlanScene[],
  language: string,
  targetHours: number,
  scenesTarget: number,
  model: string,
  onProgress: (text: string) => void,
): Promise<{ cards: number; rallies: number }> {
  if (isDemo()) throw new Error("Releasing a plan is turned off inside the chat demo.");
  if (!scenes.length) throw new Error("there are no scenes left to release");
  const totals = recomputeTotals(scenes, targetHours, scenesTarget);
  const priced = withRallies(scenes, totals);

  const { data: who } = await supabase.auth.getUser();
  onProgress(`Creating ${priced.length} scenario cards…`);
  const { data: made, error: cardErr } = await supabase
    .from("scenario_cards")
    .insert(
      priced.map((s) => ({
        language,
        title: s.title,
        situation: s.situation,
        persona_a: s.persona_a,
        persona_b: s.persona_b,
        domain: s.domain,
        english_note: s.english_note || null,
        audio_path: null,
        status: "active",
        author: "corpus plan",
        created_by: who?.user?.id ?? null,
      })),
    )
    .select("id");
  if (cardErr) throw new Error(cardErr.message);
  const ids = ((made ?? []) as { id: string }[]).map((r) => r.id);
  if (ids.length !== priced.length) throw new Error(`created ${ids.length} cards for ${priced.length} scenes; nothing was spawned`);

  let rallies = 0;
  for (let i = 0; i < priced.length; i += 1) {
    const { error } = await supabase.rpc("pp_spawn", { card: ids[i], n: priced[i].rallies });
    if (error) throw new Error(`${priced[i].title}: ${error.message} (${rallies} rallies were already spawned)`);
    rallies += priced[i].rallies;
    onProgress(`Spawning rallies · ${i + 1} of ${priced.length} scenes · ${rallies} rallies`);
  }

  const plan: CorpusPlan = { model, language, totals, scenes: priced.map((s, i) => ({ ...s, card_id: ids[i] })) };
  const { error: planErr } = await supabase.from("rally_plans").update({ status: "approved", approved_at: new Date().toISOString(), plan }).eq("id", planId);
  if (planErr) throw new Error(`the cards and rallies are live, but the plan could not be marked approved: ${planErr.message}`);
  return { cards: ids.length, rallies };
}
