// Static mock data for the click-through prototype. No backend.

export const MOCK_USER = {
  handle: "lagos_lynx",
  email: "you@example.com",
  locale: "pcm-NG",
  localeName: "Nigerian Pidgin",
  region: "Lagos",
  tier: "Gold",
  multiplier: "1.0×",
  apBalance: 4820,
  verifiedMinutes: 137,
  trustScore: 0.94,
  streak: 6,
  rank: "Supporting",
};

export const MOCK_PROMPT = {
  scenario: "Unauthorized POS Dispute",
  english: "Good morning. I woke up this morning and saw that ₦50,000 left my account through a POS I never used.",
  role: "Frustrated customer",
  emotion: "frustrated",
};

export const MOCK_PARTNER_TAKE = {
  handle: "kano_kite",
  duration: "00:06",
  transcript: "Oga, my money just disappear from account. I no do any POS o!",
};

export const AGREEMENTS = [
  {
    id: "ip-assignment",
    name: "IP Assignment Agreement",
    version: "v1.2",
    summary: "Assigns ownership of your recordings and roleplay to Accent Studio.",
  },
  {
    id: "voice-release",
    name: "Voice Likeness & Audio Release",
    version: "v1.1",
    summary: "Grants the right to process and train models on your voice.",
  },
  {
    id: "contractor",
    name: "Independent Contractor Agreement",
    version: "v1.0",
    summary: "You play as an independent contractor, not an employee.",
  },
] as const;

export const IP_CLAUSES: { h: string; body: string }[] = [
  {
    h: "1 · Grant of Ownership & Assignment",
    body: "You irrevocably assign to Accent Studio, Inc. all worldwide right, title, and interest in the audio and roleplay content you produce (\"User Content\"), including copyright, database rights, trade secrets, and derivative synthetic AI models trained on it.",
  },
  {
    h: "2 · Voice Likeness & Audio Release",
    body: "You grant a perpetual, worldwide, royalty-free right to process, normalize, and extract acoustic features from your voice recordings for machine learning, model training, and voice synthesis.",
  },
  {
    h: "3 · Commercialization & Sub-Licensing",
    body: "Accent Studio may sell, license, lease, or sub-license datasets and derived models to third parties without additional compensation to you beyond the published payout schedule.",
  },
  {
    h: "4 · Anonymization & Privacy",
    body: "Your personal information is redacted before enterprise packaging, per GDPR and NDPR. Audio is indexed only by a cryptographic ID; your identity is stored in an isolated, decoupled vault buyers never access.",
  },
  {
    h: "5 · Waiver of Moral Rights",
    body: "To the extent permitted by law, you waive attribution and integrity claims over the processed User Content.",
  },
  {
    h: "6 · Compensation & Independent Contractor Status",
    body: "You are compensated per Verified Hour at the published rate and QA multiplier. You are an independent contractor responsible for your own tax obligations.",
  },
];

export const MOCK_LEDGER = [
  { icon: "🎙", t: "Volley · verified", s: "Banking Wahala · Platinum", end: "+180 AP", d: "2h ago" },
  { icon: "✎", t: "Cutting Room · fix", s: "Pidgin correction", end: "+35 AP", d: "5h ago" },
  { icon: "🎭", t: "Arena · standing ovation", s: "Chemistry 8.7", end: "+150 AP", d: "Yesterday" },
  { icon: "💸", t: "Cashout · M-Pesa", s: "KES 1,240", end: "−2,400 AP", d: "3d ago" },
  { icon: "🎙", t: "Volley · verified", s: "Market Day · Gold", end: "+120 AP", d: "4d ago" },
];

export const MOCK_QUEUE = [
  { icon: "🎙", t: "Banking Wahala · T4", s: "pcm-NG · 6.2s · agent turn", end: "+35 AP" },
  { icon: "🎙", t: "Market Day · T2", s: "pcm-NG · 4.4s · seller turn", end: "+35 AP" },
  { icon: "🎙", t: "Telco Trouble · T7", s: "pcm-NG · 3.8s · customer turn", end: "+35 AP" },
];

