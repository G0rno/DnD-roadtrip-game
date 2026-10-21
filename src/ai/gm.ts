// The AI Game Master: writes the story, scenes and events. Code still decides every number.
// Every function falls back to the offline buffer or templates, so the game never waits on the API.
import type { AiEventDraft, Difficulty, Line, PathNode, Run, StoryBible } from '../engine/types';
import { STATS } from '../engine/types';
import { AiError, callJson, getApiKey, online, type Tier } from './client';
import { loadMeta, loadSettings, saveMeta } from '../engine/save';
import { CLASSES, RACES, BACKGROUNDS } from '../engine/data/characters';
import { REGIONS } from '../engine/data/enemies';
import { CURSES } from '../engine/data/statuses';
import { derive } from '../engine/character';
import { EVENT_TYPES, linesToText, nodeKey, offlineActIntro, offlineBible, offlineEnding, offlineEvent, offlineNodeScene, offlineOutro, story, textToLines, type EventType } from '../engine/story';

// ---------- Prompts ----------

const GM_RULES = `You are the Game Master of "Roadtrip RPG", a two-player co-op dark-fantasy roguelike. Two friends play it together on one iPad during a long road trip; the driver often only hears the story read aloud, so write for the ear: clear, vivid, concrete.

Rules you always follow:
- The game's code decides every number: rolls, damage, gold, items, XP, enemies, map. You never invent amounts, never change results, never decide whether something succeeds. When given an outcome, you narrate exactly that outcome.
- Stay consistent with the story bible and with what already happened (recent story, choices made, people met).
- Address the two heroes by name. Give them agency; never decide what they feel or say at length.
- Be fair and a bit witty, never adversarial. Foreshadow danger before it hits.
- Keep scenes tight: usually 60 to 130 words, unless the task asks otherwise. No headings, no bullet lists, no meta talk about games or dice.
- Content rating: mature (18+). Graphic violence, gore, swearing, horror and dark themes are fine when they fit. Sexual content stays off-screen.
- Recurring characters and the villain should feel alive: give them motives, voices and memorable details.
- The story is read aloud by voices. Write it as an ordered list of "lines". Narration uses speaker "" (empty). Every piece of spoken dialogue gets its own line with the speaker's name exactly as in the story bible or as introduced (the hero names for the heroes); do not put quotation marks around dialogue, the game adds them. Use the villain's exact name when the villain speaks.
- Reply only with JSON matching the requested schema.`;

function bibleBlock(b: StoryBible): string {
  return `STORY BIBLE (canon for this run):\n${JSON.stringify(b)}`;
}

function lang(): string {
  return loadSettings().narrationLang === 'fr' ? 'French (Québec-friendly, natural)' : 'English';
}

function context(run: Run, extra: Record<string, unknown> = {}) {
  const s = story(run);
  const reg = REGIONS[run.regions[run.act - 1]];
  return {
    language: lang(),
    party: run.heroes.map((h) => {
      const d = derive(h);
      return {
        name: h.name,
        race: RACES[h.race].name,
        class: CLASSES[h.cls].name,
        background: BACKGROUNDS[h.background].name,
        level: h.level,
        hp: h.dead ? 'fallen' : `${h.hp}/${d.maxHp}`,
        curses: h.curses.map((c) => CURSES[c].name),
      };
    }),
    act: run.act,
    region: { name: reg.name, hazard: reg.hazardText, creatures: Object.values(reg.family), nightTwist: reg.nightTwist },
    progress: `node ${run.actNode + 1} of 11 in this act; ${run.distance * 10} leagues travelled`,
    timeOfDay: run.isNight || run.regions[run.act - 1] === 'underdark' ? 'night' : 'day',
    actLieutenant: s.bible?.lieutenants.find((l) => l.act === run.act),
    recentStory: s.journal.slice(-8).map((j) => `[${j.kind}] ${j.summary}`),
    choicesMade: s.flags.map((f) => `act ${f.act}: ${f.text}`),
    peopleMet: s.npcsMet.map((n) => `${n.name} (${n.role})`),
    ...extra,
  };
}

function tierFor(t: Tier): Tier {
  return loadSettings().budgetMode ? 'haiku' : t;
}

// ---------- Cost tracking ----------

let sessionUsd = 0;
export function sessionCost() {
  return sessionUsd;
}

