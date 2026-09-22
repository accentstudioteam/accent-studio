// Builds a delivery bundle. Admins only. Two stages, driven by the studio:
//   POST {delivery_id, stage: "audio", offset}  copies a batch of take files into the deliveries bucket, hashing each
//   POST {delivery_id, stage: "meta"}           writes manifest.jsonl, alignments.jsonl, speakers.jsonl, consent_log.jsonl,
//                                               index.csv, README.md and checksums.txt, then marks the delivery ready.
// The bundle follows the sample delivery's schema (multiling_conversational v1.1) with the async layout: one
// audio file per turn, english_gloss with english_source kept as its alias, alignments typed, consent fingerprints.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const BATCH = 24;

interface Turn { turn_id: string; turn_no: number; attempt: number; speaker_id: string; channel: number; seconds: number; audio_path: string; created_at: string; verified_text: string | null; english_gloss: string | null; emotion_label: string | null; confidence: number | null; issues: string[]; verified_seconds: number | null; alignments: { src: { text: string } | null; tgt: { text: string } | null; type: string; confidence: number }[]; aligner: string | null; raw_stt_text: string | null; raw_stt_engine: string | null; raw_stt_confidence: number | null; draft_wer: number | null; peer_rating: Record<string, number> | null }
interface Session { session_id: string; mode?: string; locale: string; language: string; scenario: string | null; scenario_title: string; scenario_prompt_hash: string | null; card_version: number; recorded_at: string; completed_at: string; abandoned_reason: string | null; flags: string[]; speaker_a: string; speaker_b: string | null; persona_a: string; persona_b: string; verification: { editor_id: string | null; verified_at: string; editor_score: number; peer_score: number | null; quality_score: number; quality_tier: string; verified_seconds: number; audit_pick: boolean; audit_outcome: string | null; audit_editor_id: string | null; audited_at: string | null; aligned_turns: number | null; confidence: number | null }; turns: Turn[] }
interface Speaker { speaker_id: string; languages: string[]; primary_language: string | null; country: string | null; city: string | null; age_band: string | null; gender: string | null; device: string | null; consent: { agreement_version: string; agreement_sha256: string; accepted_terms: boolean; biometric_consent: boolean; signed_at: string; signature_method: string; record_sha256: string } | null }
interface FileRow { turn_id: string; path: string; bytes: number | null; sha256: string | null }
interface Payload { delivery: { id: string; bundle_id: string; schema_version: string; created_at: string; status: string; session_count: number; speaker_count: number; seconds: number; files_total: number; files_done: number; note: string | null }; project: { id: string; name: string; buyer: string; language: string; locale: string; tier: string; target_hours: number }; agreement: { version: string; document_id: string; sha256: string; url: string } | null; sessions: Session[]; speakers: Speaker[]; files: FileRow[] }

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
  const h = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const ext = (p: string) => p.split(".").pop() ?? "webm";
const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const hours = (s: number) => (s / 3600).toFixed(2);

/** The audio path inside the bundle for a turn. */
const bundleAudioPath = (bundle: string, s: Session, t: Turn) => `${bundle}/audio/${s.locale}/${s.session_id}/turn-${String(t.turn_no).padStart(2, "0")}-${t.speaker_id}.${ext(t.audio_path)}`;

function licenseFor(tier: string, bundle: string, buyer: string) {
  return { type: tier === "exclusive" ? "commercial_exclusive" : "commercial_non_exclusive", territory: "worldwide", term: "perpetual", license_id: `LIC-${bundle}`, buyer_ref: buyer ? `buyer_${buyer.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 24)}` : "buyer_unassigned" };
}

