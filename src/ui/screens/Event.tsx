import { useEffect, useState } from 'preact/hooks';
import type { Run } from '../../engine/types';
import { useGame } from '../store';
import { TopBar } from '../components/TopBar';
import { STAT_LABEL, pct, CLASS_ICON } from '../components/bits';
import { checkOdds, DIFFICULTY_LABEL } from '../../engine/checks';
import { addFreeTextOption, eventAccept, eventDone, eventReroll, eventRoll, setEventDraft, setEventNarration } from '../../engine/run';
import { offlineEvent, EVENT_TYPES, type EventType } from '../../engine/story';
import { aiReady, genEvent, genOutcome, mapFreeText } from '../../ai/gm';

const TIER_TEXT = { great: 'Great success!', success: 'Success', partial: 'Partial success', failure: 'Failure', bad: 'Bad failure' };
const inFlight = new Set<string>();

function evId(run: Run, what: string) {
  return `${run.slot}:${run.seed}:${run.distance}:${what}`;
}

export function EventScreen() {
  const { run, act, settings, toast } = useGame();
  const ev = run.event!;
  const [rolling, setRolling] = useState(false);
  const [fake, setFake] = useState<[number, number]>([1, 1]);
  const [idea, setIdea] = useState('');
  const [thinking, setThinking] = useState(false);
  const [refusal, setRefusal] = useState('');

  // Write the event scene.
  useEffect(() => {
    if (ev.status !== 'pending') return;
    const id = evId(run, 'event');
    if (inFlight.has(id)) return;
    inFlight.add(id);
    (async () => {
      const type = (ev.type ?? 'social') as EventType;
      const d = aiReady() ? await genEvent(run, type) : offlineEvent(run, type);
      act((r) => setEventDraft(r, d));
      inFlight.delete(id);
    })();
  }, [ev.status]);

  // Narrate the outcome.
  useEffect(() => {
    if (!ev.outcomeText || ev.outcomeNarrated || !run.narrate || !aiReady()) return;
    const id = evId(run, 'outcome');
    if (inFlight.has(id)) return;
    inFlight.add(id);
    (async () => {
      const text = await genOutcome(run);
      if (text) act((r) => setEventNarration(r, text));
      else act((r) => r.event && (r.event.outcomeNarrated = true));
      inFlight.delete(id);
    })();
  }, [ev.outcomeText]);

  useEffect(() => {
    if (!rolling) return;
    const iv = setInterval(() => setFake([1 + Math.floor(Math.random() * 10), 1 + Math.floor(Math.random() * 10)]), 70);
    const t = setTimeout(() => setRolling(false), 850);
    return () => {
      clearInterval(iv);
      clearTimeout(t);
    };
  }, [rolling]);

  const roll = (fn: () => void, animate = true) => {
    act(fn);
    setRolling(animate && !settings.nightMode);
  };

  const submitIdea = async () => {
    if (!idea.trim()) return;
    setThinking(true);
    setRefusal('');
    try {
      const r = await mapFreeText(run, idea);
      if (!r.possible) setRefusal(r.reason || "That isn't possible here.");
      else {
        act((x) => addFreeTextOption(x, r.label || idea.slice(0, 40), r.stat, r.difficulty));
        setIdea('');
      }
    } catch {
      toast('The Game Master could not answer (no signal or no API key). Pick one of the choices.');
    }
    setThinking(false);
  };

  const res = ev.result;
  const hero = res && run.heroes.find((h) => h.id === res.heroId)!;
  const typeName = ev.type ? EVENT_TYPES[ev.type as EventType]?.name : undefined;

  if (ev.status === 'pending') {
    return (
      <>
        <TopBar title="Event" />
        <div class="screen" style={{ alignItems: 'center', justifyContent: 'center' }}>
          <div class="dice">
            <div class="die rolling">✒️</div>
          </div>
          <div class="muted">The Game Master is setting the scene...</div>
          <button class="small" onClick={() => act((r) => setEventDraft(r, offlineEvent(r, (ev.type ?? 'social') as EventType)))}>
            Skip: use a short version
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title={typeName ?? 'Event'} />
      <div class="screen">
        <div class="panel col" style={{ maxWidth: '980px', margin: '0 auto', width: '100%', gap: '8px' }}>
          <div class="row spread">
            <h2>{ev.title}</h2>
            {ev.npc && (
              <span class="badge gold">
                👤 {ev.npc.name}, {ev.npc.role}
              </span>
            )}
          </div>
          <div class="storytext" style={{ maxHeight: res ? '120px' : '230px', overflowY: 'auto' }}>
            {ev.text}
          </div>
        </div>

        {!res && (
          <div class="col grow scroll" style={{ maxWidth: '980px', margin: '0 auto', width: '100%' }}>
            {ev.options.map((o, i) => (
              <div class={`card col ${o.freeText ? 'selected' : ''}`} style={{ gap: '8px' }}>
                <div class="row spread">
                  <strong>
                    {o.freeText ? '💡 ' : ''}
                    {o.label}
                  </strong>
                  <span class="badge">{o.stat === 'none' ? 'No roll' : `${STAT_LABEL[o.stat]} · ${o.difficulty ? DIFFICULTY_LABEL[o.difficulty] : ''} (${o.dc})`}</span>
                </div>
                <div class="grid2">
                  {run.heroes.map((h) => {
                    if (o.stat === 'none')
                      return (
                        <button disabled={h.dead} onClick={() => roll(() => eventRoll(run, h.id, i), false)}>
                          {CLASS_ICON[h.cls]} {h.name} chooses this
                        </button>
                      );
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
            {run.narrate && (
              <div class="card col" style={{ gap: '6px' }}>
                <strong>💬 Something else</strong>
                <div class="row">
                  <input
                    class="grow textin"
                    value={idea}
                    placeholder="Describe what you want to try..."
                    onInput={(e) => setIdea((e.target as HTMLInputElement).value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitIdea()}
                  />
                  <button disabled={thinking || !idea.trim()} onClick={submitIdea}>
                    {thinking ? 'Asking the GM...' : 'Propose'}
                  </button>
                </div>
                {refusal && <div class="small" style={{ color: '#f0a39c' }}>GM: {refusal}</div>}
                <div class="tiny dim">The Game Master turns your idea into a check (stat + difficulty) and adds it as a choice. Needs signal.</div>
              </div>
            )}
          </div>
        )}

        {res && hero && (
          <div class="col grow" style={{ alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
            <div class="muted">
              {hero.name}: {ev.options[ev.chosen!].label}
              {!res.noRoll && ` (${STAT_LABEL[res.stat]})`}
            </div>
            {!res.noRoll && (
              <div class="dice">
                <div class={`die ${rolling ? 'rolling' : ''}`}>{rolling ? fake[0] : res.dice[0]}</div>
                <div class={`die ${rolling ? 'rolling' : ''}`}>{rolling ? fake[1] : res.dice[1]}</div>
              </div>
            )}
            {!rolling && (
              <>
                {!res.noRoll && (
                  <div style={{ fontSize: '1.2rem' }}>
                    {res.dice[0]} + {res.dice[1]} {res.bonus >= 0 ? '+' : '−'} {Math.abs(res.bonus)} = <strong>{res.total}</strong> vs {res.dc}
                  </div>
                )}
                {!res.noRoll && <div class="banner">{TIER_TEXT[res.tier]}</div>}
                {ev.outcomeText && (
                  <div class="panel storytext scroll" style={{ maxWidth: '860px', maxHeight: '220px' }}>
                    {ev.outcomeText}
                    {ev.outcomeNarrated && ev.outcomeFacts && <div class="small muted" style={{ marginTop: '8px', fontStyle: 'normal' }}>📜 {ev.outcomeFacts}</div>}
                    {run.narrate && !ev.outcomeNarrated && aiReady() && <div class="tiny dim">The Game Master is narrating...</div>}
                  </div>
                )}
                {!ev.outcomeText && (
                  <div class="row">
                    {(res.tier === 'failure' || res.tier === 'partial' || res.tier === 'bad') && !res.noRoll && (
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
