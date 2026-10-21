import { useGame } from '../store';
import { Modal } from '../components/bits';
import { exportBackup } from '../../engine/save';

export function Menu({ onClose }: { onClose: () => void }) {
  const { run, quit, settings, setSettings, toast, openSettings, openJournal } = useGame();
  return (
    <Modal title="Menu" onClose={onClose}>
      <div class="col">
        <div class="small muted">
          The game saves after every action (slot {run.slot}). Export a backup to the Files app at the end of each act.
        </div>
        <div class="row wrap">
          <button class={settings.nightMode ? 'selected' : ''} onClick={() => setSettings({ ...settings, nightMode: !settings.nightMode })}>
            🌙 Night driving mode: {settings.nightMode ? 'on' : 'off'}
          </button>
          <button onClick={() => exportBackup().then(toast)}>💾 Export backup</button>
          <button
            onClick={() => {
              onClose();
              openSettings();
            }}
          >
            ⚙️ Settings, API key and cost
          </button>
          {run.narrate && (
            <button
              onClick={() => {
                onClose();
                openJournal();
              }}
            >
              📖 Journal
            </button>
          )}
        </div>
        <div class="card small col" style={{ gap: '4px' }}>
          <strong>Coming in later phases</strong>
          <span class="muted">Map (3) · Voice narration and car mode (5) · Content, companions and unlocks (6)</span>
        </div>
        <div class="row spread">
          <span class="tiny dim">Run seed {run.seed}</span>
          <button class="danger" onClick={quit}>
            Save and quit to title
          </button>
        </div>
      </div>
    </Modal>
  );
}
