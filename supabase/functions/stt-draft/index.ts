// Machine first-pass transcripts for a rally's takes. Staff only. Reads the routing per language
// from game_config (stt_routing), picks the vendor whose key is present, stores one draft per take.
// The draft is raw_stt_text in the delivery schema: it speeds the editor up and measures the vendor.
// It never grades a contributor and is never shown to one.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const WHISPER_VERSION = "8099696689d249cf8b122d833c36ac3f75505c666a395ca40ef26f68e7d3d16e"; // openai/whisper large-v3 on Replicate
const WHISPER_LANGS = new Set(["en", "yo", "ha", "sw", "am", "af", "ar", "fr", "pt", "so", "sn", "ln", "mg"]); // codes Whisper accepts among the ones we may route
const SPITCH_LANGS = new Set(["yo", "ha", "ig", "en", "am"]);

interface Item { turn_id: string; audio_path: string; language: string; seconds: number }
interface Route { engine: string; language: string | null; show?: boolean; note?: string }
interface Result { engine: string; text: string; confidence: number | null; detected_language: string | null; segments: unknown }

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const mimeFor = (path: string) => ({ webm: "audio/webm", mp4: "audio/mp4", m4a: "audio/mp4", ogg: "audio/ogg", wav: "audio/wav", mp3: "audio/mpeg" })[path.split(".").pop() ?? ""] ?? "application/octet-stream";

/** Mean segment log-probability turned into a 0..1 confidence, when the vendor gives one. */
function confidenceFrom(segments: unknown): number | null {
  if (!Array.isArray(segments) || segments.length === 0) return null;
  const lps = segments.map((s) => (s && typeof s === "object" ? (s as { avg_logprob?: number }).avg_logprob : undefined)).filter((x): x is number => typeof x === "number");
  if (!lps.length) return null;
  const mean = lps.reduce((a, b) => a + b, 0) / lps.length;
  return Math.round(Math.min(1, Math.max(0, Math.exp(mean))) * 100) / 100;
}

async function openaiWhisper(audioUrl: string, path: string, lang: string | null): Promise<Result> {
  const key = Deno.env.get("OPENAI_API_KEY")!;
  const bytes = await (await fetch(audioUrl)).arrayBuffer();
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: mimeFor(path) }), `take.${path.split(".").pop()}`);
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("temperature", "0");
  if (lang && WHISPER_LANGS.has(lang)) form.append("language", lang);
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
  if (!res.ok) throw new Error(`openai ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const out = await res.json();
  return { engine: "whisper-1@openai", text: String(out.text ?? ""), confidence: confidenceFrom(out.segments), detected_language: out.language ?? null, segments: out.segments ?? null };
}

async function replicateWhisper(audioUrl: string, lang: string | null): Promise<Result> {
  const token = Deno.env.get("REPLICATE_API_TOKEN")!;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "wait=60" };
  const input = { audio: audioUrl, model: "large-v3", transcription: "plain text", language: lang && WHISPER_LANGS.has(lang) ? lang : "auto", temperature: 0, condition_on_previous_text: false };
  let res = await fetch("https://api.replicate.com/v1/predictions", { method: "POST", headers, body: JSON.stringify({ version: WHISPER_VERSION, input }) });
  if (!res.ok) throw new Error(`replicate ${res.status}: ${(await res.text()).slice(0, 200)}`);
  let p = await res.json();
  const started = Date.now();
  while (p.status !== "succeeded" && p.status !== "failed" && p.status !== "canceled") {
    if (Date.now() - started > 110_000) throw new Error("replicate: still running after 110 s");
    await sleep(2500);
    res = await fetch(p.urls.get, { headers: { Authorization: `Bearer ${token}` } });
    p = await res.json();
  }
  if (p.status !== "succeeded") throw new Error(`replicate ${p.status}: ${String(p.error ?? "").slice(0, 200)}`);
  const out = p.output ?? {};
  return { engine: "whisper-large-v3@replicate", text: String(out.transcription ?? ""), confidence: confidenceFrom(out.segments), detected_language: out.detected_language ?? null, segments: out.segments ?? null };
}

async function spitch(audioUrl: string, path: string, lang: string | null): Promise<Result> {
  const key = Deno.env.get("SPITCH_API_KEY")!;
  if (!lang || !SPITCH_LANGS.has(lang)) throw new Error(`spitch does not list ${lang ?? "auto"}`);
  const bytes = await (await fetch(audioUrl)).arrayBuffer();
  const form = new FormData();
  form.append("content", new Blob([bytes], { type: mimeFor(path) }), `take.${path.split(".").pop()}`);
  form.append("language", lang);
  const res = await fetch("https://api.spi-tch.com/v1/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
  if (!res.ok) throw new Error(`spitch ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const out = await res.json();
  return { engine: "spitch", text: String(out.text ?? ""), confidence: null, detected_language: lang, segments: out.timestamps ?? null };
}

