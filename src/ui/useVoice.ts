import { useEffect, useState } from 'preact/hooks';
import { voice, type Segment } from '../audio/voice';

const spoken = new Set<string>();

/** Speaks once per key (e.g. once per scene), when the key becomes non-null. */
export function useSay(key: string | null, build: () => Segment[], interrupt = true) {
  useEffect(() => {
    if (!key || spoken.has(key)) return;
    spoken.add(key);
    voice.speak(build(), { interrupt });
  }, [key]);
}

/** Re-renders when the voice engine starts, stops or pauses. */
export function useVoiceState() {
  const [, set] = useState(0);
  useEffect(() => voice.onChange(() => set((v) => v + 1)), []);
  return { speaking: voice.speaking, paused: voice.paused, supported: voice.supported };
}
