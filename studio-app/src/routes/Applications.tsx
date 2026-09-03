import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Application, ApplicationSample, ApplicationStatus } from "@/lib/types";
import { Logo } from "@/components/Logo";

const STATUSES: ApplicationStatus[] = ["submitted", "invited", "in_review", "accepted", "waitlisted", "rejected"];
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

/** Founder view of the waitlist: read, listen, triage, export. */
export function Applications({ onBack }: { onBack: () => void }) {
  const [rows, setRows] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | ApplicationStatus>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [audio, setAudio] = useState<Record<string, string>>({});
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

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

  const visible = filter === "all" ? rows : rows.filter((r) => r.status === filter);

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
    else setRows((rs) => rs.map((r) => (r.id === id ? { ...r, notes: notes || null } : r)));
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
    <div className="app">
      <div className="topbar">
        <button className="brand" onClick={onBack} style={{ background: "none", border: "none" }}>
          <span style={{ color: "var(--mut)", fontFamily: "var(--mono)", fontSize: "0.9rem" }}>‹ back</span>
        </button>
        <Logo height={22} />
      </div>

      <div className="shell" style={{ maxWidth: 720 }}>
        <div className="spread" style={{ marginBottom: 16, alignItems: "flex-start" }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Waitlist</div>
            <h1 className="h1">Applications · {rows.length}</h1>
          </div>
          <div className="btn-row" style={{ flex: "none" }}>
            <button className="pill ghost" onClick={load} disabled={loading}>Refresh</button>
            <button className="pill ghost" onClick={exportCsv} disabled={rows.length === 0}>CSV</button>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
          {(["all", ...STATUSES] as const).map((s) => (
            <button
              key={s}
              type="button"
              className="chip"
              onClick={() => setFilter(s)}
              style={{ cursor: "pointer", background: filter === s ? "var(--acc)" : undefined, color: filter === s ? "#0d0b08" : undefined, borderColor: filter === s ? "var(--acc)" : undefined }}
            >
              {s.replace("_", " ")} · {counts[s] ?? 0}
            </button>
          ))}
        </div>

        {err && (
          <div className="tile" style={{ borderColor: "var(--coral)", marginBottom: 14 }}>
            <div className="tbody" style={{ color: "var(--coral)" }}>{err}</div>
          </div>
        )}
        {loading && <div className="muted">Loading…</div>}
        {!loading && visible.length === 0 && <div className="muted">Nothing here yet. Share accentstudio.io/apply.</div>}

        <div className="stack">
          {visible.map((a) => {
            const isOpen = open === a.id;
            return (
              <div key={a.id} className="sheet">
                <div className="handle" />
                <button type="button" onClick={() => setOpen(isOpen ? null : a.id)} style={{ width: "100%", textAlign: "left", cursor: "pointer" }}>
                  <div className="spread" style={{ alignItems: "flex-start", gap: 12 }}>
                    <div>
                      <div className="ttitle">{a.full_name}</div>
                      <div className="tbody muted" style={{ marginTop: 4, fontSize: "0.85rem" }}>
                        {a.languages.map((l) => LANG[l] ?? l).join(", ")} · {a.country}{a.city ? ` · ${a.city}` : ""} · {a.device ?? "device?"} · {when(a.created_at)}
                      </div>
                    </div>
                    <div className="chip" style={{ flex: "none" }}>{samplesOf(a).length > 0 ? `🎙 ${samplesOf(a).length} sample${samplesOf(a).length > 1 ? "s" : ""}` : "no sample"}</div>
                  </div>
                </button>

                {isOpen && (
                  <>
                    <div className="tile">
                      <div className="tlbl">Contact</div>
                      <div className="tbody">
                        <a href={`mailto:${a.email}`} style={{ color: "var(--acc)" }}>{a.email}</a>
                        {a.phone ? ` · ${a.phone}` : ""}
                      </div>
                    </div>
                    <div className="tile">
                      <div className="tlbl">Profile</div>
                      <div className="tbody muted" style={{ fontSize: "0.88rem", lineHeight: 1.6 }}>
                        Strongest: <b style={{ color: "var(--ink)" }}>{LANG[a.primary_language] ?? a.primary_language}{a.other_language ? ` (${a.other_language})` : ""}</b>
                        <br />Age {a.age_band ?? "?"} · {a.gender ?? "gender n/a"} · {a.hours_per_week ?? "?"} h/week · pay via {a.payout_pref ?? "?"}
                        {a.motivation && <><br />Why: {a.motivation}</>}
                        {a.referral && <><br />Heard via: {a.referral}</>}
                        <br />Consent: contact {a.consent_contact ? "yes" : "no"} · sample {a.consent_sample ? "yes" : "no"}
                      </div>
                    </div>
                    {samplesOf(a).map((s) => (
                      <div className="tile" key={s.path}>
                        <div className="tlbl">{LANG[s.language] ?? s.language} sample · {Math.round(s.seconds)}s</div>
                        {audio[s.path] ? (
                          <audio controls src={audio[s.path]} style={{ width: "100%", marginTop: 8 }} />
                        ) : (
                          <button className="pill ghost" style={{ marginTop: 8 }} onClick={() => play(s.path)}>Load sample</button>
                        )}
                      </div>
                    ))}
                    <div className="tile">
                      <div className="field" style={{ marginBottom: 10 }}>
                        <label>Status</label>
                        <select value={a.status} onChange={(e) => setStatus(a.id, e.target.value as ApplicationStatus)}>
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>{s.replace("_", " ")}</option>
                          ))}
                        </select>
                      </div>
                      <div className="field" style={{ marginBottom: 10 }}>
                        <label>Notes</label>
                        <textarea
                          rows={3}
                          value={notesDraft[a.id] ?? a.notes ?? ""}
                          onChange={(e) => setNotesDraft((d) => ({ ...d, [a.id]: e.target.value }))}
                          placeholder="Voice quality, accent region, follow-ups…"
                        />
                      </div>
                      <button className="pill ghost" onClick={() => saveNotes(a.id)} disabled={(notesDraft[a.id] ?? a.notes ?? "") === (a.notes ?? "")}>Save notes</button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
