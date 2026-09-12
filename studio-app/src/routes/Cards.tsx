import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/auth/AuthProvider";
import { Logo } from "@/components/Logo";
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
  const visible = cards.filter((c) => c.language === lang);
  const field = (c: Partial<Card>, key: keyof Card) => (draft.id === c.id && key in draft ? String(draft[key] ?? "") : String(c[key] ?? ""));
  const edit = (c: Card, key: keyof Card, value: string) => setDraft((d) => ({ ...(d.id === c.id ? d : { id: c.id }), [key]: value }));

  return (
    <div className="app">
      <div className="topbar">
        <button className="brand" onClick={onBack} style={{ background: "none", border: "none" }}><span style={{ color: "var(--mut)", fontFamily: "var(--mono)", fontSize: "0.9rem" }}>‹ back</span></button>
        <Logo height={22} />
      </div>
      <div className="shell" style={{ maxWidth: 720 }}>
        <div className="spread" style={{ marginBottom: 16, alignItems: "flex-start" }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Scenario cards</div>
            <h1 className="h1">Card library · {cards.length}</h1>
          </div>
          <button className="pill ghost" style={{ flex: "none" }} onClick={() => { setCreating(true); setDraft({ language: lang }); }}>New card</button>
        </div>
        <div className="tile" style={{ marginBottom: 14 }}>
          <div className="tbody muted" style={{ fontSize: "0.85rem" }}>Cards are written in the target language and describe a situation and two personas, never lines. Record the card's audio in that language; players hear it first and read it second. Only active cards are dealt. Changing the text bumps the version and the prompt hash.</div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
          {langs.map((l) => (
            <button key={l} type="button" className="chip" onClick={() => setLang(l)} style={{ cursor: "pointer", background: lang === l ? "var(--acc)" : undefined, color: lang === l ? "#0d0b08" : undefined, borderColor: lang === l ? "var(--acc)" : undefined }}>
              {LANG_NAME[l] ?? l} · {cards.filter((c) => c.language === l).length}
            </button>
          ))}
        </div>
        {msg && <div className="tile" style={{ marginBottom: 14, borderColor: msg.startsWith("Saved") || msg.startsWith("Card") ? "var(--acc)" : "var(--coral)" }}><div className="tbody">{msg}</div></div>}

        {creating && (
          <div className="sheet" style={{ marginBottom: 18 }}>
            <div className="handle" />
            <div className="shead"><i className="g" />New card · {LANG_NAME[draft.language ?? lang] ?? lang}</div>
            {(["title", "situation", "persona_a", "persona_b", "domain", "english_note"] as (keyof Card)[]).map((key) => (
              <div className="field" key={key}>
                <label>{key.replace("_", " ")}</label>
                {key === "situation" ? <textarea rows={3} value={String(draft[key] ?? "")} onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))} /> : <input value={String(draft[key] ?? "")} onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))} />}
              </div>
            ))}
            <div className="btn-row">
              <button className="pill ghost" onClick={() => { setCreating(false); setDraft({}); }}>Cancel</button>
              <button className="pill mint" onClick={() => void create()}>Create draft</button>
            </div>
          </div>
        )}

        <div className="stack">
          {visible.map((c) => {
            const isOpen = open === c.id;
            const audio = cardAudioUrl(c.audio_path);
            return (
              <div key={c.id} className="sheet">
                <div className="handle" />
                <button type="button" onClick={() => { setOpen(isOpen ? null : c.id); rec.reset(); }} style={{ width: "100%", textAlign: "left", cursor: "pointer" }}>
                  <div className="spread" style={{ alignItems: "flex-start", gap: 12 }}>
                    <div>
                      <div className="ttitle">{c.title}</div>
                      <div className="tbody muted" style={{ marginTop: 4, fontSize: "0.85rem" }}>{c.domain} · v{c.version} · {c.audio_path ? "audio ✓" : "no audio yet"} · {c.author}</div>
                    </div>
                    <span className="chip" style={{ flex: "none", color: c.status === "active" ? "var(--acc)" : undefined }}>{c.status}</span>
                  </div>
                </button>
                {isOpen && (
                  <>
                    {(["title", "situation", "persona_a", "persona_b", "domain", "english_note"] as (keyof Card)[]).map((key) => (
                      <div className="field" key={key}>
                        <label>{key.replace("_", " ")}</label>
                        {key === "situation" ? <textarea rows={3} value={field(c, key)} onChange={(e) => edit(c, key, e.target.value)} /> : <input value={field(c, key)} onChange={(e) => edit(c, key, e.target.value)} />}
                      </div>
                    ))}
                    <div className="btn-row" style={{ marginBottom: 12 }}>
                      <button className="pill ghost" disabled={draft.id !== c.id} onClick={() => void save(c.id)}>Save text</button>
                      {c.status !== "active" ? <button className="pill mint" onClick={() => void setStatus(c.id, "active")}>Activate</button> : <button className="pill ghost" onClick={() => void setStatus(c.id, "retired")}>Retire</button>}
                    </div>
                    <div className="tile">
                      <div className="tlbl">Card audio · read the situation and both personas in {LANG_NAME[c.language] ?? c.language}</div>
                      {audio && <audio controls preload="none" src={audio} style={{ width: "100%", marginBottom: 10 }} />}
                      {rec.blob ? (
                        <>
                          <audio controls src={rec.url ?? undefined} style={{ width: "100%" }} />
                          {progress !== null ? (
                            <div className="progress" style={{ width: "100%", marginTop: 10 }}><div className="fill" style={{ width: `${Math.max(3, progress)}%` }} /></div>
                          ) : (
                            <div className="btn-row" style={{ marginTop: 10 }}>
                              <button className="pill ghost" onClick={() => rec.reset()}>Re-record</button>
                              <button className="pill mint" onClick={() => void attachAudio(c)}>Use this recording</button>
                            </div>
                          )}
                        </>
                      ) : rec.status === "recording" ? (
                        <div className="recwrap">
                          <div className="reclive"><span className="recdot" />REC {formatClock(rec.seconds)}</div>
                          <button type="button" className="recbtn rec" onClick={() => rec.stop()} aria-label="Stop recording"><span className="core" /></button>
                        </div>
                      ) : (
                        <button className="pill ghost" onClick={() => void rec.start()}>{c.audio_path ? "Record a new version" : "Record the card audio"}</button>
                      )}
                    </div>
                    <div className="tbody muted" style={{ fontSize: "0.72rem", fontFamily: "var(--mono)" }}>prompt hash {c.prompt_hash?.slice(0, 16)}…</div>
                  </>
                )}
              </div>
            );
          })}
          {visible.length === 0 && <div className="muted">No cards in {LANG_NAME[lang] ?? lang} yet.</div>}
        </div>
      </div>
    </div>
  );
}