/** Which adapter to use for the route, or why none can run. */
function resolve(route: Route): { run?: (url: string, path: string, lang: string | null) => Promise<Result>; reason?: string } {
  switch (route.engine) {
    case "whisper":
      if (Deno.env.get("OPENAI_API_KEY")) return { run: (u, p, l) => openaiWhisper(u, p, l) };
      if (Deno.env.get("REPLICATE_API_TOKEN")) return { run: (u, _p, l) => replicateWhisper(u, l) };
      return { reason: "no speech vendor key is set (add OPENAI_API_KEY or REPLICATE_API_TOKEN to the function secrets)" };
    case "spitch":
      if (Deno.env.get("SPITCH_API_KEY")) return { run: (u, p, l) => spitch(u, p, l) };
      return { reason: "SPITCH_API_KEY is not set" };
    case "mms":
      return { reason: "MMS is not hosted yet; route this language to whisper or spitch for now" };
    case "none":
      return { reason: "no draft engine is configured for this language" };
    default:
      return { reason: `unknown engine ${route.engine}` };
  }
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

  let body: { session_id?: string; retry?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad json" }, 400);
  }
  if (!UUID.test(body.session_id ?? "")) return json({ error: "bad session id" }, 400);

  const { data: q, error: qErr } = await caller.rpc("stt_queue", { sid: body.session_id, retry: Boolean(body.retry) });
  if (qErr) return json({ error: qErr.message }, 409);
  const items = (q?.items ?? []) as Item[];
  const route = (q?.route ?? { engine: "none", language: null }) as Route;
  const store = (tid: string, status: "done" | "failed" | "skipped", r: Partial<Result> & { error?: string | null }, ms: number) =>
    caller.rpc("stt_store", { tid, status, engine: r.engine ?? route.engine, text_: r.text ?? null, confidence: r.confidence ?? null, detected_language: r.detected_language ?? null, segments: r.segments ?? null, error: r.error ?? null, ms });

  if (items.length === 0) return json({ ok: true, done: 0, failed: 0, skipped: 0 });
  const picked = resolve(route);
  if (!picked.run) {
    await Promise.all(items.map((it) => store(it.turn_id, "skipped", { error: picked.reason }, 0)));
    return json({ ok: true, done: 0, failed: 0, skipped: items.length, reason: picked.reason });
  }

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let done = 0;
  let failed = 0;
  await Promise.all(items.map(async (it) => {
    const t0 = Date.now();
    try {
      const { data: signed, error } = await admin.storage.from("sessions").createSignedUrl(it.audio_path, 900);
      if (error || !signed?.signedUrl) throw new Error(`no audio: ${error?.message ?? it.audio_path}`);
      const r = await picked.run!(signed.signedUrl, it.audio_path, route.language);
      await store(it.turn_id, "done", r, Date.now() - t0);
      done += 1;
    } catch (e) {
      await store(it.turn_id, "failed", { error: e instanceof Error ? e.message : String(e) }, Date.now() - t0);
      failed += 1;
    }
  }));
  return json({ ok: true, done, failed, skipped: 0, engine: route.engine });
});