export const INTERVIEW_TASKS = [
  {
    kind: "Read aloud",
    prompt: "Read this line naturally, in your normal speaking voice.",
    text: "The quick delivery bike weaved through Lagos traffic before the rain started.",
  },
  {
    kind: "Improvise",
    prompt: "You're at a market. Haggle for a basket of tomatoes, in your language.",
    text: "Improvise 10–20 seconds. Be natural, like a real conversation.",
  },
  {
    kind: "Emotion",
    prompt: "Describe a time you were frustrated with a bank, in your language.",
    text: "Let the emotion come through. This shows us your range.",
  },
];

export const RAILS_NOTE =
  "You earn Accent Points as you play. Cash out to real money once you pass your rail's minimum: M-Pesa and Paystack from $5, Stripe and PayPal from $10, USDC from $2.";

// ---- Delivery / Foundry (internal ops) ----

export const FOUNDRY_STAGES = [
  { key: "captured", label: "Captured", icon: "🎙", count: 4782, note: "raw dual-channel takes" },
  { key: "transcribed", label: "Transcribed", icon: "📝", count: 4610, note: "first-pass STT" },
  { key: "verified", label: "Verified", icon: "✅", count: 4218, note: "editor-passed" },
  { key: "aligned", label: "Aligned", icon: "🔗", count: 3944, note: "word-level" },
  { key: "packaged", label: "Packaged", icon: "📦", count: 3610, note: "in a corpus" },
  { key: "delivered", label: "Delivered", icon: "🚚", count: 2980, note: "shipped to buyers" },
];

export const CORPORA = [
  { id: "acc_corp_pcm_ng_01", name: "Nigerian Pidgin · Banking & Market", locale: "pcm-NG", hours: 11.9, target: 20, sessions: 128, status: "building", buyer: "Design partner A" },
  { id: "acc_corp_sw_ke_01", name: "Swahili · Fintech & Ride-hailing", locale: "sw-KE", hours: 8.4, target: 15, sessions: 96, status: "building", buyer: "—" },
  { id: "acc_corp_yo_ng_01", name: "Yoruba · Retail & Support", locale: "yo-NG", hours: 5.1, target: 10, sessions: 61, status: "qa", buyer: "—" },
  { id: "acc_corp_multiling_v1", name: "Multilingual Sample Bundle v1", locale: "6 locales", hours: 58.4 / 60, target: 1, sessions: 10, status: "delivered", buyer: "Enterprise buyer" },
];

export const FOUNDRY_SESSIONS = [
  { id: "acc_sess_20260828_pcm_00892", scenario: "Banking Wahala", locale: "pcm-NG", turns: 12, dur: "6:08", qa: "passed", align: "done", pii: 1 },
  { id: "acc_sess_20260829_pcm_01108", scenario: "Market Day", locale: "pcm-NG", turns: 10, dur: "5:12", qa: "passed", align: "done", pii: 0 },
  { id: "acc_sess_20260830_pcm_02231", scenario: "Telco Trouble", locale: "pcm-NG", turns: 15, dur: "6:06", qa: "review", align: "pending", pii: 1 },
];

export const PIPELINE_STEPS = [
  { key: "capture", label: "Capture", icon: "🎙", detail: "Dual-channel WAV, 24 kHz, one speaker per channel", state: "done" },
  { key: "stt", label: "Transcribe", icon: "📝", detail: "First-pass STT produces raw text per turn", state: "done" },
  { key: "diarize", label: "Diarize", icon: "🗣", detail: "Speakers separated and turns timestamped", state: "done" },
  { key: "pii", label: "PII scan", icon: "🧹", detail: "NER flags and redacts spoken personal data", state: "done" },
  { key: "verify", label: "Verify", icon: "✅", detail: "Native-speaker editor corrects the transcript", state: "done" },
  { key: "align", label: "Align", icon: "🔗", detail: "Word-level source-to-target alignment, typed", state: "active" },
  { key: "package", label: "Package", icon: "📦", detail: "WAV + JSONL + Parquet + consent log + license", state: "todo" },
];

