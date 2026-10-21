import { useGame } from '../store';
import { voice } from '../../audio/voice';
import { useVoiceState } from '../useVoice';

/** Narration controls: voice on/off, pause, repeat, skip, screen off. */
export function AudioBar() {
  const { settings, setSettings, screenOff } = useGame();
  const st = useVoiceState();
  if (!st.supported) return null;
  return (
    <span class="audiobar">
      <button
        class={`small ${settings.voiceOn ? 'selected' : ''}`}
        title="Voice narration"
        onClick={() => {
          if (settings.voiceOn) voice.stop();
          setSettings({ ...settings, voiceOn: !settings.voiceOn });
        }}
      >
        {settings.voiceOn ? '🔊' : '🔇'}
      </button>
      {settings.voiceOn && (
        <>
          <button class="small" title={st.paused ? 'Resume' : 'Pause'} disabled={!st.speaking && !st.paused} onClick={() => (st.paused ? voice.resume() : voice.pause())}>
            {st.paused ? '▶️' : '⏸️'}
          </button>
          <button class="small" title="Skip" disabled={!st.speaking} onClick={() => voice.stop()}>
            ⏭️
          </button>
          <button class="small" title="Repeat" onClick={() => voice.repeat()}>
            🔁
          </button>
        </>
      )}
      <button class="small" title="Screen off (audio keeps playing)" onClick={screenOff}>
        🌑
      </button>
    </span>
  );
}
