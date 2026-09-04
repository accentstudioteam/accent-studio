import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { LabInquiry, LabInquiryStatus } from "@/lib/types";
import { Logo } from "@/components/Logo";

const STATUSES: LabInquiryStatus[] = ["new", "replied", "qualified", "closed"];

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Founder view of inbound lab requests: read, triage, reply. */
export function LabInquiries({ onBack }: { onBack: () => void }) {
  const [rows, setRows] = useState<LabInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | LabInquiryStatus>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    setErr(null);
    const { data, error } = await supabase.from("lab_inquiries").select("*").order("created_at", { ascending: false }).limit(500);
    if (error) setErr(error.message);
    else setRows((data ?? []) as LabInquiry[]);
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

  const setStatus = async (id: string, status: LabInquiryStatus) => {
    const prev = rows;
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
    const { error } = await supabase.from("lab_inquiries").update({ status }).eq("id", id);
    if (error) {
      setErr(`Couldn't update status: ${error.message}`);
      setRows(prev);
    }
  };

  const saveNotes = async (id: string) => {
    const notes = (notesDraft[id] ?? "").slice(0, 4000);
    const { error } = await supabase.from("lab_inquiries").update({ notes: notes || null }).eq("id", id);
    if (error) setErr(`Couldn't save notes: ${error.message}`);
    else setRows((rs) => rs.map((r) => (r.id === id ? { ...r, notes: notes || null } : r)));
  };

  return (
    <div className="app">
      <div className="topbar">
        <button className="brand" onClick={onBack} style={{ background: "none", border: "none" }}>
          <span style={{ color: "var(--mut)", fontFamily: "var(--mono)", fontSize: "0.9rem" }}>‹ back</span>
        </button>
        <Logo height={22} accent="#f0a84b" />
      </div>

      <div className="shell" style={{ maxWidth: 720 }}>
        <div className="spread" style={{ marginBottom: 16, alignItems: "flex-start" }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 6, color: "#f0a84b" }}>Labs</div>
            <h1 className="h1">Inquiries · {rows.length}</h1>
          </div>
          <button className="pill ghost" onClick={load} disabled={loading} style={{ flex: "none" }}>Refresh</button>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
          {(["all", ...STATUSES] as const).map((s) => (
            <button
              key={s}
              type="button"
              className="chip"
              onClick={() => setFilter(s)}
              style={{ cursor: "pointer", background: filter === s ? "#f0a84b" : undefined, color: filter === s ? "#0d0b08" : undefined, borderColor: filter === s ? "#f0a84b" : undefined }}
            >
              {s} · {counts[s] ?? 0}
            </button>
          ))}
        </div>

        {err && (
          <div className="tile" style={{ borderColor: "var(--coral)", marginBottom: 14 }}>
            <div className="tbody" style={{ color: "var(--coral)" }}>{err}</div>
          </div>
        )}
        {loading && <div className="muted">Loading…</div>}
        {!loading && visible.length === 0 && <div className="muted">No inquiries yet. They arrive from the form at accentstudio.io/labs.</div>}

        <div className="stack">
          {visible.map((r) => {
            const isOpen = open === r.id;
            return (
              <div key={r.id} className="sheet">
                <div className="handle" />
                <button type="button" onClick={() => setOpen(isOpen ? null : r.id)} style={{ width: "100%", textAlign: "left", cursor: "pointer" }}>
                  <div className="spread" style={{ alignItems: "flex-start", gap: 12 }}>
                    <div>
                      <div className="ttitle">{r.org}</div>
                      <div className="tbody muted" style={{ marginTop: 4, fontSize: "0.85rem" }}>
                        {r.name} · {when(r.created_at)}{r.ack_sent_at ? " · bundle sent" : r.notified_at ? " · notified" : ""}
                      </div>
                    </div>
                    <div className="chip" style={{ flex: "none" }}>{r.status}</div>
                  </div>
                </button>

                {isOpen && (
                  <>
                    <div className="tile">
                      <div className="tlbl">Contact</div>
                      <div className="tbody">
                        <a href={`mailto:${r.email}?subject=${encodeURIComponent(`Accent Studio · ${r.org}`)}`} style={{ color: "#f0a84b" }}>{r.email}</a>
                      </div>
                    </div>
                    <div className="tile">
                      <div className="tlbl">Message</div>
                      <div className="tbody" style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{r.message ?? "No message."}</div>
                    </div>
                    <div className="tile">
                      <div className="field" style={{ marginBottom: 10 }}>
                        <label>Status</label>
                        <select value={r.status} onChange={(e) => setStatus(r.id, e.target.value as LabInquiryStatus)}>
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                      <div className="field" style={{ marginBottom: 10 }}>
                        <label>Notes</label>
                        <textarea
                          rows={3}
                          value={notesDraft[r.id] ?? r.notes ?? ""}
                          onChange={(e) => setNotesDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                          placeholder="Use case, locales, hours, budget signals, next step…"
                        />
                      </div>
                      <button className="pill ghost" onClick={() => saveNotes(r.id)} disabled={(notesDraft[r.id] ?? r.notes ?? "") === (r.notes ?? "")}>Save notes</button>
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
