import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { LabInquiry, LabInquiryStatus } from "@/lib/types";
import { Logo } from "@/components/Logo";
import { Num, useRowMotion } from "@/components/sx-motion";

const STATUSES: LabInquiryStatus[] = ["new", "replied", "qualified", "closed"];

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** A new inquiry is the one that needs you, so it carries the gold; a qualified
 *  lead is mint; replied and closed are plain rows. */
const SPINE: Record<LabInquiryStatus, string> = { new: " sx-spine-gold", replied: "", qualified: " sx-spine-mint", closed: "" };
const CHIP: Record<LabInquiryStatus, string> = { new: " gold", replied: "", qualified: " on", closed: "" };

/** Founder view of inbound lab requests: read, triage, reply. */
export function LabInquiries({ onBack }: { onBack: () => void }) {
  const [rows, setRows] = useState<LabInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | LabInquiryStatus>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [savedNotes, setSavedNotes] = useState<string | null>(null);

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

  // memoised so the row-motion snapshot only moves when the list really does
  const visible = useMemo(() => (filter === "all" ? rows : rows.filter((r) => r.status === filter)), [rows, filter]);
  // the list arriving enters; an inquiry whose status moves washes once
  const rowCls = useRowMotion(visible, (r) => r.id, (r) => r.status);

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
    else {
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, notes: notes || null } : r)));
      setSavedNotes(id);
    }
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
            <div className="eyebrow">Labs</div>
            <h1 className="h1">Inquiries{!loading || rows.length ? <> · <Num value={rows.length} /></> : ""}</h1>
          </div>
        </div>

        <div className={`sx-bar${loading ? " sx-working" : ""}`} role="group" aria-label="Status">
          {(["all", ...STATUSES] as const).map((s) => (
            <button key={s} type="button" aria-pressed={filter === s} className={`chip num${filter === s ? " on" : ""}${s === "new" && filter !== "new" && (counts.new ?? 0) > 0 ? " gold" : ""}`} onClick={() => setFilter(s)}>
              {s} {counts[s] ?? 0}
            </button>
          ))}
          <div className="sx-bar-end">
            <button type="button" className="pill ghost" onClick={load} disabled={loading}>Refresh</button>
          </div>
        </div>

        <p className="sx-note">
          Requests from the form at accentstudio.io/labs, newest first. Open one to read the message, reply by email, move its status and keep notes.
          Gold is new and unanswered; mint is a qualified lead.
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
            <b>{rows.length === 0 ? "No inquiries yet." : "Nothing at this stage."}</b>
            <span>{rows.length === 0 ? "They arrive from the form at accentstudio.io/labs." : "Pick another status above."}</span>
          </div>
        )}

        {visible.length > 0 && (
          <div className="sx-list sx-enter">
            {visible.map((r) => {
              const isOpen = open === r.id;
              const cls = rowCls(r);
              const flash = cls === " sx-flash" && r.status === "new" ? " sx-flash sx-flash-gold" : cls;
              return [
                <button key={r.id} type="button" className={`sx-row${SPINE[r.status]}${flash}`} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : r.id)}>
                  <div className="sx-row-top">
                    <div className="sx-row-main">
                      <div className="sx-row-t">{r.org}</div>
                      <div className="sx-row-s">{r.name}</div>
                      <div className="sx-row-m">{when(r.created_at)}{r.ack_sent_at ? " · bundle sent" : r.notified_at ? " · notified" : ""}</div>
                    </div>
                    <div className="sx-row-end">
                      <span className={`chip${CHIP[r.status]}`}>{r.status}</span>
                    </div>
                  </div>
                </button>,

                isOpen && (
                  <div key={`${r.id}-open`} className={`sx-row sx-view${SPINE[r.status]}`}>
                    <div className="sx-pair">
                      <div className="stack">
                        <div className="tile">
                          <div className="tlbl">Contact</div>
                          <div className="tbody">
                            <a href={`mailto:${r.email}?subject=${encodeURIComponent(`Accent Studio · ${r.org}`)}`}>{r.email}</a>
                          </div>
                        </div>
                        <div className="tile">
                          <div className="tlbl">Message</div>
                          <div className="sx-read" style={{ whiteSpace: "pre-wrap" }}>{r.message ?? <span className="muted">No message.</span>}</div>
                        </div>
                      </div>
                      <div className="tile">
                        <div className="field">
                          <label>Status</label>
                          <select value={r.status} onChange={(e) => setStatus(r.id, e.target.value as LabInquiryStatus)}>
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>
                        <div className="field">
                          <label>Notes</label>
                          <textarea
                            rows={3}
                            value={notesDraft[r.id] ?? r.notes ?? ""}
                            onChange={(e) => { setSavedNotes(null); setNotesDraft((d) => ({ ...d, [r.id]: e.target.value })); }}
                            placeholder="Use case, locales, hours, budget signals, next step…"
                          />
                        </div>
                        <div className="btn-row" style={{ alignItems: "center" }}>
                          <button type="button" className="pill ghost" onClick={() => saveNotes(r.id)} disabled={(notesDraft[r.id] ?? r.notes ?? "") === (r.notes ?? "")}>Save notes</button>
                          {savedNotes === r.id && <span className="chip sx-ok sx-pop" role="status">✓ saved</span>}
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
