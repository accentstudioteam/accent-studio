import { useCallback, useEffect, useState } from "react";
import { LANG_NAME, browse, domainLabel, joinRally, myProjects, type Browse, type BrowseRally, type PlayerProject } from "@/lib/game";
import { isDemo } from "@/lib/demo";
import { UNKNOWN_AVATAR, avatarFor } from "@/components/ankara-avatars";
import { Ava, Notice, Page, Seats, TopBar } from "@/components/ankara-ui";

/* ============================================================================
   Play, in the approved "Ankara Blocks" direction.

   Two screens behind one tab. First the projects the contributor is on; then
   the rallies inside one, which is where they actually choose. A contributor
   with a single project never sees the first screen: there is nothing to pick
   between, so Play opens straight on that project's rallies.

   The data is pp_browse and pp_join, exactly as agreed. A rally's state is
   carried by the surface it sits on — mint for yours, gold for one somebody
   is already waiting in, a plain card for one nobody has touched — plus the
   section it is filed under and the words on its chip.
   ========================================================================= */

const POLL_MS = 20_000;

interface Props {
  /** Which project is open, held by Player so it survives a trip into a rally. */
  projectId: string | null;
  onPickProject: (projectId: string | null) => void;
  onOpenRally: (sessionId: string) => void;
  onHome: () => void;
}

export function PlayerPlay({ projectId, onPickProject, onOpenRally, onHome }: Props) {
  const [projects, setProjects] = useState<PlayerProject[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void myProjects()
      .then((p) => {
        setProjects(p);
        setErr(null);
      })
      .catch((e: unknown) => {
        setProjects([]);
        setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "Couldn't load your projects.");
      });
  }, []);

  if (projects === null) {
    return (
      <Page>
        <div className="sys">Opening your projects</div>
      </Page>
    );
  }

  const picked = projectId ? projects.find((p) => p.project_id === projectId) ?? null : null;
  // One project is not a list worth tapping through, and no project list at all
  // (the server has none to give yet) browses everything the contributor can see.
  const only = projects.length === 1 ? projects[0] : null;
  const open = picked ?? only;

  if (open || projects.length === 0) {
    return <ProjectRallies project={open} onBack={projects.length > 1 ? () => onPickProject(null) : onHome} onOpenRally={onOpenRally} />;
  }

  return (
    <Page>
      <TopBar onBack={onHome} backLabel="Back to home" eyebrow="Ping-Pong" title="Your projects." />
      {err && <div style={{ marginTop: 14 }}><Notice tone="coral">{err}</Notice></div>}
      <p className="note-p">A project is one lab's order in one language. Open one to see the scenes inside it and pick a rally.</p>
      <div className="scenes" style={{ marginTop: 14 }}>
        {projects.map((p, i) => (
          <ProjectRow key={p.project_id} project={p} tone={["mint", "gold", "lilac", "coral"][i % 4]} onOpen={() => onPickProject(p.project_id)} />
        ))}
      </div>
    </Page>
  );
}

function ProjectRow({ project, tone, onOpen }: { project: PlayerProject; tone: string; onOpen: () => void }) {
  const mine = project.mine_count ?? 0;
  const waiting = project.waiting_count ?? 0;
  const free = project.open_count ?? 0;
  return (
    <button type="button" className={`blk blk-${tone} pat-dia-6 press scene-row`} onClick={onOpen}>
      <div className="scene-top">
        <b>{project.name}</b>
        <span className="chip chip-ink">Open</span>
      </div>
      {project.note && <p>{project.note}</p>}
      <div className="scene-foot">
        <span className="lab">{LANG_NAME[project.language] ?? project.language}</span>
        {mine > 0 && <span className="chip chip-ink">{mine} yours</span>}
        {waiting > 0 && <span className="chip chip-cream">{waiting} waiting</span>}
        {free > 0 && <span className="chip chip-cream">{free} free</span>}
      </div>
    </button>
  );
}

