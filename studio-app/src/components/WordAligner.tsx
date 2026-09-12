import { useMemo, useState } from "react";

/** One span of words: inclusive word indexes plus the words themselves, so drift is visible if the text changes. */
export interface AlignSpan {
  start: number;
  end: number;
  text: string;
}
/** An alignment per the delivery schema: src is the English gloss, tgt is the verified transcript. One side may be null for null-alignments. */
export interface Alignment {
  src: AlignSpan | null;
  tgt: AlignSpan | null;
  type: AlignType;
  confidence: number;
  note?: string;
}
export const ALIGN_TYPES = ["direct", "lexical", "aspect_shift", "serial_verb", "copula_substitution", "null_particle", "null_source", "numeric_expansion", "emphatic_particle", "honorific_addition", "discourse_marker"] as const;
export type AlignType = (typeof ALIGN_TYPES)[number];
const TYPE_HINT: Record<AlignType, string> = {
  direct: "same meaning, same shape",
  lexical: "a word translated by a different word",
  aspect_shift: "tense or aspect carried differently",
  serial_verb: "two verbs in a row standing for one idea",
  copula_substitution: "'is / are' realised differently",
  null_particle: "a target word with no English source (o, sha, abi)",
  null_source: "an English word with nothing in the target",
  numeric_expansion: "a number said in words or fused with a unit",
  emphatic_particle: "emphasis added",
  honorific_addition: "a respect marker added",
  discourse_marker: "ah, ehn, well, so",
};
const CONF: [number, string][] = [[1, "Sure"], [0.9, "Mostly sure"], [0.7, "Unsure"]];
const HUES = [150, 40, 205, 320, 95, 15, 260, 180];

export const tokenize = (s: string): string[] => s.split(/\s+/).filter(Boolean);
const spanOf = (words: string[], r: [number, number]): AlignSpan => ({ start: r[0], end: r[1], text: words.slice(r[0], r[1] + 1).join(" ") });
const isStale = (a: Alignment, tgt: string[], src: string[]): boolean =>
  Boolean((a.tgt && tgt.slice(a.tgt.start, a.tgt.end + 1).join(" ") !== a.tgt.text) || (a.src && src.slice(a.src.start, a.src.end + 1).join(" ") !== a.src.text));

interface Props {
  transcript: string;
  gloss: string;
  language: string;
  value: Alignment[];
  onChange: (next: Alignment[]) => void;
  disabled?: boolean;
}

