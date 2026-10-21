import { useEffect } from 'preact/hooks';
import { useGame } from '../store';
import { prefetch } from '../../ai/gm';
import { story } from '../../engine/story';
import { TopBar } from '../components/TopBar';
import { HeroSummary, NODE_INFO } from '../components/bits';
import { chooseNode, dismissNotice, NODES_PER_ACT } from '../../engine/run';
import { initiativeOdds } from '../../engine/combat';
import { REGIONS } from '../../engine/data/enemies';
import { useSay } from '../useVoice';
import { hubSegments } from '../../audio/narrate';

export function Hub() {
  const { run, act, openInventory } = useGame();
  const region = REGIONS[run.regions[run.act - 1]];

  // While there's signal, pre-write the scenes on offer so dead zones still have narration.
  useEffect(() => {
    const t = setTimeout(() => prefetch(run, () => act(() => {})), 400);
    return () => clearTimeout(t);
  }, [run.distance, run.act]);
  useSay(`hub:${run.seed}:${run.distance}:${run.act}:${run.choices.length}`, () => hubSegments(run, run.distance > 0));
  const buffered = run.narrate ? Object.keys(story(run).buffer).length + story(run).eventBuffer.length : 0;

  return (
    <>
      <TopBar />
      <div class="screen">
        {run.notice && (
          <div class="panel row spread">
            <div class="banner" style={{ fontSize: '1.2rem', padding: 0 }}>
              {run.notice}
            </div>
            <button class="small" onClick={() => act(dismissNotice)}>
              OK
            </button>
          </div>
        )}
        <div class="grid2">
          {run.heroes.map((h) => (
            <HeroSummary hero={h} />
          ))}
        </div>

        <div class="col grow" style={{ justifyContent: 'center' }}>
          <h2 class="center">{run.actNode >= NODES_PER_ACT ? 'The road ends at a stronghold...' : 'Choose your path'}</h2>
          <div class="center small muted">
            {region.name}: {region.hazardText}. Enemies: {Object.values(region.family).join(', ')}.
          </div>
          <div class={`grid${Math.max(1, Math.min(3, run.choices.length))}`} style={{ maxWidth: run.choices.length === 1 ? '420px' : undefined, margin: '0 auto', width: '100%' }}>
            {run.choices.map((n, i) => {
              const info = NODE_INFO[n.type];
              return (
                <button class={`node-card ${n.type === 'boss' ? 'primary' : ''}`} onClick={() => act((r) => chooseNode(r, i))}>
                  <span class="icon">{info.icon}</span>
                  <strong>{n.type === 'boss' ? region.boss.name : info.name}</strong>
                  <span class="small" style={{ opacity: 0.8 }}>
                    {n.type === 'boss' ? region.boss.mechanic : info.desc}
                  </span>
                  {(n.type === 'elite' || n.type === 'boss') && <span class="tiny">Initiative odds: {Math.round(initiativeOdds(run) * 100)}%</span>}
                </button>
              );
            })}
          </div>
          <div class="center tiny dim">
            Phase 3 replaces this with the full branching map.{run.narrate ? ` · ${buffered} scenes pre-written for offline play` : ''}
          </div>
        </div>

        <div class="row spread">
          <div class="log small" style={{ maxHeight: '70px', flex: 1 }}>
            {run.log.slice(-3).map((l) => (
              <div class={`l-${l.kind ?? 'info'}`}>{l.text}</div>
            ))}
          </div>
          <button onClick={openInventory}>🎒 Inventory and characters</button>
        </div>
      </div>
    </>
  );
}
