import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/auth/AuthProvider";
import { Logo } from "@/components/Logo";
import { Num, useRowMotion } from "@/components/sx-motion";
import { formatClock, useRecorder } from "@/lib/recorder";
import { uploadRecording } from "@/lib/upload";
import { LANG_NAME, cardAudioUrl } from "@/lib/game";

interface Card {
  id: string;
  language: string;
  title: string;
  situation: string;
  persona_a: string;
  persona_b: string;
  domain: string;
  english_note: string | null;
  audio_path: string | null;
  version: number;
  prompt_hash: string | null;
  status: "draft" | "active" | "retired";
  author: string;
}

const EMPTY: Omit<Card, "id" | "version" | "prompt_hash"> = { language: "pcm", title: "", situation: "", persona_a: "", persona_b: "", domain: "", english_note: "", audio_path: null, status: "draft", author: "founders draft" };
const FIELDS: (keyof Card)[] = ["title", "situation", "persona_a", "persona_b", "domain", "english_note"];

/** Founder and linguist tool: the scenario card library, text and audio, per language. */
export function Cards({ onBack }: { onBack: () => void }) {
  const { session } = useAuth();
  const [cards, setCards] = useState<Card[]>([]);
  const [lang, setLang] = useState("pcm");
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Card>>({});
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const rec = useRecorder(90);

  const load = async () => {
    const { data, error } = await supabase.from("scenario_cards").select("*").order("language").order("title");
    if (error) setMsg(error.message);
    else setCards((data ?? []) as Card[]);
  };
  useEffect(() => {
    void load();
  }, []);

  const save = async (id: string) => {
    const patch = { ...draft };
    delete patch.id;
    const { error } = await supabase.from("scenario_cards").update(patch).eq("id", id);
    setMsg(error ? error.message : "Saved.");
    if (!error) {
      setDraft({});
      await load();
    }
  };

  const create = async () => {
    const { error } = await supabase.from("scenario_cards").insert({ ...EMPTY, ...draft, language: draft.language ?? lang, created_by: session?.user.id });
    setMsg(error ? error.message : "Card created as a draft.");
    if (!error) {
      setCreating(false);
      setDraft({});
      await load();
    }
  };

  const setStatus = async (id: string, status: Card["status"]) => {
    const { error } = await supabase.from("scenario_cards").update({ status }).eq("id", id);
    setMsg(error ? error.message : `Card ${status}.`);
    if (!error) await load();
  };

  const attachAudio = async (card: Card) => {
    if (!rec.blob) return;
    const ext = rec.mime.includes("mp4") ? "mp4" : rec.mime.includes("ogg") ? "ogg" : "webm";
    const path = `${card.language}/${card.id}-v${card.version}-${Date.now()}.${ext}`;
    try {
      await uploadRecording(path, rec.blob, rec.mime.split(";")[0] || "audio/webm", (p) => setProgress(p), "cards");
      const { error } = await supabase.from("scenario_cards").update({ audio_path: path }).eq("id", card.id);
      setMsg(error ? error.message : "Card audio saved.");
      rec.reset();
      setProgress(null);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Upload failed.");
      setProgress(null);
    }
  };

  const langs = Array.from(new Set(["pcm", "yo", "ha", "ig", "sw", "zu", ...cards.map((c) => c.language)]));
  // memoised so the row-motion hook sees the same list between renders and a flash runs its course
  const visible = useMemo(() => cards.filter((c) => c.language === lang), [cards, lang]);
  const field = (c: Partial<Card>, key: keyof Card) => (draft.id === c.id && key in draft ? String(draft[key] ?? "") : String(c[key] ?? ""));
  const edit = (c: Card, key: keyof Card, value: string) => setDraft((d) => ({ ...(d.id === c.id ? d : { id: c.id }), [key]: value }));
  const ok = msg !== null && (msg.startsWith("Saved") || msg.startsWith("Card"));

  // a card activated, retired, re-versioned or given audio washes once
  const rowCls = useRowMotion(visible, (c) => c.id, (c) => `${c.status}|${c.version}|${c.audio_path ?? ""}`);

  return (
    <div className="app ankara studio-ank">
      <div className="topbar">
        <button type="button" className="sx-link" onClick={onBack}>‹ back</button>
        <Logo height={22} tone="mono" />
      </div>
      <div className="shell wide">
        <div className="sx-head">
          <div>
            <div className="eyebrow">Scenario cards</div>
            <h1 className="h1">Card library · <Num value={cards.length} /></h1>
          </div>
          <div className="btn-row">
            <button type="button" className="pill mint" disabled={creating} onClick={() => { setCreating(true); setDraft({ language: lang }); }}>New card</button>
          </div>
        </div>

        <div className={`sx-bar${progress !== null ? " sx-working" : ""}`} role="group" aria-label="Language">
          {langs.map((l) => (
            <button key={l} type="button" aria-pressed={lang === l} className={`chip${lang === l ? " on" : ""}`} onClick={() => setLang(l)}>
              {LANG_NAME[l] ?? l} · {cards.filter((c) => c.language === l).length}
            </button>
          ))}
          <div className="sx-bar-end">
            <span className="sx-meta">{visible.filter((c) => c.status === "active").length} active · {visible.filter((c) => !c.audio_path).length} without audio</span>
          </div>
        </div>

        <p className="sx-note">
          Cards are written in the target language and describe a situation and two personas, never lines. Record the card&rsquo;s audio in that
          language; players hear it first and read it second. Only active cards are dealt. Changing the text bumps the version and the prompt hash.
        </p>

        {msg && (
          <div key={msg} className={`sx-block ${ok ? "sx-block-mint" : "sx-block-coral"} sx-pop`} style={{ marginBottom: 12 }}>
            <div className="tbody">{msg}</div>
          </div>
        )}

        {creating && (
          <div className="sheet sx-in-card" style={{ marginBottom: 14 }}>
            <div className="shead"><i className="g" />New card · {LANG_NAME[draft.language ?? lang] ?? lang}</div>
            {FIELDS.map((key) => (
              <div className="field" key={key}>
                <label htmlFor={`new-${key}`}>{key.replace("_", " ")}</label>
                {key === "situation"
                  ? <textarea id={`new-${key}`} rows={3} value={String(draft[key] ?? "")} onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))} />
                  : <input id={`new-${key}`} value={String(draft[key] ?? "")} onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))} />}
              </div>
            ))}
            <div className="btn-row">
              <button type="button" className="pill mint" onClick={() => void create()}>Create draft</button>
              <button type="button" className="pill ghost" onClick={() => { setCreating(false); setDraft({}); }}>Cancel</button>
            </div>
          </div>
        )}

        {visible.length === 0 ? (
          <div className="empty sx-pop">
            <b>No cards in {LANG_NAME[lang] ?? lang} yet.</b>
            <span>Write the first one above. A card goes live only once it is activated.</span>
          </div>
        ) : (
          // keyed on the language so switching the filter is a fresh list arriving, not a swap
          <div className="sx-list sx-enter" key={lang}>
            {visible.map((c) => {
              const isOpen = open === c.id;
              const audio = cardAudioUrl(c.audio_path);
              const spine = c.status === "active" ? " sx-spine-mint" : c.status === "draft" ? " sx-spine-gold" : "";
              return (
                <div key={c.id} className={`sx-row${spine}${rowCls(c)}`} style={c.status === "retired" ? { opacity: 0.62 } : undefined}>
                  <div className="sx-row-top">
                    <button type="button" className="sx-row-main" aria-expanded={isOpen} style={{ textAlign: "left", minHeight: 44 }} onClick={() => { setOpen(isOpen ? null : c.id); rec.reset(); }}>
                      <div className="sx-row-t">{c.title}</div>
                      <div className="sx-row-s">{c.domain || "no domain"} · v{c.version} · {c.audio_path ? "audio ✓" : "no audio yet"} · {c.author}</div>
                    </button>
                    <div className="sx-row-end">
                      <span className={`chip${c.status === "active" ? " on" : ""}`}>{c.status}</span>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="sx-view" style={{ marginTop: 10 }}>
                      {FIELDS.map((key) => (
                        <div className="field" key={key}>
                          <label htmlFor={`${c.id}-${key}`}>{key.replace("_", " ")}</label>
                          {key === "situation"
                            ? <textarea id={`${c.id}-${key}`} rows={3} value={field(c, key)} onChange={(e) => edit(c, key, e.target.value)} />
                            : <input id={`${c.id}-${key}`} value={field(c, key)} onChange={(e) => edit(c, key, e.target.value)} />}
                        </div>
                      ))}
                      <div className="btn-row" style={{ marginBottom: 10 }}>
                        <button type="button" className="pill ghost" disabled={draft.id !== c.id} onClick={() => void save(c.id)}>Save text</button>
                        {c.status !== "active"
                          ? <button type="button" className="pill mint" onClick={() => void setStatus(c.id, "active")}>Activate</button>
                          : <button type="button" className="pill ghost" onClick={() => void setStatus(c.id, "retired")}>Retire</button>}
                      </div>

                      <div className={`tile${progress !== null ? " sx-working" : ""}${rec.status === "recording" ? " sx-spine-coral" : ""}`}>
                        <div className="tlbl">Card audio · read the situation and both personas in {LANG_NAME[c.language] ?? c.language}</div>
                        {audio && <audio controls preload="none" src={audio} style={{ width: "100%", marginBottom: 10 }} />}
                        {rec.blob ? (
                          <div className="sx-pop">
                            <audio controls src={rec.url ?? undefined} style={{ width: "100%" }} />
                            {progress !== null ? (
                              <>
                                <div className="progress" style={{ marginTop: 10 }}><div className="fill" style={{ width: `${Math.max(3, progress)}%` }} /></div>
                                <div className="sx-meta" style={{ marginTop: 6 }}>Uploading · <b key={Math.round(progress)} className="sx-bump" style={{ display: "inline-block" }}>{Math.round(progress)}</b>%</div>
                              </>
                            ) : (
                              <div className="btn-row" style={{ marginTop: 10 }}>
                                <button type="button" className="pill mint" onClick={() => void attachAudio(c)}>Use this recording</button>
                                <button type="button" className="pill ghost" onClick={() => rec.reset()}>Re-record</button>
                              </div>
                            )}
                          </div>
                        ) : rec.status === "recording" ? (
                          <div className="recwrap">
                            <div className="reclive"><span className="sx-live" aria-hidden="true" />REC {formatClock(rec.seconds)}</div>
                            <button type="button" className="recbtn rec" onClick={() => rec.stop()} aria-label="Stop recording"><span className="core" /></button>
                          </div>
                        ) : (
                          <button type="button" className="pill ghost" onClick={() => void rec.start()}>{c.audio_path ? "Record a new version" : "Record the card audio"}</button>
                        )}
                      </div>
                      <div className="sx-meta sx-clip" style={{ marginTop: 8 }}>prompt hash {c.prompt_hash?.slice(0, 16)}…</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