function ProjectRallies({ project, onBack, onOpenRally }: { project: PlayerProject | null; onBack: () => void; onOpenRally: (sessionId: string) => void }) {
  const [b, setB] = useState<Browse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [joining, setJoining] = useState<string | null>(null);
  const pid = project?.project_id ?? null;

  const load = useCallback(async () => {
    try {
      setB(await browse(pid));
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "Couldn't load the rallies.");
    }
  }, [pid]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), isDemo() ? 3_000 : POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const join = async (r: BrowseRally) => {
    setJoining(r.session_id);
    setErr(null);
    try {
      const { session_id } = await joinRally(r.session_id);
      onOpenRally(session_id);
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^.*?: /, "") : "Couldn't join that rally.");
      setJoining(null);
    }
  };

  const max = b?.max_open ?? 3;
  const used = b?.my_open_count ?? 0;
  const full = used >= max;
  const rallies = b?.rallies ?? [];
  const mine = rallies.filter((r) => r.state === "mine");
  const waiting = rallies.filter((r) => r.state === "waiting");
  const open = rallies.filter((r) => r.state === "open");
  const language = project?.language ?? "pcm";

  const row = (r: BrowseRally) => <SceneRow key={r.session_id} r={r} full={full} joining={joining === r.session_id} onJoin={() => void join(r)} onOpen={() => onOpenRally(r.session_id)} />;

  return (
    <Page>
      <TopBar onBack={onBack} backLabel="Back" eyebrow={`Ping-Pong · ${LANG_NAME[language] ?? language}`} title={project ? `${project.name}.` : "Pick a rally."} />
      <Seats used={used} max={max} />
      <p className="note-p">
        {used} of {max} slots in play. {full ? "Finish one — or let one close — before you join another." : `You can hold ${max - used} more.`}
      </p>

      {err && <div style={{ marginTop: 14 }}><Notice tone="coral">{err}</Notice></div>}
      {full && !err && <div style={{ marginTop: 14 }}><Notice>Your three slots are full, so joining is off until one frees up. The rallies below are still here when it does.</Notice></div>}

      {mine.length > 0 && (
        <>
          <div className="sec-h"><h3>Already yours</h3><span className="lab muted">{mine.length}</span></div>
          <div className="scenes">{mine.map(row)}</div>
        </>
      )}

      {waiting.length > 0 && (
        <>
          <div className="sec-h"><h3>Someone is waiting for a partner</h3><span className="lab muted">{waiting.length}</span></div>
          <div className="scenes">{waiting.map(row)}</div>
        </>
      )}

      {open.length > 0 && (
        <>
          <div className="sec-h"><h3>Nobody here yet</h3><span className="lab muted">{open.length}</span></div>
          <div className="scenes">{open.map(row)}</div>
        </>
      )}

      {b && rallies.length === 0 && (
        <div className="card pad" style={{ marginTop: 16 }}>
          <h3>Nothing to play here yet.</h3>
          <p>Every rally in this project is taken. New scenes land as the project grows — check back, or open another project.</p>
        </div>
      )}
      {!b && !err && <div className="sys">Loading the rallies</div>}
    </Page>
  );
}

function SceneRow({ r, full, joining, onJoin, onOpen }: { r: BrowseRally; full: boolean; joining: boolean; onJoin: () => void; onOpen: () => void }) {
  const mine = r.state === "mine";
  const waiting = r.state === "waiting";
  const surface = mine ? "blk blk-mint" : waiting ? "blk blk-gold" : "card";
  const who = waiting ? avatarFor(r.partner_alias ?? r.session_id, 3) : mine ? avatarFor(r.session_id, 5) : UNKNOWN_AVATAR;
  const word = mine ? "Yours" : waiting ? "One seat left" : "Empty";
  return (
    <div className={`${surface} scene-row`}>
      <div className="scene-top">
        <Ava who={who} size={38} />
        <b>{r.card_title}</b>
        <span className={`chip ${mine ? "chip-ink" : "chip-cream"}`}>{word}</span>
      </div>
      <p>{r.card_situation}</p>
      <div className="scene-foot">
        <span className="lab">{domainLabel(r.domain)}</span>
        <span className={`chip ${mine ? "chip-ink" : "chip-cream"}`}>{r.turn_count}/{r.turns_target} turns</span>
        {waiting && <span className="chip chip-cream">{r.partner_alias ?? "Someone"} is in</span>}
        {!mine && !r.can_join && full && <span className="chip chip-cream">Slots full</span>}
        {mine ? (
          <button className="btn btn-ink btn-sm" type="button" onClick={onOpen}>Open</button>
        ) : (
          <button className={`btn btn-sm ${waiting ? "btn-ink" : "btn-mint"}`} type="button" disabled={!r.can_join || joining} onClick={onJoin}>
            {joining ? "Joining…" : waiting ? "Take the other role" : "Start it"}
          </button>
        )}
      </div>
    </div>
  );
}