function record(run: Run, usd: number, tier: Tier) {
  const c = story(run).cost;
  c.usd += usd;
  c.calls += 1;
  if (tier === 'haiku') c.haikuUsd += usd;
  else c.sonnetUsd += usd;
  sessionUsd += usd;
  const meta = loadMeta();
  meta.aiCost ??= { usd: 0, calls: 0, haikuUsd: 0, sonnetUsd: 0 };
  meta.aiCost.usd += usd;
  meta.aiCost.calls += 1;
  if (tier === 'haiku') meta.aiCost.haikuUsd += usd;
  else meta.aiCost.sonnetUsd += usd;
  saveMeta(meta);
}

export function aiReady(): boolean {
  return !!getApiKey() && online();
}

let lastError = '';
export function lastAiError() {
  return lastError;
}

async function ask<T>(run: Run, tier: Tier, task: string, schema: object, maxTokens: number, timeoutMs: number, withBible = true): Promise<T> {
  const system = [GM_RULES];
  const b = story(run).bible;
  if (withBible && b) system.push(bibleBlock(b));
  const t = tierFor(tier);
  try {
    const r = await callJson<T>({ tier: t, system, user: task, schema, maxTokens, timeoutMs });
    record(run, r.usd, r.tier);
    lastError = '';
    return r.data;
  } catch (e) {
    lastError = e instanceof AiError ? e.message : String(e);
    throw e;
  }
}

// ---------- Schemas ----------

const str = { type: 'string' };
const obj = (props: Record<string, object>) => ({ type: 'object', properties: props, required: Object.keys(props), additionalProperties: false });
const arr = (items: object) => ({ type: 'array', items });

const LINES = arr(obj({ speaker: str, text: str }));
const SCENE_SCHEMA = obj({ title: str, lines: LINES, summary: str });
const BIBLE_SCHEMA = obj({
  title: str,
  setting: str,
  tone: str,
  world: str,
  villain: obj({ name: str, title: str, motive: str, description: str }),
  lieutenants: arr(obj({ act: { type: 'integer' }, name: str, title: str, description: str })),
  acts: arr(obj({ act: { type: 'integer' }, title: str, hook: str, beats: arr(str) })),
  npcs: arr(obj({ name: str, role: str, description: str })),
});
const STAT_ENUM = { type: 'string', enum: [...STATS, 'none'] };
const DIFF_ENUM = { type: 'string', enum: ['easy', 'normal', 'hard', 'veryhard'] };
const EVENT_SCHEMA = obj({
  title: str,
  lines: LINES,
  summary: str,
  npc: obj({ name: str, role: str, description: str }),
  choices: arr(obj({ label: str, stat: STAT_ENUM, difficulty: DIFF_ENUM })),
});
const OUTCOME_SCHEMA = obj({ text: str });
const OUTCOME_LINES_SCHEMA = obj({ lines: LINES });
const FREE_SCHEMA = obj({ possible: { type: 'boolean' }, reason: str, label: str, stat: STAT_ENUM, difficulty: DIFF_ENUM });

// ---------- Story bible ----------

export async function genBible(run: Run): Promise<StoryBible> {
  const regions = run.regions.map((r, i) => ({ act: i + 1, region: REGIONS[r].name, creatures: Object.values(REGIONS[r].family), hazard: REGIONS[r].hazardText }));
  const task = `Create the STORY BIBLE for a new run.
Party: ${JSON.stringify(context(run).party)}
The four acts happen in these regions, in order (fixed by the game): ${JSON.stringify(regions)}
Roll a fresh setting and tone (any fantasy flavor: grim, gothic, swashbuckling, mythic, weird; surprise us). Write in ${lang()}.
Requirements:
- villain: a memorable antagonist with a clear, personal motive; the final boss.
- lieutenants: exactly 4, one per act (act 1 to 4), each ruling that act's region; they are the act bosses. Give each a name, a title and a short description with a hook.
- acts: exactly 4, matching the regions; a title, a hook (the act's goal), and 3 to 4 beats (foreshadowing, villain appearances, twists) to hit during the act.
- npcs: 3 to 4 recurring characters (allies, rivals, ambiguous figures) the party can meet across acts.
- world: 2 to 3 sentences of setting the scene.
- title: a name for this saga.`;
  try {
    const b = await ask<Omit<StoryBible, 'source'>>(run, 'sonnet', task, BIBLE_SCHEMA, 2500, 60000, false);
    if (b.lieutenants.length < 4 || !b.villain?.name) throw new Error('incomplete');
    b.lieutenants = [1, 2, 3, 4].map((a, i) => b.lieutenants.find((l) => l.act === a) ?? b.lieutenants[i]).map((l, i) => ({ ...l, act: i + 1 }));
    return { ...b, source: 'ai' };
  } catch {
    return offlineBible(run);
  }
}

