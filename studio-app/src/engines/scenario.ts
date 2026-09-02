// Scenario generation engine. Composes a scene: picks a demand-weighted domain,
// casts personas into roles, generates the English prompt line for each beat
// (with phrasing variety), lays a mood arc over it, and injects a Twist.
// Deterministic per seed, dependency-free. This is the real generator the app
// calls; screens no longer hardcode a single prompt.

import { makeRng, seedFrom, pick, weightedPick, intBetween, type Rng } from "./rng";
import { PERSONAS, personasForRole, moodArc, responseMood, type Emotion, type Persona } from "./personas";

export interface Beat {
  role: string; // which role speaks
  intent: string;
  lines: string[]; // English phrasing variants
}

export interface Domain {
  key: string;
  title: string;
  demand: number; // higher = selected more often (dialect/domain demand)
  roles: { role: string }[];
  beats: Beat[];
  twists: string[];
}

const DOMAINS: Domain[] = [
  {
    key: "retail_banking_fraud",
    title: "Unauthorized POS Dispute",
    demand: 5,
    roles: [{ role: "customer" }, { role: "agent" }],
    beats: [
      { role: "customer", intent: "state the problem", lines: [
        "Good morning. I woke up this morning and saw that ₦50,000 left my account through a POS I never used.",
        "Hello, someone used a POS to take ₦50,000 from my account overnight and I didn't authorize it.",
        "I need help. There's a POS charge of ₦50,000 on my account that I did not make.",
      ] },
      { role: "agent", intent: "empathize and reassure", lines: [
        "I am so sorry to hear that. Please stay calm, let me check your account details right now.",
        "That sounds stressful, I'll help you right away. Let me pull up your account.",
      ] },
      { role: "customer", intent: "press for urgency", lines: [
        "Please don't waste time. I really need my money back today.",
        "This is my rent money. How fast can you reverse it?",
      ] },
      { role: "agent", intent: "explain the action", lines: [
        "Sir, I can see three unauthorized transactions. I'll block the card now and start the refund process.",
        "I've found the charges. I'm blocking the card and opening a dispute this minute.",
      ] },
      { role: "customer", intent: "verify identity", lines: [
        "My date of birth is [DATE] and my mother's maiden name is [NAME].",
      ] },
      { role: "agent", intent: "confirm resolution", lines: [
        "Identity confirmed. The card is blocked and the refund will reflect within 48 hours.",
        "You're verified. No more charges can happen, and the refund lands in two business days.",
      ] },
    ],
    twists: [
      "The customer reveals they clicked a link in an SMS yesterday.",
      "The agent finds a second card the customer forgot existed.",
      "Reject the first apology — you want a supervisor.",
    ],
  },
  {
    key: "retail_market_haggle",
    title: "The Price Haggle",
    demand: 4,
    roles: [{ role: "buyer" }, { role: "seller" }],
    beats: [
      { role: "buyer", intent: "open the haggle", lines: [
        "Ma'am, how much for this basket of tomatoes? Please don't say ₦2,000.",
        "Aunty, give me a good price for these tomatoes, not your customer price o.",
      ] },
      { role: "seller", intent: "hold the price", lines: [
        "These ones are fresh from the farm this morning. Give me ₦1,800.",
        "Fresh tomatoes, I can't go below ₦1,800, my sister.",
      ] },
      { role: "buyer", intent: "counter playfully", lines: [
        "That is too much. Take ₦1,200 and let me go.",
        "Ah! ₦1,200 last, I have to still buy pepper.",
      ] },
      { role: "seller", intent: "meet in the middle", lines: [
        "You've become a market woman like me! ₦1,500, that's my final price.",
        "Okay, because it's you, ₦1,500 and carry it.",
      ] },
      { role: "buyer", intent: "close the deal", lines: [
        "₦1,300, final offer. I don't have change.",
        "Collect ₦1,400 and add small pepper on top.",
      ] },
      { role: "seller", intent: "seal it warmly", lines: [
        "Okay, take it. You're a tough negotiator.",
        "Come and collect, and bring your friend next time.",
      ] },
    ],
    twists: [
      "A regular customer walks past — greet them mid-haggle.",
      "It starts to rain; wrap up fast.",
      "The buyer realizes they're short on cash.",
    ],
  },
  {
    key: "telco_support_data",
    title: "Data Bundle Vanished",
    demand: 4,
    roles: [{ role: "customer" }, { role: "agent" }],
    beats: [
      { role: "customer", intent: "report the issue", lines: [
        "Hello! The 5GB data bundle I bought yesterday has vanished. I don't know what happened.",
        "My data just disappeared overnight and I barely used it. What's going on?",
      ] },
      { role: "agent", intent: "ask for the line", lines: [
        "Good morning, sorry about that. Can you tell me the phone number you used to buy the data?",
      ] },
      { role: "customer", intent: "give the number", lines: [
        "Yes, it's [PHONE]. I bought 5GB and it didn't even last a day.",
      ] },
      { role: "agent", intent: "explain usage", lines: [
        "One moment… I can see it was used up by video streaming all day. It's in your usage log.",
      ] },
      { role: "customer", intent: "push back", lines: [
        "A whole 5GB in one day? Please check it properly.",
      ] },
      { role: "agent", intent: "offer goodwill", lines: [
        "Our system shows clear usage, but as a loyal customer let me add a 500MB bonus to apologize.",
      ] },
    ],
    twists: [
      "The customer mentions they lent the phone to a child.",
      "A background app was auto-updating on data.",
      "Offer an unlimited-social bundle instead.",
    ],
  },
  {
    key: "fintech_kyc_onboard",
    title: "Mobile Fintech KYC",
    demand: 5,
    roles: [{ role: "agent" }, { role: "customer" }],
    beats: [
      { role: "agent", intent: "welcome and request ID", lines: [
        "Hello, welcome to the app. Please provide your ID to continue.",
        "Karibu! To finish setup I'll need your ID number, please.",
      ] },
      { role: "customer", intent: "provide ID", lines: [
        "Okay, here's my ID. The number is [ID].",
      ] },
      { role: "agent", intent: "request selfie", lines: [
        "Thank you. Now a quick selfie for verification, please.",
      ] },
      { role: "customer", intent: "react to speed", lines: [
        "Done. This is really fast, I'm impressed.",
      ] },
      { role: "agent", intent: "confirm limits", lines: [
        "You're verified. On Tier 1 you can send up to 70,000 a day; upgrade for more.",
      ] },
      { role: "customer", intent: "ask to upgrade", lines: [
        "And how do I upgrade my tier?",
      ] },
    ],
    twists: [
      "The selfie fails once for lighting; reassure and retry.",
      "The customer asks if their data is safe.",
      "Offer to raise the limit with a payslip upload.",
    ],
  },
  {
    key: "ride_hailing_dispute",
    title: "Route Deviation",
    demand: 3,
    roles: [{ role: "rider" }, { role: "driver" }],
    beats: [
      { role: "rider", intent: "question the route", lines: [
        "Driver, why did you take this longer route instead of the main road?",
      ] },
      { role: "driver", intent: "explain", lines: [
        "There's heavy traffic on the main road. I saw it on the app and took this way.",
      ] },
      { role: "rider", intent: "worry about fare", lines: [
        "But this is longer, will the fare go up? Why didn't you ask me first?",
      ] },
      { role: "driver", intent: "reassure on price", lines: [
        "The fare won't change, it's the fixed price you already accepted.",
      ] },
      { role: "rider", intent: "soften but push", lines: [
        "Alright, but I'm late for a meeting.",
      ] },
      { role: "driver", intent: "offer a fix", lines: [
        "Don't worry, I know a short-cut through the back. We'll make it early.",
      ] },
    ],
    twists: [
      "The app reroutes again mid-trip.",
      "The rider asks to turn the radio down.",
      "A road is suddenly closed ahead.",
    ],
  },
];

