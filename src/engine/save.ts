import type { Run } from './types';
import { RUN_VERSION, score } from './run';
import { initStory } from './story';
import { CLASSES } from './data/characters';

// Saves live in localStorage on the iPad: 3 run slots + one meta save.
// Export/import bundles everything into one JSON file for the Files app.

export const SLOTS = [1, 2, 3];
const KEY = (slot: number) => `rrpg.run.${slot}`;
const META_KEY = 'rrpg.meta';
const SETTINGS_KEY = 'rrpg.settings';

export interface HallEntry {
  names: string;
  classes: string;
  distance: number;
  bosses: number;
  score: number;
  outcome: 'victory' | 'wipe';
  date: number;
}

export interface Meta {
  runsStarted: number;
  bestDistance: number;
  hall: HallEntry[];
  /** All-time AI spend on this device. */
  aiCost?: { usd: number; calls: number; haikuUsd: number; sonnetUsd: number };
}

export interface Settings {
  nightMode: boolean;
  confirmEndTurn: boolean;
  /** Shorter pauses between enemy actions. */
  fastCombat: boolean;
  narrationLang: 'en' | 'fr';
  /** Haiku only (cheaper). */
  budgetMode: boolean;
  /** Warn when this run's AI cost passes this many dollars. */
  budgetWarnUsd: number;
  /** Voice narration (iPad built-in voices). */
  voiceOn: boolean;
  voiceRate: number;
  /** voiceURI of the narrator voice; '' = best available. */
  narratorVoice: string;
  npcVoices: boolean;
  verbosity: 'brief' | 'detailed';
  keepAwake: boolean;
}

export interface SlotSummary {
  slot: number;
  empty: boolean;
  title?: string;
  detail?: string;
  updatedAt?: number;
  broken?: boolean;
}

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function saveRun(run: Run): boolean {
  const s = storage();
  if (!s) return false;
  run.updatedAt = Date.now();
  try {
    s.setItem(KEY(run.slot), JSON.stringify(run));
    return true;
  } catch (e) {
    console.error('Save failed', e);
    return false;
  }
}

export function loadRun(slot: number): Run | null {
  const raw = storage()?.getItem(KEY(slot));
  if (!raw) return null;
  try {
    const run = JSON.parse(raw) as Run;
    return migrate(run);
  } catch {
    return null;
  }
}

/** Upgrades older saves as the format changes. */
export function migrate(run: Run): Run {
  if (!run.version) run.version = 1;
  // Phase 2 saves: turn on narration; the story bible gets written on the next scene.
  if (run.narrate === undefined && run.heroes?.length) {
    run.narrate = true;
    run.story ??= initStory();
    if (run.screen === 'hub' && !run.story.bible) {
      run.scene = { kind: 'runStart', status: 'pending', title: '', text: '', next: 'hub' };
      run.screen = 'scene';
    }
  }
  run.version = RUN_VERSION;
  return run;
}

export function deleteRun(slot: number) {
  storage()?.removeItem(KEY(slot));
}

export function slotSummaries(): SlotSummary[] {
  return SLOTS.map((slot) => {
    const raw = storage()?.getItem(KEY(slot));
    if (!raw) return { slot, empty: true };
    try {
      const run = JSON.parse(raw) as Run;
      if (!run.heroes?.length) return { slot, empty: false, title: 'New party (not created yet)', updatedAt: run.updatedAt };
      const names = run.heroes.map((h) => `${h.name} (${CLASSES[h.cls].name} ${h.level})`).join(' & ');
      return {
        slot,
        empty: false,
        title: names,
        detail: `Act ${run.act} · ${run.distance * 10} leagues · ${run.gold} gold`,
        updatedAt: run.updatedAt,
      };
    } catch {
      return { slot, empty: false, broken: true, title: 'Unreadable save' };
    }
  });
}

export function loadMeta(): Meta {
  const raw = storage()?.getItem(META_KEY);
  const base: Meta = { runsStarted: 0, bestDistance: 0, hall: [] };
  if (!raw) return base;
  try {
    return { ...base, ...JSON.parse(raw) };
  } catch {
    return base;
  }
}

export function saveMeta(meta: Meta) {
  try {
    storage()?.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    /* ignore */
  }
}

export function recordRunEnd(run: Run, outcome: 'victory' | 'wipe') {
  const meta = loadMeta();
  meta.bestDistance = Math.max(meta.bestDistance, run.distance);
  meta.hall.push({
    names: run.heroes.map((h) => h.name).join(' & '),
    classes: run.heroes.map((h) => CLASSES[h.cls].name).join(' + '),
    distance: run.distance,
    bosses: run.stats.bossesKilled,
    score: score(run),
    outcome,
    date: Date.now(),
  });
  meta.hall.sort((a, b) => b.score - a.score);
  meta.hall = meta.hall.slice(0, 20);
  saveMeta(meta);
}

export function loadSettings(): Settings {
  const base: Settings = { nightMode: false, confirmEndTurn: false, fastCombat: false, narrationLang: 'en', budgetMode: false, budgetWarnUsd: 5, voiceOn: true, voiceRate: 1, narratorVoice: '', npcVoices: true, verbosity: 'brief', keepAwake: true };
  try {
    return { ...base, ...JSON.parse(storage()?.getItem(SETTINGS_KEY) ?? '{}') };
  } catch {
    return base;
  }
}

export function saveSettings(s: Settings) {
  try {
    storage()?.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

// ---------- Export / import ----------

export interface Backup {
  app: 'roadtrip-rpg';
  version: number;
  exportedAt: number;
  runs: Record<number, Run | null>;
  meta: Meta;
}

export function buildBackup(): Backup {
  const runs: Record<number, Run | null> = {};
  for (const slot of SLOTS) runs[slot] = loadRun(slot);
  return { app: 'roadtrip-rpg', version: RUN_VERSION, exportedAt: Date.now(), runs, meta: loadMeta() };
}

export function restoreBackup(json: string): { ok: boolean; message: string } {
  let data: Backup;
  try {
    data = JSON.parse(json);
  } catch {
    return { ok: false, message: 'That file is not a valid backup.' };
  }
  if (data?.app !== 'roadtrip-rpg' || !data.runs) return { ok: false, message: 'That file is not a Roadtrip RPG backup.' };
  let count = 0;
  for (const slot of SLOTS) {
    const run = data.runs[slot];
    if (run) {
      run.slot = slot;
      saveRun(migrate(run));
      count++;
    }
  }
  if (data.meta) saveMeta(data.meta);
  return { ok: true, message: `Restored ${count} run${count === 1 ? '' : 's'}.` };
}

/** Saves the backup file: the share sheet on iPad (Save to Files), a download elsewhere. */
export async function exportBackup(): Promise<string> {
  const backup = buildBackup();
  const name = `roadtrip-rpg-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'Roadtrip RPG backup' });
      return 'Backup shared.';
    } catch {
      /* fall through to download */
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return `Downloaded ${name}.`;
}
