import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { Num, useRowMotion } from "@/components/sx-motion";
import { LANG_NAME } from "@/lib/game";
import { when } from "@/lib/verify";
import { RATE_MAX, RATE_MIN, TIER_LABEL, buildBundle, createDelivery, deliveries as listDeliveries, deliveryPlan, downloadBundle, hoursOf, manifestPreview, projects as listProjects, rateOf, saveProject, setProjectRate, sizeOf, type Delivery, type Plan, type Project, type ProjectInput, type Tier } from "@/lib/projects";
import { money } from "@/lib/earn";
import { TURN_AVG_SECONDS, TURN_CAP_SECONDS, TURN_MAX, TURN_MIN, approvePlan, cancelPlan, draftPlan, listPlans, recomputeTotals, rejectPlan, type PlanInputs, type PlanRow, type PlanScene } from "@/lib/corpus";
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

  // a project whose delivered hours, status or pool moved since the last read washes once
  const rowCls = useRowMotion(
    rows,
    (p) => p.id,
    (p) => `${p.status}|${p.delivered_seconds}|${p.available_sessions}|${p.deliveries}|${p.base_rate_usd ?? ""}`,
  );

  const body = (
    <div className="shell wide">
      <div className="sx-head">
        <div>
          <div className="eyebrow">Labs · orders and bundles</div>
          <h1 className="h1">Projects{rows ? <> · <Num value={rows.length} /></> : ""}</h1>
        </div>
        <div className="btn-row">
          <button type="button" className={form ? "pill ghost" : "pill mint"} onClick={() => setForm(form ? null : { ...EMPTY })}>{form ? "Close" : "New project"}</button>
        </div>
      </div>

      <p className="sx-note">
        A project is one lab&rsquo;s order: a language, a target in verified hours, a licence tier. Open one to set its pay rate, plan its corpus
        and build the bundles that go out. Nothing leaves without a linguist&rsquo;s verification behind it.
      </p>

      {err && (
        <div className="sx-block sx-block-coral sx-pop" style={{ marginBottom: 12 }}>
          <div className="tlbl">That didn&rsquo;t work</div>
          <div className="tbody">{err}</div>
        </div>
      )}
      {form && <ProjectForm value={form} onChange={setForm} onSave={save} onCancel={() => setForm(null)} />}
      {!rows && !err && <div className="full-center"><div className="spin" /></div>}
      {rows && rows.length === 0 && (
        <div className="empty sx-pop">
          <b>No projects yet.</b>
          <span>Start one above. A project is one lab&rsquo;s order: a language, a target in hours, a licence tier.</span>
        </div>
      )}
      {rows && rows.length > 0 && (
        <div className="stack sx-enter">
          {rows.map((p) => (
            <ProjectSheet
              key={p.id}
              p={p}
              cls={rowCls(p)}
              open={open === p.id}
              onToggle={() => setOpen(open === p.id ? null : p.id)}
              onEdit={() => setForm({ id: p.id, name: p.name, buyer: p.buyer, language: p.language, target_hours: Number(p.target_hours), tier: p.tier, deadline: p.deadline, status: p.status, notes: p.notes ?? "" })}
              onChanged={load}
            />
          ))}
        </div>
      )}
    </div>
  );

  if (embedded) return body;
  return (
    <div className="app ankara studio-ank">
      <div className="topbar">
        <button type="button" className="sx-link" onClick={onBack}>‹ back</button>
        <Logo height={22} tone="mono" />
      </div>
      {body}
    </div>
  );
}

/** A line that tells the founder how an action went. A confirmation pops in with the mint tick;
 *  an error reads in the text coral; a line still in flight re-lands its count on every step. */
function Said({ tone, children }: { tone: "ok" | "err" | "live"; children: ReactNode }) {
  return (
    <div className={`tbody small${tone === "err" ? " sx-fig-coral" : ""}${tone === "live" ? " sx-view" : " sx-pop"}`} style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "flex-start", wordBreak: "break-word" }}>
      {tone === "ok" && <span className="chip sx-ok" aria-hidden="true">✓</span>}
      <span>{children}</span>
    </div>
  );
}

