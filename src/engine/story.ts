import type { AiEventDraft, JournalEntry, JournalKind, PathNode, Run, StoryBible, StoryState } from './types';
import { Rng } from './rng';
import { REGIONS } from './data/enemies';
import { EVENTS } from './data/events';
import { LT_NAMES, LT_TITLES, NPCS, OUTROS, SCENES, TERRAIN, TONES, VILLAINS } from './data/storyTables';
import { rng } from './util';

export function initStory(): StoryState {
  return {
    journal: [],
    flags: [],
    npcsMet: [],
    villainBeats: [0, 0, 0, 0, 0],
    buffer: {},
    eventBuffer: [],
    cost: { usd: 0, calls: 0, haikuUsd: 0, sonnetUsd: 0 },
  };
}

export function story(run: Run): StoryState {
  run.story ??= initStory();
  return run.story;
}

export function addJournal(run: Run, kind: JournalKind, title: string, text: string, summary?: string) {
  const s = story(run);
  const entry: JournalEntry = { act: run.act, distance: run.distance, kind, title, text, summary: summary || text.split(/(?<=[.!?])\s/)[0].slice(0, 160) };
  s.journal.push(entry);
  if (s.journal.length > 200) s.journal.splice(0, s.journal.length - 200);
}

// ---------- Event types (GM note catalog) ----------

export type EventType = 'social' | 'puzzle' | 'trap' | 'moral' | 'merchant' | 'shrine' | 'villain' | 'discovery';

export const EVENT_TYPES: Record<EventType, { name: string; reward: string; penalty: string; desc: string }> = {
  social: { name: 'Social', reward: 'gold', penalty: 'damage', desc: 'talking past, persuading or intimidating someone' },
  puzzle: { name: 'Puzzle', reward: 'xp', penalty: 'damage', desc: 'a riddle, a mechanism, a cipher or a lying stranger' },
  trap: { name: 'Trap', reward: 'item', penalty: 'damage', desc: 'a trapped chest, collapsing path or magic ward' },
  moral: { name: 'Moral choice', reward: 'xp', penalty: 'none', desc: 'a hard choice with no clean answer (some choices need no roll)' },
  merchant: { name: 'Merchant', reward: 'consumable', penalty: 'gold', desc: 'a strange trader, a haggle or a shady deal' },
  shrine: { name: 'Shrine', reward: 'heal', penalty: 'damage', desc: 'a shrine, altar or holy place offering a blessing' },
  villain: { name: 'Villain encounter', reward: 'xp', penalty: 'damage', desc: "a vision, messenger, ruined village or taunt from the villain or a lieutenant" },
  discovery: { name: 'Discovery', reward: 'item', penalty: 'damage', desc: 'ruins, a hidden cache, a strange landmark' },
};

/** Picks the event type for a new event; guarantees about 2 villain encounters per act. */
export function chooseEventType(run: Run): EventType {
  const s = story(run);
  const beats = s.villainBeats[run.act] ?? 0;
  if (beats < 2 && run.actNode >= 2 + beats * 4) return 'villain';
  const r = rng(run);
  const cursed = run.heroes.some((h) => h.curses.length);
  return r.weighted<EventType>([
    ['social', 3],
    ['puzzle', 2],
    ['trap', 2],
    ['moral', 2],
    ['merchant', 1],
    ['shrine', cursed ? 3 : 1],
    ['discovery', 2],
  ]);
}

/** Reward for an event: shrines lift a curse when someone is cursed. */
export function rewardFor(run: Run, type: EventType): string {
  if (type === 'shrine' && run.heroes.some((h) => h.curses.length)) return 'liftCurse';
  return EVENT_TYPES[type].reward;
}

// ---------- Offline fallbacks ----------

