import { useCallback, useEffect, useMemo, useState } from "react";
import { Logo } from "@/components/Logo";
import { Num, useRowMotion } from "@/components/sx-motion";
import { LANG_NAME } from "@/lib/game";
import { KIND_LABEL, NOTIFY_LABEL, STATUS_LABEL, contributor, contributorSet, contributors, dataRequestSet, hours, identityReview, type ContributorAction, type ContributorDetail, type ContributorRow, type Roster } from "@/lib/admin";
import { clauseHeading, consentFacts, downloadConsentJson, hashLivePdf, methodLabel, openConsentRecord, type LiveHash } from "@/lib/consentDoc";
import { DOC_KINDS, identityUrl } from "@/lib/account";
import { TIER_WORD, money } from "@/lib/earn";
import { REASON_LABEL, when } from "@/lib/verify";

interface Props {
  onBack: () => void;
  embedded?: boolean;
}
type Filter = "all" | "active" | "paused" | "closed" | "withdrawn" | "cases";

const FILTERS: [Filter, string][] = [["all", "All"], ["active", "Active"], ["paused", "Paused"], ["closed", "Closed"], ["withdrawn", "Withdrawn"], ["cases", "With open cases"]];

/** A contributor's state as the row's spine. Active is the normal case and gets
 *  nothing: on a roster of two hundred, colour is for the ones that need a look. */
const SPINE: Record<ContributorRow["status"], string> = { active: "", paused: " sx-spine-gold", closed: " sx-spine-coral", withdrawn: " sx-spine-lilac" };
const STATUS_CHIP: Record<ContributorRow["status"], string> = { active: "", paused: " gold", closed: " coral", withdrawn: "" };