// ---------- Scenes ----------

export interface SceneText {
  title: string;
  text: string;
  summary: string;
  lines?: Line[];
}

interface RawScene {
  title: string;
  lines: Line[];
  summary: string;
}

function cleanLines(lines: Line[] | undefined): Line[] {
  return (lines ?? []).filter((l) => l && typeof l.text === 'string' && l.text.trim()).map((l) => ({ speaker: (l.speaker ?? '').trim(), text: l.text.trim() }));
}

function toScene(r: RawScene): SceneText {
  const lines = cleanLines(r.lines);
  if (!lines.length) throw new Error('empty scene');
  return { title: r.title, lines, text: linesToText(lines), summary: r.summary };
}

function offline(t: { title: string; text: string; summary?: string }): SceneText {
  return { title: t.title, text: t.text, summary: t.summary ?? t.text.split('.')[0], lines: textToLines(t.text) };
}

async function askScene(run: Run, tier: Tier, task: string, maxTokens: number, timeoutMs: number): Promise<SceneText> {
  return toScene(await ask<RawScene>(run, tier, task, SCENE_SCHEMA, maxTokens, timeoutMs));
}

function nodeTask(run: Run, node: PathNode): string {
  const reg = REGIONS[run.regions[run.act - 1]];
  const what: Record<string, string> = {
    fight: `The party runs into hostile ${Object.values(reg.family).join(', ')} (some of them). Set up the fight: who they are, why they're here, how it starts. End right as the fight begins.`,
    elite: 'The party meets a single dangerous champion leading a band of local creatures. Make it menacing. End as the fight begins.',
    rest: 'The party finds a place to rest (a campfire, a ruin, a friendly stop). A quiet moment; a short exchange or a detail that ties to the story is welcome. They will choose to rest or use a forge.',
    shop: 'The party meets a merchant. Give the merchant a name and a personality in one or two strokes. They will then browse the wares.',
    treasure: 'The party finds hidden treasure. Describe the find and a hint of its past owner.',
    boss: `The party reaches the act's lieutenant. This is a big moment: a confrontation, a speech, a threat, tied to the villain and to what the party did this act. 120 to 180 words. End as the fight begins.`,
  };
  return `${JSON.stringify(context(run))}\n\nTASK: Write the scene for the next step of the road. ${what[node.type] ?? what.fight}\nReturn title (2 to 5 words), text, and summary (one sentence for the chronicle).`;
}

export async function genNodeScene(run: Run, node: PathNode): Promise<SceneText> {
  const boss = node.type === 'boss';
  try {
    return await askScene(run, boss ? 'sonnet' : 'haiku', nodeTask(run, node), boss ? 800 : 550, boss ? 30000 : 15000);
  } catch {
    return offline(offlineNodeScene(run, node));
  }
}

