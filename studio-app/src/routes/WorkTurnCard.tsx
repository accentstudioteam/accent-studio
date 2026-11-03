import { useEffect, useState } from "react";
import { VoiceNote } from "@/components/VoiceNote";
import { WordAligner, type Alignment } from "@/components/WordAligner";
import { CONFIDENCE, EMOTIONS, ISSUES, PII_TYPES, REASON_LABEL, regloss, savePii, saveTurn, suggestPii, type CaseReason, type PiiSpan, type PiiType, type RatingCheck, type Speaker, type WorkTurn, type Workbench } from "@/lib/verify";
import { isDemo } from "@/lib/demo";
import { demoNotesFor } from "@/lib/demoVerify";

interface Props {
  t: WorkTurn;
  w: Workbench;
  src: string | null;
  canEdit: boolean;
  onSaved: () => void;
  onFlag: (who: Speaker, reason: CaseReason, detail: string, tid: string) => Promise<void>;
}

const REASONS_FOR_SPEAKER: CaseReason[] = ["not_live", "impersonation", "filler", "duplicate_content", "identity", "voice_taken_outside", "pairing_interference", "other"];
const REASONS_FOR_RATER: CaseReason[] = ["rating_mismatch", "pairing_interference", "other"];
const LANG_SHORT: Record<string, string> = { pcm: "Pidgin", yo: "Yoruba", ha: "Hausa", ig: "Igbo", sw: "Swahili", zu: "isiZulu" };

/** One take on the workbench: listen, correct the machine draft into the transcript, gloss, align words, mark confidence and issues, check the peer rating, flag if needed.
 *
 *  The two text panes sit side by side with a rule between them (`.sx-pair`), so
 *  the transcript and its gloss stay on the same line as you work down them.
 *  Nothing on this card animates: it is the surface being read. */
