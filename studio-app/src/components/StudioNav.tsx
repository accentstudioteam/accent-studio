import { Logo } from "@/components/Logo";

export interface NavItem {
  key: string;
  label: string;
  count?: number | null;
  group?: string;
  accent?: "mint" | "gold";
}

interface Props {
  items: NavItem[];
  active: string;
  onPick: (key: string) => void;
}

/** The studio's navigation on a desk: a grouped sidebar with counts of what is waiting. */
export function StudioNav({ items, active, onPick }: Props) {
  const groups = items.reduce<{ name: string; items: NavItem[] }[]>((acc, it) => {
    const g = it.group ?? "";
    const last = acc[acc.length - 1];
    if (last && last.name === g) last.items.push(it);
    else acc.push({ name: g, items: [it] });
    return acc;
  }, []);
  return (
    <nav className="snav" aria-label="Studio">
      {groups.map((g, i) => (
        <div key={`${g.name}-${i}`} className="snav-grp">
          {g.name && <div className="snav-h">{g.name}</div>}
          {g.items.map((it) => (
            <button key={it.key} type="button" className={`snav-item${active === it.key ? " on" : ""}`} aria-label={it.label} title={it.count != null && it.count > 0 ? `${it.label}: ${it.count} waiting` : it.label} aria-current={active === it.key ? "page" : undefined} onClick={() => onPick(it.key)}>
              <span>{it.label}</span>
              {it.count != null && it.count > 0 && <span className={`snav-count${it.accent === "gold" ? " gold" : ""}`} aria-hidden="true">{it.count}</span>}
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}

export type DockIcon = "home" | "play" | "live" | "money" | "you" | "queue" | "people" | "labs" | "audit" | "cases";
export interface DockTab {
  key: string;
  label: string;
  icon: DockIcon;
  badge?: number | null;
  /** The live lamp: a scene is about to start. */
  soon?: boolean;
}

const PATHS: Record<DockIcon, string> = {
  home: "M3 11 12 4l9 7v9H3z M9 20v-6h6v6",
  play: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M10 8l6 4-6 4z",
  live: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M5 5a10 10 0 0 0 0 14 M19 5a10 10 0 0 1 0 14",
  money: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z M12 7v10 M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4",
  you: "M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M4 21c0-4 4-6 8-6s8 2 8 6",
  queue: "M4 6h16 M4 12h16 M4 18h10",
  people: "M9 5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5 M16 6a3 3 0 0 1 0 6 M17 14.5c3 .5 5 2.5 5 5.5",
  labs: "M9 3h6 M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3 M8 15h8",
  audit: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M8 12l3 3 5-6",
  cases: "M5 21V4 M5 4h12l-2 4 2 4H5",
};

function Icon({ name }: { name: DockIcon }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

/** The contributor app on a desk: the same five places down the left, with the speaker id and sign out at the foot. */
export function PlayerSidebar({ tabs, active, onPick, speakerId, onSignOut }: { tabs: DockTab[]; active: string; onPick: (key: string) => void; speakerId: string; onSignOut: () => void }) {
  return (
    <aside className="pside">
      <div className="pside-brand"><Logo height={22} /></div>
      <nav className="pside-nav" aria-label="Sections">
        {tabs.map((t) => (
          <button key={t.key} type="button" className={`pside-item${active === t.key ? " on" : ""}${t.soon ? " soon" : ""}`} aria-current={active === t.key ? "page" : undefined} onClick={() => onPick(t.key)}>
            <Icon name={t.icon} />
            <span>{t.label}</span>
            {t.badge != null && t.badge > 0 && <b aria-label={`${t.badge} waiting`}>{t.badge}</b>}
          </button>
        ))}
      </nav>
      <div className="pside-foot">
        <span className="chip" style={{ fontFamily: "var(--mono)", fontSize: "0.7rem" }}>{speakerId}</span>
        <button type="button" className="chip" style={{ cursor: "pointer" }} onClick={onSignOut}>Sign out</button>
      </div>
    </aside>
  );
}

/** The floating dock: five places, icons only, the one you are on opens to show its name. Content scrolls under it. */
export function Dock({ tabs, active, onPick }: { tabs: DockTab[]; active: string; onPick: (key: string) => void }) {
  return (
    <div className="dockwrap">
      <nav className="dock" aria-label="Sections">
        {tabs.map((t) => (
          <button key={t.key} type="button" className={`dtab${active === t.key ? " on" : ""}${t.soon ? " soon" : ""}`} aria-label={t.label} aria-current={active === t.key ? "page" : undefined} onClick={() => onPick(t.key)}>
            <Icon name={t.icon} />
            <span className="dlb">{t.label}</span>
            {t.badge != null && t.badge > 0 && <span className="dbadge" aria-hidden="true">{t.badge}</span>}
          </button>
        ))}
      </nav>
    </div>
  );
}