/** Tap words in the transcript, tap words in the gloss, pick the kind, link. Tap a linked word to select its link and unlink it. */
export function WordAligner({ transcript, gloss, language, value, onChange, disabled }: Props) {
  const tgtWords = useMemo(() => tokenize(transcript), [transcript]);
  const srcWords = useMemo(() => tokenize(gloss), [gloss]);
  const [selTgt, setSelTgt] = useState<[number, number] | null>(null);
  const [selSrc, setSelSrc] = useState<[number, number] | null>(null);
  const [type, setType] = useState<AlignType>("direct");
  const [conf, setConf] = useState(1);
  const [active, setActive] = useState<number | null>(null);

  const tgtLink = new Map<number, number>();
  const srcLink = new Map<number, number>();
  value.forEach((a, k) => {
    if (a.tgt) for (let i = a.tgt.start; i <= a.tgt.end; i++) tgtLink.set(i, k);
    if (a.src) for (let i = a.src.start; i <= a.src.end; i++) srcLink.set(i, k);
  });
  const stale = value.map((a) => isStale(a, tgtWords, srcWords));

  const pick = (side: "tgt" | "src", i: number) => {
    if (disabled) return;
    const linked = (side === "tgt" ? tgtLink : srcLink).get(i);
    if (linked != null) {
      setActive(active === linked ? null : linked);
      setSelTgt(null);
      setSelSrc(null);
      return;
    }
    setActive(null);
    const sel = side === "tgt" ? selTgt : selSrc;
    const set = side === "tgt" ? setSelTgt : setSelSrc;
    if (!sel) set([i, i]);
    else if (i >= sel[0] && i <= sel[1]) set(null);
    else set([Math.min(sel[0], i), Math.max(sel[1], i)]);
  };

  const nullKind = type === "null_particle" ? "tgt" : type === "null_source" ? "src" : null;
  const canLink = nullKind === "tgt" ? Boolean(selTgt) && !selSrc : nullKind === "src" ? Boolean(selSrc) && !selTgt : Boolean(selTgt && selSrc);
  const link = () => {
    if (!canLink) return;
    onChange([...value, { tgt: selTgt ? spanOf(tgtWords, selTgt) : null, src: selSrc ? spanOf(srcWords, selSrc) : null, type, confidence: conf }]);
    setSelTgt(null);
    setSelSrc(null);
  };
  const unlink = () => {
    if (active == null) return;
    onChange(value.filter((_, k) => k !== active));
    setActive(null);
  };
  const inSel = (sel: [number, number] | null, i: number) => Boolean(sel && i >= sel[0] && i <= sel[1]);
  const chip = (side: "tgt" | "src", words: string[], links: Map<number, number>, sel: [number, number] | null) =>
    words.map((wd, i) => {
      const k = links.get(i);
      const cls = ["aw", k != null ? "linked" : "", inSel(sel, i) ? "sel" : "", k != null && k === active ? "act" : "", k != null && stale[k] ? "stale" : ""].filter(Boolean).join(" ");
      return (
        <button key={`${side}-${i}`} type="button" className={cls} style={k != null ? ({ "--hue": HUES[k % HUES.length] } as React.CSSProperties) : undefined} onClick={() => pick(side, i)} disabled={disabled} aria-pressed={inSel(sel, i)}>
          {wd}
        </button>
      );
    });

  const linkLabel = nullKind === "tgt" ? "Mark as particle with no source" : nullKind === "src" ? "Mark as source with no target" : selTgt && selSrc ? `Link ${selTgt[1] - selTgt[0] + 1} ↔ ${selSrc[1] - selSrc[0] + 1}` : "Link";

  return (
    <div className="align">
      <div className="rl">{language} · transcript</div>
      <div className="row">{tgtWords.length ? chip("tgt", tgtWords, tgtLink, selTgt) : <span className="muted small">Write the transcript first.</span>}</div>
      <div className="rl">English · gloss</div>
      <div className="row">{srcWords.length ? chip("src", srcWords, srcLink, selSrc) : <span className="muted small">Write the gloss first.</span>}</div>
      {!disabled && (
        <div className="row" style={{ alignItems: "center", gap: 8, marginTop: 8 }}>
          <select value={type} onChange={(e) => setType(e.target.value as AlignType)} title={TYPE_HINT[type]} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, padding: "7px 10px", color: "var(--ink)", fontSize: "0.8rem" }}>
            {ALIGN_TYPES.map((k) => <option key={k} value={k}>{k.replace(/_/g, " ")}</option>)}
          </select>
          <select value={conf} onChange={(e) => setConf(Number(e.target.value))} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, padding: "7px 10px", color: "var(--ink)", fontSize: "0.8rem" }}>
            {CONF.map(([c, label]) => <option key={c} value={c}>{label}</option>)}
          </select>
          {active == null ? (
            <button type="button" className="pill mint" style={{ width: "auto", padding: "9px 14px", minHeight: 0 }} disabled={!canLink} onClick={link}>{linkLabel}</button>
          ) : (
            <button type="button" className="pill ghost" style={{ width: "auto", padding: "9px 14px", minHeight: 0, borderColor: "var(--coral)", color: "var(--coral)" }} onClick={unlink}>Unlink</button>
          )}
          <span className="muted small" style={{ flexBasis: "100%" }}>{TYPE_HINT[type]}. Tap a first and a last word to pick a run of words.</span>
        </div>
      )}
      {value.length > 0 && (
        <div className="links">
          {value.map((a, k) => (
            <div key={k} style={{ color: stale[k] ? "var(--coral)" : undefined }}>
              <b style={{ color: `hsl(${HUES[k % HUES.length]} 70% 65%)` }}>[{k + 1}]</b> {a.type.replace(/_/g, " ")} · "{a.tgt?.text ?? ""}" ↔ "{a.src?.text ?? ""}" · {a.confidence}{stale[k] ? " · the text changed under this link, unlink and redo it" : ""}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