export async function genActIntro(run: Run): Promise<SceneText> {
  const first = run.act === 1;
  const task = `${JSON.stringify(context(run))}\n\nTASK: ${
    first
      ? 'Open the saga. Introduce the world and the stakes, hint at the villain, and set the two heroes on the road into the first region. 150 to 220 words.'
      : `A new act begins. Briefly reflect on the lieutenant the party just defeated and what it cost, then open the new region and its lieutenant's threat. 120 to 180 words.`
  }\nReturn title, text, and summary (one sentence).`;
  try {
    return await askScene(run, 'sonnet', task, 1000, 35000);
  } catch {
    return offline(offlineActIntro(run));
  }
}

export async function genEnding(run: Run): Promise<SceneText> {
  const task = `${JSON.stringify(context(run))}\n\nTASK: The villain has been defeated. Write the ending of the saga: the final moments, what changed in the world, and a fitting farewell for each hero that reflects their choices. 200 to 300 words.\nReturn title, text, summary.`;
  try {
    return await askScene(run, 'sonnet', task, 1300, 40000);
  } catch {
    return offline({ title: 'The End of the Road', text: offlineEnding(run), summary: 'The villain fell.' });
  }
}

export async function genOutro(run: Run): Promise<string> {
  const o = run.pendingOutro;
  if (!o) return '';
  const task = `${JSON.stringify(context(run, { defeated: o.enemies, fightType: o.kind }))}\n\nTASK: The party just won the fight against ${o.enemies.join(', ')}. Write a short aftermath: 25 to 50 words (a detail, a clue, a quip between the heroes). Return text.`;
  try {
    const r = await ask<{ text: string }>(run, 'haiku', task, OUTCOME_SCHEMA, 200, 10000);
    return r.text;
  } catch {
    return offlineOutro(run);
  }
}

/** Recap on resume: 2 to 3 sentences, or a longer "previously on..." after a long break. */
export async function genRecap(run: Run, long = false): Promise<string> {
  const j = story(run).journal;
  if (!j.length) return '';
  const task = `${JSON.stringify(context(run, { recentStory: j.slice(long ? -25 : -10).map((x) => x.summary) }))}\n\nTASK: The players are resuming after a break. ${
    long
      ? 'Write a "Previously on..." recap of the story so far: the villain, what happened this act, who they met, the choices they made, and the current goal. 110 to 170 words.'
      : 'Write a quick recap in 2 or 3 sentences: where they are, what just happened, what is next.'
  } Return text.`;
  try {
    const r = await ask<{ text: string }>(run, 'haiku', task, OUTCOME_SCHEMA, 350, 12000);
    return r.text;
  } catch {
    return j
      .slice(-3)
      .map((x) => x.summary)
      .join(' ');
  }
}

// ---------- Events ----------

interface RawEvent {
  title: string;
  lines: Line[];
  summary: string;
  npc: { name: string; role: string; description: string };
  choices: AiEventDraft['choices'];
}

function toEvent(run: Run, d: RawEvent, type: string): AiEventDraft {
  const lines = cleanLines(d.lines);
  if (!d.choices?.length || !lines.length) throw new Error('incomplete event');
  return { title: d.title, summary: d.summary, choices: d.choices, lines, text: linesToText(lines), type, region: run.regions[run.act - 1], npc: d.npc?.name ? d.npc : undefined };
}

export function withLines(d: AiEventDraft): AiEventDraft {
  return d.lines ? d : { ...d, lines: textToLines(d.text) };
}

export async function genEvent(run: Run, type: EventType): Promise<AiEventDraft> {
  const t = EVENT_TYPES[type];
  const ev = run.event;
  const reward = ev?.reward ?? t.reward;
  const rewardText: Record<string, string> = {
    gold: 'gold',
    item: 'an item',
    xp: 'experience, knowledge or insight',
    consumable: 'a potion, bomb or other supply',
    heal: 'healing or a blessing',
    liftCurse: 'lifting a curse that clings to the party',
    reroll: 'a stroke of luck',
  };
  const task = `${JSON.stringify(context(run))}

TASK: Write a ${t.name.toUpperCase()} event (${t.desc}) for this point of the road.
- If it fits, use a recurring NPC from the story bible or someone already met; or introduce a new named character (fill npc; otherwise npc fields are empty strings).
${type === 'villain' ? '- This is a villain encounter: the villain or this act\'s lieutenant shows their hand (a vision, a messenger, a ruined village, a taunt). Advance the main plot.\n' : ''}${type === 'moral' ? '- A real dilemma with no clean answer. At least one choice uses stat "none" (no roll). Choices will be remembered and can pay off later.\n' : ''}- Success will be rewarded with ${rewardText[reward] ?? 'a reward'}; failure ${t.penalty === 'damage' ? 'hurts the hero who acts' : t.penalty === 'gold' ? 'costs gold' : 'has no direct cost'}. Make the scene's stakes match.
- 2 to 4 choices. Each: a short label (an action, max 8 words), the stat it tests (might = force, agility = speed/stealth/traps, mind = knowledge/puzzles, spirit = will/faith/persuasion, none = no roll), and a difficulty (easy, normal, hard, veryhard) that fits how risky it sounds.
- lines: 70 to 130 words in total, ending with the situation the heroes must act on.
Return title, lines, summary (one sentence), npc, choices.`;
  try {
    const d = await ask<RawEvent>(run, type === 'villain' ? 'sonnet' : 'haiku', task, EVENT_SCHEMA, 1000, type === 'villain' ? 30000 : 18000);
    return toEvent(run, d, type);
  } catch {
    return withLines(offlineEvent(run, type));
  }
}

export async function genOutcome(run: Run): Promise<{ text: string; lines: Line[] } | null> {
  const ev = run.event;
  if (!ev?.outcomeFacts) return null;
  const task = `${JSON.stringify(context(run))}

