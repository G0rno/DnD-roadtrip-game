// Speech engine on the iPad's built-in voices (Web Speech API): free, works offline.
// One narrator, NPC voice variants and a villain voice. Speaks one chunk at a time from its own queue,
// which is more reliable on iPad Safari than handing it a long queue.

export type Role = 'narrator' | 'npc' | 'villain' | 'system';

export interface Segment {
  text: string;
  role: Role;
  /** Speaker name, used to give each NPC a consistent voice. */
  name?: string;
}

export interface VoiceSettings {
  lang: 'en' | 'fr';
  rate: number;
  narratorVoice: string;
  npcVoices: boolean;
}

interface Chunk {
  text: string;
  voice?: SpeechSynthesisVoice;
  lang: string;
  rate: number;
  pitch: number;
  done?: () => void;
}

// Novelty and "Eloquence" voices on Apple devices sound robotic or silly; never pick them automatically.
const EXCLUDE = /albert|bad news|bahh|bells|boing|bubbles|cellos|wobble|good news|jester|junior|organ|superstar|trinoids|whisper|zarvox|ralph|kathy|fred|eddy|flo\b|grandma|grandpa|reed|rocko|sandy|shelley/i;
const MALE = /daniel|alex|aaron|arthur|gordon|thomas|nicolas|oliver|tom\b|evan|nathan|rishi|lee\b|felix|jacques|guillaume/i;

function quality(v: SpeechSynthesisVoice): number {
  const n = `${v.name} ${v.voiceURI}`.toLowerCase();
  let q = 1;
  if (n.includes('premium')) q = 3;
  else if (n.includes('enhanced') || n.includes('neural')) q = 2;
  if (v.localService) q += 0.3;
  return q;
}

