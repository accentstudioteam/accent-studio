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

/** The studio's navigation: a sidebar on wide screens, a scrolling strip on phones. Counts are what is waiting. */
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

export interface Tab {
  key: string;
  label: string;
  glyph: string;
  badge?: number | null;
}

/** The contributor app's bottom bar. */
export function TabBar({ tabs, active, onPick }: { tabs: Tab[]; active: string; onPick: (key: string) => void }) {
  return (
    <nav className="tabbar" aria-label="Sections">
      {tabs.map((t) => (
        <button key={t.key} type="button" className={`tab${active === t.key ? " on" : ""}`} aria-current={active === t.key ? "page" : undefined} onClick={() => onPick(t.key)}>
          <span className="tab-glyph" aria-hidden="true">{t.glyph}</span>
          <span className="tab-label">{t.label}</span>
          {t.badge != null && t.badge > 0 && <span className="tab-badge">{t.badge}</span>}
        </button>
      ))}
    </nav>
  );
}