/** Founder view: every signed contributor with their numbers, and one person in depth with the controls. */
export function Contributors({ onBack, embedded }: Props) {
  const [r, setR] = useState<Roster | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  const load = useCallback(async () => {
    setReading(true);
    try {
      setR(await contributors());
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "Couldn't load the roster.");
    }
    setReading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const needle = search.trim().toLowerCase();
  // memoised so the row-motion snapshot only moves when the list really does
  const shown = useMemo(
    () => (r?.people ?? []).filter((p) => (filter === "all" ? true : filter === "cases" ? p.open_cases > 0 : p.status === filter))
      .filter((p) => !needle || [p.speaker_id, p.full_name, p.email, p.city, p.country].some((v) => (v ?? "").toLowerCase().includes(needle))),
    [r, filter, needle],
  );
  const counts = useMemo(() => {
    const people = r?.people ?? [];
    return { all: people.length, active: r?.counts.active ?? 0, paused: r?.counts.paused ?? 0, closed: r?.counts.closed ?? 0, withdrawn: r?.counts.withdrawn ?? 0, cases: people.filter((p) => p.open_cases > 0).length } as Record<Filter, number>;
  }, [r]);

  // the roster arriving enters; a person whose status, case count or identity
  // state moved since the last read washes once
  const rowCls = useRowMotion(shown, (p) => p.id, (p) => `${p.status}|${p.open_cases}|${p.confirmed_cases}|${p.identity_status}|${p.open_data_requests}`);

  const body = open ? (
    <Detail cid={open} onBack={() => { setOpen(null); void load(); }} />
  ) : (
    <div className="shell wide">
      <div className="sx-head">
        <div>
          <div className="eyebrow">Founder tools</div>
          <h1 className="h1">Contributors{r ? <> · <Num value={r.people.length} /></> : ""}</h1>
        </div>
      </div>

      {r && (
        <div className="stats sx-rise">
          <div className="stat sx-spine-mint"><div className="n"><Num value={r.counts.active} /></div><div className="s">Active</div></div>
          <div className={`stat${r.counts.paused ? " sx-spine-gold" : ""}`}><div className={`n${r.counts.paused ? " sx-fig-gold" : ""}`}><Num value={r.counts.paused} /></div><div className="s">Paused</div></div>
          <div className={`stat${r.counts.closed ? " sx-spine-coral" : ""}`}><div className="n"><Num value={r.counts.closed} /></div><div className="s">Closed</div></div>
          <div className="stat"><div className="n"><Num value={r.counts.withdrawn} /></div><div className="s">Withdrew consent</div></div>
        </div>
      )}

      <div className={`sx-bar${reading ? " sx-working" : ""}`} role="group" aria-label="Filter">
        {FILTERS.map(([k, label]) => (
          <button key={k} type="button" aria-pressed={filter === k} className={`chip num${filter === k ? " on" : ""}${k === "cases" && counts.cases > 0 && filter !== "cases" ? " gold" : ""}`} onClick={() => setFilter(k)}>
            {label}{r ? ` ${counts[k]}` : ""}
          </button>
        ))}
        <div className="sx-bar-end" style={{ flex: "1 1 220px" }}>
          {/* gap: the bar has no text-input recipe, so the select's skin is borrowed */}
          <input className="sx-sel" type="search" aria-label="Find a contributor" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="speaker id, name, email, city" style={{ flex: 1, minWidth: 0, cursor: "text" }} />
          <button type="button" className="pill ghost" onClick={() => void load()}>Refresh</button>
        </div>
      </div>

      <p className="sx-note">
        Everyone who accepted an invitation and signed the agreement, by speaker id. Open a person for their sessions, money, identity check,
        data requests and the controls. Gold means paused, coral closed; a gold chip is something waiting on you.
      </p>

      {err && (
        <div className="sx-block sx-block-coral sx-pop" style={{ marginBottom: 12 }}>
          <div className="tlbl">The roster didn&rsquo;t load</div>
          <div className="tbody">{err}</div>
        </div>
      )}
      {!r && !err && <div className="full-center"><div className="spin" /></div>}
      {r && shown.length === 0 && (
        <div className="empty sx-pop">
          <b>{r.people.length === 0 ? "No contributors yet." : "Nobody matches."}</b>
          <span>{r.people.length === 0 ? "People appear here once they accept an invitation and sign the agreement." : "Try another filter or a shorter search."}</span>
        </div>
      )}
      {r && shown.length > 0 && (
        <div className="sx-list sx-enter">
          {shown.map((p) => <Row key={p.id} p={p} cls={rowCls(p)} onOpen={() => setOpen(p.id)} />)}
        </div>
      )}
    </div>
  );

  if (embedded) return <div className="sx-view" key={open ?? "roster"}>{body}</div>;
  return (
    <div className="app ankara studio-ank">
      <div className="topbar">
        <button type="button" className="sx-link" onClick={onBack}>‹ back</button>
        <Logo height={22} tone="mono" />
      </div>
      <div className="sx-view" key={open ?? "roster"}>{body}</div>
    </div>
  );
}

/** One person on the roster. `.roster-row` is the existing responsive grid: who,
 *  numbers and flags stack on a phone and sit in three columns from 900px. */
function Row({ p, cls, onOpen }: { p: ContributorRow; cls: string; onOpen: () => void }) {
  const flash = cls === " sx-flash" ? (p.status === "closed" ? " sx-flash sx-flash-coral" : p.status === "paused" || p.open_cases > 0 ? " sx-flash sx-flash-gold" : cls) : cls;
  return (
    <button type="button" className={`sx-row${SPINE[p.status]}${flash}`} onClick={onOpen} aria-label={`${p.speaker_id} · ${STATUS_LABEL[p.status]}`}>
      <div className="roster-row">
        <div className="roster-who">
          <div className="sx-row-t">{p.speaker_id}</div>
          <div className="sx-row-s">{p.full_name ?? "no name"} · {LANG_NAME[p.primary_language ?? ""] ?? p.primary_language ?? "?"} · {[p.city, p.country].filter(Boolean).join(", ")}</div>
          <div className="sx-row-m">joined {when(p.created_at)}{p.last_active_at ? ` · active ${when(p.last_active_at)}` : ""}</div>
        </div>
        <div className="roster-nums">
          <div className="rn"><b>{p.rallies + p.scenes}</b><span>{p.rallies} rallies · {p.scenes} scenes</span></div>
          <div className="rn"><b>{hours(p.verified_seconds)}</b><span>verified</span></div>
          <div className="rn"><b>{p.avg_quality != null ? Number(p.avg_quality).toFixed(2) : "–"}</b><span>quality</span></div>
          <div className="rn"><b>{money(p.earned_usd)}</b><span>earned · {money(p.paid_usd)} paid{Number(p.held_usd) > 0 ? ` · ${money(p.held_usd)} held` : ""}</span></div>
        </div>
        <div className="roster-flags">
          <div className="chips" style={{ marginTop: 0 }}>
            {p.open_cases > 0 && <span className="chip gold">{p.open_cases} open case{p.open_cases === 1 ? "" : "s"}</span>}
            {p.confirmed_cases > 0 && <span className="chip coral">{p.confirmed_cases} confirmed</span>}
            {p.arena_strikes > 0 && <span className="chip">{p.arena_strikes} arena strike{p.arena_strikes === 1 ? "" : "s"}</span>}
            {p.quiet_count > 0 && <span className="chip">went quiet {p.quiet_count}×</span>}
            {p.identity_status === "pending" && <span className="chip gold">identity to check</span>}
            {p.open_data_requests > 0 && <span className="chip gold">{p.open_data_requests} data request{p.open_data_requests === 1 ? "" : "s"}</span>}
            {/* consent state without opening the person: the version signed, or that it went */}
            {p.consent ? (
              <span className="chip" title={`Agreement v${p.consent.agreement_version}, signed ${when(p.consent.signed_at)}${p.consent.withdrawn_at ? `, withdrawn ${when(p.consent.withdrawn_at)}` : ""}`}>
                {p.consent.withdrawn_at ? "consent withdrawn" : `consent v${p.consent.agreement_version}`}
              </span>
            ) : (
              <span className="chip gold">no consent record</span>
            )}
          </div>
          <span className={`chip${STATUS_CHIP[p.status]}`}>{STATUS_LABEL[p.status]}</span>
        </div>
      </div>
    </button>
  );
}

function IdentityAndPayout({ d, onChanged }: { d: ContributorDetail; onChanged: () => Promise<void> }) {
  const [note, setNote] = useState("");
  const [links, setLinks] = useState<{ doc: string | null; selfie: string | null } | null>(null);
  const [reply, setReply] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ack, setAck] = useState<string | null>(null);
  const id = d.identity;
  const act = async (fn: () => Promise<unknown>, done: string) => {
    setErr(null);
    setAck(null);
    setBusy(true);
    try {
      await fn();
      setAck(done);
      await onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "That didn't work.");
    }
    setBusy(false);
  };
  const view = async () => {
    if (!id?.doc_path || !id.selfie_path) return;
    setLinks({ doc: await identityUrl(id.doc_path), selfie: await identityUrl(id.selfie_path) });
  };
  const open = d.data_requests.filter((r) => r.status === "open");
  return (
    <div className={`sheet${busy ? " sx-working" : ""}`} style={{ marginBottom: 12 }}>
      <div className="shead"><i className="g" />Identity, payout, data</div>
      {ack && <div className="sx-block sx-block-mint sx-pop" role="status"><div className="tbody">{ack}</div></div>}
      {err && <div className="sx-block sx-block-coral sx-pop"><div className="tbody">{err}</div></div>}
      <div className={`tile${id?.status === "pending" ? " sx-spine-gold" : id?.status === "verified" ? " sx-spine-mint" : ""}`}>
        <div className="tlbl">Identity · {id ? id.status : "not sent"}</div>
        {id && <div className="tbody small">{DOC_KINDS.find((k) => k.code === id.doc_kind)?.name ?? id.doc_kind} · sent {when(id.submitted_at)}{id.reviewed_at ? ` · ${id.status} by ${id.reviewer_id ?? "?"} ${when(id.reviewed_at)}` : ""}{id.note ? ` · ${id.note}` : ""}</div>}
        {id?.doc_path && !links && <button type="button" className="pill ghost" style={{ marginTop: 8 }} onClick={() => void view()}>Open the photos</button>}
        {links && <div className="tbody small sx-pop" style={{ marginTop: 6 }}>{links.doc ? <a href={links.doc} target="_blank" rel="noopener noreferrer">document</a> : "document (demo)"} · {links.selfie ? <a href={links.selfie} target="_blank" rel="noopener noreferrer">selfie</a> : "selfie (demo)"}</div>}
        {id?.status === "pending" && (
          <>
            <div className="field" style={{ marginTop: 8 }}><label>Note · the contributor sees it if rejected</label><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. the name does not match the application" /></div>
            <div className="btn-row">
              <button type="button" className="pill mint" disabled={busy} onClick={() => void act(() => identityReview(d.id, "verified", note), "Identity verified.")}>Verify identity</button>
              <button type="button" className="pill ghost" disabled={busy || note.trim().length < 3} onClick={() => void act(() => identityReview(d.id, "rejected", note), "Identity rejected. The contributor sees your note.")}>Reject</button>
            </div>
          </>
        )}
      </div>
      <div className="tile">
        <div className="tlbl">Payout details · {d.payout ? d.payout.rail : "none yet"}</div>
        {d.payout ? <div className="tbody small mono">{Object.entries(d.payout.details).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`).join(" · ")}</div> : <div className="tbody muted small">They add these in Account before a payout.</div>}
      </div>
      {d.data_requests.length > 0 && (
        <div className={`tile${open.length ? " sx-spine-gold" : ""}`}>
          <div className="tlbl">Data requests · {open.length} open</div>
          {d.data_requests.map((r) => <div key={r.id} className="tbody small">{r.kind === "copy" ? "A copy of their data" : "Deletion"} · {r.status} · {when(r.created_at)}{r.note ? ` · "${r.note}"` : ""}{r.response ? ` · answered: ${r.response}` : ""}</div>)}
          {open.length > 0 && (
            <>
              <div className="field" style={{ marginTop: 8 }}><label>What was done · the contributor sees it</label><input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="e.g. sent as a zip by email on the 22nd" /></div>
              <div className="btn-row">
                <button type="button" className="pill mint" disabled={busy || reply.trim().length < 3} onClick={() => void act(() => dataRequestSet(open[0].id, "done", reply), "Marked done. The contributor sees your reply.")}>Mark done</button>
                <button type="button" className="pill ghost" disabled={busy || reply.trim().length < 3} onClick={() => void act(() => dataRequestSet(open[0].id, "declined", reply), "Declined. The contributor sees your reply.")}>Decline</button>
              </div>
              <div className="tbody muted small">Copies within 30 days; deletion removes name, email and photos, while delivered recordings stay pseudonymous under the agreement.</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** A timestamp as the record itself carries it: UTC, to the second, no locale. The rest of the
 *  screen uses `when()`; here a lawyer compares against the email and the JSON, so it must match them. */
const utc = (iso: string | null): string => (iso ? new Date(iso).toISOString().replace(/\.\d{3}Z$/, "Z").replace("T", " ").replace("Z", " UTC") : "");

/** The signed consent record in full. The one place in the Studio where a contributor is their legal
 *  name rather than their alias: a buyer doing diligence asks how consent was obtained, and this is
 *  the answer, with the agreement PDF they signed and the record itself to hand over. */
function ConsentSection({ d }: { d: ContributorDetail }) {
  const c = d.consent;
  const [live, setLive] = useState<LiveHash>({ state: "idle" });
  const [acked, setAcked] = useState<string | null>(null);
  if (!c) {
    return (
      <div className="sheet sx-spine-gold" style={{ marginBottom: 12 }}>
        <div className="shead"><i className="g" />Consent · no record</div>
        <div className="tile dash"><div className="tbody small">No consent record is held for this contributor. Nobody should reach the roster without one: check the sign-agreement function and the invitation before they record anything.</div></div>
      </div>
    );
  }
  const f = consentFacts(c, d.speaker_id);
  const registry = c.agreement?.sha256 ?? null;
  const registryMatch = registry == null || c.agreement_sha256 == null ? null : registry.toLowerCase() === c.agreement_sha256.toLowerCase();
  const withdrawn = Boolean(c.withdrawn_at);
  const check = async () => {
    if (!c.agreement?.url) return;
    setLive({ state: "checking" });
    setLive(await hashLivePdf(c.agreement.url, c.agreement_sha256));
  };
  const give = (what: "record" | "json") => {
    if (what === "record") openConsentRecord(f);
    else downloadConsentJson(f);
    setAcked(what === "record" ? "Opened in a new tab. Print it, or save as PDF from the print dialog." : "JSON saved.");
  };
  return (
    <div className={`sheet${withdrawn ? " sx-spine-lilac" : ""}`} style={{ marginBottom: 12 }}>
      <div className="shead"><i className="g" />Consent · agreement v{c.agreement_version}{withdrawn ? " · withdrawn" : ""}</div>
      <p className="sx-note">
        The signed record, with the legal name as typed. Everywhere else this person is {c.alias ? <b>{c.alias}</b> : "their alias"}; here the name is the point.
        The record and the agreement are for Accent Studio, its counsel and a buyer&rsquo;s diligence under NDA. They never go into a delivery.
      </p>
      <div className="btn-row" style={{ alignItems: "center" }}>
        {c.agreement?.url ? (
          <a className="pill ghost" href={c.agreement.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>Agreement v{c.agreement_version} · PDF</a>
        ) : (
          <span className="chip">agreement v{c.agreement_version} has no hosted PDF</span>
        )}
        <button type="button" className="pill mint" onClick={() => give("record")}>Open the signed record</button>
        <button type="button" className="pill ghost" onClick={() => give("json")}>Download as JSON</button>
        {acked && <span className="chip sx-ok sx-pop" role="status">✓ {acked}</span>}
      </div>

      <div className={`tile${c.legal_name_attested ? " sx-spine-mint" : ""}`}>
        <div className="tlbl">Signed by</div>
        <div className="tbody">{c.legal_name ?? <span className="muted">no legal name taken at signing</span>}</div>
        <div className="sx-meta">{c.legal_name ? (c.legal_name_attested ? "attested as their real legal name · not checked against an ID; identity verification happens at payout" : "no attestation taken") : "the older flow confirmed by email passcode only; the application name is held separately"}</div>
      </div>
      <div className="tile">
        <div className="tlbl">Speaker</div>
        <div className="tbody mono">{f.speaker_id}</div>
        <div className="sx-meta">known in the app as <b>{c.alias ?? "no alias yet"}</b> · datasets carry the speaker id, never the name</div>
      </div>
      <div className="tile">
        <div className="tlbl">Signed at</div>
        <div className="tbody mono">{utc(c.signed_at)}</div>
        <div className="sx-meta">by {methodLabel(c.signature_method)}{c.signature_method ? ` · ${c.signature_method}` : ""}</div>
      </div>
      <div className={`tile${registryMatch === false ? " sx-spine-coral" : ""}`}>
        <div className="tlbl">Agreement</div>
        <div className="tbody">v{c.agreement_version}{c.agreement?.document_id ? ` · document ${c.agreement.document_id}` : ""}{c.agreement?.effective_date ? ` · effective ${c.agreement.effective_date}` : ""}</div>
        <div className="sx-meta" style={{ wordBreak: "break-all" }}>SHA-256 at signing · <b>{c.agreement_sha256 ?? "not recorded"}</b></div>
        {registryMatch === true && <div className="sx-meta">matches the registry&rsquo;s SHA-256 for v{c.agreement_version}</div>}
        {registryMatch === false && <div className="sx-meta sx-fig-coral" style={{ wordBreak: "break-all" }}>registry holds a different SHA-256 for v{c.agreement_version} · {registry}</div>}
        {c.agreement?.url && (
          <div className="btn-row" style={{ alignItems: "center", marginTop: 8 }}>
            <button type="button" className="pill ghost" disabled={live.state === "checking"} onClick={() => void check()}>{live.state === "checking" ? "Hashing the hosted PDF…" : "Check the hosted PDF against this hash"}</button>
            {live.state === "done" && live.matches && <span className="chip sx-ok sx-pop" role="status">✓ hosted PDF matches</span>}
            {live.state === "done" && !live.matches && <span className="chip coral sx-pop" role="status">hosted PDF differs</span>}
          </div>
        )}
        {live.state === "done" && !live.matches && <div className="sx-meta sx-fig-coral" style={{ wordBreak: "break-all" }}>hosted file now hashes to {live.sha256}. The signer saw the file with the hash above; find out what changed before anyone relies on the hosted copy.</div>}
        {live.state === "failed" && <div className="sx-meta">The browser couldn&rsquo;t read the hosted file ({live.why}), so compare by eye: the hash above is what was signed; the registry&rsquo;s is {registry ?? "not held"}.</div>}
      </div>
      <div className="tile">
        <div className="tlbl">Consent record fingerprint · SHA-256</div>
        <div className="tbody mono" style={{ wordBreak: "break-all" }}>{c.record_sha256}</div>
        <div className="sx-meta">the hash of the canonical record JSON · travels in consent_log.jsonl of every delivery this speaker is in</div>
      </div>
      <div className="tile">
        <div className="tlbl">Clauses initialled · {c.clauses_initialled.length}</div>
        {c.clauses_initialled.length === 0 && <div className="tbody small muted">None. This record predates initialled clauses: the two consents were ticked and confirmed by email passcode.</div>}
        {c.clauses_initialled.map((k) => (
          <div key={k.id} style={{ marginTop: 6 }}>
            <div className="tbody small">Clause {k.clause} · {clauseHeading(k.id, k.clause)} · initialled <b>{k.initials}</b> <span className="sx-meta">· wording v{k.version}</span></div>
            {/* the exact text they attached their initials to; .sx-note is the quoted-aside recipe here */}
            <p className="sx-note" style={{ marginBottom: 0, marginTop: 2 }}>{k.text}</p>
          </div>
        ))}
      </div>
      {withdrawn && (
        <div className="tile sx-spine-lilac">
          <div className="tlbl">Withdrawn</div>
          <div className="tbody mono">{utc(c.withdrawn_at)}</div>
          <div className="sx-meta">new use stopped from this moment · undelivered recordings deleted within 30 days · deliveries already made are covered by clause 6</div>
        </div>
      )}
    </div>
  );
}

const ACK: Record<ContributorAction, string> = {
  pause: "Paused. New rallies and bookings are blocked until it lifts; verified earnings still pay.",
  unpause: "Pause lifted. They can play again.",
  close: "Account closed. Open rallies and bookings are ended; earnings not under a case are still paid.",
  reopen: "Account reopened.",
  note: "Note saved.",
};

function Detail({ cid, onBack }: { cid: string; onBack: () => void }) {
  const [d, setD] = useState<ContributorDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [days, setDays] = useState("7");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  // what just happened, named, because pausing or closing somebody is not a thing to do silently
  const [ack, setAck] = useState<{ kind: ContributorAction; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const x = await contributor(cid);
      setD(x);
      setNote(x.admin_note ?? "");
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "Couldn't load this contributor.");
    }
  }, [cid]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (action: ContributorAction, r: string | null, n: number | null) => {
    setBusy(true);
    setErr(null);
    setAck(null);
    try {
      await contributorSet(cid, action, r, n);
      setReason("");
      setAck({ kind: action, text: action === "pause" ? `Paused for ${n ?? 7} days. New rallies and bookings are blocked until it lifts; verified earnings still pay.` : ACK[action] });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "That didn't work.");
    }
    setBusy(false);
  };

  const spine = d ? SPINE[d.status] : "";

  return (
    <div className="shell wide">
      <div className="sx-head">
        <div>
          {/* the eyebrow carries what this screen already showed an admin: name, email, language, place */}
          <div className="eyebrow">{d ? <>{d.full_name ?? "Contributor"} · {d.email ?? "no email"} · {LANG_NAME[d.primary_language ?? ""] ?? d.primary_language ?? "?"}{d.languages.length > 1 ? ` (+${d.languages.length - 1})` : ""} · {[d.city, d.country].filter(Boolean).join(", ")}</> : "Contributor"}</div>
          <h1 className="h1">{d?.speaker_id ?? "…"}</h1>
        </div>
      </div>

      <div className="sx-bar">
        <button type="button" className="pill ghost" onClick={onBack}>‹ contributors</button>
        {d && <span className={`chip${STATUS_CHIP[d.status]}`}>{STATUS_LABEL[d.status]}</span>}
        {d && <span className="chip num">{hours(d.verified_seconds)} verified</span>}
        {d && <span className="chip num">{money(d.earned_usd)} earned</span>}
        {d && d.open_cases > 0 && <span className="chip gold">{d.open_cases} open case{d.open_cases === 1 ? "" : "s"}</span>}
        <div className="sx-bar-end">
          <button type="button" className="pill ghost" onClick={() => void load()}>Refresh</button>
        </div>
      </div>

      {err && (
        <div className="sx-block sx-block-coral sx-pop" style={{ marginBottom: 12 }}>
          <div className="tlbl">That didn&rsquo;t work</div>
          <div className="tbody">{err}</div>
        </div>
      )}
      {!d && !err && <div className="full-center"><div className="spin" /></div>}
      {d && (
        <>
          <div className={`sheet sx-in-card${spine}`} style={{ marginBottom: 12 }}>
            <div className="shead"><i className={d.status === "active" ? undefined : "g"} />Status · {STATUS_LABEL[d.status]}</div>
            {d.status === "paused" && <div className="tile sx-spine-gold"><div className="tlbl sx-fig-gold">Paused until {when(d.paused_until ?? "")}</div><div className="tbody small">{d.paused_reason}</div></div>}
            {d.status === "closed" && <div className="tile sx-spine-coral"><div className="tlbl sx-fig-coral">Closed {when(d.closed_at ?? "")}</div><div className="tbody small">{d.closed_reason ?? "by a clause 15 decision"}</div></div>}
            {d.status === "withdrawn" && <div className="tile dash"><div className="tbody small">Consent withdrawn {when(d.withdrawn_at ?? "")}. Their sessions leave future deliveries.</div></div>}
            <div className="stats" style={{ marginBottom: 0 }}>
              <div className="stat"><div className="n">{hours(d.verified_seconds)}</div><div className="s">{d.rallies} rallies · {d.scenes} scenes · {d.abandoned} closed early by them</div></div>
              <div className="stat"><div className="n">{d.avg_quality != null ? Number(d.avg_quality).toFixed(2) : "–"}</div><div className="s">quality, across verified sessions</div></div>
              <div className={`stat${Number(d.held_usd) > 0 ? " sx-spine-gold" : ""}`}><div className="n">{money(d.earned_usd)}</div><div className="s">paid {money(d.paid_usd)} · ready {money(d.cleared_usd)}{Number(d.held_usd) > 0 ? ` · held ${money(d.held_usd)}` : ""}</div></div>
              <div className={`stat${d.open_cases > 0 ? " sx-spine-gold" : ""}`}><div className={`n${d.open_cases > 0 ? " sx-fig-gold" : ""}`}><Num value={d.open_cases} /> open</div><div className="s">{d.confirmed_cases} confirmed · {d.arena_strikes} arena strikes · quiet {d.quiet_count}×</div></div>
            </div>
          </div>

          <ConsentSection d={d} />

          <div className={`sheet${busy ? " sx-working" : ""}`} style={{ marginBottom: 12 }}>
            <div className="shead"><i className="g" />Controls</div>
            {ack && (
              <div className={`sx-block sx-pop ${ack.kind === "close" ? "sx-block-coral" : ack.kind === "pause" ? "sx-block-gold" : "sx-block-mint"}`} role="status">
                <div className="tlbl">Done</div>
                <div className="tbody">{ack.text}</div>
              </div>
            )}
            {d.status !== "closed" && d.status !== "withdrawn" && (
              <>
                <div className="field"><label>Reason · the contributor sees it</label><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. several takes sounded read, not played; let's talk first" /></div>
                <div className="btn-row" style={{ alignItems: "flex-end" }}>
                  {d.status === "paused" ? (
                    <button type="button" className="pill ghost" disabled={busy} onClick={() => void act("unpause", null, null)}>Lift the pause</button>
                  ) : (
                    <>
                      <div className="field" style={{ width: 90, flex: "none", marginBottom: 0 }}><label>Days</label><input inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} /></div>
                      <button type="button" className="pill gold" disabled={busy || reason.trim().length < 3} onClick={() => void act("pause", reason, Number(days) || 7)}>Pause</button>
                    </>
                  )}
                  <button type="button" className="pill coral" disabled={busy || reason.trim().length < 3} onClick={() => void act("close", reason, null)}>Close the account</button>
                </div>
                <div className="tbody muted small">A pause blocks new rallies and bookings until it lifts; verified earnings still pay. Closing ends open rallies and bookings; earnings from sessions not under a case are still paid.</div>
              </>
            )}
            {d.status === "closed" && <button type="button" className="pill ghost" disabled={busy} onClick={() => void act("reopen", null, null)}>Reopen the account</button>}
            <div className="field"><label>Private note · staff only</label><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything the team should know." /></div>
            <div className="btn-row" style={{ alignItems: "center" }}>
              <button type="button" className="pill ghost" disabled={busy || note === (d.admin_note ?? "")} onClick={() => void act("note", note, null)}>Save the note</button>
              {ack?.kind === "note" && <span className="chip sx-ok sx-pop" role="status">✓ saved</span>}
            </div>
          </div>

          <IdentityAndPayout d={d} onChanged={load} />

          <div className="sheet" style={{ marginBottom: 12 }}>
            <div className="shead"><i />Sessions · {d.sessions.length}</div>
            {d.sessions.length === 0 && <div className="tbody muted small">None yet.</div>}
            {d.sessions.map((s) => (
              <div key={s.id} className={`tile${s.audit_outcome === "adjusted" ? " sx-spine-gold" : ""}`}>
                <div className="sx-row-top">
                  <div className="sx-row-main">
                    <div className="tbody small">{s.title} · {s.mode === "live" ? "live scene" : "rally"} with {s.partner ?? "?"} · {when(s.at)}</div>
                    <div className="sx-meta">{s.status}{s.abandoned_reason ? ` (${s.abandoned_reason.replace(/_/g, " ")}${s.abandoned_by_me ? ", by them" : ""})` : ""} · {Math.round(Number(s.my_seconds))} s of theirs{s.earned_usd != null ? ` · ${money(s.earned_usd)} ${s.earning_status}` : ""}{s.audit_outcome ? ` · audit ${s.audit_outcome}` : ""}</div>
                  </div>
                  <div className="sx-row-end">
                    <span className="chip">{s.verified ? TIER_WORD[s.quality_tier ?? ""] ?? s.quality_tier : "not verified"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {(d.cases.length > 0 || d.payouts.length > 0 || d.bookings.length > 0) && (
            <div className="sheet" style={{ marginBottom: 12 }}>
              <div className="shead"><i className="g" />Cases, payouts, bookings</div>
              {d.cases.map((c) => <div key={c.id} className={`tile${c.decision && c.decision !== "dismissed" ? " sx-spine-coral" : c.decision ? "" : " sx-spine-gold"}`}><div className="tbody small">Case · {REASON_LABEL[c.reason as keyof typeof REASON_LABEL] ?? c.reason} · {c.decision ? `decided: ${c.decision.replace(/_/g, " ")}` : c.status.replace(/_/g, " ")} · {when(c.created_at)}</div></div>)}
              {d.payouts.map((p) => <div key={p.id} className={`tile${p.status === "paid" ? " sx-spine-mint" : p.status === "requested" ? " sx-spine-gold" : ""}`}><div className="tbody small">Payout · {money(p.amount_usd)} by {p.rail} · {p.status} · {when(p.paid_at ?? p.requested_at)}{p.reference ? ` · ${p.reference}` : ""}</div></div>)}
              {d.bookings.map((b) => <div key={b.id} className="tile"><div className="tbody small">Booking · {new Date(b.starts_at).toLocaleString("en-GB", { timeZone: "Africa/Lagos", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} Lagos · {b.status.replace(/_/g, " ")}</div></div>)}
            </div>
          )}

          {d.notifications.length > 0 && (
            <div className="sheet" style={{ marginBottom: 12 }}>
              <div className="shead"><i />Emails · {d.notifications.length}</div>
              {d.notifications.map((n) => <div key={n.id} className={`tile${n.error && !n.sent_at ? " sx-spine-coral" : ""}`}><div className="tbody small">{when(n.created_at)} · {NOTIFY_LABEL[n.kind] ?? n.kind} · {n.sent_at ? "sent" : n.error ? `failed: ${n.error}` : "waiting"}{n.attempts > 1 ? ` · ${n.attempts} attempts` : ""}</div></div>)}
            </div>
          )}
          {d.events.length > 0 && (
            <div className="sheet">
              <div className="shead"><i />Staff actions</div>
              <ul className="timeline">
                {d.events.map((e, n) => <li key={n}><span className="sx-meta" style={{ flex: "none" }}>{when(e.at)}</span><span>{e.actor ?? "?"} · {KIND_LABEL[e.kind] ?? e.kind}{e.detail.reason ? ` · ${String(e.detail.reason)}` : ""}{e.detail.days ? ` · ${String(e.detail.days)} days` : ""}</span></li>)}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
