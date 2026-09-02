// Blind-duet matchmaking. Pairs strangers by locale, excludes likely
// acquaintances via shared behavioural signals, and balances tier so scenes
// aren't lopsided. Pure logic; the real queue is Supabase Realtime presence.

export interface QueueEntry {
  id: string;
  locale: string;
  tier: number; // 0..3 (silver..platinum-ish) for balancing
  // signals used to detect acquaintances without storing a social graph
  device: string;
  ipPrefix: string;
  contactsHashOverlap?: (otherId: string) => number; // 0..1 optional
}

export interface Pairing {
  a: QueueEntry;
  b: QueueEntry;
  locale: string;
  tierGap: number;
}

/** Heuristic 0..1 that two entries know each other (higher = more likely). */
export function acquaintanceScore(a: QueueEntry, b: QueueEntry): number {
  let s = 0;
  if (a.ipPrefix && a.ipPrefix === b.ipPrefix) s += 0.5; // same network
  if (a.device === b.device) s += 0.2; // same device fingerprint
  if (a.contactsHashOverlap) s += 0.4 * a.contactsHashOverlap(b.id);
  return Math.min(1, s);
}

/**
 * Greedy pairing: within each locale, pair the closest tiers among players who
 * are unlikely to know each other. Returns pairs and whoever is left waiting.
 */
export function matchQueue(queue: QueueEntry[], acquaintanceThreshold = 0.6): { pairs: Pairing[]; waiting: QueueEntry[] } {
  const byLocale = new Map<string, QueueEntry[]>();
  for (const q of queue) {
    const list = byLocale.get(q.locale) ?? [];
    list.push(q);
    byLocale.set(q.locale, list);
  }

  const pairs: Pairing[] = [];
  const waiting: QueueEntry[] = [];

  for (const [locale, listRaw] of byLocale) {
    const list = listRaw.slice().sort((x, y) => x.tier - y.tier);
    const used = new Set<string>();
    for (let i = 0; i < list.length; i++) {
      if (used.has(list[i].id)) continue;
      let matched = false;
      for (let j = i + 1; j < list.length; j++) {
        if (used.has(list[j].id)) continue;
        if (acquaintanceScore(list[i], list[j]) >= acquaintanceThreshold) continue;
        pairs.push({ a: list[i], b: list[j], locale, tierGap: Math.abs(list[i].tier - list[j].tier) });
        used.add(list[i].id);
        used.add(list[j].id);
        matched = true;
        break;
      }
      if (!matched && !used.has(list[i].id)) {
        // defer; may pair on next tick
      }
    }
    for (const q of list) if (!used.has(q.id)) waiting.push(q);
  }
  return { pairs, waiting };
}