function manifestRow(p: Payload, s: Session, fileOf: Map<string, FileRow>) {
  const bundle = p.delivery.bundle_id;
  const speakerOf = new Map(p.speakers.map((k) => [k.speaker_id, k]));
  const participant = (id: string | null, channel: number, persona: string) => {
    if (!id) return null;
    const k = speakerOf.get(id);
    return { speaker_id: id, channel, role: channel === 0 ? "speaker_a" : "speaker_b", persona_card: persona, demographics: { age_band: k?.age_band ?? null, gender: k?.gender ?? null, accent_region: [k?.city, k?.country].filter(Boolean).join("_") || null }, consent_record_sha256: k?.consent?.record_sha256 ?? null };
  };
  const turns = s.turns.map((t) => {
    const f = fileOf.get(t.turn_id);
    return {
      turn_id: t.turn_no, speaker_id: t.speaker_id, channel: t.channel, audio_file: f ? f.path.slice(bundle.length + 1) : null, audio_sha256: f?.sha256 ?? null, audio_bytes: f?.bytes ?? null,
      start_ms: 0, end_ms: Math.round(Number(t.verified_seconds ?? t.seconds) * 1000), recorded_at: t.created_at, attempt: t.attempt,
      raw_stt_text: t.raw_stt_text, raw_stt_engine: t.raw_stt_engine, raw_stt_confidence: t.raw_stt_confidence, raw_stt_wer: t.draft_wer,
      verified_text: t.verified_text, english_gloss: t.english_gloss, english_source: t.english_gloss, emotion_label: t.emotion_label, editor_confidence: t.confidence, issues: t.issues ?? [],
      inter_turn_latency_ms: 0, latency_source: s.mode === "live" ? "live_unsegmented" : "async_none", code_switches: [], pii_redactions: [],
      peer_rating: t.peer_rating,
      alignments: (t.alignments ?? []).map((a) => ({ src_span: a.src?.text ?? "", tgt_span: a.tgt?.text ?? "", type: a.type, confidence: a.confidence, reviewer_id: t.aligner ?? s.verification.editor_id ?? null })),
    };
  });
  const v = s.verification;
  return {
    session_id: s.session_id, corpus_id: bundle, bundle_id: p.delivery.schema_version, locale: s.locale, scenario: s.scenario, scenario_title: s.scenario_title, scenario_prompt_hash: s.scenario_prompt_hash, card_version: s.card_version,
    prompt_direction: "target_native", modality: s.mode === "live" ? "live_scene" : "async_voice_notes", audio_layout: s.mode === "live" ? "per_speaker_tracks" : "per_turn_files", channels: s.mode === "live" ? 2 : null, sample_rate_hz: null, bit_depth: null,
    duration_seconds: Number(Number(v.verified_seconds).toFixed(3)), recorded_at: s.recorded_at, completed_at: s.completed_at, latency_source: s.mode === "live" ? "live_unsegmented" : "async_none", recording_environment: null, device_class: null,
    closed_early: s.abandoned_reason ?? null, game_flags: s.flags ?? [],
    participants: [participant(s.speaker_a, 0, s.persona_a), participant(s.speaker_b, 1, s.persona_b)].filter(Boolean),
    verified_by_qc: { editor_id: v.editor_id, verification_timestamp: v.verified_at, confidence_score: v.confidence, editor_score: v.editor_score, peer_score: v.peer_score, quality_score: v.quality_score, quality_tier: v.quality_tier, audit_status: v.audit_outcome ? `audited_${v.audit_outcome}` : v.audit_pick ? "sampled_pending" : "not_sampled", audit_reviewer_id: v.audit_editor_id ?? null, audit_timestamp: v.audited_at ?? null, audit_notes: "" },
    license: licenseFor(p.project.tier, bundle, p.project.buyer),
    turns,
  };
}

