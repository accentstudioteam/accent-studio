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

export const PROGRESSION = [
  { rank: "Extra", need: "0", perk: "Play Volley, earn base AP" },
  { rank: "Featured", need: "2,000 AP", perk: "Unlock the Arena" },
  { rank: "Supporting", need: "8,000 AP", perk: "Higher-demand dialect queue" },
  { rank: "Lead", need: "25,000 AP", perk: "Cutting Room access, +bonus" },
  { rank: "Showrunner", need: "75,000 AP", perk: "Direct scenes, top multiplier" },
];
