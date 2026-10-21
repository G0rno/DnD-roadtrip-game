import { useState } from 'preact/hooks';
import type { BackgroundId, ClassId, RaceId, Stat } from '../../engine/types';
import { STATS } from '../../engine/types';
import { ABILITIES, BACKGROUNDS, BACKGROUND_IDS, CLASSES, CLASS_IDS, RACES, RACE_IDS } from '../../engine/data/characters';
import { randomDraft, type HeroDraft } from '../../engine/character';
import { finishCreation } from '../../engine/run';
import { Rng, newSeed } from '../../engine/rng';
import { useGame } from '../store';
import { CLASS_ICON, STAT_LABEL } from '../components/bits';

const STEPS = ['Name', 'Race', 'Class', 'Background', 'Review'];

const COMBOS: Record<string, string> = {
  'fighter+rogue': 'Fighter staggers, Rogue backstabs the staggered target for bonus damage.',
  'fighter+mage': 'Mage freezes, Fighter shatters the frozen enemy for double damage.',
  'cleric+fighter': "Cleric blesses the Fighter's Guard: guarded hits heal the Fighter.",
  'mage+rogue': 'Rogue exposes, Fireball always crits on exposed enemies.',
  'cleric+rogue': 'A Blessed Rogue using Vanish also cleanses the Cleric.',
  'cleric+mage': 'Bless on the Mage lowers spell cooldowns by 1.',
};

export function comboText(a: ClassId, b: ClassId): string {
  if (a === b) return "Twin classes: each player's first ability every fight doesn't go on cooldown.";
  return COMBOS[[a, b].sort().join('+')] ?? '';
}

const rng = () => new Rng({ rngState: newSeed() });