function readme(p: Payload, rows: Record<string, unknown>[], manifestSha: string): string {
  const d = p.delivery;
  const a = p.agreement;
  return [
    `# ${d.bundle_id}`, "",
    `Accent Studio delivery for ${p.project.name} (${p.project.locale}). Schema ${d.schema_version}, async layout. Built ${new Date().toISOString().slice(0, 19)}Z.`, "",
    `Sessions ${rows.length} · speakers ${d.speaker_count} · verified audio ${hours(Number(d.seconds))} h · licence ${licenseFor(p.project.tier, d.bundle_id, p.project.buyer).type}.`, "",
    "## Files", "",
    "- manifest.jsonl: one row per session, with every turn: raw machine transcript and engine, the linguist's verified transcript, the English gloss (english_source kept as an alias of english_gloss), emotion label, editor confidence, peer ratings, typed word alignments with the aligner's id, and the audio file per turn with its SHA-256.",
    "- alignments.jsonl: the same alignments as a flat file, one row per link (session_id, turn_id, src_span, tgt_span, type, confidence, reviewer_id).",
    "- speakers.jsonl: one row per speaker: pseudonymous speaker id, languages, country, city, age band, self-described gender, consent record fingerprint. No identity data.",
    "- consent_log.jsonl: one row per speaker per Annex A of the Contributor Agreement: agreement version and SHA-256, the two consents, signing timestamp and method, the consent record fingerprint. Present a fingerprint to Accent Studio to confirm a valid record exists.",
    "- index.csv: a denormalised turn-level index for filtering.",
    "- checksums.txt: SHA-256 of every file in the bundle.",
    "- audio/<locale>/<session_id>/turn-NN-<speaker_id>.<ext>: one file per turn, as captured on the contributor's phone (Opus in WebM or MP4, no resampling). 24 kHz stereo WAV masters are the Live Arena format and do not apply to async rallies.", "",
    "## Notes on this layout", "",
    "- Async rallies are voice notes exchanged in turns, so inter_turn_latency_ms is 0 with latency_source async_none. Live scenes (modality live_scene) carry one whole-scene track per speaker, recorded on each phone (audio_layout per_speaker_tracks); turn segmentation and measured inter-turn latency are not yet produced, hence latency_source live_unsegmented.",
    "- audit_status sampled_pending marks sessions drawn for random re-audit whose audit has not run yet; audited_upheld and audited_adjusted name the outcome with the auditor's id and timestamp. An adjusted audit re-scores the session; the tier here is the audited one.",
    "- Sessions closed early because a partner stopped replying are included when the remaining takes were verified; closed_early says so.",
    "- Every speaker in this bundle signed the Contributor Agreement" + (a ? ` v${a.version} (document ${a.document_id}, SHA-256 ${a.sha256}, ${a.url})` : "") + ". Buyers may never identify a speaker, clone an individual voice, verify identity with it, surveil anyone, or pass the raw data on (clause 5).", "",
    `manifest.jsonl SHA-256: ${manifestSha}`, "",
  ].join("\n");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const auth = req.headers.get("Authorization") ?? "";
  const url = Deno.env.get("SUPABASE_URL")!;
  const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: who } = await caller.auth.getUser();
  if (!who?.user) return json({ error: "sign in first" }, 401);
  const { data: isAdmin } = await caller.rpc("is_admin");
  if (!isAdmin) return json({ error: "admins only" }, 403);

  let body: { delivery_id?: string; stage?: string; offset?: number } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad json" }, 400);
  }
  if (!UUID.test(body.delivery_id ?? "")) return json({ error: "bad delivery id" }, 400);
  const { data: payload, error: pErr } = await caller.rpc("delivery_payload", { did: body.delivery_id });
  if (pErr || !payload) return json({ error: pErr?.message ?? "no such delivery" }, 404);
  const p = payload as Payload;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const bundle = p.delivery.bundle_id;

  if (body.stage === "audio") {
    const all = p.sessions.flatMap((s) => s.turns.map((t) => ({ s, t })));
    const done = new Set(p.files.filter((f) => f.sha256).map((f) => f.turn_id));
    const todo = all.filter((x) => !done.has(x.t.turn_id));
    const batch = todo.slice(0, BATCH);
    let copied = 0;
    const errors: string[] = [];
    for (const { s, t } of batch) {
      try {
        const { data: blob, error } = await admin.storage.from("sessions").download(t.audio_path);
        if (error || !blob) throw new Error(error?.message ?? "missing audio");
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const sha = await sha256Hex(bytes);
        const path = bundleAudioPath(bundle, s, t);
        const { error: upErr } = await admin.storage.from("deliveries").upload(path, bytes, { contentType: blob.type || "application/octet-stream", upsert: true });
        if (upErr) throw new Error(upErr.message);
        await caller.rpc("delivery_file_done", { did: p.delivery.id, tid: t.turn_id, path, bytes: bytes.byteLength, sha256: sha });
        copied += 1;
      } catch (e) {
        errors.push(`${t.turn_id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    const remaining = todo.length - copied;
    return json({ ok: true, copied, remaining, total: all.length, errors: errors.slice(0, 5) });
  }

  if (body.stage === "meta") {
    const fileOf = new Map(p.files.map((f) => [f.turn_id, f]));
    const missing = p.sessions.flatMap((s) => s.turns).filter((t) => !fileOf.get(t.turn_id)?.sha256).length;
    if (missing > 0) return json({ error: `${missing} audio file(s) not copied yet; run the audio stage first` }, 409);
    const rows = p.sessions.map((s) => manifestRow(p, s, fileOf));
    const manifest = rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
    const alignments = rows.flatMap((r) => (r.turns as { turn_id: number; alignments: Record<string, unknown>[] }[]).flatMap((t) => t.alignments.map((a) => JSON.stringify({ session_id: r.session_id, turn_id: t.turn_id, ...a })))).join("\n") + "\n";
    const speakers = p.speakers.map((k) => JSON.stringify({ speaker_id: k.speaker_id, languages: k.languages, primary_language: k.primary_language, country: k.country, accent_region: [k.city, k.country].filter(Boolean).join("_") || null, age_band: k.age_band, gender: k.gender, device_class: k.device, consent_record_sha256: k.consent?.record_sha256 ?? null })).join("\n") + "\n";
    const consent = p.speakers.map((k) => JSON.stringify({ speaker_id: k.speaker_id, ...(k.consent ?? {}) })).join("\n") + "\n";
    const index = [["session_id", "locale", "scenario", "turn_id", "speaker_id", "channel", "seconds", "quality_tier", "emotion_label", "editor_confidence", "raw_stt_wer", "alignments", "verified_text", "english_gloss", "audio_file"].join(",")]
      .concat(rows.flatMap((r) => (r.turns as Record<string, unknown>[]).map((t) => [r.session_id, r.locale, r.scenario, t.turn_id, t.speaker_id, t.channel, (Number(t.end_ms) / 1000).toFixed(1), (r.verified_by_qc as { quality_tier: string }).quality_tier, t.emotion_label, t.editor_confidence, t.raw_stt_wer, (t.alignments as unknown[]).length, t.verified_text, t.english_gloss, t.audio_file].map(csvCell).join(","))))
      .join("\n") + "\n";
    const manifestSha = await sha256Hex(new TextEncoder().encode(manifest));
    const texts: Record<string, string> = { "manifest.jsonl": manifest, "alignments.jsonl": alignments, "speakers.jsonl": speakers, "consent_log.jsonl": consent, "index.csv": index, "README.md": readme(p, rows, manifestSha) };
    const listed: { path: string; bytes: number; sha256: string }[] = [];
    for (const [name, text] of Object.entries(texts)) {
      const bytes = new TextEncoder().encode(text);
      const { error } = await admin.storage.from("deliveries").upload(`${bundle}/${name}`, bytes, { contentType: name.endsWith(".csv") ? "text/csv" : name.endsWith(".md") ? "text/markdown" : "application/x-ndjson", upsert: true });
      if (error) {
        await caller.rpc("delivery_finish", { did: p.delivery.id, status: "failed", manifest_sha256: null, bundle_files: null, error: `${name}: ${error.message}` });
        return json({ error: `${name}: ${error.message}` }, 500);
      }
      listed.push({ path: `${bundle}/${name}`, bytes: bytes.byteLength, sha256: await sha256Hex(bytes) });
    }
    for (const f of p.files) listed.push({ path: f.path, bytes: f.bytes ?? 0, sha256: f.sha256 ?? "" });
    const checksums = listed.map((f) => `${f.sha256}  ${f.path.slice(bundle.length + 1)}`).join("\n") + "\n";
    const cBytes = new TextEncoder().encode(checksums);
    await admin.storage.from("deliveries").upload(`${bundle}/checksums.txt`, cBytes, { contentType: "text/plain", upsert: true });
    listed.push({ path: `${bundle}/checksums.txt`, bytes: cBytes.byteLength, sha256: await sha256Hex(cBytes) });
    await caller.rpc("delivery_finish", { did: p.delivery.id, status: "ready", manifest_sha256: manifestSha, bundle_files: listed, error: null });
    return json({ ok: true, manifest_sha256: manifestSha, files: listed.length, sessions: rows.length, preview: rows[0] ?? null });
  }

  return json({ error: "stage must be audio or meta" }, 400);
});
