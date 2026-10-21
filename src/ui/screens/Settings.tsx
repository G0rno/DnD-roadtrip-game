import { useState } from 'preact/hooks';
import type { Run } from '../../engine/types';
import type { Settings as S } from '../../engine/save';
import { loadMeta } from '../../engine/save';
import { Modal } from '../components/bits';
import { getApiKey, setApiKey, testKey } from '../../ai/client';
import { sessionCost } from '../../ai/gm';
import { voice } from '../../audio/voice';
import { wakeLockSupported } from '../../audio/wake';

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
          <strong>🔊 Voice narration</strong>
          {!voice.supported && <div class="small" style={{ color: '#f0a39c' }}>This browser has no speech support.</div>}
          <div class="row wrap">
            <button class={settings.voiceOn ? 'selected' : ''} onClick={() => setSettings({ ...settings, voiceOn: !settings.voiceOn })}>
              Narration: {settings.voiceOn ? 'on' : 'off'}
            </button>
            <button class={settings.verbosity === 'brief' ? 'selected' : ''} onClick={() => setSettings({ ...settings, verbosity: 'brief' })}>
              Brief combat
            </button>
            <button class={settings.verbosity === 'detailed' ? 'selected' : ''} onClick={() => setSettings({ ...settings, verbosity: 'detailed' })}>
              Detailed combat
            </button>
            <button class={settings.npcVoices ? 'selected' : ''} onClick={() => setSettings({ ...settings, npcVoices: !settings.npcVoices })}>
              Character voices: {settings.npcVoices ? 'on' : 'off'}
            </button>
          </div>
          <div class="row wrap">
            <span class="small">Speed</span>
            <input type="range" min={0.8} max={1.3} step={0.05} value={settings.voiceRate} onInput={(e) => setSettings({ ...settings, voiceRate: Number((e.target as HTMLInputElement).value) })} style={{ width: '220px' }} />
            <span class="small">{settings.voiceRate.toFixed(2)}×</span>
            <span class="small" style={{ marginLeft: '12px' }}>Narrator</span>
            <select
              value={settings.narratorVoice}
              onChange={(e) => setSettings({ ...settings, narratorVoice: (e.target as HTMLSelectElement).value })}
              style={{ minHeight: '42px', borderRadius: '8px', background: '#141116', color: 'var(--text)', border: '1px solid var(--line2)', padding: '0 8px', maxWidth: '300px' }}
            >
              <option value="">Best available</option>
              {voice.candidates(settings.narrationLang).map((v) => (
                <option value={v.voiceURI}>
                  {v.name} ({v.lang}){/premium/i.test(v.name + v.voiceURI) ? ' · Premium' : /enhanced/i.test(v.name + v.voiceURI) ? ' · Enhanced' : ''}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                voice.enabled = true;
                voice.unlock();
                const fr = settings.narrationLang === 'fr';
                voice.speak(
                  [
                    { role: 'narrator', text: fr ? 'La route s’enfonce dans la forêt. Quelque chose bouge entre les arbres.' : 'The road winds into the forest. Something moves between the trees.' },
                    { role: 'npc', name: 'Odile', text: fr ? 'Vous n’êtes pas d’ici, vous deux.' : "You two aren't from around here." },
                    { role: 'villain', name: 'Villain', text: fr ? 'Courez. Ça rend la chasse plus amusante.' : 'Run. It makes the hunt more fun.' },
                  ],
                  { interrupt: true },
                );
              }}
            >
              ▶️ Test voices
            </button>
          </div>
          <div class="row wrap">
            <button class={settings.keepAwake ? 'selected' : ''} onClick={() => setSettings({ ...settings, keepAwake: !settings.keepAwake })}>
              Keep screen awake: {settings.keepAwake ? 'on' : 'off'}
            </button>
            {!wakeLockSupported() && <span class="tiny" style={{ color: '#f0a39c' }}>Not supported here: set iPad Auto-Lock to Never while playing.</span>}
          </div>
          <div class="tiny dim">
            For the best voices, download Enhanced or Premium voices (English and French) on the iPad: Settings → Accessibility → Spoken Content → Voices. They work offline. Use 🌑 in the top bar to black out the screen while audio keeps playing.
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