function hash(s: string): number {
  let h = 7;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

/** Splits text into sentence groups of at most ~220 characters. */
export function chunkText(text: string): string[] {
  const sentences = text.replace(/\s+/g, ' ').trim().match(/[^.!?…]+[.!?…]+["”»]?|\S[^.!?…]*$/g) ?? [text];
  const out: string[] = [];
  let cur = '';
  for (const s of sentences) {
    const t = s.trim();
    if (!t) continue;
    if ((cur + ' ' + t).length > 220 && cur) {
      out.push(cur);
      cur = t;
    } else cur = cur ? `${cur} ${t}` : t;
  }
  if (cur) out.push(cur);
  return out;
}

type Listener = () => void;

class VoiceEngine {
  private voices: SpeechSynthesisVoice[] = [];
  private queue: Chunk[] = [];
  private current: Chunk | null = null;
  private watchdog: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<Listener>();
  private lastBatch: Segment[] = [];
  private unlocked = false;
  settings: VoiceSettings = { lang: 'en', rate: 1, narratorVoice: '', npcVoices: true };
  enabled = true;
  paused = false;

  get supported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  }

  init() {
    if (!this.supported) return;
    const load = () => {
      this.voices = speechSynthesis.getVoices();
      this.emit();
    };
    load();
    speechSynthesis.addEventListener?.('voiceschanged', load);
    // iPad Safari only allows speech after a user gesture: unlock on the first tap.
    const unlock = () => {
      this.unlock();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('touchend', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('touchend', unlock);
  }

  unlock() {
    if (!this.supported || this.unlocked) return;
    this.unlocked = true;
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
  }

  onChange(l: Listener) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  get speaking(): boolean {
    return !!this.current || this.queue.length > 0;
  }

  /** Voices for the narration language, best first. */
  candidates(lang = this.settings.lang): SpeechSynthesisVoice[] {
    const pref = lang === 'fr' ? ['fr-CA', 'fr-FR', 'fr'] : ['en-US', 'en-GB', 'en-AU', 'en-IE', 'en'];
    return this.voices
      .filter((v) => v.lang.toLowerCase().startsWith(lang) && !EXCLUDE.test(v.name))
      .sort((a, b) => {
        const q = quality(b) - quality(a);
        if (q) return q;
        const pa = pref.findIndex((p) => a.lang.startsWith(p));
        const pb = pref.findIndex((p) => b.lang.startsWith(p));
        return (pa < 0 ? 9 : pa) - (pb < 0 ? 9 : pb);
      });
  }

  narrator(): SpeechSynthesisVoice | undefined {
    const c = this.candidates();
    return c.find((v) => v.voiceURI === this.settings.narratorVoice) ?? c[0];
  }

  private voiceFor(seg: Segment): { voice?: SpeechSynthesisVoice; pitch: number; rate: number } {
    const nar = this.narrator();
    const others = this.candidates().filter((v) => v !== nar);
    if (seg.role === 'villain') {
      const deep = others.find((v) => MALE.test(v.name)) ?? others[0];
      return { voice: this.settings.npcVoices ? (deep ?? nar) : nar, pitch: deep ? 0.75 : 0.65, rate: 0.9 };
    }
    if (seg.role === 'npc' && this.settings.npcVoices) {
      const h = hash(seg.name ?? seg.text);
      const pitches = [1.12, 0.9, 1.22, 0.96, 1.05];
      if (others.length) return { voice: others[h % Math.min(others.length, 4)], pitch: pitches[h % pitches.length], rate: 1 };
      return { voice: nar, pitch: pitches[h % pitches.length], rate: 1 };
    }
    if (seg.role === 'system') return { voice: nar, pitch: 1, rate: 1.08 };
    return { voice: nar, pitch: 1, rate: 1 };
  }

  /** Queues segments; resolves when they've been spoken (or skipped). */
  speak(segments: Segment[], opts: { interrupt?: boolean } = {}): Promise<void> {
    const segs = segments.filter((s) => s.text && s.text.trim());
    if (!this.enabled || !this.supported || !segs.length) return Promise.resolve();
    if (opts.interrupt) this.stop();
    this.lastBatch = segs;
    return new Promise((resolve) => {
      const chunks: Chunk[] = [];
      for (const seg of segs) {
        const v = this.voiceFor(seg);
        for (const t of chunkText(seg.text)) {
          chunks.push({ text: t, voice: v.voice, lang: v.voice?.lang ?? (this.settings.lang === 'fr' ? 'fr-CA' : 'en-US'), rate: v.rate * this.settings.rate, pitch: v.pitch });
        }
      }
      if (!chunks.length) return resolve();
      chunks[chunks.length - 1].done = resolve;
      this.queue.push(...chunks);
      if (!this.current && !this.paused) this.next();
      this.emit();
    });
  }

  private next() {
    if (this.watchdog) clearTimeout(this.watchdog);
    this.watchdog = null;
    const c = this.queue.shift();
    this.current = c ?? null;
    this.emit();
    if (!c) return;
    const u = new SpeechSynthesisUtterance(c.text);
    if (c.voice) u.voice = c.voice;
    u.lang = c.lang;
    u.rate = Math.max(0.5, Math.min(2, c.rate));
    u.pitch = c.pitch;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      c.done?.();
      if (this.current === c) {
        this.current = null;
        if (!this.paused) this.next();
        else this.emit();
      }
    };
    u.onend = finish;
    u.onerror = finish;
    // Safari sometimes never fires 'end'; move on after a generous estimate.
    const est = (c.text.length / 13) * 1000 / u.rate + 2500;
    this.watchdog = setTimeout(() => {
      if (!this.paused && this.current === c) {
        speechSynthesis.cancel();
        finish();
      }
    }, est * 2);
    speechSynthesis.speak(u);
  }

  /** Stops everything and resolves pending speech. */
  stop() {
    if (!this.supported) return;
    const pending = [this.current, ...this.queue];
    this.queue = [];
    this.current = null;
    this.paused = false;
    if (this.watchdog) clearTimeout(this.watchdog);
    speechSynthesis.cancel();
    pending.forEach((c) => c?.done?.());
    this.emit();
  }

  pause() {
    if (!this.supported || !this.speaking) return;
    this.paused = true;
    speechSynthesis.pause();
    this.emit();
  }

  resume() {
    if (!this.supported) return;
    this.paused = false;
    speechSynthesis.resume();
    if (!this.current) this.next();
    else {
      // Re-arm the safety timer in case Safari drops the 'end' event after a pause.
      const c = this.current;
      if (this.watchdog) clearTimeout(this.watchdog);
      this.watchdog = setTimeout(() => {
        if (!this.paused && this.current === c) {
          speechSynthesis.cancel();
          c.done?.();
          this.current = null;
          this.next();
        }
      }, (c.text.length / 13) * 2000 + 5000);
    }
    this.emit();
  }

  repeat() {
    if (this.lastBatch.length) this.speak(this.lastBatch, { interrupt: true });
  }
}

export const voice = new VoiceEngine();