function fill(t: string, vars: Record<string, string>) {
  return t.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

export function offlineBible(run: Run): StoryBible {
  const r = new Rng({ rngState: run.seed ^ 0x2f6b });
  const tone = r.pick(TONES);
  const v = r.pick(VILLAINS);
  const names = r.sample(LT_NAMES, 4);
  const titles = r.sample(LT_TITLES, 4);
  return {
    title: `The Road Against ${v.name}`,
    setting: tone.setting,
    tone: tone.tone,
    world: `${tone.setting}. Word on the road is that ${v.name}, ${v.title}, means ${v.motive}. Four lieutenants hold the lands between you and their stronghold.`,
    villain: { name: v.name, title: v.title, motive: v.motive, description: `${v.name} is rarely seen, but their mark is everywhere.` },
    lieutenants: run.regions.map((reg, i) => ({
      act: i + 1,
      name: names[i],
      title: titles[i],
      description: `${names[i]} rules the ${REGIONS[reg].name} for ${v.name}.`,
    })),
    acts: run.regions.map((reg, i) => ({
      act: i + 1,
      title: REGIONS[reg].name,
      hook: `Cross the ${REGIONS[reg].name} and break ${names[i]}'s hold on it.`,
      beats: [],
    })),
    npcs: r.sample(NPCS, 3),
    source: 'offline',
  };
}

function vars(run: Run, enemies?: string[]) {
  const b = story(run).bible;
  const reg = run.regions[run.act - 1];
  const lt = b?.lieutenants.find((l) => l.act === run.act);
  return {
    villain: b?.villain.name ?? 'the enemy',
    lieutenant: lt?.name ?? 'the warlord',
    ltitle: lt?.title ?? '',
    region: REGIONS[reg]?.name ?? 'wilds',
    terrain: TERRAIN[reg] ?? 'brush',
    enemies: enemies?.length ? enemies.join(', ') : Object.values(REGIONS[reg]?.family ?? {}).slice(0, 2).join(' and '),
  };
}

export function offlineNodeScene(run: Run, node: PathNode): { title: string; text: string; summary: string } {
  const r = rng(run);
  const reg = REGIONS[run.regions[run.act - 1]];
  const enemies = node.type === 'fight' || node.type === 'elite' ? Object.values(reg.family).slice(0, 2) : undefined;
  const pool = SCENES[node.type] ?? SCENES.fight;
  const text = fill(r.pick(pool), vars(run, enemies));
  const titles: Record<string, string> = { fight: 'Ambush', elite: 'A Dangerous Foe', rest: 'A Moment of Rest', shop: 'A Traveling Merchant', treasure: 'Something Hidden', boss: 'The Lieutenant', event: 'On the Road' };
  return { title: titles[node.type] ?? 'On the Road', text, summary: text.split('.')[0] };
}

export function offlineActIntro(run: Run): { title: string; text: string } {
  const v = vars(run);
  const b = story(run).bible;
  if (run.act === 1 && b) {
    return {
      title: b.title,
      text: `${b.world}\n\n${run.heroes[0].name} and ${run.heroes[1].name} set out into the ${v.region}. Somewhere ahead, ${v.lieutenant}, ${v.ltitle}, is waiting.`,
    };
  }
  return { title: `Act ${run.act}: ${v.region}`, text: `The ${v.region} stretches ahead. This land belongs to ${v.lieutenant}, ${v.ltitle}, servant of ${v.villain}.` };
}

export function offlineOutro(run: Run): string {
  return fill(rng(run).pick(OUTROS), vars(run));
}

export function offlineEnding(run: Run): string {
  const v = vars(run);
  return `${v.villain} falls at last. The road behind ${run.heroes[0].name} and ${run.heroes[1].name} is long, littered with lieutenants and lost friends, but it is finally theirs. Songs will be written. Some of them might even be true.`;
}

/** Turns a hand-written event template into the same shape the AI returns. */
export function offlineEvent(run: Run, type: string): AiEventDraft {
  const t = rng(run).pick(EVENTS);
  return {
    type,
    region: run.regions[run.act - 1],
    title: t.title,
    text: t.text,
    summary: t.title,
    choices: t.options.map((o) => ({ label: o.label, stat: o.stat, difficulty: o.diff >= 2 ? 'hard' : o.diff === 1 ? 'normal' : 'easy' })),
  };
}

export function nodeKey(run: Run, node: PathNode, index: number): string {
  return `${run.act}:${run.distance}:${index}:${node.type}`;
}
