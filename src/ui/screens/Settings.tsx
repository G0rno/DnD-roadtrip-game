import { useState } from 'preact/hooks';
import type { Run } from '../../engine/types';
import type { Settings as S } from '../../engine/save';
import { loadMeta } from '../../engine/save';
import { Modal } from '../components/bits';
import { getApiKey, setApiKey, testKey } from '../../ai/client';
import { sessionCost } from '../../ai/gm';

const usd = (n: number) => `$${n.toFixed(n < 1 ? 3 : 2)}`;

export function SettingsModal({ settings, setSettings, run, onClose }: { settings: S; setSettings: (s: S) => void; run?: Run | null; onClose: () => void }) {
  const [key, setKey] = useState(getApiKey());
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState('');
  const meta = loadMeta();
  const runCost = run?.story?.cost;

  const saveKey = () => {
    setApiKey(key);
    setStatus(key ? 'Key saved on this device.' : 'Key removed.');
  };
  const test = async () => {
    setApiKey(key);
    setStatus('Testing...');
    try {
      setStatus(await testKey());
    } catch (e) {
      setStatus(`Failed: ${(e as Error).message}`);
    }
  };

  return (
    <Modal title="Settings" onClose={onClose}>
      <div class="scroll col" style={{ maxHeight: '72vh' }}>
        <div class="card col" style={{ gap: '8px' }}>
          <strong>🤖 AI Game Master</strong>
          <div class="small muted">
            Paste your Anthropic API key (from console.anthropic.com). It is stored only on this iPad, never in backups or in the game's code. Without a key, or without signal, the game uses pre-written scenes and templates.
          </div>
          <div class="row">
            <input type={show ? 'text' : 'password'} class="grow" value={key} placeholder="sk-ant-..." onInput={(e) => setKey((e.target as HTMLInputElement).value)} autocomplete="off" />
            <button class="small" onClick={() => setShow(!show)}>
              {show ? 'Hide' : 'Show'}
            </button>
          </div>
          <div class="row">
            <button class="primary" onClick={saveKey}>
              Save key
            </button>
            <button onClick={test}>Test connection</button>
            <span class="small">{status}</span>
          </div>
        </div>

        <div class="card col" style={{ gap: '8px' }}>
          <strong>Narration</strong>
          <div class="row">
            <span class="small">Language:</span>
            <button class={settings.narrationLang === 'en' ? 'selected' : ''} onClick={() => setSettings({ ...settings, narrationLang: 'en' })}>
              English
            </button>
            <button class={settings.narrationLang === 'fr' ? 'selected' : ''} onClick={() => setSettings({ ...settings, narrationLang: 'fr' })}>
              Français
            </button>
          </div>
          <div class="tiny dim">Applies to new scenes. The interface stays in English.</div>
        </div>

        <div class="card col" style={{ gap: '8px' }}>
          <strong>💲 Cost</strong>
          <div class="small">
            This session: <strong>{usd(sessionCost())}</strong>
            {runCost && (
              <>
                {' '}
                · This run: <strong>{usd(runCost.usd)}</strong> (Haiku {usd(runCost.haikuUsd)}, Sonnet {usd(runCost.sonnetUsd)}, {runCost.calls} calls)
              </>
            )}
            {' '}
            · All time on this iPad: <strong>{usd(meta.aiCost?.usd ?? 0)}</strong>
          </div>
          <div class="row wrap">
            <button class={settings.budgetMode ? 'selected' : ''} onClick={() => setSettings({ ...settings, budgetMode: !settings.budgetMode })}>
              Budget mode (Haiku only): {settings.budgetMode ? 'on' : 'off'}
            </button>
            <span class="small">Warn when a run passes</span>
            <input type="number" style={{ width: '90px' }} value={settings.budgetWarnUsd} min={1} onInput={(e) => setSettings({ ...settings, budgetWarnUsd: Number((e.target as HTMLInputElement).value) || 5 })} />
            <span class="small">dollars</span>
          </div>
          <div class="tiny dim">Hard cap: the spending limit you set in the Anthropic Console.</div>
        </div>

        <div class="card col" style={{ gap: '8px' }}>
          <strong>Display</strong>
          <div class="row wrap">
            <button class={settings.nightMode ? 'selected' : ''} onClick={() => setSettings({ ...settings, nightMode: !settings.nightMode })}>
              🌙 Night driving mode: {settings.nightMode ? 'on' : 'off'}
            </button>
            <button class={settings.fastCombat ? 'selected' : ''} onClick={() => setSettings({ ...settings, fastCombat: !settings.fastCombat })}>
              ⏩ Fast enemy turns: {settings.fastCombat ? 'on' : 'off'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
