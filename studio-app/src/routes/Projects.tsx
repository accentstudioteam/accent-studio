import { useCallback, useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { LANG_NAME } from "@/lib/game";
import { when } from "@/lib/verify";
import { TIER_LABEL, buildBundle, createDelivery, deliveries as listDeliveries, deliveryPlan, downloadBundle, hoursOf, manifestPreview, projects as listProjects, saveProject, sizeOf, type Delivery, type Plan, type Project, type ProjectInput, type Tier } from "@/lib/projects";
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
            <div className="tbody muted" style={{ marginTop: 4, fontSize: "0.85rem" }}>{p.buyer || "no buyer yet"} · {LANG_NAME[p.language] ?? p.language} · {TIER_LABEL[p.tier]}{p.deadline ? ` · due ${p.deadline}` : ""}</div>
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