export function WorkTurnCard({ t, w, src, canEdit, onSaved, onFlag }: Props) {
  const v = t.verification;
  const d = w.stt.show ? t.draft : null;
  const draftText = d?.status === "done" && d.text ? d.text.trim() : null;
  const draftGloss = d?.status === "done" && d.gloss ? d.gloss.trim() : null;
  const [text, setText] = useState(v?.verified_text ?? "");
  const [gloss, setGloss] = useState(v?.english_gloss ?? "");
  const [emotion, setEmotion] = useState(v?.emotion_label ?? "");
  const [confidence, setConfidence] = useState<number | null>(v?.confidence ?? null);
  const [issues, setIssues] = useState<string[]>(v?.issues ?? []);
  const [seconds, setSeconds] = useState<string>(String(v?.verified_seconds ?? t.seconds));
  const [check, setCheck] = useState<RatingCheck | null>(v?.rating_check ?? null);
  const [alignments, setAlignments] = useState<Alignment[]>((v?.alignments as Alignment[] | undefined) ?? []);
  const [alignOpen, setAlignOpen] = useState(((v?.alignments as Alignment[] | undefined) ?? []).length > 0);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(v?.updated_at ?? null);
  const [justSaved, setJustSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [flagOpen, setFlagOpen] = useState(false);
  const [flagWho, setFlagWho] = useState<"speaker" | "rater">("speaker");
  const [flagReason, setFlagReason] = useState<CaseReason>("not_live");
  const [flagDetail, setFlagDetail] = useState("");
  const [glossing, setGlossing] = useState(false);
  const [glossEngine, setGlossEngine] = useState<string | null>(d?.gloss_engine ?? null);
  const [pii, setPii] = useState<PiiSpan[]>(v?.pii_redactions ?? []);
  const [piiText, setPiiText] = useState("");
  const [piiType, setPiiType] = useState<PiiType>("phone");

  // The machine drafts land straight in the boxes, ready to correct. Only when a box is empty.
  useEffect(() => {
    if (!canEdit || !draftText) return;
    setText((cur) => (cur.trim() ? cur : draftText));
  }, [draftText, canEdit]);
  useEffect(() => {
    if (!canEdit || !draftGloss) return;
    setGloss((cur) => (cur.trim() ? cur : draftGloss));
  }, [draftGloss, canEdit]);

  // the one piece of motion the bench gets: a save says so, then settles
  useEffect(() => {
    if (!justSaved) return;
    const id = window.setTimeout(() => setJustSaved(false), 1600);
    return () => window.clearTimeout(id);
  }, [justSaved]);

  const doRegloss = async () => {
    if (!text.trim()) return setErr("Write or correct the transcript first.");
    setGlossing(true);
    setErr(null);
    try {
      const g = await regloss(t.turn_id, text);
      setGloss(g.gloss);
      setGlossEngine(g.engine);
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "Couldn't gloss the transcript.");
    }
    setGlossing(false);
  };

  const other: Speaker = t.speaker === "a" ? "b" : "a";
  const speakerId = t.speaker_id ?? w.speakers[t.speaker] ?? "";
  const raterId = w.speakers[other] ?? "";
  const savedAlign = JSON.stringify(v?.alignments ?? []);
  const savedPii = JSON.stringify(v?.pii_redactions ?? []);
  const piiDirty = JSON.stringify(pii) !== savedPii;
  const suggestions = suggestPii(text).filter((s) => !pii.some((p) => p.text === s.text));
  const piiLabel = (k: PiiType) => PII_TYPES.find(([c]) => c === k)?.[1] ?? k;
  const addPii = (s: PiiSpan) => setPii((xs) => (xs.some((x) => x.text === s.text) ? xs : [...xs, s]));
  const dirty = piiDirty || text !== (v?.verified_text ?? "") || gloss !== (v?.english_gloss ?? "") || emotion !== (v?.emotion_label ?? "") || confidence !== (v?.confidence ?? null) || check !== (v?.rating_check ?? null) || issues.join() !== (v?.issues ?? []).join() || Number(seconds) !== (v?.verified_seconds ?? t.seconds) || JSON.stringify(alignments) !== savedAlign;

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const secs = Number(seconds);
      await saveTurn({ turn_id: t.turn_id, verified_text: text, english_gloss: gloss, emotion: emotion || null, confidence, issues, verified_seconds: Number.isFinite(secs) ? secs : null, rating_check: check, alignments });
      if (piiDirty) await savePii(t.turn_id, pii);
      setSavedAt(new Date().toISOString());
      setJustSaved(true);
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "Couldn't save this turn.");
    }
    setBusy(false);
  };

  const sendFlag = async () => {
    setBusy(true);
    setErr(null);
    try {
      await onFlag(flagWho === "speaker" ? t.speaker : other, flagReason, flagDetail, t.turn_id);
      setFlagOpen(false);
      setFlagDetail("");
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "Couldn't open the case.");
    }
    setBusy(false);
  };

  const fillFromNotes = () => {
    const n = demoNotesFor(t.audio_path);
    if (!n) return;
    setText(n.text);
    setGloss(n.en);
    if (confidence == null) setConfidence(1);
  };

  const toggleIssue = (k: string) => setIssues((xs) => (xs.includes(k) ? xs.filter((x) => x !== k) : [...xs, k]));
  const r = t.rating;
  const lang = LANG_SHORT[w.language] ?? w.language;

  return (
    <div className={`wt ${t.speaker}${t.latest ? "" : " old"}`}>
      <div className="spread" style={{ alignItems: "flex-start" }}>
        <div className="sx-meta">
          Turn <b>{t.turn_no}</b>{t.attempt > 1 ? ` · take ${t.attempt}` : ""} · Speaker <b>{t.speaker.toUpperCase()}</b> · {speakerId} · {Math.round(t.seconds)} s{t.latest ? "" : " · replaced by a later take"}
        </div>
        {savedAt && (
          <span className={`chip${dirty ? "" : " sx-ok"}${justSaved && !dirty ? " sx-pop" : ""}`}>{dirty ? "edited" : "saved"}</span>
        )}
      </div>

      <div style={{ margin: "8px 0" }}><VoiceNote src={src} seconds={t.seconds} tone={t.speaker === "a" ? "them" : "me"} /></div>

      {r ? (
        <div className="sx-meta">
          Rated by {raterId || `speaker ${other.toUpperCase()}`}: <b className={Number(r.aggregate) < 4 ? "sx-fig-gold" : undefined}>{Number(r.aggregate).toFixed(2)}</b> · tone {r.tone} · situation {r.prompt_adherence} · mood {r.mood} · clarity {r.clarity}
        </div>
      ) : (
        <div className="sx-meta">Not rated. The partner went quiet before rating it.</div>
      )}
      {r && canEdit && (
        <div style={{ marginTop: 8 }}>
          <div className="tlbl">Does the rating match the audio?</div>
          <div className="chips">
            {(["fair", "too_high", "too_low"] as RatingCheck[]).map((k) => (
              <button key={k} type="button" className={`chip${check === k ? " on" : ""}`} onClick={() => setCheck(k)}>{k === "fair" ? "Fair" : k === "too_high" ? "Too high" : "Too low"}</button>
            ))}
          </div>
        </div>
      )}

      {canEdit ? (
        <>
          {/* the comparison that is the whole job: what was said, and what it
              means, on one baseline with a rule between them */}
          <div className="sx-pair" style={{ marginTop: 10 }}>
            <div className="sx-pane">
              <div className="sx-pane-h">
                <label htmlFor={`wt-text-${t.turn_id}`}>Transcript · as spoken, in {lang}</label>
                {isDemo() && demoNotesFor(t.audio_path) && <button type="button" className="sx-link" onClick={fillFromNotes}>Fill from the founders&rsquo; notes</button>}
              </div>
              {d && d.status !== "done" && (
                <div className={`sx-meta${d.status === "pending" || d.status === "running" ? "" : ""}`}>
                  {d.status === "pending" || d.status === "running"
                    ? <><span className="dots" aria-hidden="true"><i /><i /><i /></span>Drafting{d.engine ? ` with ${d.engine}` : ""}… the draft lands here; you can start listening.</>
                    : <>No machine draft{d.error ? `: ${d.error}` : "."} Write it from the audio.</>}
                </div>
              )}
              <textarea id={`wt-text-${t.turn_id}`} rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write exactly what was said. Pidgin as spoken, never corrected toward English." />
              {draftText && (
                <div className="sx-meta sx-fig-gold">
                  Prefilled by {d?.engine ?? "the machine"}{d?.confidence != null ? ` (${Math.round(Number(d.confidence) * 100)}% sure)` : ""}. {w.stt.note ?? "Correct it word by word."}{" "}
                  {text.trim() !== draftText && <button type="button" className="sx-link sx-link-gold" onClick={() => setText(draftText)}>Reset to the draft</button>}
                </div>
              )}
            </div>
            <div className="sx-pane">
              <div className="sx-pane-h">
                <label htmlFor={`wt-gloss-${t.turn_id}`}>English gloss · what it means</label>
                {w.stt.engine !== "none" && <button type="button" className="sx-link" onClick={() => void doRegloss()} disabled={glossing || !text.trim()}>{glossing ? "Glossing…" : "Re-gloss from my transcript"}</button>}
              </div>
              <textarea id={`wt-gloss-${t.turn_id}`} rows={3} value={gloss} onChange={(e) => setGloss(e.target.value)} placeholder={draftText ? "The gloss draft lands here." : "Plain English meaning"} />
              {(draftGloss || glossEngine) && (
                <div className="sx-meta sx-fig-gold">
                  Prefilled by {glossEngine ?? d?.gloss_engine ?? "the model"} from the {draftText && text.trim() === draftText ? "machine transcript, errors included" : "transcript"}. Check it against what was actually said.{" "}
                  {draftGloss && gloss.trim() !== draftGloss && <button type="button" className="sx-link sx-link-gold" onClick={() => setGloss(draftGloss)}>Reset to the draft gloss</button>}
                </div>
              )}
              {d?.status === "done" && !draftGloss && d.gloss_error && <div className="sx-meta">No gloss draft: {d.gloss_error}</div>}
            </div>
          </div>

          <div className="tlbl" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <span>Align words · {lang} ↔ English{alignments.length ? ` · ${alignments.length} link${alignments.length === 1 ? "" : "s"}` : ""}</span>
            <button type="button" className="sx-link" onClick={() => setAlignOpen((o) => !o)} style={{ textTransform: "none", letterSpacing: 0 }}>{alignOpen ? "Hide" : "Open"}</button>
          </div>
          {alignOpen && <div style={{ marginBottom: 10 }}><WordAligner transcript={text} gloss={gloss} language={lang} value={alignments} onChange={setAlignments} /></div>}

          <div className="row2">
            <div className="field">
              <label htmlFor={`wt-emo-${t.turn_id}`}>Emotion</label>
              <select id={`wt-emo-${t.turn_id}`} value={emotion} onChange={(e) => setEmotion(e.target.value)}>
                <option value="">Pick one</option>
                {EMOTIONS.map((e) => <option key={e} value={e}>{e.replace("_", " ")}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor={`wt-secs-${t.turn_id}`}>Speech seconds (of {Math.round(t.seconds)})</label>
              <input id={`wt-secs-${t.turn_id}`} type="number" min={0} max={Math.ceil(t.seconds) + 1} step={0.5} value={seconds} onChange={(e) => setSeconds(e.target.value)} />
            </div>
          </div>

          <div className="tlbl">Your confidence in this transcript</div>
          <div className="chips" style={{ marginBottom: 10 }}>
            {CONFIDENCE.map(([val, label]) => <button key={val} type="button" className={`chip${confidence === val ? " on" : ""}`} onClick={() => setConfidence(val)}>{label}</button>)}
          </div>
          <div className="tlbl">Issues · tick what you hear</div>
          <div className="chips" style={{ marginBottom: 10 }}>
            {ISSUES.map(([k, label]) => <button key={k} type="button" className={`chip${issues.includes(k) ? " on gold" : ""}`} onClick={() => toggleIssue(k)}>{label}</button>)}
          </div>

          <div className="tlbl">Personal data in this take{pii.length ? ` · ${pii.length} marked` : ""}</div>
          <p className="sx-note" style={{ marginBottom: 8 }}>Phone numbers, account or ID numbers, real names, addresses, emails. A marked span is replaced in the delivered text and listed so the lab cuts it from the audio.</p>
          {suggestions.length > 0 && (
            <div className="chips" style={{ marginBottom: 6 }}>
              {suggestions.map((s) => <button key={s.text} type="button" className="chip gold" onClick={() => addPii(s)}>+ {s.text} · {piiLabel(s.type)}</button>)}
            </div>
          )}
          {pii.length > 0 && (
            <div className="chips" style={{ marginBottom: 6 }}>
              {pii.map((s, i) => <button key={`${s.text}-${i}`} type="button" className="chip on coral" title="remove" onClick={() => setPii((xs) => xs.filter((_, j) => j !== i))}>{s.text} · {piiLabel(s.type)} ×</button>)}
            </div>
          )}
          <div className="row2" style={{ alignItems: "flex-end" }}>
            <div className="field" style={{ marginBottom: 8 }}><label htmlFor={`wt-pii-${t.turn_id}`}>Mark a span</label><input id={`wt-pii-${t.turn_id}`} value={piiText} onChange={(e) => setPiiText(e.target.value)} placeholder="the exact words, as in the transcript" /></div>
            <div className="field" style={{ marginBottom: 8 }}><label htmlFor={`wt-piit-${t.turn_id}`}>What it is</label><select id={`wt-piit-${t.turn_id}`} value={piiType} onChange={(e) => setPiiType(e.target.value as PiiType)}>{PII_TYPES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}</select></div>
          </div>
          <div className="btn-row" style={{ marginBottom: 10 }}>
            <button type="button" className="pill ghost" disabled={!piiText.trim()} onClick={() => { addPii({ text: piiText.trim(), type: piiType }); setPiiText(""); }}>Add the span</button>
          </div>

          <div className="btn-row">
            <button type="button" className="pill mint" disabled={busy || !dirty} onClick={() => void save()}>{busy ? "Saving…" : savedAt && !dirty ? "Saved" : "Save turn"}</button>
            <button type="button" className="pill ghost" disabled={busy} onClick={() => setFlagOpen((o) => !o)}>{flagOpen ? "Close" : "Flag…"}</button>
          </div>

          {flagOpen && (
            <div className="tile dash sx-pop" style={{ marginTop: 10 }}>
              <div className="tlbl">Open an integrity case · clause 15</div>
              <p className="sx-note" style={{ marginBottom: 8 }}>A flag changes nothing on its own. A person reviews it, the contributor is told and has 7 days to respond, and someone other than you decides. Low quality is not a flag: use the issues above and the rating instead.</p>
              <div className="chips" style={{ marginBottom: 8 }}>
                <button type="button" className={`chip${flagWho === "speaker" ? " on" : ""}`} onClick={() => { setFlagWho("speaker"); setFlagReason("not_live"); }}>The speaker · {speakerId}</button>
                {r && <button type="button" className={`chip${flagWho === "rater" ? " on" : ""}`} onClick={() => { setFlagWho("rater"); setFlagReason("rating_mismatch"); }}>The rater · {raterId}</button>}
              </div>
              <div className="field">
                <label htmlFor={`wt-reason-${t.turn_id}`}>Reason</label>
                <select id={`wt-reason-${t.turn_id}`} value={flagReason} onChange={(e) => setFlagReason(e.target.value as CaseReason)}>
                  {(flagWho === "speaker" ? REASONS_FOR_SPEAKER : REASONS_FOR_RATER).map((k) => <option key={k} value={k}>{REASON_LABEL[k]}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor={`wt-detail-${t.turn_id}`}>What you heard, in one or two sentences</label>
                <textarea id={`wt-detail-${t.turn_id}`} rows={2} value={flagDetail} onChange={(e) => setFlagDetail(e.target.value)} placeholder="The contributor will read this." />
              </div>
              <button type="button" className="pill gold" disabled={busy || flagDetail.trim().length < 10} onClick={() => void sendFlag()}>Open the case</button>
            </div>
          )}
        </>
      ) : (
        v && (
          <div style={{ marginTop: 10 }}>
            <div className="sx-read">{v.verified_text ?? <span className="muted">No transcript</span>}</div>
            {v.english_gloss && <div className="sx-read-sub">{v.english_gloss}</div>}
            <div className="sx-meta" style={{ marginTop: 6 }}>
              {v.emotion_label ? `${v.emotion_label.replace("_", " ")} · ` : ""}confidence {v.confidence ?? "?"} · {v.verified_seconds ?? t.seconds} s{v.issues.length ? ` · ${v.issues.join(", ")}` : ""}{v.rating_check ? ` · rating ${v.rating_check.replace("_", " ")}` : ""}{v.draft_wer != null ? ` · draft ${Math.round(Number(v.draft_wer) * 100)}% off (${v.draft_engine ?? "stt"})` : ""}{(v.alignments as Alignment[] | undefined)?.length ? ` · ${(v.alignments as Alignment[]).length} word links by ${v.aligner ?? "editor"}` : ""}
            </div>
            {(v.pii_redactions?.length ?? 0) > 0 && <div className="sx-meta sx-fig-coral" style={{ marginTop: 6 }}>Personal data marked: {v.pii_redactions?.map((p) => `${p.text} (${piiLabel(p.type)})`).join(", ")}</div>}
            {((v.alignments as Alignment[] | undefined)?.length ?? 0) > 0 && (
              <div style={{ marginTop: 8 }}><WordAligner transcript={v.verified_text ?? ""} gloss={v.english_gloss ?? ""} language={lang} value={v.alignments as Alignment[]} onChange={() => undefined} disabled /></div>
            )}
          </div>
        )
      )}
      {err && <div className="sx-meta sx-fig-coral" style={{ marginTop: 8 }}>{err}</div>}
    </div>
  );
}
