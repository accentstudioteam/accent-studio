import { useCallback, useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { LANG_NAME } from "@/lib/game";
import { when } from "@/lib/verify";
import { RATE_MAX, RATE_MIN, TIER_LABEL, buildBundle, createDelivery, deliveries as listDeliveries, deliveryPlan, downloadBundle, hoursOf, manifestPreview, projects as listProjects, rateOf, saveProject, setProjectRate, sizeOf, type Delivery, type Plan, type Project, type ProjectInput, type Tier } from "@/lib/projects";
import { money } from "@/lib/earn";
import { TURN_CAP_SECONDS, TURN_MAX, TURN_MIN, approvePlan, cancelPlan, draftPlan, listPlans, recomputeTotals, rejectPlan, type PlanInputs, type PlanRow, type PlanScene } from "@/lib/corpus";
import { isDemo } from "@/lib/demo";

interface Props {
  onBack: () => void;
  embedded?: boolean;
}

const EMPTY: ProjectInput = { id: null, name: "", buyer: "", language: "pcm", target_hours: 50, tier: "standard", deadline: null, status: "open", notes: "" };

/** Founder view: what each lab ordered, what is verified and ready for it, and the bundles handed over. */
export function Projects({ onBack, embedded }: Props) {
  const [rows, setRows] = useState<Project[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState<ProjectInput | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await listProjects();
      setRows(next);
      setErr(null);
      setOpen((o) => o ?? next[0]?.id ?? null);
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "Couldn't load the projects.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!form) return;
    try {
      await saveProject(form);
      setForm(null);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "Couldn't save the project.");
    }
  };

  const body = (
    <div className="shell" style={{ maxWidth: 720 }}>
      <div className="spread" style={{ marginBottom: 16, alignItems: "flex-start" }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Labs · orders and bundles</div>
          <h1 className="h1">Projects{rows ? ` · ${rows.length}` : ""}</h1>
        </div>
        <button className="pill mint" style={{ flex: "none", width: "auto" }} onClick={() => setForm(form ? null : { ...EMPTY })}>{form ? "Close" : "New project"}</button>
      </div>
      {err && <div className="tile" style={{ borderColor: "var(--coral)", marginBottom: 14 }}><div className="tbody" style={{ color: "var(--coral)" }}>{err}</div></div>}
      {form && <ProjectForm value={form} onChange={setForm} onSave={save} onCancel={() => setForm(null)} />}
      {rows && rows.length === 0 && <div className="muted">No projects yet. A project is one lab's order: a language, a target in hours, a licence tier.</div>}
      <div className="stack">
        {rows?.map((p) => <ProjectSheet key={p.id} p={p} open={open === p.id} onToggle={() => setOpen(open === p.id ? null : p.id)} onEdit={() => setForm({ id: p.id, name: p.name, buyer: p.buyer, language: p.language, target_hours: Number(p.target_hours), tier: p.tier, deadline: p.deadline, status: p.status, notes: p.notes ?? "" })} onChanged={load} />)}
      </div>
    </div>
  );

  if (embedded) return body;
  return (
    <div className="app">
      <div className="topbar">
        <button className="brand" onClick={onBack} style={{ background: "none", border: "none" }}><span style={{ color: "var(--mut)", fontFamily: "var(--mono)", fontSize: "0.9rem" }}>‹ back</span></button>
        <Logo height={22} />
      </div>
      {body}
    </div>
  );
}

function ProjectForm({ value: v, onChange, onSave, onCancel }: { value: ProjectInput; onChange: (v: ProjectInput) => void; onSave: () => void; onCancel: () => void }) {
  const set = (k: keyof ProjectInput, x: string | number | null) => onChange({ ...v, [k]: x });
  return (
    <div className="sheet" style={{ marginBottom: 18 }}>
      <div className="handle" />
      <div className="shead"><i className="g" />{v.id ? "Edit the project" : "New project"}</div>
      <div className="row2">
        <div className="field"><label>Name</label><input value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Pidgin banking corpus" /></div>
        <div className="field"><label>Buyer</label><input value={v.buyer} onChange={(e) => set("buyer", e.target.value)} placeholder="Lab or company" /></div>
      </div>
      <div className="row2">
        <div className="field"><label>Language</label><select value={v.language} onChange={(e) => set("language", e.target.value)}>{Object.entries(LANG_NAME).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></div>
        <div className="field"><label>Target · verified hours</label><input type="number" min={1} step={1} value={v.target_hours} onChange={(e) => set("target_hours", Number(e.target.value))} /></div>
      </div>
      <div className="row2">
        <div className="field"><label>Licence tier</label><select value={v.tier} onChange={(e) => set("tier", e.target.value as Tier)}>{(Object.keys(TIER_LABEL) as Tier[]).map((k) => <option key={k} value={k}>{TIER_LABEL[k]}</option>)}</select></div>
        <div className="field"><label>Deadline</label><input type="date" value={v.deadline ?? ""} onChange={(e) => set("deadline", e.target.value || null)} /></div>
      </div>
      <div className="row2">
        <div className="field"><label>Status</label><select value={v.status} onChange={(e) => set("status", e.target.value as ProjectInput["status"])}><option value="open">Open</option><option value="delivering">Delivering</option><option value="closed">Closed</option></select></div>
        <div className="field"><label>Notes</label><input value={v.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Domains, registers, anything agreed" /></div>
      </div>
      <div className="tbody muted small">Exclusive projects only ever receive rallies recorded for them, and their rallies are never sold to anyone else. Standard and aligned projects share the pool, minus anything sold under an exclusive licence.</div>
      <div className="btn-row">
        <button className="pill mint" disabled={!v.name.trim()} onClick={onSave}>Save</button>
        <button className="pill ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function ProjectSheet({ p, open, onToggle, onEdit, onChanged }: { p: Project; open: boolean; onToggle: () => void; onEdit: () => void; onChanged: () => Promise<void> }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [dels, setDels] = useState<Delivery[] | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ id: string; text: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const pct = p.target_hours > 0 ? Math.min(100, Math.round((Number(p.delivered_seconds) / 3600 / Number(p.target_hours)) * 100)) : 0;
  const payRate = rateOf(p.base_rate_usd) ?? rateOf(p.fallback_rate_usd); // what a rally verified now would pay

  const loadDels = useCallback(async () => {
    try {
      setDels(await listDeliveries(p.id));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't load deliveries.");
    }
  }, [p.id]);

  useEffect(() => {
    if (open) void loadDels();
  }, [open, loadDels]);

  const doPlan = async () => {
    setBusy("plan");
    setErr(null);
    try {
      setPlan(await deliveryPlan(p.id));
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "Couldn't plan.");
    }
    setBusy(null);
  };

  const doBuild = async () => {
    setBusy("build");
    setErr(null);
    setPreview(null);
    try {
      const created = await createDelivery(p.id, note);
      setProgress(`Created ${created.bundle_id}: ${created.sessions} rallies, ${created.files} audio files.`);
      const result = await buildBundle(created.delivery_id, setProgress);
      setProgress(`Ready. ${result.files ?? "?"} files · manifest SHA-256 ${result.manifest_sha256 ?? ""}`);
      if (result.preview) setPreview({ id: created.delivery_id, text: JSON.stringify(result.preview, null, 2) });
      setPlan(null);
      setNote("");
      await loadDels();
      await onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "The build failed.");
    }
    setBusy(null);
  };

  const doDownload = async (d: Delivery) => {
    setBusy(`dl-${d.id}`);
    setErr(null);
    try {
      if (isDemo()) {
        setProgress("Downloads are blocked inside the chat demo. In the studio this saves the whole bundle as a zip; the preview below is what the manifest holds.");
        setPreview({ id: d.id, text: await manifestPreview(d) });
      } else {
        await downloadBundle(d, setProgress);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "The download failed.");
    }
    setBusy(null);
  };

  const doPreview = async (d: Delivery) => {
    setBusy(`pv-${d.id}`);
    try {
      setPreview({ id: d.id, text: await manifestPreview(d) });
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "Couldn't read the manifest.");
    }
    setBusy(null);
  };

  return (
    <div className="sheet">
      <div className="handle" />
      <button type="button" onClick={onToggle} style={{ width: "100%", textAlign: "left", cursor: "pointer" }}>
        <div className="spread" style={{ alignItems: "flex-start", gap: 12 }}>
          <div>
            <div className="ttitle">{p.name}</div>
            <div className="tbody muted" style={{ marginTop: 4, fontSize: "0.85rem" }}>{p.buyer || "no buyer yet"} · {LANG_NAME[p.language] ?? p.language} · {TIER_LABEL[p.tier]}{p.deadline ? ` · due ${p.deadline}` : ""}{payRate === null ? "" : ` · ${money(payRate)}/verified hour${rateOf(p.base_rate_usd) === null ? " (global)" : ""}`}</div>
          </div>
          <span className="chip" style={{ flex: "none" }}>{p.status}</span>
        </div>
      </button>
      <div className="tile">
        <div className="spread" style={{ marginBottom: 6 }}>
          <div className="tlbl" style={{ marginBottom: 0 }}>Delivered {hoursOf(p.delivered_seconds)} of {Number(p.target_hours)} h</div>
          <span className="tbody small muted">{pct}%</span>
        </div>
        <div className="progress" style={{ width: "100%" }}><div className="fill" style={{ width: `${Math.max(2, pct)}%` }} /></div>
        <div className="tbody muted small" style={{ marginTop: 8 }}>Ready to deliver now: {hoursOf(p.available_seconds)} in {p.available_sessions} verified {p.available_sessions === 1 ? "rally" : "rallies"}{Number(p.held_sessions) > 0 ? ` · ${p.held_sessions} on hold under clause 15` : ""} · {p.contributors} contributors on the project · {p.deliveries} {p.deliveries === 1 ? "delivery" : "deliveries"} so far</div>
      </div>

      {open && (
        <>
          <PayRate p={p} onChanged={onChanged} />
          <CorpusPlanner p={p} />
          <div className="tile dash">
            <div className="tlbl">Build a delivery</div>
            <div className="tbody muted small" style={{ marginBottom: 8 }}>Freezes every verified, unheld, undelivered rally in {LANG_NAME[p.language] ?? p.language} whose speakers still consent, copies the audio with checksums, and writes the manifest, speakers, consent log, index, README and checksums to the bundle. Nothing leaves without a linguist's verification behind it.</div>
            {plan && (
              <div className="tbody small" style={{ marginBottom: 8 }}>
                <b>{plan.sessions}</b> rallies · <b>{hoursOf(plan.seconds)}</b> · {plan.speakers} speakers. Left out: {plan.excluded.held} on hold, {plan.excluded.withdrawn} withdrawn, {plan.excluded.forfeited} forfeited, {plan.excluded.delivered} already delivered, {plan.excluded.exclusive_elsewhere} sold exclusively elsewhere{plan.excluded.reserved ? `, ${plan.excluded.reserved} reserved for an exclusive project` : ""}{plan.excluded.other_project ? `, ${plan.excluded.other_project} not recorded for this project` : ""}{plan.excluded.sold_elsewhere ? `, ${plan.excluded.sold_elsewhere} already sold to someone else` : ""}.
              </div>
            )}
            <div className="field"><label>Note on this delivery (optional)</label><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. first tranche, banking and market scenes" /></div>
            <div className="btn-row">
              <button className="pill ghost" disabled={busy !== null} onClick={() => void doPlan()}>{busy === "plan" ? "Counting…" : "Plan"}</button>
              <button className="pill mint" disabled={busy !== null || !plan || plan.sessions === 0} onClick={() => void doBuild()}>{busy === "build" ? "Building…" : "Build the bundle"}</button>
            </div>
            {progress && <div className="tbody small" style={{ color: "var(--acc)", marginTop: 8, wordBreak: "break-all" }}>{progress}</div>}
            {err && <div className="tbody small" style={{ color: "var(--coral)", marginTop: 8 }}>{err}</div>}
          </div>

          {dels && dels.length > 0 && (
            <div className="tile">
              <div className="tlbl">Deliveries</div>
              {dels.map((d) => (
                <div key={d.id} style={{ padding: "8px 0", borderBottom: "1px dashed rgba(255,255,255,0.08)" }}>
                  <div className="spread" style={{ alignItems: "flex-start" }}>
                    <div>
                      <div className="tbody" style={{ fontFamily: "var(--mono)", fontSize: "0.8rem" }}>{d.bundle_id}</div>
                      <div className="tbody muted small">{when(d.created_at)} · {d.session_count} rallies · {d.speaker_count} speakers · {hoursOf(d.seconds)} · {d.status === "building" ? `${d.files_done} of ${d.files_total} files copied` : d.status}{d.created_by ? ` · by ${d.created_by}` : ""}{d.note ? ` · ${d.note}` : ""}</div>
                      {d.manifest_sha256 && <div className="tbody muted small" style={{ fontFamily: "var(--mono)", fontSize: "0.68rem", wordBreak: "break-all" }}>manifest SHA-256 {d.manifest_sha256}</div>}
                      {d.bundle_files && <div className="tbody muted small">{d.bundle_files.length} files · {sizeOf(d.bundle_files.reduce((n, f) => n + Number(f.bytes || 0), 0))}</div>}
                      {d.error && <div className="tbody small" style={{ color: "var(--coral)" }}>{d.error}</div>}
                    </div>
                    <span className="chip" style={{ flex: "none", borderColor: d.status === "ready" ? "var(--acc)" : d.status === "failed" ? "var(--coral)" : "var(--gold)", color: d.status === "ready" ? "var(--acc)" : d.status === "failed" ? "var(--coral)" : "var(--gold)" }}>{d.status}</span>
                  </div>
                  {d.status === "ready" && (
                    <div className="btn-row" style={{ marginTop: 8 }}>
                      <button className="pill mint" disabled={busy !== null} onClick={() => void doDownload(d)}>{busy === `dl-${d.id}` ? "Working…" : "Download bundle (zip)"}</button>
                      <button className="pill ghost" disabled={busy !== null} onClick={() => void doPreview(d)}>{busy === `pv-${d.id}` ? "Reading…" : "Preview manifest"}</button>
                    </div>
                  )}
                  {preview?.id === d.id && <pre className="tbody small" style={{ marginTop: 8, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "var(--mono)", fontSize: "0.68rem", maxHeight: 420, overflow: "auto", background: "rgba(255,255,255,0.03)", padding: 10, borderRadius: 10 }}>{preview.text}</pre>}
                </div>
              ))}
            </div>
          )}
          <button className="pill ghost" onClick={onEdit}>Edit the project</button>
        </>
      )}
    </div>
  );
}

/** What this project pays a contributor: US dollars per verified hour of recorded speech, before the
 *  quality multiplier. Unset means it pays the global rate, and the founder can see what that is here. */
function PayRate({ p, onChanged }: { p: Project; onChanged: () => Promise<void> }) {
  const own = rateOf(p.base_rate_usd);
  const fallback = rateOf(p.fallback_rate_usd);
  const paid = own ?? fallback; // what a rally verified right now would be paid at
  const [draft, setDraft] = useState(own === null ? "" : String(own));
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);

  useEffect(() => {
    setDraft(own === null ? "" : String(own));
  }, [own]);

  const typed = Number(draft);
  const valid = draft.trim() !== "" && Number.isFinite(typed) && typed >= RATE_MIN && typed <= RATE_MAX;

  const commit = async (rate: number | null) => {
    setBusy(rate === null ? "clear" : "save");
    setErr(null);
    setSaid(null);
    try {
      const out = await setProjectRate(p.id, rate);
      setSaid(rate === null ? `Cleared. This project now pays the global rate, ${money(out.fallback_rate_usd)} per verified hour.` : `Saved. This project now pays ${money(out.base_rate_usd)} per verified hour.`);
      setEditing(false);
      await onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "Couldn't change the rate.");
    }
    setBusy(null);
  };

  return (
    <div className="tile dash">
      <div className="spread" style={{ alignItems: "flex-start", gap: 10, marginBottom: 6 }}>
        <div className="tlbl" style={{ marginBottom: 0 }}>Pay rate</div>
        <span className="chip" style={{ flex: "none", borderColor: own === null ? undefined : "var(--acc)", color: own === null ? undefined : "var(--acc)" }}>{own === null ? "global rate" : "set for this project"}</span>
      </div>
      <div className="tbody" style={{ marginBottom: 6 }}>
        {paid === null ? "No rate to show." : <>Pays <b>{money(paid)}</b> per verified hour <span className="muted">(US$ / verified hour of recorded speech, before the quality multiplier)</span></>}
      </div>
      <div className="tbody muted small">
        {own === null
          ? <>This project has no rate of its own, so it pays the global rate for {LANG_NAME[p.language] ?? p.language}{fallback === null ? "" : <>, <b>{money(fallback)}</b> per verified hour</>}. Set one to pay this project's contributors differently.</>
          : <>Unset, it would pay the global rate{fallback === null ? "" : <> of <b>{money(fallback)}</b></>} per verified hour.</>}
        {paid !== null && <> An hour of verified speech earns {money(paid)} at gold (×1.0) and {money(paid * 1.2)} at platinum (×1.2); the quality multiplier is applied on top of this rate, not inside it.</>}
      </div>
      <div className="tbody muted small" style={{ marginTop: 6 }}>Changing the rate only touches rallies verified from here on. Earnings already posted keep the rate they were paid at, and payouts already queued are untouched.</div>

      {editing ? (
        <>
          <div className="field" style={{ marginTop: 10 }}>
            <label>Rate · US dollars per verified hour (before the quality multiplier)</label>
            <input type="number" inputMode="decimal" min={RATE_MIN} max={RATE_MAX} step={0.5} value={draft} autoFocus placeholder={fallback === null ? "e.g. 25" : String(fallback)} onChange={(e) => setDraft(e.target.value)} />
          </div>
          {draft.trim() !== "" && !valid && <div className="tbody small" style={{ color: "var(--coral)" }}>The rate has to be between {money(RATE_MIN)} and {money(RATE_MAX)} per verified hour.</div>}
          <div className="btn-row">
            <button className="pill mint" disabled={busy !== null || !valid} onClick={() => void commit(typed)}>{busy === "save" ? "Saving…" : "Save the rate"}</button>
            <button className="pill ghost" disabled={busy !== null} onClick={() => { setEditing(false); setDraft(own === null ? "" : String(own)); setErr(null); }}>Cancel</button>
          </div>
        </>
      ) : (
        <div className="btn-row">
          <button className="pill ghost" disabled={busy !== null || isDemo()} onClick={() => { setEditing(true); setSaid(null); setErr(null); }}>{own === null ? "Set a rate for this project" : "Change the rate"}</button>
          {own !== null && <button className="pill ghost" disabled={busy !== null || isDemo()} onClick={() => void commit(null)}>{busy === "clear" ? "Clearing…" : "Clear it · pay the global rate"}</button>}
        </div>
      )}
      {isDemo() && <div className="tbody muted small">Pay rates are read-only inside the chat demo.</div>}
      {said && <div className="tbody small" style={{ color: "var(--acc)", marginTop: 8 }}>{said}</div>}
      {err && <div className="tbody small" style={{ color: "var(--coral)", marginTop: 8 }}>{err}</div>}
    </div>
  );
}

