import { useEffect, useState } from 'preact/hooks';
import { useGame } from '../store';
import { TopBar } from '../components/TopBar';
import { STAT_LABEL, pct, CLASS_ICON } from '../components/bits';
import { checkOdds } from '../../engine/checks';
import { eventAccept, eventDone, eventReroll, eventRoll } from '../../engine/run';

const TIER_TEXT = { critical: 'Critical success!', success: 'Success', partial: 'Partial success', failure: 'Failure' };

export function EventScreen() {
  const { run, act, settings } = useGame();
  const ev = run.event!;
  const [rolling, setRolling] = useState(false);
  const [fake, setFake] = useState<[number, number]>([1, 1]);

  useEffect(() => {
    if (!rolling) return;
    const iv = setInterval(() => setFake([1 + Math.floor(Math.random() * 10), 1 + Math.floor(Math.random() * 10)]), 70);
    const t = setTimeout(() => setRolling(false), 850);
    return () => {
      clearInterval(iv);
      clearTimeout(t);
    };
  }, [rolling]);

  const roll = (fn: () => void) => {
    act(fn);
    setRolling(!settings.nightMode);
  };

  const res = ev.result;
  const hero = res && run.heroes.find((h) => h.id === res.heroId)!;

  return (
    <>
      <TopBar title="Event" />
      <div class="screen">
        <div class="panel col" style={{ maxWidth: '900px', margin: '0 auto', width: '100%' }}>
          <h2>{ev.title}</h2>
          <div style={{ fontSize: '1.15rem', lineHeight: 1.45 }}>{ev.text}</div>
        </div>

        {!res && (
          <div class="col grow scroll" style={{ maxWidth: '900px', margin: '0 auto', width: '100%' }}>
            {ev.options.map((o, i) => (
              <div class="card col" style={{ gap: '8px' }}>
                <div class="row spread">
                  <strong>{o.label}</strong>
                  <span class="badge">
                    {STAT_LABEL[o.stat]} check · difficulty {o.dc}
                  </span>
                </div>
                <div class="grid2">
                  {run.heroes.map((h) => {
                    const odds = checkOdds(run, h, o.stat, o.dc);
                    return (
                      <button disabled={h.dead} onClick={() => roll(() => eventRoll(run, h.id, i))}>
                        {CLASS_ICON[h.cls]} {h.name} (2d10 {odds.bonus >= 0 ? '+' : ''}
                        {odds.bonus}): <strong>{pct(odds.success)}</strong> success · {pct(odds.partial)} partial
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div class="tiny dim center">Template event. In Phase 4 the AI Game Master writes these, with free-text actions.</div>
          </div>
        )}

        {res && hero && (
          <div class="col grow" style={{ alignItems: 'center', justifyContent: 'center' }}>
            <div class="muted">
              {hero.name} tries: {ev.options[ev.chosen!].label} ({STAT_LABEL[res.stat]})
            </div>
            <div class="dice">
              <div class={`die ${rolling ? 'rolling' : ''}`}>{rolling ? fake[0] : res.dice[0]}</div>
              <div class={`die ${rolling ? 'rolling' : ''}`}>{rolling ? fake[1] : res.dice[1]}</div>
            </div>
            {!rolling && (
              <>
                <div style={{ fontSize: '1.3rem' }}>
                  {res.dice[0]} + {res.dice[1]} {res.bonus >= 0 ? '+' : '−'} {Math.abs(res.bonus)} = <strong>{res.total}</strong> vs {res.dc}
                </div>
                <div class="banner">{TIER_TEXT[res.tier]}</div>
                {ev.outcomeText && <div class="panel" style={{ maxWidth: '800px' }}>{ev.outcomeText}</div>}
                {!ev.outcomeText && (
                  <div class="row">
                    {(res.tier === 'failure' || res.tier === 'partial') && (
                      <button disabled={run.rerollTokens <= 0} onClick={() => roll(() => eventReroll(run))}>
                        🎲 Use a reroll token ({run.rerollTokens} left)
                      </button>
                    )}
                    <button class="primary big" onClick={() => act(eventAccept)}>
                      Accept
                    </button>
                  </div>
                )}
                {ev.outcomeText && (
                  <button class="primary big" onClick={() => act(eventDone)}>
                    Continue →
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