/** The progress line, built from the text the wiring already reports. A line that carries
 *  "N of M" gets a bar and a figure that re-lands on every step, so a release spawning four
 *  hundred rallies or a bundle copying its audio is seen to climb; any other line is shown as it is. */
function Climb({ text, done, failed }: { text: string; done: boolean; failed: boolean }) {
  const m = /^(.*?)(\d+)( of (\d+)\b.*)$/.exec(text);
  const n = m ? Number(m[2]) : null;
  const total = m ? Number(m[4]) : 0;
  const pct = n !== null && total > 0 ? Math.min(100, Math.round((n / total) * 100)) : null;
  if (done && !failed) return <Said tone="ok">{text}</Said>;
  if (failed) return <div className="tbody small muted" style={{ marginTop: 8 }}>{text}</div>;
  return (
    <div style={{ marginTop: 8 }}>
      {pct !== null && (
        <div className="progress" aria-hidden="true" style={{ marginBottom: 6 }}>
          <div className="fill" style={{ width: `${Math.max(2, pct)}%`, transition: "width 320ms var(--ease-decel)" }} />
        </div>
      )}
      <div className="tbody small" role="status" aria-live="polite" style={{ wordBreak: "break-word" }}>
        {m && n !== null
          ? <>{m[1]}<b key={n} className="sx-bump" style={{ display: "inline-block", fontVariantNumeric: "tabular-nums" }}>{n}</b>{m[3]}</>
          : <span key={text} className="sx-view" style={{ display: "inline-block" }}>{text}</span>}
      </div>
    </div>
  );
}

