import { useState } from 'preact/hooks';
import { useGame } from '../store';
import { Modal } from '../components/bits';
import { story } from '../../engine/story';

type Tab = 'story' | 'chronicle' | 'people' | 'choices';

export function Journal({ onClose }: { onClose: () => void }) {
  const { run } = useGame();
  const [tab, setTab] = useState<Tab>('chronicle');
  const s = story(run);
  const b = s.bible;

  return (
    <Modal title={b ? `📖 ${b.title}` : '📖 Journal'} onClose={onClose}>
      <div class="tabbar">
        {(['chronicle', 'story', 'people', 'choices'] as Tab[]).map((t) => (
          <button class={tab === t ? 'selected' : ''} onClick={() => setTab(t)}>
            {{ chronicle: 'Chronicle', story: 'The quest', people: 'People', choices: 'Choices' }[t]}
          </button>
        ))}
      </div>
      <div class="scroll col" style={{ maxHeight: '64vh', gap: '10px' }}>
        {tab === 'chronicle' &&
          (s.journal.length === 0 ? (
            <div class="muted">Nothing written yet.</div>
          ) : (
            [...s.journal].reverse().map((j) => (
              <div class="card col" style={{ gap: '4px' }}>
                <div class="row spread">
                  <strong>{j.title}</strong>
                  <span class="tiny muted">
                    Act {j.act} · {j.distance * 10} leagues
                  </span>
                </div>
                <div class="small storytext" style={{ fontSize: '0.98rem' }}>
                  {j.text}
                </div>
              </div>
            ))
          ))}

        {tab === 'story' && b && (
          <>
            <div class="card col" style={{ gap: '6px' }}>
              <div class="small muted">
                {b.setting} · {b.tone}
              </div>
              <div class="storytext" style={{ fontSize: '1rem' }}>
                {b.world}
              </div>
            </div>
            <div class="card col" style={{ gap: '4px' }}>
              <strong class="r-legendary">
                {b.villain.name}, {b.villain.title}
              </strong>
              <div class="small">{b.villain.description}</div>
              <div class="small muted">Wants: {b.villain.motive}</div>
            </div>
            {b.acts
              .filter((a) => a.act <= run.act)
              .map((a) => {
                const lt = b.lieutenants.find((l) => l.act === a.act);
                return (
                  <div class="card col" style={{ gap: '4px' }}>
                    <strong>
                      Act {a.act}: {a.title} {a.act < run.act ? '✓' : ''}
                    </strong>
                    <div class="small">{a.hook}</div>
                    {lt && (
                      <div class="small muted">
                        Lieutenant: {lt.name}, {lt.title}
                        {a.act < run.act ? ' (defeated)' : ''}
                      </div>
                    )}
                  </div>
                );
              })}
          </>
        )}
        {tab === 'story' && !b && <div class="muted">The story hasn't been written yet.</div>}

        {tab === 'people' && (
          <>
            {s.npcsMet.length === 0 && <div class="muted">No one memorable yet.</div>}
            {s.npcsMet.map((n) => (
              <div class="card">
                <strong>{n.name}</strong> <span class="muted small">{n.role}</span>
                <div class="small">{n.note}</div>
              </div>
            ))}
          </>
        )}

        {tab === 'choices' && (
          <>
            {s.flags.length === 0 && <div class="muted">No hard choices made yet. The story remembers the ones you make.</div>}
            {s.flags.map((f) => (
              <div class="card small">
                Act {f.act}: {f.text}
              </div>
            ))}
          </>
        )}
      </div>
    </Modal>
  );
}
