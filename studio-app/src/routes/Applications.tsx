import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Application, ApplicationSample, ApplicationStatus, Project } from "@/lib/types";
import { Logo } from "@/components/Logo";
import { Num, useRowMotion } from "@/components/sx-motion";

const STATUSES: ApplicationStatus[] = ["submitted", "invited", "interview_scheduled", "interviewed", "in_review", "accepted", "accepted_to_project", "onboarded", "waitlisted", "rejected"];
const LANG: Record<string, string> = {
  pcm: "Pidgin",
  yo: "Yoruba",
  ha: "Hausa",
  ig: "Igbo",
  sw: "Swahili",
  zu: "Zulu",
  en: "English",
  other: "Other",
};
const CSV_COLUMNS: (keyof Application)[] = [
  "created_at", "full_name", "email", "phone", "country", "city", "languages", "primary_language", "other_language",
  "age_band", "gender", "device", "hours_per_week", "payout_pref", "motivation", "referral", "sample_path",
  "sample_seconds", "samples", "consent_contact", "consent_sample", "status", "notes", "id",
];

function when(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Every sample on the application; falls back to the single legacy sample columns. */
function samplesOf(a: Application): ApplicationSample[] {
  if (a.samples && a.samples.length > 0) return a.samples;
  return a.sample_path ? [{ language: a.primary_language, path: a.sample_path, seconds: a.sample_seconds ?? 0 }] : [];
}

function csvCell(v: unknown): string {
  if (Array.isArray(v)) {
    return v.map((x) => (x && typeof x === "object" ? `${(x as ApplicationSample).language}:${(x as ApplicationSample).path}` : String(x))).join("|");
  }
  return String(v ?? "");
}

function toCsv(rows: Application[]): string {
  const esc = (v: unknown) => `"${csvCell(v).replace(/"/g, '""')}"`;
  const line = (r: Application) => CSV_COLUMNS.map((c) => esc(r[c])).join(",");
  return [CSV_COLUMNS.join(","), ...rows.map(line)].join("\n");
}

const word = (s: string) => s.replace(/_/g, " ");

/** Where an applicant is, as the row's spine: mint once they are in, gold while
 *  the ball is in their court, coral if they were turned down. Everything else
 *  is a plain row, which is most of two hundred. */
function spineOf(s: ApplicationStatus): string {
  if (s === "onboarded" || s === "accepted_to_project" || s === "accepted") return " sx-spine-mint";
  if (s === "invited" || s === "interview_scheduled") return " sx-spine-gold";
  if (s === "rejected") return " sx-spine-coral";
  return "";
}
function chipOf(s: ApplicationStatus): string {
  if (s === "onboarded" || s === "accepted_to_project") return " on";
  if (s === "invited" || s === "interview_scheduled" || s === "accepted") return " gold";
  if (s === "rejected") return " coral";
  return "";
}

/** Founder view of the waitlist: read, listen, triage, export. */
export function Applications({ onBack }: { onBack: () => void }) {
  const [rows, setRows] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | ApplicationStatus>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [audio, setAudio] = useState<Record<string, string>>({});
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectPick, setProjectPick] = useState<Record<string, string>>({});
  const [inviting, setInviting] = useState<string | null>(null);
  const [inviteMsg, setInviteMsg] = useState<Record<string, string>>({});
  // which applicant's notes were just saved: the tick beside the button
  const [savedNotes, setSavedNotes] = useState<string | null>(null);

  useEffect(() => {
    void supabase.from("projects").select("*").eq("status", "open").order("created_at").then(({ data }) => setProjects((data ?? []) as Project[]));
  }, []);

  const invite = async (a: Application) => {
    setInviting(a.id);
    setInviteMsg((m) => ({ ...m, [a.id]: "" }));
    const project_id = projectPick[a.id] ?? projects[0]?.id ?? null;
    const { data, error } = await supabase.functions.invoke("invite-contributor", { body: { application_id: a.id, project_id } });
    setInviting(null);
    if (error || !data?.ok) {
      setInviteMsg((m) => ({ ...m, [a.id]: (data as { error?: string } | null)?.error ?? "Invite failed. Try again." }));
      return;
    }
    setInviteMsg((m) => ({ ...m, [a.id]: data.mailed ? `Invited. Email sent, link valid until ${new Date(data.expires_at).toLocaleDateString()}.` : "Invitation created but the email did not send. Check RESEND_API_KEY." }));
    setRows((rs) => rs.map((r) => (r.id === a.id && !["onboarded", "accepted_to_project"].includes(r.status) ? { ...r, status: "invited" } : r)));
  };

  const load = async () => {
    setLoading(true);
    setErr(null);
    const { data, error } = await supabase.from("applications").select("*").order("created_at", { ascending: false }).limit(500);
    if (error) setErr(error.message);
    else setRows((data ?? []) as Application[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const s of STATUSES) c[s] = rows.filter((r) => r.status === s).length;
    return c;
  }, [rows]);

  // memoised so the row-motion snapshot only moves when the list really does
  const visible = useMemo(() => (filter === "all" ? rows : rows.filter((r) => r.status === filter)), [rows, filter]);

  // the list arriving enters; an applicant whose status flips (invited, accepted,
  // rejected, or just moved by the select) washes once in its new colour
  const rowCls = useRowMotion(visible, (a) => a.id, (a) => a.status);

  const setStatus = async (id: string, status: ApplicationStatus) => {
    const prev = rows;
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
    const { error } = await supabase.from("applications").update({ status }).eq("id", id);
    if (error) {
      setErr(`Couldn't update status: ${error.message}`);
      setRows(prev);
    }
  };

  const saveNotes = async (id: string) => {
    const notes = (notesDraft[id] ?? "").slice(0, 4000);
    const { error } = await supabase.from("applications").update({ notes: notes || null }).eq("id", id);
    if (error) setErr(`Couldn't save notes: ${error.message}`);
    else {
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, notes: notes || null } : r)));
      setSavedNotes(id);
    }
  };

  const play = async (path: string) => {
    if (audio[path]) return;
    const { data, error } = await supabase.storage.from("applications").createSignedUrl(path, 600);
    if (error || !data) setErr(`Couldn't load the sample: ${error?.message ?? "unknown error"}`);
    else setAudio((m) => ({ ...m, [path]: data.signedUrl }));
  };

  const exportCsv = () => {
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `accent-studio-applications-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app ankara studio-ank">
      <div className="topbar">
        <button type="button" className="sx-link" onClick={onBack}>‹ back</button>
        <Logo height={22} tone="mono" />
      </div>

      <div className="shell wide">
        <div className="sx-head">
          <div>
            <div className="eyebrow">Waitlist</div>
            <h1 className="h1">Applications{!loading || rows.length ? <> · <Num value={rows.length} /></> : ""}</h1>
          </div>
        </div>

        <div className={`sx-bar${loading ? " sx-working" : ""}`} role="group" aria-label="Status">
          {(["all", ...STATUSES] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={filter === s}
              className={`chip num${filter === s ? " on" : ""}`}
              onClick={() => setFilter(s)}
            >
              {word(s)} {counts[s] ?? 0}
            </button>
          ))}
          <div className="sx-bar-end">
            <button type="button" className="pill ghost" onClick={load} disabled={loading}>Refresh</button>
            <button type="button" className="pill ghost" onClick={exportCsv} disabled={rows.length === 0}>CSV</button>
          </div>
        </div>

        <p className="sx-note">
          Everyone who applied at accentstudio.io/apply, newest first. Open a row to hear their clips, invite them to a project,
          move their status or leave a note. An invitation emails them a signing link; the row turns gold until they sign, mint once they are onboarded.
        </p>

        {err && (
          <div className="sx-block sx-block-coral sx-pop" style={{ marginBottom: 12 }}>
            <div className="tlbl">That didn&rsquo;t work</div>
            <div className="tbody">{err}</div>
          </div>
        )}
        {loading && rows.length === 0 && <div className="full-center"><div className="spin" /></div>}
        {!loading && visible.length === 0 && (
          <div className="empty sx-pop">
            <b>{rows.length === 0 ? "Nothing here yet." : "Nobody at this stage."}</b>
            <span>{rows.length === 0 ? "Share accentstudio.io/apply." : "Pick another status above."}</span>
          </div>
        )}

        {visible.length > 0 && (
          <div className="sx-list sx-enter">
            {visible.map((a) => {
              const isOpen = open === a.id;
              const clips = samplesOf(a);
              const secs = Math.round(clips.reduce((n, s) => n + Number(s.seconds || 0), 0));
              const cls = rowCls(a);
              const flash = cls === " sx-flash" ? (a.status === "rejected" ? " sx-flash sx-flash-coral" : a.status === "invited" ? " sx-flash sx-flash-gold" : cls) : cls;
              return [
                <button
                  key={a.id}
                  type="button"
                  className={`sx-row${spineOf(a.status)}${flash}`}
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : a.id)}
                >
                  <div className="sx-row-top">
                    <div className="sx-row-main">
                      <div className="sx-row-t">{a.full_name}</div>
                      <div className="sx-row-s">
                        {a.languages.map((l) => LANG[l] ?? l).join(", ")} · {a.country}{a.city ? ` · ${a.city}` : ""} · {a.device ?? "device?"}
                      </div>
                      <div className="sx-row-m">
                        {clips.length > 0 ? `${clips.length} clip${clips.length > 1 ? "s" : ""} · ${secs} s` : "no clips"} · applied {when(a.created_at)}
                      </div>
                    </div>
                    <div className="sx-row-end">
                      <span className={`chip${chipOf(a.status)}`}>{word(a.status)}</span>
                    </div>
                  </div>
                </button>,

                isOpen && (
                  <div key={`${a.id}-open`} className={`sx-row sx-view${spineOf(a.status)}`}>
                    <div className="sx-pair">
                      {/* who they are, and what they sound like */}
                      <div className="stack">
                        <div className="tile">
                          <div className="tlbl">Contact</div>
                          <div className="tbody">
                            <a href={`mailto:${a.email}`}>{a.email}</a>
                            {a.phone ? ` · ${a.phone}` : ""}
                          </div>
                        </div>
                        <div className="tile">
                          <div className="tlbl">Profile</div>
                          <div className="tbody small">
                            Strongest: <b>{LANG[a.primary_language] ?? a.primary_language}{a.other_language ? ` (${a.other_language})` : ""}</b>
                          </div>
                          <div className="sx-meta">Age {a.age_band ?? "?"} · {a.gender ?? "gender n/a"} · {a.hours_per_week ?? "?"} h/week · pay via {a.payout_pref ?? "?"}</div>
                          {a.motivation && <div className="tbody muted small" style={{ marginTop: 4 }}>Why: {a.motivation}</div>}
                          {a.referral && <div className="tbody muted small">Heard via: {a.referral}</div>}
                          <div className="sx-meta" style={{ marginTop: 4 }}>Consent: contact {a.consent_contact ? "yes" : "no"} · sample {a.consent_sample ? "yes" : "no"}</div>
                        </div>
                        {clips.map((s) => (
                          <div className="tile" key={s.path}>
                            <div className="tlbl">{LANG[s.language] ?? s.language}{s.part ? ` · ${s.part}` : ""} · {Math.round(s.seconds)} s</div>
                            {audio[s.path] ? (
                              <audio controls src={audio[s.path]} className="sx-pop" style={{ width: "100%", marginTop: 6 }} />
                            ) : (
                              <button type="button" className="pill ghost" style={{ marginTop: 4 }} onClick={() => play(s.path)}>Load the clip</button>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* what you can do about it */}
                      <div className="stack">
                        <div className={`tile sx-spine-gold${inviting === a.id ? " sx-working" : ""}`}>
                          <div className="tlbl">Invite to the cast</div>
                          <div className="field">
                            <label>Project</label>
                            <select value={projectPick[a.id] ?? projects[0]?.id ?? ""} onChange={(e) => setProjectPick((p) => ({ ...p, [a.id]: e.target.value }))}>
                              {projects.map((p) => (
                                <option key={p.id} value={p.id}>{p.name} · {LANG[p.language] ?? p.language}</option>
                              ))}
                            </select>
                          </div>
                          <button type="button" className="pill mint" disabled={inviting === a.id || a.status === "onboarded"} onClick={() => void invite(a)}>
                            {inviting === a.id ? "Sending…" : a.status === "onboarded" ? "Signed and onboarded" : a.status === "invited" ? "Resend invitation" : "Send invitation"}
                          </button>
                          {inviteMsg[a.id] && (
                            <div className={`sx-block sx-pop ${inviteMsg[a.id].startsWith("Invited") ? "sx-block-mint" : "sx-block-coral"}`} style={{ marginTop: 10 }} role="status">
                              <div className="tlbl">{inviteMsg[a.id].startsWith("Invited") ? "Invitation sent" : "Not sent"}</div>
                              <div className="tbody">{inviteMsg[a.id]}</div>
                            </div>
                          )}
                        </div>
                        <div className="tile">
                          <div className="field">
                            <label>Status</label>
                            <select value={a.status} onChange={(e) => setStatus(a.id, e.target.value as ApplicationStatus)}>
                              {STATUSES.map((s) => (
                                <option key={s} value={s}>{word(s)}</option>
                              ))}
                            </select>
                          </div>
                          <div className="field">
                            <label>Notes</label>
                            <textarea
                              rows={3}
                              value={notesDraft[a.id] ?? a.notes ?? ""}
                              onChange={(e) => { setSavedNotes(null); setNotesDraft((d) => ({ ...d, [a.id]: e.target.value })); }}
                              placeholder="Voice quality, accent region, follow-ups…"
                            />
                          </div>
                          <div className="btn-row" style={{ alignItems: "center" }}>
                            <button type="button" className="pill ghost" onClick={() => saveNotes(a.id)} disabled={(notesDraft[a.id] ?? a.notes ?? "") === (a.notes ?? "")}>Save notes</button>
                            {savedNotes === a.id && <span className="chip sx-ok sx-pop" role="status">✓ saved</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ),
              ];
            })}
          </div>
        )}
      </div>
    </div>
  );
}
