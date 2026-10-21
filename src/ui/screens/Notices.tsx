import { useGame } from '../store';
import { HeroSummary } from '../components/bits';
import { CURSES } from '../../engine/data/statuses';
import { dismissNotice, score } from '../../engine/run';

export function Wipe() {
  const { run, act } = useGame();
  return (
    <div class="screen" style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ fontSize: '3.5rem' }}>💀</div>
      <h1>The party has fallen</h1>
      <div class="muted center" style={{ maxWidth: '640px' }}>
        You wake at the start of Act {run.act}, with the gear and gold you had then. A curse clings to each of you until this act's boss falls.
      </div>
      <div class="grid2" style={{ width: 'min(900px, 100%)' }}>
        {run.heroes.map((h) => (
          <HeroSummary hero={h}>
            <div class="small" style={{ marginTop: '6px' }}>
              {h.curses.map((c) => (
                <div>
                  <strong class="r-legendary">{CURSES[c].name}:</strong> {CURSES[c].desc}
                </div>
              ))}
            </div>
          </HeroSummary>
        ))}
      </div>
      <div class="tiny dim">High Spirit weakens curses. A shrine can lift one.</div>
      <button class="primary big" onClick={() => act(dismissNotice)}>
        Try again →
      </button>
    </div>
  );
}

export function End() {
  const { run, quit } = useGame();
  const win = run.screen === 'victory';
  return (
    <div class="screen" style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ fontSize: '3.5rem' }}>{win ? '👑' : '💀'}</div>
      <h1>{win ? 'Victory!' : 'The end of the road'}</h1>
      <div class="muted">
        {run.heroes.map((h) => h.name).join(' & ')} · {run.distance * 10} leagues · {run.stats.bossesKilled} bosses · {run.stats.kills} kills · {run.stats.wipes} wipes
      </div>
      <div class="banner">Score: {score(run)}</div>
      {win && <div class="small muted">Endless mode (keep going until the party falls) arrives in a later phase.</div>}
      <button class="primary big" onClick={quit}>
        Back to the title
      </button>
    </div>
  );
}