const TRAINS = ["speech recognition", "a conversational model", "speech translation", "speaker diarisation", "emotion and prosody", "keyword spotting"];

/** The corpus planner: a handful of questions, a drafted set of scenes to review, and one approval
 *  that turns them into active scenario cards with unclaimed rallies waiting behind each one. */
function CorpusPlanner({ p }: { p: Project }) {
  const [form, setForm] = useState<PlanInputs>({ project_id: p.id, industry: "", trains: TRAINS[0], topics: 40, target_hours: Number(p.target_hours) || 10, language: p.language });
  const [asking, setAsking] = useState(false);
  const [draft, setDraft] = useState<{ planId: string; model: string; scenes: PlanScene[] } | null>(null);
  const [openScene, setOpenScene] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [history, setHistory] = useState<PlanRow[] | null>(null);

  const totals = draft ? recomputeTotals(draft.scenes, form.target_hours, form.topics) : null;
  const say = (e: unknown, fallback: string) => setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : fallback);

  const loadHistory = useCallback(async () => {
    try {
      setHistory(await listPlans(p.id));
    } catch {
      setHistory([]); // the table may not be migrated yet; the planner itself reports that clearly
    }
  }, [p.id]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const run = async () => {
    setBusy("draft");
    setErr(null);
    setConfirming(false);
    setProgress("Working out the arithmetic…");
    try {
      const out = await draftPlan(form, setProgress);
      setDraft({ planId: out.planId, model: out.model, scenes: out.scenes });
      setAsking(false);
      setProgress(`Drafted ${out.scenes.length} scenes. Read them before you release anything.`);
      await loadHistory();
    } catch (e) {
      say(e, "The planner failed.");
      setProgress(null);
    }
    setBusy(null);
  };

  const editScene = (key: string, patch: Partial<PlanScene>) => setDraft((d) => (d ? { ...d, scenes: d.scenes.map((s) => (s.key === key ? { ...s, ...patch } : s)) } : d));
  const dropScene = (key: string) => {
    setConfirming(false);
    setDraft((d) => (d ? { ...d, scenes: d.scenes.filter((s) => s.key !== key) } : d));
  };

  const discard = async () => {
    if (!draft) return;
    setBusy("discard");
    try {
      await cancelPlan(draft.planId);
    } catch (e) {
      say(e, "Couldn't mark the draft rejected.");
    }
    setDraft(null);
    setConfirming(false);
    setProgress(null);
    setBusy(null);
    await loadHistory();
  };

  const release = async () => {
    if (!draft || !totals) return;
    setBusy("approve");
    setErr(null);
    try {
      const out = await approvePlan(draft.planId, draft.scenes, form.language, form.target_hours, form.topics, draft.model, setProgress);
      setProgress(`Released. ${out.cards} cards are active and ${out.rallies} rallies are waiting for contributors.`);
      setDraft(null);
      setConfirming(false);
      await loadHistory();
    } catch (e) {
      say(e, "The release failed.");
    }
    setBusy(null);
  };

  const set = (k: keyof PlanInputs, v: string | number) => setForm({ ...form, [k]: v });
  const live = (history ?? []).filter((r) => r.status === "approved");

  return (
    <div className="tile dash">
      <div className="tlbl">Corpus plan</div>
      <div className="tbody muted small" style={{ marginBottom: 8 }}>
        Answer a few questions and a model drafts the whole set of scenes for this project: a title, a situation and two personas each, and how many turns the exchange can honestly sustain. The hours are turned into turns and rallies here, not by the model — a turn is capped at {TURN_CAP_SECONDS} s and runs to about 20 s in practice. Nothing reaches a contributor until you have read it and approved it.
        {live.length > 0 && ` ${live.length} ${live.length === 1 ? "plan has" : "plans have"} already been released for this project.`}
      </div>

      {!draft && !asking && (
        <div className="btn-row">
          <button className="pill ghost" disabled={busy !== null || isDemo()} onClick={() => { setAsking(true); setErr(null); setProgress(null); }}>Plan the corpus</button>
        </div>
      )}
      {isDemo() && !draft && <div className="tbody muted small">Planning is turned off inside the chat demo.</div>}

      {asking && (
        <>
          <div className="field"><label>The industry or domain the buyer cares about</label><input value={form.industry} onChange={(e) => set("industry", e.target.value)} placeholder="e.g. retail banking and agent networks" /></div>
          <div className="row2">
            <div className="field"><label>What the data will train</label><input list="corpus-trains" value={form.trains} onChange={(e) => set("trains", e.target.value)} placeholder="e.g. speech recognition" /><datalist id="corpus-trains">{TRAINS.map((t) => <option key={t} value={t} />)}</datalist></div>
            <div className="field"><label>Language</label><select value={form.language} onChange={(e) => set("language", e.target.value)}>{Object.entries(LANG_NAME).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></div>
          </div>
          <div className="row2">
            <div className="field"><label>Roughly how many distinct topics</label><input type="number" min={1} max={400} step={1} value={form.topics} onChange={(e) => set("topics", Math.max(1, Math.min(400, Number(e.target.value) || 1)))} /></div>
            <div className="field"><label>Target · hours</label><input type="number" min={1} step={1} value={form.target_hours} onChange={(e) => set("target_hours", Math.max(1, Number(e.target.value) || 1))} /></div>
          </div>
          <div className="btn-row">
            <button className="pill mint" disabled={busy !== null || !form.industry.trim() || !form.trains.trim()} onClick={() => void run()}>{busy === "draft" ? "Drafting…" : "Draft the plan"}</button>
            <button className="pill ghost" disabled={busy !== null} onClick={() => setAsking(false)}>Cancel</button>
          </div>
        </>
      )}

      {draft && totals && (
        <>
          <div className="tile" style={{ marginTop: 10 }}>
            <div className="tlbl">The sums</div>
            <div className="tbody small">
              <b>{totals.scenes}</b> scenes · <b>{totals.turns_per_round}</b> turns across the set, averaging <b>{totals.avg_turns}</b> a scene · <b>{totals.rallies_per_scene}</b> {totals.rallies_per_scene === 1 ? "rally" : "rallies"} per scene · <b>{totals.rallies}</b> rallies in all.
            </div>
            <div className="tbody muted small" style={{ marginTop: 4 }}>
              {totals.turns} turns at about 20 s each is <b>{totals.estimated_hours} h</b> against a target of {totals.target_hours} h, and {totals.max_hours} h if every turn runs the full {TURN_CAP_SECONDS} s. Each rally averages {Math.round(totals.seconds_per_rally / 6) / 10} min. Drafted by {draft.model || "the configured model"}.
            </div>
          </div>

          <div className="tbody muted small" style={{ margin: "10px 0 6px" }}>Read every scene. Edit anything that is thin, stereotyped, or would push a contributor into saying something real about themselves; drop what you cannot fix. The cards are written in {LANG_NAME[form.language] ?? form.language} with an English note for the editor, and they go live without card audio — record that in the card library afterwards.</div>

          {draft.scenes.map((s, i) => {
            const isOpen = openScene === s.key;
            return (
              <div key={s.key} className="tile" style={{ marginBottom: 8 }}>
                <div className="spread" style={{ alignItems: "flex-start", gap: 10 }}>
                  <button type="button" onClick={() => setOpenScene(isOpen ? null : s.key)} style={{ textAlign: "left", cursor: "pointer", flex: 1, background: "none", border: "none", padding: 0 }}>
                    <div className="tbody" style={{ fontSize: "0.9rem" }}>{i + 1}. {s.title}</div>
                    <div className="tbody muted small" style={{ marginTop: 2 }}>{s.domain || "no domain"} · {s.turns} turns · {s.rallies || totals.rallies_per_scene} rallies{s.english_note ? ` · ${s.english_note}` : ""}</div>
                  </button>
                  <button className="pill ghost" style={{ flex: "none", width: "auto" }} disabled={busy !== null} onClick={() => dropScene(s.key)}>Drop</button>
                </div>
                {isOpen && (
                  <div style={{ marginTop: 8 }}>
                    <div className="field"><label>Title</label><input value={s.title} onChange={(e) => editScene(s.key, { title: e.target.value })} /></div>
                    <div className="field"><label>Situation</label><textarea rows={3} value={s.situation} onChange={(e) => editScene(s.key, { situation: e.target.value })} /></div>
                    <div className="row2">
                      <div className="field"><label>Persona a</label><input value={s.persona_a} onChange={(e) => editScene(s.key, { persona_a: e.target.value })} /></div>
                      <div className="field"><label>Persona b</label><input value={s.persona_b} onChange={(e) => editScene(s.key, { persona_b: e.target.value })} /></div>
                    </div>
                    <div className="row2">
                      <div className="field"><label>Domain</label><input value={s.domain} onChange={(e) => editScene(s.key, { domain: e.target.value })} /></div>
                      <div className="field"><label>Turns ({TURN_MIN}–{TURN_MAX})</label><input type="number" min={TURN_MIN} max={TURN_MAX} step={1} value={s.turns} onChange={(e) => editScene(s.key, { turns: Math.max(TURN_MIN, Math.min(TURN_MAX, Number(e.target.value) || TURN_MIN)) })} /></div>
                    </div>
                    <div className="field"><label>English note</label><input value={s.english_note} onChange={(e) => editScene(s.key, { english_note: e.target.value })} /></div>
                  </div>
                )}
              </div>
            );
          })}

          <div className="btn-row" style={{ marginTop: 10 }}>
            {confirming ? (
              <button className="pill mint" disabled={busy !== null} onClick={() => void release()}>{busy === "approve" ? "Releasing…" : `Yes — release ${totals.scenes} cards and ${totals.rallies} rallies`}</button>
            ) : (
              <button className="pill mint" disabled={busy !== null || totals.scenes === 0} onClick={() => setConfirming(true)}>Approve the plan</button>
            )}
            <button className="pill ghost" disabled={busy !== null} onClick={() => { if (confirming) setConfirming(false); else void discard(); }}>{confirming ? "Not yet" : "Discard the draft"}</button>
          </div>
          {confirming && <div className="tbody small" style={{ color: "var(--gold)", marginTop: 8 }}>This creates {totals.scenes} active scenario cards and spawns {totals.rallies} unclaimed rallies in {LANG_NAME[form.language] ?? form.language}. Contributors can pick them up straight away.</div>}
        </>
      )}

      {progress && <div className="tbody small" style={{ color: "var(--acc)", marginTop: 8 }}>{progress}</div>}
      {err && <div className="tbody small" style={{ color: "var(--coral)", marginTop: 8 }}>{err}</div>}

      {!draft && history && history.length > 0 && (
        <div style={{ marginTop: 10 }}>
          {history.slice(0, 6).map((r) => (
            <div key={r.id} className="tbody muted small" style={{ padding: "4px 0" }}>
              {when(r.created_at)} · {r.status} · {r.plan?.totals?.scenes ?? 0} scenes · {r.plan?.totals?.rallies ?? 0} rallies · {r.inputs?.industry ?? ""}
              {r.status === "draft" && <button className="pill ghost" style={{ width: "auto", marginLeft: 8, padding: "2px 10px", fontSize: "0.7rem" }} onClick={() => void rejectPlan(r.id).then(loadHistory).catch((e) => say(e, "Couldn't reject it."))}>Reject</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