export interface GeneratedTurn {
  turnId: number;
  role: string;
  personaName: string;
  english: string;
  emotion: Emotion;
}

export interface GeneratedScene {
  id: string;
  domain: string;
  title: string;
  cast: { role: string; persona: Persona }[];
  turns: GeneratedTurn[];
  twist: { atTurn: number; text: string };
}

function castRole(rng: Rng, role: string): Persona {
  const pool = personasForRole(role);
  return pool.length ? pick(rng, pool) : pick(rng, PERSONAS);
}

/**
 * Generate a full scene. Pass a stable `seed` (e.g. a session id) for a
 * reproducible scene, or omit for a fresh one each call.
 */
export function generateScene(seed?: string | number, domainKey?: string): GeneratedScene {
  const s = seed === undefined ? Math.floor(Math.random() * 1e9) : typeof seed === "number" ? seed : seedFrom(seed);
  const rng = makeRng(s);

  const domain = domainKey
    ? DOMAINS.find((d) => d.key === domainKey) ?? DOMAINS[0]
    : weightedPick(rng, DOMAINS.map((d) => ({ item: d, weight: d.demand })));

  const cast = domain.roles.map((r) => ({ role: r.role, persona: castRole(rng, r.role) }));
  const personaByRole = new Map(cast.map((c) => [c.role, c.persona]));

  // The first-listed role drives the emotional arc; the other answers it.
  const driverRole = domain.roles[0].role;
  const driverMood = personaByRole.get(driverRole)!.baseMood;
  const arc = moodArc(driverMood, domain.beats.filter((b) => b.role === driverRole).length);

  let driverIdx = 0;
  const turns: GeneratedTurn[] = domain.beats.map((beat, i) => {
    const persona = personaByRole.get(beat.role)!;
    let emotion: Emotion;
    if (beat.role === driverRole) {
      emotion = arc[Math.min(arc.length - 1, driverIdx++)];
    } else {
      emotion = responseMood(driverMood);
    }
    return {
      turnId: i + 1,
      role: beat.role,
      personaName: persona.name,
      english: pick(rng, beat.lines),
      emotion,
    };
  });

  const twistAt = intBetween(rng, 2, Math.max(2, domain.beats.length - 1));
  const twist = { atTurn: twistAt, text: pick(rng, domain.twists) };

  const id = `scene_${s.toString(36)}`;
  return { id, domain: domain.key, title: domain.title, cast, turns, twist };
}

/** A short "next up" teaser for the home screen. */
export function nextScene(seed?: string | number): { title: string; role: string; english: string; emotion: Emotion } {
  const sc = generateScene(seed);
  const first = sc.turns[0];
  return { title: sc.title, role: first.role, english: first.english, emotion: first.emotion };
}

export const DOMAIN_KEYS = DOMAINS.map((d) => d.key);
