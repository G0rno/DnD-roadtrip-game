import { useEffect, useState } from 'preact/hooks';
import type { Run } from '../../engine/types';
import { useGame } from '../store';
import { Backdrop } from '../components/Backdrop';
import { Sprite } from '../components/Sprite';
import { defaultLook } from '../sprites';
import { continueScene, setSceneText } from '../../engine/run';
import { offlineActIntro, offlineBible, offlineEnding, offlineNodeScene, story } from '../../engine/story';
import { aiReady, genActIntro, genBible, genEnding, genNodeScene, lastAiError } from '../../ai/gm';

const inFlight = new Set<string>();

function sceneId(run: Run) {
  return `${run.slot}:${run.seed}:${run.distance}:${run.act}:${run.scene?.kind}`;
}

function offlineText(run: Run) {
  const sc = run.scene!;
  if (sc.kind === 'node' || sc.kind === 'bossIntro') return offlineNodeScene(run, run.currentNode ?? { type: 'fight' });
  if (sc.kind === 'ending') return { title: 'The End of the Road', text: offlineEnding(run), summary: 'The villain fell.' };
  const o = offlineActIntro(run);
  return { ...o, summary: o.text.split('.')[0] };
}

export function Scene() {
  const { run, act, toast } = useGame();
  const sc = run.scene!;
  const [slow, setSlow] = useState(false);
  const [phase, setPhase] = useState('');

  useEffect(() => {
    if (sc.status === 'ready') return;
    const id = sceneId(run);
    if (inFlight.has(id)) return;
    inFlight.add(id);
    setSlow(false);
    const slowTimer = setTimeout(() => setSlow(true), 7000);
    (async () => {
      try {
        if (!aiReady()) {
          if (sc.kind === 'runStart' && !story(run).bible) act((r) => (story(r).bible = offlineBible(r)));
          const o = offlineText(run);
          act((r) => setSceneText(r, o.title, o.text, o.summary));
          return;
        }
        if (sc.kind === 'runStart' && !story(run).bible) {
          setPhase('Inventing a world, a villain and four lieutenants...');
          const b = await genBible(run);
          act((r) => (story(r).bible = b));
          if (b.source === 'offline') toast(`AI unavailable (${lastAiError() || 'no answer'}). Using an offline story.`);
        }
        setPhase(sc.kind === 'runStart' ? 'Writing the opening...' : 'The Game Master is writing...');
        const t = sc.kind === 'node' || sc.kind === 'bossIntro' ? await genNodeScene(run, run.currentNode ?? { type: 'fight' }) : sc.kind === 'ending' ? await genEnding(run) : await genActIntro(run);
        act((r) => {
          if (r.scene && r.scene.status !== 'ready') setSceneText(r, t.title, t.text, t.summary);
        });
      } finally {
        clearTimeout(slowTimer);
        inFlight.delete(id);
      }
    })();
  }, [sc.status, sc.kind, run.distance]);

  const skip = () => {
    if (sc.kind === 'runStart' && !story(run).bible) act((r) => (story(r).bible = offlineBible(r)));
    const o = offlineText(run);
    act((r) => setSceneText(r, o.title, o.text, o.summary));
  };

  const region = run.regions[Math.min(run.act, 4) - 1];
  const kindLabel = { runStart: 'A new saga', actIntro: `Act ${run.act}`, node: 'On the road', bossIntro: 'Act boss', ending: 'Epilogue' }[sc.kind];

  return (
    <div class="screen" style={{ padding: 0, gap: 0 }}>
      <div class="scene" style={{ flex: '0 0 42%' }}>
        <Backdrop region={region} night={run.isNight || region === 'underdark'} />
        <div style={{ position: 'absolute', left: '50%', bottom: '10%', transform: 'translateX(-50%)', display: 'flex', gap: '40px', alignItems: 'flex-end' }}>
          {run.heroes.map((h) => (
            <div class="col" style={{ alignItems: 'center', gap: '4px' }}>
              {h.dead ? <div style={{ fontSize: '46px' }}>🪦</div> : <Sprite name={h.look ?? defaultLook(h.cls)} scale={5} />}
              <span class="badge">{h.name}</span>
            </div>
          ))}
        </div>
        <div class="scene-banner">{kindLabel}</div>
      </div>
      <div class="col grow" style={{ padding: '18px 28px', minHeight: 0 }}>
        {sc.status !== 'ready' ? (
          <div class="col grow" style={{ alignItems: 'center', justifyContent: 'center' }}>
            <div class="dice">
              <div class="die rolling">✒️</div>
            </div>
            <div class="muted">{phase || 'The Game Master is writing...'}</div>
            {slow && (
              <button onClick={skip}>
                Taking a while. Use a short version instead
              </button>
            )}
          </div>
        ) : (
          <>
            <h2>{sc.title}</h2>
            <div class="grow scroll storytext">{sc.text}</div>
            <div class="row" style={{ justifyContent: 'flex-end' }}>
              <button class="primary big" onClick={() => act(continueScene)}>
                {sc.next === 'enterNode' ? 'Continue →' : sc.next === 'victory' ? 'Finish' : 'Onward →'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
