import { useState } from "react";
import { VoiceNote } from "@/components/VoiceNote";
import { CONFIDENCE, EMOTIONS, ISSUES, REASON_LABEL, saveTurn, type CaseReason, type RatingCheck, type Speaker, type WorkTurn, type Workbench } from "@/lib/verify";
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

/** One take on the workbench: listen, transcribe, gloss, mark confidence and issues, check the peer rating, flag if needed. */
export function WorkTurnCard({ t, w, src, canEdit, onSaved, onFlag }: Props) {
  const v = t.verification;
  const [text, setText] = useState(v?.verified_text ?? "");
  const [gloss, setGloss] = useState(v?.english_gloss ?? "");
  const [emotion, setEmotion] = useState(v?.emotion_label ?? "");
  const [confidence, setConfidence] = useState<number | null>(v?.confidence ?? null);
  const [issues, setIssues] = useState<string[]>(v?.issues ?? []);
  const [seconds, setSeconds] = useState<string>(String(v?.verified_seconds ?? t.seconds));
  const [check, setCheck] = useState<RatingCheck | null>(v?.rating_check ?? null);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(v?.updated_at ?? null);
  const [err, setErr] = useState<string | null>(null);
  const [flagOpen, setFlagOpen] = useState(false);
  const [flagWho, setFlagWho] = useState<"speaker" | "rater">("speaker");
  const [flagReason, setFlagReason] = useState<CaseReason>("not_live");
  const [flagDetail, setFlagDetail] = useState("");

  const other: Speaker = t.speaker === "a" ? "b" : "a";
  const speakerId = t.speaker_id ?? w.speakers[t.speaker] ?? "";
  const raterId = w.speakers[other] ?? "";
  const dirty = text !== (v?.verified_text ?? "") || gloss !== (v?.english_gloss ?? "") || emotion !== (v?.emotion_label ?? "") || confidence !== (v?.confidence ?? null) || check !== (v?.rating_check ?? null) || issues.join() !== (v?.issues ?? []).join() || Number(seconds) !== (v?.verified_seconds ?? t.seconds);

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const secs = Number(seconds);
      await saveTurn({ turn_id: t.turn_id, verified_text: text, english_gloss: gloss, emotion: emotion || null, confidence, issues, verified_seconds: Number.isFinite(secs) ? secs : null, rating_check: check });
      setSavedAt(new Date().toISOString());
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
  const d = w.stt.show ? t.draft : null;
  const draftInUse = Boolean(d?.text) && text.trim() === (d?.text ?? "").trim();

  return (
    <div className={`wt ${t.speaker}${t.latest ? "" : " old"}`}>
      <div className="spread" style={{ alignItems: "flex-start" }}>
        <div className="tlbl" style={{ marginBottom: 0 }}>
          Turn {t.turn_no}{t.attempt > 1 ? ` · take ${t.attempt}` : ""} · Speaker {t.speaker.toUpperCase()} · {speakerId} · {Math.round(t.seconds)} s{t.latest ? "" : " · replaced by a later take"}
        </div>
        {savedAt && <span className="chip" style={{ flex: "none", fontSize: "0.6rem" }}>{dirty ? "edited" : "saved"}</span>}
      </div>
      <div style={{ margin: "10px 0" }}><VoiceNote src={src} seconds={t.seconds} tone={t.speaker === "a" ? "them" : "me"} /></div>

      {r ? (
        <div className="tbody muted small">Rated by {raterId || `speaker ${other.toUpperCase()}`}: <b style={{ color: Number(r.aggregate) < 4 ? "var(--gold)" : "var(--ink)" }}>{Number(r.aggregate).toFixed(2)}</b> · tone {r.tone} · situation {r.prompt_adherence} · mood {r.mood} · clarity {r.clarity}</div>
      ) : (
        <div className="tbody muted small">Not rated. The partner went quiet before rating it.</div>
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
          {d && (
            <div className="draft" style={{ marginTop: 12 }}>
              {d.status === "done" && d.text ? (
                <>
                  <div className="tlbl">Machine draft · {d.engine ?? "stt"}{d.confidence != null ? ` · ${Math.round(Number(d.confidence) * 100)}%` : ""}{d.detected_language ? ` · heard as ${d.detected_language}` : ""}</div>
                  <div className="tbody" style={{ fontStyle: "italic", color: "var(--ink2)" }}>{d.text}</div>
                  {w.stt.note && <div className="tbody small" style={{ color: "var(--gold)", marginTop: 6 }}>{w.stt.note}</div>}
                  <button type="button" className="pill ghost" style={{ width: "auto", marginTop: 8, padding: "9px 14px", minHeight: 0 }} disabled={draftInUse} onClick={() => { setText(d.text ?? ""); if (confidence == null) setConfidence(0.85); }}>{draftInUse ? "Draft in use, now correct it" : "Use the draft"}</button>
                </>
              ) : d.status === "pending" || d.status === "running" ? (
                <div className="tbody muted small"><span className="dots" aria-hidden="true"><i /><i /><i /></span>Drafting{d.engine ? ` with ${d.engine}` : ""}… you can start listening.</div>
              ) : (
                <div className="tbody muted small">No machine draft{d.error ? `: ${d.error}` : "."} Write the transcript from the audio.</div>
              )}
            </div>
          )}
          <div className="field" style={{ marginTop: 12 }}>
            <label>
              Transcript · as spoken, in {w.language === "pcm" ? "Pidgin" : w.language}
              {isDemo() && demoNotesFor(t.audio_path) && <button type="button" onClick={fillFromNotes} style={{ background: "none", border: "none", color: "var(--acc)", padding: 0, marginLeft: 10, font: "inherit", cursor: "pointer" }}>Fill from the founders' notes (demo)</button>}
            </label>
            <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write exactly what was said. Pidgin as spoken, never corrected toward English." />
          </div>
          <div className="field">
            <label>English gloss · what it means, from what was said</label>
            <textarea rows={2} value={gloss} onChange={(e) => setGloss(e.target.value)} placeholder="Plain English meaning" />
          </div>
          <div className="row2">
            <div className="field">
              <label>Emotion</label>
              <select value={emotion} onChange={(e) => setEmotion(e.target.value)}>
                <option value="">Pick one</option>
                {EMOTIONS.map((e) => <option key={e} value={e}>{e.replace("_", " ")}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Speech seconds (of {Math.round(t.seconds)})</label>
              <input type="number" min={0} max={Math.ceil(t.seconds) + 1} step={0.5} value={seconds} onChange={(e) => setSeconds(e.target.value)} />
            </div>
          </div>
          <div className="tlbl">Your confidence in this transcript</div>
          <div className="chips" style={{ marginBottom: 10 }}>
            {CONFIDENCE.map(([val, label]) => <button key={val} type="button" className={`chip${confidence === val ? " on" : ""}`} onClick={() => setConfidence(val)}>{label}</button>)}
          </div>
          <div className="tlbl">Issues · tick what you hear</div>
          <div className="chips" style={{ marginBottom: 12 }}>
            {ISSUES.map(([k, label]) => <button key={k} type="button" className={`chip${issues.includes(k) ? " on gold" : ""}`} onClick={() => toggleIssue(k)}>{label}</button>)}
          </div>
          <div className="btn-row">
            <button className="pill mint" disabled={busy || !dirty} onClick={() => void save()}>{busy ? "Saving…" : savedAt && !dirty ? "Saved" : "Save turn"}</button>
            <button className="pill ghost" disabled={busy} onClick={() => setFlagOpen((o) => !o)}>{flagOpen ? "Close" : "Flag…"}</button>
          </div>
          {flagOpen && (
            <div className="tile dash" style={{ marginTop: 10 }}>
              <div className="tlbl">Open an integrity case · clause 15</div>
              <div className="tbody muted small" style={{ marginBottom: 8 }}>A flag changes nothing on its own. A person reviews it, the contributor is told and has 7 days to respond, and someone other than you decides. Low quality is not a flag: use the issues above and the rating instead.</div>
              <div className="chips" style={{ marginBottom: 8 }}>
                <button type="button" className={`chip${flagWho === "speaker" ? " on" : ""}`} onClick={() => { setFlagWho("speaker"); setFlagReason("not_live"); }}>The speaker · {speakerId}</button>
                {r && <button type="button" className={`chip${flagWho === "rater" ? " on" : ""}`} onClick={() => { setFlagWho("rater"); setFlagReason("rating_mismatch"); }}>The rater · {raterId}</button>}
              </div>
              <div className="field">
                <label>Reason</label>
                <select value={flagReason} onChange={(e) => setFlagReason(e.target.value as CaseReason)}>
                  {(flagWho === "speaker" ? REASONS_FOR_SPEAKER : REASONS_FOR_RATER).map((k) => <option key={k} value={k}>{REASON_LABEL[k]}</option>)}
                </select>
              </div>
              <div className="field">
                <label>What you heard, in one or two sentences</label>
                <textarea rows={2} value={flagDetail} onChange={(e) => setFlagDetail(e.target.value)} placeholder="The contributor will read this." />
              </div>
              <button className="pill" disabled={busy || flagDetail.trim().length < 10} onClick={() => void sendFlag()} style={{ background: "var(--gold)", color: "#0d0b08" }}>Open the case</button>
            </div>
          )}
        </>
      ) : (
        v && (
          <div style={{ marginTop: 10 }}>
            <div className="tbody">{v.verified_text ?? <span className="muted">No transcript</span>}</div>
            {v.english_gloss && <div className="tbody muted small" style={{ marginTop: 4 }}>{v.english_gloss}</div>}
            <div className="tbody muted small" style={{ marginTop: 6, fontFamily: "var(--mono)", fontSize: "0.7rem" }}>
              {v.emotion_label ? `${v.emotion_label.replace("_", " ")} · ` : ""}confidence {v.confidence ?? "?"} · {v.verified_seconds ?? t.seconds} s{v.issues.length ? ` · ${v.issues.join(", ")}` : ""}{v.rating_check ? ` · rating ${v.rating_check.replace("_", " ")}` : ""}{v.draft_wer != null ? ` · draft ${Math.round(Number(v.draft_wer) * 100)}% off (${v.draft_engine ?? "stt"})` : ""}
            </div>
          </div>
        )
      )}
      {err && <div className="tbody" style={{ color: "var(--coral)", marginTop: 8 }}>{err}</div>}
    </div>
  );
}