function ProjectForm({ value: v, onChange, onSave, onCancel }: { value: ProjectInput; onChange: (v: ProjectInput) => void; onSave: () => void; onCancel: () => void }) {
  const set = (k: keyof ProjectInput, x: string | number | null) => onChange({ ...v, [k]: x });
  return (
    <div className="sheet sx-in-card" style={{ marginBottom: 14 }}>
      <div className="shead"><i className="g" />{v.id ? "Edit the project" : "New project"}</div>
      <div className="row2">
        <div className="field"><label htmlFor="pf-name">Name</label><input id="pf-name" value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Pidgin banking corpus" /></div>
        <div className="field"><label htmlFor="pf-buyer">Buyer</label><input id="pf-buyer" value={v.buyer} onChange={(e) => set("buyer", e.target.value)} placeholder="Lab or company" /></div>
      </div>
      <div className="row2">
        <div className="field"><label htmlFor="pf-lang">Language</label><select id="pf-lang" value={v.language} onChange={(e) => set("language", e.target.value)}>{Object.entries(LANG_NAME).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></div>
        <div className="field"><label htmlFor="pf-hours">Target · verified hours</label><input id="pf-hours" type="number" inputMode="numeric" min={1} step={1} value={v.target_hours} onChange={(e) => set("target_hours", Number(e.target.value))} /></div>
      </div>
      <div className="row2">
        <div className="field"><label htmlFor="pf-tier">Licence tier</label><select id="pf-tier" value={v.tier} onChange={(e) => set("tier", e.target.value as Tier)}>{(Object.keys(TIER_LABEL) as Tier[]).map((k) => <option key={k} value={k}>{TIER_LABEL[k]}</option>)}</select></div>
        <div className="field"><label htmlFor="pf-due">Deadline</label><input id="pf-due" type="date" value={v.deadline ?? ""} onChange={(e) => set("deadline", e.target.value || null)} /></div>
      </div>
      <div className="row2">
        <div className="field"><label htmlFor="pf-status">Status</label><select id="pf-status" value={v.status} onChange={(e) => set("status", e.target.value as ProjectInput["status"])}><option value="open">Open</option><option value="delivering">Delivering</option><option value="closed">Closed</option></select></div>
        <div className="field"><label htmlFor="pf-notes">Notes</label><input id="pf-notes" value={v.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Domains, registers, anything agreed" /></div>
      </div>
      <p className="sx-note" style={{ margin: 0 }}>Exclusive projects only ever receive rallies recorded for them, and their rallies are never sold to anyone else. Standard and aligned projects share the pool, minus anything sold under an exclusive licence.</p>
      <div className="btn-row">
        <button type="button" className="pill mint" disabled={!v.name.trim()} onClick={onSave}>Save</button>
        <button type="button" className="pill ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

/** One lab's order. The sheet is the frame; the header is the one pressable tile; the pay rate,
 *  the planner, the build step and the deliveries are quiet units inside it. */
function ProjectSheet({ p, cls, open, onToggle, onEdit, onChanged }: { p: Project; cls: string; open: boolean; onToggle: () => void; onEdit: () => void; onChanged: () => Promise<void> }) {
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

  // a bundle copying its files, or going ready or failed, washes its row
  const delCls = useRowMotion(dels, (d) => d.id, (d) => `${d.status}|${d.files_done}|${d.manifest_sha256 ?? ""}`);
  const building = busy === "build" || busy?.startsWith("dl-") === true;

  return (
    <div className={`sheet sx-enter-row${cls}${open ? " sx-spine-mint" : ""}`}>
      <button type="button" className="tile" aria-expanded={open} onClick={onToggle}>
        <div className="sx-row-top">
          <div className="sx-row-main">
            <div className="ttitle">{p.name}</div>
            <div className="sx-row-s">
              {p.buyer || "no buyer yet"} · {LANG_NAME[p.language] ?? p.language} · {TIER_LABEL[p.tier]}{p.deadline ? ` · due ${p.deadline}` : ""}
              {payRate === null ? "" : ` · ${money(payRate)}/verified hour${rateOf(p.base_rate_usd) === null ? " (global)" : ""}`}
            </div>
          </div>
          <div className="sx-row-end">
            <span className={`chip${p.status === "delivering" ? " on" : p.status === "closed" ? "" : " gold"}`}>{p.status}</span>
          </div>
        </div>
      </button>

      <div className="tile">
        <div className="spread" style={{ marginBottom: 6 }}>
          <div className="tlbl" style={{ marginBottom: 0 }}>Delivered {hoursOf(p.delivered_seconds)} of {Number(p.target_hours)} h</div>
          <span className="sx-meta"><b><Num value={pct} />%</b></span>
        </div>
        <div className="progress" aria-hidden="true"><div className="fill" style={{ width: `${Math.max(2, pct)}%` }} /></div>
        <div className="tbody muted small" style={{ marginTop: 8 }}>
          Ready to deliver now: <b>{hoursOf(p.available_seconds)}</b> in {p.available_sessions} verified {p.available_sessions === 1 ? "rally" : "rallies"}
          {Number(p.held_sessions) > 0 ? ` · ${p.held_sessions} on hold under clause 15` : ""} · {p.contributors} contributors on the project · {p.deliveries} {p.deliveries === 1 ? "delivery" : "deliveries"} so far
        </div>
      </div>

      {open && (
        <div className="stack sx-view" style={{ gap: 8 }}>
          <PayRate p={p} onChanged={onChanged} />
          <CorpusPlanner p={p} />

          <div className={`tile${busy === "build" ? " sx-working sx-spine-gold" : ""}`}>
            <div className="tlbl">Build a delivery</div>
            <div className="tbody muted small" style={{ marginBottom: 8 }}>
              Freezes every verified, unheld, undelivered rally in {LANG_NAME[p.language] ?? p.language} whose speakers still consent, copies the audio with checksums,
              and writes the manifest, speakers, consent log, index, README and checksums to the bundle. Nothing leaves without a linguist&rsquo;s verification behind it.
            </div>
            {plan && (
              <div className="stats sx-enter" key={`${plan.sessions}-${plan.seconds}`} style={{ marginBottom: 8 }}>
                <div className="stat sx-enter-row"><div className="n"><Num value={plan.sessions} /></div><div className="s">rallies ready</div></div>
                <div className="stat sx-enter-row"><div className="n">{hoursOf(plan.seconds)}</div><div className="s">of speech</div></div>
                <div className="stat sx-enter-row"><div className="n"><Num value={plan.speakers} /></div><div className="s">speakers</div></div>
                <div className="stat sx-enter-row">
                  <div className="n"><Num value={plan.excluded.held + plan.excluded.withdrawn + plan.excluded.forfeited + plan.excluded.delivered + plan.excluded.exclusive_elsewhere + (plan.excluded.reserved ?? 0) + (plan.excluded.other_project ?? 0) + (plan.excluded.sold_elsewhere ?? 0)} /></div>
                  <div className="s">left out</div>
                </div>
              </div>
            )}
            {plan && (
              <div className="sx-meta" style={{ marginBottom: 8 }}>
                Left out: {plan.excluded.held} on hold, {plan.excluded.withdrawn} withdrawn, {plan.excluded.forfeited} forfeited, {plan.excluded.delivered} already delivered, {plan.excluded.exclusive_elsewhere} sold exclusively elsewhere
                {plan.excluded.reserved ? `, ${plan.excluded.reserved} reserved for an exclusive project` : ""}{plan.excluded.other_project ? `, ${plan.excluded.other_project} not recorded for this project` : ""}{plan.excluded.sold_elsewhere ? `, ${plan.excluded.sold_elsewhere} already sold to someone else` : ""}.
              </div>
            )}
            <div className="field">
              <label htmlFor={`note-${p.id}`}>Note on this delivery (optional)</label>
              <input id={`note-${p.id}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. first tranche, banking and market scenes" />
            </div>
            <div className="btn-row">
              <button type="button" className="pill ghost" disabled={busy !== null} onClick={() => void doPlan()}>{busy === "plan" ? "Counting…" : "Plan"}</button>
              <button type="button" className="pill mint" disabled={busy !== null || !plan || plan.sessions === 0} onClick={() => void doBuild()}>{busy === "build" ? "Building…" : "Build the bundle"}</button>
            </div>
            {progress && <Climb text={progress} done={!building} failed={err !== null} />}
            {err && <Said tone="err">{err}</Said>}
          </div>

          {dels && dels.length > 0 && (
            <div>
              <div className="tlbl" style={{ margin: "2px 2px 6px" }}>Deliveries · {dels.length}</div>
              <div className="sx-list tight sx-enter">
                {dels.map((d) => {
                  const spine = d.status === "ready" ? " sx-spine-mint" : d.status === "failed" ? " sx-spine-coral" : " sx-spine-gold";
                  return (
                    <div key={d.id} className={`sx-row${spine}${delCls(d)}${d.status === "building" ? " sx-working" : ""}`}>
                      <div className="sx-row-top">
                        <div className="sx-row-main">
                          <div className="sx-meta sx-clip"><b>{d.bundle_id}</b></div>
                          <div className="sx-row-s">
                            {when(d.created_at)} · {d.session_count} rallies · {d.speaker_count} speakers · {hoursOf(d.seconds)} · {d.status === "building" ? `${d.files_done} of ${d.files_total} files copied` : d.status}
                            {d.created_by ? ` · by ${d.created_by}` : ""}{d.note ? ` · ${d.note}` : ""}
                          </div>
                          {d.status === "building" && d.files_total > 0 && (
                            <div className="progress" aria-hidden="true" style={{ marginTop: 6, maxWidth: 320 }}><div className="fill" style={{ width: `${Math.max(2, Math.round((d.files_done / d.files_total) * 100))}%` }} /></div>
                          )}
                          {d.manifest_sha256 && <div className="sx-row-m" style={{ wordBreak: "break-all" }}>manifest SHA-256 {d.manifest_sha256}</div>}
                          {d.bundle_files && <div className="sx-row-m">{d.bundle_files.length} files · {sizeOf(d.bundle_files.reduce((n, f) => n + Number(f.bytes || 0), 0))}</div>}
                          {d.error && <div className="sx-row-s sx-fig-coral">{d.error}</div>}
                        </div>
                        <div className="sx-row-end">
                          <span className={`chip${d.status === "ready" ? " on" : d.status === "failed" ? " coral" : " gold"}`}>{d.status}</span>
                        </div>
                      </div>
                      {d.status === "ready" && (
                        <div className="btn-row" style={{ marginTop: 8 }}>
                          <button type="button" className="pill mint" disabled={busy !== null} onClick={() => void doDownload(d)}>{busy === `dl-${d.id}` ? "Working…" : "Download bundle (zip)"}</button>
                          <button type="button" className="pill ghost" disabled={busy !== null} onClick={() => void doPreview(d)}>{busy === `pv-${d.id}` ? "Reading…" : "Preview manifest"}</button>
                        </div>
                      )}
                      {preview?.id === d.id && (
                        <pre className="tile sx-meta sx-view" style={{ marginTop: 8, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 420, overflow: "auto" }}>{preview.text}</pre>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="btn-row">
            <button type="button" className="pill ghost" onClick={onEdit}>Edit the project</button>
          </div>
        </div>
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
    <div className={`tile${busy ? " sx-working" : ""}`}>
      <div className="spread" style={{ alignItems: "flex-start", gap: 10, marginBottom: 6 }}>
        <div className="tlbl" style={{ marginBottom: 0 }}>Pay rate</div>
        <span className={`chip${own === null ? "" : " on"}`}>{own === null ? "global rate" : "set for this project"}</span>
      </div>
      <div className="tbody" style={{ marginBottom: 6 }}>
        {paid === null ? "No rate to show." : <>Pays <b key={paid} className="sx-bump" style={{ display: "inline-block" }}>{money(paid)}</b> per verified hour <span className="muted">(US$ / verified hour of recorded speech, before the quality multiplier)</span></>}
      </div>
      <div className="tbody muted small">
        {own === null
          ? <>This project has no rate of its own, so it pays the global rate for {LANG_NAME[p.language] ?? p.language}{fallback === null ? "" : <>, <b>{money(fallback)}</b> per verified hour</>}. Set one to pay this project&rsquo;s contributors differently.</>
          : <>Unset, it would pay the global rate{fallback === null ? "" : <> of <b>{money(fallback)}</b></>} per verified hour.</>}
        {paid !== null && <> An hour of verified speech earns {money(paid)} at gold (×1.0) and {money(paid * 1.2)} at platinum (×1.2); the quality multiplier is applied on top of this rate, not inside it.</>}
      </div>
      <div className="sx-meta" style={{ marginTop: 6 }}>Changing the rate only touches rallies verified from here on. Earnings already posted keep the rate they were paid at, and payouts already queued are untouched.</div>

      {editing ? (
        <div className="sx-view">
          <div className="field" style={{ marginTop: 10 }}>
            <label htmlFor={`rate-${p.id}`}>Rate · US dollars per verified hour (before the quality multiplier)</label>
            <input id={`rate-${p.id}`} type="number" inputMode="decimal" min={RATE_MIN} max={RATE_MAX} step={0.5} value={draft} autoFocus placeholder={fallback === null ? "e.g. 25" : String(fallback)} onChange={(e) => setDraft(e.target.value)} />
          </div>
          {draft.trim() !== "" && !valid && <div className="tbody small sx-fig-coral" style={{ marginBottom: 8 }}>The rate has to be between {money(RATE_MIN)} and {money(RATE_MAX)} per verified hour.</div>}
          <div className="btn-row">
            <button type="button" className="pill mint" disabled={busy !== null || !valid} onClick={() => void commit(typed)}>{busy === "save" ? "Saving…" : "Save the rate"}</button>
            <button type="button" className="pill ghost" disabled={busy !== null} onClick={() => { setEditing(false); setDraft(own === null ? "" : String(own)); setErr(null); }}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="btn-row" style={{ marginTop: 10 }}>
          <button type="button" className="pill ghost" disabled={busy !== null || isDemo()} onClick={() => { setEditing(true); setSaid(null); setErr(null); }}>{own === null ? "Set a rate for this project" : "Change the rate"}</button>
          {own !== null && <button type="button" className="pill ghost" disabled={busy !== null || isDemo()} onClick={() => void commit(null)}>{busy === "clear" ? "Clearing…" : "Clear it · pay the global rate"}</button>}
        </div>
      )}
      {isDemo() && <div className="sx-meta" style={{ marginTop: 6 }}>Pay rates are read-only inside the chat demo.</div>}
      {said && <Said tone="ok">{said}</Said>}
      {err && <Said tone="err">{err}</Said>}
    </div>
  );
}

const TRAINS = ["speech recognition", "a conversational model", "speech translation", "speaker diarisation", "emotion and prosody", "keyword spotting"];

/** The corpus planner: a handful of questions, a drafted set of scenes to review, and one approval
 *  that turns them into active scenario cards with unclaimed rallies waiting behind each one.
 *
 *  This is where the Studio's motion earns its keep: the sums count up when a draft lands, the
 *  scenes rise in staggered, a dropped scene slides out, and the release counter climbs scene by
 *  scene while the rallies are spawned. */
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
  // the scene the founder just dropped: it slides out before it leaves the draft
  const [leaving, setLeaving] = useState<string | null>(null);

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

  // the drop itself is the same local filter it always was; it just waits for the row to slide out
  useEffect(() => {
    if (!leaving) return;
    const key = leaving;
    const id = window.setTimeout(() => {
      setConfirming(false);
      setDraft((d) => (d ? { ...d, scenes: d.scenes.filter((s) => s.key !== key) } : d));
      setLeaving(null);
    }, 240);
    return () => window.clearTimeout(id);
  }, [leaving]);

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

  // an edited turn count or title washes the scene's row once; a fresh draft enters staggered
  const sceneCls = useRowMotion(draft?.scenes, (s) => s.key, (s) => `${s.turns}|${s.title}|${s.domain}`);
  const historyCls = useRowMotion(history, (r) => r.id, (r) => r.status);

  return (
    <div className={`tile${draft ? " sx-spine-gold" : ""}${busy === "draft" || busy === "approve" ? " sx-working" : ""}`}>
      <div className="spread" style={{ alignItems: "flex-start", gap: 10 }}>
        <div className="tlbl" style={{ marginBottom: 0 }}>Corpus plan</div>
        {live.length > 0 && <span className="chip num">{live.length} released</span>}
        {draft && <span className="chip gold sx-pop">draft to review</span>}
      </div>
      <div className="tbody muted small" style={{ margin: "6px 0 8px" }}>
        Answer a few questions and a model drafts the whole set of scenes for this project: a title, a situation and two personas each, and how many turns the exchange can honestly sustain.
        The hours are turned into turns and rallies here, not by the model — a turn is capped at {TURN_CAP_SECONDS} s and runs to about {TURN_AVG_SECONDS} s in practice. Nothing reaches a contributor until you have read it and approved it.
      </div>

      {!draft && !asking && (
        <div className="btn-row">
          <button type="button" className="pill ghost" disabled={busy !== null || isDemo()} onClick={() => { setAsking(true); setErr(null); setProgress(null); }}>Plan the corpus</button>
        </div>
      )}
      {isDemo() && !draft && <div className="sx-meta" style={{ marginTop: 6 }}>Planning is turned off inside the chat demo.</div>}

      {asking && (
        <div className="sx-view">
          <div className="field"><label htmlFor={`cp-ind-${p.id}`}>The industry or domain the buyer cares about</label><input id={`cp-ind-${p.id}`} value={form.industry} onChange={(e) => set("industry", e.target.value)} placeholder="e.g. retail banking and agent networks" /></div>
          <div className="row2">
            <div className="field"><label htmlFor={`cp-tr-${p.id}`}>What the data will train</label><input id={`cp-tr-${p.id}`} list="corpus-trains" value={form.trains} onChange={(e) => set("trains", e.target.value)} placeholder="e.g. speech recognition" /><datalist id="corpus-trains">{TRAINS.map((t) => <option key={t} value={t} />)}</datalist></div>
            <div className="field"><label htmlFor={`cp-lang-${p.id}`}>Language</label><select id={`cp-lang-${p.id}`} value={form.language} onChange={(e) => set("language", e.target.value)}>{Object.entries(LANG_NAME).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></div>
          </div>
          <div className="row2">
            <div className="field"><label htmlFor={`cp-top-${p.id}`}>Roughly how many distinct topics</label><input id={`cp-top-${p.id}`} type="number" inputMode="numeric" min={1} max={400} step={1} value={form.topics} onChange={(e) => set("topics", Math.max(1, Math.min(400, Number(e.target.value) || 1)))} /></div>
            <div className="field"><label htmlFor={`cp-h-${p.id}`}>Target · hours</label><input id={`cp-h-${p.id}`} type="number" inputMode="numeric" min={1} step={1} value={form.target_hours} onChange={(e) => set("target_hours", Math.max(1, Number(e.target.value) || 1))} /></div>
          </div>
          <div className="btn-row">
            <button type="button" className="pill mint" disabled={busy !== null || !form.industry.trim() || !form.trains.trim()} onClick={() => void run()}>{busy === "draft" ? "Drafting…" : "Draft the plan"}</button>
            <button type="button" className="pill ghost" disabled={busy !== null} onClick={() => setAsking(false)}>Cancel</button>
          </div>
        </div>
      )}

      {draft && totals && (
        <div className="sx-view">
          {/* the sums land: each figure counts up from zero, staggered, and re-lands when a scene is edited or dropped */}
          <div className="stats sx-enter" key={`${draft.planId}-${totals.scenes}-${totals.turns}`} style={{ marginTop: 10, marginBottom: 8 }}>
            <div className="stat sx-enter-row"><div className="n"><Num value={totals.scenes} /></div><div className="s">scenes</div></div>
            <div className="stat sx-enter-row"><div className="n"><Num value={totals.rallies} /></div><div className="s">rallies · {totals.rallies_per_scene} a scene</div></div>
            <div className="stat sx-enter-row"><div className="n"><Num value={totals.turns} /></div><div className="s">turns · about {totals.avg_turns} a scene</div></div>
            <div className="stat sx-enter-row"><div className="n">{totals.estimated_hours} h</div><div className="s">of {totals.target_hours} h · up to {totals.max_hours} h</div></div>
          </div>
          <div className="sx-meta" style={{ marginBottom: 8 }}>
            {totals.turns_per_round} turns across the set at about {TURN_AVG_SECONDS} s each · each rally averages {Math.round(totals.seconds_per_rally / 6) / 10} min · the ceiling is every turn running the full {TURN_CAP_SECONDS} s · drafted by {draft.model || "the configured model"}.
          </div>

          <p className="sx-note">
            Read every scene. Edit anything that is thin, stereotyped, or would push a contributor into saying something real about themselves; drop what you cannot fix.
            The cards are written in {LANG_NAME[form.language] ?? form.language} with an English note for the editor, and they go live without card audio — record that in the card library afterwards.
          </p>

          <div className="sx-list sx-enter" key={draft.planId}>
            {draft.scenes.map((s, i) => {
              const isOpen = openScene === s.key;
              return (
                <div key={s.key} className={`sx-row${sceneCls(s)}${leaving === s.key ? " sx-leave" : ""}`}>
                  <div className="sx-row-top">
                    <button type="button" className="sx-row-main" aria-expanded={isOpen} style={{ textAlign: "left", minHeight: 44 }} onClick={() => setOpenScene(isOpen ? null : s.key)}>
                      <div className="sx-row-t">{i + 1}. {s.title}</div>
                      <div className="sx-row-s">{s.domain || "no domain"} · {s.turns} turns · {s.rallies || totals.rallies_per_scene} rallies{s.english_note ? ` · ${s.english_note}` : ""}</div>
                    </button>
                    <div className="sx-row-end">
                      <button type="button" className="pill ghost" disabled={busy !== null || leaving !== null} onClick={() => setLeaving(s.key)}>Drop</button>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="sx-view" style={{ marginTop: 8 }}>
                      <div className="field"><label htmlFor={`sc-t-${s.key}`}>Title</label><input id={`sc-t-${s.key}`} value={s.title} onChange={(e) => editScene(s.key, { title: e.target.value })} /></div>
                      <div className="field"><label htmlFor={`sc-s-${s.key}`}>Situation</label><textarea id={`sc-s-${s.key}`} rows={3} value={s.situation} onChange={(e) => editScene(s.key, { situation: e.target.value })} /></div>
                      <div className="row2">
                        <div className="field"><label htmlFor={`sc-a-${s.key}`}>Persona a</label><input id={`sc-a-${s.key}`} value={s.persona_a} onChange={(e) => editScene(s.key, { persona_a: e.target.value })} /></div>
                        <div className="field"><label htmlFor={`sc-b-${s.key}`}>Persona b</label><input id={`sc-b-${s.key}`} value={s.persona_b} onChange={(e) => editScene(s.key, { persona_b: e.target.value })} /></div>
                      </div>
                      <div className="row2">
                        <div className="field"><label htmlFor={`sc-d-${s.key}`}>Domain</label><input id={`sc-d-${s.key}`} value={s.domain} onChange={(e) => editScene(s.key, { domain: e.target.value })} /></div>
                        <div className="field"><label htmlFor={`sc-n-${s.key}`}>Turns ({TURN_MIN}–{TURN_MAX})</label><input id={`sc-n-${s.key}`} type="number" inputMode="numeric" min={TURN_MIN} max={TURN_MAX} step={1} value={s.turns} onChange={(e) => editScene(s.key, { turns: Math.max(TURN_MIN, Math.min(TURN_MAX, Number(e.target.value) || TURN_MIN)) })} /></div>
                      </div>
                      <div className="field" style={{ marginBottom: 2 }}><label htmlFor={`sc-e-${s.key}`}>English note</label><input id={`sc-e-${s.key}`} value={s.english_note} onChange={(e) => editScene(s.key, { english_note: e.target.value })} /></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="btn-row" style={{ marginTop: 10 }}>
            {confirming ? (
              <button type="button" key="yes" className="pill mint sx-pop" disabled={busy !== null} onClick={() => void release()}>{busy === "approve" ? "Releasing…" : `Yes — release ${totals.scenes} cards and ${totals.rallies} rallies`}</button>
            ) : (
              <button type="button" key="approve" className="pill mint" disabled={busy !== null || totals.scenes === 0} onClick={() => setConfirming(true)}>Approve the plan</button>
            )}
            <button type="button" className="pill ghost" disabled={busy !== null} onClick={() => { if (confirming) setConfirming(false); else void discard(); }}>{confirming ? "Not yet" : busy === "discard" ? "Discarding…" : "Discard the draft"}</button>
          </div>
          {confirming && (
            <p className="sx-note sx-note-gold sx-pop" style={{ marginTop: 8, marginBottom: 0 }}>
              This creates {totals.scenes} active scenario cards and spawns {totals.rallies} unclaimed rallies in {LANG_NAME[form.language] ?? form.language}. Contributors can pick them up straight away.
            </p>
          )}
        </div>
      )}

      {progress && <Climb text={progress} done={busy === null} failed={err !== null} />}
      {err && <Said tone="err">{err}</Said>}

      {!draft && history && history.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div className="tlbl">Earlier plans</div>
          <div className="sx-list tight sx-enter">
            {history.slice(0, 6).map((r) => (
              <div key={r.id} className={`sx-row${r.status === "approved" ? " sx-spine-mint" : r.status === "draft" ? " sx-spine-gold" : ""}${historyCls(r)}`}>
                <div className="sx-row-top">
                  <div className="sx-row-main">
                    <div className="sx-row-s">{when(r.created_at)} · {r.plan?.totals?.scenes ?? 0} scenes · {r.plan?.totals?.rallies ?? 0} rallies{r.inputs?.industry ? ` · ${r.inputs.industry}` : ""}</div>
                  </div>
                  <div className="sx-row-end">
                    <span className={`chip${r.status === "approved" ? " on" : r.status === "draft" ? " gold" : ""}`}>{r.status}</span>
                    {r.status === "draft" && <button type="button" className="pill ghost" onClick={() => void rejectPlan(r.id).then(loadHistory).catch((e) => say(e, "Couldn't reject it."))}>Reject</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