The event so far: "${ev.title}". ${ev.text}
OUTCOME DECIDED BY THE GAME (narrate exactly this, do not change it): ${ev.outcomeFacts}
TASK: Narrate what happens, 50 to 100 words. Mention the concrete gains or losses naturally. If it was a moral choice, show its immediate consequence and hint it may matter later. Return lines.`;
  try {
    const r = await ask<{ lines: Line[] }>(run, ev.type === 'villain' ? 'sonnet' : 'haiku', task, OUTCOME_LINES_SCHEMA, 500, 15000);
    const lines = cleanLines(r.lines);
    return lines.length ? { lines, text: linesToText(lines) } : null;
  } catch {
    return null;
  }
}

export interface FreeTextResult {
  possible: boolean;
  reason: string;
  label: string;
  stat: (typeof STATS)[number] | 'none';
  difficulty: Difficulty;
}

/** Maps the players' own idea to a stat and difficulty from the allowed list. */
export async function mapFreeText(run: Run, idea: string): Promise<FreeTextResult> {
  const ev = run.event!;
  const task = `${JSON.stringify(context(run))}

Current situation: "${ev.title}". ${ev.text}
The players propose their own action: "${idea.slice(0, 300)}"
TASK: Decide if this is possible in the fiction. If yes, give a short label (max 8 words), the stat it tests (might, agility, mind, spirit, or none if no roll makes sense) and a fair difficulty (easy, normal, hard, veryhard). Creative, reasonable ideas deserve normal or easy. If impossible, set possible false and explain briefly in reason (one sentence, in ${lang()}).`;
  return ask<FreeTextResult>(run, 'haiku', task, FREE_SCHEMA, 250, 15000);
}

// ---------- Buffer (pre-writing while there's signal) ----------

let prefetching = false;

/** Pre-writes scenes for the path choices on offer and one event, so dead zones still have narration. */
export async function prefetch(run: Run, onUpdate: () => void) {
  if (prefetching || !aiReady() || !run.narrate || !story(run).bible) return;
  prefetching = true;
  try {
    const s = story(run);
    for (let i = 0; i < run.choices.length; i++) {
      const node = run.choices[i];
      if (node.type === 'event') continue;
      const key = nodeKey(run, node, i);
      if (s.buffer[key]) continue;
      try {
        const boss = node.type === 'boss';
        s.buffer[key] = await askScene(run, boss ? 'sonnet' : 'haiku', nodeTask(run, node), boss ? 800 : 550, boss ? 30000 : 15000);
        onUpdate();
      } catch {
        break;
      }
    }
    // Keep a couple of events ready for this region.
    const reg = run.regions[run.act - 1];
    const types: EventType[] = ['social', 'trap', 'discovery', 'puzzle'];
    while (s.eventBuffer.filter((e) => e.region === reg).length < 2 && aiReady()) {
      const type = types[s.eventBuffer.length % types.length];
      try {
        const d = await ask<RawEvent>(
          run,
          'haiku',
          `${JSON.stringify(context(run))}\n\nTASK: Write a ${EVENT_TYPES[type].name.toUpperCase()} event (${EVENT_TYPES[type].desc}) that could happen anywhere in this region in the next hour of play. It must not depend on a specific previous scene. 2 to 4 choices with stat (might, agility, mind, spirit, none) and difficulty. lines 70 to 130 words in total. npc fields empty strings if none.`,
          EVENT_SCHEMA,
          1000,
          18000,
        );
        s.eventBuffer.push(toEvent(run, d, type));
        onUpdate();
      } catch {
        break;
      }
    }
  } finally {
    prefetching = false;
  }
}
