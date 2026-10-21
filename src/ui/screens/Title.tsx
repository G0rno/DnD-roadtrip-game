import { useState } from 'preact/hooks';
import type { Run } from '../../engine/types';
import { deleteRun, exportBackup, loadMeta, loadRun, restoreBackup, saveMeta, saveRun, slotSummaries, type Settings } from '../../engine/save';
import { newRun } from '../../engine/run';
import { Modal } from '../components/bits';

interface Props {
  onOpen: (run: Run, resumed: boolean) => void;
  openSettings?: () => void;
  settings: Settings;
  setSettings: (s: Settings) => void;
  toast: (m: string) => void;
}

export function Title({ onOpen, settings, setSettings, toast, openSettings }: Props) {
  const [, refresh] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [showHall, setShowHall] = useState(false);
  const slots = slotSummaries();
  const meta = loadMeta();

  const start = (slot: number) => {
    const run = newRun(slot, undefined, true);
    saveRun(run);
    meta.runsStarted += 1;
    saveMeta(meta);
    onOpen(run, false);
  };

  const importFile = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      const res = restoreBackup(text);
      toast(res.message);
      refresh((v) => v + 1);
      input.value = '';
    });
  };

  return (
    <div class="screen" style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div class="center col" style={{ gap: '4px', marginBottom: '8px' }}>
        <div style={{ fontSize: '3rem' }}>🎲</div>
        <h1>Roadtrip RPG</h1>
        <div class="muted">A two-player co-op adventure for the long road</div>
      </div>

      <div class="grid3" style={{ width: 'min(1100px, 100%)' }}>
        {slots.map((s) => (
          <div class="panel col" style={{ minHeight: '190px' }}>
            <div class="row spread">
              <h3>Slot {s.slot}</h3>
              {!s.empty && (
                <button class="small ghost" onClick={() => setConfirmDelete(s.slot)}>
                  🗑
                </button>
              )}
            </div>
            {s.empty ? (
              <div class="grow muted">Empty</div>
            ) : (
              <div class="grow">
                <div>{s.title}</div>
                {s.detail && <div class="small muted">{s.detail}</div>}
                {s.updatedAt && <div class="tiny dim">Saved {new Date(s.updatedAt).toLocaleString()}</div>}
              </div>
            )}
            {s.empty ? (
              <button class="primary big" onClick={() => start(s.slot)}>
                New adventure
              </button>
            ) : (
              <button
                class="primary big"
                disabled={s.broken}
                onClick={() => {
                  const run = loadRun(s.slot);
                  if (run) onOpen(run, true);
                  else toast('This save could not be read.');
                }}
              >
                Continue
              </button>
            )}
          </div>
        ))}
      </div>

      <div class="row wrap" style={{ justifyContent: 'center' }}>
        <button onClick={() => setShowHall(true)}>🏆 Hall of fame</button>
        <button onClick={openSettings}>⚙️ Settings and API key</button>
        <button onClick={() => exportBackup().then(toast)}>💾 Export backup</button>
        <label>
          <span class="badge" style={{ minHeight: '48px', padding: '0 16px', borderRadius: '9px', cursor: 'pointer', fontSize: '1rem', background: 'linear-gradient(180deg, #3a3240, #2a242f)', borderColor: 'var(--line2)' }}>
            📂 Import backup
          </span>
          <input type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={importFile} />
        </label>
        <button class={settings.nightMode ? 'selected' : ''} onClick={() => setSettings({ ...settings, nightMode: !settings.nightMode })}>
          🌙 Night mode {settings.nightMode ? 'on' : 'off'}
        </button>
      </div>
      <div class="tiny dim">Saves stay on this iPad. Export a backup to the Files app now and then. · v0.4 (Phase 4: AI Game Master)</div>

      {confirmDelete !== null && (
        <Modal title={`Delete slot ${confirmDelete}?`} onClose={() => setConfirmDelete(null)}>
          <div>This run will be gone for good (unless you have a backup).</div>
          <div class="row">
            <button
              class="danger"
              onClick={() => {
                deleteRun(confirmDelete);
                setConfirmDelete(null);
                refresh((v) => v + 1);
              }}
            >
              Delete
            </button>
            <button onClick={() => setConfirmDelete(null)}>Keep it</button>
          </div>
        </Modal>
      )}

      {showHall && (
        <Modal title="Hall of fame" onClose={() => setShowHall(false)}>
          <div class="small muted">
            Runs started: {meta.runsStarted} · Furthest: {meta.bestDistance * 10} leagues
          </div>
          <div class="col scroll" style={{ maxHeight: '60vh' }}>
            {meta.hall.length === 0 && <div class="muted">No finished runs yet.</div>}
            {meta.hall.map((h, i) => (
              <div class="card row spread">
                <span>
                  #{i + 1} {h.names} <span class="muted small">({h.classes})</span>
                </span>
                <span class="small">
                  {h.outcome === 'victory' ? '👑' : '💀'} {h.distance * 10} leagues · {h.bosses} bosses · {h.score} pts
                </span>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