export function Create() {
  const { act, quit } = useGame();
  const [player, setPlayer] = useState(0);
  const [step, setStep] = useState(0);
  const [drafts, setDrafts] = useState<HeroDraft[]>([
    { name: '', race: 'human', cls: 'fighter', background: 'soldier', humanStat: 'might' },
    { name: '', race: 'elf', cls: 'mage', background: 'scholar', humanStat: 'mind' },
  ]);
  const d = drafts[player];
  const set = (patch: Partial<HeroDraft>) => setDrafts(drafts.map((x, i) => (i === player ? { ...x, ...patch } : x)));

  const randomizeStep = () => {
    const r = randomDraft(rng(), [drafts[1 - player].name]);
    if (step === 0) set({ name: r.name });
    if (step === 1) set({ race: r.race, humanStat: r.humanStat });
    if (step === 2) set({ cls: r.cls });
    if (step === 3) set({ background: r.background });
  };
  const randomizeAll = () => {
    const r = randomDraft(rng(), [drafts[1 - player].name]);
    set(r);
    setStep(4);
  };

  const next = () => {
    if (step < 4) setStep(step + 1);
    else if (player === 0) {
      setPlayer(1);
      setStep(0);
    } else {
      act((run) => finishCreation(run, [drafts[0], drafts[1]]));
    }
  };
  const back = () => {
    if (step > 0) setStep(step - 1);
    else if (player === 1) {
      setPlayer(0);
      setStep(4);
    }
  };

  const other = drafts[1 - player];

  return (
    <div class="screen">
      <div class="row spread">
        <div>
          <h2>
            Player {player + 1}: {STEPS[step]}
          </h2>
          <div class="small muted">
            Step {step + 1} of 5 {player === 1 && `· ${drafts[0].name || 'Player 1'} is a ${CLASSES[drafts[0].cls].name}`}
          </div>
        </div>
        <div class="row">
          {step < 4 && <button onClick={randomizeStep}>🎲 Randomize this</button>}
          <button onClick={randomizeAll}>🎲 Randomize character</button>
          <button class="ghost small" onClick={quit}>
            Title
          </button>
        </div>
      </div>

      <div class="grow scroll">
        {step === 0 && (
          <div class="col" style={{ maxWidth: '600px', margin: '30px auto' }}>
            <label class="muted">Hero name</label>
            <input
              value={d.name}
              onInput={(e) => set({ name: (e.target as HTMLInputElement).value.slice(0, 18) })}
              placeholder={`Player ${player + 1}`}
              style={{ fontSize: '1.4rem', padding: '14px', borderRadius: '10px', border: '1px solid var(--line2)', background: '#141116', color: 'var(--text)', userSelect: 'text' }}
            />
          </div>
        )}

        {step === 1 && (
          <div class="col">
            <div class="grid4">
              {RACE_IDS.map((id: RaceId) => (
                <div class={`card clickable ${d.race === id ? 'selected' : ''}`} onClick={() => set({ race: id })}>
                  <h3>{RACES[id].name}</h3>
                  <div class="small">+1 {RACES[id].bonus === 'any' ? 'to any stat' : STAT_LABEL[RACES[id].bonus]}</div>
                  <div class="small muted">{RACES[id].passive}</div>
                </div>
              ))}
            </div>
            {d.race === 'human' && (
              <div class="row">
                <span class="muted">Human bonus:</span>
                {STATS.map((s: Stat) => (
                  <button class={d.humanStat === s ? 'selected' : ''} onClick={() => set({ humanStat: s })}>
                    +1 {STAT_LABEL[s]}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div class="col">
            <div class="grid4">
              {CLASS_IDS.map((id) => {
                const c = CLASSES[id];
                return (
                  <div class={`card clickable col ${d.cls === id ? 'selected' : ''}`} style={{ gap: '6px' }} onClick={() => set({ cls: id })}>
                    <div class="row">
                      <span style={{ fontSize: '1.8rem' }}>{CLASS_ICON[id]}</span>
                      <div>
                        <h3>{c.name}</h3>
                        <div class="tiny muted">{c.role}</div>
                      </div>
                    </div>
                    <div class="small">{c.blurb}</div>
                    <div class="small muted">Main stat: {STAT_LABEL[c.mainStat]} · Applies {c.applies}</div>
                    {c.startAbilities.map((a) => (
                      <div class="small">
                        {ABILITIES[a].icon} <strong>{ABILITIES[a].name}</strong> <span class="muted">({ABILITIES[a].cooldown})</span>: {ABILITIES[a].desc}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
            {player === 1 && (
              <div class="panel tight small">
                <strong class="r-legendary">Combo with {drafts[0].name || 'Player 1'}:</strong> {comboText(drafts[0].cls, d.cls)}
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div class="grid3">
            {BACKGROUND_IDS.map((id: BackgroundId) => (
              <div class={`card clickable ${d.background === id ? 'selected' : ''}`} onClick={() => set({ background: id })}>
                <h3>{BACKGROUNDS[id].name}</h3>
                <div class="small muted">{BACKGROUNDS[id].perk}</div>
              </div>
            ))}
          </div>
        )}

        {step === 4 && (
          <div class="grid2">
            {[0, 1].map((i) => {
              const x = drafts[i];
              if (i === 1 && player === 0) return <div class="panel muted center" style={{ display: 'grid', placeItems: 'center' }}>Player 2 is next</div>;
              const stats = { ...CLASSES[x.cls].baseStats };
              const bonus = RACES[x.race].bonus === 'any' ? (x.humanStat ?? CLASSES[x.cls].mainStat) : (RACES[x.race].bonus as Stat);
              stats[bonus] += 1;
              return (
                <div class="panel col">
                  <div class="row">
                    <span style={{ fontSize: '2.4rem' }}>{CLASS_ICON[x.cls]}</span>
                    <div>
                      <h2>{x.name || `Player ${i + 1}`}</h2>
                      <div class="muted">
                        {RACES[x.race].name} {CLASSES[x.cls].name} · {BACKGROUNDS[x.background].name}
                      </div>
                    </div>
                  </div>
                  <div class="row wrap">
                    {STATS.map((s) => (
                      <span class="badge gold">
                        {STAT_LABEL[s]} {stats[s]}
                      </span>
                    ))}
                  </div>
                  <div class="small muted">{RACES[x.race].passive}</div>
                  <div class="small muted">{BACKGROUNDS[x.background].perk}</div>
                </div>
              );
            })}
            {player === 1 && (
              <div class="panel tight small" style={{ gridColumn: '1 / 3' }}>
                <strong class="r-legendary">Your combo:</strong> {comboText(drafts[0].cls, drafts[1].cls)}
              </div>
            )}
          </div>
        )}
      </div>

      <div class="row spread">
        <button class="big" onClick={back} disabled={player === 0 && step === 0}>
          ← Back
        </button>
        <div class="row">
          {STEPS.map((_, i) => (
            <span class={`pip ${i <= step ? '' : 'used'}`} />
          ))}
        </div>
        <button class="primary big" onClick={next}>
          {step < 4 ? 'Next →' : player === 0 ? 'Player 2 →' : 'Set out! ⚔️'}
        </button>
      </div>
      {player === 1 && step === 0 && <div class="tiny dim center">{other.name || 'Player 1'} is ready.</div>}
    </div>
  );
}