export const BUNDLE_FILES = [
  { path: "audio/pcm-NG/…_00892.wav", fmt: "WAV · 24kHz · stereo", size: "14.8 MB", ok: true },
  { path: "manifest.jsonl", fmt: "JSONL · UTF-8", size: "418 KB", ok: true },
  { path: "index.parquet", fmt: "Parquet · snappy", size: "31 KB", ok: true },
  { path: "alignments.jsonl", fmt: "JSONL · UTF-8", size: "162 KB", ok: true },
  { path: "consent_log.jsonl", fmt: "JSONL · UTF-8", size: "14.8 KB", ok: true },
  { path: "speakers.jsonl", fmt: "JSONL · UTF-8", size: "6.4 KB", ok: true },
  { path: "license.txt", fmt: "text", size: "12.6 KB", ok: true },
  { path: "SHA256SUMS", fmt: "text", size: "3.8 KB", ok: true },
];

export const MANIFEST_ROW = `{
  "session_id": "acc_sess_20260828_pcm_00892",
  "locale": "pcm-NG",
  "scenario": "retail_banking_fraud",
  "duration_seconds": 368.312,
  "channels": 2, "sample_rate_hz": 24000,
  "audio_file": "audio/pcm-NG/…_00892.wav",
  "participants": [
    { "speaker_id": "spk_pcm_ng_88201_f", "channel": 0,
      "role": "customer", "demographics": {"age_band":"25-34","gender":"F"} },
    { "speaker_id": "spk_pcm_ng_99104_m", "channel": 1,
      "role": "agent" } ],
  "turns": [
    { "turn_id": 1, "speaker_id": "spk_pcm_ng_88201_f",
      "start_ms": 1200, "end_ms": 4500,
      "raw_stt_text": "good morning i wake up see pos commot 50k",
      "verified_text": "Good morning. I wake up see say POS commot 50k for my account!",
      "english_source": "Good morning. I woke up and saw ₦50,000 leave my account…",
      "emotion_label": "frustrated", "code_switches": ["EN->PCM"],
      "alignments": [ /* word-level, typed */ ] } ],
  "verified_by_qc": { "editor_id": "ed_pcm_3312", "confidence": 0.98 },
  "license": { "type": "commercial_non_exclusive", "territory": "worldwide" }
}`;

export const CONSENT_EVENTS = [
  { spk: "spk_pcm_ng_88201_f", event: "CREATOR_AGREEMENTS_2026_09", ts: "2026-08-28T09:02:17Z", hash: "e3b0c442…" },
  { spk: "spk_pcm_ng_99104_m", event: "CREATOR_AGREEMENTS_2026_09", ts: "2026-08-28T09:04:52Z", hash: "7a5f3b1c…" },
  { spk: "spk_pcm_ng_44821_f", event: "CREATOR_AGREEMENTS_2026_09", ts: "2026-08-29T11:18:33Z", hash: "4a6f2c9b…" },
];

export const DELIVERIES = [
  { id: "del_2026_09_02_0714", buyer: "Enterprise buyer", corpus: "Multilingual Sample Bundle v1", size: "312 MB", format: "WAV+JSONL+Parquet", when: "2026-09-02", status: "delivered" },
  { id: "del_2026_08_20_0611", buyer: "Design partner A", corpus: "Nigerian Pidgin pilot", size: "88 MB", format: "WAV+JSONL", when: "2026-08-20", status: "delivered" },
];

export const PROGRESSION = [
  { rank: "Extra", need: "0", perk: "Play Volley, earn base AP" },
  { rank: "Featured", need: "2,000 AP", perk: "Unlock the Arena" },
  { rank: "Supporting", need: "8,000 AP", perk: "Higher-demand dialect queue" },
  { rank: "Lead", need: "25,000 AP", perk: "Cutting Room access, +bonus" },
  { rank: "Showrunner", need: "75,000 AP", perk: "Direct scenes, top multiplier" },
];
