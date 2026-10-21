import { useGame } from '../store';
import { TopBar } from '../components/TopBar';
import { CLASS_ICON, STAT_LABEL } from '../components/bits';
import { ABILITIES, TALENTS } from '../../engine/data/characters';
import { STATS } from '../../engine/types';
import { levelUpChoose, levelUpDone, levelUpReroll, levelUpStat } from '../../engine/run';
import { derive } from '../../engine/character';

export function LevelUp() {
  const { run, act } = useGame();
  const done = run.heroes.every((h) => h.pendingLevelUps === 0 && h.statPoints === 0);
  return (
    <>
      <TopBar title="Level up!" />
      <div class="screen">
        <h2>⭐ Level up</h2>
        <div class="grid2 grow scroll" style={{ alignItems: 'start' }}>
          {run.heroes.map((h) => {
            const d = derive(h);
            const finished = h.pendingLevelUps === 0 && h.statPoints === 0;
            return (
              <div class="panel col">
                <div class="row spread">
                  <h3>
                    {CLASS_ICON[h.cls]} {h.name} · level {h.level}
                  </h3>
                  {finished && <span class="badge good">Ready</span>}
                </div>
                {h.statPoints > 0 && (
                  <div class="col" style={{ gap: '6px' }}>
                    <div class="small">
                      Stat point{h.statPoints > 1 ? 's' : ''} to spend: <strong>{h.statPoints}</strong>
                    </div>
                    <div class="grid4">
                      {STATS.map((s) => (
                        <button onClick={() => act((r) => levelUpStat(r, h.id, s))}>
                          {STAT_LABEL[s]} {d.stats[s]} → {d.stats[s] + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {h.pendingLevelUps > 0 && h.talentOffer && (
                  <div class="col" style={{ gap: '8px' }}>
                    <div class="small">
                      Choose a talent{h.pendingLevelUps > 1 ? ` (${h.pendingLevelUps} to choose)` : ''}:
                    </div>
                    {h.talentOffer.map((t) => {
                      const def = TALENTS[t];
                      return (
                        <button style={{ textAlign: 'left' }} onClick={() => act((r) => levelUpChoose(r, h.id, t))}>
                          <strong>
                            {def.ability ? ABILITIES[def.ability].icon : '✦'} {def.name}
                          </strong>
                          {def.cls ? '' : <span class="tiny muted"> (any class)</span>}
                          <div class="small muted">{def.desc}</div>
                        </button>
                      );
                    })}
                    {h.race === 'human' && (
                      <button class="small" disabled={h.humanRerollUsed} onClick={() => act((r) => levelUpReroll(r, h.id))}>
                        🎲 Human: reroll these options {h.humanRerollUsed ? '(used)' : ''}
                      </button>
                    )}
                  </div>
                )}
                {finished && <div class="muted small">Max HP {d.maxHp} · Talents: {h.talents.map((t) => TALENTS[t].name).join(', ') || 'none'}</div>}
              </div>
            );
          })}
        </div>
        <div class="row" style={{ justifyContent: 'flex-end' }}>
          <button class="primary big" disabled={!done} onClick={() => act(levelUpDone)}>
            Continue →
          </button>
        </div>
      </div>
    </>
  );
}
